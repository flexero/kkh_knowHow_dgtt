## 6. Experimental Evaluation

### 6.1. Set-up, protocol and timing calibration

**Hardware and software.** All experiments ran on one PC: AMD Ryzen 7 9700X (8 cores, 16 logical processors), 64 GB
RAM, Windows Server 2022 Standard (10.0.20348), Python 3.12.10, standard library only. All traffic used the loopback
interface (127.0.0.1) and TCP ports 18500–18999. Other software was running on the PC during the campaign; the
system-wide CPU utilisation during each gateway run was recorded with the Windows `GetSystemTimes` counters and was
2.4–10.9 % in the Modbus campaigns.

**Emulated PLCs.** The machine process runs $N$ Modbus TCP servers, one thread per server and one per event generator.
Each server answers FC03 requests for its register block after a delay drawn from $U(0, t_{scan}) + 1$ ms
($t_{scan}$ = 10 or 20 ms), which emulates a PLC that serves Modbus at the end of its scan [assumption]; the register
snapshot is taken when the answer is sent. State changes follow one of two models: the *mix* model of the thesis bench
(30 % short pulses with duration $U(0.05, 0.5)$ s, 70 % states with exponential duration of mean 5 s; rate
$\lambda$ = 0.279 s⁻¹ per device) and a *Poisson* model (exponential durations with rate $\lambda$). Each change jumps
uniformly to one of the other three states and is logged with its true time (`time.perf_counter`, i.e. the Windows
QueryPerformanceCounter, which is system-wide, so the gateway and machine processes share one time base). Events are
scheduled on an absolute time grid, so sleep overshoot does not reduce the event rate. All random streams are seeded.

**Gateway.** A second process polls all devices with FC03 – sequentially or in parallel (`asyncio`, one connection per
device) – at a target period $P$, and reconstructs events in two ways: *state-only* (a change is reported when the state
code differs from the previous poll) and *event block* (Section 3.4). A recovered event counts as correct only if its
counter value, state code and PLC time stamp match the true log (identity check). Detection latency is the time from the
true change to the end of the poll that recovered it. Cycle time is the duration of one polling round; the achieved
rate is the number of polls per device divided by the observation time.

**Protocol.** E1 (timing calibration, Table 7); E2 (replication of the thesis campaign: 8 configurations × 5 seeds ×
60 s, mix model, ring $R$ = 8); E3 (loss-model validation: Poisson model with $\lambda$ = 4 and 16 s⁻¹, 50 devices,
parallel polling, $t_{scan}$ = 0, $\lambda P \in \{1, 2, 4, 6, 8, 10, 12, 16\}$, 60 s each); E4 (HTTP API: 3 request types ×
3 client counts × 5 repetitions × 10 s); E5 (handshake latency on the virtual plant, 300 commands per variant); E6 (fault
injection, 20 repetitions per case); E7 (acceptance tests). Every number below is labelled [measured] unless marked
otherwise; model values are [calculated] from Section 4 or [simulated] where stated.

**Timing calibration (E1).** Table 7 shows why the benches use `perf_counter` and thread-based sleeping. On this
platform `time.time()` has a nominal resolution of 15.625 ms; during our runs it advanced in 1 ms steps because another
process held the system timer at 1 ms, and the thesis campaign had observed steps of about 15.6 ms – a time stamp taken
with `time.time()` is therefore platform-state dependent and unusable for sub-millisecond intervals. `time.sleep()` never
woke early and overshot by 0.4–0.7 ms on average (maximum 1.5 ms). `asyncio.sleep(10 ms)` woke *early* in 7–8 % of the
calls (by up to 0.6 ms here; by up to one timer tick with the default 15.6 ms timer). An earlier version of the bench
emulated PLC delays with `asyncio.sleep`; with several pending requests the delays were partly skipped, and that
campaign was discarded. The final benches use `perf_counter` for every time stamp, `time.sleep` in threads with a 1 ms
timer resolution (`timeBeginPeriod(1)`), and re-check the deadline after every asyncio wake-up.

**Table 7.** Timing calibration of the measurement PC (E1) [measured; 300 calls per row].

