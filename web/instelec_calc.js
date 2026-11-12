/* INSTALLATION tab – items 3 + 4: CALCULATIONS (pure math, no DOM). Used by instelec_i3.js, instelec_i4.js and the self-check (&ietest).
 * All values are EXAMPLES for teaching (typical catalogue / table values). The real design is made and signed by a qualified
 * electrician / electrical designer with the real cable tables (IEC 60364-5-52 + national annex), the breaker maker's curves
 * and selectivity tables, the machine maker's installation manual and measured network data.
 * Guide: docs/27_installation_electrical_emc.md (worked numbers of every formula).
 */
export const SQ3 = Math.sqrt(3);
export const U = 400, U0 = 230.94;       // V line-line, V line-earth (400/√3)
export const MU0 = 4e-7 * Math.PI;       // H/m
const r = (v, d = 2) => +(+v).toFixed(d);

/* ------------------------------------------------------------------ tables (IEC 60364-5-52 Annex B, copper, 3 loaded conductors, 30 °C air) */
export const SIZES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300];
export const R20 = [12.1, 7.41, 4.61, 3.08, 1.83, 1.15, 0.727, 0.524, 0.387, 0.268, 0.193, 0.153, 0.124, 0.0991, 0.0754, 0.0601]; // Ω/km, IEC 60228 class 2 Cu
export const XKM = 0.08;                 // Ω/km reactance of a multi-core cable (typical 0.07–0.09)
export const AMP = {
  XLPE: { E: [23, 32, 42, 54, 75, 100, 127, 158, 192, 246, 298, 346, 399, 456, 538, 621],      // Table B.52.12 (method E, multi-core in free air / perforated tray)
          C: [24, 33, 45, 58, 80, 107, 138, 171, 209, 269, 328, 382, 441, 506, 599, 693] },    // Table B.52.5 (method C, clipped on wall / unperforated tray)
  PVC:  { E: [18.5, 25, 34, 43, 60, 80, 101, 126, 153, 196, 238, 276, 319, 364, 430, 497],     // Table B.52.10
          C: [17.5, 24, 32, 41, 57, 76, 96, 119, 144, 184, 223, 259, 299, 341, 403, 464] },    // Table B.52.4
};
export const TAMB = [20, 25, 30, 35, 40, 45, 50];
export const KTEMP = { XLPE: [1.08, 1.04, 1.00, 0.96, 0.91, 0.87, 0.82], PVC: [1.12, 1.06, 1.00, 0.94, 0.87, 0.79, 0.71] };  // Table B.52.14
// Table B.52.17: single layer, touching. E = item 4 (perforated tray), C = item 3 (wall / unperforated tray). n = 1..9 (no further reduction above 9)
export const KGROUP = { E: [1.00, 0.88, 0.82, 0.77, 0.75, 0.73, 0.73, 0.72, 0.72], C: [1.00, 0.85, 0.79, 0.75, 0.73, 0.72, 0.72, 0.71, 0.70] };
export const THOT = { XLPE: 90, PVC: 70 };                     // °C max conductor temperature
export const kHot = (ins) => 1 + 0.00393 * (THOT[ins] - 20);   // R(θ) / R(20 °C): XLPE 1.275, PVC 1.197
export const STD_IN = [16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000];
export const BUS_RATINGS = [160, 250, 400, 630, 800, 1000];
export const BUS = { R: 0.27, X: 0.10, RPE: 0.40 };           // mΩ/m per phase / PE (housing) of a 250 A busbar trunking (example – maker's data sheet)
export const TRAFO = { 630: 6.5, 800: 8.4, 1000: 10.5, 1250: 13.5, 1600: 17.0 };   // kVA → load loss Pk in kW (oil type, example)

export const pickIn = (I) => STD_IN.find((x) => x >= I - 1e-9) || STD_IN[STD_IN.length - 1];
export const peSize = (S) => (S <= 16 ? S : S <= 35 ? 16 : SIZES.find((x) => x >= S / 2 - 1e-9));  // IEC 60364-5-54 Table 54.2 (same material)
export function kTemp(ins, t) { const i = TAMB.indexOf(+t); if (i >= 0) return KTEMP[ins][i]; let j = TAMB.findIndex((x) => x > t); if (j <= 0) j = j < 0 ? TAMB.length - 1 : 1; const a = TAMB[j - 1], b = TAMB[j]; return KTEMP[ins][j - 1] + (KTEMP[ins][j] - KTEMP[ins][j - 1]) * (t - a) / (b - a); }
export const kGroup = (m, n) => KGROUP[m][Math.min(9, Math.max(1, n)) - 1];

