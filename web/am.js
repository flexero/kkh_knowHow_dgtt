/* Additive manufacturing tab (#am) – item switch + item 1 "Technology map + process selector".
 * Item 2 (LPBF metal process twin) lives in amlpbf.js and listens to the window event "amitemshow".
 * Deep links: /?amitem=2#am · item 1: &amtech=pbf|ded|bjt|mex|vpp|mjt|shl
 * Data = public, well-known industrial practice (examples). Machine names are examples of a class, not a recommendation. */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const Q = new URLSearchParams(location.search);

/* ------------------------------------------------------------------ item switch */
let current = "1";
function showItem(n) {
  n = String(n); current = n;
  document.querySelectorAll("[data-amitem]").forEach((b) => b.classList.toggle("active", b.dataset.amitem === n));
  [...document.querySelectorAll("[data-amitem]")].map((b) => b.dataset.amitem).forEach((i) => {
    const el = $("amItem" + i), it = $("amIntro" + i); if (el) el.hidden = i !== n; if (it) it.hidden = i !== n; });
  window.dispatchEvent(new Event("resize"));
  window.dispatchEvent(new CustomEvent("amitemshow", { detail: n }));
}
document.querySelectorAll("[data-amitem]").forEach((b) => b.addEventListener("click", () => { if (!b.disabled) showItem(b.dataset.amitem); }));
const prevTab = window.onTabShown;
window.onTabShown = (name) => { if (prevTab) prevTab(name); if (name === "am") window.dispatchEvent(new CustomEvent("amitemshow", { detail: current })); };
window.amCtl = { showItem, current: () => current };

