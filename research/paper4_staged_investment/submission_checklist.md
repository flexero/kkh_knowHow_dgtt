# Submission checklist – Paper 4 (staged FMS investment with a learning digital twin)

## 0. Journal choice

- **Primary: *Computers & Industrial Engineering* (C&IE, Elsevier, Q1).** The contribution is a computational
  decision method that combines simulation, stochastic optimisation and Bayesian learning, tested in a
  reproducible simulation study. This is C&IE's core scope, and C&IE accepts reference/simulated cases if the
  method is general and transparent.
- **Alternative Q1: *International Journal of Production Economics*.** Strong fit for the investment economics
  (Terwiesch & Bohn 2001, cited, appeared there). IJPE reviewers will press harder on economic realism: placeholder
  costs and labour savings that are not valued. Use it if real quotations become available.
- **Open-access SCIE fallback: *Mathematics* or *Processes* (MDPI).** Faster, APC-based. Shorten Section 2 and the
  managerial section, and keep the method and results.

**Guide for authors not read online.** The C&IE guide-for-authors page could not be fetched by the assistant
(the publisher's site blocked automated access). The items below follow Elsevier's standard requirements; items
marked [verify] must be checked against the live guide before submission. Elsevier's generative-AI policy was read
online (elsevier.com, policies for journals) and is reflected in Section 3.

## 1. Journal format items

| Item | Status in this package | Action |
|---|---|---|
| Title page with all authors, affiliations, corresponding author | placeholders | fill in; check whether C&IE uses single- or double-anonymised review [verify]; if double-anonymised, upload a separate title page and remove self-identifying text ("doctoral thesis", companion-paper titles) from the manuscript |
| Abstract | 218 words, unstructured | check the C&IE limit [verify; Elsevier journals usually ask for ≤ 250 words] |
| Keywords | 6 | check the maximum (usually 1–7) [verify] |
| Highlights | 5 bullets, ≤ 84 characters | separate file `highlights.md` → "Highlights" upload |
| Graphical abstract | not prepared | optional [verify]; if made, do not use general-purpose generative AI (Elsevier policy) |
| Length | ~10 300 words incl. tables before references (build tool count) | C&IE has no fixed word limit known to us [verify]; if the editor asks to shorten: move Table 9 and Table 2 detail into an appendix/supplement, shorten Section 2.4 |
| Figures | 7 SVG (vector), Arial, Okabe–Ito palette, no titles inside | Elsevier accepts EPS/PDF/TIFF; convert the SVGs to PDF or EPS if the submission system rejects SVG (e.g. print the HTML from Chrome); check size at 174 mm (double column) / 84 mm (single column) |
| Tables | 9, editable Markdown/Word tables | keep editable (not images) |
| Equations | 14 numbered | the Word build shows them as text; re-type in the Word equation editor or submit LaTeX (Elsevier `elsarticle`) |
| References | author–year, APA-like | set to the C&IE style in Zotero [verify style: APA vs. Elsevier Harvard]; add DOIs where missing |
| Declarations | funding, CRediT, competing interests, data availability, generative-AI declaration | complete placeholders |
| Cover letter | `cover_letter.md` | add companion-paper status, thesis reference |
| Suggested reviewers | criteria only (`suggested_reviewers.md`) | authors select real people themselves |
| Line numbers, page numbers | DOCX from build tool has continuous line numbers | – |

Build: `set PYTHONIOENCODING=utf-8` then `python research/tools/build_paper.py research/paper4_staged_investment`
from the project root → `build/manuscript.pdf`, `build/manuscript.docx`.

## 2. Author to-dos – content

1. **Replace placeholder costs** (Table 4 capex, Table 5 margin, penalty, budget, maintenance, hours) with real
   supplier quotations and company data if available. Then set the new values in `thesis/code/staging.py` (copy first, do not edit
   the thesis version) or pass them through `staged.apply_settings`, re-run
   `python run_experiments.py all`, `python screen_check.py`, `python voi.py`, `python analyse.py`,
   `python make_figures.py`, and update every number in the manuscript. If no quotations exist, keep the
   wording "reference estimates (placeholders)" everywhere.
2. **Companion papers:** insert the real titles, journals and status for [Companion paper 1, 2, 3, 5]. Make sure
   the summary of the Bayesian twin (Section 3.4) does not reproduce text or figures of Paper 2.
3. **Thesis reference:** add the thesis citation (or "in preparation") and the repository DOI for code/data.
4. **Funding, CRediT, affiliations, e-mail.**
5. **Second load station:** Section 8 mentions it only as a limitation (the analysis belongs to Paper 5). Keep it
   that way to avoid overlap.
6. Check that the case company agrees to be described as "a manufacturer of V-type piston compressors"
   (no name is given).

## 3. Generative-AI use (Elsevier policy, read 2026-11)

- AI tools may help with language, structure and code, but authors must review everything and take full
  responsibility. AI cannot be an author or be cited as an author.
- A section titled "Declaration of generative AI and AI-assisted technologies in the manuscript preparation
  process" is required **at the end of the manuscript, before the references**. It is drafted in the manuscript
  and must be adapted to the **actual** use (tool name/version, purpose).
- Data, results and references must not be generated or altered by AI. All numbers in this manuscript come from
  the scripts in `code/` and were verified by re-running them (see Section 5 below).
- Figures are data visualisations produced reproducibly by `code/make_figures.py`. Name the tool (Python 3.12
  standard library) in the Methods/data statement if the editor asks.

## 4. References

- All references come from `thesis/references.md`, except nine classic works added after a web check of
  bibliographic records: Eppen et al. (1989) DOI 10.1287/opre.37.4.517; Fine & Freund (1990) DOI
  10.1287/mnsc.36.4.449; Kulatilaka (1988) DOI 10.1109/17.7447; Ahmed, King & Parija (2003) DOI
  10.1023/A:1023062915106; Birge & Louveaux (2011) DOI 10.1007/978-1-4614-0237-4; de Neufville & Scholtes (2011)
  [DOI from a library record – verify]; Rockafellar & Uryasev (2002) J. Banking & Finance 26(7) 1443–1471 [DOI not
  confirmed – verify]; Dixit & Pindyck (1994) Princeton UP; Powell (2011) Wiley [DOI from a library record –
  verify]. Powell (2011) was already cited in thesis Chapter 7.
- Entries marked **[verify]** must be checked in the library database before submission (volume, pages, DOI,
  author lists). Do not remove the marks until checked.
- Weak sources from the thesis (Cassius 2026, arXiv preprints) are **not** cited in this paper on purpose.

## 5. Verification record (numbers)

| Check | Result |
|---|---|
| Engine reproduces thesis experiment | `verify_against_thesis.py`: 240 of 240 policy results equal to 1 EUR (scenarios 1–40) |
| Main experiment | `data/main.csv` (200 scenarios × 11 policies) → `data/results_summary.txt` |
| Sensitivities | `risk.csv`, `risk_b1.csv`, `learning.csv`, `econ.csv`, `epistemic.csv` |
| Screening validation | `data/screen_check.json`, `data/screen_cases.csv` |
| Value of information, first-stage regret | `data/voi.json` |
| Computational effort | `data/timing.json` |
| Labels | every number in the manuscript is labelled [simulated], [calculated], [measured] or reference estimate |

## 6. Overlap and thesis-reuse policy

- Elsevier generally does not regard a thesis as prior publication [verify for C&IE: "Prior publication" /
  preprint policy in the guide]. Disclose the thesis in the cover letter (done) and in the manuscript (done in
  Declarations).
- Run a similarity check (iThenticate/Turnitin via the university) of the manuscript against the thesis PDF
  (`thesis/build/thesis.pdf`) and the companion manuscripts. The prose was written new for this paper, but Tables 4,
  5 and the option definitions necessarily match thesis Table 7.1 and Chapter 6. Target: no copied paragraphs,
  similarity driven only by tables, equations and references.
- If the thesis is published (repository) before the paper, cite it, and check the university rules for
  articles from the thesis.
- **No simultaneous submission**: submit this paper to one journal at a time, and keep the companion papers on
  clearly different research questions.

## 7. Known weaknesses a reviewer will raise (prepare answers)

1. Simulated ramp-up and placeholder costs → stated openly; robust ranking over ±30 % variations; protocol for
   real data in the thesis.
2. Rolling-horizon rule ignores the option value of later expansion → clairvoyant gap only 0.15 M EUR; ADP as
   future work.
3. Screening-model optimism (+1.25 %) and one costly decision error out of 40 → hybrid DES re-check proposed.
4. Risk term only over parameter samples, stage 1 uses point values → stated in Sections 4.1, 6.5 and 8.
5. Pallet pool / AGV rarely chosen → labour savings not valued; stated in Section 8.
6. The "+1.7 M EUR" thesis figure is versus a point-value plan; the paper reports the stricter +0.31 M EUR versus
   a stochastic fixed plan as the fairest measure of learning.