/* ------------------------------------------------------------------ the line (example data – same machines as config/factory.json) */
// S = connected load kVA (machine name plate), P = typical running power kW (factory.json run_power_kw), cos = displacement factor,
// L = cable route length from the sub-distribution in m (tray route incl. rises), trafo = machine has an input transformer (inrush)
export const LOADS = [
  { id: "HMC-01", n: "HMC-01 crankcase machining center", S: 45, P: 18, cos: 0.92, L: 25, drive: true },
  { id: "HMC-02", n: "HMC-02 crankcase machining center", S: 45, P: 18, cos: 0.92, L: 20, drive: true },
  { id: "HMC-03", n: "HMC-03 crankcase machining center", S: 45, P: 18, cos: 0.92, L: 15, drive: true },
  { id: "VMC-01", n: "VMC-01 cylinder boring center", S: 30, P: 11, cos: 0.92, L: 22, drive: true },
  { id: "WASH-01", n: "WASH-01 crankcase washer (heaters + pumps)", S: 30, P: 12, cos: 0.95, L: 20, drive: false },
  { id: "ROB-C1", n: "Robot cell (controller 7.5 kVA + conveyors)", S: 10, P: 3.5, cos: 0.95, L: 28, drive: true },
  { id: "PPS-1", n: "Pallet pool PPS-1 + load station + chip conveyors", S: 8, P: 2.6, cos: 0.85, L: 18, drive: false },
];
export const COMP = { id: "COMP-1", n: "Screw compressor 22 kW with VSD (compressor room)", S: 30, P: 18, cos: 0.95, L: 35, drive: true };

export const DEF = {
  trafoS: 1000, uk: 6, SkQ: 500,         // kVA, %, MVA (MV network short-circuit power at the transformer – ask the utility)
  feedType: "cable", feedL: 60, feedN: 3, // MDB → SD-ML1, number of cables grouped on the feeder tray
  method: "E", ins: "XLPE", tAmb: 35, nGroup: 7, ks: 0.6, dUmax: 4, minA: 2.5,
  trafoMach: false,                      // machines with an input transformer (e.g. 400/200 V) → high inrush
  feedTrip: "LSI",                       // feeder breaker trip unit: LSI = electronic with short-time delay, TM = thermal-magnetic
  cmax: 1.05, cmin: 0.95,                // IEC 60909 voltage factors for LV (+6 % tolerance)
};

/* ------------------------------------------------------------------ impedances in mΩ */
export function source(p) {
  const S = p.trafoS * 1e3, Uv = U;
  const ZQ = 1.1 * Uv * Uv / (p.SkQ * 1e6) * 1e3, XQ = 0.995 * ZQ, RQ = 0.1 * XQ;
  const Pk = (TRAFO[p.trafoS] || 10.5) * 1e3;
  const ZT = p.uk / 100 * Uv * Uv / S * 1e3, RT = Pk * Uv * Uv / (S * S) * 1e3, XT = Math.sqrt(ZT * ZT - RT * RT);
  const InT = S / (SQ3 * Uv);
  return { ZQ, XQ, RQ, ZT, RT, XT, Pk, InT, R: RQ + RT, X: XQ + XT,
    // single-phase loop of the source with a Dyn transformer: (2·Z1 + Z0)/3 → MV part 2/3·Z_Q (no zero sequence), transformer Z0 ≈ Z1 → Z_T
    RL: 2 / 3 * RQ + RT, XL: 2 / 3 * XQ + XT };
}
export const zabs = (R, X) => Math.sqrt(R * R + X * X);
export function ik3(R, X, c = DEF.cmax) { return c * U / (SQ3 * zabs(R, X) / 1e3); }        // A
export function ik1(R, X, c = DEF.cmin) { return c * U0 / (zabs(R, X) / 1e3); }             // A
// voltage drop in % : ΔU% = √3·I·L·(R cosφ + X sinφ)/U·100, R hot in Ω/km, L in m
export function dU3(I, Lm, A, cos, ins, n = 1) {
  const i = SIZES.indexOf(A), R = R20[i] * kHot(ins) / n, X = XKM / n, sin = Math.sqrt(1 - cos * cos);
  return SQ3 * I * (Lm / 1000) * (R * cos + X * sin) / U * 100;
}

