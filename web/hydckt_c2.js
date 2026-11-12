/* Hydraulics tab – item 2 "Standard circuits": circuits 6–9
 * (6 accumulator clamping + pump unloading · 7 hydraulic motor + brake valve + spring brake · 8 supply: closed / tandem centre,
 *  variable pump, load sensing – energy · 9 synchronising two cylinders + pressure intensifier). All values are EXAMPLES. */
import { Net, orif, lam, src, cyl, motor, accu, divider, dcv, leakG, ramp, areaD, LPM, MPA, G0 } from "./hydckt_sim.js";
import { hsLine, hsPilot, hsDot, hsTag, hsTxt, hsTank, hsRelief, hsCheck, hsCBV, hsGauge, hsDcv, hsCyl, hsLoad, hsPS, hsAcc, hsMotor, hsBrake, hsShuttle, hsDivider, hsElec, hsArrow } from "./hydckt_sym.js";
import { f, PM, A63, A63r, mkL, hpu, legendNote, qA, qB, qP, qT, runScript, at } from "./hydckt_c1.js";

const sOf = (n, k = "s") => n.u[k] || 0;
const pRd = (n, list) => list.map(([l, k]) => [l, f(n.p(k) / 1e6, 2) + " MPa", n.N[k].cav ? "hc-bad" : ""]);

