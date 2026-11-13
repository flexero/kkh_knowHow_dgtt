# 53 – Connecting CAD / CAE / MATLAB tools: co-simulation, FMI, flexible bodies, CFD-DEM

> No tab in the twin yet (guide only). Continues guide 52. State: **November 2026**. Menu names and commands are from
> current versions – they change between releases, so check the maker's help for your version. All numbers are
> **example values**. Ratings are engineering estimates.

## Contents
1. Purpose · 2. Where in the twin · 3. Concepts – 4 ways to connect tools · 4. Connection map (who talks to whom) ·
5. Recipes step by step (R1–R14) · 6. Formulas (step sizes, modes, DEM, CFD-DEM) · 7. Compressor-factory workflows ·
8. Offline / licence notes · 9. Checklists · 10. Common mistakes · 11. Limits · 12. Glossary

---

## 1. Purpose
One tool rarely solves the whole problem. A crank mechanism needs **CAD** (geometry) + **multibody** (motion, forces) +
**FEA** (stress, flexibility) + **MATLAB/Simulink** (motor control) + sometimes **DEM / CFD** (particles, air). This guide
shows how to connect them quickly and correctly.

## 2. Where in the twin

| Twin part | Connection used in reality |
|---|---|
| Robot, APC, rotary table guides 17, 21–24 | CAD → Simscape Multibody / Adams → Simulink controller → PLC code |
| Spindle, crankshaft guides 10, 18 | FEA modal reduction → flexible body in Adams / Simpack → loads back to FEA fatigue |
| Hydraulics guides 25, 29, 30 | Amesim / Simscape Fluids ↔ Simulink ↔ multibody |
| PLC + virtual commissioning guides 05, 15 | Simulink / NX MCD ↔ PLCSIM Advanced (OPC UA, shared memory) |
| Twin server (Python, HTTP + Modbus, guides 07, 43) | FMU or OPC UA / Modbus bridge to feed simulated values into the twin |
| Additive guide 48 | DEM for powder spreading (EDEM / Rocky) |

## 3. Concepts – 4 ways to connect tools

| Way | How it works | Data direction | Speed to set up | Accuracy |
|---|---|---|---|---|
| **1. File transfer (one-way)** | Export a result file, import it in the next tool (STEP, loads .csv, MNF, pressure map) | A → B once | ★★★★★ fast | Good if B does not change A |
| **2. Model export / import** | Tool A writes a model that tool B runs natively (CAD → Simscape XML, FEA → MNF flexible body, Simulink → FMU) | A model runs inside B | ★★★★ | Very good |
| **3. Co-simulation (two-way)** | Both solvers run at the same time and exchange values every **communication step Δt_c** (TCP/IP, shared memory, FMI) | A ⇄ B every step | ★★★ | Good if Δt_c small enough (§6.1) |
| **4. Common platform / standard** | FMI (FMU), SSP, OPC UA, Ansys System Coupling, Workbench, Simcenter, 3DEXPERIENCE | Many tools | ★★ (first time) | Best long-term |

**FMI (Functional Mock-up Interface)** = open standard (Modelica Association; FMI 2.0 and 3.0). A model is packed as an
**.fmu** file (zip: XML description + compiled C code).
- **FMU for Model Exchange (ME):** only equations; the host solver integrates.
- **FMU for Co-Simulation (CS):** model brings its own solver; host only exchanges values every Δt_c.
- Supported by: Simulink, Adams, Amesim, GT-SUITE, Ansys Twin Builder, Simcenter, Dymola, **OpenModelica (free)**,
  COMSOL (export), Simpack, RecurDyn, NX MCD, many others.
**SSP** (System Structure and Parameterisation) = standard file that wires several FMUs together.

**Master / slave:** in co-simulation one tool is the master (sets time and step), usually Simulink, Adams or a
co-sim platform. **Jacobi** = both solve in parallel with old values (faster, less stable); **Gauss-Seidel** = one after
the other with the newest values (more stable).

---

## 4. Connection map (who talks to whom)

