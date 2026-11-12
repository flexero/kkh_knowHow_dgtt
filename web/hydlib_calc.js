/* Hydraulics item 1 – formulas, live mini-calculators, charts and self-test values (builder A).
 * Units in the formulas: p in bar or MPa (said every time), Q in L/min, V in cm³/rev, n in rpm, F in kN, d in mm.
 * All defaults = the docs/25 reference job (F 20 kN, bore 63 / rod 36, 10 MPa, 18.7 L/min). Values are EXAMPLES.
 */
const PI = Math.PI;
export const F = {
  pumpQ: (V, n, ev) => V * n * ev / 1000,                       // L/min
  powerKW: (pBar, Q, et) => pBar * Q / (600 * et),             // kW
  pumpT: (V, pBar, ehm) => V * pBar / (20 * PI * ehm),         // N·m (drive torque)
  motorT: (V, dpBar, ehm) => V * dpBar * ehm / (20 * PI),      // N·m
  motorN: (Q, V, ev) => Q * 1000 * ev / V,                     // rpm
  area: (dmm) => PI * dmm * dmm / 400,                         // cm²
  cylQ: (Acm2, v_mps) => Acm2 * v_mps * 60 / 10,               // L/min  (A cm² · v m/min / 10)
  eulerI: (dmm) => PI * dmm ** 4 / 64,                         // mm⁴
  eulerFk: (dmm, Lk, E = 210000) => PI * PI * E * F.eulerI(dmm) / (Lk * Lk) / 1000, // kN
  accV0: (dV, p0, p1, p2, n) => dV / (Math.pow(p0 / p1, 1 / n) - Math.pow(p0 / p2, 1 / n)), // L, abs pressures
  orificeQ: (dmm, Cd, dpMPa, rho = 870) => Cd * (PI * dmm * dmm / 4e6) * Math.sqrt(2 * dpMPa * 1e6 / rho) * 60000, // L/min
  orificeD: (Q, Cd, dpMPa, rho = 870) => Math.sqrt((Q / 60000) / (Cd * Math.sqrt(2 * dpMPa * 1e6 / rho)) * 4 / PI) * 1000, // mm
  cbvPilot: (pset, pload, ratio) => Math.max(0, (pset - pload) / ratio),
  pocPilot: (pload, pback, ratio, internal) => (pload - pback) / ratio + (internal ? pback : 0),
  valveDp: (dpN, QN, Q) => dpN * (Q / QN) ** 2,
  pipeD: (Q, v) => 4.61 * Math.sqrt(Q / v),                    // mm inner diameter
  pipeV: (Q, dmm) => Q / 60000 / (PI * dmm * dmm / 4e6),        // m/s
  wall: (pMPa, Dmm, sig, c) => pMPa * Dmm / (2 * sig) + c,      // mm
  lamDp: (Q, dmm, Lm, nu = 46, rho = 870) => { const v = F.pipeV(Q, dmm), Re = v * dmm / 1000 / (nu * 1e-6); const lam = Re < 2300 ? 64 / Re : 0.316 / Math.pow(Re, 0.25); return { v, Re, lam, dp: lam * (Lm / (dmm / 1000)) * rho * v * v / 2 / 1e6 }; },
  heatKW: (dpBar, Q) => dpBar * Q / 600,
};
const f = (v, d = 1) => (isFinite(v) ? (+v).toFixed(d) : "–");
const ok = (c, t = "✓", n = "✗") => c ? `<b class="hl-ok">${t}</b>` : `<b class="hl-bad">${n}</b>`;
const STD_PUMP = [4, 6, 8, 11, 14, 16, 19, 23, 26, 32, 40, 50, 63, 71, 100, 140];
const STD_KW = [0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75];
const up = (arr, v) => arr.find((x) => x >= v - 1e-9) ?? arr[arr.length - 1];
const TUBES = [[6, 1], [8, 1], [10, 1.5], [12, 1.5], [15, 2.5], [16, 2], [18, 2], [20, 2.5], [22, 2], [25, 3], [28, 3], [30, 4], [35, 4], [38, 5], [42, 5]];
export const NG = { NG6: [60, 0.8], NG10: [100, 0.6], NG16: [300, 0.7], NG25: [650, 0.7], NG32: [1100, 0.7] }; // [Q_N L/min, Δp_N MPa] per flow path – example curve

