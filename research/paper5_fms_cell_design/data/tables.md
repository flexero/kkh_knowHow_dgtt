## Validation table: models vs virtual plant (revised rules, design mix)
| N placed | X measured | pallets used | U_H | U_L | U_S | A(N placed) | A(N used) | composite | B design(N) | B meas. inputs (N used) |
|---|---|---|---|---|---|---|---|---|---|---|
| 2 | 11.83 ± 0.69 | 2.0 ± 0.0 | 0.41 ± 0.01 | 0.48 ± 0.02 | 0.13 ± 0.01 | 11.58 | 11.58 | 11.58 | 10.78 | 10.97 ± 0.50 |
| 4 | 20.00 ± 0.79 | 4.0 ± 0.0 | 0.65 ± 0.03 | 0.80 ± 0.01 | 0.27 ± 0.01 | 18.53 | 18.53 | 17.78 | 15.66 | 16.87 ± 0.47 |
| 8 | 19.83 ± 0.32 | 5.2 ± 1.4 | 0.66 ± 0.05 | 0.81 ± 0.02 | 0.28 ± 0.02 | 22.70 | 20.23 | 17.78 | 17.46 | 17.67 ± 0.46 |
| 12 | 19.71 ± 0.66 | 4.8 ± 0.6 | 0.64 ± 0.05 | 0.79 ± 0.01 | 0.31 ± 0.01 | 23.82 | 20.23 | 17.78 | 17.78 | 17.24 ± 0.52 |

## Rule study (N = 12)
| mix | rules | X | pallets used | B pallets used | VC30 share | max overtaken | max overtaken VC30 | moves/part | nominal move [s] | L gap [s] | U_H | U_L | U_S | offline |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| design | before | 17.77 ± 0.68 | 3.8 ± 0.6 | 0.6 ± 1.1 | 0.11 ± 0.27 | 53.4 ± 23.4 | 48.0 ± 36.3 | 2.98 ± 0.04 | 29.7 ± 0.3 | 56.2 ± 1.4 | 0.55 ± 0.07 | 0.72 ± 0.00 | 0.44 ± 0.01 | 0 |
| design | fb | 17.77 ± 0.68 | 4.2 ± 0.6 | 1.2 ± 0.6 | 0.22 ± 0.22 | 25.2 ± 25.6 | 18.8 ± 30.0 | 2.99 ± 0.06 | 29.8 ± 0.6 | 55.9 ± 1.6 | 0.58 ± 0.07 | 0.72 ± 0.01 | 0.44 ± 0.01 | 0 |
| design | nro | 19.54 ± 0.82 | 4.2 ± 0.6 | 0.6 ± 1.1 | 0.13 ± 0.24 | 48.6 ± 40.9 | 43.4 ± 48.7 | 2.92 ± 0.07 | 20.0 ± 2.8 | 38.8 ± 4.7 | 0.61 ± 0.07 | 0.78 ± 0.02 | 0.32 ± 0.03 | 0 |
| design | after | 19.71 ± 0.66 | 4.8 ± 0.6 | 1.2 ± 0.6 | 0.25 ± 0.13 | 10.4 ± 9.9 | 5.2 ± 5.4 | 2.94 ± 0.03 | 18.7 ± 1.5 | 36.8 ± 2.4 | 0.64 ± 0.05 | 0.79 ± 0.01 | 0.31 ± 0.01 | 0 |
| vc30 | before | 18.06 ± 0.73 | 4.2 ± 0.6 | 2.0 ± 1.2 | 0.43 ± 0.35 | 32.8 ± 17.5 | 16.8 ± 24.5 | 2.96 ± 0.10 | 29.3 ± 1.3 | 53.6 ± 4.5 | 0.64 ± 0.08 | 0.73 ± 0.01 | 0.44 ± 0.02 | 0 |
| vc30 | after | 19.77 ± 0.46 | 5.4 ± 1.9 | 2.6 ± 1.4 | 0.44 ± 0.17 | 17.8 ± 15.2 | 8.0 ± 16.9 | 2.99 ± 0.11 | 17.6 ± 0.9 | 35.0 ± 2.6 | 0.70 ± 0.06 | 0.80 ± 0.01 | 0.29 ± 0.02 | 0 |

