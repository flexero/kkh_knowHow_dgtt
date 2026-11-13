# 50 – AI in industry: what it is, where it helps in this factory, how to start

> Tab **AI in industry** (`#ai`). Item 1 = AI explained, item 2 = use-case map, item 3 = live AI labs (run offline in
> the browser), item 4 = how to start. Benefit numbers are **typical ranges reported** by vendors, studies and case
> reports – your result depends on your data. Lab data is simulated (examples).

## Contents
1. Purpose · 2. Where in the twin · 3. Concepts · 4. Use cases for this factory · 5. The labs (formulas) ·
6. Real-factory implementation · 7. Checklists · 8. Common mistakes · 9. Limits · 10. Glossary

---

## 1. Purpose
You asked: what is AI's role, and how can it really contribute? Short answer: **AI learns patterns from factory data
and turns them into predictions, inspections, better settings, plans and answers.** It does not replace engineering,
physics or certified safety. It pays where a problem costs money, data exists, and the result is used in daily work.

## 2. Where in the twin

| Item | Content | Deep link |
|---|---|---|
| 1 AI explained | data → learning → model → prediction → action; 6 kinds of AI; can / cannot; 6 roles; 6-question check "is AI right?" | `/#ai` |
| 2 Use-case map | 20 use cases on an area × role matrix and a value × effort chart; detail with data, method, benefit, pitfalls, link to the tab | `/?aiitem=2&aiuse=pdm#ai` |
| 3 Live AI labs | predictive maintenance, visual inspection, cutting-data optimisation, demand forecasting, retrieval assistant | `/?aiitem=3&ailab=pdm#ai` (pdm, vision, opt, fc, rag) |
| 4 How to start | 7-step roadmap, offline architecture, team, pilot cost, success measures, risks, EU rules, first 3 projects | `/?aiitem=4#ai` |

Files: `web/ai.js` (page), `web/ai_data.js` (content), `web/ailab.js` (labs, pure JS, offline), `web/ai.css`.

## 3. Concepts
- **Classic program:** a person writes the rule (IF vibration > 4.5 mm/s THEN alarm).
- **Machine learning:** the computer learns the rule from examples; it can combine many signals.
- **Supervised:** learns from examples with the right answer (labels). **Unsupervised / anomaly detection:** learns
  "normal" and flags what is different – good when failures are rare.
- **Computer vision:** neural networks (CNN) on images. **Optimisation:** searches the best settings within limits.
- **Forecasting:** predicts future values from history. **Generative AI / LLM:** writes and answers; with **RAG**
  (retrieval-augmented generation) it answers from your documents and shows sources.
- **Training / test data:** a model is judged only on data it did not see in training.
- **Precision / recall:** of the alarms, how many were real (precision); of the real failures, how many were caught (recall).
- **Drift:** the process changes (new tool, new material) → the model gets worse → monitor and retrain.

## 4. Use cases for this factory (item 2)

| Area | Use case | Role | Typical benefit (reported ranges) | Maturity |
|---|---|---|---|---|
| Maintenance | predictive maintenance of spindles + axes | predict | unplanned downtime −30 … −50 % | ●●●● |
| Machining | tool wear + breakage detection | predict | tool cost −10 … −25 % | ●●●● |
| Machining | adaptive feed + chatter avoidance | optimise | roughing cycle −5 … −20 % | ●●●● |
| Machining | cutting-data optimisation | optimise | cost per part −5 … −15 % | ●●● |
| Machining | thermal error compensation | predict | drift 20–30 → ≈ 5 µm | ●●●● |
| Quality | quality prediction (virtual metrology) | predict | measuring effort −30 … −70 % | ●●● |
| Quality | visual inspection | inspect | pseudo-defects −50 … −90 % vs rule-based | ●●●● |
| Quality | end-of-line test analysis | predict | faster diagnosis | ●●● |
| Robots | bin picking, vision guidance | automate | no feeders / trays | ●●●● |
| Robots | collision + wear monitoring | automate | fewer crashes | ●●●● |
| AGV + AS/RS | fleet + slotting optimisation | optimise | travel −10 … −30 % | ●●●● |
| MES / ERP | FMS scheduling | plan | on-time +5 … +15 % | ●●● |
| MES / ERP | demand + spare-part forecasting | plan | forecast error −10 … −30 % | ●●●● |
| Energy | HPU, chillers, compressed air | optimise | energy −5 … −20 % | ●●● |
| Hydraulics | condition monitoring | predict | fewer HPU failures | ●●● |
| AM | in-process monitoring | inspect | stop bad builds early | ●●● |
| Documents | engineering assistant (RAG) | assist | search time −50 % (claims) | ●●● |
| Maintenance | alarm + repair assistant | assist | repair time −10 … −30 % (claims) | ●●● |
| Engineering | PLC / CNC / robot code assistant | assist | faster standard code | ●●● |
| Safety | AI people detection in safety functions | automate | – high-risk, third-party assessment | ●● |