/* ------------------------------------------------------------------ breaker model */
// type: "MCB-C" (Im 5–10 In), "MCB-D" (10–20 In), "MCCB" (Im set, tolerance ±20 %). Ia = current that surely trips instantaneously.
export function breaker(In, trafoMach) {
  if (In <= 63) { const D = !!trafoMach; return { type: D ? "MCB-D" : "MCB-C", In, ImLow: (D ? 10 : 5) * In, Ia: (D ? 20 : 10) * In, txt: `MCB ${D ? "D" : "C"}${In}` }; }
  const k = trafoMach ? 14 : 10, Im = k * In;
  return { type: "MCCB", In, Im, k, ImLow: 0.8 * Im, Ia: 1.2 * Im, txt: `MCCB ${In} A, Im = ${k}·In = ${Im} A` };
}

/* ------------------------------------------------------------------ smallest cable for current (+ ΔU + disconnection) */
function sizeCable(o) {
  // o: { In, f, ins, method, minA, dUfun(A) → %, dUlim, discFun(A) → ok }
  const tab = AMP[o.ins][o.method];
  let by = "current", i0 = -1;
  for (let i = 0; i < SIZES.length; i++) {
    const A = SIZES[i]; if (A < o.minA) continue;
    const Iz = tab[i] * o.f;
    if (Iz < o.In) continue;
    if (i0 < 0) i0 = i;
    if (o.dUfun && o.dUfun(A) > o.dUlim) { by = "voltage drop"; continue; }
    if (o.discFun && !o.discFun(A)) { by = "disconnection (loop)"; continue; }
    if (i === i0) by = i0 > 0 && SIZES[i0] === o.minA && tab[i0 - 1] * o.f >= o.In ? "minimum size rule" : "current";
    return { A, Itab: tab[i], Iz: r(Iz, 1), by };
  }
  return { A: 300, Itab: tab[15], Iz: r(tab[15] * o.f, 1), by: "max size (use parallel cables / busbar)" };
}

