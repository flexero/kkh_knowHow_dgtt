# 52 – CAD, CAE and CAM software: the main applications today, strengths, weaknesses, performance, fields

> No tab in the twin yet (guide only). State: **November 2026**. Ratings (★) are **engineering estimates** for orientation,
> not test results. Prices are **rough classes – ask the reseller for a quote**. Maker names are examples, not a
> recommendation. Always check the current version, licence terms and hardware list on the maker's website.

## Contents
1. Purpose · 2. Where in the twin · 3. Concepts · 4. CAD applications · 5. CAE applications · 6. CAM applications ·
7. Performance and hardware (formulas) · 8. Trends 2025–2026 · 9. Offline / licence check · 10. Recommended stacks for
the compressor factory · 11. Worked examples · 12. Checklists · 13. Common mistakes · 14. Limits · 15. Glossary

---

## 1. Purpose
Know which CAD, CAE and CAM programs are used most today, what each is good and bad at, how fast / how big a job
each can handle, which industries use them, and which set of programs fits a compressor factory that must run
**offline** (see guide 00 conventions).

## 2. Where in the twin

| Link to the twin | What it means |
|---|---|
| CNC tab (`web/gcode.js`, guide 08) | Shows G-code. In reality this G-code comes from a **CAM** program + post-processor. |
| HMC / spindle guides 12, 18, 19 | Part drawings and tolerances come from **CAD** (3D model + drawing / PMI). |
| Mechanics, hydraulics, robot guides 10, 21–30 | Hand formulas there; a **CAE** (FEA / CFD / multibody) run checks them for complex shapes. |
| Machine tools tab (guide 49) | Machine choice decides which CAM post-processor and machine simulation you need. |
| AI tab (guide 50) | AI surrogates and AI-CAM (section 8) are the same ideas applied to engineering software. |
| Standards (guide 16) | ISO 10303-242 (STEP AP242), ISO 16792 / ASME Y14.41 (3D annotation), ISO 6983 (G-code). |

## 3. Concepts

| Term | Simple meaning |
|---|---|
| **CAD** – Computer-Aided Design | Make the 3D model, assembly and 2D drawing of a part. |
| **CAE** – Computer-Aided Engineering | Calculate the part on the computer: stress (FEA), flow and heat (CFD), motion (multibody), casting, 1D systems. |
| **CAM** – Computer-Aided Manufacturing | Make the tool paths and the G-code for the CNC machine, and simulate the machine. |
| **PLM / PDM** | Database for files, versions, part numbers, change orders (Teamcenter, Windchill, 3DEXPERIENCE, Vault, SOLIDWORKS PDM). |
| **Geometry kernel** | The math engine inside CAD. Parasolid (NX, Solid Edge, SOLIDWORKS, Onshape…), CGM (CATIA), ACIS, Granite (Creo), OpenCASCADE (FreeCAD). Same kernel → easier file exchange. |
| **Parametric / history-based** | The model is a list of features with dimensions; change a number → model updates. |
| **Direct / synchronous modelling** | Push and pull faces without history. Fast for changes and imported files. |
| **MBD / PMI** | Model-Based Definition: tolerances and GD&T live in the 3D model (no or fewer 2D drawings). |
| **Post-processor** | Small program that translates CAM tool paths into the G-code dialect of **one** machine + control (Fanuc, Siemens, Heidenhain…). |
| **Machine simulation** | Virtual machine (axes, head, table, fixture) runs the real G-code to find collisions before metal is cut. |
| **Mesh / DOF** | FEA cuts the part into small elements; each node has unknowns (DOF). More DOF → more accurate, slower. |

**The chain (digital thread):** CAD model → CAE check → change CAD → CAM tool path → post → G-code → machine
simulation → CNC → measure (CMM) → compare with CAD. One shared model avoids re-drawing and errors.

---

## 4. CAD applications

### 4.1 Overview table

