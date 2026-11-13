# Systematic literature review protocol (step 3 → paper 1)

**Review title (working):** Digital twins for the design, ramp-up and stepwise introduction of flexible manufacturing
systems under technology and data constraints – a systematic literature review

**Reviewer:** Kenzo · **Second reviewer (sample check):** [supervisor or colleague] · **Version:** 0.1 · **Date:** 2026-11-13
**Method:** PRISMA 2020 (Page et al., BMJ 2021). Protocol is fixed **before** the search; any change is written in §10.

---

## 1. Review questions (linked to the thesis RQs)
| ID | Review question | Thesis RQ |
|---|---|---|
| SQ1 | Which architectures and communication technologies are used for manufacturing digital twins, and which work with low-cost / legacy technology (e.g. Modbus TCP, HTTP, offline)? | RQ1 |
| SQ2 | How is uncertainty of input parameters (cycle time, failure, scrap, demand) represented in manufacturing digital twins, and how is it updated with real data (calibration, Bayesian updating, live fitting)? | RQ2 |
| SQ3 | How are digital twins used in the design, commissioning and ramp-up of FMS / production systems, and how are their predictions validated against reality? | RQ2, RQ3 |
| SQ4 | Which studies address SMEs or emerging / developing economies and the stepwise move from standalone CNC to FMS? | RQ3, context |

## 2. Sources
- Main: **Scopus**, **Web of Science Core Collection**.
- Supplementary: **OpenAlex** (free, open; run by `research/paper1_slr/search_openalex.py`, same blocks A, B, C1–C3,
  title + abstract, 2015–2026, articles + reviews), IEEE Xplore, ScienceDirect (for CIRP / Procedia), Google Scholar
  (first 100 hits per string only).
- **Snowballing:** backward (references) and forward (citations) of all included papers, one round.
- Searches are run on an **online PC**; results are exported (RIS / CSV) and processed offline in Zotero + a spreadsheet.

## 3. Search strings (Scopus syntax; adapt for WoS: TS=)
Block A – twin / simulation:
`("digital twin*" OR "digital shadow" OR "virtual factory" OR "discrete event simulation")`
Block B – system:
`("flexible manufacturing" OR "FMS" OR "manufacturing system*" OR "production system*" OR "machining line" OR "CNC")`
Block C1 – uncertainty / data: `(uncertaint* OR bayesian OR calibrat* OR "parameter updat*" OR "data assimilation" OR "live fitting")`
Block C2 – life-cycle phase: `("ramp-up" OR "ramp up" OR commissioning OR "factory design" OR "system design" OR "factory planning")`
Block C3 – context: `(SME* OR "small and medium" OR "emerging econom*" OR "developing countr*" OR "low-cost" OR legacy OR retrofit* OR Modbus)`

| String | Combination | Answers |
|---|---|---|
| S1 | A AND B AND C1 | SQ2 |
| S2 | A AND B AND C2 | SQ3 |
| S3 | A AND B AND C3 | SQ1, SQ4 |

Example full string S2: `TITLE-ABS-KEY(("digital twin*" OR "digital shadow" OR "virtual factory" OR "discrete event simulation") AND ("flexible manufacturing" OR "manufacturing system*" OR "production system*") AND ("ramp-up" OR "ramp up" OR commissioning OR "factory design" OR "factory planning")) AND PUBYEAR > 2014 AND (LIMIT-TO(LANGUAGE,"English"))`

Record for each search: database, date, exact string, number of hits (write it in §10).

## 4. Inclusion / exclusion criteria
Exclusion reason codes for the `reason` column: **E1** not discrete manufacturing (process industry, energy,
pharma, buildings …) · **E2** concept only, no model / architecture / case · **E3** single physical process only, no
system view · **E4** not peer-reviewed / not English / editorial / special-issue notice · **E5** does not address SQ1–SQ4.

| Include (all must hold) | Exclude (any one) |
|---|---|
| Published 2015–2026 | Not about discrete manufacturing (e.g. process industry, buildings, health) |
| English, peer-reviewed journal or major conference (CIRP, IFAC, IEEE, Procedia) | Only a concept with no model, architecture or case |
| Digital twin / DES of a manufacturing system, line, cell or machine group | Only a single physical process (welding pool, cutting force) without system view |
| Addresses at least one of SQ1–SQ4 | Editorials, theses, patents, non-peer-reviewed white papers (may be noted as grey literature) |