/* ------------------------------------------------------------------ whole line */
export function calcLine(pIn = {}, lens = {}) {
  const p = { ...DEF, ...pIn };
  const src = source(p);
  const out = { p, src };
  out.mdb = { R: src.R, X: src.X, Ik3: ik3(src.R, src.X), RL: src.RL, XL: src.XL };
  /* line load with simultaneity factor */
  const loads = LOADS.map((l) => ({ ...l, L: lens[l.id] != null ? +lens[l.id] : l.L }));
  const Sconn = loads.reduce((a, l) => a + l.S, 0), Prun = loads.reduce((a, l) => a + l.P, 0);
  const Sd = p.ks * Sconn, Ib = Sd * 1e3 / (SQ3 * U), In = pickIn(Ib);
  const Srun = loads.reduce((a, l) => a + l.P / l.cos, 0);
  out.line = { Sconn, Prun, Srun: r(Srun, 1), Sd: r(Sd, 1), Ib: r(Ib, 1), In, IbRun: r(Srun * 1e3 / (SQ3 * U), 1), cos: 0.92 };
  /* feeder MDB → SD-ML1 */
  const fd = { type: p.feedType, L: p.feedL, In };
  const ktf = kTemp(p.ins, p.tAmb);
  if (p.feedType === "bus") {
    const kb = p.tAmb <= 35 ? 1 : Math.max(0.8, 1 - 0.01 * (p.tAmb - 35));        // example derating above 35 °C
    fd.rating = BUS_RATINGS.find((x) => x * kb >= In) || BUS_RATINGS[BUS_RATINGS.length - 1];
    fd.Iz = r(fd.rating * kb, 0); fd.kb = kb;
    fd.R20 = BUS.R / 1.2 * p.feedL; fd.Rh = BUS.R * p.feedL; fd.X = BUS.X * p.feedL; fd.RPE = BUS.RPE * p.feedL;    // mΩ (data sheet R is at operating temperature)
    const sin = Math.sqrt(1 - 0.92 * 0.92);
    fd.dU = SQ3 * Ib * (fd.Rh / 1e3 * 0.92 + fd.X / 1e3 * sin) / U * 100;
    fd.txt = `busbar trunking ${fd.rating} A (Al, example), ${p.feedL} m`;
  } else {
    const f = ktf * kGroup(p.method, p.feedN);
    const c = sizeCable({ In, f, ins: p.ins, method: p.method, minA: 16, dUfun: (A) => dU3(Ib, p.feedL, A, 0.92, p.ins), dUlim: p.dUmax * 0.5 });
    Object.assign(fd, c, { f: r(f, 3), PE: peSize(c.A) });
    const i = SIZES.indexOf(c.A), ip = SIZES.indexOf(fd.PE);
    fd.R20 = R20[i] * p.feedL; fd.Rh = fd.R20 * kHot(p.ins); fd.X = XKM * p.feedL; fd.RPE = R20[ip] * p.feedL * kHot(p.ins);
    fd.dU = dU3(Ib, p.feedL, c.A, 0.92, p.ins);
    fd.txt = `${c.A <= 35 ? "5G" + c.A : "4×" + c.A + "+" + fd.PE} Cu ${p.ins}, ${p.feedL} m`;
  }
  fd.brk = { type: p.feedTrip === "LSI" ? "MCCB electronic LSI" : "MCCB thermal-magnetic", In, Isd: 10 * In, Ia: 1.2 * 10 * In, tsd: p.feedTrip === "LSI" ? 0.1 : 0 };
  fd.dU = r(fd.dU, 3);
  out.feed = fd;
  /* SD-ML1 */
  const sdR = src.R + fd.R20, sdX = src.X + fd.X;
  const sdRL = src.RL + fd.Rh + fd.RPE, sdXL = src.XL + 2 * fd.X;
  out.sd = { R: sdR, X: sdX, Ik3: ik3(sdR, sdX), RL: sdRL, XL: sdXL, Ik1: ik1(sdRL, sdXL) };
  out.feed.discOk = out.sd.Ik1 >= fd.brk.Ia;
  /* branches */
  const fb = ktf * kGroup(p.method, p.nGroup);
  out.fBranch = r(fb, 3); out.kT = ktf; out.kG = kGroup(p.method, p.nGroup);
  const branch = (l, base, feedDU) => {
    const Ib1 = l.S * 1e3 / (SQ3 * U), In1 = pickIn(Ib1), bk = breaker(In1, p.trafoMach && l.drive);
    const loopAt = (A) => { const i = SIZES.indexOf(A), ip = SIZES.indexOf(A <= 35 ? A : peSize(A)); const RL = base.RL + (R20[i] + R20[ip]) * kHot(p.ins) * l.L, XL = base.XL + 2 * XKM * l.L; return { RL, XL, Ik1: ik1(RL, XL) }; };
    // units: R20 [Ω/km] · L [m] = mΩ (all impedances here are in mΩ)
    const c = sizeCable({ In: In1, f: fb, ins: p.ins, method: p.method, minA: p.minA,
      dUfun: (A) => feedDU + dU3(Ib1, l.L, A, l.cos, p.ins), dUlim: p.dUmax, discFun: (A) => loopAt(A).Ik1 >= bk.Ia });
    const i = SIZES.indexOf(c.A), PE = c.A <= 35 ? c.A : peSize(c.A);
    const R = base.R + R20[i] * l.L, X = base.X + XKM * l.L;
    const lp = loopAt(c.A);
    const Ik3m = ik3(R, X);
    const dUb = dU3(Ib1, l.L, c.A, l.cos, p.ins), dUrun = dU3(l.P * 1e3 / (SQ3 * U * l.cos), l.L, c.A, l.cos, p.ins);
    const kInr = p.trafoMach && l.drive ? 12 : 2, Iinr = kInr * Ib1;
    const RPE20 = R20[SIZES.indexOf(PE)] * l.L / 1000;        // Ω, PE of the branch at 20 °C (for the continuity test)
    return { ...l, Ib: r(Ib1, 2), In: In1, brk: bk, A: c.A, PE, Itab: c.Itab, Iz: c.Iz, by: c.by, f: r(fb, 3),
      cable: c.A <= 35 ? `5G${c.A}` : `4×${c.A}+${PE}`, dUb: r(dUb, 3), dUt: r(dUb + feedDU, 3), dUrun: r(dUrun, 3),
      R, X, Ik3: Ik3m, RL: lp.RL, XL: lp.XL, Zs: zabs(lp.RL, lp.XL), Ik1: lp.Ik1, Ia: bk.Ia, discOk: lp.Ik1 >= bk.Ia,
      ZsMax: U0 / bk.Ia * 1000, tMax: In1 <= 32 ? 0.4 : 5, Iinr: r(Iinr, 0), kInr, inrOk: Iinr < bk.ImLow, RPE20,
      icuOk: true, dUok: dUb + feedDU <= p.dUmax, ok: true };
  };
  out.br = loads.map((l) => branch(l, out.sd, fd.dU));
  out.br.forEach((b) => { b.ok = b.discOk && b.dUok && b.inrOk && b.Iz >= b.In; });
  /* compressor directly from the MDB */
  out.comp = branch({ ...COMP, L: lens[COMP.id] != null ? +lens[COMP.id] : COMP.L }, out.mdb, 0);
  /* selectivity feeder (upstream) ↔ largest branch (downstream) */
  const big = out.br.reduce((a, b) => (b.In > a.In ? b : a), out.br[0]);
  out.sel = { up: fd.brk, down: big, ratio: r(fd.brk.In / big.In, 2), ovl: fd.brk.In / big.In >= 1.6,
    current: out.sd.Ik3 <= 0.8 * fd.brk.Isd,     // full current selectivity only if the max fault downstream is below the upstream magnetic threshold
    limit: 0.8 * fd.brk.Isd, time: p.feedTrip === "LSI" };
  out.sel.ok = out.sel.ovl && (out.sel.current || out.sel.time);
  /* breaking capacity: Icu >= Ik3 AND making capacity n·Icu >= peak ip (IEC 60947-2 Table 2; ip = κ·√2·Ik3, κ = 1.02 + 0.98·e^(−3R/X), IEC 60909) */
  const ipOf = (b) => (1.02 + 0.98 * Math.exp(-3 * b.R / b.X)) * Math.SQRT2 * b.Ik3;
  const nOf = (kA) => (kA > 50 ? 2.2 : kA > 20 ? 2.1 : kA > 10 ? 2.0 : 1.7);
  const pick = (list, b) => list.find((x) => x * 1e3 >= b.Ik3 && nOf(x) * x * 1e3 >= ipOf(b));
  out.mdb.ip = ipOf(out.mdb); out.sd.ip = ipOf(out.sd);
  out.mdbIcu = pick([25, 36, 50, 65, 100], out.mdb) || 100;
  out.sdIcu = pick([10, 15, 25, 36, 50], out.sd) || 50;
  return out;
}

