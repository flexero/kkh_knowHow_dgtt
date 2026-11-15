# 57 – Publishing the doctoral research in SCI journals

This guide explains how the doctoral research is turned into journal papers that count for the doctorate, and how to
submit them. Your country requires publication in SCI(E) journals, so every paper must go to a journal that is
**indexed in Web of Science Core Collection – Science Citation Index Expanded (SCIE)**.

Contents
1. What "SCI" means and how to check a journal
2. The paper plan: five papers from one thesis
3. Order and timeline
4. What a journal paper needs that the thesis does not have
5. Rules you must follow (honesty, overlap, AI use, authorship)
6. Step-by-step submission
7. Peer review and the response letter
8. Building the manuscript files
9. Checklists

---

## 1. What "SCI" means and how to check a journal

| Term | Meaning |
|---|---|
| **Web of Science (WoS)** | citation database of Clarivate. The doctoral rule usually refers to it. |
| **SCI / SCIE** | Science Citation Index (Expanded): the WoS index of science and engineering journals. Today "SCI" and "SCIE" are one list (SCIE). |
| **JCR, Impact Factor (IF)** | Journal Citation Reports: yearly citation statistics of SCIE journals; IF = citations in year Y to items of Y−1 and Y−2 ÷ number of those items. |
| **Quartile Q1 – Q4** | rank of the journal inside its JCR subject category (Q1 = top 25 %). Many universities ask for Q1/Q2, or give more points for them. |
| **ESCI** | Emerging Sources Citation Index – also in Web of Science but **not** SCIE. Check whether your university accepts it (usually not). |
| **Scopus** | a different database (Elsevier). A journal can be in Scopus but not in SCIE. |

**How to check a journal (do this before every submission – indexing changes every year):**
1. Open the Clarivate *Master Journal List* (mjl.clarivate.com) and search the journal title or ISSN.
2. Under "Web of Science Core Collection" it must say **Science Citation Index Expanded**.
3. For the quartile, look in JCR (through the university library) under the right subject category
   (e.g. *Engineering, Manufacturing*; *Operations Research & Management Science*; *Engineering, Industrial*;
   *Instruments & Instrumentation* / *Computer Science, Information Systems*).
4. Ask the doctoral office which list and which year counts (the JCR year at submission or at publication).

**Warning – predatory and hijacked journals.** Never answer e-mails that invite you to publish quickly for a fee in a
journal you do not know. Check the journal's web address on the Master Journal List (hijacked journals copy the name of
a real journal with a different website). Real SCIE journals never guarantee acceptance.

## 2. The paper plan: five papers from one thesis

Each paper has **one** main contribution, its own data and its own research question. This avoids "salami slicing"
(splitting one result into several papers) and duplicate publication.

| No. | Paper | Thesis chapters | Main contribution | Data type | Folder |
|---|---|---|---|---|---|
| 1 | Systematic literature review: digital twins for the transition to FMS | 2 | gap in the literature (PRISMA 2020) | published studies | `research/paper1_slr/` |
| 2 | Uncertainty-aware digital twin with sequential Bayesian updating for FMS ramp-up | 4, 6, 9.2.2 | the learning method + frozen design prediction | simulated ramp-up | `research/paper2_bayesian_twin/` |
| 3 | Low-cost Modbus TCP / HTTP architecture with an event-preserving register block for twins and FMS control | 5, 8.9 | architecture, sizing model, lab measurements | measured (test bench) | `research/paper3_modbus_architecture/` |
| 4 | Staged FMS investment with a learning digital twin | 7, 9.2.3 | sequential investment decision under uncertainty | simulated, reference costs | `research/paper4_staged_investment/` |
| 5 | Process-level design of a pallet-based FMS cell (queueing model + virtual commissioning) | 4.3.3, 8.9, 9.2.5 | load-station bottleneck, dispatching rules, design rule | simulated on a virtual plant | `research/paper5_fms_cell_design/` |

The target journal of each paper is written in its `cover_letter.md` and `submission_checklist.md` (section 2.1 below
is filled in when the manuscripts are finished).

### 2.1 Target journals

Status 2026-11-15: papers 2 – 5 written (manuscript, figures, highlights, cover letter, reviewer criteria, checklist,
code and data); paper 1 draft exists. Journal facts were taken from the journals' web pages or search extracts on
2026-11-15 – check them again before submission (several official pages blocked automated reading; open them in a browser).