| Application (maker) | Class | Kernel | Main fields | Typical users |
|---|---|---|---|---|
| **CATIA** (Dassault Systèmes, on 3DEXPERIENCE) | High-end | CGM | Automotive, aerospace, ships, class-A surfaces | OEMs (cars, aircraft) and their suppliers |
| **Siemens NX** | High-end, CAD+CAM+CAE in one | Parasolid | Automotive, aerospace, turbomachinery, machinery, moulds | OEMs, tier-1, mould shops |
| **PTC Creo** | High-end | Granite | Industrial machinery, defence, electronics housings, medical | Machine builders, large assemblies |
| **SOLIDWORKS** (Dassault) | Mid-range | Parasolid | Machinery, jigs + fixtures, consumer products, sheet metal, weldments | SMEs, machine builders, schools – largest user base |
| **Autodesk Inventor** | Mid-range | ShapeManager (ACIS-based) | Machinery, frames, factory equipment, with AutoCAD / Vault | SMEs, AutoCAD users |
| **Solid Edge** (Siemens) | Mid-range | Parasolid | Machinery, sheet metal, synchronous editing | SMEs; free Community Edition for learning |
| **Autodesk Fusion** | Low-cost, cloud, CAD+CAM+CAE+PCB | ShapeManager | Product design, small shops, start-ups | Small companies, makers |
| **Onshape** (PTC) | Cloud / browser | Parasolid | Product design, teams in many places | Distributed teams |
| **FreeCAD** (open source, v1.x) | Free | OpenCASCADE | Simple machinery, learning, offline use | Students, small shops, open-source users |
| **AutoCAD** (Autodesk) / BricsCAD / ZWCAD | 2D (+3D) drafting | – | Factory layouts, 2D drawings, schematics | Everyone for 2D |
| **ZW3D** (ZWSOFT), **TopSolid** (TOPSOLID) | Mid-range CAD + CAM | own | Moulds, machining, cost-sensitive markets | SMEs |
| **EPLAN Electric P8** / AutoCAD Electrical | Electrical CAD | – | Control panels, wiring, PLC I/O lists | Panel builders (needed for guide 05/27 work) |

### 4.2 Advantages, disadvantages, performance

| Application | Advantages | Disadvantages | Performance (estimate) |
|---|---|---|---|
| **CATIA** | Best free-form and class-A surfacing; huge assemblies (whole car / aircraft); full PLM on 3DEXPERIENCE; required by many car and aircraft OEMs | Very expensive; steep learning (months); licence by roles/modules is complex; heavy hardware; more and more tied to the cloud platform | Large assemblies ★★★★★ · Surfacing ★★★★★ · Ease ★★ · Price class: very high |
| **Siemens NX** | One system for CAD + CAM + CAE (Simcenter); synchronous + parametric; strongest integrated 5-axis CAM; Teamcenter PLM; good with Sinumerik machines | Expensive; many modules → complex licence; learning curve high | Large assemblies ★★★★★ · Integration ★★★★★ · Ease ★★★ · Price: high |
| **PTC Creo** | Very robust parametric models; handles large assemblies well; strong MBD / GD&T; built-in generative design, simulation (Ansys-based live sim), additive; Windchill PLM | UI feels older; some modules extra cost; smaller community than SOLIDWORKS | Large assemblies ★★★★ · Robustness ★★★★★ · Ease ★★★ · Price: high |
| **SOLIDWORKS** | Easy to learn; biggest community, tutorials, add-ins and supplier models (bearings, cylinders, motors are downloadable); good sheet metal, weldments, drawings; Simulation + CAM add-ins | Windows only; rebuild mostly single-core → large assemblies (> 5 000–10 000 parts) slow; licence cost rising, push to 3DEXPERIENCE cloud | Assemblies ★★★ · Ease ★★★★★ · Ecosystem ★★★★★ · Price: medium |
| **Inventor** | Good for machines and frames (Frame Generator, iLogic rules, Design Accelerator for shafts, gears, bolts); works with AutoCAD, Vault; Nastran inside | Windows only; Autodesk development focus has moved toward Fusion; surfacing weak; subscription only | Assemblies ★★★ · Ease ★★★★ · Price: medium |
| **Solid Edge** | Synchronous technology (edit imported STEP easily); Parasolid like NX; lower price; free Community Edition | Smaller community; fewer third-party add-ins | Assemblies ★★★ · Ease ★★★★ · Price: low-medium |
| **Fusion** | Cheap; CAD + very good CAM + simulation + generative design + PCB in one; fast updates | **Cloud-based** – needs internet, data stored in Autodesk cloud (against our offline rule); large assemblies weak; features can change with subscription tiers | Assemblies ★★ · CAM value ★★★★ · Price: low |
| **Onshape** | Runs in a browser on any PC; real-time team editing; built-in version control (no lost files) | **Internet always needed** (fails offline rule); data in the vendor cloud; limited CAM/CAE inside | Assemblies ★★★ · Teamwork ★★★★★ · Price: low-medium |
| **FreeCAD** | Free, offline, open file formats, Python scripting, FEM workbench (CalculiX) and CAM workbench inside | Less polished; topological-naming problem much reduced in 1.0 but still care needed; weak with large assemblies; no official support | Assemblies ★★ · Ease ★★ · Price: free |
| **AutoCAD** | Standard for 2D layouts, DWG format everyone reads | Not a 3D parametric design tool for machines | 2D ★★★★★ · Price: low-medium |

