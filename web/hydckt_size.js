/* Hydraulics tab – item 3 "System sizing": CALCULATIONS + presets (pure math, no DOM).
 * Load list → system pressure → cylinders (ISO 3320 series, Euler / Tetmajer buckling, safety 3.5) / motors → flows → duty cycle
 * → supply options (fixed pump + unloading, variable pump, pump + accumulator) with energy per cycle, peak and RMS power
 * → pump displacement + IEC motor → accumulator (adiabatic n = 1.4) → valve sizes NG6…NG32 → settings → pipes + hoses
 * (velocity, wall, Δp) → heat balance, tank, cooler → filter (ISO 4406 target) → parts list.
 * Same method and example numbers as docs/25_hydraulic_design_method.md (preset "guide"). All values are EXAMPLES. */
export const SER = {
  p: [6.3, 10, 16, 21, 25, 31.5, 35],
  bore: [25, 32, 40, 50, 63, 80, 100, 125, 140, 160, 180, 200, 250],
  rod: [12, 14, 16, 18, 20, 22, 25, 28, 32, 36, 40, 45, 50, 56, 63, 70, 80, 90, 100, 110, 125, 140],
  pairs: { 25: [14, 18], 32: [18, 22], 40: [22, 28], 50: [28, 36], 63: [36, 45], 80: [45, 56], 100: [56, 70], 125: [70, 90], 140: [90, 100], 160: [90, 110], 180: [110, 125], 200: [125, 140], 250: [140, 140] },
  gear: [4, 6, 8, 11, 14, 16, 19, 23, 26, 32, 40, 50], vane: [10, 16, 20, 25, 32, 40, 50, 63], piston: [18, 28, 45, 71, 100, 140],
  kw: [0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45],
  orbit: [50, 80, 100, 125, 160, 200, 250, 315, 400], radial: [500, 800, 1000, 1600, 2000, 3000, 4000, 6000],
  ng: [["NG6 (CETOP 03)", 60, 36], ["NG10 (CETOP 05)", 100, 60], ["NG16 (CETOP 07)", 300, 180], ["NG25 (CETOP 08)", 650, 390], ["NG32 (CETOP 10)", 1100, 660]],
  acc: [0.2, 0.5, 1, 2.5, 4, 5, 10, 20, 32, 50],
  // EN 10305-4 tubes (OD × wall), sorted by OD then wall; thick walls for 16–25 MPa lines (check the tube maker's table)
  tube: [[6, 1], [8, 1], [10, 1.5], [12, 1.5], [15, 2.5], [16, 2], [16, 3], [18, 2], [20, 2.5], [20, 3], [20, 4], [22, 2.5], [25, 3], [25, 4], [25, 4.5], [28, 3], [30, 3], [30, 4], [30, 5], [30, 6], [35, 3], [38, 4], [38, 5], [38, 6], [42, 4], [42, 6], [42, 8], [50, 5], [50, 6], [50, 8], [60, 5], [76, 5]],
  hose: [6.3, 8, 10, 12.5, 16, 19, 25, 31.5, 38, 51],
  tank: [10, 16, 25, 40, 63, 100, 160, 250, 400, 630],
};
export const MOUNT = { // Euler cases: buckling length factor K (L_k = K · L)
  fixfree: [2, "fixed – free (case 1), e.g. foot mounting, free rod end"], pinpin: [1, "pinned – pinned (case 2), clevis at both ends"],
  fixpin: [0.7, "fixed – guided pinned (case 3), flange + guided rod eye"], fixfix: [0.5, "fixed – fixed (case 4), flange + guided rod end"] };
export const RHO = 870, NU = 46e-6, E_ST = 210000;
const up = (list, v) => list.find((x) => x >= v - 1e-9) ?? list[list.length - 1];
const A_cm2 = (d) => Math.PI / 4 * (d / 10) ** 2;      // cm² from mm
export const pipeD = (Qlpm, v) => 4.61 * Math.sqrt(Qlpm / v);      // mm
export const kWp = (pbar, Q, eta = 1) => pbar * Q / (600 * eta);