| Paper | Primary journal | Index / level [check] | Why this journal | Alternative | Size of the draft |
|---|---|---|---|---|---|
| 2 Bayesian twin | *Journal of Manufacturing Systems* (Elsevier) | SCIE, Q1 | system-level digital-twin method + simulation evaluation | *Machines* / *Applied Sciences* (MDPI) | 31 p., ~7 240 words, 7 figures, 9 tables |
| 3 Modbus architecture | *Sensors* (MDPI, open access) | SCIE, Q2 (JIF 2024 3.5, Instruments & Instrumentation); APC about CHF 2 600 | data-acquisition mechanism + loss model + measurement campaign; revision round possible | *J. Industrial Information Integration*; *J. Manufacturing Systems* | 36 p., ~9 000 words, 7 figures, 13 tables |
| 4 Staged investment | *Computers & Industrial Engineering* (Elsevier) | SCIE, Q1 | computational decision method under uncertainty | *Int. J. Production Economics* (after real quotations); *Mathematics* / *Processes* (MDPI) | 29 p., ~8 900 words, 7 figures, 9 tables |
| 5 FMS cell design | *The International Journal of Advanced Manufacturing Technology* (Springer) | SCIE | process-level design of manufacturing systems with industrial use | *J. Manufacturing Systems*; *Int. J. Production Research* | 27 p., ~7 400 words, 7 figures, 6 tables |
| 1 Review | to be chosen after full-text screening (e.g. a review-friendly SCIE journal in manufacturing) | – | – | – | draft |

Honest points every reviewer will see (keep them in the papers):
- paper 2: two simple baselines (persistence, rolling re-calibration) are slightly more accurate over the whole year; the
  twin wins in months 2 – 6, in calibrated intervals (≈ 94 % coverage) and in bottleneck identification;
- paper 3: measured on one PC with simulated PLCs; real-PLC verification still to be done (best improvement before submission);
- paper 4: costs are placeholders – replace with quotations; with capex + 30 % or a small budget "all at once" wins;
- paper 5: results on a virtual plant; the first batch of runs was invalid (false OFFLINE under host load) and repeated.

Findings of the papers that changed the software or the thesis:
- paper 3: stale REQ frames could run a job twice → sequence guard added (map V1.2a, guide 53 §28.1, test check 21);
- paper 5: one slow Modbus answer marked a machine OFFLINE → OFFLINE only after 3 failed polls, time-out 0.5 s;
- paper 4: value of re-deciding is +1.61 M EUR with 200 scenarios (thesis: +1.7 M EUR with 40); shortfalls occur in
  stages 3 – 4, not stage 1 – correct thesis Chapter 7;
- paper 3: thesis Chapter 5 – the "achieved rate" was calculated, not measured; gateway cost 0.04 ms is an upper bound
  (measured ≈ 0.013 ms per request).


## 3. Order and timeline

Recommended order [planning estimate – review times vary a lot]:

| Order | Paper | Why this order | Typical time to decision |
|---|---|---|---|
| 1 | Paper 3 (architecture) | it has **real measured data**, the clearest engineering contribution and fits fast SCIE journals – the best chance of an early acceptance | 1 – 3 months (open-access SCIE) |
| 2 | Paper 5 (cell design) | practical, validated with real control software on a virtual plant | 2 – 6 months |
| 3 | Paper 2 (Bayesian twin) | the scientific core – submit to a strong journal; it cites papers 3 and 5 | 4 – 12 months (Q1) |
| 4 | Paper 4 (staged investment) | builds on paper 2; submit after paper 2 is under review | 4 – 12 months |
| – | Paper 1 (review) | can go any time after the full-text screening is finished | 3 – 8 months |

Submit papers that depend on each other as "companion papers": disclose the related manuscripts in the cover letter and
upload them as confidential material if the journal allows it. **Never submit the same paper to two journals at the same
time.**

Field data: as soon as the first real machines run, collect data with the protocol of thesis §9.6. A later version of
paper 2 or a follow-up paper with real ramp-up data is much stronger than any simulation.

## 4. What a journal paper needs that the thesis does not have

| Thesis | Journal paper |
|---|---|
| 130 + pages, many topics | 15 – 30 pages, **one** contribution |
| long background chapters | 1 – 2 pages of focused related work that shows the gap |
| results described | results **compared** with baselines, with confidence intervals / statistical tests |
| written for the examiners | written for international readers: clear novelty claim in abstract, introduction and conclusion |
| university format | the journal's template, reference style, word limit, highlights, graphical abstract |
| one reference list | only references the paper really uses, all checked (DOI) |

The structure is almost always **IMRaD**: Introduction – (Related work) – Method – Results – Discussion – Conclusion,
plus declarations (funding, author contributions, competing interests, data availability, use of generative AI).

## 5. Rules you must follow

