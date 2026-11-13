# 48 – Additive manufacturing (3D printing): technologies, metal LPBF process twin, industry map

> Tab **Additive manufacturing** (`#am`). Item 1 = technology map and process selector, item 2 = digital twin of a
> metal laser powder bed fusion (LPBF) production line, item 3 = industry map (where AM is really used in the world). **All numbers are example values** of the right size.
> Machine names are examples of a machine class, not a recommendation. Real parameters come from the machine maker's
> qualified parameter sets and your own test builds.

## Contents
1. Purpose · 2. Where in the twin · 3. Concepts · 4. Model + calculations · 5. Real-factory implementation ·
6. Checklists · 7. Common mistakes · 8. Limits · 9. Glossary

---

## 1. Purpose

You are new to additive manufacturing (AM). This guide and the tab answer four questions:

1. **What processes exist?** The 7 process families of ISO/ASTM 52900, how each works, what it costs.
2. **Where do real factories use them?** Well-known industrial cases (aero-engines, turbines, implants, tool shops, car plants, foundries).
3. **Where does AM pay in a compressor factory?** Jigs and fixtures first, then sand cores for prototype castings, conformal-cooled die inserts, spare parts, prototypes.
4. **How does a real metal AM production line run?** Item 2 follows one build from powder to a released, inspected part.

**Main rule:** use AM when the part gets *better* (lighter, inner channels, one part instead of many, no tooling, faster
to get). Do not use it to replace a cheap simple casting.

## 2. Where in the twin

| Item | What you see | Deep link |
|---|---|---|
| 1 Technology map | 7 family cards with schematic, data table, real uses, "for your factory"; process selector (score + reasons); where AM pays; digital thread of an AM factory | `/?amtech=bjt#am` |
| 2 LPBF process twin | inputs (part, material, machine class, orientation, parts per build, P, v, h, t, powder reuse, HIP); KPIs; 12 operations with player; live powder-bed camera + melt-pool + O2 charts while printing; 3D build chamber; 9 faults; build record; lot simulation (Cpk); calculations; equipment list; safety + standards | `/?amitem=2&ampart=insert&ammach=m400&amop=40&amu=0.5&amf=streak&show3d#am` |
| 3 Industry map | market tiles; revenue-share bar chart; field × process matrix; 16 fields with maturity; **dossier per field** (overview, applications, case studies with year / company / part / process / result, key numbers, standards + qualification, who prints / barriers / lesson); **sweet-spot chart** (parts per year vs value per part, log-log); **timeline** of first production per field; **applications catalogue** (50 applications, filter, search, CSV download); machine makers by process | `/?amitem=3&amind=aero&amdt=case#am` (amdt = ov, app, case, num, std, chain) |

Self test: add `&amtest` – the browser console prints PASS / FAIL lines (30 checks: formulas, nesting, every fault
is found, nominal lot yield ≥ 90 %).

Files: `web/am.js` (tab switch + item 1), `web/amind.js` + `web/amind_data.js` (item 3: page + data), `web/amlpbf_model.js` (pure model), `web/amlpbf.js` (item 2 page),
`web/am3d.js` (3D chamber, Three.js, offline), `web/am.css`.

## 3. Concepts

### 3.1 The 7 process families (ISO/ASTM 52900)

| Family | Principle | Typical use in industry |
|---|---|---|
| Powder bed fusion (PBF) | laser / electron beam melts powder layer by layer | metal: aero, turbine, implants, die inserts; polymer: jigs, small series |
| Directed energy deposition (DED) | nozzle feeds powder / wire into a melt pool | repair, cladding, large parts (WAAM) |
| Binder jetting (BJT) | print head jets binder into powder, then sinter / cast | sand cores + moulds for foundries; small metal parts in volume |
| Material extrusion (MEX) | hot nozzle draws plastic | jigs, fixtures, gauges, grippers next to the line |
| Vat photopolymerization (VPP) | UV light cures resin | fine prototypes, dental, casting patterns |
| Material jetting (MJT) | jets drops of several materials | multi-material / colour prototypes |
| Sheet lamination (SHL) | foils bonded and cut | niche (embedded sensors) |

