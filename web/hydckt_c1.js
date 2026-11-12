/* Hydraulics tab – item 2 "Standard circuits": shared info texts, HPU drawing, circuits 1–5
 * (1 hydraulic lock · 2 counterbalance · 3 meter-in / meter-out / bleed-off · 4 sequence + pressure reducing · 5 regenerative).
 * Each circuit = parameters, "what goes wrong" toggles, a lumped simulation (hydckt_sim.js), a live ISO 1219 drawing
 * (hydckt_sym.js), charts, formulas with example numbers, settings and failures. All values are EXAMPLES. */
import { Net, orif, lam, src, fcv, cyl, dcv, leakG, ramp, areaD, LPM, MPA, G0, OIL, orifice } from "./hydckt_sim.js";
import { hsLine, hsPilot, hsDot, hsTag, hsTxt, hsTank, hsPump, hsRelief, hsPRV, hsSeq, hsCheck, hsPOC, hsCBV, hsFCV, hsOrif, hsGauge, hsDcv, hsCyl, hsLoad, hsPS, hsFilter, hsElec, esc } from "./hydckt_sym.js";

export const f = (v, d = 1) => (Number.isFinite(+v) ? (+v).toFixed(d) : "–");
export const PM = 12e6; // colour scale: red at 12 MPa
export const A63 = areaD(63), A63r = areaD(63) - areaD(36), AR36 = areaD(36);

/* ------------------------------------------------------------------ info boxes (click a symbol) */
const I = (t, w, r, y, c, fl) => ({ t, w, r, y, c, f: fl });
export const INFO = {
  pump: I("0P1 hydraulic pump + 0M1 electric motor", "Turns mechanical power into flow. A fixed pump gives the same flow every turn (Q = V·n·η_v); the pressure comes from the load.", "gear pump 4–50 cm³/rev, 1450 rpm, η_v 0.90–0.95, max 20–25 MPa (example)", "The pump makes FLOW, not pressure. Pressure = resistance of the load or of the relief valve.", "Direction of rotation, suction line full, noise, case drain (piston pumps).", "Cavitation (suction too small or cold oil) → noise, wear; worn pump → η_v low → slow."),
  relief: I("0V1 pressure relief valve", "Normally closed. Opens when the inlet pressure reaches the spring setting and sends oil to the tank. Protects pump, hoses and cylinders.", "direct or pilot operated, NG6–NG32, set ≈ 10 % above working pressure, below the weakest component (example)", "Every pump needs one (EN ISO 4413). All oil over the relief = heat: P = p·Q.", "Set with a gauge at FAT, seal the setting, label the value.", "Set too high → hoses burst; set too low → no force, hot oil; dirt on the seat → pressure drops."),
  prv: I("Pressure reducing valve", "Normally open. Closes when the OUTLET pressure reaches the setting. Gives a lower, constant pressure for one branch (e.g. clamp 5 MPa from a 10 MPa system).", "set 0.5–31.5 MPa, needs a drain (L) to the tank, 3-way types also relieve the outlet", "One pump can feed branches with different pressures. The clamp force stays the same when the system pressure changes.", "Gauge on the outlet; drain line free to the tank without back pressure.", "No drain → valve does not regulate; outlet pressure creeps up when the 2-way valve has to hold a heated, closed branch."),
  seq: I("Sequence valve", "Normally closed, pilot from the inlet, external drain. Opens the second branch only when the first branch has reached its pressure: clamp first, then work.", "set ≥ clamp pressure + 1–1.5 MPa, reverse flow through a check valve", "Makes a pressure-dependent order without electrics.", "Set it with a gauge; the work cylinder must not move before the clamp pressure is reached.", "Set too low → work starts before full clamp force; set above relief → never opens."),
  check: I("Check valve (non-return valve)", "Free flow one way, closed the other way (ball or poppet on a seat). Seat valve = leak free.", "cracking pressure 0.05–0.5 MPa (spring)", "Keeps pressure in a branch, protects a pump from back flow, bypasses a throttle in one direction.", "Flow direction arrow on the body = drawing.", "Dirt on the seat → leaks; wrong direction fitted."),
  poc: I("Pilot-operated check valve (hydraulic lock)", "Check valve that can be opened against the free-flow direction by pilot pressure X. Seat valve → holds a load leak-free.", "pilot ratio 3:1 … 10:1 (with decompression), cracking 0.1–0.3 MPa; opening: p_X ≥ (p_load − p_out)/k", "A spool valve always leaks (clearance 5–15 µm) → the load sinks. The pilot check stops this.", "Valve centre must vent A and B to the tank (float / Y centre) so the pilot pressure falls and the poppet closes.", "Closed-centre spool → pilot pressure trapped → valve stays open → the load drifts. Lowering an overrunning load → jerky (open / close)."),
  cbv: I("Counterbalance valve (load holding valve)", "Relief-type valve in the outlet of the cylinder, with a pilot X from the other line and a free-flow check. Holds the load and lowers it smoothly at any load.", "setting ≥ 1.3 × max. load pressure, pilot ratio 3:1 (unstable loads) … 8:1 (stable loads); opening: p_load + k·p_X ≥ p_set", "Controls an overrunning (pulling) load: no runaway, no cavitation, also holds when a hose bursts (mount it on the cylinder).", "Setting sealed; pilot ratio chosen for the machine (low ratio = stable, high ratio = less energy).", "Set below load pressure → load creeps; high ratio on a flexible structure → oscillation."),
  fcv: I("2-way pressure-compensated flow control valve", "Throttle + pressure compensator (a second, spring-loaded throttle) that keeps Δp over the main throttle constant → the flow stays constant when the load changes.", "Q_set 0.1–160 L/min, min. Δp ≈ 0.6–1 MPa for regulation, bypass check for the return flow", "Speed independent of the load. Meter-in, meter-out or bleed-off position decides losses and behaviour.", "Set the speed at the real load and oil temperature.", "Meter-in with an overrunning load → runaway; meter-out → rod-side intensification p·A1/A2."),
  thr: I("1V4 throttle check valve (meter-out for lowering)", "Throttle for one direction, free flow back through the check valve.", "orifice ≈ 5 mm² here (needle valve, example)", "Limits the lowering speed so the pump can fill the rod side: the pilot pressure stays and the pilot check does not chatter.", "Lowering speed at max load and warm oil.", "Missing → jerky lowering through the pilot check."),
  orif: I("Fixed orifice / throttle", "A restriction: Q = Cd·A·√(2Δp/ρ). Flow depends on Δp (load) and on viscosity (temperature).", "Cd ≈ 0.6–0.7, ρ = 870 kg/m³", "Simple speed or damping control.", "Size with the orifice equation.", "Changes with temperature; clogs with dirt."),
  gauge: I("Pressure gauge / test point", "Shows the pressure at this point (gauge pressure; absolute = gauge + 0.1 MPa).", "class 1.6, scale ≈ 1.5–2 × working pressure, glycerine filled, test point M16×2 (ISO 15171)", "You set and check every valve with a gauge.", "Gauge shut-off or test point at pump, every pressure branch, load side.", "Gauge without damping breaks from pressure peaks."),
  acc: I("Hydraulic accumulator (bladder)", "Pressure vessel with nitrogen pre-charge. Stores oil under pressure: gives big flow for a short time, keeps pressure when the pump is off, damps peaks.", "bladder 0.2–50 L, up to 35 MPa; pre-charge p0 ≈ 0.9 × p_min (abs) with N₂ only", "Small pump + accumulator for short peaks and long pauses = less energy, less heat.", "Pre-charge check yearly; safety and shut-off block with relief + manual discharge; PED 2014/68/EU.", "No pre-charge (bladder burst) → no storage; oil pressure left after switch-off → danger (always discharge before work)."),
  hmotor: I("Hydraulic motor", "Turns flow into rotation: n = Q·η_v / V, T = Δp·V·η_hm / (2π).", "orbit 50–400 cm³/rev (low speed, high torque), radial piston 200–6000, axial piston 10–250", "Compact drive with high torque, safe against overload (relief).", "Case drain (piston motors), start torque (≈ 0.8 × running torque), min. speed.", "Overrunning load without brake valve → runaway and cavitation; leakage → creep under load."),
  brake: I("Spring-applied, hydraulically released brake (multi-disc)", "Springs press the discs together = brake ON without pressure. Pressure from the shuttle valve releases it when the motor is driven.", "holding torque ≥ 1.5–2 × max load torque, release ≈ 1.5–2.5 MPa, full release 3 MPa (example)", "A motor leaks → it cannot hold a load. The brake holds the load with power off (fail safe).", "Release pressure, brake applies after the motor has stopped (orifice in the release line), wear check.", "Brake released by system pressure while the motor is not driven → load slips; brake applies while turning → wear."),
  shuttle: I("Shuttle valve (OR valve)", "The higher of two pressures reaches the outlet.", "small size, ball type", "Releases the brake from whichever motor line is under pressure; picks the load pressure (load sensing).", "Ball free, no leak to the other side.", "Stuck ball → brake does not release in one direction."),
  ps: I("Pressure switch", "Electrical contact when the pressure reaches the setting (with hysteresis). Signal to the PLC.", "setting 1–40 MPa, hysteresis 5–15 %, PNP output, IP65", "Clamp confirmed, pump on / off, start of the next step.", "Switch point with a test gauge, reaction of the PLC.", "Contact chatter at the switch point (too small hysteresis); set point drift."),
  filter: I("Filter", "Removes particles: pressure filter before sensitive valves, return filter in the tank line.", "β_x(c) ≥ 200 (ISO 16889), 10 µm return, 5–10 µm pressure for proportional valves", "Most hydraulic faults come from dirty oil (ISO 4406).", "Clogging indicator, change filter at warning.", "Bypass open (filter clogged) → dirt passes."),
  divider: I("Gear flow divider", "Two gear motors on one shaft: both sections must turn together, so both outlets get (nearly) the same flow.", "error ± 1–3 % (internal leakage), 2 × 2…50 L/min", "Two cylinders move together without a mechanical link.", "Synchronising valves at the end of stroke correct the error.", "Error adds up every stroke → cylinders drift apart; high pressure difference → intensification in one section."),
  dcv: I("Directional control valve 4/3 (solenoid, spring centred)", "Spool valve: Y1 = box a (P→A, B→T), Y2 = box b (P→B, A→T), no current = centre box. The centre type decides what happens at stop.", "NG6 (CETOP 03) ≈ 60–80 L/min, NG10 ≈ 100–120 L/min, 31.5–35 MPa, solenoid 24 V DC ≈ 30 W", "Starts, stops and reverses the actuator.", "Δp from the catalogue curve (Δp–Q), centre type = drawing, manual override.", "Spool leakage (clearance) → a held load sinks; sticky spool from dirt; burnt coil from AC/DC mix-up."),
  cyl: I("Hydraulic cylinder (double-acting, differential)", "Piston area A1 (cap side), annulus A2 = A1 − A_rod (rod side). F = p·A, v = Q/A.", "ISO 6020-2 (16 MPa) / ISO 6022 (25 MPa), bores 25–250 mm, end cushions", "The actuator that does the work.", "Buckling (long rods), end cushioning, seal type, mounting.", "Rod-side over-pressure (intensification), side loads → seal wear, no cushioning → shock at the end."),
  load: I("Load", "The mass and force the actuator must move. Gravity on a vertical axis is an OVERRUNNING load when it moves down.", "here: example values", "The load decides pressure (F/A) and which valves you need (holding, counterbalance).", "Max load, min load, overrunning case.", "Forgetting the overrunning case."),
  hpu: I("Hydraulic power unit (HPU)", "Tank, pump, motor, relief valve, filters, gauge.", "see item 3 for sizing", "Source of flow; relief valve limits the pressure.", "", ""),
  unload: I("Unloading valve (solenoid 2/2)", "Opens the pump line to the tank when the accumulator is full: the pump runs at almost zero pressure → almost no power.", "NG6, normally closed, Δp at pump flow < 0.3 MPa", "Saves energy and heat; with a check valve the accumulator keeps the pressure.", "Pressure switch hysteresis (cut-out / cut-in).", "Missing check valve → accumulator empties through the unloading valve."),
  propv: I("Proportional / servo valve", "Spool opening proportional to the electric signal. With a position sensor and controller = closed-loop position control.", "NG6/NG10, response 10–40 ms, cleanliness 16/14/11", "Two axes can follow the same position command (electronic synchronisation).", "Controller gains, sensor resolution.", "Dirty oil → sticky spool, drift."),
  link: I("Mechanical synchronisation (rigid frame / rack and pinion / torsion shaft)", "The cylinders are forced to move together by a stiff mechanical link.", "frame must carry the force difference", "Simplest and most exact when the structure is stiff enough.", "Frame force and deflection at max eccentric load.", "Weak frame → it twists, guides jam."),
};