/** default system data */
export const SYS0 = { p: 10, loss: 15, etaCyl: 0.95, T: 60, etaTot: 0.85, etaV: 0.93, n: 1450, dpl: 1.0, Tamb: 25, Toil: 55, k: 12, supply: "auto", nGas: 1.4, ignorePump: true, Lp: 3, Lr: 3, Ls: 0.5, tankF: 3 };
// mh = hanging weight in kg (only with "vertical"): 0 → F itself is the lifted weight (rod up, load pressure F/A1 on the cap side);
//      > 0 → rod-down cylinder (press ram): F is a process force, the weight m hangs on the ROD side → load pressure m·g/A2
const L = (o) => Object.assign({ name: "Cylinder", type: "cyl", F: 20, s: 200, t0: 5, tExt: 2, tDw: 10, tRet: 2, Fret: 1, mount: "pinpin", vert: false, mh: 0, pred: 0, prop: false, T: 200, nm: 100, tRun: 10 }, o);
export const G = 9.81;
/** load-holding pressure of a vertical cylinder: { pL MPa, side, txt } */
export function holdP(ld, a) {
  if (ld.mh > 0) return { pL: ld.mh * G / (a.A2 * 1e-4) / 1e6, side: "rod", txt: `m·g / A2 = ${ld.mh} kg · 9.81 / ${a.A2.toFixed(2)} cm² (ram weight on the rod side, example)` };
  return { pL: ld.F * 1000 / (a.A1 * 1e-4) / 1e6, side: "cap", txt: "F / A1 (the force is the lifted weight)" };
}
/** cylinder standard by pressure */
export const cylStd = (p) => (p <= 16 + 1e-9 ? { std: "ISO 6020-2", rating: 16 } : p <= 25 + 1e-9 ? { std: "ISO 6022", rating: 25 } : { std: "special high-pressure cylinder", rating: 31.5 });
export const PRESETS = {
  guide: { title: "Guide 25 lift example", sys: {}, loads: [L({ name: "Lift cylinder", F: 20, s: 200, t0: 5, tExt: 2, tDw: 10, tRet: 2, Fret: 1, vert: true })] },
  apc: { title: "APC lift + zero-point release", sys: { p: 10, T: 40 }, loads: [L({ name: "APC lift (pallet + arm)", F: 15, s: 60, t0: 2, tExt: 0.8, tDw: 6, tRet: 0.8, Fret: 0.5, vert: true }), L({ name: "Zero-point release (4 modules, equiv. piston)", F: 30, s: 6, t0: 0.5, tExt: 0.8, tDw: 9, tRet: 0.8, Fret: 0.2, pred: 5, mount: "fixfix" })] },
  hmc: { title: "HMC rotary table clamp 5 MPa + tool unclamp", sys: { p: 10, T: 30 }, loads: [L({ name: "Table clamp ring (equiv. piston)", F: 35, s: 3, t0: 2, tExt: 0.5, tDw: 3, tRet: 0.5, Fret: 0.5, pred: 5, mount: "fixfix" }), L({ name: "Spindle tool unclamp", F: 15, s: 10, t0: 10, tExt: 0.4, tDw: 1.5, tRet: 0.4, Fret: 0.3, mount: "fixfix" })] },
  press: { title: "Press 200 kN", sys: { p: 21, T: 20 }, loads: [L({ name: "Press ram (vertical, ram + tool 800 kg example)", F: 200, s: 300, t0: 1, tExt: 4, tDw: 1, tRet: 2.5, Fret: 10, vert: true, mh: 800, mount: "fixpin", prop: true })] },
  motor: { title: "Hydraulic motor conveyor drive", sys: { p: 16, T: 60 }, loads: [L({ name: "Conveyor motor", type: "mot", T: 250, nm: 60, t0: 0, tRun: 50 })] },
};

