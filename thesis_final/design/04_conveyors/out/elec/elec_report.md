# F4.5 - electrics, safety, communication of the F4 conveyors (conv_elec.py)

All values: DESIGN / REFERENCE ESTIMATE.

## 1 Drive concept - why every drive needs a ramp

| case | start force N | acceleration m/s2 | limit m/s2 | DOL acceptable |
|---|---|---|---|---|
| CC light crate 45 kg | 1677 | 31.4 | 4.9 | NO |
| CC full crate 300 kg | 1677 | 4.3 | 4.9 | yes |
| assembly section, 1 carrier moving | 6988 | 15.9 | 3.9 | NO |

-> decentralised drives with integrated inverter (ramp 0.3 m/s2 = 0.67 s to 0.2 m/s), STO via PROFIsafe, on PROFINET; one drive per zone / function.

## 2 Drives and power per area

| area | drives | kW installed | I_sum A | I_b A | fuse A | feeder | dU % |
|---|---|---|---|---|---|---|---|
| AF AS/RS front (PLC-ASRS1 of F3) | 19 | 3.4 | 8.7 | 6.4 | 10 | 5G1.5 | 0.73 |
| PD P&D stations + flow racks (PLC-CONV1) | 66 | 7.9 | 21.8 | 12.9 | 16 | power bus 2.5 mm2 | 1.65 |
| ASM assembly carrier line (PLC-ASM1) | 79 | 29.4 | 65.6 | 34.8 | 40 | 5G10 | 1.21 |
| HMC HMC pallet load station (cell controller of the HMC pallet system) | 1 | 0.1 | 0.3 | 2.3 | 10 | 5G1.5 | 0.20 |

| area | element | drive | kW | qty | I_in A each |
|---|---|---|---|---|---|
| AF | CC | chain zone | 0.18 | 9 | 0.47 |
| AF | TU | TU chain part | 0.18 | 3 | 0.47 |
| AF | TU | TU roller set | 0.12 | 3 | 0.33 |
| AF | TU | TU lift | 0.25 | 3 | 0.61 |
| AF | RCX | Z31 rollers | 0.12 | 1 | 0.33 |
| PD | RL | roller zone | 0.12 | 52 | 0.33 |
| PD | PD_end | pop-up end stop (electric) | 0.12 | 14 | 0.33 |
| ASM | section | loop section | 0.75 | 4 | 1.55 |
| ASM | corner | corner turntable rotate | 0.37 | 4 | 0.87 |
| ASM | corner | corner chain | 0.25 | 4 | 0.61 |
| ASM | spur | spur transfer lift | 0.25 | 19 | 0.61 |
| ASM | spur | spur transfer belts | 0.18 | 19 | 0.47 |
| ASM | spur | spur track | 0.25 | 19 | 0.61 |
| ASM | lift_table | lift table hydraulic power unit | 1.10 | 9 | 2.15 |
| ASM | load_station | tank lifter jib (vacuum pump + hoist) | 1.10 | 1 | 2.15 |
| HMC | hmc_station | HMC load station index table | 0.12 | 1 | 0.33 |

## 3 I/O per area

| area | DI | DO | F-DI | F-DO | AI | PN drives/devices | AGV couplers | remote I/O stations | 24 V A (PSU) |
|---|---|---|---|---|---|---|---|---|---|
| AF | 50 | 0 | 14 | 0 | 0 | 23 | 3 | 2 | 3.4 (5 A) |
| PD | 198 | 19 | 62 | 0 | 0 | 66 | 17 | 6 | 14.2 (20 A) |
| ASM | 337 | 127 | 46 | 2 | 9 | 79 | 0 | 11 | 19.8 (40 A) |
| HMC | 12 | 4 | 8 | 0 | 2 | 1 | 0 | 1 | 1.7 (5 A) |

P&D roller zones: 52 (F4.1 RL 71 - 28 line-side places moved to the flow racks + 3 powered return zones per flow-rack department).

## 4 Communication - Case A (built-in ports) and Case B (expansion modules)