### 3.2 How LPBF works
A recoater spreads a powder layer of 20–60 µm on a build plate. One or more lasers (200–1 000 W, spot ≈ 80–100 µm)
melt the cross-section of the parts. The plate goes down by one layer; new powder; repeat. The chamber is filled with
argon (O2 below ≈ 1 000 ppm) so the hot metal does not oxidise. A gas flow blows smoke and spatter away from the laser path.
Parts stand on **supports** that hold them, carry heat away and stop curling. After printing the parts are full of
residual stress → stress relief **before** they are cut from the plate.

### 3.3 Where the work really is
The printer is only ≈ 40–60 % of the work. Powder handling, build preparation, post-processing (depowder, stress relief,
cutting, supports, HIP / heat treatment, machining) and quality records decide if parts are good and the cost is right.

### 3.4 Where AM is really used in the world (item 3)

AM is still small: ≈ $20 billion per year (≈ 2023, market-report estimate) against roughly $15 trillion of world
manufacturing → ≈ 0.1–0.2 %. It grows ≈ 10–20 % per year. It wins in special fields, not everywhere.

| Maturity | Fields (examples of public cases) |
|---|---|
| **Series production** | aerospace (LEAP fuel nozzle tips, > 1 000 polymer parts on the A350, DED titanium parts on the 787), space (printed rocket chambers), medical implants (lattice hip cups since ≈ 2007), dental (aligner moulds, Co-Cr frames), hearing aids (almost all custom shells), tool + mould making (conformal cooling), foundry sand printing, jewellery patterns |
| **Growing** | automotive (prototypes, jigs, tooling, motorsport, classic spare parts), energy (turbine burner repair, qualified spare parts), industrial machinery (impellers, valve bodies, hydraulic manifolds), consumer (lattice midsoles, eyewear), rail / maritime / defence spare parts |
| **Pilot / niche** | electronics + electrification (copper induction coils, RF waveguides), construction (concrete houses) |
| **Research / hype** | printed organs, home printing instead of shopping, mass-produced printed cars |

Pattern: AM wins when parts are **unique** (dental, hearing aids, implants), **complex with high value** (aero, space,
turbines), **tools** (jigs, inserts, sand cores) or **spare parts without tooling**. It loses for simple parts in big numbers.
Approximate revenue share by sector (rounded; market reports differ): industrial machinery + tooling ≈ 17 %, aerospace +
space ≈ 16 %, medical + dental ≈ 15 %, automotive ≈ 14 %, consumer ≈ 11 %, academic ≈ 8 %, energy ≈ 6 %, electronics ≈ 5 %, other ≈ 8 %.

**Realistic road for a compressor maker:** FFF / MJF jigs and grippers → sand-printed cores for prototype castings (service
bureau) → printed spare parts + conformal-cooled inserts → own metal LPBF only with enough machine hours (item 2).

### 3.5 Key industrial cases (from the applications catalogue, item 3)

Years ≈ first series / flight / clinical use as publicly reported. Volumes and values in the app are order-of-magnitude estimates.

