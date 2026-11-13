/* Hydraulics item 4 – small helpers to write ladder programs in the format of web/ladder.js (contract docs/35).
 * Tags:      I() bit input, Q() bit output, M() internal bit, AI() analog input, W() word, T() timer, C() counter
 * Contacts:  NO(t) –| |–, NC(t) –|/|–, PE(t) rising edge –|P|–, NE(t) falling edge –|N|–, CMP(op, a, b) compare contact,
 *            TON(t) / TOF(t) / TP(t) timer box, CTU(t, r) counter box
 * Logic:     S(...) series = AND, P(...) parallel = OR
 * Outputs:   OUT(t) –( )–, SET(t) –(S)–, RST(t) –(R)–, CALC(expr, to), MOV(v, to)
 * All addresses are EXAMPLES – check with your PLC configuration (HWCONFIG in ISPSoft, device configuration in TIA Portal). */
export const I = (name, delta, siemens, comment, wire = "", init = false) => ({ name, dir: "I", type: "BOOL", delta, siemens, comment, wire, init });
export const Q = (name, delta, siemens, comment, wire = "") => ({ name, dir: "Q", type: "BOOL", delta, siemens, comment, wire, init: false });
export const M = (name, delta, siemens, comment, init = false) => ({ name, dir: "M", type: "BOOL", delta, siemens, comment, init });
export const AI = (name, delta, siemens, comment, unit, min, max, init = 0, wire = "") => ({ name, dir: "AI", type: "REAL", delta, siemens, comment, unit, min, max, init, wire });
export const W = (name, delta, siemens, comment, unit = "", init = 0, type = "REAL") => ({ name, dir: "W", type, delta, siemens, comment, unit, init });
export const T = (name, delta, siemens, comment, pt) => ({ name, dir: "T", delta, siemens, comment, pt });
export const C = (name, delta, siemens, comment, pv) => ({ name, dir: "C", delta, siemens, comment, pv });

export const NO = (t) => ({ c: "NO", t });
export const NC = (t) => ({ c: "NC", t });
export const PE = (t) => ({ c: "P", t });
export const NE = (t) => ({ c: "N", t });
export const CMP = (cmp, a, b) => ({ cmp, a, b });
export const TON = (t) => ({ b: "TON", t });
export const TOF = (t) => ({ b: "TOF", t });
export const TP = (t) => ({ b: "TP", t });
export const CTU = (t, r) => ({ b: "CTU", t, r });
export const S = (...x) => ({ s: x });
export const P = (...x) => ({ p: x });
export const OUT = (t) => ({ o: "OUT", t });
export const SET = (t) => ({ o: "SET", t });
export const RST = (t) => ({ o: "RST", t });
export const CALC = (calc, to) => ({ calc, to });
export const MOV = (mov, to) => ({ mov, to });
export const R = (inp, ...out) => ({ in: inp, out });
export const N = (title, comment, ...rungs) => ({ title, comment, rungs });

/* first-order lag: move x toward target with time constant tau [s] */
export const lag = (x, target, tau, dt) => x + (target - x) * Math.min(1, dt / Math.max(tau, 1e-6));
/* delayed copy of a bit (contactor / valve feedback): returns a function (now, dt) → delayed value */
export function delayBit(onDelay, offDelay = onDelay) {
  let out = false, t = 0;
  return (inp, dt) => {
    if (inp === out) { t = 0; return out; }
    t += dt;
    if (t >= (inp ? onDelay : offDelay)) { out = inp; t = 0; }
    return out;
  };
}
