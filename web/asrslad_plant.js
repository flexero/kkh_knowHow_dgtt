/* AS/RS item 5 – PLANT MODEL for the ladder program (asrslad_prog.js): crane axes, fork, hoist stroke, load sensors, slots,
 * infeed / outfeed conveyor zones with ID point, scale, contour, reject lane, the WCS (jobs, life bit, answers), drives and the safety relay.
 * Called by ladder.js every scan BEFORE the logic: reads the PLC outputs from `st`, writes the PLC inputs into `st`.
 * Motion numbers = the shared twin (asrscore.js): travel 3.0 m/s · 0.5 m/s², hoist 1.0 m/s · 0.5 m/s², fork 2.18 s, fine positioning 3.0 s,
 * lift / lower 0.5 s, conveyor 0.2 m/s, zone 1.5 m (7.5 s per zone). All values are EXAMPLES.
 */
import { CRANE, trapTime, trapPos, forkTime, rng } from "./asrscore.js";

export const SLOTX = (bay, k) => 1925 * bay + 875 * k - 1025;      // mm, bay 1 … 14, crate 1 … 2 (= asrscore slotPos)
export const SLOTZ = (lvl) => 1250 * lvl - 800;                     // mm, level 1 … 7
const ZONE_T = 1.5 / 0.2;                                           // s per conveyor zone

