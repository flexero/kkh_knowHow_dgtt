/* INSTALLATION tab – item 5 "Installation sequence – transport, rigging, utilities, commissioning, run-off".
 * Files: instseq_calc.js (CPM, rigging, air, coolant, run-in, capability) · instseq_text.js (checklists + tables) · this file (UI) · instseq.css.
 * Guide: docs/28_installation_sequence_commissioning.md. Built lazily on the first "initemshow" event with detail "5" (inst.js).
 * URL (tests + deep links, all with /?initem=5 … #inst):
 *   &isscope=line (3-machine line) · &isstart=2027-01-04 · &isdur=FC:35,MFG:90 (durations) · &issel=FC (select a task)
 *   &ismass=12000 · &islegs=2|4 · &isangle=45 · &iscog=300 · &isspreader · &isd=25 (air pipe ID mm) · &isring · &isdata=A|B|C (run-off data)
 *   &isskip (spindle run-in skipped) · &ischk=all|none (tick state for screenshots, not saved) · &iscard=plan|raci|progress|site|rig|util|comm|accept|mistakes|maker
 *   &istest (self-check lines in the console) · &isback (switch items 1 → 5 → 2 → 5 and report) · &ishold (test: keep the load event pending for headless screenshots)
 * Offline, no libraries. All values are EXAMPLES – the real numbers come from the machine maker's installation manual.
 */
import * as C from "./instseq_calc.js";
import * as X from "./instseq_text.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const f = (v, d = 1) => (Number.isFinite(+v) ? (+v).toFixed(d) : "–");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const errs = [];
window.addEventListener("error", (e) => errs.push(e.message));
// test only (&ishold): a hidden iframe on the never-ending SSE stream keeps the load event pending, so headless screenshots wait for --timeout
if (Q.has("ishold")) { const fr = document.createElement("iframe"); fr.src = "/api/stream?ishold=" + Date.now(); fr.title = "test"; fr.style.display = "none"; document.body.appendChild(fr); setTimeout(() => { if (typeof window.showTab === "function") window.showTab("inst"); }, 300); }

/* ------------------------------------------------------------------ per-viewer state (checklists) – must work without storage */
const KEY = "dt.instseq.v1";
let CHK = {};
const persist = !Q.has("ischk");
try { if (persist) CHK = JSON.parse(localStorage.getItem(KEY) || "{}").chk || {}; } catch (e) { CHK = {}; }
if (Q.get("ischk") === "all") X.PHASES.forEach((p) => p.items.forEach((_, i) => { CHK[p.id + ":" + i] = 1; }));
const saveChk = () => { if (!persist) return; try { localStorage.setItem(KEY, JSON.stringify({ chk: CHK })); } catch (e) { /* storage blocked – state lives only in this page */ } };

/* ------------------------------------------------------------------ small HTML helpers */
const tbl = (h, rows, cls = "") => `<div class="table-wrap"><table class="is-tbl ${cls}"><tr>${h.map((x) => `<th>${x}</th>`).join("")}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</table></div>`;
const card = (id, title, sub, body) => `<div class="card is-card" id="${id}"><div class="card-head"><h2>${title}</h2>${sub ? `<span class="sub">${sub}</span>` : ""}</div>${body}</div>`;
const W5 = (o) => `<dl class="is-w5"><dt>What</dt><dd>${o.what}</dd><dt>Why</dt><dd>${o.why}</dd><dt>How</dt><dd>${o.how}</dd><dt>Check</dt><dd>${o.check}</dd><dt class="is-bad">Typical mistake</dt><dd>${o.mistake}</dd></dl>`;
const info = (t, html) => `<details class="is-info"><summary><span class="is-i">i</span>${t}</summary><div>${html}</div></details>`;
const ex = `<span class="is-ex">example</span>`;
const num = (id, v, step = 1, w = 80, min = 0) => `<input type="number" id="${id}" value="${v}" step="${step}" min="${min}" style="width:${w}px">`;
const lab = (t, inner) => `<label class="is-lab"><span>${t}</span>${inner}</label>`;
const seg = (name, opts, cur) => `<div class="seg" data-isseg="${name}">${opts.map(([v, t]) => `<button class="seg-btn${String(v) === String(cur) ? " active" : ""}" data-v="${v}">${t}</button>`).join("")}</div>`;