/* ------------------------------------------------------------------ shared drawing helpers */
export const mkL = (n, A) => (pts, node, q = 0) => hsLine(pts, typeof node === "number" ? node : n.p(node), PM, q, A);
/** standard HPU (pump 0P1, motor 0M1, relief 0V1, gauge, tank). P line leaves at (90,415) to the right. */
export function hpu(n, A, o = {}) {
  const L = mkL(n, A), P = o.P || "P", qp = n.q(o.pump || "pump"), qr = n.q(o.relief || "relief");
  let s = L([[90, 445], [90, 415]], P, qp) + L([[90, 475], [90, 488]], 0, qp) + hsTank(90, 488);
  s += L([[150, 415], [150, 420]], P, qr) + L([[150, 456], [150, 462]], 0, qr) + hsTank(150, 462) + L([[90, 415], [90, 404]], P);
  s += hsPump(90, 460, { tag: o.ptag || "0P1", variable: o.variable, on: true }) + hsRelief(150, 438, { tag: "0V1", open: Math.min(1, Math.abs(qr) / 2e-4), set: o.rset || "10 MPa" }) + hsGauge(90, 392, n.p(P), { ta: "end" });
  s += hsDot(150, 415);
  return s;
}
export const legendNote = (t) => `<text x="12" y="20" class="hs-hint">${esc(t)}</text>`;

/** directional valve node flows for line arrows (valve → actuator positive) */
export const qA = (n, pre = "") => n.q(pre + "PA") - n.q(pre + "AT") - n.q(pre + "cAT") - n.q(pre + "lAT") + n.q(pre + "lPA");
export const qB = (n, pre = "") => n.q(pre + "PB") - n.q(pre + "BT") - n.q(pre + "cBT") - n.q(pre + "lBT") + n.q(pre + "lPB");
export const qP = (n, pre = "") => n.q(pre + "PA") + n.q(pre + "PB") + n.q(pre + "cPT") + n.q(pre + "lPA") + n.q(pre + "lPB");
export const qT = (n, pre = "") => n.q(pre + "AT") + n.q(pre + "BT") + n.q(pre + "cAT") + n.q(pre + "cBT") + n.q(pre + "cPT") + n.q(pre + "lAT") + n.q(pre + "lBT");
const sOf = (n, k = "s") => n.u[k] || 0;
const relief = (n, node = "P", pset = 10 * MPA) => n.add(orif(node, "T", (nn) => 40e-6 * ramp(nn.p(node), pset, pset + 0.6e6), { name: "relief" }));
const pump = (n, Qlpm, node = "P") => n.add(src(node, () => Qlpm * LPM, { name: "pump" }));
const cylRd = (c) => [["Stroke position x", f(c.x * 1000, 1) + " mm"], ["Speed v", f(c.v * 1000, 1) + " mm/s"]];
const pRd = (n, list) => list.map(([l, k]) => [l, f(n.p(k) / 1e6, 2) + " MPa", n.N[k].cav ? "hc-bad" : ""]);
/** run a scripted scenario headless; returns samples every 'every' s: {t, …fields(n)} */
export function runScript(c, P, W, fields, every = 0.01) {
  const n = c.make(P, W), scr = c.script(P, W).slice(); let k = 0; const out = []; let nextS = 0;
  const steps = Math.round(c.dur / n.dt);
  for (let i = 0; i <= steps; i++) {
    while (k < scr.length && scr[k][0] <= n.t + 1e-9) { Object.assign(n.u, scr[k][1]); if (c.onU) c.onU(n, scr[k][1]); k++; }
    if (n.t >= nextS - 1e-9) { out.push(Object.assign({ t: n.t }, fields(n))); nextS += every; }
    n.step(n.dt);
  }
  return { n, out };
}
export const at = (out, t) => out.reduce((b, s) => (Math.abs(s.t - t) < Math.abs(b.t - t) ? s : b), out[0]);

