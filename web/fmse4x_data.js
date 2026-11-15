/* copy of tools/fmse/examples/item4_examples.json – keep in sync
 * (shared worked-example inputs of FMS engineering item 4: guide docs/FMS system design/64_capacity_layout_simulation.md, tools/fmse/*.py, web/fmse4x.js).
 * Analytic results must match EXACTLY between guide, tools and web; simulation results are compared statistically
 * (10 replications, seeds 1–10, mean ± 95 % confidence interval, t_9 = 2.262).  All values are EXAMPLES. */
export const EX4 = {
  _formulas: {
    oee: "run = plan - down - setup ; A = run/plan ; P = ideal*total/run ; Q = good/total ; OEE = A*P*Q ; TEEP = OEE*plan/cal ; speed loss = run - ideal*total - minor (>= 0) ; quality loss time = ideal*(total - good)",
    mtbf_mttr: "failures = events with type 'failure' ; MTTR = mean duration of failures ; MTBF = (production_time_h*60 - sum failure durations)/failures [min] ; A_inherent = MTBF/(MTBF + MTTR) ; Pareto of all stop minutes by reason, descending",
    mm1: "rho = lambda/mu ; Lq = rho^2/(1-rho) ; Wq = Lq/lambda ; W = Wq + 1/mu ; L = lambda*W",
    mmm_erlang_c: "a = lambda/mu ; rho = a/m ; P0 = 1/( sum_{k=0}^{m-1} a^k/k! + a^m/(m!*(1-rho)) ) ; C = a^m/(m!*(1-rho)) * P0 ; Lq = C*rho/(1-rho) ; Wq = Lq/lambda ; W = Wq + 1/mu ; L = lambda*W",
    kingman_sakasegawa: "Wq = ((ca^2 + ce^2)/2) * (u^(sqrt(2(m+1)) - 1)/(m(1-u))) * te ; CT = Wq + te ; WIP = ra*CT with ra = u*m/te",
    breakdown_variability: "A = MTTF/(MTTF+MTTR) ; te = t0/A ; ce^2 = c0^2 + (1 + cr^2)*A*(1-A)*MTTR/t0",
    setup_variability: "setup of mean ts and variance sigma_s^2 every Ns parts: te = t0 + ts/Ns ; sigma_e^2 = sigma0^2 + sigma_s^2/Ns + (Ns-1)/Ns^2 * ts^2 ; ce^2 = sigma_e^2/te^2  (Hopp & Spearman, Factory Physics)",
    closed_laws: "rb = min over stations of servers/D_k (per visit-weighted demand) ; T0 = sum of D_k ; W0 = rb*T0 ; TH_best(N) = min(N/T0, rb) ; TH_pwc(N) = N/(W0 + N - 1)*rb ; TH_worst(N) = 1/T0",
    mva_seidmann: "exact Mean Value Analysis for a closed network; a station with m servers and demand D is replaced (Seidmann) by a single-server queue with demand D/m plus a pure delay D*(m-1)/m. Start Q_k(0) = 0. For n = 1..N: R_k(n) = D_k*(1 + Q_k(n-1)) for queueing stations, R_d = D_d for delays ; X(n) = n/(sum R_k + sum R_d) ; Q_k(n) = X(n)*R_k(n). Units: minutes; report X in pallets per hour (*60)",
    replications: "R replications with seeds 1..R ; mean ; sample std s ; half width = t_{R-1,0.975}*s/sqrt(R) with t_9 = 2.262 ; CI = mean ± half width",
    welch: "warm-up: moving average of the replication-averaged output series with window w; warm-up ends where the curve becomes flat (visual; tools print the moving average)",
    layout_cost: "C = sum_i sum_j f_ij * d_ij ; d_ij = (|dx| + |dy|) * pitch (slot grid, rectilinear)",
    pairwise_exchange: "steepest descent: in each iteration evaluate every pair of slots (i<j, slot order), take the swap with the largest strict cost reduction (first found on ties), repeat until no swap reduces C",
    slp_score: "closeness rating values A 16, E 8, I 4, O 2, U 0, X -64 ; adjacency = rectilinear slot distance 1 ; score = sum over adjacent department pairs of the rating value",
    aisle: "one-way aisle = w_vehicle_or_load + 2*c ; two-way aisle = 2*w + 3*c ; AGV with personnel: + 0.5 m protective clearance each side where people walk (ISO 3691-4 idea)",
    space: "department area = machines*(footprint + operator & service area)*(1 + allowance) ; total = sum + aisles share",
  },
  oee: { cal: 10080, plan: 4500, down: 270, setup: 360, minor: 150, ideal: 2.0, total: 1650, good: 1610 },
  stop_log: {
    production_time_h: 160,
    events: [
      ["failure", 45, "Spindle overload / tool breakage"], ["minor", 4, "Chip jam"], ["failure", 120, "Pallet clamp hydraulic leak"], ["setup", 35, "Fixture change VC10 -> VC30"],
      ["minor", 3, "Chip jam"], ["failure", 25, "Coolant level low"], ["minor", 5, "Probe error"], ["failure", 60, "Tool magazine chain fault"],
      ["setup", 30, "Fixture change VC30 -> VC20"], ["failure", 18, "Door interlock switch"], ["minor", 4, "Chip jam"], ["failure", 90, "Axis drive fault (X)"],
      ["minor", 2, "Probe error"], ["failure", 15, "Coolant level low"], ["setup", 40, "Program prove-out new part"],
    ],
  },
  mm1: { lambda_per_h: 5.0, te_min: 10.0 },
  mmm: { lambda_per_h: 10.0, te_min: 15.0, m: 3 },
  queue: { u: 0.85, t0: 10, c0: 0.5, ca: 1.0, mttf: 600, mttr: 60, m: 1, cr: 1.0 },
  setup_var: { t0: 10, sigma0: 5, ts: 60, sigma_s: 20, Ns_values: [5, 10, 20, 40] },
  buffer_line: { t1: 1, t2: 1, cv: 0.3, mttf: 100, mttr: 10, T_min: 30000, B_values: [0, 1, 2, 3, 5, 8, 10, 15, 20], seeds: [11, 23] },
  layout: {
    depts: ["Receiving", "Saw / prep", "Turning", "Milling", "Heat treat", "Grinding", "Assembly", "Shipping"],
    flow: [[0, 30, 0, 20, 0, 0, 0, 0], [0, 0, 25, 5, 0, 0, 0, 0], [0, 0, 0, 0, 15, 10, 5, 0], [0, 0, 0, 0, 5, 5, 15, 0], [0, 0, 0, 0, 0, 20, 0, 0], [0, 0, 0, 0, 0, 0, 30, 0], [0, 0, 0, 0, 0, 0, 0, 50], [0, 0, 0, 0, 0, 0, 0, 0]],
    slots: [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1]], start: [6, 0, 5, 1, 7, 4, 2, 3], pitch_m: 20,
    _expected_from_item4_web: "start cost 8 900 load·m/day; pairwise exchange 3 swaps -> 5 600 (-37 %)",
    rel: [["Receiving", "Saw / prep", "A"], ["Receiving", "Shipping", "E"], ["Saw / prep", "Turning", "A"], ["Saw / prep", "Milling", "I"], ["Turning", "Heat treat", "E"], ["Turning", "Grinding", "I"], ["Milling", "Assembly", "E"], ["Heat treat", "Grinding", "A"], ["Grinding", "Assembly", "A"], ["Assembly", "Shipping", "A"], ["Heat treat", "Assembly", "X"], ["Grinding", "Saw / prep", "X"], ["Heat treat", "Shipping", "O"]],
    _rel: "pairs not listed = U",
  },
  space: { _cols: "dept, machines, footprint m2, operator & service m2 per machine, allowance", depts: [["Turning", 4, 12, 10, 0.3], ["Milling", 3, 18, 12, 0.3], ["Grinding", 3, 14, 10, 0.3], ["Heat treat", 1, 40, 20, 0.2], ["Assembly", 6, 8, 8, 0.4]], aisle_share: 0.25 },
  aisle: { forklift_w: 1.2, load_w: 1.2, c: 0.5, agv_w: 1.0, agv_people_clearance: 0.5 },
  fms_sim: {
    m: 3, N: 10, L: 1, V: 1, load: 12, loadCv: 0.3, move: 1.5, mttf: 1200, mttr: 60, rule: "FIFO", days: 14,
    parts: [["Crankcase A (4 per tombstone)", 40, 56, 0.15], ["Crankcase B (4 per tombstone)", 35, 72, 0.15], ["Cylinder C (6 per pallet)", 25, 40, 0.15]],
    replications: 10, seeds_from: 1, t_975_9: 2.262,
    _expected_from_item4_web: "seed 7, 14 days, N 10: TH 2.91 pallets/h; long runs 2.97-2.98; bottleneck rate 2.98; T0 75.5 min; W0 3.7",
  },
  mva: {
    _note: "closed network of the same FMS for MVA (exact for exponential times): stations with demand per pallet loop in minutes",
    stations: [["Load station", 1, 12.0], ["Vehicle (2 moves)", 1, 3.0], ["Machines (3 HMC, incl. breakdowns: 57.6 / A, A = 1200/1260)", 3, 60.48]],
    N_max: 15,
  },
};

