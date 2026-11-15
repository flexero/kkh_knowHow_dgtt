# 58 – Final thesis item F1: the products and all their parts

*VC20 piston compressor and RB50 / RB100 / RB150 Roots blowers: function, design checks, parts lists, materials, blanks,
tolerances, routings, machining times, part families. This is the data from which the combined FMS is designed.*

**Files.**

| Path | Content |
|---|---|
| `thesis_final/design/01_products/products.json` | master data you can edit |
| `thesis_final/design/01_products/products.py` | program, standard-library Python |
| `thesis_final/design/01_products/out/` | generated BOMs, routings, machine minutes, report and product trees |

The plan of the whole final thesis is in `thesis_final/00_final_thesis_plan.md`.

**Data labels.**
- All values are **design values** or **reference estimates** (catalogue mid values ±25 %).
- Nothing in this guide is measured.
- Replace values with your foundry quotations, CAM times and trial results as soon as you have them (chapter 12).

---

## 0 How to use this guide and the program

```
cd thesis_final/design/01_products
python products.py selftest                 # must print SELFTEST PASS (25/25)
python products.py perf                     # compressor dimension chain + performance, Roots flow/power/motor
python products.py part C01                 # time sheet of one part, feature by feature
python products.py part R06 --variant RB150 # same for a Roots variant
python products.py minutes                  # machine minutes per unit  -> input of item F2
python products.py run                      # writes all CSV / SVG / report.md into out/
```

**Program map.** Each chapter of this guide matches one function of the program.

| Guide chapter | Program function | Output |
|---|---|---|
| 2 Compressor checks | `compressor_perf`, `tdc_chain` | `perf` |
| 3 Roots blower checks | `roots_perf` | `perf` |
| 4–5 Parts, BOM | `bom_rows`, `tree_svg` | `out/bom_*.csv`, `out/tree_*.svg` |
| 7 Process plans | data `ops` in JSON | `out/routing_all.csv` |
| 8 Machining time | `feature_time`, `op_time` | `part <id>` |
| 9 Machine minutes | `machine_minutes` | `minutes`, `out/machine_minutes.csv` |

---

## 1 Why an FMS is designed from parts, not from products

A factory sells products, but its machines work on **parts**. The FMS designer therefore needs, for every part:

1. **What** it is: geometry class, size, mass, material.
2. **How many**: quantity per product × product volume.
3. **How** it is made: the sequence of operations, the machine type of each operation and the fixture.
4. **How long** each operation takes: machining time, non-cutting time, load time.
5. **How good** it must be: the critical characteristics, which decide the machine accuracy, the process and the
   inspection.

Classical FMS planning calls this **P-Q-R-S-T** (Muther): product, quantity, routing, supporting services and time.
Item F1 delivers P, R and T. Item F2 adds Q, the production programme, and then calculates the machines, pallets, cells
and layout.

**The rule of this thesis.**
- Every number that F2 uses must come from a part, an operation and a formula you can check.
- No "HMC 36 min" falling from the sky.
- If the number is wrong, you can see which feature or which cutting value causes it.

---

## 2 Product 1 – VC20 V-twin piston compressor

### 2.1 Function in one paragraph

An electric motor (3 kW, 2930 rpm) drives the crankshaft through two V-belts with ratio 2:1, so the crank turns at about
1465 rpm.

**One revolution, per cylinder.**
- The single crank pin moves **two connecting rods**. They drive two pistons in cylinders set at 90°.
- **Downstroke:** the piston sucks air through the filter and the suction reed valve.
- **Upstroke:** it compresses the air to 8 bar(g), and the discharge reed valve opens into the head.
- **Delivery:** the air flows through the copper manifold and the check valve into the 300 L receiver.

**Control and protection.**
- The pressure switch stops the motor at 8 bar and restarts it at 6 bar.
- The unloader valve vents the pump head so that the motor can restart without load.
- The safety valve opens at 10 bar.
- Lubrication is by splash: the rod dips into 0.9 L of oil.

### 2.2 Design values (from guide M2, `crank.py`, design V3)

| Quantity | Symbol | Value | Source |
|---|---|---|---|
| Bore × stroke | D × s | 70 × 46 mm | design V3 |
| Rod length (centre distance) | l | 90 mm | design |
| Crank radius | r = s/2 | 23 mm | – |
| Rod ratio | λ = r/l | 0.256 | – |
| Speed | n | 1450 rpm | design |
| Clearance ratio | c | 0.035 | design |
| Discharge pressure | p₂ | 8 bar(g) = 9.013 bar(a) | spec |

**Swept volume and displacement (program `compressor_perf`).**

$$V_s = z\,\frac{\pi}{4}D^2 s = 2\cdot\frac{\pi}{4}\,0.070^2\cdot 0.046 = 3.540\cdot10^{-4}\ \text{m}^3 = 0.354\ \text{L per rev}$$

$$\dot V_{disp} = V_s \cdot n \cdot 60 = 3.540\cdot10^{-4}\cdot 1450\cdot 60 = 30.80\ \text{m}^3/\text{h}$$

**Free air delivery.** FAD = λ_total · V̇_disp.
- λ_total = λ_V · λ_p · λ_T · λ_leak = 0.800 · 0.950 · 0.92 · … = 0.699. The full model is in M2 ch. 4.
- FAD = 0.699 · 30.80 = **21.53 m³/h**.
- This is +7.6 % above the 20 m³/h class value. The margin covers wear and a larger TDC gap.

**Motor.**
- The shaft power is 2384 W.
- The motor input is P_in = P_shaft / η_belt = 2384 / 0.95 = **2509 W**, so the installed motor is **3.0 kW** at 84 % load.

> The older value of 4 kW in `config/factory.json` came before the crank design. The design shows that 3 kW is enough.
> Use 4 kW only if the duty is S1 at high ambient temperature (above 40 °C) or at altitude. That is a sales decision.

**Discharge temperature (check of the oil and the materials).** Assume polytropic compression with n ≈ 1.3:

$$T_2 = T_1\left(\frac{p_2}{p_1}\right)^{\frac{n-1}{n}} = 293\cdot(9.013/1.013)^{0.2308} = 293\cdot1.656 = 485\ \text{K} \approx 212\ ^\circ\text{C}$$

What follows from this:
- The discharge reed valve, the valve plate and the head see about 200 °C at the gas side.
- So the head is aluminium with fins, the valve plate is steel, and the gaskets are aramid.
- The oil must be ISO VG 100 compressor oil with a flash point above 230 °C.
- This temperature is also why single-stage piston compressors stop at about 8–10 bar. For 10 bar and above, a two-stage
  design with an intercooler is used.

### 2.3 The dimension chain that decides the TDC gap (program `tdc_chain`)

The **TDC gap** (top-dead-centre clearance) is the distance between the piston crown and the valve plate at TDC. It is
the biggest single influence on the clearance ratio c, and therefore on the FAD. M2 ch. 10: +0.1 mm gap costs −0.335 m³/h,
which is 1.55 %.

