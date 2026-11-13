# Doctoral research concept note

**Working title:** An uncertainty-aware, low-cost digital twin method for the stepwise introduction of flexible
manufacturing systems in emerging industries – cases of compressor and ball screw production

**Candidate:** Kenzo · **Supervisor:** [name] · **Institution:** [university, department] · **Date:** [date] · **Version:** 0.1 (draft for discussion)

---

**1. Problem.** In emerging manufacturing industries, standalone CNC machines are common, but flexible manufacturing
systems (FMS) are rarely established. Companies moving to FMS face three linked problems: (a) high investment under
uncertain design data (cycle times, failure rates, scrap, demand), (b) limited and low-cost technology (often only
Ethernet, Modbus TCP and HTTP, offline PCs, few skilled integrators), and (c) a long and risky ramp-up. A wrong FMS
configuration is expensive and hard to correct.

**2. Research gap (preliminary – to be confirmed by a systematic review).** Most digital twin and FMS research assumes an
advanced industrial setting (OPC UA, running MES, rich sensor data). Few studies (i) give a digital twin method that works
with low-cost, widely available technology, (ii) represent design-stage uncertainty explicitly and update it with real
commissioning and ramp-up data, and (iii) use this to support the *stepwise* move from standalone CNC to an integrated FMS.
Validation with real data from a greenfield factory is rare.

**3. Aim and research questions.** Aim: develop and validate a digital twin method that reduces investment risk and
shortens ramp-up when introducing an FMS in a resource-constrained setting.
- **RQ1 (system):** What architecture enables a reliable FMS digital twin using only low-cost technology (Modbus TCP,
  HTTP, offline computers), and what are its measurable limits (latency, data loss, cost)?
- **RQ2 (core method):** How can uncertain FMS design parameters be represented and updated with real commissioning and
  ramp-up data, and how much does this improve prediction accuracy compared with a deterministic design-stage model?
- **RQ3 (decision support):** How can the updated twin support the stepwise decisions of FMS introduction –
  configuration, staging (standalone CNC → connected CNC → flexible cell → FMS line → integrated FMS) and scheduling rules?

**4. Method.** Design science research. Discrete-event simulation with Monte Carlo uncertainty; Bayesian updating of
input parameters (e.g. failure rate λ ~ Gamma(α, β), updated to Gamma(α + n, β + T) after n failures in T operating hours);
the design-stage predictions are frozen and version-dated before construction and serve as the baseline. Evaluation
measures: monthly prediction error E = |predicted − actual| / actual, coverage of the predicted uncertainty intervals,
time to reach planned output, and quality of staging decisions.

**5. Case and data.** Case 1: a new FMS for V-type piston air compressors (design phase about 4 months, then 2–3 years of
construction and ramp-up). Case 2: a ball screw and linear guide line, to test generality. Data: supplier and acceptance
test data, machine states and cycle times logged over Modbus TCP/HTTP, production and ramp-up records. A working prototype
twin already exists (simulation, 3D, MES/ERP functions, Modbus/HTTP communication design), currently at digital-model level
with example data.

**6. Expected contributions.** *Scientific:* an uncertainty-aware digital twin method for FMS introduction under
technology and data constraints, validated on real ramp-up data from two cases. *Practical:* a low-cost reference
architecture and a staged FMS roadmap usable by other companies in emerging industries.

**7. Plan and publications.** Thesis by publication (if permitted):
P1 systematic literature review (year 1) · P2 low-cost twin architecture and lab validation (year 1–2) ·
P3 Bayesian-updated twin vs deterministic baseline on real ramp-up data (year 2–3) · P4 transfer to the ball screw case (year 3–4).

**8. Points to agree with the supervisor.** Thesis format (monograph or publications) and required number of papers;
scope (fields excluded: e.g. machine thermal error); target journals and conferences; confidentiality of company data;
possible industrial co-supervisor; date for the formal proposal.