## 5. The labs (item 3) – formulas
- **Predictive maintenance:** logistic regression p = 1 / (1 + e^−(w·x + b)), trained by gradient descent on
  features RMS, kurtosis, temperature, bearing-frequency energy. Threshold choice by cost:
  cost = false alarms × € 150 + missed failures × € 18 000 (example) → a low threshold is often cheaper.
- **Visual inspection:** a small classifier on synthetic 24 × 24 surface images (OK, scratch, porosity, chatter);
  real systems use CNNs and 100s–1 000s of labelled images per defect.
- **Cutting-data optimisation:** cost per part from machining time, Taylor tool life T = (Ct / vc)^(1/n) and tool cost,
  limits for spindle power, surface Ra ≈ fz² / (8 r) and a chatter zone; grid, random, surrogate and Nelder–Mead
  search compared by the number of test cuts.
- **Forecasting:** moving average, Holt-Winters exponential smoothing, regression with trend + season; MAPE on a hold-out;
  safety stock = z · σ · √L → stock value difference.
- **Assistant (retrieval):** TF-IDF + cosine similarity over the standards library. A full RAG assistant adds a language
  model that writes the answer from the found documents (local LLM server for the offline factory).

## 6. Real-factory implementation (item 4)
1. Problem as a number with money (e.g. spindle crashes 6 → 2 per year).
2. Data check: sensors, historian, part serials linked to measurements, failure records.
3. Connect + store: OPC UA / MQTT → historian → MES by serial, one time base.
4. Simple first: dashboards, limits, SPC.
5. Pilot model on one machine; compare with today's method on the same data.
6. Run on an edge PC; alarms into SCADA / MES; a person decides at first.
7. Monitor drift, retrain, roll out.

Offline architecture: machines + sensors → edge PCs → historian + MES → on-premise AI server (training, local LLM) → apps.
Pilot cost (example): sensors + edge PC ≈ $3 000–15 000 per machine; GPU server ≈ $10 000–40 000; partner ≈ $20 000–80 000;
own people time is often the largest part.

**Recommended first 3 projects:** tool wear monitoring on the HMCs · spindle condition monitoring (start collecting
vibration now) · offline engineering assistant over the guides + standards library.

## 7. Checklists
- [ ] Goal as a KPI with money · [ ] simple rule checked first · [ ] data + labels available or being collected
- [ ] process stable · [ ] wrong answers caught before harm · [ ] result appears in SCADA / MES / maintenance
- [ ] test on unseen data · [ ] false alarms per week acceptable · [ ] drift monitoring + retraining plan
- [ ] data stays on-premise; IEC 62443 zones · [ ] AI Act / Machinery Regulation check · [ ] people trained

## 8. Common mistakes
1. Starting with the algorithm instead of the problem and the data.
2. No link between part serial, machine signals and measurement results.
3. Too many false alarms → people switch the system off.
4. Testing on the training data (looks perfect, fails in production).
5. Using an LLM answer without sources for technical decisions.
6. AI in a safety function instead of certified classic safety.

## 9. Limits
Use-case benefits are typical reported ranges, not guarantees. Lab models are small and run on simulated data to show
the principles; real systems need real data, validation and integration. Legal dates of the EU AI Act may change – check.

## 10. Glossary
| Term | Meaning |
|---|---|
| AI / ML | artificial intelligence / machine learning |
| Label | the right answer in a training example |
| Feature | a number computed from raw data (e.g. RMS of vibration) |
| CNN | convolutional neural network (images) |
| LLM / RAG | large language model / retrieval-augmented generation |
| Edge PC | industrial computer near the machine |
| Drift | data changes so the model gets worse |
| MAPE | mean absolute percentage error of a forecast |
| EU AI Act | Regulation (EU) 2024/1689 |