/* ------------------------------------------------------------------ web-only extras (not in the JSON; marked as such in the page) */
// Student t quantiles t_{df, 0.975} for the confidence intervals (df = R − 1); df ≥ 30 → 1.96 approximation is NOT used, the table goes to 120.
export const T975 = { 1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228, 11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131, 16: 2.120, 17: 2.110, 18: 2.101, 19: 2.093, 20: 2.086, 21: 2.080, 22: 2.074, 23: 2.069, 24: 2.064, 25: 2.060, 26: 2.056, 27: 2.052, 28: 2.048, 29: 2.045, 30: 2.042, 40: 2.021, 50: 2.009, 60: 2.000, 80: 1.990, 100: 1.984, 120: 1.980 };

// 4H defaults chosen for the web page (the JSON has no values for these two programs)
export const SETUP_RA = 3.0;          // parts per hour for the CT-versus-lot-size chart
export const LINE0 = { ra: 5.0, ca2: 1.0, st: [["Turning", 10, 0.5], ["Milling (breakdowns, c_e² from 4H-c)", 11, 1.2417], ["Grinding", 9, 0.25]] };

// 4F countermeasures: reason keyword → [loss (six big losses), method, concrete action]; fallback by type
export const COUNTER = [
  [/spindle|tool break/i, "Breakdown", "TPM – autonomous + planned maintenance", "Tool-life monitoring and spindle load limit in the NC; broken-tool detection (laser / probe) before the next tool; check cutting data."],
  [/clamp|hydraul|leak/i, "Breakdown", "TPM – planned maintenance", "Hydraulic hose / seal change interval; pressure switch monitoring per clamp; daily visual check in the CIL (clean–inspect–lubricate) sheet."],
  [/coolant/i, "Breakdown", "TPM – autonomous maintenance", "Automatic level control and refill; level sensor with early warning (not only 'empty'); coolant concentration check per shift."],
  [/magazine|chain/i, "Breakdown", "TPM – planned maintenance", "Chain tension and lubrication interval; count magazine moves and plan the change before wear-out."],
  [/door|interlock/i, "Breakdown", "TPM – focused improvement", "Interlock switch with better protection (IP rating, guard against chips); spare switch at the machine; root cause: misalignment?"],
  [/axis|drive|servo/i, "Breakdown", "TPM – planned + predictive maintenance", "Drive diagnostics (temperature, current trend) from the CNC; spare drive module on stock (MTTR!); check cabinet cooling."],
  [/chip/i, "Minor stop", "Focused improvement (small-stop analysis)", "Chip conveyor type / chip breaker geometry; coolant flushing of the fixture; count each chip jam with time and pallet."],
  [/probe/i, "Minor stop", "Focused improvement", "Clean probe stylus and part surface (air blast), check battery / radio signal, widen tolerance window only after analysis."],
  [/fixture|change/i, "Set-up", "SMED", "Separate internal / external work; pre-set fixtures on a zero-point system outside the machine; standard fixture interface so the FMS pallet keeps its fixture."],
  [/prove|program/i, "Set-up / start-up", "SMED + offline programming", "CAM simulation with the real machine model, first-part check on a dedicated pallet, prove-out in a planned time window (not in production time)."],
];
export const COUNTER_TYPE = {
  failure: ["Breakdown", "TPM – planned maintenance", "Root-cause analysis (5 × why), maintenance plan, spare parts for the long repairs."],
  minor: ["Minor stop", "Focused improvement", "Record every stop with reason; solve the top reason first; poka-yoke."],
  setup: ["Set-up", "SMED", "Internal → external work; quick clamping; standard pallets / zero-point system."],
};