/* ======================================================================= 1  HYDRAULIC LOCK */
const LOCK = {
  id: "lock", n: 1, title: "Hydraulic lock – double pilot-operated check valve", sub: "vertical axis or clamp: hold the load without drift",
  P: [
    { k: "m", l: "Load mass (vertical)", u: "kg", v: 2000, min: 200, max: 3000, st: 100 },
    { k: "leak", l: "Spool leakage of 1V1 (new 20–100, worn 300–1000)", u: "cm³/min @ 10 MPa", v: 100, min: 10, max: 1000, st: 10 },
    { k: "centre", l: "Centre position of 1V1", v: "open", opts: [["open", "open H (P, A, B → T) – correct, pump unloaded"], ["float", "float Y (A, B → T, P blocked)"], ["closed", "closed (all blocked) – wrong with pilot checks"]] },
    { k: "k", l: "Pilot ratio of 1V2 / 1V3", v: 3, opts: [[3, "3 : 1"], [4, "4 : 1"], [10, "10 : 1 (decompression)"]] },
  ],
  W: [{ k: "noPOC", l: "without the pilot-operated check valves (spool valve with tandem centre holds the load)" }],
  V: [{ k: "s", l: "Valve 1V1", opts: [[1, "Y1 ▲ raise"], [0, "0 hold"], [-1, "Y2 ▼ lower"]] }],
  dur: 15,
  make(P, W) {
    const n = new Net({ dt: 2e-5 }), k = +P.k;
    n.node("P", 0.3).node("VA", 0.15).node("TH", 0.15).node("CA", 0.3).node("VB", 0.15).node("CB", 0.3);
    pump(n, 18.7); relief(n);
    const centre = W.noPOC && P.centre !== "closed" ? "tandem" : P.centre;
    n.ctx = { centre };
    dcv(n, { P: "P", A: "VA", B: "VB", Av: 25e-6, centre, leak: leakG(P.leak) });
    n.add(orif("TH", "VA", () => 5e-6, { name: "thr" }));
    n.add(orif("VA", "TH", (nn) => 30e-6 * ramp(nn.p("VA") - nn.p("TH"), 0.05e6, 0.3e6), { name: "thrChk", tau: 0.005 }));
    if (W.noPOC) { n.add(orif("TH", "CA", () => 60e-6, { name: "pocA" })); n.add(orif("VB", "CB", () => 60e-6, { name: "pocB" })); }
    else {
      n.add(orif("TH", "CA", (nn) => 30e-6 * Math.max(ramp(nn.p("TH") - nn.p("CA"), 0.05e6, 0.35e6), ramp(k * nn.p("VB") - (nn.p("CA") - nn.p("TH")), 0.2e6, 1.5e6)), { name: "pocA", tau: 0.01 }));
      n.add(orif("VB", "CB", (nn) => 30e-6 * Math.max(ramp(nn.p("VB") - nn.p("CB"), 0.05e6, 0.35e6), ramp(k * nn.p("VA") - (nn.p("CB") - nn.p("VB")), 0.2e6, 1.5e6)), { name: "pocB", tau: 0.01 }));
      n.add(lam("CA", "TH", leakG(0.05), { name: "seatA" }));
    }
    n.act(cyl({ name: "cyl", A: "CA", B: "CB", D: 63, d: 36, L: 0.2, m: +P.m, vert: true, c: 3000, Ff: 150 }));
    return n;
  },
  script: () => [[0, { s: 0 }], [0.3, { s: 1 }], [2.8, { s: 0 }], [9, { s: -1 }], [11.4, { s: 0 }]],
  charts: [
    { t: "Load position", u: "mm", s: [["position x", (n) => n.a.cyl.x * 1000]] },
    { t: "Pressures", u: "MPa", s: [["cap side (holds the load)", (n) => n.p("CA") / 1e6], ["rod side", (n) => n.p("CB") / 1e6], ["pilot line B (valve side)", (n) => n.p("VB") / 1e6]] },
    { t: "Load drift since the valve went to 0", u: "mm", s: [["Δx", (n) => (n.ctx.x0 === undefined ? 0 : (n.a.cyl.x - n.ctx.x0) * 1000)]] },
  ],
  onU(n, u) { if (u.s === 0) n.ctx.x0 = n.a.cyl.x; else if (u.s !== undefined) n.ctx.x0 = undefined; },
  rd(n, P) {
    const c = n.a.cyl, pl = +P.m * G0 / A63;
    const drift = n.ctx.x0 !== undefined && n.t > 0 ? (c.x - n.ctx.x0) * 1000 : 0;
    return [...cylRd(c), ...pRd(n, [["Pump p_P", "P"], ["Cap side p_A (load)", "CA"], ["Rod side p_B", "CB"], ["Pilot line A (valve side)", "VA"], ["Pilot line B (valve side)", "VB"]]),
      ["Load pressure m·g/A1", f(pl / 1e6, 2) + " MPa"], ["Pilot check 1V2", n.e.pocA && n.e.pocA.A > 1e-6 ? "OPEN" : "closed (leak free)"],
      ["Drift since stop", f(drift, 2) + " mm", Math.abs(drift) > 1 ? "hc-bad" : "hc-ok"], ["Valve centre", n.ctx.centre]];
  },
  draw(n, P, W, A) {
    const L = mkL(n, A), c = n.a.cyl, s = sOf(n), poc = !W.noPOC;
    let o = hpu(n, A);
    o += L([[90, 415], [321, 415], [321, 403]], "P", qP(n)) + L([[339, 403], [339, 420]], 0, qT(n)) + hsTank(339, 420);
    o += hsDcv(330, 380, { s, centre: n.ctx.centre, tag: "1V1" });
    // A line: valve → throttle check 1V4 → pilot check 1V2 → cap side
    const qa = n.q("thrChk") - n.q("thr");
    o += L([[321, 357], [321, 312]], "VA", qa) + L([[321, 318], [290, 318], [290, 312]], "VA", n.q("thrChk")) + L([[290, 288], [290, 282], [321, 282]], "TH", n.q("thrChk"));
    o += hsOrif(321, 300, { info: "thr", tag: "1V4" }) + hsCheck(290, 300, "up", { info: "thr", open: n.q("thrChk") > 1e-6 });
    o += L([[321, 288], [321, 263]], "TH", qa) + L([[321, 237], [321, 205], [464, 205]], "CA", n.q("pocA"));
    o += poc ? hsPOC(321, 250, "up", { tag: "1V2", open: n.e.pocA.A > 1e-6, px: 400, py: 256 }) : L([[321, 263], [321, 237]], "TH", qa);
    // B line
    o += L([[339, 357], [339, 335], [400, 335], [400, 263]], "VB", n.q("pocB")) + L([[400, 237], [400, 70], [464, 70]], "CB", n.q("pocB"));
    o += poc ? hsPOC(400, 250, "up", { tag: "1V3", open: n.e.pocB.A > 1e-6, px: 321, py: 244 }) + hsPilot([[400, 300], [430, 300], [430, 256], [413, 256]]) + hsPilot([[321, 330], [270, 330], [270, 244], [308, 244]]) : L([[400, 263], [400, 237]], "VB", n.q("pocB"));
    if (poc) o += hsDot(400, 300) + hsDot(321, 330);
    const cy = hsCyl(470, 60, { vert: true, len: 155, frac: c.x / c.L, pA: n.p("CA"), pB: n.p("CB"), pm: PM, tag: "1A1 Ø63/36" });
    o += cy.svg.replace(/h6/g, "h0") + `<path d="M464,207 H470 M464,68 H470" class="hs-s"/>` + hsLoad(cy.tip, { vert: true, label: `m = ${P.m} kg`, g: true, w: 100 });
    o += hsGauge(520, 200, n.p("CA"), { label: "p_A" }) + hsGauge(520, 90, n.p("CB"), { label: "p_B" });
    o += hsTxt(600, 300, `drift ${f(n.ctx.x0 !== undefined ? (c.x - n.ctx.x0) * 1000 : 0, 2)} mm`, "middle", "hs-big");
    o += legendNote(poc ? (n.ctx.centre === "closed" ? `Closed centre: spool leakage from P pressurises the pilot lines → 1V2 stays open → drift.` : `Hold: the valve centre vents both pilot lines → 1V2/1V3 close on their seats (leak free).`) : `No pilot checks: the spool clearance of 1V1 leaks → the load sinks.`);
    return o;
  },
  txt: {
    what: "Two pilot-operated check valves (a 'double pilot check', often one sandwich plate under the NG6 valve) in the A and B lines of a cylinder. Each one opens by the pressure of the OTHER line.",
    why: "A spool valve has a clearance of 5–15 µm and always leaks. A vertical axis, a press ram or a clamp would sink or open slowly. The poppet seat of the pilot check is leak free (a few drops per hour).",
    how: "Raise: oil flows freely through 1V2; pressure in A opens 1V3 so the rod side can empty. Lower: pressure in B opens 1V2 (p_X ≥ p_load / k). Stop: the valve centre vents A and B to the tank → both poppets close at once and lock the oil in the cylinder.",
    check: "Valve centre = float (Y, A and B → T). Pilot ratio and opening pressure from the catalogue. Lowering speed limited by a meter-out throttle (1V4) so that the pump can fill the rod side. Mount the valves directly on the cylinder (a hose burst then does not drop the load).",
    mistake: "Closed-centre spool: spool leakage from P keeps pressure in the pilot lines → the pilot check stays open → the load drifts although the valve is fitted. Lowering without throttle: the load runs ahead of the pump, the pilot pressure falls, the valve closes, opens again → jerky lowering (use a counterbalance valve, circuit 2).",
  },
  fx(P) {
    const m = +P.m, F = m * G0, pl = F / A63, G = leakG(P.leak), q = G * pl, v = q / A63, k = +P.k;
    return `<pre class="hc-pre">Load pressure     p_L = m·g / A1 = ${m}·9.81 / ${f(A63 * 1e4, 2)} cm² = ${f(F / 1000, 2)} kN / ${f(A63 * 1e4, 2)} cm² = <b>${f(pl / 1e6, 2)} MPa</b>
Spool leakage     G = Q_leak / Δp = ${P.leak} cm³/min / 10 MPa  (laminar: Q ∝ Δp)
Leak at the load  Q = G·p_L = ${P.leak}·${f(pl / 1e7, 3)} = <b>${f(q * 6e7, 1)} cm³/min</b>
Drift without lock v = Q / A1 = ${f(q * 6e7, 1)} / ${f(A63 * 1e4, 2)} cm² = ${f(v * 6e4, 2)} cm/min = <b>${f(v * 6e4 * 10, 1)} mm/min</b>  (${f(v * 3.6e6, 0)} mm/h)
With the pilot check (seat ≈ 0.05 cm³/min): ≈ ${f(leakG(0.05) * pl * 6e7 / (A63 * 1e4) * 10, 3)} mm/min ✓
Pilot pressure to open 1V2 for lowering (outlet ≈ 0): p_X ≥ p_L / k = ${f(pl / 1e6, 2)} / ${k} = <b>${f(pl / k / 1e6, 2)} MPa</b>
Lowering speed (meter-out 1V4, A = 5 mm²): pump fills the rod side → v = Q_P / A2 = 18.7 L/min / ${f(A63r * 1e4, 1)} cm² = ${f(18.7 * LPM / A63r, 3)} m/s
   needed Δp at 1V4: Q_out = A1·v = ${f(A63 * 18.7 / A63r, 1)} L/min → Δp = ρ/2·(Q/(Cd·A))² = ${f(OIL.rho / 2 * (A63 * 18.7 * LPM / A63r / (0.62 * 5e-6)) ** 2 / 1e6, 1)} MPa (from load + rod-side pressure)</pre>`;
  },
  set(P) {
    const pl = +P.m * G0 / A63 / 1e6;
    return [["0V1 relief", "10 MPa", "system pressure; ≥ highest load pressure + losses"], ["1V2 / 1V3 pilot check", `ratio ${P.k}:1, cracking 0.1–0.3 MPa`, `opens at p_X ≥ ${f(pl / P.k, 2)} MPa (p_L ${f(pl, 2)} MPa / k)`],
      ["1V1 centre", "open H (P, A, B → T) or float Y (A, B → T)", "pilot lines must be vented when the valve is in the centre; H also unloads a fixed pump"], ["1V4 throttle check", "≈ 5 mm² (set at commissioning)", "lowering speed below pump fill speed Q_P/A2 → no chatter"],
      ["Mounting", "pilot checks on the cylinder (flange / sandwich)", "hose burst safety (EN ISO 4413 §5.4.2.4)"]];
  },
  fail: [["Load sinks slowly at stop", "closed-centre spool keeps pilot pressure / pilot check seat dirty", "use float centre; clean or replace the poppet; check with the A-line gauge: pressure falls?"],
    ["Load sinks fast with the lock fitted", "pilot check missing in one line or wrong direction", "check the flow arrow, check the drawing"],
    ["Jerky lowering (bang – bang)", "overrunning load, no meter-out throttle", "add a throttle check (1V4) or use a counterbalance valve (circuit 2)"],
    ["Clamp opens after hours", "temperature drop / leakage of the clamp seal", "accumulator on the clamp side or pressure switch + re-clamp"],
    ["Cylinder does not lower at all", "pilot pressure too low (k too small, back pressure in T line)", "check p_X ≥ p_L/k + back pressure; drain the T line freely"]],
  twin: "In the twin: the APC lift cylinder (Pallet changer tab, docs/09) uses this lock so the arm cannot fall when the power or a hose fails. A machine-tool clamp (HMC table clamp, docs/12) uses one pilot check + pressure switch to keep the 5 MPa clamp pressure.",
  test(P, W) {
    const pl = +P.m * G0 / A63, out = [];
    const run = (w, cen) => runScript(LOCK, Object.assign({}, P, { centre: cen }), w, (n) => ({ x: n.a.cyl.x, pA: n.p("CA") }), 0.05);
    const a = run({ noPOC: true }, "open"), b = run({}, "open"), c = run({}, "closed");
    const d = (r) => (at(r.out, 8.9).x - at(r.out, 4).x) * 1000 / 4.9 * 60;
    const hand = leakG(P.leak) * pl / A63 * 60000;
    out.push(`lock: p_L=${f(pl / 1e6, 3)}MPa (hand ${f(+P.m * 9.81 / A63 / 1e6, 3)}) stroke after raise x=${f(at(b.out, 2.7).x * 1000, 1)}mm (200)`);
    out.push(`lock drift mm/min: noPOC(tandem)=${f(d(a), 2)} hand G·pL/A1=${f(hand, 2)} | POC open centre=${f(d(b), 3)} (≈0) | POC closed centre=${f(d(c), 2)} (drifts)`);
    out.push(`lock lowering end x=${f(at(b.out, 14).x * 1000, 1)}mm (≈0)`);
    return out;
  },
};