/* ======================================================================= 6  ACCUMULATOR CLAMPING + UNLOADING */
const ACC = {
  id: "acc", n: 6, title: "Accumulator clamping with pump unloading", sub: "small pump charges a bladder accumulator, pressure switch unloads the pump, the clamp holds",
  P: [
    { k: "V0", l: "Accumulator size V0", v: 1, opts: [[0.32, "0.32 L"], [0.5, "0.5 L"], [0.75, "0.75 L"], [1, "1 L"], [1.5, "1.5 L"], [2.5, "2.5 L"], [4, "4 L"]] },
    { k: "p0", l: "Pre-charge p0 (N₂, gauge)", u: "MPa", v: 4.9, min: 2, max: 6.5, st: 0.1 },
    { k: "leak", l: "Leakage of the clamp circuit (valves, rotary union)", u: "cm³/min @ 6 MPa", v: 150, min: 10, max: 600, st: 10 },
    { k: "n", l: "Gas law", v: 1, opts: [[1, "isothermal n = 1 (slow, leakage)"], [1.4, "adiabatic n = 1.4 (fast)"]] },
    { k: "idx", l: "Index the table every 20 s", v: 1, opts: [[1, "yes (unclamp 2 s)"], [0, "no – hold only"]] },
  ],
  W: [{ k: "noCheck", l: "without the check valve 1V2 (pump side)" }, { k: "noAcc", l: "without the accumulator" }],
  V: [{ k: "s", l: "Clamp valve 2V1", opts: [[0, "clamp (no current)"], [1, "Y1 unclamp (index table)"]] }],
  dur: 60, speed: 10, dt: 4e-5,
  pon: 5.5, poff: 7,
  make(P, W) {
    const n = new Net({ dt: ACC.dt }), pon = ACC.pon * MPA, poff = ACC.poff * MPA;
    n.node("P", 0.1).node("S", 0.15).node("CA", 0.05).node("CB", 0.05);
    n.add(src("P", () => 4 * LPM, { name: "pump" }));
    n.add(orif("P", "T", (nn) => 40e-6 * ramp(nn.p("P"), 8 * MPA, 8.6 * MPA), { name: "relief" }));
    n.ctx = { unload: false, tOut: null, hold: null, cycles: [], E: 0, t0: 0 };
    n.add(orif("P", "T", (nn) => (nn.ctx.unload ? 20e-6 : 0), { name: "unl", tau: 0.03 }));
    if (W.noCheck) n.add(orif("P", "S", () => 30e-6, { name: "chk" }));
    else n.add(orif("P", "S", (nn) => 20e-6 * ramp(nn.p("P") - nn.p("S"), 0.05e6, 0.3e6), { name: "chk", tau: 0.003 }));
    if (!W.noAcc) n.act(accu({ name: "acc", node: "S", V0: +P.V0, p0: +P.p0, n: +P.n, A: 30e-6 }));
    n.add(lam("S", "T", leakG(+P.leak, 6), { name: "leak" }));
    const s = () => n.u.s || 0, Av = 10e-6;
    n.add(orif("S", "CA", () => Av * (1 - s()), { name: "SA", tau: 0.03 })); n.add(orif("CB", "T", () => Av * (1 - s()), { name: "BT", tau: 0.03 }));
    n.add(orif("S", "CB", () => Av * s(), { name: "SB", tau: 0.03 })); n.add(orif("CA", "T", () => Av * s(), { name: "AT", tau: 0.03 }));
    n.act(cyl({ name: "clamp", A: "CA", B: "CB", D: 100, d: 70, L: 0.003, m: 20, c: 60000, Ff: 300 }));
    n.pre = (nn, dt) => {
      const p = nn.p("S");
      if (!nn.ctx.unload && p >= poff) { nn.ctx.unload = true; nn.ctx.tOut = nn.t; nn.ctx.cycles.push(nn.t); }
      else if (nn.ctx.unload && p <= pon) { nn.ctx.unload = false; if (nn.ctx.tOut !== null) nn.ctx.hold = nn.t - nn.ctx.tOut; }
      nn.ctx.E += nn.p("P") * 4 * LPM * dt;
      nn.ctx.cycles = nn.ctx.cycles.filter((t) => nn.t - t < 60);
    };
    return n;
  },
  script: (P) => (+P.idx ? [[0, { s: 0 }], [14, { s: 1 }], [16, { s: 0 }], [34, { s: 1 }], [36, { s: 0 }], [54, { s: 1 }], [56, { s: 0 }]] : [[0, { s: 0 }]]),
  charts: [
    { t: "Pressures", u: "MPa", s: [["accumulator / system", (n) => n.p("S") / 1e6], ["clamp", (n) => n.p("CA") / 1e6], ["pump", (n) => n.p("P") / 1e6]] },
    { t: "Pump power p·Q", u: "kW", s: [["hydraulic power", (n) => n.p("P") * 4 * LPM / 1000]] },
  ],
  rd(n, P) {
    const a = n.a.acc, c = n.a.clamp, Fc = Math.max(0, (n.p("CA") * c.A1 - n.p("CB") * c.A2) / 1000);
    return [...pRd(n, [["Pump p_P", "P"], ["Accumulator p", "S"], ["Clamp p", "CA"]]), ["Oil in the accumulator", a ? f(a.Vo * 1000, 3) + " L" : "–"],
      ["Pump", n.ctx.unload ? "UNLOADED (P → T, ≈ 0 kW)" : "charging"], ["Last hold time (cut-out → cut-in)", n.ctx.hold === null ? "–" : f(n.ctx.hold, 1) + " s", n.ctx.hold !== null && n.ctx.hold < 5 ? "hc-bad" : ""],
      ["Pump switchings in the last minute", String(n.ctx.cycles.length), n.ctx.cycles.length > 6 ? "hc-bad" : ""], ["Clamp force", f(Fc, 1) + " kN", n.p("CA") < 5e6 && (n.u.s || 0) === 0 ? "hc-bad" : "hc-ok"],
      ["Average pump power", f(n.t > 0 ? n.ctx.E / n.t / 1000 : 0, 3) + " kW"], ["Simulation speed", "× " + (ACC.speed)]];
  },
  draw(n, P, W, A) {
    const L = mkL(n, A), a = n.a.acc, c = n.a.clamp, s = sOf(n);
    let o = hpu(n, A, { rset: "8 MPa" });
    // unloading valve 1V1 (2/2 solenoid) from P to T at x=210
    o += L([[90, 415], [210, 415], [210, 404]], "P", n.q("unl")) + L([[210, 372], [210, 360], [244, 360], [244, 372]].slice(0, 1), "P", 0);
    o += `<g class="hs-sym hs-click" data-hcinfo="unload"><rect x="196" y="372" width="28" height="32" class="hs-s hs-bg"/>${n.ctx.unload ? `<path d="M210,402 V376" class="hs-s"/>` : `<path d="M210,402 v-8 M204,394 h12" class="hs-s"/>`}<rect x="224" y="379" width="14" height="18" class="hs-s ${n.ctx.unload ? "hs-solon" : "hs-bg"}"/><path d="M224,397 L238,379" class="hs-s"/></g>`;
    o += L([[210, 372], [210, 362]], 0, n.q("unl")) + hsTank(210, 362) + hsTag(178, 388, "1V1", "end") + hsTxt(244, 392, "Y0 unload", "start", "hs-tag");
    // check 1V2 + system line
    o += L([[210, 415], [300, 415], [300, 402]], "P", n.q("chk")) + hsDot(210, 415);
    o += W.noCheck ? L([[300, 402], [300, 378]], "S", n.q("chk")) : hsCheck(300, 390, "up", { tag: "1V2", open: n.q("chk") > 1e-6 });
    o += L([[300, 378], [300, 330], [640, 330]], "S", n.q("chk"));
    // accumulator 1Z1 + pressure switch 1S1
    if (!W.noAcc) o += L([[380, 330], [380, 318]], "S", a ? a.q : 0) + hsAcc(380, 290, { tag: "1Z1", fill: a ? a.Vo / a.V0 / 0.6 : 0, set: `${P.V0} L · p0 ${P.p0} MPa` }) + hsDot(380, 330);
    o += hsPS(300, 270, { tag: "1S1", on: n.ctx.unload, set: `${ACC.poff} / ${ACC.pon} MPa` }).replace(/data-hcinfo="ps"/, 'data-hcinfo="ps"') + L([[300, 282], [300, 330]], "S", 0) + hsDot(300, 330);
    o += hsElec([[278, 270], [250, 270], [250, 388], [238, 388]]);
    o += hsGauge(440, 360, n.p("S"), { label: "p_S" });
    // leakage symbol
    o += L([[640, 330], [640, 345]], "S", n.q("leak")) + `<path d="M636,345 h8 l-4,8 z" class="hs-s"/>` + hsTxt(620, 368, `leak ${P.leak} cm³/min`, "middle", "hs-tag");
    // clamp valve 2V1 (4/2) at (560, 300): A (551,277) B (569,277) P (551,323) T (569,323)
    o += L([[551, 330], [551, 323]], "S", n.q("SA") + n.q("SB")) + hsDot(551, 330) + L([[569, 323], [569, 336]], 0, n.q("AT") + n.q("BT")) + hsTank(569, 336);
    o += hsDcv(560, 300, { s, centre: "none", tag: "2V1", keyA: "sol:1", solA: "Y1" });
    o += L([[551, 277], [551, 240], [478, 240], [478, 206]], "CA", n.q("SA") - n.q("AT")) + L([[569, 277], [569, 250], [572, 250], [572, 206]], "CB", n.q("SB") - n.q("BT"));
    const cy = hsCyl(470, 166, { len: 110, frac: c.x / c.L, pA: n.p("CA"), pB: n.p("CB"), pm: PM, tag: "2A1 table clamp (ring piston Ø100/70, 3 mm)" });
    o += cy.svg + `<rect x="${cy.tip[0]}" y="160" width="16" height="46" class="hs-load"/>` + hsTxt(cy.tip[0] + 22, 186, "table", "start", "hs-tag");
    o += hsGauge(450, 140, n.p("CA"), { label: "clamp", ta: "end" });
    o += hsTxt(640, 420, n.ctx.unload ? "pump unloaded" : "charging", "middle", n.ctx.unload ? "hs-ok" : "hs-big");
    if (n.p("CA") < 5e6 && s === 0 && n.t > 6) o += hsTxt(600, 120, "CLAMP PRESSURE < 5 MPa", "middle", "hs-warnbig");
    o += legendNote(`Cut-out at ${ACC.poff} MPa (pump → tank), cut-in at ${ACC.pon} MPa. The check valve keeps the accumulator pressure. Time runs × ${ACC.speed}.`);
    return o;
  },
  txt: {
    what: "A small fixed pump charges a bladder accumulator. A pressure switch (or a hydraulic unloading valve) sends the pump flow to the tank when the accumulator is full; a check valve keeps the pressure. The clamp is held by the accumulator for minutes.",
    why: "A clamp needs pressure all the time but almost no flow. A pump running against the relief valve turns all its power into heat (here 8 MPa · 4 L/min = 0.53 kW, all day). With unloading the pump works only a few % of the time.",
    how: "Charge to the cut-out pressure p_off → unload (pump at ≈ 0.3 MPa). Leakage slowly lowers the pressure; at the cut-in pressure p_on the pump charges again. Oil between p_on and p_off: ΔV = V0·[(p0/p_on)^(1/n) − (p0/p_off)^(1/n)] (absolute pressures). Hold time t = ΔV / Q_leak.",
    check: "p0 ≈ 0.9 × p_on (absolute) for the best usable volume; p_on above the minimum clamp pressure (+0.5 MPa). Safety and shut-off block: relief, manual and automatic discharge at switch-off (EN ISO 4413), PED marking. Pre-charge check once a year with the charging kit.",
    mistake: "Missing check valve → the accumulator empties through the unloading valve. Pre-charge too high (> p_on) → the accumulator gives no oil at cut-in. Gauge pressure in the gas law → volume wrong by 2–10 %. No pressure switch hysteresis → the motor switches every few seconds (contactor and motor wear).",
  },
  fx(P) {
    const p0 = +P.p0 + 0.1, pon = ACC.pon + 0.1, poff = ACC.poff + 0.1, V0 = +P.V0, nn = +P.n;
    const dv = (k) => V0 * (Math.pow(p0 / pon, 1 / k) - Math.pow(p0 / poff, 1 / k)), d1 = dv(1), d14 = dv(1.4);
    const ql = +P.leak * (6.3 / 6) / 1000, tHold = dv(nn) / ql * 60, tCh = dv(nn) / (4 - ql);
    const Pon = 7.05 * 10 * 4 / 600, duty = tCh / (tCh + tHold);
    return `<pre class="hc-pre">Absolute pressures   p0 = ${P.p0} + 0.1 = ${f(p0, 2)} MPa   p_on = ${f(pon, 2)}   p_off = ${f(poff, 2)} MPa abs
Pre-charge rule      p0 ≈ 0.9 · p_on,abs = ${f(0.9 * pon, 2)} MPa abs = ${f(0.9 * pon - 0.1, 2)} MPa gauge  (set: ${P.p0})
Usable oil           ΔV = V0·[(p0/p_on)^(1/n) − (p0/p_off)^(1/n)]
   isothermal n=1    ΔV = ${V0}·(${f(p0 / pon, 3)} − ${f(p0 / poff, 3)}) = <b>${f(d1, 3)} L</b>
   adiabatic n=1.4   ΔV = ${V0}·(${f(Math.pow(p0 / pon, 1 / 1.4), 3)} − ${f(Math.pow(p0 / poff, 1 / 1.4), 3)}) = ${f(d14, 3)} L
Leakage at ≈ 6.3 MPa Q_L = ${P.leak}·6.3/6 = ${f(ql * 1000, 0)} cm³/min (laminar: ∝ p)
Hold time            t = ΔV / Q_L = ${f(dv(nn), 3)} L / ${f(ql, 3)} L/min = <b>${f(tHold, 0)} s</b> (+ oil for each index ≈ 36 cm³ → shorter)
Charge time          t = ΔV / (Q_P − Q_L) = ${f(dv(nn), 3)} / (4 − ${f(ql, 3)}) = ${f(tCh * 60, 1)} s
Duty                 ${f(tCh * 60, 1)} / (${f(tCh * 60, 1)} + ${f(tHold, 0)}) = ${f(duty * 100, 1)} % → average ≈ ${f(Pon * duty + 0.3 * 10 * 4 / 600 * (1 - duty), 3)} kW hydraulic
Without unloading    P = 8 MPa (relief) · 4 L/min = 80·4/600 = <b>${f(80 * 4 / 600, 2)} kW</b> heat all the time
Clamp force          F = p·A1 = 5 MPa · ${f(areaD(100) * 1e4, 1)} cm² = ${f(5e6 * areaD(100) / 1000, 1)} kN at the minimum pressure</pre>`;
  },
  set(P) {
    return [["1S1 pressure switch", `cut-out ${ACC.poff} MPa / cut-in ${ACC.pon} MPa`, "p_on ≥ min clamp pressure + 0.5 MPa; hysteresis ≥ 10 %"], ["1Z1 accumulator", `${P.V0} L bladder, p0 = ${P.p0} MPa N₂`, "p0 ≈ 0.9·p_on (abs)"],
      ["0V1 relief", "8 MPa", "> p_off, protects pump if the switch fails"], ["Accumulator safety block", "relief 8.5 MPa, manual + solenoid discharge", "EN ISO 4413, PED"], ["Clamp", "5 MPa min", "HMC table clamp (docs/12)"]];
  },
  fail: [["Pump switches very often", "pre-charge lost (bladder) / leakage high / hysteresis small", "check p0 with the charging kit, find the leak (rotary union)"],
    ["Pressure falls at once when the pump unloads", "check valve missing / leaking", "fit / clean the check valve"],
    ["Clamp opens after power off", "accumulator discharge valve opened (correct for safety!)", "spring clamp or mechanical self-locking if clamping must stay"],
    ["Accumulator gives no oil", "p0 above p_on, bladder burst (oil on the gas side)", "set p0 = 0.9 p_on, replace bladder"],
    ["Oil hot although unloading", "unloading valve does not open (coil, wiring)", "check Y0, measure pump pressure in unload"]],
  twin: "In the twin: the HMC rotary table clamp (5 MPa, docs/12) and the APC pallet clamp / zero-point release use this principle: small pump + accumulator in the HPU, pressure switch to the PLC ('clamped' signal and pump control).",
  test(P, W) {
    const out = [];
    const r = (w) => runScript(ACC, P, w || {}, (n) => ({ p: n.p("S"), hold: n.ctx.hold, cyc: n.ctx.cycles.length, E: n.ctx.E, t: n.t }), 0.1);
    const a = r({}), p0 = +P.p0 + 0.1, dv = +P.V0 * (p0 / 5.6 - p0 / 7.1), ql = +P.leak * 6.3 / 6 / 1000;
    const last = a.out[a.out.length - 1];
    out.push(`acc: ΔV iso hand=${f(dv, 3)}L hold hand≈${f(dv / ql * 60, 0)}s (no index) sim last hold=${f(last.hold, 1)}s (with index oil) switchings/min=${last.cyc} avg P=${f(last.E / last.t / 1000, 3)}kW vs relief-only ${f(80 * 4 / 600, 3)}kW`);
    const d0 = ACC.dur; ACC.dur = 180; const h = runScript(ACC, Object.assign({}, P, { idx: 0 }), {}, (n) => ({ hold: n.ctx.hold }), 1); ACC.dur = d0;
    out.push(`acc: hold only (no index): sim hold=${f(h.out[h.out.length - 1].hold, 1)}s hand ΔV/Q_L=${f(dv / ql * 60, 1)}s`);
    const b = r({ noCheck: true }), c = r({ noAcc: true });
    out.push(`acc: no check: switchings/min=${b.out[b.out.length - 1].cyc} min p after 10s=${f(Math.min(...b.out.filter((s) => s.t > 10).map((s) => s.p)) / 1e6, 2)}MPa | no accumulator: switchings/min=${c.out[c.out.length - 1].cyc} hold=${f(c.out[c.out.length - 1].hold, 2)}s`);
    return out;
  },
};