/* ------------------------------------------------------------------ the item */
function build(box) {
  const S = {
    scope: Q.get("isscope") === "line" ? "line" : "one",
    start: Q.get("isstart") || "2027-01-04",
    dur: {}, sel: Q.get("issel") || "FC",
    rig: { m: +(Q.get("ismass") || 12000), n: Q.get("islegs") === "2" ? 2 : 4, theta: +(Q.get("isangle") || 30), e: +(Q.get("iscog") || 300), Lp: 2400, spreader: Q.has("isspreader"), mb: 300 },
    fk: { Q: 16000, c0: 1200, x: 700, c: 1600 },
    air: { cons: C.AIR_CONSUMERS.map((c) => ({ ...c })), leak: 10, reserve: 20, L: 100, eq: 30, d: +(Q.get("isd") || 32), pg: 0.7, ring: Q.has("isring") },
    cool: { V: 800, c: 7, k: 1.1, brix: 3.8 }, mist: { Venc: 6, ach: 5 }, chip: { mChip: 1.5, rho: 1500 },
    data: ["A", "B", "C"].includes(Q.get("isdata")) ? Q.get("isdata") : "A", skip: Q.has("isskip"), quote: 360,
  };
  (Q.get("isdur") || "").split(",").filter(Boolean).forEach((p) => { const [k, v] = p.split(":"); if (k && v != null && Number.isFinite(+v)) S.dur[k.toUpperCase()] = +v; });

  box.innerHTML = `<div class="is-wrap">
  ${card("isCardPlan", "A · Project time plan – from purchase order to production", `critical path method (CPM) · durations in calendar days ${ex} · change any duration and see the end date move`, `
    ${W5({ what: "All steps from the purchase order to stable production, with durations, dependencies (a step can start only when its predecessors are finished) and who does it.",
      why: "A CNC machine is ready at the maker after 4–6 months – but the foundation needs 28 days of curing, the power cable, air and network must be ready on the delivery day. If one of these is late, the machine waits (storage, re-booked fitters, lost production).",
      how: "List the steps → give each a duration and its predecessors → <b>forward pass</b> (earliest start ES = latest EF of all predecessors, EF = ES + d) → <b>backward pass</b> from the end (LF = earliest LS of all successors, LS = LF − d) → <b>total float</b> TF = LS − ES. Steps with TF = 0 form the <b>critical path</b>: one day late there = one day late at the end.",
      check: "Every week: compare actual dates with the plan; watch the critical steps and the steps with small float (e.g. foundation: its float shows the LATEST day to pour the concrete).",
      mistake: "Planning the foundation after the delivery date is known – curing (28 days) and the drawings from the maker (3 weeks) make it critical very fast." })}
    <div class="is-ctl">
      ${lab("Scope", seg("scope", [["one", "HMC-01 only"], ["line", "3-machine crankcase line"]], S.scope))}
      ${lab("Purchase order date", `<input type="date" id="isStart" value="${esc(S.start)}">`)}
      <button class="btn" id="isDurReset">Reset durations</button>
      <span class="is-hint">Click a bar or a row to select a step · edit durations in the table below</span>
    </div>
    <div class="kpis is-kpis" id="isPlanKpi"></div>
    <div class="is-leg" id="isGanttLeg"></div>
    <div class="is-gantt" id="isGantt"></div>
    <div class="is-selbox" id="isSel"></div>
    <div class="rc-eq" id="isPath"></div>
    <details class="is-det" open><summary>CPM table – earliest / latest dates, float, edit durations</summary><div id="isCpmTbl"></div></details>
    ${info("How the CPM numbers are calculated (worked example)", `<p>Day 0 = morning of the purchase-order date. EF is the morning after the last working day of the step.</p>
      <p><b>Forward pass</b>: PO (0 d) ES = 0, EF = 0 → MFG (110 d) ES = 0, EF = 110 → FAT (5 d) 110 → 115 → SHIP (21 d) 115 → 136.
      Foundation branch: PIM 0 → 14, FDW 14 → 35, FD 35 → 49, FP 49 → 59, FC (28 d) 59 → 87. Delivery DEL needs SHIP, FC and RT: ES = max(136, 87, 21) = 136.</p>
      <p><b>Backward pass</b>: LS(DEL) = 136 → LF(FC) = 136, LS(FC) = 136 − 28 = 108 → TF(FC) = 108 − 59 = <b>49 days</b>. So the foundation can start 49 days later than planned – but not 50.</p>
      <p>Free float FF = earliest ES of the successors − own EF (float that does not move any other step).</p>`)}
  `)}
  ${card("isCardRaci", "B · Responsibilities – RACI table", "who does what · R = responsible (does the work) · A = accountable (decides, signs) · C = consulted · I = informed", `
    ${W5({ what: "For every step exactly one party is <b>A</b>ccountable; one or more are <b>R</b>esponsible (do the work); others are <b>C</b>onsulted before or <b>I</b>nformed after.",
      why: "Most installation delays come from gaps between parties: the civil contractor waits for the anchor positions, the electrician does not know the fuse size, nobody booked the crane.",
      how: "Write the RACI table into the purchase contract / pre-installation meeting minutes. Name a person (not only a company) for each A.",
      check: "Each row has exactly one A (or X = A + R). Each party has seen its rows and agreed.",
      mistake: "'The maker will do it' – the maker usually supervises unloading and placing but the BUYER books and pays the rigger, the crane, the foundation, the utilities." })}
    <div id="isRaci"></div>`)}
  ${card("isCardProgress", "C · Checklists – progress per phase", "tick the items in each card · saved in this browser only (if the browser allows it)", `
    <div id="isProg"></div><button class="btn" id="isChkReset">Clear all ticks</button>`)}
  ${card("isCardSite", "D · Site preparation", "before the truck arrives", `
    ${W5({ what: "The place and the way to it: route, door, floor, crane, climate, light, service space, drainage, air, network, power.",
      why: "The machine comes as one 12 t piece (example). If the door is 100 mm too small or the floor cracks on the way, the whole project stops.",
      how: "Walk the route with the drawing and a tape measure; mark the machine outline on the floor 1:1 (tape) including the open doors, the APC, the chip conveyor and the cabinet door.",
      check: "Outline on the floor checked by the maker's engineer and by maintenance (can they reach every service point?).",
      mistake: "Planning only the machine footprint – forgetting the cabinet door swing, the chip bin, the coolant-tank pull-out and the 800–1000 mm service space." })}
    ${tbl(["Requirement", `Value ${ex}`, "If not done"], X.SITE.map((r) => [`<b>${esc(r[0])}</b>`, esc(r[1]), esc(r[2])]))}
    ${info("Temperature – why 20 ± 2 °C", "Steel grows α = 11.5 µm per metre and kelvin. A 1 m machine structure that warms by 3 K grows ΔL = α·L·ΔT = 11.5 × 1 × 3 = 34.5 µm – more than the whole H7 tolerance of the Ø62 bore (30 µm). A temperature gradient (warm roof, cold floor) also bends the column.")}
    <div class="is-chk" data-phase="p1"></div>`)}
  ${card("isCardRig", "E · Transport + rigging", "centre of gravity · sling angle · WLL · forklift · locks · corrosion protection · delivery inspection", `
    ${W5({ what: "Getting the machine from the truck onto its foundation without damage: crane or forklift, slings, spreader beam, skates.",
      why: "The sling force grows with the angle: F = m·g / (n·cos θ). At θ = 60° each leg carries TWICE the vertical share. A machine lifted at the wrong points bends sheet metal or falls.",
      how: "Take the lifting points and the CoG from the maker's drawing → choose the sling arrangement (spreader beam if the slings would touch covers) → calculate the leg force → choose slings and shackles with WLL ≥ force → lifting plan signed by the rigger.",
      check: "Labels on every sling and shackle readable (WLL); trial lift 100–200 mm, hold, check the level and the brakes; machine hangs level (CoG under the hook).",
      mistake: "Using the 4-leg value with all four legs carrying – in reality one leg is often slack (rigid machine, unequal sling lengths). Count only 3 legs (or 2 if the CoG is far off)." })}
    <div class="is-grid2">
      <div><div class="is-svgbox" id="isLiftSvg"></div></div>
      <div>
        <div class="is-ctl is-ctl-col">
          ${lab(`Machine mass m (kg) ${ex}`, num("isRm", S.rig.m, 100, 90))}
          ${lab("Number of sling legs n", seg("legs", [[2, "2"], [4, "4"]], S.rig.n))}
          ${lab("Sling angle θ from vertical", `<input type="range" id="isRth" min="0" max="70" step="1" value="${S.rig.theta}"><b id="isRthV"></b>`)}
          ${lab("CoG offset e from the middle (mm)", `<input type="range" id="isRe" min="-600" max="600" step="10" value="${S.rig.e}"><b id="isReV"></b>`)}
          ${lab("Distance of the lifting points Lp (mm)", num("isRlp", S.rig.Lp, 100, 90, 800))}
          ${lab("Spreader beam", `<input type="checkbox" id="isRsp" ${S.rig.spreader ? "checked" : ""}> lower slings vertical (beam ${S.rig.mb} kg)`)}
        </div>
        <div id="isRigOut"></div>
      </div>
    </div>
    <h3>Forklift: actual capacity at the real load centre</h3>
    <div class="is-ctl">
      ${lab("Rated capacity Q (kg)", num("isFq", S.fk.Q, 500, 90))}${lab("at load centre c₀ (mm)", num("isFc0", S.fk.c0, 50, 80))}
      ${lab("front axle → fork face x (mm)", num("isFx", S.fk.x, 50, 80))}${lab("real load centre c (mm)", num("isFc", S.fk.c, 50, 80))}
    </div>
    <div id="isFkOut" class="rc-eq"></div>
    <div class="is-grid2">
      <div>
        ${info("Transport locks (axis shipping brackets)", "Steel brackets bolted between the moving parts (table, column, spindle head, APC) and the bed, so the axes cannot move on the truck. <b>Remove them only after the machine stands on its place</b> (not before moving it in!) and before the first axis move. Paint them red, count them against the manual, store them with the machine for the next move. Moving an axis against a lock bends the bracket, the ball screw or the coupling.")}
        ${info("Corrosion protection: VCI film + desiccant", "Machined surfaces get anti-corrosion oil; the machine is wrapped in VCI film (volatile corrosion inhibitor – the film releases a vapour that protects metal) with desiccant bags. Sea freight: humidity indicator card inside. On arrival unpack only in a dry hall at room temperature – a cold machine in a warm humid hall gets condensation (dew) on every surface. Let it reach room temperature (24 h) before opening.")}
        ${info("Shock + tilt indicators", "Small indicators on the crate change colour above a set acceleration (e.g. 25 g / 50 g) or tilt angle. <b>Check them before you sign the delivery note.</b> If triggered: write 'accepted with reservation – shock indicator triggered', take photos, inform the maker and the insurer at once, check the geometry before acceptance.")}
      </div>
      <div>
        ${info("Delivery inspection (on the truck, before unloading)", "Indicators · packing damage (holes, wet wood, broken film) · photos from all sides · count boxes vs packing list · check the machine nameplate / serial number · write every remark on the CMR / delivery note and let the driver sign it.")}
        ${info("Skates, rollers, air pads", "Heavy-duty skates (e.g. 4 × 6 t, polyurethane or steel rollers) under the lifting/jack points; steel plates (≥ 20 mm) over joints, drains and weak floor. Point load per skate with 4 skates: count only 3 → 12 000 kg × 9.81 / 3 = 39 kN. Push slowly (walking speed is too fast), steer with a tow bar. Air pads need a very smooth, sealed floor.")}
        ${info("Crane hook load", "The crane must carry the machine + spreader beam + slings + shackles + hook block, at the working radius (mobile crane: capacity drops quickly with the radius). Rule: crane capacity at that radius ≥ 1.25 × hook load. Outriggers on mats; check the ground under the outriggers.")}
      </div>
    </div>
    <div class="is-chk" data-phase="p2"></div>`)}
  ${card("isCardUtil", "F · Utilities – compressed air, coolant, chips, mist extraction, network", "ready BEFORE the machine arrives · live calculators", `
    ${W5({ what: "Everything the machine needs besides power (power = item 3): compressed air, coolant, chip removal, oil-mist extraction, network.",
      why: "A machine without dry air gives pressure alarms and sticking valves; a wrong coolant mix rusts parts and smells; no network = no MES data.",
      how: "Get the utility list from the maker (pressure, quality class, NL/min, coolant type and tank volume, exhaust m³/h, interface) → design the supply for the whole line with reserve → install and test before delivery.",
      check: "At the machine connection: pressure under load, dew point, coolant concentration with a refractometer, extraction flow, network ping / OPC UA browse.",
      mistake: "Taking the air drop from the BOTTOM of the main pipe – condensate and dirt run straight into the machine." })}
    <h3>Compressed air – demand of the line</h3>
    <div id="isAirCons"></div>
    <div class="is-ctl">${lab("leakage allowance (%)", num("isAleak", S.air.leak, 1, 60))}${lab("future reserve (%)", num("isAres", S.air.reserve, 1, 60))}</div>
    <div id="isAirDem" class="rc-eq"></div>
    <h3>Compressed air – pipe size and pressure drop</h3>
    <div class="is-grid2">
      <div>
        <div class="is-ctl">
          ${lab("pipe length L (m)", num("isAL", S.air.L, 5, 70))}${lab("+ fittings (equiv. %)", num("isAeq", S.air.eq, 5, 60))}
          ${lab("inner diameter d (mm)", `<select id="isAd">${C.PIPE_ID.map((d) => `<option ${d === S.air.d ? "selected" : ""}>${d}</option>`).join("")}</select>`)}
          ${lab("network pressure (MPa gauge)", num("isApg", S.air.pg, 0.05, 70, 0.3))}
          ${lab("ring main", `<input type="checkbox" id="isAring" ${S.air.ring ? "checked" : ""}> two paths`)}
        </div>
        <div id="isAirDrop"></div>
      </div>
      <div><div class="is-svgbox" id="isAirSvg"></div></div>
    </div>
    ${tbl(["ISO 8573-1 class", "Solid particles (max. number per m³)", "Water: pressure dew point", "Oil (total)"], X.AIR_CLASSES.map((r) => r.map(esc)))}
    <p class="rc-note">Class <b>1.4.1</b> ${ex} = particles class 1, water class 4 (dew point +3 °C – a refrigeration dryer), oil class 1. Typical chain: compressor → after-cooler → receiver → refrigeration dryer → coarse filter (1 µm) → fine/coalescing filter (0.01 µm, oil) → ring main. At the machine: shutoff valve (lockable), filter-regulator 0.5–0.6 MPa, pressure switch.</p>
    <h3>Coolant – first fill and concentration</h3>
    <div class="is-grid2">
      <div>
        <div class="is-ctl">
          ${lab("tank volume V (L)", num("isCv", S.cool.V, 50, 70))}${lab("target concentration (%)", num("isCc", S.cool.c, 0.5, 60))}
          ${lab("refractometer factor k", num("isCk", S.cool.k, 0.05, 60))}${lab("reading now (°Brix)", num("isCb", S.cool.brix, 0.1, 60))}
        </div>
        <div id="isCoolOut" class="rc-eq"></div>
      </div>
      <div>
        ${tbl(["Mixing water", `Value ${ex}`], [["hardness", "5–15 °dH (soft water foams, hard water makes soap scum)"], ["chlorides", "< 50 mg/L (corrosion)"], ["pH of the water", "6.5–8"], ["pH of the emulsion", "8.5–9.3 (below 8.5 bacteria grow)"], ["nitrite", "< 20 mg/L (in the emulsion)"]])}
        <p class="rc-note"><b>O-I-W rule: Oil Into Water.</b> Fill the water first, add the concentrate slowly while mixing (or use a proportional mixer). Water into concentrate gives an unstable 'cream'. Central system (one big tank + flume for the line) vs individual tanks (800 L per machine ${ex}): central = stable quality, one filter, less work, but one bad batch stops all machines.</p>
      </div>
    </div>
    <h3>Chips + oil-mist extraction</h3>
    <div class="is-grid2">
      <div>
        <div class="is-ctl">${lab("chips per part (kg)", num("isChm", S.chip.mChip, 0.1, 60))}${lab("chip bulk density (kg/m³)", num("isChr", S.chip.rho, 100, 70))}</div>
        <div id="isChipOut" class="rc-eq"></div>
        <p class="rc-note">Grey cast iron (crankcase) makes short, dusty chips: hinged-belt or scraper conveyor, magnetic separator for fines; bins with fork pockets; chips must drain (coolant back to the tank) before they go to the recycler.</p>
      </div>
      <div>
        <div class="is-ctl">${lab("enclosure volume (m³)", num("isMv", S.mist.Venc, 0.5, 60))}${lab("air changes per minute", num("isMa", S.mist.ach, 1, 60))}</div>
        <div id="isMistOut" class="rc-eq"></div>
        <p class="rc-note">High-pressure through-spindle coolant (7 MPa) makes more mist → use the upper value. Mist collector on the machine roof, duct sealed, drain back to the coolant tank. The hall still needs general ventilation (make-up air for what the collectors blow out, if they exhaust outside).</p>
      </div>
    </div>
    <h3>Network – connection to the MES</h3>
    <p class="rc-note">Each HMC gets a labelled network point (Cat 6 or fibre), a fixed IP address from the OT network plan, and a firewall rule to the MES. Interfaces: <b>OPC UA</b> (port 4840, umati / OPC 40501 machine-tool model), <b>MTConnect</b> (HTTP agent, read-only) or <b>PROFINET</b> to a line PLC. Test at commissioning: ping, browse the OPC UA server, check the data points (status, part counter, alarm, spindle load) in the MES. <button class="btn" id="isToComm">Open the Communication tab →</button></p>
    <div class="is-chk" data-phase="p3"></div>`)}
  ${card("isCardComm", "G · Commissioning – maker + buyer", "the order matters · spindle run-in program with temperature watch", `
    ${W5({ what: "The maker's service engineer brings the machine to life: locks off, oils, first power-on, alarms, home, run-in, lubrication, safety, backups.",
      why: "Most damage happens in the first hours: an axis moved against a transport lock, a dry hydraulic pump, a spindle run at full speed with fresh grease, a pump turning backwards.",
      how: "Follow the maker's commissioning list step by step; the buyer's maintenance people work WITH the engineer (best training there is). Record every value.",
      check: "Commissioning report signed by both sides: oil levels, voltages, alarm list, run-in temperatures, safety tests, backup date.",
      mistake: "Letting the maker work alone and getting only a signature – then nobody in the plant knows where the lube distributor or the backup is." })}
    ${tbl(["#", "Step", "How", "Why / what goes wrong"], X.COMM_STEPS.map((r, i) => [i + 1, `<b>${esc(r[0])}</b>`, esc(r[1]), esc(r[2])]), "is-wrap-td")}
    <h3>Spindle run-in – step-up speeds, temperature watch</h3>
    <div class="is-ctl">${lab("Program", seg("skip", [["0", "step-up run-in (correct)"], ["1", "skip run-in: 6000 rpm at once (wrong)"]], S.skip ? "1" : "0"))}</div>
    <div class="is-grid2">
      <div><div class="is-leg" id="isRunLeg"></div><div class="is-svgbox" id="isRunSpd"></div><div class="is-svgbox" id="isRunTmp"></div><div id="isRunOut" class="rc-eq"></div></div>
      <div><pre class="is-pre" id="isRunPrg"></pre>
        <p class="rc-note">Illustration model (not the maker's data): housing temperature rise follows a first-order lag (τ = 12 min) to 22·(n/6000)<sup>1.3</sup> K, plus extra heat while fresh grease is not yet spread. Rule: next speed step only when the temperature has been stable (≤ 1 K in 10 min). Limit ${C.RUNIN_LIMIT} K rise ${ex}. Run the short warm-up program every morning and after a stop &gt; 2 days.</p></div>
    </div>
    <div class="is-chk" data-phase="p4"></div>`)}
  ${card("isCardAccept", "H · Acceptance – FAT, SAT, run-off with the real crankcase", "capability Cm/Cmk + Cp/Cpk · cycle-time proof · continuous run · documents · training", `
    ${W5({ what: "Formal proof that the machine does what the contract says: at the maker (FAT) and again at your site (SAT), with the real part.",
      why: "After acceptance the warranty starts and the last payment is due. Problems found later are your problem.",
      how: "Write the acceptance criteria into the purchase order (part, features, number of parts, Cmk, cycle time, run hours). Measure on a calibrated CMM / air gauge. Sign a protocol.",
      check: "Measuring system capable (gauge R&R ≤ 10 % of the tolerance), parts measured in order, data kept.",
      mistake: "Accepting with a test piece that is easier than the crankcase, or with 5 parts – capability needs ≥ 50 consecutive parts." })}
    ${tbl(["", "FAT – Factory Acceptance Test", "SAT – Site Acceptance Test"], X.FAT_SAT.map((r) => [`<b>${esc(r[0])}</b>`, esc(r[1]), esc(r[2])]), "is-wrap-td")}
    <h3>Capability run – ${esc(C.BORE.name)} (LSL ${C.BORE.lsl.toFixed(3)} / USL ${C.BORE.usl.toFixed(3)} mm), 50 consecutive parts ${ex}</h3>
    <div class="is-ctl">${lab("Data set", seg("data", [["A", "A · warm machine (good)"], ["B", "B · cold start drift"], ["C", "C · loose fixture"]], S.data))}</div>
    <div class="is-grid2">
      <div><div class="is-leg" id="isHistLeg"></div><div class="is-svgbox" id="isHist"></div></div>
      <div><div id="isCapOut"></div></div>
    </div>
    <details class="is-det"><summary>The 50 measured values (mm) – generated deterministically, copy them to check by hand</summary><div id="isCapData"></div></details>
    <div id="isProc" class="rc-eq"></div>
    <h3>Cycle-time proof</h3>
    <div class="is-ctl">${lab("quoted floor-to-floor time (s)", num("isQuote", S.quote, 1, 70))}</div>
    <div id="isCyc"></div>
    <h3>Continuous run (8–24 h) – acceptance criteria ${ex}</h3>
    ${tbl(["Criterion", "Limit", "Note"], [["Run time", "8 h minimum, 24 h for a line", "real parts, real program, normal staff"], ["Machine-caused stops", "0 (or availability ≥ 95 % agreed)", "tool breakage by wrong tool data is not the machine's fault – define it before"], ["Alarms", "no repeating alarm", "record every alarm with time"], ["Quality", "all parts within tolerance; SPC chart stable", "sample every 10th part"], ["Thermal drift", "bore Ø within tolerance from cold start to 8 h", "warm-up program allowed"], ["Leaks / noise", "none", "oil, coolant, air"]])}
    <h3>Documentation handover</h3>
    ${tbl(["Document", "Content", "Why / rule"], X.DOCS.map((r) => r.map(esc)), "is-wrap-td")}
    <h3>Training</h3>
    ${tbl(["Group", `Duration ${ex}`, "Contents"], X.TRAINING.map((r) => r.map(esc)), "is-wrap-td")}
    <div class="is-chk" data-phase="p5"></div>`)}
  ${card("isCardMist", "I · Typical installation mistakes and their cost", "money values are rough examples to show the size of the risk", tbl(["Mistake", "What happens", `Cost ${ex}`], X.MISTAKES.map((r) => [`<b>${esc(r[0])}</b>`, esc(r[1]), esc(r[2])]), "is-wrap-td"))}
  ${card("isCardMaker", "J · Questions for the machine maker", "ask them at the pre-installation meeting – write the answers into the contract", `<ol class="is-ol">${X.QUESTIONS.map((q) => `<li>${esc(q)}</li>`).join("")}</ol>
    <p class="rc-note">Details of the foundation and levelling are in <b>item 1</b> and <b>item 2</b>; the power supply and EMC in <b>item 3</b> and <b>item 4</b>. Guide: docs/28_installation_sequence_commissioning.md.</p>`)}
  </div>`;

  /* ================================================================ A · plan */
  let R = null;
  function plan() {
    R = C.cpm(C.buildTasks(S.scope), S.dur);
    if (!R.by[S.sel]) S.sel = "FC";
    const t0 = C.parseDate(S.start), by = R.by;
    const fc = by.FC, fp = by.FP;
    $("isPlanKpi").innerHTML = [
      ["Production ramp-up finished", C.finishDate(t0, R.end, 1), `day ${R.end} after the order`],
      ["Handover (final acceptance)", C.finishDate(t0, by.HO.EF, by.HO.d), `day ${by.HO.EF}`],
      [S.scope === "line" ? "First machine delivery" : "Machine delivery", C.fmtDate(C.addDays(t0, by.DEL.ES)), `day ${by.DEL.ES}`],
      ["Float of the foundation", `${fc.TF} days`, `pour at the latest on ${C.fmtDate(C.addDays(t0, fp.LS))}`],
      ["Critical steps", `${R.tasks.filter((t) => t.crit).length} of ${R.tasks.length}`, "zero float"],
    ].map((k) => `<div class="kpi"><div class="label">${k[0]}</div><div class="value text">${k[1]}</div><div class="note">${k[2]}</div></div>`).join("");
    $("isGanttLeg").innerHTML = C.ROLES.map((r, i) => `<span><i style="background:var(--is-c${i + 1})"></i>${r}</span>`).join("") +
      `<span><i class="is-legcrit"></i>critical (float 0)</span><span><i class="is-legfloat"></i>total float</span><span><i class="is-legms"></i>milestone</span>`;
    $("isGantt").innerHTML = gantt(R, t0);
    const s = by[S.sel], role = roleOf(s);
    $("isSel").innerHTML = `<b>${esc(s.id)} · ${esc(s.name)}</b> <span class="is-chip" style="background:var(--is-c${role + 1})">${C.ROLES[role]}</span>
      ${s.crit ? `<span class="rc-chip rc-bad">critical</span>` : `<span class="rc-chip">float ${s.TF} d</span>`}
      <span class="is-selctl">duration <button class="btn" data-isdd="-1">−</button><input type="number" min="0" max="400" value="${s.d}" data-isdur="${s.id}" style="width:64px"><button class="btn" data-isdd="1">+</button> days</span>
      <div class="is-selinfo">start ${C.fmtDate(C.addDays(t0, s.ES))} (day ${s.ES}) · finish ${C.finishDate(t0, s.EF, s.d)} · latest start ${C.fmtDate(C.addDays(t0, s.LS))} · predecessors: ${s.pre.length ? s.pre.map(esc).join(", ") : "–"} · ${esc(s.note)}</div>`;
    const par = R.tasks.filter((t) => t.crit && !R.path.includes(t.id)).map((t) => t.id);
    $("isPath").innerHTML = `<b>Critical path</b> (${R.end} days, end ${C.finishDate(t0, R.end, 1)}): ${R.path.map((id) => `<span class="is-cp">${id}</span>`).join(" → ")}${par.length ? ` · also critical (parallel, same dates): ${par.map((id) => `<span class="is-cp">${id}</span>`).join(" ")}` : ""}`;
    $("isCpmTbl").innerHTML = tbl(["ID", "Step", "R", "Duration d", "Predecessors", "ES", "EF", "LS", "LF", "Total float", "Free float", "Start", "Finish"],
      R.tasks.map((t) => [`<b>${t.id}</b>`, esc(t.name), C.ROLE_SHORT[roleOf(t)], `<input type="number" min="0" max="400" value="${t.d}" data-isdur="${t.id}" style="width:62px" class="${S.dur[t.id] != null ? "changed" : ""}">`,
        t.pre.join(", ") || "–", t.ES, t.EF, t.LS, t.LF, t.crit ? `<b class="rc-bad">0</b>` : t.TF, t.FF, C.fmtDate(C.addDays(t0, t.ES)), C.finishDate(t0, t.EF, t.d)]), "is-cpm");
    [...$("isCpmTbl").querySelectorAll("tr")].slice(1).forEach((tr, i) => { const t = R.tasks[i]; if (t.crit) tr.classList.add("is-critrow"); if (t.id === S.sel) tr.classList.add("is-selrow"); tr.dataset.issel = t.id; });
    raci();
  }
  const roleOf = (t) => { const i = [...t.raci].findIndex((c) => c === "X" || c === "R"); return i < 0 ? 0 : i; };
  function gantt(R, t0) {
    const W = 1360, left = 360, rh = 19, top = 36, n = R.tasks.length, H = top + n * rh + 10;
    const span = R.end + 4, px = (W - left - 16) / span, x = (d) => left + d * px;
    let s = `<svg class="is-svg is-gsvg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Gantt chart">`;
    s += `<defs><marker id="isArr" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L6,3 L0,6 z" class="is-arrh"/></marker>
      <marker id="isArrC" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L6,3 L0,6 z" class="is-arrhc"/></marker></defs>`;
    // month grid
    const d0 = new Date(t0);
    for (let m = 0; m < 40; m++) {
      const tm = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + m, 1), day = Math.round((tm - t0) / 86400000);
      if (day > span) break;
      if (day >= 0) s += `<line x1="${x(day)}" y1="${top - 14}" x2="${x(day)}" y2="${H - 6}" class="is-grid"/>`;
      const mid = Math.max(day, 0) + 15;
      if (mid < span) s += `<text x="${x(Math.max(day, 0)) + 4}" y="${top - 18}" class="is-ax">${new Date(tm).toLocaleString("en-GB", { month: "short", timeZone: "UTC" })} ${String(new Date(tm).getUTCFullYear()).slice(2)}</text>`;
    }
    for (let w = 0; w <= span; w += 7) s += `<line x1="${x(w)}" y1="${top - 6}" x2="${x(w)}" y2="${top - 2}" class="is-tick"/>`;
    s += `<text x="8" y="${top - 18}" class="is-ax">Step (ID)</text><text x="${left - 6}" y="${top - 18}" class="is-ax" text-anchor="end">d</text>`;
    const yy = (i) => top + i * rh, idx = Object.fromEntries(R.tasks.map((t, i) => [t.id, i]));
    R.tasks.forEach((t, i) => {
      if (t.id === S.sel) s += `<rect x="0" y="${yy(i)}" width="${W}" height="${rh}" class="is-gsel"/>`;
      else if (i % 2) s += `<rect x="0" y="${yy(i)}" width="${W}" height="${rh}" class="is-gzebra"/>`;
    });
    // dependency arrows
    R.tasks.forEach((t, i) => t.P.forEach((p) => {
      const a = R.by[p.id], j = idx[p.id], x1 = x(a.EF), y1 = yy(j) + rh / 2, x2 = x(t.ES), y2 = yy(i) + rh / 2;
      const crit = a.crit && t.crit && t.ES === a.EF + p.lag;
      const xm = Math.max(x1 + 3, Math.min(x2 - 3, x1 + 6));
      s += `<path d="M${x1},${y1} H${xm} V${y2} H${x2 - 1}" class="${crit ? "is-depc" : "is-dep"}" marker-end="url(#${crit ? "isArrC" : "isArr"})"/>`;
    }));
    R.tasks.forEach((t, i) => {
      const y = yy(i), role = roleOf(t), cy = y + rh / 2;
      const name = t.name.length > 44 ? t.name.slice(0, 43) + "…" : t.name;
      s += `<g class="is-grow" data-issel="${t.id}"><rect x="0" y="${y}" width="${W}" height="${rh}" fill="transparent"/>`;
      s += `<text x="8" y="${cy + 4}" class="is-glab${t.crit ? " is-glabc" : ""}"><tspan class="is-gid">${t.id}</tspan> ${esc(name)}</text>`;
      s += `<text x="${left - 6}" y="${cy + 4}" class="is-glab" text-anchor="end">${t.d}</text>`;
      if (t.d === 0) s += `<path d="M${x(t.ES)},${cy - 6} l6,6 l-6,6 l-6,-6 z" class="is-ms${t.crit ? " is-crit" : ""}"/>`;
      else s += `<rect x="${x(t.ES)}" y="${y + 3}" width="${Math.max(2, t.d * px)}" height="${rh - 6}" rx="2" style="fill:var(--is-c${role + 1})" class="is-bar${t.crit ? " is-crit" : ""}"/>`;
      if (t.TF > 0) s += `<line x1="${x(t.EF)}" y1="${cy}" x2="${x(t.EF + t.TF)}" y2="${cy}" class="is-float"/><line x1="${x(t.EF + t.TF)}" y1="${cy - 4}" x2="${x(t.EF + t.TF)}" y2="${cy + 4}" class="is-float"/>`;
      s += `</g>`;
    });
    s += `<line x1="${x(R.end)}" y1="${top - 4}" x2="${x(R.end)}" y2="${H - 6}" class="is-endl"/><text x="${x(R.end) - 4}" y="${top - 4}" class="is-ax is-endt" text-anchor="end">end day ${R.end}</text>`;
    return s + `</svg>`;
  }

  /* ================================================================ B · RACI */
  function raci() {
    const tasks = C.buildTasks("one");
    const L = { X: "A/R", R: "R", A: "A", C: "C", I: "I", "-": "" };
    $("isRaci").innerHTML = tbl(["ID", "Step", ...C.ROLES], tasks.map((t) => [`<b>${t.id}</b>`, esc(t.name), ...[...t.raci].map((c) => c === "-" ? "" : `<span class="is-raci is-raci-${c}">${L[c]}</span>`)]), "is-racitbl") +
      `<p class="rc-note">For the 3-machine line the rows repeat for HMC-02 and HMC-03; the line run-off (LINE) is A = buyer, R = maker(s) + robot integrator. "Maker" includes the maker's service engineer and its forwarder (until the Incoterms point). "Buyer" includes your facility, maintenance, production and IT departments.</p>`;
  }

  /* ================================================================ C · checklists */
  function chkHtml(p) {
    const done = p.items.filter((_, i) => CHK[p.id + ":" + i]).length;
    return `<div class="is-chkhead"><b>Checklist ${esc(p.title)}</b><span class="is-pbar"><i style="width:${(100 * done / p.items.length).toFixed(1)}%"></i></span><span>${done} / ${p.items.length}</span></div>
      <ul class="is-chklist">${p.items.map((it, i) => `<li><label><input type="checkbox" data-chk="${p.id}:${i}" ${CHK[p.id + ":" + i] ? "checked" : ""}> <span>${esc(it)}</span></label></li>`).join("")}</ul>`;
  }
  function checklists() {
    box.querySelectorAll(".is-chk").forEach((el) => { const p = X.PHASES.find((q) => q.id === el.dataset.phase); el.innerHTML = chkHtml(p); });
    progress();
  }
  function progress() {
    let all = 0, tot = 0;
    const rows = X.PHASES.map((p) => { const d = p.items.filter((_, i) => CHK[p.id + ":" + i]).length; all += d; tot += p.items.length; return [p, d]; });
    $("isProg").innerHTML = rows.map(([p, d]) => `<div class="is-progrow" data-isgo="${p.id}"><span class="is-progt">${esc(p.title)}</span><span class="is-pbar"><i style="width:${(100 * d / p.items.length).toFixed(1)}%"></i></span><span class="is-progn">${d} / ${p.items.length}</span></div>`).join("") +
      `<div class="is-progrow is-progall"><span class="is-progt"><b>All phases</b></span><span class="is-pbar"><i style="width:${(100 * all / tot).toFixed(1)}%"></i></span><span class="is-progn">${all} / ${tot}</span></div>`;
  }

  /* ================================================================ E · rigging */
  function rig() {
    const r = C.sling(S.rig), g = S.rig;
    $("isRthV").textContent = `${g.theta}°`; $("isReV").textContent = `${g.e} mm`;
    $("isLiftSvg").innerHTML = liftSvg(r);
    const cls = r.warn === "ok" ? "rc-ok" : "rc-bad";
    $("isRigOut").innerHTML = `<div class="rc-eq">
      W = m·g = ${g.m} × 9.81 = <b>${f(r.W, 2)} kN</b><br>
      ${g.spreader ? `below the spreader beam the legs hang vertical (θ = 0): F = W / n = ${f(r.W, 2)} / ${g.n} = <b>${f(r.Feq, 2)} kN</b>` :
        `all legs equal: F = m·g / (n·cos θ) = ${f(r.W, 2)} / (${g.n} × ${f(Math.cos(g.theta * Math.PI / 180), 4)}) = <b>${f(r.Feq, 2)} kN</b>`}<br>
      ${g.n === 4 && !g.spreader ? `4-leg rule (only 3 legs carry): F = W / (3·cos θ) = <b>${f(r.F3, 2)} kN</b><br>` : ""}
      CoG offset e = ${g.e} mm (hook above the CoG): leg A ${f(r.FA, 2)} kN${g.spreader ? "" : ` (θA ${f(r.thA, 1)}°)`} · leg B ${f(r.FB, 2)} kN${g.spreader ? "" : ` (θB ${f(r.thB, 1)}°)`}<br>
      ${g.spreader ? `top legs beam → hook: F = (W + beam) / (2·cos θ) = <b>${f(r.Ftop, 2)} kN</b> each (CoG centred under the hook point of the beam – beams have several hook holes for this)` : `horizontal squeeze on the machine per side H = ${f(r.HA, 2)} kN`}</div>
      ${tbl(["Result", "Value"], [
        ["design force per leg (largest case)", `<b>${f(r.Fdesign, 2)} kN</b> = ${f(r.tReq, 2)} t`],
        ["round sling (EN 1492-2), WLL straight – from the exact angle", Number.isFinite(r.slingWll[0]) ? `${r.slingWll[0]} t (${r.slingWll[1]})` : "special sling"],
        ["round sling by the EN 1492-2 marking table (angle band, M = " + r.bandM + "): hook load " + f(r.hookLoad / 1000, 2) + " t / " + r.bandM + " = " + f(r.tBand, 2) + " t", Number.isFinite(r.slingBand[0]) ? `${r.slingBand[0]} t (${r.slingBand[1]})` : "special sling"],
        ["<b>choose (the larger of both – safe for any angle in the band)</b>", Number.isFinite(r.slingSafe[0]) ? `<b>${r.slingSafe[0]} t (${r.slingSafe[1]})</b>` : "special sling"],
        ["bow shackle WLL", Number.isFinite(r.shackle) ? `${r.shackle} t` : "special"],
        ["hook load (machine + rigging)", `${f(r.hookLoad, 0)} kg → crane ≥ ${f(1.25 * r.hookLoad / 1000, 1)} t at the radius`],
        ["sling angle", `<span class="${cls}">${g.theta}° – ${r.warn === "ok" ? "OK (≤ 45°)" : r.warn === "avoid" ? "avoid (> 45°): forces rise fast" : "NOT allowed (> 60°)"}</span>`],
        ["column / cover contact", liftContact(r) ? `<span class="rc-bad">sling touches the column covers → use a spreader beam or longer slings</span>` : `<span class="rc-ok">free</span>`],
      ])}
      <p class="rc-note">WLL = working load limit, already includes the safety factor (round slings 7:1, chain 4:1). WLL of a sling in a basket or choke hitch is different (choke × 0.8). Values are examples – the lifting plan is made by the rigger.</p>`;
    const k = C.forklift({ ...S.fk, m: g.m });
    $("isFkOut").innerHTML = `Q<sub>act</sub> = Q·(c₀ + x)/(c + x) = ${S.fk.Q} × (${S.fk.c0} + ${S.fk.x}) / (${S.fk.c} + ${S.fk.x}) = <b>${f(k.Qact, 0)} kg</b> vs load ${g.m} kg →
      <span class="${k.ok ? "rc-ok" : "rc-bad"}">${k.ok ? `OK, margin ${f(k.margin, 1)} %` : "TOO SMALL – bigger forklift, a second forklift or a crane"}</span>.
      The rated capacity is valid only at the rated load centre c₀; a deep machine (2.8 m) has its CoG far from the fork face. Fork extensions, mast tilt and uneven floor reduce it further (forklift capacity plate).`;
  }
  function liftGeom(r) {
    const g = S.rig, Lp = g.Lp, half = Lp / 2, Hb = 2200, Hc = 3000, colW = 1000, bodyW = Math.max(Lp + 300, 2800);
    const hookY = g.spreader ? 3400 + Math.max(r.h, 600) : Hb + r.h;
    return { half, Hb, Hc, colW, bodyW, hookY, beamY: 3400 };
  }
  function liftContact(r) {
    if (S.rig.spreader) return false;
    const G2 = liftGeom(r), e = S.rig.e;
    // line from the lug (±half, Hb) to the hook (e, hookY): x at the column top height Hc
    return [-1, 1].some((sd) => { const x0 = sd * G2.half, xa = x0 + (e - x0) * (G2.Hc - G2.Hb) / (G2.hookY - G2.Hb); return sd < 0 ? xa > -G2.colW / 2 : xa < G2.colW / 2; });
  }
  function liftSvg(r) {
    const g = S.rig, G2 = liftGeom(r), Wd = 560, Hd = 440;
    const sc = Math.min((Wd - 60) / (G2.bodyW + 600), (Hd - 50) / (G2.hookY + 500));
    const X0 = Wd / 2, Y0 = Hd - 24, X = (v) => X0 + v * sc, Y = (v) => Y0 - v * sc;
    const contact = liftContact(r);
    let s = `<svg class="is-svg" viewBox="0 0 ${Wd} ${Hd}" width="100%" role="img" aria-label="Lift with slings">`;
    s += `<line x1="10" y1="${Y0}" x2="${Wd - 10}" y2="${Y0}" class="is-floor"/>`;
    // machine: base/body + column
    s += `<rect x="${X(-G2.bodyW / 2)}" y="${Y(G2.Hb)}" width="${G2.bodyW * sc}" height="${G2.Hb * sc}" class="is-mach"/>`;
    s += `<rect x="${X(-G2.colW / 2)}" y="${Y(G2.Hc)}" width="${G2.colW * sc}" height="${(G2.Hc - G2.Hb) * sc}" class="is-mach is-col${contact ? " is-hit" : ""}"/>`;
    s += `<text x="${X(-G2.bodyW / 2) + 8}" y="${Y(G2.Hb) + 18}" class="is-ax">HMC 500 (example) – ${g.m} kg</text>`;
    // CoG
    const cx = X(g.e), cy = Y(1100);
    s += `<circle cx="${cx}" cy="${cy}" r="8" class="is-cog"/><path d="M${cx},${cy - 8} A8,8 0 0,1 ${cx + 8},${cy} L${cx},${cy} Z M${cx},${cy + 8} A8,8 0 0,1 ${cx - 8},${cy} L${cx},${cy} Z" class="is-cogf"/>`;
    s += `<text x="${cx + 12}" y="${cy + 4}" class="is-ax">CoG (e = ${g.e} mm)</text>`;
    s += `<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${Y(G2.hookY)}" class="is-cl"/>`;
    // lugs
    const lugs = [-G2.half, G2.half];
    lugs.forEach((lx) => { s += `<circle cx="${X(lx)}" cy="${Y(G2.Hb)}" r="4" class="is-lug"/>`; });
    const hx = X(g.e), hy = Y(G2.hookY);
    const legLab = (x1, y1, x2, y2, t) => `<text x="${(x1 + x2) / 2 + (x1 < x2 ? -8 : 8)}" y="${(y1 + y2) / 2}" class="is-ax is-force" text-anchor="${x1 < x2 ? "end" : "start"}">${t}</text>`;
    if (g.spreader) {
      const by = Y(G2.beamY);
      s += `<rect x="${X(-G2.half) - 6}" y="${by - 5}" width="${G2.half * 2 * sc + 12}" height="10" class="is-beam"/>`;
      lugs.forEach((lx, i) => { s += `<line x1="${X(lx)}" y1="${Y(G2.Hb)}" x2="${X(lx)}" y2="${by}" class="is-sling"/>`; s += legLab(X(lx), Y(G2.Hb), X(lx) + (i ? 0.1 : -0.1), by, `${f(i ? r.FB : r.FA, 1)} kN`); });
      lugs.forEach((lx) => { s += `<line x1="${X(lx)}" y1="${by}" x2="${hx}" y2="${hy}" class="is-sling"/>`; });
      s += `<text x="${X(G2.half) + 10}" y="${(by + hy) / 2}" class="is-ax is-force">top ${f(r.Ftop, 1)} kN</text>`;
      s += `<text x="${X(0)}" y="${by + 18}" class="is-ax" text-anchor="middle">spreader beam</text>`;
    } else {
      lugs.forEach((lx, i) => { s += `<line x1="${X(lx)}" y1="${Y(G2.Hb)}" x2="${hx}" y2="${hy}" class="is-sling${contact ? " is-slinghit" : ""}"/>`; s += legLab(X(lx), Y(G2.Hb), hx, hy, `${f(i ? r.FB : r.FA, 1)} kN${g.n === 4 ? "/leg" : ""}`); });
      // angle arc at the hook (nominal θ)
      const rr = 34, th = g.theta * Math.PI / 180;
      s += `<path d="M${hx},${hy + rr} A${rr},${rr} 0 0,1 ${hx + rr * Math.sin(th)},${hy + rr * Math.cos(th)}" class="is-arc"/><text x="${hx + 6}" y="${hy + rr + 14}" class="is-ax">θ ≈ ${g.theta}°</text>`;
    }
    // hook
    s += `<path d="M${hx},${hy - 26} V${hy - 8} M${hx},${hy - 8} q0,8 -6,8 q-6,0 -6,-6" class="is-hook"/><rect x="${hx - 9}" y="${hy - 40}" width="18" height="14" rx="2" class="is-mach"/>`;
    s += `<text x="12" y="18" class="is-ax">side view · ${g.n} legs${g.n === 4 ? " (2 per side, behind each other)" : ""} · Lp = ${g.Lp} mm</text>`;
    if (contact) s += `<text x="12" y="34" class="is-ax is-badt">sling touches the column covers!</text>`;
    return s + `</svg>`;
  }

  /* ================================================================ F · utilities */
  function air() {
    const a = S.air;
    $("isAirCons").innerHTML = tbl(["Consumer", "Number", `Average NL/min per unit ${ex}`, "Peak NL/min per unit", "Average total"],
      a.cons.map((c, i) => [esc(c.name), `<input type="number" min="0" step="1" value="${c.n}" data-isair="${i}:n" style="width:56px">`, `<input type="number" min="0" step="10" value="${c.avg}" data-isair="${i}:avg" style="width:70px">`,
        `<input type="number" min="0" step="10" value="${c.peak}" data-isair="${i}:peak" style="width:70px">`, `${c.n * c.avg} NL/min`]));
    airCalc();
  }
  function airCalc() {
    const a = S.air, D = C.airDemand(a.cons, a.leak, a.reserve);
    $("isAirDem").innerHTML = `Σ average = <b>${f(D.avg, 0)} NL/min</b> (sum of peaks ${f(D.peak, 0)} NL/min – never all at once) ·
      design flow q = Σ·(1 + leak)·(1 + reserve) = ${f(D.avg, 0)} × ${f(1 + a.leak / 100, 2)} × ${f(1 + a.reserve / 100, 2)} = <b>${f(D.design, 0)} NL/min = ${f(D.ls, 2)} l/s = ${f(D.m3h, 1)} Nm³/h</b>.
      Compressor free-air delivery ≥ q; rule of thumb ≈ 6–7 kW of compressor per Nm³/min at 0.7 MPa → ≈ ${f(D.design / 1000 * 6.5, 1)} kW. NL = normal litre (air at 1.013 bar, 0 °C).`;
    const Leq = a.L * (1 + a.eq / 100), q = D.ls;
    const r = C.airDrop({ q, L: Leq, d: a.d, pg: a.pg * 10, ring: a.ring });
    const ok = r.dp <= 0.1, vok = r.v <= 8;
    $("isAirDrop").innerHTML = `<div class="rc-eq">Δp = 450 · q<sup>1.85</sup> · L / (d<sup>5</sup> · p) ${a.ring ? "(ring: q/2 and L/2)" : ""}<br>
      = 450 × ${f(a.ring ? q / 2 : q, 2)}<sup>1.85</sup> × ${f(a.ring ? Leq / 2 : Leq, 1)} / (${a.d}<sup>5</sup> × ${f(r.p, 3)}) = <b class="${ok ? "rc-ok" : "rc-bad"}">${f(r.dp, 4)} bar = ${f(r.dp * 100, 2)} kPa</b>
      (target ≤ 0.1 bar for the whole network)<br>q l/s free air · L m (incl. ${a.eq} % for fittings: ${a.L} → ${f(Leq, 1)} m) · d mm · p bar absolute = ${f(a.pg * 10, 1)} + 1.013<br>
      air speed in the pipe v = ${f(r.v, 2)} m/s <span class="${vok ? "rc-ok" : "rc-bad"}">${vok ? "OK (≤ 6–8 m/s main pipe)" : "too fast (> 8 m/s)"}</span> · pressure at the drop ≈ ${f(a.pg - r.dp / 10, 4)} MPa → filter-regulator set to 0.55 MPa ${ex}</div>` +
      tbl(["d (mm)", "Δp (bar)", "v (m/s)", "verdict"], C.PIPE_ID.map((d) => { const x = C.airDrop({ q, L: Leq, d, pg: a.pg * 10, ring: a.ring }); return [d === a.d ? `<b>${d}</b>` : d, f(x.dp, 4), f(x.v, 1), x.dp <= 0.1 && x.v <= 8 ? `<span class="rc-ok">OK</span>` : `<span class="rc-bad">too small</span>`]; }));
    $("isAirSvg").innerHTML = airSvg();
  }
  function airSvg() {
    const ring = S.air.ring;
    let s = `<svg class="is-svg" viewBox="0 0 520 300" width="100%" role="img" aria-label="Compressed air network">`;
    const bx = (x, y, w, t) => `<rect x="${x}" y="${y}" width="${w}" height="26" rx="4" class="is-ubox"/><text x="${x + w / 2}" y="${y + 17}" class="is-ax" text-anchor="middle">${t}</text>`;
    s += bx(6, 56, 104, "compressor") + bx(6, 98, 104, "receiver") + bx(6, 140, 104, "dryer (+3 °C)") + bx(6, 182, 104, "filters 1 / 0.01 µm");
    s += `<path d="M58,82 V98 M58,124 V140 M58,166 V182 M58,208 V220 H120" class="is-pipe"/>`;
    // main / ring with slope 1-2 % towards drains
    s += ring ? `<rect x="120" y="70" width="380" height="150" rx="6" class="is-pipe is-pipen"/>` : `<path d="M120,220 V70 H500" class="is-pipe"/>`;
    s += `<text x="8" y="18" class="is-ax">${ring ? "ring main – air comes from both sides" : "dead-end main – far end gets the lowest pressure"} · slope 1–2 % to drains</text>`;
    [0, 1, 2].forEach((i) => {
      const x = 200 + i * 110;
      s += `<path d="M${x},70 v-12 h14 v108" class="is-pipe is-drop"/>`;   // goose neck from the top
      s += `<circle cx="${x + 14}" cy="${120}" r="5" class="is-valve"/><rect x="${x + 6}" y="132" width="16" height="22" rx="3" class="is-fr"/>`;
      s += `<text x="${x + 26}" y="124" class="is-ax is-sm">shutoff</text><text x="${x + 26}" y="148" class="is-ax is-sm">filter-reg.</text>`;
      s += `<path d="M${x + 14},154 v20" class="is-pipe is-drop"/><rect x="${x - 6}" y="174" width="40" height="22" rx="3" class="is-ubox"/><text x="${x + 14}" y="189" class="is-ax is-sm" text-anchor="middle">HMC-0${i + 1}</text>`;
    });
    s += `<path d="M500,70 V250" class="is-pipe"/><path d="M494,250 h12 l-6,10 z" class="is-valve"/><text x="492" y="276" class="is-ax is-sm" text-anchor="end">condensate drain at the low point</text>`;
    s += `<text x="8" y="36" class="is-ax is-sm">drop = goose neck from the TOP of the main (no water into the machine)</text>`;
    return s + `</svg>`;
  }
  function cool() {
    const r = C.coolant(S.cool);
    $("isCoolOut").innerHTML = `first fill: concentrate = V·c = ${S.cool.V} × ${S.cool.c} % = <b>${f(r.conc, 1)} L</b> + water <b>${f(r.water, 1)} L</b><br>
      concentration = k × reading → target reading = c / k = ${S.cool.c} / ${S.cool.k} = <b>${f(r.readTarget, 2)} °Brix</b><br>
      now: ${S.cool.k} × ${S.cool.brix} = <b>${f(r.cNow, 2)} %</b> → ${r.add > 0 ? `add concentrate x = V·(c₂ − c₁)/(100 − c₂) = ${S.cool.V} × (${S.cool.c} − ${f(r.cNow, 2)}) / (100 − ${S.cool.c}) = <b>${f(r.add, 1)} L</b>` : r.addWater > 0 ? `add water ≈ V·(c₁ − c₂)/c₂ = <b>${f(r.addWater, 1)} L</b> (or remove emulsion first)` : "OK"}<br>
      <span class="rc-note">Factor k from the coolant data sheet (often 1.0–1.8). Measure daily; top up with a 1–2 % premix (water evaporates, concentrate stays).</span>`;
  }
  function chipMist() {
    const ch = C.chips({ ct: S.quote, mChip: S.chip.mChip, rho: S.chip.rho, n: 3 });
    $("isChipOut").innerHTML = `parts per shift (7.5 h, 3 HMC, ${S.quote} s) = 7.5 × 3600 / ${S.quote} × 3 = <b>${f(ch.parts, 0)}</b><br>chips = ${f(ch.parts, 0)} × ${S.chip.mChip} kg = <b>${f(ch.kg, 0)} kg</b> = ${f(ch.kg, 0)} / ${S.chip.rho} = <b>${f(ch.m3, 3)} m³ per shift</b> → choose bins / central conveyor for this + reserve.`;
    const m = C.mist({ ...S.mist, n: 3 });
    $("isMistOut").innerHTML = `extraction flow Q = V<sub>enclosure</sub> × air changes = ${S.mist.Venc} m³ × ${S.mist.ach} /min × 60 = <b>${f(m.perMachine, 0)} m³/h per machine</b>; 3 HMC = <b>${f(m.total, 0)} m³/h</b> ${ex} (supplier rule 3–8 air changes per minute).`;
  }

  /* ================================================================ G · commissioning */
  function run() {
    const good = C.runin(C.RUNIN, false), bad = S.skip ? C.runin(C.RUNIN, true) : null;
    $("isRunLeg").innerHTML = `<span><i style="background:var(--accent)"></i>step-up run-in</span>${bad ? `<span><i style="background:var(--critical)"></i>skipped: 6000 rpm at once</span>` : ""}<span><i class="is-leglim"></i>limit ${C.RUNIN_LIMIT} K ${ex}</span>`;
    const T = good.total;
    $("isRunSpd").innerHTML = lineChart([good, bad].filter(Boolean).map((r, i) => ({ pts: r.pts.map((p) => [p[0], p[1]]), cls: i ? "is-lnbad" : "is-ln", step: true })), { xmax: T, ymax: 6500, ylab: "spindle speed (rpm)", yt: [0, 2000, 4000, 6000], h: 150 });
    $("isRunTmp").innerHTML = lineChart([good, bad].filter(Boolean).map((r, i) => ({ pts: r.pts.map((p) => [p[0], p[2]]), cls: i ? "is-lnbad" : "is-ln" })), { xmax: T, ymax: 35, ylab: "housing temperature rise (K)", yt: [0, 10, 20, 30], h: 170, lim: C.RUNIN_LIMIT, xlab: "time (min)" });
    $("isRunOut").innerHTML = `step-up program: ${C.RUNIN.map((s) => `${s[0]} rpm ${s[1]} min`).join(" → ")} = <b>${T} min</b>; max rise <b class="${good.over ? "rc-bad" : "rc-ok"}">${f(good.max, 1)} K</b>` +
      (bad ? ` · skipped: max rise <b class="rc-bad">${f(bad.max, 1)} K ${bad.over ? "> limit → alarm / bearing damage risk" : ""}</b>` : "");
    $("isRunPrg").textContent = C.runinProgram();
  }
  function lineChart(series, o) {
    const W = 560, H = o.h, l = 50, r = 12, t = 10, b = o.xlab ? 32 : 18, X = (v) => l + v / o.xmax * (W - l - r), Y = (v) => H - b - v / o.ymax * (H - b - t);
    let s = `<svg class="is-svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(o.ylab)}">`;
    o.yt.forEach((v) => { s += `<line x1="${l}" y1="${Y(v)}" x2="${W - r}" y2="${Y(v)}" class="is-grid"/><text x="${l - 6}" y="${Y(v) + 4}" class="is-ax" text-anchor="end">${v}</text>`; });
    for (let v = 0; v <= o.xmax; v += 20) s += `<text x="${X(v)}" y="${H - b + 14}" class="is-ax" text-anchor="middle">${v}</text>`;
    s += `<text x="${l}" y="${t + 2}" class="is-ax" dy="-0">${esc(o.ylab)}</text>`;
    if (o.xlab) s += `<text x="${W - r}" y="${H - 4}" class="is-ax" text-anchor="end">${esc(o.xlab)}</text>`;
    if (o.lim != null) s += `<line x1="${l}" y1="${Y(o.lim)}" x2="${W - r}" y2="${Y(o.lim)}" class="is-lim"/>`;
    series.forEach((sr) => { s += `<path d="${sr.pts.map((p, i) => `${i ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join("")}" class="${sr.cls}"/>`; });
    s += `<line x1="${l}" y1="${H - b}" x2="${W - r}" y2="${H - b}" class="is-axl"/>`;
    return s + `</svg>`;
  }

  /* ================================================================ H · acceptance */
  function accept() {
    const x = C.boreData(S.data), c = C.capability(x), B = C.BORE, T = B.usl - B.lsl;
    $("isHistLeg").innerHTML = `<span><i style="background:var(--accent)"></i>parts per 2 µm class</span><span><i class="is-legcurve"></i>normal curve (x̄, s)</span><span><i class="is-leglim"></i>LSL / USL</span><span><i class="is-legmean"></i>mean x̄</span>`;
    $("isHist").innerHTML = hist(x, c);
    const okM = c.Cm >= 1.67 && c.Cmk >= 1.67;
    $("isCapOut").innerHTML = `<div class="rc-eq">n = ${c.n} · x̄ = Σx/n = <b>${f(c.mean, 5)} mm</b> · s = √(Σ(x − x̄)²/(n − 1)) = <b>${f(c.s * 1000, 3)} µm</b><br>
      min ${f(c.min, 4)} · max ${f(c.max, 4)} · tolerance T = USL − LSL = ${f(T * 1000, 0)} µm<br>
      <b>Cm</b> = T / (6s) = ${f(T * 1000, 0)} / (6 × ${f(c.s * 1000, 3)}) = <b class="${c.Cm >= 1.67 ? "rc-ok" : "rc-bad"}">${f(c.Cm, 2)}</b> (≥ 1.67)<br>
      <b>Cmk</b> = min(USL − x̄, x̄ − LSL) / (3s) = min(${f((B.usl - c.mean) * 1000, 2)}, ${f((c.mean - B.lsl) * 1000, 2)}) µm / (3 × ${f(c.s * 1000, 3)}) = <b class="${c.Cmk >= 1.67 ? "rc-ok" : "rc-bad"}">${f(c.Cmk, 2)}</b> (≥ 1.67)</div>
      <p><span class="rc-chip ${okM ? "rc-ok" : "rc-bad"}">${okM ? "machine capability PROVED" : "NOT accepted – find the cause, repeat 50 parts"}</span></p>
      <p class="rc-note">${S.data === "A" ? "Warm machine, stable clamping: narrow, centred distribution." : S.data === "B" ? "The first parts are larger (machine not warm): the spread s grows and Cmk falls. Fix: warm-up program before the run, or start counting after warm-up – agree this in the contract." : "Loose clamp / two pallets with different offset: two humps, wide spread. Fix the fixture and the pallet offsets, then repeat."}
      Cm/Cmk = short-term <b>machine</b> capability (50 consecutive parts, same tool, same operator). Cp/Cpk = <b>process</b> capability over a longer time with all influences (tool changes, temperature, operators) – target Cpk ≥ 1.33.</p>`;
    $("isCapData").innerHTML = `<div class="is-data">${x.map((v, i) => `<span>${i + 1}: ${v.toFixed(4)}</span>`).join("")}</div>`;
    const P = C.processCap(C.processData());
    $("isProc").innerHTML = `<b>Process preview</b> (ramp-up, 25 samples of 5 parts over several days ${ex}): x̄ = ${f(P.mean, 5)} mm · R̄ = ${f(P.Rbar * 1000, 2)} µm → σ<sub>within</sub> = R̄/d₂ = ${f(P.Rbar * 1000, 2)}/2.326 = ${f(P.sw * 1000, 3)} µm ·
      <b>Cp</b> = T/(6σ) = ${f(P.Cp, 2)} · <b>Cpk</b> = ${f(P.Cpk, 2)} <span class="${P.Cpk >= 1.33 ? "rc-ok" : "rc-bad"}">(≥ 1.33 ${P.Cpk >= 1.33 ? "OK" : "not OK"})</span> ·
      overall s = ${f(P.s * 1000, 3)} µm → Pp = ${f(P.Pp, 2)}, <b>Ppk</b> = ${f(P.Ppk, 2)}. Cpk uses the short-term spread inside the samples; Ppk the total spread including the shifts between samples – Ppk ≤ Cpk.`;
    cyc();
  }
  function hist(x, c) {
    const B = C.BORE, bw = 0.002, lo = Math.min(B.lsl - bw, Math.floor(c.min / bw) * bw), hi = Math.max(B.usl + bw, Math.ceil(c.max / bw) * bw + bw);
    const nb = Math.round((hi - lo) / bw), cnt = new Array(nb).fill(0);
    x.forEach((v) => { const i = Math.min(nb - 1, Math.max(0, Math.floor((v - lo) / bw + 1e-9))); cnt[i]++; });
    const ymax = Math.max(4, Math.ceil(Math.max(...cnt, c.n * bw / (c.s * Math.sqrt(2 * Math.PI))) / 2) * 2 + 2);
    const W = 560, H = 280, l = 40, r = 14, t = 14, b = 36, X = (v) => l + (v - lo) / (hi - lo) * (W - l - r), Y = (v) => H - b - v / ymax * (H - b - t);
    let s = `<svg class="is-svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Histogram of the bore diameter">`;
    for (let v = 0; v <= ymax; v += 2) s += `<line x1="${l}" y1="${Y(v)}" x2="${W - r}" y2="${Y(v)}" class="is-grid"/><text x="${l - 6}" y="${Y(v) + 4}" class="is-ax" text-anchor="end">${v}</text>`;
    s += `<text x="${l}" y="${t - 3}" class="is-ax">parts</text>`;
    cnt.forEach((k, i) => { if (k) s += `<rect x="${X(lo + i * bw) + 1}" y="${Y(k)}" width="${X(lo + bw) - X(lo) - 2}" height="${Y(0) - Y(k)}" class="is-hbar"><title>${(lo + i * bw).toFixed(3)}–${(lo + (i + 1) * bw).toFixed(3)} mm: ${k}</title></rect>`; });
    let d = ""; for (let i = 0; i <= 120; i++) { const v = lo + (hi - lo) * i / 120, y = c.n * bw * Math.exp(-0.5 * ((v - c.mean) / c.s) ** 2) / (c.s * Math.sqrt(2 * Math.PI)); d += `${i ? "L" : "M"}${X(v).toFixed(1)},${Y(Math.min(y, ymax)).toFixed(1)}`; }
    s += `<path d="${d}" class="is-curve"/>`;
    [[B.lsl, "LSL"], [B.usl, "USL"]].forEach(([v, tx]) => { s += `<line x1="${X(v)}" y1="${t}" x2="${X(v)}" y2="${H - b}" class="is-lim"/><text x="${X(v)}" y="${t + 10}" class="is-ax is-badt" text-anchor="${tx === "LSL" ? "start" : "end"}" dx="${tx === "LSL" ? 4 : -4}">${tx}</text>`; });
    s += `<line x1="${X(c.mean)}" y1="${t + 14}" x2="${X(c.mean)}" y2="${H - b}" class="is-mean"/><text x="${X(c.mean) + 4}" y="${t + 24}" class="is-ax">x̄</text>`;
    for (let v = Math.ceil(lo / 0.005 - 1e-9) * 0.005; v <= hi + 1e-9; v += 0.005) s += `<text x="${X(v)}" y="${H - b + 14}" class="is-ax" text-anchor="middle">${v.toFixed(3)}</text>`;
    s += `<line x1="${l}" y1="${H - b}" x2="${W - r}" y2="${H - b}" class="is-axl"/><text x="${W - r}" y="${H - 4}" class="is-ax" text-anchor="end">bore diameter (mm)</text>`;
    return s + `</svg>`;
  }
  function cyc() {
    const d = C.cycleData(), st = C.stats(d), q = S.quote, worst = Math.max(...d), ok = st.mean <= q && worst <= q * 1.02;
    $("isCyc").innerHTML = tbl(["Cycle", ...d.map((_, i) => i + 1), "mean"], [["floor-to-floor (s)", ...d.map((v) => f(v, 1)), `<b>${f(st.mean, 1)}</b>`]]) +
      `<p class="rc-note">Quote ${q} s ${ex} (345 s machining incl. tool changes + 15 s pallet change, factory.json). Rule ${ex}: mean ≤ quote and no single cycle &gt; quote + 2 %: mean ${f(st.mean, 1)} s, worst ${f(worst, 1)} s →
      <span class="${ok ? "rc-ok" : "rc-bad"}">${ok ? "PROVED" : "NOT proved"}</span>. Line output with 3 HMC in parallel = 3 × 3600 / ${f(st.mean, 1)} = <b>${f(3 * 3600 / st.mean, 1)} parts/h</b> (before OEE losses).
      Measure with a stopwatch or the CNC cycle timer from 'cycle start' to the next 'cycle start' (pallet change included), with the real program and feed override 100 %.</p>`;
    chipMist();
  }

  /* ================================================================ events */
  box.addEventListener("click", (e) => {
    const sg = e.target.closest("[data-isseg] .seg-btn");
    if (sg) {
      const name = sg.parentElement.dataset.isseg, v = sg.dataset.v;
      sg.parentElement.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("active", b === sg));
      if (name === "scope") { S.scope = v; plan(); }
      else if (name === "legs") { S.rig.n = +v; rig(); }
      else if (name === "skip") { S.skip = v === "1"; run(); }
      else if (name === "data") { S.data = v; accept(); }
      return;
    }
    const row = e.target.closest("[data-issel]");
    if (row && !e.target.closest("input")) { S.sel = row.dataset.issel; plan(); return; }
    const dd = e.target.closest("[data-isdd]");
    if (dd) { const t = R.by[S.sel]; S.dur[S.sel] = Math.max(0, Math.min(400, t.d + +dd.dataset.isdd)); plan(); return; }
    const go = e.target.closest("[data-isgo]");
    if (go) { const el = box.querySelector(`.is-chk[data-phase="${go.dataset.isgo}"]`); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (e.target.id === "isDurReset") { S.dur = {}; plan(); }
    if (e.target.id === "isChkReset") { CHK = {}; saveChk(); checklists(); }
    if (e.target.id === "isToComm") { const b = document.querySelector('.tab[data-tab="comm"]'); if (b) b.click(); }
  });
  box.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.chk) { if (el.checked) CHK[el.dataset.chk] = 1; else delete CHK[el.dataset.chk]; saveChk(); const p = X.PHASES.find((q) => q.id === el.dataset.chk.split(":")[0]); el.closest(".is-chk").innerHTML = chkHtml(p); progress(); return; }
    if (el.dataset.isdur) { const v = Math.max(0, Math.min(400, Math.round(+el.value || 0))); S.dur[el.dataset.isdur] = v; S.sel = el.dataset.isdur; plan(); return; }
    if (el.id === "isStart") { S.start = el.value || "2027-01-04"; plan(); return; }
    if (el.dataset.isair) { const [i, k] = el.dataset.isair.split(":"); S.air.cons[+i][k] = Math.max(0, +el.value || 0); air(); return; }
  });
  box.addEventListener("input", (e) => {
    const el = e.target, v = +el.value, id = el.id;
    const map = {
      isRm: () => { S.rig.m = Math.max(100, v || 0); rig(); }, isRth: () => { S.rig.theta = v; rig(); }, isRe: () => { S.rig.e = v; rig(); }, isRlp: () => { S.rig.Lp = Math.max(800, v || 0); rig(); },
      isRsp: () => { S.rig.spreader = el.checked; rig(); },
      isFq: () => { S.fk.Q = v || 0; rig(); }, isFc0: () => { S.fk.c0 = v || 0; rig(); }, isFx: () => { S.fk.x = v || 0; rig(); }, isFc: () => { S.fk.c = v || 0; rig(); },
      isAleak: () => { S.air.leak = v || 0; airCalc(); }, isAres: () => { S.air.reserve = v || 0; airCalc(); }, isAL: () => { S.air.L = Math.max(1, v || 0); airCalc(); }, isAeq: () => { S.air.eq = Math.max(0, v || 0); airCalc(); },
      isAd: () => { S.air.d = v; airCalc(); }, isApg: () => { S.air.pg = Math.max(0.1, v || 0); airCalc(); }, isAring: () => { S.air.ring = el.checked; airCalc(); },
      isCv: () => { S.cool.V = Math.max(1, v || 0); cool(); }, isCc: () => { S.cool.c = Math.min(30, Math.max(0.5, v || 0)); cool(); }, isCk: () => { S.cool.k = Math.max(0.1, v || 0); cool(); }, isCb: () => { S.cool.brix = Math.max(0, v || 0); cool(); },
      isChm: () => { S.chip.mChip = Math.max(0, v || 0); chipMist(); }, isChr: () => { S.chip.rho = Math.max(100, v || 0); chipMist(); },
      isMv: () => { S.mist.Venc = Math.max(0, v || 0); chipMist(); }, isMa: () => { S.mist.ach = Math.max(0, v || 0); chipMist(); },
      isQuote: () => { S.quote = Math.max(30, v || 0); cyc(); },
    };
    if (map[id]) map[id]();
  });

  plan(); checklists(); rig(); air(); cool(); run(); accept();
  return { S, plan: () => R };
}

