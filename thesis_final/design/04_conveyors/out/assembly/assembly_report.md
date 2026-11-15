# F4.4 - assembly carrier line (asm_line.py)

All values: DESIGN / REFERENCE ESTIMATE; DES = SIMULATED.

Station times per unit (F2 loads / 3400 units): ASSY 31.7 min, TEST 25.6 min, PAINT 2.4 min, PACK 5.0 min, LOAD 3.0 min, UNLOAD 2.0 min; rate 10.3 /h average, 12.4 /h design.

## A Carrier and product stability

| product | m on carrier kg | beam M N mm | sigma MPa | delta mm (lim 1.2) | a_tip long. | a_tip lat. | a_slide | bumper E J / a m/s2 | E-stop | ok |
|---|---|---|---|---|---|---|---|---|---|---|
| VC20 | 197 | 45984 | 3.3 | 0.07 | 10.5 | 4.4 | 3.9 | 3.9 / 2.0 | 1.5 | yes |
| RB50 | 153 | 45862 | 3.3 | 0.07 | 12.4 | 7.5 | 3.9 | 3.1 / 2.0 | 1.5 | yes |
| RB100 | 178 | 59351 | 4.2 | 0.09 | 11.6 | 7.1 | 3.9 | 3.6 / 2.0 | 1.5 | yes |
| RB150 | 228 | 66708 | 4.8 | 0.10 | 12.1 | 7.0 | 3.9 | 4.6 / 2.0 | 1.5 | yes |

## B Working height -> lift table

Required carrier top over all tasks and operators (P5 female .. P95 male, light work = elbow - 100): -90 .. 705 mm; lift table 100 .. 800 mm covers 25 of 27 cases.

| product | task | task height | operator | work height | carrier top needed |
|---|---|---|---|---|---|
| VC20 | A60 pump + motor on the tank plate | 600 | P5_female | 860 | 260 |
| VC20 | A60 pump + motor on the tank plate | 600 | P50 | 970 | 370 |
| VC20 | A60 pump + motor on the tank plate | 600 | P95_male | 1085 | 485 |
| VC20 | A60 belts, tension, guard | 750 | P5_female | 860 | 110 |
| VC20 | A60 belts, tension, guard | 750 | P50 | 970 | 220 |
| VC20 | A60 belts, tension, guard | 750 | P95_male | 1085 | 335 |
| VC20 | A70 pressure switch, valves, gauges (top) | 950 | P5_female | 860 | -90 |
| VC20 | A70 pressure switch, valves, gauges (top) | 950 | P50 | 970 | 20 |
| VC20 | A70 pressure switch, valves, gauges (top) | 950 | P95_male | 1085 | 135 |
| RB50 | A10-A30 rotors, head plates, timing gears | 380 | P5_female | 860 | 480 |
| RB50 | A10-A30 rotors, head plates, timing gears | 380 | P50 | 970 | 590 |
| RB50 | A10-A30 rotors, head plates, timing gears | 380 | P95_male | 1085 | 705 |
| RB50 | A40-A50 motor, belts, guard, silencers | 520 | P5_female | 860 | 340 |
| RB50 | A40-A50 motor, belts, guard, silencers | 520 | P50 | 970 | 450 |
| RB50 | A40-A50 motor, belts, guard, silencers | 520 | P95_male | 1085 | 565 |
| RB100 | A10-A30 rotors, head plates, timing gears | 400 | P5_female | 860 | 460 |
| RB100 | A10-A30 rotors, head plates, timing gears | 400 | P50 | 970 | 570 |
| RB100 | A10-A30 rotors, head plates, timing gears | 400 | P95_male | 1085 | 685 |
| RB100 | A40-A50 motor, belts, guard, silencers | 560 | P5_female | 860 | 300 |
| RB100 | A40-A50 motor, belts, guard, silencers | 560 | P50 | 970 | 410 |
| RB100 | A40-A50 motor, belts, guard, silencers | 560 | P95_male | 1085 | 525 |
| RB150 | A10-A30 rotors, head plates, timing gears | 430 | P5_female | 860 | 430 |
| RB150 | A10-A30 rotors, head plates, timing gears | 430 | P50 | 970 | 540 |
| RB150 | A10-A30 rotors, head plates, timing gears | 430 | P95_male | 1085 | 655 |
| RB150 | A40-A50 motor, belts, guard, silencers | 610 | P5_female | 860 | 250 |
| RB150 | A40-A50 motor, belts, guard, silencers | 610 | P50 | 970 | 360 |
| RB150 | A40-A50 motor, belts, guard, silencers | 610 | P95_male | 1085 | 475 |

Not covered (2): VC20 A70 P5_female: 190 mm outside; VC20 A70 P50: 80 mm outside

## C Accumulation chain

Carrier + adapter + heaviest product = 232 kg. A section FULL of accumulated carriers may be at most 41.9 m long (F_allow 1500 N per strand).
Design: 4 sections of 25 m; with the 21 carriers of the loop the worst section pull is 895 N per strand -> drive 421 W -> **0.75 kW** per section.
Stopper in front of the largest queue (8 places): line pressure 910 N, impact 4.6 J (stopper class 1500 N / 10 J) -> OK.

## D Lift-transfers