Along one cylinder axis, measured from the crank axis:

$$\text{crown at TDC} = r + l + h_c \qquad \text{cylinder top} = h_d + t_g + L_{cyl} \qquad \text{gap} = \text{cylinder top} - \text{crown at TDC}$$

| Symbol | Meaning | Value | Tolerance | Who makes it |
|---|---|---|---|---|
| r | crank radius | 23.0 | ±0.02 | crankshaft OP20/OP40 |
| l | rod centre distance | 90.0 | ±0.03 | con rod OP20 |
| h_c | piston compression height (pin to crown) | 31.9 | ±0.03 | bought piston |
| h_d | deck height (crank axis to cylinder deck) | 60.0 | ±0.05 | crankcase OP20 |
| t_g | base gasket | 0.5 | class 0.4 / 0.5 / 0.6 | selective assembly |
| L_cyl | cylinder length | 85.0 | ±0.03 | cylinder OP10/OP20 |

Result: crown 23 + 90 + 31.9 = 144.9 mm. Cylinder top 60 + 0.5 + 85 = 145.5 mm. **Gap = 0.60 mm.**

**Worst-case tolerance stack.**
- ±(0.02 + 0.03 + 0.03 + 0.05 + 0.03) = **±0.16 mm**. This would give a gap between 0.44 and 0.76 mm.
- 0.44 is below the 0.50 mm running minimum from M2. Then the piston could touch the valve plate when hot.
- RSS (statistical) stack: √(0.02² + 0.03² + 0.03² + 0.05² + 0.03²) = ±0.073 mm.

**Decision: selective base gasket.**
1. In assembly step A30, measure the piston protrusion at TDC with a dial gauge.
2. Choose the gasket class 0.4 / 0.5 / 0.6 mm from the measurement.

The residual spread is then about ±0.05 mm. This is why B10 in the BOM is "selective".

**Collision check (an error that was found and corrected in this item).** At BDC the piston skirt and the cylinder
spigot must stay outside the circle swept by the crank webs and counterweights (radius R_w = 44 mm):

$$\text{skirt at BDC} = (l - r) - (L_{piston} - h_c) = 67 - (52 - 31.9) = 46.9\ \text{mm} \;\Rightarrow\; 2.9\ \text{mm clear}$$
$$\text{spigot bottom} = h_d - \text{spigot} = 60 - 10 = 50\ \text{mm} \;\Rightarrow\; 6.0\ \text{mm clear}$$

The first data set used a cylinder length of 110 mm, and a deck height that did not close the chain. With the 110 mm
cylinder the deck would have to be at about 35 mm, and the cylinder spigot would sit inside the 44 mm web circle.

The program now checks both clearances (≥ 2 mm) in `selftest`, so this mistake cannot come back. The skirt leaves the
bore by 3.1 mm at BDC. This is allowed, because the rings stay inside the bore; it is common for short pistons.

> **Lesson for every product design.** Close the dimension chain *before* you make the part list. One wrong length
> changes the casting, the stud length, the machining time and the fixture.

### 2.4 Product structure of the VC20

```
VC20  compressor
├── U10 pump unit (bare compressor)
│   ├── U11 crank drive        C01 crankcase, C02 rear cover, C03 front cover, C07 crankshaft, 2× C08 con rod,
│   │                          bearings 6306 + 6206, seal, rod bolts, key, plugs, sight glass
│   └── U12 cylinder bank ×2   C04 cylinder, C05 head, C06 valve plate, piston + rings + pin, reeds, gaskets, studs, filter
├── U20 drive unit             C09 flywheel pulley, motor 3 kW, motor pulley, 2 V-belts, guard, slide rails
└── U30 tank + control         receiver 300 L (PED), pressure switch, safety valve, check valve, gauges, drain, feet
```

Machined in the FMS: **9 different parts, 13 pieces per compressor**. C04, C05 and C06 are needed twice because U12 is
fitted twice. C08 is needed twice because there are two rods.

Bought: 37 BOM lines.

Casting and forging mass per compressor: 48.0 kg blank → 40.8 kg finished, i.e. 7.2 kg of chips.

> **Multi-level quantity.** The quantity per product unit is the part quantity multiplied by the quantity of every
> assembly above it: cylinder 1 per U12 × 2 U12 per U10 = 2 per VC20. The program does this in `unit_qty`. The first
> version multiplied only by the part's own quantity and counted the cylinders once. The self-test found the error, and
> it now checks the explosion. This is the classic MRP explosion error, and the reason why the BOM CSV has both columns,
> `qty` (per parent) and `qty_unit` (per product).

The tree is drawn by `products.py run` → `out/tree_VC20.svg`.

### 2.5 Part cards – compressor

Every card answers the same questions: function → material and why → blank → critical characteristics and why → route
→ inspection.

**C01 Crankcase** (EN-GJL-250, sand casting 16.5 → 14.2 kg, family P-L)
- *Function.*
  - Carries the crankshaft in two ball bearings.
  - Holds both cylinders at 90°.
  - Oil sump.
- *Why grey cast iron.*
  - Damping, which means low noise.
  - Very good machinability, so short cycles.
  - Stable after stress-relief.
  - Cheap for complex internal shapes.
  - Compressive strength is more than enough for the bearing loads (2.2 kN cubic mean).
- *Critical characteristics.*
  - Bearing seats Ø72 H7 / Ø62 H7, coaxial 0.02. The ball bearings need an alignment error below about 0.1 mrad.
  - Decks perpendicular to the crank axis within 0.03, and at 90° ±0.05°. Otherwise the piston runs inclined and the
    ring wears on one side.
  - Deck height 60.00 ±0.05 (TDC chain, 2.3).
- *Route.*
  - **OP10 HMC**: base face, feet holes, drain thread. This creates the datum for OP20.
  - **OP20 HMC**: both decks with spigots and stud threads, then both bearing seats, from one clamping. The B-axis is
    indexed 0°/180°; the HMC B-axis accuracy is about ±3″, so the seats stay coaxial.
  - Covers, breather and sight-glass threads.
  - **OP30 washing** to ISO 16232 cleanliness (≤ 2 mg per part).
  - **OP40 CMM** 1 in 20.
- *Why both bearing seats in one clamping.* Coaxiality of 0.02 across two clampings would need a re-referencing error
  below 0.01. That is not robust in series production.

**C02 Rear bearing cover, C03 Front cover** (EN-GJL-250, 1.5 / 1.9 kg, family P-S)
- C02 is the axial stop of bearing B. C03 holds the oil seal (Ø47 H8, Ra 1.6) and the sight glass.
- Small parts are clamped 4 per fixture on a **VMC** (FV1). F2 decided **not** to use the HMC as an alternative; see
  rule 6 in chapter 7.

**C04 Cylinder, finned** (pearlitic EN-GJL-250, 3.9 → 3.3 kg, family P-M)
- *Function.* Piston running surface and cooling.
- *Why pearlitic grey iron.* The graphite flakes hold oil in the honed plateau, so the surface is self-lubricating.
  Pearlite gives the wear resistance.
