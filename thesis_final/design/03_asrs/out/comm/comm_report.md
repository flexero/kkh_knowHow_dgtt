# AS/RS Case B - expansion communication modules (asrs_comm.py)

All values: DESIGN or REFERENCE ESTIMATE. Module names are classes 'or equal' [verify in the current catalogue].

## 1 Interface demand and the module selection

| Case | CPU | demand PN_IO / ETH / RS485 / CAN / firewall | built-in enough? | cheapest module set | comm. modules EUR | backplane W (avail.) |
|---|---|---|---|---|---|---|
| A | S7-1515F-2PN | 1 / 1 / 0 / 0 / no | yes | none | 0 | 0.0 (10) |
| B1 | S7-1515F-2PN | 2 / 2 / 1 / 0 / yes | no: PN_IO 2 > 1, ETH 2 > 1, RS485 1 > 0, firewall at the PLC | CP1543-1 + CM1542-1 + CM_PtP_RS485_HF + PS60W | 4270 | 13.7 (70) |
| B2 | AS332P | 0 / 2 / 1 / 1 / yes | no: ETH 2 > 1, CAN 1 > 0, firewall at the PLC | AS-FEN02 + AS-FCOPM + EXT-FW | 2150 | 2.0 (10) |

Feasible alternatives (first 3 by price):

- A: none -> 4200 EUR
- A: PS60W -> 4620 EUR
- A: CM_PtP_RS485_HF -> 4850 EUR
- B1: CP1543-1 + CM1542-1 + CM_PtP_RS485_HF + PS60W -> 8470 EUR
- B1: CP1543-1 + CM1542-1 + 2x CM_PtP_RS485_HF + PS60W -> 9120 EUR
- B1: CP1543-1 + 2x CM1542-1 + CM_PtP_RS485_HF + PS60W -> 9770 EUR
- B2: AS-FEN02 + AS-FCOPM + EXT-FW -> 3050 EUR
- B2: AS-FEN02 + AS-FCOPM + AS00SCM-A + EXT-FW -> 3330 EUR
- B2: AS-FEN02 + AS-FCOPM + 2x AS00SCM-A + EXT-FW -> 3610 EUR

## 2 Modbus RTU line (19.2 kbit/s 8E1)

| addr | device | FC | regs | t_trans ms | every | update worst ms | need ms | ok |
|---|---|---|---|---|---|---|---|---|
| 1 | energy meter main supply (after -QB1) | 03 | 30 | 75.8 | 10 | 1532 | 5000 | yes |
| 2 | weighing terminal infeed scale (replaces the AI module -KF27) | 03 | 4 | 34.0 | 1 | 153 | 200 | yes |
| 3 | 24 V DC UPS (battery, mains fail) | 03 | 6 | 43.3 | 5 | 766 | 2000 | yes |

- Worst round (all due): 153.2 ms; mean round 50.3 ms.
- One device offline (=ASRS1+GC-PG1, one probe = timeout 200 ms): round 277 ms > 200 ms need of the scale -> **weighing window**: during a crate weighing only the scale is polled: 34.0 ms.

| baud | worst round ms | scale update ok |
|---|---|---|
| 9600 | 233.4 | NO |
| 19200 | 153.2 | yes |
| 38400 | 117.6 | yes |
| 115200 | 94.9 | yes |

- Line: 38 m, 4 unit loads; 120 ohm at both ends (master -KF5 and last slave -TB12); bias 390 ohm / 390 ohm at the master only.

## 3 Modbus TCP latency of a WMS command

| Case | mean ms | worst ms | requirement | ok |
|---|---|---|---|---|
| A | 109 | 218 | 1000 | yes |
| B1 | 113 | 226 | 1000 | yes |
| B2 | 109 | 218 | 1000 | yes |

## 4 PROFINET and CANopen load

- PROFINET Case A one network (13 devices): 2.30 %; Case B1 net 1 1.18 %, net 2 1.12 % (limit 50 %).
  Bandwidth is NOT the reason for the 2nd network; the reasons are fault isolation, F4 commissioning without the crane, and the line topology through the data light barrier.
- CANopen Case B2: 12 PDO frames + SYNC per 10 ms = 1677 bit -> 33.5 % at 500 kbit/s (67.1 % at 250 kbit/s -> too high); length 18 m <= 100 m.

## 5 When to choose which case

| Question | Case A (built-in) | Case B (expansion modules) |
|---|---|---|
| Ports needed <= ports of the CPU, no serial devices | yes - cheapest | not needed |
| Plant security asks for a firewall AT the machine (IEC 62443 conduit) | external firewall needed | CP with firewall (B1) |
| Serial devices (energy meter, weighing terminal, UPS, older drives) | gateway needed | RS-485 module / card |
| Separate networks for crane and conveyors (F4) | one network, more devices | 2nd IO controller (B1) |
| PLC family without PROFIsafe (Delta) | - | CANopen drives + hard-wired safety (B2) |
| Extra cost (comm hardware) | 0 | B1 4270 EUR, B2 2150 EUR |