/* ======================================================================= 7  HYDRAULIC MOTOR + BRAKE VALVE + SPRING BRAKE */
const MOTOR = {
  id: "motor", n: 7, title: "Hydraulic motor drive – brake valve, anti-cavitation checks, spring brake", sub: "winch / conveyor: overrunning load, stop, holding",
  P: [
    { k: "V", l: "Motor displacement V", v: 160, opts: [[80, "80 cm³/rev"], [100, "100 cm³/rev"], [160, "160 cm³/rev"], [200, "200 cm³/rev"], [250, "250 cm³/rev"], [315, "315 cm³/rev"]] },
    { k: "TL", l: "Load torque (− = overrunning in forward, e.g. lowering)", u: "N·m", v: -100, min: -180, max: 200, st: 10 },
    { k: "k", l: "Brake valve pilot ratio", v: 3, opts: [[3, "3 : 1"], [5, "5 : 1"], [8, "8 : 1"]] },
  ],
  W: [{ k: "noCBV", l: "without the brake valve 1V2" }, { k: "noAC", l: "without the anti-cavitation checks 1V5/1V6" }, { k: "closed", l: "closed-centre valve 1V1 instead of the open (H) centre" }],
  V: [{ k: "s", l: "Valve 1V1", opts: [[1, "Y1 ↻ forward (lower)"], [0, "0 stop"], [-1, "Y2 ↺ reverse (hoist)"]] }],
  dur: 12, etaV: 0.95, etaHm: 0.9, J: 1.5, Tb: 600,
  prel: 1.2e6, papp: 0.8e6,
  // stop time at the cross-port relief (12 MPa): T_L > 0 (resistive) helps to stop, T_L < 0 (overrunning) works against the braking
  Tbr: (P) => 12e6 * +P.V * 1e-6 / (2 * Math.PI),
  tStop: (P) => { const n0 = 18.7 * 1000 * MOTOR.etaV / +P.V, Tnet = MOTOR.Tbr(P) + +P.TL; return Tnet > 0 ? MOTOR.J * n0 * 2 * Math.PI / 60 / Tnet : Infinity; },
  pL: (P) => Math.abs(Math.min(0, +P.TL)) * 2 * Math.PI / (+P.V * 1e-6),
  // brake valve setting: ≥ 1.3 × load pressure AND high enough that the pilot (inlet) pressure while lowering stays above the brake release
  pset: (P) => Math.min(9.5e6, Math.max(3e6, 1.3 * MOTOR.pL(P), MOTOR.pL(P) + +P.k * (MOTOR.prel + 0.5e6))),
  make(P, W) {
    const n = new Net({ dt: 2e-5 }), V = +P.V, k = +P.k, ps = MOTOR.pset(P), Qp = 18.7 * LPM;
    n.node("P", 0.3).node("VA", 0.2).node("VB", 0.2).node("MA", 0.15).node("MB", 0.15).node("BR", 0.03);
    n.add(src("P", () => Qp, { name: "pump" })); n.add(orif("P", "T", (nn) => 40e-6 * ramp(nn.p("P"), 10 * MPA, 10.6 * MPA), { name: "relief" }));
    dcv(n, { P: "P", A: "VA", B: "VB", Av: 25e-6, centre: W.closed ? "closed" : "open", leak: leakG(20) });
    n.ctx = { ps, centre: W.closed ? "closed" : "open", nmax: 0, pmax: 0, pmin: 0 };
    n.add(orif("VA", "MA", () => 60e-6, { name: "lineA" }));
    if (W.noCBV) n.add(orif("MB", "VB", () => 60e-6, { name: "bv" }));
    else { n.add(orif("MB", "VB", (nn) => 25e-6 * ramp(nn.p("MB") + k * nn.p("VA") - ps, 0, 3e6), { name: "bv", tau: 0.003 })); n.add(orif("VB", "MB", (nn) => 30e-6 * ramp(nn.p("VB") - nn.p("MB"), 0.05e6, 0.3e6), { name: "bvChk", tau: 0.003 })); }
    { n.add(orif("MA", "MB", (nn) => 20e-6 * ramp(nn.p("MA") - nn.p("MB"), 12e6, 13e6), { name: "rAB" })); n.add(orif("MB", "MA", (nn) => 20e-6 * ramp(nn.p("MB") - nn.p("MA"), 12e6, 13e6), { name: "rBA" })); }
    if (!W.noAC) { n.add(orif("T", "MA", (nn) => 20e-6 * ramp(-nn.p("MA"), 0.02e6, 0.08e6), { name: "acA" })); n.add(orif("T", "MB", (nn) => 20e-6 * ramp(-nn.p("MB"), 0.02e6, 0.08e6), { name: "acB" })); }
    n.add(orif("VA", "BR", (nn) => (nn.p("VA") >= nn.p("VB") ? 0.5e-6 : 0), { name: "shA" })); n.add(orif("VB", "BR", (nn) => (nn.p("VB") > nn.p("VA") ? 0.5e-6 : 0), { name: "shB" }));
    const G = (1 - MOTOR.etaV) * Qp / 10e6, TL = +P.TL;
    n.ctx.brk = true;
    n.act(motor({ name: "mot", A: "MA", B: "MB", V, J: MOTOR.J, etaHm: MOTOR.etaHm, Gleak: G, TL: () => TL, Tb: MOTOR.Tb, brake: (nn) => nn.ctx.brk, T0: 4, cv: 1, cd: 20, cdT: 0.1 }));
    n.pre = (nn) => {
      const pb = nn.p("BR"); if (nn.ctx.brk && pb > MOTOR.prel) nn.ctx.brk = false; else if (!nn.ctx.brk && pb < MOTOR.papp) nn.ctx.brk = true;
      const rpm = nn.a.mot.w * 60 / (2 * Math.PI); if (Math.abs(rpm) > Math.abs(nn.ctx.nmax)) nn.ctx.nmax = rpm;
      const pm = Math.max(nn.p("MA"), nn.p("MB")), pn = Math.min(nn.p("MA"), nn.p("MB")); if (pm > nn.ctx.pmax) nn.ctx.pmax = pm; if (pn < nn.ctx.pmin) nn.ctx.pmin = pn;
    };
    return n;
  },
  script: () => [[0, { s: 0 }], [0.5, { s: 1 }], [4, { s: 0 }], [6.5, { s: -1 }], [10, { s: 0 }]],
  charts: [
    { t: "Motor speed (+ = forward)", u: "rpm", s: [["n", (n) => n.a.mot.w * 60 / (2 * Math.PI)]] },
    { t: "Pressures", u: "MPa", s: [["motor port A", (n) => n.p("MA") / 1e6], ["motor port B", (n) => n.p("MB") / 1e6], ["brake release", (n) => n.p("BR") / 1e6]] },
  ],
  rd(n, P) {
    const m = n.a.mot, rpm = m.w * 60 / (2 * Math.PI);
    return [["Motor speed n", f(rpm, 1) + " rpm"], ["Hydraulic torque Δp·V/2π", f(m.Th, 0) + " N·m"], ["Load torque", P.TL + " N·m"], ...pRd(n, [["Pump p_P", "P"], ["Motor port A", "MA"], ["Motor port B", "MB"], ["Brake release", "BR"]]),
      ["Brake", m.braked ? "APPLIED (springs)" : "released"], ["Brake valve setting", f(n.ctx.ps / 1e6, 2) + " MPa"], ["Highest speed so far", f(n.ctx.nmax, 0) + " rpm", Math.abs(n.ctx.nmax) > 125 ? "hc-bad" : ""],
      ["Peak / lowest port pressure", `${f(n.ctx.pmax / 1e6, 1)} / ${f(n.ctx.pmin / 1e6, 2)} MPa`, n.ctx.pmax > 14e6 || n.ctx.pmin < -0.05e6 ? "hc-bad" : ""]];
  },
  draw(n, P, W, A) {
    const L = mkL(n, A), m = n.a.mot, s = sOf(n);
    let o = hpu(n, A);
    o += L([[90, 415], [321, 415], [321, 403]], "P", qP(n)) + L([[339, 403], [339, 420]], 0, qT(n)) + hsTank(339, 420);
    o += hsDcv(330, 380, { s, centre: n.ctx.centre, tag: "1V1" });
    // A line to motor bottom (300,186)
    o += L([[321, 357], [321, 300], [300, 300], [300, 196]], "MA", n.q("lineA"));
    // B line via brake valve 1V2 at (520,262)
    const qb = (n.q("bvChk") || 0) - n.q("bv");
    o += L([[339, 357], [339, 335], [520, 335], [520, 290]], "VB", qb);
    o += W.noCBV ? L([[520, 290], [520, 234]], "MB", qb) : hsCBV(520, 262, { tag: "1V2 brake valve", open: n.e.bv.A > 1e-6, chk: (n.q("bvChk") || 0) > 1e-6, set: `${f(n.ctx.ps / 1e6, 1)} MPa`, px: 600, py: 300 }) + hsPilot([[321, 310], [600, 310], [600, 300]]) + hsDot(321, 310);
    o += L([[520, 234], [520, 110], [300, 110], [300, 144]], "MB", qb);
    // cross-port reliefs (x=210/220) between MA (y=250) and MB (y=110), anti-cavitation checks (x=160) from tank
    {
      o += L([[300, 250], [220, 250], [220, 196]], "MA", n.q("rAB")) + L([[220, 164], [220, 130], [300, 130]].slice(0, 2), "MB", n.q("rAB"));
      o += hsRelief(220, 180, { tag: "1V3", open: n.q("rAB") > 1e-6 ? 1 : 0, set: "12 MPa", adj: false }).replace(/M220,162 V162/, "");
      o += L([[300, 230], [175, 230], [175, 164]], "MA", -n.q("rBA")) + L([[175, 196], [175, 175]], "MB", 0);
      o += `<g transform="rotate(180 175 180)">${hsRelief(175, 180, { open: n.q("rBA") > 1e-6 ? 1 : 0, adj: false })}</g>` + hsTag(170, 160, "1V4", "end");
      o += L([[175, 196], [175, 175]], "MB", -n.q("rBA")) + L([[220, 130], [175, 130], [175, 164]].slice(0, 2), "MB", 0) + hsDot(300, 250) + hsDot(300, 230) + hsDot(300, 130);
      o += L([[220, 130], [300, 130]], "MB", 0);
    }
    if (!W.noAC) {
      o += L([[105, 270], [105, 262]], 0, n.q("acA")) + hsCheck(105, 250, "up", { tag: "1V5", open: n.q("acA") > 1e-6 }) + L([[105, 238], [105, 216], [175, 216], [300, 216]].slice(0, 2), "MA", n.q("acA")) + L([[105, 216], [300, 216]], "MA", n.q("acA")) + hsTank(105, 270) + hsDot(300, 216);
      o += L([[70, 270], [70, 132]], 0, n.q("acB")) + hsCheck(70, 120, "up", { tag: "1V6", open: n.q("acB") > 1e-6 }) + L([[70, 108], [70, 96], [300, 96], [300, 110]].slice(0, 3), "MB", n.q("acB")) + hsTank(70, 282).replace(/282/g, "282");
      o += L([[300, 96], [300, 110]], "MB", 0);
    }
    o += hsMotor(300, 170, { th: m.th }) + hsTag(306, 204, `1M1 ${P.V} cm³/rev`);
    // shuttle + brake
    o += hsShuttle(400, 290, { tag: "1V7", side: n.p("VA") >= n.p("VB") ? 1 : -1 }) + L([[321, 290], [384, 290]], "VA", 0) + L([[416, 290], [520, 290]].slice(0, 1).concat([[520, 290]]), "VB", 0);
    o += L([[416, 290], [470, 290], [470, 335]], "VB", 0) + hsDot(321, 290) + hsDot(470, 335);
    o += hsPilot([[400, 283], [400, 205], [370, 205], [370, 192]]) + hsBrake(370, 170, { applied: m.braked, tag: "1Y1 spring brake" });
    // drum + load
    const r = 22, y0 = 230 - ((m.th * 0.05) % 60 + 60) % 60 * 0 + Math.max(-40, Math.min(60, m.th * 0.6)) * 0;
    const ropeY = 205 + Math.max(0, Math.min(110, 55 + m.th * 0.9));
    o += `<path d="M384,168 H420 M384,172 H420" class="hs-s"/><g class="hs-sym hs-click" data-hcinfo="load"><circle cx="442" cy="170" r="${r}" class="hs-s hs-bg"/><path d="M442,170 L${f(442 + r * Math.cos(m.th), 1)},${f(170 + r * Math.sin(m.th), 1)}" class="hs-rot"/><path d="M464,170 V${f(ropeY, 1)}" class="hs-s"/><rect x="452" y="${f(ropeY, 1)}" width="24" height="22" class="hs-load"/></g>`;
    void y0;
    o += hsGauge(250, 300, n.p("MA"), { label: "A", ta: "end" }) + hsGauge(560, 130, n.p("MB"), { label: "B" }) + hsGauge(440, 230, n.p("BR"), { label: "brake" });
    o += hsTxt(640, 60, `n = ${f(m.w * 60 / (2 * Math.PI), 0)} rpm`, "middle", "hs-big");
    if (n.N.MA.cav || n.N.MB.cav) o += hsTxt(640, 85, "CAVITATION in the motor", "middle", "hs-warnbig");
    o += legendNote("Forward = lowering (the load drives the motor). The brake valve keeps back pressure on port B; the spring brake holds at stop.");
    return o;
  },
  txt: {
    what: "A hydraulic motor drives a winch drum (or conveyor). A brake valve (counterbalance for motors) in the return line controls an overrunning load. Cross-port reliefs limit the pressure peaks at stop, anti-cavitation checks refill the motor from the tank line, and a spring-applied brake holds the load at standstill.",
    why: "A motor always leaks internally (η_v 0.90–0.95) → it cannot hold a load; the brake must. When the load drives the motor (lowering, downhill conveyor, inertia at stop) the motor works as a pump: without a brake valve it runs away; at a sudden stop the outlet pressure jumps and the inlet side cavitates.",
    how: "Drive: n = Q·η_v / V, T = Δp·V·η_hm / (2π). Lowering: the brake valve opens only when the inlet pressure (pilot, × ratio) helps: p_B + k·p_A ≥ p_set → speed set by the pump. Stop: valve to the open (H) centre → brake valve closes, the motor is braked by the cross-port relief (12 MPa) and refilled by the anti-cavitation check; the shuttle pressure falls → the springs apply the brake after the motor has stopped (orifice delay).",
    check: "Brake holding torque ≥ 1.5–2 × max load torque. Brake full release (here 1.2 MPa) must be BELOW the pilot pressure while lowering (brake valve setting high enough), otherwise the brake drags. Open (H) or float centre (A, B → T) so the brake applies. Case drain (piston motors) free to the tank. Start torque of the motor (≈ 0.8–0.9 × running torque).",
    mistake: "Closed-centre valve with a brake → the release pressure is trapped → the brake does not apply. Brake released from the system pressure line → brake opens while the motor is not driven. No anti-cavitation checks → the motor sucks air at every stop (noise, damage). One-direction brake valve for a load that overruns in both directions (use a dual brake valve).",
  },
  fx(P) {
    const V = +P.V, Q = 18.7, n0 = Q * 1000 * MOTOR.etaV / V, T10 = 10e6 * V * 1e-6 * MOTOR.etaHm / (2 * Math.PI), TL = Math.abs(+P.TL), dp = TL * 2 * Math.PI / (V * 1e-6 * MOTOR.etaHm), ps = MOTOR.pset(P);
    const pA = Math.max(0, (ps - TL * 2 * Math.PI / (V * 1e-6))) / +P.k;
    return `<pre class="hc-pre">Speed      n = Q·η_v / V = ${Q} L/min · 1000 · ${MOTOR.etaV} / ${V} cm³ = <b>${f(n0, 1)} rpm</b>
Torque     T = Δp·V·η_hm / (2π) = 10 MPa · ${V} cm³ · ${MOTOR.etaHm} / 2π = <b>${f(T10, 0)} N·m</b> (max at 10 MPa)
Load       Δp needed to drive ${TL} N·m:  Δp = 2π·T / (V·η_hm) = ${f(dp / 1e6, 2)} MPa
Power      P = 2π·n·T/60 = 2π·${f(n0, 0)}·${TL}/60 = ${f(2 * Math.PI * n0 * TL / 60 / 1000, 2)} kW mechanical  (pump: 100 bar·18.7/600 = 3.1 kW max)
Brake valve setting  p_set ≥ 1.3 · 2π·T_over/V = 1.3 · ${f(TL * 2 * Math.PI / (V * 1e-6) / 1e6, 2)} = <b>${f(ps / 1e6, 2)} MPa</b> (min. 3 MPa)
Pilot while lowering p_A ≈ (p_set − p_load) / k = ${f(pA / 1e6, 2)} MPa (+ valve opening) → the pump pushes the load down gently
Brake      holding torque ≥ 2 × ${TL} = ${2 * TL} N·m → ${MOTOR.Tb} N·m chosen; release ${f(MOTOR.prel / 1e6, 1)} MPa, applies below ${f(MOTOR.papp / 1e6, 1)} MPa (orifice 0.8 mm delays it)
Stop       inertia J = ${MOTOR.J} kg·m², at ${f(n0, 0)} rpm: E = ½·J·ω² = ${f(0.5 * MOTOR.J * (n0 * 2 * Math.PI / 60) ** 2, 0)} J → turned into heat in the cross-port relief (12 MPa)
           braking torque 12 MPa · ${V} / 2π = ${f(MOTOR.Tbr(P), 0)} N·m; load ${+P.TL} N·m ${+P.TL < 0 ? "(overrunning: works against the braking)" : "(resistive: helps to stop)"}
           → t = J·ω / (T_brake + T_L) = ${MOTOR.J} · ${f(n0 * 2 * Math.PI / 60, 2)} / ${f(MOTOR.Tbr(P) + +P.TL, 0)} = ${Number.isFinite(MOTOR.tStop(P)) ? f(MOTOR.tStop(P), 3) + " s" : "the relief cannot stop the load – higher setting / brake"}</pre>`;
  },
  set(P) {
    return [["1V2 brake valve", `${f(MOTOR.pset(P) / 1e6, 1)} MPa, ratio ${P.k}:1`, "1.3 × overrunning load pressure"], ["1V3 / 1V4 cross-port reliefs", "12 MPa", "above working pressure, below motor peak rating"],
      ["1V5 / 1V6 anti-cavitation", "cracking 0.02–0.05 MPa", "refill from the T line (keep T line pressure ≈ 0.3 MPa with a back-pressure check for better filling)"], ["1Y1 brake", `${MOTOR.Tb} N·m, release ${f(MOTOR.prel / 1e6, 1)} MPa, applies < ${f(MOTOR.papp / 1e6, 1)} MPa`, "≥ 2 × load torque; release pressure below the pilot pressure while lowering"],
      ["1V1 centre", "open H (P, A, B → T)", "brake release line vented at stop, pump unloaded"]];
  },
  fail: [["Load runs away when lowering", "no / wrong brake valve, setting too low", "brake valve on the motor, p_set ≥ 1.3 × load pressure"],
    ["Knocking / noise at stop", "cavitation on the inlet side", "anti-cavitation checks, back pressure in the T line"],
    ["Hose bursts at stop", "pressure peak (inertia), no cross-port relief", "cross-port reliefs, slower valve (ramp)"],
    ["Load sinks with the brake 'on'", "brake worn / released by trapped pressure", "open / float centre, brake test, release line orifice"],
    ["Motor slow under load", "internal leakage high (η_v low), case drain blocked", "measure case drain flow, change motor"]],
  twin: "Not used in the twin cell (conveyors are electric). Typical: winches, slewing drives, mixers, wheel drives of mobile machines, chip conveyors with hydraulic drive.",
  test(P) {
    const out = [], V = +P.V;
    const r = (w, TL) => runScript(MOTOR, Object.assign({}, P, { TL }), w, (n) => ({ w: n.a.mot.w, pA: n.p("MA"), pB: n.p("MB"), brk: n.a.mot.braked, nmax: n.ctx.nmax, pmax: n.ctx.pmax, pmin: n.ctx.pmin }), 0.02);
    const a = r({}, 150), nh = 18.7 * 1000 * MOTOR.etaV / V;
    out.push(`motor: TL=+150 forward n sim=${f(at(a.out, 3).w * 60 / (2 * Math.PI), 1)} hand Q·ηv/V=${f(nh, 1)}rpm Δp sim=${f((at(a.out, 3).pA - at(a.out, 3).pB) / 1e6, 2)} (pA ${f(at(a.out, 3).pA / 1e6, 2)} pB ${f(at(a.out, 3).pB / 1e6, 2)}) hand 2πT/(V·ηhm)=${f(150 * 2 * Math.PI / (V * 1e-6 * 0.9) / 1e6, 2)} + friction T0+cv·ω ${f((4 + 1 * nh * 2 * Math.PI / 60) * 2 * Math.PI / (V * 1e-6 * 0.9) / 1e6, 2)} MPa`);
    const b = r({}, -100), c = r({ noCBV: true }, -100), d = r({ noAC: true }, 150), e = r({ closed: true }, -100);
    out.push(`motor: overrun −100: n forward sim=${f(at(b.out, 3).w * 60 / (2 * Math.PI), 1)}rpm (≈${f(nh / 0.95 * 1.0, 0)}) brake at 12s=${at(b.out, 11.9).brk} | no brake valve n max=${f(c.out[c.out.length - 1].nmax, 0)}rpm min p=${f(c.out[c.out.length - 1].pmin / 1e6, 2)}MPa`);
    { const pp = Object.assign({}, P, { TL: -100 }), V0 = +P.V, w0 = 18.7 * 1000 * MOTOR.etaV / V0 * 2 * Math.PI / 60, hand = MOTOR.J * w0 / (12e6 * V0 * 1e-6 / (2 * Math.PI) - 100);
      out.push(`motor fix E7: stop time T_L −100 = ${f(MOTOR.tStop(pp), 3)} s hand J·ω/(T_br − |T_L|) = ${f(hand, 3)} s (before 0.043 s) | E6: text release/apply = ${/release 1\.2 MPa, applies below 0\.8 MPa/.test(MOTOR.fx(pp)) && /release 1\.2 MPa, applies < 0\.8/.test(MOTOR.set(pp)[3][1])} model prel=${MOTOR.prel / 1e6} papp=${MOTOR.papp / 1e6} MPa`); }
    out.push(`motor: stop peaks: normal pmax=${f(a.out[a.out.length - 1].pmax / 1e6, 1)} pmin=${f(a.out[a.out.length - 1].pmin / 1e6, 2)} | no anti-cav pmin=${f(d.out[d.out.length - 1].pmin / 1e6, 2)} MPa | closed centre: brake applied at 12 s=${at(e.out, 11.9).brk} (trapped release pressure → stays released)`);
    return out;
  },
};