/** cylinder: bore, rod, areas, buckling */
export function sizeCyl(ld, S, pairSel = 0) {
  const p = (ld.pred > 0 ? ld.pred : S.p) * (1 - S.loss / 100), F = ld.F * 1000;
  const Areq = F / (p * 1e6 * S.etaCyl) * 1e4;          // cm²
  const Dreq = Math.sqrt(4 * Areq / Math.PI) * 10;       // mm
  let D = up(SER.bore, Dreq), bi = SER.bore.indexOf(D), d = SER.pairs[D][pairSel], buck;
  const Lfull = 2 * ld.s + 150, K = MOUNT[ld.mount][0];
  const chk = (dd) => {
    const Lk = K * Lfull, I = Math.PI * dd ** 4 / 64, Ar = Math.PI / 4 * dd ** 2, lam = 4 * Lk / dd;
    const Fe = Math.PI ** 2 * E_ST * I / Lk ** 2, Ft = Math.min(355, 335 - 0.62 * lam) * Ar, lam0 = 85;
    const Fk = lam >= lam0 ? Fe : Math.min(Fe, Ft);
    return { Lk, I, lam, Fe, Ft, Fk, Fall: Fk / 3.5, ok: Fk / 3.5 >= F, rule: lam >= lam0 ? "Euler" : "Tetmajer" };
  };
  buck = chk(d); let steps = 0;
  while (!buck.ok && steps < 12) { // bigger rod of the same bore, then bigger bore
    const pr = SER.pairs[D]; if (d < pr[1]) d = pr[1]; else { bi = Math.min(SER.bore.length - 1, bi + 1); D = SER.bore[bi]; d = SER.pairs[D][pairSel]; }
    buck = chk(d); steps++;
  }
  const A1 = A_cm2(D), Ar = A_cm2(d), A2 = A1 - Ar;
  const pNeed = F / (A1 * 1e-4 * S.etaCyl) / 1e6, pRet = ld.Fret * 1000 / (A2 * 1e-4 * S.etaCyl) / 1e6;
  const vE = ld.s / 1000 / ld.tExt, vR = ld.s / 1000 / ld.tRet;
  return { kind: "cyl", p, Areq, Dreq, D, d, A1, Ar, A2, phi: A1 / A2, Lfull, K, buck, pNeed, pRet,
    vE, vR, QE: A1 * vE * 60 / 10, QR: A2 * vR * 60 / 10, QEout: A2 * vE * 6, QRout: A1 * vR * 6, VE: A1 * ld.s / 10000, VR: A2 * ld.s / 10000,
    pInt: (ld.pred > 0 ? ld.pred : S.p) * A1 / A2, Fmax: (ld.pred > 0 ? ld.pred : S.p) * 1e6 * A1 * 1e-4 * S.etaCyl / 1000, ...cylStd(ld.pred > 0 ? ld.pred : S.p) };
}
/** hydraulic motor */
export function sizeMot(ld, S) {
  const dp = S.p * (1 - S.loss / 100) - 0.5, etaHm = 0.9, etaV = 0.95;
  const Vreq = 2 * Math.PI * ld.T / (dp * 1e6 * etaHm) * 1e6; // cm³/rev
  const V = Vreq <= 400 ? up(SER.orbit, Vreq) : up(SER.radial, Vreq);
  const pNeed = 2 * Math.PI * ld.T / (V * 1e-6 * etaHm) / 1e6 + 0.5, Q = V * ld.nm / etaV / 1000;
  return { kind: "mot", dp, etaHm, etaV, Vreq, V, type: V <= 400 ? "orbit / gerotor (LSHT)" : "radial piston", pNeed, Q, Vol: Q * ld.tRun / 60, Pmech: 2 * Math.PI * ld.nm * ld.T / 60 / 1000 };
}