/* ------------------------------------------------------------------ power quality */
export const SPECTRA = {   // harmonic current in % of the fundamental (typical, example)
  none: { n: "6-pulse diode rectifier, no reactor", h: { 5: 80, 7: 60, 11: 20, 13: 12 }, cos: 0.97 },
  reactor: { n: "6-pulse + 3–4 % line reactor (or DC choke)", h: { 5: 33, 7: 13, 11: 8, 13: 5 }, cos: 0.97 },
  afe: { n: "active front end (AFE / active line module)", h: { 5: 2, 7: 1.5, 11: 1, 13: 1 }, cos: 1.0 },
};
export function harmonics(tech, Pdrive_kW, Xsrc_mOhm) {
  const s = SPECTRA[tech];
  const I1 = Pdrive_kW * 1e3 / (SQ3 * U * 0.95);
  let si = 0, su = 0; const rows = [];
  for (const h of [5, 7, 11, 13]) {
    const Ih = I1 * s.h[h] / 100, Uh = h * Xsrc_mOhm / 1e3 * Ih;     // V per phase: harmonic current through the source reactance (X rises with h)
    si += (s.h[h] / 100) ** 2; su += Uh * Uh; rows.push({ h, pct: s.h[h], Ih: r(Ih, 1), Uh: r(Uh, 2), UhPct: r(Uh / U0 * 100, 2) });
  }
  const THDi = Math.sqrt(si) * 100, THDu = Math.sqrt(su) / U0 * 100;
  const PF = s.cos / Math.sqrt(1 + (THDi / 100) ** 2);
  return { I1: r(I1, 1), rows, THDi: r(THDi, 1), THDu: r(THDu, 2), PF: r(PF, 3), cos: s.cos, n: s.n };
}
export function unbalance(a, b, c) {           // simple definition (NEMA style): max deviation from the mean / mean
  const m = (a + b + c) / 3, d = Math.max(Math.abs(a - m), Math.abs(b - m), Math.abs(c - m));
  return { mean: r(m, 2), dev: r(d, 2), pct: r(d / m * 100, 2), tolOk: [a, b, c].every((v) => v >= 0.9 * U && v <= 1.1 * U) };
}
export const TAPS = [380, 400, 415, 440, 460, 480];
export function bestTap(Umeas, Usec = 200) {
  const rows = TAPS.map((t) => ({ tap: t, Us: r(Usec * Umeas / t, 1), dev: r((Umeas / t - 1) * 100, 2) }));
  const best = rows.reduce((a, b) => (Math.abs(b.dev) < Math.abs(a.dev) ? b : a));
  return { rows, best };
}
export function leakage(nF, mAeach, mAcable) {
  const I = nF * mAeach + mAcable, Ifault = nF * mAeach * 3 + mAcable;    // phase loss on a Y-capacitor filter: up to ≈ 3 × (example)
  const IdnMin = I / 0.3;                                                  // leakage ≤ 30 % of IΔn so the RCD does not trip by itself (rule of thumb)
  const rcd = [30, 100, 300, 500, 1000].find((x) => x >= IdnMin) || 1000;
  return { I: r(I, 1), Ifault: r(Ifault, 1), IdnMin: r(IdnMin, 0), rcd, reinforced60204: I > 10, reinforced61800: I > 3.5 };
}

