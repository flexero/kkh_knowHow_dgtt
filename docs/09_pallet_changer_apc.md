# 09 – Automatic pallet changer (APC): design, manufacturing, commissioning

> **Important – all numbers in this guide are EXAMPLES.**
> They are the default values of the twin page (a typical 500 mm pallet class horizontal machining centre, HMC).
> Before you make or buy anything, replace every number with data from **your machine builder, your catalogues and your suppliers**.
> The page always shows the formulas with your own numbers, so you can repeat every calculation.

Source files: `web/apc.js` (calculation page, animation, PLC, BOM, safety) and `web/apc3d.js` (3D structure, part data, zero-point section, hydraulic circuit).

---

## Contents

1. Purpose
2. Where in the twin (tab, files, deep links, how to use)
3. Concepts in simple words
4. Design calculations (formulas + example numbers)
5. Manufacturing, installation, commissioning, acceptance tests
6. Checklists
7. Common mistakes and lessons
8. Limits of the page
9. Corrections and clarifications
10. Science principles (statics, strength, bolts, welds, friction, Hertz, hydraulics, pneumatics, gears, kinematic coupling, tolerances, thermal, vibration, impact)
11. Detailed manufacturing specification (materials, fits, tolerances, welding, bolts, protection, hydraulics, anchors, measuring plan, alignment)
12. Identification and numbering
13. Standards table
14. Complete worked example (lift circuit, hub bolted joint)
15. Data you still need
16. Glossary

---

## 1. Purpose

While the HMC machines the parts on **pallet A**, the operator clamps the next parts on **pallet B** at the load station.
Then the APC does: **unclamp → lift → turn 180° → lower → clamp**. The spindle waits only a few seconds (example: 8.8 s) instead of minutes (example: 120 s when the operator loads inside the machine).

The page sizes every element of a **2-pallet rotary APC** (the most common type on HMCs):

- moment of inertia and motion profile of the turning arm,
- torque, servo motor and gearbox (with the inertia ratio check),
- position error from the gear backlash,
- hydraulic lift cylinder, oil flow, pump power, accumulator,
- zero-point clamping in the machine (slip and tilt checks),
- arm stress and deflection, slewing bearing loads, swing circle,
- light curtain distance (ISO 13855),
- change time and cell output,
- PLC step chain, PLC I/O list, bill of materials (BOM), safety notes.

Other APC types (not calculated here): *shuttle APC* (pallets slide sideways – for very heavy pallets) and *pallet pool* (many pallets).

Why this matters for you as a manufacturer: the APC is a precision machine. The arm itself is **not** precise (it only brings the pallet near its place); the **zero-point modules** give the final accuracy (≈ 0.002–0.005 mm). Everything you design must respect this split: the arm error must stay inside the **capture range** of the modules (example ±1 mm).

---

## 2. Where in the twin

### 2.1 Open the page

1. Start the twin (see `README.md`: `start.bat` or the Python server) and open the browser page of the twin.
2. Click the tab **"Pallet changer"** (tab id `apc`, URL hash `#apc`).

### 2.2 What you see (top to bottom)

| Area | Content |
|---|---|
| KPI tiles | pallet change time, rotation servo, lift cylinder, hydraulic pump, clamping use, cell output |
| Checks | green ✓ = ok, orange ! = warning, red ✕ = not ok |
| Inputs | 7 groups of input fields (changed values are marked); **Example values** button resets |
| Calculations | 6 blocks with every formula and your numbers |
| Animation | top view + side view + Gantt bar chart of the steps; Play, speed, time slider |
| Step chain | PLC sequence table, the active step is highlighted during the animation |
| PLC I/O list | addresses, symbols, signal types |
| BOM | elements with specifications from the calculation; **CSV** download (`APC_design_BOM.csv`, contains BOM + all inputs) |
| Safety | ISO 13855 distance + safety rules |
| Use in twin | button "Use X s in the twin" |
| 3D structure | parametric 3D model, views, exploded / cut view, guards, labels, click a part for data |
| Zero-point section | live 2D section through one clamping module |
| Hydraulic circuit | ISO 1219 style circuit, lines change colour with the step |

The inputs are saved in the browser (`localStorage` key `apcState`). Other tabs (Mechanical elements 1–4) read the APC values live from this page, so **change the pallet data here first**.

### 2.3 Deep links (open a defined view directly)

Add the parameters before `#apc`, for example `/?apcview=clamp&apcpart=module#apc`.

| Parameter | Values | Effect |
|---|---|---|
| `apct` | 0–100 | animation time in % of the change time |
| `apcview` | `overview`, `clamp`, `drive`, `hpu`, `station` | 3D camera view (clamp = exploded view, drive = cut view) |
| `apcexp` | 1 | exploded view on |
| `apccut` | 1 | cut view on |
| `apcpart` | part key, e.g. `module`, `arm`, `bearing`, `cylinder`, `accu`, `vlift` | shows the part data card |

Part keys: `pallet, ledge, stud, fixture, module, receiver, btable, union, arm, cross, fork, wall, hub, ring, pinion, gearbox, servo, bearing, carriage, column, bush, cylinder, base, station, cone, curtain, panel, door, tank, pump, accu, manifold, vlift, vclamp, vair, filter, gauge, pswitch, prox, pipe, guard, machine`.

### 2.4 "Use in twin"

The button sends the calculated change time to the running simulation:
`POST /api/command {"action":"pallet_change_s","value":8.8}`.
The HMCs in the twin then lose 8.8 s per pallet change. This lasts **until reset**. For a permanent change edit `config/factory.json`: `"pallet_changer": {"change_s": 8.8}` and restart the server. The card "Use in twin" shows the value the twin uses now and the cell output before / after.

### 2.5 How to use the page (work order)

1. Enter the pallet size, pallet mass, load and load centre (from your fixture design).
2. Enter the arm radius and arm section. Check "Gap between the pallets" and "Swing circle".
3. Enter rotation time, gear ratio, backlash. Look at the chosen servo and the inertia ratio.
4. Enter the lift stroke, lift time, oil pressure. Look at the cylinder bore and pump.
5. Enter the zero-point module data **from the catalogue**. Check slip and tilt.
6. Enter the sequence times and the measured stop time. Look at the light-curtain distance.
7. All checks green? Download the CSV, give it to purchasing / design. Then press "Use in twin".

---

## 3. Concepts in simple words

| Concept | Simple explanation | Why it matters |
|---|---|---|
| Rotary APC | One arm with two pallet places turns 180°. One pallet goes in, the other comes out at the same time. | Short change time, one drive. |
| Lift before turn | The arm lifts both pallets by their **lifting ledges** (stroke example 60 mm) so the pull studs leave the modules and the station receivers. | Without lift, the studs would crash. |
| Zero-point module | Clamping unit in the machine table. **Springs clamp**, **oil pressure opens**. A taper + face contact locates the pull stud. | Fail-safe (stays clamped without oil) and very repeatable (≈ 0.002–0.005 mm). |
| Capture range | How far off (example ±1 mm) the pull stud may land and the taper still pulls it into place. | All arm errors together must be smaller. |
| Trapezoid motion | Accelerate – constant speed – decelerate. Example: 30 % of the time to accelerate, 30 % to brake. | Gives the peak acceleration and so the torque. |
| Inertia ratio | Load inertia (seen at the motor) ÷ motor inertia. Aim ≤ 10 : 1. | A large ratio makes the servo control unstable (overshoot, vibration). |
| Backlash | Play in the gearbox. At the arm end it becomes a position error. | Must be inside the capture range. |
| Seating check | Air blows through nozzles in the receiver. If the pallet lies flat, the air is blocked → pressure switch. | Finds a chip under the pallet before the cut (scrap / crash). |
| Swing circle | Circle the pallets sweep when turning: Ø = 2r + pallet diagonal. | Guards, machine column, AGV and station parts must stay outside (or below / above). |
| Partition wall | Wall on the arm that turns with it. | Separates chips / coolant (machine side) from the operator. |
| STO | Safe Torque Off: the drive removes torque in a safe way. | Required safety function for the turning arm. |

---

## 4. Design calculations

All values below are **examples** (page defaults). g = 9.81 m/s².

### 4.1 Inputs (example values)

| Group | Input | Example | Note from the page |
|---|---|---|---|
| Pallet and load | Pallet size a × b | 500 × 500 mm | HMC classes 400 / 500 / 630 |
| | Pallet mass mp | 110 kg | 500 mm pallet ≈ 100–150 kg |
| | Workpiece + fixture mw | 400 kg | 500-class rating 500–700 kg |
| | Load centre offset e | 50 mm | worst case, horizontal |
| | Load centre height hc | 250 mm | tombstone with crankcases |
| Arm + bearing | Arm radius r | 480 mm | ≥ pallet diagonal ÷ 2 + clearance |
| | Arm + wall mass marm | 180 kg | |
| | Box section H × B × t | 160 × 100 × 10 mm | welded S355 |
| | Bearing mean Ø dm | 350 mm | crossed roller bearing |
| | Bearing friction μb | 0.005 | 0.002–0.005 |
| Rotation drive | Rotation time 180° | 2.5 s | typ. 1.5–3 s |
| | Acceleration share | 30 % | |
| | Gear ratio i | 200 | e.g. planetary 20 × ring 10 |
| | Gear efficiency η | 0.9 | |
| | Backlash | 3 arcmin | precision planetary ≤ 3′ |
| Lift | Stroke s | 60 mm | clear cones + studs |
| | Lift time (= lower time) | 0.8 s | |
| | System pressure p | 6 MPa | HMC typ. 3.5–7 MPa |
| | Pump efficiency | 0.85 | |
| Clamping | Modules per pallet n | 4 | |
| | Pull-in force per module | 20 kN | catalogue |
| | Release pressure | 5 MPa | catalogue |
| | Module pitch | 400 mm | square pattern |
| | Capture range | ±1 mm | catalogue |
| | Max cutting side force Fc | 4000 N | face mill Ø63, cast iron |
| | Height of Fc above pallet | 300 mm | |
| | Axis acceleration (rapid) | 5 m/s² | |
| | Friction pallet ↔ receiver μ | 0.15 | steel/steel, oily |
| | Safety factor S | 2.5 | |
| Sequence | Axes to change pos. + door open | 1.5 s | parallel |
| | Unclamp / clamp / seating check / door close | 0.8 / 0.8 / 0.4 / 1.2 s | |
| | Stop time of the arm after safety signal | 0.3 s | **measure on the real machine** |
| | Light curtain resolution d | 14 mm | finger protection |
| Production | Machining time per pallet | 343.5 s | FMS product mix |
| | Number of machines | 3 | |
| | Change time without APC | 120 s | |

### 4.2 Masses and moment of inertia (worst case: both pallets loaded)

Loaded pallet: m = mp + mw = 110 + 400 = **510 kg**

Pallet (point mass at r plus its own plate inertia):
J_p = mp·(r² + (a² + b²)/12) = 110·(0.48² + (0.5² + 0.5²)/12) = **29.9 kg·m²**

Load (with the offset e, worst case outward):
J_w = mw·((r + e)² + (a² + b²)/12) = 400·(0.53² + 0.5/12) = **129.0 kg·m²**

Arm (bar of length L = 2r + 200 mm = 1.16 m, width B = 0.1 m):
J_a = marm·(L² + B²)/12 = 180·(1.16² + 0.1²)/12 = **20.3 kg·m²**

Total: J = 2·(J_p + J_w) + J_a = 2·(29.9 + 129.0) + 20.3 = **338.2 kg·m²**

Why worst case: if the arm is sized for two full pallets, it also works for one full and one empty.

### 4.3 Rotation drive: motion, torque, servo, gearbox

Motion profile (trapezoid): θ = 180° = π rad, t = 2.5 s, t_a = 30 % · 2.5 = 0.75 s

| Step | Formula | Example |
|---|---|---|
| Max speed | ω = θ / (t − t_a) = π / 1.75 | 1.80 rad/s (17.1 rpm at the arm) |
| Acceleration | α = ω / t_a = 1.80 / 0.75 | 2.39 rad/s² |
| Acceleration torque | T_acc = J·α = 338.2 · 2.39 | 810 N·m |
| Bearing friction | T_fr = μb·F·dm/2 = 0.005 · 11 772 N · 0.175 m | 10.3 N·m |
| (axial load F) | F = (2·510 + 180)·g | 11 772 N |
| Torque at the arm | T = 810 + 10.3 | **820 N·m** |
| Peak power | P = T·ω = 820 · 1.80 | 1.47 kW |
| Motor torque | T_m = T / (i·η) = 820 / (200·0.9) | **4.56 N·m** |
| Motor speed | n = ω·60/(2π)·i = 1.80·60/(2π)·200 | **3429 rpm** |
| Load inertia at motor | J/i² = 338.2 / 200² | 84.6 kg·cm² |

**Servo choice rule (as coded):** take the smallest servo of the example list where
(1) T_max ≥ 1.2·(T_m + J_motor·α·i) (motor must also accelerate its own rotor, +20 % reserve),
(2) n_max ≥ n, and
(3) inertia ratio (J/i²) / J_motor ≤ 10.
If no servo meets (3), the page takes the smallest one that meets (1) and (2) and shows a warning.

Example servo list (generic values, **not** a real catalogue):

| Class | Tn N·m | Tmax N·m | n max rpm | J motor kg·cm² | Needed N·m | Ratio | Result |
|---|---|---|---|---|---|---|---|
| 0.4 kW | 1.3 | 3.8 | 6000 | 0.5 | 5.49 | 169 : 1 | too weak |
| 0.75 kW | 2.4 | 7.2 | 6000 | 1.5 | 5.55 | 56 : 1 | ratio too high |
| 1.5 kW | 4.8 | 14.3 | 5000 | 6 | 5.81 | 14.1 : 1 | ratio too high |
| **2.0 kW** | 6.4 | 19 | 5000 | 12 | **6.16** | **7.0 : 1** | **chosen** |
| 3.0 kW | 9.6 | 29 | 4500 | 20 | 6.62 | 4.2 : 1 | ok, bigger |

Lesson: the **torque** would allow a 0.75 kW motor. The **inertia ratio** decides: 2.0 kW. This is typical for APCs (large load inertia, short moves).

Gearbox (from the 3D part data): ring gear m = 4, pitch radius Rg = dm/2 + 50 = 225 mm → z_ring = round(2·225/4) = 113 teeth; pinion z = 15 → ring/pinion ratio 113/15 = 7.53. Planetary ratio i_plan = 200 / 7.53 ≈ **26.6**. Gearbox torque at the arm: design ≥ 1.5 · 820 = **1230 N·m** (×1.5 shock).

**Backlash → position error at the pallet:**
Δ = r · backlash = 480 mm · (3/60)° · π/180 = **0.42 mm**
Check: ≤ 50 % of the capture range (±1 mm) → ok. Why 50 %: other errors (deflection, station position, thermal) also need part of the ±1 mm – see doc 10, item 4.

Note: the servo only brings the pallet **near** its place. The final position (≈ 0.002–0.005 mm) comes from the taper and face contact of the zero-point modules.

### 4.4 Lift cylinder and hydraulic unit