/** the full design */
export function design(loads, sys) {
  const S = Object.assign({}, SYS0, sys), T = S.T, R = { S, acts: [], warn: [] };
  // ---- actuators
  loads.forEach((ld, i) => {
    const a = ld.type === "mot" ? sizeMot(ld, S) : sizeCyl(ld, S);
    a.ld = ld; a.i = i; a.tag = (i + 1) + "A1";
    if (a.kind === "cyl") {
      a.seg = [[ld.t0, ld.t0 + ld.tExt, a.QE, a.pNeed + S.dpl, a.VE, ld.F * ld.s / 1000, "ext"], [ld.t0 + ld.tExt + ld.tDw, ld.t0 + ld.tExt + ld.tDw + ld.tRet, a.QR, a.pRet + S.dpl, a.VR, ld.Fret * ld.s / 1000, "ret"]];
      a.Qv = Math.max(a.QE, a.QR, a.QEout, a.QRout);
      if (!a.buck.ok) R.warn.push(`${ld.name}: buckling not OK even with the largest rod`);
      if (a.pInt > a.rating + 1e-9) R.warn.push(`${ld.name}: rod-side intensification p·A1/A2 = ${a.pInt.toFixed(1)} MPa > ${a.std} rating ${a.rating} MPa → no meter-out throttling while pressing, or a rod-side relief ≤ ${a.rating} MPa`);
      if (ld.vert && ld.mh > 0 && ld.Fret * 1000 < 1.1 * ld.mh * G) R.warn.push(`${ld.name}: return force ${ld.Fret} kN < 1.1 × ram weight ${(ld.mh * G / 1000).toFixed(1)} kN → the ram cannot be lifted reliably`);
    } else { a.seg = [[ld.t0, ld.t0 + ld.tRun, a.Q, a.pNeed + S.dpl, a.Vol, a.Pmech * ld.tRun, "run"]]; a.Qv = a.Q; }
    a.seg.forEach((s) => { if (s[1] > T + 1e-9) R.warn.push(`${ld.name}: movement ends at ${s[1].toFixed(1)} s > cycle ${T} s`); });
    R.acts.push(a);
  });
  // ---- duty cycle (piecewise constant, 0.01 s grid)
  const dt = 0.01, N = Math.round(T / dt), Qd = new Float64Array(N), Pd = new Float64Array(N), Wd = new Float64Array(N);
  R.acts.forEach((a) => a.seg.forEach(([t1, t2, Q, p, , Ew]) => { for (let k = Math.max(0, Math.round(t1 / dt)); k < Math.min(N, Math.round(t2 / dt)); k++) { Qd[k] += Q; Pd[k] = Math.max(Pd[k], p); Wd[k] += Ew / (t2 - t1); } }));
  let Qpk = 0, Vtot = 0, Euse = 0, tMove = 0; for (let k = 0; k < N; k++) { if (Qd[k] > Qpk) Qpk = Qd[k]; Vtot += Qd[k] / 60 * dt; Euse += Wd[k] * dt; if (Qd[k] > 0) tMove += dt; }
  const pmax = Math.max(...Pd, 0);
  R.duty = { dt, N, Qd, Pd, Qpk, Vtot, Qavg: Vtot / T * 60, pmax, Euse, tMove, ratio: Qpk / Math.max(1e-9, Vtot / T * 60) };
  // ---- supply options: hydraulic energy per cycle + power profile
  const eta = S.etaTot, pu = 0.3; // unloaded pump pressure (MPa)
  const pumpOf = (Q, kind) => { const list = kind === "piston" ? SER.piston : Q * 1000 / (S.n * S.etaV) > 50 ? SER.vane : SER.gear; const Vg = Q * 1000 / (S.n * S.etaV); const V = up(list, Vg); return { Qreq: Q, Vg, V, Q: V * S.n * S.etaV / 1000, list: kind === "piston" ? "axial piston variable" : list === SER.vane ? "vane" : "gear" }; };
  const prof = (fn) => { const P = new Float64Array(N); let E = 0, E2 = 0, Pk = 0; for (let k = 0; k < N; k++) { P[k] = fn(k); E += P[k] * dt; E2 += P[k] * P[k] * dt; if (P[k] > Pk) Pk = P[k]; } return { P, E, Pavg: E / T, Prms: Math.sqrt(E2 / T), Pk }; };
  // A fixed pump for the peak, tandem centre / unloading in the pauses; part flow over the relief
  const pA = pumpOf(Qpk, "gear");
  const A = prof((k) => (Qd[k] > 0 ? (Pd[k] * 10 * Qd[k] + S.p * 10 * Math.max(0, pA.Q - Qd[k])) / 600 : pu * 10 * pA.Q / 600) / eta);
  // B variable pump (pressure compensated at p_sys) – flow on demand, standby leakage 1 L/min at p_sys
  const pB = pumpOf(Qpk, "piston");
  const B = prof((k) => (S.p * 10 * (Qd[k] + 1) / 600) / eta);
  // C pump + accumulator (pump charges p1 → p2, unloads in between)
  const p1 = pmax, p2 = S.p, nG = S.nGas, p1a = p1 + 0.1, p2a = p2 + 0.1, p0a = 0.9 * p1a;
  let QpC = Math.max(Vtot / (T * 0.8) * 60, 0.5); let pC = pumpOf(QpC, "gear");
  // oil the accumulator must give: max deficit over the cycle (pump flow ignored if S.ignorePump: safe, = guide 25)
  let def = 0, run = 0;
  for (let k = 0; k < N; k++) { if (Qd[k] > 0) { run = Math.max(0, run + (Qd[k] - (S.ignorePump ? 0 : pC.Q)) / 60 * dt); if (run > def) def = run; } else run = 0; }
  const dV = def;
  const fac = (n_) => Math.pow(p0a / p1a, 1 / n_) - Math.pow(p0a / p2a, 1 / n_);
  const V0 = dV / fac(nG), V0iso = dV / fac(1), Vacc = up(SER.acc, V0);
  const tCharge = Vtot / pC.Q * 60;  // s per cycle the pump charges
  const pAvgC = (p1 + p2) / 2;
  const C = prof((k) => { const tk = k * dt, on = tk < tCharge; return (on ? pAvgC * 10 * pC.Q / 600 : pu * 10 * pC.Q / 600) / eta; });
  const pkC = p2 * 10 * pC.Q / 600 / eta;
  R.acc = { p1, p2, p1a, p2a, p0a, p0g: p0a - 0.1, n: nG, dV, fac: fac(nG), facIso: fac(1), V0, V0iso, Vacc, tCharge, pumpQ: pC.Q, refill: tCharge <= T - R.duty.tMove + 1e-9 || tCharge < T };
  const opt = [
    { k: "fixed", l: "fixed pump (peak flow) + tandem centre / unloading", pump: pA, ...A, Pk: Math.max(A.Pk, S.p * 10 * pA.Q / 600 / eta), Psize: 0 },
    { k: "var", l: "variable pump (pressure compensator)", pump: pB, ...B, Pk: Math.max(B.Pk, S.p * 10 * pB.Q / 600 / eta), Psize: 0 },
    { k: "acc", l: "small pump + accumulator + unloading", pump: pC, ...C, Pk: pkC, Psize: 0 },
  ];
  opt.forEach((o) => { o.Psize = Math.max(o.Prms, o.Pk / 1.5); o.kw = up(SER.kw, o.Psize); o.Eloss = o.E - Euse; });
  let pick = S.supply;
  if (pick === "auto") { pick = R.duty.ratio >= 3 && V0 <= 20 && R.duty.tMove < 0.5 * T ? "acc" : R.acts.length > 1 || R.duty.ratio >= 1.5 ? "var" : "fixed"; }
  R.opt = opt; R.sup = opt.find((o) => o.k === pick); R.pick = pick;
  R.whyPick = pick === "acc" ? `peak/average flow = ${R.duty.ratio.toFixed(1)} ≥ 3 and movements take only ${(R.duty.tMove / T * 100).toFixed(0)} % of the cycle → small pump + accumulator`
    : pick === "var" ? `several actuators / changing flow (peak/average ${R.duty.ratio.toFixed(1)}) → variable pump gives only the flow needed` : `nearly continuous flow (peak/average ${R.duty.ratio.toFixed(1)}) → simple fixed pump`;
  if (S.supply !== "auto") R.whyPick = "chosen by the user";
  // ---- pump + motor of the chosen supply
  const sp = R.sup; R.pump = sp.pump; R.motorKW = sp.kw; R.Ppk = sp.Pk; R.Prms = sp.Prms;
  R.Qsup = pick === "acc" ? Qpk : sp.pump.Q;   // flow in the pressure line to the valves (accumulator gives the peak)
  // ---- valves
  R.valves = R.acts.map((a) => { const ng = SER.ng.find((g) => g[1] >= a.Qv) || SER.ng[SER.ng.length - 1]; return { a, ng: ng[0], Qmax: ng[1], dp: 0.5 * (a.Qv / ng[2]) ** 2 }; });
  // ---- settings
  R.relief = S.p; R.reliefMin = 1.1 * pmax;
  R.ratingMin = Math.min(...R.acts.filter((a) => a.kind === "cyl").map((a) => a.rating), 99);
  if (R.relief < R.reliefMin) R.warn.push(`relief ${S.p} MPa < 1.1 × highest working pressure ${pmax.toFixed(2)} MPa → raise p_sys`);
  // accumulator: the relief must stay closed until the pump unloads at cut-out → relief ≥ 1.1 × cut-out (rounded up to 0.5 MPa)
  if (pick === "acc") R.relief = Math.max(R.relief, Math.ceil(1.1 * S.p * 2 - 1e-9) / 2);
  R.settings = [];
  R.acts.forEach((a) => {
    const ld = a.ld;
    if (ld.pred > 0) R.settings.push([`${a.tag} pressure reducing valve`, `${ld.pred} MPa`, "reduced branch (clamp); drain free to the tank"]);
    if (a.kind === "cyl" && ld.vert) {
      const h = holdP(ld, a), pL = h.pL; a.pL = pL; a.holdSide = h.side;
      R.settings.push([`${a.tag} counterbalance valve (${h.side}-side line, on the cylinder)`, `${(1.3 * pL).toFixed(1)} MPa, pilot ratio 3:1`, `1.3 × load pressure ${pL.toFixed(2)} MPa = ${h.txt}`]);
      R.settings.push([`${a.tag} or pilot-operated check (clamp, slow)`, `ratio 3:1 → opens at ${(pL / 3).toFixed(2)} MPa`, "p_L / k, float centre"]);
      R.settings.push([`${a.tag} speed with the counterbalance valve`, "pump flow or meter-in throttle", "no meter-out throttle in series with the counterbalance valve (unstable lowering)"]);
    }
    if (a.kind === "cyl") R.settings.push([`${a.tag} rod side rating`, `≥ ${a.pInt.toFixed(1)} MPa (${a.std}: ${a.rating} MPa${a.pInt > a.rating + 1e-9 ? " – EXCEEDED, see warning" : ""})`, "intensification p·A1/A2 (meter-out)"]);
  });
  if (pick === "acc") {
    R.settings.push(["accumulator pressure switch", `cut-out ${p2} MPa / cut-in ${(p1 + 0.3).toFixed(1)} MPa`, "pre-charge p0 = " + (p0a - 0.1).toFixed(2) + " MPa (0.9·p1 abs)"]);
    R.settings.push(["relief valve 0V1 (accumulator option)", `${R.relief} MPa`, `≥ 1.1 × cut-out ${p2} MPa – else the relief opens before the pump unloads and heats the oil`]);
    R.settings.push(["PLC charging logic", `recharge to cut-out ${p2} MPa after every movement`, "start the next movement only when the accumulator pressure is back near cut-out – a plain cut-in/cut-out switch can leave too little oil for the next stroke"]);
  }
  if (pick === "var") R.settings.push(["pump compensator", `${S.p} MPa (relief ${(S.p + 1).toFixed(0)} MPa)`, "relief 1–1.5 MPa above the compensator = safety only"]);
  // ---- pipes
  const Qret = Math.max(...R.acts.map((a) => (a.kind === "cyl" ? Math.max(a.QEout, a.QRout) : a.Q)), R.pump.Q);
  const line = (name, Q, v, Lm, p) => {
    const dreq = pipeD(Q, v), ok = SER.tube.find(([od, t]) => od - 2 * t >= dreq - 1e-9 && p * od / (2 * t) <= 60), tb = ok || SER.tube[SER.tube.length - 1];
    if (!ok) R.warn.push(`${name} line: no tube of the list has ID ≥ ${dreq.toFixed(1)} mm with σ ≤ 60 MPa at ${p} MPa → fallback ${tb[0]}×${tb[1]} – choose a tube from the maker's pressure table (or E355 with a higher allowed stress)`);
    const id = tb[0] - 2 * tb[1], vel = Q / 60000 / (Math.PI / 4 * (id / 1000) ** 2), Re = vel * id / 1000 / NU, lam = Re < 2300 ? 64 / Re : 0.316 / Math.pow(Re, 0.25);
    const dp = lam * (Lm / (id / 1000)) * RHO * vel ** 2 / 2 / 1e6, hose = up(SER.hose, dreq);
    return { name, Q, v, dreq, tube: tb, id, vel, Re, lam, dp, sig: p * tb[0] / (2 * tb[1]), hose, L: Lm, fallback: !ok };
  };
  R.lines = [line("pressure", R.Qsup, 4, S.Lp, S.p), line("return", Qret, 2.5, S.Lr, 1), line("suction", R.pump.Q, 0.8, S.Ls, 0.1)];
  // ---- heat, tank, cooler
  R.heat = { Ploss: sp.Eloss / T, Eloss: sp.Eloss };
  const oilAct = R.acts.reduce((s_, a) => s_ + (a.kind === "cyl" ? a.Ar * a.ld.s / 10000 : 0), 0);
  const Vt0 = Math.max(S.tankF * R.pump.Q, 1.3 * (oilAct + (pick === "acc" ? dV : 0)) + 8);
  R.tank = { Vreq: Vt0, V: up(SER.tank, Vt0), oilAct };
  R.tank.A = 0.065 * Math.pow(R.tank.V, 2 / 3); R.tank.dT = S.Toil - S.Tamb; R.tank.Pcool = S.k * R.tank.A * R.tank.dT / 1000;
  R.cooler = Math.max(0, R.heat.Ploss - R.tank.Pcool); R.coolerKW = R.cooler > 0 ? Math.ceil(R.cooler * 1.25 * 10) / 10 : 0;
  // ---- filter
  const prop = loads.some((l) => l.prop);
  R.filter = prop ? { iso: "16/14/11", pf: "pressure filter 5 µm, β5(c) ≥ 1000 before the proportional valve", rf: "return filter 10 µm, β10(c) ≥ 200" } : { iso: "18/16/13", pf: "no pressure filter needed (standard valves); option 10 µm before the valve stack", rf: "return filter 10 µm, β10(c) ≥ 200" };
  R.filter.Q = Qret; R.filter.size = Math.ceil(Qret * 2 / 10) * 10;
  return R;
}

