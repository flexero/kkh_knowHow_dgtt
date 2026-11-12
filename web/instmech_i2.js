/* Installation tab – item 2 "Levelling, alignment, geometric acceptance" (builds #inItem2).
 * Cards: instruments · levelling procedure · levelling simulator (bed on 6 bolts) · alignment of elements + shaft alignment ·
 * geometric acceptance (ISO 230-1 / ISO 10791-1) · positioning ISO 230-2 + ballbar + test piece · maker questions.
 * Numbers: instmech_calc.js. Guide: docs/26_installation_foundation_alignment.md. All values are EXAMPLES. */
import { PADS, LEV, solveBed, levelState, randomState, hint, applyMove, iso2302, exampleIso2302 } from "./instmech_calc.js";
import { $, esc, f, fs, ok, card, num, sel, val, bindInfo, chart } from "./instmech_ui.js";

const Q = new URLSearchParams(location.search);

const INFO = {
  lvl: ["Precision spirit level (frame / block level)", "Machined cast-iron level with a ground vial. Sensitivity 0.02 mm/m per division (= 4 arc-seconds); for precision work 0.01 mm/m.", "The basic tool for levelling: shows the slope directly in mm/m. 0.02 mm/m = 20 µm over 1 m.", "Reversal test: read, turn the level 180° on the same spot, read again – with bubble readings in divisions (same end as reference) half the difference is the level error; with signed slope readings (+ up to the right) it is half the sum; adjust if > ½ division. Let it reach room temperature (30 min), do not hold it by hand on the vial.", "Reading only in one direction (level error is added to every reading) or levelling on a dirty surface."],
  elvl: ["Electronic level (inclinometer)", "Pendulum / capacitive sensor, resolution 1 µm/m, display or PC; two units allow differential measurement.", "Faster, logs data, can measure pitch / roll of an axis along its travel (ISO 230-1 angular deviation) and twist with two heads.", "Zero by reversal, warm-up, calibration certificate.", "Using it on a vibrating floor without averaging."],
  sq: ["Granite square / cylindrical square", "Granite square, accuracy grade 00 (example 2–3 µm over 500 mm).", "Reference for squareness tests X–Y, Y–Z, Z–X with a dial indicator on the spindle.", "Clean, temperature-equalised, set on 3 points; reverse the square to remove its own error.", "Square standing on chips, or temperature difference between square and machine."],
  bar: ["Test mandrel (test bar)", "Hardened, ground bar with the machine's taper (e.g. HSK-A63 / SK40), cylindrical part 300 mm, run-out < 2 µm.", "Spindle run-out at the nose and at 300 mm, parallelism of the spindle axis to Z.", "Clean taper (no fingerprint!), measure at 4 positions turned 90° and average (removes the bar's own error).", "Clamping the bar with a dirty taper → 10 µm run-out that is not in the spindle."],
  ind: ["Dial / digital indicator", "Lever or plunger indicator, resolution 0.001 mm, on a magnetic stand.", "Straightness with a straight edge, parallelism, run-out, squareness with the square.", "Stand stiff and short, probe perpendicular to the surface, small preload.", "Long, wobbly stand: the reading is the stand, not the machine."],
  laser: ["Laser interferometer", "Laser measuring system (e.g. Renishaw XL-80, API) with linear, angular, straightness optics; air temperature, pressure, humidity and material temperature sensors.", "ISO 230-2 positioning accuracy and repeatability of every linear axis; pitch / yaw; data for pitch-error compensation in the CNC.", "Environment compensation on, cosine error < 1 µm (beam aligned), dead path short, machine warmed up.", "Measuring a cold machine in the morning, compensating the CNC, and producing a thermal error in the afternoon."],
  ballbar: ["Ballbar (ISO 230-4)", "Telescopic bar with a precision sensor between two magnetic balls; the machine moves a circle (example R 150 mm, F 1000 mm/min).", "10-minute health check: circularity, backlash, reversal spikes, servo mismatch, squareness, cyclic errors. Repeat monthly for trends.", "Same radius, feed, plane and program every time; warm-up first.", "Comparing results with different radius / feed – the numbers change."],
  tracker: ["Laser tracker / total station", "Measures 3-D points over 10–50 m (tracker ±0.02 mm + 5 µm/m; total station ±1 mm).", "Line alignment: position of machines, APC, robot, conveyors, AGV docks to the floor reference lines and to each other.", "Reference points (floor bolts / markers) stable, measured twice, temperature noted.", "Aligning each machine to the next one (errors add up) instead of to the common datum."],
  wedge: ["Levelling bolt / jack bolt", "Bolt in the machine foot pushing on a steel pad. M30 × 1.5 fine thread (example): 1 turn = 1.5 mm, 1/32 turn (11°) = 0.047 mm.", "Fine height adjustment of each support point.", "Thread oiled, lock nut, pad under the bolt centred.", "Turning while the machine is clamped by the anchors → the bed twists."],
};

const TESTS = [
  // [id, test, standard, instrument, tol, unit, measured example, how]
  ["G1", "Straightness of X motion – vertical plane (XY)", "ISO 10791-1 / ISO 230-1", "straight edge + indicator, or laser", 0.010, "mm / 500", 0.006, "indicator on the spindle, straight edge on the pallet along X; read every 50 mm; remove slope (end-point line)"],
  ["G2", "Straightness of X motion – horizontal plane (ZX)", "ISO 10791-1", "straight edge + indicator", 0.010, "mm / 500", 0.007, "same, straight edge on its side"],
  ["G3", "Angular deviation of X (pitch / yaw / roll)", "ISO 230-1", "electronic level (roll, pitch), laser angular optics (yaw)", 0.060, "mm / 1000", 0.035, "read every 100 mm, max − min"],
  ["G4", "Straightness of Y motion (column vertical)", "ISO 10791-1", "granite square + indicator", 0.010, "mm / 500", 0.008, "square on the pallet, indicator on the spindle, move Y"],
  ["G5", "Straightness of Z motion (table)", "ISO 10791-1", "straight edge + indicator", 0.010, "mm / 500", 0.012, "if too big: check levelling (twist!) first"],
  ["G6", "Squareness X – Y", "ISO 10791-1", "granite square + indicator", 0.020, "mm / 500", 0.011, "set square parallel to X, read along Y; reverse the square"],
  ["G7", "Squareness Y – Z", "ISO 10791-1", "granite square + indicator", 0.020, "mm / 500", 0.009, ""],
  ["G8", "Squareness Z – X", "ISO 10791-1", "granite square + indicator", 0.020, "mm / 500", 0.014, ""],
  ["G9", "Flatness of the pallet surface", "ISO 10791-1", "precision level grid or straight edge", 0.015, "mm (500 × 500)", 0.008, "Union-Jack grid, level steps"],
  ["G10", "Parallelism pallet surface – X motion", "ISO 10791-1", "indicator on the spindle", 0.020, "mm / 500", 0.010, ""],
  ["G11", "Parallelism pallet surface – Z motion", "ISO 10791-1", "indicator on the spindle", 0.020, "mm / 500", 0.013, ""],
  ["G12", "Spindle taper run-out at the nose", "ISO 10791-1 / ISO 230-7", "test mandrel + indicator 0.001", 0.005, "mm", 0.003, "turn slowly by hand, 4 bar positions"],
  ["G13", "Run-out at 300 mm from the nose", "ISO 10791-1", "test mandrel + indicator 0.001", 0.012, "mm", 0.009, ""],
  ["G14", "Spindle axial (face) run-out", "ISO 230-7", "indicator on the ball at the bar end", 0.005, "mm", 0.002, ""],
  ["G15", "Parallelism spindle axis – Z motion (YZ / ZX)", "ISO 10791-1", "test mandrel + indicator, move Z 300 mm", 0.015, "mm / 300", 0.010, "average of 0° and 180° bar positions"],
  ["G16", "B-axis indexing accuracy (rotary pallet)", "ISO 230-2 (rotary)", "autocollimator + polygon, or laser + rotary reference", 10, "arc-sec", 6.2, "every 30° (or 15°), 5 runs both directions"],
  ["G17", "Ballbar circularity XY (R 150, F 1000)", "ISO 230-4", "ballbar", 0.012, "mm", 0.009, "after warm-up; also YZ, ZX planes"],
];

