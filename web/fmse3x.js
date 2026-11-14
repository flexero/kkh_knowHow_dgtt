/* FMS engineering – item 3 deep panel (loaded by fmse3.js at the end of item 3).
 * 3X element guide for the element selected in 3A (event "fe3sel"): principle & components · types in depth · sizing (basic + deep calculators) ·
 *    interface & IO list (tags PLT1.MACH.FMS1.<UNIT>.<Signal>, data block, handshake partners) · control sequence (animated step chain) · safety ·
 *    failures & maintenance · FAT tests · buy list · use cases.
 * 3D transport selector (weighted stars) · 3E tolerance stack deep (WC / RSS + coarse-to-fine stage designer with funnel diagram).
 * Example numbers: EX3 in fmse3x_data.js = copy of tools/fmse/examples/item3_examples.json (same formulas as guide docs/63 and tools/fmse/*.py).
 * Basic calculators = CALC of fmse3.js (unchanged formulas). Offline; user edits in localStorage keys "fmse.3x.*". Test hook: window.fe3x.results(). */
import { EX3, ASRS_PEAK, STAGES, X20, DEEP } from "./fmse3x_data.js";
import { EL } from "./fmse3_data.js";
import { CALC } from "./fmse3.js";
import { BLOCK, EXTRA } from "./fmse6_data.js";
import { EX as EX1, MODDEEP, MODUSE_NOTE } from "./fmse1x_data.js";
import { MODULES } from "./fmse_data.js";

