# Chapter 11 – Conclusions

> Draft v2.0 (edition 2) – 2026-11-15.

This thesis set out to help companies that move from standalone CNC machines to a flexible manufacturing system with
affordable, standard-based technology and uncertain design data. It developed and evaluated an uncertainty-aware digital
twin method with interoperable OPC UA / MQTT communication for the stepwise introduction of FMS and applied it to three
reference design cases from emerging-industry factory planning.

**What was done.** A systematic review of 28 studies showed that published manufacturing twins are mostly simulation
models with manual data exchange, that input uncertainty is rarely updated from real data and never with Bayesian
methods, that design predictions are almost never validated after start-up, that standard communication technologies
are proposed but not measured at factory scale or compared with the simplest alternative, and that no study follows a
transition from standalone CNC machines to an FMS. Four contributions address these gaps:

1. **An interoperable, standard-based architecture** for the twin and the supervisory FMS control, running offline on
   one industrial PC: OPC UA servers with information models following OPC 40001-1 and OPC 40501-1, state changes and
   job completions delivered as events, an MQTT broker with Sparkplug B as unified namespace, VDA 5050 for the AGVs and
   certificate-based security, with the twin's observations mapped to standard model nodes and analytical sizing (about
   0.9 Mbit/s for the 21-device case factory at a 0.25 s sampling interval). Measured on a laboratory bench with emulated machines, it delivered every state change (100 %, also through a 5 s
   broker outage with QoS 1/2 and store-and-forward) with a median latency of 54 ms and a maximum below 140 ms for up to
   100 devices, using about 1 % of one CPU core — H1 is supported under the condition of event-based delivery.
2. **An uncertainty-aware twin** that turns design statements into conjugate priors, updates failure, repair, cycle-time
   and scrap parameters sequentially with forgetting, and learns its own model discrepancy. In a virtual ramp-up with
   hidden true factories it reduced the monthly prediction error to 3.6 % with honest 90 % intervals (94 % coverage),
   where the design model erred by 12 % and a one-time calibration by 24 %, and it identified the true bottleneck in
   97–100 % of the factories after four months.
3. **A stepwise introduction method** that re-decides investment options with the updated twin. It achieved the highest
   expected value and the best downside with 44 % less capital than an all-at-once investment; two thirds of its advantage
   over a fixed plan came from learning the machines.
4. **Application and implementation**: a frozen design prediction of 6 176 compressors per month (90 %: 5 916–6 413) for
   the compressor FMS, a robust recommendation of the first investment steps, the identification of two tied bottlenecks
   in the ball screw line that only operation can resolve, for the Roots blower extension the finding that the
   shared FMS cell, not the new equipment, becomes the factory bottleneck and that a second load station is the first
   investment step (with a frozen prediction of 459 blowers per month and a successful transfer of the twin), a validation
   protocol for the real ramp-up, and a dependency-free
   implementation — including an interactive browser version of every calculation — that runs on one offline PC.

**Answers.** RQ1: an OPC UA + MQTT/Sparkplug B architecture with standard information models can supply the twin and
the FMS control with semantically described machine data without per-machine register mapping, provided that state
changes are delivered as events and every machine carries only one session; on the laboratory bench it delivered 100 % of the state changes with a median latency of 54 ms, provided they are
sent as OPC UA events and MQTT uses QoS ≥ 1 with store-and-forward; sampled data with queue size 1 lose short states. The minimal Modbus TCP/HTTP architecture remains the cheaper choice for small, stable plants with
legacy controllers (Table 10.2). RQ2: sequential Bayesian updating with model
discrepancy predicts a new system much better and more honestly than a design study (H2 supported; H3 supported only
with discrepancy learning). RQ3: re-deciding the introduction steps with the learning twin increases value and reduces
downside and capital (H4 partly supported: under-capacity risk equal to all-at-once).

**Recommendations for industry.** Freeze the design prediction; put the data interface — an OPC UA server with the
standard machine model, events and security, or at least a register map with event block — into every purchase order;
let all consumers share one unified namespace; update the twin monthly during ramp-up and never calibrate once and freeze; invest in stages and
re-decide with what the twin has learned; before a new product family shares a flexible cell, analyse the cell as a
closed network with one chain per fixture type — the cheapest investment (a second load station) may be the decisive one.

**Outlook.** The decisive test lies ahead: the real ramp-up of the case factory, for which the design prediction has
already been frozen and the protocol defined. Beyond it, learning-curve parameters, hierarchical priors across machines
and factories, an explicit valuation of flexibility and the exchange of learned machine behaviour with suppliers through
standard models would extend the method. The broader message is simple: in a
new factory, the design is a hypothesis — a digital twin is most valuable when it treats it as one, tests it with every
month of data and lets the answers shape the next investment.