/* ------------------------------------------------------------------ self test (&istest) – hand-checkable lines */
function selfTest() {
  const out = (s) => console.log("ISTEST " + s);
  const t0 = C.parseDate("2027-01-04");
  for (const sc of ["one", "line"]) {
    const r = C.cpm(C.buildTasks(sc));
    out(`cpm ${sc}: tasks=${r.tasks.length} end day=${r.end} end date=${C.finishDate(t0, r.end, 1)} HO EF=${r.by.HO.EF} DEL ES=${r.by.DEL.ES} FC TF=${r.by.FC.TF} FP LS=${r.by.FP.LS} (${C.fmtDate(C.addDays(t0, r.by.FP.LS))}) TRN TF=${r.by.TRN.TF} critical=${r.path.join(">")}`);
  }
  const r2 = C.cpm(C.buildTasks("one"), { MFG: 60 });
  out(`cpm one MFG=60: end day=${r2.end} DEL ES=${r2.by.DEL.ES} FC TF=${r2.by.FC.TF} critical=${r2.path.join(">")}`);
  const s = C.sling({ m: 12000, n: 4, theta: 30, e: 300, Lp: 2400 });
  out(`sling 12000kg n=4 θ=30 e=300 Lp=2400: W=${f(s.W, 3)}kN Feq=${f(s.Feq, 3)} F3=${f(s.F3, 3)} h=${f(s.h, 1)}mm θA=${f(s.thA, 2)} θB=${f(s.thB, 2)} FA/leg=${f(s.FA, 3)} FB/leg=${f(s.FB, 3)} H=${f(s.HA, 3)} band M=${s.bandM} tBand=${f(s.tBand, 2)} slingBand=${s.slingBand[0]}t safe=${s.slingSafe[0]}t design=${f(s.Fdesign, 3)}kN=${f(s.tReq, 3)}t sling=${s.slingWll[0]}t shackle=${s.shackle}t`);
  out(`hand sling: 117.72/(4*cos30)=${f(117.72 / (4 * Math.cos(Math.PI / 6)), 3)} 117.72/(3*cos30)=${f(117.72 / (3 * Math.cos(Math.PI / 6)), 3)} θ=60 n=4: ${f(117.72 / (4 * 0.5), 3)}`);
  const s2 = C.sling({ m: 12000, n: 4, theta: 30, e: 300, Lp: 2400, spreader: true });
  out(`sling spreader: FA/leg=${f(s2.FA, 3)} FB/leg=${f(s2.FB, 3)} top=${f(s2.Ftop, 3)}kN`);
  out(`forklift 16000@1200 x=700 c=1600: Qact=${f(C.forklift({}).Qact, 1)}kg`);
  const D = C.airDemand();
  const a32 = C.airDrop({ q: D.ls, L: 130, d: 32, pg: 7 }), a25 = C.airDrop({ q: D.ls, L: 130, d: 25, pg: 7 }), ar = C.airDrop({ q: D.ls, L: 130, d: 25, pg: 7, ring: true });
  out(`air: avg=${D.avg} design=${f(D.design, 1)}NL/min q=${f(D.ls, 3)}l/s ${f(D.m3h, 1)}m3/h | dp(32mm,130m,8.013bar)=${f(a32.dp, 4)}bar v=${f(a32.v, 2)} | dp(25mm)=${f(a25.dp, 4)} v=${f(a25.v, 2)} | ring 25mm=${f(ar.dp, 4)}`);
  out(`hand air: 450*20^1.85*100/(25^5*8)=${f(450 * Math.pow(20, 1.85) * 100 / (Math.pow(25, 5) * 8), 4)} bar`);
  const cl = C.coolant({ V: 800, c: 7, k: 1.1, brix: 3.8 });
  out(`coolant: conc=${f(cl.conc, 1)}L water=${f(cl.water, 1)}L read=${f(cl.readTarget, 3)}Bx now=${f(cl.cNow, 2)}% add=${f(cl.add, 2)}L | mist=${C.mist({ Venc: 6, ach: 5, n: 3 }).perMachine}m3/h | chips=${JSON.stringify(C.chips({}))}`);
  const g = C.runin(), b = C.runin(C.RUNIN, true);
  out(`runin: total=${g.total}min max=${f(g.max, 2)}K over=${g.over} | skipped max=${f(b.max, 2)}K over=${b.over}`);
  for (const k of ["A", "B", "C"]) { const c = C.capability(C.boreData(k)); out(`cap ${k}: n=${c.n} mean=${f(c.mean, 6)} s=${f(c.s * 1000, 4)}um min=${c.min} max=${c.max} Cm=${f(c.Cm, 3)} Cmk=${f(c.Cmk, 3)}`); }
  out(`cap A data: ${C.boreData("A").map((v) => v.toFixed(4)).join(" ")}`);
  const P = C.processCap(C.processData());
  out(`process: n=${P.n} mean=${f(P.mean, 6)} Rbar=${f(P.Rbar * 1000, 3)}um sw=${f(P.sw * 1000, 3)} s=${f(P.s * 1000, 3)} Cp=${f(P.Cp, 3)} Cpk=${f(P.Cpk, 3)} Pp=${f(P.Pp, 3)} Ppk=${f(P.Ppk, 3)}`);
  const cy = C.cycleData(); out(`cycle: ${cy.join(" ")} mean=${f(C.stats(cy).mean, 2)} max=${Math.max(...cy)}`);
  let st = "ok"; try { localStorage.getItem(KEY); } catch (e) { st = "blocked"; }
  out(`storage=${st} checklist items=${X.PHASES.reduce((s, p) => s + p.items.length, 0)}`);
  out(`errors=${errs.length ? errs.join(" | ") : "none"}`);
  out("DONE");
}

