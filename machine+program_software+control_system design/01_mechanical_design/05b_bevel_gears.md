# M5b – Bevel gears: types, cone geometry, virtual gears, spiral forces, ISO 10300 capacity, contact pattern, manufacturing

> Field 1 *Mechanical design*, item 5b (companion of M5 cylindrical gears – helical gears are fully covered in M5).
> **Theory and program are combined:** every formula is followed by the code of `tools/bevel.py`, the command and the real
> output. MATLAB mirror: `tools/bevel.m`. Web: tab **M_P_C tools**, item 9. Python standard library only – offline.
> The program re-uses the M5 code (`gear.py`) for the tooth form factors of the **virtual cylindrical gears**.
> **All inputs are example values.** ISO 23509 / ISO 10300 are implemented in a simplified form; values marked "check"
> must be compared with the standards or the gear-machine maker's documentation before a design is released.

## Contents
0. How to use this guide with the program
1. Purpose – what a bevel gear calculation must prove
2. Bevel gear types, applications and terminology
3. Cone geometry and the virtual cylindrical gears
4. Forces (hand of spiral, rotation) and the bearing hand-over
5. Load capacity in the style of ISO 10300
6. Contact pattern, mounting deviations and backlash
7. Manufacturing of bevel gears (blank, generating, face milling / face hobbing, heat treatment, lapping / grinding, inspection, assembly)
8. Verification, complete worked example, references, glossary

---

## 0. How to use this guide with the program

### 0.1 Commands
| Command | What it does |
|---|---|
| `python bevel.py params` | Default input as JSON (copy → edit → `--in`) |
| `python bevel.py run --in my.json --out res` | Full calculation → `report.md`, `blank.csv` (blank / turning data) |
| `python bevel.py examples` | Report of the default spiral bevel stage, the straight version, the four hand / rotation cases |
| `python bevel.py ch24` / `ch56` / `ch78` | Extra results of chapters 2–4 / 5–6 / 7–8 |
| `python bevel.py selftest` | Independent cross-checks → SELFTEST PASS |
| Web: `http://localhost:8080/?mpcitem=9#mpc` | Same calculation with KPIs, cone sketch, spiral angle along the face, blank table |

### 0.2 Program map – formula → function
| Chapter | Physics / method | Function |
|---|---|---|
| 3 | Pitch angles, cone distances, modules, addendum modification, constant-clearance tooth taper, face / root angles, outside diameters, crown to apex, virtual gears, contact ratios, face-width limits | `geometry()` |
| 4 | Tangential, axial, radial forces with hand of spiral and rotation | `forces()` |
| 5 | ISO 10300 style capacity via the virtual cylindrical gears (re-uses `gear.KV_factor`, `gear.KFbeta`, `gear.ZE`, `gear.Zeps`, `gear.Zbeta`, `gear.Ybeta`, `gear.form_factor_B`) | `capacity()` |
| 7 | Chordal tooth thickness (outer and mean normal section), face-milling cutter radius and spiral angle along the face | `chordal_thickness()`, `cutter_data()` |
| – | Report, blank CSV | `report_text()`, `run()` |
| 2–4 | Toe check, addendum-modification table, blank data with tolerances, shaft-angle cases, the four force cases, resultant check, overhung pinion bearings (M3 / M4 hand-over), mounting deflection | `toe_check()`, `addendum_mod_table()`, `blank_data()`, `shaft_angle_cases()`, `force_cases()`, `resultant_check()`, `overhung_pinion()`, `overhung_check_with_shaft()`, `pinion_bearing_life()`, `mounting_deflection()` |
| 5–6 | Factor breakdown, spiral-angle / size / mounting studies, maximum power, backlash from mounting errors, backlash table, thermal mounting change | `MOUNTING_KHBE`, `factor_breakdown()`, `spiral_study()`, `size_study()`, `mounting_study()`, `max_power()`, `backlash_mounting()`, `BACKLASH_TABLE`, `backlash_recommendation()`, `thermal_mounting()` |
| 7–8 | Process chains, blank-error effect, crown gear + ratio of roll, face-hobbing ratio, cycle time, case depth, pinion shim, backlash from axial movement, worked example | `PROCESS_CHAINS`, `blank_error_effect()`, `crown_gear()`, `face_hobbing_ratio()`, `cycle_time()`, `case_depth()`, `pinion_shim()`, `backlash_from_axial()`, `dx_for_backlash()`, `EXAMPLE`, `design_example()` |
Example input of chapter 8: `tools/examples/bevel_example.json`. Internal bevel gears (pitch angle ≥ 90°) are rejected by `capacity()` with a clear message.

### 0.3 What the self-test proves
1. δ1 + δ2 = Σ; R_e from pinion = R_e from wheel; for Σ = 90°: tan δ1 = z1/z2 and u_v = u².
2. Σ = 90°: the wheel axial force equals the pinion radial force and vice versa; F_t at d_m1 gives T1.
3. Straight bevel: F_a1 = F_t tanα sinδ1, F_r1 = F_t tanα cosδ1.
4. Constant clearance: tip angle of one member = root angle of the other.
5. The face-milling cutter gives exactly β_m at R_m; face width within b ≤ R_e/3 and ≤ 10 m_et.

## 1. Purpose – what a bevel gear calculation must prove

| Proof | Question | Chapter |
|---|---|---|
| Geometry | Correct cones, no undercut / pointed teeth, face width not too large, contact ratio | 3 |
| Forces | Axial and radial forces with the right sign – the mesh must open, not jam, under load | 4 |
| Capacity | Pitting and root strength (ISO 10300) | 5 |
| Contact pattern | Correct pattern position under load; tolerances of the mounting distances | 6 |
| Manufacture | Blank data, cutting method, cutter, heat treatment, finishing, inspection, assembly (shims, backlash) | 7 |

**Default example** (`python bevel.py examples`): spiral bevel right-angle stage 7.5 kW at 1450 rpm, z 17 / 43
(u 2.529), m_et 3 mm, b 18 mm, β_m 35°, left-hand pinion turning clockwise, 18CrNiMo7-6 case hardened and lapped.

| Result | Value |
|---|---|
| Pitch angles, cone distances | 21.571° / 68.429°; R_e 69.358, R_m 60.358 mm (b/R_e 0.26) |
| Virtual gears, contact ratios | z_v 18.28 / 116.96; ε_vα 1.225, ε_vβ 1.537 |
| Forces | F_t 2226 N; pinion F_a 1813 N (away from the apex), F_r 347 N |
| Capacity | S_H 1.39; S_F 3.80 / 3.46 |
| Cutting | face-milling cutter r_c 63.5 mm (5″); spiral angle heel 39.2° / mean 35° / toe 31.3° |


---

## 2 Bevel gear types, applications and terminology

> Program: `tools/bevel.py` (`python bevel.py examples`, extra results `python bevel.py ch24`). All numbers are
> **example values**. Standard values and machine-maker rules are marked "check".

### 2.1 What a bevel gear does

A bevel gear pair transmits rotation between **intersecting shafts**. The shaft angle Σ is usually 90°, but any angle
is possible. The teeth sit on **cones** instead of cylinders. All cones have the same tip: the **apex**. The pitch cones
of pinion and wheel roll on each other without slip, just like the pitch cylinders of a spur pair.

Why it is harder than a cylindrical gear:
- The tooth size changes along the face width: big at the outer end (**heel**), small at the inner end (**toe**).
- The position of the gears along their axes must be exact. If the apexes do not meet, the contact moves to the toe
  or heel and the gear is noisy or breaks. This is why bevel gears have a **mounting distance** on the drawing.
- Spiral bevel gears produce large **axial forces** that change direction with the hand of spiral and the direction
  of rotation (chapter 4).
- They are cut on special machines (Gleason, Klingelnberg, Oerlikon) and are lapped or ground **as a matched pair**.

### 2.2 Types

| Type | Tooth trace (lengthwise) | Depth | Cutting method | Typical use |
|---|---|---|---|---|
| **Straight bevel** | straight line through the apex | tapered (depth falls to the toe) | two-tool generator, Coniflex disc cutters, planing, precision forging | low speed (< 5–8 m/s), differentials, hand drives, low cost |
| **Coniflex straight** | straight, slightly crowned lengthwise | tapered | Gleason Coniflex (two interlocking disc cutters) | straight bevel with localized contact, tolerant to misalignment |
| **Spiral bevel (Gleason)** | circular arc | tapered (standard / duplex taper) | **face milling**: one tooth slot at a time, indexing | machine tools, conveyors, robots, industrial right-angle gearboxes |
| **Cyclo-palloid (Klingelnberg)** | extended epicycloid | **uniform depth** | **face hobbing**: continuous indexing, two-part cutter head | industrial gearboxes, large gears, hard skiving possible |
| **Oerlikon (spiroflex/spirac)** | extended epicycloid | uniform depth | face hobbing | automotive, industrial |
| **Zerol** | curved (circular arc) but β_m = 0 | tapered | face milling | replaces straight bevels where smoother running is needed; axial force like straight bevel |
| **Hypoid** | curved, **offset** axes (do not intersect) | tapered | face milling / hobbing | vehicle axles; large sliding along the tooth → **EP (hypoid) oil**, higher loss. Overview only – the program does not cover the offset |
| **Crown / face gear** | wheel with pitch angle 90° (flat) | – | special hobbing / grinding | high-ratio right-angle drives, aerospace |

**Spiral angle** β_m is the angle between the tooth trace and the cone element at the mean point. Typical
β_m = 30–35° (Gleason). A larger β_m gives a higher overlap ratio ε_β (smoother, quieter) but a larger axial force.

**Hand of spiral**: looking at the face of the gear (from the apex side), a tooth that curves away from you clockwise
from the toe to the heel is **right hand**, counter-clockwise is **left hand**. Pinion and wheel always have
**opposite** hands.

### 2.3 Tooth depth systems – why they matter for cutting

| System | Root line | Consequence for manufacture |
|---|---|---|
| **Standard taper** | root cone and pitch cone have a common apex | depth proportional to cone distance; slot width at the toe can become too small for the cutter point → limits b/Re |
| **Duplex taper** | root apex moved so that slot width is constant at both ends | both flanks of a slot cut in **one pass** (completing / two-sided cutting) → productive Gleason face milling |
| **Uniform depth** | root line parallel to the pitch line | needed for face hobbing (Klingelnberg, Oerlikon): the cutter head works with continuous indexing; tooth depth equal along the face |
| **Constant clearance** (used in `bevel.py`) | tip cone of one gear parallel to the root cone of the other | bottom clearance equal along the face; a simple standard-depth model for design calculations |

The program uses **constant clearance, standard-depth** teeth. This gives correct pitch geometry, virtual gears, forces and
load capacity for design. The exact tooth depth system of the production gear is decided with the cutting-machine
software (Gleason GEMS / CAGE, Klingelnberg KIMOS) – **check** the final blank data there.

### 2.4 Selection table

| Criterion | Straight | Zerol | Spiral (face milled) | Face hobbed (uniform depth) | Hypoid |
|---|---|---|---|---|---|
| Ratio per stage | 1 – 6 | 1 – 6 | 1 – 10 | 1 – 10 | 2.5 – 10 (up to 50+ with offset) |
| Pitch line speed | < 5 – 8 m/s (ground up to ~15) | < 15 m/s | up to 40 m/s (ground) | up to 40 m/s | up to 40 m/s |
| Noise | high | medium | low | low | lowest |
| Load capacity (same size) | 1 (reference) | ≈ 1.1 | ≈ 1.3 – 1.5 | ≈ 1.3 – 1.5 | ≈ 1.5 (larger pinion) |
| Axial force | small, always away from apex | like straight | large, sign depends on hand + rotation | as spiral | large |
| Efficiency per stage | 98 – 99 % | 98 – 99 % | 98 – 99 % | 98 – 99 % | 90 – 97 % |
| Hard finishing | grinding (Coniflex) | grinding | **grinding** (face-milled only) or lapping | **hard skiving** or lapping (grinding not possible for epicycloid) | lapping / grinding |
| Relative cost | low | medium | medium–high | medium–high | high |

(Typical ranges – check with the gear supplier for your size and quality.)

### 2.5 Where bevel gears appear in this factory
- **Right-angle gearmotors** for roller conveyors and transfer units (helical-bevel gearmotors: one spiral bevel stage +
  helical stages).
- **Rotary tables and indexers** (guide 17 / pallet changer): bevel stage between motor and worm or cam.
- **AGV wheel drives** (guide 11): compact right-angle drive inside the wheel unit.
- **Machine-tool heads**: angle heads and swivel heads on the HMC (guide 12), spiral bevel ground pairs.
- The compressor itself uses a belt (M2), not gears.

The default example of `bevel.py` is such a stage: **spiral bevel, z 17/43 (u 2.529), m_et 3 mm, b 18 mm, β_m 35°,
7.5 kW at 1450 rpm, case-hardened 18CrNiMo7-6**.

### 2.6 Terms

| Term | Meaning |
|---|---|
| Pitch cone, pitch angle δ | cone that rolls without slip; δ1 + δ2 = Σ |
| Apex | common tip of all cones; the shaft axes cross here |
| Heel / toe | outer (large) / inner (small) end of the tooth |
| Outer cone distance R_e | length of the pitch-cone element from apex to heel |
| Mean cone distance R_m | R_e − b/2 (calculation section for forces and strength) |
| Outer transverse module m_et | d_e / z at the heel (the "nominal" module on the drawing) |
| Mean normal module m_mn | module at the mean point, normal to the tooth (used for strength) |
| Crown gear | imaginary gear with δ = 90°; the "rack" of bevel gears – the cutting machine simulates it |
| Back cone | cone perpendicular to the pitch cone at the heel; basis of the Tredgold approximation |
| Face angle δ_a, root angle δ_f | tip-cone and root-cone angles (turned on the blank / cut by the tool) |
| Crown to apex | axial distance from the crown (outer tip edge) to the apex – the main blank dimension |
| Mounting distance | distance from the apex to a reference face (back face) of the gear – set with shims at assembly |
| Spiral angle β_m, hand of spiral | see 2.2 |

**Check questions 2**
1. Why must the apexes of pinion and wheel coincide, and what happens to the contact pattern if they do not?
2. Why can face-hobbed (epicycloid) bevel gears not be ground, and what is used instead?
3. Which bevel type would you choose for a quiet 7.5 kW right-angle conveyor drive at 1450 rpm, and why?

---

## 3 Cone geometry

### 3.1 Pitch angles

**Theory.** The two pitch cones touch along a common element. At the heel, both pitch circles have the same pitch
(same module), so d_e1/d_e2 = z1/z2 = 1/u. Each pitch radius is the cone element times the sine of its pitch angle:
d_e1/2 = R_e sin δ1, d_e2/2 = R_e sin δ2. So

  sin δ2 / sin δ1 = u ,  δ2 = Σ − δ1

**Derivation.** sin(Σ − δ1) = u sin δ1 → sin Σ cos δ1 − cos Σ sin δ1 = u sin δ1 → divide by cos δ1:

  **tan δ1 = sin Σ / (cos Σ + u)**   δ2 = Σ − δ1

For Σ = 90°: tan δ1 = 1/u = z1/z2.

**Cone distances and modules.**

| Quantity | Formula |
|---|---|
| Outer pitch diameter | d_e = m_et z |
| Outer cone distance | R_e = d_e1 / (2 sin δ1) = d_e2 / (2 sin δ2) |
| Mean cone distance | R_m = R_e − b/2 |
| Mean transverse module | m_mt = m_et R_m / R_e |
| Mean normal module | m_mn = m_mt cos β_m |
| Mean pitch diameter | d_m = m_mt z |

**In the program** (`geometry()`, first part):
```python
z1, z2, S = P["z1"], P["z2"], math.radians(P["Sigma_deg"])
u = z2 / z1
d1 = math.atan(math.sin(S) / (math.cos(S) + u))          # pitch angle pinion
d2 = S - d1
met = P["met"]
de1, de2 = met * z1, met * z2
Re = de1 / (2 * math.sin(d1))
b = P["b"]
Rm = Re - b / 2
mmt = met * Rm / Re
bm = math.radians(P["beta_m_deg"])
mmn = mmt * math.cos(bm)
```