const IFACES = [
  // [id, interface, nominal text, tol (±), unit, measured, instrument, note]
  ["A1", "HMC-01 centre to line reference axis (across)", "0", 2, "mm", 1.2, "total station / tape from reference line", "all machines from ONE datum"],
  ["A2", "Pitch HMC-01 → HMC-02 (along line)", "4800", 1, "mm", 0.6, "total station / laser tracker", "pallet transport positions depend on it"],
  ["A3", "HMC-01 rotation to the line axis", "0", 0.3, "mm/m", 0.12, "total station, 2 points on the machine", "angle error moves far points"],
  ["A4", "Pallet transfer height: APC load station vs AGV deck", "1100", 0.5, "mm", 0.3, "precision level + height gauge", "set with the levelling bolts (item 2.3)"],
  ["A5", "APC arm to table transfer position", "maker", 0.2, "mm", 0.15, "indicator on the pallet", "aligned by the maker – check after transport"],
  ["A6", "Robot base to machine fixture reference", "0", 1, "mm", 0.8, "laser tracker", "then re-teach / measure the robot user frame"],
  ["A7", "Robot base level", "0", 0.5, "mm/m", 0.2, "precision level", "base plate grouted + anchored"],
  ["A8", "Conveyor top height at robot pick point", "850", 1, "mm", 1.4, "level + height gauge", "too high → gripper collision"],
  ["A9", "Conveyor lateral position to robot", "0", 2, "mm", 0.9, "tape / tracker", "guides centre the part"],
  ["A10", "AGV docking station position (along / across)", "0", 1, "mm", -0.6, "tracker, docking pins", "mechanical centring takes the rest"],
  ["A11", "AGV docking height vs load station", "0", 0.5, "mm", 0.4, "level + feeler gauge", "floor flatness in the docking area!"],
  ["A12", "Chip conveyor discharge over the chip cart / trench", "0", 20, "mm", 12, "tape", "spillage"],
];

/* shaft alignment tolerances for short flexible couplings (typical industry table, mm and mm/100 mm) */
const SHAFT = [ // [rpm max, offset excellent, offset acceptable, angle excellent, angle acceptable]
  [1000, 0.07, 0.13, 0.06, 0.10], [2000, 0.05, 0.10, 0.05, 0.08], [3000, 0.03, 0.07, 0.04, 0.07], [4000, 0.02, 0.05, 0.03, 0.06], [6000, 0.01, 0.03, 0.02, 0.05],
];
export function shaftCheck(rpm, off, ang) {
  const row = SHAFT.find((r) => rpm <= r[0]) || SHAFT[SHAFT.length - 1];
  const o = Math.abs(off), a = Math.abs(ang);
  const grade = o <= row[1] && a <= row[3] ? "excellent" : o <= row[2] && a <= row[4] ? "acceptable" : "NOT OK";
  return { row, grade };
}

