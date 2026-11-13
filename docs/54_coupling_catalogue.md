# 54 – Coupling catalogue: 63 coupled tool chains with guide, example and modules

> No tab in the twin yet (guide only). Continues guide 52 (software overview) and guide 53 (how coupling works, FMI,
> formulas for step sizes). State: **November 2026**. Menu names change between versions – where a menu is not certain it
> says "see maker help". All numbers are **example values** – replace them with your design data. Module names are the
> product names sold today; bundles and names change, so **ask the reseller for a written quote listing every module**.
> Ratings ★ are engineering estimates.

## Contents
0. How to read this catalogue · 0.1 Template of each coupling · 0.2 Quick finder (problem → coupling) ·
0.3 Master chain for the compressor (all couplings together)
Part A – CAD ⇄ simulation models (C1–C9)
Part B – Multibody ⇄ control (C10–C15)
Part C – FEA ⇄ multibody: flexible bodies and loads (C16–C21)
Part D – Fluids and particles (C22–C30)
Part E – 1D system ⇄ 3D / control (C31–C37)
Part F – Electromagnetic / motor (C38–C40)
Part G – Manufacturing process chain (C41–C47)
Part H – Control ⇄ PLC, real time, virtual commissioning (C48–C56)
Part I – Optimisation, test data, glue (C57–C63)
Part M – Modules: master list per vendor, minimum sets per chain, budget packs, open-source equivalents
Glossary

---

## 0. How to read this catalogue

### 0.1 Template of each coupling
Every coupling C1…C63 has the same blocks:

| Block | What you find |
|---|---|
| Header | **Type** (file / model export / co-simulation / FMU / platform / SIL / HIL), **direction**, **data** with units |
| Why / when | The engineering question it answers – and when a simpler way is enough |
| How it works | The principle and the key formula |
| Step by step | Numbered set-up steps |
| Example | Worked example with numbers from the compressor factory (example values) |
| Modules | Exact licence modules for each tool, free add-ons marked |
| Watch out | Typical errors |
| Check | How to prove the coupled result is right |

**Golden rules (from guide 53):** validate each model alone first · same units and origin · choose the simplest coupling
that answers the question (file → model export → co-sim) · communication step Δt_c ≤ 1/(10…20·f_max) · halve the step and
compare (< 2 %) · write the version pair of both tools into the project record.

### 0.2 Quick finder – problem → coupling

| Your question | Coupling(s) |
|---|---|
| Move my CAD assembly with a motor and controller | C1, C2, C11 |
| Mechanism with contact / friction + controller | C10, C12, C13, C14, C15 |
| Mechanism with a part that bends (crankshaft, frame) | C16, C17, C18, C21 |
| Fatigue life from motion loads | C19, C20, C47 |
| Stress from my CAD quickly, inside CAD | C4, C5, C6 |
| Particles: shot blasting, chips, powder, sand | C7, C22, C23, C24, C29, C30 |
| Air or oil pushing on a flexible part (valve reed) | C25, C26, C28, C63 |
| Hot cylinder / head → thermal stress | C27 |
| Valve, pulsation, FAD, compressor cycle | C31, C32 |
| Hydraulic cylinder / press / APC + mechanism | C33, C34, C35 |
| Fast model of a big simulation for the twin | C36, C37, C62 |
| Motor efficiency, motor control, motor noise | C38, C39, C40 |
| Safe G-code, shorter cycle time | C41, C45, C46 |
| Casting, welding, heat treatment, 3D printing effects on the part | C42, C43, C44, C47 |
| Generate and test PLC code before the machine exists | C48, C49, C50, C51, C52, C53, C54, C56 |
| Test the real controller against a simulated machine | C55 |
| Electrical drawings → PLC hardware configuration | C8 |
| Find best design automatically | C57, C58, C59, C60 |
| Make the model agree with measurements | C61 |
| Feed simulation results into this digital twin | C62 |
| Couple tools from different vendors | C63, FMI (guide 53) |

### 0.3 Master chain for the compressor (example of all couplings working together)

```
 DESIGN                     ANALYSE                                   MAKE                        RUN / TWIN
 SOLIDWORKS/NX ──C1──> Simscape Multibody ──C11──> motor + PID ──C48/C49──> PLC code + PLCSIM ──C62──> Python twin
      │                                                                                                   ▲
      ├──C3──> Adams crank mechanism <──C16── Ansys flexible crankshaft                                   │
      │            │ C19/C20 bearing loads ──> Ansys + nCode fatigue <──C47── induction hardening residual │
      │            └─C34── Amesim hydraulic APC                                                           │
      ├──C31─> GT-SUITE valves + pulsation ⇄ Simulink pressure control ──C37 ROM/FMU──────────────────────┤
      ├──C25─> Fluent ⇄ Mechanical valve reed FSI     C27 cylinder CHT → thermal stress                   │
      ├──C38─> Motor-CAD efficiency map ──> Simulink drive model   C40 motor noise                        │
      ├──C42─> MAGMASOFT crankcase casting → porosity → local fatigue in FEA                              │
      ├──C41─> CAM → post → VERICUT → HMC     C46 chatter lobes → spindle speed                           │
      └──C9/C50/C51/C53─> NX MCD / Process Simulate / Plant Simulation ⇄ PLCSIM Advanced (virtual commissioning)
```

Order to build it (recommended): **1)** C1 + C11 (cheap, MATLAB only) → **2)** C3 + C16 + C19 crankshaft →
**3)** C31 compressor cycle → **4)** C41 + C46 machining → **5)** C49/C50 virtual commissioning → **6)** C37 + C62 twin.

---
## Part A – CAD ⇄ simulation models

> Common example data used in Part 1 (example values, V-type 2-cylinder compressor): bore 65 mm, stroke 46 mm (crank
> radius r = 23 mm), conrod length 105 mm, speed 1450 rpm (ω = 151.8 rad/s, f = 24.2 Hz), piston 0.35 kg, conrod 0.45 kg,
> peak gas pressure 0.8 MPa (gauge), drive power 3 kW, motor 2930 rpm, V-belt pulleys Ø100 / Ø202 mm.

### C1 – SOLIDWORKS → Simscape Multibody

| Type | Direction | Data exchanged |
|---|---|---|
| Model export (one-way) | CAD to MATLAB | Bodies (mass kg, inertia kg·m², CoG mm), mates as joints, part geometry (STEP), colours |

**Why / when to use:** you want the motion and forces of a mechanism (crank train, APC arm, robot gripper) **together with
a controller** in Simulink. Not for stress (use FEA) and not when the CAD changes every hour (export is one-way, you re-export).

**How it works:** the add-in reads the assembly tree. Each rigid sub-assembly becomes one body. Each mate pair becomes a
joint (concentric + coincident = revolute, etc.). It writes an XML file plus one STEP file per part. `smimport` builds a
Simulink model with File Solid / Rigid Transform / Joint blocks. Equations: Newton–Euler for every body, solved by a Simulink solver.

**Step by step**
1. Download the *Simscape Multibody Link* add-on zip that matches your MATLAB release (same release is mandatory).
2. MATLAB (run as administrator): `install_addon('smlink.r20XXx.win64.zip')`, then `regmatlabserver`.
3. SOLIDWORKS: Tools → Add-ins → tick **Simscape Multibody Link**.
4. Clean the assembly: real material on every part, base part fixed, no redundant mates, simple mates (concentric,
   coincident, distance). Suppress fasteners and cosmetic parts (fewer bodies = faster).
5. Tools → Simscape Multibody Link → Export → Simscape Multibody → choose folder. Result: `crank.xml` + STEP files.
6. MATLAB: `smimport('crank.xml')` → model opens; run once to see the Mechanics Explorer animation.
7. Add actuation: Revolute joint → Actuation → Motion "Provided by input" (speed) or Torque input.
8. Add sensors (joint angle, constraint force), then your motor model / controller.
9. Solver: variable-step `ode23t` or `ode15s`, max step 1e-4 s for 1450 rpm (≈ 400 points per revolution).

**Example (example values) – primary inertia force of one cylinder**
- Reciprocating mass m_rec = piston + 1/3 conrod = 0.35 + 0.15 = **0.50 kg**.
- Primary force F1 = m_rec · r · ω² = 0.50 · 0.023 · 151.8² = **265 N** peak.
- Gas force F_gas = p · A = 0.8 MPa · (π/4 · 65²) = 0.8 · 3318 mm² = **2655 N**.
- In Simscape: drive the crank at 1450 rpm, read the constraint force at the piston pin. With gas force = 0 you must see
  ≈ 265 N primary + a smaller secondary part (r/l = 23/105 = 0.22, so ≈ 22 % of F1 at 2× frequency).

**Modules / licences:** MATLAB + Simulink + **Simscape** + **Simscape Multibody**; *Simscape Multibody Link* add-on is
**free** (supplied by MathWorks). SOLIDWORKS (any edition: Standard, Professional or Premium).

**Watch out**
- MATLAB and Link release differ → export fails or XML is not read.
- Over-constrained mates → "redundant constraints" warning, wrong joint forces.
- Units: SOLIDWORKS mm + g → check that mass in Simulink is kg.
- Flexible or sliding mates (path mate, cam mate) are not all translated – rebuild them as joints by hand.

**Check of result:** total mass and CoG in Simulink = SOLIDWORKS Mass Properties (± 0.5 %). Free-run (no gravity, no
torque) must keep constant speed (energy drift < 0.1 % per revolution).

---

### C2 – Creo / Inventor / Onshape / NX → Simscape Multibody

| Type | Direction | Data exchanged |
|---|---|---|
| Model export (one-way) | CAD to MATLAB | Same as C1: bodies, inertia, joints, STEP geometry |

**Why / when to use:** same as C1 when your design office uses another CAD. Choose the path by CAD:

| CAD | Path | Note |
|---|---|---|
| PTC Creo | Simscape Multibody Link plug-in for Creo (same zip as C1) | Register Creo protk.dat entry as in MathWorks help |
| Autodesk Inventor | Simscape Multibody Link plug-in for Inventor | Inventor Add-Ins manager → load |
| Onshape | `smexportonshape('document URL')` in MATLAB | Needs internet + Onshape API keys – export once online, then work offline |
| Siemens NX | **No official Link plug-in known to us** – STEP per part + build with File Solid blocks, or third-party exporters | Check MathWorks File Exchange / your reseller |

**How it works:** identical principle to C1; the plug-in reads constraints of the CAD system and writes the XML.

**Step by step (Creo / Inventor)**
1. Install the Link add-on (C1 step 1–2).
2. Creo: add the Link to Creo's auxiliary applications (menu name varies by version – see MathWorks help);
   Inventor: Tools → Add-Ins → Simscape Multibody Link → Load.
3. Use *connections* (Creo pin, slider) or Inventor *joints* – they translate more cleanly than plain mates.
4. Export → XML + STEP → `smimport` in MATLAB.
5. NX: export each body as STEP in its own coordinate frame, note joint positions, build the model with File Solid +
   Revolute Joint blocks.

**Example (example values) – APC turntable from Onshape**
APC rotor J = 25 kg·m², rotate 180° (π rad) in 2.5 s with a triangular speed profile:
α = 4θ / t² = 4π / 6.25 = **2.01 rad/s²**, motor torque at table T = J·α = **50.3 N·m**, peak speed ω_max = 2θ/t = **2.51 rad/s**.
Simscape result must show the same peak torque (+ friction you add).

**Modules / licences:** as C1 (Link free). Onshape account (cloud – not for the offline PC). NX path needs no plug-in.

**Watch out:** Onshape export needs internet; Creo flexible components are frozen; NX manual path = no update link at all.

**Check of result:** body count and mass list = CAD BOM; peak torque vs hand formula ± 2 %.

---

### C3 – CAD (Parasolid / STEP) → Adams (incl. Adams Machinery)

| Type | Direction | Data exchanged |
|---|---|---|
| File transfer (one-way) | CAD to Adams | Solid geometry (.x_t, .stp), mass from geometry × density; joints are rebuilt in Adams |

**Why / when to use:** detailed mechanism dynamics with **contacts, friction, bushings, belts, gears, bearings**, many
load cases, durability loads. Use Simscape (C1) if the main goal is the controller; use Adams if the main goal is loads.

**How it works:** Adams imports the geometry as rigid parts, computes mass and inertia from volume × density (or you
type them). You add joints, forces, motions. Adams Solver integrates the DAE system (GSTIFF / HHT integrators).
**Adams Machinery** adds ready-made templates: gears, belts, chains, bearings, cables, motors, cams.

**Step by step**
1. CAD: export Parasolid (.x_t) of the assembly (keeps solids, best for Adams), units mm.
2. Adams View: File → Import → Parasolid; one Adams part per CAD body (merge fasteners).
3. Set material per part (steel 7801 kg/m³, aluminium 2740 kg/m³) or enter mass/inertia from CAD.
4. Create joints (revolute at main bearings, crank pin, piston pin; translational piston–cylinder).
5. Add motion: crank speed 1450 rpm = 8700 °/s (`8700d * time`), or a motor torque.
6. Add gas force as a SPLINE of pressure vs crank angle × piston area.
7. Machinery → Belt: define pulleys Ø100 / Ø202 mm, belt type, centre distance.
8. Simulate: 10 revolutions, output 200 steps per revolution.
9. Plot joint reaction forces (main bearings, crank pin) and belt forces.

**Example (example values)**
- 10 revolutions at 24.17 rev/s = **0.414 s**; 2000 output steps → step **0.207 ms**.
- Belt speed v = π · 0.1 m · 2930 / 60 = **15.3 m/s**; pulley ratio 2930 / 1450 = 2.02 → Ø202 mm.
- Effective belt pull F_e = P / v = 3000 / 15.34 = **196 N**; compressor shaft torque T = P / ω = 3000 / 151.8 = **19.8 N·m** (mean).
- Peak crank-pin load ≈ gas 2655 N + inertia 265 N ≈ **2.9 kN** – Adams shows the exact time history.

**Modules / licences:** **Adams View** (pre/post) + **Adams Solver**; **Adams Machinery** (gear, belt, chain, bearing modules)
– all from Hexagon (MSC Software). CAD export: Parasolid export is standard in SOLIDWORKS, NX, Solid Edge, Creo (STEP).

**Watch out:** CAD mates are lost – rebuild joints; small fillets make heavy geometry (simplify); wrong density
→ wrong inertia; redundant joints (use inline/primitive joints or bushings).

**Check of result:** Adams total mass = CAD ± 1 %; mean shaft power = gas work per cycle × frequency (± 5 %).

---

### C4 – CAD ⇄ Ansys Workbench (associative Geometry Interfaces, SpaceClaim / Discovery)

| Type | Direction | Data exchanged |
|---|---|---|
| Platform link (two-way for parameters) | CAD to Ansys, parameters back | Geometry, named selections, CAD parameters (mm) ⇄ design points |

**Why / when to use:** FEA / CFD of a part that will change many times (wall thickness, rib height, fillet). The link
updates the mesh and result when CAD changes. Do not use it for imported "dead" STEP files – use SpaceClaim / Discovery
(direct modelling) to repair and simplify them.

**How it works:** the CAD Geometry Interface plug-in reads the native CAD file through the running CAD (SOLIDWORKS,
Creo, NX, Inventor, Solid Edge, CATIA V5 with extra licence). CAD parameters with a prefix (default `DS_`) appear in
Workbench Parameter Set → you build a design-point table → Workbench updates CAD, mesh, solve for each row.

**Step by step**
1. Install Ansys with **Geometry Interfaces** for your CAD (installer option) and run "CAD Configuration Manager".
2. In CAD: name the dimensions you want to vary with prefix `DS_` (e.g. `DS_wall`).
3. Workbench: Static Structural → Geometry → Import → native CAD file (or from the Ansys menu inside CAD).
4. Tick "Parameters" in geometry properties; DS_ dimensions appear in Parameter Set.
5. Mechanical: mesh, loads (bolt pretension, pressure), results as output parameters (max stress, deformation).
6. Parameter Set: add design points (e.g. wall 6 / 7 / 8 / 9 / 10 mm) → Update All Design Points.
7. Optional: DesignXplorer response surface / optimisation.

**Example (example values) – head bolt M8 8.8 and crankcase wall**
- Preload F_V ≈ 0.7 · R_p0.2 · A_s = 0.7 · 640 · 36.6 = **16.4 kN**; tightening torque T ≈ K · F · d = 0.2 · 16 397 · 0.008 = **26.2 N·m**.
- 5 design points (wall 6–10 mm) × ≈ 4 min each = **20 min** batch. Output: max stress at bolt boss vs wall → choose the
  smallest wall with safety factor ≥ 2.

**Modules / licences:** **Ansys Mechanical** (Pro / Premium / Enterprise), **Ansys Geometry Interfaces** for the CAD
(some are included, CATIA V5 / NX may need an extra licence), **Ansys SpaceClaim** or **Discovery** (direct modelling),
optional **DesignXplorer**. Ansys is now part of Synopsys.

**Watch out:** CAD and Ansys version combination must be supported (check the Ansys "CAD support" table); named
selections lost when CAD faces are rebuilt; CAD must be installed on the same PC.

**Check of result:** compare one design point with a hand bolt calculation (VDI 2230 style) ± 20 %; mesh convergence < 5 %.

---

### C5 – CAD ⇄ COMSOL (LiveLink for SOLIDWORKS / Inventor / Creo / NX …)

| Type | Direction | Data exchanged |
|---|---|---|
| Platform link (live, two-way parameters) | CAD ⇄ COMSOL | Geometry, CAD parameters, selections |

**Why / when to use:** coupled physics on a CAD part – heat + flow + stress (cylinder fins), induction heating,
electric motor, acoustics. COMSOL changes CAD parameters during a parametric sweep or optimisation. For simple linear
stress, CAD-embedded FEA is cheaper.

**How it works:** the LiveLink keeps a live connection to the open CAD session; geometry is synchronised; parameters
from CAD can be swept in COMSOL Study → Parametric Sweep.

**Step by step**
1. Install COMSOL with the **LiveLink for <CAD>** product; the installer adds a COMSOL tab in the CAD.
2. Open the part in CAD; in COMSOL: Geometry → LiveLink Interfaces → <CAD> → Synchronize.
3. Select which CAD parameters to link (fin pitch, fin height).
4. Add physics: Heat Transfer in Solids + convective heat flux (h), or Conjugate Heat Transfer with flow.
5. Study → Parametric Sweep over CAD parameters → COMSOL updates CAD and remeshes each case.

**Example (example values) – cylinder cooling fin efficiency**
Fin efficiency η = tanh(mL) / (mL), m = √(2h / (k·t)); h = 40 W/m²K, fin thickness t = 3 mm, length L = 20 mm.
- Cast iron k = 50 W/mK: m = 23.1 1/m, mL = 0.462 → **η = 0.934**.
- Aluminium k = 150 W/mK: m = 13.3 1/m, mL = 0.267 → **η = 0.977**.
COMSOL sweep of fin height 15–30 mm must reproduce this trend (2D straight-fin case ± 3 %).

**Modules / licences:** **COMSOL Multiphysics** + **LiveLink for SOLIDWORKS / Inventor / PTC Creo Parametric / Solid Edge /
NX / AutoCAD** (one LiveLink product per CAD) + physics module (**Heat Transfer Module**, **CFD Module**,
**Structural Mechanics Module**). Optional **LiveLink for MATLAB** for scripting.

**Watch out:** CAD must stay open during sync; sliver faces from CAD break the mesh (use "Form Union" + virtual
operations); version pairs CAD/COMSOL must be supported.

**Check of result:** single-fin result vs η formula ± 3 %; energy balance (heat in = heat out) < 1 %.

---

### C6 – SOLIDWORKS ⇄ SOLIDWORKS Simulation / Flow Simulation / Motion (embedded chain)

| Type | Direction | Data exchanged |
|---|---|---|
| Platform (inside one CAD) | Motion to Simulation; Flow to Simulation | Joint/contact forces at chosen frames (N), pressures, temperatures (°C) |

**Why / when to use:** a designer wants quick answers without leaving CAD: motion loads → stress of the conrod, fan
air pressure → stress, temperature → thermal stress. Not for strong nonlinear contact, fatigue certification or CFD
with rotating machinery details (use Ansys / STAR-CCM+).

**How it works:** SOLIDWORKS Motion (Adams-type solver) computes forces each frame. "Simulation setup" in the motion
study transfers the loads of selected frames to a static study automatically. Flow Simulation results (pressure,
temperature) can be imported into a Simulation study as loads.

**Step by step**
1. Add-ins: SOLIDWORKS **Motion** + **Simulation** (+ **Flow Simulation**).
2. Motion Study → type **Motion Analysis**; motor on crank 1450 rpm; gas force as "Force" with data points vs time.
3. Calculate 1 revolution (e.g. 360 frames, 1 frame per degree).
4. Results → plot conrod pin force; find the frame with maximum force.
5. In the motion study: Simulation Setup → select conrod, select frame(s) → SOLIDWORKS creates the static study.
6. Mesh, run, view von Mises and safety factor.
7. Flow: run Flow Simulation of the fan/fins → in Simulation: External Loads → Flow Effects / Thermal → import.

**Example (example values)**
Max conrod force ≈ 2655 N (gas peak). Conrod shank 12 × 18 mm = 216 mm² → nominal compressive stress
2655 / 216 = **12.3 MPa**. FEA peak at the small-end fillet is higher (stress concentration, e.g. Kt ≈ 2–3 → 25–37 MPa)
but far below yield of steel C45 (≈ 340 MPa).

**Modules / licences:** **SOLIDWORKS Premium** (includes Motion and Simulation linear static) or Professional +
**SOLIDWORKS Simulation Professional / Premium** (fatigue, nonlinear); **SOLIDWORKS Flow Simulation** (separate licence).
All from Dassault Systèmes.

**Watch out:** "Animation" or "Basic Motion" studies do not give forces – use Motion Analysis; too few frames miss the
peak; transferred loads are inertial-relief style – check constraints.

**Check of result:** nominal stress vs hand calculation ± 10 % away from fillets; reaction force sum = applied (± 1 %).

---

### C7 – CAD → EDEM / Rocky (DEM geometry and kinematics)

| Type | Direction | Data exchanged |
|---|---|---|
| File transfer (one-way) | CAD to DEM | Walls as triangles (STL / STEP), motion definition (rpm, m/s) |

**Why / when to use:** bulk material against machine parts – shot-blast drum for castings, chip conveyor, sand cores,
AM powder recoater (guide 48), hopper. Geometry must be **surface only** (DEM walls), particles are created inside DEM.

**How it works:** DEM imports surfaces and splits them into triangles. Each geometry gets a motion (rotation, translation,
or from a coupled multibody tool, see Part 2 couplings). Particle–wall contact uses the triangle mesh.
Time step from Rayleigh (guide 53 §6.3).

**Step by step**
1. CAD: keep only walls touching particles; remove bolts, small holes (< 1 particle size).
2. Export STEP (EDEM can import CAD formats) or STL (fine tessellation for curved walls, coarse for flat).
3. Import into EDEM Creator / Rocky; one geometry part per moving body.
4. Define kinematics: drum rotation e.g. 4 rpm about its axis; turbine wheel rotation.
5. Define materials (steel shot, cast iron wall) and particle factory (mass flow, size).
6. Set time step 10–30 % of Rayleigh; save interval.
7. Run, check wall wear / impact energy on the geometry.

