/* AS/RS tab – item 3 "PLC + electrical circuits": ALL NUMBERS (pure functions, no DOM).
 * Same formulas as docs/33_asrs_control_circuits.md (checked with Python, stdlib). ALL VALUES ARE EXAMPLES –
 * the AS/RS supplier's offer, the drive maker's sizing tool and a qualified electrical designer decide.
 * Crane data from asrscore.js (CRANE, RACK) – travel 3 m/s / 0.5 m/s², hoist 1 m/s / 0.5 m/s², moving mass 4 200 kg.
 */
import { CRANE, RACK } from "./asrscore.js";

export const G = 9.81, SQ3 = Math.sqrt(3);
const r = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/* ISO 13855 light curtain rule (same as lcDist in robotckt_calc.js, docs/24 §8.9):
 * S = 2000·T + C; if S ≤ 500 mm keep it (min 100 mm); if S > 500 mm use K = 1600 but S ≥ 500 mm. C = 8·(d − 14), d ≤ 40 mm. */
export function lcDist(T, C) { const s2 = 2000 * T + C; if (s2 <= 500) return Math.round(Math.max(100, s2)); return Math.round(Math.max(500, 1600 * T + C)); }

// IEC 60364-5-52 Table B.52.4, PVC, method C (cable on a wall / tray), 3 loaded Cu conductors, 30 °C (as instelec_calc.js)
export const TAB_C = [[1.5, 17.5], [2.5, 24], [4, 32], [6, 41], [10, 57], [16, 76], [25, 96], [35, 119], [50, 144]];
export const R20 = { 1.5: 12.1, 2.5: 7.41, 4: 4.61, 6: 3.08, 10: 1.83, 16: 1.15, 25: 0.727, 35: 0.524, 50: 0.387 };   // Ω/km at 20 °C
export const FUSES = [16, 20, 25, 32, 40, 50, 63, 80, 100, 125];
// conductor rail sizes (copper, enclosed rail): rated A, R' and X' per conductor in Ω/km – EXAMPLE values, take them from the rail datasheet
export const RAILS = [[40, 1.60, 0.20], [63, 0.95, 0.18], [100, 0.60, 0.15], [125, 0.45, 0.14], [160, 0.33, 0.13]];
export const R_STD = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68];
export const PSU = [5, 10, 20, 40];

export const DEF = {
  U: 400, mC: CRANE.mass, mL: RACK.maxLoad, mH: 900, mF: 150,
  vx: CRANE.vx, ax: CRANE.ax, vz: CRANE.vz, az: CRANE.az, vf: CRANE.vf, af: CRANE.af,
  wr: 0.015, etaT: 0.90, etaH: 0.85, etaC: 0.97, lam: 0.90, Paux: 1500,
  H: +(RACK.z1 + (RACK.levels - 1) * RACK.levelPitch - CRANE.zIO).toFixed(2),   // 7.95 − 0.75 = 7.2 m
  Lrail: 28, feed: "end", Lsup: 35, Sconv: 4000, Sstat: 1000, kT: 0.87,
  Uon: 750, tSC: 34.8, jobsH: 103,
  tLC: 0.014, tLog: 0.040, tSTO: 0.010, tStop: 0.200, dLC: 30,
  feedType: "rail", regen: false,
};

export const PL_TXT = (p) => (p < 1e-8 ? "e (below range)" : p < 1e-7 ? "e" : p < 1e-6 ? "d" : p < 3e-6 ? "c" : p < 1e-5 ? "b" : p < 1e-4 ? "a" : "–");

