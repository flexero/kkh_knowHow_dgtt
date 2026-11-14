/* FMS engineering – item 3: typical elements catalogue (all domains).  Loaded by fmse.js (build "3").
 * 3A element map → detail (types, parameters, rules, sizing calculator, interface, mistakes)
 * 3B transport / handling choice · 3C hand-over tolerance stack.   Deep link: /?feitem=3&feel=agv#fmse
 * Guide: docs/FMS system design/63_fms_elements_catalogue.md */
import { GROUPS, EL, TRANS, STACK } from "./fmse3_data.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f1 = (x, d = 1) => (Number.isFinite(x) ? x.toLocaleString("en", { maximumFractionDigits: d, minimumFractionDigits: d }) : "–");
const Q = new URLSearchParams(location.search);
const G = 9.81;
// motion time over distance s with max speed v and acceleration a (trapezoid / triangle profile)
const tMove = (s, v, a) => (s <= 0 ? 0 : s > v * v / a ? s / v + v / a : 2 * Math.sqrt(s / a));
const ok = (c, good, bad) => `<span class="${c ? "fe-ok" : "fe-no"}">${c ? good : bad}</span>`;

/* ---------------------------------------------------------------- sizing calculators: inputs + run(v) → {out:[[label, value, unit, decimals]], verdict} */
const CALC = {
  cycle: { t: "Cycle time and productive share", inp: [["tc", "Cutting time per pallet", 8, "min"], ["ntc", "Tool changes", 18, ""], ["c2c", "Chip-to-chip time", 4, "s"], ["rap", "Rapid moves total", 40, "s"], ["pal", "Pallet change", 15, "s"], ["mea", "Probing / measuring", 30, "s"]],
    run(v) { const non = (v.ntc * v.c2c + v.rap + v.pal + v.mea) / 60, cyc = v.tc + non;
      return { out: [["Non-cutting time = tool changes·chip-to-chip + rapid + pallet + probing", non, "min", 2], ["Cycle time per pallet", cyc, "min", 2], ["Productive share = cutting ÷ cycle", 100 * v.tc / cyc, "%", 0], ["Pallets per hour (100 %)", 60 / cyc, "/h", 2]],
        verdict: v.tc / cyc < 0.7 ? "Below 70 % cutting: reduce tool changes (combined tools), faster changer, fewer probing cycles." : "Good productive share." }; } },
  pallets: { t: "Number of pallets (Little's law)", inp: [["nm", "Machines", 3, ""], ["tc", "Cycle per pallet (e.g. tombstone with 4 parts)", 60, "min"], ["buf", "Waiting pallets per machine (manned)", 2, ""], ["nl", "Pallets at load stations", 2, ""], ["oth", "Pallets in wash / CMM / transport", 1, ""], ["tu", "Unmanned period", 8, "h"]],
    run(v) { const manned = v.nm * 2 + v.nm * v.buf + v.nl + v.oth, unm = v.nm * (1 + Math.ceil(v.tu * 60 / v.tc)), N = Math.max(manned, unm), th = v.nm * 60 / v.tc;
      return { out: [["Manned: machines·(table + APC) + buffer + load + other", manned, "pallets", 0], ["Unmanned: machines·(1 + ⌈T·60 ÷ cycle⌉)", unm, "pallets", 0], ["Pallets needed = max of both", N, "pallets", 0], ["Throughput TH = machines·60 ÷ cycle", th, "pallets/h", 2], ["Flow time = WIP ÷ TH (Little's law)", N / th, "h", 1]],
        verdict: unm > manned ? "The unmanned shift decides the pallet count – fewer pallets possible with longer cycles per pallet (more parts per tombstone)." : "Manned buffer decides the pallet count." }; } },
  apc: { t: "Benefit of a pallet changer", inp: [["tc", "Cutting time per pallet", 12, "min"], ["tl", "Unload + clean + load + clamp", 6, "min"], ["tch", "Pallet change time", 15, "s"]],
    run(v) { const u0 = v.tc / (v.tc + v.tl), u1 = v.tl <= v.tc ? v.tc / (v.tc + v.tch / 60) : v.tc / (v.tl + v.tch / 60);
      return { out: [["Spindle utilisation without APC = t꜀ ÷ (t꜀ + t_load)", 100 * u0, "%", 0], ["With APC = t꜀ ÷ (t꜀ + t_change)", 100 * u1, "%", 0], ["Output gain", 100 * (u1 / u0 - 1), "%", 0]],
        verdict: v.tl > v.tc ? "Loading takes longer than cutting – the operator is the bottleneck. Add a pallet pool / second load station." : "Loading is hidden inside the cutting time." }; } },
  pool: { t: "Pallet pool places and stacker load", inp: [["nm", "Machines", 3, ""], ["tc", "Cycle per pallet", 60, "min"], ["N", "Pallets (from Pallets & fixtures)", 27, ""], ["mv", "Stacker time per move", 45, "s"], ["mpc", "Moves per pallet cycle", 4, ""], ["fr", "Free places for exchange", 2, ""]],
    run(v) { const pph = v.nm * 60 / v.tc, mph = pph * v.mpc, u = mph * v.mv / 3600;
      return { out: [["Pallets per hour through machines", pph, "/h", 2], ["Stacker moves per hour", mph, "/h", 1], ["Stacker utilisation = moves·time ÷ 3600", 100 * u, "%", 0], ["Rack places = pallets + free places", v.N + v.fr, "places", 0]],
        verdict: u > 0.7 ? "Stacker above 70 % – machines will wait for it. Faster stacker, fewer moves (direct machine ⇄ load station), or a second vehicle." : "Stacker has reserve for added machines." }; } },
  loadst: { t: "Number of load / unload stations", inp: [["nm", "Machines", 3, ""], ["tc", "Cycle per pallet", 60, "min"], ["tl", "Operator time per pallet (4 parts)", 15, "min"], ["um", "Max. station utilisation", 0.8, ""]],
    run(v) { const lam = v.nm * 60 / v.tc, u = lam * v.tl / 60, n = Math.ceil(u / v.um - 1e-9);
      return { out: [["Pallet arrivals λ = machines·60 ÷ cycle", lam, "/h", 2], ["Work = λ·t_load ÷ 60", u, "station-hours/h", 2], ["Stations = ⌈work ÷ max. utilisation⌉", n, "", 0], ["Utilisation per station", 100 * u / n, "%", 0]],
        verdict: n > 1 ? "Two or more stations – they can share one operator only if the work sum is below ≈ 0.8." : "One station is enough." }; } },
  robot: { t: "Robot payload, wrist moment and reach", inp: [["mp", "Part mass", 12, "kg"], ["mg", "Gripper mass", 8, "kg"], ["e", "CoG offset from flange", 120, "mm"], ["rp", "Rated payload", 25, "kg"], ["rm", "Allowed wrist moment", 50, "N·m"], ["rq", "Reach needed", 1650, "mm"], ["rr", "Robot reach", 1850, "mm"]],
    run(v) { const m = v.mp + v.mg, M = m * G * v.e / 1000, lp = m / v.rp, lm = M / v.rm;
      return { out: [["Load = part + gripper", m, "kg", 1], ["Payload use", 100 * lp, "%", 0], ["Wrist moment M = m·g·e", M, "N·m", 1], ["Moment use", 100 * lm, "%", 0], ["Reach margin", v.rr - v.rq, "mm", 0]],
        verdict: (lp <= 0.8 && lm <= 0.8 && v.rr >= v.rq * 1.05 ? "✓ " : "✗ ") + "Rule: payload and moment ≤ 80 %, reach ≥ 105 % of needed. Check also inertia J = m·r² in the maker's load diagram." }; } },
  agv: { t: "AGV fleet size", inp: [["tr", "Transport orders per hour (peak)", 24, "/h"], ["dl", "Average loaded distance", 120, "m"], ["de", "Average empty distance", 100, "m"], ["vv", "Speed (average incl. curves)", 1.0, "m/s"], ["tlu", "Docking + load + unload", 40, "s"], ["eta", "Availability (charging)", 0.85, ""], ["ft", "Traffic / blocking factor", 0.85, ""]],
    run(v) { const t = (v.dl + v.de) / v.vv + v.tlu, w = v.tr * t / 3600, n = Math.ceil(w / (v.eta * v.ft) - 1e-9);
      return { out: [["Time per order = (loaded + empty) ÷ v + transfer", t, "s", 0], ["Vehicle-hours per hour", w, "", 2], ["Vehicles = ⌈work ÷ (availability·traffic)⌉", n, "", 0], ["Utilisation per vehicle", 100 * w / n, "%", 0]],
        verdict: "Add 1 vehicle as reserve if a stopped AGV would stop production. Verify with simulation (item 4) – peaks and traffic decide." }; } },
  conv: { t: "Carriers and conveyor speed", inp: [["th", "Throughput", 120, "parts/h"], ["ns", "Stations", 8, ""], ["buf", "Buffer places per station", 2, ""], ["ttr", "Transport time around the loop", 90, "s"], ["pit", "Carrier pitch (length + gap)", 400, "mm"]],
    run(v) { const onway = v.th * v.ttr / 3600, N = Math.ceil(v.ns * (1 + v.buf) * 0.8 + onway), vmin = v.pit * v.th / 3600 / 1000 * 60;
      return { out: [["Carriers on the way = TH·t_transport ÷ 3600", onway, "", 1], ["Carriers ≈ stations·(1 + buffer)·0.8 + on the way", N, "", 0], ["Min. conveyor speed = pitch·TH", vmin, "m/min", 2]],
        verdict: "Factor 0.8: buffers are rarely all full. Too many carriers jam the loop – test the number in simulation." }; } },
  asrs: { t: "AS/RS cycle times (FEM 9.851 points)", inp: [["L", "Rack length", 40, "m"], ["H", "Rack height", 12, "m"], ["vx", "Travel speed", 3, "m/s"], ["ax", "Travel acceleration", 0.5, "m/s²"], ["vy", "Hoist speed", 0.8, "m/s"], ["ay", "Hoist acceleration", 0.5, "m/s²"], ["tf", "Fork cycle (one way)", 8, "s"], ["td", "Dead time per cycle", 4, "s"]],
    run(v) { const t = (x, y) => Math.max(tMove(x, v.vx, v.ax), tMove(y, v.vy, v.ay));
      const P1 = [v.L / 5, 2 * v.H / 3], P2 = [2 * v.L / 3, v.H / 5];
      const tsc = t(...P1) + t(...P2) + 2 * v.tf + v.td, tdc = t(...P1) + t(Math.abs(P2[0] - P1[0]), Math.abs(P2[1] - P1[1])) + t(...P2) + 4 * v.tf + v.td;
      return { out: [["Point P1 (L/5, 2H/3), P2 (2L/3, H/5)", 0, `(${f1(P1[0], 1)}, ${f1(P1[1], 1)}) · (${f1(P2[0], 1)}, ${f1(P2[1], 1)}) m`, -1], ["Single cycle (store or retrieve)", tsc, "s", 1], ["Double cycle (store + retrieve)", tdc, "s", 1], ["Throughput single cycles", 3600 / tsc, "moves/h", 0], ["Throughput double cycles", 2 * 3600 / tdc, "moves/h", 0]],
        verdict: "Speed and acceleration both matter: X and Y move at the same time, the slower axis decides (max). Plan double cycles in the control logic." }; } },
  tools: { t: "Magazine pockets and sister tools", inp: [["tu", "Unique tools of all active parts", 95, ""], ["k", "Critical (wearing) tools", 12, ""], ["life", "Average tool life", 45, "min"], ["use", "Cutting time per part per critical tool", 1.5, "min"], ["np", "Parts in the unmanned period", 40, ""], ["r", "Reserve", 10, "%"]],
    run(v) { const s = Math.max(0, Math.ceil(v.np * v.use / v.life) - 1), P = Math.ceil((v.tu + v.k * s) * (1 + v.r / 100));
      return { out: [["Use per critical tool = parts·time", v.np * v.use, "min", 0], ["Sister tools per critical tool = ⌈use ÷ life⌉ − 1", s, "", 0], ["Pockets = (unique + k·sisters)·(1 + reserve)", P, "pockets", 0]],
        verdict: P > 120 ? "More than ≈ 120 pockets – consider a chain / rack magazine (180–400) or a central tool store." : "A standard magazine (60–120) is enough." }; } },
  wash: { t: "Washer capacity", inp: [["th", "Parts per hour", 40, "/h"], ["tc", "Wash + dry cycle", 120, "s"], ["pb", "Parts per basket / cycle", 4, ""], ["oee", "OEE", 0.85, ""]],
    run(v) { const w = v.th / v.pb * v.tc / 3600, n = Math.ceil(w / v.oee - 1e-9);
      return { out: [["Cycles per hour", v.th / v.pb, "/h", 1], ["Machine-hours per hour", w, "", 2], ["Washers", n, "", 0], ["Utilisation", 100 * w / n, "%", 0]], verdict: "Drying time is usually the longest step – check it with the supplier." }; } },
  meas: { t: "Measuring capability and CMM load", inp: [["T", "Tolerance width T", 30, "µm"], ["U", "Expanded uncertainty U (k = 2)", 4, "µm"], ["tm", "CMM time per part", 12, "min"], ["n", "Measure 1 in n parts", 10, ""], ["th", "Parts per hour", 8, "/h"]],
    run(v) { const r = v.T / v.U, u = v.th / v.n * v.tm / 60;
      return { out: [["Ratio T ÷ U", r, ": 1", 1], ["Acceptance zone after guard band = T − 2U", v.T - 2 * v.U, "µm", 1], ["CMM utilisation = (TH ÷ n)·t_m ÷ 60", 100 * u, "%", 0]],
        verdict: (r >= 10 ? "✓ U ≤ T/10 – good." : r >= 5 ? "◐ U between T/10 and T/5 – acceptable, use guard bands." : "✗ U > T/5 – measuring system not capable for this tolerance.") + (u > 0.8 ? " CMM above 80 % – second CMM or less sampling." : "") }; } },
  dmc: { t: "DataMatrix (ECC 200) size", inp: [["c", "Characters (alphanumeric)", 20, ""], ["cell", "Cell (module) size", 0.3, "mm"], ["qz", "Quiet zone (modules each side)", 2, ""]],
    run(v) { const S = [[10, 3], [12, 6], [14, 10], [16, 16], [18, 25], [20, 31], [22, 43], [24, 52], [26, 64], [32, 91], [36, 127], [40, 169], [44, 214]];
      const s = S.find(([, cap]) => cap >= v.c) || S[S.length - 1];
      return { out: [["Smallest square symbol", s[0], `× ${s[0]} modules (capacity ${s[1]} alphanumeric)`, 0], ["Symbol size = modules·cell", s[0] * v.cell, "mm", 1], ["With quiet zone", (s[0] + 2 * v.qz) * v.cell, "mm", 1]],
        verdict: "Dot-peen on castings: cell ≥ 0.5–1 mm. Laser on machined steel: 0.2–0.4 mm. Reader resolution must give ≥ 3–5 pixels per cell." }; } },
  grip: { t: "Gripper and clamping force", inp: [["m", "Part mass", 12, "kg"], ["a", "Acceleration (incl. stop)", 10, "m/s²"], ["mu", "Friction coefficient μ", 0.12, ""], ["n", "Contact jaws", 2, ""], ["S", "Safety factor", 2, ""], ["fc", "Cutting force (for clamp)", 3000, "N"], ["nc", "Clamps", 2, ""], ["Sc", "Safety factor clamp", 2.5, ""]],
    run(v) { const F = v.m * (G + v.a) * v.S / (v.mu * v.n), Fc = v.Sc * v.fc / (v.mu * v.nc);
      return { out: [["Gripper force per jaw F = m·(g + a)·S ÷ (μ·n)", F, "N", 0], ["Clamp force per clamp = S·F꜀ ÷ (μ·n꜀)", Fc, "N", 0]],
        verdict: "With form-fit jaws (shape holds the part) the force can be much lower. μ on oily steel ≈ 0.1–0.15, rubber pads 0.3–0.5." }; } },
  posit: { t: "Positioner torque check", inp: [["m", "Part + fixture mass", 600, "kg"], ["e", "CoG distance from rotation axis", 80, "mm"], ["h", "CoG distance from tilt axis", 300, "mm"], ["rr", "Rated rotation torque", 1000, "N·m"], ["rt", "Rated tilt torque", 3000, "N·m"]],
    run(v) { const Mr = v.m * G * v.e / 1000, Mt = v.m * G * v.h / 1000;
      return { out: [["Rotation torque M = m·g·e", Mr, "N·m", 0], ["Use", 100 * Mr / v.rr, "%", 0], ["Tilt torque M = m·g·h", Mt, "N·m", 0], ["Use", 100 * Mt / v.rt, "%", 0]],
        verdict: Mr <= v.rr && Mt <= v.rt ? "✓ Inside the ratings." : "✗ Over the rating – move the CoG towards the axes (fixture design, counterweight) or a bigger positioner." }; } },
  tower: { t: "Sheet tower and unmanned hours", inp: [["mat", "Material × thickness combinations", 14, ""], ["fin", "Finished part pallets", 4, ""], ["res", "Reserve", 20, "%"], ["tcs", "Cutting time per sheet", 18, "min"], ["tch", "Sheet change time", 70, "s"], ["tu", "Unmanned period", 10, "h"]],
    run(v) { const pl = Math.ceil((v.mat + v.fin) * (1 + v.res / 100)), sh = Math.ceil(v.tu * 60 / (v.tcs + v.tch / 60));
      return { out: [["Places = (materials + finished)·(1 + reserve)", pl, "", 0], ["Sheets needed for the unmanned period", sh, "", 0], ["Laser utilisation = cut ÷ (cut + change)", 100 * v.tcs / (v.tcs + v.tch / 60), "%", 0]], verdict: "Several sheets of one material can share a place (stack) – check stack height per shelf." }; } },
  chips: { t: "Chip volume and coolant tank", inp: [["q", "Metal removal (average)", 40, "cm³/min"], ["ru", "Cutting share of time", 0.6, ""], ["bf", "Chip bulk factor", 25, ""], ["tu", "Unmanned period", 8, "h"], ["nm", "Machines", 3, ""], ["qf", "Coolant pump flow per machine", 60, "l/min"]],
    run(v) { const lit = v.q * v.tu * 60 * v.ru * v.bf / 1000 * v.nm, tank = 10 * v.qf;
      return { out: [["Chip volume in unmanned period = Q·T·share·bulk·machines", lit, "litres", 0], ["Coolant tank per machine ≥ 10 × pump flow per minute", tank, "litres", 0]], verdict: "Bulk factor: short cast-iron chips ≈ 10–15, broken steel chips 20–30, long steel / aluminium chips 40–50+." }; } },
  // new elements (inputs = tools/fmse/examples/item3_examples.json screw_preload, press_fit, leak_test, vision)
  asm: { t: "Screw preload and press-fit force", inp: [["T", "Tightening torque", 25, "N·m"], ["K", "Nut factor K (friction)", 0.2, ""], ["d", "Screw diameter", 8, "mm"], ["pl", "Proof load of the screw (M8 8.8)", 23500, "N"], ["df", "Press-fit diameter d", 20, "mm"], ["D", "Hub outer diameter D", 40, "mm"], ["L", "Fit length", 25, "mm"], ["dl", "Interference δ (diameter)", 0.02, "mm"], ["E", "Young's modulus", 210000, "MPa"], ["mu", "Friction in the fit μ", 0.12, ""]],
    run(v) { const F = v.T / (v.K * v.d / 1000), p = v.E * v.dl / (2 * v.df) * (1 - (v.df / v.D) ** 2), Fp = p * Math.PI * v.df * v.L * v.mu;
      return { out: [["Preload F = T ÷ (K·d)", F, "N", 0], ["Use of proof load", 100 * F / v.pl, "%", 0], ["Fit pressure p = E·δ ÷ (2d)·(1 − (d/D)²)", p, "MPa", 1], ["Press force F = p·π·d·L·μ", Fp, "N", 0]],
        verdict: (F / v.pl > 0.9 ? "✗ Preload above 90 % of the proof load – not OK." : F / v.pl > 0.8 ? "◐ Preload 80–90 % of the proof load – high." : F / v.pl >= 0.5 ? "✓ Preload 50–80 % of the proof load – OK (rule of thumb, VDI 2230)." : "◐ Preload below 50 % of the proof load – low, joint may loosen.") + " K scatters ± 20–30 % – use torque + angle monitoring. Choose a press with ≥ 1.5 × the press force." }; } },
  leak: { t: "Leak rate and temperature error (pressure decay)", inp: [["V", "Test volume", 0.5, "l"], ["dp", "Pressure drop Δp at the limit", 2.0, "mbar"], ["dt", "Test time Δt", 10, "s"], ["pa", "Absolute test pressure (6 bar g)", 7013, "mbar"], ["dT", "Temperature change during the test", 0.1, "K"], ["TK", "Part temperature", 293.15, "K"]],
    run(v) { const Qr = v.V * v.dp / v.dt, dpT = v.pa * v.dT / v.TK;
      return { out: [["Leak rate Q = V·Δp ÷ Δt", Qr, "mbar·l/s", 3], ["Leak rate ≈ Q·60", Qr * 60, "cm³/min", 2], ["Temperature error Δp_T = p_abs·ΔT ÷ T", dpT, "mbar", 3], ["Temperature error ÷ leak signal", 100 * dpT / v.dp, "%", 0], ["Allowed ΔT for 10 % of the signal = 0.1·Δp·T ÷ p_abs", 0.1 * v.dp * v.TK / v.pa, "K", 4]],
        verdict: dpT >= v.dp ? "✗ NOT OK – temperature trap: this temperature change gives more pressure change than the leak itself. Cool / stabilise the part, longer settle time, or temperature compensation." : dpT > 0.1 * v.dp ? "◐ Marginal – temperature error between 10 % and 100 % of the signal; stabilise the part temperature." : "✓ OK – temperature error ≤ 10 % of the leak signal." }; } },
  vision: { t: "Vision pixel resolution", inp: [["fx", "Field of view X", 120, "mm"], ["fy", "Field of view Y", 90, "mm"], ["px", "Sensor pixels X", 2448, ""], ["py", "Sensor pixels Y", 2048, ""], ["df", "Smallest defect", 0.3, "mm"]],
    run(v) { const pm = Math.max(v.fx / v.px, v.fy / v.py), n = v.df / pm;
      return { out: [["Pixel size = FOV ÷ pixels (worst axis)", pm, "mm", 4], ["Pixels per defect = defect ÷ pixel", n, "px", 1], ["Measurement repeatability ≈ pixel ÷ 10", pm / 10, "mm", 4]],
        verdict: (n >= 3 ? "✓ " : "✗ ") + "Rule: ≥ 3 pixels across the smallest defect for detection (more for measuring). Smaller FOV or more pixels if not met." }; } },
};
export { CALC };   // read by fmse3x.js (deep panel) – same formulas everywhere