/* ======================================================================= 8  SUPPLY: CLOSED / TANDEM CENTRE, VARIABLE PUMP, LOAD SENSING */
const SUP_MODES = [["cc", "fixed pump + closed centre (relief)"], ["tc", "fixed pump + tandem centre (unloads)"], ["pc", "variable pump, pressure compensator"], ["ls", "variable pump, load sensing (Δp 2 MPa)"]];
const SUPPLY = {
  id: "supply", n: 8, title: "Supply: unloading, tandem vs closed centre, variable pump, load sensing", sub: "same cylinder job, four supply types – where the energy goes",
  P: [
    { k: "mode", l: "Supply type", v: "tc", opts: SUP_MODES },
    { k: "dem", l: "Speed demand (proportional valve opening)", u: "%", v: 100, min: 30, max: 100, st: 5 },
  ],
  W: [{ k: "cc", l: "fixed pump against a closed centre (the classic mistake)" }],
  V: [{ k: "s", l: "Valve 1V1", opts: [[1, "▶ extend"], [0, "0 pause"], [-1, "◀ retract"]] }],
  dur: 10, Qmax: 18.7,
  make(P, W) {
    const n = new Net({ dt: 2e-5 }), mode = W.cc ? "cc" : P.mode, dem = +P.dem / 100, Qm = SUPPLY.Qmax * LPM;
    n.node("P", 0.3).node("A", 0.3).node("B", 0.3);
    const s = () => n.u.s || 0, pos = () => Math.max(0, s()), neg = () => Math.max(0, -s());
    const pLS = (nn) => (s() > 0.05 ? nn.p("A") : s() < -0.05 ? nn.p("B") : 0);
    n.ctx = { mode, Ein: 0, Euse: 0, Pin: 0, Puse: 0, Qg: 0 };
    let Qf;
    if (mode === "cc" || mode === "tc") Qf = () => Qm;
    else if (mode === "pc") Qf = (nn) => Qm * ramp(10e6 - nn.p("P"), 0, 0.6e6);
    else Qf = (nn) => Qm * Math.min(ramp(pLS(nn) + 2e6 - nn.p("P"), 0, 0.4e6), ramp(10e6 - nn.p("P"), 0, 0.6e6));   // LS + pressure cut-off
    n.add(src("P", (nn) => { const q = Qf(nn); nn.ctx.Qg = q; return q; }, { name: "pump" }));
    const pr = mode === "cc" || mode === "tc" ? 10e6 : 11e6;
    n.add(orif("P", "T", (nn) => 40e-6 * ramp(nn.p("P"), pr, pr + 0.6e6), { name: "relief" }));
    if (mode === "pc" || mode === "ls") n.add(lam("P", "T", leakG(1000, 10), { name: "case" }));
    const Am = 7.4e-6 * dem, Ar = 15e-6 * dem;
    n.add(orif("P", "A", () => Am * pos(), { name: "PA", tau: 0.05 })); n.add(orif("B", "T", () => Ar * pos(), { name: "BT", tau: 0.05 }));
    n.add(orif("P", "B", () => Am * neg(), { name: "PB", tau: 0.05 })); n.add(orif("A", "T", () => Ar * neg(), { name: "AT", tau: 0.05 }));
    if (mode === "tc") n.add(orif("P", "T", () => 30e-6 * Math.max(0, 1 - Math.abs(s()) * 1.6), { name: "cPT", tau: 0.05 }));
    n.act(cyl({ name: "cyl", A: "A", B: "B", D: 63, d: 36, L: 0.2, m: 300, F: (nn, c) => (c.v >= 0 ? 20000 : -2000), c: 3000, Ff: 200, cd: 20000 }));
    n.pre = (nn, dt) => { const pin = nn.p("P") * nn.ctx.Qg, use = Math.max(0, nn.a.cyl.Fload * nn.a.cyl.v) + Math.max(0, -2000 * -nn.a.cyl.v) * 0; nn.ctx.Pin = pin; nn.ctx.Puse = use; nn.ctx.Ein += pin * dt; nn.ctx.Euse += use * dt; };
    return n;
  },
  script: () => [[0, { s: 0 }], [0.3, { s: 1 }], [3.4, { s: 0 }], [4, { s: -1 }], [7, { s: 0 }]],
  charts: [
    { t: "Pump pressure and load pressure", u: "MPa", s: [["pump p_P", (n) => n.p("P") / 1e6], ["cap side p_A", (n) => n.p("A") / 1e6]] },
    { t: "Power", u: "kW", s: [["pump output p·Q", (n) => n.ctx.Pin / 1000], ["useful F·v", (n) => n.ctx.Puse / 1000]] },
  ],
  rd(n) {
    const c = n.a.cyl;
    return [["Supply", SUP_MODES.find((m) => m[0] === n.ctx.mode)[1]], ["Speed v", f(c.v * 1000, 0) + " mm/s"], ...pRd(n, [["Pump p_P", "P"], ["Cap side p_A", "A"], ["Rod side p_B", "B"]]), ["Pump flow (geometric)", f(n.ctx.Qg * 6e4, 1) + " L/min"],
      ["Relief flow", f(n.q("relief") * 6e4, 1) + " L/min", n.q("relief") > 1e-5 ? "hc-bad" : ""], ["Pump power now", f(n.ctx.Pin / 1000, 2) + " kW"], ["Energy in / useful (this run)", `${f(n.ctx.Ein / 1000, 1)} / ${f(n.ctx.Euse / 1000, 1)} kJ`],
      ["Efficiency this run", n.ctx.Ein > 100 ? f(n.ctx.Euse / n.ctx.Ein * 100, 0) + " %" : "–"]];
  },
  draw(n, P, W, A) {
    const L = mkL(n, A), c = n.a.cyl, s = sOf(n), mode = n.ctx.mode;
    let o = hpu(n, A, { variable: mode === "pc" || mode === "ls", rset: mode === "pc" || mode === "ls" ? "11 MPa" : "10 MPa" });
    o += L([[90, 415], [321, 415], [321, 403]], "P", n.q("PA") + n.q("PB") + n.q("cPT")) + L([[339, 403], [339, 420]], 0, n.q("AT") + n.q("BT") + n.q("cPT")) + hsTank(339, 420);
    o += hsDcv(330, 380, { s, centre: mode === "tc" ? "tandem" : "closed", tag: mode === "ls" ? "1V1 LS proportional valve" : "1V1 proportional valve" });
    o += L([[321, 357], [321, 300], [258, 300], [258, 220]], "A", n.q("PA") - n.q("AT")) + L([[339, 357], [339, 300], [412, 300], [412, 220]], "B", n.q("PB") - n.q("BT"));
    const cy = hsCyl(250, 180, { len: 170, frac: c.x / c.L, pA: n.p("A"), pB: n.p("B"), pm: PM, tag: "1A1 Ø63/36" });
    o += cy.svg + hsLoad(cy.tip, { label: "20 kN", w: 50 });
    if (mode === "ls") o += hsShuttle(370, 270, { tag: "LS", side: s >= 0 ? -1 : 1 }) + hsPilot([[370, 263], [370, 250], [40, 250], [40, 470], [70, 470]]) + hsTxt(44, 244, "load-sensing line → pump compensator (p_P = p_LS + 2 MPa)", "start", "hs-tag");
    if (mode === "pc") o += hsPilot([[90, 415], [40, 415], [40, 470], [70, 470]]) + hsTxt(30, 408, "compensator 10 MPa", "start", "hs-tag");
    o += hsGauge(230, 150, n.p("A"), { label: "p_A", ta: "end" });
    o += hsTxt(600, 120, `pump ${f(n.ctx.Pin / 1000, 2)} kW`, "middle", "hs-big") + hsTxt(600, 145, `useful ${f(n.ctx.Puse / 1000, 2)} kW`, "middle", "hs-big");
    if (n.q("relief") > 1e-5) o += hsTxt(600, 175, `${f(n.q("relief") * 6e4, 1)} L/min over the relief = heat`, "middle", "hs-warnbig");
    o += legendNote({ cc: "Closed centre + fixed pump: in every pause all oil goes over the relief at 10 MPa.", tc: "Tandem centre: in the pause P → T at low pressure. Only one actuator per pump line.", pc: "Pressure compensator: in the pause the pump swivels back to ≈ 0 flow but holds 10 MPa.", ls: "Load sensing: pump pressure = highest load + 2 MPa; flow = what the valve asks for." }[mode]);
    return o;
  },
  txt: {
    what: "The same cylinder job (extend 20 kN, retract, pause) supplied in four ways: fixed pump with a closed-centre valve, fixed pump with a tandem centre, variable pump with a pressure compensator, variable pump with load sensing.",
    why: "Every watt the pump gives that the load does not use becomes heat → bigger cooler, hotter oil, shorter oil and seal life. The supply type decides the losses in the pause and at part speed.",
    how: "Fixed + closed centre: pause → everything over the relief (p_relief·Q). Tandem: pause → P → T (Δp ≈ 0.2–0.5 MPa). Pressure compensator: pause → swivel angle ≈ 0, but 10 MPa × leakage. Load sensing: the shuttle sends the highest load pressure to the pump; p_P = p_LS + Δp margin (1.5–2.5 MPa), Q = what the valve opening asks for → lowest loss at part speed and with several actuators.",
    check: "Tandem only for ONE actuator per pump branch (series connection). Pressure compensator setting below the relief (relief = safety only, 1–1.5 MPa above). LS margin from the valve catalogue (2 MPa typical). Look at the duty cycle (item 3): long pauses → unloading or accumulator.",
    mistake: "Fixed pump + closed centre with long pauses → oil temperature 70 °C+. LS system with one big and one small load → the small load is throttled at the big pressure (loss stays). Variable pump without case drain line free to the tank → shaft seal blows.",
  },
  fx(P) {
    const Q = 18.7, dem = +P.dem / 100, F = 20000, pA = F / A63 / 1e6, v = 0.2 / 2;
    return `<pre class="hc-pre">Job: extend 20 kN, 200 mm, 18.7 L/min → v = Q/A1 = ${f(Q * LPM / A63, 3)} m/s, p_A = F/A1 = 20 kN / ${f(A63 * 1e4, 2)} cm² = <b>${f(pA, 2)} MPa</b>
Pause power (pump runs, nothing moves):
  fixed + closed centre   P = p_relief·Q = 100 bar · ${Q} / 600 = <b>${f(100 * Q / 600, 2)} kW</b>  → all heat
  fixed + tandem centre   P = Δp_PT·Q ≈ 1.2 bar · ${Q} / 600 = ${f(1.2 * Q / 600, 3)} kW (valve P→T + lines)
  pressure compensator    P = p_c·Q_leak = 100 bar · 1 L/min / 600 = ${f(100 / 600, 3)} kW (+ friction)
  load sensing (standby)  P = Δp_margin·Q_leak = 20 bar · 1 / 600 = ${f(20 / 600, 3)} kW
Extension power: useful F·v = 20 kN · ${f(v, 2)} m/s = ${f(F * v / 1000, 2)} kW; pump p_P·Q ≈ (p_A + Δp_valve)·Q
  proportional valve Δp at 18.7 L/min = 2 MPa (7.4 mm² meter-in) → p_P ≈ ${f(pA + 2, 1)} MPa → ${f((pA + 2) * 10 * Q / 600, 2)} kW
At part speed (${P.dem} %): fixed pumps push the rest (${f(Q * (1 - dem), 1)} L/min) over the relief at 10 MPa → ${f(100 * Q * (1 - dem) / 600, 2)} kW extra;
  LS gives only ${f(Q * dem, 1)} L/min at p_A + 2 MPa → ${f((pA + 2) * 10 * Q * dem / 600, 2)} kW
In the demo the valve stays open ≈ 1 s after the end of stroke (typical PLC time-out): a fixed pump then dumps everything over the relief
  → switch the valve off with an end-of-stroke sensor, or use a variable / LS pump with pressure cut-off.
Heat per hour (pause share 65 %): closed centre ${f(100 * Q / 600 * 0.65, 2)} kWh/h vs tandem ${f(1.2 * Q / 600 * 0.65, 3)} kWh/h</pre>`;
  },
  set() { return [["0V1 relief (fixed pump)", "10 MPa", "working limit"], ["Compensator (variable)", "10 MPa, relief 11 MPa", "relief = safety only"], ["LS margin", "2 MPa (1.5–2.5)", "from the valve catalogue"], ["Tandem centre", "Δp P→T ≈ 0.1–0.3 MPa", "pump unloaded in the pause"]]; },
  fail: [["Oil too hot", "fixed pump + closed centre / relief set below compensator", "tandem / unloading / variable pump; relief 1–1.5 MPa above compensator"],
    ["LS pump does not destroke", "LS line not vented in neutral (no orifice to tank)", "LS bleed orifice, check shuttle"],
    ["Actuators slow down when a second one moves (LS)", "pump at max flow (flow saturation)", "bigger pump or flow-sharing (post-compensated) valves"],
    ["Pressure peaks at valve switching (variable pump)", "compensator response 50–100 ms", "small accumulator or relief, slower valve ramps"]],
  twin: "In the twin HPUs (APC, HMC) the pump is small with accumulator + unloading (circuit 6) because the duty cycle has long pauses (item 3 compares the options with numbers).",
  results(P) {
    return SUP_MODES.map(([m, l]) => {
      const r = runScript(SUPPLY, Object.assign({}, P, { mode: m }), {}, (n) => ({ Ein: n.ctx.Ein, Euse: n.ctx.Euse, x: n.a.cyl.x }), 0.5);
      const e = r.out[r.out.length - 1];
      return { m, l, Ein: e.Ein, Euse: e.Euse, Eloss: e.Ein - e.Euse, Pavg: e.Ein / SUPPLY.dur, Peak: 0 };
    });
  },
  test(P) {
    const R = SUPPLY.results(P);
    return [`supply (one 10 s cycle, kJ in/useful/loss, avg kW): ` + R.map((r) => `${r.m}=${f(r.Ein / 1000, 1)}/${f(r.Euse / 1000, 1)}/${f(r.Eloss / 1000, 1)}/${f(r.Pavg / 1000, 2)}`).join(" "),
      `supply hand pause power: cc=${f(100 * 18.7 / 600, 2)}kW tc≈${f(1.2 * 18.7 / 600, 3)} pc≈${f(100 / 600, 3)} ls≈${f(20 / 600, 3)}; useful extension ${f(20000 * 0.2 / 1000, 1)}kJ`];
  },
};