/* calculators: inputs [key, label, default, unit, step | options] ; run(v) → [[label, value, note]] */
export const CALC = {
  pump: { t: "Pump: flow, power, torque", inp: [["V", "Displacement V", 14, "cm³/rev", 1], ["n", "Speed n", 1450, "rpm", 10], ["ev", "Volumetric efficiency η_v", 0.92, "", 0.01], ["p", "Working pressure", 78, "bar", 1], ["et", "Total efficiency η_t", 0.85, "", 0.01]],
    run: (v) => { const Q = F.pumpQ(v.V, v.n, v.ev), P = F.powerKW(v.p, Q, v.et), T = F.pumpT(v.V, v.p, v.et / v.ev);
      return [["Flow Q = V·n·η_v/1000", f(Q, 1) + " L/min"], ["Drive power P = p·Q/(600·η_t)", f(P, 2) + " kW", "→ IEC motor " + up(STD_KW, P) + " kW"], ["Drive torque T = V·p/(20π·η_hm)", f(T, 1) + " N·m", "η_hm = η_t/η_v = " + f(v.et / v.ev, 2)], ["Needed V for this Q at 1450 rpm", f(Q * 1000 / (1450 * v.ev), 1) + " cm³", "→ standard " + up(STD_PUMP, Q * 1000 / (1450 * v.ev))]]; } },
  motor: { t: "Hydraulic motor: torque, speed, power", inp: [["V", "Displacement V", 200, "cm³/rev", 1], ["dp", "Pressure difference Δp", 140, "bar", 1], ["Q", "Flow Q", 40, "L/min", 1], ["ev", "η_v", 0.90, "", 0.01], ["ehm", "η_hm", 0.85, "", 0.01]],
    run: (v) => { const T = F.motorT(v.V, v.dp, v.ehm), n = F.motorN(v.Q, v.V, v.ev), P = T * n * 2 * PI / 60000;
      return [["Torque T = V·Δp·η_hm/(20π)", f(T, 0) + " N·m"], ["Speed n = Q·1000·η_v/V", f(n, 0) + " rpm"], ["Output power P = T·ω", f(P, 2) + " kW"], ["Hydraulic input Δp·Q/600", f(v.dp * v.Q / 600, 2) + " kW", "η_t = " + f(v.ev * v.ehm, 2)]]; } },
  cyl: { t: "Cylinder: areas, pressure, flow (docs/25 example)", inp: [["F", "Force F", 20, "kN", 0.5], ["D", "Bore D", 63, "mm", 1], ["d", "Rod d", 36, "mm", 1], ["s", "Stroke", 200, "mm", 10], ["t", "Time per stroke", 2, "s", 0.1], ["eta", "Seal efficiency η_cyl", 0.95, "", 0.01], ["ps", "System pressure", 10, "MPa", 0.5]],
    run: (v) => { const A1 = F.area(v.D), A2 = A1 - F.area(v.d), p = v.F * 1000 / (A1 * 1e-4 * v.eta) / 1e6, vel = v.s / 1000 / v.t, Qe = F.cylQ(A1, vel), Qr = F.cylQ(A2, vel);
      return [["Piston area A = πD²/4", f(A1, 1) + " cm²"], ["Annulus A − πd²/4", f(A2, 1) + " cm²", "φ = " + f(A1 / A2, 2)], ["Pressure needed F/(A·η)", f(p, 2) + " MPa", ok(p <= v.ps * 0.85, "inside 85 % of p_sys", "too high – bigger bore")], ["Speed", f(vel, 3) + " m/s"], ["Q extend = A·v", f(Qe, 1) + " L/min"], ["Q retract (pump) / outflow piston side", f(Qr, 1) + " / " + f(Qe, 1) + " L/min", "size the return line for the outflow"], ["Rod-side intensification p·A/A_ann", f(v.ps * A1 / A2, 1) + " MPa", "rate rod-side parts for it"], ["Oil per extend", f(A1 * v.s / 10 / 1000, 2) + " L"]]; } },
  buckle: { t: "Buckling (Euler) with mounting factor", inp: [["d", "Rod diameter d", 36, "mm", 1], ["L", "Free length L (fully extended, pin to pin)", 1900, "mm", 10], ["K", "Mounting case", 1, "", [[2, "fixed – free (K = 2)"], [1, "pin – pin (K = 1)"], [0.7, "fixed – pin (K = 0.7)"], [0.5, "fixed – fixed (K = 0.5)"]]], ["F", "Push force", 20, "kN", 0.5], ["S", "Required safety", 3.5, "", 0.5]],
    run: (v) => { const Lk = v.K * v.L, I = F.eulerI(v.d), Fk = F.eulerFk(v.d, Lk), S = Fk / v.F, lam = 4 * Lk / v.d;
      return [["Buckling length L_k = K·L", f(Lk, 0) + " mm"], ["I = π·d⁴/64", f(I, 0) + " mm⁴"], ["F_k = π²·E·I/L_k² (E 210 000 MPa)", f(Fk, 1) + " kN"], ["Safety F_k/F", f(S, 2), ok(S >= v.S, "OK ≥ " + v.S, "NOT OK – thicker rod or other mounting")], ["Slenderness λ = 4·L_k/d", f(lam, 0), lam > 105 ? "Euler valid (λ > ≈ 105 for steel)" : "λ small: Euler not valid, use Tetmajer – check yield"], ["Min rod for the safety", f(Math.pow(v.S * v.F * 1000 * Lk * Lk * 64 / (PI ** 3 * 210000), 0.25), 1) + " mm"]]; } },
  acc: { t: "Accumulator size (gas law, absolute pressure)", inp: [["dV", "Oil volume needed ΔV", 0.62, "L", 0.01], ["p1", "Minimum working p1 (gauge)", 7.8, "MPa", 0.1], ["p2", "Maximum p2 (gauge)", 10, "MPa", 0.1], ["k", "Pre-charge p0 = k·p1 (abs)", 0.9, "", 0.01], ["n", "Gas exponent n", 1.4, "", [[1.4, "1.4 adiabatic (fast, < 1 min)"], [1, "1.0 isothermal (slow, > 3 min)"]]]],
    run: (v) => { const p1 = v.p1 + 0.1, p2 = v.p2 + 0.1, p0 = v.k * p1, V0 = F.accV0(v.dV, p0, p1, p2, v.n), Vi = F.accV0(v.dV, p0, p1, p2, 1);
      const std = [0.16, 0.32, 0.5, 0.75, 1, 1.4, 2.5, 4, 5, 6, 10, 13, 20, 24, 32, 50].find((x) => x >= V0) || "> 50";
      return [["Absolute p1 / p2", f(p1, 2) + " / " + f(p2, 2) + " MPa"], ["Pre-charge p0", f(p0, 2) + " MPa abs = " + f(p0 - 0.1, 2) + " MPa g"], ["(p0/p1)^(1/n) − (p0/p2)^(1/n)", f(Math.pow(p0 / p1, 1 / v.n), 3) + " − " + f(Math.pow(p0 / p2, 1 / v.n), 3)], ["V0 = ΔV / […]", f(V0, 2) + " L", "→ standard " + std + " L"], ["Isothermal check (n = 1)", f(Vi, 2) + " L", v.n > 1 ? "smaller – not safe for fast discharge" : ""], ["Pressure ratio p2/p0", f(p2 / p0, 2), ok(p2 / p0 <= 4, "≤ 4 bladder OK", "> 4: bladder life short – piston type")]]; } },
  orifice: { t: "Orifice / throttle: Q = Cd·A·√(2Δp/ρ)", inp: [["d", "Diameter d", 2, "mm", 0.1], ["Cd", "Discharge coefficient Cd", 0.65, "", 0.01], ["dp", "Pressure drop Δp", 5, "MPa", 0.1], ["rho", "Density ρ", 870, "kg/m³", 5], ["Qt", "Target flow (for size)", 18.7, "L/min", 0.1]],
    run: (v) => { const Q = F.orificeQ(v.d, v.Cd, v.dp, v.rho), dn = F.orificeD(v.Qt, v.Cd, v.dp, v.rho);
      return [["Area A = π·d²/4", f(PI * v.d * v.d / 4, 2) + " mm²"], ["√(2Δp/ρ)", f(Math.sqrt(2 * v.dp * 1e6 / v.rho), 1) + " m/s"], ["Flow Q", f(Q, 2) + " L/min"], ["Diameter for target flow at this Δp", f(dn, 2) + " mm"], ["Heat in the orifice Δp·Q/60", f(v.dp * Q / 60, 2) + " kW"]]; } },
  cbv: { t: "Counterbalance valve: setting and pilot pressure", inp: [["F", "Load force (pulls / runs away)", 20, "kN", 0.5], ["A", "Area on the load side", 31.2, "cm²", 0.1], ["k", "Setting factor", 1.3, "", 0.05], ["ps", "Chosen setting (0 = auto)", 8.5, "MPa", 0.5], ["r", "Pilot ratio", 4, "", [[3, "3:1 (stable, big loads)"], [4, "4:1 (standard)"], [8, "8:1 (energy saving, can oscillate)"]]]],
    run: (v) => { const pl = v.F * 1000 / (v.A * 1e-4) / 1e6, pmin = v.k * pl, ps = v.ps > 0 ? v.ps : Math.ceil(pmin * 2) / 2, pp = F.cbvPilot(ps, pl, v.r);
      return [["Load pressure p_L = F/A", f(pl, 2) + " MPa"], ["Setting ≥ k·p_L", f(pmin, 2) + " MPa", ok(ps >= pmin - 1e-9, "setting " + f(ps, 1) + " MPa OK", "setting too low – load can run away")], ["Pilot pressure to open p_X = (p_set − p_L)/ratio", f(pp, 2) + " MPa"], ["Pilot to open with no load p_set/ratio", f(ps / v.r, 2) + " MPa", "(lowering an empty fork needs this)"]]; } },
  poc: { t: "Pilot-operated check: pilot pressure to open", inp: [["pl", "Load pressure p_load (under the poppet)", 6.4, "MPa", 0.1], ["pb", "Back pressure p_back (outlet side)", 0.5, "MPa", 0.1], ["r", "Pilot ratio φ", 4, "", 0.5], ["dr", "Pilot drain", 0, "", [[0, "external drain (Y)"], [1, "internal drain"]]]],
    run: (v) => { const pp = F.pocPilot(v.pl, v.pb, v.r, v.dr === 1);
      return [["p_X ≥ (p_load − p_back)/φ " + (v.dr ? "+ p_back" : ""), f(pp, 2) + " MPa"], ["With decompression stage (1:13)", f((v.pl - v.pb) / 13 + (v.dr ? v.pb : 0), 2) + " MPa", "small poppet opens first, then the main poppet"], ["Rule", "use external drain when the outlet has back pressure (meter-out throttle, long return line)"]]; } },
  valvedp: { t: "Valve pressure drop at another flow: Δp = Δp_N·(Q/Q_N)²", inp: [["ng", "Valve size (example curve)", "NG6", "", Object.keys(NG).map((k) => [k, `${k}: ${NG[k][1]} MPa at ${NG[k][0]} L/min`])], ["Q", "Flow through one path", 18.7, "L/min", 0.1], ["Q2", "Flow through the return path", 12.6, "L/min", 0.1]],
    run: (v) => { const [QN, dpN] = NG[v.ng], a = F.valveDp(dpN, QN, v.Q), b = F.valveDp(dpN, QN, v.Q2);
      return [["Δp P→A", f(a, 3) + " MPa"], ["Δp B→T", f(b, 3) + " MPa"], ["Total through the valve", f(a + b, 3) + " MPa", ok(a + b < 1, "small", "big – next size")], ["Heat in the valve Δp·Q/60", f((a * v.Q + b * v.Q2) / 60, 3) + " kW"], ["Load vs rated flow", f(v.Q / QN * 100, 0) + " %", ok(v.Q <= QN, "inside", "above the rated flow – check the performance limit")]]; } },
  pipe: { t: "Pipe size, wall thickness and pressure drop", inp: [["Q", "Flow Q", 18.7, "L/min", 0.1], ["v", "Allowed velocity", 4, "m/s", 0.1], ["p", "Max pressure", 10, "MPa", 0.5], ["sig", "Allowed stress σ_allow (E235, with fatigue margin)", 60, "MPa", 5], ["c", "Allowances (tolerance + corrosion)", 0.65, "mm", 0.05], ["Lm", "Line length", 3, "m", 0.5]],
    run: (v) => { const d = F.pipeD(v.Q, v.v); let tube = TUBES.find(([D, s]) => D - 2 * s >= d - 1e-6 && s >= F.wall(v.p, D, v.sig, v.c)); if (!tube) tube = TUBES[TUBES.length - 1];
      const [D, s] = tube, di = D - 2 * s, lam = F.lamDp(v.Q, di, v.Lm);
      return [["Inner diameter d = 4.61·√(Q/v)", f(d, 1) + " mm"], ["Tube chosen (EN 10305-4)", `${D} × ${s} (ID ${f(di, 1)} mm)`], ["Wall needed s = p·D/(2σ) + c", f(F.wall(v.p, D, v.sig, v.c), 2) + " mm", ok(s >= F.wall(v.p, D, v.sig, v.c))], ["Barlow stress p·D/(2s)", f(v.p * D / (2 * s), 0) + " MPa"], ["Real velocity", f(lam.v, 2) + " m/s"], ["Reynolds Re = v·d/ν (HLP 46, 40 °C)", f(lam.Re, 0), lam.Re < 2300 ? "laminar" : "turbulent"], ["Δp = λ·(L/d)·ρv²/2", f(lam.dp, 3) + " MPa"]]; } },
  cooler: { t: "Heat and cooler size", inp: [["dp", "Pressure lost (throttled / over relief)", 90, "bar", 1], ["Q", "Flow through the loss", 18.7, "L/min", 0.1], ["tank", "Heat the tank removes", 0.36, "kW", 0.01], ["to", "Oil temperature wanted", 50, "°C", 1], ["ta", "Ambient air temperature", 30, "°C", 1], ["sf", "Safety factor", 1.2, "", 0.05]],
    run: (v) => { const P = F.heatKW(v.dp, v.Q), Pc = Math.max(0, P - v.tank), dT = v.to - v.ta, P01 = dT > 0 ? Pc / dT * v.sf : NaN;
      return [["Heat P = Δp·Q/600", f(P, 2) + " kW"], ["Cooler must remove P − tank", f(Pc, 2) + " kW", Pc > 0 ? "" : "no cooler needed"], ["Specific power P01 = P/ΔT · safety", f(P01, 3) + " kW/K", "ΔT = oil in − air in = " + dT + " K"], ["Water cooler: water flow at 5 K rise", f(Pc / (4.18 * 5) * 60, 1) + " L/min"]]; } },
};

