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