| Function | Without timeBeginPeriod(1) | With timeBeginPeriod(1) |
|---|---|---|
| `time.time()` observed step (nominal resolution 15.625 ms) | 1.00 ms | 1.00 ms |
| `time.perf_counter()` observed step | 0.10 µs | 0.10 µs |
| `time.sleep(1 ms)`: mean / max [ms] | 1.71 / 2.50 | 1.64 / 2.50 |
| `time.sleep(10 ms)`: mean / max [ms] | 10.44 / 11.51 | 10.41 / 11.09 |
| `asyncio.sleep(10 ms)`: mean / min [ms]; share woken early | 10.35 / 9.38; 8.3 % | 10.36 / 9.96; 7.3 % |

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

### 6.4. Validation of the loss model across event rates

Campaign E2 could not test the loss formulas, because an 8-entry ring never overflowed at the mix-model rate. Campaign
E3 therefore drove 50 emulated devices with Poisson state changes at $\lambda$ = 4 and 16 s⁻¹ and chose $P$ so that the
mean number of changes per poll interval $\lambda P$ ranged from 1 to 16 (Table 9, Figure 6). In total 475 230 changes
were generated. For every interval the change counter gave the exact number of changes $N_\Delta$; its empirical
dispersion index (variance/mean) was 0.95–1.04, as expected for Poisson counts, and the measured mean $\hat\mu$ was
within 1.5 % of the nominal $\lambda P$ in 15 of 16 runs (12.21 instead of 12 in one run).

Three results stand out. First, the reconstruction was exact: the number of events lost according to the identity check
equalled $\sum (N_\Delta - R)^+$ from the counter in every run (77 080 lost events in total, zero mismatches), i.e. the
gateway lost precisely the events that did not fit into the ring and *reported* every such loss. Second, the share of
lost events agreed with the Poisson partial expectation, Eq. (11), evaluated at $\hat\mu$, within 0.0033 in absolute
terms over the whole range – from 1 lost event in 11 915 at $\hat\mu$ = 2 to half of all events at $\hat\mu$ = 16 – and
the share of overflowing intervals agreed with Eq. (10) within 0.01. The same curves held for both event rates, so the
loss depends on $\lambda P$ only, as the model states. Third, the share of changes reported by state-only polling agreed
with the new closed form, Eq. (9), within 0.011 over the whole range; already at $\lambda P$ = 1, state-only polling
reported only 55–56 % of the changes, whereas the event block captured all of them.

For design this means that Eqs. (10)–(12) can be trusted to choose the ring depth: with $R$ = 8 the model loss is about
10⁻⁶ at $\lambda P$ = 1, 1.5 × 10⁻⁴ at 2 and 0.8 % at 4 [calculated], and every lost event is flagged.

**Table 9.** Validation of the loss model (E3): 50 devices, Poisson changes, ring $R$ = 8, parallel polling, 60 s per
run [measured; model values calculated with Eqs. (9)–(11) at the measured $\hat\mu$].