/* charts – series of [x,y] */
export function chartData(key) {
  const rng = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);
  switch (key) {
    case "dpq": return { t: "Valve Δp vs flow (one flow path, example curves Δp = Δp_N·(Q/Q_N)²)", xl: "Q [L/min]", yl: "Δp [MPa]", logx: true, xr: [5, 1500], yr: [0, 1.6],
      s: Object.entries(NG).map(([k, [QN, dpN]]) => ({ n: k, p: rng(Math.log10(5), Math.log10(QN * 1.4), 40).map((lx) => [10 ** lx, F.valveDp(dpN, QN, 10 ** lx)]).filter((q) => q[1] <= 1.6) })) };
    case "relief": return { t: "Relief valve: pressure vs flow (override), setting 10 MPa", xl: "Q [L/min]", yl: "p [MPa]", xr: [0, 100], yr: [6, 13],
      s: [{ n: "direct operated", p: [[0, 8.6], ...rng(0, 100, 20).map((q) => [q, 9.0 + 0.025 * q])] }, { n: "pilot operated", p: [[0, 9.6], ...rng(0, 100, 20).map((q) => [q, 9.8 + 0.004 * q])] }] };
    case "visc": { const VG = { "VG 22": [22, 4.3], "VG 32": [32, 5.4], "VG 46": [46, 6.8], "VG 68": [68, 8.7], "VG 100": [100, 11.1] };
      const walther = (n40, n100) => { const W = (n) => Math.log10(Math.log10(n + 0.7)); const B = (W(n40) - W(n100)) / (Math.log10(373.15) - Math.log10(313.15)), A = W(n40) + B * Math.log10(313.15); return (tC) => 10 ** (10 ** (A - B * Math.log10(tC + 273.15))) - 0.7; };
      return { t: "Viscosity vs temperature (VI ≈ 100, Walther), band = optimum 16–36 mm²/s", xl: "t [°C]", yl: "ν [mm²/s] (log)", logy: true, xr: [-20, 100], yr: [3, 3000], band: [16, 36],
        s: Object.entries(VG).map(([k, [a, b]]) => { const w = walther(a, b); return { n: k, p: rng(-20, 100, 48).map((t) => [t, w(t)]).filter((q) => q[1] <= 3000) }; }) }; }
    case "pumpPQ": return { t: "Pump flow vs pressure (example 60 L/min, 25 MPa)", xl: "p [MPa]", yl: "Q [L/min]", xr: [0, 28], yr: [0, 70],
      s: [{ n: "fixed pump + relief 25 MPa", p: [[0, 60], [24, 58], [25, 58], [25.6, 0]] }, { n: "pressure compensator 21 MPa", p: [[0, 60], [20.5, 59], [21, 55], [21.6, 0]] }, { n: "power limiter 15 kW (η 0.88)", p: rng(0, 25, 50).map((p) => [p, Math.min(60 - 0.08 * p, 15 * 600 * 0.88 / (p * 10 || 1e-9))]) }] };
    case "fcomp": return { t: "Flow vs pressure drop: throttle vs pressure-compensated", xl: "Δp across the valve [MPa]", yl: "Q [L/min]", xr: [0, 10], yr: [0, 40],
      s: [{ n: "throttle (Q ∝ √Δp)", p: rng(0, 10, 40).map((d) => [d, 18.7 * Math.sqrt(d / 3)]).filter((q) => q[1] <= 40) }, { n: "compensated, set 18.7 L/min", p: [[0, 0], ...rng(0.05, 10, 60).map((d) => [d, d < 0.8 ? 18.7 * Math.sqrt(d / 0.8) : 18.7 + 0.08 * (d - 0.8)])] }] };
    case "accu": { const p0 = 7.1, V0 = 5; return { t: "Gas pressure vs gas volume, 5 L bladder, p0 7.1 MPa abs", xl: "gas volume [L]", yl: "p abs [MPa]", xr: [3, 5], yr: [6, 12], marks: [[7.9, "p1 7.9"], [10.1, "p2 10.1"]],
      s: [{ n: "isothermal p·V = const", p: rng(3, 5, 40).map((V) => [V, p0 * V0 / V]) }, { n: "adiabatic p·V^1.4 = const", p: rng(3, 5, 40).map((V) => [V, p0 * (V0 / V) ** 1.4]).filter((q) => q[1] <= 12) }] }; }
    default: return null;
  }
}

