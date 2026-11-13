/* Additive manufacturing tab – item 3: INDUSTRY MAP – where AM is really used in the world (realistic, not hype).
 * Data = publicly reported, well-known industrial practice (rounded, approximate). Market shares differ between market
 * reports – they are shown as an approximate picture, not as exact statistics.
 * Deep link: /?amitem=3&amind=med#am   (field keys below) */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
import { APPS, DOS, MAKERS } from "./amind_data.js";
const Q = new URLSearchParams(location.search);

// maturity: 4 = series production (qualified, thousands of parts / year) · 3 = growing (in production at the leaders)
//           2 = pilot / niche · 1 = mostly research or hype
const LEVEL = { 4: ["Series production", "qualified, thousands+ parts per year, part of normal production"], 3: ["Growing", "in production at the leaders, spreading"], 2: ["Pilot / niche", "first projects, special cases"], 1: ["Research / hype", "talked about a lot, little real production"] };
const PROC = [["pbf", "PBF"], ["ded", "DED"], ["bjt", "BJT"], ["mex", "MEX"], ["vpp", "VPP"], ["mjt", "MJT"], ["shl", "SHL"]];

// p = use level per process family 0 none · 1 some · 2 common · 3 main process
const FIELDS = [
  { k: "aero", name: "Aerospace (aircraft + engines)", lvl: 4, p: { pbf: 3, ded: 2, bjt: 0, mex: 2, vpp: 1, mjt: 1, shl: 0 },
    parts: "fuel nozzle tips, brackets, sensor housings, ducts, heat exchangers, cabin plastic parts, tooling",
    why: "every kg saved saves fuel for 20–30 years; many small parts become one; low volumes; very high part value",
    ex: ["Fuel nozzle tips of the LEAP aero-engine (GE / CFM): printed in Co-Cr in series since 2015 – 20 parts became 1, ≈ 25 % lighter, well over 100 000 made", "GE Catalyst turboprop: ≈ 855 conventional parts replaced by 12 printed parts", "Airbus A350: more than 1 000 printed polymer (ULTEM) flight parts", "Boeing 787: titanium structural parts made by wire DED (Norsk Titanium), FAA-approved"],
    num: "printed parts 20–60 % lighter; lead time months → weeks", next: "more engine and structural parts, larger multi-laser machines, qualified digital spare parts",
    you: "Proof that AM works in series when the part has HIGH value and complex function." },
  { k: "space", name: "Space + rockets", lvl: 4, p: { pbf: 3, ded: 3, bjt: 0, mex: 1, vpp: 0, mjt: 0, shl: 0 },
    parts: "combustion chambers with cooling channels, injectors, turbopump parts, nozzles, satellite brackets and RF parts",
    why: "very complex cooled parts in tiny volumes; speed of development; mass",
    ex: ["SpaceX SuperDraco engine chamber printed in Inconel", "Rocket Lab Rutherford engine: main parts printed", "NASA RAMPT programme: large nozzles by DED", "Relativity Space started with 'fully printed' rockets and later moved to a mix of printed and conventional parts – a realistic lesson: print what benefits, not everything"],
    num: "engine development cycles from years to months", next: "standard practice for chambers and injectors; copper alloys (GRCop) and DED for big nozzles",
    you: "Cooling channels inside walls = same idea as conformal-cooled die inserts." },
  { k: "med", name: "Medical implants + instruments", lvl: 4, p: { pbf: 3, ded: 0, bjt: 0, mex: 1, vpp: 2, mjt: 1, shl: 0 },
    parts: "hip cups, knee and spine implants with lattice surface, patient-specific implants, surgical guides, instruments, anatomy models",
    why: "porous lattice lets bone grow in; implant made for one patient from CT data; complex shapes",
    ex: ["Titanium hip cups with lattice made by electron-beam PBF since ≈ 2007, now hundreds of thousands per year across implant makers", "Stryker runs a large titanium AM plant (Cork, Ireland) for orthopaedic implants", "Surgical cutting guides printed per patient in hospitals and labs"],
    num: "lattice porosity 60–80 %, pore size 300–700 µm for bone ingrowth", next: "more patient-specific implants, printing at the hospital (point of care)",
    you: "Shows the value of lattices and of a fully qualified, traceable process (like item 2's build record)." },
  { k: "dental", name: "Dental", lvl: 4, p: { pbf: 3, ded: 0, bjt: 0, mex: 0, vpp: 3, mjt: 1, shl: 0 },
    parts: "aligner moulds, crown + bridge frames (Co-Cr), dentures, models, surgical drill guides, splints",
    why: "every part is unique → no tooling; digital scan → print; huge numbers",
    ex: ["Clear-aligner makers print hundreds of thousands of unique moulds per day (SLA / DLP)", "Dental labs print Co-Cr crown and bridge frames by LPBF instead of casting", "Intra-oral scanners → printed models and guides in one day"],
    num: "one of the largest AM uses by number of parts", next: "printed permanent crowns and dentures from new resins",
    you: "Mass customisation: AM wins when every part is different – not when all parts are the same." },
  { k: "hear", name: "Hearing aids", lvl: 4, p: { pbf: 0, ded: 0, bjt: 0, mex: 0, vpp: 3, mjt: 0, shl: 0 },
    parts: "custom in-ear shells and ear moulds",
    why: "each ear is different; scan → print in hours",
    ex: ["Almost all custom in-ear hearing-aid shells in the world have been printed (SLA / DLP) for about 20 years – one of the first complete switches to AM"],
    num: "manual moulding → printing in a few years", next: "already complete – classic success story",
    you: "Complete switch happened because the part is small, unique and the digital chain is simple." },
  { k: "auto", name: "Automotive", lvl: 3, p: { pbf: 2, ded: 1, bjt: 2, mex: 3, vpp: 2, mjt: 2, shl: 0 },
    parts: "prototypes (main use), jigs + fixtures + gauges, tooling inserts, sand cores, low-volume luxury and motorsport parts, classic-car spare parts",
    why: "faster development; cheap tooling on the line; series only for low volumes or special function",
    ex: ["Car plants print thousands of assembly jigs, fixtures and gauges per year (e.g. VW, Ford, BMW plants)", "BMW Additive Manufacturing Campus near Munich: prototypes, tools and some series parts (e.g. a printed window guide rail in polymer)", "Porsche prints rare spare parts for classic cars; tested printed pistons with Mahle + Trumpf (2020)", "Formula 1 teams print thousands of parts per season"],
    num: "jigs: often 70–90 % cheaper and days instead of weeks", next: "more tooling, spare parts on demand; mass series parts stay cast / stamped / moulded",
    you: "★ Closest to you: copy the car plants – jigs, fixtures, grippers, gauges, prototypes, sand cores." },
  { k: "tool", name: "Tool + mould making", lvl: 4, p: { pbf: 3, ded: 2, bjt: 2, mex: 1, vpp: 1, mjt: 0, shl: 0 },
    parts: "conformal-cooled inserts for injection moulds and die-casting dies, repaired dies, sand moulds, forming tools",
    why: "cooling channels follow the surface → shorter cycle, less warp, fewer hot spots",
    ex: ["Conformal-cooled inserts (maraging 1.2709 / H13) are standard offers of many mould makers", "Die repair by laser DED (cladding) instead of a new die"],
    num: "typical cycle time −20 … −40 %, scrap down", next: "hybrid inserts (printed on a machined base), more H13 for die casting",
    you: "★ If you run your own casting dies or plastic moulds: conformal cooling + DED repair." },
  { k: "energy", name: "Energy (gas turbines, oil + gas, nuclear)", lvl: 3, p: { pbf: 3, ded: 3, bjt: 1, mex: 1, vpp: 0, mjt: 0, shl: 0 },
    parts: "burner tips, turbine vanes and blade repair, seals, impellers, valve parts, spare parts for old plants",
    why: "repair instead of replace; better cooling designs; spare parts for plants without drawings",
    ex: ["Siemens Energy repairs gas-turbine burner tips by printing a new tip onto the used part", "Oil + gas companies qualify printed spare parts (DNV standard for AM parts exists)", "Westinghouse installed a printed component in a nuclear power plant (2020)"],
    num: "repair lead time from months to weeks", next: "digital warehouses of qualified spare parts",
    you: "Repair + spare-part logic fits your service business (compressors in the field)." },
  { k: "mach", name: "Industrial machinery (pumps, compressors, valves, hydraulics)", lvl: 3, p: { pbf: 3, ded: 2, bjt: 2, mex: 2, vpp: 1, mjt: 0, shl: 0 },
    parts: "impellers, valve bodies, hydraulic manifolds with curved channels, heat exchangers, grippers, spare parts",
    why: "better flow (curved channels), lighter manifolds, spare parts without tooling, faster prototypes",
    ex: ["Printed hydraulic manifolds: curved channels, up to ≈ 70–80 % lighter and less pressure loss (several hydraulic makers)", "Pump and compressor makers print impeller prototypes and replacement impellers", "Printed heat exchangers for compact cooling"],
    num: "manifold weight −50 … −80 %, Δp down", next: "steady growth for flow parts and spare parts",
    you: "★ Your own industry: impeller / valve prototypes, cooling designs, spare parts, hydraulic manifolds (see Hydraulics tab)." },
  { k: "consumer", name: "Consumer products (shoes, eyewear, sport)", lvl: 3, p: { pbf: 2, ded: 0, bjt: 0, mex: 1, vpp: 3, mjt: 1, shl: 0 },
    parts: "shoe midsoles with lattice, eyewear frames, bike saddles, helmet liners, custom insoles",
    why: "lattices tuned for comfort; personalisation; design freedom",
    ex: ["Adidas 4D midsoles printed with Carbon's DLS process since 2017", "Printed lattice bike saddles and football-helmet liners (Carbon process)", "Eyewear frames in PA12 (SLS / MJF)"],
    num: "up to ≈ 100 000s of pairs per year for one shoe line", next: "more personalised products, lattice comfort parts",
    you: "Shows that AM can be series when the lattice gives a function you cannot mould." },
  { k: "rail", name: "Rail, maritime, defence – spare parts", lvl: 3, p: { pbf: 2, ded: 2, bjt: 0, mex: 3, vpp: 1, mjt: 0, shl: 0 },
    parts: "obsolete spare parts, seat parts, covers, propellers, field repairs",
    why: "vehicles live 30–40 years, suppliers disappear; no stock, no tooling",
    ex: ["Deutsche Bahn prints tens of thousands of spare parts for trains", "Navies and armies print parts on ships and in the field", "WAAM ship propeller (Damen / RAMLAB, 2017)"],
    num: "spare part lead time from months to days", next: "digital warehouses: store the file, not the part",
    you: "★ Spare parts for your compressors in the field (10–20 year life)." },
  { k: "foundry", name: "Foundry (sand printing)", lvl: 4, p: { pbf: 0, ded: 0, bjt: 3, mex: 0, vpp: 1, mjt: 0, shl: 0 },
    parts: "sand cores + moulds for engine blocks, cylinder heads, pump housings, valve bodies; casting patterns",
    why: "no pattern / core box; complex cores in one piece; prototype castings in days",
    ex: ["Foundries and service centres print sand cores and moulds for prototype and small-series castings of engine blocks, heads and pump housings", "Investment casting patterns printed in wax / resin"],
    num: "prototype casting 1–2 weeks instead of 2–4 months", next: "more series cores (inorganic binders), bigger printers",
    you: "★★ Highest direct value for you: prototype crankcases and heads without pattern cost." },
  { k: "elec", name: "Electronics + electrification", lvl: 2, p: { pbf: 2, ded: 0, bjt: 1, mex: 1, vpp: 1, mjt: 2, shl: 1 },
    parts: "copper induction coils, RF waveguides + antennas, heat sinks, e-motor cooling jackets, printed circuit prototypes",
    why: "copper parts with inner cooling; RF parts lighter; thermal management",
    ex: ["Copper induction coils for hardening machines printed in series by coil makers", "RF waveguides and antennas printed in aluminium for satellites"],
    num: "coil life often longer than brazed coils", next: "e-motor windings and cooling parts in pilot",
    you: "If you induction-harden (crankshafts): printed copper coils." },
  { k: "build", name: "Construction (concrete printing)", lvl: 2, p: { pbf: 0, ded: 0, bjt: 1, mex: 3, vpp: 0, mjt: 0, shl: 0 },
    parts: "walls of houses, small buildings, bridges, formwork",
    why: "free shapes, less formwork, fewer workers on site",
    ex: ["Printed houses in Texas (ICON) and Germany's first printed house in Beckum (2021)", "Printed pedestrian bridges in the Netherlands"],
    num: "wall printing in days; total house cost not yet clearly lower", next: "slow growth; codes and approvals limit it",
    you: "Not relevant for the factory, but you may see it in the news." },
  { k: "jewel", name: "Jewellery", lvl: 4, p: { pbf: 1, ded: 0, bjt: 0, mex: 0, vpp: 3, mjt: 2, shl: 0 },
    parts: "castable resin / wax patterns for investment casting, some direct-printed precious metal",
    why: "fine detail; every design different",
    ex: ["Most jewellery makers print castable patterns instead of carving wax"], num: "–", next: "steady", you: "Same investment-casting logic could make small complex metal parts." },
  { k: "hype", name: "Hype – not real production (yet)", lvl: 1, p: { pbf: 0, ded: 0, bjt: 0, mex: 1, vpp: 1, mjt: 0, shl: 0 },
    parts: "printed human organs, home printers replacing shopping, printed mass-production cars, printed food in restaurants",
    why: "big promises 2012–2015; reality: biology, speed and cost limits",
    ex: ["Bio-printing of organs is research (tissue samples, not transplants)", "Mass production of simple parts stays with casting, moulding, stamping – AM is ≈ 0.1–0.2 % of global manufacturing output"],
    num: "–", next: "long-term research", you: "Do not plan with hype – plan with the 'series production' fields above." },
];

