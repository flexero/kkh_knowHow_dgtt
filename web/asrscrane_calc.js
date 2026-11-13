/* AS/RS item 6 – stacker crane structure checks (simplified, hand-checkable). Same model + numbers as guide 31 §7.4–7.8 and guide 38 §7.
 * Verified with Python stdlib (scratch crn/calc.py). ALL VALUES ARE EXAMPLES – the crane maker's calculation (FEM 9.831 / EN 528) decides.
 * calc6(inp) → { S: sections [{id, t, note, rows:[{item, formula, value, unit, ok, check}]}], R: key results, F: load-path forces }
 */
export const DEF6 = { load: 300, ax: 0.5, mastT: 6, reach: 1350, ropeD: 8, weldA: 5, kEm: 2 };
export const INP6 = [["load", "load on the fork", "kg"], ["ax", "travel acceleration", "m/s²"], ["mastT", "mast wall t", "mm"], ["reach", "fork reach", "mm"],
  ["ropeD", "rope Ø (MBF ∝ d²)", "mm"], ["weldA", "mast foot weld a", "mm"], ["kEm", "emergency factor on inertia", "–"]];
/* hand values with the default inputs (Python, calc_out.txt) – used by &sr6test */
export const CHECK6 = { Ix: 372.46e6, delta: 1.8639, f1: 2.546, Min: 5.925, Mecc: 6.6217, Mem: 18.472, sig: 17.664, lean: 2.7091, Ri: 20.703, Rd: 23.442, dR: 3.2896, Rmax: 30.248,
  Pmean: 27.432, beamM: 21.914, beamSig: 24.999, ropeF: 9279, Zp: 8.6216, rollerF: 3035, sideF: 4966.3, catchF: 12.796, fork: 4.9103, weldSig: 16.724, weldN: 1.2085e8, boltT: 5.4975, torque: 770.95, shrink: 116.13, bow: 4.0127 };

