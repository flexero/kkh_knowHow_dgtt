H1 requires at least 40 machines with detection latency ≤ 1 s and event loss ≤ 0.1 %.

- **Loss:** 0.00 % in all runs with the event block, for up to 160 machines — far below 0.1 %. State-only polling
  fails the loss criterion in every configuration (2–37 % unreported changes). It is therefore the event block, not
  the polling rate, that makes a polling architecture complete.
- **Latency:** with $P$ = 0.25 s, the maximum latency is 0.26 s (parallel, 40 and 160 machines) and 0.30 s
  (sequential, 40 machines). With $P$ = 1 s, the mean (0.52 s) and the 95th percentile (0.95–1.00 s) meet the
  criterion, but the maximum exceeds it by the round-trip time (1.01–1.12 s), as Eq. (5.5) predicts. The design rule
  for a strict 1 s bound is therefore $P \le 1\,\mathrm{s} - \mathrm{RTT}_{max}$.
- **Scale:** a sequential gateway meets the criteria for 40 machines with $P \le 0.98$ s at $t_{scan}$ = 10 ms (cycle
  261 ms), but not for 160 machines at $t_{scan}$ = 20 ms. A parallel gateway meets them for 160 machines at both scan
  times.

**H1 is supported** under the stated PLC timing model, with two design rules as conditions: use the event block, and
either poll in parallel or size the sequential gateway with Eq. (5.4). The result must be confirmed with real PLCs and
a switched network (Section 5.8).