// approximate share of AM revenue by sector (rounded picture of public market reports – differs by source and year)
const SHARE = [["Industrial machinery + tooling", 17], ["Aerospace + space", 16], ["Medical + dental", 15], ["Automotive", 14], ["Consumer products", 11], ["Academic + research", 8], ["Energy", 6], ["Electronics", 5], ["Other (construction, rail, maritime, jewellery …)", 8]];

let built = false, fMat = 0, fProc = "", sel = Q.get("amind") || "mach", dTab = Q.get("amdt") || "ov", cField = "", cSt = 0, cTxt = "";
function build() {
  const host = $("amItem3"); if (!host || built) return; built = true;
  host.innerHTML = `
  <div class="kpis">
    <div class="kpi"><div class="label">Global AM market</div><div class="value">≈ $20 bn</div><div class="note">per year, ≈ 2023 (machines, materials, services) – market-report estimate</div></div>
    <div class="kpi"><div class="label">Growth</div><div class="value">≈ 10–20 %</div><div class="note">per year in recent years</div></div>
    <div class="kpi"><div class="label">Share of all manufacturing</div><div class="value">≈ 0.1–0.2 %</div><div class="note">AM is small – it wins in special fields, not everywhere</div></div>
    <div class="kpi"><div class="label">Fields in series production</div><div class="value">${FIELDS.filter((f) => f.lvl === 4).length}</div><div class="note">of ${FIELDS.length - 1} fields shown (+ hype list)</div></div>
  </div>
  <div class="grid2 eq" style="margin-top:0">
    <div class="card"><div class="card-head"><h2>Approximate share of AM revenue by sector</h2><span class="sub">rounded picture – market reports differ</span></div><div id="amIndBar"></div></div>
    <div class="card"><div class="card-head"><h2>Which process each field uses</h2><span class="sub">dot size + shade = how common · hover for text</span></div><div id="amIndMx" class="am-wrap"></div></div>
  </div>
  <div class="card"><div class="card-head"><h2>Fields where AM is used – realistic maturity</h2><span class="sub">click a field for parts, reasons, public examples and the outlook</span></div>
    <div class="am-filt"><span class="sub">Maturity:</span>${[0, 4, 3, 2, 1].map((l) => `<button class="chip" data-lv="${l}">${l ? LEVEL[l][0] : "all"}</button>`).join("")}
      <span class="sub" style="margin-left:12px">Process:</span><select id="amIndP"><option value="">all</option>${PROC.map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select></div>
    <div class="am-wrap"><table class="am-tab am-indt" id="amIndT"></table></div>
    <div id="amIndD" class="am-indd"></div></div>
  <div class="grid2 eq" style="margin-top:0">
    <div class="card"><div class="card-head"><h2>The AM sweet spot – parts per year vs value per part</h2><span class="sub">each dot = one real application (≈ order of magnitude) · filled = series, hollow = growing / pilot · hover</span></div><div id="amIndSc"></div></div>
    <div class="card"><div class="card-head"><h2>When each field went into production</h2><span class="sub">first series / flight / clinical use as publicly reported (≈ year) · hover</span></div><div id="amIndTl"></div></div>
  </div>
  <div class="card"><div class="card-head"><h2>Applications catalogue – ${APPS.length} applications in real industry</h2><span class="sub">filter · click a row to open its field · volumes and values are order-of-magnitude estimates · <button class="btn ghost am-sm" id="amCsv">Download CSV</button></span></div>
    <div class="am-filt"><span class="sub">Field:</span><select id="amCF"><option value="">all</option>${FIELDS.filter((f) => f.k !== "hype").map((f) => `<option value="${f.k}">${esc(f.name.split(" (")[0])}</option>`).join("")}</select>
      <span class="sub" style="margin-left:10px">Status:</span><select id="amCS"><option value="0">all</option><option value="4">series</option><option value="3">growing</option><option value="2">pilot</option></select>
      <input type="search" id="amCT" placeholder="search part, material, company …" style="min-width:240px"></div>
    <div class="am-wrap"><table class="am-tab" id="amCat"></table></div></div>
  <div class="card"><div class="card-head"><h2>Machine makers by process</h2><span class="sub">examples of companies active in each process (not complete, not a recommendation)</span></div>
    <table class="am-tab"><tbody>${MAKERS.map(([a, b]) => `<tr><td style="width:28%"><b>${esc(a)}</b></td><td>${esc(b)}</td></tr>`).join("")}</tbody></table></div>
  <div class="card"><div class="card-head"><h2>What the world shows – rules for your factory</h2></div>
    <ol class="am-rules">
      <li><b>AM wins where parts are unique, complex or low-volume with high value</b> (implants, dental, aerospace, tooling). It loses for simple parts in big numbers.</li>
      <li><b>The first win in every machine-building company is the same:</b> jigs, fixtures, grippers, gauges and prototypes (car plants, machinery makers).</li>
      <li><b>For a compressor maker the realistic order is:</b> FFF / MJF jigs → sand-printed cores for prototype castings (service bureau) → printed spare parts + conformal-cooled inserts → own metal LPBF only with enough hours.</li>
      <li><b>Series success needs a qualified, traceable process</b> (powder, parameters, monitoring, CT, records) – see item 2.</li>
      <li><b>Ignore hype</b>: fields at "Research / hype" are not a basis for investment.</li>
    </ol></div>`;
  bar(); mx(); table(); detail(); scatter(); timeline(); cat();
  $("amIndD").addEventListener("click", (e) => { const b = e.target.closest("[data-dt]"); if (b && !b.disabled) { dTab = b.dataset.dt; detail(); } });
  $("amCF").addEventListener("change", (e) => { cField = e.target.value; cat(); });
  $("amCS").addEventListener("change", (e) => { cSt = +e.target.value; cat(); });
  $("amCT").addEventListener("input", (e) => { cTxt = e.target.value.toLowerCase(); cat(); });
  $("amCat").addEventListener("click", (e) => { const r = e.target.closest("[data-af]"); if (r) { sel = r.dataset.af; table(); detail(); scatter(); $("amIndD").scrollIntoView({ behavior: "smooth", block: "start" }); } });
  $("amCsv").addEventListener("click", csv);
  host.querySelector(".am-filt").addEventListener("click", (e) => { const b = e.target.closest("[data-lv]"); if (b) { fMat = +b.dataset.lv; table(); } });
  $("amIndP").addEventListener("change", (e) => { fProc = e.target.value; table(); mx(); });
  $("amIndT").addEventListener("click", (e) => { const r = e.target.closest("[data-f]"); if (r) { sel = r.dataset.f; table(); detail(); scatter(); } });
}