## Before rules at N = 4, 8
N=4 before: X 17.89 ± 0.32 pallets 4.0 ± 0.0 vc30 0.11 ± 0.05 overtaken 26.4 ± 14.5 min/max X 17.71/18.29
N=4 after: X 20.00 ± 0.79 pallets 4.0 ± 0.0 vc30 0.23 ± 0.03 overtaken 4.6 ± 0.7 min/max X 19.14/20.86
N=8 before: X 17.77 ± 0.68 pallets 3.8 ± 0.6 vc30 0.11 ± 0.26 overtaken 53.2 ± 23.8 min/max X 17.14/18.57
N=8 after: X 19.83 ± 0.32 pallets 5.2 ± 1.4 vc30 0.25 ± 0.12 overtaken 11.2 ± 9.3 min/max X 19.43/20.00
N=12 before: X 17.77 ± 0.68 pallets 3.8 ± 0.6 vc30 0.11 ± 0.27 overtaken 53.4 ± 23.4 min/max X 17.14/18.57
N=12 after: X 19.71 ± 0.66 pallets 4.8 ± 0.6 vc30 0.25 ± 0.13 overtaken 10.4 ± 9.9 min/max X 19.14/20.57

## Quick clamping (op x 100/140) and time compression
after x20 X 19.71 ± 0.66 U_L 0.79 ± 0.01 U_H 0.64 ± 0.05 op task 146.2 ± 4.2 L gap 36.8 ± 2.4 pallets 4.8 ± 0.6 B meas 17.24 ± 0.52 B ceiling meas 18.95 ± 0.64
after op100 X 24.86 ± 1.25 U_L 0.72 ± 0.03 U_H 0.81 ± 0.03 op task 104.0 ± 2.0 L gap 40.1 ± 6.6 pallets 6.6 ± 3.1 B meas 20.62 ± 0.39 B ceiling meas 22.39 ± 1.09
after x10 X 19.43 U_L 0.79 U_H 0.65 op task 149.3 L gap 38.4 pallets 5.0 B meas 16.93 B ceiling meas 18.44

## HMC balance (after / before, N = 12)
before 0.76 / 0.72 / 0.16
after 0.64 / 0.64 / 0.64

## What-if (model B, N = 12)
| Base design | 15.7 | 17.5 | 17.8 | +0 % | 5866 | 0.99 | 0.69 | 24.5 |
| Nearest-rack storage | 16.6 | 18.8 | 19.2 | +8 % | 6330 | 0.99 | 0.71 | 24.5 |
| Quick clamping (140 -> 100 s) | 17.9 | 20.5 | 21.3 | +20 % | 7019 | 0.97 | 0.83 | 30.1 |
| Fixture change 600 s every 20 parts | 14.2 | 15.4 | 15.6 | -12 % | 5145 | 1.00 | 0.60 | 20.2 |
| Two-position load station | 18.7 | 21.8 | 22.8 | +29 % | 7540 | 0.93 | 0.90 | 24.5 |
| Second load station | 20.6 | 24.2 | 25.0 | +40 % | 8234 | 0.73 | 0.99 | 30.1 |
| Two-position HMC changers | 16.3 | 17.7 | 17.8 | +0 % | 5888 | 1.00 | 0.59 | 24.5 |
| Fourth HMC (one load station) | 16.2 | 17.8 | 17.9 | +0 % | 5892 | 1.00 | 0.52 | 24.5 |
| Two-position load station + quick clamping | 21.4 | 24.4 | 25.0 | +41 % | 8252 | 0.73 | 0.99 | 30.1 |
| Second load station + fourth HMC | 21.8 | 28.1 | 29.6 | +66 % | 9760 | 0.91 | 0.90 | 40.2 |
| Second load station + two-position HMC changers + nearest rack | 23.5 | 28.3 | 29.4 | +66 % | 9712 | 0.79 | 0.98 | 30.1 |