// 4F PackML (ISA-TR88.00.02) state → typical loss category (a convention – each plant fixes its own mapping in the MES / OEE system)
export const PACKML = [
  ["Execute", "Run time", "Value-adding when the machine runs at ideal rate; running slower → speed loss (P)", "Production"],
  ["Held", "Minor stop / internal stop", "Machine stops itself for an internal reason (e.g. chip jam, probe error, operator call). Long holds = breakdown", "Production"],
  ["Suspended", "Starved / blocked (system loss)", "Machine is ready but has no pallet or cannot unload (upstream / downstream). Not a machine loss – but a system OEE loss", "Production"],
  ["Stopped", "Planned or unplanned stop", "Stopped by operator or by order end; reason code decides: planned (break, no order) or unplanned", "Production / Maintenance"],
  ["Aborted", "Breakdown", "Fault / emergency stop; time until Clearing + Reset completes = repair time (MTTR)", "Production"],
  ["Clearing, Resetting", "Breakdown (repair) or start-up", "Part of the repair after an abort, or start-up after a set-up", "Production / Maintenance"],
  ["Idle", "Idle / no order", "Ready, waiting for the start command or the next order; planned-down if no order is scheduled", "Production"],
  ["Starting, Completing, Complete", "Start-up / run-down", "Warm-up, first part, empty-out; in the six big losses: set-up & adjustment or start-up loss", "Production"],
  ["Any state in unit mode Maintenance", "Planned maintenance or repair", "Planned (PM plan) → planned downtime, not in OEE; unplanned (repair) → breakdown", "Maintenance"],
  ["Any state in unit mode Manual / Set-up", "Set-up & adjustment", "Fixture change, tool change, program prove-out", "Manual"],
];

