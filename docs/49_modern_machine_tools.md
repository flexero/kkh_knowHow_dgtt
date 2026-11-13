# 49 – Modern machine tools: types, principles, trends and selection

> Tab **Machine tools** (`#mt`). Item 1 = 20 modern machine types, item 2 = 14 trends, item 3 = machines per compressor
> part + buying checklist. Values are **typical public ranges** of current machine classes (examples). Maker names are
> examples of companies that offer a type – not complete, not a recommendation. Always check the supplier's data sheet.

## Contents
1. Purpose · 2. Where in the twin · 3. Concepts · 4. Machine types · 5. Trends · 6. Selection for compressor parts ·
7. Buying checklist · 8. Common mistakes · 9. Limits · 10. Glossary

---

## 1. Purpose
Know which machine types exist today, how they work, what they are good for, which new developments matter, and how to
choose and buy machines for the compressor factory.

## 2. Where in the twin

| Item | Content | Deep link |
|---|---|---|
| 1 Machine types | category filter, cards with animated principle sketch, **animated 3D model** of the selected type (button "Show 3D model", `web/mt3d.js`, `&show3d`), detail (purpose, principle, components, values, parts, makers, meaning for you), comparison table | `/?mtt=millturn#mt` |
| 2 Trends | trend map (maturity vs impact), detail with "ask the supplier", table of all trends | `/?mtitem=2&mttr=conn#mt` |
| 3 For your factory | 8 compressor parts → route, key features, machine types (click → item 1); buying checklist with ticks (saved per PC) | `/?mtitem=3&mtp=crankshaft#mt` |

Files: `web/mt.js` (page + sketches), `web/mt3d.js` (3D models of all types), `web/mt_data.js` (data), `web/mt.css`. Standards named here are summarised in the **Standards** tab (`#std`).

## 3. Concepts
- **Axes:** linear X Y Z, rotary A (around X), B (around Y), C (around Z). 5-axis = 3 linear + 2 rotary.
- **3+2 vs simultaneous 5-axis:** 3+2 tilts the part, then cuts with 3 axes; simultaneous moves all 5 axes while cutting.
- **TCP / RTCP:** the CNC keeps the tool tip on the programmed path when rotary axes move.
- **Done-in-one:** finish a part in one machine and one set-up → fewer re-clamping errors and less WIP.
- **Accuracy vs repeatability:** accuracy = how close to the target; repeatability = how close to the same point again (ISO 230-2).
- **Thermal error:** the largest error of most machines – the machine grows when it warms up (ISO 230-3 test).

## 4. Machine types (item 1)

| Type | Purpose | Principle (short) | Typical values (examples) |
|---|---|---|---|
| 5-axis machining centre | complex parts in one set-up | X Y Z + tilting/rotary table, TCP | positioning ≈ 4–8 µm, rotary ≈ 3–5″ |
| HMC with pallet system | housings in volume | horizontal spindle, B-axis, APC / pallet pool | pallet 400–630 mm, chip-to-chip 2–3 s |
| Gantry 5-axis | very large parts | head on a bridge over a fixed table | travel 2–20 m |
| HSC vertical centre | fast finishing, moulds, Al | 20 000–42 000 rpm, look-ahead | 1–2 g, Ra < 0.4 µm |
| Vertical turning lathe / pick-up | big or self-loading round parts | part on horizontal table / spindle picks parts | Ø 200–3 000 mm |
| Turning centre (C + Y, driven tools) | round parts with milled features | turret with driven tools, sub spindle | bar Ø 42–102 mm |
| Swiss-type lathe | slender small precise parts | bar slides through a guide bushing | ± 2–5 µm |
| Mill-turn (multitasking) | complete complex parts | turning spindle + B-axis milling head | Ø 300–1 000 mm |
| Cylindrical / pin-chasing grinding | hardened shafts | CBN wheel follows the orbiting crank pin | roundness ≈ 0.5–2 µm |
| Honing | cylinder bores | rotate + stroke → cross-hatch, plateau honing | cylindricity ≈ 2–5 µm |
| Gear machines (skiving, hobbing, grinding) | gear teeth | synchronised cutter + work rotation | ISO 1328 class 3–7 |
| Fibre laser cutting | sheet + tube | focused beam + assist gas | 1–40 kW, ± 0.05–0.1 mm |
| Ultrashort-pulse laser | micro features, textures | 10⁻¹²–10⁻¹⁵ s pulses, cold ablation | 1–50 µm features |
| Wire / sinker EDM | hard materials, sharp corners | sparks erode in dielectric | ± 2–5 µm |
| Abrasive waterjet | cold cutting of any material | 4 000–6 000 bar + garnet | ± 0.1 mm |
| Hybrid additive + milling | build / repair + finish | DED or LPBF + spindle in one machine | DED 0.5–2 kg/h |
| Ultrasonic-assisted | ceramics, glass, CFRP | tool vibrates 20–50 kHz | force −30 … −50 % |
| Ultra-precision diamond | optics | air bearings, nm resolution | form < 0.1 µm |
| PKM / robot machining | deburring, drilling, trimming | parallel struts or robot + spindle | ± 0.1–0.3 mm |
| Friction stir welding | Al joining without melting | rotating pin stirs soft metal | Al 1–50 mm |

