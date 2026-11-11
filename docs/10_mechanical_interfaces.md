# 10 – Mechanical interfaces: AGV, crate stand, AS/RS front end, load station ↔ APC

> **Important – all numbers in this guide are EXAMPLES.**
> They are the default values of the twin pages. Before you make or buy anything, replace every number with data
> from **your AGV supplier, AS/RS supplier, machine builder, catalogues and your own measurements**.
> The pages show every formula with your numbers, so you can repeat each calculation.

Source files: `web/mech.js` (item 1), `web/mech2.js` (item 2), `web/mech3.js` (item 3), `web/mech4.js` (item 4).
The pallet data (size, masses, module pitch, APC radius, stroke, oil pressure, times, backlash, capture range) come **live** from the Pallet changer tab (`web/apc.js`, doc 09). Change them there first.

---

## Contents

- Part 0 – Overview, where in the twin, the key lessons (read this first)
- Item 1 – Pallet transfer AGV / manual cart ↔ APC load station
- Item 2 – Crate docking stand (underride AGV + forklift, V-guides, jib crane)
- Item 3 – AS/RS ↔ AGV front end (I/O conveyors, fence, light curtain, contour check)
- Item 4 – Load station ↔ APC (mounting, accuracy chains, interlocks, alignment)
- 9 – Corrections and clarifications
- 10 – Science principles for the interfaces
- 11 – Detailed manufacturing specification (interface parts)
- 12 – Identification and numbering
- 13 – Standards table
- 14 – Complete worked example: one cone-pin docking unit
- 15 – Data you still need
- 16 – Glossary (all items)

Each item has: 1 Purpose · 2 Where in the twin · 3 Concepts · 4 Calculations · 5 Manufacturing, installation, commissioning, tests · 6 Checklists · 7 Mistakes / lessons · 8 Limits.

---

# Part 0 – Overview

## 0.1 What the four items are

| Item | Interface | Accuracy needed | Main solution |
|---|---|---|---|
| 1 | machining pallet (510 kg) AGV / cart → APC load station | ±0.02 mm in the receivers (±0.005 mm later in the machine) | floating AGV deck + lift docking on 2 cone pins + machined stop faces, chain transfer, receivers with lead-in |
| 2 | crate with castings (203 kg) AGV / forklift → stand beside the station | ±5 mm (operator guides the casting with a crane) | 4 passive self-centring V-guides |
| 3 | crate AS/RS ↔ AGV | crane fork and AGV must fit; safety at the fence | 2 chain conveyors through a fence opening with muting light curtain, side V-flare at the AGV position |
| 4 | load station ↔ APC ↔ machine | new pallet into zero-point modules ±1 mm; finished pallet onto receivers ±3 mm | station bolted + dowelled to the APC base, error chain, interlocks, master pallet alignment |

## 0.2 Where in the twin

1. Start the twin (`README.md`) and open the browser page.
2. Click the tab **"Mechanical elements"** (hash `#mech`).
3. Choose the item with the 4 buttons at the top: "1 · Pallet transfer AGV / cart ↔ APC load station", "2 · Crate docking stand", "3 · AS/RS ↔ AGV interface", "4 · Load station ↔ pallet changer (APC) connection".
4. Item 1–3: 3D view (click a part → function, specification, material, MAKE/BUY, manufacturing notes), animation with Play and time slider, inputs, checks, calculations, BOM, guide. Item 4: 2D animation (top view + side section), tables, checks, calculations, BOM, guide.
5. "Example values" resets the inputs. Inputs are saved in the browser (`mechState`, `mech2State`, `mech3State`, `mech4State`).

Deep links (put before `#mech`):

| Item | Parameters | Example |
|---|---|---|
| select item | `mxitem=1…4` | `/?mxitem=3#mech` |
| 1 | `mxveh=agv|cart`, `mxtask=deliver|pickup`, `mxview=overview|dock|transfer|side|top`, `mxt=<s>`, `mxpart=<key>` | `/?mxveh=cart&mxtask=pickup&mxview=dock&mxt=6&mxpart=cpin#mech` |
| 2 | `cxveh=agv|fork`, `cxtask=deliver|pickup`, `cxview=overview|stand|jib|side`, `cxt`, `cxpart` | `/?mxitem=2&cxveh=fork&cxview=stand#mech` |
| 3 | `axtask=out|in`, `axview=overview|pd|fence|agv|top`, `axt`, `axpart` | `/?mxitem=3&axtask=in&axview=agv#mech` |
| 4 | `m4mount=base|floor`, `m4t=<s>` | `/?mxitem=4&m4mount=floor&m4t=6#mech` |

Related page: AGV tab, item 4 "docking accuracy" (`web/agvdock.js`) animates the error chains of items 1–3 step by step.

## 0.3 The key lessons (apply them to every interface)

1. **First ask: "What accuracy does the real vehicle / machine have?"** – before you design any interface. Get the number from the supplier in writing (stop accuracy x, y and angle; repeatability; under which floor conditions). An AGV typically stops only **±5–10 mm** and **±0.3–1°**. A forklift driver: **±30–50 mm**. A stacker crane: ±3 mm. A machine zero-point: ±0.005 mm after catching ±1 mm.
2. **Never push a vehicle sideways into position.** An AGV with differential drive cannot slide sideways. To push the loaded AGV (1160 kg) sideways you need F = μ_tyre·m·g = 0.6·1160·9.81 ≈ **6.8 kN** – the AGV jams, tyres scrub, the pin bends. A rigid pin + funnel on the AGV body is **wrong** (it is fine for a manual cart, whose castors move sideways).
3. **Move only a light part, with low friction, and let fixed parts decide the position.** Item 1: floating deck on ball transfer units (≈ 195 N instead of 6.8 kN = 35 × less), lift docking on 2 cone pins (1 round + 1 diamond), height from machined stop faces.
4. **Coarse-to-fine catching.** Each stage must fit into the catch range of the next stage: AGV ±13 mm → cone pins catch ±16 mm → deck ±0.4 mm → receivers catch ±3 mm → ±0.02 mm → zero-point catches ±1 mm → ±0.005 mm.
   - Catch range of a male cone in a chamfered bore: **K = r_b + c − r_t** (r_b = bore radius, c = 45° chamfer of the bore, r_t = tip radius of the cone). Example: Ø25 bore (r_b = 12.5 mm), chamfer c = 5.5 mm, tip r_t = 2 mm → K = 12.5 + 5.5 − 2 = **16 mm**.
   - A V-flare only centres if the part slides down it: the face angle from horizontal must be steeper than the friction angle, **θ > atan μ**. Example item 2: θ = atan(60/55) = 47.5°, atan 0.15 = 8.5° → margin 39° (page aims ≥ 20°).
5. **Not over-determined.** One round locator + one diamond / slot locator + the rest with clearance (receivers, pull studs, cone pins).
6. **Check every moving envelope in plan and height** – the APC swing circle, the APC base, the cross beams, the parts on the pallet, the AGV bumper. Lessons found in the twin:
   - APC base occupies x = −r ± (dm + 260)/2 = −480 ± 305 → **x = −785 … −175 mm** (station centre = 0). Station legs must be outside (they are at x = −80 and +150).
   - The APC cross beams sweep a radius of **≈ 360 mm** (√(190² + 305²) = 359 mm) and pass over the station receivers → cross beams **flattened to 45 mm**; clearance over the receivers when lifted = 10 mm.
   - With module pitch 400 mm on a 500 mm pallet there is no room for the chain strands outside the studs → strands run **between the studs** (z = ±140 mm).
   - Pallet + parts sweep circle (overhang 40 mm) reaches **≈ 8 mm into the docked AGV bumper** → the AGV must stop further away (+38 mm) or leave before every change.
7. **Error chains decide the mounting.** A floor frame (B) gives **1.21 mm > ±1 mm** zero-point catch → bolt and dowel the station to the APC base (A): 0.76 mm.
8. **Do the dynamics check.** The pallet on the APC fork rails: friction holds only **× 1.3** of the tangential arm acceleration – and only **× 0.76** when the centripetal acceleration ω²·r is included (§9.1) → **locating blocks** on the rails are required.

---

# Item 1 – Pallet transfer AGV / manual cart ↔ APC load station

## 1.1 Purpose

Bring a **500 kg class machining pallet** (example 110 + 400 = 510 kg) from an AGV with a lifting chain deck – or from a manual cart – onto the 4 locating receivers of the APC load station, exactly enough that the APC forks can pick it up and the zero-point modules can clamp it. And the same in reverse (pick up the finished pallet). A forklift is **not** used for machining pallets.

Principle (lift-and-transfer chain unit in the station):
AGV stops (±10 mm) → E84 handshake → deck lock pin opens, deck floats → deck lifts: 2 cone pins centre it, stop faces set its height → station chains rise (studs clear the receivers) → both chain conveyors run → pallet hits the retractable stop → station chains lower, studs drop into the receivers, seat check → E84 complete, AGV deck lowers, lock pin re-centres, AGV leaves.

## 1.2 Where in the twin

Tab **Mechanical elements → item 1**. Buttons: AGV / Manual cart; Deliver new pallet / Pick up finished pallet; views Overview, Docking, Transfer unit, Side (heights), Top; light curtain on/off; labels. Sections: 3D, step table, handshake signal diagram (E84 + sensors), floating-deck front view (AGV offset drawn 5 × larger), concept comparison table, interface drawings (side + plan), calculations, tolerance chains, checks, BOM, guide (interface sheet, make, install, tests, PLC interlocks, maintenance).

Part keys for `mxpart`: `tframe, anchor, post, receiver, liftframe, guide, liftcyl, chain, sprocket, gearmotor, stop, dpost, pin, dbracket, cpin, float, darm, shock, funnel, curtain, e84, panel, agv, deck, vchain, vguide, pawl, bush, groller, cart, latch, castor, pallet, ledge, stud, fixture, apc, wall`.

## 1.3 Concepts

| Concept | Explanation |
|---|---|
| Floating deck | Upper deck of the AGV on ball transfer units: moves ±20 mm in x and z and ±1° with very low force. 4 centring springs + a conical lock pin keep it centred while driving. |
| Lift docking | While the deck lifts, 2 cone pins hanging from station brackets enter 2 bushes on the deck and push the deck into position. |
| Stop faces | Machined underside of the station brackets. The deck pushes up against them (example 600 N, motor torque limit) → deck chain height = station chain height, without a sensor. |
| Retractable stop | Stops the pallet over the receivers; goes **down** before the APC turns. |
| Locating receivers | Hardened bushes with 15° lead-in (catch ±3 mm); 1 round, 1 slot, 2 with clearance. Centre to ±0.02 mm, no clamping. |
| Protective guide rails | Do **not** centre the AGV. Only stop an AGV far off its path and guide the manual cart. |
| E84 / PIO | Optical 8-bit parallel I/O handshake between AGV and station (VALID, CS_0, L_REQ/U_REQ, TR_REQ, READY, BUSY, COMPT, HO_AVBL, ES). |
| Manual cart | Back-up when no AGV: fixed deck at transfer height, free rollers, docking pin + over-centre latch. Its castors move sideways, so a rigid pin works here. |

Concept comparison (from the page, correcting ±13 mm):

| Concept | Force | Result | Verdict |
|---|---|---|---|
| Rigid pin on the AGV body | 6.8 kN; Ø30 pin bending 116 N/mm²; wheels cannot slide | ±0.3 mm only if it works | ✕ – kept only for the manual cart |
| Better AGV navigation (fine positioning, omni wheels) | – | ±1–3 mm | ! expensive, dirt-sensitive, still not ±0.5 mm |
| Camera + servo X-Y table on the deck | small | ±0.3–0.5 mm | ! 2 axes, sensors, software, power on every AGV |
| **Floating deck + lift docking on 2 cone pins (chosen)** | 195 N sideways, 85 N push-up on the cones | ±0.4 mm sideways, ±1.1 mm height | ✓ passive, no sensor, common practice |
| Floating transfer unit on the station | small | good | ! station must stay exact to the APC – not chosen |

## 1.4 Design calculations (example values)

### Inputs

| Group | Input | Example |
|---|---|---|
| AGV | empty mass / slow-zone speed / docking speed | 650 kg / 0.3 m/s / 0.05 m/s |
| | deck height driving / deck lift speed / E-stop deceleration | 650 mm / 80 mm/s / 1.0 m/s² |
| | stop accuracy / angle accuracy | ±10 mm / ±0.5° |
| Floating deck | float range / deck mass / ball friction / spring rate | ±20 mm / 150 kg / 0.01 / 10 N/mm |
| | cone pin Ø / push-up force / tyre friction | 25 mm / 600 N / 0.6 |
| Chains | speed / acceleration / running resistance / static friction | 0.2 m/s / 0.3 m/s² / 0.1 / 0.15 |
| | sprocket teeth / gap station ↔ AGV chain | 17 / 60 mm |
| Station lift | frame mass / lift time / clearance under studs | 120 kg / 1.0 s / 10 mm |
| Docking + floor | shock absorber stroke / buffer height / cart pin Ø | 25 mm / 300 mm / 30 mm |
| | anchors / allowed per anchor / allowed height step | 6 / 8 kN / ±3 mm |
| Manual cart | mass / wheelbase / worst stop | 160 kg / 900 mm / 1.5 m/s² |
| Cell timing | pool distance / AGV speed / hand-over at pool / machining | 35 m / 1.2 m/s / 20 s / 1380 s |
| From APC tab | pallet 500 × 500, 110 + 400 kg, hc 250, pitch 400, r 480, stroke 60, 6 MPa | |

Constants in the code: receiver top H0 = 1050 mm, pull stud length below the pallet LS = 44 mm, receiver radius 30 mm, pallet thickness 70 mm.

### Heights

| | Formula | Example |
|---|---|---|
| Transfer height (chain top) | Ht = H0 + LS + clearance = 1050 + 44 + 10 | **1104 mm** |
| Chains lowered | H0 − 10 | 1040 mm |
| Station lift stroke | 1104 − 1040 | **64 mm** |
| Pallet CoG above pallet bottom | h = (mp·tp/2 + mw·(tp + hc))/m = (110·35 + 400·320)/510 | **259 mm** |

### Chain strands – where?

Outside the studs needs z_o − z_i ≥ 40 mm with z_i = pitch/2 + 30 + 10 = 240 and z_o = b/2 − 25 = 225 → no room. → **Between the studs** at z = ±(200 − 30 − 10 − 20) = **±140 mm**.

### Chain and drive