/* ------------------------------------------------------------------ item 4: noise numbers */
export const N4 = { Udc: 565, tr: 200, Cpm: 0.2, Lm: 25, Cmot: 1.0, fpwm: 8, l: 10, rr: 0.1, w: 10, Cc: 20, plen: 50, fsh: 10, Ish: 1, gamma: 0.85 };
export function noise(q = {}) {
  const p = { ...N4, ...q };
  const dvdt = p.Udc / (p.tr * 1e-9);                         // V/s
  const C = (p.Cpm * p.Lm + p.Cmot) * 1e-9;                    // F common-mode capacitance (cable cores → shield/PE + winding → frame)
  const Icm = C * dvdt;                                        // A peak (upper estimate)
  const didt = Icm / (p.tr * 1e-9);
  const M = MU0 / (2 * Math.PI) * p.l * Math.log((p.rr + p.w / 1000) / p.rr);   // H mutual inductance wire → victim loop
  const Uind = M * didt;
  const Icap = p.Cc * 1e-12 * p.l * dvdt;                      // A into a victim wire running next to an UNSHIELDED motor cable
  const Lpig = p.plen * 1e-9, Zpig = 2 * Math.PI * p.fsh * 1e6 * Lpig, Upig = Zpig * p.Ish;
  const lc = 150e6 * p.tr * 1e-9 / 2;                          // m critical cable length (v ≈ 150 m/µs)
  const Upk = p.Udc * (1 + p.gamma * Math.min(1, p.Lm / lc));
  const edges = 6 * p.fpwm * 1000;                             // common-mode voltage steps per second (3 phases × 2 edges × f_PWM)
  return { p, dvdt_kVus: r(dvdt / 1e9, 3), C_nF: r(C * 1e9, 2), Icm: r(Icm, 2), didt: didt, M_nH: r(M * 1e9, 1), Uind: r(Uind, 2), Icap: r(Icap, 3),
    Lpig_nH: p.plen, Zpig: r(Zpig, 2), Upig: r(Upig, 2), lc: r(lc, 2), Upk: r(Upk, 0), edges };
}
export function loop420(Us = 24, Utx = 12, Rl = 250, A = 0.5) {
  const Rmax = (Us - Utx) / 0.02, Rc = Rmax - Rl, rpm = 2 * 0.0178 / A;
  return { Rmax: r(Rmax, 0), Rcable: r(Rc, 0), rpm: r(rpm, 4), Lmax: r(Rc / rpm, 0) };
}
export function drop24(I = 2, L = 30, A = 0.75) { const d = 2 * I * L / (56 * A); return { dU: r(d, 3), Uend: r(24 - d, 2), ok: 24 - d >= 21.6 }; }

