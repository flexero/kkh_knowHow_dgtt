Across all 15 runs the gateway observed **{TOTAL} true state changes, and the event block recovered every one of
them**: the loss was 0.00 % in every run, including 160 machines polled only every 1.85 s. Its time stamps were
identical to the logged truth, because the emulated PLC writes exact time stamps; real PLCs add their scan-time
resolution (Section 5.8). State-only polling of the same data reported only 63–71 % of the changes at $P$ = 1 s,
89–91 % at 0.25 s and 98 % at 0.1 s.

**Comparison with the formulas of Section 5.5.**
- *Sequential capacity (Eq. 5.4).* The measured RTT (median 6.5 ms; the mean is slightly higher because sleeps
  overshoot by about 0.5 ms) gives cycle times of 261 ms for 40 machines and 1 046 ms for 160 machines, against 242 ms
  and 968 ms predicted with $\mathbb{E}[\mathrm{RTT}] = 6.05$ ms. With 160 machines the sequential gateway can no longer
  hold $P$ = 1 s (achieved 0.96 Hz), and with $t_{scan}$ = 20 ms it falls to 0.54 Hz (cycle 1 846 ms; predicted
  1 768 ms) — exactly the limit of Eq. (5.4).
- *Parallel polling.* The parallel gateway polls 160 machines in 14 ms (24 ms with $t_{scan}$ = 20 ms), i.e. in about
  one maximal PLC response time. It holds 4 Hz for 160 machines and 10 Hz with instantly answering devices (3.5 ms
  cycle). The gateway's own cost is about 0.04 ms per request on this PC: 6.7 ms for 160 sequential requests to devices
  that answer instantly. The raw loopback RTT is 0.014 ms and does not depend on the number of registers between 1 and
  125 (`comm_rtt.json`).
- *Latency (Eq. 5.5).* Mean latencies of 0.51–0.54 s at $P$ = 1 s and 0.13–0.14 s at 0.25 s match
  $P_{eff}/2 + \mathrm{RTT}$. The maximum equals $P_{eff} + \mathrm{RTT}_{max}$: 1.01–1.12 s at $P$ = 1 s, and 2.04 s for
  the overloaded sequential case.
- *State-only loss (Section 5.5.4).* The formula predicts that 28 %, 7 % and 1.5 % of state segments are unobserved
  at 1, 0.25 and 0.1 s. The measured shares of unreported changes (29–37 %, 9–11 %, 2 %) are slightly higher, as
  expected, because A → B → A sequences within one interval are lost in addition.
