# Cover letter

[Date]

To the Editor-in-Chief, *Sensors* (MDPI)
[Section: Industrial Sensors / Internet of Things – verify]

**Submission of the manuscript "Event-Preserving Polling: A Low-Cost Digital-Twin and FMS-Control Architecture Using
Only Ethernet, Modbus TCP and HTTP"**

Dear Editor,

We submit the above manuscript for consideration as an Article in *Sensors*.

**Problem.** Small and medium-sized manufacturers in emerging economies who move from standalone CNC machines to
flexible manufacturing systems often cannot use the OPC UA or MQTT stacks that dominate digital-twin research: their
low-cost controllers offer Modbus TCP, their engineers maintain the systems themselves, and the plant must run offline.
Polling over Modbus, however, samples state signals – short stops between two polls are lost, and event time stamps are
only as precise as the poll period – which biases the failure and repair statistics a digital twin relies on.

**What is new.**

1. An *event-preserving register block* (change counter, last-change time stamp and an eight-entry ring maintained by the
   PLC) that turns polling into complete, time-stamped event capture and makes every residual loss detectable.
2. A closed-form *sizing model* for frame size, bandwidth, round-trip time, sequential and parallel poll-cycle time,
   detection latency, ring overflow, event loss and time-stamp error, including a new Poisson partial-expectation formula
   for the share of lost events and a closed form for the share of changes that state-only polling reports.
3. A *toggle-bit job handshake* for supervisory control over the same register interface, with a failure-case analysis
   that identifies one residual hazard (a stale toggle frame from an old TCP connection) and a one-line sequence guard
   that removes it.
4. A *laboratory evaluation with stated limits* on one PC with emulated PLCs: in 40 replicated runs with up to 160
   devices the event block recovered all 63 844 state changes, while state-only polling missed 9–45 %; across 1–16
   changes per poll interval (475 230 changes) the measured losses followed the new Poisson formula within 0.4
   percentage points and every loss was flagged; cycle times followed the capacity model within 0.1 % (sequential); the
   HTTP interface served the full plant snapshot more than 4 000 times per second; on a virtual plant of 21 Modbus PLCs a
   three-frame job command took 38–50 ms with a 10 ms PLC scan, fault injection confirmed exactly-once execution, and all
   61 acceptance checks passed.

**Fit to the journal.** The paper is about industrial data acquisition and its performance – a register-level sensing
mechanism, an analytical model of sampling and loss, and a reproducible measurement campaign – applied to digital twins
and IIoT in manufacturing. All code and raw data will be made openly available.

**Honesty about limits.** All measurements were taken on one PC over the loopback interface with emulated PLC response
times; no industrial PLC has yet been measured. The manuscript states this in the abstract, the methods and the
threats-to-validity section, and gives the verification plan with real controllers.

**Related work by the authors and originality.** The manuscript is derived from the first author's doctoral thesis
[title, university, year – thesis not yet published / deposited in repository: author to complete]; the text was newly
written and the experiments of Sections 6.2–6.6 were run anew for this paper (replication with five seeds, loss-model
validation, HTTP repetitions, handshake latency and fault injection). The doctoral project produces companion articles
with clearly separated scope: a systematic literature review (cited as reference [paper 1 number]; status: [under
review / accepted]), and articles on Bayesian updating of the twin during ramp-up, on staged investment and on pallet-cell
design, which do not overlap with the architecture, model and experiments presented here.

We confirm that this manuscript has not been published and is not under consideration for publication elsewhere, that
all authors have approved the submission, and that there are no conflicts of interest. Generative-AI assistance is
disclosed in the Acknowledgments [author to adapt].

Suggested reviewers are provided in the submission system [author to select according to `suggested_reviewers.md`].

Yours sincerely,

[Author 1 – PhD candidate], on behalf of all authors
[Affiliation, address, e-mail, ORCID]
