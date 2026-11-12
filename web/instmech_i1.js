/* Installation tab – item 1 "Foundation, anchoring, vibration isolation" (builds #inItem1).
 * Cards: floor check · isolated block + drawing · mounting options · vibration isolation calculator · limits + survey · floor plan · maker questions.
 * Numbers: instmech_calc.js. Guide: docs/26_installation_foundation_alignment.md. All values are EXAMPLES. */
import { HMC, floorCheck, blockSize, sdof, trans, reaction, siteVib, attenuate } from "./instmech_calc.js";
import { $, esc, f, ok, card, num, sel, val, bindInfo, chart } from "./instmech_ui.js";

const Q = new URLSearchParams(location.search);
const CONC = [[25, "C25/30 (fck 25 MPa)"], [30, "C30/37 (fck 30 MPa)"], [35, "C35/45 (fck 35 MPa)"], [20, "C20/25 (fck 20 MPa) – too weak for most CNC"]];

/* info boxes of the foundation drawing + mounting table: [title, what, why, check, mistake] */
const INFO = {
  slab: ["Hall floor slab", "Reinforced concrete slab on the ground, example 250–300 mm, C25/30, two layers of mesh.", "Carries the machine weight and spreads the pad loads into the soil. Stiff slab = stable level.", "Thickness and concrete class from the as-built drawings or core drilling; look for cracks and old joints under the machine area.", "Assuming the floor is fine because 'it is new'. A 150 mm screed on insulation is NOT a machine floor."],
  block: ["Isolated foundation block", "A separate concrete block under one machine, separated from the slab by a joint all around.", "Mass and stiffness: vibrations from outside (and from the machine) are reduced, and the machine keeps its level even if the hall floor moves.", "Mass ≥ 1.5–3 × machine mass, concrete class, reinforcement, joint really free (no concrete bridges).", "Concrete bridges or screed poured over the joint – the isolation is lost completely."],
  joint: ["Isolation joint", "A gap of 20–50 mm all around the block, filled with a soft, closed-cell filler (PE foam, cork, mineral fibre board) and closed at the top with an elastic sealant.", "Stops vibration travelling through the slab into the block (and back). The sealant keeps coolant and chips out.", "Gap continuous to the bottom of the block; sealant intact; no steel plates or pipes bridging the joint.", "Hard filler (polystyrene crushes, wood swells), or a steel cover plate welded on both sides."],
  pad: ["Levelling pad + jack bolt", "Steel pad (example Ø 160 mm or 200 × 200 mm, 30–40 mm thick) under each levelling bolt; the bolt in the machine foot pushes on it.", "Spreads the bolt force (≈ 20–30 kN) on the concrete or grout, so the concrete is not crushed and the bolt does not 'walk'.", "Pad flat and fully supported (grout or bedded in mortar), pressure ≤ concrete design strength.", "Pad placed on dust or a loose piece of concrete → the machine loses its level after weeks."],
  anchor: ["Anchor bolt + sleeve", "Cast-in sleeve (or later a chemical / undercut anchor) for each foundation bolt, example M24, depth ≈ 10–12 × d.", "Holds the machine against inertia forces of the axes (F = m·a) and keeps it from 'walking' on the pads.", "Position ±5 mm (sleeves give some play), depth, anchor torque from the anchor maker, edge distance ≥ 5–10 × d.", "Drilling anchor holes into reinforcement or too close to the joint / slab edge → cracked edge."],
  grout: ["Grout", "Non-shrink flowable mortar poured under the machine feet / base plates after levelling: epoxy (example 90–110 MPa) or cementitious (example 50–70 MPa).", "Gives full contact between machine base and concrete → high stiffness, no settling, load spread.", "Surface rough + clean + dry (epoxy), formwork tight, thickness as data sheet (example 25–50 mm), cure before torque.", "Cement grout on a dry, dusty surface (no bond) or epoxy poured on a wet surface; tightening anchors before the grout has cured."],
  conduit: ["Cable conduits / floor channel", "Sleeves or a covered floor channel from the machine cabinet to the hall cable tray (power, PE, signal, network – separate).", "Cables must not lie on the floor (forklifts, coolant). Planned BEFORE the concrete is poured.", "Diameter with 40 % spare, bending radius, separate power and signal (item 4), drain at the low point.", "Forgetting the sleeves → later core drilling through the new block and its reinforcement."],
  coolant: ["Coolant / air pipe sleeve", "Sleeve for compressed-air and coolant (central system) pipes, sloped return.", "Pipes stay protected; leaks do not go into the joint.", "Slope ≥ 1 %, sealed, separated from electrical conduits.", "Pipe passing through the isolation joint rigidly → vibration bridge."],
  trench: ["Chip trench (optional)", "Covered trench in the floor for a central chip conveyor (crankcases in cast iron / aluminium make many chips).", "Chips are removed without carts; the hall stays clean.", "Depth, slope, covers loadable for forklifts, separation from the foundation block (own joint).", "Trench too close to the block → the block edge is weakened, or the trench wall carries the machine."],
  blind: ["Blinding + gravel", "50 mm lean concrete (blinding) on 200–300 mm compacted gravel, PE sheet in between as separation and moisture barrier.", "A clean, flat working surface for the reinforcement; compacted base = no settling.", "Compaction test (plate-load test, example Ev2 ≥ 80–100 MN/m²), level of the blinding.", "Pouring on soft, wet soil or on unfrozen-then-frozen ground."],
  rebar: ["Reinforcement", "Two meshes (top + bottom), example Ø12–16 @ 150–200 mm, 40–50 mm cover; extra bars at the edges and around sleeves.", "Takes bending and shrinkage tension; limits cracks.", "Bar size, spacing, cover (spacers!), laps — checked and photographed before the pour.", "Mesh lying on the bottom (no spacers) → it does nothing; no extra bars around the sleeves → cracks."],
  rigid: ["Anchored + grouted", "Machine on levelling bolts / wedges, then grouted and anchored to the floor.", "Highest stiffness: best for machines with heavy, fast axes (HMC, big VMC, lathes).", "Level before grouting; anchor torque after curing; re-check level.", "Grouting before the final level → hard to correct later."],
  levbolt: ["Levelling bolts on steel pads", "Jack bolts in the machine feet on loose or bedded steel pads (often plus anchors).", "Easy to re-level, quick install; standard for most machining centres.", "Pads bedded, bolts locked, level re-checked after 1 week / 1 month.", "Pads on unprepared floor; no lock nut."],
  avm: ["Anti-vibration levelling mounts", "Levelling mounts with rubber / elastomer pads (natural frequency example 10–25 Hz).", "Cuts high-frequency vibration in and out, no drilling; good for light machines and measuring devices on a quiet floor.", "Static deflection, load per mount within range, natural frequency far below disturbing frequency.", "Using soft mounts under a machine with fast heavy axes → it rocks, poor surface finish and settling time."],
  spring: ["Spring isolators / air springs", "Steel springs with viscous dampers, or air springs, under an inertia block (example f_n 2–6 Hz).", "Strong isolation for presses, hammers (vibration OUT) and precision grinders / CMM (vibration IN).", "Deflection, damper, levelling valves (air springs), seismic stops.", "No damping → large motion at start-up when passing the resonance."],
};