| Year | Field | Who | Part | Process / material | Result |
|---|---|---|---|---|---|
| ≈ 2001 | Hearing aids | all major makers | custom in-ear shells | VPP resin | whole industry switched in < 500 days (often cited) |
| ≈ 2002 | Dental | clear-aligner makers | aligner moulds | VPP (SLA) | hundreds of thousands of unique moulds per day |
| ≈ 2006 | Dental | dental labs | Co-Cr crown + bridge frames | PBF-LB/M Co-Cr | replaced lost-wax casting |
| ≈ 2007 | Medical | implant makers | acetabular cups with lattice | PBF-EB/M Ti6Al4V | bone ingrowth, no coating step |
| 2013 | Medical | Oxford Performance Materials | patient-specific cranial implant | PBF-LB/P PEKK | first FDA-cleared printed polymer implant |
| 2013 | Energy | Siemens Energy | gas-turbine burner tip repair | PBF-LB/M hybrid, Ni alloy | repair weeks instead of months |
| 2014 | Space | SpaceX | SuperDraco combustion chamber | PBF-LB/M Inconel | printed chamber flight-qualified |
| 2015 | Aerospace | GE Aviation | T25 sensor housing (GE90) | PBF-LB/M Co-Cr | first FAA-certified printed engine part |
| 2016 | Aerospace | CFM (GE / Safran) | LEAP fuel nozzle tip | PBF-LB/M Co-Cr | 20 parts → 1, 25 % lighter, > 100 000 made |
| 2016 | Automotive | VW Autoeuropa | jigs + fixtures | MEX | ≈ €325 000 saved in a year (reported) |
| 2016 | Medical | Stryker | Tritanium knee baseplate | PBF-LB/M Ti | dedicated AM plant (Cork) |
| 2016 | Rail | Deutsche Bahn | train spare parts | MEX, PBF, DED | "Mobility goes Additive" network, tens of thousands of parts |
| 2017 | Aerospace | Airbus | Ti bracket on series A350 | PBF-LB/M Ti6Al4V | first printed Ti part in A350 series |
| 2017 | Aerospace | Norsk Titanium / Boeing | 787 structural Ti parts | DED plasma wire | FAA approval, much less Ti machined away |
| 2017 | Space | Rocket Lab | Rutherford engine | PBF-LB/M | main engine parts printed |
| 2017 | Consumer | Adidas + Carbon | 4D lattice midsoles | VPP (DLS) | first large series of printed shoe parts |
| 2018 | Automotive | BMW | i8 Roadster window guide rail + roof bracket | MJF PA12 / PBF-LB/M Al | first BMW series printed parts |
| 2018 | Defence | US Navy | metal part on an aircraft carrier | PBF-LB/M | first installation |
| 2020 | Aerospace | GE Aviation | Catalyst turboprop | PBF-LB/M | 855 parts → 12 printed parts |
| 2020 | Automotive | Porsche + Mahle + Trumpf | 911 GT2 RS pistons (prototype) | PBF-LB/M Al | ≈ 10 % lighter, more power |
| 2020 | Energy | Westinghouse | thimble plugging device | PBF-LB/M 316L | printed part in a nuclear plant |
| 2021 | Automotive | GM / Cadillac | Celestiq | PBF-LB/M, PBF-LB/P | > 100 printed parts announced |

**Standards by field (orientation):** aerospace SAE AMS 7003 + AMS 7000 series, ASTM F3055 / F3302, FAA / EASA part
certification, AS9100 · space NASA-STD-6030, MSFC-SPEC-3717 · medical FDA AM guidance (2017), EU MDR, ISO 13485,
ASTM F2924 / F3001, ISO 10993 · dental ISO 22674, ISO 13485 · automotive IATF 16949, VDI 3405, DIN SPEC 17071 · energy
DNV-ST-B203, API 20S · machinery PED 2014/68/EU, EN 10204 3.1 · rail EN 45545 (fire), class-society rules for ships.

**Sweet spot (chart in item 3):** AM is used where parts are **expensive and few** (aero, space, energy, tooling:
< 50 000 parts/year, $1 000–100 000 each) or **cheap but all different** (dental, hearing aids, jewellery: millions
of parts, $1–20 each, every one unique). Big series of standard parts (≥ 100 000 identical parts) stay with casting,
moulding and stamping.

## 4. Model + calculations (item 2, example: gripper bracket, AlSi10Mg, single-laser 250 class)

