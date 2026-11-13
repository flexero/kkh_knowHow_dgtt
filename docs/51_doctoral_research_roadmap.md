# 51 – Doctoral research roadmap: from this smart-factory twin to a PhD thesis

> Not a tab in the twin. This guide plans a **doctoral (PhD) thesis** built on the fields handled in this project.
> We go **one step at a time**. Step 1 (this version) = where the work stands against world level, and how to choose
> the research direction. Later steps are added to this guide as we do them.
> Scores, time plans and improvement numbers below are **examples** to show the method, not measured results.

## Contents
1. Purpose · 2. The 8 steps · 3. Concepts (what a PhD needs) · 4. Step 1 – world-level position ·
5. Step 1 – candidate research directions + scoring formula · 6. Thesis format and first papers ·
7. Checklists · 8. Common mistakes · 9. Limits · 10. Glossary · 11. Starting literature

---

## 1. Purpose
You asked: *how do I start a doctoral paper with the fields we built, and what level is it compared to the world?*

Short answer:
- The project is **very broad** (twin, FMS, MES, ERP, PLC, communication, AS/RS, robots, hydraulics, ball screws, AM,
  machine tools, AI). As an **engineering foundation** it is strong – it is like a large industrial handbook plus a
  working demonstrator.
- A PhD is judged on something different: **one narrow, new and proven contribution**. Breadth alone is not a PhD.
- Your best chance is not to compete with big labs on technology. It is to use what **only you have**: a real new
  factory, built under **real limits** (weak local industry, low budget, Modbus TCP + HTTP only, offline PCs) and the
  **real data** that will come from it.

## 2. The 8 steps (we do them one by one)

| Step | What | Output | Status |
|---|---|---|---|
| 1 | Position against world level, choose the direction | This guide, umbrella topic (section 5.2) | done – confirm with supervisor |
| 2 | Agree topic + thesis format with your supervisor (you have one) | 1-page concept note, then proposal (2–3 pages) | note written – discuss |
| 3 | Systematic literature review (PRISMA method) | Research gap + paper 1 | **done** – corpus frozen at 28 studies; paper 1 manuscript v0.9 complete |
| 3b | Your checks before submission: verify screening (kappa), supervisor review, choose journal | Paper 1 submitted | next |
| 4 | Research questions, hypotheses, method, evaluation measures | Research design chapter | **started** – full thesis plan `thesis/00_thesis_plan.md` (11 chapters, ≈ 148 pages) |
| 5 | Research version of the twin (reproducible, logged, validated) | Software + validation report | |
| 6 | Real data collection on a pilot line / pilot machine | Data set + data description | |
| 7 | Experiments: new method vs baseline, statistics | Papers 2 and 3 | |
| 8 | Write the thesis, defence | Thesis | |

## 3. Concepts – what a PhD needs

A doctoral contribution has three parts. If one is zero, the whole is zero:

**Contribution = Gap × New method × Proof**

- **Gap:** a problem that published research has not solved (shown by a literature review, not by opinion).
- **New method:** a model, algorithm, architecture or design method that others can reuse.
- **Proof:** real or realistic data, a comparison with the best known method (**baseline**), numbers, statistics, and
  peer review (journal papers).

Example of a good claim (example numbers): *"Our uncertainty-aware twin predicted the monthly output of the new line
within ±5 %, while a deterministic simulation (baseline) was off by ±15 %, over 6 months of real ramp-up data."*

Example of a weak claim: *"We built a digital twin with MES, ERP and 3D."* – many groups have done this since about
2017; reviewers will ask "what is new?"

**Digital Model / Shadow / Twin** (Kritzinger et al. 2018 – the classification reviewers use most):

| Level | Data from real → virtual | Data from virtual → real |
|---|---|---|
| Digital Model | manual | manual |
| Digital Shadow | automatic | manual |
| Digital Twin | automatic | automatic |

Our project today is mostly a **Digital Model** (example data, no real machine connected yet). The Modbus/HTTP parts
(guides 43, 45, 47) are designed for the Shadow/Twin level, but they are not yet proven on real machines.

**TRL (Technology Readiness Level, 1–9):** our work is about **TRL 3–4** (works in the lab / simulation). A strong
applied PhD in manufacturing usually shows **TRL 5–6** (validated in a relevant / real environment).