- *Critical.*
  - Ø70 H7.
  - Cylindricity 0.008.
  - Plateau honing Ra 0.3–0.6 with a cross-hatch of 40–60°, Rk ≤ 0.5.
  - Length 85.00 ±0.03 (TDC chain).
  - End faces parallel within 0.02.
- *Route.*
  - VMC OP10: bottom face, spigot, rough + semi-finish bore to Ø69.94.
  - VMC OP20: top face, 4 through holes.
  - **HONE OP30**: two-stage honing, Ø69.94 → Ø70.015.
  - Wash.
- *Inspection.* Air gauge in the honing machine (100 %). Roughness Rk/Rpk 1 per shift.

**C05 Cylinder head** (EN AC-46000 die casting, 1.25 → 1.05 kg, family P-S)
- Suction and discharge chambers. Its fins cool the hot discharge gas.
- *Critical.*
  - Gasket face flat within 0.03.
  - Partition wall coplanar within 0.05. Otherwise the discharge leaks back to the suction side, and the FAD drops
    several percent.
- *Route.* VMC OP10 gasket face + holes. VMC OP20 ports G1/2 and G3/8.

**C06 Valve plate** (C45, laser-cut blank 8.6 mm, family P-F)
- *Function.* Carries the reed valves.
- *Critical.*
  - Valve seats flat to 0.005, Ra 0.2. A leaking seat loses up to 10 % FAD.
  - Thickness 8 ±0.02 (TDC chain).
- *Route.*
  - VMC OP10/OP20 (6 parts per fixture).
  - **Double-disc lapping** OP30, batch 24 per 20 min.
  - Washing.

**C07 Crankshaft** (42CrMo4 +QT forging 4.8 → 3.6 kg, pin + journals induction-hardened 50–55 HRC, family R-E)
- *Function.* Throw r = 23 mm. One pin for both rods. Counterweight 25.7 kg·mm (M2 ch. 8).
- *Why 42CrMo4 and induction hardening.*
  - The aluminium rods run **directly** on the pin, without bearing shells.
  - The pin must therefore be hard (≥ 50 HRC) and ground (Ra 0.2).
  - The QT core (28–32 HRC) carries the bending fatigue. M2 LC2: σ_b = 14.8 MPa, a very large margin.
- *Critical.*
  - Journals Ø30 k5, pin Ø30 −0.007/−0.020.
  - Throw ±0.02.
  - Pin parallel to the journals within 0.01/40.
  - Balance G6.3, i.e. ≤ 62 g·mm per plane (ISO 21940-11).
- *Route.*
  1. Lathe OP10: face + centres.
  2. **Turn-mill OP20**: journals, pulley end, webs; the **pin by orbital turning** (C-axis synchronised with X); thread;
     keyway.
  3. Induction hardening OP30.
  4. **Grinding OP40**: journals and pulley seat by plunge; the pin on an angular-head or orbital (pin-chasing) grinder.
  5. **Balancing OP50** with a bob weight for the rod and piston masses, with drilling correction.
- *Alternative.* Buy the crankshaft ready-machined from a forging supplier. Make-or-buy is discussed in chapter 6.

**C08 Connecting rod with cap ×2** (EN AC-46200 die cast, 0.42 → 0.35 kg, family P-F)
- *Function.* Transfers 4089 N at most (LC4). Buckling safety ≥ 5.6 (M2).
- *Why an aluminium rod.*
  - It is light, so the inertia forces are small.
  - It runs on the hardened pin with splash oil.
  - It is standard in small air-cooled compressors.
- *Critical.*
  - Big end Ø30 H6 bored **with the cap assembled**.
  - Centre distance 90 ±0.03 (TDC chain).
  - Bores parallel within 0.02/50.
  - Mass graded ±2 g, matched with the piston mass grade.
- *Route.*
  - VMC OP10: faces, separating the cap, joint faces, bolt holes.
  - VMC OP20, assembled: bore the big and small ends.
  - Washing and mass grading.

**C09 Flywheel pulley** (EN-GJL-250 casting Ø250, 10.5 → 9.4 kg, family R-D)
- *Function.*
  - Belt drive 2:1.
  - Flywheel inertia ≥ 0.0758 kg·m² from M2 ch. 7. A solid disc Ø250 × 27.5 mm has 9.7 kg, so the pulley gets a
    **heavy rim**.
  - The spokes are fan blades that blow air onto the cylinders.
- *Critical.*
  - Bore Ø25 H7 with keyway 8 JS9.
  - Grooves SPA to ISO 4183, run-out 0.1.
  - Balance G6.3.
- *Route.* Lathe OP10/OP20, both sides. Keyseater OP30. Single-plane balancing OP40.

---

## 3 Product 2 – Roots blower family RB50 / RB100 / RB150

### 3.1 Function and why it suits the same factory

A Roots blower has **two lobed rotors** that turn in opposite directions in a figure-eight housing.
- **No contact:** the rotors never touch each other or the housing. The clearances are about 0.1–0.2 mm.
- **Phasing:** two **timing gears** keep the rotors in phase.
- **Transport:** air is trapped between the lobes and the housing and carried from the inlet to the outlet.
- **Compression at the outlet:** there is no internal compression. The pressure rises when the pocket opens to the
  outlet and the high-pressure air flows back into it. This is *isochoric* (external) compression.
- **Use:** wastewater aeration, pneumatic conveying and vacuum, usually at 0.3–1.0 bar differential.

**Why it fits a compressor factory.**

| Feature | Consequence for the FMS |
|---|---|
| Housing, head plates and covers are **grey-iron prismatic parts** | They run in the same HMC cell as the crankcase |
| The rotors are **rotational parts with precise journals** | They use the same lathes and grinders as the crankshaft |
| Bearings, seals and V-belt drive | Same purchasing and assembly skills |
| Test bench (flow, power, noise) | Similar to the compressor test |
| New: lobe-profile milling, two-plane balancing to G2.5, CMM profile scanning | These are the only new machine types (RMILL) |

### 3.2 Design values

| Quantity | Symbol | Value | Why |
|---|---|---|---|
| Rotor tip diameter | D | 100 mm | one cross-section for the whole family |
| Centre distance | a | 75 mm | tri-lobe: R/(a/2) = 50/37.5 = 1.33; root circle Ø50 leaves room for a Ø30 shaft |
| Lobes | z | 3 | less pulsation and noise than 2 lobes; lower area utilisation |
| Area utilisation | φ | 0.45 | share of the bore area that carries air (tri-lobe 0.43–0.48; **check with the CAD profile**) |
| Rotor length | L | 75 / 150 / 225 mm | **the only difference between the variants** |
| Speed | n | 2070 rpm | motor 2900 rpm, SPA pulleys 140/100 → ratio 1.40 |
| Clearances | | radial 0.15, end 0.10 (gear side) / 0.20 (drive side), lobe 0.20 | thermal growth + deflection (3.5) |

### 3.3 Flow (program `roots_perf`)

Each rotor carries, per revolution, the bore area that is not filled by the rotor, multiplied by the length:

$$V_{rev} = 2\,\varphi\,\frac{\pi}{4}D^2 L$$

Theoretical flow: $\dot V_{th} = V_{rev}\,n\,60$. Delivered flow: $\dot V = \dot V_{th}(1 - s)$. Here s is the
slip fraction (back-flow through the clearances); s ≈ 0.20 at 500 mbar for this size (design estimate).

**Worked example, RB100 (L = 150 mm).**

$$V_{rev} = 2\cdot0.45\cdot\frac{\pi}{4}\,100^2\cdot150 = 1.060\cdot10^6\ \text{mm}^3 = 1.060\ \text{L}$$
$$\dot V_{th} = 1.060\cdot10^{-3}\cdot2070\cdot60 = 131.7\ \text{m}^3/\text{h} \qquad \dot V = 131.7\cdot0.80 = \mathbf{105.4\ m^3/h}$$

RB50 gives 52.7 m³/h and RB150 gives 158.0 m³/h. The flow scales exactly with L, which is why the family is built on one
cross-section.

**Why the slip is important.**
- Slip grows with √Δp and with the clearances, and it does *not* fall with speed.
- At low speed the share of slip is therefore larger.
- If the radial clearance doubles, the delivered flow falls by about 10–15 %. This is why the housing bore and the rotor
  tip diameter are critical characteristics.

### 3.4 Power and motor

With isochoric compression the gas work per revolution is V·Δp. The shaft power is therefore:

$$P_{shaft} = \frac{\dot V_{th}\,\Delta p}{\eta_{mech}} = \frac{131.7/3600\cdot 50\,000}{0.90} = 2032\ \text{W}$$

Motor need: P = P_shaft / η_belt · margin = 2032 / 0.95 · 1.05 = 2246 W. **Choose 3.0 kW.** The program picks the next
IEC standard size.

| Variant | Q at 500 mbar | P_shaft | Motor need | Motor | In thesis Case 3 |
|---|---|---|---|---|---|
| RB50 | 52.7 m³/h | 1016 W | 1123 W | **1.5 kW** | 1.5 kW |
| RB100 | 105.4 m³/h | 2032 W | 2246 W | **3.0 kW** | 2.2 kW → **corrected** |
| RB150 | 158.0 m³/h | 3048 W | 3369 W | **4.0 kW** | 4.0 kW |

> **Correction to thesis Case 3.** At the full 500 mbar, RB100 needs a 3 kW motor. A 2.2 kW motor is enough only up to
> about 450 mbar. That is a legitimate catalogue choice: "RB100, 2.2 kW, max 450 mbar". Write the rating on the name
> plate.

### 3.5 Mechanical checks of the Roots blower

**Discharge temperature.** Energy balance: the gas work heats the delivered air.

$$\Delta T = \frac{\dot V_{th}\,\Delta p}{\rho\,\dot V\,c_p} = \frac{131.7\cdot 50\,000}{1.2\cdot105.4\cdot1005} = 52\ \text{K}$$

The outlet is therefore at about 72 °C with 20 °C inlet air. Pipe and silencer must suit about 100 °C.

**Thermal growth against clearance.**
- The rotor runs hotter than the housing, by about 40 K.
- Radial growth: α·ΔT·R = 11·10⁻⁶ · 40 · 50 = **0.022 mm**.
- This is well below the 0.15 mm radial clearance.
- In the axial direction the rotor grows away from the fixed bearing at the gear end. That is why the **drive-end** gap
  (0.20) is larger than the gear-end gap (0.10).

**Rotor deflection.**
- Gas force on one rotor: F = Δp·D·L. For RB150: 50 000 · 0.1 · 0.225 = 1125 N.
- Simply supported span: ≈ L + 60 = 285 mm.
- Conservative section: the root circle Ø50, so I = π·50⁴/64 = 306 796 mm⁴. E(GJS-600) = 169 000 MPa.

$$f = \frac{F\,\ell^3}{48\,E\,I} = \frac{1125\cdot285^3}{48\cdot169\,000\cdot306\,796} = 0.010\ \text{mm} \ll 0.15$$

**Bearings.**
- The rotor load is ≈ 375 N per bearing for RB100. On the drive rotor, the belt adds ≈ 400 N. Belt calculation: drive
  torque 9.4 N·m, pulley Ø100 → circumferential force 187 N, shaft load ≈ 2.1 × 187.
- NU206 has C ≈ 44 kN. L₁₀ = (C/P)³ · 10⁶ / (60 n) is far above 100 000 h.
- The bearings are therefore sized by **shaft diameter and speed, not by load**.
- Arrangement:
  - **Fixed** bearings 6206 at the gear end. They hold the small gear-side end gap and the gear mesh position.
  - **Floating** cylindrical roller bearings NU206 at the drive end. They take the belt load and allow thermal growth.

**Timing gears.**
- Helical, m_n = 1.5, z = 48 on both rotors.
- Centre distance: a = m_n·z / cos β = 72 / cos β = 75 → cos β = 0.96 → **β = 16.26°**. Pitch diameter 75 mm.
- Material: case-hardened 20MnCr5, ground to DIN 5.
- The precision sets the lobe clearance. Each 0.01 mm of backlash moves the lobe flank by about 0.013 mm.
- The torque is small (< 10 N·m), so strength is not the limit; accuracy is.
- **Bought** at the start. Later the gears can be made in-house with guide M5 / M5d.
- **Phase adjustment** uses taper clamping elements: assembly step A30 sets equal flank clearances of 0.20 mm.

**Tip speed.** π·D·n = π · 0.1 · 2070 / 60 = 10.8 m/s. Low, so noise and slip stay moderate.

### 3.6 Product structure of the RB blower

```
RB  blower
├── V10 blower stage
│   ├── V11 rotor pair         R06 drive rotor, R07 driven rotor, timing gear pair, 2× NU206, 2× 6206, seals, lock nuts, key
│   └── V12 housing group      R01 housing, R02 head plate DE, R03 head plate GE, R04 gear cover, R05 drive-end cover,
│                              dowels, bolts, sealant, sight glass, plugs, oil
└── V20 drive + package        motor, pulleys, belts, filter-silencer, outlet silencer, relief + check valve, base frame, guard
```

Machined in the FMS: **7 parts per blower**. Bought: 23 BOM lines.

### 3.7 Part cards – Roots blower

**R01 Housing** (EN-GJL-250, blank 11.0 + 0.12·L kg, family P-L, fixture FC)
- *Critical.* These decide the slip, and therefore the flow:
  - Bores Ø100.30 H7.
  - Centre distance 75 ±0.010.
  - Bores parallel within 0.01.
  - End faces parallel and perpendicular within 0.01.
  - Length L +0.10/+0.12, which sets the end gaps.
  - Dowel holes Ø8 H7: position 0.01.