/* ------------------------------------------------------------------ helpers */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fx = (x, d = 1) => (Number.isFinite(x) ? x.toLocaleString("en", { maximumFractionDigits: d, minimumFractionDigits: d }) : "–");
const rnd = (x, d = 4) => (Number.isFinite(x) ? +x.toFixed(d) : null);
const clone = (o) => JSON.parse(JSON.stringify(o));
const num = (v, d = 0) => { const x = parseFloat(v); return Number.isFinite(x) ? x : d; };
const store = {   // own keys "fmse.3x.<k>"
  get(k, d) { try { const v = localStorage.getItem("fmse.3x." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("fmse.3x." + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
};
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const csvCell = (v) => { const s = String(v == null ? "" : v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const toCSV = (rows) => rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
const ulx = (a) => `<ul class="am-ul">${a.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
const ok = (b, y, n) => (b ? `<span class="fe-ok">✓ ${y}</span>` : `<span class="fe-no">✗ ${n}</span>`);
const card = (id, title, sub, body) => `<div class="card" id="${id}"><div class="card-head"><h2>${title}</h2><span class="sub">${sub}</span></div>${body}</div>`;
const tab = (head, rows, cls = "") => `<div class="fe-scroll"><table class="am-tab ${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
const tr = (cells, bold0 = true) => `<tr>${cells.map((c, i) => `<td>${i === 0 && bold0 ? "<b>" + esc(c) + "</b>" : esc(c)}</td>`).join("")}</tr>`;
const G = EX3.robot_inertia.g;
const tMove = (s, v, a) => (s <= 0 ? 0 : s > v * v / a ? s / v + v / a : 2 * Math.sqrt(s / a));   // same as fmse3.js
const defs = (inp) => Object.fromEntries(inp.map(([k, , d]) => [k, d]));

/* ================================================================== deep calculators (formulas exactly as EX3.formulas) */
// pure functions – used by the programs AND by results()
function fBattery(b) {
  const E_trip = (b.P_drive_kW * b.t_drive_s + b.P_lift_kW * b.t_lift_s) / 3.6;
  const busy = b.trips_per_h * (b.t_drive_s + b.t_lift_s + b.t_other_s);
  const E_h = b.trips_per_h * E_trip + b.P_idle_kW * 1000 * (3600 - busy) / 3600;
  const usable = b.V * b.Ah * b.DoD, runtime = usable / E_h, charge = usable / (b.P_charge_kW * 1000 * b.eta_charge);
  const avail = runtime / (runtime + charge), share = E_h / (b.P_charge_kW * 1000 * b.eta_charge), idle = Math.max(0, 3600 - busy) / 3600;
  const availOpp = share <= idle ? 1 : Math.max(0, 1 - (share - idle));
  return { E_trip, busy, E_h, usable, runtime, charge, avail, share, idle, availOpp };
}
function fFleet(a, availBatt) {   // basic AGV fleet (fmse3.js CALC.agv) resized with the battery availability
  const t = (a.dl + a.de) / a.vv + a.tlu, w = a.tr * t / 3600;
  const nWeb = Math.ceil(w / (a.eta * a.ft) - 1e-9), nBat = Math.ceil(w / (availBatt * a.ft) - 1e-9);
  return { w, nWeb, nBat, extra: Math.max(0, nBat - nWeb) };
}
function fInertia(r) {
  const J = r.m_g * r.e_g ** 2 + r.m_p * (r.a ** 2 + r.b ** 2) / 12 + r.m_p * r.e_p ** 2, M = (r.m_g * r.e_g + r.m_p * r.e_p) * r.g;
  return { J, M, uJ: J / r.J_allow, uM: M / r.M_allow, Jg: r.m_g * r.e_g ** 2, Jp0: r.m_p * (r.a ** 2 + r.b ** 2) / 12, Jps: r.m_p * r.e_p ** 2 };
}
function fAsrs(v, peak, umax) {
  const t = (x, y) => Math.max(tMove(x, v.vx, v.ax), tMove(y, v.vy, v.ay));
  const P1 = [v.L / 5, 2 * v.H / 3], P2 = [2 * v.L / 3, v.H / 5];
  const t1 = t(...P1), t2 = t(...P2), t12 = t(Math.abs(P2[0] - P1[0]), Math.abs(P2[1] - P1[1]));
  const tsc = t1 + t2 + 2 * v.tf + v.td, tdc = t1 + t12 + t2 + 4 * v.tf + v.td, ths = 3600 / tsc, thd = 2 * 3600 / tdc;
  return { t1, t2, t12, tsc, tdc, ths, thd, cranes: Math.ceil(peak / (thd * umax) - 1e-9), util: peak / (Math.ceil(peak / (thd * umax) - 1e-9) * thd) };
}
const fConv = (c) => { const F = c.m_total_kg * c.g * c.mu_roll + c.m_total_kg * c.a; return { Froll: c.m_total_kg * c.g * c.mu_roll, Facc: c.m_total_kg * c.a, F, P: F * c.v / c.eta }; };
const fScrew = (s) => { const F = s.T_Nm / (s.K * s.d_mm / 1000); return { F, use: F / s.proof_load_N, Fmin: s.T_Nm / (s.K * 1.25 * s.d_mm / 1000), Fmax: s.T_Nm / (s.K * 0.75 * s.d_mm / 1000) }; };
const screwVerdict = (u) => (u > 0.9 ? "not OK" : u > 0.8 ? "high" : u >= 0.5 ? "OK" : "low");
const fPress = (p) => { const P = p.E_MPa * p.delta_mm / (2 * p.d_mm) * (1 - (p.d_mm / p.D_mm) ** 2); return { p: P, F: P * Math.PI * p.d_mm * p.L_mm * p.mu }; };
function fLeak(l) {
  const Q = l.V_l * l.dp_mbar / l.dt_s, dpT = l.p_abs_mbar * l.dT_K / l.T_K;
  return { Q, Qcm: Q * 60, dpT, ratio: dpT / l.dp_mbar, dTallow: 0.1 * l.dp_mbar * l.T_K / l.p_abs_mbar, verdict: dpT >= l.dp_mbar ? "NOT OK" : dpT <= 0.1 * l.dp_mbar ? "OK" : "marginal" };
}
function fVision(s) {
  const pm = Math.max(s.fov_x_mm / s.px_x, s.fov_y_mm / s.px_y), n = s.defect_mm / pm;
  return { px_x_mm: s.fov_x_mm / s.px_x, px_y_mm: s.fov_y_mm / s.px_y, pm, n, rep: pm / 10, ok: n >= 3, pxNeedX: Math.ceil(3 * s.fov_x_mm / s.defect_mm), pxNeedY: Math.ceil(3 * s.fov_y_mm / s.defect_mm) };
}
function fTransport(weights, options = EX3.transport_select.options) {
  const sw = weights.reduce((a, b) => a + b, 0) || 1;
  const rows = options.map(([n, st], i) => ({ n, i, s: st.reduce((a, x, k) => a + weights[k] * (k === 3 ? 6 - x : x), 0) / sw }));
  const rank = [...rows].sort((a, b) => b.s - a.s || a.i - b.i);   // ties keep table order
  return { rows, rank };
}
function fStack(con, cap) {
  const t = con.map((c) => Math.abs(num(c[1]))), wc = t.reduce((a, b) => a + b, 0), rss = Math.sqrt(t.reduce((a, b) => a + b * b, 0));
  const v = cap >= wc ? "safe" : cap >= rss ? "risk" : "not OK";
  let bi = 0; t.forEach((x, i) => { if (x > t[bi]) bi = i; });
  const need = Math.max(0, t[bi] - (wc - cap));   // largest contributor must drop to this for a worst-case-safe hand-over
  return { wc, rss, verdict: v, big: con[bi] ? con[bi][0] : "", bigNow: t[bi] || 0, bigNeed: need };
}
function fStages(st, wc, rss, fin) {
  let inc = null;
  const rows = st.map(([n, cap, rem], i) => {
    let v;
    if (i === 0) v = cap >= wc ? "safe" : cap >= rss ? "risk" : "not OK";
    else v = cap >= inc ? "safe" : "not OK";
    const r = { n, cap: +cap, rem: +rem, incWC: i === 0 ? wc : inc, incRSS: i === 0 ? rss : inc, verdict: v };
    inc = +rem; return r;
  });
  const last = rows.length ? rows[rows.length - 1].rem : NaN;
  return { rows, final: last, finalOK: last <= fin + 1e-12, allOK: rows.every((r) => r.verdict !== "not OK") };
}

/* ------------------------------------------------------------------ deep calculator definitions (inputs → shown rows) */
const B = EX3.agv_battery, RI = EX3.robot_inertia, SP = EX3.screw_preload, PF = EX3.press_fit, LK = EX3.leak_test, VI = EX3.vision, CD = EX3.conveyor_drive;
const DC = {
  bat: { t: "AGV battery, runtime, charging and fleet effect", eq: EX3.formulas.agv_battery,
    inp: [["V", "Battery voltage", B.V, "V"], ["Ah", "Capacity", B.Ah, "Ah"], ["DoD", "Usable depth of discharge", B.DoD, ""], ["P_drive_kW", "Drive power while driving", B.P_drive_kW, "kW"], ["t_drive_s", "Driving time per trip", B.t_drive_s, "s"], ["P_lift_kW", "Lift / transfer power", B.P_lift_kW, "kW"], ["t_lift_s", "Lift / transfer time per trip", B.t_lift_s, "s"], ["t_other_s", "Other busy time per trip (docking)", B.t_other_s, "s"], ["trips_per_h", "Trips per hour", B.trips_per_h, "/h"], ["P_idle_kW", "Idle power (electronics, scanners)", B.P_idle_kW, "kW"], ["P_charge_kW", "Charger power", B.P_charge_kW, "kW"], ["eta_charge", "Charging efficiency", B.eta_charge, ""]],
    run(v, S) { const r = fBattery(v), f = fFleet(S.agv, r.availOpp), f0 = fFleet(S.agv, r.avail);
      return { out: [["Energy per trip = (P_drive·t_drive + P_lift·t_lift) ÷ 3.6", r.E_trip, "Wh", 2], ["Busy time per hour = trips·(t_drive + t_lift + t_other)", r.busy, "s/h", 0], ["Energy per hour incl. idle", r.E_h, "Wh", 2], ["Usable energy = V·Ah·DoD", r.usable, "Wh", 0], ["Runtime = usable ÷ E_h", r.runtime, "h", 2], ["Charging time = usable ÷ (P_charge·η)", r.charge, "h", 3], ["Availability without opportunity charging = runtime ÷ (runtime + charge)", 100 * r.avail, "%", 2], ["Opportunity charging needed per working hour", r.share * 60, "min/h", 1], ["Idle time per hour (can be used for charging)", r.idle * 60, "min/h", 1], ["Availability with opportunity charging", 100 * r.availOpp, "%", 1], ["Fleet (basic calculator, availability 0.85)", f.nWeb, "vehicles", 0], ["Fleet with battery availability (opportunity charging)", f.nBat, "vehicles", 0], ["Extra vehicles because of charging", f.extra, "", 0], ["Fleet if vehicles stop to charge (no opportunity charging)", f0.nBat, "vehicles", 0]],
        verdict: (r.share <= r.idle ? "✓ Opportunity charging fits into the idle time – the vehicle never has to leave for charging." : "✗ Charging need exceeds the idle time – bigger charger / battery or more vehicles.") + ` Without opportunity charging the vehicle is away ${fx(100 - 100 * r.avail, 1)} % of the time.` }; } },
  inertia: { t: "Robot load: moment of inertia J and wrist moment M", eq: EX3.formulas.robot_inertia,
    inp: [["m_g", "Gripper mass", RI.m_g, "kg"], ["e_g", "Gripper CoG distance from the axis", RI.e_g, "m"], ["m_p", "Part mass", RI.m_p, "kg"], ["a", "Part size a", RI.a, "m"], ["b", "Part size b", RI.b, "m"], ["c", "Part size c (along the axis)", RI.c, "m"], ["e_p", "Part CoG distance from the axis", RI.e_p, "m"], ["J_allow", "Allowed inertia (wrist axis, data sheet)", RI.J_allow, "kg·m²"], ["M_allow", "Allowed wrist moment", RI.M_allow, "N·m"], ["g", "g", RI.g, "m/s²"]],
    run(v) { const r = fInertia(v);
      return { out: [["Gripper J_g = m_g·e_g²", r.Jg, "kg·m²", 3], ["Part about its own CoG = m_p·(a² + b²) ÷ 12", r.Jp0, "kg·m²", 3], ["Part offset (Steiner) = m_p·e_p²", r.Jps, "kg·m²", 3], ["Total J", r.J, "kg·m²", 3], ["Inertia use J ÷ J_allow", 100 * r.uJ, "%", 1], ["Wrist moment M = (m_g·e_g + m_p·e_p)·g", r.M, "N·m", 3], ["Moment use M ÷ M_allow", 100 * r.uM, "%", 1]],
        verdict: (r.uJ <= 0.8 && r.uM <= 0.8 ? "✓ Both ≤ 80 % – OK." : "✗ Above 80 % – bigger robot, lighter gripper or move the CoG closer to the flange.") + " Note: the offset term m·e² is usually the largest – keep the part close to the flange." }; } },
  asrsPeak: { t: "AS/RS throughput table and crane count for the peak", eq: "t(x,y) = max(t_x, t_y) · single = t(P1)+t(P2)+2·t_fork+t_dead · double = t(P1)+t(P1→P2)+t(P2)+4·t_fork+t_dead · cranes = ⌈peak ÷ (double-cycle throughput × U_max)⌉",
    inp: [["peak", "Peak demand", ASRS_PEAK.peak, "moves/h"], ["umax", "Max. crane utilisation", ASRS_PEAK.umax, ""]],
    run(v, S) { const a = S.asrs, r = fAsrs(a, v.peak, v.umax);
      const rows = ASRS_PEAK.lengths.map((L) => { const q = fAsrs({ ...a, L }, v.peak, v.umax); return `<tr${L === a.L ? ' class="fx-cur"' : ""}><td>${L} m</td><td>${fx(q.tsc, 1)}</td><td>${fx(q.tdc, 1)}</td><td>${fx(q.ths, 0)}</td><td>${fx(q.thd, 0)}</td><td><b>${q.cranes}</b></td></tr>`; });
      return { out: [["t(P1) = max(travel, hoist)", r.t1, "s", 3], ["t(P2)", r.t2, "s", 3], ["t(P1 → P2)", r.t12, "s", 3], ["Single cycle", r.tsc, "s", 3], ["Double cycle", r.tdc, "s", 3], ["Throughput single cycles", r.ths, "moves/h", 1], ["Throughput double cycles", r.thd, "moves/h", 1], ["Cranes for the peak = ⌈peak ÷ (double·U_max)⌉", r.cranes, "", 0], ["Utilisation per crane at the peak", 100 * r.util, "%", 0]],
        verdict: `Rack height ${fx(a.H, 0)} m and all speeds from the basic AS/RS calculator above. Double cycles need the WMS to combine a store and a retrieve order.`,
        html: `<h4>Throughput table – rack length varies (other inputs as above)</h4>${tab(["Rack length", "Single s", "Double s", "Single moves/h", "Double moves/h", "Cranes for peak"], rows)}` }; } },
  convDrive: { t: "Conveyor drive power", eq: EX3.formulas.conveyor_drive,
    inp: [["m_total_kg", "Moving mass (carriers + parts on the section)", CD.m_total_kg, "kg"], ["mu_roll", "Rolling friction μ_roll", CD.mu_roll, ""], ["a", "Acceleration", CD.a, "m/s²"], ["v", "Speed", CD.v, "m/s"], ["eta", "Drive efficiency η", CD.eta, ""], ["g", "g", CD.g, "m/s²"]],
    run(v) { const r = fConv(v);
      return { out: [["Rolling force m·g·μ", r.Froll, "N", 2], ["Acceleration force m·a", r.Facc, "N", 2], ["Total force F", r.F, "N", 2], ["Power P = F·v ÷ η", r.P, "W", 2], ["Suggested motor (× 1.5 reserve, next size)", r.P * 1.5, "W", 0]],
        verdict: "Accumulating conveyors: add the friction of the parts sliding on the running belt / rollers (μ 0.1–0.3 on the accumulated mass)." }; } },
  screw: { t: "Screw preload (torque method) with friction scatter", eq: EX3.formulas.screw_preload,
    inp: [["T_Nm", "Tightening torque T", SP.T_Nm, "N·m"], ["K", "Nut factor K", SP.K, ""], ["d_mm", "Nominal diameter d", SP.d_mm, "mm"], ["proof_load_N", "Proof load of the screw", SP.proof_load_N, "N"]],
    run(v) { const r = fScrew(v), vd = screwVerdict(r.use);
      return { out: [["Preload F = T ÷ (K·d)", r.F, "N", 0], ["Preload ÷ proof load", 100 * r.use, "%", 1], ["If K is 25 % higher (dry, rough)", r.Fmin, "N", 0], ["If K is 25 % lower (oiled, smooth)", r.Fmax, "N", 0], ["Low preload ÷ proof load", 100 * r.Fmax / v.proof_load_N, "%", 0]],
        verdict: `${vd === "OK" ? "✓" : vd === "high" || vd === "low" ? "◐" : "✗"} Preload ${fx(100 * r.use, 1)} % of the proof load → ${vd} (rule of thumb VDI 2230: 50–80 % OK, 80–90 % high, > 90 % not OK, < 50 % low). With low friction the same torque gives ${fx(100 * r.Fmax / v.proof_load_N, 0)} % – that is why torque + angle monitoring is used.` }; } },
  press: { t: "Press-fit pressure and press force", eq: EX3.formulas.press_fit,
    inp: [["d_mm", "Shaft / joint diameter d", PF.d_mm, "mm"], ["D_mm", "Hub outer diameter D", PF.D_mm, "mm"], ["L_mm", "Fit length L", PF.L_mm, "mm"], ["delta_mm", "Interference δ (on diameter)", PF.delta_mm, "mm"], ["E_MPa", "Young's modulus E (same material)", PF.E_MPa, "MPa"], ["mu", "Friction μ while pressing", PF.mu, ""]],
    run(v) { const r = fPress(v);
      return { out: [["Fit pressure p = E·δ ÷ (2d)·(1 − (d/D)²)", r.p, "MPa", 2], ["Press force F = p·π·d·L·μ", r.F, "N", 0], ["Press force", r.F / 1000, "kN", 2], ["Press size ≥ 1.5 × F", 1.5 * r.F / 1000, "kN", 1]],
        verdict: "Set the force–distance window from 20–30 good parts: force at end position within ± 15–20 %, plus the curve must stay inside the envelope (no early peak = no cocking)." }; } },
  leakD: { t: "Leak test – leak rate and the temperature trap", eq: EX3.formulas.leak_test,
    inp: [["V_l", "Test volume V", LK.V_l, "l"], ["dp_mbar", "Pressure drop at the limit Δp", LK.dp_mbar, "mbar"], ["dt_s", "Test time Δt", LK.dt_s, "s"], ["p_abs_mbar", "Absolute test pressure", LK.p_abs_mbar, "mbar"], ["dT_K", "Temperature change during the test ΔT", LK.dT_K, "K"], ["T_K", "Absolute temperature T", LK.T_K, "K"]],
    run(v) { const r = fLeak(v);
      return { out: [["Leak rate Q = V·Δp ÷ Δt", r.Q, "mbar·l/s", 3], ["Leak rate ≈ Q·60", r.Qcm, "cm³/min", 2], ["Temperature error Δp_T = p_abs·ΔT ÷ T", r.dpT, "mbar", 3], ["Δp_T ÷ Δp limit", 100 * r.ratio, "%", 0], ["Allowed ΔT for Δp_T ≤ 10 % of the limit", r.dTallow, "K", 4]],
        verdict: `${r.verdict === "OK" ? "✓" : r.verdict === "marginal" ? "◐" : "✗"} ${r.verdict}: rule Δp_T ≥ limit → NOT OK, Δp_T ≤ 10 % of the limit → OK, between → marginal. Only ${fx(v.dT_K, 2)} K gives ${fx(r.dpT, 2)} mbar – to be safe the part may change only ${fx(r.dTallow, 4)} K during the test.`,
        html: leakChart(v, r) }; } },
  visD: { t: "Vision – pixel size, pixels per defect, repeatability", eq: EX3.formulas.vision,
    inp: [["fov_x_mm", "Field of view X", VI.fov_x_mm, "mm"], ["fov_y_mm", "Field of view Y", VI.fov_y_mm, "mm"], ["px_x", "Sensor pixels X", VI.px_x, ""], ["px_y", "Sensor pixels Y", VI.px_y, ""], ["defect_mm", "Smallest defect", VI.defect_mm, "mm"]],
    run(v) { const r = fVision(v);
      return { out: [["Pixel size X = FOV_x ÷ px_x", r.px_x_mm, "mm", 5], ["Pixel size Y = FOV_y ÷ px_y", r.px_y_mm, "mm", 5], ["Pixel size (worst)", r.pm, "mm", 5], ["Pixels per defect", r.n, "px", 2], ["Repeatability ≈ pixel ÷ 10", r.rep, "mm", 4], ["Pixels needed for 3 px (X × Y)", 0, `${r.pxNeedX} × ${r.pxNeedY}`, -1]],
        verdict: (r.ok ? "✓ ≥ 3 px per defect – detectable." : "✗ < 3 px per defect – more pixels or smaller field of view.") + " For measuring a feature use ≥ 10 px across the tolerance, and prove it with a gauge study." }; } },
};
// which calculators the Sizing tab shows per element (basic CALC first)
const DEEPCALC = { agv: ["bat"], rob: ["inertia"], grip: ["inertia"], asrs: ["asrsPeak"], sheet: ["asrsPeak"], conv: ["convDrive"], asm: ["screw", "press"], test: ["leakD"], vis: ["visD"], meas: ["visD"], id: ["visD"] };

function leakChart(v, r) {
  const W = 520, H = 210, x0 = 52, x1 = W - 14, y0 = H - 34, y1 = 12, dTm = Math.max(0.2, v.dT_K * 1.5), pm = Math.max(v.dp_mbar * 1.6, r.dpT * 1.2, 0.1);
  const X = (t) => x0 + t / dTm * (x1 - x0), Y = (p) => y0 - p / pm * (y0 - y1), k = v.p_abs_mbar / v.T_K;
  let s = "";
  for (let i = 0; i <= 4; i++) { const p = pm * i / 4, t = dTm * i / 4; s += `<line class="fe-grid" x1="${x0}" x2="${x1}" y1="${Y(p)}" y2="${Y(p)}"/><text class="fe-tick" x="${x0 - 5}" y="${Y(p) + 4}" text-anchor="end">${fx(p, 1)}</text><text class="fe-tick" x="${X(t)}" y="${y0 + 14}" text-anchor="middle">${fx(t, 2)}</text>`; }
  s += `<rect class="f3-zok" x="${x0}" y="${Y(0.1 * v.dp_mbar)}" width="${x1 - x0}" height="${y0 - Y(0.1 * v.dp_mbar)}"/>`;
  s += `<line class="f2-lim" x1="${x0}" x2="${x1}" y1="${Y(v.dp_mbar)}" y2="${Y(v.dp_mbar)}"/><text class="fe-tick" x="${x1 - 4}" y="${Y(v.dp_mbar) - 4}" text-anchor="end">leak limit Δp = ${fx(v.dp_mbar, 1)} mbar</text>`;
  s += `<line class="f3-tline" x1="${X(0)}" y1="${Y(0)}" x2="${X(dTm)}" y2="${Y(Math.min(pm, k * dTm))}"/>`;
  s += `<circle class="f3-tdot" cx="${X(v.dT_K)}" cy="${Y(Math.min(pm, r.dpT))}" r="5"/><text class="f2-plab" x="${X(v.dT_K) + 8}" y="${Y(Math.min(pm, r.dpT)) + 4}">ΔT ${fx(v.dT_K, 2)} K → ${fx(r.dpT, 2)} mbar</text>`;
  s += `<text class="fe-axis" x="${(x0 + x1) / 2}" y="${H - 4}" text-anchor="middle">temperature change during the test ΔT [K]</text><text class="fe-axis" transform="translate(12 ${(y0 + y1) / 2}) rotate(-90)" text-anchor="middle">Δp_T [mbar]</text>`;
  return `<h4>The temperature trap – pressure change from temperature alone</h4><svg class="fe-chart f3-small" viewBox="0 0 ${W} ${H}" role="img" aria-label="temperature error chart">${s}</svg>
    <p class="am-note">Green band = temperature error ≤ 10 % of the leak limit (OK). The line is Δp_T = p_abs·ΔT ÷ T: every 0.01 K gives ${fx(k * 0.01, 2)} mbar at this pressure.</p>`;
}

/* ================================================================== state */
const R = {};
const TABS = [["prin", "Principle & components"], ["types", "Types in depth"], ["size", "Sizing"], ["iface", "Interface & IO list"], ["seq", "Control sequence"], ["safe", "Safety"], ["fail", "Failures & maintenance"], ["fat", "FAT tests"], ["buy", "Buy list"], ["uses", "Use cases"]];
let SEL = "pool", TAB = store.get("tab", "prin");
if (!TABS.some((t) => t[0] === TAB)) TAB = "prin";
const SV = store.get("calc", {});   // calculator inputs per calc key (basic + deep)
function calcState(key) {
  const def = CALC[key] ? defs(CALC[key].inp) : DC[key] ? defs(DC[key].inp) : {};
  SV[key] = { ...def, ...(SV[key] || {}) };
  Object.keys(SV[key]).forEach((k) => { if (!(k in def)) delete SV[key][k]; });
  return SV[key];
}
const SPROXY = new Proxy({}, { get: (_, k) => calcState(k) });   // S.agv / S.asrs for deep calculators
let anim = null;

/* ================================================================== mount */
export function mount(el, sel0) {
  if (sel0 && DEEP[sel0]) SEL = sel0;
  el.innerHTML = html3X() + html3D() + html3E();
  const it = [init3X, init3D, init3E];
  it.forEach((f) => { try { f(); } catch (e) { console.error("fmse3x " + f.name, e); R.errors = (R.errors || []).concat(f.name + ": " + e.message); } });
  document.addEventListener("fe3sel", (e) => { if (DEEP[e.detail] && e.detail !== SEL) { SEL = e.detail; drawX(); } });
  window.fe3x = { results, show: (k, t) => { if (DEEP[k]) SEL = k; if (t) TAB = t; drawX(); return !!$("f3Body").innerHTML.trim(); }, checkAll };
}

/* ================================================================== 3X element guide */
function html3X() {
  return card("f33X", "3X · Element guide – principle, sizing, IO list, control sequence, safety, FAT, buying", "follows the element selected in 3A · 10 tabs · all numbers are examples",
    `<div class="fe-row"><label>Element <select id="f3Sel">${EL.map((e) => `<option value="${e.k}">${esc(e.mod)} · ${esc(e.n)}</option>`).join("")}</select></label>
       <span class="sub" id="f3Mod"></span></div>
     <div class="f3-tabs" role="tablist">${TABS.map(([k, n]) => `<button class="mx-el" role="tab" data-t="${k}">${esc(n)}</button>`).join("")}</div>
     <div id="f3Body" class="f3-body"></div>`);
}
function init3X() {
  $("f3Sel").addEventListener("change", (e) => {
    const b = document.querySelector(`.fe-elb[data-el="${CSS.escape(e.target.value)}"]`);
    if (b) b.click(); else { SEL = e.target.value; drawX(); }   // 3A click → event → drawX
  });
  document.querySelector("#f33X .f3-tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (b) { TAB = b.dataset.t; store.set("tab", TAB); drawX(); } });
  const body = $("f3Body");
  body.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.ck) { calcState(t.dataset.ck)[t.dataset.v] = num(t.value); store.set("calc", SV); drawCalcOut(); }
    if (t.dataset.fat != null) { const f = store.get("fat." + SEL, {}); f[t.dataset.fat] = t.checked; store.set("fat." + SEL, f); fatProg(); }
  });
  body.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const a = b.dataset.act;
    if (a === "reset") { delete SV[b.dataset.ck]; store.set("calc", SV); drawX(); }
    if (a === "csv") ioCsv();
    if (a === "play") { anim && anim.toggle(); }
    if (a === "step") { anim && anim.step(); }
  });
  body.addEventListener("change", (e) => { if (e.target.id === "f3Spd" && anim) anim.speed = +e.target.value; });
  drawX();
}
const el = () => EL.find((e) => e.k === SEL) || EL[0];
const modOf = (k) => (DEEP[k] ? DEEP[k].mod : "M19");
const unitOf = (m) => (MODDEEP[m] ? MODDEEP[m].u : m);
const tagOf = (m, s) => `PLT1.MACH.FMS1.${unitOf(m)}.${s}`;

function drawX() {
  if (anim) { anim.stop(); anim = null; }
  const e = el(), d = DEEP[e.k], m = d.mod;
  $("f3Sel").value = e.k;
  const mn = MODULES.find((x) => x[0] === m);
  $("f3Mod").textContent = `module ${e.mod} · primary ${m}${mn ? " " + mn[1] : ""} · unit code ${unitOf(m)} · group ${e.g}`;
  document.querySelectorAll("#f33X .f3-tabs [data-t]").forEach((b) => { b.classList.toggle("active", b.dataset.t === TAB); b.setAttribute("aria-selected", b.dataset.t === TAB); });
  const f = { prin: tPrin, types: tTypes, size: tSize, iface: tIface, seq: tSeq, safe: tSafe, fail: tFail, fat: tFat, buy: tBuy, uses: tUses }[TAB];
  $("f3Body").innerHTML = `<h3 class="fe-h3">${esc(e.n)} <span class="sub">${esc(TABS.find((t) => t[0] === TAB)[1])}</span></h3>` + f(e, d);
  if (TAB === "size") drawCalcOut();
  if (TAB === "seq") startAnim(d);
  if (TAB === "fat") fatProg();
}

/* ---------------- tab: principle & components */
function tPrin(e, d) {
  return `<div class="fx-guide"><div class="fx-prin">${d.prin}</div></div>
    <p class="am-note"><b>In one sentence:</b> ${esc(e.what)}</p>
    <h4>Main components – what each does and what to check</h4>
    ${tab(["Component", "Function", "What to check"], d.comp.map((r) => tr(r)))}
    <div class="grid2 eq"><div><h4>Key parameters</h4>${ulx(e.params)}</div><div><h4>Selection rules</h4>${ulx(e.rules)}</div></div>
    <div class="grid2 eq"><div><h4>Interface (module faces)</h4><table class="am-kv"><tbody><tr><td>Mechanical</td><td>${esc(e.iface[0])}</td></tr><tr><td>Signals / data</td><td>${esc(e.iface[1])}</td></tr></tbody></table></div>
      <div><h4>Typical mistakes</h4>${ulx(e.mist)}</div></div>`;
}
/* ---------------- tab: types in depth */
function tTypes(e, d) {
  return `${tab(["Type", "How it works", "+ Strengths", "− Weaknesses", "Use when"], e.types.map((r) => tr(r)))}
    <h4>Each type in depth</h4><div class="f3-types">${d.types.map(([n, t]) => `<div class="fx-use"><b>${esc(n)}</b><p>${esc(t)}</p></div>`).join("")}</div>
    <p class="am-note">Choose the type with the selection rules (Principle tab), then size it in the Sizing tab and check the hand-over with 3E.</p>`;
}
/* ---------------- tab: sizing */
function calcList(e) { return [e.calc, ...(DEEPCALC[e.k] || [])]; }
function tSize(e) {
  return calcList(e).map((ck, i) => {
    const c = CALC[ck] && i === 0 ? CALC[ck] : DC[ck], v = calcState(ck);
    return `<div class="fx-box f3-calc"><h4>${i === 0 ? "Basic" : "Deep"} · ${esc(c.t)} <button class="mx-el fe-link" data-act="reset" data-ck="${ck}">reset to example</button></h4>
      ${c.eq ? `<p class="phd-eq f3-eq">${esc(c.eq)}</p>` : ""}
      <div class="grid2 eq fx-top0"><div><table class="am-kv fe-calc"><tbody>${c.inp.map(([k, n, , u]) => `<tr><td>${esc(n)}</td><td><input type="number" step="any" data-ck="${ck}" data-v="${k}" value="${v[k]}"> ${esc(u)}</td></tr>`).join("")}</tbody></table></div>
        <div id="f3Out_${ck}"></div></div><div id="f3Wx_${ck}"></div></div>`;
  }).join("") + `<p class="am-note">Basic calculator = the same as in 3A (web/fmse3.js). Deep calculators use tools/fmse/examples/item3_examples.json – the textbook and the Python tools give the same numbers with the example inputs.</p>`;
}
function drawCalcOut() {
  calcList(el()).forEach((ck, i) => {
    const o = $("f3Out_" + ck); if (!o) return;
    const c = CALC[ck] && i === 0 ? CALC[ck] : DC[ck], v = calcState(ck);
    let r; try { r = c.run(v, SPROXY); } catch (err) { o.innerHTML = `<p class="fe-no">${esc(err.message)}</p>`; return; }
    const val = ([, x, u, d]) => (d < 0 ? esc(u) : fx(x, d) + " " + esc(u));
    o.innerHTML = `<table class="am-kv"><tbody>${r.out.map((row) => `<tr><td>${esc(row[0])}</td><td><b>${val(row)}</b></td></tr>`).join("")}</tbody></table>${r.verdict ? `<p class="am-note">${esc(r.verdict)}</p>` : ""}${r.html || ""}`;
    $("f3Wx_" + ck).innerHTML = `<details class="fx-more f2-wx"><summary><b>Worked example</b> – step by step with the numbers above</summary><ol class="fx-steps">
      <li>Inputs: ${c.inp.map(([k, n, , u]) => `${esc(n)} = <b>${esc(String(+(+v[k]).toFixed(6)))}</b> ${esc(u)}`).join(" · ")}</li>
      ${r.out.map((row) => `<li>${esc(row[0])} → <b>${val(row)}</b></li>`).join("")}
      <li>Decision: ${esc(r.verdict || "compare with the rule in the text")}</li></ol></details>`;
  });
}
/* ---------------- tab: interface & IO list */
function ioRows(e, d) {
  const m = d.mod, base = (MODDEEP[m] ? MODDEEP[m].io : []).map((r) => [...r, "module standard " + m]);
  return base.concat((d.io || []).map((r) => [...r, "element " + e.k]));
}
function blockRows(m) {
  const ext = EXTRA[m] ? [EXTRA[m], "web/fmse6_data.js EXTRA"] : X20[m] ? [X20[m], "this guide (fmse3x_data.js X20)"] : [[], "none"];
  return { rows: BLOCK.map((r) => [...r, "standard"]).concat(ext[0].map((r) => [...r, "module"])), src: ext[1] };
}
function partners(m) {
  const rows = [];
  EX1.interfaces.forEach(([a, b, ty, tx]) => {
    if (a === m || b === m) rows.push([a === m ? b : a, ty, tx]);
    else if (b === "*" || b === "*physical" || b === "*networked") { if (!(b === "*physical" && m === "M09")) rows.push([a + " (" + b + ")", ty, tx]); }
  });
  return rows;
}
function tIface(e, d) {
  const m = d.mod, md = MODDEEP[m], io = ioRows(e, d), bl = blockRows(m), pa = partners(m), no = +m.slice(1);
  return `<p class="phd-eq">tag = PLT1.MACH.FMS1.${esc(unitOf(m))}.&lt;Signal&gt; · data block word 0–19 standard (item 6F), word 20+ module-specific · alarm no. = ${no} × 1000 + n</p>
    <p class="am-note">${esc(MODUSE_NOTE)}</p>
    <h4>Hard-wired / fieldbus IO list <button class="mx-el fe-link" data-act="csv">Export IO list + data block CSV</button></h4>
    ${tab(["Signal", "Tag", "Dir. (cell view)", "Type", "Meaning", "Source"], io.map(([s, dir, ty, mean, src]) => `<tr><td><b>${esc(s)}</b></td><td><code>${esc(tagOf(m, s))}</code></td><td>${esc(dir)}</td><td>${esc(ty)}</td><td>${esc(mean)}</td><td class="sub">${esc(src)}</td></tr>`), "fx-io")}
    <h4>Standard module data block (Modbus TCP holding registers / OPC UA) <span class="sub">module part from word 20: ${esc(bl.src)}</span></h4>
    ${tab(["Word", "Tag", "Type", "Dir. (module view)", "Meaning", "Part"], bl.rows.map(([w, n, ty, dir, mean, part]) => `<tr${part === "module" ? ' class="fx-cur"' : ""}><td>${w}</td><td><code>${esc(tagOf(m, n))}</code></td><td>${esc(ty)}</td><td>${esc(dir)}</td><td>${esc(mean)}</td><td>${part}</td></tr>`), "fx-io")}
    <h4>Handshake partners (module interface list, item 1M)</h4>
    ${tab(["Partner", "Type", "What is exchanged"], pa.map((r) => tr(r)))}
    ${md ? `<p class="am-note"><b>Partners in the module standard:</b> ${esc(md.partners.join(" · "))}</p>
    <h4>Standard alarms of ${esc(m)}</h4>${tab(["Alarm no.", "Text", "Reaction"], md.faults.map(([n, t, r]) => `<tr><td><b>${no * 1000 + n}</b></td><td>${esc(t)}</td><td>${esc(r)}</td></tr>`))}` : ""}
    <p class="am-note">Handshake rule: the giver sets ReadyToGive, the taker ReadyToTake; transfer runs only with both; each side resets its bit after TransferDone. Time-out on every step → alarm, never wait forever.</p>`;
}
function ioCsv() {
  const e = el(), d = DEEP[e.k], m = d.mod;
  const rows = [["kind", "word_or_signal", "tag", "dir", "type", "meaning"]];
  ioRows(e, d).forEach(([s, dir, ty, mean]) => rows.push(["io", s, tagOf(m, s), dir, ty, mean]));
  blockRows(m).rows.forEach(([w, n, ty, dir, mean]) => rows.push(["block", w, tagOf(m, n), dir, ty, mean]));
  download(`io_${unitOf(m)}_${e.k}.csv`, toCSV(rows), "text/csv");
}
/* ---------------- tab: control sequence (animated step chain, GRAFCET style) */
function tSeq(e, d) {
  const st = d.seq.steps, tot = st.reduce((a, s) => a + num(s[3]), 0);
  const W = 440, top = 16, hs = 74, H = top + st.length * hs + 16;
  let s = `<line class="f3-loop" x1="22" y1="${top + 18}" x2="22" y2="${top + (st.length - 1) * hs + 52}"/>`;
  s += `<path class="f3-loop" d="M40 ${top + (st.length - 1) * hs + 52} L40 ${H - 6} L10 ${H - 6} L10 ${top - 4} L40 ${top - 4} L40 ${top}"/><polygon class="f3-arr" points="36,${top - 1} 44,${top - 1} 40,${top + 5}"/>`;
  st.forEach(([n, act, cond, t], i) => {
    const y = top + i * hs;
    s += `<g class="f3-step" data-i="${i}"><rect class="f3-sbox" x="22" y="${y}" width="36" height="36" rx="3"/>${i === 0 ? `<rect class="f3-sbox f3-init" x="25" y="${y + 3}" width="30" height="30" rx="2"/>` : ""}
      <text class="f3-sno" x="40" y="${y + 23}" text-anchor="middle">${i}</text><line class="f3-link" x1="58" y1="${y + 18}" x2="76" y2="${y + 18}"/>
      <rect class="f3-abox" x="76" y="${y}" width="${W - 84}" height="36" rx="3"/>
      <text class="f3-an" x="84" y="${y + 15}">${esc(n)} · ${fx(num(t), 0)} s</text><text class="f3-at" x="84" y="${y + 30}">${esc(act.length > 56 ? act.slice(0, 54) + "…" : act)}</text></g>`;
    s += `<line class="f3-tr" x1="40" y1="${y + 36}" x2="40" y2="${y + hs}"/><line class="f3-trb" x1="30" y1="${y + 54}" x2="50" y2="${y + 54}"/><text class="f3-tc" x="58" y="${y + 58}">${esc(cond.length > 58 ? cond.slice(0, 56) + "…" : cond)}</text>`;
  });
  s += `<circle class="f3-tok" id="f3Tok" cx="40" cy="${top + 36}" r="6"/>`;
  return `<p class="am-note"><b>${esc(d.seq.t)}</b> – step chain as written in the PLC (one step active at a time; the transition condition below each step must be true to go on). Total typical cycle <b>${fx(tot, 0)} s</b>.</p>
    <div class="fe-row"><button class="mx-el" data-act="play" id="f3Play">❚❚ pause</button><button class="mx-el" data-act="step">step ▶</button>
      <label>Speed <select id="f3Spd"><option value="0.5">slow</option><option value="1" selected>normal</option><option value="2">fast</option></select></label>
      <span class="sub" id="f3Now"></span></div>
    <div class="f3-seqwrap"><svg class="fe-chart f3-seq" viewBox="0 0 ${W} ${H}" role="img" aria-label="step chain">${s}</svg></div>
    ${tab(["Step", "Name", "Action (outputs set in this step)", "Transition condition", "Typical s", "Cumulative s"], st.map((r, i) => `<tr data-row="${i}"><td>${i}</td><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${fx(num(r[3]), 0)}</td><td>${fx(st.slice(0, i + 1).reduce((a, x) => a + num(x[3]), 0), 0)}</td></tr>`), "f3-seqt")}
    <details class="fx-more"><summary><b>How to program it (structured text pattern)</b></summary>
      <pre class="fx-md">CASE Step OF
${st.map((r, i) => `  ${i}: (* ${r[0]} *)  ${"\n"}     (* action: ${r[1]} *)${"\n"}     IF ${r[2].replace(/[^\w ./=<>≥≤+±%-]/g, "")} THEN Step := ${(i + 1) % st.length}; StepTimer(IN := FALSE); END_IF;`).join("\n")}
END_CASE;
StepTimer(IN := TRUE, PT := T#30S);  IF StepTimer.Q THEN Alarm := ${+d.mod.slice(1) * 1000 + 99}; END_IF;  (* time-out per step *)</pre>
      <p class="am-note">Every step has a time-out (alarm number from the module range), every output is set only in its step, and a stop / fault leads to a defined safe step – see item 5 (PackML states).</p></details>`;
}
function startAnim(d) {
  const st = d.seq.steps, svg = document.querySelector("#f3Body .f3-seq"); if (!svg) return;
  const dur = (t) => Math.min(2.6, Math.max(0.7, 0.5 + 0.7 * Math.log10(1 + num(t))));
  const A = { i: 0, t0: performance.now(), run: true, speed: 1, id: 0 };
  const show = () => {
    svg.querySelectorAll(".f3-step").forEach((g) => g.classList.toggle("f3-act", +g.dataset.i === A.i));
    document.querySelectorAll("#f3Body .f3-seqt tr[data-row]").forEach((r) => r.classList.toggle("fx-cur", +r.dataset.row === A.i));
    const now = $("f3Now"); if (now) now.textContent = `active step ${A.i}: ${st[A.i][0]} – waiting for: ${st[A.i][2]}`;
  };
  const tick = (ts) => {
    if (!svg.isConnected) return;
    const D = dur(st[A.i][3]) * 1000 / A.speed, p = Math.min(1, (ts - A.t0) / D);
    const tok = $("f3Tok"); if (tok) tok.setAttribute("cy", (16 + A.i * 74 + 36 + p * 38).toFixed(1));
    if (A.run && p >= 1) { A.i = (A.i + 1) % st.length; A.t0 = ts; show(); }
    if (!A.run) A.t0 = ts - p * D;
    A.id = requestAnimationFrame(tick);
  };
  A.toggle = () => { A.run = !A.run; const b = $("f3Play"); if (b) b.textContent = A.run ? "❚❚ pause" : "▶ play"; };
  A.step = () => { A.i = (A.i + 1) % st.length; A.t0 = performance.now(); show(); };
  A.stop = () => cancelAnimationFrame(A.id);
  show(); A.id = requestAnimationFrame(tick); anim = A;
}
/* ---------------- tab: safety */
function tSafe(e, d) {
  return `<p>Every element gets a <b>risk assessment</b> (ISO 12100): find the hazards, estimate the risk, reduce it by design first, then by safety functions and guards, then by
    information. The required performance level (PL a–e, ISO 13849-1) of each safety function follows from severity, frequency of exposure and possibility to avoid.</p>
    ${tab(["Hazard", "Typical safety function / measure", "PL / standard (typical)"], d.haz.map((r) => tr(r)))}
    <div class="grid2 eq"><div><h4>Common safety functions in FMS elements</h4>${ulx(["Guard door with interlock and guard locking (STO + lock until standstill)", "Light curtain / laser scanner with muting for material passage", "Safe speed / safe zones for robots and vehicles (SLS, SafeZone)", "Emergency stop in a cell-wide circuit (M18), stop category 0 or 1", "Enabling device + reduced speed for set-up mode", "Two-hand control or hold-to-run for clamping"])}</div>
      <div><h4>Checks in the project</h4>${ulx(["Safety distance S = K·T + C (ISO 13855) with the MEASURED stopping time", "PL verification (e.g. SISTEMA) for each safety function", "Safety interface sheet with M18 (which zones, which stop category)", "Validation test of every safety function at FAT and SAT, signed", "Muting only with two independent sensors and a time limit"])}</div></div>`;
}
/* ---------------- tab: failures & maintenance */
function tFail(e, d) {
  const rows = d.fmea.map((r) => { const rpn = r[4] * r[5] * r[6]; return `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${r[4]}</td><td>${r[5]}</td><td>${r[6]}</td><td class="${rpn >= 100 || r[4] >= 9 ? "fx-neg" : rpn >= 60 ? "f3-mid" : ""}"><b>${rpn}</b></td></tr>`; });
  const md = MODDEEP[d.mod];
  return `<p>FMEA (failure mode and effects analysis): for each way the element can fail, rate <b>S</b> severity, <b>O</b> occurrence and <b>D</b> detection (1 = good … 10 = bad).
      <span class="phd-eq">RPN = S × O × D</span> – act first where RPN ≥ 100 or S ≥ 9 (red), then 60–99 (amber).</p>
    ${tab(["Failure mode", "Effect", "Cause", "Detection / prevention", "S", "O", "D", "RPN"], rows, "f3-fmea")}
    <h4>Maintenance plan (typical intervals – follow the maker's manual)</h4>
    ${tab(["Task", "Interval"], d.maint.map((r) => tr(r)))}
    ${md ? `<p class="am-note"><b>Module alarms</b> to connect with these failures: ${md.faults.map(([n, t]) => `${+d.mod.slice(1) * 1000 + n} ${esc(t)}`).join(" · ")}</p>` : ""}`;
}
/* ---------------- tab: FAT */
function tFat(e, d) {
  const chk = store.get("fat." + e.k, {}), md = MODDEEP[d.mod];
  return `<p>The factory acceptance test (FAT) at the supplier proves the element before shipping. Write each step with a <b>measurable acceptance value</b>; the supplier signs, you sign.
      Tick the steps as you go – the ticks are kept in this browser only.</p>
    <div class="fe-row"><div class="fe-prog"><i id="f3FatBar"></i></div><span class="sub" id="f3FatTxt"></span></div>
    ${tab(["Done", "Test step", "Acceptance value"], d.fat.map(([s, a], i) => `<tr><td><input type="checkbox" data-fat="${i}" ${chk[i] ? "checked" : ""} aria-label="done"></td><td><b>${esc(s)}</b></td><td>${esc(a)}</td></tr>`))}
    ${md ? `<h4>Plus the module-standard FAT steps of ${esc(d.mod)} (item 1M)</h4>${ulx(md.fat)}` : ""}
    <p class="am-note">Bring to the FAT: the IO list (Interface tab), the step chain (Control sequence tab), test parts, a stopwatch, a dial gauge and the signed interface sheets.</p>`;
}
function fatProg() {
  const d = DEEP[SEL], chk = store.get("fat." + SEL, {}), n = d.fat.filter((_, i) => chk[i]).length, b = $("f3FatBar"), t = $("f3FatTxt");
  if (b) b.style.width = (100 * n / d.fat.length).toFixed(0) + "%"; if (t) t.textContent = `${n} of ${d.fat.length} steps passed`;
}
/* ---------------- tab: buy list */
function tBuy(e, d) {
  return `<p class="fx-alert">Makers and series are <b>examples</b> of well-known suppliers, not a recommendation and not a complete list. Prices are rough classes – <b>estimate only, ask for a quote</b>.</p>
    <div class="grid2 eq"><div><h4>Example makers and product families</h4>${tab(["Maker", "Series / product family"], d.buy.mk.map((r) => tr(r)))}</div>
      <div><h4>What to check in the datasheet / offer</h4><ol class="fx-steps">${d.buy.chk.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div></div>
    <table class="am-kv"><tbody><tr><td>Price class</td><td><b>${esc(d.buy.price)}</b></td></tr>
      <tr><td>Always ask for</td><td>the automation interface (IO list, data block from word 20), CE / declaration of incorporation, spare parts list with prices, service reaction time, training, FAT at the supplier</td></tr></tbody></table>
    <p class="am-note">Get at least 3 offers, compare them with the weighted scoring of item 2E and the life-cycle cost of item 2L.</p>`;
}
/* ---------------- tab: use cases */
function tUses(e, d) {
  return `<div class="fx-uses">${d.uses.map(([n, t]) => `<div class="fx-use"><b>${esc(n)}</b><p>${esc(t)}</p></div>`).join("")}</div>
    <h4>How to use it in a real project</h4>${ulx(d.howto)}`;
}

/* ================================================================== 3D transport selector */
const TS = EX3.transport_select;
let TW = store.get("tw", null), TN = store.get("tn", 0);
if (!Array.isArray(TW) || TW.length !== 4) TW = [...TS.needs[0][1]];
function html3D() {
  return card("f33D", "3D · Transport selector – weight your needs, score the options", "stars from 3B · investment counts as 6 − stars (cheap = good) · score = Σ w·s ÷ Σ w",
    `<div class="fx-guide"><div class="fx-prin"><p>3B shows the stars of each transport option. Which option is best depends on <b>what your project needs</b>: give each criterion a weight 1–5,
      the program computes the weighted mean of the stars and ranks the options. Investment stars mean "expensive", so the score uses <b>6 − stars</b>.</p>
      <p class="phd-eq">score = Σ wₖ·sₖ ÷ Σ wₖ · s_investment = 6 − stars</p></div></div>
     <div class="fe-row" id="f3Needs">${TS.needs.map(([n], i) => `<button class="mx-el" data-need="${i}">${esc(n)}</button>`).join("")}</div>
     <div class="grid2"><div id="f3TRes"></div><div><h4>Weights 1–5 for your need</h4><table class="am-kv fe-calc"><tbody>${TS.criteria.map((c, k) => `<tr><td>${esc(c)}</td><td><input type="number" min="0" max="5" step="1" data-w="${k}" value="${TW[k]}"></td></tr>`).join("")}</tbody></table>
       <div id="f3TAll"></div></div></div>
     <details class="fx-more"><summary><b>Worked example and use cases</b></summary><div id="f3TWx"></div>
       ${ulx(["Machining FMS with a fixed line of machines: throughput and stop accuracy weigh most → RGV / pallet pool vehicle.", "Assembly kitting with yearly layout changes: route flexibility and low investment → AMR.", "Warehouse to lines over long distances with Euro pallets: flexibility → AMR / AGV; check stop accuracy at the stations with 3E."])}</details>`);
}
function init3D() {
  const draw = () => {
    store.set("tw", TW); store.set("tn", TN);
    document.querySelectorAll("#f3Needs [data-need]").forEach((b) => b.classList.toggle("active", +b.dataset.need === TN && TS.needs[TN][1].every((w, k) => w === TW[k])));
    const r = fTransport(TW), best = r.rank[0].s || 1;
    $("f3TRes").innerHTML = tab(["Rank", "Option", ...TS.criteria.map((c) => esc(c) + " ★"), "Score", ""], r.rank.map((o, i) => {
      const st = TS.options[o.i][1];
      return `<tr${i === 0 ? ' class="fx-best"' : ""}><td>${i + 1}</td><td><b>${esc(o.n)}</b></td>${st.map((x, k) => `<td>${"★".repeat(x)}${k === 3 ? ` <span class="sub">→ ${6 - x}</span>` : ""}</td>`).join("")}<td><b>${fx(o.s, 3)}</b></td><td class="f3-barc"><i class="f3-bar" style="width:${(100 * o.s / 5).toFixed(0)}%"></i></td></tr>`;
    }), "f3-tsel");
    $("f3TAll").innerHTML = `<h4>The 3 example needs</h4>${tab(["Need (weights)", "Winner", "Second"], TS.needs.map(([n, w]) => { const q = fTransport(w).rank; return `<tr><td>${esc(n)} <span class="sub">(${w.join(", ")})</span></td><td><b>${esc(q[0].n)}</b> ${fx(q[0].s, 3)}</td><td>${esc(q[1].n)} ${fx(q[1].s, 3)}</td></tr>`; }))}`;
    const w = r.rank[0], st = TS.options[w.i][1], sw = TW.reduce((a, b) => a + b, 0);
    $("f3TWx").innerHTML = `<ol class="fx-steps"><li>Weights: ${TS.criteria.map((c, k) => `${esc(c)} ${TW[k]}`).join(" · ")} → Σw = ${sw}</li>
      <li>${esc(w.n)}: stars ${st.join(", ")} → investment used as 6 − ${st[3]} = ${6 - st[3]}</li>
      <li>Σ w·s = ${st.map((x, k) => `${TW[k]}·${k === 3 ? 6 - x : x}`).join(" + ")} = ${fx(w.s * sw, 0)}</li>
      <li>Score = ${fx(w.s * sw, 0)} ÷ ${sw} = <b>${fx(w.s, 3)}</b> → rank 1 (ties keep the table order)</li></ol>`;
    R.transport_current = { weights: [...TW], ranking: r.rank.map((o) => [o.n, rnd(o.s, 3)]) };
  };
  $("f33D").addEventListener("input", (e) => { const k = e.target.dataset.w; if (k != null) { TW[+k] = Math.max(0, Math.min(5, num(e.target.value))); draw(); } });
  $("f3Needs").addEventListener("click", (e) => { const b = e.target.closest("[data-need]"); if (!b) return; TN = +b.dataset.need; TW = [...TS.needs[TN][1]]; document.querySelectorAll("#f33D [data-w]").forEach((i) => { i.value = TW[+i.dataset.w]; }); draw(); });
  draw();
}

/* ================================================================== 3E tolerance stack deep */
let SC = store.get("stack", null), SG = store.get("stages", null), SCAP = store.get("cap", EX3.stack.capture_mm), SFIN = store.get("fin", EX3.stack.final_mm);
if (!Array.isArray(SC)) SC = clone(EX3.stack.contributors);
if (!Array.isArray(SG)) SG = clone(STAGES);
function html3E() {
  return card("f33E", "3E · Tolerance stack deep – worst case, RSS and a coarse-to-fine stage designer", "the quick version is 3C above · here: verdict per stage and a funnel diagram",
    `<div class="fx-guide"><div class="fx-prin"><p>A hand-over works when the <b>capture range</b> of the receiving guide is larger than the error that arrives. The arriving error is the sum of all
      contributors: <b>worst case</b> (all at their limit at the same time) or <b>statistical RSS</b> (independent, normal – rare to be all at the limit). One guide cannot go from
      ± 10 mm to ± 0.02 mm, so the station uses <b>stages</b>: each stage catches the error left by the stage before and leaves a smaller one.</p>
      <p class="phd-eq">WC = Σ|tᵢ| · RSS = √Σtᵢ² · capture ≥ WC safe · RSS ≤ capture &lt; WC risk · capture &lt; RSS not OK · stage n: capture_n ≥ remaining_(n−1)</p></div></div>
     <div class="grid2"><div><h4>Contributors (± mm)</h4><div class="fe-scroll"><table class="am-tab fe-calc" id="f3Stk"></table></div>
        <div class="fe-row"><button class="mx-el" id="f3StkAdd">+ contributor</button><button class="mx-el" id="f3StkEx">example values</button>
          <label>Capture of first guide ± <input type="number" step="any" id="f3Cap" value="${SCAP}"> mm</label>
          <label>Final location needed ± <input type="number" step="any" id="f3Fin" value="${SFIN}"> mm</label></div></div>
       <div id="f3StkRes"></div></div>
     <h4>Stage designer <span class="sub">capture range and remaining error per stage</span></h4>
     <div class="fe-scroll"><table class="am-tab fe-calc" id="f3Stg"></table></div>
     <div class="fe-row"><button class="mx-el" id="f3StgAdd">+ stage</button></div>
     <div class="fe-scroll"><svg class="fe-chart f3-funnel" id="f3Fun" viewBox="0 0 720 260" role="img" aria-label="coarse to fine funnel"></svg></div>
     <div id="f3StgRes"></div>
     <details class="fx-more"><summary><b>Use cases and how to use it in a real project</b></summary>
      <div class="fx-uses"><div class="fx-use"><b>AGV → machine station</b><p>AGV stop ± 8 mm dominates: WC 15.5, RSS 8.96, capture 12 → risk. Either a funnel with ± 16 mm capture or better navigation (± 4.5 mm).</p></div>
        <div class="fx-use"><b>Robot → fixture</b><p>Robot ± 0.1 mm, gripper play ± 0.2, part tolerance ± 0.3: chamfered pins with ± 1 mm lead-in are safe even worst case.</p></div>
        <div class="fx-use"><b>Stacker → APC</b><p>Stacker ± 2 mm, rail ± 1, pallet ± 0.5: cones catch ± 5 mm, the machine zero-point gives ± 0.005 mm.</p></div></div>
      ${ulx(["Ask the supplier for the REAL accuracy of the vehicle / machine (measured, with which navigation) – use it as the first contributor.", "Design the first stage for worst case if a miss would damage parts; RSS is acceptable only with monitoring and a retry.", "Write the stage table into the interface sheet of the hand-over (M06–M04, M03–M02 …).", "Test at FAT: 50 hand-overs at the corners of the tolerance (offset the vehicle on purpose)."])}</details>`);
}
function init3E() {
  const save = () => { store.set("stack", SC); store.set("stages", SG); store.set("cap", SCAP); store.set("fin", SFIN); };
  const drawTabs = () => {
    $("f3Stk").innerHTML = `<thead><tr><th>Contributor</th><th>± mm</th><th></th></tr></thead><tbody>${SC.map(([n, t], i) => `<tr><td><input type="text" class="f3-wn" data-si="${i}" data-f="n" value="${esc(n)}"></td><td><input type="number" step="any" data-si="${i}" data-f="t" value="${t}"></td><td><button class="mx-el fe-link" data-sdel="${i}" aria-label="remove">×</button></td></tr>`).join("")}</tbody>`;
    $("f3Stg").innerHTML = `<thead><tr><th>#</th><th>Stage (guide element)</th><th>Capture ± mm</th><th>Remaining ± mm</th><th>Arriving error ± mm</th><th>Verdict</th><th></th></tr></thead><tbody>${SG.map(([n, c, r], i) => `<tr><td>${i + 1}</td><td><input type="text" class="f3-wn" data-gi="${i}" data-f="n" value="${esc(n)}"></td><td><input type="number" step="any" data-gi="${i}" data-f="c" value="${c}"></td><td><input type="number" step="any" data-gi="${i}" data-f="r" value="${r}"></td><td id="f3Inc${i}"></td><td id="f3Vd${i}"></td><td><button class="mx-el fe-link" data-gdel="${i}" aria-label="remove">×</button></td></tr>`).join("")}</tbody>`;
    drawRes();
  };
  const drawRes = () => {
    save();
    const s = fStack(SC, SCAP), g = fStages(SG.map(([n, c, r], i) => [n, i === 0 ? SCAP : num(c), num(r)]), s.wc, s.rss, SFIN);
    const vcls = (v) => (v === "safe" ? "fe-ok" : v === "risk" ? "f3-warn" : "fe-no");
    $("f3StkRes").innerHTML = `<div class="phd-kpis"><div class="phd-kpi"><b>± ${fx(s.wc, 2)} mm</b><span>worst case Σ|tᵢ|</span></div><div class="phd-kpi"><b>± ${fx(s.rss, 3)} mm</b><span>RSS √Σtᵢ²</span></div><div class="phd-kpi"><b class="${vcls(s.verdict)}">${s.verdict}</b><span>capture ± ${fx(SCAP, 2)} mm</span></div></div>
      <table class="am-kv"><tbody><tr><td>Largest contributor</td><td>${esc(s.big)} (± ${fx(s.bigNow, 2)} mm)</td></tr>
        <tr><td>To be safe (worst case) it must drop to</td><td><b>± ${fx(s.bigNeed, 2)} mm</b> ${s.verdict === "safe" ? "(already safe)" : ""}</td></tr>
        <tr><td>Or the first capture must grow to</td><td><b>± ${fx(s.wc, 2)} mm</b></td></tr></tbody></table>
      <details class="fx-more f2-wx"><summary><b>Worked example</b></summary><ol class="fx-steps"><li>WC = ${SC.map((c) => fx(Math.abs(num(c[1])), 2)).join(" + ")} = <b>${fx(s.wc, 2)}</b> mm</li>
        <li>RSS = √(${SC.map((c) => fx(num(c[1]) ** 2, 2)).join(" + ")}) = <b>${fx(s.rss, 3)}</b> mm</li><li>Capture ${fx(SCAP, 2)}: ${fx(s.rss, 2)} ≤ ${fx(SCAP, 2)} ${SCAP < s.wc ? "&lt;" : "≥"} ${fx(s.wc, 2)} → <b>${s.verdict}</b></li>
        <li>Largest ± ${fx(s.bigNow, 2)} − (WC − capture ${fx(s.wc - SCAP, 2)}) = ± ${fx(s.bigNeed, 2)} mm needed for worst-case safety</li></ol></details>`;
    g.rows.forEach((r, i) => { const a = $("f3Inc" + i), v = $("f3Vd" + i); if (a) a.textContent = i === 0 ? `WC ${fx(r.incWC, 2)} / RSS ${fx(r.incRSS, 2)}` : fx(r.incWC, 3); if (v) v.innerHTML = `<span class="${vcls(r.verdict)}">${r.verdict}</span>`; });
    const c0 = document.querySelector('#f3Stg [data-gi="0"][data-f="c"]'); if (c0 && document.activeElement !== c0) c0.value = SCAP;
    $("f3StgRes").innerHTML = `<p>${g.allOK ? ok(true, "every stage catches the error of the stage before") : ok(false, "", "a stage cannot catch the arriving error – bigger capture or a better stage before")} ·
      final ± ${fx(g.final, 3)} mm vs needed ± ${fx(SFIN, 3)} mm → ${ok(g.finalOK, "meets the requirement", "too coarse – add / improve the last stage")}</p>
      <p class="am-note">Stage 1 capture = the capture of the first guide (input above). Typical capture → remaining: rollers / funnel ± 10–20 → ± 2–3 mm · cones ± 2–5 → ± 0.1–0.2 mm · pins / zero-point ± 0.2–0.5 → ± 0.005–0.02 mm.</p>`;
    funnel(g, s);
    R.stack_current = { wc: rnd(s.wc, 3), rss: rnd(s.rss, 3), verdict: s.verdict, stages: g.rows.map((r) => r.verdict), final: g.final, finalOK: g.finalOK };
  };
  const box = $("f33E");
  box.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.si != null) { const i = +t.dataset.si; if (t.dataset.f === "n") SC[i][0] = t.value; else SC[i][1] = Math.abs(num(t.value)); drawRes(); }
    else if (t.dataset.gi != null) { const i = +t.dataset.gi; if (t.dataset.f === "n") SG[i][0] = t.value; else if (t.dataset.f === "c") { SG[i][1] = Math.abs(num(t.value)); if (i === 0) { SCAP = SG[0][1]; $("f3Cap").value = SCAP; } } else SG[i][2] = Math.abs(num(t.value)); drawRes(); }
    else if (t.id === "f3Cap") { SCAP = Math.abs(num(t.value)); if (SG[0]) SG[0][1] = SCAP; drawRes(); }
    else if (t.id === "f3Fin") { SFIN = Math.abs(num(t.value, 0.01)); drawRes(); }
  });
  box.addEventListener("click", (e) => {
    const t = e.target;
    if (t.dataset.sdel != null) { SC.splice(+t.dataset.sdel, 1); drawTabs(); }
    else if (t.dataset.gdel != null) { SG.splice(+t.dataset.gdel, 1); drawTabs(); }
    else if (t.id === "f3StkAdd") { SC.push(["New contributor", 1]); drawTabs(); }
    else if (t.id === "f3StgAdd") { const last = SG[SG.length - 1]; SG.push(["New stage", last ? last[2] * 1.5 : 1, last ? last[2] / 5 : 0.1]); drawTabs(); }
    else if (t.id === "f3StkEx") { SC = clone(EX3.stack.contributors); SG = clone(STAGES); SCAP = EX3.stack.capture_mm; SFIN = EX3.stack.final_mm; $("f3Cap").value = SCAP; $("f3Fin").value = SFIN; drawTabs(); }
  });
  if (SG[0]) SG[0][1] = SCAP;
  drawTabs();
}
function funnel(g, s) {
  const W = 720, H = 260, cy = 120, n = g.rows.length || 1, x0 = 70, x1 = W - 20, sw = (x1 - x0) / n;
  const lo = Math.log10(Math.max(0.005, Math.min(SFIN, g.final || 1) / 2)), hi = Math.log10(Math.max(s.wc, ...g.rows.map((r) => r.cap), 1) * 1.1);
  const h = (v) => 6 + 96 * (Math.log10(Math.max(v, 1e-4)) - lo) / (hi - lo || 1);
  let out = `<line class="fe-grid" x1="${x0 - 10}" x2="${x1}" y1="${cy}" y2="${cy}"/>`;
  [0.01, 0.1, 1, 10].forEach((v) => { if (Math.log10(v) >= lo && Math.log10(v) <= hi) out += `<text class="fe-tick" x="${x0 - 14}" y="${cy - h(v) + 4}" text-anchor="end">±${v}</text><line class="fe-grid" x1="${x0 - 10}" x2="${x0 - 4}" y1="${cy - h(v)}" y2="${cy - h(v)}"/>`; });
  g.rows.forEach((r, i) => {
    const a = x0 + i * sw + 8, b = x0 + (i + 1) * sw - 8, hc = h(r.cap), hr = h(r.rem), hi2 = h(r.incWC);
    const cls = r.verdict === "safe" ? "f3-fok" : r.verdict === "risk" ? "f3-frisk" : "f3-fno";
    out += `<polygon class="f3-fun ${cls}" points="${a},${cy - hc} ${b},${cy - hr} ${b},${cy + hr} ${a},${cy + hc}"/>`;
    out += `<line class="f3-inc" x1="${a - 4}" x2="${a - 4}" y1="${cy - hi2}" y2="${cy + hi2}"/><line class="f3-inc" x1="${a - 8}" x2="${a}" y1="${cy - hi2}" y2="${cy - hi2}"/><line class="f3-inc" x1="${a - 8}" x2="${a}" y1="${cy + hi2}" y2="${cy + hi2}"/>`;
    if (i === 0) out += `<line class="f3-incr" x1="${a - 4}" x2="${a - 4}" y1="${cy - h(r.incRSS)}" y2="${cy + h(r.incRSS)}"/>`;
    out += `<text class="f3-fl" x="${(a + b) / 2}" y="${H - 26}" text-anchor="middle">${i + 1}. ${esc(r.n.length > 26 ? r.n.slice(0, 24) + "…" : r.n)}</text><text class="fe-tick" x="${(a + b) / 2}" y="${H - 10}" text-anchor="middle">±${fx(r.cap, r.cap < 1 ? 2 : 1)} → ±${fx(r.rem, r.rem < 0.1 ? 3 : 2)} · ${r.verdict}</text>`;
  });
  out += `<line class="f2-lim" x1="${x0}" x2="${x1}" y1="${cy - h(SFIN)}" y2="${cy - h(SFIN)}"/>`;
  out += `<text class="fe-tick" x="6" y="14">red bar = arriving error (worst case; dotted = RSS) · funnel = capture → remaining (log scale) · dashed line = needed ±${SFIN} mm</text>`;
  $("f3Fun").innerHTML = out;
}

