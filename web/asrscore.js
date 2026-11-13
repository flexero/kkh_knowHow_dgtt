/* AS/RS raw-material store – shared core (geometry, crane motion, jobs, stock, live simulation).
 * ONE simulation instance for all items of the "AS/RS raw materials" tab: window.ASRS.
 * Data = ASRS-RAW of config/factory.json + the real rack design of guide 03 §19.1 (392 slots) and the
 * example crane of guide 03 §10.2. ALL VALUES ARE EXAMPLES – the AS/RS supplier's offer decides.
 *
 * Coordinates (metres): x along the aisle, 0 = crane transfer point at the I/O conveyor, rack starts at RACK.x0;
 * y across the aisle, crane axis y = 0, side L = −y, side R = +y; z up from the floor.
 */

export const RACK = {
  sides: 2, bays: 14, perBay: 2, levels: 7,
  bayPitch: 1.925, upright: 0.10, gap: 0.075, crateW: 0.80, crateL: 1.20, crateH: 0.60,
  x0: 1.20,                 // first upright 1.2 m behind the I/O transfer point
  z1: 0.45, levelPitch: 1.25, // lowest fork level and level pitch (top level 7.95 m)
  aisle: 1.50, rearGap: 0.10, beamH: 0.12, height: 9.5,
  maxLoad: 300,             // kg per crate (design load)
};
RACK.length = RACK.bays * RACK.bayPitch + RACK.upright;            // 27.05 m
RACK.depthY = RACK.aisle / 2 + RACK.crateL;                         // 1.95 m: crane axis → rear of a load
RACK.slots = RACK.sides * RACK.bays * RACK.perBay * RACK.levels;    // 392

export const CRANE = {
  vx: 3.0, ax: 0.5,         // travel m/s, m/s²
  vz: 1.0, az: 0.5,         // hoist
  vf: 1.0, af: 1.2,         // telescopic fork (load handling ≈ 5 s per stop as guide 03 §10.2)
  tPos: 3.0,                // fine positioning per stop, s
  liftDz: 0.10,             // lift / lower the load on the fork, m
  tLift: 0.5,               // s for the lift / lower stroke
  mass: 4200,               // moving mass incl. mast, kg (example)
  carriageMass: 600,        // lifting carriage + fork without load, kg (example; + load ≤ 300 kg = 900 kg hoisted, guides 31 / 38)
  wRoll: 0.01,              // rolling resistance coefficient of the travel wheels
  zIO: 0.75,                // fork level at the I/O conveyor
  mastH: 9.3,
};

export const IO = {        // conveyors in front of the rack (x < 0)
  inX: -0.0, outX: -0.0,    // transfer points (crane side) – infeed on side L, outfeed on side R
  inY: -1.20, outY: 1.20, conveyorLen: 6.0, speed: 0.2, // m/s
};

/* raw materials (unit loads from config asrs[0].unit_load) */
export const SKU = {
  RAW_CC10: { name: "Crankcase casting VC10", perLoad: 6, kg: 26, color: "#8a9bb0" },
  RAW_CC:   { name: "Crankcase casting VC20", perLoad: 4, kg: 43, color: "#6f87a6" },
  RAW_CC30: { name: "Crankcase casting VC30", perLoad: 3, kg: 61, color: "#4f6d93" },
  RAW_CYL:  { name: "Cylinder casting",       perLoad: 12, kg: 9.5, color: "#a3a07a" },
  RAW_CS:   { name: "Crankshaft forging",     perLoad: 6, kg: 18, color: "#9c7a6a" },
};
export const SKUS = Object.keys(SKU);
export const CRATE_TARE = 45; // kg, steel crate (example)

/* ---------------------------------------------------------------- geometry */
export function slotId(side, bay, k, level) { return `${side}-${String(bay + 1).padStart(2, "0")}-${k + 1}-${level + 1}`; }
export function slotPos(side, bay, k, level) {
  const x = RACK.x0 + RACK.upright + bay * RACK.bayPitch + RACK.gap + RACK.crateW / 2 + k * (RACK.crateW + RACK.gap);
  const z = RACK.z1 + level * RACK.levelPitch;
  const y = (side === "L" ? -1 : 1) * (RACK.aisle / 2 + RACK.crateL / 2);
  return { x, y, z };
}
export function allSlots() {
  const out = [];
  for (const side of ["L", "R"]) for (let b = 0; b < RACK.bays; b++) for (let k = 0; k < RACK.perBay; k++)
    for (let l = 0; l < RACK.levels; l++) out.push({ id: slotId(side, b, k, l), side, bay: b, k, level: l, ...slotPos(side, b, k, l) });
  return out;
}

