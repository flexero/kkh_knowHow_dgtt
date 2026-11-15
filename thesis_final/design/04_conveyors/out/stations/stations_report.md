# F4.3 - load stations (load_stations.py)

All values: DESIGN / REFERENCE ESTIMATE; DES = SIMULATED.

## A AGV P&D station

- Lateral: AGV 10 mm + yaw 0.5 deg over 1200 mm (10.5 mm) + floor 3 mm -> worst 23.5 mm, RSS 14.8 mm; capture of guides + lead-in 65.2 mm -> OK.
- Height step deck/lane: worst 8 mm, RSS 5.8 mm, allowed 6 mm -> requirement for F5: deck height +-3 mm (actively levelled).
- Transfer gap 30 mm: 7 rollers stay under each runner while crossing; transfer time 10 s (F4.1 assumed 10 s).
- End stop (control fault): E = 6 J, PU stroke 12 mm -> F_avg 500 N, peak 0.34 g (limit 0.5 g) -> OK.

## B TU1 check station

- Width overhang allowed per side: gap/2 37.5 - x tolerance 12.0 - safety 5 = 20.5 mm -> limit **20 mm**.
- Front/rear overhang: available 35 mm -> limit **20 mm**. Height: available 968 mm above the beam; rule crate 600 + 20 = **620 mm** -> OK.
- Light grids resolution 14 mm (detects >= 20 mm objects); length measured in motion: 0.2 m/s x 10 ms scan = 2 mm steps.
- Load cells: per cell (450 + 375) / 4 x 1.5 = 309 kg -> **500 kg** cells; uncertainty u = sqrt(cells 0.23^2 + vibration 0.8^2 + zero 0.3^2) = **0.88 kg**; accept if W <= 298.2 kg (guard band 2u).
- Settling: k = 65.4 MN/m, m = 750 kg -> f_n = 47 Hz; filter 2 Hz -> stable after 0.58 s (budget 8 s).

| part (raw crate) | parts/crate | kg/part | crate kg | tolerance kg | one missing part detectable |
|---|---|---|---|---|---|
| C01 | 12 | 16.50 | 243.0 | 7.3 | yes |
| C02 | 40 | 1.50 | 105.0 | 3.1 | no |
| C03 | 40 | 1.90 | 121.0 | 3.6 | no |
| C04 | 24 | 3.90 | 138.6 | 4.2 | no |
| C05 | 40 | 1.25 | 95.0 | 2.9 | no |
| C06 | 60 | 0.82 | 94.2 | 2.8 | no |
| C07 | 30 | 4.80 | 189.0 | 5.7 | no |
| C08 | 80 | 0.42 | 78.6 | 2.4 | no |
| C09 | 12 | 10.50 | 171.0 | 5.1 | yes |
| R01-RB100 | 6 | 29.00 | 219.0 | 6.6 | yes |
| R02-RB100 | 20 | 6.60 | 177.0 | 5.3 | yes |
| R03-RB100 | 20 | 6.60 | 177.0 | 5.3 | yes |
| R04-RB100 | 40 | 2.10 | 129.0 | 3.9 | no |
| R05-RB100 | 40 | 1.60 | 109.0 | 3.3 | no |
| R06-RB100 | 12 | 8.60 | 148.2 | 4.4 | yes |
| R07-RB100 | 12 | 8.40 | 145.8 | 4.4 | yes |

## C Pick / rework station Z31

- **VC20**: kitted mass 17.2 kg/unit -> 13 units per trolley, 26 units per visit (2 trolley places, lot limit); heavy parts line-fed in crates: C01 14.2 kg, C09 9.4 kg.
- **RB50**: kitted mass 12.3 kg/unit -> 19 units per trolley, 35 units per visit (2 trolley places, lot limit); heavy parts line-fed in crates: R01 16.9 kg, R02 5.4 kg, R03 5.4 kg.
- **RB100**: kitted mass 3.2 kg/unit -> 73 units per trolley, 45 units per visit (2 trolley places, lot limit); heavy parts line-fed in crates: R01 24.4 kg, R02 5.4 kg, R03 5.4 kg, R06 7.3 kg, R07 7.1 kg.
- **RB150**: kitted mass 3.2 kg/unit -> 73 units per trolley, 20 units per visit (2 trolley places, lot limit); heavy parts line-fed in crates: R01 31.9 kg, R02 5.4 kg, R03 5.4 kg, R06 9.9 kg, R07 9.7 kg.