/* ------------------------------------------------------------------ data: the 7 process families (ISO/ASTM 52900) */
const TECH = [
  { k: "pbf", name: "Powder bed fusion (PBF)", sub: "PBF-LB/M = LPBF, SLM, DMLS (metal, laser) · PBF-EB/M = EBM (metal, electron beam) · PBF-LB/P = SLS and Multi Jet Fusion (polymer)",
    how: "A thin layer of powder (20–100 µm) is spread over a plate. A laser or electron beam melts the cross-section of the part. The plate goes down one layer, new powder, repeat – thousands of layers.",
    mat: "Metal: AlSi10Mg, 316L, 17-4PH, Ti6Al4V, maraging 1.2709, Inconel 718/625, CoCr, CuCrZr · Polymer: PA12, PA11, TPU, PP",
    size: "metal 250 × 250 × 300 mm up to ≈ 600 × 600 × 1 000 mm; polymer ≈ 380 × 285 × 380 mm (MJF)", acc: "±0.1–0.2 mm (metal), ±0.3 % (polymer)", ra: "Ra 6–20 µm as built", speed: "metal 10–100 cm³/h per laser; polymer ≈ 1–4 L/h",
    cost: "metal machine $0.5–5 M; polymer $0.2–0.6 M", mature: 5,
    plus: "Most complex shapes: inner channels, lattices, thin walls. Dense metal (> 99.5 %) with cast/wrought-like strength. The most used metal AM process in industry.",
    minus: "Slow and expensive per kg; supports and post-processing (stress relief, cutting, machining) are 30–60 % of the cost; powder handling needs ATEX safety.",
    real: ["Aero-engine fuel nozzle tips printed in Co-Cr (GE / CFM LEAP) – 20 parts became 1", "Gas turbine burner parts and repair (Siemens Energy)", "Titanium hip cups with lattice for bone growth (orthopaedic implant makers, EBM and LPBF)", "Conformal-cooled mould and die inserts in tool shops", "Polymer: jigs, gripper fingers, ducts and small series (car plants run HP MJF / SLS farms)"],
    yours: "Conformal-cooled die inserts, prototype cylinder heads, spare parts, light robot grippers (metal); jigs and fixtures (polymer MJF/SLS). → Item 2 is the full process twin of metal LPBF." },
  { k: "ded", name: "Directed energy deposition (DED)", sub: "laser + powder (LMD / LMD-p) · laser or arc + wire (WAAM = wire arc additive manufacturing) · electron beam + wire",
    how: "A nozzle feeds powder or wire into a melt pool made by a laser, electric arc or electron beam. A robot or CNC moves the nozzle and builds beads layer by layer – also on an existing part.",
    mat: "steels, stainless, Ni alloys, Ti, Al (WAAM), Cu-Ni, hard-facing alloys", size: "up to several metres (robot / gantry)", acc: "±0.5–2 mm → always machined after", ra: "very rough (wavy beads)",
    speed: "LMD 0.1–1 kg/h, WAAM 1–10 kg/h", cost: "$0.3–2 M (often robot + welding source)", mature: 4,
    plus: "Big parts, high deposition rate, repair and coating of worn parts, hybrid machines (DED head on a CNC).",
    minus: "Low accuracy, needs machining; residual stress and distortion of large parts; limited overhangs.",
    real: ["Repair of turbine blades, shafts and moulds (laser cladding shops)", "Large ship propeller printed with WAAM (Damen / RAMLAB 'WAAMpeller', 2017)", "Large titanium aerospace pre-forms (electron beam wire DED)", "Hybrid 5-axis machines with a DED head (several machine tool makers)"],
    yours: "Repair of worn crankshaft journals, die surfaces, hard-facing of wear parts. Not for small precise parts." },
  { k: "bjt", name: "Binder jetting (BJT)", sub: "metal binder jetting + sintering · sand binder jetting (casting moulds and cores) · ceramics",
    how: "A print head jets a liquid binder into a powder bed (like an inkjet printer) – no melting. Metal parts are 'green' and must be sintered in a furnace (they shrink ≈ 20 %). Sand moulds go straight to the foundry.",
    mat: "metal: 316L, 17-4PH, 1.2709, Cu · sand: silica sand with furan / phenolic / inorganic binder · ceramics", size: "metal ≈ 400 × 250 × 200 mm; sand up to 4 × 2 × 1 m",
    acc: "metal ±0.5–1 % after sintering; sand ±0.3 mm", ra: "metal Ra 6–10 µm", speed: "fast – many litres per hour, no supports", cost: "metal $0.5–1.5 M + sinter furnace; sand $0.8–2 M", mature: 4,
    plus: "Fast and cheap per part for small parts in thousands; no supports; sand printing removes the pattern for castings.",
    minus: "Sintering shrinkage and distortion; lower density than PBF for metal (≈ 97–99 %); size limited for metal.",
    real: ["Foundries print sand cores and moulds for engine blocks and pump housings (prototypes and small series)", "Metal binder jetting for small series of car and consumer parts (HP Metal Jet, Desktop Metal class)", "Sand printing service centres for complex cores"],
    yours: "★ Very interesting for you: print SAND CORES / MOULDS for crankcase and head castings – prototype castings in days without a pattern. Metal BJ for small 316L / 17-4PH parts in volume." },
  { k: "mex", name: "Material extrusion (MEX)", sub: "FFF / FDM (filament) · pellet extrusion (large format) · continuous-fibre reinforced · metal-filled filament + sintering",
    how: "A heated nozzle pushes out molten plastic (filament or pellets) and draws the part line by line, layer by layer.",
    mat: "PLA, PETG, ABS, ASA, PA (nylon), PA-CF, PC, PEEK / PEKK / ULTEM (high temp), TPU; metal-filled filaments", size: "desktop 250 mm³ … large format several metres",
    acc: "±0.2–0.5 mm", ra: "visible layers, Ra 10–30 µm", speed: "slow per part, but machines are cheap → printer farms", cost: "$0.5 k – $0.5 M", mature: 5,
    plus: "Cheapest and easiest; strong engineering plastics (PA-CF, ULTEM) for jigs, fixtures, gauges, end-of-arm tools; print next to the line.",
    minus: "Weak between layers (anisotropy); limited accuracy and surface; slow for big parts.",
    real: ["Car plants print thousands of jigs, fixtures and gauges a year on FFF printers next to the line (e.g. VW Autoeuropa case)", "Robot end-of-arm tooling and grippers", "Large-format moulds and boat hulls with pellet extrusion"],
    yours: "★ Start here: assembly jigs, drilling templates, go / no-go gauges, gripper fingers, cable holders, packaging inserts. A $2–8 k printer pays back in weeks." },
  { k: "vpp", name: "Vat photopolymerization (VPP)", sub: "SLA (laser) · DLP / LCD (projector / screen) · CLIP (continuous)",
    how: "A UV laser or projector hardens liquid resin layer by layer. Very fine detail and smooth surface.",
    mat: "photopolymer resins (standard, tough, high-temp, flexible, dental, castable), ceramic-filled resins", size: "≈ 145 × 145 × 185 mm … 1.5 m (large SLA)",
    acc: "±0.05–0.1 mm", ra: "very smooth, Ra 1–3 µm", speed: "medium", cost: "$3 k – $0.5 M", mature: 5,
    plus: "Best surface and detail of polymer AM; transparent parts; investment-casting patterns.",
    minus: "Resins are brittle / age in UV; post-curing and washing with solvents; supports.",
    real: ["Dental aligner moulds printed in huge numbers every day", "Lattice shoe midsoles (CLIP, Carbon / Adidas)", "Investment-casting patterns for jewellery and small metal parts"],
    yours: "Visual prototypes, transparent flow models (see the air flow in a valve), patterns for investment casting." },
  { k: "mjt", name: "Material jetting (MJT)", sub: "PolyJet / MultiJet (photopolymer drops) · NanoParticle jetting (metal / ceramic)",
    how: "Print heads jet tiny drops of material (like an inkjet), cured by UV light; several materials and colours in one part.",
    mat: "photopolymers (rigid, rubber-like, transparent, full colour), wax; ceramic / metal nanoparticles", size: "≈ 500 × 400 × 200 mm", acc: "±0.05–0.1 mm", ra: "very smooth",
    speed: "medium", cost: "$20 k – $0.5 M", mature: 4,
    plus: "Multi-material and full-colour realistic prototypes; soft + hard in one part.",
    minus: "Expensive material, weak parts – mostly prototypes, not functional parts.",
    real: ["Design and marketing prototypes, medical anatomy models", "Soft-touch / seal prototypes"],
    yours: "Design prototypes for customer presentations (compressor cover, control panel)." },
  { k: "shl", name: "Sheet lamination (SHL)", sub: "ultrasonic additive manufacturing (metal foils + CNC) · laminated object manufacturing (paper / plastic)",
    how: "Thin sheets or foils are bonded (glue or ultrasonic welding) and cut to shape layer by layer; metal versions machine each few layers.",
    mat: "Al, Cu, steel foils (ultrasonic); paper, plastic sheets", size: "≈ 1 × 0.6 × 0.6 m", acc: "±0.1 mm (machined)", ra: "machined",
    speed: "fast for big blocks", cost: "$0.1–1 M", mature: 2,
    plus: "Low temperature: embed sensors / fibres in metal; join different metals.",
    minus: "Niche, few suppliers, weak in the bond direction.",
    real: ["Embedded sensors and heat exchangers in aluminium (ultrasonic AM)", "Paper LOM models (mostly history)"],
    yours: "Not needed for a compressor factory today – good to know it exists." },
];