**Example (example values) – shot blasting tumbler**
- Drum Ø800 mm at 4 rpm: wall speed v = 2π · 0.4 · 4 / 60 = **0.084 m/s** (gentle tumbling of castings).
- Steel shot Ø1 mm: mass = 7800 · π/6 · (0.001)³ = **4.08·10⁻⁶ kg** per particle.
- Turbine throws 100 kg/min = 1.667 kg/s → **≈ 408 000 particles/s** → too many for one PC → use coarse-graining
  (bigger "parcel" particles) or simulate a short time.
- Rayleigh step for Ø1 mm steel shot ≈ 5.3·10⁻⁷ s → time step ≈ 1·10⁻⁷ s.

**Modules / licences:** **Altair EDEM** (Creator, Simulator, Analyst; Altair is now part of Siemens) **or Ansys Rocky**;
CAD with STEP/STL export (standard). GPU recommended (both support GPU solving).

**Watch out:** inverted triangle normals (particles leak); geometry in mm vs DEM in m; too fine STL (millions of triangles)
slows contact detection; forgetting that the CAD origin must match the motion axis.

**Check of result:** bulk density and angle of repose vs lab test ± 5 %; mass balance (in = out + inside) < 1 %.

---

### C8 – EPLAN Electric P8 ⇄ TIA Portal (AutomationML)

| Type | Direction | Data exchanged |
|---|---|---|
| File transfer (two-way, AutomationML IEC 62714 .aml) | EPLAN ⇄ TIA Portal | PLC hardware configuration (rack, modules, order numbers), I/O addresses, symbolic tags, network/IP |

**Why / when to use:** the electrical drawing and the PLC project must have the **same** modules, addresses and tag
names. Exchange avoids typing the I/O list twice (major source of commissioning errors). Not needed for a tiny panel
with one compact PLC.

**How it works:** EPLAN exports PLC data as AutomationML (XML based, IEC 62714). TIA Portal imports it (via its
AML import / Openness-based tools) and creates the device configuration and tags. Changes can go back the same way.