**Run it:** `python bevel.py examples`
```
- u 2.5294; pitch angles 21.5713 / 68.4287 deg; de 51.000 / 129.000; Re 69.358, Rm 60.358 mm; b/Re 0.260 (<= 1/3 OK)
- m_mt 2.6107, m_mn 2.1386; dm 44.382 / 112.261; x 0.3290 / -0.3290
```
**Interpretation.** tan δ1 = 17/43 → δ1 = 21.57°. The heel module 3 mm shrinks to 2.611 mm at the mean point and to
2.139 mm in the normal section (cos 35°). All strength calculations use the **mean normal module 2.139 mm**, not the
3 mm on the drawing.

### 3.2 Face width rules – why b ≤ R_e/3

**Theory.** Every tooth dimension is proportional to the distance from the apex. At the toe (cone distance R_e − b) the
module is m_et (R_e − b)/R_e. A wide face makes the toe tooth small: the cutter point no longer fits in the slot, the
toe tooth is weak, and small mounting errors move the load to the toe. Practice rules (check with ISO 23509 /
machine maker): **b ≤ R_e/3** and **b ≤ 10 m_et** (the smaller one governs).

**Run it:** `python bevel.py ch24` (first block)
```
  Re 69.358 mm
  b  12.00 mm: b/Re 0.173, toe module 2.481 mm, heel/toe size ratio 1.209
  b  18.00 mm: b/Re 0.260, toe module 2.221 mm, heel/toe size ratio 1.350
  b  23.12 mm: b/Re 0.333, toe module 2.000 mm, heel/toe size ratio 1.500
  b  30.00 mm: b/Re 0.433, toe module 1.702 mm, heel/toe size ratio 1.762
  b  34.68 mm: b/Re 0.500, toe module 1.500 mm, heel/toe size ratio 2.000
```
**Interpretation.** With b = R_e/3 = 23.12 mm the toe module is exactly 2.000 mm and the heel tooth is 1.5 times larger
than the toe tooth. At b = R_e/2 the toe module is only 1.5 mm (ratio 2.0) – the toe is too weak and hard to cut.
The default b = 18 mm (b/R_e 0.26) is a normal choice.

### 3.3 Addendum modification x and thickness modification x_s

**Theory.** As for cylindrical gears, the small pinion has a thin root and higher specific sliding. Bevel gears use
**x1 = −x2** (a "long-and-short addendum" system), so the cone distances and pitch angles do not change. The
Gleason-style rule used in the program (check with ISO 23509 Annex / machine-maker tables):

  **x1 = 0.39 (1 − 1/u²)** spiral bevel,  **x1 = 0.46 (1 − 1/u²)** straight bevel,  x2 = −x1

A **thickness modification x_s** (pinion tooth made thicker, wheel tooth thinner at the pitch line) is used in addition
to balance root strength. It does not change the addendum. It is **not** in `bevel.py`; in production it is set in the
cutting summary.

**Run it:** `python bevel.py ch24`
```
  u 1.00: spiral x1 0.000, straight x1 0.000
  u 1.50: spiral x1 0.217, straight x1 0.256
  u 2.00: spiral x1 0.292, straight x1 0.345
  u 2.53: spiral x1 0.329, straight x1 0.388
  u 3.00: spiral x1 0.347, straight x1 0.409
  u 4.00: spiral x1 0.366, straight x1 0.431
  u 6.00: spiral x1 0.379, straight x1 0.447
```
For u = 2.53 the spiral rule gives x1 = 0.329, exactly the value in the report (x 0.3290 / −0.3290).

### 3.4 Tooth taper with constant clearance, addendum, dedendum, angles

**Theory.** Mean addendum and dedendum (standard basic rack h_aP = 1.0, h_fP = 1.25 times m_mn):

  h_am = (h_aP + x) m_mn ,  h_fm = (h_fP − x) m_mn

Dedendum angle θ_f = arctan(h_fm / R_m). With **constant clearance** the tip cone of one member is parallel to the root
cone of the other: θ_a1 = θ_f2, θ_a2 = θ_f1. At the heel:

  h_ae = h_am + (b/2) tan θ_a ,  h_fe = h_fm + (b/2) tan θ_f
  face angle δ_a = δ + θ_a ,  root angle δ_f = δ − θ_f ,  outside diameter d_ae = d_e + 2 h_ae cos δ
  crown to apex x_a = R_e cos δ − h_ae sin δ ,  back angle = 90° − δ (back cone ⊥ pitch cone)

**In the program** (`geometry()`, second part):
```python
x1 = P["x1"]
if x1 is None:
    x1 = (0.39 if P["kind"] == "spiral" else 0.46) * (1 - 1 / u ** 2)
x2 = -x1
ham1, ham2 = (P["haP"] + x1) * mmn, (P["haP"] + x2) * mmn
hfm1, hfm2 = (P["hfP"] - x1) * mmn, (P["hfP"] - x2) * mmn
# constant clearance: tip angle of one member = root angle of the other
thf1, thf2 = math.atan(hfm1 / Rm), math.atan(hfm2 / Rm)
tha1, tha2 = thf2, thf1
hae1, hae2 = ham1 + b / 2 * math.tan(tha1), ham2 + b / 2 * math.tan(tha2)
hfe1, hfe2 = hfm1 + b / 2 * math.tan(thf1), hfm2 + b / 2 * math.tan(thf2)
dae1, dae2 = de1 + 2 * hae1 * math.cos(d1), de2 + 2 * hae2 * math.cos(d2)
```

**Run it:** `python bevel.py examples`
```
- addendum mean 2.842 / 1.435, outer 3.346 / 1.729; dedendum outer 2.263 / 3.880 mm
- face angles 24.774 / 70.298, root angles 19.702 / 65.226 deg; outside diameters dae 57.223 / 130.271; crown to apex 63.270 / 23.892 mm
```
**Interpretation.** The pinion addendum is about twice the wheel addendum (long-and-short system). Pinion face angle
24.774° = 21.571° + 3.203°, root angle 19.702° = 21.571° − 1.869°. These angles, the outside diameter and the crown to
apex are the **turning dimensions of the blank** (3.6).

### 3.5 The Tredgold approximation – virtual cylindrical gears

**Theory.** Near the heel the tooth profile lies on the **back cone**, which is perpendicular to the pitch cone.
Developed into a plane, the back cone becomes a sector of a cylindrical gear with radius

  r_v = r / cos δ   (back-cone element length)

At the mean section: d_v = d_m / cos δ. This **virtual cylindrical gear** has the same module and

  **z_v = z / cos δ** (not an integer – it is a calculation gear)

For **spiral** bevels the virtual gear is helical (helix angle β_m). Its normal section is a virtual spur gear, found
exactly as for helical gears (M5 chapter 3):

  α_t = arctan(tan α_n / cos β_m) ,  sin β_b = sin β_m cos α_n ,  **z_vn = z_v / (cos² β_b cos β_m)**

Virtual ratio u_v = z_v2 / z_v1. For Σ = 90°: cos δ1 = u/√(1+u²), cos δ2 = 1/√(1+u²) → **u_v = u²**.

Contact ratios are computed on the virtual pair: tip diameters d_va = d_v + 2 h_am, base diameters d_vb = d_v cos α_t,
centre distance a_v = (d_v1 + d_v2)/2,

  ε_vα = [½(√(d_va1² − d_vb1²) + √(d_va2² − d_vb2²)) − a_v sin α_t] / (π m_mt cos α_t) ,  ε_vβ = b sin β_m / (π m_mn)

**In the program** (`geometry()`, third part):
```python
# crown to apex (along the axis) and back cone
xa1 = Re * math.cos(d1) - hae1 * math.sin(d1)
xa2 = Re * math.cos(d2) - hae2 * math.sin(d2)
# virtual cylindrical gears (Tredgold, mean section); spiral -> virtual helical, then virtual spur in the normal section
dv1, dv2 = dm1 / math.cos(d1), dm2 / math.cos(d2)
zv1, zv2 = z1 / math.cos(d1), z2 / math.cos(d2)
at = math.atan(math.tan(an) / math.cos(bm))
bb = math.asin(math.sin(bm) * math.cos(an))
zvn1 = zv1 / (math.cos(bb) ** 2 * math.cos(bm))
zvn2 = zv2 / (math.cos(bb) ** 2 * math.cos(bm))
uv = zv2 / zv1
dva1, dva2 = dv1 + 2 * ham1, dv2 + 2 * ham2
dvb1, dvb2 = dv1 * math.cos(at), dv2 * math.cos(at)
av = (dv1 + dv2) / 2
ga = 0.5 * (math.sqrt(dva1 ** 2 - dvb1 ** 2) + math.sqrt(dva2 ** 2 - dvb2 ** 2)) - av * math.sin(at)
eva = ga / (math.pi * mmt * math.cos(at))
evb = b * math.sin(bm) / (math.pi * mmn) if bm > 0 else 0.0
```

**Run it:** `python bevel.py examples`
```
- virtual gears: zv 18.28 / 116.96, zvn 31.45 / 201.24, uv 6.398; contact ratios eps_va 1.225, eps_vb 1.537, total 2.761
```
**Interpretation.** The 17-tooth pinion "behaves like" an 18.3-tooth spur gear in the transverse section and like a
31.5-tooth gear in the normal section – this is why spiral bevel pinions with few teeth have no undercut. u_v = 6.398 =
2.529². The transverse contact ratio is only 1.225 (short teeth at a small virtual pinion), but the overlap ratio 1.537
makes the total 2.761 – the spiral is what makes these gears quiet. The straight version of the same pair has
ε_vα 1.588 and no overlap (examples output: "eps_va 1.588").

**MATLAB equivalent (geometry core)**
```matlab
z1=17; z2=43; S=pi/2; met=3; b=18; bm=deg2rad(35); an=deg2rad(20);
u=z2/z1; d1=atan(sin(S)/(cos(S)+u)); d2=S-d1;
de1=met*z1; Re=de1/(2*sin(d1)); Rm=Re-b/2; mmt=met*Rm/Re; mmn=mmt*cos(bm);
dm1=mmt*z1; dm2=mmt*z2; zv1=z1/cos(d1); zv2=z2/cos(d2);
at=atan(tan(an)/cos(bm)); bb=asin(sin(bm)*cos(an)); zvn1=zv1/(cos(bb)^2*cos(bm));
fprintf('delta1 %.4f  Re %.3f  zv1 %.2f  zvn1 %.2f\n', rad2deg(d1), Re, zv1, zvn1)   % 21.5713 69.358 18.28 31.45
```

### 3.6 Blank drawing data

The gear cutter receives a **turned blank**. Its dimensions come from 3.4. Tolerances below are typical company values
(check with the cutting-machine maker, ISO 23509 and your drawing standard).

**Run it:** `python bevel.py ch24`
```
  pinion: dae 57.223 (h8 / -0.05 mm (typ.)), face angle 24.774 deg (+/-8 arcmin (typ.)), back angle 68.429 deg (+/-15 arcmin (typ.)), root angle 19.702 deg, crown to apex 63.270 mm (+/-0.025 mm (typ.))
  wheel : dae 130.271 (h8 / -0.05 mm (typ.)), face angle 70.298 deg (+/-8 arcmin (typ.)), back angle 21.571 deg (+/-15 arcmin (typ.)), root angle 65.226 deg, crown to apex 23.892 mm (+/-0.025 mm (typ.))
```

| Dimension | Pinion | Wheel | Typical tolerance (check) | How it is measured |
|---|---|---|---|---|
| Outside diameter d_ae | 57.223 mm | 130.271 mm | h8 / −0.05 mm | micrometer / CMM |
| Face angle δ_a | 24.774° | 70.298° | ± 8′ | sine bar, CMM |
| Back angle (90° − δ) | 68.429° | 21.571° | ± 15′ | protractor, CMM |
| Crown to apex | 63.270 mm | 23.892 mm | ± 0.025 mm | height gauge from the back face + calculated apex |
| Face width b | 18 mm | 18 mm | ± 0.1 mm | caliper |

The **crown-to-apex** dimension is the most important: an error here shifts the tooth along the cone and changes the
tooth depth the cutter produces. The back face (mounting face) must be square to the bore (runout ≤ 0.01–0.02 mm,
check) because it is the locating face on the cutting machine and in the gearbox.

### 3.7 Other shaft angles

**Run it:** `python bevel.py ch24`
```
  Sigma  60.0: delta 15.954 / 44.046 deg, Re 92.774 mm, zv 17.68 / 59.82, uv 3.383, b/Re 0.194
  Sigma  90.0: delta 21.571 / 68.429 deg, Re 69.358 mm, zv 18.28 / 116.96, uv 6.398, b/Re 0.260
  Sigma 120.0: delta 23.110 / 96.890 deg, Re 64.969 mm, zv 18.48 / -358.43, uv -19.392, b/Re 0.277
```
**Interpretation.**
- Σ = 60°: both pitch angles are small, R_e grows to 92.8 mm – the same teeth give a larger, slimmer pair.
- Σ = 120°: δ2 = 96.9° > 90°. The wheel pitch cone "turns inside out": it is an **internal bevel gear** (the virtual
  numbers z_v2 and u_v become negative). When δ2 = 90° exactly the wheel is a **crown gear**. Internal bevel gears are
  rare and need special tools; choose a different ratio or shaft angle if possible. The program flags this through the
  negative z_v2 – do not use the strength results in that case.

**Check questions 3**
1. Derive tan δ1 = sin Σ/(cos Σ + u). What is δ1 for z 20/40 at Σ = 90°?
2. Why is the strength calculated with m_mn and not with m_et?
3. Why does the spiral bevel pinion with 17 teeth have no undercut, although a 17-tooth spur gear would be at the limit?
4. Which blank dimension shifts the tooth depth, and why must the back face be square to the bore?

---

## 4 Forces and the bearing hand-over

### 4.1 Force components in vector form

**Theory.** The tooth normal force F_n acts at the mean point, normal to the tooth surface. Split it in three steps:
1. In the **normal section** of the tooth: a part along the pitch line normal and a part F_n sin α_n towards the gear
   axis (pressure angle).
2. In the **pitch plane**: the part F_n cos α_n is turned by the spiral angle β_m. Its component in the circumferential
   direction is the tangential force F_t = F_n cos α_n cos β_m; the rest, F_t tan β_m, lies along the cone element.
3. Project the two in-plane parts that are not tangential (F_t tan α_n / cos β_m perpendicular to the element in the
   axial plane, and F_t tan β_m along the element) onto the **gear axis** and the **radial direction** using the pitch
   angle δ.

Result for the driving pinion (s = ±1 depends on hand and rotation, 4.2):

  **F_t = 2 T1 / d_m1**
  **F_a1 = F_t / cos β_m · (tan α_n sin δ1 + s sin β_m cos δ1)**
  **F_r1 = F_t / cos β_m · (tan α_n cos δ1 − s sin β_m sin δ1)**

Wheel: same with δ2 and −s. Straight bevel (β_m = 0): F_a = F_t tan α_n sin δ, F_r = F_t tan α_n cos δ.
Check: the three components are projections of F_n, so √(F_t² + F_a² + F_r²) = F_t / (cos α_n cos β_m).

**In the program** (`forces()`):
```python
T1 = P["P_kW"] * 1000 / (P["n1_rpm"] * 2 * math.pi / 60)
Ft = 2 * T1 * 1000 / g["dm1"]
an, bm, d1 = math.radians(P["alpha_n_deg"]), math.radians(P["beta_m_deg"]), g["delta1"]
if P["kind"] == "straight" or bm == 0:
    s = 0
else:
    s = 1 if (P["hand1"] == "left") == (P["rotation1"] == "cw") else -1
Fa1 = Ft / math.cos(bm) * (math.tan(an) * math.sin(d1) + s * math.sin(bm) * math.cos(d1))
Fr1 = Ft / math.cos(bm) * (math.tan(an) * math.cos(d1) - s * math.sin(bm) * math.sin(d1))
d2 = g["delta2"]
Fa2 = Ft / math.cos(bm) * (math.tan(an) * math.sin(d2) - s * math.sin(bm) * math.cos(d2))
Fr2 = Ft / math.cos(bm) * (math.tan(an) * math.cos(d2) + s * math.sin(bm) * math.sin(d2))
```

**Run it:** `python bevel.py examples` and `python bevel.py ch24`
```
- T1 49.39 N m, T2 124.94 N m; Ft 2226 N; pinion Fa 1813 N, Fr 347 N; wheel Fa 347 N, Fr 1813 N; v 3.37 m/s (s = +1)
  normal force from components 2891.59 N = Ft/(cos an cos bm) 2891.59 N
```
**Interpretation.** At 7.5 kW the axial force on the pinion (1813 N) is **81 % of the tangential force** – much larger
than for a helical gear with the same angle, because the pressure-angle part and the spiral part add up. The torque check
F_t d_m1/2 = 2226 × 44.382/2 = 49.39 N·m = T1 is in the self-test.

