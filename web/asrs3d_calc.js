/* AS/RS item 1 – engineering calculations (rack, floor, crane wheels, mast, drives, cycle, throughput, accuracy, energy).
 * Pure functions, no DOM. Same formulas and example numbers as docs/31_asrs_mechanical_3d.md (verified with Python stdlib).
 * Simplified hand checks for understanding and plausibility – NOT a structural design. The rack maker designs the rack
 * (EN 15512), the crane maker designs the crane (FEM 9.831 / EN 528). ALL VALUES ARE EXAMPLES.
 */
import { RACK, CRANE, CRATE_TARE, trapTime, fem9851 } from "./asrscore.js";

export const G = 9.81;
const fmt = (v, d = 1) => (Number.isFinite(v) ? (Math.abs(v) >= 1e4 ? Math.round(v).toLocaleString("en-US").replace(/,/g, " ") : v.toFixed(d)) : "–");

/* design inputs (editable on the page) – example values */
export const DEF = {
  slotKg: 300,          // design load per crate position (crate + castings), kg
  beamH: 120, beamB: 50, beamT: 2.0, fy: 355,               // box beam 120 × 50 × 2.0, S355
  upAeff: 520, upI: 30, upLcr: 1250, upSelf: 120,           // upright: effective area mm², radius of gyration mm, buckling length mm, self weight kg per upright
  plateA: 150, plateB: 120,                                  // base plate mm
  gQ: 1.4, gG: 1.3,                                          // partial factors (EN 15512 style, simplified)
  craneKg: CRANE.mass, loadKg: 300, mastKg: 1000, carrKg: 600, forkKg: 150,
  wheelD: 400, railB: 50, phi: 1.15, pLim: 5.0,              // wheel Ø mm, rail head width mm, dynamic factor, limit pressure N/mm²
  vx: CRANE.vx, ax: CRANE.ax, vz: CRANE.vz, az: CRANE.az, vf: CRANE.vf, af: CRANE.af,
  roll: 0.010, rot: 1.05, etaT: 0.90, etaH: 0.85, etaF: 0.80, etaBack: 0.65, auxKw: 0.5,
  mastB: 350, mastD: 500, mastT: 6, mastH: CRANE.mastH * 1000,
  demand: 40, dualShare: 0.5,                                // required jobs/h (line), share of jobs in dual cycles
};
/* mass items of the crane for the wheel loads: [name, kg, x from the fork centre m (+ = away from the mast), height of the CG m] */
export function craneMasses(d) {
  const rest = d.craneKg - d.mastKg - d.carrKg - 1600 - 200;
  return [["bottom frame + travel / hoist drives", 1600, 0.20, 0.4], ["mast (box section)", d.mastKg, -0.65, 5.0], ["lifting carriage + telescopic fork", d.carrKg, 0, 8.3],
    ["control cabinet, platform, ladder, misc.", rest, 1.0, 1.0], ["top frame + guide rollers + pulley", 200, -0.65, 9.4]];
}
export const WHEEL_X = [-1.05, 1.35];            // drive wheel (under the mast) and idler wheel, m from the fork centre
export const MOTORS = [0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37];   // IEC standard motor series, kW
const pickMotor = (p) => MOTORS.find((s) => s >= p - 1e-9) || MOTORS[MOTORS.length - 1];
const C1 = [[50, 1.03], [100, 0.94], [125, 0.91], [160, 0.87], [200, 0.82]];             // speed factor c1 (DIN 15070 style table, simplified)
function c1Of(n) { for (let i = 0; i < C1.length - 1; i++) { const [n0, c0] = C1[i], [n1, c1] = C1[i + 1]; if (n >= n0 && n <= n1) return c0 + (c1 - c0) * (n - n0) / (n1 - n0); } return n < 50 ? 1.03 : 0.82; }

/* positioning accuracy budget (± mm, example values) */
export const BUDGET_X = [["crane travel positioning (laser / bar code, closed loop)", 3], ["mast sway left at the fork after fine positioning", 2], ["rack bay position vs nominal (FEM 9.831 / supplier)", 5],
  ["upright straightness + beam position", 3], ["load position on the fork", 2], ["crate deformation / casting overhang", 5]];
