/* Industrial robot – simulation engine (no DOM). Used by robot.js (UI).
 * Robot state for the 3D (getState), motion engine (planPTP / planLIN from robotkin.js), jog, teach points,
 * machine-tending program, part flow (infeed -> machine -> outfeed), machine door + cycle timer, cycle-time statistics.
 * Units: mm, deg, s. All times and speeds are EXAMPLES (check with the robot / machine datasheet).
 */
import { robotById, fk, ik, planPTP, planLIN, cellLayout, ORIENT, rotFromABC, abcFromRot, checkLimits, rot3, Rx, Ry, Rz } from "./robotkin.js";

export const SIM = {
  machTime: 25,     // s, machining time of one part (example)
  doorTime: 1.5,    // s, machine door open / close (example)
  convV: 200,       // mm/s, conveyor speed (example)
  gripTime: 0.4,    // s, gripper close / open incl. sensor check (example)
  t1Max: 250,       // mm/s, TCP speed limit in T1 (ISO 10218-1)
  jogFrac: 0.10,    // joint jog speed in T1 = 10 % of the axis max speed (example)
  histDt: 0.05,     // s, chart sample time
  histLen: 500,     // samples (= 25 s)
};

function mul3(a, b) {
  const r = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r;
}
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const r1 = (v) => Math.round(v * 10) / 10;

/* ------------------------------------------------------------------ teach points + program from the cell layout */
export function makePoints(rb, C) {
  const k = C.k, h = C.part.h, m = C.machine;
  const up = Math.max(120, Math.round(260 * k));                       // approach height above the conveyor parts
  const D = abcFromRot(ORIENT.down()), F = abcFromRot(ORIENT.front());
  const pt = (n, p, abc, note) => ({ n, type: "cart", p: p.map(r1), abc: abc.map(r1), note });
  const home = fk(rb, C.home, C.tool);
  return [
    { n: "pHome", type: "joint", q: C.home.slice(), p: home.p.map(r1), abc: home.abc.map(r1), note: "home position (joint target, safe, outside all machines)" },
    pt("pMachApp", [m.x0 - h - Math.round(140 * k), m.load[1], m.load[2]], F, "in front of the machine door, part fully outside"),
    pt("pMachLoad", m.load, F, "part in the machine fixture (tool Z along +X)"),
    pt("pOutAbove", [C.outfeed.place[0], C.outfeed.place[1], C.outfeed.place[2] + up], D, "above the outfeed place position"),
    pt("pOutPlace", C.outfeed.place, D, "place position on the outfeed conveyor"),
    pt("pInfAbove", [C.infeed.pick[0], C.infeed.pick[1], C.infeed.pick[2] + up], D, "above the infeed pick position"),
    pt("pInfPick", C.infeed.pick, D, "pick position on the infeed conveyor (part top)"),
  ];
}
// g = group for the cycle analysis, dbl = this step stays in the machine-idle time also with a double gripper
export function makeProgram() {
  return [
    { op: "MoveJ", pt: "pHome", v: 1000, z: "fine", c: "start: go home", g: "home" },
    { op: "WaitDI", sig: "diMachDone", c: "wait until the machine has finished the part", g: "wait" },
    { op: "SetDO", sig: "doDoorOpen", val: 1, c: "open the machine door", g: "door", dbl: true },
    { op: "WaitDI", sig: "diDoorOpen", c: "wait until the door is open", g: "door", dbl: true },
    { op: "MoveJ", pt: "pMachApp", v: 1000, z: "z50", c: "approach in front of the machine", g: "unload" },
    { op: "MoveL", pt: "pMachLoad", v: 500, z: "fine", c: "into the machine to the finished part", g: "unload", dbl: true },
    { op: "Grip", val: 1, c: "close gripper – take the finished part", g: "unload", dbl: true },
    { op: "MoveL", pt: "pMachApp", v: 500, z: "z20", c: "out of the machine", g: "unload", dbl: true },
    { op: "MoveJ", pt: "pOutAbove", v: 1000, z: "z50", c: "to the outfeed conveyor", g: "out" },
    { op: "MoveL", pt: "pOutPlace", v: 300, z: "fine", c: "down to the belt", g: "out" },
    { op: "Grip", val: 0, c: "open gripper – finished part on the outfeed", g: "out" },
    { op: "MoveL", pt: "pOutAbove", v: 500, z: "z20", c: "up", g: "out" },
    { op: "MoveJ", pt: "pInfAbove", v: 1000, z: "z50", c: "to the infeed conveyor", g: "in" },
    { op: "WaitDI", sig: "diPartReady", c: "wait for a raw part at the pick position", g: "in" },
    { op: "MoveL", pt: "pInfPick", v: 300, z: "fine", c: "down to the raw part", g: "in" },
    { op: "Grip", val: 1, c: "close gripper – take the raw part", g: "in" },
    { op: "MoveL", pt: "pInfAbove", v: 500, z: "z20", c: "up", g: "in" },
    { op: "MoveJ", pt: "pMachApp", v: 1000, z: "z50", c: "in front of the machine, turn the part horizontal", g: "load" },
    { op: "MoveL", pt: "pMachLoad", v: 300, z: "fine", c: "into the fixture", g: "load", dbl: true },
    { op: "Grip", val: 0, c: "open gripper – part stays in the fixture (fixture clamps)", g: "load", dbl: true },
    { op: "MoveL", pt: "pMachApp", v: 500, z: "z20", c: "out of the machine", g: "load", dbl: true },
    { op: "SetDO", sig: "doDoorOpen", val: 0, c: "close the machine door", g: "door", dbl: true },
    { op: "WaitDI", sig: "diDoorClosed", c: "wait until the door is closed", g: "door", dbl: true },
    { op: "PulseDO", sig: "doCycleStart", c: "start the machine (machining " + SIM.machTime + " s, example)", g: "door", dbl: true },
    { op: "MoveJ", pt: "pHome", v: 1000, z: "fine", c: "back home, wait for the next part", g: "home" },
  ];
}
export const LOOP_START = 1;
export function insText(ins) {
  switch (ins.op) {
    case "MoveJ": case "MoveL": return `${ins.op} ${ins.pt}, v${ins.v}, ${ins.z}, tGripper;`;
    case "WaitDI": return `WaitDI ${ins.sig}, 1;`;
    case "SetDO": return `SetDO ${ins.sig}, ${ins.val};`;
    case "PulseDO": return `PulseDO ${ins.sig};`;
    case "Grip": return `SetDO doGripClose, ${ins.val}; WaitTime ${SIM.gripTime};`;
    default: return ins.op;
  }
}