/* ---------------------------------------------------------------- trapezoid motion (one axis) */
export function trapTime(d, v, a) {             // time for distance d (≥0)
  d = Math.abs(d); if (d < 1e-9) return 0;
  const dAcc = v * v / a;                        // distance for accel + decel to full speed
  return d >= dAcc ? d / v + v / a : 2 * Math.sqrt(d / a);
}
export function trapPos(d, v, a, t) {            // distance covered after t (0..d)
  const s = Math.sign(d); d = Math.abs(d); const T = trapTime(d, v, a); if (t >= T) return s * d; if (t <= 0) return 0;
  const vp = Math.min(v, Math.sqrt(d * a)), ta = vp / a, dA = 0.5 * a * ta * ta;
  let p;
  if (t < ta) p = 0.5 * a * t * t;
  else if (t < T - ta) p = dA + vp * (t - ta);
  else { const r = T - t; p = d - 0.5 * a * r * r; }
  return s * p;
}
export function trapVel(d, v, a, t) {
  const s = Math.sign(d); d = Math.abs(d); const T = trapTime(d, v, a); if (t <= 0 || t >= T) return 0;
  const vp = Math.min(v, Math.sqrt(d * a)), ta = vp / a;
  return s * (t < ta ? a * t : t < T - ta ? vp : a * (T - t));
}
/** crane move time between two points (travel and hoist run together) */
export function moveTime(x0, z0, x1, z1) { return Math.max(trapTime(x1 - x0, CRANE.vx, CRANE.ax), trapTime(z1 - z0, CRANE.vz, CRANE.az)); }
export function forkTime() { return trapTime(RACK.aisle / 2 + RACK.crateL / 2, CRANE.vf, CRANE.af); }
/** load-handling time at one stop: fork out + lift/lower + fork in */
export function lhdTime() { return 2 * forkTime() + CRANE.tLift; }

/** FEM 9.851 single / dual cycle for this rack (P1 = 1/5 L, 2/3 H; P2 = 2/3 L, 1/5 H from I/O) */
export function fem9851() {
  const L = RACK.x0 + RACK.length, H = RACK.z1 + (RACK.levels - 1) * RACK.levelPitch - CRANE.zIO;
  const P1 = { x: L / 5, z: CRANE.zIO + 2 * H / 3 }, P2 = { x: 2 * L / 3, z: CRANE.zIO + H / 5 };
  const t1 = moveTime(0, CRANE.zIO, P1.x, P1.z), t2 = moveTime(0, CRANE.zIO, P2.x, P2.z), t12 = moveTime(P1.x, P1.z, P2.x, P2.z);
  const st = CRANE.tPos + lhdTime();
  const sc = (2 * t1 + 2 * t2) / 2 + 2 * st, dc = t1 + t12 + t2 + 3 * st + (CRANE.tPos + lhdTime()) * 0; // 3 stops in a DC + I/O pick
  const dcFull = t1 + t12 + t2 + 4 * lhdTime() + 3 * CRANE.tPos;
  return { L, H, P1, P2, t1, t2, t12, stop: st, sc, dc: dcFull, scPerH: 3600 / sc, dcPerH: 7200 / dcFull };
}

/* ---------------------------------------------------------------- seeded random */
export function rng(seed = 7) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