/* ======================================================================= 2  COUNTERBALANCE */
const CBV = {
  id: "cbv", n: 2, title: "Counterbalance valve – vertical load", sub: "smooth lowering of an overrunning load, no runaway, holds at a hose burst",
  P: [
    { k: "m", l: "Load mass (vertical)", u: "kg", v: 2000, min: 200, max: 3000, st: 100 },
    { k: "hold", l: "Load holding valve", v: "cbv", opts: [["cbv", "counterbalance valve 1V2"], ["poc", "pilot-operated check (for comparison)"]] },
    { k: "fac", l: "Setting factor p_set / p_L", u: "×", v: 1.3, min: 1.1, max: 1.6, st: 0.05 },
    { k: "k", l: "Pilot ratio", v: 3, opts: [[3, "3 : 1 (stable, unstable loads)"], [4.5, "4.5 : 1"], [8, "8 : 1 (less energy)"]] },
  ],
  W: [{ k: "none", l: "without a load-holding valve (closed-centre spool only)" }],
  V: [{ k: "s", l: "Valve 1V1", opts: [[1, "Y1 ▲ raise"], [0, "0 hold"], [-1, "Y2 ▼ lower"]] }],
  dur: 9,
  pset: (P) => +P.fac * +P.m * G0 / A63,
  make(P, W) {
    const n = new Net({ dt: 2e-5 }), k = +P.k, ps = CBV.pset(P);
    n.node("P", 0.3).node("VA", 0.2).node("CA", 0.3).node("B", 0.4);
    pump(n, 18.7); relief(n);
    const mode = W.none ? "none" : P.hold; n.ctx = { mode, ps };
    dcv(n, { P: "P", A: "VA", B: "B", Av: 25e-6, centre: mode === "none" ? "closed" : "open", leak: leakG(30) });
    if (mode === "none") n.add(orif("CA", "VA", () => 60e-6, { name: "hold" }));
    else if (mode === "cbv") {
      const T_ = { band: 3e6, tau: 0.003, taup: 0.001 }; n.ctx.T_ = T_;   // valve gain 25 mm² per 3 MPa, poppet 3 ms
      n.add(orif("CA", "VA", (nn) => 25e-6 * ramp(nn.p("CA") + k * nn.ctx.pBf - ps, 0, T_.band), { name: "hold", tau: T_.tau }));
      n.add(orif("VA", "CA", (nn) => 30e-6 * ramp(nn.p("VA") - nn.p("CA"), 0.05e6, 0.3e6), { name: "chk", tau: 0.005 }));
    } else {
      n.add(orif("CA", "VA", (nn) => 25e-6 * ramp(4 * nn.p("B") - (nn.p("CA") - nn.p("VA")), 0.1e6, 0.6e6), { name: "hold", tau: 0.008 }));
      n.add(orif("VA", "CA", (nn) => 30e-6 * ramp(nn.p("VA") - nn.p("CA"), 0.05e6, 0.3e6), { name: "chk", tau: 0.005 }));
    }
    n.act(cyl({ name: "cyl", A: "CA", B: "B", D: 63, d: 36, L: 0.2, m: +P.m, vert: true, c: 3000, Ff: 150, cd: 40000 }));
    n.ctx.vmin = 0;
    n.ctx.pBf = 0;
    n.pre = (nn, dt) => { const v = nn.a.cyl.v; if (v < nn.ctx.vmin) nn.ctx.vmin = v; const tp = (nn.ctx.T_ && nn.ctx.T_.taup) || 0.001; nn.ctx.pBf += (nn.p("B") - nn.ctx.pBf) * Math.min(1, dt / tp); };
    return n;
  },
  script: () => [[0, { s: 0 }], [0.3, { s: 1 }], [2.7, { s: 0 }], [4, { s: -1 }], [6.6, { s: 0 }]],
  charts: [
    { t: "Load position", u: "mm", s: [["position x", (n) => n.a.cyl.x * 1000]] },
    { t: "Speed (− = lowering)", u: "mm/s", s: [["v", (n) => n.a.cyl.v * 1000]] },
    { t: "Pressures", u: "MPa", s: [["cap side p_A", (n) => n.p("CA") / 1e6], ["rod side p_B (= pilot)", (n) => n.p("B") / 1e6]] },
  ],
  rd(n, P) {
    const c = n.a.cyl;
    return [...cylRd(c), ...pRd(n, [["Pump p_P", "P"], ["Cap side p_A", "CA"], ["Rod side p_B (pilot)", "B"]]), ["Setting p_set", f(n.ctx.ps / 1e6, 2) + " MPa"],
      ["Holding valve", n.ctx.mode === "none" ? "none" : n.e.hold.A > 1e-6 ? "OPEN (metering)" : "closed"], ["Fastest lowering so far", f(-n.ctx.vmin * 1000, 0) + " mm/s", -n.ctx.vmin > 0.2 ? "hc-bad" : ""],
      ["Cavitation rod side", n.N.B.cav ? "YES (vacuum)" : "no", n.N.B.cav ? "hc-bad" : "hc-ok"]];
  },
  draw(n, P, W, A) {
    const L = mkL(n, A), c = n.a.cyl, s = sOf(n), mode = n.ctx.mode;
    let o = hpu(n, A);
    o += L([[90, 415], [321, 415], [321, 403]], "P", qP(n)) + L([[339, 403], [339, 420]], 0, qT(n)) + hsTank(339, 420);
    o += hsDcv(330, 380, { s, centre: mode === "none" ? "closed" : "open", tag: "1V1" });
    const qa = n.q("chk") - n.q("hold");
    o += L([[321, 357], [321, 278]], "VA", qa) + L([[321, 222], [321, 207], [464, 207]], "CA", qa);
    if (mode === "cbv") o += hsCBV(321, 250, { tag: "1V2", open: n.e.hold.A > 1e-6, chk: n.q("chk") > 1e-6, set: `${f(n.ctx.ps / 1e6, 1)} MPa`, px: 420, py: 262 }) + hsDot(420, 262);
    else if (mode === "poc") o += L([[321, 278], [321, 263]], "VA", qa) + hsPOC(321, 250, "up", { tag: "1V2 POC", open: n.e.hold.A > 1e-6, px: 420, py: 256 }) + L([[321, 237], [321, 222]], "CA", qa);
    else o += L([[321, 278], [321, 222]], "CA", qa);
    o += L([[339, 357], [339, 330], [420, 330], [420, 70], [464, 70]], "B", qB(n));
    if (mode === "poc") o += hsPilot([[420, 290], [380, 290], [380, 256], [334, 256]]) + hsDot(420, 290);
    const cy = hsCyl(470, 60, { vert: true, len: 155, frac: c.x / c.L, pA: n.p("CA"), pB: n.p("B"), pm: PM, tag: "1A1 Ø63/36" });
    o += cy.svg.replace(/h6/g, "h0") + `<path d="M464,207 H470 M464,68 H470" class="hs-s"/>` + hsLoad(cy.tip, { vert: true, label: `m = ${P.m} kg`, g: true, w: 100 });
    o += hsGauge(520, 200, n.p("CA"), { label: "p_A" }) + hsGauge(520, 90, n.p("B"), { label: "p_B" });
    if (n.N.B.cav) o += hsTxt(600, 140, "CAVITATION – rod side empty", "middle", "hs-warnbig");
    o += hsTxt(600, 300, `v = ${f(c.v * 1000, 0)} mm/s`, "middle", "hs-big");
    o += legendNote(mode === "cbv" ? "Counterbalance: opens only when p_A + k·p_B ≥ p_set → the pump pressure controls the lowering." : mode === "poc" ? "Pilot check: opens fully → load runs ahead → p_B falls → closes → jerky." : "No holding valve: gravity drives the load through the spool → runaway, rod side cavitates.");
    return o;
  },
  txt: {
    what: "A relief-type valve in the line that carries the oil OUT of the cylinder when the load moves down, with a pilot line from the other cylinder line and a free-flow check for raising.",
    why: "A hanging load pulls the cylinder (overrunning load). Through the open spool it would fall faster than the pump can fill the other side → runaway and cavitation. A pilot check only knows OPEN or CLOSED → jerky lowering.",
    how: "Spring setting p_set ≈ 1.3 × max load pressure: the load alone can never open it. For lowering, the pump pressure in B (pilot, × ratio k) helps: open when p_A + k·p_B ≥ p_set. If the load runs ahead, p_B falls and the valve closes a little → smooth, the speed stays = Q_P / A2.",
    check: "Mount it directly on the cylinder port (hose-burst protection). Setting ≥ 1.3 × p_L (also covers thermal expansion). Pilot ratio: 3:1 for unstable loads / flexible machines, 8:1 for stiff machines (less pump pressure, less heat). Valve centre must vent A (float).",
    mistake: "Setting below the load pressure → the load creeps down. Closed-centre spool → the pilot is trapped → the valve may stay open. Using a high pilot ratio on a crane-like structure → oscillation. Forgetting that the outlet back pressure (T line) adds to the setting in non-vented valves.",
  },
  fx(P) {
    const m = +P.m, F = m * G0, pl = F / A63, ps = CBV.pset(P), k = +P.k, r = A63r / A63, pb = (ps - pl) / (k + r), v = 18.7 * LPM / A63r;
    return `<pre class="hc-pre">Load pressure       p_L = m·g / A1 = ${f(F / 1000, 2)} kN / ${f(A63 * 1e4, 2)} cm² = <b>${f(pl / 1e6, 2)} MPa</b>
Setting             p_set = ${P.fac} × p_L = <b>${f(ps / 1e6, 2)} MPa</b>  (rule 1.3 × max load pressure)
Opening condition   p_A + k·p_B ≥ p_set      (k = pilot ratio ${k}:1)
Force balance       p_A·A1 = m·g + p_B·A2  →  p_A = p_L + p_B·A2/A1   (A2/A1 = ${f(r, 3)})
Pilot pressure      p_B = (p_set − p_L) / (k + A2/A1) = (${f(ps / 1e6, 2)} − ${f(pl / 1e6, 2)}) / (${k} + ${f(r, 3)}) = <b>${f(pb / 1e6, 2)} MPa</b>
To pass the flow the poppet must open: A = Q_out/(Cd·√(2p_A/ρ)) = ${f(A63 * v * 1e6 / (0.62 * Math.sqrt(2 * (pl + pb * r) / 870)), 2)} mm² → with the valve gain (25 mm² per 3 MPa, catalogue Δp–Q curve)
                    extra ${f(A63 * v / (0.62 * Math.sqrt(2 * (pl + pb * r) / 870)) / 25e-6 * 3, 2)} MPa → running p_B ≈ ${f((ps - pl + A63 * v / (0.62 * Math.sqrt(2 * (pl + pb * r) / 870)) / 25e-6 * 3e6) / (k + r) / 1e6, 2)} MPa (see the gauge)
Cap side while lowering p_A = ${f(pl / 1e6, 2)} + ${f(pb / 1e6, 2)}·${f(r, 3)} = ${f((pl + pb * r) / 1e6, 2)} MPa
Lowering speed      v = Q_P / A2 = 18.7 L/min / ${f(A63r * 1e4, 1)} cm² = <b>${f(v, 3)} m/s</b>  (pump controls the speed)
Pump power lowering P = p_B·Q = ${f(pb / 1e5, 1)} bar · 18.7 / 600 = ${f(pb / 1e5 * 18.7 / 600, 2)} kW  (pilot ratio ${k}; with 8:1 → p_B = ${f((ps - pl) / (8 + r) / 1e6, 2)} MPa)
Heat in the valve   ≈ p_A·Q_out = ${f((pl + pb * r) / 1e6, 2)} MPa · ${f(A63 * v * 6e4, 1)} L/min = ${f((pl + pb * r) / 1e5 * A63 * v * 6e4 / 600, 2)} kW (the potential energy of the load)
Without the valve:  outflow only limited by the spool: Q = Cd·A·√(2·p_L/ρ) = 0.62·25 mm²·√(2·${f(pl / 1e6, 2)}e6/870) = ${f(orifice(25e-6, pl)[0] * 6e4, 0)} L/min → v ≈ ${f(orifice(25e-6, pl)[0] / A63, 2)} m/s ≫ ${f(v, 3)} m/s → runaway, cavitation</pre>`;
  },
  set(P) {
    const pl = +P.m * G0 / A63 / 1e6;
    return [["1V2 counterbalance", `${f(+P.fac * pl, 1)} MPa`, `${P.fac} × p_L (${f(pl, 2)} MPa), ≥ 1.3 ×; below the relief ${10} MPa`], ["Pilot ratio", `${P.k} : 1`, "3:1 unstable load, 4.5:1 general, 8:1 stiff machine"],
      ["0V1 relief", "10 MPa", "> p_set needed only if raising needs it; here raising needs 6.3 MPa"], ["1V1 centre", "open H / float (A, B → T)", "vents the valve outlet and the pilot"],
      ["Mounting", "on the cylinder port", "hose burst: the load stays (ISO 4413)"]];
  },
  fail: [["Load creeps down at stop", "setting below p_L (or worn seat, too hot)", "set ≥ 1.3 × p_L, check with gauge on A"],
    ["Lowering oscillates / chatters", "pilot ratio too high, long hoses, flexible structure", "lower ratio (3:1), damping orifice in the pilot, valve on the cylinder"],
    ["Load does not lower", "pilot too low because of T-line back pressure / wrong ratio", "check p_B, use a vented (externally drained) valve"],
    ["Runaway when the hose bursts", "valve mounted at the HPU, not on the cylinder", "mount on the cylinder port"],
    ["Hot oil during lowering", "the load energy turns into heat", "normal; for big loads: regenerative lowering or counterbalance with low ratio"]],
  twin: "In the twin: the APC lift (Pallet changer) lowers a pallet of up to 2–3 t – with a counterbalance valve the lowering speed is the same for an empty and a full pallet. A vertical HMC axis with a hydraulic weight balance uses the same rule.",
  test(P) {
    const out = [], pl = +P.m * G0 / A63, ps = CBV.pset(P), k = +P.k, r = A63r / A63;
    const run = (h, w) => runScript(CBV, Object.assign({}, P, { hold: h }), w, (n) => ({ x: n.a.cyl.x, v: n.a.cyl.v, pB: n.p("B"), pA: n.p("CA") }), 0.02);
    const a = run("cbv", {}), b = run("poc", {}), c = run("cbv", { none: true });
    const s5 = at(a.out, 5.2), vmin = (r_) => Math.min(...r_.out.filter((s) => s.t > 4 && s.t < 6.5).map((s) => s.v));
    const vstd = (r_) => { const vs = r_.out.filter((s) => s.t > 4.6 && s.t < 5.4 && s.x > 0.01).map((s) => s.v); const mu = vs.reduce((x, y) => x + y, 0) / (vs.length || 1); return Math.sqrt(vs.reduce((x, y) => x + (y - mu) ** 2, 0) / (vs.length || 1)); };
    const Aq = A63 * 18.7 * LPM / A63r / (0.62 * Math.sqrt(2 * (pl + 0.75e6 * r) / 870)), dpo = Aq / 25e-6 * 3e6;
    out.push(`cbv: p_L=${f(pl / 1e6, 3)} p_set=${f(ps / 1e6, 3)} hand p_B crack=${f((ps - pl) / (k + r) / 1e6, 3)} with opening ${f(Aq * 1e6, 2)}mm² (+${f(dpo / 1e6, 2)}MPa gain)=${f((ps - pl + dpo) / (k + r) / 1e6, 3)} sim p_B=${f(s5.pB / 1e6, 3)} | hand v=${f(18.7 * LPM / A63r * 1000, 1)}mm/s sim v=${f(-s5.v * 1000, 1)}`);
    out.push(`cbv: lowering speed spread (std) cbv=${f(vstd(a) * 1000, 1)}mm/s poc=${f(vstd(b) * 1000, 1)}mm/s (poc jerky = larger) | none: max lowering v=${f(-vmin(c) * 1000, 0)}mm/s (runaway) hand≈${f(orifice(25e-6, pl)[0] / A63 * 1000, 0)}`);
    return out;
  },
};