| Step | Formula | Example |
|---|---|---|
| Lifted mass | m = 2·510 + 180 | 1200 kg |
| Lift acceleration | a = 4·s/t² = 4·0.06/0.8² | 0.375 m/s² |
| Force | F = m·g·(1 + a/g)·1.1 (1.1 = guide friction) | **13.4 kN** |
| With 25 % margin | F_req = 1.25·F | 16.8 kN |
| Minimum bore | D = √(4·F_req/(π·p)) = √(4·16 805/(π·6)) | 59.7 mm |
| Standard bore | next of 25/32/40/50/63/80/100/125/160/200 | **Ø63 mm, rod Ø36** |
| Real force | F = p·A = 6 · 3117 mm² | 18.7 kN (90 % used → just "ok") |
| Speed | v = s / t = 60 / 0.8 | 75 mm/s |
| Oil flow | Q = A·v = 3117 · 75 · 60/10⁶ | **14.0 L/min** |
| Pump power | P = p·Q/(60·η) = 6·14.0/(60·0.85) | **1.65 kW** |
| Motor in BOM | max(0.75, 1.3·P) | ≈ 2.15 kW |

Accumulator (from `apc3d.js`, isothermal, for one lift stroke):
ΔV = A·s = 3117 mm² · 60 mm = 0.187 L; p1 = 6 MPa, p2 = 1.25·p1 = 7.5 MPa, gas pre-charge p0 = 0.9·p1 = 5.4 MPa
V0 = ΔV / (p0/p1 − p0/p2) = 0.187 / (0.9 − 0.72) = **1.04 L → standard 1.4 L**.
With an accumulator a smaller pump is enough (the APC moves are short).
**Correction (§9.2):** the lift is fast, so use the adiabatic law → V0 = 1.39 L → choose ≥ 1.75 L; and the relief valve must be set above p2 = 7.5 MPa if an accumulator is used.
Tank: ≈ max(30, 4·Q) = **56 L** (3–5 × pump flow per minute), oil HLP 46.

The same hydraulic unit releases the zero-point modules and can clamp the fixtures.

### 4.5 Clamping the pallet in the machine (zero-point modules)

| Step | Formula | Example |
|---|---|---|
| Clamp force | FN = n·F_module + weight = 4·20 kN + 510·g | **85.0 kN** |
| Side load | F = max(Fc, mw·a_rapid) = max(4000, 400·5) | 4000 N |
| No slipping | S·F/μ ≤ FN → 2.5·4000/0.15 = 66.7 kN ≤ 85.0 kN | **78 % used** (ok ≤ 100 %) |
| Tilting moment | M = max(Fc·h_cut, mw·a·hc) = max(4000·0.3, 400·5·0.25) | 1200 N·m |
| Holding moment | M_hold = (n/2)·F_module·pitch + weight·pitch/2 = 2·20 000·0.4 + 5003·0.2 | 17 001 N·m |
| No tilting | S·M ≤ M_hold → 2.5·1200 = 3000 ≤ 17 001 | **18 % used** |
| Release pressure | p_release ≤ 0.9·p_system → 5 ≤ 5.4 MPa | ok |

Why friction only: the taper also carries side load, so the friction check is **on the safe side**.
Fail-safe: springs clamp → the pallet stays clamped if oil pressure is lost.

### 4.6 Arm and slewing bearing

| Step | Formula | Example |
|---|---|---|
| Load at arm end | F = 510·g | 5003 N at r = 480 mm |
| Box section | I = (B·H³ − (B−2t)·(H−2t)³)/12 = (100·160³ − 80·140³)/12 | 1584 cm⁴ |
| Bending stress | σ = F·r·(H/2)/I | **12 N/mm²** (aim ≤ 80 for S355 with fatigue) |
| Deflection | δ = F·r³/(3·E·I), E = 210 000 N/mm² | **0.055 mm** (aim ≤ 0.3 · capture) |
| Bearing axial | Fa = (2·510 + 180)·g | 11.8 kN |
| Bearing tilting | Mk = mw·g·(r + e) (one full, one empty) = 400·g·0.53 | **2.08 kN·m** |
| Static rating | M0 ≥ 2·Mk | ≥ 4.16 kN·m |
| Swing circle | Ø = 2r + √(a² + b²) = 960 + 707 | **Ø1667 mm** |
| Gap between pallets | 2r − a = 960 − 500 | 460 mm (aim ≥ 150 for the wall) |

Why low stress (12 N/mm²) is good: the arm is sized by **stiffness** (deflection must not use the capture range) and fatigue (millions of cycles), not by strength.

### 4.7 Light curtain safety distance (ISO 13855)

S = K·(t_stop + t_response) + C
K = 2000 mm/s (hand speed), t_response = 0.02 s (light curtain), C = 8·(d − 14) for resolution d
S = 2000·(0.3 + 0.02) + 8·(14 − 14) = **640 mm**

Notes:
- t_stop (0.3 s) is an example. **Measure the real stop time** of the arm (stop-time meter) after commissioning and recalculate.
- ISO 13855 also has a rule for using K = 1600 mm/s when the result with K = 2000 is above 500 mm (then S = 1600·T + C, minimum 500 mm). The page always uses K = 2000 (safe side). Check the current standard text with your safety engineer.

### 4.8 Change time and cell output

| Step | Time (example) |
|---|---|
| 1 Axes to change position, door open | 1.5 s |
| 2 Unclamp pallet in the machine | 0.8 s |
| 3 Lift arm | 0.8 s |
| 4 Rotate 180° | 2.5 s |
| 5 Lower arm | 0.8 s |
| 6 Clamp pallet | 0.8 s |
| 7 Seating check (air) | 0.4 s |
| 8 Door close | 1.2 s |
| **Change time t = Σ** | **8.8 s** |

Cell output = n·3600/(t_machining + t_change) = 3·3600/(343.5 + 8.8) = **30.7 pallets/h**
Without APC = 3·3600/(343.5 + 120) = 23.3 pallets/h → **APC gives +32 %**
Spindle time share = 343.5/(343.5 + 8.8) = **97.5 %**

### 4.9 Summary of the checks on the page

| Check | Rule (ok / warning) | Example result |
|---|---|---|
| Servo found | a servo in the list fits | 2.0 kW, needs 6.2 of 19 N·m |
| Inertia ratio | ≤ 10 ok, ≤ 20 warning | 7.0 : 1 |
| Backlash error | ≤ 0.5·capture ok, ≤ capture warning | 0.42 mm vs ±1 |
| Lift cylinder | F_req/F_real ≤ 0.9 ok | Ø63, 90 % |
| No slipping | ≤ 100 % ok, ≤ 120 % warning | 78 % |
| No tilting | ≤ 100 % ok, ≤ 120 % warning | 18 % |
| Release pressure | ≤ 0.9·p ok, ≤ p warning | 5 vs 6 MPa |
| Arm stress | ≤ 80 ok, ≤ 120 N/mm² warning | 12 N/mm² |
| Arm deflection | ≤ 0.3·capture ok, ≤ capture warning | 0.055 mm |
| Gap between pallets | ≥ 150 ok, ≥ 80 warning | 460 mm |
| Swing circle | information | Ø1667 mm |

### 4.10 PLC step chain

| Step | Action | PLC output / command | Step done when | Interlock |
|---|---|---|---|---|
| 0 | NC calls the pallet change (e.g. M60) | NC → PLC: M-code strobe | PLC reads the M code | spindle stopped, coolant off |
| 1 | Axes to change position, B = 0°, door open | NC moves X/Y/Z/B · %Q20.4 DoorOpen | NC "in position" + %I21.1 APCDoorOpen | load-station door closed, light curtain free |
| 2 | Unclamp the pallet in the machine | %Q20.2 Unclamp valve (oil → modules) | %I20.7 pressure switch "unclamped" | arm down, both pallets present |
| 3 | Lift the arm with both pallets | %Q20.0 Lift-up valve | %I20.0 "arm up" | unclamped, operator outside (F-DI) |
| 4 | Rotate 180° | servo enable + positioning order (PROFINET) | servo "in position" + %I20.3 "180°" | arm up, STO not active |
| 5 | Lower the arm | %Q20.1 Lift-down valve | %I20.1 "arm down" | position sensor OK |
| 6 | Clamp the new pallet | %Q20.2 off (oil out → springs clamp) | %I20.6 pressure switch "clamped" | arm down |
| 7 | Seating check: air through receiver nozzles | %Q20.3 seating air ON | %I21.0 air pressure switch (gap < 0.02 mm) | else ALARM "pallet seating" |
| 8 | Close the door, FIN to the NC | %Q20.5 DoorClose · FIN | %I21.2 APCDoorClosed | NC continues with the next part |

Note: in step 4 the 180° sensor is shown; on the way back the 0° sensor (%I20.2) is used.

### 4.11 PLC I/O list (example addresses, Siemens style)

Rule: bit addresses use **.0 to .7 only** (a byte has 8 bits). After %I20.7 comes %I21.0 – never %I20.8.

| Address | Symbol | Type | Device |
|---|---|---|---|
| %I20.0 | ArmUp | DI | inductive sensor |
| %I20.1 | ArmDown | DI | inductive sensor |
| %I20.2 | Arm0deg | DI | inductive sensor |
| %I20.3 | Arm180deg | DI | inductive sensor |
| %I20.4 | PalletInMachine | DI | inductive sensor |
| %I20.5 | PalletAtStation | DI | inductive sensor |
| %I20.6 | MachineClamped | DI | pressure switch |
| %I20.7 | MachineUnclamped | DI | pressure switch |
| %I21.0 | SeatingAirOK | DI | air pressure switch |
| %I21.1 | APCDoorOpen | DI | limit switch |
| %I21.2 | APCDoorClosed | F-DI | safety switch with guard locking |
| %I21.3 | StationDoorClosed | F-DI | safety switch |
| %I21.4 | LightCurtainFree | F-DI | OSSD of the light curtain |
| %I21.5 | OperatorReady | DI | push button |
| %Q20.0 | LiftUpValve | DQ | solenoid 24 V |
| %Q20.1 | LiftDownValve | DQ | solenoid 24 V |
| %Q20.2 | UnclampValve | DQ | solenoid (oil to the modules) |
| %Q20.3 | SeatingAir | DQ | pneumatic valve |
| %Q20.4 | DoorOpen | DQ | door drive |
| %Q20.5 | DoorClose | DQ | door drive |
| %Q21.0 | ServoSTO | F-DQ | safe torque off of the servo drive |
| %Q21.1 | StationLamp | DQ | stack light |
| PROFINET | Servo drive | telegram | PROFIdrive positioning: target 0°/180°, in position, fault |
| NC ↔ PLC | M60 / FIN | signals | M-code strobe from the NC, FIN back when the change is done |

All addresses are examples. In a real project F-DI / F-DQ sit on fail-safe I/O modules with their own address ranges.

### 4.12 Hydraulic circuit (ISO 1219 style, from `apc3d.js`)

| Code | Element | Function |
|---|---|---|
| 0P1 + M | pump + motor | builds the pressure |
| 0V1 | relief valve | limits the pressure (set p + 10 %) |
| check, filter 10 µm | check valve, return filter | protect pump, keep oil clean |
| 0Z2 | bladder accumulator (example 1.4 L) | oil for the fast lift, holds release pressure |
| gauge | 0–10 MPa | shows system pressure (example 6 MPa) |
| **1V1** | 4/3 solenoid valve, NG6, centre position **A and B to tank, P blocked** (corrected, §9.3 – a closed centre can keep the check valves 1V2 open) | lift up / down / hold |
| **1V2** | pilot-operated check valves (in A and B) | arm cannot sink when the valve is in centre or the power fails |
| **1V3** | meter-out throttles | set lift and lower speed |
| 1A1 | lift cylinder Ø63/36 × 60 | lifts carriage, rotor and both pallets |
| **2V1** | 3/2 solenoid valve (or 4/2 with plugged port) | energized = oil to the modules (open); not energized = oil to tank, springs clamp |
| **2S1** | pressure switch after 2V1 | confirms "unclamped" |
| rotary union | 2 passages | oil + air into the turning B-axis table |
| 2A1–2A4 | zero-point modules 20 kN | clamp the pallet |
| **3V1** | pneumatic 3/2 valve + FRL | seating-check air 0.3–0.6 MPa (example drawing: 0.6 MPa supply) |
| **3S1** | air pressure switch | switches when the pallet lies flat (gap < 0.02 mm) |

Line colours in the twin: red = pressure, dark red = pressure held, blue = to tank, cyan = air, grey = no flow.

Step → valve state in the animation: step 2 unclamp: 2V1 on; step 3 lift: 1V1 position "up"; step 4 rotate: 1V1 centre (pressure held by 1V2), modules still open; step 5 lower: 1V1 "down"; step 6 clamp: 2V1 off (oil to tank); step 7 seating: 3V1 on.

### 4.13 Zero-point module – how it works (live section)

- **Clamped** (no oil): disc springs push the piston down; the piston taper presses the locking balls inward against the pull stud; the stud is pulled down (example 20 kN) onto the reference face.
- **Open**: oil (example 5 MPa) enters the chamber below the piston, the piston moves up against the springs, the balls are free, the stud can leave.
- **Lifted**: the APC lifts the pallet; the stud leaves the module.
- Air nozzle in the face: seating check "gap < 0.02 mm?".

---

## 5. Manufacturing, installation, commissioning

### 5.1 Main dimensions of the 3D model (example)

| Item | Value |
|---|---|
| Pallet height above floor (receiver top) H0 | 1050 mm |
| Swing circle | Ø1667 mm |
| Total height (top of partition wall) | ≈ 1995 mm |
| Arm radius r | 480 mm |
| Lift stroke | 60 mm |
| Base / carriage footprint | (dm + 260) = 610 × 610 mm |
| Ring gear / pinion | m 4, z 113 / 15 |
| Planetary gearbox | i ≈ 26.6 |
| Lift cylinder | Ø63 / 36 × 60 |
| Zero-point modules | 4 × 20 kN, pitch 400 mm |
| Pallet thickness | max(50, 0.14·min(a,b)) = 70 mm |
| B-axis table Ø (model) | 470 mm |

Structure (from bottom to top): base frame → 4 guide columns + lift cylinder → lift carriage (servo, gearbox, pinion, bearing outer ring) → rotor (bearing inner ring, ring gear, hub, arm, cross beams, fork rails, partition wall) → pallets with lifting ledges and pull studs. Machine side: B-axis table + receiver plate with zero-point modules, rotary union. Load station: locating receivers, light curtain, operator panel. Hydraulic power unit (HPU).

Why the carriage carries servo + gearbox + bearing: the **gear mesh does not change** during the lift.

### 5.2 Parts list – MAKE (you manufacture)