## 4. Step 1 – world-level position (honest)

| Field (guides) | What we have | World frontier (2024–2026) | Research novelty if used as-is |
|---|---|---|---|
| Digital twin + discrete-event simulation (01–03, 42) | DES, Monte Carlo what-if with ± uncertainty, 3D, offline | Live synchronised twins, hybrid physics + machine learning models, ISO 23247 framework, large commercial platforms (Siemens, Dassault, NVIDIA Omniverse) | Low – unless validated with real ramp-up data |
| MES / ERP (04, 45, 46) | Teaching re-implementation, ISA-95 structure | Mature commercial products; research on autonomous / AI scheduling, event-driven MES | Low |
| Communication (07, 43) | Modbus TCP + HTTP only, offline | OPC UA + umati, MQTT, TSN, 5G, asset administration shell | Low as technology, **medium** as "how far can a low-cost stack go" |
| PLC / ladder (05, 35–37, 47) | Delta + Siemens programs, standard interface | IEC 61499, virtual commissioning | Low |
| AS/RS, AGV, material handling (03, 11, 31–39) | Sizing, control, standard dispatching | Large research field on scheduling / multi-agent control | Medium – crowded field |
| Robot (21–24) | Kinematics, dynamics, control | Mature; research on learning-based control | Low |
| Spindle, HMC, machine tools (12, 18–19, 49) | Design and assembly knowledge | Thermal error compensation, chatter, in-process measurement | **Not in scope** (your decision 2026-11-13) |
| Ball screw + linear guide manufacturing (40–41, 44) | Routings, quality plan, 55 characteristics | Lead-error and thermal modelling, grinding process twins, virtual metrology | **Medium–high** – few groups, measurable result |
| Additive manufacturing (48) | Process twin LPBF | Very active research | High topic, but **not feasible** without an LPBF machine |
| AI (50) | Offline demo labs | Very active | Medium – only with your real data |

**Summary of the position**
- Level of the current work: very good **engineering / master level, wide**; not yet doctoral, because there is no
  new method, no real data, no comparison with the state of the art and no peer review yet.
- Your **unique advantages**: (1) a real greenfield factory, (2) real limits that most published twins ignore
  (cost, Modbus/HTTP only, offline, weak supplier base), (3) two product lines (compressor + ball screw) that can share
  one method – a natural second case study.
- Your **weak points**: no lab equipment for frontier topics (LPBF, 5G, large AI), and probably limited access to
  journals from the factory PC (literature work must be done on an online PC).

## 5. Step 1 – candidate research directions + scoring formula

| ID | Direction (working title) | What is new | Data you need |
|---|---|---|---|
| D1 | **Low-cost, offline digital twin architecture for SME factories with only Modbus TCP + HTTP** | A reference architecture + measured limits (latency, data loss, cost, fidelity) for constrained factories | Pilot line logs: cycle times, states, network timing |
| D2 | **Uncertainty-aware digital twin for the design and ramp-up of a new factory** | Twin that updates its uncertain inputs (MTBF, cycle time, scrap) from real ramp-up data (Bayesian updating) and improves decisions | Planned vs actual data from your ramp-up, month by month |
| D3 | **Ball screw lead-accuracy prediction (virtual metrology) from process data** | Model that predicts lead error / C-class from grinding and thermal data before final measurement | Thread-grinder data + lead measurement of each screw |
| D5 | **Integrated AS/RS + AGV + FMS scheduling** | New dispatching / scheduling rule tested in the twin | Order and transport logs |

**Selection formula** (weighted score, each criterion scored 1–5):

**S = Σ wᵢ · sᵢ**

| Criterion | Weight w | Why it matters |
|---|---|---|
| Novelty (gap in literature) | 0.25 | No gap → no PhD |
| Access to real data | 0.25 | No data → no proof |
| Feasibility in 3–4 years, with your budget | 0.20 | Must finish |
| Value for your own factory | 0.15 | Keeps company support |
| Fit with a supervisor's field | 0.15 | Supervisor must be able to judge it |

Worked example (example scores – **you** must re-score after talking to a supervisor):