| | Formula | Example |
|---|---|---|
| Pull | F = m·(μ·g + a) (+ chain mass) = 510·(0.1·9.81 + 0.3) | **654 N** |
| Per strand | F/2·1.2 (uneven) | 393 N |
| Chain choice | start at 10B for pallets > 300 kg; safety on breaking load ≥ 10 (service factor 1.5); roller load ×2 impact ≤ allowed | **10B-1 (5/8")**: safety 22 200/(393·1.5) = **38**; 31 rollers under the pallet, 161 N each (allowed 350 N) |
| Sprocket | d0 = p/sin(180°/z) = 15.875/sin(10.6°) | 86.4 mm |
| Output speed | n = v·60/(π·d0) | **44 rpm** |
| Torque | T = F·d0/2 | **28.3 N·m** |
| Motor | P = F·v/η = 654·0.2/0.8 = 164 W; ×1.3 | **0.25 kW** gear motor, i ≈ 1400/44 = 32 |

### Transfer

| | Formula | Example |
|---|---|---|
| Travel | L = a + 40 + gap = 500 + 40 + 60 | 600 mm |
| Time | t = L/v + v/a + creep (0.02 m at 0.05 m/s) | **4.0 s** |
| No slip | μs·g/a = 0.15·9.81/0.3 | **4.9** (≥ 2) |
| No tipping | (a/2 ÷ h)/(acc/g) = (250/259)/(0.3/9.81) | **32** (≥ 3) |
| Stop force | m·v²/(2·3 mm) + μs·W = 510·0.05²/0.006 + 0.15·5003 | **963 N** → design ×1.5 = 1.44 kN |

### Station lift cylinder (oil from the APC unit)

F = (510 + 120)·9.81·1.25 = **7.73 kN**; D = √(4F/(π·p)) = √(4·7725/(π·6)) = 40.5 mm → **Ø50/28**, stroke 64 mm (real force 11.8 kN).
Flow Q = A·s/t = 1963·64/1.0 → **7.5 L/min** (APC pump 14.0 L/min – not at the same time as the APC lift).
Lowering: throttle to ≤ 20 mm/s in the last 10 mm so the pallet lands softly (average 64 mm/s). Mechanical end stops set the 2 heights, not the cylinder.

### Safety buffers, anchors, cart pin

| | Formula | Example |
|---|---|---|
| Total mass | AGV 650 + pallet 510 | 1160 kg |
| Normal creep energy | ½·m·v² = ½·1160·0.05² | 1.45 J |
| Fault (AGV at slow-zone speed) | ½·1160·0.3² | **52 J** → per absorber 52/2·1.25 = 33 J → 2 × **M25** (60 J/stroke) |
| Peak force | (E/2)/(0.85·stroke) = 26.1/(0.85·0.025) | 1.23 kN per absorber |
| Anchors | N = F·h/(lever·n/3) = 2456·300/(415·2) ; V = F/n | 0.89 kN tension, 0.41 kN shear → **11 %** of 8 kN |
| Cart pin side load | 0.15·m·g = 0.15·1160·9.81 | 1.71 kN |
| Cart pin bending | σ = 32·F·l/(π·d³), l = 1.5·d = 45 mm | **29 N/mm²** (allowed ~200) |

The AGV normally stops 40 mm before the buffers and never touches them (nominal bumper position 375 mm from the station centre; docked bumper face 335 mm).

### Stability

| | Formula | Example |
|---|---|---|
| AGV CoG at driving height | (650·250 + 510·(650 + 259))/1160 | 540 mm |
| Lever to front wheels | (650·810 + 510·600)/1160 − 445 | 273 mm |
| AGV tipping safety at E-stop | (lever/h·g)/a_brake | **5.0** (≥ 2) |
| Pallet on the AGV | (a/2 ÷ h)/(a_brake/g) = (250/259)/(1/9.81) | **9.5**; retention pawl 510·1.0·1.5 = 765 N |
| Manual cart CoG | (160·450 + 510·(1104 + 259))/670 | 1145 mm |
| Cart tipping safety | (lc/2 ÷ h·g)/a = (450/1145·9.81)/1.5 | **2.6** (≥ 2) |
| Manual push force | 0.03·W | 150 N (ergonomic ≤ 200 N) |

### AGV stop error → floating deck (the core calculation)

| | Formula | Example |
|---|---|---|
| Error at the pins | e = nav + z_pin·sin(yaw) = 10 + 350·sin 0.5° | **13.1 mm** |
| Cone lead-in | r ≥ e + 2 → ±16 mm; length = r/tan 15° | **60 mm** cone length (upper value – real cone 39 mm + 5.5 mm bush chamfer, and 264 N push-up on the chamfer, see §9.2) |
| Rigid pin (no!) | F = μ_tyre·m·g = 0.6·1160·9.81 | **6.8 kN** |
| Floating deck | F = μ_ball·(m_deck + m)·g + k·e = 0.01·660·9.81 + 10·13.1 | **195 N** (35 × less) |
| Push-up on the cone | Fv = F·(tan15° + μ)/(1 − μ·tan15°), μ = 0.15 | **85 N** (deck pushes 600 N; check: ≤ 50 % ok) |
| Spring return | x = F_friction/k = 64.7/10 | **6.5 mm** → springs alone do not centre → **conical lock pin**, lead-in ≥ ±20 mm |
| Float range check | float ≥ e + 2 → 20 ≥ 15.1 | ok |

### Tolerance chains

Height step between AGV chain and station chain (± mm):

| Contributor | Fixed deck | Height sensor | Deck on stop faces (chosen) |
|---|---|---|---|
| Floor flatness under AGV wheels | 2 | 0.5 | 0 |
| Tyre deflection empty ↔ loaded | 1.5 | 0 | 0 |
| AGV deck lift repeatability | 1 | 0.5 | 0 |
| Deck chain top ↔ deck reference | 0.5 | 0.3 | 0.2 |
| Height sensor + reference plate | 0 | 0.5 | 0 |
| Bracket stop faces (machined with station) | 0 | 0 | 0.1 |
| Station chain top (end stop) | 0.3 | 0.3 | 0.3 |
| Chain + guide wear | 1 | 0.5 | 0.5 |
| **Worst case (sum)** | **6.3** | **2.6** | **1.1** |
| Statistical RSS = √Σt² | 2.9 | 1.1 | 0.6 |

Allowed ±3 mm (with 5 mm × 30° chamfer on the pallet edges). Fixed deck fails, sensor is borderline, stop faces give ±1.1 mm mechanically.

Lateral (z), each stage catches the one before:

| Stage | ± mm | Caught by |
|---|---|---|
| AGV stop accuracy | 10 | floating deck (±20) |
| AGV angle ±0.5° at the pins | 3.05 | 2 pins (round + diamond) |
| Cone pin Ø25 g6 in bush H7, diamond pin | 0.05 | after docking |
| Pin position on bracket (machined) | 0.05 | |
| Bush ↔ deck chains (one setup) | 0.1 | |
| Deck chain guides | 0.2 | |
| **Deck chains to station chains** | **0.40** | receiver lead-in ±3 |
| Pallet seated in receivers | 0.02 | final ±0.005 by the zero-point modules |

### Clearances to the APC

| Check | Formula | Example |
|---|---|---|
| APC rails over receivers (turning, lifted) | rail bottom H0 − 50 + stroke − H0 = 1000 + 60 − 1050 | **10 mm** (ok ≥ 5) |
| APC rails over lowered station chains | 1060 − 1040 | **20 mm** |
| Studs leave the receivers when APC lifts | stroke − 5 − LS = 60 − 5 − 44 | **11 mm** (forks touch the ledges after 5 mm) |
| AGV deck side guides outside APC swing circle | √((r + a/2 + 20 + gap)² + (b/2 + 50)²) − Ø/2 = √(810² + 300²) − 833.6 | **30 mm** |
| Docking brackets outside swing circle | √((r + x_post − 30)² + (z_post − 30)²) − 833.6 | **25 mm** |

### Timing

Docking cycle (AGV, deliver): drive in 4.8 s + E84 1.5 s + deck lift 6.7 s + station lift 1.0 s + transfer 4.0 s + lower + seat 2.0 s + leave 3.5 s = **23.4 s**. Manual cart: 19.3 s.
Exchange per pallet = 2 dockings + 2 × 35 m / 1.2 m/s + 2 × 20 s = **145 s** vs machining 1380 s → AGV busy ≈ 10.5 % for this cell.

### Checks on the page (all green with the example)

Chain strength 38 · roller load 161/350 N · strands ±140 · no slip 4.9 · no tip 32 · float ±20 ≥ 13.1 · cone length 60 ≤ 80 · cone push 85 ≤ 300 N · lock pin re-centres (6.5 < 20) · height step ±1.1 ≤ 3 · brackets 25 mm outside swing circle · guide rails 20 mm per side · receivers catch ±0.40 ≤ 3 · rails over receivers 10 · over chains 20 · studs lift 11 · AGV deck 30 mm outside · AGV stable 5.0 · pallet on AGV 9.5 · anchors 11 % · cart pin 29 N/mm² · cart 2.6 · push 150 N · oil 7.5 ≤ 14.0 L/min · exchange 145 s ≤ 690 s.

## 1.5 Manufacturing, installation, commissioning

### Interface sheet – agree with the AGV supplier BEFORE any part is made

| Item | Value (example) |
|---|---|
| Pallet | 500 × 500 mm, 510 kg with load, CoG 259 mm above the pallet bottom, pull studs 44 mm below |
| Transfer direction | along the pallet ledges (x), AGV comes head-on to the load station |
| Transfer height (chain top) | 1104 mm (deck pushed against the station stop faces) |
| Driving height (chain top) | ≤ 650 mm |
| Chain strands | 2 × 10B-1, centre distance 280 mm, length 540 mm, 0.2 m/s, ramps 0.67 s |
| Free space under the pallet | 240 mm between the strands free up to 1050 mm (studs) |
| Pallet guides on the deck | side rails over the ledges, inner width 554 mm, retention pawl at the station end |
| AGV stop | bumper at 375 mm from the station centre, ±10 mm in x and z, ±0.5° – no contact with the station |
| Floating deck | ±20 mm (x, z) and ±1° on ball transfer units, 4 centring springs, conical lock pin closed while driving |
| Lift docking | 2 arms with bushes Ø25 H7 at z = ±350 mm, x = 395 mm; top faces = deck chain top + 40 mm; push-up 600 N (torque limit), creep for the last 50 mm |
| Speeds | slow zone ≤ 0.3 m/s, docking ≤ 0.05 m/s; shock absorbers take 52 J |
| Handshake | E84 optical I/O (VALID, CS_0, L_REQ/U_REQ, TR_REQ, READY, BUSY, COMPT, HO_AVBL, ES); transceiver at 760 mm, left side |
| Guide rollers | 4 × Ø60 at 200 mm (protection only – rails 760 mm apart) |

Note: the page's interface sheet text says "±0.5 (closed loop with the height sensor)" for the transfer height, while the chosen concept uses the stop faces (±1.1 mm worst case, no sensor). Agree the final wording with the AGV supplier.

### Main parts (MAKE / BUY) with notes

| Part | M/B | Material / spec (example) | Manufacturing / mounting |
|---|---|---|---|
| Station table | MAKE | S355J2 tube 60×50×4 and 70×70×5, stress relieved; top frame 870–920 mm; legs at x = −80 / +150 mm (outside the APC base), cantilever to x = −280 mm | Weld in a jig, anneal 580–620 °C, machine the 4 receiver pads + guide-column holes in ONE setup (flatness ≤ 0.05, holes ±0.02 mm, perpendicular 0.03/100). |
| Receiver pedestal (4) | MAKE | tube 70×70 + plate 20 mm, top at 1020 mm | Machine all 4 tops in one setup: same height ±0.02 mm. |
| Locating receiver (4) | MAKE/BUY | 16MnCr5 case-hardened 0.8–1.2 mm, 58–62 HRC, ground; Ø60, face at 1050 mm, 15° lead-in (catches ±3 mm) | 1 round bore (reference), 1 slot along x, 2 with +0.5 mm clearance. Air channel for the seat check. |
| Lift-transfer frame | MAKE | S355 C-profile 50×40 + cross beams; strands at ±140 mm | Machine both chain-guide seats in one setup: height ±0.1, parallel ±0.2 mm. |
| Chain guide strips (4) | MAKE | C45 induction hardened, 540 mm | Screw + pin; chamfer strip ends 2 × 30°. |
| Roller chain (4) | BUY | 10B-1 ISO 606, ≈ 1.28 m per strand | Sag 1–2 % of the free length; conveyor-chain oil. |
| Sprockets + shaft | BUY/MAKE | 4 × z17 C45 hardened teeth, shaft 42CrMo4, UCF bearings, tensioner | One shaft drives both strands (pallet cannot twist). Mark tooth phase; align ±0.2 mm. |
| Gear motor + brake + inverter | BUY | 0.25 kW, 44 rpm, 28 N·m, encoder, helical-bevel IE3 | Drives the shaft with a short 08B chain; ramp 0.67 s, creep 0.05 m/s at the end. |
| Guide columns + bushings (4) | BUY | Ø25 h6 hardened, flanged ball bushings | Press-fit; parallel ≤ 0.05 mm over the stroke. |
| Lift cylinder | BUY | ISO 6020-2 compact, Ø50/28 × 64, cushioning | + 4/3 valve + throttle on the APC manifold. |
| Retractable stop | BUY | heavy-duty conveyor stop with damper, 1.44 kN (for creep speed; ≥ 10 J damper if creep can fail, §9.5), stroke 104 mm (up top 1134, down 1030 mm), PU 90 Sh A, 2 sensors | PLC: APC rotation only with the stop DOWN. |
| Buffer post + front plate | MAKE | S355 tube 60×60 + plate 15 mm; front face at x = 315 mm; posts z = ±280 mm, own anchors | Machine pin bore + absorber threads after welding; align to the station axis ±0.5 mm. |
| Docking bracket (2) | MAKE | S355 post 60×60 (**too soft – use 120×120×8 or tie to the station frame, §9.3**) + arm 80×30; posts at z = ±410 mm; stop faces at 1144 mm | Machine stop faces + pin bores **with the station chains UP**: faces at chain top + 40 ±0.1 mm, pins ±0.05 mm to the station axis. Then dowel. Load 300 N each. |
| Cone docking pin (2) | MAKE | 16MnCr5 58–62 HRC, ground g6, Ø25, cone 15°, lead-in ±16 mm, cone length 60 mm; 1 round (z = +350), 1 diamond (z = −350) | Polish cone Ra 0.4, light grease, replaceable. |
| Floating deck unit | BUY (AGV supplier)/MAKE | ball transfer units 0.5–1 kN each (hardened counter surface, §10.4), 4 springs 10 N/mm, conical lock pin; ±20 mm / ±1°, 660 kg | Lock pin needs a cone with lead-in ≥ ±20 mm. |
| Docking arms + bushes (on deck) | MAKE (AGV supplier builds in) | S355 + bush 16MnCr5 H7 Ø25 at z = ±350 | Bush bores, top faces and deck chain guide seats in ONE setup ±0.1 mm. |
| Shock absorbers (2) + PU pads | BUY | M25 self-compensating, 60 J, stroke 25; pads 90×90×20, 90 Sh A | At z = ±190 mm. The fixed stop is the PU pads. |
| Protective guide rails (2) | MAKE | S355 flat 15 mm + UHMW-PE 10 mm; 1300 mm long, inner 760 mm, entry +50/side | Countersunk screws 2 mm below surface; slotted floor brackets ±5 mm; chamfered ends. |
| Cart docking pin + bush | MAKE | pin 16MnCr5 hardened f7 Ø30 × 60, cone 15°, height 300 mm; bush H8 with 15° lead-in | Flange 4 × M8 + 2 dowels; bush adjustable ±3 mm then dowelled. |
| Light curtain + muting | BUY | type 4, 300–1800 mm, outside the swing circle | ISO 13855 distance; muting per IEC 62046 (2 independent signals: docked + E84 VALID). |
| E84 optical I/O pair | BUY | IR 8 bit | face to face 0.1–1 m; keep the window clean. |
| Sensors (≈ 12) | BUY | docked, latch, chains up/down, stop up/down, pallet at stop, 4 × seat, deck pallet present | |
| Anchors | BUY | M16 bonded 8.8 + M20 levelling screws + non-shrink grout | Concrete ≥ C25/30, ≥ 200 mm, edge ≥ 100 mm; level 0.2 mm/m, grout 20–30 mm, tighten after 24 h. |
| Manual cart | MAKE | S355 frame, 4 × Ø160 PU castors (2 swivel with brake), 160 kg, deck fixed at 1104 mm ±1 | Shims under the roller tracks. Floor in the cart path ±2 mm, no steps. |
| Pallet (APC tab) | – | chamfer all bottom edges 5 mm × 30°; keep strand tracks free of burrs | |

### Make the parts (order)

1. Station table: tack all, weld crosswise (keeps it flat), anneal, machine in one setup on a boring mill.
2. Receivers: turn, case-harden, grind face and bore.
3. Lift frame: weld, anneal, machine chain-guide seats, fit hardened strips.
4. Shaft + sprockets: keyways or clamping bushes; both sprockets in phase.
5. Docking post: weld, machine pin bore + absorber threads in one setup.
6. Guide rails: flat bar + UHMW-PE, slotted brackets.
7. Paint: frames RAL 5010 (or your standard); rail ends and stop yellow/black (ISO 3864); machined faces oiled.

### Install at the machine

1. Floor: concrete ≥ C25/30, ≥ 200 mm; AGV lane flatness ±2 mm over 2 m; no joints under the docking area.
2. Mark the station centre **from the APC axis**: r = 480 mm along the change direction (tape + plumb line or laser tracker) ±0.5 mm.
3. Set the table: receiver faces at the machine receiver height 1050 mm ±0.1 (precision level 0.02 mm/m), centred to the APC fork rails ±0.5 mm. (For the final mounting choice see item 4.)
4. Drill and set the anchors, grout, tighten after curing.
5. Turn the APC by hand (slow mode) with a pallet: clearance of the fork rails over the receivers (≥ 8 mm, example) and over the lowered chains.
6. Buffer post on the station axis ±1 mm, front face at x = 315 mm; guide rails symmetric ±2 mm.
7. Docking brackets: posts at z = ±410 mm. With the station chains UP, shim the stop faces to chain top + 40 ±0.1 mm and the pins to the station axis ±0.05 mm (gauge block + dial gauge), drill and dowel.

### Commissioning tests

| Test | How | Accept |
|---|---|---|
| AGV offset test | stop the AGV on purpose 12 mm off in x and z and 0.7° turned (both directions) | deck docks, transfer works every time |
| Deck position after docking | 20 dockings, dial gauge deck chain guide vs station chain guide | ±0.4 mm |
| Height step | dial gauge across the chain gap, empty and with a 1.25 × load test pallet | ±1.1 mm (allowed ±3) |
| Lock pin | after 20 offset dockings | closes every time |
| Transfer | 50 transfers each way with test pallet 1.25 × 510 kg | no stop error, seat check OK |
| Stop + overrun | creep speed disabled (test mode) | pallet stops at the hard stop, no damage, ±1 mm |
| Interlocks | try to rotate the APC with chains up / stop up / transfer active | APC does not move |
| Safety | light curtain with and without AGV (muting), E-stop at panel and AGV | stop in the calculated time |
| Endurance | 500 exchange cycles in automatic | no wear marks, chain tension OK |

### PLC interlocks (safety-related parts per ISO 13849, PL d)

- APC may lift / rotate only if: station chains DOWN (B21 off), stop DOWN, no transfer active (E84 BUSY off).
- Station chains may lift only if: APC lowered at 0° / 180° + vehicle docked (B11) + E84 TR_REQ (AGV) or latch closed + button (cart).
- Chains run only if: chains UP, AGV / cart deck chains ready (READY / BUSY), light curtain clear or muted.
- Muting only while docked AND E84 VALID; any lost signal = chains stop + brake.
- Chains run only with B13 "deck on the pins". The AGV may not drive while its lock pin is open (B14 off).
- AGV may leave only after COMPT; the deck lowers only after leaving the docking post (pawl up first).

Sensor names used: B11 vehicle in position / cart docked, B12 latch closed, B13 deck on the pins, B14 deck lock pin closed, B21 chains up, B22 stop up, B23 pallet at stop, B24 pallet seated (4×), M1 chains run.

### Maintenance

| Interval | Work |
|---|---|
| Weekly | clean chips from receivers and strand tracks; check seat-check air |
| Monthly | chain tension (sag 1–2 %), lubricate, check PU pads and guide strips |
| 6 months | shock absorbers, cone pins + bushes, ball transfer units, springs, lock pin, anchor torque, height step re-check |
| Yearly | chain elongation (replace at 2 %), guide strips, guide bushings, receivers |

## 1.6 Checklist (item 1)

- [ ] Stop accuracy (x, z, angle) of the real AGV received in writing.
- [ ] Float range ≥ error at the pins + 2 mm.
- [ ] Cone lead-in ≥ error + 2 mm; cone length ≤ 80 mm.
- [ ] Push-up force ≥ 2 × vertical cone force.
- [ ] Conical lock pin (springs alone leave ±6.5 mm).
- [ ] Height step worst case ≤ allowed step (pallet chamfer 5 × 30°).
- [ ] Strand position (between / outside studs) agreed with the AGV supplier.
- [ ] Station legs outside the APC base; cross beams pass over receivers; brackets and AGV guides outside the swing circle.
- [ ] Interface sheet signed by the AGV supplier.
- [ ] Brackets machined with the chains UP, then dowelled.
- [ ] All commissioning tests passed and recorded.

## 1.7 Mistakes / lessons (item 1)

- A rigid pin / funnel that centres the AGV body: needs 6.8 kN, the AGV jams. Use the floating deck.
- Guide rails that touch the AGV in normal operation: they wear and push the AGV. Keep 20 mm per side.
- Height by sensor + AGV lift control only: ±2.6 mm, borderline. Push against machined stop faces.
- Two round pins (over-determined): the deck jams. One round + one diamond.
- Strands outside the studs on a 500 mm pallet with pitch 400: no room → strands between the studs.
- Forgetting that the retractable stop must be DOWN before the APC turns.

## 1.8 Limits (item 1)

Typical catalogue values for chains, shock absorbers, motors; simple static stability (no dynamics of the lift, no floor slope); docking forces with simple friction; tolerance values are examples; the floating deck is the AGV supplier's design – the page only defines the interface. No prices, no CE assessment.

---

# Item 2 – Crate docking stand (castings in / empty crates out)

## 2.1 Purpose

Castings arrive in a **crate** (steel box pallet with nests, Euro footprint 1200 × 800) and empty crates go back. One simple stand beside the load station serves both an **underride AGV** (drives under the stand and lowers the crate) and a **forklift** (sets the crate down). Both are inaccurate (AGV ±10 mm, forklift driver ±50 mm): **4 self-centring V-guides** at the crate corners centre the crate while it is lowered. The operator lifts each casting (32 kg > 23 kg) with a **jib crane** onto the fixture.

Why simpler than item 1: the crate only needs **±5 mm** – the operator guides the casting with the crane. No floating deck, no pins.

## 2.2 Where in the twin

Mechanical elements → item 2. Buttons: Underride AGV / Forklift; Deliver full crate / Pick up empty crate; views Overview, Stand + guides, Jib crane, Side. Sections: 3D, step table, guide section (live), plan view, calculations, tolerances, checks, BOM, guide.
Part keys (`cxpart`): `stand, vguide, pad, anchor, bollard, sensor, crate, nest, casting, uagv, uplate, fork, jib, hoist, gripper, station, operator`.

## 2.3 Concepts

- **V-guide with flare:** the crate corner lands on an inclined UHMW-PE face (flare 55 mm per side over 60 mm height), slides down into a straight part (40 mm) with 5 mm clearance. The crate **weight** does the centring.
- **The crate must be able to move** on the vehicle: AGV plate with a retaining rim with ±25 mm play and **no locating pins**; forks in the tunnels have ±60 mm play.
- **Open frame:** no low cross members – the AGV drives under it.
- **Crate rests on its long edges** (rails) – same principle as rack and conveyor (item 3).

## 2.4 Calculations (example values)

Inputs: crate 1200 × 800 × 600 mm, 75 kg empty, 4 castings × 32 kg; AGV height 300, width 560, stroke 150, lift 40 mm/s, 0.3 m/s under the stand, ±10 mm / ±0.5°, rim play ±25; forklift ±50 mm, lowering 0.3 m/s; guide height 100, flare 55, clearance 5, friction 0.15, PU pad deflection 3 mm, anchor 8 kN; gripper 15 kg, jib radius 1600, arm 60 kg, 45 s per casting, machining 1380 s. Stand centre at (750, −1750) mm, jib column at (150, −1250) mm from the station centre.

| Topic | Formula | Example |
|---|---|---|
| Crate mass | 75 + 4·32 | **203 kg**, W = 1991 N |
| Rail top | Hs = AGV height + 20 | **320 mm**; crate top 920 mm |
| Carry height | Hs + guide 100 + 15 | 435 mm |
| AGV stroke needed | 435 − 300 | **135 mm** (AGV has 150) |
| Grip height | Hs + base 130 + 150 | 600 mm (good 600–1100) |
| AGV error | e = nav + (L/2)·sin(yaw) = 10 + 600·sin 0.5° | **15.2 mm** |
| Leg clearance | 800 − 160 = 640 ≥ 560 + 2·(15.2 + 15) | 640 ≥ 620 mm ✓ |
| Guide angle | θ = atan(60/55) | 47.5° from horizontal |
| Friction angle | φ = atan 0.15 | 8.5° → margin θ − φ = **39°** (≥ 20°) |
| Centring force | F = W·tan(θ − φ) | **1610 N** |
| Forklift impact | E = ½·m·v² = ½·203·0.3² = 9.1 J; F = 2E/s (s = 3 mm) | **6.1 kN** total → 1.52 kN per pad |
| Rail (tube 100×50×4, L = 1120) | F = (W + F_imp)/2 = 4041 N; M = F·L/8 = 566 N·m | σ = **20 N/mm²**, δ = 5FL³/(384EI) = **0.24 mm** |
| Anchors | (W + F_imp)/4 per leg, /2 per anchor | **1.0 kN** (allowed 8) |
| Jib load | 32 + 15 = 47 kg; ×1.2 = 56 → standard | **SWL 63 kg** |
| Jib foot moment | SWL·1.25·g·R + m_arm·g·R/2 = 63·1.25·9.81·1.6 + 60·9.81·0.8 | **1707 N·m** |
| Column tube 168.3 × 6.3 | σ = M/W | **14 N/mm²** |
| Jib anchors (8 on Ø400) | T = 4M/(n·D) | **2.1 kN** each |
| Reach | crate 781 mm, fixture 1259 mm ≤ 1600 − 100 | ✓ |
| Loading time | 4 × 45 s | **180 s** of 1380 s |
| AGV trips | 3600/1380·2 | 5.2 per hour (full in + empty out) |
| Stand outside APC swing circle | nearest corner to APC axis − Ø/2 | **656 mm** (≥ 300) |

Tolerances: AGV stop ±10, angle ±5.2 (over half the crate), forklift ±50 → all caught by the 55 mm flare → seated ±5 mm.

Steps (AGV, deliver): drive in 8.0 s, lower 3.4 s, drive out 8.0 s, operator loads 4 castings (animation 9 s). Forklift: in 6 s, lower 3 s, out 5 s.

## 2.5 Manufacturing, installation, tests

Interface sheet:

| Item | Value (example) |
|---|---|
| Crate | 1200 × 800 × 600 mm, 203 kg full; bottom plate closed and flat ±2 mm; corners square ±2 mm; 2 fork tunnels 220 × 100 mm at z = ±200 mm |
| Stand | rail top 320 mm, clear width 640 mm, open at the entry, guides 100 mm high with 55 mm flare |
| Underride AGV | height ≤ 300, width ≤ 580 mm, stroke ≥ 135 mm, lift plate with rim (±25 mm), **no locating pins**, 0.3 m/s under the stand |
| Forklift | enters from the AGV side, lowers ≤ 0.3 m/s, forks fully in the tunnels |
| Signals | B1 crate present, B2 crate seated, RFID crate number → MES; AGV orders from the fleet manager |

Parts:

| Part | M/B | Spec (example) | Notes |
|---|---|---|---|
| Crate stand | MAKE | S355: legs 80×80×5, rails 100×50×4 × 1200, base plates 15 mm | Weld 2 side frames flat in a jig, join with top end beams – nothing below 270 mm between the legs. 2 anchors per leg. |
| V-guide (4) | MAKE | S355 angle 8 mm + UHMW-PE 10 mm | Flare 55 mm over 60 mm; countersunk screws 2 mm below the face; slotted holes ±5 mm; strips are wear parts. |
| PU pads (4) | BUY | 90 Sh A, 100 × 80 × 20 | replaceable |
| Base plates + anchors | BUY | 150 × 150 × 15, M12/M16 bonded (4 + 8) | level rails ±1 mm with shims, grout |
| Bollards (2) | BUY | Ø114 concrete-filled, yellow/black, 4 × M16 | forklift protection |
| Sensors B1, B2 + RFID | BUY | diffuse + inductive + reader | B2 at the bottom of a guide: switches only when fully down |
| Crate | MAKE | S235 welded, closed bottom, 2 tunnels, mesh walls, stackable corner cones | All crates same outer size ±2 mm (weld in a jig); nests same position ±5 mm. |
| Nest | MAKE | PE-HD or wood with PU lining | |
| Underride AGV + lift plate | BUY | UHMW-PE top + rim, no pins | AGV supplier |
| Column jib crane | BUY | SWL 63 kg, R 1600, 270° slewing, column 168.3 × 6.3 | foundation per supplier |
| Chain hoist / balancer | BUY | ≥ 63 kg | balancer makes the part "weightless" |
| Casting gripper | MAKE | expanding mandrel in the cylinder bores, 15 kg, self-locking | proof test 2 × load |

Install:
1. Stand position: outside the APC swing circle (≥ 300 mm), operator walkway ≥ 800 mm to the load station.
2. Rails level ±1 mm, parallel ±2 mm; anchor every leg; set the 4 guides **with a master crate** (5 mm clearance all round).
3. Bollards; paint AGV lane and forklift zone; teach the AGV stop point (stand centre).
4. Jib crane: column vertical ±1 mm/m; slewing stop so the arm cannot reach into the APC swing circle above the pallet changer.

Tests:

| Test | How | Accept |
|---|---|---|
| AGV offset | AGV stopped 18 mm off both ways, 20 cycles | crate seated (B2) every time |
| Forklift | 3 drivers × 10 placements | seated without correction |
| Load test | 1.25 × full crate, forklift lowering at 0.3 m/s | no permanent deformation |
| Jib crane | proof load 1.25 × SWL (supplier certificate) | OK, slewing stops work |

Maintenance: monthly guide strips, PU pads, sensors; 6-monthly anchor torque, crate corners (bent crates out of service), gripper; yearly jib crane inspection by a competent person.

## 2.6 Checklist (item 2)

- [ ] Flare ≥ forklift error + 5 mm and ≥ AGV error + 5 mm.
- [ ] θ − atan μ ≥ 20°.
- [ ] AGV plate rim play ≥ AGV error + 5 mm, no pins on the plate.
- [ ] Clear width ≥ AGV width + 2·(error + 15).
- [ ] AGV stroke ≥ guide height + 35 mm.
- [ ] All crates checked with a gauge (±2 mm).
- [ ] Jib reach, SWL, slewing stop; lifting aid for castings > 23 kg.

## 2.7 Mistakes / lessons (item 2)

- Locating pins on the AGV plate: the crate cannot shift, the guides fight the pins. Use a rim with play.
- Flare too flat (angle near the friction angle): the crate stops on the flare. Keep θ well above atan μ.
- Low cross members "for stiffness": the AGV cannot drive under. Stiffen with end beams at rail height.
- Crates of different size: one crate jams in the guides. Make all crates in one jig.
- Manual lifting of 32 kg castings: not allowed by ergonomics rules – use the jib crane.

## 2.8 Limits (item 2)

Static stand check with a simple impact model (3 mm pad deflection); jib crane values by simple formulas (the supplier designs the foundation); grip height is approximate; no fatigue check.

---

# Item 3 – AS/RS ↔ AGV front end

## 3.1 Purpose

Where the raw-material **AS/RS** (stacker crane in a fenced area) hands crates to the **AGVs**. Two I/O chain conveyors (IN / OUT) leave the crane area sideways:
P&D position (crane fork) → buffer inside the fence → **fence opening with muting light curtain** → contour check (IN lane: size, overhang, height, weight, barcode/RFID) → **AGV transfer position** (open below for the underride AGV, side V-guides, end stop).

The ISO 13855 **safety distance** decides where the fence is and how many positions are inside. The crate always rests on its **two long edges** – in the rack (2 support angles), on the conveyor (2 chains), on the AGV stand – so both the crane fork and the AGV can go under it.

## 3.2 Where in the twin

Mechanical elements → item 3. Buttons: OUT (AS/RS → AGV) / IN (AGV → AS/RS); views Overview, Crane P&D, Fence opening, AGV transfer, Top. Sections: 3D, steps, signal timeline (WMS, AS/RS PLC, conveyor, safety, fleet manager, AGV), example messages, plan view, real-environment requirements, calculations, checks, BOM, responsibilities + FAT/SAT.
Part keys (`axpart`): `rack, crane, fork, rail, conv, motor, sensor, guide, stop, contour, fence, door, curtain, cabinet, agv, crate`.

## 3.3 Concepts

- **P&D position:** pick-up and drop-off place of the crane fork on the conveyor.
- **Safety distance S = K·T + C (ISO 13855)**, here for reaching through / over the beams: K = 1600 mm/s, C = 850 mm.
- **No stop position in the fence opening:** a waiting crate must never stand in the light curtain. The conveyor through the opening is a **bridge section** with no stop.
- **Muting:** the light curtain is bridged only while muting sensors see a crate shape in the right order and for a limited time (IEC 62046).
- **Zero-pressure accumulation:** one drive per position, crates can wait without touching.
- **Contour check before storage:** a bad crate (overhang, part sticking up, overweight, no ID) can jam or crash the crane.

## 3.4 Calculations (example values)

Inputs: crate 1200 (across the aisle) × 800 × 600 mm, 203 kg full; rated AS/RS load 250 kg; crane double cycle 50 s, stop time near P&D 0.5 s, fork width 500 mm, P&D accuracy ±3 mm; 12 in + 12 out per hour; conveyor 0.2 m/s, 0.3 m/s², resistance 0.1, gap 200 mm, light-curtain response 0.02 s; AGV 300 high, 560 wide, ±10 mm / ±0.5°, 0.3 m/s, lift 40 mm/s, side flare 40 mm; contour: overhang 20 mm, height +30 mm.

| Topic | Formula | Example |
|---|---|---|
| Stop time | T = light curtain 0.02 + crane 0.5 | 0.52 s |
| Safety distance | S = 1600·T + 850 = 1600·0.52 + 850 | **1682 mm** |
| Aisle width | crate length + 200 | 1400 mm |
| Fence line | aisle edge 700 + S, rounded up to 50 | **2400 mm** from the aisle centre |
| P&D centre | aisle/2 + crate/2 + 50 | 1350 mm |
| Position pitch | 1200 + 200 | 1400 mm |
| Positions | inside: P&D at 1350 (ends 1950 ≤ 2300); outside start ≥ fence + 100 + 600 = 3100; transfer at 4500 | **3 per lane, 1 inside** |
| Bridge (no stop in the opening) | 2500 − 1950 | **550 mm** (≥ 200) |
| Lane length | | ≈ 4.4 m |
| Chain top | AGV height + 20 | **320 mm** |
| Clear width | 2·(xc − 20), xc = 800/2 − 40 = 360 | **680 mm** |
| Fork needs | 500 + 2·30 | 560 ≤ 680 ✓; P&D ±3 vs fork clearance ±90 ✓ |
| AGV error | 10 + 600·sin 0.5° | 15.2 mm → needs 560 + 2·(15.2 + 15) = 620 ≤ 680 ✓; flare 40 ≥ 20.2 ✓ |
| Conveyor force / power | F = m·(μ·g + a) = 203·(0.981 + 0.3) = 260 N; P = F·v/0.8 = 65 W ×1.5 | **0.12 kW** per position |
| Time per position | p/v + v/a = 1.4/0.2 + 0.67 | 7.7 s |
| Crane utilisation | (12·50 + 0·…)/3600 | **17 %** (ok ≤ 70 %) |
| Buffer OUT | (3 − 1)·3600/12 | AGV may be **10 min** late |
| Buffer IN | (3 − 1)·3600/12 | crane may be busy 10 min |
| AGV lift stroke | 320 + 100 + 15 − 300 | ≥ 135 mm; one transfer ≈ 19 s |
| AGV visits | 12 + 12 | 24 per hour |
| Fence opening | (800 + 200) × (320 + 600 + 150) | 1000 × 1070 mm |

Faster stopping crane axes (smaller T) = shorter conveyors.

Steps OUT: crane fetches 10 s → puts on P&D 8 s → conveyor to transfer 16.4 s → AGV picks 19.4 s. Steps IN: AGV drops 19.4 s → contour check 9.7 s → conveyor to P&D 9.4 s → crane stores 14 s.

## 3.5 Manufacturing, installation, tests

Responsibilities (write into the contracts):

| Item | AS/RS supplier | Conveyor (you / integrator) | AGV supplier |
|---|---|---|---|
| P&D position | teach fork ±3 mm, interlock "fork in P&D" | chains + frames 680 mm clear, "P&D occupied" | – |
| Transfer position | – | side guides, end stop, "load ready / position free" | stop ±10 mm, lift ≥ 135 mm, E84 / VDA 5050 actions |
| Safety | crane, door locking, EN 528 | fence, light curtain + muting, safety PLC, EN 619 | scanners, ISO 3691-4, speed in the lanes |
| Software | WMS ↔ PLC telegrams | conveyor PLC, contour check, HMI | fleet manager ↔ WMS (VDA 5050) |
| CE marking | **one** responsible integrator for the complete system – decide before ordering | | |

Parts (BOM, example quantities): stacker crane + racks + rails (BUY, 1); I/O conveyor sections 1400 mm (MAKE, 6 = 3 per lane × 2); 3/4" roller chains + UHMW-PE guides + sprockets (BUY, 12, ≈ 3.1 m per strand); gear motor + brake + inverter 0.12 kW (BUY, 6); retro-reflective position sensors (BUY, 12); chain guards (MAKE, 6, EN 619); side guides + V-flare 40 mm (MAKE, 2); end stop with PU buffer (MAKE, 2); contour check – 2 light grids 5 mm, load cells, barcode/RFID (BUY, 1, IN lane); type 4 light curtain + 4 muting sensors (BUY, 2); safety fence 2 m (≈ 17 m); door with guard locking + LOTO (ISO 14119); control cabinet with safety PLC + HMI; E84 optical I/O or VDA 5050 via the fleet (2); floor marking + anchors.

Make the conveyors:
1. Side frames S355 tube 120 × 40, weld in a jig; chain-guide seats machined or shimmed ±0.5 mm.
2. Connect the 2 side frames **only with floor ties ≤ 100 mm high** – the fork and the AGV need the middle free. At the AGV transfer position: no floor tie, each frame anchored separately.
3. Chains 3/4" on UHMW-PE strips, tensioner per section, guards on the return strand and every sprocket (no reachable nip points).
4. One gear motor + inverter per position; 2 sensors per position (slow-down, stop).
5. Paint frames RAL 5010, guards yellow; label positions like in the WMS (IN-1-P1 …).

Install:
1. Floor survey before the rack; take all conveyor positions from the aisle axis set out by the AS/RS supplier.
2. P&D sections on the crane axis ±2 mm, chain top 320 mm ±1; other sections in line ±2 mm.
3. Side fence at 2400 mm from the aisle axis, gap to the floor ≤ 200 mm (mesh ≤ 40 mm at ≥ 200 mm from moving parts, ISO 13857); light curtains centred in the openings; muting sensors per the muting plan.
4. Cabinet outside the fence; no cables in the AGV lanes.
5. Teach crane P&D positions and AGV stop points (with an offset test).

Real-environment requirements (from the page): crane rail strip flat ±2 mm, concrete ≥ C25/30; AGV lanes ±2 mm over 2 m, steps ≤ 3 mm, slope < 1 %; building height AS/RS 9.5 m + 0.5 m; in-rack sprinklers per insurer, fire shutter where a conveyor crosses a fire wall; +5…+40 °C, castings below 50 °C before storage; foundry dust → chain conveyors (not rollers), wipers, cleaning plan; lighting ≥ 200 lx (≥ 300 lx at HMI), no glare into light curtains; 400 V separate feeder, lockable main switch; Wi-Fi roaming over the whole AGV route (VDA 5050 over MQTT); risk assessment, safety PLC PL d, CE; walkways ≥ 800 mm outside the fence. Standards named on the page: EN 528, EN 619, ISO 3691-4, ISO 13855 / 13857, IEC 62046, EN 15620, EN 15512, EN 15635, ISO 14119, ISO 14120, EN 12464-1, VDA 5050.

Example messages (OUT): MES → WMS transport order; WMS → AS/RS PLC telegram (job, source location, target OUT-1-P1); PLC → WMS job done; conveyor → fleet manager LOAD_READY; fleet manager → AGV VDA 5050 order with "pick" action; AGV ↔ conveyor E84 VALID → U_REQ → TR_REQ → READY → BUSY → COMPT. IN: drop order, L_REQ (position free), contour OK + weight + RFID to WMS, store job; NOK → crate back to the AGV position, HMI shows the reason.

Acceptance tests (FAT at the supplier, SAT on site):

| Test | How | Accept |
|---|---|---|
| P&D interlock | run P&D chains with the fork in; put a crate on an occupied P&D | blocked every time |
| Contour check | test crates: +25 mm offset, part 40 mm too high, 10 % overweight, no label | all rejected, correct reason |
| Muting | crate passes; person / test rod with and without crate; muting time-out | crate passes, person stops the system |
| Door | open request while the crane moves | stays locked until safe |
| AGV transfer | AGV ±12 mm off, 20 transfers per lane | no fault |
| Throughput | 12 in + 12 out per hour for 4 h | no AGV waiting > 2 min |
| Communication loss | Wi-Fi off during transfer; WMS link off | safe stop, recovery without manual handling |

Maintenance: weekly clean light grids / sensors / curtains, check guards; monthly chain tension + lube, guide strips, end-stop buffers, muting test; yearly crane inspection (EN 528), rack inspection (EN 15635), safety validation.

## 3.6 Checklist (item 3)

- [ ] Crane stop time T from the supplier (not estimated); S recalculated.
- [ ] Fence at aisle edge + S; no stop position in the opening (bridge ≥ 200 mm).
- [ ] Clear width fits fork (+2·30) and AGV (+2·(error + 15)).
- [ ] Crate on its 2 long edges everywhere (rack angles, chains, rails).
- [ ] Contour check on the IN lane before the crane.
- [ ] One CE integrator named in the contracts.
- [ ] Buffer times OK for AGV delay and crane delay.

## 3.7 Mistakes / lessons (item 3)

- A stop position inside the fence opening: a waiting crate blocks the light curtain (or muting stays active too long). Use a bridge section.
- Cross members between the conveyor frames: the crane fork and the AGV cannot get under the crate.
- No contour check: one overhanging part can crash the stacker crane.
- Roller conveyors in foundry dust: use chains.
- Responsibility gaps between three suppliers: name one integrator for CE.

## 3.8 Limits (item 3)

Simple crane utilisation (single cycle = 0.6 × double cycle); conveyor force for one crate; fence position from one formula (the real safeguarding design follows the risk assessment); the rack in the 3D view shows 4 levels only (real: 7 levels, 9.5 m).

---

# Item 4 – Load station ↔ APC connection

## 4.1 Purpose

Make sure the APC arm takes the pallet from the station receivers and sets it into the machine **zero-point modules (catch ±1 mm)** – and brings the finished pallet back onto the **receivers (catch ±3 mm)**. Key points: the station is aligned to the **APC axis, not to the floor** (bolted + dowelled to the APC base), both sides at the **same height**, the error chain station → machine stays inside ±1 mm, and **interlocks** decide who may move when (APC, station chains, AGV, people).

## 4.2 Where in the twin

Mechanical elements → item 4 (2D SVG, no 3D). Top: KPIs; animation of one pallet change (top view + side section along the arm, times from the Pallet changer tab), Play / slider, mounting switch **A "bolted + dowelled to the APC base"** / **B "separate floor frame"**; step table (click a step to jump); mounting comparison; two accuracy chains; interlocks; signals; inputs; checks; calculations; BOM; guide.
Deep links: `/?mxitem=4&m4mount=base|floor&m4t=6#mech`.

## 4.3 Concepts

- **Accuracy chain:** list of all errors between two places. **Worst case** = all add up in the same direction (design with this). **RSS** = √Σe² = realistic statistical value.
- **Dowel locates, bolts hold:** the preloaded bolts carry the force by friction; dowels only fix the position (they must not carry load).
- **Master pallet:** a pallet with ground studs and dial-gauge seats, used to align the station and for yearly checks.
- **Station LOCKED:** while the APC lifts / turns / lowers, nothing at the station may move and nobody may be in the zone.

## 4.4 Calculations (example values)

Inputs: dowelled position error ±0.05 mm; floor frame ±0.3 mm when set + drift ±0.2 mm/year, 1 year to re-alignment; height difference ±0.1 mm; pallet in receivers ±0.02; receivers on table ±0.02; pallet on fork rails ±0.2; machine zero-point ↔ APC axis ±0.05; ΔT 10 K; receiver catch ±3; friction ledge ↔ rail 0.15; station mass 260 kg; 4 bolts M16 10.9, preload 80 kN, joint friction 0.2; fixture / part overhang 40 mm; AGV bumper 335 mm from the station centre. From the APC tab: r = 480, stroke 60, backlash 3′, capture ±1 mm, α = 2.39 rad/s².

Arm angle error: e = r·backlash = 480·(3/60)·π/180 = **0.42 mm** (often the biggest part – a smaller backlash or a mechanical index at 0° / 180° reduces it).
Thermal growth: Δ = 11.5·10⁻⁶·r·ΔT = 11.5·10⁻⁶·480·10 = **0.055 mm**.

Accuracy chain station → machine (new pallet into the zero-point modules), ± mm:

| Contributor | A: bolted + dowelled | B: floor frame |
|---|---|---|
| Pallet in the station receivers | 0.02 | 0.02 |
| Receivers on the station table | 0.02 | 0.02 |
| Station ↔ APC axis | 0.05 | 0.3 + 0.2·1 = 0.50 |
| APC arm angle (backlash) | 0.42 | 0.42 |
| Pallet on the fork rails | 0.20 | 0.20 |
| Thermal growth | 0.055 | 0.055 |
| **Worst case** | **0.76** | **1.21** |
| RSS | 0.47 | 0.69 |
| Zero-point catches | ±1 | ±1 |
| Result | ok (≤ 0.8 = 80 %) | **not ok – 1.21 > 1** |

Accuracy chain machine → station (finished pallet onto the receivers): 0.005 (zero-point) + 0.05 + 0.42 + 0.20 + station (0.05 or 0.50) + 0.055 = **0.78 mm (A)** / **1.23 mm (B)** vs catch ±3 → ok in both cases.

Other calculations:

| Topic | Formula | Example | Check |
|---|---|---|---|
| Pallet on the rails during rotation | a = α·r = 2.39·0.48 = 1.15 m/s²; friction holds μ·g = 0.15·9.81 = 1.47 m/s² | **× 1.3** | warning (aim ≥ 1.5) → **add locating blocks**. Correction §9.1: with centripetal ω²·r = 1.55 m/s² the resultant is 1.93 m/s² → **× 0.76**, blocks required |
| Studs free when lifted | stroke − 5 − stud = 60 − 5 − 44 | 11 mm | ok ≥ 5 |
| Sweep radius (pallet + parts) | √((r + a/2 + ovh)² + (b/2 + ovh)²) = √(770² + 290²) | **823 mm** (Ø1646) | |
| AGV bumper | r + 335 = 815 mm → clearance 815 − 823 | **−8 mm** | **bad: parts reach ≈ 8 mm into the AGV bumper** → AGV must stop ≈ 38 mm further away (for 30 mm clearance) or leave before every change |
| Bolted joint (A) | stop force F = m·v²/(2·s) + μ·m·g = 510·0.05²/0.006 + 0.1·510·9.81 = 713 N; ×1.5 = 1.07 kN; grip = n·μ·Fv = 4·0.2·80 = 64 kN | **1.7 %** used | ok |
| Floor frame (B) | ±0.3 + 0.2·1 = ±0.50 mm vs 0.4·capture | | warning: re-align more often or dowel to the APC base |
| Levelling feet (A) | (260 + 510)·9.81/2 | 3.8 kN each (2 feet carry the weight, the bracket only locates) | |
| Thermal | 0.055 ≤ 0.1·capture | | ok |
| Arm angle | 0.42 ≤ 0.5·capture | | ok |
| Height | ±0.1 mm | | ok (aim ±0.1) |

Note: item 1 checks the **AGV deck side guides** against the pallet-only swing circle (30 mm clearance). Item 4 adds the **fixture / part overhang** (40 mm) and the **AGV bumper** position → collision. Always check with the biggest fixture and parts.

Pallet change steps (times from the APC tab): axes + door 1.5 s → machine unclamps 0.8 s → station reports READY 0.8 s → APC lifts 60 mm 0.8 s → turns 180° 2.5 s (station LOCKED) → lowers 0.8 s (new pallet into the modules ±1, finished pallet onto receivers ±3) → clamp + seat checks 1.2 s → door closes 1.2 s = **9.6 s** (the 0.8 s station READY check is extra compared with the 8.8 s of the APC tab).

### Mounting comparison

| | A · bolted + dowelled to the APC base | B · separate floor frame |
|---|---|---|
| Position to the APC axis | ±0.05 mm – dowels keep it | ±0.3 mm when set, ±0.50 mm after 1 year |
| Who carries the weight | 2 levelling feet under the outer end (3.8 kN each); bracket only locates | 4 feet + anchors |
| AGV docking shocks | go into the separate buffer posts on the floor (item 1) – never into the station or the APC | same |
| Machine moved / re-levelled | station moves with the APC – no re-alignment | re-align every time |
| Effort | bracket machined, dowel holes reamed on site after alignment | simple, but alignment check every year |

**Recommendation: A.** The station and the APC become one rigid unit; the floor does not matter any more.

### Interlocks – who may move when (program in the safety PLC, not only in the HMI)

| Movement | Allowed only if | Signal type |
|---|---|---|
| APC lift / rotate | station chains DOWN · stop DOWN · no transfer running · AGV not docked · station zone free · pallet at station seated (air) or station empty · machine door open, spindle stopped | safety (F-DI, 2 channels) + standard |
| Station chains / stop | APC lowered AND at 0° or 180° AND standstill monitored | safety + standard |
| AGV docks / transfers | station not LOCKED · APC standstill · E84 handshake | E84 optical + standard |
| Person enters the station zone | APC rotation stops (safe stop 1 → STO), lift held by the valve | safety scanner → safety PLC |
| E-stop (any) | machine, APC and station stop together | hard-wired E-stop chain both ways |

### Signals station PLC ↔ machine / APC

| Signal | From → to | Type |
|---|---|---|
| Station READY for APC (chains + stop down, no transfer, seated) | station → APC | Profinet + hard-wired |
| Station zone free (scanner, AGV out) | station → APC | safety, 2 channels |
| Pallet seated at station (air check) | station → APC | Profinet |
| Pallet ID (RFID) → NC program | station → CNC | Profinet / OPC UA |
| APC lowered + at 0° / 180°, standstill | APC → station | safety + standard |
| APC moving → station LOCKED | APC → station | safety |
| Change done – finished pallet at station | APC → station → fleet manager | Profinet → MES / AGV |
| E-stop chain | both ways | hard-wired |

## 4.5 Manufacturing, installation, alignment, tests

BOM (connection parts, examples):

| Part | M/B | Qty | Specification |
|---|---|---|---|
| Adapter bracket station ↔ APC base | MAKE | 2 | S355 30 mm, faces machined, slotted holes ±3 mm (A only) |
| Dowel pins Ø12 m6 + hardened bushes | BUY | 4 | reamed on site after alignment (A only) |
| Bolts M16 10.9 + washers | BUY | 4 | preload 80 kN, torque from the table |
| Levelling feet M24 with lock nut + pad | BUY | 2 (A) / 4 (B) | 3.8 kN each |
| Chemical anchors M12 | BUY | 2 (A) / 4 (B) | fix the feet sideways |
| Stainless shims 0.05–1 mm | BUY | set | height to ±0.1 mm |
| **Locating blocks on the APC fork rails** | MAKE | 4 | hardened, 0.1 mm clearance to the ledges – keep the pallet during rotation |
| Air blow nozzles at the receivers | BUY | 4 | clean studs + faces before seating |
| Air seat check (4 nozzles → pressure switch) | BUY | 1 | "pallet seated" at the station |
| Drip tray + chip guard under the station | MAKE | 1 | stainless, slope to drain (finished pallet brings coolant + chips) |
| RFID reader + tag per pallet | BUY | 1 | pallet ID → NC program |
| Sensors chains down, stop down | BUY | 4 | inductive, 2 per function |
| Safety laser scanner for the station zone | BUY | 1 | PL d (or light curtain with muting) |
| Interface cable station ↔ machine | BUY | 1 | Profinet + safety + E-stop |
| Master pallet (ground studs, dial-gauge seats) | BUY/MAKE | 1 | alignment + yearly checks |

Who does what: the machine / APC builder gives the reference (APC axis, zero-point height H0 = 1050 mm, end positions 0° / 180°), a bolting face + 2 dowel holes on the APC base, and the interface signals. You give the bracket, station, sensors, scanner, PLC program, and align the receivers to the APC.

Installation + alignment with a master pallet (step by step):
1. Machine and APC are installed and levelled first (machine builder). **Never align the station to the floor – always to the APC.**
2. (A) Bolt the brackets to the APC base (slotted holes, bolts hand-tight); set the 2 levelling feet under the outer end. (B) Set the frame on 4 feet, anchors not yet tight.
3. **Height:** precision level (0.02 mm/m) across the 4 receiver faces, then dial gauge on the APC fork rail: receiver faces at the same height as the machine zero-point faces ±0.1 mm → shims.
4. **Position:** clamp the master pallet in the machine. Lift, turn 180° and lower in slow manual mode until the studs are 2 mm above the receivers. Measure stud ↔ receiver bore in x and y (dial gauge / feeler). Move the station to ±0.05 mm.
5. (A) Tighten the bolts (torque wrench), then **drill + ream the dowel holes through bracket and APC base** and insert the dowels – the position can no longer change. (B) Tighten anchors, check again, mark the feet, write values in the machine log.
6. Turn back with the master pallet: it must drop into the zero-point modules **without force** (air seat check OK, no scratch on the taper).
7. Set the safety scanner field; test every interlock (try to start the APC with chains up, stop up, AGV docked, person in the zone – it must refuse).

Acceptance tests:

| Test | How | Pass if |
|---|---|---|
| Repeatability | 100 pallet changes with a loaded pallet | seat check OK every time (station and machine) |
| Position | master pallet: dial gauge on the stud at the station after 10 changes | scatter ≤ 0.05 mm |
| Interlocks | each condition of the interlock table, one by one | APC / station refuse to move |
| Clearance | turn slowly with the biggest fixture + parts | ≥ 30 mm to the AGV, stop and brackets |

Maintenance: daily blow receivers clean, check the drip tray; weekly seat-check function; every 6 months master-pallet check of height + position (floor frame: every 3 months); after any crash full alignment check before production; replace fork-rail locating blocks at 0.2 mm clearance.

## 4.6 Checklist (item 4)

- [ ] Station aligned to the APC axis (not the floor).
- [ ] Mounting A (bolted + dowelled) chosen, or B with a documented re-alignment interval.
- [ ] Worst-case chain station → machine ≤ 0.8 × zero-point catch.
- [ ] Chain machine → station ≤ receiver catch.
- [ ] Height difference station / machine ≤ ±0.1 mm.
- [ ] Pallet-on-rail friction factor ≥ 1.5 – else locating blocks on the rails.
- [ ] Sweep circle with the biggest fixture + parts vs AGV bumper, stop, brackets (≥ 30 mm).
- [ ] Interlocks in the safety PLC; E-stop chain both ways.
- [ ] Master pallet available; alignment values recorded.

## 4.7 Mistakes / lessons (item 4)

- Floor frame (B): 1.21 mm > ±1 mm catch. Floor drift eats the catch range. Dowel to the APC base.
- Dowels carrying load: they wear and the position is lost. Bolts (friction) carry, dowels locate.
- AGV docking forces into the station or APC: they must go into separate buffer posts.
- Forgetting the parts on the pallet: −8 mm collision with the docked AGV bumper.
- Relying on friction on the fork rails (× 1.3, really × 0.76 with the centripetal part): the pallet slides during rotation → locating blocks.
- Interlocks only in the HMI: must be in the safety PLC.

## 4.8 Limits (item 4)

Linear sum and RSS of errors only (no direction, no tilt); thermal growth only over r with steel α; the bolted-joint check covers only the stop force; times come from the APC tab plus a fixed 0.8 s READY check; the 2D drawing is schematic.

---

# 9. Corrections and clarifications (items 1–4)

Found while writing chapters 10–15. The page code is not changed; where the text above is affected, a short note was added there.

## 9.1 Item 4 – pallet on the APC fork rails: centripetal acceleration missing

The page compares friction μ·g = 1.47 m/s² only with the tangential acceleration α·r = 1.15 m/s² (× 1.3). At the end of the acceleration the arm also turns at ω = 1.80 rad/s → centripetal a_c = ω²·r = 1.795²·0.48 = **1.55 m/s²**, along the rails.
Resultant √(1.15² + 1.55²) = **1.93 m/s²** → friction factor 1.47/1.93 = **0.76 < 1**. The pallet slides without locating blocks. **Locating blocks on the fork rails are required.** Design load 510·1.93·1.5 = 1.5 kN; specification in doc 09 §11.3 part 7. (`web/mech4.js` still shows × 1.3.)

## 9.2 Item 1 – cone geometry and push-up force on the bush chamfer

- The catch range K = r_b + c − r_t = 12.5 + 5.5 − 2 = 16 mm is correct. But the 16 mm is made of **two parts**: the 15° cone (from tip radius 2 to 12.5 mm) and the 45° chamfer of the bush (5.5 mm).
- Real cone length = (12.5 − 2)/tan 15° = **39 mm**. Vertical travel for full centring ≈ 39 + 5.5 = 45 mm. The page value "r/tan 15° = 60 mm" is an upper value (it treats all 16 mm as 15° cone). Use 39 mm cone on the drawing and ≥ 50 mm docking stroke above first contact.
- When the offset is more than 10.5 mm, the cone touches the **45° chamfer**. There the push-up force is F_v = F·tan(45° + 8.5°) = 195·1.353 = **264 N** (not 85 N). Check: 264 N ≤ 300 N (50 % of 600 N) → still ok, but with little margin. Do not make the chamfer steeper than 45° or the friction higher (keep the cone polished and greased).

## 9.3 Item 1 – docking posts 60 × 60 are too soft

The posts carry the pins 1144 mm above the floor. Free cantilever 60 × 60 × 5 (I = 0.559·10⁶ mm⁴):
- residual lateral force after docking (spring 131 N): f = F·L³/(3EI) = 131·1144³/(3·210 000·0.559·10⁶) = **0.56 mm** in z;
- chain-transfer reaction 654 N shared by 2 pins (327 N each, along x): **1.39 mm** in x.
This is much more than the 0.05 mm "pin position" in the lateral chain (§1.4), and the commissioning test "deck ±0.4 mm" would fail. Fix: post **120 × 120 × 8** (I = 7.53·10⁶ mm⁴ → 0.04 mm and 0.10 mm) **or** tie both posts with a cross beam to the station table frame. Worked out in §14.

## 9.4 Item 1 – the lateral force on a pin is limited by the push-up force

The cone is a wedge: with the deck pushing up with at most F_v = 600 N, the largest lateral force it can create is F = F_v·(1 − μ·tan 15°)/(tan 15° + μ) = 600·0.960/0.418 = **1378 N** (on the 45° chamfer only 443 N). The "rigid pin 6.8 kN" case can therefore only happen if the AGV deck pushes harder than 600 N. → Write the **maximum deck lift force including motor stall** into the interface sheet; design the pin and post for 1.4 kN (× safety).

## 9.5 Item 1 – retractable stop: energy if the creep speed fails

The stop force 1.44 kN is for creep speed 0.05 m/s. The commissioning test "creep speed disabled" means the pallet arrives at the conveyor speed 0.2 m/s: E = ½·510·0.2² = **10.2 J**. On a 3 mm PU pad that is F = 2E/s = 6.8 kN; with a 10 mm hydraulic damper F ≈ E/(0.85·s) = 1.2 kN. → Specify the stop **with damper, ≥ 10 J per stroke (with margin, e.g. 15 J)**, or do not run that test.

## 9.6 Other clarifications

| Place | Clarification |
|---|---|
| Item 4, bolts M16 10.9 "preload 80 kN" | ≈ the **minimum** preload after torque-wrench scatter: 121.7 kN/α_A 1.6 = 76 kN (doc 09 §10.3). Torque 302 N·m (μ 0.12). μ = 0.2 only for clean, dry, machined faces – 0.15 if oily |
| Item 1, diamond pin | a diamond pin cannot use g6: it needs extra clearance in the relieved direction (§10.3, §14). Alternative: second bush as a **slot** 25H7 × 27 mm |
| Item 1, ball transfer units | the counter surface must be hardened or follow the BTU catalogue (Hertz pressure 2370 N/mm², §10.4) |
| Item 1/3, light curtains, ISO 13855 | new edition about 2024 – check formula and C values in your edition (doc 09 §9.5) |
| All items, CE | EU Machinery Regulation (EU) 2023/1230 applies from 20 January 2027 |

---

# 10. Science principles for the interfaces

The general derivations (Newton, bending, buckling, fatigue, bolts, welds, hydraulics, Hertz formulas, tolerance stacks) are in **doc 09 §10**. Here: the principles that decide the interfaces, with the interface numbers.

## 10.1 Friction, wedge and cone – why passive centring works

- Friction angle φ = atan μ; μ = 0.15 → 8.5°.
- **Self-centring condition:** the guide face must be steeper than the friction angle. V-guide (item 2): θ = 47.5° from horizontal > 8.5° → the crate slides into place under its own weight. Centring force F = W·tan(θ − φ) = 1991·tan 39° = 1610 N.
- **Cone pin (item 1)**, half-angle β from the vertical axis. To create the lateral force F the deck must push up with F_v = F·tan(β + φ):
  - 15° cone: tan 23.5° = 0.435 → F_v = 195·0.435 = 85 N;
  - 45° bush chamfer: tan 53.5° = 1.353 → F_v = 264 N.
- **Reverse view (limit):** with push-up limited to 600 N, the lateral force can never exceed 600/tan 23.5° = 1378 N (§9.4). A force limit on the active side protects every passive part.
- **Self-locking** if β < φ (Morse taper ≈ 1.5°): never use such small angles for docking, the parts would stick.

## 10.2 Exact constraint (6 degrees of freedom) at each interface

| Interface | Constraints | Count |
|---|---|---|
| Floating deck docked | round pin (x, z) 2 + diamond pin (rotation about the vertical) 1 + 2 stop faces (height, roll) 2 + AGV lift mechanism (pitch) 1 | 6 |
| Pallet on station receivers | 3 faces of the receivers act as a plane (height + 2 tilts) 3 + round receiver (x, z) 2 + slot receiver (rotation) 1; 2 receivers with +0.5 mm clearance carry weight only | 6 |
| Crate in V-guides | not exact – ±5 mm play is wanted; the guides only centre | – |
| Station on APC base (item 4, mounting A) | machined face + 2 dowels (1 in a round hole, 1 effectively free in one direction by hole tolerance) | 6 |

More than 6 → over-determined → forcing, jamming, wear (two round pins on the deck jam).

## 10.3 Diamond pin geometry

A diamond (relieved) pin of diameter D keeps two narrow cylindrical lands of width b. It tolerates a centre-distance error δ in the relieved direction if its diametral clearance c satisfies (derived from the circle geometry, small values):
**δ ≈ c·D/(2·b)  →  c_min = 2·b·δ/D**
Example (pins 700 mm apart): pin positions ±0.05 each and bushes ±0.1 → distance error ±0.2; thermal 700·11.5·10⁻⁶·10 K = 0.08 → δ = 0.28 mm. Land b = 2.5 mm, D = 25 → c_min = 2·2.5·0.28/25 = **0.056 mm** → diamond pin Ø25 **d9** (−0.065/−0.117) in H7 (+0.021/0): clearance 0.065–0.138 ✓. The lands point in x (transfer direction), so the lateral z position is fixed only by the round pin (g6/H7, clearance 0.007–0.041).

## 10.4 Contact pressure (Hertz) at the docking parts

Formulas: doc 09 §10.6 (steel/steel E* = 115 400 N/mm²).
- **Ball transfer unit** (ball Ø25, deck 660 kg on 8 units → F = 809 N): point contact p_max = (1/π)·(6·809·115 400²/12.5²)^(1/3) = **2370 N/mm²**. On unhardened S355 (first dent ≈ 600 N/mm²) the balls make tracks → hardened wear plate (≥ 50 HRC) or the catalogue's counter-surface rule, or more/larger balls.
- **Cone pin on the bush edge** (normal force N = 195/(cos 15° − 0.15·sin 15°) = 210 N, local radius ≈ 8 mm, contact length ≈ 5 mm): line contact p_max = √(210·115 400/(π·5·8)) = **440 N/mm²** → fine for case-hardened parts (58–62 HRC); edges must be rounded (R ≥ 0.5) and polished.

## 10.5 Stiffness – a passive locator is only as good as its support

The pin positions the deck only as accurately as the post holding the pin stays in place under load: f = F·L³/(3·E·I).
Required I for f ≤ 0.05 mm with 131 N at L = 1144 mm: I ≥ 131·1144³/(3·210 000·0.05) = **6.2·10⁶ mm⁴** → 120 × 120 × 8 (7.5·10⁶) or a braced post. Rule: **every locating part must be checked for deflection, not only for stress** (the 60 × 60 post has only 85 N/mm² even at 1.4 kN – strong enough, but far too soft).

## 10.6 Tolerance stack-up

Worst case Σ|e| for catch and collision checks; RSS √Σe² for the expected scatter (doc 09 §10.11). Example item 1 lateral chain with the post deflection added (60 × 60 posts): 0.40 + 0.56 = 0.96 mm worst case – still inside the receiver catch ±3 but outside the ±0.4 acceptance; with 120 × 120 × 8: 0.40 + 0.04 = 0.44 mm.

## 10.7 Impact energy and absorbers

E = ½·m·v²; absorber force ≈ E/(η·s), η ≈ 0.85; elastomer pad F ≈ 2E/s.
| Case | Energy | Result |
|---|---|---|
| AGV fault at 0.3 m/s, 1160 kg | 52 J | 2 absorbers M25 (60 J), 1.23 kN each |
| Pallet at stop, creep 0.05 m/s | 0.64 J | 963 N incl. friction |
| Pallet at stop, creep failed 0.2 m/s | 10.2 J | damper ≥ 10 J (§9.5) |
| Forklift lowering crate 0.3 m/s, 203 kg | 9.1 J | 6.1 kN on 3 mm PU (item 2) |

## 10.8 Vibration – why the deck needs a lock pin

Floating deck with load (660 kg) on centring springs k = 10 N/mm: f = (1/2π)·√(10 000/660) = **0.62 Hz**. Such a slow, weakly damped spring-mass would sway several millimetres every time the AGV brakes (1 m/s² → static deflection 660·1/10 000 = 66 mm, limited only by the float stops). → Lock pin closed while driving; open only when docked.

## 10.9 Stability against tipping

Safety = restoring moment / tipping moment = (lever·m·g)/(m·a·h) = (lever/h)/(a/g). Examples: pallet on the chain during transfer 32; AGV at E-stop 5.0; manual cart 2.6. Use the **highest** centre of gravity (largest fixture and parts).

## 10.10 Bolted joint and dowels (item 4)

Bolts carry by friction: F_slip = n·μ·F_V,min = 4·0.2·76 = 61 kN ≫ 1.07 kN stop force. Dowels (ISO 8734, Ø12 m6) only fix the position after alignment; they must never be the load path – if the bolts are loose, the dowels wear and the position is lost.

## 10.11 Thermal expansion

ΔL = α·L·ΔT. Pin distance 700 mm, 10 K between AGV deck and station: 0.08 mm (in the diamond-pin clearance). Station ↔ APC axis (r = 480 mm): 0.055 mm (in the item 4 chain).

## 10.12 Chain drive (item 1, item 3)

- Sprocket pitch diameter d₀ = p/sin(180°/z) = 15.875/sin 10.59° = 86.4 mm (z = 17).
- **Polygon effect:** the chain speed varies by 1 − cos(180°/z) = 1 − cos 10.59° = **1.7 %** at z = 17 – acceptable; with z < 13 it becomes jerky. Use z ≥ 17 for transfers.
- Pull F = m·(μ·g + a); safety on breaking load ≥ 10 with service factor (§1.4).

## 10.13 Station lift cylinder (hydraulics)

Pascal: F = p·A = 6·1963 = 11.8 kN for Ø50 (needed 7.73 kN). Rod Ø28 guided by the frame columns: L_k ≈ 350 mm, i = 7 mm, λ = 50 < 90 → no buckling. Flow Q = A·s/t = 1963·64/1.0 s = 7.5 L/min. Same oil rules as doc 09 §11.7.

---

# 11. Detailed manufacturing specification (interface parts)

General drawing notes, welding (process 135, ISO 5817 C, ISO 13920-BF, stress relief 580–620 °C), bolt torques, dowel rules, paint (ISO 12944 C3), hydraulics, anchors and grouting: **as doc 09 §11.1 and §11.4–§11.8.** ISO 286 limits: doc 14 §5. Values below are examples.

## 11.1 Item 1 – pallet transfer station

| Part (drawing no., §12) | Material + heat treatment | Functional dimensions, fits (limits in mm) | Geometric tolerances | Ra | Protection / note |
|---|---|---|---|---|---|
| Station table weldment (VC-MEC-TRF-0510) | S355J2+N tube 60×50×4 / 70×70×5; weld a = 3–4; stress relieved | 4 receiver pads, guide-column bores Ø25 H7 (+0.021/0) | pads flat 0.05 and same height ±0.02 (one setup); bores position Ø0.04, perpendicular 0.03/100 | pads 1.6 | paint C3 except pads |
| Locating receiver, 4 off (VC-MEC-TRF-0020) | 16MnCr5, case hardened CHD 0.8–1.2 mm, 58–62 HRC, ground | Ø60 body in pedestal bore Ø60 H7 (+0.030/0) with Ø60 k6 (+0.002/+0.021); stud bore = stud Ø (catalogue) H7 for the round one; slot H7 wide along x for the second; +0.5 mm for 2 clearance ones; 15° lead-in, catch ±3 mm (lead-in length 3/tan 15° = 11.2 mm); air channel Ø3 | face perpendicular to bore 0.01; all 4 faces at 1050 ±0.02 after mounting | face 0.4, bore 0.8 | oiled; part no. engraved |
| Lift-transfer frame (VC-MEC-TRF-0520) | S355 C 50×40, stress relieved | strands at z = ±140 | chain-guide seats height ±0.1, parallel 0.2 | 3.2 | paint |
| Chain guide strip, 4 off (VC-MEC-TRF-0021) | C45+N, induction hardened 52–56 HRC | 540 long; ends chamfered 2 × 30° | straight 0.1/540 | 1.6 | screw M6 + 2 dowels ISO 8734 Ø6 m6 (+0.004/+0.012) |
| Sprocket shaft (VC-MEC-TRF-0030) | 42CrMo4+QT 28–34 HRC | bearing seats per UCF unit (often h7/h8 with locking collar – catalogue); sprocket seats k6 or clamping bush | runout 0.03 | 0.8 seats | both sprockets in tooth phase |
| Docking bracket, 2 off (VC-MEC-TRF-0530) | S355J2+N; **post 120×120×8** (corrected §9.3) + arm 80×30 flat; base plate 250×250×20; weld a = 5 all round; stress relieved | pin bore Ø20 H7 (+0.021/0); stop face 30 × 60 | stop face at chain top + 40 ±0.1 (shimmed); pin bore position ±0.05 to the station axis (after alignment, then dowelled) | stop face 1.6 | paint; stop face oiled |
| Cone docking pin, 1 round + 1 diamond (VC-MEC-TRF-0031 / -0032) | 16MnCr5, CHD 0.8–1.2, 58–62 HRC | see worked example §14 | coaxiality Ø0.01 | 0.4 | grease |
| Deck bush, 2 off (on AGV deck – AGV supplier builds in) (VC-MEC-TRF-0033) | 16MnCr5, CHD 0.8–1.2, 58–62 HRC | bore Ø25 H7 (+0.021/0), chamfer 5.5 × 45°; flange OD Ø35 k6 (+0.002/+0.018) in housing Ø35 H7 (+0.025/0) + 3 × M6; 2nd bush as diamond partner or slot 25H7 × 27 | bore to OD coaxial Ø0.01 | bore 0.4, chamfer 0.8 | §14 |
| Buffer post + front plate (VC-MEC-TRF-0540) | S355 tube 60×60 + plate 15; own anchors | absorber threads M25×1.5 (per absorber catalogue), cart pin bore | front face at x = 315 ±0.5 | 3.2 | yellow/black (ISO 3864-1) |
| Cart docking pin (VC-MEC-TRF-0034) / bush (-0035) | 16MnCr5 hardened 58–62 HRC | pin Ø30 f7 (−0.020/−0.041), bush Ø30 H8 (+0.033/0): clearance 0.020–0.074; 15° lead-in | coaxial 0.02 | 0.8 | flange 4 × M8 + 2 dowels Ø8 m6 |
| Protective guide rails (VC-MEC-TRF-0550) | S355 flat 15 + UHMW-PE 10 | 1300 long, inner 760, entry +50 per side | straight ±2 | – | countersunk screws 2 mm below |
| BTU counter plate (if MAKE) | C45 induction hardened ≥ 50 HRC or per BTU catalogue | | flat 0.2 | 1.6 | §10.4 |

## 11.2 Item 2 – crate docking stand

| Part | Material | Key specification |
|---|---|---|
| Stand weldment (VC-MEC-DCK-0510) | S355J2+N, legs 80×80×5, rails 100×50×4 | ISO 13920-BF; rails level ±1, parallel ±2 mm; nothing below 270 mm between the legs; weld a = 3–4, ISO 5817 C; no stress relief needed (±5 mm interface) |
| V-guide, 4 off (VC-MEC-DCK-0020) | S355 angle 8 mm + UHMW-PE 10 mm | flare 55 over 60 mm (θ = 47.5°); PE strips with countersunk screws 2 mm below; slotted holes ±5 mm; set with a master crate (5 mm clearance) |
| PU pads | BUY 90 Sh A, 100×80×20 | replaceable |
| Crate (VC-MEC-DCK-0530) | S235JR welded in a jig | outer size ±2 mm, diagonal difference ≤ 3 mm (example), bottom flat ±2 mm, tunnels 220×100; ISO 5817 D; paint or hot-dip galvanised |
| Casting gripper (VC-MEC-DCK-0040) | 42CrMo4+QT for the expanding parts | proof test 2 × load, marked with SWL |

## 11.3 Item 3 – AS/RS front end (conveyors you make)

| Part | Key specification |
|---|---|
| Conveyor side frames (VC-MEC-ASR-0510) | S355 tube 120×40, weld in a jig; chain-guide seats ±0.5 mm (machined or shimmed); P&D section on the crane axis ±2 mm, chain top 320 ±1 mm |
| Chain guides | UHMW-PE strips, countersunk screws, chamfered joints |
| Chains / sprockets | 3/4" roller chain ISO 606, sprockets z ≥ 17 hardened teeth; sprocket alignment ±0.2 mm |
| Guards | EN 619 / ISO 13857: no reachable nip points at sprockets and return strand |
| Side guides + V-flare 40 mm, end stop with PU buffer | S355 + UHMW-PE; end stop sized with E = ½·m·v² for the conveyor speed (203 kg at 0.2 m/s = 4.1 J) |

## 11.4 Item 4 – station ↔ APC connection

| Part | Material | Specification |
|---|---|---|
| Adapter bracket, 2 off (VC-MEC-LDS-0020) | S355J2+N 30 mm plate | contact faces flat 0.02, Ra 1.6; slotted holes ±3 mm for M16; 2 dowel holes reamed **on site** after alignment |
| Bolts | ISO 4017 M16 10.9 + ISO 7089 300 HV | 302 N·m (μ 0.12), F_V,min ≈ 76 kN |
| Dowels | ISO 8734 Ø12 m6 (+0.007/+0.018) | holes Ø12 H7 (0/+0.018) reamed through bracket and APC base together; hardened bushes if the APC base is soft; ISO 8735 (internal thread) for removal |
| Shims | stainless 1.4301, 0.05–1 mm | height ±0.1 |
| Levelling feet | M24 + lock nut + pad | 3.8 kN each |
| Locating blocks on fork rails | doc 09 §11.3 part 7 | now required (§9.1) |
| Drip tray (VC-MEC-LDS-0510) | X5CrNi18-10, 1.5 mm, TIG 141 | slope ≥ 2 % to drain, ISO 5817 D, leak test with water |
| Master pallet (VC-APC-PAL-0030) | as pallet, plus ground studs and dial-gauge seats | stud positions Ø0.005 (twice tighter than production pallets), certificate kept |

## 11.5 Measuring plan (interface parts)

| Characteristic | Limit | Method / gauge |
|---|---|---|
| Receiver faces, same height | ±0.02 | height gauge or dial gauge from a reference |
| Receiver bores | H7 | plug gauge Go/NoGo |
| Receiver / pin hardness | 58–62 HRC, CHD 0.8–1.2 | Rockwell on part or test piece; CHD on a cut test piece (Vickers, ISO 18203) |
| Pin Ø25 g6 / d9 | per §14 | micrometer 0.001 |
| Cone angle 15° | ±0.1° | sine bar or profile projector / CMM |
| Stop faces | chain top + 40 ±0.1 | gauge block + dial gauge |
| Pin position to station axis | ±0.05 | dial gauge from the station axis reference |
| Deck position after docking | ±0.4 (20 dockings) | dial gauge |
| Height step chain-to-chain | ±1.1 | dial gauge across the gap |
| Crate size | ±2 mm, diagonals | gauge frame |
| V-guide clearance | 5 mm | master crate + feeler / ruler |
| Bolts | torque | calibrated wrench, paint mark |
| Anchors | ETA torque | torque wrench |

## 11.6 Installation – numeric limits (summary)

| Step | Limit |
|---|---|
| Floor in AGV lane | ±2 mm over 2 m; steps ≤ 3 mm |
| Station centre from the APC axis | r = 480 ±0.5 mm (item 1), final ±0.05 mm with master pallet (item 4) |
| Receiver faces = machine zero-point faces | ±0.1 mm |
| Level | 0.02 mm/m |
| Buffer post on station axis | ±1 mm |
| Docking pins to station axis | ±0.05 mm, stop faces ±0.1 mm, then dowel |
| Guide rails symmetric | ±2 mm, 20 mm free per side to the AGV |
| Crate stand rails | level ±1 mm, parallel ±2 mm |
| P&D conveyor | crane axis ±2 mm, chain top ±1 mm |
| Clearances to the APC sweep (biggest fixture) | ≥ 30 mm |

---

# 12. Identification and numbering (interfaces)

Project rules: **doc 15**; APC parts: doc 09 §12. Doc 15 wins if anything differs.

## 12.1 Drawing and part numbers

Area **MEC**, groups (doc 15): **TRF** pallet transfer AGV/cart ↔ APC station (item 1) · **DCK** crate docking stand (item 2) · **ASR** AS/RS ↔ AGV (item 3) · **LDS** load station ↔ APC (item 4). Ranges: 0001–0009 assemblies, 0010–0499 parts, 0500–0899 weldments, 0900–0999 diagrams/lists.

| Number | Content |
|---|---|
| VC-MEC-TRF-0001 | transfer station, general assembly |
| VC-MEC-TRF-0510 / -0520 / -0530 / -0540 / -0550 | station table / lift-transfer frame / docking bracket / buffer post / guide rail (weldments) |
| VC-MEC-TRF-0020 / -0021 | locating receiver / chain guide strip |
| VC-MEC-TRF-0030 … -0035 | sprocket shaft, cone pin round, cone pin diamond, deck bush, cart pin, cart bush |
| VC-MEC-DCK-0001 / -0510 / -0020 / -0530 / -0040 | crate stand assembly / stand weldment / V-guide / crate / gripper |
| VC-MEC-ASR-0001 / -0510 | AS/RS front-end layout / conveyor side frame |
| VC-MEC-LDS-0001 / -0020 / -0510 | station ↔ APC connection / adapter bracket / drip tray |
| VC-IF-AGV-APC-0001 | interface sheet AGV ↔ APC load station (item 1, §1.5) |
| VC-IF-AGV-ASR… | interface sheet AGV ↔ AS/RS – check the exact area code for the AS/RS in doc 15 |

- MAKE part number = drawing number without revision; revision letters skip I, O, Q, S, X, Z; non-interchangeable change → new number.
- BUY parts `B-<class>-nnnnn` (e.g. B-CYL station cylinder, B-SEN sensors, B-PNE…, chains and absorbers in the class doc 15 assigns); raw material `R-<class>-nnnnn`.

## 12.2 Fluid-power codes and device tags

- Station lift circuit (fed from the APC unit): circuit 4 – **4A1** station lift cylinder, **4V1** 4/3 valve, **4V2** pilot-operated check valve, **4V3** throttle (continues the APC codes 0…3 of doc 09 §12.2).
- Sensors of item 1 keep their names B11…B24 in the guide; in the schematics use the doc 15 tags: position sensors **-BG** (B11 vehicle docked → e.g. +FLD.TRF-BG11), pressure switches **-BP** (B24 seat check), motors **-MA** (M1 chain motor → -MA1), push-buttons **-SF**. Valve codes -QM/-MB: verify (doc 15).

## 12.3 Serials and load carriers

- Pallets **PAL-0007** (engraved + HF RFID), crates **CRT-000123** (barcode both sides or UHF RFID), fixtures FIX-nnnn – the RFID at the station reads PAL-…, the stand reader reads CRT-… (doc 15 §3.9).
- Own-built assemblies with a type plate get a serial `<type>-YYWW-nnnnn` (restarts every ISO week). Doc 15 lists no type code for transfer stations – if you want one, add it there first (do not invent it locally).

---

# 13. Standards for the interfaces (table)

Manufacturing, welding, fasteners, hydraulics, paint and general safety standards: **doc 09 §13**. Project-wide register with editions: **doc 16**. "Check" = read the clause in the current edition.

| Standard | Title (short) | Requirement used here | Value / example | Verification |
|---|---|---|---|---|
| ISO 12100 | risk assessment | for station, AGV docking, stand, AS/RS front end | one integrator for the whole system | risk assessment file |
| ISO 13849-1 / -2 | safety-related control | interlocks of §1.5 and §4.4 | PL d (example from the page) | calculation, validation test |
| ISO 13855 | approach speeds → safety distance | light curtains item 1 and 3 | S = 1600·T + 850 = 1682 mm (item 3) | stop-time measurement |
| ISO 13857 | reach distances | fence openings, mesh, gap at the floor | square mesh 30–40 mm → ≥ 200 mm from the hazard | measure |
| IEC 61496-1/-2 | light curtains (ESPE) | type 4 devices | type 4 | device certificate |
| IEC 62046 | application of protective equipment (presence detection) | muting with 2 independent signals, time limit | docked + E84 VALID | function test |
| ISO 14119 / ISO 14120 | interlocks / guards | doors with guard locking, fixed guards | – | test, inspection |
| ISO 3691-4 | driverless industrial trucks – safety | AGV supplier side: personnel detection, speeds at stations | – | supplier declaration |
| EN 619 | continuous handling of unit loads | chain conveyors, guards, nip points | – | inspection |
| EN 528 | rail-dependent storage and retrieval equipment | stacker crane safety | – | AS/RS supplier |
| EN 15512 / EN 15620 / EN 15635 | racks: design / tolerances / use and inspection | AS/RS racks | yearly rack inspection | inspection report |
| SEMI E84 | parallel I/O handover (PIO) | E84 handshake signals | VALID, CS_0, L_REQ … | signal test |
| VDA 5050 (VDA recommendation, not ISO/EN) | AGV ↔ fleet manager interface | orders, actions | – | integration test |
| ISO 606 | short-pitch roller chains | 10B-1, 3/4" chains | breaking load from catalogue | delivery note |
| ISO 286 / ISO 1101 / ISO 2768 | fits / GD&T / general tolerances | pins, bushes, receivers | g6, H7, d9, k6 | gauges |
| ISO 8734 / ISO 8735 | hardened dowel pins | brackets, stations | Ø12 m6 | – |
| ISO 4017 / ISO 4762 / ISO 898-1 | bolts | M16 10.9 etc. | 302 N·m | torque wrench |
| ISO 5817 / ISO 13920 | weld quality / weldment tolerances | stand, brackets | C / BF | VT |
| ISO 3864-1 | safety colours | yellow/black stops, posts | – | visual |
| EN 1992-4 + anchor ETA | anchors in concrete | posts, stand, station feet | per ETA | torque |
| EN 14985 (check) | slewing jib cranes | jib crane item 2 | SWL 63 kg, proof load per supplier | supplier certificate |
| ISO 11228-1 (check) | manual handling – lifting | 32 kg castings → lifting aid | reference mass in the standard | ergonomic assessment |
| EN 12464-1 | lighting of work places | ≥ 300 lx at the HMI (page value) | – | lux meter |

---

# 14. Complete worked example – one cone-pin docking unit (item 1)

One docking unit = station bracket (post + arm + stop face) + hanging cone pin + deck bush on the AGV. Two units per station (round pin z = +350, diamond pin z = −350).

## 14.1 Requirements (from §1.4 and the interface sheet)

| Item | Value |
|---|---|
| AGV error at the pin | e = 10 + 350·sin 0.5° = 13.1 mm → catch ≥ e + 2 → **±16 mm** |
| Lateral force to move the deck | 195 N (friction 65 N + springs 131 N) |
| Deck push-up | 600 N (torque limit) – fault maximum to be confirmed by the AGV supplier |
| Transfer reaction along x | 654 N (2 pins → 327 N each) |
| Final lateral accuracy of the deck | ±0.4 mm (chain to the receivers) |
| Stop face height | deck chain top + 40 = station chain top + 40 mm → 1144 mm |

## 14.2 Geometry

- Pin Ø25 (r_b = 12.5 mm bush), tip radius r_t = 2 mm, cone half-angle β = 15°, bush chamfer c = 5.5 × 45°.
- Catch K = r_b + c − r_t = 12.5 + 5.5 − 2 = **16 mm** ✓.
- Cone length (12.5 − 2)/tan 15° = **39.2 mm** → 40 mm on the drawing; cylindrical Ø25 part 20 mm above the cone (engages the bush at the end of the docking stroke).
- Docking stroke after first contact ≥ 39 + 5.5 + 20 = 65 mm → deck lift creep zone 80 mm (example).

## 14.3 Forces

| Case | Formula | Result |
|---|---|---|
| On the 15° cone | F_v = 195·tan(15° + 8.5°) | 85 N |
| On the 45° chamfer (offset > 10.5 mm) | F_v = 195·tan(45° + 8.5°) | **264 N** ≤ 300 N (50 % of 600) ✓ |
| Max lateral force (wedge limit, deck pushes 600 N) | 600·(1 − 0.15·tan 15°)/(tan 15° + 0.15) | **1378 N** → design load for pin and post |
| Stop face (2 brackets) | 600/2 | 300 N each |

## 14.4 Pin strength and contact

- Lever from bracket face to cone contact ≈ 60 mm, root Ø25: σ = 32·F·l/(π·d³).
  Normal 195 N: 32·195·60/(π·25³) = **7.6 N/mm²**; wedge limit 1378 N: **54 N/mm²**. Core of case-hardened 16MnCr5 Re > 600 N/mm² (check the certificate) → large reserve; fatigue no issue.
- Hertz on the bush edge: **440 N/mm²** (§10.4) ✓ for 58–62 HRC.
- Spigot Ø20 (shear at 1378 N): τ = 1378/314 = 4.4 N/mm² ✓.

## 14.5 Pin mounting to the bracket arm

- Flange Ø60 × 10, spigot **Ø20 k6 (+0.002/+0.015)** in bracket bore **Ø20 H7 (+0.021/0)** → from 0.015 interference to 0.019 clearance (location, removable).
- 3 × ISO 4762 **M8 10.9** on bolt circle Ø44 (R = 22 mm), torque 36 N·m, F_V,min = 28.0/1.6 = 17.5 kN each.
- Moment at the flange in the wedge-limit case M = 1378·0.060 = 82.7 N·m → bolt force F = 2·M/(n·R) = 2·82.7/(3·0.022) = **2.5 kN** ≪ 17.5 kN → the flange never lifts ✓.
- Diamond pin only: orientation dowel ISO 8734 **Ø5 m6 (+0.004/+0.012)** in the flange so the lands point along x.

## 14.6 Fits pin ↔ deck bush

| Pin | Pin limits | Bush | Clearance | Effect |
|---|---|---|---|---|
| Round Ø25 **g6** | −0.007/−0.020 | Ø25 **H7** (+0.021/0) | 0.007–0.041 | lateral position ±0.02 |
| Diamond Ø25 **d9**, lands b = 2.5 mm along x | −0.065/−0.117 | Ø25 H7 | 0.065–0.138 | tolerates distance error δ = c·D/(2b) = 0.065·25/5 = 0.33 mm ≥ 0.28 needed ✓ |

Deck bush: flanged, OD **Ø35 k6 (+0.002/+0.018)** in housing **Ø35 H7 (+0.025/0)**, fixed by 3 × M6; the bore does not shrink. (A plain press-fit bush H7/r6, interference 0.009–0.050, shrinks the 5 mm wall bore → bore must be finished after pressing.)

## 14.7 Bracket post (stiffness decides)

| Section | I (mm⁴) | f at 131 N (z) | f at 327 N (x) | σ at 1378 N |
|---|---|---|---|---|
| 60 × 60 × 5 (page) | 0.56·10⁶ | 0.56 mm ✕ | 1.39 mm ✕ | 85 N/mm² |
| 100 × 100 × 6.3 | 3.47·10⁶ | 0.09 mm ! | 0.22 mm ! | 23 N/mm² |
| **120 × 120 × 8 (chosen example)** | 7.53·10⁶ | **0.04 mm ✓** | **0.10 mm** (x is less critical) | 13 N/mm² |

L = 1144 mm, E = 210 000 N/mm², f = F·L³/(3EI). Better still (and cheaper): connect the two posts by a cross beam at the top and bolt it to the station table frame – then the pins are supported by the stiff station.
- Post-to-base-plate weld: fillet a = 5 all round; W_w ≈ ((130⁴ − 120⁴)/12)/65 = 100 300 mm³; M = 1378·1.144 = 1576 N·m → σ_w = **15.7 N/mm²** ✓ (doc 09 §10.4).
- Base plate 250 × 250 × 20, 4 bonded anchors M12 on 180 × 180: tension ≈ M/(0.18 m)/2 = 1576/0.18/2 = **4.4 kN** per anchor (only in the wedge-limit case) → check against the anchor ETA (page example allows 8 kN).

## 14.8 Materials, heat treatment, drawing callouts – cone pin (VC-MEC-TRF-0031 round / -0032 diamond)

| Feature | Callout |
|---|---|
| Material | 16MnCr5 (1.7131), EN 10204 3.1 |
| Heat treatment | case hardened, CHD 0.8–1.2 mm (550 HV), surface 58–62 HRC; spigot thread-free, no soft zones needed |
| Ø25 g6 (−0.007/−0.020) | ground, Ra 0.4, cylindricity 0.005 |
| Cone 15° ±0.1° (half-angle), length 40 | ground and polished, Ra 0.4, tip R2 |
| Spigot Ø20 k6 (+0.002/+0.015) = datum A | ground, Ra 0.8 |
| Flange face = datum B | perpendicular 0.01 to A, Ra 1.6 |
| Ø25 and cone | coaxial Ø0.01 to A |
| Bolt holes 3 × Ø9 on Ø44 | position Ø0.2 |
| Diamond pin lands | width 2.5 ±0.1, symmetric 0.05 to A; dowel hole Ø5 H7 at 0° ±0.1° |
| Edges | ISO 13715 −0.3; all cone/cylinder edges R0.5 polished |
| Marking | part no. + rev + "R" or "D" on the flange (electro-etched) |

Manufacturing route: saw bar R-BAR (16MnCr5) → turn with 0.3 mm grinding allowance on Ø25, cone and spigot → drill flange → (diamond: mill flats) → carburise, harden, temper (test piece in the same batch for CHD) → grind spigot, Ø25, cone between centres in one setup → polish cone → measure → etch number → oil.

## 14.9 Inspection of the pin (example plan)

| Characteristic | Gauge | Accept |
|---|---|---|
| Ø25 g6 | micrometer 0.001 | 24.980–24.993 |
| Ø25 d9 (diamond) | micrometer | 24.883–24.935 |
| Spigot Ø20 k6 | micrometer | 20.002–20.015 |
| Cone angle | sine bar + dial gauge or CMM | 15° ±0.1° |
| Coaxiality | V-block/centres + dial gauge | ≤ 0.01 TIR |
| Hardness | Rockwell on the flange | 58–62 HRC |
| CHD | Vickers traverse on test piece | 0.8–1.2 mm |
| Ra | roughness tester | ≤ 0.4 |

## 14.10 Installation, alignment and test

1. Set the brackets at z = ±410 mm, anchors finger-tight; (better) bolt the top cross beam to the station table.
2. Raise the station chains to the UP stop. Shim the stop faces to chain top + 40 ±0.1 mm (gauge block + dial gauge).
3. Fit the pins; with a dial gauge from the station axis reference set each pin to ±0.05 mm (z) and the two pins 700 ±0.1 mm apart; tighten; ream Ø8 H7 and fit 2 dowels ISO 8734 Ø8 m6 per bracket arm.
4. Tighten anchors per ETA after the grout has cured; re-check step 2–3.
5. Test with the AGV: 12 mm offset in x and z and 0.7° turned, both directions → docks every time; measure the deck position after 20 dockings: **±0.4 mm**; push 200 N sideways on the docked deck → movement ≤ 0.05 mm (checks the post stiffness).
6. Record values under the station drawing number and the AGV serial.

---

# 15. Data you still need (honest list)

| # | Data | From whom | Needed for |
|---|---|---|---|
| 1 | Real AGV stop accuracy (x, z, angle) under your floor conditions, in writing | AGV supplier | catch ranges, float range |
| 2 | Maximum deck lift force **including stall / fault**, lift speed, deck design (BTU rating, counter surface, springs, lock pin) | AGV supplier | pin and post design load (§9.4) |
| 3 | Pull-stud diameter and fits, zero-point face height | module supplier / machine builder | receiver bores, H0 |
| 4 | APC base bolting face, dowel position and material | APC/machine builder | item 4 bracket |
| 5 | Largest fixture and part envelope | fixture design | sweep circle vs AGV, brackets |
| 6 | Chain, sprocket, absorber, retractable-stop data (energy per stroke ≥ 10 J) | catalogues | item 1 parts |
| 7 | Crane stop time near the P&D, P&D accuracy, rated load | AS/RS supplier | ISO 13855, conveyor layout |
| 8 | Crate drawing and tolerances of the real crates in circulation | crate maker | V-guides, contour check |
| 9 | Floor survey (flatness, joints, concrete class/thickness) | civil engineer | anchors, AGV lane |
| 10 | Anchor ETA data | anchor supplier | installation |
| 11 | Risk assessment + required PL per safety function | integrator | interlocks, muting |
| 12 | Jib crane foundation data | crane supplier | item 2 |
| 13 | AS/RS area code and interface sheet numbers, BUY classes for chains/absorbers | doc 15 owner | §12 |
| 14 | Current editions of ISO 13855, ISO 13857, ISO 3691-4, EN 619, EN 528 | standards shop | clauses may change |

---

# 16. Glossary (all items)

| Term | Meaning |
|---|---|
| AGV | Automated Guided Vehicle |
| Underride (latent) AGV | low AGV that drives under a load and lifts it |
| AS/RS | Automated Storage and Retrieval System (racks + stacker crane) |
| WMS | Warehouse Management System |
| P&D | Pick-up and Drop-off position of the crane |
| APC | Automatic Pallet Changer (doc 09) |
| Load station | place where the operator loads / unloads the pallet; APC takes the pallet from here |
| Locating receiver | hardened bush that centres a pull stud (no clamping) |
| Zero-point module | clamping unit in the machine (catch ±1 mm, repeatability ±0.005 mm) |
| Floating deck | AGV deck on ball transfer units that can move freely ±20 mm |
| Ball transfer unit | ball in a housing; lets a plate roll in all directions with very low friction |
| Lock pin | conical pin that centres and locks the floating deck while driving |
| Cone pin / diamond pin | round locating pin / pin with 2 flats (locates in one direction only) |
| Stop face | machined face that sets a height by contact |
| Catch range (K) | how far off a part may arrive and still be guided into place; cone: K = r_b + c − r_t |
| V-flare / V-guide | inclined guide face that centres a load while it is lowered; needs θ > atan μ |
| Friction angle | φ = atan μ |
| Over-determined | more locating features than needed → jams; use 1 round + 1 diamond / slot |
| Worst case / RSS | sum of all errors / √(sum of squares) |
| Retractable stop | stop that moves up to stop the pallet and down to let the APC turn |
| Retention pawl | latch that holds the pallet on the AGV deck while driving |
| E84 / PIO | optical parallel I/O handshake (VALID, CS_0, L_REQ, U_REQ, TR_REQ, READY, BUSY, COMPT, HO_AVBL, ES) |
| VDA 5050 | communication standard fleet manager ↔ AGV (over MQTT) |
| Muting | temporary, controlled bridging of a light curtain for material (IEC 62046) |
| Safety distance S | S = K·T + C (ISO 13855) |
| Bridge section | conveyor through the fence opening without a stop position |
| Contour check | light grids + scale + ID reader before the AS/RS |
| Jib crane / SWL | column crane with slewing arm / safe working load |
| Master pallet | reference pallet for alignment and checks |
| Dowel pin | precision pin that fixes position after alignment |
| Preload | clamping force of a tightened bolt |
| FAT / SAT | Factory / Site Acceptance Test |
| LOTO | Lock-Out Tag-Out |
| CE marking | EU conformity marking of the complete machine system |
| MAKE / BUY | you manufacture / buy from a catalogue or supplier |
| Diamond pin land b | narrow cylindrical part left on a relieved pin; clearance rule δ ≈ c·D/(2·b) |
| Wedge limit | largest lateral force a cone can create from a limited push: F = F_v/tan(β + φ) |
| Centripetal acceleration | ω²·r – pushes a load outward on a turning arm |
| Polygon effect | speed variation of a chain on a sprocket, 1 − cos(180°/z) |
| Hertz pressure | contact pressure between curved parts (doc 09 §10.6) |
| CHD | case hardening depth (ISO 18203) |
| g6, H7, d9, k6 | ISO 286 fit symbols (capital = hole, small = shaft) |
| ETA | European Technical Assessment of an anchor |
| SEMI E84 | the standard behind the E84 parallel I/O handshake |