export function calc(inp = {}) {
  const I = { ...DEF, ...inp }, o = { I };
  /* ---------------- crane drives */
  const m = I.mC + I.mL, mh = I.mH + I.mL, mf = I.mF + I.mL;
  const Froll = m * G * I.wr, Facc = m * I.ax;
  const tr = { m, Froll: r(Froll, 1), Facc: r(Facc, 0), Ppk: r((Facc + Froll) * I.vx / I.etaT, 0), Prun: r(Froll * I.vx / I.etaT, 0), Pbrk: r((Facc - Froll) * I.vx * I.etaT, 0) };
  tr.Pmot = tr.Ppk / 2 / 1000 <= 4 ? 4 : tr.Ppk / 2 / 1000 <= 5.5 ? 5.5 : 7.5;          // kW per travel motor (2 motors, 200 % peak allowed → rated ≥ peak/2 per motor here)
  const hz = { mh, Ppk: r(mh * (G + I.az) * I.vz / I.etaH, 0), Prun: r(mh * G * I.vz / I.etaH, 0), Plow: r(mh * G * I.vz * I.etaH, 0), PlowDec: r(mh * (G + I.az) * I.vz * I.etaH, 0) };
  hz.Pmot = [7.5, 11, 15, 18.5, 22].find((p) => p * 1000 >= hz.Prun) || 30;
  const fk = { mf, P: r((mf * I.af + mf * G * 0.05) * I.vf / 0.8, 0) };
  fk.Pmot = fk.P <= 750 ? 0.75 : fk.P <= 1100 ? 1.1 : 1.5;
  o.tr = tr; o.hz = hz; o.fk = fk;
  /* ---------------- supply currents (6-pulse diode infeed, λ = 0.9 with line reactor) */
  const Iof = (P) => P / I.etaC / (SQ3 * I.U * I.lam);
  const Iaux = I.Paux / (SQ3 * I.U);
  const Ipk = Iof(tr.Ppk + hz.Ppk) + Iaux, Irun = Iof(tr.Prun + hz.Prun) + Iaux;
  const Ith = Math.sqrt(0.15 * Ipk ** 2 + 0.35 * Irun ** 2 + 0.5 * Iaux ** 2);      // duty profile (example): 15 % peak, 35 % running, 50 % standstill
  const Iconv = I.Sconv / (SQ3 * I.U), Istat = I.Sstat / (SQ3 * I.U);
  const Ib = Ith + Iconv + Istat, IpkT = Ipk + Iconv + Istat;
  o.cur = { Ppk: r(tr.Ppk + hz.Ppk + I.Paux, 0), Ipk: r(Ipk, 2), Irun: r(Irun, 2), Iaux: r(Iaux, 2), Ith: r(Ith, 2), Iconv: r(Iconv, 2), Istat: r(Istat, 2), Ib: r(Ib, 2), IpkT: r(IpkT, 2) };
  /* ---------------- main fuse + supply cable (distribution → AS/RS main cabinet) */
  const In = FUSES.find((f) => f >= Ib && f >= IpkT / 1.5) || 125;
  const Izreq = Math.max(In, 1.6 * In / 1.45);                     // gG: I2 = 1.6·In ≤ 1.45·Iz
  const row = TAB_C.find(([, it]) => it * I.kT >= Izreq) || TAB_C[TAB_C.length - 1];
  const A = row[0], Iz = row[1] * I.kT;
  const cos = 0.9, sin = Math.sqrt(1 - cos * cos);
  const dU = (Icur, L, Rk, Xk) => SQ3 * Icur * L * (Rk / 1000 * cos + Xk / 1000 * sin) / I.U * 100;
  const dUc = dU(IpkT, I.Lsup, R20[A] * 1.2, 0.08);
  o.sup = { In, Izreq: r(Izreq, 1), A, Iz: r(Iz, 1), L: I.Lsup, dU: r(dUc, 3), Q1: In <= 40 ? 63 : In <= 63 ? 80 : 125 };
  /* ---------------- conductor rail (or energy chain cable) */
  const Lr = I.feed === "centre" ? I.Lrail / 2 : I.Lrail;
  if (I.feedType === "rail") {
    const rl = RAILS.find(([a]) => a >= 1.25 * Ith && a >= Ipk / 1.5) || RAILS[RAILS.length - 1];
    o.rail = { type: "rail", size: rl[0], R: rl[1], X: rl[2], L: Lr, dU: r(dU(Ipk, Lr, rl[1], rl[2]), 3) };
  } else {
    // energy chain: flexible cable 4G + PE in the chain, length = half travel + fixed part (chain fixed point in the middle) + 5 m in the crane
    const Lc = I.Lrail / 2 + 5 + 5;
    const rowc = TAB_C.find(([, it]) => it * 0.8 * I.kT >= 1.25 * Ith) || TAB_C[TAB_C.length - 1];    // 0.8 extra derating for a cable bundle in a chain (example)
    o.rail = { type: "chain", size: rowc[0], L: Lc, dU: r(dU(Ipk, Lc, R20[rowc[0]] * 1.2, 0.08), 3), Iz: r(rowc[1] * 0.8 * I.kT, 1) };
  }
  o.dUtot = r(o.sup.dU + o.rail.dU, 3);
  /* ---------------- DC link braking (hoist lowering m·g·h, travel stop) */
  const Elow = mh * G * I.H * I.etaH;
  const Pbrk = hz.PlowDec + tr.Pbrk;
  const Rmax = I.Uon ** 2 / (1.2 * Pbrk);
  const R = [...R_STD].reverse().find((x) => x <= Rmax) || R_STD[0];
  const sdec = I.vx ** 2 / (2 * I.ax), Ek = 0.5 * m * I.vx ** 2;
  const Etr = 2 * (Ek - Froll * sdec) * I.etaT;
  const Ecyc = 2 * mh * G * (I.H / 2) * I.etaH + Etr;
  const Pavg = Ecyc / I.tSC;
  o.brk = { Epot: r(mh * G * I.H, 0), Elow: r(Elow, 0), Pbrk: r(Pbrk, 0), Rmax: r(Rmax, 2), R, PpkR: r(I.Uon ** 2 / R, 0), Ek: r(Ek, 0), sdec, Etr: r(Etr, 0), Ecyc: r(Ecyc, 0), Pavg: r(Pavg, 0),
    Pcont: Math.ceil(1.25 * Pavg / 1000), kWhH: r(Ecyc * I.jobsH / 3.6e6, 3), kWhY: r(Ecyc * I.jobsH / 3.6e6 * 4000 * 0.5, 0) };
  /* ---------------- 24 V budget of the crane cabinet (example currents, A) */
  const L24 = [
    ["-KF30 ET 200SP head + DI/DQ modules", 0.6], ["-KF23/-KF24 F-DI / F-DQ modules (logic)", 0.3], ["fork + slot sensors (12 × 30 mA)", 0.36], ["-BG44 laser distance sensor (travel)", 0.25],
    ["-BG45 bar-code positioning reader (hoist)", 0.25], ["-KF71 optical data link DDLS (crane side)", 0.25], ["-PF75 operator panel 7\"", 0.5], ["-MB13 hoist motor brake (24 V DC)", 1.7],
    ["-MB11/-MB12 travel motor brakes", 1.6], ["-MB14 fork motor brake", 0.5], ["drive control electronics -TA10 … -TA14 (5 × 1.0 A)", 5.0], ["-KF33 safe speed monitor", 0.2],
    ["-KF35 load-cell evaluation unit", 0.15], ["-EC1 cabinet fan / cooling unit control", 0.3], ["lamps, horn, relays", 0.2]];
  const I24 = L24.reduce((s, x) => s + x[1], 0);
  o.v24 = { list: L24, I: r(I24, 2), Ires: r(I24 * 1.25, 2), A: PSU.find((p) => p >= I24 * 1.25) || 40 };
  o.v24.load = Math.round(I24 / o.v24.A * 100);
  /* ---------------- safety response time + distance at the I/O light curtain (ISO 13855) */
  const T = I.tLC + I.tLog + I.tSTO + I.tStop, C = I.dLC <= 40 ? 8 * (I.dLC - 14) : 850;
  o.saf = { T: r(T, 3), C, S2000: r(2000 * T + C, 1), S1600: r(1600 * T + C, 1), S: I.dLC <= 40 ? lcDist(T, C) : Math.round(1600 * T + 850) };
  /* ---------------- PL verification (ISO 13849-1), example subsystem values (SISTEMA / datasheets) */
  // aisle door: ≈ 4 openings per day × 250 days = 1 000 operations per year → MTTF_D = B10_D / (0.1 · n_op)
  const doorB10d = 2e6, mttfd = doorB10d / (0.1 * 1000);
  o.pl = {
    door: { nop: 1000, B10d: doorB10d, mttfd: r(mttfd, 0), cap: 100 },
    sf: [
      { n: "SF1 – e-stop (5 buttons) → STO all crane drives + SBC brakes + conveyor STO", rows: [["e-stops -SF51 … -SF55, 2 NC each, test pulses", 2.0e-8, "Cat 3, DC 90 %, B10d 100 000 (example)"], ["F-CPU -KF2 + F-DI + F-DQ (PROFIsafe)", 2.0e-9, "datasheet, PL e"], ["drive system STO (-TA11 … -TA14)", 1.0e-8, "drive datasheet, SIL 3 / PL e"], ["SBC: F-DQ + brakes -MB11 … -MB14", 2.0e-8, "Cat 3, B10d of the brakes (supplier)"]], plr: "d" },
      { n: "SF2 – aisle door with guard locking → crane STO, locked until standstill", rows: [["door switch with locking -BG56 (coded, OSSD)", 1.5e-9, "datasheet, PL e"], ["F-CPU + F-DI + F-DQ", 2.0e-9, "PL e"], ["drive system STO", 1.0e-8, "PL e"], ["standstill monitoring (safe speed -KF33)", 5.0e-9, "datasheet"]], plr: "d" },
      { n: "SF3 – I/O light curtain with muting → stop conveyor + crane at the I/O", rows: [["light curtain -BG59 (type 4) + muting sensors", 1.0e-8, "type 4 / PL e; muting sensors per IEC 62046"], ["F-CPU + F-DI + F-DQ", 2.0e-9, "PL e"], ["conveyor STO + crane STO", 2.0e-8, "PL d"]], plr: "d" },
      { n: "SF4 – hoist overspeed / slack rope / overload → hoist stop + both brakes", rows: [["safe speed monitor -KF33 + 2 encoders", 1.0e-8, "PNOZ s30 class, PL e"], ["slack-rope switch -BG34 (2 NC)", 2.0e-8, "Cat 3, B10d (example)"], ["F-CPU + F-DQ", 2.0e-9, "PL e"], ["hoist STO + 2 brakes -MB13/-MB15", 2.5e-8, "Cat 3, brake B10d"]], plr: "d" },
    ],
  };
  o.pl.sf.forEach((s) => { s.sum = s.rows.reduce((k, x) => k + x[1], 0); s.pl = PL_TXT(s.sum); s.ok = "abcde".indexOf(s.pl[0]) >= "abcde".indexOf(s.plr); });
  /* ---------------- crane cabinet heat (IEC/TR 60890 wall-mounted surface) */
  const W = 0.8, Hc = 1.2, D = 0.4, Ae = 1.4 * W * (Hc + D) + 1.8 * D * Hc;
  const loss = [["drive power sections (push-through heat sinks, internal part 5 × 30 W)", 150], ["line reactor + EMC filter", 60], ["24 V loads inside (drive electronics, PLC, relays)", 120],
    ["24 V power supply loss", r(I24 * 24 * (1 / 0.93 - 1), 1)], ["contactors, MCBs, terminals, wiring", 30]];
  const P = loss.reduce((s, x) => s + x[1], 0), k = 5.5, dT = 5;
  const Pw = k * Ae * dT;
  o.heat = { W, H: Hc, D, Ae: r(Ae, 3), loss, P: r(P, 1), k, dT, Pw: r(Pw, 1), Pnet: r(P - Pw, 1), Vdot: r(3.1 * Math.max(0, P - Pw) / dT, 0), cool: Math.ceil(Math.max(0, P - Pw) * 1.3 / 100) * 100 };
  /* ---------------- conveyor cabinet (example): chain transfers + RollerDrive zones */
  o.conv = { zones: 8, Pzone: 50, I24z: r(8 * 50 / 24, 2), psu48: false, motors: [["-MA71 chain transfer infeed", 0.55], ["-MA72 chain transfer outfeed", 0.55], ["-MA73 lift / turn unit", 0.75]] };
  o.conv.Im = o.conv.motors.map(([t, p]) => [t, p, r(p * 1000 / (SQ3 * I.U * 0.75 * 0.78), 2)]);
  return o;
}

/* live power of each axis from the crane state (W, + = motoring, − = regenerating) */
export function axisPower(K, st) {
  const I = K.I, load = st.loadKg || 0;
  const m = I.mC + load, mh = I.mH + load;
  const Froll = m * G * I.wr * Math.sign(st.vx || 0);
  const Ftr = m * (st.ax || 0) + Froll, Pm = Ftr * (st.vx || 0);
  const Ptr = Pm >= 0 ? Pm / I.etaT : Pm * I.etaT;
  const Fz = mh * (G + (st.az || 0)), Pz0 = Fz * (st.vz || 0);
  const Phz = Pz0 >= 0 ? Pz0 / I.etaH : Pz0 * I.etaH;
  const Pfk = st.forkMoving ? 300 : 0;
  return { tr: Ptr, hz: Phz, fk: Pfk, net: Ptr + Phz + Pfk };
}