### 4.2 Hand of spiral and direction of rotation

**Run it:** `python bevel.py ch24`
```
  left  cw  s +1: Fa1 +1813.0, Fr1  +346.7, Fa2  +346.7, Fr2 +1813.0 N
  left  ccw s -1: Fa1 -1085.8, Fr1 +1492.7, Fa2 +1492.7, Fr2 -1085.8 N
  right cw  s -1: Fa1 -1085.8, Fr1 +1492.7, Fa2 +1492.7, Fr2 -1085.8 N
  right ccw s +1: Fa1 +1813.0, Fr1  +346.7, Fa2  +346.7, Fr2 +1813.0 N
  normal force from components 2891.59 N = Ft/(cos an cos bm) 2891.59 N
```

| Pinion hand | Rotation (seen from the back) | s | F_a1 | Effect |
|---|---|---|---|---|
| left | cw | +1 | +1813 N (away from apex) | mesh **opens**, pinion pushed out of mesh – preferred |
| left | ccw | −1 | −1086 N (towards apex) | pinion **pulled into mesh** – backlash can disappear, jamming / scuffing risk |
| right | cw | −1 | −1086 N (towards apex) | pulled into mesh |
| right | ccw | +1 | +1813 N (away from apex) | preferred |

**Rule used by designers:** choose the hand of spiral so that, in the **main driving direction**, both members are pushed
**away from the apex** (out of mesh). A gear pushed into mesh loses backlash under load and with bearing play or thermal
growth it can wedge. When the drive reverses (conveyors, AGVs), the axial force changes sign – the bearings must take
both directions and the pinion must be axially fixed without play.

Note: for s = +1 the radial force is small (347 N) and for s = −1 it is large (1493 N); the bearings see very different
loads for the two directions.

### 4.3 Σ = 90°: axial and radial forces exchange

For Σ = 90° the pinion axis is parallel to the wheel's radial direction: **F_a2 = F_r1, F_r2 = F_a1** (self-test). The
wheel's radial force (1813 N) is therefore the large pinion axial force.

### 4.4 Hand-over to the shaft (M3) and the bearings (M4): overhung pinion

Small right-angle drives mount the pinion **overhung**: two bearings behind the pinion. Model (example): mesh point at
x = 0 (mean radius d_m1/2), bearing A at x = 35 mm, bearing B at x = 95 mm (spread 60 mm), shaft Ø30.

**Theory.** In the radial (y) plane act F_r1 and the **moment of the axial force** M = F_a1 · d_m1/2 (the axial force
acts at the pitch radius, not on the axis). In the tangential (z) plane acts F_t. Moments about B give R_A, then ΣF
gives R_B. The axial force goes to one of the two tapered bearings (O arrangement, induced forces F_ad = 0.5 F_r / Y).

**Run it:** `python bevel.py ch24`
```
  M from Fa = 40232 N mm; RA 3526.3 N, RB 1380.3 N; axial 1813.0 N
  cross-check RA_y without moment: shaft.reactions 548.955 N = analytic 548.955 N
  30206 A: Fr 3526 N, Fa 1102 N -> P 3526 N, L10h 38328 h, L_nm 81364 h (kappa 1.12)
  30206 B: Fr 1380 N, Fa 2915 N -> P 5216 N, L10h 10394 h, L_nm 13237 h (kappa 1.12)
  deflection at the mesh point: overhung 10.5 um, straddle 1.2 um (ratio 8.6)
```
**Interpretation.**
- The moment of the axial force (40 232 N·mm) and the lever of the overhang make the near bearing A carry **3526 N** –
  1.6 times F_t. Overhung pinions always load the near bearing heavily.
- Cross-check: without the moment, `shaft.reactions()` (M3) and the analytic formula give the same R_Ay (548.955 N).
- **Finding:** bearing B takes the external axial force (plus the induced force of A): F_a 2915 N → P 5216 N → L_nm only
  **13 237 h < 20 000 h**. Options: a larger bearing at B (30207 or 32206 – check catalogue), mount the pair so that A
  (with the high radial load but more margin) takes the axial force, or choose the other spiral hand only if the
  pull-in-mesh risk of 4.2 is acceptable. This is an example arrangement – **check** the real bearing positions and the
  axial-force path on your drawing.
- **Stiffness:** the mesh point of the overhung pinion deflects **10.5 µm**, the same pinion straddle-mounted (bearings on
  both sides, same spread) only **1.2 µm** (ratio 8.6). Bevel gears are very sensitive to deflection: the contact pattern
  moves towards heel or toe. Rule (check): for heavy loads or large ratios **straddle-mount the pinion**; for overhung
  pinions keep the overhang short and the bearing spread ≥ 2 × overhang (here 60/35 = 1.7 – small).

**MATLAB equivalent (forces)**
```matlab
P=7.5e3; n1=1450; T1=P/(n1*2*pi/60); dm1=44.382; d1=deg2rad(21.5713); an=deg2rad(20); bm=deg2rad(35); s=+1;
Ft=2*T1*1000/dm1;
Fa1=Ft/cos(bm)*(tan(an)*sin(d1)+s*sin(bm)*cos(d1));
Fr1=Ft/cos(bm)*(tan(an)*cos(d1)-s*sin(bm)*sin(d1));
fprintf('Ft %.0f  Fa1 %.0f  Fr1 %.0f N\n',Ft,Fa1,Fr1)    % 2226 1813 347
```

### 4.5 Practice

- Put the **spiral hand, rotation direction and mounting distance** on the drawing of both gears and on the gearbox
  assembly drawing.
