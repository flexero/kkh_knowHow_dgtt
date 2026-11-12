/* Numeric self-checks of the robot control simulation (robotctl_core.js). Loaded only with the URL parameter &rctest.
 * Output: console lines "RCTEST ..." (and the returned array). Checks:
 *  (a) only gravity, no motion -> the integral action holds the position (steady-state error ≈ 0)
 *  (b) PTP response stable with the default (auto-tuned) gains: 4 robots × J1–J3
 *  (c) torque feedforward reduces the max following error a lot
 *  (d) too-high gains -> oscillation / instability is detected
 *  (e) resonance frequency of the simulation (FFT-free: zero crossings of the gear twist after a torque kick) = formula
 *  (f) collision: model-based detection stops at a lower contact force than detection without model
 */
import { ROBOTS, cellLayout } from "./robotkin.js";
import { jointModel, autoTune, simulate, stopCurves, CTL, sizing } from "./robotctl_core.js";

const AM = 180 / Math.PI * 60;     // rad -> arc-min

export function runTests(log = console.log, quick = false) {
  const L = [];
  const P = (s) => { L.push(s); log("RCTEST " + s); };
  const t0 = performance.now();
  if (quick === "noise") {
    const rb = ROBOTS[1], C = cellLayout(rb), M = jointModel(rb, 0, C.home.slice(), C.gripMass + C.part.mass), G = autoTune(M);
    for (const opt of [{}, { jerk: false }, { fft: false }, { bits: 24 }]) {
      const r = simulate(M, { Kv: G.Kv, Kp: G.Kp, Ti: G.Ti, ffv: true, fft: true, jerk: true, bits: 20, dq: 30, ovr: 1, ...opt });
      const o = r.out, i0 = Math.round(0.50 / 5e-4);
      P(JSON.stringify(opt) + " tau@0.5s: " + o.tau.slice(i0, i0 + 24).map((v) => v.toFixed(0)).join(" ") + " | eM: " + o.eM.slice(i0, i0 + 24).map((v) => (v * 1e6).toFixed(0)).join(" "));
    }
    return L;
  }
  if (quick === "jerk") {
    for (const rb of ROBOTS.slice(1, 3)) for (const j of [0, 1]) {
      const C = cellLayout(rb), M = jointModel(rb, j, C.home.slice(), C.gripMass + C.part.mass), G = autoTune(M);
      for (const nJ of [1, 0]) for (const twc of [false, true]) {
        const r = simulate(M, { Kv: G.Kv, Kp: G.Kp, Ti: G.Ti, ffv: true, fft: true, jerk: true, nJ, twc, bits: 20, dq: 30, ovr: 1 });
        let im = 0; r.out.eL.forEach((v, i) => { if (Math.abs(v) > Math.abs(r.out.eL[im])) im = i; });
        P(`${rb.id} J${j + 1} fres=${M.fRes.toFixed(1)} flock=${M.fLock.toFixed(1)} nJ=${nJ} twc=${twc} maxE=${(r.maxE * AM).toFixed(2)}' maxEM=${(r.maxEM * AM).toFixed(2)}' at t=${r.out.t[im].toFixed(3)} (move ${r.t0}-${r.tEnd1.toFixed(3)}) settle=${r.settle} maxR=${(100 * r.maxRes / M.tauLim).toFixed(1)}%`);
      }
    }
    return L;
  }
  if (quick) {
    const [ri, jj, dqq] = String(quick).split(",").map(Number);
    const rb = ROBOTS[ri || 0], C = cellLayout(rb), q = C.home.slice();
    let ta = performance.now(); sizing(rb); P("sizing " + (performance.now() - ta).toFixed(0) + " ms");
    ta = performance.now(); const M = jointModel(rb, jj || 0, q, 1); P(`JL=${M.JL} JM=${M.JM} k=${M.k} lim=${M.tauLim} Jr=${M.Jr}`); P("jointModel " + (performance.now() - ta).toFixed(0) + " ms");
    const G = autoTune(M);
    ta = performance.now(); const r = simulate(M, { Kv: G.Kv, Kp: G.Kp, Ti: G.Ti, ffv: true, fft: true, bits: 20, dq: isNaN(dqq) ? 30 : dqq, ovr: 1, dwell: 0.3, tTot: 1 }); P("simulate " + (performance.now() - ta).toFixed(0) + " ms sub=" + r.sub + " n=" + r.out.t.length + " status=" + r.status + " maxE=" + (r.maxE * AM).toFixed(2));
    return L;
  }
  for (const rb of ROBOTS) {
    const C = cellLayout(rb), q = C.home.slice(), m = C.gripMass + C.part.mass;
    const sz = sizing(rb);
    P(`${rb.id} sizing: ` + sz.map((s, j) => `J${j + 1} n=${s.n} Jm=${s.Jm.toExponential(2)} Imax=${s.Imax.toFixed(2)} Hmax=${s.Hmax.toFixed(0)} τlim=${s.tauLim.toFixed(0)} τm=${s.tmMax.toFixed(2)} Kt=${s.Kt.toFixed(2)} I=${s.iMax.toFixed(1)}A`).join(" | "));
    for (let j = 0; j < 6; j++) {
      const M = jointModel(rb, j, q, m), G = autoTune(M);
      const base = { Kv: G.Kv, Kp: G.Kp, Ti: G.Ti, ffv: true, fft: true, jerk: true, bits: 20, dq: 30, ovr: 1 };
      const a = simulate(M, { ...base, dq: 0.0001, dwell: 0.3, tTot: 1.0 });
      const b = simulate(M, base);
      const c = simulate(M, { ...base, fft: false });
      const c2 = simulate(M, { ...base, fft: false, ffv: false });
      const d = simulate(M, { ...base, Kp: G.Kp * 25 });
      const d2 = simulate(M, { ...base, Kv: G.Kv * 6 });
      const d3 = j < 3 ? simulate(M, { ...base, Kp: G.Kp * 60 }) : null;
      const nj = simulate(M, { ...base, jerk: false });
      const tw = simulate(M, { ...base, twc: true });
      P(`${rb.id} J${j + 1}: JL=${M.JL.toFixed(3)} JM=${M.JM.toFixed(3)} k=${M.k.toExponential(2)} fres=${M.fRes.toFixed(1)}Hz flock=${M.fLock.toFixed(1)}Hz lever=${M.lever.toFixed(3)}m hold=${M.hold0.toFixed(0)}Nm` +
        ` | Kv=${G.Kv.toFixed(1)} Kp=${G.Kp.toFixed(0)} Ti=${(G.Ti * 1000).toFixed(1)}ms sub=${b.sub}` +
        ` | (a) gravity hold motor-side ss=${(a.ssErrM * AM).toFixed(4)}' link sag=${(a.ssErr * AM).toFixed(3)}' (τg/k=${(M.hold0 / M.k * AM).toFixed(3)}')` +
        ` | (b) ${b.status} T=${b.T.toFixed(3)} maxE=${(b.maxE * AM).toFixed(2)}' (${(b.maxE * M.lever * 1000).toFixed(2)}mm) Tj=${(b.Tj * 1000).toFixed(0)}ms settle=${b.settle === null ? "-" : (b.settle * 1000).toFixed(0) + "ms"} over=${(b.over * M.lever * 1000).toFixed(3)}mm peak=${(100 * b.peakTau / M.tauLim).toFixed(0)}% maxR=${(100 * b.maxRes / M.tauLim).toFixed(1)}% ss=${(b.ssErr * AM).toFixed(3)}'` +
        ` | (c) noTFF maxE=${(c.maxE * AM).toFixed(2)}' noFF=${(c2.maxE * AM).toFixed(1)}' ratio=${(c2.maxE / b.maxE).toFixed(1)}` +
        ` | noJerk maxE=${(nj.maxE * AM).toFixed(2)}' settle=${nj.settle === null ? "-" : (nj.settle * 1000).toFixed(0)}ms | twc maxE=${(tw.maxE * AM).toFixed(2)}' sag=${(tw.sag * AM).toFixed(3)}'` +
        ` | (d) Kp×25: ${d.status} tstd=${(100 * d.tstd / M.tauLim).toFixed(1)}% p2p=${(d.p2p * AM).toFixed(2)}' ; Kv×6: ${d2.status} p2p=${(d2.p2p * AM).toFixed(2)}'` + (d3 ? ` ; Kp×60: ${d3.status}` : "") + ` maxEM=${(b.maxEM * AM).toFixed(2)}'` +
        ` vdcMax=${b.vdcMax.toFixed(0)}V chop=${b.eChop.toFixed(0)}J`);
    }
  }
  // (e) resonance: open loop (Kp tiny) torque kick, count zero crossings of the twist
  for (const rb of ROBOTS) for (const j of [0, 1, 2]) {
    const C = cellLayout(rb), q = C.home.slice(), M = jointModel(rb, j, q, C.gripMass + C.part.mass);
    const fsim = freeVibration(M);
    P(`(e) ${rb.id} J${j + 1}: formula f=(1/2π)√(k(1/JL+1/JM)) = ${M.fRes.toFixed(2)} Hz, simulation free vibration = ${fsim.toFixed(2)} Hz, diff ${(100 * (fsim / M.fRes - 1)).toFixed(1)} %`);
  }
  // (f) collision, J1 of every robot, obstacle at 60 % of the 30° move, kc = 50 kN/m
  for (const rb of ROBOTS) {
    const C = cellLayout(rb), q = C.home.slice(), M = jointModel(rb, 0, q, C.gripMass + C.part.mass), G = autoTune(M);
    const base = { Kv: G.Kv, Kp: G.Kp, Ti: G.Ti, ffv: true, fft: true, jerk: true, bits: 20, dq: 30, ovr: 0.5 };
    const free = simulate(M, { ...base, coll: { on: true, frac: 2, kc: 0, mode: "model", thr: 0.08 } });
    const cm = simulate(M, { ...base, coll: { on: true, frac: 0.6, kc: 2e4, mode: "model", thr: 0.08 } });
    const cn = simulate(M, { ...base, coll: { on: true, frac: 0.6, kc: 2e4, mode: "none", thr: 0.08 } });
    const wr = simulate(M, { ...base, mDecl: 0, coll: { on: true, frac: 2, kc: 0, mode: "model", thr: 0.08 } });
    const f = (r) => r.det ? `detect +${((r.det.t - (r.contact ? r.contact.t : 0)) * 1000).toFixed(1)}ms (${r.det.why}) Fmax=${r.Fmax.toFixed(0)}N stand +${r.stop.tStand ? ((r.stop.tStand - r.contact.t) * 1000).toFixed(0) : "-"}ms dist=${r.stopDist ? (r.stopDist * 1000).toFixed(1) : "-"}mm` : `no detection Fmax=${r.Fmax.toFixed(0)}N`;
    P(`(f) ${rb.id} J1: free run max|r|=${(100 * free.maxRes / M.tauLim).toFixed(1)}% of τlim (thr 8%) falseAlarm=${!!free.falseAlarm} | WITH model: ${f(cm)} | WITHOUT model: ${f(cn)} | wrong load (declared 0 kg): max|r|=${(100 * wr.maxRes / M.tauLim).toFixed(1)}% false alarm=${wr.falseAlarm ? "YES at " + wr.falseAlarm.t.toFixed(3) + "s" : "no"}`);
  }
  for (const rb of ROBOTS) {
    const C = cellLayout(rb), q = C.home.slice(), m = C.gripMass + C.part.mass;
    const M = jointModel(rb, 1, q, m), G = autoTune(M);
    const wr = simulate(M, { Kv: G.Kv, Kp: G.Kp, Ti: G.Ti, ffv: true, fft: true, jerk: true, bits: 20, dq: 30, ovr: 0.5, mDecl: 0, coll: { on: true, frac: 2, kc: 0, mode: "model", thr: 0.08 } });
    const ok = simulate(M, { Kv: G.Kv, Kp: G.Kp, Ti: G.Ti, ffv: true, fft: true, jerk: true, bits: 20, dq: 30, ovr: 0.5, coll: { on: true, frac: 2, kc: 0, mode: "model", thr: 0.08 } });
    P(`(f2) ${rb.id} J2 load ${m} kg: right load max|r|=${(100 * ok.maxRes / M.tauLim).toFixed(1)}% · declared 0 kg max|r|=${(100 * wr.maxRes / M.tauLim).toFixed(1)}% false alarm=${wr.falseAlarm ? "YES" : "no"}`);
  }
  for (const rb of ROBOTS) {
    const C = cellLayout(rb), M = jointModel(rb, 0, C.home.slice(), C.gripMass + C.part.mass), S = stopCurves(M, 1);
    P(`stop ${rb.id} J1 from ${(S.v0 / Math.PI * 180).toFixed(0)}°/s: ` + S.c.map((c) => `cat${c.cat} t=${(c.tStop * 1000).toFixed(0)}ms dist=${(c.dist / Math.PI * 180).toFixed(1)}° (${(c.distTcp * 1000).toFixed(0)}mm TCP)`).join(" · ") + ` aRamp=${S.aRamp.toFixed(1)} aBrake=${S.aBrake.toFixed(1)} rad/s²`);
  }
  // encoder resolution effect
  { const rb = ROBOTS[1], C = cellLayout(rb), M = jointModel(rb, 0, C.home.slice(), C.gripMass + C.part.mass), G = autoTune(M);
    for (const bits of [12, 16, 20]) { const r = simulate(M, { Kv: G.Kv, Kp: G.Kp, Ti: G.Ti, ffv: true, fft: true, bits, dq: 30, ovr: 1 }); P(`enc ${bits} bit: res=${(r.res * AM * 60).toFixed(3)} arc-sec, hold torque std=${(100 * r.tstd / M.tauLim).toFixed(2)}% status=${r.status}`); } }
  P(`time ${(performance.now() - t0).toFixed(0)} ms`);
  return L;
}

// free vibration of the two-mass system (no controller, no gravity change): motor kicked, measure the twist period
function freeVibration(M) {
  const dt = 2e-6 * Math.max(1, 20 / M.fRes), JL = M.JL, JM = M.JM, k = M.k;
  let xM = 0, xL = 0, wM = 1e-3, wL = -1e-3 * JM / JL, prev = 0, cross = [], t = 0;
  while (cross.length < 9 && t < 5) {
    const tw = k * (xM - xL);
    wM += -tw / JM * dt; wL += tw / JL * dt; xM += wM * dt; xL += wL * dt; t += dt;
    const s = xM - xL;
    if (prev < 0 && s >= 0) cross.push(t);
    prev = s;
  }
  return (cross.length - 1) / (cross[cross.length - 1] - cross[0]);
}
