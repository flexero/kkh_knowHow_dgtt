# M11 – Welds, frames and pressure parts: weld strength and fatigue, welded frames, air receiver, welding and vessel manufacturing

> Field 1 *Mechanical design*, item 11.
> **Theory and program are combined:** every formula is followed by the code of `tools/weld.py` (welds, frames,
> chapters 2–4 and 7–8) or `tools/vessel.py` (pressure parts, chapters 5–6), the command and the real output.
> MATLAB mirror: `tools/weld.m`. Web: tab **M_P_C tools**, item 17. Python standard library only – offline.
> **All inputs are example values.** Steel strengths, correlation factors, fatigue detail categories, partial
> factors, pressure-vessel material values, head formulas and PED limits are typical values in the style of
> EN 1993-1-1 / -1-8 / -1-9, IIW, EN 13445, ASME VIII-1, EN 286-1 and the PED – marked "check". The defaults are the
> compressor of M2/M9: the motor bracket post and the air receiver.

## Contents
0. How to use this guide with the programs
1. Purpose – what a weld and a pressure-vessel calculation must prove
2. Welded joints: joint and weld types, symbols, throat thickness, static strength of fillet and butt welds (EN 1993-1-8)
3. Weld groups and welded frames: line method, eccentric loads, welded members, frame design and stiffness
4. Fatigue of welded structures: detail categories, S-N curves, cut-off, Miner, spectra, thickness and mean stress, hot-spot and notch methods, improvement techniques
5. Pressure vessels: directives and codes, design stress, cylindrical shells, dished heads, openings, flanges
6. The compressor air receiver: volume, design, nozzles, supports, test pressure, category, pressure-cycle fatigue, safety valve, corrosion and inspection
7. Manufacturing: welding processes, WPS / WPQR, welder qualification, heat input and preheat, distortion and residual stress, PWHT, NDT and quality levels, weld cost, vessel and frame fabrication, inspection, failure modes
8. Verification, complete worked example, references, glossary

---

## 0. How to use this guide with the programs

### 0.1 Commands
| Command | What it does |
|---|---|
| `python weld.py params` / `python vessel.py params` | Default input as JSON (copy → edit → `--in`) |
| `python weld.py run --in my.json --out res` | Weld calculation → `report.md`, `weld_points.csv` (line forces and utilisation at every check point) |
| `python vessel.py run --in my.json --out res` | Receiver calculation → `report.md`, `vessel_data.csv` (data block for the vessel drawing / nameplate) |
| `python weld.py examples` / `python vessel.py examples` | Default reports, throat-thickness study, S-N table / head types, diameter study |
| `python weld.py ch24` · `python vessel.py ch56` · `python weld.py ch78` | Extra results of chapters 2–4 / 5–6 / 7–8 |
| `python weld.py selftest` / `python vessel.py selftest` | Independent cross-checks → SELFTEST PASS |
| Web: `http://localhost:8080/?mpcitem=17#mpc` | Weld group with utilisation along the welds, S-N curves with the load blocks, receiver design |

### 0.2 Program map – formula → function
| Chapter | Physics / method | Function |
|---|---|---|
| 2 | Steel grades (f_y, f_u, β_w), partial factors, directional and simplified method, throat rules | `STEELS`, `GAMMA_M0`, `GAMMA_M2`, `fillet_check()`, `throat_rules()` |
| 3 | Weld group by the line method: length, centroid, I_x, I_y, I_p; line forces normal, across and along the weld; welded RHS member | `group_props()`, `line_forces()`, `rhs()`, `member_check()` |
| 4 | Detail categories, S-N curve (slopes 3 / 5, constant-amplitude limit, cut-off), thickness effect, Miner damage for load blocks | `FAT`, `sn_cycles()`, `thickness_factor()`, `fatigue()` |
| 5 | Vessel materials, design stress, joint coefficient, shell, heads (hemispherical, 2:1, Klöpper, Korbbogen), head geometry, plate thickness, complete design | `VMAT`, `JOINT_Z`, `HEADS`, `PLATES`, `design_stress()`, `interp_T()`, `shell_e()`, `head_e()`, `head_geometry()`, `plate()`, `design()` |
| 6 | Receiver volume, nozzle area replacement, test pressure, PED / SPVD category, pressure-cycle fatigue, safety valve | `STD_VOLUMES`, `receiver_volume()`, `nozzle()`, `test_pressure()`, `ped_category()`, `pressure_fatigue()`, `safety_valve()` |
| – | All results, reports, data files | `summary()`, `report_text()`, `run()` (in both programs) |
| 2–4 | Joint and weld types, ISO 2553 symbol elements, leg vs throat, throat stress components, directional vs simplified capacity by load angle, full-strength fillet a/t, partial-penetration butt, throat rules and the 4 mm tube conflict, long joints β_Lw; weld-group catalogue vs textbook, eccentric C-bracket, line vs area method, instantaneous centre of rotation (in text), base-plate bending, gussets, compressor base frame (bending, L/500, natural frequency vs 24.1 / 48.2 Hz), column buckling χ, isolation mounts and transmissibility; extended FAT catalogue, S-N range table, rainflow counting, equivalent range, Miner variants (EN / Haibach / elementary), thickness effect, IIW mean-stress factor, hot-spot type a/b and effective notch, improvement techniques, γ_Mf strategy, bracket margin to finite life, AGV chassis spectrum (`weld.py ch24`) | `wa_leg_throat()`, `wa_components()`, `wa_unit_capacity()`, `wa_full_strength()`, `wa_butt()`, `wa_throat_conflict()`, `wa_long_joint()`, `wa_catalog()`, `wa_bracket()`, `wa_area_method()`, `wa_base_plate()`, `wa_frame()`, `wa_column()`, `wa_transmissibility()`, `wa_mounts()`, `wa_sn_table()`, `wa_equivalent_range()`, `wa_miner()`, `wa_rainflow()`, `wa_mean_stress_factor()`, `wa_hot_spot()`, `wa_hot_spot_b()`, `wa_bracket_margin()`, `wa_agv()`, `WA_JOINTS`, `WA_WELDS`, `WA_SYMBOL`, `WA_BRACKET`, `WA_UPN100`, `WA_FRAME`, `WA_FAT_EXT`, `WA_SIGNAL`, `WA_IMPROVE`, `WA_GAMMA_MF`, `WA_AGV` |
| 5–6 | Stored gas energy and TNT equivalent, PED fluid groups / category tables / modules, SPVD route, design-stress table, membrane hoop / axial and Lamé thick-wall check, external pressure (vacuum buckling), head comparison with knuckle factor M and EN crown formula, cone, nozzle area replacement study and pad, EN 1092-1 PN16 flanges, testing groups and joint coefficient, corrosion-allowance life; on/off cycle derivation, volume vs switching band and starts, variable-speed compressor, saddles (Zick simplified) and legs, test pressure and hydro vs pneumatic test energy, pressure-cycle fatigue study, condensate quantity, safety-valve size and reseat check, inspection intervals (`vessel.py ch56`) | `vb_stored_energy()`, `vb_ped_table()`, `vb_stress_table()`, `vb_membrane()`, `vb_thick_study()`, `vb_external()`, `vb_head_compare()`, `vb_M_curve()`, `vb_cone()`, `vb_nozzle_study()`, `vb_pad()`, `vb_flange()`, `vb_joint_study()`, `vb_corrosion_life()`, `vb_onoff()`, `vb_volume_study()`, `vb_vsd()`, `vb_saddles()`, `vb_legs()`, `vb_test_energy()`, `vb_fatigue_study()`, `vb_p_sat()`, `vb_condensate()`, `vb_sv_select()`, `VB_PED_TABLES`, `VB_MODULES`, `VB_FLANGE_PN16`, `VB_PN16_RATING`, `VB_TESTING_GROUPS`, `VB_SV_D0`, `VB_INSPECTION` |
| 7–8 | Welding processes ISO 4063 and heat input, CET / CE(IIW), preheat EN 1011-2 method B, cooling time t8/5, martensite hardness bound, lamellar tearing, Okerblom shrinkage force, shortening and bow, transverse shrinkage, PWHT, WPS / WPQR, welder qualification, ISO 3834, EN 1090 execution classes, NDT methods, ISO 5817 quality levels and the link to FAT, weld metal and cost per metre, air-receiver fabrication route, frame fabrication, inspection plan, failure modes, verification, worked example (jib-crane arm root joint) (`weld.py ch78`) | `wm_heat_input()`, `wm_cet()`, `wm_ce_iiw()`, `wm_preheat()`, `wm_t85()`, `wm_hv_martensite()`, `wm_shrink_force()`, `wm_distortion()`, `wm_transverse_shrink()`, `wm_pwht()`, `wm_area_fillet()`, `wm_area_butt()`, `wm_cost_per_m()`, `wm_example_params()`, `wm_variant()`, `WM_PROCESSES`, `WM_S355_CAST`, `WM_ALPHA_E_CRHO`, `WM_EXC`, `WM_NDT`, `WM_ISO5817`, `WM_COST`, `WM_VESSEL_ROUTE`, `WM_FRAME`, `INSPECTION_PLAN_WELD`, `FAILURES_WELD`, `WM_EXAMPLE_VARIANTS` |
Example input of chapter 8: `tools/examples/weld_example.json`.

### 0.3 What the self-tests prove
`weld.py`:
1. A single weld line has I = L³/12; the 80 × 80 box gives the textbook value I_x = 2·b·(d/2)² + 2·d³/12.
2. Integrating the line forces along all welds gives back N, M_y and T (equilibrium).
3. The directional method makes a transverse fillet weld √(3/2) = 1.22 times stronger than a longitudinal one.
4. The S-N curve passes through FAT at 2·10⁶ cycles, is continuous at the constant-amplitude limit (0.737·FAT at 5·10⁶) and has its cut-off at 0.405·FAT (10⁸).
5. RHS 80 × 80 × 4 has A = 1216 mm²; the default bracket passes all checks.

`vessel.py`:
1. At e = P·D_i/(2f − P) the hoop stress on the mean diameter is exactly f.
2. A hemispherical head needs half the cylinder thickness; Klöpper M = (3 + √10)/4.
3. The 2:1 ellipsoid volume is π·D³/24; the length from the volume gives the volume back.
4. The receiver formula gives the shortest on/off cycle (at 50 % demand) equal to 1/f_max.
5. ISO 4126 C(k = 1.4) = 2.703; 11 bar × 150 L is PED category III; the default receiver passes nozzle, test and fatigue.

## 1. Purpose – what a weld and a pressure-vessel calculation must prove

A weld joins parts permanently. It is the place where the material, the geometry and the residual stresses are
worst. Welded structures almost never fail by a single overload. They fail by **fatigue at the weld toe or root**,
by **brittle fracture**, or because the weld was **not made as drawn**. A pressure vessel adds stored energy: a
receiver with 150 L at 11 bar holds about 0.2 MJ. A failure is an explosion, so law, codes and inspection apply.

| Proof | Question | Chapter |
|---|---|---|
| Static weld strength | Does every point of every weld carry the design load (directional method)? Are the throat rules met? | 2, 3 |
| Member and frame | Do the welded members carry the load; is the frame stiff enough and away from resonance? | 3 |
| Fatigue | Do the stress ranges at toe and root stay below the S-N curve for the number of cycles (Miner ≤ 1)? | 4 |
| Pressure parts | Wall thickness of shell and heads, openings, test pressure, legal category | 5, 6 |
| Pressure cycles and relief | Fatigue from on/off cycles; safety valve capacity | 6 |
| Manufacture | Welding procedure, preheat, distortion, NDT, quality level, documentation | 7 |

**Default cases** (`python weld.py examples`, `python vessel.py examples`):

| Item | Result |
|---|---|
| Motor bracket post (RHS 80 × 80 × 5, S355, fillet a 3 all round), loads from M9: motor weight, belt pull 454 N (run-in), × 1.5 | directional utilisation 0.024, member 0.017. The **minimum throat (3 mm) governs, not strength** |
| Fatigue of the bracket: 480 000 motor starts + 6.9·10⁹ cycles of torque ripple at 24 Hz | all stress ranges below the cut-off limit → infinite life (damage 0). For 10⁹+ cycles only the cut-off matters |
| Receiver volume (FAD 16.6 m³/h, 6 → 8 bar, max 15 starts/h) | 140 L required → **150 L** standard |
| Receiver walls (P265GH, PS 11 bar, 100 °C, z 0.85) | shell 1.62 mm required → **4 mm** (allowances, rolling practice and the DN50 nozzle: 3 mm fails the area check); Klöpper heads 4 mm; length 1255 mm; 52 kg |
| Test, category, fatigue, safety valve | test 15.7 bar; PS·V = 1650 bar·L → PED category III, but the **simple pressure vessel directive** applies; 480 000 pressure cycles OK (N 1.6·10⁷); safety valve only 7.7 mm² flow area (20 kg/h) |


---

## 2. Welded joints: joint and weld types, symbols, throat thickness, static strength of fillet and butt welds (EN 1993-1-8)

A weld is a small casting made inside the structure. The filler metal melts together with the edges of the parts
(fusion zone), and the parent metal next to it is heated above the transformation temperature (heat-affected zone,
HAZ). Three facts follow, and the whole chapter builds on them:

1. The weld metal itself is usually **stronger** than the parent metal (filler metals "overmatch"). The design rules
   therefore check the **throat section of the weld** against the tensile strength f_u of the *parent* metal, with a
   correlation factor β_w.
2. The weld has a **geometric notch** at the toe (where the weld face meets the plate) and often at the root (where
   the fillet does not penetrate). Under static load the notch is harmless because steel yields. Under cyclic load the
   notch decides the life (chapter 4).
3. The weld is only as good as the **procedure and the welder** (chapter 7). A drawing must state the throat, the
   length, the quality level and, where it matters, the process.

### 2.1 Joint types

The **joint** describes how the parts meet. The **weld** describes how the gap is filled. The same T-joint can be
made with two fillet welds, with a K-butt weld or with a combination.

`python weld.py ch24` prints the tables first (data in add-on A of chapter 2):

```python
WA_JOINTS = [   # joint, parts, typical welds, note
    ("butt joint", "two plates in one plane", "square / V / X / U butt weld", "best fatigue (FAT 90-112); needs edge preparation"),
    ("T-joint", "one plate on the face of another", "fillet (one / both sides), HV / K butt", "the most common joint in frames and brackets"),
    ("corner joint", "two plate edges at an angle", "fillet outside / inside, V butt", "boxes, tanks; check lamellar tearing of the through plate"),
    ("lap joint", "plates overlapping", "fillet along edges, plug / slot welds", "simple fit-up; eccentric load path, crevice corrosion"),
    ("edge (flange) joint", "plate edges side by side", "edge weld", "thin sheet only, no structural load"),
]
```

```
## 2.1 Joint types
  butt joint           two plates in one plane            square / V / X / U butt weld               best fatigue (FAT 90-112); needs edge preparation
  T-joint              one plate on the face of another   fillet (one / both sides), HV / K butt     the most common joint in frames and brackets
  corner joint         two plate edges at an angle        fillet outside / inside, V butt            boxes, tanks; check lamellar tearing of the through plate
  lap joint            plates overlapping                 fillet along edges, plug / slot welds      simple fit-up; eccentric load path, crevice corrosion
  edge (flange) joint  plate edges side by side           edge weld                                  thin sheet only, no structural load
```

How to choose:

- For **static** load the cheapest weld that carries the load is a **fillet weld** without edge preparation.
- For **fatigue**, **pressure** or **full-strength** joints the load path must be smooth. Prefer **butt welds** in
  butt joints, or **full-penetration K/HV welds** in T-joints. They avoid the unwelded root, which acts like a crack
  in a fillet weld.
- A **lap joint** loads the welds eccentrically and traps water. Use it for light frames, covers and plug-welded
  stiffening, not for main load paths.
- A **corner joint** loads the through-plate across its thickness. Thick plates with inclusions can tear in layers
  ("lamellar tearing"). Order Z-quality plate (EN 10164, e.g. Z25) when the plate is thick and the weld is large and
  restrained.

### 2.2 Weld types and edge preparation

```python
WA_WELDS = [   # weld, preparation, penetration, typical use
    ("fillet weld", "none", "partial - to the root only", "T and lap joints; throat a in the design, leg z on the shop floor"),
    ("deep-penetration fillet", "none (MAG spray / SAW)", "beyond the root, credited only with a procedure test", "series production with qualified penetration"),
    ("square butt (I)", "gap 0...3 mm", "full for t <= 4...8 mm (one / both sides)", "thin plates"),
    ("single-V butt", "60 deg included angle, root face", "full with root pass / backing", "plates 4...20 mm"),
    ("double-V (X) butt", "two 60 deg bevels", "full, welded from both sides, half the volume", "plates > 15 mm, less distortion"),
    ("single-U / double-U", "J-shaped bevel radius", "full, smallest weld volume", "thick plates > 25 mm, pressure vessels"),
    ("single-bevel (HV) / K butt", "one plate bevelled 45...50 deg", "full (or partial with a_nom)", "load-carrying T-joints (cruciform)"),
    ("partial-penetration butt", "V or HV to a depth", "throat = prepared depth (minus 2 mm if angle < 60 deg, check)", "where full penetration is not needed"),
    ("plug / slot weld", "hole / slot in the upper plate", "fills the hole", "lap joints, against buckling of cover plates"),
    ("stud weld", "arc stud welding gun", "full cross-section of the stud", "fastening studs, shear connectors"),
]
```

```
## 2.2 Weld types
  fillet weld                  none                               partial - to the root only                           T and lap joints; throat a in the design, leg z on the shop floor
  deep-penetration fillet      none (MAG spray / SAW)             beyond the root, credited only with a procedure test series production with qualified penetration
  square butt (I)              gap 0...3 mm                       full for t <= 4...8 mm (one / both sides)            thin plates
  single-V butt                60 deg included angle, root face   full with root pass / backing                        plates 4...20 mm
  double-V (X) butt            two 60 deg bevels                  full, welded from both sides, half the volume        plates > 15 mm, less distortion
  single-U / double-U          J-shaped bevel radius              full, smallest weld volume                           thick plates > 25 mm, pressure vessels
  single-bevel (HV) / K butt   one plate bevelled 45...50 deg     full (or partial with a_nom)                         load-carrying T-joints (cruciform)
  partial-penetration butt     V or HV to a depth                 throat = prepared depth (minus 2 mm if angle < 60 deg, check) where full penetration is not needed
  plug / slot weld             hole / slot in the upper plate     fills the hole                                       lap joints, against buckling of cover plates
  stud weld                    arc stud welding gun               full cross-section of the stud                       fastening studs, shear connectors
```

The preparation sets the weld volume, and the volume sets the cost (chapter 7). A single-V butt on 20 mm plate
needs about twice the metal of a double-V butt. The double-V is also welded from both sides alternately, so the
angular distortion cancels. A U preparation needs machining, but for thick walls (pressure vessels, chapter 5) it
saves so much filler metal that it pays.

**Full or partial penetration?** A full-penetration butt weld, made with a qualified procedure and matching filler,
is as strong as the plate. You do not calculate it statically, you only check the plate. A partial-penetration weld
is calculated like a deep fillet weld with the prepared depth as the throat (section 2.7). It leaves an unwelded
gap in the middle, which is a built-in crack for fatigue.

### 2.3 Weld symbols (ISO 2553)

The drawing tells the shop floor which weld to make. The symbol sits on a **reference line** connected to the joint
by an **arrow**. ISO 2553 system A uses a second, dashed line to separate "this side" from "the other side":

```python
WA_SYMBOL = [   # element of the ISO 2553 symbol, meaning
    ("arrow line + reference line", "points to the joint; the solid reference line is the arrow side (system A)"),
    ("dashed identification line", "symbol on the dashed line = weld on the OTHER side (ISO 2553 system A)"),
    ("elementary symbol", "triangle = fillet, V = single-V butt, || = square butt, Y = V with root face, K-shape = K butt"),
    ("size left of the symbol", "a5 = throat 5 mm; z7 = leg 7 mm; s8 = penetration 8 mm for butt welds"),
    ("length right of the symbol", "n x l (e) = number of segments x length (gap) for intermittent welds; nothing = full length"),
    ("supplementary symbols", "circle at the knee = weld all round; flag = site weld; flat / convex / concave contour; ground flush"),
    ("tail", "process number (ISO 4063, 135 = MAG, 141 = TIG), quality level (ISO 5817 B / C / D), WPS reference"),
]
```

```
## 2.3 ISO 2553 symbol elements
  arrow line + reference line    points to the joint; the solid reference line is the arrow side (system A)
  dashed identification line     symbol on the dashed line = weld on the OTHER side (ISO 2553 system A)
  elementary symbol              triangle = fillet, V = single-V butt, || = square butt, Y = V with root face, K-shape = K butt
  size left of the symbol        a5 = throat 5 mm; z7 = leg 7 mm; s8 = penetration 8 mm for butt welds
  length right of the symbol     n x l (e) = number of segments x length (gap) for intermittent welds; nothing = full length
  supplementary symbols          circle at the knee = weld all round; flag = site weld; flat / convex / concave contour; ground flush
  tail                           process number (ISO 4063, 135 = MAG, 141 = TIG), quality level (ISO 5817 B / C / D), WPS reference
```

Example, the default bracket post: arrow to the tube/plate corner, circle at the knee (all round), triangle on the
solid line with `a3`, tail `135 / ISO 5817-C`. In words: fillet weld, throat 3 mm, all round the tube, MAG welded,
quality level C.

**Always write `a` or `z`.** The number "5" next to a triangle is ambiguous between countries. In Europe it is
normally the throat a, in the USA the leg z. A 5 mm leg is only a 3.5 mm throat, which carries 30 % less.

### 2.4 Throat thickness and leg length

For an equal-leg fillet weld at 90° the throat a is the height of the largest isosceles triangle inside the weld
cross-section:

  a = z · cos 45° = z / √2 = 0.707 · z

```python
def wa_leg_throat(z=None, a=None):
    """Equal-leg fillet at 45 deg: a = z / sqrt 2 = 0.707 z (throat = height of the inscribed isosceles triangle)."""
    if z is not None:
        return {"z": z, "a": z / math.sqrt(2)}
    return {"a": a, "z": a * math.sqrt(2)}
```

```
## 2.4 Leg and throat
  leg z 4.0 mm -> throat a 2.83 mm
  leg z 5.0 mm -> throat a 3.54 mm
  leg z 7.0 mm -> throat a 4.95 mm
```

Points for practice:

- **Design with a, inspect with z.** The welder and the weld gauge measure the leg. The drawing should therefore give
  `a`, and the work instruction should translate it to `z = 1.41 a`.
- **Convexity does not count.** Extra weld metal above the flat triangle (a convex face) is not part of the throat.
- **Gaps reduce the throat.** A root gap g between the parts reduces the effective throat to about a − g/√2.
  ISO 5817 limits the gap per quality level (chapter 7).
- **Deep penetration.** MAG spray arc and submerged-arc welding (SAW) penetrate beyond the root. EN 1993-1-8 allows the
  extra depth only if a procedure test proves it consistently. Without the test you design with the geometric throat.
- **Effective length.** EN 1993-1-8 takes the full length if the weld is full size over it (run-on / run-off or all
  round). Otherwise subtract 2a for the start and end craters. Welds shorter than max(30 mm, 6a) are not counted.