// 4G / 4H / 4I / 4J / 4K use cases (domain, text)
export const USES4 = {
  F: [["Machining FMS", "Stop log of 4 HMCs for one month: the top 3 reasons (clamp leak, axis drive, tool magazine) are 59 % of all stop minutes – maintenance plan and spare parts are fixed for these three first."],
    ["Injection moulding", "Mould changes are the biggest stop block: SMED (pre-heating the next mould, quick couplings) halves the set-up time; MTBF of the hot-runner controller tracked per mould."],
    ["Assembly line", "Many micro-stops at a screwing station (< 1 min each) are invisible in the MES; a PLC stop counter with reason codes shows they are 8 % of the shift."],
    ["Compressor test bench", "Test bench availability A = MTBF / (MTBF + MTTR) decides whether a second bench is needed; long repairs of the data acquisition system dominate MTTR."],
    ["Packaging (PackML)", "OEE is computed directly from the PackML state times of each machine – Held = minor stop, Suspended = starved/blocked, Aborted = breakdown."]],
  G: [["Tool presetting room", "Tools arrive Poisson-like from the FMS tool list (λ = 10 /h), presetting takes 15 min: Erlang C shows 3 presetters give 21 min average waiting, 4 give 3 min."],
    ["Maintenance team", "Machine breakdowns are calls, technicians are servers: how many technicians keep the waiting time for a repair below 10 min?"],
    ["AGV charging station", "AGVs arrive to charge at random; one charger or two? M/M/m gives the queue of vehicles that are lost for transport."],
    ["Quality lab / CMM", "Parts for measurement arrive from 6 machines; the CMM queue decides how long the machines wait for release – Erlang C sizes CMMs."],
    ["Help desk / control room", "Classic call-centre use: number of agents for a target waiting time – the same formula as for machines."]],
  H: [["Batch machining", "Fixture change every Ns pallets: larger lots reduce the set-up share but make the flow lumpy – the CT curve shows the best lot size."],
    ["Paint shop", "Colour changes = set-ups. Colour sequencing (lot size per colour) is chosen with the same trade-off."],
    ["Line of machines", "A breakdown-prone milling machine sends its variability downstream: the grinding station after it waits more although it is reliable itself."],
    ["Press shop", "Die change every 2 000 parts: σ of the die-change time matters as much as its mean."],
    ["Logistics", "Truck arrivals in waves (c_a large) cause long queues at the dock although average capacity is enough – smoothing the arrivals helps more than a new dock door."]],
  I: [["FMS pallet count", "How many pallets / fixtures to buy: MVA gives throughput for N = 1 … 15 in milliseconds; the knee of the curve is the economic pallet number."],
    ["AGV system", "Closed loop of carriers (vehicles) between stations: number of vehicles for the target rate."],
    ["Kanban / CONWIP", "A CONWIP line is a closed network: MVA gives throughput versus WIP cap and the critical WIP W₀."],
    ["Returnable containers", "Number of returnable containers / racks in a supplier loop (closed system)."],
    ["IT / servers", "MVA was developed for computer systems (users = jobs in a closed loop) – the same algorithm sizes application servers."]],
  J: [["FMS investment decision", "Is +1 load station worth it? 10 replications with common random numbers show whether the gain is real or only noise."],
    ["Hospital / emergency room", "Doctors per shift compared with confidence intervals – one simulation run is never enough."],
    ["Warehouse", "Picking strategy A versus B: paired comparison with the same order lists (common random numbers)."],
    ["Line buffers", "Buffer size 5 versus 8: the difference is small, the CI shows if it is significant."],
    ["Digital twin in operation", "Weekly what-if run of tomorrow's order list: replications give a throughput range for the shift plan."]],
  K: [["New machining hall", "Departments with strong material flow (A) are placed next to each other, heat treatment and grinding separated (X – dust / temperature)."],
    ["Hospital", "Emergency room next to radiology (A), kitchen away from operating theatres (X) – SLP is used far outside factories."],
    ["Office / engineering building", "Teams with daily contact adjacent; noisy test bench far from the offices."],
    ["Assembly plant", "Space calculation per department (machines × (footprint + service) × allowance + aisles) before the building is designed."],
    ["Warehouse", "Aisle width for forklifts versus AGVs decides the rack layout and the building width."]],
  M: [["New FMS", "Simulation study before ordering: number of pallets, load stations and tool capacity – VDI 3633 steps keep the study honest."],
    ["Brown-field line change", "Model of the existing line validated with 4 weeks of MES data, then the change is tested in the model."],
    ["Logistics centre", "Simulation of peak days with real order data; V&V with last year's peak."],
    ["Digital twin", "The validated model is kept alive and fed with live data for daily planning – step 11 of the checklist."]],
};