- Set the axial position at assembly with **shims** under the bearing cup / spacer until the contact pattern (marking
  compound, light load) lies in the middle of the flank, slightly towards the toe (it moves to the heel under load –
  check with the gear supplier's pattern sheet).
- Tapered roller bearings must be **preloaded** or set with very small play – axial play shifts the pinion and the
  pattern.
- For reversing drives check both directions of rotation: the axial force sign and the bearing loads change.

**Check questions 4**
1. Why is the pinion axial force of a spiral bevel larger than that of a helical gear with the same angle?
2. Which combination of hand and rotation would you choose for a conveyor that runs mainly in one direction, and why?
3. In the overhung example, why does bearing A carry more than F_t, and what would you change first to raise the life of
   bearing B?
4. Why does a 10 µm deflection matter more for a bevel pair than for a spur pair?


---

## 5 Load capacity in the style of ISO 10300

> Program: `capacity()` in `tools/bevel.py` (uses the M5 code in `tools/gear.py` on the virtual cylindrical pair) and the
> study functions of this chapter (`python bevel.py ch56`). Default input: spiral bevel z 17/43, m_et 3, b 18 mm,
> β_m 35°, 7.5 kW at 1450 rpm, 18CrNiMo7-6 case hardened, lapped. **All inputs are example values.** ISO 10300 is
> implemented in a simplified form – every factor marked "check" must be compared with ISO 10300-1/-2/-3 (2014).

### 5.1 Why bevel gears are rated through a virtual cylindrical gear

**Theory.** A bevel tooth is a cone. Its size changes along the face width: big at the heel (outer end), small at the
toe (inner end). The contact line is not straight and not parallel to the axis. A direct 3D stress solution needs FEA or the
"loaded tooth contact analysis" software of the gear-cutting machine makers.

ISO 10300 avoids this with the **Tredgold approximation**: at the mean point of the face width, the bevel tooth looks
almost exactly like a tooth of a **cylindrical gear** whose pitch radius is the length of the back cone generator. This
cylindrical gear is the **virtual cylindrical gear**. For a spiral bevel gear it is a virtual **helical** gear with helix angle
β_m. All the cylindrical-gear formulas of M5 (Hertz pressure, form factor, load factors) can then be used, plus a few bevel
correction factors.

**Derivation of the virtual gear (mean section).**
1. The back cone at the mean point is perpendicular to the pitch cone. Its generator (from the pitch point to the axis) has
   length r_m / cos δ, where r_m = d_m/2 is the mean pitch radius and δ the pitch angle.
2. A tooth profile drawn on this back cone and unrolled into a plane is the profile of a cylindrical gear with radius
   r_v = r_m / cos δ.
3. Same pitch (same module m_mt) on both → number of teeth z_v = d_v / m_mt = z / cos δ.
4. For Σ = 90°: tan δ1 = z1/z2, so cos δ1 = z2/√(z1² + z2²), cos δ2 = z1/√(z1² + z2²) and
   u_v = z_v2 / z_v1 = (z2/cos δ2)/(z1/cos δ1) = u².

**Formula box – virtual cylindrical gears (mean section)**

| Quantity | Formula | Default (pinion / wheel) |
|---|---|---|
| Virtual pitch diameter | d_v = d_m / cos δ | 47.725 / – mm |
| Virtual number of teeth | z_v = z / cos δ | 18.28 / 116.96 |
| Virtual normal teeth (spiral) | z_vn = z_v / (cos² β_b cos β_m) | 31.45 / 201.24 |
| Virtual ratio | u_v = z_v2 / z_v1 (= u² for Σ 90°) | 6.398 |
| Effective face width | b_eff ≈ 0.85 b (contact pattern, check ISO 10300-1) | 15.30 mm |

The large virtual ratio (6.4 instead of 2.53) means: the wheel flank is "almost flat" for the pinion. This gives a lower Hertz
pressure than a cylindrical pair with the same pitch diameters.

### 5.2 Structure of ISO 10300 and the methods

| Part | Content | Method used here |
|---|---|---|
| ISO 10300-1 | Introduction, general influence factors K_A, K_V, K_Hβ, K_Hα, geometry of the virtual gears | Simplified: K_V by the M5 method-C-style formula, K_Hβ = 1.5 K_Hβ-be, K_Hα = 1 |
| ISO 10300-2 | Surface durability (pitting) | Method B2 style through the virtual helical gear, with Z_K |
| ISO 10300-3 | Tooth root strength | Virtual form factors by the M5 method B code (ISO 6336-3 method), Y_β |

ISO 10300 has method **B1** (virtual gear with load sharing along the real contact lines, close to the Klingelnberg
approach) and method **B2** (based on the AGMA/Gleason approach with geometry factors from the machine summary). Method
**C** is a simplified version. This program follows the B2/C idea: virtual helical gear + bevel factor. For a design
release, compute with the standard (or with the gear maker's software) – see chapter 7.

**The general equations (what `capacity()` computes)**

  σ_H = Z_H · Z_E · Z_ε · Z_β · Z_K · √( F_mt/(d_v1 · b_eff) · (u_v + 1)/u_v ) · √( K_A K_V K_Hβ K_Hα )

  σ_F = F_mt/(b_eff · m_mn) · Y_F · Y_S · Y_β · K_A · K_V · K_Fβ

  S_H = σ_HP / σ_H ,  S_F = σ_FE / σ_F

F_mt is the tangential force at the mean diameter d_m1 (chapter 4): F_mt = 2 T1 / d_m1.

**In the program**
```python
def capacity(P):
    """ISO 10300 style through the virtual cylindrical gear pair at the mean section (simplified):
    sigma_H = Z_H Z_E Z_eps Z_beta Z_K sqrt(Ft/(dv1 b_eff) (uv + 1)/uv) sqrt(K_A K_V K_Hbeta K_Halpha), K_Hbeta = 1.5 K_Hbeta-be,
    b_eff = 0.85 b (typical contact length); root: sigma_F = Ft/(b_eff m_mn) Y_F Y_S Y_beta K_A K_V K_Fbeta (form factors of the
    virtual gears by the M5 method B code)."""
    g = geometry(P)
    F = forces(P, g)
    m1, m2 = gear.MATERIALS[P["material1"]], gear.MATERIALS[P["material2"]]
    beff = 0.85 * P["b"]
    KHb = 1.5 * P["KHbeta_be"]
    # equivalent cylindrical (virtual) pair for the M5 helper functions
    V = dict(gear.DEFAULT, mn=g["mmn"], z1=g["zv1"], z2=g["zv2"], beta_deg=P["beta_m_deg"], alpha_n_deg=P["alpha_n_deg"],
             x1=g["x1"], x2=g["x2"], b=beff, haP=P["haP"], hfP=P["hfP"], n1_rpm=P["n1_rpm"], KA=P["KA"],
             KHbeta=KHb, accuracy_grade=P["accuracy_grade"], material1=P["material1"], material2=P["material2"])
    gv = gear.geometry(V)
    Fv = {"Ft": F["Ft"], "v": F["v"]}
    KV = gear.KV_factor(V, gv, Fv)
    h = (P["haP"] + P["hfP"]) * g["mmn"]
    KFb = gear.KFbeta(KHb, beff, h)
    zh = math.sqrt(2 * math.cos(g["beta_b"]) / (math.cos(g["alpha_t"]) ** 2 * math.tan(g["alpha_t"])) )
    ze = gear.ZE(m1, m2)
    zeps = gear.Zeps(g["eps_va"], g["eps_vb"])
    zb = gear.Zbeta(P["beta_m_deg"])
    sH0 = zh * ze * zeps * zb * P["ZK"] * math.sqrt(F["Ft"] / (g["dv1"] * beff) * (g["uv"] + 1) / g["uv"])
    KH = P["KA"] * KV * KHb
```

The rest of the function computes the two root stresses and the safeties:
```python
    sH = sH0 * math.sqrt(KH)
    Yb = gear.Ybeta(g["eps_vb"], P["beta_m_deg"])
    res = {"g": g, "F": F, "V": V, "KV": KV, "KHbeta": KHb, "KFbeta": KFb, "ZH": zh, "ZE": ze, "Zeps": zeps, "Zbeta": zb,
           "sH0": sH0, "sH": sH, "Ybeta": Yb, "b_eff": beff}
    for i, m in ((1, m1), (2, m2)):
        ff = gear.form_factor_B(V, gv, i)
        sF = F["Ft"] / (beff * g["mmn"]) * ff["YF"] * ff["YS"] * Yb * P["KA"] * KV * KFb
        sHP = m["sHlim"] * P["ZLVR"]
        sFE = 2 * m["sFlim"]
        res["gear%d" % i] = {"ff": ff, "sF": sF, "SF": sFE / sF, "SH": sHP / sH, "ok": sHP / sH >= P["SHmin"] and sFE / sF >= P["SFmin"]}
    return res
```

**Run it:** `python bevel.py examples` (section "Load capacity")
```
## Load capacity (ISO 10300 style via virtual gears, simplified)
- K_A 1.25, K_V 1.085, K_Hbeta 1.875 (1.5 x 1.25), K_Fbeta 1.560; Z_H 2.131, Z_E 189.8, Z_eps 0.904, Z_beta 1.105, Z_K 0.85
- sigma_H 1028 MPa; b_eff 15.3 mm
- gear 1: Y_F 1.033, Y_S 2.361 -> sigma_F 263 MPa, S_F 3.80; S_H 1.39; OK
- gear 2: Y_F 1.229, Y_S 2.176 -> sigma_F 289 MPa, S_F 3.46; S_H 1.39; OK
```
**All factors at once** (new function `factor_breakdown()`): `python bevel.py ch56`, first block
```
== 5.2 factor breakdown (default 7.5 kW)
  Ft 2225.8 N, dv1 47.725 mm, uv 6.398, b_eff 15.30 mm
  K_A 1.25 K_V 1.0853 K_Hbeta 1.8750 K_Fbeta 1.5601
  Z_H 2.1307 Z_E 189.81 Z_eps 0.9036 Z_beta 1.1049 Z_K 0.85
  sigma_H0 644.4 MPa, sigma_H 1027.7 MPa, sigma_HP 1425.0 MPa -> S_H 1.387
  Y_beta 0.7500; pinion Y_F 1.033 Y_S 2.361 sigma_F 263.2 S_F 3.799; wheel Y_F 1.229 Y_S 2.176 sigma_F 288.8 S_F 3.463
```

**Interpretation.** σ_H = 1028 MPa against σ_HP = 1500 · 0.95 = 1425 MPa (lapped flanks, Z_LVR 0.95) → S_H = 1.39. The root
stresses are 263 / 289 MPa against σ_FE = 2 · 500 = 1000 MPa → S_F = 3.80 / 3.46. As for the cylindrical stage of M5,
**pitting decides**; the root has a big margin. The biggest single factor is K_Hβ = 1.875 – the mounting of bevel gears
(chapter 5.4) matters more than for cylindrical gears.

### 5.3 Application and dynamic factor K_A, K_V

**K_A** describes the external overloads (driving and driven machine). Same table as in M5 chapter 5 (electric motor +
conveyor with moderate shocks: 1.25). **K_V** describes internal dynamic loads from pitch and profile errors. The program
uses the M5 formula (method-C style) on the virtual pair:

  K_V = 1 + (K1 / (K_A F_t / b) + K2) · z1 · v/100 · √(u²/(1 + u²))

with z1 and u of the **virtual** pair, accuracy grade 7 (lapped spiral bevel gears typically reach grade 6–8 in ISO 17485
terms – check). Result: K_V = 1.085 at v = 3.37 m/s – small, because the mean circumferential speed is low.

**Practice.** For bevel gears above about 10 m/s, use ground or hard-skived flanks and compute K_V with method B of ISO 10300-1
(resonance speed of the pair). Lapped gears are matched pairs: they must be assembled and replaced as a set.

### 5.4 Face load factor K_Hβ = 1.5 · K_Hβ-be and the mounting conditions

**Theory.** A bevel gear pair does not carry load over the full face width. The contact pattern is deliberately shorter
than the tooth (crowning, chapter 6) so that it does not run to the heel or toe edge when the shafts deflect. ISO 10300
takes this into account with a large basic face load factor:

  K_Hβ = 1.5 · K_Hβ-be  (contact pattern ≈ 85 % of the face width; check ISO 10300-1 for other pattern lengths)

K_Hβ-be is the **mounting factor**. It depends on how the two members are supported:

| Mounting (typical, check ISO 10300-1 table) | K_Hβ-be | K_Hβ |
|---|---|---|
| Both members straddle mounted (bearings on both sides of the gear) | 1.00 | 1.50 |
| One member straddle, one cantilever (overhung) | 1.10 | 1.65 |
| Both members cantilever | 1.25 | 1.875 |

**Root:** K_Fβ = K_Hβ^N_F with the exponent N_F of M5 (`gear.KFbeta()`), here K_Fβ = 1.560 (in ISO 10300-3 a lengthwise
curvature factor modifies this for spiral bevel gears – check; not included).

**Run it** – new function `mounting_study()`, block "5.10":
```
== 5.10 mounting factor study
  both members straddle mounted          K_Hbeta-be 1.00 -> K_Hbeta 1.500  S_H 1.55  S_F1 4.45
  one member straddle, one cantilever    K_Hbeta-be 1.10 -> K_Hbeta 1.650  S_H 1.48  S_F1 4.16
  both members cantilever (overhung)     K_Hbeta-be 1.25 -> K_Hbeta 1.875  S_H 1.39  S_F1 3.80
```
**Interpretation.** Changing from an overhung pinion and gear (the default, typical of a compact right-angle drive) to
straddle mounting raises S_H from 1.39 to 1.55 and S_F1 from 3.80 to 4.45 – without changing the gears. In the
compressor factory, the conveyor right-angle drives usually have an overhung pinion; the wheel can often be straddle
mounted. **Design rule:** straddle-mount the member that carries the larger bending moment, keep the overhang short, use
stiff bearing pairs (tapered rollers in O arrangement for the pinion, M4 chapter 3).

```python
def mounting_study(P):
    out = []
    for name, k in MOUNTING_KHBE.items():
        R = capacity(dict(P, KHbeta_be=k))
        out.append({"mounting": name, "KHbe": k, "KHbeta": R["KHbeta"], "SH": R["gear1"]["SH"], "SF1": R["gear1"]["SF"]})
    return out
```

### 5.5 Pitting factors Z_H, Z_E, Z_ε, Z_β, Z_K

**Zone factor Z_H** converts the tangential force at the pitch circle into the normal force and the curvature radii at the pitch
point. For the virtual gear (sum of profile shifts zero → working pressure angle = α_t):

  Z_H = √( 2 cos β_b / (cos² α_t · tan α_t) )

Derivation (same as M5 chapter 5): Hertz line contact p = √(F_n E′ /(2π b ρ_red)); normal force F_n = F_t/(cos α_t cos β_b);
radii at the pitch point ρ = (d_v/2) sin α_t; collecting all geometry terms gives Z_H, the material terms give Z_E. With
α_t = 23.96° (β_m 35°) and β_b = 32.6°: **Z_H = 2.131** (spur cylindrical gears: ≈ 2.49).

**Elasticity factor** Z_E = 189.8 √MPa (steel/steel, E = 206 000 MPa, ν = 0.3) – `gear.ZE()`.

**Contact ratio factor** Z_ε from the virtual contact ratios ε_vα = 1.225, ε_vβ = 1.537 (> 1 → Z_ε = √(1/ε_vα)) = 0.904.

**Helix angle factor** Z_β = 1/√(cos β_m) = 1.105 (as in ISO 6336 2019 – check: some editions of ISO 10300-2 use
√(cos β_m)).

**Bevel gear factor Z_K = 0.85** (check ISO 10300-2). It is an empirical factor: tests show that bevel gears carry more
than the virtual cylindrical gear predicts (favourable load sharing along the curved contact lines, the oblique contact in
spiral gears). The program reads it from the input `"ZK"`.

**Permissible contact stress**

  σ_HP = σ_Hlim · Z_NT · Z_L · Z_V · Z_R · Z_W · Z_X / S_Hmin

The program uses σ_Hlim · Z_LVR (Z_NT = Z_W = Z_X = 1, long life, equal hardness). Z_LVR = 0.95 for **lapped** flanks,
≈ 1.0 for **ground** or hard-skived flanks (example values – check ISO 10300-2 / ISO 6336-2). The life factors Z_NT, Y_NT
and their effect for 20 000 h are explained in M5 chapter 5 (functions `ZNT()`, `YNT()` in `gear.py`); for bevel gears
apply them the same way.

### 5.6 Tooth root: virtual form factors

**Theory.** The tooth root stress is computed at the mean section in the **normal** plane of the virtual helical gear (normal
module m_mn, virtual normal teeth z_vn). The form factor Y_F (lever arm h_Fe, critical section s_Fn at the 30° tangent) and
the stress correction factor Y_S are exactly the ISO 6336-3 method B quantities of M5 chapter 5. The program builds the
virtual pair `V` (z_v1, z_v2, m_mn, β_m, x1, x2, b_eff) and calls `gear.form_factor_B(V, gv, i)`.

  σ_F = F_mt/(b_eff · m_mn) · Y_F · Y_S · Y_β · K_A K_V K_Fβ , Y_β = 1 − ε_β* β*/120 (here ε_vβ > 1, β 35° → β* 30° → Y_β = 0.75)

**Values (default):** pinion Y_F 1.033, Y_S 2.361; wheel Y_F 1.229, Y_S 2.176. The pinion has the large positive addendum
modification x1 = +0.329 (Gleason-style, chapter 3) → thick root, small Y_F. The wheel (x2 = −0.329) has the thinner root.
That is why S_F(wheel) 3.46 < S_F(pinion) 3.80 – the opposite of most cylindrical pairs. The addendum modification balances
the pinion's **sliding** and **strength**; with very small pinions (z1 < 12) a tooth thickness modification (x_s, "thickness
factor") is added in practice – not included.

**Permissible root stress:** σ_FE = σ_Flim · Y_ST = 500 · 2 = 1000 MPa (Y_NT = Y_δ = Y_R = Y_X = 1 – check).

**Practice.** Bevel gear roots are very sensitive to the **root fillet radius** made by the cutter blade edge radius
(ρ_fP ≈ 0.2–0.3 m; here 0.38 m of the cylindrical basic rack is assumed – check with the cutter summary) and to **grinding
notches** after hardening. Root fractures in bevel gears usually start at the toe end when the pattern runs off (chapter 6).

### 5.7 Straight versus spiral at the same size

**Run it:** `python bevel.py examples`, section "Straight bevel version":
```
## Straight bevel version (same size, beta_m 0)
  eps_va 1.588, Ft 2226, Fa1 298, Fr1 753 N, sigma_H 1089 MPa, S_H 1.31, S_F 3.28 / 3.02
```
At the same size (z, m_et, b), the straight bevel has σ_H = 1089 MPa (S_H 1.31) and S_F 3.28 / 3.02. The spiral version is
stronger (S_H 1.39, S_F 3.80 / 3.46), mainly because the overlap ratio ε_vβ = 1.54 gives more teeth in contact
(smoother, quieter, Y_β < 1). The price: a much larger **axial force** (1813 N instead of 298 N on the pinion) and the
need for special cutting machines.

### 5.8 Study: spiral angle 0 … 40°

New function `spiral_study()`:
```python
def spiral_study(P, betas=(0, 10, 20, 30, 35, 40)):
    """Same size (met, b, z) with different mean spiral angles: S_H, S_F, contact ratios, pinion axial force."""
    out = []
    for b in betas:
        Q = dict(P, beta_m_deg=float(b), kind="straight" if b == 0 else "spiral")
        R = capacity(Q)
        out.append({"beta": b, "eva": R["g"]["eps_va"], "evb": R["g"]["eps_vb"], "SH": R["gear1"]["SH"],
                    "SF1": R["gear1"]["SF"], "SF2": R["gear2"]["SF"], "Fa1": R["F"]["Fa1"], "Fr1": R["F"]["Fr1"]})
    return out
```

**Run it:** block "5.8" of `python bevel.py ch56`
```
== 5.8 spiral angle study (same met 3, b 18, z 17/43)
  beta  0: eps_va 1.588 eps_vb 0.000  S_H 1.31  S_F 3.28 / 3.02  Fa1  +298 N  Fr1  +753 N
  beta 10: eps_va 1.574 eps_vb 0.387  S_H 1.38  S_F 3.40 / 3.16  Fa1  +667 N  Fr1  +621 N
  beta 20: eps_va 1.477 eps_vb 0.799  S_H 1.43  S_F 3.67 / 3.39  Fa1 +1070 N  Fr1  +504 N
  beta 30: eps_va 1.321 eps_vb 1.267  S_H 1.42  S_F 3.98 / 3.64  Fa1 +1539 N  Fr1  +397 N
  beta 35: eps_va 1.225 eps_vb 1.537  S_H 1.39  S_F 3.80 / 3.46  Fa1 +1813 N  Fr1  +347 N
  beta 40: eps_va 1.118 eps_vb 1.842  S_H 1.35  S_F 3.57 / 3.25  Fa1 +2126 N  Fr1  +297 N
```
**Interpretation.**
- ε_vα falls (1.59 → 1.12) and ε_vβ rises (0 → 1.84) with β_m. Below ε_vα ≈ 1.1 the profile contact gets weak (tip/root
  edge contact) – 40° is near the practical limit for this tooth number.
- S_H has a flat maximum near 20–30°; S_F has its maximum near 30°. The industrial standard **β_m = 35°** is a compromise
  that favours smooth running (ε_vβ ≥ 1.25 → quiet) at a small loss of strength.
- The pinion **axial force** rises from 298 N (straight) to 2126 N (40°) – 7 ×. It decides the pinion bearings (tapered roller
  pair, M4) and the direction rule of chapter 4: choose hand and rotation so that the pinion is pushed **out of mesh**
  (away from the apex) in the main driving direction; then a load peak opens the backlash instead of jamming the teeth.
- β_m = 0 with curved teeth ("zerol") has the axial force of a straight bevel but the better contact of a curved tooth.

### 5.9 Study: module and face width at constant ratio

New function `size_study()` (face width kept at b = 0.26 R_e):
```python
def size_study(P, mets=(2.5, 3.0, 3.5, 4.0), b_over_Re=0.26):
    """Constant ratio z1/z2, outer module varied, face width kept at b = b_over_Re * Re."""
    out = []
    for m in mets:
        g0 = geometry(dict(P, met=m))
        b = round(b_over_Re * g0["Re"], 1)
        R = capacity(dict(P, met=m, b=b))
        out.append({"met": m, "b": b, "Re": g0["Re"], "SH": R["gear1"]["SH"], "SF1": R["gear1"]["SF"],
                    "SF2": R["gear2"]["SF"], "de2": g0["de2"]})
    return out
```

```
== 5.9 size study (b = 0.26 Re)
  met 2.5: b 15.0 mm, Re 57.8, de2 108 mm  S_H 1.07  S_F 2.27 / 2.07
  met 3.0: b 18.0 mm, Re 69.4, de2 129 mm  S_H 1.39  S_F 3.80 / 3.46
  met 3.5: b 21.0 mm, Re 80.9, de2 150 mm  S_H 1.71  S_F 5.78 / 5.27
  met 4.0: b 24.0 mm, Re 92.5, de2 172 mm  S_H 2.03  S_F 8.17 / 7.44
```
**Interpretation.** S_H grows roughly linearly with the module (∝ m^1, because σ_H ∝ 1/√(d b) ∝ 1/m) and S_F roughly with m²
(σ_F ∝ 1/(b m) ∝ 1/m²). From m_et 3 to 2.5 the wheel diameter falls from 129 to 108 mm and S_H to 1.07 – not enough margin
for a design with K_A 1.25 and unknown mounting deflections. **Rules for the face width:** b ≤ R_e/3 and b ≤ 10 m_et
(checked by `geometry()`); a wider face does not help, because the toe becomes too small to be cut and the pattern
cannot cover it.

### 5.10 Mounting factor effect

See 5.4 (block "5.10"). Summary: K_Hβ-be from 1.25 to 1.00 is worth +12 % S_H – the cheapest strength gain.

### 5.11 Maximum transmissible power

New function `max_power()` (bisection on P, each limit separately):
```python
def max_power(P, SH_req=1.0, SF_req=1.4):
    """Bisection on P_kW: largest power with S_H >= SH_req (pitting) and S_F >= SF_req (root), each limit separately."""
    def lim(key):
        lo, hi = 0.1, 500.0
        for _ in range(80):
            mid = 0.5 * (lo + hi)
            R = capacity(dict(P, P_kW=mid))
            v = R["gear1"]["SH"] if key == "H" else min(R["gear1"]["SF"], R["gear2"]["SF"])
            if v >= (SH_req if key == "H" else SF_req):
                lo = mid
            else:
                hi = mid
        return lo
    return {"P_pitting": lim("H"), "P_root": lim("F")}
```

```
== 5.11 maximum power
  pitting limit (S_H = 1.0): 14.97 kW; root limit (S_F = 1.4): 19.43 kW
  ground flanks (Z_LVR 1.0): pitting limit 16.65 kW
```
**Interpretation.** The pair can transmit 14.97 kW before S_H = 1.0 and 19.43 kW before S_F = 1.4. With 7.5 kW the
design has a power margin of 2 × on pitting. With ground flanks (Z_LVR 1.0) the pitting limit rises to 16.65 kW. Because
σ_H ∝ √P, S_H = 1.39 at 7.5 kW means P_max ≈ 7.5 · 1.39² ≈ 14.5 kW – the bisection confirms the square law (the small
difference comes from K_V, which falls slightly with load).

### 5.12 Hypoid gears – note only

A **hypoid** gear is a spiral bevel pair whose pinion axis is **offset** from the wheel axis (offset a, typically 10–20 % of
the wheel diameter). Advantages: bigger and stronger pinion for the same ratio, the pinion shaft can pass under the wheel
(vehicle axles), very quiet. Disadvantages: **lengthwise sliding** along the teeth adds to the profile sliding → higher
friction, lower efficiency (≈ 90–96 % instead of 98–99 %), high flash temperature → **scuffing risk**; extreme-pressure (EP)
hypoid oils are needed. The geometry (different spiral angles on pinion and wheel, pinion offset angle) and the rating
(ISO 10300 with offset terms, scuffing by ISO/TS 10300-20) are **not** included in this program. Hypoid gears are
designed with the gear-cutting machine maker's software only.

### 5.13 MATLAB equivalent (pitting and root stress via the virtual pair)
```matlab
% virtual gear (mean section), Sigma = 90 deg, default values
z1 = 17; z2 = 43; met = 3; b = 18; bm = deg2rad(35); an = deg2rad(20);
d1 = atan(z1/z2); d2 = pi/2 - d1; Re = met*z1/(2*sin(d1)); Rm = Re - b/2;
mmt = met*Rm/Re; mmn = mmt*cos(bm); dm1 = mmt*z1;
dv1 = dm1/cos(d1); uv = (z2/cos(d2))/(z1/cos(d1));
at = atan(tan(an)/cos(bm)); bb = asin(sin(bm)*cos(an));
T1 = 7500/(1450*2*pi/60); Ft = 2*T1*1000/dm1; beff = 0.85*b;
ZH = sqrt(2*cos(bb)/(cos(at)^2*tan(at))); ZE = 189.8; Zeps = 0.904; Zb = 1/sqrt(cos(bm)); ZK = 0.85;
KA = 1.25; KV = 1.085; KHb = 1.5*1.25;
sH = ZH*ZE*Zeps*Zb*ZK*sqrt(Ft/(dv1*beff)*(uv+1)/uv)*sqrt(KA*KV*KHb)   % expect about 1028 MPa
SH = 1500*0.95/sH                                                        % expect about 1.39
```

### 5.14 Check questions
1. Why is u_v = u² for a 90° bevel pair, and why does a large u_v lower the Hertz pressure?
2. Which factor in the default calculation is the largest, and how can you reduce it without changing the gears?
3. Why is the wheel root weaker than the pinion root here, unlike in most cylindrical pairs?
4. Increasing β_m from 35° to 40° lowers S_H. Give two geometric reasons from the study table.
5. Estimate P_max for S_H = 1.0 from S_H = 1.39 at 7.5 kW with the square law, and compare with the bisection result.

---

## 6 Contact pattern, mounting deviations and backlash

> Program: new functions `backlash_mounting()`, `backlash_recommendation()`, `thermal_mounting()` (`python bevel.py ch56`).
> Example values; the backlash relation is a simplified linear model – check with the gear maker's summary.

### 6.1 Why bevel gears need a developed contact pattern

**Theory.** A cylindrical gear pair can move axially without changing the mesh. A bevel pair cannot: the two pitch cones must
meet in **one apex**. Any error of the axial positions, the shaft angle or an offset between the axes moves the contact on the
flank. Under load, shafts, bearings and the housing deflect – the pinion is pushed away from the wheel (by F_a and F_r,
chapter 4) and the contact moves again.

Therefore bevel teeth are **never** made as exact conjugate surfaces. They get an **ease-off**: a small, controlled
deviation from the conjugate surface:
- **lengthwise crowning** – the tooth is a little thinner at heel and toe → the pattern is shorter than the face width;
- **profile crowning / tip and root relief** – the pattern is shorter than the tooth height;
- **bias** (diagonal) – the pattern runs slightly diagonal, chosen so that it moves to the centre under load.

The pattern on an unloaded, correctly mounted pair is typically 50–70 % of the face width and 70–80 % of the tooth height,
slightly **toe-biased** (towards the small end) (typical – check with the cutting summary). Under the rated load the
deflections move it towards the centre and towards the heel. If it is already central at light load, it runs off the heel
under full load → edge loading → pitting and root fracture at the heel.

### 6.2 The V–H test and the mounting deviations E, P, G, Σ

**Test.** On a **bevel gear testing machine** (or in the housing) the pair is run under light load with marking compound
(paint). The machine can shift the members:
- **V** = vertical shift = pinion **offset** (moves the pinion axis sideways, like a hypoid offset) – symbol **E**;
- **H** = horizontal shift = pinion **mounting distance** (axial position of the pinion) – symbol **P**;
- **G** = axial position of the **gear** (wheel);
- **Σ** (α in some tables) = shaft angle error.

The V/H test finds how far each shift moves the pattern from toe to heel and from flank to top. Good gears tolerate a
"V/H ratio" window; a large sensitivity means the gear needs very accurate housings.

**How each deviation moves the pattern (qualitative, drive side of the gear, typical for spiral bevels – check with your
test machine handbook):**

| Deviation | Pattern movement | Backlash | Typical cause |
|---|---|---|---|
| Pinion axially **out** (P +, away from apex) | Towards the **flank** (root) of the gear on the drive side, towards **toe/heel** depending on spiral hand | Increases | Shim too thick, bearing seat position |
| Pinion axially **in** (P −) | Towards the **top** (tip) of the gear tooth | Decreases | Shim too thin, thermal growth of the pinion shaft |
| Gear axially **out** (G +) | Mostly changes backlash; small shift lengthwise | Increases strongly | Gear shim |
| Gear axially **in** (G −) | Opposite; risk of jamming | Decreases strongly | Thermal growth |
| Offset **E** (V) | Lengthwise: towards **heel** on one flank and **toe** on the other (drive/coast opposite) | Small | Bore positions in the housing |
| Shaft angle **Σ** error | Lengthwise towards heel or toe on both flanks | Small | Housing machining, bearing tilt |

Practical consequence: in assembly, the **pinion** position (P) is set first with shims to get the correct pattern
**height** (flank/top), then the **gear** position (G) is set to get the backlash. Offset and shaft angle cannot be
corrected by shims – they must be right in the housing (tight position tolerances of the bores, measured on a CMM).

### 6.3 Backlash change from mounting distance errors (simplified model)

**Derivation.** Look at the pitch cones near the mean point. An axial shift ΔP of the pinion (along its own axis) has a
component perpendicular to the pitch-cone generator of ΔP · sin δ1 (because the generator is inclined by δ1 to the
axis). This component acts like a change of the centre distance of the virtual cylindrical pair: the teeth move apart by
ΔP sin δ1. For a cylindrical pair a centre-distance change Δa changes the normal backlash by 2 Δa tan α_n (M5 chapter 6).
The same holds for the gear with ΔG sin δ2. Adding both:

**Formula box**

  Δj_n ≈ 2 · tan α_n · (ΔP · sin δ1 + ΔG · sin δ2)  (positive shift = away from the cone apex = out of mesh)

(simplified linear model at the mean point; for spiral bevels the normal plane is inclined, and the exact relation comes from
the machine summary – check.)

With δ1 = 21.57° and δ2 = 68.43°: sin δ1 = 0.368, sin δ2 = 0.930. **The gear position is 2.5 × more sensitive than the pinion
position** – that is why the gear is used to set the backlash.

```python
def backlash_mounting(P, dP_mm=0.0, dG_mm=0.0):
    """Change of normal backlash from axial mounting errors (simplified, check): an axial shift dP of the pinion (positive =
    away from the cone apex, out of mesh) moves its pitch cone by dP sin(delta1) normal to the pitch line; same for the gear with
    dG sin(delta2). Like a centre-distance change: dj_n = 2 tan(alpha_n) (dP sin(delta1) + dG sin(delta2)).  [mm -> um]"""
    g = geometry(P)
    an = math.radians(P["alpha_n_deg"])
    return 2 * math.tan(an) * (dP_mm * math.sin(g["delta1"]) + dG_mm * math.sin(g["delta2"])) * 1000
```

**Run it:** block "6.3"
```
== 6.3 backlash change from mounting errors
  dP +0.05 mm, dG +0.00 mm -> dj_n +13.4 um
  dP +0.00 mm, dG +0.05 mm -> dj_n +33.8 um
  dP +0.05 mm, dG +0.05 mm -> dj_n +47.2 um
  dP -0.05 mm, dG +0.00 mm -> dj_n -13.4 um
  dP +0.00 mm, dG -0.10 mm -> dj_n -67.7 um
  recommended normal backlash for met 3.0: 0.10 ... 0.15 mm (typical)
  thermal (housing +20 K, shafts +30 K, L 60 / 40 mm): dP -8.1 um, dG -5.4 um -> dj_n -5.8 um
  same with an aluminium housing: dP +6.9 um, dG +4.6 um -> dj_n +5.0 um
```
**Interpretation.**
- 0.05 mm pinion shift changes the backlash by 13.4 µm; 0.05 mm gear shift by 33.8 µm.
- Recommended normal backlash for m_et 3: 0.10 … 0.15 mm (typical industrial range, `BACKLASH_TABLE` – check with the
  gear maker or AGMA 2005). To stay inside this 50 µm band with the gear setting alone, the gear axial position must be
  held to about ± 0.04 mm – achievable with ground shims of 0.05 mm steps and a measuring fixture.
- A gear pushed 0.1 mm **into** mesh removes 68 µm of backlash – with 0.10 mm design backlash this is close to jamming,
  especially when heat (below) removes more.

### 6.4 Thermal effects on the mounting distances

**Theory.** In operation the shafts are warmer than the housing (bearing friction, oil). Each shaft grows from its
**locating bearing** towards the gear. If the locating bearing is on the side away from the apex (the usual pinion
arrangement), the pinion grows **into** mesh. The housing, if warmer, moves the bearing seats **out** of mesh. Net shift:

  ΔP = (α_housing ΔT_housing − α_shaft ΔT_shaft) · L_P  (L_P = locating bearing → mean point of the pinion)

and the same for the gear with L_G; then Δj_n from 6.3. New function `thermal_mounting()`:
```python
def thermal_mounting(P, L_pinion_mm=60.0, L_gear_mm=40.0, dT_housing=20.0, dT_shaft=30.0,
                     a_housing=10.5e-6, a_shaft=11.5e-6):
    """Thermal change of the mounting distances: a shaft grows from its locating bearing towards the cone apex
    (into mesh) by a_shaft dT_shaft L, the housing moves the locating bearing away by a_housing dT_housing L.
    Net axial shift of each member (positive = out of mesh) and the resulting backlash change (um)."""
    dP = a_housing * dT_housing * L_pinion_mm - a_shaft * dT_shaft * L_pinion_mm
    dG = a_housing * dT_housing * L_gear_mm - a_shaft * dT_shaft * L_gear_mm
    return {"dP_um": dP * 1000, "dG_um": dG * 1000, "dj_um": backlash_mounting(P, dP, dG)}
```

```
  thermal (housing +20 K, shafts +30 K, L 60 / 40 mm): dP -8.1 um, dG -5.4 um -> dj_n -5.8 um
  same with an aluminium housing: dP +6.9 um, dG +4.6 um -> dj_n +5.0 um
```
(the two "thermal" lines of block "6.3")

**Interpretation.** With a grey-iron housing (+20 K) and steel shafts (+30 K), both members grow into mesh and the backlash
falls by about 6 µm. With an aluminium housing the housing growth wins and the backlash rises by 5 µm. Both are small
compared with the 100–150 µm design backlash here, but for **small modules** (m < 2, backlash 50 µm) or **long overhangs**
the thermal change must be added to the cold backlash budget: j_cold,min ≥ j_hot,min + |Δj_thermal|.

### 6.5 Deflection under load and the toe-biased pattern

Under load the pinion is pushed away from the apex by F_a1 = 1813 N and towards its axis by F_r1 = 347 N (chapter 4);
the wheel by F_a2 = 347 N and F_r2 = 1813 N. The deflections of shafts (M3), bearing elastic approach (M4 chapter 10) and
housing walls add up to typically 0.02–0.10 mm at the mesh for compact drives (typical – check with an FEA of the housing,
chapter 7). The gear designer therefore:
1. estimates the **loaded** displacements E, P, G, Σ at the rated load (FEA or hand calculation with M3 / M4 stiffnesses);
2. chooses the ease-off so that the pattern is central at the **rated** load;
3. specifies the **unloaded** pattern for the assembly check: shorter, toe-biased (towards the small end) and slightly
   towards the flank (exact amount from the machine summary).

A loaded tooth contact analysis (LTCA) in the cutting-machine software shows the pattern under load; an FEA in Ansys or
Abaqus with the real tooth surfaces (from the machine software) shows the root stresses.

### 6.6 Ease-off, lapping, grinding and hard skiving – pattern quality

| Process (after case hardening) | How the pattern is made | Pattern quality, repeatability | Remarks |
|---|---|---|---|
| **Lapping** | Pinion and gear run together with abrasive paste under light load; the testing machine moves V/H to spread the pattern | Good, but pairs are **matched** (serial number pairs), lapped surfaces Ra ≈ 0.6–1.2 µm (typical) | Cheap, standard for face-hobbed (Klingelnberg cyclo-palloid) and many face-milled gears; Z_LVR ≈ 0.95 |
| **Grinding** (face-milling geometry) | Cup grinding wheel generates each tooth; ease-off set by machine kinematics (higher-order corrections) | Very good and **repeatable**; single gears are interchangeable; Ra ≈ 0.3–0.5 µm | For high load / high speed / low noise; expensive; grinding burn check (nital etch) |
| **Hard skiving / hard cutting** | Carbide or CBN blades cut the hardened flank | Good; between lapping and grinding | Face-hobbing gears that cannot be ground |
| **Soft cut + no finishing** | Pattern from soft cutting; heat-treatment distortion uncorrected | Poor | Only for low-loaded, slow, non-hardened gears |

The **ease-off** (difference surface to the conjugate flank) is the design parameter that the cutting machine realises:
lengthwise crowning, profile crowning and bias. Modern CNC bevel machines (Gleason, Klingelnberg) correct it from a measured
flank topography (closed-loop: measure on a gear measuring machine → correction of machine settings → re-grind).

### 6.7 How to read contact pattern photos and what to correct

| Pattern on the **gear** drive flank (photo) | Meaning | Correction (typical) |
|---|---|---|
| Central, 50–70 % length, slightly toe-biased | Correct for light load | None – record the shim values |
| At the **toe**, short | Gear too far in or pinion position wrong; shaft angle error | Move pinion out (thicker shim), re-check backlash |
| At the **heel** | Opposite of toe; under load it will run off the heel – **dangerous** | Move pinion in; check shaft angle of the housing |
| At the **top** (tip) of the gear tooth | Pinion too far out | Pinion in (thinner shim) |
| At the **flank** (root) of the gear tooth | Pinion too far in | Pinion out |
| Diagonal toe-top / heel-flank (bias) | Offset or wrong machine settings | Check housing bore positions (CMM); if gears: back to the gear supplier with the photos |
| Drive and coast flank patterns at opposite ends | Offset error E | Housing correction, cannot be shimmed |

Take photos of **both** flanks (drive and coast) with a scale, note shim thicknesses, backlash, measuring load and direction.
This record is part of the assembly quality documents (M1 chapter 33).

### 6.8 Backlash recommendation vs module

`BACKLASH_TABLE` (typical normal backlash of industrial bevel gears, measured at the tightest point – check AGMA 2005 or the
gear maker):

| m_et (mm) | Normal backlash j_n (mm) |
|---|---|
| 1 – 2 | 0.05 – 0.10 |
| 2 – 3 | 0.08 – 0.13 |
| 3 – 4 | 0.10 – 0.15 |
| 4 – 5 | 0.13 – 0.18 |
| 5 – 6.5 | 0.15 – 0.20 |
| 6.5 – 8 | 0.18 – 0.25 |
| 8 – 10 | 0.20 – 0.30 |

```python
def backlash_recommendation(met):
    for lo, hi, a, b in BACKLASH_TABLE:
        if lo <= met < hi:
            return a, b
    return None
```

The backlash is produced by the **tooth thickness allowance** (input `thickness_allowance_um`, chapter 7 inspection data)
and set in assembly with the gear position G (6.3). Measure it with a dial indicator on the gear at the outer pitch
diameter with the pinion locked, at 3–4 positions around the gear (run-out!), and convert the circumferential value to
normal backlash: j_n = j_t · cos α_n · cos β (at the measuring diameter – check).

### 6.9 MATLAB equivalent
```matlab
an = deg2rad(20); d1 = atan(17/43); d2 = pi/2 - d1;
djn = @(dP, dG) 2*tan(an)*(dP*sin(d1) + dG*sin(d2))*1000;   % um, shifts in mm (+ = out of mesh)
djn(0.05, 0)      % expect +13.4 um
djn(0, 0.05)      % expect +33.8 um
% thermal: grey iron housing +20 K, steel shafts +30 K, L = 60 / 40 mm
dP = (10.5e-6*20 - 11.5e-6*30)*60; dG = (10.5e-6*20 - 11.5e-6*30)*40;
djn(dP, dG)       % expect about -5.8 um
```

### 6.10 Check questions
1. Why must bevel teeth have an ease-off, while a cylindrical gear pair can run with almost conjugate flanks?
2. Which member do you shim first in assembly, and what do you set with it? Which member sets the backlash, and why
   (use sin δ1 and sin δ2)?
3. The unloaded pattern is at the heel. What will happen under load, and what do you change?
4. Which deviations cannot be corrected with shims?
5. Your housing is aluminium and the shafts run 30 K warmer. Does the backlash increase or decrease in this example?


---

## 7 Manufacturing of bevel gears

> Program: `tools/bevel.py` (examples) and the chapter functions (`python bevel.py ch78`). All machine, tool and process
> values are **typical values – check with the machine maker, the tool maker and your heat-treatment shop**. Maker and machine
> names are examples, not recommendations.

A bevel gear is much harder to make than a cylindrical gear. The teeth lie on a **cone**, the tooth depth and thickness
change from the toe (small end) to the heel (large end), and on spiral bevels the tooth trace is **curved**. You cannot
check a bevel gear alone: the pinion and the wheel are developed **as a pair**, and the final quality is decided by the
**contact pattern** in the real housing. This chapter follows the parts through the factory: process chain → blank →
cutting → heat treatment → hard finishing → inspection → assembly.

### 7.1 Process chains and their quality

**Theory.** There are two families:

- **Straight (and Zerol) bevels.** Teeth are straight lines through the cone apex. Simple to make, but noisy at speed
  (contact ratio only from the profile, ε_vβ = 0). Used at low speed (v < 5 m/s typical – check) or very high volume
  (differentials).
- **Spiral bevels.** Curved teeth with spiral angle β_m (typically 30–35°). Overlap ratio ε_vβ > 1 → smooth and quiet,
  higher load capacity, but the axial force depends on the hand and the rotation (chapter 4). They are cut on special
  machines with a rotating **cutter head** (face milling or face hobbing).

The chain is always **soft machining → heat treatment → (hard finishing) → inspection → paired marking**.

**In the program** – the typical process chains are stored as a table:

```python
PROCESS_CHAINS = [  # name, kind, typical ISO 17485 grade after process, volume suitability, relative cost (1 = lowest)
    ("precision forging (net-shape teeth)", "straight", "9-11", "very high volume (automotive differential)", 1),
    ("Revacycle broaching (straight, one tooth per turn of the broach)", "straight", "8-9", "high volume", 2),
    ("two-tool generating / planing", "straight", "7-9", "small lots, large gears", 4),
    ("Coniflex (interlocking disc cutters, slightly crowned)", "straight", "7-8", "small to medium lots", 3),
    ("face milling soft + carburise + lapping", "spiral", "6-8", "medium to high volume (matched sets)", 3),
    ("face milling soft + carburise + grinding", "spiral", "4-6", "aerospace, machine tools, low noise", 5),
    ("face hobbing soft + carburise + lapping", "spiral", "6-8", "high volume (automotive, industrial)", 3),
    ("face milling / hobbing + carburise + hard skiving", "spiral", "5-7", "medium lots, no grinding machine", 4),
]
```

**Run it:** `python bevel.py ch78` (first block)
```
== 7.1 process chains (typical, check)
  precision forging (net-shape teeth)                            straight grade 9-11  cost 1  very high volume (automotive differential)
  Revacycle broaching (straight, one tooth per turn of the broach) straight grade 8-9   cost 2  high volume
  two-tool generating / planing                                  straight grade 7-9   cost 4  small lots, large gears
  Coniflex (interlocking disc cutters, slightly crowned)         straight grade 7-8   cost 3  small to medium lots
  face milling soft + carburise + lapping                        spiral   grade 6-8   cost 3  medium to high volume (matched sets)
  face milling soft + carburise + grinding                       spiral   grade 4-6   cost 5  aerospace, machine tools, low noise
  face hobbing soft + carburise + lapping                        spiral   grade 6-8   cost 3  high volume (automotive, industrial)
  face milling / hobbing + carburise + hard skiving              spiral   grade 5-7   cost 4  medium lots, no grinding machine
```
**Interpretation.**
- ISO 17485 grades: a smaller number = more accurate (like ISO 1328 for cylindrical gears). Grade 4–6 needs **grinding**
  after hardening. Lapped gears reach about grade 6–8 but run very quietly **as a matched pair**.
- For the factory's drives (conveyor, AGV wheel, rotary table) a **face-milled or face-hobbed, carburised, lapped** pair is
  the normal industrial choice. Grinding is chosen for machine tools, high speed, or when pairs must be interchangeable.
- Straight bevels for small lots: buy them from a gear shop that has a Coniflex or planing machine; do not make them on a
  5-axis milling centre unless the quantity is very small (see 7.5 – free-form milling).

**Check questions.** (1) Why can a lapped pair not be mixed with another lapped pair? (2) Which process gives grade 5?

### 7.2 Blank manufacture – datums, angles and why blank errors become tooth errors

**Theory.** The bevel gear blank is turned (or forged and turned) before cutting. The gear-cutting machine clamps the blank
on its **locating face** (back face for wheels, shaft shoulder / bearing seat for pinions) and its **bore / journal**. The
cutting machine is set to cut the teeth at a **nominal distance from that locating face** (crown-to-apex, "mounting
distance" geometry). Therefore every blank error goes **directly into the teeth**:

| Blank feature | Typical tolerance (example – check) | What happens if wrong |
|---|---|---|
| Face angle (tip cone) δ_a | ± 0.05 … 0.1° | Tip height changes along the face width; tooth depth toe/heel wrong; pattern shifts |
| Crown-to-apex (along the axis) | ± 0.025 … 0.05 mm | Teeth cut too far / too near the apex → wrong mounting distance, backlash change |
| Back face run-out / flatness | 0.01 … 0.02 mm | Wobble → run-out of the teeth, noise |
| Bore / journal diameter, cylindricity | IT5 … IT6 | Eccentricity → run-out, pitch error |
| Outside diameter d_ae | ± 0.05 … 0.1 mm | Only for orientation (the face angle matters more) |

**Derivation (first order).**
- A face-angle error Δγ tilts the tip cone. Over the face width b the tip height changes by **Δh = b · tan Δγ**.
- A crown-to-apex error Δx shifts the whole tooth along the axis. In the mesh this is a mounting-distance error. Seen in
  the virtual cylindrical gear at the mean point it is a **radial separation Δa = Δx · sin δ**, and the circumferential
  backlash changes by **Δj_t ≈ 2 Δa tan α_t** – the same law as for a centre-distance change of cylindrical gears (M5 ch. 6).

| Formula box | |
|---|---|
| Tip height change over b | Δh = b · tan Δγ |
| Radial separation from an axial shift | Δa = Δx · sin δ |
| Backlash change (circumferential, mean point) | Δj_t ≈ 2 Δa · tan α_t ,  α_t = arctan(tan α_n / cos β_m) |

**In the program:**

```python
def blank_error_effect(P, d_face_angle_deg=0.05, d_crown_mm=0.05):
    """Simple geometric relations (first-order, check with a TCA for real cases):
    - face-angle error d_gamma: the tip height changes linearly along the face width: dh = b tan(d_gamma)
      (tooth tip toe vs heel; with the cutter set to the blank the whole depth tilts -> pattern moves toe/heel);
    - crown-to-apex error dx: if the blank is clamped on its back face, the teeth are cut dx too far / too near the apex;
      in assembly this equals a mounting-distance error dx -> radial separation da = dx sin(delta),
      backlash change dj_t ~ 2 da tan(alpha_t)  (same relation as a centre-distance change of the virtual cylindrical gear)."""
    g = geometry(P)
    an = math.radians(P["alpha_n_deg"])
    at = math.atan(math.tan(an) / math.cos(math.radians(P["beta_m_deg"])))
    dh = P["b"] * math.tan(math.radians(d_face_angle_deg))
    da = d_crown_mm * math.sin(g["delta1"])
    dj = 2 * da * math.tan(at)
    return {"dh_tip_mm": dh, "da_mm": da, "dj_t_um": dj * 1000, "dj_n_um": dj * math.cos(an) * 1000}
```

**Run it:** `python bevel.py ch78` (block 7.2)
```
== 7.2 blank errors
  face-angle error 0.05 deg, crown error 0.00 mm: tip height change over b 0.0157 mm; radial separation 0.0000 mm; backlash change j_t 0.0 um (j_n 0.0 um)
  face-angle error 0.00 deg, crown error 0.05 mm: tip height change over b 0.0000 mm; radial separation 0.0184 mm; backlash change j_t 16.3 um (j_n 15.4 um)
  face-angle error 0.10 deg, crown error 0.10 mm: tip height change over b 0.0314 mm; radial separation 0.0368 mm; backlash change j_t 32.7 um (j_n 30.7 um)
```
**Interpretation.** For the 7.5 kW pinion (δ1 = 21.57°) a crown error of only 0.05 mm changes the backlash by about
16 µm. A typical backlash band for m_et 3 is roughly 60–120 µm (check AGMA/DIN tables), so **one blank error of 0.05 mm eats a
quarter of the band**. That is why bevel blanks are turned on the same machine in one set-up for the locating face, the
journal and the face angle, and why the crown-to-apex dimension is measured with a gauge and recorded for every part.

**Practice.** Put the **datum (locating) faces** on the drawing as datums A (axis) and B (face). Dimension the face angle,
back angle and crown-to-apex **from datum B**, not from other surfaces. For forgings, leave 1.5–3 mm stock (check forge shop).

**MATLAB equivalent.**
```matlab
dh = b*tand(dgamma);  da = dx*sind(delta1);  at = atand(tand(an)/cosd(bm));  dj_t = 2*da*tand(at)*1000; % um
```
**Check questions.** (1) Why does a face-angle error not change the backlash in the first-order formula? (2) What is
measured with the crown-to-apex gauge?

### 7.3 The generating principle – crown gear, ratio of roll, Formate and generated teeth

**Theory.** A bevel gear generator imitates a gear meshing with an imaginary **crown gear** (a bevel gear with pitch angle
90°, i.e. a flat "rack" bent into a circle). The cutter blades represent **one tooth (space) of this crown gear**. The
**cradle** of the machine carries the cutter and rotates like the crown gear; the work rotates like the gear being cut.
When cradle and work roll together, the blades **generate** the tooth profile (like a hob generates an involute).

For Σ = 90° both members mesh with the same crown gear. Its number of teeth follows from the cone distance:

  z_p = z / sin δ   (pinion and wheel give the same value, because z1 / sin δ1 = z2 / sin δ2 = 2 R_e / m_et)

and for Σ = 90°: **z_p = √(z1² + z2²)**. The **ratio of roll** (work turns per cradle turn, in the machine's convention)
is the gear ratio between crown gear and work:

  **R_a = z_p / z = 1 / sin δ**

| Formula box | |
|---|---|
| Crown-gear teeth | z_p = z / sin δ = √(z1² + z2²) (Σ = 90°) |
| Ratio of roll | R_a = z_p / z = 1 / sin δ |
| Face hobbing indexing | ω_work / ω_cutter = z0 / z (z0 = blade groups / starts) |

**Formate (non-generated) vs generated.** For ratios u > about 2.5 (check), the **wheel** is usually cut **without
generating** (Formate / plunge cut): the cutter plunges into each slot and the tooth profile is simply the straight blade
profile. This is much faster. The **pinion** is then generated with machine settings that make it conjugate to this
non-generated wheel. For lower ratios both members are generated.

**Single indexing (face milling)** – the cutter head has blades on one circle; it cuts **one slot**, then the work indexes
to the next slot. The tooth trace is a **circular arc** (radius = cutter radius r_c). Variants:
- *five-cut / spread blade:* separate cuts for concave and convex flanks (best control, slow);
- *completing (two-flank):* both flanks in one cut with inner and outer blades (fast, standard today).

**Continuous indexing (face hobbing)** – the cutter head has **z0 blade groups** (starts). Cutter and work rotate
continuously with **ω_work / ω_cutter = z0 / z**, so each blade group enters the next slot – like a hob. The tooth trace
is an **extended epicycloid**, and the tooth depth is usually **constant** (uniform depth). This is the Klingelnberg /
Oerlikon tradition, today offered by Gleason too (names as examples).

**Cutter heads and blades.** Modern heads use **stick blades** (ground carbide bars, coated, e.g. AlCrN – check) clamped in a
steel body; dry cutting at high speed. Older systems used formed HSS blades and oil. The blade's pressure angle, edge radius
and top width define the tooth profile and the root fillet – they are matched to the gear design.

**In the program:**

```python
def crown_gear(P):
    """Imaginary crown gear (generating gear on the cradle) for Sigma = 90 deg: z_p = z / sin(delta) (same for both members:
    z_p = sqrt(z1^2 + z2^2)). Ratio of roll Ra = omega_cradle-to-work relation = z_p / z = 1 / sin(delta)
    (here as work turns per cradle turn: Ra = z_p / z)."""
    g = geometry(P)
    zp1 = P["z1"] / math.sin(g["delta1"])
    zp2 = P["z2"] / math.sin(g["delta2"])
    return {"zp1": zp1, "zp2": zp2, "zp_formula": math.hypot(P["z1"], P["z2"]), "Ra1": zp1 / P["z1"], "Ra2": zp2 / P["z2"]}
```

```python
def face_hobbing_ratio(z, z0):
    """Continuous indexing (face hobbing): during cutting the work turns z0/z times per cutter turn (z0 = number of blade
    groups / starts of the cutter head): omega_work / omega_cutter = z0 / z. Each blade group cuts the next slot."""
    return z0 / z
```

**Run it:** `python bevel.py ch78` (block 7.3)
```
== 7.3 generating gear and ratio of roll
  crown gear teeth z_p 46.239 (pinion) = 46.239 (wheel) = sqrt(z1^2+z2^2) 46.239; ratio of roll Ra pinion 2.7199, wheel 1.0753
  face hobbing z0 5: work/cutter speed ratio pinion 0.2941 (z 17), wheel 0.1163 (z 43)
  face hobbing z0 7: work/cutter speed ratio pinion 0.4118 (z 17), wheel 0.1628 (z 43)
```
**Interpretation.** Both members give z_p = 46.239 = √(17² + 43²) – the generating gear is common to the pair, as it must be.
The pinion rolls 2.72 turns per crown-gear turn, the wheel only 1.075 (its pitch angle 68.4° is close to the crown gear's 90°).
With u = 2.53 the wheel is a borderline Formate candidate. In face hobbing with 5 blade groups the pinion turns 0.294 times
per cutter turn.

**Check questions.** (1) Why is the tooth trace of a face-hobbed gear not a circle? (2) Why can the wheel be non-generated
but the pinion not?

### 7.4 Cutter radius and lengthwise curvature

**Theory.** With face milling the tooth trace is a circle of radius r_c around the cutter centre E (in the plane of the crown
gear). The spiral angle is the angle between the trace and the cone-distance direction, so it **changes along the face width**.
From the triangle apex – cutter centre – point on the trace (law of cosines):

  r_c² = R² + E² − 2 R E cos(…)   →   sin β(R) = (R² + r_c² − E²) / (2 R r_c)

E² is fixed by the condition β(R_m) = β_m. A **small cutter** gives a strongly curved tooth: the spiral angle grows a lot from
toe to heel. This **lengthwise curvature** is needed for the contact pattern (it gives "length crowning" together with the
machine settings), but too much curvature makes the pattern short and the heel/toe very different.
Guideline (check the machine maker's tables): **r_c ≈ R_m** (0.8 … 1.1 R_m), chosen from standard cutter diameters.

**In the program** (exact code of `cutter_data()`):

```python
def cutter_data(P, g):
    """Face-milling cutter radius (Gleason-style guideline r_c ~ R_m, i.e. 0.8 ... 1.1 R_m - check the machine maker's tables);
    standard cutter diameters (inch series typical: 1.1, 1.5, 2, 3.5, 5, 6, 7.5, 9, 12 in) -> nearest radius; spiral angle at the
    heel and toe for that cutter (a smaller cutter gives more lengthwise curvature and a larger heel-toe spread).
    Approximate geometry: the cutter centre lies at distance from the apex so that the tooth trace has beta_m at R_m."""
    bm = math.radians(P["beta_m_deg"])
    if bm == 0:
        return None
    rc_ideal = g["Rm"]
    std_in = [1.1, 1.5, 2.0, 3.5, 5.0, 6.0, 7.5, 9.0, 12.0]
    rc = min((d * 25.4 / 2 for d in std_in), key=lambda r: abs(r - rc_ideal))
    # cutter centre E (in the pitch plane of the crown gear): |E| from apex, beta(R) from geometry of a circle
    # cos-law: rc^2 = R^2 + E^2 - 2 R E cos(gam) ; spiral angle at R: sin(beta) = (R^2 + rc^2 - E^2)/(2 R rc)
    E2 = g["Rm"] ** 2 + rc ** 2 - 2 * g["Rm"] * rc * math.sin(bm)
    def beta_at(R):
        v = (R ** 2 + rc ** 2 - E2) / (2 * R * rc)
        return math.degrees(math.asin(max(-1, min(1, v))))
    return {"rc_ideal_mm": rc_ideal, "rc_mm": rc, "beta_heel": beta_at(g["Re"]), "beta_mean": beta_at(g["Rm"]),
            "beta_toe": beta_at(g["Re"] - P["b"])}
```

**Run it:** `python bevel.py ch78` (block 7.4)
```
== 7.4 cutter
  ideal r_c 60.36 mm -> standard 63.50 mm (5.0 in cutter); spiral angle heel 39.17, mean 35.00, toe 31.33 deg
  3.5 in cutter (r_c 44.45): heel 43.51, toe 26.99 deg -> spread 16.52 deg
  5.0 in cutter (r_c 63.50): heel 39.17, toe 31.33 deg -> spread 7.85 deg
  6.0 in cutter (r_c 76.20): heel 37.56, toe 33.07 deg -> spread 4.49 deg
```
**Interpretation.** R_m = 60.36 mm → the 5″ cutter (r_c = 63.5 mm) is the nearest standard size; the spiral angle runs from
31.33° at the toe to 39.17° at the heel (spread 7.85°). A 3.5″ cutter would give a 16.5° spread – a strongly curved, short
contact; a 6″ cutter gives only 4.5° – almost a "straight" trace that is sensitive to misalignment. The cutter radius is also
limited by the machine (maximum cutter diameter) and by **interference** with the next tooth at the toe – the gear shop decides
the final cutter with its software.

**Practice.** Ask the gear shop early which cutter diameters it has. Designing around an available cutter saves a new cutter
head (expensive, long delivery).

**Check questions.** (1) What happens to the heel/toe spiral angles with a bigger cutter? (2) Why must β(R_m) = β_m hold?

### 7.5 Machine settings and modern CNC bevel gear machines

**Concept.** A classical mechanical generator (cradle machine) has these **basic machine settings** – each one changes the
tooth surface in a defined way:

| Setting | Physical meaning | Main effect on the tooth |
|---|---|---|
| Cradle angle q | Rotational position of the cutter on the cradle | Position of the tooth along the face (spiral angle position) |
| Radial (eccentric) s | Distance of the cutter centre from the cradle axis | Lengthwise position, spiral angle |
| Tilt i and swivel j | Inclination of the cutter axis | Pressure-angle change along the face, profile crowning |
| Machine root angle γ_m | Setting of the work head | Root cone of the tooth |
| Sliding base / work offset | Axial position of work / cutter; vertical offset (hypoid) | Depth, mounting distance, hypoid offset |
| Ratio of roll R_a (+ modified roll) | Rolling ratio cradle : work | Profile shape, profile crowning |

**Free-form CNC machines** (e.g. Gleason Phoenix, Klingelnberg C-series – names as examples) have no cradle. Six CNC axes move
the cutter and the work so that the **relative motion equals the classical settings**. Advantages: any higher-order motion is
possible ("universal motion"), so the flank topography can be **corrected exactly**:

1. Cut a first part.
2. Measure the flank topography on a gear CMM (grid of points on both flanks).
3. Compare with the nominal surface (from the design software) → deviation map.
4. Software calculates **corrections of the machine settings** (closed loop).
5. Cut again – typical result: deviations within a few µm.

This closed loop (often called "closed-loop" or "corrective" production) is the modern standard in professional bevel shops.

**5-axis milling of bevel gears.** A 5-axis machining centre can mill bevel teeth from a CAD model (free-form milling with
ball / conical end mills). It is useful for **prototypes, spare parts and very large gears**, but slow and usually not at
grade 6–7 after heat treatment without grinding. NX CAM can program this from a SOLIDWORKS model; the model must come from a
real tooth-contact design (not just a CAD "bevel gear" feature).

**Check questions.** (1) Which setting moves the contact toward the toe? (answer: mainly radial / cradle angle – the gear
shop knows its machine's V-H correction table) (2) Why does a CNC machine make closed-loop correction easier?

### 7.6 Cutting data and cycle time

**Theory.** Modern spiral bevels are cut **dry with carbide stick blades**. Typical values (check the tool maker):
cutting speed v_c ≈ 150–300 m/min (soft steel, carburising grades), chip load per blade ≈ 0.04–0.1 mm. The cutter speed is

  n_c = 1000 · v_c / (π · D_c)

- **Single indexing** (face milling): each slot is cut separately → t ≈ z · (t_roll + t_index) + t_approach. The wheel in
  Formate is fast (plunge only); a generated pinion needs a roll per slot.
- **Continuous indexing** (face hobbing): all slots are cut during one plunge. The number of cutter turns for the depth is
  N = h / f_rev (f_rev = plunge feed per cutter turn) → t ≈ N / n_c · 60 + t_approach.

**In the program:**

```python
def cycle_time(P, which=1, method="single", vc=220.0, roll_s_per_slot=4.0, index_s=1.2, plunge_feed_mm_rev=0.08, z0=5,
               depth_mm=None, approach_s=10.0):
    """Cycle-time estimate.
    single indexing (face milling, completing): t = z (t_roll + t_index) + approach; Formate wheel: t_roll ~ plunge time.
    continuous (face hobbing): cutter speed n_c = 1000 vc / (pi D_c); number of cutter turns to plunge the full depth
    N = h / f_rev; t = N / n_c * 60 + approach (all slots are cut together, the work turns z0/z per cutter turn).
    vc = carbide dry cutting speed m/min (typical 150 ... 300, check tool maker)."""
    g = geometry(P)
    z = P["z%d" % which]
    cd = cutter_data(P, g)
    Dc = 2 * (cd["rc_mm"] if cd else g["Rm"])
    nc = 1000 * vc / (math.pi * Dc)
    h = depth_mm if depth_mm else g["hae%d" % which] + g["hfe%d" % which]
    if method == "single":
        t = z * (roll_s_per_slot + index_s) + approach_s
        return {"method": "single indexing", "z": z, "n_cutter_rpm": nc, "t_s": t, "depth_mm": h}
    N = h / plunge_feed_mm_rev
    t = N / nc * 60 + approach_s
    return {"method": "continuous (face hobbing)", "z": z, "z0": z0, "ratio_work_cutter": face_hobbing_ratio(z, z0),
            "n_cutter_rpm": nc, "cutter_turns": N, "t_s": t, "depth_mm": h}
```

**Run it:** `python bevel.py ch78` (block 7.6)
```
== 7.6 cycle time (typical values, check)
  gear 1: depth 5.609 mm; single indexing 98 s (n_cutter 551 rpm); face hobbing 18 s (70 cutter turns, ratio 0.2941)
  gear 2: depth 5.609 mm; single indexing 234 s (n_cutter 551 rpm); face hobbing 18 s (70 cutter turns, ratio 0.1163)
```
**Interpretation (example values).** With 4 s roll per slot and 1.2 s indexing, the 17-tooth pinion needs about 98 s and the
43-tooth wheel about 234 s in single indexing; face hobbing needs about 18 s for each, because all slots are cut together
(70 cutter turns at 551 rpm). This is why face hobbing dominates high-volume production. The numbers are rough: real cycle
times come from the machine maker's software (roughing + finishing passes, roll speed limits, tool life).

**Practice.** Tool life is counted in **parts per blade sharpening**; blades are re-sharpened on a special blade grinder and
re-built into the head on a building fixture (blade run-out < 2–5 µm – check). Plan this tool room equipment if you cut
bevels in-house.

**MATLAB equivalent.**
```matlab
nc = 1000*vc/(pi*Dc);  t_single = z*(t_roll+t_index)+t_app;  t_hob = (h/f_rev)/nc*60 + t_app;
```

### 7.7 Heat treatment and distortion

**Theory.** Industrial bevel gears are usually **case-hardened** (carburised, quenched, tempered): surface 58–62 HRC, tough
core. Typical effective case depth CHD (at 550 HV) ≈ 0.15–0.20 · m_mn (check ISO 6336-5 / ISO 10300 and your heat treater).

Carburising causes **distortion**: the wheel (thin disc) dishes and its teeth change spiral angle and pressure angle; the pinion
shaft bends and the teeth "unwind". Therefore:
- **wheels** are **press quenched** (quenched in a die that holds the disc flat) – this is standard for spiral bevel wheels;
- **pinions** are quenched hanging vertically, then the journals are ground relative to the teeth;
- the soft-cutting machine settings contain a **pre-correction** for the known distortion (learned from production);
- after hardening the pair is lapped or ground to remove the rest.

**In the program:**

```python
def case_depth(P):
    """Typical effective case depth (carburised bevel gears) CHD ~ 0.15 ... 0.20 m_mn at the mean section, at least ~0.3 mm;
    measured at 550 HV (check ISO 6336-5 / maker practice). Returns the range for both members (same m_mn)."""
    g = geometry(P)
    return {"chd_min": max(0.3, 0.15 * g["mmn"]), "chd_max": max(0.4, 0.20 * g["mmn"]), "mmn": g["mmn"]}
```

**Run it:** `python bevel.py ch78` (block 7.7)
```
== 7.7 case depth
  m_mn 2.1386 -> CHD 0.32 ... 0.43 mm (550 HV)
```
**Interpretation.** m_mn 2.14 → CHD about 0.32–0.43 mm. On the drawing: "case hardened, CHD 0.35 … 0.55 mm at 550 HV on the
flank at mid-height, 58–62 HRC, core 30–42 HRC" (example – the heat treater gives the process window; the grinding stock
must be added if the teeth are ground after hardening).

**Check questions.** (1) Why is a spiral bevel wheel press quenched? (2) Where do you measure the case depth?

### 7.8 Hard finishing – lapping, grinding, hard skiving

| Process | How it works | Quality (ISO 17485, typical) | Noise | Cost / pair | Notes |
|---|---|---|---|---|---|
| Lapping | Pinion and wheel run together under load with an abrasive compound; the machine moves V/H to cover the whole flank | 6–8 (as a pair) | Very low (pair is "run in") | Low | Pair must stay together (set number); removes little material (a few µm) |
| Grinding | Cup wheel replaces the cutter (face-milled designs only); generating like cutting | 4–6 | Low | High | Pairs are interchangeable; best for high speed / precision |
| Hard skiving | Carbide (or CBN) blades cut the hardened flank like soft cutting | 5–7 | Low–medium | Medium | Possible on the same machine type; no special grinding machine |
| None (soft only) | Cut soft, through-harden / nitride / use QT steel | 8–10 | Medium–high | Lowest | Only for low load and low speed |

**Matched pairs.** A lapped pair is marked with a **set number** on both parts, the **mounting distance deviation** (e.g.
"+0.04") on the pinion, and the **backlash** measured on the roll tester. Never mix parts of different sets.

### 7.9 Inspection

**Chordal tooth thickness.** With a gear tooth caliper you set the **chordal height** and measure the **chordal thickness**.
For bevel gears it is done at the outer (heel) section on the back cone (Tredgold), or at the mean section in the normal plane
for spiral bevels. With the back-cone radius r_ve = d_e / (2 cos δ):

  s̄ = 2 r_ve sin(s / (2 r_ve)),  h̄ = h_ae + r_ve (1 − cos(s / (2 r_ve)))

**In the program** (exact code of `chordal_thickness()`):

```python
def chordal_thickness(P, g, which=1):
    """Outer (heel) normal chordal tooth thickness and chordal addendum for a gear tooth caliper (Tredgold back cone):
    s_et = met (pi/2 + 2 x tan(an)) ; back-cone (virtual) radius rve = de/(2 cos(delta));
    chordal s_c = 2 rve sin(s/(2 rve)) ; chordal height h_c = hae + rve (1 - cos(s/(2 rve))).  (spiral: in the normal section at the
    mean point use m_mn and the virtual normal gear; here the outer transverse values for straight bevels.)"""
    an = math.radians(P["alpha_n_deg"])
    x = g["x%d" % which]
    d = g["delta%d" % which]
    de = g["de%d" % which]
    s = P["met"] * (math.pi / 2 + 2 * x * math.tan(an)) + P["thickness_allowance_um"] / 1000
    rve = de / (2 * math.cos(d))
    sc = 2 * rve * math.sin(s / (2 * rve))
    hc = g["hae%d" % which] + rve * (1 - math.cos(s / (2 * rve)))
    # mean normal section (spiral bevel): virtual normal gear radius
    sm = g["mmn"] * (math.pi / 2 + 2 * x * math.tan(an)) + P["thickness_allowance_um"] / 1000
    rvn = g["mmn"] * g["zvn%d" % which] / 2
    smc = 2 * rvn * math.sin(sm / (2 * rvn))
    hmc = g["ham%d" % which] + rvn * (1 - math.cos(sm / (2 * rvn)))
    return {"s_outer": s, "s_chord_outer": sc, "h_chord_outer": hc, "s_mean_normal": sm, "s_chord_mean": smc, "h_chord_mean": hmc}
```

**Run it:** `python bevel.py ch78` (block 7.9)
```
== 7.9 inspection (chordal thickness, allowance -40 um)
  gear 1: outer chordal 5.382 at height 3.478 mm; mean normal chordal 3.829 at height 2.897 mm
  gear 2: outer chordal 3.954 at height 1.740 mm; mean normal chordal 2.807 at height 1.439 mm
```
**Interpretation.** The pinion of the 7.5 kW example: set the caliper height to 3.478 mm and expect 5.382 mm chordal
thickness at the heel (including the −40 µm allowance). The caliper method is a quick shop check (±0.02 mm); the real
inspection of a spiral bevel is done on a gear CMM:

- **Topography (ease-off):** a grid (e.g. 5 × 9 points) on each flank is compared with the nominal surface from the design;
  the difference map shows profile and lengthwise errors and is fed back to the cutting machine (7.5).
- **Single-flank roll test:** pinion and wheel at the nominal mounting distances, light load, encoders on both shafts →
  transmission error (noise prediction), pitch errors.
- **Double-flank roll test:** the gear meshes without backlash with a master; the variation of the "centre distance" shows
  run-out and tooth-to-tooth errors.
- **Contact pattern on a roll tester (V-H check):** the pinion is moved vertically (V = offset) and horizontally
  (H = along its axis) until the pattern reaches the toe and the heel. The V/H values that keep the pattern inside the tooth
  measure the **sensitivity to misalignment** (good pairs tolerate V and H of about ±0.1 mm or more – check).
- **Run-out** of the tooth space relative to the datum axis.

### 7.10 Assembly in the gearbox – mounting distance, shims, backlash, pattern

**Mounting distance.** Every bevel gear has a nominal **mounting distance** (from the crossing point of the axes to the locating
face). The gear shop marks the pinion with the deviation at which the pair ran best on the roll tester (e.g. "+0.04 mm").
The fitter must reproduce **this** position in the housing.

**Shim procedure (example):**
1. Measure the housing: distance from the wheel axis to the pinion bearing seat → e.g. 82.13 mm (nominal 82.10).
2. Read the pinion mark: +0.04 mm.
3. Shim = nominal shim + (housing measured − housing nominal) − mark = 0.50 + 0.03 − 0.04 = 0.49 mm
   (sign depends on where the shim sits – always check with the assembly drawing).
4. Assemble the pinion with the tapered roller bearings and set their **preload** (rolling torque or axial play by shims /
   nut – see M4).
5. Set the **wheel** axially to get the marked backlash (below).
6. Check the **contact pattern** with marking compound under light load (pattern slightly toward the toe and centred in
   height when unloaded – it moves toward the heel under load), then check backlash at 3–4 positions.

**Backlash by axial movement.** Moving the wheel away from the apex by Δx separates the virtual gears radially by
Δa = Δx sin δ2, so **Δj_t ≈ 2 Δx sin δ2 tan α_t**.

**In the program:**

```python
def pinion_shim(marked_dev, housing_meas, housing_nominal, shim_nominal):
    """Pinion mounting-distance shimming. The pinion is marked with its deviation from the nominal mounting distance
    (e.g. '+0.04' = the pattern was best at MD + 0.04 mm on the roll tester). The housing distance from the wheel axis to the
    bearing seat is measured. Shim = nominal shim + (housing_meas - housing_nominal) - marked_dev
    (larger housing distance -> thicker shim to bring the pinion back; positive mark -> pinion must sit further from the
    apex -> thinner shim when the shim is between the pinion back face and the bearing - sign depends on the layout, check
    the drawing)."""
    return shim_nominal + (housing_meas - housing_nominal) - marked_dev
```

```python
def backlash_from_axial(P, dx_mm, which=2):
    """Moving gear 'which' along its own axis away from the apex by dx: radial separation of the virtual gears
    da = dx sin(delta), circumferential backlash change dj_t ~ 2 da tan(alpha_t) at the mean point (first-order)."""
    g = geometry(P)
    at = g["alpha_t"]
    da = dx_mm * math.sin(g["delta%d" % which])
    return {"da_mm": da, "dj_t_um": 2 * da * math.tan(at) * 1000}
```

```python
def dx_for_backlash(P, dj_t_um, which=2):
    g = geometry(P)
    return dj_t_um / 1000 / (2 * math.tan(g["alpha_t"]) * math.sin(g["delta%d" % which]))
```

**Run it:** `python bevel.py ch78` (block 7.10)
```
== 7.10 assembly
  shim = 0.50 + (82.13 - 82.10) - 0.04 = 0.49 mm
  wheel moved 0.05 mm away from the apex: radial separation 0.0465 mm, backlash change j_t 41.3 um
  wheel moved 0.10 mm away from the apex: radial separation 0.0930 mm, backlash change j_t 82.6 um
  to open the backlash by 40 um: move the wheel 0.048 mm (or the pinion 0.122 mm) away from the apex
```
**Interpretation.** Moving the **wheel** 0.05 mm opens the backlash by about 41 µm (δ2 = 68.4°, sin δ2 = 0.93). Moving the
**pinion** has much less effect (δ1 = 21.6°): you would need 0.122 mm for 40 µm. Therefore: **the pinion position sets the
pattern (mounting distance), the wheel position sets the backlash.** Good gearboxes have a shim or an adjusting nut at both.

**Practice checklist for assembly:** clean parts, set numbers matching, marked deviation read, shims measured with a micrometer,
bearing preload measured (rolling torque), backlash at several positions, pattern photo in the assembly record (traceability,
M1 ch. 33).

### 7.11 Typical defects and their causes

| Defect | Typical cause | Remedy |
|---|---|---|
| Pattern at the toe / heel | Mounting distance wrong, housing error, blank crown error | Correct shims (pinion), check housing bores, check blank |
| Pattern at the tip / root (profile) | Wrong pinion mounting distance (H) or offset (V); wrong machine settings | Re-shim; correct settings (closed loop) |
| Bridged / diagonal pattern | Spiral angle error, distortion after heat treatment | Pre-correct soft cutting; grind / lap |
| Noise (whine) at load | Transmission error, pattern too short, misalignment under load | Increase ε, ease-off design, stiffer housing, check bearings |
| Pitting at the toe | Edge contact at toe under load (deflection) | Pattern development under load (FE + test), stiffer pinion mounting (straddle) |
| Tooth breakage at the heel | Pattern at heel under load, overload | Check deflections, K_A, reduce misalignment |
| Scuffing | High sliding at tip, poor oil (spiral and especially hypoid gears) | EP oil, tip relief, better cooling |
| Run-out / pitch errors | Blank clamping, back-face run-out, worn index | Blank tolerances, machine maintenance |
| Burns after grinding | Too much stock, wrong wheel | Nital etch check (ISO 14104), adjust process |

### 7.12 What this means for your factory

- **Buy, do not make** spiral bevel gears unless the volume justifies a bevel generator, a blade grinder, a heat-treatment
  partner with press quenching, a lapping or grinding machine, a roll tester and a gear CMM.
- What **you** must control: the housing (bore positions, perpendicularity, distance to the crossing point), the shims and the
  assembly procedure, and incoming inspection (set numbers, marked deviations, a pattern check on your own housing).
- Give the supplier: torque spectrum, speed, life, mounting (straddle / overhung), housing stiffness, lubrication and
  required noise level. Ask for: design report (ISO 10300 / AGMA), tooth contact analysis, inspection report, set marking.

---

## 8 Verification, complete worked example and references

### 8.1 Verification

- **Commercial bevel software** (e.g. Gleason CAGE / GEMS, Klingelnberg KIMoS, KISSsoft bevel module, MESYS – names as
  examples): full ISO 10300 / AGMA rating, tooth contact analysis (TCA), loaded TCA, machine settings. Most of them need a
  licence (often dongle or network – check that it runs **offline** before you buy, see guide 52).
- **What to compare with `bevel.py`:** cone geometry (pitch / face / root angles, d_ae, crown-to-apex) must agree almost exactly;
  forces exactly; σ_H, σ_F roughly (±10–20 %) – the program uses a simplified virtual-gear method, Z_K, K_Hβ = 1.5 K_Hβ-be and
  b_eff = 0.85 b.
- **FEA / loaded tooth contact analysis (LTCA):** the real contact pattern under load depends on the ease-off and on the
  deflections of shafts, bearings and housing. In Ansys/Abaqus: import the exact tooth surfaces (from the bevel software, not
  from a CAD gear generator), mesh the contact region finely, apply torque in steps, and read contact pressure and root stress.
  Compare root stress with σ_F0 of the program (method-B factors on the virtual gear) – expect the same order of magnitude.
- **Test:** pattern check on a roll tester and in the real housing under load (pattern photos at 25 / 50 / 100 % torque).

### 8.2 Complete worked example – spiral bevel stage, 4 kW, 1450 rpm, i ≈ 3

**Requirement (example).** Right-angle drive for a conveyor: P = 4 kW at n1 = 1450 rpm, ratio about 3, Σ = 90°, case-hardened
and lapped, K_A = 1.25, S_H ≥ 1.2, S_F ≥ 1.6, pinion overhung (K_Hβ-be = 1.25).

**Choices.** z1 = 15, z2 = 46 (u = 3.067; no common factor → every tooth meets every tooth: good for lapping wear-in),
β_m = 35°, left-hand pinion turning clockwise (axial force pushes the pinion away from the apex → separating, safe), face width
b ≈ 0.28 R_e (rounded). Then the outer module is increased step by step until both safeties are met.

**In the program:**

```python
def design_example():
    """Iterate the outer module (and b ~ 0.28 Re, rounded) until S_H >= 1.2 and S_F >= 1.6 for 4 kW."""
    rows = []
    chosen = None
    for met in (1.75, 2.0, 2.25, 2.5, 2.75, 3.0):
        Q = dict(DEFAULT, **EXAMPLE)
        Q["met"] = met
        g = geometry(dict(Q, b=10))
        Q["b"] = round(0.28 * g["Re"])
        R = capacity(Q)
        sh, sf = R["gear1"]["SH"], min(R["gear1"]["SF"], R["gear2"]["SF"])
        ok = sh >= Q["SHmin"] and sf >= Q["SFmin"]
        rows.append((met, Q["b"], R["g"]["Re"], sh, sf, ok))
        if ok and chosen is None:
            chosen = Q
    return rows, chosen
```

**Input file** (`tools/examples/bevel_example.json`):
```json
{
  "name": "Worked example: spiral bevel stage 4 kW, 1450 rpm, i ~ 3 (chapter 8)",
  "kind": "spiral",
  "z1": 15,
  "z2": 46,
  "Sigma_deg": 90.0,
  "met": 2.5,
  "b": 17.0,
  "beta_m_deg": 35.0,
  "hand1": "left",
  "rotation1": "cw",
  "P_kW": 4.0,
  "n1_rpm": 1450.0,
  "KA": 1.25,
  "KHbeta_be": 1.25,
  "accuracy_grade": 7,
  "material1": "18CrNiMo7-6 case hardened",
  "material2": "18CrNiMo7-6 case hardened",
  "ZK": 0.85,
  "SHmin": 1.2,
  "SFmin": 1.6,
  "ZLVR": 0.95
}
```

**Run it:** `python bevel.py ch78` (block 8) – or `python bevel.py run --in examples/bevel_example.json --out bevel_ex`
```
== 8 worked example (4 kW, 1450 rpm, z 15/46, beta_m 35, S_H >= 1.2, S_F >= 1.6)
  met 1.75: b 12 mm (Re 42.34), S_H 0.81, S_F min 1.28 -> no
  met 2.00: b 14 mm (Re 48.38), S_H 0.99, S_F min 1.91 -> no
  met 2.25: b 15 mm (Re 54.43), S_H 1.16, S_F min 2.61 -> no
  met 2.50: b 17 mm (Re 60.48), S_H 1.36, S_F min 3.56 -> OK
  met 2.75: b 19 mm (Re 66.53), S_H 1.56, S_F min 4.68 -> OK
  met 3.00: b 20 mm (Re 72.58), S_H 1.73, S_F min 5.84 -> OK
  chosen: met 2.50, b 17 mm
# Bevel gear pair report - Worked example: spiral bevel stage 4 kW, 1450 rpm, i ~ 3 (chapter 8)

spiral bevel, z 15/46, Sigma 90.0 deg, met 2.50, b 17.0, beta_m 35.0 deg (left hand pinion, rotation cw), alpha_n 20.0

## Cone geometry
- u 3.0667; pitch angles 18.0605 / 71.9395 deg; de 37.500 / 115.000; Re 60.480, Rm 51.980 mm; b/Re 0.281 (<= 1/3 OK)
- m_mt 2.1486, m_mn 1.7601; dm 32.230 / 98.838; x 0.3485 / -0.3485
- addendum mean 2.374 / 1.147, outer 2.834 / 1.406; dedendum outer 1.846 / 3.274 mm
- face angles 21.159 / 73.688, root angles 16.312 / 68.841 deg; outside diameters dae 42.888 / 115.872; crown to apex 56.622 / 17.413 mm
- virtual gears: zv 15.78 / 148.38, zvn 27.15 / 255.30, uv 9.404; contact ratios eps_va 1.207, eps_vb 1.763, total 2.970

## Forces (driving pinion, mean section)
- T1 26.34 N m, T2 80.78 N m; Ft 1635 N; pinion Fa 1313 N, Fr 336 N; wheel Fa 336 N, Fr 1313 N; v 2.45 m/s (s = +1)

## Load capacity (ISO 10300 style via virtual gears, simplified)
- K_A 1.25, K_V 1.068, K_Hbeta 1.875 (1.5 x 1.25), K_Fbeta 1.593; Z_H 2.131, Z_E 189.8, Z_eps 0.910, Z_beta 1.105, Z_K 0.85
- sigma_H 1051 MPa; b_eff 14.4 mm
- gear 1: Y_F 1.051, Y_S 2.342 -> sigma_F 252 MPa, S_F 3.96; S_H 1.36; OK
- gear 2: Y_F 1.250, Y_S 2.192 -> sigma_F 281 MPa, S_F 3.56; S_H 1.36; OK

## Blank / inspection / cutting data
- gear 1: outer chordal thickness 4.511 at chordal height 2.963 mm; mean normal chordal thickness 3.169 at 2.426 mm
- gear 2: outer chordal thickness 3.253 at chordal height 1.413 mm; mean normal chordal thickness 2.278 at 1.150 mm
- face-milling cutter: ideal r_c 52.0 mm -> standard r_c 44.4 mm; spiral angle heel 42.13, mean 35.00, toe 28.41 deg
```
**Interpretation.**
- m_et 2.0 is too small (S_H 0.99); m_et 2.25 just misses S_H 1.2; **m_et 2.5 with b = 17 mm** meets S_H = 1.36 and
  S_F ≥ 3.56. Pitting governs, as for most case-hardened gears.
- ε_vα = 1.207 is low-ish (the 15-tooth pinion), but ε_vβ = 1.763 gives a total of 2.97 – smooth running.
- The gear shop's nearest cutter is 3.5″ (r_c 44.45 mm, ideal 52.0) → spiral angle 28.4° (toe) … 42.1° (heel). Ask whether a
  larger cutter is available; otherwise accept – the shop will adapt the settings.

**Manufacturing sheet (from the report and chapter 7):**

| Item | Pinion | Wheel |
|---|---|---|
| Teeth, hand | 15, left | 46, right |
| Outer module / face width | 2.5 / 17 mm | 2.5 / 17 mm |
| Pitch / face / root angle | 18.0605 / 21.159 / 16.312° | 71.9395 / 73.688 / 68.841° |
| Outside diameter d_ae | 42.888 mm | 115.872 mm |
| Crown to apex | 56.622 mm | 17.413 mm |
| Outer chordal thickness / height | 4.511 / 2.963 mm | 3.253 / 1.413 mm |
| Mean normal chordal thickness / height | 3.169 / 2.426 mm | 2.278 / 1.150 mm |
| Material, heat treatment | 18CrNiMo7-6, case hardened 58–62 HRC, CHD per 7.7 | same, press quenched |
| Finishing | lapped as a pair, set-marked | lapped, set-marked |
| Accuracy | ISO 17485 grade 7 (example) | grade 7 |
| Marking | set no., mounting-distance deviation, backlash | set no. |

### 8.3 Checklists

**Design:** z1 ≥ 12–15 (spiral) / ≥ 15–17 (straight) – check undercut; b ≤ R_e/3 and ≤ 10 m_et; hand of spiral chosen so the
pinion is pushed **away** from the apex in the main direction; S_H, S_F met with K_Hβ for the real mounting; bearings sized for
the axial forces (M4); housing stiffness considered.
**Drawing:** datums A/B; pitch, face, root angles; d_ae; crown-to-apex; mounting distance; chordal thickness or ease-off reference;
material, CHD, hardness; accuracy grade; set marking; "lapped as pair".
**Manufacturing:** cutter available; blank tolerances; heat-treat distortion pre-correction; finishing method; inspection plan
(CMM topography, roll test, pattern).
**Assembly:** shim procedure; bearing preload; backlash at 3–4 positions; pattern photo; record set numbers.

### 8.4 Common mistakes
- Treating a bevel gear like a cylindrical gear on the drawing (no mounting distance, no set marking).
- Wrong hand of spiral → pinion pulled **into** the mesh under load → backlash closes, jamming.
- Ignoring the axial forces in the bearing selection (they are large: F_a1 = 1313 N vs F_t = 1635 N in the example).
- Generating a "bevel gear" in CAD and milling it as is – the tooth form is not conjugate and has no ease-off.
- Mixing lapped pairs, or replacing only one gear of a set.
- Housing bores not perpendicular / not at the right distance → pattern at the toe and pitting.

### 8.5 Limits of `bevel.py`
- Simplified ISO 10300: virtual-gear method with M5 factors, fixed Z_K, K_Hβ = 1.5 K_Hβ-be, b_eff = 0.85 b, life factors = 1.
- Constant-clearance standard-depth geometry with a Gleason-style addendum modification; uniform-depth (face-hobbed) and hypoid
  geometry are **not** calculated.
- No tooth contact analysis, no ease-off, no machine settings – those come from the gear shop's software.
- Cutting times and process values are rough estimates.

### 8.6 Standards and books
- ISO 23509:2016 – Bevel and hypoid gear geometry.
- ISO 10300-1/-2/-3:2014 – Load capacity of bevel gears (introduction, pitting, tooth root).
- ISO 17485:2006 – Bevel gears, ISO system of accuracy.
- DIN 3971 – Terms and definitions for bevel gears (check the current edition).
- AGMA 2005-D03 – Design manual for bevel gears; ANSI/AGMA 2003 – rating of bevel gears (check edition).
- ISO 14104 – Temper etch inspection after grinding.
- H. J. Stadtfeld: *Handbook of Bevel and Hypoid Gears* (RIT).
- J. Klingelnberg (ed.): *Bevel Gear – Fundamentals and Applications*, Springer.
- F. L. Litvin, A. Fuentes: *Gear Geometry and Applied Theory*, Cambridge University Press.

### 8.7 Glossary
| Term | Meaning |
|---|---|
| Apex | Point where the pitch cones (and axes) meet |
| Back cone | Cone perpendicular to the pitch cone at the heel (Tredgold approximation) |
| Crown gear | Imaginary bevel gear with pitch angle 90° used for generating |
| Crown to apex | Axial distance from the crown (tip edge at the heel) to the apex – a blank dimension |
| Ease-off | Deviation of the tooth surface from the conjugate surface (designed crowning) |
| Face hobbing | Continuous-indexing cutting; extended-epicycloid tooth trace |
| Face milling | Single-indexing cutting; circular-arc tooth trace |
| Formate | Non-generated (plunge-cut) wheel |
| Heel / toe | Large / small end of the tooth |
| Lapping | Running a pair together with abrasive to improve the surface and noise |
| Mounting distance | Distance from the crossing point of the axes to the locating face |
| Ratio of roll | Rolling ratio cradle (crown gear) : work in generating |
| Set number | Mark that identifies the parts of one matched (lapped) pair |
| V-H check | Pattern test moving the pinion in offset (V) and axial (H) direction |