/* ======================================================================= 3  METER-IN / METER-OUT / BLEED-OFF */
const METER = {
  id: "meter", n: 3, title: "Speed control – meter-in, meter-out, bleed-off", sub: "pressure-compensated flow control valve, intensification, heat, overrunning load",
  P: [
    { k: "mode", l: "Position of the flow control valve 1V2", v: "out", opts: [["in", "meter-in (A line, inlet)"], ["out", "meter-out (B line, outlet)"], ["bleed", "bleed-off (A line → tank)"]] },
    { k: "Q", l: "Set flow Q_set", u: "L/min", v: 8, min: 2, max: 16, st: 0.5 },
    { k: "F", l: "Load force on extension (− = pulling / overrunning)", u: "kN", v: 10, min: -15, max: 25, st: 1 },
  ],
  W: [{ k: "nofc", l: "without the flow control valve (full pump flow)" }],
  V: [{ k: "s", l: "Valve 1V1", opts: [[1, "Y1 ▶ extend"], [0, "0 stop"], [-1, "Y2 ◀ retract"]] }],
  dur: 10,
  make(P, W) {
    const n = new Net({ dt: 2e-5 }), Qs = +P.Q * LPM, mode = W.nofc ? "none" : P.mode;
    n.node("P", 0.3).node("VA", 0.15).node("CA", 0.3).node("CB", 0.3).node("VB", 0.15);
    pump(n, 18.7); relief(n);
    dcv(n, { P: "P", A: "VA", B: "VB", Av: 25e-6, centre: "tandem", leak: leakG(30) });
    n.ctx = { mode, Eloss: 0, Ein: 0, Euse: 0 };
    const big = () => 60e-6;
    if (mode === "in") n.add(fcv("VA", "CA", () => Qs, { name: "fc", Acheck: 40e-6 })); else n.add(orif("VA", "CA", big, { name: "lineA" }));
    if (mode === "out") n.add(fcv("CB", "VB", () => Qs, { name: "fc", Acheck: 40e-6 })); else n.add(orif("CB", "VB", big, { name: "lineB" }));
    if (mode === "bleed") n.add(fcv("CA", "T", () => Qs, { name: "fc" }));
    const F = +P.F * 1000;
    n.act(cyl({ name: "cyl", A: "CA", B: "CB", D: 63, d: 36, L: 0.2, m: 300, F: (nn, c) => (c.x > 0.001 && c.x < c.L - 0.001 ? F : (c.v === 0 ? 0 : F)), c: 3000, Ff: 200 }));
    n.pre = (nn, dt) => { const pin = nn.p("P") * nn.q("pump"); const use = nn.a.cyl.Fload * nn.a.cyl.v; nn.ctx.Ein += pin * dt; nn.ctx.Euse += use * dt; nn.ctx.Pin = pin; nn.ctx.Puse = use; };
    return n;
  },
  script: () => [[0, { s: 0 }], [0.3, { s: 1 }], [6.2, { s: -1 }], [8.6, { s: 0 }]],
  charts: [
    { t: "Speed", u: "mm/s", s: [["v", (n) => n.a.cyl.v * 1000]] },
    { t: "Pressures", u: "MPa", s: [["pump p_P", (n) => n.p("P") / 1e6], ["cap side p_A", (n) => n.p("CA") / 1e6], ["rod side p_B", (n) => n.p("CB") / 1e6]] },
    { t: "Power", u: "kW", s: [["pump output p·Q", (n) => n.ctx.Pin / 1000], ["useful F·v", (n) => n.ctx.Puse / 1000]] },
  ],
  rd(n) {
    const c = n.a.cyl, fc = n.e.fc;
    return [...cylRd(c), ...pRd(n, [["Pump p_P", "P"], ["Cap side p_A", "CA"], ["Rod side p_B", "CB"]]), ["Flow over relief", f(n.q("relief") * 6e4, 1) + " L/min"],
      ["Flow valve regulating", fc ? (fc.reg ? "yes (Δp ≥ min)" : "no (fully open)") : "–"], ["Pump power p·Q", f(n.ctx.Pin / 1000, 2) + " kW"], ["Useful power F·v", f(n.ctx.Puse / 1000, 2) + " kW"],
      ["Loss = heat", f((n.ctx.Pin - n.ctx.Puse) / 1000, 2) + " kW", n.ctx.Pin - n.ctx.Puse > 2000 ? "hc-bad" : ""], ["Cavitation cap side", n.N.CA.cav ? "YES – runaway" : "no", n.N.CA.cav ? "hc-bad" : "hc-ok"]];
  },
  draw(n, P, W, A) {
    const L = mkL(n, A), c = n.a.cyl, s = sOf(n), mode = n.ctx.mode, fc = n.e.fc;
    let o = hpu(n, A);
    o += L([[90, 415], [321, 415], [321, 403]], "P", qP(n)) + L([[339, 403], [339, 420]], 0, qT(n)) + hsTank(339, 420);
    o += hsDcv(330, 380, { s, centre: "tandem", tag: "1V1" });
    const qa = qA(n), qb = -qB(n);
    // A line
    if (mode === "in") o += L([[321, 357], [321, 300], [250, 300], [250, 278]], "VA", qa) + hsFCV(250, 258, { tag: "1V2", check: "down", reg: fc.reg, chkOpen: fc.q < -1e-6, set: `${P.Q} L/min` }) + L([[250, 238], [250, 215], [258, 215], [258, 190]], "CA", qa);
    else o += L([[321, 357], [321, 300], [258, 300], [258, 190]], mode === "bleed" ? "CA" : "VA", qa);
    if (mode === "bleed") o += hsDot(258, 260) + L([[258, 260], [200, 260], [200, 238]], "CA", fc.q) + hsFCV(200, 218, { tag: "1V2", reg: fc.reg, set: `${P.Q} L/min` }).replace(/data-hcinfo="fcv"/, 'data-hcinfo="fcv"') + L([[200, 198], [200, 180], [180, 180]], 0, fc.q) + `<g transform="rotate(90 172 180)">${hsTank(172, 180).replace(/hs-s/, "hs-s")}</g>`;
    // B line
    if (mode === "out") o += L([[339, 357], [339, 300], [430, 300], [430, 278]], "VB", qb) + hsFCV(430, 258, { tag: "1V2", check: "up", reg: fc.reg, chkOpen: fc.q < -1e-6, set: `${P.Q} L/min` }) + L([[430, 238], [430, 215], [412, 215], [412, 190]], "CB", qb);
    else o += L([[339, 357], [339, 300], [412, 300], [412, 190]], "VB", qb);
    // cylinder (horizontal) A port at x+8, B port at x+len−8
    const cy = hsCyl(250, 150, { len: 170, frac: c.x / c.L, pA: n.p("CA"), pB: n.p("CB"), pm: PM, tag: "1A1 Ø63/36" });
    o += cy.svg + hsLoad(cy.tip, { label: "m 300 kg", F: `F ${P.F} kN`, w: 70 });
    o += hsGauge(230, 120, n.p("CA"), { label: "p_A", ta: "end" }) + hsGauge(440, 120, n.p("CB"), { label: "p_B" });
    if (n.N.CA.cav) o += hsTxt(560, 240, "CAVITATION cap side – load runs away", "middle", "hs-warnbig");
    o += hsTxt(600, 300, `v = ${f(c.v * 1000, 0)} mm/s · loss ${f((n.ctx.Pin - n.ctx.Puse) / 1000, 2)} kW`, "middle", "hs-big");
    o += legendNote({ in: "Meter-in: pump pressure at relief, extra flow over 0V1 → heat. Cannot hold a pulling load.", out: "Meter-out: back pressure in the rod side. Low load → p_B = p·A1/A2 (intensification!).", bleed: "Bleed-off: excess flow to the tank at load pressure → efficient, but speed depends on pump leakage.", none: "No flow valve: full pump flow, speed = Q_P/A1." }[mode]);
    return o;
  },
  txt: {
    what: "A 2-way pressure-compensated flow control valve (throttle + compensator) sets the cylinder speed independent of the load. Three places: in the inlet (meter-in), in the outlet (meter-out) or in a branch to the tank (bleed-off).",
    why: "Feed speeds (drilling, pressing, slow approach) must be constant when the load changes. The place of the valve decides the heat, the pressures in the cylinder and whether a pulling load can run away.",
    how: "Meter-in: the valve passes Q_set into A, the rest of the pump flow goes over the relief (pump at relief pressure). Meter-out: the valve limits the oil leaving B → the cylinder is 'clamped' between two oil columns, holds pulling loads. Bleed-off: the valve bleeds Q_set to the tank, the cylinder gets Q_P − Q_set at load pressure only.",
    check: "Meter-out: rate the rod side (cylinder, hoses, valve B port) for p·A1/A2. Meter-in only for loads that always push against the movement. Min. Δp over the valve for regulation (≈ 0.6–1 MPa). Heat balance (item 3).",
    mistake: "Meter-in with a pulling load (vertical down, cutting forces in the feed direction) → runaway, cavitation. Meter-out on a cylinder with a small rod ratio and no load → rod side 15 MPa+, seal or hose failure. Bleed-off for exact feed → speed changes with pump wear and oil temperature.",
  },
  fx(P) {
    const Qs = +P.Q, F = +P.F * 1000, vin = Qs * LPM / A63, vout = Qs * LPM / A63r, vb = (18.7 - Qs) * LPM / A63, pA = F / A63, pbI = (10e6 * A63 - F) / A63r;
    const Pin = 10e6 * 18.7 * LPM, Puse = F * vin;
    return `<pre class="hc-pre">Areas  A1 = ${f(A63 * 1e4, 2)} cm²  A2 = ${f(A63r * 1e4, 2)} cm²   A1/A2 = ${f(A63 / A63r, 3)}   pump 18.7 L/min, relief 10 MPa
Speeds (flow valve meters Q_set = ${Qs} L/min):
  meter-in   v = Q_set / A1 = ${f(vin * 1000, 1)} mm/s
  meter-out  v = Q_set / A2 = ${f(vout * 1000, 1)} mm/s   (the valve meters the ANNULUS oil → faster for the same setting!)
  bleed-off  v = (Q_P − Q_set) / A1 = ${f(vb * 1000, 1)} mm/s
Load pressure p_A = F / A1 = ${f(F / 1000, 1)} kN / ${f(A63 * 1e4, 2)} cm² = ${f(pA / 1e6, 2)} MPa
Meter-out rod-side pressure (pump at relief): p_B = (p·A1 − F) / A2 = (10·${f(A63 * 1e4, 2)} − ${f(F / 1000, 1)}·10) / ${f(A63r * 1e4, 2)} = <b>${f(pbI / 1e6, 2)} MPa</b>
   no load (F = 0): p_B = p·A1/A2 = 10 · ${f(A63 / A63r, 3)} = <b>${f(10 * A63 / A63r, 2)} MPa</b>  ← intensification, rate the rod side for it
Heat, meter-in:  P_in = p_relief·Q_P = 100 bar·18.7/600 = ${f(Pin / 1000, 2)} kW,  useful F·v = ${f(Puse / 1000, 2)} kW → loss ${f((Pin - Puse) / 1000, 2)} kW
Heat, bleed-off: P_in = p_A·Q_P = ${f(Math.max(pA, 0) / 1e5, 1)} bar·18.7/600 = ${f(Math.max(pA, 0) * 18.7 * LPM / 1000, 2)} kW, useful F·v = ${f(F * vb / 1000, 2)} kW → loss ${f((Math.max(pA, 0) * 18.7 * LPM - F * vb) / 1000, 2)} kW
Overrunning load (F < 0): only meter-out holds it (outlet throttled). Meter-in and bleed-off → the load pulls the piston faster than the oil comes → cavitation.</pre>`;
  },
  set(P) {
    return [["1V2 flow valve", `${P.Q} L/min`, "set at the real load + warm oil (40–50 °C); min. Δp 0.6–1 MPa"], ["0V1 relief", "10 MPa", "meter-in: pump runs at this pressure during feed"],
      ["Rod side rating", `≥ ${f(10 * A63 / A63r, 1)} MPa`, "meter-out intensification p·A1/A2"], ["1V1 centre", "tandem (P → T)", "pump unloaded at stop"]];
  },
  fail: [["Speed changes with the load", "plain throttle (no compensator) or Δp below minimum", "pressure-compensated valve, check Δp ≥ 1 MPa"],
    ["Load runs away / jumps forward at the break-through (drilling)", "meter-in with a pulling or suddenly falling load", "meter-out (or counterbalance)"],
    ["Rod seal or rod-side hose fails", "meter-out intensification p·A1/A2", "rate parts for it, add a relief on the rod side"],
    ["Oil hot", "meter-in / meter-out with a fixed pump: excess flow over the relief", "variable pump or load sensing (circuit 8), bleed-off"],
    ["Speed drifts after warm-up", "viscosity → leakage of the pump (bleed-off) / temperature-dependent throttle", "temperature-compensated (sharp-edged) throttle, cooler"]],
  twin: "In the twin: feed axes of machine tools are electric (ball screws), but hydraulic fixture cylinders and the APC lift use meter-out throttle check valves so they move smoothly with any pallet weight.",
  test(P) {
    const out = [];
    const r = (m, F) => runScript(METER, Object.assign({}, P, { mode: m, F }), {}, (n) => ({ v: n.a.cyl.v, pB: n.p("CB"), pA: n.p("CA"), pP: n.p("P") }), 0.02);
    const vi = at(r("in", 10).out, 1.5).v, vo = at(r("out", 10).out, 1.5), vb = at(r("bleed", 10).out, 1.5).v, v0 = at(r("out", 0).out, 1.5);
    out.push(`meter: v_in sim=${f(vi * 1000, 1)} hand=${f(8 * LPM / A63 * 1000, 1)} | v_out sim=${f(vo.v * 1000, 1)} hand=${f(8 * LPM / A63r * 1000, 1)} | v_bleed sim=${f(vb * 1000, 1)} hand=${f(10.7 * LPM / A63 * 1000, 1)} mm/s`);
    const fr = 200 + 3000 * 8 * LPM / A63r; out.push(`meter: intensification F=0 p_B sim=${f(v0.pB / 1e6, 2)} hand (p_A·A1 − friction ${f(fr, 0)} N)/A2=${f((v0.pA * A63 - fr) / A63r / 1e6, 2)} (p_A=${f(v0.pA / 1e6, 2)}, ideal p·A1/A2=${f(10 * A63 / A63r, 2)}) | F=10kN p_B sim=${f(vo.pB / 1e6, 2)} hand=${f((vo.pA * A63 - 10000 - fr) / A63r / 1e6, 2)}`);
    const ov = r("in", -10); out.push(`meter: overrunning −10 kN meter-in max v=${f(Math.max(...ov.out.map((s) => s.v)) * 1000, 0)} mm/s (runaway) vs meter-out ${f(at(r("out", -10).out, 1.5).v * 1000, 1)} mm/s`);
    return out;
  },
};