| Part | Material | Function | Manufacturing notes and tolerances (examples) |
|---|---|---|---|
| Pallet | EN-GJS-600-3 (old name GGG-60) nodular cast iron or C45, stress relieved | carries fixture + parts | 500 × 500 × 70 mm, 110 kg. Grind top and bottom: flatness ≤ 0.01 mm, parallel ≤ 0.01 mm. Jig-bore pull-stud holes on pitch ±0.005 mm. M16 grid or T-slots 18H8. RFID tag pocket. |
| Lifting ledge | 42CrMo4, induction hardened 52–56 HRC, screwed + pinned | fork rails lift under them | 2 per pallet, 25 mm wide, full length. Same height both sides ±0.02 mm. Replaceable. |
| Tombstone fixture | EN-GJL-250 (old GG25) cast + hydraulic workholding | holds 2–4 faces of parts | Not part of the APC, but its mass (400 kg) and centre height (250 mm) size the APC. |
| Receiver plate (B-table) | S355 or EN-GJL-250, stress relieved | carries modules, oil + air channels | 460 × 460 × 40 mm. Module bores H7 per catalogue. Grind top **after mounting** on the table: flatness ≤ 0.005 mm. Plug channels, pressure test 1.5 × p. |
| APC arm | S355J2 welded box, stress-relief annealed | carries both pallets | Box 160 × 100 × 10. Weld → anneal 580–620 °C → machine hub flange and cross-beam faces in **one setup**: both ends same height ±0.05 mm. |
| Cross beam | S355, welded to the arm | carries fork rails | Length b + 110 = 610 mm, **flat 45 mm** (passes over the station receivers when the arm turns). Machined with the arm. |
| Fork rail + wear strip | S355 rail + 90MnCrV8 strip 58 HRC | lifts the pallet under its ledges | Length a + 40 = 540 mm. Shim the strips so all 4 rails are at the same height ±0.02 mm. Lead-in chamfers. |
| Partition wall | 2–3 mm stainless sheet on steel frame, rubber wipers | separates machine and operator | ≈ 1627 × 950 mm. Wipers on all edges. Keep it light (it is part of J). |
| Hub | 42CrMo4 quenched + tempered | connects bearing inner ring and arm | Ø ≈ dm − 60 = 290 mm, torque 820 N·m (×1.5 = 1230 N·m). Centring fit H7/g6, bolt circle from the bearing catalogue. |
| Lift carriage | S355 thick plate or EN-GJL-250 | lifted plate with bearing, gearbox, servo | 610 × 610 × 40 mm. Bore the 4 bushing holes in one setup (±0.02 mm, parallel). |
| Base frame | S355 tube 80×80×5 welded, top plate 30 mm | carries everything | Weld → anneal → machine top plate (column holes, cylinder flange). Levelling feet + chemical anchors M16. Align to the machine change position ±0.1 mm. |
| Load station stand | S355 welded | holds the waiting pallet | Pallet height 1050 mm (ergonomic 900–1100). Must match machine receiver height ±0.2 mm. Detailed design: doc 10. |
| Locating receiver (station) | case-hardened 16MnCr5, 58–62 HRC | centres the pallet at the station, no clamping | 4 on pitch 400, face at 1050 mm. 1 round bore, 1 slot, 2 with clearance (not over-determined). |
| APC door (sliding shutter) | sheet steel with seals | closes the machine above the wall | Opens before the arm turns. Door switch with guard locking (ISO 14119). |
| Pipes | precision steel tube 12×1.5 (E235+N) or 2SN hose; air PU 8 mm | connect HPU, cylinder, modules | Clamp every 1 m, **flush before start-up**. |
| Guard / enclosure | sheet steel + polycarbonate | keeps people out, chips in | Outside the swing circle Ø1667. Fixed guards need tools to open (ISO 14120). |
| Valve manifold (MAKE or BUY) | steel block, drilled | carries NG6 valves | Pressure test 1.5 × p, mark every port (P, T, A, B). |

### 5.3 Parts list – BUY (catalogue)

| Part | Specification (example) | Mounting notes |
|---|---|---|
| Zero-point modules (4) | pull-in 20 kN, spring clamp, release 5 MPa, repeatability ≤ 0.005 mm, air seating check | Bore H7, depth / face per catalogue, O-rings for oil and air. Fail-safe clamped. |
| Pull studs (4 per pallet) | case-hardened 58 HRC, from the module supplier | Torque per catalogue, thread locker. One stud = reference fit, others with radial play. |
| Slewing bearing (crossed roller) | Fa 11.8 kN, Mk 2.08 kN·m, M0 ≥ 4.16 kN·m, dm ≈ 350 | Mounting faces flat ≤ 0.02 mm, bolts crosswise with torque wrench, grease nipple reachable. |
| Ring gear | 42CrMo4, teeth induction hardened, m 4, z 113, face 40 mm | Backlash 0.05–0.1 mm with eccentric pinion mount. Grease. |
| Pinion | 16MnCr5 case hardened, m 4, z 15, face 60 mm | Wider than the ring gear; shrink disc on gearbox shaft. |
| Planetary gearbox | i ≈ 26.6, backlash ≤ 3 arcmin | Flange with eccentric ring to set the gear backlash. |
| Servo motor + drive | 2.0 kW class, Tmax 19 N·m, absolute encoder, holding brake, STO | PROFINET (PROFIdrive positioning), STO wired to the safety PLC. |
| Guide columns (4) + ball bushings | Ø50 h6 induction hardened, ground; flanged bushings with wipers | In H7 bores with bolted shaft clamp flanges (or press fit P7, see §11.3 part 11); parallel ≤ 0.02 mm over the stroke. |
| Lift cylinder | ISO 6020/6022, Ø63/36 × 60, double acting, end cushioning both sides | Flange on the base; rod end with a **self-aligning coupling** (no side load on the rod). |
| Rotary union | 2 passages: oil 10 MPa, air 0.6 MPa | Below the table centre, flexible hoses to fixed pipes. |
| HPU: tank, motor-pump, filter | ≈ 56 L, internal gear pump + IE3 motor, return filter 10 µm with clogging indicator | Bell housing + flexible coupling, relief valve p + 10 %. |
| Bladder accumulator | 1.4 L, pre-charge 5.4 MPa, with safety block | Safety block with relief + drain valve (pressure equipment rules). |
| Valves | 1V1 4/3 NG6 closed centre 24 V DC; 2V1 3/2 NG6; 3V1 pneumatic 3/2 + FRL (filter 5 µm) | Manual override for service. |
| Pressure switches | electronic, IO-Link | switch points set in the PLC |
| Inductive sensors M12 (6) | PNP, IO-Link: arm up, down, 0°, 180°, pallet in machine, pallet at station | Adjustable bracket, switching distance 4 mm. |
| Safety light curtain | type 4, 14 mm resolution, OSSD | ≥ 640 mm from the danger zone (example), OSSDs to F-DI. |
| Door switches with guard locking (2) | ISO 14119, PL d | APC door + load-station door. |
| Gauge | glycerin 0–10 MPa + test point | |

### 5.4 Bill of materials (as the page generates it)

| Element | Qty | Specification (example) |
|---|---|---|
| Pallet | 3 | 500 × 500 mm, 110 kg, flatness ≤ 0.01 mm, 4 pull studs (2 on the APC + 1 spare for fixture setting) |
| Zero-point clamping module | 4 | 20 kN, spring clamp, release 5 MPa, ≤ 0.005 mm, air seating check |
| Locating cones (load station) | 4 | taper cones, no clamping |
| APC arm with partition wall | 1 | S355 box 160×100×10, r = 480, 180 kg; σ = 12 N/mm², δ = 0.055 mm; stress relieved, machined after welding |
| Slewing bearing | 1 | Fa 11.8 kN, Mk 2.08 kN·m, M0 ≥ 4.16 kN·m, dm ≈ 350; integrated ring gear if possible |
| Servo motor + drive (STO) | 1 | 2.0 kW class, Tn 6.4 / Tmax 19 N·m, 5000 rpm, absolute encoder, brake |
| Planetary gearbox + pinion | 1 | i = 200 total, backlash ≤ 3′, ≥ 1230 N·m at the arm, 4.56 N·m at the motor |
| Lift cylinder + guide column | 1 | Ø63/36, stroke 60, 6 MPa, end cushioning |
| Hydraulic power unit | 1 | 6 MPa, 14.0 L/min (or smaller pump + accumulator), motor ≈ 2.15 kW, oil cooler |
| Solenoid valves | 3 | lift, clamp/unclamp, seating air |
| Pressure switches | 2 + 1 | unclamped / clamped (hydraulic), 1 air |
| Inductive sensors M12 | 6 | see above |
| Door switches with guard locking | 2 | ISO 14119, PL d |
| Safety light curtain type 4 | 1 | 14 mm, ≥ 640 mm from the danger zone |
| Guard around the APC | 1 | outside Ø1667 + load-station door |
| Operator panel | 1 | "pallet ready" button, E-stop, stack light |

### 5.5 Manufacturing sequence (recommended)

1. **Order long-lead BUY parts first**: slewing bearing with ring gear, zero-point modules + studs, servo + gearbox, HPU. Get the catalogue drawings – your machined interfaces depend on them.
2. **Pallets**: rough machine → stress relieve → finish machine → grind both faces (≤ 0.01 mm) → jig-bore stud holes (±0.005 mm) → fit studs (1 reference, 3 with radial play). Machine all 3 pallets with the **same program and fixture**: they must be interchangeable.
3. **Arm assembly**: weld arm, cross beams (45 mm flat) and rail supports in a jig → anneal 580–620 °C → machine all interfaces in one setup (hub flange, cross-beam faces, rail seats) → ends same height ±0.05 mm.
4. **Fork rails**: fit hardened strips with shims, all 4 rails same height ±0.02 mm; chamfer the ends.
5. **Base + carriage**: weld → anneal → machine column holes and bushing holes in one setup (±0.02 mm) → press in columns → check parallelism ≤ 0.02 mm over the stroke.
6. **Receiver plate**: drill and plug channels → pressure test 1.5 × p → mount on the B-table → grind top face on the machine (≤ 0.005 mm) → fit modules.
7. **Hydraulics**: manifold pressure test 1.5 × p; mark ports; flush all pipes before connecting the modules (modules and valves are sensitive to dirt).
8. **Paint** non-functional surfaces only; machined faces oiled.

### 5.6 Installation

1. The machine builder sets and levels the HMC. The B-axis goes to the change position (B = 0°).
2. Set the APC base: levelling feet, align to the machine change position **±0.1 mm** (position and height), chemical anchors M16, grout, tighten after curing.
3. Mount the bearing (faces flat ≤ 0.02 mm, bolts crosswise with torque wrench), hub, arm, partition wall.
4. Mount gearbox + pinion; set the gear backlash 0.05–0.1 mm with the eccentric.
5. Mount the lift cylinder with the self-aligning rod coupling.
6. Set the load station (see doc 10, item 4: align to the APC axis, not to the floor; same height as the machine receiver).
7. Install HPU, pipes (clamp every 1 m), rotary union. Flush.
8. Wire sensors, valves, servo, safety devices. Check addresses against the I/O list.
9. Install guards outside the swing circle, door with guard locking, light curtain at ≥ the calculated distance.

### 5.7 Commissioning (step by step)

1. **Hydraulics without load**: set relief valve (p + 10 %, example 6.6 MPa – circuit without accumulator; with accumulator see §9.2), check for leaks, pre-charge accumulator (example 5.4 MPa, with nitrogen only), check filter indicator.
2. **Valves by manual override**: lift up / down, unclamp / clamp. Check 2S1 switches when the modules are open. Set the throttles 1V3 for a soft lift and lower (no impact at the end).
3. **Hold test**: lift the arm with load, switch off the HPU / valve in centre: the arm must not sink (1V2 pilot check). Mark and measure after 10 min.
4. **Sensors**: arm up / down / 0° / 180°, pallet present, pressure switches, seating air switch (test with a 0.05 mm shim under one corner → must NOT switch).
5. **Servo**: commission in slow speed, set 0° and 180° positions (absolute encoder), tune the controller with the real load inertia; check overshoot. Check that the brake holds.
6. **Backlash measurement**: dial gauge at the pallet edge at r, move the arm by hand both ways → measured play at r must be ≤ 0.5 × capture range (example ≤ 0.5 mm; calculated 0.42 mm).
7. **Alignment with master pallet**: see doc 10, item 4 (studs drop into the modules without force, seating check OK).
8. **Step chain in single-step mode**, then automatic with empty pallets, then with full load.
9. **Safety**: measure the real stop time of the arm with a stop-time meter → recalculate S = 2000·(t_stop + t_response) + C → move the light curtain if needed. Test every interlock and STO.
10. Enter the measured change time with "Use in twin".

### 5.8 Acceptance tests (examples)

| Test | How | Pass if |
|---|---|---|
| Change time | 20 changes with full pallets, stopwatch / PLC log | ≤ calculated time (example 8.8 s) |
| Repeatability | 100 changes with full load | seating check OK every time, no alarm |
| Position in machine | probe a reference bore on the pallet after 20 changes | scatter within module spec (example ≤ 0.005 mm) |
| Arm hold | arm up with full load, power off, 10 min | no visible sinking |
| Power loss | cut oil pressure while clamped | pallet stays clamped (springs) |
| Seating check | 0.05 mm shim / chip under one corner | alarm "pallet seating", no cycle start |
| Interlocks | station door open, light curtain broken, during each step | arm does not move / stops |
| Stop time | stop-time meter at max speed, full load | ≤ value used in the ISO 13855 calculation |
| Slip test (optional) | test cut with the max cutting force | no movement (probe before / after) |
| Endurance | 500 changes in automatic | no wear marks, no leaks, bolts tight |

### 5.9 Safety (from the page)

- Arm rotation only when the **load-station door is closed** and the **light curtain is free** (F-DI, PL d per ISO 13849-1).
- Servo stop with **STO** + holding brake; hydraulic lift with a **pilot-operated check valve** so the arm cannot fall.
- Zero-point modules clamp with **springs**: the pallet stays clamped if oil pressure is lost.
- Machine door with **guard locking** (ISO 14119); machining-centre safety rules: ISO 16090-1.
- **Seating check** with air: no cycle start if a chip lies under the pallet.
- Chip protection: covers over the cones, air blow-off of the receiver before clamping.
- The complete risk assessment and validation is done by the responsible integrator / machine builder.

### 5.10 Maintenance (examples)

| Interval | Work |
|---|---|
| Daily | blow receivers and cones clean, visual check for leaks |
| Weekly | seating-check function test (shim test) |
| Monthly | grease ring gear and pinion, check filter indicator, accumulator pre-charge (with the system depressurised) |
| 6 months | bearing bolts torque, gear backlash, wear strips on fork rails, ledges |
| Yearly | oil analysis / change, stop-time measurement, all safety functions |

---

## 6. Checklists

### 6.1 Design checklist

- [ ] Pallet size, masses and load centre come from the **real fixture design**.
- [ ] Gap between pallets 2r − a ≥ 150 mm (partition wall fits).
- [ ] Swing circle drawn on the layout; guards, machine column, AGV and station parts outside or clearly above / below.
- [ ] Servo: torque, speed **and** inertia ratio ≤ 10 checked with **catalogue** values.
- [ ] Backlash error at r ≤ 50 % of the module capture range.
- [ ] Arm deflection ≤ 30 % of the capture range.
- [ ] Lift cylinder ≤ 90 % used; pilot-operated check valve in the circuit.
- [ ] Module release pressure ≤ 0.9 × system pressure.
- [ ] Slip and tilt ≤ 100 % with S = 2.5.
- [ ] Bearing static rating M0 ≥ 2 × Mk.
- [ ] Light curtain distance with the **measured** stop time.
- [ ] I/O addresses only .0–.7.
- [ ] CSV / BOM sent to purchasing; long-lead items ordered.