// 4L layout patterns (sketch is drawn in fmse4x.js) – example dimensions only, check with supplier drawings
export const PATTERNS = [
  ["linear", "Linear pallet pool (spine)", "4 HMCs on one side of a rail-guided vehicle (RGV) or stacker, 2-level pallet rack on the other side, load stations at the end.", "4 HMCs at 7 m pitch, rail 34 m, hall bay 16 m; rack 2 levels × 16 places.", "2–8 machines, machining, expansion by extending the rail.", "Rail / stacker is a single point of failure; keep space at the end for machine 5."],
  ["loop", "Loop (AGV or conveyor)", "Vehicles or carriers circulate in one direction past all stations; stations can be added along the loop.", "loop 60 × 24 m, 6 stations, 4 AGVs, aisle 3.0 m (AGV + people).", "Assembly, mixed machining / washing / measuring, long systems.", "Loop length and number of carriers; traffic rules at crossings; charging stations."],
  ["ucell", "U-cell", "Machines in a U, entry and exit side by side; one operator walks inside the U.", "5 stations, U 8 × 6 m, inner walkway 1.5 m, walking path per cycle ≈ 15 m.", "Manual / semi-automatic cells, small parts, takt 1–10 min.", "Material supply from outside (flow racks), not through the operator area."],
  ["weld", "Robot welding cells", "Robot with 2-station turntable or two positioners: operator loads one side while the robot welds the other.", "cell 6 × 5 m incl. fence, turntable Ø 2.5 m, light curtain at the load side, fume extraction above.", "Steel frames, brackets, compressor housings.", "Fence + safety distance (ISO 13855), fume extraction, cable / gas supply, crane access for heavy parts."],
  ["line", "Assembly line", "Stations in a row at takt, conveyor or AGV carriers; buffers before critical stations.", "12 stations at 2.0 m pitch = 24 m, + 2 buffers of 3 places, line width 4 m incl. supply racks on both sides.", "Compressor final assembly, high volume, few variants.", "Material supply (kitting / line-side racks), takt balancing, test benches at the end."],
];
// 4L detailed layout rules (checklist)
export const RULES = [
  ["Service areas", "Keep the machine's service area free: control cabinet door swing, spindle / magazine access, chip conveyor removal, coolant tank pulling space (supplier foundation plan)."],
  ["Chips and coolant", "Chip conveyors on the side towards a central chip collection or a chip cart route; coolant tanks reachable for cleaning; central coolant system → pipe routes in the floor."],
  ["Foundations", "Heavy / precise machines need their own foundation block (supplier plan); vibration sources (presses) away from grinding and measuring; check floor load (kN/m²) for racks and AS/RS."],
  ["Crane and lifting", "Crane coverage for machine installation, fixture and spindle change; crane hook height and travel path; no racks under the crane path that block lifts."],
  ["Utilities", "Power (kVA per machine), compressed air, coolant, extraction, network / Wi-Fi, water: from a grid of floor ducts or overhead; plan spare capacity (~ 30 %)."],
  ["Clean / dirty zones", "Measuring room and assembly (clean) separated from machining, washing, heat treatment (dirty / hot); airflow from clean to dirty."],
  ["Noise", "Noisy equipment (presses, test benches, compressors) in an enclosed area; offices and quality lab away; daily exposure limits for workers (e.g. 85 dB(A) action value – check local law)."],
  ["Safety distances", "Fences and light curtains at the safety distance S = K·T + C (ISO 13855); AGV paths with protective clearance where people walk (ISO 3691-4); forklift and pedestrian routes separated."],
  ["Expansion", "Leave space for one more machine at the end of the line / rail; utility connections for it pre-installed; avoid walls or columns that block expansion."],
  ["Escape routes and fire", "Escape routes and emergency exits to local building law (max. distance to an exit, minimum width); fire walls; sprinklers above racks; keep routes free of WIP."],
  ["Light and climate", "Lighting level for the task (machining vs. measuring); temperature-controlled measuring room (20 °C ± 1 K); heat load of machines in the hall ventilation."],
  ["Material flow and logistics", "Receiving / shipping at the dock; one direction of flow (no back-flows); WIP and empty pallet buffers planned, not left in aisles."],
];