/* ======================================================================= 4  SEQUENCE + PRESSURE REDUCING */
const SEQ = {
  id: "seq", n: 4, title: "Sequence circuit – clamp, then work (+ pressure reducing valve)", sub: "clamp branch 5 MPa from a 10 MPa system, work starts only when the clamp is tight",
  P: [
    { k: "how", l: "How the work cylinder waits", v: "seq", opts: [["seq", "sequence valve 2V1 (hydraulic)"], ["ps", "pressure switch 1S1 + PLC + valve 2V2"]] },
    { k: "pr", l: "Clamp pressure (reducing valve 1V2)", u: "MPa", v: 5, min: 2, max: 8, st: 0.5 },
    { k: "Fw", l: "Work force (last 80 mm)", u: "kN", v: 15, min: 2, max: 25, st: 1 },
  ],
  W: [{ k: "noSeq", l: "without the sequence valve / pressure switch" }, { k: "noPRV", l: "without the pressure reducing valve" }],
  V: [{ k: "s", l: "Valve 1V1", opts: [[1, "Y1 ▶ clamp + work"], [0, "0 stop"], [-1, "Y2 ◀ return"]] }],
  dur: 9,
  make(P, W) {
    const n = new Net({ dt: 2e-5 }), pr = +P.pr * MPA, pseq = pr + 1.5 * MPA, Fw = +P.Fw * 1000;
    n.node("P", 0.3).node("VA", 0.2).node("PR", 0.1).node("CA", 0.1).node("WA", 0.3).node("VB", 0.3);
    pump(n, 18.7); relief(n);
    dcv(n, { P: "P", A: "VA", B: "VB", Av: 25e-6, centre: "tandem", leak: leakG(20) });
    n.ctx = { pseq, ps: false, Fstart: null, how: P.how };
    // clamp branch: reducing valve (VA→PR) + pilot check (PR→CA free, reverse piloted by VB)
    if (W.noPRV) n.add(orif("VA", "PR", () => 40e-6, { name: "prv" }));
    else { n.add(orif("VA", "PR", (nn) => 30e-6 * ramp(pr - nn.p("PR"), 0, 0.4e6), { name: "prv", tau: 0.002 })); n.add(orif("PR", "T", (nn) => 4e-6 * ramp(nn.p("PR") - pr - 0.15e6, 0, 0.3e6), { name: "prvRel" })); n.add(orif("PR", "VA", (nn) => 30e-6 * ramp(nn.p("PR") - nn.p("VA"), 0.05e6, 0.3e6), { name: "prvChk" })); }
    n.add(orif("PR", "CA", (nn) => 30e-6 * Math.max(ramp(nn.p("PR") - nn.p("CA"), 0.05e6, 0.3e6), ramp(3 * nn.p("VB") - (nn.p("CA") - nn.p("PR")), 0.2e6, 1e6)), { name: "poc", tau: 0.008 }));
    // work branch
    if (W.noSeq) n.add(orif("VA", "WA", () => 40e-6, { name: "seq" }));
    else if (P.how === "seq") { n.add(orif("VA", "WA", (nn) => 30e-6 * ramp(nn.p("VA") - pseq, 0, 0.6e6), { name: "seq", tau: 0.01 })); n.add(orif("WA", "VA", (nn) => 30e-6 * ramp(nn.p("WA") - nn.p("VA"), 0.05e6, 0.3e6), { name: "seqChk" })); }
    else { n.add(orif("VA", "WA", (nn) => (nn.ctx.ps ? 30e-6 : 0), { name: "seq", tau: 0.04 })); n.add(orif("WA", "VA", (nn) => 30e-6 * ramp(nn.p("WA") - nn.p("VA"), 0.05e6, 0.3e6), { name: "seqChk" })); }
    n.act(cyl({ name: "clamp", A: "CA", B: "VB", D: 40, d: 22, L: 0.02, m: 10, F: () => 300, c: 2000, Ff: 100 }));
    n.act(cyl({ name: "work", A: "WA", B: "VB", D: 63, d: 36, L: 0.2, m: 200, F: (nn, c) => (c.x > 0.12 ? Fw : 1000), c: 3000, Ff: 200 }));
    n.pre = (nn) => {
      const cp = nn.p("CA");
      if (!nn.ctx.ps && cp > pr - 0.5e6) nn.ctx.ps = true; if (nn.ctx.ps && cp < pr - 1e6) nn.ctx.ps = false;
      if (nn.ctx.Fstart === null && nn.a.work.v > 0.005) nn.ctx.Fstart = Math.max(0, (cp * nn.a.clamp.A1 - nn.p("VB") * nn.a.clamp.A2 - 300) / 1000);
      if ((nn.u.s || 0) <= 0 && nn.a.work.x < 0.002) nn.ctx.Fstart = null;
    };
    return n;
  },
  script: () => [[0, { s: 0 }], [0.3, { s: 1 }], [5.6, { s: -1 }], [8, { s: 0 }]],
  charts: [
    { t: "Positions", u: "mm", s: [["clamp ×5 (stroke 20 mm)", (n) => n.a.clamp.x * 5000], ["work cylinder", (n) => n.a.work.x * 1000]] },
    { t: "Pressures", u: "MPa", s: [["pump line A", (n) => n.p("VA") / 1e6], ["clamp", (n) => n.p("CA") / 1e6], ["work cylinder", (n) => n.p("WA") / 1e6]] },
  ],
  rd(n) {
    const c = n.a.clamp, w = n.a.work, Fc = Math.max(0, (n.p("CA") * c.A1 - n.p("VB") * c.A2 - 300) / 1000);
    return [["Clamp position", f(c.x * 1000, 1) + " / 20 mm"], ["Work position", f(w.x * 1000, 0) + " / 200 mm"], ...pRd(n, [["Pump p_P", "P"], ["Line A (before 1V2/2V1)", "VA"], ["Clamp p", "CA"], ["Work cylinder p", "WA"]]),
      ["Clamp force", f(Fc, 2) + " kN"], ["Clamp force when work started", n.ctx.Fstart === null ? "–" : f(n.ctx.Fstart, 2) + " kN", n.ctx.Fstart !== null && n.ctx.Fstart < 5 ? "hc-bad" : "hc-ok"], ["Pressure switch 1S1", n.ctx.ps ? "ON (clamped)" : "off"]];
  },
  draw(n, P, W, A) {
    const L = mkL(n, A), s = sOf(n), c = n.a.clamp, w = n.a.work, how = n.ctx.how;
    let o = hpu(n, A);
    o += L([[90, 415], [321, 415], [321, 403]], "P", qP(n)) + L([[339, 403], [339, 420]], 0, qT(n)) + hsTank(339, 420);
    o += hsDcv(330, 380, { s, centre: "tandem", tag: "1V1" });
    const qprv = n.q("prv") - n.q("prvChk"), qseq = n.q("seq") - n.q("seqChk");
    o += L([[321, 357], [321, 330], [220, 330], [220, 316]], "VA", qprv) + L([[321, 330], [500, 330], [500, 316]], "VA", qseq) + hsDot(321, 330);
    // clamp branch x=220: PRV 1V2 (300) → PR → POC 1V3 (230) → clamp A
    o += W.noPRV ? L([[220, 316], [220, 282]], "PR", qprv) : hsPRV(220, 298, { tag: "1V2", open: n.e.prv.A / 30e-6, set: `${P.pr} MPa` }) + hsPilot([[228, 312], [228, 322]]);
    o += L([[220, 280], [220, 263]], "PR", n.q("poc")) + hsPOC(220, 250, "up", { tag: "1V3", open: n.e.poc.A > 1e-6, px: 175, py: 256 }) + L([[220, 237], [220, 222], [158, 222], [158, 200]], "CA", n.q("poc"));
    o += hsGauge(250, 222, n.p("CA"), { label: "clamp" });
    // work branch x=500: sequence valve 2V1 (or valve 2V2) → work A
    if (W.noSeq) o += L([[500, 316], [500, 230]], "WA", qseq);
    else if (how === "seq") o += hsSeq(500, 298, { tag: "2V1", open: n.e.seq.A / 30e-6, set: `${f(n.ctx.pseq / 1e6, 1)} MPa`, check: true }) + L([[500, 280], [500, 230]], "WA", qseq);
    else o += L([[500, 316], [500, 308]], "VA", qseq) + hsDcv(500, 285, { s: n.ctx.ps ? 1 : 0, centre: "none", tag: "", keyA: "none", solA: "Y3" }).replace(/data-hcinfo="dcv"/, 'data-hcinfo="dcv"') + L([[491, 262], [491, 230]], "WA", qseq);
    o += L([[how === "ps" && !W.noSeq ? 491 : 500, 230], [458, 230], [458, 200]], "WA", qseq);
    // B lines
    o += L([[339, 357], [339, 345], [620, 345], [620, 120], [584, 120], [584, 200]], "VB", -qB(n)) + L([[620, 120], [620, 100], [270, 100], [270, 200]], "VB", 0) + hsDot(620, 120);
    o += hsPilot([[175, 256], [175, 345], [339, 345]].slice(0, 2)) + hsPilot([[175, 345], [339, 345]]);
    // cylinders (horizontal): clamp at x=150, work at 450
    const cc = hsCyl(150, 166, { len: 128, frac: c.x / c.L, pA: n.p("CA"), pB: n.p("VB"), pm: PM, tag: "1A1 clamp Ø40/22" });
    const cw = hsCyl(450, 166, { len: 142, frac: w.x / w.L, pA: n.p("WA"), pB: n.p("VB"), pm: PM, tag: "2A1 work Ø63/36" });
    o += cc.svg + `<rect x="${cc.tip[0]}" y="168" width="14" height="30" class="hs-load"/>` + cw.svg + hsLoad(cw.tip, { label: w.x > 0.12 ? `${P.Fw} kN` : "1 kN", w: 46 });
    if (how === "ps" && !W.noSeq) o += hsPS(140, 260, { tag: "1S1", on: n.ctx.ps, set: `${f(+P.pr - 0.5, 1)} MPa` }) + L([[140, 272], [140, 280], [220, 280]], "CA", 0) + hsElec([[162, 260], [180, 260], [180, 140], [440, 140], [440, 285], [455, 285]]);
    o += hsGauge(530, 230, n.p("WA"), { label: "work" });
    if (n.ctx.Fstart !== null) o += hsTxt(560, 470, `clamp force at work start: ${f(n.ctx.Fstart, 1)} kN`, "middle", n.ctx.Fstart < 5 ? "hs-warnbig" : "hs-big");
    o += legendNote(W.noSeq ? "No sequence: the oil takes the easiest way → the work cylinder starts before the part is clamped." : "Oil goes to the clamp first (low pressure). Work starts only when line A reaches the sequence setting.");
    return o;
  },
  txt: {
    what: "Two actuators on one valve, in a fixed order: first the clamp (1A1) closes, then the work cylinder (2A1) moves. A pressure reducing valve gives the clamp its own lower pressure.",
    why: "Oil always takes the path of least resistance. Without a sequence element the work cylinder may start before the part is fully clamped → the part moves, tool breaks, danger. A thin part would be crushed by full system pressure.",
    how: "Line A: the clamp needs little pressure to move → it moves first. When it is closed the pressure rises; the reducing valve 1V2 closes at 5 MPa (clamp force constant). At 6.5 MPa the sequence valve 2V1 opens and the work cylinder moves. The pilot check 1V3 keeps the clamp pressure when line A drops. Alternative: pressure switch 1S1 on the clamp → PLC → valve 2V2 (better diagnosis, interlock in the safety program).",
    check: "Sequence setting ≥ clamp pressure + 1–1.5 MPa and ≥ the pressure the clamp needs to move. During work line A stays at the sequence setting (throttling loss!). Clamp force = p·A·η. Return order: with one valve both return together – if the clamp must open last, use a second sequence valve in line B or the PLC.",
    mistake: "Sequence valve set below the work load pressure → it opens and closes (chatter); set below the clamp pressure → work starts before full clamp force. Reducing valve without a free drain → clamp pressure creeps to system pressure. No pilot check → clamp pressure is lost when the work cylinder needs more flow.",
  },
  fx(P) {
    const pr = +P.pr, Ac = areaD(40), Fc = pr * 1e6 * Ac, pseq = pr + 1.5, Fw = +P.Fw;
    return `<pre class="hc-pre">Clamp force       F_c = p_red·A1 − spring/friction = ${pr} MPa · ${f(Ac * 1e4, 2)} cm² = <b>${f(Fc / 1000, 2)} kN</b> (− 0.3 kN friction)
Clamp needs       F_c ≥ S·F_cut/μ  e.g. cutting force 1.5 kN, μ 0.15 (steel/steel), 2 jaws, S = 2 → 1.5·2/(0.15·2) = 10 kN → 2 clamps
Sequence setting  p_seq ≥ p_red + 1…1.5 MPa = ${pr} + 1.5 = <b>${f(pseq, 1)} MPa</b>
Work cylinder     p_work = F_w / A1 = ${Fw} kN / ${f(A63 * 1e4, 2)} cm² = ${f(Fw * 1000 / A63 / 1e6, 2)} MPa  → line A stays at ${f(Math.max(pseq, Fw * 1000 / A63 / 1e6), 2)} MPa
Max work force    F_max = (p_relief − Δp_seq…) · A1 ≈ 10 MPa · ${f(A63 * 1e4, 2)} cm² = ${f(10e6 * A63 / 1000, 1)} kN
Loss at 2V1       ΔP = (p_seq − p_work)·Q = ${f(Math.max(0, pseq - Fw * 1000 / A63 / 1e6), 2)} MPa · 18.7 L/min = ${f(Math.max(0, pseq - Fw * 1000 / A63 / 1e6) * 10 * 18.7 / 600, 2)} kW
Without the reducing valve the clamp sees 10 MPa → ${f(10e6 * Ac / 1000, 1)} kN (twice the force – thin parts bend)</pre>`;
  },
  set(P) {
    return [["0V1 relief", "10 MPa", "system"], ["1V2 pressure reducing", `${P.pr} MPa`, "clamp force; drain line free to tank"], ["2V1 sequence", `${f(+P.pr + 1.5, 1)} MPa`, "≥ clamp + 1–1.5 MPa"],
      ["1S1 pressure switch (option)", `${f(+P.pr - 0.5, 1)} MPa rising`, "PLC releases the work only when clamped (interlock)"], ["1V3 pilot check", "ratio 3:1", "keeps the clamp pressure"]];
  },
  fail: [["Work starts before clamp is tight", "sequence setting too low / no sequence", "set ≥ clamp + 1.5 MPa; use pressure switch interlock"],
    ["Clamp force too high", "reducing valve drain blocked / valve stuck open", "free drain, check outlet gauge"],
    ["Clamp opens during machining", "line A pressure drops (work needs flow), no check valve", "pilot check in the clamp branch, accumulator (circuit 6)"],
    ["Sequence valve chatters", "work load pressure ≈ sequence setting", "raise the setting or use a pressure switch"],
    ["Unclamps before the tool is back", "both return in parallel", "second sequence valve in line B / PLC sequence"]],
  twin: "In the twin: the HMC rotary table clamp works at 5 MPa from the 10 MPa unit (reducing valve) and the PLC checks a pressure switch before the spindle may cut (HMC build docs/12, PLC tab). The APC clamps the pallet before the arm moves (zero-point clamp, docs/09).",
  test(P) {
    const out = [];
    const r = (w, how) => runScript(SEQ, Object.assign({}, P, { how }), w, (n) => ({ c: n.a.clamp.x, w: n.a.work.x, pc: n.p("CA"), Fs: n.ctx.Fstart }), 0.02);
    const a = r({}, "seq"), b = r({ noSeq: true }, "seq"), c = r({ noPRV: true }, "seq"), d = r({}, "ps");
    const tW = (rr) => (rr.out.find((s) => s.w > 0.002) || { t: NaN }).t, tC = (rr) => (rr.out.find((s) => s.c > 0.0195) || { t: NaN }).t;
    out.push(`seq: clamp closed t=${f(tC(a), 2)}s work starts t=${f(tW(a), 2)}s clamp p at 3s=${f(at(a.out, 3).pc / 1e6, 2)}MPa (hand ${P.pr}) Fclamp at work start=${f(at(a.out, 5).Fs, 2)}kN hand=${f((+P.pr * 1e6 * areaD(40) - 300) / 1000, 2)}`);
    out.push(`seq: no sequence → work starts t=${f(tW(b), 2)}s (before clamp closed t=${f(tC(b), 2)}s) Fclamp at start=${f(at(b.out, 5).Fs, 2)}kN | no PRV clamp p=${f(at(c.out, 5).pc / 1e6, 2)}MPa | pressure switch mode work start t=${f(tW(d), 2)}s`);
    return out;
  },
};