| PLC | Case A modules | Case B modules | Case B extra EUR | backplane W (avail.) | PN devices | PN load one net / per net B |
|---|---|---|---|---|---|---|
| PLC-CONV1 | none (X1 PN IO, X2 factory) | CP1543-1 + CM1542-1 + CM_PtP_RS485_HF + PS60W | 4270 | 13.7 (70) | 89 | 14.95 % / 7.39 % |
| PLC-ASM1 | none (X1 PN IO, X2 factory) | CP1543-1 + CM1542-1 + CM_PtP_RS485_HF + PS60W | 4270 | 13.7 (70) | 90 | 15.12 % / 7.56 % |
- PLC-CONV1 Case B: net 1 = west half of the spine, net 2 = east half (a cable fault stops only half of the stations); CP firewall for the factory link; RS-485 for the energy meters of the power-bus feeders.
- PLC-ASM1 Case B: net 1 = loop + spurs, net 2 = 7 test benches (vendor PLCs as PROFINET i-devices, separated so that a bench fault cannot stop the loop); CP firewall; RS-485 for the lift-table hydraulic units and energy meters.
- PLC-ASRS1 (AS/RS front): Case A = X1 together with the crane, Case B = CM 1542-1 net 2 (already designed in F3 Part D).

## 5 Safety

| hazard | S | F | P | PLr | measure |
|---|---|---|---|---|---|
| person reaches into the lane end while the AGV transfers (rollers, crate, stop plate) | S1 | F2 | P2 | c | SF-C2 light curtain + muting at every AGV dock |
| person caught between two carriers / at a transfer on the assembly loop | S1 | F2 | P1 | b | fixed guards + SF-C3 gate interlock |
| person inside the loop when a gate section lifts / closes, or the loop restarts | S2 | F1 | P2 | d | SF-C3 gate interlock with guard locking |
| foot crushed under the lowering lift table at the pit edge | S2 | F2 | P1 | d | SF-C4 safety edge + two lowering valves |
| hand caught at the HMC pallet shuttle | S2 | F1 | P2 | d | SF-C5 light curtain S = 680 mm (F4.3) |
| hand in the crate at Z31 while the crate moves out / TU lifts | S1 | F2 | P2 | c | SF-C6 pick-window light curtain |
| finger at the test docking slide | S1 | F1 | P2 | b | SF-C7 force-limited slide + hood interlock |
| any hazard - emergency | S2 | F1 | P2 | d | SF-C1 E-stop per area |