/* ======================================================================= 9  SYNCHRONISING + INTENSIFIER */
const SYNC = {
  id: "sync", n: 9, title: "Synchronising two cylinders (+ pressure intensifier)", sub: "lifting platform with an eccentric load: flow divider, mechanical link, servo",
  P: [
    { k: "mode", l: "Synchronising method", v: "div", opts: [["none", "none (parallel)"], ["div", "gear flow divider 1V2"], ["mech", "mechanical link (stiff frame)"], ["servo", "2 proportional valves + position control"]] },
    { k: "F2", l: "Load on cylinder 2 (cylinder 1 = 4 kN)", u: "kN", v: 10, min: 4, max: 16, st: 1 },
  ],
  W: [{ k: "none", l: "without synchronisation (parallel connection)" }],
  V: [{ k: "s", l: "Valve 1V1", opts: [[1, "Y1 ▲ raise"], [0, "0 hold"], [-1, "Y2 ▼ lower"]] }],
  dur: 11,
  make(P, W) {
    const n = new Net({ dt: 2e-5 }), mode = W.none ? "none" : P.mode, F1 = 4000, F2 = +P.F2 * 1000;
    n.node("P", 0.3).node("VA", 0.2).node("A1", 0.2).node("A2", 0.2).node("VB", 0.4);
    n.add(src("P", () => 18.7 * LPM, { name: "pump" })); n.add(orif("P", "T", (nn) => 40e-6 * ramp(nn.p("P"), 10 * MPA, 10.6 * MPA), { name: "relief" }));
    dcv(n, { P: "P", A: "VA", B: "VB", Av: 25e-6, centre: "closed", leak: leakG(5) });
    n.ctx = { mode, Fl: 0, dmax: 0 };
    const kL = 2e7, cL = 3e4;
    const link = (i) => (nn) => { if (mode !== "mech") return 0; const a = nn.a.c1, b = nn.a.c2; const F = kL * (a.x - b.x) + cL * (a.v - b.v); nn.ctx.Fl = F; return i === 1 ? F : -F; };
    if (mode === "none" || mode === "mech") { n.add(orif("VA", "A1", () => 40e-6, { name: "l1" })); n.add(orif("VA", "A2", () => 40e-6, { name: "l2" })); }
    else if (mode === "div") {
      n.act(divider({ name: "div", in: "VA", o1: "A1", o2: "A2", V: 8, G: 1e-12, J: 2e-4 }));
      
    } else {
      const Kp = 1 / 0.004, cl = (v) => Math.max(0, Math.min(1, v));
      const e = (nn) => Kp * (nn.a.c1.x - nn.a.c2.x) * ((nn.u.s || 0) < 0 ? -1 : 1);   // error sign follows the direction
      n.add(orif("VA", "A1", (nn) => 30e-6 * cl(0.5 - e(nn)), { name: "l1", tau: 0.02 }));
      n.add(orif("VA", "A2", (nn) => 30e-6 * cl(0.5 + e(nn)), { name: "l2", tau: 0.02 }));
    }
    n.act(cyl({ name: "c1", A: "A1", B: "VB", D: 50, d: 28, L: 0.3, m: F1 / G0, vert: true, F: link(1), c: 3000, Ff: 150, cd: 20000 }));
    n.act(cyl({ name: "c2", A: "A2", B: "VB", D: 50, d: 28, L: 0.3, m: F2 / G0, vert: true, F: link(2), c: 3000, Ff: 150, cd: 20000 }));
    n.pre = (nn) => { const d = Math.abs(nn.a.c1.x - nn.a.c2.x); if (d > nn.ctx.dmax) nn.ctx.dmax = d; };
    return n;
  },
  script: () => [[0, { s: 0 }], [0.3, { s: 1 }], [5.6, { s: 0 }], [6.3, { s: -1 }], [10.6, { s: 0 }]],
  charts: [
    { t: "Positions", u: "mm", s: [["cylinder 1 (4 kN)", (n) => n.a.c1.x * 1000], ["cylinder 2", (n) => n.a.c2.x * 1000]] },
    { t: "Difference x1 − x2", u: "mm", s: [["Δx", (n) => (n.a.c1.x - n.a.c2.x) * 1000]] },
  ],
  rd(n) {
    const a = n.a.c1, b = n.a.c2;
    return [["Cylinder 1 position", f(a.x * 1000, 1) + " mm"], ["Cylinder 2 position", f(b.x * 1000, 1) + " mm"], ["Difference", f((a.x - b.x) * 1000, 1) + " mm", Math.abs(a.x - b.x) > 0.01 ? "hc-bad" : "hc-ok"],
      ["Largest difference so far", f(n.ctx.dmax * 1000, 1) + " mm"], ...pRd(n, [["Pump p_P", "P"], ["Cylinder 1 p", "A1"], ["Cylinder 2 p", "A2"]]), ["Frame force (mechanical)", n.ctx.mode === "mech" ? f(n.ctx.Fl / 1000, 2) + " kN" : "–"]];
  },
  draw(n, P, W, A) {
    const L = mkL(n, A), s = sOf(n), a = n.a.c1, b = n.a.c2, mode = n.ctx.mode;
    let o = hpu(n, A);
    o += L([[90, 415], [321, 415], [321, 403]], "P", qP(n)) + L([[339, 403], [339, 420]], 0, qT(n)) + hsTank(339, 420);
    o += hsDcv(330, 380, { s, centre: "closed", tag: "1V1" });
    const q1 = mode === "div" ? n.a.div.q1 - n.q("l1") : n.q("l1"), q2 = mode === "div" ? n.a.div.q2 - n.q("l2") : n.q("l2");
    const y0 = 150, len = 100, yc = y0 + len - 8, yr = y0 + 8;   // cylinders vertical, ports on the right side: cap yc, rod yr
    o += L([[321, 357], [321, 340], [330, 340], [330, 324]], "VA", qA(n));
    if (mode === "div") o += hsDivider(330, 300, { tag: "1V2 flow divider" }) + L([[308, 276], [308, 266], [236, 266], [236, yc], [230, yc]], "A1", q1) + L([[352, 276], [352, 266], [476, 266], [476, yc], [470, yc]], "A2", q2);
    else if (mode === "servo") {
      o += L([[330, 324], [330, 316], [250, 316], [250, 312]], "VA", q1) + L([[330, 316], [420, 316], [420, 312]], "VA", q2) + hsDot(330, 316);
      const pv = (x, tag, u) => `<g class="hs-sym hs-click" data-hcinfo="propv"><rect x="${x - 18}" y="282" width="36" height="30" class="hs-s hs-bg"/><path d="M${x - 9},310 V286 M${x + 9},286 V310" class="hs-s"/><path d="M${x - 30},288 h12 M${x - 30},306 h12 M${x - 30},288 l12,18" class="hs-s"/></g>${hsTag(x + 22, 296, tag)}${hsTxt(x + 22, 308, f(u * 100, 0) + " %", "start", "hs-tag")}`;
      o += pv(250, "1V2", n.e.l1.A / 30e-6) + pv(420, "1V3", n.e.l2.A / 30e-6) + L([[250, 282], [250, 270], [236, 270], [236, yc], [230, yc]], "A1", q1) + L([[420, 282], [420, 270], [476, 270], [476, yc], [470, yc]], "A2", q2);
      o += hsElec([[190, 200], [160, 200], [160, 297], [220, 297]]) + hsElec([[520, 200], [560, 200], [560, 297], [450, 297]].slice(0, 3).concat([[440, 297]])) + hsTxt(355, 335, "controller: u = 0.5 ∓ Kp·(x1 − x2)·sign(v)", "middle", "hs-tag");
    } else o += L([[330, 324], [330, 266], [236, 266], [236, yc], [230, yc]], "A1", q1) + L([[330, 266], [476, 266], [476, yc], [470, yc]], "A2", q2) + hsDot(330, 266);
    o += L([[339, 357], [339, 345], [600, 345], [600, yr - 18], [476, yr - 18], [476, yr], [470, yr]], "VB", -qB(n)) + L([[339, 345], [290, 345], [290, yr], [230, yr]], "VB", 0) + hsDot(339, 345);
    const c1 = hsCyl(190, y0, { vert: true, len, frac: a.x / a.L, pA: n.p("A1"), pB: n.p("VB"), pm: PM, tag: "1A1 Ø50/28" });
    const c2 = hsCyl(430, y0, { vert: true, len, frac: b.x / b.L, pA: n.p("A2"), pB: n.p("VB"), pm: PM, tag: "2A1 Ø50/28" });
    o += c1.svg.replace(/h6/g, "h0") + c2.svg.replace(/h6/g, "h0");
    // platform between the rod tips (tilts with the difference)
    const t1 = c1.tip, t2 = c2.tip;
    o += `<g class="hs-sym hs-click" data-hcinfo="${mode === "mech" ? "link" : "load"}"><path d="M${t1[0] - 20},${f(t1[1], 1)} L${t2[0] + 20},${f(t2[1], 1)}" class="hs-plat"/></g>` + hsTxt(t1[0], t1[1] - 10, "4 kN", "middle", "hs-tag") + hsTxt(t2[0], t2[1] - 10, `${P.F2} kN`, "middle", "hs-tag");
    if (mode === "mech") o += hsTxt(330, Math.min(t1[1], t2[1]) - 22, `frame force ${f(n.ctx.Fl / 1000, 1)} kN`, "middle", "hs-tag");
    o += hsGauge(160, 250, n.p("A1"), { label: "p1", ta: "end" }) + hsGauge(540, 250, n.p("A2"), { label: "p2" });
    o += hsTxt(640, 300, `Δx = ${f((a.x - b.x) * 1000, 1)} mm`, "middle", Math.abs(a.x - b.x) > 0.01 ? "hs-warnbig" : "hs-big");
    o += legendNote({ none: "Parallel: the oil goes to the lighter load first – the platform tilts.", div: "Flow divider: two gear sections on one shaft force equal flows (± leakage error).", mech: "Mechanical link: the frame forces both rods together; it must carry the force difference.", servo: "Servo: each cylinder has a proportional valve; the controller corrects the position difference." }[mode]);
    return o;
  },
  txt: {
    what: "Two cylinders that must move together (lifting platform, press with two rams, gate) although the load is not in the middle. Methods: none (parallel), gear flow divider, mechanical link, electronic position control with two proportional valves. Plus: the pressure intensifier (booster).",
    why: "Oil goes to the cylinder with the lowest pressure first. With an eccentric load the light side moves first → the platform tilts and jams in its guides.",
    how: "Flow divider: two equal gear sections on one shaft → equal flows, error ±1–3 % from internal leakage (Δq = G·Δp). Mechanical: rack and pinion, torsion shaft or stiff frame forces equal stroke; the link carries the force difference. Servo: position sensors on both cylinders, the controller opens the valve of the leading cylinder less (accuracy 0.1–1 mm).",
    check: "Flow divider: re-synchronise at the stroke end (synchronising valves / end-of-stroke bypass), check the intensification in the section with the low load. Mechanical: frame force = load difference + friction; deflection. Servo: oil cleanliness 16/14/11, sensor resolution, fail-safe stop when Δx > limit.",
    mistake: "Two cylinders in parallel without any sync and a 'guide will hold it' idea → jam. Flow divider error adds up stroke after stroke (no end-of-stroke correction). Throttles in each line (simple flow controls) → change with load and temperature.",
  },
  fx(P) {
    const A1 = areaD(50), F2 = +P.F2 * 1000, p1 = 4000 / A1, p2 = F2 / A1, dq = 1e-12 * (p2 - p1), q = 18.7 / 2 * LPM;
    const Ai = areaD(100), Ao = areaD(40);
    return `<pre class="hc-pre">Cylinders Ø50/28: A1 = ${f(A1 * 1e4, 2)} cm²  loads 4 kN / ${P.F2} kN → p1 = ${f(p1 / 1e6, 2)} MPa, p2 = ${f(p2 / 1e6, 2)} MPa
Each cylinder Q/2 = 9.35 L/min → v = Q/(2·A1) = ${f(q / A1, 3)} m/s, stroke 300 mm in ${f(0.3 / (q / A1), 1)} s
Parallel (no sync): light side first at v = Q/A1 = ${f(18.7 * LPM / A1, 3)} m/s, then the heavy side → full tilt (300 mm!)
Flow divider error  Δq = G·(p2 − p1) = 1e-12 m³/(s·Pa) · ${f((p2 - p1) / 1e6, 2)} MPa = ${f(dq * 6e7, 1)} cm³/min of ${f(q * 6e7, 0)} → ${f(dq / q * 100, 1)} %
                    → Δx ≈ ${f(dq / q * 300, 1)} mm over 300 mm (catalogue ± 1–3 %)
Intensification in a divider: low-load section can drive the other: p_max,1 ≈ 2·p_in − p2 (rate both outlets for 2 × p_in)
Mechanical link: frame carries ≈ (F2 − F1)/2 = ${f((F2 - 4000) / 2000, 1)} kN (+ friction) at mid span
Pressure intensifier (booster): p_out = p_in · A_in / A_out = 10 MPa · (${f(Ai * 1e4, 1)} / ${f(Ao * 1e4, 1)}) = <b>${f(10 * Ai / Ao, 1)} MPa</b> (Ø100 / Ø40, ratio ${f(Ai / Ao, 2)})
                    Q_out = Q_in · A_out/A_in = 18.7 · ${f(Ao / Ai, 3)} = ${f(18.7 * Ao / Ai, 2)} L/min  (power is conserved minus losses)
                    use: high clamp force from a 10 MPa unit, workholding 50 MPa, test benches</pre>`;
  },
  set(P) { return [["1V2 flow divider", "2 × 9.35 L/min, ± 2 %", "with end-of-stroke re-synchronisation"], ["Proportional valves (servo)", "NG6, Kp ≈ 1 per 4 mm error", "position sensors 0.01 mm"], ["Frame (mechanical)", `≥ ${f((+P.F2 - 4) / 2, 1)} kN × 2 safety`, "deflection < 0.5 mm"], ["0V1 relief", "10 MPa", "system"]]; },
  fail: [["Platform tilts more every stroke", "divider error adds up, no re-synchronisation", "stroke-end synchronising valves, drive both to the end stop"],
    ["One cylinder at much higher pressure than possible", "divider intensification", "relief on each outlet"],
    ["Platform jams", "no synchronisation, weak frame", "add divider / servo / stiff link"],
    ["Servo axis oscillates", "controller gain too high, air in the oil", "lower Kp, bleed cylinders"]],
  twin: "In the twin: the APC lift has ONE cylinder with a guide column (no sync needed). A wide pallet lift or a gantry with two cylinders would need one of these methods.",
  test(P) {
    const out = [];
    const r = (mode, w) => runScript(SYNC, Object.assign({}, P, { mode }), w || {}, (n) => ({ x1: n.a.c1.x, x2: n.a.c2.x, d: n.ctx.dmax, Fl: n.ctx.Fl }), 0.05);
    const R = ["none", "div", "mech", "servo"].map((m) => [m, r(m)]);
    out.push("sync max Δx mm: " + R.map(([m, rr]) => `${m}=${f(rr.out[rr.out.length - 1].d * 1000, 1)}`).join(" ") + ` | hand divider ≈ ${f(1e-12 * (+P.F2 * 1000 - 4000) / areaD(50) / (9.35 * LPM) * 300, 1)} mm`);
    out.push(`sync: time to 299 mm (div) c1=${f((R[1][1].out.find((s) => s.x1 > 0.299) || { t: NaN }).t, 2)}s c2=${f((R[1][1].out.find((s) => s.x2 > 0.299) || { t: NaN }).t, 2)}s hand ${f(0.3 / (9.35 * LPM / areaD(50)) + 0.3, 2)}s (incl. 0.3 s start) | intensifier 10 MPa·(100/40)² = ${f(10 * 6.25, 1)} MPa`);
    return out;
  },
};

export const CIRCUITS_B = [ACC, MOTOR, SUPPLY, SYNC];
void hsArrow; void hsElec;