const USES = [
  ["Assembly jigs, fixtures, gauges, drilling templates", "MEX (PA-CF, ASA) / MJF", "1–3 days instead of 2–4 weeks; often 70–90 % cheaper than milled", "start now – cheapest win"],
  ["Robot gripper fingers, end-of-arm tools", "MJF / SLS (PA12), LPBF AlSi10Mg for heavy grippers", "lighter → faster robot; change-over to a new model in a day", "start now"],
  ["Sand cores / moulds for prototype castings (crankcase, head)", "Sand binder jetting (service bureau first)", "prototype castings in 1–2 weeks without pattern cost", "high value for new models"],
  ["Conformal-cooled die / mould inserts", "LPBF maraging 1.2709 (often bought from a service)", "20–40 % shorter casting / moulding cycle, fewer hot spots", "when you run your own dies"],
  ["Spare parts (obsolete, no drawing)", "LPBF 316L / AlSi10Mg, MJF PA12", "no stock, no tooling; scan → print → machine", "medium"],
  ["Prototype heads, valve plates, new cooling designs", "LPBF AlSi10Mg", "test designs in weeks, before pattern / die money is spent", "for the R&D team"],
  ["Repair of worn shafts, dies, wear faces", "DED (laser cladding) – service", "repair instead of new part", "medium"],
  ["Series compressor parts (crankcase, cylinder, crankshaft)", "– (casting + machining is far cheaper at your volumes)", "AM is only worth it for function, not for simple cast parts", "no"],
];