**Rule of thumb for choice:** your customers' / suppliers' CAD and your PLM decide more than features. Car or
aircraft supply chain → CATIA or NX. General machinery SME → SOLIDWORKS, Inventor, Solid Edge or Creo.

---

## 5. CAE applications

### 5.1 Overview table

| Application (maker) | Physics / method | Main fields |
|---|---|---|
| **Ansys** (part of Synopsys since 2025): Mechanical, Fluent, CFX, LS-DYNA, Maxwell, HFSS, Discovery, nCode | FEA (linear + nonlinear), CFD, explicit crash, electromagnetics, fatigue | Everything – automotive, aerospace, energy, electronics, turbomachinery |
| **Abaqus** (Dassault SIMULIA) + fe-safe, Tosca | Nonlinear FEA (contact, rubber, plastics, damage), fatigue, topology | Tyres, seals, automotive, medical, bolted joints |
| **Siemens Simcenter**: 3D (NX Nastran), STAR-CCM+, Amesim, Femap, HEEDS | FEA, CFD, 1D system simulation, optimisation | Automotive, aerospace, machinery, HVAC |
| **Altair HyperWorks** (Siemens since 2025): HyperMesh, OptiStruct, Radioss, Inspire, PhysicsAI | Meshing, topology optimisation, crash, AI surrogates | Automotive lightweighting, castings, brackets |
| **MSC Nastran, Marc, Adams** (Hexagon) | Linear FEA (Nastran = aerospace standard), nonlinear, **multibody dynamics** (Adams) | Aerospace, vehicle dynamics, mechanisms |
| **COMSOL Multiphysics** | Coupled physics (thermal + structure + electric + flow + acoustics), own equations | Research, sensors, batteries, heating, acoustics |
| **GT-SUITE** (Gamma Technologies) | 1D thermodynamics, valves, pulsation, engines, **compressors** | Engines, compressors, cooling systems |
| **MAGMASOFT**, ProCAST (ESI / Keysight), FLOW-3D CAST | Casting: filling, solidification, porosity, stress | **Foundries – crankcase, cylinder, head castings** |
| **Moldflow** (Autodesk), Moldex3D | Plastic injection moulding | Plastic parts, moulds |
| **CAD-embedded:** SOLIDWORKS Simulation / Flow Simulation, Inventor Nastran, Creo Simulation Live, Fusion Simulation | Linear static, frequency, simple thermal / flow | Designers' quick checks |
| **Open source:** CalculiX, Code_Aster (Salome-Meca), Elmer, **OpenFOAM** (CFD), MBDyn | FEA, multiphysics, CFD, multibody | Research, budget users, offline |
| **Cloud:** SimScale, OnScale, Ansys Cloud, Rescale | FEA / CFD in a web browser on rented servers | Small teams without HPC (needs internet) |

### 5.2 Advantages, disadvantages, performance

