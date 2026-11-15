# F4.2 - conveyor modules: mechanical design (conv_mech.py)

All values: DESIGN; catalogue values REFERENCE [verify].

## 12 Crate base and conveyor orientation

Crate base: 2 runners 100 x 160 mm along the 1200 side. Rollers under one runner at pitch 150 mm: 8 (rule >= 3, max pitch 400 mm).

| Conveyor | crate orientation | contact | verdict |
|---|---|---|---|
| CC chain zone (AS/RS CV1, CV2) | 800 leading | runners cross the 2 chains | OK |
| TU chain part (x) | 800 leading | runners cross the 2 chains | OK |
| TU roller part (y) | 1200 leading | runners cross the rollers | OK |
| RCX Z31 / RL P&D lanes | 1200 leading | runners cross the rollers | OK |
| roller conveyor 800 leading | 800 leading | runners PARALLEL to the rollers | NOT ALLOWED |

## 13 Chain zone CC - chain selection (per strand, zone 1.2 m, crate 300 kg, k_s 1.4)

| chain | F_top N | F_ret N | F_acc N | F N | SF static | p MPa | roller p MPa | ok |
|---|---|---|---|---|---|---|---|---|
| 08B-1 | 178 | 2.1 | 46 | 225 | 57 | 6.3 | 3.19 | yes |
| 10B-1 | 178 | 2.8 | 46 | 226 | 71 | 4.7 | 2.50 | yes |
| 12B-1 | 178 | 3.7 | 46 | 228 | 91 | 3.6 | 2.09 | yes |
| 16B-1 | 180 | 7.9 | 47 | 235 | 182 | 1.6 | 1.81 | yes |
| 20B-1 | 182 | 10.6 | 48 | 240 | 283 | 1.1 | 1.32 | yes |

Selected **12B-1** (minimum 12B-1 for robustness). Sprocket z = 15, d0 = 91.6 mm, n = 41.69 rpm, shaft torque 22.0 N m; chain 2.69 m = 142 links, take-up >= 54 mm.

## 14 Gear motor CC

P needed 146 W (incl. k_s) -> **0.18 kW**, 4-pole, helical-bevel hollow-shaft gear motor, i = 34; output torque nominal 38 N m vs need 30.8 N m; start check OK.

## 15 Drive shaft (C45E +N)

Radial load per sprocket R = 251 N, overhang a = 90 mm -> M = 22565 N mm; torque (k_s) 30776 N mm.

| d mm | sigma_b MPa | tau MPa | sigma_v MPa | SF static | SF fatigue | twist deg/m | strand offset mm | ok |
|---|---|---|---|---|---|---|---|---|
| 20 | 28.7 | 19.6 | 44.5 | 7.6 | 3.4 | 0.693 | 0.499 | no |
| 25 | 14.7 | 10.0 | 22.8 | 14.9 | 6.6 | 0.284 | 0.204 | no |
| 30 | 8.5 | 5.8 | 13.2 | 25.8 | 11.4 | 0.137 | 0.099 | yes |
| 35 | 5.4 | 3.7 | 8.3 | 41.0 | 17.2 | 0.074 | 0.053 | yes |
| 40 | 3.6 | 2.4 | 5.6 | 61.2 | 25.7 | 0.043 | 0.031 | yes |
| 45 | 2.5 | 1.7 | 3.9 | 87.1 | 36.6 | 0.027 | 0.019 | yes |
| 50 | 1.8 | 1.3 | 2.8 | 119.5 | 50.2 | 0.018 | 0.013 | yes |

Selected **d = 30 mm** (the minimum 25 mm is set by the hollow shaft of the gear motor and the key).

## 16 Bearings

**UCP206** (C = 19.5 kN), P = 251 N, n = 41.7 rpm -> L10h = 1.88e+08 h (>= 30000 h): the bearing is chosen by the shaft, not by the load.

## 17 Roller zones RCX / RL (1.4 m, 1200-leading)

9 rollers per zone, 8 under the crate; design load per roller 981 N (max of uneven x share and m g / 3).

| tube D x t | I mm4 | M N mm | sigma MPa | delta mm (limit 2.0) | ok |
|---|---|---|---|---|---|
| 50 x 1.5 | 67265 | 76028 | 28.3 | 0.66 | load ok, below robustness minimum |
| 60 x 2 | 153423 | 76028 | 14.9 | 0.29 | yes |
| 80 x 2 | 372957 | 76028 | 8.2 | 0.12 | yes |
| 89 x 3 | 750248 | 76028 | 4.5 | 0.06 | yes |

Selected tube **60 x 2** (robustness minimum 60 x 2; by load alone 50 x 1.5 would pass), axle 20 mm, bearings L10h 5.46e+06 h at 64 rpm. Drive: F = 184 N (rolling + acceleration of crate and rollers), 9 chain loops eta 0.834, P 67 W -> **0.12 kW**, i = 22; first loop pull 232 N, 08B safety 55.

## 18 Transfer unit lift (eccentric)

Lifted mass crate + roller set: F = 4022 N; eccentricity 15 mm; M_max = 71 N m at 90 deg; 180 deg in 1.5 s -> 20 rpm; P_peak 149 W -> **0.25 kW** brake gear motor, i = 70. Top dead centre = self-locking (no holding torque); 1006 N per lift point.

## 19 Frame and stopping

Side frame C 160 x 65 x 5 cold-formed (S355), leg pitch 1.2 m: delta 0.05 mm (limit 1.60), sigma 7.0 MPa; leg load 1727 N. The profile is chosen by the space for chain guides, sprockets and bearing units, not by strength.
Stopping from 0.2 m/s at 0.5 m/s^2 with 20 ms reaction: 44 mm << gap 400 mm; slow-down sensor 250 mm and stop sensor 60 mm before the zone end.

Energy per crate per chain zone: 626 J (0.174 Wh).