/** parts list rows: [tag, element, data (example), standard / note, qty] */
export function bom(R) {
  const S = R.S, sp = R.sup, rows = [];
  rows.push(["0Z0", "Tank (steel, baffle, sight glass, breather 3 µm, drain plug, clean-out cover)", `${R.tank.V} L (≥ ${R.tank.Vreq.toFixed(0)} L)`, "ISO 4413; oil HLP 46 (DIN 51524-2)", 1]);
  rows.push(["0P1", `Pump – ${sp.pump.list}`, `${sp.pump.V} cm³/rev → ${sp.pump.Q.toFixed(1)} L/min at ${S.n} rpm (η_v ${S.etaV})`, R.pick === "var" ? `pressure compensator ${S.p} MPa, case drain to tank` : `max ≥ ${S.p} MPa`, 1]);
  rows.push(["0M1", "Electric motor IEC, 4-pole, B35/B5", `${R.motorKW} kW (RMS ${R.Prms.toFixed(2)} kW, peak ${R.Ppk.toFixed(2)} kW)`, "IE3, 400 V 50 Hz; bell housing + coupling", 1]);
  rows.push(["0V1", "Pressure relief valve (pilot operated)", `${R.relief} MPa, NG by pump flow`, "seal + label setting", 1]);
  rows.push(["0Z1", "Return filter with clogging indicator", `${R.filter.size} L/min size (return flow ${R.filter.Q.toFixed(1)} L/min × 2), 10 µm β ≥ 200`, `target ISO 4406 ${R.filter.iso}`, 1]);
  if (R.filter.iso === "16/14/11") rows.push(["0Z2", "Pressure filter", "5 µm β ≥ 1000, no bypass", "before the proportional valve", 1]);
  rows.push(["0S1/0B1", "Level + temperature switch, thermometer, pressure gauge + test points", "gauge 0–" + (S.p * 1.6).toFixed(0) + " MPa class 1.6", "ISO 15171 test points", 1]);
  if (R.pick === "acc") {
    rows.push(["0Z3", "Bladder accumulator", `${R.acc.Vacc} L, p0 = ${R.acc.p0g.toFixed(2)} MPa N₂, max ≥ ${S.p} MPa`, "PED 2014/68/EU, safety + shut-off block with relief + discharge", 1]);
    rows.push(["0V2/0S2", "Unloading valve + check valve + pressure switch", `cut-out ${S.p} / cut-in ${(R.acc.p1 + 0.3).toFixed(1)} MPa`, "NG6", 1]);
  }
  if (R.coolerKW > 0) rows.push(["0E1", "Oil cooler (air, with thermostat)", `${R.coolerKW} kW at ΔT ${R.tank.dT} K`, "in the return line, bypass check 0.3 MPa", 1]);
  R.valves.forEach((v) => {
    const a = v.a, ld = a.ld, n = a.i + 1;
    rows.push([`${n}V1`, `Directional valve 4/3 solenoid ${ld.prop ? "(proportional)" : ""}`, `${v.ng}, Q ${a.Qv.toFixed(1)} L/min, Δp ≈ ${v.dp.toFixed(2)} MPa per path, 24 V DC`, ld.vert ? "float centre (A, B → T) for the holding valve" : R.pick === "fixed" ? "tandem centre (unloads the fixed pump)" : "closed centre", 1]);
    if (ld.pred > 0) rows.push([`${n}V2`, "Pressure reducing valve (sandwich)", `${ld.pred} MPa`, "+ pressure switch 'clamped' to the PLC", 1]);
    if (a.kind === "cyl" && ld.vert) rows.push([`${n}V3`, `Counterbalance valve (on the cylinder ${a.holdSide} port)`, `${(1.3 * a.pL).toFixed(1)} MPa, ratio 3:1 (load ${a.pL.toFixed(2)} MPa)`, "hose-burst protection", 1]);
    if (a.kind === "cyl" && ld.vert) rows.push([`${n}V4`, "Throttle check valve – meter-IN (supply line of the lowering side) / speed by pump flow", `${v.ng}`, "with the counterbalance valve: no meter-out throttle in series (unstable lowering)", 1]);
    else rows.push([`${n}V4`, "Throttle check valve (meter-out) / flow control", `${v.ng}`, "speed setting", 1]);
    if (a.kind === "cyl") rows.push([a.tag, `Cylinder ${ld.name}`, `Ø${a.D}/${a.d} × ${ld.s} mm, A1 ${a.A1.toFixed(2)} cm², A2 ${a.A2.toFixed(2)} cm², ${MOUNT[ld.mount][1].split(",")[0]}`, `${a.std} (${a.rating} MPa); end cushions; rod side ≥ ${a.pInt.toFixed(1)} MPa${a.pInt > a.rating + 1e-9 ? " – exceeds the rating: rod-side relief / no meter-out throttling" : ""}`, 1]);
    else rows.push([a.tag, `Hydraulic motor ${ld.name}`, `${a.V} cm³/rev ${a.type}, ${ld.nm} rpm, ${ld.T} N·m`, "+ spring brake if the load must be held", 1]);
  });
  R.lines.forEach((l) => rows.push(["—", `${l.name} line`, `tube ${l.tube[0]}×${l.tube[1]} (ID ${l.id}) or hose DN ${l.hose}, v = ${l.vel.toFixed(2)} m/s, Δp ${l.dp.toFixed(3)} MPa over ${l.L} m`, l.name === "pressure" ? "EN 10305-4 E235/E355, ISO 8434-1 fittings, hose EN 853 2SN" : "EN 853 / ISO 18752", 1]));
  rows.push(["—", "Hydraulic oil HLP 46", `${Math.ceil(R.tank.V * 1.15)} L (tank + lines + flushing)`, `flush to ${R.filter.iso} before start-up`, 1]);
  return rows;
}