**Step by step**
1. EPLAN: place PLC boxes with real part numbers (Siemens S7-1500 modules from EPLAN Data Portal).
2. Assign PLC addresses and symbolic names to each I/O point.
3. EPLAN: Utilities → PLC → Export / data exchange → format **AutomationML AR APC** (menu name varies by version – see EPLAN help).
4. TIA Portal: import the .aml file into the project (menu varies by TIA version; some versions need the "TIA Selection
   Tool / AML import" or an Openness add-in).
5. Check device view: modules, order numbers, IP addresses.
6. Check PLC tag table: names and addresses.
7. After changes in TIA, export AML and re-import in EPLAN (bidirectional sync).

**Example (example values) – compressor test bench I/O**
48 DI, 32 DO, 8 AI → 3 × DI 16 + 2 × DQ 16 + 1 × AI 8 modules. DI addresses I0.0 … I5.7 (48 bits = 6 bytes),
DO addresses Q0.0 … Q3.7 (32 bits = 4 bytes). Tag example: `TB1_PT01_Pressure` (AI), `TB1_KM1_Motor_On` (DO).

**Modules / licences:** **EPLAN Electric P8** (Professional for PLC exchange) + AutomationML exchange (part of EPLAN
Platform – check edition); **Siemens TIA Portal STEP 7 Professional**; for automated sync, **TIA Portal Openness**
(included with STEP 7 Professional). Exact add-on names differ by version – ask the reseller.

**Watch out:** module firmware versions differ (TIA asks); address overlaps; tag naming rules (TIA does not accept some
characters); two-way edits without a master → conflicts. Decide "EPLAN is master for hardware, TIA for tags".

**Check of result:** I/O count in EPLAN = TIA = guide 15 tag list (0 differences); loop test at commissioning.

---

### C9 – CAD → NX MCD / Process Simulate (virtual commissioning model)

| Type | Direction | Data exchanged |
|---|---|---|
| Model export + co-simulation with PLC | CAD to MCD; MCD ⇄ PLC | Geometry, kinematics, physics properties; signals (bool, int, real) per PLC cycle |

**Why / when to use:** test the real PLC program against a moving 3D machine (conveyor, AS/RS, APC, robot cell)
before hardware exists. Not for exact force / stress results (physics engine is simplified).

**How it works:** NX MCD adds rigid bodies, collision bodies, joints, sensors and actuators (speed / position control)
to CAD. A physics engine runs with a fixed step (ms). Signals are mapped to PLCSIM Advanced (shared memory / Softbus),
SIMIT or OPC UA. Process Simulate (Tecnomatix) does the same for robot cells with robot controller simulation.

**Step by step**
1. Import CAD (native NX, or STEP/JT from other CAD) into NX; switch to Mechatronics Concept Designer.
2. Define rigid bodies (moving parts) and collision bodies (simple shapes – box, cylinder – are faster).
3. Add joints (hinge, sliding) and position / speed controls (actuators).
4. Add sensors (collision sensors as light barriers, distance sensors).
5. Define signals (I/O) and map them: External Signal Configuration → PLCSIM Advanced / OPC UA.
6. Start PLCSIM Advanced instance, download the TIA program, run MCD simulation.
7. Test sequences, faults (sensor stuck), timing.

**Example (example values) – pallet stopper on a conveyor**
Pallet speed 0.2 m/s, sensor-to-stopper 0.5 m → travel time **2.5 s**. PLC cycle 10 ms → position uncertainty per
cycle 0.2 · 0.01 = **2 mm** → stopper must be raised within the 2.5 s window; MCD shows if the pallet is caught.

**Modules / licences:** **NX Mechatronics Concept Designer** (Siemens), **SIMATIC S7-PLCSIM Advanced**, optional
**SIMIT**; robot cells: **Tecnomatix Process Simulate** (+ Virtual Commissioning option). Other CAD: STEP/JT import in NX.

**Watch out:** detailed CAD as collision body = very slow (use primitives); physics step larger than PLC cycle hides
timing faults; signal names differ from TIA tags (use one tag list, guide 15).

**Check of result:** cycle time in MCD vs line calculation ± 5 %; every PLC fault path tested once (checklist).

---

## Part B – Multibody ⇄ control

### C10 – Adams ⇄ Simulink (Adams Controls; co-simulation vs function evaluation vs FMU)

| Type | Direction | Data exchanged |
|---|---|---|
| Co-simulation / function evaluation / FMU | Adams ⇄ Simulink | Inputs to Adams (torque N·m, force N); outputs to Simulink (angle rad, speed rad/s, forces N) |

**Why / when to use:** detailed mechanism in Adams (contacts, friction, flexible bodies) plus controller in Simulink
(drive, VFD speed loop, servo). If the mechanism is simple and rigid, C11 (all in Simulink) is easier.

**How it works – three modes:**

| Mode | What runs where | When |
|---|---|---|
| **Discrete (co-simulation)** | Adams solver and Simulink solver run separately; exchange every communication interval Δt_c | Default; robust with contacts |
| **Continuous (function evaluation)** | Simulink integrator solves the Adams equations | Smooth systems, small models |
| **FMU export** | Adams model packed as FMU (FMI 2.0 co-sim), imported into Simulink FMU block | Sharing the model, no live Adams GUI |

**Step by step**
1. Adams View: create state variables: inputs (e.g. `motor_torque`) and outputs (`crank_speed`, `crank_angle`).
2. Use the input in the model: torque function `VARVAL(motor_torque)`.
3. Plugins → Adams Controls → load. Controls → Plant Export: inputs, outputs, target software MATLAB, analysis type
   non-linear, Adams host / TCP-IP or pipe.
4. In MATLAB `cd` to the export folder, run the generated `.m` file, then `adams_sys`.
5. Copy **adams_sub** into your Simulink model, connect controller.
6. adams_sub mask: simulation mode (discrete / continuous), communication interval, animation (interactive / batch).
7. Run Simulink; Adams starts automatically.

**Example (example values) – compressor speed loop with VFD**
Speed-loop bandwidth 20 Hz → Δt_c ≤ 1 / (20 · 20) = **2.5 ms**; choose **1 ms**. Simulate start-up 2 s → **2000 exchanges**.
Gas torque pulsation of a V-twin has strong 1st and 2nd order (24.2 Hz and 48.3 Hz) – at 1 ms, 48.3 Hz gets ≈ 20
samples per period (enough).

**Modules / licences:** **Adams View** + **Adams Solver** + **Adams Controls** (Hexagon); MATLAB + **Simulink**
(+ Simscape Electrical for the motor model, Control System Toolbox for tuning).

**Watch out:** MATLAB path must include the export folder; Adams and MATLAB versions must be in Hexagon's support table;
Δt_c too large → false instability; units (Adams degree vs Simulink rad).

**Check of result:** halve Δt_c → speed ripple changes < 2 %; open-loop run equals standalone Adams run (± 1 %).

---

### C11 – Simscape Multibody + Simscape Electrical + controller (single platform)

| Type | Direction | Data exchanged |
|---|---|---|
| Platform (one solver) | inside Simulink | Physical connections (torque–speed, voltage–current), signals |

**Why / when to use:** fastest way to a full mechatronic model with **one licence family and one solver**: motor +
belt + crank train + controller + PLC logic (Stateflow). No co-simulation step problem. Less detailed contact than Adams.

**How it works:** Simscape uses acausal physical networks (like real wiring). Multibody (C1 import) connects to
Simscape Driveline / Electrical via rotational ports. One variable-step solver solves all together.

**Step by step**
1. Import mechanism (C1) or build with Multibody blocks.
2. Add motor: Simscape Electrical → Induction Machine or PMSM + inverter (average-value model is enough for control).
3. Connect motor shaft to belt (Simscape Driveline Belt Pulley) and to the crank joint.
4. Add gas torque / force from a lookup table vs crank angle.
5. Controller: PI speed loop (Simulink Control Design → PID Tuner).
6. Solver `ode23t`, max step 1e-4 s; use Simscape "local solver" only for real-time / HIL.

**Example (example values) – flywheel sizing**
Energy fluctuation per revolution ΔE = 60 J (from p-V diagram of the two cylinders), allowed speed fluctuation
coefficient δ = 0.02: J = ΔE / (δ · ω²) = 60 / (0.02 · 151.8²) = **0.130 kg·m²** (pulley + flywheel). The Simscape model
should show ±1 % speed ripple around 1450 rpm with this inertia.

**Modules / licences:** MATLAB + Simulink + **Simscape** + **Simscape Multibody** + **Simscape Electrical** +
**Simscape Driveline**; optional **Simulink Control Design**, **Stateflow**. All MathWorks.

**Watch out:** switching inverter models make simulation 100× slower (use average models); algebraic loops from ideal
sources; inconsistent initial conditions at start.

**Check of result:** speed ripple δ vs formula ± 10 %; electrical input power = mechanical output + losses (± 2 %).

---

### C12 – RecurDyn ⇄ Simulink (CoLink / Simulink interface)

| Type | Direction | Data exchanged |
|---|---|---|
| Co-simulation / FMU | RecurDyn ⇄ Simulink (or RecurDyn CoLink inside) | Torques / forces in; positions, speeds, belt tensions out |

**Why / when to use:** RecurDyn (FunctionBay) is strong in **belts, chains, tracks, flexible bodies (MFBD) and contacts**.
Use it for the V-belt drive, AGV wheels, conveyors with controllers. **CoLink** is RecurDyn's own block-diagram control
tool (no MATLAB needed for simple controllers); the Simulink interface is for existing MATLAB controllers.

**How it works:** same principle as C10: RecurDyn plant with input/output variables; co-simulation every Δt_c; or FMU.

**Step by step**
1. Build the belt drive with the RecurDyn belt toolkit (pulleys Ø100 / Ø202, centre distance 400 mm).
2. Define Plant Input (motor torque) and Plant Output (pulley speeds, span tensions).
3. Control → export to MATLAB/Simulink, or open CoLink and draw the controller there (menu name varies by version –
   see RecurDyn help).
4. Simulink: insert the generated RecurDyn block; set communication step.
5. Run; compare belt slip and tension.

**Example (example values) – V-belt tensions**
Wrap angle on small pulley θ = π − 2·asin((202 − 100) / (2 · 400)) = **2.886 rad (165°)**.
V-belt (groove 40°, μ = 0.3) effective μ' = μ / sin 20° = **0.877** → e^(μ'θ) = **12.6**.
With F_e = 196 N: slack side T2 = F_e / (e^(μ'θ) − 1) = **16.9 N**, tight side T1 = **212 N** (minimum without slip; real
installation tension higher).

**Modules / licences:** **RecurDyn Professional** + **Belt / Chain toolkit** + **Control** (CoLink / MATLAB interface)
(FunctionBay; toolkit names vary – ask the reseller); MATLAB + Simulink for the Simulink path.

**Watch out:** belt element count too high (slow); wrong belt bending stiffness; communication step vs belt contact
frequencies.

**Check of result:** span tension ratio vs Euler–Eytelwein ± 10 %; power in = power out + slip loss.

---

### C13 – Simpack ⇄ Simulink (SIMAT / FMU)

| Type | Direction | Data exchanged |
|---|---|---|
| Co-simulation (SIMAT) / FMU / code export | Simpack ⇄ Simulink | Forces, torques ⇄ states (angles, speeds, accelerations) |

**Why / when to use:** Simpack (Dassault SIMULIA) is strong for **drivetrains, engines, gears, torsional vibration, rail,
wind**. Use it for the crank train torsional dynamics with motor control. **SIMAT** is the Simpack–MATLAB/Simulink
co-simulation interface.

**How it works:** Simpack model has u-vectors (inputs) and y-outputs. SIMAT exchanges them each Δt_c with a Simulink
block; or Simpack exports/imports FMUs; or Simulink code is compiled into Simpack (control element).

**Step by step**
1. Simpack: build crank train (bodies, joints, force elements), define u-inputs (motor torque) and y-outputs (speeds).
2. Configure the SIMAT interface (Simpack co-simulation settings – menu name varies by version – see Simpack help).
3. Simulink: insert the SIMAT block, point to the Simpack model, set communication step.
4. Run Simulink → Simpack solver starts.
5. Alternative: export Simulink controller as FMU and import into Simpack (one tool runs everything).

**Example (example values) – torsional resonance motor–compressor**
Two-inertia model: motor rotor J1 = 0.012 kg·m², compressor + flywheel J2 = 0.13 kg·m², belt torsional stiffness
(referred) k = 2000 N·m/rad: f = (1/2π)·√(k·(J1 + J2)/(J1·J2)) = **67.9 Hz**. Second-order excitation of the V-twin at
1450 rpm = **48.3 Hz** → separation 1.4× – OK but check in Simpack with start-up run-through.

**Modules / licences:** **Simpack** (Dassault SIMULIA) + co-simulation / **SIMAT** interface option + FMI interface;
MATLAB + Simulink. Ask for the exact package names (Simpack licences are modular).

**Watch out:** stiff force elements need small Δt_c; mismatch of state ordering in u/y vectors; licence for both tools on
the same PC.

**Check of result:** natural frequency from Simpack eigenvalue analysis vs formula ± 5 %; start-up run-through shows
resonance only near 67.9 Hz.

---

### C14 – Altair MotionSolve ⇄ Altair Activate / Simulink

| Type | Direction | Data exchanged |
|---|---|---|
| Co-simulation / FMU / platform | MotionSolve ⇄ Activate (or Simulink) | Forces / torques ⇄ positions, speeds |

**Why / when to use:** you already use Altair (HyperWorks units licence). MotionSolve = multibody; **Activate** = block
diagram + Modelica + hydraulics/electric libraries (Simulink-like). One units licence covers both. Altair is now part of
Siemens – check future road map.

**How it works:** MotionView/MotionSolve model with Control_PlantInput / Control_PlantOutput; Activate has a
MotionSolve block for co-simulation; FMU export also possible; Simulink path through a MotionSolve S-function.

**Step by step**
1. MotionView: build or import model (from CAD or HyperMesh).
2. Add Control_PlantInput (actuator force) and Control_PlantOutput (position, speed).
3. Export solver deck (.xml).
4. Activate: insert MotionSolve block, link the .xml, connect controller blocks.
5. Run; plot in Activate scopes; animate in HyperView.

**Example (example values) – pallet stopper impact**
Pallet 150 kg at 0.2 m/s: kinetic energy E = ½ · 150 · 0.2² = **3.0 J** per stop → choose damper ≥ 3 J × safety
(e.g. 2 → 6 J). MotionSolve contact + Activate PLC logic show impact force and rebound.

**Modules / licences:** **Altair MotionView + MotionSolve**, **Altair Activate**, **HyperView** (all in Altair Units
licence); Simulink path: MATLAB + Simulink.

**Watch out:** contact stiffness choice changes impact force a lot; unit system (MotionView default mm-kg-N-s).

**Check of result:** impact energy absorbed = ½mv² ± 5 %; stopping distance vs damper datasheet.

---

### C15 – Simcenter 3D Motion ⇄ Simulink / Amesim

| Type | Direction | Data exchanged |
|---|---|---|
| Co-simulation / FMU | Simcenter 3D Motion ⇄ Simulink or Amesim | Cylinder force (N) ⇄ piston position (mm), speed (mm/s) |

**Why / when to use:** NX/Simcenter users: motion model directly on NX geometry; **Amesim** for hydraulic / pneumatic
circuits; Simulink for control. Good for APC lift, hydraulic press, clamping.

**How it works:** Simcenter 3D Motion defines plant inputs/outputs; co-simulation with Amesim (hydraulics) and/or
Simulink (control); FMU in both directions.

**Step by step**
1. NX: open assembly → Simcenter 3D Motion; define links, joints.
2. Define plant input (cylinder force) and output (stroke, speed) – Control / co-simulation interface (menu name varies by
   version – see Siemens help).
3. Amesim: build circuit (pump, valve, cylinder Ø63/36, accumulator); add co-simulation interface block.
4. Set communication step (e.g. 1 ms) and master tool.
5. Run; read pressure and force peaks.

**Example (example values) – APC lift cylinder**
Cylinder Ø63 at 7 MPa: F = π/4 · 63² · 7 = **21.8 kN**; lifted mass 1480 kg → weight **14.5 kN** → force ratio **1.50**
(reserve for acceleration + friction). Co-simulation shows pressure peak at start of lift.

**Modules / licences:** **Simcenter 3D Motion** (Siemens) + co-simulation option; **Simcenter Amesim** (+ hydraulic
libraries); MATLAB + Simulink (control).

**Watch out:** hydraulic stiffness is very high → small Δt_c (0.1–1 ms); oil bulk modulus and hose volume wrong →
wrong peaks.

**Check of result:** static force balance vs formula ± 2 %; measured lift time on the real machine vs model ± 10 %.

---

## Part C – FEA ⇄ multibody (flexible bodies and loads)

### C16 – Ansys Mechanical → Adams flexible body (MNF, Craig-Bampton)

| Type | Direction | Data exchanged |
|---|---|---|
| Model export (one-way) | Ansys to Adams | Modal neutral file .mnf: mass, mode shapes, frequencies (Hz), optional stress/strain shapes |

**Why / when to use:** the part bends enough to change dynamics or loads (crankshaft, long conrod, frame, robot arm),
or you need stresses over time from the multibody run (C19). Rigid is enough if first natural frequency > 5–10× the
highest excitation.

**How it works:** Craig-Bampton reduction: keep **constraint modes** (6 per interface node) + **fixed-interface normal
modes** up to the cut-off frequency. Adams uses these modes as extra coordinates q_i: displacement u = Σ φ_i · q_i.

**Step by step**
1. Ansys Mechanical: mesh the crankshaft (quadratic tets).
2. Create interface nodes: remote points (rigid) at main bearing 1, main bearing 2, crank pin (both conrods), pulley hub.
3. Modal analysis with Craig-Bampton (condensed part / CMS) – keep modes up to cut-off.
4. Export Adams MNF (Ansys provides MNF export through APDL commands / extension – menu name varies by version – see
   Ansys help).
5. Adams: Flex → Rigid to Flex (swap the rigid crankshaft) → align interface nodes with joints.
6. Run; compare frequencies; use modal stress recovery later (C19).

**Example (example values)**
- Interface nodes: 4 (2 main bearings + crank pin + pulley) → constraint modes 4 × 6 = **24**.
- Excitation up to 12th order = 290 Hz → cut-off 1.5–2× → keep normal modes up to ≈ 600 Hz → e.g. **20 modes**.
- Total **44 modes**. File size with stress shapes for 60 000 nodes: 60 000 × 6 × 44 × 8 bytes ≈ **127 MB**
  (reduce with mesh-free MNF / stress only on chosen nodes).

**Modules / licences:** **Ansys Mechanical** (Enterprise or with MNF export capability – check edition); **Adams View +
Adams Solver + Adams Flex**.

**Watch out:** interface nodes not at joint centres; unit system of MNF (must be consistent – Adams reads units from MNF);
too many modes slow Adams; disable the 6 rigid-body modes correctly.

**Check of result:** Adams flex body frequencies = Ansys modal ± 2 %; mass = rigid part mass ± 0.5 %.

---

### C17 – Nastran / Simcenter 3D → Adams (MBDEXPORT) and Adams ViewFlex

| Type | Direction | Data exchanged |
|---|---|---|
| Model export (one-way) | Nastran to Adams | .mnf (or .bdf/.op2-based flex body) |

**Why / when to use:** your FEA is in MSC Nastran / Simcenter (NX) Nastran / Femap / Patran; or you have no FEA tool and
use **Adams ViewFlex** (meshes the part inside Adams and runs an embedded MSC Nastran).

**How it works:** Nastran SOL 103 with component mode synthesis writes the flexible body.
- MSC Nastran: Bulk/Case control `MBDEXPORT ADAMS` (+ `DTI,UNITS` for units).
- Simcenter Nastran: `ADAMSMNF` case control (check your version documentation).
- ViewFlex: inside Adams View, select part → ViewFlex → mesh, attachment points, number of modes.

**Step by step (ViewFlex – quickest)**
1. Adams View: right-click rigid part (e.g. conrod) → Make Flexible → Create New (ViewFlex).
2. Mesh settings: element size e.g. 2 mm, quadratic.
3. Attachments: big-end and small-end joint markers (rigid spiders).
4. Number of modes: e.g. 10 normal modes.
5. Create → Adams runs Nastran in background → flex body replaces the rigid part.
6. Run the simulation; plot stress (if stress modes were requested).

**Example (example values)** Conrod 0.45 kg, first bending mode ≈ several kHz (stiff) → stays almost rigid at 290 Hz
excitation: rule → if f1 > 10 × 290 Hz = 2.9 kHz, the rigid model is acceptable for loads; use flex only for stress history.

**Modules / licences:** **MSC Nastran** or **Simcenter Nastran** (+ pre-processor Patran / Femap / Simcenter 3D);
**Adams Flex**; **Adams ViewFlex** licence for the built-in path (Hexagon).

**Watch out:** missing DTI,UNITS → wrong scaling by 1000; residual vectors needed for local loads; attachment spider
stiffens the part.

**Check of result:** frequencies vs FEA ± 2 %; static deflection under unit load vs FEA ± 3 %.

---

### C18 – Abaqus → Adams / Simpack (substructure)

| Type | Direction | Data exchanged |
|---|---|---|
| Model export (one-way) | Abaqus to Adams (.mnf) or Simpack (via FBI) | Reduced stiffness / mass, modes, stress shapes |

**Why / when to use:** your FEA team uses Abaqus (e.g. for nonlinear bolt / gasket studies) and wants the same mesh as
flexible body in multibody. Example: compressor base frame or crankcase on rubber mounts.

**How it works:** Abaqus substructure generation (`*SUBSTRUCTURE GENERATE`) with retained nodes + `*FLEXIBLE BODY,
TYPE=ADAMS` writes data that the `abaqus adams` translator converts to .mnf (check your Abaqus version). For Simpack,
the substructure / matrix files are read by Simpack's FE interface (FBI generation, C21).

**Step by step**
1. Abaqus: mesh frame, define retained nodes at mount points and compressor feet (kinematic couplings).
2. Step: substructure generate (retained DOFs + number of eigenmodes).
3. Add flexible body output for Adams (keyword above) → run job.
4. Run the translator to produce .mnf (or use Simpack's FE interface).
5. Import into Adams / Simpack, connect bushings (rubber mounts).

**Example (example values)** Frame 45 kg, first mode 85 Hz. Excitation: 1st order 24.2 Hz, 2nd order 48.3 Hz → ratio to
2nd order = 85 / 48.3 = **1.76** → below the common 2–3× target → model the frame flexible and check vibration levels.

**Modules / licences:** **Abaqus/Standard** (Dassault SIMULIA) with substructure + Adams interface; **Adams Flex** or
**Simpack** with FE interface.

**Watch out:** retained nodes without coupling (point load singularities); units (Abaqus has no units – be consistent);
wrong number of retained eigenmodes.

**Check of result:** frame frequencies in multibody vs Abaqus ± 2 %; mount loads sum = weight + dynamic forces.

---

### C19 – Adams → Ansys loads + modal stress recovery → fatigue

| Type | Direction | Data exchanged |
|---|---|---|
| File transfer (one-way) | Adams to Ansys / fatigue | Joint loads vs time (N, N·m) **or** modal coordinates q_i(t) |

**Why / when to use:** get stress history for fatigue of the crankshaft / conrod from realistic dynamic loads.
- **Load transfer:** export reaction forces at chosen time steps → static FEA in Ansys (with inertia relief).
- **Modal stress recovery (MSR):** stress σ(t) = Σ q_i(t) · σ_i (σ_i = stress shape of mode i) – fast, whole history.

**How it works:** for MSR the flex body (C16/C17) contains stress shapes; Adams Durability or Ansys combines them with
q_i(t). For load transfer Adams writes a load file at peak times.

**Step by step**
1. Run Adams with flexible crankshaft for one full cycle at several speeds.
2. Load transfer: File → Export → FEA Loads (Ansys format) at chosen times (menu name varies by version – see Adams help).
3. Ansys Mechanical: import as remote forces (or use inertia relief).
4. MSR: export modal coordinates (or stress history) → Ansys / nCode / fe-safe.
5. Fatigue: Goodman / FKM evaluation at hot spots.

**Example (example values)**
- MSR at pin fillet: σ = q1·σ1 + q2·σ2 = 0.15 · 400 + 0.04 · (−250) = **50 MPa** at that time step.
- Goodman fatigue: σ_a = 60 MPa, σ_m = 40 MPa, endurance S_e = 280 MPa, R_m = 650 MPa →
  n = 1 / (σ_a/S_e + σ_m/R_m) = 1 / (0.214 + 0.062) = **3.6**.

**Modules / licences:** **Adams Solver + Adams Flex** (+ **Adams Durability** for MSR); **Ansys Mechanical** (+ Fatigue
Tool or **Ansys nCode DesignLife**).

**Watch out:** inertia relief needed when loads are not in equilibrium; MSR only valid in the linear range; missing
stress modes near contacts.

**Check of result:** MSR stress at one time step vs full FEA with the same loads ± 5 %.

---

### C20 – Adams Durability ⇄ nCode DesignLife / fe-safe (RPC, DAC files)

| Type | Direction | Data exchanged |
|---|---|---|
| File transfer (two-way) | Adams ⇄ fatigue tools | Time histories in **RPC III** (MTS) or **DAC** (nCode) format: loads, strains, modal coordinates |

**Why / when to use:** fatigue life with real load spectra – start-ups, pressure cycles, measured test-bench data.
Adams Durability reads measured RPC/DAC signals as input and writes results in the same formats for nCode / fe-safe.

**How it works:** rainflow counting of stress cycles + S-N curve + Miner rule D = Σ n_i / N_i; failure at D = 1.

**Step by step**
1. Measure or simulate load signals (e.g. test-bench pressure vs time) → save as RPC III or DAC.
2. Adams Durability: use the signal as input (RPC/DAC request); run.
3. Export modal coordinates / loads as RPC/DAC.
4. nCode DesignLife or fe-safe: combine with FE stress shapes (MSR) → rainflow → damage → life contour.
5. Report minimum life and hot spot.

**Example (example values) – crankshaft start-up cycles**
- Running cycles per year: 1450 rpm × 60 × 8 h × 250 days = **174 million** (σ_a 60 MPa < endurance → no damage).
- Start-ups: 20 per day × 250 = 5000 per year with σ_a = 320 MPa. S-N: N = 2·10⁶ · (280/320)⁵ = **1.03·10⁶** cycles.
- Damage per year D = 5000 / 1.03·10⁶ = **0.0049** → life ≈ **205 years** (example – real S-N from material data).

**Modules / licences:** **Adams Durability** (Hexagon); **Ansys nCode DesignLife** (HBK nCode, sold also through Ansys) or
**fe-safe** (Dassault SIMULIA).

**Watch out:** sample rate of signals too low (peaks lost); mean-stress correction forgotten; S-N curve for smooth
specimen used for a notched/rough surface.

**Check of result:** rainflow cycle count of a simple sine = expected count; life vs hand Miner sum ± 10 %.

---

### C21 – Simpack ⇄ FE (FBI flexible body files from Ansys / Abaqus / Nastran)

| Type | Direction | Data exchanged |
|---|---|---|
| Model export (one-way) + result back | FE to Simpack; Simpack loads/modal coords back to FE | FBI (Flexible Body Input) file: modes, mass, stress shapes |

**Why / when to use:** Simpack drivetrain / crank train with flexible crankshaft or housing; very common for engines and
gearboxes. Results (modal coordinates) go back to FE / fatigue tools (like C19, C20).

**How it works:** the FE program writes reduced matrices + modes; Simpack's **FE interface (Flex)** converts them into an
`.fbi` file (Craig-Bampton as in C16). Simpack can also reduce large FE models itself.

**Step by step**
1. FE (Ansys / Abaqus / Nastran): reduction with interface nodes at bearings and pin (same as C16).
2. Export the FE interface files the Simpack translator expects (per FE tool – see Simpack help, FE interfaces).
3. Simpack: FE interface → generate FBI (select modes, frequency range, damping).
4. Insert flexible body in the crank train; attach bearings / force elements.
5. Run torsional and bending analysis; export modal coordinates for fatigue.

**Example (example values)** Same crankshaft as C16: 4 interface nodes → 24 constraint modes + 20 normal modes up to
≈ 600 Hz. Torsional check: first torsional frequency of the crankshaft itself (high, several hundred Hz to kHz) vs belt
system 67.9 Hz (C13) – the flexible body confirms which mode dominates.

**Modules / licences:** **Simpack** + **Simpack Flex / FE interface** (Dassault SIMULIA); FE tool: **Ansys Mechanical**,
**Abaqus**, or **Nastran** (licence of the FE tool for the reduction run).

**Watch out:** FE interface version must match the FE tool version; damping of flex modes left at 0 (unrealistic
resonance peaks); interface node numbering changed after remesh.

**Check of result:** Simpack eigenvalues = FE modal ± 2 %; static stiffness at crank pin vs FE ± 3 %.

---

### Part 1 summary table

| Coupling | Type | Main modules | Set-up effort | Value for compressor factory |
|---|---|---|---|---|
| C1 SOLIDWORKS → Simscape | Model export | Simscape Multibody + Link (free) | ★★ | ★★★★★ |
| C2 Creo/Inventor/Onshape/NX → Simscape | Model export | Simscape Multibody + Link | ★★ (NX ★★★★) | ★★★★ |
| C3 CAD → Adams | File | Adams View/Solver, Machinery | ★★★ | ★★★★★ |
| C4 CAD ⇄ Ansys Workbench | Platform | Mechanical, Geometry Interfaces | ★★ | ★★★★★ |
| C5 CAD ⇄ COMSOL | Platform | COMSOL + LiveLink for CAD | ★★ | ★★★ |
| C6 SOLIDWORKS Motion → Simulation / Flow | Platform | SOLIDWORKS Premium, Flow Sim. | ★ | ★★★★ |
| C7 CAD → EDEM / Rocky | File | EDEM or Rocky | ★★ | ★★★ |
| C8 EPLAN ⇄ TIA Portal | File (AML) | EPLAN P8, STEP 7 Pro | ★★★ | ★★★★★ |
| C9 CAD → NX MCD / Process Simulate | Model + PLC co-sim | NX MCD, PLCSIM Advanced | ★★★★ | ★★★★ |
| C10 Adams ⇄ Simulink | Co-sim / FMU | Adams Controls, Simulink | ★★★ | ★★★★ |
| C11 Simscape all-in-one | Platform | Simscape (Multibody, Electrical, Driveline) | ★★ | ★★★★★ |
| C12 RecurDyn ⇄ Simulink | Co-sim / FMU | RecurDyn + Belt + Control | ★★★ | ★★★ |
| C13 Simpack ⇄ Simulink | Co-sim (SIMAT) / FMU | Simpack + SIMAT | ★★★★ | ★★★ |
| C14 MotionSolve ⇄ Activate | Co-sim / platform | Altair Units (MotionSolve, Activate) | ★★★ | ★★★ |
| C15 Simcenter 3D Motion ⇄ Amesim / Simulink | Co-sim / FMU | Simcenter 3D Motion, Amesim | ★★★★ | ★★★★ |
| C16 Ansys → Adams MNF | Model export | Ansys Mechanical, Adams Flex | ★★★ | ★★★★ |
| C17 Nastran / ViewFlex → Adams | Model export | Nastran or ViewFlex, Adams Flex | ★★ | ★★★★ |
| C18 Abaqus → Adams / Simpack | Model export | Abaqus/Standard, Adams Flex / Simpack | ★★★★ | ★★★ |
| C19 Adams → Ansys loads / MSR | File | Adams Durability, Ansys + nCode | ★★★ | ★★★★★ |
| C20 Adams Durability ⇄ nCode / fe-safe | File (RPC/DAC) | Adams Durability, nCode or fe-safe | ★★★ | ★★★★ |
| C21 Simpack ⇄ FE (FBI) | Model export | Simpack Flex + FE tool | ★★★★ | ★★★ |

Effort: ★ = hours, ★★★★★ = weeks. Value = estimate for a piston-compressor factory.

---

## Part D – Fluids and particles

### C22 – Altair EDEM ⇄ Ansys Fluent (CFD-DEM)
**Type** co-simulation · **Direction** two-way · **Data** air velocity u (m/s), pressure p (Pa), void fraction α (–) from Fluent → EDEM; drag force F_d (N) and particle volume per cell (m³) from EDEM → Fluent.

**Why / when to use.** Many particles moving in air or liquid, where the air pushes the particles and the particles slow the air. Examples: shot blasting nozzle and cabin, pneumatic return of shot, dust in filters, powder conveying. **Not** for a few particles in a strong flow (use Fluent DPM, it is cheaper) or for dry bulk without air (use EDEM alone).

**How it works.** Fluent solves the air on a mesh. EDEM moves each particle with Newton's law and contact models. Each coupling step the drag on each particle is computed and the reaction goes back to the air.
- Particle Reynolds number: **Re_p = ρ_g · |u − v| · d / μ**
- Drag force: **F_d = ½ · ρ_g · C_d · A_p · |u − v| · (u − v)**, A_p = π d²/4
- Schiller-Naumann: **C_d = 24/Re_p · (1 + 0.15 Re_p^0.687)** for Re_p < 1000, **C_d = 0.44** above.
- **Lagrangian coupling** = dilute flow (particle volume fraction below about 10 %, particle smaller than a cell); force on each particle. **Eulerian coupling** = dense flow; the momentum exchange is put into the cell equations with α. Dense drag laws: Gidaspow, Di Felice, Ergun.

**Step by step**
1. Build the geometry once (STEP) and use it in both tools. Same origin, same units (EDEM in m, Fluent in m).
2. EDEM: define particle shape (sphere or multi-sphere), size distribution, material (E or G, ν, ρ), contacts (restitution, static and rolling friction). Calibrate with an angle-of-repose and bulk density test.
3. Fluent: mesh with cells ≥ 3–5 particle diameters. Transient, pressure-based, turbulence model (k-ω SST is common).
4. Load the EDEM coupling module into Fluent (supplied by Altair, it must match the Fluent version; loaded as a UDF/add-on – menu name varies by version, see maker help).
5. Choose Lagrangian or Eulerian, choose the drag law, choose which forces are on (drag, pressure gradient, lift).
6. Time steps: EDEM Δt ≈ 10–30 % of the Rayleigh step (guide 53 §6.3); Fluent Δt is 10–100× larger. EDEM sub-steps inside each Fluent step.
7. Start EDEM, then Fluent; Fluent controls the CFD steps.
8. Post-process: particle velocity at the target, mass flow, pressure drop.

**Example (example values) – shot blasting nozzle for crankcase castings.** Steel shot d = 1 mm, ρ_p = 7800 kg/m³, air 60 m/s relative, ρ_g = 1.2 kg/m³, μ = 1.8·10⁻⁵ Pa·s.
- Re_p = 1.2 · 60 · 0.001 / 1.8·10⁻⁵ = **4000** → C_d = 0.44.
- F_d = ½ · 1.2 · 0.44 · 7.85·10⁻⁷ · 60² = **7.5·10⁻⁴ N**. Shot mass = 4.08·10⁻⁶ kg → acceleration **183 m/s²**.
- Stokes number over a 0.1 m nozzle: St = ρ_p d² U / (18 μ L) = **14 400** ≫ 1 → shot reacts slowly; a long nozzle is needed to accelerate it. At 20 m/s slip, Re_p = 1333, C_d = 0.40.
Use the result: nozzle length and air pressure for the wanted shot speed at the casting surface.

**Modules / licences**
| Tool | Product | Supplier |
|---|---|---|
| DEM | Altair EDEM (Professional, with the coupling option) | Altair (part of Siemens) |
| CFD | Ansys Fluent (CFD Premium/Enterprise class) + HPC if more than the base cores | Ansys (Synopsys) |
| Coupling | EDEM coupling module for Ansys Fluent | Altair, ships with EDEM |

**Watch out.** Fluent and EDEM versions do not match the coupling module · cells smaller than 3 d (void fraction wrong) · Lagrangian used for dense packed shot (should be Eulerian) · uncalibrated friction · different geometry in the two tools.

**Check of result.** Pressure drop of the empty nozzle matches the hand calculation or supplier curve within ±10 % · single-particle test: one shot accelerates as F_d/m says (±5 %) · mass balance: shot in = shot out (±1 %).

### C23 – Ansys Rocky ⇄ Ansys Fluent / Ansys Mechanical (native Workbench)
**Type** platform (Workbench) – co-simulation with Fluent, file / mapping to Mechanical · **Direction** Fluent ⇄ Rocky two-way; Rocky → Mechanical one-way · **Data** air forces (N), particle loads as pressure on walls (Pa), wear depth (m), shear (Pa).

**Why / when to use.** Same physics as C22, but all inside Ansys: fewer version problems, one licence vendor. Rocky is strong for non-spherical particles (polyhedra, fibres, flexible), wear and wall loads. **Not** if you already use EDEM with a calibrated material library.

**How it works.** Rocky computes particle contacts (often on the GPU). With Fluent it exchanges drag as in C22. To Mechanical it sends time-averaged or peak particle pressure on each wall face; Mechanical then computes stress. Erosion is often modelled as **wear rate ∝ m_shot · vⁿ**, n ≈ 2–3 (Finnie / Archard type models).

**Step by step**
1. Workbench: add Rocky system next to Fluent and/or Mechanical; share the geometry (SpaceClaim / Discovery).
2. Rocky: particles, materials, inlets (mass flow in kg/s), moving walls (rotation, vibration).
3. Fluent coupling: one-way (air moves particles only) or two-way; drag law; Rocky handles the particle step.
4. Run; switch on GPU solver if available.
5. Export loads to Mechanical: link Rocky solution to a Static Structural system (data transfer of particle forces; menu name varies by version – see maker help).
6. Mechanical: imported load on the walls → stress, deformation, fatigue.
7. Wear: turn on the wear model, calibrate the wear constant with one real worn liner.

**Example (example values) – blast cabin liner wear.** Shot flow 10 kg/min at 60 m/s.
- Impact power = ½ · ṁ · v² = ½ · (10/60) · 60² = **300 W** hitting the liner.
- If air pressure raises shot speed to 70 m/s and wear ∝ v^2.5: wear × (70/60)^2.5 = **1.47** → about 47 % more liner wear for 17 % more speed.
Use the result: rubber or Mn-steel liner thickness and replacement interval.

**Modules / licences.** Ansys Rocky (GPU recommended), Ansys Fluent, Ansys Mechanical (Pro/Premium/Enterprise), Workbench (included). All from Ansys.

**Watch out.** Particle shape simplified to spheres when the real shot is angular grit · peak loads exported where mean loads are needed (or the opposite) · wear constant not calibrated · GPU memory too small for millions of particles.

**Check of result.** Rocky mass flow = setting (±1 %) · liner wear pattern compared with a real worn liner (location right, depth within a factor 1.5) · reaction forces in Mechanical = sum of exported loads (±2 %).

### C24 – Altair EDEM ⇄ Adams / RecurDyn / MotionSolve (DEM-MBD)
**Type** co-simulation · **Direction** two-way · **Data** body position (m), velocity (m/s), angle (rad) from MBD → EDEM; particle force (N) and torque (N·m) from EDEM → MBD.

**Why / when to use.** A machine moves through bulk material and the material loads the machine: vibrating chip conveyor, tumble blast drum, bucket, mixer, screw feeder. You need motor torque, bearing loads or drive power. **Not** if the machine motion is fixed and you only need particle flow (EDEM alone with a moving wall is enough).

**How it works.** The MBD solver moves the bodies with joints, springs and motors. EDEM sees the bodies as moving walls, computes the particle contacts and returns the total force and torque on each body. Throw number of a vibrating conveyor: **Γ = A · ω² / g**; Γ > 1 means the particles leave the trough (hop).

**Step by step**
1. MBD model: bodies, joints, drive (motor or imposed motion), springs.
2. Export the coupled body geometry (STL/STEP) with the same origin into EDEM.
3. Load the coupling plug-in: EDEM–Adams coupling (Altair), EDEM–RecurDyn coupling (FunctionBay/Altair), MotionSolve–EDEM (Altair, native).
4. Mark the coupled bodies on both sides with the same names.
5. Choose the communication step (guide 53 §6.1); EDEM sub-steps inside.
6. Run; read motor torque, bearing forces, power in the MBD tool.

**Example (example values) – vibrating chip conveyor under the HMC.** Amplitude A = 2 mm, f = 25 Hz.
- Γ = 0.002 · (2π · 25)² / 9.81 = **5.03** → chips hop and move forward.
- Velocity amplitude = A·ω = 0.002 · 157 = 0.314 m/s. If EDEM returns a force in phase with velocity of 200 N amplitude: mean power = ½ · F · v = ½ · 200 · 0.314 = **31.4 W** extra for the vibrator motor.
Communication step for 25 Hz: ≤ 1/(20 · 25) = 2 ms.

**Modules / licences.** Altair EDEM + coupling option; MSC Adams (Adams View/Solver) or RecurDyn (FunctionBay) or Altair MotionSolve (with Altair units licence). Coupling plug-ins from Altair (EDEM side).

**Watch out.** Body origin or units differ (mm vs m) · too large communication step (forces lag motion) · particle stiffness lowered so much that the bed acts like a soft spring and changes the dynamics · too few particles for a steady mean value.

**Check of result.** Empty conveyor: Adams power = mechanical loss only · DEM bed mass on the trough = chip mass loaded (±2 %) · motor power compared with the real vibrator datasheet or measurement (±20 %).

### C25 – Ansys Fluent ⇄ Ansys Mechanical (FSI via System Coupling)
**Type** co-simulation (or one-way mapping) · **Direction** one-way (pressure → structure) or two-way (pressure ⇄ displacement) · **Data** wall force or pressure (Pa) from Fluent → Mechanical; displacement (m) from Mechanical → Fluent (moves the mesh).

**Why / when to use.** The air pressure bends a part. **One-way** if the bending does not change the flow (tank wall, fan blade under steady load). **Two-way** if the bending changes the flow – the **valve reed** of the compressor is the classic case: lift sets the flow area, flow sets the force.

**How it works.** System Coupling is the master. Each time step: Fluent computes pressure on the coupled wall → Mechanical computes deformation → Fluent moves its mesh (dynamic mesh: smoothing + remeshing). Implicit coupling iterates inside each step until both sides agree. Reed cantilever first frequency: **f₁ = 1.875² / (2π L²) · √(E I / (ρ A))**.

**Step by step**
1. Workbench: Fluent (transient) + Transient Structural + **System Coupling** system; share the geometry.
2. Mechanical: reed + seat, contact reed-seat, fixed root, fluid-solid interface on the wetted faces.
3. Fluent: dynamic mesh (smoothing, remeshing) in the valve gap; minimum gap > 0 (keep a small gap, e.g. 0.02 mm, or use overset/gap model).
4. System Coupling: data transfers (Fluent force → Mechanical, Mechanical displacement → Fluent), time step, end time, coupling iterations (e.g. 5–10 per step), under-relaxation if needed.
5. Run a short time first (a few ms) to test stability.
6. Run 2–3 crank revolutions; use the last revolution.
7. Results: reed lift vs crank angle, impact speed on seat and limiter, mass flow.

**Example (example values) – discharge reed valve.** Steel reed L = 20 mm, b = 10 mm, t = 0.3 mm, E = 210 GPa, ρ = 7850 kg/m³.
- f₁ = 1.875²/(2π · 0.02²) · √(EI/(ρA)) = **627 Hz**; crank speed 1450 rpm = 24.2 Hz → reed is 26× faster than the crank.
- Port Ø8 mm, Δp = 0.3 bar → F = 0.3·10⁵ · 5.03·10⁻⁵ = **1.51 N**. Tip deflection F L³/(3EI) = **0.85 mm** – the same size as a typical lift limiter (1–2 mm) → the flow area changes a lot → **two-way coupling needed**.
- Time step: 627 Hz needs ≥ 20 steps per period → Δt ≤ 8·10⁻⁵ s; with impact, use about 1·10⁻⁵ s.

**Modules / licences.** Ansys Fluent + Ansys Mechanical (Enterprise or Premium; transient structural) + Ansys System Coupling (included with recent solver licences – confirm with reseller) + HPC packs. All Ansys.

**Watch out.** Mesh collapse when the valve closes (keep minimum gap) · explicit coupling with light structure → instability (use implicit + relaxation) · reed contact not modelled (impact stress missed) · steady result taken from the first revolution.

**Check of result.** Mechanical modal f₁ = hand formula ±5 % · mass flow per revolution compared with FAD (20 m³/h ≈ 5.6 L/s free air) ±10 % · halve Δt: peak lift change < 3 %.

### C26 – Simcenter STAR-CCM+ ⇄ Abaqus (co-simulation FSI)
**Type** co-simulation · **Direction** two-way · **Data** traction/pressure (Pa) STAR → Abaqus; displacement (m) Abaqus → STAR.

**Why / when to use.** As C25, but when the structure side is hard: contact and impact (reed hitting seat), plastic or rubber parts, bolted joints. Abaqus is strongest for that, STAR-CCM+ for automatic CFD meshing. **Not** if both tools are not already licensed – a single vendor chain (C25) is simpler.

**How it works.** STAR-CCM+ has a built-in Abaqus co-simulation (it uses the SIMULIA Co-Simulation Engine). STAR is usually the master of time; Abaqus Standard (implicit) or Explicit computes the structure. Impact stress on a reed hitting the seat (1D rod theory): **σ ≈ v · √(E · ρ)**.

**Step by step**
1. Abaqus: reed model, contact reed-seat, interface surface named (e.g. FSI_SURF), *CO-SIMULATION keyword in the step (Abaqus/CAE: co-simulation interaction – see maker help).
2. STAR-CCM+: fluid region, morphing mesh, Co-Simulation → Abaqus, map the wetted boundary to the Abaqus surface.
3. Set coupling scheme (implicit, number of exchanges per step), time step equal on both sides.
4. Start from STAR-CCM+ (it launches Abaqus) – version pair must be supported (check STAR release notes).
5. Run; check the exchange residuals each step.

**Example (example values) – reed impact on the seat.** Closing speed v = 5 m/s, steel E = 210 GPa, ρ = 7850 kg/m³.
- σ ≈ 5 · √(210·10⁹ · 7850) = **203 MPa** per impact.
- At 1450 rpm = **24.2 impacts per second** → 87 000 per hour → fatigue (use valve-steel endurance data from the reed supplier).
Use the result: limit closing speed (stiffer reed, spring, smaller lift).

**Modules / licences.** Simcenter STAR-CCM+ (Siemens) – co-simulation included; Abaqus/Standard or Abaqus/Explicit (Dassault SIMULIA tokens). The coupling is supplied by Siemens (STAR side) using the SIMULIA CSE.

**Watch out.** Unsupported version pair · different units (STAR SI, Abaqus whatever you typed – use SI everywhere) · morphing limit reached when the gap closes · Explicit Abaqus with tiny time step makes the run very long.

**Check of result.** Abaqus alone with the same pressure history gives the same deflection (±5 %) · impact stress near the rod formula (factor 1.5) · energy balance in Abaqus (artificial energy < 5 % of internal energy).

### C27 – CFD conjugate heat transfer → thermal stress (Fluent / STAR-CCM+ → Ansys Mechanical, External Data)
**Type** file / mapping (one-way) · **Direction** CFD → FEA · **Data** temperature field (°C or K) on solid nodes, or heat transfer coefficient h (W/m²K) + air temperature (K) on surfaces.

**Why / when to use.** Cylinder, head and valve plate get hot from compression; fins and fan cool them. You need temperature for thermal stress, bolt load loss, gasket and bore distortion. One-way is enough because stress does not change the air flow. **Not** needed if a hand estimate shows ΔT is small (< 20 K).

**How it works.** CFD with conjugate heat transfer (CHT) solves air flow and solid conduction together. Result goes to FEA: either the full solid temperature (best) or h + T_air on surfaces (FEA solves the conduction). Thermal stress if expansion is blocked: **σ = E · α · ΔT / (1 − ν)**. Discharge temperature: **T₂ = T₁ · (p₂/p₁)^((n−1)/n)**. Biot number **Bi = h · (t/2) / k** < 0.1 means the fin is almost uniform in temperature.

**Step by step**
1. CFD: cylinder + head + fins + fan duct; solid regions with material k (W/mK); heat input from gas side (from GT-SUITE C31 or a measured gas-side h and T).
2. Run steady CHT (time-averaged gas side) until temperatures are stable.
3. Export: Fluent → Workbench data transfer, or write a file (CSV/ASCII: x, y, z, T).
4. Workbench: **External Data** system → read the file, set units and columns → connect to Static Structural (Imported Body Temperature) (or link Fluent directly to Mechanical in Workbench).
5. Check the mapping (mapping validation plot, out-of-range nodes).
6. Mechanical: add bolt pretension, pressure, contact; solve thermal + mechanical.
7. Results: bore distortion (µm), bolt force change, stress at fins and valve plate.

**Example (example values) – single-stage head at 8 bar g.** T₁ = 293 K, p₂/p₁ = 9, polytropic n = 1.3.
- T₂ = 293 · 9^(0.3/1.3) = **486 K = 213 °C** air at discharge.
- Grey cast iron cylinder, E = 110 GPa, α = 11·10⁻⁶ /K, ν = 0.26, local ΔT = 40 K blocked: σ = **65 MPa** – about one third of the tensile strength of EN-GJL-250 → check.
- Fin t = 4 mm, k = 50 W/mK, h = 50 W/m²K: Bi = **0.002** → fin nearly uniform; fin efficiency formula valid.

**Modules / licences.** Ansys Fluent (with CHT) or Simcenter STAR-CCM+; Ansys Mechanical (Pro or higher, thermal-structural); External Data is part of Workbench. FreeCAD/CalculiX can read a mapped temperature via scripts (free, more work).

**Watch out.** Unit mix (°C vs K) in the file · mesh offset → nodes outside the CFD solid get extrapolated values · gas-side heat input guessed (largest uncertainty) · radiation ignored on hot heads.

**Check of result.** Surface temperatures vs thermocouple test on the prototype (±10 K) · energy balance: heat to fins = heat from gas side (±5 %) · mapped field min/max = CFD min/max.

### C28 – OpenFOAM ⇄ CalculiX via preCICE (free, offline)
**Type** co-simulation (open library) · **Direction** two-way · **Data** force (N) or stress on the interface from OpenFOAM → CalculiX; displacement (m) CalculiX → OpenFOAM.

**Why / when to use.** FSI or CHT with **no licence cost**, full source code, unlimited cores, good for a thesis (reproducible). **Not** for a quick industrial job by a beginner – expect days of set-up and Linux work.

**How it works.** preCICE is a coupling library. Each solver gets an **adapter** (OpenFOAM adapter, CalculiX adapter). A file `precice-config.xml` defines participants, meshes, data, mapping (nearest-neighbour, RBF), coupling scheme (serial or parallel, explicit or implicit) and acceleration (IQN-ILS – stabilises strong coupling).

**Step by step**
1. Install on Linux (or WSL2 on the Windows factory PC): preCICE, OpenFOAM, OpenFOAM-preCICE adapter, CalculiX + CalculiX adapter (`ccx_preCICE`). Download installers/packages once and carry them offline.
2. Start from an official preCICE tutorial (e.g. the "perpendicular flap" FSI case) – copy and change, do not write from zero.
3. OpenFOAM case: `system/preciceDict` names the interface patch and data (Force, Displacement); dynamic mesh solver for displacement.
4. CalculiX case: interface node set and surface; adapter config file lists the same names.
5. `precice-config.xml`: participants Fluid and Solid, time-window size, implicit coupling, max iterations, IQN-ILS acceleration, convergence limits.
6. Run both in two terminals (or with a run script); watch the coupling iterations per time window.

**Example (example values) – reed valve study.** Time window 1·10⁻⁵ s; one revolution at 1450 rpm = 0.0414 s → **4138 windows per revolution**; 3 revolutions ≈ 12 400 windows. With 3–5 implicit iterations each, plan ≈ 50 000 solver calls → run overnight on 8–16 cores.

**Modules / licences.** All free and open source: preCICE (LGPL), OpenFOAM (GPL), CalculiX (GPL), adapters (preCICE project). Pre/post: FreeCAD, Gmsh, Salome, ParaView (free).

**Watch out.** Version mismatch between adapter and OpenFOAM release · names in preciceDict / adapter config / precice-config.xml not identical · explicit coupling with a light structure diverges · mesh motion fails at small gaps · Windows native builds not standard – use Linux/WSL2.

**Check of result.** Run the tutorial first and compare with its reference result · structure alone under fixed pressure = hand formula (±5 %) · halve the time window: peak displacement change < 3 %.

### C29 – CFDEMcoupling + LIGGGHTS (+ OpenFOAM) – open CFD-DEM
**Type** co-simulation (open source) · **Direction** two-way · **Data** as C22: air velocity, void fraction → DEM; drag force → CFD.

**Why / when to use.** CFD-DEM (C22) without EDEM/Fluent licences; research and thesis work. **Not** for production use without a Linux-skilled person; the public version develops slowly (mark: check current maintenance status – later development moved to commercial "Aspherix®/CFDEM®" by DCS Computing).

**How it works.** LIGGGHTS (DEM, based on LAMMPS) moves particles; CFDEMcoupling is an OpenFOAM solver (e.g. `cfdemSolverPiso`) that calls LIGGGHTS every coupling interval and exchanges drag and void fraction. Same drag laws as C22 (Di Felice, Koch-Hill, Schiller-Naumann). Terminal velocity: solve **u_t = √(4 g d (ρ_p − ρ_g) / (3 C_d ρ_g))** with C_d(Re).

**Step by step**
1. Linux PC: install the OpenFOAM version required by CFDEMcoupling (it is tied to one older version – read its README), LIGGGHTS-PUBLIC, CFDEMcoupling-PUBLIC.
2. Start from a tutorial (e.g. settling or fluidised bed).
3. LIGGGHTS input: particles, contact model (Hertz), insertion, walls (STL).
4. CFD case: mesh (blockMesh/snappyHexMesh), cells ≥ 3 d, `couplingProperties` (drag model, void fraction model, coupling interval).
5. Run with the tutorial run script (MPI parallel).
6. Post-process in ParaView.

**Example (example values) – pneumatic return of 1 mm steel shot.** Solve u_t with Schiller-Naumann: Re = 914, C_d = 0.45 → **u_t ≈ 13.7 m/s**. Vertical lift pipe needs air clearly above that (rule of thumb 1.5–2× u_t → 20–27 m/s) – check with the CFD-DEM run for pipe blocking.

**Modules / licences.** LIGGGHTS-PUBLIC, CFDEMcoupling-PUBLIC (GPL, DCS Computing / community), OpenFOAM (GPL), ParaView – all free.

**Watch out.** Wrong OpenFOAM version (compile errors) · coupling interval too long · void fraction model unsuitable for cell size · believing a non-calibrated contact model.

**Check of result.** Single-particle settling speed = u_t formula (±5 %) · fluidised-bed tutorial pressure drop = bed weight / area (±5 %) · shot mass conserved.

### C30 – Simcenter STAR-CCM+ built-in DEM + multiphase (single platform)
**Type** platform (one solver) · **Direction** fully coupled inside one program · **Data** none to exchange between programs – one mesh, one time loop.

**Why / when to use.** CFD-DEM, Lagrangian particles, VOF (free surface) and heat transfer in one program, one licence, no version-pair problems. Good for cyclones, blast cabins, coolant/chip flow. **Not** when you need the best DEM calibration library (EDEM) or particle wear on GPU at huge particle counts (Rocky).

**How it works.** STAR-CCM+ adds a DEM phase to the Lagrangian multiphase model; particles feel drag from the air and push back. Cyclone cut size (Lapple): **d₅₀ = √( 9 μ W / (2π N_e V_i (ρ_p − ρ_g)) )**, W = inlet width, N_e = effective turns, V_i = inlet velocity.

**Step by step**
1. Import CAD, automatic polyhedral mesh with prism layers.
2. Physics continuum: air (turbulence), Lagrangian Multiphase, add DEM phase (particle shape, size, material, contact model).
3. Injectors: mass flow and size distribution.
4. Two-way coupling on; time step for DEM sub-cycling.
5. Run; reports for separation efficiency, pressure drop, wall loads.

**Example (example values) – dust cyclone of the blast machine.** W = 0.05 m, N_e = 5, V_i = 15 m/s, dust ρ_p = 2500 kg/m³, μ = 1.8·10⁻⁵ Pa·s → **d₅₀ ≈ 2.6 µm** (50 % of 2.6 µm dust is caught). Coarser shot fragments are caught almost fully; fine dust goes to the cartridge filter.

**Modules / licences.** Simcenter STAR-CCM+ (Siemens) – DEM and multiphase are in the standard package (Power Session / Power-on-Demand – confirm with reseller). Siemens supplies everything.

**Watch out.** DEM particle count too high (use parcels for fine dust, DEM only for large particles) · turbulence model affects cyclone result strongly (use Reynolds stress model for cyclones) · inlet velocity not measured.

**Check of result.** Pressure drop vs cyclone supplier curve (±15 %) · d₅₀ near the Lapple estimate (factor 1.5) · mass balance in = caught + escaped (±1 %).

---

## Part E – 1D system ⇄ 3D / control

### C31 – GT-SUITE ⇄ MATLAB/Simulink (SimulinkHarness, FMU)
**Type** co-simulation or model export (S-function / FMU) · **Direction** two-way · **Data** pressure (bar), mass flow (kg/s), temperature (K), shaft speed (rpm) from GT → Simulink; motor torque (N·m), valve command, pressure-switch state from Simulink → GT.

**Why / when to use.** GT-SUITE models the compressor physics (cylinders, reed valves, pipes, pulsation, receiver, heat) in 1D; Simulink holds the control (VSD speed control, pressure switch, unloader logic, motor model). **Not** when only steady-state FAD is needed (a GT model alone is enough).

**How it works.** In GT a **SimulinkHarness** part marks the signals in/out; GT runs as an S-function inside Simulink, or Simulink is compiled into GT. FMU export/import is the alternative. Pulsation: **c = √(γ R T)**, quarter-wave resonance of a closed-open pipe **f = c / (4L)**; pulse frequency of 2 single-acting cylinders at the common discharge = **2 · n/60** and its harmonics.

**Step by step**
1. GT: build the compressor (crank-slider, cylinders, reed valves with lift/stiffness data, discharge pipe, receiver).
2. Validate GT alone: FAD, power, discharge temperature vs test or catalogue.
3. Add SimulinkHarness part; connect sensors (pressure, speed) and actuators (motor torque).
4. Generate the Simulink interface (S-function or FMU – menu name varies by version, see maker help).
5. Simulink: add the GT block, motor model (Simscape Electrical or a torque-speed table), controller.
6. Set the coupling step (≤ 1/(20·f_max)).
7. Run start-up, load/unload cycles; read pressure ripple, motor current.

**Example (example values) – discharge pipe pulsation.** Air 400 K: c = √(1.4·287·400) = **401 m/s**. Pipe L = 1.0 m closed-open: f = 401/4 = **100 Hz**. Pulse frequency at 1450 rpm: 2 · 24.2 = **48.3 Hz**; 2nd harmonic = **96.7 Hz** → close to 100 Hz → resonance risk; change pipe length (e.g. 0.7 m → 143 Hz) or add a volume.

**Modules / licences.** GT-SUITE (Gamma Technologies) with the Simulink coupling / FMI capability; MATLAB + Simulink (+ Simscape Electrical for the motor). Coupling supplied by Gamma Technologies (GT side).

**Watch out.** GT and MATLAB versions not in the supported list · GT time step much smaller than the coupling step – OK, but the coupling step must still resolve pulsation · valve data guessed (dominant error) · algebraic loops in Simulink.

**Check of result.** FAD and shaft power vs test (±5 %) · pressure ripple at receiver vs pressure-sensor test (±20 %) · halve coupling step: result change < 2 %.

### C32 – GT-SUITE ⇄ 3D CFD (1D-3D coupling with CONVERGE / STAR-CCM+ / Fluent)
**Type** co-simulation (boundary coupling) · **Direction** two-way · **Data** pressure (Pa), temperature (K), mass flow (kg/s) at the shared boundary faces.

**Why / when to use.** Most of the system is fine in 1D, but one part has real 3D flow: air filter box, intake manifold, cylinder head ports, a silencer. 3D only where needed keeps run time small. **Not** if a 3D steady flow coefficient (discharge coefficient) put into 1D is good enough.

**How it works.** At each coupling face, 1D gives a boundary condition to 3D (pressure or mass flow) and 3D returns the other quantity. Timing: both advance together; 3D is usually the slow part.

**Step by step**
1. Decide the 3D region and its boundary faces (straight pipe sections, flow normal to face).
2. GT: replace that region with a coupling part (CFD connection template – name varies by version, see maker help).
3. CFD: same faces as boundaries of type "coupled to GT-SUITE" (CONVERGE and STAR-CCM+ have built-in GT coupling; Fluent via supported coupling/UDF – check).
4. Match units, initial conditions, and time steps.
5. Run 3–5 revolutions; the first ones are start-up.

**Example (example values) – intake valve flow.** FAD 20 m³/h, volumetric efficiency 0.75, 1450 rpm → swept volume per revolution = 20/(0.75·1450·60) = **3.07·10⁻⁴ m³ (307 cm³), 153 cm³ per cylinder**. Suction lasts about half a revolution → mean flow in suction ≈ **7.4 L/s**; through a 2 cm² valve area → mean velocity **37 m/s** – high enough that 3D losses at the port matter (pressure loss ∝ v²).

**Modules / licences.** GT-SUITE (+ coupling option); CONVERGE (Convergent Science) or Simcenter STAR-CCM+ or Ansys Fluent. Coupling interface supplied by Gamma Technologies together with the CFD vendor.

**Watch out.** Boundary face where flow reverses or swirls (place it in a straight pipe) · different gas properties in 1D and 3D · 3D too coarse at valves · using the start-up revolution.

**Check of result.** Mass flow through the face equal on both sides (±1 %) · 1D-only and coupled FAD differ only where expected · port pressure loss vs flow-bench test (±10 %).

### C33 – Simcenter Amesim ⇄ MATLAB/Simulink
**Type** co-simulation or model exchange (S-function) / FMU · **Direction** two-way · **Data** pressure (bar), flow (L/min), position (mm), velocity (m/s) from Amesim → Simulink; valve command (V or %), pump speed (rpm) Simulink → Amesim.

**Why / when to use.** Hydraulic or pneumatic circuit physics in Amesim (pumps, valves, accumulators, cylinders), control logic in Simulink (PLC-like sequence, PID). Typical: APC lift cylinder, press, clamping. **Not** if the whole model fits in Simscape Fluids (C35).

**How it works.** In Amesim you add the **Simulink interface block** with inputs/outputs; Amesim compiles the model as an S-function. **Model exchange**: Simulink's solver integrates everything (fast, one solver). **Co-simulation**: each keeps its solver and they swap every step (better if stiffness differs). Cylinder: **F = p · A**, **Q = A · v**.

**Step by step**
1. Amesim: build circuit; add the Simulink interface icon (Interfaces library) and connect signals.
2. Choose interface type: model exchange or co-simulation; compile.
3. In Simulink add the Amesim S-function block (file name = model name; set the path so MATLAB finds it).
4. Connect controller; set Simulink solver (stiff solver such as ode15s for model exchange).
5. Run; open Amesim to post-process its variables.

**Example (example values) – APC lift cylinder Ø63/36 at 7 MPa (guide 09).** A = π/4 · 0.063² = **3.12·10⁻³ m²**; push force = 7·10⁶ · 3.12·10⁻³ = **21.8 kN**. At 0.1 m/s the pump/valve must give Q = 3.12·10⁻³ · 0.1 = **18.7 L/min**. Simulink ramps the proportional valve so acceleration stays low (soft start/stop).

**Modules / licences.** Simcenter Amesim (Siemens) with the hydraulic libraries + Simulink interface option; MATLAB + Simulink (+ Stateflow for sequences). Interface supplied by Siemens.

**Watch out.** Compiler not installed/configured for Amesim (S-function cannot be built) · MATLAB/Amesim version pair not supported · non-stiff Simulink solver with hydraulics → very slow or unstable · units at the interface (bar vs Pa).

**Check of result.** Static force = p·A (±1 %) · cylinder speed vs flow/area (±3 %) · pressure peak at stop vs measured test (±20 %).

### C34 – Simcenter Amesim ⇄ Adams / Simcenter 3D Motion (hydraulics + mechanism)
**Type** co-simulation · **Direction** two-way · **Data** cylinder force (N) Amesim → MBD; rod position (m) and velocity (m/s) MBD → Amesim.

**Why / when to use.** The hydraulic cylinder drives a mechanism with large changing loads and inertia (APC arm with 1480 kg lifted mass, press linkage, tilting table). The mechanism changes the load, the load changes pressure. **Not** if the load on the cylinder is a simple known mass (put mass in Amesim).

**How it works.** MBD computes motion of the mechanism; Amesim computes pressure and force in the cylinder. Hydraulic stiffness of a trapped oil column **k_h = β · A² / V** and natural frequency **f_h = (1/2π) · √(k_h / m)** set the communication step.

**Step by step**
1. Adams (or Simcenter 3D Motion): mechanism with a translational joint at the cylinder; a force element whose value comes from an input variable.
2. Outputs: joint displacement and velocity.
3. Amesim: cylinder model with the external force/position port and the co-simulation interface for the MBD tool (Amesim–Adams interface / Amesim–Simcenter 3D Motion interface).
4. Generate the interface files; set communication step.
5. Run from the master tool (often Amesim or Adams – see interface docs).

**Example (example values) – APC lift.** β_eff = 1.0 GPa, A = 3.12·10⁻³ m², oil V = 0.5 L, m = 1480 kg: k_h = **1.94·10⁷ N/m**, f_h = **18.2 Hz** → communication step ≤ 1/(20·18.2) = **2.7 ms**; use 1 ms for margin.

**Modules / licences.** Simcenter Amesim + Adams interface (or Simcenter 3D Motion + Amesim coupling, Siemens); MSC Adams (Hexagon) with Adams Controls/co-sim capability. Interface supplied by Siemens (Amesim side).

**Watch out.** Sign convention of force/direction · communication step too large → false oscillation · cylinder end-stops modelled twice (in both tools) · friction missing.

**Check of result.** Static hold pressure = load / A (±2 %) · natural frequency in the coupled model near f_h (±10 %) · halve communication step: change < 2 %.

### C35 – Simscape Fluids + Simscape Multibody (single platform, APC / press)
**Type** platform (one tool) · **Direction** fully coupled · **Data** inside Simulink: physical connections (pressure, flow, force, motion).

**Why / when to use.** One program for hydraulics + mechanism + control + electric motor + later PLC code (PLC Coder). Easiest chain for a small team already using MATLAB. **Not** for detailed pump/valve libraries from suppliers (Amesim richer) or large flexible structures.

**How it works.** Simscape builds physical networks. A Simscape Fluids cylinder connects to a Simscape Multibody prismatic joint through a force/motion interface block. CAD comes from Simscape Multibody Link (guide 53 R1). Press-fit force: **F = p_c · π · d · L · μ**.

**Step by step**
1. Import the mechanism (smimport from CAD) or build it in Multibody.
2. Add Simscape Fluids (Isothermal Liquid library): pump, relief valve, directional valve, cylinder, hoses.
3. Connect cylinder to the prismatic joint (force input from cylinder, position sensing back).
4. Add control (Stateflow sequence, PID) and motor (Simscape Electrical).
5. Solver: daessc or ode15s, local solver off for first runs.
6. Run, then generate PLC code from the control part (Simulink PLC Coder).

**Example (example values) – bearing press-fit station.** Bearing seat d = 30 mm, L = 15 mm, contact pressure 40 MPa, μ = 0.15 → F = 40 · π · 30 · 15 · 0.15 = **8.48 kN**. Cylinder Ø40 → needed pressure = 8480 / 1257 mm² = **6.75 MPa** → use a 10 MPa system with margin; force sensor checks the press curve.

**Modules / licences.** MATLAB, Simulink, Simscape, Simscape Fluids, Simscape Multibody (+ Simscape Electrical, Stateflow, Simulink PLC Coder as needed). All MathWorks; Multibody Link plug-in free with the Multibody licence.

**Watch out.** Fluid properties (temperature, entrained air) default values · stiff system with explicit solver · CAD masses wrong (check mass properties) · end-stop contact too stiff → tiny steps.

**Check of result.** Static force = p·A (±1 %) · cycle time vs PLC sequence plan (±5 %) · press curve vs real press-fit records.

### C36 – Modelica (Dymola / OpenModelica) FMU ⇄ Simulink / Python
**Type** FMU (model export) · **Direction** Modelica → host (one-way model transfer, then the host runs it) · **Data** any signals defined in the FMU (pressure bar, temperature K, motor state).

**Why / when to use.** System models (thermal, fluid, electric, control) written in the open Modelica language; free with OpenModelica. Export as FMU to run inside Simulink or **inside the Python twin** (offline). **Not** for 3D detail.

**How it works.** OpenModelica or Dymola compiles the model into an **FMU** (FMI 2.0/3.0, Co-Simulation or Model Exchange). Simulink has an FMU import block; Python runs it with FMPy (pip package – install from an offline wheel). Receiver fill time (isothermal): **t = V · Δp / (p_atm · Q_FAD)**.

**Step by step**
1. Build the model (Modelica Standard Library: Fluid, Thermal, Electrical, Blocks).
2. Define inputs/outputs as top-level connectors.
3. Export FMU: OpenModelica OMEdit → File → Export → FMU (choose FMI version, CS or ME, platform win64); Dymola: Translate → FMU.
4. Simulink: FMU block → select file; or Python: `fmpy.simulate_fmu('model.fmu', ...)`.
5. Feed real/simulated inputs, read outputs; for the twin, post values to the HTTP API (guide 53 R13).

**Example (example values) – receiver + pressure switch model for the twin.** Receiver 200 L, switch 6 → 8 bar, FAD 20 m³/h = 5.56·10⁻³ m³/s: t = 0.2 · 2 / (1.013 · 5.56·10⁻³) = **71 s** loading time (no consumption). The FMU gives the twin a live tank-pressure curve and motor start count.

**Modules / licences.** OpenModelica (free, OSMC) or Dymola (Dassault, with FMI export option); MATLAB/Simulink (FMU import built in, recent releases) or Python + FMPy (free). FMI standard: Modelica Association.

**Watch out.** FMU compiled for the wrong platform (Linux vs win64) · FMI version not supported by the host · parameters frozen at export (expose them as parameters) · Model Exchange FMU with a weak host solver.

**Check of result.** FMU result = original Modelica result (±0.1 %) · tank fill time vs hand formula (±5 %) and vs real test.

### C37 – Ansys Twin Builder ROM → FMU → Simulink / Python twin
**Type** model export (ROM + FMU) · **Direction** Ansys → host · **Data** inputs (speed rpm, load kW, ambient °C) → outputs (temperature °C, displacement µm, stress MPa).

**Why / when to use.** A 3D FEA/CFD result is too slow for live use. A reduced-order model (ROM) answers in milliseconds, so the digital twin can show "virtual sensors" (e.g. head temperature where no sensor is). **Not** when inputs go far outside the training range.

**How it works.** Run a design of experiments in Ansys (several speeds, loads, ambients) → Twin Builder **ROM Builder** builds a static ROM (steady maps) or dynamic/LTI ROM (time response) → export FMU. Simple thermal model to check: **T(t) = T_∞ + (T₀ − T_∞) · e^(−t/τ)**, **τ = m · c / (h · A)**.

**Step by step**
1. Parametrise the Ansys model (inputs as parameters, outputs as results).
2. Run the DOE (e.g. 20–50 cases; for dynamic ROM, step-response runs).
3. Twin Builder: ROM Builder → choose ROM type → train → check error on test points.
4. Export the ROM as FMU (or Twin Deployer runtime).
5. Load into Simulink or Python; connect to real sensor data (speed, ambient) through the twin.

**Example (example values) – aluminium head temperature.** m = 2 kg, c = 900 J/kgK, h = 40 W/m²K, A = 0.15 m² → **τ = 300 s** (5 min). After 15 min (3τ) the head reaches 95 % of its final temperature. The ROM must reproduce this time constant.

**Modules / licences.** Ansys Mechanical/Fluent (to make the data), Ansys Twin Builder (+ ROM Builder); deploying a twin in production may need a Twin runtime licence – ask Ansys. Python side: FMPy (free).

**Watch out.** Training range too small · dynamic ROM trained only with steps (test also with ramps) · runtime licence forgotten in the project budget · FMU platform mismatch.

**Check of result.** ROM vs full Ansys on 3–5 unseen points (±3 %) · time constant vs hand τ (±20 %) · ROM vs thermocouple on the real compressor (±5 K).

---

## Part F – Electromagnetic / motor

### C38 – Ansys Maxwell / Motor-CAD → MATLAB/Simulink (efficiency maps, lookup tables, ECE/ROM)
**Type** file (map export) or model export (ECE / ROM / FMU) · **Direction** EM tool → Simulink · **Data** efficiency η (–) or loss (W) vs speed (rpm) and torque (N·m); flux linkage maps ψ_d, ψ_q (Wb) vs currents (A).

**Why / when to use.** You need a correct motor inside the system model: energy use of the compressor, VSD control, start current, heat. **Not** if a catalogue efficiency at rated point is enough (simple table from the datasheet).

**How it works.** Motor-CAD (Lab module) or Maxwell computes the motor at many operating points. Export: (a) 2D lookup tables η(n, T) or losses, (b) flux-linkage maps for a dynamic d-q model, (c) equivalent circuit extraction (ECE) or ROM into Twin Builder → FMU. Torque: **T = 9550 · P / n** (kW, rpm); losses **P_loss = P · (1/η − 1)**.

**Step by step**
1. Model the motor (or get the model from the motor maker – often the best way).
2. Motor-CAD Lab: compute efficiency map over the speed/torque range; export as text/MATLAB file (export option name varies by version – see maker help).
3. Simulink: 2-D Lookup Table block (speed, torque → loss); or Simscape Electrical motor block with tabulated data.
4. For control design: export flux maps → Simulink PMSM/induction model with tables.
5. Connect to the compressor load (GT-SUITE C31 or a torque-vs-crank-angle table).

**Example (example values) – 4 kW 4-pole motor at 1450 rpm** (direct-drive variant; Parts A–C use the belt-drive variant 3 kW, 2930 rpm motor → 1450 rpm crank). T = 9550 · 4 / 1450 = **26.3 N·m**. With η = 88.6 % (IE3 class value for 4 kW 4-pole 50 Hz – check IEC 60034-30-1 and the datasheet): loss = 4000 · (1/0.886 − 1) = **515 W** → heat for the cabinet/fan design; energy per year follows from the load profile.

**Modules / licences.** Ansys Motor-CAD (EMag + Lab modules) and/or Ansys Maxwell (+ Twin Builder for ECE/ROM/FMU); MATLAB + Simulink (+ Simscape Electrical, Motor Control Blockset for control). All export files are vendor-neutral tables.

**Watch out.** Map extrapolation outside the computed range · copper temperature of the map ≠ real operating temperature · map for sine supply used for VSD (PWM adds losses) · speed in rad/s vs rpm.

**Check of result.** Rated point vs motor datasheet η and current (±1–2 %) · no-load and locked-rotor points vs test · energy over a duty cycle vs power-meter measurement (±5 %).

### C39 – JMAG (JMAG-RT) ⇄ MATLAB/Simulink
**Type** model export (JMAG-RT plant model) · **Direction** JMAG → Simulink (the model then runs in Simulink, also real-time HIL) · **Data** inductance/flux maps L_d, L_q (H), ψ (Wb), torque (N·m) vs i_d, i_q (A) and rotor angle.

**Why / when to use.** Design and test the VSD/PMSM controller with a motor model that includes saturation and cogging (better than constant-parameter models), also on HIL. **Not** for induction motors run direct-on-line without control design (use C38 maps).

**How it works.** JMAG FEA computes the motor over a grid of currents and angles → **JMAG-RT** model file → Simulink JMAG-RT library block computes currents and torque in real time. PMSM torque: **T = 1.5 · p · (ψ · i_q + (L_d − L_q) · i_d · i_q)**, p = pole pairs.

**Step by step**
1. JMAG Designer: motor model, materials (B-H curves), winding.
2. Create the JMAG-RT model (RT model generation study – see maker help); choose current/angle range.
3. Check the RT model in JMAG-RT Viewer (maps smooth, range covers peak current).
4. Simulink: add the JMAG-RT block from its library, load the RT file, connect inverter model and controller (FOC).
5. Run SIL; later the same plant on an HIL system.

**Example (example values) – IPM motor for a VSD compressor.** p = 2, ψ = 0.2 Wb, i_q = 10 A, i_d = −5 A, L_d = 8 mH, L_q = 12 mH → T = 1.5 · 2 · (0.2·10 + (−0.004)·(−5)·10) = **6.6 N·m** (0.2 N·m of it is reluctance torque from negative i_d).

**Modules / licences.** JMAG Designer + JMAG-RT (JSOL Corporation); MATLAB + Simulink (+ Simscape Electrical / Motor Control Blockset). JMAG-RT Simulink block supplied by JSOL.

**Watch out.** Current range too small (saturation at peak current missing) · map grid too coarse (torque ripple wrong) · sign convention of i_d · temperature of magnets not matched (ψ drops with heat).

**Check of result.** Back-EMF at a given speed vs test (±3 %) · torque at rated current vs dyno test (±5 %) · RT result = JMAG FEA at check points (±2 %).

### C40 – Ansys Maxwell (EM forces) → Ansys Mechanical (harmonic vibration) → acoustics (motor noise chain)
**Type** file / mapping in Workbench (one-way chain) · **Direction** Maxwell → Mechanical → acoustics · **Data** surface force density (N/m²) per frequency (Hz) → velocity/displacement (m/s, m) → sound power (W, dB).

**Why / when to use.** Motor magnetic noise ("whine") and vibration of the motor + compressor frame. One-way is fine because vibration does not change the magnetic field. **Not** if the main noise is mechanical (valves, pistons) – check the noise spectrum first.

**How it works.** Maxwell transient computes magnetic forces on the stator teeth → Workbench maps them (FFT to frequencies) to a **Harmonic Response** in Mechanical → surface velocity → **ERP** (equivalent radiated power, ERP = ½ ρ c Σ v_n² A) or a Harmonic Acoustics model → sound power. Induction motor: main force at **2·f₁** (100 Hz at 50 Hz); rotor slot frequency **f = Z_r · n/60** with side bands **± 2 f₁**. Sound power level **L_W = 10 · log₁₀(W / 10⁻¹² W)** dB.

**Step by step**
1. Maxwell 2D/3D transient at the operating point; calculate forces on stator teeth (force density / tooth forces).
2. Workbench: link Maxwell solution → Harmonic Response (Mechanical) – Maxwell forces are imported and mapped (menu name varies by version).
3. Mechanical: stator + housing + feet (+ compressor frame if needed), modal analysis first, damping (e.g. 2 %).
4. Harmonic response over the excitation frequencies; output ERP or connect to Harmonic Acoustics.
5. Compare peaks with natural frequencies; change design (stiffer feet, skew, slot combination).
6. Optional: listen with Ansys Sound (auralisation).

**Example (example values) – 4-pole induction motor, 28 rotor bars, 1450 rpm, 50 Hz.**
- Main magnetic force: **100 Hz**.
- Rotor slot passing: 28 · 1450 / 60 = **676.7 Hz**, side bands **576.7 Hz and 776.7 Hz** → if a housing mode sits near 580–780 Hz, expect a whine.
- Radiated sound power 10⁻⁴ W → L_W = **80 dB**.

**Modules / licences.** Ansys Maxwell (Electronics Desktop), Ansys Mechanical (Premium/Enterprise, harmonic + acoustics), Workbench; optional Ansys Sound. All Ansys. Free route: FEMM (2D magnetics, free) → force files → CalculiX/Code_Aster harmonic via own scripts (much more work).

**Watch out.** Too few time steps in Maxwell (force harmonics aliased) · mapping to a coarse mechanical mesh · no damping or wrong damping · ignoring the mounting (rubber feet change everything).

**Check of result.** Mechanical modal frequencies vs hammer test (±5 %) · noise spectrum peaks at the predicted frequencies (100 Hz, 577/677/777 Hz) · L_W vs sound measurement to ISO 3744 (±3 dB).

---

### Part 2 summary table

| Coupling | Type | Main modules | Set-up effort ★ (more = harder) | Value for compressor factory ★ |
|---|---|---|---|---|
| C22 EDEM ⇄ Fluent | co-sim CFD-DEM | Altair EDEM + coupling, Ansys Fluent | ★★★★ | ★★★ (shot blasting) |
| C23 Rocky ⇄ Fluent / Mechanical | platform | Ansys Rocky, Fluent, Mechanical | ★★★ | ★★★ (blasting wear) |
| C24 EDEM ⇄ Adams / RecurDyn / MotionSolve | co-sim DEM-MBD | EDEM + coupling, Adams / RecurDyn / MotionSolve | ★★★★ | ★★ (conveyors) |
| C25 Fluent ⇄ Mechanical FSI | co-sim | Fluent, Mechanical, System Coupling | ★★★★ | ★★★★★ (valve reed) |
| C26 STAR-CCM+ ⇄ Abaqus | co-sim | STAR-CCM+, Abaqus | ★★★★ | ★★★★ (reed impact) |
| C27 CHT → thermal stress | file / mapping | Fluent or STAR, Mechanical, External Data | ★★ | ★★★★★ (cylinder, head) |
| C28 OpenFOAM ⇄ CalculiX (preCICE) | open co-sim | preCICE, OpenFOAM, CalculiX (free) | ★★★★★ | ★★★ (free FSI, thesis) |
| C29 CFDEM + LIGGGHTS | open CFD-DEM | CFDEMcoupling, LIGGGHTS, OpenFOAM (free) | ★★★★★ | ★★ |
| C30 STAR-CCM+ DEM + multiphase | platform | Simcenter STAR-CCM+ | ★★ | ★★★ (cyclone, cabin) |
| C31 GT-SUITE ⇄ Simulink | co-sim / FMU | GT-SUITE, MATLAB, Simulink | ★★★ | ★★★★★ (valves, pulsation, control) |
| C32 GT-SUITE ⇄ 3D CFD | co-sim boundary | GT-SUITE, CONVERGE / STAR / Fluent | ★★★★ | ★★★ (intake, ports) |
| C33 Amesim ⇄ Simulink | co-sim / S-function | Simcenter Amesim, Simulink | ★★ | ★★★★ (hydraulic APC) |
| C34 Amesim ⇄ Adams / 3D Motion | co-sim | Amesim, Adams or Simcenter 3D Motion | ★★★ | ★★★ (APC mechanism) |
| C35 Simscape Fluids + Multibody | platform | MATLAB, Simulink, Simscape Fluids + Multibody | ★★ | ★★★★ (press, APC, PLC code) |
| C36 Modelica FMU ⇄ Simulink / Python | FMU | OpenModelica (free) / Dymola, FMPy | ★★ | ★★★★ (twin models, free) |
| C37 Twin Builder ROM → FMU | model export | Ansys + Twin Builder, FMPy | ★★★ | ★★★★ (virtual sensors) |
| C38 Maxwell / Motor-CAD → Simulink | maps / ROM | Motor-CAD Lab / Maxwell, Simulink | ★★ | ★★★★ (energy, VSD) |
| C39 JMAG-RT ⇄ Simulink | model export | JMAG Designer + JMAG-RT, Simulink | ★★★ | ★★★ (VSD control) |
| C40 Maxwell → Mechanical → acoustics | file chain | Maxwell, Mechanical, (Ansys Sound) | ★★★ | ★★★ (motor noise) |

---

## Part G – Manufacturing process chain

### C41 – CAD → CAM → post → VERICUT → CNC
**Type:** file + model export (one-way chain) · **Direction:** CAD → CAM → G-code → simulation → machine · **Data:** 3D solid (STEP / Parasolid / native), tool paths (CL data), G-code (ISO 6983 text), tool list (Ø, length, holder), work offsets (mm), fixture model, optimised feeds (mm/min)

**Why / when to use**
- Every CNC part. The post-processor turns tool paths into G-code for one machine + control; VERICUT runs the **real G-code**
  on a machine model and finds collisions, over-travel and gouges before metal is cut.
- VERICUT **Force** adds cutting-force physics and changes feeds so chip load stays constant → shorter cycle, less tool breakage.
- Not needed for very simple 2.5D parts on a well-proven post – but still recommended for new 5-axis / HMC programs.

**How it works**
- CAM writes cutter location (CL) data → post → G-code. VERICUT reads the G-code, the machine kinematics (axes, limits),
  the control emulation (Fanuc / Siemens / Heidenhain cycles, macros), tools, stock and fixture.
- It removes material step by step → **stock compare** with the CAD model (gouge / leftover in mm).
- Force: F_c = k_c · b · h (chip width × chip thickness). Feed is raised where h is small, lowered where force or power limit is reached.

**Step by step**
1. CAD: final model, PMI / tolerances; export Parasolid or STEP AP242 (or use the CAM inside the CAD).
2. CAM: set stock, fixture, work offset (G54…), tools from the tool library; program operations.
3. Post-process with the **machine-specific post** (from CAM reseller or machine builder) → `.nc` / `.mpf` / `.h` file.
4. VERICUT: open the machine template of your HMC (axes, travel limits, tool changer, pallet), control file (e.g. Sinumerik 840D).
5. Add stock, fixture (STEP), tool library (same IDs and gauge lengths as the real machine), work offsets.
6. Load the G-code → run → read the log: collisions, axis limits, errors in cycles; **AUTO-DIFF** stock compare vs CAD.
7. Force (optional module): define tool + material → optimise → writes a new G-code with optimised feeds.
8. Send to the CNC through DNC / network; first part with feed override low; compare cycle time with VERICUT.

**Example (example values)**
Crankcase roughing on the HMC: CAM cycle 12.0 min. VERICUT Force raises feed in light cuts and finds a 25 % reduction →
12.0 · 0.75 = **9.0 min**. At 15 000 crankcases/year: 15 000 · 3 min / 60 = **750 h/year** saved; at $60/h machine rate
= **$45 000/year** (example). In the same run VERICUT found a holder collision with the fixture clamp at B90 – fixed in CAM.

**Modules / licences**
- CAD + CAM (e.g. NX CAM, Mastercam, hyperMILL, SolidCAM) + **post-processor** for each machine (reseller / machine builder).
- **VERICUT** (CGTech): Verification + Machine Simulation + **Control emulation** for your CNC + **Force** (optional) + CAM interface
  plug-in (CGTech supplies interfaces for NX, Mastercam, hyperMILL, CATIA, Creo, ESPRIT…). Alternatives: NX ISV + VNCK, Mastercam Simulator.

**Watch out**
- Machine model or tool gauge lengths differ from the real machine → "safe" simulation, real crash.
- Simulating CAM paths instead of post G-code → post errors not seen.
- Missing control macros / cycles (L-subroutines, probing cycles) → VERICUT skips them.
- Force data for the wrong material grade (GJL-250 vs GJS-500).

**Check of result**
- Real cycle time within **± 5 %** of VERICUT. First part CMM vs CAD: no gouge; stock-compare tolerance ≤ 0.05 mm.

### C42 – Casting simulation (MAGMASOFT / ProCAST / FLOW-3D CAST) → FEA
**Type:** file (one-way mapping) · **Direction:** casting simulation → FEA · **Data:** porosity map (% volume), local microstructure /
strength (MPa), residual stress tensor (MPa), distortion (mm), mapped onto the FEA mesh

**Why / when to use**
- Crankcase and cylinders are castings. Real strength is **not uniform**: porosity in thick sections and casting residual stress
  lower local fatigue strength. Mapping them into FEA gives a realistic fatigue safety factor.
- Not needed when the FEA safety factor is already very high (e.g. n > 4) everywhere.

**How it works**
- Casting tool simulates filling, solidification, cooling → porosity, ferrite / pearlite, residual stress.
- Results are written per cell and **mapped** (interpolated) to the FEA mesh (nearest node / volume averaging).
- Fatigue: local endurance σ_e reduced by a porosity knockdown factor (from your material tests). Goodman with residual
  stress as extra mean stress: **1/n = σ_a/σ_e + (σ_m + σ_res)/R_m**.

**Step by step**
1. Send CAD of the casting + gating / risers (foundry design) to the casting tool; set alloy, mould material, pouring T.
2. Run filling + solidification + stress (stress module needed for residual stress).
3. Export results: MAGMA – mapping interface to FEA (MAGMAlink); ProCAST – export to Abaqus / Ansys; FLOW-3D CAST – results export
   (exact export names vary by version – see maker help).
4. In FEA, import the mapped field: Ansys Mechanical **External Data** (mapping of point data), Abaqus initial-condition stress
   (*INITIAL CONDITIONS, TYPE=STRESS) or a third-party mapper.
5. Assign local material zones (e.g. σ_e by porosity class).
6. Run the operating load cases (bolt preload + gas force + bearing forces).
7. Fatigue: Goodman / Haigh with residual stress, local σ_e.
8. Feed back: if n too low → change wall thickness, add chill / riser at the foundry, re-run.

**Example (example values)**
Crankcase GJL-250, bearing boss: R_m = 250 MPa, σ_e = 100 MPa, σ_a = 25 MPa, σ_m = 15 MPa.
- Plain FEA: n = 1 / (25/100 + 15/250) = **3.23**.
- Add casting residual stress σ_res = +20 MPa (tensile): n = 1 / (25/100 + 35/250) = **2.56**.
- Plus porosity zone (1 % porosity, knockdown 15 % from your tests): σ_e = 85 MPa → n = **2.30**. Still OK (target ≥ 2.0), but margin
  shrank from 3.2 to 2.3 – the foundry adds a chill at this boss.

**Modules / licences**
- MAGMASOFT (MAGMA) with stress module + MAGMAlink; or ProCAST (ESI, now Keysight) with stress; or FLOW-3D CAST (Flow Science).
- FEA: Ansys Mechanical (External Data is standard) or Abaqus; fatigue: nCode DesignLife, fe-safe, or own Goodman sheet.

**Watch out**
- Mesh mapping errors (different units, different origin) – check a known point.
- Residual stress after **machining** is different from as-cast (material removal relaxes stress).
- Porosity knockdown factors guessed instead of measured (fatigue tests or CT + defect size rules).
- Grey cast iron is not linear elastic in tension – use the maker's grey-iron material model or conservative E.

**Check of result**
- Porosity map vs CT scan or sectioned first casting: location matches. Distortion vs CMM of raw casting within **± 0.3 mm**.

### C43 – Welding simulation (Simufact Welding / ESI SYSWELD / Ansys) → distortion → FEA
**Type:** file / model export (one-way) · **Direction:** weld simulation → structural FEA · **Data:** distortion (mm), residual
stress (MPa), heat-affected-zone hardness / properties, deformed geometry

**Why / when to use**
- Air tank (pressure vessel) and welded base frame: welding causes **shrinkage, distortion, residual stress**. Simulation
  predicts weld sequence and pre-set (pre-bending) and gives residual stress for the strength / fatigue check.
- Not needed for small brackets or when fixture + straightening is cheap.

**How it works**
- Moving heat source (Goldak double-ellipsoid) → transient thermal → thermo-mechanical stress with phase changes.
- Rule of thumb for transverse shrinkage (butt weld): **S ≈ 0.2 · A_w / t + 0.05 · d** (A_w weld area mm², t plate mm, d root gap mm).
- Result: deformed shape + residual stress → mapped into the FEA as initial state.

**Step by step**
1. CAD of parts + weld seams (paths), fixture / clamps.
2. Weld tool: material (steel P265GH / S235), process (MAG), current, voltage, speed, sequence.
3. Calibrate heat source with one real weld macro-section (penetration shape).
4. Run sequence variants; compare distortion.
5. Export deformed mesh + stress (Simufact / SYSWELD export to Abaqus / Ansys / Nastran; Ansys can do weld simulation natively).
6. FEA: pressure load (design pressure) + residual stress → stress check (EN 13445 / ASME VIII, see guide 16).
7. Fatigue of weld toes per IIW / EN 13445-3 – residual stress usually covered by the weld detail class.

**Example (example values)**
Air tank shell t = 4 mm, longitudinal butt weld A_w = 18 mm², root gap 1 mm: S = 0.2·18/4 + 0.05·1 = **0.95 mm** shrinkage across the seam.
Base frame (3 m rails): simulation shows 2.4 mm bow with sequence "left then right"; alternating sequence reduces it to 0.9 mm
(simulated values) → less straightening before machining of motor and compressor feet.

**Modules / licences**
- Simufact Welding (Hexagon), ESI SYSWELD / Weld Planner (Keysight), or Ansys Mechanical (thermal-structural with element birth/death) /
  Abaqus Welding Interface. FEA export interfaces are supplied by the weld-tool maker.

**Watch out**
- Heat source not calibrated → distortion wrong by factor 2.
- Clamps released too early in the model vs real shop.
- Pressure vessel approval still needs code calculation and test (hydrotest) – simulation does not replace them.

**Check of result**
- Measured distortion of the first frame / tank within **± 30 %** (good) of simulation; macro-section matches penetration.

### C44 – AM process simulation (Ansys Additive / Simufact Additive / Netfabb) → distortion-compensated CAD
**Type:** model export (loop) · **Direction:** CAD → AM simulation → pre-deformed CAD → printer · **Data:** distortion field (mm), support
loads, recoater-collision risk, compensated STL / CAD

**Why / when to use**
- Metal LPBF parts (guide 48) distort from heating / cooling layer by layer. Simulation predicts the distortion and builds a
  **pre-deformed** model so the printed part comes out in tolerance. Saves 2–4 trial builds.
- Not needed for small, stiff parts or plastic AM.

**How it works**
- Inherent-strain or thermo-mechanical layer simulation → distortion δ at each node.
- Compensation: **x_comp = x_nominal − f · δ** (f ≈ 0.8–1.0, iterate 1–2 times).

**Step by step**
1. Import part STL / CAD, orientation, supports, build plate.
2. Material + machine parameters (calibrate with a cantilever test print – inherent strain values).
3. Simulate → distortion, stress, recoater collision warning.
4. Run **compensation** (built-in function) → export compensated STL.
5. Re-simulate compensated part → residual distortion.
6. Print, measure (3D scan), compare.

**Example (example values)**
Cooling-fin insert / bracket: tip predicted +0.42 mm. Compensation f = 1.0 → −0.42 mm pre-deform. Re-simulation leaves +0.06 mm
(0.42 − 0.36 corrected) → within ± 0.1 mm tolerance after one iteration.

**Modules / licences**
- Ansys Additive Suite (Print / Science) or Ansys Workbench Additive; Simufact Additive (Hexagon); Autodesk Netfabb (Simulation
  utility – Autodesk licence, check online-sign-in rule, guide 52 §9); Materialise Magics + simulation module.

**Watch out**
- Calibration from a different machine / powder lot. Support removal + heat treatment change distortion again – simulate them.
- Over-compensation if f too high on flexible parts.

**Check of result**
- 3D scan of the first compensated part: deviation ≤ tolerance (e.g. **± 0.1 mm**) on 95 % of the surface.

### C45 – Machining simulation (AdvantEdge / Production Module / VERICUT Force) → part / fixture deflection in FEA
**Type:** file (one-way) · **Direction:** cutting simulation → FEA · **Data:** cutting forces F_x, F_y, F_z (N) vs time, temperature (°C),
tool engagement

**Why / when to use**
- Thin walls (crankcase cover, valve plate) and weak fixtures deflect under cutting force → form error, chatter. Force from the
  cutting simulation goes to FEA of part + fixture to predict the error.
- Not needed for stiff blocks with small cuts.

**How it works**
- Mechanistic force model: F_t = K_tc · a_p · h + K_te · a_p (cutting + edge coefficients). FE-cutting tools (AdvantEdge) simulate chip
  formation for force and temperature.
- Deflection of a simple wall: cantilever **k = 3·E·I / L³**, I = b·t³/12, **δ = F / k**.

**Step by step**
1. From CAM / VERICUT Force: extract the peak force per operation and the location.
2. Or run Production Module / AdvantEdge for force + temperature of a specific tool and material.
3. FEA: part + fixture (contact at clamps, bolt preload), apply the force at the cutting point (several positions).
4. Read deflection at the cutting point → compare with tolerance.
5. Change: fewer passes / lower a_e, add support, change clamping, or reduce feed in that zone.

**Example (example values)**
Wall 40 mm wide, 5 mm thick, 30 mm high, GJL E ≈ 110 GPa: I = 40·5³/12 = 416.7 mm⁴; k = 3·110 000·416.7 / 30³ = **5 093 N/mm (5.1 N/µm)**.
Finishing force F = 200 N → δ = 200 / 5 093 = **39 µm** → too much for a ± 20 µm tolerance. Halve radial depth (F ≈ 100 N → ≈ 20 µm)
or add a support pin.

**Modules / licences**
- Third Wave Systems **AdvantEdge** (FE cutting) and **Production Module** (tool path force analysis); or VERICUT Force.
- FEA: Ansys Mechanical / Abaqus / SOLIDWORKS Simulation; CSV import of forces.

**Watch out**
- Cutting coefficients from literature instead of tests on your material. Dynamic effects (chatter) need C46, not static FEA.
- Fixture contact modelled as bonded → too stiff.

**Check of result**
- Measured wall error on the first part (CMM) within **± 30 %** of predicted deflection.

### C46 – Chatter stability: tap-test FRF (CutPro / MetalMAX / Simcenter Testlab) → stability lobes → CAM spindle speed
**Type:** file (one-way, measured data) · **Direction:** modal test → stability calculation → CAM cutting data · **Data:** FRF G(ω)
(µm/N vs Hz), natural frequency f_n (Hz), damping ζ, stiffness k (N/µm) → stable depth a_lim (mm) vs spindle speed (rpm)

**Why / when to use**
- Chatter (self-excited vibration) limits depth of cut and ruins surface. A 10-minute tap test at the tool tip gives "stability lobes":
  speeds where much deeper cuts are stable. Very high value for HMC roughing of crankcases.
- Not needed for light finishing cuts far below the limit.

**How it works**
- Hammer hits tool tip, accelerometer measures → FRF. Minimum stable depth (single-DOF, simplified):
  **a_lim = −1 / (2 · K_t · N* · Re[G]_min)**, with Re[G]_min = −1 / (4·k·ζ·(1+ζ)) → a_lim,min = 2·k·ζ·(1+ζ) / (K_t · N*).
- N* = average teeth in cut (slotting = z/2). Best speeds near **n_j ≈ 60 · f_n / (z · (j+1))**, j = 0, 1, 2…

**Step by step**
1. Mount tool in holder in the spindle (exact stick-out).
2. Tap test X and Y with impact hammer + accelerometer (MetalMAX TXF, CutPro MALTF, or Simcenter Testlab Impact Testing).
3. Check coherence (> 0.9 near the mode), average 3–5 hits.
4. Enter FRF, tool (z, Ø), material coefficients (K_t, K_r), radial engagement.
5. Software draws stability lobes: a_lim vs n.
6. Choose spindle speed in a lobe pocket below the spindle power limit; put n and a_p into the CAM tool library.
7. Test cut; listen / measure sound (MetalMAX / CutPro "harmonizer" style audio tools suggest speed).

**Example (example values)**
End mill z = 4, k = 20 N/µm (20 000 N/mm), ζ = 0.03, f_n = 800 Hz, K_t = 1100 N/mm², slotting N* = 2:
a_lim,min = 2·20 000·0.03·1.03 / (1100·2) = **0.56 mm** (stable at any speed).
Lobe pockets near 60·800/4 = **12 000 rpm** (j = 0), **6 000 rpm** (j = 1), **4 000 rpm** (j = 2). Moving from 5 200 to 6 000 rpm lets
a_p rise several times above 0.56 mm in the pocket (read exact value from the lobe chart).

**Modules / licences**
- MetalMAX (Tlusty Manufacturing Labs), CutPro (Manufacturing Automation Laboratories), or Simcenter Testlab Impact Testing
  + own lobe script (MATLAB / Python, free). Hardware: impact hammer, accelerometer, 2-channel DAQ.

**Watch out**
- FRF measured with a different stick-out or holder. Spindle dynamics change with speed / temperature (high-speed spindles).
- Workpiece / fixture mode can be the weak one – tap the part too.

**Check of result**
- Test cut at chosen speed: no chatter marks, sound spectrum shows no peak near f_n; a_p predicted vs found within **± 20 %**.

### C47 – Heat treatment simulation (DEFORM-HT / SYSWELD / Simufact) → residual stress → fatigue
**Type:** file (one-way mapping) · **Direction:** heat-treatment simulation → FEA fatigue · **Data:** hardness profile (HV vs depth mm),
phases (% martensite), residual stress (MPa), distortion (mm)

**Why / when to use**
- Crankshaft pin fillets are often **induction hardened** (or rolled). This creates compressive residual stress that raises fatigue
  life. Simulation gives hardness depth + residual stress; FEA fatigue uses them. Also predicts distortion (grinding stock).
- Not needed if the crankshaft is only QT (quenched and tempered) without surface treatment.

**How it works**
- Coupled electromagnetic (induction) + thermal + phase transformation + mechanical simulation.
- Goodman with residual stress as mean stress: **1/n = σ_a/σ_e + (σ_m + σ_res)/R_m**. Compressive σ_res (negative) helps – but use
  only the stable part (some relaxes in service) and be conservative.

**Step by step**
1. Geometry of crankshaft + coil, frequency (kHz), power (kW), heating time (s), quench.
2. Material data (42CrMo4) incl. CCT/TTT diagrams (from tool database).
3. Simulate → hardness depth, residual stress, distortion.
4. Map residual stress to the fatigue FEA mesh (or enter a stress-vs-depth curve at the fillet).
5. Fatigue check with Goodman / Haigh / SWT (nCode / fe-safe support residual stress input).
6. Verify with a cut-up sample (hardness profile) and X-ray diffraction residual stress measurement.

**Example (example values)**
Pin fillet, 42CrMo4 QT: R_m = 1000 MPa, local σ_e = 300 MPa, σ_a = 150 MPa, σ_m = 50 MPa.
- No residual stress: n = 1 / (150/300 + 50/1000) = **1.82**.
- Simulated σ_res = −400 MPa, use 50 % stable = −200 MPa → σ_m,eff = −150 MPa. Conservative: set σ_m,eff = 0 → n = σ_e/σ_a = **2.00**.
  Linear Goodman with negative mean gives n = 2.86 (not conservative – do not use without tests).

**Modules / licences**
- DEFORM-HT (Scientific Forming Technologies), ESI SYSWELD (heat treatment), Simufact Forming heat-treatment module; Flux / COMSOL for the
  induction electromagnetics. Fatigue: nCode DesignLife or fe-safe.

**Watch out**
- Material phase data missing / generic. Grinding after hardening removes part of the compressive layer.
- Taking full compressive residual stress as benefit.

**Check of result**
- Hardness depth (e.g. 2.5 mm at 50 HRC) within **± 0.3 mm** of simulation; XRD residual stress within **± 100 MPa**.

## Part H – Control ⇄ PLC, real time, virtual commissioning

### C48 – Simulink PLC Coder → TIA Portal / CODESYS / TwinCAT (ST code)
**Type:** model export (code generation) · **Direction:** Simulink → PLC · **Data:** IEC 61131-3 Structured Text (function blocks),
signal I/O (REAL, BOOL, INT), sample time Ts (s)

**Why / when to use**
- Controller (PID, state machine, filter) designed and tested in Simulink → generated ST code goes directly into the PLC project.
  No hand re-typing errors. Good for test-bench pressure control, hydraulic press, temperature control.
- Not for simple interlocks / sequences – write those directly in the PLC (LAD / GRAPH).

**How it works**
- A Simulink **subsystem** (atomic, discrete, fixed step) becomes one function block. Generated code is called in a cyclic interrupt
  OB with the **same period** as the model Ts.
- Discrete PI: u_k = u_(k-1) + K_p·(e_k − e_(k-1)) + K_p·(T_s/T_i)·e_k.

**Step by step**
1. Model controller in a subsystem, fixed-step discrete solver, Ts = PLC cycle (e.g. 0.1 s). Make it atomic.
2. Right-click subsystem → **PLC Code → Generate Code for Subsystem** (or `plcgeneratecode`); set target IDE (e.g. Siemens TIA Portal).
3. Output: `.scl` / `.xml` file for the chosen IDE.
4. TIA Portal: External source files → add → generate blocks from source.
5. Call the FB in a cyclic interrupt OB (e.g. OB30–OB38) with time = Ts; map I/O.
6. Test: generate a test bench (PLC Coder option) and run in PLCSIM; compare outputs with Simulink.

**Example (example values)**
Compressor test-bench pressure PI: K_p = 2, T_i = 4 s, T_s = 0.1 s → integral gain per step = K_p·T_s/T_i = 2·0.1/4 = **0.05**.
Generated FB called in OB35 at 100 ms. Step response in PLCSIM matches Simulink within 1 % of setpoint.

**Modules / licences**
- MATLAB + Simulink + **Simulink PLC Coder** (+ Stateflow if state charts) – MathWorks.
- TIA Portal STEP 7 Professional (Siemens) / CODESYS (free IDE) / TwinCAT 3 XAE (free engineering).

**Watch out**
- OB cycle ≠ model Ts → wrong integral / derivative gains. Continuous blocks or variable-step solvers not supported.
- Data types (double vs REAL) – set single precision where the PLC uses REAL.
- Safety functions must not be done this way (use certified F-blocks).

**Check of result**
- PLC vs Simulink output for the same input sequence: max difference **< 0.5 %** (rounding only).

### C49 – Simulink ⇄ PLCSIM Advanced (software-in-the-loop virtual commissioning)
**Type:** co-simulation (SIL) · **Direction:** two-way · **Data:** PLC inputs (sensor BOOL / INT / REAL), PLC outputs (valves, drive commands),
virtual time synchronisation

**Why / when to use**
- Test the **real PLC program** (TIA Portal) against a Simulink plant model (conveyor, hydraulic cylinder, AS/RS crane) before the
  machine exists. Finds sequence errors, timeouts, interlock gaps.
- Not needed if NX MCD or SIMIT is already the plant model (C50).

**How it works**
- PLCSIM Advanced runs a virtual S7-1500 on the PC and has an API (Simulation Runtime). A Simulink S-function / block set
  reads PLC outputs and writes PLC inputs each step. Synchronous mode ties virtual PLC time to Simulink time.
- Sensor position error from exchange period: **Δx = v · Δt_exchange**.

**Step by step**
1. TIA Portal: PLC project with S7-1500 CPU, enable "support simulation" in the project properties; download to a PLCSIM Advanced instance.
2. Simulink: plant model, fixed step (e.g. 1 ms).
3. Connect: PLCSIM Advanced coupling block / S-function (MathWorks or Siemens example, or OPC UA client in Simulink via Industrial
   Communication Toolbox) – exact block set varies by version, see maker help.
4. Map tags: PLC I/O addresses ⇄ Simulink signals.
5. Choose synchronous (virtual time) mode for repeatable tests; free-run for "real-time" feel.
6. Run test cases: normal cycle, sensor failure, E-stop, timeouts.

**Example (example values)**
Pallet conveyor 0.5 m/s. Exchange 10 ms → sensor edge error 0.5·0.01 = **5 mm**; at 1 ms → **0.5 mm**. Stop position tolerance ± 5 mm
→ use 1 ms exchange (or synchronous mode).

**Modules / licences**
- TIA Portal STEP 7 Professional + **S7-PLCSIM Advanced** (Siemens).
- MATLAB + Simulink (+ Simscape for physics) + coupling: Industrial Communication Toolbox (OPC UA) or Siemens/MathWorks PLCSIM
  Advanced interface (check current availability with MathWorks / Siemens).

**Watch out**
- OPC UA free-run timing jitter (10–100 ms) → unrealistic for fast signals; use synchronous API.
- Failsafe (F) program behaviour in simulation is not a safety validation.

**Check of result**
- Cycle time in SIL within **± 5 %** of later real machine; all test cases pass with documented results.

### C50 – NX MCD ⇄ PLCSIM Advanced / SIMIT
**Type:** co-simulation (SIL virtual commissioning) · **Direction:** two-way · **Data:** signals (BOOL, INT, REAL) – sensors, actuator
commands, positions (mm, °)

**Why / when to use**
- NX Mechatronics Concept Designer gives a 3D machine with physics (gravity, collisions, conveyors, sensors). Connected to the
  virtual PLC, you see the real PLC program move the 3D machine (APC, rotary table, robot cell, transfer line).
- SIMIT adds behaviour models (drives, valves, sensors with faults). Not needed for pure logic tests.

**How it works**
- MCD signals are mapped to PLCSIM Advanced (shared memory / API) or via SIMIT coupling, or OPC UA.
- Physics engine step (e.g. 10 ms) and PLC cycle run synchronously or in real time.

**Step by step**
1. NX CAD of the machine → MCD: define rigid bodies, joints, position / speed controls, collision bodies, sensors.
2. Create signals (inputs / outputs) in MCD **Signal Adapter**.
3. External signal configuration → choose PLCSIM Advanced (or SIMIT / OPC UA) → select instance.
4. Signal mapping: MCD signals ⇄ PLC tags.
5. Start PLCSIM Advanced with the PLC program, then play MCD.
6. Run sequences; record cycle time; inject faults (sensor stuck) in SIMIT.

**Example (example values)**
APC: rotate 180° at 30 °/s = 6 s, lift 1.5 s, lower 1.5 s → **9 s** total vs 10 s requirement → OK with 1 s margin. MCD found the pallet
clamps opened 0.2 s before lift was complete (PLC step condition missing) – fixed before build.

**Modules / licences**
- Siemens NX + **NX Mechatronics Concept Designer**; S7-PLCSIM Advanced; optional **SIMIT** (Siemens) for behaviour models.

**Watch out**
- Collision bodies too detailed → slow physics. Signal names / types mismatch (INT vs REAL).
- Real drive dynamics missing (MCD position control is ideal) – add SIMIT drive models.

**Check of result**
- Virtual cycle time vs FAT time **± 10 %**; zero PLC sequence changes needed at SAT (target).

### C51 – Tecnomatix Process Simulate ⇄ PLC (robot cell commissioning)
**Type:** co-simulation (SIL / HIL) · **Direction:** two-way · **Data:** robot programs, I/O signals, cycle times (s), zones / interlocks

**Why / when to use**
- Robot cells (machine loading, assembly): robot paths, reach, collisions, cycle time, PLC handshakes, safety zones all in one model.
  Can run with PLCSIM Advanced (SIL) or the real PLC (HIL).
- Overkill for one robot with simple pick-and-place (use RobotStudio / ROBOGUIDE, C52).

**How it works**
- Robots move with **RCS** (realistic robot simulation – maker controller software modules) for accurate time; signals connect via
  PLCSIM Advanced or OPC UA.

**Step by step**
1. Import cell CAD (JT), robots from library, grippers, fixtures.
2. Teach paths, add signals (gripper close, part present, machine door open).
3. Virtual commissioning mode → connect PLC (PLCSIM Advanced / OPC UA).
4. Run in event-based or time-based mode; check collisions and interlocks.
5. Download robot programs (OLP) to the controller with the maker's post.

**Example (example values)**
HMC loading cell: robot path 4.2 s + gripper 2 × 0.3 s + 4 handshakes × 0.15 s = 4.2 + 0.6 + 0.6 = **5.4 s** robot share per load.
HMC cycle 240 s → robot 2.3 % busy per machine → one robot can serve 2–3 HMCs (check AGV/pallet logistics, guide 02).

**Modules / licences**
- Siemens Tecnomatix **Process Simulate** (Robotics + Virtual Commissioning); **RCS modules** from robot makers (ABB, FANUC, KUKA…);
  S7-PLCSIM Advanced.

**Watch out**
- Without RCS cycle times can be wrong by 10–20 %. Cable / dress pack collisions not modelled.

**Check of result**
- Real robot cycle within **± 5 %** (with RCS); no collision at first real run.

### C52 – ABB RobotStudio (virtual controller) ⇄ PLCSIM Advanced / OPC UA
**Type:** co-simulation (SIL) · **Direction:** two-way · **Data:** robot I/O (DI/DO, group signals), RAPID program, positions, cycle time

**Why / when to use**
- RobotStudio runs the **real ABB controller software** (Virtual Controller) → exact cycle times and real RAPID code. Connected to the
  virtual PLC, the whole handshake is tested. Same idea: **FANUC ROBOGUIDE** (virtual R-30iB), **KUKA.Sim** (with KUKA.OfficeLite for exact time).
- Not needed for robots that only run fixed programs with no PLC handshake.

**How it works**
- Virtual controller I/O is mapped to PLC tags through RobotStudio's signal connection to PLCSIM Advanced (add-in / built-in, version
  dependent) or OPC UA; fieldbus mapping (PROFINET) is mirrored.

**Step by step**
1. RobotStudio: create station, robot + virtual controller (same RobotWare version as real).
2. Import cell CAD, tools, work objects; write RAPID.
3. Configure I/O (same signal names as the real PROFINET configuration).
4. Connect to PLCSIM Advanced (station logic / connection add-in) or OPC UA server.
5. Run with the TIA program; test start, stop, faults, E-stop recovery.
6. Transfer the tested program to the real controller.

**Example (example values)**
Robot loading HMC: RobotStudio path total **18.4 s** (load + unload + blow-off). 16 DI / 16 DO over PROFINET. One handshake bug
(robot waited for "door open" that PLC set only after spindle stop + 2 s) cost 2 s per cycle → fixed: door opens during spindle run-down.

**Modules / licences**
- ABB **RobotStudio** (Premium for full simulation; basic free features), RobotWare matching; S7-PLCSIM Advanced.
- FANUC **ROBOGUIDE** (HandlingPRO etc.); KUKA.Sim + KUKA.OfficeLite.

**Watch out**
- Different RobotWare / controller version than the real robot. Payload data wrong → wrong cycle times and wear.

**Check of result**
- Real cycle **± 2–3 %** of virtual controller time.

### C53 – Tecnomatix Plant Simulation ⇄ PLC / OPC UA / MES-ERP data
**Type:** co-simulation / data link · **Direction:** two-way · **Data:** orders, routings (ERP / MES tables), part arrivals, machine states,
PLC signals (emulation mode)

**Why / when to use**
- Discrete-event model of the whole line (HMC cells, AGV, AS/RS, assembly) for throughput, bottlenecks, buffers. With PLC / OPC UA
  link it becomes an **emulation** for MES and material flow control testing. Same idea as this twin's flow model (guides 01–03).

**How it works**
- Events (arrive, start, finish, fail) on a time line. Throughput of parallel machines: **TH = m · 3600 / t_c · A**.
  Little's law: **WIP = TH · lead time**.
- Interfaces: OPC UA client, ODBC / SQL (MES / ERP tables), Excel / XML import, socket, PLCSIM Advanced (emulation).

**Step by step**
1. Build layout from CAD (2D/3D), objects: source, machines, buffers, transporters, workers.
2. Import data: cycle times, MTBF / MTTR, shift plan, orders (from ERP/MES export).
3. Validate against current / expected data.
4. Experiments (Experiment Manager): buffer sizes, number of AGVs, sequencing rules.
5. Emulation: connect OPC UA / PLC signals → model reacts to the real control or MES.

**Example (example values)**
3 HMCs, crankcase cycle 240 s: TH = 3·3600/240 = **45 parts/h**; availability 85 % → **38.25 parts/h**. Lead time 1.5 h → WIP = 38.25·1.5
≈ **57 parts** in the system.

**Modules / licences**
- Siemens Tecnomatix **Plant Simulation** (Professional for interfaces like OPC UA / ODBC / socket); optional PLCSIM Advanced.
- Alternatives: FlexSim, AnyLogic, Visual Components (C56).

**Watch out**
- Random failures not modelled → over-optimistic throughput. Too short runs (no warm-up, few replications).

**Check of result**
- Model vs real (or this twin) throughput within **± 5 %** for the same inputs; run ≥ 5 replications.

### C54 – Simulink → Beckhoff TwinCAT 3 (TE1400 Target for Simulink)
**Type:** model export (code generation, real time) · **Direction:** Simulink → TwinCAT runtime · **Data:** TcCOM module with inputs / outputs
/ parameters, task cycle (e.g. 1 ms)

**Why / when to use**
- Fast controllers (hydraulic press force, servo, test bench) run as compiled C++ module in the Beckhoff IPC real-time task. Parameters
  stay tunable online. Good for test benches (compressor run-in, guide 20) built on Beckhoff.
- Not for Siemens S7 lines (use C48).

**How it works**
- Simulink Coder generates C code → TE1400 packs it as a **TcCOM** object → instance in a TwinCAT task. Task cycle must equal model step.

**Step by step**
1. Install TwinCAT 3 XAE + TE1400 (MATLAB integration).
2. Simulink: fixed-step solver, step = task cycle (1 ms); configuration → system target file **TwinCAT.tlc**.
3. Build → TcCOM module created.
4. TwinCAT XAE: System → TcCOM Objects → add module instance; assign to a task (1 ms).
5. Link module I/O to EtherCAT terminals (analog in/out, encoders).
6. Activate configuration; monitor and tune parameters online (External Mode-like access).

**Example (example values)**
Press force loop: step 1 ms → **1000 Hz** loop rate; module execution time 80 µs = 8 % of the cycle → OK (keep < 50–70 % total task load).

**Modules / licences**
- MATLAB + Simulink + **Simulink Coder** (+ Embedded Coder optional) – MathWorks; Beckhoff **TwinCAT 3 TE1400** (engineering) +
  **TC1320/TC1220-class runtime licence** for C++/module execution (check exact runtime licence with Beckhoff).

**Watch out**
- Model step ≠ task cycle. Compiler version mismatch (Visual Studio / TwinCAT). Unbounded loops in the model.

**Check of result**
- Same input in Simulink and TwinCAT: outputs equal within numerical rounding; task load < 70 %.

### C55 – Simulink ⇄ Speedgoat (Simulink Real-Time) / dSPACE (HIL test of a real controller)
**Type:** HIL (real-time hardware-in-the-loop) · **Direction:** two-way, electrical signals · **Data:** analog ± 10 V / 4–20 mA, digital I/O,
encoders, EtherCAT / PROFINET / CAN

**Why / when to use**
- Test a **real** controller (PLC, servo drive, motor inverter, safety PLC logic) against a real-time plant model that can create
  faults safely (over-pressure, broken sensor). Used for compressor test-bench controllers, hydraulic controls.
- Not needed when SIL (C49) is enough and no fast electrical I/O timing matters.

**How it works**
- Plant model compiled and run on a real-time target at fixed step (e.g. 100 µs). Real-time margin: **load = TET / step** (task execution
  time / step) – keep < 70–80 %.

**Step by step**
1. Plant model in Simulink (Simscape allowed with fixed-step local solvers).
2. Add I/O driver blocks of the target hardware (Speedgoat I/O blocks / dSPACE RTI).
3. Build and download to the target (Simulink Real-Time / dSPACE ConfigurationDesk).
4. Wire real controller to target I/O (check voltage levels, isolation).
5. Run tests (automated with Simulink Test or dSPACE AutomationDesk); log results.

**Example (example values)**
Plant step 100 µs, TET 62 µs → load = 62/100 = **62 %** → OK. Fault test: pressure sensor wire break (4–20 mA → 0 mA) → controller must stop
the motor within 100 ms – measured 35 ms → pass.

**Modules / licences**
- MATLAB + Simulink + **Simulink Real-Time** + Simulink Coder + **Speedgoat target hardware** (+ I/O modules); optional Simulink Test.
- Or **dSPACE** SCALEXIO / MicroLabBox + ConfigurationDesk / ControlDesk / RTI.

**Watch out**
- Overruns (TET > step) → invalid test. Electrical damage from wrong wiring (24 V into ± 10 V input).

**Check of result**
- No overruns in a 1-hour run; open-loop plant response vs offline Simulink within **± 1 %**.

### C56 – Visual Components / RoboDK / FlexSim emulation ⇄ PLC (OPC UA, Modbus)
**Type:** co-simulation (emulation, SIL) · **Direction:** two-way · **Data:** BOOL / INT / REAL signals via OPC UA or Modbus TCP registers

**Why / when to use**
- Lower-cost 3D line / robot simulation with PLC connection – conveyors, AGV, robots, AS/RS – for layout and logic testing.
  RoboDK: cheap offline robot programming for many robot brands. FlexSim: discrete-event with 3D + emulation.

**How it works**
- Built-in **connectivity** (OPC UA client, Modbus TCP client, Siemens S7 / PLCSIM Advanced in some versions) maps component
  properties (sensor true, conveyor speed) to PLC tags. Exchange cycle typically 10–100 ms.

**Step by step**
1. Build layout from catalogue (conveyors, robots, sensors) + import CAD.
2. Connectivity → add server (OPC UA endpoint or Modbus TCP IP/port of PLC / PLCSIM Advanced).
3. Map variables (simulation → server, server → simulation).
4. Run PLC program; observe; test faults.
5. Export robot programs (RoboDK post for the robot brand).

**Example (example values)**
Modbus poll every 50 ms; AGV docking at 0.5 m/s → position uncertainty 0.5·0.05 = **25 mm** → OK for logic test, not for docking
precision (use PLC-side encoder logic, guide 11).

**Modules / licences**
- Visual Components Premium / Professional (connectivity included in higher editions); **RoboDK** (Professional licence, robot posts
  included); **FlexSim** (Enterprise for emulation module). PLC: S7-PLCSIM Advanced or real PLC with OPC UA server.

**Watch out**
- Polling jitter → sporadic race conditions not present in reality (or vice versa). Modbus register address offsets (0- vs 1-based, guide 43).

**Check of result**
- All sequence steps reached in order; signal round-trip time measured < 2 × poll period.

## Part I – Optimisation, test data, glue

### C57 – Ansys optiSLang ⇄ Ansys / Adams / Simulink / Python
**Type:** platform (process integration + optimisation) · **Direction:** optiSLang drives solvers · **Data:** input parameters (mm, kg, rpm…),
output responses (MPa, Hz, kg, s), DOE tables, metamodel (MOP)

**Why / when to use**
- Find which parameters matter (sensitivity), build a fast **metamodel (MOP)**, then optimise – using any solver (Ansys Workbench native,
  Adams, Simulink, Python, Excel, any batch tool via text-file I/O).
- Not needed for a single what-if; use parameter sweep in the solver.

**How it works**
- DOE with Advanced Latin Hypercube sampling → solver runs → MOP (best metamodel chosen automatically) with **CoP** (coefficient of prognosis,
  0–1; > 0.8 good). Minimum samples for a quadratic model: **(n+1)(n+2)/2**.

**Step by step**
1. Parametrise model (Workbench parameters, or input text file with markers for other solvers).
2. optiSLang: Solver wizard → choose integration (Ansys Workbench, Python, text-file, Simulink / FMU, Adams – integrations available vary by version).
3. Define parameter ranges and responses.
4. Sensitivity wizard → DOE (e.g. 50 designs), run (parallel).
5. MOP → check CoP of each response.
6. Optimisation wizard (on MOP, then validate best design with real solver).
7. Robustness check (scatter of tolerances).

**Example (example values)**
Crankshaft counterweight: 5 parameters (radius, width, angle, hole Ø, fillet r). Quadratic minimum = (5+1)(5+2)/2 = **21** runs; use **50**.
6 min per run → 50·6/60 = **5 h** on one core, **1.25 h** on 4 parallel jobs. Result: CoP 0.92 for unbalance, 0.85 for fillet stress.

**Modules / licences**
- **Ansys optiSLang** (Ansys / Synopsys) + solver licences for each parallel run (e.g. Ansys Mechanical HPC, Adams, MATLAB).

**Watch out**
- Each parallel design needs its own solver licence. Failed designs (mesh errors) bias the MOP – check failures.
- Optimum on metamodel not validated with real solver.

**Check of result**
- Best design re-run in the real solver: responses within **± 5 %** of MOP prediction; CoP > 0.8.

### C58 – HEEDS / Isight / modeFRONTIER driving several tools
**Type:** platform (process automation + multi-objective optimisation) · **Direction:** optimiser drives chain · **Data:** parameters,
objectives, constraints, files between tools

**Why / when to use**
- Chains of several tools (CAD → FEA → CFD → cost script) optimised together with many objectives (mass, stress, efficiency, cost) →
  **Pareto front**. HEEDS (Siemens, SHERPA hybrid search), Isight (Dassault SIMULIA), modeFRONTIER (ESTECO).

**How it works**
- Workflow of components (CAD regenerate, mesh, solve, post, script). Multi-objective search keeps non-dominated designs: no design is better
  in **all** objectives.

**Step by step**
1. Make each tool runnable in batch (journal / script, parametrised input file).
2. Add components in the workflow (native portals for NX, Creo, SOLIDWORKS, Abaqus, Ansys, STAR-CCM+, MATLAB, Excel, Python).
3. Tag inputs and outputs (file parsing).
4. Define objectives / constraints; choose algorithm (SHERPA / NSGA-II / pointer).
5. Run (parallel, licence-limited); review Pareto chart; pick design.

**Example (example values)**
Valve plate: thickness 3–6 mm, port Ø 8–12 mm. Objectives: min mass, min pressure drop (CFD), stress ≤ 120 MPa (FEA). 120 evaluations
(60 min each with 4 parallel → 30 h). Pareto shows 4.2 mm plate with 10.5 mm ports as a good compromise (example).

**Modules / licences**
- Siemens **HEEDS MDO**; Dassault **Isight** (SIMULIA); ESTECO **modeFRONTIER** – plus each solver licence.

**Watch out**
- One tool fails silently → bad design reported as good. Too many parameters for the evaluation budget.

**Check of result**
- Re-run 2–3 Pareto designs manually; results repeat **± 1 %** (deterministic solvers).

### C59 – MATLAB / Python ⇄ Abaqus / Ansys / Adams by scripting
**Type:** scripting / batch (glue) · **Direction:** script controls solver, reads results · **Data:** parameters, result tables (CSV, ODB, RST)

**Why / when to use**
- Free, flexible automation: parameter loops, post-processing, report generation, connecting to your own models or the Python twin.
  Cheapest way to couple anything.

**How it works / interfaces (confident names)**

| Tool | Interface | Start |
|---|---|---|
| Ansys MAPDL | **PyMAPDL** (PyAnsys, free) | `from ansys.mapdl.core import launch_mapdl; mapdl = launch_mapdl()` |
| Ansys Mechanical / Fluent | PyMechanical, PyFluent (PyAnsys, free) | see PyAnsys docs |
| Abaqus | built-in Python (abaqus/CAE kernel) | `abaqus cae noGUI=run.py`, `abaqus python post.py` |
| Adams | Adams View Python interface / `.cmd` batch | see Adams help (Python API varies by version) |
| MATLAB from Python | **MATLAB Engine for Python** | `import matlab.engine; eng = matlab.engine.start_matlab()` |
| Python from MATLAB | `pyrun`, `py.module.function` | MATLAB R2021b+ |

**Step by step**
1. Make one run work manually; save the journal / input file.
2. Replace numbers with variables in the script.
3. Loop over cases; run solver in batch; check exit status.
4. Read results (MAPDL `post1`, Abaqus `odbAccess`, CSV export).
5. Write table / plots; push summary to the twin (C62) or report.

**Example (example values)**
Crankshaft stress map: 10 speeds (800–1450 rpm) × 3 pressure levels = **30 runs** overnight with PyMAPDL; script writes a CSV of max
fillet stress vs speed and pressure → one Goodman check per row.

**Modules / licences**
- Python + PyAnsys (free) + solver licences (Ansys, Abaqus, Adams); MATLAB for the Engine (MathWorks). Offline: install Python packages from
  wheel files (offline rule).

**Watch out**
- Licence checkout per run (queue). Hard-coded paths. Different unit systems between scripts and model.

**Check of result**
- One scripted case equals the manual GUI case exactly (same mesh, same result).

### C60 – COMSOL LiveLink for MATLAB
**Type:** scripting / co-control · **Direction:** MATLAB ⇄ COMSOL model · **Data:** parameters, mesh / study control, results (fields, globals)

**Why / when to use**
- Control a COMSOL multiphysics model from MATLAB: sweeps, optimisation (MATLAB Optimization Toolbox), using results in Simulink /
  control design. Example: spindle thermal model, motor heating, cooling-fin heat transfer.

**How it works**
- COMSOL server + MATLAB client; model is a Java object in MATLAB. Key functions: `mphload`, `model.param.set`, `model.study('std1').run`,
  `mphglobal`, `mphinterp`, `mphsave`.

**Step by step**
1. Build and test the model in COMSOL Desktop; define parameters and a global evaluation (e.g. max temperature).
2. Start "COMSOL with MATLAB" (LiveLink starts the server).
3. `model = mphload('spindle.mph');`
4. `model.param.set('rpm','6000[rpm]'); model.study('std1').run;`
5. `T = mphglobal(model,'maxop1(T)');` – loop, store, plot.
6. Optional: export as COMSOL app / reduced model for Simulink (LiveLink for Simulink).

**Example (example values)**
Cooling fins: sweep fin pitch 6–12 mm in 7 steps; MATLAB picks pitch where cylinder wall temperature ≤ 160 °C with lowest mass; each run
2 min → 14 min total.

**Modules / licences**
- COMSOL Multiphysics + **LiveLink for MATLAB** (+ Heat Transfer Module); MATLAB (+ Optimization Toolbox optional). LiveLink for Simulink is separate.

**Watch out**
- Parameters need units in the string. Server / client version mismatch. Large field exports slow – use globals.

**Check of result**
- MATLAB-driven run equals COMSOL Desktop result for the same parameters.

### C61 – Test data ⇄ FEA model updating (Simcenter Testlab → Simcenter 3D correlation / FEMtools)
**Type:** file + correlation loop · **Direction:** test → FEA (update) · **Data:** measured mode shapes and frequencies (Hz), FRFs, FE modes,
updated parameters (E, joint stiffness N/mm)

**Why / when to use**
- Make the FEA model match the real structure (base frame, crankcase on mounts, spindle) → trustworthy vibration and fatigue predictions.
  Required for a credible **digital twin** of structural behaviour (and for a PhD-level validation, guide 51).

**How it works**
- Pair modes; compare frequencies and shapes. **MAC = |φ_aᵀ φ_x|² / ((φ_aᵀ φ_a)(φ_xᵀ φ_x))** – 1 = same shape, < 0.3 = different.
  Frequency error **(f_FE − f_test)/f_test**. Update parameters; since f ∝ √k, a stiffness factor of (f_target/f_FE)² moves a single mode.

**Step by step**
1. FE modal analysis; choose test points (sensor positions) and excitation.
2. Modal test (impact hammer or shaker) in Simcenter Testlab → modal parameters (PolyMAX).
3. Import test geometry + modes to Simcenter 3D / FEMtools; align coordinates.
4. Correlation: MAC matrix, frequency table.
5. Choose update parameters (joint stiffness, E of cast iron, mount stiffness) with sensitivity.
6. Update (automatic in FEMtools / Simcenter 3D model update) → re-correlate.
7. Freeze model; document.

**Example (example values)**
Base frame: FE 48.2 / 96.5 / 141.0 Hz vs test 45.1 / 93.8 / 150.2 Hz → errors **+6.9 %, +2.9 %, −6.1 %**.
Mode 1 shape vectors (4 points) FE [0.10, 0.45, 0.80, 1.00] vs test [0.12, 0.40, 0.85, 1.00] → **MAC = 0.997** (same shape).
Mode 1 controlled by mount stiffness: factor (45.1/48.2)² = **0.876** → reduce mount stiffness ≈ 12 %; mode 3 needs stiffer weld joints.

**Modules / licences**
- Siemens **Simcenter Testlab** (Impact Testing + Modal Analysis) + **Simcenter 3D** (correlation / model update) or **FEMtools** (Dynamic
  Design Solutions). Free option: own MAC script (Python / MATLAB) + manual updating.

**Watch out**
- Updating physically meaningless parameters to fit. Sensor mass not included. Mode pairs swapped (use MAC, not order).

**Check of result**
- After update: frequency errors **< 3–5 %**, diagonal MAC **> 0.9**, off-diagonal **< 0.2**.

### C62 – Simulation tools ⇄ this offline Python twin
**Type:** data link / FMU · **Direction:** two-way · **Data:** values (REAL, INT), states, JSON objects, Modbus registers (16-bit)

**Why / when to use**
- Bring simulation results (thermal growth, wear, predicted cycle time) into the twin, or let the twin drive a simulation. Stays offline.

**How it works – options**

| Bridge | How | Guide |
|---|---|---|
| HTTP / JSON | Tool script (Python, MATLAB `webwrite`) sends JSON to the twin API; or reads twin state | guide 07 (API + addresses) |
| Modbus TCP | Simulink (Industrial Communication Toolbox) or Python writes holding registers; scaling as integer | guide 43 (register map) |
| OPC UA | Simulink / NX MCD / Plant Simulation client ⇄ OPC UA server in the line | guide 07 |
| FMU in Python | **FMPy** `simulate_fmu('spindle.fmu', ...)` runs the model inside a Python process next to the twin | install FMPy from offline wheel |
| MATLAB Engine | Python twin calls MATLAB functions | C59 |

**Step by step**
1. Define the signal list (name, unit, scale, direction, update rate) – like a PLC I/O list.
2. Choose bridge (HTTP for slow data ≥ 1 s, Modbus for PLC-style values, FMU for models inside the twin).
3. Implement with the existing endpoints / register map (guides 07, 43) – do not invent new address ranges without updating guide 15.
4. Test with logged values; add range checks (twin rejects out-of-range).

**Example (example values)**
Spindle temperature 36.7 °C sent as Modbus INT16 with scale 0.1 °C → register value **367**; max representable 0x7FFF/10 = **3276.7 °C** (OK).
Thermal FMU (from Ansys Twin Builder, C37-type ROM) run by FMPy every 10 s gives Z-growth for the twin's spindle page.

**Modules / licences**
- Twin: stdlib Python (free). FMPy (free, open source – not stdlib). Simulink side: Industrial Communication Toolbox (Modbus / OPC UA).
  OPC UA server: in PLC (S7-1500 OPC UA licence) or a separate server.

**Watch out**
- Scaling / signed vs unsigned registers. Clocks not synchronised (timestamps). FMU compiled for a different OS / bitness.

**Check of result**
- Value read back from the twin equals the sent value; end-to-end delay measured and documented (e.g. < 1 s for HTTP).

### C63 – MpCCI CouplingEnvironment (vendor-neutral co-simulation)
**Type:** platform (co-simulation server) · **Direction:** two-way between any supported codes · **Data:** surface / volume quantities (pressure Pa,
force N, temperature K, heat flux W/m², displacement mm), scalar signals (FMI)

**Why / when to use**
- Couple codes from **different makers** that have no direct link: e.g. Abaqus (structure) ⇄ Fluent or STAR-CCM+ (flow), OpenFOAM ⇄ Abaqus,
  Simpack / Adams ⇄ FEA, FMUs. Fraunhofer SCAI product. Use when the own-vendor coupling (Ansys System Coupling, Abaqus CSE) does not cover
  your pair.

**How it works**
- MpCCI server maps meshes (non-matching grids) and exchanges quantities each coupling step; explicit or implicit (iterated) schemes;
  under-relaxation for stability. Coupling step from the fastest dynamics: **Δt_c ≤ 1/(k·f_max)**, k = 10–20.

**Step by step**
1. Prepare each model alone (same units, same coordinates), define coupling surfaces (named sets).
2. MpCCI GUI: select codes and versions, read the models, select coupling regions and quantities.
3. Choose algorithm (explicit / implicit, Gauss-Seidel / Jacobi), coupling step, relaxation.
4. Run (MpCCI starts all codes); monitor exchanged quantities.
5. Post-process each code's results; MpCCI visualiser for coupling data.

**Example (example values)**
Discharge valve reed: Abaqus (reed bending) ⇄ Fluent (gas flow). Rotational order up to 12 × 24.2 Hz = 290 Hz → Δt_c ≤ 1/(20·290)
= **0.17 ms**. Air/steel density ratio small → explicit coupling usually stable; reed lift predicted 1.8 mm vs high-speed camera 1.9 mm (example).

**Modules / licences**
- **MpCCI CouplingEnvironment** (Fraunhofer SCAI) + licences of each coupled code (e.g. Abaqus, Fluent / STAR-CCM+); OpenFOAM free.

**Watch out**
- Supported code versions are listed per MpCCI release – match exactly. Mesh mapping quality at curved surfaces. Long run times.

**Check of result**
- Halve Δt_c: change **< 2 %**; force balance across the interface (fluid force = structural reaction) within **1 %**.

### Part 3 summary table

| Coupling | Type | Main modules | Set-up effort ★ (more = harder) | Value for compressor factory ★ |
|---|---|---|---|---|
| C41 CAD → CAM → VERICUT → CNC | file chain | CAM + post + VERICUT (+ Force) | ★★ | ★★★★★ |
| C42 Casting sim → FEA | file mapping | MAGMASOFT / ProCAST + Ansys / Abaqus + fatigue | ★★★★ | ★★★★ |
| C43 Welding sim → FEA | file mapping | Simufact Welding / SYSWELD / Ansys | ★★★★ | ★★★ |
| C44 AM sim → compensated CAD | model loop | Ansys Additive / Simufact Additive / Netfabb | ★★★ | ★★ |
| C45 Cutting force → deflection FEA | file | AdvantEdge / Production Module / VERICUT Force + FEA | ★★★ | ★★★ |
| C46 Tap test → stability lobes → CAM | measured file | MetalMAX / CutPro / Testlab | ★★ | ★★★★★ |
| C47 Heat-treat sim → fatigue | file mapping | DEFORM-HT / SYSWELD + nCode / fe-safe | ★★★★ | ★★★★ |
| C48 Simulink → PLC code | code generation | Simulink PLC Coder + TIA / CODESYS | ★★ | ★★★★ |
| C49 Simulink ⇄ PLCSIM Advanced | SIL | Simulink + PLCSIM Advanced (+ ICT) | ★★★ | ★★★★ |
| C50 NX MCD ⇄ PLCSIM / SIMIT | SIL | NX MCD + PLCSIM Advanced + SIMIT | ★★★★ | ★★★★★ |
| C51 Process Simulate ⇄ PLC | SIL / HIL | Process Simulate + RCS + PLCSIM Advanced | ★★★★ | ★★★★ |
| C52 RobotStudio / ROBOGUIDE ⇄ PLC | SIL | RobotStudio + PLCSIM Advanced | ★★ | ★★★★ |
| C53 Plant Simulation ⇄ PLC / MES | DES + emulation | Plant Simulation Professional | ★★★ | ★★★★ |
| C54 Simulink → TwinCAT 3 | code generation | Simulink Coder + TE1400 | ★★★ | ★★★ (test benches) |
| C55 Simulink HIL (Speedgoat / dSPACE) | HIL | Simulink Real-Time + Speedgoat / dSPACE | ★★★★ | ★★★ |
| C56 Visual Components / RoboDK / FlexSim ⇄ PLC | SIL | VC / RoboDK / FlexSim + OPC UA / Modbus | ★★ | ★★★ |
| C57 optiSLang ⇄ solvers | platform | optiSLang + solver licences | ★★★ | ★★★★ |
| C58 HEEDS / Isight / modeFRONTIER | platform | HEEDS / Isight / modeFRONTIER | ★★★★ | ★★★ |
| C59 MATLAB / Python scripting | glue | PyAnsys / Abaqus Python / MATLAB Engine (free parts) | ★★ | ★★★★★ |
| C60 COMSOL LiveLink for MATLAB | scripting | COMSOL + LiveLink for MATLAB | ★★ | ★★★ |
| C61 Test ⇄ FEA model updating | correlation loop | Simcenter Testlab + Simcenter 3D / FEMtools | ★★★★ | ★★★★ |
| C62 Tools ⇄ Python twin | data link / FMU | HTTP, Modbus, OPC UA, FMPy (free) | ★★ | ★★★★★ |
| C63 MpCCI | co-simulation platform | MpCCI + coupled codes | ★★★★★ | ★★★ |

---

## Part M – Modules: master list, minimum sets per chain, budget packs

> Product names as sold in 2025–2026. Vendors re-bundle often (e.g. Ansys "Mechanical Pro / Premium / Enterprise",
> MathWorks toolboxes merged, Altair units now under Siemens). Price class per seat per year, rough: **L** < 3 k USD ·
> **M** 3–15 k · **H** 15–40 k · **VH** > 40 k – **estimate, ask for a quote**. "Free" = no licence cost.

### M.1 MathWorks (MATLAB family)

| Module | What it adds | Used in | Price |
|---|---|---|---|
| MATLAB | Base language, scripts, MATLAB Engine for Python | all MATLAB couplings | L |
| Simulink | Block diagrams, time simulation, FMU import block | C1, C2, C10–C15, C31, C33, C36–C39, C48–C55 | L–M |
| Simscape | Physical modelling base (needed by all Simscape products) | C1, C2, C11, C35 | L–M |
| Simscape Multibody | 3D mechanisms, joints, contact | C1, C2, C11, C35 | L–M |
| **Simscape Multibody Link** | CAD export plug-in for SOLIDWORKS / Creo / Inventor | C1, C2 | **Free** add-on |
| Simscape Electrical | Motors, drives, power electronics | C11, C38 | L–M |
| Simscape Fluids | Hydraulics, pneumatics, thermal liquids | C35 | L–M |
| Simscape Driveline | Gears, belts, clutches | C11 | L–M |
| Control System Toolbox / Simulink Control Design | Controller design, linearisation, PID tuning | C10, C11, C14 | L |
| Stateflow | State machines (sequences, modes) | C48, C49 | L |
| Simulink PLC Coder | Structured Text (IEC 61131-3) generation | C48, C54 | M |
| Simulink Coder / Embedded Coder | C code, FMU export, real-time targets | C36, C54, C55 | M |
| Simulink Compiler | Standalone FMU export / deploy without MATLAB | C36, C37 | M |
| Industrial Communication Toolbox | OPC UA, Modbus TCP, MQTT clients/servers | C49, C53, C56, C62 | L |
| Simulink Real-Time | Real-time on Speedgoat hardware | C55 | M (+ hardware) |
| Simulink Desktop Real-Time | Soft real-time on Windows PC | C55 (simple) | L |
| Optimization / Global Optimization Toolbox | Optimisers to drive other tools | C59 | L |
| Simulink Design Optimization | Parameter estimation from test data | C61 | L |
| System Identification Toolbox | Fit fast models (ROM) from data | C37, C61 | L |
| Statistics and Machine Learning / Deep Learning Toolbox | Surrogates, AI ROM | C37, C57 | L |
| Signal Processing Toolbox | FFT, filters for test and sim data | C40, C46, C61 | L |
| Partial Differential Equation Toolbox | Simple FEA inside MATLAB | C59 | L |
| Robotics System Toolbox | Robot kinematics, ROS | C11, C52 | L |

### M.2 Hexagon (MSC Software)

| Module | What it adds | Used in |
|---|---|---|
| Adams View + Adams Solver | Build and solve multibody models | C3, C10, C16–C20, C24, C34 |
| Adams Controls | Plant export to Simulink / co-sim / FMU | C10 |
| Adams Flex | Import flexible bodies (MNF) | C16–C18 |
| Adams ViewFlex | Make flexible bodies inside Adams (built-in FE + reduction) | C17 |
| Adams Durability | RPC / DAC load-history export, modal stress recovery | C19, C20 |
| Adams Machinery | Gears, bearings, belts, chains, cams, motors | C3 |
| Adams Vibration / Adams Insight | Frequency response / DOE | C10, C57 |
| MSC Nastran | Linear FEA, MNF export (MBDEXPORT ADAMS) | C17 |
| Marc | Nonlinear FEA, co-sim with Adams | C18 |
| ESPRIT EDGE (CAM) | Mill-turn CAM, post | C41 |
| Simufact Welding / Additive / Forming | Process simulation | C43, C44, C47 |
| MSC Apex / Patran | Pre-processing | C17 |
| *Licensing note* | Hexagon uses **MSC One tokens** – one token pool for many products; check token count per product | – |

### M.3 Ansys (Synopsys)

| Module | What it adds | Used in | Price |
|---|---|---|---|
| Ansys Mechanical Pro / Premium / **Enterprise** | FEA; Enterprise needed for most advanced nonlinear, MNF/ROM, thermal transient, System Coupling use | C4, C16, C19, C25, C27, C40, C42–C47 | M–H |
| Ansys Fluent | CFD (incl. GPU solver) | C22, C23, C25, C27 | H |
| Ansys CFX | Turbomachinery CFD | C27 | H |
| Ansys Rocky | DEM, couples natively to Fluent + Mechanical | C23 | H |
| System Coupling | FSI / multiphysics co-sim inside Workbench (included with recent Enterprise bundles – confirm) | C25 | incl. / M |
| Ansys Twin Builder | System sim, ROM builder, FMU export, Modelica | C37 | H |
| Ansys Motion | Multibody inside Workbench | C19 (alt.) | M |
| Ansys Maxwell / Motor-CAD | Electromagnetics / fast motor design | C38, C40 | M–H |
| Ansys Sound / Harmonic Acoustics | Acoustic results, sound quality | C40 | M |
| Ansys nCode DesignLife | Fatigue from FEA + load histories | C19, C20, C42, C47 | M |
| Ansys Additive Suite / Additive Print | AM process sim, distortion compensation | C44 | M–H |
| Ansys optiSLang | DOE, sensitivity, robust design, metamodels | C57 | M |
| Ansys SpaceClaim / Discovery | Geometry repair, direct modelling, fast sim | C4 | L–M |
| Ansys Geometry Interfaces | Associative CAD plug-ins (SOLIDWORKS, Creo, NX, Inventor, CATIA) | C4 | L–M |
| Ansys HPC / HPC Pack | More cores per job | all big Ansys jobs | M |
| PyAnsys (PyMAPDL, PyFluent, PyMechanical) | Python scripting | C59 | **Free** (needs licences of the products) |
| Ansys LS-DYNA | Explicit (crash, drop, forming) | C43 (alt.) | M–H |

### M.4 Siemens (Digital Industries Software + Automation)

| Module | What it adds | Used in |
|---|---|---|
| NX (Design) + NX CAM | CAD + CAM, post builder | C2, C9, C41 |
| NX Mechatronics Concept Designer (MCD) | Physics-based machine model, signals for VC | C9, C50 |
| Simcenter 3D (Motion, Structures/Nastran, Thermal, Acoustics) | Multibody, FEA, thermal, acoustics | C15, C17, C40 |
| Simcenter STAR-CCM+ | CFD, built-in DEM, FSI co-sim with Abaqus / Simcenter 3D | C26, C27, C30, C32 |
| Simcenter Amesim | 1D system simulation (hydraulic, thermal, electric), Simulink interface, FMI | C33, C34 |
| Simcenter HEEDS | Design-space exploration / optimisation | C58 |
| Simcenter Testlab (+ hardware SCADAS) | Modal test, tap test, acoustics measurement | C46, C61 |
| Altair (Siemens since 2025): HyperMesh, OptiStruct, MotionSolve, Activate, **EDEM**, Flux, Inspire | Mesh, optimisation, multibody, system, DEM, EM | C7, C14, C22, C24 |
| Tecnomatix Process Simulate (+ Virtual Commissioning option) | Robot / station simulation with PLC signals | C51 |
| Tecnomatix Plant Simulation | Discrete-event line simulation, emulation interfaces (OPC UA, PLCSIM) | C53 |
| TIA Portal: STEP 7 Professional, WinCC | PLC programming, HMI | C8, C48–C53 |
| **S7-PLCSIM Advanced** | Virtual S7-1500 with API, OPC UA, shared memory for VC | C49–C53 |
| SIMIT | Signal / device simulation, VC platform | C50 |
| Teamcenter | PLM / data management | all |

### M.5 Dassault Systèmes

| Module | What it adds | Used in |
|---|---|---|
| SOLIDWORKS Standard / Professional / Premium | CAD; Premium includes Motion + basic Simulation | C1, C6 |
| SOLIDWORKS Simulation Professional / Premium | Fatigue, nonlinear, dynamic | C6 |
| SOLIDWORKS Flow Simulation | CFD inside SOLIDWORKS | C6 |
| SOLIDWORKS Electrical | Electrical schematics (alt. to EPLAN) | C8 |
| Abaqus (Standard / Explicit / CAE) | Nonlinear FEA; substructure for MNF/FBI; Python scripting | C18, C21, C26, C43, C47, C59 |
| SIMULIA Co-Simulation Engine (CSE) | Abaqus ⇄ STAR-CCM+ / Dymola / Simpack / FMU | C26 |
| Simpack | Multibody (drivetrains, rotors), SIMAT co-sim with Simulink, FBI flex bodies | C13, C21 |
| fe-safe | Fatigue (also with Adams loads, residual stress) | C20, C42, C47 |
| Isight / Tosca | Process automation + optimisation / topology | C58 |
| Dymola | Modelica, FMU export | C36 |
| CATIA / DELMIA | CAD / manufacturing simulation | C2, C41 |
| *Licensing note* | Simulia uses **tokens / credits** (SimUnits); one pool for Abaqus, fe-safe, Isight etc. | – |

### M.6 Other vendors and tools

| Tool (vendor) | Modules needed | Used in |
|---|---|---|
| GT-SUITE (Gamma Technologies) | GT-SUITE license + Simulink interface (included feature, confirm) + 3D CFD coupling option | C31, C32 |
| RecurDyn (FunctionBay) | RecurDyn Professional + CoLink / Simulink interface + Particleworks / EDEM interface | C12, C24 |
| COMSOL Multiphysics | Base + Structural Mechanics + Heat Transfer + CFD + AC/DC + **LiveLink for MATLAB** + LiveLink for SOLIDWORKS/Inventor/Creo/NX | C5, C60 |
| JMAG (JSOL) | JMAG-Designer + JMAG-RT (+ RT Viewer, Simulink block) | C39 |
| MAGMASOFT (MAGMA) | Base + stress module + export to FEA | C42 |
| ProCAST / SYSWELD (ESI, Keysight) | Casting / welding + heat treatment, mapping export | C42, C43, C47 |
| FLOW-3D CAST (Flow Science) | Casting + export | C42 |
| DEFORM (SFTC) | DEFORM-3D / DEFORM-HT | C47 |
| Third Wave AdvantEdge + Production Module | Machining force / temperature simulation | C45 |
| VERICUT (CGTech) | Verification + Machine Simulation + **Force** optimisation + CNC Machine module | C41, C45 |
| CutPro (MAL Inc.) / MetalMAX (BlueSwarf) | Tap test hardware + stability lobe software | C46 |
| Mastercam / hyperMILL / SolidCAM | CAM + post-processor per machine | C41 |
| Autodesk Netfabb / Fusion | AM build prep + process simulation | C44 |
| EPLAN Electric P8 (+ Pro Panel) | Electrical CAD + TIA Portal interface / AutomationML export | C8 |
| ABB RobotStudio | Base (free basic) + Premium; virtual controller; PLC signal connection (Smart Components / OPC UA) | C52 |
| FANUC ROBOGUIDE / KUKA.Sim | Robot simulation, virtual controller | C52 |
| Beckhoff TwinCAT 3 | XAE (free engineering), TE1400 Target for MATLAB/Simulink, TC3 runtime licences | C54 |
| Speedgoat / dSPACE | Real-time target hardware + Simulink Real-Time / dSPACE ConfigurationDesk, VEOS | C55 |
| Visual Components / RoboDK / FlexSim | Base + connectivity add-on (OPC UA, PLC, Modbus) | C56 |
| optiSLang / HEEDS / Isight / modeFRONTIER (ESTECO) | Optimisation driver + connectors to each tool | C57, C58 |
| FEMtools (Dynamic Design Solutions) | Model updating + correlation | C61 |
| MpCCI (Fraunhofer SCAI) | CouplingEnvironment + code adapters (Abaqus, Ansys, Fluent, STAR-CCM+, OpenFOAM, FMI …) | C63 |

### M.7 Free / open-source equivalents (offline, no licence)

| Need | Free tool | Replaces (roughly) |
|---|---|---|
| CAD | FreeCAD | SOLIDWORKS basic |
| Multibody | Project Chrono, MBDyn, Simscape-like: OpenModelica MultiBody library | Adams, Simscape Multibody |
| System 1D + FMU | OpenModelica, FMPy (Python FMU runner) | Amesim, Dymola, Twin Builder |
| FEA | CalculiX (PrePoMax GUI), Code_Aster (Salome-Meca) | Ansys Mechanical / Abaqus (linear + good nonlinear) |
| CFD | OpenFOAM | Fluent / STAR-CCM+ |
| DEM | LIGGGHTS, Yade, Project Chrono DEM | EDEM, Rocky |
| CFD-DEM | CFDEMcoupling | EDEM–Fluent |
| FSI / coupling | preCICE | System Coupling, MpCCI |
| Optimisation | Python SciPy, Dakota (Sandia) | optiSLang, HEEDS |
| PLC soft-PLC | CODESYS Control Win (free trial runtime; licence for production) | PLCSIM Advanced (for non-Siemens) |
| Robot sim | RoboDK (low cost, not free), CoppeliaSim (edu free), Gazebo | RobotStudio, Process Simulate |
| Discrete-event | SimPy (Python) – and this project's own twin | Plant Simulation, FlexSim |
Note (offline rule): Python packages like FMPy, SciPy, PyAnsys are not stdlib – download wheel files once and install
offline (`pip install --no-index --find-links <folder> fmpy`).

### M.8 Minimum module set per coupling chain (shopping list)

| Chain | Tool A modules | Tool B modules | Coupling item |
|---|---|---|---|
| C1 SOLIDWORKS → Simscape | SOLIDWORKS Standard | MATLAB, Simulink, Simscape, Simscape Multibody | Simscape Multibody Link (free) |
| C10 Adams ⇄ Simulink | Adams View, Adams Solver | MATLAB, Simulink (+ Control System Toolbox) | Adams Controls |
| C16 Ansys → Adams flex | Ansys Mechanical (Enterprise recommended) | Adams View, Solver | Adams Flex (MNF import) |
| C19/C20 loads → fatigue | Adams + Adams Durability | Ansys Mechanical + nCode DesignLife (or fe-safe) | – |
| C22 EDEM ⇄ Fluent | Altair EDEM | Ansys Fluent | EDEM–Fluent coupling module (from Altair EDEM) |
| C23 Rocky ⇄ Fluent | Ansys Rocky | Ansys Fluent / Mechanical | native (Workbench) |
| C24 EDEM ⇄ Adams | Altair EDEM | Adams View, Solver | EDEM–Adams coupling (Altair EDEM) |
| C25 FSI | Ansys Fluent | Ansys Mechanical Enterprise | System Coupling |
| C26 STAR ⇄ Abaqus | Simcenter STAR-CCM+ | Abaqus Standard | built-in STAR-CCM+ co-sim / SIMULIA CSE |
| C31 GT ⇄ Simulink | GT-SUITE | MATLAB, Simulink | GT Simulink interface |
| C33/C34 Amesim | Simcenter Amesim (+ hydraulic libs) | Simulink / Adams | Amesim interface (Simulink / Adams) |
| C37 ROM → twin | Ansys Twin Builder (+ the 3D solver) | Simulink or Python (FMPy) | FMU (FMI standard) |
| C38 motor | Motor-CAD (or Maxwell) | Simulink + Simscape Electrical | export of lookup tables / ROM |
| C41 CAM chain | CAM + machine post | VERICUT Verification + Machine Simulation (+ Force) | machine model + control config |
| C48 PLC code | MATLAB, Simulink, Stateflow, Simulink PLC Coder | TIA Portal STEP 7 Professional | – |
| C49/C50 VC | Simulink + Industrial Communication Toolbox, or NX MCD | TIA Portal + S7-PLCSIM Advanced | OPC UA / PLCSIM Advanced API |
| C51 robot cell VC | Process Simulate + Virtual Commissioning | TIA Portal + PLCSIM Advanced | – |
| C53 line emulation | Plant Simulation (Professional) | PLCSIM Advanced / OPC UA server | Plant Simulation interfaces |
| C54 TwinCAT | MATLAB, Simulink, Simulink Coder | TwinCAT 3 XAE | TE1400 (Beckhoff) |
| C55 HIL | Simulink, Simulink Real-Time | Speedgoat target | I/O modules |
| C57 optimisation | optiSLang | each solver's licence + connector | – |
| C60 COMSOL ⇄ MATLAB | COMSOL + physics module | MATLAB | LiveLink for MATLAB |
| C62 twin bridge | any tool export (CSV/FMU) | Python twin (stdlib HTTP / Modbus) | FMPy (offline wheel) optional |
| C63 MpCCI | each solver | each solver | MpCCI CouplingEnvironment + adapters |

### M.9 Recommended purchase packs for the compressor factory (examples)

| Pack | Modules | Covers couplings | Price class (estimate) |
|---|---|---|---|
| **P1 – Start (control + mechanisms)** | MATLAB, Simulink, Simscape, Simscape Multibody (+ free Link), Simscape Electrical, Simscape Fluids, Control System Toolbox, Stateflow, Industrial Communication Toolbox | C1, C2, C11, C35, C62 (+ C49 with PLCSIM Advanced) | M per seat |
| **P2 – Crankshaft durability** | SOLIDWORKS (or NX), Adams View + Solver + Flex + Durability, Ansys Mechanical Enterprise + nCode DesignLife | C3, C16, C19, C20 | H–VH |
| **P3 – Compressor performance** | GT-SUITE (+ Simulink interface), Ansys Fluent + System Coupling (valve FSI) | C25, C27, C31 | H–VH |
| **P4 – Machining** | CAM (Mastercam / NX CAM / hyperMILL) + VERICUT (Machine Sim + Force) + tap-test kit (CutPro / MetalMAX) | C41, C45, C46 | M–H |
| **P5 – Virtual commissioning** | TIA Portal STEP 7 Professional + S7-PLCSIM Advanced + NX MCD or Process Simulate (+ Plant Simulation for line) | C9, C49–C53 | H |
| **P6 – Free / research** | FreeCAD, OpenModelica, Chrono, CalculiX, Code_Aster, OpenFOAM, LIGGGHTS + CFDEM, preCICE, FMPy, SciPy | free equivalents of C1–C37 | free (time cost) |
Start with **P1 + P6** (low cost, learn coupling), add P2 / P4 when the crankshaft and machining design starts, P5 before
the line is installed, P3 only if you design valves in house.

---

## Glossary (catalogue)
| Term | Meaning |
|---|---|
| AutomationML | XML exchange format for plant engineering data (IEC 62714) |
| CHT | Conjugate heat transfer – solid + fluid heat together |
| DAC / RPC | Load-history file formats (nCode / MTS) for durability |
| ECE model | Equivalent-circuit-extraction model of a motor (fast) |
| FBI | Simpack flexible-body input file |
| FRF | Frequency response function (from tap test) |
| HIL / SIL | Hardware- / software-in-the-loop |
| MAC | Modal Assurance Criterion – compares test and FEA mode shapes (1 = identical) |
| MNF | Modal Neutral File (Adams flexible body) |
| MOP | Metamodel of Optimal Prognosis (optiSLang) |
| ROM | Reduced-order model |
| SimUnits / tokens | Shared licence credit pools (Dassault, Hexagon, Altair) |
| ST | Structured Text, PLC language (IEC 61131-3) |
| VC | Virtual commissioning |