export const BUDGET_Z = [["hoist positioning", 2], ["carriage tilt on the mast", 1], ["beam level tolerance", 5], ["rail / floor level under the crane", 3], ["beam deflection under load", 2], ["fork deflection under load", 5]];

function trapPeakV(d, v, a) { return Math.min(v, Math.sqrt(Math.abs(d) * a)); }
function femFor(d) {   // FEM 9.851 with the page inputs (equals A.fem for the default inputs)
  const L = RACK.x0 + RACK.length, H = RACK.z1 + (RACK.levels - 1) * RACK.levelPitch - CRANE.zIO, zIO = CRANE.zIO;
  const P1 = { x: L / 5, z: zIO + 2 * H / 3 }, P2 = { x: 2 * L / 3, z: zIO + H / 5 };
  const mv = (x0, z0, x1, z1) => Math.max(trapTime(x1 - x0, d.vx, d.ax), trapTime(z1 - z0, d.vz, d.az));
  const t1 = mv(0, zIO, P1.x, P1.z), t2 = mv(0, zIO, P2.x, P2.z), t12 = mv(P1.x, P1.z, P2.x, P2.z);
  const tf = trapTime(RACK.aisle / 2 + RACK.crateL / 2, d.vf, d.af), lhd = 2 * tf + CRANE.tLift, stop = CRANE.tPos + lhd;
  const sc = (2 * t1 + 2 * t2) / 2 + 2 * stop, dc = t1 + t12 + t2 + 4 * lhd + 3 * CRANE.tPos;
  return { L, H, P1, P2, t1, t2, t12, tf, lhd, stop, sc, dc, scPerH: 3600 / sc, dcPerH: 7200 / dc, zIO };
}

/* live upright loads from the stock: lever rule along the beam (crate k = 0 near the left upright) */
export function uprightLoads(slots) {
  const span = RACK.bayPitch - RACK.upright, a = RACK.gap + RACK.crateW / 2, fL = (span - a) / span;   // 0.74 to the near upright
  const out = { L: new Array(RACK.bays + 1).fill(0), R: new Array(RACK.bays + 1).fill(0) };
  for (const s of slots) { const kg = s.load ? s.load.kg : 0; if (!kg) continue; const near = s.k === 0 ? s.bay : s.bay + 1, far = s.k === 0 ? s.bay + 1 : s.bay;
    out[s.side][near] += kg * fL / 2; out[s.side][far] += kg * (1 - fL) / 2; }     // /2: front and rear upright of the frame
  return out;
}

