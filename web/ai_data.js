/* AI tab – DATA: basics, use cases for the fields of this twin, roadmap, architecture, risks, law.
 * Benefit numbers are TYPICAL RANGES reported by vendors / studies / case reports – your result depends on your data.
 * Examples named are public, well-known cases; no recommendation of a vendor. */

// AI kinds: [key, name, what it does, how it learns, factory example, needs]
export const KINDS = [
  ["sup", "Supervised machine learning", "learns to predict a label or a number from examples", "from past data WITH the right answer (labels): 'this vibration → bearing failed 2 weeks later'", "bearing failure in 2 weeks: yes / no; tool wear in µm; scrap risk of a part", "100s–1000s of labelled examples, sensors, a historian"],
  ["unsup", "Unsupervised learning / anomaly detection", "finds what is unusual or groups similar things", "from normal data only – learns 'what normal looks like'", "spindle sound that is different from all normal days; clusters of similar alarms", "weeks of normal operation data"],
  ["vision", "Computer vision (deep learning)", "sees: detects defects, reads codes, measures, guides robots", "neural networks (CNN) trained on labelled images", "porosity on a casting, scratch on a seal face, robot picks parts from a box", "camera + lighting + 100s–1000s of labelled images per defect, GPU / edge PC"],
  ["opt", "Optimisation + reinforcement learning", "finds the best settings or the best plan under constraints", "searches with a model (simulation, digital twin) or learns by trial and reward", "cutting data, schedule of 3 HMCs, AGV routes, energy use of the HPU", "a good model or a simulator (= the digital twin!) + clear goal and limits"],
  ["fc", "Forecasting (time series)", "predicts future values", "from history + known drivers (season, promotions)", "orders per week, spare-part demand, energy load", "2–3 years of clean history"],
  ["gen", "Generative AI / large language models (LLM)", "writes, summarises, answers questions, writes code", "pre-trained on huge text; adapted with your documents (RAG)", "assistant that answers 'what is the safety distance?' from your guides + standards; drafts work instructions; explains alarms", "your documents, a local LLM server (offline) or cloud; human review"],
];

export const CAN = [
  ["Find patterns in large sensor data that people cannot see", "Replace physics and engineering – the model must still respect limits"],
  ["Predict failures days or weeks before they happen (when data exists)", "Predict failures that never happened before and left no data"],
  ["Inspect 100 % of parts tirelessly with stable criteria", "Work without good, labelled data and good lighting"],
  ["Search settings faster than trial and error", "Be 100 % correct – it gives probabilities; you need limits and checks"],
  ["Answer questions from your documents and draft texts", "Take responsibility – safety functions stay classic, certified (ISO 13849)"],
  ["Learn and improve with more data", "Fix bad processes – first stabilise the process, then add AI"],
];

// role keys for the use-case matrix
export const ROLES = [["predict", "Predict"], ["inspect", "Inspect"], ["optimise", "Optimise"], ["automate", "Automate / control"], ["plan", "Plan + forecast"], ["assist", "Assist people"]];

