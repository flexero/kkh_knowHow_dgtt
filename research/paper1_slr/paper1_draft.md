# Digital twins for the design, ramp-up and stepwise introduction of flexible manufacturing systems under technology and data constraints: a systematic review

**Draft v0.9 (complete manuscript) – 2026-11-13 – author: Kenzo – co-author(s): [supervisor]**

> Status: complete manuscript based on the 28 included studies (corpus frozen 2026-11-13, no further search by
> decision of the author). Open items in [brackets]: kappa values after the author's verification of screening,
> supervisor name. References marked (verify) were checked by bibliographic record only.

---

## Abstract
**Purpose –** Many manufacturers in emerging industries operate standalone CNC machines and are now moving toward
flexible manufacturing systems (FMS). This review examines how digital twins (DTs) support the design, commissioning,
ramp-up and stepwise introduction of FMS when technology, budget and data are constrained.
**Method –** A systematic review following PRISMA 2020 was conducted in OpenAlex for 2015–2026. Of 445 screened
records, 204 were eligible for full-text assessment; 42 open-access full texts were assessed and 28 studies included.
Studies were coded for architecture and communication, uncertainty representation and updating, life-cycle phase,
validation, context and a five-level transition scale from standalone CNC to integrated FMS.
**Findings –** 18 of 28 studies describe digital models with manual data exchange. Input uncertainty is represented in
12 studies, almost always by fixed distributions; only 2 update input parameters automatically from real data, and
none uses Bayesian updating with plant data. Predictions are compared with reality in 5 studies, and only one compares
design-stage predictions with a newly commissioned system (17 % initial cycle-time error). No study covers ramp-up with
data, uses Modbus, or follows a transition from standalone CNC to FMS; evidence from emerging economies stays at
current-state models or synthetic data.
**Originality –** The review crosses uncertainty handling, life-cycle phase, technology constraints and context, and
proposes a research agenda for design-stage predictions that are frozen, updated sequentially with commissioning and
ramp-up data, validated against reality and delivered with low-cost technology.
**Keywords:** digital twin; flexible manufacturing system; ramp-up; uncertainty; Bayesian updating; SME; emerging economies

---

## 1. Introduction

Flexible manufacturing systems combine numerically controlled machine tools, automated material handling and a
central control system so that a variety of parts can be produced with short changeovers. In industrialised
economies FMS have been in use for decades, and current research focuses on their integration with digital twins,
industrial communication standards and data-driven control. In many emerging industries, however, the starting point
is different: standalone CNC machines are common, while FMS, manufacturing execution systems and machine
connectivity are only beginning to be introduced.

Introducing an FMS is a large and largely irreversible investment. Decisions on the number and type of machines,
pallet and buffer capacity, transport system and control rules must be taken during design, when key parameters –
cycle times, failure and repair behaviour, scrap rates and demand – are uncertain. Errors in these decisions become
visible only during commissioning and ramp-up, when they are expensive to correct. Simulation has long been used to
support such design decisions, but a design-stage simulation model is usually built once, with point estimates, and is
rarely confronted systematically with the data that become available after start-up.

The digital twin concept promises to close this loop. A DT is commonly described as a virtual representation of a
physical system that is connected to it by data flows; Kritzinger et al. (2018) distinguish a *digital model* (manual
data exchange in both directions), a *digital shadow* (automatic flow from the physical to the virtual object) and a
*digital twin* (automatic flow in both directions), and found that the literature consisted mainly of concept papers, with applied
case studies mostly at the lower integration levels. Since then, reviews have mapped DT applications, enabling technologies and open challenges in manufacturing
(Tao et al., 2019; Lu et al., 2020; Fuller et al., 2020). Perspectives on the use of DTs across the system life cycle
argue that design and operational decisions should be integrated and that data from operation should inform later
design instances (van Beek et al., 2022). Two lines of work address input uncertainty
in simulation-based twins directly. Masciarelli and Matta (2022) use metamodel-assisted bootstrapping to build
confidence intervals on the performance of a lab-scale manufacturing line when only few data are available, and to
identify the parameters with the largest effect; they note that Bayesian approaches are computationally demanding when
many simulation runs are needed. Schumacher et al. (2024) fit probability distributions of processing times and scrap
rates to data from a real production system and use live fitting to detect changes over time, as input for combined
simulation and scheduling optimisation. Reviews of uncertainty in manufacturing describe probability distributions,
Bayesian networks, fuzzy logic and grey system theory for modelling it (Siddiqui et al., 2025). On FMS specifically,
Florescu (2024) presents a DT developed from the design, sizing and configuration stages through commissioning and
operation of an experimental FMS using commercial simulation software, and Ullah and Younas (2024) report a DT-based
controller for an FMS built from custom prototypes retrofitted with low-cost hardware, because an industrial FMS was not
accessible in their country (Pakistan). The most recent large review classifies DTs in manufacturing along life-cycle
stage, hierarchy level, model characteristics, digital-thread connectivity and deployment (Seipolt et al., 2025).

Two recent studies come closest to the design and ramp-up problem. Van Ginkel et al. (2025) state that research
on DTs in the design and ramp-up phases is lacking and explore, through three case studies in SMEs, how DTs can be
implemented in smart manufacturing system design, virtual commissioning and IoT connection. Kampa et al. (2026)
propose a DT methodology for a planned FMS – integrating value stream mapping, discrete-event simulation, production
scheduling and CAD/CAM – for a gear manufacturer modernising from conventional machining to an automated system with
CNC machining centres, robots, AGVs and an AS/RS, and use it for scheduling and AGV fleet sizing before implementation.

None of these studies, however, follows design-stage predictions through commissioning and ramp-up of a new system,
updating uncertain inputs sequentially as data arrive and measuring whether predictions improve. Masciarelli and Matta
quantify uncertainty at one point in time; Schumacher et al. update distributions of a system already in operation;
Florescu and Ullah and Younas evaluate DTs on experimental or prototype systems without uncertainty quantification;
van Ginkel et al. study how to implement DTs in design and ramp-up, but qualitatively; and Kampa et al. use the DT at
design stage with deterministic scenarios, without comparing its predictions with the behaviour of the system after
start-up.