| From \ to | MATLAB / Simulink | Adams | Ansys | EDEM / Rocky (DEM) | Others |
|---|---|---|---|---|---|
| **SOLIDWORKS / Creo / Inventor / Onshape** | Simscape Multibody Link (XML + STEP) – **R1** | Adams CAD import (Parasolid / STEP), SOLIDWORKS Motion (Adams-like) – **R3** | Workbench CAD plug-in (associative, Geometry Interfaces), SpaceClaim / Discovery | Import STEP / STL geometry | COMSOL LiveLink for SOLIDWORKS, Simpack CAD import |
| **MATLAB / Simulink** | – | Adams Controls co-sim / FMU – **R2** | Twin Builder (FMU, ROM), Fluent / Mechanical via System Coupling or FMU – **R8** | EDEM API (Python / C++), coupling via scripts | Amesim, GT-SUITE (Simulink harness) – **R9**, PLC Coder → TIA Portal, PLCSIM Advanced – **R11**, OPC UA |
| **Adams** | Adams Controls (plant export) | – | Flexible body MNF from Ansys – **R4**; loads export to Ansys – **R5** | EDEM–Adams coupling (particle forces ⇄ body motion) – **R7** | Simcenter / Nastran MNF, Amesim co-sim, Marc nonlinear co-sim |
| **Ansys** | FMU / ROM export (Twin Builder) | MNF export | Fluent ⇄ Mechanical FSI via **System Coupling** – **R10** | Rocky DEM native in Workbench; EDEM ⇄ Fluent coupling – **R6** | Abaqus via files; Simpack flex bodies (FBI) |
| **EDEM / Rocky** | Python API post-processing | EDEM–Adams, EDEM–RecurDyn | Fluent CFD-DEM, loads → Mechanical | – | Altair MotionSolve, Simcenter STAR-CCM+ (own DEM) |
| **Abaqus** | Python scripts (.inp, .odb), Simulink co-sim via SIMULIA Co-Simulation Engine | Adams flex via Abaqus substructure → MNF | file exchange | EDEM loads (file) | Simpack, Dymola via CSE |
| **NX / NX MCD** | FMU, OPC UA | – | Simcenter 3D | – | PLCSIM Advanced / SIMIT virtual commissioning – **R12** |
| **Python twin (this project)** | MATLAB Engine for Python, OPC UA | – | PyAnsys (Ansys Python API) | EDEM Python API | FMU via FMPy, Modbus / HTTP bridge – **R13** |

---

## 5. Recipes step by step

### R1 – SOLIDWORKS (or Creo, Inventor) → MATLAB Simscape Multibody
Use: robot, APC arm, crank mechanism → motion + motor control in Simulink.
1. In MATLAB: download *Simscape Multibody Link* zip (same release as MATLAB) → `install_addon('smlink.r20XXx.win64.zip')`.
2. Run MATLAB **as administrator** → `regmatlabserver` (lets CAD talk to MATLAB).
3. In SOLIDWORKS: Tools → Add-ins → tick **Simscape Multibody Link**.
4. Prepare the assembly: correct **mates** (they become joints), real **materials / mass properties**, units mm, no
   redundant mates, fix the base part.
5. Tools → Simscape Multibody Link → **Export → Simscape Multibody** → writes `model.xml` + STEP files of the parts.
6. In MATLAB: `smimport('model.xml')` → Simulink model with bodies, joints, masses, inertias.
7. Add joint actuation (torque or motion input), sensors, and your controller (PID, motor model from Simscape Electrical).
8. Check: total mass and centre of gravity in Simulink = CAD mass properties.
Onshape: `smexportonshape('URL')`. Re-export after CAD changes (one-way link).

### R2 – Adams ⇄ MATLAB / Simulink (Adams Controls)
Use: mechanism with real contacts / friction in Adams, control law in Simulink.
1. In Adams View: define **input state variables** (e.g. motor torque) and **output state variables** (angle, speed).
   Use them in the model (torque = VARVAL(input)).
2. Plugins → **Adams Controls** → load. Controls → **Plant Export**: inputs, outputs, target = MATLAB, analysis =
   non-linear, communication = TCP/IP or pipe.
3. Adams writes `plant_name.m` (+ .adm / .cmd). In MATLAB, `cd` to that folder, run `plant_name`, then `adams_sys`
   → library with the **adams_sub** block.
4. Put adams_sub in your Simulink model, connect controller. In the block mask set **communication interval**
   (Δt_c, e.g. 1 ms, §6.1), animation interactive or batch.
5. Run Simulink: Adams solver starts and exchanges values every Δt_c (co-simulation) or Adams equations are evaluated
   by Simulink (function evaluation mode).
Alternative: export Adams model as **FMU** and import into Simulink (FMU block) – easier to share, no live link.