// Use cases. tab = twin tab to open. mat 1..5 (5 = proven, standard products exist), eff 1..3 (effort), val 1..5 (value for this factory)
export const USES = [
  { k: "pdm", area: "Maintenance", tab: "scada", role: "predict", kind: "sup", name: "Predictive maintenance of spindles + axes", mat: 4, eff: 2, val: 5,
    what: "Predict spindle bearing, ball screw and guide wear from vibration, temperature, current; plan the repair before the crash.", data: "vibration (accelerometer on spindle), motor current, temperature, run hours, past failures (historian)",
    method: "features (RMS, kurtosis, bearing frequencies) → anomaly detection first, classifier / remaining-life model when failures are recorded", benefit: "unplanned downtime −30 … −50 %, maintenance cost −10 … −40 % (typical claims)",
    pit: "few real failures in the data → start with anomaly detection; sensor mounting matters", ex: "machine makers' spindle monitoring options; condition monitoring systems on HMC spindles" },
  { k: "tool", area: "Machining (HMC / CNC)", tab: "cnc", role: "predict", kind: "sup", name: "Tool wear + breakage detection", mat: 4, eff: 2, val: 5,
    what: "Detect a worn or broken tool from spindle power / force signals; change it at the right time, not too early or too late.", data: "spindle load per tool and program block, tool life counters, quality results",
    method: "learned 'normal power curve' per tool + limits; ML for wear prediction", benefit: "tool cost −10 … −25 %, fewer scrap parts and crashes",
    pit: "every tool / material / program needs its own learned curve", ex: "tool-monitoring systems from monitoring makers and CNC vendors" },
  { k: "adapt", area: "Machining (HMC / CNC)", tab: "mt", role: "optimise", kind: "opt", name: "Adaptive feed control + chatter avoidance", mat: 4, eff: 1, val: 4,
    what: "The CNC changes feed with the actual load and changes spindle speed when chatter starts.", data: "spindle load, vibration / sound, in the CNC",
    method: "control algorithms + learned limits inside the CNC (vendor option)", benefit: "cycle time −5 … −20 % in roughing, better surface",
    pit: "buy as a CNC option; test on your parts", ex: "adaptive feed / chatter functions of major CNC makers (see Machine tools tab trends)" },
  { k: "cutopt", area: "Machining (HMC / CNC)", tab: "cnc", role: "optimise", kind: "opt", name: "Cutting-data and program optimisation", mat: 3, eff: 2, val: 4,
    what: "Find the cutting data and tool paths with the lowest cost per part within power, surface and chatter limits.", data: "tool life tests, cycle times, Ra results, CAM data",
    method: "surrogate / Bayesian optimisation over a physics model (see lab 'opt')", benefit: "cost per part −5 … −15 % with fewer test cuts",
    pit: "the cost model must be right; validate on the machine", ex: "CAM software with AI feed optimisation" },
  { k: "thermal", area: "Machining (HMC / CNC)", tab: "hmc", role: "predict", kind: "sup", name: "Thermal error compensation", mat: 4, eff: 2, val: 4,
    what: "Predict how much the machine grows from temperatures and correct the axes.", data: "temperature sensors on spindle, column, bed + measured drift (probe)",
    method: "regression / neural network from temperatures → drift", benefit: "drift 20–30 µm → ≈ 5 µm over a day",
    pit: "needs a measured drift test (ISO 230-3) for training", ex: "thermal compensation functions of machine makers" },
  { k: "spc", area: "Quality", tab: "mes", role: "predict", kind: "sup", name: "Quality prediction (virtual metrology)", mat: 3, eff: 2, val: 5,
    what: "Predict the bore size / roundness of a part from machine signals BEFORE measuring – measure only the risky parts.", data: "machine signals per part + measured results (CMM, gauges) linked by serial number (MES)",
    method: "regression / gradient boosting from features per part", benefit: "measuring effort −30 … −70 %, scrap found earlier",
    pit: "needs part traceability (serial ↔ signals ↔ measurement)", ex: "virtual metrology is common in semiconductor fabs, growing in machining" },
  { k: "vision", area: "Quality", tab: "asm", role: "inspect", kind: "vision", name: "Visual inspection (castings, seals, assembly)", mat: 4, eff: 2, val: 5,
    what: "Camera + AI checks porosity, scratches, missing O-rings, wrong parts, label text.", data: "images with labels (OK / defect type), stable lighting",
    method: "CNN classification / segmentation on an edge PC (see lab 'vision')", benefit: "100 % inspection, pseudo-defects −50 … −90 % vs rule-based vision",
    pit: "lighting and part position are 50 % of success; rare defects need many images", ex: "car makers use AI image checks in body and assembly quality (e.g. BMW reported such systems)" },
  { k: "leak", area: "Quality", tab: "asm", role: "predict", kind: "sup", name: "End-of-line test analysis (compressor test bench)", mat: 3, eff: 1, val: 4,
    what: "Classify test-bench curves (pressure build-up, current, noise, FAD) to find the root cause of a failed compressor.", data: "test-bench curves + repair results",
    method: "time-series classification", benefit: "faster diagnosis, fewer repeated tests", pit: "needs the repair result recorded for each failure", ex: "end-of-line acoustic testing in motor and gearbox plants" },
  { k: "robotpick", area: "Robot cells", tab: "robot", role: "automate", kind: "vision", name: "Bin picking + vision-guided robots", mat: 4, eff: 2, val: 3,
    what: "3D camera + AI finds parts in a box and the robot picks them.", data: "3D images, CAD of parts", method: "3D vision + pose estimation + grasp planning",
    benefit: "no part feeders / trays needed", pit: "shiny cast parts and tangled parts are hard; cycle time", ex: "robot makers' 3D vision options" },
  { k: "robotcol", area: "Robot cells", tab: "robot", role: "automate", kind: "sup", name: "Robot collision + wear monitoring", mat: 4, eff: 1, val: 3,
    what: "Model-based collision detection and gear wear trend of robot axes.", data: "motor currents, positions", method: "dynamic model + learned residuals (see Robot tab item 2)",
    benefit: "fewer crashes, planned gearbox change", pit: "wrong payload data → false alarms", ex: "robot controller options" },
  { k: "agv", area: "AGV + AS/RS", tab: "agv", role: "optimise", kind: "opt", name: "Fleet + warehouse optimisation", mat: 4, eff: 2, val: 3,
    what: "Assign AGV jobs, choose storage slots and sequence retrievals to reduce travel and waiting.", data: "orders, positions, travel times, slot usage (WMS)",
    method: "optimisation heuristics, simulation, reinforcement learning (research)", benefit: "travel −10 … −30 %, throughput +5 … +20 %",
    pit: "the WMS / fleet manager must allow it; test in the twin first", ex: "fleet managers and WMS slotting modules" },
  { k: "sched", area: "MES / ERP", tab: "fms", role: "plan", kind: "opt", name: "Scheduling + dispatching (FMS)", mat: 3, eff: 2, val: 5,
    what: "Choose the order of jobs on 3 HMCs to meet due dates with fewer set-ups.", data: "orders, routings, set-up matrix, machine states (MES)",
    method: "optimisation (constraint programming, genetic algorithms), reinforcement learning (research), tested in the digital twin", benefit: "on-time delivery +5 … +15 %, set-ups −10 … −30 %",
    pit: "the twin showed: big batches empty kanbans → rules must be tested", ex: "advanced planning & scheduling (APS) systems" },
  { k: "fc", area: "MES / ERP", tab: "erp", role: "plan", kind: "fc", name: "Demand + spare-part forecasting", mat: 4, eff: 1, val: 4,
    what: "Forecast compressor orders and spare parts per week for MRP and safety stock.", data: "2–3 years of orders, promotions, season",
    method: "exponential smoothing, regression / gradient boosting (see lab 'fc')", benefit: "forecast error −10 … −30 % → less stock, fewer late orders",
    pit: "cannot see events not in the data (new customer, crisis)", ex: "forecasting modules in ERP / planning systems" },
  { k: "energy", area: "Energy + utilities", tab: "live", role: "optimise", kind: "opt", name: "Energy optimisation (HPU, chillers, compressed air)", mat: 3, eff: 2, val: 3,
    what: "Switch off idle consumers, plan load peaks, optimise compressed-air and cooling set points.", data: "energy meters per machine (twin already measures kW)",
    method: "forecast + optimisation; anomaly detection for leaks", benefit: "energy −5 … −20 %", pit: "needs metering per consumer",
    ex: "AI cooling control in data centres reported ≈ 40 % less cooling energy (DeepMind, 2016)" },
  { k: "hyd", area: "Hydraulics", tab: "hyd", role: "predict", kind: "unsup", name: "Hydraulic condition monitoring", mat: 3, eff: 1, val: 3,
    what: "Detect pump wear, leaks, valve problems and oil ageing from pressure, temperature, flow and particle counters.", data: "pressure curves per cycle, oil temperature, ISO 4406 counts",
    method: "anomaly detection on cycle curves", benefit: "fewer HPU failures, oil changed by condition", pit: "sensor at the right place (pump outlet, case drain)", ex: "online particle counters + condition monitoring units" },
  { k: "am", area: "Additive manufacturing", tab: "am", role: "inspect", kind: "vision", name: "AM in-process monitoring (melt pool, powder bed)", mat: 3, eff: 3, val: 2,
    what: "Detect streaks, curl and pores during printing from cameras and photodiodes.", data: "layer images, melt-pool signals + CT results", method: "image classification + anomaly detection",
    benefit: "stop bad builds early, less CT", pit: "linking signals to CT defects is hard", ex: "monitoring options of LPBF machine makers (see AM tab item 2)" },
  { k: "gen", area: "Engineering + documents", tab: "std", role: "assist", kind: "gen", name: "Engineering assistant (standards, guides, manuals)", mat: 3, eff: 2, val: 4,
    what: "Ask questions in plain language; the assistant finds the right standard / guide section and answers with sources.", data: "your guides, standards summaries, manuals, work instructions",
    method: "retrieval (search) + LLM = RAG (see lab 'rag'), local server for the offline factory", benefit: "search time −50 % (typical claims), faster onboarding",
    pit: "LLMs can invent answers → always show sources and check; licence of standards texts", ex: "industrial copilots offered by automation vendors" },
  { k: "maintai", area: "Maintenance", tab: "scada", role: "assist", kind: "gen", name: "Alarm + maintenance assistant", mat: 3, eff: 2, val: 4,
    what: "Explains an alarm, suggests likely causes and steps from past repairs and manuals.", data: "alarm history, repair reports (CMMS), manuals",
    method: "RAG over manuals + statistics of past fixes", benefit: "mean time to repair −10 … −30 % (claims)", pit: "repair reports must be written well", ex: "CMMS / SCADA vendors' assistants" },
  { k: "code", area: "Engineering + documents", tab: "fms", role: "assist", kind: "gen", name: "PLC / CNC / robot code assistant", mat: 3, eff: 1, val: 3,
    what: "Drafts and explains PLC (ST, ladder), G-code and robot programs; finds errors.", data: "your code standards, examples", method: "LLM code models",
    benefit: "faster programming of standard parts", pit: "never run AI code on a machine without review and simulation (virtual commissioning)", ex: "copilots in PLC and CNC engineering tools" },
  { k: "safety", area: "Safety", tab: "robot", role: "automate", kind: "vision", name: "AI in safety functions", mat: 2, eff: 3, val: 2,
    what: "People detection by AI cameras for speed and separation monitoring.", data: "images of people / scenes", method: "vision + certified safety architecture",
    benefit: "more flexible cells", pit: "ML safety components = high-risk under the Machinery Regulation 2023/1230 → third-party assessment; keep classic safety (light curtains, scanners) as the safety function", ex: "first certified AI-based safety sensors appear on the market" },
];