/** self-check numbers for &hctest (preset "guide" must equal docs/25) */
export function selfTest() {
  const out = [], P = PRESETS.guide, R = design(P.loads, P.sys), a = R.acts[0], acc = R.acc;
  out.push(`size guide: Areq=${a.Areq.toFixed(2)}cm2 (25: 24.8) Dreq=${a.Dreq.toFixed(1)} → Ø${a.D}/${a.d} A1=${a.A1.toFixed(2)} A2=${a.A2.toFixed(2)} (31.2/21.0) pNeed=${a.pNeed.toFixed(2)}MPa (6.75)`);
  out.push(`size guide: QE=${a.QE.toFixed(1)} QR=${a.QR.toFixed(1)} L/min (18.7/12.6) VE=${a.VE.toFixed(3)} VR=${a.VR.toFixed(3)} L (0.62/0.42) Qavg=${R.duty.Qavg.toFixed(2)} (1.04) peak=${R.duty.Qpk.toFixed(1)}`);
  out.push(`size guide: buckling Lk=${a.buck.Lk.toFixed(0)}mm λ=${a.buck.lam.toFixed(1)} Fe=${(a.buck.Fe / 1000).toFixed(0)}kN Ft=${(a.buck.Ft / 1000).toFixed(0)}kN Fk=${(a.buck.Fk / 1000).toFixed(0)} allow=${(a.buck.Fall / 1000).toFixed(0)}kN rule=${a.buck.rule} | hand Euler π²·210000·(π·36⁴/64)/550² = ${(Math.PI ** 2 * 210000 * Math.PI * 36 ** 4 / 64 / 550 ** 2 / 1000).toFixed(0)}kN`);
  out.push(`size guide: acc p1=${acc.p1.toFixed(2)} p0abs=${acc.p0a.toFixed(2)} fac=${acc.fac.toFixed(4)} (0.149) V0=${acc.V0.toFixed(2)}L (4.2) iso=${acc.V0iso.toFixed(2)} (3.2) → ${acc.Vacc} L`);
  out.push(`size guide: options ` + R.opt.map((o) => `${o.k}: pump ${o.pump.V}cc ${o.pump.Q.toFixed(1)}L/min Pk=${o.Pk.toFixed(2)} Prms=${o.Prms.toFixed(2)} Pavg=${o.Pavg.toFixed(3)} → ${o.kw}kW`).join(" | ") + ` | pick=${R.pick}`);
  out.push(`size guide: hand fixed 78 bar·18.7/510=${(78 * 18.7 / 510).toFixed(2)}kW (25: 2.9) | lines ` + R.lines.map((l) => `${l.name} d=${l.dreq.toFixed(1)} tube ${l.tube[0]}x${l.tube[1]} v=${l.vel.toFixed(2)} Re=${l.Re.toFixed(0)} dp=${l.dp.toFixed(3)} σ=${l.sig.toFixed(0)}`).join(" | "));
  out.push(`size guide: valve ${R.valves[0].ng} dp=${R.valves[0].dp.toFixed(3)} | tank ${R.tank.V}L A=${R.tank.A.toFixed(2)}m2 Pcool=${R.tank.Pcool.toFixed(2)}kW loss=${R.heat.Ploss.toFixed(3)}kW cooler=${R.coolerKW} | filter ${R.filter.iso}`);
  { // fixes E3/E4/E5/E10 (guide 30 §26)
    const P2 = PRESETS.press, r = design(P2.loads, P2.sys), x = r.acts[0], cb = r.settings.find((s) => /counterbalance valve/.test(s[0]));
    out.push(`size fix E3 press CBV: ${cb ? cb[1] : "-"} from ram ${P2.loads[0].mh} kg → p_L=${x.pL.toFixed(2)} MPa (hand ${(P2.loads[0].mh * G / (x.A2 * 1e-4) / 1e6).toFixed(2)}; before: 21.2 MPa from the press force) side=${x.holdSide} | guide CBV p_L=${a.pL.toFixed(2)} side=${a.holdSide} (6.42 cap)`);
    out.push(`size fix E4: guide ${a.std} ${a.rating} MPa pInt=${a.pInt.toFixed(1)} | press ${x.std} ${x.rating} MPa pInt=${x.pInt.toFixed(1)} warn=${r.warn.some((w) => /intensification/.test(w))}`);
    out.push(`size fix E5: press lines ` + r.lines.map((l) => `${l.name} ${l.tube[0]}x${l.tube[1]} ID${l.id} v=${l.vel.toFixed(2)} σ=${l.sig.toFixed(0)} fallback=${l.fallback}`).join(" | ") + ` (before: pressure 50x5 σ105 silent fallback)`);
    const b4 = bom(r).find((row) => row[0] === "1V4"), g4 = bom(R).find((row) => row[0] === "1V4"), c1 = bom(r).find((row) => row[0] === "1A1");
    out.push(`size fix E10: press 1V4 "${b4[1]}" | guide 1V4 "${g4[1]}" | E4 press cylinder "${c1[3].split(";")[0]}"`);
  }
  Object.entries(PRESETS).forEach(([k, p]) => { const r = design(p.loads, p.sys); out.push(`size ${k}: ` + r.acts.map((x) => (x.kind === "cyl" ? `Ø${x.D}/${x.d} p=${x.pNeed.toFixed(2)} Q=${x.QE.toFixed(1)}/${x.QR.toFixed(1)} buck=${x.buck.ok}` : `${x.V}cc Q=${x.Q.toFixed(1)} p=${x.pNeed.toFixed(2)}`)).join(" ; ") + ` peak=${r.duty.Qpk.toFixed(1)} avg=${r.duty.Qavg.toFixed(2)} pick=${r.pick} pump=${r.pump.V}cc motor=${r.motorKW}kW acc=${r.pick === "acc" ? r.acc.Vacc + "L" : "-"} tank=${r.tank.V} cooler=${r.coolerKW} warn=${r.warn.length}`); });
  return out;
}