### 2.5 Stresses in the throat of a fillet weld

Take a T-joint. The attached plate pulls on the weld with a force per unit length. Split that force into:

- **f_⊥**, across the weld axis (normal to the attached plate, or in its plane across the weld), and
- **f_∥**, along the weld axis.

The design section is the **throat plane**. It runs at 45° through the root and has the thickness a per unit length.
Resolve f_⊥ into a component normal to that plane and one in the plane:

  σ_⊥ = f_⊥ · cos 45° / a        (normal stress on the throat)
  τ_⊥ = f_⊥ · sin 45° / a        (shear in the throat plane, across the weld)
  τ_∥ = f_∥ / a                   (shear in the throat plane, along the weld)

The equivalent stress of EN 1993-1-8 (4.1) is the von Mises form with the normal stress counted once:

  σ_eq = √(σ_⊥² + 3·(τ_⊥² + τ_∥²))  ≤  f_u / (β_w · γ_M2)       and       σ_⊥ ≤ 0.9 · f_u / γ_M2

```python
def wa_components(f_perp, f_par, a):
    """Force per unit length f_perp across the weld (normal to the attached plate) and f_par along it.
    The throat plane is at 45 deg: normal stress sigma_perp = f_perp cos45 / a, shear tau_perp = f_perp sin45 / a,
    tau_par = f_par / a. EN 1993-1-8: sigma_eq = sqrt(sigma_perp^2 + 3 (tau_perp^2 + tau_par^2))."""
    sp = f_perp * math.cos(math.pi / 4) / a
    tp = f_perp * math.sin(math.pi / 4) / a
    tl = f_par / a
    return {"sigma_perp": sp, "tau_perp": tp, "tau_par": tl, "sigma_eq": math.sqrt(sp * sp + 3 * (tp * tp + tl * tl))}
```

```
## 2.5 Stress components on the throat (f_perp 300 N/mm, f_par 200 N/mm, a 5 mm)
  sigma_perp 42.4, tau_perp 42.4, tau_par 40.0 MPa -> sigma_eq 109.5 MPa
```

The core program does exactly this at every check point of a weld group (`fillet_check()`, section 0.2). There f_⊥ is
the vector sum of the line force normal to the joint plane (f_n, from N and bending) and the in-plane component across
the weld (f_t, from shear and torsion). This is a safe simplification: it lets both act on the same 45° plane.

### 2.6 Directional and simplified method – the design capacity per mm of weld

EN 1993-1-8 offers two methods.

- **Directional method** (4.5.3.2): the formula above, with the components as they really are.
- **Simplified method** (4.5.3.3): the resultant force per length, divided by a, must stay below
  f_vw,d = f_u / (√3 · β_w · γ_M2), whatever its direction.

For a load at angle θ to the weld axis (θ = 0 along, θ = 90° across) the directional method gives

  F(θ) = f_u / (β_w · γ_M2) · a / √(3·cos²θ + 2·sin²θ)

because f_∥ = F cos θ contributes 3·cos²θ and f_⊥ = F sin θ contributes 1/2 + 3/2 = 2 times sin²θ. Across the weld
(θ = 90°) the capacity is √(3/2) = 1.22 times the capacity along it. The self-test of `weld.py` proves this (item 3).

```python
def wa_unit_capacity(steel, a, angles=(0, 30, 45, 60, 90)):
    """Design capacity per mm of weld for an in-plane load at angle theta to the weld axis (0 = along, 90 = across):
    directional F = (fu / (beta_w gM2)) a / sqrt(3 cos^2 + 2 sin^2), also sigma_perp <= 0.9 fu / gM2;
    simplified F = fu / (sqrt 3 beta_w gM2) a for every direction."""
    st = STEELS[steel]
    lim = st["fu"] / (st["beta_w"] * GAMMA_M2)
    lim2 = 0.9 * st["fu"] / GAMMA_M2
    fvw = lim / math.sqrt(3)
    rows = []
    for th in angles:
        c, s = math.cos(math.radians(th)), math.sin(math.radians(th))
        F = lim * a / math.sqrt(3 * c * c + 2 * s * s)
        F = min(F, lim2 * a * math.sqrt(2) / s) if s > 1e-12 else F
        rows.append((th, F, fvw * a))
    return {"lim": lim, "lim_perp": lim2, "fvw": fvw, "rows": rows}
```

```
## 2.6 Design capacity per mm of fillet weld, a 5 mm, by load angle (0 = along the weld)
  S235: limit fu/(beta_w gM2) 360 MPa, sigma_perp limit 259 MPa, f_vw,d 208 MPa
    theta  0 deg: directional   1039 N/mm, simplified   1039 N/mm (ratio 1.00)
    theta 30 deg: directional   1085 N/mm, simplified   1039 N/mm (ratio 1.04)
    theta 45 deg: directional   1138 N/mm, simplified   1039 N/mm (ratio 1.10)
    theta 60 deg: directional   1200 N/mm, simplified   1039 N/mm (ratio 1.15)
    theta 90 deg: directional   1273 N/mm, simplified   1039 N/mm (ratio 1.22)
  S355: limit fu/(beta_w gM2) 453 MPa, sigma_perp limit 367 MPa, f_vw,d 262 MPa
    theta  0 deg: directional   1309 N/mm, simplified   1309 N/mm (ratio 1.00)
    theta 30 deg: directional   1367 N/mm, simplified   1309 N/mm (ratio 1.04)
    theta 45 deg: directional   1434 N/mm, simplified   1309 N/mm (ratio 1.10)
    theta 60 deg: directional   1511 N/mm, simplified   1309 N/mm (ratio 1.15)
    theta 90 deg: directional   1603 N/mm, simplified   1309 N/mm (ratio 1.22)
```

**Correlation factor β_w.** The weld metal is not tested in every joint, so EN 1993-1-8 ties the weld strength to the
parent-metal f_u through β_w = 0.80 (S235) … 1.00 (S460) (table 4.1). It reflects the fact that the filler of higher
grades overmatches less. With the default S355: limit 510 / (0.9 · 1.25) = 453 MPa.

**Which method to use?** The simplified method is quicker and always safe. The directional method gives up to 22 %
more for welds loaded across, such as the post welded all round in the default case. For hand checks of large frames
use the simplified method first; switch to the directional method only where the weld is critical.

### 2.7 Full-strength fillet welds and butt welds

A weld is **full strength** when it is at least as strong as the plate it connects. Then the plate decides, and a
plastic hinge can form in the member before the weld fails. That is what designers of frames want (ductile failure).
For a double fillet T-joint loaded across:

  2 · a · (f_u / (β_w γ_M2)) / √2 ≥ t · f_y / γ_M0     →     a / t ≥ f_y · √2 / (2 · f_u / (β_w γ_M2))

```python
def wa_full_strength(steel):
    """Double fillet T-joint loaded across: weld capacity 2 a lim / sqrt 2 = plate capacity t fy / gM0
    -> a / t = fy sqrt 2 / (2 lim gM0) (full-strength fillet)."""
    st = STEELS[steel]
    lim = st["fu"] / (st["beta_w"] * GAMMA_M2)
    return st["fy"] / GAMMA_M0 * math.sqrt(2) / (2 * lim)
```

```python
def wa_butt(steel, t, a_nom=None, angle_deg=60):
    """Full-penetration butt: same design resistance as the weaker base plate (matching filler). Partial penetration:
    designed like a deep-penetration fillet with a = prepared depth (minus 2 mm when the groove angle < 60 deg, check)."""
    st = STEELS[steel]
    full = t * st["fy"] / GAMMA_M0
    if a_nom is None:
        return {"full_N_per_mm": full}
    a = a_nom - (2.0 if angle_deg < 60 else 0.0)
    lim = st["fu"] / (st["beta_w"] * GAMMA_M2)
    return {"full_N_per_mm": full, "a_eff": a, "partial_N_per_mm": 2 * a * lim / math.sqrt(2), "ratio": 2 * a * lim / math.sqrt(2) / full}
```

```
## 2.7 Full-strength double fillet (T-joint across) and butt welds
  S235: a / t = 0.462
  S275: a / t = 0.480
  S355: a / t = 0.554
  S460: a / t = 0.753
  S355 t 10: full-penetration butt 3550 N/mm; HV partial 6 mm at 45 deg -> a_eff 4.0 mm, both sides 2564 N/mm (72 % of full)
```

So "a = 0.5 t on both sides" is a good rule for S235–S355. S460 needs about 0.75 t, which is why high-strength
steels are often joined with full-penetration K welds. A partial-penetration HV weld of 6 mm on a 10 mm plate (45°
groove, therefore 2 mm deducted) carries 72 % of the plate. This is fine statically, but its root is a crack for
fatigue (FAT 36 on the throat, chapter 4).

### 2.8 Throat thickness rules – and the 4 mm tube of the default

The strength calculation gives a minimum throat. Practical rules add limits the calculation does not see:

| Rule | Reason |
|---|---|
| a ≥ 3 mm (EN 1993-1-8 4.5.2) | a smaller fillet is not reliably made by hand; root fusion uncertain |
| a ≥ √t_max − 0.5 (DIN 18800 / national practice, check) | a too-small weld on a thick plate cools too fast (hard HAZ, cold cracks) |
| a ≤ 0.7 · t_min (DIN 18800 practice, check) | a too-large weld on a thin plate burns through and distorts; it is also useless because the plate is weaker |
| length ≥ max(30 mm, 6a) | short welds are mostly start and end craters |

```python
def wa_throat_conflict(t_tube_list=(3.0, 4.0, 5.0, 6.0), t_plate=10.0):
    """The practical rules a >= max(3, sqrt(t_max) - 0.5) and a <= 0.7 t_min cannot both hold for thin tube walls."""
    rows = []
    for t in t_tube_list:
        P = dict(DEFAULT, t_max=t_plate, t_min=t, a=3.0)
        r = throat_rules(P)
        rows.append((t, r["a_min"], r["a_max"], r["a_min"] <= r["a_max"]))
    return rows
```

```
## 2.8 Throat rules - tube wall vs a >= 3 mm (base plate 10 mm)
  tube t 3 mm: a_min 3.00, a_max = 0.7 t 2.10 -> CONFLICT
  tube t 4 mm: a_min 3.00, a_max = 0.7 t 2.80 -> CONFLICT
  tube t 5 mm: a_min 3.00, a_max = 0.7 t 3.50 -> possible
  tube t 6 mm: a_min 3.00, a_max = 0.7 t 4.20 -> possible
  default joint with RHS 80x80x4: utilisation 0.024, rules a_max 2.80 -> NOT OK
```

This is exactly what happened to the first version of the default. The motor bracket post was an RHS 80 × 80 × 4,
welded with a = 3 mm to a 10 mm base plate. The rule "a ≥ 3 mm" and the rule "a ≤ 0.7 · 4 = 2.8 mm" cannot both be
met. There are three ways out:

1. **Thicker tube wall** – RHS 80 × 80 × 5 (a_max 3.5 mm). This is what the default uses now. It costs about 2.2 kg per
   metre of post.
2. **Accept a = 3 mm on the 4 mm wall** with a qualified procedure (short-arc MAG, controlled heat input). EN 1993-1-8
   itself has only the 3 mm minimum. The 0.7·t limit is a workmanship rule, and many fabricators weld a = t on thin
   tubes.
3. **a = 2.8 mm** and accept the rule deviation in the WPS (welding procedure specification, chapter 7) – only with
   procedure qualification.

The strength is never the problem here: the utilisation is 0.024 for either tube.

### 2.9 Long joints

In a long lap joint the welds near the ends carry more than those in the middle, because the plates stretch. EN 1993-1-8
4.11 reduces the strength of lap joints longer than 150a:

  β_Lw,1 = 1.2 − 0.2 · L_j / (150 · a),   0.6 ≤ β_Lw,1 ≤ 1.0

```python
def wa_long_joint(Lj, a):
    """EN 1993-1-8 4.11: lap joints longer than 150 a: beta_Lw,1 = 1.2 - 0.2 Lj / (150 a), 0.6 <= beta <= 1.0."""
    return max(0.6, min(1.0, 1.2 - 0.2 * Lj / (150 * a)))
```

```
## 2.9 Long lap joints (a 5 mm)
  Lj  500 mm (0.7 x 150a): beta_Lw 1.000
  Lj  750 mm (1.0 x 150a): beta_Lw 1.000
  Lj 1000 mm (1.3 x 150a): beta_Lw 0.933
  Lj 1500 mm (2.0 x 150a): beta_Lw 0.800
  Lj 2500 mm (3.3 x 150a): beta_Lw 0.600
```

It does not apply when the stress along the weld is the same as in the parent plate (for example the web-to-flange
welds of a girder). It applies to long lap splices and long gusset connections.

---

## 3. Weld groups and welded frames: line method, eccentric loads, welded members, frame design and stiffness

### 3.1 The line method

A real weld group is a set of thin strips of thickness a. Because a is small compared with the dimensions of the group,
we treat every weld as a **line** with "unit throat". All section properties are then per unit throat, with units
mm (length), mm³ (second moments). The forces come out **per unit length** (N/mm); divide by a for stresses.

For a straight line from (x₁, y₁) to (x₂, y₂) of length L, measured from the group centroid:

  ∫ x² dl = L · (x₁² + x₁x₂ + x₂²) / 3      ∫ y² dl = L · (y₁² + y₁y₂ + y₂²) / 3

This is exact for a straight line (the integrand is a quadratic). The core sums it over all lines:

```python
def group_props(lines):
    """Line method (unit throat): length A_l, centroid, I_x = sum int y^2 dl, I_y = sum int x^2 dl about the centroid,
    I_p = I_x + I_y (mm, mm^3)."""
    L = [math.hypot(x2 - x1, y2 - y1) for x1, y1, x2, y2 in lines]
    A = sum(L)
    ...
        Iy += l * (a1 * a1 + a1 * a2 + a2 * a2) / 3                 # exact integral of a straight line
        Ix += l * (b1 * b1 + b1 * b2 + b2 * b2) / 3
```

The line forces follow the beam formulas, applied to the "section" made by the welds:

  normal to the joint plane:  f_n = N / A_l + M_x · y / I_x − M_y · x / I_y
  in plane (shear + torsion):  f_x = V_x / A_l − T · y / I_p,     f_y = V_y / A_l + T · x / I_p

Then f_x, f_y are split into the part along the weld line (f_∥ = f_l) and across it (f_t) using the line direction.
`line_forces()` does that at 11 points per line (default `n_points`). The assumption behind the formulas is the
classical one: the welded part is rigid, and the welds deform elastically in proportion to their distance from the
centroid (the "elastic method").

**Warning – principal axes.** The formulas use I_x and I_y separately. That is correct only if the product moment
I_xy is zero, which holds for groups symmetric about one axis. For an L-shaped group I_xy ≠ 0; rotate to the principal
axes or apply the moments as bending about the principal axes.

### 3.2 Catalogue of weld groups

```python
def wa_catalog(b=80.0, d=120.0):
    """Line-method properties of common weld shapes (b width in x, d height in y), computed by group_props and compared
    with textbook formulas where they exist."""
    shapes = {
        "single vertical line": ([[0, 0, 0, d]], {"Ix": d ** 3 / 12}),
        "two vertical lines": ([[0, 0, 0, d], [b, 0, b, d]], {"Ix": d ** 3 / 6, "Iy": b * b * d / 2}),
        "two horizontal lines": ([[0, 0, b, 0], [0, d, b, d]], {"Ix": b * d * d / 2, "Iy": b ** 3 / 6}),
        "box (all round)": ([[0, 0, b, 0], [b, 0, b, d], [b, d, 0, d], [0, d, 0, 0]], {"Ix": b * d * d / 2 + d ** 3 / 6, "Iy": d * b * b / 2 + b ** 3 / 6}),
        "C (open right)": ([[b, 0, 0, 0], [0, 0, 0, d], [0, d, b, d]], {"Ix": b * d * d / 2 + d ** 3 / 12}),
        "L (bottom + left)": ([[b, 0, 0, 0], [0, 0, 0, d]], {}),
    }
    out = []
    for name, (lines, ref) in shapes.items():
        G = group_props(lines)
        out.append((name, G, ref))
    return out
```

```
## 3.1 Weld group catalog (b 80, d 120; line method, mm / mm^3)
  single vertical line   L  120, centroid (  0.0,  60.0), Ix   144000, Iy        0, Ip   144000  Ix textbook 144000
  two vertical lines     L  240, centroid ( 40.0,  60.0), Ix   288000, Iy   384000, Ip   672000  Ix textbook 288000, Iy textbook 384000
  two horizontal lines   L  160, centroid ( 40.0,  60.0), Ix   576000, Iy    85333, Ip   661333  Ix textbook 576000, Iy textbook 85333
  box (all round)        L  400, centroid ( 40.0,  60.0), Ix   864000, Iy   469333, Ip  1333333  Ix textbook 864000, Iy textbook 469333
  C (open right)         L  280, centroid ( 22.9,  60.0), Ix   720000, Iy   195048, Ip   915048  Ix textbook 720000
  L (bottom + left)      L  200, centroid ( 16.0,  36.0), Ix   316800, Iy   119467, Ip   436267  
```

Every value that has a textbook formula agrees exactly (single line d³/12, two lines d³/6 and b²d/2, box
bd²/2 + d³/6, C-shape bd²/2 + d³/12). Look at the C-shape: its centroid is only 22.9 mm from the vertical weld, so a
load applied at the free end has a much longer lever arm than you might expect. The L-shape has I_xy ≠ 0 (see the
warning above).

### 3.3 Eccentric shear – the classic bracket

A plate bracket is welded to a column flange with a C-shaped fillet weld: two horizontal welds of length b and one
vertical weld d along the column face. A vertical load P acts at a distance e beyond the free ends of the horizontal
welds. Moved to the weld centroid, it becomes a direct shear V = P plus a torsion T = P · (e + b − x_c):

```python
def wa_bracket(B=None):
    """Classic eccentric shear: plate bracket welded to a column flange with a C-shaped fillet weld (two horizontal
    lines b, one vertical d at the column face); vertical load P at distance e from the weld centroid -> V = P, T = P e."""
    B = dict(WA_BRACKET if B is None else B)
    b, d = B["b"], B["d"]
    lines = [[b, 0, 0, 0], [0, 0, 0, d], [0, d, b, d]]
    G = group_props(lines)
    T = -B["P"] * (B["e"] + (b - G["xc"])) / 1000          # load acts e beyond the free ends of the horizontal welds
    P = dict(DEFAULT, lines=lines, a=B["a"], steel=B["steel"], t_min=10.0, t_max=20.0,
             loads={"N": 0.0, "Vx": 0.0, "Vy": -B["P"], "Mx": 0.0, "My": 0.0, "T": T})
    F = fillet_check(P)
    return {"G": G, "T_Nm": T, "F": F, "lever": B["e"] + (b - G["xc"])}
```

```
## 3.2 Eccentric bracket (C weld b 80 / d 150, a 5, P 12 kN at e 200 mm)
  centroid x 20.6 mm from the column face, lever 259.4 mm, T -3112 N m
  worst point (80, 0): f_t 172, f_l 168 N/mm -> sigma_eq 76 MPa, utilisation 0.167 (simplified 0.183)
  same corner: area method tau 38.5 MPa, line method 38.5 MPa (+0.1 %)
  a 4 mm: utilisation 0.209
  a 5 mm: utilisation 0.167
  a 6 mm: utilisation 0.139
```

The worst point is the free end of a horizontal weld, farthest from the centroid, where torsion and direct shear add
up. The utilisation is 0.167 with a = 5 mm, so a = 4 mm would also do (0.209). In practice the minimum throat rules
of section 2.8 and the plate thickness (10 mm) decide.

**Line method or area method?** The older "area method" treats each weld as a rectangle of thickness a and includes
the polar moment of the rectangles about their own centres:

```python
def wa_area_method(B=None):
    """Elastic area method: the welds are thin rectangles of thickness a (throat turned into the plane); polar moment
    includes their own thickness. Compare with the line method (a -> 0)."""
    B = dict(WA_BRACKET if B is None else B)
    b, d, a = B["b"], B["d"], B["a"]
    G = group_props([[b, 0, 0, 0], [0, 0, 0, d], [0, d, b, d]])
    xc, yc = G["xc"], G["yc"]
    rects = [(b / 2, 0.0, b, a), (0.0, d / 2, a, d), (b / 2, d, b, a)]   # centre x, y, width, height
    A = sum(w * h for _, _, w, h in rects)
    Ip = sum(w * h * ((cx - xc) ** 2 + (cy - yc) ** 2) + w * h * (w * w + h * h) / 12 for cx, cy, w, h in rects)
    T = B["P"] * (B["e"] + (b - xc))
    r = math.hypot(b - xc, d - yc)                          # farthest corner (free end of a horizontal weld)
    rx, ry = b - xc, d - yc
    tx, ty = -T * ry / Ip, T * rx / Ip - B["P"] / A          # torsion + direct shear (load downwards)
    tau_area = math.hypot(tx, ty)
    # line method at the same corner, stress = force per length / a
    fx, fy = -T * ry / G["Ip"], T * rx / G["Ip"] - B["P"] / G["A_l"]
    tau_line = math.hypot(fx, fy) / a
    return {"tau_area": tau_area, "tau_line": tau_line, "diff_pct": 100 * (tau_line / tau_area - 1), "r": r}
```

The result (in the output above) differs by only 0.1 %. The line method is the same thing with a → 0, and it is
simpler to program and to read.

**Instantaneous centre of rotation (ICR).** The elastic method assumes linear behaviour. In reality the most loaded
weld points yield and the load redistributes, so the real capacity of an eccentric group is higher – typically
20–50 % for brackets. The AISC steel manual tabulates ICR coefficients for standard shapes. The European codes stay
with the elastic method for fillet welds, so `weld.py` does too. The ICR method is a reserve, not a design basis here.

### 3.4 Combined bending and torsion – the default post

The motor bracket post (section 1) is a tube welded all round: a box group 80 × 80. The belt pull acts 250 mm above
the weld, so the weld sees shear V_x, bending M_y and – because the belt line is 60 mm off the tube axis – torsion T.
The motor weight gives a small compression N. The core report:

```
## Weld group (line method, unit throat)
- length 320 mm, centroid (40.0, 40.0), I_x 341333 mm3, I_y 341333 mm3, I_p 682667 mm3
- worst point line 0 at (80.0, 0.0): f_n -21.9, f_t 2.4, f_l 4.5 N/mm -> sigma_perp = tau_perp 5.2, tau_par 1.5, equivalent 10.7 MPa
- directional method: limit 453 MPa (perp. 367) -> utilisation 0.024; simplified method f_vw,d 262 MPa -> utilisation 0.029
- throat rules: a_min 3.00 (OK), a_max 0.7 t_min 3.50 (OK), weld length >= 30 mm (OK)
```

The bending moment dominates: f_n = −21.9 N/mm at the corner, against only a few N/mm from shear and torsion.
That is typical for posts and brackets: **bending gives the largest weld forces, not shear.**

### 3.5 The welded member and the base plate

The weld transfers the load into the member and into the plate it is welded to. Both must be checked.

**Member.** `rhs()` and `member_check()` give the stresses in the tube right at the weld (σ from N and M, τ from T and
V, von Mises), see the core report. With an RHS 80 × 80 × 5 the utilisation is 0.017.