/** all calculations; sim (optional) adds live rows. Returns { R (numbers), S (sections for the page) } */
export function calcAll(inp = {}, sim = null) {
  const d = { ...DEF, ...inp }, R = {}, S = [];
  const sec = (id, t, note) => { const s = { id, t, note, rows: [] }; S.push(s); return (item, formula, value, unit, check, ok) => s.rows.push({ item, formula, value, unit, check: check || "", ok }); };

  /* 1 – rack beam */
  const span = (RACK.bayPitch - RACK.upright) * 1000, a = (RACK.gap + RACK.crateW / 2) * 1000, E = 210000;
  const { beamH: h, beamB: b, beamT: t } = d;
  const I = (b * h ** 3 - (b - 2 * t) * (h - 2 * t) ** 3) / 12, W = I / (h / 2);
  const P = d.slotKg * G / 2;                                     // per beam per crate (front + rear beam)
  const M = P * a / 1000, sig = M * 1000 / W, sigd = d.gQ * sig;
  const defl = P * a * (3 * span ** 2 - 4 * a ** 2) / (24 * E * I), dlim = span / 200;
  Object.assign(R, { beamI: I, beamW: W, beamP: P, beamM: M, beamSig: sig, beamSigd: sigd, beamUtil: sigd / d.fy, beamDefl: defl, beamDlim: dlim, span });
  let r = sec("beam", "Rack beam – one bay, one level (2 crates per beam pair)", "EN 15512 style, simplified: two point loads at the crate centres; the rack maker checks connector moment / shear by test.");
  r("Load per level and bay", `2 crates × ${d.slotKg} kg = ${2 * d.slotKg} kg on 2 beams (front + rear)`, 2 * d.slotKg * G / 1000, "kN");
  r("Point load per beam per crate", `P = ${d.slotKg} × 9.81 / 2`, P, "N");
  r("Beam section (example)", `box ${h} × ${b} × ${t} mm: I = (b·h³ − (b−2t)(h−2t)³)/12`, I / 1e6, "×10⁶ mm⁴", `W = ${fmt(W / 1e3, 1)} ×10³ mm³`);
  r("Bending moment", `M = P · a = ${fmt(P, 0)} × ${Math.round(a)} mm (a = crate centre to upright)`, M, "N·m");
  r("Bending stress (design)", `σ_d = γ_Q · M / W = ${d.gQ} × ${fmt(sig, 1)}`, sigd, "N/mm²", `≤ f_y = ${d.fy} → ${fmt(sigd / d.fy * 100, 0)} %`, sigd <= d.fy);
  r("Deflection", "δ = P·a·(3L² − 4a²) / (24·E·I)", defl, "mm", `≤ L/200 = ${fmt(dlim, 1)} mm`, defl <= dlim);

  /* 2 – upright + floor */
  const Nk = d.slotKg * G * RACK.levels / 1000, self = d.upSelf * G / 1000, Ned = d.gQ * Nk + d.gG * self;
  const eps = Math.sqrt(235 / d.fy), lam = d.upLcr / d.upI, lb = lam / (93.9 * eps), al = 0.34;
  const ph = 0.5 * (1 + al * (lb - 0.2) + lb * lb), chi = Math.min(1, 1 / (ph + Math.sqrt(ph * ph - lb * lb))), Nb = chi * d.upAeff * d.fy / 1000;
  const Nfl = Nk + self, pfl = Nfl * 1000 / (d.plateA * d.plateB);
  Object.assign(R, { upNk: Nk, upNed: Ned, upLb: lb, upChi: chi, upNb: Nb, upUtil: Ned / Nb, floorN: Nfl, floorP: pfl, storedT: RACK.slots * d.slotKg / 1000 });
  r = sec("upright", "Rack upright, base plate and floor (inner upright, all slots at design load)", "Each crate goes 74 % / 26 % to the two uprights of its bay (lever rule) and 50 / 50 to the front and rear upright → an inner upright carries 1 crate per level.");
  r("Upright load (characteristic)", `N_k = ${d.slotKg} kg × 9.81 × ${RACK.levels} levels`, Nk, "kN");
  r("Design compression", `N_Ed = ${d.gQ} × N_k + ${d.gG} × self weight ${d.upSelf} kg`, Ned, "kN");
  r("Slenderness", `λ̄ = (L_cr / i) / (93.9 ε) = (${d.upLcr} / ${d.upI}) / ${fmt(93.9 * eps, 1)}`, lb, "–", `χ = ${fmt(chi, 3)} (curve b)`);
  r("Buckling resistance", `N_b,Rd = χ · A_eff · f_y = ${fmt(chi, 3)} × ${d.upAeff} × ${d.fy}`, Nb, "kN", `utilisation ${fmt(Ned / Nb * 100, 0)} %`, Ned <= Nb);
  r("Floor point load under a base plate", "N = N_k + self weight", Nfl, "kN");
  r("Contact pressure under the plate", `p = N / (${d.plateA} × ${d.plateB} mm)`, pfl, "N/mm²", "slab, punching + anchors: structural engineer", pfl < 5);
  r("Stored mass at design load", `${RACK.slots} slots × ${d.slotKg} kg`, R.storedT, "t");
  if (sim) {
    const U = uprightLoads(sim.slots); let mx = 0, at = "";
    for (const sd of ["L", "R"]) U[sd].forEach((kg, j) => { if (kg > mx) { mx = kg; at = `${sd} frame ${j + 1}`; } });
    const tot = sim.slots.reduce((k, s) => k + (s.load ? s.load.kg : 0), 0);
    R.liveUpKN = mx * G / 1000; R.liveT = tot / 1000;
    r("LIVE: stored mass now", `Σ load kg of ${sim.slots.filter((s) => s.load).length} loads`, tot / 1000, "t", `${fmt(tot / 1000 / R.storedT * 100, 0)} % of design`);
    r("LIVE: highest upright load now", `lever rule over the actual stock (${at})`, mx * G / 1000, "kN", `${fmt(mx * G / 1000 / Nk * 100, 0)} % of design N_k`);
  }

  /* 3 – crane wheel loads + rail */
  const ms = craneMasses(d), xw1 = WHEEL_X[0], wb = WHEEL_X[1] - WHEEL_X[0];
  const wl = (load) => { const L = load ? [...ms, ["load", d.loadKg, 0, 8.3]] : ms; const m = L.reduce((k, p) => k + p[1], 0), mom = L.reduce((k, p) => k + p[1] * (p[2] - xw1), 0);
    const R2 = mom / wb; return { m, R1: (m - R2) * G / 1000, R2: R2 * G / 1000, mh: L.reduce((k, p) => k + p[1] * p[3], 0) }; };
  const Wl = wl(true), We = wl(false), dR = d.ax * Wl.mh / wb / 1000, Rmax = d.phi * Math.max(Wl.R1, Wl.R2) + dR;
  const Pmin = Wl.R1 >= Wl.R2 ? We.R1 : We.R2;                  // the same (most loaded) wheel with the empty crane
  const Pm = (Pmin + 2 * Rmax) / 3, nW = d.vx / (Math.PI * d.wheelD / 1000) * 60, c1 = c1Of(nW), beff = d.railB - 8, Pal = d.pLim * beff * d.wheelD * c1 / 1000;
  const Htop = (d.loadKg * G * 1.35 + d.forkKg * G * 0.675) / (d.mastH / 1000);
  Object.assign(R, { wM: Wl.m, wR1: Wl.R1, wR2: Wl.R2, wR1e: We.R1, wR2e: We.R2, wMh: Wl.mh, wdR: dR, wRmax: Rmax, wPmean: Pm, wN: nW, wC1: c1, wPal: Pal, wUtil: Pm / Pal, topGuide: Htop });
  r = sec("wheel", "Stacker crane – wheel loads and rail (static + dynamic)", "2 wheels on one bottom rail; the top guide rollers take only cross-aisle forces. Simplified – the crane maker checks per FEM 1.001 / DIN 15070.");
  r("Moving mass with load", `${d.craneKg} kg crane + ${d.loadKg} kg load`, Wl.m, "kg");
  r("Static wheel loads (loaded)", `moments about the drive wheel, wheelbase ${fmt(wb, 2)} m`, Wl.R1, "kN", `idler ${fmt(Wl.R2, 1)} kN`);
  r("Tilt from acceleration", `ΔR = a · Σ(m·h) / wheelbase = ${d.ax} × ${fmt(Wl.mh, 0)} / ${fmt(wb, 2)}`, dR, "kN");
  r("Max wheel load (design)", `R_max = φ · R_static + ΔR = ${d.phi} × ${fmt(Math.max(Wl.R1, Wl.R2), 2)} + ${fmt(dR, 2)}`, Rmax, "kN");
  r("Mean wheel load", "P_mean = (P_min + 2 · P_max) / 3", Pm, "kN");
  r("Wheel speed", `n = v / (π · D) = ${d.vx} / (π × ${d.wheelD / 1000})`, nW, "rpm", `c1 = ${fmt(c1, 3)}`);
  r("Allowed wheel load (steel wheel, flat rail)", `P_al = p_lim · b_eff · D · c1 = ${d.pLim} × ${beff} × ${d.wheelD} × ${fmt(c1, 3)}`, Pal, "kN", `utilisation ${fmt(Pm / Pal * 100, 0)} %`, Pm <= Pal);
  r("Rail line load on the grout (spread ≈ 0.5 m)", "q = R_max / 0.5 m", Rmax / 0.5, "kN/m", "rail clamps + grout per crane maker");
  r("Top guide roller force (fork out, conservative)", `H = (m_load·g·1.35 + m_fork·g·0.675) / H_mast`, Htop, "N");

  /* 4 – mast deflection under acceleration */
  const B = d.mastB, Dm = d.mastD, tm = d.mastT, Im = (B * Dm ** 3 - (B - 2 * tm) * (Dm - 2 * tm) ** 3) / 12, Hm = d.mastH;
  const q = d.mastKg * d.ax / Hm, dq = q * Hm ** 4 / (8 * E * Im), Pc = (d.carrKg + d.loadKg) * d.ax, hc = 8000;
  const dP = Pc * hc ** 2 * (3 * Hm - hc) / (6 * E * Im), k = 3 * E * Im / Hm ** 3 * 1000, meq = 0.24 * d.mastKg + d.carrKg + d.loadKg, f = Math.sqrt(k / meq) / (2 * Math.PI);
  Object.assign(R, { mastI: Im, mastQ: q, mastDq: dq, mastDp: dP, mastTop: dq + dP, mastDyn: 2 * (dq + dP), mastK: k, mastF: f });
  r = sec("mast", "Mast deflection under travel acceleration (cantilever from the bottom frame)", "Along the aisle the mast is a cantilever: inertia of its own mass (uniform load) + carriage and load at the top level (point load).");
  r("Mast section (example)", `welded box ${Dm} × ${B} × ${tm} mm: I = (B·D³ − (B−2t)(D−2t)³)/12`, Im / 1e6, "×10⁶ mm⁴");
  r("Uniform inertia load", `q = m_mast · a / H = ${d.mastKg} × ${d.ax} / ${Hm}`, q, "N/mm");
  r("Deflection from q at the top", "δ_q = q · H⁴ / (8 · E · I)", dq, "mm");
  r("Point load carriage + load", `P = (${d.carrKg} + ${d.loadKg}) × ${d.ax} at h = ${hc / 1000} m`, Pc, "N");
  r("Deflection from P at the top", "δ_P = P · h² · (3H − h) / (6 · E · I)", dP, "mm");
  r("Static top deflection", "δ = δ_q + δ_P", dq + dP, "mm", `dynamic (sudden step) ≈ 2 × = ${fmt(2 * (dq + dP), 1)} mm`, 2 * (dq + dP) < 10);
  r("First natural frequency", `f = √(k / m_eq) / 2π, k = 3EI/H³ = ${fmt(k / 1000, 0)} kN/m, m_eq = 0.24 m_mast + top mass`, f, "Hz", "≥ ≈ 1.5–2 Hz is usual (jerk-limited moves + sway damping)", f >= 1.5);

  /* 5 – drives */
  const mT = d.craneKg + d.loadKg, Fa = mT * d.ax * d.rot, Fr = d.roll * mT * G, Ft = Fa + Fr, Pp = Ft * d.vx / d.etaT / 1000, Ps = Fr * d.vx / d.etaT / 1000;
  const PNt = pickMotor(Math.max(Pp / 1.5, Ps)), iT = 1450 / nW, Tw = Ft * d.wheelD / 2000;
  const mH = d.carrKg + d.loadKg, Phs = mH * G * d.vz / d.etaH / 1000, Php = mH * (G + d.az) * d.vz / d.etaH / 1000, PNh = pickMotor(Math.max(Phs, Php / 1.5));
  const rope = mH * (G + d.az), Zp = 2 * 40000 / rope, nD = d.vz / (Math.PI * 0.25) * 60, iH = 1450 / nD;
  const mF = d.forkKg + d.loadKg, Ff = mF * d.af + 0.05 * mF * G, Pf = Ff * d.vf / d.etaF / 1000, PNf = pickMotor(Pf);
  Object.assign(R, { tFa: Fa, tFr: Fr, tF: Ft, tPpeak: Pp, tPsteady: Ps, tPN: PNt, tI: iT, tTw: Tw, hPs: Phs, hPp: Php, hPN: PNh, hRope: rope, hZp: Zp, hI: iH, fF: Ff, fP: Pf, fPN: PNf });
  r = sec("drive", "Travel, hoist and fork drives – power and selection from the IEC motor series", "Rule used: P_N ≥ P_peak / 1.5 (inverter + motor short-time overload 150 %) and P_N ≥ continuous power. The maker checks RMS torque over the real cycle.");
  r("Travel force", `F = m·a·k_rot + w·m·g = ${mT} × ${d.ax} × ${d.rot} + ${d.roll} × ${mT} × 9.81`, Ft, "N", `acc. ${fmt(Fa, 0)} N + rolling ${fmt(Fr, 0)} N`);
  r("Travel power peak / steady", `P = F · v / η = ${fmt(Ft, 0)} × ${d.vx} / ${d.etaT}`, Pp, "kW", `steady ${fmt(Ps, 2)} kW`);
  r("Travel motor selected", `series ${MOTORS.slice(5, 11).join(" / ")} kW`, PNt, "kW", `gear i ≈ 1450 / ${fmt(nW, 0)} rpm = ${fmt(iT, 1)}, wheel torque ${fmt(Tw, 0)} N·m`, PNt * 1.5 >= Pp);
  r("Hoist power (no counterweight)", `P = m·g·v / η = ${mH} × 9.81 × ${d.vz} / ${d.etaH}`, Phs, "kW", `peak with a: ${fmt(Php, 2)} kW`);
  r("Hoist motor selected", "continuous during lifting → P_N ≥ P", PNh, "kW", `drum Ø250: i ≈ ${fmt(iH, 1)}`, PNh >= Phs);
  r("Hoist rope force / safety", `F = m·(g + a) = ${fmt(rope, 0)} N; 2 ropes MBF 40 kN each`, Zp, "–", "Z_p ≥ ≈ 5 (check EN 528 / maker)", Zp >= 5);
  r("Fork drive", `F = m·a + μ·m·g = ${mF} × ${d.af} + 0.05 × ${mF} × 9.81; P = F·v/η`, Pf, "kW", `selected ${PNf} kW`, PNf >= Pf);

  /* 6 – cycle time FEM 9.851 + throughput */
  const F = femFor(d), core = fem9851();
  const cap = 3600 / ((1 - d.dualShare) * F.sc + d.dualShare * F.dc / 2);
  const demand = sim ? sim.rates.storePerH + sim.rates.retrievePerH : d.demand;
  Object.assign(R, { fem: F, femCore: core, cap, demand, capUtil: demand / cap });
  r = sec("cycle", "Cycle time FEM 9.851 and throughput vs line demand", "P1 = (L/5, 2H/3), P2 = (2L/3, H/5) from the I/O point; each axis a trapezoid, the slower axis decides.");
  r("Rack length / height for FEM", `L = x0 + rack = ${fmt(F.L, 2)} m; H = top level − I/O level`, F.H, "m");
  r("I/O → P1", `x ${fmt(F.P1.x, 2)} m, z ${fmt(F.P1.z - F.zIO, 2)} m`, F.t1, "s");
  r("I/O → P2", `x ${fmt(F.P2.x, 2)} m, z ${fmt(F.P2.z - F.zIO, 2)} m`, F.t2, "s");
  r("P1 → P2", "move between the two points", F.t12, "s");
  r("One stop", `t_pos ${CRANE.tPos} s + fork out ${fmt(F.tf, 2)} + lift ${CRANE.tLift} + fork in ${fmt(F.tf, 2)} s`, F.stop, "s");
  r("Single cycle SC", "t_SC = (2 t1 + 2 t2)/2 + 2 stops", F.sc, "s", `${fmt(F.scPerH, 0)} jobs/h (core ${fmt(core.sc, 1)} s)`);
  r("Dual cycle DC", "t_DC = t1 + t12 + t2 + 4 t_LHD + 3 t_pos", F.dc, "s", `${fmt(F.dcPerH, 0)} jobs/h (core ${fmt(core.dc, 1)} s)`);
  r("Capacity at the dual share", `3600 / ((1 − p)·t_SC + p·t_DC/2), p = ${d.dualShare}`, cap, "jobs/h");
  r(sim ? "LIVE: required by the line" : "Required by the line", sim ? `store ${sim.rates.storePerH} + retrieve ${sim.rates.retrievePerH} jobs/h (item 2/4 settings)` : "example", demand, "jobs/h", `crane utilisation ${fmt(demand / cap * 100, 0)} % (keep ≤ 80 %)`, demand / cap <= 0.8);

  /* 7 – positioning budget */
  const rss = (L) => Math.sqrt(L.reduce((k, x) => k + x[1] * x[1], 0)), sum = (L) => L.reduce((k, x) => k + x[1], 0);
  Object.assign(R, { bxRss: rss(BUDGET_X), bxSum: sum(BUDGET_X), bzRss: rss(BUDGET_Z), bzSum: sum(BUDGET_Z), bxAvail: RACK.gap * 1000, bzAvail: CRANE.liftDz * 1000 / 2 });
  r = sec("budget", "Positioning accuracy budget (example tolerances, ± mm)", "RSS = statistical sum (independent errors); worst case = plain sum. Both must stay inside the free space.");
  BUDGET_X.forEach(([n, v]) => r(`x: ${n}`, "", v, "± mm"));
  r("x: total", "RSS = √Σe² · worst case = Σe", R.bxRss, "± mm", `worst ${R.bxSum} mm ≤ gap ${R.bxAvail} mm`, R.bxSum <= R.bxAvail);
  BUDGET_Z.forEach(([n, v]) => r(`z: ${n}`, "", v, "± mm"));
  r("z: total", "RSS · worst case vs half the lift stroke", R.bzRss, "± mm", `worst ${R.bzSum} mm ≤ ${R.bzAvail} mm`, R.bzSum <= R.bzAvail);

  /* 8 – energy per cycle */
  const mv = (dx, dz, loaded) => {
    const mt = (d.craneKg + (loaded ? d.loadKg : 0)) * d.rot, mh = d.carrKg + (loaded ? d.loadKg : 0);
    const vp = trapPeakV(dx, d.vx, d.ax), Ek = 0.5 * mt * vp * vp, Er = d.roll * (mt / d.rot) * G * Math.abs(dx), Ep = mh * G * dz;
    return { inp: (Ek + Er) / d.etaT + Math.max(0, Ep) / d.etaH, back: d.etaBack * (Ek + Math.max(0, -Ep)) };
  };
  let ein = 0, eback = 0;
  for (const Pp2 of [F.P1, F.P2]) { const dz = Pp2.z - F.zIO; for (const lo of [true, false]) { const m1 = mv(Pp2.x, dz, lo), m2 = mv(Pp2.x, -dz, !lo); ein += m1.inp + m2.inp; eback += m1.back + m2.back; } }
  ein /= 4; eback /= 4;
  const eaux = d.auxKw * 1000 * F.sc, eNo = (ein + eaux) / 3600, eYes = (ein - eback + eaux) / 3600;
  Object.assign(R, { eMotion: ein / 3600, eBack: eback / 3600, eAux: eaux / 3600, eNo, eYes, eSave: 1 - eYes / eNo });
  r = sec("energy", "Energy per single cycle – with and without regenerative DC link", "Mean of the 4 FEM moves (to P1 / P2, loaded out or loaded back). Braking energy: burnt in a resistor, or fed back (η_back) through a shared DC link / regenerative supply.");
  r("Motion energy (motor input)", "E = Σ(½·m·v_p² + w·m·g·s)/η_T + Σ m·g·Δz⁺/η_H", ein / 3600, "Wh");
  r("Recoverable braking energy", `E_back = ${d.etaBack} × (½·m·v_p² + m·g·Δz⁻)`, eback / 3600, "Wh");
  r("Auxiliary (controls, fans, brakes)", `${d.auxKw} kW × t_SC ${fmt(F.sc, 1)} s`, eaux / 3600, "Wh");
  r("Per cycle WITHOUT regeneration", "E_motion + E_aux", eNo, "Wh");
  r("Per cycle WITH regeneration", "E_motion − E_back + E_aux", eYes, "Wh", `saves ${fmt(R.eSave * 100, 0)} %`, true);
  if (sim) { const kp = sim.kpi(); R.liveWh = kp.energyWhPerJob; r("LIVE: twin energy per job", "sim.kpi().energyWhPerJob (simple sim model, no aux)", kp.energyWhPerJob, "Wh"); }
  return { R, S, d };
}

/* hand-check values (Python stdlib, guide §16) for the &sr1test self-check */
export const CHECK = {
  beamI: 1216565, beamM: 698.96, beamSigd: 48.26, beamDefl: 1.036, upNk: 20.60, upNed: 30.37, upChi: 0.8635, upNb: 159.41, floorP: 1.210,
  wR1: 23.44, wR2: 20.70, wdR: 3.290, wRmax: 30.25, wPmean: 27.43, wPal: 74.69, mastTop: 1.864, mastF: 2.546,
  tPpeak: 9.346, tPN: 7.5, hPs: 10.387, hPN: 11, hZp: 8.62, fP: 0.951, sc: 34.81, dc: 57.81, cap: 113.0, bxRss: 8.72, bzRss: 8.25, eNo: 23.90, eYes: 14.88,
};
