# F4.1 - load stations and conveyors: system definition and sizing (conv_system.py)

All values: DESIGN or REFERENCE ESTIMATE; DES results = SIMULATED.

## 1 Stations per department (crate flows, peak factor 1.6, H = 330 h/month)

| Dept | crates/month | peak in = out /h | station | line-side crates | lanes |
|---|---|---|---|---|---|
| RAW | 4010 | 9.72 | ASRS_FRONT | 0 | U-loop CV1/CV2/CV3, sized with the F3 crane moves (incl. receiving infeed and empty crates) |
| FIN | 2379 | 5.77 | PD | 0 | inbound 5 + outbound 4 places |
| VMC | 2198 | 5.33 | PD | 13 | inbound 18 + outbound 4 places |
| ROT | 1435 | 3.48 | PD | 8 | inbound 12 + outbound 3 places |
| HMC | 1303 | 3.16 | PD | 7 | inbound 10 + outbound 3 places |
| TOOL | 1200 | 2.91 | FLOOR | 0 | tool trolleys (AGV with trolley pick-up, floor station) |
| QC | 956 | 2.32 | PD | 0 | inbound 3 + outbound 2 places |
| BUY | 340 | 0.82 | PD | 0 | inbound 2 + outbound 2 places |
| CHIP | 180 | 0.44 | FLOOR | 0 | chip bins (floor station) |
| ASY | 113 | 0.27 | PD | 0 | inbound 1 + outbound 2 places |

**Crate flows vs F2 unit loads.** F2 counted transport units by family (P-L = 1 part per unit load, one kit per product); with the real crate contents of F3 the AGV flows are **7058** instead of **33987** unit loads per month (21 %). F5 sizes the AGV fleet with the crate flows.

| Dept | F2 unit loads | crates (F4.1) |
|---|---|---|
| RAW | 19840 | 4010 |
| FIN | 12200 | 2379 |
| VMC | 6593 | 2198 |
| ROT | 3227 | 1435 |
| HMC | 7660 | 1303 |
| TOOL | 1200 | 1200 |
| QC | 6933 | 956 |
| BUY | 3540 | 340 |
| CHIP | 180 | 180 |
| ASY | 6600 | 113 |

Not crates: BUY -> ASY 3200 unit loads/month (300 L tanks + motors) -> separate tank/motor feed of the assembly load station (F4.4).

Line-side crates (F3 ch. 10 refined): 28 instead of 42 - only one Roots variant runs at a time (weekly lot).

## 2 AS/RS front U-loop - simulation of the busiest hour (400 h simulated)

| Quantity | Value |
|---|---|
| arrivals by AGV / retrievals to AGV / kit visits per h | 17.2 / 17.2 / 5.5 |
| crane moves per h (simulated) | 44.7 |
| crane utilisation | 49.9 % |
| AGV wait at TU1: mean / p95 / max | 1.7 / 14 / 48 s |
| AGVs queuing at TU1 (max) | 2 |
| crates on CV1 (6 places): p99 / max; share of time full | 2 / 5; 0.00 % |
| crates on CV2 (6 places): p99 / max | 6 / 6 |
| retrieval lead time p95 (order -> crate at TU2 / pick) | 917 s |
| rejects / kit visits done per h | 0.51 / 5.4 |
| crane waiting because P&D out occupied | 2.56 % of time |
| open orders + waiting AGVs at the end (stability) | 3 |

CV1 occupancy distribution (0..6 crates): 66.8 %, 27.1 %, 5.3 %, 0.7 %, 0.1 %, 0.0 %, 0.0 %

CV2 occupancy distribution (0..6 crates): 27.9 %, 25.5 %, 20.4 %, 12.4 %, 6.2 %, 3.5 %, 4.1 %

## 3 Assembly carrier line

Products 10.3 /h average, 12.4 /h design (peak 1.2). Loop 100 m (department widths ASY 18.7, TST 11.6, PNT 5.0, PCK 2.5, SHP 18.4 m), transit 8.3 min.

| Group | stations c | t min/unit | rho | Erlang C | W_q min | queue places (P <= 5 %) |
|---|---|---|---|---|---|---|
| ASSY | 9 | 31.7 | 0.73 | 0.287 | 3.69 | 6 |
| TEST | 7 | 25.6 | 0.75 | 0.393 | 5.82 | 8 |
| PAINT | 1 | 2.4 | 0.48 | 0.485 | 2.21 | 4 |
| PACK | 2 | 5.0 | 0.52 | 0.350 | 1.81 | 3 |

Flow time per product 91.5 min -> Little: 18.9 carriers in the system -> **21 carriers** (+10 % spare); physical places on loop + spurs + queues: 110.

## 4 Module list (input of F4.2), I/O estimate (input of F4.5), cost

| Module | qty | EUR each | EUR | where |
|---|---|---|---|---|
| TU | 3 | 9000 | 27000 | AS/RS front 1; AS/RS front 1; AS/RS front 1 |
| CC | 9 | 3500 | 31500 | AS/RS front 1; AS/RS front 1; AS/RS front 1; AS/RS front 1; AS/RS front 1; AS/RS front 1; AS/RS front 1; AS/RS front 1; AS/RS front 1 |
| RCX | 1 | 4000 | 4000 | AS/RS front 1 |
| contour_gate | 1 | 6000 | 6000 | AS/RS front 1 |
| scale | 1 | 3000 | 3000 | AS/RS front 1 |
| RL | 71 | 1800 | 127800 | FIN 9; VMC 22; ROT 15; HMC 13; QC 5; BUY 4; ASY 3 |
| PD_end | 14 | 6000 | 84000 | FIN 2; VMC 2; ROT 2; HMC 2; QC 2; BUY 2; ASY 2 |
| loop_per_m | 100 | 1100 | 110000 | assembly loop 100 |
| spur_unit | 19 | 7000 | 133000 | assembly spurs 19 |
| corner_unit | 4 | 8000 | 32000 | assembly loop 4 |
| carrier | 21 | 650 | 13650 | assembly 21 |
| assy_load_station | 1 | 12000 | 12000 | assembly start (tank onto carrier) 1 |

Total **583950 EUR** against the F2 placeholder 450000 EUR (130 %). I/O estimate: DI 422, DO 248, AI 1.