**Base plate.** The tube wall pushes and pulls on the base plate with the line force f_n. Between the tube and the
bolts the plate acts as a short cantilever. With the plastic moment m_pl = t² f_y / 4 per unit width:

  m = f_n · c ≤ t² · f_y / (4 γ_M0)     →     t_req = √(4 · f_n · c · γ_M0 / f_y)

```python
def wa_base_plate(f_line, c, steel="S355", gamma=1.0):
    """Local bending of the base plate under the tube wall: line load f (N/mm) on a cantilever c (mm) to the support /
    bolt line; m = f c, plastic capacity m_pl = t^2 fy / 4 -> t_req = sqrt(4 f c gamma / fy)."""
    fy = STEELS[steel]["fy"]
    return math.sqrt(4 * f_line * c * gamma / (fy / GAMMA_M0))
```

```
## 3.3 Default post: line forces and base plate
  max normal line force 21.9 N/mm; base plate cantilever 30 mm -> t_req 2.7 mm (10 mm used)
  RHS 80x80x5: sigma 5.2, tau 1.6 MPa, utilisation 0.017
```

A 10 mm plate is far more than needed for strength. It is chosen for **stiffness** (a thin plate lets the post rock
on its bolts and changes the belt tension) and for **welding** (a ≥ √t − 0.5 is still 3 mm).

**Stiffeners and gussets.** Where a base plate is too thin or a joint too flexible, triangular gussets are welded
between member and plate. Rules of good practice:

- Cut the corners of the gusset (snipe 15–20 mm) so that it does not sit on the member-plate weld.
- Avoid ending a gusset in the middle of a highly stressed plate. Its end is a FAT 56–71 detail (chapter 4).
- Weld gussets on both sides (no one-sided fillets with an open root under bending).
- Stop the weld 10 mm short of free plate edges, or wrap it around the end with care.

### 3.6 The compressor base frame – strength, stiffness and natural frequency

The compressor (75 kg) and the motor (32 kg) stand on a welded frame of two channel beams (UPN 100, S235) on four
mounts. For a frame like this, **strength is rarely the question**. The questions are: does it deflect so little that
the belt alignment holds (L/500), and is its natural frequency away from the compressor orders (24.1 Hz and 48.2 Hz)?

```python
def wa_frame(F=None, sec=None):
    """Two UPN 100 beams on two supports (span L) carry compressor + motor at mid-span (worst case): bending, deflection
    L/500, natural frequency of the mass on the beam springs k = 48 E I / L^3 compared with the compressor orders."""
    F = dict(WA_FRAME if F is None else F)
    s = dict(WA_UPN100 if sec is None else sec)
    m = F["m_compressor"] + F["m_motor"]
    W = m * 9.81 * 1.5                                      # factored, includes dynamic allowance
    M = W / F["n_beams"] * F["L"] / 4                       # N mm per beam
    sig = M / s["Wy"]
    w = (m * 9.81 / F["n_beams"]) * F["L"] ** 3 / (48 * F["E"] * s["Iy"])
    k = F["n_beams"] * 48 * F["E"] * s["Iy"] / F["L"] ** 3 * 1000      # N/m
    m_eff = m + 0.5 * F["m_frame"]
    fn = math.sqrt(k / m_eff) / (2 * math.pi)
    return {"W": W, "sigma": sig, "util": sig / (STEELS["S235"]["fy"] / GAMMA_M0), "w": w, "w_lim": F["L"] / 500, "k": k, "fn": fn,
            "ratios": [fo / fn for fo in F["f_orders"]]}
```

```
## 3.4 Compressor base frame (2 x UPN 100, span 900 mm, compressor + motor 107 kg at mid-span)
  factored load 1575 N, sigma 4.3 MPa (S235 utilisation 0.018), deflection 0.018 mm vs L/500 1.8 mm
  stiffness 5.7e+07 N/m, natural frequency 109 Hz; orders 24.1 / 48.2 Hz -> ratio 0.22 / 0.44
    span  900 mm: f_n 108.8 Hz (ratio to 24.1 Hz 0.22)
    span 1500 mm: f_n  50.5 Hz (ratio to 24.1 Hz 0.48)
    span 2500 mm: f_n  23.5 Hz (ratio to 24.1 Hz 1.03)
  frame leg RHS 60x60x4, cantilever 600 mm (L_cr 1200): N_cr 677 kN, lambda 0.56, chi 0.905, N_b,Rd 191 kN, utilisation 0.012
    L_cr 1200 mm: lambda 0.56, chi 0.905
    L_cr 3000 mm: lambda 1.39, chi 0.421
    L_cr 5000 mm: lambda 2.32, chi 0.169
```

With a span of 900 mm the frame is stiff (109 Hz, well above the 2nd order). Stretch the same frame to 2.5 m – for
example to put the receiver on it as well – and its natural frequency drops to 23.5 Hz, right on the 1st order. The
frame would then resonate and the welds would see thousands of times larger stress ranges. **Every frame that
carries a machine needs this frequency check.**

**Columns and legs.** Compression members must be checked for flexural buckling (EN 1993-1-1 6.3.1). The non-dimensional
slenderness λ̄ = √(A f_y / N_cr) gives the reduction factor χ through the buckling curve. Hot-finished hollow sections
use curve a (α = 0.21):

```python
def wa_column(N_Ed, L_cr, sec, steel="S235", alpha=0.21):
    """EN 1993-1-1 6.3.1 flexural buckling: lambda_bar = sqrt(A fy / N_cr), phi = 0.5 (1 + alpha (lam - 0.2) + lam^2),
    chi = 1 / (phi + sqrt(phi^2 - lam^2)) <= 1; N_b,Rd = chi A fy / gM1 (gM1 = 1.0). alpha 0.21 = curve a (hot-finished RHS)."""
    fy = STEELS[steel]["fy"]
    I = min(sec["Ix"], sec["Iy"])
    Ncr = math.pi ** 2 * 210000.0 * I / L_cr ** 2
    lam = math.sqrt(sec["A"] * fy / Ncr)
    phi = 0.5 * (1 + alpha * (lam - 0.2) + lam * lam)
    chi = min(1.0, 1 / (phi + math.sqrt(phi * phi - lam * lam)))
    Nb = chi * sec["A"] * fy
    return {"Ncr": Ncr, "lam": lam, "phi": phi, "chi": chi, "Nb_Rd": Nb, "util": N_Ed / Nb}
```

The frame leg (RHS 60 × 60 × 4, 600 mm cantilever, buckling length 1.2 m) has χ = 0.905 and a utilisation of 0.012.
The study in the output shows how fast χ drops with the buckling length (0.42 at 3 m, 0.17 at 5 m).

### 3.7 Vibration isolation mounts

A compressor shakes. M2 gives a free shaking force of up to 264 N at the 1st order (24.1 Hz). Bolted rigidly to the
floor, this force goes into the building. Rubber mounts with a low natural frequency isolate it. With frequency ratio
r = f_excitation / f_n and damping ratio ζ the force transmissibility is

  T = √( (1 + (2ζr)²) / ((1 − r²)² + (2ζr)²) )

Isolation starts at r > √2. A common target is r ≈ 3, which gives about 87 % isolation:

```python
def wa_transmissibility(r, zeta):
    """Force transmissibility of a spring-damper mount: T = sqrt((1 + (2 zeta r)^2) / ((1 - r^2)^2 + (2 zeta r)^2)), r = f / f_n."""
    return math.sqrt((1 + (2 * zeta * r) ** 2) / ((1 - r * r) ** 2 + (2 * zeta * r) ** 2))
```

```python
def wa_mounts(F=None, ratio=3.0):
    """Choose 4 rubber mounts so that f_n = f_exc / ratio for the 1st compressor order; transmitted shaking force."""
    F = dict(WA_FRAME if F is None else F)
    m = F["m_compressor"] + F["m_motor"] + F["m_frame"]
    fn = F["f_orders"][0] / ratio
    k_tot = m * (2 * math.pi * fn) ** 2
    T1 = wa_transmissibility(ratio, F["zeta_mount"])
    T2 = wa_transmissibility(2 * ratio, F["zeta_mount"])
    return {"m": m, "fn": fn, "k_each": k_tot / F["n_mounts"], "static_defl_mm": m * 9.81 / k_tot * 1000, "T1": T1, "T2": T2,
            "F_transmitted": F["F_shake"] * T1}
```

```
## 3.5 Vibration isolation mounts (4 mounts, f_n = 24.1 / 3 Hz)
  mass 137 kg, f_n 8.0 Hz, k 87 N/mm per mount, static deflection 3.9 mm
  transmissibility order 1 0.130, order 2 0.033 -> shaking force 264 N becomes 34 N on the floor
    r 0.50: T 1.332
    r 1.00: T 10.050
    r 1.41: T 1.012
    r 2.00: T 0.339
    r 3.00: T 0.130
    r 5.00: T 0.047
```

Consequences for the design:

- 4 mounts of about 87 N/mm, sagging 3.9 mm under the weight. Only 34 N of the 264 N reach the floor.
- During start and stop the machine passes through f_n = 8 Hz, where T = 10. The mounts need damping, and the
  start-up must be quick (a 3 kW motor runs up in about 1 s).
- **The frame must be stiff when the mounts are soft.** If the frame itself had a resonance near 24 Hz (span 2.5 m
  above), the isolation would be destroyed. Rule: frame natural frequency ≥ 2 × the highest relevant order.
- Flexible connections (hose for the air outlet, flexible conduit for the cable) are needed, or the pipes become the
  path of the vibration – and their welds fail in fatigue.

---

## 4. Fatigue of welded structures: detail categories, S-N curves, cut-off, Miner, spectra, thickness and mean stress, hot-spot and notch methods, improvement techniques

### 4.1 Why welds fail in fatigue – and why only the stress range counts

Almost all failures of welded machine frames are fatigue cracks. They start at the **weld toe** (the sharp transition
from weld face to plate) or at the **root** of a fillet weld (the unwelded gap). Three reasons:

1. **Notch.** The toe has a local stress concentration of 2–4. The root of a fillet is a crack-like slit.
2. **Initial defects.** Every weld toe has small slag intrusions and undercut of 0.1–0.4 mm. The crack does not have
   to start; it only has to grow. The "initiation" life that a smooth part has is missing.
3. **Residual stress.** The weld shrinks on cooling and leaves tensile residual stresses up to the yield strength at
   the toe. Whatever the applied mean stress is, the local stress cycles between yield and yield minus the range.

Consequence: **for as-welded joints only the stress range Δσ = σ_max − σ_min counts, not the mean stress.** A
pulsating load (0 → 100 MPa) and an alternating load (−50 → +50 MPa) give the same life. The steel grade does not help
either: an S690 weld has the same FAT class as an S235 weld. High-strength steel only pays in fatigue if the weld
is improved (section 4.8) or the detail is placed in a low-stressed zone.

### 4.2 Detail categories (FAT)

The detail category (EN 1993-1-9) or FAT class (IIW) is the stress range in MPa that the detail survives for
**2·10⁶ cycles** with 97.7 % survival probability. It is read from catalogues with sketches. The stress is the
**nominal stress** in the member at the detail (beam theory), not a peak value – the notch effect is in the FAT class.

```python
WA_FAT_EXT = [   # detail, FAT, failure location, note (EN 1993-1-9 / IIW style - check the exact detail sketches)
    ("rolled plate, machined / ground edges", 160, "base metal", "reference: no weld"),
    ("flame-cut edge, quality per EN 1090", 140, "edge", "machine flame cutting"),
    ("continuous longitudinal fillet / butt weld, automatic, no stop-start", 125, "weld", "girder webs"),
    ("continuous longitudinal fillet, manual / with stop-starts", 100, "weld toe at stop", ""),
    ("transverse butt weld, ground flush, 100 % NDT", 112, "weld", "best transverse joint"),
    ("transverse butt weld, as welded, both sides", 90, "toe", "weld reinforcement <= 10 % of the width"),
    ("transverse butt weld on backing strip", 71, "root", "permanent backing bar"),
    ("intermittent longitudinal fillet weld", 80, "toe at weld end", ""),
    ("transverse non-load-carrying attachment (stiffener), t <= 25", 80, "toe", "gussets, stiffeners"),
    ("cruciform / T, load-carrying, full penetration K-butt", 71, "toe", "load passes through the weld"),
    ("longitudinal attachment L = 50 ... 100 mm", 71, "toe at the end", "lugs welded along a member"),
    ("longitudinal attachment L > 100 mm", 56, "toe at the end", "long gussets"),
    ("cover plate end, t_c <= 20 mm", 56, "toe", "reinforcing plates - avoid in fatigue"),
    ("RHS welded to end plate, fillet, t <= 8", 40, "toe in the tube", "the bracket post of the default"),
    ("load-carrying fillet weld, throat (root)", 36, "root / throat", "partial penetration T-joints"),
    ("fillet weld throat in shear (m = 5)", 80, "throat", "longitudinal shear"),
    ("hot-spot, load-carrying fillet (structural stress)", 90, "toe", "IIW structural hot-spot method"),
    ("hot-spot, non-load-carrying fillet", 100, "toe", "IIW structural hot-spot method"),
    ("effective notch, r = 1 mm (principal stress)", 225, "toe / root", "IIW notch method, t >= 5 mm"),
]
```

```
## 4.1 Detail categories (extended)
  FAT 160  rolled plate, machined / ground edges                              base metal         reference: no weld
  FAT 140  flame-cut edge, quality per EN 1090                                edge               machine flame cutting
  FAT 125  continuous longitudinal fillet / butt weld, automatic, no stop-start weld               girder webs
  FAT 100  continuous longitudinal fillet, manual / with stop-starts          weld toe at stop   
  FAT 112  transverse butt weld, ground flush, 100 % NDT                      weld               best transverse joint
  FAT  90  transverse butt weld, as welded, both sides                        toe                weld reinforcement <= 10 % of the width
  FAT  71  transverse butt weld on backing strip                              root               permanent backing bar
  FAT  80  intermittent longitudinal fillet weld                              toe at weld end    
  FAT  80  transverse non-load-carrying attachment (stiffener), t <= 25       toe                gussets, stiffeners
  FAT  71  cruciform / T, load-carrying, full penetration K-butt              toe                load passes through the weld
  FAT  71  longitudinal attachment L = 50 ... 100 mm                          toe at the end     lugs welded along a member
  FAT  56  longitudinal attachment L > 100 mm                                 toe at the end     long gussets
  FAT  56  cover plate end, t_c <= 20 mm                                      toe                reinforcing plates - avoid in fatigue
  FAT  40  RHS welded to end plate, fillet, t <= 8                            toe in the tube    the bracket post of the default
  FAT  36  load-carrying fillet weld, throat (root)                           root / throat      partial penetration T-joints
  FAT  80  fillet weld throat in shear (m = 5)                                throat             longitudinal shear
  FAT  90  hot-spot, load-carrying fillet (structural stress)                 toe                IIW structural hot-spot method
  FAT 100  hot-spot, non-load-carrying fillet                                 toe                IIW structural hot-spot method
  FAT 225  effective notch, r = 1 mm (principal stress)                       toe / root         IIW notch method, t >= 5 mm
```

Reading the catalogue: the same plate is FAT 160 without a weld, FAT 80 with a stiffener welded across, FAT 56 with a
long gusset welded along, and FAT 36 if the load passes through the throat of a fillet weld. **Choosing the detail is
the strongest design decision for fatigue** – far stronger than choosing the steel or the plate thickness. Check the
sketches in the code: the FAT values above are typical and some depend on dimensions.

### 4.3 The S-N curve

EN 1993-1-9 describes the curve in three parts (core function `sn_cycles()`):

  N = 2·10⁶ · (Δσ_C / Δσ)³                for Δσ ≥ Δσ_D = (2/5)^(1/3) · Δσ_C = 0.737 · Δσ_C   (N ≤ 5·10⁶)
  N = 5·10⁶ · (Δσ_D / Δσ)⁵                for Δσ_L < Δσ < Δσ_D                                   (N ≤ 10⁸)
  N = ∞                                   for Δσ ≤ Δσ_L = (5/100)^(1/5) · Δσ_D = 0.405 · Δσ_C     (cut-off)

For shear (Δτ) the curve has the single slope m = 5 down to the cut-off at 10⁸ cycles (Δτ_L = 0.457 · Δτ_C).

The **constant-amplitude fatigue limit** Δσ_D at 5·10⁶ cycles applies when *all* cycles are below it. If some
cycles are above, the cracks grow and the smaller cycles help them grow too: that is why the curve continues with
slope 5 instead of becoming horizontal. Below the **cut-off** Δσ_L the cycles do no damage at all.

```python
def wa_sn_table(fats=(160, 112, 90, 80, 71, 56, 40, 36), N_list=(1e5, 2e6, 5e6, 1e8)):
    """Allowable range at N cycles for each FAT (inverse of sn_cycles, normal stress)."""
    def rng(fat, N):
        dD = fat * 0.4 ** (1 / 3)
        if N <= 5e6:
            return fat * (2e6 / N) ** (1 / 3)
        if N <= 1e8:
            return dD * (5e6 / N) ** (1 / 5)
        return dD * (5e6 / 1e8) ** (1 / 5)
    return [(fat, [rng(fat, N) for N in N_list]) for fat in fats]
```

```
## 4.2 Allowable stress range [MPa] at N = 1e5 / 2e6 / 5e6 / >= 1e8
  FAT 160:  434.3  160.0  117.9   64.8
  FAT 112:  304.0  112.0   82.5   45.3
  FAT  90:  244.3   90.0   66.3   36.4
  FAT  80:  217.2   80.0   58.9   32.4
  FAT  71:  192.7   71.0   52.3   28.7
  FAT  56:  152.0   56.0   41.3   22.7
  FAT  40:  108.6   40.0   29.5   16.2
  FAT  36:   97.7   36.0   26.5   14.6
```

The design check is Miner's sum with partial factors:

  D = Σ nᵢ / Nᵢ(γ_Ff · γ_Mf · Δσᵢ) ≤ 1.0

The core `fatigue()` applies this to the load blocks of the default bracket.

### 4.4 Variable amplitude – rainflow counting, equivalent range and Miner variants

Real stress histories are not sine waves. To count cycles from a measured or simulated signal, use **rainflow
counting** (ASTM E1049). It pairs every reversal with the one that closes the largest loop, so that each counted
cycle corresponds to a closed stress–strain hysteresis loop in the material:

```python
def wa_rainflow(series):
    """Rainflow counting (ASTM E1049 three-point method): returns [(range, mean, count)], count 1.0 or 0.5."""
    # reduce to turning points
    tp = []
    for x in series:
        if tp and x == tp[-1]:
            continue
        if len(tp) >= 2 and (tp[-1] - tp[-2]) * (x - tp[-1]) > 0:
            tp[-1] = x
        else:
            tp.append(x)
    out, stack = [], []
    for x in tp:
        stack.append(x)
        while len(stack) >= 3:
            X = abs(stack[-1] - stack[-2])
            Y = abs(stack[-2] - stack[-3])
            if X < Y:
                break
            if len(stack) == 3:
                out.append((Y, (stack[-2] + stack[-3]) / 2, 0.5))
                stack.pop(0)
            else:
                out.append((Y, (stack[-2] + stack[-3]) / 2, 1.0))
                last = stack.pop()
                stack.pop()
                stack.pop()
                stack.append(last)
    for a, b in zip(stack, stack[1:]):
        out.append((abs(b - a), (a + b) / 2, 0.5))
    return out
```

```
## 4.3 Rainflow counting of a stress history at a weld toe
  signal: [0, 60, -10, 40, 5, 80, -20, 30, 10, 70, -15, 20, 0] MPa
  range 100.0 MPa, mean  30.0, count 0.5
  range  90.0 MPa, mean  35.0, count 0.5
  range  90.0 MPa, mean  25.0, count 0.5
  range  85.0 MPa, mean  27.5, count 0.5
  range  70.0 MPa, mean  25.0, count 0.5
  range  60.0 MPa, mean  30.0, count 0.5
  range  35.0 MPa, mean  22.5, count 1.0
  range  35.0 MPa, mean   2.5, count 0.5
  range  20.0 MPa, mean  20.0, count 1.0
  range  20.0 MPa, mean  10.0, count 0.5
  repeated 1e6 times, FAT 71: equivalent range at 2e6 98.2 MPa; damage EN 2.577, Haibach 2.579, elementary 2.643
```

How to read it: the history contains one big cycle of 100 MPa range (from −20 to 80), counted as half cycles here
because the short sample does not close it. For a history that repeats, start the counting at the absolute maximum,
then all residual half cycles close. Five of the ten counted ranges are 70 MPa or more.

**Equivalent range.** A spectrum can be replaced by one constant range at 2·10⁶ cycles that gives the same damage
with a single slope m = 3:

  Δσ_E,2 = (Σ nᵢ Δσᵢ³ / 2·10⁶)^(1/3)

```python
def wa_equivalent_range(blocks, m=3, N_ref=2e6):
    """Equivalent constant-amplitude range at N_ref (single slope m): d_E = (sum n_i d_i^m / N_ref)^(1/m)."""
    return (sum(n * d ** m for d, n in blocks) / N_ref) ** (1 / m)
```

For this history repeated 10⁶ times, Δσ_E,2 = 98 MPa, which is far above FAT 71. The joint would fail (D = 2.6).

**Which damage model?** `wa_miner()` compares three S-N models:

```python
def wa_miner(blocks, fat, variant="EN"):
    """Damage of a spectrum [(range, n)] with four S-N models: EN (3/5 + cut-off), Haibach (3, then 5 without cut-off),
    no cut-off ... same as Haibach here, elementary (slope 3 down to zero)."""
    dD = fat * 0.4 ** (1 / 3)
    D = 0.0
    for d, n in blocks:
        if variant == "EN":
            N = sn_cycles(d, fat)
        elif variant == "Haibach":
            N = 2e6 * (fat / d) ** 3 if d >= dD else 5e6 * (dD / d) ** 5
        else:
            N = 2e6 * (fat / d) ** 3
        D += n / N
    return D
```

| Model | Below Δσ_D | Below the cut-off | Use |
|---|---|---|---|
| EN 1993-1-9 | slope 5 | no damage | standard design |
| Haibach | slope 5 (= 2m − 1) | **still damage**, slope 5 continued | when many small cycles act together with large ones, conservative |
| elementary Miner | slope 3 continued | still damage | most conservative, often used for machine parts and in the automotive industry |

For the large ranges of the rainflow example the three models agree (2.58 / 2.58 / 2.64). They differ for spectra
with many small cycles, see the AGV example in section 4.10.

### 4.5 Thickness effect and mean stress

**Thickness.** Thick plates have a steeper stress gradient through the thickness at the toe and a larger volume of
highly stressed material, so their fatigue strength is lower:

  k_s = (25 / t)^0.2   for t > 25 mm       (core `thickness_factor()`; the exponent depends on the detail, check)

**Mean stress.** As-welded: no effect (section 4.1). If the residual stresses have been removed (stress-relief heat
treatment, chapter 7) or the detail is not welded, compressive mean stress helps. The IIW gives an enhancement
factor f(R) on the FAT value, with R = σ_min / σ_max:

```python
def wa_mean_stress_factor(R, condition="as welded"):
    """IIW enhancement factor f(R) on the FAT value: as welded / large residual stress f = 1; stress relieved:
    f = 1.6 (R < -1), -0.4 R + 1.2 (-1 <= R <= 0.5), 1.0 (R > 0.5) - check IIW 2008 / 2016."""
    if condition == "as welded":
        return 1.0
    if R < -1:
        return 1.6
    if R <= 0.5:
        return -0.4 * R + 1.2
    return 1.0
```

```
## 4.4 Thickness and mean stress
  t  10 mm: k_s 1.000 -> FAT 71 becomes 71.0
  t  25 mm: k_s 1.000 -> FAT 71 becomes 71.0
  t  40 mm: k_s 0.910 -> FAT 71 becomes 64.6
  t  60 mm: k_s 0.839 -> FAT 71 becomes 59.6
  t 100 mm: k_s 0.758 -> FAT 71 becomes 53.8
  R -1.0: f(R) as welded 1.00, stress relieved 1.60
  R +0.0: f(R) as welded 1.00, stress relieved 1.20
  R +0.5: f(R) as welded 1.00, stress relieved 1.00
```

A stress-relieved weld under fully reversed load (R = −1) gains 60 % on the FAT class. A pulsating load (R = 0)
gains 20 %. Note the condition: **residual stresses must really be low**. That is true after post-weld heat treatment
(PWHT) of pressure vessels, but not after "stress relief by vibration" or for small parts welded without restraint.

### 4.6 Structural hot-spot and effective notch methods

The nominal method needs a nominal stress and a detail from the catalogue. Neither exists for a complex welded
casting-like node or a shell. Then two FE-based methods are used.

**Structural hot-spot stress (IIW).** Read the surface stress in the FE model at reference points in front of the weld
toe and extrapolate linearly to the toe. This removes the notch peak (which the FE mesh cannot resolve) but keeps the
structural concentration of the geometry:

  type a (toe on a plate surface):  σ_hs = 1.67 · σ(0.4 t) − 0.67 · σ(1.0 t)         (linear, fine mesh)
                                     σ_hs = 2.52 · σ(0.4 t) − 2.24 · σ(0.9 t) + 0.72 · σ(1.4 t)   (quadratic)
  type b (toe at a plate edge):      σ_hs = 3 · σ(4 mm) − 3 · σ(8 mm) + σ(12 mm)

The hot-spot S-N curves are FAT 90 (load-carrying fillet welds) and FAT 100 (non-load-carrying).

```python
def wa_hot_spot(s04t, s10t, s09t=None, s14t=None):
    """IIW type a hot spot: linear sigma_hs = 1.67 s(0.4t) - 0.67 s(1.0t); quadratic 2.52 s(0.4t) - 2.24 s(0.9t) + 0.72 s(1.4t)."""
    lin = 1.67 * s04t - 0.67 * s10t
    quad = 2.52 * s04t - 2.24 * s09t + 0.72 * s14t if s09t is not None else None
    return {"linear": lin, "quadratic": quad}
```

```python
def wa_hot_spot_b(s4, s8, s12):
    """IIW type b hot spot (along a plate edge / attachment end): sigma_hs = 3 s(4mm) - 3 s(8mm) + s(12mm)."""
    return 3 * s4 - 3 * s8 + s12
```

**Effective notch stress (IIW).** Model the toe and root with a fictitious radius of 1 mm (plates t ≥ 5 mm) and read
the maximum principal stress. The single S-N curve is FAT 225. It is the only method that also handles root cracks
in a general way. It needs a very fine mesh (element size ≤ r/4).

```
## 4.5 Hot-spot and effective notch (FE readings at a gusset toe, t 12 mm)
  type a: s(0.4t) 118, s(1.0t) 96 MPa -> linear 132.7 MPa; quadratic (0.4/0.9/1.4 t) 140.4 MPa
  type b: s(4/8/12 mm) 130 / 112 / 101 MPa -> 155.0 MPa
  range 106.2 MPa (80 % of the hot-spot peak): hot-spot FAT 90 -> N 1.22e+06; notch (Kw 2.6) 276.1 MPa, FAT 225 -> N 1.08e+06
```

Both methods give nearly the same life here (1.2·10⁶ and 1.1·10⁶ cycles), which is a good plausibility check of an FE
fatigue analysis. If the two differ by more than a factor of two, check the mesh and the extrapolation points first.
Link to M1: the convergence of such FE results is checked with the GCI of guide M1 (chapter 28).

### 4.7 Improvement techniques

If a toe detail is not good enough, the toe can be improved after welding:

```python
WA_IMPROVE = [   # method, FAT factor on toe classes (typical, check IIW recommendations), condition
    ("burr grinding of the toe", 1.3, "toe failures only, depth 0.5 mm below undercut, inspected"),
    ("TIG dressing", 1.3, "toe failures only, remelted smooth toe"),
    ("hammer / needle peening", 1.3, "compressive residual stress, not for R > 0.5"),
    ("HFMI (high-frequency mechanical impact)", 1.6, "S355 and higher, up to +4 FAT classes, limited R and peak stress"),
    ("none - root failure governs", 1.0, "improvement of the toe does not help a root crack: increase the throat / full penetration"),
]
```

```
## 4.6 Improvement techniques and partial factors
  burr grinding of the toe                   FAT x 1.3  toe failures only, depth 0.5 mm below undercut, inspected
  TIG dressing                               FAT x 1.3  toe failures only, remelted smooth toe
  hammer / needle peening                    FAT x 1.3  compressive residual stress, not for R > 0.5
  HFMI (high-frequency mechanical impact)    FAT x 1.6  S355 and higher, up to +4 FAT classes, limited R and peak stress
  none - root failure governs                FAT x 1.0  improvement of the toe does not help a root crack: increase the throat / full penetration
  gamma_Mf damage tolerant  low   consequence: 1.00
  gamma_Mf damage tolerant  high  consequence: 1.15
  gamma_Mf safe life        low   consequence: 1.15
  gamma_Mf safe life        high  consequence: 1.35
```

Three warnings:

1. Improvement acts on **toe** cracks only. If the root of a fillet weld (FAT 36) governs, grinding the toe moves the
   crack to the root. Then the remedy is a bigger throat or full penetration.
2. The benefit relies on workmanship. The improvement must be specified on the drawing and inspected (depth of
   grinding, coverage of peening).
3. Peening and HFMI work through compressive residual stress. A later overload or a stress-relief treatment can remove
   it.

### 4.8 Partial factors and inspection strategy

EN 1993-1-9 (table 3.1) chooses γ_Mf from two questions:

- **Damage tolerant** – a crack can be found before it is critical (inspection plan, redundant load path), or **safe
  life** – the structure must survive the life without inspection.
- **Consequence of failure** – low (a frame part that can be replaced) or high (people under the structure, a
  pressure part).

The default bracket uses γ_Mf = 1.15: safe life with low consequence, or damage tolerant with high consequence. A motor
bracket that falls off can hurt the operator, so do not go lower.

### 4.9 The default bracket – how far from finite life?

The core result for the post: every stress range is below the cut-off, damage = 0. `wa_bracket_margin()` asks the
design question the other way round: by which factor could the loads grow before the life becomes finite?

```python
def wa_bracket_margin(P=None):
    """How far the default bracket loads must be scaled before the fatigue life becomes finite:
    starts block reaches the allowable range for its n; ripple block reaches the cut-off."""
    P = dict(DEFAULT if P is None else P)
    Fa = fatigue(P)
    out = []
    for b in Fa["blocks"]:
        n = b["n"]
        for key, rng, fat_name in (("toe", b["ds_toe"], P["fat_toe"]), ("throat", b["ds_w"], P["fat_throat"])):
            fat = FAT[fat_name][0]
            # allowable range for n cycles (EN curve) divided by gamma_Mf
            if n <= 5e6:
                allow = fat * (2e6 / n) ** (1 / 3)
            elif n <= 1e8:
                allow = fat * 0.4 ** (1 / 3) * (5e6 / n) ** (1 / 5)
            else:
                allow = fat * 0.4 ** (1 / 3) * (5e6 / 1e8) ** (1 / 5)
            allow /= P["gamma_Mf"] * P["gamma_Ff"]
            out.append((b["name"], key, rng, allow, allow / rng if rng else float("inf")))
    return out
```

```
## 4.7 Default bracket: margin to finite life (load factor that reaches the allowable range)
  motor starts (effective pull 2.5 T_N, 6 / h, 4000 h/y, 20 y)   toe    range  2.31 MPa, allowable  56.0 MPa -> factor  24.3
  motor starts (effective pull 2.5 T_N, 6 / h, 4000 h/y, 20 y)   throat range  3.20 MPa, allowable  50.4 MPa -> factor  15.7
  torque ripple order 1 (24.1 Hz, 20 % of the pull swing, check) toe    range  0.28 MPa, allowable  14.1 MPa -> factor  49.7
  torque ripple order 1 (24.1 Hz, 20 % of the pull swing, check) throat range  0.39 MPa, allowable  12.7 MPa -> factor  32.3
```

The weakest point is the **fillet throat under the torque ripple**: the 6.9·10⁹ ripple cycles must stay below the
cut-off (12.7 MPa allowed after γ_Mf), and they are at 0.39 MPa. The loads would have to grow 32 times. The starts
(4.8·10⁵ cycles) are even further away (factor 15.7 on the throat, 24 at the toe). The bracket is therefore governed
by stiffness and workmanship rules, not by fatigue – **unless the frame resonates** (section 3.6). A resonance with
an amplification of 30 or more would use up this margin.

### 4.10 A fatigue-loaded example – the AGV chassis weld

An AGV (automated guided vehicle, see the AGV build of the factory twin) drives over floor joints and through turns
with and without load. The cross-member is fillet welded to the side member (load-carrying cruciform detail, FAT 71).
A 10-year load spectrum, from a measurement or a multibody simulation, is counted by rainflow into four blocks:

```python
WA_AGV = {"name": "AGV chassis: cross-member to side-member fillet weld (example)",
          "fat": 71, "t": 10.0, "gamma_Mf": 1.15,
          "spectrum": [(100.0, 3.0e4, "floor joints at full load, 0.5 g bumps"), (65.0, 6.0e5, "loaded travel, turns"),
                       (34.0, 8.0e6, "unloaded travel"), (15.0, 1.0e8, "motor / wheel vibration")]}
```

```python
def wa_agv(A=None):
    A = dict(WA_AGV if A is None else A)
    g = A["gamma_Mf"]
    blocks = [(d * g, n) for d, n, _ in A["spectrum"]]
    res = {v: wa_miner(blocks, A["fat"], v) for v in ("EN", "Haibach", "elementary")}
    dE = wa_equivalent_range([(d, n) for d, n, _ in A["spectrum"]])
    rows = [(txt, d, n, sn_cycles(d * g, A["fat"]), n / sn_cycles(d * g, A["fat"])) for d, n, txt in A["spectrum"]]
    return {"D": res, "dE2": dE, "rows": rows, "life_years_per_10": 10 / res["EN"] if res["EN"] else float("inf")}
```

```
## 4.8 AGV chassis weld, FAT 71, gamma_Mf 1.15, 10-year spectrum
  100.0 MPa x 3.0e+04: N 4.71e+05, D 0.064  (floor joints at full load, 0.5 g bumps)
   65.0 MPa x 6.0e+05: N 1.71e+06, D 0.350  (loaded travel, turns)
   34.0 MPa x 8.0e+06: N 2.14e+07, D 0.373  (unloaded travel)
   15.0 MPa x 1.0e+08: N inf, D 0.000  (motor / wheel vibration)
  damage EN 0.787, Haibach 0.865, elementary 1.799; equivalent range at 2e6 (m 3, unfactored) 75.1 MPa; EN life 12.7 years
  same spectrum with FAT 80: damage EN 0.495 -> life 20.2 years
  same spectrum with FAT 90: damage EN 0.317 -> life 31.5 years
  FAT 71 after burr grinding (x 1.3 = 92): damage 0.289 -> life 34.6 years
```

What this example teaches:

- The **loaded travel and unloaded travel** blocks (65 and 34 MPa) cause 92 % of the damage, not the rare heavy
  bumps (100 MPa, 8 %). Many medium cycles matter more than a few big ones.
- The **vibration** block (15 MPa, 10⁸ cycles) is below the cut-off (FAT 71 → 28.7 MPa / 1.15 = 25 MPa) and does
  nothing in the EN model.
- The **model choice changes the verdict**: EN 0.79 (passes, 12.7 years), Haibach 0.87 (passes), elementary Miner
  1.80 (fails). If the customer's specification asks for elementary Miner, this design is not accepted.
- **Detail first:** the same spectrum on a better detail (FAT 80, non-load-carrying) gives 20 years; FAT 90 (butt
  weld) 31 years. Burr grinding the toes of the FAT 71 detail gives about 35 years – but only if the root does not
  govern (full-penetration K weld).


---

## 5. Pressure vessels: directives and codes, design stress, cylindrical shells, dished heads, openings, flanges

A pressure vessel is a closed container whose inside pressure differs from the outside by more than 0.5 bar. The
compressor's air receiver is the example in this chapter and the next. It is a simple part: a rolled and welded
cylinder, two pressed heads, a few nozzles. But it stores energy, so the law decides how it is designed, made,
tested and inspected. This chapter gives the theory and the code rules; chapter 6 designs the receiver completely.

All new functions of chapters 5–6 are in the add-on of `vessel.py`, printed by:

```
python vessel.py ch56
```

### 5.1 Stored energy – why pressure vessels are regulated

When a vessel fails, the gas expands to atmospheric pressure in milliseconds. The work it can do is the
**isentropic expansion energy**. For an ideal gas expanding from absolute pressure p to ambient pressure p_a:

E = p·V/(k − 1) · [1 − (p_a/p)^((k−1)/k)]

with k = c_p/c_v = 1.4 for air. Compare this with a liquid. Water is almost incompressible, so pressurised water
stores only E = p²·V/(2K), with bulk modulus K ≈ 2200 MPa. That is thousands of times less (section 6.4).

```python
def vb_stored_energy(p_bar_g, V_L, k=1.4, pa=1.013):
    p = (p_bar_g + pa) * 1e5
    V = V_L / 1000
    E = p * V / (k - 1) * (1 - (pa * 1e5 / p) ** ((k - 1) / k))
    return {"E_J": E, "E_kJ": E / 1000, "TNT_g": E / 4.184e6 * 1000}
```

```
## 5.1 Stored energy and why pressure vessels are regulated
  11.00 bar(g),  150 L: E   228.3 kJ =  54.6 g TNT
   8.00 bar(g),  150 L: E   157.0 kJ =  37.5 g TNT
  11.00 bar(g),  500 L: E   760.8 kJ = 181.8 g TNT
  15.73 bar(g),  150 L: E   346.2 kJ =  82.7 g TNT
```

The 150 L receiver at its maximum allowable pressure PS = 11 bar holds 228 kJ, the energy of about 55 g of TNT.
The blast effect of a gas burst is smaller than that of the same TNT energy, because a gas releases its energy more
slowly. But the fragments (head, nozzle, valve) fly like projectiles. This is why:

- the **design** must follow a recognised code, with safety factors on the material strength;
- the **manufacturer** must use qualified welders and procedures and test the vessel;
- the **operator** must inspect it periodically (section 6.8).

The energy grows with p·V. That is why the European directives classify vessels by the product **PS × V** (bar·L).

### 5.2 Directives and codes: PED, SPVD, EN 13445, EN 286, ASME

| Document | What it is | Applies to the receiver? |
|---|---|---|
| **PED 2014/68/EU** (Pressure Equipment Directive) | EU law: essential safety requirements, categories, conformity assessment, CE marking | yes, unless the SPVD applies |
| **SPVD 2014/29/EU** (Simple Pressure Vessels Directive) | EU law for welded, unfired vessels for **air or nitrogen**, PS ≤ 30 bar, PS·V ≤ 10 000 bar·L, steel or aluminium, −50 … 300 °C (steel), cylinder + dished / flat heads | **yes** – it is the usual route for compressor receivers |
| **EN 286-1** | harmonised standard under the SPVD (simple unfired vessels for air / nitrogen) | design route under the SPVD |
| **EN 13445-1 … -5** | harmonised standard under the PED for unfired pressure vessels: -2 materials, -3 design, -4 manufacture, -5 inspection and testing | design route under the PED |
| **AD 2000 Merkblätter** | German code, also accepted for PED conformity | alternative to EN 13445 |
| **ASME VIII Div. 1** | US code (rules with safety factor 3.5 on R_m); in the EU only through the "essential safety requirements" | head formulas used in `head_e()` |

The PED sorts fluids into **group 1** (dangerous: flammable, toxic, oxidising) and **group 2** (all others, including
air, nitrogen, CO₂ and steam). For vessels with gas it uses two tables of PS·V limits. Above each limit the
category rises, and with it the involvement of a notified body.

```python
VB_PED_TABLES = {   # PED 2014/68/EU annex II, vessels (check): upper PS x V limits (bar L) of art. 4.3, I, II, III; above -> IV
    "gas group 1 (dangerous: flammable, toxic, oxidising)": (25, 50, 200, 1000),
    "gas group 2 (all other gases: air, nitrogen, CO2, steam)": (50, 200, 1000, 3000),
}
```

The core function `ped_category()` uses table 2 (gas group 2) and also tells whether the SPVD applies:

```python
    pv = PS * V
    if PS <= 0.5:
        cat = "outside PED (PS <= 0.5 bar)"
    elif pv <= 50:
        cat = "article 4.3 (sound engineering practice)"
    ...
    return {"PV": pv, "PED": cat, "SPVD": PS <= 30 and pv <= 10000}
```

```
## 5.2 PED category (PS 11 bar x V 150 L)
  gas group 1 (dangerous: flammable, toxic, oxidising)       PS x V  1650 bar L -> category IV  modules: B (production type) + D or F; or G (unit verification); or H1
  gas group 2 (all other gases: air, nitrogen, CO2, steam)   PS x V  1650 bar L -> category III modules: B (design or production type) + D, F, E or C2; or H
    24 L: PS x V   264 -> category II                              SPVD yes
    50 L: PS x V   550 -> category II                              SPVD yes
    90 L: PS x V   990 -> category II                              SPVD yes
   270 L: PS x V  2970 -> category III                             SPVD yes
   500 L: PS x V  5500 -> category IV                              SPVD yes
```

How to read this:

- Under the PED, the 150 L receiver at 11 bar is **category III**. That needs a notified body for the design
  (module B, EU type examination) **and** for production (module D, F, E or C2). This is expensive for a small vessel.
- Because it holds **air**, is welded, unfired, and PS·V ≤ 10 000 bar·L, the **SPVD** applies instead. The
  receiver is then built to EN 286-1. That is a simpler route with a type examination and serial production control.
  Most compressor receivers on the market are SPVD vessels. The nameplate shows "PS × V" and the CE mark.
- The modules (A, A2, B, C2, D, D1, E, E1, F, G, H, H1) are the conformity-assessment procedures of the
  "New Approach". Module letters shown are typical – check annex III of the PED for the exact choice.

### 5.3 Design stress – the safety factors

A pressure-vessel code does not check a calculated stress against yield with a free safety factor. It defines a
**nominal design stress f** from the material properties. Every thickness formula uses f.

EN 13445-3 clause 6 (normal operating condition):

- ferritic steels: f = min( R_p0.2,T / 1.5 ; R_m,20 / 2.4 )
- austenitic steels with elongation A ≥ 35 %: f = R_p1.0,T / 1.5 (the code allows up to max(R_p1.0,T/1.5,
  min(R_p1.0,T/1.2, R_m,T/3)) – the program uses the simpler, lower value, check);
- test condition: f_test = R_p0.2,20 / 1.05 (the test is a short, controlled overload).

The factor 1.5 on the proof strength keeps the membrane stress well below yield. The factor 2.4 on tensile strength
protects against materials with a low strength-to-yield ratio. ASME VIII-1 uses 3.5 on R_m. That is why ASME vessels
are about 30 % thicker for the same steel.

```python
def design_stress(mat, T):
    m = VMAT[mat]
    Rp = interp_T(m["Rp"], T)
    f = Rp / 1.5 if m["aus"] else min(Rp / 1.5, m["Rm"] / 2.4)
    return {"Rp_T": Rp, "f": f, "f20": (...), "f_test": m["Rp"][20] / 1.05}
```

```
## 5.3 Design stress f (MPa) at 20 / 100 / 150 / 200 C and test f
  P265GH (EN 10028-2)                 170.8   160.7   148.7   136.7   test 252.4
  P355GH (EN 10028-2)                 212.5   212.5   202.7   189.3   test 338.1
  P235S (EN 10207, simple vessels)    150.0   140.0   130.0   120.0   test 223.8
  1.4301 X5CrNi18-10 (EN 10028-7)     173.3   127.3   114.7   104.7   test 247.6
```

- For **P265GH** at 20 °C the tensile-strength term governs (410/2.4 = 170.8 < 265/1.5 = 176.7). At 100 °C the proof
  strength falls to 241 MPa and governs (160.7 MPa).
- **P355GH** stays limited by R_m/2.4 = 212.5 MPa up to 100 °C. It is only 24 % stronger than P265GH in the code,
  although its yield is 34 % higher.
- **Stainless 1.4301** loses strength fast with temperature (R_p1.0 260 → 191 MPa at 100 °C). Its design stress at
  100 °C is 20 % below P265GH. Stainless is chosen for clean, oil-free air or food applications, not for strength.
- The design temperature TS of the receiver is 100 °C. The air leaves the compressor at about 150–180 °C, but an
  aftercooler and the receiver wall cool it. TS must cover the highest wall temperature that can occur, for example
  when the aftercooler fan fails. Check it with the real installation.

Material values are typical (check EN 10028-2/-7 and EN 10207 for the plate thickness).

### 5.4 Membrane theory – hoop and axial stress, thin and thick walls

Cut a cylinder of inside diameter D_i, wall e and length L along its axis. The pressure pushes the two halves apart
with the force p·D_i·L. Two wall sections of area e·L hold them together:

σ_t (hoop) = p·D_i/(2e)

Cut it across: the pressure acts on the area π·D_i²/4, the wall ring has area ≈ π·D_m·e:

σ_a (axial) = p·D_i²/(4·e·D_m) ≈ p·D_i/(4e) = σ_t/2

So **the hoop stress is twice the axial stress**. A cylinder therefore bursts along its length, and the
**longitudinal weld** is the critical one. This is why the joint coefficient z applies to the longitudinal seam.

**The EN 13445 formula.** If the hoop stress is taken on the **mean** diameter, D_m = D_i + e:

f = p·(D_i + e)/(2e)  →  2·f·e = p·D_i + p·e  →  **e = p·D_i/(2·f·z − p)**

With the joint coefficient z on the weld, this is exactly the formula of EN 13445-3 7.4.2 and of `shell_e()`. The
self-test checks that the mean-diameter hoop stress equals f at this thickness. The equivalent "Barlow" formula
e = p·D_e/(2f + p) uses the outside diameter.

**Thick walls (Lamé).** For thick walls the stress is not uniform. The exact elastic solution gives the largest hoop
stress at the inner surface, σ_t,max = p·(R_o² + R_i²)/(R_o² − R_i²), with σ_r = −p there.