export const ROAD = [
  ["1 · Problem first", "Pick 2–3 problems with money behind them (downtime, scrap, late orders). Write the goal as a number (e.g. 'spindle crashes 6 → 2 per year').", "1–2 weeks"],
  ["2 · Data check", "Is the data there? Sensors, historian, part serials linked to measurements, failure records. Often step 2 shows you must first collect data for months.", "2–4 weeks"],
  ["3 · Connect + store", "OPC UA / MQTT from machines → historian (the twin already has one) → MES links by serial number. Same time base for all data.", "1–3 months"],
  ["4 · Simple first", "Dashboards, limits, statistics (SPC). Many problems are solved here – without AI.", "1 month"],
  ["5 · Pilot model", "One machine, one use case, an offline model; compare with today's method on the same data (like the labs).", "2–3 months"],
  ["6 · Run in production", "Model on an edge PC near the machine, alarms into SCADA / MES, people trained, a person decides at first.", "1–2 months"],
  ["7 · Monitor + scale", "Watch accuracy (data changes – 'drift'), retrain, roll out to the next machines.", "continuous"],
];

export const ARCH = [
  ["Machines + sensors", "CNC, PLC, robots, test bench, extra sensors (vibration, temperature, cameras)", "OPC UA, MQTT, Modbus"],
  ["Edge PC (near the machine)", "collects fast signals (kHz vibration), computes features, runs models in real time, works without network", "industrial PC, GPU for vision"],
  ["Historian + MES (factory server)", "stores time series and part data with serial numbers (this twin: SQLite historian + MES tab)", "time-series DB, SQL"],
  ["AI server (on-premise, offline)", "trains models, hosts a local LLM for the assistant, model registry", "GPU PC in the server room"],
  ["Apps", "SCADA alarms, MES dashboards, maintenance orders, assistant chat", "web apps"],
];

