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