### 4.1 Volumetric energy density
```
E = P / (v · h · t) = 370 / (1300 · 0.19 · 0.03) = 49.9 J/mm³      window AlSi10Mg ≈ 40 … 70 J/mm³
```
Too low E → lack-of-fusion pores (irregular, between tracks). Too high E → keyhole pores (round, deep unstable melt pool).
E is only a guide – the qualified parameter set decides.

### 4.2 Nesting and height
```
part box 120 × 80 × 60 mm, gap 12 mm, edge 8 mm → usable 234 mm → 1 × 2 = 2 parts on a 250 × 250 plate
build height H = 60 + 5 (supports) = 65 mm → layers = 65 / 0.03 = 2 167
```
On the quad-laser 400 class plate: 3 × 4 = 12 parts.

### 4.3 Build rate and time
```
ideal rate per laser = v · h · t = 1300 · 0.19 · 0.03 = 7.41 mm³/s = 26.7 cm³/h
real ≈ 70 % (contours, jumps, gas delays) = 18.7 cm³/h ;  multi-laser: n · 0.9
scanned volume = n · (V_part + 0.4 · V_support) = 2 · (95 + 0.4 · 17.1) = 204 cm³
exposure = 204 / 18.7 = 10.9 h ;  recoating = 2 167 · 9 s = 5.4 h
machine time = inerting 1.2 + preheat 0.5 + print 16.3 + cool 3 = 21.0 h
```
Recoating time depends only on the **height** → lay parts to reduce height, or fill the plate.

### 4.4 Powder
```
part mass = 95 cm³ · 2.67 g/cm³ = 0.25 kg ; supports 0.05 kg
loaded = plate area · (H + 10) · ρ · 0.55 packing · 1.3 margin ≈ 9 kg
used = build 0.60 kg · 1.03 + 3 % sieve loss of the load ≈ 0.89 kg → 0.89 · $75 = $66
```
Most loaded powder is sieved (63 µm) and reused. Track reuse count and oxygen content per lot.

### 4.5 Cost per part
```
machine rate = price / (years · h/year) + 8 %/year service = 650 000 / (6 · 6 000) + … = $26.7/h
machine 21.0 h · 26.7 = $562 · powder $66 · gas $19 · energy $16 · labour $365 · post $89 · plate $60
build $1 177 / 2 parts = $589 per part        (12 parts on the 400 class: ≈ $338 per part)
```
Machine hours dominate → more parts per build and high machine use make each part cheaper.

### 4.6 Compare with the conventional way
Conventional cost per part at quantity q = (tooling + piece · q) / q. Break-even: AM is cheaper below
q = tooling / (AM cost − piece cost). Example bracket: milled $95 per piece → AM is never cheaper; AM is chosen because
the gripper is 55 % lighter (faster robot). Example cylinder head prototype: pattern ≈ $9 000 → AM wins for a few prototypes.

### 4.7 Simulated quality (per build)
- porosity % = 0.06 + 40 · max(0, 0.88 − E/E₀)² + 18 · max(0, E/E₀ − 1.3)² (+ faults), HIP reduces it to ≈ 0.02–0.04 %
- density = 100 − porosity; largest pore from porosity; Ra from E and orientation; warp 0.35–0.6 mm if stress relief skipped
- UTS and elongation drop with porosity, O2 and powder oxygen

### 4.8 Faults and who finds them
| Fault | Effect | Starts | Found by |
|---|---|---|---|
| Dirty protective window (−25 % power) | lack of fusion | print (melt pool low) | CT, density |
| Wrong parameter set (speed −35 %) | keyhole pores, spatter | print (melt pool high) | CT |
| Recoater blade nick | streak defect line | print (powder-bed camera) | CT |
| Too few supports | curl, recoater crash | print (camera, recoater torque) | CMM |
| Door seal leak | O2 rises, oxidation | print (O2 sensor) | coupons |
| Filter clogged | spatter inclusions | print (gas flow / filter Δp) | CT |
| Powder reused too often | low elongation | powder (O analysis) | tensile coupon |
| Stress relief skipped | warp after cutting | – | CMM |
| Powder trapped in channels | blocked cooling channel | depowder (weighing) | CT + flow test |