export function buildItem1(box) {
  const cfgMachines = [{ id: "HMC-01", x: -23.3, y: -21.2 }, { id: "HMC-02", x: -23.3, y: -16.4 }, { id: "HMC-03", x: -23.3, y: -11.6 }];
  const others = [{ id: "LOAD-CC", x: -29.6, y: -12, w: 3, d: 3 }, { id: "WASH-01", x: -14, y: -16, w: 5, d: 3 }];
  box.innerHTML = [
    card("imFloor", "1.1 Floor requirements – can the slab carry the machine?", "HMC 500 example · live check · values are examples, the structural engineer and the maker decide", {
      what: "The hall floor (concrete slab on the ground) must carry the weight of the machine and its accessories, keep the level for years and not crack under the levelling pads.",
      why: "A CNC machine is only as accurate as the floor it stands on. A floor that settles or bends by 0.1 mm over the machine length tilts the bed by 0.02–0.03 mm/m – the full levelling tolerance.",
      how: "1) Get the slab data (thickness, concrete class, reinforcement – drawings or core drilling). 2) Calculate the loads: total weight, the highest pad load, local pressure under the pad, punching, ground pressure. 3) Compare with the maker's foundation drawing. 4) Check flatness.",
      check: "Slab ≥ maker minimum (example 250–300 mm), concrete ≥ C25/30, pressure under a pad ≤ f_cd, floor flat to DIN 18202 table 3 line 3/4 under the machine.",
      mistake: "Placing the machine across an existing slab joint or crack, or on a floor with heating pipes / insulation under it." }, floorBody()),
    card("imBlock", "1.2 Isolated foundation block – when it is needed and how it is built", "drawing for the HMC 500 example – click a part for details", {
      what: "A separate reinforced concrete block under one machine, cut free from the hall slab by an isolation joint.",
      why: "Needed when the slab is too thin / weak, when strong vibration sources are near (press, compressor, forklift road), for precision machines (grinder, CMM), or when the maker asks for it.",
      how: "Size the block (mass ≥ 1.5–3 × machine mass), cast the sleeves and conduits in, cure (28 days for full strength, at least 7 days and ≥ 70 % strength before loading – check with the concrete supplier), place the machine, level, grout, anchor.",
      check: "Joint continuous and soft, concrete cube / cylinder results, sleeve positions vs maker drawing ±5 mm, top level ±5 mm.",
      mistake: "Loading the block after 3 days, or a 'joint' that is only cut 30 mm deep into the top – the slab is still connected below." }, blockBody()),
    card("imMount", "1.3 Mounting options compared", "which mounting for which machine", {
      what: "How the machine stands on the floor: rigidly anchored and grouted, on levelling bolts with steel pads, on rubber anti-vibration mounts, or on springs / air springs.",
      why: "The mounting decides stiffness (accuracy under fast axis moves) and isolation (vibration in and out). You cannot have both: soft = isolates, stiff = accurate under dynamic loads.",
      how: "HMC with a heavy moving column → rigid (levelling bolts + steel pads, optionally anchored + grouted). Precision grinder near a press → isolated block or isolators. Press → on spring isolators / its own block (keep vibration IN the press).",
      check: "Maker's recommendation first; vibration survey result (1.5); natural frequency of soft mounts vs disturbing frequencies (1.4).",
      mistake: "Putting a fast HMC on soft rubber mounts to 'protect' it – it rocks with every axis reversal (see the rocking check in 1.4)." }, mountBody()),
    card("imVib", "1.4 Vibration – sources and isolation calculator (1 degree of freedom)", "live · chart = transmissibility T against frequency ratio r", {
      what: "Vibration comes IN (neighbour press, compressor, forklift, other machines) and goes OUT (axis reversals F = m·a, spindle unbalance). A mass on a spring isolates only above its natural frequency.",
      why: "Floor vibration makes chatter marks, poor surface finish, wrong measurements and spindle bearing damage. Wrong isolation can make it WORSE (resonance).",
      how: "f_n = (1/2π)·√(k/m); static deflection δ = m·g/k → f_n ≈ 15.76/√δ[mm] Hz; r = f/f_n; T = √(1+(2ζr)²) / √((1−r²)² + (2ζr)²). Isolation only when r > √2 (≈ 1.41); good isolation needs r ≥ 3.",
      check: "f_n of the mounted machine ≤ disturbing frequency / 3; no excitation near r = 1; rocking under axis acceleration acceptable.",
      mistake: "Rubber mounts with f_n = 15 Hz used against a 12 Hz piston compressor: r = 0.8 → T ≈ 2.5, the vibration is amplified." }, vibBody()),
    card("imLimits", "1.5 Vibration limits and the site vibration survey", "measure before the machine comes", {
      what: "Two different things: (a) the vibration of the machine itself (bearing housings, ISO 10816-3 / ISO 20816-3 zones), (b) the vibration of the FLOOR where the machine will stand (maker's limit, example ≤ 0.5–1 mm/s RMS).",
      why: "If the floor is already too 'loud', no levelling helps. The survey is cheap (1 day); a new foundation after installation is very expensive.",
      how: "Velocity sensor (or accelerometer + integration) on the floor at the planned machine position, 3 directions, 1–200 Hz (example), mm/s RMS + peak + spectrum, over a full shift (press running, forklifts, compressor starting).",
      check: "Background ≤ maker limit (example < 0.5 mm/s for precision machines, < 1 mm/s for general machining); dominant frequencies known.",
      mistake: "Measuring on Sunday when the press and compressors are off." }, limBody()),
    card("imPlan", "1.6 Floor plan – vibration sources around the crankcase line", "drag the sources · SIMPLE model (good for comparing positions, not for design) · HMC positions from config/factory.json", {
      what: "Top view of the crankcase cell with HMC-01/02/03 (4.8 m pitch). You can move vibration sources and see the floor vibration at each HMC.",
      why: "Distance is the cheapest isolation. Placing the compressor room or a press 10 m further away can save a foundation block.",
      how: "Simple model (Bornitz): v(r) = v₀·(1/r)^0.5·e^(−α(r−1)), r in m, v₀ = level at 1 m. Joints / isolated block multiply by a factor. Several sources: v = √(Σ vᵢ²).",
      check: "Every machine ≤ its floor limit; real decision only with a vibration survey (1.5) and a specialist.",
      mistake: "Trusting a simple model for a real decision – soil layers, slab joints and resonances can change the result by a factor of 3." }, planBody()),
    card("imAsk", "1.7 What to check with the machine maker and the builder", "questions before the order and before the pour", null, askBody()),
  ].join("");

  /* ------------------------------------------------ 1.1 floor check */
  const fIds = ["imMm", "imMt", "imMa", "imMp", "imMc", "imMch", "imPadD", "imKu", "imSlab", "imFck", "imQf", "imQs"];
  function floorP() {
    return { mMachine: val("imMm"), mTableLoad: val("imMt"), mApc: val("imMa"), mPallet2: val("imMp"), mCoolant: val("imMc"), mChip: val("imMch"),
      nPads: 6, padD: val("imPadD"), kUneven: val("imKu"), slabH: val("imSlab"), fck: val("imFck"), qFloor: val("imQf"), qSoil: val("imQs"), slabMin: 250,
      footL: HMC.footL, footW: HMC.footW };
  }
  function renderFloor() {
    const p = floorP(), r = floorCheck(p);
    $("imFloorRes").innerHTML = `<table class="im-tbl"><tr><th>Check</th><th>Formula</th><th>Result (example)</th><th></th></tr>
      <tr><td>Total weight</td><td>W = Σm · g</td><td>${f(r.mTotal, 0)} kg · 9.81 = <b>${f(r.W, 1)} kN</b></td><td></td></tr>
      <tr><td>Load on the 6 bed pads</td><td>(m_machine + m_table) · g</td><td>${f(r.mPads, 0)} kg → ${f(r.Wpads, 1)} kN</td><td></td></tr>
      <tr><td>Highest pad load</td><td>F_pad = k_uneven · W_pads / 6</td><td>${f(p.kUneven, 2)} · ${f(r.Wpads, 1)} / 6 = <b>${f(r.Fpad, 1)} kN</b></td><td></td></tr>
      <tr><td>Pressure under the pad</td><td>p = F_pad / A_pad ≤ f_cd = 0.85·f_ck/1.5</td><td>${f(r.Fpad, 1)} kN / ${f(r.Apad * 1e4, 0)} cm² = <b>${f(r.pPad, 2)} MPa</b> ≤ ${f(r.fcd, 1)} MPa</td><td>${ok(r.padOk)}</td></tr>
      <tr><td>Average floor load</td><td>q = W / (L·B) ≤ rated floor load</td><td>${f(r.W, 1)} / ${f(r.Afoot, 2)} m² = <b>${f(r.qFoot, 1)} kN/m²</b> ≤ ${f(p.qFloor, 0)}</td><td>${ok(r.floorOk)}</td></tr>
      <tr><td>Punching under the pad</td><td>v = F/(u₁·d), u₁ = 2π(a+2d) ≤ v_Rd = 0.035·k^1.5·√f_ck</td><td>d = ${f(r.d * 1000, 0)} mm, u₁ = ${f(r.u1, 2)} m → <b>${f(r.vEd, 3)} MPa</b> ≤ ${f(r.vRd, 3)} MPa</td><td>${ok(r.punchOk)}</td></tr>
      <tr><td>Ground pressure</td><td>(W + slab weight) / A_eff, A_eff = (L+2h)(B+2h)</td><td>(${f(r.W, 1)} + ${f(r.slabW, 1)}) / ${f(r.Aeff, 2)} = <b>${f(r.qGround, 1)} kPa</b> ≤ ${f(p.qSoil, 0)}</td><td>${ok(r.groundOk)}</td></tr>
      <tr><td>Slab thickness</td><td>h ≥ maker minimum (example 250 mm)</td><td><b>${f(p.slabH, 0)} mm</b></td><td>${ok(r.slabMinOk)}</td></tr></table>
      <p class="im-note">Simplified checks for a first look (45° load spread, punching without shear reinforcement, k_uneven covers unequal pad loads and dynamic loads). The real slab design is done by a structural engineer to EN 1992-1-1 / TR34 (slabs on ground). Usually the <b>flatness and stiffness</b> of the floor decide, not the strength: the numbers above are often far from the limit.</p>`;
    return r;
  }
  fIds.forEach((id) => $(id).addEventListener("input", renderFloor));

  /* ------------------------------------------------ 1.2 block */
  function renderBlock() {
    const b = blockSize({ ratio: val("imRatio"), mMachine: HMC.mMachine + HMC.mTableLoad, footL: HMC.footL, footW: HMC.footW, margin: val("imMarg") / 1000, rho: 2400, hMin: val("imHmin") / 1000, qSoil: val("imQs") });
    $("imRatioV").textContent = f(val("imRatio"), 1) + " ×";
    $("imBlockRes").innerHTML = `<table class="im-tbl"><tr><th>Step</th><th>Formula</th><th>Result (example)</th></tr>
      <tr><td>Block mass needed</td><td>m_block = ratio · m_machine</td><td>${f(val("imRatio"), 1)} · ${HMC.mMachine + HMC.mTableLoad} kg = <b>${f(b.mBlock / 1000, 1)} t</b></td></tr>
      <tr><td>Plan size</td><td>(L + 2·margin) × (B + 2·margin)</td><td>${f(b.L, 2)} m × ${f(b.B, 2)} m = ${f(b.A, 2)} m²</td></tr>
      <tr><td>Depth</td><td>H = m_block / (ρ·A), ρ = 2400 kg/m³, ≥ min, rounded up 50 mm</td><td>${f(b.Hcalc, 3)} m → <b>H = ${f(b.H, 2)} m</b></td></tr>
      <tr><td>Real block</td><td>V = A·H</td><td>${f(b.V, 1)} m³ = ${f(b.mReal / 1000, 1)} t = ${f(b.ratioReal, 2)} × machine</td></tr>
      <tr><td>Soil pressure</td><td>(m_block + m_machine)·g / A</td><td><b>${f(b.qSoil, 1)} kPa</b> ≤ ${f(val("imQs"), 0)} kPa ${ok(b.soilOk)}</td></tr></table>`;
    $("imFoundSvg").innerHTML = foundationSvg(b);
    return b;
  }
  ["imRatio", "imMarg", "imHmin", "imQs"].forEach((id) => $(id).addEventListener("input", renderBlock));
  bindInfo($("imBlock"), INFO, "imInfo1", Q.get("iminfo") || "joint");
  bindInfo($("imMount"), INFO, "imInfo2", "levbolt");

  /* ------------------------------------------------ 1.4 vibration */
  const PRE = { hmcRigid: [12510, 6000, 0.05], hmcAvm: [12510, 150, 0.08], grinder: [8000, 80, 0.08], press: [25000, 24.5, 0.05] };
  $("imPre").addEventListener("change", () => { const p = PRE[$("imPre").value]; if (!p) return; $("imVm").value = p[0]; $("imVk").value = p[1]; $("imVz").value = p[2]; syncDelta(); renderVib(); });
  $("imSrcF").addEventListener("change", () => { const v = parseFloat($("imSrcF").value); if (v) { $("imVf").value = v; renderVib(); } });
  function syncDelta() { const m = val("imVm"), k = val("imVk"); $("imVd").value = (m * 9.81 / (k * 1000)).toFixed(3); }
  $("imVd").addEventListener("input", () => { const d = val("imVd"), m = val("imVm"); if (d > 0) { $("imVk").value = (m * 9.81 / (d * 1000)).toFixed(2); renderVib(); } });
  ["imVm", "imVk"].forEach((id) => $(id).addEventListener("input", () => { syncDelta(); renderVib(); }));
  ["imVz", "imVf"].forEach((id) => $(id).addEventListener("input", renderVib));
  function renderVib() {
    const m = val("imVm"), k = val("imVk"), z = val("imVz"), fq = val("imVf");
    const s = sdof(m, k, z, fq);
    const pts = [], ref = [];
    for (let r = 0.05; r <= 5.001; r += 0.025) { pts.push([r, trans(r, z)]); ref.push([r, trans(r, 0.3)]); }
    $("imVibChart").innerHTML = chart({ w: 560, h: 280, xr: [0, 5], yr: [0.01, 20], ylog: true, xt: [0, 1, 1.41, 2, 3, 4, 5], yt: [0.01, 0.1, 1, 10],
      bands: [{ x0: Math.SQRT2, x1: 5, cls: "im-band", label: "isolation (r > √2)" }], hl: [{ y: 1, cls: "im-ref" }],
      series: [{ pts, cls: "im-s1", name: `ζ = ${f(z, 2)} (your mount)` }, { pts: ref, cls: "im-s2", name: "ζ = 0.30 (reference)" }],
      marks: [{ x: Math.min(5, s.r), y: s.T, cls: s.isolates ? "im-mk-ok" : "im-mk-bad", label: `r = ${f(s.r, 2)}, T = ${f(s.T, 3)}` }],
      xlabel: "frequency ratio r = f / f_n", ylabel: "transmissibility T (log)", title: "Transmissibility" });
    $("imVibRes").innerHTML = `<table class="im-tbl"><tr><td>Stiffness</td><td>k = ${f(k, 2)} kN/mm = ${f(s.k / 1e6, 2)}·10⁶ N/m</td></tr>
      <tr><td>Natural frequency</td><td>f_n = (1/2π)·√(k/m) = (1/2π)·√(${f(s.k, 0)} / ${f(m, 0)}) = <b>${f(s.fn, 2)} Hz</b></td></tr>
      <tr><td>Static deflection</td><td>δ = m·g/k = <b>${f(s.delta, 3)} mm</b> → f_n ≈ 15.76/√δ = ${f(s.fnDelta, 2)} Hz</td></tr>
      <tr><td>Frequency ratio</td><td>r = f / f_n = ${f(fq, 1)} / ${f(s.fn, 2)} = <b>${f(s.r, 3)}</b></td></tr>
      <tr><td>Transmissibility</td><td>T = <b>${f(s.T, 3)}</b> → ${s.T < 1 ? `isolation ${f(s.iso, 0)} % (only ${f(s.T * 100, 1)} % passes)` : `<span class="im-badt">AMPLIFIED ${f(s.T, 2)} ×</span>`}</td></tr>
      <tr><td>Verdict</td><td>${s.r > 3 ? ok(true, "good isolation (r ≥ 3)") : s.isolates ? ok(true, "some isolation (√2 < r < 3)") : s.r > 0.7 ? ok(false, "", "NEAR RESONANCE – avoid") : `<span class="im-chip im-mid">rigid range (r < 0.7) – no isolation, the floor motion passes through</span>`}</td></tr></table>`;
    return s;
  }
  function renderReact() {
    const r = reaction({ m: val("imRm"), accG: val("imRa"), h: val("imRh"), span: val("imRs"), perSide: 3, kPad: val("imRk"), rotor: val("imRr"), G: val("imRg"), rpm: HMC.rpm });
    $("imReactRes").innerHTML = `<table class="im-tbl"><tr><td>Inertia force of the column</td><td>F = m·a = ${f(val("imRm"), 0)} · ${f(val("imRa"), 2)} · 9.81 = <b>${f(r.F / 1000, 2)} kN</b> (horizontal, at every axis start / stop)</td></tr>
      <tr><td>Rocking moment</td><td>M = F · h = ${f(r.F / 1000, 2)} kN · ${f(val("imRh"), 2)} m = <b>${f(r.M / 1000, 2)} kN·m</b></td></tr>
      <tr><td>Pad force change</td><td>ΔF = M / span / 3 pads = <b>± ${f(r.dFpad / 1000, 2)} kN per pad</b> (static ≈ 20 kN)</td></tr>
      <tr><td>Pad deflection change</td><td>Δz = ΔF / k_pad = <b>${f(r.dz * 1000, 2)} µm</b></td></tr>
      <tr><td>Rocking tilt</td><td>2·Δz / span = <b>${f(r.tilt, 4)} mm/m</b> → at 1 m above the pads ≈ ${f(r.tilt, 3)} mm motion ${r.tilt > 0.01 ? ok(false, "", "too soft for this machine") : ok(true, "stiff enough")}</td></tr>
      <tr><td>Spindle unbalance (balance grade G ${f(val("imRg"), 1)})</td><td>e·ω = G → F = m·e·ω² = ${f(val("imRr"), 0)} kg · ${f(val("imRg") / (2 * Math.PI * HMC.rpm / 60) * 1000, 2)} µm · (${f(2 * Math.PI * HMC.rpm / 60, 0)} rad/s)² = <b>${f(r.unb, 1)} N</b> at ${HMC.rpm / 60} Hz (small, but it runs for hours)</td></tr></table>`;
    return r;
  }
  ["imRm", "imRa", "imRh", "imRs", "imRk", "imRr", "imRg"].forEach((id) => $(id).addEventListener("input", renderReact));

  /* ------------------------------------------------ 1.6 floor plan */
  const SRC = {
    press: { name: "Mechanical press 250 t", v0: 12, cls: "press", fq: "10–40 Hz impacts" },
    pcomp: { name: "Piston compressor", v0: 4, cls: "comp", fq: "12 Hz (740 rpm)" },
    scomp: { name: "Screw compressor on mounts", v0: 0.8, cls: "comp", fq: "50 Hz" },
    fork: { name: "Forklift on a slab joint", v0: 3, cls: "fork", fq: "5–15 Hz bumps" },
    hammer: { name: "Forging hammer (extreme)", v0: 40, cls: "press", fq: "5–20 Hz shocks" },
  };
  let sources = [
    { id: "S1", type: "pcomp", x: -32.5, y: -23.5 },
    { id: "S2", type: "fork", x: -18.5, y: -10.5 },
    { id: "S3", type: "scomp", x: -31, y: -8.5 },
  ];
  if (Q.get("imsrc")) sources = Q.get("imsrc").split(";").map((t, i) => { const [ty, x, y] = t.split(","); return { id: "S" + (i + 1), type: SRC[ty] ? ty : "press", x: +x, y: +y }; });
  const PV = { x0: -36, x1: -6, y0: -26, y1: -6, sc: 30 }; // m → px
  const px = (x) => (x - PV.x0) * PV.sc, py = (y) => (y - PV.y0) * PV.sc;
  function renderPlan() {
    const alpha = val("imAlpha"), jf = val("imJoint"), lim = val("imVLim");
    const res = siteVib(cfgMachines, sources.map((s) => ({ ...s, v0: SRC[s.type].v0 })), alpha, jf);
    const W = (PV.x1 - PV.x0) * PV.sc, H = (PV.y1 - PV.y0) * PV.sc;
    let s = `<svg id="imPlanSvg" class="im-plan" viewBox="-10 -10 ${W + 20} ${H + 20}" role="img" aria-label="floor plan">`;
    s += `<rect class="im-zone" x="${px(-34)}" y="${py(-24.6)}" width="${26 * PV.sc}" height="${15 * PV.sc}"/><text class="im-tk" x="${px(-34) + 6}" y="${py(-24.6) + 14}">CRANKCASE CELL (FMS)</text>`;
    for (let x = -35; x <= -7; x += 5) s += `<line class="im-grid" x1="${px(x)}" x2="${px(x)}" y1="0" y2="${H}"/><text class="im-tk" x="${px(x) + 2}" y="${H - 3}">x ${x}</text>`;
    for (let y = -25; y <= -7; y += 5) s += `<line class="im-grid" x1="0" x2="${W}" y1="${py(y)}" y2="${py(y)}"/><text class="im-tk" x="3" y="${py(y) - 3}">y ${y}</text>`;
    // distance rings (where a source of the selected type reaches the limit) for each source
    sources.forEach((so) => { const v0 = SRC[so.type].v0; let r = 1; while (r < 80 && attenuate(v0, r, alpha) * jf > lim) r += 0.25; s += `<circle class="im-ring" cx="${px(so.x)}" cy="${py(so.y)}" r="${r * PV.sc}"/>`; });
    others.forEach((o) => { s += `<rect class="im-oth" x="${px(o.x - o.w / 2)}" y="${py(o.y - o.d / 2)}" width="${o.w * PV.sc}" height="${o.d * PV.sc}"/><text class="im-tk" x="${px(o.x)}" y="${py(o.y) + 4}" text-anchor="middle">${o.id}</text>`; });
    res.forEach((r, i) => { const m = cfgMachines[i], good = r.v <= lim;
      s += `<rect class="im-mach ${good ? "im-mach-ok" : "im-mach-bad"}" x="${px(m.x - HMC.footL / 2)}" y="${py(m.y - HMC.footW / 2)}" width="${HMC.footL * PV.sc}" height="${HMC.footW * PV.sc}" rx="3"/>`;
      if (jf < 0.99) s += `<rect class="im-jointr" x="${px(m.x - HMC.footL / 2 - 0.4)}" y="${py(m.y - HMC.footW / 2 - 0.4)}" width="${(HMC.footL + 0.8) * PV.sc}" height="${(HMC.footW + 0.8) * PV.sc}" rx="2"/>`;
      s += `<text class="im-tl" x="${px(m.x)}" y="${py(m.y) - 2}" text-anchor="middle">${m.id}</text><text class="im-tk" x="${px(m.x)}" y="${py(m.y) + 13}" text-anchor="middle">${f(r.v, 2)} mm/s ${good ? "✓" : "✗"}</text>`; });
    sources.forEach((so) => { const t = SRC[so.type];
      s += `<g class="im-src im-src-${t.cls}" data-src="${so.id}" transform="translate(${px(so.x)} ${py(so.y)})"><circle r="11"/><text y="4" text-anchor="middle">${so.id.slice(1)}</text></g><text class="im-tk" x="${px(so.x) + 14}" y="${py(so.y) - 8}">${esc(t.name)}</text>`; });
    s += `<line class="im-dim" x1="${px(-20)}" x2="${px(-20)}" y1="${py(-21.2)}" y2="${py(-16.4)}"/><text class="im-tk" x="${px(-20) + 4}" y="${py(-18.8)}">4.8 m pitch</text>`;
    s += "</svg>";
    $("imPlanBox").innerHTML = s;
    $("imPlanRes").innerHTML = `<table class="im-tbl"><tr><th>Machine</th>${sources.map((so) => `<th>${so.id} ${esc(SRC[so.type].name)}<br><span class="sub">v₀ = ${SRC[so.type].v0} mm/s @ 1 m</span></th>`).join("")}<th>Total √Σv²</th><th>Limit</th><th></th></tr>
      ${res.map((r) => `<tr><td><b>${r.id}</b></td>${r.parts.map((p) => `<td>r = ${f(p.r, 1)} m → ${f(p.v, 3)}</td>`).join("")}<td><b>${f(r.v, 3)} mm/s</b></td><td>${f(lim, 2)}</td><td>${ok(r.v <= lim, "PASS", "FAIL")}</td></tr>`).join("")}</table>
      <p class="im-note">Dashed rings = distance at which each source alone falls below the limit. Sources: ${sources.map((so) => `<span class="im-srcrow">${so.id} ${esc(SRC[so.type].name)} (${SRC[so.type].fq}) <button class="im-mini" data-del="${so.id}">remove</button></span>`).join(" ")}</p>`;
    bindDrag();
    return res;
  }
  function bindDrag() {
    const svg = $("imPlanSvg"); if (!svg) return;
    svg.querySelectorAll("[data-src]").forEach((g) => {
      g.addEventListener("pointerdown", (ev) => {
        ev.preventDefault(); const id = g.dataset.src; const so = sources.find((x) => x.id === id);
        const move = (e) => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse());
          so.x = Math.max(PV.x0 + 0.5, Math.min(PV.x1 - 0.5, PV.x0 + p.x / PV.sc)); so.y = Math.max(PV.y0 + 0.5, Math.min(PV.y1 - 0.5, PV.y0 + p.y / PV.sc));
          const gg = $("imPlanSvg").querySelector(`[data-src="${id}"]`); if (gg) gg.setAttribute("transform", `translate(${px(so.x)} ${py(so.y)})`); };
        const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); renderPlan(); };
        window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
      });
    });
  }
  $("imPlanRes").addEventListener("click", (e) => { const b = e.target.closest("[data-del]"); if (b) { sources = sources.filter((s) => s.id !== b.dataset.del); renderPlan(); } });
  $("imAddSrc").addEventListener("click", () => { const t = $("imSrcType").value; let n = 1; while (sources.some((s) => s.id === "S" + n)) n++; sources.push({ id: "S" + n, type: t, x: -20 + (n % 3) * 3, y: -8 }); renderPlan(); });
  ["imAlpha", "imJoint", "imVLim"].forEach((id) => $(id).addEventListener("change", renderPlan));

  // HMC + neighbour positions from config/factory.json (falls back to the values above when offline / no server)
  fetch("/api/config").then((r) => r.json()).then((cfg) => {
    const byId = Object.fromEntries((cfg.stations || []).map((x) => [x.id, x]));
    [...cfgMachines, ...others].forEach((m) => { const c = byId[m.id]; if (c && Array.isArray(c.pos)) { m.x = c.pos[0]; m.y = c.pos[1]; } });
    st.plan = renderPlan();
  }).catch(() => {});
  const st = { floor: renderFloor(), block: renderBlock(), vib: (syncDelta(), renderVib()), react: renderReact(), plan: renderPlan() };

  if (Q.has("imtest")) setTimeout(() => selfTest1(), 150);
  function selfTest1() {
    const out = (s) => console.log("IMTEST1 " + s);
    const r = floorCheck({ mMachine: 12000, mTableLoad: 510, mApc: 1500, mPallet2: 510, mCoolant: 1050, mChip: 600, nPads: 6, padD: 160, kUneven: 1.5, slabH: 300, fck: 25, qFloor: 20, qSoil: 150, slabMin: 250, footL: 5.2, footW: 2.8 });
    out(`floor: W=${f(r.W, 2)} kN (16170 kg·9.81=158.63) Fpad=${f(r.Fpad, 2)} kN (1.5·12510·9.81/6000=30.68) p=${f(r.pPad, 3)} MPa (30.68/0.020106 m²=1.526) fcd=${f(r.fcd, 2)} (14.17) q=${f(r.qFoot, 2)} kN/m² (158.63/14.56=10.89)`);
    out(`punch: d=${r.d} u1=${f(r.u1, 3)} m (2π(0.08+0.5)=3.644) vEd=${f(r.vEd, 4)} MPa (30.68/(3.644·0.25)/1000=0.0337) k=${f(r.k, 3)} (1+√0.8=1.894) vRd=${f(r.vRd, 3)} (0.035·1.894^1.5·5=0.456) ground=${f(r.qGround, 2)} kPa ((158.63+147.9)/19.72=15.54)`);
    const b = blockSize({ ratio: 2, mMachine: 12510, footL: 5.2, footW: 2.8, margin: 0.3, rho: 2400, hMin: 0.6, qSoil: 150 });
    out(`block: m=${f(b.mBlock, 0)} kg A=${f(b.A, 2)} m² (5.8·3.4=19.72) Hcalc=${f(b.Hcalc, 3)} m (25020/2400/19.72=0.529) H=${f(b.H, 2)} (min 0.6) mReal=${f(b.mReal, 0)} ratio=${f(b.ratioReal, 2)} qSoil=${f(b.qSoil, 2)} kPa`);
    const s = sdof(12510, 150, 0.08, 50);
    out(`sdof: delta=${f(s.delta, 4)} mm (12510·9.81/150000=0.8182) fn=${f(s.fn, 3)} Hz (√(150e6/12510)/2π=17.428) fnDelta=${f(s.fnDelta, 3)} r=${f(s.r, 4)} T=${f(s.T, 4)} (hand 0.1519) iso=${f(s.iso, 1)} %`);
    const s2 = sdof(8000, 80, 0.08, 12.3);
    out(`sdof grinder vs piston compressor: fn=${f(s2.fn, 2)} r=${f(s2.r, 3)} T=${f(s2.T, 3)} (amplified)`);
    out(`T(r=1,ζ=0.05)=${f(trans(1, 0.05), 3)} (hand √(1+0.01)/0.1=10.05) T(√2)=${f(trans(Math.SQRT2, 0.1), 4)} (=1) T(3,0)=${f(trans(3, 0), 4)} (1/8=0.125)`);
    const rc = reaction({ m: 1800, accG: 0.6, h: 1.4, span: 2.2, perSide: 3, kPad: 1000, rotor: 25, G: 2.5, rpm: 6000 });
    const rc2 = reaction({ m: 1800, accG: 0.6, h: 1.4, span: 2.2, perSide: 3, kPad: 25, rotor: 25, G: 2.5, rpm: 6000 });
    out(`reaction: F=${f(rc.F, 1)} N (1800·0.6·9.81=10594.8) M=${f(rc.M, 1)} dFpad=${f(rc.dFpad, 1)} N (14832.7/2.2/3=2247.4) tilt rigid=${f(rc.tilt, 5)} mm/m rubber=${f(rc2.tilt, 4)} mm/m unbalance=${f(rc.unb, 2)} N (25·3.979e-6·628.32²=39.27)`);
    out(`attenuate: v(8 m, α 0.05, 12 mm/s)=${f(attenuate(12, 8, 0.05), 3)} (12·0.3536·e^-0.35=2.990) v(20 m)=${f(attenuate(12, 20, 0.05), 3)} (12·0.2236·e^-0.95=1.038)`);
    out(`plan default: ${st.plan.map((x) => x.id + "=" + f(x.v, 3)).join(" ")} limit=${val("imVLim")}`);
  }
  return { st, renderPlan };
}