/* ================================================================== mount */
let sel = Q.get("feel") && EL.some((e) => e.k === Q.get("feel")) ? Q.get("feel") : "pool";
const CV = {};
export function mount(el) {
  el.innerHTML = `
  <div class="card"><div class="card-head"><h2>3A · The elements of a flexible system – what they do, how to choose and size them</h2>
      <span class="sub">${EL.length} elements · all domains · each linked to its module of the module standard (1E) · click an element</span></div>
    <div class="fe-elmap">${GROUPS.map((g) => `<div class="fe-elg"><h4>${esc(g)}</h4>${EL.filter((e) => e.g === g).map((e) => `<button class="mx-el fe-elb" data-el="${e.k}"><b>${esc(e.mod)}</b> ${esc(e.n)}</button>`).join("")}</div>`).join("")}</div>
    <div id="fe3D"></div>
  </div>

  <div class="card"><div class="card-head"><h2>3B · Which transport / handling? – comparison</h2>
      <span class="sub">★ = low … ★★★★★ = high · investment ★ = cheap · typical values</span></div>
    <div class="fe-scroll"><table class="am-tab"><thead><tr><th>Option</th><th>Route flexibility</th><th>Throughput</th><th>Distance</th><th>Stop accuracy</th><th>Floor / building</th><th>Investment</th><th>Best for</th></tr></thead>
      <tbody>${TRANS.map((r) => `<tr>${r.map((c, i) => `<td>${i ? esc(c) : "<b>" + esc(c) + "</b>"}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="am-note"><b>Rule of thumb:</b> fixed flow + high throughput → conveyor / RGV. Changing routes + medium throughput → AGV / AMR.
      Central store serving many machines → stacker crane. Precision hand-over (± 0.1 mm) never comes from the vehicle – it comes from the
      <b>station</b> (cones, pins, locating units) – see 3C.</p>
  </div>

  <div class="card"><div class="card-head"><h2>3C · Hand-over tolerance stack – will the pallet find its place?</h2>
      <span class="sub">every hand-over between two elements · worst case vs statistical (RSS) · coarse-to-fine catching</span></div>
    <div class="grid2"><div><table class="am-tab fe-calc" id="fe3Stack"></table>
        <div class="fe-row"><button class="mx-el" id="fe3Add">+ contributor</button>
          <label>Capture range of the first guide ± <input type="number" id="fe3Cap" value="12" step="any"> mm</label>
          <label>Final location needed ± <input type="number" id="fe3Fin" value="0.02" step="any"> mm</label></div></div>
      <div id="fe3SRes"></div></div>
  </div>`;
  el.querySelector(".fe-elmap").addEventListener("click", (e) => { const b = e.target.closest("[data-el]"); if (b) { sel = b.dataset.el; drawEl(); } });
  $("fe3D").addEventListener("input", (e) => { const t = e.target; if (t.dataset.v) { CV[cur().calc][t.dataset.v] = +t.value; drawCalc(); } });
  initStack();
  drawEl();
  // 3D–3E + deep element panel (guides + programs) live in fmse3x.js; it follows the 3A selection via the "fe3sel" event
  const deepEl = document.createElement("div"); deepEl.id = "feItem3x"; el.appendChild(deepEl);
  import("./fmse3x.js").then((m) => m.mount(deepEl, sel)).catch((e) => { deepEl.innerHTML = `<div class="card"><p class="fe-no">Deep sections 3X / 3D–3E could not load: ${esc(e.message)}</p></div>`; });
}
const cur = () => EL.find((e) => e.k === sel) || EL[0];

function drawEl() {
  document.querySelectorAll(".fe-elb").forEach((b) => b.classList.toggle("active", b.dataset.el === sel));
  document.dispatchEvent(new CustomEvent("fe3sel", { detail: sel }));   // deep panel (fmse3x.js) follows
  const e = cur(), c = CALC[e.calc];
  if (!CV[e.calc]) { CV[e.calc] = {}; c.inp.forEach(([k, , d]) => { CV[e.calc][k] = d; }); }
  const ul = (a) => `<ul class="am-ul">${a.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  $("fe3D").innerHTML = `<div class="fe-phd"><h3 class="fe-h3">${esc(e.n)} <span class="sub">module ${esc(e.mod)} · group ${esc(e.g)}</span></h3>
    <p>${esc(e.what)}</p>
    <div class="fe-scroll"><table class="am-tab"><thead><tr><th>Type</th><th>How it works</th><th>+ Strengths</th><th>− Weaknesses</th><th>Use when</th></tr></thead>
      <tbody>${e.types.map((r) => `<tr>${r.map((x, i) => `<td>${i ? esc(x) : "<b>" + esc(x) + "</b>"}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    <div class="grid2 eq"><div><h4>Key parameters</h4>${ul(e.params)}<h4>Selection rules</h4>${ul(e.rules)}</div>
      <div><h4>Sizing: ${esc(c.t)}</h4><table class="am-kv fe-calc"><tbody>${c.inp.map(([k, n, , u]) => `<tr><td>${esc(n)}</td><td><input type="number" step="any" data-v="${k}" value="${CV[e.calc][k]}"> ${esc(u)}</td></tr>`).join("")}</tbody></table>
        <div id="fe3COut"></div></div></div>
    <div class="grid2 eq"><div><h4>Interface (module faces)</h4><table class="am-kv"><tbody><tr><td>Mechanical</td><td>${esc(e.iface[0])}</td></tr><tr><td>Signals / data</td><td>${esc(e.iface[1])}</td></tr></tbody></table></div>
      <div><h4>Typical mistakes</h4>${ul(e.mist)}</div></div></div>`;
  drawCalc();
}
function drawCalc() {
  const e = cur(), r = CALC[e.calc].run(CV[e.calc]);
  $("fe3COut").innerHTML = `<table class="am-kv"><tbody>${r.out.map(([n, x, u, d]) => `<tr><td>${esc(n)}</td><td><b>${d < 0 ? esc(u) : f1(x, d) + " " + esc(u)}</b></td></tr>`).join("")}</tbody></table>
    ${r.verdict ? `<p class="am-note">${esc(r.verdict)}</p>` : ""}`;
}

/* ================================================================== 3C tolerance stack */
let ST = STACK.map((r) => [...r]);
function initStack() {
  $("fe3Stack").addEventListener("input", (e) => { const t = e.target; const i = +t.dataset.i; if (t.dataset.f === "n") ST[i][0] = t.value; else ST[i][1] = Math.abs(+t.value || 0); drawStackRes(); });
  $("fe3Stack").addEventListener("click", (e) => { const b = e.target.closest("[data-del]"); if (b) { ST.splice(+b.dataset.del, 1); drawStack(); } });
  $("fe3Add").addEventListener("click", () => { ST.push(["New contributor", 1]); drawStack(); });
  ["fe3Cap", "fe3Fin"].forEach((id) => $(id).addEventListener("input", drawStackRes));
  drawStack();
}
function drawStack() {
  $("fe3Stack").innerHTML = `<thead><tr><th>Contributor</th><th>± mm</th><th></th></tr></thead><tbody>${ST.map(([n, t], i) => `<tr><td><input type="text" data-i="${i}" data-f="n" value="${esc(n)}" style="width:100%"></td><td><input type="number" step="any" data-i="${i}" data-f="t" value="${t}"></td><td><button class="mx-el fe-link" data-del="${i}" aria-label="remove">×</button></td></tr>`).join("")}</tbody>`;
  drawStackRes();
}
function drawStackRes() {
  const wc = ST.reduce((s, [, t]) => s + t, 0), rss = Math.sqrt(ST.reduce((s, [, t]) => s + t * t, 0)), cap = +$("fe3Cap").value || 0, fin = +$("fe3Fin").value || 0.01;
  const st = cap >= wc ? "safe" : cap >= rss ? "risk" : "no";
  const big = [...ST].sort((a, b) => b[1] - a[1])[0];
  $("fe3SRes").innerHTML = `<table class="am-kv"><tbody>
      <tr><td>Worst case = Σ |tᵢ|</td><td><b>± ${f1(wc, 2)} mm</b></td></tr>
      <tr><td>Statistical (RSS) = √Σ tᵢ²</td><td><b>± ${f1(rss, 2)} mm</b> <span class="sub">(all contributors independent, normal)</span></td></tr>
      <tr><td>Capture range of first guide</td><td>± ${f1(cap, 2)} mm → ${st === "safe" ? ok(true, "safe (≥ worst case)") : st === "risk" ? '<span class="fe-no">only statistical – rare misses possible, add monitoring + retry</span>' : ok(false, "", "too small – the pallet will miss")}</td></tr>
      <tr><td>Largest contributor</td><td>${esc(big ? big[0] : "–")} (± ${big ? f1(big[1], 1) : 0} mm) – reduce this first</td></tr></tbody></table>
    <h4>Coarse-to-fine catching (stages)</h4>
    <ol class="am-ul"><li><b>Coarse guides / rollers / funnels</b> catch ± ${f1(Math.max(wc, cap), 1)} mm → bring the error to ≈ ± 2–3 mm</li>
      <li><b>Cones / tapered pins</b> catch ± 2–3 mm → ≈ ± 0.1–0.2 mm</li>
      <li><b>Locating pins / zero-point / Hirth coupling</b> → final ± ${f1(fin, 3)} mm (clamped)</li></ol>
    <p class="am-note">Each stage's capture range must be larger than the error left by the stage before. Rule from this project: ask first <b>"what accuracy does the real vehicle / machine have?"</b>
      – an AGV stops only ± 5–10 mm; precision comes from the station, never from the vehicle.</p>`;
}