const g = 9.81, E = 210000;
export function calc6(inp = {}) {
  const I = { ...DEF6, ...inp };
  const mL = I.load, a = I.ax, t = I.mastT, reach = I.reach;
  const m = { bot: 1600, mast: 1000, carr: 600, misc: 800, top: 200 };
  const mTot = m.bot + m.mast + m.carr + m.misc + m.top + mL;
  /* mast */
  const B = 350, Hs = 500;
  const A = B * Hs - (B - 2 * t) * (Hs - 2 * t);
  const Ix = (B * Hs ** 3 - (B - 2 * t) * (Hs - 2 * t) ** 3) / 12, Iy = (Hs * B ** 3 - (Hs - 2 * t) * (B - 2 * t) ** 3) / 12;
  const Wx = Ix / (Hs / 2), Wy = Iy / (B / 2);
  const mMast = m.mast * t / 6;                       // mast mass scales with the wall (example)
  const H = 9300, h = 8000, q = mMast * a / H, P = (m.carr + mL) * a;
  const dq = q * H ** 4 / (8 * E * Ix), dP = P * h * h * (3 * H - h) / (6 * E * Ix), delta = dq + dP;
  const k = 3 * E * Ix / H ** 3 * 1000, meq = 0.24 * mMast + m.carr + mL, f1 = Math.sqrt(k / meq) / (2 * Math.PI);
  const Min = q * H * H / 2 + P * h, Mecc = (m.carr + mL) * g * 750, Mn = Mecc + Min, Mem = Mecc + I.kEm * Min;
  const N = (mMast + m.top + m.carr + mL) * g, sAx = N / A, sBx = Mem / Wx, Mside = mL * g * reach, sBy = Mside / Wy, sig = sAx + sBx + sBy;
  const lean = Mecc * h * h / (2 * E * Ix), dsig = 2 * Min / Wx;
  /* wheel loads (guide 31 mass table) */
  const xs = [[m.bot, 0.2, 0.4], [mMast, -0.65, 5.0], [m.carr, 0, 8.3], [m.misc, 1.0, 1.0], [m.top, -0.65, 9.4], [mL, 0, 8.3]];
  const xd = -1.05, wb = 2.4, mT = m.bot + mMast + m.carr + m.misc + m.top + mL;
  const Mx = xs.reduce((s, [mm, x]) => s + mm * (x - xd), 0), Smh = xs.reduce((s, [mm, , hh]) => s + mm * hh, 0);
  const Ri = Mx / wb * g / 1000, Rd = mT * g / 1000 - Ri, dR = a * Smh / wb / 1000, Rmax = 1.15 * Rd + dR;
  const Pmean = (21.8 + 2 * Rmax) / 3, Pal = 5.0 * 42 * 400 * 0.89 / 1000;
  /* bottom carriage beam: box 420 × 160, flanges 15, webs 10; span 2.4 m, mast 0.30 m from the drive wheel */
  const Ib = (420 * 160 ** 3 - 400 * 130 ** 3) / 12, Wb = Ib / 80, L = 2400, aa = 300, bb = L - aa;
  const MbV = N * aa * bb / L, MbM = Mem * bb / L, MbC = 800 * g * (L - 2050) / L * aa, beamM = MbV + MbM + MbC, beamSig = beamM / Wb;
  /* hoist rope */
  const mh = m.carr + mL, ropeF = mh * (g + 0.5), MBF = 40000 * (I.ropeD / 8) ** 2, Zp = 2 * MBF / ropeF, Dd = 250 / I.ropeD, Dp = 320 / I.ropeD;
  const Phoist = mh * g * 1.0 / 0.85 / 1000, drumT = ropeF * 0.125;
  /* lifting carriage rollers */
  const Mr = mh * g * 550, Flvl = Mr / 800, rollerF = Flvl / 2, sideF = mL * g * reach / 800;
  const vTrip = 1.15, dec = vTrip * vTrip / (2 * 0.15), catchF = mh * (g + dec) / 1000;
  /* fork deflection (per tine, 3 zones) */
  const Ft = mL * g / 2, zones = [[0, 500, 3.0e6], [500, 1175, 1.2e6], [1175, 1e9, 0.6e6]];
  let df = 0; const n = 2000;
  for (let i = 0; i < n; i++) { const x = (i + 0.5) * reach / n, z = zones.find(([x0, x1]) => x >= x0 && x <= x1 + 1e-9); df += Ft * (reach - x) ** 2 / (E * z[2]) * reach / n; }
  const play = 2 * 0.4 / 300 * Math.max(0, reach - 500), fork = df + play, sMid = Ft * Math.max(0, reach - 500) / (1.2e6 / 32);
  /* weld at the mast foot (fillet all round) */
  const aw = I.weldA, Iw = aw * (Hs * Hs * B / 2 + Hs ** 3 / 6), Ww = Iw / (Hs / 2), Aw = aw * 2 * (Hs + B);
  const weldSig = Mem / Ww + N / Aw, fvw = 510 / (Math.sqrt(3) * 0.9 * 1.25), dsw = 2 * Min / Ww, weldN = 2e6 * (36 / dsw) ** 3, life = 6.4e6;
  /* bolts, welding distortion */
  const FpC = 0.7 * 1000 * 353, torque = 0.13 * 24 * FpC / 1000, boltT = Mem / (560 * 6) / 1000;
  const Qh = 0.8 * 26 * 240 / 6, shrink = 0.2 * Qh * 1000 * E * 1e6 * 12e-6 / (7850 * 460) / 1000, bow = shrink * 1000 * 250 * H * H / (8 * E * Ix);
  const buffer = 0.5 * mTot * 1.0 / 1000;

  const r = (item, formula, value, unit, ok, check) => ({ item, formula, value, unit, ok, check });
  const kN = (v) => v / 1000, kNm = (v) => v / 1e6;
  const S = [
    { id: "mast", t: "1 · Mast – bending, deflection, natural frequency", note: "Cantilever clamped in the bottom carriage. Inertia: own mass as a line load q, carriage + load as a point P at h = 8.0 m. Stiffness decides, not stress.", rows: [
      r("section", `box 500 × 350 × ${t}: A = 350·500 − ${350 - 2 * t}·${500 - 2 * t}`, A, "mm²", null, `${(A * 7.85e-3).toFixed(1)} kg/m`),
      r("Ix (travel plane)", "(350·500³ − (350−2t)(500−2t)³)/12", Ix / 1e6, "×10⁶ mm⁴", null, "guide 31: 372.5"),
      r("q, P", `q = ${mMast.toFixed(0)}·${a}/9 300 ; P = (600+${mL})·${a}`, q, "N/mm", null, `P = ${P.toFixed(0)} N`),
      r("top deflection δ", "qH⁴/(8EI) + Ph²(3H−h)/(6EI)", delta, "mm", delta <= 3, `${dq.toFixed(2)} + ${dP.toFixed(2)}; step (no jerk) ≈ ×2`),
      r("natural frequency f₁", "√(3EI/H³ / (0.24 m_mast + m_carr + m_load)) / 2π", f1, "Hz", f1 >= 2.0, "item 1 / guide 31: ≈ 2.5 Hz"),
      r("foot moment – inertia", "q·H²/2 + P·h", kNm(Min), "kN·m", null, ""),
      r("foot moment – eccentric weight", `(600+${mL})·g·0.75 m (fork centre to mast axis)`, kNm(Mecc), "kN·m", null, "static – always there"),
      r("foot moment – emergency", `M_ecc + ${I.kEm}·M_inertia`, kNm(Mem), "kN·m", null, `normal ${kNm(Mn).toFixed(2)} kN·m`),
      r("stress σ = N/A + M/Wx + M_side/Wy", `${sAx.toFixed(2)} + ${sBx.toFixed(2)} + ${sBy.toFixed(2)} (fork side: ${mL}·g·${reach / 1000} m)`, sig, "MPa", sig <= 355 / 1.1 * 0.5, `${(sig / (355 / 1.1) * 100).toFixed(0)} % of fy/γ – low on purpose`),
      r("static lean at h (taught in)", "M_ecc·h²/(2EI)", lean, "mm", null, "constant → corrected by the slot teach-in"),
      r("fatigue stress range Δσ", "2·M_inertia/Wx (accel + brake)", dsig, "MPa", dsig < 30, "far below FAT classes of the mast plate"),
    ] },
    { id: "wheel", t: "2 · Wheel loads (guide 31 §7.4)", note: "Moments of all masses about the drive wheel; tilt from acceleration ΔR = a·Σm·h / wheelbase; dynamic factor φ = 1.15 for rail joints (example).", rows: [
      r("idler wheel static", "Σ m·(x + 1.05) / 2.4 · g", Ri, "kN", null, ""),
      r("drive wheel static", "m_total·g − R_idler", Rd, "kN", null, `m_total ${mT.toFixed(0)} kg`),
      r("tilt ΔR", `${a} · ${Smh.toFixed(0)} kg·m / 2.4`, dR, "kN", null, ""),
      r("max wheel load", "1.15·R_drive + ΔR", Rmax, "kN", Rmax <= 35, "guide 31: 30.2 kN"),
      r("mean load / allowed", "(P_min + 2·P_max)/3 vs p_lim·b·D·c₁ = 5·42·400·0.89", Pmean, "kN", Pmean <= Pal, `${(Pmean / Pal * 100).toFixed(0)} % of ${Pal.toFixed(1)} kN`),
    ] },
    { id: "beam", t: "3 · Bottom carriage box beam", note: "Simply supported on the 2 wheels (span 2.4 m); mast foot 0.30 m from the drive wheel brings N and the foot moment; cabinet 800 kg at 2.05 m.", rows: [
      r("section", "box 420 × 160, flanges 15, webs 10", Ib / 1e6, "×10⁶ mm⁴", null, `W = ${(Wb / 1e3).toFixed(0)} ×10³ mm³`),
      r("M from N", "N·a·b/L", kNm(MbV), "kN·m", null, `N = ${kN(N).toFixed(1)} kN`),
      r("M from the mast moment", "M_em·b/L", kNm(MbM), "kN·m", null, ""),
      r("M total", "+ cabinet share", kNm(beamM), "kN·m", null, ""),
      r("bending stress", "M/W", beamSig, "MPa", beamSig <= 100, "S355 – stiffness + fatigue govern"),
    ] },
    { id: "hoist", t: "4 · Hoist – ropes, drum, power", note: "2 ropes, 1:1 reeving, hoisted mass carriage + fork 600 kg + load. Z_p minimum per ISO 16625 (group M5 ≈ 4.5) – check EN 528 and the crane maker.", rows: [
      r("rope force (both)", `(600+${mL})·(9.81 + 0.5)`, ropeF, "N", null, `${(ropeF / 2).toFixed(0)} N per rope`),
      r("safety factor Z_p", `2 × MBF ${(MBF / 1000).toFixed(1)} kN / F`, Zp, "–", Zp >= 4.5, "≥ 4.5 (M5) – many makers use ≥ 6"),
      r("D/d drum, pulley", `250/${I.ropeD} ; 320/${I.ropeD}`, Dd, "–", Dd >= 18 && Dp >= 20, `pulley ${Dp.toFixed(1)} (min ≈ 18 / 20)`),
      r("drum torque", "F·D/2", drumT / 1000, "N·m", null, "drum 76 rpm at 1 m/s"),
      r("hoist power", "m·g·v/η = m·9.81·1.0/0.85", Phoist, "kW", Phoist <= 11, "11 kW motor"),
    ] },
    { id: "carr", t: "5 · Lifting carriage rollers + safety catch", note: "The fork load acts 0.55 m in front of the rollers → a moment taken by 2 roller levels 0.80 m apart.", rows: [
      r("tilting moment", `(600+${mL})·g·0.55`, kNm(Mr), "kN·m", null, ""),
      r("force per load roller", "M/0.80 / 2 rollers", rollerF, "N", rollerF <= 20000 * 0.5, "allowed ≈ 20 kN (p_lim·b·D = 5·40·100)"),
      r("side roller, fork out", `${mL}·g·${reach / 1000} / 0.80`, sideF, "N", sideF <= 10000, ""),
      r("safety catch force", "m·(g + v²/2s), v = 1.15 m/s, s = 0.15 m", catchF, "kN", null, `${dec.toFixed(2)} m/s² ≈ ${(dec / g + 1).toFixed(2)} g`),
    ] },
    { id: "fork", t: "6 · Telescopic fork deflection (per tine)", note: "Stepped cantilever: base (I 3.0e6) to 0.50 m, middle (1.2e6) to 1.175 m, top (0.6e6); load half per tine at the reach; + tilt from roller play 2 × 0.4 mm / 300 mm.", rows: [
      r("elastic", "∫ F(a−x)²/(E·I(x)) dx", df, "mm", null, `F = ${Ft.toFixed(0)} N per tine`),
      r("from roller play", "2·0.4/300·(reach − 500)", play, "mm", null, ""),
      r("tip deflection", "elastic + play", fork, "mm", fork <= 5.0, "z budget guide 31 §9: ± 5 mm"),
      r("stress middle stage", "F·(reach − 500)/W", sMid, "MPa", sMid <= 200, "high-strength strips"),
    ] },
    { id: "weld", t: "7 · Mast foot weld + flange bolts + welding distortion", note: "Fillet weld all round the box, throat a. Static: EN 1993-1-8 simplified f_vw,d = f_u/(√3·β·γM2). Fatigue: FAT 36 (load-carrying fillet, root) – EN 1993-1-9 idea.", rows: [
      r("weld stress", `M_em/W_w + N/A_w (a = ${aw})`, weldSig, "MPa", weldSig <= fvw, `f_vw,d ${fvw.toFixed(0)} MPa → ${(weldSig / fvw * 100).toFixed(0)} %`),
      r("fatigue life", "2·10⁶·(36/Δσ)³", weldN, "cycles", weldN >= life, `Δσ ${dsw.toFixed(1)} MPa; need 6.4·10⁶`),
      r("bolt tension from M_em", "M/(0.56 m · 6 bolts)", boltT, "kN", boltT <= FpC / 1000 * 0.5, `preload F_p,C ${(FpC / 1000).toFixed(0)} kN`),
      r("tightening torque M24 10.9", "k·d·F_p,C = 0.13·24·247 kN", torque, "N·m", null, "k-class of the bolt set decides"),
      r("heat input corner weld", "0.8·26 V·240 A/6 mm/s", Qh, "J/mm", null, ""),
      r("shrink force (rule of thumb)", "0.2·Q·E·α/(c·ρ)", shrink, "kN", null, "White's rule – order of size"),
      r("bow if ONE corner is welded alone", "F·e·H²/(8EI), e = 250 mm", bow, "mm", null, "→ weld opposite corners in turn"),
      r("buffer energy", "½·m·v², v = 1.0 m/s", buffer, "kJ", null, "guide 31: 2.25 kJ"),
    ] },
  ];
  const R = { Ix, delta, f1, Min: kNm(Min), Mecc: kNm(Mecc), Mem: kNm(Mem), sig, lean, Ri, Rd, dR, Rmax, Pmean, beamM: kNm(beamM), beamSig, ropeF, Zp, rollerF, sideF, catchF, fork, weldSig, weldN, boltT, torque, shrink, bow };
  const F = { load: mL * g / 1000, carr: mh * g / 1000, roller: Flvl / 1000, N: N / 1000, Mn: kNm(Mn), Mem: kNm(Mem), beam: kNm(beamM), Rd, Ri, Rmax, top: 0.5, bolt: boltT };
  return { S, R, F, I };
}
