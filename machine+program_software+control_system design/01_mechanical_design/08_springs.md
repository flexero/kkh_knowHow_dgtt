# M8 – Springs: helical compression springs (EN 13906-1), materials, buckling, surge, fatigue, design, manufacturing

> Field 1 *Mechanical design*, item 8.
> **Theory and program are combined:** every formula is followed by the code of `tools/spring.py`, the command and the
> real output. MATLAB mirror: `tools/spring.m`. Web: tab **M_P_C tools**, item 14. Python standard library only – offline.
> **All inputs are example values.** Tensile-strength fits, permissible stresses, fatigue strength values and the
> minimum-gap rule are typical values in the style of EN 10270 / EN 13906-1 – marked "check". The default spring is the
> follower spring of the M6 cam, so M6 and M8 use the same numbers.

## Contents
0. How to use this guide with the program
1. Purpose – what a spring calculation must prove
2. Spring types, wire materials and their properties
3. Helical compression spring: rate, stress, lengths, end types, characteristic
4. Stability: buckling, guides, coil growth, series / parallel / nested springs
5. Strength: static, fatigue (Haigh), relaxation; dynamics: natural frequency, surge, impact
6. Design from requirements; tension and torsion springs
7. Manufacturing of springs (wire, coiling, stress relief, end grinding, shot peening, setting, coating, tolerances EN 15800, inspection, drawing data)
8. Verification, complete worked example, references, glossary

---

## 0. How to use this guide with the program

### 0.1 Commands
| Command | What it does |
|---|---|
| `python spring.py params` | Default input as JSON (copy → edit → `--in`) |
| `python spring.py run --in my.json --out res` | Full calculation → `report.md`, `drawing_data.csv` (data block for the spring drawing) |
| `python spring.py examples` | Report of the default spring incl. design from requirements, material comparison, seating and buckling study |
| `python spring.py ch24` / `ch56` / `ch78` | Extra results of chapters 2–4 / 5–6 / 7–8 |
| `python spring.py selftest` | Independent cross-checks → SELFTEST PASS |
| Web: `http://localhost:8080/?mpcitem=14#mpc` | Same calculation with KPIs, characteristic line, Haigh diagram, design candidates |

### 0.2 Program map – formula → function
| Chapter | Physics / method | Function |
|---|---|---|
| 2 | Wire materials: R_m,min(d), G, E, density, fatigue factors; preferred wire diameters; permissible static stress | `MATERIALS`, `WIRE_D`, `Rm_min()`, `tau_zul()` |
| 3 | Spring rate, stress and Bergsträsser factor, total coils, solid length, minimum gaps, pitch, mass, forces and work | `rate()`, `berg()`, `stress()`, `total_coils()`, `geometry()`, `forces()` |
| 4 | Buckling deflection with seating factor ν | `SEATING`, `buckling()` |
| 5 | Natural frequency and surge check; static check incl. solid; fatigue with a Goodman-type Haigh line | `natural_frequency()`, `static_check()`, `fatigue()` |
| 6 | Design from requirements: d from the preferred series, n from the rate, lengths, all checks, lightest passing spring | `design_from_requirements()` |
| – | All checks, report, drawing data | `summary()`, `report_text()`, `run()` |
| 2–4 | Spring types, wire classes, R_m table, relaxation table, rate from wire torsion, Wahl vs Bergsträsser, end types, minimum-gap rule, characteristic, EN coil growth, guide clearance, progressive two-zone spring, series / parallel, nested springs, buckling nomogram, stable slenderness limit | `rm_table()`, `rate_by_torsion()`, `wahl()`, `correction_table()`, `end_types()`, `min_gap_rule()`, `characteristic()`, `coil_growth_EN()`, `guide_clearance()`, `progressive_two_zone()`, `series_parallel()`, `nested()`, `buckling_nomogram()`, `stable_limit()`, `SPRING_TYPES`, `WIRE_CLASSES`, `RELAXATION` |
| 5–6 | τ_zul curve, presetting, solid-safe check, Haigh lines for 10^5–10^7, life estimate, shot-peening effect, fatigue map, relaxation, wave data and effective mass, cam-driven surge simulation (RK4), impact limit, design trade-off, 2-D search d × D, tension springs, torsion springs | `tau_zul_curve()`, `solid_safe_check()`, `haigh_lines()`, `life_estimate()`, `peening_effect()`, `fatigue_map()`, `relaxation()`, `wave_data()`, `surge_sim()`, `impact_limit()`, `design_2d()`, `tradeoff()`, `tension_spring()`, `torsion_spring()`, `PRESET_FACTOR`, `LIFE_FACTOR`, `RELAX`, `RELAX_FACTOR`, `SOFT_LONG`, `TENSION`, `TORSION` |
| 7–8 | Process chain, stress relief, coiling-tool diameter (spring-back), wire length, coiling time, setting amount, coatings, cost per spring, EN 15800 style tolerances, preload scatter, inspection plan, drawing block, failure modes, worked example (400 rpm follower spring) | `coiling_tool_diameter()`, `wire_length()`, `coiling_time()`, `set_amount()`, `cost_per_spring()`, `tolerances()`, `preload_scatter()`, `drawing_block()`, `example_requirements()`, `worked_example()`, `example_json()`, `PROCESS_CHAIN_SPRING`, `STRESS_RELIEF`, `COATINGS_SPRING`, `GRADE_Q`, `INSPECTION_PLAN`, `FAILURES_SPRING` |
Example input of chapter 8: `tools/examples/spring_example.json`.

### 0.3 What the self-test proves
1. F = R·s at both working points; the work equals the trapezoid area (F1 + F2)/2 · stroke.
2. Bergsträsser k → 1 for a large spring index, k(6) = 1.2857.
3. The natural frequency formula equals ½·√(R/m_active) of a bar fixed at both ends.
4. The stored energy ½·R·s² equals the torsion energy of the wire τ²·V/(4G) – an independent derivation of the rate.
5. Pinned ends buckle earlier than fixed ends; the Haigh line passes through its two defining points.
6. The design function finds a spring that meets the required preload.

## 1. Purpose – what a spring calculation must prove

A spring stores energy and gives a defined force at a defined length. In machines it keeps a follower on a cam, closes a
valve, preloads a bearing or returns a lever. It fails by **fatigue** (breakage after millions of strokes), by
**relaxation** (force slowly drops), by **buckling**, by **surge** (resonance of its own coils) or simply because it goes
**solid** or does not fit.

| Proof | Question | Chapter |
|---|---|---|
| Material | Which wire, which strength at this diameter, which temperature? | 2 |
| Characteristic | Rate, forces at L1 / L2, lengths, end type, enough gap before solid | 3 |
| Stability | Buckling, guiding, coil growth in a sleeve | 4 |
| Strength | Static (incl. solid), fatigue stroke on the Haigh diagram, relaxation | 5 |
| Dynamics | Natural frequency well above the excitation harmonics (cam!) | 5 |
| Design | Lightest spring that meets all requirements | 6 |
| Manufacture | Coiling, stress relief, grinding, shot peening, setting, tolerances, test | 7 |

**Default example** (`python spring.py examples`): the follower spring of the M6 cam – required preload about 55 N and
rate about 3 N/mm over the 20 mm cam stroke at 300 rpm (5 Hz, harmonics up to ~12th). Oil-tempered valve-spring wire
VDSiCr, shot peened, d 2.5 mm, D 25 mm, 8.5 active coils, closed and ground, L0 74 mm.

| Result | Value |
|---|---|
| Characteristic | R 2.92 N/mm; F1 55.5 N at L1 55 mm, F2 114.0 N at L2 35 mm |
| Lengths | solid 26.25 mm, minimum gaps 7.97 mm → L_n,min 34.22 mm ≤ L2 35 mm (just fits) |
| Strength | τ at L2 464 MPa (S 2.13), solid-safe; fatigue stroke 270 MPa vs 556 MPa allowed (S 2.06) |
| Stability / dynamics | no buckling; natural frequency 169 Hz = 34 × cam frequency (needs > 12 ×) |
| Design | lightest passing spring for the same task: d 2.2 mm, n 5, L0 59 mm (16 g instead of 32 g) |


---

## 2. Spring types, wire materials and their properties

A spring stores energy elastically and gives it back. It is used in machines to:

- hold a part in contact, for example a cam follower, a valve or a brake;
- create a defined force, for example clutch clamping or bearing preload;
- store energy and return a part, for example return springs and latches;
- isolate vibration, for example machine mounts;
- measure a force, as in a spring balance.

In every case the designer has to deliver **a force at a length**, keep that force **for the whole life** (no relaxation, no
fatigue break), stay **stable** (no buckling) and avoid **resonance** (surge). This guide covers the helical compression
spring in full, because it is by far the most common spring in machine building. The other types are summarised so you
can choose.

### 2.1 Spring types and where they are used

`python spring.py ch24` prints the type table first (data `SPRING_TYPES` in the add-on of chapter 2):

```python
SPRING_TYPES = [   # type, load / motion, typical use, design standard
    ("helical compression", "axial push, linear", "valves, cam followers, clutches, dies", "EN 13906-1"),
    ("helical tension", "axial pull, initial tension, hooks / loops", "return springs, doors, levers", "EN 13906-2"),
    ("helical torsion", "rotation, torque about the coil axis", "hinges, ratchets, clips, reels", "EN 13906-3"),
    ("disc (Belleville)", "very high force on small travel, stackable, nonlinear", "bolt preload, clutches, valves", "EN 16983 / EN 16984"),
    ...
]
```

```
## 2.1 Spring types
  helical compression        axial push, linear                                 valves, cam followers, clutches, dies  EN 13906-1
  helical tension            axial pull, initial tension, hooks / loops         return springs, doors, levers          EN 13906-2
  helical torsion            rotation, torque about the coil axis               hinges, ratchets, clips, reels         EN 13906-3
  disc (Belleville)          very high force on small travel, stackable, nonlinear bolt preload, clutches, valves         EN 16983 / EN 16984
  wave spring                axial, short solid length                          bearing preload, seals                 maker data
  leaf / flat spring         bending, can guide                                 vehicles, contacts, snap fits          beam theory
  gas spring                 nearly constant force, damped                      lids, chairs, tool lifts               maker data
  elastomer / polyurethane   high damping, nonlinear, creep                     die cushions, buffers                  maker data
```

How to choose:

| Requirement | Best type | Why |
|---|---|---|
| Linear force over a long stroke, millions of cycles | **helical compression** | simple, cheap, well-understood fatigue, guided by a mandrel / sleeve |
| Pull instead of push, compact | helical tension | initial tension gives a force without travel; but the hooks are the weak point – never use tension springs where a break would be dangerous (a compression spring that breaks still carries load) |
| Torque on a pin | helical torsion | the wire is loaded in **bending**, not torsion |
| Very large force, small travel | disc spring stack | stiff, adjustable by stacking (series / parallel) |
| Little axial space | wave spring | about half the solid length of a helical spring |
| Constant force, damping | gas spring | almost flat characteristic; but seals age, force depends on temperature |
| Shock, noise | elastomer | high internal damping, but creep and temperature sensitivity |

The cam follower of M6 needs a **linear** force of 55 to 115 N over a 20 mm lift at 5 Hz, for about 10⁸ cycles. That is
a typical helical compression spring task, and it is the default of `spring.py`.

### 2.2 Wire classes – what the letters mean

Spring wire is not ordinary steel wire. Its strength comes from one of two routes:

1. **Patented and cold drawn** (EN 10270-1). The wire is austenitised and transformed to fine pearlite in a lead or air
   bath ("patenting"). It is then cold drawn with large reductions. The strength comes from the work hardening of the
   pearlite lamellae, so **thinner wire is stronger**: more drawing reduction gives finer lamellae. The springs are only
   stress-relieved after coiling, at about 250–300 °C.
2. **Oil hardened and tempered** (EN 10270-2). The drawn wire is hardened in oil and tempered to a martensitic structure
   ("oil tempered", OT). Its strength depends much less on the diameter, the structure is homogeneous, and alloying with Si-Cr
   (V) raises fatigue strength and relaxation resistance. This is the standard material for engine valve springs.

The letters are a code:

| Letter | Meaning |
|---|---|
| S… / D… (EN 10270-1) | **S**tatic or **D**ynamic duty; D grades have tighter limits on surface defects and decarburisation |
| L / M / H | **L**ow / **M**edium / **H**igh tensile strength |
| F / T / V (EN 10270-2) | **F** = static, **T** = medium fatigue ("Ventil" / valve quality = **V**), V has the lowest permitted defect depth |
| C, SiCr, SiCrV | unalloyed carbon steel, Si-Cr alloyed, Si-Cr-V alloyed |

```
## 2.2 Wire classes
  EN 10270-1 SL / SM / SH             patented cold drawn, static            T_max  80 C  static springs, low / medium / high stress
  EN 10270-1 DM / DH                  patented cold drawn, dynamic           T_max  80 C  dynamic springs (better surface, lower defect depth)
  EN 10270-2 FDC / TDC / VDC          oil hardened + tempered, unalloyed     T_max 120 C  F static, T medium fatigue, V valve quality
  EN 10270-2 FDSiCr / TDSiCr / VDSiCr oil hardened + tempered, Si-Cr alloyed T_max 160 C  high fatigue, engine valve springs
  EN 10270-2 VDSiCrV                  oil hardened + tempered, Si-Cr-V       T_max 160 C  highest fatigue, racing valve springs
  EN 10270-3 1.4310 (NS / HS)         austenitic stainless, cold drawn       T_max 160 C  corrosion, food, medical
  EN 10270-3 1.4568                   precipitation hardening stainless      T_max 250 C  higher strength and temperature than 1.4310
  EN 12166   CuSn6 / CuBe2            copper alloys                          T_max 100 C  electrical contacts, non-magnetic
```

The temperature limits are typical upper values for acceptable relaxation (check maker data). Above them, use 1.4568,
Nimonic / Inconel, or design for a lower stress.

### 2.3 Tensile strength versus wire diameter

The program uses a power-law fit **R_m,min = A·d^(−m)** to the minimum values of the EN 10270 tables (check):

```python
def Rm_min(P, d=None):
    m = MATERIALS[P["material"]]
    return m["A"] * (P["d"] if d is None else d) ** (-m["m"])

def tau_zul(P, d=None):
    """Permissible static shear stress (uncorrected) 0.5 Rm (EN 13906-1 style, check)."""
    return 0.5 * Rm_min(P, d)
```

with the material data

```python
MATERIALS = {
    "EN 10270-1 DH (patented, cold drawn)":      {"A": 2230.0, "m": 0.17,  "G": 81500.0, ...},
    "EN 10270-2 VDSiCr (oil tempered, valve)":   {"A": 2080.0, "m": 0.055, "G": 79500.0, ...},
    "EN 10270-3 1.4310 (stainless)":             {"A": 2000.0, "m": 0.14,  "G": 70000.0, ...},
}
```

The add-on prints the table for several diameters:

```python
def rm_table(ds=(1.0, 2.0, 2.5, 3.0, 4.0, 6.0, 8.0)):
    """Rm_min (MPa) of every material of the program for several wire diameters (fit A d^-m, check)."""
    return {m: [(d, Rm_min(dict(DEFAULT, material=m), d)) for d in ds] for m in MATERIALS}
```

`python spring.py ch24`:

```
## 2.3 Rm_min (MPa) vs wire diameter (fit A d^-m, check)
  material                                   d=1     d=2     d=2.5   d=3     d=4     d=6     d=8    
  EN 10270-1 DH (patented, cold drawn)       2230    1982    1908    1850    1762    1644    1566   
  EN 10270-2 VDSiCr (oil tempered, valve)    2080    2002    1978    1958    1927    1885    1855   
  EN 10270-3 1.4310 (stainless)              2000    1815    1759    1715    1647    1556    1495   
  tau_zul = 0.5 Rm for the default d 2.5: 989 MPa
```

**Hand check** (DH, d = 3 mm): 2230 · 3^(−0.17) = 2230 · e^(−0.17·1.0986) = 2230 · 0.8296 = **1850 MPa** ✓.
VDSiCr, d = 2.5 mm: 2080 · 2.5^(−0.055) = 2080 · 0.9509 = 1978 MPa, so τ_zul = 0.5 · 1978 = **989 MPa** ✓.

What the table shows:

- **Patented wire (DH) loses about 30 % strength from d = 1 to 8 mm**, oil-tempered SiCr wire only 11 %. Thick
  patented wire therefore makes heavy, weak springs. Above about 6–8 mm, oil-tempered or hot-formed springs
  (EN 10089, hardened after coiling) are used.
- At d = 2.5 mm the difference DH : VDSiCr is only 4 % in strength. The advantage of VDSiCr is mainly **fatigue** and
  **relaxation**, as the next two sections show.
- **Stainless 1.4310** is 10 % weaker and has a 12 % lower G, so the same geometry is softer: rate 2.574 against 2.923 N/mm
  in the material comparison of `python spring.py examples`:

```
## Materials (same geometry)
  EN 10270-1 DH (patented, cold drawn)       Rm 1908, R 2.996, S_static 2.00, S_fat 1.50, f_e 171 Hz
  EN 10270-2 VDSiCr (oil tempered, valve)    Rm 1978, R 2.923, S_static 2.13, S_fat 2.06, f_e 169 Hz
  EN 10270-3 1.4310 (stainless)              Rm 1759, R 2.574, S_static 2.15, S_fat 1.37, f_e 158 Hz
```

