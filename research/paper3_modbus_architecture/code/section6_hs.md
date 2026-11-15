### 6.6. Supervisory control: handshake latency and fault injection

**Handshake latency (E5).** The fmsctl virtual plant (21 PLCs, ports 18700–18720, 1 000-fold time scaling of the
process models, which does not affect the handshake) received 300 job commands per variant for the washer station. Two
command sequences were compared: the sequence of the current `fmsctl` driver (`DeviceLink.command`), which reads the
request and status registers and the acknowledged sequence number before writing, uses two parameter frames, and polls
status, sequence number and result in separate reads; and the minimal 3-frame sequence of Section 5.2, in which the
controller keeps REQ and the sequence number in memory and reads registers 8–10 in one frame. Two PLC timing variants
were used: the virtual plant as is (requests served and the toggle handled immediately) and an emulated scan-synchronous
PLC (each reply delayed by $U(0, 10) + 1$ ms; the toggle handled one 10 ms scan after the write was applied),
implemented by wrapping the server and device classes without changing the fmsctl code. All times were taken with
`perf_counter`.

Table 11 and Figure 7 show the results. Without PLC delay, a complete command took 0.25–0.36 ms on the loopback
interface (single FC03 round trip 0.016 ms): the handshake logic itself costs nothing measurable. With the emulated 10 ms
scan (single FC03 round trip 6.39 ms), the `DeviceLink` sequence needed 7 frames before the toggle and 10.9 frames in
total and took 88.8 ± 1.3 ms (95th percentile 107 ms). The 3-frame sequence halved the write phase (19.2 ms against
44.6 ms) and took 50.0 ± 1.0 ms with a 20 ms acknowledgement poll and 37.6 ± 0.8 ms with a 5 ms poll. Eq. (14) with the
measured RTT, $\delta$ = 0.5 ms and $q$ = 0.1 (the probability that the first read is answered more than one scan after
the toggle) predicts 88.1, 49.8 and 36.3 ms – within 3.5 % of the measurements [calculated]. Compared with machining
cycles of several minutes, even the slowest variant is negligible; the recommendation for map V1.3 is nevertheless the
3-frame sequence with a fast acknowledgement poll, because it also reduces the number of frames exposed to faults.

**Table 11.** Job-handshake latency on the fmsctl virtual plant (E5): 300 commands per row [measured; mean ± 95 % CI;
frames = Modbus transactions per command, in brackets those before and including the REQ toggle].

| Sequence | PLC scan [ms] | ACK poll [ms] | Frames | Write phase [ms] | ACK phase [ms] | Total [ms] | Total median / p95 / max [ms] |
|---|---|---|---|---|---|---|---|
| DeviceLink (fmsctl) | 0 | 20 | 10.0 (7) | 0.30 ± 0.00 | 0.06 ± 0.00 | 0.36 ± 0.00 | 0.35 / 0.40 / 0.95 |
| 3-frame | 0 | 20 | 4.0 (3) | 0.23 ± 0.00 | 0.02 ± 0.00 | 0.25 ± 0.00 | 0.24 / 0.29 / 0.48 |
| 3-frame | 0 | 5 | 4.0 (3) | 0.24 ± 0.00 | 0.02 ± 0.00 | 0.26 ± 0.00 | 0.26 / 0.29 / 0.35 |
| DeviceLink (fmsctl) | 10 | 20 | 10.9 (7) | 44.64 ± 0.83 | 44.12 ± 0.93 | 88.76 ± 1.30 | 89.20 / 107.16 / 118.22 |
| 3-frame | 10 | 20 | 4.9 (3) | 19.21 ± 0.57 | 30.77 ± 0.85 | 49.98 ± 1.03 | 51.28 / 62.43 / 70.14 |
| 3-frame | 10 | 5 | 4.9 (3) | 19.71 ± 0.56 | 17.85 ± 0.46 | 37.55 ± 0.76 | 37.00 / 48.88 / 54.74 |

![Figure 7](figures/fig7_handshake_latency.svg)

**Figure 7.** Job-handshake latency on the virtual plant, split into the write phase (until the REQ toggle is
acknowledged by the Modbus layer) and the acknowledgement phase; numbers are means in ms [measured].