| variant | part | qty/unit | kg | class | picks per kit visit | parts/crate in bins | crate visits | bins per crate visit | t per crate visit s | crate visits/month |
|---|---|---|---|---|---|---|---|---|---|---|
| VC20 | C02 | 1 | 1.25 | medium | 26 | 30 | 1 | 5 | 113 | 120.0 |
| VC20 | C03 | 1 | 1.60 | medium | 26 | 30 | 1 | 7 | 119 | 120.0 |
| VC20 | C04 | 2 | 3.30 | medium | 52 | 16 | 4 | 7 | 80 | 480.0 |
| VC20 | C05 | 2 | 1.05 | medium | 52 | 30 | 2 | 4 | 110 | 240.0 |
| VC20 | C06 | 2 | 0.66 | light | 52 | 45 | 2 | 3 | 81 | 240.0 |
| VC20 | C07 | 1 | 3.60 | medium | 26 | 16 | 2 | 7 | 80 | 240.0 |
| VC20 | C08 | 2 | 0.35 | light | 52 | 60 | 1 | 3 | 133 | 120.0 |
| RB50 | R04 | 1 | 1.85 | medium | 35 | 30 | 2 | 5 | 88 | 8.0 |
| RB50 | R05 | 1 | 1.40 | medium | 35 | 30 | 2 | 4 | 84 | 8.0 |
| RB50 | R06 | 1 | 4.62 | heavy | 35 | 8 | 5 | 7 | 72 | 20.0 |
| RB50 | R07 | 1 | 4.43 | heavy | 35 | 8 | 5 | 7 | 72 | 20.0 |
| RB100 | R04 | 1 | 1.85 | medium | 45 | 30 | 2 | 6 | 106 | 8.0 |
| RB100 | R05 | 1 | 1.40 | medium | 45 | 30 | 2 | 5 | 102 | 8.0 |
| RB150 | R04 | 1 | 1.85 | medium | 20 | 30 | 1 | 5 | 95 | 4.0 |
| RB150 | R05 | 1 | 1.40 | medium | 20 | 30 | 1 | 4 | 92 | 4.0 |

Kit visits **1640 per month** (F3 assumed 1133), mean pick time **94 s** per visit (F4.1 assumed 90 s).

| AS/RS front busiest hour (simulated) | F4.1 assumptions | F4.3 kitting values |
|---|---|---|
| kit visits per h | 5.5 | 8.0 |
| crane utilisation | 49.5 % | 55.9 % |
| AGV wait p95 at TU1 | 14 s | 16 s |
| crane blocked by full P&D out | 2.70 % | 2.72 % |
| kit visits done per h | 5.3 | 7.5 |
| open orders at the end | 0 | 0 |

NIOSH - FIRST design (kit limit 8 kg, bins 15 kg): heaviest kitted part 7.3 kg (RB100 rotor):

| case | RWL kg | load kg | LI |
|---|---|---|---|
| pick from a near bin, top layer | 5.3 | 7.2 | 1.38 |
| pick from a near bin, bottom layer | 5.2 | 7.2 | 1.40 |
| pick from a FAR bin without pulling it | 0.0 | 7.2 | not allowed |
| lift a full bin (15 kg) out of the top layer to the side shelf | 8.9 | 15.0 | 1.69 |

-> LI > 1: the limits are now DERIVED from the RWL: kit only parts <= **5.0 kg** (RWL near picks 5.19 kg), fill bins to <= **8 kg** (RWL bin lift 8.88 kg).

NIOSH - FINAL design, heaviest kitted part 4.62 kg:

| case | H | V | D | FM | RWL kg | load kg | LI |
|---|---|---|---|---|---|---|---|
| pick from a near bin, top layer | 45 | 120 | 25 | 0.50 | 5.3 | 4.6 | 0.88 |
| pick from a near bin, bottom layer | 45 | 95 | 50 | 0.50 | 5.2 | 4.6 | 0.89 |
| pick from a FAR bin without pulling it | 85 | 95 | 50 | 0.50 | 0.0 | 4.6 | not allowed (H > 63 cm) |
| lift a full bin (15 kg) out of the top layer to the side shelf | 45 | 135 | 30 | 0.92 | 8.9 | 8.0 | 0.90 |

Bin-in-crate: the operator pulls a far bin (8 kg) to the near half: F = 0.4 x 8 x 9.81 = 31 N <= 100 N.