```python
def vb_membrane(P_MPa, Di, e):
    Ri, Ro = Di / 2, Di / 2 + e
    return {"hoop_in": P_MPa * Di / (2 * e), "barlow": P_MPa * (Di + 2 * e) / (2 * e), "hoop_mean": P_MPa * (Di + e) / (2 * e),
            "axial": P_MPa * Di ** 2 / (4 * e * (Di + e)), "lame_t": P_MPa * (Ro ** 2 + Ri ** 2) / (Ro ** 2 - Ri ** 2),
            "lame_vm": P_MPa * math.sqrt(3) * Ro ** 2 / (Ro ** 2 - Ri ** 2)}
```

```
## 5.4 Membrane stresses and Lame check (default shell, e_eff = 2.7 mm)
  hoop (Di) 81.5, Barlow (De) 82.6, mean 82.0, axial 40.5, Lame max hoop 82.0, Lame von Mises 72.0 MPa
  e/De 0.01: Lame max hoop / mean-diameter formula = 1.000
  e/De 0.02: Lame max hoop / mean-diameter formula = 1.000
  e/De 0.05: Lame max hoop / mean-diameter formula = 1.003
  e/De 0.10: Lame max hoop / mean-diameter formula = 1.012
  e/De 0.16: Lame max hoop / mean-diameter formula = 1.036
  e/De 0.25: Lame max hoop / mean-diameter formula = 1.111
```

- The default shell (4 mm plate, 2.7 mm after corrosion and plate tolerance) carries only 82 MPa hoop stress at PS
  – half of f. The thickness is set by the 4 mm minimum, not by pressure (section 5.7 and chapter 6).
- The mean-diameter formula is exact to 0.3 % up to e/D_e = 0.05 and to 3.6 % at 0.16. That is why EN 13445
  limits the simple formula to e/D_e ≤ 0.16. Thicker shells (hydraulic accumulators, high-pressure tubes) need the
  thick-wall rules.

### 5.5 External pressure – the vacuum case

A receiver can see **vacuum**. Example: the vessel is steamed for cleaning and closed, or the hot air cools with all
valves shut. Under external pressure a thin shell does not yield; it **buckles** into lobes. The elastic buckling
pressure depends on (e/D)^2.5 … (e/D)^3, so a thin shell is very weak:

- long tube (L ≫ D): p_cr = 2E/(1 − ν²) · (e/D)³
- short tube between stiff heads (Windenburg–Trilling): p_cr = 2.42·E·(e/D)^2.5 / [(1 − ν²)^0.75 · (L/D − 0.45·√(e/D))]

The code (EN 13445-3 clause 8) adds out-of-roundness and plasticity effects. The program uses a safety factor 3 on
the elastic value (check):

```python
def vb_external(Di, e, L, E=200000.0, nu=0.3, S=3.0):
    D = Di + e
    long_ = 2 * E / (1 - nu * nu) * (e / D) ** 3
    short = 2.42 * E * (e / D) ** 2.5 / ((1 - nu * nu) ** 0.75 * (L / D - 0.45 * (e / D) ** 0.5))
    pcr = max(long_, short)
    return {"p_cr_long_MPa": long_, "p_cr_short_MPa": short, "p_cr_MPa": pcr, "p_allow_bar": pcr / S * 10}
```

```
## 5.5 External pressure (vacuum after condensation / drain closed)
  e 2.7 mm: p_cr long 0.132, short 0.715 MPa -> allowed (S 3) 2.38 bar
  e 4.0 mm: p_cr long 0.427, short 1.906 MPa -> allowed (S 3) 6.35 bar
  e 6.0 mm: p_cr long 1.419, short 5.235 MPa -> allowed (S 3) 17.45 bar
```

Even the corroded wall (2.7 mm) takes 2.4 bar external pressure, more than full vacuum (1 bar). The short length
between the heads (1092 mm, L/D ≈ 2.7) helps: the heads hold the shell round. A long, thin tube of the same wall
would buckle at 1.3 bar (p_cr long 0.132 MPa). The receiver can therefore be marked "−1 / +11 bar". If vacuum is
possible, it must be on the nameplate.

### 5.6 Dished heads – why the knuckle governs

A head closes the cylinder. Its shape decides how thick it must be:

| Head | Shape | Membrane stress | Depth (inside) | Typical use |
|---|---|---|---|---|
| hemispherical | half sphere R = D_i/2 | p·R/(2e) – half of the cylinder | D_i/2 | high pressure, large vessels; expensive to form |
| ellipsoidal 2:1 | half ellipse, depth D_i/4 | ≈ cylinder | D_i/4 | ASME standard head |
| torispherical **Korbbogen** (DIN 28013) | crown R = 0.8 D_i, knuckle r = 0.154 D_i | crown low, knuckle peak | ≈ 0.255 D_i | common in Germany above ~10 bar |
| torispherical **Klöpper** (DIN 28011) | crown R = D_i, knuckle r = 0.1 D_i | crown low, knuckle high | ≈ 0.194 D_i | cheapest, shallowest; standard for air receivers |
| flat plate | — | bending, very thick | 0 | covers, small diameters only |

The **crown** of a torispherical head is a spherical cap. Its membrane stress p·R/(2e) is low. But the **knuckle**
joins the cap to the cylinder with a small radius r. There the meridional curvature changes sharply. The pressure
then causes local bending and compressive hoop stress, which peak in the knuckle. ASME expresses this with the
stress-intensification factor:

M = (3 + √(L/r))/4,  t = p·L·M/(2·S·E − 0.2·p)

(L = crown radius). The smaller the knuckle radius, the higher M:

```python
def head_e(kind, P_MPa, Di, f, z):
    den = 2 * f * z - 0.2 * P_MPa
    if kind == "hemispherical":
        return P_MPa * Di / 2 / den, 1.0
    if kind == "ellipsoidal 2:1":
        return P_MPa * Di / den, 1.0
    L, r = (Di, 0.1 * Di) if kind == "torispherical Kloepper" else (0.8 * Di, 0.154 * Di)
    M = 0.25 * (3 + math.sqrt(L / r))
    return P_MPa * L * M / den, M
```

The add-on compares all heads with the cylinder (same f, z = 1). It also shows the EN 13445-3 **crown** formula
e_s = p·R/(2·f·z − 0.5·p), which covers the crown only:

```python
    for h in HEADS:
        e, M = head_e(h, Pm, P["Di"], f, 1.0)
        R = {"hemispherical": P["Di"] / 2, "ellipsoidal 2:1": 0.9 * P["Di"], "torispherical Kloepper": P["Di"], "torispherical Korbbogen": 0.8 * P["Di"]}[h]
        e_crown = Pm * R / (2 * f - 0.5 * Pm)
```

```
## 5.6 Heads compared (z 1, f 160.7 MPa)
  cylinder e 1.37 mm
  hemispherical            e 0.69 mm = 0.50 x cylinder (M 1.000); EN crown only 0.69 mm
  ellipsoidal 2:1          e 1.37 mm = 1.00 x cylinder (M 1.000); EN crown only 1.23 mm
  torispherical Kloepper   e 2.11 mm = 1.54 x cylinder (M 1.541); EN crown only 1.37 mm
  torispherical Korbbogen  e 1.45 mm = 1.05 x cylinder (M 1.320); EN crown only 1.10 mm
  knuckle factor M vs r/L: r/L 0.060 -> M 1.771, r/L 0.100 -> M 1.541, r/L 0.154 -> M 1.387, r/L 0.200 -> M 1.309, r/L 0.300 -> M 1.206, r/L 0.500 -> M 1.104
  cone 30 deg, Dc 400: e 1.87 mm; 45 deg: 2.29 mm
```

- The **Klöpper** head needs 1.54 × the cylinder thickness; the Korbbogen only 1.05 ×. In both, the knuckle
  governs: the crown alone would need 1.37 / 1.10 mm.
- Why use a Klöpper head at all? It is the shallowest (77 mm deep at D_i 400) and the cheapest to press. For thin
  receivers the minimum plate (4 mm) covers the knuckle anyway. At higher pressure or larger diameters the
  Korbbogen becomes the economic choice.
- The EN 13445 knuckle rule (with its factor β from a design chart) is **not programmed**. The ASME M-factor
  formula is used with the EN design stress; this is conservative for Klöpper heads in practice, but the binding
  calculation for a CE vessel must follow the chosen code (check).
- **Forming thins the knuckle**: pressing and flanging reduce the wall by about 10 % (spinning up to 15 %). The core
  divides the required head thickness by (1 − 0.10) before adding the allowances (`thinning_head`).
- A **cone** (reducer, hopper) needs e = p·D_c/(2fz − p)/cos α. At 30° it is 15 % thicker than the cylinder, at 45°
  41 %. The cone–cylinder junction needs extra reinforcement rules (EN 13445-3 7.6.6, check):

```python
def vb_cone(P_MPa, Dc, alpha_deg, f, z):
    return P_MPa * Dc / (2 * f * z - P_MPa) / math.cos(math.radians(alpha_deg))
```

### 5.7 Openings – area replacement, pads, nozzle types

Every nozzle cuts a hole into the shell. The material removed carried hoop force, and the edge of the hole now
carries a stress concentration of about 2.5 … 3. The classical rule (ASME UG-37, also the idea of EN 13445-3
clause 9) is **area replacement**:

the cross-section area removed, A_req = d · e_req, must be replaced by excess material within a limited zone:
- in the shell: d·(e_shell − c − e_req) (shell wall thicker than needed);
- in the nozzle wall: 2·l_n·(t_n − c − t_n,req), with l_n = 2.5·min(e_shell, t_n) (the effective height);
- in a reinforcing pad: (D_pad − d − 2t_n)·t_pad, width limited to d on each side.

```python
def nozzle(P, D):
    n = P["nozzle"]
    c = P["c_corr"] + P["c_tol"]
    e_req, e_av = D["e_shell"], D["t_shell"] - c
    tn_req = shell_e(D["P_MPa"], n["d"], D["ds"]["f"], 1.0)
    ln = 2.5 * min(D["t_shell"], n["tn"])
    A_req = n["d"] * e_req
    A_av = n["d"] * max(0.0, e_av - e_req) + 2 * ln * max(0.0, n["tn"] - c - tn_req)
    return {"A_req": A_req, "A_av": A_av, "ok": A_av >= A_req, "tn_req": tn_req, "l_n": ln}
```

The add-on runs the DN50 outlet with three shell plates and two nozzle walls (4.0 mm and 5.6 mm, the "schedule 80"
pipe), and the 3 mm shell with a pad:

```python
def vb_nozzle_study(P=None, shells=(3.0, 4.0, 5.0), tns=(4.0, 5.6)):
    for es in shells:
        for tn in tns:
            Q = dict(P, e_min_shell=es, nozzle=dict(P["nozzle"], tn=tn))
            D = design(Q)
            n = nozzle(Q, D)
```

```
## 5.7 Openings: area replacement (DN50, d 50)
  shell 3.0, nozzle 4.0: required 80.9, available 42.1 mm2 -> NOT OK
  shell 3.0, nozzle 5.6: required 80.9, available 66.1 mm2 -> NOT OK
  shell 4.0, nozzle 4.0: required 80.9, available 104.7 mm2 -> OK
  shell 4.0, nozzle 5.6: required 80.9, available 136.7 mm2 -> OK
  shell 5.0, nozzle 4.0: required 80.9, available 154.7 mm2 -> OK
  shell 5.0, nozzle 5.6: required 80.9, available 207.3 mm2 -> OK
  shell 3.0 + pad 100 x 4: pad 168.0 mm2, total 210.1 >= 80.9 -> OK
```

This is **why the default shell is 4 mm and not 3 mm.** Pressure alone needs 1.62 mm + 1.3 mm allowances = 2.92 mm,
so a 3 mm plate would do. But at 3 mm the shell has almost no excess (1.7 mm effective vs 1.62 mm required), and the
DN50 hole is not compensated. A thicker nozzle wall alone does not save it, because the effective height is limited
by the thin shell (l_n = 2.5·3 = 7.5 mm). There are two ways out:

- **4 mm shell**: 104.7 mm² ≥ 80.9 mm² – no pad, simplest. This is the default (`e_min_shell` 4.0). The plate is
  33 % heavier but saves a pad weld. Rolling and welding 3 mm plate on automatic machines is also harder.
- **3 mm shell + pad 100 × 4 mm**: OK, but the pad needs a full fillet weld, a tell-tale hole (for leak test of
  the pad weld) and creates a crevice for corrosion. Pads are avoided on fatigue-loaded vessels.

**Nozzle types.**
- *Set-on* nozzle: the pipe sits on the shell, welded from outside with a full-penetration weld. Easy to fit; the
  weld is loaded through the shell thickness (lamellar tearing risk in thick plate).
- *Set-in* (set-through) nozzle: the pipe passes through the hole and is welded inside and outside. Better fatigue
  behaviour, the nozzle wall can count fully.
- *Half couplings / threaded sockets* (G½, G1): standard for small receiver connections (drain, gauge, safety
  valve, switch). Area replacement still applies, but for d ≤ ~ 2.5·√(D·e) EN 13445 exempts small openings (check).

### 5.8 Flanges – EN 1092-1 PN classes

Larger connections are flanged. EN 1092-1 defines flanges by **DN** (nominal size) and **PN** (pressure class at
20 °C), plus the type (01 plate, 05 blind, 11 weld neck…). The allowed pressure falls with temperature according to
the material group. For PN16 in group 3E0 (P250GH) about 14.8 bar is allowed at 100 °C (check annex G):

```python
VB_FLANGE_PN16 = {   # EN 1092-1 type 11 (weld neck) PN16, typical (check): D outside, K bolt circle, bolts, C thickness mm
    "DN15": {"D": 95, "K": 65, "n": 4, "bolt": "M12", "C": 16},
    "DN25": {"D": 115, "K": 85, "n": 4, "bolt": "M12", "C": 18},
    "DN50": {"D": 165, "K": 125, "n": 4, "bolt": "M16", "C": 20},
    ...
VB_PN16_RATING = {20: 16.0, 100: 14.8, 150: 13.7, 200: 12.8}   # allowable bar, material group 3E0 (P250GH), check EN 1092-1 annex G
```

```
## 5.8 Flanges EN 1092-1 PN16 at 100 C
  DN15: D 95, K 65, 4 x M12, C 16; rating 14.8 bar >= 11 -> OK; bolt stress (rough) 2 MPa
  DN25: D 115, K 85, 4 x M12, C 18; rating 14.8 bar >= 11 -> OK; bolt stress (rough) 8 MPa
  DN50: D 165, K 125, 4 x M16, C 20; rating 14.8 bar >= 11 -> OK; bolt stress (rough) 15 MPa
```

PN16 covers PS 11 bar at 100 °C. A PN10 flange would not (10 bar at 20 °C). The rough bolt stress from the pressure
force is tiny. In a real flange the **gasket seating force** and the bolt tightening (M7, bolted joints) set the
bolt load, not the pressure. A flange calculation to EN 1591-1 combines gasket data (Q_min, Q_max), bolt preload
scatter and flange rotation; that is beyond this guide.

### 5.9 Weld joint coefficient, testing groups, corrosion allowance

**Joint coefficient z.** The longitudinal weld may contain defects. The code rewards more inspection with a higher
allowed stress:

```python
VB_TESTING_GROUPS = [   # EN 13445-5 testing groups (simplified, check): group, extent of volumetric NDT, z, typical limits
    ("1", "100 % RT/UT", 1.0, "all materials, any thickness"),
    ...
```

```
## 5.9 Joint coefficient and testing groups
  group 1: 100 % RT/UT                                    z 1.00  all materials, any thickness
  group 2: 10 % ... 100 % (reduced after experience)      z 1.00  limited material groups
  group 3: spot 10 % (longitudinal) / 5 % (circumferential) z 0.85  group 1.1, 1.2, 8.1; e <= 30 mm (steels)
  group 4: none (visual + pressure test)                  z 0.70  group 2 fluids, PS <= 20 bar, limited e; only static load
  testing group 1/2 (100 % NDT)    z 1.00: e 1.37 mm -> plate 3.0 mm
  testing group 3 (spot NDT)       z 0.85: e 1.62 mm -> plate 3.0 mm
  testing group 4 (visual only)    z 0.70: e 1.97 mm -> plate 4.0 mm
  corrosion allowance 1.0 mm lasts: 0.02 mm/y -> 50 y, 0.05 mm/y -> 20 y, 0.10 mm/y -> 10 y, 0.20 mm/y -> 5 y
```

For a thin receiver the choice of testing group hardly changes the plate (3 or 4 mm), because the allowances and
the minimum plate dominate. For thick vessels z decides the weight: z 0.7 means 43 % more wall than z 1.0.
Testing group 4 also limits the vessel to essentially static load. A receiver that cycles on/off 10⁶ times needs
volumetric NDT of its welds (groups 1–3).

**Corrosion allowance c.** The receiver collects condensate (section 6.6). Wet compressed air with oil traces is
corrosive to bare carbon steel. The allowance c = 1 mm is consumed in 50 years when the inside is coated, but in 5
years with standing water (rates typical, check). This is the strongest argument for an **automatic drain** and an
internal coating or galvanising. The wall thickness is measured by ultrasound at the internal inspection
(section 6.8) and compared with e_req + c_tol.

```python
def vb_corrosion_life(c=1.0, rates=(0.02, 0.05, 0.1, 0.2)):
    return [(r, c / r) for r in rates]
```

---

## 6. The compressor air receiver: volume, design, nozzles, supports, test pressure, category, pressure-cycle fatigue, safety valve, corrosion and inspection

This chapter designs the receiver of the M2 compressor completely: FAD 16.6 m³/h, on/off control between 6 and
8 bar, PS 11 bar, TS 100 °C, P265GH, Klöpper heads, D_i 400 mm. The core result (`python vessel.py examples`):

```
- on/off control: FAD 16.6 m3/h (4.61 L/s), 6 ... 8 bar, max 15 starts/h -> V_req 140 L -> standard 150 L (used 150 L)
...
- shell: e = P Di / (2 f z - P) = 1.62 mm (+ c 1.0 + tol 0.3 = 2.92) -> plate 4.0 mm; hoop stress at PS 81 MPa
- heads (torispherical Kloepper, M 1.541): e 2.11 mm, / (1 - thinning 0.10) + allowances = 3.65 -> plate 4.0 mm; head depth 77 mm, volume 6.4 L each
- cylindrical length 1092 mm, overall length 1255 mm, steel mass about 52 kg
```

### 6.1 Receiver volume – deriving the on/off formula

A compressor with on/off control runs at full delivery q (FAD, free air at p₁) until the pressure reaches the
cut-out pressure p_off, then stops until the pressure falls to the cut-in pressure p_on. The receiver volume V
decides how often it starts. The motor (and the contactor) allow only a limited number of starts per hour, f_max.
Example: 15/h for a 3 kW motor (check the motor data).

At constant temperature, raising the pressure of V by Δp = p_off − p_on stores the free-air volume V·Δp/p₁. Let the
plant take a fraction x of the compressor delivery (demand x·q):

- filling (compressor on, net inflow (1 − x)·q): t_fill = V·Δp / (p₁·q·(1 − x))
- emptying (compressor off, outflow x·q): t_empty = V·Δp / (p₁·q·x)
- one cycle: t_cycle = V·Δp/(p₁·q) · 1/(x·(1 − x))

The term x·(1 − x) is largest at **x = 0.5**: the shortest cycle happens at half demand, t_min = 4·V·Δp/(p₁·q).
Setting t_min = 1/f_max gives the sizing rule used by the core (with the temperature ratio T_rec/T_in):

**V = 0.25 · q · p₁ / (f_max · Δp)**

```python
def receiver_volume(P):
    q = P["Q_FAD_m3h"] * 1000 / 3600
    f = P["starts_per_h_max"] / 3600
    dp = P["p_off_bar"] - P["p_on_bar"]
    V = 0.25 * q * P["p_in_bar_abs"] * (P["T_rec_C"] + 273.15) / (f * dp * (P["T_in_C"] + 273.15))
    return {"V_req_L": V, "V_std_L": next(v for v in STD_VOLUMES if v >= V - 1e-9), "q_Ls": q}
```

The add-on prints fill, empty and cycle time of the chosen 150 L receiver for different demands:

```python
def vb_onoff(V_L, q_Ls, dp, p1=1.013, xs=(0.1, 0.25, 0.5, 0.75, 0.9)):
    base = V_L * dp / (p1 * q_Ls)
    return [(x, base / (1 - x), base / x, base / (x * (1 - x)), 3600 * x * (1 - x) / base) for x in xs]
```

```
## 6.1 On/off cycle of the default receiver (V 150 L, dp 2 bar)
  demand  10 %: fill    71 s, empty   642 s, cycle   714 s ->  5.0 starts/h
  demand  25 %: fill    86 s, empty   257 s, cycle   343 s -> 10.5 starts/h
  demand  50 %: fill   128 s, empty   128 s, cycle   257 s -> 14.0 starts/h
  demand  75 %: fill   257 s, empty    86 s, cycle   343 s -> 10.5 starts/h
  demand  90 %: fill   642 s, empty    71 s, cycle   714 s ->  5.0 starts/h
```

With the standard 150 L vessel the worst case is 14 starts/h, just below the limit of 15/h. The 140 L calculated
value would give exactly 15. The self-test of `vessel.py` checks that the formula gives t_min = 1/f_max.

### 6.2 Effect of the switching band, starts per hour and variable speed

```python
def vb_volume_study(P=None, dps=(1.0, 2.0, 3.0), starts=(6, 10, 15, 30)):
    for dp in dps:
        for z in starts:
            rv = receiver_volume(dict(P, p_on_bar=P["p_off_bar"] - dp, starts_per_h_max=z))
```

```
## 6.2 Required volume (L) vs switching band and starts per hour
  dp bar        6/h      10/h      15/h      30/h
  1            701       420       280       140
  2            350       210       140        70
  3            234       140        93        47
  variable-speed compressor (min speed 30 %): 42 L instead of 140 L
```

- The volume is **inversely proportional** to the switching band and to the allowed starts. Halving the band from
  2 to 1 bar doubles the receiver (280 L at 15/h).
- A wide band saves receiver volume but costs energy. The compressor must reach p_off = 8 bar although the users
  need perhaps 6 bar. About 7 % more energy per bar (rule of thumb, check) – the band is an energy decision as well.
- A small motor (or a soft starter) that allows 30 starts/h needs only 70 L.
- A **variable-speed** compressor follows the demand down to its minimum speed (here 30 %). It only stops below
  that, so the receiver must buffer only q_min: 42 L. In practice a VSD system still gets a receiver of
  ~ 10–20 L per m³/min for pressure stability and condensate separation (check).

### 6.3 Size, L/D ratio and supports

For a given volume the diameter decides the length, the plate and the weight (`python vessel.py examples`):

```
## Diameter study (150 L)
  Di 300: shell 4.0 / head 4.0 mm, length 2170 mm (L/D 7.2), mass  66 kg
  Di 350: shell 4.0 / head 4.0 mm, length 1613 mm (L/D 4.6), mass  58 kg
  Di 400: shell 4.0 / head 4.0 mm, length 1255 mm (L/D 3.1), mass  52 kg
  Di 450: shell 4.0 / head 4.0 mm, length 1011 mm (L/D 2.2), mass  48 kg
  Di 500: shell 4.0 / head 5.0 mm, length  840 mm (L/D 1.7), mass  49 kg
```