**Table 0. Prior reviews and closest studies, and how this review differs** (to be completed after the search)
| Study | Type | Focus | Difference to this review |
|---|---|---|---|
| Kritzinger et al. (2018) | Review | Classification DM / DS / DT; DT literature "in its infancy", mostly concept papers, few case studies | No uncertainty, phase or context dimension |
| Tao et al. (2019); Lu et al. (2020); Fuller et al. (2020) | Reviews | State of the art, reference models, enabling technologies | General; no FMS-introduction focus |
| Seipolt et al. (2025) | SLR (RAG-assisted), 1 354 screened, 144 categorisations | Taxonomy of DTs in manufacturing | Taxonomy, not gap analysis on uncertainty, ramp-up or constrained contexts |
| [SME SLR, 2025]; Cassius et al. (2026) | Reviews | SMEs / emerging economies, adoption barriers | No technical analysis of DT methods |
| Masciarelli & Matta (2022) | Method | Input uncertainty with few data (bootstrapping + metamodel), lab-scale line | One-time quantification, no ramp-up validation |
| Schumacher et al. (2024) | Method + real data | Live fitting of processing times and scrap rates | System in operation, not new-system ramp-up |
| Florescu (2024); Ullah & Younas (2024) | Cases | DT for experimental / prototype FMS | No uncertainty handling; no comparison of predictions with industrial ramp-up |
| van Ginkel et al. (2025) | Multiple case study (SMEs) | How to implement DTs in system design and ramp-up; virtual commissioning, IoT | Qualitative; no uncertainty quantification or prediction validation |
| Kampa et al. (2026) | Method + industrial case | DT methodology (VSM + DES + scheduling + CAD/CAM) for a planned FMS replacing conventional machining | Design stage only; deterministic scenarios; no updating with ramp-up data (check full text) |

Most of this work, however, assumes an advanced industrial setting: connected machines, modern communication
standards such as OPC UA, existing MES and experienced system integrators. Companies in emerging industries face
additional constraints – limited budgets, legacy or low-cost communication (for example Ethernet with Modbus TCP and
HTTP only), offline IT environments, and little historical data. Research on DTs in small and medium-sized
enterprises and in developing economies reports adoption barriers and notes that much of the evidence comes from
developed countries ([SME SLR, 2025]; Cassius et al., 2026). Work on brownfield and retrofit settings shows that
integrating legacy machines still requires substantial manual engineering (Tonejca et al., 2024; Wintercorn et al.,
2023).

It is therefore unclear to what extent existing DT research supports a company that moves *step by step* from
standalone CNC machines to an integrated FMS under technology and data constraints, and how far DT predictions made at
design stage are validated against reality during ramp-up. This review addresses that gap with four questions:

- **SQ1** Which architectures and communication technologies are used for manufacturing DTs, and which of them work
  with low-cost or legacy technology?
- **SQ2** How is uncertainty of input parameters represented in manufacturing DTs, and how is it updated with real data?
- **SQ3** How are DTs used in the design, commissioning and ramp-up of FMS and production systems, and how are their
  predictions validated?
- **SQ4** Which studies address SMEs or emerging economies and the stepwise transition from standalone CNC to FMS?

The contributions of this review are: (i) a structured classification of 28 studies across architecture,
uncertainty handling, life-cycle phase and context; (ii) a concept matrix that makes empty combinations – research
gaps – visible; (iii) a five-level transition model from standalone CNC to integrated FMS used as an analytical lens;
and (iv) a research agenda for uncertainty-aware, low-cost DTs for FMS introduction.

The remainder of the paper is organised as follows. Section 2 introduces the concepts used. Section 3 describes the
review method. Section 4 reports the results per review question. Section 5 discusses the gaps and the research
agenda, and Section 6 concludes.

## 2. Background and analytical framework

### 2.1 Digital model, shadow and twin
We adopt the classification of Kritzinger et al. (2018) because it is defined by observable data flows and can be
applied consistently during data extraction. ISO 23247 (2021) provides a reference architecture for DTs in
manufacturing (observable manufacturing elements, data collection and device control, core, user entities), which we
use to classify architectures in SQ1.

### 2.2 Uncertainty in production system models
Input uncertainty in discrete-event models of production systems concerns, among others, processing times, failure
and repair times, scrap and rework rates, and demand. It can be represented by point estimates, by probability
distributions propagated by Monte Carlo simulation, or by distributions whose parameters are themselves uncertain and
updated with observations. In Bayesian updating, a prior distribution p(θ) for a parameter θ is combined with the
likelihood of observed data D to give the posterior p(θ | D) ∝ p(D | θ) p(θ). For example, for a failure rate λ with
a Gamma(α, β) prior and n failures observed in T operating hours, the posterior is Gamma(α + n, β + T). We record for
each study which of these representations is used and whether updating with real data takes place.

### 2.3 Life-cycle phases
We distinguish design (including sizing and configuration), commissioning (including virtual commissioning),
ramp-up (from first part to planned output) and operation. Ramp-up is of particular interest because it is the phase
in which design-stage predictions can first be compared with real system behaviour.

### 2.4 Transition levels from standalone CNC to integrated FMS
To analyse SQ4 we use five levels: **L0** standalone CNC (manual loading, paper-based orders, no machine data);
**L1** connected CNC (machine states and counters collected, OEE measured); **L2** flexible cell (one to three machines
with pallet changer or robot, programs called by part number); **L3** FMS line (several machines, pallet pool or
automated transport, central cell controller and scheduling); **L4** integrated FMS (FMS linked to MES and ERP, DT updated
from real data and used for decisions). Each included study is assigned the level of the system it describes.

## 3. Method

### 3.1 Protocol
The review followed PRISMA 2020 (Page et al., 2021). The protocol – review questions, sources, search strings,
eligibility criteria, screening procedure, quality criteria and extraction form – was fixed before the search
[and registered / agreed with the co-authors on [date]]. Deviations are reported in Section 3.7.