/* ------------------------------------------------------------------ the simulator */
export function createSim(rbId) {
  const sim = {
    S: null, mode: "T1", enable: false, gateClosed: true, ovr: 1, speed: 1,
    pts: [], prog: makeProgram(), run: null, mach: null, motion: null, jog: null, gripAct: null,
    hist: [], simT: 0, msg: "", stats: null, homeCfg: null, cycles: [], onCycle: null, onAlarm: null, nextId: 1,
  };
  const S0 = { show: { cell: true, env: false, frames: false, trail: true, ghost: false }, sel: null };

  function setRobot(id) {
    const rb = robotById(id), C = cellLayout(rb);
    const show = sim.S ? sim.S.show : S0.show, sel = sim.S ? sim.S.sel : null;
    sim.S = { rb, q: C.home.slice(), tool: { ...C.tool }, C, grip: 0, parts: [], door: 0, conv: 0, show, trail: [], targets: [], ghostQ: null, sel, live: { moving: false, alarm: "" } };
    sim.pts = makePoints(rb, C);
    const h = fk(rb, C.home, C.tool), r = ik(rb, h.p, h.R, C.tool, C.home);
    sim.homeCfg = r.ok ? r.cfg : { front: true, up: true };
    sim.motion = null; sim.jog = null; sim.gripAct = null; sim.hist = []; sim.cycles = [];
    resetCell();
  }
  function resetCell() {
    const S = sim.S, C = S.C;
    sim.run = { on: false, step: false, loop: true, pc: 0, act: null, tIns: 0, pass: [], passIdle: 0, passStart: 0, n: 0, last: null, tStart: 0 };
    sim.mach = { state: "done", tLeft: 0, doorCmd: 0, part: null, idle: 0, cutting: 0 };
    sim.stats = { done: 0, picked: 0 };
    S.parts = []; S.grip = 0; S.door = 0; S.q = C.home.slice(); S.trail = []; S.live.alarm = ""; sim.msg = "";
    sim.motion = null; sim.jog = null; sim.gripAct = null;
    const sp = C.part.d + 60;
    for (let i = 0; i < 3; i++) addPart("in", [C.infeed.pick[0], C.infeed.pick[1] + i * sp, C.infeed.z + C.part.h / 2], "z");
    const mp = addPart("mach", C.machine.fixture.slice(), "x"); mp.done = true; sim.mach.part = mp;
    targets();
  }
  function addPart(loc, p, ax) { const o = { id: "P" + sim.nextId++, p, ax, done: false, held: false, loc }; sim.S.parts.push(o); return o; }
  function targets() { sim.S.targets = sim.pts.filter((p) => p.type === "cart").map((p) => ({ n: p.n, p: p.p.slice() })); }
  const pt = (n) => sim.pts.find((p) => p.n === n);

  /* ---------------- alarms + messages */
  function alarm(t) {
    sim.S.live.alarm = t; sim.run.on = false; sim.run.act = null; sim.motion = null; sim.jog = null;
    if (sim.onAlarm) sim.onAlarm(t);
  }
  function resetAlarm() { sim.S.live.alarm = ""; sim.msg = ""; }

  /* ---------------- target joints of a point */
  function pointQ(p, qRef) {
    const S = sim.S;
    if (p.type === "joint") return { ok: true, q: p.q.slice() };
    return ik(S.rb, p.p, rotFromABC(p.abc[0], p.abc[1], p.abc[2]), S.tool, qRef || S.q, { front: sim.homeCfg.front, up: sim.homeCfg.up });
  }
  function moveTo(name, type, v) {          // returns plan or null (alarm raised)
    const S = sim.S, p = pt(name);
    if (!p) { alarm("Point " + name + " does not exist"); return null; }
    if (type === "J" || p.type === "joint") {
      const r = pointQ(p);
      if (!r.ok) { alarm(name + ": " + r.err + " – change the point (touch up) or the robot"); return null; }
      const lim = checkLimits(S.rb, r.q);
      if (lim.length) { alarm(name + ": axis limit " + lim.join(", ")); return null; }
      return planPTP(S.rb, S.q, r.q, sim.ovr, 1);
    }
    const R = rotFromABC(p.abc[0], p.abc[1], p.abc[2]);
    const pl = planLIN(S.rb, S.q, p.p, R, S.tool, v, sim.ovr);
    if (!pl.ok) { alarm("MoveL " + name + ": " + pl.err); return null; }
    if (pl.sing) sim.msg = "MoveL " + name + " passes near a wrist singularity (J5 ≈ 0) – axis speed limits slow it down";
    return pl;
  }

  /* ---------------- motion (shared by program, Go home, Go to point) */
  function startMotion(plan, tag) { sim.motion = { plan, t: 0, tag }; }
  function stepMotion(dt) {                  // returns true when the motion is finished
    const S = sim.S, m = sim.motion;
    if (!m) return true;
    if (sim.mode === "T1" && !sim.enable) { sim.msg = "T1: hold the enabling button (or press Space) to move"; return false; }
    if (sim.mode === "AUTO" && !sim.gateClosed) { alarm("Protective stop: safety gate open in AUTO"); return false; }
    let tn = Math.min(m.plan.T, m.t + dt);
    if (sim.mode === "T1" && dt > 0) {        // ISO 10218: TCP ≤ 250 mm/s in manual reduced speed – slow the time down
      const p0 = fk(S.rb, m.plan.at(m.t), S.tool).p;
      for (let it = 0; it < 4; it++) {
        const v = dist3(p0, fk(S.rb, m.plan.at(tn), S.tool).p) / dt;
        if (v <= SIM.t1Max) break;
        tn = m.t + (tn - m.t) * SIM.t1Max / v * 0.995;
      }
    }
    m.t = tn;
    const q = m.plan.at(m.t);
    const lim = checkLimits(S.rb, q);
    if (lim.length) { alarm("Axis limit " + lim.join(", ") + " during the move"); return true; }
    S.q = q;
    if (m.t >= m.plan.T - 1e-9) { S.q = m.plan.q1.slice(); sim.motion = null; return true; }
    return false;
  }

  /* ---------------- machine, door, conveyors, parts */
  function tcpPose() { const S = sim.S; return fk(S.rb, S.q, S.tool); }
  function partCentreAtTcp(st) { const h = sim.S.C.part.h; return [st.p[0] + st.R[2] * h / 2, st.p[1] + st.R[5] * h / 2, st.p[2] + st.R[8] * h / 2]; }
  function stepCell(dt) {
    const S = sim.S, C = S.C, M = sim.mach;
    // door
    const dd = dt / SIM.doorTime;
    S.door = M.doorCmd ? Math.min(1, S.door + dd) : Math.max(0, S.door - dd);
    // machine timer
    if (M.state === "run") {
      M.tLeft -= dt; M.cutting += dt;
      if (M.tLeft <= 0) { M.tLeft = 0; M.state = "done"; if (M.part) M.part.done = true; }
    } else M.idle += dt;
    // conveyors
    const sp = C.part.d + 60, v = SIM.convV * dt;
    const inP = S.parts.filter((p) => p.loc === "in").sort((a, b) => a.p[1] - b.p[1]);
    let moving = false;
    inP.forEach((p, i) => { const ty = C.infeed.pick[1] + i * sp; if (p.p[1] > ty) { p.p[1] = Math.max(ty, p.p[1] - v); moving = true; } });
    const last = inP[inP.length - 1];
    if (inP.length < 3 && (!last || last.p[1] < C.infeed.y1 - sp)) addPart("in", [C.infeed.x0, C.infeed.y1, C.infeed.z + C.part.h / 2], "z");
    for (const p of S.parts.filter((x) => x.loc === "out")) {
      p.p[1] -= v; moving = true;
      if (p.p[1] < C.outfeed.y1 + C.part.d / 2) { p.loc = "gone"; sim.stats.done++; }
    }
    S.parts = S.parts.filter((p) => p.loc !== "gone");
    if (moving) S.conv = (S.conv + v) % 100000;
    // held part follows the gripper
    const hp = S.parts.find((p) => p.held);
    if (hp) { const st = tcpPose(); hp.p = partCentreAtTcp(st); hp.ax = Math.abs(st.R[8]) > 0.7 ? "z" : "x"; }
  }
  function di(sig) {
    const S = sim.S, M = sim.mach, C = S.C;
    switch (sig) {
      case "diMachDone": return M.state === "done" || (M.state === "idle" && !M.part);
      case "diDoorOpen": return S.door >= 1;
      case "diDoorClosed": return S.door <= 0;
      case "diPartReady": return S.parts.some((p) => p.loc === "in" && Math.abs(p.p[1] - C.infeed.pick[1]) < 1);
    }
    return false;
  }
  function gripDone(val) {                   // attach / release the part at the end of the gripper motion
    const S = sim.S, C = S.C, M = sim.mach, st = tcpPose(), pc = partCentreAtTcp(st), tol = C.part.h * 0.4;
    if (val) {
      const p = S.parts.find((x) => !x.held && x.loc !== "out" && dist3(x.p, pc) < tol);
      if (!p) { alarm("Gripper closed but no part found (gripper sensor: no part)"); return; }
      p.held = true; p.loc = "grip";
      if (M.part === p) { M.part = null; M.state = "idle"; }
      sim.stats.picked++;
    } else {
      const p = S.parts.find((x) => x.held);
      if (!p) return;
      p.held = false;
      const F = C.machine.fixture, O = [C.outfeed.place[0], C.outfeed.place[1], C.outfeed.z + C.part.h / 2];
      const I = [C.infeed.pick[0], C.infeed.pick[1], C.infeed.z + C.part.h / 2];
      if (dist3(pc, F) < tol) { p.loc = "mach"; p.p = F.slice(); p.ax = "x"; M.part = p; M.state = "idle"; }
      else if (dist3(pc, O) < tol) { p.loc = "out"; p.p = O.slice(); p.ax = "z"; }
      else if (dist3(pc, I) < tol) { p.loc = "in"; p.p = I.slice(); p.ax = "z"; }
      else { p.loc = "gone"; S.parts = S.parts.filter((x) => x !== p); alarm("Part released in the air – part dropped! (release only at the fixture or on a conveyor)"); }
    }
  }
  function stepGrip(dt) {
    const g = sim.gripAct; if (!g) return true;
    g.t += dt; const S = sim.S;
    S.grip = g.from + (g.to - g.from) * Math.min(1, g.t / SIM.gripTime);
    if (g.t >= SIM.gripTime) { S.grip = g.to; sim.gripAct = null; gripDone(g.to); return true; }
    return false;
  }
  function gripper(val) { if (sim.S.live.alarm) return; sim.gripAct = { t: 0, from: sim.S.grip, to: val ? 1 : 0 }; }

  /* ---------------- program executor */
  function startIns(ins) {
    const S = sim.S, M = sim.mach;
    switch (ins.op) {
      case "MoveJ": case "MoveL": { const pl = moveTo(ins.pt, ins.op === "MoveJ" ? "J" : "L", ins.v); if (!pl) return null; startMotion(pl, "prog"); return { k: "move" }; }
      case "WaitDI": return { k: "wait", sig: ins.sig };
      case "SetDO": M.doorCmd = ins.val; return { k: "now" };
      case "PulseDO":
        if (!M.part) { alarm("Cycle start refused: no part in the machine fixture"); return null; }
        if (S.door > 0) { alarm("Cycle start refused: machine door not closed"); return null; }
        M.state = "run"; M.tLeft = SIM.machTime; M.part.done = false; return { k: "now" };
      case "Grip": gripper(ins.val); return { k: "grip" };
    }
    return { k: "now" };
  }
  function stepRun(dt) {
    const R = sim.run;
    if (!R.on || sim.S.live.alarm) return;
    if (!R.act) {
      const ins = sim.prog[R.pc];
      if (!ins) { R.on = false; return; }
      R.act = startIns(ins); R.tIns = 0;
      if (!R.act) return;
    }
    const a = R.act;
    if (sim.mode === "T1" && !sim.enable) { sim.msg = "T1: hold the enabling button (or press Space) to run the program (hold-to-run)"; return; }
    let done = false;
    if (a.k === "move") done = stepMotion(dt);
    else if (a.k === "wait") done = di(a.sig);
    else if (a.k === "grip") done = stepGrip(dt);
    else done = true;
    R.tIns += dt;
    if (sim.S.live.alarm) return;
    if (!done) return;
    if (R.pc >= LOOP_START) R.pass[R.pc] = (R.pass[R.pc] || 0) + R.tIns;
    R.act = null; R.pc++;
    if (R.step) R.on = false;
    if (R.pc >= sim.prog.length) {
      finishPass();
      if (R.loop && !R.step) R.pc = LOOP_START; else { R.on = false; R.pc = LOOP_START; }
    }
  }
  function finishPass() {
    const R = sim.run, M = sim.mach, P = sim.prog;
    const times = P.map((_, i) => (i >= LOOP_START ? R.pass[i] || 0 : null));
    const total = times.reduce((a, v) => a + (v || 0), 0);
    let wait = 0, robot = 0, dblIdle = 0, outside = 0;
    P.forEach((ins, i) => {
      if (times[i] === null) return;
      if (ins.op === "WaitDI" && ins.sig === "diMachDone") wait += times[i]; else robot += times[i];
      if (ins.dbl) dblIdle += times[i]; else if (ins.g !== "wait") outside += times[i];
    });
    const rb = sim.S.rb, swap = 180 / rb.vmax[5] + rb.tacc;   // turn the double gripper 180° on J6 (example)
    dblIdle += swap;
    const machIdle = Math.max(0, total - SIM.machTime);
    const dblCycle = Math.max(SIM.machTime + dblIdle, dblIdle + outside);
    R.n++;
    R.last = { n: R.n, times, total, wait, robot, machIdle, dblIdle, dblCycle, swap, outside, pph: total > 0 ? 3600 / total : 0, mode: sim.mode, ovr: sim.ovr, rb: rb.id };
    sim.cycles.push(R.last);
    R.pass = [];
    if (sim.onCycle) sim.onCycle(R.last);
  }

  /* ---------------- jog (teach pendant) */
  // kind "J": axis 0..5 joint · kind "L": axis 0..5 = X Y Z Rx Ry Rz in frame "base" | "tool"
  function jogStep(kind, axis, dir, amount, frame) {   // amount: deg or mm for this step; returns false if stopped
    const S = sim.S;
    if (kind === "J") {
      const q = S.q.slice(); q[axis] += dir * amount;
      const [lo, hi] = S.rb.lim[axis];
      if (q[axis] < lo || q[axis] > hi) { q[axis] = Math.max(lo, Math.min(hi, q[axis])); S.q = q; sim.msg = "J" + (axis + 1) + " at its axis limit (" + lo + " … " + hi + "°)"; return false; }
      S.q = q; return true;
    }
    const st = fk(S.rb, S.q, S.tool);
    let p = st.p.slice(), R = st.R.slice();
    if (axis < 3) {
      const d = [0, 0, 0]; d[axis] = dir * amount;
      const w = frame === "tool" ? [R[0] * d[0] + R[1] * d[1] + R[2] * d[2], R[3] * d[0] + R[4] * d[1] + R[5] * d[2], R[6] * d[0] + R[7] * d[1] + R[8] * d[2]] : d;
      p = [p[0] + w[0], p[1] + w[1], p[2] + w[2]];
    } else {
      const a = dir * amount * Math.PI / 180, M = rot3([Rx, Ry, Rz][axis - 3](a));
      R = frame === "tool" ? mul3(R, M) : mul3(M, R);
    }
    const r = ik(S.rb, p, R, S.tool, S.q);
    if (!r.ok) { alarm("Linear jog stopped: " + (/reach/.test(r.err) ? "out of reach (edge of the work envelope)" : r.err) + " – jog back or use joint jog"); return false; }
    for (let i = 0; i < 6; i++) if (Math.abs(r.q[i] - S.q[i]) > 8) { alarm("Linear jog stopped: wrist singularity / configuration change (J" + (i + 1) + " would jump) – use joint jog"); return false; }
    if (r.sing && Math.abs(r.q[4]) < Math.abs(S.q[4])) { alarm("Linear jog stopped: wrist singularity (J5 ≈ 0°) – jog J5 away from 0 with joint jog"); return false; }
    S.q = r.q; return true;
  }
  function jogContinuous(dt) {
    const j = sim.jog; if (!j) return;
    if (sim.mode !== "T1") { sim.jog = null; sim.msg = "Jog only in T1 (manual reduced speed)"; return; }
    if (!sim.enable) { sim.msg = "Hold the enabling button (or Space) to jog"; return; }
    const S = sim.S;
    const amount = j.kind === "J" ? S.rb.vmax[j.axis] * SIM.jogFrac * sim.ovr * dt
      : j.axis < 3 ? SIM.t1Max * sim.ovr * dt : 30 * sim.ovr * dt;   // linear: 250 mm/s × override · rotation: 30°/s × override (example)
    const p0 = fk(S.rb, S.q, S.tool).p, q0 = S.q.slice();
    let ok = jogStep(j.kind, j.axis, j.dir, amount, j.frame);
    if (ok && dt > 0) {                      // T1: keep the TCP ≤ 250 mm/s also in joint jog
      const v = dist3(p0, fk(S.rb, S.q, S.tool).p) / dt;
      if (v > SIM.t1Max * 1.001) { S.q = q0; ok = jogStep(j.kind, j.axis, j.dir, amount * SIM.t1Max / v, j.frame); }
    }
    if (!ok) sim.jog = null;
  }

  /* ---------------- history for the charts */
  let hAcc = 0, hPrevQ = null, hPrevP = null;
  function stepHist(dt) {
    hAcc += dt; if (hAcc < SIM.histDt) return;
    const S = sim.S, p = fk(S.rb, S.q, S.tool).p;
    const dq = hPrevQ ? S.q.map((v, i) => (v - hPrevQ[i]) / hAcc) : [0, 0, 0, 0, 0, 0];
    const vt = hPrevP ? dist3(p, hPrevP) / hAcc : 0;
    sim.hist.push({ t: sim.simT, q: S.q.slice(), pct: dq.map((v, i) => 100 * Math.abs(v) / S.rb.vmax[i]), v: vt });
    if (sim.hist.length > SIM.histLen) sim.hist.shift();
    hPrevQ = S.q.slice(); hPrevP = p; hAcc = 0;
  }

  /* ---------------- one simulation step (dt = simulated seconds) */
  function step(dt) {
    const S = sim.S;
    sim.simT += dt;
    if (!S.live.alarm) {
      if (sim.run.on) stepRun(dt);
      else {
        if (sim.motion && stepMotion(dt)) sim.motion = null;
        if (sim.gripAct) stepGrip(dt);
        jogContinuous(dt);
      }
    }
    stepCell(dt);
    stepHist(dt);
    const st = fk(S.rb, S.q, S.tool), tr = S.trail, l = tr[tr.length - 1];
    if (!l || dist3(l, st.p) > 4) { tr.push(st.p.slice()); if (tr.length > 600) tr.shift(); }
    S.live.moving = !!(sim.motion || (sim.jog && sim.enable && sim.mode === "T1"));
    if (S.show.ghost) {
      if (sim.motion) S.ghostQ = sim.motion.plan.q1.slice();
      else { const p = sim.selPt ? pt(sim.selPt) : null, r = p ? pointQ(p) : null; S.ghostQ = r && r.ok ? r.q : null; }
    } else S.ghostQ = null;
  }

  /* ---------------- public API */
  Object.assign(sim, {
    setRobot, resetCell, step, alarm, resetAlarm, pt, pointQ, gripper, jogStep, di,
    runProg(stepMode) {
      if (sim.S.live.alarm) return "Reset the alarm first";
      sim.motion = null; sim.jog = null;
      sim.run.on = true; sim.run.step = !!stepMode; sim.run.act = null; sim.msg = "";
      return "";
    },
    stopProg() { sim.run.on = false; sim.run.act = null; sim.motion = null; sim.gripAct = null; },
    ppToMain() { sim.stopProg(); sim.run.pc = 0; sim.run.pass = []; },
    goHome() {
      if (sim.run.on || sim.S.live.alarm) return;
      const pl = planPTP(sim.S.rb, sim.S.q, sim.S.C.home, sim.ovr, 1); startMotion(pl, "home");
    },
    goPoint(n, lin) {
      if (sim.run.on || sim.S.live.alarm) return;
      const p = pt(n); if (!p) return;
      const pl = moveTo(n, lin && p.type === "cart" ? "L" : "J", 250); if (pl) startMotion(pl, "goto");
    },
    touchUp(n) {
      const p = pt(n), S = sim.S; if (!p) return;
      const st = fk(S.rb, S.q, S.tool);
      p.p = st.p.map(r1); p.abc = st.abc.map(r1); if (p.type === "joint") p.q = S.q.map(r1);
      targets();
    },
    pose() {
      const S = sim.S, st = fk(S.rb, S.q, S.tool), r = ik(S.rb, st.p, st.R, S.tool, S.q);
      return { st, cfg: r.ok ? r.cfg : null, sing: Math.abs(S.q[4]) < 2 };
    },
    payload(q) {
      const S = sim.S, C = S.C, m = C.part.mass + C.gripMass;
      return { m, part: C.part.mass, grip: C.gripMass, cog: C.toolLen + C.part.h / 2 };
    },
  });
  setRobot(rbId);
  return sim;
}