### R3 – CAD → Adams
1. Export Parasolid (.x_t) – keeps solids and mass – or STEP.
2. Adams View: File → Import → Parasolid; set material for every part; or use Adams **Machinery** modules
   (gears, belts, bearings, cranks).
3. Recreate joints (Adams does not read CAD mates from Parasolid). SOLIDWORKS Motion uses an Adams-type solver
   inside SOLIDWORKS for simple checks without export.

### R4 – Ansys (or Nastran / Abaqus) → Adams flexible body (MNF)
Use: crankshaft, connecting rod, frame that bends – stiffness changes the dynamics.
1. Mesh the part in Ansys Mechanical; make **interface nodes** at joint points (remote points / rigid spiders at
   bearing centres).
2. Craig-Bampton modal reduction: keep fixed-interface modes up to the cut-off frequency (§6.2) + static
   constraint modes at interface nodes.
3. Export **Adams MNF** (Ansys: MNF export command / extension; Nastran: `MBDEXPORT ADAMS`; Abaqus: substructure
   → MNF; or build the flex body inside Adams with **ViewFlex**).
4. Adams: replace the rigid part with the flexible body (Flex → Rigid to Flex), connect joints to interface nodes.
5. Check: first natural frequencies in Adams = FEA modal results (± 2 %).

### R5 – Adams → Ansys loads (one-way)
1. Run the Adams simulation (e.g. one crank revolution, several speeds).
2. Export joint / bearing reaction forces vs time (Load Export → Ansys) or stresses by **modal stress recovery**
   (from the MNF).
3. In Ansys Mechanical: apply as time-dependent remote forces or import modal coordinates → stress history →
   fatigue (nCode / Fatigue Tool).

### R6 – EDEM ⇄ Ansys Fluent (CFD-DEM)
Use: particles in a gas or liquid – shot blasting, pneumatic conveying, filters, powder.
1. Build particles + geometry in EDEM (shape, size distribution, material: Young's modulus, Poisson, restitution,
   friction). Calibrate with angle-of-repose / bulk density tests.
2. Build the same geometry and mesh in Fluent (same coordinates and units!).
3. Load the **EDEM–Fluent coupling module** in Fluent (supplied by Altair EDEM, loaded as UDF/add-on matching your
   Fluent version).
4. Choose coupling: **Lagrangian** (dilute flow, particle smaller than cell; drag on each particle) or **Eulerian**
   (dense flow; volume fraction in the cells, momentum exchange).
5. Set drag law (Schiller-Naumann, Di Felice, Gidaspow…), time steps: DEM Δt (§6.3) is much smaller than CFD Δt;
   ratio typically 10–100 DEM steps per CFD step.
6. Run both; Fluent controls the CFD steps, EDEM sub-steps.
Ansys alternative: **Rocky DEM** – Ansys's own DEM, couples to Fluent and Mechanical inside Workbench (fewer interface
problems). STAR-CCM+ has DEM built in.

### R7 – EDEM ⇄ Adams / RecurDyn / MotionSolve (DEM-MBD)
Use: machine moving through bulk material (bucket, conveyor, mixer, vibrating feeder).
1. Moving parts in Adams; particle contact in EDEM.
2. Load the EDEM coupling plug-in for the multibody tool; mark coupled bodies (same geometry, same origin).
3. Each step: Adams sends body position / velocity → EDEM computes particle forces → sends force + torque back.
4. Loads from EDEM can also go one-way to Ansys Mechanical as pressure / force maps (file export) for stress.

### R8 – Ansys ⇄ Simulink (Twin Builder, ROM, FMU)
1. Run a set of Ansys cases (e.g. thermal growth of spindle vs speed and time).
2. Twin Builder: build a **ROM** (reduced-order model: static ROM, dynamic ROM, LTI ROM) → export **FMU**.
3. Simulink: import FMU (FMU block) → runs in milliseconds → use in controller or digital twin.
Fluent / Mechanical can also be co-simulated with Simulink through System Coupling / FMU (slow – use ROM if possible).

### R9 – GT-SUITE / Amesim ⇄ Simulink
- GT-SUITE: **SimulinkHarness** part → GT model runs as S-function inside Simulink, or Simulink model compiled into GT;
  FMU both ways. Use: compressor valve + pulsation model with motor / pressure controller in Simulink.
- Amesim: Simulink **interface block** (S-function, co-sim or model exchange) or FMU. Use: hydraulic press, APC
  cylinder circuit with PLC logic.