| λ [s⁻¹] | P [s] | μ̂ (dispersion) | Intervals | Changes | Lost: identity / counter | Loss share: measured / Eq. (11) | Overflow share: measured / Eq. (10) | State-only reported: measured / Eq. (9) |
|---|---|---|---|---|---|---|---|---|
| 4 | 0.25 | 1.00 (0.99) | 11 950 | 11 928 | 0 / 0 | 0 / 0.0000 | 0 / 0.0000 | 0.564 / 0.553 |
| 4 | 0.5 | 2.00 (0.97) | 5 950 | 11 915 | 1 / 1 | 0.0001 / 0.0001 | 0.0002 / 0.0002 | 0.354 / 0.349 |
| 4 | 1 | 3.94 (1.03) | 2 950 | 11 624 | 90 / 90 | 0.0077 / 0.0078 | 0.019 / 0.020 | 0.190 / 0.189 |
| 4 | 1.5 | 6.04 (0.97) | 1 950 | 11 773 | 592 / 592 | 0.050 / 0.054 | 0.152 / 0.157 | 0.127 / 0.124 |
| 4 | 2 | 7.97 (0.97) | 1 450 | 11 557 | 1 574 / 1 574 | 0.136 / 0.138 | 0.402 / 0.403 | 0.095 / 0.094 |
| 4 | 2.5 | 9.99 (0.98) | 1 150 | 11 491 | 2 826 / 2 826 | 0.246 / 0.246 | 0.670 / 0.666 | 0.074 / 0.075 |
| 4 | 3 | 12.21 (0.95) | 950 | 11 598 | 4 133 / 4 133 | 0.356 / 0.357 | 0.848 / 0.858 | 0.059 / 0.061 |
| 4 | 4 | 16.16 (0.96) | 700 | 11 312 | 5 720 / 5 720 | 0.506 / 0.506 | 0.976 / 0.980 | 0.047 / 0.046 |
| 16 | 0.0625 | 1.01 (1.00) | 47 400 | 47 743 | 0 / 0 | 0 / 0.0000 | 0 / 0.0000 | 0.554 / 0.550 |
| 16 | 0.125 | 2.01 (1.01) | 23 850 | 47 872 | 7 / 7 | 0.0001 / 0.0002 | 0.0003 / 0.0002 | 0.349 / 0.348 |
| 16 | 0.25 | 4.01 (0.99) | 11 950 | 47 923 | 401 / 401 | 0.0084 / 0.0085 | 0.021 / 0.022 | 0.186 / 0.186 |
| 16 | 0.375 | 6.02 (0.98) | 7 950 | 47 833 | 2 427 / 2 427 | 0.051 / 0.053 | 0.155 / 0.155 | 0.124 / 0.125 |
| 16 | 0.5 | 8.04 (1.00) | 5 950 | 47 826 | 6 779 / 6 779 | 0.142 / 0.142 | 0.416 / 0.413 | 0.093 / 0.093 |
| 16 | 0.625 | 10.05 (1.04) | 4 750 | 47 753 | 11 965 / 11 965 | 0.251 / 0.249 | 0.670 / 0.673 | 0.075 / 0.075 |
| 16 | 0.75 | 12.08 (0.99) | 3 950 | 47 698 | 16 750 / 16 750 | 0.351 / 0.351 | 0.850 / 0.850 | 0.063 / 0.062 |
| 16 | 1 | 16.06 (0.96) | 2 950 | 47 384 | 23 815 / 23 815 | 0.503 / 0.503 | 0.983 / 0.979 | 0.047 / 0.047 |

![Figure 6](figures/fig6_loss_model.svg)

**Figure 6.** Validation of the loss model (E3). (a) Share of events lost by the event block (squares/circles) and share
of intervals with more than $R$ = 8 changes (crosses) versus the mean number of changes per poll interval, with
Eqs. (11) and (10). (b) Share of changes captured by state-only polling (squares/circles) with Eq. (9), and by the event
block (diamonds) with $1 - \eta$. Points for $\lambda$ = 4 and 16 s⁻¹ largely coincide [measured / calculated].

### 6.5. HTTP/JSON interface

The standard-library HTTP server (separate process, HTTP/1.1 keep-alive) served three request types: the full plant
snapshot of 160 devices (35.5 kB JSON), a page of up to 100 events after a given sequence number (6.3 kB), and an MES
booking (POST). Table 10 shows throughput and latency over five repetitions; the confidence intervals are narrow (at
most ±3 % of the mean for throughput). The snapshot was delivered about 4 100–4 500 times per second, and even with 16
concurrent clients the 99th-percentile latency stayed below 10 ms. Event catch-up pages and bookings were served
11 900–21 700 times per second. The client threads ran in the same Python process as the measurement, so these values
are lower bounds for the server. A factory has tens of HTTP clients (MES terminals, browser screens, the twin, the ERP
link), each refreshing at most about once per second, i.e. two to three orders of magnitude below the measured
capacity. The thesis values (single 10 s runs: 4 340 / 4 494 / 4 521 snapshot requests per second for 1 / 4 / 16 clients)
are reproduced within 5 %.

**Table 10.** HTTP/JSON API on the same PC (E4): 10 s per configuration, 5 repetitions [measured; mean ± 95 % CI over
repetitions].