/* ------------------------------------------------------------------ simple schematic per process (inline SVG, theme colours) */
function schem(k) {
  const L = (x1, y1, x2, y2, c = "var(--text-2)", w = 1.5) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}"/>`;
  const R = (x, y, w, h, f, s = "var(--text-2)") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}" stroke="${s}" stroke-width="1"/>`;
  const T = (x, y, t, a = "middle") => `<text x="${x}" y="${y}" text-anchor="${a}" class="am-st">${t}</text>`;
  const laser = "#e8542a", powder = "var(--axis)", part = "#4f8fd6", hot = "#f0a030";
  let g = "";
  if (k === "pbf") g = R(20, 70, 120, 40, powder) + R(55, 82, 50, 28, part) + R(150, 60, 30, 50, powder) + R(10, 66, 18, 4, "var(--text-2)") + L(80, 10, 80, 82, laser, 2) + R(68, 4, 24, 10, "var(--surface-2)") + `<circle cx="80" cy="82" r="4" fill="${hot}"/>` + T(80, 125, "laser melts powder, plate goes down") + T(165, 55, "powder") + T(20, 62, "recoater", "start");
  else if (k === "ded") g = R(20, 100, 160, 12, "var(--surface-2)") + R(60, 72, 80, 28, part) + `<path d="M92 20 L108 20 L104 60 L96 60 Z" fill="var(--surface-2)" stroke="var(--text-2)"/>` + L(100, 60, 100, 72, laser, 3) + `<circle cx="100" cy="72" r="5" fill="${hot}"/>` + L(80, 30, 96, 62, "var(--muted)") + L(120, 30, 104, 62, "var(--muted)") + T(100, 128, "nozzle feeds powder / wire into the melt pool") + T(130, 18, "robot / CNC", "start");
  else if (k === "bjt") g = R(20, 70, 120, 40, powder) + R(55, 82, 50, 28, "#8a7a5a") + R(60, 30, 40, 12, "var(--surface-2)") + [66, 74, 82, 90].map((x) => `<circle cx="${x}" cy="${52 + (x % 3) * 6}" r="2" fill="#6a4a2a"/>`).join("") + T(80, 125, "print head jets binder – no melting") + T(150, 90, "→ sinter / cast", "start");
  else if (k === "mex") g = R(20, 104, 160, 8, "var(--surface-2)") + [0, 1, 2, 3, 4].map((i) => R(60, 96 - i * 8, 80, 8, part)).join("") + `<path d="M92 30 L108 30 L102 54 L98 54 Z" fill="var(--surface-2)" stroke="var(--text-2)"/>` + L(100, 54, 100, 58, hot, 3) + L(100, 6, 100, 30, "var(--muted)", 2) + T(100, 128, "hot nozzle draws plastic line by line") + T(106, 12, "filament", "start");
  else if (k === "vpp") g = R(30, 60, 140, 50, "rgba(120,170,230,.35)") + R(70, 20, 60, 8, "var(--surface-2)") + L(100, 28, 100, 56, "var(--muted)", 2) + R(75, 56, 50, 30, part) + L(100, 112, 100, 90, "#7a4ad6", 3) + T(100, 128, "UV light hardens resin layer by layer") + T(34, 72, "resin", "start");
  else if (k === "mjt") g = R(20, 100, 160, 10, "var(--surface-2)") + R(60, 76, 80, 24, part) + R(80, 76, 20, 24, "#d06aa0") + R(70, 30, 60, 12, "var(--surface-2)") + [80, 92, 104, 116].map((x) => `<circle cx="${x}" cy="56" r="2.5" fill="${x > 100 ? "#d06aa0" : part}"/>`).join("") + R(140, 40, 20, 8, "#7a4ad6") + T(100, 128, "jets drops of several materials, UV cures") ;
  else g = [0, 1, 2, 3, 4].map((i) => R(50, 96 - i * 9, 100, 7, i % 2 ? "#b0b8c0" : "#c8ced4")).join("") + R(150, 20, 14, 40, "var(--surface-2)") + T(100, 128, "foils welded / glued, then cut") + T(168, 40, "sonotrode", "start");
  return `<svg viewBox="0 0 200 135" class="am-schem" role="img" aria-label="schematic">${g}</svg>`;
}