| Application | Advantages | Disadvantages | Performance (estimate) |
|---|---|---|---|
| **Ansys** | Widest physics range; Fluent = most used industrial CFD; trusted, validated; GPU solver in Fluent; Discovery for instant design studies; large training base | Very expensive (per module + per core HPC packs); needs strong workstation / cluster; many separate products | Breadth ★★★★★ · CFD ★★★★★ · Ease ★★★ · Price: very high |
| **Abaqus** | Best for hard nonlinear problems (contact, large deformation, rubber seals, plastic metal); Explicit + Standard in one; strong fatigue with fe-safe | Expensive; text-based keyword files, steep learning; CFD weak | Nonlinear ★★★★★ · Ease ★★ · Price: very high |
| **Simcenter** | STAR-CCM+ excellent automated meshing and multiphysics CFD; Amesim for hydraulics / pneumatics systems; tight NX integration; power-on-demand licensing | Many products, complex licence; best value only with NX / Teamcenter | CFD ★★★★★ · 1D systems ★★★★★ · Price: high |
| **Altair** | Best-known topology optimisation (OptiStruct); HyperMesh = reference mesher; units-based licence lets you use many tools | Future product line now inside Siemens – check road map; learning curve | Optimisation ★★★★★ · Meshing ★★★★★ · Price: high |
| **MSC Nastran / Adams** | Nastran = aerospace certification standard for linear dynamics; Adams = leading multibody tool (mechanisms, vehicles) | Older interfaces; separate pre-processor needed (Patran / Femap / HyperMesh) | Linear dynamics ★★★★★ · Multibody ★★★★★ · Price: high |
| **COMSOL** | Easiest real multiphysics coupling; you can type your own PDE; good for R&D and thesis work | Big models slow vs specialist codes; CFD at high Reynolds weaker than Fluent / STAR-CCM+ | Multiphysics ★★★★★ · Large models ★★★ · Price: medium-high |
| **GT-SUITE** | Fast 1D models of whole compressor (crank, piston, valves, pulsation, cooling) in minutes; couples to 3D CFD | Needs good input data (valve stiffness, flow coefficients); special knowledge | Speed ★★★★★ · Compressor fit ★★★★★ · Price: high |
| **MAGMASOFT / ProCAST** | Predicts porosity, cold shuts, shrinkage before the first casting → fewer scrap castings | Needs real material and mould data; foundry knowledge | Casting ★★★★★ · Price: high |
| **CAD-embedded tools** | Inside the CAD, no file transfer, easy for designers; good for first checks | Mostly linear only; limited contact, mesh and solver control; easy to get wrong answers without FEA knowledge | Ease ★★★★★ · Accuracy for hard cases ★★ · Price: low-medium |
| **CalculiX / Code_Aster / OpenFOAM** | Free, offline, unlimited cores, open source (good for research reproducibility) | No GUI or weak GUI (use Salome, PrePoMax, FreeCAD); you are your own support; slower to learn | Capability ★★★★ · Ease ★★ · Price: free |
| **Cloud CAE (SimScale…)** | No hardware to buy; pay per use; runs many cases in parallel | **Needs internet**, data leaves the factory; cost grows with core-hours | Scalability ★★★★★ · Offline ✗ |

### 5.3 Which CAE for which compressor question (examples)

| Question | Method | Tool examples |
|---|---|---|
| Crankshaft stress + fatigue life | FEA + fatigue (S-N, Goodman) | Ansys Mechanical + nCode, Abaqus + fe-safe, CalculiX + own Goodman sheet |
| Connecting rod / bolt preload | Nonlinear FEA with contact | Abaqus, Ansys, Code_Aster |
| Crankcase casting porosity | Casting simulation | MAGMASOFT, ProCAST, FLOW-3D CAST |
| Valve plate flutter, pressure pulsation, FAD | 1D thermodynamic + valve dynamics | GT-SUITE, Amesim |
| Cylinder cooling fins / fan air flow | CFD with conjugate heat transfer | Fluent, STAR-CCM+, OpenFOAM, SOLIDWORKS Flow |
| Vibration of base frame / tank | Modal + harmonic FEA | Nastran, Ansys, Simcenter 3D |
| Crank mechanism forces, balancing | Multibody dynamics | Adams, Simcenter 3D Motion, RecurDyn |
| Air tank (pressure vessel) | FEA per EN 13445 / ASME VIII design-by-analysis | Ansys, Abaqus (check with notified body) |

---

## 6. CAM applications

### 6.1 Overview table