// 4M VDI 3633 – steps of a simulation study (VDI 3633 sheet 1 procedure; the wording here is a simplified summary)
export const VDI = [
  ["1 Problem and goal", ["Write the question the study must answer (e.g. 'how many pallets for 2.8 pallets/h?')", "Fix KPIs (throughput, lead time, utilisation, WIP) and the decision that depends on them", "Agree budget, time and who decides"]],
  ["2 Task specification", ["Scope: which resources are in the model, which are outside (system boundary)", "Alternatives to compare (scenarios)", "Level of detail – as simple as possible, as detailed as needed"]],
  ["3 System analysis / conceptual model", ["Flow chart of the process (routings, rules, shifts)", "List of assumptions and simplifications (signed by the customer)", "Analytic first check (bottleneck, MVA) to know the expected range"]],
  ["4 Data collection and preparation (in parallel)", ["Process times, set-ups, breakdowns (MTBF / MTTR), shifts, order mix", "Fit distributions or use empirical data; document the source of every number", "Check data plausibility (units, outliers, missing values)"]],
  ["5 Formal model", ["Describe objects, states, events and rules independent of the tool", "Define the input / output interfaces of the model"]],
  ["6 Implementation (executable model)", ["Build the model in the tool; name objects as in the plant", "Code reviews of rules; version control of the model file"]],
  ["7 Verification and validation (in parallel)", ["Verification: does the model do what the formal model says? (trace, animation, deterministic tests)", "Validation: does the model behave like the real system? (compare with history / expert review)", "Document every V&V test and its result"]],
  ["8 Experiments", ["Warm-up (Welch), run length and number of replications fixed", "Experiment plan: scenarios, factors, levels; common random numbers for comparisons"]],
  ["9 Output analysis", ["Mean ± 95 % confidence interval for every KPI", "Paired comparison of alternatives; sensitivity of the key inputs"]],
  ["10 Documentation and recommendation", ["Report: question, assumptions, data, V&V, results with CIs, recommendation", "Hand the model + data + report to the customer"]],
  ["11 Use in operation (digital twin)", ["Keep the model updated with real changes", "Feed live / MES data; re-validate periodically"]],
];