| SF | PLr | function | subsystems | PL achieved | ok |
|---|---|---|---|---|---|
| SF-C1 | d | E-stop per area -> SS1 then STO of all drives of the area | input: E-stop 2 ch, cross-monitored: d (Cat 3, MTTFd 100 a (high), DCavg 99 %, CCF 80); logic: F-CPU + F-DI/F-DQ: e (certified e (PFHd 1.0e-09)); output: decentralised drive STO via PROFIsafe: e (certified e (PFHd 1.0e-09)) | **d** | yes |
| SF-C2 | c | AGV dock: light curtain (multi-beam) with muting while AGV_PRESENT + docking sensor; a person -> STO of lane + AGV rollers stop (ST_FAULT) | input: multi-beam light curtain type 4: e (certified e (PFHd 1.5e-08)); input: muting sensors 2 ch + timing / sequence plausibility: d (Cat 3, MTTFd 50 a (high), DCavg 90 %, CCF 80); logic: F-CPU + F-DI/F-DQ: e (certified e (PFHd 1.0e-09)); output: decentralised drive STO via PROFIsafe: e (certified e (PFHd 1.0e-09)) | **d** | yes |
| SF-C3 | d | Assembly gate section: interlock + guard locking; unlock only after STO of the upstream section; opening from inside always possible (escape release) | input: interlock with guard locking, 2 ch (ISO 14119 type 4 coded): d (Cat 3, MTTFd 100 a (high), DCavg 99 %, CCF 80); logic: F-CPU + F-DI/F-DQ: e (certified e (PFHd 1.0e-09)); output: decentralised drive STO via PROFIsafe: e (certified e (PFHd 1.0e-09)) | **d** | yes |
| SF-C4 | d | Lift table in the pit: safety edge (EN ISO 13856-2) around the table -> both lowering valves close | input: safety edge + control unit: d (certified d (PFHd 1.0e-07)); logic: F-CPU + F-DI/F-DQ: e (certified e (PFHd 1.0e-09)); output: two monitored lowering valves (hydraulic, MTTFd 150 a each): d (Cat 3, MTTFd 100 a (high), DCavg 90 %, CCF 80) | **d** | yes |
| SF-C5 | d | HMC load station light curtain (S = 680 mm) -> STO of the pallet shuttle | input: light curtain type 4, 30 mm: e (certified e (PFHd 1.5e-08)); logic: F-CPU + F-DI/F-DQ: e (certified e (PFHd 1.0e-09)); output: shuttle drive STO: e (certified e (PFHd 1.0e-09)) | **e** | yes |
| SF-C6 | c | Z31 pick window light curtain: no crate movement into / out of Z31 and no TU1/TU2 lift while hands are inside | input: light curtain type 4, 30 mm: e (certified e (PFHd 1.5e-08)); logic: F-CPU + F-DI/F-DQ: e (certified e (PFHd 1.0e-09)); output: decentralised drive STO via PROFIsafe: e (certified e (PFHd 1.0e-09)) | **e** | yes |
| SF-C7 | c | Test docking slide: force-limited pressure (< 150 N) + hood interlock 2 ch | input: hood interlock 2 ch: d (Cat 3, MTTFd 100 a (high), DCavg 90 %, CCF 80); logic: F-CPU + F-DI/F-DQ: e (certified e (PFHd 1.0e-09)); output: 5/3 valve centre closed + exhaust valve: d (Cat 3, MTTFd 100 a (high), DCavg 60 %, CCF 80) | **d** | yes |

AGV dock light curtain (multi-beam, body): T = 340 ms -> S = 1600 x 0.340 + 850 = **1394 mm** from the lane end: the dock is a guarded tunnel of this length; the AGV mutes the curtain.
Pit safety edge: overrun after contact = 30 mm/s x 100 ms = 3.0 mm <= edge travel 25 mm -> OK.

## 6 Compressed air (input F11)

| actuator | qty | bore | stroke | NL per cycle | cycles/h | NL/min |
|---|---|---|---|---|---|---|
| assembly stopper | 25 | 32 | 25 | 0.281 | 8 | 0.94 |
| lift-and-locate | 21 | 40 | 20 | 0.352 | 4 | 0.49 |
| test docking slide | 7 | 50 | 150 | 4.123 | 1.5 | 0.72 |
| flow-rack separator | 19 | 32 | 50 | 0.563 | 3 | 0.53 |
| balancers | 5 | - | - | 25 | 12.9 | 5.38 |

Total with 15 % leakage: **9 NL/min** at 6 bar.

## 7 Cost (electrics, controls hardware, safety components)

| item | qty | EUR each | EUR |
|---|---|---|---|
| decentralised drives (inverter + STO, PROFINET) | 165 | 900 | 148500 |
| remote I/O stations (incl. F-modules) | 20 | 2200 | 44000 |
| optical AGV couplers | 20 | 1200 | 24000 |
| light curtains with muting / pick window / HMC | 22 | 2600 | 57200 |
| E-stops | 32 | 180 | 5760 |
| safety edges (lift tables) | 9 | 450 | 4050 |
| gate locks | 2 | 600 | 1200 |
| F-CPU PLC-CONV1 + PLC-ASM1 | 2 | 4200 | 8400 |
| control cabinets | 3 | 6000 | 18000 |
| power bus (m) | 175 | 28 | 4900 |
| PROFINET cable (m) | 600 | 4 | 2400 |
| energy meters | 4 | 350 | 1400 |

Case A total **319810 EUR**; Case B adds 8540 EUR (both PLCs).
