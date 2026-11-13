The standard-library server delivers the complete plant snapshot about 4 500 times per second. With 16 simultaneous
clients, the 99th-percentile latency stays below 10 ms. A factory has tens of HTTP clients (MES terminals, browser
displays, the twin, ERP), each refreshing at most once per second — two to three orders of magnitude below the
measured capacity. The HTTP side is therefore not a bottleneck either.
