# 12 – HMC Build: Rotary Table (B-axis) with Duplex Worm Drive + Worm Manufacturing Twin

> **All numbers in this guide are example values from the twin.** They are typical for a 500 mm pallet
> class HMC. Before you order, machine or assemble anything, replace them with values from your drawings,
> the catalogues of your bearing, encoder, servo and clamp suppliers, and your own measurements.
> Costs in the twin use example hourly rates. They are **not** real prices.

Note on the name: the original request said "warm maching". We understood this as **worm machining /
worm drive**. Both items in the twin are about the worm drive of the B-axis.

Source files: `web/hmc.js` (item 1), `web/wormmfg.js` (item 2). Tab: **HMC build** (`#hmc`).

---

## Contents

1. Purpose
2. Where in the twin
3. Concepts – simply explained
4. Calculations (with the example numbers)
5. Manufacturing, assembly and inspection – step by step
6. Checklists
7. Common mistakes and lessons
8. Limits of the twin
10. Science principles (worm gear, contact, bearings, heat, case hardening, grinding burn, measurement)
11. Detailed manufacturing specification (materials, heat treatment, fits with numbers, geometric
    tolerances, Ra, bolts, lubricants, measuring plans, cutting data, tools, fixtures, drawing notes)
12. Identification and numbering (drawings, serials, matched pairs, NC programs, tools, gauges, heats)
13. Standards (requirement, value used, verification)
14. Complete worked example: worm WRM-2546-00017 from bar to released part
15. Data you still need
16. Glossary

(Chapter 9 is not used – the numbering follows the common chapter plan of the guide book, see `00_INDEX.md`.)

---

## 1. Purpose

This guide is for the team that will **make the parts of the HMC rotary table in the real workshop**.

The rotary table (the **B-axis**) turns the pallet, so the horizontal machining centre (HMC) can machine
4 or more sides of a part in one clamping. A servo motor drives a hardened and ground **worm**. The worm
turns a bronze **worm wheel** (example ratio 1:90). The wheel is bolted under the table.

The guide has two parts:

| Part | Item in the twin | What you learn |
|---|---|---|
| Part 1 | Item 1 – Rotary table (B-axis, worm drive) | Parts, cross-section, 14 assembly + measuring steps, duplex worm backlash setting, contact pattern, process plans for every part you make, design calculations, checks, BOM, acceptance tests, maintenance |
| Part 2 | Item 2 – Worm manufacturing twin | How the duplex worm is made: 12 operations from the saw to the test bench, the formulas of each operation, the part record, 7 typical faults (where they start, where you find them, how to prevent them), lot simulation with Cpk, time and cost route, make-or-buy |

**Main findings from the example values (read these first):**

| # | Finding | Number (example) | What it means for you |
|---|---|---|---|
| 1 | The worm is **not self-locking** | lead angle γ = 4.57° > friction angle ρ' = 1.83°, efficiency η ≈ 71 % | The table can turn the worm backwards. You **need** the hydraulic clamp and a servo motor with a holding brake. |
| 2 | The worm is **too weak for roughing while the table turns** | tooth force 5 556 N > allowed 2 714 N (Bach) | Rough only with the table **clamped**. While the table turns (simultaneous 4-axis cutting) the allowed side cutting force is only ≈ **1.95 kN** (1 954 N). |
| 3 | A **direct angle encoder** is needed | ±2.7″ with encoder, ±18″ without | With the encoder the worm only drives; the encoder decides the position. |
| 4 | **Duplex worm** backlash setting | axial shift ≈ **2.6 mm** (2.64 mm) from 0.050 mm to 0.008 mm backlash | You grind the spacer ring to the size you find at assembly. |

---

## 2. Where in the twin

### 2.1 How to open

1. Start the twin: `python server.py` (or double-click `start.bat`).
2. Open `http://localhost:8080` in the browser.
3. Click the tab **HMC build**.
4. At the top you see 3 buttons:
   - **1 · Rotary table (B-axis, worm drive) – machining + assembly**
   - **2 · Worm manufacturing – digital twin (saw → inspection → test bench)**
   - 3 · (disabled – the next item is not built yet, for example spindle unit, column + slides, tool magazine)

Everything runs offline in the browser (2D SVG drawings, no libraries).

### 2.2 Item 1 – what is on the page

| Card | What it shows | What you can do |
|---|---|---|
| KPI row | Ratio, motor, accuracy, backlash, self-locking, number of checks OK | Read the result at a glance |
| Assembly – step by step | Cross-section through the B-axis with 14 animated steps. Parts slide in when they are fitted. A red "measure" symbol shows where to measure. | Play / step / slider; **click a part** for its data (make/buy, material, key value) |
| Backlash setting with the duplex worm | Axial section of the duplex worm and wheel teeth, backlash bar, formula, 3 contact pattern pictures | Move the slider (= axial shift of the worm, 0–5 mm), button "set to target" |
| Process plan – parts you make | Operation tables for Housing, Table, Worm wheel, Duplex worm, Clamp, Cartridges | Click the part buttons |
| Assembly + measuring steps | Table of the 14 steps with the check of each step | Click a row → the drawing jumps to the step |
| Design inputs | All inputs in 4 groups (rotating parts, worm gear, loads + clamp, accuracy) | Change values; "Example values" resets. Values are stored in the browser (localStorage `hmcRotState`) |
| Checks | 9 checks with green / yellow / red | – |
| Calculations | 7 formula blocks with your numbers | – |
| Bill of materials | MAKE / BUY list | – |
| Guide | Workshop rules, acceptance tests, maintenance | – |

Pallet size and load come from the **Pallet changer** tab (`window.APC`). Example: pallet 500 × 500 mm,
pallet 110 kg, workpiece + fixture 400 kg, load offset 50 mm, zero-point pitch 400 mm.

### 2.3 Item 2 – what is on the page

| Card | What it shows |
|---|---|
| KPI row | Worm serial no., status (released / REJECT at Op …), time per worm, cost per worm, lot lead time, max lead error |
| Process twin | Route buttons Op 10 … Op 120, animated scene of each operation, steps list, settings, checks. Buttons: Play all, speed ½× / 1× / 2×, **New worm (random)**, **Download part record** (JSON) |
| Inject a process fault | 7 fault buttons (see 5.9) |
| Inspection report (Op 100) | Charts: lead, profile, runout, single pitch, over-wire size M; check list |
| Test bench report (Op 110) | Charts: transmission error (1 wheel turn + zoom 5 worm turns), backlash vs axial shift, run-in temperature, efficiency; check list |
| Part record – route, time, cost | Table per operation: set-up, min/worm, cost/worm, result |
| Lot simulation | 50 worms, 11 characteristics, mean, σ, Cpk, out-of-tolerance count, yield |
| Process inputs | Thread roughing method (whirling / single-point / disc milling) and 6 input groups (localStorage `hmcWormMfg`) |
| Calculations | 7 formula blocks |
| Guide | How the twin works, fault table, workshop rules, matched pair, make or buy |

The worm geometry (m, z1, d1, z2, Δp, j0, jt, μ) comes from item 1 (`window.HMCROT`). If you change the
worm in item 1, item 2 updates.

### 2.4 Deep links (put them in work instructions)

| Link | Opens |
|---|---|
| `http://localhost:8080/?hrstep=6&hrshift=2.6&hrplan=worm#hmc` | Item 1, assembly step 6 (contact pattern), worm shifted 2.6 mm, process plan of the worm |
| `?hrstep=7#hmc` | Step 7 (backlash setting) |
| `?hrplan=housing#hmc` | Process plan of the housing. Other keys: `table`, `wheel`, `worm`, `clamp`, `cart` |
| `http://localhost:8080/?hritem=2&wmop=80&wmu=0.4&wmf=burn,thermal&wmsn=3#hmc` | Item 2, Op 80 (thread grinding) at 40 % progress, faults "burn" + "thermal" on, worm no. 3 |
| `?hritem=2&wmop=40#hmc` | Item 2 at Op 40 (rough thread) |

Parameters: `hrstep` = step 1–14; `hrshift` = worm shift in mm (0–5); `hrplan` = plan key; `hritem=2` =
show item 2; `wmop` = operation number (10, 20 … 120); `wmu` = progress 0–1 inside the operation;
`wmf` = fault keys separated by commas (`stock`, `hard`, `centre`, `burn`, `thermal`, `dress`, `duplex`);
`wmsn` = worm serial number (changes the random values).

---

## 3. Concepts – simply explained

### 3.1 The rotary table in one picture (cross-section, from bottom to top)

```
                     ┌──────────── test pallet (500 × 500) ────────────┐
                     │   zero-point modules (4)  in the table top       │
   ┌─────────────────┴──────────────────────────────────────────────────┴───┐
   │ TABLE TOP Ø580  (+ hub sleeve going down through the bearing)          │
   └──┬────────────────────────────┬──────────────────────────┬─────────────┘
      │ main axial-radial bearing  │   clamp disc  ← clamp ring (hydraulic)  │ labyrinth + seal
      │ (bore 200)                 │                                          │
      │   encoder scale ring + 2 read heads (on the hub sleeve)              │
      │                                                                      │  HOUSING
      │   WORM WHEEL (bronze rim on steel hub), bolted under the hub ───── WORM (axis ⟂ page)
      │                                                                      │  in 2 cartridges
   rotary union (hydraulic + air) in the centre                              │
   └─────────────────────────────── base face = reference A ─────────────────┘
```

Part list of the cross-section (the twin colours each part; click it for data):

| Part | Make / buy | Material / type | Job | Key value (example) |
|---|---|---|---|---|
| Housing | MAKE | EN-GJL-300 casting | Carries everything. Bearing seat and worm bores are machined in ONE set-up – this fixes the centre distance and the perpendicularity. | centre distance a = 205.0 ±0.01 mm |
| Main bearing | BUY | axial-radial cylindrical roller bearing, bore 200 | Takes axial load, radial load and tilting moment in one bearing – very stiff, low runout | tilting moment 2.0 kN·m of 25 allowed |
| Table top + hub sleeve | MAKE | EN-GJS-600 / C45 | Carries zero-point modules and pallet. The top is ground in its own bearing at the end. | Ø580 mm |
| Worm wheel | MAKE | CuSn12Ni2 bronze rim on C45 hub | Bronze against hardened steel: low wear, good running-in. Matched pair with the worm. | z2 = 90, m = 4, d2 = 360 mm |
| Duplex worm + bearing cartridges | MAKE | 16MnCr5, case hardened + ground | Axial shift sets the backlash. Fixed bearing pair on the motor side. | d1 = 50 mm, lead angle 4.57° |
| Clamp ring + clamp disc | MAKE / BUY | hydraulic thin-wall clamp ring | Holds the table during indexed (4-axis positioned) machining, so the cutting force does not load the worm | 3 000 N·m holding torque |
| Angle encoder | BUY | hollow-shaft angle encoder, 2 read heads | Measures the table angle directly → worm pitch errors and backlash do not matter (closed loop) | ±2.5″ |
| Rotary union | BUY | hydraulic + air passages | Brings oil (pallet clamping) and air (seat check, cleaning) into the turning table | 4–6 passages |
| Labyrinth cover + seals | MAKE + BUY | labyrinth + sealing air | Keeps coolant and chips out of bearing and worm | sealing air 0.5 bar |
| Zero-point modules (4) | BUY | zero-point clamping modules | Clamp the pallet (see Pallet changer tab / guide 09) | pitch 400 mm |
| Test pallet | (APC) | machining pallet | For the final checks | 500 × 500 mm |

### 3.2 Worm drive – the basic idea

- The **worm** is a screw. One turn of a 1-start worm moves the wheel by **one tooth**.
- So with z2 = 90 teeth the ratio is **1:90**: the motor turns 90 times for 1 table turn.
- Big ratio in a small space, very smooth, high stiffness. That is why HMC rotary tables use it
  (typical ratios 1:90 to 1:360).
- Worm = hard steel, ground. Wheel = bronze. Bronze on hardened steel slides well and runs in.

### 3.3 Why the worm is NOT self-locking here

- A worm "self-locks" when the wheel **cannot** turn the worm backwards. This happens only when the lead
  angle γ is **smaller than or equal to** the friction angle ρ'.
- A precise ground worm with good oil has very low friction (μ ≈ 0.03). Then ρ' is small (1.83°), and
  our lead angle (4.57°) is bigger. → **not self-locking**.
- Result: a cutting force on the table can turn the worm and the motor. So the table needs:
  1. a **hydraulic clamp** for machining with the table standing still, and
  2. a **servo motor with a holding brake** (for power loss and E-stop).
- Do not try to "make it self-locking" with a smaller lead angle: efficiency drops, heat rises, and
  self-locking from friction is never safe under vibration.

### 3.4 Why a DUPLEX worm

- **Normal worm:** both flanks have the same lead. Backlash can only be changed by changing the centre
  distance. That moves the contact pattern and spoils the mesh.
- **Duplex worm:** the left flank and the right flank have **slightly different leads**.
  Example: px = 12.566 mm, Δp = 0.2 mm → left flank lead 12.466 mm, right flank lead 12.666 mm.
- Result: the thread gets **thicker along the worm** (and the gap gets narrower).
- If you **shift the worm axially**, a thicker part of the thread comes into the mesh → less backlash.
- The centre distance and the contact pattern do **not** change.
- After years of wear you can shift the worm again and re-set the backlash. This is the main advantage.

```
  wheel teeth (fixed)      ▼   ▼   ▼   ▼   ▼   ▼
  worm thread             ▲   ▲   ▲    ▲    ▲    ▲      ← thread thickness grows to the right
                          thin ───────────────→ thick
  shift worm ←  :  thicker thread enters the mesh  →  backlash smaller
```

### 3.5 Contact pattern

- Paint the worm thin with **marking paste**. Turn both directions. Look at the mark on the wheel tooth.
- **Good:** pattern in the middle of the tooth, at least 60 % of the flank, slightly towards the mesh
  **exit** side (so oil can enter at the entry side).
- **Too high / too low:** move the wheel axially with **shims** until the pattern is centred.
- The twin shows 3 pictures: "✓ centred", "too high → shim", "too low → shim".

### 3.6 Direct angle encoder with 2 opposite read heads

- **Without** a table encoder, the position comes from the motor encoder through the worm. Then every
  pitch error of the wheel, the backlash and thermal growth go directly into the table angle.
- **With** a direct encoder on the table, the control closes the loop on the real table angle. The worm
  only drives.
- The scale ring is never perfectly centred. An eccentricity e on scale radius Rs gives an angle error.
  **Two read heads exactly opposite (180°)** see the error with opposite sign. The average cancels it.

### 3.7 One set-up rule

Everything that must fit together is machined in **one clamping**: housing bearing seat + worm bores;
all seats of the table. Every re-clamping costs about 0.01–0.02 mm.

### 3.8 Matched pair

Worm and wheel are made for each other (wheel hobbed with a duplex hob of the same leads and profile,
then tested together). They get the **same pair number**. Never replace only one of them.

### 3.9 The process twin (item 2) in one sentence

Every worm gets a **part record** ("birth certificate"): the route of 12 operations, the settings and
every measured value. In the real factory the machines write it (MES). In the twin the values are
**simulated** with random variation, and you can switch on faults to see where they start and which
check finds them.

---

## 4. Calculations (with the example numbers)

All formulas are taken from the code. Numbers are the example values of the twin.

### 4.1 Inputs of item 1 (example values)

| Group | Input | Symbol | Example | Note |
|---|---|---|---|---|
| Rotating parts | Table + hub + worm wheel mass | mt | 220 kg | |
| | Table radius | Rt | 290 mm | Ø580 table for a 500 pallet |
| | Max. table speed | nmax | 20 rpm | HMC B-axis 10–30 rpm |
| | Acceleration time | ta | 0.4 s | |
| Worm gear | Worm starts | z1 | 1 | |
| | Worm wheel teeth (= ratio) | z2 | 90 | 1:90 – 1:360 |
| | Axial module | m | 4 mm | |
| | Worm pitch diameter | d1 | 50 mm | |
| | Wheel face width | b2 | 36 mm | |
| | Friction (ground worm / bronze, oil) | μ | 0.03 | 0.02–0.05 |
| | Allowed tooth load factor (Bach) | c | 6 N/mm² | bronze / hardened steel, slow |
| | Duplex lead difference L/R flank | Δp | 0.2 mm | per pitch |
| | Backlash as hobbed (start) | j0 | 0.050 mm | |
| | Target backlash | jt | 0.008 mm | 0.005–0.010 |
| Loads + clamp | Cutting force (side) | Fc | 4 000 N | from Pallet changer tab |
| | Cutting radius from the B-axis | rc | 250 mm | |
| | Cutting height above the bearing | hcut | 450 mm | table + pallet + fixture |
| | Safety factor | S | 2 | |
| | Clamp holding torque (catalogue) | Tcl | 3 000 N·m | hydraulic clamp ring, 5 MPa |
| | Bearing allowed tilting moment | Mk,allow | 25 kN·m | catalogue |
| | Bearing static axial load rating | C0a | 900 kN | catalogue |
| Accuracy | Angle encoder accuracy | enc | ±2.5″ | |
| | Scale eccentricity after centring | e | 0.005 mm | |
| | Scale radius | Rs | 105 mm | |
| | Read heads | – | 2 | opposite |
| | Wheel cumulative pitch error | Fp | ±12″ | DIN 3974 class 5 (example) |
| | Temperature rise of the table | ΔT | 5 K | (input only – see 8) |
| From APC tab | Pallet a × b, pallet mass, workpiece mass, offset e, module pitch | | 500 × 500 mm, 110 kg, 400 kg, 50 mm, 400 mm | |

1″ (arc second) = 1/3600 degree. Conversion used in the code: 1 rad = 206 265″.

### 4.2 Worm gear geometry

| Quantity | Formula | Example |
|---|---|---|
| Ratio | i = z2 / z1 | 90 / 1 = **90** |
| Wheel pitch diameter | d2 = m · z2 | 4 · 90 = **360 mm** |
| Axial pitch | px = π · m | π · 4 = **12.566 mm** |
| Centre distance | a = (d1 + d2) / 2 | (50 + 360) / 2 = **205.0 mm** |
| Lead angle | γ = atan(z1 · m / d1) | atan(1 · 4 / 50) = **4.57°** |
| Sliding speed | vs = π · d1 · (nmax · i) / 60 / cos γ | π · 0.050 m · 1 800 rpm / 60 / cos 4.57° = **4.73 m/s** |

Check: sliding speed for bronze in oil bath ≤ 6 m/s (warning up to 10 m/s). 4.73 m/s → OK.

### 4.3 Efficiency and self-locking