### 3.2 Sources and search
OpenAlex, an open bibliographic database covering journals and conference proceedings, was searched on 13 November
2026 (title and abstract field, 2015–2026, articles and reviews). Three strings combined a DT/simulation block, a
system block and one of three topic blocks (uncertainty and updating; life-cycle phase; context). The full strings are
given in Table 1. Full strings: A = ("digital twin" OR "digital shadow" OR "virtual factory" OR "discrete event simulation");
B = ("flexible manufacturing" OR "manufacturing system" OR "production system" OR "machining line" OR CNC);
C1 = (uncertainty OR bayesian OR calibration OR "parameter updating" OR "data assimilation" OR "live fitting");
C2 = ("ramp-up" OR "ramp up" OR commissioning OR "factory design" OR "system design" OR "factory planning");
C3 = (SME OR "small and medium" OR "emerging economies" OR "developing countries" OR "low-cost" OR legacy OR retrofit OR Modbus);
Sk = A AND B AND Ck. The search script is provided as supplementary material.

**Table 1. Search strings and hits** [fill from protocol §10]
| String | Topic block | OpenAlex hits | (Scopus / WoS: not searched) |
|---|---|---|---|
| S1 | uncertainty / updating | 269 | – |
| S2 | design / commissioning / ramp-up | 167 | – |
| S3 | SME / emerging / low-cost / legacy | 50 | – |

### 3.3 Eligibility criteria
Studies were included if they (i) presented a DT or discrete-event model of a discrete manufacturing system, line,
cell or machine group; (ii) addressed at least one review question; and (iii) were peer-reviewed. Studies were
excluded if they concerned process industries, buildings or other non-manufacturing domains, a single physical process
without system view, or presented a concept without model, architecture or case.