export const ROLESP = [["AI / data engineer", "data pipelines, models (can be a trained process engineer + partner)"], ["Process + maintenance experts", "know which signals matter, label data, judge results – the most important role"], ["IT / OT engineer", "network, edge PCs, security (IEC 62443)"], ["Product owner", "keeps the money goal and decides"]];

export const RISKS = [
  ["Bad / missing data", "start with data collection; link serial numbers; record failures and repairs properly"],
  ["Model works in the lab, not in production", "test on new data; monitor drift; retrain"],
  ["People do not trust it", "show why (feature weights, examples), a person decides at first, measure the benefit"],
  ["Hallucinating assistant (LLM)", "retrieval with sources, answer only from documents, human check, no safety decisions"],
  ["Cybersecurity + data leaving the factory", "on-premise / offline models, IEC 62443 zones, contracts on data use"],
  ["Safety", "AI never replaces certified safety functions; ML safety components need third-party assessment (2023/1230)"],
  ["Vendor lock-in", "own your data, standard interfaces (OPC UA, MQTT), exportable models"],
];

export const LAW = [
  ["EU AI Act – Regulation (EU) 2024/1689", "In force since 1 Aug 2024, obligations step by step: bans on unacceptable practices from Feb 2025, rules for general-purpose AI models from Aug 2025, high-risk systems from Aug 2026 / Aug 2027 (EU proposals in 2025 may shift high-risk dates – check). Most factory AI (maintenance, quality, forecasting) is NOT high-risk; AI as a SAFETY component of a machine IS high-risk. Workers must be informed when AI is used for decisions about them (e.g. performance)."],
  ["Machinery Regulation (EU) 2023/1230 (from 20 Jan 2027)", "Safety components with self-evolving (machine-learning) behaviour and machines with such systems are in Annex I part A → third-party conformity assessment. Classic safety functions (ISO 13849) remain the way to go."],
  ["Data + cybersecurity", "GDPR when people data is involved (cameras, operator logins); EU Data Act (machine data access, applies from Sept 2025); Cyber Resilience Act for connected products; IEC 62443 for OT security."],
];

export const QUIZ = [
  ["Can you write the problem as a number that costs money?", "Without a clear goal AI projects drift. Define the KPI first."],
  ["Does a simple rule or a limit already solve it?", "If yes – use the rule (cheaper, explainable). AI is for patterns that rules cannot catch."],
  ["Do you have data (and labels) – or can you collect them for 3–6 months?", "No data = no AI. Start collecting now."],
  ["Is the process stable (same material, tools, method)?", "AI on an unstable process learns noise. Stabilise first (SPC, standard work)."],
  ["Can a wrong answer be caught before it does harm?", "Use AI to advise; keep a person or a limit in the loop. Never for safety functions."],
  ["Will people use the result in their daily work (SCADA, MES, maintenance)?", "A model nobody looks at gives no benefit. Plan the integration."],
];