| ID | Novelty | Data | Feasible | Factory value | Supervisor fit | **S** |
|---|---|---|---|---|---|---|
| D1 | 3 | 5 | 5 | 4 | 3 | 0.75+1.25+1.00+0.60+0.45 = **4.05** |
| D2 | 4 | 4 | 4 | 5 | 4 | 1.00+1.00+0.80+0.75+0.60 = **4.15** |
| D3 | 4 | 3 | 3 | 5 | 3 | 1.00+0.75+0.60+0.75+0.45 = **3.55** |
| D5 | 2 | 3 | 4 | 3 | 4 | 0.50+0.75+0.80+0.45+0.60 = **3.10** |

Reading of the example: **D2 with D1 as its base** is the strongest and safest combination. D1 gives the system
(you already have most of it), D2 gives the scientific core (a new method proven with real data). D3 is the best
choice if your supervisor is in precision engineering / metrology and the ball screw line starts early.

### 5.1 Can I do all directions? – factory yes, thesis: one umbrella (your question, 2026-11-13)

Two different things:
- **The factory** can and should get everything: low-cost twin, ramp-up twin, scheduling, ball screw quality,
  machine monitoring. That is engineering work, judged by "does it work and pay".
- **The thesis** must answer **one main question**. Five separate topics give five shallow chapters and no depth –
  examiners reject that. But the directions are **not separate**: D1, D2 and D5 are three parts of one question, and D3
  is a second case. So you can include them **under one umbrella**:

| Part of the thesis | Direction | Role |
|---|---|---|
| System | D1 low-cost offline twin (Modbus TCP + HTTP) | The tool that makes the method possible in your conditions |
| Core method | D2 uncertainty-aware twin, updated from real data | The main scientific contribution |
| Application | D5 FMS configuration + scheduling decisions in the twin | What the method decides: which machines join the FMS, when, with which rules |
| Second case | D3 ball screw line | Shows the method works in another factory (generality) |

D4 (spindle thermal twin) was removed on your decision – this field is not handled.

Rule: every part must answer the same main question. If a part does not, it goes to "future work" or a side paper.

### 5.2 Your country: first step of FMS modernisation – this is the gap

Your situation (2026-11-13): CNC machines are common, but **FMS is not yet established**; industry must advance a lot.
This makes the topic stronger, not weaker:
- Most published FMS / digital-twin work assumes an advanced industry (OPC UA, MES already running, skilled
  integrators). Very few papers answer: **how does a company that has only standalone CNC machines move to an FMS step by
  step, with limited money, limited technology and uncertain data?**
- Your factory is a real case of exactly this transition, measured from day 0.

**Levels from standalone CNC to FMS** (used as the "staircase" in the thesis):

| Level | Name | Typical state |
|---|---|---|
| 0 | Standalone CNC | Operator loads each machine, paper orders, no data |
| 1 | Connected CNC | Machine states + counters collected (Modbus TCP / HTTP), OEE known |
| 2 | Flexible cell | 1–3 machines + pallet changer / robot, programs called by part number |
| 3 | FMS line | Several machines + pallet pool / AGV / AS/RS, central cell controller, scheduling |
| 4 | Integrated FMS | FMS + MES + ERP, twin updated from real data, decisions supported by the twin |

**Proposed umbrella topic (working title):**
*"An uncertainty-aware, low-cost digital twin method for the stepwise introduction of flexible manufacturing systems in
emerging industries – cases of compressor and ball screw production."*

**Main research question:** How can a digital twin, built with low-cost technology and updated from real data, reduce
the risk of wrong FMS investment and speed up ramp-up when a company moves from standalone CNC to FMS?

Note on world level: international journals accept "first in our country" only if the **method is general** – useful for
any company in the same situation (SMEs, emerging industries). So the thesis always writes the method generally and uses
your factory as the proof.

### 5.3 Step 2 – concept note for the supervisor
The 1-page note is in `docs/51_concept_note_supervisor.md`. Fill in the [brackets], then discuss it with your supervisor.
It turns the umbrella topic into 3 research questions: RQ1 = D1 (system), RQ2 = D2 (core method), RQ3 = D5 (decisions);
D3 (ball screw) is the second case.