export function createPlant(opts = {}) {
  const seed = opts.seed || 5;
  const P = {
    faults: { noRead: false, contour: false, overweight: false, jam: false, collision: false, doubleStore: false, emptySlot: false, drive: false, wcs: false, overload: false },
    safety: { estop: false, door: false, person: false },
    feed: true, wcsAuto: true, log: [], onEvent: null,
  };
  let R, S;
  function reset() {
    R = rng(seed);
    S = {
      t: 0, x: 0, z: 750, fork: 0, carry: null, move: null, prevMove: false, inPos: true, fineT: 0, ref: false, liftT: 0, liftDone: false, prevLift: false, prevLower: false,
      slots: new Map(), inz: [], rej: null, outz: [], nextFeed: 3, life: false, lifeT: 0, job: null, dackT: 0, wcsWait: 1.5, safRel: true, prevReset: false,
      stoT: 0, brkT: 0, scanT: 0, rejT: 0, lotN: 4100, jobsSent: 0, prevAck: false,
    };
    for (const side of ["L", "R"]) for (let b = 1; b <= 14; b++) for (let k = 1; k <= 2; k++) for (let l = 1; l <= 7; l++)
      S.slots.set(`${side}-${b}-${k}-${l}`, R() < 0.62 ? { id: "CR" + String(S.lotN++).padStart(8, "0"), kg: Math.round(120 + R() * 150) } : null);
  }
  reset();
  const ev = (msg) => { P.log.unshift({ t: S.t, msg }); if (P.log.length > 60) P.log.pop(); if (P.onEvent) P.onEvent(msg); };
  const key = (j) => `${j.side}-${j.bay}-${j.k}-${j.lvl}`;
  function pickSlot(occupied) {
    const c = [...S.slots.entries()].filter(([, v]) => (occupied ? !!v : !v));
    if (!c.length) return null;
    c.sort((a, b) => kx(a[0]) - kx(b[0]));                          // near the front first (short cycle)
    const [k] = c[Math.floor(R() * Math.min(c.length, 40))];
    const [side, bay, kk, lvl] = k.split("-");
    return { side, bay: +bay, k: +kk, lvl: +lvl };
  }
  const kx = (k) => { const [, b, kk, l] = k.split("-"); return SLOTX(+b, +kk) / 3000 + SLOTZ(+l) / 1000; };

  function wcs(st, dt) {
    S.lifeT += dt;
    if (S.lifeT >= 1.0) { S.lifeT = 0; if (!P.faults.wcs) S.life = !S.life; }
    st.WCS_LIFE = S.life;
    if (st.PLC_ACK && st.WCS_JOB) { st.WCS_JOB = false; }
    if (st.PLC_ACK && !S.prevAck && S.job) ev(`WCS: job ${S.job.id} accepted by the PLC (ACK)`);
    S.prevAck = st.PLC_ACK;
    if ((st.PLC_DONE || st.PLC_ERR) && !st.WCS_DACK) { S.dackT += dt; if (S.dackT >= 0.2) { st.WCS_DACK = true; ev(`WCS: ${st.PLC_DONE ? "DONE" : "ERROR 13 (slot empty)"} received → DoneAck`); if (st.PLC_ERR && S.job) { /* stock correction */ } S.job = null; S.wcsWait = 1.0; } }
    if (!st.PLC_DONE && !st.PLC_ERR) { S.dackT = 0; st.WCS_DACK = false; }
    const semi = !!st.M_SEMI;
    if (!S.job && !st.WCS_JOB && !st.PLC_ACK && !st.PLC_DONE && !st.PLC_ERR && st.S10) {
      S.wcsWait -= dt;
      if (S.wcsWait <= 0 && (P.wcsAuto || semi)) {
        const z4 = S.inz.find((l) => l.z === 4);
        let j = null;
        if (z4) { const s = pickSlot(false); if (s) j = { ...s, store: true }; if (j && P.faults.doubleStore) { const o = pickSlot(true); if (o) { j = { ...o, store: true, dbl: true }; P.faults.doubleStore = false; } } }
        else if (!S.outz.length) {
          if (P.faults.emptySlot) { const s = pickSlot(false); if (s) j = { ...s, store: false, empty: true }; P.faults.emptySlot = false; }
          else { const s = pickSlot(true); if (s) j = { ...s, store: false }; }
        }
        if (j) {
          j.id = "J" + String(++S.jobsSent).padStart(5, "0");
          S.job = j;
          st.WCS_STORE = j.store; st.WCS_SIDE_R = j.side === "R"; st.WCS_BAY = j.bay; st.WCS_K = j.k; st.WCS_LVL = j.lvl;
          if (!semi) { st.WCS_JOB = true; ev(`WCS: ${j.store ? "ST store" : "RT retrieve"} ${j.id} slot A01${j.side}-L${j.lvl}-S${String((j.bay - 1) * 2 + j.k).padStart(2, "0")}${j.dbl ? " (slot already occupied – stock error!)" : j.empty ? " (slot really empty – stock error!)" : ""}`); }
          else ev(`HMI: job ${j.id} prepared (${j.store ? "store" : "retrieve"}) – press HMI_JOB`);
        } else S.wcsWait = 1.0;
      }
    }
  }

  function crane(st, dt) {
    const brk = st.Q_BRK && st.Q_DRV_EN && st.SAF_OK;
    // positioning (travel + hoist together, trapezoid like the twin)
    if (st.Q_MOVE && !S.prevMove) {
      const x1 = st.D_TX, z1 = st.D_TZ, dx = (x1 - S.x) / 1000, dz = (z1 - S.z) / 1000;
      const T = Math.max(trapTime(dx, CRANE.vx, CRANE.ax), trapTime(dz, CRANE.vz, CRANE.az));
      S.move = { x0: S.x, z0: S.z, x1, z1, dx, dz, t: 0, T }; S.inPos = T < 1e-6; S.ref = false;
      if (S.inPos) { S.x = x1; S.z = z1; S.move = null; }
    }
    S.prevMove = st.Q_MOVE;
    if (S.move && st.Q_MOVE && brk) {
      const m = S.move; m.t = Math.min(m.T, m.t + dt);
      S.x = m.x0 + 1000 * trapPos(m.dx, CRANE.vx, CRANE.ax, m.t); S.z = m.z0 + 1000 * trapPos(m.dz, CRANE.vz, CRANE.az, m.t);
      if (m.t >= m.T - 1e-9) { S.x = m.x1; S.z = m.z1; S.move = null; S.inPos = true; }
    }
    if (S.move && !st.Q_MOVE) { S.move = null; S.inPos = false; }        // command dropped (stop / fault): drive stops, must restart
    // jog (manual)
    if (brk && (st.Q_JOG_F || st.Q_JOG_R)) { S.x = Math.max(0, Math.min(28000, S.x + (st.Q_JOG_F ? 1 : -1) * 300 * dt)); S.ref = false; S.inPos = false; }
    // fine positioning
    if (st.Q_FINE && brk && !S.move) { S.fineT += dt; if (S.fineT >= CRANE.tPos - 1e-9) S.ref = true; } else S.fineT = 0;
    // fork
    const ft = forkTime(), v = dt / ft;
    if (brk && !(P.faults.collision && (st.Q_FK_L || st.Q_FK_R))) {
      if (st.Q_FK_L && !st.Q_FK_R) S.fork = Math.max(-1, S.fork - v);
      else if (st.Q_FK_R && !st.Q_FK_L) S.fork = Math.min(1, S.fork + v);
      else if (st.Q_FK_C) S.fork = Math.abs(S.fork) <= v ? 0 : S.fork - Math.sign(S.fork) * v;
    }
    // lift / lower stroke 100 mm in 0.5 s
    const lifting = st.Q_LIFT && brk, lowering = st.Q_LOWER && brk;
    if (lifting || lowering) {
      if ((lifting && !S.prevLift) || (lowering && !S.prevLower)) { S.liftT = 0; S.liftDone = false; }
      if (!S.liftDone) { S.liftT += dt; S.z += (lifting ? 100 : -100) * dt / CRANE.tLift; if (S.liftT >= CRANE.tLift - 1e-9) { S.liftDone = true; transfer(lifting); } }
    } else { S.liftDone = false; }
    S.prevLift = lifting; S.prevLower = lowering;
  }
  function atIO() { return Math.abs(S.x) < 5; }
  function slotHere() { const j = S.job; if (!j) return null; return Math.abs(S.x - SLOTX(j.bay, j.k)) < 5 ? key(j) : null; }
  function transfer(lift) {
    const out = Math.abs(S.fork) > 0.99;
    if (!out) return;
    if (lift) {
      if (atIO() && S.fork < 0) { const i = S.inz.findIndex((l) => l.z === 4); if (i >= 0) { S.carry = S.inz[i]; S.inz.splice(i, 1); ev(`crane: load ${S.carry.id} (${S.carry.kg} kg) taken from the infeed`); } }
      else { const k = slotHere(); if (k && S.slots.get(k)) { S.carry = S.slots.get(k); S.slots.set(k, null); if (P.faults.overload) { S.carry.kg = 345; P.faults.overload = false; } ev(`crane: load ${S.carry.id} (${S.carry.kg} kg) taken from slot ${k}`); } }
    } else if (S.carry) {
      if (atIO() && S.fork > 0) { S.outz.push({ ...S.carry, z: 1, prog: 0, t: 0 }); ev(`crane: load ${S.carry.id} put on the outfeed`); S.carry = null; }
      else { const k = slotHere(); if (k && !S.slots.get(k)) { S.slots.set(k, S.carry); ev(`crane: load ${S.carry.id} stored in slot ${k}`); S.carry = null; } }
    }
  }
  function conveyor(st, dt) {
    // new loads at zone 1 (forklift / AGV drop)
    S.nextFeed -= dt;
    if (P.feed && S.nextFeed <= 0 && !S.inz.some((l) => l.z === 1)) {
      const kg = P.faults.overweight ? 340 : Math.round(110 + R() * 160);
      const l = { id: "CR" + String(S.lotN++).padStart(8, "0"), kg, z: 1, prog: 0, noRead: P.faults.noRead, contour: P.faults.contour };
      P.faults.overweight = false; P.faults.noRead = false; P.faults.contour = false;
      S.inz.push(l); S.nextFeed = 40 + R() * 30; ev(`infeed: new load ${l.id} at zone 1${l.noRead ? " (label damaged)" : ""}${l.contour ? " (overhang)" : ""}${kg > 300 ? " (overweight)" : ""}`);
    }
    const q = [null, st.Q_IZ1, st.Q_IZ2, st.Q_IZ3, st.Q_IZ4];
    for (const l of [...S.inz].sort((a, b) => b.z - a.z)) {
      if (l.z >= 4) continue;
      const blocked = l.z === 3 && P.faults.jam;
      if (q[l.z] && q[l.z + 1] && !blocked && !S.inz.some((o) => o !== l && o.z === l.z + 1)) { l.prog += dt / ZONE_T; if (l.prog >= 1) { l.z++; l.prog = 0; } }
    }
    // reject lane
    const z3 = S.inz.find((l) => l.z === 3);
    if (z3 && st.Q_REJECT) { S.rejT += dt; if (S.rejT >= 2.0) { S.inz = S.inz.filter((l) => l !== z3); S.rej = { ...z3, t: 0 }; S.rejT = 0; ev(`reject lane: load ${z3.id} diverted`); } } else S.rejT = 0;
    if (S.rej) { S.rej.t += dt; if (S.rej.t > 12) { ev(`reject lane: load ${S.rej.id} removed by the operator`); S.rej = null; } }
    // outfeed
    const oq = [null, st.Q_OZ1, st.Q_OZ2];
    for (const l of S.outz) {
      if (l.z === 1 && oq[1] && oq[2] && !S.outz.some((o) => o.z === 2)) { l.prog += dt / ZONE_T; if (l.prog >= 1) { l.z = 2; l.prog = 0; l.t = 0; } }
      if (l.z === 2) l.t += dt;
    }
    const gone = S.outz.filter((l) => l.z === 2 && l.t > 8);
    if (gone.length) { gone.forEach((l) => ev(`outfeed: load ${l.id} picked up by the AGV for the line`)); S.outz = S.outz.filter((l) => !gone.includes(l)); }
    // sensors
    const has = (z) => S.inz.some((l) => l.z === z);
    st.B_IZ1 = has(1); st.B_IZ2 = has(2); st.B_IZ3 = has(3); st.B_IZ4 = has(4); st.B_REJ = !!S.rej;
    st.B_OZ1 = S.outz.some((l) => l.z === 1); st.B_OZ2 = S.outz.some((l) => l.z === 2);
    const z2 = S.inz.find((l) => l.z === 2);
    if (z2 && st.Q_SCAN) S.scanT += dt; else S.scanT = 0;
    st.B_ID_OK = !!(z2 && !z2.noRead && S.scanT >= 0.3);
    st.B_CONT_OK = z3 ? !z3.contour : true;
    st.W_SCALE = z3 ? z3.kg : 0;
  }
  function drives(st, dt) {
    const en = st.Q_DRV_EN && st.SAF_OK && !P.faults.drive;
    S.stoT = en ? S.stoT + dt : 0;
    st.STO_FB = !(en && S.stoT >= 0.05);
    st.DRV_RDY = !P.faults.drive;
    S.brkT = st.Q_BRK && en ? S.brkT + dt : 0;
    st.BRK_FB = S.brkT >= 0.15;
  }
  function safety(st) {
    const ok = !P.safety.estop && !P.safety.door && !(P.safety.person && !st.Q_MUTE);
    st.ESTOP_OK = !P.safety.estop; st.DOOR_OK = !P.safety.door; st.LC_OK = !(P.safety.person && !st.Q_MUTE);
    if (!ok && S.safRel) { S.safRel = false; ev("safety relay -KF2: outputs OFF (STO on all crane drives)"); }
    if (st.S_RESET && !S.prevReset && st.A7051) P.retarget();
    if (ok && !S.safRel && st.S_RESET && !S.prevReset) { S.safRel = true; ev("safety relay -KF2: reset with -SF58 → outputs ON"); }
    S.prevReset = st.S_RESET;
    st.SAF_OK = S.safRel;
  }
  function step(st, dt) {
    S.t += dt;
    safety(st); drives(st, dt); wcs(st, dt); crane(st, dt); conveyor(st, dt);
    st.I_INPOS = S.inPos && !S.move;
    st.I_HZ_DONE = S.liftDone;
    st.B_FORK_C = Math.abs(S.fork) < 0.005; st.B_FORK_L = S.fork <= -0.995; st.B_FORK_R = S.fork >= 0.995;
    st.B_LOAD_L = st.B_LOAD_R = !!S.carry;
    st.B_OVH = !(P.faults.collision && (st.Q_FK_L || st.Q_FK_R || st.Q_FK_C || Math.abs(S.fork) > 0.01));
    st.B_REF = S.ref && !S.move;
    const k = slotHere();
    st.B_OCC = !!(S.ref && !atIO() && k && S.slots.get(k));
    st.LOAD_KG = S.carry ? S.carry.kg : 0;
  }
  P.step = step;
  P.reset = () => { reset(); P.log.length = 0; };
  P.view = () => S;
  /* the WCS re-targets after a double-storage alarm (simplified: the phantom load in the slot is booked out) */
  P.retarget = () => { const k = slotHere(); if (k && S.slots.get(k) && S.carry) { ev(`WCS: slot ${k} blocked + counted – stock corrected, store continues`); S.slots.set(k, null); } };
  return P;
}