export function buildItem2(box) {
  box.innerHTML = [
    card("imInst", "2.1 Instruments for levelling, alignment and acceptance", "click a row for how to use it and the typical mistake", {
      what: "The measuring tools the installer and the acceptance engineer use – from a spirit level to a laser interferometer.",
      why: "You cannot set 0.02 mm/m with a builder's level (0.5 mm/m). Each test needs an instrument that is ≥ 4–10 × better than the tolerance.",
      how: "Rule: instrument uncertainty ≤ ¼ … ⅒ of the tolerance (ISO 230-9 / ISO 14253-1 decision rules). Let instruments reach room temperature; check them by reversal; calibration certificates valid.",
      check: "Calibration date, reversal test of the level before use, temperature of machine and instruments written in the report.",
      mistake: "Measuring right after unpacking the instruments from a cold car." }, instBody()),
    card("imProc", "2.2 Levelling procedure – step by step for the HMC 500", "the real sequence · tolerances are examples – the maker's manual decides", {
      what: "Bring the machine bed level and free of twist on its 6 levelling bolts, at the right height for the pallet changer / robot / AGV interfaces.",
      why: "The bed is scraped and measured level at the maker. If you support it twisted, the guideways twist: straightness, squareness and the B-axis position change (geometric errors of 10–30 µm).",
      how: "Rough levelling → main-point levelling → twist removal → auxiliary bolts → height → lock + anchors → re-check after 24 h, 1 week, 1 month.",
      check: "All readings ≤ 0.02 mm/m (example) in X and Z at front / middle / rear table position and at the column base; twist ≤ 0.02 mm/m; every bolt carries load.",
      mistake: "Levelling with the auxiliary bolts (they then lift the bed and bend it) or levelling only at one table position (twist not seen)." }, procBody()),
    card("imSim", "2.3 Levelling simulator – turn the 6 levelling bolts yourself", "bed on 6 elastic bolts · M30 × 1.5 (1 turn = 1.5 mm) · tolerance 0.02 mm/m (example) · random installed state", {
      what: "A model of the HMC bed on its 6 jack bolts. Turn the bolts and read the precision level at four positions, like the installer does.",
      why: "To feel how one bolt changes all readings, why twist appears with 4+ supports, and why the auxiliary bolts are set last.",
      how: "Model: the bed is a stiff body that can also twist (mode x·z) and bow along its length (mode z²). Each bolt is a stiff spring (1 kN/µm) that can only push. The program finds the position with minimum energy (balance of weight, bolt forces and bed stiffness) and reads the slopes.",
      check: "All 4 checks green: readings, twist, height, bolt loads.",
      mistake: "Turning many bolts at the same time without reading in between." }, simBody()),
    card("imAlign", "2.4 Alignment of the elements to each other", "floor datum · machine to APC, robot, conveyor, AGV dock · shaft alignment · tolerances are examples", {
      what: "The line is a chain: machine ↔ pallet changer ↔ AGV / RGV ↔ conveyors ↔ robot. Each interface must be at the right position and height.",
      why: "A pallet that arrives 1.5 mm too high hits the locating pins; a robot 2 mm off picks wrong. Errors add up if each element is aligned only to its neighbour.",
      how: "1) Set ONE datum: main line axis + cross axis + height reference (floor bolts / brass markers, laser lines). 2) Mark the reference lines on the floor before the machines come. 3) Place each element to the datum (total station / laser tracker), not to its neighbour. 4) Fine-tune interface heights with the levelling bolts. 5) Re-teach robot frames and AGV docking positions after the final position.",
      check: "Measured interface table (below) all within tolerance, recorded with date and temperature.",
      mistake: "Painting the reference lines after the machines are placed, or using the hall wall as reference (walls are not straight)." }, alignBody()),
    card("imGeo", "2.5 Geometric acceptance – ISO 230-1 / ISO 10791-1 tests (example measured set)", "edit the measured values · tolerances in the style of ISO 10791-1 – the standard and the maker's test certificate give the real values", {
      what: "After levelling, the machine geometry is checked: straightness, squareness, parallelism of the pallet, spindle run-out, B-axis indexing – the same tests as in the maker's final inspection (FAT).",
      why: "Transport and a different floor change the geometry. The test proves that the machine is as delivered, and the report is the base for warranty claims.",
      how: "Warm up the machine first (spindle 50 % speed + all axes moving for 1 h, example). Room 20 ± 2 °C, gradient ≤ 1 K/m. Measure with the instruments in 2.1, compare with the maker's FAT values, sign the protocol.",
      check: "Every value ≤ tolerance AND close to the FAT value of the same machine (a big change = something moved, even if still in tolerance).",
      mistake: "Measuring a cold machine, or 'correcting' squareness with the levelling bolts instead of finding the real cause." }, geoBody()),
    card("imPos", "2.6 Positioning accuracy ISO 230-2, ballbar ISO 230-4, test piece ISO 10791-7", "example X axis 800 mm · 9 targets × 5 runs in each direction · live evaluation", {
      what: "Laser interferometer measurement of the X axis: deviations at 9 target positions, 5 runs forward (↑) and 5 backward (↓). The program calculates the ISO 230-2 values A, B, E, M, R.",
      why: "These numbers are in every machine catalogue and acceptance contract. They show pitch error, thermal growth, backlash and repeatability.",
      how: "Per target: mean x̄↑, x̄↓, standard uncertainty s↑, s↓; reversal B_i = x̄↑ − x̄↓; repeatability R = max(2s↑+2s↓+|B_i|, 4s↑, 4s↓); accuracy A = max(x̄+2s) − min(x̄−2s); systematic E = max x̄ − min x̄ (both directions); mean bidirectional M from (x̄↑+x̄↓)/2.",
      check: "A, B, R, E ≤ the contract values (example A ≤ 0.012 mm, R ≤ 0.006 mm, B ≤ 0.004 mm for 800 mm with linear scales).",
      mistake: "Running the test with a different program (feed, dwell, overrun) than the maker – B and R change." }, posBody()),
    card("imAsk2", "2.7 Questions for the maker and acceptance checklist", "", null, ask2Body()),
  ].join("");

  bindInfo($("imInst"), INFO, "imInfoI", Q.get("iminfo") && INFO[Q.get("iminfo")] ? Q.get("iminfo") : "lvl");

  /* ---------------------------------------------------- 2.3 levelling simulator */
  let seed = +(Q.get("imseed") || 3);
  let e = randomState(seed), steps = 0, log = [];
  const e0 = levelState();
  function render() {
    const s = solveBed(e);
    $("imBed").innerHTML = bedSvg(s, e, e0);
    const avg = LEV.W / 6;
    $("imBolts").innerHTML = `<table class="im-tbl im-bolt"><tr><th>Bolt</th><th>turn</th><th>turned so far</th><th>force</th><th>share</th></tr>
      ${PADS.map((p, i) => `<tr><td><b>${p.n}</b> ${p.main ? "main" : "aux"}</td><td class="im-nw">${[-1 / 4, -1 / 32, 1 / 32, 1 / 4].map((t) => `<button class="im-mini" data-b="${i}" data-t="${t}">${t > 0 ? "+" : "−"}${Math.abs(t) === 0.25 ? "¼" : "1/32"}</button>`).join("")}</td>
      <td>${fs((e[i] - start[i]) / LEV.pitch, 3)}</td><td>${f(s.F[i], 1)} kN</td><td><span class="im-bar"><span style="width:${Math.min(100, s.share[i] * 50)}%" class="${s.share[i] < LEV.minShare ? "im-barbad" : ""}"></span></span> ${f(s.share[i] * 100, 0)} %</td></tr>`).join("")}
      <tr><td><b>all</b></td><td class="im-nw">${[-1 / 8, -1 / 32, 1 / 32, 1 / 8].map((t) => `<button class="im-mini" data-b="all" data-t="${t}">${t > 0 ? "+" : "−"}${Math.abs(t) === 0.125 ? "⅛" : "1/32"}</button>`).join("")}</td><td colspan="3">raise / lower the whole bed (height)</td></tr></table>`;
    const lv = (v) => { const d = v / 0.02; return `<span class="im-vial"><span class="im-bub${Math.abs(v) > LEV.tol ? " im-bubbad" : ""}" style="left:${50 + Math.max(-46, Math.min(46, d * 12))}%"></span></span>`; };
    $("imRead").innerHTML = `<table class="im-tbl"><tr><th>Level position</th><th>X reading</th><th></th><th>Z reading</th><th></th></tr>
      ${s.read.map((r) => `<tr><td>${r.name}</td><td class="${Math.abs(r.X) <= LEV.tol ? "im-gt" : "im-bt"}">${fs(r.X)} mm/m <span class="sub">(${fs(r.X / 0.02, 1)} div)</span></td><td>${lv(r.X)}</td><td class="${r.Z === null ? "" : Math.abs(r.Z) <= LEV.tol ? "im-gt" : "im-bt"}">${r.Z === null ? "– (X only)" : fs(r.Z) + " mm/m"}</td><td>${r.Z === null ? "" : lv(r.Z)}</td></tr>`).join("")}</table>
      <div class="im-checks">${ok(s.okRead, "readings ≤ 0.02 mm/m", "readings > 0.02 mm/m")} ${ok(s.okTwist, `twist ${f(s.twist, 3)} ≤ 0.02`, `twist ${f(s.twist, 3)} mm/m`)} ${ok(s.okH, `height ${fs(s.hgt, 2)} mm ≤ ±0.5`, `height ${fs(s.hgt, 2)} mm`)} ${ok(s.okLoad, "all bolts loaded", "a bolt is loose")}
      <b class="${s.pass ? "im-gt" : "im-bt"}">${s.pass ? "LEVELLED – PASS" : "not yet"}</b> <span class="sub">moves: ${steps}</span></div>`;
    return s;
  }
  let start = e.slice();
  $("imBolts").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-b]"); if (!b) return;
    const t = parseFloat(b.dataset.t), bolts = b.dataset.b === "all" ? [0, 1, 2, 3, 4, 5] : [+b.dataset.b];
    e = applyMove(e, bolts, t); steps++; render(); $("imHint").textContent = "";
  });
  $("imHintBtn").addEventListener("click", () => { $("imHint").textContent = hint(e).txt; });
  $("imDoBtn").addEventListener("click", () => { const h = hint(e); $("imHint").textContent = h.txt; if (h.move) { e = applyMove(e, h.move.bolts, h.move.turns); steps++; render(); } });
  $("imRand").addEventListener("click", () => { seed = (seed * 7919 + 13) % 100000 + 1; e = randomState(seed); start = e.slice(); steps = 0; render(); $("imHint").textContent = `New random installed state (seed ${seed}). Start with "next step hint" or read the levels and decide yourself.`; });
  let simState = render();
  if (Q.has("imsolve")) { for (let i = 0; i < 40; i++) { const h = hint(e); if (!h.move) { $("imHint").textContent = h.txt; break; } e = applyMove(e, h.move.bolts, h.move.turns); steps++; } simState = render(); }

  /* ---------------------------------------------------- 2.4 alignment table + shaft */
  function renderAlign() {
    let nOk = 0;
    $("imAlignTbl").querySelectorAll("tr[data-a]").forEach((tr) => {
      const it = IFACES.find((x) => x[0] === tr.dataset.a); const m = parseFloat(tr.querySelector("input").value);
      const good = Math.abs(m) <= it[3]; if (good) nOk++; // input = measured deviation from nominal
      tr.querySelector(".im-res").innerHTML = ok(good, "PASS", "FAIL");
    });
    $("imAlignSum").innerHTML = `${nOk} of ${IFACES.length} interfaces within tolerance.`;
    const sc = shaftCheck(val("imSrpm"), val("imSoff"), val("imSang"));
    $("imShaftRes").innerHTML = `rpm ≤ ${sc.row[0]}: offset ≤ ${sc.row[1]} (excellent) / ${sc.row[2]} mm (acceptable), angle ≤ ${sc.row[3]} / ${sc.row[4]} mm per 100 mm → ${sc.grade === "NOT OK" ? ok(false, "", "NOT OK – re-align") : ok(true, sc.grade)}`;
    return { nOk, shaft: sc };
  }
  $("imAlignTbl").addEventListener("input", renderAlign);
  ["imSrpm", "imSoff", "imSang"].forEach((id) => $(id).addEventListener("input", renderAlign));

  /* ---------------------------------------------------- 2.5 geometric acceptance */
  function renderGeo() {
    let nOk = 0, worst = null;
    $("imGeoTbl").querySelectorAll("tr[data-g]").forEach((tr) => {
      const t = TESTS.find((x) => x[0] === tr.dataset.g); const m = parseFloat(tr.querySelector("input").value);
      const u = m / t[4], good = Math.abs(m) <= t[4]; if (good) nOk++;
      if (!worst || u > worst.u) worst = { id: t[0], u };
      tr.querySelector(".im-res").innerHTML = `<span class="im-bar"><span style="width:${Math.min(100, u * 100)}%" class="${good ? (u > 0.8 ? "im-barmid" : "") : "im-barbad"}"></span></span> ${f(u * 100, 0)} % ${ok(good, "PASS", "FAIL")}`;
    });
    $("imGeoSum").innerHTML = `${nOk} of ${TESTS.length} tests pass. Highest use of tolerance: <b>${worst.id}</b> (${f(worst.u * 100, 0)} %). ${nOk < TESTS.length ? "Typical order of actions: re-check levelling + twist (2.3) → repeat the test warm → only then ask the maker for adjustment (gibs, column squareness, compensation)." : "Protocol can be signed (with the FAT values next to it)."}`;
    return { nOk };
  }
  $("imGeoTbl").addEventListener("input", renderGeo);

  /* ---------------------------------------------------- 2.6 ISO 230-2 */
  function renderPos() {
    const comp = $("imComp").checked;
    const d = exampleIso2302(comp), r = iso2302(d.targets, d.up, d.dn);
    const up = r.rows.map((x) => [x.P, x.mu]), dn = r.rows.map((x) => [x.P, x.md]);
    const hi = r.rows.map((x) => [x.P, Math.max(x.mu + 2 * x.su, x.md + 2 * x.sd)]), lo = r.rows.map((x) => [x.P, Math.min(x.mu - 2 * x.su, x.md - 2 * x.sd)]);
    $("imPosChart").innerHTML = chart({ w: 560, h: 270, xr: [0, 800], yr: [-6, 14], xt: [0, 200, 400, 600, 800], yt: [-5, 0, 5, 10], hl: [{ y: 0, cls: "im-ref" }],
      series: [{ pts: up, cls: "im-s1", name: "mean forward x̄↑" }, { pts: dn, cls: "im-s3", name: "mean backward x̄↓" }, { pts: hi, cls: "im-s2", name: "± 2s envelope" }, { pts: lo, cls: "im-s2" }],
      xlabel: "target position X (mm)", ylabel: "deviation (µm)", title: "ISO 230-2" });
    const T = { A: 12, B: 4, R: 6, E: 8 };
    $("imPosRes").innerHTML = `<table class="im-tbl"><tr><th>Value</th><th>Meaning</th><th>Result</th><th>Example limit</th><th></th></tr>
      <tr><td><b>A</b></td><td>accuracy (all errors incl. 2s)</td><td>${f(r.A, 1)} µm</td><td>${T.A} µm</td><td>${ok(r.A <= T.A)}</td></tr>
      <tr><td><b>E</b></td><td>systematic positional deviation</td><td>${f(r.E, 1)} µm</td><td>${T.E} µm</td><td>${ok(r.E <= T.E)}</td></tr>
      <tr><td><b>M</b></td><td>mean bidirectional positional deviation</td><td>${f(r.M, 1)} µm</td><td>–</td><td></td></tr>
      <tr><td><b>B</b></td><td>reversal value (backlash, friction)</td><td>${f(r.B, 1)} µm</td><td>${T.B} µm</td><td>${ok(r.B <= T.B)}</td></tr>
      <tr><td><b>R</b></td><td>bidirectional repeatability</td><td>${f(r.R, 1)} µm</td><td>${T.R} µm</td><td>${ok(r.R <= T.R)}</td></tr></table>
      <p class="im-note">${comp ? "After pitch-error compensation in the CNC: the slope (10.5 µm over 800 mm, e.g. ball-screw lead error or a ≈ 1.1 K warmer screw) is gone – A and E drop; B and R stay (compensation cannot remove backlash or scatter)." : "Before compensation: a rising line = linear error (ball-screw lead, temperature: 11.5 µm/(m·K) × 0.8 m × 1.1 K ≈ 10 µm). The gap between ↑ and ↓ = reversal B. Tick the box to load the compensation table."}</p>`;
    return r;
  }
  $("imComp").addEventListener("change", renderPos);

  const st = { sim: simState, align: renderAlign(), geo: renderGeo(), pos: renderPos() };
  if (Q.has("imtest")) setTimeout(() => selfTest2(), 250);
  function selfTest2() {
    const out = (s) => console.log("IMTEST2 " + s);
    const lev = solveBed(e0);
    out(`level state: e=[${e0.map((v) => f(v, 4)).join(", ")}] mm, forces=[${lev.F.map((v) => f(v, 2)).join(", ")}] kN (ΣF=${f(lev.F.reduce((a, b) => a + b, 0), 2)} = W ${f(LEV.W, 2)}) readings max=${f(Math.max(...lev.read.map((r) => Math.abs(r.X))), 5)} pass=${lev.pass}`);
    const m1 = solveBed(applyMove(e0, [0], 1 / 32));
    out(`bolt 1 +1/32 turn (+0.0469 mm): Xf=${fs(m1.read[0].X, 4)} Zf=${fs(m1.read[0].Z, 4)} twist=${f(m1.twist, 4)} mm/m F1=${f(m1.F[0], 2)} kN`);
    const mf = solveBed(applyMove(e0, [0, 1], 1 / 32));
    out(`front bolts 1+2 +1/32: Z mid=${fs(mf.read[1].Z, 4)} mm/m (rigid-body tilt alone would be 0.0469/3.4 m = 0.0138; the middle bolts make the bed bow, so the table reads more) twist=${f(mf.twist, 4)}`);
    const ma = solveBed(applyMove(e0, [0, 1, 2, 3, 4, 5], 0.25));
    out(`all bolts +1/4 turn: height=${fs(ma.hgt, 4)} mm (expect +0.375) readings unchanged max|X|=${f(Math.max(...ma.read.map((r) => Math.abs(r.X))), 5)}`);
    const md = solveBed(applyMove(e0, [2], -0.5));
    out(`aux bolt 3 −1/2 turn: F3=${f(md.F[2], 2)} kN (free → 0) okLoad=${md.okLoad}`);
    // solver from 20 random states
    let solved = 0, maxSteps = 0;
    for (let sd = 1; sd <= 50; sd++) { let x = randomState(sd), n = 0; for (; n < 60; n++) { const h = hint(x); if (!h.move) break; x = applyMove(x, h.move.bolts, h.move.turns); } const r = solveBed(x); if (r.pass) solved++; else if (Q.has("imdbg")) { let y = randomState(sd); for (let k = 0; k < 60; k++) { const h = hint(y); if (k > 45) out(`DBG seed ${sd} step ${k}: ${h.txt}`); if (!h.move) break; y = applyMove(y, h.move.bolts, h.move.turns); } } maxSteps = Math.max(maxSteps, n); }
    out(`hint loop: ${solved} random states levelled (of 50), max ${maxSteps} hint steps`);
    out(`current sim: seed=${seed} pass=${simState.pass} twist=${f(simState.twist, 4)} hgt=${f(simState.hgt, 3)} moves=${steps}`);
    const iso = iso2302(...Object.values(exampleIso2302(false))), isoc = iso2302(...Object.values(exampleIso2302(true)));
    out(`ISO 230-2 before comp: A=${f(iso.A, 2)} B=${f(iso.B, 2)} E=${f(iso.E, 2)} M=${f(iso.M, 2)} R=${f(iso.R, 2)} µm · after: A=${f(isoc.A, 2)} B=${f(isoc.B, 2)} E=${f(isoc.E, 2)} R=${f(isoc.R, 2)}`);
    const tiny = iso2302([0, 100], [[1, 2, 3, 2, 2], [4, 4, 5, 5, 6]], [[0, 0, 1, 0, -1], [2, 3, 3, 2, 2]]);
    out(`ISO 230-2 hand set: x̄↑0=${f(tiny.rows[0].mu, 2)} (2.00) s↑0=${f(tiny.rows[0].su, 4)} (0.7071) B0=${f(tiny.rows[0].Bi, 2)} (2.00) R0=${f(tiny.rows[0].Ri, 3)} (2·0.7071+2·0.7071+2=4.828) E=${f(tiny.E, 2)} (4.8−0=4.80) B=${f(tiny.B, 2)} (max(2.0, 2.4)=2.40)`);
    out(`shaft: 2950 rpm off 0.03 ang 0.04 → ${shaftCheck(2950, 0.03, 0.04).grade}; off 0.09 → ${shaftCheck(2950, 0.09, 0.04).grade}`);
    out(`align ${st.align.nOk}/${IFACES.length} geo ${st.geo.nOk}/${TESTS.length}`);
  }
  return { st };
}