Bayesian updating used in RQ2 – worked example (example numbers). A failure rate λ (failures per hour) is described by a
Gamma(α, β) distribution; mean λ = α / β, so MTBF = β / α.
- Prior from the supplier: MTBF 400 h, weak confidence → α = 2, β = 800 h (mean λ = 2/800 = 0.0025 /h).
- Real data after installation: n = 3 failures in T = 900 h.
- Update: α' = α + n = 5, β' = β + T = 1 700 h → mean λ = 5 / 1 700 = 0.00294 /h → **MTBF = 340 h**.
- The twin now uses 340 h instead of 400 h, and the ± range becomes narrower as more hours are collected.

### 5.4 Step 3 – systematic literature review (SLR)
Protocol: `docs/51_slr_protocol.md`; extraction sheet: `docs/51_slr_extraction_template.csv` (open in Excel / LibreOffice).

**Why a systematic review (not a normal one):** the search is fixed and written down, so anyone can repeat it. That makes
the gap a *fact* ("of 180 included papers, 0 combine ramp-up + Bayesian updating + low-cost technology"), not an opinion.

**How the work goes (about 10–12 weeks, in parallel with the 4-month FMS design):**

| Week | Task | Output |
|---|---|---|
| 1 | Agree the protocol with the supervisor; install Zotero (free, works offline) | Protocol v1.0 frozen |
| 2 | Run S1–S3 in Scopus + WoS on an online PC, export RIS/CSV, log hits in §10 | Raw records |
| 3–4 | Remove duplicates; title + abstract screening; second reviewer checks 20 % (kappa) | Short list |
| 5–7 | Full-text reading, quality score, fill the extraction sheet | Extraction table |
| 8 | Snowballing (references + citations of included papers) | Final set |
| 9–10 | Concept matrix, statistics, gap statement | Results |
| 11–12 | Write paper 1, supervisor review, submit | Paper 1 submitted |

**PRISMA flow – example numbers** (yours will differ): identified 1 450 (Scopus 820 + WoS 630) → after duplicates
950 → after title / abstract 210 → full text assessed 210, excluded 70 → + 12 from snowballing → **included 152**.

**Files for step 3 (2026-11-13):**
- `research/sources/` – downloaded open-access papers (`papers/`), Zotero 10.0.8 installer (`software/`), and
  `README.md` with the full reference list, relevance, and the papers to get manually (Kritzinger, Florescu, Ullah &
  Younas, Schumacher …). Not in git – copy the folder to the offline PC by USB.
- `research/paper1_slr/paper1_draft.md` – manuscript of paper 1: Introduction, Background (incl. transition levels
  L0–L4 and the Bayesian formula), Method written in full; Results / Discussion as templates with [brackets] to fill
  from the real review. Nothing in [brackets] is a result.

**First real search – OpenAlex, 13 Nov 2026** (`research/paper1_slr/search_2026-11-13/`):
S1 = 269, S2 = 167, S3 = 50 hits → **448 unique records**. Files: `records.ris` (import into Zotero),
`screening.csv` (screening sheet, sorted by a keyword *priority* score – the score only sorts, it does not decide),
`search_log.txt` (exact strings). Repeat: `python research/paper1_slr/search_openalex.py` (needs internet).
Papers per year: 2015–2019 = 58, 2020–2022 = 83, 2023–2024 = 86, 2025 = 64, 2026 = 157 → the field is **growing fast**;
publish paper 1 soon, and re-run the search just before submission.

Two records are **very close** to your topic and must be read in full first (both now in the draft, Table 0):
- van Ginkel et al. (2025), Procedia CIRP – DTs for smart manufacturing system design and ramp-up in SMEs
  (qualitative, 3 case studies). It says research on DTs in design and ramp-up is lacking → supports your gap.
- Kampa et al. (2026), Applied Sciences – DT methodology for a planned FMS for a gear maker modernising from
  conventional machining to CNC + robots + AGV + AS/RS (VSM + DES + scheduling). Very similar *situation* to yours;
  difference: design stage only, deterministic, no validation against ramp-up data.
→ The gap is still open but narrower. Your claim must be precise: **sequential (Bayesian) updating of design-stage
predictions through commissioning and ramp-up, validated against real data, with low-cost technology.**