| Application (maker) | Strong in | Main fields |
|---|---|---|
| **Mastercam** (CNC Software, Sandvik group) | 2.5D–5-axis milling, turning, mill-turn, wire; Dynamic Motion roughing | Job shops, general machining – largest CAM user base |
| **Siemens NX CAM** | 5-axis, mill-turn, robots, feature-based machining, integrated machine simulation, Sinumerik link | Aerospace, automotive, turbine blades, moulds |
| **hyperMILL** (OPEN MIND) | 5-axis simultaneous, barrel (circle-segment) cutters, impellers, collision avoidance | Moulds, aerospace, medical, impellers |
| **ESPRIT EDGE** (Hexagon) | Mill-turn, Swiss-type, multi-channel lathes, wire EDM, machine-aware posts | Production turning, multitasking |
| **PowerMill** (Autodesk) | High-speed 3–5-axis for moulds / dies, robot machining | Mould and die shops |
| **Fusion CAM** (Autodesk) | Adaptive clearing, good 2.5D–5-axis for the price | Small shops, start-ups (cloud) |
| **SolidCAM** (inside SOLIDWORKS / Inventor) | iMachining (adaptive roughing with a cutting-data wizard), mill-turn | SMEs using SOLIDWORKS |
| **CAMWorks** / **SOLIDWORKS CAM** | Feature recognition, knowledge-based (tech DB) automatic tool paths | Prismatic parts in SOLIDWORKS shops |
| **Edgecam** (Hexagon), **GibbsCAM** (Sandvik), **TopSolid'Cam**, **Creo NC**, **CATIA/DELMIA Machining**, **WorkNC**, **Cimatron** (moulds) | Various | Each has its niche |
| **VERICUT** (CGTech) | **G-code verification** – simulates the real post output on a machine model, collision, stock compare, Force feed optimisation | All serious CNC users, aerospace almost always |
| **FreeCAD CAM** workbench | Basic 2.5D milling, free, offline | Learning, simple parts |

### 6.2 Advantages, disadvantages, performance

| Application | Advantages | Disadvantages | Performance (estimate) |
|---|---|---|---|
| **Mastercam** | Most programmers know it (easy to hire); huge post-processor library; Dynamic Motion cuts roughing time a lot; dongle or network licence (works offline) | Own CAD is basic; 5-axis and mill-turn modules extra cost; post quality depends on reseller | 2.5D/3D ★★★★★ · 5-axis ★★★★ · Ease ★★★★ · Price: medium |
| **NX CAM** | Same model as NX CAD → design change updates tool paths; very strong 5-axis + mill-turn + machine simulation (digital twin of machine); Sinumerik integration; feature-based automation | Expensive; needs NX skill; overkill for simple parts | 5-axis ★★★★★ · Automation ★★★★★ · Price: high |
| **hyperMILL** | Excellent 5-axis surface quality and collision checking; barrel-cutter finishing saves time; good with many CAD systems | Turning weaker than ESPRIT; price high | 5-axis ★★★★★ · Price: high |
| **ESPRIT EDGE** | Best-known for mill-turn and Swiss machines; posts often made with the machine builders; KnowledgeBase cutting data | Mould 3D surfacing less strong than hyperMILL / PowerMill | Mill-turn ★★★★★ · Price: medium-high |
| **PowerMill** | Very fast calculation of high-speed tool paths on big mould surfaces; robot module | Autodesk focus is moving to Fusion; prismatic work less convenient | Moulds ★★★★★ · Price: medium-high |
| **Fusion CAM** | Strong value: adaptive clearing, probing, 4/5-axis add-on | **Cloud licence and data** (offline rule); post edits need JavaScript | Value ★★★★★ · Offline ✗ |
| **SolidCAM / CAMWorks** | Work inside the CAD you already use; automatic feature recognition; iMachining sets feeds and speeds for you | Depends on host CAD version; very complex 5-axis less strong | 2.5D ★★★★★ · Ease ★★★★ · Price: medium |
| **VERICUT** | Checks the **actual G-code** (not the CAM path) on the real machine model → finds post errors and crashes; Force optimisation shortens cycle | Extra cost; machine model must be built correctly once | Safety ★★★★★ · Price: medium-high |
| **FreeCAD CAM** | Free, offline | Limited strategies, no machine simulation, slow to program | Capability ★★ · Price: free |

---

## 7. Performance and hardware (formulas)