The permissible static stress τ_zul = 0.5·R_m applies to the **uncorrected** stress. This is the EN 13906-1 rule for
cold-coiled springs (check the standard's figure for your wire). The idea is that under static load local plasticity at the
inner fibre redistributes the curvature peak. Under fatigue loading it does not, so chapter 5 uses the corrected stress.

### 2.4 Relaxation and temperature

A spring held at a constant length loses force over time (**relaxation**). A spring held under a constant force gets
shorter (**creep**). Both come from microplastic slip in the highly stressed outer fibre and grow with stress and
temperature:

```python
RELAXATION = {   # typical loss of force after 48 h at the given corrected stress and temperature, % (maker data style, check)
    "EN 10270-1 DH (patented, cold drawn)": {"20C": 2, "80C": 6, "120C": 12},
    "EN 10270-2 VDSiCr (oil tempered, valve)": {"20C": 1, "80C": 2, "120C": 4},
    "EN 10270-3 1.4310 (stainless)": {"20C": 2, "80C": 4, "120C": 7},
}
```

```
## 2.4 Relaxation (typical, check) - force loss after 48 h, %
  EN 10270-1 DH (patented, cold drawn)       20C 2, 80C 6, 120C 12
  EN 10270-2 VDSiCr (oil tempered, valve)    20C 1, 80C 2, 120C 4
  EN 10270-3 1.4310 (stainless)              20C 2, 80C 4, 120C 7
```

What this means for the cam follower: the cam runs inside a gearbox-like housing at perhaps 60–80 °C. A DH spring
could lose 6 % of its preload, which is 3.3 N of the 55 N. The M6 dynamics showed a contact-force margin of only a few
newtons near the lift-off speed, so this loss directly reduces the speed limit. **VDSiCr loses only 2 %**, which is one
reason it is the default. Practical countermeasures, explained in chapter 7, are:

- **presetting** (compressing the spring once beyond its working stress, so it settles before delivery);
- **hot presetting** for valve springs;
- a lower working stress.

---

## 3. Helical compression spring: rate, stress, lengths, end types, characteristic

### 3.1 Spring rate – derived from the torsion of the wire

Cut a helical spring and look at one coil. The axial force F acts along the coil axis, at a distance D/2 from the wire
centre. Every wire cross-section therefore carries

- a **torque** T = F·D/2 (the main load),
- a direct shear force F (small, about 1/(2w) of the torsion stress – it is included in the correction factor),
- for a pitch angle α > 0 a small bending moment (neglected for α < 10°; the default has 5.9°, see 3.4).

The wire is a long straight bar of length l = π·D·n (active coils only) twisted by T. From elementary torsion the twist
angle of the bar is

  φ = T·l / (G·I_p),  I_p = π·d⁴/32.

The two wire ends rotate against each other by φ about an axis that is D/2 away from the spring axis. The spring axis
therefore moves by

  s = φ·D/2 = (F·D/2)·(π·D·n)·(D/2) / (G·π·d⁴/32) = 8·F·D³·n / (G·d⁴).

So the **spring rate** is

  **R = F/s = G·d⁴ / (8·D³·n)**.

Energy gives the same result: the work F·s/2 equals the torsion strain energy T²·l/(2·G·I_p). The self-test of
`spring.py` checks this identity in the form ½·R·s² = τ²·V/(4G).

The core function:

```python
def rate(P):
    G = MATERIALS[P["material"]]["G"]
    return G * P["d"] ** 4 / (8 * P["D"] ** 3 * P["n"])
```

The add-on does the torsion calculation step by step, as an independent check:

```python
def rate_by_torsion(P):
    """Wire of length l = pi D n twisted by T = F D/2: twist phi = T l/(G Ip), Ip = pi d^4/32; the coil axis moves s = phi D/2."""
    F = 1.0
    G = MATERIALS[P["material"]]["G"]
    T = F * P["D"] / 2
    l = math.pi * P["D"] * P["n"]
    Ip = math.pi * P["d"] ** 4 / 32
    phi = T * l / (G * Ip)
    s = phi * P["D"] / 2
    return {"l_wire": l, "Ip": Ip, "phi_per_N": phi, "R": F / s, "R_core": rate(P)}
```

```
## 3.1 Rate by wire torsion
  wire length 667.6 mm, Ip 3.835 mm4, twist 0.027371 rad/N -> R 2.9228 N/mm (core rate() 2.9228)
```

**Hand check** (d 2.5, D 25, n 8.5, G 79 500 MPa):

- d⁴ = 39.0625 mm⁴, D³ = 15 625 mm³.
- R = 79 500 · 39.0625 / (8 · 15 625 · 8.5) = 3 105 469 / 1 062 500 = **2.9228 N/mm** ✓.
- Torsion route: l = π·25·8.5 = 667.6 mm, I_p = π·39.06/32 = 3.835 mm⁴, φ = 12.5·667.6/(79 500·3.835) = 0.02737 rad per N.
- s = 0.02737·12.5 = 0.3421 mm per N, so R = 2.923 ✓.

Design consequences of R ∝ d⁴/(D³·n):

| Change | Effect on R | Effect on stress at the same force |
|---|---|---|
| d + 10 % | + 46 % | − 25 % (τ ∝ 1/d³) |
| D + 10 % | − 25 % | + 10 % (τ ∝ D) |
| n + 10 % | − 9 % | none (n does not enter τ) |

This is why the design procedure of chapter 6 first chooses d from the stress, then n from the rate. The number of coils
is the "free" parameter that sets the rate without touching the stress.

### 3.2 Shear stress and the curvature correction

The torsion stress in a straight bar is τ = T/W_t = (F·D/2)/(π·d³/16), so

  **τ = 8·F·D / (π·d³)** (uncorrected).

In a coiled wire the inner fibre is shorter than the outer one, so the same twist produces a higher shear strain inside.
The direct shear F/A also adds on the inner side. The maximum stress at the inner fibre is

  τ_k = k·τ,  **Bergsträsser: k = (w + 0.5) / (w − 0.75)**,  w = D/d (spring index).

```python
def berg(w):
    """Bergsträsser stress correction factor k = (w + 0.5)/(w - 0.75), w = D/d."""
    return (w + 0.5) / (w - 0.75)

def stress(P, F):
    tau = 8 * F * P["D"] / (math.pi * P["d"] ** 3)
    return tau, berg(P["D"] / P["d"]) * tau
```

The older **Wahl** factor k_W = (4w − 1)/(4w − 4) + 0.615/w is used in AGMA / US literature. The add-on compares both:

```python
def wahl(w):
    """Wahl factor (4w - 1)/(4w - 4) + 0.615/w (curvature + direct shear)."""
    return (4 * w - 1) / (4 * w - 4) + 0.615 / w

def correction_table(ws=(4, 5, 6, 8, 10, 12, 15, 20)):
    return [(w, berg(w), wahl(w), (wahl(w) / berg(w) - 1) * 100) for w in ws]
```

```
## 3.2 Stress correction: Bergstraesser vs Wahl
  w  4.0: k_B 1.3846, k_W 1.4038 (Wahl +1.38 %)
  w  5.0: k_B 1.2941, k_W 1.3105 (Wahl +1.27 %)
  w  6.0: k_B 1.2381, k_W 1.2525 (Wahl +1.16 %)
  w  8.0: k_B 1.1724, k_W 1.1840 (Wahl +0.99 %)
  w 10.0: k_B 1.1351, k_W 1.1448 (Wahl +0.85 %)
  w 12.0: k_B 1.1111, k_W 1.1194 (Wahl +0.75 %)
  w 15.0: k_B 1.0877, k_W 1.0946 (Wahl +0.63 %)
  w 20.0: k_B 1.0649, k_W 1.0702 (Wahl +0.50 %)
```

The two agree within 1.4 %, so either can be used. EN 13906 uses Bergsträsser.

**Hand check** at the working point F2 = 114.0 N of the default:

- τ = 8·114.0·25 / (π·2.5³) = 22 800 / 49.09 = **464 MPa**.
- k(10) = 10.5/9.25 = 1.1351, so τ_k = 527 MPa.

The core report (`python spring.py examples`) prints the same values:

```
## Stresses
- tau at L2 464 MPa (S 2.13 OK), at solid 569 MPa (can be compressed to solid)
- fatigue (corrected): tau_kU 257, tau_kO 527, stroke 270 MPa; tau_D0 752, allowed stroke 556 MPa -> S 2.06 OK
```

The **spring index w** is limited to about 4…20 (the program checks `4 <= w <= 20`). Outside that range manufacturing
becomes difficult:

- **w < 4:** the wire is bent too sharply, so cracks form on the inner side during coiling and the correction factor rises steeply (k = 1.38 at w = 4).
- **w > 20:** the coil is floppy, the diameter tolerance is poor, and the spring tangles in bulk handling.

The default has w = 10, which is ideal. Static safety τ_zul/τ = 989/464 = **2.13** ✓.

### 3.3 Lengths: solid length, minimum gaps, working range

The lengths of a compression spring, from long to short:

| Symbol | Length | Rule |
|---|---|---|
| L0 | free length | from the design (chapter 6) |
| L1 | installed length – preload F1 | from the mechanism |
| L2 | shortest working length – F2 | L1 − stroke |
| Ln | smallest allowed working length | L_n ≥ L_c + S_a |
| Lc | solid length (all coils touching) | closed and ground: L_c ≈ n_t·d_max |

The **minimum sum of gaps** S_a keeps the coils from touching in operation: touching coils give noise, wear, a sudden
rate jump and a stress peak. EN 13906-1 gives for static springs

  S_a = (0.0015·D²/d + 0.1·d)·n,

and for dynamic springs 1.5 × that value (check the standard). The core:

```python
def geometry(P):
    d, D, n = P["d"], P["D"], P["n"]
    nt = total_coils(P)
    Lc = nt * d if P["ends"] == "closed and ground" else (nt + 1.5) * d       # solid length (check EN 13906)
    Sa = (0.0015 * D ** 2 / d + 0.1 * d) * n                                  # sum of minimum gaps
    if P["dynamic"]:
        Sa *= 1.5
    Ln_min = Lc + Sa
    ...
```

The add-on shows the static and dynamic values side by side:

```python
def min_gap_rule(P=None):
    P = dict(P or DEFAULT)
    st = geometry(dict(P, dynamic=False))
    dy = geometry(dict(P, dynamic=True))
    per_coil = 0.0015 * P["D"] ** 2 / P["d"] + 0.1 * P["d"]
    return {"per_coil": per_coil, "Sa_static": st["Sa"], "Sa_dynamic": dy["Sa"], "Ln_static": st["Ln_min"], "Ln_dynamic": dy["Ln_min"]}
```

```
  min gap per coil 0.625 mm -> Sa static 5.31 / dynamic 7.97 mm; Ln_min 31.56 / 34.22 mm
```

**Hand check:**

- Gap per coil: 0.0015·625/2.5 + 0.1·2.5 = 0.375 + 0.25 = **0.625 mm**.
- Static sum: 0.625 × 8.5 coils = 5.31 mm; dynamic: × 1.5 = 7.97 mm.
- Solid length: L_c = 10.5 coils × 2.5 = 26.25 mm, so L_n = 26.25 + 7.97 = **34.22 mm** ✓.

The core report confirms it, and shows that the default L2 = 35.0 mm uses the range with a margin of 0.78 mm:

```
- rate R 2.9228 N/mm; F1 55.5 N at L1 55.0 (s1 19.0), F2 114.0 N at L2 35.0 (s2 39.0), at solid 139.6 N; work stroke 1.695 J
- spring index w 10.00 (OK), Bergstraesser k 1.1351; solid length Lc 26.25, minimum gaps Sa 7.97 -> Ln_min 34.22 mm (L2 35.0: OK)
- pitch 8.118 mm, mass 31.8 g, outer diameter at solid ~27.69 mm
```

### 3.4 End types, pitch and helix angle

The ends of a compression spring are made so the force is introduced over the whole circumference:

- **Closed and ground** (standard for d ≥ 0.5 mm in machine building): the last coil of each end is closed against
  its neighbour (a "dead coil") and ground flat to about 3/4 of the circumference. The spring stands upright, the force
  is nearly central, and there is less buckling. n_t = n + 2 and L_c ≈ n_t·d.
- **Closed, not ground** (thin wire, cheap): the ends are closed but not ground, so L_c ≈ (n_t + 1.5)·d (check).
- **Open** (rare, cheap, only for low duty): no dead coils, so n_t = n; the end stands on the wire tip, giving an eccentric force.

The pitch of the active coils follows from the free length: for closed ends m ≈ (L0 − 2·d)/n, because each dead coil
uses about one wire diameter. The helix angle is α = arctan(m/(π·D)).

```python
def end_types(P=None):
    """nt, solid length, pitch and helix angle for the three end types (same n, L0)."""
    P = dict(P or DEFAULT)
    out = []
    for e in ("closed and ground", "closed not ground", "open"):
        Q = dict(P, ends=e)
        g = geometry(Q)
        out.append({"ends": e, "nt": g["nt"], "Lc": g["Lc"], "pitch": g["pitch"],
                    "helix_deg": math.degrees(math.atan(g["pitch"] / (math.pi * P["D"]))), "Ln_min": g["Ln_min"]})
    return out
```

```
## 3.3 End types (n 8.5, L0 74.0)
  closed and ground  nt 10.5, Lc  26.25, pitch 8.118, helix 5.90 deg, Ln_min 34.22
  closed not ground  nt 10.5, Lc  30.00, pitch 8.118, helix 5.90 deg, Ln_min 37.97
  open               nt  8.5, Lc  25.00, pitch 8.706, helix 6.33 deg, Ln_min 32.97
```

**Hand check:**

- Pitch: m = (74 − 2·2.5)/8.5 = 69/8.5 = **8.118 mm**.
- Helix angle: arctan(8.118/(π·25)) = arctan(0.1034) = **5.90°**.

Below about 10° the bending part of the wire load can be neglected; the formulas of 3.1 and 3.2 are then exact enough.

Closed-not-ground ends cost 3.75 mm of solid length here. For the dynamic default that would push L_n to 37.97 mm, which
is above the required L2 of 35 mm. So **this spring has to be ground**, a small but real manufacturing consequence.

### 3.5 Characteristic and working points

In the linear range the force is F = R·(L0 − L). The add-on samples it from L0 down to solid:

```python
def characteristic(P=None, n_pts=6):
    """Force-length points from L0 to the solid length (linear model) with the working points L1, L2."""
    P = dict(P or DEFAULT)
    R = rate(P)
    g = geometry(P)
    pts = []
    for i in range(n_pts + 1):
        L = P["L0"] - (P["L0"] - g["Lc"]) * i / n_pts
        pts.append((L, R * (P["L0"] - L)))
    return {"R": R, "points": pts, "F1": R * (P["L0"] - P["L1"]), "F2": R * (P["L0"] - P["L2"]),
            "margin_to_solid": P["L2"] - g["Lc"]}
```

```
## 3.4 Characteristic (linear) with preload
  L  74.00 mm  F    0.0 N
  L  66.04 mm  F   23.3 N
  L  58.08 mm  F   46.5 N
  L  50.12 mm  F   69.8 N
  L  42.17 mm  F   93.0 N
  L  34.21 mm  F  116.3 N
  L  26.25 mm  F  139.6 N
  working points F1 55.5 N (L1 55), F2 114.0 N (L2 35); L2 - Lc = 8.75 mm
```

**Hand check:**

- F1 = 2.9228 · (74 − 55) = 2.9228 · 19 = **55.5 N**.
- F2 = 2.9228 · 39 = **114.0 N**.
- Force at solid: F_c = 2.9228 · (74 − 26.25) = 139.6 N.
- Work over the stroke: ½·R·(s2² − s1²) = 0.5·2.9228·(1521 − 361) = 1695 N mm = **1.695 J** ✓, as in the core report.

The real characteristic is linear only between about 0.3·s_c and 0.85·s_c:

- **At the start** the ground end coils must first seat on the spring plates, so the curve is slightly progressive.
- **Near solid** the coils with the smallest pitch (pitch scatter from coiling) touch first, so the active coil count
  falls and the rate rises.

EN 13906-1 therefore wants the working points inside that range, which the minimum gap S_a guarantees. Why preload
is used: the follower needs **F1 = 55 N at the cam base circle**, but the spring has no force at L0. A preload travel of
s1 = 19 mm is spent just to create that force. A softer spring (lower R) with more preload travel would give a flatter
characteristic and a smaller F2, but a longer spring and a lower natural frequency (chapter 5).

---

## 4. Stability: buckling, guides, coil growth, series / parallel / nested springs

### 4.1 Coil diameter growth and guide clearance

When a compression spring is compressed, the pitch angle decreases and the wire rotates about its own axis, so **the
coil diameter grows** slightly. At solid length the outer diameter is larger than in the free state. A sleeve (outer
guide) must allow for that, and a mandrel (inner guide) must allow for the inner diameter **decreasing** relative to the
mandrel when the spring buckles sideways.

EN 13906-1 gives the increase of the outer diameter at solid as (check the standard)

  ΔD_e = 0.1·(m² − 0.8·m·d − 0.2·d²) / D,  m = pitch of the unloaded spring.

```python
def coil_growth_EN(P=None):
    P = dict(P or DEFAULT)
    g = geometry(P)
    m, d, D = g["pitch"], P["d"], P["D"]
    dDe = 0.1 * (m ** 2 - 0.8 * m * d - 0.2 * d ** 2) / D
    return {"pitch": m, "dDe_EN": dDe, "Da_solid_EN": g["Da"] + dDe, "Da_solid_core": g["Da_solid"]}

def guide_clearance(P=None):
    """Mandrel / sleeve sizes: diametral clearance ~0.02 D plus the coil growth (rule of thumb, check maker data)."""
    P = dict(P or DEFAULT)
    g = geometry(P)
    cg = coil_growth_EN(P)
    c = 0.02 * P["D"]
    return {"mandrel_max": g["Di"] - c, "sleeve_min": cg["Da_solid_EN"] + c, "clearance": c}
```

```
## 4.1 Coil growth and guides
  pitch 8.118 mm: EN growth 0.194 mm -> Da at solid 27.69 (core geometry() gives 27.69)
  clearance 0.02 D = 0.50 mm: mandrel <= 22.00 mm, sleeve >= 28.19 mm
```

**Hand check:**

- m² = 65.90, 0.8·m·d = 16.24, 0.2·d² = 1.25.
- ΔD_e = 0.1 · (65.90 − 16.24 − 1.25)/25 = 0.1 · 48.41/25 = **0.194 mm**.
- Outer diameter at solid: 27.50 + 0.19 = 27.69 mm.

**Note:** the core `geometry()` and this add-on use the same EN 13906-1 formula with m² (an earlier program version
had (m − d)² and gave only +0.06 mm – corrected). Both give 27.69 mm; size the sleeve from this value plus the
guide clearance (check against the standard text).

Guide rules (check maker data):

- Diametral clearance about 0.02·D for D ≤ 30 mm, more for larger springs.
- **Sleeve ≥ D_e,solid + clearance = 28.2 mm**; **mandrel ≤ D_i − clearance = 22.0 mm**.
- Guides cause friction and wear on the spring, which reduces fatigue life. Dynamic springs are therefore guided
  only where buckling makes it necessary, and then by a mandrel rather than a sleeve: the inner side is the stressed side,
  but sleeve contact rubs the outer surface, which is shot-peened and decides fatigue. This is a manufacturing judgement;
  check it with the maker.
- Surfaces should be hardened and smooth, and lubricated if the spring rubs.

### 4.2 Buckling

A long slender compression spring behaves like a column. Above a certain deflection it bows sideways. It then rubs on its
guide or, unguided, jumps out of the mechanism. Unlike a solid column, the spring also becomes **shorter** and **less
stiff in shear** as it is compressed, so the buckling travel is found from a column formula that includes both the
bending stiffness (∝ E) and the shear stiffness (∝ G) of the coil "tube". The result (Haringx theory, as used in
EN 13906-1) is

  s_K = L0 · 0.5/(1 − G/E) · [1 − √(1 − (1 − G/E)/(0.5 + G/E) · (π·D/(ν·L0))²)],

where ν is the **seating coefficient**, the same idea as the effective length factor of a column:

| Seating | ν |
|---|---|
| both ends fixed, guided (parallel, ground plates) | 0.5 |
| one fixed, one pinned | 0.7 |
| both pinned (ends can tilt) | 1.0 |
| one fixed, one free | 2.0 |

If the root is imaginary, the spring **cannot buckle** for any travel. That happens when

  L0/D < π/ν · √((1 − G/E)/(0.5 + G/E)).

```python
def buckling(P):
    mat = MATERIALS[P["material"]]
    ge = mat["G"] / mat["E"]
    nu = SEATING[P["seating"]]
    arg = 1 - (1 - ge) / (0.5 + ge) * (math.pi * P["D"] / (nu * P["L0"])) ** 2
    if arg < 0:
        return {"nu": nu, "sK": None, "safe": True, "slenderness": P["L0"] / P["D"]}
    sK = P["L0"] * 0.5 / (1 - ge) * (1 - math.sqrt(arg))
    s2 = P["L0"] - P["L2"]
    return {"nu": nu, "sK": sK, "safe": s2 < sK, "slenderness": P["L0"] / P["D"]}
```

The add-on turns this into a **nomogram table** (s_K/L0 over L0/D for each seating) and the stability limit:

```python
def buckling_nomogram(L0_over_D=(2, 3, 4, 5, 6, 8, 10)):
    rows = []
    for seat, nu in SEATING.items():
        r = []
        for x in L0_over_D:
            L0 = x * DEFAULT["D"]
            b = buckling(dict(DEFAULT, seating=seat, L0=L0, L1=L0 - 1, L2=L0 - 2))
            r.append(None if b["sK"] is None else b["sK"] / L0)
        rows.append((seat, nu, r))
    return {"L0_over_D": L0_over_D, "rows": rows}

def stable_limit(nu, ge):
    """Slenderness L0/D below which the spring cannot buckle: pi / nu * sqrt((1 - G/E)/(0.5 + G/E))."""
    return math.pi / nu * math.sqrt((1 - ge) / (0.5 + ge))
```

```
## 4.2 Buckling nomogram s_K/L0 (D 25, VDSiCr; '-' = stable)
  seating                    nu   L0/D=2    L0/D=3    L0/D=4    L0/D=5    L0/D=6    L0/D=8    L0/D=10  
  both ends fixed, guided    0.5  -         -         -         -         0.415     0.198     0.120    
  one fixed one pinned       0.7  -         -         0.524     0.273     0.177     0.094     0.059    
  both pinned                1.0  -         0.415     0.198     0.120     0.081     0.045     0.028    
  one fixed one free         2.0  0.198     0.081     0.045     0.028     0.020     0.011     0.007    
  stable for any travel if L0/D < 5.23 (nu 0.5), 3.74 (nu 0.7), 2.62 (nu 1.0), 1.31 (nu 2.0)
```

**Hand check** for ν = 0.5 and L0/D = 6 (L0 = 150 mm):

- G/E = 79 500/206 000 = 0.3859.
- (1 − G/E)/(0.5 + G/E) = 0.6141/0.8859 = 0.6932.
- π·D/(ν·L0) = π·25/75 = 1.0472, squared 1.0966, so the root argument is 1 − 0.6932·1.0966 = 0.2398, √ = 0.4897.
- s_K = 150 · 0.5/0.6141 · (1 − 0.4897) = 122.1 · 0.5103 = **62.3 mm**, so s_K/L0 = **0.415** ✓.
- Stability limit for ν = 0.5: π/0.5 · √0.6932 = 6.283 · 0.8326 = **5.23** ✓.

The core example (`python spring.py examples`) shows the same picture for the default spring with longer free lengths
and a 30 mm deflection:

```
## Seating and buckling (L0 varied)
  L0  70 (L0/D 2.8), both ends fixed, guided  s_K none, s2 30 -> OK
  L0  70 (L0/D 2.8), both pinned              s_K 36.7, s2 30 -> OK
  L0 100 (L0/D 4.0), both ends fixed, guided  s_K none, s2 30 -> OK
  L0 100 (L0/D 4.0), both pinned              s_K 19.8, s2 30 -> BUCKLES
  L0 130 (L0/D 5.2), both ends fixed, guided  s_K none, s2 30 -> OK
  L0 130 (L0/D 5.2), both pinned              s_K 14.4, s2 30 -> BUCKLES
  L0 160 (L0/D 6.4), both ends fixed, guided  s_K 55.2, s2 30 -> OK
  L0 160 (L0/D 6.4), both pinned              s_K 11.4, s2 30 -> BUCKLES
```

Practical rules from the table:

1. **The default (L0/D = 2.96, ground ends on parallel plates) cannot buckle.** The report says "s_K none (stable)".
2. **Seating matters more than length.** The same L0 = 100 mm spring is unconditionally stable with fixed ends (ν = 0.5)
   but buckles at 19.8 mm with tilting ends. In practice "fixed" means:
   - ground ends sit on plane, parallel spring plates (parallelism within about 0.5°, check);
   - the plates do not tilt under load;
   - the follower guide holds the moving plate square.
   A cam follower guided in a bush gives ν close to 0.5. A spring pushing a lever with a ball end is nearer ν = 1.
3. If buckling cannot be avoided by geometry (L0/D small, more coils of thicker wire, nested springs), **guide it**
   (4.1) or split it into two springs in series with a guided intermediate disc.
4. A sleeve or mandrel only limits the sideways movement. The spring still tries to buckle and **presses on the guide**,
   which adds friction and wear. So geometry first, guides second.

### 4.3 Progressive spring (variable pitch)

If the pitch is not uniform, the coils with the smallest pitch touch first. From that point they no longer deflect,
the active coil count drops, and the rate increases: a **progressive** characteristic. It is used in vehicle suspensions,
and in valve springs to shift the natural frequency during the stroke and avoid surge. A two-zone model is enough to
understand it: n_c coils with small pitch p_c and the rest with the normal pitch, both zones loaded by the same force
(springs in series).

  zone rates R_i = G·d⁴/(8·D³·n_i);  R_start = 1/(1/R_1 + 1/R_2);  zone 1 is solid at F_knee = R_1·n_c·(p_c − d);
  after the knee R = R_2.

```python
def progressive_two_zone(P=None, n_close=3.0, p_close=None):
    P = dict(P or DEFAULT)
    G = MATERIALS[P["material"]]["G"]
    d, D, n = P["d"], P["D"], P["n"]
    p_close = p_close or d + 0.4 * (geometry(P)["pitch"] - d)
    n2 = n - n_close
    k = G * d ** 4 / (8 * D ** 3)
    R1, R2 = k / n_close, k / n2
    Rs = 1 / (1 / R1 + 1 / R2)
    s_gap1 = n_close * (p_close - d)              # travel until zone 1 is solid (zone 1 deflection)
    F_knee = R1 * s_gap1
    s_knee = F_knee / Rs
    return {"R_start": Rs, "R_after": R2, "F_knee": F_knee, "s_knee": s_knee, "p_close": p_close, "R_check_linear": rate(P)}
```

```
## 4.3 Progressive spring (3 coils with small pitch)
  small pitch 4.747 mm: R 2.923 N/mm until F 55.8 N (s 19.10 mm), then R 4.517 N/mm (uniform pitch: 2.923)
```

**Hand check:**

- G·d⁴/(8·D³) = 3 105 469/125 000 = 24.84 N mm per coil.
- Zone rates: R_1 = 24.84/3 = 8.281, R_2 = 24.84/5.5 = 4.517.
- In series: 1/(1/8.281 + 1/4.517) = 2.923, the same as the uniform spring, because the total active coils are still 8.5.
- Small pitch p_c = 2.5 + 0.4·5.618 = 4.747 mm, so the zone-1 gap travel is 3·2.247 = 6.741 mm.
- F_knee = 8.281·6.741 = **55.8 N** at s = 55.8/2.923 = **19.10 mm** ✓.

The knee falls almost exactly at the **installed preload** (F1 = 55.5 N at s1 = 19 mm). This variant would work in the
cam over its whole stroke at 4.52 N/mm instead of 2.92:

- F2 rises from 114 N to about 146 N;
- the natural frequency rises, which helps against surge;
- the cam contact force rises by 32 N at full lift, which costs Hertz stress and torque (M6 chapter 5).

The touching coils also hammer against each other in dynamic service, which is noise and wear. So for the cam follower
the **uniform pitch** is the right choice. A progressive spring is chosen deliberately when the frequency must shift or
the load range is very wide.

### 4.4 Springs in series, in parallel, and nested

Two springs **in series** carry the same force and add deflections: 1/R = 1/R_1 + 1/R_2. **In parallel** they share the
deflection and add forces: R = R_1 + R_2.

```python
def series_parallel(R1, R2):
    return {"series": 1 / (1 / R1 + 1 / R2), "parallel": R1 + R2}
```

A **nested spring** is a parallel pair, one inside the other, with the same free length. It gives more force in the same
installation space (valve springs, heavy dies), and it is redundant: if one spring breaks, the other still holds, which
is important for engine valves. The two springs are wound with **opposite hand** so that a broken coil end or a buckling
inner spring cannot screw itself into the coils of the outer one.

```python
def nested(P=None, d_in=1.8, D_in=18.0, n_in=None):
    P = dict(P or DEFAULT)
    n_in = n_in or P["n"]                         # same number of active coils as the outer spring (simple)
    Pi = dict(P, d=d_in, D=D_in, n=n_in)
    Ro, Ri = rate(P), rate(Pi)
    s = P["L0"] - P["L2"]
    _, to = stress(P, Ro * s)
    _, ti = stress(Pi, Ri * s)
    gap = (P["D"] - P["d"]) / 2 - (D_in + d_in) / 2
    return {"R_outer": Ro, "R_inner": Ri, "R_total": Ro + Ri, "tau_k_outer": to, "tau_k_inner": ti, "radial_gap": gap}
```

```
## 4.4 Series / parallel / nested
  two default springs: series 1.461 N/mm, parallel 5.846 N/mm (single 2.923)
  nested inner d 1.8 / D 18 / n 8.5: R outer 2.923 + inner 2.104 = 5.027 N/mm; tau_k at L2 527 / 732 MPa; radial gap 1.35 mm
```

**Hand check** (inner spring):

- R = 79 500·1.8⁴/(8·18³·8.5) = 79 500·10.498/396 576 = **2.104 N/mm**.
- At the same deflection s = 39 mm: F = 82.1 N, τ = 8·82.1·18/(π·1.8³) = 645 MPa, so τ_k = 1.1351·645 = **732 MPa**.
- Radial gap between the springs: (25 − 2.5)/2 − (18 + 1.8)/2 = 11.25 − 9.90 = **1.35 mm**.

Lesson: in a nested pair with equal free length and equal deflection, the **inner spring is stressed more** (732 against
527 MPa), because τ ∝ s·d/(n·D²) (from τ = 8·F·D/(π·d³) and F = R·s). For equal stresses the design rule is
d_i/D_i² · 1/n_i = d_o/D_o² · 1/n_o. The inner spring therefore normally gets **more coils or a thinner wire**, and its free
length is matched so both reach their stresses together (check with chapter 5).

The 1.35 mm radial gap must also cover the coil growth of the inner spring and the buckling deflection. With 0.2 mm
growth per spring this is acceptable, but it is near the lower limit. A gap of about 0.1·D_i (1.8 mm) would be more
robust (check maker data).

### 4.5 Summary of chapters 2–4 for the default spring

| Item | Value | Status |
|---|---|---|
| Material | EN 10270-2 VDSiCr, shot peened; R_m,min 1978 MPa, τ_zul 989 MPa | relaxation only ≈ 2 % at 80 °C |
| Geometry | d 2.5, D 25 (w 10), n 8.5 active / 10.5 total, closed and ground | w in the ideal range |
| Rate, forces | R 2.923 N/mm; F1 55.5 N at L1 55, F2 114.0 N at L2 35 | meets the M6 requirement (≥ 50 N, ≈ 3 N/mm) |
| Lengths | L_c 26.25, S_a (dynamic) 7.97, L_n 34.22 ≤ L2 35.0 mm | must be **ground** (not-ground ends need L_n 37.97) |
| Stress | τ 464 MPa (S 2.13), τ_k 527 MPa; solid 569 MPa ≤ τ_zul | can be compressed to solid without damage |
| Buckling | L0/D 2.96 < 5.23 (ν 0.5) | cannot buckle; keep the spring plates parallel |
| Guides | sleeve ≥ 28.2 mm, mandrel ≤ 22.0 mm (if used) | the EN coil growth (0.19 mm) is larger than the core value |
| Alternatives | progressive version raises F2 to ≈ 146 N; nested pair 5.03 N/mm | not needed for the cam follower |

Fatigue, natural frequency and the design procedure that produced d = 2.5 mm follow in chapters 5 and 6.


---

## 5. Strength: static, fatigue (Haigh), relaxation; dynamics: natural frequency, surge, impact

A spring is the most highly stressed part in most machines: 450–550 MPa of shear stress is normal, and in valve
springs the corrected stress swings by 400 MPa or more, millions of times. That is only possible because spring
wire is extremely strong (R_m ≈ 1800–2200 MPa) and its surface is protected (shot peening). This chapter shows how
the program proves the four strength limits and the dynamic limits:

| Limit | Question | Section |
|---|---|---|
| Static | Does the spring take a permanent set at L2 or at solid length? | 5.1 |
| Fatigue | Does it break after N cycles under the working stroke? | 5.2 |
| Relaxation | How much force does it lose at temperature over time? | 5.3 |
| Dynamics | Does the coil mass vibrate (surge)? Does an impact overload it? | 5.4 |

All results in this chapter come from the default spring: the M6 cam follower spring, VDSiCr, shot peened,
d 2.5 mm, D 25 mm, n 8.5, L0 74 mm, L1 55 mm (F1 55.5 N), L2 35 mm (F2 114.0 N).

### 5.1 Static strength

#### 5.1.1 Why the stress is torsion

Cut the wire anywhere in a coil. The axial force F acts at the coil centre, a distance D/2 from the wire centre.
So every wire cross-section carries a **torque** T = F·D/2 (plus a small shear force F and, for pitched coils, a
small bending moment – both neglected in EN 13906-1 except through the correction factor). The torsion stress
of a round bar is

τ = T / W_t = (F D/2) / (π d³/16) = **8 F D / (π d³)**.

Because the wire is curved, the stress on the inside of the coil is higher than on the outside (shorter fibre,
same twist angle) and the direct shear F/A adds on the inside too. Bergsträsser's factor collects both effects:

k = (w + 0.5)/(w − 0.75), with w = D/d (spring index).

The **uncorrected** τ is used for static checks (local yielding on the inside redistributes the stress), the
**corrected** τ_k = k·τ for fatigue (cracks start at the most stressed point, which is the inside of the coil).

```python
def berg(w):
    """Bergsträsser stress correction factor k = (w + 0.5)/(w - 0.75), w = D/d."""
    return (w + 0.5) / (w - 0.75)

def stress(P, F):
    tau = 8 * F * P["D"] / (math.pi * P["d"] ** 3)
    return tau, berg(P["D"] / P["d"]) * tau
```

#### 5.1.2 Permissible static stress

EN 13906-1 uses τ_zul = 0.5·R_m for cold-formed springs of patented and oil-tempered wire (uncorrected stress).
R_m depends strongly on the wire diameter: a thin wire is drawn more (more cold work) and, for oil-tempered wire,
quenches more evenly. The program uses a power-law fit R_m,min = A·d^(−m) to the minimum values of EN 10270:

```python
def Rm_min(P, d=None):
    m = MATERIALS[P["material"]]
    return m["A"] * (P["d"] if d is None else d) ** (-m["m"])

def tau_zul(P, d=None):
    """Permissible static shear stress (uncorrected) 0.5 Rm (EN 13906-1 style, check)."""
    return 0.5 * Rm_min(P, d)
```

The add-on prints the curve for all three wire types:

```python
def tau_zul_curve(P, ds=(1.0, 2.0, 3.0, 5.0, 8.0)):
    """tau_zul = 0.5 Rm_min(d) for every material (uncorrected stress, EN 13906-1 style)."""
    return [(m, [(d, Rm_min(dict(P, material=m), d), tau_zul(dict(P, material=m), d)) for d in ds]) for m in MATERIALS]
```

`python spring.py ch56`

```
## 5.1 Permissible static stress tau_zul = 0.5 Rm_min(d)
  EN 10270-1 DH (patented, cold drawn)       d 1: 2230/1115  d 2: 1982/991  d 3: 1850/925  d 5: 1696/848  d 8: 1566/783
  EN 10270-2 VDSiCr (oil tempered, valve)    d 1: 2080/1040  d 2: 2002/1001  d 3: 1958/979  d 5: 1904/952  d 8: 1855/928
  EN 10270-3 1.4310 (stainless)              d 1: 2000/1000  d 2: 1815/908  d 3: 1715/857  d 5: 1597/798  d 8: 1495/747
  default spring: tau at solid 569 MPa, tau_zul 989, after presetting 1108 -> solid safe True / True
```

Reading the table:

* Patented DH wire is the strongest in thin sizes but loses ~30 % from 1 to 8 mm (drawing strengthens the surface
  more than the core of a thick wire). Oil-tempered VDSiCr is nearly size-independent (−11 %): quench and temper
  give a homogeneous structure. Stainless 1.4310 is weaker and loses strength fastest with d.
* For thick springs (d > 5 mm) oil-tempered SiCr wire is therefore the natural choice; above d ≈ 10–17 mm springs
  are hot-coiled from bar and hardened afterwards (chapter 7).

**Hand check (default, d = 2.5 mm, VDSiCr):** R_m = 2080 · 2.5^(−0.055) = 2080 · e^(−0.055 · 0.9163) =
2080 · 0.9509 = **1978 MPa**, τ_zul = **989 MPa** – as in the report (`python spring.py examples`):

```
## Material
- Rm_min 1978 MPa, tau_zul = 0.5 Rm 989 MPa, G 79500 MPa
```

#### 5.1.3 Stress at L2 and at solid length – "solid-safe" springs

The report checks τ at the largest working force F2 and at solid length L_c:

```python
def static_check(P):
    Fc = forces(P)["Fc"]
    tau_c, _ = stress(P, Fc)
    t2, _ = stress(P, forces(P)["F2"])
    tz = tau_zul(P)
    return {"tau_c": tau_c, "tau_2": t2, "tau_zul": tz, "S_solid": tz / tau_c, "S_2": tz / t2, "block_safe": tau_c <= tz}
```

```
## Stresses
- tau at L2 464 MPa (S 2.13 OK), at solid 569 MPa (can be compressed to solid)
```

**Hand check:** F_c = R·(L0 − L_c) = 2.9228 · (74 − 26.25) = 139.6 N.
τ_c = 8 · 139.6 · 25 / (π · 2.5³) = 27 920 / 49.09 = **569 MPa** ≤ 989 MPa.

A spring whose stress at solid length is below τ_zul is called **solid-safe** (German: *blockfest*). Insist on it
whenever the spring can be compressed to solid during assembly, by a jammed cam follower or by a maintenance
technician – a solid-safe spring cannot take a permanent set, whatever happens.

**Presetting (setting).** After coiling, the spring is compressed to solid once or several times. The inside of
the coil yields slightly and, after unloading, keeps a residual stress of the opposite sign. The usable static
stress rises by roughly 10–15 % (the program uses `PRESET_FACTOR = 1.12`, check with the spring maker) and the free
length becomes stable. L0 must be coiled longer by the expected set (the maker determines it in trials):

```python
PRESET_FACTOR = 1.12   # presetting (setting to solid after coiling) raises the usable static stress ~10-15 % (check)

def solid_safe_check(P):
    """Stress at solid length against tau_zul, without and with presetting."""
    F = forces(P)
    tc, _ = stress(P, F["Fc"])
    tz = tau_zul(P)
    return {"tau_c": tc, "tau_zul": tz, "tau_zul_preset": PRESET_FACTOR * tz,
            "solid_safe": tc <= tz, "solid_safe_preset": tc <= PRESET_FACTOR * tz}
```

The default spring is solid-safe even without presetting (569 < 989 MPa) – a consequence of choosing a fatigue
safety of about 2 (section 5.2): a spring that is good for fatigue is nearly always solid-safe.

### 5.2 Fatigue: the Haigh diagram

#### 5.2.1 Why a spring breaks

A dynamically loaded spring breaks almost always at the **inside of the coil**, starting from a surface defect:
a drawing scratch, a seam, a decarburised layer, a corrosion pit or a tool mark from coiling. The crack runs at
45° to the wire axis (normal to the largest principal stress of torsion). Three things decide the life:

1. the **stroke stress** τ_kH = τ_k2 − τ_k1 (the swing of the corrected stress),
2. the **lower stress** τ_kU = τ_k1 (a higher mean stress lowers the allowed swing),
3. the **surface** – shot peening puts compressive residual stress (−500 … −800 MPa) into the outer 0.1–0.3 mm
   and closes small defects; it raises the fatigue strength by 20–30 % (data below).

#### 5.2.2 The Haigh line used by the program

EN 13906-1 gives fatigue diagrams (Goodman type) for each wire type, diameter and surface state, drawn as
τ_kO (upper stress) over τ_kU (lower stress), for N = 10⁷ (endurance) and for finite lives. The program models each
diagram by a straight line between two well-known points:

* at τ_kU = 0 (pulsating load from zero) the allowed upper stress is the pulsating fatigue strength τ_D0,
  written as a fraction of R_m: τ_D0 = f_D0·R_m (0.30 unpeened / 0.38 peened for VDSiCr – check the EN diagram for
  your diameter);
* at the static limit τ_kU = τ_kO = τ_st = 0.5·R_m the swing is zero.

τ_kO,lim(τ_kU) = τ_D0 + (1 − τ_D0/τ_st)·τ_kU   and   S_fat = (τ_kO,lim − τ_kU)/(τ_kO − τ_kU).

```python
def fatigue(P):
    """Goodman-type Haigh line in corrected stresses: tau_kO,lim = tau_D0 + (1 - tau_D0/tau_st) tau_kU,
    tau_D0 = f_D0 Rm (pulsating endurance stroke at 1e7, check), tau_st = 0.5 Rm (static limit)."""
    mat = MATERIALS[P["material"]]
    F = forces(P)
    _, tk1 = stress(P, F["F1"])
    _, tk2 = stress(P, F["F2"])
    Rm = Rm_min(P)
    tD0 = (mat["fD0_peened"] if P["shot_peened"] else mat["fD0"]) * Rm
    tst = 0.5 * Rm
    tkO_lim = tD0 + (1 - tD0 / tst) * tk1
    tkH, tkH_lim = tk2 - tk1, tkO_lim - tk1
    return {"tau_kU": tk1, "tau_kO": tk2, "tau_kH": tkH, "tau_D0": tD0, "tau_kO_lim": tkO_lim, "tau_kH_lim": tkH_lim,
            "S_fat": tkH_lim / tkH if tkH > 0 else float("inf")}
```

```
- fatigue (corrected): tau_kU 257, tau_kO 527, stroke 270 MPa; tau_D0 752, allowed stroke 556 MPa -> S 2.06 OK
```

**Hand check.** w = 25/2.5 = 10, k = 10.5/9.25 = 1.1351.
τ_k1 = 1.1351 · 8 · 55.5 · 25 / 49.09 = 1.1351 · 226.1 = **257 MPa**,
τ_k2 = 1.1351 · 8 · 114.0 · 25 / 49.09 = 1.1351 · 464.4 = **527 MPa**, τ_kH = **270 MPa**.
τ_D0 = 0.38 · 1978 = **752 MPa**; τ_st = 989 MPa.
τ_kO,lim = 752 + (1 − 752/989) · 257 = 752 + 0.2397 · 257 = **813.6 MPa**; allowed stroke 813.6 − 257 = **556 MPa**;
S_fat = 556/270 = **2.06** ✓.

The safety is defined on the **stroke** (the vertical distance in the diagram), because in a cam drive the stroke
is fixed by the cam and only the preload changes with tolerances. A safety of 1.1 is the usual minimum for
springs with EN-diagram data (the scatter is already inside the diagram, which gives the 90 % survival line);
1.2–1.5 is chosen where the duty is uncertain.

#### 5.2.3 Finite life: lines for 10⁵, 10⁶, 10⁷ cycles

A cam spring at 300 rpm sees 18 000 cycles per hour, 10⁷ cycles in 556 hours – endurance strength is therefore
required for any machine spring that works continuously. For springs that work rarely (a safety valve, a clamp)
a finite life is acceptable. The add-on scales τ_D0 with typical life factors (check against the EN 13906-1 diagrams
for the actual wire) and caps every line below the static limit:

```python
LIFE_FACTOR = {1e5: 1.45, 1e6: 1.15, 1e7: 1.00}   # tau_D0(N) / tau_D0(1e7) (check EN 13906-1 Annex fatigue diagrams)

def haigh_lines(P, n_pts=6):
    """Upper corrected stress limit tau_kO,lim(tau_kU) for 1e5, 1e6, 1e7 cycles; static limit tau_st = 0.5 Rm."""
    mat = MATERIALS[P["material"]]
    Rm = Rm_min(P)
    tst = 0.5 * Rm
    base = (mat["fD0_peened"] if P["shot_peened"] else mat["fD0"]) * Rm
    out = {}
    for N, fN in LIFE_FACTOR.items():
        tD0 = min(fN * base, 0.95 * tst)
        out[N] = [(tst * i / (n_pts - 1), tD0 + (1 - tD0 / tst) * tst * i / (n_pts - 1)) for i in range(n_pts)]
    return {"tau_st": tst, "lines": out}
```

`life_estimate()` interpolates log N between the three lines at the actual τ_kU:

```python
def life_estimate(P):
    """Cycles reached by the working stroke (log interpolation between the 1e5 / 1e6 / 1e7 lines)."""
    ft = fatigue(P)
    ...
    tkO = ft["tau_kO"]
    if tkO <= pts[-1][1]:
        return {"tau_kO": tkO, "N": float("inf"), "pts": pts}
    lo = sorted(pts, key=lambda p: p[0])
    for (Na, ta), (Nb, tb) in ((lo[2], lo[1]), (lo[1], lo[0])):
        if ta <= tkO <= tb:
            f = (tkO - ta) / (tb - ta)
            return {"tau_kO": tkO, "N": 10 ** (math.log10(Na) + f * (math.log10(Nb) - math.log10(Na))), "pts": pts}
    return {"tau_kO": tkO, "N": 0.0, "pts": pts}      # above the 1e5 line: short life / static limit, not covered
```

`python spring.py ch56`

```
## 5.2 Haigh lines (corrected stresses, MPa): tau_kO,lim at tau_kU
  N 1e+05:   0->939  198->949  396->959  593->969  791->979  989->989
  N 1e+06:   0->864  198->889  396->914  593->939  791->964  989->989
  N 1e+07:   0->752  198->799  396->846  593->894  791->941  989->989
  default: tau_kU 257, tau_kO 527 MPa -> limit at 1e7 813 MPa, expected life endurance (> 1e7)
  lightest candidate d 2.2 / n 5: tau_kU 368, tau_kO 767 -> life endurance (> 1e7), S_fat 1.20
  failing candidate d 2.0 / n 3.5: tau_kO 996 MPa > 1e5 line 975 MPa -> less than 1e5 cycles (5.6 h at 5 Hz) - not usable
```

Notes on the output:

* The 10⁵ line starts at 939 MPa, not at 1.45 · 752 = 1090 MPa: the cap 0.95·τ_st = 0.95 · 989 = 939.6 MPa keeps every
  line below the static limit (a stress above τ_st means a set in the first cycle, not fatigue).
* The lightest design candidate (d 2.2, n 5, chapter 6) still reaches endurance, but with S_fat 1.20 – little
  margin for a preload tolerance. The candidate d 2.0 / n 3.5 exceeds even the 10⁵ line: it would break within
  about 5.6 hours of running at 5 Hz. This is the typical failure of a spring chosen only by force and length.

To draw the diagram: plot the three lines (x = τ_kU, y = τ_kO), the diagonal τ_kO = τ_kU, and the working point
(257, 527). The vertical distance from the working point down to the diagonal is the actual stroke 270 MPa; the
distance from the diagonal up to the 10⁷ line is the allowed stroke 556 MPa.

#### 5.2.4 Shot peening and wire choice

```python
def peening_effect(P):
    """Fatigue safety with and without shot peening for every material (same geometry)."""
    rows = []
    for m in MATERIALS:
        a = fatigue(dict(P, material=m, shot_peened=False))["S_fat"]
        b = fatigue(dict(P, material=m, shot_peened=True))["S_fat"]
        rows.append((m, a, b))
    return rows
```

```
  shot peening (same geometry): EN 10270-1 DH 1.20 -> 1.50; EN 10270-2 VDSiCr 1.62 -> 2.06; EN 10270-3 1.4310 1.10 -> 1.37
```

Shot peening raises the safety by about 25 % for every wire. Combined with the cleaner valve-spring wire
(VDSiCr: low inclusion content, eddy-current tested surface, peeled before drawing) it gives the 2.06 of the
default spring – the reason this wire was chosen for a spring that makes 10⁹ cycles in 6 years of two-shift work.
The cheaper DH wire, peened, would still reach 1.50 – acceptable, but DH is limited to about 80 °C (relaxation,
section 5.3).

#### 5.2.5 Effect of preload and stroke

The cam fixes the stroke (20 mm) but the installed length L1 depends on the tolerance chain of the follower and
the housing. The add-on maps S_fat over L1 and stroke, and marks combinations where L2 falls below the minimum
working length L_n,min (coil clash):

```python
def fatigue_map(P, L1s=(60.0, 57.5, 55.0, 52.5, 50.0), strokes=(15.0, 20.0, 25.0)):
    """Fatigue safety vs installed length L1 (preload) and stroke (L2 = L1 - stroke)."""
    rows = []
    for L1 in L1s:
        row = []
        for st in strokes:
            Q = dict(P, L1=L1, L2=L1 - st)
            g = geometry(Q)
            ok_len = Q["L2"] >= g["Ln_min"]
            row.append((fatigue(Q)["S_fat"], ok_len))
        rows.append((L1, forces(dict(P, L1=L1))["F1"], row))
    return rows
```

```
  fatigue safety vs installed length L1 (preload) and stroke:
    L1 60.0 (F1  40.9 N): stroke 15: 3.00  stroke 20: 2.25  stroke 25: 1.80
    L1 57.5 (F1  48.2 N): stroke 15: 2.87  stroke 20: 2.15  stroke 25: 1.72 (L2 < Ln_min)
    L1 55.0 (F1  55.5 N): stroke 15: 2.74  stroke 20: 2.06  stroke 25: 1.65 (L2 < Ln_min)
    L1 52.5 (F1  62.8 N): stroke 15: 2.62  stroke 20: 1.96 (L2 < Ln_min)  stroke 25: 1.57 (L2 < Ln_min)
    L1 50.0 (F1  70.1 N): stroke 15: 2.49  stroke 20: 1.87 (L2 < Ln_min)  stroke 25: 1.49 (L2 < Ln_min)
```

Two lessons:

1. **Fatigue is not the limit of this spring – length is.** Fatigue safety stays above 1.5 everywhere; but
   shortening L1 by only 2.5 mm (more preload) makes L2 = 32.5 mm < L_n,min = 34.22 mm: the coils would touch
   at full lift. Coil clash in a dynamic spring causes impact, noise and fracture at the contact points. The
   tolerance chain of L1 must therefore be held within about −0.8 / +5 mm (L2 = 35 − 34.22 = 0.78 mm reserve) –
   or the spring gets one more active coil (longer L_c, but more reserve if L0 rises accordingly).
2. More preload (smaller L1) lowers S_fat only slowly (2.25 → 1.87 from 40.9 to 70.1 N): the Haigh line is flat
   (slope 0.24). The cam designer's demand from M6 – preload ≥ 50 N against lift-off – costs almost nothing in
   fatigue.

**Hand check (L1 60 mm):** F1 = 2.9228 · (74 − 60) = 40.9 N ✓.

### 5.3 Relaxation and creep

Under constant length a spring loses force with time (**relaxation**); under constant force it gets shorter
(**creep**). Both come from slow micro-plastic flow at the highly stressed coil inside and grow strongly with
temperature and stress. Spring makers give relaxation as the force loss in % after 48 h at a temperature, over
the stress ratio τ/R_m (uncorrected stress at L2). The add-on contains a small table for VDSiCr-type wire with
factors for the other wires (typical values – check the maker's relaxation curves):

```python
RELAX = {   # force loss % after 48 h, VDSiCr type oil-tempered wire, vs temperature (rows) and tau/Rm (columns 0.3 / 0.4 / 0.5) - check maker data
    20: (0.5, 1.0, 2.0), 80: (1.5, 3.0, 5.0), 120: (3.0, 5.5, 9.0), 160: (5.0, 9.0, 14.0)}
RELAX_FACTOR = {"EN 10270-1 DH (patented, cold drawn)": 1.8, "EN 10270-2 VDSiCr (oil tempered, valve)": 1.0,
                "EN 10270-3 1.4310 (stainless)": 1.4}

def relaxation(P, T_C):
    """Bilinear interpolation of the relaxation table at the stress of L2 (uncorrected tau / Rm)."""
    F = forces(P)
    t2, _ = stress(P, F["F2"])
    r = t2 / Rm_min(P)
    ...
    loss = (va + (vb - va) * (T - Ta) / (Tb - Ta)) * RELAX_FACTOR[P["material"]]
    return {"T": T_C, "tau_over_Rm": r, "loss_pct": loss, "F2_after": F["F2"] * (1 - loss / 100), "F1_after": F["F1"] * (1 - loss / 100)}
```

`python spring.py ch56`

```
## 5.3 Relaxation (force loss after 48 h, check)
   20 C: tau/Rm 0.235 -> loss 0.50 %, F1 55.5 -> 55.3 N, F2 114.0 -> 113.4 N
   80 C: tau/Rm 0.235 -> loss 1.50 %, F1 55.5 -> 54.7 N, F2 114.0 -> 112.3 N
  120 C: tau/Rm 0.235 -> loss 3.00 %, F1 55.5 -> 53.9 N, F2 114.0 -> 110.6 N
  160 C: tau/Rm 0.235 -> loss 5.00 %, F1 55.5 -> 52.8 N, F2 114.0 -> 108.3 N
  120 C, EN 10270-1 DH (patented, cold drawn)       loss 5.40 %
  120 C, EN 10270-2 VDSiCr (oil tempered, valve)    loss 3.00 %
  120 C, EN 10270-3 1.4310 (stainless)              loss 4.20 %
```

**Hand check:** τ2 = 464.4 MPa, τ2/R_m = 464.4/1978 = **0.235**. This is below the first table column (0.3); the
function clamps to 0.3, i.e. it uses the 0.3 values – a conservative reading.

What it means for the cam follower: the preload must stay above the M6 requirement (≥ 50 N against lift-off with
margin) for the whole life. At 80 °C (machine housing near a motor) the preload falls to 54.7 N after 48 h; the
long-term loss over years is typically 1.5–2 times the 48 h value (check), i.e. about 53 N – still enough. A DH
spring would lose almost twice as much. **Rule:** for working temperatures above ~80 °C use oil-tempered SiCr or
SiCrV wire (or 1.4568 / 1.7102 for higher temperatures); and design the preload with the relaxed value, not with
the value on the drawing.

### 5.4 Dynamics: natural frequency, surge and impact

#### 5.4.1 The spring as a continuum – derivation of f_e

The coils are not massless. Look at a thin slice of the spring of axial length dx at position x. Its mass is
dm = (m/L)·dx, where m is the active mass and L the active length. The slice is pulled by the force difference
of its neighbours; the spring force at x is F = (R·L)·∂u/∂x (a short piece of length dx has the rate R·L/dx).
Newton's law gives the **wave equation**

(m/L)·∂²u/∂t² = R·L·∂²u/∂x²   →   ∂²u/∂t² = c²·∂²u/∂x²,   c = L·√(R/m).

A disturbance at one end travels along the spring with the axial wave speed c. For a spring held at both ends
(u = 0 at x = 0 and x = L) the standing waves are u = sin(jπx/L)·sin(ω_j t) with ω_j = jπc/L. The first natural
frequency is

f_e = c/(2L) = ½·√(R/m).

Insert R = G d⁴/(8 D³ n) and m = ρ·(π d²/4)·(π D n):

R/m = G d⁴/(8 D³ n) · 4/(ρ π² d² D n) = G d²/(2 ρ π² D⁴ n²)   →   **f_e = d/(2π n D²)·√(G/(2ρ))**.

```python
def natural_frequency(P):
    """First natural frequency of the spring fixed at both ends: f_e = d/(2 pi n D^2) sqrt(G/(2 rho)) (SI units)."""
    mat = MATERIALS[P["material"]]
    d, D = P["d"] / 1000.0, P["D"] / 1000.0
    G, rho = mat["G"] * 1e6, mat["rho"] * 1e9
    fe = d / (2 * math.pi * P["n"] * D ** 2) * math.sqrt(G / (2 * rho))
    ratio = fe / P["f_exc"]
    return {"fe": fe, "ratio": ratio, "resonant_harmonic": ratio <= P["harmonic_max"], "fe_req": P["harmonic_max"] * P["f_exc"]}
```

The self-test checks exactly the step above: `f_e = ½√(R/m_active)` gives the same value as the closed formula
(168.5 Hz for the default spring, `python spring.py selftest`). The add-on adds the wave travel time and speed and the masses:

```python
def wave_data(P):
    """Natural frequency and the travel time of the surge wave: f_e = 1/(2 t_wave) for a spring fixed at both ends."""
    fr = natural_frequency(P)
    mat = MATERIALS[P["material"]]
    m_act = mat["rho"] * math.pi ** 2 * P["d"] ** 2 * P["D"] * P["n"] / 4
    La = P["L1"] - 2 * P["d"]                           # active length approx at installation
    return {"fe": fr["fe"], "t_wave_ms": 1000 / (2 * fr["fe"]), "c_axial_m_s": 2 * fr["fe"] * La / 1000,
            "m_active_g": m_act * 1000, "m_eff_g": m_act * 1000 / 3}
```

```
## 5.4 Dynamics
  f_e 168.5 Hz, wave travel time 2.97 ms, axial wave speed 16.9 m/s, active mass 25.7 g, effective mass (1/3) 8.6 g
```

**Hand check.** √(G/2ρ) = √(79.5·10⁹/(2 · 7850)) = √(5.064·10⁶) = 2250 m/s.
d/(2π n D²) = 0.0025/(2π · 8.5 · 0.025²) = 0.0025/0.03338 = 0.0749 1/m → f_e = 0.0749 · 2250 = **168.5 Hz** ✓.
m = 7850 · π² · 0.0025² · 0.025 · 8.5/4 = **0.0257 kg** ✓. Wave time 1/(2 · 168.5) = **2.97 ms**: a disturbance needs
3 ms to run from the cam end to the frame and back – the cam rise lasts 1/3 of 0.2 s = 67 ms, so 22 wave trips fit
into one rise. The axial wave speed (16.9 m/s) is far below the speed of sound in steel – it is the speed of the
"coil wave", the one you can see in a slow-motion video of a valve spring.

**Effective mass (1/3 rule).** If the spring moves slowly compared with f_e, the velocity along the spring grows
linearly from 0 (fixed end) to v (moving end). The kinetic energy is ∫½(m/L)(v x/L)² dx = ½·(m/3)·v². So one third
of the active mass belongs to the follower: 8.6 g here. M6 used a reduced follower mass of 2.5 kg "incl. 1/3 spring"
– the spring part is negligible for this pusher, but for a light valve train (follower 50 g) it is not.

#### 5.4.2 Surge – a multi-mass model driven by the cam

**Why surge matters.** A cam motion is periodic with the cam frequency f_cam = n/60 (5 Hz at 300 rpm). Its Fourier
series contains harmonics k·f_cam; the size of the harmonics falls with k, but it falls slowly for laws with jumps
of the jerk (M6 chapter 7). If one harmonic is close to f_e, the coils resonate: the coil force at the ends is no
longer R·s(t), the spring becomes a source of vibration, the stress swing grows, and the follower can lose contact
(M6 lift-off) even though the static spring force looks sufficient. Rule of thumb: **f_e ≥ 10…15 × f_cam** for
cycloidal / modified sine laws (check M6 for the harmonic content), and much more for harmonic / polynomial laws
with large high harmonics.

The core program uses this rule (`harmonic_max` = 12, f_e ≥ 60 Hz). The add-on checks it physically: the spring
is cut into N = 10 equal segments (rate N·R each, mass m/N in each of the 9 inner nodes), node 0 moves with the M6
cam lift s(θ = ω t) computed by `cam.motion()`, node N is the frame. A little material damping (ζ = 0.02 per
segment, check – steel springs have ζ ≈ 0.005–0.03) keeps the start-up transient small; the result is taken in the
third revolution. The integration is RK4 with a step 40 times smaller than the period of the stiffest chain mode.

```python
def surge_sim(P, n_rpm=300.0, N=10, zeta=0.02, revs=3, cam_P=None):
    """Lumped multi-mass spring (N segments) driven at node 0 by the M6 cam lift, fixed at node N.
    Returns the maximum dynamic force at the fixed end compared with the static force R*s(t), last revolution."""
    import cam                                          # M6 program (sibling tool)
    CP = cam_P or dict(cam.DEFAULT, n_rpm=n_rpm)
    mat = MATERIALS[P["material"]]
    m_act = mat["rho"] * math.pi ** 2 * P["d"] ** 2 * P["D"] * P["n"] / 4      # kg
    R = rate(P) * 1000.0                                # N/m
    k = R * N
    m = m_act / N
    c = 2 * zeta * math.sqrt(k * m)
    w = 2 * math.pi * n_rpm / 60.0
    T_rev = 2 * math.pi / w
    f_top = 2 * math.sqrt(k / m) / (2 * math.pi)        # highest chain frequency
    dt = min(1.0 / (40 * f_top), T_rev / 2000)
    ...
    def acc(t, u, v):
        x0, v0 = base(t), base_v(t)
        a = []
        for i in range(N - 1):
            xl = x0 if i == 0 else u[i - 1]
            ...
            a.append((k * (xl - u[i]) - k * (u[i] - xr) + c * (vl - v[i]) - c * (v[i] - vr)) / m)
        return a
    ...                                                 # RK4 steps
        if t >= t_last:
            Fd = k * u[-1]                              # force of the last segment on the frame
            Fs = R * base(t)
            Fmax_dev = max(Fmax_dev, abs(Fd - Fs))
```

Equation of motion of inner node i (displacement u_i, neighbours u_{i−1}, u_{i+1}):
m/N · ü_i = N R (u_{i−1} − u_i) − N R (u_i − u_{i+1}) + c (u̇_{i−1} − u̇_i) − c (u̇_i − u̇_{i+1}).
The chain of 9 masses has 9 natural frequencies; the lowest one is 2·(N/π)·sin(π/(2N))·f_e ≈ 0.996·f_e,
so 10 segments reproduce the first surge mode within 0.4 %.

`python spring.py ch56`

```
  surge, default spring (f_e 169 Hz = 33.7 x 5 Hz): F_stat,max 58.5 N, F_dyn,max 58.5 N, max deviation 0.12 N (0.2 %), 25750 steps dt 23.3 us
  surge, soft long spring d 3.8 n 44 (f_e 49 Hz = 9.9 x 5 Hz): F_stat,max 60.3 N, F_dyn,max 63.0 N, deviation 3.2 N (5.4 %)
  same soft spring at 400 rpm (ratio 7.4): F_dyn,max 62.0 N vs static 60.3 N, deviation 5.1 N (8.5 %)
```

(The forces are the stroke part R·s of the spring force; the preload F1 is added on top.)

* **Default spring (f_e/f_cam = 33.7):** the coil force follows R·s(t) within 0.12 N (0.2 %). No surge.
  **Hand check:** F_stat,max = R·h = 2.9228 · 20 = **58.5 N** ✓.
* **Soft, long spring from the design table (d 3.8, n 44; same rate, f_e 49 Hz, ratio 9.9):** the deviation rises to
  3.2 N (5.4 %) and the peak force to 63.0 N. This spring was rejected by the core program for surge (ratio < 12)
  and buckling – the simulation confirms the surge rule.
* **The same soft spring at 400 rpm (ratio 7.4):** 8.5 % deviation – surge grows as the speed rises, because lower
  harmonics (with more content) approach f_e.

With the smooth modified-sine / cycloidal cam of M6 the effect stays moderate even at ratio 7.4. With a cam that
has acceleration jumps (simple harmonic between dwells), the high harmonics are much stronger and the same spring
would show tens of percent – which is why the M6 law choice and the spring design belong together. Valve springs
in engines use progressive pitch, conical springs or nested double springs to "detune" surge.

#### 5.4.3 Impact

When the end of a spring is suddenly given a velocity v (a follower hitting the cam after lift-off, a valve
closing, a spring that is released from solid), a stress wave runs into the coils. Its size follows from the wave
equation of the wire in torsion: τ = v·√(2 G ρ) (uncorrected; for steel ≈ 35 MPa per m/s, independent of the
spring geometry – check, EN 13906-1 gives the same relation for the impact velocity limit).

```python
def impact_limit(P):
    """Stress of a velocity step v at the coil end: tau = v sqrt(2 G rho) (k = 1); allowed v from tau_zul - tau(F2)."""
    mat = MATERIALS[P["material"]]
    Z = math.sqrt(2 * mat["G"] * 1e6 * mat["rho"] * 1e9) / 1e6      # MPa per m/s
    t2, _ = stress(P, forces(P)["F2"])
    v_max = (tau_zul(P) - t2) / Z
    return {"MPa_per_m_s": Z, "v_allow": v_max, "tau_at_cam_vmax": Z * 0.600}
```

```
  impact: 35.3 MPa per m/s; stress from the cam v_max 0.6 m/s 21.2 MPa; allowed velocity step 14.8 m/s
```

**Hand check:** √(2 · 79.5·10⁹ · 7850) = √(1.248·10¹⁵) = 3.53·10⁷ Pa·s/m = **35.3 MPa per m/s** ✓.
Allowed step (989 − 464)/35.3 = **14.8 m/s**. Even the full follower speed of M6 (0.6 m/s) would add only 21 MPa –
impact is no danger for a cam spring. It becomes the limit for springs that are released suddenly (switch gear,
safety devices, catapult mechanisms), where v reaches 5–20 m/s.

---

## 6. Design from requirements; tension and torsion springs

### 6.1 Design from requirements in depth

#### 6.1.1 The design problem

The user gives what the machine needs, not the spring:

| Requirement | Default (M6 cam follower) |
|---|---|
| Force at the installed position F1 | 55 N (lift-off margin of M6) |
| Force at full stroke F2 | 115 N |
| Stroke | 20 mm (cam lift) |
| Mean diameter D (space, guide) | 25 mm, outer diameter ≤ 30 mm |
| Dynamic duty | 5 Hz, harmonics up to 12 |

From this follows the required rate R = (F2 − F1)/stroke = 60/20 = **3.0 N/mm**. Any pair (d, n) with
G d⁴/(8 D³ n) = 3 N/mm gives the right forces – there is a whole family of springs. The design task is to pick the
best member of the family. For each preferred wire diameter the core program computes

1. n from the rate, rounded to half coils (fewer than 3 active coils are rejected – the rate of such a spring
   depends too much on the end coils);
2. the preload deflection s1 = F1/R;
3. L2 = L_n,min + 0.5 mm (the shortest allowed working length, so the spring is as short as possible);
4. L0 = L2 + stroke + s1, L1 = L0 − s1;
5. all checks of `summary()`.

```python
def design_from_requirements(P):
    """For each preferred wire diameter: n from the required rate, L0 from F1, lengths, all checks; return all candidates
    and the lightest one that passes."""
    rq = P["req"]
    R_req = (rq["F2"] - rq["F1"]) / rq["stroke"]
    G = MATERIALS[P["material"]]["G"]
    cands = []
    for d in WIRE_D:
        D = rq["D"]
        w = D / d
        if not 4 <= w <= 20:
            continue
        n = G * d ** 4 / (8 * D ** 3 * R_req)
        n = round(n * 2) / 2                              # half coils
        if n < 3:                                         # fewer than 3 active coils: rate and force not reliable
            continue
        Q = dict(P, d=d, D=D, n=n)
        R = rate(Q)
        s1 = rq["F1"] / R
        g = geometry(Q)
        L2 = g["Ln_min"] + 0.5                             # use the full allowed range, small margin
        L0 = L2 + s1 + rq["stroke"]
        Q.update(L0=L0, L1=L0 - s1, L2=L2)
        S = summary(Q)
        cands.append({...})
    good = [c for c in cands if c["ok"]]
    return {"R_req": R_req, "candidates": cands, "best": min(good, key=lambda c: c["mass_g"]) if good else None}
```

`python spring.py examples` (design part of the report)

```
## Design from requirements (F1 55 N, F2 115 N, stroke 20 mm, D 25 mm -> R 3.00 N/mm)
- d 2.0, n  3.5, R 2.91, L0 53.9, L2 15.0, 11 g, S_static 1.11, S_fat 0.77, f_e 327 Hz fails: fatigue
- d 2.2, n  5.0, R 2.98, L0 59.2, L2 20.7, 16 g, S_static 1.45, S_fat 1.20, f_e 252 Hz OK
- d 2.5, n  8.5, R 2.92, L0 73.5, L2 34.7, 32 g, S_static 2.14, S_fat 2.06, f_e 169 Hz OK
- d 2.8, n 13.0, R 3.01, L0 92.8, L2 54.5, 57 g, S_static 2.94, S_fat 3.02, f_e 123 Hz OK
- d 3.0, n 17.0, R 3.03, L0 111.3, L2 73.1, 83 g, S_static 3.59, S_fat 3.78, f_e 101 Hz OK
- d 3.2, n 22.0, R 3.03, L0 135.7, L2 97.5, 119 g, S_static 4.34, S_fat 4.66, f_e 83 Hz OK
- d 3.5, n 32.0, R 2.98, L0 187.6, L2 149.2, 202 g, S_static 5.70, S_fat 6.27, f_e 63 Hz OK
- d 3.8, n 44.0, R 3.01, L0 254.9, L2 216.7, 322 g, S_static 7.23, S_fat 7.95, f_e 49 Hz fails: buckling, surge
- d 4.0, n 54.5, R 2.99, L0 316.8, L2 278.4, 438 g, S_static 8.44, S_fat 9.34, f_e 42 Hz fails: buckling, surge
...
- lightest passing: d 2.2 mm, n 5.0, L0 59.2 mm
```

**Hand check (d 2.5):** n = 79 500 · 2.5⁴/(8 · 25³ · 3.0) = 79 500 · 39.06/375 000 = 8.28 → rounded to 8.5 →
R = 79 500 · 39.06/(8 · 15 625 · 8.5) = **2.92 N/mm** ✓; s1 = 55/2.92 = 18.8 mm; L2 = 34.22 + 0.5 = 34.7 mm;
L0 = 34.7 + 20 + 18.8 = **73.5 mm** ✓.

#### 6.1.2 Why n grows with d⁴ – the trade-off

With D fixed, n ∝ d⁴: a 20 % thicker wire needs twice the coils. Everything else follows:

| Grows with d | Falls with d |
|---|---|
| number of coils, solid length, free length, mass (∝ d⁶ at fixed rate and D!) | stress (∝ 1/d³) → static and fatigue safety rise |
| buckling risk (L0/D) | natural frequency (∝ d/n ∝ 1/d³) → surge risk |

So there is a **window**: thin wires fail fatigue, thick wires fail surge and buckling. The add-on lists only the
passing candidates:

```python
def tradeoff(P):
    """Mass, natural frequency, length and safety of the passing candidates of the core design table."""
    dz = design_from_requirements(P)
    return [c for c in dz["candidates"] if c["ok"]]
```

```
## 6.1 Design: passing candidates of the core table (trade-off)
  d 2.2 n  5.0: mass  16.4 g, L0   59.2 mm, f_e 252 Hz, S_static 1.45, S_fat 1.20
  d 2.5 n  8.5: mass  31.8 g, L0   73.5 mm, f_e 169 Hz, S_static 2.14, S_fat 2.06
  d 2.8 n 13.0: mass  56.9 g, L0   92.8 mm, f_e 123 Hz, S_static 2.94, S_fat 3.02
  d 3.0 n 17.0: mass  82.8 g, L0  111.3 mm, f_e 101 Hz, S_static 3.59, S_fat 3.78
  d 3.2 n 22.0: mass 119.0 g, L0  135.7 mm, f_e  83 Hz, S_static 4.34, S_fat 4.66
  d 3.5 n 32.0: mass 201.7 g, L0  187.6 mm, f_e  63 Hz, S_static 5.70, S_fat 6.27
```

**Choice for the cam follower: d 2.5, n 8.5 (the default).** The lightest spring (d 2.2) is half as heavy, but
S_fat 1.20 leaves almost no margin for preload tolerance, surface defects or a later speed increase. d 2.5 doubles
the fatigue safety, is solid-safe, still has f_e/f_cam = 34 and fits into 74 mm. Thicker wires only add length
and mass and approach the surge limit. This "first passing candidate with clear margin" is the usual engineering
choice; pure minimum mass is the right criterion only for vehicles and aerospace.

#### 6.1.3 D as a second variable – 2-D search

The mean diameter was fixed at 25 mm. Allowing D to vary is often the bigger lever (stress ∝ D, rate ∝ 1/D³):

```python
def design_2d(P, Ds=(17.5, 20.0, 22.5, 25.0, 27.5)):
    """Design table for several mean diameters D: lightest passing (d, n) for each D and the overall best."""
    rows = []
    for D in Ds:
        Q = dict(P, req=dict(P["req"], D=D))
        dz = design_from_requirements(Q)
        b = dz["best"]
        rows.append((D, b))
    good = [(D, b) for D, b in rows if b]
    best = min(good, key=lambda r: r[1]["mass_g"]) if good else None
    return {"rows": rows, "best": best}
```

```
  2-D search over D (Da_max 30 mm):
    D 17.5: d 2.0 n 10.0, 16.3 g, L0 69.5, f_e 234 Hz, S_fat 1.29
    D 20.0: d 2.2 n 9.5, 21.6 g, L0 70.8, f_e 207 Hz, S_fat 1.56
    D 22.5: d 2.2 n 7.0, 19.0 g, L0 65.1, f_e 222 Hz, S_fat 1.41
    D 25.0: d 2.2 n 5.0, 16.4 g, L0 59.2, f_e 252 Hz, S_fat 1.20
    D 27.5: d 2.5 n 6.0, 26.6 g, L0 64.5, f_e 197 Hz, S_fat 1.73
  lightest overall: D 17.5, d 2.0, n 10.0, 16.3 g
```

The minimum spring mass hardly changes with D (16.3–21.6 g), because for a given energy W = ½R(s2² − s1²) the
spring mass at a fixed stress level is nearly constant (*m ≈ 4 ρ G W / (k² τ²)·const* – the stored energy per
volume of a torsion bar is τ²/(4G)). The jumps in the table come from the discrete wire diameters and half
coils. D is therefore chosen by the space (guide pin inside, bore outside, D_a ≤ 30 mm) and by buckling
(L0/D), not by mass. The self-test verifies the energy relation W = τ² V/(4G) for the default spring.

**Optimisation note.** The search over the preferred wire list and half coils is an exhaustive search of a small
discrete space (19 × 5 points) – faster and more reliable than a continuous optimiser (M1 chapter on optimisation:
for discrete design variables, enumerate when the space is small).

### 6.2 Tension springs

A tension (extension) spring is coiled with the coils touching and an **initial tension** F0: the wire is twisted
during coiling so that the coils press against each other. The spring does not extend until the force exceeds F0.

| Item | Formula |
|---|---|
| Initial tension | F0 = π d³ τ0/(8 D), τ0 from coiling (≈ 40–120 MPa, falls with w – check EN 13906-2 / maker) |
| Rate | R = G d⁴/(8 D³ n) (same as compression) |
| Extension at F | s = (F − F0)/R |
| Body stress | τ_k = k·8 F D/(π d³) |
| Hook bending (full loop, section A) | σ_A = F·[16 D K_A/(π d³) + 4/(π d²)], K_A = (4C1² − C1 − 1)/(4 C1 (C1 − 1)), C1 = 2r1/d |
| Hook torsion (transition, section B) | τ_B = 8 F D K_B/(π d³), K_B = (4C2 − 1)/(4C2 − 4), C2 = 2r2/d |
| Allowed (check) | τ ≤ 0.45 R_m (lower than compression: no presetting, hooks), σ_A ≤ 0.70 R_m |

```python
TENSION = {"d": 2.0, "D": 16.0, "n": 20.0, "tau0": 60.0, "F": 100.0, "r2_over_d": 2.0,
           "material": "EN 10270-1 DH (patented, cold drawn)"}

def tension_spring(T=None):
    """Helical tension spring with full-loop (German) hooks: initial tension, rate, body and hook stresses."""
    T = dict(TENSION, **(T or {}))
    mat = MATERIALS[T["material"]]
    d, D, n = T["d"], T["D"], T["n"]
    w = D / d
    F0 = math.pi * d ** 3 * T["tau0"] / (8 * D)          # initial tension from the coiling stress tau0
    R = mat["G"] * d ** 4 / (8 * D ** 3 * n)
    s = (T["F"] - F0) / R if T["F"] > F0 else 0.0
    tau_body = berg(w) * 8 * T["F"] * D / (math.pi * d ** 3)
    C1 = w                                             # hook bend radius r1 = D/2
    KA = (4 * C1 ** 2 - C1 - 1) / (4 * C1 * (C1 - 1))
    sigA = T["F"] * (16 * D / (math.pi * d ** 3) * KA + 4 / (math.pi * d ** 2))      # bending + tension in the hook
    C2 = 2 * T["r2_over_d"]
    KB = (4 * C2 - 1) / (4 * C2 - 4)
    tauB = 8 * T["F"] * D / (math.pi * d ** 3) * KB      # torsion at the hook transition
    Rm = mat["A"] * d ** (-mat["m"])
    return {...}
```

`python spring.py ch56`

```
## 6.2 Tension spring (d 2, D 16, n 20, tau0 60 MPa, F 100 N, DH wire)
  w 8.0, initial tension F0 11.8 N, rate 1.990 N/mm, extension 44.3 mm; body tau 597 (allow 892), hook sigma 1155 (allow 1387), hook tau 637 MPa -> OK
  F 160 N: body tau 955, hook sigma 1848 (allow 1387) -> NOT OK
```

**Hand check.** F0 = π · 2³ · 60/(8 · 16) = 1508/128 = **11.8 N**. R = 81 500 · 16/(8 · 4096 · 20) = **1.990 N/mm**.
s = (100 − 11.8)/1.99 = **44.3 mm**. k(8) = 8.5/7.25 = 1.1724; 8 · 100 · 16/(π · 8) = 509.3 MPa → τ_body = **597 MPa**.
K_A (C1 = 8) = (256 − 9)/(4 · 8 · 7) = 247/224 = 1.1027; σ_A = 100 · (16 · 16 · 1.1027/(π · 8) + 4/(π · 4)) =
100 · (11.23 + 0.32) = **1155 MPa**. K_B (C2 = 4) = 15/12 = 1.25 → τ_B = 509.3 · 1.25 = **637 MPa**. R_m(DH, 2 mm) = 1982 MPa:
allowed 892 / 1387 MPa ✓.

**The hook is the weak point.** At 160 N the body stress (955 MPa) is 7 % above the allowed 892 MPa, but the
hook bending stress (1848 MPa) is 33 % above its limit of 1387 MPa. In practice tension springs break at the
hook, not in the body; the hook stress is about twice the body stress. Remedies: larger bend radius r2 (smaller
K_B), reduced end coils, screwed-in end plugs, or – best for dynamic duty – use a **compression spring with a
draw-bar** instead of a tension spring (no hooks, and it fails safe: a broken compression spring still carries load).

### 6.3 Torsion springs

A helical torsion spring is loaded by a moment M about the coil axis through its legs. The wire is bent (not
twisted): each coil carries the bending moment M.

| Item | Formula |
|---|---|
| Angular rate | R_M = M/φ = E d⁴/(64 D n) (N mm per rad; leg bending neglected) |
| Bending stress | σ = q · 32 M/(π d³), q = (w + 0.07)/(w − 0.75) (inside-of-coil correction) |
| Diameter under load (winding up) | D_φ = D·n/(n + φ/(2π)) |
| Mandrel | inner diameter under load D_φ − d must stay ≈ 10 % larger than the guide mandrel |
| Allowed (check) | σ ≤ 0.70 R_m static (EN 13906-3 style) |

**Derivation of the rate.** Each coil is a curved beam of length π D under constant moment M; its rotation is
θ = M·π D/(E I), I = π d⁴/64. n coils in series: φ = n π D M/(E π d⁴/64) = 64 M D n/(E d⁴) → R_M = E d⁴/(64 D n).

**Why D gets smaller.** Winding the spring up adds φ/(2π) turns to the coil while the wire length πDn stays
the same: D_φ·(n + φ/2π) = D·n. A spring that is wound up on a mandrel can therefore jam on it – a frequent field
failure.

```python
TORSION = {"d": 2.0, "D": 20.0, "n": 6.0, "M": 800.0, "mandrel": 15.0, "material": "EN 10270-1 DH (patented, cold drawn)"}

def torsion_spring(T=None):
    """Helical torsion spring: angular rate, bending stress with q, coil-diameter reduction, mandrel clearance."""
    T = dict(TORSION, **(T or {}))
    mat = MATERIALS[T["material"]]
    d, D, n, M = T["d"], T["D"], T["n"], T["M"]
    w = D / d
    RM = mat["E"] * d ** 4 / (64 * D * n)              # N mm per rad
    phi = M / RM
    q = (w + 0.07) / (w - 0.75)
    sig = q * 32 * M / (math.pi * d ** 3)
    D_loaded = D * n / (n + phi / (2 * math.pi))
    Di_loaded = D_loaded - d
    Rm = mat["A"] * d ** (-mat["m"])
    return {...}
```

`python spring.py ch56`

```
## 6.3 Torsion spring (d 2, D 20, n 6, M 800 N mm, mandrel 15 mm)
  w 10.0, rate 429.2 N mm/rad = 7.49 N mm/deg, angle 106.8 deg, q 1.0886, sigma 1109 MPa (allow 1387) -> OK
  loaded mean diameter 19.06 mm, inner diameter 17.06 mm -> clearance to mandrel 13.7 %
  M 1500 N mm: angle 200.3 deg, sigma 2079 MPa -> NOT OK, inner diameter 16.30 mm, clearance 8.7 %
```

**Hand check.** R_M = 206 000 · 16/(64 · 20 · 6) = 3 296 000/7680 = **429.2 N mm/rad** (× π/180 = 7.49 N mm/°).
φ = 800/429.2 = 1.864 rad = **106.8°**. q = 10.07/9.25 = 1.0886; σ = 1.0886 · 32 · 800/(π · 8) = 1.0886 · 1018.6 =
**1109 MPa** ≤ 0.7 · 1982 = 1387 MPa ✓. D_φ = 20 · 6/(6 + 1.864/6.283) = 120/6.297 = **19.06 mm**; inner 17.06 mm,
clearance (17.06 − 15)/15 = **13.7 %** ✓.

At 1500 N mm the stress (2079 MPa) is far too high and the clearance drops below 10 %: a torsion spring must be
designed with stress **and** diameter change together. Always load torsion springs in the **winding-up**
direction – the residual stresses from coiling then reduce the stress at the inside of the coil; unwinding a
torsion spring is allowed only at low stress.

### 6.4 Summary of chapters 5–6

| Check | Default spring | Limit | Function |
|---|---|---|---|
| Static stress at L2 / solid | 464 / 569 MPa | 989 MPa | `static_check()`, `solid_safe_check()` |
| Fatigue (stroke) | S_fat 2.06, endurance | ≥ 1.1 | `fatigue()`, `haigh_lines()`, `life_estimate()` |
| Preload / length tolerance | L1 −0.8 / +5 mm | L2 ≥ L_n,min | `fatigue_map()` |
| Relaxation at 80 °C | 1.5 % (F1 54.7 N) | F1 ≥ 50 N (M6) | `relaxation()` |
| Natural frequency | 168.5 Hz = 33.7 × f_cam | ≥ 12 × f_cam | `natural_frequency()`, `wave_data()` |
| Surge (simulation) | 0.2 % force deviation | small | `surge_sim()` |
| Impact | 14.8 m/s allowed | > 0.6 m/s | `impact_limit()` |
| Design choice | d 2.5, n 8.5 among 6 passing candidates | – | `design_from_requirements()`, `tradeoff()`, `design_2d()` |


---

## 7. Manufacturing of springs (wire, coiling, stress relief, end grinding, shot peening, setting, coating, tolerances EN 15800, inspection, drawing data)

Chapters 3–6 sized the spring: wire diameter, coil diameter, coils and lengths. This chapter covers how a spring maker
turns that design into thousands of springs that all have the same force. A spring is a cheap part, about 0.25 € here,
but it fails in one of two ways. It breaks by fatigue, starting at a surface defect, or it slowly loses force
(relaxation). Both failures are decided in manufacturing, not in the calculation. This is why the drawing must say
more than "d, D, n, L0".

All results in this chapter come from the add-on functions merged into `spring.py`:

```
python spring.py ch78
```

The add-on uses the core functions `Rm_min()`, `rate()`, `stress()`, `geometry()`, `forces()`, `fatigue()` and
`design_from_requirements()` without changing them.

### 7.1 The process chain

A cold-coiled helical compression spring with d ≤ about 16 mm goes through these steps:

```
python spring.py ch78          (section 7.1)
```
```
## 7.1 Process chain
  wire (EN 10270)            patented + cold drawn (DH) or oil hardened + tempered (VDSiCr); surface free of seams | Rm from the wire certificate
  CNC coiling                wire fed over rolls, bent at the coiling point, pitch tool sets the pitch, cut-off knife | feed 30-120 m/min
  stress relief (tempering)  removes coiling residual stress, raises elastic limit, stabilises D | VDSiCr ~420 C 30 min, DH ~280 C 30 min (check)
  end grinding               closed ends ground flat and square, double-disc grinder, several passes | perpendicularity e1
  shot peening               compressive residual stress in the surface, raises fatigue strength 20-30 % | Almen 0.3-0.5 mmA, coverage >= 200 %
  low-temperature tempering  after peening, stabilises residual stress (valve springs) | ~220 C 30 min (check)
  setting (presetting)       compress to solid once or several times: L0 drops by the set, relaxation in service falls | cold or hot setting
  coating                    corrosion protection: oil, phosphate + oil, powder coat, zinc flake (no electroplating for Rm > 1000) | -
  100 % test                 force at L1 / L2, sorting into classes, L0, marking | load tester
```

The table is stored as `PROCESS_CHAIN_SPRING` in the program. Each step in short:

**Wire.** The strength of a cold-coiled spring comes from the wire, because the spring is not hardened after coiling.
That is why `Rm_min(d)` in the core (chapter 2) depends on the wire diameter: thin wire is drawn more and is stronger.
EN 10270 offers three wire families:
- **Patented and cold-drawn wire (EN 10270-1, SL/SM/SH/DM/DH).** The rod is heated, transformed to fine pearlite in
  a lead or salt bath ("patenting"), then drawn through dies. The strength comes from the deformation. It is
  cheaper, its fatigue properties are moderate, and it is used up to about 80 °C.
- **Oil-hardened and tempered wire (EN 10270-2, FD/TD/VD; VDSiCr = valve grade, Si-Cr alloyed).** The wire is drawn,
  then hardened in oil and tempered as a continuous wire. Valve-spring quality (VD) means a guaranteed surface: depth
  of surface defects ≤ 0.5 % of d, checked by eddy current, and a limited decarburised layer. It is the right choice
  for cam and valve springs, which see about 10⁷–10⁹ cycles.
- **Stainless wire (EN 10270-3, 1.4310).** Corrosion resistant. It is weaker in fatigue, and its G and E values are
  lower (G 70 000 instead of 79 500–81 500 MPa).

**CNC coiling.** Feed rolls push the wire against a coiling point (a hardened pin or roll). The point bends the wire
into a helix, a pitch tool pushes each coil sideways to the programmed pitch, and a cutter cuts the spring off. Modern
coilers change pitch and diameter along the spring under CNC control. That allows dead (closed) end coils and
progressive springs. Coiling is fast: the default spring takes about 1 s (section 7.2).

**Stress relief.** Coiling leaves tensile residual stress on the **inner side** of the coil, exactly where the
operating stress is highest (Bergsträsser factor, chapter 3). A short tempering (table `STRESS_RELIEF`) removes most of
it, raises the elastic limit and fixes the diameter. Leaving it out is a classic cause of early relaxation.

**End grinding** makes the end faces flat and square to the axis. Then the spring stands straight, the force acts
centrally, and the number of active coils is defined. It is done on double-disc grinders with the springs in a
rotating carrier, in several passes.

**Shot peening** blasts small steel shot at the surface. The surface layer is plastically stretched, and the core
pushes it back into **compressive residual stress** of about 500–1000 MPa to a depth of about 0.1–0.3 mm. Fatigue cracks
start at the surface and need tension to grow, so the compressive layer raises the fatigue strength (section 7.4).
Peening is controlled by:
- **Almen intensity:** the arc height of a standard steel strip peened with the same settings, for example
  0.3–0.5 mmA;
- **Coverage:** the share of the surface that has been hit, typically ≥ 200 %.

**Setting (presetting)** compresses the spring once or several times to solid. If the stress at solid is above the
torsional yield stress, the spring takes a permanent set: L0 becomes shorter. The spring therefore has to be coiled
longer by the set amount (section 7.3). The benefit is that the yielded surface layer now carries residual stress
opposite to the working stress, so the spring relaxes much less in service.

### 7.2 Coiling: spring-back, coiling diameter, wire length and cycle time

When the coiling point releases the wire, the elastic part of the bend springs back and the coil opens up. The coiler
must therefore bend to a **smaller** diameter than the finished D. For a wire that is bent fully plastically, the
change of curvature on unloading equals the elastic curvature of the plastic moment:

$$\frac{1}{R_{tool}}-\frac{1}{R}=\frac{M_p}{E\,I}=\frac{\sigma_y\,d^3/6}{E\,\pi d^4/64}=\frac{64}{6\pi}\cdot\frac{\sigma_y}{E\,d}=3.395\,\frac{\sigma_y}{E\,d}$$

Here R = D/2 is the finished coil radius, σ_y the yield stress of the wire (taken as 0.85·R_m, check), E Young's
modulus, and M_p = σ_y d³/6 the plastic moment of a round wire.

```python
def coiling_tool_diameter(P, yield_ratio=0.85):
    """Spring-back of a fully plastic bend: 1/R_tool - 1/R = M_p/(E I) = 3.395 sigma_y/(E d), sigma_y = yield_ratio x Rm (check)."""
    mat = MATERIALS[P["material"]]
    sy = yield_ratio * Rm_min(P)
    dk = 3.395 * sy / (mat["E"] * P["d"])
    R = P["D"] / 2
    R_tool = 1 / (1 / R + dk)
    return {"sigma_y": sy, "delta_kappa": dk, "D_tool": 2 * R_tool, "springback_pct": 100 * (P["D"] - 2 * R_tool) / P["D"]}
```

The wire length is the length of the helix: for each coil, a right triangle with sides π·D (one turn) and the pitch. The dead
end coils are taken with pitch d. The coiling time is the wire length divided by the feed speed, plus the cut-off.

```python
def wire_length(P):
    g = geometry(P)
    act = P["n"] * math.hypot(math.pi * P["D"], g["pitch"])
    dead = (g["nt"] - P["n"]) * math.hypot(math.pi * P["D"], P["d"])
    return act + dead

def coiling_time(P, v_feed=60.0, t_cut=0.3):
    L = wire_length(P)
    t = L / (v_feed * 1000 / 60) + t_cut
    return {"L_wire": L, "t_s": t, "parts_per_min": 60 / t}
```
```
## 7.2 Coiling: spring-back and tool diameter, wire length, coiling time
  sigma_y 1681 MPa, curvature change 0.01108 1/mm -> coiling diameter 21.96 mm for D 25.0 (spring-back 12.2 %)
  wire length 828 mm, coiling 1.13 s per spring (53 per min) at 60 m/min
  stress relief EN 10270-2 VDSiCr (oil tempered, valve): 420 C, 30 min (check)
```

**Hand check** (default spring d 2.5, D 25, VDSiCr; R_m = 1978 MPa from the core report):
- σ_y = 0.85 · 1978 = 1681 MPa.
- Δκ = 3.395 · 1681 / (206 000 · 2.5) = 0.01108 mm⁻¹.
- 1/R = 1/12.5 = 0.0800 mm⁻¹, so 1/R_tool = 0.0911 mm⁻¹, R_tool = 10.98 mm and D_tool = 21.96 mm.
- The spring opens by 3 mm (12 %).
- Wire length: pitch 8.118 mm (core report), so each active coil is √(78.54² + 8.118²) = 78.96 mm long, and
  8.5 coils give 671.2 mm. Each dead coil is √(78.54² + 2.5²) = 78.58 mm, and 2 give 157.2 mm. In total
  **828 mm**, which at 60 m/min (1000 mm/s) takes 0.83 s, plus 0.3 s cut-off = **1.13 s**.

**What this means in practice.**
1. **D varies with every wire coil.** A spring-back of 12 % means that a 5 % difference in R_m between two wire coils
   changes D by about 0.6 % (0.15 mm here). That is more than half the grade-1 tolerance of D (±0.16 mm, section 7.5).
   CNC coilers therefore measure D or L0 by camera and correct the coiling point on line.
2. **Tempering moves D and L0 again.** Stress relief lets the coil shrink or grow slightly, typically by a few tenths
   of a percent. The first-article process sets the coiling data *after* tempering.
3. **The spring index matters.** A spring with a large index (D/d large) springs back much more. That is one reason
   EN 13906 recommends 4 ≤ w ≤ 20; the core checks this as `w_range`.

### 7.3 Setting (presetting): how much longer must the spring be coiled?

If the working stress is high, the spring is set. It is compressed to solid, the surface yields, and the spring comes
back shorter. A simple model is a **round wire in pure torsion with elastic–perfectly plastic material**:

- τ_el is the elastic-equivalent surface stress at solid (the uncorrected `stress()` of the core at F_c);
- τ_y is the torsional yield stress, taken as 0.55·R_m (check with the wire maker);
- for τ_el > τ_y an elastic core of relative radius ρ = τ_y/τ_el remains;
- the torque of a partly plastic round bar is T = (2π/3)·τ_y·c³·(1 − ρ³/4) (c = d/2);
- on unloading the bar springs back elastically by the equivalent stress τ_T = T·c/J = (4/3)·τ_y·(1 − ρ³/4);
- the twist, and with it the deflection, that stays is (τ_el − τ_T)/τ_el of the deflection at solid s_c.

$$s_{set}=\frac{\tau_{el}-\tfrac{4}{3}\tau_y\left(1-\tfrac{\rho^3}{4}\right)}{\tau_{el}}\;s_c,\qquad \rho=\frac{\tau_y}{\tau_{el}}$$

```python
def set_amount(P, tau_y_ratio=0.55):
    F = forces(P)
    tau_el, _ = stress(P, F["Fc"])
    ty = tau_y_ratio * Rm_min(P)
    if tau_el <= ty:
        return {"tau_el": tau_el, "tau_y": ty, "set_mm": 0.0, "L0_before": P["L0"], "needed": False}
    rho = ty / tau_el
    tT = 4.0 / 3.0 * ty * (1 - rho ** 3 / 4)
    s_set = (tau_el - tT) / tau_el * F["sc"]
    return {"tau_el": tau_el, "tau_y": ty, "rho": rho, "tau_T": tT, "set_mm": s_set, "L0_before": P["L0"] + s_set, "needed": True}
```

The demo uses the three design candidates of chapter 6: d 2.5 / 2.2 / 2.0 for the default requirements. The d 2.0
spring is shown twice more, each time with a free length that a designer might choose "for safety".

```
## 7.3 Setting (presetting) to solid
  d 2.5 n 8.5 L0  73.5: tau at solid 563 MPa, tau_y 1088 MPa -> no set (elastic)
  d 2.2 n 5.0 L0  59.2: tau at solid 780 MPa, tau_y 1095 MPa -> no set (elastic)
  d 2.0 n 3.5 L0  53.9: tau at solid 993 MPa, tau_y 1101 MPa -> no set (elastic)
  d 2.0 n 3.5 L0  70.0: tau at solid 1365 MPa, tau_y 1101 MPa -> set 3.87 mm, coil to L0 73.87 before setting
  d 2.0 n 3.5 L0  90.0: tau at solid 1828 MPa, tau_y 1101 MPa -> set 19.01 mm, coil to L0 109.01 before setting
```

**Hand check** (d 2.0, n 3.5, L0 70):
- R = 79 500·2⁴/(8·25³·3.5) = 2.907 N/mm; nt = 5.5, so L_c = 11.0 mm and s_c = 59.0 mm.
- F_c = 171.5 N, so τ_el = 8·171.5·25/(π·8) = 1365 MPa.
- ρ = 1101/1365 = 0.807, ρ³ = 0.525, so τ_T = 1.333·1101·(1 − 0.131) = 1275 MPa.
- s_set = (1365 − 1275)/1365 · 59.0 = **3.87 mm**.

**Interpretation.**
- The three correctly designed candidates stay elastic at solid, so setting is not needed. It may still be done as a
  quality step (it removes springs with weak wire), but it does not change L0.
- If the free length is too long, the solid stress rises with s_c. The spring then sets by 3.9 mm, or by 19 mm, and
  must be coiled longer by that amount. The coiler data must therefore always come from the *set* length.
- The model uses the *final* L0 for s_c and ignores work hardening and the Bergsträsser stress concentration (the
  inner fibre yields first). It is a first estimate; the real set amount is found on the first article (check).
- Setting is why EN 13906-1 allows a higher static stress for **set** springs. Without setting the spring would lose
  this set slowly in service as relaxation.

### 7.4 Shot peening: what it buys in fatigue

The core models peening with a higher pulsating endurance factor in `MATERIALS`: f_D0 0.30 → 0.38 for VDSiCr. The
`fatigue()` function then shifts the whole Goodman line. The add-on compares both cases for the default spring:

```python
    for pe in (False, True):
        f = fatigue(dict(P, shot_peened=pe))
```
```
## 7.4 Shot peening effect (same spring)
  peened False tau_D0 593 MPa, allowed stroke 439 MPa -> S_fat 1.62
  peened True  tau_D0 752 MPa, allowed stroke 556 MPa -> S_fat 2.06
```

**Hand check:**
- τ_D0 = 0.30 · 1978 = 593 MPa and 0.38 · 1978 = 752 MPa.
- The allowed stroke is τ_D0 + (1 − τ_D0/τ_st)·τ_kU − τ_kU with τ_st = 989 MPa and τ_kU = 257 MPa (core report):
  - not peened: 593 + 0.400·257 − 257 = 439 MPa;
  - peened: 752 + 0.240·257 − 257 = 556 MPa.
- S_fat = 439/270 = 1.62 and 556/270 = 2.06, with a stroke of 270 MPa.

**Shop-floor rules for peening** (check with the peening specification, for example SAE J2441 / AMS 2430 style):
- **Intensity** is set with Almen strips, type A, for springs of d 2–8 mm (about 0.2–0.5 mmA). Too high an intensity
  roughens the surface and creates folds; too low an intensity leaves the layer too thin.
- **Coverage** is at least 200 %, checked with a magnifier or fluorescent tracer paint.
- **Shot:** cut-wire or cast steel shot, conditioned (rounded) and sieved. Broken shot makes notches.
- **Double peening** (a second pass with smaller shot) and **stress peening** (peening the spring while it is
  compressed) raise the fatigue strength further. They are standard for automotive valve and suspension springs.
- After peening, a low-temperature tempering at about 220 °C stabilises the residual stresses. It must stay **below**
  the stress-relief temperature, otherwise the peening effect is lost.
- The inner side of the coil gets less shot, because it is shadowed. Wide pitch helps, and this is one reason why
  densely wound springs gain less from peening.

### 7.5 Coatings and the hydrogen problem

```
## 7.5 Coatings
  oiled                        transport / indoor         H-risk: none
  phosphate + oil              light, indoor              H-risk: low (pickling!) - bake within 1 h (check)
  powder coat (epoxy)          outdoor, cured ~180 C      H-risk: none
  zinc flake (Geomet / Delta)  salt spray 480-1000 h      H-risk: none
  electroplated zinc           medium                     H-risk: HIGH - avoid for Rm > 1000 MPa or bake 200 C 4 h (check)
```

Spring wire has R_m 1700–2000 MPa, so it is very sensitive to **hydrogen embrittlement**. Atomic hydrogen from acid
pickling or electroplating diffuses into the steel and collects at high-stress sites. The spring then breaks
brittlely, often **hours or days after assembly**, with no visible overload. That is why electroplating is avoided.
When pickling cannot be avoided, the springs are baked at about 200 °C for several hours within one hour of plating
(check the specification). Zinc-flake and powder coatings bring no hydrogen; the powder curing at about 180 °C even
acts as a low-temperature tempering.

The default cam spring runs in an oil-lubricated machine and is only **oiled**. Phosphating would be the next step if
corrosion during storage were a problem.

### 7.6 Cost per spring

The cost of a spring is mostly material and testing; machine time is small because coiling is fast:

```python
def cost_per_spring(P, wire_eur_kg=3.8, rate_coil=60.0, rate_grind=50.0, peen_eur=0.03, relief_eur=0.01, set_test_eur=0.04, batch=5000, setup_min=60):
    g = geometry(P)
    ct = coiling_time(P)
    wire = g["mass_kg"] * 1.03 * wire_eur_kg               # 3 % scrap
    coil = ct["t_s"] / 3600 * rate_coil
    grind = 2.0 / 3600 * rate_grind                        # ~2 s per spring on a double-disc grinder (check)
    setup = setup_min / 60 * rate_coil / batch
    tot = wire + coil + grind + (peen_eur if P["shot_peened"] else 0) + relief_eur + set_test_eur + setup
```
```
## 7.6 Cost per spring (batch 5000, check rates)
  wire 0.124, coiling 0.019, grinding 0.028, peening 0.030, relief 0.010, set_test 0.040, setup 0.012, total 0.263 EUR
```

**Hand check:**
- Wire: 31.8 g (core report) × 1.03 × 3.8 €/kg = 0.124 €.
- Coiling: 1.13 s at 60 €/h = 0.019 €.
- Grinding: 2 s at 50 €/h = 0.028 €.
- Set-up: 60 min at 60 €/h shared over 5000 springs = 0.012 €.
- **Total 0.263 €**.

**Interpretation.** The wire is about half the cost. A lighter spring is cheaper, which is one more reason
`design_from_requirements()` picks the lightest passing candidate. Peening and the 100 % force test add about a
quarter, and they are exactly the steps that make the spring reliable. Saving them is false economy for a cam spring
that sees 10⁸ cycles. All rates are examples (check).

### 7.7 Tolerances in the style of EN 15800 and the preload scatter

EN 15800 defines three tolerance grades (1 fine, 2 medium, 3 coarse) for the coil diameter, the free length, the spring
forces, and the perpendicularity and parallelism of the ends. The program uses a **simplified** form, marked "check".
The real standard has tables and formulas that depend on D, w, L0 and n. The structure, however, is the same:

- **Diameter:** A_D = ±0.010·D·q.
- **Free length:** A_L0 = ±0.015·L0·q.
- **Rate:** A_R = ±0.05·R·q.
- **Force at deflection s:** the rate error and the length error add statistically,
  A_F = √((A_R·s)² + (R·A_L0)²).
- **Perpendicularity:** e1 = 0.026·L0·q, about 1.5° for grade 2. **Parallelism:** e2 = 0.015·D_a·q.
- The grade factor is q = 0.63 / 1.0 / 1.6 for grades 1 / 2 / 3.

```python
def tolerances(P, grade=2):
    q = GRADE_Q[grade]
    F = forces(P)
    g = geometry(P)
    AD = 0.010 * P["D"] * q
    AL0 = 0.015 * P["L0"] * q
    AR = 0.05 * F["R"] * q
    AF1 = math.hypot(AR * F["s1"], F["R"] * AL0)
    AF2 = math.hypot(AR * F["s2"], F["R"] * AL0)
    return {"grade": grade, "AD": AD, "AL0": AL0, "AR": AR, "AF1": AF1, "AF2": AF2,
            "e1": 0.026 * P["L0"] * q, "e1_deg": math.degrees(math.atan(0.026 * q)), "e2": 0.015 * g["Da"] * q}

def preload_scatter(P, grade=2, F_req=50.0):
    t = tolerances(P, grade)
    F1 = forces(P)["F1"]
    return {"F1": F1, "AF1": t["AF1"], "F1_min": F1 - t["AF1"], "ok": F1 - t["AF1"] >= F_req}
```
```
## 7.7 Tolerances (EN 15800 style, simplified) and preload scatter
  grade 1: A_D +/-0.16, A_L0 +/-0.70 mm, A_R +/-0.092 N/mm, A_F1 +/-2.7 N, A_F2 +/-4.1 N, e1 1.21 mm (0.9 deg), e2 0.26 mm; F1 min 52.8 N >= 50 N OK
  grade 2: A_D +/-0.25, A_L0 +/-1.11 mm, A_R +/-0.146 N/mm, A_F1 +/-4.3 N, A_F2 +/-6.6 N, e1 1.92 mm (1.5 deg), e2 0.41 mm; F1 min 51.3 N >= 50 N OK
  grade 3: A_D +/-0.40, A_L0 +/-1.78 mm, A_R +/-0.234 N/mm, A_F1 +/-6.8 N, A_F2 +/-10.5 N, e1 3.08 mm (2.4 deg), e2 0.66 mm; F1 min 48.7 N < 50 N
```

**Hand check** (grade 2, default spring with R = 2.9228 N/mm, s1 = 19.0 mm, L0 = 74 mm):
- A_L0 = 0.015 · 74 = 1.11 mm, and A_R = 0.05 · 2.9228 = 0.146 N/mm.
- A_F1 = √((0.146 · 19.0)² + (2.9228 · 1.11)²) = √(7.70 + 10.52) = **4.27 N**.
- The lowest preload in the batch is 55.5 − 4.3 = 51.3 N.

**Why this is the link to the cam (M6).** Chapter 5 of M6 recommended a preload of **at least 50 N** to keep the
roller on the cam at 300 rpm, with the margin for follower vibration. The nominal 55.5 N meets this, but only grades 1
and 2 still meet it for the **weakest spring of the batch**. Grade 3 springs could give only 48.7 N. That is a real
lift-off risk caused only by the spring tolerance.

Three ways to deal with it:
1. order grade 2 or 1 for F1;
2. specify **F1 as the controlled force** on the drawing, with L0 only as a reference. The maker then adjusts L0 per
   batch to hit the force;
3. raise the nominal preload so that F1_min ≥ 50 N even in grade 3.

The **perpendicularity** e1 matters for a guided follower spring: a tilted spring pushes the follower sideways. That
adds to the guide friction of M6 chapter 5, and the spring rubs on the guide. Ground ends are required for that
reason.

### 7.8 Inspection plan

```
## 7.8 Inspection plan
  wire d, Rm               certificate 3.1 + micrometer, tensile test per coil lot    per lot
  surface of wire          eddy-current test in the drawing line (seams, laps)        100 % (wire maker)
  L0                       height gauge / camera                                      100 % or SPC
  F1, F2 at L1, L2         load tester, sorting                                       100 %
  D / Da / Di              go / no-go sleeve and mandrel                              SPC
  e1, e2                   square and feeler, or camera                               SPC
  shot-peening intensity   Almen strip A, coverage by magnifier                       per batch
  fatigue                  sample test on a spring fatigue machine to 1e7 cycles      per lot / first article
  decarburisation, cracks  metallography, magnetic particle                           first article / per lot
```

Practical notes:
- **Force testing.** The spring is compressed to L1 and L2 on a load tester. Before measuring it is compressed to
  solid or to L2 once, so that seating effects are removed. Forces are measured at **lengths**, not at deflections,
  because L0 scatters. Automatic testers sort the springs into classes or reject them.
- **Fatigue test.** Samples are run on a multi-spring fatigue machine, typically at 25–50 Hz between L1 and L2, up to
  10⁷ cycles without failure. For valve springs the fatigue limit is checked statistically, for example with the
  staircase method.
- **Wire surface.** The most dangerous defects are seams and laps from rolling the wire rod. They are found by eddy
  current at the wire maker. That is why VD-grade wire (valve quality) is specified for highly stressed dynamic
  springs.
- **Decarburisation** lowers the surface hardness and therefore the fatigue strength. It is checked metallographically
  on the first article and per wire lot.

### 7.9 Drawing data (EN ISO 2162 style)

A spring drawing must contain the data the maker needs to manufacture **and** the data the buyer will check. The
add-on builds the block from the program results:

```python
def drawing_block(P, grade=2):
    g, F, t = geometry(P), forces(P), tolerances(P, grade)
    return [("wire diameter d", "%.2f mm" % P["d"]), ("outside diameter Da", "%.2f +/- %.2f mm" % (g["Da"], t["AD"])),
            ...
            ("F1 at L1", "%.1f N +/- %.1f N at %.1f mm" % (F["F1"], t["AF1"], P["L1"])),
            ...]
```
```
## 7.9 Drawing data (EN ISO 2162 style)
  wire diameter d                        2.50 mm
  outside diameter Da                    27.50 +/- 0.25 mm
  guide (mandrel / sleeve)               Di 22.5 mm / Da 27.5 mm (min. guide clearance ~0.1 D, check)
  active coils n / total nt              8.5 / 10.5
  coiling direction                      right hand (unless specified)
  ends                                   closed and ground
  free length L0 (reference)             74.0 mm
  F1 at L1                               55.5 N +/- 4.3 N at 55.0 mm
  F2 at L2                               114.0 N +/- 6.6 N at 35.0 mm
  solid length Lc max                    26.25 mm
  rate R                                 2.923 N/mm (reference)
  perpendicularity e1 / parallelism e2   1.92 / 0.41 mm
  material                               EN 10270-2 VDSiCr (oil tempered, valve)
  surface                                shot peened, set to solid, oiled
  tolerance grade                        EN 15800 grade 2
  cycles / loading                       dynamic, 1e7 cycles F1 -> F2
```

`python spring.py run` also writes `drawing_data.csv` with the core values (d, D, Da, n, nt, L0, F1/L1, F2/L2, Lc, R,
ends, material), ready to paste into the title block.

**Rules for the drawing:**
1. **Tolerance at most two forces and one length**, for example F1 at L1, F2 at L2, and L0 as a reference. If d, D,
   n, L0 *and* both forces are all toleranced, the spring is overdetermined: the maker cannot meet everything and will
   change n or L0 anyway. EN 15800 says so explicitly.
2. Give the **guide** (mandrel or sleeve) diameter, so the maker can check D_a and D_i against it. Remember that D_a
   grows under compression; the core estimates D_a at solid (27.69 mm for the default spring).
3. **L_c is a maximum** for ground ends, because the maker needs to know whether the spring is allowed to go solid.
4. Write the treatment chain (peening, setting, coating) and the **number of load cycles**. It tells the maker that
   this is a dynamic spring and requires VD wire and peening.

### 7.10 Failure modes, causes and remedies

```
## 7.10 Failures
  fatigue fracture   | stroke stress too high, surface defect, no peening | lower tau_kH, peening, better wire
  surge fracture     | natural frequency near a cam harmonic | raise f_e, damping, progressive pitch
  relaxation / set   | stress near tau_y, temperature | presetting, VDSiCr, lower stress
  buckling / rubbing | L0/D too large, no guide | guide on mandrel or sleeve, shorter spring
  corrosion fatigue  | humidity, no coating | zinc flake, stainless
  hydrogen fracture  | electroplating or pickling of high-strength wire | no electroplating, baking
  coil clash         | L2 below Ln_min, uneven pitch | keep minimum gaps Sa
```

How to read a broken spring:
- **Fatigue fracture.** The typical fracture runs at about 45° to the wire axis, along the plane of maximum tension,
  because the wire is in torsion. It starts on the **inner** side of the coil, where the Bergsträsser factor puts
  the highest stress. Beach marks on the fracture face point back to the origin, often a surface defect or a
  decarburised spot.
- **Surge fracture.** It happens near the end coils. In a spring excited near its natural frequency, a compression wave
  runs between the ends, the coils clash, and the local stress is far above the static value. That is why the
  core checks f_e > 12·f_exc (chapter 4).
- **Relaxation** is not a fracture but a slow loss of F1, measured as a percentage after 48 h at temperature. VDSiCr
  wire and setting are the remedies.
- **Hydrogen fracture** looks brittle and intergranular and appears after a delay, often in springs that were plated.

### 7.11 Assembly and installation

- **Installation length L1.** The preload is set by the length, not by the force. Housing tolerances and shims add to
  the spring tolerance. With R = 2.92 N/mm, a 0.5 mm housing error changes F1 by 1.5 N; add it to A_F1 of section 7.7.
- **Guide.** A follower spring is guided on a mandrel (inside) or in a sleeve (outside), with a clearance of about
  0.1·D in total (check). Too tight a guide rubs when D_a grows under compression; too loose a guide lets the spring
  buckle sideways and rub.
- **End orientation.** For a spring with ground ends the end of the last coil is a short tip. It should not sit on an
  edge or a hole of the seat; mark the seat orientation for high-speed springs.
- **Never stretch a compression spring** to raise its force, and never shorten it by grinding at assembly. Both
  destroy the peened surface or the defined end.
- **Spare springs** come from the same treatment chain and tolerance grade. A replacement "off the shelf" with the
  same d, D, n but without peening has about 20 % less fatigue margin (section 7.4).

---

## 8. Verification, complete worked example, references, glossary

### 8.1 Verification of the program

The core self-test (`python spring.py selftest`) checks the physics independently:

```
python spring.py selftest
```
```
F = R s at both working points                                     OK   
work = (F1 + F2)/2 x stroke                                        OK   
Bergstraesser k -> 1 for large index; k(6) = 1.2857                OK   
natural frequency = 1/2 sqrt(R / m_active) (fixed-fixed bar)       OK   168.5 Hz
stored energy 1/2 R s^2 = tau^2 V/(4G) (torsion of the wire)       OK   
buckling: pinned ends buckle earlier than fixed ends               OK   
Haigh line passes (0, tau_D0) and (tau_st, tau_st)                 OK   
design: lightest passing candidate exists and meets the forces     OK   d 2.2 n 5.0
SELFTEST PASS
```

The most important checks:
- **Natural frequency** is computed twice: once from the EN 13906 formula f_e = d/(2π n D²)·√(G/2ρ), and once from
  the physics of a bar fixed at both ends, f = ½·√(R/m_active). Both agree exactly (168.5 Hz), so the formula is
  implemented correctly.
- **Stored energy** ½·R·s² equals τ²V/(4G), the torsion energy of the wire without the curvature correction. This
  proves that rate and stress belong to the same model.
- **Haigh line** passes through (0, τ_D0) and through the static limit (τ_st, τ_st).

The chapter-7 add-on was checked by hand above: spring-back 21.96 mm (§7.2), wire length 828 mm, set 3.87 mm (§7.3),
peening (§7.4), cost (§7.6), tolerances (§7.7).

### 8.2 Worked example: the cam follower spring for 400 rpm

**Task.** M6 chapter 8 redesigned the packaging pusher cam for **400 rpm** (`tools/examples/cam_example.json`):
modified sine 130°/150°, base circle 35 mm, and a spring with **70 N preload** on the base circle and **4 N/mm**. The
cam lifts 20 mm, so the spring has to deliver:

| Requirement | Value | Source |
|---|---|---|
| F1 (cam on base circle) | 70 N | cam_example.json `F0_spring` |
| F2 (full lift) | 70 + 4 · 20 = 150 N | rate × stroke |
| stroke | 20 mm | cam lift h |
| mean diameter D | 25 mm | same follower guide as the default |
| outside diameter | ≤ 30 mm | guide bore |
| excitation | 400/60 = 6.667 Hz | cam speed |
| natural frequency | > 12 × 6.667 = 80 Hz | cam harmonics up to 12 (M6 chapter 5) |
| loading | dynamic, ≥ 10⁸ cycles, oil | machine |

**Step 1 – requirements into the program.** The add-on writes them in the format of `DEFAULT["req"]`:

```python
def example_requirements(rpm=400.0, F0=70.0, k=4.0, stroke=20.0, D=25.0, Da_max=30.0):
    return {"F1": F0, "F2": F0 + k * stroke, "stroke": stroke, "D": D, "Da_max": Da_max}, rpm / 60.0
```

**Step 2 – search all wire diameters** with the core's `design_from_requirements()` from chapter 6. For each
preferred d it computes n from the required rate, rounds to half coils, sets L2 just above the minimum length with
gaps, and runs every check:

```
## 8.2 Worked example: M6 cam at 400 rpm
  requirements F1 70 N, F2 150 N, stroke 20 mm, D 25 -> R 4.00 N/mm; excitation 6.667 Hz, f_e needed > 80 Hz
  d 2.2 n  3.5 R 4.26 L0   52.4 L2  16.0   13 g S_st 1.07 S_fat 0.71 f_e 360 Hz fails: solid_block, fatigue
  d 2.5 n  6.0 R 4.14 L0   63.0 L2  26.1   24 g S_st 1.59 S_fat 1.32 f_e 239 Hz OK
  d 2.8 n 10.0 R 3.91 L0   81.2 L2  43.3   46 g S_st 2.29 S_fat 2.18 f_e 160 Hz OK
  d 3.0 n 13.0 R 3.96 L0   95.1 L2  57.4   65 g S_st 2.78 S_fat 2.75 f_e 132 Hz OK
  d 3.2 n 16.5 R 4.04 L0  112.2 L2  74.9   92 g S_st 3.33 S_fat 3.35 f_e 111 Hz OK
  d 3.5 n 24.0 R 3.98 L0  151.3 L2 113.7  154 g S_st 4.37 S_fat 4.56 f_e  84 Hz OK
  d 3.8 n 33.0 R 4.02 L0  201.9 L2 164.5  245 g S_st 5.54 S_fat 5.82 f_e  66 Hz fails: surge
  d 4.0 n 40.5 R 4.02 L0  246.5 L2 209.0  329 g S_st 6.44 S_fat 6.80 f_e  57 Hz fails: buckling, surge
  lightest passing: d 2.5 n 6.0 L0 63.0
  example JSON: {"name": "Follower spring for the M6 cam at 400 rpm (preload 70 N, 4 N/mm, stroke 20 mm)", "d": 2.5, "D": 25.0, "n": 6.0, "L0": 63.0, "L1": 46.1, "L2": 26.1, "f_exc": 6.667, "req": {"F1": 70.0, "F2": 150.0, "stroke": 20.0, "D": 25.0, "Da_max": 30.0}}
```

The search shows the classic **design window** of a dynamic spring:
- **Too thin a wire (d 2.2):** few coils and a short spring, but the stress is too high. It fails fatigue
  (S 0.71) and cannot be compressed to solid.
- **Too thick a wire (d ≥ 3.8):** many coils, long and heavy. The natural frequency drops below 80 Hz (surge), and
  the spring finally buckles.
- **Between (d 2.5 … 3.5)** every check passes; the lightest is d 2.5 mm with 6 active coils.

**Step 3 – check the chosen spring in detail.** The JSON line is saved as `tools/examples/spring_example.json`:

```json
{
  "name": "Follower spring for the M6 cam at 400 rpm (preload 70 N, 4 N/mm, stroke 20 mm)",
  "d": 2.5, "D": 25.0, "n": 6.0, "L0": 63.0, "L1": 46.1, "L2": 26.1, "f_exc": 6.667,
  "req": {"F1": 70.0, "F2": 150.0, "stroke": 20.0, "D": 25.0, "Da_max": 30.0}
}
```

```
python spring.py run --in examples/spring_example.json --out example
```
```
# Compression spring report (EN 13906-1 style) - Follower spring for the M6 cam at 400 rpm (preload 70 N, 4 N/mm, stroke 20 mm)

EN 10270-2 VDSiCr (oil tempered, valve), shot peened, d 2.50, D 25.00 (Da 27.50, Di 22.50), n 6.0 active / 8.0 total, closed and ground, L0 63.00 mm

## Material
- Rm_min 1978 MPa, tau_zul = 0.5 Rm 989 MPa, G 79500 MPa

## Rate, forces, lengths
- rate R 4.1406 N/mm; F1 70.0 N at L1 46.1 (s1 16.9), F2 152.8 N at L2 26.1 (s2 36.9), at solid 178.0 N; work stroke 2.228 J
- spring index w 10.00 (OK), Bergstraesser k 1.1351; solid length Lc 20.00, minimum gaps Sa 5.62 -> Ln_min 25.62 mm (L2 26.1: OK)
- pitch 9.667 mm, mass 24.2 g, outer diameter at solid ~27.62 mm

## Stresses
- tau at L2 623 MPa (S 1.59 OK), at solid 725 MPa (can be compressed to solid)
- fatigue (corrected): tau_kU 324, tau_kO 707, stroke 383 MPa; tau_D0 752, allowed stroke 506 MPa -> S 1.32 OK

## Stability and dynamics
- buckling: nu 0.5, L0/D 2.52, s_K none (stable) -> OK
- natural frequency 239 Hz = 35.8 x excitation 6.7 Hz (needs > 12 x = 80 Hz) -> OK
```
(The report continues with the candidate list of step 2 and ends with
`written: report.md, drawing_data.csv -> example`.)

**Hand check of the key numbers.**
- **Rate:** R = 79 500·2.5⁴/(8·25³·6) = 3 105 469/750 000 = **4.141 N/mm** (required 4.0; the half-coil rounding
  gives +3.5 %).
- **Forces:** F1 = 4.141·16.9 = 70.0 N and F2 = 4.141·36.9 = 152.8 N.
- **Solid length:** L_c = n_t·d = 8·2.5 = 20.0 mm.
- **Minimum gaps** (dynamic, ×1.5): S_a = 1.5·(0.0015·625/2.5 + 0.25)·6 = 1.5·(0.375 + 0.25)·6 = 5.62 mm, so
  L_n = 25.62 mm ≤ L2 = 26.1 mm. ✓
- **Stress at L2:** τ = 8·152.8·25/(π·2.5³) = 623 MPa; S = 989/623 = 1.59.
- **Fatigue:** k = (10 + 0.5)/(10 − 0.75) = 1.1351.
  - τ_kU = 1.1351·8·70.0·25/(π·15.625) = 324 MPa, τ_kO = 707 MPa, stroke 383 MPa.
  - Allowed stroke = 752 + (1 − 752/989)·324 − 324 = 506 MPa, so S = 1.32.
- **Natural frequency:** f_e = (0.0025/(2π·6·0.025²))·√(79.5·10⁹/(2·7850)) = 0.1061 m⁻¹·2250 m/s = **239 Hz**. That is 35.8 ×
  the cam frequency, far above the 12th harmonic (80 Hz).

**Step 4 – manufacturing data for this spring** (add-on functions applied to the example):

| Item | Value | Function |
|---|---|---|
| Coiling diameter (spring-back) | 21.96 mm for D 25 (12.2 %) | `coiling_tool_diameter()` |
| Setting | not needed: τ at solid 725 MPa < τ_y 1088 MPa | `set_amount()` |
| Tolerances grade 2 | A_L0 ±0.95 mm, A_F1 ±5.2 N, A_F2 ±8.6 N, e1 1.64 mm | `tolerances()` |
| Lowest preload in the batch (grade 2) | 70.0 − 5.2 = **64.7 N** | `preload_scatter(P, 2, 70)` |
| Cost per spring | about 0.23 € (batch 5000, example rates) | `cost_per_spring()` |

**Step 5 – decision on the preload tolerance.** The cam example of M6 was calculated with exactly 70 N preload. With
grade 2 the weakest spring gives 64.7 N. The M6 example keeps a contact-force margin of 70 N at 400 rpm, so 64.7 N
still keeps the roller on the cam. Even so, the drawing should make **F1 = 70 N the controlled force** with a
one-sided tolerance (for example 70 +8/−0 N), so that the cam calculation remains valid for every spring. The maker
then adjusts L0 per batch. The alternative is grade 1 (A_F1 ±3.3 N).

**Step 6 – drawing text.**
- Helical compression spring, EN 10270-2 VDSiCr, d 2.5 mm, D_a 27.5 ± 0.25 mm, n 6, n_t 8, right hand, ends closed
  and ground.
- **F1 = 70 +8/−0 N at L1 = 46.1 mm**, F2 = 152.8 ± 8.6 N at L2 = 26.1 mm. L0 ≈ 63 mm (reference). L_c ≤ 20.0 mm.
- e1 ≤ 1.6 mm. Shot peened (0.3–0.4 mmA, coverage ≥ 200 %), set to solid, oiled.
- Dynamic loading, 10⁸ cycles F1 → F2, guided on a mandrel Ø 22.
- Tolerances otherwise to EN 15800 grade 2.

**Result.** The redesigned 400 rpm cam gets a spring of the same wire and diameter as the 300 rpm default, but with
6 instead of 8.5 coils (24 g instead of 32 g, because fewer coils give the higher rate). It has a fatigue
safety of 1.32 and a natural frequency of 239 Hz, and it costs about 0.23 €.

### 8.3 Checklist before releasing a spring drawing

1. Index 4 ≤ w ≤ 20; L2 ≥ L_c + S_a (dynamic gaps ×1.5).
2. Static stress at L2 and at solid below τ_zul. If not, the spring must be set, and the coiling length must be L0 + set.
3. Fatigue safety ≥ 1.1 with the corrected stresses and the right material and peening state.
4. Buckling checked with the real seating; guide clearance about 0.1·D.
5. Natural frequency well above the highest relevant excitation harmonic.
6. Tolerance grade chosen so that the **weakest spring of the batch** still meets the mechanism requirement
   (F1_min ≥ required preload).
7. Drawing: two toleranced forces + one reference length, treatment chain, number of cycles, guide diameter.
8. Coating without hydrogen risk for R_m > 1000 MPa.
9. First-article inspection: forces, L0, e1, peening intensity, metallography, and a fatigue sample.

### 8.4 References

1. **EN 13906-1:2013** Cylindrical helical springs made from round wire and bar – Calculation and design – Part 1:
   Compression springs. **EN 13906-2** (extension springs), **EN 13906-3:2014** (torsion springs).
2. **EN 10270-1/-2/-3:2011** Steel wire for mechanical springs: patented cold-drawn / oil-hardened and tempered /
   stainless spring steel wire.
3. **EN 15800:2008** Cylindrical helical springs made from round wire – Quality specifications for cold coiled
   compression springs (tolerance grades 1, 2, 3).
4. **EN ISO 2162-1/-2** Technical product documentation – Springs – Simplified representation and presentation of data.
5. **ISO 26909:2009** Springs – Vocabulary.
6. Meissner, M.; Schorcht, H.-J.: *Metallfedern – Grundlagen, Werkstoffe, Berechnung, Gestaltung und Rechnereinsatz*.
   Springer.
7. Wahl, A. M.: *Mechanical Springs*. McGraw-Hill (Wahl factor, surge).
8. Spring Manufacturers Institute (SMI): *Handbook of Spring Design*.
9. Institute of Spring Technology (IST), Sheffield: design and manufacturing guides (setting, peening, relaxation).
10. SAE J2441 / AMS 2430: shot peening specifications (Almen intensity, coverage).
11. Niemann, G.; Winter, H.; Höhn, B.-R.: *Maschinenelemente Band 1*. Springer.
12. Wittel, H. et al.: *Roloff/Matek Maschinenelemente*. Springer Vieweg.
13. Guide M6 (cam design), chapters 5 and 8 – spring preload, lift-off and the 400 rpm redesign.

### 8.5 Glossary

| Term | Meaning |
|---|---|
| active coils n | coils that deflect; dead end coils do not count |
| total coils n_t | n + 2 for closed ends |
| Almen intensity | arc height of a standard strip peened with the same settings; measure of peening energy |
| Bergsträsser factor k | stress correction for the curvature of the wire, k = (w + 0.5)/(w − 0.75) |
| coiling point | pin or roll of the coiler that bends the wire into the helix |
| coverage | share of the surface hit by shot (100 % = every point hit once) |
| decarburisation | loss of carbon at the wire surface during heat treatment; lowers fatigue strength |
| e1, e2 | perpendicularity of the spring axis and parallelism of the ground ends |
| EN 15800 grade | tolerance class 1 (fine), 2 (medium), 3 (coarse) |
| F1, F2 | spring forces at the installed and the fully compressed working length |
| hydrogen embrittlement | delayed brittle fracture of high-strength steel caused by absorbed hydrogen |
| L0, L1, L2, L_c | free, installed, maximum working, solid length |
| minimum gaps S_a | sum of coil gaps that must remain at L2 (×1.5 for dynamic springs) |
| oil-tempered wire | wire hardened and tempered after drawing (EN 10270-2) |
| patented wire | wire transformed to fine pearlite, then cold drawn (EN 10270-1) |
| presetting / setting | compressing to solid once or more to take the permanent set before delivery |
| relaxation | loss of force under constant length over time and temperature |
| shot peening | blasting with shot to create compressive residual stress at the surface |
| spring-back | elastic opening of the coil after the coiling point releases the wire |
| spring index w | D/d |
| stress relief | tempering after coiling to remove coiling residual stresses |
| surge | resonance of the spring coils; a compression wave travels along the spring |
| τ_kH | corrected stroke stress (τ_kO − τ_kU) |
| VD / VDSiCr | valve-spring quality wire (guaranteed surface), Si-Cr alloyed |