/* ================================================================== bodies */
function instBody() {
  return `<div class="im-grid2 im-g21"><table class="im-tbl im-click"><tr><th>Instrument</th><th>Resolution / accuracy (example)</th><th>Used for</th></tr>
    <tr data-im="lvl"><td><b>Precision spirit level</b> 200–300 mm</td><td>0.02 mm/m per division (0.01 for precision)</td><td>levelling, twist, roll of axes</td></tr>
    <tr data-im="elvl"><td><b>Electronic level</b></td><td>1 µm/m, ±2 % of reading</td><td>levelling, angular deviations (ISO 230-1), twist with 2 heads</td></tr>
    <tr data-im="sq"><td><b>Granite square</b> / cylinder square</td><td>grade 00: 2–3 µm / 500 mm</td><td>squareness X–Y, Y–Z, Z–X</td></tr>
    <tr data-im="bar"><td><b>Test mandrel</b> 300 mm</td><td>run-out &lt; 2 µm</td><td>spindle run-out, spindle parallel to Z</td></tr>
    <tr data-im="ind"><td><b>Dial / digital indicator</b></td><td>0.001 mm</td><td>straightness with straight edge, parallelism, run-out</td></tr>
    <tr data-im="laser"><td><b>Laser interferometer</b></td><td>±0.5 µm/m (with environment compensation)</td><td>ISO 230-2 positioning, pitch / yaw, compensation tables</td></tr>
    <tr data-im="ballbar"><td><b>Ballbar</b></td><td>0.1 µm sensor resolution</td><td>ISO 230-4 circularity, backlash, squareness, servo match</td></tr>
    <tr data-im="tracker"><td><b>Laser tracker / total station</b></td><td>±0.02 mm + 5 µm/m / ±1 mm</td><td>line alignment: machines, APC, robot, conveyors, AGV docks</td></tr>
    <tr data-im="wedge"><td><b>Levelling bolt</b> M30 × 1.5</td><td>1 turn = 1.5 mm, 1/32 turn = 0.047 mm</td><td>height of each support point</td></tr></table>
    <div><div class="im-info" id="imInfoI"></div>
    <h3>What 0.02 mm/m means</h3><p class="im-note">Slope 0.02 mm/m = 20 µm height change per metre = 0.0011° = 4 arc-seconds. Over the 3.4 m pad pattern of the HMC that is 0.068 mm – less than the thickness of a sheet of paper (0.1 mm).</p></div></div>`;
}
function procBody() {
  return `<div class="im-grid2"><div><ol class="im-steps">
    <li><b>Prepare.</b> Floor clean, steel pads placed on the marked positions (bedded in mortar or on the grout bed if the maker says so), bolts oiled and turned in so that all 6 have ≈ 10 mm stroke both ways. Room temperature stable (≥ 24 h), machine at room temperature (after transport: wait 12–24 h).</li>
    <li><b>Place the machine</b> on the 4 main bolts (corners 1, 2, 5, 6). Auxiliary bolts 3, 4 <i>not</i> touching. Remove transport locks only as the manual says (some stay until levelling is done).</li>
    <li><b>Rough levelling</b> with a 0.1 mm/m level on the table: ±0.1 mm/m in X and Z. Set the height for the interfaces (APC / AGV transfer height ±0.5 mm, example) – the height is easy now, hard later.</li>
    <li><b>Main-point levelling</b> with the 0.02 mm/m precision level (reversal-checked). Level on the table at <b>mid stroke</b>: X direction and Z direction. Correct Z with the front or rear pair, X with the left or right side. Small steps (1/32 turn), wait 1 min, read again.</li>
    <li><b>Twist removal.</b> Move the table to the <b>front end</b> and the <b>rear end</b> of Z, read X at each position, and read X on the column base. If the X reading changes along Z the bed is twisted: raise one diagonal corner pair (e.g. 1 + 6) or lower it, until the X readings agree within 0.02 mm/m.</li>
    <li><b>Auxiliary bolts.</b> Turn 3 and 4 down until they just touch (bolt becomes hard), then the maker's extra (example ⅛–¼ turn by feel / torque) – the readings must <i>not</i> change. If a reading changes, the aux bolt lifts or bends the bed.</li>
    <li><b>Lock.</b> Lock nuts tight while holding the bolt. If anchored: tighten the anchors in a cross pattern to the anchor-maker torque, read again. If grouted: pour, cure, then torque, read again.</li>
    <li><b>Record</b> all readings, bolt turns, temperature, date → protocol.</li>
    <li><b>Re-check</b> after 24 h, 1 week and 1 month (the floor and grout settle); then every 6–12 months, and after any crash.</li></ol></div>
    <div><h3>Level positions on the HMC (top view)</h3>${posSvg()}
    <h3>Tolerances (examples – the maker's manual decides)</h3><table class="im-tbl"><tr><th>Item</th><th>Example</th></tr>
    <tr><td>Level X and Z, every position</td><td>≤ 0.02 mm/m</td></tr><tr><td>Twist (change of X reading along Z)</td><td>≤ 0.02 mm/m</td></tr>
    <tr><td>Height of the transfer plane</td><td>±0.5 mm</td></tr><tr><td>Re-check drift after 1 month</td><td>≤ 0.01–0.02 mm/m</td></tr>
    <tr><td>Precision machine (grinder)</td><td>≤ 0.01 mm/m</td></tr></table>
    <p class="im-note">Order matters: <b>Z first, then X, then twist, then auxiliary bolts</b>. Each correction changes the other readings a little – read everything again after each step.</p></div></div>`;
}
function posSvg() {
  const sc = 60, ox = 66, oy = 26, X = (x) => ox + (x + 1.4) * sc, Y = (z) => oy + (z + 2.0) * sc;
  let s = `<svg class="im-pos" viewBox="0 0 300 312" role="img" aria-label="level positions">`;
  s += `<rect class="im-bedr" x="${X(-1.3)}" y="${Y(-1.9)}" width="${2.6 * sc}" height="${3.8 * sc}" rx="4"/>`;
  s += `<rect class="im-colr" x="${X(-1)}" y="${Y(0.8)}" width="${2 * sc}" height="${0.9 * sc}"/><text class="im-tk" x="${X(0)}" y="${Y(1.45)}" text-anchor="middle">column</text>`;
  s += `<rect class="im-tblr" x="${X(-0.4)}" y="${Y(-1.05)}" width="${0.8 * sc}" height="${0.6 * sc}"/><text class="im-tk" x="${X(-0.45)}" y="${Y(-0.75) + 4}" text-anchor="end">table</text>`;
  s += `<line class="im-dim" x1="${X(0.65)}" x2="${X(0.65)}" y1="${Y(-1.3)}" y2="${Y(-0.2)}"/><text class="im-tk" x="${X(0.7)}" y="${Y(-0.75)}">Z stroke</text>`;
  LEV.pos.forEach((p) => { s += `<circle class="im-lpos" cx="${X(p.x)}" cy="${Y(p.z)}" r="5"/><text class="im-tk" x="${X(p.x) - 9}" y="${Y(p.z) + 4}" text-anchor="end">${p.id}</text>`; });
  PADS.forEach((p) => { s += `<rect class="im-pad${p.main ? "" : " im-aux"}" x="${X(p.x) - 7}" y="${Y(p.z) - 7}" width="14" height="14"/><text class="im-tl" x="${X(p.x) + (p.x < 0 ? -22 : 22)}" y="${Y(p.z) + 4}" text-anchor="middle">${p.n}</text>`; });
  s += `<text class="im-tk" x="${X(0)}" y="${oy - 8}" text-anchor="middle">FRONT (APC / operator)</text>`;
  s += `<text class="im-tk" x="6" y="290">Tf / Tm / Tr = table front / middle / rear</text><text class="im-tk" x="6" y="305">C = column base · ■ main bolt · ▢ auxiliary bolt</text>`;
  return s + "</svg>";
}
function simBody() {
  return `<div class="im-grid2"><div><div class="im-svgbox" id="imBed"></div>
    <div class="im-btnrow"><button class="im-btn" id="imHintBtn">next step hint</button><button class="im-btn" id="imDoBtn">do the hint step for me</button><button class="im-btn" id="imRand">reset to random installed state</button></div>
    <p class="im-hint" id="imHint">Read the levels, then turn the bolts. Clockwise (+) raises that corner. Use the hint if you are stuck.</p></div>
    <div><div id="imBolts"></div><div id="imRead"></div>
    <p class="im-note">Model data (examples): weight on the bolts W = 12 510 kg · 9.81 = 122.7 kN, CoG 0.3 m behind the bed centre (column), bolt stiffness 1 kN/µm, twist stiffness ≈ 0.2 kN/µm at a corner, bow stiffness ≈ 1 kN/µm at a middle bolt. Slope in mm/m = height change (mm) per metre. The level vial shows 1 division = 0.02 mm/m. A real bed also bends locally and the floor gives a little – the sequence of work is the same.</p></div></div>`;
}
function bedSvg(s, e) {
  const sc = 90, ox = 40, oy = 34, X = (x) => ox + (x + 1.5) * sc, Y = (z) => oy + (z + 2.05) * sc; // front (z−) at the top
  let g = `<svg class="im-bedsvg" viewBox="0 0 ${3 * sc + 150} ${4.1 * sc + 80}" role="img" aria-label="bed top view">`;
  g += `<text class="im-tk" x="${X(0)}" y="${oy - 14}" text-anchor="middle">FRONT (table / APC side)  –  top view</text>`;
  // colour map of bed height deviation (twist / bow), 8 x 10 cells
  const nx = 8, nz = 12; let mx = 0; const vals = [];
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) { const x = -1.3 + (i + 0.5) * 2.6 / nx, z = -1.9 + (k + 0.5) * 3.8 / nz; const v = s.w(x, z) - (s.q[0] + s.q[1] * x + s.q[2] * z); vals.push([x, z, v]); mx = Math.max(mx, Math.abs(v)); }
  const span = Math.max(mx, 0.01);
  vals.forEach(([x, z, v]) => { const a = Math.min(1, Math.abs(v) / span) * 0.55; g += `<rect x="${X(x - 1.3 / nx)}" y="${Y(z - 1.9 / nz)}" width="${2.6 / nx * sc + 0.5}" height="${3.8 / nz * sc + 0.5}" fill="${v > 0 ? "var(--im-up)" : "var(--im-dn)"}" fill-opacity="${a.toFixed(2)}"/>`; });
  g += `<rect class="im-bedo" x="${X(-1.3)}" y="${Y(-1.9)}" width="${2.6 * sc}" height="${3.8 * sc}" rx="4"/>`;
  g += `<rect class="im-colr" x="${X(-1)}" y="${Y(0.8)}" width="${2 * sc}" height="${0.9 * sc}"/>`;
  LEV.pos.forEach((p, i) => { const r = s.read[i]; const good = Math.abs(r.X) <= LEV.tol && (r.Z === null || Math.abs(r.Z) <= LEV.tol);
    g += `<g class="${good ? "im-lok" : "im-lbad"}"><rect x="${X(p.x) - 26}" y="${Y(p.z) - 6}" width="52" height="12" rx="6"/>${p.zRead ? `<rect x="${X(p.x) - 6}" y="${Y(p.z) - 26}" width="12" height="52" rx="6"/>` : ""}</g>`;
    g += `<text class="im-tk" x="${X(p.x) + 32}" y="${Y(p.z) + 4}">${p.id} X ${fs(r.X)}</text>${p.zRead ? `<text class="im-tk" x="${X(p.x) + 10}" y="${Y(p.z) - 16}">Z ${fs(r.Z)}</text>` : ""}`; });
  PADS.forEach((p, i) => { const sh = s.share[i];
    g += `<circle class="im-bolt2 ${sh < LEV.minShare ? "im-loose" : ""}" cx="${X(p.x)}" cy="${Y(p.z)}" r="${8 + Math.min(10, sh * 6)}"/><text class="im-tl" x="${X(p.x)}" y="${Y(p.z) + 4}" text-anchor="middle">${p.n}</text>`;
    g += `<text class="im-tk" x="${X(p.x) + (p.x < 0 ? -22 : 22)}" y="${Y(p.z) + 4}" text-anchor="${p.x < 0 ? "end" : "start"}">${f(s.F[i], 1)} kN</text>`; });
  g += `<text class="im-tk" x="${X(0)}" y="${Y(2.05) + 12}" text-anchor="middle">REAR (column) · circle size = bolt load</text><text class="im-tk" x="${X(0)}" y="${Y(2.05) + 27}" text-anchor="middle">colour = twist / bow of the bed (red up, blue down, max ${f(mx * 1000, 1)} µm)</text>`;
  return g + "</svg>";
}
function alignBody() {
  return `<div class="im-grid2"><div><h3>Datum and reference lines</h3><ul class="im-ul">
    <li><b>Main axis</b> of the line (along the HMCs, y = −21.2 … −11.6 m in the layout) and <b>cross axes</b> through each machine centre, from the hall grid.</li>
    <li>Set 2 permanent <b>floor markers</b> (stainless / brass bolts, drilled + glued) at each end of every axis, measured with a total station; draw chalk / paint lines between them.</li>
    <li><b>Height datum</b>: one floor marker with a known level (e.g. ±0.000 = finished floor at HMC-02); all transfer heights refer to it (laser level / tracker).</li>
    <li>Tolerances for marking: ±1 mm over the line length (tracker), lines checked by a second person.</li></ul>
    <h3>Typical interface tolerances (examples)</h3><table class="im-tbl"><tr><th>Interface</th><th>Position</th><th>Height</th><th>Angle</th></tr>
    <tr><td>Stand-alone machine to layout</td><td>±5–10 mm</td><td>–</td><td>±0.5°</td></tr>
    <tr><td>Machine in a linked line (pallet system / RGV)</td><td>±1–2 mm</td><td>±0.5 mm</td><td>≤ 0.3 mm/m</td></tr>
    <tr><td>AGV docking with mechanical centring</td><td>±1 mm (AGV ±5–10 mm before centring)</td><td>±0.5 mm</td><td>–</td></tr>
    <tr><td>Robot to machine / fixture</td><td>±1 mm, then re-teach frames</td><td>±1 mm</td><td>base ≤ 0.5 mm/m</td></tr>
    <tr><td>Conveyor to robot / machine</td><td>±2 mm lateral</td><td>±1 mm</td><td>–</td></tr></table>
    <h3>Shaft alignment (pump / chip conveyor / coolant HP pump)</h3><p class="im-note">Motor and pump on a common base, flexible coupling: align with a laser shaft-alignment tool (two heads, turn the shafts 180°, read offset and angle). First remove <b>soft foot</b> (one motor foot not touching: ≤ 0.05 mm, shim it). Tolerances (typical industry table for short flexible couplings):</p>
    <table class="im-tbl"><tr><th>Speed (rpm)</th><th>Offset excellent / acceptable (mm)</th><th>Angle excellent / acceptable (mm per 100 mm)</th></tr>
    ${SHAFT.map((r, i) => `<tr><td>${i ? SHAFT[i - 1][0] : 0}–${r[0]}</td><td>${r[1]} / ${r[2]}</td><td>${r[3]} / ${r[4]}</td></tr>`).join("")}</table>
    <div class="im-ins">${num("imSrpm", "speed", 2950, 50, "rpm")}${num("imSoff", "measured offset", 0.03, 0.01, "mm")}${num("imSang", "measured angle", 0.04, 0.01, "mm/100")}</div><p id="imShaftRes"></p></div>
    <div><h3>Interface check – measured example set (edit the deviations)</h3>
    <table class="im-tbl" id="imAlignTbl"><tr><th>#</th><th>Interface</th><th>Nominal</th><th>Tol. ±</th><th>Measured deviation</th><th>Instrument</th><th></th></tr>
    ${IFACES.map((a) => `<tr data-a="${a[0]}"><td>${a[0]}</td><td>${esc(a[1])}<br><span class="sub">${esc(a[7])}</span></td><td>${a[2]} ${a[2] === "maker" ? "" : a[4]}</td><td>${a[3]} ${a[4]}</td><td><input type="number" step="0.05" value="${a[5]}" class="im-num"></td><td class="sub">${esc(a[6])}</td><td class="im-res"></td></tr>`).join("")}</table>
    <p id="imAlignSum" class="im-note"></p>
    <p class="im-note">A8 fails in the example: the conveyor is 1.4 mm too high at the pick point → adjust the conveyor feet (not the robot program), then check A9 again.</p></div></div>`;
}
function geoBody() {
  return `<table class="im-tbl" id="imGeoTbl"><tr><th>#</th><th>Test</th><th>Standard</th><th>Instrument</th><th>Tolerance (example)</th><th>Measured</th><th>Use of tolerance</th><th>How</th></tr>
    ${TESTS.map((t) => `<tr data-g="${t[0]}"><td>${t[0]}</td><td>${esc(t[1])}</td><td class="sub">${esc(t[2])}</td><td class="sub">${esc(t[3])}</td><td class="im-nw">${t[5] === "arc-sec" ? t[4] : t[4].toFixed(3)} ${esc(t[5])}</td><td><input type="number" step="0.001" value="${t[6]}" class="im-num"></td><td class="im-res im-nw"></td><td class="sub">${esc(t[7])}</td></tr>`).join("")}</table>
    <p id="imGeoSum" class="im-note"></p>
    <div class="im-grid2"><div><h3>Warm-up before measuring (example)</h3><ul class="im-ul"><li>Room at 20 ± 2 °C for ≥ 24 h, gradient ≤ 1 K/m, no sun / open door near the machine.</li>
    <li>Warm-up program: spindle 50 % of max speed + all axes moving over 80 % of the stroke, 60 min (or the maker's program).</li>
    <li>Write down room, machine and instrument temperatures at the start and end of every test.</li>
    <li>Thermal tests themselves: ISO 230-3 (drift of the spindle position over 4–8 h).</li></ul></div>
    <div><h3>How to read the results</h3><ul class="im-ul"><li>"mm / 500" = maximum deviation over a measuring length of 500 mm (scale it for other lengths per the standard, with a minimum tolerance).</li>
    <li>Compare with the <b>FAT value</b> of the same machine. A change of more than ≈ 30 % of the tolerance means something moved (transport, floor, levelling).</li>
    <li>Straightness and parallelism failing together with twist → re-level first. Squareness failing alone → usually the maker adjusts (or CNC squareness compensation).</li>
    <li>Run-out failing → clean the taper, test with a second test bar, then the spindle (bearing, drawbar).</li></ul></div></div>`;
}
function posBody() {
  return `<div class="im-grid2"><div><div id="imPosChart"></div><label class="im-chk"><input type="checkbox" id="imComp"> after pitch-error compensation (example)</label></div><div id="imPosRes"></div></div>
    <div class="im-grid2"><div><h3>Ballbar ISO 230-4 – typical diagnoses (example R 150 mm, F 1000 mm/min)</h3><table class="im-tbl"><tr><th>Pattern on the plot</th><th>Cause</th><th>Example value</th></tr>
    <tr><td>Circularity (total)</td><td>all errors together</td><td>9 µm (limit 12 µm)</td></tr>
    <tr><td>Steps at the axis reversal (quadrant)</td><td>backlash / lost motion</td><td>2 µm</td></tr><tr><td>Short spikes at reversal</td><td>friction, servo gain / reversal compensation</td><td>3 µm</td></tr>
    <tr><td>Oval at 45°</td><td>squareness error between the two axes</td><td>12 µm/m</td></tr><tr><td>Oval along one axis</td><td>scale mismatch (positioning) or servo mismatch</td><td>3 µm</td></tr>
    <tr><td>Waves</td><td>ball-screw cyclic error, vibration</td><td>&lt; 1 µm</td></tr></table></div>
    <div><h3>Test piece ISO 10791-7 (machining test, example)</h3><table class="im-tbl"><tr><th>Feature</th><th>Checks</th><th>Example tolerance</th></tr>
    <tr><td>Outer square sides (contour milling)</td><td>straightness, squareness, parallelism</td><td>0.010–0.020 mm</td></tr><tr><td>Circle Ø (circular interpolation)</td><td>roundness</td><td>0.015 mm</td></tr>
    <tr><td>Diamond (45° square)</td><td>straightness of 2-axis moves</td><td>0.015 mm</td></tr><tr><td>Small angles 3°</td><td>smooth 2-axis interpolation</td><td>0.020 mm</td></tr>
    <tr><td>Bored holes</td><td>position, roundness</td><td>±0.020 / 0.010 mm</td></tr><tr><td>Face (fly cut)</td><td>flatness, step between passes</td><td>0.010 mm</td></tr></table>
    <p class="im-note">Material, tools, cutting data from the standard (example: aluminium or cast iron, 160 mm piece). For the crankcase line the <b>real run-off part</b> (item 5) is also cut and measured on the CMM (C_mk ≥ 1.67, example).</p></div></div>`;
}
function ask2Body() {
  return `<div class="im-grid2"><div><h3>Ask the maker</h3><ol class="im-ul"><li>Levelling tolerance (mm/m), twist limit, at which positions, with which level.</li>
    <li>Levelling elements: bolt thread + pitch, which are main / auxiliary bolts, aux-bolt preload rule.</li>
    <li>Transport locks: which ones, when to remove.</li><li>FAT protocol (geometry + ISO 230-2 + ballbar) of THIS machine – as reference for the SAT.</li>
    <li>Acceptance test list (ISO 10791-1 test numbers), tolerances, who brings the instruments (laser, ballbar).</li>
    <li>Warm-up program and room conditions for the acceptance.</li><li>Re-levelling interval and procedure; anchor torque.</li>
    <li>Interface heights / positions for APC, AGV, robot – drawing with tolerances.</li></ol></div>
    <div><h3>Acceptance checklist (SAT, geometry part)</h3><ul class="im-ul im-check"><li>Room temperature log 24 h</li><li>Levelling protocol (readings, twist, bolt turns)</li><li>Anchors torqued / grout cured (date)</li>
    <li>Geometry tests G1–G17 within tolerance and near FAT</li><li>ISO 230-2 for X, Y, Z (and B) – A, B, R, E</li><li>Ballbar XY, YZ, ZX – baseline file saved</li>
    <li>Test piece ISO 10791-7 measured</li><li>Interface check A1–A12 recorded</li><li>Re-check dates planned: +1 week, +1 month, every 6–12 months</li></ul></div></div>`;
}