/* single-series horizontal bar chart, one hue, hover tooltip */
function bar() {
  const W = 560, rowH = 28, L = 250, H = SHARE.length * rowH + 24, max = 20, sx = (v) => (v / max) * (W - L - 50);
  const rows = SHARE.map(([n, v], i) => { const y = 8 + i * rowH, w = sx(v);
    return `<g class="am-hb" data-tip="${esc(n)}: ≈ ${v} % of AM revenue">
      <rect x="0" y="${y - 2}" width="${W}" height="${rowH}" class="am-hit"/>
      <text x="${L - 8}" y="${y + 14}" text-anchor="end" class="am-s">${esc(n)}</text>
      <path d="M${L} ${y + 4} h${w - 4} a4 4 0 0 1 4 4 v6 a4 4 0 0 1 -4 4 h${-(w - 4)} Z" class="am-barm"/>
      <text x="${L + w + 6}" y="${y + 14}" class="am-s">≈ ${v} %</text></g>`; }).join("");
  const grid = [0, 5, 10, 15, 20].map((g) => `<line x1="${L + sx(g)}" y1="4" x2="${L + sx(g)}" y2="${H - 18}" class="am-grid"/><text x="${L + sx(g)}" y="${H - 4}" text-anchor="middle" class="am-s">${g} %</text>`).join("");
  $("amIndBar").innerHTML = `<div class="am-chart"><svg viewBox="0 0 ${W} ${H}" class="am-svgc">${grid}${rows}</svg><div class="am-tip" hidden></div></div>`;
  tips($("amIndBar"));
}
/* field × process matrix: dot size + shade (one hue) = level, hover text */
function mx() {
  const rows = FIELDS.filter((f) => f.k !== "hype"), cw = 52, L = 250, rh = 24, W = L + PROC.length * cw + 10, H = rows.length * rh + 30;
  const words = ["not used", "some use", "common", "main process"];
  const g = rows.map((f, i) => { const y = 30 + i * rh;
    return `<text x="${L - 8}" y="${y + 4}" text-anchor="end" class="am-s">${esc(f.name.split(" (")[0])}</text>` + PROC.map(([k, n], j) => { const v = f.p[k], x = L + j * cw + cw / 2, dim = fProc && fProc !== k;
      return `<g data-tip="${esc(f.name)} · ${n}: ${words[v]}"><rect x="${x - cw / 2}" y="${y - rh / 2}" width="${cw}" height="${rh}" class="am-hit"/>${v ? `<circle cx="${x}" cy="${y}" r="${3 + v * 2.5}" class="am-mxd" style="opacity:${dim ? 0.15 : 0.3 + v * 0.23}"/>` : `<text x="${x}" y="${y + 4}" text-anchor="middle" class="am-s am-faint">·</text>`}</g>`; }).join(""); }).join("");
  const head = PROC.map(([k, n], j) => `<text x="${L + j * cw + cw / 2}" y="14" text-anchor="middle" class="am-s am-b">${n}</text>`).join("");
  $("amIndMx").innerHTML = `<div class="am-chart"><svg viewBox="0 0 ${W} ${H}" class="am-svgc" style="min-width:560px">${head}${g}</svg><div class="am-tip" hidden></div></div>
    <p class="am-note">PBF powder bed fusion · DED directed energy deposition · BJT binder jetting · MEX material extrusion · VPP vat photopolymerization · MJT material jetting · SHL sheet lamination (see item 1). Small dot = some use, big dark dot = main process.</p>`;
  tips($("amIndMx"));
}
function tips(host) {
  const tip = host.querySelector(".am-tip"), box = host.querySelector(".am-chart");
  box.addEventListener("mousemove", (e) => { const g = e.target.closest("[data-tip]"); if (!g) { tip.hidden = true; return; }
    const r = box.getBoundingClientRect(); tip.textContent = g.dataset.tip; tip.hidden = false;
    tip.style.left = Math.min(r.width - 220, e.clientX - r.left + 12) + "px"; tip.style.top = (e.clientY - r.top + 12) + "px"; });
  box.addEventListener("mouseleave", () => { tip.hidden = true; });
}
function table() {
  document.querySelectorAll("[data-lv]").forEach((b) => b.classList.toggle("am-sel", +b.dataset.lv === fMat));
  const rows = FIELDS.filter((f) => (!fMat || f.lvl === fMat) && (!fProc || f.p[fProc] >= 2));
  const lvl = (l) => `<span class="am-lv">${"●".repeat(l)}${"○".repeat(4 - l)}</span> ${LEVEL[l][0]}`;
  $("amIndT").innerHTML = `<thead><tr><th>Field</th><th>Maturity</th><th>Typical parts</th><th>Main processes</th></tr></thead><tbody>${rows.map((f) =>
    `<tr data-f="${f.k}" class="${f.k === sel ? "am-best" : ""}"><td><b>${esc(f.name)}</b></td><td>${lvl(f.lvl)}</td><td>${esc(f.parts)}</td><td>${PROC.filter(([k]) => f.p[k] >= 2).map(([, n]) => n).join(", ") || "–"}</td></tr>`).join("") || `<tr><td colspan="4" class="sub">no field matches the filter</td></tr>`}</tbody>`;
}
const STN = { 4: "series", 3: "growing", 2: "pilot" };
const lg = (v) => Math.log10(Math.max(1, v));
const fmtN = (v) => v >= 1e6 ? (v / 1e6) + " M" : v >= 1e3 ? (v / 1e3) + " k" : String(v);
function detail() {
  const f = FIELDS.find((x) => x.k === sel) || FIELDS[0], D = DOS[f.k], apps = APPS.filter((a) => a[0] === f.k);
  if (!D) dTab = "ov";
  const tabs = [["ov", "Overview"], ["app", `Applications (${apps.length})`], ["case", `Case studies (${D ? D.cases.length : 0})`], ["num", "Key numbers"], ["std", "Standards + qualification"], ["chain", "Who prints · barriers · lesson"]];
  let body = "";
  if (dTab === "ov") body = `<table class="am-kv"><tbody><tr><td>Typical parts</td><td>${esc(f.parts)}</td></tr><tr><td>Why AM wins here</td><td>${esc(f.why)}</td></tr>
    ${D ? `<tr><td>In production since</td><td>${esc(D.since)}</td></tr><tr><td>Scale today</td><td>${esc(D.scale)}</td></tr>` : ""}
    <tr><td>Main processes</td><td>${PROC.filter(([k]) => f.p[k] >= 2).map(([, n]) => n).join(", ") || "–"}</td></tr>
    <tr><td>Public examples</td><td><ul>${f.ex.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></td></tr><tr><td>Typical numbers</td><td>${esc(f.num)}</td></tr>
    <tr><td>Realistic outlook (≈ 5 years)</td><td>${esc(f.next)}</td></tr><tr><td>For your factory</td><td><b>${esc(f.you)}</b></td></tr></tbody></table>`;
  else if (dTab === "app") body = `<div class="am-wrap"><table class="am-tab"><thead><tr><th>Application</th><th>Part</th><th>Process</th><th>Material</th><th>Since ≈</th><th>Parts / year ≈</th><th>Value / part ≈</th><th>Benefit</th><th>Example</th><th>Status</th></tr></thead><tbody>${apps.map((a) =>
    `<tr><td><b>${esc(a[1])}</b></td><td>${esc(a[2])}</td><td>${esc(a[3])}</td><td>${esc(a[4])}</td><td>${a[5]}</td><td>${fmtN(a[6])}</td><td>$${a[7].toLocaleString("en-US")}</td><td>${esc(a[8])}</td><td>${esc(a[9])}</td><td>${STN[a[10]]}</td></tr>`).join("")}</tbody></table></div>`;
  else if (dTab === "case") body = `<div class="am-cases">${D.cases.slice().sort((a, b) => a[0] - b[0]).map((c) => `<div class="am-case"><div class="am-cy">${c[0]}</div><div><b>${esc(c[1])}</b> – ${esc(c[2])}<div class="sub">${esc(c[3])}</div><div>→ ${esc(c[4])}</div></div></div>`).join("")}</div>`;
  else if (dTab === "num") { const sum = apps.reduce((s, a) => s + a[6] * a[7], 0);
    body = `<table class="am-kv"><tbody>${D.kpi.map(([a, b]) => `<tr><td>${esc(a)}</td><td><b>${esc(b)}</b></td></tr>`).join("")}
      <tr><td>Printed parts per year (sum of the listed applications, ≈)</td><td>${fmtN(apps.reduce((s, a) => s + a[6], 0))}</td></tr>
      <tr><td>Value of these parts per year (≈ volume × value)</td><td>≈ $${sum >= 1e9 ? (sum / 1e9).toFixed(1) + " bn" : (sum / 1e6).toFixed(0) + " M"}</td></tr></tbody></table>
      <p class="am-note">The last two lines only add up the applications in this catalogue (order-of-magnitude estimates) – they show the size class, not a market statistic.</p>`; }
  else if (dTab === "std") body = `<ul class="am-ul">${D.std.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><p class="am-note">Standards named for orientation – always use the current edition and the rules of your customer / authority.</p>`;
  else body = `<table class="am-kv"><tbody><tr><td>Who prints</td><td>${esc(D.chain)}</td></tr><tr><td>Main barriers</td><td>${esc(D.barrier)}</td></tr><tr><td>Lesson</td><td><b>${esc(D.lesson)}</b></td></tr></tbody></table>`;
  $("amIndD").innerHTML = `<h3 class="am-h">${esc(f.name)} – ${LEVEL[f.lvl][0]}</h3><div class="sub">${esc(LEVEL[f.lvl][1])}</div>
    <div class="mx-nav am-dtabs">${tabs.map(([k, n]) => `<button class="mx-el ${k === dTab ? "active" : ""}" data-dt="${k}" ${!D && k !== "ov" ? "disabled" : ""}>${n}</button>`).join("")}</div>${body}`;
}
/* log-log scatter: parts per year (x) vs value per part (y) */
function scatter() {
  const W = 620, H = 400, L = 60, R = 16, T = 16, B = 46, x0 = 0, x1 = 8, y0 = 0, y1 = 5.3;
  const sx = (v) => L + (lg(v) - x0) / (x1 - x0) * (W - L - R), sy = (v) => H - B - (lg(v) - y0) / (y1 - y0) * (H - T - B);
  let g = "";
  for (let e = 0; e <= 8; e++) g += `<line x1="${sx(10 ** e)}" y1="${T}" x2="${sx(10 ** e)}" y2="${H - B}" class="am-grid"/><text x="${sx(10 ** e)}" y="${H - B + 16}" text-anchor="middle" class="am-s">${fmtN(10 ** e)}</text>`;
  for (let e = 0; e <= 5; e++) g += `<line x1="${L}" y1="${sy(10 ** e)}" x2="${W - R}" y2="${sy(10 ** e)}" class="am-grid"/><text x="${L - 6}" y="${sy(10 ** e) + 4}" text-anchor="end" class="am-s">$${fmtN(10 ** e)}</text>`;
  g += `<text x="${(L + W - R) / 2}" y="${H - 8}" text-anchor="middle" class="am-s">parts per year (log scale)</text><text transform="translate(14 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle" class="am-s">value per part (log scale)</text>`;
  g += `<text x="${sx(1.5)}" y="${sy(150000)}" class="am-s am-b">high value, few parts</text><text x="${sx(1.5)}" y="${sy(90000)}" class="am-s">aero, space, energy, tooling</text>`;
  g += `<text x="${sx(1.5e5)}" y="${sy(3)}" class="am-s am-b">mass customisation</text><text x="${sx(1.5e5)}" y="${sy(1.7)}" class="am-s">dental, hearing, jewellery</text>`;
  g += `<text x="${sx(3e4)}" y="${sy(60000)}" class="am-s am-faint">big series of standard parts: casting / moulding win</text>`;
  const pts = APPS.map((a) => { const on = a[0] === sel, x = sx(a[6]), y = sy(a[7]), r = on ? 6.5 : 4.5;
    return `<g data-tip="${esc(a[1])} · ${esc(a[3])} · ≈ ${fmtN(a[6])} parts/year · ≈ $${a[7].toLocaleString("en-US")} each · ${STN[a[10]]}"><circle cx="${x}" cy="${y}" r="12" class="am-hit"/><circle cx="${x}" cy="${y}" r="${r}" class="am-scd ${a[10] === 4 ? "" : "am-hol"} ${on ? "am-on2" : "am-fade"}"/></g>`; }).join("");
  $("amIndSc").innerHTML = `<div class="am-chart"><svg viewBox="0 0 ${W} ${H}" class="am-svgc">${g}${pts}</svg><div class="am-tip" hidden></div></div>
    <p class="am-note">Highlighted: ${esc((FIELDS.find((f) => f.k === sel) || {}).name || "")}. AM is used where parts are expensive and few (top left) or cheap but all different (bottom right).</p>`;
  tips($("amIndSc"));
}
/* timeline: one row per field, dots at the start year of each application */
function timeline() {
  const rows = FIELDS.filter((f) => f.k !== "hype"), W = 620, L = 170, R = 14, rh = 22, T = 10, H = T + rows.length * rh + 30, ya = 1990, yb = 2025;
  const sx = (y) => L + (y - ya) / (yb - ya) * (W - L - R);
  let g = "";
  for (let y = 1990; y <= 2025; y += 5) g += `<line x1="${sx(y)}" y1="${T}" x2="${sx(y)}" y2="${H - 26}" class="am-grid"/><text x="${sx(y)}" y="${H - 10}" text-anchor="middle" class="am-s">${y}</text>`;
  rows.forEach((f, i) => { const y = T + i * rh + rh / 2, apps = APPS.filter((a) => a[0] === f.k);
    g += `<text x="${L - 8}" y="${y + 4}" text-anchor="end" class="am-s">${esc(f.name.split(" (")[0].split(" –")[0])}</text><line x1="${L}" y1="${y}" x2="${W - R}" y2="${y}" class="am-grid"/>`;
    apps.forEach((a) => { const x = sx(Math.max(ya, a[5])); g += `<g data-tip="${a[5]}: ${esc(a[1])} (${STN[a[10]]})"><circle cx="${x}" cy="${y}" r="10" class="am-hit"/><circle cx="${x}" cy="${y}" r="4.5" class="am-scd ${a[10] === 4 ? "" : "am-hol"}"/></g>`; }); });
  $("amIndTl").innerHTML = `<div class="am-chart"><svg viewBox="0 0 ${W} ${H}" class="am-svgc">${g}</svg><div class="am-tip" hidden></div></div>
    <p class="am-note">Prototyping started around 1990; the first full series switches were hearing aids and dental (≈ 2000–2006), then implants (≈ 2007), aerospace (≈ 2015) and machinery / spare parts (≈ 2015–2018).</p>`;
  tips($("amIndTl"));
}
function cat() {
  const rows = APPS.filter((a) => (!cField || a[0] === cField) && (!cSt || a[10] === cSt) && (!cTxt || a.join(" ").toLowerCase().includes(cTxt)));
  const fname = (k) => (FIELDS.find((f) => f.k === k) || {}).name || k;
  $("amCat").innerHTML = `<thead><tr><th>Field</th><th>Application</th><th>Process · material</th><th>Since ≈</th><th>Parts / yr ≈</th><th>$ / part ≈</th><th>Benefit · public example</th><th>Status</th></tr></thead><tbody>${rows.map((a) =>
    `<tr data-af="${a[0]}" class="am-click"><td>${esc(fname(a[0]).split(" (")[0])}</td><td><b>${esc(a[1])}</b><div class="sub">${esc(a[2])}</div></td><td>${esc(a[3])}<div class="sub">${esc(a[4])}</div></td><td>${a[5]}</td><td>${fmtN(a[6])}</td><td>${a[7].toLocaleString("en-US")}</td><td>${esc(a[8])}<div class="sub">${esc(a[9])}</div></td><td>${STN[a[10]]}</td></tr>`).join("") || `<tr><td colspan="8" class="sub">no application matches</td></tr>`}</tbody>
    <tfoot><tr><td colspan="8" class="sub">${rows.length} of ${APPS.length} applications</td></tr></tfoot>`;
}
function csv() {
  const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
  const head = ["field", "application", "part", "process", "material", "since_approx", "parts_per_year_approx", "usd_per_part_approx", "benefit", "example", "status"];
  const txt = "﻿" + [head.join(",")].concat(APPS.map((a) => a.slice(0, 10).map(q).concat(q(STN[a[10]])).join(","))).join("\r\n");
  const el = document.createElement("a"); el.href = URL.createObjectURL(new Blob([txt], { type: "text/csv" })); el.download = "am_applications_catalogue.csv"; el.click(); setTimeout(() => URL.revokeObjectURL(el.href), 2000);
}

window.addEventListener("amitemshow", (e) => { if (e.detail === "3") build(); });
if (window.amCtl && window.amCtl.current() === "3") build();
