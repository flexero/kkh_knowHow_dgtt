/* HMC build tab - item 2: DIGITAL TWIN of the worm manufacturing process (the duplex worm of the rotary table, item 1).
   From the saw cut to the inspection and the test bench: every operation is animated (2D SVG) and every worm gets a
   PART RECORD - simulated measured values with random variation + optional process faults, so you can see where a fault
   starts and which check finds it.  Inspection charts (lead, profile, runout, pitch, over-wire size), test bench charts
   (transmission error, backlash vs axial shift, contact pattern, run-in temperature), lot simulation with Cpk, time + cost
   per worm.  Worm geometry comes from item 1 (window.HMCROT).  All values are examples.  Offline, no libraries. */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f = (v, d = 1) => (Number.isFinite(v) ? (Math.round(v * 10 ** d) / 10 ** d).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: 0 }) : "–");
const RAD = Math.PI / 180, SEC = 180 / Math.PI * 3600, AL = 20 * RAD, ALS = 11.5e-6;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ease = (u) => u * u * (3 - 2 * u), lerp = (a, b, t) => a + (b - a) * t;
const SW = 760, SH = 380, STEEL = "#aab4bd", HARD = "#7f8c9c", GRD = "#e3e9ee", CARB = "#e0a030", WHEEL = "#c9b48f";
const CL = "var(--accent)", CR = "var(--maint)";

function rngOf(seed) { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }

/* ------------------------------------------------------------------ inputs */
const DEFW = { m: 4, z1: 1, d1: 50, z2: 90, dp: 0.2, j0: 0.05, jt: 0.008, mu: 0.03 };
function wormData() {
  const H = window.HMCROT && window.HMCROT.M;
  return H ? { m: H.m, z1: H.z1, d1: H.d1, z2: H.z2, dp: H.dp, j0: H.j0, jt: H.jt, mu: H.mu } : { ...DEFW };
}
const GROUPS = [
  ["Order + turning", [
    ["lot", "Lot size (worms per order)", "pcs", 20, "set-up time is shared"],
    ["vcT", "Turning cutting speed", "m/min", 200, "coated carbide"],
    ["fT", "Turning feed", "mm/rev", 0.3, ""],
    ["apT", "Turning depth of cut", "mm", 2, ""],
    ["s0", "Grinding stock per flank", "mm", 0.25, "0.2–0.3 after hardening"]]],
  ["Heat treatment (case hardening)", [
    ["tc", "Carburising time at 925 °C", "h", 5, "boost + diffuse"],
    ["charge", "Worms per furnace charge", "pcs", 100, ""],
    ["chdMin", "Min. case depth on the finished worm", "mm", 0.6, "≈ 0.15 · m"]]],
  ["Thread grinding", [
    ["aer", "Rough infeed per pass", "mm", 0.03, "normal to the flank"],
    ["aef", "Finish infeed per pass", "mm", 0.01, "2 passes + 1 spark-out"],
    ["nw", "Worm speed while grinding", "rpm", 30, ""],
    ["dressN", "Dress the wheel every … passes", "", 6, ""],
    ["dTc", "Coolant temperature drift", "K", 0.5, "oil chiller ±0.5 K"],
    ["qlim", "Burn limit Q'w (from grinding trials)", "mm³/(mm·s)", 4, ""]]],
  ["Tolerances (example ≈ DIN 3974 class 5)", [
    ["tHb", "Lead slope fHβ, each flank", "± µm", 4, ""],
    ["tFa", "Profile total Fα", "µm", 5, ""],
    ["tFr", "Runout Fr of the thread", "µm", 6, ""],
    ["tfp", "Single axial pitch fpx", "± µm", 3, ""],
    ["tRun", "Bearing seat runout", "µm", 3, ""],
    ["tM", "Over-wire size M (middle)", "± µm", 25, ""],
    ["tTE", "Single-flank error f'i (bench)", "″", 3, "arc seconds"]]],
  ["Test bench", [
    ["Tt", "Test torque at the wheel", "N·m", 300, ""],
    ["nT", "Wheel speed during run-in", "rpm", 10, ""],
    ["hA", "Heat transfer of the test gearbox", "W/K", 12, ""],
    ["sRange", "Axial adjustment range of the worm", "mm", 5, "item 1"]]],
  ["Cost (example rates)", [
    ["matKg", "Bar material", "$/kg", 2.5, ""],
    ["rSaw", "Saw", "$/h", 30, ""], ["rLathe", "CNC lathe", "$/h", 50, ""], ["rHT", "Furnace (per charge hour)", "$/h", 80, ""],
    ["rGrind", "Cylindrical grinder", "$/h", 70, ""], ["rWG", "Worm grinding machine", "$/h", 120, ""],
    ["rMeas", "Measuring room", "$/h", 90, ""], ["rBench", "Test bench", "$/h", 40, ""]]],
];
const DEF = { thr: "whirl" }; GROUPS.forEach(([, fs]) => fs.forEach(([k, , , d]) => { DEF[k] = d; }));
const THR = {
  whirl: { n: "Thread whirling", mc: "CNC lathe with whirling unit", t: "whirling ring with 4–6 form inserts, 1500–3000 rpm, tilted by γ; the worm turns slowly" },
  lathe: { n: "Single-point threading", mc: "CNC lathe (G76 / G33)", t: "one form tool, many passes with alternating flank infeed – simple, but slow" },
  mill: { n: "Disc-cutter milling", mc: "Thread milling machine", t: "disc cutter tilted by γ, 1 pass per flank – series production" },
};
const FAULTS = [
  ["stock", "Thread roughed almost to size (stock 0.03 mm)", "starts Op 40 · wire check at Op 40 finds it, else Op 80/90"],
  ["hard", "Carburising time too short (1.5 h)", "starts Op 50 · coupon test at Op 60 finds it"],
  ["centre", "Centre holes not re-ground after hardening", "starts Op 60 · found at Op 70 / 100 / 110"],
  ["burn", "Grinding burn (coolant nozzle blocked)", "starts Op 80 · nital etch at Op 90 finds it"],
  ["thermal", "Coolant not cooled (+6 K drift)", "starts Op 80 · lead check at Op 100 finds it"],
  ["dress", "Wheel dressed too rarely (every 40 passes)", "starts Op 80 · profile at Op 100 + bench"],
  ["duplex", "Wrong duplex lead in the CNC program (Δp / 2)", "starts Op 80 · lead at Op 100 + backlash at Op 110"],
];
const OPS = [
  { k: "saw", no: 10, n: "Saw", mc: "Band saw", steps: (g) => [`Take a Ø${g.Db} bar of 16MnCr5 from the store, check the 3.1 material certificate`, "Clamp in the vise, cut to length (bimetal blade)", "Stamp the heat number – from now on every value goes into the part record"] },
  { k: "face", no: 20, n: "Face + centre", mc: "CNC lathe / centring machine", steps: () => ["Clamp in the chuck, support with a steady rest", "Face the end to length", "Drill the centre hole DIN 332 form B (60° cone + 120° protecting chamfer)", "Turn the part around, face and centre the other end", "Check length + centre cone contact (blue paint)"] },
  { k: "turn", no: 30, n: "Rough turn", mc: "CNC lathe, between centres", steps: (g) => ["Clamp between centres, drive dog on the journal", "Rough turn all diameters in passes (contour cycle)", "Ground diameters keep +0.6 mm, the others are finished now", `Chamfers, undercuts, end thread M${g.dJ} (stays soft)`] },
  { k: "thread", no: 40, n: "Rough thread", mc: "", steps: (g, P) => [`${THR[P.thr].n}: ${THR[P.thr].t}`, `Cut flank by flank: L flank with lead ${f(g.pL, 3)} mm, R flank with lead ${f(g.pR, 3)} mm (duplex)`, `Leave the grinding stock ${P.s0} mm per flank, root cut to the final Ø${f(g.df, 1)}`, "Check over 3 wires: M_soft = M₀ + 2·s₀ / sin 20° (±0.08 mm)", "Deburr, wash, copper paste on the soft end thread + centre holes"] },
  { k: "ht", no: 50, n: "Case harden", mc: "Sealed-quench furnace + tempering furnace", steps: () => ["Hang the worms on a fixture (they bend less hanging)", "Heat to 925 °C and carburise: carbon diffuses into the surface", "Cool to 840 °C, quench in oil → hard martensite case, tough core", "Wash, temper 180 °C / 2 h (less brittle, stable size)", "Check runout, straighten carefully if > 0.04 mm, crack test"] },
  { k: "prep", no: 60, n: "Test + centres", mc: "Shot blast · hardness tester · centre-hole grinder", steps: () => ["Shot blast: remove scale and copper paste", "Hardness: HRC on the end face, HV1 traverse on the coupon → case depth CHD", "Grind the centre holes again – heat treatment distorts them"] },
  { k: "cyl", no: 70, n: "Cyl. grind", mc: "CNC cylindrical grinder", steps: () => ["Clamp between the re-ground centres", "Plunge grind the journal and the 2 bearing seats (in-process gauge)", "Traverse grind the thread tip diameter", "Check seat Ø, roundness, runout to the common axis A–B"] },
  { k: "tg", no: 80, n: "Thread grind", mc: "CNC worm grinding machine", steps: (g, P) => ["Mount between centres; a probe finds the pre-cut thread and aligns the wheel to the gap (\"mesh in\")", "Dress the wheel profile with the diamond roll", `Grind the L flank with lead ${f(g.pL, 3)} mm, dress every ${P.dressN} passes`, `Grind the R flank with lead ${f(g.pR, 3)} mm`, "Finish passes + spark-out, coolant temperature kept constant"] },
  { k: "etch", no: 90, n: "Burn test", mc: "Nital etch line (ISO 14104)", steps: () => ["Degrease", "Etch in nital (3 % nitric acid in alcohol): burnt areas turn dark", "Rinse, bleach, neutralise, dry", "Look at every flank under bright light: uniform grey = OK"] },
  { k: "gmm", no: 100, n: "Inspection", mc: "Gear measuring machine · 3 wires · roughness", steps: () => ["Let the worm rest 2 h at 20 °C in the measuring room", "Lead scan on both flanks (probe ball moves along the flank)", "Profile scan on both flanks", "Runout: ball in the gap at 12 angles", "Axial pitch; over-wire size M at 4 places (duplex: M grows along the worm)", "Roughness Ra on the flanks"] },
  { k: "bench", no: 110, n: "Test bench", mc: "Worm gear test bench + master wheel", steps: () => ["Mount the worm in the test gearbox with the master wheel at centre distance a", "Single-flank rolling test: 2 encoders → transmission error", "Shift the worm axially, measure the backlash at 6 positions", "Marking paste: contact pattern", "Run-in 2 h under load: temperature, efficiency, noise"] },
  { k: "fin", no: 120, n: "Finish", mc: "Demagnetiser · laser marker · packing", steps: () => ["Demagnetise (residual field ≤ 0.3 mT)", "Laser mark serial no. + matched-pair no.", "Rust protection oil, VCI bag, box", "Close the part record (\"birth certificate\") – it goes with the worm"] },
];
const TOL = { k5: [0.002, 0.011], h6: [-0.013, 0], h8: [-0.046, 0] };
/* Equipment per operation: machine (with the REQUIRED capability = purchase spec), tooling, workholding, gauges, consumables.
   Generic types + capability values (examples) - ask 2-3 suppliers for each, compare against these numbers. */
const EQUIP = {
  saw: (g) => ({ mc: `Automatic band saw (horizontal, double-column), capacity round ≥ Ø250 mm, bar feed + length stop ±0.3 mm, blade speed 20–100 m/min variable, coolant`,
    tool: "Bimetal blade M42 27 × 0.9 mm, 4/6 TPI variable pitch (for Ø50–80 solid steel), 35–45 m/min in 16MnCr5",
    fix: "Hydraulic vise + bar support rollers", gauge: "Length stop / steel tape (±0.5 mm), material certificate EN 10204 3.1 check, heat-number stamps",
    cons: `Emulsion 5–8 %, bar 16MnCr5 Ø${g.Db} (+0/−… hot rolled or peeled)` }),
  face: (g, P, R) => ({ mc: "CNC lathe with 3-jaw chuck Ø200 + self-centring steady rest (or a facing-centring machine for series): spindle ≥ 3000 rpm, ≥ 7.5 kW",
    tool: `Facing insert CNMG 12 04 08 (P25, CVD coated); centre drill DIN 333 form ${R.O.face.cd.split(" ")[1] ? "B " + R.O.face.cd.split(" ")[1] : "B"} (HSS-E)`,
    fix: "Steady rest set on the bar (runout ≤ 0.02 at the end), soft jaws", gauge: "Vernier caliper 0–300 / 0.02, centre-hole check with a 60° plug + blue paint (contact ≥ 80 %)", cons: "Emulsion, cutting oil for the centre drill" }),
  turn: (g) => ({ mc: `CNC lathe, swing ≥ Ø300, distance between centres ≥ ${Math.ceil((g.L + 150) / 100) * 100} mm, spindle ≥ 4000 rpm, ≥ 11 kW, tailstock with quill pressure control (MT4 live centre)`,
    tool: "Roughing CNMG 12 04 08 PM (P15–P25 CVD), finishing/profiling DNMG 15 04 04 PF / VBMT 16 04 04 (for undercuts), grooving 2–3 mm, thread insert 16ER 1.5 ISO (end thread)",
    fix: "Face driver (or drive dog on the journal) + live centre; programmed tailstock force ≈ 3–5 kN",
    gauge: "Outside micrometers 0–25 / 25–50 / 50–75 (0.001), caliper, thread ring gauge for the end thread (6g), surface roughness comparator", cons: "Emulsion 6–8 %, insert stock" }),
  thread: (g, P) => (P.thr === "whirl"
    ? { mc: `CNC lathe with C-axis + thread-whirling unit on the cross slide: whirling ring for Ø${Math.ceil(g.da / 10) * 10 + 20} mm, ring speed 1500–3000 rpm, ring swivel adjustable 0–±10° (set γ = ${f(g.gam / RAD, 2)}°), C-axis synchronised to the lead`,
      tool: `Whirling ring with 6 form inserts, profile ground for m ${g.m} axial module, ${"ZK"}-flank, 2α = 40°, with ${P.s0} mm/flank grinding stock built into the profile; coated carbide K10–K20`,
      fix: "Between centres (same centres as Op 30), steady rest near the whirling point for slender worms",
      gauge: `3-wire set dw = ${f(g.dw, 3)} mm + micrometer 50–75 / 0.001 (soft over-wire M), optical profile comparator or thread template, pitch check with caliper over 5 pitches`, cons: "Neat cutting oil or MQL (whirling is often dry)" }
    : P.thr === "mill"
      ? { mc: `Thread / worm milling machine: work Ø ≤ 200 mm, length ≥ ${Math.ceil((g.L + 150) / 100) * 100} mm, cutter head swivel 0–±45° (set γ), lead 0.5–100 mm via electronic gearing`,
        tool: `Disc cutter (gashed, relieved) for m ${g.m}, 2α = 40°, HSS-E PM TiAlN, Ø100–125 mm, profile includes ${P.s0} mm/flank stock`,
        fix: "Between centres + driver", gauge: `3-wire set dw = ${f(g.dw, 3)} mm + micrometer 50–75`, cons: "Cutting oil" }
      : { mc: `CNC lathe with threading cycle for lead ${f(g.lead, 3)} mm (non-standard lead: needs CNC or change gears 22/7 on a manual lathe), rigid cross slide, ≥ 11 kW`,
        tool: `Form tool insert for m ${g.m} (full-profile, 40°) + narrow grooving insert for roughing; side clearance ≥ γ + 3° = ${f(g.gam / RAD + 3, 1)}° on the leading side (tilted holder / shim)`,
        fix: "Between centres + driver; steady rest", gauge: `3-wire set dw = ${f(g.dw, 3)} mm + micrometer`, cons: "Cutting oil, many inserts (alternating flank infeed)" }),
  ht: () => ({ mc: "Sealed-quench (integral-quench) batch furnace, working space e.g. 610 × 910 × 610 mm, 925 °C ±5 K uniformity, endothermic or N₂-methanol atmosphere, carbon-potential control (oxygen probe), oil-quench tank with agitation + oil temperature control; washer; tempering furnace 150–250 °C ±5 K",
    tool: "Coupon of the same steel in every charge (Ø≥ section of the worm), temperature data logger / survey thermocouples (furnace uniformity check)",
    fix: "Hanging fixture / grid of heat-resistant cast alloy (worms vertical → less bending); copper-paste masking of soft areas",
    gauge: "Hydraulic straightening press 10–20 t with V-blocks/centres + dial gauge 0.01; wet fluorescent magnetic-particle crack test bench + UV-A lamp; furnace charts (temperature, C-potential)",
    cons: "Quench oil (fast oil), endo gas / N₂ + methanol, copper anti-carburising paste, washer chemicals" }),
  prep: () => ({ mc: "Shot-blast cabinet (or tumble blast) with steel shot S170 / cut wire; metallography: abrasive cut-off saw, hot mounting press, grinder/polisher; Vickers micro-hardness tester HV1 (ISO 6507); Rockwell tester HRC (ISO 6508); planetary centre-hole grinder (60° stone)",
    tool: "Centre-hole grinding stones 60° (vitrified CBN or corundum)", fix: "Centre-hole grinder vise / chuck",
    gauge: "Calibrated hardness test blocks (HRC 60, HV1), 60° centre-hole plug gauge + blue paint", cons: "Abrasive discs, polishing cloths, diamond paste, nital for coupon etch" }),
  cyl: (g) => ({ mc: `CNC universal cylindrical grinder: between centres ≥ ${Math.ceil((g.L + 150) / 100) * 100} mm, swing ≥ Ø250, wheel Ø500 × 63, wheelhead 0–30° swivel, B-axis resolution, in-process 2-point gauge, roundness achievable ≤ 0.8 µm, paper-band/magnetic coolant filter`,
    tool: "Wheel A80 K vitrified (or CBN B126 for series), single-point diamond / diamond roll dresser",
    fix: "Dead centres both sides (hardened, 60°), driver on the journal; balance the wheel (≤ 0.4 µm/s vibration level)",
    gauge: "In-process 2-point measuring head, indicating micrometer 0.001 / air gauge for k5 seats, roundness: V-block + dial 0.001 or roundness tester, setting masters", cons: "Grinding emulsion 3–5 % (filtered ≤ 20 µm), dressing diamonds" }),
  tg: (g, P) => ({ mc: `CNC worm / thread grinding machine: work Ø ≤ 200 mm, between centres ≥ ${Math.ceil((g.L + 150) / 100) * 100} mm, module 0.5–10, flank forms ZA/ZI/ZK/ZN, wheelhead swivel ±45° (set γ = ${f(g.gam / RAD, 2)}°), lead accuracy ≤ 2 µm / 100 mm, separate lead per flank (duplex), CNC profile dressing, meshing-in probe, spindle power monitor (burn), oil coolant with chiller ±0.5 K`,
    tool: `Single-rib disc wheel Ø350–400 (sintered corundum or CBN), profile dressed for ZK m ${g.m}; diamond dressing roll / disc`,
    fix: "Dead centres (same reference as Op 70), driver", gauge: `Meshing-in probe; in-machine lead/profile check (option); 3-wire set dw ${f(g.dw, 3)} mm; temperature logger of coolant`,
    cons: "Grinding oil (low viscosity, ISO VG 5–10), chiller, fine filtration ≤ 5 µm, dressing rolls" }),
  etch: () => ({ mc: "Nital etch line per ISO 14104: 5–7 PP tanks (degrease, rinse, nital 2–5 %, rinse, HCl bleach, neutralise, dry), fume extraction (ATEX for alcohol), drain / neutralisation",
    tool: "Reference samples with known burn classes", fix: "Stainless hooks/baskets", gauge: "White light ≥ 1000 lx inspection booth, burn-class reference chart; portable HRC tester for spot checks",
    cons: "Nitric acid + ethanol (nital), HCl, alkaline neutraliser, PPE (gloves, face shield)" }),
  gmm: (g) => ({ mc: `CNC gear measuring machine (4-axis), work Ø ≤ 400 mm, length between centres ≥ ${Math.ceil((g.L + 150) / 100) * 100} mm, worm software (lead L/R, profile ZK, pitch, runout), MPE ≈ 1.5–2.5 µm, in a 20 ±1 °C room`,
    tool: "Ball probe Ø2 mm (ruby), calibrated master worm / lead + profile artefacts", fix: "Measuring centres (part referenced on the bearing seats)",
    gauge: `3-wire set dw ${f(g.dw, 3)} mm (calibrated) + micrometer 50–75 with 0.001; stylus roughness tester (ISO 21920, λc 0.8 mm); temperature probe on the part`, cons: "Cleaning alcohol, lint-free cloth" }),
  bench: (g, P) => ({ mc: `Worm gear test bench: rigid bed, adjustable centre distance ${f(g.a, 1)} mm (±0.002 readout), axial worm shift ${P.sRange} mm with micrometer, servo drive + torque sensor (worm side), hysteresis/powder brake ≥ ${Math.ceil(P.Tt * 1.5 / 100) * 100} N·m (wheel side), 2 rotary encoders ≥ 18 000 lines + interpolation (single-flank TE), temperature sensors, data acquisition`,
    tool: `Master worm wheel z ${g.z2}, m ${g.m}, quality class 4 (better than the worm by ≥ 1 class), duplex-matched`, fix: "Worm bearing blocks identical to the rotary table (fixed + floating side)",
    gauge: "Dial gauge 0.001 at the wheel pitch circle (backlash), marking paste (Prussian blue), sound level meter class 1, thermocouples", cons: `Gear oil ISO VG 220–460 (as in the rotary table), marking paste` }),
  fin: () => ({ mc: "AC tunnel demagnetiser (or coil + slow pull-through); fibre laser marker 20 W with fume extraction",
    tool: "Laser marking template (serial, pair no., DataMatrix)", fix: "V-block nest for marking", gauge: "Gauss meter / Hall probe (residual ≤ 0.3 mT), DataMatrix verifier",
    cons: "Rust-protection oil, VCI bags, box with foam inserts, part-record print-out" }),
};