### 3.4 Screening
After duplicate removal, titles and abstracts were pre-screened with the assistance of a large language model
(Claude, Anthropic), which applied the written eligibility criteria record by record and recorded a decision, reason
code and short justification for each record. The first author verified [all inclusions and a random 20 % sample of
exclusions]; agreement between the first author and the pre-screen was κ = [ ] (Cohen's kappa). A second human
reviewer independently screened a random 20 % sample; agreement was κ = [ ]. The use of AI assistance is disclosed in
accordance with the journal's policy, and all final decisions were taken by the authors. Disagreements were resolved by
discussion and the criteria were clarified [if needed]. Full texts of the remaining records were assessed against the
same criteria, and reasons for exclusion were recorded.

### 3.5 Quality appraisal
Each included study was scored on six criteria (clear aim, reproducible method, real data, comparison with a baseline
or reality, discussion of limitations, description of context), each 0, 0.5 or 1. Scores were used to qualify the
strength of conclusions, not to exclude studies.

### 3.6 Data extraction and synthesis
Data were extracted into a predefined form (bibliographic data, country, company size, sector, system type, transition
level, Kritzinger level, TRL, life-cycle phase, communication technology, cost information, uncertainty representation,
updating method, data type, validation type, accuracy measure, decisions supported, limitations, quality score).
Results were synthesised descriptively and narratively per review question, and a concept matrix was built to identify
combinations of features not covered by the literature. No meta-analysis was performed because study designs and
outcome measures were heterogeneous.

### 3.7 Deviations from the protocol
(i) Only OpenAlex was searched; the planned Scopus and Web of Science searches and snowballing were not performed.
(ii) Full-text assessment was limited to reports available in open access (42 of 204). (iii) Screening and extraction
were AI-assisted with author verification (Section 3.4). All three deviations are discussed in Section 5.5.

## 4. Results

### 4.1 Study selection and overview
**Figure 1. PRISMA 2020 flow diagram** (file `figures/fig1_prisma.svg`).
Records identified in OpenAlex: 486 (S1 269, S2 167, S3 50). Duplicates removed: 41 (38 identical records across
strings, 3 repository copies of journal articles found during screening). Records screened: 445. Records excluded at
title/abstract: 241 (E1 not discrete manufacturing 72; E2 concept only 14; E3 single process 50; E4 not peer-reviewed
or not English 21; E5 no review question 84). Reports sought for retrieval: 204. Reports not retrieved (no open-access
full text available to the authors): 162. Reports assessed for eligibility: 42. Reports excluded: 14 (E1 1; E2 3; E3 2;
E4 2; E5 3; document incomplete or not the article version 3). **Studies included: 28.**

The 28 studies were published between 2015 and 2026; 15 (54 %) appeared in 2024–2026. They comprise 27 primary studies
(including the empirical multi-case study of Bokrantz et al., 2017) and 1 review (Chikwata et al., 2026). Case
contexts were located in 13 countries; 10 studies did not report a case country. Seven studies (25 %) come from emerging
economies (India 2, Malaysia, Indonesia, Nigeria, Bangladesh, Zimbabwe). Company size was SME in 7 studies, large in 3,
both in 1, laboratory or learning factory in 8, and not stated in 9. The mean quality score was 3.7 of 6
(range 1.5–5.5); studies with a score ≥ 5 were Bokrantz et al. (2017), Longo et al. (2019), Konstantinov et al. (2022),
Fu et al. (2025), Mahmoodi et al. (2025) and Purwaningsih et al. (2025). Table 2 summarises the included studies.

**Table 2. Included studies (n = 28)** – K = Kritzinger level; L = transition level (L0–L4); Q = quality score (0–6)

| # | Study | Country / size | System | Phase | K | L | Communication | Validation | Q |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Bendato et al. (2015) | Italy / SME | line | design | model | n.s. | n.s. | none | 3 |
| 2 | Caggiano et al. (2016) | n.s. / n.s. | cell | design | model | 2 | n.s. | vs baseline | 4 |
| 3 | Bokrantz et al. (2017) | Sweden / large | line / factory | design;operation | model | n.a. | production monitoring systems… | none | 5 |
| 4 | Odedairo et al. (2018) | Nigeria / SME | line | operation | model | 0 | n.s. | none | 4 |
| 5 | Assad et al. (2019) | n.s. / lab | line | design | model | n.s. | file exchange | none | 3 |
| 6 | Longo et al. (2019) | Italy / large; SME | shop floor | operation | shadow | 1 | REST/HTTP; CoAP | vs baseline | 5 |
| 7 | Molnár et al. (2021) | n.s. / n.s. | FMS | design | model | 3 | n.s. | none | 2 |
| 8 | Ward et al. (2021) | UK / lab | line | operation | shadow | 4 | OPC UA; Profinet; RFID; COTS … | face validity | 4 |
| 9 | Konstantinov et al. (2022) | UK / lab | cell | design;commissioning;operation | shadow | 2 | OPC UA; TCP/IP; Profinet; Net… | vs reality | 5.5 |
| 10 | Zheng et al. (2022) | n.s. / large | line | design | model | n.s. | software APIs, Neo4j graph DB… | none | 4 |
| 11 | Christ et al. (2023) | Germany / lab | line | design;commissioning | model | 3 | TCP/IP; EtherNet/IP; shared m… | none | 3.5 |
| 12 | Konstantinov et al. (2023) | UK / lab | cell | design;commissioning;operation | shadow | 2 | Siemens S7-1200 PLC; SQL data… | none | 3.5 |
| 13 | Monek et al. (2023) | Hungary / lab | line | design;operation | shadow | 2 | OPC UA; WiFi IMU smart workpi… | vs reality | 4.5 |
| 14 | Das (2024) | n.s. / n.s. | line | commissioning | model | 3 | OPC UA | vs baseline | 1.5 |
| 15 | Egilmez et al. (2024) | n.s. / n.s. | line vs cell | design | model | n.a. | n.s. | vs baseline | 3.5 |
| 16 | Hu et al. (2024) | China / lab | cell | commissioning;operation | twin | 2 | OPC UA; industrial Ethernet; … | face validity | 2.5 |
| 17 | Kamar et al. (2024) | Malaysia / SME | shop floor | design;operation | model | 0 | n.s. | vs reality | 4.5 |
| 18 | Fu et al. (2025) | n.s. / large | line | operation | shadow | 3 | PLC + monitoring software; IS… | vs baseline | 5 |
| 19 | Mahmoodi et al. (2025) | n.s. / n.s. | line | design | model | 3 | n.s. | vs reality | 5 |
| 20 | Purwaningsih et al. (2025) | Indonesia / n.s. | line | design | model | 0 | n.s. | vs reality | 5 |
| 21 | van Ginkel et al. (2025) | Netherlands / SME | cell | design;commissioning | twin | 2 | Beckhoff ADS; MQTT; C# API; T… | face validity; latenc… | 4 |
| 22 | Cabello Oquena et al. (2026) | n.s. / lab | line | design | model | n.s. | n.s. | vs baseline; surrogat… | 3 |
| 23 | Chikwata et al. (2026) | Zimbabwe / n.s. | review | design;commissioning | n.a. | n.a. | AutomationML; STEP AP242; CMS… | none | 3.5 |
| 24 | Moennich et al. (2026) | Germany / n.s. | FMS | design | model | 3 | n.s. | none | 2.5 |
| 25 | Parameswari et al. (2026) | India / SME | shop floor | operation | model | 1 | n.s. | vs baseline | 3.5 |
| 26 | Pu (2026) | n.s. / n.s. | line | commissioning;operation | model | 3 | OPC UA | vs baseline | 3 |
| 27 | Ramteke et al. (2026) | India / SME | line | operation | model | 1 | MQTT; REST/HTTP; Kubernetes | none | 2 |
| 28 | Tuhin et al. (2026) | Bangladesh / SME | cell | operation | twin | 3 | n.s. | vs baseline | 4 |

### 4.2 SQ1 – Architectures and communication technology
Twelve of the 28 studies (43 %) did not state how the model exchanged data with the physical system. Where a protocol
was stated, OPC UA was the most frequent (6 studies), followed by TCP/IP (2), Profinet (2), and single uses of MQTT, Beckhoff
ADS, REST/HTTP, CoAP, RS485 and file exchange (XML/Excel). **No study used Modbus**, although Modbus TCP is widely
available on low-cost controllers.

Measured performance of the data link was reported only once: van Ginkel et al. (2025) measured a PLC-to-twin delay of
0.98 ms with the PLC simulated on the same computer and 3.02 ms with a real PLC and the twin on a separate computer,
using the open-source MQTT broker Mosquitto and Beckhoff ADS. Five studies used low-cost or open technology explicitly:
open-source messaging and dashboards in an SME (van Ginkel et al., 2025), commercial depth cameras with object tracking
to retrofit a line without changing its control (Ward et al., 2021), an inertial "smart workpiece" costing about 10 USD
(Monek and Fischer, 2023), a self-hosted container platform for SMEs (Ramteke et al., 2026; no results yet reported),
and RESTful web services with JSON and CoAP (Longo et al., 2019). Only five studies gave any cost figure, and none
reported the total cost of the twin itself. In terms of integration level, 18 studies described digital models, 6
digital shadows and 3 bidirectional twins (one only claimed), with 1 review not classified (Kritzinger et al., 2018); in the "twin" cases the link served virtual
commissioning or training rather than model updating.

### 4.3 SQ2 – Uncertainty representation and updating
Input uncertainty was represented explicitly in 12 studies (43 %): fixed probability distributions in 9 (e.g. fitted
uniform distributions tested with the Kolmogorov–Smirnov test, Purwaningsih et al., 2025; normal task times by worker
skill, Egilmez et al., 2024; triangular sales scenarios with Monte Carlo simulation, Bendato et al., 2015), empirical
distributions in 1 (Fu et al., 2025) and scenarios in 2. Five studies were deterministic and 11 did not state how
variability was treated. Assad et al. (2019) explicitly left stochastic cycle times to future work, and Konstantinov et al.
(2023) noted that the virtual engineering tools they compared offer no uncertainty quantification.

Automatic updating of input parameters from real data was found in **2 studies (7 %)**. Fu et al. (2025) maintain
operation-time distributions (histograms / kernel density estimates) from PLC timer data and update them as new samples
arrive; deviations trigger line reconfiguration by mixed-integer programming. The disturbances were simulated and the
authors list physical validation as future work. Monek and Fischer (2023) extract conveyor speed and motion state for a
DES automatically from a low-cost IMU and PLC signals in a laboratory, with 99.7–99.9 % speed accuracy against a video
reference. Three further studies recalibrated parameters manually (Bokrantz et al., 2017; Konstantinov et al., 2022;
Ramteke et al., 2026). Bokrantz et al. (2017) explain why updating is hard in practice: in six industrial DES cases,
machine vendors supplied only mean failure values, short stops below one minute were filtered out of monitoring data,
and faulty PLC signals and outdated data hindered the construction and maintenance of input distributions. **No study
applied Bayesian updating to the input parameters of a production system model with plant data**, and none quantified
how the uncertainty of predictions decreased as data accumulated.

### 4.4 SQ3 – Life-cycle phase and validation
The design phase was addressed in 18 studies, commissioning in 8 and operation in 14 (several phases per study). **No
study collected data during the ramp-up of a new system**; van Ginkel et al. (2025) discuss ramp-up as a target phase but
evaluate the twin in design and virtual commissioning. Decisions supported at design stage were layout (Molnár et al.,
2021; Moennich et al., 2026), buffer sizing and operator allocation (Mahmoodi et al., 2025), AGV or AMR fleet size
(Purwaningsih et al., 2025; Mahmoodi et al., 2025), workstation number and task sequence (Cabello Oquena et al., 2026),
energy-related KPIs (Assad et al., 2019; Caggiano et al., 2016) and capacity (Bendato et al., 2015).

Predictions were compared with reality in **5 studies (18 %)**. In four, the model of an *existing* system was validated
against historical data: MAPE 3.8 % for total production time (Kamar et al., 2024), no significant difference in
delivered pallets by t-test (Purwaningsih et al., 2025), 0.91 % cumulative throughput error over 50 days (Mahmoodi et al.,
2025) and 99.7–99.9 % parameter accuracy (Monek and Fischer, 2023). The improvements these models recommended – for
example a 14 % throughput gain or 64 % lower material-handling cost – were not checked after implementation. Only
**Konstantinov et al. (2022)** compared design-stage predictions with a newly commissioned system: simulated cycle times
of an e-motor rotor assembly station deviated by 17.04 % from the physical station with the initial model and by 8.72 %
after manual recalibration, against a target of 5 %; the largest errors (19–28 %) occurred in manual loading tasks whose
timing assumptions changed during build. Nine studies compared only with a simulated or historical baseline, and 14
reported face validity or no validation. A review of CAD–DES integration reaches a consistent conclusion: models are
usually validated on one short case, and their accuracy over the system life cycle is hardly measured (Chikwata et al., 2026).

### 4.5 SQ4 – Context and transition level
Systems were classified at transition level L0 in 3 studies, L1 in 3, L2 in 6, L3 in 8 and L4 in 1; 7 could not be
classified (manual assembly or not stated). The emerging-economy studies mainly used DES to analyse an existing,
largely manual system: an aluminium casting SME in Malaysia (Kamar et al., 2024), a bottled-water SME in Nigeria
(Odedairo and Nwabuokie, 2018), packaging lines in Indonesia (Purwaningsih et al., 2025); two studies used synthetic
data (Parameswari et al., 2026; Ramteke et al., 2026), and one reported a computational experiment on a machining cell in
Bangladesh (Tuhin et al., 2026). Tuhin et al. (2026) propose a phased path – connectivity, monitoring, twin, AI, closed
loop – for an existing PLC/CNC cell, and Purwaningsih et al. (2025) simulate the move from manual pallet handling to AGVs.
**No study followed a company through the transition from standalone CNC machines to an FMS with data**, and none from
an emerging economy reached beyond the digital-model level with real data.

### 4.6 Concept matrix
Table 5 shows the seven features coded for each study. The most frequent feature was explicit uncertainty (12), followed
by the commissioning phase (8) and emerging-economy context (7). Automatic updating with real data (2) and documented
stepwise transition (2) were rare. Among pairs of the features most relevant to this review, automatic updating never
co-occurred with the commissioning/ramp-up phase, with an emerging-economy context or with a documented transition;
commissioning and validation against reality co-occurred once (Konstantinov et al., 2022); low-cost technology and
validation against reality co-occurred once (Monek and Fischer, 2023, laboratory). **No study combined automatic
updating, the commissioning/ramp-up phase and validation against reality**, and no study combined low-cost technology
with an emerging-economy case and real validation.

**Table 5. Concept matrix (n = 28)** – UN uncertainty represented explicitly · UP inputs updated automatically from real data · CR commissioning / ramp-up phase · VR predictions validated against reality · LC low-cost / open technology · ST stepwise transition documented · EM emerging economy

| Study | UN | UP | CR | VR | LC | ST | EM |
|---|---|---|---|---|---|---|---|
| Bendato et al. (2015) | ● |  |  |  |  |  |  |
| Caggiano et al. (2016) |  |  |  |  |  |  |  |
| Bokrantz et al. (2017) | ● |  |  |  |  |  |  |
| Odedairo et al. (2018) | ● |  |  |  |  |  | ● |
| Assad et al. (2019) |  |  |  |  |  |  |  |
| Longo et al. (2019) |  |  |  |  | ● |  |  |
| Molnár et al. (2021) |  |  |  |  |  |  |  |
| Ward et al. (2021) |  |  |  |  | ● |  |  |
| Konstantinov et al. (2022) |  |  | ● | ● |  |  |  |
| Zheng et al. (2022) |  |  |  |  |  |  |  |
| Christ et al. (2023) |  |  | ● |  |  |  |  |
| Konstantinov et al. (2023) |  |  | ● |  |  |  |  |
| Monek et al. (2023) |  | ● |  | ● | ● |  |  |
| Das (2024) |  |  | ● |  |  |  |  |
| Egilmez et al. (2024) | ● |  |  |  |  |  |  |
| Hu et al. (2024) |  |  | ● |  |  |  |  |
| Kamar et al. (2024) |  |  |  | ● |  |  | ● |
| Fu et al. (2025) | ● | ● |  |  |  |  |  |
| Mahmoodi et al. (2025) | ● |  |  | ● |  |  |  |
| Purwaningsih et al. (2025) | ● |  |  | ● |  | ● | ● |
| van Ginkel et al. (2025) |  |  | ● |  | ● |  |  |
| Cabello Oquena et al. (2026) | ● |  |  |  |  |  |  |
| Chikwata et al. (2026) |  |  | ● |  |  |  | ● |
| Moennich et al. (2026) | ● |  |  |  |  |  |  |
| Parameswari et al. (2026) | ● |  |  |  |  |  | ● |
| Pu (2026) | ● |  | ● |  |  |  |  |
| Ramteke et al. (2026) | ● |  |  |  | ● |  | ● |
| Tuhin et al. (2026) |  |  |  |  |  | ● | ● |
| **Total** | **12** | **2** | **8** | **5** | **5** | **2** | **7** |

## 5. Discussion

### 5.1 Main findings
**SQ1.** Communication is often not reported; where it is, OPC UA dominates. Low-cost options are demonstrated only in
laboratories or single SMEs, link performance is measured once, and Modbus – common on low-cost equipment – does not appear.
**SQ2.** Uncertainty is represented in fewer than half of the studies and almost always by fixed distributions. Updating
from real data is rare (2 of 28), never Bayesian, and never evaluated in terms of how prediction uncertainty shrinks.
**SQ3.** Twins are used mainly at design stage and for virtual commissioning, but their predictions are seldom confronted
with the real system; only one study does so after commissioning, with manual recalibration, for one station. Ramp-up is
not covered with data. **SQ4.** Evidence from SMEs and emerging economies exists but is dominated by current-state DES
models of manual systems and by synthetic data; the transition from standalone CNC to FMS is not studied.

These findings are consistent with Kritzinger et al. (2018), who found that the literature concentrated on the lower
integration levels: seven years later, 18 of 28 included studies remain digital models with manual data exchange.

### 5.2 Research gaps
- **G1 – Validation of design-stage predictions against ramp-up reality.** Only one study compares design predictions
  with a commissioned system, and none follows a system through ramp-up. The size of design-stage prediction error –
  17 % in the only case reported – and how it evolves are unknown.
- **G2 – Sequential (Bayesian) updating of input parameters through commissioning and ramp-up.** Updating exists only
  during operation (Fu et al., 2025) or for single parameters in a laboratory (Monek and Fischer, 2023). Methods that
  start from design-stage priors and update them as early, scarce data arrive – the situation of a new system – are missing.
- **G3 – Low-cost, measured architectures.** Low-cost data paths are demonstrated qualitatively; latency, data loss and
  cost are rarely measured, and widely available protocols such as Modbus TCP and plain HTTP are not evaluated.
- **G4 – Decision support for stepwise transition (L0 → L4).** No study uses a twin to decide which machines join an FMS,
  in which order, and when, nor follows such a transition with data.
- **G5 – Evidence from emerging economies beyond the digital-model level.** Studies from these contexts exist but stop at
  current-state models or synthetic data.

### 5.3 Research agenda
| Gap | Research question | Suitable method | Data needed | Evaluation measure |
|---|---|---|---|---|
| G1 | How large is the error of design-stage twin predictions during commissioning and ramp-up, and how does it evolve? | Freeze and date design-stage predictions; compare monthly with measured performance | Planned vs actual output, cycle times, availability per month | Prediction error E = \|predicted − actual\| / actual; time to target output |
| G2 | Does sequential Bayesian updating of input parameters reduce prediction error and uncertainty faster than a deterministic or one-time-calibrated model? | Conjugate Bayesian updating (e.g. Gamma–Poisson for failure rates, Normal–Inverse-Gamma or lognormal for times) in a DES | Event logs from commissioning and ramp-up | E per month vs baseline; coverage of predicted intervals; interval width |
| G3 | What fidelity, latency, data loss and cost can a twin achieve using only low-cost communication (e.g. Modbus TCP and HTTP)? | Reference architecture + measurement campaign | Network timing logs, missed samples, cost records | Latency distribution, loss rate, cost per connected machine |
| G4 | How can an updated twin support the sequence and timing of machine integration from standalone CNC to FMS? | Simulation-based decision analysis under uncertainty, staged options | Investment and capacity data per stage | Expected cost, risk of under-capacity, regret vs actual decisions |
| G5 | Do G1–G4 results hold in a greenfield factory in an emerging economy and in a second product line? | Longitudinal multiple-case study | Two production lines | Comparison of E, ramp-up time and decision quality across cases |

### 5.4 Implications for practice
For companies moving from standalone CNC machines to an FMS, the evidence suggests: (i) build the design-stage model
with explicit input distributions instead of point values, because data at design stage are mostly vendor means
(Bokrantz et al., 2017); (ii) record and date the design predictions, so that they can be compared with reality after
start-up; (iii) plan the data path early – the low-cost options in the literature (open-source messaging, inexpensive
sensors, camera tracking) show that useful data can be collected without replacing controllers; (iv) expect manual tasks
and late design changes to be the main sources of prediction error (Konstantinov et al., 2022).

### 5.5 Limitations of this review
First, only one database (OpenAlex) was searched; Scopus and Web of Science were planned in the protocol but not used,
so relevant studies may be missing. OpenAlex lacks abstracts for some records (63 of 448), which may have reduced
recall of title/abstract searching. Second, only open-access full texts could be retrieved: 162 of 204 eligible reports
(79 %) were not assessed, so the included set is biased towards open-access venues, including some lower-tier journals;
the gap conclusions should therefore be read as "not found in the open-access literature" and should be re-checked
against subscription journals. Third, screening and data extraction were performed with large-language-model assistance
and verified by the first author [verification to be completed]; assistance can introduce systematic errors, which
we mitigated by written criteria, reason codes for every decision and a correction log. Fourth, the transition levels
L0–L4 are a new analytical lens and some classifications required judgement. Fifth, several included studies have low
quality scores; we used them for mapping but not for strong conclusions.

## 6. Conclusion
This review examined how digital twins support the design, commissioning, ramp-up and stepwise introduction of flexible
manufacturing systems under technology and data constraints. Of 445 screened records, 28 studies were included and
coded for architecture, uncertainty handling, life-cycle phase, validation and context. Most published "digital twins"
are still digital models; input uncertainty is usually fixed, updating from real data is rare and never Bayesian, and
design-stage predictions are almost never checked against the real system after start-up – the single study that does
so reports a 17 % initial error. Low-cost architectures and evidence from emerging economies remain at laboratory or
current-state level, and no study follows a company from standalone CNC machines to an FMS. We therefore propose a
research agenda centred on design-stage predictions that are frozen, updated sequentially with commissioning and
ramp-up data, validated against reality, and delivered with low-cost technology – an agenda that a longitudinal case in
a greenfield factory in an emerging economy is well placed to address.

**AI-use statement.** Large-language-model assistance (Claude, Anthropic) was used for search execution, title/abstract
pre-screening, full-text data extraction and language editing, under a written protocol. All decisions were verified by
the authors, who take full responsibility for the content.

---

## References (verified by record; full text not yet read where marked)
- Cassius, O.A., Abiji, E., Diwa, D.O., Egede, D.A. (2026). Digital twin technology adoption and sustainable
  manufacturing performance in emerging economies: a literature review. *Int. J. Social Sciences and Management Research* 12(10), 474–493.
- Fuller, A., Fan, Z., Day, C., Barlow, C. (2020). Digital twin: enabling technologies, challenges and open research.
  *IEEE Access* 8. (check volume/pages)
- ISO 23247-1 (2021). Automation systems and integration – Digital twin framework for manufacturing – Part 1: Overview and general principles.
- Kritzinger, W., Karner, M., Traar, G., Henjes, J., Sihn, W. (2018). Digital twin in manufacturing: a categorical
  literature review and classification. *IFAC-PapersOnLine* 51(11), 1016–1022. https://doi.org/10.1016/j.ifacol.2018.08.474
- Lu, Y., Liu, C., Wang, K.I-K., Huang, H., Xu, X. (2020). Digital twin-driven smart manufacturing: connotation,
  reference model, applications and research issues. *Robotics and Computer-Integrated Manufacturing* 61, 101837.
- Page, M.J., McKenzie, J.E., Bossuyt, P.M., et al. (2021). The PRISMA 2020 statement: an updated guideline for
  reporting systematic reviews. *BMJ* 372, n71. https://doi.org/10.1136/bmj.n71
- Schumacher, C., Stilling, J., Kriege, J., Buchholz, P. (2024). Live fitting of process data within digital twins of
  manufacturing to use simulation and optimisation. *Journal of Simulation* 18(5), 813–834. https://doi.org/10.1080/17477778.2024.2376711
- Masciarelli, A., Matta, A. (2022). Managing input parameter uncertainty in digital twins. *IFAC-PapersOnLine* 55(2), 13–18.
- Florescu, A. (2024). Digital twin for flexible manufacturing systems and optimization through simulation: a case study.
  *Machines* 12(11), 785. https://doi.org/10.3390/machines12110785
- Ullah, A., Younas, M. (2024). Development and application of digital twin control in flexible manufacturing systems.
  *Journal of Manufacturing and Materials Processing* 8(5), 214. https://doi.org/10.3390/jmmp8050214
- Seipolt, A., Buschermöhle, R., Hasselbring, W. (2025). Digital twins in manufacturing: a systematic literature review
  with retrieval-augmented generation. *IEEE Access*. https://doi.org/10.1109/ACCESS.2025.3611269
- Siddiqui, M., Abdoli, S., Malaibari, M., Djukic, L. (2025). A review of bottleneck management strategies in
  manufacturing under uncertainty for sustainable manufacturing. *Proc. 2nd World Congress on IEOM*, Windsor. https://doi.org/10.46254/WC02.20250179
- [SME SLR] Systematic literature review of digital and green transformation of manufacturing SMEs in Europe (2025).
  *Production & Manufacturing Research*. (complete authors)
- Tao, F., Zhang, H., Liu, A., Nee, A.Y.C. (2019). Digital twin in industry: state-of-the-art. *IEEE Trans. Industrial
  Informatics* 15(4), 2405–2415.
- Tonejca, L., Mayer, C., Trautner, T., Mauthner, G., Bleicher, F. (2024). CNC machine tool focused edge computing in
  manufacturing. *Procedia CIRP* 126, 111–116.
- van Beek, A., Karkaria, V., Chen, W. (2022). Digital twins for the designs of systems: a perspective. arXiv:2211.05040.
  (check for the journal version)
- Wintercorn, O., Atta, K., Jeppsson, P., Paniagua, C., van Deventer, J. (2023). Transforming brownfield factories:
  unleashing the potential with co-engineering and virtual commissioning. *IECON 2023*, IEEE. https://doi.org/10.1109/IECON51785.2023.10311670
- van Ginkel, M., Ghafoorpoor Yazdi, P., Rupert, T., Reijers, J., Thiede, S. (2025). Digital twins to support smart
  manufacturing system design and ramp up. *Procedia CIRP*. https://doi.org/10.1016/j.procir.2025.02.221 (check volume/pages)
- Kampa, A., Kalinowski, K., Stawowiak, M., et al. (2026). Digital twin methodology for flexible manufacturing system
  design: integration of VSM, discrete-event simulation and production scheduling for gear wheel production.
  *Applied Sciences* 16(15), 7521. https://doi.org/10.3390/app16157521 (check volume/issue)

**Included studies (n = 28)**
- Agam Ramteke, Pranay Tarjule, Pritam Kumar Rai, et al. (2026). Digital Twin Orchetration System For Industrial Manufacturing. *INTERANTIONAL JOURNAL OF SCIENTIFIC RESEARCH IN ENGINEERING AND MANAGEMENT*. https://doi.org/10.55041/ijsrem68224 [included]
- Ahmad Nazif Noor Kamar, Cheng Jack Kie, Syed Radzi Rahamaddulla, et al. (2024). Evaluating production process improvement strategies in a manufacturing SME: A case study. *Edelweiss Applied Science and Technology*. https://doi.org/10.55214/25768484.v8i6.3366 [included]
- Alessandra Caggiano, Adelaide Marzano, Roberto Teti (2016). Sustainability Enhancement of a Turbine Vane Manufacturing Cell through Digital Simulation-Based Design. *Energies*. https://doi.org/10.3390/en9100790 [included]
- Babatunde Omoniyi Odedairo, N. Nwabuokei (2018). Framework for Operational Performance Measurements in Small and Medium Scale Industries Using Discrete Event Simulation Approach. *Engineering Technology & Applied Science Research*. https://doi.org/10.48084/etasr.2106 [included]
- Bipul Tuhin, Susmita Shammy, Lipi Akter, et al. (2026). Digital Twin-Driven Optimization of Mechanical Manufacturing Systems Using Artificial Intelligence. *The International Journal of Engineering Sciences*. https://doi.org/10.64440/ijes/engineeringx0025 [included]
- Bo Fu, Mingjie Bi, Shota Umeda, et al. (2025). Digital Twin-Based Smart Manufacturing: Dynamic Line Reconfiguration for Disturbance Handling. *IEEE Transactions on Automation Science and Engineering*. https://doi.org/10.1109/tase.2025.3563320 [included]
- Ehsan Mahmoodi, Masood Fathi, Amos H.C. Ng, et al. (2025). Predictive model-based multi-objective optimization with life-long meta-learning for designing unreliable production systems. *Computers & Operations Research*. https://doi.org/10.1016/j.cor.2025.107011 [included]
- Fadi Assad, Buğra Alkan, Malarvizhi Kaniappan Chinnathai, et al. (2019). A framework to predict energy related key performance indicators of manufacturing systems at early design phase. *Procedia CIRP*. https://doi.org/10.1016/j.procir.2019.03.026 [included]
- Francesco Longo, Letizia Nicoletti, Antonio Padovano (2019). Ubiquitous knowledge empowers the Smart Factory: The impacts of a Service-oriented Digital Twin on enterprises' performance. *Annual Reviews in Control*. https://doi.org/10.1016/j.arcontrol.2019.01.001 [included]
- Gergő Dávid Monek, Szabolcs Fischer (2023). DES and IIoT fusion approach towards real-time synchronization of physical and digital components in manufacturing processes. *Reports in Mechanical Engineering*. https://doi.org/10.31181/rme040115092023m [included]
- Gökhan Eğilmez, Emre Kirac, Sami Khalafallah (2024). An Integrated Stochastic Optimization and Simulation Approach to SERU vs. Assembly Line Manufacturing Systems. *Journal of Applied Business and Economics*. https://doi.org/10.33423/jabe.v26i5.7351 [included]
- Ilaria Bendato, Lucia Cassettari, Marco Tullio Mosca (2015). New Markets Forecast and Dynamic Production Redesign Through Stochastic Simulation. *International Journal of Simulation Modelling*. https://doi.org/10.2507/ijsimm14(3)10.307 [included]
- Jing Pu (2026). Digital Twin Modeling and Simulation for an Automated Assembly Line. *Journal of Engineering Mechanics and Machinery*. https://doi.org/10.23977/jemm.2026.110101 [included]
- Jon Bokrantz, Anders Skoogh, Dan Lämkull, et al. (2017). Data quality problems in discrete event simulation of manufacturing operations. *SIMULATION*. https://doi.org/10.1177/0037549717742954 [included]
- Jorge Francisco Cabello Oqueña, Shun Yang, Sebastian Thiede (2026). Simulation based Configuration Platform for Circular Manufacturing Systems. *Procedia CIRP*. https://doi.org/10.1016/j.procir.2026.05.045 [included]
- K Parameswari, S. Veni, V.S.Thangarasu (2026). Study on Hybrid XG Boost–LSTM Predictor with a Digital-Twin Monte Carlo Virtual Check for Risk-Aware Scheduling in MSME CNC Manufacturing cluster. *International Journal of Computer Information Systems and Industrial Management Applications*. https://doi.org/10.70917/ijcisim-2026-5486 [included]
- Lukas Christ, Elías Milloch, Marius Boshoff, et al. (2023). Implementation of Digital Twin and Real Production System to Address Actual and Future Challenges in Assembly Technology. *Automation*. https://doi.org/10.3390/automation4040020 [included]
- Marc Münnich, Steffen Ihlenfeldt, Sebastian Thiede (2026). Combined modelling and evaluation of energy and material flow in matrix production systems. *Procedia CIRP*. https://doi.org/10.1016/j.procir.2026.05.379 [included]
- Marco van Ginkel, Poorya Ghafoorpoor Yazdi, Thijs Rupert, et al. (2025). Digital Twins to Support Smart Manufacturing System Design and Ramp up. *Procedia CIRP*. https://doi.org/10.1016/j.procir.2025.02.221 [included]
- Prince Charles Chikwata, Blesslord Chigocho, Munyaradzi Sasha Chitewe, et al. (2026). THE CONVERGENCE OF COMPUTER-AIDED DRAUGHTING AND DISCRETE EVENT SIMULATION IN MANUFACTURING: A SYSTEMATIC STATE-OF-THE-ART REVIEW. *World Journal of Advanced Engineering Technology and Sciences*. https://doi.org/10.30574/wjaets.2026.20.3.0455 [included]
- Priyanka Das (2024). Enhancing EV Manufacturing Flexibility through Digital Twin-Based Virtual Commissioning. *Journal of Electrical Systems*. https://doi.org/10.52783/jes.9037 [included]
- Ratna Purwaningsih, Annisa Rahma Shintyastuti, Ary Arvianto, et al. (2025). Evaluating the impact of autonomous material handling on the performance of production system: a simulation approach. *SINERGI*. https://doi.org/10.22441/sinergi.2025.2.004 [included]
- Rob Ward, Payam Soulatiantork, Shaun Finneran, et al. (2021). Real-time vision-based multiple object tracking of a production process: Industrial digital twin case study. *Proceedings of the Institution of Mechanical Engineers Part B Journal of Engineering Manufacture*. https://doi.org/10.1177/09544054211002464 [included]
- Sergey Konstantinov, Fadi Assad, Bilal Ahmad, et al. (2022). Virtual Engineering and Commissioning to Support the Lifecycle of a Manufacturing Assembly System. *Machines*. https://doi.org/10.3390/machines10100939 [included]
- Sergey Konstantinov, Jesper Puggaard de Oliveira Hansen, Fadi Assad, et al. (2023). An analysis of the available virtual engineering tools for building manufacturing systems digital twin. *Procedia CIRP*. https://doi.org/10.1016/j.procir.2023.02.096 [included]
- Xiaochen Zheng, Xiaodu Hu, Rebeca Arista, et al. (2022). A semantic-driven tradespace framework to accelerate aircraft manufacturing system design. *Journal of Intelligent Manufacturing*. https://doi.org/10.1007/s10845-022-02043-7 [included]
- Xin-Hong Hu Xin-Hong Hu, Shao-Ting Liu Xin-Hong Hu, Jun-Xia Zhang Shao-Ting Liu, et al. (2024). Development and System Design of Intelligent Training Platform for Universities Based on Internet of Things Technology. *電腦學刊*. https://doi.org/10.53106/199115992024123506012 [included]
- Zsolt Molnár, Péter Tamás, Béla Illés (2021). Building a Reusable Data Model to Support Systematic Layout Planning with Discrete Event Simulation of Flexible Manufacturing Systems. *Hungarian Journal of Industry and Chemistry*. https://doi.org/10.33927/hjic-2021-29 [included]