### R10 – Fluent ⇄ Ansys Mechanical (FSI) via System Coupling
1. Workbench: Fluent system + Mechanical (transient structural) + **System Coupling**.
2. Define coupled surfaces (fluid wall = solid face): force from Fluent → Mechanical, displacement back.
3. One-way (pressure → stress) if deformation is small; two-way if deformation changes the flow (valve reed!).

### R11 – Simulink → PLC (code generation, virtual commissioning)
1. Model controller in Simulink / Stateflow.
2. **Simulink PLC Coder** → IEC 61131-3 Structured Text (TIA Portal, CODESYS, Studio 5000, TwinCAT…).
3. Test: plant model in Simulink ⇄ **PLCSIM Advanced** (Siemens soft PLC) via OPC UA / Simulink-PLCSIM coupling, or
   real PLC on the network (hardware-in-the-loop).

### R12 – NX MCD / Process Simulate ⇄ PLC (virtual commissioning)
1. NX Mechatronics Concept Designer: CAD + physics (gravity, collisions, conveyors, sensors).
2. Signals mapped to PLCSIM Advanced (shared memory), SIMIT, or OPC UA server.
3. Run the real PLC program against the virtual machine before the real machine arrives (guide 15).

### R13 – Simulation tools ⇄ this Python twin (offline)
| Bridge | How | Note |
|---|---|---|
| **HTTP / JSON** | Simulink, Adams scripts or Python post-script POST results to the twin API | Twin already serves HTTP (guide 07) |
| **Modbus TCP** | Simulink (Instrument Control / Industrial Communication Toolbox) or Python writes registers | Same as bsf tab (guide 43) |
| **OPC UA** | Simulink OPC UA client, Twin Builder, NX MCD | Needs an OPC UA server in the line |
| **FMU in Python** | FMPy package runs an .fmu | Not stdlib – install from an offline wheel file |
| **MATLAB Engine for Python** | Python calls MATLAB functions | Needs MATLAB licence on that PC |

### R14 – Free / open alternatives (offline, no licence)
OpenModelica (system models, FMU import/export), FreeCAD → STEP → MBDyn or Project Chrono (multibody + DEM in one
library), CalculiX / Code_Aster (FEA), OpenFOAM + CFDEMcoupling + LIGGGHTS (open CFD-DEM), preCICE (open coupling
library for FSI between OpenFOAM, CalculiX, Code_Aster…). More set-up work, no support.

---

## 6. Formulas

### 6.1 Co-simulation communication step
Exchange at least 10–20 times per period of the fastest dynamics you need:

  **Δt_c ≤ 1 / (k · f_max)**,  k = 10 … 20

Example – compressor at 1450 rpm: f_rot = 1450 / 60 = 24.2 Hz. You want up to the 12th harmonic (valve / gas forces):
f_max = 12 · 24.2 = 290 Hz → Δt_c ≤ 1 / (20 · 290) = **0.17 ms**.
Example – servo loop with 200 Hz bandwidth: Δt_c ≤ 1 / (20 · 200) = **0.25 ms**.
Too large Δt_c → phase lag → false instability or wrong forces. Check: halve Δt_c, results must not change (> 2 %).

### 6.2 Flexible body – how many modes (Craig-Bampton)
Keep modes up to **f_cut ≈ 1.5 … 2 × f_max of the excitation**.
Example: crankshaft loads up to 290 Hz → keep modes up to **≈ 450–600 Hz** plus constraint modes at each interface
node (6 per node). Too many high modes only slow down the solver.

### 6.3 DEM time step (Rayleigh)
  **Δt_R = π · R · √(ρ / G) / (0.1631 · ν + 0.8766)**   use **Δt = 10–30 % of Δt_R**

Example – steel shot R = 0.5 mm, ρ = 7800 kg/m³, G = 79 GPa, ν = 0.3:
Δt_R = π · 0.0005 · √(7800 / 79·10⁹) / (0.1631·0.3 + 0.8766) = **5.3·10⁻⁷ s** → Δt ≈ 20 % → **1.1·10⁻⁷ s**.
Example – sand R = 0.25 mm, ρ = 2650, G = 30 GPa, ν = 0.25 → Δt_R = 2.5·10⁻⁷ s → Δt ≈ 5·10⁻⁸ s.
This tiny step is why DEM users often lower G (shear modulus) by 10–100× – check that it does not change the result.

### 6.4 CFD-DEM cell size
Unresolved (standard) CFD-DEM: **cell size ≥ 3 … 5 × particle diameter**, otherwise void fraction becomes wrong.
Example: 1 mm shot → cells ≥ 3–5 mm.