Because the 4 mm minimum governs the shell for all diameters, a fatter vessel uses less surface and is lighter. The
lightest is D_i 450 (48 kg), 8 % lighter than the default D_i 400. At D_i 500 the Klöpper head needs 5 mm and the
weight rises again. In practice L/D ≈ 2.5–4 is chosen. It fits the compressor package (here the receiver lies under
the compressor as its base, so D_i 400 and 1.26 m length match the frame). Vertical receivers stand on 3 legs; a
long horizontal one lies on 2 saddles.

**Saddles (horizontal receiver).** The vessel is a beam on two supports, loaded by its own weight and, at the
hydraulic test, by its water filling. L.P. Zick's method gives the longitudinal bending moments at mid-span and at
the saddles, including the effect of the heads (simplified, check):

M_mid = Q·L/4 · [ (1 + 2(R² − H²)/L²)/(1 + 4H/(3L)) − 4A/L ]
M_saddle = Q·A · [ 1 − (1 − A/L + (R² − H²)/(2AL))/(1 + 4H/(3L)) ],  σ = M/(π·R²·t)

```python
def vb_saddles(P=None, A=150.0, water=True):
    ...
    W = (D["m_kg"] + (D["V"] if water else 0.0)) * 9.81
    Q = W / 2
    L, H, R, t = D["L_cyl"], D["h_head"], (P["Di"] + D["t_shell"]) / 2, D["t_shell"] - P["c_corr"] - P["c_tol"]
    k = 1 + 4 * H / (3 * L)
    Mm = Q * L / 4 * ((1 + 2 * (R * R - H * H) / L ** 2) / k - 4 * A / L)
    Ms = Q * A * (1 - (1 - A / L + (R * R - H * H) / (2 * A * L)) / k)
```

**Legs (vertical receiver).** Each leg carries W/n and must not buckle (Euler, cantilever leg with buckling length
2 × leg height, check):

```
## 6.3 Supports
  horizontal, 2 saddles A 150 mm, full of water: W 1984 N, Q 992 N; M mid 113 N m, M saddle 17 N m -> sigma 0.33 / 0.05 MPa (pressure axial 40.7 MPa)
  vertical, 3 legs 42.4 x 3.2, buckling length 400: F 661 N per leg, F_cr 987078 N (S 1493), stress 1.7 MPa (S 140)
```

For a 150 L receiver the support loads are negligible: the beam bending stress (0.33 MPa) is 1 % of the axial
pressure stress. What matters in practice are the **local** stresses at the saddle horn or the leg attachment (Zick's
circumferential and shear stresses; for legs, the local bending of the shell under the leg pad) and the
**vibration** transmitted from the compressor. Receivers that are also the compressor base need welded wear plates
under the saddles and a fatigue check of the attachment welds (chapter 4, `weld.py`). Large receivers (≥ 2000 L)
need the full Zick analysis.

### 6.4 Test pressure – and why it is hydraulic

Every vessel is pressure-tested before it leaves the factory. The test proves strength and tightness and blunts
small defects (a mild overload "shakes down" peak stresses).

- **EN 13445-5:** P_t = max(1.25·PS·f₂₀/f_T ; 1.43·PS). The first term corrects for the lower strength at design
  temperature, the second covers the minimum test.
- **EN 286-1 (simple vessels):** P_t = 1.5·PS.
- The membrane stress at test must stay below f_test = R_p0.2,20/1.05.

```python
def test_pressure(P, D):
    pt = max(1.25 * P["PS_bar"] * D["ds"]["f20"] / D["ds"]["f"], 1.43 * P["PS_bar"])
    sig = pt / 10 * P["Di"] / (2 * (D["t_shell"] - P["c_corr"] - P["c_tol"]))
    return {"P_test_bar": pt, "P_test_SPV_bar": 1.5 * P["PS_bar"], "sigma_test": sig, "f_test": D["ds"]["f_test"], "ok": sig <= D["ds"]["f_test"]}
```

**Why water, never air?** The add-on compares the energy stored at test pressure:

```python
def vb_test_energy(P=None, K_water=2200.0):
    ...
    hyd = (pt / 10) ** 2 * (D["V"] / 1000) / (2 * K_water) * 1e6
    pn = vb_stored_energy(pt, D["V"])["E_J"]
```

```
## 6.4 Test pressure and test energy
  P_test 15.73 bar (EN 13445-5), 16.5 bar (EN 286-1); shell stress at test 117 MPa vs 252
  stored energy at test: hydraulic 84.4 J, pneumatic 346154 J -> pneumatic is 4104 x larger
```

At 15.7 bar the water in the receiver stores 84 J (a little more with the elastic expansion of the steel). If a
defect opens, the vessel just leaks a few drops. The same test with air would store 346 kJ – 4100 times more, the
blast of 83 g TNT. A **pneumatic test** is allowed only when water cannot be used, with extra NDT, a reduced test
pressure (EN 13445-5: 1.1 PS, check) and a safety zone. The test stress (117 MPa) is less than half of f_test,
because the 4 mm plate is far thicker than pressure needs.

### 6.5 Category, conformity and documentation

From section 5.2: PS·V = 1650 bar·L. As an air receiver built under the **SPVD / EN 286-1** the vessel needs:

- a design examination or type examination by a notified body (the SPVD bands PS·V > 3000, 200 … 3000 and
  50 … 200 bar·L decide which modules: type examination plus surveillance of production or a manufacturer's
  declaration with design documents – check annex II of 2014/29/EU);
- material certificates EN 10204 **3.1** for plate and pressed heads;
- qualified welding procedures (WPQR, EN ISO 15614-1) and welders (EN ISO 9606-1) – chapter 7;
- the hydraulic test of every vessel, and the CE mark;
- a nameplate with: manufacturer, year, PS, TS (max and min), V, serial number, CE + notified body number;
- operating instructions (permitted use, inspection, the drain, the safety valve).

Under the PED (if the SPVD does not apply, e.g. a receiver for nitrogen above 30 bar) the same vessel would be
category III with modules B + D/F/E/C2, i.e. a notified body for both design and production.

### 6.6 Pressure-cycle fatigue

Each motor start is one pressure cycle of Δp = 2 bar. In 20 years at 6 starts/h and 4000 h/year this is
480 000 cycles. The membrane stress range is small (Δσ = Δp·D_i/(2e) = 14.8 MPa), but at the nozzle weld the
stress is concentrated (SCF 2 … 4). EN 13445-3 clause 17 (simplified fatigue) uses weld classes with S-N lines of
slope 3. The core reuses the weld S-N curve of `weld.py`, including its cut-off:

```python
def pressure_fatigue(P, D):
    import weld
    dp = (P["p_off_bar"] - P["p_on_bar"]) / 10
    e = D["t_shell"] - P["c_corr"] - P["c_tol"]
    ds = P["SCF_nozzle"] * dp * P["Di"] / (2 * e)
    n = P["duty_starts_per_h"] * P["hours_year"] * P["years"]
    N = weld.sn_cycles(ds, P["fat_class"], 3, "normal")
    return {"dp_MPa": dp, "dsigma": ds, "n": n, "N": N, "D": n / N, "ok": n <= N}
```

The add-on varies the stress concentration, the starts per hour and the weld class:

```
## 6.5 Pressure-cycle fatigue study (nozzle)
  SCF 1.0,  6 starts/h: dsigma  14.8 MPa, n 4.8e+05, N inf, D 0.000
  SCF 1.0, 15 starts/h: dsigma  14.8 MPa, n 1.2e+06, N inf, D 0.000
  SCF 1.0, 30 starts/h: dsigma  14.8 MPa, n 2.4e+06, N inf, D 0.000
  SCF 2.0,  6 starts/h: dsigma  29.6 MPa, n 4.8e+05, N 4.72e+07, D 0.010
  SCF 2.0, 15 starts/h: dsigma  29.6 MPa, n 1.2e+06, N 4.72e+07, D 0.025
  SCF 2.0, 30 starts/h: dsigma  29.6 MPa, n 2.4e+06, N 4.72e+07, D 0.051
  SCF 2.5,  6 starts/h: dsigma  37.0 MPa, n 4.8e+05, N 1.55e+07, D 0.031
  SCF 2.5, 15 starts/h: dsigma  37.0 MPa, n 1.2e+06, N 1.55e+07, D 0.078
  SCF 2.5, 30 starts/h: dsigma  37.0 MPa, n 2.4e+06, N 1.55e+07, D 0.155
  SCF 3.0,  6 starts/h: dsigma  44.4 MPa, n 4.8e+05, N 6.21e+06, D 0.077
  SCF 3.0, 15 starts/h: dsigma  44.4 MPa, n 1.2e+06, N 6.21e+06, D 0.193
  SCF 3.0, 30 starts/h: dsigma  44.4 MPa, n 2.4e+06, N 6.21e+06, D 0.386
  SCF 4.0,  6 starts/h: dsigma  59.3 MPa, n 4.8e+05, N 2.4e+06, D 0.200
  SCF 4.0, 15 starts/h: dsigma  59.3 MPa, n 1.2e+06, N 2.4e+06, D 0.499
  SCF 4.0, 30 starts/h: dsigma  59.3 MPa, n 2.4e+06, N 2.4e+06, D 0.999
  worst case SCF 4, 30/h with class 63: N 2.4e+06, D 1.00
  worst case SCF 4, 30/h with class 71: N 3.44e+06, D 0.70
  worst case SCF 4, 30/h with class 80: N 4.92e+06, D 0.49
```

- The default (SCF 2.5, 6 starts/h) uses 3 % of the fatigue life. Even at the worst case allowed by the receiver
  size (15 starts/h) it is 8 %.
- The receiver is designed with ample margin **because** the 4 mm plate is thick. A vessel designed exactly to the
  pressure formula (1.62 + allowances) would have about 1.6 times the stress range and 4 times the damage.
- The combination of a bad nozzle detail (SCF 4), a frequently cycling compressor (30/h) and a poor weld class
  reaches D = 1.0 in 20 years. This is the typical failure of cheap receivers on small piston compressors: a crack
  at the drain socket or a nozzle fillet weld after 10–15 years. Remedies: set-in nozzles with full-penetration
  welds (class 71–80), smooth weld toes, a larger receiver (fewer starts) and a smaller switching band.
- For a real design follow EN 13445-3 clause 17 (simplified, with the "pseudo-elastic" stress range, correction for
  thickness and temperature) or clause 18 (detailed, with structural hot-spot stress). Values here are a
  first assessment (check).

### 6.7 Condensate – how much water the receiver collects

Atmospheric air contains water vapour. The compressor squeezes it to 9 bar absolute, and the air cools in the
aftercooler and the receiver. The pressurised air can hold only a fraction of the water, so the rest condenses.

The water content (humidity ratio) of air is x = 0.622·p_v/(p − p_v) (kg water per kg dry air). The saturation
pressure p_s of water follows the Magnus formula p_s = 611.2·exp(17.62·T/(243.12 + T)) Pa (T in °C):

```python
def vb_condensate(P=None, T_amb=20.0, RH=0.70, T_rec=30.0, load=0.6, p_amb=1.013):
    pv_in = RH * vb_p_sat(T_amb)
    x_in = 0.622 * pv_in / (p_amb * 1e5 - pv_in)
    p_rec = (P["p_off_bar"] + p_amb) * 1e5
    x_sat = 0.622 * vb_p_sat(T_rec) / (p_rec - vb_p_sat(T_rec))
    m_air = P["Q_FAD_m3h"] * 1.204 * load                          # kg/h dry air (approx.)
    w = max(0.0, x_in - x_sat) * m_air                             # kg/h
```

```
## 6.6 Condensate (intake 20 C 70 % RH, receiver 30 C at 8 bar(g), 60 % load)
  water in 10.19 g/kg, saturated in receiver 2.94 g/kg, air 12.0 kg/h -> 0.087 L/h, 1.4 L per 16 h day, 0.35 m3 per year
```

Even this small compressor produces 1.4 L of water per day and 350 L per year. In summer (30 °C, 80 % RH) it is
more than twice as much. Consequences:

- the receiver must have a **drain at the lowest point** and an **automatic drain** (timer or level-controlled,
  with alarm). A manual drain is forgotten, and standing water is the main cause of corrosion (section 5.9);
- condensate contains compressor oil. It must not go to the sewer untreated (oil–water separator, local law);
- after the receiver a refrigeration dryer lowers the pressure dew point to +3 °C for the users (the receiver
  itself at 30 °C still gives saturated air).

### 6.8 Safety valve

The receiver must have a safety valve that can discharge the **full compressor delivery** when the pressure switch
fails, without the pressure rising more than 10 % above PS. ISO 4126-1 gives the capacity of a valve with flow area
A (mm²) for critical gas flow:

Q_m = 0.2883 · C · K_dr · A · p₀ · √(M/(Z·T))  [kg/h, p₀ bar abs, T in K]
C = 3.948·√(k·(2/(k+1))^((k+1)/(k−1)))  (= 2.703 for air)

K_dr is the certified (derated) discharge coefficient of the valve type, p₀ = 1.1·PS + p_atm the relieving pressure.

```python
def safety_valve(P, D):
    s = P["sv"]
    k = s["k"]
    C = 3.948 * math.sqrt(k * (2 / (k + 1)) ** ((k + 1) / (k - 1)))
    p0 = P["PS_bar"] * (1 + s["overpressure"]) + 1.013
    ...
    A = Qm / (0.2883 * C * s["K_dr"] * p0 * math.sqrt(s["M"] / (s["Z"] * T)))
```

The add-on picks the smallest standard valve and checks the reseat pressure:

```python
VB_SV_D0 = [4.0, 6.0, 8.0, 10.0, 12.0, 16.0, 20.0]          # flow diameters of small certified air safety valves mm (typical, check)

def vb_sv_select(P=None, blowdown=0.12):
    ...
    d0 = next(d for d in VB_SV_D0 if math.pi / 4 * d * d >= s["A_req_mm2"])
    reseat = P["PS_bar"] * (1 - blowdown)
    return {..., "reseat_above_cutout": reseat > P["p_off_bar"] * 1.1}
```

```
## 6.7 Safety valve
  required 7.68 mm2 -> smallest certified d0 4 mm (A 12.6 mm2, capacity 33 kg/h); set 11.0, full lift 12.1, reseat 9.7 bar -> above 1.1 x cut-out: yes
```

- 20 kg/h of air needs only 7.7 mm² of flow area. The smallest certified receiver valve (d₀ 4 mm, typically G¼ or
  G⅜) has 12.6 mm² and discharges 33 kg/h. That is enough even if the compressor is later replaced by a 1.6 × larger
  one.
- **Set pressure = PS = 11 bar**, full lift at 12.1 bar (+10 %). The valve closes again (**reseats**) about 12 %
  lower, at 9.7 bar. That is still above 1.1 × the cut-out pressure (8.8 bar). Otherwise a valve that has once
  opened would keep blowing in normal operation.
- The gap between cut-out (8 bar) and set pressure (11 bar) must also cover the pressure-switch tolerance and the
  pressure rise during the switch-off delay.
- The safety valve must be **CE-marked as a safety accessory** (PED category IV) and fitted without a shut-off valve
  between it and the receiver. Test it by lifting yearly.
- Also needed: a **pressure gauge** with the PS mark (red line), the **pressure switch** (cut-in / cut-out) and, for
  the compressor, a discharge temperature switch.

### 6.9 Inspection in operation

The operator is responsible for safe operation. In Germany the BetrSichV sets maximum intervals for vessels of
category III / IV (PS·V > 1000 bar·L for gases). Other countries have similar rules – check national law:

```
## 6.8 Inspection in operation (check national law)
  external inspection      2 years              corrosion outside, supports, safety valve, gauge, drain
  internal inspection      5 years              corrosion inside (wall thickness by UT), cracks at nozzles
  strength test            10 years             hydraulic test at test pressure, or replaced by NDT
  safety valve function    yearly (operator)    lift by hand / bench test of set pressure
  condensate drain         daily / automatic    auto drain with alarm
```

At the internal inspection a small receiver (no manhole) is checked through an inspection opening or with an
endoscope. The wall thickness is measured by ultrasound and compared with e_req + c_tol. For the default shell:
1.62 + 0.3 = 1.92 mm minimum, against 4.0 mm new. If the wall loses more than the 1 mm allowance, the vessel must
be re-rated or scrapped. With an automatic drain and an internal coating it can last the full 20+ years.

### 6.10 Summary – the receiver drawing

| Item | Value | Reason |
|---|---|---|
| Volume | 150 L standard (140 L required) | ≤ 15 starts/h at the worst demand (50 %), Δp 2 bar |
| Shell | D_i 400 × 4 mm P265GH, longitudinal weld testing group 3 (z 0.85) | pressure needs 2.92 mm incl. allowances; 4 mm for the DN50 opening and rolling practice |
| Heads | Klöpper DIN 28011, 4 mm, pressed | knuckle governs (M 1.54); forming thinning 10 % |
| Length | 1092 mm cylinder, 1255 mm overall, 52 kg | volume and package layout |
| Nozzles | DN50 outlet set-in, no pad; G½ drain at the lowest point; G¼/G⅜ safety valve; gauge; switch | area replacement OK at 4 mm |
| Design data | PS 11 bar, TS 100 °C, T_min −10 °C, full vacuum allowed | nameplate |
| Test | hydraulic 15.7 bar (EN 13445-5) / 16.5 bar (EN 286-1) | stress 117 MPa < 252 MPa |
| Category | SPVD / EN 286-1 (PED would be category III) | air, PS·V 1650 bar·L |
| Fatigue | 480 000 cycles, D 0.03 (SCF 2.5, class 63) | margin for up to 15 starts/h |
| Safety valve | set 11 bar, d₀ 4 mm (12.6 mm², 33 kg/h) | full FAD at +10 % |
| Corrosion | c 1 mm, automatic drain, internal coating | 350 L condensate per year |


---

## 7. Manufacturing: welding processes, WPS / WPQR, welder qualification, heat input and preheat, distortion and residual stress, PWHT, NDT and quality levels, weld cost, vessel and frame fabrication, inspection, failure modes

A weld calculation is only true if the weld is **made as drawn**. A weld has the right throat, full fusion, no cracks,
no hard heat-affected zone (HAZ), acceptable distortion, and a quality level that matches the fatigue class assumed in
chapter 4. This chapter follows the joint from the welding process to the inspection report. Every number comes
from the add-on of chapters 7–8 in `weld.py`:

```
python weld.py ch78
```

### 7.1 Welding processes (ISO 4063) and heat input

ISO 4063 gives every process a number. That number appears in the weld symbol (EN ISO 2553), in the WPS and in the
welder certificate. The processes a machine builder meets:

```python
WM_PROCESSES = [   # ISO 4063 number, name, thermal efficiency k (EN 1011-1), deposition kg/h (typical), use (check)
    (111, "manual metal arc (MMA, stick)", 0.8, 1.0, "site work, repairs, all positions; slow, slag"),
    (135, "MAG solid wire", 0.8, 3.0, "workshop standard for steel frames; spatter, needs gas shield from wind"),
    ...
    (121, "submerged arc (SAW), single wire", 1.0, 8.0, "long seams of vessels and beams, flat position, deep penetration"),
    ...
]
```

```
## 7.1 Welding processes (ISO 4063) and heat input
  111 manual metal arc (MMA, stick)              k 0.8  deposition  1.0 kg/h  site work, repairs, all positions; slow, slag
  135 MAG solid wire                             k 0.8  deposition  3.0 kg/h  workshop standard for steel frames; spatter, needs gas shield from wind
  136 MAG flux-cored wire (gas shielded)         k 0.8  deposition  4.5 kg/h  positional welding of thick plate, high deposition
  138 MAG metal-cored wire                       k 0.8  deposition  5.0 kg/h  robot welding, fillet welds, little slag
  141 TIG                                        k 0.6  deposition  0.5 kg/h  thin sheet, stainless, root runs of pipes and vessels; best quality, slow
  121 submerged arc (SAW), single wire           k 1.0  deposition  8.0 kg/h  long seams of vessels and beams, flat position, deep penetration
   52 laser beam welding                         k 0.9  deposition  0.0 kg/h  thin sheet, car bodies, very low heat input; needs fit-up < 0.1 mm
   21 resistance spot welding                    k 1.0  deposition  0.0 kg/h  sheet metal 0.5-3 mm, no filler; strength by spot diameter 5 sqrt(t)
  783 drawn-arc stud welding (ceramic ferrule)   k 1.0  deposition  0.0 kg/h  shear studs, threaded studs on plates
```

How to choose the process:
- **Frames and brackets in the workshop:** MAG 135. On a robot, MAG 138 metal-cored wire.
- **Long straight seams in the flat position** (vessel shells, beam flanges): SAW 121. It gives deep penetration and
  about 3 × the deposition of MAG.
- **Thin stainless sheet and pipe roots:** TIG 141.
- **On site, in wind:** MMA 111. The gas shield of MAG is blown away by wind.

**Heat input** is the energy put into each millimetre of weld. It controls the cooling rate (and with it the HAZ
hardness), the distortion and the toughness. EN 1011-1 defines it as

  Q = k · U · I / v  (kJ/mm),  k = thermal efficiency of the process (0.6 TIG … 1.0 SAW)

```python
def wm_heat_input(U, I, v_mm_min, k=0.8):
    """Heat input Q = k U I / v (kJ/mm), v travel speed: Q = k U I 60 / (1000 v[mm/min])."""
    return k * U * I * 60 / (1000 * v_mm_min)
```

```
  135 MAG fillet a 3 (bracket)   U 22.0 V, I 200 A, v 450 mm/min -> Q = 0.47 kJ/mm
  135 MAG fillet a 6             U 29.0 V, I 280 A, v 300 mm/min -> Q = 1.30 kJ/mm
  121 SAW long seam t 4          U 28.0 V, I 380 A, v 900 mm/min -> Q = 0.71 kJ/mm
  141 TIG root                   U 12.0 V, I 110 A, v  80 mm/min -> Q = 0.59 kJ/mm
```

The a 3 fillet of the motor bracket post (chapter 2) needs only 0.47 kJ/mm. That is low heat input, so the weld
cools fast, and the next section checks whether that makes the HAZ too hard.

### 7.2 Carbon equivalent, preheat (EN 1011-2), cooling time t8/5 and HAZ hardness

**Why preheat?** Next to the weld, the steel is heated above 900 °C and cooled quickly. If it cools too fast it turns
into hard martensite. Hydrogen from moisture, rust or the consumable, together with the restraint of the joint,
then cracks this hard zone, often hours after welding (cold cracking, hydrogen cracking). Preheating slows the
cooling and lets the hydrogen escape.

**Carbon equivalent.** The hardening tendency is expressed by one number. EN 1011-2 method B uses

  CET = C + (Mn + Mo)/10 + (Cr + Cu)/20 + Ni/40

(the older CE(IIW) = C + Mn/6 + (Cr + Mo + V)/5 + (Ni + Cu)/15 is printed on most mill certificates).

```python
def wm_cet(c):
    """CET = C + (Mn + Mo)/10 + (Cr + Cu)/20 + Ni/40 (EN 1011-2 annex C)."""
    return c["C"] + (c["Mn"] + c["Mo"]) / 10 + (c["Cr"] + c["Cu"]) / 20 + c["Ni"] / 40
```