## D Gravity flow racks (line-side buffers)

Slope 5.5 % (3.15 deg) = light-crate resistance 5 % + 0.5 %; lane 4.2 m (max 3 places); without brakes a 300 kg crate reaches 1.44 m/s -> brake rollers every 1.05 m (v <= 0.30 m/s); separator holding force 206 N.

| dept | part | buffer crates | places (+1 in use) | lanes | length m |
|---|---|---|---|---|---|
| HMC | C01 | 4 | 5 | 2 | 4.2 |
| HMC | R01 (running RB variant) | 1 | 2 | 1 | 2.8 |
| HMC | R02 (running RB variant) | 1 | 2 | 1 | 2.8 |
| HMC | R03 (running RB variant) | 1 | 2 | 1 | 2.8 |
| HMC | empty-crate return (powered) | 0 | 3 | 1 | 4.2 |
| ROT | C07 | 2 | 3 | 1 | 4.2 |
| ROT | C09 | 4 | 5 | 2 | 4.2 |
| ROT | R06 (running RB variant) | 1 | 2 | 1 | 2.8 |
| ROT | R07 (running RB variant) | 1 | 2 | 1 | 2.8 |
| ROT | empty-crate return (powered) | 0 | 3 | 1 | 4.2 |
| VMC | C02 | 1 | 2 | 1 | 2.8 |
| VMC | C03 | 1 | 2 | 1 | 2.8 |
| VMC | C04 | 4 | 5 | 2 | 4.2 |
| VMC | C05 | 2 | 3 | 1 | 4.2 |
| VMC | C06 | 2 | 3 | 1 | 4.2 |
| VMC | C08 | 1 | 2 | 1 | 2.8 |
| VMC | R04 (running RB variant) | 1 | 2 | 1 | 2.8 |
| VMC | R05 (running RB variant) | 1 | 2 | 1 | 2.8 |
| VMC | empty-crate return (powered) | 0 | 3 | 1 | 4.2 |

Heights: entry 900 mm (AGV lifting deck, requirement F5), exit 669 mm (>= 650 mm for picking). Empties: ball-transfer deck at the exit (slide force 9 N for a 45 kg crate) -> powered return lane rising 0.7 % to 700 mm.

Flow racks: 53 places, 107800 EUR (reference, incl. ball decks and powered return lanes).
Face width along the AGV aisle (lane 1.05 m): HMC 6.3 m of 20.6 m, ROT 6.3 m of 10.9 m, VMC 10.5 m of 11.9 m.
The 28 line-side crates leave the motorised inbound lanes of F4.1 (-50400 EUR); net change **+57400 EUR**. F4.1 had put all line-side crates of a department into ONE lane - that is not FIFO per part: the operator could not reach the part that is needed. One lane per part type is a functional correction, not a saving.

## E HMC pallet load station

| class | mass kg | J kg m2 | omega rad/s | alpha rad/s2 | T N m | P W |
|---|---|---|---|---|---|---|
| FA | 493 | 16.0 | 0.785 | 0.785 | 16.2 | 15.9 |
| FC | 560 | 19.1 | 0.785 | 0.785 | 19.1 | 18.8 |

Index drive **0.12 kW** brake gear motor + index pin; slewing ring: axial 5.5 kN (fs 27.3), tilting 0.13 kN m from a 22 kg part dropped by the hoist (fs 77.2).
Clamping C01 (3 clamps): F = 2 x 3000 / (2 x 0.15 x 3) = 6667 N per clamp -> bore 18.4 mm -> **20 mm** swing clamp (7854 N at 250 bar).
Pallet accumulator: after 15 min machining p = 249.2 bar (switch 220 bar reached only after 655 min).

- FA: F1 model 158 s = 2.63 min (F2 used 2.63 min) + index/check 14 s -> 172 s per visit.
- FC: F1 model 346 s = 5.77 min (F2 used 5.77 min) + index/check 14 s -> 360 s per visit.
- Load-station utilisation 55.5 % (F2 MVA 57 %).
- NIOSH manual loading of the raw crankcase 16.5 kg: RWL 10.2 kg, LI 1.62 -> **lifting aid required** (jib crane + gripper).
- Light curtain operator / shuttle side: T = 345 ms, C = 128 mm: S(K=2000) = 818 mm > 500 -> K = 1600: **S = 680 mm**.