/* ------------------------------------------------------------------ selector: score each process for a part */
const SEL0 = { mat: "metal", size: 150, qty: 20, need: "function", inner: true };
function score(S) {
  const out = TECH.map((t) => { let s = 0; const why = [];
    const add = (v, w) => { s += v; if (w) why.push((v > 0 ? "+ " : "− ") + w); };
    if (S.mat === "metal") { if (["pbf", "ded", "bjt", "shl"].includes(t.k)) add(3, "prints metal"); else add(-6, "no metal"); }
    if (S.mat === "polymer") { if (["mex", "vpp", "mjt"].includes(t.k)) add(3, "prints plastics"); else if (t.k === "pbf") add(3, "SLS / MJF polymer"); else add(-6, "no polymer"); }
    if (S.mat === "sand") { if (t.k === "bjt") add(8, "sand moulds / cores for casting"); else add(-8, "no sand"); }
    if (S.size > 600) { if (t.k === "ded" || (t.k === "mex")) add(3, "large parts possible"); else if (!(t.k === "bjt" && S.mat === "sand")) add(-4, "too big for the build box"); }
    else if (S.size < 60 && ["vpp", "mjt", "pbf"].includes(t.k)) add(1, "fine detail for small parts");
    if (S.inner) { if (["pbf", "bjt", "vpp", "mjt"].includes(t.k)) add(2, "inner channels possible"); if (t.k === "ded") add(-3, "no closed inner channels"); if (t.k === "mex") add(-1, "inner channels limited"); }
    if (S.need === "function") { if (t.k === "pbf") add(3, "dense metal / strong polymer"); if (t.k === "mjt") add(-2, "prototype material"); if (t.k === "vpp") add(-1, "brittle resins"); }
    if (S.need === "visual") { if (["vpp", "mjt"].includes(t.k)) add(3, "best surface / colour"); }
    if (S.need === "tooling") { if (t.k === "mex") add(4, "cheap jigs next to the line"); if (t.k === "pbf" && S.mat === "metal") add(2, "conformal-cooled inserts"); }
    if (S.need === "repair") { if (t.k === "ded") add(6, "builds on an existing part"); else add(-2, "cannot repair"); }
    if (S.qty > 500) { if (t.k === "bjt" && S.mat !== "sand") add(3, "fast + cheap in volume"); if (t.k === "pbf" && S.mat === "metal") add(-1, "expensive per part in volume"); }
    if (S.qty <= 5 && t.k === "mex") add(1, "cheap for one-offs");
    add(t.mature * 0.4, null);
    return { t, s, why }; });
  return out.sort((a, b) => b.s - a.s);
}

