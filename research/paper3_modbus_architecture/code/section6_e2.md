### 6.2. Round-trip time and poll-cycle time

Figure 4 shows the RTT distributions of the replication campaign E2. With the emulated 10 ms scan the RTT was close to
uniform between about 1.3 and 11.5 ms (median 6.28–6.53 ms, 99th percentile 11.29–11.53 ms, mean 6.34–6.51 ms
across the 10 ms configurations), and with a 20 ms scan between about 1.5 and 21.5 ms (mean 11.44 ± 0.11 ms). The
measured mean lies about 0.3–0.5 ms above the emulation model $U(0, t_{scan}) + 1$ ms because `time.sleep` overshoots
(Table 7) and the gateway, server and Python interpreter add their own processing time; it did not depend on the
number of devices or on the gateway mode.

![Figure 4](figures/fig4_rtt.svg)

**Figure 4.** Empirical distribution of the FC03 round-trip time in campaign E2 (all requests of five seeds per
configuration) and the emulation model $U(0, t_{scan}) + 1$ ms [measured / calculated].

The cycle times (Table 8, Figure 5) confirm the capacity model. For the sequential gateway, Eq. (5) with the measured
mean RTT predicted every configuration within 0.1 %: for example 1 034.7 ms against 1 035.4 ± 8.5 ms for 160 devices
at a 10 ms scan, and 1 830.7 ms against 1 831.3 ± 18.0 ms at a 20 ms scan. The sequential gateway therefore cannot hold
$P$ = 1 s for 160 devices (achieved 0.962 ± 0.006 Hz, and 0.546 ± 0.006 Hz at a 20 ms scan) – exactly the limit of
Eq. (4). The parallel gateway polled 21, 40 and 160 devices in 11.1, 11.5 and 13.0 ms, i.e. in about one maximal PLC
response time, and held 4 Hz for 160 devices. Fitting Eq. (6) to these three points gives a gateway cost of
$t_{gw} \approx$ 0.013 ms per request; the value of 0.04 ms estimated in the thesis from sequential polling of
instantly answering servers is a conservative upper bound. The single-run results of the thesis campaign lie within the
confidence intervals of the replication (hollow symbols in Figure 5).

![Figure 5](figures/fig5_cycle.svg)

**Figure 5.** Poll-cycle time versus number of devices for sequential and parallel gateways: replication campaign E2
(mean ± 95 % CI over five seeds), thesis campaign (single runs) and Eqs. (5) and (6) [measured / calculated].

**Table 8.** Replication campaign E2: mix event model, ring $R$ = 8, 36-register FC03 polls, 5 seeds × 60 s per
configuration [measured; mean ± 95 % CI over seeds; model values in brackets: cycle time from Eq. (5) with the measured
mean RTT or Eq. (6) with $t_{gw}$ = 0.013 ms [calculated]; state-only share from a seeded Monte-Carlo simulation of
sampling at the achieved period [simulated]].

| N | Gateway | P [s] | t_scan [ms] | Cycle time [ms] (model) | Achieved rate [Hz] | RTT median / p99 [ms] | Changes | Event block: lost | State-only: reported [%] (model) | Latency mean / p95 / max [s] |
|---|---|---|---|---|---|---|---|---|---|---|
| 21 | sequential | 0.25 | 10 | 136.7 ± 0.7 (136.7) | 3.985 ± 0.001 | 6.53 / 11.53 | 1 872 | 0 | 90.2 ± 2.3 (90.5) | 0.128 / 0.240 / 0.292 |
| 21 | parallel | 0.25 | 10 | 11.1 ± 0.0 (10.9) | 3.986 ± 0.000 | 6.40 / 11.37 | 1 872 | 0 | 91.2 ± 1.9 (90.5) | 0.127 / 0.238 / 0.257 |
| 40 | sequential | 1.0 | 10 | 259.7 ± 2.2 (259.5) | 0.999 ± 0.000 | 6.50 / 11.52 | 3 325 | 0 | 63.5 ± 3.4 (64.5) | 0.507 / 0.954 / 1.033 |
| 40 | parallel | 1.0 | 10 | 11.5 ± 0.0 (11.3) | 0.999 ± 0.000 | 6.28 / 11.29 | 3 328 | 0 | 63.2 ± 2.7 (64.3) | 0.511 / 0.954 / 1.006 |
| 160 | sequential | 1.0 | 10 | 1 035.4 ± 8.5 (1 034.7) | 0.962 ± 0.006 | 6.47 / 11.52 | 13 356 | 0 | 63.5 ± 1.7 (63.8) | 0.521 / 0.990 / 1.137 |
| 160 | parallel | 1.0 | 10 | 13.0 ± 0.1 (13.1) | 0.999 ± 0.000 | 6.30 / 11.35 | 13 316 | 0 | 64.6 ± 1.8 (64.2) | 0.504 / 0.956 / 1.007 |
| 160 | parallel | 0.25 | 10 | 13.1 ± 0.1 (13.1) | 3.984 ± 0.001 | 6.34 / 11.35 | 13 504 | 0 | 90.5 ± 1.0 (90.7) | 0.125 / 0.239 / 0.259 |
| 160 | sequential | 1.0 | 20 | 1 831.3 ± 18.0 (1 830.7) | 0.546 ± 0.006 | 11.34 / 21.36 | 13 271 | 0 | 55.5 ± 1.5 (55.1) | 0.910 / 1.747 / 2.025 |

### 6.3. Completeness of event capture

Across the 40 runs of E2 the gateways observed 63 844 true state changes, and the event block recovered **every one
of them with the correct counter value, state code and PLC time stamp** – zero losses and zero mismatches in every run,
including the overloaded sequential configuration with an effective period of 1.83 s. With zero failures in
63 844 trials, the one-sided 95 % upper confidence bound on the per-event loss probability is
4.7 × 10⁻⁵ [calculated, exact binomial bound $1 - 0.05^{1/n}$]. This is consistent with Eq. (10): at the mix-model
rate $\lambda$ = 0.279 s⁻¹ the overflow probability of an 8-entry ring is 2.2 × 10⁻¹¹ for a 1 s interval and
4.2 × 10⁻⁹ for the 1.83 s interval of the overloaded case [calculated].

State-only polling of the same data reported only 63.2–64.6 % of the changes at $P$ = 1 s, 90.2–91.2 % at 0.25 s and
55.5 % in the overloaded case ($P_{eff}$ = 1.83 s); 9–45 % of the changes were missed. A seeded Monte-Carlo simulation of
state-only sampling of the mix model at the achieved effective period (no network, 10⁵ s of simulated time) predicted
these shares within 1.1 percentage points (values in brackets in Table 8). Detection latency of the event block followed
Eq. (7): the mean was 0.50–0.52 s at $P$ = 1 s (model 0.507–0.526 s) and 0.125–0.128 s at 0.25 s (model 0.132 s); the
maximum was 0.257–0.292 s at 0.25 s and 1.006–1.137 s at 1 s, so a strict 1 s latency bound requires
$P \le 1\,\mathrm{s} - \mathrm{RTT}_{max}$, as Section 4.3 states.