/* ------------------------------------------------------------------ geometry */
function geom(W) {
  const g = { ...W };
  g.px = Math.PI * W.m; g.lead = W.z1 * g.px; g.gam = Math.atan(g.lead / (Math.PI * W.d1));
  g.da = W.d1 + 2 * W.m; g.df = W.d1 - 2.4 * W.m; g.h = 2.2 * W.m;
  g.pL = W.z1 * (g.px - W.dp / 2); g.pR = W.z1 * (g.px + W.dp / 2);
  g.b1 = Math.ceil(((11 + 0.06 * W.z2) * W.m + 10 + g.px) / 5) * 5;
  g.dS = Math.max(15, 5 * Math.round(0.5 * W.d1 / 5)); g.dJ = g.dS - 5; g.dSh = Math.min(g.dS + 7, Math.floor(g.df - 2));
  const segs = [["jn", "Motor journal", g.dJ, 40, "h6", 1], ["sA", "Bearing seat A (fixed side)", g.dS, 28, "k5", 1], ["sh1", "Shoulder", g.dSh, 12, "", 0],
    ["th", "Thread", g.da, g.b1, "h8", 1], ["sh2", "Shoulder", g.dSh, 12, "", 0], ["sB", "Bearing seat B (floating side)", g.dS, 24, "k5", 1], ["en", `End thread M${g.dJ} (soft)`, g.dJ, 16, "", 0]];
  let x = 0;
  g.segs = segs.map(([k, n, d, L, tol, gr]) => { const s = { k, n, d, L, tol, gr: !!gr, x0: x, x1: x + L, dr: d + (gr ? 0.6 : 0) }; x += L; return s; });
  g.L = x; g.th = g.segs[3]; g.Db = Math.ceil((g.da + 6) / 5) * 5; g.Lsaw = g.L + 7;
  g.Lb = g.b1 - 2 * W.m; g.nP = Math.max(2, Math.floor(g.Lb / g.px));
  g.dw = g.px / (2 * Math.cos(AL)); g.M0 = W.d1 - g.px / (2 * Math.tan(AL)) + g.dw * (1 + 1 / Math.sin(AL));
  g.dMdx = W.dp / g.px / Math.tan(AL);
  g.d2 = W.m * W.z2; g.a = (W.d1 + g.d2) / 2; g.rho = Math.atan(W.mu / Math.cos(AL));
  g.mB = Math.PI / 4 * g.Db ** 2 * g.Lsaw * 7.85e-6;
  g.mF = g.segs.reduce((a, s) => a + Math.PI / 4 * (s.k === "th" ? (g.d1 ** 2 + g.df ** 2) / 2 : s.d ** 2) * s.L, 0) * 7.85e-6;
  return g;
}
const segAt = (g, x) => g.segs.find((s) => x >= s.x0 && x <= s.x1) || g.segs[g.segs.length - 1];
/* radius of the thread at axial position xz (from the thread start); gap centres at ph + p/2 + n·p.
   sl / sr = stock on the left / right wall of each gap (mm, normal), q = depth fraction, ra = tip radius now */
function thrR(g, xz, ph, sl, sr, q, ra) {
  const p = g.px, r1 = g.d1 / 2, rf = g.df / 2, rt = ra - q * (ra - rf), tA = Math.tan(AL);
  const tg = ((((xz - ph - p / 2) % p) + p) % p) - p / 2;
  const s = tg < 0 ? sl : sr, wt = p / 4 - s / Math.cos(AL) + (rf - r1) * tA;
  return clamp(rt + (Math.abs(tg) - wt) / tA, rt, ra);
}
/* radius function of the whole shaft for a stage: rough | thr | final */
function rStage(g, stage, o = {}) {
  return (x, side) => {
    const s = segAt(g, x);
    if (s.k === "th" && stage !== "rough") {
      const q = typeof o.q === "function" ? o.q(x) : (o.q ?? 1);
      const ra = o.ra ?? (stage === "final" ? g.da / 2 : s.dr / 2);
      if (q <= 0) return ra;
      return thrR(g, x - s.x0, (o.ph || 0) + (side ? g.lead / 2 : 0), o.sl ?? 0, o.sr ?? 0, q, ra);
    }
    if (o.seg && o.seg[s.k] != null) return o.seg[s.k];
    return stage === "final" ? s.d / 2 : s.dr / 2;
  };
}
function shaftPath(rf, X, cy, k, L) {
  const n = Math.max(2, Math.ceil(L / 0.5)); let p = "";
  for (let i = 0; i <= n; i++) { const x = L * i / n; p += (i ? "L" : "M") + (X + x * k).toFixed(1) + "," + (cy - rf(x, 0) * k).toFixed(1); }
  for (let i = n; i >= 0; i--) { const x = L * i / n; p += "L" + (X + x * k).toFixed(1) + "," + (cy + rf(x, 1) * k).toFixed(1); }
  return p + "Z";
}
function helix(g, X, cy, k, ph, r, xmax) {
  let s = ""; const th = g.th;
  for (let n = -3; n < g.b1 / g.px + 3; n++) {
    const xa = th.x0 + ph + n * g.px, xb = xa + g.lead / 2;
    if (xa < th.x0 + 1 || xb > th.x1 - 1 || (xmax != null && xb > xmax)) continue;
    s += `<line x1="${(X + xa * k).toFixed(1)}" y1="${(cy - r * k + 2).toFixed(1)}" x2="${(X + xb * k).toFixed(1)}" y2="${(cy + r * k - 2).toFixed(1)}" stroke="rgba(255,255,255,.5)" stroke-width="1.2"/>`;
  }
  return s;
}