// 4M data collection templates (columns + one example row)
export const TEMPLATES = [
  ["Stop log", ["date", "machine", "start", "end", "minutes", "type (failure/minor/setup/planned)", "reason", "action"], ["2026-03-02", "HMC1", "08:12", "08:57", "45", "failure", "Spindle overload / tool breakage", "tool changed, cutting data checked"]],
  ["Process times", ["part", "operation", "machine", "time study / NC time min", "cv or min/max", "source"], ["Crankcase A", "OP10", "HMC", "56", "0.15", "NC program run time + 10 measurements"]],
  ["Routings and mix", ["part", "share of volume %", "operation sequence", "pallet / fixture type", "parts per pallet"], ["Crankcase A", "40", "load-OP10-OP20-unload", "Tombstone T1", "4"]],
  ["Shift calendar", ["day", "shift", "start", "end", "breaks min", "manned (y/n)"], ["Mon", "1", "06:00", "14:00", "30", "y"]],
  ["Transport times", ["from", "to", "vehicle", "time min", "distance m"], ["Load station 1", "HMC1", "RGV", "1.5", "18"]],
  ["Orders / arrivals", ["order", "part", "quantity", "release date", "due date"], ["4711", "Crankcase B", "120", "2026-03-02", "2026-03-06"]],
];

// 4M verification / validation checks (text)
export const VV = [
  ["Verification", "Deterministic test", "All times constant, no breakdowns → throughput and loop time must equal the hand calculation (bottleneck, T₀)."],
  ["Verification", "Little's law", "In the simulation output N = TH × loop time must hold (closed system) – a mismatch means wrong statistics or a lost pallet."],
  ["Verification", "Conservation / bounds", "Throughput ≤ bottleneck rate r_b; utilisation ≤ 100 %; all pallets accounted for at the end."],
  ["Verification", "Trace and animation", "Follow one pallet step by step in the event trace / animation and compare with the routing sheet."],
  ["Verification", "Extreme values", "1 pallet, 1 000 pallets, MTTR = 0, one machine only – the model must behave as expected (no crash, plausible output)."],
  ["Validation", "Historic comparison", "Run the model with the input of a past period (orders, breakdowns) and compare output with the MES (e.g. ± 5 % on throughput)."],
  ["Validation", "Expert review (face validity)", "Show the animation and KPIs to the shop-floor people: does it look and behave like the real plant?"],
  ["Validation", "Analytic cross-check", "Compare with MVA / queueing results (4G, 4I): the simulation should be in the expected range and the differences explainable."],
  ["Validation", "Sensitivity", "Change the uncertain inputs ± 10 %: if the decision changes, collect better data for those inputs."],
];