/* self-test: [label, computed, hand value, tolerance] – hand values from the guide docs/29 */
export function selfTest() {
  return [
    ["pump Q 14 cm³ · 1450 · 0.92", F.pumpQ(14, 1450, 0.92), 18.68, 0.02],
    ["pump P 78 bar · 18.7 L/min / (600·0.85)", F.powerKW(78, 18.7, 0.85), 2.86, 0.01],
    ["axial pump V for 60 L/min = 60000/(1450·0.95)", 60000 / (1450 * 0.95), 43.6, 0.05],
    ["motor T 200 cm³ · 140 bar · 0.85 / 20π", F.motorT(200, 140, 0.85), 378.8, 0.2],
    ["motor n 40 L/min · 0.9 / 200 cm³", F.motorN(40, 200, 0.9), 180, 0.1],
    ["cyl A bore 63", F.area(63), 31.17, 0.01], ["cyl annulus 63/36", F.area(63) - F.area(36), 20.99, 0.01],
    ["cyl p needed 20 kN / (31.17 cm² · 0.95)", 20000 / (F.area(63) * 1e-4 * 0.95) / 1e6, 6.75, 0.01],
    ["cyl Q extend 31.2 cm² · 6 m/min / 10", F.cylQ(F.area(63), 0.1), 18.7, 0.05],
    ["Euler I rod 36", F.eulerI(36), 82448, 1], ["Euler F_k rod 36, L_k 1900 mm", F.eulerFk(36, 1900), 47.3, 0.1],
    ["Euler F_k rod 45, L_k 1900 mm", F.eulerFk(45, 1900), 115.6, 0.2],
    ["acc V0 adiabatic 0.62 L, 7.1/7.9/10.1 abs", F.accV0(0.62, 7.1, 7.9, 10.1, 1.4), 4.15, 0.05],
    ["acc V0 isothermal", F.accV0(0.62, 7.1, 7.9, 10.1, 1), 3.17, 0.05],
    ["orifice d 2 mm Cd 0.65 Δp 5 MPa", F.orificeQ(2, 0.65, 5), 13.1, 0.05],
    ["orifice d for 18.7 L/min at 1 MPa", F.orificeD(18.7, 0.65, 1), 3.57, 0.02],
    ["cbv pilot (8.5 − 6.41)/4", F.cbvPilot(8.5, 20000 / (31.2e-4) / 1e6, 4), 0.52, 0.005],
    ["poc pilot (6.4 − 0.5)/4 ext. drain", F.pocPilot(6.4, 0.5, 4, false), 1.475, 0.001],
    ["valve Δp NG10 0.6 MPa @60 → 90 L/min", F.valveDp(0.6, 60, 90), 1.35, 0.001],
    ["pipe d 18.7 L/min at 4 m/s", F.pipeD(18.7, 4), 9.97, 0.02],
    ["tube wall 10 MPa, 15 mm, 60 MPa", F.wall(10, 15, 60, 0), 1.25, 0.001],
    ["laminar Δp 18.7 L/min, d 10, 3 m", F.lamDp(18.7, 10, 3).dp, 0.15, 0.01],
    ["heat 90 bar · 18.7 / 600", F.heatKW(90, 18.7), 2.805, 0.001],
  ];
}