/* ------------------------------------------------------------------ simulation = the part record of one worm */
function simulate(g, P, F, seed) {
  const r = rngOf(seed), N = (m, s) => m + s * gauss(r), A = Math.abs;
  const sinA = Math.sin(AL), cosA = Math.cos(AL), tanA = Math.tan(AL), O = {};
  const smooth = (amp) => { const c = [1, 2, 3, 5].map((hh) => [N(0, amp / hh), r() * 6.283, hh]); return (t) => c.reduce((a, [B, p, w]) => a + B * Math.sin(w * Math.PI * t + p), 0); };
  const rng = (a) => Math.max(...a) - Math.min(...a);
  const s0 = F.stock ? 0.03 : P.s0;
  // 10 saw
  const sawA = Math.PI * g.Db ** 2 / 400, Ls = g.Lsaw + N(0, 0.3), heat = "H" + (41000 + ((seed * 37) % 900));
  O.saw = { setup: 10, t: sawA / 25 + 0.8, rate: P.rSaw, heat,
    par: [["Bar", `Ø${g.Db} mm, 16MnCr5 (1.7131)`], ["Cut length", `${g.Lsaw} ±1 mm`], ["Blank mass", `${f(g.mB, 2)} kg (finished ${f(g.mF, 2)} kg)`], ["Cutting rate", `≈ 25 cm²/min → ${f(sawA, 0)} cm² cut`]],
    res: [["Length", `${f(Ls, 1)} mm`, A(Ls - g.Lsaw) <= 1 ? "ok" : "bad"], ["Heat number stamped", heat, "ok"]] };
  // 20 face + centre
  const cd = g.dJ < 16 ? "B 2.5/8" : g.dJ < 26 ? "B 3.15/10" : "B 4/12.5", Lf = g.L + N(0, 0.03);
  O.face = { setup: 20, t: 4.5, rate: P.rLathe, cd,
    par: [["Face to length", `${g.L} ±0.1 mm (≈ ${f((g.Lsaw - g.L) / 2, 1)} mm per end)`], ["Centre holes", `DIN 332 form ${cd}`], ["Clamping", "3-jaw chuck + steady rest"]],
    res: [["Length", `${f(Lf, 2)} mm`, A(Lf - g.L) <= 0.1 ? "ok" : "bad"], ["Centre cone contact (blue paint)", "≥ 80 %", "ok"]] };
  // 30 rough turn
  const Vr = g.segs.reduce((a, s) => a + Math.PI / 4 * (g.Db ** 2 - s.dr ** 2) * s.L, 0) / 1000, Q = P.vcT * P.fT * P.apT, nT = 1000 * P.vcT / (Math.PI * g.Db);
  const eS = N(0, 0.015), eT = N(0, 0.015);
  O.turn = { setup: 30, t: Vr / Q * 1.6 + 1.5, rate: P.rLathe, Vr, Q, nT,
    par: [["Cutting data", `vc ${P.vcT} m/min · f ${P.fT} mm · ap ${P.apT} mm`], ["Spindle speed", `n = 1000·vc/(π·D) = ${f(nT, 0)} rpm at Ø${g.Db}`], ["Removal rate", `Q = vc·f·ap = ${f(Q, 0)} cm³/min`],
      ["Chips", `${f(Vr, 0)} cm³ = ${f(Vr * 7.85 / 1000, 2)} kg`], ["Allowance", "ground diameters +0.6 mm"]],
    res: [["Seat Ø before grinding", `${f(g.dS + 0.6 + eS, 2)} mm (${g.dS}+0.6 ±0.05)`, A(eS) <= 0.05 ? "ok" : "bad"], ["Thread tip Ø before grinding", `${f(g.da + 0.6 + eT, 2)} mm`, A(eT) <= 0.05 ? "ok" : "bad"]] };
  // 40 rough thread (duplex: each flank with its own lead)
  const runL = g.b1 + 2 * g.px, endShift = g.dp / 2 * (g.b1 / 2) / g.px;
  let tThr, nPass, nW;
  if (P.thr === "lathe") { nW = Math.min(500, 1000 * 90 / (Math.PI * g.da)); nPass = Math.ceil(g.h / 0.3) + 8; tThr = nPass * (runL / (g.lead * nW) + 0.1) + 2; }
  else if (P.thr === "mill") { nW = 2; nPass = 2; tThr = 2 * runL / (g.lead * nW) + 2; }
  else { nW = 5; nPass = 2; tThr = 2 * runL / (g.lead * nW) + 1.5; }
  const sL0 = Math.max(0, s0 + N(0, 0.006)), sR0 = Math.max(0, s0 + N(0, 0.006)), ePR = N(0, 0.008);
  const Msoft = g.M0 + (sL0 + sR0) / sinA, Mtgt = g.M0 + 2 * P.s0 / sinA;
  O.thread = { setup: 45, t: tThr, rate: P.rLathe, Msoft, Mtgt, nPass, nW, sL0, sR0, endShift, mc: THR[P.thr].mc,
    par: [["Method", THR[P.thr].n], ["Leads", `L flank ${f(g.pL, 3)} · R flank ${f(g.pR, 3)} mm`], ["Passes", `${nPass} (worm ${f(nW, 0)} rpm)`], ["Stock per flank", `${P.s0} mm`],
      ["Duplex shift at the thread ends", `±${f(endShift, 2)} mm > stock → roughing must follow both leads`], ["Tool side clearance", `≥ γ + 3° = ${f(g.gam / RAD + 3, 1)}°`]],
    res: [["Over-wire size (soft)", `M = ${f(Msoft, 3)} (target ${f(Mtgt, 3)} ±0.08)`, A(Msoft - Mtgt) <= 0.08 ? "ok" : "bad"], ["Flank stock L / R", `${f(sL0, 3)} / ${f(sR0, 3)} mm`, Math.min(sL0, sR0) >= 0.15 ? "ok" : "bad"]] };
  // 50 heat treatment
  const tc = F.hard ? 1.5 : P.tc, CHD = 0.7 * 0.635 * Math.sqrt(tc) * (1 + N(0, 0.02));
  const HRC = N(60.3, 0.6), core = N(36, 1.5), rHT = A(N(0.05, 0.02)), straight = rHT > 0.04, rS = straight ? A(N(0.018, 0.006)) : rHT, eps = N(180, 50), cyc = tc + 6.5;
  O.ht = { setup: 0, t: cyc * 60 / P.charge, rate: P.rHT, tc, CHD, HRC, core, rHT, rS, straight, eps, cyc,
    par: [["Carburise", `925 °C, ${f(tc, 1)} h, carbon potential 1.1 → 0.8 %`], ["Harden", "840 °C → oil quench 60 °C"], ["Temper", "180 °C, 2 h"], ["Cycle", `${f(cyc, 1)} h per charge of ${P.charge} worms`], ["Masking", "copper paste on the soft end thread"]],
    res: [["Surface hardness", `${f(HRC, 1)} HRC (58–62)`, HRC >= 58 && HRC <= 62 ? "ok" : "bad"], ["Core hardness", `${f(core, 0)} HRC (30–42)`, core >= 30 && core <= 42 ? "ok" : "warn"],
      ["Runout after quench", `${f(rHT, 3)} mm`, rHT <= 0.15 ? "ok" : "bad"], ["Straightening", straight ? `yes → ${f(rS, 3)} mm` : "not needed", rS <= 0.03 ? "ok" : "warn"],
      ["Crack test (magnetic particle)", "no indication", "ok"], ["Size change from carburising", `lead +${f(eps, 0)} µm/m (ground off later)`, "info"]] };
  // 60 prep: shot blast, hardness, coupon, centre holes
  const chdNeed = P.chdMin + P.s0 + 0.05, eC = F.centre ? 0.006 : 0;
  O.prep = { setup: 10, t: 6, rate: P.rGrind, chdNeed,
    par: [["Shot blast", "scale + copper paste off"], ["Coupon", "same steel, same charge, cut + polished, HV1 traverse"], ["Centre holes", F.centre ? "NOT re-ground (fault)" : "re-ground 60° (planetary centre-hole grinder)"]],
    res: [["Case depth CHD at 550 HV1 (coupon)", `${f(CHD, 2)} mm (need ≥ ${f(chdNeed, 2)} = ${P.chdMin} + stock ${P.s0} + 0.05)`, CHD >= chdNeed ? "ok" : "bad"],
      ["Centre cone contact", F.centre ? "≈ 40 % – scale + distortion" : "≥ 80 %", F.centre ? "warn" : "ok"]] };
  // 70 cylindrical grinding
  const grd = g.segs.filter((s) => s.gr).map((s) => { const [ei, es] = TOL[s.tol]; return { k: s.k, n: s.n, d: s.d, tol: s.tol, ei, es, dev: N((ei + es) / 2, (es - ei) / 9) }; });
  const runS = A(N(1.2, 0.35)) + eC * 900;
  O.cyl = { setup: 25, t: grd.length * 1.1 + 1.5, rate: P.rGrind, grd, runS,
    par: [["Wheel", "A80 K vitrified Ø500, vs 35 m/s"], ["Work speed", "20 m/min, coolant 2 % emulsion"], ["Stock", "0.6 mm on Ø: rough 0.6 mm/min, finish 0.1 mm/min, spark-out"], ["Gauge", "in-process 2-point gauge"]],
    res: [...grd.map((d) => [`Ø${d.d} ${d.tol}${d.k === "th" ? " (thread tip)" : ""}`, `${d.dev >= 0 ? "+" : ""}${f(d.dev * 1000, 1)} µm (${f(d.ei * 1000, 0)}/${f(d.es * 1000, 0)})`, d.dev >= d.ei && d.dev <= d.es ? "ok" : "bad"]),
      ["Seat runout to axis A–B", `${f(runS, 1)} µm (≤ ${P.tRun})`, runS <= P.tRun ? "ok" : "bad"]] };
  // 80 thread grinding
  const need = (rS / 2) * sinA + A(eps) * 1e-6 * (g.b1 / 2) * cosA + A(ePR) * cosA + 0.01, cleanL = sL0 >= need, cleanR = sR0 >= need, clean = cleanL && cleanR;
  const vw = Math.PI * g.d1 * P.nw / 60, Qw = P.aer * vw, qlimE = F.burn ? P.qlim * 0.4 : P.qlim, burnR = Qw / qlimE, burn = burnR > 1;
  const dT = F.thermal ? 6 : P.dTc, dN = F.dress ? 40 : Math.max(1, Math.round(P.dressN)), wear = 0.25 * dN, dpU = F.duplex ? g.dp / 2 : g.dp;
  const nR = Math.max(0, Math.ceil((P.s0 - 2 * P.aef) / P.aer - 1e-9)), passes = [];
  for (const fl of ["L", "R"]) { for (let i = 0; i < nR; i++) passes.push({ fl, ae: P.aer, kind: "rough" }); passes.push({ fl, ae: P.aef, kind: "finish" }, { fl, ae: P.aef, kind: "finish" }, { fl, ae: 0, kind: "spark-out" }); }
  passes.forEach((p, i) => { p.dress = i % dN === 0; });
  let rl = sL0, rr = sR0; passes.forEach((p) => { if (p.fl === "L") rl = Math.max(0, rl - p.ae); else rr = Math.max(0, rr - p.ae); p.remL = rl; p.remR = rr; });
  const tPass = runL / (g.lead * P.nw), nDress = Math.ceil(passes.length / dN), thermErr = -ALS * dT * g.Lb * 1000;
  O.tg = { setup: 60, t: passes.length * tPass + nDress * 0.6 + 2.5, rate: P.rWG, passes, tPass, nDress, need, clean, cleanL, cleanR, vw, Qw, qlimE, burnR, burn, dT, dN, wear, dpU, thermErr,
    par: [["Wheel", "single-rib disc wheel, profile dressed by a diamond roll"], ["Wheel tilt", `lead angle γ = ${f(g.gam / RAD, 2)}°`], ["Leads", `L ${f(g.px * g.z1 - g.z1 * dpU / 2, 3)} · R ${f(g.px * g.z1 + g.z1 * dpU / 2, 3)} mm (Δp ${f(dpU, 3)})`],
      ["Worm speed", `${P.nw} rpm → ${f(g.lead * P.nw, 0)} mm/min along the axis`], ["Passes per flank", `${nR} × ${P.aer} + 2 × ${P.aef} + 1 spark-out`], ["Q'w = ae · vw", `${P.aer} · ${f(vw, 0)} = ${f(Qw, 2)} mm³/(mm·s)`]],
    res: [["Flanks cleaned up", clean ? `yes – needed ${f(need, 3)}, had ≥ ${f(Math.min(sL0, sR0), 3)} mm` : `NO – black spots on the ${!cleanL && !cleanR ? "L + R" : !cleanL ? "L" : "R"} flank (needed ${f(need, 3)} mm)`, clean ? "ok" : "bad"],
      ["Burn risk Q'w / limit (spindle power monitor)", `${f(burnR * 100, 0)} %`, burnR <= 0.7 ? "ok" : burnR <= 1 ? "warn" : "bad"],
      ["Worm temperature drift", `${f(dT, 1)} K → lead error ${f(thermErr, 1)} µm (not seen at the machine)`, "info"],
      ["Wheel wear between dressings", `${f(wear, 1)} µm (not seen at the machine)`, "info"]] };
  // 90 nital etch
  const hrcB = burn ? N(53, 1) : HRC - 0.3;
  O.etch = { setup: 10, t: 6, rate: P.rMeas, hrcB,
    par: [["Etch", "nital 3 %, 20–30 s"], ["Bleach", "HCl 4–6 %"], ["Standard", "ISO 14104 (grinding burn by etching)"]],
    res: [["Etch picture", burn ? "dark grey patches on the flanks (temper burn)" : !clean ? "black unground spots on the flanks" : "uniform grey – no burn", burn || !clean ? "bad" : "ok"],
      ["Hardness check in the dark areas", burn ? `${f(hrcB, 1)} HRC – soft` : "–", burn ? "bad" : "ok"]] };
  // 100 inspection (gear measuring machine)
  const dupErr = (g.dp - dpU) / 2 * (g.Lb / g.px) * 1000;
  const leadTr = (fH) => { const sm = smooth(0.35); return Array.from({ length: 41 }, (_, i) => { const t = i / 40; return [t * g.Lb, fH * (t - 0.5) + sm(t)]; }); };
  const trLL = leadTr(N(0, 0.9) + thermErr + dupErr), trLR = leadTr(N(0, 0.9) + thermErr - dupErr);
  const fit = (pts) => { const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
    const b = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0); const res = pts.map((p) => p[1] - my - b * (p[0] - mx));
    return { fH: b * (pts[n - 1][0] - pts[0][0]), ff: rng(res), F: rng(pts.map((p) => p[1])) }; };
  const ph = g.h - 0.6 * g.m, profTr = () => { const sm = smooth(0.25), fHa = N(0, 0.7); return Array.from({ length: 31 }, (_, i) => { const t = i / 30;
    return [t * ph, fHa * (t - 0.5) + sm(t) - wear * (Math.max(0, (t - 0.8) / 0.2) ** 2 + Math.max(0, (0.2 - t) / 0.2) ** 2)]; }); };
  const trPL = profTr(), trPR = profTr();
  const Fr0 = A(N(2.4, 0.7)) + eC * 1000, phR = r() * 6.283, trRun = Array.from({ length: 12 }, (_, i) => [i * 30, Fr0 / 2 * Math.sin(i * 30 * RAD + phR) + N(0, 0.25)]);
  const trPitch = Array.from({ length: g.nP }, (_, i) => [i + 1, N(0, 0.6) + thermErr / g.nP]);
  let cum = 0; const trCum = trPitch.map(([i, v]) => { cum += v; return [i, cum]; });
  const Moff = N(0, 0.005), wx = [-1.5, -0.5, 0.5, 1.5].map((v) => v * g.px), trM = wx.map((x) => [x, g.M0 + Moff + x * dpU / g.px / tanA + N(0, 0.001)]);
  const LL = fit(trLL), LR = fit(trLR), FaL = rng(trPL.map((p) => p[1])), FaR = rng(trPR.map((p) => p[1])), Fr = rng(trRun.map((p) => p[1])), fpx = Math.max(...trPitch.map((p) => A(p[1])));
  const mSlope = (trM[3][1] - trM[0][1]) / (wx[3] - wx[0]), Ra = N(0.28, 0.04);
  const okHb = (v) => A(v) <= P.tHb;
  O.gmm = { setup: 15, t: 35, rate: P.rMeas, trLL, trLR, trPL, trPR, trRun, trPitch, trCum, trM, LL, LR, FaL, FaR, Fr, fpx, mSlope, Moff, Ra,
    par: [["Machine", "CNC gear measuring machine, 2 µm ball probe"], ["Evaluation length", `lead ${f(g.Lb, 0)} mm · profile ${f(ph, 1)} mm`], ["Wire Ø", `best wire dw = pₓ / (2·cos 20°) = ${f(g.dw, 3)} mm`], ["Room", "20 °C ±1, part soaked 2 h"]],
    res: [["Lead slope fHβ L flank", `${f(LL.fH, 1)} µm (±${P.tHb})`, okHb(LL.fH) ? "ok" : "bad"], ["Lead slope fHβ R flank", `${f(LR.fH, 1)} µm (±${P.tHb})`, okHb(LR.fH) ? "ok" : "bad"],
      ["Lead form ffβ L / R", `${f(LL.ff, 1)} / ${f(LR.ff, 1)} µm`, Math.max(LL.ff, LR.ff) <= 0.75 * P.tHb ? "ok" : "warn"],
      ["Profile Fα L / R", `${f(FaL, 1)} / ${f(FaR, 1)} µm (≤ ${P.tFa})`, Math.max(FaL, FaR) <= P.tFa ? "ok" : "bad"], ["Runout Fr", `${f(Fr, 1)} µm (≤ ${P.tFr})`, Fr <= P.tFr ? "ok" : "bad"],
      ["Single pitch fpx (max)", `${f(fpx, 1)} µm (±${P.tfp})`, fpx <= P.tfp ? "ok" : "bad"], ["Over-wire M (middle)", `${f(g.M0 + Moff, 3)} mm (${f(g.M0, 3)} ±${P.tM / 1000})`, A(Moff * 1000) <= P.tM ? "ok" : "bad"],
      ["Duplex: M growth along the worm", `${f(mSlope * 1000, 1)} µm/mm (design ${f(g.dMdx * 1000, 1)})`, A(mSlope / g.dMdx - 1) <= 0.1 ? "ok" : "bad"], ["Roughness Ra flanks", `${f(Ra, 2)} µm (≤ 0.4)`, Ra <= 0.4 ? "ok" : "bad"]] };
  // 110 test bench (master wheel)
  const j0a = g.j0 - Moff * tanA + N(0, 0.002), slope = dpU / g.px;
  const trJ = [0, 1, 2, 3, 4, 5].filter((s) => s <= P.sRange + 1e-9).map((s) => [s, (j0a - s * slope + N(0, 0.0006)) * 1000]);
  const nJ = trJ.length, jmx = trJ.reduce((a, p) => a + p[0], 0) / nJ, jmy = trJ.reduce((a, p) => a + p[1], 0) / nJ;
  const jb = trJ.reduce((a, p) => a + (p[0] - jmx) * (p[1] - jmy), 0) / trJ.reduce((a, p) => a + (p[0] - jmx) ** 2, 0), ja = jmy - jb * jmx;
  const sNeed = (g.jt * 1000 - ja) / jb;
  const ratio = g.z2 / g.z1, A1 = (Fr / 2) * 1e-3 * tanA / (g.d2 / 2) * SEC, A2 = ((FaL + FaR) / 4) * 1e-3 * 0.3 / (g.d2 / 2) * SEC;
  const p0 = r() * 6.283, p1 = r() * 6.283, p2 = r() * 6.283, p3 = r() * 6.283;
  const te = (th) => 0.8 * Math.sin(th * RAD + p0) + A1 * Math.sin(ratio * th * RAD + p1) + A2 * Math.sin(2 * ratio * th * RAD + p2) + 0.12 * Math.sin(17.3 * ratio * th * RAD + p3);
  const trTE = Array.from({ length: 721 }, (_, i) => [i / 2, te(i / 2)]), wr = 360 / ratio;
  const trTEz = Array.from({ length: 201 }, (_, i) => { const th = i / 200 * 5 * wr; return [th / wr, te(th)]; });
  const Fi = rng(trTE.map((p) => p[1]));
  let fi = 0; for (let w = 0; w < 5; w++) { const seg = trTEz.filter((p) => p[0] >= w && p[0] <= w + 1).map((p) => p[1] - 0.8 * Math.sin(p[0] * wr * RAD + p0)); fi = Math.max(fi, rng(seg)); }
  const cpx = (fh) => clamp(fh / (2.5 * P.tHb) * 0.35, -0.42, 0.42), dxL = cpx(LL.fH), dxR = cpx(LR.fH), dy = clamp(-wear / 25, -0.3, 0.3), cSize = clamp(0.72 - wear / 40, 0.3, 0.8);
  const Pout = P.Tt * 2 * Math.PI * P.nT / 60, hAe = P.hA * (1 + N(0, 0.04)), muF = 1 + N(0, 0.05), Cth = hAe * 750, trT = [], trEta = []; let Tn = 0;
  for (let t = 0; t <= 120; t++) {
    const mu = g.mu * muF * (1 + 0.6 * Math.exp(-t / 30)) * (burn ? 1.4 : 1) * (F.dress ? 1.12 : 1), rho = Math.atan(mu / cosA), eta = Math.tan(g.gam) / Math.tan(g.gam + rho);
    const Pl = Pout * (1 / eta - 1); trT.push([t, Tn]); trEta.push([t, eta * 100]); Tn += (Pl - hAe * Tn) * 60 / Cth;
  }
  const dTmax = trT[120][1], etaEnd = trEta[120][1], dB = 58 + 0.4 * (FaL + FaR) / 2 + 0.3 * Fr + (burn ? 4 : 0) + (Math.max(A(dxL), A(dxR)) > 0.3 ? 3 : 0);
  const cpOK = (d) => (A(d) <= 0.15 ? "ok" : A(d) <= 0.25 ? "warn" : "bad");
  O.bench = { setup: 15, t: 150, rate: P.rBench, trTE, trTEz, trJ, ja, jb, sNeed, slope, Fi, fi, dxL, dxR, dy, cSize, trT, trEta, dTmax, etaEnd, dB, Pout, A1, A2,
    par: [["Master wheel", `z ${g.z2}, class 4, centre distance a = ${f(g.a, 1)} mm`], ["Encoders", "worm side + wheel side, 36 000 lines"], ["Run-in", `${P.Tt} N·m at ${P.nT} rpm = ${f(Pout, 0)} W output, 2 h`]],
    res: [["Single-flank error f'i (per worm turn)", `${f(fi, 2)}″ (≤ ${P.tTE})`, fi <= P.tTE ? "ok" : "bad"], ["Total transmission error F'i", `${f(Fi, 2)}″ (≤ ${f(P.tTE * 2, 1)})`, Fi <= P.tTE * 2 ? "ok" : "bad"],
      ["Backlash change per mm shift", `${f(-jb, 2)} µm/mm (design ${f(g.dp / g.px * 1000, 2)})`, A(-jb / (g.dp / g.px * 1000) - 1) <= 0.1 ? "ok" : "bad"],
      ["Shift for the target backlash", `${f(sNeed, 2)} mm (range 0.3–${P.sRange})`, sNeed >= 0.3 && sNeed <= P.sRange ? "ok" : "bad"],
      ["Contact pattern L / R flank", `${f(dxL * 100, 0)} / ${f(dxR * 100, 0)} % off centre, ${f(cSize * 100, 0)} % size`, [cpOK(dxL), cpOK(dxR)].includes("bad") ? "bad" : [cpOK(dxL), cpOK(dxR)].includes("warn") ? "warn" : "ok"],
      ["Temperature rise after 2 h", `${f(dTmax, 1)} K (≤ 15)`, dTmax <= 15 ? "ok" : "bad"], ["Efficiency after run-in", `${f(etaEnd, 0)} %`, "info"], ["Noise at 1 m", `${f(dB, 0)} dB(A) (≤ 68)`, dB <= 68 ? "ok" : "bad"]] };
  // 120 finish
  const mag = A(N(0.1, 0.03));
  O.fin = { setup: 5, t: 6, rate: P.rBench, mag,
    par: [["Demagnetise", "AC tunnel coil"], ["Marking", `W-${String(seed - 1000).padStart(4, "0")} / pair P-${String(seed - 1000).padStart(4, "0")}`], ["Protection", "rust oil + VCI bag"]],
    res: [["Residual magnetism", `${f(mag, 2)} mT (≤ 0.3)`, mag <= 0.3 ? "ok" : "bad"], ["Part record closed", "all values stored", "ok"]] };
  // totals + verdict
  let tSum = 0, cSum = g.mB * P.matKg; const fails = [], warns = [];
  OPS.forEach((o) => { const x = O[o.k]; x.cost = ((x.setup || 0) / P.lot + x.t) / 60 * x.rate; tSum += x.t; cSum += x.cost;
    x.res.forEach((rw) => { if (rw[2] === "bad") fails.push({ no: o.no, op: o.n, l: rw[0], v: rw[1] }); else if (rw[2] === "warn") warns.push({ no: o.no, op: o.n, l: rw[0], v: rw[1] }); }); });
  const batchMin = OPS.reduce((a, o) => a + (o.k === "ht" ? 0 : (O[o.k].setup || 0) + P.lot * O[o.k].t), 0);
  const days = batchMin / 60 / 16 + Math.ceil(P.lot / P.charge) * cyc / 24 + 2 + 0.5 * OPS.length;
  return { seed, sn: seed - 1000, O, fails, warns, tSum, cSum, matCost: g.mB * P.matKg, days, s0 };
}

/* ------------------------------------------------------------------ small chart helper (one y-axis, tolerance lines) */
const niceStep = (x) => { const p = 10 ** Math.floor(Math.log10(x)), m = x / p; return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p; };
const ticks = ([a, b], n = 4) => { const s = niceStep((b - a) / n), o = []; for (let v = Math.ceil(a / s - 1e-9) * s; v <= b + 1e-9; v += s) o.push(+v.toFixed(6)); return o; };
function chart(o) {
  const { x, y, w, h } = o, pl = 36, pr = 8, pt = 22, pb = 24;
  const X = (v) => x + pl + (v - o.xr[0]) / (o.xr[1] - o.xr[0]) * (w - pl - pr);
  const Y = (v) => y + pt + (1 - (clamp(v, o.yr[0], o.yr[1]) - o.yr[0]) / (o.yr[1] - o.yr[0])) * (h - pt - pb);
  let s = `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="var(--surface)" stroke="var(--border)"/>`;
  s += `<text x="${x + 8}" y="${y + 15}" class="apc-t" style="font-weight:600;fill:var(--text)">${esc(o.t)}</text>`;
  if (o.note) s += `<text x="${x + w - 8}" y="${y + 15}" class="apc-t r">${o.note}</text>`;
  (o.band || []).forEach(([a, b]) => { s += `<rect x="${X(o.xr[0])}" y="${Y(b)}" width="${X(o.xr[1]) - X(o.xr[0])}" height="${Math.max(0, Y(a) - Y(b))}" fill="var(--good)" opacity=".10"/>`; });
  ticks(o.yr).forEach((v) => { s += `<line x1="${X(o.xr[0])}" x2="${X(o.xr[1])}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--grid)"/><text x="${X(o.xr[0]) - 4}" y="${Y(v) + 3.5}" class="apc-t r" style="font-size:9.5px">${+v.toFixed(4)}</text>`; });
  (o.xt || ticks(o.xr, 5)).forEach((v) => { s += `<text x="${X(v)}" y="${y + h - pb + 12}" class="apc-t c" style="font-size:9.5px">${+(+v).toFixed(3)}</text>`; });
  if (o.xl) s += `<text x="${x + w - 8}" y="${y + h - 4}" class="apc-t r" style="font-size:9.5px">${esc(o.xl)}</text>`;
  (o.hl || []).forEach((l) => { s += `<line x1="${X(o.xr[0])}" x2="${X(o.xr[1])}" y1="${Y(l.y)}" y2="${Y(l.y)}" stroke="${l.col || "var(--text-2)"}" stroke-dasharray="${l.dash || "4 3"}"/>${l.t ? `<text x="${X(o.xr[1]) - 2}" y="${Y(l.y) - 3}" class="apc-t r" style="font-size:9.5px">${esc(l.t)}</text>` : ""}`; });
  let off = false;
  (o.series || []).forEach((se) => {
    const pts = se.pts; if (!pts.length) return;
    if (pts.some((p) => p[1] > o.yr[1] || p[1] < o.yr[0])) off = true;
    if (se.bars) { const bw = Math.max(3, (X(o.xr[1]) - X(o.xr[0])) / (pts.length * 1.6)); pts.forEach((p) => { const y0 = Y(Math.max(o.yr[0], Math.min(o.yr[1], 0))), y1 = Y(p[1]); s += `<rect x="${X(p[0]) - bw / 2}" y="${Math.min(y0, y1)}" width="${bw}" height="${Math.abs(y1 - y0)}" rx="2" fill="${se.col}"><title>${esc(se.lab || "")} ${p[0]}: ${f(p[1], 2)}</title></rect>`; }); return; }
    if (!se.dotsOnly) s += `<path d="${pts.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1)).join("")}" fill="none" stroke="${se.col}" stroke-width="${se.w || 2}"${se.dash ? ` stroke-dasharray="${se.dash}"` : ""}/>`;
    if (se.dots) pts.forEach((p) => { s += `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="4" fill="${se.col}" stroke="var(--surface)" stroke-width="2"><title>${esc(se.lab || "")} ${f(p[0], 2)}: ${f(p[1], 3)}</title></circle>`; });
  });
  if (off) s += `<text x="${x + w - 8}" y="${y + h - pb - 4}" class="apc-t r" style="fill:var(--critical);font-weight:600">▲ off scale</text>`;
  if (o.legend) s += o.legend.map(([t, c], i) => `<rect x="${x + pl + 4 + i * 90}" y="${y + pt + 2}" width="10" height="3" fill="${c}"/><text x="${x + pl + 18 + i * 90}" y="${y + pt + 7}" class="apc-t" style="font-size:9.5px">${esc(t)}</text>`).join("");
  return s + `</g>`;
}
const svgOpen = (t, sub) => `<svg viewBox="0 0 ${SW} ${SH}" class="apc-svg" aria-label="${esc(t)}"><text x="10" y="18" class="apc-t" style="font-weight:600">${esc(t)}</text>${sub ? `<text x="${SW - 10}" y="18" class="apc-t r">${esc(sub)}</text>` : ""}`;
function centres(xL, xR, cy) {
  return `<rect x="16" y="${cy - 50}" width="${Math.max(20, xL - 40)}" height="100" rx="6" fill="var(--surface-2)" stroke="var(--axis)"/><text x="22" y="${cy + 64}" class="apc-t">headstock</text>
    <path d="M${xL - 24},${cy - 13} L${xL},${cy} L${xL - 24},${cy + 13} Z" fill="#8a8a8a" stroke="#444"/>
    <rect x="${xR + 24}" y="${cy - 38}" width="${Math.max(20, SW - 16 - xR - 24)}" height="76" rx="6" fill="var(--surface-2)" stroke="var(--axis)"/><text x="${SW - 20}" y="${cy + 54}" class="apc-t r">tailstock</text>
    <path d="M${xR + 24},${cy - 13} L${xR},${cy} L${xR + 24},${cy + 13} Z" fill="#8a8a8a" stroke="#444"/>`;
}
function sparks(x, y, t, n, col, dir = -1) {
  let s = "";
  for (let i = 0; i < n; i++) { const a = (i * 2.399 + t * 9) % 6.283, l = 6 + ((i * 7.7 + t * 40) % 14); const dx = Math.cos(a * 0.35 + (dir < 0 ? 2.4 : 0.3)) * l, dy = Math.abs(Math.sin(a)) * l * 0.8;
    s += `<line x1="${x}" y1="${y}" x2="${(x + dx).toFixed(1)}" y2="${(y + dy * (dir < 0 ? 1 : -1)).toFixed(1)}" stroke="${col}" stroke-width="1.3" opacity=".85"/>`; }
  return s;
}
const txt = (x, y, t, st = "") => `<text x="${x}" y="${y}" class="apc-t" style="${st}">${t}</text>`;
const big = (x, y, t, col = "var(--text)") => `<text x="${x}" y="${y}" class="apc-t" style="font-size:15px;font-weight:700;fill:${col}">${t}</text>`;