/* ================================================================== bodies */
function floorBody() {
  return `<div class="im-grid2"><div><h3>Inputs (example HMC 500)</h3><div class="im-ins">
    ${num("imMm", "machine mass", HMC.mMachine, 100, "kg")}${num("imMt", "pallet + workpiece on table", HMC.mTableLoad, 10, "kg")}
    ${num("imMa", "pallet changer (APC)", HMC.mApc, 50, "kg")}${num("imMp", "2nd pallet + workpiece", HMC.mPallet2, 10, "kg")}
    ${num("imMc", "coolant tank 800 L, full", HMC.mCoolant, 50, "kg")}${num("imMch", "chip conveyor", HMC.mChip, 50, "kg")}
    ${num("imPadD", "levelling pad diameter", 160, 10, "mm")}${num("imKu", "uneven + dynamic factor", 1.5, 0.1, "–", "highest pad / average pad, incl. dynamic loads (example 1.5)")}
    ${num("imSlab", "slab thickness h", 300, 10, "mm")}${sel("imFck", "concrete class", CONC, 25)}
    ${num("imQf", "rated floor load (uniform)", 20, 1, "kN/m²")}${num("imQs", "allowable soil pressure", 150, 10, "kPa")}</div></div>
    <div><h3>Checks (live)</h3><div id="imFloorRes"></div></div></div>
    <h3>Floor requirements – typical values (examples, the maker's foundation drawing decides)</h3>
    <table class="im-tbl"><tr><th>Item</th><th>Small VMC (3–6 t)</th><th>HMC 500 (12–16 t)</th><th>Large HMC / grinder (20–40 t)</th><th>Note</th></tr>
      <tr><td>Slab thickness</td><td>≥ 200 mm</td><td>≥ 250–300 mm</td><td>own block 600–1200 mm</td><td>continuous under the whole machine, no joint across it</td></tr>
      <tr><td>Concrete class (EN 206)</td><td>C25/30</td><td>C25/30 – C30/37</td><td>C30/37</td><td>exposure class for coolant oil: XA1 / oil-resistant coating</td></tr>
      <tr><td>Reinforcement</td><td>1 mesh Q257</td><td>2 meshes Ø10–12 @ 150</td><td>2 meshes Ø12–16 @ 150 + edge bars</td><td>cover 40–50 mm; designed by the structural engineer</td></tr>
      <tr><td>Flatness (DIN 18202, tab. 3)</td><td>line 3</td><td>line 3 or 4</td><td>line 4 + grout</td><td>line 3: 4 mm at 1 m, 10 mm at 4 m · line 4: 3 mm at 1 m, 9 mm at 4 m</td></tr>
      <tr><td>Floor level under machine</td><td>±5 mm</td><td>±3–5 mm</td><td>±3 mm</td><td>pads / grout take the rest (bolt stroke!)</td></tr>
      <tr><td>Soil</td><td colspan="3">compacted gravel, plate-load test E_v2 ≥ 80–100 MN/m², no soft layers, groundwater below the slab</td><td>soil report for new halls</td></tr>
      <tr><td>Surface</td><td colspan="3">oil- and coolant-resistant coating (epoxy / PU), slip-resistant; NOT under the grout area (grout bonds to bare, roughened concrete)</td><td></td></tr></table>`;
}
function blockBody() {
  return `<div class="im-grid2"><div><h3>When do I need an isolated block? (rules of thumb)</h3><ul class="im-ul">
    <li>The slab is thinner than the maker's minimum, cracked, or has a joint under the machine.</li>
    <li>Floor vibration at the position is above the maker's limit (survey 1.5), or a press / hammer / big compressor is nearer than ≈ 15–30 m.</li>
    <li>Precision machines: jig grinder, cylindrical grinder for crankshafts, CMM, measuring room.</li>
    <li>Very heavy machines (point loads the slab cannot spread) or long machines that need a stiff base (long bed lathes).</li>
    <li>The machine maker asks for it in the foundation drawing (then it is a contract item).</li>
    <li>For the HMC 500 on a good 300 mm C25/30 slab: usually <b>not</b> needed – levelling bolts on steel pads are standard.</li></ul>
    <h3>Block size calculator</h3><div class="im-ins">
    <label class="im-in"><span>mass ratio block / machine</span><input type="range" id="imRatio" min="1" max="4" step="0.1" value="2"><i id="imRatioV">2 ×</i></label>
    ${num("imMarg", "margin each side", 300, 50, "mm")}${num("imHmin", "minimum depth", 600, 50, "mm")}</div>
    <div id="imBlockRes"></div></div>
    <div><h3>Click a part of the drawing</h3><div class="im-info" id="imInfo1"></div>
    <h3>Construction sequence</h3><ol class="im-ul">
      <li>Mark the position from the layout (reference lines, see item 2.4); saw-cut and break the old slab.</li>
      <li>Excavate, compact the soil, 200–300 mm gravel, plate-load test.</li>
      <li>50 mm blinding concrete, PE sheet (separation), then the joint filler boards at the sides.</li>
      <li>Reinforcement with spacers; anchor sleeves fixed in a <b>steel template</b> from the maker's drawing; conduits, sleeves, earthing strip (item 3).</li>
      <li>Inspection before the pour (photos, positions ±5 mm), then pour in one go, vibrate the concrete, finish the top ±5 mm.</li>
      <li>Curing: keep wet / covered ≥ 7 days. Strength: ≈ 65–70 % at 7 days, 100 % (design value) at 28 days. Place the machine at ≥ 7 days only if the concrete supplier / engineer confirms; precision levelling better after 28 days (shrinkage).</li>
      <li>Close the joint with elastic sealant; machine in, level, grout (non-shrink epoxy or cement), cure, torque the anchors, re-level.</li></ol></div></div>
    <h3>Foundation plan – HMC 500 example (dimensions follow the calculator)</h3><div class="im-svgbox" id="imFoundSvg"></div>
    <p class="im-note">Drawing for explanation only (example dimensions in mm). The real foundation drawing comes from the machine maker (sleeve positions, loads) and the structural engineer (reinforcement, concrete).</p>`;
}
function mountBody() {
  return `<div class="im-grid2 im-g21"><div><table class="im-tbl im-click">
    <tr><th>Mounting</th><th>Stiffness</th><th>Isolation</th><th>Pros</th><th>Cons</th><th>Use for</th></tr>
    <tr data-im="rigid"><td><b>Anchored + grouted</b></td><td>very high</td><td>none (block gives it)</td><td>best dynamic stiffness, no walking, level stable</td><td>hard to move or re-level; grout work</td><td>large HMC, heavy lathes, machines with fast heavy axes</td></tr>
    <tr data-im="levbolt"><td><b>Levelling bolts on steel pads</b></td><td>high</td><td>none</td><td>standard, quick, easy re-levelling</td><td>pads can move without anchors; needs good slab</td><td><b>HMC 500 (our line)</b>, VMC, most machining centres</td></tr>
    <tr data-im="avm"><td><b>Anti-vibration levelling mounts (rubber)</b></td><td>low–medium (f_n 10–25 Hz)</td><td>above ≈ 20–50 Hz</td><td>no drilling, quick, cuts high-frequency noise</td><td>rocking with fast axes, creep, poor for heavy dynamic machines</td><td>light machines, washers, small grinders, measuring devices on a quiet floor</td></tr>
    <tr data-im="spring"><td><b>Springs / air springs + inertia block</b></td><td>low (f_n 2–6 Hz)</td><td>very good above 5–15 Hz</td><td>strongest isolation, in and out</td><td>expensive, needs damping, block design</td><td>presses, hammers (vibration out); precision grinders, CMM (vibration in)</td></tr></table>
    <h3>Anchors and grout – example data (check the anchor / grout maker)</h3>
    <table class="im-tbl"><tr><th>Item</th><th>Example</th><th>Note</th></tr>
    <tr><td>Cast-in anchor sleeve</td><td>M24, embedment 250–300 mm</td><td>set in the pour with a template; bolt can move a little for alignment</td></tr>
    <tr><td>Chemical (bonded) anchor</td><td>M24, hole Ø28, depth 210–300 mm</td><td>hole cleaned (blow-brush-blow ×2), curing time by temperature, then torque</td></tr>
    <tr><td>Undercut anchor</td><td>M20–M24</td><td>high, reliable load in cracked concrete; for dynamic loads</td></tr>
    <tr><td>Anchor torque</td><td>example 200–300 N·m (M24)</td><td>from the anchor approval (ETA) – not the bolt table; torque in a cross pattern, re-check level after</td></tr>
    <tr><td>Epoxy grout</td><td>compressive 90–110 MPa, 25–50 mm thick</td><td>dry surface; pour from one side (no trapped air); cure 24–72 h at ≥ 15 °C</td></tr>
    <tr><td>Cement non-shrink grout</td><td>compressive 50–70 MPa, 25–100 mm</td><td>pre-wet the concrete 24 h (surface damp, no water pools); cure wet</td></tr></table></div>
    <div><h3>Click a row for details</h3><div class="im-info" id="imInfo2"></div>
    <h3>Decision for our line (example)</h3><ul class="im-ul"><li><b>HMC-01…03</b>: levelling bolts on steel pads, anchors M24 (optional, recommended because the column accelerates 0.6 g), on the 300 mm slab.</li>
    <li><b>Crankshaft grinder GRIND-01</b>: isolated block (precision ≤ 2 µm roundness).</li>
    <li><b>Washer, conveyors</b>: simple levelling feet.</li><li><b>A press</b> (if the factory gets one later): spring isolators, at a distance (see 1.6).</li></ul></div></div>`;
}
function vibBody() {
  return `<h3>Sources of vibration (examples)</h3><table class="im-tbl"><tr><th>Source</th><th>Frequency</th><th>Typical level on the floor (example)</th><th>What to do</th></tr>
    <tr><td>Mechanical press / punch</td><td>impacts, slab responds 10–40 Hz</td><td>10–15 mm/s at 1 m, 1–3 mm/s at 10 m</td><td>spring isolators under the press, distance ≥ 20–30 m, own block</td></tr>
    <tr><td>Piston air compressor</td><td>12 Hz (740 rpm) + 2×</td><td>3–5 mm/s at 1 m</td><td>compressor room with own base, on isolators, flexible hoses</td></tr>
    <tr><td>Screw compressor, pumps, fans</td><td>25–50 Hz (motor), 100 Hz</td><td>0.5–1 mm/s</td><td>usually OK on its rubber mounts</td></tr>
    <tr><td>Forklift / AGV over a joint or bump</td><td>5–15 Hz shocks</td><td>2–5 mm/s near the joint</td><td>no joints in the traffic lane near precision machines; smooth floor</td></tr>
    <tr><td>Own axes – reaction of the moving column</td><td>reversal rate 2–20 Hz</td><td>F = m·a = 10.6 kN (1 800 kg · 0.6 g)</td><td>stiff mounting, anchors (see the calculator below)</td></tr>
    <tr><td>Spindle unbalance</td><td>rpm/60 = 100 Hz at 6 000 rpm</td><td>F = m·e·ω² (G 2.5: ≈ 40 N)</td><td>balanced tools (G 2.5 at max rpm), spindle condition monitoring</td></tr>
    <tr><td>Neighbouring machining centres</td><td>5–100 Hz</td><td>0.3–1 mm/s at 3 m</td><td>usual – keep ≥ 3–5 m between rigid machines</td></tr></table>
    <div class="im-grid2"><div><h3>Isolation calculator</h3><div class="im-ins">
    ${sel("imPre", "preset", [["", "– choose –"], ["hmcRigid", "HMC 500 on rigid steel pads (6 × 1000 kN/mm)"], ["hmcAvm", "HMC 500 on rubber mounts (6 × 25 kN/mm)"], ["grinder", "grinder 8 t on rubber mounts (8 × 10 kN/mm)"], ["press", "press 25 t on springs (δ = 10 mm)"]], "")}
    ${sel("imSrcF", "disturbing source", [["", "– choose –"], ["12.3", "piston compressor 740 rpm → 12.3 Hz"], ["49.5", "screw compressor motor 2970 rpm → 49.5 Hz"], ["25", "press impact → slab ≈ 25 Hz"], ["8", "forklift bumps ≈ 8 Hz"], ["100", "spindle 6000 rpm → 100 Hz"], ["10", "axis reversals ≈ 10 Hz"]], "")}
    ${num("imVm", "mass m (machine on the mounts)", 12510, 100, "kg")}${num("imVk", "total stiffness k (all mounts)", 150, 1, "kN/mm")}
    ${num("imVd", "or: static deflection δ", 0.818, 0.01, "mm")}${num("imVz", "damping ratio ζ (rubber 0.05–0.1)", 0.08, 0.01, "–")}
    ${num("imVf", "disturbing frequency f", 50, 0.5, "Hz")}</div><div id="imVibRes"></div></div>
    <div><div id="imVibChart"></div><p class="im-note">Below r ≈ 0.7 the mount is "rigid": T ≈ 1, the floor motion passes 1 : 1. Around r = 1 (resonance) it is amplified (T up to 1/(2ζ)). Above r = √2 the mount isolates; more damping lowers the resonance peak but isolates a little less at high r. Real machines have 6 modes (3 translations + 3 rocking) – this is the simple vertical one.</p></div></div>
    <h3>Inertia reaction and rocking (HMC moving column)</h3><div class="im-grid2"><div class="im-ins">
    ${num("imRm", "moving mass (column)", HMC.mColumn, 50, "kg")}${num("imRa", "acceleration", HMC.accG, 0.05, "g")}
    ${num("imRh", "height of CoG above pads", HMC.colCgH, 0.1, "m")}${num("imRs", "pad span (across)", HMC.bedW, 0.1, "m")}
    ${sel("imRk", "pad stiffness", [[1000, "rigid steel pad ≈ 1000 kN/mm"], [100, "hard elastomer ≈ 100 kN/mm"], [25, "rubber AV mount ≈ 25 kN/mm"]], 1000)}
    ${num("imRr", "spindle rotor mass", 25, 1, "kg")}${num("imRg", "balance grade G", 2.5, 0.5, "mm/s")}</div><div id="imReactRes"></div></div>`;
}
function limBody() {
  return `<div class="im-grid2"><div><h3>(a) Machine vibration – ISO 10816-3 / ISO 20816-3 (velocity RMS, 10–1000 Hz, mm/s)</h3>
    <table class="im-tbl"><tr><th>Group / foundation</th><th>A/B (new)</th><th>B/C (long run OK)</th><th>C/D (damage)</th></tr>
    <tr><td>Group 2 (15–300 kW), rigid</td><td>1.4</td><td>2.8</td><td>4.5</td></tr>
    <tr><td>Group 2 (15–300 kW), flexible</td><td>2.3</td><td>4.5</td><td>7.1</td></tr>
    <tr><td>Group 1 (300 kW–50 MW), rigid</td><td>2.3</td><td>4.5</td><td>7.1</td></tr>
    <tr><td>Group 1 (300 kW–50 MW), flexible</td><td>3.5</td><td>7.1</td><td>11.0</td></tr></table>
    <p class="im-note">The twin uses warn 4.5 / alarm 7.1 mm/s for the HMCs (config, ISO 10816-3 style). ISO 10816-3 was replaced by ISO 20816-3:2022 (same idea). VDI 2056 (old German guideline) is withdrawn – you still see its classes in old manuals. These zones are for motors, pumps, fans on their bearing housings – NOT for the floor under a precision machine.</p>
    <h3>(b) Floor vibration limits at the machine position (examples – the maker's spec decides)</h3>
    <table class="im-tbl"><tr><th>Machine</th><th>Floor limit (velocity RMS)</th><th>Other form you may see</th></tr>
    <tr><td>General machining (HMC, VMC, lathe)</td><td>≤ 1.0 mm/s</td><td>amplitude ≤ 2–5 µm (10–100 Hz)</td></tr>
    <tr><td>Precision machining, fine boring / honing</td><td>≤ 0.5 mm/s</td><td>≤ 1–2 µm; acceleration ≤ 0.005 g</td></tr>
    <tr><td>Grinding (crankshaft), jig grinder</td><td>≤ 0.25 mm/s</td><td>≤ 0.5–1 µm</td></tr>
    <tr><td>CMM / measuring room</td><td>≤ 0.1 mm/s</td><td>maker's frequency curve (e.g. VC-A 50 µm/s)</td></tr></table></div>
    <div><h3>Site vibration survey – procedure</h3><ol class="im-ul">
    <li>Plan: positions = each future machine (4 corners + centre), the source (press, compressor), and the joint between.</li>
    <li>Instrument: velocity sensor (geophone) or accelerometer (100 mV/g) + analyser / data logger, calibrated. Mount on a steel disc glued or magnet on a steel plate on the bare concrete – never on a loose tile.</li>
    <li>Measure 3 directions (vertical + 2 horizontal), 1–200 Hz (or 2–100 Hz as the maker says), RMS and peak, FFT spectrum.</li>
    <li>Duration: a full working shift, with all sources running: press, compressor start / stop, forklift passing, crane. Note events.</li>
    <li>Evaluate: worst 1-minute RMS, peaks, dominant frequencies (→ use them in the isolation calculator 1.4).</li>
    <li>Report: positions, sensor, settings, results vs limit, recommendation (OK / move / isolated block / isolate the source).</li>
    <li>After installation: repeat on the machine base with the machine OFF and ON (acceptance), keep as baseline for condition monitoring.</li></ol>
    <h3>Distance rules (rules of thumb, check by survey)</h3><ul class="im-ul">
    <li>Precision machines ≥ 20–30 m from presses / hammers, ≥ 10 m from piston compressors.</li>
    <li>Slab joints and traffic lanes not under or next to precision machines (≥ 2–3 m).</li>
    <li>An open trench helps only if its depth is about 0.6 × the wave length near the source (about 1.3 × further away – Woods rule; often several metres) – a sawn slab joint (isolation joint around a block) is the practical solution.</li></ul></div></div>`;
}
function planBody() {
  return `<div class="im-ins">
    ${sel("imSrcType", "source type", [["press", "mechanical press 250 t (12 mm/s @ 1 m)"], ["pcomp", "piston compressor (4 mm/s)"], ["scomp", "screw compressor on mounts (0.8 mm/s)"], ["fork", "forklift on a joint (3 mm/s)"], ["hammer", "forging hammer (40 mm/s)"]], "press")}
    <button class="im-btn" id="imAddSrc">+ add source</button>
    ${sel("imAlpha", "floor / soil damping α", [[0.02, "rock / stiff soil α = 0.02 /m"], [0.05, "normal soil + slab α = 0.05 /m"], [0.1, "soft soil α = 0.10 /m"]], 0.05)}
    ${sel("imJoint", "HMC foundation", [[1, "on the continuous slab (factor 1.0)"], [0.6, "slab cut around (isolation joint) ×0.6"], [0.35, "isolated block ×0.35"]], 1)}
    ${sel("imVLim", "floor limit at the HMC", [[1, "1.0 mm/s – general machining"], [0.5, "0.5 mm/s – precision"], [0.25, "0.25 mm/s – grinding"]], 1)}</div>
    <div class="im-grid2 im-g21"><div class="im-svgbox" id="imPlanBox"></div><div id="imPlanRes"></div></div>`;
}
function askBody() {
  return `<div class="im-grid2"><div><h3>Ask the machine maker</h3><ol class="im-ul">
    <li>Foundation drawing: pad / anchor positions, loads per pad (static + dynamic), slab thickness, concrete class, block yes/no.</li>
    <li>Allowed floor vibration (value, frequency range, unit: mm/s RMS, µm, g).</li>
    <li>Levelling elements supplied (bolt size, pitch, pads), anchors needed? which type, torque?</li>
    <li>Grout required? which product / thickness? Who does it?</li>
    <li>Total weights incl. coolant, chip conveyor, APC, transformer; centre of gravity.</li>
    <li>Max. axis acceleration and moving masses (for the reaction force).</li>
    <li>Positions of cable / coolant / air / chip connections (for conduits in the pour).</li>
    <li>Room conditions: temperature 20 ± 2 °C, gradient ≤ 1 K/m, no sun / door draught near the machine.</li></ol></div>
    <div><h3>Ask the builder / structural engineer</h3><ol class="im-ul">
    <li>As-built slab: thickness, class, reinforcement, joints – or core drilling + rebar scan.</li>
    <li>Soil report: allowable pressure, groundwater, settlement.</li>
    <li>Block design: reinforcement, joint detail, sleeves template, earthing strip.</li>
    <li>Concrete test results (cubes / cylinders at 7 and 28 days) before loading.</li>
    <li>Floor flatness measurement (DIN 18202) report.</li>
    <li>Coating of the floor – not under the grout area.</li></ol>
    <h3>Checklist before the machine arrives</h3><ul class="im-ul im-check"><li>Survey report OK</li><li>Foundation cured (date + strength)</li><li>Sleeves / conduits at drawing position ±5 mm</li><li>Reference lines marked (item 2.4)</li><li>Steel pads + grout + anchors on site</li><li>Crane / rigging route free (item 5)</li></ul></div></div>`;
}