**Screening done by Claude (13 Nov 2026), on your request – you must verify it.**
Result in `research/paper1_slr/search_2026-11-13/`: `screening_decided.csv` (each record: decision, reason code,
review questions, short note; sorted I → U → E), `prisma_counts.txt`, raw batches in `screening_raw/`.
448 screened → **132 include, 72 unsure, 244 exclude** (E1 not manufacturing 72 · E2 concept only 14 · E3 single process
50 · E4 not peer-reviewed 21 · E5 no review question 84 · duplicate copies 3) → **204 to full text**.
Full texts: 42 downloaded automatically to `research/sources/fulltext/`; the other 162 are in `fulltext_to_get.csv`
(67 free but blocked for scripts, 95 paywalled).

Why you must still check: in a PhD the author is responsible for every decision, and journals require that AI help is
disclosed (already written in the draft, §3.4). Check = read all 132 "I" rows and 50 random "E" rows; mark where you
disagree; then kappa (§5 of the protocol) between you and the pre-screen. Typical time: 2–3 hours.

Get the missing full texts quickly with Zotero: *File → Import* `fulltext_candidates_204.ris` → select all items →
right-click → **Find Available PDF** (Zotero searches open-access copies). The rest through the university library.

**Full-text reading + data extraction – first 42 papers (13 Nov 2026):** `extraction_fulltext.csv` (one row per paper,
all columns of the extraction form; raw batches in `extraction_raw/`). 42 read → **28 included**, 11 excluded, 3 unclear.
Interim results are written into the draft (§4.0). Main messages:
- Most "digital twins" are still **digital models** (18 of 28); only 5 studies compare predictions with reality.
- Only 2 studies update inputs automatically from real data; **none uses Bayesian updating with plant data**.
- Only 1 study (Konstantinov et al. 2022) compares design-stage predictions with the real machine after commissioning:
  error 17 % → 8.7 % after manual recalibration – one station, no uncertainty model. Read it in full: it is your closest
  "proof" competitor, and its numbers are a good benchmark for your own ramp-up comparison.
- **Modbus in 0 of 28**; OPC UA in 6; 12 do not state the communication at all.
- 7 studies from emerging economies, but none follows a CNC-to-FMS transition with real data.
→ The gap (G1–G4) holds on the first 28 studies. Still to do: the other 162 full texts, Scopus / WoS search, your check.

**Paper 1 complete (v0.9, 13 Nov 2026) – your decision: no more searching, use the current 28 studies.**
`research/paper1_slr/paper1_draft.md` is now a full manuscript (about 7 000 words): abstract with real numbers,
introduction, background, method (OpenAlex strings, AI-use disclosure, deviations), results per review question with
Table 2 (28 studies) and Table 5 (concept matrix), discussion, gaps G1–G5, research agenda table, implications,
limitations, conclusion, AI-use statement and all 28 references. Figure 1 (PRISMA): `research/paper1_slr/figures/fig1_prisma.svg`.
The five gaps are exactly the five parts of your thesis: G1 = proof (frozen predictions vs ramp-up), G2 = core method
(Bayesian updating), G3 = system (Modbus TCP + HTTP), G4 = decisions (stepwise L0 → L4), G5 = your two cases.

Honest weak point that reviewers will see: only open-access full texts (42 of 204) and only OpenAlex. It is written
openly in §5.5. If your library gives the missing PDFs later, adding them makes the paper much stronger, but it is not
required for a first submission to a journal that accepts systematic mapping reviews.

Before you submit:
1. Verify the AI screening (132 I rows + 50 random E rows) and put the two kappa values into §3.4.
2. Send the manuscript to your supervisor.
3. Import the 28 references into Zotero and let Zotero format them in the journal's citation style.
4. Choose a journal (suggestions in §6 of this guide); check its policy on AI-assisted reviews.

**How to screen yourself (if you redo it), about 3–5 hours for 448 records:**
1. Zotero: *File → Import…* → `records.ris` → "Place in new collection" (name it *SLR OpenAlex 2026-11-13*).
2. Open `screening.csv` in Excel / LibreOffice. For each row read title + abstract, write in `decision`:
   **I** include, **E** exclude, **U** unsure (unsure goes to full text). For E write the code in `reason`
   (E1 not discrete manufacturing · E2 concept only · E3 single process only · E4 not peer-reviewed / editorial ·
   E5 does not address SQ1–SQ4).