### 6.5 Coupling stability (FSI, added mass)
Two-way FSI with light structure in dense fluid can be unstable if ρ_fluid / ρ_solid is high → use under-relaxation
(factor 0.3–0.7) or implicit (iterated) coupling. For air with steel valve reeds, ratio ≈ 1.2 / 7800 → usually stable.

---

## 7. Compressor-factory workflows (examples)

| Goal | Chain | Result |
|---|---|---|
| Crank mechanism balance + bearing loads | SOLIDWORKS → Adams (or Simscape) → flex crankshaft MNF from Ansys (R3, R4) | Bearing forces, vibration, balancing mass |
| Crankshaft fatigue | Adams loads → Ansys Mechanical + nCode (R5) | Safety factor in fatigue at pin fillet |
| Valve flutter + pressure pulsation | GT-SUITE valve model ⇄ Simulink pressure / motor control (R9); detail: Fluent ⇄ Mechanical FSI of reed (R10) | Valve life, FAD, noise |
| Robot / APC motion + controller | SOLIDWORKS → Simscape Multibody → Simulink PID → PLC Coder → PLCSIM (R1, R11) | Tuned controller before hardware |
| Hydraulic press / APC cylinder | Amesim ⇄ Simulink ⇄ Adams (R9, R2) | Pressure peaks, cycle time |
| Shot blasting of castings | EDEM (or Rocky) ⇄ Fluent air jet (R6); wear loads → Mechanical | Coverage, nozzle wear, cabin layout |
| Spindle thermal twin | Ansys thermal → Twin Builder ROM → FMU → Python twin (R8, R13) | Live thermal growth in the twin |
| Line virtual commissioning | NX MCD ⇄ PLCSIM Advanced (R12) | PLC tested before installation |

---

## 8. Offline / licence notes
- All commercial couplings work on a **LAN licence server** – each coupled tool needs its own licence (plus coupling
  modules: Adams Controls, Simscape Multibody, EDEM coupling, System Coupling, PLC Coder…).
- Keep **versions matched** (Simscape Link release = MATLAB release; EDEM coupling = Fluent version). Write the
  version pair into the project record.
- FMUs are compiled for one platform (win64) – build them on the same OS as the target PC.

## 9. Checklists
**Before coupling**
- [ ] Same units and coordinate origin in both tools (mm vs m is the #1 error)
- [ ] Each model validated alone first (mass, frequencies, steady-state values)
- [ ] Which tool is master; communication step chosen with §6.1
- [ ] Signal list: name, unit, direction, range (like a PLC I/O list)
- [ ] Version pair and licence modules confirmed

**After coupling**
- [ ] Halve Δt_c → change < 2 %
- [ ] Energy / force balance (input power = output + losses)
- [ ] Compare with a hand calculation or measurement

## 10. Common mistakes
- Two-way co-simulation when one-way file transfer is enough (10× slower for no gain).
- Communication step equal to the output step (too large) → wrong dynamics.
- CAD mates over-constrained → Simscape / Adams joints redundant, solver fails.
- DEM with real stiffness and no time budget, or with very soft particles that change results.
- Flexible body with interface nodes not at the joint locations.
- Different geometry versions in the coupled tools.

## 11. Limits
- Menu paths and commands change with versions – use them as a map, confirm in the maker's documentation.
- Rules of thumb (k = 10–20, 1.5–2× modes, 10–30 % Rayleigh, cell ≥ 3–5 d) are common practice, not guarantees.
- EDEM is an Altair product (Altair now part of Siemens) – check the future coupling road map with Ansys.

## 12. Glossary
| Term | Meaning |
|---|---|
| Co-simulation | Two or more solvers run together and exchange values each step |
| Communication step Δt_c | Time between data exchanges |
| FMI / FMU | Open standard / file for exchanging simulation models |
| SSP | Standard for connecting several FMUs |
| MNF | Modal Neutral File – flexible body for Adams |
| Craig-Bampton | Method to reduce an FE model to few modes + interface nodes |
| DEM | Discrete Element Method – simulates many particles |
| CFD-DEM | Fluid (CFD) coupled with particles (DEM) |
| FSI | Fluid-structure interaction |
| ROM | Reduced-order model – fast approximation of a big simulation |
| HIL / SIL | Hardware- / software-in-the-loop testing |
| Virtual commissioning | Testing real PLC code against a simulated machine |