**Preheat temperature, EN 1011-2 method B.** The preheat temperature is the sum of four terms: steel, thickness d,
hydrogen content HD of the weld metal (ml per 100 g), and heat input Q:

  T_p = T_pCET + T_pd + T_pHD + T_pQ
  T_pCET = 750·CET − 150
  T_pd = 160·tanh(d/35) − 110
  T_pHD = 62·HD^0.35 − 100
  T_pQ = (53·CET − 32)·Q − 53·CET + 32

These formulas are valid for CET 0.2–0.5, d 10–90 mm, HD 1–20 and Q 0.5–4 kJ/mm (check the standard).

```python
def wm_preheat(CET, d, HD, Q):
    parts = {"CET": 750 * CET - 150, "d": 160 * math.tanh(d / 35) - 110, "HD": 62 * HD ** 0.35 - 100,
             "Q": (53 * CET - 32) * Q - 53 * CET + 32}
    return {"parts": parts, "T_p": sum(parts.values())}
```

```
## 7.2 Carbon equivalent, preheat (EN 1011-2 method B), cooling time, hardness
  S355 example cast: C 0.18 Mn 1.45 ... -> CET 0.336, CE(IIW) 0.446
  d 10 mm, HD  5, Q 0.59 kJ/mm: T_p = +102 -65 +9 +6 =   51 C -> preheat 75 C
  d 20 mm, HD  5, Q 0.59 kJ/mm: T_p = +102 -27 +9 +6 =   89 C -> preheat 100 C
  d 20 mm, HD 10, Q 0.59 kJ/mm: T_p = +102 -27 +39 +6 =  119 C -> preheat 125 C
  d 40 mm, HD  5, Q 1.00 kJ/mm: T_p = +102 +20 +9 +0 =  131 C -> preheat 150 C
  d 40 mm, HD 10, Q 1.00 kJ/mm: T_p = +102 +20 +39 +0 =  161 C -> preheat 175 C
  d 60 mm, HD 15, Q 1.00 kJ/mm: T_p = +102 +40 +60 +0 =  202 C -> preheat 225 C
```

What the numbers mean in the workshop:
- **The steel term dominates.** The example cast is at the upper end of S355 (C 0.18, Mn 1.45). With CET 0.336 the
  steel alone asks for +102 °C. A low-carbon S355 (C 0.12) would ask for about 50 K less. **Read the CET from the 3.1
  certificate**, not from the standard maximum.
- **Hydrogen is cheap to control.** Going from HD 10 (rutile MMA electrodes, damp wire) to HD 5 (basic electrodes
  baked, MAG solid wire) saves 30 K of preheat.
- **Thickness d** is the plate thickness at the joint. For a T-joint use the thicker plate (the end plate of the
  worked example, 20 mm → 100 °C). Thin wall parts below 10 mm, like the bracket post, are outside the method's
  range; there the joint is usually welded without preheat above 5 °C ambient, after removing condensation (check).
- **Higher heat input** reduces T_pQ slightly (slower cooling). It is not a substitute for preheat on thick plate.

**Cooling time t8/5.** This is the time the HAZ needs to cool from 800 to 500 °C, the range where the microstructure
forms. EN 1011-2 annex D gives two cases. For thick plate (3-D heat flow) t8/5 does not depend on thickness. For
thin plate (2-D heat flow) it grows with Q²/d²:

  3-D: t8/5 = (6700 − 5·T0)·Q·[1/(500 − T0) − 1/(800 − T0)]·F3
  2-D: t8/5 = (4300 − 4.3·T0)·10⁵·(Q²/d²)·[(1/(500 − T0))² − (1/(800 − T0))²]·F2

T0 is the preheat (or ambient) temperature, and F2, F3 are shape factors (fillet weld in a T-joint ≈ 0.67, check
table D.1). The larger value applies; the transition thickness is where both are equal.

```python
def wm_t85(Q, d, T0=20.0, F2=0.67, F3=0.67):
    t3 = (6700 - 5 * T0) * Q * (1 / (500 - T0) - 1 / (800 - T0)) * F3
    t2 = (4300 - 4.3 * T0) * 1e5 * Q ** 2 / d ** 2 * ((1 / (500 - T0)) ** 2 - (1 / (800 - T0)) ** 2) * F2
    ...
    return {"t_3D": t3, "t_2D": t2, "t85": max(t2, t3), "mode": "2-D (thin)" if t2 > t3 else "3-D (thick)", "d_transition": dt}
```

```
  t8/5: Q 0.59 kJ/mm, d  5 mm, T0  20 C -> 3-D 2.1 s, 2-D 10.6 s -> 10.6 s (2-D (thin), transition d 11.3 mm)
  t8/5: Q 0.59 kJ/mm, d 10 mm, T0  20 C -> 3-D 2.1 s, 2-D 2.7 s -> 2.7 s (2-D (thin), transition d 11.3 mm)
  t8/5: Q 1.00 kJ/mm, d 20 mm, T0  20 C -> 3-D 3.5 s, 2-D 1.9 s -> 3.5 s (3-D (thick), transition d 14.7 mm)
  t8/5: Q 1.00 kJ/mm, d 40 mm, T0  20 C -> 3-D 3.5 s, 2-D 0.5 s -> 3.5 s (3-D (thick), transition d 14.7 mm)
  t8/5: Q 1.00 kJ/mm, d 40 mm, T0 100 C -> 3-D 4.5 s, 2-D 0.7 s -> 4.5 s (3-D (thick), transition d 15.7 mm)
  martensite upper bound HV_M (C 0.18) = 452 HV; ISO 15614-1 limit without PWHT (group 1) 380 HV10 - check
```

- The thin 5 mm bracket wall keeps the heat. Its t8/5 is 10.6 s, a soft HAZ.
- A single fillet weld on 20–40 mm plate cools in only 3.5 s. Preheat to 100 °C lengthens it to 4.5 s. The usual
  target for S355 is t8/5 ≈ 10–25 s: long enough for a soft HAZ, short enough for good toughness (check with the
  steel maker).
- The upper bound of HAZ hardness is fully martensitic, HV_M = 884·C·(1 − 0.3·C²) + 294 = **452 HV** for C 0.18.
  This is above the 380 HV10 that ISO 15614-1 accepts for group-1 steels without PWHT. Short cooling times on thick
  plate therefore need **preheat or more heat input**; the WPQR hardness test (chapter 7.4) proves the result.

```python
def wm_hv_martensite(C):
    """Upper bound of HAZ hardness (fully martensitic, Yurioka style): HV_M = 884 C (1 - 0.3 C^2) + 294 (check)."""
    return 884 * C * (1 - 0.3 * C * C) + 294
```

**Lamellar tearing.** In thick plates loaded across the thickness (T-joints and cruciform joints), the shrinkage of
a large weld can tear the plate along flat inclusions. Remedies: order plate with through-thickness properties
(EN 10164 Z25 / Z35), use smaller welds (no oversized a), or change the joint so the plate is not pulled across its
thickness.

### 7.3 Shrinkage, distortion and residual stress

Weld metal shrinks when it cools from about 1500 °C, and the neighbouring cold steel resists. The result:
- a **longitudinal shrinkage force** along each weld (members shorten and bow);
- **transverse shrinkage** across butt welds;
- **angular distortion** of fillet and single-sided butt welds;
- **residual stresses up to the yield strength** in and next to the weld.

**Longitudinal shrinkage force (Okerblom).** The force of one weld run is proportional to the heat input:

  F = 0.335 · α·E/(c·ρ) · q   (q = Q in J/mm)

For steel, α·E/(c·ρ) = 12·10⁻⁶ · 210 000 / 3.74·10⁻³ = 674 N·mm/J. A member with this force at eccentricity e from
its neutral axis shortens and bows:

  ΔL = F·L/(E·A),  bow f = F·e·L²/(8·E·I)

```python
WM_ALPHA_E_CRHO = 12e-6 * 210000 / 3.74e-3      # alpha E / (c rho) of steel, N/J (12e-6 1/K, 210 GPa, 3.74 J/(cm3 K))

def wm_shrink_force(Q_kJmm):
    return 0.335 * WM_ALPHA_E_CRHO * Q_kJmm * 1000

def wm_distortion(Q_kJmm, L, A, I, e, n_runs=1, E=210000.0):
    F = n_runs * wm_shrink_force(Q_kJmm)
    return {"F": F, "dL": F * L / (E * A), "bow": F * e * L ** 2 / (8 * E * I)}
```

```
## 7.3 Shrinkage and distortion
  shrinkage force of one run, Q 0.59 kJ/mm: F = 0.335 x 673.797 N/J x 590 J/mm = 133.2 kN
  shrinkage force of one run, Q 1.00 kJ/mm: F = 0.335 x 673.797 N/J x 1000 J/mm = 225.7 kN
  shrinkage force of one run, Q 1.60 kJ/mm: F = 0.335 x 673.797 N/J x 1600 J/mm = 361.2 kN
  RHS 120x120x6, 2 m, two runs Q 1.0 on one face (e 60 mm): F 451 kN, shortening 1.571 mm, bow 10.85 mm
  same, welds balanced on both faces (e 0): F 903 kN, shortening 3.143 mm, bow 0.00 mm
  V-butt t 10: weld area 76 mm2 -> transverse shrinkage ~ 0.18 A_w / t = 1.37 mm
```

(The unit printed as "N/J" is N·mm/J.) Lessons for the frame designer:
- A stiffener welded with two runs along one face of a 2 m RHS bows it by about **11 mm** (Okerblom gives an upper
  estimate; real values are often 50–70 % of it, check by trial). The same welds placed **symmetrically** give no
  bow, only 3 mm of shortening, and the shortening can be allowed for in the cutting length.
- **Heat input and weld size drive distortion.** An a 6 weld instead of a 4 has 2.25 × the weld metal and roughly
  2 × the shrinkage force. Never make welds larger than the calculation needs.
- **Transverse shrinkage** of butt welds (≈ 0.18·A_w/t, here 1.4 mm per joint) must be added to the cut lengths of
  frames with many butt joints.
- Residual stresses do not lower the static strength of ductile steel. They are the reason the fatigue curves of
  chapter 4 are **independent of the mean stress** for as-welded joints: the weld region is already at yield, so
  every applied range is effectively a tensile range.

### 7.4 PWHT, procedures, welder qualification, execution class, NDT and quality levels

**Post-weld heat treatment (PWHT, stress relief).** Heating the whole part to 580–620 °C (for P265GH / S355) lets
the residual stresses relax to about 20 % of yield. It also tempers hard HAZ. It is required by the codes for thick
vessel walls, for some steels, and for precision frames that are machined after welding.

```python
def wm_pwht(t, steel="P265GH"):
    """Post-weld heat treatment (EN 13445-4 style, check): holding 580-620 C for 2 min/mm (min 30 min);
    heating and cooling above 400 C at most 5500/t K/h, max 220 K/h."""
    hold = max(30.0, 2.0 * t)
    rate = min(220.0, 5500.0 / t)
    return {"T": (580, 620), "hold_min": hold, "rate_Kh": rate, "time_400_600_h": 2 * 200 / rate}
```

```
## 7.4 PWHT, execution classes, NDT, ISO 5817
  t  4 mm: hold  30 min at 580-620 C, heating/cooling <= 220 K/h above 400 C (1.8 h for 400 -> 600 -> 400)
  t 10 mm: hold  30 min at 580-620 C, heating/cooling <= 220 K/h above 400 C (1.8 h for 400 -> 600 -> 400)
  t 25 mm: hold  50 min at 580-620 C, heating/cooling <= 220 K/h above 400 C (1.8 h for 400 -> 600 -> 400)
  t 50 mm: hold 100 min at 580-620 C, heating/cooling <= 110 K/h above 400 C (3.6 h for 400 -> 600 -> 400)
```

The 4 mm air receiver does not need PWHT. For P265GH the codes require it only above roughly 35 mm wall (check
EN 13445-4). A welded machine bed with machined guideways, however, is stress relieved before machining, so it does
not move when material is cut away.

**WPS and WPQR (ISO 15614-1).** Every production weld is made to a written **welding procedure specification (WPS)**:
- process;
- base and filler material;
- joint preparation;
- position;
- current, voltage and travel speed (so the heat input);
- preheat and interpass temperature;
- gas.

A WPS is valid only if it is backed by a **welding procedure qualification record (WPQR)**. To get one, a test piece
is welded and then examined:

| Test | Purpose |
|---|---|
| visual, MT / PT | surface defects |
| RT / UT | internal defects |
| tensile test | strength |
| bend tests | ductility, lack of fusion |
| macro section | penetration, throat, profile |
| hardness survey (HV10) | HAZ hardness, max 380 HV for group-1 steels without PWHT – check |
| impact test | toughness at the design temperature (if required) |

The WPQR fixes ranges of validity: thickness range, heat-input range ± 25 %, position, material group. A weld outside
these ranges needs a new qualification.

**Welder qualification (ISO 9606-1).** Each welder is tested for a process, material group, joint type, position and
thickness range. The certificate must be confirmed every 6 months by the welding coordinator and revalidated every
2–3 years (check the current edition). Robot operators are qualified to ISO 14732.

**Quality system (ISO 3834) and execution class (EN 1090-2).** ISO 3834 parts 2–4 define the quality requirements of
the welding workshop, from comprehensive to elementary: responsible welding coordinator, equipment, procedures,
traceability. Steel structures, and frames used as structures, are grouped into execution classes:

```
  EXC1: agricultural / light secondary steelwork, static        level D                        NDT: visual only
  EXC2: normal buildings, machine frames, cranes in normal duty level C (B for fatigue details) NDT: fillet / partial pen.: 5 % MT/PT if a > 12 mm; transverse butt welds 10 % UT/RT
  EXC3: large spans, fatigue-loaded structures, cranes          level B                        NDT: transverse butt 20 %, fillet 10 % (MT), first 5 joints of a new WPS 100 %
  EXC4: bridges, consequences of failure extreme                level B+                       NDT: transverse butt 100 %, fillet 20 %
```

The motor bracket post is EXC1–EXC2. The jib crane of chapter 8 is EXC2 at least; with its fatigue loading the
critical root joint is specified as EXC3 / level B on the drawing. The air receiver is not under EN 1090: it follows
the vessel code and its testing group (chapter 6).

**Non-destructive testing (NDT).**

```
  VT visual                        finds surface defects, shape, size, undercut, spatter  | 100 % of all welds, before any other NDT     | ISO 17637
  PT dye penetrant                 finds surface-open cracks, pores                       | all materials, small parts                   | ISO 3452 / 23277
  MT magnetic particle             finds surface and near-surface cracks                  | ferritic steel only, fillet weld toes        | ISO 17638 / 23278
  UT ultrasonic (incl. PAUT, TOFD) finds volume defects, lack of fusion, cracks           | t >= 8 mm, butt welds, T-joints              | ISO 17640 / 11666
  RT radiography (film / digital)  finds pores, slag, lack of penetration (volume defects) | butt welds, vessel seams; radiation protection | ISO 17636 / 10675
```

Surface methods (VT, PT, MT) find what starts fatigue cracks: undercut, toe cracks. Volume methods (UT, RT) find what
weakens butt welds: lack of fusion, porosity, slag. UT finds planar defects (cracks, lack of fusion) better; RT finds
pores and slag better and leaves a document.

**Quality levels (ISO 5817).** ISO 5817 gives limits for each imperfection in three levels: B (stringent),
C (intermediate), D (moderate). Some examples:

```
  ISO 5817 (examples):            level B                  level C                          level D
  undercut (continuous), h       0.05 t, max 0.5 mm       0.1 t, max 0.5 mm                0.2 t, max 1.0 mm
  excess weld metal (butt), h    1 + 0.1 b, max 5 mm      1 + 0.15 b, max 7 mm             1 + 0.25 b, max 10 mm
  throat too small (fillet), h   not permitted            0.3 + 0.1 a, max 1 mm (short)    0.3 + 0.1 a, max 2 mm (short)
  throat too large (fillet), h   1 + 0.15 a, max 3 mm     1 + 0.2 a, max 4 mm              1 + 0.3 a, max 5 mm
  surface pore, d                not permitted            0.2 s, max 2 mm                  0.3 s, max 3 mm
  incomplete root penetration    not permitted            not permitted                    short: 0.2 t, max 2 mm
  crack                          not permitted            not permitted                    not permitted
```

**The link to the fatigue calculation is direct.** The FAT classes of chapter 4 assume a minimum weld quality, about
level C for most as-welded details. ISO 5817 annex C adds the levels B90 and B125 for the high classes FAT 90 and
FAT 125. A drawing that uses FAT 71 for a full-penetration root joint must also specify full penetration, level B,
and UT. Otherwise the calculation is a wish. Note also "throat too large": an oversized weld is an imperfection
because it adds distortion and cost.

### 7.5 Weld metal volume and cost per metre

Weld metal per metre follows from the cross-section A of the weld:
- **fillet weld** with equal legs z = a·√2: A = a², plus about 10 % convexity;
- **V-butt weld** (opening angle α, gap g, root face c, cap): A = (t − c)²·tan(α/2) + g·t + 0.7·width·cap height.

The cost per metre is calculated as follows:
- arc time = weld metal mass / deposition rate;
- labour time = arc time / operating factor (only 30–40 % of a welder's time is arc time: fit-up, tacking, slag,
  repositioning);
- cost = labour + wire + gas + power.

```python
def wm_area_fillet(a, excess=0.10):
    return a * a * (1 + excess)

def wm_cost_per_m(A_mm2, dep_kgh, c=None):
    c = WM_COST if c is None else c
    m = A_mm2 * 1000 * 7.85e-6                       # kg per metre
    t_arc = m / dep_kgh                              # h
    t_lab = t_arc / c["op_factor"]
    cost = {"labour": t_lab * c["labour_eur_h"], "wire": m / c["deposit_eff"] * c["wire_eur_kg"],
            "gas": t_arc * 60 * c["gas_l_min"] * c["gas_eur_l"], "power": t_arc * c["power_kW"] * c["power_eur_kWh"]}
    return {"kg_m": m, "arc_min_m": t_arc * 60, "labour_min_m": t_lab * 60, "cost": cost, "total": sum(cost.values())}
```

with workshop data `WM_COST`: labour 55 €/h, wire 2.8 €/kg, gas 15 L/min, operating factor 0.35 (typical, check).

```
## 7.5 Weld metal and cost per metre (135 MAG, 3 kg/h unless stated)
  fillet a 3 (bracket post)              A    9.9 mm2, 0.078 kg/m, arc   1.6 min/m, labour   4.4 min/m ->   4.62 EUR/m (labour 4.07, wire 0.23, gas 0.28, power 0.04)
  fillet a 4                             A   17.6 mm2, 0.138 kg/m, arc   2.8 min/m, labour   7.9 min/m ->   8.22 EUR/m (labour 7.24, wire 0.41, gas 0.50, power 0.07)
  fillet a 6                             A   39.6 mm2, 0.311 kg/m, arc   6.2 min/m, labour  17.8 min/m ->  18.48 EUR/m (labour 16.28, wire 0.92, gas 1.12, power 0.17)
  fillet a 8 (2 x a 4 would be cheaper)  A   70.4 mm2, 0.553 kg/m, arc   7.4 min/m, labour  21.1 min/m ->  22.45 EUR/m (labour 19.30, wire 1.63, gas 1.33, power 0.20)
  V-butt t 6 (60 deg, gap 2)             A   33.3 mm2, 0.262 kg/m, arc   5.2 min/m, labour  15.0 min/m ->  15.57 EUR/m (labour 13.71, wire 0.77, gas 0.94, power 0.14)
  V-butt t 10                            A   76.2 mm2, 0.598 kg/m, arc  12.0 min/m, labour  34.2 min/m ->  35.58 EUR/m (labour 31.34, wire 1.76, gas 2.15, power 0.32)
  X-butt t 20                            A  169.6 mm2, 1.332 kg/m, arc  17.8 min/m, labour  50.7 min/m ->  54.09 EUR/m (labour 46.50, wire 3.92, gas 3.20, power 0.47)
  I-butt t 4, SAW (receiver seam)        A   16.4 mm2, 0.129 kg/m, arc   1.0 min/m, labour   2.8 min/m ->   3.11 EUR/m (labour 2.53, wire 0.38, gas 0.17, power 0.03)
  fillet weld cost grows with a^2: a 6 instead of a 3 = 4.0 x the cost; the bracket post (a 3, 320 mm) costs 1.48 EUR
```

Three rules follow:
1. **Labour is 85–90 % of the weld cost.** Wire and gas hardly matter, so deposition rate and operating factor
   (jigs, robot, positioners) decide the cost.
2. **Fillet cost grows with a².** Doubling a costs 4 ×. The throat study of chapter 2 showed that the bracket post
   needs only a 3; an "a 6 to be safe" would cost 4 × as much and distort the post.
3. **Double fillets beat single large ones.** Two a 4 fillets (2 × 8.22 = 16.4 €/m) carry more than one a 8
   (22.45 €/m) and distort less. **X-butt welds beat V-butts for t > 12 mm**: half the weld metal and balanced
   shrinkage.

### 7.6 Fabrication of the air receiver

The receiver of chapter 6 (`vessel.py` default: 150 L, Di 400, shell and heads 4 mm P265GH, PS 11 bar) is made in this
order. The route below is the one used for simple pressure vessels and PED category I–III receivers:

```
## 7.6 Fabrication of the air receiver (vessel.py default)
  1 material receipt       plate P265GH with 3.1 certificate (EN 10204), heads bought pressed                           traceability: heat number transferred to every part
  2 cutting                plasma or laser cutting of the shell plate, edge preparation                                 developed length = pi x mean diameter
  3 rolling                3- or 4-roll bending to the cylinder, ends pre-bent                                          out-of-roundness <= 1 % (EN 13445-4), peaking at the seam
  4 longitudinal seam      SAW (121) or MAG, I- or V-joint, run-on / run-off plates                                     production test plate for category III, RT of the seam
  5 heads                  dished heads pressed / spun from a blank (Kloepper DIN 28011), cylindrical flange 3.5 e      thinning in the knuckle ~10 % (head_e allowance)
  6 nozzles and bosses     set-in nozzles cut by template, full-penetration welds, threaded bosses for drain / gauge / safety valve area replacement (vessel.nozzle())
  7 circumferential seams  head-to-shell with backing strip or joggle, MAG / SAW on rotator                             alignment (offset) <= 0.1 e + 1 mm, check the code
  8 supports               feet / saddles fillet welded to pads, not directly on the shell                              pads avoid local bending at the shell
  9 NDT                    VT 100 %, RT/UT of seams by testing group, MT of nozzle welds                                joint coefficient z follows the testing group
  10 pressure test         hydrostatic test at P_t (vessel.test_pressure()), hold >= 30 min, inspect                    never pneumatic unless approved (stored energy)
  11 surface               shot blasting, inside: galvanising or epoxy coating; outside: paint                          corrosion allowance c already in the wall
  12 marking and papers    nameplate (PS, TS, V, year, number), CE + notified body number, declaration, instructions    SPVD / PED documentation, kept 10 years
  seams: longitudinal 1.09 m (SAW I-butt, 3.11 EUR/m), circumferential 2 x 1.27 m (MAG V-butt on backing, 7.50 EUR/m), 4 nozzles / bosses 0.73 m (fillet a 4, 8.22 EUR/m)
  welding cost of the receiver ~ 28 EUR (arc time only); test pressure 15.73 bar; PWHT not required for t 4 mm P265GH (check EN 13445-4)
```