1. **Honest data labels.** All factory data in papers 2, 4 and 5 are design estimates and simulations; paper 3 contains
   real measurements on a test bench with simulated PLCs. Each paper says this clearly. Never present a simulated value
   as a factory measurement. Reviewers accept a well-designed simulation study; they reject hidden simulation.
2. **Overlap with the thesis.** Publishers check text similarity (iThenticate). Most publishers allow a paper that is
   based on your thesis, but the text must be rewritten and the thesis may need to be cited – read the publisher's policy
   on "prior publication / theses" and tell the editor in the cover letter. Some universities require the papers to be
   published *before* the thesis defence ("thesis by publication") – ask the doctoral office.
3. **No duplicate publication between the five papers.** Do not reuse figures or long passages between the papers; refer
   to the companion paper instead.
4. **Generative AI.** These manuscripts were drafted with AI assistance (Claude). Journals and universities have rules:
   most require a declaration; AI cannot be an author; you are responsible for every sentence, number and reference.
   Read the rules of the journal and of your university, adapt the AI statement in each manuscript, and read and check
   the whole text yourself before submission.
5. **References.** Every reference must exist and say what the paper claims. Entries marked **[verify]** must be checked
   in the library database (Zotero/EndNote can then format them in the journal style).
6. **Authorship.** Authors are the people who made a real contribution (you, your supervisor, others who contributed).
   Use the CRediT roles (conceptualization, methodology, software, validation, writing …). Decide the author list and the
   corresponding author with your supervisor before the first submission.
7. **Data and code.** Journals ask where data and code are available. Put the paper's `code/` and `data/` folders in a
   public repository (e.g. Zenodo, which gives a DOI) when the paper is accepted – or earlier if the journal requires it.

## 6. Step-by-step submission

1. Read the journal's *Guide for Authors* again (it changes).
2. Fill in the author data, affiliations, ORCID iDs, funding and CRediT roles in `manuscript.md`.
3. Check all **[verify]** references and every number against the `data/` files.
4. Build the files: `python research/tools/build_paper.py research/paperN_...` (section 8). Copy the text into the
   journal's Word or LaTeX template if the journal requires its template.
5. Run a similarity check if the university offers one (compare with the thesis).
6. Prepare the cover letter (`cover_letter.md`), highlights, graphical abstract (if required), figures as separate files
   (SVG → convert to TIFF/EPS/PDF if the journal asks), and the suggested-reviewer list (real experts you choose with your
   supervisor – never invent names; no colleagues from your own institution, no recent co-authors).
7. Create an account in the journal's submission system (Editorial Manager, ScholarOne, MDPI SuSy …) with your real
   data, upload, approve the PDF proof the system makes.
8. Keep a log: date, journal, manuscript number, status.

## 7. Peer review and the response letter

Decisions: *desk reject* (editor, 1 – 3 weeks) – *reject* – *major revision* – *minor revision* – *accept*.

- After a desk reject: improve the fit, go to the alternative journal of the checklist.
- After a revision decision: answer **every** comment in a response letter: quote the comment, answer politely, say what
  you changed and where (page/line). Mark changes in the manuscript. If you disagree, explain with evidence.
- Typical requests for these papers: real data (answer: field-validation protocol, limitations, planned follow-up),
  more baselines, statistical significance, comparison with OPC UA/MQTT (paper 3), sensitivity analysis.

## 8. Building the manuscript files

```
python research/tools/build_paper.py                                  # all papers
python research/tools/build_paper.py research/paper3_modbus_architecture
python research/tools/build_paper.py research/paper1_slr --file paper1_draft.md
```

Output in `<paper>/build/`: `manuscript.pdf` (for reading and for co-authors), `manuscript.docx` (continuous line
numbers, page numbers, figures embedded – most journals accept Word at first submission). Equations are converted to
readable text; for the final version use the journal template (Word equation editor or LaTeX).

## 9. Checklists

**Before the first submission of any paper**
- [ ] journal confirmed in the Master Journal List as SCIE; quartile checked
- [ ] author list, affiliations, ORCID, corresponding author agreed with the supervisor
- [ ] all [verify] references checked; no invented reference
- [ ] every number traced to `data/` or to a script in `code/`
- [ ] data labels honest (measured / simulated / design estimate)
- [ ] generative-AI statement adapted to the journal and university rules
- [ ] thesis-reuse policy of the publisher read; companion papers disclosed in the cover letter
- [ ] word limit, abstract limit, keywords, highlights, figure formats as required
- [ ] university / supervisor approval to submit

**After acceptance**
- [ ] code and data in a public repository with DOI
- [ ] proofs checked carefully (equations, tables)
- [ ] paper registered with the doctoral office (journal, year, DOI, quartile)