/* ------------------------------------------------------------------ scenes (one per operation, u = 0..1) */
function sceneSaw(g, R, u) {
  const k = 2.0, X = 50, cy = 180, rr = g.Db / 2 * k, xc = X + g.Lsaw * k;
  const p = clamp((u - 0.12) / 0.68, 0, 1), yb = cy - rr - 16 + p * (2 * rr + 22), sep = u > 0.84 ? ease((u - 0.84) / 0.16) * 34 : 0;
  let s = svgOpen("Op 10 · Saw the bar to length (side view)", "band saw");
  s += `<rect x="${xc - 40}" y="40" width="80" height="26" rx="4" fill="var(--surface-2)" stroke="var(--axis)"/>${txt(xc + 46, 58, "saw frame")}`;
  if (p < 1) s += `<rect x="${X}" y="${cy - rr}" width="${SW - 14 - X}" height="${2 * rr}" fill="${STEEL}" stroke="#555"/><rect x="${xc}" y="${cy - rr}" width="4" height="${clamp(yb - (cy - rr), 0, 2 * rr)}" fill="var(--surface)"/>`;
  else s += `<rect x="${X - sep}" y="${cy - rr}" width="${xc - X}" height="${2 * rr}" fill="${STEEL}" stroke="#555"/><rect x="${xc + 4}" y="${cy - rr}" width="${SW - 18 - xc}" height="${2 * rr}" fill="${STEEL}" stroke="#555"/>`;
  s += `<rect x="${xc - 1}" y="66" width="6" height="${Math.max(0, yb - 66)}" fill="#c8ccd0" stroke="#666"/><path d="M${xc - 1},${yb} l2,4 l2,-4 l2,4" fill="none" stroke="#444"/>`;
  s += `<rect x="${xc + 12}" y="${cy - rr - 16}" width="70" height="14" fill="#666"/><rect x="${xc + 12}" y="${cy + rr + 2}" width="70" height="14" fill="#666"/>${txt(xc + 88, cy - rr - 6, "vise")}`;
  if (p > 0 && p < 1) s += sparks(xc + 2, Math.min(yb, cy + rr), u * 30, 6, "#9aa3ab", 1);
  s += `<line x1="${X - sep}" y1="${cy + rr + 34}" x2="${xc - sep}" y2="${cy + rr + 34}" stroke="var(--text-2)" marker-start="url(#wmA)" marker-end="url(#wmA)"/>${txt((X + xc) / 2 - sep - 30, cy + rr + 28, `${g.Lsaw} mm`)}`;
  s += txt(X, cy - rr - 10, `bar Ø${g.Db} mm · 16MnCr5`);
  if (u > 0.9) s += `<text x="${X - sep + 14}" y="${cy + 4}" class="apc-t" style="font-family:monospace;font-size:13px;fill:#333">${R.O.saw.heat}</text>`;
  s += txt(X, SH - 16, `cut area ${f(Math.PI * g.Db ** 2 / 400, 0)} cm² · ≈ ${f(R.O.saw.t, 1)} min · the heat number links the worm to the steel certificate`);
  return s + defs() + `</svg>`;
}
function sceneFace(g, R, u) {
  const k = 2.2, X = 120, cy = 165, rr = g.Db / 2 * k, ex = (g.Lsaw - g.L) / 2, ph = u < 0.5 ? 0 : 1, v = ph ? (u - 0.5) / 0.5 : u / 0.5;
  const fv = clamp(v / 0.45, 0, 1), cv = clamp((v - 0.5) / 0.35, 0, 1);
  const lx = ph ? ex : ex * fv, rx = g.Lsaw - (ph ? ex * fv : 0);
  let s = svgOpen("Op 20 · Face to length + centre drill both ends", "CNC lathe");
  s += `<rect x="${X + lx * k}" y="${cy - rr}" width="${(rx - lx) * k}" height="${2 * rr}" fill="${STEEL}" stroke="#555"/>`;
  const cX = ph ? X + lx * k : X + rx * k;
  // chuck on the other end
  if (!ph) s += `<rect x="${X + (rx - 45) * k}" y="${cy - rr - 18}" width="${45 * k}" height="18" fill="#666"/><rect x="${X + (rx - 45) * k}" y="${cy + rr}" width="${45 * k}" height="18" fill="#666"/><rect x="${X + rx * k}" y="${cy - rr - 30}" width="40" height="${2 * rr + 60}" rx="4" fill="var(--surface-2)" stroke="var(--axis)"/>${txt(X + rx * k + 4, cy + rr + 46, "chuck")}`;
  else s += `<rect x="${X + lx * k}" y="${cy - rr - 18}" width="${45 * k}" height="18" fill="#666"/><rect x="${X + lx * k}" y="${cy + rr}" width="${45 * k}" height="18" fill="#666"/><rect x="${X + lx * k - 40}" y="${cy - rr - 30}" width="40" height="${2 * rr + 60}" rx="4" fill="var(--surface-2)" stroke="var(--axis)"/>${txt(X + lx * k - 40, cy + rr + 46, "chuck (part turned)")}`;
  const ends = [X + lx * k, X + rx * k], wEnd = ph ? 1 : 0, ex0 = ends[wEnd], dir = wEnd ? 1 : -1;
  // centre holes already made
  const ch = (xe, d) => `<path d="M${xe},${cy - 4.2 * k} L${xe - d * 6 * k},${cy - 0.8 * k} L${xe - d * 9 * k},${cy - 0.8 * k} L${xe - d * 9 * k},${cy + 0.8 * k} L${xe - d * 6 * k},${cy + 0.8 * k} L${xe},${cy + 4.2 * k} Z" fill="var(--surface)" stroke="#555"/>`;
  if (ph || cv >= 1) s += ch(ends[0], -1);
  if (ph && cv >= 1) s += ch(ends[1], 1);
  // facing tool
  if (v < 0.48) { const ty = cy - rr - 14 + fv * (rr + 14); s += `<path d="M${ex0},${ty} l${dir * 18},-10 l0,-30 l${dir * 14},0 l0,40 Z" fill="${CARB}" stroke="#7a5a10"/>`; if (fv > 0 && fv < 1) s += sparks(ex0, ty, u * 40, 5, "#9aa3ab", 1); }
  // centre drill
  if (v >= 0.5 && v < 0.95) { const dx = ex0 + dir * (60 - cv * (60 + 9 * k * 0.8)); s += `<rect x="${Math.min(dx, dx + dir * 70)}" y="${cy - 5}" width="70" height="10" fill="#9aa" stroke="#444"/><path d="M${dx},${cy} l${dir * 10},-6 l0,12 Z" fill="#444"/>`; }
  if (!ph && cv > 0.6 && cv < 1) s += ch(ends[0], -1);
  s += txt(X, 40, `${ph ? "Second end" : "First end"}: ${v < 0.48 ? "facing" : v < 0.95 ? "centre drilling" : "done"}`, "font-weight:600;fill:var(--text)");
  // inset: centre hole detail
  const ix = 470, iy = 250;
  s += `<rect x="${ix}" y="${iy}" width="276" height="120" rx="6" fill="var(--surface)" stroke="var(--border)"/>${txt(ix + 8, iy + 16, `Centre hole DIN 332 form ${R.O.face.cd}`, "font-weight:600")}`;
  const sx = ix + 30, sy = iy + 70;
  s += `<rect x="${sx + 70}" y="${sy - 40}" width="50" height="80" fill="${STEEL}"/><path d="M${sx},${sy - 40} L${sx},${sy - 26} L${sx + 6},${sy - 22} L${sx + 40},${sy - 6} L${sx + 70},${sy - 6} L${sx + 70},${sy - 40} Z" fill="${STEEL}" stroke="#555"/><path d="M${sx},${sy + 40} L${sx},${sy + 26} L${sx + 6},${sy + 22} L${sx + 40},${sy + 6} L${sx + 70},${sy + 6} L${sx + 70},${sy + 40} Z" fill="${STEEL}" stroke="#555"/>`;
  s += `<line x1="${sx + 6}" y1="${sy - 22}" x2="${sx + 40}" y2="${sy - 6}" stroke="var(--critical)" stroke-width="2.5"/><line x1="${sx + 6}" y1="${sy + 22}" x2="${sx + 40}" y2="${sy + 6}" stroke="var(--critical)" stroke-width="2.5"/>`;
  s += txt(ix + 160, iy + 46, "60° cone (red) =", "fill:var(--critical)") + txt(ix + 160, iy + 60, "the reference for every") + txt(ix + 160, iy + 74, "later operation") + txt(ix + 160, iy + 94, "120° chamfer protects") + txt(ix + 160, iy + 108, "the cone edge");
  return s + `</svg>`;
}
function sceneTurn(g, R, u, P) {
  const k = (SW - 230) / g.L, X = 115, cy = 150, rr = (x) => segAt(g, x).dr / 2, rmin = Math.min(...g.segs.map((q) => q.dr / 2)), ap = P.apT;
  const Np = Math.max(1, Math.ceil((g.Db / 2 - rmin) / ap)), pu = clamp(u, 0, 0.9999) * Np, kk = Math.floor(pu) + 1, fr = pu - Math.floor(pu), xt = g.L * (1 - fr);
  const lev = (j) => Math.max(rmin, g.Db / 2 - j * ap);
  const rf = u >= 1 ? (x) => rr(x) : (x) => Math.max(rr(x), x >= xt ? lev(kk) : lev(kk - 1));
  let s = svgOpen("Op 30 · Rough turning between centres", "CNC lathe") + centres(X, X + g.L * k, cy);
  s += `<path d="${shaftPath(rf, X, cy, k, g.L)}" fill="${STEEL}" stroke="#555"/>`;
  s += `<rect x="${X + 6}" y="${cy - g.dJ / 2 * k - 12}" width="16" height="${g.dJ * k + 24}" rx="3" fill="#666"/>${txt(X + 2, cy + g.Db / 2 * k + 16, "drive dog")}`;
  if (u < 1) { const ty = cy - Math.max(rr(xt), lev(kk)) * k, tx = X + xt * k;
    s += `<path d="M${tx},${ty} L${tx + 10},${ty - 16} L${tx + 26},${ty - 16} L${tx + 16},${ty} Z" fill="${CARB}" stroke="#7a5a10"/><rect x="${tx + 12}" y="${ty - 60}" width="16" height="44" fill="#777"/>` + sparks(tx, ty, u * 50, 6, "#8a6d3b", 1); }
  const n = 1000 * P.vcT / (Math.PI * 2 * Math.max(rr(xt), lev(kk)));
  s += big(20, 270, u < 1 ? `pass ${kk} / ${Np}` : "roughing done") + txt(20, 290, `depth of cut ap ${ap} mm · feed ${P.fT} mm/rev · vc ${P.vcT} m/min → n ≈ ${f(Math.min(n, 3000), 0)} rpm (constant cutting speed)`);
  s += txt(20, 308, `removal rate Q = vc · f · ap = ${f(R.O.turn.Q, 0)} cm³/min · chips total ${f(R.O.turn.Vr, 0)} cm³ · time ≈ ${f(R.O.turn.t, 1)} min`);
  s += txt(20, 326, "ground diameters (journal, seats, thread tip) keep +0.6 mm grinding stock – shoulders and the end are finished now");
  return s + `</svg>`;
}
function thrStateAt(g, u, P) {
  const th = g.th, travel = (fr) => th.x0 - g.px + fr * (g.b1 + 2 * g.px);
  if (P.thr === "lathe") { const Np = 10, pu = clamp(u, 0, 0.9999) * Np, j = Math.floor(pu), fr = pu - j, xt = travel(fr);
    return { xt, q: (x) => (u >= 1 ? 1 : x < xt ? (j + 1) / Np : j / Np), qt: (j + 1) / Np, extraR: 0, label: u >= 1 ? "all passes done" : `pass ${j * 3 + 1}–${j * 3 + 3} of ≈ ${R_PASSES(g)} (shown in 10 steps)` }; }
  const pass = u < 0.5 ? 0 : 1, fr = clamp((u - pass * 0.5) / 0.5, 0, 1), xt = travel(fr);
  return { xt, q: (x) => (pass ? 1 : x < xt ? 1 : 0), qt: 1, extraR: pass ? (u >= 1 ? 0 : 0.5) : 0.5, pass, label: u >= 1 ? "both flanks done" : `pass ${pass + 1} / 2 – ${pass ? "R" : "L"} flank, lead ${f(pass ? g.pR : g.pL, 3)} mm` };
}
const R_PASSES = (g) => Math.ceil(g.h / 0.3) + 8;
function zoomThread(g, o) {   // axial section zoom of the thread top half; o: {x, y, w, h, xc (zone mm), sl, sr, q(xz), ra, tool:{x, rt, s}, stockCol, fin}
  const kz = o.w / (2.6 * g.px), r0 = g.df / 2 - 1.6, Xz = (xz) => o.x + (xz - o.xc) * kz + o.w / 2, Yz = (rad) => o.y + o.h - (rad - r0) * kz;
  let s = `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="6" fill="var(--surface)" stroke="var(--border)"/><clipPath id="${o.id}"><rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="6"/></clipPath><g clip-path="url(#${o.id})">`;
  const xs = []; for (let xz = o.xc - 1.4 * g.px; xz <= o.xc + 1.4 * g.px; xz += 0.04) xs.push(xz);
  const poly = (fn) => `M${Xz(xs[0])},${o.y + o.h} ` + xs.map((xz) => `L${Xz(xz).toFixed(1)},${Yz(fn(xz)).toFixed(1)}`).join("") + ` L${Xz(xs[xs.length - 1])},${o.y + o.h} Z`;
  s += `<path d="${poly(o.mat)}" fill="${o.stockCol || STEEL}" stroke="#555" stroke-width=".8"/>`;
  if (o.inner) s += `<path d="${poly(o.inner)}" fill="${o.innerCol || HARD}" stroke="#444" stroke-width=".8"/>`;
  if (o.fin) s += `<path d="${xs.map((xz, i) => (i ? "L" : "M") + Xz(xz).toFixed(1) + "," + Yz(o.fin(xz)).toFixed(1)).join("")}" fill="none" stroke="var(--critical)" stroke-dasharray="4 3" stroke-width="1.3"/>`;
  if (o.tool) { const t = o.tool, tA = Math.tan(AL), rTop = g.da / 2 + 1.6, hw = (rad) => t.w0 + (rad - t.rt) * tA;
    s += `<path d="M${Xz(t.x - hw(t.rt) + t.dx)},${Yz(t.rt)} L${Xz(t.x - hw(rTop) + t.dx)},${Yz(rTop)} L${Xz(t.x + hw(rTop) + t.dx)},${Yz(rTop)} L${Xz(t.x + hw(t.rt) + t.dx)},${Yz(t.rt)} Z" fill="${t.col || CARB}" opacity=".9" stroke="#333"/>`; }
  s += `</g>`;
  return { s, Xz, Yz, kz };
}
function sceneThread(g, R, u, P) {
  const k = 1.9, X = 170, cy = 104, th = g.th, S = thrStateAt(g, u, P), s0 = R.s0, ph = 0;
  let s = svgOpen(`Op 40 · Rough the thread – ${THR[P.thr].n}`, THR[P.thr].mc) + centres(X, X + g.L * k, cy);
  const rf = rStage(g, "thr", { q: S.q, sl: s0, sr: s0, ph });
  s += `<path d="${shaftPath(rf, X, cy, k, g.L)}" fill="${STEEL}" stroke="#555"/>` + helix(g, X, cy, k, ph, th.dr / 2 - 1, S.q(th.x1 - 1) > 0 ? null : S.xt);
  if (u < 1) { const tx = X + S.xt * k;
    if (P.thr === "whirl") s += `<ellipse cx="${tx}" cy="${cy}" rx="12" ry="${th.dr / 2 * k + 22}" fill="none" stroke="${CARB}" stroke-width="7" opacity=".85" transform="rotate(${-g.gam / RAD * 2},${tx},${cy})"/>`;
    else if (P.thr === "mill") s += `<ellipse cx="${tx}" cy="${cy - th.dr / 2 * k - 34}" rx="8" ry="44" fill="${CARB}" stroke="#7a5a10" transform="rotate(${-g.gam / RAD * 2},${tx},${cy - 60})"/>`;
    else s += `<path d="M${tx},${cy - (g.da / 2 - S.qt * g.h) * k} l-6,-14 l12,0 Z" fill="${CARB}" stroke="#7a5a10"/><rect x="${tx - 8}" y="${cy - th.dr / 2 * k - 50}" width="16" height="36" fill="#777"/>`;
    s += sparks(tx, cy - th.dr / 2 * k + 4, u * 60, 5, "#8a6d3b", 1); }
  // zoom
  const gc = Math.round((g.b1 / 2 - g.px / 2) / g.px) * g.px + g.px / 2, xs0 = th.x0;
  const qz = (xz) => S.q(xz + xs0), raR = th.dr / 2;
  const mat = (xz) => { const q = qz(xz); if (q <= 0) return raR; const tg = ((((xz - g.px / 2) % g.px) + g.px) % g.px) - g.px / 2; return thrR(g, xz, 0, s0, s0 + (tg > 0 ? S.extraR : 0), q, raR); };
  let tool = null; const txz = S.xt - xs0;
  if (u < 1 && Math.abs(txz - gc) < 1.4 * g.px) { const gcT = Math.round((txz - g.px / 2) / g.px) * g.px + g.px / 2, rt = g.da / 2 + 0.3 - S.qt * (g.da / 2 + 0.3 - g.df / 2);
    tool = { x: gcT, rt, w0: g.px / 4 - s0 / Math.cos(AL) + (g.df / 2 - g.d1 / 2) * Math.tan(AL), dx: S.extraR && !S.pass ? -0.25 : 0 }; }
  const Z = zoomThread(g, { id: "wmZ1", x: 20, y: 196, w: 390, h: 176, xc: gc, mat, fin: (xz) => thrR(g, xz, 0, 0, 0, 1, g.da / 2), tool });
  s += Z.s + txt(28, 212, "Axial section of the thread (zoom, real shape)", "font-weight:600") + txt(28, 228, "red dashed = finished flank after grinding · gap between = stock", "fill:var(--critical)");
  // right panel
  const x0 = 430;
  s += big(x0, 214, S.label);
  const lines = P.thr === "whirl" ? ["Whirling ring (4–6 form inserts) turns fast,", "the worm turns slowly (≈ 5 rpm) – 1 pass per flank.", "Ring tilted by the lead angle γ."]
    : P.thr === "mill" ? ["Disc cutter on a thread milling machine,", "tilted by γ – 1 pass per flank,", "the worm turns ≈ 2 rpm."]
      : ["One form tool, ≈ " + R_PASSES(g) + " passes,", "alternate flank infeed (cuts on one flank at a time),", "spring passes at the end."];
  lines.forEach((l, i) => { s += txt(x0, 236 + i * 16, l); });
  s += txt(x0, 292, `Duplex: flank shift at the thread ends ±${f(R.O.thread.endShift, 2)} mm`, "font-weight:600") + txt(x0, 308, `> stock ${P.s0} mm → each flank is cut with ITS lead`);
  s += txt(x0, 326, `Tool side clearance ≥ γ + 3° = ${f(g.gam / RAD + 3, 1)}° (else the tool rubs)`) + txt(x0, 344, `Time ≈ ${f(R.O.thread.t, 1)} min · then wire check: M_soft ≈ ${f(g.M0 + 2 * P.s0 / Math.sin(AL), 2)} mm`);
  return s + `</svg>`;
}
function htCycle(tc) {
  const pts = [[0, 20, ""], [1.5, 925, "heat up"], [1.5 + tc, 925, "carburise"], [2 + tc, 840, "to 840 °C"], [2.5 + tc, 840, "hold"], [2.6 + tc, 60, "oil quench"], [3 + tc, 30, "wash"], [3.5 + tc, 180, "temper"], [5.5 + tc, 180, "180 °C 2 h"], [6 + tc, 30, "cool"]];
  return pts;
}
function sceneHT(g, R, u) {
  const H = R.O.ht, cyc = htCycle(H.tc), tEnd = cyc[cyc.length - 1][0], tu = clamp(u / 0.8, 0, 1) * tEnd;
  let Tn = 20, seg = 0; for (let i = 1; i < cyc.length; i++) if (tu <= cyc[i][0] || i === cyc.length - 1) { const a = cyc[i - 1], b = cyc[i], fr = clamp((tu - a[0]) / Math.max(1e-6, b[0] - a[0]), 0, 1); Tn = lerp(a[1], b[1], fr); seg = i; break; }
  const lab = cyc[seg][2], inOil = seg === 5 || seg === 6;
  let s = svgOpen("Op 50 · Case hardening: carburise → quench → temper", "sealed-quench furnace");
  if (u < 0.8) {
    const glow = clamp((Tn - 300) / 625, 0, 1), col = `rgb(${Math.round(lerp(120, 255, glow))},${Math.round(lerp(120, 120, glow))},${Math.round(lerp(120, 40, glow))})`;
    s += `<rect x="20" y="40" width="210" height="190" rx="8" fill="var(--surface-2)" stroke="var(--axis)" stroke-width="2"/><rect x="34" y="54" width="182" height="162" rx="4" fill="${seg >= 7 ? "#efe6d8" : glow > 0 ? "#3a2418" : "#2a2a2a"}"/>`;
    s += `<rect x="20" y="246" width="210" height="80" rx="6" fill="#d9c27a" opacity=".45" stroke="var(--axis)"/>${txt(28, 340, "oil quench tank (60 °C)")}`;
    const wy = inOil ? 252 : 70;
    for (let i = 0; i < 4; i++) s += `<rect x="${60 + i * 38}" y="${wy}" width="16" height="130" rx="3" fill="${seg >= 6 ? HARD : col}" stroke="#333"/><line x1="${68 + i * 38}" y1="${wy - 10}" x2="${68 + i * 38}" y2="${wy}" stroke="#555"/>`;
    s += `<line x1="50" y1="${wy - 10}" x2="200" y2="${wy - 10}" stroke="#555" stroke-width="3"/>`;
    s += big(28, 362, `${f(Tn, 0)} °C · ${lab}`, seg === 2 ? "var(--critical)" : "var(--text)");
  } else {
    // straightening press + dial gauge
    const v = (u - 0.8) / 0.2, run = lerp(H.rHT, H.rS, H.straight ? ease(clamp((v - 0.3) / 0.5, 0, 1)) : 0);
    s += `<rect x="20" y="40" width="210" height="300" rx="8" fill="var(--surface)" stroke="var(--border)"/>${txt(28, 58, "Runout check + straightening", "font-weight:600")}`;
    s += `<rect x="40" y="170" width="170" height="16" rx="4" fill="${HARD}" stroke="#333" transform="rotate(${-(run / 0.1) * 2},125,178)"/><path d="M40,200 l12,-14 l12,14 Z M186,200 l12,-14 l12,14 Z" fill="#666"/>`;
    if (H.straight) s += `<rect x="115" y="${110 + (v > 0.3 && v < 0.7 ? 34 : 10)}" width="20" height="40" fill="#777"/>${txt(140, 120, "press")}`;
    s += `<circle cx="125" cy="250" r="26" fill="var(--surface)" stroke="var(--text-2)" stroke-width="2"/><line x1="125" y1="250" x2="${125 + 22 * Math.sin(run / 0.1 * 3)}" y2="${250 - 22 * Math.cos(run / 0.1 * 3)}" stroke="var(--critical)" stroke-width="2"/><line x1="125" y1="224" x2="125" y2="190" stroke="var(--text-2)"/>`;
    s += big(40, 300, `runout ${f(run, 3)} mm`, run > 0.04 ? "var(--critical)" : "var(--good-text)") + txt(30, 320, H.straight ? "> 0.04 mm → straighten, crack test" : "≤ 0.04 mm → no straightening");
  }
  // T-t chart
  const cut = cyc.filter((p) => p[0] <= tu).map((p) => [p[0], p[1]]); cut.push([tu, Tn]);
  s += chart({ x: 246, y: 30, w: 504, h: 160, t: "Temperature – time (one furnace charge)", xr: [0, tEnd], yr: [0, 1000], xl: "hours", note: `cycle ${f(tEnd + 0.5, 1)} h`, series: [{ pts: cyc.map((p) => [p[0], p[1]]), col: "var(--grid)", w: 1.5 }, { pts: cut, col: "var(--critical)" }] });
  // carbon + hardness profiles
  const cs = clamp((tu - 1.5) / H.tc, 0, 1), lam = H.CHD / (2 * 0.73) * Math.sqrt(Math.max(0.001, cs)), erfc = (x) => { const t = 1 / (1 + 0.5 * x); return t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); };
  const Cz = (z) => 0.17 + 0.63 * erfc(z / (2 * lam)), HV = (c) => (c >= 0.36 ? Math.min(740, 550 + (c - 0.36) * 386) : 360 + (c - 0.17) * 1000);
  const zs = Array.from({ length: 41 }, (_, i) => i * 0.05);
  s += chart({ x: 246, y: 200, w: 248, h: 176, t: "Carbon % vs depth", xr: [0, 2], yr: [0, 1], xl: "depth mm", series: cs > 0 ? [{ pts: zs.map((z) => [z, Cz(z)]), col: CL }] : [], hl: [{ y: 0.17, t: "core 0.17 %" }] });
  const hard = tu >= cyc[5][0];
  s += chart({ x: 502, y: 200, w: 248, h: 176, t: "Hardness HV vs depth", xr: [0, 2], yr: [300, 800], xl: "depth mm", note: hard ? `CHD ${f(H.CHD, 2)} mm` : "after quench",
    series: hard ? [{ pts: zs.map((z) => [z, HV(Cz(z))]), col: CR }] : [], hl: [{ y: 550, t: "550 HV = CHD limit" }] });
  if (hard) { const X0 = 502 + 36, kx = (248 - 44) / 2; s += `<rect x="${X0}" y="222" width="${R.s0 * kx}" height="130" fill="var(--warning)" opacity=".25"/><text x="${X0 + 3}" y="236" class="apc-t" style="font-size:9.5px">ground off</text>`; }
  return s + `</svg>`;
}
function scenePrep(g, R, u, F) {
  const p = R.O.prep, H = R.O.ht, i = Math.min(2, Math.floor(u * 3)), v = (u * 3) % 1;
  let s = svgOpen("Op 60 · Clean, test hardness, re-grind the centre holes", "shot blast · hardness tester · centre-hole grinder");
  const box = (x, n, t) => `<rect x="${x}" y="34" width="240" height="338" rx="8" fill="var(--surface)" stroke="${i === n ? "var(--accent)" : "var(--border)"}" stroke-width="${i === n ? 2 : 1}"/>${txt(x + 10, 54, t, "font-weight:600")}`;
  s += box(10, 0, "1 · Shot blast") + box(260, 1, "2 · Hardness + case depth") + box(510, 2, "3 · Centre holes");
  // 1 shot blast
  s += `<rect x="30" y="170" width="200" height="34" rx="4" fill="${i > 0 || v > 0.7 ? HARD : "#5d5048"}" stroke="#333"/><path d="M110,90 l20,0 l-4,40 l-12,0 Z" fill="#777"/>`;
  if (i === 0) for (let j = 0; j < 18; j++) { const a = (j * 1.7 + v * 20) % 1; s += `<circle cx="${112 + (j % 5 - 2) * 10 * a}" cy="${130 + a * 40}" r="1.6" fill="#555"/>`; }
  s += txt(26, 230, "steel shot removes scale + copper paste") + txt(26, 246, "(clean surface for grinding + etching)");
  // 2 coupon
  const cx = 280, cy = 90, rim = clamp(H.CHD / 1.5, 0.15, 1) * 40;
  s += `<rect x="${cx}" y="${cy}" width="200" height="100" fill="#cfd5da" stroke="#333"/><rect x="${cx}" y="${cy}" width="200" height="${rim}" fill="${HARD}"/>${txt(cx + 4, cy + 12, "hard case", "fill:#fff")}${txt(cx + 4, cy + 92, "core")}`;
  const nInd = i >= 1 ? Math.floor((i > 1 ? 1 : v) * 8) : 0;
  for (let j = 0; j < nInd; j++) s += `<path d="M${cx + 70 + j * 16},${cy + 6 + j * 9} l3,3 l-3,3 l-3,-3 Z" fill="#222"/>`;
  s += txt(cx, 214, "HV1 traverse every 0.1 mm into the depth:") + txt(cx, 230, "CHD = depth where hardness = 550 HV");
  if (i >= 1) { s += big(cx, 262, `CHD ${f(H.CHD, 2)} mm`, H.CHD >= p.chdNeed ? "var(--good-text)" : "var(--critical)") + txt(cx, 280, `need ≥ ${f(p.chdNeed, 2)} = ${R.P.chdMin} finished + ${R.P.s0} stock + 0.05`);
    s += txt(cx, 300, `surface ${f(H.HRC, 1)} HRC · core ${f(H.core, 0)} HRC`); if (H.CHD < p.chdNeed) s += txt(cx, 320, "✕ too thin – grinding would cut through the case", "fill:var(--critical);font-weight:600"); }
  // 3 centre hole grinding
  const hx = 560, hy = 190;
  s += `<path d="M${hx},${hy - 70} L${hx + 120},${hy - 70} L${hx + 120},${hy + 70} L${hx},${hy + 70} L${hx},${hy + 30} L${hx + 70},${hy + 6} L${hx + 70},${hy - 6} L${hx},${hy - 30} Z" fill="${HARD}" stroke="#333"/>`;
  if (F.centre) s += `<path d="M${hx - 30},${hy - 40} L${hx + 150},${hy + 40} M${hx - 30},${hy + 40} L${hx + 150},${hy - 40}" stroke="var(--critical)" stroke-width="3"/>` + big(hx - 30, hy + 110, "SKIPPED (fault)", "var(--critical)") + txt(hx - 30, hy + 130, "distorted cone + scale → the worm wobbles") + txt(hx - 30, hy + 146, "on the centres in Op 70 / 80");
  else { const wob = i === 2 ? Math.sin(v * 40) * 4 : 0; s += `<path d="M${hx - 50},${hy - 24 + wob} L${hx + 52},${hy + wob} L${hx - 50},${hy + 24 + wob} Z" fill="#b9a27a" stroke="#555"/><rect x="${hx - 110}" y="${hy - 8 + wob}" width="60" height="16" fill="#777"/>`;
    s += txt(hx - 30, hy + 110, "stone turns fast + orbits (planetary)") + txt(hx - 30, hy + 126, "→ true 60° cone again, ≥ 80 % contact"); }
  return s + `</svg>`;
}
function sceneCyl(g, R, u) {
  const k = (SW - 230) / g.L, X = 115, cy = 182, C = R.O.cyl, list = g.segs.filter((q) => q.gr), n = list.length, i = Math.min(n - 1, Math.floor(u * n)), v = u >= 1 ? 1 : (u * n) % 1;
  const seg = {}; list.forEach((q, j) => { if (q.k === "th") return; seg[q.k] = j < i || u >= 1 ? q.d / 2 : j === i ? q.d / 2 + 0.3 * (1 - ease(clamp(v / 0.8, 0, 1))) : q.dr / 2; });
  const thI = list.findIndex((q) => q.k === "th"), raT = thI < i || u >= 1 ? g.da / 2 : thI === i ? g.da / 2 + 0.3 * (1 - ease(clamp(v / 0.8, 0, 1))) : g.th.dr / 2;
  let s = svgOpen("Op 70 · Cylindrical grinding of journal, bearing seats and thread tip", "CNC cylindrical grinder") + centres(X, X + g.L * k, cy);
  s += `<path d="${shaftPath(rStage(g, "thr", { q: 1, sl: R.s0, sr: R.s0, seg, ra: raT }), X, cy, k, g.L)}" fill="${HARD}" stroke="#333"/>`;
  list.forEach((q, j) => { if (j < i || u >= 1 || (j === i && v > 0.8)) { const rr = q.k === "th" ? g.da / 2 : q.d / 2; s += `<rect x="${X + q.x0 * k + 1}" y="${cy - rr * k + 1}" width="${q.L * k - 2}" height="3" fill="${GRD}"/>`; } });
  const cur = list[i], rr = cur.k === "th" ? raT : seg[cur.k], trav = cur.k === "th" ? Math.sin(v * 12) * (cur.L / 2 - 8) : 0, wx = X + (cur.x0 + cur.L / 2 + trav) * k, Rw = 46, wy = cy - rr * k - Rw - 1;
  s += `<circle cx="${wx}" cy="${wy}" r="${Rw}" fill="${WHEEL}" stroke="#7a6a4a" stroke-width="2"/><circle cx="${wx}" cy="${wy}" r="12" fill="#666"/>${txt(wx + Rw + 6, wy - 20, "grinding wheel Ø500")}`;
  if (u < 1 && v < 0.85) s += sparks(wx, cy - rr * k, u * 60, 8, "#e8a33a", 1);
  s += `<path d="M${wx - 14},${cy + rr * k + 26} L${wx - 4},${cy + rr * k + 2} M${wx + 14},${cy + rr * k + 26} L${wx + 4},${cy + rr * k + 2}" stroke="var(--accent)" stroke-width="3"/>${txt(wx + 18, cy + rr * k + 30, "in-process gauge")}`;
  const d = C.grd.find((q) => q.k === cur.k), stock = 600 * (1 - ease(clamp(v / 0.8, 0, 1))), dev = d.dev * 1000 + stock;
  const bx = 330, by = 290, bw = 400, lo = d.ei * 1000 - 10, hi = d.es * 1000 + 40, BX = (val) => bx + (clamp(val, lo, hi) - lo) / (hi - lo) * bw;
  s += big(20, 300, `${cur.n} Ø${cur.d} ${d.tol}`) + txt(20, 320, `deviation now: ${dev >= 0 ? "+" : ""}${f(dev, 1)} µm`, "font-size:13px;fill:var(--text)") + txt(20, 338, v < 0.8 ? "rough → finish infeed" : "spark-out (no infeed) → size");
  s += `<rect x="${bx}" y="${by}" width="${bw}" height="16" rx="4" fill="var(--surface-2)" stroke="var(--border)"/><rect x="${BX(d.ei * 1000)}" y="${by}" width="${BX(d.es * 1000) - BX(d.ei * 1000)}" height="16" fill="var(--good)" opacity=".35"/>`;
  s += `<line x1="${BX(dev)}" y1="${by - 6}" x2="${BX(dev)}" y2="${by + 22}" stroke="var(--text)" stroke-width="3"/>${txt(BX(d.ei * 1000), by + 34, `tolerance ${f(d.ei * 1000, 0)}…${f(d.es * 1000, 0)} µm`)}${txt(bx + bw - 60, by - 6, "→ +40 µm")}`;
  s += txt(330, 350, `seat runout to axis A–B after grinding: ${f(C.runS, 1)} µm (≤ ${R.P.tRun})`, C.runS > R.P.tRun ? "fill:var(--critical);font-weight:600" : "");
  return s + `</svg>`;
}
function sceneTG(g, R, u, P) {
  const T = R.O.tg, ps = T.passes, n = ps.length, pi = Math.min(n - 1, Math.floor(u * n)), v = u >= 1 ? 1 : (u * n) % 1, cur = ps[pi], prev = pi > 0 ? ps[pi - 1] : { remL: R.O.thread.sL0, remR: R.O.thread.sR0 };
  const remL = u >= 1 ? cur.remL : cur.fl === "L" ? lerp(prev.remL, cur.remL, v) : prev.remL, remR = u >= 1 ? cur.remR : cur.fl === "R" ? lerp(prev.remR, cur.remR, v) : prev.remR;
  const k = 1.9, X = 170, cy = 92, th = g.th, rot = (u * n * 3) % 1 * g.px;
  let s = svgOpen("Op 80 · Thread grinding – each flank with its own lead (duplex)", "CNC worm grinding machine") + centres(X, X + g.L * k, cy);
  s += `<path d="${shaftPath(rStage(g, "final", { q: 1, sl: 0, sr: 0, ph: rot }), X, cy, k, g.L)}" fill="${HARD}" stroke="#333"/>` + helix(g, X, cy, k, rot, g.da / 2 - 1);
  g.segs.filter((q) => q.gr && q.k !== "th").forEach((q) => { s += `<rect x="${X + q.x0 * k + 1}" y="${cy - q.d / 2 * k + 1}" width="${q.L * k - 2}" height="3" fill="${GRD}"/>`; });
  const dirR = pi % 2 === 0, xw = X + (th.x0 + (dirR ? v : 1 - v) * th.L) * k;
  s += `<rect x="${xw - 5}" y="${cy - 74}" width="10" height="148" rx="3" fill="${WHEEL}" stroke="#7a6a4a" transform="rotate(${-g.gam / RAD * 3},${xw},${cy})"/>${txt(xw + 12, cy - 62, "disc wheel, tilted γ (drawn ×3)")}`;
  if (cur.ae > 0 && u < 1) s += sparks(xw, cy + g.da / 2 * k - 2, u * 80, 8, "#e8a33a", 1);
  if (cur.dress && v < 0.25 && u < 1) s += big(xw - 40, cy + 84, "dressing…", "var(--accent)");
  // zoom: stock layers drawn x4
  const ex = 4, gc = Math.round((g.b1 / 2 - g.px / 2) / g.px) * g.px + g.px / 2, ra = g.da / 2;
  const mat = (xz) => thrR(g, xz, 0, remL * ex, remR * ex, 1, ra), fin = (xz) => thrR(g, xz, 0, 0, 0, 1, ra);
  const tA = Math.tan(AL), wAt = (sv, rad) => g.px / 4 - sv / Math.cos(AL) + (rad - g.d1 / 2) * tA;
  const rB = g.df / 2 + 0.6 * g.m * 0.5, thick = wAt(remL * ex, rB) + wAt(remR * ex, rB) - 0.35, leftWall = gc - wAt(remL * ex, rB), rightWall = gc + wAt(remR * ex, rB);
  const wc = cur.fl === "L" ? leftWall + thick / 2 : rightWall - thick / 2;
  const Z = zoomThread(g, { id: "wmZ2", x: 20, y: 196, w: 390, h: 176, xc: gc, mat, inner: fin, stockCol: "#e09a3a", innerCol: HARD,
    tool: u < 1 ? { x: wc, rt: rB, w0: thick / 2, dx: 0, col: WHEEL } : null });
  s += Z.s + txt(28, 212, "Axial section – orange = stock left (drawn ×4)", "font-weight:600");
  if (!T.clean && pi >= n - 3) { const fl = !T.cleanL ? -1 : 1; for (let j = 0; j < 4; j++) { const rad = g.d1 / 2 - 1.5 + j * 1.2, xz = gc + fl * (wAt(0, rad) + 0.05); s += `<circle cx="${Z.Xz(xz)}" cy="${Z.Yz(rad)}" r="4" fill="#111"/>`; } s += txt(28, 364, "black = flank not touched by the wheel (stock too small)", "fill:var(--critical);font-weight:600"); }
  // readouts
  const x0 = 430, Qw = cur.ae * T.vw, br = Qw / T.qlimE;
  s += big(x0, 214, `pass ${pi + 1} / ${n} · ${cur.fl} flank · ${cur.kind}`);
  s += txt(x0, 234, `lead programmed: ${f(cur.fl === "L" ? g.px * g.z1 - g.z1 * T.dpU / 2 : g.px * g.z1 + g.z1 * T.dpU / 2, 3)} mm · infeed ae ${cur.ae} mm`);
  s += txt(x0, 252, `stock left: L ${f(remL * 1000, 0)} µm · R ${f(remR * 1000, 0)} µm`);
  s += txt(x0, 276, `Burn risk Q'w = ae·vw = ${f(Qw, 2)} of ${f(T.qlimE, 1)} mm³/(mm·s)`) + `<rect x="${x0}" y="282" width="300" height="12" rx="4" fill="var(--surface-2)" stroke="var(--border)"/><rect x="${x0}" y="282" width="${clamp(br, 0, 1.3) / 1.3 * 300}" height="12" rx="4" fill="${br > 1 ? "var(--critical)" : br > 0.7 ? "var(--warning)" : "var(--good)"}"/><line x1="${x0 + 300 / 1.3}" y1="278" x2="${x0 + 300 / 1.3}" y2="298" stroke="var(--text)"/>`;
  s += txt(x0, 314, `worm temperature +${f(T.dT * clamp(u * 1.5, 0, 1), 1)} K → lead error ${f(T.thermErr * clamp(u * 1.5, 0, 1), 1)} µm over ${f(g.Lb, 0)} mm`, T.dT > 2 ? "fill:var(--critical)" : "");
  s += txt(x0, 332, `wheel wear since last dressing ≈ ${f(0.25 * (pi % T.dN + v), 1)} µm (dress every ${T.dN})`, T.dN > 12 ? "fill:var(--critical)" : "");
  s += txt(x0, 350, `time ${f(T.tPass, 2)} min/pass · total ≈ ${f(T.t, 1)} min`);
  return s + `</svg>`;
}
function sceneEtch(g, R, u) {
  const E = R.O.etch, T = R.O.tg, tanks = ["degrease", "nital 3 %", "rinse", "bleach HCl", "neutralise"];
  let s = svgOpen("Op 90 · Grinding burn test by nital etching (ISO 14104)", "etch line");
  const ti = Math.min(4, Math.floor(clamp(u / 0.7, 0, 0.9999) * 5)), tv = (clamp(u / 0.7, 0, 0.9999) * 5) % 1;
  if (u < 0.7) {
    tanks.forEach((t, i) => { s += `<rect x="${30 + i * 145}" y="170" width="120" height="90" rx="4" fill="${i === 1 ? "#e8d9a8" : "#cfe2ee"}" stroke="var(--axis)"/>${txt(40 + i * 145, 278, t)}`; });
    s += `<line x1="20" y1="70" x2="740" y2="70" stroke="var(--axis)" stroke-width="4"/>`;
    const x = 90 + ti * 145, dip = Math.sin(tv * Math.PI); s += `<line x1="${x}" y1="70" x2="${x}" y2="${100 + dip * 90}" stroke="#555"/><rect x="${x - 60}" y="${100 + dip * 90}" width="120" height="14" rx="3" fill="${HARD}" stroke="#333"/>`;
    s += txt(30, 50, `bath ${ti + 1} / 5: ${tanks[ti]}`, "font-weight:600;fill:var(--text)") + txt(30, 320, "burnt (re-tempered) areas etch DARK, re-hardened areas WHITE (ISO 14104 classes)");
    s += txt(30, 338, "100 % of the worms – grinding burn cannot be seen without etching");
  } else { // inspection view
    const k = 2.4, X = 110, cy = 220, burn = T.burn, unclean = !T.clean;
    s += txt(30, 46, "Inspection under bright white light", "font-weight:600;fill:var(--text)");
    s += `<path d="${shaftPath(rStage(g, "final", { q: 1 }), X, cy, k, g.L)}" fill="#9aa3ab" stroke="#333"/>` + helix(g, X, cy, k, 0, g.da / 2 - 1);
    if (burn) for (let j = 0; j < 5; j++) s += `<ellipse cx="${X + (g.th.x0 + 12 + j * 16) * k}" cy="${cy - 14 + (j % 2) * 26}" rx="12" ry="7" fill="#3b3b3b" opacity=".75"/>`;
    if (unclean) for (let j = 0; j < 4; j++) s += `<circle cx="${X + (g.th.x0 + 20 + j * 19) * k}" cy="${cy + 18 - (j % 2) * 30}" r="5" fill="#000"/>`;
    s += big(30, 330, E.res[0][1], burn || unclean ? "var(--critical)" : "var(--good-text)");
    s += txt(30, 352, burn ? "temper burn: the surface got too hot → softer + tensile stress → pitting / cracks later → REJECT" : unclean ? "unground spots: the grinding stock was too small → REJECT" : "no dark areas: the grinding heat was under control");
  }
  return s + `</svg>`;
}
function sceneGMM(g, R, u, P) {
  const G = R.O.gmm, ph = [0, 0.22, 0.44, 0.62, 0.78, 0.9, 1], i = ph.findIndex((p, j) => u >= p && u < ph[j + 1]) === -1 ? 5 : ph.findIndex((p, j) => u >= p && u < ph[j + 1]), v = clamp((u - ph[i]) / (ph[i + 1] - ph[i]), 0, 1);
  const names = ["Lead scan – L flank", "Lead scan – R flank", "Profile scan – L + R flank", "Runout – ball in 12 gaps", "Axial pitch", "Over-wire size M at 4 places (duplex check)"];
  let s = svgOpen(`Op 100 · Inspection on the gear measuring machine – ${names[i]}`, "20 °C measuring room");
  const k = 1.1, xw = 150, yB = 350, th = g.th;
  let zp = th.x0 + g.m + (i < 2 ? v * g.Lb : g.b1 / 2), rot = i < 2 ? v * g.Lb : i === 3 ? v * g.px : 0;
  s += `<rect x="30" y="${yB + 4}" width="250" height="18" rx="4" fill="var(--surface-2)" stroke="var(--axis)"/><rect x="${xw - 40}" y="${yB - 6}" width="80" height="10" fill="#777"/>`;
  s += `<g transform="translate(${xw},${yB}) rotate(-90)"><path d="${shaftPath(rStage(g, "final", { q: 1, ph: -rot }), 0, 0, k, g.L)}" fill="${HARD}" stroke="#333"/></g>`;
  s += `<rect x="${xw - 30}" y="${yB - g.L * k - 30}" width="60" height="20" fill="#777"/><line x1="40" y1="${yB}" x2="40" y2="40" stroke="var(--axis)" stroke-width="10"/>${txt(28, 36, "column")}`;
  const pyy = yB - zp * k, pxx = xw + (g.d1 / 2) * k + 3;
  s += `<line x1="${pxx + 4}" y1="${pyy}" x2="290" y2="${pyy}" stroke="#555" stroke-width="4"/><circle cx="${pxx}" cy="${pyy}" r="4" fill="var(--critical)"/><rect x="270" y="${pyy - 12}" width="26" height="24" fill="#777"/>${txt(206, pyy - 10, "probe")}`;
  const cx = 310, cw = 440;
  if (i <= 1) { const tr = i ? G.trLR : G.trLL, n = Math.max(1, Math.round(v * tr.length)), Fx = i ? G.LR : G.LL;
    s += chart({ x: cx, y: 40, w: cw, h: 220, t: `Lead deviation ${i ? "R" : "L"} flank (µm) along ${f(g.Lb, 0)} mm`, xr: [0, g.Lb], yr: [-10, 10], xl: "axial position mm", hl: [{ y: P.tHb, t: `+${P.tHb}` }, { y: -P.tHb, t: `−${P.tHb}` }], series: [{ pts: tr.slice(0, n), col: i ? CR : CL }] });
    if (v >= 1 || n >= tr.length) s += big(cx, 290, `fHβ ${f(Fx.fH, 1)} µm · ffβ ${f(Fx.ff, 1)} µm`, Math.abs(Fx.fH) <= P.tHb ? "var(--good-text)" : "var(--critical)"); }
  else if (i === 2) { const n = Math.max(1, Math.round(v * G.trPL.length));
    s += chart({ x: cx, y: 40, w: cw, h: 220, t: "Profile deviation (µm) from root to tip", xr: [0, G.trPL[30][0]], yr: [-12, 6], xl: "profile height mm", hl: [{ y: 0, dash: "1 0", col: "var(--axis)" }], series: [{ pts: G.trPL.slice(0, n), col: CL }, { pts: G.trPR.slice(0, n), col: CR }], legend: [["L flank", CL], ["R flank", CR]] });
    if (v >= 1) s += big(cx, 290, `Fα L ${f(G.FaL, 1)} · R ${f(G.FaR, 1)} µm`, Math.max(G.FaL, G.FaR) <= P.tFa ? "var(--good-text)" : "var(--critical)"); }
  else if (i === 3) { const n = Math.max(1, Math.round(v * 12));
    s += chart({ x: cx, y: 40, w: cw, h: 220, t: "Runout – ball position in the gap (µm)", xr: [0, 330], yr: [-8, 8], xt: [0, 90, 180, 270], xl: "angle °", series: [{ pts: G.trRun.slice(0, n), col: CL, dots: true, lab: "angle" }] });
    if (v >= 1) s += big(cx, 290, `Fr ${f(G.Fr, 1)} µm`, G.Fr <= P.tFr ? "var(--good-text)" : "var(--critical)"); }
  else if (i === 4) { const n = Math.max(1, Math.round(v * G.trPitch.length));
    s += chart({ x: cx, y: 40, w: cw, h: 220, t: "Single axial pitch deviation fpx (µm)", xr: [0.5, g.nP + 0.5], xt: G.trPitch.map((p) => p[0]), yr: [-5, 5], xl: "pitch no.", hl: [{ y: P.tfp, t: `+${P.tfp}` }, { y: -P.tfp, t: `−${P.tfp}` }], series: [{ pts: G.trPitch.slice(0, n), col: CL, bars: true, lab: "pitch" }] }); }
  else { const n = Math.max(1, Math.round(v * 4));
    s += chart({ x: cx, y: 40, w: cw, h: 220, t: "Over-wire size M (mm) along the worm", xr: [-2 * g.px, 2 * g.px], yr: [g.M0 - 1.2, g.M0 + 1.2], xl: "position from the middle mm",
      series: [{ pts: [[-2 * g.px, g.M0 - 2 * g.px * g.dMdx], [2 * g.px, g.M0 + 2 * g.px * g.dMdx]], col: "var(--axis)", dash: "4 3", w: 1.5 }, { pts: G.trM.slice(0, n), col: CL, dots: true, dotsOnly: true, lab: "x" }], legend: [["design", "var(--axis)"], ["measured", CL]] });
    s += txt(cx, 290, `3 wires Ø${f(g.dw, 3)} mm · M₀ = d₁ − pₓ/(2·tan20°) + dw·(1 + 1/sin20°) = ${f(g.M0, 3)} mm`); }
  s += txt(cx, 316, i <= 1 ? "Worm turns + probe moves along the axis in sync (stays on one flank)." : i === 2 ? "Probe moves from root to tip; worn wheel edges round off the tip and root (\"roll-off\")." : i === 3 ? "Ball in each gap: radial position → eccentricity of the thread to the bearing seats." : i === 4 ? "Distance between neighbouring flanks; a short lead (warm worm when ground) adds up." : "Duplex: the thread gets thicker along the worm, so M must grow by the design slope.");
  s += txt(cx, 334, "Reference axis = the two bearing seats (like in the rotary table)");
  return s + `</svg>`;
}
function sceneBench(g, R, u, P) {
  const B = R.O.bench, ph = [0, 0.3, 0.55, 0.72, 1], i = u >= 1 ? 3 : ph.findIndex((p, j) => u >= p && u < ph[j + 1]), v = clamp((u - ph[i]) / (ph[i + 1] - ph[i]), 0, 1);
  const names = ["Single-flank rolling test", "Backlash vs axial shift (duplex)", "Contact pattern (marking paste)", "Run-in 2 h under load"];
  let s = svgOpen(`Op 110 · Test bench – ${names[i]}`, "master wheel class 4");
  const cy = 300, k = 1.0, X = 150, th = g.th, rot = (u * 60) % 1 * g.px, shift = i === 1 ? v * P.sRange : 0;
  s += `<rect x="20" y="${cy - 22}" width="60" height="44" rx="4" fill="#556" />${txt(22, cy + 38, "servo")}<rect x="86" y="${cy - 10}" width="26" height="20" fill="var(--accent)"/>${txt(84, cy - 16, "torque")}`;
  s += `<line x1="80" y1="${cy}" x2="${X}" y2="${cy}" stroke="#555" stroke-width="5"/>`;
  s += `<g transform="translate(${shift * 3},0)"><path d="${shaftPath(rStage(g, "final", { q: 1, ph: rot }), X, cy, k, g.L)}" fill="${HARD}" stroke="#333"/>${helix(g, X, cy, k, rot, g.da / 2 - 1)}</g>`;
  const wcx = X + (th.x0 + th.L / 2) * k, Rw = 92, wcy = cy - g.da / 2 * k - Rw + 6, ang = u * 360 * 3;
  s += `<circle cx="${wcx}" cy="${wcy}" r="${Rw}" fill="#d9a066" stroke="#7a4a1a" stroke-width="2"/>`;
  for (let t = 0; t < 36; t++) { const a = (t * 10 + ang) * RAD; s += `<line x1="${wcx + Math.cos(a) * (Rw - 8)}" y1="${wcy + Math.sin(a) * (Rw - 8)}" x2="${wcx + Math.cos(a) * Rw}" y2="${wcy + Math.sin(a) * Rw}" stroke="#7a4a1a"/>`; }
  s += `<circle cx="${wcx}" cy="${wcy}" r="22" fill="var(--surface)" stroke="var(--accent)" stroke-width="3"/>${txt(wcx - 18, wcy + 4, "enc. 2")}`;
  s += `<text x="${wcx - Rw - 8}" y="${wcy - 40}" class="apc-t r">master wheel</text><text x="${wcx - Rw - 8}" y="${wcy - 26}" class="apc-t r">(not to scale)</text><text x="${wcx - Rw - 8}" y="${wcy + 4}" class="apc-t r">brake = load torque</text><text x="${wcx - Rw - 8}" y="${wcy + 18}" class="apc-t r">encoder 2 = wheel angle</text>`;
  if (i === 1) s += `<circle cx="${wcx - Rw - 26}" cy="${wcy + 56}" r="16" fill="var(--surface)" stroke="var(--text-2)" stroke-width="2"/><line x1="${wcx - Rw - 10}" y1="${wcy + 56}" x2="${wcx - Rw + 6}" y2="${wcy + 56}" stroke="var(--text-2)"/><text x="${wcx - Rw - 46}" y="${wcy + 60}" class="apc-t r">dial gauge</text>`;
  if (i === 1) s += txt(X, cy + 50, `worm shifted ${f(shift, 1)} mm →`, "fill:var(--critical);font-weight:600");
  const cx = 430, cw = 320;
  if (i === 0) { const n = Math.max(2, Math.round(v * B.trTE.length));
    s += chart({ x: cx, y: 30, w: cw, h: 160, t: "Transmission error, 1 wheel turn (″)", xr: [0, 360], xt: [0, 90, 180, 270, 360], yr: [-4, 4], xl: "wheel angle °", series: [{ pts: B.trTE.slice(0, n), col: CL, w: 1 }] });
    s += chart({ x: cx, y: 196, w: cw, h: 150, t: "Zoom: 5 worm turns", xr: [0, 5], yr: [-4, 4], xl: "worm turns", series: [{ pts: B.trTEz.slice(0, Math.max(2, Math.round(v * B.trTEz.length))), col: CL, w: 1.5 }] });
    if (v >= 1) s += txt(cx, 366, `F'i ${f(B.Fi, 2)}″ · f'i ${f(B.fi, 2)}″ (limit ${P.tTE}″)`, B.fi <= P.tTE ? "font-weight:600;fill:var(--good-text)" : "font-weight:600;fill:var(--critical)"); }
  else if (i === 1) { const n = Math.max(1, Math.round(v * B.trJ.length)), xs = [0, P.sRange];
    s += chart({ x: cx, y: 30, w: cw, h: 230, t: "Backlash (µm) vs axial worm shift", xr: [0, Math.max(5, P.sRange)], yr: [-40, 70], hl: [{ y: 0, t: "< 0 = jammed", col: "var(--critical)" }], xl: "shift mm", band: [[5, 10]],
      series: [{ pts: xs.map((x) => [x, g.j0 * 1000 - x * g.dp / g.px * 1000]), col: "var(--axis)", dash: "4 3", w: 1.5 }, { pts: B.trJ.slice(0, n), col: CL, dots: true, dotsOnly: true, lab: "shift" }, ...(v >= 1 ? [{ pts: xs.map((x) => [x, B.ja + B.jb * x]), col: CL, w: 1.5 }] : [])], legend: [["design", "var(--axis)"], ["measured", CL]] });
    if (v >= 1) s += big(cx, 290, `shift for ${g.jt * 1000} µm: ${f(B.sNeed, 2)} mm`, B.sNeed >= 0.3 && B.sNeed <= P.sRange ? "var(--good-text)" : "var(--critical)") + txt(cx, 310, `slope ${f(-B.jb, 2)} µm/mm (design Δp/pₓ = ${f(g.dp / g.px * 1000, 2)})`); }
  else if (i === 2) { const pat = (x, y, dx, lab) => `<rect x="${x}" y="${y}" width="140" height="90" rx="8" fill="#e8c9a6" stroke="#6b3d14"/><ellipse cx="${x + 70 + dx * 140}" cy="${y + 45 + B.dy * 90}" rx="${B.cSize * 60}" ry="${B.cSize * 34}" fill="#2f6fb0" opacity="${0.15 + 0.6 * v}"/>${txt(x, y + 106, lab)}${txt(x, y + 120, `${f(dx * 100, 0)} % off centre`, Math.abs(dx) > 0.25 ? "fill:var(--critical)" : "")}`;
    s += txt(cx, 50, "Pattern on a wheel tooth (face width →)", "font-weight:600") + pat(cx, 64, B.dxL, "L flank (one direction)") + pat(cx + 160, 64, B.dxR, "R flank (other direction)");
    s += txt(cx, 220, `size ${f(B.cSize * 100, 0)} % of the flank (≥ 60 % good)`) + txt(cx, 238, "off-centre = lead error · towards tip/root = profile error"); }
  else { const n = Math.max(2, Math.round(v * 121));
    s += chart({ x: cx, y: 30, w: cw, h: 150, t: "Temperature rise (K)", xr: [0, 120], yr: [0, 20], xl: "minutes", hl: [{ y: 15, t: "limit 15 K", col: "var(--critical)" }], series: [{ pts: B.trT.slice(0, n), col: "var(--critical)" }] });
    s += chart({ x: cx, y: 186, w: cw, h: 150, t: "Efficiency η (%)", xr: [0, 120], yr: [50, 90], xl: "minutes", series: [{ pts: B.trEta.slice(0, n), col: CL }] });
    s += txt(cx, 356, `friction falls while the flanks run in · noise ${f(B.dB, 0)} dB(A)`); }
  return s + `</svg>`;
}
function sceneFin(g, R, u) {
  const k = 1.3, cy = 220, xs = 20 + u * (SW - 40 - g.L * k);
  let s = svgOpen("Op 120 · Demagnetise, mark, protect, close the part record", "finishing");
  const st = [["demagnetise", 120], ["laser mark", 290], ["rust oil", 440], ["VCI bag + box", 600]];
  st.forEach(([t, x]) => { s += `<rect x="${x - 40}" y="${cy - 80}" width="80" height="30" rx="4" fill="var(--surface-2)" stroke="var(--axis)"/>${txt(x - 34, cy - 60, t)}`; });
  s += `<rect x="20" y="${cy + 48}" width="720" height="8" fill="var(--axis)"/>`;
  s += `<path d="${shaftPath(rStage(g, "final", { q: 1 }), xs, cy, k, g.L)}" fill="${HARD}" stroke="#333"/>` + helix(g, xs, cy, k, 0, g.da / 2 - 1);
  if (u > 0.35) s += `<text x="${xs + g.segs[1].x0 * k}" y="${cy + 4}" class="apc-t" style="font-family:monospace;font-size:9px;fill:#fff">W-${String(R.sn).padStart(4, "0")}</text>`;
  s += `<rect x="440" y="290" width="300" height="80" rx="6" fill="var(--surface)" stroke="var(--border)"/>${txt(450, 308, "Part record (birth certificate)", "font-weight:600")}`;
  s += txt(450, 326, `worm W-${String(R.sn).padStart(4, "0")} · heat ${R.O.saw.heat} · pair P-${String(R.sn).padStart(4, "0")}`) + txt(450, 344, `${R.fails.length ? R.fails.length + " failed check(s) → REJECT" : R.warns.length ? `released with ${R.warns.length} warning(s)` : "all checks passed → released"}`, R.fails.length ? "fill:var(--critical);font-weight:600" : "fill:var(--good-text);font-weight:600");
  s += txt(450, 362, `residual magnetism ${f(R.O.fin.mag, 2)} mT`);
  return s + `</svg>`;
}
const defs = () => `<defs><marker id="wmA" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" fill="var(--text-2)"/></marker></defs>`;
/* which sub-step text belongs to the animation phase */
const STEPAT = {
  ht: (u, R) => { if (u >= 0.8) return 4; const cyc = htCycle(R.O.ht.tc), tu = u / 0.8 * cyc[cyc.length - 1][0]; if (tu < 0.15) return 0; if (tu <= cyc[2][0]) return 1; if (tu <= cyc[5][0]) return 2; return 3; },
  tg: (u, R) => { const ps = R.O.tg.passes, n = ps.length, pi = Math.min(n - 1, Math.floor(u * n)), p = ps[pi]; if (pi === 0 && (u * n) % 1 < 0.3) return 0; if (p.kind !== "rough") return 4; return p.fl === "L" ? (p.dress && (u * n) % 1 < 0.25 ? 1 : 2) : 3; },
  gmm: (u) => (u < 0.03 ? 0 : u < 0.44 ? 1 : u < 0.62 ? 2 : u < 0.78 ? 3 : u < 0.98 ? 4 : 5),
  bench: (u) => (u < 0.03 ? 0 : u < 0.3 ? 1 : u < 0.55 ? 2 : u < 0.72 ? 3 : 4),
};
const SCENES = { saw: sceneSaw, face: sceneFace, turn: sceneTurn, thread: sceneThread, ht: sceneHT, prep: scenePrep, cyl: sceneCyl, tg: sceneTG, etch: sceneEtch, gmm: sceneGMM, bench: sceneBench, fin: sceneFin };

