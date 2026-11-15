[Date]

The Editor-in-Chief
*Computers & Industrial Engineering*

Dear Editor,

We submit the manuscript **"Staged introduction of a flexible manufacturing system as a sequential capacity investment with a learning digital twin"** for consideration as a research article in *Computers & Industrial Engineering*.

**Problem and novelty.** Manufacturers that move from stand-alone CNC machines to a flexible manufacturing system (FMS) usually invest in steps. The capacity effect of each step is uncertain until the equipment runs. Capacity-expansion and real-options models handle demand uncertainty well, but they treat the capacity effect of an investment as known or as a fixed distribution. Digital-twin research offers learning mechanisms but rarely connects them to investment decisions. Our manuscript closes this gap:

1. It formulates the staged FMS introduction as a sequential capacity investment with options, precedence, stage budgets, an unmet-demand penalty, discounting and a mean–CVaR objective. The information state is the posterior of a Bayesian digital twin that learns machine performance during ramp-up.
2. It solves the problem with a rolling-horizon rule and a screening throughput model. The screening model is validated against discrete-event simulation both at output level and, rarely reported, at decision level.
3. It compares eleven policies on 200 seeded scenarios with paired tests. The baselines include a stochastic-programming fixed plan, myopic and bottleneck-greedy rules and a clairvoyant plan. A value-of-information analysis shows that the twin closes 84 % of the gap between a fixed design-time plan and perfect information.
4. It identifies boundary conditions under which staging with a twin does *not* pay. The main one is a stage budget that cannot fund the first effective step, which matters for capital-constrained SMEs.

**Fit with the journal.** The paper combines simulation, stochastic optimisation and Bayesian learning in an industrial-engineering decision problem (capacity planning and investment in manufacturing systems), with a reproducible computational study. This is the journal's core scope. All code runs with the Python standard library, and code and data will be made publicly available.

**Honesty about the case.** The case is a reference design of a compressor FMS. Investment costs are reference estimates, and the ramp-up is simulated with hidden "true factories". We present the work as a decision method demonstrated on a reference case and state this throughout the manuscript.

**Companion manuscripts and prior dissemination.** The manuscript is based on one chapter of the first author's doctoral thesis, extended substantially by new experiments (five times as many scenarios, four additional policies, value-of-information analysis, decision-level validation and further sensitivity analyses). Related but distinct manuscripts from the same doctoral project are a systematic literature review, a paper on the Bayesian updating model of the twin (used here as a component and only summarised), a paper on a Modbus TCP/HTTP data architecture and a paper on the queueing design of the pallet cell. Their research questions and results do not overlap with the investment-staging analysis presented here, and they are cited as companion papers. [Authors: add their current status and journals, and the thesis reference/repository, before submission.]

This manuscript has not been published and is not under consideration for publication elsewhere. All authors have approved the manuscript and agree with its submission. [Authors: add a statement on the use of generative AI consistent with the declaration in the manuscript.] There are no competing interests.

Thank you for considering our work.

Yours sincerely,

[Author 1 – PhD candidate], on behalf of all authors
[Affiliation, address, e-mail]