/* ---------------------------------------------------------------- live simulation */
/*
 Job: { id, type: "store"|"retrieve", sku, qty, slot, tReq, tStart, tEnd, state: "queued"|"active"|"done"|"failed", src }
 Crane phases: idle → toPick → posPick → forkOutPick → liftPick → forkInPick → toDrop → posDrop → forkOutDrop → lowerDrop → forkInDrop → idle
 Events (on): "job" (job changed), "phase", "fault", "stock", "tick"
*/
export function createSim(opts = {}) {
  const R = rng(opts.seed || 11);
  const S = {
    t: 0, speed: 1, running: true,
    slots: allSlots(),                       // + .load = { sku, qty, kg, lot, inDate } or null; .blocked
    crane: { x: 0, z: CRANE.zIO, fork: 0, carrying: null, phase: "idle", job: null, phaseT: 0, plan: null, vx: 0, vz: 0, fault: null, mode: "AUTO", energyWh: 0 },
    queue: [], done: [], jobsSeq: 1,
    inConv: [], outConv: [],                 // loads waiting on the conveyors {sku, qty, t}
    stats: { stores: 0, retrievals: 0, busyT: 0, cycleSum: 0, cycleN: 0, faults: 0 },
    rates: { storePerH: 18, retrievePerH: 22, dual: true },
    estop: false, faults: { crane: false, scanner: false, slotBlocked: null, convJam: false, overload: false },
    log: [], listeners: {},
  };
  const byId = new Map(S.slots.map((s) => [s.id, s]));
  S.byId = byId;
  const emit = (ev, d) => (S.listeners[ev] || []).forEach((f) => { try { f(d, S); } catch (e) { console.error(e); } });
  const log = (msg, lvl = "info") => { S.log.unshift({ t: S.t, msg, lvl }); if (S.log.length > 200) S.log.pop(); emit("log", { msg, lvl }); };

  /* initial stock: ≈ 75 % full, fast movers near the front (ABC) */
  const mix = [["RAW_CC", 0.30], ["RAW_CYL", 0.25], ["RAW_CS", 0.2], ["RAW_CC10", 0.13], ["RAW_CC30", 0.12]];
  const pick = () => { let r = R(), c = 0; for (const [k, p] of mix) { c += p; if (r <= c) return k; } return "RAW_CC"; };
  let lotN = 4100;
  for (const s of S.slots) if (R() < 0.75 - s.bay * 0.012) { const k = pick(); s.load = mkLoad(k); }
  function mkLoad(k) { const q = SKU[k].perLoad; return { sku: k, qty: q, kg: Math.round(q * SKU[k].kg + CRATE_TARE), lot: `L${lotN++}`, inDate: S.t }; }

  const freeSlots = () => S.slots.filter((s) => !s.load && !s.reserved && !s.blocked);
  const stockOf = (k) => S.slots.filter((s) => s.load && s.load.sku === k && !s.reserved).length;
  /* slotting rule: store near the front (shortest cycle) – class A first */
  function chooseStoreSlot() {
    const f = freeSlots(); if (!f.length) return null;
    f.sort((a, b) => moveTime(0, CRANE.zIO, a.x, a.z) - moveTime(0, CRANE.zIO, b.x, b.z));
    return f[0];
  }
  /* retrieval rule: FIFO by lot (oldest), then shortest travel */
  function chooseRetrieveSlot(k) {
    const c = S.slots.filter((s) => s.load && s.load.sku === k && !s.reserved && !s.blocked); if (!c.length) return null;
    c.sort((a, b) => (a.load.inDate - b.load.inDate) || (moveTime(0, CRANE.zIO, a.x, a.z) - moveTime(0, CRANE.zIO, b.x, b.z)));
    return c[0];
  }
  function addJob(type, sku, src = "auto") {
    const j = { id: `J${String(S.jobsSeq++).padStart(5, "0")}`, type, sku, qty: SKU[sku].perLoad, slot: null, tReq: S.t, state: "queued", src };
    S.queue.push(j); emit("job", j); return j;
  }
  S.addJob = addJob;

  /* demand generator (Poisson) */
  let nextStore = 5, nextRetr = 2;
  function demand() {
    if (S.t >= nextStore) { const k = pick(); S.inConv.push({ sku: k, t: S.t }); addJob("store", k); nextStore = S.t + -Math.log(1 - R()) * 3600 / Math.max(1, S.rates.storePerH); }
    if (S.t >= nextRetr) { const k = pick(); if (stockOf(k) > 0) addJob("retrieve", k, "line"); nextRetr = S.t + -Math.log(1 - R()) * 3600 / Math.max(1, S.rates.retrievePerH); }
  }

  /* build a plan: list of segments {ph, dur, from, to} for one or two jobs */
  function planFor(jobs) {
    const c = S.crane, segs = [];
    let x = c.x, z = c.z;
    const go = (ph, tx, tz) => { const d = moveTime(x, z, tx, tz); segs.push({ ph, dur: d, x0: x, z0: z, x1: tx, z1: tz }); x = tx; z = tz; };
    const stop = (side, what, job) => {
      segs.push({ ph: "pos", dur: CRANE.tPos, x0: x, z0: z, x1: x, z1: z });
      const ff = forkTime(), sgn = side === "L" ? -1 : side === "R" ? 1 : 0;
      segs.push({ ph: "forkOut", dur: ff, fork: [0, sgn], x0: x, z0: z, x1: x, z1: z });
      segs.push({ ph: what === "pick" ? "lift" : "lower", dur: CRANE.tLift, x0: x, z0: z, x1: x, z1: z + (what === "pick" ? CRANE.liftDz : -CRANE.liftDz), job, what });
      z += what === "pick" ? CRANE.liftDz : -CRANE.liftDz;
      segs.push({ ph: "forkIn", dur: ff, fork: [sgn, 0], x0: x, z0: z, x1: x, z1: z });
    };
    for (const j of jobs) {
      if (j.type === "store") { go("toIO", IO.inX, CRANE.zIO - CRANE.liftDz); stop("L", "pick", j); go("toSlot", j.slot.x, j.slot.z + CRANE.liftDz); stop(j.slot.side, "drop", j); }
      else { go("toSlot", j.slot.x, j.slot.z - CRANE.liftDz); stop(j.slot.side, "pick", j); go("toIO", IO.outX, CRANE.zIO + CRANE.liftDz); stop("R", "drop", j); }
    }
    return segs;
  }

  function startNext() {
    if (S.estop || S.faults.crane || S.crane.mode !== "AUTO") return;
    const q = S.queue.filter((j) => j.state === "queued"); if (!q.length) return;
    const first = q[0], jobs = [];
    const assign = (j) => {
      if (j.type === "store") { if (S.faults.scanner) { j.state = "failed"; j.err = "no-read at infeed ID point"; S.inConv.shift(); log(`${j.id} rejected: barcode no-read at the infeed – load to the reject lane`, "warn"); emit("job", j); return false; }
        const s = chooseStoreSlot(); if (!s) { j.state = "failed"; j.err = "store full"; log(`${j.id} store full`, "warn"); return false; } j.slot = s; s.reserved = j.id; }
      else { const s = chooseRetrieveSlot(j.sku); if (!s) { j.state = "failed"; j.err = "no stock"; log(`${j.id} no stock of ${j.sku}`, "warn"); emit("job", j); return false; } j.slot = s; s.reserved = j.id; }
      return true;
    };
    if (!assign(first)) { S.queue = S.queue.filter((x) => x !== first); S.done.unshift(first); return; }
    jobs.push(first);
    if (S.rates.dual) { // pair a store with a retrieval (dual command)
      const other = q.find((j) => j !== first && j.type !== first.type);
      if (other && assign(other)) jobs.push(other);
    }
    if (jobs.length === 2 && jobs[0].type === "retrieve") jobs.reverse(); // DC = store first, then retrieve
    jobs.forEach((j) => { j.state = "active"; j.tStart = S.t; emit("job", j); });
    S.crane.plan = { jobs, segs: planFor(jobs), i: 0, t0: S.t, segT: 0 };
    S.crane.phase = S.crane.plan.segs[0].ph;
  }

  function finishSeg(seg) {
    const c = S.crane;
    if (seg.ph === "lift" && seg.job) { // picked a load
      const j = seg.job;
      if (j.type === "store") { const it = S.inConv.shift() || { sku: j.sku }; c.carrying = mkLoad(it.sku); }
      else { c.carrying = j.slot.load; j.slot.load = null; emit("stock", j.slot); }
      if (S.faults.overload && c.carrying) { c.carrying.kg = RACK.maxLoad + 40; }
    }
    if (seg.ph === "lower" && seg.job) { // dropped a load
      const j = seg.job;
      if (j.type === "store") { j.slot.load = c.carrying; j.slot.load.inDate = S.t; delete j.slot.reserved; S.stats.stores++; emit("stock", j.slot); }
      else { S.outConv.push({ ...c.carrying, t: S.t }); delete j.slot.reserved; S.stats.retrievals++; }
      c.carrying = null; j.state = "done"; j.tEnd = S.t; S.stats.cycleSum += j.tEnd - j.tStart; S.stats.cycleN++;
      S.queue = S.queue.filter((x) => x !== j); S.done.unshift(j); if (S.done.length > 300) S.done.pop(); emit("job", j);
    }
  }

  function step(dt) {
    if (!S.running) return;
    dt *= S.speed; S.t += dt;
    demand();
    // outfeed conveyor delivers to the line, infeed jam fault holds it
    S.outConv = S.outConv.filter((l) => S.t - l.t < IO.conveyorLen / IO.speed);
    const c = S.crane;
    if (S.estop || S.faults.crane) { c.vx = 0; c.vz = 0; c.phase = S.estop ? "estop" : "fault"; emit("tick", S); return; }
    if (!c.plan) { c.phase = "idle"; c.vx = 0; c.vz = 0; startNext(); emit("tick", S); return; }
    let rem = dt;
    while (rem > 0 && c.plan) {
      const seg = c.plan.segs[c.plan.i], left = seg.dur - c.plan.segT, use = Math.min(rem, left);
      c.plan.segT += use; rem -= use; S.stats.busyT += use;
      const tt = c.plan.segT;
      if (seg.ph === "toIO" || seg.ph === "toSlot") {
        c.x = seg.x0 + trapPos(seg.x1 - seg.x0, CRANE.vx, CRANE.ax, tt); c.z = seg.z0 + trapPos(seg.z1 - seg.z0, CRANE.vz, CRANE.az, tt);
        c.vx = trapVel(seg.x1 - seg.x0, CRANE.vx, CRANE.ax, tt); c.vz = trapVel(seg.z1 - seg.z0, CRANE.vz, CRANE.az, tt);
        // energy (motoring only – braking energy goes to the resistor unless the DC link is regenerative):
        // travel P = (m·a + w·m·g)·v, hoist P = (m_carriage + m_load)·g·v_up  (/η 0.85)
        const load = c.carrying ? c.carrying.kg : 0, m = CRANE.mass + load, mh = CRANE.carriageMass + load;
        const vxNew = trapVel(seg.x1 - seg.x0, CRANE.vx, CRANE.ax, tt), axNow = use > 1e-9 ? (vxNew - (c.vxPrev || 0)) / use : 0;
        const pTravel = Math.max(0, (m * axNow + CRANE.wRoll * m * 9.81 * Math.sign(vxNew)) * vxNew), pHoist = Math.max(0, mh * 9.81 * c.vz);
        c.energyWh += (pTravel + pHoist) * use / 3600 / 0.85; c.vxPrev = vxNew;
      } else { c.vx = 0; c.vz = 0; c.vxPrev = 0; }
      if (seg.fork) { const p = Math.min(1, tt / seg.dur); c.fork = seg.fork[0] + (seg.fork[1] - seg.fork[0]) * p; }
      if (seg.ph === "lift" || seg.ph === "lower") c.z = seg.z0 + (seg.z1 - seg.z0) * Math.min(1, tt / seg.dur);
      c.phase = seg.ph;
      if (c.plan.segT >= seg.dur - 1e-9) {
        finishSeg(seg); c.plan.i++; c.plan.segT = 0;
        if (c.plan.i >= c.plan.segs.length) { c.plan = null; c.phase = "idle"; c.fork = 0; startNext(); }
      }
    }
    emit("tick", S);
  }
  S.step = step;
  S.on = (ev, f) => { (S.listeners[ev] = S.listeners[ev] || []).push(f); return () => { S.listeners[ev] = S.listeners[ev].filter((x) => x !== f); }; };
  S.setFault = (k, v) => { if (k in S.faults) { S.faults[k] = v; if (v) S.stats.faults++; log(`fault ${k} ${v ? "ON" : "cleared"}`, v ? "alarm" : "info"); emit("fault", { k, v }); } };
  S.setEstop = (v) => { S.estop = v; log(v ? "EMERGENCY STOP – STO on travel, hoist, fork; brakes applied" : "E-stop released – reset needed", v ? "alarm" : "info"); emit("fault", { k: "estop", v }); };
  S.stock = () => { const o = {}; SKUS.forEach((k) => (o[k] = { loads: 0, pcs: 0 })); S.slots.forEach((s) => { if (s.load) { o[s.load.sku].loads++; o[s.load.sku].pcs += s.load.qty; } }); return o; };
  S.fill = () => S.slots.filter((s) => s.load).length / S.slots.length;
  S.kpi = () => { const h = Math.max(1e-6, S.t / 3600); return { jobsPerH: (S.stats.stores + S.stats.retrievals) / h, util: S.stats.busyT / Math.max(1e-6, S.t), avgCycle: S.stats.cycleN ? S.stats.cycleSum / S.stats.cycleN : 0, fill: S.fill(), energyWhPerJob: S.crane.energyWh / Math.max(1, S.stats.stores + S.stats.retrievals) }; };
  S.log = S.log; S.logMsg = log;
  return S;
}

/* ---------------------------------------------------------------- the shared instance + clock */
export function getASRS() {
  if (window.ASRS) return window.ASRS;
  const sim = createSim({ seed: 11 });
  const A = { RACK, CRANE, IO, SKU, SKUS, sim, fem: fem9851(), slotPos, slotId, trapTime, moveTime, lhdTime };
  window.ASRS = A;
  let last = performance.now();
  const tick = () => { const now = performance.now(); const dt = Math.min(0.25, (now - last) / 1000); last = now; sim.step(dt); };
  setInterval(tick, 100);                // 10 Hz sim clock (keeps running when the tab is hidden; cheap)
  return A;
}