/* ------------------------------------------------------------------ UI */
const box = $("hrItem2");
if (box) {
  box.innerHTML = `
    <div class="kpis" id="wmKpis"></div>
    <div class="card">
      <div class="card-head"><h2>Process twin – one worm from saw to test bench</h2><span class="sub">click an operation · faults change the simulated measured values</span></div>
      <div class="wm-route" id="wmRoute" role="group" aria-label="Operations"></div>
      <div class="apc3d-bar"><button class="btn primary" id="wmPlay">▶ Play all</button><button class="btn ghost" id="wmPrev">◀</button><button class="btn ghost" id="wmNext">▶|</button>
        <input type="range" id="wmU" min="0" max="1000" value="0" aria-label="Progress in this operation" style="max-width:220px">
        <span class="tb-label">speed</span><div class="seg" id="wmSpd"><button class="seg-btn" data-wmspd="0.5">½×</button><button class="seg-btn active" data-wmspd="1">1×</button><button class="seg-btn" data-wmspd="2">2×</button></div>
        <button class="btn ghost" id="wmNew">New worm (random)</button><button class="btn ghost" id="wmExport">Download part record</button></div>
      <div class="dk-step" id="wmStep"></div>
      <div class="hr-grid"><div id="wmScene"></div><div class="apc3d-info" id="wmInfo"></div></div>
      <div class="apc3d-bar" style="margin-top:8px"><button class="btn ghost" id="wm3dBtn">Show 3D view</button><span class="small muted">3D follows the same operation + progress · drag = turn, wheel = zoom, right drag = move</span></div>
      <div class="mf3d" id="wm3d" hidden></div>
      <div class="wm-faults-wrap"><span class="tb-label">Inject a process fault (see where it starts and which check finds it):</span><div class="wm-faults" id="wmFaults"></div></div>
    </div>
    <div class="card" id="wmRepCard"><div class="card-head"><h2>Inspection report – gear measuring machine (Op 100)</h2><span class="sub" id="wmRepSub"></span></div><div class="wm-charts" id="wmRep"></div></div>
    <div class="card" id="wmBenchCard"><div class="card-head"><h2>Test bench report (Op 110)</h2><span class="sub" id="wmBenchSub"></span></div><div class="wm-charts" id="wmBench"></div></div>
    <div class="grid2 eq" style="margin-top:0">
      <div class="card"><div class="card-head"><h2>Part record – route, time, cost</h2><span class="sub">per worm · set-up shared over the lot</span></div><div class="table-wrap"><table class="apc-bom" id="wmRouteT"></table></div></div>
      <div class="card"><div class="card-head"><h2>Lot simulation</h2><button class="btn ghost" id="wmLotRun">Run 50 worms</button></div><p class="small">Same process + the faults that are switched on, random variation of every value. Cpk ≥ 1.33 = capable process.</p><div class="table-wrap"><table class="apc-bom" id="wmLot"></table></div></div>
    </div>
    <div class="card"><div class="card-head"><h2>Equipment list – machines, tooling, workholding, gauges, consumables</h2><span class="sub">required capability = purchase specification (example values) · ask 2–3 suppliers per line</span></div><div class="table-wrap"><table class="apc-bom wm-eq" id="wmEquip"></table></div></div>
    <div class="apc-main">
      <div class="card apc-incard"><div class="card-head"><h2>Process inputs</h2><button class="btn ghost" id="wmReset">Example values</button></div>
        <p class="small" id="wmGeo"></p>
        <div class="seg" role="group" aria-label="Thread roughing method" id="wmThr" style="margin-bottom:8px"></div><div id="wmInputs"></div></div>
      <div class="apc-right"><div class="card"><div class="card-head"><h2>Calculations</h2><span class="sub">formulas with your numbers</span></div><div id="wmCalc" class="apc-calc"></div></div></div>
    </div>
    <div class="card"><div class="card-head"><h2>Guide – faults, causes, checks</h2></div><div id="wmGuide" class="mx-guide"></div></div>`;

  let P = { ...DEF };
  try { Object.assign(P, JSON.parse(localStorage.getItem("hmcWormMfg") || "{}")); } catch (er) { /* private window */ }
  let F = {}, serial = 1, op = 0, u = 0, playing = false, speed = 1, last = performance.now(), started = false, hold = 0, g = geom(wormData()), R = null, lot = null, lastDraw = 0;
  const pane = $("tab-hmc"), cls = { ok: "apc-ok", warn: "apc-warn", bad: "apc-bad", info: "wm-info" }, ico = { ok: "✓", warn: "!", bad: "✕", info: "i" };
  const blk = (t, rows, note) => `<div class="apc-blk"><h3>${t}</h3><div class="gc-formula">${rows.join("\n")}</div>${note ? `<p class="hint">${note}</p>` : ""}</div>`;
  const opStatus = (k) => { const r = R.O[k].res; return r.some((x) => x[2] === "bad") ? "bad" : r.some((x) => x[2] === "warn") ? "warn" : "ok"; };

  function compute() { g = geom(wormData()); R = simulate(g, P, F, 1000 + serial); R.P = P; }
  function inputs() {
    $("wmInputs").innerHTML = GROUPS.map(([gn, fs]) => `<fieldset class="apc-fs"><legend>${esc(gn)}</legend>${fs.map(([k, l, un, d, n]) =>
      `<label class="apc-f" title="${esc(n || "")}"><span>${esc(l)}${n ? ` <i class="muted">${esc(n)}</i>` : ""}</span>
        <span class="apc-in"><input type="number" step="any" data-k="${k}" value="${P[k]}" aria-label="${esc(l)}"${P[k] !== d ? ' class="chg"' : ""}><em>${esc(un)}</em></span></label>`).join("")}</fieldset>`).join("");
    $("wmThr").innerHTML = Object.entries(THR).map(([k, t]) => `<button class="seg-btn${P.thr === k ? " active" : ""}" data-wmthr="${k}">${esc(t.n)}</button>`).join("");
    $("wmFaults").innerHTML = FAULTS.map(([k, l, w]) => `<button class="chip${F[k] ? " on" : ""}" data-wmf="${k}" title="${esc(w)}">${F[k] ? "⚠ " : ""}${esc(l)}</button>`).join("");
  }
  function kpis() {
    const st = R.fails.length ? `REJECT at Op ${R.fails[0].no}` : R.warns.length ? "released, warnings" : "released";
    $("wmKpis").innerHTML = [["Worm", `W-${String(R.sn).padStart(4, "0")}`, `heat ${R.O.saw.heat} · seed ${R.seed}`], ["Status", st, R.fails.length ? "failed: " + R.fails.map((x) => `Op ${x.no}`).filter((v, i, a) => a.indexOf(v) === i).join(", ") : R.warns.length ? `${R.warns.length} warning(s): ` + R.warns.map((x) => `Op ${x.no}`).filter((v, i, a) => a.indexOf(v) === i).join(", ") : "all checks passed"],
      ["Time per worm", f(R.tSum / 60, 1) + " h", `machine time, without set-up`], ["Cost per worm", "$" + f(R.cSum, 0), `material $${f(R.matCost, 1)} · lot ${P.lot}`],
      ["Lot lead time", f(R.days, 1) + " days", "2 shifts, incl. furnace + queues"], ["Lead error (max)", f(Math.max(Math.abs(R.O.gmm.LL.fH), Math.abs(R.O.gmm.LR.fH)), 1) + " µm", `fHβ L ${f(R.O.gmm.LL.fH, 1)} / R ${f(R.O.gmm.LR.fH, 1)} · Fr ${f(R.O.gmm.Fr, 1)} µm · f'i ${f(R.O.bench.fi, 2)}″`]]
      .map(([l, v, n]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="note">${esc(n)}</div></div>`).join("");
  }
  function route() {
    $("wmRoute").innerHTML = OPS.map((o, i) => { const done = i < op || (i === op && u >= 1), st = done ? opStatus(o.k) : ""; return `<button class="wm-op${i === op ? " on" : ""}${done ? " done" : ""}${st === "bad" || st === "warn" ? " " + st : ""}" data-wmop="${i}">${o.no} ${esc(o.n)}</button>`; }).join("");
    const rows = OPS.map((o) => { const x = R.O[o.k]; return `<tr><td>${o.no}</td><td>${esc(o.n)}<br><span class="muted">${esc(o.k === "thread" ? THR[P.thr].mc : o.mc)}</span></td><td>${f(x.setup, 0)}</td><td>${f(x.t, 1)}</td><td>$${f(x.cost, 1)}</td><td class="wm-st-${opStatus(o.k)}">${ico[opStatus(o.k)]}</td></tr>`; }).join("");
    $("wmRouteT").innerHTML = `<thead><tr><th>Op</th><th>Operation / machine</th><th>Set-up min</th><th>min / worm</th><th>Cost / worm</th><th>Result</th></tr></thead><tbody>${rows}
      <tr><td></td><td>Bar material ${f(g.mB, 2)} kg</td><td></td><td></td><td>$${f(R.matCost, 1)}</td><td></td></tr><tr><td></td><td><b>Total</b></td><td></td><td><b>${f(R.tSum, 0)}</b></td><td><b>$${f(R.cSum, 0)}</b></td><td></td></tr></tbody>`;
  }
  function info() {
    const o = OPS[op], x = R.O[o.k], steps = o.steps(g, P), done = u >= 0.92;
    const si = Math.min(steps.length - 1, STEPAT[o.k] ? STEPAT[o.k](u, R) : Math.floor(u * steps.length));
    $("wmStep").innerHTML = `<span class="dk-n">Op ${o.no}</span> <b>${esc(steps[si])}</b>`;
    $("wmInfo").innerHTML = `<div class="apc-pi-h"><b>Op ${o.no} · ${esc(o.n)}</b></div><p class="muted">${esc(o.k === "thread" ? THR[P.thr].mc : o.mc)}</p>
      <ol class="wm-steps">${steps.map((t, i) => `<li class="${i === si ? "on" : i < si ? "done" : ""}">${esc(t)}</li>`).join("")}</ol>
      ${eqHtml(o.k)}
      <h4>Settings</h4><table class="wm-kv">${x.par.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</table>
      <h4>Checks in this operation</h4>${done ? x.res.map(([l, v, st]) => `<div class="apc-chk ${cls[st]}"><b>${ico[st]}</b><span>${esc(l)}</span><span class="muted">${esc(v)}</span></div>`).join("") : `<p class="muted">… measured at the end of the operation</p>`}
      <p class="small muted">time ${f(x.t, 1)} min/worm · set-up ${f(x.setup, 0)} min · $${f(x.cost, 1)}</p>`;
  }
  function scene() { $("wmScene").innerHTML = SCENES[OPS[op].k](g, R, u, P, F); }
  function reports() {
    const G = R.O.gmm, B = R.O.bench, reached = op > 9 || (op === 9 && u >= 1), reachedB = op > 10 || (op === 10 && u >= 1);
    const card = (w, h, inner) => `<svg viewBox="0 0 ${w} ${h}" class="apc-svg">${inner}</svg>`;
    $("wmRepSub").textContent = reached ? `worm W-${String(R.sn).padStart(4, "0")} · ${G.res.filter((r) => r[2] === "bad").length} out of tolerance` : "reached at Op 100 – press Play or click Op 100";
    $("wmBenchSub").textContent = reachedB ? `worm W-${String(R.sn).padStart(4, "0")} with the master wheel` : "reached at Op 110";
    if (!reached) $("wmRep").innerHTML = `<p class="muted">The worm has not been measured yet.</p>`;
    else $("wmRep").innerHTML = [
      card(360, 210, chart({ x: 0, y: 0, w: 360, h: 210, t: "Lead deviation (µm)", note: `fHβ L ${f(G.LL.fH, 1)} · R ${f(G.LR.fH, 1)}`, xr: [0, g.Lb], yr: [-10, 10], xl: "axial mm", hl: [{ y: P.tHb }, { y: -P.tHb }], series: [{ pts: G.trLL, col: CL }, { pts: G.trLR, col: CR }], legend: [["L flank", CL], ["R flank", CR]] })),
      card(360, 210, chart({ x: 0, y: 0, w: 360, h: 210, t: "Profile deviation (µm)", note: `Fα L ${f(G.FaL, 1)} · R ${f(G.FaR, 1)} (≤ ${P.tFa})`, xr: [0, G.trPL[30][0]], yr: [-12, 6], xl: "root → tip mm", series: [{ pts: G.trPL, col: CL }, { pts: G.trPR, col: CR }], legend: [["L flank", CL], ["R flank", CR]] })),
      card(360, 210, chart({ x: 0, y: 0, w: 360, h: 210, t: "Runout in the gaps (µm)", note: `Fr ${f(G.Fr, 1)} (≤ ${P.tFr})`, xr: [0, 330], xt: [0, 90, 180, 270], yr: [-8, 8], xl: "angle °", series: [{ pts: G.trRun, col: CL, dots: true, lab: "angle" }] })),
      card(360, 210, chart({ x: 0, y: 0, w: 360, h: 210, t: "Single pitch fpx (µm)", note: `max ${f(G.fpx, 1)} (±${P.tfp})`, xr: [0.5, g.nP + 0.5], xt: G.trPitch.map((p) => p[0]), yr: [-5, 5], xl: "pitch no.", hl: [{ y: P.tfp }, { y: -P.tfp }], series: [{ pts: G.trPitch, col: CL, bars: true, lab: "pitch" }] })),
      card(360, 210, chart({ x: 0, y: 0, w: 360, h: 210, t: "Over-wire size M (mm)", note: `slope ${f(G.mSlope * 1000, 1)} µm/mm`, xr: [-2 * g.px, 2 * g.px], yr: [g.M0 - 1.2, g.M0 + 1.2], xl: "from the middle mm",
        series: [{ pts: [[-2 * g.px, g.M0 - 2 * g.px * g.dMdx], [2 * g.px, g.M0 + 2 * g.px * g.dMdx]], col: "var(--axis)", dash: "4 3", w: 1.5 }, { pts: G.trM, col: CL, dots: true, dotsOnly: true, lab: "x" }], legend: [["design", "var(--axis)"], ["measured", CL]] })),
      `<div class="apc-checks">${G.res.map(([l, v, st]) => `<div class="apc-chk ${cls[st]}"><b>${ico[st]}</b><span>${esc(l)}</span><span class="muted">${esc(v)}</span></div>`).join("")}</div>`].join("");
    if (!reachedB) $("wmBench").innerHTML = `<p class="muted">The worm has not been on the test bench yet.</p>`;
    else $("wmBench").innerHTML = [
      card(360, 210, chart({ x: 0, y: 0, w: 360, h: 210, t: "Transmission error, 1 wheel turn (″)", note: `F'i ${f(B.Fi, 2)}″`, xr: [0, 360], xt: [0, 90, 180, 270, 360], yr: [-4, 4], xl: "wheel °", series: [{ pts: B.trTE, col: CL, w: 1 }] })),
      card(360, 210, chart({ x: 0, y: 0, w: 360, h: 210, t: "Zoom: 5 worm turns (″)", note: `f'i ${f(B.fi, 2)}″ (≤ ${P.tTE})`, xr: [0, 5], yr: [-4, 4], xl: "worm turns", series: [{ pts: B.trTEz, col: CL, w: 1.5 }] })),
      card(360, 210, chart({ x: 0, y: 0, w: 360, h: 210, t: "Backlash vs axial shift (µm)", note: `shift needed ${f(B.sNeed, 2)} mm`, xr: [0, Math.max(5, P.sRange)], yr: [-40, 70], xl: "shift mm", band: [[5, 10]], hl: [{ y: 0, t: "< 0 = jammed", col: "var(--critical)" }],
        series: [{ pts: [[0, g.j0 * 1000], [P.sRange, g.j0 * 1000 - P.sRange * g.dp / g.px * 1000]], col: "var(--axis)", dash: "4 3", w: 1.5 }, { pts: [[0, B.ja], [P.sRange, B.ja + B.jb * P.sRange]], col: CL, w: 1.5 }, { pts: B.trJ, col: CL, dots: true, dotsOnly: true, lab: "shift" }], legend: [["design", "var(--axis)"], ["measured", CL]] })),
      card(360, 210, chart({ x: 0, y: 0, w: 360, h: 210, t: "Run-in temperature rise (K)", note: `${f(B.dTmax, 1)} K after 2 h`, xr: [0, 120], yr: [0, 20], xl: "minutes", hl: [{ y: 15, t: "limit", col: "var(--critical)" }], series: [{ pts: B.trT, col: "var(--critical)" }] })),
      card(360, 210, chart({ x: 0, y: 0, w: 360, h: 210, t: "Efficiency during run-in (%)", note: `${f(B.etaEnd, 0)} % at the end`, xr: [0, 120], yr: [50, 90], xl: "minutes", series: [{ pts: B.trEta, col: CL }] })),
      `<div class="apc-checks">${B.res.map(([l, v, st]) => `<div class="apc-chk ${cls[st]}"><b>${ico[st]}</b><span>${esc(l)}</span><span class="muted">${esc(v)}</span></div>`).join("")}</div>`].join("");
  }
  function runLot() {
    const N = 50, recs = Array.from({ length: N }, (_, i) => simulate(g, P, F, 5000 + i));
    const C = [["Soft over-wire M dev. (µm)", (r) => (r.O.thread.Msoft - r.O.thread.Mtgt) * 1000, -80, 80], ["Seat A Ø25 k5 (µm)", (r) => r.O.cyl.grd[1].dev * 1000, 2, 11], ["Seat runout (µm)", (r) => r.O.cyl.runS, null, P.tRun], ["Case depth CHD (mm)", (r) => r.O.ht.CHD, R.O.prep.chdNeed, R.O.prep.chdNeed + 0.35],
      ["Lead fHβ L flank (µm)", (r) => r.O.gmm.LL.fH, -P.tHb, P.tHb], ["Lead fHβ R flank (µm)", (r) => r.O.gmm.LR.fH, -P.tHb, P.tHb], ["Profile Fα L (µm)", (r) => r.O.gmm.FaL, null, P.tFa],
      ["Runout Fr (µm)", (r) => r.O.gmm.Fr, null, P.tFr], ["Over-wire M dev. (µm)", (r) => r.O.gmm.Moff * 1000, -P.tM, P.tM], ["f'i bench (″)", (r) => r.O.bench.fi, null, P.tTE], ["Temperature rise (K)", (r) => r.O.bench.dTmax, null, 15]];
    const rows = C.map(([n, fn, lo, hi]) => { const v = recs.map(fn), m = v.reduce((a, b) => a + b, 0) / N, sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (N - 1)) || 1e-9;
      const cpk = Math.min(hi != null ? (hi - m) / (3 * sd) : Infinity, lo != null ? (m - lo) / (3 * sd) : Infinity), out = v.filter((x) => (hi != null && x > hi) || (lo != null && x < lo)).length;
      const a = lo != null ? lo : Math.min(0, ...v), b = hi, span = (b - a) || 1, W = 120, dots = v.map((x) => `<circle cx="${(4 + clamp((x - a) / span, -0.05, 1.05) * (W - 8)).toFixed(1)}" cy="${7 + ((x * 997) % 1 + 1) % 1 * 6}" r="1.8" fill="${(hi != null && x > hi) || (lo != null && x < lo) ? "var(--critical)" : "var(--accent)"}"/>`).join("");
      return [n, m, sd, cpk, out, `<svg viewBox="0 0 ${W} 20" width="${W}" height="20" aria-hidden="true"><rect x="4" y="3" width="${W - 8}" height="14" fill="var(--good)" opacity=".12"/>${dots}</svg>`, lo, hi]; });
    const good = recs.filter((r) => !r.fails.length).length;
    lot = `<thead><tr><th>Characteristic</th><th>Limits</th><th>Mean</th><th>σ</th><th>Cpk</th><th>Out</th><th>50 worms</th></tr></thead><tbody>${rows.map(([n, m, sd, cpk, out, sv, lo, hi]) =>
      `<tr><td>${esc(n)}</td><td>${lo != null ? f(lo, 2) : "–"} … ${f(hi, 2)}</td><td>${f(m, 2)}</td><td>${f(sd, 2)}</td><td class="wm-st-${sd < 1e-6 || cpk >= 1.33 ? "ok" : cpk >= 1 ? "warn" : "bad"}">${!Number.isFinite(cpk) ? "–" : sd < 1e-6 ? "no spread" : cpk > 99 ? "> 99" : f(cpk, 2)}</td><td>${out}</td><td>${sv}</td></tr>`).join("")}
      <tr><td colspan="7"><b>Yield: ${good} / ${N} worms pass every check (${f(good / N * 100, 0)} %)</b></td></tr></tbody>`;
    $("wmLot").innerHTML = lot;
  }
  function formulas() {
    const T = R.O.tg, B = R.O.bench, H = R.O.ht;
    $("wmGeo").innerHTML = `<b>Worm from item 1:</b> m ${g.m} · z₁ ${g.z1} · d₁ ${g.d1} mm · wheel z₂ ${g.z2} · Δp ${g.dp} mm (change these in item 1)`;
    $("wmCalc").innerHTML = [
      blk("1 · Worm geometry", [`pₓ = π·m = ${f(g.px, 3)} mm,  lead p_z = z₁·pₓ = ${f(g.lead, 3)} mm`, `γ = atan(p_z / (π·d₁)) = ${f(g.gam / RAD, 2)}°`, `tip d_a = d₁ + 2m = ${f(g.da, 1)},  root d_f = d₁ − 2.4m = ${f(g.df, 1)},  depth 2.2m = ${f(g.h, 1)} mm`,
        `thread length b₁ ≈ (11 + 0.06·z₂)·m + 2·5 + pₓ → <b>${g.b1} mm</b>,  shaft ${g.L} mm`]),
      blk("2 · Duplex leads", [`L flank p_L = pₓ − Δp/2 = ${f(g.pL, 3)} mm,  R flank p_R = pₓ + Δp/2 = ${f(g.pR, 3)} mm`, `flank shift at the thread ends = Δp/2 · (b₁/2)/pₓ = <b>±${f(R.O.thread.endShift, 2)} mm</b>`], "Bigger than the grinding stock – so already the roughing must follow the two leads."),
      blk("3 · Blank + turning", [`blank Ø${g.Db} × ${g.Lsaw} mm = ${f(g.mB, 2)} kg (finished ${f(g.mF, 2)} kg)`, `chips V = Σ π/4·(D² − d²)·L = ${f(R.O.turn.Vr, 0)} cm³`, `Q = vc·f·ap = ${P.vcT}·${P.fT}·${P.apT} = ${f(R.O.turn.Q, 0)} cm³/min → t ≈ V/Q·1.6 + 1.5 = ${f(R.O.turn.t, 1)} min`]),
      blk("4 · Case depth", [`total carbon depth ≈ 0.635·√t = 0.635·√${f(H.tc, 1)} = ${f(0.635 * Math.sqrt(H.tc), 2)} mm (925 °C)`, `CHD (550 HV) ≈ 0.7 · total = <b>${f(H.CHD, 2)} mm</b>`, `needed before grinding = finished ${P.chdMin} + stock ${P.s0} + 0.05 = ${f(R.O.prep.chdNeed, 2)} mm`], "The grinding removes the stock from the hard case – order the case depth WITH the stock."),
      blk("5 · Thread grinding", [`passes per flank = ⌈(s₀ − 2·ae_f)/ae_r⌉ + 2 + 1 = ${T.passes.length / 2}`, `time per pass = (b₁ + 2pₓ)/(p_z·n) = ${f(T.tPass, 2)} min → ${f(T.t, 1)} min`, `vw = π·d₁·n/60 = ${f(T.vw, 0)} mm/s,  Q'w = ae·vw = <b>${f(T.Qw, 2)}</b> of ${f(T.qlimE, 1)} mm³/(mm·s)`,
        `stock needed to clean up = (runout/2)·sin20° + ε·(b₁/2)·cos20° + pitch error + 0.01 = ${f(T.need, 3)} mm`, `lead error from warm worm = −α·ΔT·L = −11.5e-6 · ${f(T.dT, 1)} · ${f(g.Lb, 0)} = <b>${f(T.thermErr, 1)} µm</b>`], "1 K warmer worm while grinding = 1 µm shorter lead over 90 mm. That is why the coolant is chilled."),
      blk("6 · Over-wire measurement", [`best wire dw = pₓ / (2·cos 20°) = ${f(g.dw, 3)} mm`, `M₀ ≈ d₁ − pₓ/(2·tan20°) + dw·(1 + 1/sin20°) = <b>${f(g.M0, 3)} mm</b> (axial-section approximation)`, `soft (with stock): M = M₀ + 2·s₀/sin20° = ${f(g.M0 + 2 * P.s0 / Math.sin(AL), 3)} mm`, `duplex: dM/dx = Δp / (pₓ·tan20°) = ${f(g.dMdx * 1000, 1)} µm per mm`]),
      blk("7 · Test bench", [`backlash change = Δp/pₓ = ${f(g.dp / g.px * 1000, 2)} µm per mm shift → shift ${f(B.sNeed, 2)} mm`, `TE from runout ≈ (Fr/2)·tan20° / (d₂/2) = ${f(B.A1, 2)}″ amplitude`, `run-in: P_loss = P_out·(1/η − 1),  ΔT_end ≈ P_loss / (h·A) → ${f(B.dTmax, 1)} K (time constant ${f(750 / 60, 1)} min)`]),
    ].join("");
  }
  function guide() {
    $("wmGuide").innerHTML = `
      <h3>How the twin works</h3><ul><li>Every worm has a <b>part record</b>: the route of 12 operations, the settings and every measured value. In a real factory the machines write it (MES); here the values are <b>simulated</b> with random variation, so every "New worm" is a bit different.</li>
        <li>Switch on a <b>fault</b> and play the route: you see in which operation the cause happens and in which operation a check finds it. A fault found late is expensive – all the work in between is lost.</li>
        <li>The <b>lot simulation</b> makes 50 worms and gives Cpk: a capable process has Cpk ≥ 1.33 for every characteristic.</li></ul>
      <h3>Faults – cause → where found → prevention</h3><table class="apc-bom"><thead><tr><th>Fault</th><th>Cause</th><th>Found by</th><th>Prevention</th></tr></thead><tbody>
        <tr><td>Black (unground) spots</td><td>stock too small, or big hardening distortion</td><td>wire check Op 40, visual / etch Op 80–90</td><td>stock 0.2–0.3 mm, check M_soft, straighten, hang in the furnace</td></tr>
        <tr><td>Case too thin</td><td>short carburising, wrong carbon potential</td><td>coupon in every charge, Op 60</td><td>furnace record, coupon, CHD ordered incl. stock</td></tr>
        <tr><td>High runout</td><td>centre holes not re-ground, dirt on centres</td><td>Op 70 seat runout, Op 100 Fr, bench f'i</td><td>grind centre holes after hardening, clean + oil centres</td></tr>
        <tr><td>Grinding burn</td><td>too big infeed, dull wheel, coolant missing</td><td>nital etch Op 90 (100 %)</td><td>Q'w limit from trials, power monitor, coolant nozzle check</td></tr>
        <tr><td>Lead error</td><td>worm warms up while grinding, machine lead error</td><td>lead scan Op 100</td><td>chilled coolant ±0.5 K, warm-up cycle, lead compensation</td></tr>
        <tr><td>Profile error / roll-off</td><td>wheel dressed too rarely</td><td>profile scan Op 100, bench f'i, contact pattern</td><td>dress every 4–8 passes, check the dresser</td></tr>
        <tr><td>Wrong duplex lead</td><td>program / parameter error</td><td>lead L/R + M slope Op 100, backlash slope Op 110</td><td>first-article inspection, program release by quality</td></tr></tbody></table>
      <h3>Workshop rules</h3><ul><li><b>Same centres from Op 30 to Op 100.</b> The centre holes are the reference – re-grind them after hardening.</li>
        <li><b>Measure the soft worm over wires (Op 40)</b> – a stock error found here costs 5 minutes, found after hardening it costs the worm.</li>
        <li><b>Coupon in every furnace charge</b> – you cannot cut the real worm to check the case depth.</li>
        <li><b>100 % nital etch</b> after thread grinding – burn is invisible.</li>
        <li><b>Worm + wheel = matched pair:</b> the wheel is hobbed with a duplex hob that has the SAME leads and profile as this worm (item 1). After the bench test the worm and its wheel get the same pair number.</li>
        <li><b>Make or buy:</b> the worm grinding machine + gear measuring machine are the expensive part. For a few tables per year, compare the cost per worm above with quotes from worm gear makers for a matched duplex set.</li></ul>`;
  }
  function eqOf(k) { return EQUIP[k](g, P, R); }
  function eqHtml(k) { const e = eqOf(k); return `<h4>Equipment</h4><table class="wm-kv">${[["Machine", e.mc], ["Tooling", e.tool], ["Workholding", e.fix], ["Gauges", e.gauge], ["Consumables", e.cons]].map(([a, b]) => `<tr><td>${a}</td><td>${esc(b)}</td></tr>`).join("")}</table>`; }
  function equipTable() {
    $("wmEquip").innerHTML = `<thead><tr><th>Op</th><th>Machine (required capability)</th><th>Tooling</th><th>Workholding</th><th>Gauges / test equipment</th><th>Consumables</th></tr></thead><tbody>${OPS.map((o) => { const e = eqOf(o.k);
      return `<tr><td><b>${o.no}</b><br>${esc(o.n)}</td><td>${esc(e.mc)}</td><td>${esc(e.tool)}</td><td>${esc(e.fix)}</td><td>${esc(e.gauge)}</td><td>${esc(e.cons)}</td></tr>`; }).join("")}</tbody>`;
  }
  function renderAll() { compute(); kpis(); route(); scene(); info(); reports(); formulas(); runLot(); equipTable(); }
  function frame() { scene(); info(); route(); $("wmU").value = Math.round(u * 1000); $("wmPlay").textContent = playing ? "❚❚ Pause" : "▶ Play all"; }
  function go(n, keepU) { const prevDone = op; op = clamp(n, 0, OPS.length - 1); u = keepU ? u : 0; hold = 0; frame(); if (op >= 9 || prevDone >= 9) reports(); }
  function startLoop() {
    if (started) return; started = true;
    const loop = (now) => { requestAnimationFrame(loop); const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (!pane || !pane.classList.contains("active") || box.hidden || !playing) return;
      if (u < 1) { u = Math.min(1, u + dt * speed / 7); if (now - lastDraw > 33 || u >= 1) { lastDraw = now; frame(); if (u >= 1 && op >= 9) { reports(); kpis(); } } }
      else { hold += dt; if (hold > 1.4) { hold = 0; if (op < OPS.length - 1) go(op + 1); else { playing = false; frame(); } } } };
    requestAnimationFrame(loop);
  }
  inputs(); renderAll(); frame();
  $("wmInputs").addEventListener("change", (ev) => {
    const k = ev.target.dataset.k; if (!k) return;
    const v = parseFloat(ev.target.value); if (!Number.isFinite(v) || v <= 0) { ev.target.value = P[k]; return; }
    P[k] = v; ev.target.classList.toggle("chg", v !== DEF[k]);
    try { localStorage.setItem("hmcWormMfg", JSON.stringify(P)); } catch (er) { /* ignore */ }
    renderAll(); frame();
  });
  $("wmThr").addEventListener("click", (ev) => { const b = ev.target.closest("[data-wmthr]"); if (!b) return; P.thr = b.dataset.wmthr; try { localStorage.setItem("hmcWormMfg", JSON.stringify(P)); } catch (er) { /* ignore */ } inputs(); renderAll(); frame(); });
  $("wmFaults").addEventListener("click", (ev) => { const b = ev.target.closest("[data-wmf]"); if (!b) return; F[b.dataset.wmf] = !F[b.dataset.wmf]; inputs(); renderAll(); frame(); });
  $("wmReset").addEventListener("click", () => { if (!confirm("Back to the example values?")) return; P = { ...DEF }; try { localStorage.removeItem("hmcWormMfg"); } catch (er) { /* ignore */ } inputs(); renderAll(); frame(); });
  $("wmPlay").addEventListener("click", () => { playing = !playing; if (playing && op === OPS.length - 1 && u >= 1) go(0); last = performance.now(); frame(); });
  $("wmPrev").addEventListener("click", () => { playing = false; go(op - 1); });
  $("wmNext").addEventListener("click", () => { playing = false; go(op + 1); });
  $("wmU").addEventListener("input", (ev) => { playing = false; u = ev.target.value / 1000; frame(); if (op >= 9) { reports(); } });
  $("wmRoute").addEventListener("click", (ev) => { const b = ev.target.closest("[data-wmop]"); if (b) { playing = false; go(+b.dataset.wmop); } });
  $("wmSpd").addEventListener("click", (ev) => { const b = ev.target.closest("[data-wmspd]"); if (!b) return; speed = +b.dataset.wmspd; $("wmSpd").querySelectorAll(".seg-btn").forEach((x) => x.classList.toggle("active", x === b)); });
  $("wmNew").addEventListener("click", () => { serial++; renderAll(); frame(); });
  $("wm3dBtn").addEventListener("click", () => { const el = $("wm3d"); el.hidden = !el.hidden; $("wm3dBtn").textContent = el.hidden ? "Show 3D view" : "Hide 3D view"; if (!el.hidden && !el.dataset.on) { el.dataset.on = "1"; import("./mfg3d.js").then((m) => m.create(el, () => window.wormMfg.state(), "worm")); } });
  if (new URLSearchParams(location.search).has("show3d")) setTimeout(() => $("wm3dBtn").click(), 400);
  $("wmLotRun").addEventListener("click", () => runLot());
  $("wmExport").addEventListener("click", () => {
    const rec = { worm: `W-${String(R.sn).padStart(4, "0")}`, heat: R.O.saw.heat, geometry: { m: g.m, z1: g.z1, d1: g.d1, dp: g.dp, b1: g.b1, L: g.L }, faults: Object.keys(F).filter((k) => F[k]),
      operations: OPS.map((o) => ({ op: o.no, name: o.n, machine: o.k === "thread" ? THR[P.thr].mc : o.mc, setup_min: +R.O[o.k].setup.toFixed(1), time_min: +R.O[o.k].t.toFixed(2), cost: +R.O[o.k].cost.toFixed(2),
        settings: Object.fromEntries(R.O[o.k].par), equipment: eqOf(o.k), checks: R.O[o.k].res.map(([l, v, st]) => ({ check: l, value: v, result: st })) })), verdict: R.fails.length ? "REJECT" : "RELEASED", note: "simulated example values" };
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(rec, null, 2)], { type: "application/json" })); a.download = `${rec.worm}_part_record.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  window.addEventListener("hmcrotchange", () => { if (!box.hidden) { renderAll(); frame(); } else compute(); });

  // item switch (HMC tab)
  function showItem(n) {
    document.querySelectorAll("[data-hritem]").forEach((b) => b.classList.toggle("active", b.dataset.hritem === n));
    document.querySelectorAll("[data-hritem]").forEach((b) => { const i = b.dataset.hritem, el = $("hrItem" + i), it = $("hrIntro" + i); if (el) el.hidden = i !== n; if (it) it.hidden = i !== n; });
    if (n === "2") { renderAll(); frame(); startLoop(); }
    window.dispatchEvent(new CustomEvent("hritemshow", { detail: n }));
  }
  document.querySelectorAll("[data-hritem]").forEach((b) => b.addEventListener("click", () => showItem(b.dataset.hritem)));
  window.wormMfg = { show: () => showItem("2"), showItem, current: () => { if (!R) compute(); return { R, g }; }, state: () => ({ k: OPS[op].k, no: OPS[op].no, n: OPS[op].n, u, g, R, P, F, visible: !box.hidden && pane && pane.classList.contains("active") }) };
  const q = new URLSearchParams(location.search);
  if (q.get("wmf")) q.get("wmf").split(",").forEach((k) => { if (FAULTS.some((x) => x[0] === k)) F[k] = true; });
  if (q.get("wmsn")) serial = Math.max(1, parseInt(q.get("wmsn"), 10) || 1);
  if (q.get("hritem")) { inputs(); setTimeout(() => showItem(q.get("hritem")), 0); }
  if (q.get("wmop")) { const i = OPS.findIndex((o) => o.no === parseInt(q.get("wmop"), 10)); if (i >= 0) { op = i; u = q.get("wmu") ? clamp(parseFloat(q.get("wmu")), 0, 1) : 1; renderAll(); frame(); } }
}

/* shared helpers for the worm-wheel twin (wheelmfg.js) */
export { $, esc, f, RAD, SEC, AL, ALS, clamp, ease, lerp, rngOf, gauss, chart, svgOpen, txt, big, sparks, defs, STEEL, HARD, GRD, CARB, WHEEL, CL, CR, wormData, OPS as WORM_OPS, geom as wormGeom, thrR, segAt, htCycle, thrStateAt, THR };