| Quantity | Formula | Example |
|---|---|---|
| Friction angle | ρ' = atan(μ / cos 20°) | atan(0.03 / 0.940) = **1.83°** |
| Efficiency, worm drives | η = tan γ / tan(γ + ρ') | tan 4.57° / tan 6.40° = 0.0800 / 0.1122 = **0.71 (71 %)** |
| Efficiency, wheel drives back | η' = tan(γ − ρ') / tan γ (only if γ > ρ') | tan 2.75° / tan 4.57° = **0.60 (60 %)** |
| Self-locking? | only if γ ≤ ρ' | 4.57° > 1.83° → **NO** |

**Why it matters:** 60 % back-driving efficiency means the wheel turns the worm easily. The clamp and
the brake must hold the table, not the worm.

### 4.4 Motor (acceleration torque)

| Step | Formula | Example |
|---|---|---|
| Inertia of the table (disc) | Jt = ½ · mt · Rt² | ½ · 220 · 0.29² = **9.25 kg·m²** |
| Inertia of pallet + load | Jp = m_pl · (a² + b²)/12 + mw · e² | 510 · (0.5² + 0.5²)/12 + 400 · 0.05² = 21.25 + 1.00 = **22.25 kg·m²** |
| Total | J = Jt + Jp | **31.50 kg·m²** |
| Angular speed | ω = 2π · nmax / 60 | 2π · 20 / 60 = **2.094 rad/s** |
| Angular acceleration | α = ω / ta | 2.094 / 0.4 = **5.24 rad/s²** |
| Torque at the table | T = J · α · 1.1 | 31.50 · 5.24 · 1.1 = **181 N·m** |
| Motor speed | n_m = nmax · i | 20 · 90 = **1 800 rpm** |
| Motor torque | T_m = T / (i · η) | 181 / (90 · 0.713) = **2.83 N·m** |
| Servo choice | first servo with T_max ≥ 1.3 · T_m and n_max ≥ n_m | 1.3 · 2.83 = 3.68 N·m ≤ 3.8 N·m → **0.4 kW** (T_n 1.3, T_max 3.8 N·m, 6 000 rpm) |

m_pl = pallet + workpiece = 110 + 400 = 510 kg. The factor 1.1 adds 10 % for friction.

**Warning:** this is only the acceleration torque. It does not include bearing drag, seal friction, the
clamp disc drag or cutting torque while turning. See section 8. In practice choose the servo with margin
after a full torque budget.

Servo list used by the twin (example data):

| kW | T_n N·m | T_max N·m | n_max rpm |
|---|---|---|---|
| 0.4 | 1.3 | 3.8 | 6 000 |
| 0.75 | 2.4 | 7.2 | 6 000 |
| 1.5 | 4.8 | 14.3 | 5 000 |
| 2.0 | 6.4 | 19 | 5 000 |
| 3.0 | 9.6 | 29 | 4 500 |
| 4.5 | 14.3 | 43 | 4 000 |

### 4.5 Cutting torque and clamp

| Quantity | Formula | Example |
|---|---|---|
| Cutting torque on the table | T_c = Fc · rc | 4 000 N · 0.25 m = **1 000 N·m** |
| Clamp torque needed | T_cl,need = S · T_c | 2 · 1 000 = **2 000 N·m** |
| Check | T_cl ≥ T_cl,need | 3 000 ≥ 2 000 → **OK** |

Status logic in the twin: green if Tcl ≥ S · Tc; yellow if Tcl ≥ Tc only; red otherwise.

### 4.6 Worm wheel tooth load (Bach) – cutting while turning

The simple **Bach** formula gives the allowed tangential force on the wheel teeth:

| Quantity | Formula | Example |
|---|---|---|
| Tangential force on the wheel from cutting | Ft2 = 2 · T_c / d2 | 2 · 1 000 / 0.360 = **5 556 N** |
| Allowed (Bach) | Ft2,allow = c · b2 · px | 6 · 36 · 12.566 = **2 714 N** |
| Check | Ft2 ≤ Ft2,allow | 5 556 > 2 714 → **NOT OK while turning** |
| Allowed cutting force while the table turns | Fc,turn = Ft2,allow · (d2/2) / rc | 2 714 · 180 / 250 = **1 954 N ≈ 1.95 kN** |
| Tooth force from acceleration only | Ft2,acc = 2 · T / d2 | 2 · 181 / 0.360 = 1 008 N (OK) |

**Decision:** rough with the table **clamped** (the clamp takes 3 000 N·m). While the table turns
(simultaneous 4-axis machining) cut only with side force ≤ ≈ 1.95 kN at 250 mm radius. Other option from
the twin: bigger module (m = 5 or more) – then check again.

In the twin this check is **yellow** (not red) because the clamp is strong enough for the cutting
torque.

### 4.7 Main bearing

| Quantity | Formula | Example |
|---|---|---|
| Tilting moment | M_k = Fc · hcut + mw · g · e | 4 000 · 0.45 + 400 · 9.81 · 0.05 = 1 800 + 196 = **2.0 kN·m** |
| Check | M_k ≤ 0.5 · M_k,allow (green), ≤ M_k,allow (yellow) | 2.0 ≤ 12.5 → **OK** |
| Axial load | F_a = (m_pl + mt) · g | (510 + 220) · 9.81 = **7.16 kN** |
| Check | 4 · F_a ≤ C0a (green) | static safety 900 / 7.16 ≈ **126** → OK |

### 4.8 Backlash with the duplex worm

When the worm moves axially by s, the thread thickness in the mesh changes by s · Δp / px.

| Quantity | Formula | Example |
|---|---|---|
| Backlash change per mm shift | Δj = Δp / px | 0.2 / 12.566 = **0.0159 mm per mm** (15.9 µm/mm) |
| Backlash after shift s | **j = j0 − s · Δp / px** | at s = 2.0 mm: 0.050 − 2.0 · 0.0159 = 0.018 mm |
| Shift needed for the target | s = (j0 − jt) / (Δp / px) | (0.050 − 0.008) / 0.0159 = **2.64 mm** |
| Shift where it jams (j = 0) | s0 = j0 / (Δp / px) | 0.050 / 0.0159 = **3.14 mm** – never go there |
| Backlash as angle | φ = j / (d2/2) · 206 265 | 0.008 / 180 · 206 265 = **9.2″** (start 0.050 mm = 57″) |

Check in the twin: green if 0.3 mm < s ≤ 5 mm (the adjustment range). Colour of the bar: green when
0.005 ≤ j ≤ 0.010 mm, red "JAMMED" when j < 0.

**Why the margin matters:** between the target (2.64 mm) and jamming (3.14 mm) there are only 0.5 mm. The
spacer ring must be ground to ±0.002 mm (see cartridge plan).

### 4.9 Positioning accuracy – with and without direct encoder

| Case | Formula | Example |
|---|---|---|
| Eccentricity error, 1 head | e_ecc = e / Rs · 206 265 | 0.005 / 105 · 206 265 = **9.8″** |
| Eccentricity error, 2 opposite heads | cancelled | **0″** |
| Thermal drift | fixed 1″ in the code | 1″ |
| **With direct encoder (2 heads)** | √(enc² + e_ecc² + thermal²) | √(2.5² + 0² + 1²) = **±2.7″** |
| With direct encoder, only 1 head | same | √(2.5² + 9.8² + 1²) = ±10.2″ |
| **Without encoder** (motor encoder only) | Fp + j/2 + thermal | 12 + 9.2/2 + 1 = **±17.6″ ≈ ±18″** |
| At the pallet edge | x = angle / 206 265 · a/2 | with: 2.7″ → **0.0033 mm**; without: 17.6″ → **0.021 mm** |

Check: green if ≤ 5″, yellow if ≤ 8″.

**Why it matters:** 0.021 mm at the pallet edge is too much for bores that must line up from 2 sides of
a compressor crankcase. With the encoder you get about 0.003 mm.

### 4.10 Summary of the 9 checks (example result: 8 OK, 1 warning)

| # | Check | Rule | Example | Result |
|---|---|---|---|---|
| 1 | Servo motor found | T_max ≥ 1.3 · T_m and n_max ≥ n_m | 0.4 kW: 2.83 · 1.3 ≤ 3.8 N·m at 1 800 rpm | OK |
| 2 | Clamp holds the cutting torque | Tcl ≥ S · Tc | 3 000 ≥ 2 000 N·m | OK |
| 3 | Worm tooth load when cutting while turning | Ft2 ≤ c · b2 · px | 5.6 kN > 2.7 kN → rough clamped, ≤ 1 954 N while turning | **Warning** |
| 4 | Bearing tilting moment | ≤ 50 % of allowed | 2.0 of 25 kN·m | OK |
| 5 | Bearing axial load | 4 · Fa ≤ C0a | 7.2 kN, safety ×126 | OK |
| 6 | Self-locking? | info | NO (4.57° > 1.83°) – clamp + brake must hold | info |
| 7 | Sliding speed for bronze | ≤ 6 m/s | 4.73 m/s | OK |
| 8 | Positioning accuracy (with encoder) | ≤ 5″ | ±2.7″ = 0.0033 mm at the edge | OK |
| 9 | Backlash adjustable | 0.3 < s ≤ 5 mm | 2.64 mm | OK |

### 4.11 Item 2 – worm geometry for manufacturing

Inputs from item 1: m = 4, z1 = 1, d1 = 50 mm, z2 = 90, Δp = 0.2 mm.

| Quantity | Formula | Example |
|---|---|---|
| Axial pitch | px = π · m | 12.566 mm |
| Lead | pz = z1 · px | 12.566 mm |
| Lead angle | γ = atan(pz / (π · d1)) | 4.57° |
| Tip diameter | da = d1 + 2m | 58.0 mm |
| Root diameter | df = d1 − 2.4m | 40.4 mm |
| Thread depth | h = 2.2m | 8.8 mm |
| Left flank lead | pL = z1 · (px − Δp/2) | 12.466 mm |
| Right flank lead | pR = z1 · (px + Δp/2) | 12.666 mm |
| Thread length | b1 ≈ (11 + 0.06 · z2) · m + 2 · 5 + px, rounded up to 5 mm | (16.4 · 4 + 10 + 12.57) = 88.2 → **90 mm** |
| Duplex flank shift at the thread ends | ± Δp/2 · (b1/2) / px | 0.1 · 45 / 12.566 = **±0.36 mm** |
| Evaluation length (lead scan) | Lb = b1 − 2m | 82 mm |
| Number of pitches checked | floor(Lb / px) | 6 |

**Important:** the duplex flank shift at the thread ends (±0.36 mm) is **bigger than the grinding stock**
(0.25 mm). So the **roughing must already follow the two leads**. If you rough with one lead, one end has
no stock on one flank.

Shaft layout (from the code; Ø in mm, length in mm):

| Segment | Ø | Length | Tolerance | Ground? |
|---|---|---|---|---|
| Motor journal | 20 | 40 | h6 (−13 / 0 µm) | yes |
| Bearing seat A (fixed side) | 25 | 28 | k5 (+2 / +11 µm) | yes |
| Shoulder | 32 | 12 | – | no |
| Thread (tip) | 58 | 90 | h8 (−46 / 0 µm) on tip Ø | yes |
| Shoulder | 32 | 12 | – | no |
| Bearing seat B (floating side) | 25 | 24 | k5 | yes |
| End thread M20 (stays soft) | 20 | 16 | – | no |
| **Total shaft length** | | **222** | ±0.1 | |

Blank: Ø65 bar (= da + 6, rounded up to 5 mm), saw length 222 + 7 = **229 mm**, blank mass
π/4 · 65² · 229 · 7.85e-6 = **5.97 kg**; finished worm ≈ **1.64 kg**.

### 4.12 Turning

| Quantity | Formula | Example |
|---|---|---|
| Spindle speed | n = 1000 · vc / (π · D) | 1000 · 200 / (π · 65) = **979 rpm** |
| Removal rate | Q = vc · f · ap | 200 · 0.3 · 2 = **120 cm³/min** |
| Chip volume | V = Σ π/4 · (D² − d²) · L (ground Ø + 0.6) | **430 cm³** = 3.4 kg |
| Time | t ≈ V/Q · 1.6 + 1.5 | 430/120 · 1.6 + 1.5 = **7.2 min** |

### 4.13 Case depth (case hardening)

| Quantity | Formula | Example |
|---|---|---|
| Total carbon depth at 925 °C (Harris rule of thumb) | d_tot ≈ 0.635 · √t (t in h, d in mm) | 0.635 · √5 = **1.42 mm** |
| Effective case depth CHD at 550 HV | CHD ≈ 0.7 · d_tot | 0.7 · 1.42 = **0.99 mm** |
| CHD needed before grinding | CHD_need = CHD_finished + stock + 0.05 | 0.6 + 0.25 + 0.05 = **0.90 mm** |
| Check | CHD ≥ CHD_need | 0.99 ≥ 0.90 → OK |
| Fault "carburising 1.5 h" | 0.7 · 0.635 · √1.5 | **0.54 mm** < 0.90 → REJECT |

CHD_finished example 0.6 mm ≈ 0.15 · m. **Why:** grinding removes the stock from the hard case. Order the
case depth **including** the grinding stock, or the finished flank has a thin case.

### 4.14 Thread grinding

| Quantity | Formula | Example |
|---|---|---|
| Rough passes per flank | nR = ⌈(s0 − 2 · ae_f) / ae_r⌉ | ⌈(0.25 − 0.02) / 0.03⌉ = **8** |
| Passes per flank | nR + 2 finish + 1 spark-out | 8 + 2 + 1 = **11** (22 for both flanks) |
| Time per pass | (b1 + 2px) / (pz · n) | (90 + 25.1) / (12.566 · 30) = **0.31 min** |
| Grinding time | passes · t_pass + dressings · 0.6 + 2.5 | 22 · 0.31 + 4 · 0.6 + 2.5 = **11.6 min** |
| Work speed | vw = π · d1 · n / 60 | π · 50 · 30 / 60 = **78.5 mm/s** |
| Specific removal rate | **Q'w = ae · vw** | 0.03 · 78.5 = **2.36 mm³/(mm·s)** |
| Burn check | Q'w / Q'w,limit | 2.36 / 4 = **59 %** (green ≤ 70 %, yellow ≤ 100 %, red > 100 %) |
| Thermal lead error | **Δ = −α · ΔT · L** | −11.5e-6 · 0.5 K · 82 mm = **−0.47 µm** (chilled coolant ±0.5 K) |
| Same with coolant not cooled | | −11.5e-6 · 6 K · 82 mm = **−5.7 µm** → out of ±4 µm |
| Wheel wear between dressings | 0.25 µm per pass · passes between dressings | 0.25 · 6 = **1.5 µm** (dress every 40 passes → 10 µm) |
| Stock needed to clean up | (runout/2) · sin 20° + ε · (b1/2) · cos 20° + pitch error · cos 20° + 0.01 | ≈ 0.003 + 0.008 + 0.008 + 0.01 ≈ **0.03 mm** (typical, random per worm) |

ε = lead growth from carburising (example ≈ 180 µm/m). Rule: 1 K warmer worm while grinding gives about
1 µm shorter lead over 90 mm. That is why the coolant is chilled.

### 4.15 Over-wire (3-wire) measurement

| Quantity | Formula | Example |
|---|---|---|
| Best wire diameter | **dw = px / (2 · cos 20°)** | 12.566 / (2 · 0.9397) = **6.686 mm** |
| Over-wire size, finished | **M0 = d1 − px / (2 · tan 20°) + dw · (1 + 1/sin 20°)** | 50 − 17.263 + 6.686 · 3.924 = **58.973 mm** |
| Over-wire size, soft (with stock) | **M = M0 + 2 · s0 / sin 20°** | 58.973 + 2 · 0.25 / 0.342 = **60.435 mm** |
| Duplex: M grows along the worm | **dM/dx = Δp / (px · tan 20°)** | 0.2 / (12.566 · 0.364) = **43.7 µm per mm** |

The M0 formula is an **axial-section approximation**. For the real worm profile (ZI, ZK, ZN …) use the
exact formula from the gear measuring machine software or the drawing.

Tolerance in the twin: soft M ±0.08 mm, finished M (middle) ±25 µm, measured M slope within 10 % of
43.7 µm/mm. M is measured at 4 places: −1.5 px, −0.5 px, +0.5 px, +1.5 px from the middle.

### 4.16 Test bench

| Quantity | Formula | Example |
|---|---|---|
| Backlash change per mm shift | Δp / px | **15.9 µm per mm** |
| Shift for target backlash | from the fitted line of 6 measurements (0…5 mm) | ≈ 2.6 mm (random) |
| Transmission error amplitude from runout | (Fr/2) · tan 20° / (d2/2) · 206 265 | Fr = 2.4 µm → ≈ 0.5″ |
| Run-in output power | P_out = T · 2π · n / 60 | 300 · 2π · 10 / 60 = **314 W** |
| Loss power | P_loss = P_out · (1/η − 1) | 314 · (1/0.713 − 1) = **126 W** |
| Temperature rise at the end | ΔT_end ≈ P_loss / (h·A) | 126 / 12 = **≈ 10.5 K** (time constant 12.5 min); limit 15 K |

During run-in the friction is higher at the start (factor 1 + 0.6 · e^(−t/30 min)) and drops, so the
efficiency rises during the 2 hours.

**Correction for the real bench:** the twin "measures" up to 5 mm shift. With the example values the
backlash becomes zero at s0 = 3.14 mm, so the points above ≈ 3 mm are only an extrapolation of the line
(jammed in reality). On the real bench measure only from 0 mm up to about s0 − 0.5 mm (for example
0 / 0.5 / 1.0 / 1.5 / 2.0 / 2.5 mm) and fit the line through these points (example in 14.11).

---

## 5. Manufacturing, assembly and inspection – step by step

### Part 1 – Rotary table

#### 5.1 Workshop rules (from the twin guide)

1. **Rough → stress relief → finish.** Castings and welded parts move after rough machining. Never finish
   before stress relief.
2. **One set-up for everything that must fit together** (bearing seat + worm bores, all table seats).
   Re-clamping costs 0.01–0.02 mm.
3. **Measure at 20 °C.** 1 K on Ø300 steel = 3.5 µm. Let parts rest 12 h in the measuring room before
   the CMM.
4. **Clean assembly room.** Parts washed. Bearings opened only at the bench. No compressed air on
   bearings.
5. **Worm + wheel = matched pair.** Store and replace them together.

#### 5.2 Process plan – Housing

Material: EN-GJL-300 casting (or welded S355 + stress relief).

| Op | Machine | Operation | Tolerance / check |
|---|---|---|---|
| 10 | Foundry / QC | Casting check: porosity (X-ray at the bearing seat), hardness 180–220 HB (example; for EN-GJL-300 the hardness depends on the wall thickness – agree the range with the foundry, typically about 190–240 HB, see 11.5), marking | no pores at seats |
| 20 | Floor-type boring mill / HMC | Rough mill all faces, rough bore all bores (2–3 mm allowance) | allowance even |
| 30 | Furnace | Stress relief annealing 550 °C, 4–6 h, slow cooling (or vibratory stress relief) | protocol |
| 40 | HMC | Semi-finish faces + bores (0.3 mm allowance) | |
| 50 | Surface grinder | Grind the base face = reference A | flatness 0.005 mm |
| 60 | Jig borer / precision HMC at 20 °C ±1 | ONE set-up: bearing seat Ø300 H6 + seat face, worm bores H6 at centre distance a = 205.0 ±0.01, clamp ring seat | seat face ⟂ axis 0.003 · worm axis ⟂ B-axis 0.01/100 · worm height to wheel mid-plane ±0.02 |
| 70 | HMC | Drill + tap, oil channels, sight glass, drain | |
| 80 | Washing + CMM | Deburr, wash, CMM report of all functional sizes | report = assembly approval |
| 90 | Paint shop | Oil-resistant primer inside, paint outside (mask the fits) | |

Why Op 60 matters: the centre distance a and the angle between worm and B-axis decide the mesh. If they
are wrong, no shim can correct it.

#### 5.3 Process plan – Table top + hub sleeve

Material: EN-GJS-600 / C45 quenched + tempered.

| Op | Machine | Operation | Tolerance / check |
|---|---|---|---|
| 10 | QC / saw | Blank / casting check | |
| 20 | Vertical lathe | Rough turn both sides, 2 mm allowance | |
| 30 | Furnace | Stress relief | |
| 40 | Vertical lathe | Finish turn in ONE set-up: bearing face, hub sleeve spigot, wheel spigot, clamp disc face, scale seat | runout 0.005 between all seats |
| 50 | Jig borer / HMC | 4 zero-point bores at pitch 400 mm (±0.01), threads, channels to the rotary union (deep drill + plugs) | position ±0.01 |
| 60 | Test bench | Pressure test all channels 1.5 × p | no leak |
| 70 | AFTER assembly | Grind the top + module faces in the table's own bearing | flatness 0.005 · parallel 0.01 |

#### 5.4 Process plan – Worm wheel

Material: rim CuSn12Ni2-C-GZ (centrifugal cast bronze) on C45 hub.

| Op | Machine | Operation | Tolerance / check |
|---|---|---|---|
| 10 | Lathe | Turn hub and rim blank; fit: shrink the rim on the hub (or bolts + dowels) | |
| 20 | Lathe | Finish turn the blank: tip diameter, faces, bore / spigot | runout 0.005 to the bore |
| 30 | Gear hobbing machine | Hob 90 teeth, module 4, with a DUPLEX hob (or a fly cutter for 1–2 pieces), hob at centre distance a = 205.0 | DIN 3974 class 5 (example) |
| 40 | Gear measuring machine | Pitch, cumulative pitch, runout, flank form | Fp ≤ 12″ |
| 50 | Mesh test | Roll with the master worm, marking paste – contact pattern | ≥ 60 % centred |
| 60 | Marking | Mark as a MATCHED PAIR with its worm (worm + wheel are never exchanged alone) | serial no. |

The hob must have the **same leads and profile** as the duplex worm. Otherwise the contact pattern is
wrong along the worm.

#### 5.5 Process plan – Duplex worm (short version; full version in Part 2)

Material: 16MnCr5 / 20MnCr5 case-hardening steel.

| Op | Machine | Operation | Tolerance / check |
|---|---|---|---|
| 10–20 | Saw + lathe | Saw, face, centre drill DIN 332 form B | length ±0.1 |
| 30–40 | CNC lathe / whirling | Rough turn (+0.6 on ground Ø), rough the thread flank by flank with the 2 duplex leads, 0.25 mm stock per flank | wire check M_soft |
| 50 | Furnace | Case harden (CHD incl. grinding stock), 58–62 HRC, temper, straighten | coupon: hardness + CHD |
| 60–70 | Centre-hole + cylindrical grinder | Re-grind centre holes, grind journal + bearing seats k5 + thread tip | runout 0.003 |
| 80 | Worm grinding machine | Grind the thread: left flank lead and right flank lead differ by Δp = 0.2 mm (duplex) | Q'w below burn limit |
| 90 | Etch line | Nital etch – grinding burn check (100 %) | no dark areas |
| 100–110 | Gear measuring machine + test bench | Lead L + R, profile, runout, pitch, over-wire M; transmission error, backlash vs shift, run-in | see Part 2 |
| 120 | Finishing | Demagnetise, mark the pair, part record | |

#### 5.6 Process plan – Clamp ring + disc

Material: 42CrMo4 quenched + tempered (thin-wall ring), disc C45.

| Op | Machine | Operation | Tolerance / check |
|---|---|---|---|
| 10 | Lathe | Rough turn | |
| 20 | Furnace | Quench + temper 900–1100 N/mm² | |
| 30 | Lathe / grinder | Finish turn the thin wall (wall thickness ±0.02), grind the clamp faces | parallel 0.005 |
| 40 | Test bench | Pressure test 1.5 × p, holding torque test | ≥ 3 000 N·m |

Why the wall thickness tolerance: the thin wall bends under oil pressure. Uneven wall = uneven clamping
force = the table moves when it clamps.

#### 5.7 Process plan – Worm bearing cartridges + spacer ring

Material: C45 / 42CrMo4.

| Op | Machine | Operation | Tolerance / check |
|---|---|---|---|
| 10 | Lathe | Turn the cartridges, bearing seats H5/J5 | coaxial 0.005 |
| 20 | Surface grinder | Spacer ring: grind to the size found at assembly (backlash setting) | ±0.002 |

#### 5.8 Assembly + measuring steps (the 14 steps of the animation)

Measure with dial gauges (0.001 mm) unless written otherwise. Write every value into the assembly
record.

| # | Step | Check (example limit) | Why |
|---|---|---|---|
| 1 | Clean the housing, check the CMM report, set it on 3 points on the assembly plate and level it (0.02 mm/m) | base face flatness 0.005 mm · bores as per CMM report | 3 points do not twist the housing |
| 2 | Fit the main axial-radial bearing on the seat ring. Tighten the screws crosswise in 3 stages (30 / 70 / 100 % torque) | axial runout of the bearing face ≤ 0.003 mm | Uneven screw torque bends the thin bearing rings |
| 3 | Lower the table with its hub sleeve through the bearing and bolt it to the inner ring (crosswise, torque wrench) | table top: radial + axial runout ≤ 0.005 mm (turn by hand) | |
| 4 | From below: bolt the worm wheel to the hub sleeve with 2 dowels. Shim so the wheel mid-plane is on the worm axis | wheel runout radial + axial ≤ 0.01 mm · mid-plane ±0.02 mm | Wheel runout = position error and changing backlash |
| 5 | Insert the worm cartridge from the side: preloaded angular contact pair on the motor side (fixed), needle bearing on the other side (floating) | worm axial play 0 · bearing friction torque as specified | Axial play of the worm = backlash at the table |
| 6 | **Contact pattern:** paint the worm with marking paste, turn both directions, look at the pattern on the wheel. Move the wheel axially (shims) until the pattern is in the middle, ≥ 60 % of the flank | pattern centred, slightly towards the mesh exit side (oil can enter) | Wrong pattern = edge load, heat, wear |
| 7 | **Backlash:** shift the DUPLEX worm axially (grind the spacer ring to size) until the backlash is 0.005–0.010 mm at the wheel pitch circle | dial gauge on the table edge, worm locked, turn the table + / − | See 5.8.1 |
| 8 | Fit the hydraulic clamp ring and the clamp disc. Pressure test 1.5 × p. Holding torque test with a lever + load cell | no leak · holding torque ≥ required · table does not move when clamping (≤ 1″) | Movement while clamping = position error |
| 9 | Fit the angle encoder scale on the sleeve and centre it (dial gauge). Fit the 2 read heads exactly opposite – they cancel the eccentricity | scale runout ≤ 0.005 mm · signal amplitude OK on both heads | |
| 10 | Fit the rotary union (hydraulics for the pallet clamping, air for the seat check). Pressure + leak test | leak ≤ catalogue value at 1.5 × p, turning torque small | |
| 11 | Labyrinth cover, seals, sealing air. Fill the worm oil to the sight glass | oil level, sealing air 0.5 bar | |
| 12 | Fit the 4 zero-point modules into the table bores and connect the channels | release / clamp function, pressure test | |
| 13 | **Final:** grind / fine-machine the table top and the module faces IN THE TABLE'S OWN BEARING (the table turns while it is machined) | flatness 0.005 mm · parallel to the base 0.01 mm · module faces same height ±0.003 | All errors of bearing and assembly are removed from the top surface |
| 14 | Servo connected and tuned, 2 h run-in at changing speed, then measure positioning (ISO 230-2), clamp, temperature, seat check with a test pallet | accuracy + repeatability per spec · temperature rise ≤ 15 K · no noise | |

##### 5.8.1 How to set the backlash with the duplex worm (detail of step 7)

1. Fit the worm cartridge with a **thin trial spacer** (worm at its "loose" end, shift s = 0).
2. Lock the worm (motor brake or a clamp on the worm shaft).
3. Put a dial gauge on the **table edge**, tangential. Turn the table by hand + and −. Read the total
   movement x at the gauge radius r_g.
4. Convert to the wheel pitch circle: j = x · (d2/2) / r_g. Example: table edge r_g = 290 mm,
   x = 0.081 mm → j = 0.081 · 180 / 290 = 0.050 mm.
5. Calculate the shift: s = (j_measured − 0.008) / (Δp / px) = (0.050 − 0.008) / 0.0159 = 2.64 mm.
6. Make the spacer ring 2.64 mm thicker (or thinner – depending on which side the spacer sits; check
   the drawing direction of the thread growth). Grind it to ±0.002 mm.
7. Re-assemble, measure again at **3–4 table positions** (the wheel has runout). Take the **smallest**
   backlash. It must be ≥ 0.005 mm everywhere, never zero.
8. Turn the table one full turn slowly by hand: no tight spot.
9. Write the spacer size and the backlash values into the record. You need them for the yearly re-set.

Warning: from 2.64 mm to jamming (3.14 mm) is only 0.5 mm of shift. Jamming = very high friction, heat
and damage of the bronze.

#### 5.9 Acceptance tests (example limits – check ISO 230-2 and ISO 10791-4 for positioning, ISO 10791-1 for geometry)

| Test | How | Limit (example) |
|---|---|---|
| Positioning accuracy B | Autocollimator + 12/24-face polygon, or laser + rotary calibrator, 5 runs both directions | A ≤ 5″ |
| Repeatability | Same measurement | R ≤ 2″ |
| Reversal (backlash) | Approach each point from + and − | ≤ 2″ with encoder |
| Table top | Flatness (precision level / dial gauge), axial + radial runout | 0.005 / 0.005 / 0.005 mm |
| Clamp | Torque with lever + load cell, angle change during clamping | ≥ 3 000 N·m, ≤ 1″ |
| Thermal + noise | 2 h at 50 % speed, then 30 min at max | ΔT ≤ 15 K, no noise peaks |

The limit for A is max(5″, accuracy budget rounded up) = 5″ with the example values.

#### 5.10 Bill of materials

| Part | Make / buy | Qty | Specification (example) | Note |
|---|---|---|---|---|
| Housing | MAKE | 1 | EN-GJL-300, process plan 5.2 | |
| Table top + hub sleeve | MAKE | 1 | Ø580 mm | |
| Worm wheel (bronze rim + hub) | MAKE | 1 | z 90, m 4, b 36 mm | or BUY as a set from a worm gear maker |
| Duplex worm | MAKE | 1 | d1 50, Δp 0.2 | matched pair with the wheel |
| Worm bearing cartridges + spacer ring | MAKE | 2 | | spacer ground at assembly |
| Angular contact bearing pair (preloaded) | BUY | 1 | worm fixed side, back-to-back | |
| Needle / cylindrical roller bearing | BUY | 1 | worm floating side | |
| Axial-radial roller bearing | BUY | 1 | bore 200, M_k allowed 25 kN·m | check catalogue |
| Hydraulic clamp ring + disc | MAKE / BUY | 1 | 3 000 N·m | |
| Angle encoder + 2 read heads | BUY | 1 | ±2.5″, hollow shaft | |
| Servo motor with brake + bellows coupling | BUY | 1 | 0.4 kW, 1 800 rpm (from the twin – see 4.4 warning) | |
| Rotary union (hydraulic + air) | BUY | 1 | 4–6 passages | |
| Zero-point modules | BUY | 4 | Pallet changer tab | |
| Labyrinth cover, seals, sight glass, oil | MAKE / BUY | 1 | gear oil ISO VG 220–460 | |

#### 5.11 Maintenance

| When | What |
|---|---|
| Weekly | Check the worm oil level (sight glass) |
| After 500 h | First oil change (running-in wear particles) |
| Every 4 000 h | Oil change |
| Every year | Measure the backlash. Re-set with the duplex worm when > 0.015 mm |
| After a crash | Runout + positioning test before production |

---

### Part 2 – Worm manufacturing (process twin)

#### 5.12 Process inputs of item 2 (example values)

| Group | Input | Example |
|---|---|---|
| Order + turning | Lot size | 20 pcs (set-up time is shared) |
| | Turning cutting speed vc | 200 m/min (coated carbide) |
| | Turning feed f | 0.3 mm/rev |
| | Turning depth of cut ap | 2 mm |
| | Grinding stock per flank s0 | 0.25 mm (0.2–0.3 after hardening) |
| Heat treatment | Carburising time at 925 °C | 5 h (boost + diffuse) |
| | Worms per furnace charge | 100 |
| | Min. case depth on the finished worm | 0.6 mm (≈ 0.15 · m) |
| Thread grinding | Rough infeed per pass ae_r | 0.03 mm (normal to the flank) |
| | Finish infeed per pass ae_f | 0.01 mm (2 passes + 1 spark-out) |
| | Worm speed while grinding | 30 rpm |
| | Dress the wheel every … passes | 6 |
| | Coolant temperature drift | 0.5 K (oil chiller ±0.5 K) |
| | Burn limit Q'w (from grinding trials) | 4 mm³/(mm·s) |
| Tolerances (≈ DIN 3974 class 5, example) | Lead slope fHβ each flank | ±4 µm |
| | Profile total Fα | 5 µm |
| | Runout Fr of the thread | 6 µm |
| | Single axial pitch fpx | ±3 µm |
| | Bearing seat runout | 3 µm |
| | Over-wire size M (middle) | ±25 µm |
| | Single-flank error f'i (bench) | 3″ |
| Test bench | Test torque at the wheel | 300 N·m |
| | Wheel speed during run-in | 10 rpm |
| | Heat transfer of the test gearbox h·A | 12 W/K |
| | Axial adjustment range of the worm | 5 mm |
| Cost (example rates only) | Bar material, saw, lathe, furnace, grinder, worm grinder, measuring room, test bench | 2.5 $/kg; 30 / 50 / 80 / 70 / 120 / 90 / 40 $/h |

#### 5.13 The 12 operations

Each table gives: the work steps (as in the animation), the settings and the checks the twin makes.

##### Op 10 – Saw (band saw)

Steps:
1. Take a Ø65 bar of 16MnCr5 (1.7131) from the store. Check the 3.1 material certificate.
2. Clamp in the vise, cut to length (bimetal blade).
3. Stamp the heat number. From now on every value goes into the part record.

| Setting | Value |
|---|---|
| Cut length | 229 ±1 mm |
| Blank mass | 5.97 kg (finished 1.64 kg) |
| Cutting rate | ≈ 25 cm²/min → 33 cm² cut → ≈ 2.1 min |

Checks: length within ±1 mm; heat number stamped.

##### Op 20 – Face + centre (CNC lathe / centring machine)

Steps:
1. Clamp in the chuck, support with a steady rest.
2. Face the end to length.
3. Drill the centre hole **DIN 332 form B** (60° cone + 120° protecting chamfer).
4. Turn the part around, face and centre the other end.
5. Check length + centre cone contact (blue paint).

| Setting | Value |
|---|---|
| Face to length | 222 ±0.1 mm (≈ 3.5 mm per end) |
| Centre holes | DIN 332 form B 3.15/10 (twin picks B 2.5/8 for journal < 16, B 3.15/10 for < 26, else B 4/12.5) |
| Clamping | 3-jaw chuck + steady rest |

Checks: length ±0.1 mm; centre cone contact ≥ 80 %.

Why form B: the 120° protecting chamfer keeps the 60° cone safe from dents. The centre holes are the
**reference of the worm from Op 30 to Op 100**.

##### Op 30 – Rough turn (CNC lathe, between centres)

Steps:
1. Clamp between centres, drive dog on the journal.
2. Rough turn all diameters in passes (contour cycle).
3. Ground diameters keep **+0.6 mm**; the others are finished now.
4. Chamfers, undercuts, end thread M20 (stays soft).

| Setting | Value |
|---|---|
| Cutting data | vc 200 m/min · f 0.3 mm · ap 2 mm |
| Spindle speed | 979 rpm at Ø65 |
| Removal rate | 120 cm³/min |
| Chips | 430 cm³ = 3.4 kg |
| Time | ≈ 7.2 min |

Checks: seat Ø before grinding 25.6 ±0.05 mm; thread tip Ø before grinding 58.6 ±0.05 mm.

##### Op 40 – Rough thread (3 methods)

| Method | Machine | How | Twin time (example) |
|---|---|---|---|
| Thread whirling | CNC lathe with whirling unit | Whirling ring with 4–6 form inserts, 1 500–3 000 rpm, tilted by γ; the worm turns slowly (5 rpm), 2 passes | ≈ 5.2 min |
| Single-point threading | CNC lathe (G76 / G33) | One form tool, many passes with alternating flank infeed – simple, but slow. Worm ≈ 494 rpm (90 m/min on Ø58), passes = ⌈8.8/0.3⌉ + 8 = 38 | ≈ 6.5 min |
| Disc-cutter milling | Thread milling machine | Disc cutter tilted by γ, 1 pass per flank – series production (worm 2 rpm) | ≈ 11.2 min |

Steps:
1. Use the chosen method (above).
2. Cut **flank by flank**: L flank with lead **12.466 mm**, R flank with lead **12.666 mm** (duplex).
3. Leave the grinding stock 0.25 mm per flank; root cut to the final Ø40.4.
4. Check over 3 wires: M_soft = M0 + 2 · s0 / sin 20° (±0.08 mm).
5. Deburr, wash, copper paste on the soft end thread + centre holes (masking for carburising).

| Setting | Value |
|---|---|
| Duplex shift at thread ends | ±0.36 mm > stock → roughing must follow both leads |
| Tool side clearance | ≥ γ + 3° = 7.6° |

Checks: over-wire size soft M = 60.435 ±0.08 mm; flank stock L and R each ≥ 0.15 mm.

Why the wire check here: a stock error found at Op 40 costs 5 minutes. Found after hardening, it costs
the worm.

##### Op 50 – Case harden (sealed-quench furnace + tempering furnace)

Steps:
1. Hang the worms on a fixture (they bend less hanging).
2. Heat to 925 °C and carburise: carbon diffuses into the surface.
3. Cool to 840 °C, quench in oil → hard martensite case, tough core.
4. Wash, temper 180 °C / 2 h (less brittle, stable size).
5. Check runout, straighten carefully if > 0.04 mm, crack test.

| Setting | Value |
|---|---|
| Carburise | 925 °C, 5 h, carbon potential 1.1 → 0.8 % |
| Harden | 840 °C → oil quench 60 °C |
| Temper | 180 °C, 2 h |
| Cycle | t + 6.5 h = 11.5 h per charge of 100 worms (≈ 6.9 min per worm) |
| Masking | copper paste on the soft end thread |

Checks:

| Check | Limit |
|---|---|
| Surface hardness | 58–62 HRC |
| Core hardness | 30–42 HRC (warning outside) |
| Runout after quench | ≤ 0.15 mm (else reject) |
| Straightening | if > 0.04 mm → after straightening ≤ 0.03 mm |
| Crack test (magnetic particle) | no indication |
| Size change from carburising | lead grows ≈ +180 µm/m (info – ground off later) |

##### Op 60 – Test + centres (shot blast · hardness tester · centre-hole grinder)

Steps:
1. Shot blast: remove scale and copper paste.
2. Hardness: HRC on the end face, HV1 traverse on the **coupon** → case depth CHD.
3. **Grind the centre holes again** – heat treatment distorts them.

| Setting | Value |
|---|---|
| Coupon | same steel, same charge, cut + polished, HV1 traverse |
| Centre holes | re-ground 60° (planetary centre-hole grinder) |

Checks: CHD at 550 HV1 (coupon) ≥ 0.90 mm (= 0.6 + 0.25 + 0.05); centre cone contact ≥ 80 %.

Why a coupon: you cannot cut the real worm to check the case depth.

##### Op 70 – Cylindrical grinding (CNC cylindrical grinder)

Steps:
1. Clamp between the re-ground centres.
2. Plunge grind the journal and the 2 bearing seats (in-process gauge).
3. Traverse grind the thread tip diameter.
4. Check seat Ø, roundness, runout to the common axis A–B.

| Setting | Value |
|---|---|
| Wheel | A80 K vitrified Ø500, vs 35 m/s |
| Work speed | 20 m/min, coolant 2 % emulsion |
| Stock | 0.6 mm on Ø: rough 0.6 mm/min, finish 0.1 mm/min, spark-out |
| Gauge | in-process 2-point gauge |

Checks:

| Diameter | Tolerance |
|---|---|
| Journal Ø20 h6 | −13 / 0 µm |
| Seat A Ø25 k5 | +2 / +11 µm |
| Thread tip Ø58 h8 | −46 / 0 µm |
| Seat B Ø25 k5 | +2 / +11 µm |
| Seat runout to axis A–B | ≤ 3 µm |

##### Op 80 – Thread grinding (CNC worm grinding machine)

Steps:
1. Mount between centres; a probe finds the pre-cut thread and aligns the wheel to the gap ("mesh in").
2. Dress the wheel profile with the diamond roll.
3. Grind the L flank with lead 12.466 mm, dress every 6 passes.
4. Grind the R flank with lead 12.666 mm.
5. Finish passes + spark-out; coolant temperature kept constant.

| Setting | Value |
|---|---|
| Wheel | single-rib disc wheel, profile dressed by a diamond roll |
| Wheel tilt | lead angle γ = 4.57° |
| Leads | L 12.466 · R 12.666 mm (Δp 0.200) |
| Worm speed | 30 rpm → 377 mm/min along the axis |
| Passes per flank | 8 × 0.03 + 2 × 0.01 + 1 spark-out |
| Q'w = ae · vw | 0.03 · 78.5 = 2.36 mm³/(mm·s) |

Checks:

| Check | Limit | Note |
|---|---|---|
| Flanks cleaned up | stock ≥ stock needed (≈ 0.03 mm) on both flanks | else black spots |
| Burn risk Q'w / limit (spindle power monitor) | ≤ 70 % OK, ≤ 100 % warning | example 59 % |
| Worm temperature drift | info | 0.5 K → −0.47 µm lead error – **not seen at the machine** |
| Wheel wear between dressings | info | 1.5 µm – **not seen at the machine** |

Why "not seen at the machine": thermal lead error and wheel wear are only found later at Op 100 / 110.
Prevent them with the process (chilled coolant, dressing interval).

##### Op 90 – Burn test (nital etch line, ISO 14104)

Steps:
1. Degrease.
2. Etch in nital (3 % nitric acid in alcohol), 20–30 s: burnt areas turn dark.
3. Rinse, bleach (HCl 4–6 %), neutralise, dry.
4. Look at every flank under bright light: uniform grey = OK.

Checks: etch picture uniform grey; if dark patches → hardness check in the dark areas (burnt area about
53 HRC = soft → reject). **100 % of the worms**, because burn is invisible.

Safety: nitric acid and alcohol – use the etch line with extraction, gloves, goggles, and follow your
chemical safety rules.

##### Op 100 – Inspection (gear measuring machine · 3 wires · roughness)

Steps:
1. Let the worm rest 2 h at 20 °C in the measuring room.
2. Lead scan on both flanks (probe ball moves along the flank).
3. Profile scan on both flanks.
4. Runout: ball in the gap at 12 angles.
5. Axial pitch; over-wire size M at 4 places (duplex: M grows along the worm).
6. Roughness Ra on the flanks.

| Setting | Value |
|---|---|
| Machine | CNC gear measuring machine, 2 µm ball probe |
| Evaluation length | lead 82 mm · profile ≈ 6.4 mm (h − 0.6 m) |
| Wire Ø | best wire 6.686 mm |
| Room | 20 °C ±1, part soaked 2 h |

Checks:

| Characteristic | Limit (example) |
|---|---|
| Lead slope fHβ L flank | ±4 µm |
| Lead slope fHβ R flank | ±4 µm |
| Lead form ffβ L / R | ≤ 0.75 · 4 = 3 µm (warning) |
| Profile Fα L / R | ≤ 5 µm |
| Runout Fr | ≤ 6 µm |
| Single pitch fpx (max) | ±3 µm |
| Over-wire M (middle) | 58.973 ±0.025 mm |
| Duplex: M growth along the worm | 43.7 µm/mm ±10 % |
| Roughness Ra flanks | ≤ 0.4 µm |

How to read the lead chart: a sloped line = lead error (fHβ). If **both** flanks slope the same way →
thermal error or machine lead error. If L and R slope **opposite** → wrong duplex Δp.

##### Op 110 – Test bench (worm gear test bench + master wheel)

Steps:
1. Mount the worm in the test gearbox with the master wheel at centre distance a = 205.0 mm.
2. Single-flank rolling test: 2 encoders → transmission error.
3. Shift the worm axially, measure the backlash at 6 positions (0, 1, 2, 3, 4, 5 mm).
4. Marking paste: contact pattern.
5. Run-in 2 h under load: temperature, efficiency, noise.

| Setting | Value |
|---|---|
| Master wheel | z 90, class 4, a = 205.0 mm |
| Encoders | worm side + wheel side, 36 000 lines |
| Run-in | 300 N·m at 10 rpm = 314 W output, 2 h |

Checks:

| Check | Limit (example) |
|---|---|
| Single-flank error f'i (per worm turn) | ≤ 3″ |
| Total transmission error F'i (1 wheel turn) | ≤ 6″ |
| Backlash change per mm shift | 15.9 µm/mm ±10 % |
| Shift for the target backlash | inside 0.3 … 5 mm |
| Contact pattern L / R flank | off centre ≤ 15 % OK, ≤ 25 % warning |
| Temperature rise after 2 h | ≤ 15 K |
| Efficiency after run-in | info (≈ 71 %) |
| Noise at 1 m | ≤ 68 dB(A) |

##### Op 120 – Finish (demagnetiser · laser marker · packing)

Steps:
1. Demagnetise (residual field ≤ 0.3 mT).
2. Laser mark serial no. + matched-pair no. (twin example: W-0001 / pair P-0001; in the real factory use
   the project scheme, e.g. WRM-2546-00017 / P-2546-00004, see chapter 12).
3. Rust protection oil, VCI bag, box.
4. Close the part record ("birth certificate") – it goes with the worm.

Why demagnetise: magnetic worms collect grinding dust and iron particles → wear in the gearbox.

#### 5.14 The part record (JSON download)

Button **Download part record** saves `W-xxxx_part_record.json`. Content:

| Field | Content |
|---|---|
| `worm` | serial no., e.g. `W-0001` |
| `heat` | heat number of the bar |
| `geometry` | m, z1, d1, dp, b1, L |
| `faults` | list of the faults that were switched on |
| `operations[]` | for each Op: `op`, `name`, `machine`, `setup_min`, `time_min`, `cost`, `settings` (all settings of the Op), `checks[]` (`check`, `value`, `result` = ok / warn / bad / info) |
| `verdict` | `RELEASED` or `REJECT` |
| `note` | "simulated example values" |

In the real factory: use the same structure in the MES. Each machine writes its values against the
serial number. This is the traceability record (see guide 04).

#### 5.15 The 7 process faults

Switch them on with the fault buttons (or `wmf=` in the URL). Then play the route.

| Fault (twin button) | Key | Where it starts | Effect in the twin | Which check finds it | Prevention |
|---|---|---|---|---|---|
| Thread roughed almost to size (stock 0.03 mm) | `stock` | Op 40 | Soft M ≈ 1.3 mm too small; flank stock < 0.15 mm; at Op 80 the flanks do not clean up → black (unground) spots | Wire check at Op 40; else Op 80 (clean-up) / Op 90 (etch picture) | Stock 0.2–0.3 mm, check M_soft, straighten, hang in the furnace |
| Carburising time too short (1.5 h) | `hard` | Op 50 | CHD ≈ 0.54 mm < 0.90 mm needed | Coupon test at Op 60 | Furnace record, coupon in every charge, CHD ordered incl. stock |
| Centre holes not re-ground after hardening | `centre` | Op 60 | Centre cone contact ≈ 40 %; seat runout ≈ +5 µm (> 3 µm); thread runout Fr ≈ +6 µm (> 6 µm); higher transmission error | Op 70 seat runout, Op 100 Fr, Op 110 f'i | Grind centre holes after hardening; clean + oil the centres |
| Grinding burn (coolant nozzle blocked) | `burn` | Op 80 | Burn limit effectively 40 % → Q'w ratio ≈ 147 %; tempered zone ≈ 53 HRC; more friction and noise on the bench | Power monitor at Op 80; **nital etch at Op 90 (100 %)** | Q'w limit from trials, power monitor, coolant nozzle check |
| Coolant not cooled (+6 K drift) | `thermal` | Op 80 | Lead error −11.5e-6 · 6 · 82 = −5.7 µm on **both** flanks | Lead check at Op 100 | Chilled coolant ±0.5 K, warm-up cycle, lead compensation |
| Wheel dressed too rarely (every 40 passes) | `dress` | Op 80 | Wheel wear 10 µm → profile roll-off at root and tip, Fα > 5 µm; smaller, shifted contact pattern; more friction | Profile at Op 100 + bench (f'i, contact pattern) | Dress every 4–8 passes, check the dresser |
| Wrong duplex lead in the CNC program (Δp / 2) | `duplex` | Op 80 | L and R leads wrong in **opposite** directions; M slope only half; backlash slope half (8 µm/mm) → shift needed ≈ 5.3 mm > 5 mm range | Lead L/R + M slope at Op 100; backlash slope at Op 110 | First-article inspection, program release by quality |

**Lesson:** the later a fault is found, the more expensive it is – all work in between is lost. Three
faults (thermal, dress, duplex) are **not visible at the machine** where they start.

#### 5.16 Lot simulation and Cpk

Button **Run 50 worms**: 50 worms with the same process (and the switched-on faults), each with its own
random values.

Cpk formula (from the code):

- mean m, standard deviation σ (sample, N − 1)
- Cpk = min( (USL − m) / (3σ), (m − LSL) / (3σ) ); one-sided if only one limit
- Cpk ≥ 1.33 = capable (green), 1.00–1.33 = warning, < 1.00 = not capable

| Characteristic in the lot table | Limits (example) |
|---|---|
| Soft over-wire M deviation | −80 … +80 µm |
| Seat A Ø25 k5 | +2 … +11 µm |
| Seat runout | ≤ 3 µm |
| Case depth CHD | 0.90 … 1.25 mm (need … need + 0.35) |
| Lead fHβ L flank | ±4 µm |
| Lead fHβ R flank | ±4 µm |
| Profile Fα L | ≤ 5 µm |
| Runout Fr | ≤ 6 µm |
| Over-wire M deviation | ±25 µm |
| f'i bench | ≤ 3″ |
| Temperature rise | ≤ 15 K |

The last line shows the **yield**: how many of 50 worms pass every check.

Use in reality: after the first 20–50 real worms, put the measured values in the same table. Work on the
characteristic with the lowest Cpk first.

#### 5.17 Time and cost route (example, lot 20, whirling)

Cost per worm = (set-up / lot + time per worm) / 60 · hourly rate. **Rates are examples, not real
prices.**

| Op | Operation | Set-up min | min / worm (example) |
|---|---|---|---|
| 10 | Saw | 10 | 2.1 |
| 20 | Face + centre | 20 | 4.5 |
| 30 | Rough turn | 30 | 7.2 |
| 40 | Rough thread (whirling) | 45 | 5.2 |
| 50 | Case harden (per charge of 100) | 0 | 6.9 |
| 60 | Test + centres | 10 | 6.0 |
| 70 | Cylindrical grind | 25 | 5.9 |
| 80 | Thread grind | 60 | 11.6 |
| 90 | Burn test | 10 | 6.0 |
| 100 | Inspection | 15 | 35 |
| 110 | Test bench | 15 | 150 |
| 120 | Finish | 5 | 6.0 |
| | **Total** | | **≈ 246 min ≈ 4.1 h** |

With the twin's example rates this gives about $257 per worm (material ≈ $15). The biggest items are
the **test bench (2.5 h)** and the **inspection**. For series production you would not run every worm
2 h on the bench – decide this with quality (for example 100 % for the first lot, then sampling).

Lot lead time (example): ≈ 14 days, from machine time at 2 shifts + furnace cycle + 2 days + 0.5 day
queue per operation.

#### 5.18 Matched pair: worm + wheel

1. The wheel is hobbed with a **duplex hob that has the SAME leads and profile** as this worm (item 1).
   For 1–2 pieces a fly cutter can be used.
2. The hob is set to the same centre distance a = 205.0 mm.
3. The worm is tested on the bench with a **master wheel** (class 4).
4. Then worm and its own wheel are rolled together with marking paste (wheel Op 50).
5. After the bench test, worm and wheel get the **same pair number** (laser mark, part record).
6. They are stored, shipped and replaced **together**.

#### 5.19 Make or buy

- The **worm grinding machine** and the **gear measuring machine** are the expensive part of this route.
- For a few tables per year, compare the cost per worm in the twin with quotes from worm gear makers for
  a **matched duplex set** (worm + wheel).
- The BOM of item 1 already allows "BUY as a set from a worm gear maker" for the wheel.
- If you buy: ask for the part record (lead, profile, runout, pitch, M, CHD, nital etch result, bench
  test, pair number) with every set. Check the first sets yourself (contact pattern, backlash slope).

---

## 6. Checklists

### 6.1 Before machining the housing and table

- [ ] Casting report: no pores at the bearing seat (X-ray), hardness 180–220 HB
- [ ] Stress relief done after roughing (protocol: 550 °C, 4–6 h, slow cooling)
- [ ] Base face ground (reference A, flatness 0.005)
- [ ] Bearing seat, worm bores and clamp seat programmed in **one set-up**
- [ ] Machine room at 20 °C ±1, part soaked
- [ ] CMM report complete (a = 205.0 ±0.01, perpendicularity 0.01/100, worm height ±0.02)

### 6.2 Worm wheel

- [ ] Duplex hob with the same leads/profile as the worm (or fly cutter for 1–2 pcs)
- [ ] Hob at centre distance a
- [ ] Gear measurement: Fp ≤ 12″ (example), runout
- [ ] Contact pattern with master worm ≥ 60 %, centred
- [ ] Pair number marked

### 6.3 Worm (per worm)

- [ ] 3.1 certificate, heat number stamped (Op 10)
- [ ] Centre holes DIN 332 form B, cone contact ≥ 80 % (Op 20)
- [ ] Ground Ø +0.6 mm (Op 30)
- [ ] Both duplex leads in the thread program, checked by quality (Op 40 / 80)
- [ ] Soft over-wire M = 60.435 ±0.08 mm; flank stock ≥ 0.15 mm each side (Op 40)
- [ ] Copper paste on the soft end thread
- [ ] Coupon in the charge; surface 58–62 HRC; core 30–42 HRC; CHD ≥ 0.90 mm (Op 50/60)
- [ ] Runout after quench ≤ 0.15 mm; straightened to ≤ 0.03 mm if > 0.04 mm; crack test OK
- [ ] Centre holes **re-ground** after hardening (Op 60)
- [ ] Seats k5, journal h6, tip h8; seat runout ≤ 3 µm (Op 70)
- [ ] Coolant chiller on (±0.5 K), dressing interval set (every 4–8 passes), Q'w ≤ 70 % of limit (Op 80)
- [ ] Nital etch 100 %: uniform grey (Op 90)
- [ ] 2 h soak at 20 °C before measuring (Op 100)
- [ ] fHβ L / R ±4 µm, Fα ≤ 5 µm, Fr ≤ 6 µm, fpx ±3 µm, M 58.973 ±0.025, M slope 43.7 µm/mm ±10 %, Ra ≤ 0.4 µm
- [ ] Bench: f'i ≤ 3″, F'i ≤ 6″, backlash slope 15.9 µm/mm ±10 %, shift inside 0.3–5 mm, pattern ≤ 15 % off centre, ΔT ≤ 15 K, ≤ 68 dB(A)
- [ ] Demagnetised ≤ 0.3 mT, pair number marked, part record closed

### 6.4 Assembly

- [ ] Clean room, parts washed, bearings opened only at the bench, no compressed air on bearings
- [ ] Housing on 3 points, levelled 0.02 mm/m
- [ ] Bearing screws crosswise 30 / 70 / 100 %; bearing face runout ≤ 0.003
- [ ] Table runout ≤ 0.005 (radial + axial)
- [ ] Wheel runout ≤ 0.01; mid-plane ±0.02 (shims)
- [ ] Worm axial play 0; friction torque as specified
- [ ] Contact pattern centred, ≥ 60 %, slightly to the exit side
- [ ] Backlash 0.005–0.010 mm at 3–4 table positions; spacer size recorded
- [ ] Clamp: no leak at 1.5 × p; torque ≥ 3 000 N·m; movement while clamping ≤ 1″
- [ ] Encoder scale runout ≤ 0.005; 2 heads exactly opposite; signals OK
- [ ] Rotary union leak test at 1.5 × p
- [ ] Oil to sight glass (ISO VG 220–460 as specified); sealing air 0.5 bar
- [ ] Zero-point modules: clamp/release and pressure test
- [ ] Table top ground in own bearing: flatness 0.005, parallel 0.01, modules ±0.003
- [ ] Servo has a **holding brake**; clamp interlocked in the PLC/CNC

### 6.5 Acceptance + handover

- [ ] 2 h run-in at changing speed
- [ ] Positioning A ≤ 5″, repeatability R ≤ 2″, reversal ≤ 2″ (ISO 230-2 procedure, 5 runs both directions)
- [ ] Table top flatness / runout 0.005 mm
- [ ] Clamp test ≥ 3 000 N·m, ≤ 1″
- [ ] 2 h at 50 % + 30 min max: ΔT ≤ 15 K, no noise peaks
- [ ] Records: CMM reports, assembly record, worm + wheel part record, acceptance report

---

## 7. Common mistakes and lessons

| Mistake | What happens | Do this instead |
|---|---|---|
| Thinking the worm holds the table | It does not (γ 4.57° > ρ' 1.83°, back-driving η ≈ 60 %). The table turns under cutting force or at power loss. | Hydraulic clamp for indexed cutting + servo with holding brake |
| Roughing while the table turns | Tooth force 5.6 kN vs 2.7 kN allowed → bronze teeth wear or break | Rough with the table clamped; while turning keep side force ≤ ≈ 1.95 kN (example) |
| Positioning with the motor encoder only | ±18″ = 0.021 mm at the pallet edge | Direct angle encoder with 2 opposite read heads (±2.7″) |
| Only 1 read head | Scale eccentricity 0.005 mm gives 9.8″ | 2 heads at 180° |
| Roughing the thread with one lead | The duplex shift at the ends (±0.36 mm) is bigger than the stock (0.25 mm) → one flank end has no stock → black spots | Rough flank by flank with both leads |
| Not measuring the soft worm over wires | Stock error found only after hardening → scrap | M_soft check at Op 40 |
| Ordering CHD without the grinding stock | Thin case after grinding | CHD_need = finished + stock + 0.05 (0.90 mm in the example) |
| No coupon in the furnace | Case depth unknown | Coupon in every charge |
| Not re-grinding the centre holes | Runout of seats and thread, transmission error | Re-grind after hardening; same centres from Op 30 to Op 100 |
| Warm coolant | Lead error, not visible at the machine (6 K → 5.7 µm) | Chiller ±0.5 K, warm-up cycle |
| Dressing too rarely | Profile roll-off, small contact pattern | Dress every 4–8 passes |
| Skipping the nital etch | Burn is invisible; soft spots wear fast | 100 % etch, ISO 14104 |
| Measuring right after grinding | Warm part → wrong lead and M | 2 h soak at 20 °C |
| Wrong duplex Δp in the program | Backlash slope wrong; target shift outside range | First-article inspection, program release by quality |
| Setting backlash too tight | Close to jamming (target 2.64 mm, jam at 3.14 mm) → heat, wear | Measure at 3–4 positions, take the smallest value, ≥ 0.005 mm |
| Setting backlash by changing the centre distance | Contact pattern moves to the edge | Use the duplex axial shift only |
| Finishing a casting before stress relief | Part moves later; seats out of tolerance | Rough → stress relief → finish |
| Machining the top before assembly only | Bearing and assembly errors stay in the top | Final grinding of top + module faces in the table's own bearing |
| Exchanging only the worm or only the wheel | New pair does not match; bad pattern | Always replace the matched pair |
| Compressed air on bearings | Dirt pushed into the bearing; rollers spin dry | Clean wipes; open bearings only at the bench |

---

## 8. Limits of the twin

Be aware of these simplifications before you use the numbers for a real design:

1. **All values are examples.** Bearing ratings, clamp torque, encoder accuracy, servo data, Fp, μ and c
   must come from catalogues, suppliers and your own trials.
2. **Motor sizing** uses only the acceleration torque (+10 %). It ignores bearing and seal friction,
   clamp disc drag, oil churning and cutting torque while turning. The suggested 0.4 kW servo is
   therefore optimistic. Make a full torque budget.
3. **Tooth load (Bach)** is a simple rule (Ft2 ≤ c · b2 · px). It does not check wear, pitting,
   temperature, tooth root strength or deflection. For the real design use a full worm gear load
   capacity calculation (for example DIN 3996) or the data of the worm gear maker.
4. **Self-locking** is judged only from γ and ρ' with a fixed μ. Real friction changes with speed,
   oil, temperature and vibration. Never rely on friction to hold a table.
5. **Accuracy budget** is simple: encoder, eccentricity and a **fixed 1″ thermal** term. The input
   "Temperature rise of the table" (5 K) is not used in the formula. Without encoder the budget is a
   simple sum (Fp + j/2 + 1″). Real tables also have encoder mounting errors, interpolation errors,
   servo following error and table deformation.
6. **Duplex backlash** uses j = j0 − s · Δp/px with a straight line. Real backlash also changes with
   wheel runout (measure at several positions), temperature and wear.
7. **Bearing check** uses only tilting moment and static axial load. No life calculation, no
   stiffness calculation.
8. **Over-wire formula** is an axial-section approximation. Use the exact formula for your worm profile
   type.
9. **Case depth** uses the Harris rule of thumb (0.635 · √t at 925 °C) and CHD ≈ 0.7 · total depth.
   Real CHD depends on the furnace, carbon potential and steel. Confirm with coupons.
10. **Thread grinding:** wheel wear (0.25 µm per pass), burn limit, stock needed and the 1 K → 1 µm rule
    are model values. Find the real burn limit Q'w by grinding trials with etch tests.
11. **Simulated measurements:** the part record values in item 2 are random numbers around typical
    values. They show the **logic** (cause → check), not the real capability of your machines.
12. **Cost and time:** example rates and simple time formulas. Not a quotation.
13. **Geometry drawing:** the cross-section is schematic (example sizes). It is not a manufacturing
    drawing.
14. The **standards** (ISO 230-2, ISO 10791-1/-4, DIN 3974, ISO 14104, DIN 332) are named for orientation.
    Read the current edition for exact procedures and limits (chapter 13 lists what each one requires).
15. The twin does **not** check bearing life, Hertz stress, thermal backlash change or the servo torque for
    cutting while turning. Chapter 10 does these checks by hand with example data.

---

## 10. Science principles

This chapter explains **why** the numbers in chapters 4 and 5 are what they are. Every formula is used
with the example values of the twin (m = 4, z1 = 1, z2 = 90, d1 = 50 mm, d2 = 360 mm, a = 205 mm,
γ = 4.57°, μ = 0.03, n_table = 20 rpm). Generic tables (material data, hardness conversion, fits) are in
`14_engineering_reference_data.md`; part-specific values are given here.

### 10.1 Worm gear kinematics – why a worm gear slides so much

The worm turns fast, the wheel turns slowly. At the contact point the two surfaces move in directions
that are 90° apart.

| Quantity | Formula | Example |
|---|---|---|
| Worm speed | n1 = n2 · i | 20 · 90 = 1 800 rpm |
| Worm pitch-line speed | v1 = π · d1 · n1 / 60 | π · 0.050 · 1 800 / 60 = **4.712 m/s** |
| Wheel pitch-line speed | v2 = π · d2 · n2 / 60 | π · 0.360 · 20 / 60 = **0.377 m/s** |
| Check of the lead angle | tan γ = v2 / v1 | 0.377 / 4.712 = 0.080 → γ = 4.57° ✓ (same as from the geometry) |
| Sliding speed | vs = √(v1² + v2²) = v1 / cos γ | **4.73 m/s** |

**Meaning:** in a spur gear the teeth mostly **roll**. In this worm gear the flanks **slide** at 4.73 m/s
while the wheel surface moves only 0.38 m/s. Sliding makes friction heat and wear. That is why we use a
hardened, ground steel worm against a soft bronze wheel, with oil between them.

### 10.2 Forces, friction and efficiency – derived from the inclined plane

Unroll one turn of the worm thread: it becomes a **ramp** (inclined plane) with the angle γ. The wheel tooth
is a load that the worm pushes up the ramp.

* The flank is also inclined by the pressure angle αn = 20° in the normal section. The normal force is
  therefore bigger by 1/cos αn, and so is the friction. We use an **apparent friction coefficient**
  μ' = μ / cos αn and the **friction angle** ρ' = atan μ'.
  Example: μ' = 0.03 / 0.940 = 0.0319 → ρ' = **1.83°**.
* **Worm drives (normal operation):** the force at the worm pitch circle is
  Ft1 = Ft2 · tan(γ + ρ').
  Power in P1 = Ft1 · v1, power out P2 = Ft2 · v2 = Ft2 · v1 · tan γ, therefore

  **η = P2 / P1 = tan γ / tan(γ + ρ')** = 0.0800 / 0.1122 = **0.713**
* **Wheel drives (back-driving, for example the cutting force pushes the table):**
  Ft1 = Ft2 · tan(γ − ρ'),  **η' = tan(γ − ρ') / tan γ** = 0.0480 / 0.0800 = **0.60**.
  If γ ≤ ρ', then Ft1 ≤ 0: the wheel cannot turn the worm → **self-locking**.

Forces on the worm and its bearings (approximation for small γ):

| Force | Formula | Example at the allowed tooth force Ft2 = 2 714 N |
|---|---|---|
| Wheel tangential force = worm axial force | Fa1 = Ft2 | **2 714 N** → goes into the FIXED bearing pair |
| Separating (radial) force | Fr ≈ Ft2 · tan αn | 2 714 · 0.364 = **988 N** |
| Worm tangential force | Ft1 = Ft2 · tan(γ + ρ') | 2 714 · 0.1122 = **305 N** |
| Worm torque | T1 = Ft1 · d1 / 2 | 305 · 0.025 = **7.6 N·m** |
| Check with the efficiency | T1 = T2 / (i · η), T2 = Ft2 · d2/2 = 488.5 N·m | 488.5 / (90 · 0.713) = 7.6 N·m ✓ |

**Finding (important):** the 0.4 kW servo of the twin has T_max = 3.8 N·m. It can drive the table
(acceleration needs 2.83 N·m), but it **cannot** drive against the full allowed cutting load while the
table turns (7.6 N·m). If the cutting force back-drives the table, the motor must hold
T2 · η' / i = 488.5 · 0.60 / 90 = 3.3 N·m – almost its maximum. So for simultaneous 4-axis cutting choose
a bigger servo after a full torque budget (see 4.4 warning and 8 item 2).

**Friction changes with speed.** μ is highest near standstill (mixed friction, roughly 0.06–0.10) and
falls when the sliding speed rises (roughly 0.02–0.04 at several m/s with a good oil). Example at
μ = 0.08: ρ' = atan(0.08 / 0.94) = 4.87° > γ = 4.57° → the same drive **is** self-locking at very low
speed but **not** at normal speed. The behaviour is not predictable – this is the physical reason for the
rule "never rely on friction, use the clamp + brake". (The μ values are typical orders of magnitude; the
μ curves of DIN 3996 or the oil supplier give real values.)

### 10.3 Hertz contact stress – the basics

Two curved steel/bronze surfaces touch only along a thin line. The pressure there is very high and is
called the **Hertz contact stress** p_H.

Line contact (two cylinders, length l):

```
p_H = √( Fn · E* / (π · l · R) )
1/E* = (1 − ν1²)/E1 + (1 − ν2²)/E2          (combined elasticity)
1/R  = 1/R1 + 1/R2                           (combined curvature radius)
```

| Input | Value (typical, check supplier) |
|---|---|
| Steel worm | E1 = 210 000 N/mm², ν1 = 0.30 |
| Bronze CuSn12Ni2 | E2 ≈ 98 000 N/mm², ν2 ≈ 0.35 |
| E* | 1 / (0.91/210 000 + 0.8775/98 000) = **75 300 N/mm²** |
| Worm flank radius (straight flank in the axial section) | R1 ≈ ∞ |
| Wheel flank radius | R2 ≈ (d2/2) · sin αn = 180 · 0.342 = **61.6 mm** |
| Normal force | Fn = Ft2 / (cos αn · cos γ) = 2 714 / (0.940 · 0.997) = **2 897 N** |
| Contact line length (simplified: one line over the face width) | l ≈ b2 = 36 mm |

p_H = √(2 897 · 75 300 / (π · 36 · 61.6)) = √(2.18·10⁸ / 6 967) ≈ **177 N/mm²**

Lessons:
* p_H grows only with √F: double force → +41 % stress.
* p_H grows with 1/√l: if a **bad contact pattern** halves the contact length, the stress rises by √2
  (177 → 250 N/mm²). That is why the contact pattern (≥ 60 %, centred) matters so much.

### 10.4 Worm gear load capacity – the idea (DIN 3996 as reference only)

A real worm gear is checked for **five failure modes**. The twin only uses the simple Bach rule.

| Failure mode | What happens | Check idea |
|---|---|---|
| Wear | bronze is slowly removed → backlash grows, accuracy is lost | wear rate × sliding path over the life ≤ allowed wear |
| Pitting | small fatigue craters on the bronze flank | mean Hertz stress σHm ≤ allowed |
| Tooth root | bronze tooth breaks in shear | tooth root shear stress ≤ allowed |
| Temperature | oil too hot → oil breaks down, wear rises | oil sump temperature ≤ oil limit |
| Worm deflection | worm bends → contact moves to the edge | deflection ≤ limit in the standard |

**Pitting, example only.** DIN 3996 uses a mean Hertz stress of the form
σHm = (4/π) · √(p*m · T2 · 1000 · Ered / a³) with Ered = 2 · E* = 150 500 N/mm², T2 in N·m, a in mm and a
geometry factor p*m (assumed ≈ 1 here – the real value comes from the standard).

| Case | T2 | σHm (example) |
|---|---|---|
| Run-in test torque | 300 N·m | 1.273 · √(1 · 300 000 · 150 500 / 205³) = **92 N/mm²** |
| Allowed tooth force (Bach) | 488.5 N·m | **118 N/mm²** |
| Full cutting torque while turning | 1 000 N·m | **168 N/mm²** |

The pitting limit of CuSn12Ni2-C-GZ in DIN 3996 is of the order of 500 N/mm² before reduction factors
(check the table and factors in the current edition). So **pitting is not the limit** of this table. For a
precision rotary table the real limits are **wear (loss of accuracy), tooth deflection (stiffness) and
temperature**. The Bach rule of the twin (c = 6 N/mm²) is conservative; keep it as the working rule until
a full DIN 3996 (or ISO/TS 14521) calculation or the worm gear maker confirms a higher load.

**Worm deflection, example.** Bearing centres about 140 mm apart (seat A centre at 54 mm, seat B centre at
194 mm from the journal end), root diameter df1 = 40.4 mm:
I = π · 40.4⁴ / 64 = 130 800 mm⁴; resultant load F = √(Ft1² + Fr²) = √(305² + 988²) = 1 034 N;
δ = F · l³ / (48 · E · I) = 1 034 · 140³ / (48 · 210 000 · 130 800) = **0.002 mm** → very small.

### 10.5 Bearing life L10 = (C / P)^p

L10 = life in **millions of revolutions** that 90 % of the bearings reach. p = 3 for ball bearings,
p = 10/3 for roller bearings. C = dynamic load rating (catalogue), P = equivalent load.

Example: fixed bearing pair of the worm (angular contact ball bearings, 40°, back-to-back, C ≈ 25 kN for
the pair – **example, check the catalogue**). Load at the run-in test torque 300 N·m:
Ft2 = 2 · 300 / 0.360 = 1 667 N = Fa; Fr ≈ 1 667 · tan 20° = 607 N.

| Step | Formula | Example |
|---|---|---|
| Ratio | Fa / Fr | 2.75 > e = 1.14 (typical catalogue value for paired 40° bearings) |
| Equivalent load | P = 0.57 · Fr + 0.93 · Fa (typical catalogue factors for this case) | 346 + 1 550 = **1 896 N** |
| Life | L10 = (C/P)³ | (25 000 / 1 896)³ = **2 290 million revolutions** |
| Life in hours at a mean worm speed of 300 rpm | L10h = L10 · 10⁶ / (60 · n) | **≈ 127 000 h** → OK |

Lesson: life ∝ (1/P)³. Double load → 1/8 of the life. For the main axial-radial bearing the speed is so
low that life is rarely the limit; there the **static safety** C0/P0 (twin: 126) and the **tilting
stiffness** decide.

### 10.6 Thermal expansion ΔL = α · L · ΔT

| Material | α (typical) µm/(m·K) |
|---|---|
| Steel (16MnCr5, C45, 42CrMo4) | 11.5 |
| Grey cast iron EN-GJL | ≈ 10.5 |
| Ductile iron EN-GJS | ≈ 11–12.5 |
| Tin bronze CuSn12Ni2 | ≈ 18 |
| Aluminium alloys | ≈ 23 |

| Example | Calculation | Result | Consequence |
|---|---|---|---|
| Housing centre distance, 5 K warmer | 10.5·10⁻⁶ · 205 · 5 | **10.8 µm** | bigger than the tolerance ±10 µm → machine and measure at 20 °C ±1 K (1 K = 2.2 µm) |
| Worm lead while grinding, 0.5 K | 11.5·10⁻⁶ · 82 · 0.5 | 0.47 µm | chilled coolant (4.14) |
| Backlash when the worm is warmer than the housing | worm +15 K, wheel + housing +5 K: worm radius +11.5·10⁻⁶ · 25 · 15 = 4.3 µm; wheel radius (steel hub governs) +11.5·10⁻⁶ · 180 · 5 = 10.4 µm; centre distance +10.5·10⁻⁶ · 205 · 5 = 10.8 µm; overlap = 4.3 + 10.4 − 10.8 = 3.9 µm; backlash change ≈ 2 · 3.9 · tan 20° | **−2.8 µm** | target 8 µm cold → 5.2 µm warm: still > 0. Never set the backlash to zero cold. |
| Bronze rim shrunk on a steel hub, Ø310 | (18 − 11.5)·10⁻⁶ · 310 per K | **−2.0 µm interference per K** | rim warmer than hub loosens the fit → enough interference (11.4) |

### 10.7 Metallurgy of case hardening

Why case hardening: the worm flank must be **hard** (≥ 58 HRC, against wear and contact stress) and the
core must be **tough** (against bending, impact, cracks). 16MnCr5 has only 0.14–0.19 % carbon – too little
to become very hard. We add carbon only in the surface.

**Step 1 – Carburising (diffusion).** At 925 °C the steel is austenite, which dissolves carbon. A
furnace atmosphere with a carbon potential of 1.1 % (boost), later 0.8 % (diffuse), gives carbon to the
surface; it **diffuses** inwards. The physics of diffusion gives

```
x ≈ √(D · t)          D = D0 · e^(−Q / (R·T))
```

Textbook values for carbon in austenite: D0 = 2.3·10⁻⁵ m²/s, Q = 148 kJ/mol, R = 8.314 J/(mol·K).

| Step | Example |
|---|---|
| D at 925 °C (1 198 K) | 2.3·10⁻⁵ · e^(−148 000 / (8.314 · 1 198)) = **8.1·10⁻¹² m²/s** |
| √(D·t) for t = 5 h = 18 000 s | √(8.1·10⁻¹² · 18 000) = **0.38 mm** |
| Depth where carbon falls to ≈ 0.35 % (error-function solution, surface 0.9 %, core 0.16 %): (0.9 − 0.35)/(0.9 − 0.16) = 0.743 = erf(z) → z ≈ 0.80 | x = 2 · 0.80 · 0.38 = **≈ 0.6 mm** |
| D at 950 °C | 1.10·10⁻¹¹ m²/s (+35 %) → same depth in 5 / 1.35 = **3.7 h** |

What this teaches:
* **Depth ∝ √t:** double depth needs **4 × time**. 1.5 h instead of 5 h gives only √(1.5/5) = 55 % of
  the depth (the "hard" fault of the twin).
* **Temperature is strong:** +25 K gives +35 % D. But a higher temperature gives grain growth and more
  distortion.
* The simple textbook D gives a lower depth than the practical Harris rule (0.635 · √t = 1.42 mm total
  depth, CHD ≈ 0.99 mm, see 4.13), because D increases with the carbon content and the boost phase
  pushes more carbon in. **Use the furnace supplier's data and coupons**, not the textbook number.

**Step 2 – Hardening (martensite).** From 840 °C the worm is quenched in oil. Carbon has no time to leave
the iron lattice; the lattice is trapped in a distorted form = **martensite**, very hard.
* Surface with 0.7–0.8 % C → about 62–65 HRC as quenched.
* Core with 0.16 % C → low-carbon martensite / bainite, about 30–42 HRC (depends on the diameter and the
  hardenability of the heat).
* Surface carbon too high (> ≈ 0.9 %) → **retained austenite** (soft, it can transform later → size change)
  and carbide networks (brittle). Too low → below 58 HRC.
* Martensite has a bigger volume → the case is in **compression** (good for fatigue) and the part
  **distorts** (lead grows ≈ +180 µm/m, runout) → grinding stock is needed.

**Step 3 – Tempering.** 2 h at 180 °C: fine carbides form, internal stresses drop, toughness rises, the
hardness falls by about 1–3 HRC (to ≈ 60 HRC). **Rule:** any later heating above the tempering
temperature (grinding burn!) softens the surface again.

Hardness conversion (ISO 18265, approximate): 58 HRC ≈ 650 HV; the CHD limit 550 HV ≈ 52 HRC.

### 10.8 Grinding burn – the physics

Grinding removes material with many small, blunt grains. It needs much more energy per mm³ than turning:

| Process | Specific energy (typical) |
|---|---|
| Turning steel (kc ≈ 2 000 N/mm²) | ≈ 2 J/mm³ (1 N/mm² = 1 J/mm³) |
| Grinding hardened steel with Al2O3 | ≈ 20–60 J/mm³ |

Power per mm of contact width: P' = e_c · Q'w = 40 J/mm³ · 2.36 mm³/(mm·s) ≈ **94 W per mm** (example
e_c = 40). With aluminium-oxide wheels most of this heat (roughly 60–80 %) goes into the workpiece, in a
contact zone of only a few mm. Short flash temperatures of several hundred °C are possible.

| Peak temperature in the surface | Result | Nital etch picture |
|---|---|---|
| below the tempering temperature (≈ 180 °C) | no change | uniform grey |
| above the tempering temperature | **re-tempering burn**: softer zone (twin: ≈ 53 HRC), tensile residual stress | dark areas |
| above ≈ 720–750 °C (Ac1) | **re-hardening burn**: fresh, untempered, brittle martensite on top, soft zone under it, risk of cracks | light areas with dark border |

Ways to keep the temperature down: lower Q'w (smaller infeed), a sharp wheel (dress often – dull grains
raise e_c), coolant **into** the contact zone (nozzle aimed and clean), CBN wheels (conduct heat away, less
heat into the part). The real Q'w limit is found by **trials + nital etch** (ISO 14104), then guarded by the
spindle power monitor.

### 10.9 Measurement: 10:1 rule, uncertainty, gauge R&R, decision rule

* **10:1 rule (rule of thumb):** the resolution of the gauge should be ≤ 1/10 of the tolerance.
  Ø25 k5: tolerance T = 9 µm → resolution ≤ 0.9 µm. A 1 µm micrometer is **not enough**; use an air gauge
  or an inductive comparator set with a master ring at 20 °C.
* **Uncertainty U (k = 2)** includes the gauge, the master, temperature, the operator and the part form.
  Goal: U ≤ T/10 … T/4.
* **Gauge R&R (repeatability & reproducibility)** – idea of the AIAG MSA manual (VDA 5 and ISO 22514-7
  treat the same subject): 10 parts × 3 operators × 2–3 repeats →
  %GRR = 6 · σ_GRR / T · 100 %. ≤ 10 % good; 10–30 % acceptable only with a documented decision;
  > 30 % not acceptable.
  Ø25 k5: 10 % means σ_GRR ≤ 0.15 µm (very hard), 30 % means σ_GRR ≤ 0.45 µm (possible with an air
  gauge). Example decision: accept ≤ 30 % for the k5 seats with guard bands.
* **Decision rule (ISO 14253-1):** to **prove conformance**, the measured value must be inside the
  tolerance **reduced by U** on both sides. Ø25 k5 (25.002 … 25.011), U = 0.8 µm → accept
  25.0028 … 25.0102 mm.
* **Temperature:** a worm 5 K warmer than 20 °C is 11.5·10⁻⁶ · 25 · 5 = **1.4 µm** bigger in diameter
  = 16 % of the k5 tolerance → soak 2 h in the measuring room.

### 10.10 Abbe principle

**Error = offset h between the measuring line and the scale × tilt angle φ.**

| Example | Calculation | Error |
|---|---|---|
| Caliper: contact 40 mm away from the scale, jaw tilt 0.2 mrad (≈ 40″) | 40 · 0.0002 | **8 µm** |
| Micrometer: spindle in line with the part (h ≈ 0) | – | no first-order Abbe error |
| Machine axis with 5″ pitch error (24 µrad), tool point 300 mm above the scale | 300 · 0.000024 | **7.3 µm** |
| Rotary table: motor encoder (worm side, far from the function) vs direct encoder on the table | – | direct encoder measures at the table → worm errors do not count (4.9) |

Rule: measure as close to the function as possible, in line with the scale (gear measuring machine, air
gauge, direct angle encoder), and measure the table at working height in the acceptance test.

---

## 11. Detailed manufacturing specification

All values in this chapter are an **example design** that fits the twin's example numbers. They are written
so that you can transfer them to drawings. The design engineer must check and sign every value. General
tolerances on the drawings: **ISO 2768-mK** (example; check whether your company uses ISO 22081 general
specifications instead). Generic tables (all ISO 286 classes, hardness conversion, cutting data for many
materials) are in `14_engineering_reference_data.md`.

### 11.1 Materials

| Part | Material | No. | Standard | Delivery / final condition | Rm (MPa) | Rp0.2 (MPa) | Hardness |
|---|---|---|---|---|---|---|---|
| Duplex worm | 16MnCr5 (alternative 20MnCr5, 1.7147) | 1.7131 | EN 10084 | bar +FP (ferrite-pearlite, good machinability), then case hardened | core typically ≈ 800–1 100 (depends on section) | core typically ≥ ≈ 590 | +FP: 140–187 HB; case 58–62 HRC; core 30–42 HRC |
| Worm wheel rim | CuSn12Ni2-C-GZ (centrifugal cast) | CC484K | EN 1982 | as cast | typ. min ≈ 300 | typ. min ≈ 180 | typ. ≥ 90 HB (check EN 1982 table) |
| Worm wheel hub | C45+N | 1.0503 | EN 10083-2 | normalised | ≥ 580 (16 < d ≤ 100) | ≥ 305 | ≈ 170–210 HB |
| Housing | EN-GJL-300 | EN-JL1050 | EN 1561 | as cast + stress relieved | ≥ 300 (separately cast test bar; lower in thick walls) | – (no yield point) | ≈ 190–240 HB, agree with foundry |
| Table top | EN-GJS-600-3 | EN-JS1060 | EN 1563 | as cast | ≥ 600 | ≥ 370 | ≈ 190–270 HB; A ≥ 3 % |
| Hub sleeve, clamp disc | C45+QT | 1.0503 | EN 10083-2 | quenched + tempered | 630–780 (40 < d ≤ 100) | ≥ 370 | ≈ 190–230 HB |
| Clamp ring (thin wall) | 42CrMo4+QT | 1.7225 | EN 10083-3 | quenched + tempered | 900–1 100 (40 < d ≤ 100) | ≥ 650 | ≈ 270–330 HB |
| Worm cartridges | C45+QT (or 42CrMo4+QT) | 1.0503 | EN 10083-2 | QT | as above | as above | |
| Spacer ring | 100Cr6 hardened (or 42CrMo4+QT) | 1.3505 | ISO 683-17 | hardened + tempered | – | – | 58–62 HRC |
| Screws | ISO 4762, class 12.9 / 10.9 | – | ISO 898-1 | – | 12.9: ≥ 1 220; 10.9: ≥ 1 040 | 12.9: ≥ 1 100; 10.9: ≥ 940 | |

QT strength values depend on the diameter of the bar ("ruling section"); the numbers above are for
40–100 mm. Order every material with an **inspection certificate 3.1 (EN 10204)**.

### 11.2 Heat treatment

| Part | Treatment | Temperatures / times (example) | Result required | Check |
|---|---|---|---|---|
| Worm | Carburise – harden – temper | carburise 925 °C, 5 h (Cp 1.1 % boost → 0.8 % diffuse); harden from 840 °C into oil 60 °C; temper 180 °C, 2 h (min. 1 h at temperature) | surface 58–62 HRC (after grinding ≥ 58 HRC); CHD (550 HV1) **0.90–1.25 mm before grinding**, ≥ 0.6 mm after grinding; core 30–42 HRC; surface carbon 0.7–0.8 %; retained austenite ≤ 20 % (example) | HRC on the end face (ISO 6508); HV1 traverse on the coupon (ISO 6507, ISO 18203); runout; magnetic particle test |
| Worm (option) | Sub-zero treatment before tempering | −80 °C, 1–2 h | less retained austenite → better size stability | only if needed – decide with the heat treater |
| Housing (GJL-300) | Stress relief after roughing | 550 °C (530–570), 4–6 h; heat and cool ≤ 50 K/h down to ≈ 200 °C | no size change after finishing | furnace chart |
| Table top (GJS-600) | Stress relief after roughing | ≈ 550 °C, 2–4 h, slow cooling (check with foundry – too high a temperature lowers the strength of GJS-600) | – | furnace chart |
| Clamp ring, cartridges, hub sleeve | Quench + temper (buy as +QT bar or treat after roughing) | 42CrMo4: harden 830–860 °C oil, temper 540–680 °C to the strength; C45: 820–860 °C water/oil, temper 550–660 °C | Rm as in 11.1 | hardness HB/HRC, certificate |
| Spacer ring | Harden + temper | 100Cr6: 830–870 °C oil, temper 160–180 °C | 58–62 HRC | HRC |

Write the heat treatment on the drawing according to **ISO 15787** (example note in 11.11).

### 11.3 Duplex worm – drawing VC-HMC-WRM-0011-A (part number VC-HMC-WRM-0011)

**Gear data box (on the drawing):**

| Item | Value |
|---|---|
| Worm type / flank form | cylindrical worm, flank form **ZK** (ground with a disc wheel) or ZI – **decide with the grinding machine and the hob maker; worm, hob and master wheel must have the same form** |
| Number of starts z1 / hand | 1 / right hand |
| Axial module m | 4 mm |
| Axial pressure angle | 20° (the twin uses 20° in the axial section; state "axial" or "normal" on the drawing) |
| Reference (pitch) diameter d1 | 50 mm |
| Lead angle γ | 4.574° |
| Axial pitch px | 12.566 mm |
| Lead left flank pL / right flank pR | **12.466 / 12.666 mm** (duplex, Δp = 0.200 mm) |
| Thread thickness growth | Δp/px = 0.0159 mm per mm of axial length, thicker towards … (state the direction!) |
| Tip Ø / root Ø / thread length | 58 h8 / 40.4 / 90 mm |
| Mating wheel | z2 = 90, a = 205.000 mm, drawing VC-HMC-WRM-0014 |
| Accuracy | DIN 3974, class 5 (example) with the limits of 11.3 measuring plan |
| Over-wire check | wires Ø6.686 mm, M (middle of the thread) = 58.973 ± 0.025 mm; dM/dx = 43.7 µm/mm ± 10 % |

**Dimensions with numeric limits (ISO 286):**

| Feature | Size + class | Upper / lower limit (mm) | Note |
|---|---|---|---|
| Motor journal | Ø20 h6 | 20.000 / 19.987 | clamping-hub coupling, no keyway |
| Bearing seat A (fixed side) | Ø25 k5 | 25.011 / 25.002 | angular contact pair |
| Bearing seat B (floating side) | Ø25 k5 | 25.011 / 25.002 | needle / cylindrical roller bearing |
| Thread tip | Ø58 h8 | 58.000 / 57.954 | ground |
| Shoulders | Ø32 | ISO 2768-m: ±0.3 | bearing abutment faces |
| Root | Ø40.4 | ±0.1 (not ground) | |
| Total length | 222 | ±0.1 | |
| Seat lengths | 28 / 24 | ISO 2768-m: ±0.2 | |
| Thread position (middle of thread to fixed shoulder) | from the layout | ±0.05 | important for the backlash shift range |
| Lock-nut thread | **check the layout:** the precision lock nut must sit at the FIXED bearing pair; the twin layout puts the M20 end thread at the floating end. Example correction: M25×1.5-6g next to seat A for a precision lock nut | 6g (ISO 965-1) | design decision |
| Centre holes | DIN 332-1 form B 3.15/10 | – | re-ground after hardening |
| Undercuts at ground shoulders | DIN 509 form F, e.g. F 0.6×0.3 (check the DIN 509 table for Ø25) | – | |

**Geometric tolerances (ISO 1101), datum A–B = common axis of the two bearing seats:**

| Feature | Tolerance | Value |
|---|---|---|
| Bearing seats A, B | circular run-out to A–B | 0.003 |
| Bearing seats A, B | cylindricity | 0.002 |
| Shoulder faces at the fixed bearing | axial run-out to A–B | 0.003 |
| Motor journal | circular run-out to A–B | 0.005 |
| Thread tip | circular run-out to A–B | 0.010 |
| Thread (ball in the gap) | run-out Fr | 0.006 |

**Surface texture (ISO 21920-1; state the cut-off λc = 0.8 mm on the drawing to avoid confusion between
the old ISO 4288 and the new defaults):**

| Surface | Requirement |
|---|---|
| Flanks (ground) | Ra ≤ 0.4 µm |
| Bearing seats | Ra ≤ 0.4 µm (Rz ≤ 2.5 µm) |
| Motor journal | Ra ≤ 0.8 µm |
| Thread tip, shoulders | Ra ≤ 0.8 µm |
| All other surfaces | Ra ≤ 3.2 µm |

**Edges (ISO 13715):** external edges −0.2 … −0.5 mm; thread tip edges chamfer 0.5 × 45° or radius R0.5
(sharp hardened edges chip and crack); no burrs at the flanks.

**Measuring plan – worm:**

| No. | Characteristic | Limit | Method / gauge | When |
|---|---|---|---|---|
| 1 | Material | 16MnCr5 1.7131 | 3.1 certificate, heat no. | Op 10, every heat |
| 2 | Length | 222 ±0.1 | caliper 0.01 mm | Op 20, 100 % |
| 3 | Centre hole contact | ≥ 80 % | blue paint on master centre | Op 20 + Op 60 |
| 4 | Pre-grind Ø | 25.6 / 58.6 ±0.05 | micrometer 0.001 mm | Op 30, 100 % |
| 5 | Soft over-wire M | 60.435 ±0.08 | 3 wires Ø6.686 + micrometer 0.001 mm | Op 40, 100 % |
| 6 | Surface / core hardness | 58–62 / 30–42 HRC | Rockwell tester (ISO 6508) | Op 60, 100 % / per charge |
| 7 | CHD 550 HV1 | 0.90–1.25 mm | Vickers traverse on coupon (ISO 6507, ISO 18203) | per charge |
| 8 | Runout after quench | ≤ 0.15 (straighten > 0.04 → ≤ 0.03) | dial gauge 0.01 between centres | Op 50, 100 % |
| 9 | Cracks | no indication | magnetic particle (ISO 9934-1) | Op 50, 100 % |
| 10 | Seats Ø25 k5 | 25.002–25.011 (guard band U) | air gauge or inductive comparator, master ring | Op 70, 100 % |
| 11 | Journal Ø20 h6, tip Ø58 h8 | as above | micrometer 0.001 mm / comparator | Op 70, 100 % |
| 12 | Seat runout | ≤ 0.003 | inductive probe 0.1 µm between centres | Op 70, 100 % |
| 13 | Grinding burn | uniform grey | nital etch (ISO 14104) | Op 90, 100 % |
| 14 | Lead fHβ L/R, ffβ | ±4 µm / ≤ 3 µm | gear measuring machine | Op 100, 100 % |
| 15 | Profile Fα L/R | ≤ 5 µm | gear measuring machine | Op 100, 100 % |
| 16 | Runout Fr, pitch fpx | ≤ 6 µm / ±3 µm | gear measuring machine | Op 100, 100 % |
| 17 | Over-wire M + slope | 58.973 ±0.025; 43.7 µm/mm ±10 % | 3 wires + length measuring machine / micrometer 0.001 at 4 positions | Op 100, 100 % |
| 18 | Roughness flanks / seats | Ra ≤ 0.4 | stylus instrument | Op 100, first part + 1 per lot |
| 19 | f'i / F'i / backlash slope / pattern / ΔT / noise | 3″ / 6″ / 15.9 µm/mm ±10 % / ≤ 15 % off centre / ≤ 15 K / ≤ 68 dB(A) | test bench | Op 110 (100 % first lot, then plan) |
| 20 | Residual magnetism | ≤ 0.3 mT | field meter | Op 120, 100 % |

**Machining parameters – worm (16MnCr5 +FP, ≈ 160 HB; example starting values, coated carbide, check the
tool supplier):**

| Op | Operation | Tool | vc (m/min) | f (mm/rev) | ap (mm) | Note |
|---|---|---|---|---|---|---|
| 20 | Face | CNMG 120408, P15–P25 grade | 180–220 | 0.15–0.25 | ≤ 3.5 | |
| 20 | Centre drill | DIN 333 form B 3.15, HSS-Co | 20–25 | 0.04–0.06 | – | |
| 30 | Rough turn | CNMG 120408 | 200–240 | 0.25–0.35 | 2–3 | twin: 200 / 0.3 / 2 |
| 30 | Pre-finish ground Ø (+0.6) | VNMG 160404 | 250–300 | 0.10–0.15 | 0.3–0.5 | Rth = f²/(8r) = 0.15²/(8·0.4) = 7 µm – fine for grinding stock |
| 30 | Undercuts | grooving insert, width per DIN 509 | 120–150 | 0.05–0.08 | – | |
| 30 | Lock-nut thread M25×1.5 | 60° full-profile insert | 120–150 | 1.5 (pitch) | 6–8 passes | |
| 40 | Thread whirling | 4–6 carbide form inserts | 150–250 | worm 5 rpm | 2 passes | flank by flank, 2 leads |
| 40 | (alt.) single-point thread | form tool | ≈ 90 | lead | 0.3 radial per pass, 38 passes | |
| 70 | Cylindrical grinding | A80 K vitrified, vs 35 m/s | vw 20 m/min | rough 0.6 mm/min, finish 0.1 mm/min (on Ø) | stock 0.6 on Ø | spark-out |
| 80 | Thread grinding | single-rib wheel, diamond-roll dressed | worm 30 rpm (vw 78.5 mm/s) | lead | ae 8 × 0.03 + 2 × 0.01 + 1 spark-out | Q'w ≤ 70 % of the limit |

**Tool list – worm (example):**

| Tool no. | Description | Op |
|---|---|---|
| T7001 | Turning holder PCLNR 2525M12 + CNMG 120408 P25 | 20, 30 |
| T7002 | Turning holder SVJBR 2525M16 + VNMG 160404 P15 | 30 |
| T7003 | Grooving holder + insert for DIN 509 form F | 30 |
| T7004 | External threading holder + 1.5 ISO full-profile insert | 30 |
| T1003 | Centre drill DIN 333 B 3.15 | 20 |
| T9006 | Whirling ring + 6 form inserts for m 4, 20° (special, from the whirling unit supplier) | 40 |
| T8001 | Thread grinding wheel + diamond dressing roll (profile for ZK/ZI, m 4) | 80 |
| T8002 | Cylindrical grinding wheel A80 K vitrified Ø500 | 70 |

Tool numbers follow guide 15 (`T<family><nnn>`: 1 drills, 7 turning, 8 grinding wheels, 9 special); each
physical assembly gets `-01`, `-02` … (e.g. T7001-01). The numbers here are example allocations.

**Fixture concepts – worm:** Op 20 three-jaw chuck + steady rest; Op 30/40/70/80 **between centres**
(fixed centre at the tailstock side ground to the same 60° as the centre holes; drive by face driver or
drive dog on the motor journal, with a protecting sleeve so the journal is not marked). The centre holes
are the **only** datum from Op 30 to Op 100. Op 50: hang the worms vertically on a fixture (less bending).

### 11.4 Worm wheel – drawings VC-HMC-WRM-0014 (assembly), -0015 (rim), -0016 (hub) (example allocation)

| Feature | Requirement (example) | Numeric limits |
|---|---|---|
| Teeth | z2 = 90, m = 4, pressure angle 20° (same definition as the worm), right hand, hobbed at a = 205.000 with a duplex hob | DIN 3974 class 5 (example); Fp ≤ 12″ = 0.0105 mm at r = 180 mm |
| Pitch Ø d2 / throat Ø da2 / outside Ø | 360 / 368 / ≈ 372 | throat radius rk = a − da2/2 = 21 mm |
| Face width b2 | 36 | ±0.1 |
| Rim on hub | shrink fit **Ø310 H7/s6** (example) – hole 310.000 / 310.052, shaft 310.170 / 310.202 → interference 0.118 … 0.202 | check the press fit with DIN 7190 (stress in the bronze, torque); heat the rim: ΔT = (0.202 + 0.05 clearance) / (18·10⁻⁶ · 310) ≈ **45 K** above the hub → rim to ≈ 70–80 °C |
| Secure the rim | 6 axial pins (half in rim, half in hub) or bolts + dowels | |
| Centring spigot to the hub sleeve | Ø200 H6 (bore, +0.029 / 0) on the sleeve js5 (±0.010) – example | |
| Fastening to the hub sleeve | 12 × ISO 4762 M10-10.9, 73 N·m (μ = 0.12, 11.9), + 2 dowels Ø10 m6 (ISO 8734) in holes Ø10 H7 (+0.015 / 0) | |
| Run-out of the teeth to the spigot | radial 0.010, axial (mounting face) 0.005 | |
| Flank roughness | Ra ≤ 1.6 µm (bronze runs in) | |
| Edges | tooth ends chamfered 0.5 × 45° | |

Measuring plan wheel: pitch fp, cumulative Fp, runout Fr (gear measuring machine); contact pattern with the
master worm (≥ 60 %, centred); run-out of spigot and face (dial gauge 0.001 mm); shrink fit: rim cannot
turn at the test torque (example: 1.5 × max torque).

Cutting data wheel (example): turning bronze vc 200–300 m/min, f 0.1–0.2 mm, K10/N grade, sharp positive
insert; hobbing bronze with an HSS (or carbide) duplex hob vc ≈ 30–60 m/min, radial or tangential feed
according to the hob maker; C45 hub turning vc 180–250 m/min, f 0.2–0.3 mm.

### 11.5 Housing – drawing VC-HMC-RT-0010 (example allocation)

| Feature | Requirement (example) | Numeric limits |
|---|---|---|
| Base face = datum A | flatness 0.005, Ra ≤ 0.8 (ground) | |
| Main bearing seat = datum B | Ø300 H6 (or as the bearing catalogue requires) | 300.032 / 300.000 |
| Bearing seat face | perpendicularity to B 0.003; Ra ≤ 0.8 | |
| Worm cartridge bores (2) = datum C | Ø80 H6 (example cartridge Ø) | 80.019 / 80.000; coaxiality of both bores Ø0.005; Ra ≤ 0.8 |
| Centre distance B ↔ C | 205.000 | ±0.010 |
| Worm axis ⟂ B-axis | perpendicularity 0.01 over 100 mm | |
| Worm axis height to wheel mid-plane | from the layout | ±0.02 |
| Clamp ring seat | from the clamp supplier (typ. H6) | coaxial to B Ø0.01 |
| Tapped holes | M8 / M10 / M12 – 6H (ISO 965-1); thread engagement in GJL ≥ 1.5 · d for 10.9 screws (rule of thumb – check with VDI 2230) | |
| Other machined surfaces | Ra ≤ 6.3; sealing faces Ra ≤ 1.6 | |
| Casting | EN-GJL-300; no porosity at seats (X-ray / ultrasonic at the bearing seat); general casting tolerances per ISO 8062-3 (agree grade with foundry) | |

Measuring plan housing: CMM at 20 °C ±1 after ≥ 12 h soak – bearing seat size and form, seat face
perpendicularity, both worm bores (size, coaxiality), **centre distance**, perpendicularity worm/B-axis,
worm height; flatness of A on a surface plate or CMM. CMM uncertainty must be ≤ 1/4 of the ±0.010 →
U ≤ 2.5 µm (check the CMM's MPE in its acceptance certificate).

Cutting data housing GJL-300 (example, carbide K grades): face milling vc 180–250 m/min, fz 0.15–0.25 mm,
ap 2–4 rough / 0.3 finish; rough boring vc 120–150, f 0.15–0.25 mm; fine boring vc 150–200, f 0.05–0.10,
ap 0.1–0.2; drilling vc 80–100, f 0.2–0.3; tapping M10 vc 10–15.

Fixture: rough on 3 cast datum pads (ISO 5459 datum targets, agreed with the foundry); after face A is
ground, finish on A + 2 bored locating holes (one round pin, one diamond pin). Clamp **above the
supports** only – a clamp between supports bends the housing and the "ground" face is no longer flat when
unclamped.

### 11.6 Table top + hub sleeve – drawings VC-HMC-RT-0012 / -0013 (example allocation)

| Feature | Requirement (example) |
|---|---|
| Bearing face, sleeve spigot, wheel spigot, clamp disc face, scale seat | turned in ONE set-up; run-out between all seats 0.005 |
| 4 zero-point module bores | position **Ø0.02** to the table axis and face (note: ±0.01 in X and Y is a square zone 0.02 × 0.02; a position tolerance Ø0.02 is a circle inside it – slightly stricter); fit from the module supplier |
| Top + module faces (after assembly, ground in the own bearing) | flatness 0.005; parallel to housing face A 0.01; module faces same height ±0.003 |
| Channels | deep drilled, plugged; pressure test 1.5 × p, no leak |
| Fastening to the bearing inner ring | screws and torque **exactly as in the bearing catalogue** (they are part of the bearing's rated accuracy) |

Cutting data GJS-600 (example): face milling vc 150–200 m/min, fz 0.12–0.20 mm; fine boring vc 120–160,
f 0.05–0.10.

### 11.7 Clamp ring + disc – drawings VC-HMC-RT-0014 / -0015 (example allocation)

| Feature | Requirement (example) |
|---|---|
| Thin wall | thickness ±0.02 all round (uneven wall = uneven clamping, table moves when clamping) |
| Clamp faces | parallel 0.005, Ra ≤ 0.4 |
| Material | 42CrMo4+QT, Rm 900–1 100 MPa |
| Test | 1.5 × p no leak; holding torque ≥ 3 000 N·m; angle change while clamping ≤ 1″ |

Cutting data 42CrMo4+QT (≈ 300 HB, example): rough turn vc 150–200, f 0.2–0.3; finish vc 200–230,
f 0.08–0.12, ap 0.2; the last cut on the thin wall with low cutting force (sharp insert, small ap) and
the ring clamped on its full face (no 3-jaw chuck – it deforms the ring into a triangle).

### 11.8 Worm cartridges + spacer ring – drawings VC-HMC-WRM-0018 / -0019 / -0020 (example allocation)

| Feature | Requirement (example) | Numeric limits |
|---|---|---|
| Cartridge OD in housing | Ø80 g5/h5 (sliding fit for assembly, example) | h5: 80.000 / 79.987 |
| Bearing seat fixed side (angular contact pair, D = 52 example) | Ø52 H5 (or as the bearing catalogue requires) | 52.013 / 52.000 |
| Coaxiality bearing seat ↔ OD | Ø0.005 | |
| Spacer ring thickness | ground at assembly to the size from the backlash setting | ±0.002; parallel 0.002 |

### 11.9 Bolts and tightening torques

Tightening torque for ISO 4762 socket head cap screws, **μ_thread = μ_head = 0.12**, 90 % use of the yield
strength, medium clearance hole (calculated with the VDI 2230 method – values agree with the common tables
within about 2 %; check with your screw supplier):

| Size | Pitch | Class 10.9: preload / torque | Class 12.9: preload / torque |
|---|---|---|---|
| M6 | 1.0 | 15.0 kN / 15.4 N·m | 17.5 kN / 18.0 N·m |
| M8 | 1.25 | 27.4 kN / 37 N·m | 32.0 kN / 44 N·m |
| M10 | 1.5 | 43.5 kN / 73 N·m | 50.9 kN / 85 N·m |
| M12 | 1.75 | 63.3 kN / 125 N·m | 74.1 kN / 147 N·m |
| M16 | 2.0 | 119 kN / 308 N·m | 139 kN / 360 N·m |
| M20 | 2.5 | 186 kN / 602 N·m | 218 kN / 704 N·m |

Rules: use a calibrated torque wrench (ISO 6789); tighten crosswise in 3 stages (30 / 70 / 100 %);
lightly oiled threads (μ ≈ 0.12) – dry or with MoS2 paste the friction is different and the torque must
change; under 12.9 heads on cast iron or bronze use hardened washers (surface pressure); bearing screws
exactly per bearing catalogue.

### 11.10 Lubricants and surface protection

| Item | Specification (example – confirm with gear and bearing supplier) |
|---|---|
| Worm gear | gear oil ISO VG 220–460 (ISO 3448), for worm gears with bronze wheels (e.g. category CLP / CLP PG per DIN 51517-3 or worm gear oils per ISO 12925-1 – check); polyglycol oils: check compatibility with seals, paint and the bronze; do not mix with mineral oil |
| Main bearing | grease or oil exactly per the bearing maker |
| Hydraulics | ISO VG 32 or 46 hydraulic oil (as the clamp and rotary union suppliers specify) |
| Housing inside | oil-resistant primer; mask all fits and seats |
| Housing outside | primer + top coat |
| Ground surfaces in storage | corrosion protection oil, VCI bag |
| Worm / wheel shipping | protection oil, VCI bag, box, part record inside |

### 11.11 Drawing notes – template (copy, then adapt)

```
1  General tolerances ISO 2768-mK. Tolerancing ISO 8015.            [example]
2  Dimensions in mm at 20 °C (ISO 1).
3  Surface texture ISO 21920-1, λc = 0.8 mm unless stated. Unspecified Ra 3.2.
4  Edges ISO 13715: external −0.2…−0.5, internal +0.2. No burrs.
5  Material: 16MnCr5 (1.7131) EN 10084, +FP. Certificate EN 10204-3.1.
6  Heat treatment (ISO 15787): case hardened and tempered.
   Surface 58–62 HRC; CHD 550 HV1 = 0.90–1.25 mm before grinding, ≥ 0.6 after grinding;
   core 30–42 HRC. Areas marked ▬▬ (end thread) stay soft (masked).
7  Ground surfaces free of grinding burn; nital etch inspection per ISO 14104, 100 %.
8  Crack test magnetic particle (ISO 9934-1), 100 %, no indications. Demagnetise ≤ 0.3 mT.
9  Centre holes DIN 332-1 form B 3.15/10 both ends, must remain.
10 Worm and wheel are a matched pair; mark pair no. Do not exchange singly.
11 Mark by laser on the end face (annulus around the centre hole, motor-journal end):
   part no. + rev, serial no. WRM-…, pair no. P-…, Data Matrix.
12 Measure the gear data on a gear measuring machine; report with the part record.
```

---

---

## 12. Identification and numbering

The **project-wide scheme** is defined in `15_numbering_and_identification.md`. This chapter applies it to
the rotary table and the worm drive. The drawing-number allocation below (which part gets which 4 digits)
is an **example**; if guide 15 or the drawing register says otherwise, **guide 15 wins**.

### 12.1 Drawing numbers and part numbers

Format `VC-<area>-<group>-<4 digits>-<revision>`; area `HMC`, groups `RT` (rotary table) and `WRM` (worm and
wheel). **MAKE part number = drawing number without the revision** (the revision is a separate field in
ERP/BOM).

| Drawing no. (example) | Part number | Part |
|---|---|---|
| VC-HMC-RT-0001-A | VC-HMC-RT-0001 | Rotary table – main assembly |
| VC-HMC-RT-0010-A | VC-HMC-RT-0010 | Housing |
| VC-HMC-RT-0012-B | VC-HMC-RT-0012 | Table top (the example drawing of guide 15) |
| VC-HMC-RT-0013-A | VC-HMC-RT-0013 | Hub sleeve |
| VC-HMC-RT-0014-A / -0015-A | VC-HMC-RT-0014 / -0015 | Clamp ring / clamp disc |
| VC-HMC-RT-0016-A | VC-HMC-RT-0016 | Labyrinth cover |
| VC-HMC-WRM-0011-A | VC-HMC-WRM-0011 | Duplex worm (the example drawing of guide 15) |
| VC-HMC-WRM-0014-A | VC-HMC-WRM-0014 | Worm wheel assembly (rim + hub) |
| VC-HMC-WRM-0015-A / -0016-A | VC-HMC-WRM-0015 / -0016 | Worm wheel rim / hub |
| VC-HMC-WRM-0018-A / -0019-A | VC-HMC-WRM-0018 / -0019 | Worm cartridge fixed / floating |
| VC-HMC-WRM-0020-A | VC-HMC-WRM-0020 | Spacer ring (ground to size at assembly) |
| R-BAR-00065 | – | Raw material: bar Ø65, 16MnCr5 1.7131 (guide 15 example) |
| B-BRG-…, B-SCR-… | – | Bought bearings, screws (BUY numbers) |

Revisions (guide 15, 3.3): drafts 0.1, 0.2 …; first release A; every released change = next letter;
letters **I, O, Q, S, X, Z are not used** (sequence A B C D E F G H J K L M N P R T U V W Y). A change of
form, fit or function (old part no longer interchangeable) = **new drawing number**, not a new letter. The
lock-nut thread correction of the worm (11.3) changes the fit of the nut → decide with guide 15, 3.3,
whether it is a new revision or a new number.

### 12.2 Serial numbers and matched pairs

Format `<type>-<YYWW>-<5 digits>`; YYWW = ISO year + ISO week when the serial is assigned; the 5-digit
sequence **restarts at 00001 every ISO week, separately for each type**.

| Type | Part | Example | Marked where |
|---|---|---|---|
| WRM | Duplex worm | WRM-2546-00017 | end face, laser (annulus around the centre hole) |
| WHL | Worm wheel | WHL-2546-00009 | hub face, laser |
| P | **Matched pair** worm + wheel | P-2546-00004 = WRM-2546-00017 + WHL-2546-00009 | both parts carry their own serial **and** the pair number |
| RT | Rotary table assembly | RT-2546-00002 | type plate |

Add a **Data Matrix code** with the same text (guide 15, 3.16). Optional Luhn check digit for hand entry:
WRM-2546-00017 → WRM-2546-00017-1 (guide 15, 3.6).
The twin's short serials map to the real scheme: **W-0001 → WRM-YYWW-nnnnn, P-0001 → P-YYWW-nnnnn**.

### 12.3 NC programs

Format `O<p><k><oo>` (guide 15, 3.14): p = product family (**5 = factory equipment parts** such as the
HMC), k = part, oo = operation / 10. File name on the DNC server:
`<part number>_<OP>_<machine type>_<drawing rev>`. The header comment repeats part number, drawing revision,
program version (MAJOR.MINOR.PATCH), author and date (ISO 8601).

| Op (worm) | O-number (example – k = 5 assumed for the worm; confirm the k value in the guide 15 register) | File name (example) |
|---|---|---|
| Op 20 face + centre | O5502 | VC-HMC-WRM-0011_OP20_LATHE_A.nc |
| Op 30 rough turn | O5503 | VC-HMC-WRM-0011_OP30_LATHE_A.nc |
| Op 40 thread whirling | O5504 | VC-HMC-WRM-0011_OP40_LATHE_A.nc |
| Op 70 cylindrical grinding | O5507 | VC-HMC-WRM-0011_OP70_GRIND_A (grinder's own format) |
| Op 80 thread grinding | O5508 | VC-HMC-WRM-0011_OP80_WGRIND_A (grinder's own format) |

Example header (Fanuc-type lathe):

```
O5503 (VC-HMC-WRM-0011 REV A OP30 ROUGH TURN)
(PROGRAM V1.2.0  AUTHOR XY  2026-11-11)
(MATERIAL 16MNCR5 1.7131 +FP  BLANK D65 X 222)
```

On Siemens controls the program name may carry the same text with underscores
(`VC_HMC_WRM_0011_OP30.MPF`) – hyphens are often not allowed (check your control). The **duplex leads**
(12.466 / 12.666 mm) are part of the Op 40 and Op 80 programs; every change of these numbers = new program
version + release by quality (the "duplex" fault of the twin).

### 12.4 Tools, gauges, heats, lots, furnace charges

| Object | Format (guide 15) | Example for the worm |
|---|---|---|
| Tool | `T<family><nnn>`, physical assembly `-nn` | T7001 roughing tool, T7001-02 its sister tool; T9006 whirling ring; T8001 thread grinding wheel |
| Gauge | `GA-<type>-<4 digits>` | GA-MIC-0012 micrometer; GA-RNG-0007 setting ring Ø25.006 for the air gauge; proposed new type codes (add them to guide 15): GA-AIR-0003 air gauge Ø25 k5, GA-WIR-0001 wire set Ø6.686, GA-HRD-0001 Rockwell/Vickers tester, GA-GMM-0001 gear measuring machine |
| Heat number | exactly as on the EN 10204 3.1 certificate | H41137 (stamped on every blank at Op 10) |
| Own material lot | `LOT-<item prefix>-<YYWW>-<3 digits>` | proposal for the bar item prefix: `LOT-BAR65-2546-001` (one delivery, one heat – confirm the prefix in guide 15) |
| Work order (lot of 20 worms) | `WO-<YYWW>-<4 digits>` | WO-2546-0007 |
| Furnace charge + coupon (proposal – not yet in guide 15) | `HT-<YYWW>-<4 digits>`, coupon `-C1` | HT-2546-0003, coupon HT-2546-0003-C1 |

Every measured value in the part record stores the **gauge ID**. If a gauge is later found out of
tolerance, you know which worms to re-check.

Traceability chain in the part record:
`WRM serial → heat no. + 3.1 certificate → own lot → work order → furnace charge + coupon result →
NC program + version per op → gauge IDs → measured values → pair no. → rotary table serial RT-…`

---

## 13. Standards

Full register: `16_standards_register.md`. The table lists only standards whose number and subject we are
sure of. **Always read the current edition** – clause numbers and limit tables change between editions.
"Value used" = the example value of this guide.

| Standard | Title (short) | What it requires (simplified) | Value used here | How we verify |
|---|---|---|---|---|
| ISO 1 | GPS – standard reference temperature | dimensions are defined at 20 °C | all sizes at 20 °C | soak parts, measuring room 20 ±1 °C |
| ISO 286-1 / -2 | ISO code system for tolerances on linear sizes | IT grades + fundamental deviations → limits | Ø25 k5 = +0.002/+0.011; Ø20 h6 = 0/−0.013; Ø58 h8 = 0/−0.046; Ø300 H6 = +0.032/0; Ø310 H7/s6 | gauge plan 11.3 |
| ISO 1101 | Geometrical tolerancing | symbols and tolerance zones for form, orientation, location, run-out | run-out 0.003 to A–B; flatness 0.005; ⟂ 0.003 | CMM, inductive probe |
| ISO 5459 | Datums and datum systems | how datums and datum targets are defined | A–B common axis; cast datum targets | drawing check |
| ISO 8015 | GPS fundamentals | independency principle is the default | note on drawing | drawing check |
| ISO 2768-1 / -2 | General tolerances | tolerances for features without individual tolerance (f, m, c, v / H, K, L) | ISO 2768-mK (example) | drawing check; check also ISO 22081 (newer general specifications) |
| ISO 21920-1 (-2, -3) | Surface texture: profile – indication, parameters, specification operators | replaces ISO 1302 (indication), ISO 4287 and ISO 4288; new default rules | Ra 0.4 flanks/seats, λc 0.8 stated | stylus instrument |
| ISO 13715 | Edges of undefined shape | how edge breaks / burr-free edges are specified | −0.2…−0.5 | visual + gauge |
| ISO 965-1 | ISO general purpose metric threads – tolerances | 6H / 6g tolerance classes | M…-6H / 6g | thread gauges |
| DIN 332-1 | Centre holes 60° | forms R, A, B, C and sizes | form B 3.15/10 | blue-paint contact ≥ 80 % |
| DIN 509 | Undercuts (relief grooves) | form + size by diameter | form F (check size table) | drawing check |
| DIN 3975-1 (-2) | Cylindrical worm gears – terms and definitions (geometry), deviations | worm geometry terms, flank forms ZA, ZN, ZI, ZK | m 4, z1 1, d1 50, γ 4.574°, flank form to decide | drawing check |
| DIN 3974-1 / -2 | Accuracy of worm gears | accuracy classes and tolerances for pitch, lead, profile, run-out | class 5 (example); our limits in 11.3 | gear measuring machine |
| DIN 3996 | Load capacity of cylindrical worm gears | wear, pitting, root, temperature, deflection checks | not yet done – Bach rule used (10.4) | calculation to be made |
| ISO/TS 14521 | Calculation of load capacity of worm gears | international counterpart to DIN 3996 | as above | as above |
| ISO 14104 | Gears – surface temper etch inspection after grinding (chemical method) | etch procedure and classification of grinding burn | 100 % nital etch | Op 90 |
| EN 10084 | Case hardening steels | chemical composition, hardenability, delivery conditions (+A, +FP …) | 16MnCr5 1.7131 +FP | 3.1 certificate |
| EN 10083-2 / -3 | Steels for quenching and tempering (non-alloy / alloy) | composition, Rm/Rp0.2 by ruling section | C45 1.0503; 42CrMo4 1.7225 | 3.1 certificate, hardness |
| ISO 683-17 | Ball and roller bearing steels | 100Cr6 composition and conditions | spacer ring | certificate |
| EN 1561 / EN 1563 | Grey cast iron / spheroidal graphite cast iron | grades by tensile strength (or hardness) | EN-GJL-300, EN-GJS-600-3 | test bars + hardness |
| EN 1982 | Copper and copper alloys – ingots and castings | grades (CuSn12Ni2-C = CC484K), casting method codes (GS, GZ …), properties | CuSn12Ni2-C-GZ | certificate |
| EN 10204 | Inspection documents | 3.1 = values measured by the manufacturer, signed by his independent inspector | 3.1 for all steels and castings | goods receipt |
| ISO 6508-1 | Rockwell hardness test | test method (HRC: 150 kgf diamond cone) | 58–62 HRC, core 30–42 HRC | Op 60 |
| ISO 6507-1 | Vickers hardness test | test method (HV1 = 9.807 N) | HV1 traverse | coupon |
| ISO 6506-1 | Brinell hardness test | test method | castings, +FP bar | goods receipt |
| ISO 18203 | Steel – determination of the thickness of hardened layers | CHD = depth to 550 HV (default limit) | CHD 0.90–1.25 mm before grinding | coupon traverse |
| ISO 18265 | Metallic materials – conversion of hardness values | conversion tables (approximate) | 550 HV ≈ 52 HRC | – |
| ISO 15787 | Heat-treated ferrous parts – presentation and indications on drawings | how to write the heat treatment on the drawing | note 6 in 11.11 | drawing check |
| ISO 9934-1 | Magnetic particle testing – general principles | method for surface cracks | 100 % after hardening | Op 50 |
| ISO 4762 | Hexagon socket head cap screws | dimensions | M6–M20 | – |
| ISO 898-1 | Mechanical properties of fasteners – bolts, screws, studs | property classes 8.8, 10.9, 12.9 (Rm, Rp0.2) | 10.9 / 12.9 | screw certificate |
| ISO 6789 | Hand torque tools | requirements + calibration of torque wrenches | torques of 11.9 | calibration certificate |
| ISO 281 / ISO 76 | Rolling bearings – dynamic load ratings and rating life / static load ratings | L10 = (C/P)^p; S0 = C0/P0 | L10h ≈ 127 000 h (example) | calculation |
| ISO 3448 | Industrial liquid lubricants – ISO viscosity classification | VG = kinematic viscosity at 40 °C | VG 220–460 | oil data sheet |
| ISO 14253-1 | Decision rules for verifying conformity | reduce the tolerance by U to prove conformance | Ø25 k5 guard band 0.8 µm | measuring plan |
| ISO 230-1 / -2 | Test code for machine tools – geometric accuracy / positioning accuracy and repeatability of NC axes (incl. rotary axes) | test procedure, evaluation of A, R, B | A ≤ 5″, R ≤ 2″ (example) | acceptance 5.9 |
| ISO 10791-1 / -4 / -7 | Test conditions for machining centres – geometric tests (horizontal spindle) / positioning of linear and rotary axes / finished test piece | geometry checks, positioning test conditions, test piece | table top 0.005 mm; B-axis positioning | acceptance 5.9 |
| ISO/IEC 16022 | Data Matrix bar code symbology | code structure | serial marking | scanner check |

Guidelines that are not standards but are used: VDI 2230 Part 1 (bolt calculation), AIAG MSA manual / VDA 5
(gauge capability), DIN 7190-1 (interference fit calculation – it is a DIN standard).

---

## 14. Complete worked example: worm WRM-2546-00017 from bar to released part

Example worm of lot WO-2546-0007 (20 worms). Drawing VC-HMC-WRM-0011-A. Every measured value below is an
**example** that shows how to calculate and decide; your real worms give your real values.

### 14.1 Material – Op 10

| Step | Value | Decision |
|---|---|---|
| Certificate 3.1, heat H41137 | C 0.17 %, Mn 1.15 %, Cr 0.95 % (EN 10084 for 16MnCr5: C 0.14–0.19, Mn 1.00–1.30, Cr 0.80–1.10) | ✓ |
| Hardness of the bar | 165 HB (+FP: 140–187 HB) | ✓ |
| Blank | Ø65 × 229.4 mm (229 ±1); mass π/4 · 6.5² · 22.94 · 7.85 g/cm³ = 5.98 kg | ✓ heat no. stamped |

### 14.2 Face + centre – Op 20

Length measured 222.04 mm (222 ±0.1 ✓). Centre holes DIN 332 B 3.15/10 both ends, blue-paint contact
85 % (≥ 80 % ✓).

### 14.3 Rough turn – Op 30 (with the physics of chapter 10 / guide 08)

| Quantity | Calculation | Result |
|---|---|---|
| Spindle speed at Ø65 | 1000 · 200 / (π · 65) | 979 rpm |
| Chip thickness (κ = 95°) | h = f · sin κ = 0.3 · 0.996 | 0.299 mm |
| Specific cutting force (Kienzle, kc1.1 = 1 400 N/mm², mc = 0.30 – typical for 16MnCr5) | kc = 1 400 · 0.299^−0.30 | 2 010 N/mm² |
| Cutting force | Fc = kc · ap · f = 2 010 · 2 · 0.3 | 1 206 N |
| Cutting power | Pc = Fc · vc / 60 000 = 1 206 · 200 / 60 000 | 4.0 kW (motor ≈ 4.0 / 0.8 = 5 kW) |
| Torque at Ø65 | Fc · 0.0325 m | 39 N·m |
| Theoretical roughness of the pre-finish cut (f = 0.15, r = 0.4) | Rth = f² / (8 r) = 0.0225 / 3.2 | 7.0 µm – OK before grinding |

Measured: seat A Ø25.62 (25.6 ±0.05 ✓), seat B Ø25.61 ✓, thread tip Ø58.58 (58.6 ±0.05 ✓).

### 14.4 Rough thread – Op 40 (whirling, two leads)

| Check | Calculation | Result |
|---|---|---|
| Soft over-wire M, middle | measured 60.452 mm; nominal 60.435 ±0.08 | deviation +17 µm ✓ |
| Grinding stock per flank from M | s = (M − M0) · sin 20° / 2 = (60.452 − 58.973) · 0.342 / 2 | **0.253 mm** (≥ 0.15 ✓) |
| M slope along the worm (4 positions) | measured 43.9 µm/mm; design Δp / (px · tan 20°) = 43.7 | +0.5 % ✓ (both leads are right) |

### 14.5 Case hardening – Op 50 (charge HT-2546-0003, 100 worms)

| Item | Value | Check |
|---|---|---|
| Programme | 925 °C 5 h, Cp 1.1 → 0.8 %; 840 °C → oil 60 °C; temper 180 °C 2 h | furnace chart filed under HT-2546-0003 |
| Predicted CHD (Harris) | 0.7 · 0.635 · √5 | 0.99 mm |
| Run-out after quench | 0.062 mm (> 0.04 → straighten; ≤ 0.15 so not scrap) | after straightening 0.024 mm (≤ 0.03 ✓) |
| Crack test (magnetic particle) | no indication | ✓ |

### 14.6 Test + centres – Op 60

| Item | Value | Limit | Result |
|---|---|---|---|
| Surface hardness (end face, HRC) | 60.5 HRC | 58–62 | ✓ |
| Core hardness (coupon section) | 37 HRC | 30–42 | ✓ |
| CHD 550 HV1 on coupon HT-2546-0003-C1 | 1.04 mm | 0.90–1.25 | ✓ (prediction 0.99 – good agreement) |
| Case depth left after grinding (flank) | 1.04 − 0.253 | ≥ 0.6 | **0.79 mm** ✓ |
| Centre holes re-ground, contact | 90 % | ≥ 80 % | ✓ |

### 14.7 Cylindrical grinding – Op 70 (air gauge GA-AIR-0003, master GA-RNG-0007, U = 0.8 µm)

| Feature | Measured | Limits | Conformance zone (limits reduced by U) | Result |
|---|---|---|---|---|
| Seat A Ø25 k5 | 25.0065 | 25.002 … 25.011 | 25.0028 … 25.0102 | ✓ |
| Seat B Ø25 k5 | 25.0058 | same | same | ✓ |
| Journal Ø20 h6 | 19.9935 | 19.987 … 20.000 | 19.9878 … 19.9992 | ✓ |
| Thread tip Ø58 h8 | 57.978 | 57.954 … 58.000 | – | ✓ |
| Seat run-out to A–B | 1.8 µm | ≤ 3 µm | – | ✓ |

### 14.8 Thread grinding – Op 80

| Item | Calculation | Value |
|---|---|---|
| Passes per flank | ⌈(0.253 − 0.02) / 0.03⌉ + 2 + 1 | 8 + 2 + 1 = 11 (22 total) |
| Work speed | vw = π · 50 · 30 / 60 | 78.5 mm/s |
| Specific removal rate | Q'w = 0.03 · 78.5 | 2.36 mm³/(mm·s) = 59 % of the limit 4 ✓ |
| Heat into the part (10.8 idea) | P' ≈ 40 J/mm³ · 2.36 | ≈ 94 W per mm contact width |
| Coolant temperature | 20.0 ±0.4 K during the cycle | thermal lead error ≤ 11.5·10⁻⁶ · 0.4 · 82 = 0.38 µm |
| Grinding time | 22 · 0.31 + 4 · 0.6 + 2.5 | 11.7 min |

### 14.9 Burn test – Op 90

Nital etch, all flanks uniform grey → no burn ✓ (operator + date in the record).

### 14.10 Inspection – Op 100 (after 2 h soak, room 20.1 °C)

| Characteristic | Measured | Limit | Result |
|---|---|---|---|
| fHβ L / R | +1.6 / −1.1 µm | ±4 | ✓ (opposite signs but small → Δp correct; same sign would point to temperature) |
| ffβ L / R | 1.2 / 1.4 µm | ≤ 3 | ✓ |
| Fα L / R | 2.8 / 3.3 µm | ≤ 5 | ✓ |
| Fr | 3.1 µm | ≤ 6 | ✓ |
| fpx max | 1.7 µm | ±3 | ✓ |
| M (middle), U = 2 µm | 58.985 (+12 µm) | ±25 → conformance ±23 | ✓ |
| Stock removed per flank (check) | (60.452 − 58.985) · 0.342 / 2 = 0.251 mm | ≈ 0.253 planned | consistent |
| M slope | 44.3 µm/mm | 43.7 ±10 % | ✓ (+1.4 %) |
| Ra flanks / seats | 0.26 / 0.22 µm | ≤ 0.4 | ✓ |

### 14.11 Test bench – Op 110 (master wheel, a = 205.000)

Backlash measured only up to 2.5 mm shift (correction in 4.16):

| Shift s (mm) | 0 | 0.5 | 1.0 | 1.5 | 2.0 | 2.5 |
|---|---|---|---|---|---|---|
| Backlash j (µm) | 50.8 | 42.9 | 34.9 | 26.8 | 19.0 | 11.1 |

Slope = (50.8 − 11.1) / 2.5 = **15.9 µm/mm** (design 15.9 ±10 % ✓). Shift for 8 µm:
(50.8 − 8) / 15.9 = **2.69 mm** (0.3 … 5 ✓). Jamming point s0 = 50.8 / 15.9 = 3.19 mm → margin 0.5 mm.

| Other bench checks | Measured | Limit |
|---|---|---|
| f'i / F'i | 1.9″ / 4.2″ | ≤ 3″ / ≤ 6″ ✓ |
| Contact pattern L / R | 8 % / 11 % off centre | ≤ 15 % ✓ |
| Run-in: P_loss = 314 · (1/0.72 − 1) = 122 W → ΔT ≈ 122 / 12 | 10.2 K measured | ≤ 15 K ✓ |
| Efficiency at the end | 72 % (theory 71 %) | info |
| Noise at 1 m | 63 dB(A) | ≤ 68 ✓ |

### 14.12 Finish – Op 120 and pairing

Residual magnetism 0.18 mT (≤ 0.3 ✓). Laser mark on the end face: `VC-HMC-WRM-0011 A`, `WRM-2546-00017`,
`P-2546-00004` + Data Matrix. Pair: WRM-2546-00017 + WHL-2546-00009 = **P-2546-00004**. Part record closed:
verdict RELEASED.

### 14.13 At assembly – spacer ring (step 7, with the real wheel)

Gauge on the table edge r_g = 290 mm: x = 0.076 mm → j = 0.076 · 180 / 290 = **0.047 mm** at s = 0.
s = (0.047 − 0.008) / (0.2 / 12.566) = 0.039 / 0.0159 = **2.45 mm** → grind the spacer ring 2.45 ±0.002 mm
thicker (direction per drawing). Check at 4 table positions after assembly: 8.6 / 7.9 / 9.4 / 8.2 µm →
smallest 7.9 µm (≥ 5 ✓). Record spacer size and values in the RT-2546-00002 assembly record.

---

## 15. Data you still need

Honest list – without these the guide alone is **not** enough to release drawings:

| # | Data | From whom | Why |
|---|---|---|---|
| 1 | Real cutting load spectrum of the HMC (forces, radii, % time, simultaneous 4-axis or not) | process planning, CAM | decides worm size, servo, clamp |
| 2 | Full worm gear load capacity calculation (DIN 3996 / ISO/TS 14521): wear, pitting, root, temperature, deflection | design or worm gear maker | the Bach rule is only a first check (10.4) |
| 3 | Flank form (ZK / ZI / ZA / ZN), pressure angle definition (axial or normal), exact over-wire formula for that form | grinding machine + hob maker | the axial-section M formula is an approximation |
| 4 | DIN 3974 tolerance values for the chosen class at m 4, d2 360 | DIN 3974-2 (buy it) | our limits are examples |
| 5 | Bearing catalogue data: main bearing (C, C0, tilting stiffness, screws + torques, housing fits), worm bearings (C, preload, fits) | bearing supplier | fits and L10 in 10.5 / 11.8 are examples |
| 6 | Clamp ring data (holding torque vs pressure, seat fits, stiffness) | clamp supplier | |
| 7 | Encoder mounting tolerances (scale run-out, head gap, accuracy class) | encoder supplier | |
| 8 | Servo + brake: full torque budget (acceleration + bearing + seal + clamp drag + cutting while turning) | design + servo supplier | 0.4 kW is too small for cutting while turning (10.2) |
| 9 | Friction μ(vs) of your worm/bronze/oil pair | oil supplier, DIN 3996 curves, bench tests | efficiency, self-locking, heat |
| 10 | Real casting properties: hardness range of GJL-300 in the actual wall thickness, porosity limits | foundry | 11.5 |
| 11 | Heat-treatment parameters of YOUR furnace (time–CHD curve, distortion, retained austenite) | heat treater, coupon trials | Harris rule is a rule of thumb (10.7) |
| 12 | Real Q'w burn limit and dressing interval | grinding trials + nital etch | 4 mm³/(mm·s) is an example |
| 13 | Gauge capability (%GRR) for Ø25 k5, M, lead | MSA study on your gauges | decides guard bands (10.9) |
| 14 | Shrink-fit calculation of the bronze rim (DIN 7190), or bolted rim design | design | Ø310 H7/s6 is an example |
| 15 | Layout check of the worm: lock-nut position (fixed side), undercut sizes, thread position tolerance | design | 11.3 note |
| 16 | Oil choice (mineral / PAO / PG), compatibility with seals and paint, change interval | oil supplier | 11.10 |
| 17 | Acceptance limits for the B-axis agreed with the machine customer (A, R, B, thermal) | contract / ISO 230-2 | 5.9 limits are examples |
| 18 | Thermal behaviour of the table (warm-up, worm vs housing temperature) | run-in measurements | backlash margin (10.6) |
| 19 | O-number k value and new gauge type codes (AIR, WIR, HRD, GMM) and furnace-charge ID | guide 15 owner | 12.3 / 12.4 |
| 20 | Current editions of all standards in chapter 13 | standards purchase | limits and clause numbers |

---

## 16. Glossary

| Term | Simple meaning |
|---|---|
| HMC | Horizontal machining centre: spindle is horizontal, the part sits on a rotary table |
| B-axis | The rotary table axis of the HMC (turns around the vertical axis) |
| Worm | Screw-like gear shaft; the motor drives it |
| Worm wheel | Gear with teeth that mesh with the worm; bolted under the table |
| z1, z2 | Number of worm starts, number of wheel teeth |
| i | Ratio = z2 / z1 (90 → 1:90) |
| m | Axial module (size of the teeth), mm |
| px | Axial pitch = π · m (distance between threads along the worm) |
| pz | Lead = z1 · px (axial travel per worm turn) |
| d1, d2 | Pitch diameters of worm and wheel |
| a | Centre distance between worm axis and wheel axis |
| γ | Lead angle of the worm |
| ρ' | Friction angle = atan(μ / cos 20°) |
| μ | Friction coefficient |
| η | Efficiency |
| Self-locking | The wheel cannot turn the worm backwards (only if γ ≤ ρ') |
| Duplex worm | Worm whose left and right flanks have different leads; thread gets thicker along the worm; axial shift sets backlash |
| Δp | Lead difference between left and right flank (example 0.2 mm) |
| Backlash j | Free play between the teeth, measured at the wheel pitch circle |
| Contact pattern | The mark left by marking paste on the wheel tooth; shows where the teeth touch |
| Shim / spacer ring | Ground ring that sets an axial position |
| Axial-radial bearing | One bearing that takes axial load, radial load and tilting moment |
| Tilting moment M_k | Moment that tries to tilt the table (force × height) |
| C0a | Static axial load rating of the bearing |
| Clamp ring | Hydraulic thin-wall ring that presses on a disc to lock the table |
| Angle encoder | Measures the table angle directly (scale ring + read heads) |
| ″ (arc second) | 1/3600 degree; 1″ at 250 mm radius ≈ 1.2 µm |
| Eccentricity | Scale ring centre not on the axis |
| Rotary union | Passes oil and air into a turning part |
| Zero-point module | Quick pallet clamping module |
| Fp | Cumulative pitch error of the wheel |
| fHβ | Lead slope deviation of a flank (µm over the evaluation length) |
| ffβ | Lead form deviation (waviness after removing the slope) |
| Fα | Total profile deviation of a flank |
| Fr | Runout of the thread (ball in the gaps around the worm) |
| fpx | Single axial pitch deviation |
| f'i, F'i | Single-flank (tooth-to-tooth / per worm turn) and total transmission error on the bench |
| Over-wire size M | Size measured over 3 wires placed in the thread gaps |
| dw | Wire diameter ("best wire" touches the flank at the pitch line) |
| Case hardening / carburising | Carbon is diffused into the surface at 925 °C, then quenched: hard surface, tough core |
| CHD | Case hardening depth: depth where hardness falls to 550 HV |
| HRC, HV1 | Rockwell C hardness; Vickers hardness with 1 kgf load |
| Coupon | Small test piece of the same steel in the same furnace charge, cut to measure CHD |
| Centre hole DIN 332 form B | 60° centre cone with a 120° protecting chamfer |
| Thread whirling | Thread cutting with a fast rotating ring of inserts around the slowly turning worm |
| Q'w | Specific material removal rate in grinding = ae · vw, mm³/(mm·s) |
| ae | Infeed (depth of cut) per pass |
| vw | Work (surface) speed of the worm |
| Grinding burn | Overheating while grinding; surface tempers soft or re-hardens brittle; invisible without etch |
| Nital etch | Etching with nitric acid in alcohol; burnt areas turn dark (ISO 14104) |
| Dressing | Re-shaping the grinding wheel profile with a diamond tool |
| Master wheel | Very accurate reference wheel used on the test bench |
| Transmission error | Difference between the real and the ideal wheel angle while the worm turns |
| Part record | All operations, settings and measured values of one part ("birth certificate") |
| Matched pair | Worm and wheel made and tested together, with the same pair number |
| Cpk | Process capability index; ≥ 1.33 = capable |
| Yield | Share of parts that pass every check |
| k5, h6, h8, H5, H6, J5 | ISO fit tolerance classes for shafts (lower case) and bores (upper case) |
| CMM | Coordinate measuring machine |
| ISO 230-2 | Test code for positioning accuracy and repeatability of NC axes |
| ISO 10791-1 | Test conditions for horizontal machining centres (geometric tests) |
| DIN 3974 | Accuracy of worm gears (tolerance classes) |
| ISO 10791-4 | Test conditions for machining centres – accuracy and repeatability of positioning of linear and rotary axes |
| Hertz contact stress p_H | Peak pressure where two curved surfaces touch (line or point contact) |
| L10 | Bearing life in million revolutions that 90 % of bearings reach: (C/P)^p |
| Martensite | Very hard steel structure made by fast quenching; carbon trapped in the iron lattice |
| Retained austenite | Austenite that did not change to martensite in quenching; soft and can change size later |
| Tempering | Re-heating after hardening (here 180 °C) to reduce stress and brittleness |
| Diffusion √(D·t) | Carbon penetration depth grows with the square root of time |
| Re-tempering / re-hardening burn | Grinding burn types: soft zone above the tempering temperature / brittle new martensite above ≈ 720 °C |
| Flank form ZA, ZN, ZI, ZK | Worm flank shapes (DIN 3975): straight in axial section, straight in normal section, involute helicoid, made by a conical disc |
| Abbe principle | Measuring error = offset from the scale line × tilt angle; measure in line with the scale |
| %GRR | Gauge repeatability & reproducibility as % of the tolerance (≤ 10 % good, > 30 % not acceptable) |
| Uncertainty U / guard band | Measurement doubt (k = 2); conformance is proven only inside the tolerance reduced by U (ISO 14253-1) |
| MAKE part number | Drawing number without revision (guide 15) |
| ISO 21920 | Current surface texture standard series (indication, parameters, operators); replaced ISO 1302, ISO 4287, ISO 4288 |