Transfer cycle 14 s (lift 2 + spur 2 m at 0.2 m/s + lower 2). Main-line occupation at a group: ASSY 9.6 %, TEST 9.6 %, PAINT 9.6 %, PACK 9.6 %. Per spur: ASSY 1.1 %, TEST 1.4 %, PAINT 9.6 %, PACK 4.8 %.

## E Closed loop - throughput versus number of carriers (simulated, 600 h each)

| carriers N | throughput /h | max queue ASSY | TEST | PAINT | PACK |
|---|---|---|---|---|---|
| 8 | 5.94 | 0 | 1 | 4 | 2 |
| 10 | 7.43 | 0 | 2 | 5 | 2 |
| 12 | 8.86 | 2 | 3 | 4 | 2 |
| 14 | 10.27 | 3 | 3 | 4 | 2 |
| 16 | 11.65 | 3 | 4 | 5 | 2 |
| 18 | 12.95 | 4 | 5 | 5 | 2 |
| 20 | 14.13 | 4 | 5 | 5 | 2 |
| 22 | 15.18 | 6 | 6 | 5 | 3 |
| 24 | 15.78 | 5 | 7 | 5 | 3 |
| 26 | 16.04 | 6 | 11 | 5 | 3 |
| 28 | 16.17 | 10 | 12 | 5 | 4 |
| 30 | 16.12 | 11 | 13 | 5 | 2 |

N_min for the design rate 12.4 /h: **18**; F4.1 Little estimate: 21 (incl. 10 % spare). Decision: **21 carriers** = DES minimum + spare for maintenance and product changeover.
Queues wait ON the main line in front of their group (all carriers follow the same sequence, so a queue blocks nobody who could pass). Segment capacity in front of each group: ASSY 6, TEST 12, PAINT 6, PACK 3 carriers; max simulated queue at 22 carriers: ASSY 6, TEST 6, PAINT 5, PACK 3.

## F Tank / motor feed

Tank rack 4 x 62 kg + 50 kg = 298 kg (AGV payload 300 kg -> OK). Per month: 750 tank racks, 100 RB frame racks, 425 motor crates -> **2550 AGV moves/month** (full + empty), 9.3 /h at peak -> input F5.
Tank buffer at the load station for 1 h: 11 tanks = 4 rack places (incl. the rack in use); 8 racks in circulation.

## G Line-fed heavy parts at assembly

NIOSH at the assembly fixture (H 45, V 80, D 40, FM 0.85): RWL = 9.5 kg.

| product | part | kg | LI | handling |
|---|---|---|---|---|
| VC20 | C01 crankcase | 14.2 | 1.50 | balancer |
| VC20 | C09 flywheel | 9.4 | 0.99 | by hand |
| RB50 | R01 housing | 16.9 | 1.78 | balancer |
| RB50 | R02 head plate | 5.4 | 0.57 | by hand |
| RB50 | R03 head plate | 5.4 | 0.57 | by hand |
| RB100 | R01 housing | 24.4 | 2.57 | balancer |
| RB100 | R02 | 5.4 | 0.57 | by hand |
| RB100 | R03 | 5.4 | 0.57 | by hand |
| RB100 | R06 rotor | 7.3 | 0.77 | by hand |
| RB100 | R07 rotor | 7.1 | 0.75 | by hand |
| RB150 | R01 housing | 31.9 | 3.37 | balancer |
| RB150 | R02 | 5.4 | 0.57 | by hand |
| RB150 | R03 | 5.4 | 0.57 | by hand |
| RB150 | R06 rotor | 9.9 | 1.04 | balancer |
| RB150 | R07 rotor | 9.7 | 1.02 | balancer |

Balancer lifts 12.9 /h at peak; 5 balancers (one per 2 stations) -> utilisation 3.2 %.

## H Modules and cost

| module | qty | EUR each | EUR |
|---|---|---|---|
| carrier | 21 | 650 | 13650 |
| adapter_set (VC20 + RB) | 21 | 250 | 5250 |
| loop_per_m | 100 | 1100 | 110000 |
| section_drive | 4 | 3500 | 14000 |
| corner_unit | 4 | 8000 | 32000 |
| spur_unit | 19 | 7000 | 133000 |
| lift_table (ASSY spurs) | 9 | 4000 | 36000 |
| lift_pit 250 mm (ASSY spurs) | 9 | 1500 | 13500 |
| lift_locate (all stations) | 21 | 1800 | 37800 |
| test_dock | 7 | 3500 | 24500 |
| load_station | 1 | 12000 | 12000 |
| tank_lifter | 1 | 6500 | 6500 |
| tank_rack | 8 | 450 | 3600 |
| balancer | 5 | 4500 | 22500 |
| stopper | 25 | 450 | 11250 |
| gate_section (personnel access + escape, interlocked) | 2 | 6500 | 13000 |

Total **488550 EUR** (F4.1 estimate for the assembly line: 300650 EUR).

Test-bench docking: air outlet quick coupling DN15 (11 bar) to the test bench receiver / flow meter (ISO 1217); 400 V 16 A CEE plug for the motor (via the bench contactor and power meter); condensate hose; noise: bench hood closes over the unit (ISO 2151); carrier located by lift-and-locate pins +-0.5 mm so the couplings are made by a pneumatic docking slide.