## 5. Real-factory implementation

1. **Start without a machine:** buy parts from an AM service bureau (LPBF, MJF, sand printing). Learn design for AM
   (ISO/ASTM 52910, 52911-1) on 5–10 real parts: grippers, jigs, a conformal-cooled insert, a sand core.
2. **Buy cheap first:** FFF printers (PA-CF / ASA) for jigs and fixtures next to the line – pays back in weeks.
3. **Metal machine when** you have > 1 500 machine hours per year of metal parts, or confidential designs.
4. **Room:** separate AM room 20–24 °C, humidity < 50 %, argon supply, 400 V, ATEX zones around powder handling,
   powder store, class D extinguisher, O2 alarm, unpacking station, sieve, furnace, wire EDM or band saw, blasting.
5. **Qualification:** machine installation / operation / performance qualification (ISO/ASTM 52930), production site
   requirements (ISO/ASTM 52920), witness coupons in every build, CT on first parts, powder lot control (ISO/ASTM 52907).
6. **Digital thread:** MES job record with machine, parameter set, powder lot + reuse, O2 log, monitoring report,
   post-processing records, CT / CMM / coupon results; machine data via OPC UA / MTConnect.
7. **People:** AM engineer (DfAM, build preparation), operator (set-up, powder), post-processing technician, quality.

## 6. Checklists

**Before a build**
- [ ] Parameter set qualified for this machine + material + layer thickness
- [ ] Powder lot released (PSD, O content, flow, moisture), reuse count logged
- [ ] Orientation + supports reviewed; distortion simulation < 0.3 mm
- [ ] Plate machined and levelled; recoater blade checked; protective window clean; filter OK
- [ ] O2 below limit; plate preheated

**After a build**
- [ ] Monitoring report reviewed (melt pool, camera, O2, filter Δp)
- [ ] Stress relief done before cutting; channels depowdered (weigh the part)
- [ ] Coupons tested; CT / density; CMM; record complete; serials marked

## 7. Common mistakes
1. Printing parts that are cheaper to cast or mill (no design change for AM).
2. Cutting parts from the plate before stress relief → warp.
3. No control of powder reuse and oxygen → brittle parts.
4. Ignoring the metal powder explosion risk (Al, Ti) – no ATEX zoning, water extinguisher.
5. Too few supports to save time → curl → recoater crash → the whole build is lost.
6. Forgetting machining allowance and datum pads in the CAD.
7. Calculating only the machine cost – post-processing and quality are 30–60 % of the cost.

## 8. Limits
The model uses simple formulas with example numbers: real build time comes from the slicer, real porosity from test
cubes and CT, real costs from quotations. Machine classes are typical public sizes, not data sheets. The process
selector in item 1 is a first direction only.

## 9. Glossary
| Term | Meaning |
|---|---|
| AM | additive manufacturing (3D printing) |
| LPBF / PBF-LB/M | laser powder bed fusion of metals (also called SLM, DMLS) |
| Recoater | blade or roller that spreads each powder layer |
| Hatch distance h | distance between neighbouring laser tracks |
| E | volumetric energy density P / (v·h·t) |
| Supports | thin structures holding the part on the plate |
| HIP | hot isostatic pressing – high pressure + temperature closes inner pores |
| DfAM | design for additive manufacturing |
| PSD | particle size distribution of the powder (D10 / D50 / D90) |
| Conformal cooling | cooling channels that follow the tool surface |
| WAAM | wire arc additive manufacturing (DED with a welding arc) |
| ATEX | EU rules for explosive atmospheres (dust from metal powder) |