## 5. Trends (item 2)

| Trend | Principle | Typical gain | Ask the supplier |
|---|---|---|---|
| Digital twin + virtual commissioning | CNC kernel in software + 3D machine model | run-in on the machine −30 … −70 % | virtual machine of my exact machine? |
| Connectivity (OPC UA, umati, MTConnect) | standard data names for all makers (OPC 40501) | MES connection in days | umati server included? data points? |
| AI + adaptive control | sensors + models → feed / speed / offset correction | cycle time −5 … −20 % | which functions standard / option? |
| Automation, lights-out | robots, pallet pools, AMR, zero-point clamping | spindle hours 3 000 → 5 000–6 500 h/year | automation interface + references? |
| Multitasking | B-axis head, sub spindle, probes | lead time −50 … −80 % | complete part incl. measuring? |
| Hybrid additive | DED / LPBF + milling | repair, near-net | material data, powder safety? |
| Linear + torque motors | direct drive, no screw / gearbox | 1–2 g, no backlash | motor cooling, brakes? |
| Thermal stability | cooling, sensors, compensation, mineral casting | drift 20–30 µm → ≈ 5 µm / day | ISO 230-3 result over 8 h? |
| In-process measurement | probes, in-process gauges → offsets | scrap down, 100 % key sizes | probing software + MES output? |
| Energy efficiency | stand-by, regenerative drives, ISO 14955 | −20 … −40 % per part (claims) | energy data per program? |
| MQL / cryogenic / high-pressure coolant | aerosol, liquid CO2 / N2, 70–150 bar | MQL: no coolant system | spindle MQL-ready? |
| Cybersecurity | IEC 62443, Machinery Regulation 2023/1230, CRA | no malware stop | certificate, update process? |
| Smart HMI + conversational programming | app-based CNC, shop-floor programming | faster training | local language, offline station? |
| Remote service + predictive maintenance | condition data + remote access | downtime −20 … −50 % (claims) | which data leaves my plant? |

## 6. Selection for compressor parts (item 3)

| Part | Typical route (example) | Machine types | Key features |
|---|---|---|---|
| Crankcase | HMC rough + finish with pallet pool → wash → leak test | HMC, 5-axis, robot deburring | bearing bores ± 0.01 mm, deck flatness |
| Cylinder | turn / mill → fine bore → plateau honing | HMC, lathe, honing | bore ± 0.005 mm, cylindricity ≤ 5 µm |
| Crankshaft | mill-turn → oil holes → induction harden → pin-chasing grind → superfinish → balance | mill-turn, grinding, lathe | Ø ± 0.005 mm, roundness ≤ 2 µm |
| Connecting rod | face grind → bore → fracture split → bolt → finish bore + hone | HMC, honing | centre distance, parallelism ≤ 0.01 mm |
| Piston | oval / barrel profile turning (fast tool) → grooves → pin bore | lathe, HSC | skirt profile, grooves |
| Head / valve plate | mill faces + angled ports → seats + guides → leak test | 5-axis, HMC, HSC | seat concentricity, flatness |
| Air tank + frame | fibre laser → bend / roll → robot weld → pressure test (PED) | laser, waterjet | weld quality |
| Flywheel / pulley | pick-up vertical turning → balance | VTL, lathe | run-out, balance grade |

## 7. Buying checklist (item 3)
Accuracy (ISO 230-2 report of YOUR machine, ISO 10791 / ISO 13041 geometry, ISO 230-4 circular test, ISO 230-3 thermal) ·
capability (test cut of your part, Cpk ≥ 1.33, ISO 22514-3) · spindle (power / torque curve, taper, warranty) · control
(type, language, virtual machine) · connectivity (OPC UA + umati, MTConnect) · automation interface · safety (CE, Machinery
Regulation 2023/1230 from 2027, ISO 16090-1 / ISO 23125) · cybersecurity (IEC 62443) · energy (ISO 14955) · coolant + chips ·
service in your country · total cost of ownership over 10 years.

## 8. Common mistakes
1. Buying on catalogue accuracy instead of a test report and a test cut of your own part.
2. Different CNC makers on every machine → training and spare-parts cost.
3. No automation or OPC UA interface ordered → expensive retrofit later.
4. Forgetting fixtures, tooling and automation in the budget (often 30–60 % on top of the machine).
5. Ignoring service availability in your country.
6. Choosing a 5-axis machine where a simpler 3-axis + good fixture is enough (or the opposite for multi-face parts).

## 9. Limits
Typical values are public ranges of machine classes; real values depend on size, options and maker. Maturity and impact
ratings in item 2 are an engineering judgement for a machining plant, not a market study.

## 10. Glossary
| Term | Meaning |
|---|---|
| APC | automatic pallet changer |
| CBN | cubic boron nitride – superhard grinding material |
| DED / LPBF | directed energy deposition / laser powder bed fusion (see guide 48) |
| HSK / BT / CAT | tool taper standards |
| MQL | minimum quantity lubrication |
| OPC UA / umati | standard industrial data interface / its machine-tool companion specification |
| PKM | parallel-kinematic machine |
| RTCP / TCP | rotation tool centre point control |
| VTL | vertical turning lathe |