- *Route.*
  - **OP10 HMC**: feet face + holes + inlet flange.
  - **OP20 HMC**, all bore-related features in one clamping:
    - End face 1, then both bores with a rough twin-cutter bar, a semi-finish bar and a fine-boring bar.
    - Dowels and threads.
    - B 180°: end face 2, its dowels and threads.
    - The outlet flange.
  - Washing. CMM 1 in 10.
- *Why the dowels are machined together with the bores.* The head plates are located by the dowels. If the dowels
  and the bores came from different clampings, the bearing bores in the head plates would not line up with the housing
  bores within 0.01.

**R02 / R03 Head plates** (EN-GJL-250, 6.6 → 5.4 kg, family P-M, fixture FC – kit with the housing)
- *Critical.*
  - Two bearing bores Ø62 at centre distance 75 ±0.008 (M6 for the floating NU206, K6 for the fixed 6206).
  - Dowel holes.
  - Bearing shoulder depth ±0.01, which sets the gear-side end gap.
- **Kit concept.** Housing and both head plates of **one blower** are machined on one tombstone (fixture C), stay
  together as a kit and are assembled together. The dowels then match by construction, and the kit gets one kit
  barcode (item F6).

**R04 Gear cover, R05 Drive-end cover** (die-cast aluminium, family P-S)
- Oil cases. Flange faces flat within 0.05. The seal bore Ø52 H8 is coaxial within 0.05.
- Small parts on the VMC (FV6).

**R06 / R07 Rotors** (EN-GJS-600-3 with integral shafts, blank 2.6 + 0.040·L kg, family R-E)
- *Why ductile iron with integral shafts.*
  - The lobes can be cast near-net (3 mm stock), which saves machining time.
  - Ductile iron has enough fatigue strength for the low shaft stresses: torque < 10 N·m, plus belt bending on R06.
  - No press fit, so no fretting.
  - The steel-shaft alternative (42CrMo4 pressed + pinned) is for higher pressures.
- *Critical.*
  - Lobe profile ±0.02.
  - Tip Ø100 −0.05.
  - Rotor length L −0.30/−0.32, which sets the end gaps.
  - Journals Ø30 k5.
  - Run-out tip to journals 0.02.
  - Balance **G2.5** in two planes. The tolerance is tighter than the compressor's G6.3 because of the higher speed and
    the small clearances.
- *Route.*
  1. Lathe OP10: centres.
  2. Turn-mill OP20: tip diameter, rotor end faces, journals, seals, gear seat, drive extension, keyway.
  3. **RMILL OP30**: lobe profile by **4-axis flank milling**.
     - The lobe surface is a straight (ruled) surface parallel to the axis.
     - So an end mill whose axis is parallel to the rotor axis cuts the 2D profile while the A-axis turns the rotor
       synchronously, in layers of 1.5·D_c axially.
  4. Grinding OP40.
  5. Balancing OP50.
  6. CMM scanning of the profile, 1 in 10.
- *Note.* An earlier attempt to model the profile as ball-nose line milling gave about 2.5 h per rotor. That is
  unrealistic: ball-nose milling is for 3D free-form surfaces, not for ruled surfaces. Choose the process to suit the
  surface type.

---

## 4 BOM structure and the CSV files

`out/bom_<variant>.csv` columns:

| Column | Meaning |
|---|---|
| level | 0 product, 1 module, 2 sub-assembly, 3 part (indented BOM) |
| parent | the assembly the item goes into |
| item | part number (C.. compressor made, R.. Roots made, B.. / Q.. bought, U.. / V.. assemblies) |
| qty | quantity per parent |
| make_buy | A assembly, M made in our FMS, B bought |
| material, blank, m_blank_kg, m_finish_kg | for made parts |
| family | group-technology family (chapter 9) |
| note | data label or supplier remark |

**Why a multi-level BOM.** MRP explodes the demand level by level:
- 3000 VC20 → 3000 U10 → 6000 U12 → 6000 cylinders.
- Assembly sequences and kits follow the same levels: U12 is pre-assembled twice per unit.

**Rule for numbering in item F6.** Part number = drawing number = barcode content root. The variant is a suffix, for
example R01-150. The serial number or lot is added for traceability.

---

## 5 Materials and blanks – what the foundry and forge need to know

| Material | Standard | Typical properties | Used for | Machining note |
|---|---|---|---|---|
| EN-GJL-250 | EN 1561 | R_m ≥ 250 MPa, HB 180–240, damping | crankcase, covers, cylinders, Roots housing, head plates, pulley | short chips, dry or MQL possible, k_c ≈ 1150 N/mm² |
| EN-GJS-600-3 | EN 1563 | R_m ≥ 600 MPa, A ≥ 3 %, HB 190–270 | Roots rotors | k_c ≈ 1700, more tool wear than GJL |
| 42CrMo4 +QT | EN ISO 683-2 (formerly EN 10083-3) | R_m 900–1100 MPa, induction hardenable | crankshaft | k_c ≈ 2100; grind after hardening |
| C45 +N | EN ISO 683-1 | R_m ≥ 620 MPa | valve plate | laser-cut blank, lapped |
| EN AC-46000 / 46200 | EN 1706 | die cast AlSi9Cu3 / AlSi8Cu3 | head, con rod, Roots covers | k_c ≈ 700; very high speeds; watch the burrs |

**Casting design rules.** Use these when you check the foundry drawings:
- **Machining allowance:** 2.5–3 mm per face for sand castings (ISO 8062-3 RMA class). Die castings have 0.5–1.5 mm.
- **Datum targets:** 3 + 2 + 1 points on the casting drawing. They must match the OP10 fixture locators (item F7).
- **Uniform wall thickness:** 6–8 mm for GJL. Fillet radii ≥ wall/3, to avoid shrinkage porosity at the bearing bosses.
- **Cores:** the crank chamber of C01 and the figure-eight bore of R01 are cored. Core shift of ±1 mm must be inside the
  allowance.
- **Stress relief:** for the crankcase and the Roots housing, at about 550 °C or by vibration, *before* machining.
  Otherwise the bores move after OP20.

**Mass balance per unit** (blank → finished; the chips go to the briquetting press, item F11):

| Product | Blank | Finished | Chips |
|---|---|---|---|
| VC20 | 48.0 kg | 40.8 kg | 7.2 kg |
| RB50 | 47.9 kg | 40.0 kg | 7.9 kg |
| RB100 | 62.9 kg | 52.8 kg | 10.2 kg |
| RB150 | 77.9 kg | 65.5 kg | 12.4 kg |

---

## 6 Make or buy

**Method.** A weighted decision matrix (M1 `dm_toolkit.py decision_matrix`) with these criteria:
1. Core competence and secrets: the precision that decides the product performance.
2. Capacity and investment.
3. Cost per piece, make against buy, including logistics.
4. Supplier market in the country: is there a capable supplier at all?
5. Quality risk.

