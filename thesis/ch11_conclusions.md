# Chapter 11 – Conclusions

> Draft v1.0 – 2026-11-14.

This thesis set out to help companies that move from standalone CNC machines to a flexible manufacturing system with
low-cost technology and uncertain design data. It developed and evaluated an uncertainty-aware, low-cost digital twin
method for the stepwise introduction of FMS and applied it to three reference design cases from emerging-industry
factory planning.

**What was done.** A systematic review of 28 studies showed that published manufacturing twins are mostly simulation
models with manual data exchange, that input uncertainty is rarely updated from real data and never with Bayesian
methods, that design predictions are almost never validated after start-up, that Modbus is absent, and that no study
follows a transition from standalone CNC machines to an FMS. Four contributions address these gaps:

1. **A Modbus-TCP-and-HTTP-only architecture** with an event-preserving register block in every PLC and closed-form
   sizing formulas. In laboratory measurements with up to 160 machines it lost none of 23 825 events, while state-only
   polling missed 2–37 % of state changes.
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

**Answers.** RQ1: a reliable twin is possible with Modbus TCP and HTTP alone if events are buffered in the PLC and the
gateway is sized correctly (H1 supported under emulated PLC timing). RQ2: sequential Bayesian updating with model
discrepancy predicts a new system much better and more honestly than a design study (H2 supported; H3 supported only
with discrepancy learning). RQ3: re-deciding the introduction steps with the learning twin increases value and reduces
downside and capital (H4 partly supported: under-capacity risk equal to all-at-once).

**Recommendations for industry.** Freeze the design prediction; put the register map and event block into every
purchase order; update the twin monthly during ramp-up and never calibrate once and freeze; invest in stages and
re-decide with what the twin has learned; before a new product family shares a flexible cell, analyse the cell as a
closed network with one chain per fixture type — the cheapest investment (a second load station) may be the decisive one.

**Outlook.** The decisive test lies ahead: the real ramp-up of the case factory, for which the design prediction has
already been frozen and the protocol defined. Beyond it, learning-curve parameters, hierarchical priors across machines
and factories, and an explicit valuation of flexibility would extend the method. The broader message is simple: in a
new factory, the design is a hypothesis — a digital twin is most valuable when it treats it as one, tests it with every
month of data and lets the answers shape the next investment.
