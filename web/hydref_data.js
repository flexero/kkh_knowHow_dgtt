/* HYDRAULICS tab – data for the cards "Real components + drawings – catalogue examples" (hydref.js).
 * GENERATED from the guide tables – do not edit by hand; regenerate with gen_hyd.py.
 *   item 1: docs/29_hydraulic_elements_data.md §17 (13 families) + §18 element shopping list; drawings 25_* (method) + 29_* (elements)
 *   item 2: docs/30_hydraulic_circuits_sizing.md §20 (buy list per circuit, 20.1 – 20.11); drawings 30_* (circuits)
 *   item 3: docs/25_hydraulic_design_method.md §18 (buy list) + shopping lists 30 §21, 30 §22, 25 §19; drawings 30_sizing_flow + 25 duty cycle / HPU / losses
 * Row format: [item, required spec, example maker + model, key data, price class (estimate), check in the datasheet]
 * Makers and models are real catalogue EXAMPLES – data and prices change; ask the supplier for the current datasheet and a quote.
 */
export const ITEMS = {
 "1": {
  "guide": "guides 25 + 29",
  "drawings": [
   {
    "f": "25_design_method_flow.svg",
    "c": "12-step design method with the example job",
    "g": "guide 25 §6",
    "t": "12-step design method",
    "sec": "Method (guide 25)"
   },
   {
    "f": "25_duty_cycle_pq.svg",
    "c": "Duty cycle and p–Q diagram of the example job",
    "g": "guide 25 §7",
    "t": "Duty cycle + p–Q diagram",
    "sec": "Method (guide 25)"
   },
   {
    "f": "25_losses_heat.svg",
    "c": "Efficiency chain and energy per cycle of the example job",
    "g": "guide 25 §5",
    "t": "Losses, efficiency + heat",
    "sec": "Method (guide 25)"
   },
   {
    "f": "25_stiffness_natural_frequency.svg",
    "c": "Hydraulic stiffness and natural frequency of the example cylinder",
    "g": "guide 25 §4",
    "t": "Hydraulic stiffness + natural frequency",
    "sec": "Method (guide 25)"
   },
   {
    "f": "25_circuit_example_iso1219.svg",
    "c": "ISO 1219-2 circuit of the example job with option C",
    "g": "guide 25 §7",
    "t": "ISO 1219-2 circuit of the example job",
    "sec": "Method (guide 25)"
   },
   {
    "f": "25_hpu_layout.svg",
    "c": "HPU layout drawing – section and top view",
    "g": "guide 25 §13",
    "t": "HPU layout – section + top view",
    "sec": "Method (guide 25)"
   },
   {
    "f": "25_apc_clamp_circuit.svg",
    "c": "APC lift + zero-point release + table clamp circuit",
    "g": "guide 25 §14",
    "t": "APC lift + zero-point + table clamp circuit",
    "sec": "Method (guide 25)"
   },
   {
    "f": "29_symbol_legend.svg",
    "c": "ISO 1219-1 basic symbols – legend sheet",
    "g": "guide 29 §2",
    "t": "ISO 1219-1 symbol legend",
    "sec": "Elements (guide 29)"
   },
   {
    "f": "29_pump_types_section.svg",
    "c": "Pump types – sections of external gear, vane and axial piston pumps",
    "g": "guide 29 §4",
    "t": "Pump types – sections",
    "sec": "Elements (guide 29)"
   },
   {
    "f": "29_cylinder_section.svg",
    "c": "Mill-type cylinder – section with seals, cushioning and ISO 6099 mounting codes",
    "g": "guide 29 §6",
    "t": "Mill-type cylinder – section",
    "sec": "Elements (guide 29)"
   },
   {
    "f": "29_directional_valve_section.svg",
    "c": "4/3 spool valve NG6 – section in centre position and spool centre types",
    "g": "guide 29 §7",
    "t": "4/3 spool valve NG6 – section",
    "sec": "Elements (guide 29)"
   },
   {
    "f": "29_valve_dp_curves.svg",
    "c": "Valve Δp–Q curves NG6 … NG32 (example curves of §3 / §7.1)",
    "g": "guide 29 §7",
    "t": "Valve Δp–Q curves NG6 … NG32",
    "sec": "Elements (guide 29)"
   },
   {
    "f": "29_pressure_valves_section.svg",
    "c": "Pressure valves – direct and pilot-operated relief, reducing valve, counterbalance with pilot ratio",
    "g": "guide 29 §8",
    "t": "Pressure valves – sections",
    "sec": "Elements (guide 29)"
   },
   {
    "f": "29_check_lock_section.svg",
    "c": "Pilot-operated check with decompression stage and double pilot-operated check on a cylinder",
    "g": "guide 29 §10",
    "t": "Pilot-operated check valves",
    "sec": "Elements (guide 29)"
   },
   {
    "f": "29_accumulator_section.svg",
    "c": "Bladder accumulator section and accumulator safety block",
    "g": "guide 29 §12",
    "t": "Bladder accumulator + safety block",
    "sec": "Elements (guide 29)"
   }
  ],
  "groups": [
   {
    "id": "e17_1",
    "t": "Pumps",
    "src": "guide 29 §17.1",
    "rows": [
     [
      "External gear pump §4.1",
      "E1 option A: 14 cm³/rev (18.7 L/min at 1 450 rpm); E2: 4 cm³/rev (5.4 L/min)",
      "Bosch Rexroth AZPF (aluminium, F series); Casappa Polaris (PLP); Marzocchi ALP / GHP; Parker PGP (aluminium / cast-iron gear pumps)",
      "aluminium external gear, small sizes from ≈ 1–4 cm³/rev; continuous ≈ 17–25 MPa by size – see datasheet",
      "low",
      "continuous / peak pressure at your speed, min. speed, inlet pressure, shaft + flange (SAE / European 4-bolt), rotation, noise"
     ],
     [
      "Internal gear pump §4.2",
      "E1 alternative (quiet HPU, servo-pump drive)",
      "Bosch Rexroth PGF (medium pressure) / PGH (high pressure); Eckerle EIPC (check); Voith IPV; Sumitomo QT (check)",
      "low noise (≈ 55–65 dB(A)), low pulsation; pressure class by series – see datasheet",
      "low–medium",
      "noise at 1 450 rpm and your p, min. speed for servo drive, 4-quadrant use, inlet"
     ],
     [
      "Vane pump, fixed displacement §4.3",
      "– (option for quiet machine-tool HPU)",
      "Parker (Denison) T6 / T7; Danfoss (Vickers) V10 / V20, VQ; Atos PFE (check); Yuken PV2R (check)",
      "quiet, cartridge kit replaceable; pressure class by series – see datasheet",
      "low–medium",
      "min. speed (vanes must throw out), pressure vs viscosity, cartridge kit availability"
     ],
     [
      "Vane pump, variable §4.4",
      "–",
      "Bosch Rexroth PV7 (pilot-operated variable vane); Nachi VDR / VDS (check); Yuken variable vane (check)",
      "pressure-compensated, quiet, 16–21 MPa class – see datasheet",
      "medium",
      "compensator range, response time, case drain, noise"
     ],
     [
      "Axial piston pump, swash plate, fixed §4.5",
      "–",
      "fixed swash-plate pumps are rare in industry – usually a variable pump at max. angle or a bent-axis Rexroth A2FO / Parker F11 / F12 is used",
      "high pressure (bent axis ≈ 40 MPa class – see datasheet)",
      "medium–high",
      "as for bent axis"
     ],
     [
      "Axial piston pump, variable §4.6",
      "E1 option B: 18 cm³ class, pressure-compensated",
      "Bosch Rexroth A10VSO (sizes 18 / 28 / 45 / 71 / 100 / 140); Parker PV (from 16 cm³); Danfoss (Eaton Vickers) PVH / PVQ; Kawasaki K3VL (check)",
      "A10VSO nominal ≈ 28 MPa, peak ≈ 35 MPa; Parker PV ≈ 35 MPa – see datasheet",
      "medium–high",
      "control code, min. inlet pressure, case drain line to tank (below oil level), noise, shaft load"
     ],
     [
      "Pump controls §4.7",
      "E1 option B: pressure compensator (DR)",
      "Rexroth A10VSO controls DR (pressure), DFR (pressure + flow / load sensing), power control and electro-proportional versions (codes – see datasheet); Parker PV control codes (see catalogue)",
      "response times and setting ranges per control – see datasheet",
      "(part of the pump)",
      "response time (on-stroke / de-stroke), pressure range, LS pilot line, remote / electric command"
     ],
     [
      "Bent-axis piston pump / motor §4.8",
      "–",
      "Bosch Rexroth A2FO (fixed pump) / A2FM (fixed motor) / A6VM (variable motor); Parker F11 / F12; Danfoss (check series)",
      "high pressure ≈ 40 MPa class, high efficiency – see datasheet",
      "medium–high",
      "shaft + flange, case drain, min. speed, flushing"
     ],
     [
      "Radial piston pump §4.9",
      "clamping circuits (very small flow, high pressure)",
      "HAWE radial piston pumps R / RZ (check type); Moog RKP (variable radial piston); Bosch Rexroth PR4 (check)",
      "very high pressure, small flow (HAWE up to ≈ 70 MPa class – check) – see datasheet",
      "medium",
      "pressure vs flow per piston number, intake (flooded), noise"
     ],
     [
      "Screw pump §4.10",
      "–",
      "KRAL, Leistritz, Settima (check), IMO (check)",
      "very quiet (≈ 50–65 dB(A)), no pulsation – see datasheet",
      "high",
      "pressure class (often lower than piston pumps), viscosity range"
     ],
     [
      "Hand pump §4.11",
      "emergency release of a clamp / test",
      "Enerpac P-series hand pumps (70 MPa tools); HAWE hand pumps (check type); Hydac / Rexroth hand pumps (check)",
      "2-speed versions, small displacement per stroke – see datasheet",
      "low",
      "max pressure ≤ circuit rating (70 MPa tools!), reservoir volume, relief built in"
     ],
     [
      "Electric motor + bell housing + coupling",
      "E1-A 3 kW / E2 0.75 kW, 4-pole IE3, B5 / B35",
      "see guide 25 §18.3 (Siemens SIMOTICS GP, ABB, WEG W22); bell housings + jaw couplings KTR (ROTEX + bell housings), R+W, Raja-Lovejoy",
      "IE3 efficiency per IEC 60034-30-1 – see datasheet",
      "low",
      "flange size motor / pump, coupling torque at peak, damping ring (noise)"
     ]
    ]
   },
   {
    "id": "e17_2",
    "t": "Hydraulic motors",
    "src": "guide 29 §17.2",
    "rows": [
     [
      "Gear motor §5.1",
      "– (conveyors, fans, mixers)",
      "Bosch Rexroth AZMF; Casappa Polaris motors (PLM – check); Marzocchi ALM (check); Parker PGM (check)",
      "fixed, small, cheap; pressure class like gear pumps – see datasheet",
      "low",
      "external drain needed for reversing, start torque, min. speed"
     ],
     [
      "Gerotor / orbit motor §5.2",
      "§3 example: 200 cm³, 14 MPa → 379 N·m; 40 L/min → 180 rpm",
      "Danfoss OMM / OMP / OMR / OMS / OMT / OMV; Danfoss (Eaton) Char-Lynn (2000 / 4000 / 6000 series – check); Parker Torqmotor TB / TE / TF (check); M+S Hydraulic MR / MS (check)",
      "LSHT gerotor / roller-star; displacements ≈ 8–800 cm³ by series – see datasheet",
      "low–medium",
      "continuous vs intermittent torque / pressure, max. shaft side load, case / drain pressure, brake option"
     ],
     [
      "Vane motor §5.3",
      "–",
      "Parker (Denison) M5 vane motors (check); Danfoss (Vickers) 25M / 35M / 45M (check)",
      "smooth at medium speed – see datasheet",
      "low–medium",
      "start-up torque (springs under vanes), min. speed"
     ],
     [
      "Radial piston motor §5.4",
      "– (winches, rotating tables of big machines, mixers)",
      "Bosch Rexroth Hägglunds CA / CB / CBM (check series); Poclain Hydraulics MS / MK / MW series; Bosch Rexroth MCR; Kawasaki Staffa HMB / HMC",
      "very high torque at low speed, cam-lobe radial pistons – see datasheet",
      "high–very high",
      "torque at standstill (breakaway), speed range, displacement switching, brake, flushing"
     ],
     [
      "Axial piston motor, fixed / variable §5.5",
      "–",
      "Bosch Rexroth A2FM (fixed, bent axis) / A6VM (variable) / A10FM (check); Parker F11 / F12; Danfoss H1B (check)",
      "≈ 40 MPa class (bent axis) – see datasheet",
      "medium–high",
      "min. displacement, case drain, flushing valve, speed sensor"
     ],
     [
      "Motor brake §5.6",
      "–",
      "brakes integrated in the motor series (Poclain, Rexroth MCR, Danfoss OMR / OMS brake versions – check); separate negative multi-disc brakes (Bonfiglioli / Brevini – check)",
      "spring-applied, hydraulically released, release pressure – see datasheet",
      "low–medium",
      "release pressure vs your circuit (no back-pressure!), static torque, emergency release"
     ]
    ]
   },
   {
    "id": "e17_3",
    "t": "Cylinders, rotary actuators and machine-tool clamps",
    "src": "guide 29 §17.3",
    "rows": [
     [
      "Double-acting cylinder §6.1",
      "E1: bore 63 / rod 36 (or 45 for buckling, §3) × 200, cushions both ends; E2 lift: 63 / 36 × 60",
      "Bosch Rexroth CDT3 (tie-rod, ISO 6020-2, 16 MPa); Rexroth CDH1 / CDH2 (mill type – check pressure class); Parker HMI (ISO 6020-2 tie-rod); Parker HMD (ISO 6022, 25 MPa – check); Hänchen (servo / special cylinders); AHP Merkle (check)",
      "ISO 6020-2: 16 MPa, bores 25–200; ISO 6022: 25 MPa – see datasheet",
      "medium (63 × 200 standard)",
      "rod-side intensification 14.9 MPa ≤ rating, buckling table (rod 36 vs 45), cushion length, port size, sensor option"
     ],
     [
      "Single-acting cylinder and plunger cylinder §6.2",
      "– (presses, lifting tables)",
      "Enerpac RC (single-acting, spring return, 70 MPa tools); Roemheld block cylinders single-acting (check type); plunger cylinders from the cylinder makers above",
      "high-pressure tools 70 MPa class – see datasheet",
      "low–medium",
      "spring return force, max. pressure (70 MPa tools ≠ 10 MPa system!), side load"
     ],
     [
      "Telescopic cylinder §6.3",
      "–",
      "Hyva (tipper cylinders); Penta (check); Parker / special makers",
      "multi-stage, mostly single-acting – see datasheet",
      "medium–high",
      "extension order, stage areas, buckling at full stroke"
     ],
     [
      "Double-rod §6.4",
      "– (equal speed both ways, servo axes)",
      "double-rod versions of Rexroth CDT3 / CDH, Parker HMI, Hänchen servo cylinders",
      "equal areas – see datasheet",
      "medium–high",
      "rod sizes both ends, sensor through the rod (needs a hollow rod)"
     ],
     [
      "Cylinder construction: tie-rod, mill type, welded §6.5",
      "E1 tie-rod 16 MPa is just OK; ISO 6022 if peaks",
      "see the drawing at the start of §6 and the table in §6.5",
      "–",
      "–",
      "test pressure, fatigue rating ISO 10771-1"
     ],
     [
      "Cylinder mountings §6.6",
      "E1 front flange MF1 (shortest buckling length)",
      "mounting accessories from the cylinder maker: rod eyes ISO 8132, clevis brackets ISO 8133, spherical plain bearings (e.g. SKF GE series)",
      "–",
      "low",
      "K factor for your mounting, bearing play, alignment"
     ],
     [
      "End-position cushioning §6.7",
      "adjustable cushions both ends (option code)",
      "option of every series above (fixed / adjustable / self-adjusting)",
      "max. energy chart – see datasheet",
      "–",
      "cushion energy chart at 0.1 m/s and your mass, cushion length"
     ],
     [
      "Cylinder seals and rod surface §6.8",
      "PU standard (HLP 46, 0.1 m/s)",
      "Trelleborg (Turcon Stepseal, Zurcon – PTFE / PU); Freudenberg (Merkel); Parker seal division; SKF seals; Hallite",
      "see the material table in §6.8",
      "low (seal kit)",
      "material vs fluid and temperature, extrusion gap, surface of rod / bore"
     ],
     [
      "Cylinder position sensors §6.9",
      "inductive end switches (E2 1B1 / 1B2), optional in-cylinder sensor",
      "Balluff BTL (magnetostrictive); MTS Temposonics (R-series etc.); high-pressure inductive switches ifm, Balluff, Sick",
      "pressure-rated sensor tube, analog / SSI / IO-Link outputs – see datasheet",
      "low (switch) – high (in-cylinder)",
      "pressure rating, output type, hollow rod needed, EMC"
     ],
     [
      "Rotary actuators §6.10",
      "– (rotate a fixture, flip a part)",
      "Helac L10 / L20 / L30 (helical); Parker HTR rack-and-pinion (check); Micromatic (Rotac vane actuators – check); Roemheld rotary clamps (check)",
      "angle 90 / 180 / 360°, torque at 21 MPa class – see datasheet",
      "medium–high",
      "backlash, holding torque, cushioning, mounting load capacity"
     ],
     [
      "Clamping cylinders for machine tools §6.11",
      "E2: zero-point modules (release 5 MPa) + table clamp ring 5 MPa",
      "Roemheld (block cylinders, swing clamps, work supports); AMF – Andreas Maier (swing clamps, block cylinders, zero-point clamping); Hilma and Stark (Roemheld group: machine-table clamps, zero-point – check); Enerpac workholding (swing cylinders – check); Kosmek (check); zero-point also Schunk, Erowa (check: many are pneumatic release)",
      "clamping systems up to ≈ 50 MPa exist – check the max. pressure of each part; release pressure of zero-point modules – see datasheet",
      "low–medium per element",
      "max. and min. pressure, swing direction + angle, flow limit (swing clamps break if too fast!), position monitoring (air / inductive), cleanliness"
     ]
    ]
   },
   {
    "id": "e17_4",
    "t": "Directional valves",
    "src": "guide 29 §17.4",
    "rows": [
     [
      "Spool directional valve §7.1",
      "E1 / E2 1V1: 4/3 NG6, 24 V DC, ≥ 18.7 L/min",
      "Bosch Rexroth 4WE 6 (NG6) / 4WE 10 (NG10) / 4WEH 16–32 (pilot-operated); Parker D1VW (NG6) / D3W (NG10); Danfoss (Vickers) DG4V-3 (NG6); Atos DHI (NG6); Yuken DSG-01 (NG6); HAWE NG6 spool valves (check type)",
      "NG6 / ISO 4401-03: P, A, B ≈ 31.5–35 MPa, T lower (check), ≈ 60–80 L/min performance limit",
      "low (NG6) – medium (NG16+)",
      "spool symbol, T-port pressure, performance limit at your p, Δp curve, plug with LED + suppressor"
     ],
     [
      "Spool centre types §7.2",
      "E1 / E2: P blocked, A + B → T (float) – for the pilot-operated checks",
      "spool code of the series above (Rexroth example: E closed, J float, H open, G tandem – check the drawn symbol)",
      "see the table in the drawing at the start of §7",
      "(same valve)",
      "read the SYMBOL, not the letter; transition (crossover) symbol"
     ],
     [
      "Valve actuation: solenoid, manual, pilot, detent, monitoring §7.3",
      "24 V DC wet-pin, manual override",
      "solenoid options of the series above; plugs EN 175301-803 form A with LED + suppressor (Hirschmann type); spool-position monitoring (inductive switch option – check code)",
      "DC 25–35 W class – see datasheet",
      "low",
      "voltage tolerance, IP class with plug, override type (push / screw / detent), monitoring for safety functions"
     ],
     [
      "Seat §7.4",
      "E2 3V1: 3/2 seat valve, leak-free, NG6",
      "Bosch Rexroth M-SEW 6 / M-3SEW 6; HAWE seat valves (types G, WN / WH, NBVP – check); Sun / HydraForce poppet cartridges (check)",
      "leak-free, ≈ 31.5–42 MPa class, small flow (≈ 25 L/min class for NG6) – see datasheet",
      "low–medium",
      "rest position, flow at your Δp, \"zero leakage\" definition"
     ],
     [
      "Proportional directional valve §7.5",
      "– (option: soft start / stop)",
      "Bosch Rexroth 4WRE / 4WREE (OBE); Parker D1FB / D1FC (check which has OBE); Atos DHZO / DKZOR (check); HAWE PSL / PSV (proportional load-sensing)",
      "Q_N at Δp_N per edge, hysteresis, response – see datasheet",
      "medium–high",
      "Q_N definition (per edge or total), electronics (OBE vs card), cleanliness 16/14/11, fail-safe position"
     ],
     [
      "Servo valve §7.6",
      "– (closed-loop position / force)",
      "Moog G761 (flapper-nozzle); Moog D633 / D634 (direct drive); Bosch Rexroth 4WS2EM (check)",
      "very fast (bandwidth, ±0.1 % class) – see datasheet",
      "high",
      "rated flow at 7 MPa total Δp, frequency response, pilot filter, null leakage, cleanliness ≤ 15/13/10 class"
     ],
     [
      "Servo-proportional §7.7",
      "–",
      "Bosch Rexroth 4WRPEH (check size range); Parker D1FP (check); Atos DLHZO (check)",
      "zero-lap spool + OBE, high response – see datasheet",
      "high",
      "as for servo valves; fail-safe position at power off"
     ]
    ]
   },
   {
    "id": "e17_5",
    "t": "Pressure control valves",
    "src": "guide 29 §17.5",
    "rows": [
     [
      "Pressure relief valve – direct operated §8.1",
      "small flows, safety relief, pilot of bigger valves",
      "Bosch Rexroth DBD / DBDS (inline / cartridge / subplate); Sun Hydraulics RDDA / RDBA (check); HydraForce RV (check); Parker (check series)",
      "spring ranges in steps (e.g. 2.5 / 5 / 10 / 20 / 31.5 MPa), response 2–10 ms – see datasheet",
      "low",
      "lowest spring range that contains your setting, p–Q (override) curve, sealable"
     ],
     [
      "Pressure relief valve – pilot operated §8.2",
      "E1 0V1 10–11 MPa, E2 0V1 8.5 MPa, ≥ 20 L/min",
      "Bosch Rexroth DB / DBW (DBW with solenoid unloading); Sun RPEC (check); Parker R4V (check); Atos AGAM (check)",
      "flat curve (override 3–8 %), vent X – see datasheet",
      "low–medium",
      "setting range, vent / remote option, pilot drain internal / external"
     ],
     [
      "Proportional pressure relief valve §8.3",
      "– (variable clamp / press force)",
      "Bosch Rexroth DBET / DBEE (NG6 direct proportional), DBEM (pilot, check); Atos RZMO / AGMZO (check)",
      "p_min at zero command 0.5–1.5 MPa, hysteresis 1–3 % (without feedback) – see datasheet",
      "medium",
      "fail behaviour at power loss (goes to p_min!), a separate mechanical max. relief is still required"
     ],
     [
      "Pressure reducing valve §8.4",
      "E2 2V2 / 3V2: 5.0 MPa, ≤ 5 L/min, 3-way (relieving)",
      "Bosch Rexroth ZDR 6 DP (sandwich) / DR 6 DP (subplate) – check suffix; Rexroth DR 10 / DR 20 (pilot); Sun PRDB (reducing / relieving cartridge, check); HAWE CDK / ADM (check)",
      "3-way types relieve thermal rise; pilot flow adds leakage – see datasheet",
      "low",
      "reducing AND relieving, drain Y to tank, outlet range, pilot flow"
     ],
     [
      "Sequence valve §8.5",
      "– (clamp before work, sequence of 2 cylinders)",
      "Bosch Rexroth DZ (pilot) / DZ 6 DP (direct – check); Sun sequence cartridges (check series)",
      "external drain needed – see datasheet",
      "low",
      "drain, check valve for reverse flow, setting range"
     ],
     [
      "Counterbalance / overcentre valve §8.6",
      "E1 alternative to POC: setting 8.5 MPa, ratio 3:1 or 4:1, on the cylinder port",
      "Sun Hydraulics CB-series (e.g. CBCA / CBCG – ratio in the model code, check); Bosch Rexroth FD (counterbalance, flange / cartridge); HAWE LHK / LHDV (check); Oil Control (check)",
      "ratios 1.5:1 … 10:1, leakage ≈ 0 – see datasheet",
      "low–medium",
      "ratio vs load stability, setting ≥ 1.3 × load pressure, vented if back-pressure, line body for the cylinder"
     ],
     [
      "Brake valve for hydraulic motors §8.7",
      "– (hydraulic motors with overrunning loads)",
      "dual counterbalance in a line body: Sun, Rexroth FD dual (check), Oil Control (check)",
      "two counterbalance cartridges + shuttle for the brake – see datasheet",
      "low–medium",
      "as for counterbalance; brake release line"
     ],
     [
      "Unloading valve §8.8",
      "E2 0V5: pump unloading with accumulator (the guide uses a 2/2 solenoid valve + transmitter)",
      "Bosch Rexroth DA (pilot-operated unloading with check); Sun unloading cartridges (check)",
      "fixed or adjustable switching difference – see datasheet",
      "low–medium",
      "cut-in / cut-out difference, integrated check"
     ],
     [
      "Accumulator charging valve §8.9",
      "E2 alternative to 0V5",
      "HAWE accumulator charging valves (check type); Rexroth DA",
      "switching hysteresis – see datasheet",
      "low–medium",
      "hysteresis range, flow"
     ],
     [
      "Pressure switch §8.10",
      "E2 2S1 / 3S1: 4.5 MPa rising, PNP",
      "Hydac EDS 3000 (electronic with display); ifm PN; WIKA PSD-4 (check); mechanical piston switches Bosch Rexroth HED 8, Suco",
      "adjustable switch points + hysteresis, IO-Link options – see datasheet",
      "low",
      "accuracy, hysteresis, max. pressure, M12 connector, PL (safety) if used for safety"
     ]
    ]
   },
   {
    "id": "e17_6",
    "t": "Flow control valves",
    "src": "guide 29 §17.6",
    "rows": [
     [
      "Throttle / needle valve §9.1",
      "– (fine setting, gauge damping)",
      "Bosch Rexroth MG (inline throttle); Parker / Stauff / Hydac needle valves (check series)",
      "Q depends on Δp and viscosity – see datasheet",
      "low",
      "lockable adjustment, pressure rating, scale"
     ],
     [
      "Orifice – sharp-edged vs long throttle §9.2",
      "pilot-line orifices, switching-time orifices",
      "orifice plugs from the valve maker (e.g. P-port inserts); The Lee Company jet orifices",
      "Ø 0.5–2 mm class – see datasheet",
      "low",
      "dirt sensitivity, filter screen before small orifices"
     ],
     [
      "2-way pressure-compensated flow control valve §9.3",
      "speed independent of load: 18.7 L/min",
      "Bosch Rexroth 2FRM 6 / 2FRM 10; Sun / Parker compensated flow cartridges (check series)",
      "2FRM 6 flow ranges in steps (≈ 0.2 … 32 L/min class – see datasheet), Δp_min ≈ 0.6–1 MPa",
      "low–medium",
      "flow range around your set flow, temperature compensation, min. Δp"
     ],
     [
      "3-way §9.4",
      "– (fixed pump, saves heat vs 2-way)",
      "3-way (bypass / priority) flow cartridges: Sun, HydraForce, Bucher (check series)",
      "excess flow to tank at load pressure + Δp – see datasheet",
      "low–medium",
      "only ONE consumer per 3-way valve; priority flow range"
     ],
     [
      "One-way flow control §9.5",
      "E1 / E2 1V3: double throttle check sandwich NG6, meter-out",
      "Bosch Rexroth Z2FS 6 (sandwich, double); Rexroth MK (inline throttle check); Parker / Atos modular flow controls (check series)",
      "≈ 31.5 MPa, NG6 flow class ≈ 60–80 L/min – see datasheet",
      "low",
      "meter-in or meter-out orientation (turn the sandwich!), lockable knob"
     ],
     [
      "Meter-in, meter-out, bleed-off – comparison §9.6",
      "E1 meter-out (pulling loads)",
      "– (circuit choice, no product)",
      "–",
      "–",
      "–"
     ],
     [
      "Flow divider / combiner §9.7",
      "– (two cylinders in sync, ± few %)",
      "gear flow dividers: Casappa, Marzocchi (check series); spool divider / combiner cartridges: Sun, HydraForce (check series)",
      "accuracy ± 1–5 % class – see datasheet",
      "low–medium",
      "accuracy at your flow, end-of-stroke resynchronisation"
     ],
     [
      "Proportional flow control valve §9.8",
      "–",
      "Bosch Rexroth 2FRE 6 / 2FRE 10; Atos QVHZO (check)",
      "proportional 2-way compensated – see datasheet",
      "medium",
      "command signal, flow range, response"
     ]
    ]
   },
   {
    "id": "e17_7",
    "t": "Check and lock valves",
    "src": "guide 29 §17.7",
    "rows": [
     [
      "Check valve §10.1",
      "E2 0V2 (0.05 MPa) and 3V3",
      "Bosch Rexroth S 6 A / S 10 A (inline, cracking pressure in the code – check); Sun CXxx check cartridges (check); Hydac / Parker / Stauff inline checks",
      "cracking 0.05–0.5 MPa by spring – see datasheet",
      "low",
      "cracking pressure, Δp at flow, thread / port"
     ],
     [
      "Pilot-operated check valve §10.2",
      "E2 alternative on the cylinder port",
      "Bosch Rexroth SV / SL (subplate, line, with / without decompression); Sun pilot-to-open cartridges (CKCB – check); HAWE releasable checks (RH – check)",
      "pilot ratio ≈ 2.5–4:1, decompression versions ≈ 1:10–1:13 – see datasheet",
      "low",
      "ratio, decompression stage, internal / external drain"
     ],
     [
      "Double pilot-operated check §10.3",
      "E1 / E2 1V2: double POC sandwich NG6, ratio ≈ 3:1",
      "Bosch Rexroth Z2S 6 / Z2S 10; Atos HR modular checks (check); Parker sandwich POC (check series)",
      "NG6 ≈ 40–60 L/min class – see datasheet",
      "low",
      "ratio, mounting under the 4/3 valve (centre A, B → T!)"
     ],
     [
      "Shuttle valve §10.4",
      "– (brake release, LS signal)",
      "shuttle cartridges: Sun, HydraForce; inline shuttles: Parker, Hydac (check series)",
      "– see datasheet",
      "low",
      "flow, leakage between inlets"
     ],
     [
      "Prefill §10.5",
      "– (big presses, fast approach)",
      "Bosch Rexroth SF prefill valves (check); Bucher Hydraulics (check)",
      "big nominal sizes, pilot to open – see datasheet",
      "medium–high",
      "opening pilot pressure, decompression, size vs approach speed"
     ],
     [
      "Hose-rupture / pipe-break valve §10.6",
      "– (lifting platforms, vertical cylinders)",
      "pipe-rupture valves from Rexroth, Hydac, Parker (check series)",
      "closes above set flow – see datasheet",
      "low",
      "closing flow vs normal lowering flow (≥ 1.2–1.5 ×)"
     ],
     [
      "Load holding – POC vs counterbalance vs hose-break vs lowering brake §10.7",
      "E1 / E2: POC (load does not run away – throttled lowering)",
      "– (choice, see §10.7)",
      "–",
      "–",
      "–"
     ]
    ]
   },
   {
    "id": "e17_8",
    "t": "Cartridge valves",
    "src": "guide 29 §17.8",
    "rows": [
     [
      "Screw-in cartridge valves §11.1",
      "option: E2 clamp manifold with screw-in cartridges instead of NG6 stacks",
      "Sun Hydraulics (T-xA cavities); HydraForce (08 / 10 / 12 / 16 cavities); Bucher Hydraulics; Danfoss (Vickers, Comatrol cartridges); Parker, Bosch Rexroth cartridge ranges",
      "cavity standards: ISO 7789 or the maker's own – see datasheet",
      "low per cartridge",
      "cavity is maker-specific (Sun ≠ HydraForce!), forming tools, coil interchangeability"
     ],
     [
      "2-way slip-in cartridge §11.2",
      "– (flows ≥ 150 L/min, presses)",
      "Bosch Rexroth LC cartridges + LFA covers; Parker, Atos, Danfoss (check series)",
      "ISO 7368 cavity, NG16 … NG63 – see datasheet",
      "medium (per function)",
      "area ratio, cover function, pilot valve on the cover"
     ]
    ]
   },
   {
    "id": "e17_9",
    "t": "Accumulators and safety blocks",
    "src": "guide 29 §17.9",
    "rows": [
     [
      "Bladder accumulator §12.1",
      "E1-C: 5 L, p0 ≈ 7 MPa; E2: 2.5 L, p0 5.39 MPa",
      "Hydac SB330 (bladder, 33 MPa class); Parker / Olaer EHV; Bosch Rexroth HAB; EPE (check)",
      "p2/p0 ≤ 4, sizes ≈ 0.5–50 L – see datasheet",
      "low–medium",
      "PED category + declaration (5 L × 330 bar = 1 650 bar·L → cat. III), bladder material, gas valve, clamps"
     ],
     [
      "Piston accumulator §12.2",
      "– (big volumes, high ratio)",
      "Hydac piston accumulators (SK series – check); Parker piston accumulators (check series); Bosch Rexroth HAK (check)",
      "p2/p0 ≤ 10, position sensor option – see datasheet",
      "medium–high",
      "seal friction, gas leakage, position monitoring"
     ],
     [
      "Diaphragm accumulator §12.3",
      "small volumes in clamping circuits",
      "Hydac SBO; Bosch Rexroth HAD (check); Parker (Olaer) diaphragm (check)",
      "welded diaphragm, ratio ≤ 8 – see datasheet",
      "low",
      "refillable or not, thread"
     ],
     [
      "Accumulator sizing §12.4",
      "E1 4.2 L → 5 L; E2 1.74 L → 2.5 L",
      "maker sizing software (e.g. Hydac – check name)",
      "–",
      "–",
      "maker's real-gas correction above ≈ 20 MPa"
     ],
     [
      "Accumulator safety and shut-off block §12.5",
      "0V3: relief 10 MPa (E2) sealed, manual + solenoid discharge",
      "Hydac SAF10 / SAF20 / SAF32 (+ solenoid DSV option – check); Bosch Rexroth ABZSS (check); Parker (check series)",
      "type-tested relief (PED safety accessory), DN 10 / 20 / 32 – see datasheet",
      "low–medium",
      "relief setting ≤ PS, NO solenoid discharge, certificate"
     ],
     [
      "charging and gauging unit",
      "for p0 check every 6–12 months",
      "Hydac FPU (check type); Parker / Olaer charging kits",
      "–",
      "low",
      "gas valve thread of your accumulator"
     ]
    ]
   },
   {
    "id": "e17_10",
    "t": "Filtration, cooling, tank and HPU accessories",
    "src": "guide 29 §17.10",
    "rows": [
     [
      "Suction strainer / suction filter §13.1",
      "only if required (E2 25 L tank: none, use flooded inlet)",
      "MP Filtri STR strainers (check); Hydac / Argo-Hytos suction strainers (check series)",
      "100–150 µm, ≥ 2 × flow – see datasheet",
      "low",
      "Δp at cold start, bypass, vacuum indicator"
     ],
     [
      "Pressure filter §13.2",
      "only for proportional / servo valves",
      "Hydac DF / DFM; Parker 15P / 30P (check); Argo-Hytos HD (check); MP Filtri FHP (check); Donaldson pressure filters",
      "max. p ≥ relief; high-collapse element – see datasheet",
      "low–medium",
      "element collapse Δp, no bypass for servo, indicator"
     ],
     [
      "Return line filter §13.3",
      "0Z3: ≈ 40 L/min, 10 µm β10(c) ≥ 200, bypass 0.3 MPa",
      "Hydac RFM / RF (Betamicron elements); Argo-Hytos tank-top return filters (E 0xx – check); MP Filtri MPT / MPF (check); Donaldson; Parker tank-top filters",
      "glass-fibre elements rated to ISO 16889 – see datasheet",
      "low",
      "Δp clean at flow and 300 mm²/s, bypass setting, element availability"
     ],
     [
      "Off-line filter §13.4",
      "E2: flushing / filling cart; optional kidney loop",
      "Hydac OF5 / OLF and filter carts (check); C.C. Jensen (CJC) off-line filters; Argo-Hytos / Parker filter carts",
      "flow, fineness, water removal – see datasheet",
      "medium–high",
      "flow for flushing, water absorption"
     ],
     [
      "Tank breather filter §13.5",
      "0Z4: 3 µm",
      "Hydac BF / ELF; Des-Case (desiccant); Argo-Hytos, Parker, Stauff breathers",
      "air flow vs Δp – see datasheet",
      "low",
      "air flow ≥ max. oil volume change, desiccant in humid halls"
     ],
     [
      "Cleanliness: ISO 4406, β ratio, filter selection §13.6",
      "target 17/15/12 (E2), 18/16/13 (standard valves)",
      "particle counters Hydac FCU / CS, Parker icount, Argo-Hytos OPCom",
      "ISO 4406 output, ISO 11171 calibration – see datasheet",
      "high",
      "calibration, water sensor, online vs portable"
     ],
     [
      "Oil cooler §13.7",
      "E1 ≈ 0.13–0.15 kW/K (only if needed); E2: none",
      "Hydac OK-ELD / OK-EL (air / oil); AKG; Emmegi; water / oil brazed plate: Hydac HEX S (check), Alfa Laval, SWEP",
      "P01 curves vs oil flow – see datasheet",
      "low–medium",
      "P01 at your oil flow, oil-side Δp (bypass check!), noise, fan voltage"
     ],
     [
      "Tank heater §13.8",
      "cold halls only (< 10 °C start)",
      "tank immersion heaters (Hydac – check series; electric heater makers)",
      "surface load ≤ ≈ 1 W/cm² for oil (check) – see datasheet",
      "low",
      "surface load (oil cracking), thermostat, immersion depth at min. level"
     ],
     [
      "Hydraulic tank §13.9",
      "E1-A 63 L; E2 25 L",
      "complete tanks / power units: Bosch Rexroth ABPAC, Hydac, HAWE compact units (guide 25 §18.1); tank accessories: Stauff, Hydac, Elesa (sight glasses, filler caps, cleaning covers)",
      "–",
      "medium (tank)",
      "baffle, clean-out cover, drain, lid flatness for the motor-pump group"
     ],
     [
      "Level and temperature switches §13.10",
      "0S3: min. level + 60 °C alarm",
      "Hydac ENS / ETS; Hydac FSA / FSK sight glass with switch; ifm level / temperature sensors (check series)",
      "switching points, PT100 output – see datasheet",
      "low",
      "mounting (lid / wall), length, outputs"
     ]
    ]
   },
   {
    "id": "e17_11",
    "t": "Lines, hoses, fittings, manifolds, rotary unions",
    "src": "guide 29 §17.11",
    "rows": [
     [
      "Steel tube §14.1",
      "E1 pressure 15 × 2.5; E2 12 × 1.5, 16 × 2, 8 × 1",
      "EN 10305-4 tube (E235 / E355) from Salzgitter, Benteler, or system suppliers Parker, Voss, Stauff",
      "pressure table by OD × wall – see datasheet",
      "low",
      "pressure per size, zinc-nickel / phosphated surface, capped + clean"
     ],
     [
      "Hydraulic hose §14.2",
      "DN 10 / DN 12 to the machine, ≥ 11 MPa working, 4:1",
      "Parker 2SN (301SN) and compact hoses; Manuli 2SN / 2SC families; Gates MegaSys (M3K / MXT); Alfagomma (check)",
      "2SN DN 10 ≈ 33 MPa working – see datasheet",
      "low",
      "hose + fitting of the same system (crimp spec), bend radius, abrasion sleeve, whip restraint"
     ],
     [
      "Fittings: 24° cone §14.3",
      "L series 24° fittings, elastomer seal",
      "Parker EO / EO-2 (EO2-FORM); Voss 2S / VOSSFORM SQR; Stauff Connect; Hydac",
      "ISO 8434-1; L series small sizes ≈ 25–31.5 MPa – see datasheet",
      "low",
      "L vs S series, assembly tool, port thread ISO 1179 / ISO 6149"
     ],
     [
      "SAE flanges §14.4",
      "– (pump ports ≥ DN 20)",
      "SAE flanges code 61 / 62 (ISO 6162-1 / -2): Parker, Stauff, Hydac (check series)",
      "code 61 = standard, code 62 = high pressure – see datasheet",
      "low",
      "bolt size (metric / UNC), O-ring material"
     ],
     [
      "Quick couplings §14.5",
      "test / service connections, hose to moving fixtures",
      "flat-face (ISO 16028): Parker FF series, Faster, Stucchi; ISO 7241-A/B types",
      "– see datasheet",
      "low",
      "spill-free (flat-face), connect under pressure?, dust caps"
     ],
     [
      "Manifolds and subplates §14.6",
      "E2: NG6 stacks + cartridges on one block (guide 25 §19 pos. 25)",
      "subplates / manifolds from the valve makers (Rexroth, Parker, Hydac); custom manifolds: Sun, HydraForce, Daman, local machine shops",
      "aluminium for lower p / steel or ductile iron for high p – see datasheet",
      "medium",
      "ISO 4401 pattern, material vs pressure, test points, deburred + cleaned galleries"
     ],
     [
      "Rotary unions §14.7",
      "E2 0R1: oil 10 MPa + air passages to the turning table",
      "Deublin; Kadant (Johnson); GAT; Christian Maier (check series)",
      "passages, pressure, speed, leakage – see datasheet",
      "medium–high",
      "leakage drain port, max. speed and pressure together, number of passages, media separation"
     ],
     [
      "pipe clamps",
      "all tube runs",
      "Stauff (DIN 3015 type) clamps",
      "–",
      "low",
      "spacing, elastomer insert (noise)"
     ]
    ]
   },
   {
    "id": "e17_12",
    "t": "Sensors and test equipment",
    "src": "guide 29 §17.12",
    "rows": [
     [
      "Pressure transducer §15.1",
      "0B2: 0–16 MPa, 4–20 mA (§3: 12 mA = 125 bar at 0–250 bar)",
      "Hydac HDA 4000 (HDA 4400 / 4700); WIKA S-20 / A-10; Parker SensoControl SCP; ifm PT / PU; Danfoss MBS 3000",
      "accuracy ≈ ± 0.25–1 % FS by type, overload ≥ 2 × range – see datasheet",
      "low",
      "accuracy class, burst, pressure peaks (snubber), connector, IO-Link"
     ],
     [
      "Temperature sensor §15.2",
      "tank 60 °C alarm, PT100 for trend",
      "Hydac ETS (switch / transmitter); ifm TA (check); WIKA, Jumo PT100",
      "– see datasheet",
      "low",
      "immersion length, response time, output"
     ],
     [
      "Level sensors and sight glass §15.3",
      "min. level switch + sight glass",
      "Hydac ENS, FSA / FSK; Stauff level gauges (check series); Elesa sight glasses",
      "– see datasheet",
      "low",
      "length, switch points, material vs fluid"
     ],
     [
      "Flow meter §15.4",
      "pump test 5.4 / 18.7 L/min, case drain ≈ 0.3 L/min",
      "Webtec CT / FT (check); VSE VS gear flow meters; Kracht VC (check); Hydac EVS (check); Parker SensoControl SCQ (check)",
      "range, viscosity effect – see datasheet",
      "medium–high",
      "range covers both flows, viscosity correction, pressure rating"
     ],
     [
      "Test points §15.5",
      "0X1 test points at pump, accumulator, each actuator",
      "M16 × 2 test couplings: Hydrotechnik Minimess, Stauff Test, Parker, Hydac",
      "≈ 40–63 MPa class – see datasheet",
      "low",
      "thread to the port, caps, measuring hoses"
     ],
     [
      "Pressure gauge §15.6",
      "0S1: 0–10 MPa (E2), 0–16 MPa (E1), class 1.6",
      "WIKA 213.53 / 232.50 (glycerine filled); Stauff, Hydac gauges; gauge isolator valves",
      "range ≈ 1.5–2 × working p – see datasheet",
      "low",
      "range, snubber / damping, isolator"
     ],
     [
      "portable test kit (all)",
      "commissioning + maintenance",
      "Hydac HMG 4000 (data recorder); Parker SensoControl ServiceMaster; Webtec HPM (check)",
      "multi-channel, fast sampling – see datasheet",
      "high",
      "channels, sample rate, sensor set"
     ]
    ]
   },
   {
    "id": "e17_13",
    "t": "Hydraulic fluids",
    "src": "guide 29 §17.13",
    "rows": [
     [
      "Hydraulic fluid types §16.1 – HLP (mineral, DIN 51524-2)",
      "HLP 46 (or VG 32 if the clamp maker asks); E1 ≈ 72 L, E2 ≈ 29 L + flushing oil",
      "Shell Tellus S2 MX 46; Mobil DTE 25 (VG 46) / DTE 24 (VG 32); Fuchs Renolin B series (e.g. Renolin B 15 VG 46 – check the current name)",
      "ν40 ≈ 46 mm²/s, VI ≈ 98–110 – see datasheet",
      "low (per litre)",
      "DIN 51524-2, pump-maker approval (e.g. Rexroth RE 90235), seal compatibility, filterability"
     ],
     [
      "Hydraulic fluid types §16.1 – HVLP (wide temperature range)",
      "cold halls",
      "Shell Tellus S2 VX 46; Mobil DTE 10 Excel 46; Fuchs Renolin B 46 HVI (check)",
      "VI ≥ 140 – see datasheet",
      "low–medium",
      "shear stability"
     ],
     [
      "Hydraulic fluid types §16.1 – HFC / HFD (fire resistant)",
      "– (near furnaces, die casting)",
      "HFC water-glycol and HFD-U esters: Quaker Houghton (Houghto-Safe 620, Quintolubric 888 – check); Fuchs (Hydrotherm / Renosafe – check)",
      "pumps and seals must be approved for the fluid; often lower p and speed – see datasheet",
      "medium",
      "pump derating, seal material (no NBR with HFD), water content checks"
     ],
     [
      "Hydraulic fluid types §16.1 – HEES (biodegradable)",
      "– (outdoor, water protection)",
      "Panolin HLP Synth; Fuchs Plantosyn (check); Shell Naturelle HF-E (check)",
      "saturated synthetic esters – see datasheet",
      "medium",
      "water content control, seal compatibility, conversion flushing"
     ],
     [
      "Viscosity classes and temperature §16.2",
      "VG 32 / 46 so that 16–36 mm²/s in operation",
      "– (choice)",
      "see §16.2",
      "–",
      "–"
     ],
     [
      "Water content and oil analysis §16.3",
      "sample at commissioning + every 6–12 months",
      "oil-analysis services (e.g. OELCHECK, Shell LubeAnalyst, Mobil Serv – check); online water sensors (Hydac AquaSensor AS – check)",
      "ISO 4406, water ppm, viscosity, elements – see report",
      "low (per sample)",
      "test package, turnaround time, trend limits"
     ]
    ]
   }
  ],
  "shops": [
   {
    "title": "",
    "cols": [
     "Tag (guide 25 §19 pos.)",
     "Element type chosen (data page)",
     "Why this type – not the alternative",
     "Spec to send",
     "Buy-list row"
    ],
    "rows": [
     [
      "0P1 (3)",
      "External gear pump §4.1 4 cm³/rev",
      "average flow only 0.28 L/min, peak 14 L/min → smallest gear pump + accumulator; a variable piston pump is too big and too expensive",
      "4 cm³/rev, ≥ 10 MPa continuous, 1 450 rpm",
      "§17.1"
     ],
     [
      "0M1 + coupling (2, 4)",
      "electric motor 0.75 kW + bell housing (§17.1 last row)",
      "peak 0.79 kW for ≈ 5 s only; motor runs on, pump unloads (no motor starts)",
      "0.75 kW 4-pole IE3, B5, PTC",
      "§17.1"
     ],
     [
      "0V1 (5)",
      "Pressure relief valve – pilot operated §8.2 8.5 MPa",
      "flat curve: the relief must not open below the 7.5 MPa cut-out; a direct valve has 10–25 % override",
      "8.5 MPa, ≥ 10 L/min, sealable",
      "§17.5"
     ],
     [
      "0V5 (7)",
      "2/2 NO solenoid valve as unloading valve (instead of Unloading valve §8.8 / Accumulator charging valve §8.9)",
      "PLC switches with 0B2 → thresholds 6.0 / 7.5 MPa adjustable and visible in the twin",
      "NG6 or cartridge, 24 V DC, NO",
      "§17.4 / §17.5"
     ],
     [
      "0V2, 3V3 (6, 23)",
      "Check valve §10.1",
      "hold the accumulator / the clamp header when the pump unloads",
      "0.05 MPa cracking",
      "§17.7"
     ],
     [
      "0B2 (8)",
      "Pressure transducer §15.1 0–16 MPa, 4–20 mA",
      "analog value for pump control + diagnosis (better than a mechanical switch)",
      "0–16 MPa, 0.5 % FS class",
      "§17.12"
     ],
     [
      "0Z5 (9)",
      "Bladder accumulator §12.1 2.5 L, p0 5.39 MPa",
      "fast cycles, p2/p0 = 1.38 ≤ 4; a diaphragm type is too small, a piston type not needed",
      "2.5 L, PS ≥ 10 MPa class, PED cat. II (≈ 825 bar·L at 330 bar PS)",
      "§17.9"
     ],
     [
      "0V3 (10)",
      "Accumulator safety and shut-off block §12.5",
      "EN ISO 4413: automatic discharge at power off + safe isolation",
      "relief 10 MPa sealed, NO solenoid discharge",
      "§17.9"
     ],
     [
      "0Z3, 0Z4 (11, 12)",
      "Return line filter §13.3 + Tank breather filter §13.5",
      "target 17/15/12 for zero-point modules and rotary union; no pressure filter needed (no servo valves)",
      "10 µm β10(c) ≥ 200, bypass 0.3 MPa; breather 3 µm",
      "§17.10"
     ],
     [
      "0Z1, 0S3 (1, 13)",
      "Hydraulic tank §13.9 25 L + Level and temperature switches §13.10",
      "heat ≈ 0.07 kW average → no Oil cooler §13.7",
      "25 L, baffle, clean-out, min. level + 60 °C",
      "§17.10"
     ],
     [
      "0S1, 0X1 (14)",
      "Pressure gauge §15.6 + Test points §15.5",
      "local reading + test points for commissioning",
      "0–10 MPa class 1.6, M16 × 2",
      "§17.12"
     ],
     [
      "1V1 (15)",
      "Spool directional valve §7.1 4/3 NG6, centre Spool centre types §7.2 float (P blocked, A + B → T)",
      "float centre so the pilot-operated checks close; closed centre would trap pilot oil",
      "NG6, 24 V DC, Δp ≈ 0.08 MPa per path at 14 L/min",
      "§17.4"
     ],
     [
      "1V2 (16)",
      "Double pilot-operated check §10.3 sandwich NG6",
      "the lift load does not run away (throttled lowering) → POC is enough; a Counterbalance / overcentre valve §8.6 is the choice for running-away loads",
      "ratio ≈ 3:1, opens at ≈ 1.3 MPa",
      "§17.7"
     ],
     [
      "1V3 (17)",
      "One-way flow control §9.5 double, meter-out",
      "lowering = pulling load → meter-out; speed + soft stop",
      "Z2FS 6 class",
      "§17.6"
     ],
     [
      "1A1 (18)",
      "Double-acting cylinder §6.1 Ø63/36 × 60, End-position cushioning §6.7 both ends, Cylinder position sensors §6.9 1B1 / 1B2",
      "docs/09 machine design (6 MPa class)",
      "ISO 6020-2, MF1 or as the APC design",
      "§17.3"
     ],
     [
      "2V2, 3V2 (20)",
      "Pressure reducing valve §8.4 3-way (reducing / relieving) 5.0 MPa",
      "modules and clamp ring must never see 7.5 MPa; relieving takes thermal expansion",
      "5.0 MPa, drain to T",
      "§17.5"
     ],
     [
      "2V1 (21)",
      "3/2 spool or seat valve, spring return (Spool directional valve §7.1 / Seat §7.4)",
      "de-energised = A → T = modules clamped by springs (fail-safe)",
      "NG6 or cartridge, 24 V DC",
      "§17.4"
     ],
     [
      "3V1 (22)",
      "Seat §7.4 3/2 leak-free",
      "holds clamp pressure without leakage; de-energised = clamped",
      "NG6 seat valve, 24 V DC",
      "§17.4"
     ],
     [
      "2S1, 3S1 (24)",
      "Pressure switch §8.10 electronic",
      "step-chain conditions \"unclamped ≥ 4.5 MPa\", \"clamped ≥ 4.5 MPa\"",
      "4.5 MPa rising, PNP, display",
      "§17.5"
     ],
     [
      "manifold (25)",
      "Manifolds and subplates §14.6 (+ optional Screw-in cartridge valves §11.1)",
      "one block for the NG6 stacks: short lines, few leak points",
      "ISO 4401-03 patterns, steel or aluminium for 10 MPa",
      "§17.11"
     ],
     [
      "lines (26, 27)",
      "Steel tube §14.1, Fittings: 24° cone §14.3, Hydraulic hose §14.2",
      "header 12 × 1.5, return 16 × 2, branches 8 × 1 (guide 25 §14.7)",
      "EN 10305-4, ISO 8434-1 L, 2SN 4:1",
      "§17.11"
     ],
     [
      "0R1 (28)",
      "Rotary unions §14.7",
      "release oil to the turning table + air passages",
      "oil 10 MPa + air, leakage drain",
      "§17.11"
     ],
     [
      "2A1–2A4, 3A1",
      "Clamping cylinders for machine tools §6.11 zero-point modules + table clamp ring",
      "bought with the APC / table (docs/09, docs/12)",
      "release 5 MPa; max. pressure from the module datasheet",
      "§17.3"
     ],
     [
      "oil (29)",
      "Hydraulic fluid types §16.1 HLP 32 or 46",
      "as the clamp / rotary-union maker specifies",
      "DIN 51524-2, ≈ 30 L",
      "§17.13"
     ]
    ],
    "m": 1,
    "p": -1,
    "w": [
     10,
     20,
     30,
     25,
     15
    ]
   }
  ],
  "shopTab": "Shopping list – HPU + clamp system",
  "shopLbl": "shopping list",
  "shopTitle": "Element-level shopping list of the HMC power unit (example 2: APC lift + zero-point release + table clamp) – guide 29 §18. The priced list with quantities is guide 25 §19 (item-3 card).",
  "price": "Price classes (guides 25 / 29 / 30, single unit, order of magnitude): low < ≈ 300 € · medium ≈ 300 – 1 500 € · high ≈ 1 500 – 8 000 € · very high > 8 000 € – estimate, ask for a quote.",
  "shopNote": "Tags follow guide 25 §19; each row names the data page of the element type that was chosen and why.",
  "ph": "(e.g. gear pump, A10VSO, 4WE6, HYDAC, ISO VG 46)"
 },
 "2": {
  "guide": "guide 30",
  "drawings": [
   {
    "f": "30_lock_circuit.svg",
    "c": "Circuit 1 – hydraulic lock with double pilot-operated check valve, float centre, meter-out throttle and gauge points",
    "g": "guide 30 §5",
    "t": "Circuit 1 – hydraulic lock"
   },
   {
    "f": "30_counterbalance_circuit.svg",
    "c": "Circuit 2 – counterbalance valve on the cylinder port, pilot from the rod-side line, float centre",
    "g": "guide 30 §6",
    "t": "Circuit 2 – counterbalance"
   },
   {
    "f": "30_meter_in_out_bleed.svg",
    "c": "Circuit 3 – meter-in, meter-out and bleed-off side by side, with gauge points and the formula for each",
    "g": "guide 30 §7",
    "t": "Circuit 3 – meter-in / meter-out / bleed-off"
   },
   {
    "f": "30_sequence_reducing.svg",
    "c": "Circuit 4 – clamp branch with pressure reducing valve and pilot check, work branch with sequence valve, pressure switch option",
    "g": "guide 30 §8",
    "t": "Circuit 4 – sequence + reducing"
   },
   {
    "f": "30_regenerative.svg",
    "c": "Circuit 5 – regenerative extension with switch-over valve, check and pressure switch",
    "g": "guide 30 §9",
    "t": "Circuit 5 – regenerative"
   },
   {
    "f": "30_accumulator_unloading.svg",
    "c": "Accumulator supply with pump unloading for the guide-25 job: relief 11 MPa, pressure switch 10 / 8.1 MPa, 5 L accumulator, safety block",
    "g": "guide 30 §10",
    "t": "Circuit 6 – accumulator + unloading"
   },
   {
    "f": "30_motor_brake_valve.svg",
    "c": "Circuit 7 – orbit motor with brake (counterbalance) valve, cross-port reliefs, anti-cavitation checks and spring-applied brake",
    "g": "guide 30 §11",
    "t": "Circuit 7 – motor with brake valve"
   },
   {
    "f": "30_press_circuit.svg",
    "c": "Press 200 kN: prefill valve, decompression valve, counterbalance + two monitored safety valves in the rod line, variable pump with power limiter",
    "g": "guide 30 §14",
    "t": "Press 200 kN circuit"
   },
   {
    "f": "30_load_sensing.svg",
    "c": "Load-sensing system: LS variable pump, two pre-compensated valve sections, shuttle chain, LS bleed orifice, pressure cut-off",
    "g": "guide 30 §14",
    "t": "Load-sensing system"
   }
  ],
  "groups": [
   {
    "id": "c20_1",
    "t": "Circuit 1 – hydraulic lock",
    "src": "guide 30 §20.1",
    "rows": [
     [
      "Circuit 1 – hydraulic lock",
      "1V2/1V3 double pilot-operated check, NG6 sandwich, ratio ≈ 3:1, 10 MPa, 18.7 L/min",
      "Bosch Rexroth Z2S 6 (sandwich plate under the 4WE 6)",
      "ISO 4401-03 pattern, ≈ 31.5 MPa, pilot ratio – see datasheet",
      "low",
      "pilot ratio, decompression version, A/B or one-side version"
     ],
     [
      "Circuit 1 – hydraulic lock",
      "inline pilot check on the cylinder port",
      "Bosch Rexroth SV / SL (SL = with external drain port), sizes 10 / 20 / 30",
      "≈ 31.5 MPa, versions with decompression (pre-opening) – see datasheet",
      "low",
      "drain internal / external, decompression, thread / flange"
     ],
     [
      "Circuit 1 – hydraulic lock",
      "cartridge pilot-to-open check in a cylinder line body",
      "Sun Hydraulics pilot-to-open check cartridges (e.g. CKCB – check), HydraForce PO checks",
      "ratio ≈ 3:1 / 4.5:1 – see datasheet",
      "low",
      "cavity, ratio, seat leakage spec (drops/min)"
     ],
     [
      "Circuit 1 – hydraulic lock",
      "releasable check in clamping banks",
      "HAWE releasable check valves (type RH family – check)",
      "small sizes, leak-free – see datasheet",
      "low",
      "connection, ratio"
     ],
     [
      "Circuit 1 – hydraulic lock",
      "1V4 throttle check NG6 (meter-out)",
      "Rexroth Z2FS 6, Parker / Atos modular throttle checks (see catalogue)",
      "≈ 31.5 MPa, ≈ 60–80 L/min class",
      "low",
      "orientation (meter-out), lockable knob"
     ],
     [
      "Circuit 1 – hydraulic lock",
      "hose-rupture protection (lifting tables)",
      "Rexroth / Hydac / Parker pipe-rupture valves (check series)",
      "closes above a set flow – see datasheet",
      "low",
      "closing flow ≈ 1.3 × max lowering flow"
     ],
     [
      "Circuit 1 – hydraulic lock",
      "G3/G4 test points",
      "Hydac / Parker / Stauff Minimess-type M16×2 test couplings",
      "ISO 15171-1, ≈ 40 MPa",
      "low",
      "thread, cap, hose length"
     ]
    ]
   },
   {
    "id": "c20_2",
    "t": "Circuit 2 – counterbalance",
    "src": "guide 30 §20.2",
    "rows": [
     [
      "Circuit 2 – counterbalance",
      "1V2 CBV 8.2–8.3 MPa, ratio 3:1, ≥ 28 L/min, on the cylinder port",
      "Sun Hydraulics counterbalance cartridges CBCA / CBCG / CBEA (ratio is part of the model code) in a line body",
      "setting ranges, ratio 1.5 / 3 / 4.5 / 10:1 options – see datasheet",
      "low",
      "ratio code, spring range containing 8.2 MPa, vented (atmospherically referenced) option, body for cylinder mounting"
     ],
     [
      "Circuit 2 – counterbalance",
      "flange-mounted CBV with pilot check, larger cylinders",
      "Bosch Rexroth FD (sizes 12 / 16 / 25 / 32)",
      "≈ 31.5 MPa, flange on the cylinder – see datasheet",
      "low–medium",
      "size by flow, pilot ratio, secondary relief option"
     ],
     [
      "Circuit 2 – counterbalance",
      "lowering brake valves",
      "HAWE LHK / LHDV types (check), Bucher Hydraulics / HydraForce CBV cartridges",
      "see datasheet",
      "low",
      "as above"
     ],
     [
      "Circuit 2 – counterbalance",
      "pilot damping orifice 0.6–1.0 mm",
      "plug-in orifice / jet (Sun, HydraForce, Rexroth)",
      "–",
      "low",
      "removable for tuning"
     ]
    ]
   },
   {
    "id": "c20_3",
    "t": "Circuit 3 – speed control",
    "src": "guide 30 §20.3",
    "rows": [
     [
      "Circuit 3 – speed control",
      "1V2 2-way compensated flow valve, 8 L/min, Δp_min ≤ 1 MPa",
      "Bosch Rexroth 2FRM 6 (sub-plate) / 2FRM 10; Parker / Sun compensated flow cartridges",
      "flow ranges in steps (2FRM 6 up to ≈ 32 L/min class), temperature compensated – see datasheet",
      "low–medium",
      "flow range around 8 L/min, minimum Δp, reverse free-flow check"
     ],
     [
      "Circuit 3 – speed control",
      "meter-out throttle check sandwich NG6",
      "Rexroth Z2FS 6, Atos modular flow controls (see catalogue)",
      "≈ 31.5 MPa",
      "low",
      "meter-in / meter-out orientation"
     ],
     [
      "Circuit 3 – speed control",
      "inline throttle / throttle check",
      "Rexroth MG / MK (inline throttle / throttle check), Parker inline flow controls",
      "≈ 31.5 MPa – see datasheet",
      "low",
      "thread size, no compensation (only for constant loads)"
     ],
     [
      "Circuit 3 – speed control",
      "3-way compensated (bypass) flow valve",
      "Sun / HydraForce priority / bypass flow cartridges (check), Rexroth 3-way flow valves (check)",
      "see datasheet",
      "low–medium",
      "excess-flow port to tank, relief integrated?"
     ],
     [
      "Circuit 3 – speed control",
      "rod-side relief (intensification protection)",
      "Rexroth DBDS (direct relief cartridge / inline), Sun RDDA",
      "direct operated, fast – see datasheet",
      "low",
      "setting ≤ rod-side rating (16 MPa)"
     ]
    ]
   },
   {
    "id": "c20_4",
    "t": "Circuit 4 – sequence + reducing",
    "src": "guide 30 §20.4",
    "rows": [
     [
      "Circuit 4 – sequence + reducing",
      "1V2 reducing 5 MPa, sandwich NG6, relieving",
      "Bosch Rexroth ZDR 6 DP (sandwich) / DR 6 DP (sub-plate), DR 10 (pilot operated); Sun PRDB (reducing / relieving cartridge); HAWE CDK / ADM types (check)",
      "outlet ranges in steps (e.g. up to 2.5 / 7.5 / 15 / 21 MPa) – see datasheet",
      "low",
      "relieving function, drain (Y) to tank, pilot flow (adds leakage)"
     ],
     [
      "Circuit 4 – sequence + reducing",
      "2V1 sequence 6.5 MPa, with reverse check, external drain",
      "Rexroth DZ 6 DP (direct) / DZ 10 (pilot operated); Sun sequence cartridges (check series)",
      "≈ 31.5 MPa, check valve integrated option",
      "low",
      "external drain, reverse check, setting range"
     ],
     [
      "Circuit 4 – sequence + reducing",
      "1S1 pressure switch 4.5 MPa rising, PNP",
      "Hydac EDS 3000, WIKA PSD-4, Rexroth HED 8 (mechanical piston switch)",
      "adjustable switch points / hysteresis, display (electronic), IO-Link options – see datasheet",
      "low",
      "switch accuracy, hysteresis, max pressure, M12 connector"
     ],
     [
      "Circuit 4 – sequence + reducing",
      "1V3 pilot check",
      "as §20.1",
      "",
      "low",
      ""
     ]
    ]
   },
   {
    "id": "c20_5",
    "t": "Circuit 5 – regenerative",
    "src": "guide 30 §20.5",
    "rows": [
     [
      "Circuit 5 – regenerative",
      "1V2 regen valve NG6/NG10 + check B → A, 38.6 L/min",
      "Rexroth 4WE 10 (or 4WE 6 if inside its limit curve), check valve Rexroth S 10 (inline) / Z1S 10 (sandwich check)",
      "see datasheet",
      "low",
      "limit curve at 57.3 L/min in line A"
     ],
     [
      "Circuit 5 – regenerative",
      "1S1 pressure switch 8 MPa",
      "as §20.4",
      "",
      "low",
      ""
     ],
     [
      "Circuit 5 – regenerative",
      "Δp in line A at 57.3 L/min",
      "tube / hose one size larger",
      "§16.4",
      "low",
      "Δp ≤ 0.2 MPa"
     ]
    ]
   },
   {
    "id": "c20_6",
    "t": "Circuit 6 – accumulator supply with unloading",
    "src": "guide 30 §20.6",
    "rows": [
     [
      "Circuit 6 – accumulator supply with unloading",
      "0Z5 bladder accumulator 5 L, p0 6.97 MPa, ≥ 16 MPa",
      "Hydac SB330, Parker / Olaer EHV, Bosch Rexroth HAB",
      "33 MPa class, p2/p0 ≤ 4 (bladder) – see datasheet",
      "medium",
      "PED category + declaration, bladder material (NBR for HLP), clamps"
     ],
     [
      "Circuit 6 – accumulator supply with unloading",
      "0V3 safety + shut-off block, relief 12 MPa, manual + solenoid discharge",
      "Hydac SAF (SAF10 / SAF20), Rexroth / Parker equivalents (see catalogue)",
      "type-tested relief, NO solenoid discharge option",
      "low–medium",
      "relief certificate, solenoid discharge normally open"
     ],
     [
      "Circuit 6 – accumulator supply with unloading",
      "0V1 relief 11 MPa",
      "Rexroth DBDS (direct) or DB / DBW (pilot; DBW with solenoid unloading), Sun RPEC",
      "spring range containing 11 MPa",
      "low",
      "≥ 1.1 × cut-out, sealable"
     ],
     [
      "Circuit 6 – accumulator supply with unloading",
      "0V5 unloading 2/2 NO (energised = charge) or hydraulic unloading valve",
      "2/2 solenoid seat valve (Rexroth M-SEW family, HAWE seat valves – check type), or Rexroth DA (pilot-operated unloading with check, fixed hysteresis)",
      "leak-free seat; DA: hysteresis ≈ fixed % – see datasheet",
      "low",
      "rest position, leakage, hysteresis"
     ],
     [
      "Circuit 6 – accumulator supply with unloading",
      "0S2 pressure switch / transmitter 10 / 8.1 MPa",
      "Hydac EDS 3000, WIKA PSD-4, transmitter Hydac HDA / WIKA S-20 + PLC logic",
      "2 switch points, analog output – see datasheet",
      "low",
      "the PLC charging logic needs the analog value or 2 switch points"
     ],
     [
      "Circuit 6 – accumulator supply with unloading",
      "0V2 check valve pump outlet",
      "Rexroth S 6 / S 8 inline check, Sun check cartridges",
      "cracking 0.05 MPa",
      "low",
      "cracking pressure"
     ],
     [
      "Circuit 6 – accumulator supply with unloading",
      "charging / gauging kit",
      "Hydac FPU, Parker / Olaer charging kits",
      "for N₂ pre-charge checks",
      "low",
      "gas valve thread"
     ]
    ]
   },
   {
    "id": "c20_7",
    "t": "Circuit 7 – motor with brake valve",
    "src": "guide 30 §20.7",
    "rows": [
     [
      "Circuit 7 – motor with brake valve",
      "1A1 orbit motor 160 cm³/rev, 229 N·m at 10 MPa",
      "Danfoss OMR 160 / OMS 160, Eaton (Danfoss) Char-Lynn 2000 / 6000 series, Parker TG / TB (check)",
      "continuous / intermittent Δp and torque, max speed, case drain need – see datasheet",
      "low–medium",
      "shaft and flange, side load on the shaft, case drain / max return pressure"
     ],
     [
      "Circuit 7 – motor with brake valve",
      "1V2 brake valve (dual counterbalance) 9 MPa, 3:1, flange on the motor",
      "Sun dual counterbalance in a motor-flange body (check series), Bucher / Oil Control (Danfoss) motor brake valves (check)",
      "ratio options, setting range – see datasheet",
      "low–medium",
      "flange pattern = motor, ratio, setting"
     ],
     [
      "Circuit 7 – motor with brake valve",
      "1V3/1V4 cross-port reliefs 12 MPa",
      "cross-port relief blocks (Sun / HydraForce cartridges in a body)",
      "direct-operated, fast",
      "low",
      "setting below motor peak Δp"
     ],
     [
      "Circuit 7 – motor with brake valve",
      "1V5/1V6 anti-cavitation checks",
      "often in the same body (Sun / Bucher), or Rexroth S checks",
      "cracking 0.02–0.05 MPa",
      "low",
      "in the brake-valve body?"
     ],
     [
      "Circuit 7 – motor with brake valve",
      "1Y1 spring-applied brake 600 N·m, release 1.2 MPa",
      "orbit motors with integrated negative brake (check versions), or a separate multi-disc negative brake",
      "holding torque, release pressure – see datasheet",
      "medium",
      "release pressure < pilot while lowering (§11.1)"
     ]
    ]
   },
   {
    "id": "c20_8",
    "t": "Circuit 8 – supply / load sensing",
    "src": "guide 30 §20.8",
    "rows": [
     [
      "Circuit 8 – supply / load sensing",
      "variable pump, pressure compensator 10–21 MPa",
      "Bosch Rexroth A10VSO (controls DR = pressure, DFR = pressure + LS, DFLR = + power limiter), Parker PV (pressure / LS / power controls), Danfoss (Eaton Vickers) PVH",
      "sizes 18 / 28 / 45 / 71 …, ≈ 28 MPa nominal – see datasheet",
      "medium–high",
      "control code, response time, case drain, inlet pressure, noise"
     ],
     [
      "Circuit 8 – supply / load sensing",
      "LS directional valve bank (industrial / mobile)",
      "Danfoss PVG 32, Parker L90LS, HAWE PSL / PSV, Rexroth M4-12 / M4-15",
      "pre- or post-compensated (flow sharing), electric / hydraulic actuation – see datasheet",
      "medium–high",
      "compensator type, LS relief per section, max flow per section"
     ],
     [
      "Circuit 8 – supply / load sensing",
      "servo pump drive",
      "Rexroth Sytronix / CytroBox (check), Voith IPV internal gear pumps + servo drive, Siemens / Rexroth drives",
      "see datasheet",
      "high–very high",
      "minimum speed at pressure, holding mode, 4-quadrant"
     ]
    ]
   },
   {
    "id": "c20_9",
    "t": "Circuit 9 – synchronising + intensifier",
    "src": "guide 30 §20.9",
    "rows": [
     [
      "Circuit 9 – synchronising + intensifier",
      "1V2 gear flow divider 2 × 9.35 L/min, ± 2 %",
      "Casappa gear flow dividers (Polaris / Kappa based – check), Marzocchi gear flow dividers (ALP / GHP based – check), Dana Brevini / Salami dividers (check)",
      "accuracy ± 1–3 % by Δp, sections per shaft – see datasheet",
      "low–medium",
      "accuracy at our Δp (3 MPa), relief per outlet, max speed"
     ],
     [
      "Circuit 9 – synchronising + intensifier",
      "intensifier 10 → 25 MPa (or ratio 6.25 teaching)",
      "Minibooster HC2 / HC9 (oscillating), Roemheld pressure intensifiers (check type), AMF intensifiers (check)",
      "ratio, max output pressure, output flow – see datasheet",
      "medium",
      "ratio, input pressure range, integrated pilot check / return"
     ],
     [
      "Circuit 9 – synchronising + intensifier",
      "end-of-stroke re-sync valves",
      "cartridge relief / check combinations (Sun, HydraForce)",
      "see datasheet",
      "low",
      "–"
     ]
    ]
   },
   {
    "id": "c20_10",
    "t": "Press 200 kN – prefill, decompression, safety",
    "src": "guide 30 §20.10",
    "rows": [
     [
      "Press 200 kN – prefill, decompression, safety",
      "1V2 prefill valve ≥ 147 L/min at ≤ 0.05 MPa, pilot-opened for 88 L/min return",
      "Bosch Rexroth prefill valves (type SF – check), Parker prefill valves (check), Bucher (check)",
      "nominal size 40–50 mm class, pilot ratio – see datasheet",
      "medium",
      "flow at 0.05 MPa, pilot pressure to open against 17 MPa (decompression first!), mounting in the cylinder head / tank"
     ],
     [
      "Press 200 kN – prefill, decompression, safety",
      "main / logic valves for large flows",
      "Rexroth LFA 2-way cartridge (ISO 7368) + control covers, Parker CE / CV cartridges (check), Atos LI (check)",
      "NG16 – NG32 class – see datasheet",
      "medium",
      "cover function, area ratio, switching time"
     ],
     [
      "Press 200 kN – prefill, decompression, safety",
      "1V5/1V6 monitored safety valves (2 in series, Cat 3 / 4)",
      "Rexroth seat valves / 4WE with switching position monitoring (e.g. option \"QM…\" – check), Parker D1VW with spool monitoring (check), Atos valves with position switch for safety (option \"FV\" – check), tested press safety valve blocks (Rexroth / Bucher / Hydac – check)",
      "inductive position switch, B10d / MTTFd data for ISO 13849 – see datasheet",
      "medium–high",
      "safety data sheet (B10d), switch type (PNP, monitored), certificate for EN ISO 16092-3 use"
     ],
     [
      "Press 200 kN – prefill, decompression, safety",
      "1V3 CBV in the rod line 1.2–3 MPa",
      "as §20.2 (Rexroth FD, Sun CB…)",
      "low spring range",
      "low",
      "low setting range available"
     ],
     [
      "Press 200 kN – prefill, decompression, safety",
      "1V4 decompression 2/2 + orifice Ø 2–3.4 mm",
      "small 2/2 seat valve (Rexroth M-SEW family – check) + plug orifice, or SL valve with pre-opening",
      "see datasheet",
      "low",
      "orifice exchangeable"
     ],
     [
      "Press 200 kN – prefill, decompression, safety",
      "1B1 pressure transmitter 0–25 MPa, 4–20 mA",
      "Hydac HDA 4700, WIKA S-20",
      "accuracy ≈ 0.5 % class – see datasheet",
      "low",
      "range, response time, connector"
     ],
     [
      "Press 200 kN – prefill, decompression, safety",
      "1B2 position transducer 300 mm",
      "Balluff BTL, MTS Temposonics (magnetostrictive, in the cylinder)",
      "resolution µm class",
      "medium",
      "mounting in the rod, interface (SSI / analog)"
     ],
     [
      "Press 200 kN – prefill, decompression, safety",
      "two-hand control station type IIIC + safety relay / safety PLC",
      "stations from Schmersal / Bernstein / Pilz (check), relay Pilz PNOZ (two-hand types – check), safety PLC (Siemens F-CPU, Pilz PSS)",
      "EN ISO 13851 type IIIC, PL e – see datasheet",
      "medium",
      "type IIIC, synchronous actuation 0.5 s"
     ],
     [
      "Press 200 kN – prefill, decompression, safety",
      "light curtain (alternative)",
      "Sick deTec4, Keyence GL-R (check), Pilz PSEN opII (check)",
      "resolution 14 / 30 mm, PL e – see datasheet",
      "medium",
      "resolution → C in ISO 13855, response time"
     ]
    ]
   },
   {
    "id": "c20_11",
    "t": "Clamping, intensifier and fixture",
    "src": "guide 30 §20.11",
    "rows": [
     [
      "Clamping, intensifier and fixture",
      "clamping power unit with accumulator + pressure switch",
      "Roemheld clamping power units (check type), AMF hydraulic power units (check), HAWE compact power packs (HK / KA / MP families – check)",
      "small motors, tank a few litres, up to ≈ 50 MPa (radial piston) – see datasheet",
      "medium–high",
      "pressure, pressure switch, accumulator, valve bank"
     ],
     [
      "Clamping, intensifier and fixture",
      "clamping valve bank, zero-leak",
      "HAWE NSWP 2 spool valves / BVE seated valves in banks (check), Roemheld valve blocks",
      "see datasheet",
      "low–medium",
      "leak-free (seat) in the holding lines"
     ],
     [
      "Clamping, intensifier and fixture",
      "block cylinders / swing clamps",
      "Roemheld, AMF, Kosmek (check)",
      "25–50 MPa clamping elements – see datasheet",
      "low–medium",
      "force at our pressure, stroke, mounting"
     ],
     [
      "Clamping, intensifier and fixture",
      "pallet auto-coupling",
      "Roemheld coupling elements, AMF couplings (check), Hydac / Stäubli multi-couplings (check)",
      "self-sealing, coupling with residual pressure – see datasheet",
      "medium",
      "coupling force, chip protection, max pressure"
     ],
     [
      "Clamping, intensifier and fixture",
      "rotary union, N passages",
      "Deublin, GAT, Roemheld (check)",
      "passages, max speed, leakage (metal gap vs sealed) – see datasheet",
      "medium–high",
      "leakage per passage at our pressure, speed, temperature"
     ],
     [
      "Clamping, intensifier and fixture",
      "diaphragm accumulator 0.16 L on the pallet",
      "Hydac SBO",
      "high pressure ratio, small sizes – see datasheet",
      "low",
      "max pressure ≥ 25 MPa, gas valve"
     ]
    ]
   }
  ],
  "shops": [],
  "shopTab": "",
  "shopLbl": "",
  "shopTitle": "",
  "price": "Price classes (guides 25 / 29 / 30, single unit, order of magnitude): low < ≈ 300 € · medium ≈ 300 – 1 500 € · high ≈ 1 500 – 8 000 € · very high > 8 000 € – estimate, ask for a quote.",
  "shopNote": "",
  "ph": "(e.g. counterbalance, Sun, Rexroth, prefill, intensifier)"
 },
 "3": {
  "guide": "guides 25 + 30",
  "drawings": [
   {
    "f": "30_sizing_flow.svg",
    "c": "Sizing flow of item 3 with the numbers of the guide-25 job",
    "g": "guide 30 §15",
    "t": "Sizing flow of item 3"
   },
   {
    "f": "25_duty_cycle_pq.svg",
    "c": "Duty cycle and p–Q diagram of the example job",
    "g": "guide 25 §7",
    "t": "Duty cycle + p–Q diagram"
   },
   {
    "f": "25_hpu_layout.svg",
    "c": "HPU layout drawing – section and top view",
    "g": "guide 25 §13",
    "t": "HPU layout – section + top view"
   },
   {
    "f": "25_losses_heat.svg",
    "c": "Efficiency chain and energy per cycle of the example job",
    "g": "guide 25 §5",
    "t": "Losses, efficiency + heat"
   }
  ],
  "groups": [
   {
    "id": "m18_1",
    "t": "Hydraulic power units",
    "src": "guide 25 §18.1",
    "rows": [
     [
      "Hydraulic power units",
      "E2: 0.75 kW, 5.4 L/min, 7.5 MPa, 25 L, accumulator 2.5 L, 3 circuits",
      "HAWE compact hydraulic power packs (e.g. types HK / HC / KA / MP families) with HAWE valve banks",
      "compact units for machine tools and clamping, small motors, tank from a few litres – see datasheet",
      "medium–high",
      "pump size, tank volume, accumulator option, pressure switch, valve bank fits our 3 circuits"
     ],
     [
      "Hydraulic power units",
      "E1 option D / E2: compact unit with variable-speed drive",
      "Bosch Rexroth CytroPac (compact unit with frequency-controlled pump drive, integrated cooling)",
      "small tank (≈ 20 L class), motor power and max pressure – see datasheet",
      "high",
      "power vs our 0.75–3 kW, pressure, noise dB(A), integrated sensors, IO-Link / fieldbus"
     ],
     [
      "Hydraulic power units",
      "E1 option A: 3 kW, 18.9 L/min, 10 MPa, 63 L",
      "Bosch Rexroth ABPAC (modular standard power units)",
      "standard tank sizes, motor-pump groups, add-on valve plates – see datasheet",
      "high",
      "tank size, pump type, cooler, filter, valve plate pattern NG6"
     ],
     [
      "Hydraulic power units",
      "any: standard / custom units",
      "Parker hydraulic power units (compact and standard), Hydac power units (standard and custom)",
      "see datasheet",
      "medium–very high",
      "as above + documentation package (ISO 1219, EN ISO 4413, PED)"
     ]
    ]
   },
   {
    "id": "m18_2",
    "t": "Pumps",
    "src": "guide 25 §18.2",
    "rows": [
     [
      "Pumps",
      "E1-C / E2: fixed gear pump 4 cm³/rev, ≥ 10 MPa",
      "Bosch Rexroth AZPF (external gear, F series), Casappa Polaris / Kappa series, Marzocchi ALP / GHP series, Parker PGP (gear)",
      "external gear, small sizes from ≈ 1–4 cm³ upward; continuous pressure ≈ 17–25 MPa by size – see datasheet",
      "low",
      "smallest size, continuous / peak pressure, min. speed, inlet pressure, shaft + flange (SAE / European 4-bolt), noise"
     ],
     [
      "Pumps",
      "E1-A: fixed pump 14 cm³/rev, 10 MPa, quiet",
      "Bosch Rexroth PGF (internal gear), Parker PGP (gear), Eaton/Danfoss Vickers vane pumps (V10/V20, 20V/25V families)",
      "internal gear: low noise, ≈ 16–25 MPa by size; vane: quiet, ≈ 14–21 MPa – see datasheet",
      "low–medium",
      "noise at 1 450 rpm and 10 MPa, efficiency η_v at our viscosity, inlet conditions"
     ],
     [
      "Pumps",
      "B: variable pump, pressure compensated, 18 cm³ class",
      "Bosch Rexroth A10VSO 18 (axial piston, open circuit, DR / DFR controls), Parker PV016, Danfoss (Eaton Vickers) PVQ / PVH",
      "A10VSO: sizes 18 / 28 / 45 / 71 / 100 / 140, nominal ≈ 28 MPa, peak ≈ 35 MPa; Parker PV: sizes from 16 cm³, ≈ 35 MPa – see datasheet",
      "medium–high",
      "control type (DR pressure, DFR load sensing), response time, case drain line, min. inlet pressure, noise"
     ],
     [
      "Pumps",
      "D: servo pump drive",
      "internal gear pump (e.g. Rexroth PGF / PGH, Eckerle, Voith IPV) or axial piston pump + servo motor + drive",
      "start-stop and low-speed rated pump – see datasheet",
      "high–very high",
      "min. speed at pressure, 4-quadrant operation, pressure holding mode"
     ],
     [
      "Pumps",
      "clamping (very small flow, high pressure)",
      "radial piston pumps (e.g. HAWE R / RZ types)",
      "very high pressure, small flow – see datasheet",
      "medium",
      "–"
     ]
    ]
   },
   {
    "id": "m18_3",
    "t": "Electric motors",
    "src": "guide 25 §18.3",
    "rows": [
     [
      "Electric motors",
      "E1-C / E2: 0.75 kW, frame 80M, B5 / B35 (V1 vertical on the lid)",
      "Siemens SIMOTICS GP / SD (1LE1 series), ABB process / general performance (M3AA / M3BP families), WEG W22",
      "IE3 η ≥ 82.5 % (IEC 60034-30-1), ≈ 1 400 rpm, 400 V Δ / 690 V Y or 230/400 V",
      "low",
      "mounting (B5 flange for the bell housing, V1 position allowed?), thermistor (PTC), protection IP55, duty S1 / S3"
     ],
     [
      "Electric motors",
      "E1-A: 3 kW, frame 100L",
      "same series",
      "IE3 η ≥ 87.7 %, ≈ 1 430 rpm, rated torque ≈ 20 N·m",
      "low",
      "as above; starting current, soft starter or star-delta"
     ],
     [
      "Electric motors",
      "D: servo motor for a servo pump",
      "Siemens SIMOTICS S, Bosch Rexroth MS2N, etc.",
      "torque at low speed, cooling",
      "high",
      "standstill torque (pressure holding), encoder, drive"
     ]
    ]
   },
   {
    "id": "m18_4",
    "t": "Directional valves",
    "src": "guide 25 §18.4",
    "rows": [
     [
      "Directional valves",
      "E1 / E2 1V1: 4/3 NG6, centre P blocked, A + B → T, 24 V DC, ≥ 18.7 L/min",
      "Bosch Rexroth 4WE6 (spool symbol for this centre, e.g. \"J\" – read the symbol), Parker D1VW, Atos DHI, HAWE NG6 spool valves",
      "NG6 / ISO 4401-03: P, A, B ≈ 31.5–35 MPa, T lower (check), flow up to ≈ 60–80 L/min (performance limit curve) – see datasheet",
      "low",
      "spool symbol (centre!), T-port pressure limit, performance limit at our pressure, solenoid plug with LED + suppressor, manual override"
     ],
     [
      "Directional valves",
      "E2 3V1: 3/2 seat valve, leak-free, NG6",
      "Bosch Rexroth M-3SEW 6 (seat valve), HAWE seat valves (e.g. NBVP / G types), Sun / HydraForce cartridge poppet valves",
      "leakage-free poppet, ≈ 31.5–42 MPa, small flow (≈ 25 L/min class for NG6) – see datasheet",
      "low–medium",
      "leakage \"zero\" spec, rest position (P→A), flow at 4.4 L/min"
     ],
     [
      "Directional valves",
      "larger flows",
      "Rexroth 4WE10, Parker D3W, Atos DHU / DKE",
      "NG10: ≈ 100–120 L/min class",
      "low–medium",
      "–"
     ],
     [
      "Directional valves",
      "proportional (option)",
      "Rexroth 4WRE / 4WREE (with OBE), Parker D1FB / D1FC, Atos DHZO / DKZOR",
      "rated flow at Δp_N, hysteresis, bandwidth – see datasheet",
      "medium–high",
      "Q_N definition (Δp per edge or total), response, cleanliness 16/14/11"
     ]
    ]
   },
   {
    "id": "m18_5",
    "t": "Pressure valves",
    "src": "guide 25 §18.5",
    "rows": [
     [
      "Pressure valves",
      "0V1 relief: E1 10 / 11 MPa, E2 8.5 MPa, ≥ 20 L/min",
      "Bosch Rexroth DBDS (direct operated, inline / cartridge), Rexroth DB / DBW (pilot operated, DBW with unloading solenoid), Sun Hydraulics RDDA (direct) / RPEC (pilot) cartridges",
      "direct: fast, small flow; pilot: flat p–Q curve; spring ranges in steps (e.g. up to 5 / 10 / 20 / 31.5 MPa) – see datasheet",
      "low",
      "spring range containing our setting, override (p–Q curve), sealable adjustment"
     ],
     [
      "Pressure valves",
      "2V2 / 3V2 reducing 5.0 MPa, ≤ 5 L/min",
      "Bosch Rexroth DR6DP (NG6 sandwich / subplate, direct operated), Rexroth DR (pilot), Sun PRDB (reducing / relieving cartridge), HAWE CDK / ADM types",
      "3-way (relieving) types protect against thermal rise – see datasheet",
      "low",
      "reducing and relieving function, drain (Y) to tank, pilot flow (adds to the leakage!), outlet range"
     ],
     [
      "Pressure valves",
      "E2 0V5 unloading / accumulator charging",
      "Rexroth DA (pilot-operated unloading valve with check), HAWE accumulator charging valves (see catalogue), or a 2/2 solenoid valve + pressure transmitter (as drawn)",
      "switching hysteresis fixed or adjustable – see datasheet",
      "low–medium",
      "hysteresis (cut-in / cut-out) range, integrated check valve"
     ],
     [
      "Pressure valves",
      "pressure switches 2S1 / 3S1 / 0S2",
      "Hydac EDS 3000 (electronic pressure switch with display), mechanical piston switches (Rexroth HED, Hydac EDS / mechanical types)",
      "switching points + hysteresis adjustable, PNP outputs, IO-Link options – see datasheet",
      "low",
      "switching accuracy, hysteresis, max pressure, connector M12"
     ]
    ]
   },
   {
    "id": "m18_6",
    "t": "Flow valves",
    "src": "guide 25 §18.6",
    "rows": [
     [
      "Flow valves",
      "1V3 throttle check, meter-out, sandwich NG6 (double: A and B)",
      "Bosch Rexroth Z2FS 6 (double throttle check sandwich), Parker sandwich flow controls (series – see catalogue), Atos modular flow controls (see catalogue)",
      "adjustable throttle + free return check, ≈ 31.5 MPa, ≈ 60–80 L/min class",
      "low",
      "meter-in or meter-out mounting orientation, lockable adjustment"
     ],
     [
      "Flow valves",
      "pressure-compensated speed control",
      "Bosch Rexroth 2FRM 6 (2-way compensated flow valve), Parker / Sun compensated flow cartridges",
      "flow ranges in steps (e.g. 0.2 … 32 L/min for 2FRM 6 class – see datasheet), Δp_min ≈ 0.6–1 MPa",
      "low–medium",
      "flow range around our 18.7 L/min, temperature compensation, min. Δp"
     ]
    ]
   },
   {
    "id": "m18_7",
    "t": "Load holding: pilot-operated checks and counterbalance valves",
    "src": "guide 25 §18.7",
    "rows": [
     [
      "Load holding: pilot-operated checks and counterbalance valves",
      "1V2 double pilot-operated check NG6 sandwich (E2), ratio ≈ 3:1",
      "Bosch Rexroth Z2S 6 (sandwich), Rexroth SV / SL (inline pilot checks), HAWE releasable check valves (type RH family – check the catalogue)",
      "pilot ratio (often ≈ 2.5–3 : 1, decompression versions higher), cracking pressure – see datasheet",
      "low",
      "pilot ratio, decompression stage, internal / external drain, mounting under the 4/3 valve"
     ],
     [
      "Load holding: pilot-operated checks and counterbalance valves",
      "E1 1V2 alternative: counterbalance valve 8.3 MPa, ratio 3:1, on the cylinder port",
      "Sun Hydraulics CB-series counterbalance cartridges (e.g. CBCA / CBCG – pilot ratio is part of the model code), Bosch Rexroth FD (counterbalance valve) / cartridge versions, HAWE lowering brake valves (LHK / LHDV types – check)",
      "setting range, pilot ratio 3:1 / 4.5:1 / 10:1, vented / non-vented – see datasheet",
      "low–medium",
      "ratio (3:1 for this load), setting ≥ 1.3 × load pressure, vented if T back-pressure, line body for cylinder mounting"
     ],
     [
      "Load holding: pilot-operated checks and counterbalance valves",
      "hose-burst protection",
      "Rexroth / Hydac / Parker pipe-rupture valves",
      "closes above set flow – see datasheet",
      "low",
      "closing flow vs our lowering flow"
     ]
    ]
   },
   {
    "id": "m18_8",
    "t": "Accumulators and safety blocks",
    "src": "guide 25 §18.8",
    "rows": [
     [
      "Accumulators and safety blocks",
      "E1-C 0Z5: bladder 5 L, p0 6.97 MPa, ≥ 16 MPa",
      "Hydac SB330 (bladder, sizes ≈ 0.5–50 L, 33 MPa class), Parker / Olaer EHV bladder accumulators, Bosch Rexroth HAB",
      "max pressure (e.g. 33 MPa), max pressure ratio (≈ 4:1 for bladders), max flow of the oil valve – see datasheet",
      "medium",
      "PED category + declaration, gas valve type, bladder material for our oil (NBR for HLP), mounting clamps"
     ],
     [
      "Accumulators and safety blocks",
      "E2: bladder 2.5 L, p0 5.39 MPa",
      "Hydac SB330-2.5, Olaer EHV 2.5, Rexroth HAB 2.5",
      "as above",
      "low–medium",
      "as above"
     ],
     [
      "Accumulators and safety blocks",
      "small volumes (≤ 1–2 L), clamping circuits",
      "Hydac SBO diaphragm accumulators, Parker / Rexroth diaphragm types",
      "welded diaphragm types, high pressure ratio – see datasheet",
      "low",
      "not refillable / refillable gas side"
     ],
     [
      "Accumulators and safety blocks",
      "0V3 safety + shut-off block",
      "Hydac SAF (SAF10 / SAF20 / SAF32 sizes); equivalent blocks from Rexroth / Parker (see catalogue)",
      "shut-off ball valve, safety relief (TÜV / PED type-tested), manual + optional solenoid discharge – see datasheet",
      "low–medium",
      "relief setting ≤ accumulator max, type test certificate, solenoid discharge NO for auto-discharge"
     ],
     [
      "Accumulators and safety blocks",
      "charging and gauging unit",
      "Hydac FPU, Parker / Olaer charging kits",
      "for nitrogen pre-charge checks",
      "low",
      "thread of the gas valve"
     ]
    ]
   },
   {
    "id": "m18_9",
    "t": "Filters",
    "src": "guide 25 §18.9",
    "rows": [
     [
      "Filters",
      "0Z3 return filter tank-top, ≈ 40 L/min, 10 µm β10(c) ≥ 200, bypass ≈ 0.3 MPa, electric indicator",
      "Hydac RFM / RF with Betamicron (BN4HC) elements, Parker tank-top return filters with Microglass III media, Donaldson return filters with Synteq XP media, Argo-Hytos tank-top return filters (E 0xx families) with EXAPOR MAX media",
      "glass-fibre elements rated to ISO 16889 (β(c) values), Δp curves vs flow and viscosity – see datasheet",
      "low",
      "Δp clean at 18.7 L/min and 300 mm²/s cold start, bypass setting, dirt holding capacity, element availability"
     ],
     [
      "Filters",
      "pressure filter (only for proportional / servo valves) 5 µm β ≥ 1 000, no bypass",
      "Hydac DF / DFM, Parker 15P / 30P families, Argo-Hytos HD, Donaldson pressure filters",
      "max pressure ≥ relief, high-collapse element (Δp collapse ≥ system pressure) – see datasheet",
      "low–medium",
      "collapse rating, indicator, element without bypass"
     ],
     [
      "Filters",
      "0Z4 breather 3 µm",
      "Hydac BF / ELF (filler breathers), Parker, Argo-Hytos, Des-Case (desiccant)",
      "air flow vs Δp – see datasheet",
      "low",
      "air flow ≥ max oil volume change (e.g. 18.7 L/min), desiccant for humid shops"
     ],
     [
      "Filters",
      "off-line filter / filter cart for filling and flushing",
      "Hydac OF5 / OLF, FCU particle counter carts; Parker / Argo-Hytos filter carts",
      "flow, fineness – see datasheet",
      "medium–high",
      "flow for flushing (37–87 L/min for ID 10 lines, §10.5)"
     ]
    ]
   },
   {
    "id": "m18_10",
    "t": "Coolers",
    "src": "guide 25 §18.10",
    "rows": [
     [
      "Coolers",
      "air/oil cooler, P01 ≈ 0.13 kW/K (only if needed, §9.3)",
      "Hydac OK-ELD (air/oil, AC motor fan), Hydac OK-EL, AKG, Emmegi, Thermal Transfer Products",
      "P01 curves vs oil flow, Δp oil side, noise dB(A) – see datasheet",
      "low–medium",
      "P01 at our oil flow, Δp oil side (bypass check!), fan voltage, dust in the shop"
     ],
     [
      "Coolers",
      "water/oil plate cooler",
      "Hydac HEX S (brazed plate), Alfa Laval / SWEP brazed plate, shell-and-tube types",
      "P at water 25 °C, water flow (≈ 7.9 L/min for 2.76 kW at 5 K)",
      "low",
      "material vs water quality, double-wall option, oil-side Δp"
     ]
    ]
   },
   {
    "id": "m18_11",
    "t": "Sensors and measurement",
    "src": "guide 25 §18.11",
    "rows": [
     [
      "Sensors and measurement",
      "0B2 pressure transmitter 0–16 MPa, 4–20 mA",
      "Hydac HDA 4000 series (HDA 4400 / 4700), WIKA S-20 / A-10, Parker SensoControl SCP sensors, ifm PT series",
      "accuracy ≈ ± 0.25–1 % FS by type, overload ≥ 2 × range – see datasheet",
      "low",
      "accuracy class, overload / burst, pressure peaks (snubber), connector, IO-Link"
     ],
     [
      "Sensors and measurement",
      "pressure switches",
      "Hydac EDS 3000, ifm PN, WIKA PSD",
      "see §18.5",
      "low",
      "–"
     ],
     [
      "Sensors and measurement",
      "temperature + level",
      "Hydac ENS / ETS level and temperature sensors, Hydac FSA/FSK sight glasses",
      "switching points, PT100 output – see datasheet",
      "low",
      "tank wall / lid mounting, length"
     ],
     [
      "Sensors and measurement",
      "gauges",
      "WIKA 213.53 / 232.50 (glycerine filled), Hydac / Stauff gauges",
      "class 1.0–1.6, range ≈ 1.5–2 × working pressure",
      "low",
      "range 0–16 MPa (E1), 0–10 MPa (E2), snubber, gauge isolator"
     ],
     [
      "Sensors and measurement",
      "test points",
      "M16×2 test couplings (Minimess-style: Hydrotechnik, Stauff, Parker, Hydac)",
      "≈ 40–63 MPa class – see datasheet",
      "low",
      "thread to the port, protective caps"
     ],
     [
      "Sensors and measurement",
      "cylinder position sensors",
      "inductive proximity switches (end positions), magnetostrictive in-cylinder sensors (MTS Temposonics, Balluff BTL)",
      "see datasheet",
      "low–high",
      "pressure rating of the sensor tube, output"
     ]
    ]
   },
   {
    "id": "m18_12",
    "t": "Hoses, tubes and fittings",
    "src": "guide 25 §18.12",
    "rows": [
     [
      "Hoses, tubes and fittings",
      "hoses DN 10 / DN 12, ≥ 11 MPa working, 4:1 safety",
      "Parker 2SN hoses (e.g. 301SN) and compact hoses, Manuli 2SN / 2SC families, Gates MegaSys (e.g. M3K / MXT)",
      "working pressure by DN (2SN DN 10 ≈ 33 MPa – see datasheet), bend radius, temperature",
      "low",
      "hose + fittings of the same system (crimp spec), bend radius, abrasion sleeve, whip restraints"
     ],
     [
      "Hoses, tubes and fittings",
      "steel tube 15×2.5, 18×2, 16×2, 12×1.5, 8×1 (EN 10305-4, E235 / E355, zinc-nickel or phosphated)",
      "tube from Parker, Voss, Stauff, Salzgitter / Benteler (EN 10305-4 stock)",
      "pressure tables by OD × wall – see datasheet",
      "low",
      "max pressure per size, surface protection, cleanliness (capped, pickled)"
     ],
     [
      "Hoses, tubes and fittings",
      "24° cone fittings, elastomeric seal, L series",
      "Parker EO / EO-2 (EO2-FORM), Voss 2S / VOSSFORM SQR, Stauff, Hydac",
      "ISO 8434-1, L series up to 15 mm tube ≈ 25–31.5 MPa – see datasheet",
      "low",
      "L vs S series, assembly method (pre-assembly tool / forming machine), port thread ISO 1179 / 6149"
     ],
     [
      "Hoses, tubes and fittings",
      "clamps",
      "Stauff (DIN 3015 type) pipe clamps",
      "–",
      "low",
      "spacing, elastomer inserts for noise"
     ]
    ]
   },
   {
    "id": "m18_13",
    "t": "Test and service equipment",
    "src": "guide 25 §18.13",
    "rows": [
     [
      "Test and service equipment",
      "portable data recorder (pressure, temperature, flow)",
      "Hydac HMG 4000 / HMG 510, Parker SensoControl ServiceMaster (SCM series)",
      "multi-channel, fast sampling for pressure peaks – see datasheet",
      "high",
      "number of channels, sampling rate, sensors included"
     ],
     [
      "Test and service equipment",
      "flow meter / hydraulic tester (pump test, case drain)",
      "Webtec hydraulic testers (HPM / DHT) and flow meters (CT / FT families), Hydac EVS, Parker SensoControl flow turbines",
      "flow range, max pressure, loading valve for pump tests – see datasheet",
      "medium–high",
      "range covers 0.3 L/min (case drain) and 20 L/min (pump), viscosity correction"
     ],
     [
      "Test and service equipment",
      "particle counter (portable / online)",
      "Hydac FCU / CS series, Parker icount, Argo-Hytos OPCom",
      "ISO 4406 output – see datasheet",
      "high",
      "calibration ISO 11171, water sensor"
     ],
     [
      "Test and service equipment",
      "nitrogen charging kit",
      "Hydac FPU, Parker / Olaer",
      "gas valve adapters",
      "low",
      "–"
     ]
    ]
   },
   {
    "id": "m18_14",
    "t": "Hydraulic fluids",
    "src": "guide 25 §18.14",
    "rows": [
     [
      "Hydraulic fluids",
      "HLP 46 (DIN 51524-2), VI ≈ 100+",
      "Shell Tellus S2 MX 46, Mobil DTE 25 (VG 46), Fuchs Renolin B series VG 46 (e.g. Renolin B 15 VG 46 – check the current name)",
      "ν40 ≈ 46 mm²/s, VI ≈ 98–110, zinc-containing AW – see datasheet",
      "low (per litre)",
      "DIN 51524-2 approval, listed by the pump maker (e.g. Bosch Rexroth fluid rating list RE 90235), seal compatibility, filterability"
     ],
     [
      "Hydraulic fluids",
      "HLP 32 (if the clamp / spindle maker asks for VG 32)",
      "Shell Tellus S2 MX 32, Mobil DTE 24, Fuchs Renolin B VG 32",
      "ν40 ≈ 32",
      "low",
      "–"
     ],
     [
      "Hydraulic fluids",
      "HVLP 46 (cold halls, large temperature range)",
      "Shell Tellus S2 VX 46, Mobil DTE 10 Excel 46, Fuchs Renolin B 46 HVI",
      "VI ≥ 140",
      "low–medium",
      "shear stability"
     ]
    ]
   }
  ],
  "shops": [
   {
    "title": "Guide-25 job, accumulator option – guide 30 §21",
    "cols": [
     "Tag",
     "Element",
     "Spec (example)",
     "Catalogue example",
     "Price class"
    ],
    "rows": [
     [
      "0Z0",
      "Tank",
      "25 L steel, baffle, sight glass, clean-out, breather 3 µm",
      "HPU maker standard (guide 25 §18.1)",
      "low–medium"
     ],
     [
      "0P1",
      "Gear pump",
      "4 cm³/rev → 5.4 L/min at 1450 rpm, ≥ 10 MPa continuous",
      "Rexroth AZPF, Casappa, Marzocchi, Parker PGP",
      "low"
     ],
     [
      "0M1",
      "Motor",
      "0.75 kW IE3 4-pole B35/B5",
      "Siemens SIMOTICS GP, ABB, WEG",
      "low"
     ],
     [
      "0V1",
      "Relief",
      "11 MPa (≥ 1.1 × cut-out)",
      "Rexroth DBDS / DB, Sun RPEC",
      "low"
     ],
     [
      "0V2",
      "Check, pump outlet",
      "0.05 MPa cracking",
      "Rexroth S 6",
      "low"
     ],
     [
      "0V5",
      "Unloading 2/2 NO solenoid (or DA)",
      "24 V DC, NG6",
      "Rexroth M-SEW family (check) / DA",
      "low"
     ],
     [
      "0S2",
      "Pressure transmitter / switch",
      "0–16 MPa, cut-out 10 / cut-in 8.1 MPa, PLC recharges to cut-out after every movement",
      "Hydac EDS 3000 / HDA, WIKA PSD-4",
      "low"
     ],
     [
      "0Z5",
      "Bladder accumulator",
      "5 L, p0 6.97 MPa N₂, ≥ 16 MPa, PED",
      "Hydac SB330-5, Olaer EHV, Rexroth HAB",
      "medium"
     ],
     [
      "0V3",
      "Safety + shut-off block",
      "relief 12 MPa type-tested, manual + NO solenoid discharge",
      "Hydac SAF10",
      "low–medium"
     ],
     [
      "0Z3",
      "Return filter",
      "40 L/min size, 10 µm β10(c) ≥ 200, indicator, bypass 0.3 MPa",
      "Hydac RF/RFM, Rexroth, Parker (guide 25 §18.9)",
      "low"
     ],
     [
      "0Z4",
      "Breather",
      "3 µm",
      "Hydac BF, Parker",
      "low"
     ],
     [
      "0S1/0B1",
      "Gauge + level / temperature switch + test points",
      "gauge 0–16 MPa class 1.6; M16×2 test points G1, G2",
      "WIKA 213.53, Hydac ENS/ETS, Minimess",
      "low"
     ],
     [
      "1V1",
      "4/3 solenoid valve NG6, float centre (A, B → T, P blocked)",
      "24 V DC, LED plugs",
      "Rexroth 4WE 6 (spool for this centre, e.g. \"J\" – read the symbol), Parker D1VW, Atos DHI",
      "low"
     ],
     [
      "1V3",
      "Counterbalance valve on the cylinder",
      "8.3 MPa, 3:1, line body",
      "Sun CBCA/CBCG, Rexroth FD",
      "low"
     ],
     [
      "1V4",
      "Throttle check NG6 (meter-in for the CBV circuit, §6.2)",
      "sandwich",
      "Rexroth Z2FS 6",
      "low"
     ],
     [
      "1A1",
      "Cylinder",
      "Ø63/36 × 200, clevis both ends, cushions, ISO 6020-2 (16 MPa)",
      "Rexroth CDH / CDT (check), Parker HMI, Hänchen (check)",
      "medium"
     ],
     [
      "–",
      "Tubes / hoses / fittings",
      "15×2.5, 18×2, 16×2 E235/E355; hoses DN 10 / 16 2SN; ISO 8434-1",
      "Parker, Stauff, Voss (check)",
      "low–medium"
     ],
     [
      "–",
      "Oil",
      "≈ 29 L HLP 46",
      "guide 25 §18.14",
      "low"
     ]
    ],
    "m": 3,
    "p": 4,
    "w": [
     8,
     20,
     34,
     24,
     14
    ]
   },
   {
    "title": "Press 200 kN – guide 30 §22",
    "cols": [
     "Tag",
     "Element",
     "Spec (example)",
     "Catalogue example",
     "Price class"
    ],
    "rows": [
     [
      "0Z0",
      "Tank (+ top prefill tank on the press)",
      "main tank 250 L (app) – re-check with the real cycle; prefill tank ≥ 1.5 × cap volume 3.7 L + reserve",
      "HPU maker",
      "medium–high"
     ],
     [
      "0P1",
      "Variable piston pump with power limiter / LS",
      "45 cm³/rev, 60.7 L/min, comp. 21 MPa, power limit ≈ 5–6 kW",
      "Rexroth A10VSO 45 DFLR, Parker PV046 (check)",
      "high"
     ],
     [
      "0M1",
      "Motor",
      "5.5 kW IE3 (real design; app preset 18.5 kW for force over the whole stroke)",
      "Siemens / ABB / WEG",
      "low–medium"
     ],
     [
      "0V1",
      "Relief",
      "22 MPa (1 MPa above the compensator)",
      "Rexroth DB 10",
      "low"
     ],
     [
      "0Z2",
      "Pressure filter, no bypass",
      "5 µm β5(c) ≥ 1000, ≈ 100 L/min size",
      "Hydac DF, Parker (check)",
      "low–medium"
     ],
     [
      "0Z3",
      "Return filter",
      "180 L/min size, 10 µm β ≥ 200",
      "Hydac RF, Rexroth",
      "medium"
     ],
     [
      "0Z6",
      "Off-line filter + cooler loop",
      "3 µm, cooler sized by the real loss (preset: 5.1 kW)",
      "Hydac OLF + air cooler (check)",
      "medium–high"
     ],
     [
      "1V1",
      "Proportional 4/3 valve NG16 (or NG10 with prefill return)",
      "OBE, Q_N for 61 L/min at our Δp",
      "Rexroth 4WRPEH / 4WREE (check), Parker D3FB / D41FB (check)",
      "high"
     ],
     [
      "1V2",
      "Prefill valve",
      "≥ 147 L/min at 0.05 MPa, pilot open",
      "Rexroth SF (check), Parker (check)",
      "medium"
     ],
     [
      "1V3",
      "CBV rod line",
      "1.2–3 MPa",
      "Rexroth FD / Sun CB…",
      "low"
     ],
     [
      "1V4",
      "Decompression valve + orifice",
      "2/2 seat + Ø 2.4 mm (0.2 s)",
      "Rexroth seat valve (check)",
      "low"
     ],
     [
      "1V5/1V6",
      "Monitored safety valves (2 in series)",
      "seat type, position monitoring, B10d data",
      "Rexroth / Parker / Atos monitored valves or press safety block (check)",
      "medium–high"
     ],
     [
      "1B1",
      "Pressure transmitter",
      "0–25 MPa",
      "Hydac HDA 4700, WIKA S-20",
      "low"
     ],
     [
      "1B2",
      "Position transducer",
      "300 mm, in the cylinder",
      "Balluff BTL, Temposonics",
      "medium"
     ],
     [
      "1A1",
      "Press cylinder",
      "Ø125/70 × 300, ISO 6022 (25 MPa), flange + guided rod, rod side protected",
      "Rexroth CDH2 / CDH3 (check), Parker heavy-duty ISO 6022 series (check), custom press cylinder",
      "high"
     ],
     [
      "–",
      "Safety: two-hand IIIC / light curtain + safety PLC",
      "PL d/e, Cat 3/4",
      "Pilz, Sick, Siemens F",
      "medium–high"
     ],
     [
      "–",
      "Lines",
      "pressure 25×3 E355 (or 30×4) / hose DN 19 4SP class; return 35×3; suction hose DN 51; SAE flanges",
      "Parker, Stauff, Voss",
      "medium"
     ],
     [
      "–",
      "Oil",
      "≈ 290 L HLP 46 (app)",
      "–",
      "medium"
     ]
    ],
    "m": 3,
    "p": 4,
    "w": [
     8,
     20,
     34,
     24,
     14
    ]
   },
   {
    "title": "APC + clamp power unit (example 2) – guide 25 §19",
    "cols": [
     "Pos",
     "Tag",
     "Qty",
     "Item",
     "Spec (from §14)",
     "Example series (§18)",
     "Price class"
    ],
    "rows": [
     [
      "1",
      "0Z1",
      "1",
      "tank / compact power pack",
      "25 L, baffle, lid, drain, clean-out",
      "HAWE / Rexroth / Hydac compact unit",
      "medium–high (complete unit)"
     ],
     [
      "2",
      "0M1",
      "1",
      "electric motor",
      "0.75 kW 4-pole IE3, B5 V1, PTC",
      "Siemens SIMOTICS GP, ABB, WEG W22",
      "low"
     ],
     [
      "3",
      "0P1",
      "1",
      "gear pump",
      "4 cm³/rev, ≥ 10 MPa continuous",
      "Rexroth AZPF, Casappa, Marzocchi, Parker PGP",
      "low"
     ],
     [
      "4",
      "–",
      "1",
      "bell housing + elastic coupling + damping ring",
      "for frame 80 / pump flange",
      "KTR / R+W / Raja-Lovejoy type",
      "low"
     ],
     [
      "5",
      "0V1",
      "1",
      "pressure relief, pilot operated",
      "8.5 MPa, ≥ 10 L/min, sealed",
      "Rexroth DB / Sun RPEC",
      "low"
     ],
     [
      "6",
      "0V2",
      "1",
      "check valve",
      "0.05 MPa",
      "Rexroth S / Sun CXxx",
      "low"
     ],
     [
      "7",
      "0V5",
      "1",
      "unloading 2/2 solenoid valve NO",
      "NG6 / cartridge, 24 V DC",
      "Rexroth / HAWE / Sun",
      "low"
     ],
     [
      "8",
      "0B2",
      "1",
      "pressure transmitter",
      "0–16 MPa, 4–20 mA",
      "Hydac HDA 4400, WIKA S-20",
      "low"
     ],
     [
      "9",
      "0Z5",
      "1",
      "bladder accumulator",
      "2.5 L, p0 5.39 MPa g, PED",
      "Hydac SB330-2.5, Olaer EHV, Rexroth HAB",
      "low–medium"
     ],
     [
      "10",
      "0V3",
      "1",
      "safety + shut-off block",
      "relief 10 MPa sealed, manual + solenoid discharge",
      "Hydac SAF10",
      "low–medium"
     ],
     [
      "11",
      "0Z3",
      "1",
      "return filter + electric indicator",
      "≈ 40 L/min, 10 µm β10(c) ≥ 200, bypass 0.3 MPa",
      "Hydac RFM, Argo-Hytos, Parker, Donaldson",
      "low"
     ],
     [
      "12",
      "0Z4",
      "1",
      "breather / filler",
      "3 µm",
      "Hydac ELF / BF",
      "low"
     ],
     [
      "13",
      "0S3",
      "1",
      "level + temperature sensor, sight glass",
      "min level, 60 °C alarm",
      "Hydac ENS / FSK",
      "low"
     ],
     [
      "14",
      "0S1, 0X1",
      "1 + 4",
      "gauge 0–10 MPa + test points M16×2",
      "class 1.6",
      "WIKA 213.53, Minimess-style",
      "low"
     ],
     [
      "15",
      "1V1",
      "1",
      "4/3 solenoid valve NG6, centre P blocked / A, B → T",
      "24 V DC, LED plugs",
      "Rexroth 4WE6 (symbol \"J\" – check), Parker D1VW, Atos DHI",
      "low"
     ],
     [
      "16",
      "1V2",
      "1",
      "double pilot-operated check, sandwich NG6",
      "ratio ≈ 3:1",
      "Rexroth Z2S 6",
      "low"
     ],
     [
      "17",
      "1V3",
      "1",
      "double throttle check, sandwich NG6",
      "meter-out",
      "Rexroth Z2FS 6",
      "low"
     ],
     [
      "18",
      "1A1",
      "1",
      "lift cylinder (if not part of the APC supply)",
      "Ø63/36 × 60, cushions both ends, ISO 6020-2",
      "cylinder makers (Rexroth CDT3/CDH, Parker, Hänchen …)",
      "medium"
     ],
     [
      "19",
      "1B1/1B2",
      "2",
      "inductive sensors arm up / down",
      "PNP, M12",
      "ifm, Balluff, Sick",
      "low"
     ],
     [
      "20",
      "2V2, 3V2",
      "2",
      "pressure reducing (relieving) valves",
      "5.0 MPa, drain to T",
      "Rexroth DR6DP, Sun PRDB",
      "low"
     ],
     [
      "21",
      "2V1",
      "1",
      "3/2 solenoid valve, spring return (off = A → T)",
      "NG6 / cartridge, 24 V DC",
      "Rexroth / HAWE",
      "low"
     ],
     [
      "22",
      "3V1",
      "1",
      "3/2 seat valve leak-free (off = P → A)",
      "NG6, 24 V DC",
      "Rexroth M-3SEW 6, HAWE seat valve",
      "low–medium"
     ],
     [
      "23",
      "3V3",
      "1",
      "check valve",
      "–",
      "–",
      "low"
     ],
     [
      "24",
      "2S1, 3S1",
      "2",
      "electronic pressure switches",
      "4.5 MPa rising, display, PNP",
      "Hydac EDS 3000, ifm PN",
      "low"
     ],
     [
      "25",
      "–",
      "1",
      "manifold / subplates for the NG6 stacks + cartridges",
      "aluminium or steel, ISO 4401-03",
      "supplier",
      "medium"
     ],
     [
      "26",
      "–",
      "set",
      "tubes 12×1.5, 16×2, 8×1 + 24° fittings L series",
      "EN 10305-4, ISO 8434-1",
      "Parker EO-2, Voss",
      "low"
     ],
     [
      "27",
      "–",
      "set",
      "hoses to the machine + whip restraints",
      "2SN DN 6 / 10 / 12, 4:1",
      "Parker, Manuli, Gates",
      "low"
     ],
     [
      "28",
      "0R1",
      "1",
      "rotary union (if not in the HMC table supply)",
      "oil 10 MPa + air passages",
      "rotary union makers (Deublin, GAT, Kadant …)",
      "medium–high"
     ],
     [
      "29",
      "–",
      "30 L",
      "hydraulic oil HLP 32 or 46 (as clamp maker specifies)",
      "DIN 51524-2",
      "Shell Tellus S2 MX, Mobil DTE 24/25, Fuchs Renolin B",
      "low"
     ],
     [
      "30",
      "–",
      "–",
      "flushing service + oil sample + documents",
      "17/15/12 report, ISO 1219-2, PED, EN ISO 4413 list",
      "supplier",
      "medium"
     ],
     [
      "–",
      "2A1–2A4, 3A1",
      "–",
      "zero-point modules and table clamp ring",
      "bought with the APC / table (docs/09, docs/12)",
      "–",
      "–"
     ]
    ],
    "m": 5,
    "p": 6,
    "w": [
     5,
     7,
     5,
     18,
     26,
     23,
     16
    ]
   }
  ],
  "shopTab": "Shopping lists – job, press, APC + clamp",
  "shopLbl": "shopping lists",
  "shopTitle": "Three consolidated shopping lists from the sizing examples: the guide-25 job with accumulator supply, the 200 kN press, and the APC + clamp power unit of the HMC.",
  "price": "Price classes (guides 25 / 29 / 30, single unit, order of magnitude): low < ≈ 300 € · medium ≈ 300 – 1 500 € · high ≈ 1 500 – 8 000 € · very high > 8 000 € – estimate, ask for a quote.",
  "shopNote": "Quantities and specs come from the sizing examples – re-check them with the real cycle before ordering.",
  "ph": "(e.g. HPU, A10VSO, IE3 motor, 4WE10, filter, hose)"
 }
};