/* ================================================================== results for tests: all key DEFAULT numbers */
function results() {
  const basic = {};
  EL.forEach((e) => { const c = CALC[e.calc]; if (!c) { basic[e.calc] = null; return; } const r = c.run(defs(c.inp)); basic[e.calc] = { element: e.k, title: c.t, out: r.out.filter((o) => o[3] >= 0).map((o) => [o[0], rnd(o[1], 4), o[2]]) }; });
  const bat = fBattery(EX3.agv_battery), fl = fFleet(defs(CALC.agv.inp), bat.availOpp), ri = fInertia(EX3.robot_inertia), sc = fScrew(EX3.screw_preload), pf = fPress(EX3.press_fit);
  const lk = fLeak(EX3.leak_test), vi = fVision(EX3.vision), cv = fConv(EX3.conveyor_drive), as = fAsrs(defs(CALC.asrs.inp), ASRS_PEAK.peak, ASRS_PEAK.umax);
  const st = fStack(EX3.stack.contributors, EX3.stack.capture_mm), sg = fStages(STAGES.map((r, i) => [r[0], i === 0 ? EX3.stack.capture_mm : r[1], r[2]]), st.wc, st.rss, EX3.stack.final_mm);
  return clone({
    elements: EL.length, deep_entries: Object.keys(DEEP).length, missing_deep: EL.filter((e) => !DEEP[e.k]).map((e) => e.k), basic,
    agv_battery: { E_trip_Wh: rnd(bat.E_trip, 2), busy_s: rnd(bat.busy, 0), E_h_Wh: rnd(bat.E_h, 2), usable_Wh: bat.usable, runtime_h: rnd(bat.runtime, 3), charge_h: rnd(bat.charge, 3), availability: rnd(bat.avail, 4), opp_charge_h_per_h: rnd(bat.share, 4), opp_charge_min_per_h: rnd(bat.share * 60, 1), idle_min_per_h: rnd(bat.idle * 60, 1), availability_opp: rnd(bat.availOpp, 4), fleet_web: fl.nWeb, fleet_battery: fl.nBat, extra_vehicles: fl.extra },
    robot_inertia: { J: rnd(ri.J, 4), J_use_pct: rnd(100 * ri.uJ, 1), M: rnd(ri.M, 3), M_use_pct: rnd(100 * ri.uM, 1) },
    screw: { F_preload_N: rnd(sc.F, 1), use_pct: rnd(100 * sc.use, 1), verdict: screwVerdict(sc.use) },
    press_fit: { p_MPa: rnd(pf.p, 3), F_N: rnd(pf.F, 0) },
    leak: { Q_mbar_l_s: rnd(lk.Q, 4), Q_cm3_min: rnd(lk.Qcm, 2), dp_T_mbar: rnd(lk.dpT, 3), ratio: rnd(lk.ratio, 3), dT_allow_K: rnd(lk.dTallow, 4), verdict: lk.verdict },
    vision: { pixel_mm: rnd(vi.pm, 5), px_per_defect: rnd(vi.n, 2), repeatability_mm: rnd(vi.rep, 4), ok: vi.ok },
    conveyor: { F_N: rnd(cv.F, 2), P_W: rnd(cv.P, 2) },
    asrs: { t_P1: rnd(as.t1, 3), t_P2: rnd(as.t2, 3), t_P1P2: rnd(as.t12, 3), single_s: rnd(as.tsc, 3), double_s: rnd(as.tdc, 3), single_per_h: rnd(as.ths, 1), double_moves_per_h: rnd(as.thd, 1), peak: ASRS_PEAK.peak, cranes: as.cranes },
    transport: TS.needs.map(([n, w]) => { const q = fTransport(w); return { need: n, weights: w, scores: Object.fromEntries(q.rows.map((o) => [o.n, rnd(o.s, 3)])), winner: q.rank[0].n, second: q.rank[1].n }; }),
    stack: { WC: rnd(st.wc, 3), RSS: rnd(st.rss, 3), capture: EX3.stack.capture_mm, verdict: st.verdict, largest: st.big, largest_needed_mm: rnd(st.bigNeed, 3), stages: sg.rows.map((r) => [r.n, r.cap, r.rem, r.verdict]), final_mm: sg.final, final_ok: sg.finalOK },
    current: { transport: R.transport_current, stack: R.stack_current }, errors: R.errors || [],
  });
}
// test helper: render every element × tab, report empty / failing ones
function checkAll() {
  const keep = [SEL, TAB], bad = [];
  EL.forEach((e) => TABS.forEach(([t]) => { try { SEL = e.k; TAB = t; drawX(); const b = $("f3Body"); if (!b || b.textContent.trim().length < 80) bad.push(e.k + ":" + t + " empty"); if (t === "size" && /NaN|undefined/.test(b.textContent)) bad.push(e.k + ":size NaN"); if (/undefined/.test(b.innerHTML)) bad.push(e.k + ":" + t + " undefined"); } catch (err) { bad.push(e.k + ":" + t + " " + err.message); } }));
  [SEL, TAB] = keep; drawX();
  return bad;
}