### 6.2 Manufacturing checklist

- [ ] Welded parts annealed before final machining.
- [ ] Arm interfaces machined in one setup (ends ±0.05 mm).
- [ ] 4 fork rails same height ±0.02 mm.
- [ ] Pallets interchangeable: flatness ≤ 0.01, stud pitch ±0.005 mm.
- [ ] Receiver plate ground on the machine (≤ 0.005 mm).
- [ ] Manifold and receiver channels pressure-tested 1.5 × p.
- [ ] Pipes flushed; all ports marked.

### 6.3 Commissioning checklist

- [ ] Relief valve set, accumulator pre-charged, no leaks.
- [ ] Hold test of the lift passed.
- [ ] All sensors and pressure switches checked; seating shim test passed.
- [ ] Servo tuned with real load; 0° / 180° set; brake checked.
- [ ] Backlash measured at r.
- [ ] Master pallet test passed (machine + station).
- [ ] Stop time measured; light curtain distance confirmed.
- [ ] All interlocks and STO tested and documented.
- [ ] Change time measured and entered in the twin.

---

## 7. Common mistakes and lessons

1. **Choosing the servo by torque only.** The torque allowed 0.75 kW; the inertia ratio needed 2.0 kW. Always check J_load/i² ÷ J_motor.
2. **Expecting the arm to position the pallet.** The arm is only ±0.4 mm (backlash) + deflection. The zero-point taper gives the accuracy. Never "fix" a seating problem by tuning the servo; check the error chain.
3. **Using all of the capture range for one error.** Backlash, deflection, station position, thermal growth and pallet-on-rail play all add up (see doc 10, item 4). Keep each one small.
4. **No pilot-operated check valve.** A 4/3 closed-centre valve alone leaks; the arm with 1200 kg can sink. Use 1V2 – and give 1V1 a centre position with A and B to tank, so the check valves close fully (§9.3).
5. **Rigid cylinder rod connection.** Side load kills the rod seal. Use a self-aligning coupling; the guide columns take the side forces.
6. **Machining the arm before annealing.** Welding stress relaxes later and the ends move. Anneal first.
7. **Estimated stop time in the safety calculation.** Always measure it on the real machine and recalculate the light-curtain distance.
8. **Forgetting the parts on the pallet in the swing circle.** The page's swing circle is pallet only. The tombstone and parts can stick out (doc 10, item 4: +40 mm overhang → the parts reached ~8 mm into a docked AGV bumper).
9. **Pallet only held by friction on the fork rails.** Centripetal + tangential acceleration = 1.93 m/s² > μ·g = 1.47 m/s² → locating blocks are required (§9.4).
10. **Cross beam too high.** The cross beams sweep over the station receivers; in the model they are flattened to 45 mm so they pass over (clearance 10 mm when lifted with the example stroke). Check this whenever you change r, stroke or receiver height.
11. **Wrong PLC bit addresses** like %I20.8. Siemens bits go .0–.7 only.
12. **Dirty oil.** Zero-point modules and NG6 valves fail with dirt. Flush pipes, 10 µm return filter, watch the indicator.

---

## 8. Limits of the page

- Example servo list (7 generic classes) – not a real catalogue. Use the supplier's sizing tool for the final choice.
- Inertia uses simple shapes (point mass + plate, bar for the arm). Add the partition wall, hub, ring gear, cross beams in detail for the final design.
- Lift force uses a constant acceleration (4·s/t²) and a flat 1.1 guide factor; no cushioning or pressure losses in pipes.
- Clamping: friction-only slip check (safe side); no dynamic cutting forces, no stiffness / chatter analysis.
- Arm: static bending with the full loaded pallet at r; no dynamic factor from acceleration, no fatigue calculation (only a low stress aim of 80 N/mm²).
- Bearing: only the static tilting moment; no life calculation.
- Light curtain: K = 2000 mm/s always, response time fixed at 0.02 s; check the standard and your device data.
- Change time is a simple sum; no overlap of steps (real machines often overlap door and axis moves).
- The 3D model dimensions (module m, tube sizes, sheet thickness, H0 = 1050 mm) are typical examples, not a drawing.
- No prices; no CE / risk assessment. The page is a design aid, not a certified calculation.

---

## 9. Corrections and clarifications to chapters 4–8

These points were found while writing chapters 10–15. The page code is not changed; the guide text above is corrected where marked.

### 9.1 Backlash input = total backlash referred to the ARM

The page multiplies the input "backlash" directly by r. So the input must be the **total** play of the whole drive, seen at the arm – not the catalogue backlash of the planetary gearbox alone.
Split of the example drive (planetary i ≈ 26.6, then pinion z 15 → ring gear z 113, ratio 7.53, ring pitch radius Rg = m·z/2 = 4·113/2 = 226 mm):

| Source | Formula | Example at r = 480 mm |
|---|---|---|
| Planetary 3′ at its output, reduced by the ring/pinion ratio | r · (3′/7.53) · π/(180·60) | 0.056 mm |
| Gear mesh, circumferential play j_t = 0.1 mm (upper value of 0.05–0.1) | j_t · r / Rg = 0.1 · 480 / 226 | 0.212 mm |
| **Total** | sum | **0.27 mm** |

So the page value 0.42 mm (3′ directly at the arm) is **on the safe side** for this drive. If you buy a slewing drive with only one gear stage, enter its catalogue backlash directly. Always confirm by the measurement in §5.7 step 6.

### 9.2 Accumulator: absolute pressure, fast (adiabatic) discharge, relief valve setting

1. Gas laws need **absolute** pressure (gauge + 0.1 MPa). Example: p0 = 5.5, p1 = 6.1, p2 = 7.6 MPa abs → isothermal V0 = 1.05 L (page: 1.04 L – small difference).
2. A lift of 0.8 s is **fast**: the gas has no time to exchange heat → use the adiabatic law p·V^1.4 = const:
   V0 = ΔV / ((p0/p1)^(1/1.4) − (p0/p2)^(1/1.4)) = 0.187 / (0.9016^0.714 − 0.7237^0.714) = 0.187 / (0.929 − 0.794) = **1.39 L**.
   The 1.4 L accumulator has **no margin** → choose the next catalogue size ≥ 1.25 · 1.39 ≈ **1.75 L** (often 2 or 2.5 L).