3. Ask the second reviewer to screen 90 random rows (20 %) without seeing your decisions → compute kappa (§5 of the protocol).
4. Count: identified 448 → excluded … → full text … – these numbers go into the PRISMA diagram.
5. Do the same later with the Scopus / WoS exports (they will overlap; Zotero removes duplicates).

**Pilot search, 13 Nov 2026 (web search, excerpts only – verify every item in Scopus before use).** It supports the
gap: no source combined FMS design / ramp-up + Bayesian updating + low-cost technology + emerging-economy context.
Closest neighbours to read first and to **differentiate from**:

| Topic | What was found | How your thesis differs |
|---|---|---|
| Bayesian calibration of a twin | Modular Bayesian calibration (Gaussian processes) of a digital twin of an automated material handling system; calibrated model beat baseline | Theirs: system in operation. Yours: design-stage predictions frozen, updated through commissioning and ramp-up of a new FMS |
| Input uncertainty in twins | Politecnico di Milano work "Managing input parameter uncertainty in digital twins" | Check method; yours adds ramp-up phase + staging decisions |
| Live data fitting | Schumacher et al. (2024), *Journal of Simulation*: live fitting of process data within manufacturing digital twins | Yours: Bayesian (keeps uncertainty), low-cost data path |
| Twins in SMEs | SLR with an adoption roadmap for small and medium-sized manufacturers (Penn State); SLR of digital + green transition barriers in European manufacturing SMEs (Production & Manufacturing Research, 2025) | Yours: emerging economy, FMS transition, real validation |
| Emerging economies | 2026 review of digital twin adoption and sustainable manufacturing in developing countries: most research comes from developed countries | Confirms the context gap |
| FMS twins | Florescu (2024) twin from design → commissioning → operation of an FMS; Ullah & Younas (2024) twin for FMS "still in infancy" | Yours: uncertainty + updating + stepwise levels 0–4 |
| Low-cost retrofit | CIRP work: machine retrofit still needs manual engineering; 2026 review on retrofit with MTConnect / OPC UA for SMEs | Yours: only Modbus TCP + HTTP, measured limits |

## 6. Thesis format and first papers

Two formats exist (the university decides which is allowed):
- **Monograph:** one big book, 150–250 pages.
- **Thesis by publication:** usually 3–4 peer-reviewed journal papers + a linking chapter. More common today in
  engineering, and the papers prove world level by themselves.

Example paper plan for direction D2 + D1:

| Paper | Content | Needs the factory? |
|---|---|---|
| 1 | Systematic review: digital twins for factory design and ramp-up in resource-constrained SMEs | No – can start now |
| 2 | Architecture: low-cost offline twin (Modbus TCP + HTTP), lab validation with simulated machines | No – mostly built |
| 3 | Method: uncertainty-aware twin with Bayesian updating; validation on pilot-line data vs deterministic baseline | Yes |
| 4 | Second case: transfer of the method to the ball screw line | Yes |

Typical target journals in this field: CIRP Annals, Journal of Manufacturing Systems, Robotics and Computer-Integrated
Manufacturing, International Journal of Production Research, Journal of Intelligent Manufacturing, Computers in
Industry, IEEE Transactions on Industrial Informatics; for D3 also Precision Engineering and International Journal of
Machine Tools and Manufacture. Conferences: CIRP CMS, IFAC MIM, IEEE CASE (good for a first, faster paper).

### 6.1 Time plan matched to the real factory project (your answer, 2026-11-13)
The factory project: **4 months FMS design** (about Nov 2026 – Mar 2027), then **2–3 years building the real system**
(about Mar 2027 – 2029/2030) on this design. The PhD fits this almost perfectly, because direction D2 needs exactly
two things: **predictions made before** and **real data after**.

Key idea – **freeze the predictions now.** At the end of the design phase, save the twin's predictions with a date and
a version (git tag): output per month, OEE, bottleneck, buffer levels, lead time, ramp-up curve, each with its ±
uncertainty. Nobody can later say you adjusted them after seeing reality. Comparing these frozen predictions with
the real data is the **proof** part of the thesis.

