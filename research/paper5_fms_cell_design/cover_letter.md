# Cover letter (draft – author to adapt and sign)

[Place, date]

To the Editor-in-Chief
*The International Journal of Advanced Manufacturing Technology*

Dear Editor,

we submit the original research article

**"Why pallet-based FMS cells deliver less than their machines: closed queueing models, dispatching rules and virtual
commissioning of a three-machine crankcase cell"**

for consideration in *The International Journal of Advanced Manufacturing Technology*.

**What the paper does.** Companies that introduce their first flexible manufacturing system usually size the cell
with a static capacity calculation of the machines. Using a three-machine crankcase cell designed for a compressor
factory, the paper shows that such a calculation overestimates the cell by a factor of 1.5–1.7 and explains why: the
manned single-location load station, the shuttle exchange and the dispatching rules of the cell controller. We combine
(i) an exact multi-server mean value analysis of the closed pallet network with a blocking-aware approximation and a
composite estimate, (ii) a replicated validation against the *real* supervisory controller software running on a
virtual plant of 21 simulated Modbus PLCs (virtual commissioning; 61 runs with confidence intervals and an
explicit validity criterion for time-compressed runs), (iii) the identification and removal of a dispatching-induced
failure mode – pallet lock-in with starvation of a fixture family – by an ablation study of four rule sets, and (iv) a
what-if analysis that yields a simple investment rule: increase the load-station capacity before buying another
machine.

**Fit to the journal.** The work addresses the design and control of advanced manufacturing systems at the process
level, with direct industrial application for machine-tool users, FMS suppliers and system integrators. It combines
an analytical method with a software-in-the-loop experiment, and all tools run with standard software on an offline
PC, which makes the method usable in small engineering departments and in emerging economies.

**Honesty about the data.** The case factory is in the design phase. All input data are design estimates and all
measurements are taken on a virtual plant; the manuscript labels every number accordingly and discusses this
limitation explicitly.

**Related manuscripts.** The paper is part of a doctoral project. Four further manuscripts from the same project are
in preparation or under review elsewhere, each with a distinct scope: a systematic literature review on digital twins
for FMS design and ramp-up; Bayesian updating of a design-stage digital twin; the Modbus TCP/HTTP machine interface and
job handshake used by the controller (referred to in the present paper only as the interface, without its results);
and a staged-investment model. No table, figure or result of the present manuscript appears in these papers. The
manuscript is based on chapters of the candidate's doctoral thesis, which has not been published [author to confirm;
cite the repository version if published before submission].

The manuscript has not been published and is not under consideration by any other journal. All authors have approved
the submission. [Generative-AI use is described in the Methods and in the Statements and Declarations.]

Yours sincerely,
[Author 1 – PhD candidate], on behalf of all authors
[Affiliation, e-mail, ORCID]

---

## Answers to the three submission questions of IJAMT

1. **Main contribution.** A design method for pallet-based FMS cells that combines exact multi-server MVA, a
   blocking-aware correction and a replicated validation against the real cell-controller software on a virtual plant,
   and that turns the results into an investment rule (load station before machines).
2. **Novelty.** The analytical models are validated against production control code rather than an idealised
   simulation, so the effect of dispatching rules on the number of circulating pallets becomes visible; a
   dispatching-induced pallet lock-in with fixture-family starvation is identified, explained and removed, and the
   effect of each rule is quantified by ablation.
3. **Industrial application and users.** Sizing and tendering of machining FMS (number of machines, load stations,
   fixture pallets), factory acceptance testing of cell controllers; users are machine-tool users introducing their
   first FMS, FMS suppliers, system integrators and consultants, particularly in emerging economies.