3. The accumulator must be charged to p2 = 7.5 MPa, but §5.7 sets the relief valve to p + 10 % = 6.6 MPa. **Both cannot be true.** Choose one:
   - **With accumulator:** pump stops / unloads at p2 = 7.5 MPa (pressure switch or unloading valve), relief valve **above** p2 (example 8.3 MPa), all parts rated ≥ 10 MPa, zero-point modules fed through a **pressure-reducing valve** set to the release pressure (5 MPa, never above the module's maximum).
   - **Without accumulator:** pump 14 L/min, relief 6.6 MPa, no accumulator (simpler; motor 2.2 kW).
   - (Accumulator charged only to 6.6 MPa would need V0 = 3.1 L adiabatic.)

### 9.3 Valve 1V1 centre position with pilot-operated check valves

With pilot-operated check valves (1V2) the centre position of 1V1 must **connect A and B to tank, P blocked** (often called "float" or "A,B→T" centre). With a **closed** centre, pilot pressure can stay trapped, the check valves stay partly open and the arm creeps down. The table in §4.12 is corrected.

### 9.4 Pallet on the fork rails – centripetal acceleration was missing

Doc 10 item 4 checks only the tangential acceleration a_t = α·r = 1.15 m/s². At the end of the acceleration the arm also turns at ω = 1.80 rad/s, so the pallet feels the **centripetal** acceleration a_c = ω²·r = 1.795²·0.48 = **1.55 m/s²** – along the fork rails (radial).
Resultant a = √(1.15² + 1.55²) = **1.93 m/s²** > friction μ·g = 0.15·9.81 = 1.47 m/s² → factor **0.76** (not 1.3). Without locating blocks the pallet **will slide** outward. Locating blocks on the fork rails are therefore **required**, not optional (design load in §11.3, part 7). The code `web/mech4.js` still shows ×1.3.

### 9.5 Other clarifications

| Place | Old | Correct / clearer |
|---|---|---|
| §5.2 pallet, tombstone, receiver, carriage | GGG-60, GG25 | modern EN names: **EN-GJS-600-3** (5.3201, old GGG-60), **EN-GJL-250** (5.1301, old GG25) |
| §5.3 guide columns | "pressed into the base" | a ground h6 column in an H7 bore is a clearance fit (0 … 0.041 mm). Use an H7 bore + bolted shaft clamp flange, or a press-fit bore P7 – see §11.3 part 11 |
| §4.7 ISO 13855 | – | the standard was revised (new edition about 2024). Check the formula and the K = 1600 rule in the edition you use |
| §5.9 Machinery Directive | – | the EU Machinery Regulation (EU) 2023/1230 replaces Directive 2006/42/EC from **20 January 2027** – a machine placed on the market after that date follows the Regulation |
| §5.7 step 1 | relief p + 10 % | only for the circuit without accumulator (see 9.2) |

---

## 10. Science principles (why the formulas work)

Units used: force N (kN), length mm or m, stress and pressure **MPa = N/mm²** (1 MPa = 10 bar), mass kg, g = 9.81 m/s².

### 10.1 Statics and dynamics

| Law | Formula | APC example |
|---|---|---|
| Newton (straight line) | F = m·a | lift: F = m·(g + a) = 1200·(9.81 + 0.375) = 12 222 N; ×1.1 guide friction = 13.4 kN |
| Newton (rotation) | τ = J·α | T_acc = 338.2·2.39 = 810 N·m |
| Inertia of a point mass | J = m·r² | load at 0.53 m: 400·0.53² = 112.4 kg·m² |
| Parallel-axis rule | J = J_own + m·r² | plate J_own = m·(a² + b²)/12 → J_p = 110·(0.0417 + 0.2304) = 29.9 kg·m² |
| Inertia seen by the motor | J_m = J / i² | 338.2 / 200² = 0.00846 kg·m² = 84.6 kg·cm² |
| Kinetic energy | E = ½·J·ω² | ½·338.2·1.795² = **545 J** (the drive must brake this every move → braking resistor / regenerative drive) |
| Centripetal acceleration | a_c = ω²·r | 1.795²·0.48 = 1.55 m/s² (see §9.4) |

**Trapezoid motion (derived).** The angle is the area under the speed–time graph. Accelerate for t_a, run at ω, brake for t_a:
θ = ½·ω·t_a + ω·(t − 2·t_a) + ½·ω·t_a = ω·(t − t_a) → ω = θ/(t − t_a), α = ω/t_a.
Example: ω = π/(2.5 − 0.75) = 1.80 rad/s, α = 1.80/0.75 = 2.39 rad/s².
Compare the **triangle** profile (t_a = t/2): ω = 2θ/t = 2.51 rad/s, α = 4θ/t² = 2.01 rad/s². Lower torque, but higher speed and centripetal load (ω²·r = 3.03 m/s²). 30–33 % acceleration share is a good compromise.

### 10.2 Strength of materials

| Topic | Formula | Example |
|---|---|---|
| Bending stress | σ = M/W, W = I/(H/2) | arm: M = 5003·480 = 2.40·10⁶ N·mm, W = 15.84·10⁶/80 = 198 000 mm³ → σ = 12.1 N/mm² |
| Shear stress | τ = F/A (double shear: A = 2·πd²/4) | cylinder rod-end pin Ø20, F = 18.7 kN: τ = 18 700/(2·314) = 29.8 N/mm² |
| Combined (von Mises) | σ_v = √(σ² + 3·τ²) ≤ Re/S | S = 1.5 static (example) |
| Deflection (cantilever) | f = F·L³/(3·E·I), E = 210 000 N/mm² steel | arm: 5003·480³/(3·210 000·15.84·10⁶) = 0.055 mm |
| Stiffness | k = 3·E·I/L³ | arm: 90 200 N/mm |
| Buckling (Euler) | F_k = π²·E·I/L_k², valid only if slenderness λ = L_k/i > ≈ 90–105 (steel), i = d/4 for a round rod | lift rod Ø36: I = π·36⁴/64 = 82 450 mm⁴, L_k = 300 mm (guided both ends) → λ = 300/9 = 33 < 90 → **no buckling**, only compression σ = 18 700/1018 = 18 N/mm² |

Euler cases for cylinders: both ends guided/pinned L_k = L; one end fixed, the other free (rod not guided) L_k = 2·L – this is the dangerous case for long-stroke cylinders. Use the cylinder supplier's buckling chart for the final check.

**Stress concentration.** At a shoulder, a hole or a groove the local stress is K_t times higher. With a fillet radius r ≥ 0.1·d K_t is about 1.5–2; a sharp corner can give 3 or more. Rule: generous radii on all load-carrying shoulders (pins, hub, rails).

**Fatigue (many load cycles).** The APC makes ≈ 3600/352 = 10.2 changes per hour; at 6000 h/year this is ≈ **61 000 cycles per year**, ≈ 0.6 million in 10 years. That is fatigue territory.
- Endurance limit of polished steel in bending: σ_W ≈ 0.4–0.5·Rm. Reduce for surface (as-rolled ≈ 0.7), size (≈ 0.9) and notch (÷ K_f).
- Example S355 (Rm ≈ 490): 0.5·490·0.7·0.9 / K_f 2 ≈ **77 N/mm²** allowed stress amplitude.
- **Goodman idea:** mean stress σ_m reduces the allowed amplitude σ_a: σ_a/σ_A + σ_m/Rm ≤ 1/S.
  Arm: stress goes 0 → 12 → 0 at each lift → σ_m = 6, σ_a = 6 → 6/77 + 6/490 = 0.090 → S = 11. This is why the page aims at σ ≤ 80 N/mm²: stiffness and fatigue rule, not strength.
- **Welds are weaker in fatigue** than the base metal (see 10.4).

### 10.3 Bolted joints (VDI 2230 idea)

A preloaded bolt is a stiff spring that clamps the parts. The **friction** between the parts carries the side load; the bolt shank does not touch the hole.

| Item | Formula / rule | Example |
|---|---|---|
| Tightening torque | M_A = F_M·(0.16·P + 0.58·μ_G·d₂ + μ_K·D_Km/2) | M16 10.9 (P = 2, d₂ = 14.70, D_Km ≈ 20.8 mm, μ = 0.12), F_M = 121.7 kN → M_A ≈ 315 N·m (table ≈ 302) |
| Scatter of the torque wrench | F_M,min = F_M,max/α_A, α_A ≈ 1.6 (example; VDI 2230 gives the range) | M16 10.9: 121.7/1.6 = **76 kN** minimum → this is why doc 10 uses ≈ 80 kN |
| Friction grip | F_slip = μ·F_V,min·n / S | 4 × M16, μ = 0.2 (dry machined steel; use 0.15 if oily), 76 kN: 4·0.2·76 = 61 kN |
| Bolt force from a moment (bolt circle radius R, n bolts) | F_max = 2·M/(n·R) | must stay well below F_V,min → joint does not open |
| Embedding loss | a few µm per interface | use few, flat, machined interfaces; re-check torque after the run-in (§5.10) |
| Thread engagement (rule of thumb) | steel Rm ≥ 400: 1.0–1.25·d (8.8), 1.25–1.5·d (10.9); grey cast iron 1.25–1.5·d; aluminium ≈ 2·d | M16 10.9 in S355: ≥ 20–24 mm |
| Surface pressure | under the head of 10.9 bolts on S355 use a hardened washer (ISO 7089, 300 HV) | |

Approximate assembly preload F_M and torque M_A (μ_G = μ_K = 0.12, 90 % of yield in the thread, VDI 2230 table values; full table in doc 14 §8.3 – check with your bolt supplier):

| Size | 8.8: F_M kN / M_A N·m | 10.9: F_M kN / M_A N·m |
|---|---|---|
| M6 | 10.4 / 10.1 | 15.3 / 14.9 |
| M8 | 19.1 / 24.6 | 28.0 / 36.1 |
| M10 | 30.3 / 48 | 44.6 / 71 |
| M12 | 44.1 / 84 | 64.8 / 123 |
| M16 | 82.9 / 206 | 121.7 / 302 |
| M20 | 134 / 415 | 190 / 592 |

### 10.4 Welds

- **Throat a** of a fillet weld = height of the largest triangle inside the weld. Rule: a ≥ 3 mm and a ≤ 0.7·t_min; typical a ≈ 0.5·t for full strength in S355.
- Simple stress: σ_w = F/(Σ a·l) or σ_w = M/W_w (W_w of the weld throat ring).
- Static design value (EN 1993-1-8 simplified method, S355, fu ≈ 470 N/mm², β_w = 0.9, γ_M2 = 1.25): f_vw,d = fu/(√3·β_w·γ_M2) = 470/(1.732·0.9·1.25) = **241 N/mm²**.
- **Fatigue** (IIW recommendations, check the current document): a load-carrying fillet weld judged on the throat has FAT 36 = 36 N/mm² stress **range** at 2 million cycles. At N cycles: Δσ = FAT·(2·10⁶/N)^(1/3). Example N = 0.6·10⁶: 36·1.49 = 53 N/mm²; with partial factor 1.35 → **≈ 40 N/mm²**.
- Example arm to central hub plate, fillet a = 5 around the 160 × 100 box: W_w ≈ ((110·170³ − 100·160³)/12)/85 = 128 000 mm³; M = 2.40·10⁶ N·mm → σ_w = **19 N/mm²** stress range per lift ≤ 40 → ok.

### 10.5 Friction, wedge, cone self-centring and self-locking

- Friction angle φ = atan μ. Example μ = 0.15 → φ = 8.5°.
- A part slides down an inclined face (and so centres itself) only if the face angle from the horizontal θ > φ. Doc 10 item 2: 47.5° > 8.5°.
- Force on a cone (half-angle β from the axis) when a lateral force F must be created by an axial push: F_axial = F·tan(β + φ). For β = 15°, μ = 0.15: tan(23.5°) = 0.435 (doc 10 uses the equivalent form (tanβ + μ)/(1 − μ·tanβ)).
- **Self-locking** is the opposite: if β < φ, the cone stays stuck after pressing (Morse taper, half-angle ≈ 1.5°). A zero-point module or a docking cone must **not** self-lock → steep cones (≥ 7–15°) and a flat face for the height.

### 10.6 Contact pressure (Hertz)

When curved parts touch, the contact area is tiny and the pressure is high.
- Equivalent modulus: 1/E* = (1 − ν₁²)/E₁ + (1 − ν₂²)/E₂ → steel/steel E* = 115 400 N/mm².
- **Line contact** (cylinder radius R, length L, force F): p_max = √(F·E*/(π·L·R)).
- **Point contact** (ball radius R on a flat): p_max = (1/π)·(6·F·E*²/R²)^(1/3).
- First plastic dent starts at about p_max ≈ 1.6–1.8·Re. S355 (Re 355): ≈ 600 N/mm². Hardened 58–62 HRC: several thousand N/mm² (bearing standards use ≈ 4000 N/mm² as static limit).
- APC example: lifting ledge edge (R = 1 mm chamfer edge) carries half a pallet (2500 N) over 25 mm if the fork rails are not level: p_max = √(2500·115 400/(π·25·1)) = **1915 N/mm²** → an unhardened ledge dents. That is why ledges are hardened 52–56 HRC, edges get a radius and the 4 rails are level ±0.02 mm (then the contact is flat, p ≈ 0.2 N/mm²).

### 10.7 Hydraulics

| Principle | Formula | Example |
|---|---|---|
| Pascal | p = F/A, F = p·A | Ø63: A = 3117 mm², 6 MPa → 18.7 kN |
| Ring area (rod side) | A_r = π·(D² − d²)/4 | Ø63/36: 3117 − 1018 = 2099 mm² |
| Flow and speed | Q = v·A | 75 mm/s · 3117 mm² = 0.234 L/s = 14.0 L/min |
| Power | P = p·Q/η (MPa·L/min/60 = kW) | 6·14/60/0.85 = 1.65 kW |
| Pump displacement | V = Q/(n·η_v) | 14 L/min/(1450 rpm·0.9) = 10.7 cm³/rev |
| Pipe velocity guide (practice) | pressure 3–5 m/s, return 2–3 m/s, suction 0.5–1.5 m/s | 12×1.5 tube (d_i 9 mm): 3.7 m/s |
| Reynolds number | Re = v·d/ν (laminar < ≈ 2300) | 3.7·0.009/46·10⁻⁶ = 718 (ISO VG 46 at 40 °C) |
| Pressure drop (laminar) | Δp = (64/Re)·(L/d)·ρ·v²/2 | 5 m of 12×1.5: 0.29 MPa warm; at 10 °C (ν ≈ 200 mm²/s) **1.26 MPa** → warm the oil before production |
| Orifice / throttle | Q = C_d·A·√(2·Δp/ρ), C_d ≈ 0.6–0.7 | lowering: Δp 3.8 MPa, 14 L/min → A = 4.0 mm² (≈ Ø2.3 mm) |
| Oil compressibility | ΔV = V·Δp/K, K ≈ 1.4–1.6 GPa (less with air in the oil) | why bleeding the air matters |
| Pressure intensification | a meter-out throttle on the **rod** side can create p_rod = p·A/A_r (+load) | 6 MPa·3117/2099 = 8.9 MPa → rate the rod side for it |
| Pilot-operated check valve | opens when p_pilot ≥ (p_load − …)/pilot ratio (ratio ≈ 1:3 … 1:4, catalogue) | load pressure 1200·9.81/3117 = 3.8 MPa → pilot ≥ ≈ 1 MPa + spring |
| Accumulator | isothermal p·V = const (slow); adiabatic p·V^1.4 = const (fast); always **absolute** pressures; bladder rule p0 ≈ 0.9·p1 and p2/p0 ≤ 4 (catalogue) | §9.2 |
| Energy lost when lowering | E = m·g·s | 1200·9.81·0.06 = 706 J per lowering → heat (small) |

### 10.8 Pneumatics

| Principle | Formula | Example |
|---|---|---|
| Cylinder force | F = p·A·η (η ≈ 0.9) | Ø50, 0.6 MPa: 0.6·1963·0.9 = 1060 N |
| Free-air consumption per stroke | V = A·s·(p + 0.1)/0.1 (p gauge in MPa) | Ø50, s = 104 mm, double stroke: 2·1963·104·7 = 2.9 L free air |
| Seating check (slit flow) | Q = w·h³·Δp/(12·η·L) – flow grows with **gap³** | nozzle land L = 3 mm, w = 31 mm, Δp 0.3 MPa, air η = 1.8·10⁻⁵ Pa·s: h = 5 µm → 0.11 L/min; h = 20 µm → 7 L/min; h = 50 µm → 109 L/min |

The h³ law explains why the seating check can see a chip of 0.02–0.05 mm: 4 × more gap gives 64 × more flow, the back pressure falls, the pressure switch drops. (Simple incompressible estimate; set the real switch point with shims, §5.7.)
Compressed air quality: give the class to the supplier as ISO 8573-1 [particles : water : oil]; the module catalogue states what it needs (typically filtered ≤ 5 µm, dry, oil-free).

### 10.9 Gears and backlash geometry

| Item | Formula | Example |
|---|---|---|
| Pitch diameter | d = m·z | ring 4·113 = 452 mm, pinion 4·15 = 60 mm |
| Centre distance (external gears) | a = m·(z₁ + z₂)/2 | 4·128/2 = 256 mm |
| Ratio | i = z₂/z₁ | 113/15 = 7.53 |
| Backlash from centre distance | j_n ≈ 2·Δa·sin α (α = 20°) | Δa = 0.10 mm → j_n ≈ 0.068 mm (this is what the eccentric adjusts) |
| Circumferential ↔ normal backlash | j_n = j_t·cos α (spur gear) | |
| Play at the arm end | Δ = j_t·r/R_g | 0.1·480/226 = 0.21 mm |
| Tooth force | F_t = T/R_g | 1230 N·m / 0.226 m = 5440 N |
| Tooth root stress (Lewis estimate) | σ = F_t/(b·m·Y), Y ≈ 0.29 for z = 15 | 5440/(40·4·0.29) = 117 N/mm² (final check per ISO 6336 by the gear supplier) |

### 10.10 Kinematic coupling – exact constraint

A rigid body has **6 degrees of freedom** (3 moves, 3 rotations). To fix it exactly you need exactly 6 independent contacts.
- **Kelvin coupling:** ball in a cone (3) + ball in a V (2) + ball on a flat (1) = 6.
- **Maxwell coupling:** 3 balls in 3 V-grooves at 120° (3 × 2 = 6).
- **Machine practice:** flat face (3: height + 2 tilts) + round pin (2: x, y) + diamond pin or slot (1: rotation) = 6.
- More contacts than 6 = **over-determined**: the part is forced, it jams or bends, the position depends on manufacturing errors. That is why one stud is the reference, one locates in a slot and the others have radial play (§5.3, doc 10 item 1).
- The zero-point module is a controlled exception: taper **and** face touch at the same time; this works because the taper is elastic/sprung and the clamp force is high. Follow the module maker's rules for stud fits.

### 10.11 Tolerance stack-up

- **Worst case:** e_wc = Σ|e_i| – all errors add in the same direction. Safe; use it for collision and capture checks.
- **RSS (statistical):** e_rss = √(Σ e_i²) – realistic when the errors are independent and centred.
- Example (doc 10 item 4, mounting A): 0.02, 0.02, 0.05, 0.42, 0.20, 0.055 → worst case 0.765 mm, RSS = √(0.0004 + 0.0004 + 0.0025 + 0.1764 + 0.04 + 0.0030) = 0.47 mm.
- Rule used here: worst case ≤ 0.8 × capture range. One big term (backlash 0.42) dominates – reduce the biggest term first.

### 10.12 Thermal expansion

ΔL = α·L·ΔT. α: steel 11.5·10⁻⁶/K, cast iron ≈ 10·10⁻⁶/K, aluminium ≈ 23·10⁻⁶/K.
Example: arm r = 480 mm, 10 K warmer → 0.055 mm. A 500 mm aluminium part warmed by 5 K grows 0.058 mm.
All drawing dimensions are valid at **20 °C** (ISO 1). Measure precision parts (pallets, receivers) only after they have the room temperature (hours for big parts).

### 10.13 Vibration and natural frequency

f = (1/2π)·√(k/m). Arm with the loaded pallet at its end: k = 90 200 N/mm = 9.02·10⁷ N/m, m = 510 kg → f = (1/6.283)·√(176 900) = **67 Hz**.
Quick check from the static deflection: f ≈ 15.8/√δ[mm] = 15.8/√0.055 = 67 Hz. Same result.
Rules: keep structural frequencies well above the servo control bandwidth and away from motor/gear excitation frequencies; a stiff arm settles fast after the move (shorter change time).

### 10.14 Impact energy and absorbers

E = ½·m·v² (straight) or ½·J·ω² (rotation). Absorber peak force ≈ E/(η·s), η ≈ 0.85 for a good hydraulic absorber, s = stroke.
- Pallet landing on the modules at 20 mm/s (throttled): ½·510·0.02² = 0.1 J – negligible.
- Arm hitting a mechanical over-travel stop at full speed: **545 J** at the arm. If you fit such a stop, size the absorber and the stop bracket for it (and the gear teeth, which are between the motor and the arm).
- Doc 10 item 1: AGV fault 52 J into 2 absorbers.

---

## 11. Detailed manufacturing specification

All values are **examples** for the 500-class APC of this guide. Your drawings, the catalogues of the BUY parts and your supplier's data overrule them.

### 11.1 General drawing notes (put them on every drawing)

| Note | Value |
|---|---|
| General tolerances, machined | ISO 2768-mK (example: 30–120 mm ±0.3; 120–400 mm ±0.5; flatness K over 100–300 mm 0.4 mm) |
| General tolerances, weldments | ISO 13920-BF (then machine the functional faces) |
| Reference temperature | 20 °C (ISO 1) |
| Surface texture | general Ra 3.2 µm unless stated (indication per ISO 21920-1, formerly ISO 1302) |
| Edges | ISO 13715: external edges −0.3 … −0.5 (burr-free), internal edges +0.3 max |
| Material certificate | EN 10204 **3.1** for all load-carrying parts (arm, hub, carriage, base, pallet, pins) |
| Weld symbols | ISO 2553; weld quality per §11.4 |
| Fits | ISO 286 (numeric limits written next to the fit on functional diameters) |
| Geometric tolerances | ISO 1101; datums A (main face), B (main bore / axis), C (orientation) |

### 11.2 Materials used

| Material (EN name) | Number | Standard | Main properties (typical minimum) | Used for |
|---|---|---|---|---|
| S355J2+N | 1.0577 | EN 10025-2 | Re 355 (t ≤ 16), 345 (16–40) N/mm²; Rm 470–630 | arm, cross beams, base, carriage, station |
| S235JR | 1.0038 | EN 10025-2 | Re 235, Rm 360–510 | guards, wall frame, brackets with low load |
| C45+QT | 1.0503 | ISO 683-1 | d 16–40: Re 430, Rm 650–800; induction hardenable 52–56 HRC | pallet (alternative), wear parts |
| 42CrMo4+QT | 1.7225 | ISO 683-1 | d 16–40: Re 750, Rm 1000–1200; d 40–100: Re 650, Rm 900–1100 | hub, lifting ledges, ring gear |
| 16MnCr5 (case hardened) | 1.7131 | ISO 683-3 | surface 58–62 HRC, CHD 0.8–1.2 mm, tough core | receivers, pins, bushes, pinion, locating blocks |
| 100Cr6 | 1.3505 | ISO 683-17 | through hardened 60–64 HRC, brittle core | only small precision parts without shock (ball, gauge pins). **Not** for docking pins (impacts) – use 16MnCr5 |
| 90MnCrV8 | 1.2842 | ISO 4957 | hardened 58–62 HRC | wear strips on fork rails |
| EN-GJS-600-3 | 5.3201 | EN 1563 | Rm 600, Rp0.2 370, A 3 % | pallet (cast) |
| EN-GJL-250 | 5.1301 | EN 1561 | Rm 250, good damping | tombstone, carriage (alternative) |
| EN AW-6082 T6 | 3.2315 | EN 573-3 / EN 755-2 | Rp0.2 ≈ 250, Rm ≈ 290–310 (check EN 755-2 for your section), E 70 000, α 23·10⁻⁶ | light covers, manifold (if p ≤ supplier limit) |
| X5CrNi18-10 | 1.4301 | EN 10088-2 | stainless, Re ≈ 230 | partition wall sheet, drip tray |
| E235+N tube | 1.0308 | EN 10305-4 | precision seamless hydraulic tube | pipes |

Hardness tests: Rockwell ISO 6508-1 (HRC), Vickers ISO 6507-1 (HV); case depth CHD (at 550 HV) and surface hardening depth SHD per ISO 18203.

### 11.3 Specification per MAKE part

Fit limits below are from ISO 286 for the size shown (deviations in mm; full tables in doc 14 §5).

**1 · Pallet (VC-APC-PAL-0010)**
- Material: EN-GJS-600-3 or C45+N, stress relieved before finishing (cast: 550–600 °C; steel: 580–620 °C).
- Functional: 500 × 500 × 70 mm. Bottom face = datum A, ground, flatness 0.01, Ra 0.8. Top face ground, flatness 0.01, parallel 0.01 to A, Ra 0.8.
- Pull-stud bores: diameter, depth and thread **from the module/stud catalogue** (usually H6 or H7). Position Ø0.01 to A|B|C (= ±0.005 mm), all pallets with the same program and fixture.
- T-slots 18H8 (+0.027/0) or M16 grid (6H). Lifting-ledge seats: parallel 0.02 to A.
- Edges under the pallet chamfered 5 × 30° (doc 10). RFID pocket per tag datasheet.
- Protection: functional faces oiled (no paint), other faces painted or black oxide.
- Inspection: CMM for stud positions, surface plate + dial gauge for flatness/parallelism, roughness tester.

**2 · Lifting ledge (VC-APC-PAL-0011)**
- 42CrMo4+QT, induction hardened 52–56 HRC, SHD 1.5–2.5 mm, edges radius R1 before hardening.
- 25 mm wide × full length; lower contact face ground Ra 0.8; height from pallet datum A: both ledges ±0.02 mm.
- Fixing: screws ISO 4762 M8 10.9 (36 N·m) + 2 dowels ISO 8734 Ø8 m6 (+0.006/+0.015) in H7 (+0.015/0) holes. Replaceable.

**3 · Receiver plate on the B-table (VC-APC-PAL-0020)**
- S355J2+N (or EN-GJL-250), stress relieved after rough machining.
- 460 × 460 × 40 mm. Module bores per module catalogue (diameter, depth, O-ring seat Ra 0.8–1.6 for static seals). Bore positions Ø0.01 to A|B|C.
- Oil and air channels drilled, plugged with screw plugs with seal or expander plugs; **pressure test 1.5 × max working pressure, 10 min, no pressure drop, no leak**.
- Top face ground **after mounting on the table**: flatness 0.005, Ra 0.4.

**4 · APC arm (VC-APC-ARM-0510, weldment)**
- S355J2+N; prefer a hot-finished hollow section 160 × 100 × 10 (EN 10210) – fewer long seams. Otherwise 4 plates with fillet welds a = 5.
- Welding per §11.4, quality ISO 5817 **C** (arm-to-hub-plate welds **B**, fatigue loaded), ISO 13920-BF.
- Stress-relief anneal 580–620 °C (§11.4), then machine **in one setup**: hub flange face (datum A) flatness 0.02, Ra 1.6; centring spigot Ø120 g6 (−0.012/−0.034) to fit the hub bore Ø120 H7 (+0.035/0) (example size); both cross-beam seats parallel 0.05 to A and at the same height ±0.05 mm.
- Bolt holes to the hub: position Ø0.2 (clearance holes) to A|B.
- Protection: paint system §11.6 on non-machined faces.

**5 · Cross beams (VC-APC-ARM-0511, weld part)** – S355, flat 45 mm high (passes over the station receivers), welded to the arm before annealing, machined with the arm (seats for the fork rails flatness 0.03, height ±0.02 after shimming).

**6 · Fork rail + wear strip (VC-APC-ARM-0021 / -0022)**
- Rail S355, strip 90MnCrV8 hardened 58–62 HRC, ground Ra 0.8, length 540 mm, lead-in chamfers 2 × 30° at both ends.
- Strips fixed with countersunk screws ISO 10642 M6 10.9, heads 0.5–1 mm below the surface; stainless shims 1.4301 to set all 4 rails **same height ±0.02 mm** (measure on a surface plate or with the arm on the machine).

**7 · Locating block on the fork rail (VC-APC-ARM-0023, 4 off – new, see §9.4)**
- 16MnCr5 case hardened 58–62 HRC (or 90MnCrV8).
- Design load: m·a = 510·1.93 = 985 N, × 1.5 = **1.5 kN** per pallet (taken by the outer blocks; friction ignored because the rails are oily).
- Fixing: 2 × ISO 4762 M8 10.9 (36 N·m) + 2 × ISO 8734 Ø8 m6. Friction grip 2·0.15·17.5 kN (= 28.0/1.6) = 5.3 kN ≥ 1.5 kN.
- Clearance to the ledge ends 0.1 mm per side (example); replace at 0.2 mm.

**8 · Partition wall (VC-APC-ARM-0520, welded frame)** – sheet X5CrNi18-10 2 mm on S235 tube frame 30 × 30 × 2; process 141 (TIG) or 135; ISO 5817 D, ISO 13920-CG; rubber/PU wipers on all edges; mass as low as possible (it is part of J).

**9 · Hub (VC-APC-ROT-0010)**
- 42CrMo4+QT (Rm 900–1100 for d 40–100), 28–34 HRC.
- Centring to the bearing inner ring: fit **from the bearing catalogue** (example Ø290 g6: −0.017/−0.049 in H7 +0.052/0). Centring to the arm: Ø120 H7 (+0.035/0).
- Both flange faces parallel 0.01, perpendicular to the axis 0.01, Ra 1.6; bolt circles position Ø0.1.
- Torque capacity ≥ 1230 N·m (×1.5 shock) by friction of the bolts – see worked example §14.2.
- Protection: black oxide + oil.

**10 · Lift carriage (VC-APC-LFT-0010)**
- S355J2+N plate 40 mm (or EN-GJL-250). Stress relieved after flame cutting / rough machining.
- 4 bores for flanged ball bushings: diameter per bushing catalogue (H7), position Ø0.04 to each other (= ±0.02), axes perpendicular to the top face 0.02/100 mm.
- Bearing seat: flatness ≤ catalogue value (example 0.02), Ra 1.6. Gearbox flange bore with eccentric ring: H7 per gearbox catalogue.

**11 · Base frame (VC-APC-FRM-0510, weldment)**
- S355 tube 80 × 80 × 5 (EN 10219 or EN 10210) + top plate 30 mm; ISO 5817 C; ISO 13920-BF; stress-relief anneal.
- Machine top plate after annealing: flatness 0.05 over 610 mm; 4 column bores Ø50 H7 (+0.025/0), position Ø0.04, perpendicular 0.02/100 mm to the top.
- Columns Ø50 h6 (0/−0.016) are clamped by bolted shaft flanges (an h6 column in an H7 bore is a clearance fit 0 … 0.041 mm). Alternative press fit: bore Ø50 P7 (−0.017/−0.042) gives 0.001 … 0.042 mm interference – check the press force and the column maker's recommendation.
- Levelling screws M20, anchor holes for M16 bonded anchors (§11.8).

**12 · Load-station locating receivers (VC-MEC-TRF-0020, 4 off – drawing belongs to doc 10)** – see doc 10 §11 (same specification as the station receivers of item 1).

**13 · Valve manifold (VC-HYD-MAN-0010, if MAKE)**
- Steel (C45 or S355) or EN AW-6082 T6 only if the maker allows it for the pressure.
- Valve interface ISO 4401-03 (NG6 / CETOP 3): flatness 0.01, Ra 0.8 (or the valve maker's value). Port threads ISO 1179-1 (G) or ISO 6149-1 (metric with O-ring).
- Deburr all cross drillings, clean (no chips!), **pressure test 1.5 × max working pressure**, mark every port P, T, A, B, X, MP.

### 11.4 Welding specification (all weldments of the APC)

| Item | Requirement (example) |
|---|---|
| Process (ISO 4063) | 135 MAG solid wire (136 flux-cored allowed), 141 TIG for stainless sheet |
| Filler / gas | ISO 14341-A G 42 4 M21 3Si1 (for S355); gas ISO 14175 M21 (Ar + 15–25 % CO₂) |
| Quality system | ISO 3834-3 (standard requirements) |
| Welder / procedure | welders qualified to ISO 9606-1; WPS per ISO 15609-1 based on a WPQR (ISO 15614-1) |
| Quality level (ISO 5817) | B: arm-to-hub-plate welds (fatigue); C: all other load-carrying welds; D: guards, covers |
| Fillet throat | a ≥ 3 mm, a ≈ 0.5·t, a ≤ 0.7·t_min. Arm box (t 10): a = 5; base tube (t 5): a = 3–4; top plate to tubes: a = 4 |
| Preheat | usually not needed for S355 up to ≈ 25–30 mm with low-hydrogen MAG; check with EN 1011-2 (carbon equivalent, heat input); never weld below +5 °C part temperature |
| Weld sequence | tack all, weld crosswise and symmetric, in a jig |
| Post-weld stress relief | 580–620 °C, hold ≈ 1 h per 25 mm of the thickest part (min. 1 h), heat/cool ≤ 100 °C/h above 300 °C, furnace cool to 300 °C; record the furnace chart |
| Dimensional tolerance | ISO 13920-BF before machining; leave 3–5 mm machining allowance on functional faces |
| Inspection | VT 100 % (ISO 17637); MT (ISO 17638) on 20 % of the B/C load-carrying welds (100 % of arm-to-hub welds); acceptance level per ISO 17635 for the chosen ISO 5817 level |
| EN 1090 | not normally applied to machine frames (machinery rules apply); applies to building steelwork such as platforms and mezzanines |

### 11.5 Bolt list (examples – use the catalogue values of bought parts first)

| Joint | Bolt (standard, grade) | Qty | Torque μ = 0.12 | Locking / note |
|---|---|---|---|---|
| Bearing outer ring → carriage | ISO 4762 M12 10.9 | per bearing catalogue (example 12) | 123 N·m | crosswise, 3 steps 30/70/100 %; torque paint mark |
| Bearing inner ring → hub | ISO 4762 M10 10.9 | example 12 on Ø270 | 71 N·m | see §14.2 |
| Hub → arm | ISO 4762 M12 10.9 | 8 | 123 N·m | + centring Ø120 H7/g6 |
| Gearbox flange → carriage | ISO 4762 M8 10.9 | per gearbox | 36 N·m | after setting the backlash |
| Lifting ledge → pallet | ISO 4762 M8 10.9 | 6 per ledge | 36 N·m | medium-strength anaerobic thread locker (removable) |
| Locating block → rail | ISO 4762 M8 10.9 | 2 per block | 36 N·m | + 2 dowels |
| Wear strip → rail | ISO 10642 M6 10.9 | 5 per strip | from screw supplier (countersunk heads need less) | thread locker |
| Cylinder flange → base | per cylinder drawing (ISO 6020-2) | 4 | per supplier | |
| Station bracket → APC base | ISO 4017 M16 10.9 + ISO 7089 300 HV washer | 4 | 302 N·m | doc 10 item 4 |
| Base → floor | bonded anchor M16 8.8 | 6 | per anchor ETA | §11.8 |

Rules: no spring washers (they do not lock high-strength bolts); preloaded joints need no locker against loosening if the preload is right, use thread locker on small screws (≤ M8) under vibration or shock; lubricate the thread only if the torque table is for lubricated bolts.

Dowel pins: **ISO 8734** (hardened, m6) – e.g. Ø8 m6 (+0.006/+0.015), Ø12 m6 (+0.007/+0.018); holes drilled and reamed H7 **through both parts together** after alignment; engagement ≥ 1.5·d in each part; in blind holes use ISO 8735 (internal thread for extraction) or vent the hole.

### 11.6 Surface protection

| Surface | Protection (example) |
|---|---|
| Frames, base, guards (indoor, coolant mist → corrosivity C3 per ISO 12944-2) | blast Sa 2½ (ISO 8501-1), epoxy primer + polyurethane top coat, ≈ 160 µm nominal dry film (check the system table in ISO 12944-5 for C3, durability "M" or "H"); colour e.g. RAL 5010, moving parts / stops yellow-black (ISO 3864-1) |
| Machined functional faces | no paint; corrosion-protection oil or wax; protect during transport |
| Hub, shafts, small machined parts | black oxide + oil, or gas nitriding (42CrMo4: hard surface ≈ 500–650 HV, small distortion) |
| Screws | zinc flake (ISO 10683) or black oxide + oil; electroplated zinc (ISO 4042) only with hydrogen-embrittlement control for 10.9 |
| Partition wall, drip tray | stainless 1.4301, no coating |
| Inside oil channels | hydraulic oil after cleaning |

Measure paint thickness with a magnetic gauge (ISO 2808 / ISO 19840).

### 11.7 Hydraulic specification

| Item | Requirement (example, without accumulator: 6 MPa, 14 L/min) |
|---|---|
| Max working pressure | 6 MPa (relief 6.6 MPa); with accumulator see §9.2 |
| Pressure pipes | EN 10305-4 E235+N, **12 × 1.5** (d_i 9 mm, 3.7 m/s at 14 L/min) |
| Return pipes | **15 × 1.5** (d_i 12 mm, 2.1 m/s) |
| Suction | ≥ 25 × 2 or hose DN 20 (≤ 1 m/s), short, no filter finer than the pump maker allows |
| Wall-thickness check (Barlow) | p_allow = 2·σ·s/D with σ = Re/1.5: 12 × 1.5 E235: 2·157·1.5/12 = 39 MPa ≫ 6.6 → ok (use the supplier's pressure table) |
| Fittings | 24° cone fittings ISO 8434-1 (former DIN 2353), series L, with elastomer seal; ports ISO 1179-1 or ISO 6149-1 |
| Hoses | EN 853 2SN (or ISO 18752) – working pressure from the catalogue well above 6.6 MPa; respect min. bend radius, no twist, crimped by a qualified shop, date on the ferrule |
| Oil | HLP 46 (DIN 51524-2), viscosity class ISO VG 46 (ISO 3448) |
| Cleanliness | target ISO 4406 **18/16/13** or better; use the stricter value of the module or valve catalogue (often 17/15/12) |
| Filter | return filter 10 µm, β₁₀(c) ≥ 200 (ISO 16889), with clogging indicator; breather filter on the tank |
| Flushing | before connecting modules and valves: flush with bridges, turbulent flow, until the target ISO 4406 class is measured with a particle counter |
| Pressure test | 1.5 × max working pressure (relief setting), but not above the rated pressure of any part; 10 min, no leak; record |
| Accumulator | bought with the documents required by the Pressure Equipment Directive 2014/68/EU; safety and shut-off block with relief valve and manual drain; must discharge or be isolated automatically when the machine is switched off (ISO 4413 – check the clause); label the pre-charge pressure; national periodic inspection rules apply |
| Labels | every pipe end and port coded as in §12 (1V1-A, …) |
| Safety | ISO 4413: hose whip restraint where a burst can hit people, gauge test points, no pressure on lines being opened (drain first) |

### 11.8 Anchors and grouting

| Item | Requirement |
|---|---|
| Concrete | ≥ C25/30, slab ≥ 200 mm, no joint under the APC base |
| Anchors | bonded anchors M16 8.8 with a European Technical Assessment (ETA); design per EN 1992-4; drill Ø, depth, cleaning (blow–brush–blow), edge distance, spacing, curing time and torque **from the ETA** (each anchor product differs – do not use generic values) |
| Levelling | levelling screws M20 on steel pads; level 0.02 mm/m with a precision level |
| Grout | non-shrink grout (cementitious or epoxy) per supplier, typically 20–50 mm; fill without air pockets; tighten the anchors only after curing (often 24 h) |

### 11.9 Measuring plan (per characteristic)

| Part | Characteristic | Limit | Method / gauge | Frequency |
|---|---|---|---|---|
| Pallet | flatness top / bottom | 0.01 | surface plate + dial gauge 0.001 or CMM | 100 % |
| Pallet | stud bore position | Ø0.01 | CMM (20 °C) | 100 % |
| Pallet | stud bore diameter | per catalogue H6/H7 | plug gauge Go/NoGo or bore gauge | 100 % |
| Ledge | hardness | 52–56 HRC | Rockwell (ISO 6508-1) on a test zone | each batch |
| Arm | end heights | ±0.05 | on the boring mill after machining, dial gauge | 100 % |
| Fork rails | 4 rails same height | ±0.02 | surface plate / height gauge | 100 % |
| Locating block | clearance to ledge | 0.1 ± 0.05 | feeler gauge | 100 %, every 6 months |
| Hub | centring diameter | per fit | micrometer / plug gauge | 100 % |
| Carriage | bushing bore positions | Ø0.04 | CMM | 100 % |
| Base | flatness of top plate | 0.05 | precision level / straightedge | 100 % |
| Base | columns parallel over the stroke | ≤ 0.02 | dial gauge on the carriage | 100 % |
| Welds | throat a, visual | per drawing, ISO 5817 | weld gauge, VT (ISO 17637) | 100 % |
| Welds | surface cracks | ISO 5817 level | MT (ISO 17638) | per §11.4 |
| Receiver plate | flatness after grinding | 0.005 | dial gauge on the spindle / electronic level | 100 % |
| Manifold / channels | pressure test | 1.5 × p, 10 min | test pump + calibrated gauge | 100 % |
| Paint | dry film thickness | ≥ nominal (e.g. 160 µm) | magnetic gauge (ISO 19840) | spot check |
| Oil | cleanliness | ISO 4406 18/16/13 | particle counter | at commissioning, yearly |
| Bolts | torque | per §11.5 | calibrated torque wrench, paint mark | 100 % |

Keep the measured values in the machine file under the part serial number (§12).

### 11.10 Installation and alignment – numeric limits

| Step | What | Limit | Tool |
|---|---|---|---|
| 1 | Machine set and levelled by the machine builder, B = 0° (change position) | builder's values | – |
| 2 | APC base: position and height to the machine change position | ±0.1 mm | laser tracker, or gauge bar + dial gauge from the machine table |
| 3 | Base level | 0.02 mm/m | precision level |
| 4 | Anchors, grout, tighten after curing; re-check step 2–3 | as above | torque wrench |
| 5 | Guide columns parallel over the stroke | ≤ 0.02 mm | dial gauge |
| 6 | Bearing mounting faces | flatness ≤ catalogue (example 0.02) | dial gauge |
| 7 | Bearing bolts crosswise 30/70/100 % | §11.5 | torque wrench |
| 8 | Gear backlash at the mesh | 0.05–0.10 mm | feeler gauge or dial gauge at the pinion pitch circle |
| 9 | Arm ends same height (arm mounted) | ±0.05 mm | dial gauge |
| 10 | Fork rails same height | ±0.02 mm | dial gauge / shims |
| 11 | Cylinder rod coupling: no side load | coupling can move freely by hand at both end positions | by hand |
| 12 | Load station to the APC axis (doc 10 item 4) | ±0.05 mm position, ±0.1 mm height | master pallet + dial gauge |
| 13 | Measured total backlash at r | ≤ 0.5 × capture (example ≤ 0.5 mm) | dial gauge at the pallet edge |
| 14 | Master pallet into the machine modules | drops in without force, seating check OK | – |
| 15 | Light curtain distance with the measured stop time | ≥ calculated S | stop-time meter |

---

## 12. Identification and numbering

This chapter applies the project scheme of **doc 15 (numbering and identification)** to the APC. If anything here differs from doc 15, doc 15 wins.

### 12.1 Drawing numbers

Format: **VC-‹area›-‹group›-‹nnnn›-‹rev›**. Area `APC`; groups (doc 15): `ASY` general assembly · `ARM` arm and cross beam · `LFT` lift unit · `ROT` rotary drive · `FRM` base frame · `PAL` pallet and clamping · `GRD` guards. Hydraulics use area `HYD` (`CIR` circuit, `PWR` power unit, `MAN` manifold, `PIP` piping), electrics area `ELE`.
Number ranges (doc 15, a help only – the number has no meaning): 0001–0009 main assemblies · 0010–0499 sub-assemblies and parts · 0500–0899 welded assemblies · 0900–0999 diagrams and lists.

| Drawing / part number | Content (used in §11) |
|---|---|
| VC-APC-ASY-0001 | APC complete (BOM level 0) |
| VC-APC-ARM-0001 | arm assembly (level 1) |
| VC-APC-ARM-0510 | arm, welded (S355J2) |
| VC-APC-ARM-0511 | cross beam (weld part) |
| VC-APC-ARM-0520 | partition wall, welded frame + sheet |
| VC-APC-ARM-0021 / -0022 / -0023 | fork rail / wear strip / locating block |
| VC-APC-ROT-0001 / -0010 | rotary drive assembly / hub |
| VC-APC-LFT-0001 / -0010 | lift unit assembly / lift carriage |
| VC-APC-FRM-0510 | base frame, welded |
| VC-APC-PAL-0010 / -0011 / -0020 / -0030 | pallet / lifting ledge / receiver plate on the B-table / master pallet |
| VC-APC-GRD-0001 | guards and APC door |
| VC-HYD-CIR-0901 | APC hydraulic circuit diagram (ISO 1219) |
| VC-HYD-MAN-0010 | valve manifold |
| VC-HYD-PIP-0001 | piping plan |
| VC-MEC-TRF-0020 | load-station locating receiver (doc 10) |

Write the revision letter after the number on the drawing and in the file name: VC-APC-ARM-0021-A.pdf.
Rules from doc 15:
- **MAKE part number = drawing number without revision** (VC-APC-ARM-0021); the revision (A, B, …) is a separate field in the BOM/ERP.
- Revision letters **skip I, O, Q, S, X, Z** (A, B, C, D, E, F, G, H, J, K, …).
- If a changed part is **no longer interchangeable** with the old one, it gets a **new number**, not only a new letter.
- **BUY** catalogue parts: `B-<class>-<5 digits>`, e.g. B-BRG-… slewing bearing, B-GBX-… gearbox, B-MOT-… servo, B-CYL-… lift cylinder, B-VLV-… valves, B-SEN-… sensors, B-SCR-… screws (description e.g. "SCREW, SOCKET HEAD, M12x40, ISO 4762, 10.9"), B-PIN-… dowels ("PIN, PARALLEL, 8m6x24, ISO 8734").
- **Raw material:** `R-<class>-<5 digits>`, e.g. R-TUB-… tube 160 × 100 × 10 S355J2, R-PLT-… plate 30 mm S355J2, R-BAR-… bar 16MnCr5.
- Documents: VC-APC-SPEC-0001 (specification), VC-APC-RA-0001 (risk assessment), VC-APC-SRS-0001 (safety requirements), VC-APC-SAT-0001 (site acceptance test). Interface sheet APC ↔ HMC: VC-IF-APC-HMC-0001; AGV ↔ APC load station: VC-IF-AGV-APC-0001.

### 12.2 Hydraulic and pneumatic component codes

On the circuit diagram (ISO 1219-2 style) each component gets **circuit number + letter + counter**: P pump, M motor, A actuator, V valve, S sensor/switch, Z other (filter, accumulator). Check the full format of the current ISO 1219-2 edition.

| Code | Component | Device tag in the electrical schematic (doc 15, IEC 81346) |
|---|---|---|
| 0M1 / 0P1 | pump motor / pump | -MA (motor) |
| 0V1, 0V2 | relief valve, check valve after the pump | – |
| 0Z1 | return filter (with clogging switch) | switch: -BG or -BP (verify) |
| 0Z2 (+ 0V3 safety block) | accumulator | – |
| 0S1 | system pressure switch / transmitter | -BP |
| 1A1 | APC lift cylinder | – |
| 1V1 | lift valve 4/3 | valve -QM, coils -MB (**verify** codes) |
| 1V2 / 1V3 | pilot-operated check valves / throttles | – |
| 2V1 (2V2) | clamp valve (pressure-reducing valve, §9.2) | -QM / -MB (verify) |
| 2S1 | pressure switch "unclamped" | -BP |
| 2A1–2A4 | zero-point modules | – |
| 3V1, 3S1, 3Z1 | seating-air valve, air pressure switch, FRL unit | -QM/-MB (verify), -BP |
| 4A1, 4V1 … | station lift (doc 10 item 1) | as above |

Write the code on a tag at the component **and** on both pipe ends ("1V1-A → 1A1"). Use the **same** designation in the circuit diagram, the electrical schematic, the I/O list and on the device label (doc 15 rule).

### 12.3 Device tags and PLC symbols

Full reference designation (doc 15): function `=MCH.L2.APCHMC01`, location `+FLD.APC` (field, on the APC) or `+CAB01`, device `-BG1`.
Codes confirmed in doc 15: **-BG** position/presence sensor (arm up/down/0°/180°, pallet present), **-BP** pressure switch (clamped, unclamped, seating air), **-BT** temperature sensor (oil), **-FC** fuse/breaker, **-KF** PLC, I/O, safety relay, **-MA** motor (servo, pump motor), **-QA** contactor, **-QB** main switch, **-SF** push-button (operator ready, E-stop), **-XD** terminals. Codes **to verify** before use: -QM valve, -MB valve coil, -PF stack light, -BF flow sensor.

| PLC symbol (§4.11) | Address | Device tag (example) | PLC/SCADA tag (doc 15 style) |
|---|---|---|---|
| ArmUp | %I20.0 | +FLD.APC-BG1 | MCH_L2_APCHMC01_ArmUp_Fb |
| ArmDown | %I20.1 | +FLD.APC-BG2 | MCH_L2_APCHMC01_ArmDown_Fb |
| Arm0deg / Arm180deg | %I20.2 / %I20.3 | -BG3 / -BG4 | … |
| MachineClamped / Unclamped | %I20.6 / %I20.7 | -BP1 / -BP2 | … |
| SeatingAirOK | %I21.0 | -BP3 | … |
| LiftUpValve | %Q20.0 | coil of 1V1 (-MB1, verify) | MCH_L2_APCHMC01_ArmLift_Cmd |
| OperatorReady | %I21.5 | +OP01-SF1 | … |

The numbering of BG1, BG2 … is an example; run the counters as doc 15 says (per letter code inside one function).

### 12.4 Serial numbers and load-carrier IDs

| Item | Format (doc 15) | Example | Where marked |
|---|---|---|---|
| APC assembly | `APC-<YYWW>-<nnnnn>`; YYWW = ISO year + ISO week of assignment, nnnnn restarts at 00001 every ISO week per type | **APC-2546-00001** (2025, week 46, first APC of that week) | type plate (maker, address, designation, serial, year – required for CE marking) |
| Equipment ID (role in the factory) | `APC-HMC01` | the APC on HMC-01 | config, SCADA; ≠ serial number |
| Machining pallet | `PAL-<4 digits>` | **PAL-0007** | engraved + HF RFID tag in the pallet pocket |
| Fixture on the pallet | `FIX-<4 digits>` | FIX-0003 | engraved |
| Crate (doc 10) | `CRT-<6 digits>` | **CRT-000123** | barcode both sides or UHF RFID |
| Traceable parts (hub, arm, pins, pallets) | part number + heat number from the EN 10204 3.1 certificate (doc 15 §3.7) | VC-APC-ROT-0010 / heat 123456 | stamped / engraved in a non-functional area |

Keep the measured values of §11.9 under the APC serial and the pallet IDs.

---

## 13. Standards used for the APC (table)

"Check" = read the clause in the edition you use; standards are revised. The project-wide list with editions and status is doc 16 (standards register).

| Standard | Title (short) | Requirement used here | Value / example | Verification |
|---|---|---|---|---|
| ISO 1 | GPS reference temperature | dimensions valid at 20 °C | 20 °C | measure at room temp |
| ISO 286-1/-2 | ISO code system for tolerances and fits | fits on functional diameters | g6, H7, m6, k6, r6 … | gauges, micrometer |
| ISO 1101 | geometrical tolerancing | form, orientation, position | flatness 0.01 pallet | CMM, dial gauge |
| ISO 2768-1/-2 | general tolerances | unless stated | mK | random check |
| ISO 21920-1 | surface texture indication (replaces ISO 1302) | Ra on drawings | Ra 0.4–3.2 | roughness tester |
| ISO 13715 | edges of undefined shape | burr-free edges | −0.3 | visual |
| ISO 2553 | welding symbols | weld drawing | – | drawing check |
| ISO 4063 | welding process numbers | process | 135, 136, 141 | WPS |
| ISO 3834-3 | welding quality requirements | workshop quality system | part 3 | audit |
| ISO 9606-1 | welder qualification (steel) | qualified welders | valid certificate | certificate |
| ISO 15609-1 / ISO 15614-1 | WPS / procedure test | written procedures | – | WPS, WPQR |
| ISO 5817 | weld imperfections – quality levels | acceptance | B / C / D | VT, MT |
| ISO 13920 | general tolerances for welded constructions | weldment tolerances | BF | measure |
| ISO 17637 / ISO 17638 / ISO 17635 | VT / MT / NDT general rules | weld inspection | 100 % VT, MT % | report |
| EN 1011-2 | welding of ferritic steels | preheat | check CE | WPS |
| EN 1090-2 | execution of steel structures | **not** for the APC frame; for buildings/platforms | EXC class | – |
| EN 10025-2 | non-alloy structural steels | S355J2 | Re 355 | 3.1 certificate |
| EN 10204 | inspection documents | certificate type | 3.1 | file |
| ISO 683-1 / -3 / -17 | heat-treatable / case-hardening / bearing steels | 42CrMo4, C45, 16MnCr5, 100Cr6 | §11.2 | 3.1 certificate, hardness |
| ISO 4957 | tool steels | 90MnCrV8 | 58–62 HRC | hardness |
| EN 1563 / EN 1561 | ductile / grey cast iron | GJS-600-3 / GJL-250 | Rm 600 / 250 | certificate |
| EN 10305-4 | seamless tubes for hydraulics | pipes | E235+N | certificate |
| ISO 6508-1 / ISO 6507-1 / ISO 18203 | Rockwell / Vickers / hardening depth | hardness and depth | 58–62 HRC, CHD 0.8–1.2 | test report |
| ISO 4762 / ISO 4017 / ISO 10642 | socket head / hex head / countersunk screws | fasteners | §11.5 | delivery note |
| ISO 898-1 / ISO 898-2 | property classes bolts / nuts | 8.8, 10.9 | marking on the head | visual |
| ISO 7089 | plain washers | under 10.9 heads | 300 HV | delivery note |
| ISO 8734 / ISO 8735 | hardened dowel pins / with internal thread | dowels | m6 | – |
| VDI 2230 (guideline, not a standard) | bolted joint calculation | preload, torque | α_A, μ | calculation |
| ISO 1219-1 / -2 | fluid power symbols / circuit diagrams | diagram and codes | 1V1 … | drawing check |
| ISO 4401 | valve mounting surfaces | NG6 interface | size 03 | flatness check |
| ISO 6020-2 | 16 MPa compact cylinders | lift cylinder | Ø63/36 | supplier data |
| ISO 8434-1 | 24° cone connectors | fittings | series L | assembly check |
| ISO 1179-1 / ISO 6149-1 | port threads | ports | G / M with O-ring | – |
| EN 853 / ISO 18752 | hydraulic hoses | hose type | 2SN | marking |
| ISO 4413 | hydraulics – safety | circuit safety, accumulator, hoses | check clauses | design review, test |
| ISO 4414 | pneumatics – safety | air circuit | exhaust, energy isolation | design review |
| ISO 4406 | oil cleanliness code | target class | 18/16/13 | particle counter |
| ISO 16889 | filter multi-pass test | filter rating | β₁₀(c) ≥ 200 | filter data sheet |
| ISO 3448 / DIN 51524-2 | viscosity grades / HLP oils | oil | VG 46 HLP | oil data sheet |
| ISO 8573-1 | compressed air quality classes | seating air | per module catalogue | dew-point / filter check |
| 2014/68/EU (PED) | pressure equipment | accumulator documents | category per supplier | documents |
| ISO 12100 | risk assessment | whole APC + station | – | risk assessment file |
| ISO 13849-1 / -2 | safety-related control parts | PL of each safety function | PL d (example) | SISTEMA-type calculation, validation |
| ISO 13855 | positioning of safeguards (approach speed) | light-curtain distance | S = K·T + C, 640 mm | stop-time measurement |
| ISO 13857 | safety distances (reach) | guard openings, heights | per tables | measure |
| ISO 14119 | interlocking devices | door switches, guard locking | – | function test |
| ISO 14120 | guards | fixed guards need a tool | – | inspection |
| ISO 13850 | emergency stop | E-stop function | – | test |
| ISO 14118 | prevention of unexpected start-up | energy isolation, LOTO | – | procedure |
| IEC 60204-1 | electrical equipment of machines | wiring, E-stop category | – | inspection, tests |
| IEC 61496-1/-2 | electro-sensitive protective equipment | light curtain | type 4 | device certificate |
| ISO 16090-1 | machining centres – safety | machine side | – | builder |
| ISO 12944-2 / -5 | corrosion protection by paint | category, system | C3 | DFT measurement |
| ISO 8501-1 | surface preparation grades | blasting | Sa 2½ | visual comparison |
| ISO 10683 / ISO 4042 | zinc flake / electroplated coatings on fasteners | screw coating | – | supplier |
| ISO 3864-1 | safety colours | yellow/black | – | visual |
| ISO 1328-1 / ISO 6336 | gear accuracy / gear load capacity | ring gear and pinion | grade ≈ 8 (example) | supplier |
| EN 1992-4 | anchoring to concrete | anchor design | per ETA | ETA, torque |
| (EU) 2023/1230 | Machinery Regulation | CE marking from 20 Jan 2027 (before: 2006/42/EC) | – | technical file |

---

## 14. Complete worked example

### 14.1 APC lift circuit – from load to test

**Step 1 – Load.** Lifted mass m = 2 pallets × 510 + arm 180 = 1200 kg (carriage, rotor, gearbox and servo are not in the page value – **add them** for your design; here kept at 1200 kg to match the page).
Static weight W = 1200·9.81 = 11 772 N.

**Step 2 – Motion.** Stroke s = 60 mm in t = 0.8 s with half the time accelerating, half braking (triangle): a = 4·s/t² = 4·0.06/0.64 = 0.375 m/s²; peak speed v_max = 2·s/t = 150 mm/s; mean speed 75 mm/s.

**Step 3 – Force.** F = m·(g + a)·1.1 = 1200·10.185·1.1 = 13 444 N. With 25 % reserve: F_req = 16 805 N.

**Step 4 – Cylinder.** D_min = √(4·F_req/(π·p)) = √(4·16 805/(π·6)) = 59.7 mm → **Ø63/36** (ISO 6020-2 compact), A = 3117 mm², A_r = 2099 mm². F_real = 6·3117 = 18 702 N (90 % used). Hold pressure without motion: 11 772/3117 = **3.8 MPa**.

**Step 5 – Rod.** Compression σ = 18 702/1018 = 18 N/mm². Slenderness λ = 300/9 = 33 → no buckling (§10.2). Rod-end pin Ø20 double shear 30 N/mm².

**Step 6 – Flow.** Using the mean speed (the page): Q = 3117·75·60/10⁶ = 14.0 L/min. (At the peak speed 150 mm/s the cylinder would need 28 L/min; a pump of 14 L/min gives a constant 75 mm/s instead, which also lifts in 0.8 s. With an accumulator the peak can be delivered.)

**Step 7 – Pump and motor (no accumulator).** V = 14/(1450·0.9) = 10.7 cm³/rev → 11 cm³ internal gear pump. P = 6·14/(60·0.85) = 1.65 kW → **2.2 kW IE3 motor** (next standard size).

**Step 8 – Valves.** 1V1: 4/3 NG6 (ISO 4401-03), centre **A, B → T, P blocked** (§9.3), 24 V DC; read the pressure drop at 14 L/min from its Δp–Q curve. 1V2: double pilot-operated check valve (sandwich NG6), pilot ratio from the catalogue: pilot needed ≥ 3.8/ratio + spring. 1V3: double throttle-check sandwich, meter-out.

**Step 9 – Lowering throttle.** Load pressure 3.8 MPa drives the oil out of the piston side; to limit the speed to 75 mm/s (14 L/min): A = Q/(C_d·√(2Δp/ρ)) = 2.333·10⁻⁴/(0.62·√(2·3.8·10⁶/870)) = 4.0 mm² → start with the throttle nearly closed and open it until the lowering takes 0.8 s.

**Step 10 – Pipes.** Pressure line 12 × 1.5 (3.7 m/s), return 15 × 1.5 (2.1 m/s), suction DN 20. Pressure drop for 5 m pressure line: 0.29 MPa warm, 1.26 MPa cold → the pump must deliver 6 + losses; set the relief at 6.6 MPa only after checking the cylinder gets ≥ 5.4 MPa (F_req/A) with warm oil.

**Step 11 – Tank and cooling.** Tank ≈ 4 × 14 = 56 L. Heat: lowering 706 J and throttling losses per cycle, each ≈ 352 s – very low mean heat; a cooler is only needed if the same unit also feeds other consumers.

**Step 12 – Accumulator option.** p1 = 6, p2 = 7.5, p0 = 5.4 MPa (gauge): adiabatic V0 = 1.39 L → choose ≥ 1.75 L (next catalogue size). Pump: refill 0.187 L in, say, 10 s → 1.1 L/min → small pump 1.5 cm³/rev, motor 0.37–0.55 kW. Relief 8.3 MPa, modules through a pressure-reducing valve at 5 MPa. All parts rated ≥ 10 MPa.

**Step 13 – Manufacture.** Manifold per §11.3 part 13; pipes bent cold, de-burred, pickled or flushed; fittings ISO 8434-1 assembled to the maker's instructions; pressure test 1.5 × 6.6 = **9.9 MPa** (without accumulator; check all part ratings), 10 min.

**Step 14 – Commission and test.** Flush to ISO 4406 18/16/13; bleed the cylinder; set relief 6.6 MPa; set throttles for 0.8 s up / 0.8 s down without impact; hold test: full load up, valve in centre, HPU off, 10 min → sinking ≤ 0.1 mm (example limit, dial gauge on the carriage); measure the lift time with the PLC log.

### 14.2 Hub to bearing inner ring – bolted joint

Data (example, use the bearing catalogue): 12 × M10 10.9 on bolt circle D = 270 mm (R = 0.135 m), μ = 0.15 between the faces (clean, dry), α_A = 1.6.
- Preload: F_M = 44.6 kN (table, μ 0.12) → F_V,min = 44.6/1.6 = **27.9 kN** per bolt. Torque 71 N·m.
- Torque to transmit: 1230 N·m (incl. ×1.5 shock) → tangential force at the bolt circle F_t = 1230/0.135 = **9.1 kN**.
- Friction capacity: n·μ·F_V,min = 12·0.15·27.9 = **50.2 kN** → safety 50.2/9.1 = **5.5** (aim ≥ 2) ✓.
- Tilting moment: Mk = 2.08 kN·m × 1.5 = 3.12 kN·m → max extra bolt force F = 2·M/(n·R) = 2·3120/(12·0.135) = **3.85 kN** ≪ 27.9 kN → the joint does not open ✓. (Axial load 11.8 kN presses the joint – it helps.)
- Thread engagement in 42CrMo4 hub: ≥ 1.0·d = 10 mm, take 15 mm.
- Manufacture: hub faces parallel 0.01, Ra 1.6, holes position Ø0.1; tighten crosswise 30/70/100 % and a final 100 % round; paint mark; re-check after 500 changes (embedding).

---

## 15. Data you still need (honest list)

Nothing below can be found in this guide or in the twin; get it before releasing drawings.

| # | Data | From whom | Why |
|---|---|---|---|
| 1 | Real pallet, fixture and part masses, centre of gravity, largest part outline | your fixture design | J, lift force, sweep circle |
| 2 | Machine change position, B-axis table interface, receiver height, rotary union space, door opening | machine builder | all APC interfaces |
| 3 | Zero-point module data: pull-in force, release pressure (min/max), capture range, stud fits and bores, oil and air quality, cleanliness class | module supplier | receiver plate, pallet, circuit |
| 4 | Slewing bearing: drawing, bolt pattern and torque, mounting-face flatness, fits, static/dynamic ratings, lubrication | bearing supplier | carriage, hub |
| 5 | Gearbox and servo: real torque, inertia, backlash, brake torque, safety functions (STO/SS1/SBC), sizing tool result | drive supplier | servo choice, backlash, safety |
| 6 | Masses of carriage, rotor, gearbox, servo, wall (from CAD) | your CAD | lift force, J |
| 7 | Real stop time of the arm (measured) | commissioning | ISO 13855 distance |
| 8 | Risk assessment and required PL of each safety function | integrator / safety engineer | ISO 13849 design |
| 9 | Floor: concrete class, thickness, flatness, joints | building / civil engineer | anchors, base |
| 10 | Anchor ETA (drill, depth, torque, edge distances) | anchor supplier | installation |
| 11 | Accumulator decision (with / without) and component pressure ratings | you + hydraulic supplier | §9.2 |
| 12 | Paint system data sheet and corrosivity decision | paint supplier | §11.6 |
| 13 | Gear calculation (ISO 6336) for ring gear and pinion | gear supplier | ring gear life |
| 14 | Bearing life calculation with the duty cycle | bearing supplier | §8 limit "no life calculation" |
| 15 | Fatigue check of the arm-to-hub welds with the real geometry (FEM or hand calculation) | you / FEM | 0.6 million cycles |
| 16 | Workshop capability: largest annealing furnace, boring mill size, CMM, grinding | your workshop | manufacturing route |
| 17 | Free numbers in each group and the BUY/raw-material numbers from the ERP (doc 15) | project / ERP | §12 |
| 18 | Current editions of the standards in §13 | standards shop | clauses may change |

---

## 16. Glossary

| Term | Meaning |
|---|---|
| APC | Automatic Pallet Changer |
| HMC | Horizontal Machining Centre |
| B-axis | rotary table axis of the HMC |
| Zero-point module | clamping unit: spring clamp, hydraulic release, taper location |
| Pull stud | pin under the pallet that the module grips |
| Capture range | how far off the stud may land and still be pulled into place |
| Lifting ledge | hardened strip on the pallet side; the fork rails lift here |
| Fork rail | rail on the APC arm that lifts the pallet |
| Partition wall | wall on the arm between machine and operator side |
| Swing circle | circle swept by the pallets: Ø = 2r + diagonal |
| Trapezoid profile | accelerate – constant speed – decelerate |
| Inertia ratio | load inertia at the motor ÷ motor inertia |
| Backlash | play in the gears, here in arcmin (1′ = 1/60 °) |
| Slewing bearing | large bearing that carries axial load and tilting moment |
| Crossed roller bearing | slewing bearing type with rollers at 90° to each other |
| STO | Safe Torque Off (drive safety function) |
| F-DI / F-DQ | fail-safe digital input / output |
| OSSD | safety output of a light curtain |
| PL d | Performance Level d (ISO 13849-1) |
| HPU | Hydraulic Power Unit |
| NG6 / CETOP 3 | valve size / mounting pattern |
| 4/3, 3/2 valve | number of ports / number of positions |
| Pilot-operated check valve | check valve that is opened by pilot pressure; holds the load |
| Meter-out throttle | throttles the oil leaving the cylinder (controls speed) |
| Accumulator pre-charge p0 | nitrogen pressure in the bladder without oil |
| HLP 46 | hydraulic oil type / viscosity class |
| M60 / FIN | NC M-code that calls the change / finish signal back to the NC |
| PROFIdrive | drive profile on PROFINET |
| IO-Link | point-to-point sensor communication with diagnostics |
| MAKE / BUY | you manufacture / buy from a catalogue |
| Re / Rp0.2 / Rm | yield strength / 0.2 % proof strength / tensile strength (N/mm²) |
| HRC / HV | Rockwell C / Vickers hardness |
| CHD / SHD | case hardening depth / surface hardening depth (ISO 18203) |
| +N / +QT | normalised / quenched and tempered |
| IT grade, H7, g6 | ISO 286 tolerance grade and fit symbols (capital = hole, small = shaft) |
| Ra | arithmetic mean roughness in µm |
| Datum A, B, C | reference features for geometric tolerances (ISO 1101) |
| Throat a | thickness of a fillet weld (height of the inner triangle) |
| WPS / WPQR | welding procedure specification / its qualification record |
| FAT (weld) | fatigue class: allowed stress range at 2 million cycles (IIW) – not the same as FAT = factory acceptance test |
| Preload F_V, α_A | clamping force of a bolt / scatter factor of the tightening method |
| Worst case / RSS | sum of all errors / root of the sum of squares |
| Adiabatic / isothermal | gas change without / with heat exchange (fast / slow) |
| Exact constraint | exactly 6 contacts for 6 degrees of freedom (kinematic coupling) |
| ETA | European Technical Assessment (approval of an anchor) |
| EN 10204 3.1 | material inspection certificate with test values, signed by the producer's inspector |
| ISO 4406 code | oil cleanliness: particle classes ≥ 4 / 6 / 14 µm(c) |
| B- / R- numbers | BUY part and raw-material numbers (doc 15) |