| Period (approx.) | Factory project | PhD work | Data you get |
|---|---|---|---|
| Months 0–4 (Nov 2026 – Mar 2027) | FMS design | Steps 2–4: supervisor, proposal, literature review (paper 1), research questions; **freeze design predictions v1.0** | Planned values = *prior* (cycle times, MTBF, scrap from suppliers / estimates) |
| Months 4–12 | Purchasing, supplier FAT, building, installation | Step 5: research version of the twin, data logging over Modbus TCP + HTTP; paper 2 (architecture, lab validation) | Supplier quotes, FAT run-off data, real cycle times of each machine |
| Year 2 | First machines run (SAT), pilot line | Step 6: first real data; first Bayesian update of the inputs | Machine states, cycle times, stops, scrap – first *posterior* |
| Year 2–3 | Ramp-up of the FMS line | Step 7: predicted vs actual, updated twin vs baseline; paper 3 | Monthly ramp-up data |
| Year 3–4 | Full output, maybe ball screw line | Paper 4 (second case), thesis, defence | Second product line |

Formula for the main measure (example): **prediction error E = |predicted − actual| / actual × 100 %**, per month.
Example: twin predicted 1 700 compressors/month, real output 1 500 → E = 200 / 1 500 = 13 %. The thesis shows whether
the updated twin brings E lower and faster than the frozen design model (baseline).

## 7. Checklists

Step 1 is done when:
- [ ] You picked **one** main direction (and maybe one backup).
- [ ] You can say the gap in one sentence: "Nobody has shown … for … under …".
- [ ] You know which real data you will have, from which machine, from which month.
- [ ] You re-scored the table in section 5 with your own numbers.

Before contacting a supervisor:
- [ ] 1-page summary: problem, gap, method idea, data, expected result.
- [ ] Your CV with the project as evidence (screenshots of the twin, list of guides).
- [ ] 10–20 key papers you have actually read.

## 8. Common mistakes
- **"Yet another digital twin framework"** without real validation – the most common reason for rejection in this field.
- Choosing a topic too wide ("smart factory") – a PhD answers one question deeply.
- Using example data as if real – every number in this project is an example until measured.
- No baseline – a result is only meaningful compared with the best known method.
- Starting to write before the literature review – you may rebuild something already published.
- Choosing a fashionable topic (AM, 5G, large AI) without the equipment or data.

## 9. Limits
- The world-level judgement in section 4 is a general expert view, not a formal literature review; step 3 will check
  it properly with a search in Scopus / Web of Science.
- Rules for a PhD (format, number of papers, years) differ by country and university – step 2 checks them.
- All scores and numbers in this guide are examples.

## 10. Glossary
- **Gap:** an open question in published research. **Baseline:** the best known method you compare against.
- **Contribution:** what is new and reusable in your work. **Peer review:** experts check a paper before it is published.
- **Systematic review / PRISMA:** a literature review with a fixed, repeatable search and selection method.
- **TRL:** Technology Readiness Level 1–9. **Ramp-up:** the period from first part to full planned output.
- **Bayesian updating:** improve a guessed value (prior) with new measured data to get a better value (posterior).
- **Virtual metrology:** predict a measured quality value from process data, before or instead of measuring.

## 11. Starting literature (read these first; check details in the database)
- Kritzinger, W. et al. (2018). Digital Twin in manufacturing: A categorical literature review and classification.
  IFAC-PapersOnLine 51(11).
- Tao, F., Zhang, H., Liu, A., Nee, A.Y.C. (2019). Digital Twin in Industry: State-of-the-Art. IEEE Transactions on
  Industrial Informatics 15(4).
- Lu, Y., Liu, C., Wang, K.I-K., Huang, H., Xu, X. (2020). Digital Twin-driven smart manufacturing: Connotation,
  reference model, applications and research issues. Robotics and Computer-Integrated Manufacturing 61.
- ISO 23247-1…4 (2021). Automation systems and integration – Digital twin framework for manufacturing.
- Search terms for step 3: "digital twin" AND (SME OR "small and medium") ; "digital twin" AND ("ramp-up" OR
  "factory design") AND uncertainty ; "low-cost" AND "digital twin" AND Modbus ; "ball screw" AND ("lead error" OR
  "virtual metrology").