The calculation reads the design from `vessel.design()` (shell length, diameters, plate thickness) and prices each
seam with `wm_cost_per_m()`:

```python
    D = vessel.design(V)
    L_long = D["L_cyl"] / 1000
    L_circ = 2 * math.pi * (V["Di"] + D["t_shell"]) / 1000
    ...
    tot = L_long * c1["total"] + L_circ * c2["total"] + L_noz * c3["total"]
```

Points worth knowing:
- **Welding is cheap; testing and papers are not.** About 28 € of arc-related cost for the whole receiver. The RT of
  the seams, the hydrotest, and the notified body (category III / SPVD) cost much more. This is why receivers are bought
  as standard catalogue items and not designed for each machine.
- **The joint coefficient is a fabrication decision.** Chapter 6 used z = 0.85 (testing group 3, spot NDT). With
  100 % RT (z = 1.0) the required shell thickness would drop from 1.62 to 1.37 mm, but the 4 mm minimum governs anyway.
  For this receiver, spot testing is the economic choice.
- **Circumferential seams on backing strips** leave a crevice inside. With condensate in an air receiver this is a
  corrosion spot. The **drain boss at the lowest point** and a regular drain are part of the design.
- **Hydrostatic, never pneumatic, testing.** At 15.7 bar, 150 L of water stores almost no energy; 150 L of air stores
  about 0.3 MJ.

### 7.7 Frame fabrication, inspection plan and failure modes

**Welded frames** (machine beds, motor and compressor bases, the jib of chapter 8) are made in a fixed sequence:

```
## 7.7 Frame fabrication, inspection plan, failure modes
  jig / fixture            locates the members to the drawing datums; prevents distortion; datums = function surfaces later machined
  tack welding             tacks 3-4 a long, by qualified welders with the WPS; symmetric sequence, preheat as for the weld
  welding sequence         from the centre outwards, alternate sides (balance shrinkage), long welds back-step
  pre-setting              pre-bend parts against the expected angular distortion (e.g. 1-2 deg for single fillets)
  straightening            flame straightening at 600-650 C (S355, never above 700 C) or press; check fatigue details afterwards
  machining after welding  bearing seats, motor feet and mounting faces machined after welding (and stress relief if precision needed)
```

The motor feet of the compressor base must be flat within about 0.1 mm for the belt alignment of M9. A welded base
cannot hold that as welded: specify **machining of the motor and compressor pads after welding**.

**Inspection plan** (for a fatigue-loaded frame, EXC2 / EXC3):

```
  welder / operator qualification        ISO 9606-1 / ISO 14732 certificates, valid           before start
  WPS available at the workplace         visual check                                         every job
  preheat temperature                    contact thermometer / crayon at 75 mm from the joint every joint, before the first run
  heat input (U, I, v)                   weld monitor / measurement                           first part + random
  throat thickness a                     fillet weld gauge                                    every weld (EXC2: 100 % visual + gauge)
  visual imperfections ISO 5817          VT ISO 17637                                         100 %
  cracks at fatigue-critical toes        MT ISO 17638                                         per EXC / drawing (e.g. 100 % at the jib root)
  butt welds                             UT / RT                                              per EXC / testing group
  dimensions after welding               tape, square, CMM / laser tracker for machined frames first article + sampling
```

**Failure modes of welded parts:**

```
  fatigue crack at the weld toe  | crack along the toe, beach marks     | high stress range at a low-FAT detail            | better detail class, toe grinding / HFMI, move the weld out of the stress flow
  fatigue crack from the root    | crack through the throat of a fillet | load-carrying fillet too small (FAT 36)          | full-penetration weld or larger throat
  hydrogen (cold) crack          | crack in the HAZ hours after welding | hard HAZ + hydrogen + restraint                  | preheat (EN 1011-2), low-hydrogen consumables, dry electrodes
  solidification (hot) crack     | centre-line crack in the weld metal  | deep narrow bead, S/P impurities                 | bead width/depth > 1, less current, cleaner wire
  lamellar tearing               | step-like crack under a T-joint in thick plate | through-thickness weakness (inclusions)          | Z-quality plate (EN 10164 Z25/Z35), change joint
  lack of fusion / penetration   | found by UT/RT, or fracture surface  | wrong parameters, angle, access                  | WPS, welder training, joint preparation
  brittle fracture               | flat fracture, chevrons, at low temperature | low toughness (J0/J2 grade too low), thick plate, notch | toughness grade per EN 1993-1-10, avoid notches
  excessive distortion           | parts out of tolerance               | too much heat, wrong sequence                    | less weld metal (a not oversize!), sequence, jigs, pre-setting
```

The first two lines are the subject of the worked example: in a fatigue-loaded joint the crack starts at the toe or
at the root of a load-carrying fillet weld. A larger section alone does not cure a root that is classed FAT 36.

---

## 8. Verification, complete worked example, references, glossary

### 8.1 Verification

Both programs check themselves with independent derivations. They do not compare a function with itself:

```
python weld.py selftest
python vessel.py selftest
```

```
single line: I_x = L^3 / 12 about its centre                       OK   
box 80 x 80: I_x = 2 (b d^2 / 4) + d^3 / 6 (textbook formula)      OK   341333
line forces integrate back to N, My and T (equilibrium)            OK   N 1000.0, My -15.00, T 12.00
directional method: transverse fillet sqrt(3/2) = 1.22 x stronger than longitudinal OK   
S-N: N(FAT) = 2e6; constant-amplitude limit 0.737 FAT at 5e6       OK   
S-N: continuous at N_D and cut-off 0.405 FAT at 1e8                OK   
RHS 80x80x4: A = 1216 mm2 (sharp corners)                          OK   
default bracket passes weld, member and fatigue checks             OK   
SELFTEST PASS
shell: mean-diameter hoop stress = f at e = P Di / (2 f - P)       OK   1.338 mm
hemisphere needs about half the cylinder thickness                 OK   0.499
Kloepper M = (3 + sqrt 10) / 4 = 1.541                             OK   
2:1 ellipsoid volume = pi D^3 / 24                                 OK   
length from volume gives the volume back                           OK   150.00 L
receiver: shortest on/off cycle (50 % demand) = 1 / f_max          OK   240 s
ISO 4126 C(k = 1.4) = 2.703                                        OK   2.7033
PED: 11 bar x 150 L = 1650 bar L -> category III                   OK   
default receiver: nozzle, test and fatigue OK                      OK   
SELFTEST PASS
```

What each check protects against:

| Check | Error it would catch |
|---|---|
| I of one line and of the box against the textbook formulas | wrong line-integral in `group_props()` (a factor 3 or a missing parallel-axis term) |
| Equilibrium (∫ f_n dA = N, ∫ f_n·x = M_y, ∫ r × f = T) | wrong sign or wrong axis in `line_forces()`, the most common error in weld-group programs |
| Transverse / longitudinal ratio √(3/2) | wrong decomposition into σ⊥, τ⊥, τ∥ |
| S-N curve at 2·10⁶, continuity at N_D, cut-off at 10⁸ | wrong knee points or slopes, so a wrong life by orders of magnitude |
| Hoop stress = f at the calculated thickness | wrong shell formula (inside vs mean diameter) |
| Hemisphere ½, Klöpper M | wrong head formula |
| Volume round trip | wrong cylindrical length (receiver too small) |
| Shortest on/off cycle = 1/f_max | wrong receiver-volume formula (motor starts too often) |
| C(k) and the PED class | wrong safety-valve capacity, wrong conformity route |

What the self-tests **cannot** check:
- the typical data: FAT classes, steel strengths, PED limits, the EN 1011-2 coefficients;
- whether the chosen detail category matches the real weld.

Both must be checked by the designer against the standards (all marked "check").

### 8.2 Worked example: jib-crane arm root joint

**Task.** A workshop jib crane for the FMS assembly area lifts parts of up to **500 kg** at the end of a **2.0 m**
arm. The arm is an RHS 120 × 120 × 6 (S355) welded to a 20 mm end plate, which is bolted to the slewing head.
Design life is 20 years:
- 200 000 lifts at full load (dynamic factor 1.15 for the hoist);
- 400 000 lifts at half load;
- 600 000 slewing and swinging cycles with 10 % of the hook load sideways.

Here, unlike the bracket post of chapter 2, **strength and fatigue both matter**.

**Loads at the weld centroid** (`tools/examples/weld_example.json`):
- **Hook:** 500 kg × 9.81 × 1.15 = 5641 N.
- **Arm self weight:** about 21.5 kg/m × 2 m = 43 kg → 422 N at 1 m.
- **Design loads (γ_F 1.5):**
  - V_y = −1.5·(5641 + 422) = −9095 N;
  - M_x = 1.5·(5641·2.0 + 422·1.0) = 17 560 N·m;
  - lateral V_x = 0.1·1.5·5641 = 846 N, M_y = 846·2.0 = 1692 N·m.
- **Fatigue ranges (unfactored):** ΔM_x = 5641·2.0 = 11 282 N·m at full load, half of that at half load, and
  ΔM_y = 1128 N·m for slewing.

```json
{
  "name": "Jib-crane arm root joint: RHS 120x120x6 S355, arm 2.0 m, hook load 500 kg, full-penetration butt weld to a 20 mm end plate (example)",
  "steel": "S355", "a": 6.0, "t_max": 20.0, "t_min": 6.0,
  "lines": [[0, 0, 120, 0], [120, 0, 120, 120], [120, 120, 0, 120], [0, 120, 0, 0]],
  "loads": {"N": 0.0, "Vx": 846.0, "Vy": -9095.0, "Mx": 17560.0, "My": 1692.0, "T": 0.0},
  "member": {"b": 120.0, "h": 120.0, "t": 6.0, "L": 2000.0},
  "fatigue_blocks": [
    {"name": "lifts at full load (500 kg x dynamic 1.15), 20 years", "dVy": 5641.0, "dMx": 11282.0, "n": 200000},
    {"name": "lifts at half load", "dVy": 2821.0, "dMx": 5641.0, "n": 400000},
    {"name": "slewing / load swing, lateral 10 % of the hook load", "dVx": 564.0, "dMy": 1128.0, "n": 600000}],
  "fat_toe": "load-carrying cruciform, full penetration",
  "fat_throat": "load-carrying cruciform, full penetration",
  "fat_shear": "fillet weld throat, shear", "gamma_Mf": 1.15, "gamma_Ff": 1.0
}
```

**Step 1 – variants.** `python weld.py ch78` evaluates three designs with the same loads (`wm_variant()` changes
section, throat and detail categories and calls the core `summary()`):

```
## 8.2 Worked example: jib-crane arm root joint (weld_example.json)
  task: Jib-crane arm root joint: RHS 120x120x6 S355, arm 2.0 m, hook load 500 kg, full-penetration butt weld to a 20 mm end plate (example)
  variant                                                       util weld  util member  D toe     D throat  D shear   result
  V0 RHS 120x120x6, fillet a 4 all round                            0.782       0.549  4.39      12.9      0         NOT OK
  V1 RHS 160x160x8, fillet a 5 all round                            0.352       0.232  0.322     1.18      0         NOT OK
  V2 RHS 120x120x6, full-penetration butt weld to end plate (chosen)    0.521       0.549  0.785     0.499     0         OK
  allowed range (FAT 71, gamma_Mf 1.15) at 1e+05 cycles: 167.6 MPa
  allowed range (FAT 71, gamma_Mf 1.15) at 2e+05 cycles: 133.0 MPa
  allowed range (FAT 71, gamma_Mf 1.15) at 4e+05 cycles: 105.6 MPa
  allowed range (FAT 71, gamma_Mf 1.15) at 1e+06 cycles: 77.8 MPa
```

How to read it:
- **V0, the "obvious" design** (fillet a 4 all round), is statically fine: weld 0.78, member 0.55. In fatigue it is
  hopeless: toe damage 4.4 (FAT 40) and root damage 12.9 (FAT 36). It would crack in about 1.5 years.
- **V1, a bigger section** (160 × 160 × 8, 1.8 × the weight) cures the toe (0.32), but the **root of the
  load-carrying fillet still fails** (1.18). The root FAT 36 is the weakest detail in the whole catalogue, and only
  a much larger throat or a different joint helps.
- **V2 keeps the light section and changes the joint**: a **full-penetration butt weld** of the RHS to the end plate
  (single-bevel with backing, or bevel + root run from inside). It is classed FAT 71 at toe and root (EN 1993-1-9
  table 8.6 style for RHS-to-plate, t ≤ 8, check). Damage 0.785 at the toe → **OK with the same 21.5 kg/m tube**.

**Step 2 – the full report of the chosen design:**

```
python weld.py run --in examples/weld_example.json --out example
```

```
# Weld report (EN 1993-1-8 / -1-9 style) - Jib-crane arm root joint: RHS 120x120x6 S355, arm 2.0 m, hook load 500 kg, full-penetration butt weld to a 20 mm end plate (example)

S355 (fy 355, fu 510 MPa, beta_w 0.90), fillet throat a 6.0 mm, 4 weld lines, design loads N 0 N, Vx 846 N, Vy -9095 N, Mx 17560.0, My 1692.0, T 0.0 N m

## Weld group (line method, unit throat)
- length 480 mm, centroid (60.0, 60.0), I_x 1152000 mm3, I_y 1152000 mm3, I_p 2304000 mm3
- worst point line 1 at (120.0, 0.0): f_n -1002.7, f_t -1.8, f_l -18.9 N/mm -> sigma_perp = tau_perp 118.2, tau_par -3.2, equivalent 236.4 MPa
- directional method: limit 453 MPa (perp. 367) -> utilisation 0.521; simplified method f_vw,d 262 MPa -> utilisation 0.639
- throat rules: a_min 3.97 (OK), a_max 0.7 t_min 4.20 (NOT OK), weld length >= 36 mm (OK)

## Member RHS 120x120x6 at the weld
- A 2736 mm2, W_x 99043 mm3, W_t 155952 mm3; sigma 194.4, tau 6.7, equivalent 194.7 MPa -> utilisation 0.549

## Fatigue (gamma_Ff 1.00, gamma_Mf 1.15; toe load-carrying cruciform, full penetration, throat load-carrying cruciform, full penetration, shear fillet weld throat, shear)
- lifts at full load (500 kg x dynamic 1.15), 20 years: n 2e+05; ranges toe 113.91, throat 97.95, shear 1.96 MPa -> N 3.18e+05 / 5.01e+05 / inf
- lifts at half load: n 4e+05; ranges toe 56.95, throat 48.98, shear 0.98 MPa -> N 2.55e+06 / 4.01e+06 / inf
- slewing / load swing, lateral 10 % of the hook load: n 6e+05; ranges toe 11.39, throat 9.79, shear 0.20 MPa -> N inf / inf / inf
- damage sum: toe 0.785, throat 0.499, shear 0 -> OK
```

**Step 3 – interpretation, line by line.**
- **Static:** the worst weld point is the bottom corner (the compression flange of the arm, f_n = −1003 N/mm).
  With a = t = 6 the "fillet" formula gives 0.52. For a full-penetration butt weld EN 1993-1-8 takes the resistance
  of the weaker connected part instead, so the member check (0.549) is the real static limit.
- **"a_max 0.7 t_min NOT OK"** must be read correctly. The 0.7·t rule is a **fillet-weld** rule. For a full-penetration
  weld the throat *is* the wall thickness (a = t = 6 mm), and the rule does not apply. The core program does not know
  the weld type (see the remark in 8.3).
- **Fatigue:** the full-load block dominates. Its toe range of 113.9 MPa × γ_Mf 1.15 = 131 MPa lies above the
  constant-amplitude limit, so the slope-3 part of the curve applies: N = 3.18·10⁵, D = 0.63. The half-load block
  (65.5 MPa factored) lies between the knee and the cut-off and adds 0.16. The slewing block is below the cut-off and
  does no damage. **Total 0.785** – a margin of 1/0.785 = 1.27 on the number of cycles, or 1.27^(1/3) = 1.08 on the
  stress range.
- **The small stress margin is typical** for fatigue-designed cranes. A 10 % heavier load (unplanned "550 kg") gives
  1.1³ = 1.33 × the damage → 1.04: overloaded in fatigue, still fine statically.

**Step 4 – manufacturing decisions written on the drawing** (from chapter 7):

| Item | Decision | Reason |
|---|---|---|
| Joint | full-penetration single-bevel butt weld RHS → end plate, ceramic backing | FAT 71 instead of 40 / 36 |
| Quality | ISO 5817 level **B**, EXC3 for this joint | the FAT class assumes it |
| NDT | VT 100 %, **UT 100 %** of the root joint, MT of the toe | find lack of fusion at the root |
| Preheat | 100 °C on the 20 mm end plate (d 20, HD 5, CET 0.34 → T_p 89 °C) | EN 1011-2 method B (7.2) |
| Distortion | weld in four quarter-segments, opposite corners first | keep the end plate flat for the bolted joint |
| Improvement (option) | toe grinding / HFMI of the four corners | +30 % or more on the FAT class (IIW, check): life × 2 or more |
| Inspection in service | MT of the root joint at every annual crane inspection | fatigue cracks start here |

**Decision.** RHS 120 × 120 × 6, full-penetration butt weld, level B, 100 % UT. It meets 20 years with D = 0.785,
without a heavier section. The design change cost is a bevel and a UT test, about 1 h of work. V1 would have cost
80 % more steel and still failed at the root.

### 8.3 Notes and limits of the programs

- `weld.py` treats every weld as a fillet weld (σ⊥ = τ⊥ = f⊥/(a√2)) and applies the fillet throat rules. For
  full-penetration butt welds, read the member check as the static limit and ignore the a_max rule (worked example).
  A weld-type flag would remove this ambiguity.
- The line method assumes the loads act at the weld-group centroid and that the group is symmetric (I_xy = 0).
  For unsymmetric groups, transform the loads to the principal axes first.
- The fatigue model uses nominal stresses and the FAT catalogue. For complex nodes, use hot-spot or effective
  notch stress (chapter 4) or FEA.
- `vessel.py` combines the EN 13445 shell formula with ASME UG-32 head formulas and simplified nozzle, fatigue
  and safety-valve methods. It is a design tool, not a code calculation for the notified body.
- All material, FAT, cost and EN 1011-2 data are typical values marked "check".

### 8.4 References

**Design of welds and steel structures**
- EN 1993-1-1 (Eurocode 3, general rules), EN 1993-1-8 (design of joints), EN 1993-1-9 (fatigue), EN 1993-1-10 (toughness, choice of steel grade)
- A. Hobbacher: *Recommendations for Fatigue Design of Welded Joints and Components*, IIW document XIII-2460-13 / XV-1440-13, Springer
- EN 1090-2: Execution of steel structures – technical requirements
- EN ISO 2553: Welding and allied processes – symbolic representation on drawings
- EN ISO 4063: Welding and allied processes – nomenclature of processes and reference numbers

**Welding quality and procedures**
- EN ISO 5817: Fusion-welded joints in steel – quality levels for imperfections
- EN ISO 15614-1: Specification and qualification of welding procedures – arc welding of steels
- EN ISO 9606-1: Qualification testing of welders – steels
- EN ISO 14732: Qualification of welding operators (mechanised and automatic welding)
- EN ISO 3834-1…-6: Quality requirements for fusion welding
- EN 1011-1 and EN 1011-2: Recommendations for welding of metallic materials (heat input, preheat, cooling time)
- EN 10164: Steels with through-thickness properties (Z-quality)
- EN ISO 17637, 17638, 17640, 17636, 3452 and the acceptance levels ISO 23277, 23278, 11666, 10675 (NDT)

**Pressure vessels**
- EN 13445-1…-5: Unfired pressure vessels (materials, design, fabrication, inspection and testing)
- EN 286-1: Simple unfired pressure vessels designed to contain air or nitrogen
- ASME Boiler and Pressure Vessel Code, Section VIII Division 1
- Directive 2014/68/EU (PED) and Directive 2014/29/EU (simple pressure vessels)
- EN ISO 4126-1: Safety devices for protection against excessive pressure – safety valves
- EN 10028-2, EN 10028-7, EN 10207 (pressure-vessel steels); EN 10204 (inspection documents)

**Textbooks**
- D. Radaj, C. M. Sonsino, W. Fricke: *Fatigue Assessment of Welded Joints by Local Approaches*, Woodhead
- G. Niemann, H. Winter, B.-R. Höhn: *Maschinenelemente*, vol. 1 (welded joints)
- Roloff/Matek: *Maschinenelemente* (chapter Schweißverbindungen), Springer Vieweg
- O. W. Blodgett: *Design of Welded Structures*, James F. Lincoln Arc Welding Foundation (the line method of chapter 3)
- K. Masubuchi: *Analysis of Welded Structures* (residual stress and distortion), Pergamon

### 8.5 Glossary

| Term | Meaning |
|---|---|
| a (throat thickness) | height of the largest triangle inscribed in a fillet weld; the design dimension of a fillet weld |
| z (leg length) | side of a fillet weld; z = a·√2 for equal legs |
| β_w (correlation factor) | factor in EN 1993-1-8 that adjusts the weld strength to the steel grade |
| directional method | weld check with the stress components σ⊥, τ⊥, τ∥ on the throat section |
| line method | weld group treated as lines of unit throat (Blodgett); gives forces per unit length |
| FAT (detail category) | stress range in MPa that a welded detail survives for 2·10⁶ cycles (97.7 % survival) |
| constant-amplitude limit | stress range below which constant-amplitude loading causes no damage (0.737·FAT at 5·10⁶) |
| cut-off limit | stress range below which no cycle of a spectrum causes damage (0.405·FAT at 10⁸) |
| Miner rule | damage D = Σ n_i/N_i; failure predicted at D = 1 |
| weld toe / root | transition from weld to plate at the surface / unfused end inside a fillet weld; the two crack starters |
| HAZ | heat-affected zone, base metal next to the weld changed by the welding heat |
| CET, CE(IIW) | carbon equivalents that measure hardening tendency and cold-cracking risk |
| t8/5 | cooling time from 800 to 500 °C in the HAZ |
| HD | diffusible hydrogen of the weld metal in ml per 100 g |
| preheat / interpass temperature | minimum part temperature before the first run / between runs |
| PWHT | post-weld heat treatment (stress relief) |
| WPS / WPQR | welding procedure specification / its qualification record |
| ISO 5817 levels B, C, D | stringent, intermediate and moderate limits for weld imperfections |
| EXC1…EXC4 | execution classes of EN 1090-2 for steel structures |
| VT, PT, MT, UT, RT | visual, penetrant, magnetic particle, ultrasonic, radiographic testing |
| HFMI | high-frequency mechanical impact treatment of weld toes (improves fatigue strength) |
| PS, TS | maximum allowable pressure and temperature of a pressure vessel |
| PED / SPVD | Pressure Equipment Directive 2014/68/EU / Simple Pressure Vessels Directive 2014/29/EU |
| joint coefficient z | factor for the weld strength in a vessel seam, set by the extent of NDT |
| testing group | EN 13445 classification that fixes NDT extent, joint coefficient and permitted materials |
| hydrostatic test | pressure test with water at P_t before the vessel goes into service |
| Okerblom force | longitudinal shrinkage force of a weld run, proportional to the heat input |