### 7.1 CAD speed
- Most CAD **rebuild** is single-threaded → buy a CPU with **high clock speed** (GHz), not many cores.
- Graphics: certified workstation GPU (NVIDIA RTX A-series / Ada, AMD Radeon PRO) with certified driver.
- RAM: 32 GB for parts and medium assemblies; 64 GB+ for assemblies with thousands of parts.

### 7.2 FEA size → memory and time
Number of unknowns for a solid mesh:

  **DOF = 3 × N_nodes** (3 displacements per node)

Rule of thumb (orientation only, depends on solver and element type):

| Solver | RAM per million DOF |
|---|---|
| Iterative (PCG, Jacobi CG) | ≈ 1–2 GB |
| Sparse direct (in-core) | ≈ 10 GB |

Basic FEA equation (linear static): **[K]·{u} = {F}** → stiffness matrix × displacement = force.
Then strain from u, stress σ = E·ε, and **safety factor n = R_e / σ_vM** (yield / von Mises stress).

**Mesh convergence:** refine the mesh until the peak stress changes **< 2–5 %** between two refinements. Use
quadratic (10-node) tetrahedra, at least 2–3 elements across a thin wall, small elements at fillets.

### 7.3 CFD time step
Courant number **C = u · Δt / Δx** — keep C ≲ 1 for transient explicit-type stability / accuracy.
→ **Δt ≤ C · Δx / u**. CFD RAM ≈ 1–2 GB per million cells (rule of thumb).

### 7.4 Why more cores do not give linear speed-up (Amdahl's law)
**S = 1 / ((1 − p) + p / n)**   p = parallel fraction of the work, n = cores.
Example: p = 0.9, n = 16 → S = 1 / (0.1 + 0.05625) = **6.4×** (not 16×). This is why CAE licences sold
"per core" must be balanced against real speed-up.

### 7.5 CAM calculation formulas (what CAM computes for you – check them)

| Quantity | Formula |
|---|---|
| Spindle speed | **n = 1000 · v_c / (π · D)**   [rpm; v_c m/min, D mm] |
| Feed rate | **v_f = f_z · z · n**   [mm/min] |
| Material removal rate | **Q = a_e · a_p · v_f / 1000**   [cm³/min] |
| Cutting power | **P_c = a_e · a_p · v_f · k_c / (60 · 10⁶)**   [kW; k_c N/mm²] |
| Chip thinning (a_e < D/2) | **h_ex = f_z · 2·√(a_e/D − (a_e/D)²)** → raise f_z to keep h_ex |
| Scallop height (ball / bull-nose finishing) | **h = R − √(R² − (s/2)²) ≈ s² / (8R)**   s = step-over |
| Cutting time | **t = L / v_f** |

---

## 8. Trends 2025–2026

| Trend | What it is | Examples | Meaning for you |
|---|---|---|---|
| **AI inside CAD** | Auto-drawings, sketch auto-constraints, design assistants, text-to-part prompts | SOLIDWORKS / 3DEXPERIENCE AI assistants, Siemens Industrial Copilot for NX, Autodesk AI in Fusion, Creo AI features | Saves drafting time; you still check every dimension |
| **AI surrogate CAE** | Train a model on past simulations → answer in seconds | Ansys SimAI, Altair PhysicsAI, Simcenter AI, Neural Concept | Fast design studies; not for final safety proof |
| **GPU solvers** | CFD / FEA on graphics cards, 5–20× faster in reported cases | Fluent GPU solver, STAR-CCM+ GPU, Ansys Discovery | One GPU workstation can replace a small cluster for some jobs |
| **Simulation-driven design / generative** | CAE inside CAD early, topology optimisation, lattice for AM | Creo generative, NX, Fusion, Altair Inspire, nTop | Lighter brackets, AM parts (guide 48) |
| **AI-assisted CAM** | Automatic tool and strategy proposal from feature recognition + learned data | CloudNC CAM Assist, NX CAM feature-based + AI, hyperMILL automation, Mastercam automation | Shorter programming time for prismatic parts (crankcase, heads) |
| **Machine digital twin** | Full kinematic machine + control (virtual NC kernel) in CAM | NX + Sinumerik VNCK, VERICUT, Heidenhain / Fanuc virtual controls | Zero-crash first part; virtual commissioning (guide 15) |
| **MBD / STEP AP242** | Tolerances in 3D model, drawingless, to CAM and CMM | All high-end CAD; QIF for inspection | Connects CAD → CAM → CMM (guide 44 quality) |
| **Cloud + subscription** | Perpetual licences disappearing; browser CAD | Onshape, Fusion, 3DEXPERIENCE, Autodesk named-user | Conflict with offline factory – check licence rules |
| **Consolidation** | Synopsys bought Ansys (2025), Siemens bought Altair (2025), Sandvik owns Mastercam + GibbsCAM, Hexagon owns ESPRIT + Edgecam + MSC | – | Product road maps can change; prefer open formats (STEP, Parasolid x_t) |