// 4M software buy list. Facts only where generally known; everything else "see maker's website". Prices: never given – ask for a quote.
// [product, maker, type, licence model, offline use, typical use]
export const SOFTWARE = [
  ["Tecnomatix Plant Simulation", "Siemens", "Discrete-event simulation (DES), 3D", "Commercial – see maker's website", "Desktop installation – licence check: see maker's website", "Production lines, FMS, logistics; object-oriented models, statistics, optimisation"],
  ["FlexSim", "see maker's website", "DES, 3D", "Commercial; a free limited version exists – see maker's website", "Desktop installation – licence check: see maker's website", "Manufacturing, warehousing, healthcare; strong 3D"],
  ["AnyLogic", "The AnyLogic Company", "Multi-method: DES, agent-based, system dynamics", "Commercial; free Personal Learning Edition – see maker's website", "Desktop installation – licence check: see maker's website", "Supply chain, logistics, factory, mixed models"],
  ["Simio", "Simio LLC", "DES, object-based, 3D", "Commercial – see maker's website", "Desktop installation – licence check: see maker's website", "Manufacturing, scheduling (simulation-based scheduling)"],
  ["Arena", "Rockwell Automation", "DES (flowchart modules)", "Commercial; student edition exists – see maker's website", "Desktop installation – licence check: see maker's website", "Classic teaching and process simulation, service and manufacturing"],
  ["Visual Components", "Visual Components", "3D layout + robot / line simulation, virtual commissioning", "Commercial – see maker's website", "Desktop installation – licence check: see maker's website", "Layout from component catalogue, robot cells, line concepts for sales and engineering"],
  ["ExtendSim", "see maker's website", "DES / continuous / discrete-rate", "Commercial – see maker's website", "unknown – see maker's website", "Process and flow simulation, discrete-rate (bulk) processes"],
  ["Emulate3D", "Rockwell Automation", "3D emulation / virtual commissioning with PLC connection", "Commercial – see maker's website", "Desktop installation – licence check: see maker's website", "Test PLC code against a 3D model before commissioning (conveyors, AS/RS)"],
  ["SimPy", "open-source project (Python)", "DES library (process-based)", "Open source (MIT licence)", "yes – runs fully offline with Python", "Own models in code, research, digital-twin back ends, batch experiments"],
  ["JaamSim", "open-source project (Java)", "DES with 3D drag-and-drop GUI", "Open source (Apache 2.0)", "yes – runs fully offline (Java)", "Free general DES with graphics; teaching and industry"],
  ["Salabim", "open-source project (Python)", "DES library with 2D/3D animation", "Open source (MIT licence)", "yes – runs fully offline with Python", "Python DES with animation, logistics and production"],
  ["AutoCAD", "Autodesk", "2D/3D CAD", "Subscription – see maker's website", "Desktop installation; sign-in / licence check: see maker's website", "Hall layout, machine footprints, building drawings"],
  ["Factory Design Utilities", "Autodesk", "Factory layout add-on (AutoCAD / Inventor), asset library", "Subscription (part of an Autodesk collection) – see maker's website", "unknown – see maker's website", "2D/3D factory layout with intelligent assets, line concepts"],
  ["visTABLE", "plavis GmbH", "Layout planning with material-flow analysis (from-to, Sankey)", "Commercial – see maker's website", "unknown – see maker's website", "Layout planning workshops, material-flow evaluation, variants"],
  ["FactoryCAD / FactoryFLOW", "Siemens (Tecnomatix)", "Factory layout on AutoCAD + material-flow analysis", "Commercial – see maker's website", "unknown – see maker's website", "Detailed factory layouts with smart objects, flow-distance analysis"],
];