**Result of this item** (design decision, review it with Kenzo's purchasing):

| Item | Decision | Main reason |
|---|---|---|
| Crankcase, cylinders, heads, valve plates, covers, con rods, flywheel | **make** | they decide FAD and noise; core of the factory |
| Crankshaft | **make** (machining), forging bought | pin accuracy + hardness decide the life; the turn-mill and grinder are shared with the Roots rotors |
| Roots housing, head plates, covers, rotors | **make** | clearances 0.01–0.02 decide the slip = performance |
| Pistons, rings, pins, reed valves | **buy** | specialist processes (piston casting + CNC oval turning, valve steel strip) |
| Bearings, seals, fasteners, filters, valves, gauges | **buy** | standard parts |
| Timing gears | **buy now**, make later | gear grinding is a separate competence; M5 / M5d prepare it |
| Motor, receiver (PED), base frames, guards | **buy** (or own sheet-metal shop) | outside the machining FMS; the tank needs PED-qualified welding |

---

## 7 Process planning rules used in the routings

These are the rules that produced every operation in `products.json`. Use them when you add a part.

1. **Datum first.** OP10 machines the datum faces and holes, for example the crankcase base and feet holes. All later
   operations locate on them (3-2-1 principle; item F7).
2. **Related features in one clamping.** Features with a tight relation (coaxiality, position, parallelism ≤ 0.02) are
   finished in the same clamping. Examples:
   - both crankcase bearing seats;
   - housing bores + dowels;
   - con-rod big and small ends with the cap assembled.
3. **Rough before finish, hot before cold.** Rough boring before fine boring. Hardening before grinding. Stress relief
   before machining.
4. **Small parts in multiples.** Covers, heads, valve plates and con rods are clamped 4–6 per fixture on a VMC. This
   shares the load time and reduces tool changes per part.
5. **Machine type by part family.**
   - Large and complex prismatic parts → HMC with pallet changer, in the FMS cell.
   - Small prismatic parts → VMC.
   - Rotational parts → lathe or turn-mill + grinder.
   - Special processes (honing, lapping, rotor profile, balancing) → dedicated machines.
6. **Alternatives.** Every operation lists its alternative machine types (`alt`). Item F2 uses them for load balancing
   and robustness. After the F2 design review, only *real* alternatives remain:
   - lathe ↔ turn-mill (C07 OP10, C09, R06/R07 OP10/OP20);
   - keyseater ↔ turn-mill (C09 OP30).

   Three alternatives were removed:

   | Removed alternative | Why |
   |---|---|
   | HMC for rotor profile milling | The HMC B-axis turns about a vertical axis, so it cannot rotate a rotor about its own axis synchronously |
   | VMC for OP10 of the crankcase and of the head plates | Tombstone parts stay complete in the HMC cell: one datum chain, one-in-one-out, no extra transport |
   | HMC for the small parts | Small parts would need their own pallet class in the cell |

   An alternative is only an alternative if the machine can hold the part, reach the features and keep the tolerance.
   Otherwise the optimiser "saves" machines that do not exist (guide 59, chapter 5).
7. **Inspection placed where the risk arises.**
   - In-process gauges for honing and grinding.
   - CMM sampling after the critical clampings.
   - 100 % mass grading for con rods.

---

## 8 Machining time – the formulas (program `feature_time`, `op_time`)

The time of an operation is:

$$t_{op} = t_{probe} + \sum_{features}\left(t_{cut,i} + t_{pos,i}\right) + N_{tool\ changes}\cdot t_{tc}$$

The spindle speed always comes from the cutting speed, $n = \dfrac{1000\,v_c}{\pi D}$, capped at the machine n_max.

### 8.1 Face milling

$$v_f = f_z\,z\,n \qquad \text{rows} = \left\lceil\frac{W}{0.7\,D_c}\right\rceil \qquad \text{layers} = \left\lceil\frac{\text{stock}}{a_p}\right\rceil \qquad t = \frac{\text{rows}\cdot\text{layers}\cdot(L + D_c)}{v_f}$$

- 0.7·D_c is the step-over. A width of cut of 70 % of the cutter is the usual compromise between chip thickness and
  number of rows.
- (L + D_c) includes the run-in and run-out of the cutter.

**Worked example – crankcase OP10 base face** (program `part C01`). Face 180 × 220 mm, stock 3 mm, FM100 with z = 7, GJL:
v_c = 240, f_z = 0.18, a_p = 2.5.

| Step | Calculation | Value |
|---|---|---|
| n | 1000 · 240 / (π · 100) | 763.9 rpm |
| v_f | 0.18 · 7 · 763.9 | 962.5 mm/min |
| rows | ⌈180 / 70⌉ | 3 |
| layers | ⌈3 / 2.5⌉ | 2 |
| t | 3 · 2 · (220 + 100) / 962.5 | 1.995 min = **119.7 s** |
| P_c | a_p · a_e · v_f · k_c / 60·10⁶ = 2.5 · 70 · 962.5 · 1150 / 6·10⁷ | 3.2 kW |

The program prints `face x1 cut 119.7 s … Pc 3.2 kW n=764 vf=963 rows=3 layers=2`. That is the same.

**Improvement you can see at once.**
- The 3 mm stock needs 2 layers with a_p 2.5. With a casting allowance of 2.5 mm, or a_p = 3 (possible on GJL with
  stable fixtures), one layer is enough and the time halves.
- **The casting allowance is a machining-time decision.** Agree it with the foundry.

### 8.2 Contour, slot, pocket

- **Contour:** layers = ⌈depth/D_c⌉; passes = ⌈stock/(0.3 D_c)⌉ + 1; t = P · layers · passes / v_f. The radial width
  is 30 % for roughing, plus one finish pass.
- **Slot (full width):** layers = ⌈depth/(0.5 D_c)⌉; t = L · layers / (0.7 v_f). Full engagement → feed −30 %.
- **Pocket:** Q = a_p · a_e · v_f with a_p = a_e = 0.5 D_c; t = V/Q.

### 8.3 Roots lobe: 4-axis flank milling ("surface")

$$\text{layers} = \left\lceil\frac{L}{1.5\,D_c}\right\rceil \qquad t = \frac{\text{perimeter}\cdot\text{layers}\cdot\left(\lceil \text{stock}/(0.3D_c)\rceil / v_{f,r} + 1/v_{f,f}\right)}{0.6}$$

The factor 0.6 accounts for the slower feed when the A-axis interpolates together with the linear axes; this is a
design estimate. Calibrate it with the first CAM simulation.

**RB100 rotor:**
- 5 layers, 1 rough pass, v_f,r = 668 mm/min, finish v_f,f = 561 mm/min.
- t = 330 · 5 · (1/668 + 1/561) / 0.6 = **540.7 s** (9.0 min).
- With non-cutting time: 9.46 min per rotor.

### 8.4 Drilling, tapping, boring, turning, grinding, honing

| Feature | Formula | Example (from the program) |
|---|---|---|
| Drilling | t = n_h (H + 0.3 D) / (f n) | crankcase 4 × Ø11 H20: n = 2894, t = 4 · 23.3 / (0.25 · 2894) min = **7.7 s** |
| Tapping | t = n_h · 2(H + 2P) / (P n) | 8 × M8 H16: n = 597, t = 8 · 2 · 18.5 / (1.25 · 597) min = **23.8 s** |
| Boring | t = n_b (H + 2) / (f z n), z = 2 for the twin-cutter rough bar | crankcase Ø80 finish × 2, H10: n = 716, t = 2 · 12 / (0.10 · 716) min = **20.1 s** |
| Turning | passes = ⌈stock / a_p⌉; t = passes (L+2)/(f_r n_r) + (L+2)/(f_f n_f) | crankshaft journals Ø30.4 × 22 × 2: **18.7 s** |
| Orbital pin turning | turning time × 3 (C-X synchronisation) | crank pin: **49.1 s** |
| Grinding (plunge) | t = n (stock / v_r · 60 + spark) + dress | 3 diameters Ø30, stock 0.4: 3 · (20 + 8) = **84 s** |
| Honing | t = stock / rate + t_fix | Ø70, 0.075 mm: 50 + 15 = **65 s** |

### 8.5 Non-cutting time and load time

| Element | HMC | VMC | Lathe / TMILL | Meaning |
|---|---|---|---|---|
| t_probe | 15 s | 10 s | 0 / 10 s | workpiece probing per operation (datum check) |
| t_tc | 4 s | 3 s | 1 / 1.5 s | chip-to-chip tool change |
| t_feat | 3 s | 2.5 s | 2 s | rapid to the feature, approach |
| t_hole | 1.2 s | 1.0 s | 1.5 s | each additional hole of the same feature |
| t_index | 2 s | 2 s | 2 s | each repetition on another face (B-axis index) |

**Crankcase OP20 example.** Cutting 356.7 s, non-cutting 178.2 s, 16 tool changes. Non-cutting time is **33 %** of the
operation. This is typical for parts with many small threads.

**Two levers:**
- **Combination tools:** drill + countersink, or drill-thread mill. One tool for the hole and the thread removes up to
  6 tool changes in OP20.
- **Faster tool changers**, below 2 s. This is a purchase specification item for F2.

**Load time at the load station** (FMS pallets, program `load_model`):

$$t_{load} = 25 + 8\cdot\text{clamps} + (20\ \text{if}\ m > 15\ \text{kg}) + 10\ \text{(clean)}\quad[\text{s}]$$

- Crankcase: 25 + 3·8 + 20 + 10 = 79 s.
- Roots housing (2 clamps): 25 + 16 + 20 + 10 = 71 s.
- It is *not* machine time: the HMC keeps working because of the pallet changer. But it loads the load station. That was
  the bottleneck in the thesis cell analysis (ceiling 24.5 parts/h; guide 54).

### 8.6 Accuracy and how to calibrate

| Source of error | Typical size | How to reduce it |
|---|---|---|
| Cutting values (catalogue middle) | ±20 % | tool supplier's recommendation for the actual grade + test cut |
| Feature simplification (paths) | ±15 % | CAM simulation (NX CAM) of the real program |
| Non-cutting elements | ±30 % | stopwatch / machine log of the first parts |
| Acceleration of the axes (short moves) | +5 to +15 % | CAM with machine kinematics, or measured |

The expected total accuracy is **±25 %**, enough for machine counts and layout in item F2. Final NC times come from CAM
and trials.

**Bayesian calibration.**
- The doctoral twin (thesis ch. 6) updates each cycle time with a Normal-Inverse-Gamma model, starting from these values
  as the **prior**.
- After about 20–30 real cycles, the posterior is dominated by the measurements.
- **F1 is therefore the prior of the twin.** This is the link between the final thesis and the earlier editions.

---

## 9 Part families and machine minutes – the bridge to item F2

### 9.1 Family code (group technology, simplified Opitz idea)

| Family | Meaning | Parts | Machine group |
|---|---|---|---|
| **P-L** | prismatic, large (> 10 kg) | C01 crankcase, R01 housing | HMC cell, tombstone fixtures FA / FC |
| **P-M** | prismatic, medium (2–10 kg) | C04 cylinder, R02/R03 head plates | HMC (head plates in kit) / VMC + HONE (cylinder) |
| **P-S** | prismatic, small (< 2 kg) | C02, C03, C05, R04, R05 | VMC multi-part fixtures |
| **P-F** | flat / thin, precise | C06 valve plate, C08 con rod | VMC + LAP / grading |
| **R-E** | rotational, eccentric or profiled | C07 crankshaft, R06/R07 rotors | LATHE + TMILL (+RMILL) + GRIND + BAL |
| **R-D** | rotational, disc | C09 flywheel pulley | LATHE + KEYS + BAL |

**The main design insight for the combined FMS.** The two products share families:
- P-L: the crankcase and the Roots housing are both large grey-iron parts on tombstones, so they share the HMC cell.
- R-E: the crankshaft and the rotors are both precise shafts that are turned, ground and balanced, so they share the
  rotational cell.

Only the RMILL rotor profile machine is product-specific. This is the technical reason why a **combined** FMS is
cheaper than two separate factories, and item F2 will quantify it.

### 9.2 Machine minutes per product unit (program `minutes`)

| Machine type | VC20 | RB50 | RB100 | RB150 |
|---|---|---|---|---|
| HMC | 11.93 | 30.79 | 36.06 | 41.34 |
| VMC | 27.61 | 3.77 | 3.77 | 3.77 |
| LATHE | 8.99 | 0.79 | 0.79 | 0.79 |
| TMILL | 2.64 | 7.77 | 10.72 | 13.67 |
| RMILL | – | 11.71 | 18.92 | 29.74 |
| GRIND | 1.98 | 3.68 | 3.68 | 3.68 |
| HONE | 2.30 | – | – | – |
| LAP | 1.67 | – | – | – |
| IHARD | 1.25 | – | – | – |
| BAL | 2.83 | 5.00 | 5.00 | 5.00 |
| KEYS | 0.92 | – | – | – |
| WASH | 1.53 | 2.17 | 2.17 | 2.17 |
| CMM | 0.75 | 4.50 | 4.50 | 4.50 |
| ASSY | 31.0 | 37.0 | 37.0 | 37.0 |
| TEST | 25.0 | 30.0 | 30.0 | 30.0 |
| PAINT | 2.0 | 5.0 | 5.0 | 5.0 |
| PACK | 5.0 | 5.0 | 5.0 | 5.0 |
| Load station (HMC pallets) | 2.63 | 5.77 | 5.77 | 5.77 |

**First reading, before item F2.**

**1. Assembly and test dominate the VC20.**
- 56 min per unit, against 64 min of all machining together.
- At 3000 units per month that is 2800 h, i.e. about 9–10 assembly/test workplaces at 330 h per month.
- Assembly and test lines therefore deserve their own item, F10.

**2. One RB100 loads the HMC like three VC20.**
- 36.1 against 11.9 min.
- 400 blowers per month need about 240 h of HMC time; 3000 VC20 need about 600 h.
- Both together come to 831.7 h, i.e. 2.97 HMCs at 330 h and OEE 0.85.
- With the 90 % planning ceiling, item F2 chooses **4 HMCs**.

**3. The VMC is the largest machining load for the VC20** (27.6 min: covers, 2 cylinders, 2 heads, 2 valve plates, 2 con
rods).
- At 3000 units per month that is 1380 h.
- That means about 5 VMCs at 330 h and OEE 0.85.
- It needs its own small-part cell, and it is the first candidate for optimisation in F2: multi-part fixtures, combination
  tools, or moving the cylinders to the HMC.

**4. The RMILL scales with L.**
- RB150 needs 29.7 min, against 11.7 min for RB50.
- With a mix of 20 % RB150 it is still a single machine.

### 9.3 Comparison with earlier numbers in the project

| Value | Earlier source | F1 | Comment |
|---|---|---|---|
| VC20 cylinder bore | Ø80 in `fmsctl/spec/tooling.py`, Ø52 in doc 62 (teaching example) | **Ø70** | from the crank design V3 – update the tool list in item F9 |
| VC20 motor | 4 kW (`config/factory.json`) | **3 kW** (84 % load) | see 2.2 |
| RB100 motor | 2.2 kW (thesis Case 3) | **3 kW** at 500 mbar | see 3.4 |
| Crankcase HMC time | 36 min (doc 62, teaching example) | **12.4 min** (OP10 + OP20) | doc 62 was a generic example; F1 is feature-based |
| Roots housing + head plates | Case 3 kit on fixture C | same kit concept, 40 min HMC (RB100) | consistent |

---

## 10 Quality plan – critical characteristics (CTQ) and how they are secured

| CTQ | Part | Tolerance | Process capability needed | Control |
|---|---|---|---|---|
| Bearing seats coaxial | C01 | 0.02 | Cpk ≥ 1.33 | CMM sampling 1/20 + first/last part |
| TDC chain | C01, C04, C08, C07 | ±0.05 … ±0.03 | Cpk ≥ 1.33 per element | in-machine probe; selective gasket at A30 |
| Cylinder bore + plateau | C04 | H7, Rk ≤ 0.5 | Cpk ≥ 1.67 (diameter) | air gauge 100 %, roughness 1/shift |
| Valve seat flatness | C06 | 0.005 | – | optical flat 1/batch |
| Pin hardness + diameter | C07 | 50–55 HRC, −0.007/−0.020 | Cpk ≥ 1.33 | hardness 1/batch, in-process gauge 100 % |
| Balance | C07, C09, R06/R07 | G6.3 / G2.5 | 100 % | balancing machine log |
| Housing bores + centre distance | R01 | H7, ±0.010 | Cpk ≥ 1.67 | CMM 1/10 + SPC chart |
| Rotor profile + tip | R06/R07 | ±0.02, −0.05 | Cpk ≥ 1.33 | CMM scanning 1/10 |
| Final performance | VC20, RB | FAD ≥ 20.0 m³/h; Q ≥ 95 % of rated | 100 % test | test bench, item F10 |

**Cpk definition.** Cpk = min(USL − μ, μ − LSL) / (3σ). 1.33 means the nearest limit is 4σ away; 1.67 means 5σ. Ask
for these values in the machine acceptance test (item F12) on 50 parts.

---

## 11 Checklists

**Before you accept the product data for FMS design (F2):**
- [ ] `products.py selftest` → SELFTEST PASS.
- [ ] Dimension chains closed: the TDC gap of the compressor, and the end gaps of the Roots blower (housing length −
  rotor length = 0.30).
- [ ] Every made part has material, blank, mass, family, fixture, CTQs and at least one operation.
- [ ] Every operation has a machine type and its alternatives.
- [ ] Casting allowances agreed with the foundry (they change the times).
- [ ] Make-or-buy reviewed by purchasing.
- [ ] Times of the 3 biggest operations cross-checked with CAM: C01 OP20, R01 OP20, R06 OP30.

**When you add a new part or product:**
1. Add the part to `products.json`: id, parent, qty, material class, masses, family, CTQs.
2. Write the operations with features, following the planning rules of chapter 7.
3. `python products.py part <id>`: read the sheet and check the plausibility of every line.
4. `selftest` and `run`. Item F2 reads `out/machine_minutes.csv`.

---

## 12 Limits of this item and what to do next with real data

- **Cutting values are catalogue middle values.**
  - Replace them with your tool supplier's data.
  - When the machines run, the twin learns the real times (Bayesian, 8.6).
- **No CAM yet.** The feature lists are simplified (no exact tool paths, no acceleration limits).
- **The Roots profile is not designed here.**
  - φ = 0.45 is an estimate.
  - Design the real epicycloid/involute tri-lobe profile, compute its area in CAD, and update φ, the flow and the
    perimeter. 330 mm is an estimate of the profile length.
- **Assembly and test times** are planning values, roughly in the MTM range, not an MTM analysis. Item F10 will break them
  down.
- **Prices are not included.** Item F2 adds costs and investment, using reference estimates until quotations exist.

---

## 13 Standards and references used in this item

| Standard | Topic |
|---|---|
| ISO 1217 | displacement compressors – acceptance tests (Annex C/E: FAD of electrically driven packaged units) |
| ISO 21940-11 | rotor balancing – balance quality grades G |
| ISO 286-1/-2 | ISO tolerance system (H7, k5, M6 …) |
| ISO 8062-3 | casting tolerances and machining allowances |
| ISO 16232 | cleanliness of components (residual dirt) |
| ISO 4183, ISO 4184 | V-belt grooves and lengths (SPA) |
| DIN 3760 / ISO 6194 | radial shaft seals |
| EN 1561, EN 1563, EN 1706, EN ISO 683-1/-2 | grey iron, ductile iron, aluminium casting alloys, heat-treatable steels |
| EN 286-1, Directive 2014/29/EU (simple pressure vessels) / 2014/68/EU (PED) | air receiver |
| EN ISO 4126-1 | safety valves |
| Machinery Directive 2006/42/EC (Machinery Regulation (EU) 2023/1230 from 2027) | CE marking of compressor and blower |
| ISO 20816-3 (replaces ISO 10816-3) | vibration evaluation |
| ISO 2151 | noise test code for compressors and vacuum pumps |
| IEC 60034-30-1 | motor efficiency classes (IE3) |

**Textbooks** (for the theory, available in libraries):
- Bloch, H.P., *A Practical Guide to Compressor Technology*, 2nd ed., Wiley, 2006: piston and Roots machines.
- Groover, M.P., *Automation, Production Systems, and Computer-Integrated Manufacturing*, Pearson: P-Q-R-S-T, GT,
  FMS.
- Sandvik Coromant, *Metal cutting technology – technical guide*: cutting data and formulas.
- Kalpakjian, S., Schmid, S., *Manufacturing Engineering and Technology*, Pearson: casting allowances, grinding,
  honing.

---

**Next item: F2.** It covers the production programme and the optimised design of the combined FMS: machine counts,
cells, pallets, fixtures, buffers, layout, investment, robustness and simulation. Its input is `out/machine_minutes.csv`
plus the programme table in `thesis_final/00_final_thesis_plan.md` §4.
