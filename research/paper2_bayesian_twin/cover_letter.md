[Date]

To the Editor-in-Chief
*Journal of Manufacturing Systems*

**Submission of an original research article: "Sequential conjugate Bayesian updating of a digital twin for the ramp-up of flexible manufacturing systems: design-stage priors, calibrated forecasts and a virtual ramp-up study"**

Dear Editor,

We submit the above manuscript for consideration as a research article in the *Journal of Manufacturing Systems*.

**Problem and contribution.** Flexible manufacturing systems are planned with simulation models whose inputs are vendor statements and engineering estimates, but these design-stage models are rarely updated or checked once production starts. Our manuscript presents an uncertainty-aware digital twin that turns design statements into conjugate priors with an explicit "equivalent-data" confidence, updates failure, repair, cycle-time and scrap posteriors every month from machine events with a forgetting factor, propagates epistemic and aleatory uncertainty through a discrete-event model, and learns the remaining structural lag with an output-level discrepancy term. Every forecast is frozen before the data it is scored against exist.

**Novelty.** The individual statistical elements are known; the contribution lies in (i) their combination into a design-to-ramp-up twin of an FMS that runs in about 1.4 s per monthly forecast on an office PC, (ii) a frozen-prediction protocol that makes design-stage and ramp-up forecasts auditable, and (iii) a controlled evaluation in 100 virtual ramp-ups that separates the contribution of each component through ablations and compares the twin with simple data-driven forecasts — a comparison that digital-twin studies rarely report. The results show, among other things, that parameter uncertainty alone gives only 7 % coverage of nominal 90 % intervals during ramp-up, that a learned discrepancy term restores calibration (94 %), and that a naive persistence forecast is competitive for mature-phase output but provides neither calibrated uncertainty nor station-level knowledge such as the true bottleneck.

**Honest scope.** The factory used as the case is at the design stage. All case data are reference design estimates and all results are simulated; we state this throughout and provide a protocol for field validation. We believe the method and the evaluation design are of value to the journal's readership now, and the frozen design forecast reported in the paper will be scored against the real ramp-up later.

**Fit with the journal.** The manuscript addresses digital twins, simulation-based design and data-driven updating of manufacturing system models — core topics of the *Journal of Manufacturing Systems* — and it is relevant to manufacturers introducing their first flexible manufacturing systems with limited data infrastructure.

**Related manuscripts and prior dissemination.** The manuscript is based on part of the first author's doctoral thesis [title, university, year], which is not formally published. The 100-scenario experiments, additional baselines, ablations, robustness conditions, statistical tests and cost measurements were performed for this manuscript. Four related manuscripts by the same authors are in preparation and have not been submitted: a systematic literature review, a low-cost Modbus TCP/HTTP data architecture, staged FMS investment, and the process-level design of the pallet FMS cell. They address different research questions with different methods and results; they are cited as "in preparation" where relevant, and we will provide copies to the editor on request.

**Declarations.** This manuscript has not been published and is not under consideration for publication elsewhere, and it will not be submitted elsewhere while it is under review by the *Journal of Manufacturing Systems*. All authors have approved the manuscript and agree with its submission. There are no competing interests. Code and simulated data will be made openly available [repository and DOI]. The use of generative AI tools in the preparation of the manuscript is declared in the manuscript as required by the journal.

Thank you for considering our work.

Yours sincerely,

[Author 1 – PhD candidate], on behalf of all authors
[Affiliation]
[E-mail address]