## 5. Screening
1. Remove duplicates (Zotero → "Duplicate items").
2. Title + abstract screening against §4 → include / exclude / unsure (unsure goes to full text).
3. Full-text screening → final set; write the exclusion reason for every excluded full text.
4. **Second-reviewer check:** a second person screens a random 20 % sample. Agreement by Cohen's kappa:
   **κ = (p_o − p_e) / (1 − p_e)**, p_o = observed agreement, p_e = agreement expected by chance.
   Example: 100 abstracts, agree on 88 → p_o = 0.88; reviewer 1 includes 30 %, reviewer 2 includes 25 % →
   p_e = 0.30·0.25 + 0.70·0.75 = 0.60 → κ = (0.88 − 0.60) / 0.40 = **0.70** (≥ 0.6 = acceptable; below → discuss and
   sharpen the criteria).

## 6. Quality assessment (each 0 / 0.5 / 1; max 6)
Q1 clear aim · Q2 method described so it can be repeated · Q3 real (not only synthetic) data · Q4 comparison with a
baseline or reality · Q5 limitations discussed · Q6 context described (company size, technology).
Papers with score < 2 are kept in the counts but not used for strong conclusions.

## 7. Data extraction (one row per paper – template `docs/51_slr_extraction_template.csv`)
ID, authors, year, venue, country of case, company size, sector, system type, **FMS level 0–4** (guide 51 §5.2),
**Kritzinger level** (model / shadow / twin), TRL, life-cycle phase (design / commissioning / ramp-up / operation),
communication technology, cost information, uncertainty representation, updating method, data type (real / synthetic),
validation (vs baseline / vs reality / none), accuracy measure + value, decisions supported, limitations, quality score, SQ answered.

## 8. Synthesis
- Descriptive: papers per year, venue, country, sector; share of real-data validation.
- **Concept matrix** (rows = papers, columns = features: low-cost tech · uncertainty updating · ramp-up phase ·
  stepwise FMS · emerging context · real validation). **Empty or nearly empty combinations = the gap** for the thesis.
- Narrative synthesis per SQ; no meta-analysis (studies are too different).

## 9. Report (paper 1)
PRISMA flow diagram (identified → screened → full text → included), tables of §7, concept matrix, gap statement,
research agenda. Target: Journal of Manufacturing Systems, Computers in Industry, International Journal of Production
Research, or Production & Manufacturing Research (open access). Check each journal's scope and review-paper policy first.

## 10. Log of searches and changes
Change 2026-11-13: title/abstract screening done as **AI-assisted pre-screen with human verification** (instead of
first author alone); reported and disclosed in the paper (§3.4).

| Date | Database | String | Hits | Note |
|---|---|---|---|---|
| 2026-11-13 | OpenAlex | S1 (A AND B AND C1) | 269 | title_and_abstract.search, 2015–2026, article + review; exact strings in `research/paper1_slr/search_2026-11-13/search_log.txt` |
| 2026-11-13 | OpenAlex | S2 (A AND B AND C2) | 167 | same |
| 2026-11-13 | OpenAlex | S3 (A AND B AND C3) | 50 | same; total 486 → **448 unique**; 63 without abstract in OpenAlex (screen by title / full text) |
| 2026-11-13 | OpenAlex | title/abstract screening | 448 | AI pre-screen (Claude, 5 parallel batches, criteria §4) + corrections file: I 132, U 72, E 244 (E1 72, E2 14, E3 50, E4 21, E5 84, DUP 3) → 204 to full text. **Kenzo must verify** all I and a 20 % sample of E (kappa) |
| 2026-11-13 | OpenAlex | full-text retrieval | 204 | 42 open-access PDFs downloaded automatically; 67 open access but blocked for scripts; 95 paywalled → `fulltext_to_get.csv` |
| 2026-11-13 | OpenAlex | full-text assessment + extraction | 42 | AI-assisted (5 batches, extraction form §7): I 28, E 11 (E1 1, E2 3, E3 2, E4 2, E5 3), U 3 (incomplete PDF / thesis) → `extraction_fulltext.csv`; Kenzo to verify |
| | Scopus | S1–S3 | | to do (university access) |
| | Web of Science | S1–S3 | | to do |