/* ================================================================== foundation drawing (top view + section A–A) */
function foundationSvg(b) {
  const sc = 80; // px per m
  const sl = 1.0;             // m of slab shown around the block
  const L = b.L, B = b.B, H = b.H, j = 0.025;
  const ox = 70, oy = 50;     // top-view origin (slab corner)
  const X = (z) => ox + (z + sl) * sc, Y = (x) => oy + (x + sl) * sc; // z along block length (horizontal), x across (vertical)
  const W = (L + 2 * sl) * sc, Hh = (B + 2 * sl) * sc;
  let s = "";
  s += `<defs><pattern id="imHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" class="im-hl"/></pattern></defs>`;
  s += `<text class="im-tl" x="${ox}" y="${oy - 28}">TOP VIEW (example, mm)</text>`;
  // slab
  s += `<rect data-im="slab" class="im-slab" x="${ox}" y="${oy}" width="${W}" height="${Hh}"/>`;
  // joint
  s += `<rect data-im="joint" class="im-joint" x="${X(-j)}" y="${Y(-j)}" width="${(L + 2 * j) * sc}" height="${(B + 2 * j) * sc}"/>`;
  // block
  s += `<rect data-im="block" class="im-blk" x="${X(0)}" y="${Y(0)}" width="${L * sc}" height="${B * sc}"/>`;
  // machine footprint (dashed), APC at front (left)
  const m0z = (L - HMC.footL) / 2, m0x = (B - HMC.footW) / 2;
  const bc = { z: L / 2 + 0.4, x: B / 2 };
  s += `<rect class="im-foot" x="${X(m0z)}" y="${Y(m0x)}" width="${HMC.footL * sc}" height="${HMC.footW * sc}"/>`;
  s += `<line class="im-foot" x1="${X(m0z + 1.4)}" x2="${X(m0z + 1.4)}" y1="${Y(m0x)}" y2="${Y(m0x + HMC.footW)}"/>`;
  s += `<text class="im-tk" x="${X(m0z + 0.7)}" y="${Y(m0x) + 14}" text-anchor="middle">APC</text><text class="im-tk" x="${X(m0z + 3.3)}" y="${Y(bc.x) + 4 + (0)}" text-anchor="middle">machine footprint 5200 × 2800 (dashed)</text>`;
  // bed pads: bed centre at z = block centre + 0.4 (column at rear = right)
  const pads = [[-1.7, -1.1], [-1.7, 1.1], [0, -1.1], [0, 1.1], [1.7, -1.1], [1.7, 1.1]];
  pads.forEach(([pz, pxx], i) => {
    const cz = bc.z + pz, cx = bc.x + pxx;
    s += `<rect data-im="pad" class="im-pad${i === 2 || i === 3 ? " im-aux" : ""}" x="${X(cz) - 10}" y="${Y(cx) - 10}" width="20" height="20"/><text class="im-tk" x="${X(cz) - 16}" y="${Y(cx) + (pxx < 0 ? -12 : 22)}" text-anchor="middle">${i + 1}</text>`;
    s += `<circle data-im="anchor" class="im-anc" cx="${X(cz) + 22}" cy="${Y(cx)}" r="6"/>`;
  });
  // APC pads
  [[-1.0, -0.6], [-1.0, 0.6]].forEach(([pz, pxx]) => { s += `<rect data-im="pad" class="im-pad im-aux" x="${X(m0z + 0.7 + pz + 1) - 7}" y="${Y(bc.x + pxx) - 7}" width="14" height="14"/>`; });
  // conduits: cable floor channel from rear-right to block edge, coolant sleeve, chip trench along the rear end outside the block
  s += `<rect data-im="conduit" class="im-cond" x="${X(L - 0.9)}" y="${Y(B - 0.25)}" width="${0.3 * sc}" height="${(sl + 0.25) * sc}"/><text class="im-tk" x="${X(L - 0.75)}" y="${Y(B + sl) - 4}" text-anchor="middle">cables → tray</text>`;
  s += `<circle data-im="coolant" class="im-cool" cx="${X(2.3)}" cy="${Y(B - 0.28)}" r="9"/><text class="im-tk" x="${X(2.3) + 14}" y="${Y(B - 0.28) + 4}">air / coolant sleeve</text>`;
  s += `<rect data-im="trench" class="im-trench" x="${X(L + 0.35)}" y="${Y(0.2)}" width="${0.4 * sc}" height="${(B - 0.4) * sc}"/><text class="im-tk" transform="translate(${X(L + 0.55) + 4} ${Y(B / 2)}) rotate(90)" text-anchor="middle">chip trench 400</text>`;
  // dims
  const dimH = (z1, z2, y, t) => `<line class="im-dim" x1="${X(z1)}" x2="${X(z2)}" y1="${y}" y2="${y}"/><line class="im-dim" x1="${X(z1)}" x2="${X(z1)}" y1="${y - 5}" y2="${y + 5}"/><line class="im-dim" x1="${X(z2)}" x2="${X(z2)}" y1="${y - 5}" y2="${y + 5}"/><text class="im-tk" x="${(X(z1) + X(z2)) / 2}" y="${y - 4}" text-anchor="middle">${t}</text>`;
  const dimV = (x1, x2, xx, t) => `<line class="im-dim" x1="${xx}" x2="${xx}" y1="${Y(x1)}" y2="${Y(x2)}"/><line class="im-dim" x1="${xx - 5}" x2="${xx + 5}" y1="${Y(x1)}" y2="${Y(x1)}"/><line class="im-dim" x1="${xx - 5}" x2="${xx + 5}" y1="${Y(x2)}" y2="${Y(x2)}"/><text class="im-tk" transform="translate(${xx - 6} ${(Y(x1) + Y(x2)) / 2}) rotate(-90)" text-anchor="middle">${t}</text>`;
  s += dimH(0, L, oy - 10, `block ${Math.round(L * 1000)}`);
  s += dimH(bc.z - 1.7, bc.z + 1.7, Y(B) + 28, "pads 1700 + 1700");
  s += dimV(0, B, ox - 14, `${Math.round(B * 1000)}`);
  s += dimV(bc.x - 1.1, bc.x + 1.1, X(bc.z + 1.7) + 42, "2200");
  s += `<text class="im-tk" x="${X(-j) - 4}" y="${Y(-j) - 4}" text-anchor="end">joint 25</text>`;
  // section line
  const secX = bc.x - 1.1;
  s += `<line class="im-sec" x1="${ox - 8}" x2="${ox + W + 8}" y1="${Y(secX)}" y2="${Y(secX)}"/><text class="im-tl" x="${ox - 30}" y="${Y(secX) + 4}">A</text><text class="im-tl" x="${ox + W + 14}" y="${Y(secX) + 4}">A</text>`;
  // legend (right)
  const lx = ox + W + 40; let ly = oy + 10;
  [["im-blk", "foundation block", "block"], ["im-joint", "isolation joint + filler", "joint"], ["im-pad", "steel pad + jack bolt", "pad"], ["im-pad im-aux", "auxiliary pad", "pad"], ["im-anc", "anchor sleeve M24", "anchor"], ["im-cond", "cable channel", "conduit"], ["im-cool", "pipe sleeve", "coolant"], ["im-trench", "chip trench", "trench"]].forEach(([c, t, k]) => {
    s += `<g data-im="${k}" class="im-leg">${c === "im-anc" || c === "im-cool" ? `<circle class="${c}" cx="${lx + 8}" cy="${ly}" r="6"/>` : `<rect class="${c}" x="${lx}" y="${ly - 7}" width="16" height="14"/>`}<text class="im-tk" x="${lx + 24}" y="${ly + 4}">${t}</text></g>`; ly += 22; });
  // ------------- SECTION A–A
  const sy0 = oy + Hh + 70, gTop = sy0 + 105; // floor top line
  const sv = 2.5 * sc;                       // vertical scale of the section = 2.5 × horizontal (exaggerated for reading)
  const Z = (h) => gTop + h * sv;           // depth h (m) below floor top
  s += `<text class="im-tl" x="${ox}" y="${sy0}">SECTION A–A (example, mm – vertical scale 2.5 ×)</text>`;
  const slabH = 0.3;
  // gravel + blinding under block
  s += `<rect data-im="blind" class="im-grav" x="${X(-0.3)}" y="${Z(H + 0.05)}" width="${(L + 0.6) * sc}" height="${0.25 * sv}"/>`;
  s += `<rect data-im="blind" class="im-blind" x="${X(-0.1)}" y="${Z(H)}" width="${(L + 0.2) * sc}" height="${0.05 * sv}"/>`;
  // slab left/right
  s += `<rect data-im="slab" class="im-slab" x="${X(-sl)}" y="${Z(0)}" width="${(sl - j) * sc}" height="${slabH * sv}"/><rect data-im="slab" class="im-slab" x="${X(L + j)}" y="${Z(0)}" width="${(sl - j) * sc}" height="${slabH * sv}"/>`;
  s += `<rect class="im-grav" x="${X(-sl)}" y="${Z(slabH)}" width="${(sl - j - 0.3) * sc}" height="${0.2 * sv}"/><rect class="im-grav" x="${X(L + j + 0.3)}" y="${Z(slabH)}" width="${(sl - j - 0.3) * sc}" height="${0.2 * sv}"/>`;
  // joints
  s += `<rect data-im="joint" class="im-joint" x="${X(-j)}" y="${Z(0)}" width="${j * sc + 1}" height="${H * sv}"/><rect data-im="joint" class="im-joint" x="${X(L)}" y="${Z(0)}" width="${j * sc + 1}" height="${H * sv}"/>`;
  // block
  s += `<rect data-im="block" class="im-blk" x="${X(0)}" y="${Z(0)}" width="${L * sc}" height="${H * sv}"/>`;
  // rebar
  s += `<line data-im="rebar" class="im-rebar" x1="${X(0.05)}" x2="${X(L - 0.05)}" y1="${Z(0.05)}" y2="${Z(0.05)}"/><line data-im="rebar" class="im-rebar" x1="${X(0.05)}" x2="${X(L - 0.05)}" y1="${Z(H - 0.05)}" y2="${Z(H - 0.05)}"/>`;
  // pads + sleeves + grout + machine base
  [-1.7, 0, 1.7].forEach((pz, i) => { const cz = bc.z + pz;
    s += `<rect data-im="anchor" class="im-sleeve" x="${X(cz + 0.22) - 5}" y="${Z(0)}" width="10" height="${0.3 * sv}"/>`;
    s += `<rect data-im="grout" class="im-grout" x="${X(cz) - 22}" y="${Z(-0.04)}" width="58" height="${0.04 * sv}"/>`;
    s += `<rect data-im="pad" class="im-pad${i === 1 ? " im-aux" : ""}" x="${X(cz) - 10}" y="${Z(-0.075)}" width="20" height="${0.035 * sv}"/>`;
    s += `<line class="im-bolt" x1="${X(cz)}" x2="${X(cz)}" y1="${Z(-0.075)}" y2="${Z(-0.2)}"/>`; });
  s += `<rect class="im-mbase" x="${X(bc.z - 2.0)}" y="${Z(-0.32)}" width="${4.1 * sc}" height="${0.12 * sv}"/><text class="im-tk" x="${X(bc.z)}" y="${Z(-0.34)}" text-anchor="middle">machine bed (feet with M30 jack bolts)</text>`;
  // dims section
  s += `<line class="im-dim" x1="${X(-sl) - 14}" x2="${X(-sl) - 14}" y1="${Z(0)}" y2="${Z(slabH)}"/><text class="im-tk" transform="translate(${X(-sl) - 18} ${Z(slabH / 2)}) rotate(-90)" text-anchor="middle">slab 300</text>`;
  s += `<line class="im-dim" x1="${X(L + sl) + 14}" x2="${X(L + sl) + 14}" y1="${Z(0)}" y2="${Z(H)}"/><text class="im-tk" transform="translate(${X(L + sl) + 26} ${Z(H / 2)}) rotate(-90)" text-anchor="middle">block H = ${Math.round(H * 1000)}</text>`;
  s += `<text class="im-tk" x="${X(L / 2)}" y="${Z(H + 0.33)}" text-anchor="middle">50 blinding · PE sheet · 250 compacted gravel (E_v2 ≥ 80 MN/m²)</text>`;
  s += `<text class="im-tk" x="${X(0.1)}" y="${Z(H - 0.09)}">2 meshes Ø12 @ 150, cover 50</text>`;
  s += `<text class="im-tk" x="${X(bc.z - 1.7) - 26}" y="${Z(-0.02)}" text-anchor="end">grout 25–50 + steel pad</text>`;
  s += `<text class="im-tk" x="${X(bc.z + 1.7) + 30}" y="${Z(0.22)}">anchor sleeve M24</text>`;
  s += `<text class="im-tk" x="${X(L + j) + 4}" y="${Z(-0.05)}">hall floor ±0.000</text>`;
  return `<svg class="im-found" style="max-width:${W + 260}px" viewBox="0 0 ${W + 260} ${Math.ceil(Z(H + 0.4))}" role="img" aria-label="foundation plan">` + s + "</svg>";
}