| Request | Clients | Requests per second | Median latency [ms] | p99 latency [ms] |
|---|---|---|---|---|
| GET /api/state (160 devices, 35.5 kB) | 1 | 4 129 ± 61 | 0.23 ± 0.00 | 0.32 ± 0.04 |
| | 4 | 4 387 ± 34 | 0.91 ± 0.01 | 1.10 ± 0.04 |
| | 16 | 4 540 ± 67 | 2.99 ± 0.06 | 9.47 ± 0.13 |
| GET /api/events?since=k (100 events, 6.3 kB) | 1 | 11 876 ± 210 | 0.08 ± 0.00 | 0.14 ± 0.01 |
| | 4 | 14 659 ± 392 | 0.27 ± 0.01 | 0.56 ± 0.11 |
| | 16 | 15 510 ± 118 | 0.88 ± 0.01 | 2.75 ± 0.04 |
| POST /api/event (MES booking) | 1 | 16 694 ± 315 | 0.06 ± 0.00 | 0.10 ± 0.00 |
| | 4 | 21 709 ± 430 | 0.18 ± 0.00 | 0.35 ± 0.01 |
| | 16 | 21 119 ± 25 | 0.72 ± 0.00 | 1.63 ± 0.01 |

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

**Fault injection (E6).** A Modbus-aware TCP proxy was placed between the `fmsctl` client (`DeviceLink`, 0.5 s
time-out, one retry over a new connection) and the virtual PLC of the washer. In each repetition the proxy disturbed
exactly one frame type of one command; an instrumented copy of the PLC model counted how many jobs it really started
(Table 12). In all single-fault cases (F1–F6, 120 commands) every command started exactly one job with the correct job
id, and the controller did not even report an error, because the retry over a new connection re-wrote the same
absolute values. When the REQ frame was lost on both attempts (F7), the command failed with a Modbus error, no job was
started, and the controller rule "device idle and finished-job id ≠ job id" correctly allowed the job to be re-sent;
all 20 re-sent jobs ran exactly once. The stale-frame case F8 confirmed the hazard of Section 5.3: with the toggle-only
logic of map V1.2, replaying the old REQ frame after the next command started the current job a second time in all 20
repetitions; with the sequence guard, all 20 stale toggles were ignored, no job ran twice, and the next command
succeeded after the controller's REQ reset.

**Table 12.** Fault injection on the handshake (E6) [measured on the virtual plant; 20 repetitions per case].

| Case | Injected fault (one per command) | Commands | Jobs started | Exactly once | Controller error | Outcome |
|---|---|---|---|---|---|---|
| F0 | none | 20 | 20 | 20 | 0 | correct |
| F1 | REQ request lost once | 20 | 20 | 20 | 0 | correct (retry) |
| F2 | REQ response lost once (PLC already accepted) | 20 | 20 | 20 | 0 | correct (idempotent retry) |
| F3 | REQ request duplicated | 20 | 20 | 20 | 0 | correct |
| F4 | REQ response late (0.8 s > 0.5 s time-out) | 20 | 20 | 20 | 0 | correct (idempotent retry) |
| F5 | response to code + sequence frame lost once | 20 | 20 | 20 | 0 | correct |
| F6 | response to parameter frame lost once | 20 | 20 | 20 | 0 | correct, parameters as sent |
| F7 | REQ request lost on both attempts | 20 | 0 (+20 after re-send) | 0 (+20) | 20 | no job lost or doubled; re-sent correctly |
| F8a | stale REQ frame replayed after the next command, toggle only (V1.2) | 40 | 60 | – | 0 | **20 double executions** |
| F8b | as F8a, with sequence guard | 40 | 40 | 40 | 0 | 20 stale toggles ignored; next command correct |

### 6.7. Acceptance tests

The four acceptance-test programs of the control software (Table 6) were re-run for this paper without modification,
with the virtual-plant and HTTP ports remapped to 18900–18999 by a small wrapper script; all 61 checks passed
(20 + 15 + 11 + 15). These tests exercise the complete control functions – dispatching, recovery after a controller
restart, the *unknown* state after a lost job result, tool checks and logistics – on the same register interface whose
timing and fault behaviour were measured above.
