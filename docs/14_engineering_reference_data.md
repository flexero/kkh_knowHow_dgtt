# 14 – Engineering reference data book

This is the **shared reference book** for the project. The other guides (01–13) use the numbers in this
book when they need a generic table: material strength, fits, bolt torque, roughness, welding, cutting
data, hydraulics, cables, safety distances.

> **Important – read before you use any value.**
> - The values here are **reference values from standards and well-known engineering handbooks** – not the
>   "example values" of the twin pages. They are good for design and for the workshop, **but the binding
>   value is always the one in the current edition of the standard, the mill certificate (EN 10204 3.1) of
>   your material, or the catalogue of your supplier.**
> - Every table says its **source type** and its **condition** (size range, heat treatment condition,
>   temperature). A value is only valid inside that condition.
> - Where sources do not agree, a **range** is given. For safety-relevant design use the unfavourable end
>   of the range.
> - Standards are revised. If a standard edition is named, check that it is still the current one.

---

## Contents

1. [How to use this book](#1-how-to-use-this-book)
2. [Units, conversions, constants](#2-units-conversions-constants)
3. [Materials](#3-materials)
4. [Heat treatment and hardness](#4-heat-treatment-and-hardness)
5. [ISO 286 fits](#5-iso-286-limits-and-fits)
6. [General tolerances, welding tolerances, geometric tolerances](#6-general-tolerances-welding-tolerances-geometric-tolerances)
7. [Surface roughness](#7-surface-roughness)
8. [Bolted joints and pins](#8-bolted-joints-and-pins)
9. [Welding](#9-welding)
10. [Machining data](#10-machining-data)
11. [Bearings, keys, shafts, circlips](#11-bearings-keys-shafts-circlips)
12. [Springs, friction, rolling resistance](#12-springs-friction-rolling-resistance)
13. [Hydraulics and pneumatics](#13-hydraulics-and-pneumatics)
14. [Electrical](#14-electrical)
15. [Measurement](#15-measurement)
16. [Safety numbers](#16-safety-numbers)
17. [Glossary](#17-glossary)

---

## 1. How to use this book

### 1.1 Rules

1. **Find the table, then check the condition line.** Example: the strength of 42CrMo4 depends on the
   diameter. A Ø 30 bar has Rp0.2 ≥ 750 MPa, a Ø 120 bar only ≥ 550 MPa.
2. **Use minimum values for strength calculations.** Standards give minimum values (Rp0.2 min, Rm min).
   The real material is usually stronger, but you may not count on it.
3. **Use a safety factor** on top of the minimum value (see 1.2).
4. **Write the source on your drawing or calculation**, e.g. "42CrMo4+QT, EN 10083-3, Ø 40–100".
5. **Order with a certificate.** For load-carrying parts order material with an inspection certificate
   EN 10204 – 3.1. Keep it with the part record (traceability, guide 13).
6. **Measure at 20 °C** (ISO 1). All dimensions and tolerances in this book are for 20 °C.

### 1.2 Typical safety factors (orientation)

Source type: common machine design practice (e.g. Roloff/Matek, Decker, Shigley). Your company or the
applicable product standard may require other values.

| Case | Safety factor S | Applied to |
|---|---|---|
| Static load, ductile steel, loads known well | 1.5 – 2.0 | Rp0.2 (yield) |
| Static load, cast iron EN-GJL (brittle) | 2.5 – 4 | Rm (tensile strength) |
| Fatigue (alternating load), steel | 1.5 – 2.5 | fatigue strength of the part (with notch factor) |
| Buckling (cylinder rod, column) | 3 – 5 | Euler load |
| Lifting / load handling parts | per standard (e.g. EN 13155, EN 1493) | – |
| Bolts (preloaded) | per VDI 2230 (see chapter 8) | – |

Allowed stress: **σ_allow = R / S**. Example: S355J2, t = 20 mm, static: σ_allow = 345 / 1.5 = 230 MPa.

### 1.3 Symbols used in this book

| Symbol | Meaning | Unit |
|---|---|---|
| Rm | tensile strength | MPa = N/mm² |
| Rp0.2 / ReH | yield strength (0.2 % proof stress / upper yield strength) | MPa |
| A | elongation at break | % |
| E | Young's modulus (elastic modulus) | GPa = 1000 N/mm² |
| G | shear modulus | GPa |
| ν | Poisson's ratio | – |
| α | coefficient of linear thermal expansion | 10⁻⁶ /K (= µm per m per K) |
| ρ | density | kg/dm³ = g/cm³ |
| HB, HV, HRC | hardness Brinell, Vickers, Rockwell C | – |
| IT | ISO tolerance grade | µm |

---

## 2. Units, conversions, constants

### 2.1 SI base and derived units used in the project

| Quantity | Unit | Note |
|---|---|---|
| Length | mm (drawings), m (layout) | 1 µm = 0.001 mm |
| Force | N, kN | |
| Torque | N·m | |
| Stress, pressure | MPa = N/mm²; bar | 1 MPa = 10 bar |
| Power | W, kW | |
| Mass | kg, t | |
| Temperature | °C; K for differences | ΔT of 1 K = 1 °C |
| Angle | ° ; arc second ″ | 1° = 3600″; 1″ = 4.848 µrad |
| Speed (rotation) | min⁻¹ (rpm) | ω [rad/s] = 2π·n/60 |

### 2.2 Constants

| Constant | Value | Source |
|---|---|---|
| Standard gravity g | 9.80665 m/s² (use 9.81) | ISO 80000-3 / CGPM |
| Standard atmospheric pressure | 101 325 Pa = 1.01325 bar | ISO 2533 |
| Reference temperature for dimensions | 20 °C | ISO 1 |
| Density of air (20 °C, 1.013 bar) | 1.20 kg/m³ | physics tables |
| Resistivity of copper at 20 °C | 0.0172–0.0178 Ω·mm²/m (use 0.0178 for cables) | IEC 60228 basis / tables |
| Conductivity of copper (20 °C) | 56–58 m/(Ω·mm²) | |
| Temperature coefficient of copper resistance | 0.00393 /K | |

### 2.3 Conversions

| From | To | Factor (exact where marked *) |
|---|---|---|
| 1 kgf (kilogram-force) | N | 9.80665 * |
| 1 kgf·m | N·m | 9.80665 * |
| 1 kgf/mm² | MPa | 9.80665 * |
| 1 kgf/cm² (at) | bar | 0.980665 * |
| 1 bar | MPa / psi | 0.1 * / 14.5038 |
| 1 psi (lbf/in²) | bar / kPa | 0.0689476 / 6.89476 |
| 1 ksi | MPa | 6.89476 |
| 1 in | mm | 25.4 * |
| 1 ft | mm | 304.8 * |
| 1 lb (pound mass) | kg | 0.45359237 * |
| 1 lbf | N | 4.44822 |
| 1 lbf·ft | N·m | 1.35582 |
| 1 lbf·in | N·m | 0.112985 |
| 1 hp (mechanical, US) | W | 745.70 |
| 1 PS (metric horsepower) | W | 735.499 |
| 1 kWh | MJ | 3.6 * |
| 1 US gallon | litre | 3.78541 |
| 1 cSt (centistokes) | mm²/s | 1 * |
| °F | °C | °C = (°F − 32) / 1.8 |
| 1 mil (thou) | µm | 25.4 * |
| 1 l/min | m³/s | 1/60 000 |

**Pressure × area quick rule:** 1 bar on 1 cm² = 10 N. Example: 100 bar on a Ø 63 cylinder
(A = 31.17 cm²) → F = 100 · 31.17 · 10 = 31 170 N ≈ 31.2 kN.

### 2.4 Physical properties of material groups (room temperature)

Source type: typical values from engineering handbooks and material standards (EN 1561, EN 1563,
EN 573/485, EN 1982, supplier data sheets). Values depend on the exact alloy – ranges are given.

| Material group | ρ [kg/dm³] | E [GPa] | G [GPa] | ν | α [10⁻⁶/K] (20–100 °C) |
|---|---|---|---|---|---|
| Carbon and low-alloy steel | 7.85 | 205 – 212 (use 210) | 79 – 81 (use 81) | 0.30 | 11 – 12.5 (use 11.5) |
| Austenitic stainless steel (1.4301) | 7.90 | 193 – 200 | 74 – 77 | 0.30 | 16.0 |
| Grey cast iron EN-GJL-250 | 7.2 | 103 – 118 | 41 – 48 | 0.26 | 10 – 11 |
| Grey cast iron EN-GJL-300 | 7.25 | 108 – 137 | 44 – 54 | 0.26 | 10 – 11 |
| Ductile iron EN-GJS-400-15 | 7.1 | 169 | 66 | 0.275 | 12.5 |
| Ductile iron EN-GJS-600-3 | 7.2 | 174 | 67 | 0.275 | 12.5 |
| Aluminium wrought alloys (6082, 5083, 7075) | 2.66 – 2.81 | 69 – 72 | 26 – 27 | 0.33 | 23 – 24 |
| Tin bronze (CuSn12) | 8.6 – 8.8 | 90 – 105 | ≈ 36 – 40 | 0.34 | 18 – 18.5 |
| Aluminium bronze (CuAl10Fe5Ni5) | 7.5 – 7.7 | 115 – 125 | ≈ 43 – 46 | 0.32 | 16 – 17 |
| Brass (CuZn39Pb3) | 8.4 – 8.5 | 95 – 100 | ≈ 36 – 38 | 0.35 | 20 – 21 |
| Copper (Cu-ETP) | 8.93 | 115 – 130 | 44 – 48 | 0.34 | 17 |
| Polyurethane PU 90–95 Shore A | 1.1 – 1.25 | 0.02 – 0.08 (non-linear!) | – | 0.45 – 0.5 | 100 – 200 |
| PA6 (dry / conditioned) | 1.13 – 1.14 | 2.5 – 3.2 / 1.0 – 1.5 | – | 0.39 | 80 – 100 |
| POM-C | 1.41 | 2.6 – 3.1 | – | 0.35 | 100 – 120 |
| PE-UHMW | 0.93 – 0.94 | 0.6 – 0.8 | – | 0.46 | 150 – 200 |
| Concrete (floor) | 2.3 – 2.4 | 25 – 35 | – | 0.2 | 10 – 12 |
| Hydraulic oil (mineral) | 0.86 – 0.88 | bulk modulus K ≈ 1.4 – 1.8 GPa | – | – | – |
| Water | 1.00 | bulk modulus K ≈ 2.2 GPa | – | – | – |

Relation: **G = E / (2·(1 + ν))**. Steel: 210 / (2 · 1.3) = 80.8 GPa.

**Thermal expansion:** ΔL = α · L · ΔT.
Example: steel table Ø 800 mm, warms by 5 K: ΔL = 11.5·10⁻⁶ · 800 · 5 = 0.046 mm.
Same for an aluminium part: 23·10⁻⁶ · 800 · 5 = 0.092 mm.

### 2.5 Hardness scales – what they are

| Scale | Test | Use | Valid range (orientation) |
|---|---|---|---|
| HBW (Brinell, ISO 6506) | hard-metal ball, measure diameter of print | soft steel, cast iron, bronze, aluminium | up to 650 HBW |
| HV (Vickers, ISO 6507) | diamond pyramid, measure diagonal | all metals, thin layers, case depth profiles (HV1, HV0.5) | whole range |
| HRC (Rockwell C, ISO 6508) | diamond cone, measure depth | hardened steel | 20 – 70 HRC |
| HRB (Rockwell B) | steel/hard-metal ball | soft steel, brass | 20 – 100 HRB |
| Shore A / D (ISO 868, ISO 48-4) | spring indenter | elastomers (A), hard plastics (D) | PU 90 A ≈ 40 D; PU 95 A ≈ 48 – 50 D (approx.) |

Conversion between scales: see 4.8 (approximate only).

---

## 3. Materials

**How to read the tables:** values are **minimum values** unless a range is given. "+N" = normalised,
"+QT" = quenched and tempered, "+A" = soft annealed. Thickness/diameter = the ruling section of the
semi-finished product (not of the finished part).

### 3.1 Structural steels – EN 10025-2 (hot-rolled, as delivered)

Source: values per EN 10025-2 (minimum values; check the mill certificate).

| Steel (number) | Thickness t [mm] | ReH min [MPa] | Rm [MPa] | A min [%] | Impact | Weldability |
|---|---|---|---|---|---|---|
| S235JR (1.0038) | t ≤ 16 | 235 | 360 – 510 | 26 | 27 J at +20 °C | very good |
| | 16 < t ≤ 40 | 225 | 360 – 510 | 26 | | |
| | 40 < t ≤ 63 | 215 | 360 – 510 | 25 | | |
| | 63 < t ≤ 80 | 215 | 360 – 510 | 24 | | |
| S355J2 (1.0577) | t ≤ 16 | 355 | 470 – 630 | 22 | 27 J at −20 °C | very good (CEV max ≈ 0.45 – 0.47 depending on t) |
| | 16 < t ≤ 40 | 345 | 470 – 630 | 22 | | |
| | 40 < t ≤ 63 | 335 | 470 – 630 | 21 | | |
| | 63 < t ≤ 80 | 325 | 470 – 630 | 20 | | |
| | 80 < t ≤ 100 | 315 | 470 – 630 | 20 | | |

A values above are for longitudinal test pieces; transverse values are about 2 % lower (see the standard).

| Steel | Hardness (typical, not specified) | Machinability | Typical use in this project |
|---|---|---|---|
| S235JR | ≈ 110 – 150 HB | good, long chips, smears on fine finish | guards, brackets, sheet-metal covers, cable trays, non-critical frames |
| S355J2 | ≈ 140 – 190 HB | good | welded frames (APC base, AGV chassis, docking stands, AS/RS front end), base plates, brackets (most used steel of guides 09–11) |

**Rule:** welded frames that must hold accuracy → weld, **stress relieve** (4.2), then machine.

### 3.2 Quenched and tempered steels – EN ISO 683-1 / -2 (former EN 10083-2 / -3)

Source: values per EN 10083-2 / EN 10083-3 (now EN ISO 683-1 / 683-2), +QT condition, longitudinal,
minimum values. Check the mill certificate. "d" = diameter of round bar (for flats see the standard,
the ruling section is different).

**C45 (1.0503)** – unalloyed

| Condition | d [mm] | Rp0.2 / Re min [MPa] | Rm [MPa] | A min [%] |
|---|---|---|---|---|
| +N | d ≤ 16 | 340 | ≥ 620 | 14 |
| +N | 16 < d ≤ 100 | 305 | ≥ 580 | 16 |
| +N | 100 < d ≤ 250 | 275 | ≥ 560 | 16 |
| +QT | d ≤ 16 | 490 | 700 – 850 | 14 |
| +QT | 16 < d ≤ 40 | 430 | 650 – 800 | 16 |
| +QT | 40 < d ≤ 100 | 370 | 630 – 780 | 17 |

C45 hardens only in a thin layer in big sections (low hardenability): above about d = 100 the +QT gain is small.

**42CrMo4 (1.7225)** – the most used QT steel

| Condition | d [mm] | Rp0.2 min [MPa] | Rm [MPa] | A min [%] | Hardness (approx., from Rm) |
|---|---|---|---|---|---|
| +QT | d ≤ 16 | 900 | 1100 – 1300 | 10 | ≈ 330 – 390 HB |
| +QT | 16 < d ≤ 40 | 750 | 1000 – 1200 | 11 | ≈ 300 – 360 HB |
| +QT | 40 < d ≤ 100 | 650 | 900 – 1100 | 12 | ≈ 270 – 330 HB |
| +QT | 100 < d ≤ 160 | 550 | 800 – 950 | 13 | ≈ 240 – 285 HB |
| +QT | 160 < d ≤ 250 | 500 | 750 – 900 | 14 | ≈ 225 – 270 HB |
| +A | – | – | – | – | ≤ 241 HB |

**34CrNiMo6 (1.6582)** – for big sections with high strength (better through-hardening than 42CrMo4)

| Condition | d [mm] | Rp0.2 min [MPa] | Rm [MPa] | A min [%] |
|---|---|---|---|---|
| +QT | d ≤ 16 | 1000 | 1200 – 1400 | 9 |
| +QT | 16 < d ≤ 40 | 900 | 1100 – 1300 | 10 |
| +QT | 40 < d ≤ 100 | 800 | 1000 – 1200 | 11 |
| +QT | 100 < d ≤ 160 | 700 | 900 – 1100 | 12 |
| +QT | 160 < d ≤ 250 | 600 | 800 – 950 | 13 |
| +A | – | – | – | ≤ 248 HB |

| Steel | Weldability | Machinability | Typical use in this project |
|---|---|---|---|
| C45 | limited: preheat 150 – 300 °C (see 9.4), avoid for welded load parts | good (+N); +QT good up to ≈ 280 HB | pins, simple shafts, centring pins, induction-hardened guide pins, levers |
| 42CrMo4 | poor: only with preheat 250 – 350 °C and post-weld heat treatment; better: do not weld | good in +QT up to ≈ 320 HB; above use coated carbide | APC rotation shaft, lift column, highly loaded pins and bolts, zero-point pull studs (often nitrided or induction hardened), clamping parts |
| 34CrNiMo6 | do not weld | medium (tough) | large highly loaded shafts, rotary table main shaft if big section |

### 3.3 Case hardening steels – EN ISO 683-3 (former EN 10084)

Source: EN 10084 / EN ISO 683-3 give chemical composition, hardenability and hardness in delivery
condition. **Core strength after case hardening is not a guaranteed value** in the standard; the core
values below are typical (from the former DIN 17210 for a Ø 30 test bar) – use them only for orientation.

| Steel (number) | Delivery hardness | Surface after case hardening + tempering 150 – 200 °C | Core Rm (typical, Ø 30) | Core Rp0.2 (typical, Ø 30) | Use in this project |
|---|---|---|---|---|---|
| 16MnCr5 (1.7131) | +A ≤ 207 HB; +FP 140 – 187 HB | 58 – 62 HRC (≈ 650 – 750 HV) | 800 – 1100 MPa | ≈ 600 MPa | **worm** of the rotary table (guide 12), small gears, pins, cam rollers, guide bushes |
| 20MnCr5 (1.7147) | +A ≤ 217 HB; +FP 152 – 201 HB | 58 – 62 HRC | 1000 – 1300 MPa | ≈ 700 MPa | larger gears and worms, higher core strength than 16MnCr5 |

Core strength falls with bigger sections. Weldability: do not weld (high hardenability).
Machinability: good in +FP condition (ferrite-pearlite) – order +FP for parts to be gear cut.

### 3.4 Bearing steel, nitriding steel, stainless, tool plate

| Material (number) | Standard | Condition | Key values (typical/min) | Use in this project |
|---|---|---|---|---|
| 100Cr6 (1.3505) | EN ISO 683-17 | +AC (soft annealed) ≤ 207 HB; hardened + tempered 150 – 180 °C: 58 – 64 HRC | E 210 GPa | guide rails/strips you make, wear pads, rollers, gauge pins |
| 31CrMoV9 (1.8519) | EN 10085 (nitriding steels) | +QT, d ≤ 100: Rp0.2 ≥ 800, Rm 1000 – 1200, A ≥ 10 % (approx. – check the standard for your size); gas nitrided: surface ≈ 750 – 850 HV | low distortion when nitrided | rotary table clamping parts, precise shafts that need wear resistance and low distortion, pull studs |
| X5CrNi18-10 (1.4301) | EN 10088-2 (sheet) / -3 (bar) | annealed: Rp0.2 ≥ 190 (bar) / ≥ 210 – 230 (sheet), Rm 500 – 700, A ≥ 45 % | not magnetic (annealed), α = 16·10⁻⁶ /K, work hardens when cut | coolant parts, covers, sensor brackets near coolant |
| 40CrMnMoS8-6 (1.2312) | EN ISO 4957 (tool steels) | delivered pre-hardened ≈ 280 – 325 HB (≈ Rm 950 – 1100 MPa, supplier values) | free machining (S), not for welding, can be nitrided | fixture plates, zero-point base plates, locating blocks, pallet top plates that need hardness without heat treatment |

### 3.5 Cast irons

Source: EN 1561 (grey iron, GJL) and EN 1563 (ductile iron, GJS). Values are for **separately cast test
bars**; the real casting wall can be weaker, especially thick walls of grey iron (EN 1561 gives
wall-thickness-related values – ask the foundry).

| Material | Rm [MPa] | Rp0.2 min [MPa] | A [%] | Hardness HBW (typical) | E [GPa] | Damping | Use in this project |
|---|---|---|---|---|---|---|---|
| EN-GJL-250 | 250 – 350 | – (no yield point) | 0.3 – 0.8 | ≈ 180 – 250 | 103 – 118 | very good | machine beds, housings, covers |
| EN-GJL-300 | 300 – 400 | – | 0.3 – 0.8 | ≈ 200 – 275 | 108 – 137 | very good | **rotary table housing** (guide 12), machine beds, slideways (can be flame/induction hardened) |
| EN-GJS-400-15 | ≥ 400 | 250 | ≥ 15 | ≈ 135 – 180 | 169 | medium | tough housings, brackets, levers, wheel hubs |
| EN-GJS-600-3 | ≥ 600 | 370 | ≥ 3 | ≈ 190 – 270 | 174 | medium | highly loaded housings, table tops, gears (can be induction hardened) |

Notes:
- Grey iron is **strong in compression** (≈ 3 – 4 × Rm) but weak in tension and brittle – design for compression.
- Weldability: GJL practically not weldable for load parts (only repair with Ni electrodes, preheat);
  GJS limited.
- Machinability: very good (short chips, dry possible); dust – use extraction.
- **Stress relief castings** before final machining (see 4.2) – or rough machine, age, finish.

### 3.6 Aluminium alloys

Source: EN 573-3 (composition), EN 485-2 (plate/sheet), EN 755-2 (extruded bar). Values are minimum
values and **depend strongly on product form and thickness** – check the supplier data sheet.

| Alloy | Temper / form | Rp0.2 min [MPa] | Rm min [MPa] | A min [%] | Hardness (typical) | Weldability | Machinability | Use in this project |
|---|---|---|---|---|---|---|---|---|
| EN AW-6082 (AlSi1MgMn) | T6 extruded bar d ≤ 20 | 250 | 295 | 8 | ≈ 95 HB | good (TIG/MIG), but strength in heat zone falls to ≈ 50 – 60 % | good | AGV parts, sensor brackets, light covers, profiles |
| | T6 / T651 plate 6 – 12.5 mm | 255 | 300 | 9 | | | | |
| | T6 / T651 plate 12.5 – 100 mm | 240 | 295 | 7 – 8 | | | | |
| EN AW-7075 (AlZn5.5MgCu) | T6 / T651 plate (thickness dependent) | 420 – 480 | 500 – 545 | 3 – 8 | ≈ 150 HB | **not fusion weldable** | very good | highly loaded light parts, gripper fingers, AGV lift parts |
| EN AW-5083 (AlMg4.5Mn0.7) | O / H111 | 125 | 275 – 350 | 15 – 16 | ≈ 75 HB | very good | medium (soft, smears); as cast plate good | welded aluminium frames, tooling plate (cast and milled plate, low stress) |

Rules: T6 parts lose strength when heated above ≈ 150 °C (do not stress relieve by heating – buy
stretched plate T651 or cast tooling plate for low distortion). Do not use aluminium for parts that see
high surface pressure without a steel insert (threads → thread inserts, see 8.6).

### 3.7 Bronzes and brass

Source: EN 1982 (copper alloy castings). Values are minimum values for the casting method:
GS = sand cast, GZ = centrifugal cast, GC = continuously cast. **Check the standard and the foundry
certificate – values below are typical rounded minimums.**

| Alloy (number) | Method | Rp0.2 min [MPa] | Rm min [MPa] | A min [%] | HBW min (typical) | Use in this project |
|---|---|---|---|---|---|---|
| CuSn12-C (CC483K) | GS / GZ / GC | 140 – 150 | 260 – 280 | 5 – 7 | 80 – 90 | worm wheels for medium speed, slide bushes, nuts |
| CuSn12Ni2-C (CC484K) | GS / GZ / GC | 160 – 180 | 280 – 300 | 6 – 12 | 85 – 95 | **worm wheel rim of the rotary table** (guide 12, GZ = centrifugal), highly loaded worm wheels |
| CuAl10Fe5Ni5-C (CC333G) | GS / GZ / GC | 250 – 280 | 600 – 650 | 7 – 13 | 140 – 150 | heavy loaded slow bushes, wear plates, nuts; **not ideal for worm wheels with hardened worms at high sliding speed** (scoring risk – tin bronze preferred) |
| CuZn39Pb3 (CW614N) brass | drawn bar (EN 12164) | ≈ 250 – 350 (temper dependent) | ≈ 360 – 500 | 8 – 20 | ≈ 90 – 140 HB | turned parts, fittings, nozzles; very good machinability |

Bronze is sold also as continuously cast bar (GC) – good for bushes. Worm wheel material must be agreed
with the gear calculation (ISO/TS 14521 or DIN 3996 material factors).

### 3.8 Engineering plastics and polyurethane

Source type: typical values from supplier data sheets (e.g. semi-finished product makers). **Plastics vary
widely between suppliers – use the data sheet of your supplier.** Values at 23 °C.

| Material | ρ [kg/dm³] | Tensile strength [MPa] | E [GPa] | Max. service temp. (long term) | Water uptake | Machinability | Use in this project |
|---|---|---|---|---|---|---|---|
| PA6 (cast or extruded) | 1.13 – 1.15 | 70 – 85 (dry), 40 – 60 (conditioned) | 2.5 – 3.2 (dry), 1.0 – 1.5 (cond.) | ≈ 80 – 100 °C | up to ≈ 3 % at 50 % RH (swells: dimensions change!) | good | rollers, slide pads where moisture is no problem |
| POM-C (acetal copolymer) | 1.41 | 60 – 70 | 2.6 – 3.1 | ≈ 100 °C | ≈ 0.2 % (dimensionally stable) | very good | precise plastic parts, slide blocks, gears, cable guides |
| PE-UHMW (PE 1000) | 0.93 – 0.94 | 20 – 40 (yield ≈ 17 – 22) | 0.6 – 0.8 | ≈ 80 °C | ≈ 0 % | good (but springs back, burrs) | slide strips and guide rails for crates and pallets, wear strips, bumpers (guides 10, 11) |
| PU 90 Shore A (cast, e.g. polyester / polyether PU) | 1.1 – 1.25 | 30 – 50 | non-linear (≈ 0.02 – 0.05) | ≈ 70 – 80 °C (heat build-up at speed!) | low – medium | moulded, can be ground | AGV drive wheels, castor tyres, buffers |
| PU 95 Shore A | 1.15 – 1.25 | 35 – 55 | non-linear (≈ 0.04 – 0.08) | ≈ 70 – 80 °C | low – medium | | heavier wheels (1 t pallet AGV), buffers |

PU wheel load: never take a load value from a general table – the allowed wheel load depends on diameter,
width, tread thickness, speed and floor. **Use the wheel maker's load table** (guide 11).

### 3.9 Material selection quick table (this project)

| Part (guide) | First choice | Alternative | Why |
|---|---|---|---|
| Welded frames, base plates (09, 10, 11) | S355J2 | S235JR (lightly loaded) | weldable, cheap, stress relief then machine |
| APC rotation / lift shaft (09) | 42CrMo4+QT | 34CrNiMo6+QT (big Ø) | strength, toughness |
| Centring pins, guide cones (10) | C45 induction hardened 55 HRC | 16MnCr5 case hardened | hard surface, tough core |
| Locating receivers / bushes (10) | 16MnCr5 case hardened or 100Cr6 hardened | 1.2312 (not hardened) | wear |
| Rotary table housing (12) | EN-GJL-300 | S355J2 welded + stress relieved | damping, stability |
| Rotary table worm (12) | 16MnCr5 / 20MnCr5 case hardened + ground | 31CrMoV9 nitrided (lower load) | wear, contact strength |
| Worm wheel rim (12) | CuSn12Ni2-C-GZ | CuSn12-C-GZ | best pairing with hardened worm |
| Fixture / zero-point plates (09) | 1.2312 | 42CrMo4+QT | pre-hardened, machine directly |
| Slide strips (10, 11) | PE-UHMW | POM-C | low friction, cheap |
| AGV wheels (11) | PU 92 – 95 Shore A on steel or aluminium hub | – | grip, floor protection |

---

## 4. Heat treatment and hardness

Source type: typical process values from EN ISO 683-x (informative annexes), EN 10084, EN 10085 and
heat-treatment handbooks. **The heat-treatment shop must confirm the exact cycle for your part.**
Always write on the drawing: process, hardness with tolerance, depth with its definition, where to test.

### 4.1 Normalising (+N)

| Item | Value |
|---|---|
| Purpose | uniform fine grain, remove forging/rolling structure |
| Temperature | 30 – 50 K above Ac3: C45 ≈ 840 – 880 °C; 42CrMo4 ≈ 840 – 880 °C; S355 ≈ 880 – 920 °C |
| Holding | until the core is at temperature (rule: ≈ 1 – 2 min per mm wall, minimum ≈ 30 min) |
| Cooling | in still air |
| Distortion | medium (scale) – do before rough machining |

### 4.2 Stress relief annealing

| Material | Temperature | Holding | Cooling |
|---|---|---|---|
| Welded steel S235 / S355 frames | 550 – 650 °C (often 580 – 620 °C) | ≈ 1 – 2 h, or 1 h per 25 mm wall (min 1 h) | in the furnace to ≈ 300 °C, then air (slow, ≤ ≈ 50 – 100 K/h) |
| QT steels (C45, 42CrMo4) after rough machining | 30 – 50 K **below** the tempering temperature used (typically 500 – 600 °C) | 1 – 2 h | slow in furnace |
| Grey / ductile cast iron | 500 – 600 °C (GJL ≈ 500 – 575 °C) | 2 – 8 h depending on wall | slow in furnace to ≈ 200 – 300 °C |
| Aluminium | **not by heating for T6/T651** (overaging) – use stretched plate (T651) or cast tooling plate; vibration stress relief is an option | | |

Rule from the project: **rough machine → stress relieve → finish machine** (guide 00, rule 2).
Leave 1 – 3 mm per side for finishing after stress relief of welded frames.

### 4.3 Quenching and tempering (QT)

| Steel | Hardening temp. | Quench | Tempering temp. | Result |
|---|---|---|---|---|
| C45 | 820 – 860 °C | water or oil (small parts) | 550 – 660 °C | per table 3.2 |
| 42CrMo4 | 820 – 860 °C | oil or polymer | 540 – 680 °C | per table 3.2 |
| 34CrNiMo6 | 830 – 860 °C | oil | 540 – 660 °C | per table 3.2 |
| 31CrMoV9 | 870 – 930 °C | oil | 580 – 700 °C | core before nitriding (≥ 30 – 50 K above nitriding temperature) |

Usually **buy the bar in +QT** – then no heat treatment and no distortion for you.

### 4.4 Case hardening (carburising + hardening + tempering)

| Item | 16MnCr5 / 20MnCr5 |
|---|---|
| Carburising | 880 – 980 °C (often 920 – 950 °C) |
| Hardening | direct from carburising temperature after cooling to ≈ 830 – 860 °C, or re-heat: core hardening 860 – 900 °C, case hardening 780 – 820 °C |
| Quench | oil |
| Tempering | 150 – 200 °C, ≥ 1 – 2 h |
| Surface hardness | 58 – 62 HRC (drawing typical: 60 ± 2 HRC) |
| Case hardening depth CHD | per ISO 18203: depth where hardness = **550 HV1**. Typical 0.3 – 2.0 mm; gears/worms: CHD ≈ 0.15 – 0.20 × module (check with gear calculation) |
| Time (rule of thumb) | total case depth ≈ 0.6 · √t [mm, t in h] at ≈ 925 °C (Harris); effective CHD (550 HV) ≈ 60 – 75 % of total. Example: CHD 0.8 mm → total ≈ 1.15 mm → t ≈ (1.15 / 0.6)² ≈ 3.7 h at temperature |
| Distortion | **high** – leave grinding stock (≈ 0.1 – 0.3 mm per side, depends on size), grind after hardening; grind removes case, so CHD on drawing = **after grinding** |
| Masking | areas that must stay soft (threads to be cut later): copper plating or protective paste, or leave extra stock and machine off the case before hardening |

### 4.5 Nitriding

| Item | Gas nitriding | Nitrocarburising (gas / salt bath / plasma) |
|---|---|---|
| Temperature | 490 – 530 °C (plasma 400 – 550 °C) | 570 – 590 °C |
| Time | 20 – 80 h (long) | 1 – 4 h |
| Depth | nitriding hardness depth Nht (ISO 18203: core + 50 HV) ≈ 0.2 – 0.6 mm | compound layer 10 – 20 µm; diffusion zone ≈ 0.1 – 0.3 mm |
| Surface hardness | 31CrMoV9: ≈ 750 – 850 HV; 42CrMo4: ≈ 550 – 650 HV; 1.2312: ≈ 600 – 700 HV | depends on steel |
| Distortion | **very low** (no quench) – finish grind before nitriding, only lap/polish after | low |
| Condition before | QT, tempered ≥ 30 – 50 K above nitriding temp.; stress relieved after rough machining | |

### 4.6 Induction / flame hardening

| Item | Value |
|---|---|
| Steels | C45, 42CrMo4 (QT before), GJS, GJL (slideways) |
| Surface hardness | C45: ≈ 54 – 60 HRC; 42CrMo4: ≈ 52 – 58 HRC; GJL slideways ≈ 45 – 52 HRC |
| Hardening depth (SHD, ISO 18203: depth at 80 % of min surface hardness) | 0.5 – 5 mm, typically 1.5 – 3 mm |
| Tempering | 150 – 200 °C |
| Distortion | low – medium (local heating); grind after |
| Use | centring pins, guide pins, shafts at bearing/seal seats, cam tracks |

### 4.7 Distortion and drawing notes – summary

| Process | Distortion | Grind after? | Drawing note example |
|---|---|---|---|
| Normalise / stress relief | low – medium | no (machine after) | "Stress relieved 600 °C / 2 h before finish machining" |
| QT | medium – high | yes (or buy +QT bar) | "42CrMo4+QT, Rm 900–1100 MPa" |
| Case hardening | high | yes | "Case hardened and tempered, 60 ± 2 HRC, CHD = 0.8 +0.3 mm (550 HV1, ISO 18203), after grinding" |
| Nitriding | very low | no (lap) | "Gas nitrided, ≥ 750 HV1, Nht = 0.3 +0.1 mm" |
| Induction hardening | low – medium | yes (seats) | "Induction hardened 55 ± 3 HRC, SHD = 2 +1 mm, zone per sketch" |

### 4.8 Hardness conversion (approximate)

Source type: approximate conversion for unalloyed and low-alloy steels, in the style of ISO 18265 /
ASTM E140. **Conversions are approximate (± about 5 – 10 %) – for acceptance always test with the scale
written on the drawing.** Rm from hardness is only an estimate (Rm ≈ 3.2 – 3.3 × HV in the range
200 – 500 HV); not valid for cast iron, aluminium, cold-worked or case-hardened material.

| HRC | HV | HBW (approx.) | Rm approx. [MPa] |
|---|---|---|---|
| – | 160 | 152 | 510 |
| – | 200 | 190 | 640 |
| – | 220 | 209 | 705 |
| 20 | 238 | 226 | 770 |
| 22 | 248 | 235 | 800 |
| 25 | 266 | 253 | 860 |
| 28 | 286 | 271 | 920 |
| 30 | 302 | 286 | 970 |
| 32 | 318 | 301 | 1020 |
| 35 | 345 | 327 | 1110 |
| 38 | 372 | 353 | 1200 |
| 40 | 392 | 371 | 1260 |
| 42 | 412 | 390 | 1330 |
| 45 | 446 | 421 | 1440 |
| 48 | 484 | 455 | 1570 |
| 50 | 513 | 481 | 1660 |
| 52 | 544 | – | 1760 |
| 55 | 595 | – | 1920 |
| 58 | 653 | – | – |
| 60 | 697 | – | – |
| 62 | 746 | – | – |
| 64 | 800 | – | – |
| 66 | 865 | – | – |

Brinell values above ≈ 450 HBW need a hard-metal ball and are rarely used. Rule: HBW ≈ 0.95 × HV up
to ≈ 450.

---

## 5. ISO 286 limits and fits

Source: **values per ISO 286-1 and ISO 286-2** (current edition 2010). All values in **µm**, for 20 °C.
A range "18 – 30" means "over 18 up to and including 30 mm".

### 5.1 Standard tolerance grades IT4 – IT11 [µm]

| Nominal size [mm] | IT4 | IT5 | IT6 | IT7 | IT8 | IT9 | IT10 | IT11 |
|---|---|---|---|---|---|---|---|---|
| up to 3 | 3 | 4 | 6 | 10 | 14 | 25 | 40 | 60 |
| 3 – 6 | 4 | 5 | 8 | 12 | 18 | 30 | 48 | 75 |
| 6 – 10 | 4 | 6 | 9 | 15 | 22 | 36 | 58 | 90 |
| 10 – 18 | 5 | 8 | 11 | 18 | 27 | 43 | 70 | 110 |
| 18 – 30 | 6 | 9 | 13 | 21 | 33 | 52 | 84 | 130 |
| 30 – 50 | 7 | 11 | 16 | 25 | 39 | 62 | 100 | 160 |
| 50 – 80 | 8 | 13 | 19 | 30 | 46 | 74 | 120 | 190 |
| 80 – 120 | 10 | 15 | 22 | 35 | 54 | 87 | 140 | 220 |
| 120 – 180 | 12 | 18 | 25 | 40 | 63 | 100 | 160 | 250 |
| 180 – 250 | 14 | 20 | 29 | 46 | 72 | 115 | 185 | 290 |
| 250 – 315 | 16 | 23 | 32 | 52 | 81 | 130 | 210 | 320 |
| 315 – 400 | 18 | 25 | 36 | 57 | 89 | 140 | 230 | 360 |
| 400 – 500 | 20 | 27 | 40 | 63 | 97 | 155 | 250 | 400 |

Which IT grade can a process hold (typical, good machine): grinding IT5 – IT6; fine boring / fine turning
IT6 – IT7; reaming IT7 – IT8; turning / milling IT8 – IT10; drilling IT10 – IT12. Honing / lapping IT4 – IT5.

### 5.2 Hole tolerances – limit deviations [µm] (upper / lower)

| Size [mm] | H6 | H7 | G7 | JS6 | K6 | N7 | P7 |
|---|---|---|---|---|---|---|---|
| 3 – 6 | +8 / 0 | +12 / 0 | +16 / +4 | ±4 | +2 / −6 | −4 / −16 | −8 / −20 |
| 6 – 10 | +9 / 0 | +15 / 0 | +20 / +5 | ±4.5 | +2 / −7 | −4 / −19 | −9 / −24 |
| 10 – 18 | +11 / 0 | +18 / 0 | +24 / +6 | ±5.5 | +2 / −9 | −5 / −23 | −11 / −29 |
| 18 – 30 | +13 / 0 | +21 / 0 | +28 / +7 | ±6.5 | +2 / −11 | −7 / −28 | −14 / −35 |
| 30 – 50 | +16 / 0 | +25 / 0 | +34 / +9 | ±8 | +3 / −13 | −8 / −33 | −17 / −42 |
| 50 – 80 | +19 / 0 | +30 / 0 | +40 / +10 | ±9.5 | +4 / −15 | −9 / −39 | −21 / −51 |
| 80 – 120 | +22 / 0 | +35 / 0 | +47 / +12 | ±11 | +4 / −18 | −10 / −45 | −24 / −59 |
| 120 – 180 | +25 / 0 | +40 / 0 | +54 / +14 | ±12.5 | +4 / −21 | −12 / −52 | −28 / −68 |
| 180 – 250 | +29 / 0 | +46 / 0 | +61 / +15 | ±14.5 | +5 / −24 | −14 / −60 | −33 / −79 |
| 250 – 315 | +32 / 0 | +52 / 0 | +69 / +17 | ±16 | +5 / −27 | −14 / −66 | −36 / −88 |

### 5.3 Shaft tolerances – limit deviations [µm] (upper / lower)

| Size [mm] | f7 | g6 | h6 | js6 | k5 | k6 | m6 | n6 | p6 |
|---|---|---|---|---|---|---|---|---|---|
| 3 – 6 | −10 / −22 | −4 / −12 | 0 / −8 | ±4 | +6 / +1 | +9 / +1 | +12 / +4 | +16 / +8 | +20 / +12 |
| 6 – 10 | −13 / −28 | −5 / −14 | 0 / −9 | ±4.5 | +7 / +1 | +10 / +1 | +15 / +6 | +19 / +10 | +24 / +15 |
| 10 – 18 | −16 / −34 | −6 / −17 | 0 / −11 | ±5.5 | +9 / +1 | +12 / +1 | +18 / +7 | +23 / +12 | +29 / +18 |
| 18 – 30 | −20 / −41 | −7 / −20 | 0 / −13 | ±6.5 | +11 / +2 | +15 / +2 | +21 / +8 | +28 / +15 | +35 / +22 |
| 30 – 50 | −25 / −50 | −9 / −25 | 0 / −16 | ±8 | +13 / +2 | +18 / +2 | +25 / +9 | +33 / +17 | +42 / +26 |
| 50 – 80 | −30 / −60 | −10 / −29 | 0 / −19 | ±9.5 | +15 / +2 | +21 / +2 | +30 / +11 | +39 / +20 | +51 / +32 |
| 80 – 120 | −36 / −71 | −12 / −34 | 0 / −22 | ±11 | +18 / +3 | +25 / +3 | +35 / +13 | +45 / +23 | +59 / +37 |
| 120 – 180 | −43 / −83 | −14 / −39 | 0 / −25 | ±12.5 | +21 / +3 | +28 / +3 | +40 / +15 | +52 / +27 | +68 / +43 |
| 180 – 250 | −50 / −96 | −15 / −44 | 0 / −29 | ±14.5 | +24 / +4 | +33 / +4 | +46 / +17 | +60 / +31 | +79 / +50 |
| 250 – 315 | −56 / −108 | −17 / −49 | 0 / −32 | ±16 | +27 / +4 | +36 / +4 | +52 / +20 | +66 / +34 | +88 / +56 |

**r6** – the fundamental deviation changes inside the bigger ranges, so it has its own table:

| Size [mm] | r6 | Size [mm] | r6 |
|---|---|---|---|
| 3 – 6 | +23 / +15 | 120 – 140 | +88 / +63 |
| 6 – 10 | +28 / +19 | 140 – 160 | +90 / +65 |
| 10 – 18 | +34 / +23 | 160 – 180 | +93 / +68 |
| 18 – 30 | +41 / +28 | 180 – 200 | +106 / +77 |
| 30 – 50 | +50 / +34 | 200 – 225 | +109 / +80 |
| 50 – 65 | +60 / +41 | 225 – 250 | +113 / +84 |
| 65 – 80 | +62 / +43 | 250 – 280 | +126 / +94 |
| 80 – 100 | +73 / +51 | 280 – 315 | +130 / +98 |
| 100 – 120 | +76 / +54 | | |

**How to calculate a fit (example Ø 40 H7/k6):** hole 40.000 … 40.025; shaft 40.002 … 40.018.
Max clearance = 40.025 − 40.002 = +0.023 mm. Max interference = 40.000 − 40.018 = −0.018 mm
(negative clearance = interference) → transition fit.

### 5.4 Recommended fits (hole-basis system)

Source type: common preferred fits per ISO 286-1 annex and machine design handbooks.

| Fit | Type | Ø 40 example: clearance (+) / interference (−) [µm] | Assembly | Typical use in this project |
|---|---|---|---|---|
| H11/c11 | loose clearance | +120 … +440 | free | pins in rough linkages, hinge pins on guards |
| H9/d9 | free running | +80 … +204 | free | loose bearings, idler shafts, rough guides |
| H8/f7 | running | +25 … +89 | by hand, free | plain bearings with oil, lever pivots, sliding bushes |
| H7/g6 | close sliding | +9 … +50 | by hand, slides | guide pins that must slide (cart pin, docking pin), sliding gears, spigots that must come apart easily |
| H7/h6 | locating clearance | 0 … +41 | by hand, light push | centring spigots, flanges, removable locating pins, bearing housing (outer ring stationary) |
| H7/js6 | locating transition | −8 … +33 | light hammer / press | hubs with key, coupling hubs, gears with key |
| H7/k6 | transition | −18 … +23 | light press | **rolling bearing inner ring on rotating shaft (normal load)**, coupling hubs |
| H7/m6 | transition (tighter) | −25 … +16 | press | bearing inner rings with heavy load, **dowel pins** (in H7 hole, ISO 2338 m6) |
| H7/n6 | tight transition / light press | −33 … +8 | press | gears and bushes on shafts that will rarely be dismantled |
| H7/p6 | light press | −42 … −1 | press | **bronze bushes in steel housing**, permanent locating bushes |
| H7/r6 | medium press | −50 … −9 | press or shrink | **worm wheel rim on hub** (plus pins/screws), heavy bushes |
| H7/s6 | heavy press (shrink) | −59 … −18 (s6 30–50: +59/+43) | shrink | torque transmission without key (check with DIN 7190 / Lamé) |

**Rolling bearing seats** – use the bearing maker's tables (they depend on load direction and size).
Typical: rotating inner ring, normal load: shaft k5/k6 (small) to m6 (bigger, heavy); stationary outer
ring: housing H7 or J7; precision spindle/rotary table bearings: IT5/IT4 seats per maker.

**Press fit – shrink temperature:**
ΔT = (U_max + s) / (α · d), with U_max = max interference, s = assembly clearance (≈ 0.001·d).
Example: worm wheel rim d = 200 mm on hub, H7/r6 (180 – 200: +106 / +77 µm) → U_max = 0.106 mm, s = 0.001 · 200 = 0.2 mm, α bronze 18·10⁻⁶ →
ΔT = (0.106 + 0.2) / (18·10⁻⁶ · 200) = 85 K → heat the rim to ≈ 20 + 85 ≈ 105 – 110 °C (or cool the hub).

**Press fit – contact pressure (same material, solid shaft):**
p = E · U_eff / (2 · d) · (1 − (d/D)²), with D = outer diameter of the hub and U_eff = interference minus
smoothing (≈ 0.4·(Rz_shaft + Rz_hole), DIN 7190). Transmittable torque T = μ · p · π · d² · L / 2,
μ ≈ 0.10 – 0.15 (press), 0.14 – 0.2 (shrink, dry, steel/steel). Check stress in the hub against Rp0.2.

---

## 6. General tolerances, welding tolerances, geometric tolerances

### 6.1 ISO 2768-1 – general tolerances for linear and angular dimensions

Source: **values per ISO 2768-1**. Used for all dimensions **without** an individual tolerance. Drawing
note: "ISO 2768-mK" (m = medium for dimensions, K = class for geometry, see 6.2).

Linear dimensions [mm]:

| Nominal size [mm] | f (fine) | m (medium) | c (coarse) | v (very coarse) |
|---|---|---|---|---|
| 0.5 – 3 | ±0.05 | ±0.1 | ±0.2 | – |
| 3 – 6 | ±0.05 | ±0.1 | ±0.3 | ±0.5 |
| 6 – 30 | ±0.1 | ±0.2 | ±0.5 | ±1.0 |
| 30 – 120 | ±0.15 | ±0.3 | ±0.8 | ±1.5 |
| 120 – 400 | ±0.2 | ±0.5 | ±1.2 | ±2.5 |
| 400 – 1000 | ±0.3 | ±0.8 | ±2.0 | ±4.0 |
| 1000 – 2000 | ±0.5 | ±1.2 | ±3.0 | ±6.0 |
| 2000 – 4000 | – | ±2.0 | ±4.0 | ±8.0 |

External radii and chamfer heights [mm]:

| Nominal size | f and m | c and v |
|---|---|---|
| 0.5 – 3 | ±0.2 | ±0.4 |
| 3 – 6 | ±0.5 | ±1.0 |
| over 6 | ±1.0 | ±2.0 |

Angles (length of the shorter leg):

| Shorter leg [mm] | f and m | c | v |
|---|---|---|---|
| up to 10 | ±1° | ±1°30′ | ±3° |
| 10 – 50 | ±0°30′ | ±1° | ±2° |
| 50 – 120 | ±0°20′ | ±0°30′ | ±1° |
| 120 – 400 | ±0°10′ | ±0°15′ | ±0°30′ |
| over 400 | ±0°5′ | ±0°10′ | ±0°20′ |

### 6.2 ISO 2768-2 – general geometrical tolerances (classes H, K, L)

Source: **values per ISO 2768-2** [mm].

Straightness and flatness:

| Nominal length [mm] | H | K | L |
|---|---|---|---|
| up to 10 | 0.02 | 0.05 | 0.1 |
| 10 – 30 | 0.05 | 0.1 | 0.2 |
| 30 – 100 | 0.1 | 0.2 | 0.4 |
| 100 – 300 | 0.2 | 0.4 | 0.8 |
| 300 – 1000 | 0.3 | 0.6 | 1.2 |
| 1000 – 3000 | 0.4 | 0.8 | 1.6 |

Perpendicularity (length of the shorter side):

| Nominal length [mm] | H | K | L |
|---|---|---|---|
| up to 100 | 0.2 | 0.4 | 0.6 |
| 100 – 300 | 0.3 | 0.6 | 1.0 |
| 300 – 1000 | 0.4 | 0.8 | 1.5 |
| 1000 – 3000 | 0.5 | 1.0 | 2.0 |

Symmetry: H 0.5 (all lengths); K 0.6 / 0.6 / 0.8 / 1.0; L 0.6 / 1.0 / 1.5 / 2.0 (same length steps as
perpendicularity). Circular run-out: H 0.1, K 0.2, L 0.5.

**ISO 2768 is far too coarse for fitting surfaces.** Every surface that locates, fits or seals needs an
individual tolerance (ISO 286 or a geometric tolerance).

Note: ISO 2768-2 is being replaced by the ISO 22081 approach (general geometrical specification). Many
workshops still use ISO 2768 – agree with your supplier which one applies.

### 6.3 ISO 13920 – general tolerances for welded constructions

Source: **values per ISO 13920** (summary of the long-used 1996 edition; the standard has been revised –
check the current edition and whether values changed before you put them in a contract). Drawing note example: "ISO 13920-BF".

Linear dimensions [mm]:

| Nominal size [mm] | A | B | C | D |
|---|---|---|---|---|
| 2 – 30 | ±1 | ±1 | ±1 | ±1 |
| 30 – 120 | ±1 | ±2 | ±3 | ±4 |
| 120 – 400 | ±1 | ±2 | ±4 | ±7 |
| 400 – 1000 | ±2 | ±3 | ±6 | ±9 |
| 1000 – 2000 | ±3 | ±4 | ±8 | ±12 |
| 2000 – 4000 | ±4 | ±6 | ±11 | ±16 |
| 4000 – 8000 | ±5 | ±8 | ±14 | ±21 |

Angular dimensions (length of the shorter leg):

| Shorter leg [mm] | A | B | C | D |
|---|---|---|---|---|
| up to 400 | ±20′ | ±45′ | ±1° | ±1°30′ |
| 400 – 1000 | ±15′ | ±30′ | ±45′ | ±1°15′ |
| over 1000 | ±10′ | ±20′ | ±30′ | ±1° |

Straightness, flatness, parallelism classes E (finest) … H (coarsest): for example over 120 – 400 mm
approx. E 1 mm, F 1.5 mm, G 3 mm, H 5 mm; over 400 – 1000 mm approx. E 1.5, F 3, G 5.5, H 9 mm.
**Check these values in the standard before you use them.**

Use in this project: welded frames **B** for lengths and **F** for flatness ("ISO 13920-BF") as welded;
all functional faces get **machining allowance** (3 – 5 mm per side on welded frames) and individual
tolerances after machining.

### 6.4 Geometrical tolerance symbols (ISO 1101)

| Group | Characteristic | Symbol | Datum needed? |
|---|---|---|---|
| Form | Straightness | — (straight line) | no |
| Form | Flatness | ▱ (parallelogram) | no |
| Form | Roundness (circularity) | ○ | no |
| Form | Cylindricity | ⌭ (circle between two lines) | no |
| Form / profile | Line profile | ⌒ (arc) | optional |
| Form / profile | Surface profile | ⌓ (closed arc) | optional |
| Orientation | Parallelism | ∥ | yes |
| Orientation | Perpendicularity | ⊥ | yes |
| Orientation | Angularity | ∠ | yes |
| Location | Position | ⌖ (circle with cross) | usually yes |
| Location | Concentricity / coaxiality | ◎ | yes |
| Location | Symmetry | ⌯ (three lines) | yes |
| Run-out | Circular run-out | ↗ (one arrow) | yes |
| Run-out | Total run-out | ⌰ (two arrows) | yes |

Modifiers: Ⓜ maximum material requirement (use for bolt holes and pin holes that only need assembly),
Ⓛ least material, Ⓔ envelope requirement, Ⓟ projected tolerance zone (threaded holes for long pins),
Ø before the value = cylindrical tolerance zone (use for position of holes and axes).

### 6.5 Typical achievable geometric tolerances by process

Source type: **typical shop values** for a good, warm machine and a stable part – not a standard. Ask
for your machine's real capability (measure it).

| Characteristic | Process | Typical value [mm] |
|---|---|---|
| Flatness | milling on machining centre | 0.01 – 0.03 per 300 mm |
| Flatness | surface grinding | 0.002 – 0.01 per 300 mm |
| Flatness | scraping / lapping | 0.002 – 0.005 per 300 mm (scraped: ≈ 15 – 25 points per 25×25 mm) |
| Roundness | turning | 0.005 – 0.02 |
| Roundness | cylindrical grinding | 0.001 – 0.005 |
| Roundness | honing | 0.001 – 0.003 |
| Coaxiality / run-out | turned in one set-up | 0.005 – 0.02 |
| Coaxiality / run-out | turned in two set-ups (re-chucked) | 0.02 – 0.05 |
| Coaxiality / run-out | ground between centres | 0.002 – 0.005 |
| Position of holes | CNC drilled (no pilot) | Ø 0.05 – 0.1 |
| Position of holes | CNC spot + drill + ream / bore | Ø 0.02 – 0.04 |
| Position of holes | jig boring / fine boring on accurate HMC | Ø 0.005 – 0.015 |
| Position of holes | manual drill with marking | Ø 0.2 – 0.5 |
| Perpendicularity | milling one set-up | 0.01 – 0.02 per 100 |
| Parallelism | grinding | 0.002 – 0.005 per 100 |

---

## 7. Surface roughness

### 7.1 Roughness by process (achievable Ra)

Source type: typical values from ISO 1302 annex-style charts and machining handbooks. The **normal**
range is what you get in production; **fine** needs extra care (sharp tool, small feed, stable machine).

| Process | Ra normal [µm] | Ra fine [µm] |
|---|---|---|
| Flame cutting | 12.5 – 25 | 6.3 |
| Laser cutting (steel 5 – 15 mm) | 3.2 – 12.5 | 1.6 |
| Sawing | 6.3 – 25 | 3.2 |
| Drilling | 3.2 – 6.3 | 1.6 |
| Rough turning | 6.3 – 12.5 | 3.2 |
| Finish turning | 1.6 – 3.2 | 0.4 – 0.8 |
| Fine turning / boring (wiper insert, CBN) | 0.4 – 0.8 | 0.2 |
| Face / end milling, finishing | 1.6 – 3.2 | 0.4 – 0.8 |
| Rough milling | 6.3 – 12.5 | 3.2 |
| Reaming | 0.8 – 1.6 | 0.4 |
| Broaching | 0.8 – 3.2 | 0.4 |
| Cylindrical / surface grinding | 0.4 – 0.8 | 0.1 – 0.2 |
| Thread grinding | 0.4 – 0.8 | 0.2 |
| Honing | 0.1 – 0.4 | 0.05 |
| Superfinishing | 0.05 – 0.2 | 0.025 |
| Lapping | 0.05 – 0.2 | 0.012 |
| Roller burnishing | 0.1 – 0.4 | 0.05 |
| Wire EDM (finish passes) | 0.4 – 1.6 | 0.2 |

Ra and Rz: there is **no exact conversion**. For turned / milled surfaces Rz ≈ 4 – 7 × Ra (rough rule).
Theoretical turning roughness: **Rt ≈ f² / (8·r)** (f = feed mm/rev, r = nose radius mm).
Example: f = 0.15, r = 0.8 → Rt = 0.0225 / 6.4 = 0.0035 mm = 3.5 µm → Ra ≈ Rt / 4 ≈ 0.9 µm.

Old roughness classes (N-numbers of the old ISO 1302): N5 = 0.4, N6 = 0.8, N7 = 1.6, N8 = 3.2,
N9 = 6.3, N10 = 12.5 µm Ra. Do not use N-numbers on new drawings – write Ra.

### 7.2 Recommended roughness by function

Source type: rolling bearing makers' recommendations, seal makers' recommendations (ISO 6194 / DIN 3760
style for radial lip seals), hydraulic cylinder makers. Values are **maximum Ra**.

| Function | Ra [µm] | Note |
|---|---|---|
| Rolling bearing seat on shaft, IT6 (d ≤ 80 mm) | 0.8 | IT5: 0.4; IT7: 1.6; bigger d one step coarser |
| Rolling bearing seat in housing, IT7 | 1.6 | |
| Precision bearing seats (rotary table, spindle) | 0.2 – 0.4 | per bearing maker |
| Bearing shoulder faces | 1.6 – 3.2 | |
| Running surface for radial lip seal | 0.2 – 0.8 (Rz 1 – 5) | hardness ≥ 45 – 55 HRC; plunge ground, **no grinding lead** (spiral marks pump oil) |
| Static O-ring groove: bottom / flanks | 1.6 / 3.2 | per seal maker |
| O-ring sealing surface (mating face, static) | 0.8 – 1.6 | |
| Dynamic seal surface (cylinder bore) | 0.1 – 0.4 | honed / roller burnished |
| Hydraulic piston rod | 0.1 – 0.3 | hard chrome or nitrided, ground and polished |
| Slideway / sliding guide | 0.2 – 0.8 | ground or scraped |
| Plain bearing bush bore (bronze) | 0.4 – 0.8 | shaft 0.2 – 0.4 |
| Worm thread flanks (hardened, ground) | 0.2 – 0.4 | guide 12 |
| Worm wheel flanks (hobbed) | 0.8 – 1.6 | |
| Gear flanks, ground | 0.4 – 0.8 | |
| Gear flanks, hobbed / shaped | 1.6 – 3.2 | |
| Holes for dowel pins (reamed H7) | 0.8 – 1.6 | |
| Taper (cone) locating seats, taper pins | 0.4 – 0.8 | check contact pattern with marking blue |
| Locating faces of fixtures and pallets | 0.8 – 1.6 | |
| Bolted joint faces (non-locating) | 1.6 – 3.2 | finer faces = less settling |
| Press fit seats | 0.8 – 1.6 | roughness reduces the effective interference |
| Non-functional machined faces | 3.2 – 6.3 | |
| Rough faces (as sawn, as cut) | 12.5 – 25 | |

### 7.3 Surface symbol on drawings (ISO 21920-1, former ISO 1302)

| Element | Meaning |
|---|---|
| `√` (open tick) | surface texture requirement, any manufacturing process |
| `√` with a horizontal bar closing the tick | **material removal required** (machined) – the normal case on machined parts |
| `√` with a circle in the tick | material removal not allowed (keep as cast, as rolled) |
| value "Ra 0.8" on the long leg | Ra ≤ 0.8 µm (16 % rule is the default: up to 16 % of measured values may be higher) |
| "Ra max 0.8" | max rule – no single measurement may be higher |
| "U Ra 1.6" and "L Ra 0.4" | upper and lower limit |
| lay symbol under the tick (= ⊥ X M C R P) | direction of the tool marks ("=" parallel to the view plane, "⊥" perpendicular, "M" multi-direction, "C" circular …) |
| general note near the title block: "√ Ra 3.2 (√)" | all surfaces Ra 3.2 except the ones marked on the drawing |

Note: ISO 21920 (2021) replaced ISO 1302, ISO 4287 and ISO 4288. The Ra symbol on the drawing looks
the same; some default rules changed. Agree with your inspection department which standard applies.

---

## 8. Bolted joints and pins

### 8.1 Property classes of bolts – ISO 898-1

Source: **values per ISO 898-1** (minimum values).

| Class | Rm min [MPa] | ReL / Rp0.2 min [MPa] | A min [%] | Hardness [HV] | Matching nut (ISO 898-2) | Use |
|---|---|---|---|---|---|---|
| 4.6 | 400 | 240 | 22 | 120 – 220 | 5 | non-structural |
| 5.6 | 500 | 300 | 20 | 155 – 220 | 5 | |
| 8.8 (d ≤ 16) | 800 | 640 | 12 | 250 – 320 | 8 | **standard for machines** |
| 8.8 (d > 16) | 830 | 660 | 12 | 255 – 335 | 8 | |
| 10.9 | 1040 | 940 | 9 | 320 – 380 | 10 | high load, small space |
| 12.9 | 1220 | 1100 | 8 | 385 – 435 | 12 | socket cap screws ISO 4762, highest load; risk of hydrogen embrittlement if electroplated |

Meaning of "10.9": first number × 100 ≈ Rm (nominal 1000 MPa); second number × 10 = ratio Rp/Rm in %
(90 %). Stainless steel bolts (ISO 3506-1): A2-70 / A4-70 → Rm 700, Rp0.2 450 MPa; A4-80 → 800 / 600.

### 8.2 Thread data, tap drills, clearance holes (metric coarse)

Source: ISO 724 (basic dimensions), ISO 898-1 (stress area As), ISO 273 (clearance holes), ISO 4762
(head diameter), DIN 974-1 (counterbores – check the DIN table for your series and washer).

| Thread | Pitch P | Stress area As [mm²] | Tap drill [mm] | Clearance hole fine / medium / coarse (ISO 273) | Counterbore Ø for ISO 4762 (DIN 974-1, without washer) | Head Ø ISO 4762 (max) |
|---|---|---|---|---|---|---|
| M4 | 0.7 | 8.78 | 3.3 | 4.3 / 4.5 / 4.8 | 8 | 7 |
| M5 | 0.8 | 14.2 | 4.2 | 5.3 / 5.5 / 5.8 | 10 | 8.5 |
| M6 | 1.0 | 20.1 | 5.0 | 6.4 / 6.6 / 7.0 | 11 | 10 |
| M8 | 1.25 | 36.6 | 6.8 | 8.4 / 9 / 10 | 15 | 13 |
| M10 | 1.5 | 58.0 | 8.5 | 10.5 / 11 / 12 | 18 | 16 |
| M12 | 1.75 | 84.3 | 10.2 | 13 / 13.5 / 14.5 | 20 | 18 |
| M14 | 2.0 | 115 | 12.0 | 15 / 15.5 / 16.5 | 24 | 21 |
| M16 | 2.0 | 157 | 14.0 | 17 / 17.5 / 18.5 | 26 | 24 |
| M18 | 2.5 | 192 | 15.5 | 19 / 20 / 21 | see DIN 974-1 | 27 |
| M20 | 2.5 | 245 | 17.5 | 21 / 22 / 24 | 33 | 30 |
| M22 | 2.5 | 303 | 19.5 | 23 / 24 / 26 | see DIN 974-1 | 33 |
| M24 | 3.0 | 353 | 21.0 | 25 / 26 / 28 | 40 | 36 |
| M27 | 3.0 | 459 | 24.0 | 28 / 30 / 32 | see DIN 974-1 | 40 |
| M30 | 3.5 | 561 | 26.5 | 31 / 33 / 35 | 48 | 45 |

Counterbore depth for ISO 4762 ≈ head height (= d) + 0.4 – 1 mm.

### 8.3 Preload and tightening torque – VDI 2230 style

Source: **values in the style of VDI 2230-1 Table A1** (the preloads were re-calculated with the VDI
formula below and agree with the published table). **Assumptions – all must be true, otherwise the
table is not valid:**

- Hexagon head bolts ISO 4014/4017 or socket head cap screws ISO 4762, **metric coarse thread**, shank
  bolts, steel nut or tapped hole in steel with enough engagement.
- Utilisation **ν = 0.9**: the combined (tension + torsion) stress during tightening = 90 % of the
  minimum yield strength Rp0.2 per ISO 898-1.
- **μ_G = μ_K = μ** (thread friction = head friction). μ = 0.10: oiled with MoS₂ paste or special
  coating; μ = 0.12: black-oxide or zinc-plated bolt, lightly oiled (most common); μ = 0.14: dry
  phosphated / dry zinc-plated. **The real μ has scatter – if unknown, use 0.12 and check with tests.**
- Medium clearance hole (ISO 273), standard head bearing diameter.
- F_M = **assembly preload** (maximum allowed during tightening). M_A = **tightening torque** to set on
  the wrench. The **minimum** preload after tightening is F_M / α_A (see 8.4).
- Formulas (d₂ = pitch diameter, d₀ = (d₂ + d₃)/2, D_Km = mean head bearing diameter):
  F_M = A_s · ν · Rp0.2 / √(1 + 3·[1.5·(d₂/d₀)·(P/(π·d₂) + 1.155·μ)]²)
  M_A = F_M · (0.16·P + 0.58·d₂·μ + μ·D_Km/2)

Preload F_M [kN]:

| Thread | 8.8 μ=0.10 | 8.8 μ=0.12 | 8.8 μ=0.14 | 10.9 μ=0.10 | 10.9 μ=0.12 | 10.9 μ=0.14 | 12.9 μ=0.10 | 12.9 μ=0.12 | 12.9 μ=0.14 |
|---|---|---|---|---|---|---|---|---|---|
| M4 | 4.5 | 4.4 | 4.3 | 6.7 | 6.5 | 6.3 | 7.8 | 7.6 | 7.4 |
| M5 | 7.4 | 7.2 | 7.0 | 10.8 | 10.6 | 10.3 | 12.7 | 12.4 | 12.0 |
| M6 | 10.4 | 10.2 | 9.9 | 15.3 | 14.9 | 14.5 | 17.9 | 17.5 | 17.0 |
| M8 | 19.1 | 18.6 | 18.1 | 28.0 | 27.3 | 26.6 | 32.8 | 32.0 | 31.1 |
| M10 | 30.3 | 29.6 | 28.8 | 44.5 | 43.4 | 42.2 | 52.1 | 50.8 | 49.4 |
| M12 | 44.1 | 43.0 | 41.9 | 64.8 | 63.2 | 61.5 | 75.9 | 74.0 | 72.0 |
| M14 | 60.6 | 59.1 | 57.5 | 88.9 | 86.7 | 84.4 | 104 | 101 | 98.8 |
| M16 | 82.9 | 80.9 | 78.8 | 122 | 119 | 116 | 142 | 139 | 135 |
| M18 | 104 | 102 | 99 | 149 | 145 | 141 | 174 | 170 | 165 |
| M20 | 134 | 130 | 127 | 190 | 186 | 181 | 223 | 217 | 212 |
| M22 | 166 | 162 | 158 | 237 | 231 | 225 | 277 | 271 | 264 |
| M24 | 192 | 188 | 183 | 274 | 267 | 260 | 320 | 313 | 305 |
| M27 | 252 | 246 | 240 | 359 | 351 | 342 | 420 | 410 | 400 |
| M30 | 307 | 300 | 292 | 437 | 427 | 416 | 511 | 499 | 487 |

Tightening torque M_A [N·m]:

| Thread | 8.8 μ=0.10 | 8.8 μ=0.12 | 8.8 μ=0.14 | 10.9 μ=0.10 | 10.9 μ=0.12 | 10.9 μ=0.14 | 12.9 μ=0.10 | 12.9 μ=0.12 | 12.9 μ=0.14 |
|---|---|---|---|---|---|---|---|---|---|
| M4 | 2.6 | 3.0 | 3.3 | 3.9 | 4.4 | 4.8 | 4.5 | 5.1 | 5.6 |
| M5 | 5.2 | 5.9 | 6.5 | 7.6 | 8.6 | 9.5 | 8.9 | 10 | 11 |
| M6 | 9.0 | 10.1 | 11.3 | 13.2 | 14.9 | 16.5 | 15.4 | 17.4 | 19.3 |
| M8 | 21.6 | 24.6 | 27.3 | 31.8 | 36.1 | 40.1 | 37.2 | 42.2 | 46.9 |
| M10 | 43 | 48 | 54 | 63 | 71 | 79 | 73 | 83 | 93 |
| M12 | 73 | 84 | 93 | 108 | 123 | 137 | 126 | 144 | 160 |
| M14 | 117 | 133 | 148 | 172 | 195 | 218 | 201 | 229 | 255 |
| M16 | 180 | 206 | 230 | 264 | 302 | 338 | 309 | 354 | 395 |
| M18 | 259 | 295 | 329 | 369 | 421 | 469 | 432 | 492 | 549 |
| M20 | 363 | 415 | 464 | 517 | 592 | 661 | 605 | 692 | 773 |
| M22 | 495 | 567 | 634 | 704 | 807 | 904 | 824 | 945 | 1057 |
| M24 | 625 | 714 | 798 | 890 | 1017 | 1136 | 1041 | 1190 | 1329 |
| M27 | 915 | 1050 | 1176 | 1304 | 1496 | 1674 | 1526 | 1750 | 1959 |
| M30 | 1246 | 1427 | 1597 | 1775 | 2033 | 2274 | 2077 | 2380 | 2662 |

**Example:** M12 – 10.9, black-oxide and lightly oiled, μ = 0.12 → M_A = 123 N·m, F_M max = 63.2 kN.
With a normal torque wrench (α_A = 1.6) the minimum preload is 63.2 / 1.6 ≈ 39.5 kN. Use 39.5 kN (minus
settling) in the joint calculation (sliding, opening).

**Do not use this table** for: fine threads, bolts into aluminium or cast iron with short engagement (the
internal thread fails first – see 8.5), stainless bolts (galling, other μ), bolts re-used many times,
bolts with soft washers or in slotted holes.

### 8.4 Tightening factor α_A and joint checks

Source type: VDI 2230-1 (tightening factor table, simplified).

| Tightening method | α_A = F_M,max / F_M,min | Scatter of preload |
|---|---|---|
| Yield-point controlled or angle-controlled tightening | 1.0 – 1.2 | ±5 – 10 % |
| Torque wrench / electronic torque tool, μ determined by tests on the real parts | 1.4 – 1.6 | ±17 – 23 % |
| Torque wrench, μ estimated (normal workshop) | 1.6 – 1.8 | ±23 – 28 % |
| Impact wrench with adjustment | 2.5 – 4 | ±43 – 60 % |
| By hand / by feel | not allowed for load-carrying joints | |

Simple check for a joint loaded across the bolt axis (load carried by friction):
F_Q ≤ (F_M / α_A − F_Z) · μ_T · q / S_G
F_Q = transverse load, F_Z = preload loss by settling (≈ 5 – 10 % of F_M for machined faces), μ_T =
interface friction (steel/steel dry, machined: ≈ 0.1 – 0.2, use 0.10 – 0.15 for design), q = number of
friction faces, S_G = safety against slip ≈ 1.2 – 1.8.

Surface pressure under the head p = F_M / A_head must be below the limit of the clamped material.
Approximate limits (VDI 2230-1 Table A9 style – **check the table**): S235 ≈ 490 MPa, S355 ≈ 760 MPa,
C45 ≈ 630 – 700 MPa, 42CrMo4+QT ≈ 850 MPa, EN-GJL-250 ≈ 850 MPa, EN-GJS-400 ≈ 600 MPa, 6082-T6
≈ 360 MPa. If too high → hardened washer (ISO 7089 300 HV) or flange head.

### 8.5 Minimum thread engagement in tapped holes (blind holes)

Source type: common design guidance (VDI 2230 principle "the internal thread must not fail before the
bolt"; values in the style of Roloff/Matek and fastener makers). For **metric coarse thread**, bolt
fully preloaded. In doubt take the longer value or calculate per VDI 2230.

| Material of the tapped part | for 8.8 | for 10.9 | for 12.9 |
|---|---|---|---|
| Steel Rm 400 – 600 MPa (S235, S355, C45+N) | 1.0 – 1.25·d | 1.25 – 1.4·d | 1.4 – 1.6·d |
| Steel Rm > 800 MPa (C45+QT, 42CrMo4+QT) | 0.8 – 1.0·d | 1.0·d | 1.0 – 1.2·d |
| Grey cast iron EN-GJL-250/300 | 1.25 – 1.5·d | 1.5 – 1.75·d | not recommended |
| Ductile iron EN-GJS-400/600 | 1.0 – 1.25·d | 1.25 – 1.5·d | 1.5·d |
| Aluminium wrought, hardened (6082-T6, 7075-T6) | 1.6 – 2.0·d (7075: 1.25 – 1.6·d) | 2.0 – 2.5·d | thread insert |
| Aluminium soft / cast (5083, AlSi cast) | 2.0 – 2.5·d | thread insert | thread insert |
| Plastics | use inserts | | |

Wire thread inserts in aluminium: engagement 1.5 – 2·d is common, threads survive many re-assemblies.
Tap depth = engagement + ≈ 3 × P (run-out of the tap); drill depth = tap depth + ≈ 0.3·d (drill point).

### 8.6 Washers and locking methods

| Item | Standard | Use / rule |
|---|---|---|
| Plain washer 200 HV | ISO 7089 / 7090 (chamfered) | up to class 8.8 |
| Plain washer 300 HV (hardened) | ISO 7089 / 7090, 300 HV | 10.9 and 12.9, or high surface pressure on soft material |
| Small washer for socket head cap screws | ISO 7092 | when the counterbore is small |
| Spring washers (DIN 127), toothed / serrated washers (DIN 6797/6798) | **withdrawn standards** | **not effective** with preloaded 8.8 – 12.9 bolts – do not use as locking |

Locking methods (effect known from transverse vibration tests per DIN 65151, Junker principle):

| Method | Type | Effect | Note |
|---|---|---|---|
| Correct, high preload (long elastic bolt, clamp length ≥ 3 – 5·d) | – | **best basic measure** | most loosening comes from too low preload or slip of the joint |
| Anaerobic thread locker (medium strength) | prevents loosening and loss | very good | threads clean and oil-free; medium = removable with tools; high = needs ≈ 250 °C heat |
| Wedge-locking washer pair (cam faces) | prevents loosening | very good | works with high-strength bolts |
| Prevailing torque nut (ISO 7040 nylon insert; ISO 7042 all-metal) | prevents loss (not loosening) | good for loss | nylon up to ≈ 120 °C; re-use limited |
| Lock wire, split pin + castle nut | prevents loss | good | for safety-critical, low-preload joints |
| Ribbed flange bolts / nuts | prevents loosening | good | damages the surface; not on hardened faces |
| Spring washer, toothed washer | – | **none / poor** | do not use |

### 8.7 Dowel (parallel) pins – ISO 2338 and ISO 8734

Source: ISO 2338 (unhardened, tolerance m6 or h8) and ISO 8734 (hardened, m6; type A through hardened,
type B case hardened – hardness per the standard).

| Item | ISO 2338 | ISO 8734 |
|---|---|---|
| Material | unhardened steel (or austenitic stainless) | hardened steel (or martensitic stainless) |
| Tolerance | m6 (locating) or h8 | m6 |
| Use | simple locating, low accuracy | **precise locating of fixtures, pallets, frames, housings** |
| Hole | H7 reamed (m6 pin → press fit) | H7 reamed / ground; in hardened parts ground or wire-EDM |

Standard diameters: 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25 mm (more in the standard).

Rules:
- **Two pins per joint**, as far apart as possible. For a joint that will be dismantled: press the pin in
  one part and let it slide (H7/h6 or G7/h6) in the other; or use one round pin + one **diamond
  (relieved) pin** to avoid over-constraint.
- Drill and ream the holes of both parts **together** (bolted, one set-up) for best accuracy.
- Use pins with internal thread (ISO 8735) or through holes, so pins can be pulled out.
- Pins locate, **bolts clamp**. Design the joint so that friction carries the load; pins are the backup.
- Engagement length: ≈ 1.5 – 2·d in each part.

Pin shear check (double shear): τ = F / (2 · π · d² / 4) ≤ τ_allow. Orientation: hardened pins (ISO 8734)
τ_allow ≈ 250 – 350 MPa static; unhardened (ISO 2338) ≈ 80 – 120 MPa. ISO 8734 gives minimum double-shear
loads – use them or the maker's table for final design.

Taper pins (ISO 2339, taper 1:50): re-locate very accurately after dismantling; ream with a taper reamer
in the assembled parts.

---

## 9. Welding

### 9.1 Welding processes (ISO 4063 numbers)

| No. | Process | Use in this project | Notes |
|---|---|---|---|
| 111 | Manual metal arc (MMA, stick electrode) | site work, repairs, anchors, outdoor | slow; good in all positions and wind; basic (low-hydrogen) electrodes for thick S355 and preheated jobs |
| 135 | MAG with solid wire | **main process for steel frames** (S235, S355) in the workshop | fast, good quality; shielding gas Ar/CO₂ mix (e.g. ISO 14175 M21) |
| 136 | MAG with flux-cored wire | thick plates, positional welding, high deposition | slag to remove |
| 141 | TIG | stainless 1.4301, aluminium, thin sheet, root passes, precise small parts | slow, best quality; AC for aluminium |
| 131 | MIG (inert gas) | aluminium (5083, 6082) | argon or Ar/He |
| 121 | Submerged arc (SAW) | long straight seams, very thick plate | usually at a subcontractor |

Welder qualification: ISO 9606-1 (steel), ISO 9606-2 (aluminium). Welding procedure qualification:
ISO 15614-1. Quality requirements of the welding shop: ISO 3834 (part 3 "standard" is usual for machine
frames).

### 9.2 Fillet weld size and simple stress check

**Throat thickness a** = height of the largest isosceles triangle inside the weld. Leg length
z = a · √2 ≈ 1.41·a.

Rules (common practice, EN 1993-1-8 and design handbooks):
- a ≥ 3 mm for load-carrying welds.
- a ≤ 0.7 · t_min (t_min = thinner plate).
- Effective length l ≥ 30 mm and ≥ 6·a; subtract the craters at open ends if they are not filled.

**Simplified method (static; the force divided by the throat area is checked against one design value):**
τ_w = F_d / (Σ a · l) ≤ f_vw,d

Design strength per EN 1993-1-8 simplified method (use **factored loads** F_d = γ_F · F, γ_F ≈ 1.35 – 1.5):
f_vw,d = f_u / (√3 · β_w · γ_M2), γ_M2 = 1.25.

| Base material (t ≤ 40 mm) | f_u [MPa] | β_w | f_vw,d [MPa] |
|---|---|---|---|
| S235 | 360 | 0.80 | 360 / (1.732 · 0.80 · 1.25) = **208** |
| S355 | 470 | 0.90 | 470 / (1.732 · 0.90 · 1.25) = **241** |

**Example:** bracket with 2 fillet welds a = 4 mm, l = 120 mm each, S355, service load F = 50 kN →
F_d = 1.5 · 50 = 75 kN. τ_w = 75 000 / (2 · 4 · 120) = 78 MPa ≤ 241 MPa → OK.

**Fatigue:** for parts with cyclic loads (lift columns, AGV frames, APC arm) the static check is **not
enough**. Fatigue strength of welded details is low: FAT classes (IIW recommendations, EN 1993-1-9)
for fillet-welded details are roughly 36 – 80 MPa **stress range** at 2·10⁶ cycles. Keep stress ranges
in welds low, put welds away from high-stress zones, do not end welds at notches; check with IIW / EN
1993-1-9 for each detail.

### 9.3 Quality levels ISO 5817

| Level | Meaning | Use |
|---|---|---|
| **B** | stringent – smallest allowed imperfections | dynamically loaded or safety-relevant welds (lifting parts, highly loaded columns) |
| **C** | intermediate | **normal machine frames and brackets** in this project |
| **D** | moderate | covers, guards, non-load-carrying welds |

Write the level on the drawing ("ISO 5817-C"). For level B plan 100 % visual inspection (ISO 17637) and
surface crack testing (MT, ISO 17638 / PT, ISO 3452) of critical welds.

### 9.4 Carbon equivalent and preheating

Carbon equivalent (IIW formula, used in EN 10025 and EN 1011-2):

**CE = C + Mn/6 + (Cr + Mo + V)/5 + (Ni + Cu)/15** (contents in %)

| Steel | Typical analysis (%) | CE |
|---|---|---|
| S355J2 | C 0.18, Mn 1.4, other elements small | 0.18 + 0.233 + ≈ 0.02 ≈ **0.43** (max per EN 10025-2: 0.45 – 0.47 depending on thickness) |
| C45 | C 0.45, Mn 0.65, Cr ≤ 0.4 | 0.45 + 0.108 + (0 … 0.08) ≈ **0.56 – 0.64** |
| 42CrMo4 | C 0.42, Mn 0.75, Cr 1.05, Mo 0.22 | 0.42 + 0.125 + 0.254 ≈ **0.80** |

Preheat – rule of thumb (orientation only; the binding method is **EN 1011-2** with combined thickness,
heat input and hydrogen content, or your qualified welding procedure):

| CE | Preheat (combined thickness ≈ 20 – 50 mm, low-hydrogen consumables) |
|---|---|
| ≤ 0.40 | normally none (part dry and ≥ ≈ 5 – 20 °C) |
| 0.40 – 0.50 | ≈ 50 – 150 °C for thick parts |
| 0.50 – 0.60 | ≈ 150 – 250 °C |
| > 0.60 | ≈ 250 – 350 °C + slow cooling + post-weld heat treatment |

So: **C45 → preheat ≈ 150 – 300 °C; 42CrMo4 → ≈ 250 – 350 °C**, then stress relief / temper after
welding. Best practice in this project: **do not weld C45, 42CrMo4 or case hardening steels** in
load-carrying joints – bolt and pin them to a welded S355 frame.

### 9.5 Weld symbols – basics (ISO 2553, system A)

```
                     a5 ◺ 2×100 (200)        135 / ISO 5817-C
   ────────────────────────────────────────<   reference line (solid) + tail (fork)
   - - - - - - - - - - - - - - - - - - - -     identification line (dashed)
  /
 /  arrow line → points to the joint
```

| Element | Meaning |
|---|---|
| Triangle ◺ | fillet weld |
| I, V, Y, ½V (bevel) … symbols | butt weld preparations |
| Symbol **on the solid line** | weld on the arrow side |
| Symbol **on the dashed line** | weld on the other side |
| a5 | throat thickness 5 mm (z5 = leg length 5 mm – always write "a" or "z") |
| 2×100 (200) | intermittent weld: 2 welds of 100 mm length at 200 mm pitch |
| Circle at the bend of the arrow | weld all around |
| Flag at the bend | site (field) weld |
| Fork (tail) at the end of the reference line | extra information: process number, quality level, position, consumable |

---

## 10. Machining data

Source type: **starting values** from tool makers' general catalogue ranges and machining handbooks.
Real values depend on tool grade, coating, machine stiffness, clamping, coolant. **Use the cutting data
of your tool maker first; these tables are for planning and plausibility checks.** vc in m/min.

### 10.1 Basic formulas

| Quantity | Formula | Example |
|---|---|---|
| Spindle speed | n = vc · 1000 / (π · D) [min⁻¹] | vc = 200, D = 63 → n = 1010 min⁻¹ |
| Feed rate, milling | vf = fz · z · n [mm/min] | fz = 0.15, z = 5, n = 1010 → vf = 758 mm/min |
| Feed rate, turning / drilling | vf = f · n | f = 0.25, n = 800 → 200 mm/min |
| Metal removal rate | milling Q = ap · ae · vf / 1000; turning Q = ap · f · vc [cm³/min] | ap 3, f 0.3, vc 200 → Q = 180 cm³/min |
| Chip thickness, turning | h = f · sin κ | κ = 90° → h = f |
| Cutting force (Kienzle) | Fc = b · h · kc with kc = kc1.1 · h^(−mc); b · h = ap · f | see 10.6 |
| Cutting power | Pc = Fc · vc / 60 000 [kW]; motor P = Pc / η (η ≈ 0.75 – 0.85) | |
| Tapping feed | vf = P · n (P = pitch) | M10, n = 400 → 600 mm/min |

### 10.2 Turning – starting values

| Material | Hardness | Carbide (coated) vc | f [mm/rev] (finish – rough) | HSS vc |
|---|---|---|---|---|
| S235, S355 | 120 – 190 HB | 200 – 300 | 0.1 – 0.5 | 30 – 45 |
| C45 +N | 180 – 220 HB | 180 – 260 | 0.1 – 0.5 | 25 – 35 |
| 42CrMo4 +QT, 34CrNiMo6 +QT | 250 – 330 HB | 120 – 200 | 0.1 – 0.4 | 15 – 25 |
| 16MnCr5 / 20MnCr5 +FP | 150 – 200 HB | 180 – 280 | 0.1 – 0.5 | 25 – 40 |
| 1.2312 pre-hardened | 280 – 325 HB | 120 – 180 | 0.1 – 0.35 | 12 – 20 |
| Hardened steel (hard turning with CBN) | 55 – 62 HRC | CBN: 100 – 200 | 0.05 – 0.15 (ap ≤ 0.3) | – |
| X5CrNi18-10 | ≈ 180 HB | 150 – 230 | 0.1 – 0.4 | 15 – 25 |
| EN-GJL-250/300 | 180 – 270 HB | 180 – 300 | 0.1 – 0.5 | 20 – 30 |
| EN-GJS-400/600 | 150 – 270 HB | 150 – 250 | 0.1 – 0.4 | 18 – 28 |
| Aluminium 6082 / 7075 / 5083 | 75 – 150 HB | 400 – 1500 (sharp uncoated or PCD) | 0.1 – 0.4 | 150 – 300 |
| Tin bronze CuSn12, CuSn12Ni2 | 80 – 95 HB | 150 – 300 | 0.1 – 0.3 | 40 – 70 |
| Aluminium bronze CuAl10Fe5Ni5 | 140 – 180 HB | 100 – 200 | 0.1 – 0.3 | 20 – 35 |
| Brass CuZn39Pb3 | ≈ 100 HB | 250 – 500 | 0.1 – 0.4 | 80 – 150 |
| POM, PA, PE-UHMW | – | 200 – 500 (sharp, positive) | 0.1 – 0.3 | 100 – 300 |

Depth of cut ap: finishing 0.2 – 1 mm, roughing 2 – 6 mm (depends on insert size).

### 10.3 Milling – starting values (end mills and face mills)

| Material | Carbide vc | fz [mm/tooth]: end mill Ø 10 – 20 / face mill | HSS (HSS-E, HSS-Co) vc |
|---|---|---|---|
| S235, S355 | 150 – 250 | 0.05 – 0.10 / 0.10 – 0.25 | 25 – 40 |
| C45 +N | 140 – 220 | 0.05 – 0.10 / 0.10 – 0.20 | 20 – 30 |
| 42CrMo4 +QT, 1.2312 | 100 – 180 | 0.04 – 0.08 / 0.08 – 0.20 | 12 – 20 |
| Hardened steel 50 – 62 HRC | 60 – 150 (special grades) | 0.02 – 0.06 (small ae) | – |
| X5CrNi18-10 | 100 – 180 | 0.04 – 0.08 / 0.08 – 0.18 | 12 – 20 |
| EN-GJL-250/300 | 150 – 250 | 0.08 – 0.15 / 0.12 – 0.30 | 18 – 28 |
| EN-GJS-400/600 | 120 – 220 | 0.06 – 0.12 / 0.10 – 0.25 | 15 – 25 |
| Aluminium | 300 – 1000 and more | 0.05 – 0.15 / 0.10 – 0.30 | 100 – 300 |
| Tin bronze | 150 – 300 | 0.05 – 0.10 / 0.10 – 0.20 | 30 – 60 |

### 10.4 Drilling and tapping – starting values

| Material | HSS drill vc | Carbide drill vc | Feed f [mm/rev] HSS (Ø 5 / 10 / 20) | Tap HSS-E vc | Tap carbide vc |
|---|---|---|---|---|---|
| S235, S355, C45 +N | 20 – 30 | 70 – 120 | 0.08 / 0.15 / 0.25 (carbide ≈ 1.5×) | 10 – 20 | 20 – 40 |
| 42CrMo4 +QT, 1.2312 | 12 – 18 | 50 – 90 | 0.06 / 0.12 / 0.20 | 6 – 12 | 15 – 25 |
| X5CrNi18-10 | 8 – 15 | 40 – 70 | 0.05 / 0.10 / 0.18 | 5 – 10 | 10 – 20 |
| EN-GJL / GJS | 20 – 30 | 70 – 120 | 0.12 / 0.20 / 0.35 | 10 – 20 | 20 – 40 |
| Aluminium | 60 – 100 | 150 – 300 | 0.10 / 0.20 / 0.35 | 20 – 40 | 30 – 60 |
| Bronze / brass | 30 – 60 | 80 – 150 | 0.10 / 0.18 / 0.30 | 10 – 25 | 20 – 40 |

Rule of thumb for HSS drill feed in steel: f ≈ 0.01 – 0.02 · D. Reaming: vc ≈ 1/2 – 2/3 of drilling vc,
feed ≈ 2 – 3 × drilling feed, stock ≈ 0.1 – 0.3 mm on the diameter (more for bigger Ø). Form taps (no
chips) are good in steel up to ≈ 1000 MPa and in aluminium – they need a **bigger core hole** than
cutting taps (take it from the tap maker's table).

### 10.5 Grinding – starting values

| Item | Value |
|---|---|
| Wheel speed vs, vitrified Al₂O₃ / SiC | 30 – 35 m/s (higher, e.g. 45 – 63 m/s, **only if the wheel is marked for it**, EN 12413) |
| Wheel speed vs, CBN | 35 – 60 m/s (more on special machines) |
| Work speed, cylindrical grinding vw | 10 – 30 m/min (speed ratio q = vs / vw ≈ 60 – 100) |
| Table speed, surface grinding | 10 – 30 m/min |
| Infeed per pass – roughing | 0.01 – 0.03 mm |
| Infeed per pass – finishing | 0.002 – 0.005 mm, then spark-out (2 – 4 passes without infeed) |
| Cross feed per stroke (surface grinding) | 1/3 – 1/2 of wheel width (rough), 1/10 – 1/5 (finish) |
| Grinding stock after hardening | 0.1 – 0.3 mm per side (depends on size and distortion) |
| Wheel for hardened steel 58 – 62 HRC | white / pink Al₂O₃, soft – medium grade (about H – K), or CBN |
| Coolant | plenty and filtered. Grinding burn lowers hardness – check worms and gears with nital etching (ISO 14104) |

### 10.6 Specific cutting force – Kienzle values kc1.1 and mc

Source type: values from common machining handbooks (König/Klocke, Tabellenbuch-type tables, tool maker
data). **Sources differ by about ±10 – 20 %** – ranges are given. kc1.1 = specific cutting force for
h = 1 mm and b = 1 mm [N/mm²]; for carbide, rake angle ≈ 6°, sharp tool. Add ≈ 20 – 30 % for a worn tool.

| Material | kc1.1 [N/mm²] | mc |
|---|---|---|
| S235JR | ≈ 1780 | ≈ 0.17 |
| E295 / S275 type | ≈ 1990 | ≈ 0.26 |
| S355J2 | ≈ 2000 – 2250 | ≈ 0.25 – 0.30 |
| C45 (+N) | ≈ 1700 – 2220 | ≈ 0.14 – 0.26 |
| 42CrMo4 (annealed / QT) | ≈ 2100 – 2500 | ≈ 0.26 |
| 16MnCr5 / 20MnCr5 | ≈ 2100 | ≈ 0.26 |
| X5CrNi18-10 | ≈ 2350 – 2600 | ≈ 0.18 – 0.21 |
| EN-GJL-250 | ≈ 1100 – 1160 | ≈ 0.26 |
| EN-GJS-400 / 600 | ≈ 1000 – 1500 (GJS-600 at the high end) | ≈ 0.25 – 0.30 |
| Aluminium wrought alloys | ≈ 700 – 850 | ≈ 0.23 – 0.25 |
| Tin bronze | ≈ 1000 – 1800 (wide spread) | ≈ 0.15 – 0.25 |
| Brass CuZn39Pb3 | ≈ 780 | ≈ 0.18 |

**Example (turning C45, carbide):** ap = 3 mm, f = 0.3 mm, κ = 90°, vc = 200 m/min, kc1.1 = 2220,
mc = 0.14 → h = 0.3 mm; kc = 2220 · 0.3^(−0.14) = 2220 · 1.18 = 2630 N/mm²;
Fc = 3 · 0.3 · 2630 = 2370 N; Pc = 2370 · 200 / 60 000 = 7.9 kW; motor ≥ 7.9 / 0.8 ≈ 9.9 kW.
Use the high end of the kc range for machine sizing.

---

## 11. Bearings, keys, shafts, circlips

### 11.1 Rolling bearing life (ISO 281)

Source: **ISO 281** (basic rating life and modified life). Take C, C₀ and the fatigue load limit from
the bearing maker's catalogue.

| Formula | Meaning |
|---|---|
| L₁₀ = (C / P)^p [10⁶ revolutions] | basic rating life (90 % of bearings reach it) |
| p = 3 ball bearings; p = 10/3 roller bearings | life exponent |
| L₁₀h = 10⁶ / (60 · n) · L₁₀ [h] | life in hours at speed n [min⁻¹] |
| L_nm = a₁ · a_ISO · L₁₀ | modified life: a₁ reliability, a_ISO lubrication / contamination / fatigue limit (from the maker's diagrams; 0.1 … 50) |
| P = X · F_r + Y · F_a | equivalent dynamic load (X, Y from the catalogue) |
| s₀ = C₀ / P₀ | static safety: ≥ 1 normal; ≥ 1.5 – 2 smooth running / accuracy; ≥ 2 – 4 shock or precise tables |

Life factor a₁ (ISO 281):

| Reliability | 90 % | 95 % | 96 % | 97 % | 98 % | 99 % |
|---|---|---|---|---|---|---|
| a₁ | 1 | 0.64 | 0.55 | 0.47 | 0.37 | 0.25 |

Typical required life L₁₀h (orientation from bearing makers' catalogues):

| Machine type | L₁₀h [h] |
|---|---|
| Machines used now and then (hand tools, maintenance devices) | 3 000 – 8 000 |
| Machines for 8 h/day, not always fully used (gearboxes, AGV wheels) | 10 000 – 25 000 |
| Machines for 8 h/day, fully used (machine tools, conveyors) | 20 000 – 30 000 |
| Machines for 24 h/day continuous (pumps, fans, main conveyors) | 40 000 – 50 000 |
| Machine tool spindles, rotary tables | 20 000 – 50 000 (accuracy usually decides first) |

**Example:** deep groove ball bearing C = 30.7 kN, P = 3 kN, n = 500 min⁻¹ →
L₁₀ = (30.7/3)³ = 1072 · 10⁶ rev → L₁₀h = 10⁶ / (60 · 500) · 1072 = 35 700 h.

### 11.2 Parallel keys – DIN 6885-1 (form A, high type)

Source: **values per DIN 6885-1** (ISO 773 is similar). Dimensions in mm. t₁ = keyway depth in the
shaft, t₂ = depth in the hub. Check the standard for tolerances of t₁, t₂ and key lengths.

| Shaft Ø over – up to | b × h | t₁ (shaft) | t₂ (hub) |
|---|---|---|---|
| 6 – 8 | 2 × 2 | 1.2 | 1.0 |
| 8 – 10 | 3 × 3 | 1.8 | 1.4 |
| 10 – 12 | 4 × 4 | 2.5 | 1.8 |
| 12 – 17 | 5 × 5 | 3.0 | 2.3 |
| 17 – 22 | 6 × 6 | 3.5 | 2.8 |
| 22 – 30 | 8 × 7 | 4.0 | 3.3 |
| 30 – 38 | 10 × 8 | 5.0 | 3.3 |
| 38 – 44 | 12 × 8 | 5.0 | 3.3 |
| 44 – 50 | 14 × 9 | 5.5 | 3.8 |
| 50 – 58 | 16 × 10 | 6.0 | 4.3 |
| 58 – 65 | 18 × 11 | 7.0 | 4.4 |
| 65 – 75 | 20 × 12 | 7.5 | 4.9 |
| 75 – 85 | 22 × 14 | 9.0 | 5.4 |
| 85 – 95 | 25 × 14 | 9.0 | 5.4 |
| 95 – 110 | 28 × 16 | 10.0 | 6.4 |
| 110 – 130 | 32 × 18 | 11.0 | 7.4 |
| 130 – 150 | 36 × 20 | 12.0 | 8.4 |
| 150 – 170 | 40 × 22 | 13.0 | 9.4 |
| 170 – 200 | 45 × 25 | 15.0 | 10.4 |
| 200 – 230 | 50 × 28 | 17.0 | 11.4 |

Standard key lengths (selection): 10, 12, 14, 16, 18, 20, 22, 25, 28, 32, 36, 40, 45, 50, 56, 63, 70,
80, 90, 100, 110, 125, 140, 160, 180, 200 mm.

Keyway width tolerances: key b = h9. Normal fit: shaft N9, hub JS9. Tight fit: shaft P9, hub P9.
Sliding hub: shaft H9, hub D10.

Key check (surface pressure on the hub side, the weaker side):
p = 2 · T / (d · (h − t₁) · l_eff · i · φ) ≤ p_allow
l_eff = l − b (form A, round ends), i = number of keys, φ = 1 (one key), 0.75 (two keys).
p_allow (static, orientation – Roloff/Matek style): steel hub ≈ 100 – 150 MPa, cast iron / GJL hub
≈ 50 – 80 MPa, aluminium hub ≈ 40 – 60 MPa. Use the low value for shock loads.

**Example:** T = 300 N·m, d = 40 (key 12 × 8, t₁ = 5), l = 50, steel hub → l_eff = 38 mm;
p = 2 · 300 000 / (40 · 3 · 38) = 132 MPa → borderline → longer key (l = 63 → p = 98 MPa OK) or shrink fit.

### 11.3 Shaft diameter – first estimate

From torsion with a low allowed stress (the low value covers bending, notches and fatigue that are not
yet known):

**d ≥ ∛(16 · T / (π · τ_allow))**

| Shaft material | τ_allow for first estimate [MPa] |
|---|---|
| S235, S275 | 12 – 20 |
| S355, C45+N | 15 – 30 |
| 42CrMo4+QT | 25 – 40 |

**Example:** T = 500 N·m, C45, τ_allow = 30 MPa →
d ≥ ∛(16 · 500 000 / (π · 30)) = ∛(84 883) = 43.9 mm → choose Ø 45 (then check bending + torsion and
fatigue at the notches with DIN 743 or an FEM, and the deflection at bearings and gears).

Torsion angle: φ = T · L / (G · I_p), I_p = π · d⁴ / 32. Machine tool drives: φ ≤ ≈ 0.25° per metre
(guide value).

Other useful formulas:
- Bending stress: σ_b = M / W, W = π · d³ / 32 (solid round)
- Torsion stress: τ_t = T / W_p, W_p = π · d³ / 16
- Equivalent stress (von Mises, steel): σ_v = √(σ_b² + 3 · (α₀ · τ_t)²), α₀ ≈ 0.7 for bending
  alternating + torsion constant.

### 11.4 Circlips (retaining rings) – DIN 471 / DIN 472 (ISO 464 for groove-type rings)

| Item | Rule |
|---|---|
| Types | DIN 471 for shafts (external), DIN 472 for bores (internal); DIN 6799 E-clips for small shafts (radial assembly) |
| Groove dimensions | take **groove diameter, width and edge distance from the standard / maker table** for each size |
| Edge distance | the material outside the groove (n) must be at least the value in the table, else the groove edge yields |
| Axial load | the ring can carry high load only with a **sharp-edged** abutting part; with chamfered parts or bearing radii the allowed load falls strongly – use a support washer |
| Not for | precise axial positioning without play (rings have axial play) – use a shaft nut, spacer or clamped end plate instead |
| Groove effect on the shaft | sharp notch (stress concentration factor ≈ 2.5 – 4); put grooves in low-stress areas |

---

## 12. Springs, friction, rolling resistance

### 12.1 Springs – basic formulas

| Spring | Formula |
|---|---|
| Any spring | F = c · s (c = spring rate N/mm, s = deflection mm) |
| Helical compression / tension spring (EN 13906-1) | c = G · d⁴ / (8 · D³ · n) ; τ = 8 · F · D · k / (π · d³) |
| Symbols | d = wire Ø, D = mean coil Ø, n = active coils, k = Bergsträsser / Wahl factor ≈ (w + 0.5)/(w − 0.75), w = D/d |
| Shear modulus G | spring steel EN 10270-1: 81 500 MPa; stainless EN 10270-3 (1.4310): ≈ 70 000 MPa |
| Allowed shear stress (static, orientation) | ≈ 0.5 · Rm of the wire (EN 13906-1 approach); Rm of spring wire depends strongly on the diameter (≈ 1500 – 2300 MPa for d ≈ 1 – 6 mm, EN 10270-1) |
| Disc springs (DIN EN 16983 / former DIN 2093) | for high force and small stroke – values from maker tables |
| Gas springs | force from catalogue; force rises with temperature (≈ 0.35 % per K) |

**Example:** d = 4 mm, D = 32 mm, n = 8, G = 81 500 MPa →
c = 81 500 · 256 / (8 · 32 768 · 8) = 9.95 N/mm.

### 12.2 Friction coefficients

Source type: typical values from engineering handbooks (Roloff/Matek, Dubbel, Machinery's Handbook,
supplier data). **Friction values vary a lot** with surface condition, contamination, speed and
humidity. Rule: where friction must **hold** (clamping, traction) use the **low** value; where friction
**resists** motion (drive power) use the **high** value.

| Pair | Static μ₀ | Sliding μ | Note |
|---|---|---|---|
| Steel / steel, dry, machined | 0.15 – 0.3 (clean, degreased up to ≈ 0.5 – 0.8) | 0.1 – 0.2 (up to ≈ 0.5 very clean) | for bolted joint interfaces use 0.10 – 0.15 |
| Steel / steel, lubricated | 0.10 – 0.12 | 0.05 – 0.10 | |
| Steel / grey cast iron, dry | 0.18 – 0.25 | 0.15 – 0.2 | |
| Steel / bronze, dry | 0.15 – 0.2 | 0.1 – 0.2 | |
| Steel / bronze, lubricated | 0.10 | 0.05 – 0.1 (mixed friction), ≈ 0.01 hydrodynamic | |
| Steel / PTFE | 0.04 – 0.1 | 0.04 – 0.1 | |
| Steel / PE-UHMW, dry | 0.15 – 0.25 | 0.1 – 0.25 | slide strips for crates/pallets |
| Steel / POM, dry | 0.2 – 0.35 | 0.15 – 0.3 | |
| Steel / PA6, dry | 0.25 – 0.4 | 0.2 – 0.4 | |
| Steel / PU (elastomer) | 0.5 – 0.8 | 0.3 – 0.6 | |
| Rubber / concrete, dry | 0.6 – 0.9 | 0.5 – 0.8 | |
| Rubber / concrete, wet | 0.45 – 0.7 | 0.4 – 0.6 | |
| PU wheel / concrete or epoxy floor, dry, clean | 0.5 – 0.8 | – | AGV traction: **design with 0.3 – 0.5** (dust, wet spots, oil) |
| PU wheel / floor, wet or dusty | 0.3 – 0.5 | – | |
| Steel wheel / steel rail | 0.15 – 0.25 | 0.1 | |
| Wood (pallet) / steel, dry | 0.3 – 0.5 | 0.2 – 0.4 | |
| Steel / steel, roller guides (linear rails) | – | 0.002 – 0.005 (rolling) + seal friction | from rail maker |

### 12.3 Rolling resistance

Rolling resistance force F_R = μ_R · F_N (or F_R = f · F_N / r with lever arm f [mm] and wheel radius r).

| Wheel / floor | μ_R (orientation) | Lever arm f [mm] |
|---|---|---|
| Steel wheel / steel rail | 0.001 – 0.002 | 0.3 – 0.5 |
| PA (nylon) wheel / smooth concrete | 0.005 – 0.01 | – |
| PU wheel (90 – 95 Shore A) / smooth concrete or epoxy | 0.01 – 0.02 | ≈ 0.5 – 1.5 (depends on Ø and load) |
| Solid rubber wheel / concrete | 0.015 – 0.03 | – |
| Pneumatic tyre / concrete | 0.01 – 0.02 | – |
| Any wheel / floor with joints, cracks or dirt | add 50 – 100 % | |

Add **bearing friction** of castors (≈ 0.002 – 0.005 relative to load) and **swivel resistance** of
castors when starting a turn. AGV drive design (guide 11): F_drive = m·g·(μ_R + sin α) + m·a, check that
F_drive ≤ μ_traction · load on the drive wheels.

---

## 13. Hydraulics and pneumatics

### 13.1 Standard sizes – cylinders (ISO 3320) and pressure (ISO 2944)

Source: ISO 3320 (bore and rod diameters), ISO 2944 (nominal pressures), ISO 6020-2 / ISO 6022
(hydraulic mounting dimensions, 160 / 250 bar), ISO 15552 (pneumatic cylinders Ø 32 – 320).

| Item | Standard values |
|---|---|
| Bore diameters [mm] | 8, 10, 12, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 320, 400, 500 |
| Rod diameters [mm] | 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32, 36, 40, 45, 50, 56, 63, 70, 80, 90, 100, 110, 125, 140, 160, 180, 200, 220, 250, 280, 320, 360 |
| Nominal pressures [bar] (ISO 2944, selection) | 10, 16, 25, 40, 63, 100, 160, 250, 315, 400 |
| Typical cylinder series | hydraulic ISO 6020-2 = 160 bar; ISO 6022 = 250 bar; pneumatic ISO 15552 / ISO 6432 (Ø 8 – 25) / ISO 21287 (compact) at 6 – 10 bar |

Common hydraulic bore/rod pairs (ISO 6020-2 style) and areas:

| Bore [mm] | Piston area [cm²] | Rod (small / big) [mm] | Annulus area with small rod [cm²] | Force push at 100 bar [kN] |
|---|---|---|---|---|
| 25 | 4.91 | 12 / 18 | 3.78 | 4.9 |
| 32 | 8.04 | 14 / 22 | 6.50 | 8.0 |
| 40 | 12.57 | 18 / 28 | 10.02 | 12.6 |
| 50 | 19.63 | 22 / 36 | 15.83 | 19.6 |
| 63 | 31.17 | 28 / 45 | 25.01 | 31.2 |
| 80 | 50.27 | 36 / 56 | 40.09 | 50.3 |
| 100 | 78.54 | 45 / 70 | 62.64 | 78.5 |
| 125 | 122.7 | 56 / 90 | 98.1 | 122.7 |
| 160 | 201.1 | 70 / 110 | 162.6 | 201.1 |

Formulas: F = p · A (p in MPa = 10 bar, A in mm² → N). Speed v = Q / A. Q [l/min] = A [cm²] · v [m/min] / 10.
Example: Ø 63, v = 6 m/min → Q = 31.17 · 6 / 10 = 18.7 l/min.

Rod buckling (Euler): F_k = π² · E · I / L_k², I = π · d⁴ / 64, L_k = buckling length (depends on the
mounting: e.g. both ends pivoted L_k = L; one end fixed, one end free L_k = 2·L). Safety ≥ 3 – 5 on
the Euler load.

### 13.2 Pipes and flow velocity

Source type: common hydraulic design guidance (hydraulic component makers; values also in ISO 4413
commentary literature).

| Line | Flow velocity |
|---|---|
| Suction line (pump inlet) | **0.5 – 1.5 m/s** (lower for high viscosity / cold start) |
| Pressure line | **3 – 6 m/s** (≈ 3 – 4 at up to 100 bar, ≈ 5 – 6 at 200 – 300 bar) |
| Return line | 2 – 4 m/s |
| Drain / leakage line | ≤ 1 – 2 m/s, no back pressure |
| Compressed air main line | 6 – 10 m/s, pressure drop to the last user ≤ 0.1 bar |

Inner diameter from flow: **d [mm] = 4.61 · √(Q [l/min] / v [m/s])**.
Example: Q = 40 l/min, pressure line v = 4 m/s → d = 4.61 · √10 = 14.6 mm → tube 20 × 2.5 (ID 15).

Wall thickness check (thin wall, Barlow): σ = p · D_o / (2 · t) ≤ R_e / S.
Example: tube 12 × 1.5, p = 250 bar = 25 MPa → σ = 25 · 12 / 3 = 100 MPa; E235+N (EN 10305-4),
R_e = 235 MPa, S = 1.5 → 157 MPa → OK. **Final pressure rating: take it from the tube / fitting maker
(ISO 8434-1 fittings: L series lighter, S series heavier) – the lower rating of tube and fitting
counts.** Hoses: EN 853 / EN 856 types (1SN, 2SN, 4SP …) – rating printed on the hose.

### 13.3 Hydraulic oil – ISO VG (ISO 3448)

Source: **ISO 3448** – viscosity grade = mid-point kinematic viscosity at 40 °C, limits ±10 %.

| ISO VG | Viscosity at 40 °C [mm²/s] (min – max) | Typical use |
|---|---|---|
| 10 | 9.0 – 11.0 | spindle oil, very cold |
| 22 | 19.8 – 24.2 | small units, cold areas |
| 32 | 28.8 – 35.2 | hydraulic in heated halls, machine tools |
| 46 | 41.4 – 50.6 | **standard hydraulic oil** (APC unit, guide 09) |
| 68 | 61.2 – 74.8 | warm environment, high load |
| 100 | 90 – 110 | gearboxes (light) |
| 150 | 135 – 165 | gearboxes |
| 220 | 198 – 242 | gearboxes, slideways (68/220 slideway oils) |
| 320 | 288 – 352 | worm gearboxes (mineral) |
| 460 | 414 – 506 | **worm gears** (often synthetic PAG/PAO; check the gearbox maker) |
| 680 | 612 – 748 | slow heavy gears |

Hydraulic oil types: HLP (DIN 51524-2) = HM (ISO 6743-4) mineral with anti-wear additives – standard.
HVLP (DIN 51524-3) = HV: high viscosity index for big temperature changes. Ideal operating viscosity
for most pumps ≈ 16 – 36 mm²/s; oil temperature 40 – 55 °C.

### 13.4 Oil cleanliness – ISO 4406 targets

Source type: typical recommendations of component makers (pumps, valves). Code = particles ≥ 4 / ≥ 6 /
≥ 14 µm(c) per ml as range numbers.

| System / component | Target ISO 4406 code |
|---|---|
| Servo valves | 16/14/11 (or cleaner, 15/13/10) |
| Proportional valves | 17/15/12 – 18/16/13 |
| Variable piston pumps | 17/15/12 – 18/16/13 |
| Vane / gear pumps, standard directional valves, cylinders | 19/17/14 – 20/18/15 |
| New oil from the drum (typical as delivered) | often 21/19/16 or worse – **always fill through a filter** |

Filter fineness: β_x(c) ≥ 200 at x = 10 µm for normal systems, x = 3 – 5 µm for servo systems.
One step lower in the code = about half the particle count.

### 13.5 Compressed air quality – ISO 8573-1:2010

Source: **values per ISO 8573-1:2010** (check the current edition). Quality class is written
[particles : water : oil], e.g. ISO 8573-1:2010 [2:4:2].

Particles (number per m³, by particle size):

| Class | 0.1 – 0.5 µm | 0.5 – 1 µm | 1 – 5 µm |
|---|---|---|---|
| 1 | ≤ 20 000 | ≤ 400 | ≤ 10 |
| 2 | ≤ 400 000 | ≤ 6 000 | ≤ 100 |
| 3 | not specified | ≤ 90 000 | ≤ 1 000 |
| 4 | not specified | not specified | ≤ 10 000 |
| 5 | not specified | not specified | ≤ 100 000 |
| 6 / 7 | mass concentration ≤ 5 mg/m³ / 5 – 10 mg/m³ | | |

Water (pressure dew point):

| Class | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Pressure dew point | ≤ −70 °C | ≤ −40 °C | ≤ −20 °C | ≤ +3 °C | ≤ +7 °C | ≤ +10 °C |

Oil (total: aerosol, liquid, vapour):

| Class | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| Total oil [mg/m³] | as specified, stricter than class 1 | ≤ 0.01 | ≤ 0.1 | ≤ 1 | ≤ 5 |

Typical choices: general pneumatics (valves, cylinders) [7:4:4] or better (check the maker – many
recommend [7:4:4]); air bearings, measuring air for gauges, zero-point / pallet seat blow-off and
contact control [1:4:1] – [2:4:2]; paint shop and air contacting product [1:2:1]. Refrigerant dryer
→ class 4 (+3 °C) dew point; adsorption dryer → class 2 (−40 °C).

Air consumption of a double-acting cylinder: Q [Nl/min] ≈ (A_push + A_pull) [dm²] · stroke [dm] ·
cycles/min · (p_g + 1.013) / 1.013 (p_g in bar gauge).

---

## 14. Electrical

**Electrical work must be designed and checked by a qualified electrician / electrical engineer per IEC
60204-1 (machines), IEC 61439 (cabinets) and your national installation rules.** The values here are for
planning.

### 14.1 Copper cable current capacity (machines, IEC 60204-1)

Source: **approximate values per IEC 60204-1 Table 6** (PVC insulation, copper, conductor temperature
70 °C, **ambient air 40 °C**, three loaded conductors). Installation methods (IEC 60364-5-52):
B1 = single cores in conduit / duct; B2 = multi-core cable in conduit / duct; C = cable on a wall;
E = multi-core cable on an open (perforated) cable tray. **Check the current edition and apply
correction factors** for grouping (several circuits together, e.g. 0.7 for 4 – 6 circuits), other
ambient temperature, and cable type (XLPE / PUR drag-chain cables: maker data).

| Cross-section [mm²] | B1 [A] | B2 [A] | C [A] | E [A] |
|---|---|---|---|---|
| 0.75 | 8.6 | 8.5 | 9.8 | 10.4 |
| 1.0 | 10.3 | 10.1 | 11.7 | 12.4 |
| 1.5 | 13.5 | 13.1 | 15.2 | 16.1 |
| 2.5 | 18.3 | 17.4 | 21 | 22 |
| 4 | 24 | 23 | 28 | 30 |
| 6 | 31 | 30 | 36 | 37 |
| 10 | 44 | 40 | 50 | 52 |
| 16 | 59 | 54 | 66 | 70 |
| 25 | 77 | 70 | 84 | 88 |
| 35 | 96 | 86 | 104 | 110 |
| 50 | 117 | 103 | 125 | 133 |
| 70 | 149 | 130 | 160 | 171 |
| 95 | 180 | 156 | 194 | 207 |

Protection rule (IEC 60364-4-43): **I_b ≤ I_n ≤ I_z** and I₂ ≤ 1.45 · I_z
(I_b = load current, I_n = fuse/breaker rating, I_z = cable capacity after correction, I₂ = tripping
current of the device; for MCBs and gG fuses I₂ ≤ 1.45 · I_n is fulfilled).

Protective earth conductor size (IEC 60364-5-54 / IEC 60204-1, same material): S ≤ 16 mm² → PE = S;
16 < S ≤ 35 → PE = 16 mm²; S > 35 → PE = S/2.

Conductor size by current – practical choice in machine cabinets (method B2/C, 40 °C, few circuits
together, short lengths – check voltage drop):

| Load current up to [A] | Cross-section [mm²] | Breaker (typical) |
|---|---|---|
| 6 | 0.75 – 1.0 | 6 A |
| 10 | 1.5 | 10 A |
| 13 – 16 | 2.5 | 13 – 16 A |
| 20 | 4 | 20 A |
| 25 | 6 | 25 A |
| 32 – 35 | 10 | 32 – 35 A |
| 50 | 16 | 50 A |
| 63 | 25 | 63 A |

Control wiring: 24 V signals inside the cabinet 0.5 – 0.75 mm² (minimum sizes per IEC 60204-1 Table 5),
field signals 0.25 – 0.5 mm² in multi-core sensor cables, 24 V supply distribution 1.5 – 2.5 mm².

### 14.2 Voltage drop

| Circuit | Formula |
|---|---|
| DC and single-phase AC | ΔU = 2 · L · I · ρ / A |
| Three-phase AC | ΔU = √3 · L · I · (R′ · cos φ + X′ · sin φ) ; for small cables (≤ 16 mm²) ≈ √3 · L · I · ρ · cos φ / A |
| ρ copper | 0.0178 Ω·mm²/m at 20 °C; ≈ 0.021 at 70 °C (use for loaded cables) |
| Limit | IEC 60204-1: ≤ 5 % from the supply point to the load under normal operation |

**Example 24 V DC:** sensor box 30 m away, I = 2 A, 0.75 mm² →
ΔU = 2 · 30 · 2 · 0.0178 / 0.75 = 2.85 V = 11.9 % → too high. 2.5 mm² → 0.85 V = 3.6 % → OK.

### 14.3 24 V DC rules (control circuits)

| Rule | Value / reason |
|---|---|
| Supply type | PELV: SELV-type power supply, 0 V connected to PE at **one** point (IEC 60204-1) – an earth fault then trips the protection instead of starting a machine |
| Voltage range of PLC inputs / outputs (IEC 61131-2) | 24 V −15 % / +20 % → **20.4 – 28.8 V** at the device |
| Sensors | usually 10 – 30 V DC |
| Fusing | electronic circuit breakers or small fuses **per branch** (1 – 6 A), so one fault does not stop everything |
| Separate supplies / branches | logic (PLC, HMI), outputs (valves, lamps), safety circuit, motor brakes – separate branches |
| Inductive loads | suppressor diode or varistor at valve coils and brakes |
| Power supply size | sum of loads × 1.3 – 1.5 + inrush; check that the supply can trip the branch protection |
| Cable length | check voltage drop (14.2); the lowest voltage at the last device must be ≥ 20.4 V |

### 14.4 Fuse and circuit breaker types

| Type | Characteristic | Use |
|---|---|---|
| gG fuse (IEC 60269) | general purpose, full range | cable and general protection |
| aM fuse | partial range, short-circuit only | motor circuits together with overload relay |
| gR / aR fuse | very fast | power semiconductors (drives, soft starters) |
| MCB type B (IEC 60898-1 / 60947-2) | magnetic trip 3 – 5 × I_n | resistive loads, long cables, 24 V |
| MCB type C | 5 – 10 × I_n | general, small motors, power supplies |
| MCB type D | 10 – 20 × I_n | high inrush (transformers, big power supplies) |
| Motor protection circuit breaker | adjustable thermal + magnetic (≈ 12 – 14 × I_n) | direct-on-line motors |
| RCD (residual current device) | 30 mA personnel protection; type A, F or B (B for drives with DC fault currents) | sockets, mobile equipment; check drive leakage currents |

### 14.5 Wire colours (IEC 60204-1, clause 13.2)

| Conductor | Colour |
|---|---|
| Protective earth PE | **green-yellow** (only for PE) |
| Neutral N | **light blue** |
| AC and DC power circuits | black (recommended) |
| AC control circuits | red (recommended) |
| DC control circuits | dark blue (recommended) |
| Interlock circuits supplied from an external source (stay live when the main switch is off) | orange (recommended) |

The "recommended" colours are recommendations of IEC 60204-1 – your company standard may define others,
but it must be consistent and documented. Mark wires at both ends (IEC 60204-1 13.2.1).

### 14.6 IP codes (IEC 60529)

| 1st digit | Protection against solid objects | 2nd digit | Protection against water |
|---|---|---|---|
| 0 | none | 0 | none |
| 1 | ≥ 50 mm (back of hand) | 1 | vertical drops |
| 2 | ≥ 12.5 mm (finger) | 2 | drops, enclosure tilted 15° |
| 3 | ≥ 2.5 mm (tool) | 3 | spraying water (up to 60° from vertical) |
| 4 | ≥ 1.0 mm (wire) | 4 | splashing water from any direction |
| 5 | dust-protected (some dust, no harm) | 5 | water jets (6.3 mm nozzle) |
| 6 | dust-tight | 6 | powerful water jets (12.5 mm nozzle) |
| – | | 7 | temporary immersion (up to 1 m, 30 min) |
| – | | 8 | continuous immersion (conditions by maker) |
| – | | 9 | high-pressure, high-temperature water jets (IEC 60529 amendment; 9K from ISO 20653) |

Typical in this project: control cabinet IP54 (IEC 60204-1 minimum IP22; practice IP54), components in
the machining area with coolant IP65 – IP67, AGV IP54 (indoor), sensors at the APC IP67, motors IP55 –
IP65.

### 14.7 Motor efficiency classes (IEC 60034-30-1)

| Class | Name |
|---|---|
| IE1 | standard efficiency |
| IE2 | high efficiency |
| IE3 | premium efficiency |
| IE4 | super premium efficiency |
| IE5 | ultra premium efficiency (defined in IEC 60034-30-1 ed. 2 / IEC TS 60034-30-2) |

Minimum efficiencies, 4-pole, 50 Hz (IEC 60034-30-1):

| Power [kW] | IE2 [%] | IE3 [%] | IE4 [%] |
|---|---|---|---|
| 1.1 | 81.4 | 84.1 | 87.2 |
| 4 | 86.6 | 88.6 | 91.1 |
| 7.5 | 88.7 | 90.4 | 92.6 |
| 11 | 89.8 | 91.4 | 93.3 |

EU rule (Regulation (EU) 2019/1781, check for updates and your country): IE3 for 0.75 – 1000 kW (since
07/2021); IE4 for 75 – 200 kW (since 07/2023); IE2 for 0.12 – 0.75 kW (since 07/2023). Motors on
frequency converters also count. Servo motors are not covered.

Rated current (3-phase): **I = P / (√3 · U · η · cos φ)**.
Example: 7.5 kW, 400 V, η = 0.904, cos φ = 0.83 → I = 7500 / (1.732 · 400 · 0.904 · 0.83) = 14.4 A.

---

## 15. Measurement

### 15.1 Basic rules

| Rule | Content |
|---|---|
| Reference temperature | **20 °C** (ISO 1). Measure parts and gauges after they reach the same temperature (big parts: hours) |
| 10 : 1 rule (rule of thumb) | the instrument resolution (and better its uncertainty) should be ≤ 1/10 of the tolerance; 1/5 acceptable when nothing better exists |
| Measurement system capability | gauge R&R (MSA): %GRR < 10 % good, 10 – 30 % conditionally acceptable, > 30 % not acceptable |
| Decision rules (ISO 14253-1) | supplier must prove conformance: tolerance zone **reduced** by the uncertainty U at both ends; customer must prove non-conformance: zone increased by U |
| Calibration | all measuring equipment in a calibration system with traceable certificates (ISO 10012 / ISO 9001 7.1.5) |

Thermal error example: aluminium part 500 mm measured at 26 °C with a steel caliper:
error = (α_Al − α_steel) · L · ΔT = (23 − 11.5)·10⁻⁶ · 500 · 6 = 0.035 mm (bigger than an IT7 tolerance!).

### 15.2 Instruments – typical resolution and uncertainty

Source type: typical values of standard workshop instruments (ISO 13385-1 calipers, ISO 3611
micrometers, ISO 463 dial gauges – check the maximum permissible error MPE on the calibration
certificate).

| Instrument | Resolution | Typical MPE / uncertainty | Suitable tolerance (10 : 1) |
|---|---|---|---|
| Steel rule / tape | 0.5 – 1 mm | ±0.2 – 0.5 mm | ≥ ±2 mm |
| Vernier / digital caliper (0 – 150 mm) | 0.02 / 0.01 mm | ±0.02 – 0.03 mm | ≥ ±0.1 – 0.2 mm (IT11 and coarser) |
| Outside micrometer (0 – 100 mm) | 0.01 / 0.001 mm | ±2 – 4 µm | ≥ ±0.02 mm (IT8 – IT9; IT7 with care) |
| Bore gauge with dial (2-point), set on ring | 0.001 – 0.002 mm | ±2 – 4 µm | IT7 holes |
| Dial indicator 0.01 mm | 0.01 mm | ±5 – 15 µm (range dependent) | run-out ≥ 0.05 mm |
| Dial test indicator / digital probe | 0.001 – 0.002 mm | ±2 – 3 µm | run-out, alignment 0.01 mm |
| Height gauge (digital) | 0.001 – 0.01 mm | ±3 – 10 µm | ≥ ±0.05 mm |
| Gauge blocks (ISO 3650, grade 0 / 1 / 2) | – | grade 0: ≈ ±0.1 – 0.2 µm per 25 mm | reference |
| Workshop CMM | 0.0001 – 0.001 mm | MPE_E ≈ (1.5 – 3) + L/300 – L/250 µm (ISO 10360-2) | IT6 and coarser |
| Laser interferometer (ISO 230-2 axis tests) | 0.001 µm | ≈ ±0.5 – 1 ppm (with air compensation) | machine axes |
| Electronic level / autocollimator | 1 µm/m / 0.1″ | ≈ ±1 – 2 µm/m / ±0.5″ | straightness, flatness, rotary table angles |
| Roughness tester | 0.01 µm | ±5 – 10 % of value | Ra checks |

### 15.3 Gauge selection by tolerance

| Feature and tolerance | Recommended gauge |
|---|---|
| Hole IT6 – IT7 (bearing seats, H7 bores) | GO / NO-GO plug gauge (ISO 1938-1) for series; bore gauge set on a setting ring for values |
| Hole IT8 – IT11 | plug gauge, caliper inside jaws (IT11) |
| Shaft IT5 – IT6 | micrometer 0.001 mm or snap gauge / indicating snap gauge |
| Shaft IT7 – IT9 | micrometer 0.01 mm, snap gauge |
| Threads | thread plug / ring gauges GO / NO-GO (ISO 1502); worm: 3-wire method (guide 12) |
| Position of holes | CMM or functional gauge (pins on a plate) for Ⓜ tolerances |
| Flatness of large faces | surface plate + indicator, or electronic level / laser |
| Taper / cone seats | taper gauge with marking blue (contact pattern ≥ 80 %, length distribution as specified) |
| Hardness | portable hardness tester for big parts (calibrate on test block); HRC on the shop floor |

### 15.4 Measurement uncertainty – basics (GUM, ISO/IEC Guide 98-3)

| Step | Formula |
|---|---|
| Type A (statistical, from n repeated readings) | u_A = s / √n (s = standard deviation) |
| Type B (from data: certificate, resolution, temperature) | rectangular distribution: u = a / √3 (a = half-width); resolution r: u = r / (2·√3) |
| Combined standard uncertainty | u_c = √(u₁² + u₂² + … ) |
| Expanded uncertainty | U = k · u_c, **k = 2** (≈ 95 % confidence) |

**Example:** micrometer, certificate U = 2 µm (k = 2) → u₁ = 1 µm; resolution 1 µm → u₂ = 0.29 µm;
repeatability s = 1.2 µm, n = 5 → u₃ = 0.54 µm; temperature ±1 K on steel Ø 50 with steel spindle,
difference α uncertainty ≈ 1·10⁻⁶ /K → u₄ ≈ 50 · 1·10⁻⁶ · 1 / √3 · 1000 = 0.03 µm.
u_c = √(1² + 0.29² + 0.54² + 0.03²) = 1.17 µm → U = 2.3 µm. Tolerance ±8 µm (h6 30 – 50) →
U / T = 2.3 / 16 = 14 % → acceptable (≤ 1/5), not 1/10.

---

## 16. Safety numbers

**These numbers are for planning. Safety functions must be designed and validated by a competent
safety engineer per ISO 12100, ISO 13849-1/-2 (or IEC 62061) and the current editions of the standards
below. Always use measured stopping times.**

### 16.1 Minimum distance of protective devices – ISO 13855

Source: **ISO 13855:2010** formulas. Note: **ISO 13855:2024 is published** and changed several details
(e.g. approach speeds, new C values, more cases). Check which edition applies in your country (EU:
harmonised list) before final design.

General formula: **S = K · T + C**

| Symbol | Meaning |
|---|---|
| S | minimum distance from the danger zone to the detection zone [mm] |
| K | approach speed of the body or body part [mm/s] |
| T | total stopping time = response time of the protective device + response time of the safety controller + stopping time of the machine [s] |
| C | additional distance for intrusion (reaching in before detection) [mm] |

| Device | K and C (ISO 13855:2010) |
|---|---|
| Light curtain, normal (perpendicular) approach, detection capability d ≤ 40 mm | K = 2000 mm/s, C = 8 · (d − 14), but C ≥ 0. If S > 500 mm: calculate again with K = 1600 mm/s; then S ≥ 500 mm. Minimum S = 100 mm |
| Light curtain / multi-beam, 40 < d ≤ 70 mm, or multi-beam devices (body detection) | K = 1600 mm/s, C = 850 mm. Beam heights: 2 beams 400 / 900 mm; 3 beams 300 / 700 / 1100 mm; 4 beams 300 / 600 / 900 / 1200 mm |
| Parallel approach (horizontal light curtain / scanner field) | K = 1600 mm/s, C = 1200 − 0.4 · H (H = height of detection plane, C ≥ 850 mm); H ≤ 1000 mm; d ≤ H/15 + 50 |
| Pressure-sensitive mat | K = 1600 mm/s, C = 1200 mm |
| Two-hand control | K = 1600 mm/s, C = 250 mm (C = 0 if a cover prevents reaching in) |
| Interlocking guard without guard locking | the danger must stop before it can be reached: S = K · T + C with K = 1600 (C from the opening per ISO 13857) – or use guard locking |

**Example (light curtain at the APC load station, guide 09):** d = 14 mm (finger) → C = 0.
T = 15 ms (curtain) + 20 ms (safety PLC) + 250 ms (measured stopping time of rotation) = 285 ms.
S = 2000 · 0.285 + 0 = 570 mm > 500 → calculate again with K = 1600: S = 1600 · 0.285 = 456 mm →
less than 500 → **S = 500 mm**.
With d = 30 mm: C = 8 · 16 = 128 mm → S = 2000 · 0.285 + 128 = 698 → with K = 1600: 456 + 128 = 584 mm.

Also check **reaching over** the top of a vertical light curtain (ISO 13855 table for C_RO) – the top
beam must be high enough or the distance must be bigger.

### 16.2 Safety distances – ISO 13857 (summary)

Source: **ISO 13857:2019 / 2008 – summary only, check the current edition**. Values for persons from
14 years.

Reaching **upwards**: danger zone height ≥ 2700 mm (high risk) – no guard needed above it; low risk
≥ 2500 mm.

Reaching **through regular openings** (upper limbs, Table 4) – minimum distance s_r [mm] from the
opening to the danger:

| Opening e [mm] (slot width / square side / round Ø) | Body part | Slot | Square | Round |
|---|---|---|---|---|
| e ≤ 4 | fingertip | ≥ 2 | ≥ 2 | ≥ 2 |
| 4 < e ≤ 6 | fingertip | ≥ 10 | ≥ 5 | ≥ 5 |
| 6 < e ≤ 8 | finger up to knuckle | ≥ 20 | ≥ 15 | ≥ 5 |
| 8 < e ≤ 10 | finger | ≥ 80 | ≥ 25 | ≥ 20 |
| 10 < e ≤ 12 | finger / hand | ≥ 100 | ≥ 80 | ≥ 80 |
| 12 < e ≤ 20 | hand | ≥ 120 | ≥ 120 | ≥ 120 |
| 20 < e ≤ 30 | arm up to shoulder | ≥ 850 (*) | ≥ 120 | ≥ 120 |
| 30 < e ≤ 40 | arm up to shoulder | ≥ 850 | ≥ 200 | ≥ 120 |
| 40 < e ≤ 120 | arm up to shoulder | ≥ 850 | ≥ 850 | ≥ 850 |

(*) If the slot length is ≤ 65 mm, the thumb stops the hand and the distance can be reduced to 200 mm.

Example: fence mesh 30 × 30 mm (square, e = 30) → ≥ 120 mm from the mesh to any danger point. Mesh
40 × 40 → ≥ 200 mm.

Reaching **over** a protective structure: depends on danger zone height a, structure height b and
horizontal distance c – use ISO 13857 Table 1 (low risk) / Table 2 (high risk). Fences lower than
1000 mm do not count as protective structures for reaching over; common practice for perimeter
fencing is ≥ 1400 mm (often 2000 mm) high with the bottom gap ≤ 180 mm (check ISO 13857 lower limbs
table and ISO 14120).

Minimum gaps to **avoid crushing** – ISO 13854:

| Body part | Minimum gap [mm] |
|---|---|
| Body | 500 |
| Head (worst position) | 300 |
| Leg | 180 |
| Foot | 120 |
| Toes | 50 |
| Arm | 120 |
| Hand, wrist, fist | 100 |
| Finger | 25 |

### 16.3 Typical response and stopping times (orientation – always measure)

Source type: typical data sheet values and commissioning experience. **ISO 13855 requires the real
stopping time – measure it with a stopping time meter at the worst case (max. speed, max. load, worn
brake) and add a margin (e.g. 10 – 20 %) for brake wear.**

| Element | Typical time |
|---|---|
| Safety light curtain response | 5 – 30 ms |
| Laser scanner response | 60 – 120 ms (plus field switching) |
| Safety relay / safety PLC (input to output) | 10 – 30 ms |
| Contactor drop-out | 10 – 40 ms |
| STO in a servo drive | 2 – 20 ms (then the axis coasts unless braked!) |
| Mechanical holding brake engagement | 20 – 150 ms (size dependent) |
| Servo axis stop with SS1 (controlled stop, then STO) | 100 – 500 ms (depends on speed and inertia) |
| Hydraulic cylinder stop (valve closes) | 30 – 100 ms + oil compression |
| Rotary table / APC rotation (heavy inertia, braked) | 200 – 800 ms |
| AGV braking (from 1 m/s) | 0.3 – 1 s, braking distance 150 – 500 mm (guide 11: ISO 3691-4 fields) |

---

## 17. Glossary

| Term | Meaning |
|---|---|
| α_A (tightening factor) | ratio of maximum to minimum preload caused by the tightening method |
| Ac3 | temperature above which steel is fully austenitic when heated |
| Annulus area | piston area minus rod area (pull side of a cylinder) |
| As (stress area) | calculation cross-section of a threaded bolt |
| β_w | correlation factor for fillet welds (EN 1993-1-8) |
| CE / CEV | carbon equivalent – index for weldability and preheat |
| CHD | case hardening depth (to 550 HV, ISO 18203) |
| Clearance fit | a fit where the shaft is always smaller than the hole |
| Datum | reference feature (plane, axis) for a geometric tolerance |
| Dew point (pressure) | temperature at which water condenses out of compressed air at line pressure |
| ET / PT / MT / UT | eddy-current, penetrant, magnetic particle, ultrasonic testing (NDT) |
| F_M | assembly preload of a bolt |
| FAT class | fatigue strength (stress range at 2·10⁶ cycles) of a welded detail |
| +A / +AC / +FP / +N / +QT | delivery conditions: soft annealed / spheroidised / ferrite-pearlite treated / normalised / quenched and tempered |
| GRR (gauge R&R) | repeatability and reproducibility of a measuring system |
| Hole-basis system | all holes H, the shaft tolerance gives the fit (normal in machine building) |
| Interference fit (press fit) | a fit where the shaft is always bigger than the hole |
| IP code | degree of protection of an enclosure (IEC 60529) |
| IT grade | ISO tolerance grade – width of the tolerance zone |
| kc1.1 | specific cutting force for 1 mm × 1 mm chip cross-section |
| L₁₀ | bearing life reached by 90 % of identical bearings |
| MPE | maximum permissible error of a measuring instrument |
| Nht | nitriding hardness depth (core hardness + 50 HV, ISO 18203) |
| PELV | protective extra-low voltage with an earth connection |
| Preheat | heating the joint before welding to slow the cooling and avoid cracks |
| Rp0.2 | 0.2 % proof stress = yield strength for materials without a clear yield point |
| Ra / Rz | arithmetical mean roughness / mean height of the profile |
| S (safety distance) | minimum distance of a protective device from the danger zone (ISO 13855) |
| SHD | surface hardening depth (induction / flame hardening, ISO 18203) |
| Spark-out | grinding passes without infeed to remove the elastic deflection |
| STO / SS1 | safe torque off / safe stop 1 (IEC 61800-5-2) |
| Stress relief | heating below the transformation temperature to reduce residual stresses |
| Transition fit | a fit that can give small clearance or small interference |
| Throat thickness a | height of the triangle inside a fillet weld – the design size |
| T651 | aluminium temper: solution treated, stress relieved by stretching, artificially aged |
| ν (utilisation, bolts) | share of the yield strength used by tightening (0.9 in the tables) |
| VG | viscosity grade (ISO 3448) |
| 3.1 certificate | inspection certificate per EN 10204 with test results of the delivered material, confirmed by the maker's inspector |

---

*End of guide 14. If you find a value that differs from the current edition of a standard, correct it
here and write the edition and date in the table's source line.*