/* ------------------------------------------------------------------ render item 1 */
let built = false, sel = Object.assign({}, SEL0), active = Q.get("amtech") || "pbf";
function build() {
  const host = $("amItem1"); if (!host || built) return; built = true;
  host.innerHTML = `
  <div class="card"><div class="card-head"><h2>The 7 process families of additive manufacturing (ISO/ASTM 52900)</h2>
    <span class="sub">click a family · real industrial use · examples, not a recommendation of a brand</span></div>
    <div class="am-tgrid" id="amTGrid"></div>
    <div class="am-tdet" id="amTDet"></div></div>
  <div class="card"><div class="card-head"><h2>Which process for my part?</h2><span class="sub">simple scoring – a first direction, then ask 2–3 suppliers</span></div>
      <div class="am-form" id="amSel"></div><div id="amSelOut" class="am-wrap"></div></div>
  <div class="card"><div class="card-head"><h2>Where AM pays in YOUR compressor factory</h2><span class="sub">start from the top</span></div>
      <div class="am-wrap"><table class="am-tab"><thead><tr><th>Use</th><th>Process</th><th>Benefit (typical)</th><th>Priority</th></tr></thead>
      <tbody>${USES.map((u) => `<tr><td>${esc(u[0])}</td><td>${esc(u[1])}</td><td>${esc(u[2])}</td><td>${esc(u[3])}</td></tr>`).join("")}</tbody></table></div>
      <p class="am-note">Rule: use AM when the part gets <b>better</b> (lighter, inner channels, one part instead of many, no tooling, faster to get) – not to replace a simple casting that costs a few dollars.</p></div>
  <div class="card"><div class="card-head"><h2>How a modern AM factory is organised (digital thread)</h2><span class="sub">same as real AM production sites – ISO/ASTM 52920 / 52930</span></div>
    <div class="am-flow">${["CAD + design for AM (DfAM, topology optimisation, lattices)", "Build preparation (orientation, supports, nesting, slicing, simulation)", "MES: job, machine, parameter set, powder lot + reuse count", "Machine: print + in-process monitoring (melt pool, camera, O2) → data via OPC UA / MTConnect", "Post-processing: depowder → stress relief → cut → supports → HIP / HT → machining", "Quality: CT, CMM, coupons → digital build record", "ERP: cost per part, invoice, certificate 3.1"].map((s, i) => `<div class="am-fs"><b>${i + 1}</b>${esc(s)}</div>`).join('<div class="am-fa">→</div>')}</div>
    <p class="am-note">In real AM factories the printer is only ≈ 40–60 % of the work. Powder handling, post-processing and quality records decide if parts are good and the cost is right. Item 2 shows this chain for metal LPBF.</p></div>`;
  $("amTGrid").innerHTML = TECH.map((t) => `<button class="am-tc" data-amt="${t.k}">${schem(t.k)}<b>${esc(t.name)}</b><span class="am-mat">maturity ${"●".repeat(t.mature)}${"○".repeat(5 - t.mature)}</span></button>`).join("");
  $("amTGrid").addEventListener("click", (e) => { const b = e.target.closest("[data-amt]"); if (b) { active = b.dataset.amt; detail(); } });
  detail();
  const f = $("amSel");
  f.innerHTML = `
    <label>Material<select data-k="mat"><option value="metal">metal</option><option value="polymer">plastic</option><option value="sand">sand mould / core for casting</option></select></label>
    <label>Largest size (mm)<input type="number" data-k="size" min="5" max="5000" value="${sel.size}"></label>
    <label>Quantity per year<input type="number" data-k="qty" min="1" max="100000" value="${sel.qty}"></label>
    <label>What for<select data-k="need"><option value="function">functional part</option><option value="tooling">jig / fixture / tool</option><option value="visual">visual prototype</option><option value="repair">repair a worn part</option></select></label>
    <label class="am-chk"><input type="checkbox" data-k="inner" ${sel.inner ? "checked" : ""}> inner channels / closed cavities</label>`;
  f.addEventListener("input", (e) => { const k = e.target.dataset.k; if (!k) return; sel[k] = e.target.type === "checkbox" ? e.target.checked : e.target.type === "number" ? +e.target.value : e.target.value; selOut(); });
  selOut();
}
function detail() {
  document.querySelectorAll("[data-amt]").forEach((b) => b.classList.toggle("active", b.dataset.amt === active));
  const t = TECH.find((x) => x.k === active) || TECH[0];
  $("amTDet").innerHTML = `<div class="am-dh">${schem(t.k)}<div><h3 class="am-h">${esc(t.name)}</h3><div class="sub">${esc(t.sub)}</div><p>${esc(t.how)}</p></div></div>
  <table class="am-kv"><tbody>
    <tr><td>Materials</td><td>${esc(t.mat)}</td></tr><tr><td>Build size</td><td>${esc(t.size)}</td></tr>
    <tr><td>Accuracy</td><td>${esc(t.acc)}</td></tr><tr><td>Surface</td><td>${esc(t.ra)}</td></tr><tr><td>Speed</td><td>${esc(t.speed)}</td></tr>
    <tr><td>Machine price (class)</td><td>${esc(t.cost)}</td></tr><tr><td>Strengths</td><td>${esc(t.plus)}</td></tr><tr><td>Limits</td><td>${esc(t.minus)}</td></tr>
    <tr><td>Used in real factories</td><td><ul>${t.real.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></td></tr>
    <tr><td>For your factory</td><td><b>${esc(t.yours)}</b></td></tr></tbody></table>
  ${t.k === "pbf" ? `<button class="btn primary" id="amGo2">Open item 2 – LPBF metal process twin →</button>` : ""}`;
  const go = $("amGo2"); if (go) go.addEventListener("click", () => showItem("2"));
}
function selOut() {
  const r = score(sel), top = r[0].s;
  $("amSelOut").innerHTML = `<table class="am-tab"><thead><tr><th>#</th><th>Process</th><th>Score</th><th>Why</th></tr></thead><tbody>${r.map((x, i) =>
    `<tr class="${i === 0 ? "am-best" : x.s < top - 6 ? "am-dim" : ""}"><td>${i + 1}</td><td>${esc(x.t.name)}</td><td><span class="am-bar" style="width:${Math.max(4, Math.round(60 * Math.max(0, x.s) / Math.max(1, top)))}px"></span>${x.s.toFixed(1)}</td><td>${esc(x.why.join(" · "))}</td></tr>`).join("")}</tbody></table>`;
}

window.addEventListener("amitemshow", (e) => { if (e.detail === "1") build(); });
const tabOn = () => { const p = $("tab-am"); return p && p.classList.contains("active"); };
if (Q.get("amitem") && Q.get("amitem") !== "1") showItem(Q.get("amitem")); else if (tabOn() || location.hash === "#am") build();