---

## 9. Offline / licence check (important for this project)

| Licence type | Offline OK? | Examples |
|---|---|---|
| Network licence server in your LAN (FlexLM / RLM / SolidNetWork) | ✓ Yes (best for factory) | NX, Creo, CATIA V5, Ansys, Abaqus, SOLIDWORKS network, Mastercam network, VERICUT |
| Dongle (USB key) | ✓ Yes | Mastercam, ESPRIT, hyperMILL, SolidCAM (options) |
| Node-locked file, offline activation | ✓ Mostly (one-time activation by file/email) | SOLIDWORKS standalone, COMSOL, GT-SUITE |
| Named-user cloud sign-in (periodic online check) | ⚠ Needs internet regularly – ask the reseller | Autodesk subscriptions (Inventor, PowerMill), 3DEXPERIENCE roles |
| Fully cloud / browser | ✗ No | Fusion, Onshape, SimScale |
| Open source | ✓ Yes | FreeCAD, CalculiX, Code_Aster, OpenFOAM |

Ask the seller in writing: "Does the licence run **without internet for unlimited time** on a LAN licence server?"

---

## 10. Recommended stacks for the compressor factory (examples)

| Stack | CAD | CAE | CAM + verify | When |
|---|---|---|---|---|
| **A – Budget, offline** | FreeCAD + AutoCAD/ BricsCAD (layouts) | CalculiX (PrePoMax) / Code_Aster, OpenFOAM | FreeCAD CAM or a dongle CAM (Mastercam Mill) | Start-up, learning, thesis research |
| **B – SME standard (recommended start)** | SOLIDWORKS or Solid Edge (+ PDM) | SOLIDWORKS Simulation / Flow + one specialist (Ansys or Abaqus seat) when needed | Mastercam or SolidCAM (+ mill-turn) + VERICUT | Small production line, 1–3 designers |
| **C – Integrated high-end** | Siemens NX + Teamcenter | Simcenter 3D + STAR-CCM+ + Amesim | NX CAM + Sinumerik VNCK / VERICUT | Many variants, 5-axis HMC cells, long-term digital thread |
| **Add-ons by need** | EPLAN (panels) | GT-SUITE (valves, pulsation, FAD); MAGMASOFT (if you cast in house or audit the foundry) | – | Compressor-specific engineering |

Practical advice: buy CAM per **machine** (the post-processor and machine simulation must exist for your exact
machine + control), and require the post-processor to be **tested on your machine** in the acceptance (SAT, guide 15).

---

## 11. Worked examples (example values)

**E1 – Face milling the crankcase joint face (grey cast iron, CAM check)**
D = 80 mm, z = 6, v_c = 200 m/min, f_z = 0.15 mm, a_e = 60 mm, a_p = 2 mm, k_c ≈ 1100 N/mm² (example).
- n = 1000·200 / (π·80) = **796 rpm**
- v_f = 0.15·6·796 = **716 mm/min**
- Q = 60·2·716 / 1000 = **85.9 cm³/min**
- P_c = 60·2·716·1100 / (60·10⁶) = **1.58 kW** (well below spindle power)
- Path L = 400 mm → t = 400 / 716 = **0.56 min**

**E2 – Chip thinning for adaptive roughing (aluminium head)**
D = 10 mm, a_e = 1 mm → a_e/D = 0.1 → factor = 2·√(0.1 − 0.01) = **0.60**.
Wanted h_ex = 0.05 mm → programmed f_z = 0.05 / 0.60 = **0.083 mm**.
With v_c = 300 m/min: n = 1000·300/(π·10) = 9 549 rpm; z = 4 → v_f = 0.083·4·9 549 ≈ **3 170 mm/min**.