/* ======================================================================= 5  REGENERATIVE */
const REGEN = {
  id: "regen", n: 5, title: "Regenerative extension (differential circuit)", sub: "fast approach with the rod-side oil fed back, switch-off for full force",
  P: [
    { k: "mode", l: "Regeneration", v: "auto", opts: [["auto", "automatic switch-off by pressure switch 1S1"], ["off", "never (normal circuit)"]] },
    { k: "Fw", l: "Work force (last 50 mm)", u: "kN", v: 20, min: 5, max: 28, st: 1 },
    { k: "rod", l: "Rod diameter", v: 36, opts: [[36, "Ø63/36 (φ = 1.48)"], [45, "Ø63/45 (φ = 2.04: out = in speed)"]] },
  ],
  W: [{ k: "always", l: "without switch-off (regeneration stays on)" }],
  V: [{ k: "s", l: "Valve 1V1", opts: [[1, "Y1 ▶ extend"], [0, "0 stop"], [-1, "Y2 ◀ retract"]] }],
  dur: 7,
  make(P, W) {
    const n = new Net({ dt: 2e-5 }), mode = W.always ? "always" : P.mode, d = +P.rod, Fw = +P.Fw * 1000;
    n.node("P", 0.3).node("A", 0.4).node("B", 0.3);
    pump(n, 18.7); relief(n);
    n.ctx = { mode, regen: false, psw: 8 * MPA };
    const s = () => n.u.s || 0, pos = () => Math.max(0, s()), neg = () => Math.max(0, -s());
    n.add(orif("P", "A", () => 25e-6 * pos(), { name: "PA", tau: 0.04 }));
    n.add(orif("A", "T", () => 25e-6 * neg(), { name: "AT", tau: 0.04 }));
    n.add(orif("P", "B", () => 25e-6 * neg(), { name: "PB", tau: 0.04 }));
    n.add(orif("B", "T", () => 25e-6 * pos() * (n.ctx.regen ? 0 : 1), { name: "BT", tau: 0.03 }));
    n.add(orif("B", "A", (nn) => (nn.ctx.regen && pos() > 0 ? 40e-6 * ramp(nn.p("B") - nn.p("A"), 0.03e6, 0.2e6) : 0), { name: "reg", tau: 0.03 }));
    n.add(orif("P", "T", () => 30e-6 * Math.max(0, 1 - Math.abs(s()) * 1.6), { name: "cPT", tau: 0.04 }));
    n.act(cyl({ name: "cyl", A: "A", B: "B", D: 63, d, L: 0.2, m: 200, F: (nn, c) => (c.x > 0.15 ? Fw : 2000), c: 3000, Ff: 200 }));
    n.pre = (nn) => {
      const on = pos() > 0.5;
      if (!on) { nn.ctx.regen = false; nn.ctx.latched = false; return; }
      if (mode === "off") nn.ctx.regen = false;
      else if (mode === "always") nn.ctx.regen = true;
      else { if (!nn.ctx.latched) nn.ctx.regen = true; if (nn.p("A") > nn.ctx.psw) { nn.ctx.regen = false; nn.ctx.latched = true; } }
    };
    return n;
  },
  script: () => [[0, { s: 0 }], [0.3, { s: 1 }], [3.8, { s: -1 }], [6, { s: 0 }]],
  charts: [
    { t: "Position", u: "mm", s: [["x", (n) => n.a.cyl.x * 1000]] },
    { t: "Pressures", u: "MPa", s: [["cap side p_A", (n) => n.p("A") / 1e6], ["rod side p_B", (n) => n.p("B") / 1e6]] },
  ],
  rd(n) {
    const c = n.a.cyl;
    return [...cylRd(c), ...pRd(n, [["Pump p_P", "P"], ["Cap side p_A", "A"], ["Rod side p_B", "B"]]), ["Regeneration (valve 1V2)", n.ctx.regen ? "ON – B oil into A" : "off – B → T"],
      ["Cylinder force", f((n.p("A") * c.A1 - n.p("B") * c.A2) / 1000, 1) + " kN"], ["Load now", f(c.Fload / 1000, 1) + " kN"], ["Relief flow", f(n.q("relief") * 6e4, 1) + " L/min", n.q("relief") > 1e-5 && c.v === 0 && c.x < c.L - 0.001 ? "hc-bad" : ""]];
  },
  draw(n, P, W, A) {
    const L = mkL(n, A), c = n.a.cyl, s = sOf(n);
    let o = hpu(n, A);
    o += L([[90, 415], [321, 415], [321, 403]], "P", n.q("PA") + n.q("PB") + n.q("cPT")) + L([[339, 403], [339, 420]], 0, n.q("AT") + n.q("BT") + n.q("cPT")) + hsTank(339, 420);
    o += hsDcv(330, 380, { s, centre: "tandem", tag: "1V1" });
    const qa = n.q("PA") - n.q("AT") + n.q("reg");
    o += L([[321, 357], [321, 300], [258, 300], [258, 220]], "A", n.q("PA") - n.q("AT")) + L([[258, 280], [360, 280]], "A", -n.q("reg"));
    o += L([[339, 357], [339, 330], [520, 330], [520, 290], [412, 290], [412, 220]], "B", -(n.q("PB") - n.q("BT")) + 0) + L([[520, 290], [520, 280], [470, 280]], "B", n.q("reg"));
    o += hsDot(258, 280) + hsDot(520, 290);
    // regen valve 1V2 (2/2 solenoid + check) between B and A
    o += `<g class="hs-sym hs-click" data-hcinfo="dcv"><rect x="400" y="266" width="44" height="28" class="hs-s hs-bg ${n.ctx.regen ? "hs-regbox" : ""}"/>${n.ctx.regen ? `<path d="M440,280 H404" class="hs-s"/>` : `<path d="M440,280 h-8 M432,274 v12 M404,280 h8 M412,274 v12" class="hs-s"/>`}<rect x="444" y="271" width="14" height="18" class="hs-s ${n.ctx.regen ? "hs-solon" : "hs-bg"}"/><path d="M444,289 L458,271" class="hs-s"/></g>`;
    o += L([[458, 280], [470, 280]], "B", n.q("reg")) + hsTag(422, 304, "1V2 regen (Y3)", "middle") + hsCheck(372, 280, "left", { open: n.q("reg") > 1e-6 }) + L([[384, 280], [400, 280]], "A", -n.q("reg"));
    const cy = hsCyl(250, 180, { len: 170, frac: c.x / c.L, pA: n.p("A"), pB: n.p("B"), pm: PM, tag: `1A1 Ø63/${P.rod}` });
    o += cy.svg + hsLoad(cy.tip, { label: c.x > 0.15 ? `${P.Fw} kN` : "2 kN", w: 60 });
    o += hsGauge(230, 150, n.p("A"), { label: "p_A", ta: "end" }) + hsGauge(440, 150, n.p("B"), { label: "p_B" });
    if (n.ctx.mode === "auto") o += hsPS(200, 300, { tag: "1S1", on: n.ctx.latched, set: "8 MPa" }) + L([[200, 312], [200, 320], [258, 320], [258, 300]], "A", 0) + hsElec([[222, 300], [240, 300], [240, 250], [460, 250], [460, 271]]);
    o += hsTxt(600, 120, n.ctx.regen ? "REGENERATION: v = Q/A_rod" : "normal: v = Q/A1", "middle", "hs-big");
    o += hsTxt(600, 145, `v = ${f(c.v * 1000, 0)} mm/s`, "middle", "hs-big");
    if (c.v === 0 && s > 0.5 && c.x < c.L - 0.001 && n.q("relief") > 1e-5) o += hsTxt(600, 175, "STALLED – force too small, oil over relief", "middle", "hs-warnbig");
    o += legendNote("Regeneration: rod-side oil joins the pump flow → only the rod area works: fast, but force = p·A_rod.");
    return o;
  },
  txt: {
    what: "During extension the oil from the rod side is not sent to the tank but back into the cap side (valve 1V2 + check). The pump only has to fill the 'rod volume'.",
    why: "Fast approach with a small pump: speed v = Q / A_rod instead of Q / A1. Typical for presses, fixtures and lifting tables with a long free stroke and a short work stroke.",
    how: "Both chambers have the same pressure; the net area is A1 − A2 = A_rod. Speed v = Q/A_rod, force F = p·A_rod. When the load pressure reaches the switch point (pressure switch 1S1 or a sequence valve), 1V2 switches the rod side to the tank → normal circuit, full force p·A1.",
    check: "Valve 1V1 port and line A must carry the summed flow Q_P + Q_rod (Q·A1/A_rod). With φ = A1/A2 = 2 the regenerative extension speed equals the retraction speed. Switch point below the relief, with hysteresis.",
    mistake: "Regeneration stays on during the work stroke → force only p·A_rod (here about a third) → the cylinder stalls, oil goes over the relief → heat. Line A and 1V1 sized for pump flow only → high Δp at regeneration.",
  },
  fx(P) {
    const d = +P.rod, A1 = A63, Ar = areaD(d), A2 = A1 - Ar, Q = 18.7 * LPM;
    return `<pre class="hc-pre">Areas   A1 = ${f(A1 * 1e4, 2)} cm²   A_rod = ${f(Ar * 1e4, 2)} cm²   A2 = A1 − A_rod = ${f(A2 * 1e4, 2)} cm²   (φ = A1/A2 = ${f(A1 / A2, 2)})
Regenerative  v = Q / A_rod = 18.7 L/min / ${f(Ar * 1e4, 2)} cm² = <b>${f(Q / Ar, 3)} m/s</b>     F = p·A_rod = 10 MPa · ${f(Ar * 1e4, 2)} cm² = <b>${f(10e6 * Ar / 1000, 1)} kN</b>
Normal        v = Q / A1    = 18.7 / ${f(A1 * 1e4, 2)} = ${f(Q / A1, 3)} m/s                 F = p·A1 = <b>${f(10e6 * A1 / 1000, 1)} kN</b>
Retract       v = Q / A2    = ${f(Q / A2, 3)} m/s     (φ = 2 → regenerative out = retract speed)
Flow into A during regeneration Q_A = v·A1 = ${f(Q / Ar * A1 * 6e4, 1)} L/min (= Q_P + Q_B = 18.7 + ${f(Q / Ar * A2 * 6e4, 1)}) → size 1V1 port A and the line for it
Work force ${P.Fw} kN needs  regen: p = F/A_rod = ${f(+P.Fw * 1000 / Ar / 1e6, 1)} MPa ${+P.Fw * 1000 / Ar > 10e6 ? "> 10 MPa → STALL" : "OK"}   normal: p = F/A1 = ${f(+P.Fw * 1000 / A1 / 1e6, 2)} MPa
Switch point 1S1 = 8 MPa (≈ 80 % of relief) → regen force at switch-off ${f(8e6 * Ar / 1000, 1)} kN; approach load 2 kN needs only ${f(2000 / Ar / 1e6, 2)} MPa ✓</pre>`;
  },
  set() { return [["1S1 pressure switch", "8 MPa rising (hysteresis ≈ 1 MPa)", "switch regeneration off before the relief (10 MPa)"], ["1V2 regen valve", "NG6/NG10 + check B → A", "sized for Q_B"], ["0V1 relief", "10 MPa", "system"], ["Line A / 1V1", "for Q_P·A1/A_rod", "summed flow"]]; },
  fail: [["Cylinder stalls before the end", "regeneration not switched off", "pressure switch / sequence valve, check setting"], ["Slow approach", "regen valve not switched / check valve stuck", "check solenoid Y3, check valve"], ["Jerk at switch-over", "switch point too high, sudden change of area", "lower switch point, ramp (proportional valve)"], ["Cylinder extends at stop", "pressure in both chambers + leakage in the regen valve (differential creep)", "vent B at stop, leak-free seat valve"]],
  twin: "Not used in the twin machines (they move with servo motors). Typical use: hydraulic press brakes, injection moulding clamps, scissor lift tables, fixture cylinders with long approach.",
  test(P) {
    const out = [], Ar = areaD(+P.rod);
    const r = (w, mode) => runScript(REGEN, Object.assign({}, P, { mode }), w, (n) => ({ x: n.a.cyl.x, v: n.a.cyl.v, pA: n.p("A") }), 0.01);
    const a = r({}, "auto"), b = r({}, "off"), c = r({ always: true }, "auto");
    out.push(`regen: approach v sim=${f(at(a.out, 0.55).v, 3)} hand Q/A_rod=${f(18.7 * LPM / Ar, 3)} m/s | normal v sim=${f(at(b.out, 1.0).v, 3)} hand=${f(18.7 * LPM / A63, 3)}`);
    const tEnd = (rr) => (rr.out.find((s) => s.x > 0.199) || { t: NaN }).t;
    out.push(`regen: full stroke t auto=${f(tEnd(a), 2)}s off=${f(tEnd(b), 2)}s always=${f(tEnd(c), 2)}s (stalls at x=${f(at(c.out, 3.5).x * 1000, 0)}mm, force max ${f(10e6 * Ar / 1000, 1)}kN < ${P.Fw}kN)`);
    return out;
  },
};

export const CIRCUITS_A = [LOCK, CBV, METER, SEQ, REGEN];
export { orifice };
