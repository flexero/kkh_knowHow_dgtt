/* APC tab - design of a 2-pallet rotary automatic pallet changer (APC) for the horizontal machining centers.
   Inputs -> sizing calculations with formulas (inertia, servo + gearbox, lift cylinder + hydraulics, zero-point
   clamping, arm, bearing, light curtain distance) -> step chain with timing and animation -> PLC I/O list,
   bill of materials, safety. All defaults are TYPICAL values for a 500 mm pallet class HMC (examples):
   a real design must use the catalogue data of the chosen components. */
(function () {
  const $ = (id) => document.getElementById(id);
  if (!$("tab-apc")) return;
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const f = (v, d = 1) => (Number.isFinite(v) ? (Math.round(v * 10 ** d) / 10 ** d).toLocaleString("en-US", { maximumFractionDigits: d }) : "–");
  const G = 9.81;

  // [key, label, unit, default, note]
  const GROUPS = [
    ["Pallet and load", [
      ["a", "Pallet size X", "mm", 500, "HMC classes: 400 / 500 / 630 mm"],
      ["b", "Pallet size Y", "mm", 500, ""],
      ["mp", "Pallet mass", "kg", 110, "steel / cast iron pallet 500 mm ≈ 100–150 kg"],
      ["mw", "Workpiece + fixture per pallet", "kg", 400, "500-class HMC rating: 500–700 kg"],
      ["e", "Load centre offset from pallet centre", "mm", 50, "worst case, horizontal"],
      ["hc", "Height of the load centre above the pallet", "mm", 250, "tombstone fixture with crankcases"]]],
    ["APC arm and bearing", [
      ["r", "Arm radius (rotation centre → pallet centre)", "mm", 480, "≥ pallet diagonal ÷ 2 + clearance"],
      ["marm", "Arm + partition wall mass", "kg", 180, ""],
      ["secH", "Arm box section height H", "mm", 160, "welded S355 box"],
      ["secB", "Arm box section width B", "mm", 100, ""],
      ["secT", "Arm box wall thickness t", "mm", 10, ""],
      ["dm", "Bearing mean diameter", "mm", 350, "crossed roller bearing"],
      ["mub", "Bearing friction coefficient", "", 0.005, "crossed roller bearing 0.002–0.005"]]],
    ["Rotation drive (servo + gearbox)", [
      ["trot", "Rotation time for 180°", "s", 2.5, "typical 1.5–3 s"],
      ["acc", "Acceleration share of the move", "%", 30, "trapezoid profile"],
      ["i", "Gear ratio (planetary + pinion / ring gear)", "", 200, "e.g. planetary 20 × ring gear 10"],
      ["eta", "Gear efficiency", "", 0.9, ""],
      ["backlash", "Gear backlash", "arcmin", 3, "precision planetary gearbox ≤ 3 arcmin"]]],
    ["Lift (hydraulic cylinder)", [
      ["s", "Lift stroke", "mm", 60, "pallet must clear cones + pull studs"],
      ["tlift", "Lift time (= lower time)", "s", 0.8, ""],
      ["p", "Hydraulic system pressure (lowest working pressure)", "MPa", 10, "decided 2026-11-12: 10 MPa accumulator system (charged 10.8–11.5 MPa), guide 09 §27"],
      ["mcar", "Carriage + rotor (lifted too, not in the bore rule)", "kg", 280, "carriage plate, bearing, hub, ring gear, gearbox + servo, rod – guide 09 §20.2"],
      ["etah", "Pump efficiency", "", 0.85, ""]]],
    ["Clamping in the machine (zero-point modules)", [
      ["nmod", "Zero-point modules per pallet", "", 4, ""],
      ["fmod", "Pull-in force per module", "kN", 20, "spring clamped, hydraulic release (catalogue)"],
      ["prel", "Release pressure of the module", "MPa", 5, "from the catalogue"],
      ["pitch", "Module pitch (square pattern)", "mm", 400, ""],
      ["cap", "Capture range of the taper", "± mm", 1, "how far off the pallet may land"],
      ["fc", "Max cutting force, side load", "N", 4000, "rough milling cast iron, face mill Ø63"],
      ["hcut", "Height of the cutting force above the pallet", "mm", 300, ""],
      ["arap", "Axis acceleration in rapid", "m/s²", 5, ""],
      ["mu", "Friction pallet ↔ receiver", "", 0.15, "steel / steel, oily"],
      ["S", "Safety factor", "", 2.5, ""]]],
    ["Sequence times and safety", [
      ["tpos", "Axes to change position + door open (parallel)", "s", 1.5, ""],
      ["tunc", "Unclamp (hydraulic release)", "s", 0.8, ""],
      ["tcl", "Clamp (springs)", "s", 0.8, ""],
      ["tseat", "Seating check with air", "s", 0.4, ""],
      ["tdoor", "Door close", "s", 1.2, ""],
      ["tstop", "Stop time of the arm after a safety signal", "s", 0.3, "measure on the real machine"],
      ["dlc", "Light curtain resolution", "mm", 14, "finger protection = 14 mm"]]],
    ["Production (link to the twin)", [
      ["tcyc", "Average machining time per pallet", "s", 343.5, "FMS cell product mix"],
      ["nmach", "Number of machining centres", "", 3, ""],
      ["tman", "Change time without APC (load inside the machine)", "s", 120, "operator loads in the machine"]]],
  ];
  const DEF = {}; GROUPS.forEach(([, fs]) => fs.forEach(([k, , , d]) => { DEF[k] = d; }));
  DEF._v = 2;                                // version of the saved state (2 = 10 MPa design)
  let P = { ...DEF };
  try {
    const st = JSON.parse(localStorage.getItem("apcState") || "{}");
    if (!(st._v >= 2)) delete st.p;          // old saved default 6 MPa → new 10 MPa design (decided 2026-11-12)
    Object.assign(P, st, { _v: 2 });
  } catch (e) { /* private window */ }
  let twinChange = null, R = null, T = 0, playing = false, last = 0;

  // example servo classes (generic AC servo motors; real values from the supplier catalogue)
  const SERVOS = [
    { kw: 0.4, tn: 1.3, tmax: 3.8, nmax: 6000, jm: 0.5 }, { kw: 0.75, tn: 2.4, tmax: 7.2, nmax: 6000, jm: 1.5 },
    { kw: 1.5, tn: 4.8, tmax: 14.3, nmax: 5000, jm: 6 }, { kw: 2.0, tn: 6.4, tmax: 19, nmax: 5000, jm: 12 },
    { kw: 3.0, tn: 9.6, tmax: 29, nmax: 4500, jm: 20 }, { kw: 4.5, tn: 14.3, tmax: 43, nmax: 4000, jm: 40 },
    { kw: 7.0, tn: 22, tmax: 66, nmax: 3500, jm: 80 }];
  const BORES = [25, 32, 40, 50, 63, 80, 100, 125, 160, 200];
  const RODS = { 25: 12, 32: 18, 40: 22, 50: 28, 63: 36, 80: 45, 100: 56, 125: 70, 160: 90, 200: 110 };

  // ------------------------------------------------------------------ calculation
  function calc(P) {
    const R = { blocks: [], checks: [] };
    const mpl = P.mp + P.mw, a2b2 = (P.a ** 2 + P.b ** 2) / 1e6;            // m²
    const r = P.r / 1000, e = P.e / 1000;
    // 1 inertia
    const Jp = P.mp * (r * r + a2b2 / 12), Jw = P.mw * ((r + e) ** 2 + a2b2 / 12);
    const L = (2 * P.r + 200) / 1000, w = P.secB / 1000, Ja = P.marm * (L * L + w * w) / 12;
    const J = 2 * (Jp + Jw) + Ja;
    // 2 rotation
    const th = Math.PI, ta = P.trot * P.acc / 100, om = th / (P.trot - ta), al = om / ta;
    const Fax = (2 * mpl + P.marm) * G;
    const Tacc = J * al, Tfr = P.mub * Fax * P.dm / 2000, Tl = Tacc + Tfr;
    const Tm = Tl / (P.i * P.eta), nm = om * 60 / (2 * Math.PI) * P.i, Ppk = Tl * om;
    const Jref = J / (P.i * P.i) * 1e4;                                          // kg·cm² at the motor
    // smallest servo with enough peak torque and speed AND inertia ratio <= 10; else the smallest that fits torque/speed
    const fits = SERVOS.map((sv) => ({ ...sv, need: (Tm + sv.jm * 1e-4 * al * P.i) * 1.2, ratio: Jref / sv.jm }))
      .filter((sv) => sv.tmax >= sv.need && sv.nmax >= nm);
    const servo = fits.find((sv) => sv.ratio <= 10) || fits[0] || null;
    const dpos = P.r * P.backlash / 60 * Math.PI / 180;
    // 3 lift
    const mlift = 2 * mpl + P.marm, s = P.s / 1000, al_l = 4 * s / (P.tlift ** 2);
    const Fl = mlift * G * (1 + al_l / G) * 1.1, Freq = 1.25 * Fl;
    const Dmin = Math.sqrt(4 * Freq / (Math.PI * P.p));
    const D = BORES.find((x) => x >= Dmin) || null;
    const A = D ? Math.PI * D * D / 4 : NaN, Fact = P.p * A, v = P.s / P.tlift;
    const Q = A * v * 60 / 1e6, Pp = P.p * Q / (60 * P.etah);
    // real lifted mass (carriage + rotor added) at the lowest working pressure: cylinder η 0.95 + line/valve losses
    // (laminar line ∝ Q, 2 valves ∝ Q², meter-out throttle ≈ 0.3 MPa – same model as guide 09 §20.2 / guide 25 §14.2)
    const mreal = mlift + (P.mcar || 0), Freal = mreal * G * (1 + al_l / G) * 1.1;
    const dpLoss = 0.146 * Q / 8.836 + 2 * 0.076 * (Q / 14.03) ** 2 + 0.3;
    const pNeedReal = D ? Freal / (A * 0.95) + dpLoss : NaN, resReal = D ? (P.p - dpLoss) * A * 0.95 / Freal - 1 : NaN;
    // 4 clamping
    const FN = P.nmod * P.fmod * 1000 + mpl * G;
    const Flat = Math.max(P.fc, P.mw * P.arap);
    const slip = P.S * Flat / P.mu / FN;
    const Mt = Math.max(P.fc * P.hcut, P.mw * P.arap * P.hc) / 1000;
    const Mres = (P.nmod / 2) * P.fmod * 1000 * P.pitch / 1000 + mpl * G * P.pitch / 2000;
    const tilt = P.S * Mt / Mres;
    // 5 arm + bearing
    const I = (P.secB * P.secH ** 3 - (P.secB - 2 * P.secT) * (P.secH - 2 * P.secT) ** 3) / 12;  // mm^4
    const Fa = mpl * G, Mb = Fa * P.r, sig = Mb * (P.secH / 2) / I, def = Fa * P.r ** 3 / (3 * 210000 * I);
    const FaB = (2 * mpl + P.marm) * G, Mk = P.mw * G * (P.r + P.e) / 1000;
    // 6 change time + capacity
    const steps = [
      ["Axes to change position, door open", P.tpos], ["Unclamp pallet in the machine", P.tunc], ["Lift arm", P.tlift],
      ["Rotate 180°", P.trot], ["Lower arm", P.tlift], ["Clamp pallet", P.tcl], ["Seating check (air)", P.tseat], ["Door close", P.tdoor]];
    const tch = steps.reduce((x, s) => x + s[1], 0);
    const cap = (t) => P.nmach * 3600 / (P.tcyc + t);
    // 7 light curtain (ISO 13855)
    const Kv = 2000, C = Math.max(0, 8 * (P.dlc - 14)), Sd = Kv * (P.tstop + 0.02) + C;
    // 8 geometry: swing circle and the gap between the two pallets (the partition wall must fit in it)
    const diag = Math.hypot(P.a, P.b), swing = 2 * P.r + diag, gap = 2 * P.r - P.a;

    Object.assign(R, { mpl, J, Jp, Jw, Ja, ta, om, al, Fax, Tacc, Tfr, Tl, Tm, nm, Ppk, Jref, servo, dpos, mlift, al_l, Fl, Freq, Dmin, D, A, Fact, v, Q, Pp, mreal, Freal, dpLoss, pNeedReal, resReal,
      FN, Flat, slip, Mt, Mres, tilt, I, Fa, Mb, sig, def, FaB, Mk, steps, tch, cap, Sd, C, L, diag, swing, gap });
    const ok = (good, warn) => (good ? "ok" : warn ? "warn" : "bad");
    R.checks = [
      ["Servo found", ok(!!servo), servo ? `${servo.kw} kW class, needs ${f(servo.need, 1)} N·m of ${servo.tmax}` : "no servo in the list – longer rotation time or higher ratio"],
      ["Inertia ratio load : motor", ok(servo && servo.ratio <= 10, servo && servo.ratio <= 20), servo ? `${f(servo.ratio, 1)} : 1 (aim ≤ 10)` : "–"],
      ["Arm position error from backlash", ok(dpos <= P.cap * 0.5, dpos <= P.cap), `${f(dpos, 2)} mm vs capture ±${P.cap} mm`],
      ["Lift cylinder", ok(!!D && Freq / Fact <= 0.9, !!D), D ? `Ø${D} mm, used ${f(Freq / Fact * 100, 0)} %` : "bigger than Ø200 – raise pressure"],
      ["Lift – real mass at the lowest pressure", ok(resReal >= 0.25, resReal >= 0), D ? `${f(mreal, 0)} kg: needs ${f(pNeedReal, 2)} MPa at the HPU (${P.p} MPa) → reserve ${f(resReal * 100, 0)} % (aim 25 %; < 25 % = start interlock + low-pressure alarm, guide 09 §20.2)` : "–"],
      ["Clamping: no slipping", ok(slip <= 1, slip <= 1.2), `${f(slip * 100, 0)} % used`],
      ["Clamping: no tilting", ok(tilt <= 1, tilt <= 1.2), `${f(tilt * 100, 0)} % used`],
      ["Module release pressure", ok(P.prel <= P.p * 0.9, P.prel <= P.p), `${P.prel} MPa needed, system ${P.p} MPa`],
      ["Arm bending stress", ok(sig <= 80, sig <= 120), `${f(sig, 0)} N/mm² (aim ≤ 80 for S355 with fatigue)`],
      ["Arm deflection", ok(def <= P.cap * 0.3, def <= P.cap), `${f(def, 3)} mm (taper catches ±${P.cap} mm)`],
      ["Gap between the pallets", ok(gap >= 150, gap >= 80), `2r − a = ${f(gap, 0)} mm for the partition wall (aim ≥ 150)`],
      ["Swing circle", "ok", `Ø ${f(swing, 0)} mm = 2r + pallet diagonal ${f(diag, 0)} mm – the guard and the machine column must be outside it`],
    ];
    return R;
  }

  // ------------------------------------------------------------------ render
  function inputs() {
    $("apcInputs").innerHTML = GROUPS.map(([g, fs]) => `<fieldset class="apc-fs"><legend>${esc(g)}</legend>${fs.map(([k, l, u, d, n]) =>
      `<label class="apc-f" title="${esc(n || "")}"><span>${esc(l)}${n ? ` <i class="muted">${esc(n)}</i>` : ""}</span>
        <span class="apc-in"><input type="number" step="any" data-k="${k}" value="${P[k]}" aria-label="${esc(l)}"${P[k] !== d ? ' class="chg"' : ""}><em>${esc(u)}</em></span></label>`).join("")}</fieldset>`).join("");
  }
  const cls = { ok: "apc-ok", warn: "apc-warn", bad: "apc-bad" };
  function render() {
    R = calc(P);
    const tw = twinChange;
    const kp = [
      ["Pallet change time", f(R.tch, 1) + " s", `twin uses ${tw == null ? "…" : tw + " s"} now`],
      ["Rotation servo", R.servo ? R.servo.kw + " kW" : "none", `motor ${f(R.Tm, 2)} N·m at ${f(R.nm, 0)} rpm`],
      ["Lift cylinder", R.D ? "Ø" + R.D + " mm" : "> Ø200", `${f(R.Freq / 1000, 1)} kN needed at ${P.p} MPa`],
      ["Hydraulic pump", f(R.Q, 1) + " L/min", `≈ ${f(R.Pp, 2)} kW (without accumulator)`],
      ["Clamping", f(Math.max(R.slip, R.tilt) * 100, 0) + " % used", `${P.nmod} × ${P.fmod} kN zero-point modules`],
      ["Cell output", f(R.cap(R.tch), 2) + " pallets/h", `without APC: ${f(R.cap(P.tman), 2)} pallets/h`],
    ];
    $("apcKpis").innerHTML = kp.map(([l, v, n]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="note">${esc(n)}</div></div>`).join("");
    $("apcChecks").innerHTML = R.checks.map(([l, s, t]) => `<div class="apc-chk ${cls[s]}"><b>${s === "ok" ? "✓" : s === "warn" ? "!" : "✕"}</b><span>${esc(l)}</span><span class="muted">${esc(t)}</span></div>`).join("");
    formulas(); steps(); bom(); io(); safety(); twinCard();
    if (window.apc3d && typeof window.apc3d.rebuild === "function") window.apc3d.rebuild(P, R);   // id="apc3d" makes window.apc3d the <div> until apc3d.js has loaded
    T = Math.min(T, R.tch); draw();
  }

  function blk(title, rows, note) {
    return `<div class="apc-blk"><h3>${title}</h3><div class="gc-formula">${rows.join("\n")}</div>${note ? `<p class="hint">${note}</p>` : ""}</div>`;
  }
  function formulas() {
    const r = R, sv = r.servo;
    $("apcCalc").innerHTML = [
      blk("1. Masses and moment of inertia (both pallets loaded = worst case)", [
        `Loaded pallet      m = pallet + load = ${P.mp} + ${P.mw} = <b>${f(r.mpl, 0)} kg</b>`,
        `Pallet             J = m·(r² + (a²+b²)/12) = ${P.mp}·(${P.r / 1000}² + (${P.a / 1000}²+${P.b / 1000}²)/12) = ${f(r.Jp, 1)} kg·m²`,
        `Load (offset e)    J = m·((r+e)² + (a²+b²)/12) = ${P.mw}·(${(P.r + P.e) / 1000}² + …) = ${f(r.Jw, 1)} kg·m²`,
        `Arm (bar L=${f(r.L, 2)} m) J = m·(L²+B²)/12 = ${P.marm}·(${f(r.L, 2)}² + ${P.secB / 1000}²)/12 = ${f(r.Ja, 1)} kg·m²`,
        `Total              J = 2·(${f(r.Jp, 1)} + ${f(r.Jw, 1)}) + ${f(r.Ja, 1)} = <b>${f(r.J, 1)} kg·m²</b>`]),
      blk("2. Rotation drive: servo motor + gearbox", [
        `Motion profile     θ = 180° = π rad, t = ${P.trot} s, acceleration time ta = ${P.acc}% · t = ${f(r.ta, 2)} s`,
        `Max speed          ω = θ / (t − ta) = π / ${f(P.trot - r.ta, 2)} = ${f(r.om, 2)} rad/s (${f(r.om * 30 / Math.PI, 1)} rpm at the arm)`,
        `Acceleration       α = ω / ta = ${f(r.om, 2)} / ${f(r.ta, 2)} = ${f(r.al, 2)} rad/s²`,
        `Acceleration torque T = J·α = ${f(r.J, 1)} · ${f(r.al, 2)} = ${f(r.Tacc, 0)} N·m`,
        `Bearing friction   T = μ·F·dm/2 = ${P.mub} · ${f(r.Fax, 0)} N · ${P.dm / 2000} m = ${f(r.Tfr, 1)} N·m`,
        `Torque at the arm  T = ${f(r.Tacc, 0)} + ${f(r.Tfr, 1)} = <b>${f(r.Tl, 0)} N·m</b>     peak power P = T·ω = ${f(r.Ppk / 1000, 2)} kW`,
        `Motor torque       Tm = T / (i·η) = ${f(r.Tl, 0)} / (${P.i}·${P.eta}) = <b>${f(r.Tm, 2)} N·m</b>`,
        `Motor speed        n = ω·60/(2π)·i = ${f(r.om, 2)}·60/(2π)·${P.i} = <b>${f(r.nm, 0)} rpm</b>`,
        `Inertia at motor   J/i² = ${f(r.Jref, 2)} kg·cm²` + (sv ? `   → servo ${sv.kw} kW: Tmax ${sv.tmax} N·m ≥ 1.2·(Tm + Jm·α·i) = ${f(sv.need, 1)} N·m, ratio ${f(sv.ratio, 1)}:1` : "   → no servo in the example list fits"),
        `Arm position error  Δ = r · backlash = ${P.r} mm · ${P.backlash}′ = <b>${f(r.dpos, 2)} mm</b>  (the taper corrects it if < ±${P.cap} mm)`],
        "The servo only brings the pallet near its place. The exact position (repeatability ≈ 0.002–0.005 mm) comes from the taper and face contact of the zero-point modules, not from the arm."),
      blk("3. Lift cylinder and hydraulic unit", [
        `Lifted mass        m = 2·${f(r.mpl, 0)} + ${P.marm} = ${f(r.mlift, 0)} kg`,
        `Lift acceleration  a = 4·s/t² = 4·${P.s / 1000}/${P.tlift}² = ${f(r.al_l, 2)} m/s²`,
        `Force              F = m·g·(1 + a/g)·1.1 (guides) = <b>${f(r.Fl / 1000, 1)} kN</b>,  with 25 % margin ${f(r.Freq / 1000, 1)} kN`,
        `Bore               D = √(4F/(π·p)) = √(4·${f(r.Freq, 0)}/(π·${P.p})) = ${f(r.Dmin, 1)} mm → standard <b>Ø${r.D ?? "–"} mm</b>, rod Ø${r.D ? RODS[r.D] : "–"} mm`,
        `Real force         F = p·A = ${P.p} · ${f(r.A, 0)} mm² = ${f(r.Fact / 1000, 1)} kN`,
        `Oil flow           Q = A·v = ${f(r.A, 0)} mm² · ${f(r.v, 0)} mm/s · 60/10⁶ = <b>${f(r.Q, 1)} L/min</b>`,
        `Pump power         P = p·Q / (60·η) = ${P.p}·${f(r.Q, 1)} / (60·${P.etah}) = <b>${f(r.Pp, 2)} kW</b>  (without accumulator)`,
        `Real lifted mass   m = ${f(r.mlift, 0)} + ${P.mcar || 0} (carriage + rotor) = ${f(r.mreal, 0)} kg → F = ${f(r.Freal / 1000, 1)} kN`,
        `Pressure needed    p = F/(A·0.95) + losses = ${f(r.Freal, 0)}/(${f(r.A, 0)}·0.95) + ${f(r.dpLoss, 2)} = <b>${f(r.pNeedReal, 2)} MPa</b> ${r.pNeedReal <= P.p ? "≤" : "> (too low!)"} ${P.p} MPa → reserve ${f(r.resReal * 100, 0)} %`],
        "The bore rule uses the page mass (2 pallets + arm) with 25 % margin. The real lifted mass also includes the carriage and the rotor: with the example values (Ø50/28 at 10 MPa) the reserve is only ≈ 7 %, so the accumulator must keep ≥ 10 MPa during the lift (start interlock ≥ 10.7 MPa, alarm < 10.0 MPa – guide 09 §20.2, §27). The same hydraulic unit releases the zero-point modules (reduced to 5 MPa) and clamps the B-table. An accumulator stores oil for the short APC moves, so a small pump is enough."),
      blk("4. Clamping the pallet in the machine", [
        `Clamp force        FN = n·F_module + weight = ${P.nmod}·${P.fmod} kN + ${f(r.mpl * G / 1000, 1)} kN = <b>${f(r.FN / 1000, 1)} kN</b>`,
        `Side load          F = max(cutting force, m·a_rapid) = max(${P.fc}, ${P.mw}·${P.arap}) = ${f(r.Flat, 0)} N`,
        `No slipping        S·F/μ ≤ FN → ${P.S}·${f(r.Flat, 0)}/${P.mu} = ${f(P.S * r.Flat / P.mu / 1000, 1)} kN ≤ ${f(r.FN / 1000, 1)} kN → <b>${f(r.slip * 100, 0)} % used</b>`,
        `Tilting moment     M = max(Fc·h_cut, m·a·h_load) = ${f(r.Mt, 0)} N·m`,
        `Holding moment     M = (n/2)·F_module·pitch + weight·pitch/2 = ${f(r.Mres, 0)} N·m`,
        `No tilting         S·M ≤ M_hold → ${f(P.S * r.Mt, 0)} ≤ ${f(r.Mres, 0)} → <b>${f(r.tilt * 100, 0)} % used</b>`],
        "Zero-point modules are clamped by springs (they stay clamped without oil = safe if the power fails) and opened with oil pressure. The taper also carries the side load, so the friction check is on the safe side."),
      blk("5. Arm and slewing bearing", [
        `Load at arm end    F = ${f(r.mpl, 0)} kg · g = ${f(r.Fa, 0)} N at r = ${P.r} mm`,
        `Box section        I = (B·H³ − (B−2t)·(H−2t)³)/12 = ${f(r.I / 1e4, 0)} cm⁴`,
        `Bending stress     σ = F·r·(H/2)/I = <b>${f(r.sig, 0)} N/mm²</b>`,
        `Deflection         δ = F·r³/(3·E·I) = <b>${f(r.def, 3)} mm</b>  (E = 210 000 N/mm²)`,
        `Bearing, axial     Fa = (2·${f(r.mpl, 0)} + ${P.marm})·g = ${f(r.FaB / 1000, 1)} kN`,
        `Bearing, tilting   Mk = load·g·(r+e) (one pallet full, one empty) = <b>${f(r.Mk / 1000, 2)} kN·m</b>  → choose static rating M0 ≥ 2·Mk = ${f(2 * r.Mk / 1000, 2)} kN·m`,
        `Swing circle       Ø = 2r + √(a²+b²) = 2·${P.r} + ${f(r.diag, 0)} = <b>${f(r.swing, 0)} mm</b>   gap between pallets 2r − a = ${f(r.gap, 0)} mm`]),
      blk("6. Change time and output of the FMS cell", [
        r.steps.map((s) => `${s[0].padEnd(36, " ")} ${f(s[1], 1)} s`).join("\n"),
        `Pallet change time t = Σ = <b>${f(r.tch, 1)} s</b>`,
        `Cell output        = n · 3600 / (t_machining + t_change) = ${P.nmach}·3600/(${P.tcyc} + ${f(r.tch, 1)}) = <b>${f(r.cap(r.tch), 2)} pallets/h</b>`,
        `Without APC        = ${P.nmach}·3600/(${P.tcyc} + ${P.tman}) = ${f(r.cap(P.tman), 2)} pallets/h   → APC gives +${f((r.cap(r.tch) / r.cap(P.tman) - 1) * 100, 0)} %`,
        `Spindle time share = ${P.tcyc}/(${P.tcyc} + ${f(r.tch, 1)}) = ${f(P.tcyc / (P.tcyc + r.tch) * 100, 1)} %`]),
    ].join("");
  }

  const SEQ = [
    ["0", "NC program calls the pallet change (e.g. M60)", "NC → PLC: M-code strobe", "PLC reads the M code", "spindle stopped, coolant off"],
    ["1", "Axes to change position, B = 0°, door open", "NC moves X/Y/Z/B · %Q20.4 DoorOpen", "NC 'in position' + %I21.1 APCDoorOpen", "load-station door closed, light curtain free"],
    ["2", "Unclamp the pallet in the machine", "%Q20.2 Unclamp valve (oil → modules)", "%I20.7 pressure switch 'unclamped'", "arm down, both pallets present"],
    ["3", "Lift the arm with both pallets", "%Q20.0 Lift-up valve", "%I20.0 'arm up' sensor", "unclamped, operator outside (F-DI)"],
    ["4", "Rotate 180°", "servo enable + positioning order (PROFINET)", "servo 'in position' + %I20.3 '180°' sensor", "arm up, STO not active"],
    ["5", "Lower the arm", "%Q20.1 Lift-down valve", "%I20.1 'arm down' sensor", "position sensor OK"],
    ["6", "Clamp the new pallet", "%Q20.2 off (oil out → springs clamp)", "%I20.6 pressure switch 'clamped'", "arm down"],
    ["7", "Seating check: air through the receiver nozzles", "%Q20.3 seating air ON", "%I21.0 air pressure switch (gap < 0.02 mm)", "else ALARM 'pallet seating'"],
    ["8", "Close the door, report FIN to the NC", "%Q20.5 DoorClose · FIN signal", "%I21.2 APCDoorClosed", "→ NC continues with the next part"],
  ];
  function steps() {
    const tm = [0, ...R.steps.map((s) => s[1])];
    $("apcSeq").innerHTML = `<thead><tr><th>Step</th><th>Action</th><th>PLC output / command</th><th>Step is done when</th><th>Interlock (condition)</th><th>Time</th></tr></thead><tbody>` +
      SEQ.map((s, i) => `<tr data-step="${i}"><td><b>${s[0]}</b></td><td>${esc(s[1])}</td><td class="mono">${esc(s[2])}</td><td class="mono">${esc(s[3])}</td><td class="muted">${esc(s[4])}</td><td>${i ? f(tm[i], 1) + " s" : "–"}</td></tr>`).join("") + "</tbody>";
  }

  function bom() {
    const r = R, sv = r.servo;
    const rows = [
      ["Pallet", 3, `${P.a} × ${P.b} mm, ${P.mp} kg, flatness ≤ 0.01 mm, M16 grid or T-slots, ${P.nmod} pull studs`, "2 on the APC + 1 spare for fixture setting"],
      ["Zero-point clamping module (machine table)", P.nmod, `pull-in ${P.fmod} kN each, spring clamp, release ${P.prel} MPa, repeatability ≤ 0.005 mm, air seating check`, "e.g. modules from clamping suppliers (catalogue)"],
      ["Locating cones (load station)", P.nmod, "taper cones, no clamping, pallet rests during loading", ""],
      ["APC arm with partition wall", 1, `welded S355 box ${P.secH}×${P.secB}×${P.secT} mm, r = ${P.r} mm, ${P.marm} kg incl. wall; σ = ${f(r.sig, 0)} N/mm², δ = ${f(r.def, 3)} mm`, "stress relieved, machined after welding"],
      ["Slewing bearing (crossed roller)", 1, `Fa = ${f(r.FaB / 1000, 1)} kN, Mk = ${f(r.Mk / 1000, 2)} kN·m, M0 ≥ ${f(2 * r.Mk / 1000, 2)} kN·m, dm ≈ ${P.dm} mm`, "with integrated ring gear if possible"],
      ["Servo motor + drive (STO)", 1, sv ? `${sv.kw} kW class, Tn ${sv.tn} / Tmax ${sv.tmax} N·m, ${sv.nmax} rpm, absolute encoder, brake` : "no fit – change inputs", "drive on PROFINET (PROFIdrive positioning)"],
      ["Planetary gearbox + pinion", 1, `i = ${P.i}, backlash ≤ ${P.backlash} arcmin, torque at the arm ≥ ${f(r.Tl * 1.5, 0)} N·m (×1.5 shock), at the motor ${f(r.Tm, 2)} N·m`, ""],
      ["Lift cylinder (hydraulic) + guide column", 1, `Ø${r.D ?? "–"}/${r.D ? RODS[r.D] : "–"} mm, stroke ${P.s} mm, ${P.p} MPa, with end cushioning`, "guide column takes side forces"],
      ["Hydraulic power unit", 1, `${P.p} MPa minimum: without accumulator ${f(r.Q, 1)} L/min, motor ≈ ${f(Math.max(0.75, r.Pp * 1.3), 2)} kW; recommended: 4 cm³/rev pump + 1.5 kW motor + 4 L accumulator charged 10.8–11.5 MPa, relief 13 MPa (guide 09 §27)`, "shared with zero-point release and B-table clamp"],
      ["Solenoid valves 4/3 or 4/2", 3, "lift up/down, machine clamp/unclamp, seating air (5/2 pneumatic)", "with manual override for service"],
      ["Pressure switches", 2, "unclamped / clamped (hydraulic), 1 air pressure switch for seating check", ""],
      ["Inductive sensors M12", 6, "arm up, arm down, arm 0°, arm 180°, pallet present machine, pallet present station", "IO-Link versions give diagnostics"],
      ["Safety: door switch with guard locking", 2, "machine APC door + load-station door, ISO 14119", "PL d"],
      ["Safety light curtain (type 4)", 1, `resolution ${P.dlc} mm, mounted ≥ ${f(r.Sd, 0)} mm from the danger zone`, "ISO 13855"],
      ["Guard around the APC", 1, `fixed guard outside the swing circle Ø ${f(r.swing, 0)} mm + load-station door`, "chip and coolant tight towards the machine"],
      ["Operator panel at load station", 1, "'pallet ready' button, emergency stop, stack light", ""],
    ];
    R.bom = rows;
    $("apcBom").innerHTML = `<thead><tr><th>Element</th><th>Qty</th><th>Specification (from the calculation)</th><th>Note</th></tr></thead><tbody>` +
      rows.map((x) => `<tr><td><b>${esc(x[0])}</b></td><td>${x[1]}</td><td>${esc(x[2])}</td><td class="muted">${esc(x[3])}</td></tr>`).join("") + "</tbody>";
  }

  const IO = [
    ["%I20.0", "ArmUp", "DI", "inductive sensor"], ["%I20.1", "ArmDown", "DI", "inductive sensor"], ["%I20.2", "Arm0deg", "DI", "inductive sensor"],
    ["%I20.3", "Arm180deg", "DI", "inductive sensor"], ["%I20.4", "PalletInMachine", "DI", "inductive sensor"], ["%I20.5", "PalletAtStation", "DI", "inductive sensor"],
    ["%I20.6", "MachineClamped", "DI", "pressure switch"], ["%I20.7", "MachineUnclamped", "DI", "pressure switch"], ["%I21.0", "SeatingAirOK", "DI", "air pressure switch"],
    ["%I21.1", "APCDoorOpen", "DI", "limit switch"], ["%I21.2", "APCDoorClosed", "F-DI", "safety switch with guard locking"],
    ["%I21.3", "StationDoorClosed", "F-DI", "safety switch"], ["%I21.4", "LightCurtainFree", "F-DI", "OSSD of the light curtain"], ["%I21.5", "OperatorReady", "DI", "push button"],
    ["%Q20.0", "LiftUpValve", "DQ", "solenoid 24 V"], ["%Q20.1", "LiftDownValve", "DQ", "solenoid 24 V"], ["%Q20.2", "UnclampValve", "DQ", "solenoid (oil to the modules)"],
    ["%Q20.3", "SeatingAir", "DQ", "pneumatic valve"], ["%Q20.4", "DoorOpen", "DQ", "door drive"], ["%Q20.5", "DoorClose", "DQ", "door drive"],
    ["%Q21.0", "ServoSTO", "F-DQ", "safe torque off of the servo drive"], ["%Q21.1", "StationLamp", "DQ", "stack light"],
    ["PROFINET", "Servo drive", "telegram", "PROFIdrive positioning: target 0°/180°, in position, fault"],
    ["NC ↔ PLC", "M60 / FIN", "signals", "M-code strobe from the NC, FIN back when the change is done"],
  ];
  function io() {
    $("apcIO").innerHTML = `<thead><tr><th>Address</th><th>Symbol</th><th>Type</th><th>Device</th></tr></thead><tbody>` +
      IO.map((x) => `<tr><td class="mono">${x[0]}</td><td class="mono">${x[1]}</td><td><span class="plc-ty ${x[2].replace("F-", "")}">${x[2]}</span></td><td class="muted">${esc(x[3])}</td></tr>`).join("") + "</tbody>";
  }
  function safety() {
    $("apcSafety").innerHTML = `<div class="gc-formula">Light curtain safety distance (ISO 13855):
S = K·(t_stop + t_response) + C = ${2000}·(${P.tstop} + 0.02) + ${f(R.C, 0)} = <b>${f(R.Sd, 0)} mm</b>
K = 2000 mm/s (hand speed), C = 8·(d − 14) = 8·(${P.dlc} − 14) for resolution d = ${P.dlc} mm</div>
      <ul class="apc-list">
        <li>Arm rotation only when the <b>load-station door is closed</b> and the <b>light curtain is free</b> (F-DI, PL d per ISO 13849-1).</li>
        <li>Servo stop with <b>STO</b> (safe torque off) + holding brake; hydraulic lift with a <b>pilot-operated check valve</b> so the arm cannot fall.</li>
        <li>Zero-point modules clamp with <b>springs</b>: the pallet stays clamped if oil pressure is lost.</li>
        <li>Machine door with <b>guard locking</b> (ISO 14119); machining-centre safety rules: ISO 16090-1.</li>
        <li><b>Seating check</b> with air: no cycle start if a chip lies under the pallet (wrong position = scrap or crash).</li>
        <li>Chip protection: covers over the cones, air blow-off of the receiver before clamping.</li>
      </ul>`;
  }
  function twinCard() {
    const b = $("apcApply");
    b.textContent = `Use ${f(R.tch, 1)} s in the twin`;
    $("apcTwin").innerHTML = twinChange == null ? "Twin value not loaded yet." :
      `The twin now uses <b>${twinChange} s</b> per pallet change on the HMCs. Your design: <b>${f(R.tch, 1)} s</b> →
       cell output ${f(R.cap(twinChange), 2)} → <b>${f(R.cap(R.tch), 2)}</b> pallets/h (machining time ${P.tcyc} s).`;
  }

  // ------------------------------------------------------------------ animation (top + side view)
  function stateAt(t) {
    const st = R.steps; let acc = 0, k = 0;
    for (; k < st.length; k++) { if (t < acc + st[k][1]) break; acc += st[k][1]; }
    const u = k < st.length ? (t - acc) / st[k][1] : 1;
    let lift = 0, ang = 0, door = 0, clamp = 1, air = false;
    // k: 0 pos+door, 1 unclamp, 2 lift, 3 rotate, 4 lower, 5 clamp, 6 seat, 7 door close
    door = k === 0 ? u : k >= 7 ? (k === 7 ? 1 - u : 0) : 1;
    clamp = k === 0 ? 1 : k === 1 ? 1 - u : k >= 2 && k <= 4 ? 0 : k === 5 ? u : 1;
    lift = k < 2 ? 0 : k === 2 ? u : k === 3 ? 1 : k === 4 ? 1 - u : 0;
    if (k === 3) {   // trapezoid profile
      const tt = u * P.trot, ta = R.ta, tr = P.trot, om = R.om, al = R.al;
      let th;
      if (tt < ta) th = 0.5 * al * tt * tt;
      else if (tt < tr - ta) th = 0.5 * al * ta * ta + om * (tt - ta);
      else { const d = tr - tt; th = Math.PI - 0.5 * al * d * d; }
      ang = th;
    } else ang = k > 3 ? Math.PI : 0;
    air = k === 6;
    return { k, u, lift, ang, door, clamp, air };
  }
  function draw() {
    if (!R) return;
    const s = stateAt(T), W = 640, cx = 320, cy = 150, rp = 80, sc = rp / P.r;
    const pa = P.a * sc, pb = P.b * sc;
    const pos = (base) => [cx + rp * Math.cos(base + s.ang), cy - rp * Math.sin(base + s.ang)];
    const [ax, ay] = pos(Math.PI), [bx, by] = pos(0);
    const pal = (x, y, lbl, cl) => `<g transform="translate(${x},${y}) rotate(${-s.ang * 180 / Math.PI})"><rect x="${-pa / 2}" y="${-pb / 2}" width="${pa}" height="${pb}" rx="4" class="apc-pal ${cl}"/>
      ${[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => `<circle cx="${i * P.pitch * sc / 2}" cy="${j * P.pitch * sc / 2}" r="4" class="apc-stud"/>`).join("")}
      <text y="4" class="apc-t c">${lbl}</text></g>`;
    const wall = `<line x1="${cx + 70 * Math.cos(s.ang + Math.PI / 2)}" y1="${cy - 70 * Math.sin(s.ang + Math.PI / 2)}" x2="${cx - 70 * Math.cos(s.ang + Math.PI / 2)}" y2="${cy + 70 * Math.sin(s.ang + Math.PI / 2)}" class="apc-wall"/>`;
    const top = `<svg viewBox="0 0 ${W} 300" class="apc-svg" aria-label="Top view of the pallet changer">
      <rect x="8" y="10" width="${cx - 24}" height="280" rx="8" class="apc-mach"/><text x="20" y="30" class="apc-t">MACHINE (work area)</text>
      <rect x="40" y="${cy - 30}" width="46" height="60" rx="4" class="apc-spin"/><text x="63" y="${cy + 46}" class="apc-t c">spindle</text>
      <rect x="${cx + 16}" y="10" width="${W - cx - 24}" height="280" rx="8" class="apc-stn"/><text x="${W - 20}" y="30" class="apc-t r">LOAD STATION (operator)</text>
      <line x1="${W - 14}" y1="40" x2="${W - 14}" y2="270" class="apc-lc"/><text x="${W - 22}" y="285" class="apc-t r">light curtain</text>
      <circle cx="${cx - rp}" cy="${cy}" r="${rp * 0.12}" class="apc-recv ${s.clamp > 0.5 ? "cl" : ""}"/><circle cx="${cx + rp}" cy="${cy}" r="${rp * 0.12}" class="apc-recv"/>
      <line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" class="apc-arm"/>${wall}
      ${pal(ax, ay, "A", "a")}${pal(bx, by, "B", "b")}
      <circle cx="${cx}" cy="${cy}" r="14" class="apc-hub"/>
      <rect x="${cx - 8}" y="10" width="16" height="${18 + 50 * (1 - s.door)}" class="apc-door"/><text x="${cx}" y="${s.door > 0.5 ? 26 : 92}" class="apc-t c" style="font-size:10px">door</text>
    </svg>`;
    // side view
    const yb = 150, lp = s.lift * 26, xA = cx + rp * Math.cos(Math.PI + s.ang) * 1.1, xB = cx + rp * Math.cos(s.ang) * 1.1;
    const sidePal = (x, lbl, cl) => `<rect x="${x - pa * 0.55}" y="${yb - 42 - lp}" width="${pa * 1.1}" height="16" rx="3" class="apc-pal ${cl}" opacity=".9"/>
      <rect x="${x - pa * 0.4}" y="${yb - 92 - lp}" width="${pa * 0.8}" height="50" rx="3" class="apc-load ${cl}"/><text x="${x}" y="${yb - 62 - lp}" class="apc-t c">${lbl}</text>`;
    const side = `<svg viewBox="0 0 ${W} 210" class="apc-svg" aria-label="Side view of the pallet changer">
      <rect x="${cx - rp * 1.1 - 50}" y="${yb - 26}" width="100" height="40" class="apc-base"/><text x="${cx - rp * 1.1}" y="${yb + 30}" class="apc-t c">machine table (${P.nmod} modules)</text>
      ${[-30, 30].map((d) => `<rect x="${cx - rp * 1.1 + d - 7}" y="${yb - 32}" width="14" height="8" class="apc-cone ${s.clamp > 0.5 ? "cl" : ""}"/>`).join("")}
      <rect x="${cx + rp * 1.1 - 50}" y="${yb - 26}" width="100" height="40" class="apc-base"/><text x="${cx + rp * 1.1}" y="${yb + 30}" class="apc-t c">load station cones</text>
      <rect x="${cx - 14}" y="${yb - 26 - lp}" width="28" height="${60 + lp}" class="apc-cyl"/><text x="${cx}" y="${yb + 52}" class="apc-t c">lift cylinder Ø${R.D ?? "–"} · stroke ${P.s} mm</text>
      <rect x="${Math.min(xA, xB) - 10}" y="${yb - 26 - lp}" width="${Math.abs(xB - xA) + 20}" height="8" class="apc-arm2"/>
      ${sidePal(xA, "A", "a")}${sidePal(xB, "B", "b")}
      ${s.air ? `<text x="${cx - rp * 1.1}" y="${yb - 100}" class="apc-t c" style="fill:#1590a8">air seating check…</text>` : ""}
    </svg>`;
    $("apcAnim").innerHTML = top + side;
    $("apcStep").innerHTML = s.k < R.steps.length ? `Step ${s.k + 1}: <b>${esc(R.steps[s.k][0])}</b>` : "<b>Change complete</b> – machine continues with pallet B";
    $("apcTime").textContent = `${f(T, 1)} / ${f(R.tch, 1)} s`;
    $("apcScrub").value = Math.round(T / R.tch * 1000);
    // gantt
    let acc = 0;
    const gw = 620, sx = gw / R.tch;
    $("apcGantt").innerHTML = `<svg viewBox="0 0 640 ${R.steps.length * 20 + 26}" class="apc-svg">` + R.steps.map((st, i) => {
      const x = 10 + acc * sx, w = st[1] * sx; acc += st[1];
      return `<rect x="${x}" y="${i * 20 + 4}" width="${Math.max(2, w)}" height="14" rx="3" class="apc-bar${i === s.k ? " on" : ""}"/>
        <text x="${x + w + 4 > 520 ? x - 4 : x + w + 4}" y="${i * 20 + 15}" class="apc-t ${x + w + 4 > 520 ? "r" : ""}">${esc(st[0])} ${f(st[1], 1)} s</text>`;
    }).join("") + `<line x1="${10 + T * sx}" y1="0" x2="${10 + T * sx}" y2="${R.steps.length * 20 + 6}" class="apc-head"/>
      <text x="10" y="${R.steps.length * 20 + 22}" class="apc-t">0 s</text><text x="630" y="${R.steps.length * 20 + 22}" class="apc-t r">${f(R.tch, 1)} s</text></svg>`;
    document.querySelectorAll("#apcSeq tr[data-step]").forEach((tr) => tr.classList.toggle("on", +tr.dataset.step === s.k + 1));
    if (window.apc3d && typeof window.apc3d.update === "function") window.apc3d.update(s, P, R, T);
  }
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!playing || !$("tab-apc").classList.contains("active")) return;
    T += dt * +$("apcSpeed").value;
    if (T >= R.tch) { T = R.tch; setPlay(false); }
    draw();
  }
  function setPlay(p) { playing = p; $("apcPlay").textContent = p ? "❚❚ Pause" : "▶ Play change"; }

  // ------------------------------------------------------------------ events
  let tmr = 0;
  $("apcInputs").addEventListener("input", (e) => {
    const k = e.target.dataset.k; if (!k) return;
    const v = parseFloat(e.target.value);
    if (!Number.isFinite(v) || v <= 0 && !["e"].includes(k)) return;
    P[k] = v; e.target.classList.toggle("chg", v !== DEF[k]);
    try { localStorage.setItem("apcState", JSON.stringify(P)); } catch (er) { /* ignore */ }
    clearTimeout(tmr); tmr = setTimeout(render, 200);
  });
  $("apcReset").addEventListener("click", () => { if (!confirm("Back to the example values?")) return; P = { ...DEF }; try { localStorage.removeItem("apcState"); } catch (er) { /* ignore */ } inputs(); render(); });
  $("apcPlay").addEventListener("click", () => { if (!playing && T >= R.tch) T = 0; setPlay(!playing); });
  $("apcScrub").addEventListener("input", (e) => { setPlay(false); T = R.tch * e.target.value / 1000; draw(); });
  $("apcApply").addEventListener("click", async () => {
    const v = Math.round(R.tch * 10) / 10;
    if (!confirm(`Set the pallet change time of the HMCs in the running twin to ${v} s?\n(Until reset - for a permanent change edit "pallet_changer": {"change_s": ${v}} in config/factory.json.)`)) return;
    try {
      const r = await fetch("/api/command", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "pallet_change_s", value: v }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "failed");
      twinChange = v; twinCard(); render();
      if (window.toast) window.toast(j.message);
    } catch (err) { alert("Error: " + err.message + (String(err.message).includes("unknown") ? " - restart the server" : "")); }
  });
  $("apcCsv").addEventListener("click", () => {
    const q = (x) => `"${String(x).replace(/"/g, '""')}"`;
    const lines = [["Element", "Qty", "Specification", "Note"].map(q).join(","), ...R.bom.map((b) => b.map(q).join(",")), "",
      ["Parameter", "Value", "Unit"].map(q).join(","), ...GROUPS.flatMap(([, fs]) => fs.map(([k, l, u]) => [l, P[k], u].map(q).join(",")))];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv" }));
    a.download = "APC_design_BOM.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  window.onApcSnapshot = (s) => {
    const m = (s.machines || []).find((x) => x.pallet_changer);
    if (m && m.handling_s !== twinChange) { twinChange = m.handling_s; if ($("tab-apc").classList.contains("active")) render(); }
  };
  const _prev = window.onTabShown;
  window.onTabShown = (name) => { if (_prev) _prev(name); if (name === "apc") render(); };

  // hooks for the 3D model (apc3d.js, an ES module that loads after this script)
  window.APC = {
    get: () => ({ P, R, T, s: stateAt(T), playing }),
    play: () => $("apcPlay").click(),
    seek: (fr) => { setPlay(false); T = R.tch * Math.max(0, Math.min(1, fr)); draw(); },
  };
  inputs(); render(); requestAnimationFrame((t) => { last = t; loop(t); });
  const q = new URLSearchParams(location.search);
  if (q.get("apct")) { T = R.tch * +q.get("apct") / 100; draw(); }
})();