/* ------------------------------------------------------------------ lazy build on the first show of item 5 */
const box = $("inItem5");
let UI = null, tried = false;
function onShow(n) {
  if (!box || String(n) !== "5" || tried) return;
  tried = true;
  try { UI = build(box); } catch (e) { console.error(e); box.innerHTML = `<div class="card"><p class="rc-bad">Item 5 could not start: ${esc(e.message)}</p></div>`; }
  if (Q.get("iscard")) setTimeout(() => {
    const id = { plan: "isCardPlan", raci: "isCardRaci", progress: "isCardProgress", site: "isCardSite", rig: "isCardRig", util: "isCardUtil", comm: "isCardComm", accept: "isCardAccept", mistakes: "isCardMist", maker: "isCardMaker" }[Q.get("iscard")];
    const c = id && $(id); if (!c) return;
    let n = 0; const go = () => { if (box.offsetParent || n++ > 40) c.scrollIntoView(); else setTimeout(go, 200); }; go();
  }, 600);
}
window.addEventListener("initemshow", (e) => onShow(e.detail));
if (window.inCtl && window.inCtl.current() === "5") onShow("5");
if (Q.has("istest")) setTimeout(selfTest, 300);
if (Q.has("isback")) {
  const log = (s) => console.log("ISBACK " + s);
  const step = (fn, ms) => new Promise((res) => setTimeout(() => { fn(); res(); }, ms));
  (async () => {
    await step(() => {}, 1500);
    if (!window.inCtl) { log("no inCtl"); return; }
    await step(() => window.inCtl.showItem("1"), 10);
    await step(() => log(`item1 visible=${!$("inItem1").hidden} item5 hidden=${box.hidden} errors=${errs.length ? errs.join(" | ") : "none"}`), 800);
    await step(() => window.inCtl.showItem("5"), 10);
    await step(() => log(`item5 visible=${!box.hidden} built=${!!UI} gantt=${!!box.querySelector(".is-gsvg")} errors=${errs.length ? errs.join(" | ") : "none"}`), 800);
    await step(() => window.inCtl.showItem("2"), 10);
    await step(() => log(`item2 visible=${!$("inItem2").hidden} item5 hidden=${box.hidden}`), 800);
    await step(() => window.inCtl.showItem("5"), 10);
    await step(() => log(`item5 again visible=${!box.hidden} cards=${box.querySelectorAll(".is-card").length} errors=${errs.length ? errs.join(" | ") : "none"}`), 800);
  })();
}
window.inSeq = { ui: () => UI };