/* ------------------------------------------------------------------ cable tray checker (item 4) */
export const CATS = {
  P: { n: "Power 400 V (mains, DOL motors)", cls: "ie-cP" },
  M: { n: "Motor cable from a drive (PWM, shielded)", cls: "ie-cM" },
  C: { n: "Control 24 V DC / 230 V AC relays, valves", cls: "ie-cC" },
  S: { n: "Signal: encoder, analog 4–20 mA / ±10 V", cls: "ie-cS" },
  N: { n: "Network: PROFINET / EtherCAT", cls: "ie-cN" },
};
// minimum centre-to-centre separation in mm WITHOUT an earthed metal divider (example values from drive makers' EMC guides,
// IEC 61000-5-2 / EN 50174-2 idea – always use the larger value of the drive / machine maker)
export const SEP = { PP: 0, PM: 0, PC: 100, PS: 200, PN: 200, MM: 0, MC: 200, MS: 300, MN: 300, CC: 0, CS: 100, CN: 100, SS: 0, SN: 0, NN: 0 };
export const sepReq = (a, b) => { const o = "PMCSN"; const [x, y] = o.indexOf(a) <= o.indexOf(b) ? [a, b] : [b, a]; return SEP[x + y]; };
export const TRAY = { slots: 12, pitch: 50, width: 600 };
export const TCABLES = [
  { id: "F", n: "Machine feed 5G25, 400 V", cat: "P", d: 32 },
  { id: "CC", n: "Chip conveyor motor 4G1.5, 400 V DOL", cat: "P", d: 12 },
  { id: "SP", n: "Spindle motor cable 4G16 + shield (drive)", cat: "M", d: 28 },
  { id: "MX", n: "Servo X motor cable 4G2.5 + shield", cat: "M", d: 14 },
  { id: "C24", n: "24 V control cable 18×0.75 (valves, sensors)", cat: "C", d: 16 },
  { id: "PN", n: "PROFINET Cat 5e shielded (green)", cat: "N", d: 7 },
  { id: "EX", n: "Encoder cable X (shielded twisted pairs)", cat: "S", d: 9 },
  { id: "AI", n: "4–20 mA coolant pressure (shielded pair)", cat: "S", d: 7 },
];
export const TRAY_PRESETS = {
  bad: { pos: { F: 0, SP: 1, EX: 2, MX: 3, PN: 4, C24: 5, AI: 6, CC: 7 }, div: [] },
  good: { pos: { F: 0, CC: 1, SP: 2, MX: 3, C24: 5, PN: 7, EX: 9, AI: 10 }, div: [4] },
  nodiv: { pos: { F: 0, CC: 1, SP: 2, MX: 3, C24: 7, PN: 9, EX: 10, AI: 11 }, div: [] },
};
// pos: {cableId: slot}, div: list of boundary indices b (divider between slot b-1 and slot b)
export function checkTray(pos, div) {
  const ids = Object.keys(pos), res = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = TCABLES.find((c) => c.id === ids[i]), b = TCABLES.find((c) => c.id === ids[j]);
    const sa = pos[a.id], sb = pos[b.id], lo = Math.min(sa, sb), hi = Math.max(sa, sb);
    const dist = (hi - lo) * TRAY.pitch, req = sepReq(a.cat, b.cat);
    const divided = div.some((d) => d > lo && d <= hi);
    if (req === 0) continue;
    res.push({ a, b, dist, req, divided, ok: divided || dist >= req });
  }
  return { pairs: res, fails: res.filter((x) => !x.ok), placed: ids.length };
}

/* ------------------------------------------------------------------ fault simulator (item 4) – deterministic noise */
export function prng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