**E3 – Scallop height in 3D finishing**
Ball R = 5 mm, step-over s = 0.5 mm → h = 5 − √(25 − 0.0625) = **0.00625 mm = 6.3 µm** (≈ s²/8R = 6.25 µm).

**E4 – FEA model size and safety factor (crankshaft)**
Mesh 400 000 nodes → DOF = 1.2 million → PCG ≈ 1.2–2.4 GB RAM, sparse direct ≈ 12 GB.
σ_vM max at pin fillet = 120 MPa, R_e = 355 MPa (example steel) → n = 355 / 120 = **2.96** (static only –
fatigue check needed separately, guide 10).

**E5 – CFD time step for fan air**
u = 10 m/s, smallest cell Δx = 1 mm, C = 1 → Δt ≤ 1·0.001/10 = **1·10⁻⁴ s**.

**E6 – Core count**
p = 0.9, 16 cores → speed-up **6.4×**; 32 cores → 1/(0.1 + 0.028) = **7.8×** → doubling cores gives only +22 %.

---

## 12. Checklists

**Before buying CAD/CAE/CAM**
- [ ] Which CAD do customers and suppliers use? Which exchange format (STEP AP242, Parasolid)?
- [ ] Licence works offline on a LAN server? Perpetual or subscription? Cost over 5 years?
- [ ] Post-processor for **each** machine + control included and tested on the real machine?
- [ ] Machine simulation model of your machines available (CAM or VERICUT)?
- [ ] PDM/PLM: where are files, versions, part numbers stored (guide 15 numbering)?
- [ ] Hardware on the maker's certified list (CPU clock, RAM, certified GPU driver)?
- [ ] Training and local reseller support in your country / language?
- [ ] Trial with **your** part (crankcase or crankshaft), not the seller's demo part.

**Before trusting a CAE result**
- [ ] Units, material data (E, ν, R_e, fatigue limit) from certificate / standard
- [ ] Boundary conditions realistic (no over-stiff fixed supports)
- [ ] Mesh convergence < 2–5 %
- [ ] Reaction forces = applied loads (equilibrium check)
- [ ] Hand calculation within ±20–30 % of FEA for a simple part of the model

**Before running new G-code**
- [ ] Simulated with the real post output (VERICUT / machine simulation)
- [ ] Tool lengths, work offsets, fixture model correct
- [ ] First run with feed override low, single block in risky areas

## 13. Common mistakes
- Choosing CAD by price only, then re-drawing every customer file.
- Trusting colourful FEA plots without mesh convergence and hand check ("garbage in, garbage out").
- Stress singularities at sharp corners treated as real peaks (they grow with every refinement).
- Checking only the CAM tool path, not the **G-code after the post** → post errors crash the machine.
- Buying cloud software for an offline factory PC.
- Many cores bought for a single-threaded CAD rebuild.
- No PDM → wrong file version goes to the machine.

## 14. Limits
- Ratings and price classes are estimates for orientation (Nov 2026); versions and company ownership change fast.
- Rules of thumb (RAM per DOF, CFD RAM, GPU speed-ups) depend on solver, element type and model – check
  with the maker's benchmark for your case.
- Formulas in §7.5 are the standard simplified cutting formulas; use tool-maker data for v_c, f_z, k_c.
- CAE never replaces tests for safety-related parts (pressure vessel approval, fatigue tests, guide 16).

## 15. Glossary
| Term | Meaning |
|---|---|
| AP242 | STEP standard (ISO 10303-242) for 3D models with PMI |
| CFD | Computational Fluid Dynamics – flow and heat simulation |
| CHT | Conjugate heat transfer – heat in solid + fluid together |
| DOF | Degrees of freedom – unknowns in FEA |
| FEA / FEM | Finite Element Analysis / Method |
| GD&T | Geometric Dimensioning and Tolerancing (ISO 1101, ASME Y14.5) |
| HPC | High-performance computing (many cores / cluster) |
| MBD / PMI | Model-Based Definition / Product Manufacturing Information |
| Post | Post-processor: tool path → machine-specific G-code |
| Surrogate | Fast AI / math model trained on simulation results |
| Topology optimisation | Computer removes material where it carries no load |
| VNCK | Virtual NC kernel – the real CNC software running on a PC |
