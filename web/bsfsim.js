/* Ball screw + guide factory – SHARED LIVE SIMULATION of the whole plant (item 3 builds it; items 4 communication, 5 quality,
 * 6 MES, 7 ERP, 8 PLC read it).  Guide: docs/42_bsf_layout_digital_twin.md §13 – §14.
 * Data: web/bsfmfg_data.js (ROUTES, MTYPES, MACHINES, SIGNALS, PLANT) + web/bsflay_data.js (zones, placement, doors, lots, AGV).
 * ALL VALUES ARE EXAMPLES (MTBF / MTTR, lot sizes, AGV data, power factors) – replace them with your own data.
 *
 * ================================================================ API
 *   import { getBSF, createSim, SIGFIELDS, STATES, ALARMS } from "./bsfsim.js";
 *   const B = getBSF();            // ONE shared instance = window.BSF (created on first call, 8 days warm-up, then a 10 Hz page clock)
 *   const X = createSim(opts);     // a SEPARATE instance (what-if, tests) – no clock; drive it with X.runFor(seconds, dt)
 *
 *   opts (createSim): { seed = 7, variant = "G", shifts = 2, oee = PLANT.oee, mix = { FABS: 120, FALG: 200 }, agvs = 2,
 *                       count = { "BS-TGR": 7, … } (machines per type, overrides MACHINES), lot = { BS: 20, … }, autoOrders = true,
 *                       warmDays = 0 (fast pre-run, then resetStats), failures = true }
 *
 *   Clock + control       B.t (sim s since day 1 06:00) · B.clock() → "D4 08:15" · B.day() · B.running · B.speed
 *                         B.run() · B.pause() · B.setSpeed(x) (sim s per real s, 1 … 3600) · B.step(dt) · B.runFor(s, dt = 30) · B.resetStats()
 *   Plant settings        B.setShifts(1|2|3) · B.setMix({ FABS, FALG }) (sets per day, daily auto order at 06:00) · B.setAGVs(n) · B.setOEE(0.5 … 1)
 *   Orders                B.addOrder({ product: "FABS"|"FALG"|"BS"|"BN"|"LG"|"LB", qty, due (sim s, optional), id (optional) }) → order
 *   Breakdowns            B.setMachineDown(id, true|false, minutes?)  (manual alarm 900; false = repaired)
 *   Read                  B.kpi() · B.snapshot() (JSON-serialisable, the base for item 4 HTTP + Modbus) · B.machine(id) · B.M (machine
 *                         state objects, stable) · B.byId · B.lots · B.orders · B.agvs · B.stores · B.log (events, newest first)
 *   Events                B.on("tick" | "lot" | "machine" | "agv" | "alarm" | "stock" | "order", fn(data, B)) → unsubscribe()
 *
 *   Machine state object (one per MACHINES id, same object for the whole life of the instance – item 4 maps it 1:1 to registers):
 *     { id, type, name, zone, area, kW, foot, x, y, rot, groups (= MTYPES sig),
 *       state ("OFF"|"IDLE"|"STARVED"|"SETUP"|"RUN"|"BLOCKED"|"DOWN"), code (STATES[state].code), since,
 *       lot, order, part, route, op, opName, pcsLot, pcsDone, progress (0…1 of the piece), cycleIdeal_s, lastCycle_s,
 *       good, scrap (counters UINT32), alarm (code, 0 = none), alarmText, lastAlarm { code, text, t },
 *       power_kW, energy_kWh, queue (lots waiting for this machine type), t { on, run, setup, down, blocked, starved, idle, off } (s),
 *       oee { A, P, Q, OEE }, util, mtbf_h, mttr_h, perf,
 *       sig { std {…}, grind {…}, tgr {…}, ind {…}, furn {…}, press {…}, meas {…}, torque {…}, cnc {…}, wash {…} }  ← only the groups of the type;
 *       field names + Modbus data types: SIGFIELDS (refreshed by B.signals(m) – snapshot() calls it for every machine) }
 *   Lot     { id, kind ("part"|"set"|"kit"), order, route, code, qty, qty0, i (op index), op, state ("raw"|"queue"|"setup"|"run"|"blocked"|
 *             "wait-agv"|"agv"|"move"|"done"|"scrapped"), zone, machine, t0, tDone, h [[op, machine, tIn, tOut, good, scrap]] }
 *   Order   { id, product, code, qty, due, t0, tDone, tShip, state ("open"|"complete"|"shipped"), done, lots [ids] }
 *   AGV     { id, x, y, state ("IDLE"|"TO_PICK"|"LOAD"|"TO_DROP"|"UNLOAD"|"TO_CHARGE"|"CHARGING"), soc %, lot, from, to, busy_s, mLoaded, mEmpty, trips }
 *   Stores  { raw { BS, BN, LG, LB } (blanks), kits { BS, LB } (assembly kits), sm { free { BS, BN, LG, LB }, <order> {…} } (supermarket),
 *             fg { FABS, FALG, BS, BN, LG, LB } (finished goods) }
 *
 * Model (time step, 10 Hz page clock × speed; sub-steps ≤ 10 s sim): lots follow the routings (ops with buy = true are skipped – bought);
 * a lot queues per machine TYPE, the first free instance takes it (same set-up first, else FIFO); set-up when the op changes or after
 * `batch` pieces; piece time = cyc / perf with ± 6 % variation, perf = OEE target / availability(MTBF, MTTR) so that the machines deliver
 * the capacity of capacity() in item 2; scrap per piece = op scrap %; failures: run hours to failure ~ exp(MTBF), repair ~ exp(MTTR);
 * furnaces (mod "furnace") load several lots up to 100 % of `batch` (mixed parts, same temperature) and start when full or after maxWait;
 * moves inside a zone + to a neighbour room = hand cart (3 – 5 min), between zones = AGV (transport order → nearest free AGV, lanes in
 * the main aisle, load / unload 45 s, battery + charging); zone out-buffer 12 lots, full → machine BLOCKED.
 * Daily: 06:00 auto order (mix) + order release (start qty = order qty / route yield, lots of LOT size), 07:00 raw + kit delivery
 * (incoming check of kits on QC-INC), 14:00 shipping of complete orders. Shifts: net time from 06:00 (breaks pulled to the end);
 * heat treatment ≥ 3 shifts.
 */
import { PLANT, ROUTES, ROUTE_KEYS, MTYPES, MACHINES, SIGNALS, opsOf, cycOf } from "./bsfmfg_data.js";
import { ZONES, ZONE_OF, PLACE, DOORS, LANES, CHARGERS, LOT, AGV as AGV0, adjKey, ADJ } from "./bsflay_data.js";
import { BS, BN, LG, LB } from "./bsfprod_data.js";

export const VERSION = "bsfsim 1.0";
export const STATES = {
  OFF: { code: 0, bit: 7, t: "no shift" }, IDLE: { code: 1, bit: 1, t: "ready, no order for this machine" }, RUN: { code: 2, bit: 0, t: "producing" },
  SETUP: { code: 3, bit: 2, t: "set-up / change-over" }, DOWN: { code: 4, bit: 3, t: "alarm / breakdown" }, BLOCKED: { code: 5, bit: 5, t: "finished lot cannot leave (out-buffer full)" },
  STARVED: { code: 6, bit: 6, t: "waiting for parts (upstream, furnace load not full, kits)" },
};
export const STATE_KEYS = Object.keys(STATES);
/* Modbus field list per SIGNALS group – item 4 builds the register map from it (REAL = 2 registers, ABCD; ASCIIn = n/2 registers) */
export const SIGFIELDS = {
  std: [["status", "UINT16", "", "bit0 run, bit1 idle, bit2 set-up, bit3 alarm, bit4 e-stop (hard-wired copy), bit5 blocked, bit6 starved, bit7 no shift"],
    ["mode", "UINT16", "", "0 manual, 1 auto, 2 set-up, 3 maintenance"], ["stateCode", "UINT16", "", "0 OFF 1 IDLE 2 RUN 3 SETUP 4 DOWN 5 BLOCKED 6 STARVED"],
    ["good", "UINT32", "pcs", "good parts counter"], ["scrap", "UINT32", "pcs", "scrap counter"], ["lastCycle_s", "REAL", "s", "last cycle time"],
    ["alarm", "UINT16", "", "alarm code (0 = none, ALARMS)"], ["order", "ASCII20", "", "lot / work order no."], ["part", "ASCII20", "", "part code"],
    ["power_kW", "REAL", "kW", "electrical power"], ["energy_kWh", "REAL", "kWh", "energy counter"]],
  grind: [["wheelSpeed_ms", "REAL", "m/s", "wheel speed vs"], ["spindlePower_pct", "REAL", "%", "spindle power"], ["dressCount", "UINT16", "", "dressing counter"],
    ["wheelDia_mm", "REAL", "mm", "wheel Ø"], ["oilTemp_C", "REAL", "°C", "coolant / oil temperature"], ["gaugeDev_um", "REAL", "µm", "in-process gauge deviation"]],
  tgr: [["pass", "UINT16", "", "pass no."], ["passes", "UINT16", "", "passes per part"], ["workSpeed_rpm", "REAL", "min⁻¹", "work speed"],
    ["leadComp_um_m", "REAL", "µm/m", "lead compensation"], ["screwTemp_C", "REAL", "°C", "screw temperature"], ["wheelTilt_deg", "REAL", "°", "wheel tilt (lead angle)"]],
  ind: [["power_kW", "REAL", "kW", "generator power"], ["freq_kHz", "REAL", "kHz", "frequency"], ["scan_mm_s", "REAL", "mm/s", "scan speed"],
    ["quenchFlow_l_min", "REAL", "l/min", "quench flow"], ["quenchTemp_C", "REAL", "°C", "quench temperature"], ["polymer_pct", "REAL", "%", "polymer concentration"],
    ["energyPart_kJ", "REAL", "kJ", "energy per part"], ["energyOK", "UINT16", "", "1 pass, 2 fail"]],
  furn: [["zone1_C", "REAL", "°C", "zone 1"], ["zone2_C", "REAL", "°C", "zone 2"], ["zone3_C", "REAL", "°C", "zone 3"], ["zone4_C", "REAL", "°C", "zone 4"],
    ["carbonPot_pct", "REAL", "%C", "carbon potential"], ["co_pct", "REAL", "%", "CO"], ["oilTemp_C", "REAL", "°C", "quench oil"],
    ["loadNo", "UINT16", "", "load no."], ["step", "UINT16", "", "program step"], ["remain_min", "REAL", "min", "remaining time"]],
  press: [["runoutBefore_um", "REAL", "µm", "run-out before"], ["runoutAfter_um", "REAL", "µm", "run-out after"], ["force_kN", "REAL", "kN", "press force"],
    ["stroke_mm", "REAL", "mm", "stroke"], ["bends", "UINT16", "", "bend count per part"]],
  meas: [["ep_um", "REAL", "µm", "e_p"], ["vup_um", "REAL", "µm", "v_up"], ["v300_um", "REAL", "µm", "v_300"], ["v2pi_um", "REAL", "µm", "v_2π"],
    ["grade", "UINT16", "", "3 = C3, 5 = C5, 7 = C7, 0 = reject"], ["matTemp_C", "REAL", "°C", "material temperature"]],
  torque: [["torqueMean_Nm", "REAL", "N·m", "preload torque mean"], ["torqueVar_Nm", "REAL", "N·m", "torque variation"], ["drag_N", "REAL", "N", "drag force"],
    ["result", "UINT16", "", "1 OK, 2 NOK"], ["cls", "UINT16", "", "ball / preload class"]],
  cnc: [["spindle_rpm", "REAL", "min⁻¹", "spindle speed"], ["spindleLoad_pct", "REAL", "%", "spindle load"], ["toolNo", "UINT16", "", "tool no."],
    ["toolLife_pct", "UINT16", "%", "tool life left"], ["feedOvr_pct", "UINT16", "%", "feed override"]],
  wash: [["bathTemp_C", "REAL", "°C", "bath temperature"], ["conduct_uS", "REAL", "µS/cm", "conductivity"], ["belt_m_min", "REAL", "m/min", "belt speed"]],
};
/* reliability class per machine type (example MTBF / MTTR in hours) + alarm codes */
const REL = {
  furn: { mtbf: 250, mttr: 4, a: [[401, "furnace zone temperature deviation"], [402, "carbon potential out of band"], [403, "quench oil temperature high"]] },
  ind: { mtbf: 120, mttr: 2, a: [[301, "generator fault (inverter)"], [302, "quench flow low"], [303, "energy monitor out of window"]] },
  tgr: { mtbf: 80, mttr: 2.5, a: [[211, "wheel profile dressing fault"], [212, "lead probe out of range"], [213, "oil temperature drift > 0.5 K"]] },
  grind: { mtbf: 80, mttr: 2, a: [[201, "in-process gauge fault"], [202, "wheel balance vibration high"], [203, "coolant flow low"]] },
  cnc: { mtbf: 60, mttr: 1.5, a: [[101, "spindle overload"], [102, "tool broken (tool monitor)"], [103, "chip conveyor jam"], [104, "axis following error"]] },
  press: { mtbf: 150, mttr: 1, a: [[501, "press force limit"], [502, "run-out sensor fault"]] },
  meas: { mtbf: 300, mttr: 1, a: [[601, "laser beam interrupted"], [602, "material temperature out of 20 ± 0.5 °C"]] },
  torque: { mtbf: 400, mttr: 0.5, a: [[701, "torque sensor fault"], [702, "ball feeder empty / jam"]] },
  wash: { mtbf: 200, mttr: 1, a: [[801, "bath temperature low"], [802, "belt drive fault"]] },
  misc: { mtbf: 150, mttr: 0.75, a: [[151, "band / blade change needed"], [152, "safety door open (production stop)"], [153, "feeder fault"]] },
};
export const ALARMS = Object.fromEntries(Object.values(REL).flatMap((r) => r.a).concat([[900, "manual stop / breakdown set by the user"]]));
const relOf = (T) => (T.sig.includes("furn") ? "furn" : T.sig.includes("ind") ? "ind" : T.sig.includes("tgr") ? "tgr" : T.sig.includes("grind") ? "grind"
  : T.sig.includes("cnc") ? "cnc" : T.sig.includes("press") ? "press" : T.sig.includes("meas") ? "meas" : T.sig.includes("torque") ? "torque" : T.sig.includes("wash") ? "wash" : "misc");
const PWR = { run: 0.55, base: 0.15, down: 0.05, off: 0.02, furnRun: 0.6, furnHold: 0.3, indRun: 0.7 };
export const INFRA = { hvac: 55, airShift: 35, airOff: 8, light: 20, lightOff: 3 };   // kW (grinding-room HVAC runs 24 h)
const CODE = { BS: BS.code, BN: BN.code, LG: LG.code, LB: LB.code, FABS: BS.code + " + " + BN.code, FALG: LG.code + " + 2 × " + LB.code };
const KIT_AT = { FABS: "10", LB: "80" };             // op that consumes an assembly kit (balls, seals, grease / end caps)
const MAXWAIT = { "HT-TMP": 45, "HT-CAR": 600 };     // min a furnace waits for a full load (tempering must start ≤ 1 h after hardening)
const BUF = 12;                                      // zone out-buffer (lots waiting for an AGV)
const DAY = 86400;

export function rng(seed = 7) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const isSet = (r) => r === "FABS" || r === "FALG";
const r2 = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/* ================================================================ createSim */
export function createSim(opts = {}) {
  const R = rng(opts.seed ?? 7), U = () => R(), expo = (mean) => -mean * Math.log(1 - U() * 0.999999);
  const variant = opts.variant || "G", failures = opts.failures !== false;
  const lotSize = { ...LOT, ...(opts.lot || {}) };
  const B = {
    VERSION, t: 0, speed: 60, running: true, shifts: opts.shifts ?? PLANT.shifts, hShift: PLANT.hShift, oee: opts.oee ?? PLANT.oee,
    mix: { FABS: PLANT.qty.FABS, FALG: PLANT.qty.FALG, ...(opts.mix || {}) }, autoOrders: opts.autoOrders !== false, variant,
    M: [], byId: {}, Q: {}, lots: [], lotsDone: [], orders: [], agvs: [], tq: [], log: [], listeners: {}, pending: [],
    stores: { raw: {}, kits: { BS: 0, LB: 0 }, sm: { free: { BS: 0, BN: 0, LG: 0, LB: 0 } }, fg: { FABS: 0, FALG: 0, BS: 0, BN: 0, LG: 0, LB: 0 } },
    stats: null, days: [], today: null, seq: { lot: 1, order: 1, agv: 1, load: 1 }, hist: [], lotSize,
  };
  const emit = (ev, d) => { const L = B.listeners[ev]; if (L) for (const f of L) { try { f(d, B); } catch (e) { console.error(e); } } };
  const logE = (kind, msg, lvl = "info", extra) => { const e = { t: B.t, clock: clock(B.t), kind, msg, lvl, ...(extra || {}) }; B.log.unshift(e); if (B.log.length > 300) B.log.pop(); return e; };
  B.on = (ev, f) => { (B.listeners[ev] = B.listeners[ev] || []).push(f); return () => { B.listeners[ev] = (B.listeners[ev] || []).filter((x) => x !== f); }; };
  const clock = (t) => { const c = t + 6 * 3600, d = Math.floor(c / DAY) + 1, s = ((c % DAY) + DAY) % DAY, h = Math.floor(s / 3600), mi = Math.floor((s % 3600) / 60); return `D${d} ${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`; };   // calendar day (midnight); the production day starts 06:00
  B.clock = () => clock(B.t); B.day = () => Math.floor(B.t / DAY) + 1; B.clockOf = clock;
  const tod = () => ((B.t % DAY) + DAY) % DAY;
  const inShift = (ht) => tod() < (ht ? Math.max(3, B.shifts) : B.shifts) * B.hShift * 3600;

  /* ---------------- routes (bought ops skipped) */
  const RT = {};
  for (const r of ROUTE_KEYS) {
    const ops = opsOf(r, variant).filter((o) => !o.buy).map((o) => ({ ...o, cycM: cycOf(o, variant), zone: ZONE_OF[o.m], furnace: o.mod === "furnace" }));
    let y = 1; for (const o of ops) y *= 1 - o.scrap / 100;
    RT[r] = { ops, yield: y, end: isSet(r) ? "PACK" : "ASSY", start: isSet(r) ? "ASSY" : "RAW" };
  }
  const KITOP = { r: "KIT", no: "IN", op: "Incoming check of bought parts (kits)", m: "QC-INC", cycM: 0.1 / 4, setup: 0, batch: 400, scrap: 0, zone: "RAW" };   // 0.1 min per incoming part, ≈ 4 parts per kit
  B.routes = RT;

  /* ---------------- machines */
  const counts = {}; MACHINES.forEach((m) => { counts[m.type] = (counts[m.type] || 0) + 1; });
  Object.assign(counts, opts.count || {});
  const usedTypes = new Set(ROUTE_KEYS.flatMap((r) => RT[r].ops.map((o) => o.m)).concat(["QC-INC"]));
  for (const [type, n] of Object.entries(counts)) {
    const T = MTYPES[type]; if (!T) continue;
    for (let i = 0; i < n; i++) {
      const id = `${type}-${String(i + 1).padStart(2, "0")}`, P = PLACE[id] || [0, 0, 0, "S"], rc = REL[relOf(T)];
      const A = rc.mtbf / (rc.mtbf + rc.mttr);
      const m = {
        id, type, name: T.n, zone: ZONE_OF[type] || "SOFT", area: T.area, kW: T.kW, foot: T.foot, x: P[0], y: P[1], rot: P[2], face: P[3], groups: T.sig.slice(),
        state: "OFF", code: 0, since: 0, lot: "", order: "", part: "", route: "", op: "", opName: "", pcsLot: 0, pcsDone: 0, progress: 0, cycleIdeal_s: 0, lastCycle_s: 0,
        good: 0, scrap: 0, alarm: 0, alarmText: "", lastAlarm: null, power_kW: 0, energy_kWh: 0, queue: 0,
        t: { on: 0, run: 0, setup: 0, down: 0, blocked: 0, starved: 0, idle: 0, off: 0 }, oee: { A: 0, P: 0, Q: 0, OEE: 0 }, util: 0,
        mtbf_h: rc.mtbf, mttr_h: rc.mttr, avail0: A, perf: 1, used: usedTypes.has(type), batch: !!T.sig.includes("furn"), ht: !!T.shifts3, lab: !!T.lab,
        sig: {}, _job: null, _ttf: expo(rc.mtbf * 3600), _rep: 0, _man: false, _setupKey: "", _setupCnt: 0, _ideal: 0, _blocked: null, _loadNo: 0, _rel: relOf(T),
      };
      for (const g of m.groups) m.sig[g] = {};
      B.M.push(m); B.byId[id] = m; (B.Q[type] = B.Q[type] || []);
    }
  }
  // furnaces: recipe time is fixed (perf 1) – their OEE losses are partial loads + waiting for a full load
  const setPerf = () => { for (const m of B.M) m.perf = m.batch ? 1 : Math.min(1, Math.max(0.3, B.oee / m.avail0)); };
  setPerf();
  const byType = {}; for (const m of B.M) (byType[m.type] = byType[m.type] || []).push(m);
  B.byType = byType;

  /* ---------------- stores */
  const startPerDay = (r) => (r === "BS" || r === "BN" ? B.mix.FABS : r === "LG" ? B.mix.FALG : 2 * B.mix.FALG) / RT[r].yield;
  for (const r of ["BS", "BN", "LG", "LB"]) B.stores.raw[r] = Math.round(startPerDay(r) * 6);
  B.stores.kits = { BS: B.mix.FABS * 4, LB: B.mix.FALG * 2 * 4 };
  const RAWINFO = {
    BS: { code: "RM-50CrMo4-D36", n: "50CrMo4 +QT bar Ø36 × 6 m (5 blanks per bar)", per: 5 }, BN: { code: "RM-20MnCr5-D85", n: "20MnCr5 bar Ø85 × 6 m (55 slugs per bar)", per: 55 },
    LG: { code: "RM-C55-RAIL25", n: "C55 drawn rail profile size 25 × 4 m (3 blanks per bar)", per: 3 }, LB: { code: "RM-20CrMo4-BLK25", n: "20CrMo4 drawn block profile × 3 m (48 bodies per bar)", per: 48 },
  };
  B.RAWINFO = RAWINFO;

  /* ---------------- AGVs */
  const mkAgv = () => { const c = CHARGERS[(B.seq.agv - 1) % CHARGERS.length]; return { id: "AGV-" + String(B.seq.agv++).padStart(2, "0"), x: c[0], y: c[1], state: "CHARGING", soc: 90, lot: null, from: "", to: "", busy_s: 0, mLoaded: 0, mEmpty: 0, trips: 0, path: null, pi: 0, ph: 0, idle_s: 0, retire: false, charger: c }; };
  for (let i = 0; i < (opts.agvs ?? AGV0.n); i++) B.agvs.push(mkAgv());

  /* ---------------- stats */
  B.resetStats = (keep = false) => {
    B.prevKpi = keep ? B.kpi() : null; const keepDays = keep ? B.days.slice() : [], keepHist = keep ? B.hist.slice() : [];
    B.stats = { t0: B.t, out: { FABS: 0, FALG: 0, BS: 0, BN: 0, LG: 0, LB: 0 }, energy: 0, energyM: 0, energyI: 0, agvBusy: 0, agvTime: 0, trips: 0, tripsFT: {}, mLoaded: 0, mEmpty: 0,
      lit: { area: 0, n: 0, flow: 0 }, ordersDone: 0, leadSum: 0, flow: {}, scrap: 0 };
    for (const m of B.M) { for (const k in m.t) m.t[k] = 0; m._ideal = 0; m._g0 = m.good; m._s0 = m.scrap; m._e0 = m.energy_kWh; }
    for (const a of B.agvs) { a.busy_s = 0; a.mLoaded = 0; a.mEmpty = 0; a.trips = 0; }
    B.hist = keepHist; B.days = keepDays;
    B.today = keep && B.today ? B.today : newDay();
  };
  const newDay = () => ({ day: B.day(), out: { FABS: 0, FALG: 0, BS: 0, BN: 0, LG: 0, LB: 0 }, energy: 0, scrap: 0 });

  /* ---------------- orders + lots */
  const newLot = (o) => { const L = { id: "L" + String(B.seq.lot++).padStart(5, "0"), kind: o.kind || "part", order: o.order || "", route: o.route, code: CODE[o.route] || o.route, qty: o.qty, qty0: o.qty, i: 0, op: "", state: o.state || "raw", zone: o.zone || "RAW", machine: "", t0: B.t, tRel: B.t, tDone: 0, tQ: B.t, h: [] }; B.lots.push(L); return L; };
  const releaseParts = (ord, r, need) => {   // need = good pieces wanted at the end of the route
    const start = Math.ceil(need / RT[r].yield - 1e-9), n = Math.ceil(start / lotSize[r]);
    for (let k = 0; k < n; k++) { const q = Math.min(lotSize[r], start - k * lotSize[r]); const L = newLot({ route: r, qty: q, order: ord.id }); ord.lots.push(L.id); }
  };
  B.addOrder = (o = {}) => {
    const product = String(o.product || "FABS").toUpperCase(); if (!RT[product]) throw new Error("unknown product " + product);
    const qty = Math.max(1, Math.round(+o.qty || 1));
    const ord = { id: o.id || "SO-" + String(B.seq.order++).padStart(4, "0"), product, code: CODE[product], qty, due: o.due ?? B.t + 7 * DAY, t0: B.t, tDone: 0, tShip: 0, state: "open", done: 0, lots: [], need: {}, asm: 0, topups: 0 };
    B.orders.push(ord); B.stores.sm[ord.id] = { BS: 0, BN: 0, LG: 0, LB: 0 };
    if (product === "FABS") { releaseParts(ord, "BS", qty); releaseParts(ord, "BN", qty); }
    else if (product === "FALG") { releaseParts(ord, "LG", qty); releaseParts(ord, "LB", 2 * qty); }
    else releaseParts(ord, product, qty);
    if (B.orders.length > 400) { const k = B.orders.findIndex((x) => x.state === "shipped"); if (k >= 0) { delete B.stores.sm[B.orders[k].id]; B.orders.splice(k, 1); } }
    logE("order", `order ${ord.id}: ${qty} × ${product} (${ord.code}) released, due ${clock(ord.due)}`); emit("order", ord);
    return ord;
  };
  const orderOf = (id) => B.orders.find((o) => o.id === id);
  // assembly lots from the supermarket (pegged to the order, free stock as reserve)
  const smTake = (ord, r, n) => { const s = B.stores.sm[ord.id], f = B.stores.sm.free; const a = Math.min(s[r], n); s[r] -= a; const b = Math.min(f[r], n - a); f[r] -= b; return a + b; };
  const smHave = (ord, r) => (B.stores.sm[ord.id] ? B.stores.sm[ord.id][r] : 0) + B.stores.sm.free[r];
  function tryAssembly(ord) {
    if (ord.state !== "open" || (ord.product !== "FABS" && ord.product !== "FALG")) return;
    const r = ord.product, L = lotSize[r];
    const openAsm = B.lots.filter((l) => l.order === ord.id && l.route === r && l.state !== "done" && l.state !== "scrapped").reduce((s, l) => s + l.qty, 0);
    let rest = ord.qty - ord.done - openAsm; if (rest <= 0) return;
    const partsOpen = B.lots.some((l) => l.order === ord.id && l.route !== r && l.state !== "done" && l.state !== "scrapped");
    const [ra, rb, kb] = r === "FABS" ? ["BS", "BN", 1] : ["LG", "LB", 2];
    while (rest > 0) {
      const can = Math.min(smHave(ord, ra), Math.floor(smHave(ord, rb) / kb));
      const n = Math.min(L, rest);
      if (can >= n || (!partsOpen && can > 0)) {
        const q = Math.min(n, can); smTake(ord, ra, q); smTake(ord, rb, q * kb);
        const A = newLot({ route: r, qty: q, order: ord.id, kind: "set", state: "move", zone: "ASSY" }); ord.lots.push(A.id); rest -= q;
        enqueue(A); emit("lot", { ev: "created", lot: A }); emit("stock", { what: "sm" });
      } else break;
    }
    if (rest > 0 && !partsOpen && ord.topups < 3) {   // scrap was higher than the yield allowance → re-make the missing parts
      const missA = Math.max(0, rest - smHave(ord, ra)), missB = Math.max(0, rest * kb - smHave(ord, rb));
      if (missA > 0) releaseParts(ord, ra, missA); if (missB > 0) releaseParts(ord, rb, missB);
      if (missA > 0 || missB > 0) { ord.topups++; logE("order", `order ${ord.id}: top-up lots for scrap (${missA} ${ra}, ${missB} ${rb})`, "warn"); }
    }
  }
  function partOrderDone(ord) {     // component-only orders
    if (ord.state !== "open" || isSet(ord.product)) return;
    const s = B.stores.sm[ord.id];
    if (s[ord.product] >= ord.qty - ord.done) { const q = ord.qty - ord.done; s[ord.product] -= q; ord.done += q; B.stores.fg[ord.product] += q; completeOrder(ord); }
    else if (!B.lots.some((l) => l.order === ord.id && l.state !== "done" && l.state !== "scrapped") && ord.topups < 3) { releaseParts(ord, ord.product, ord.qty - ord.done - s[ord.product]); ord.topups++; }
  }
  function completeOrder(ord) {
    ord.state = "complete"; ord.tDone = B.t; B.stats.ordersDone++; B.stats.leadSum += ord.tDone - ord.t0;
    const s = B.stores.sm[ord.id]; if (s) for (const k in s) { B.stores.sm.free[k] += s[k]; s[k] = 0; }
    logE("order", `order ${ord.id} complete (${ord.qty} × ${ord.product}), lead time ${r2((ord.tDone - ord.t0) / 3600, 1)} h`); emit("order", ord); emit("stock", { what: "fg" });
  }

  /* ---------------- moving lots */
  function enqueue(L) {
    const op = RT[L.route].ops[L.i];
    L.state = "queue"; L.op = op.no; L.zone = op.zone; L.machine = ""; L.tQ = B.t;
    B.Q[op.m].push(L);
  }
  const later = (dt, fn) => B.pending.push({ t: B.t + dt, fn });
  function advance(L, fromZone) {   // after an op (or at release)
    const ops = RT[L.route].ops;
    if (L.qty <= 0) { L.state = "scrapped"; L.tDone = B.t; const k = B.lots.indexOf(L); if (k >= 0) B.lots.splice(k, 1); B.stats.lit.n++; B.stats.lit.flow += B.t - L.tRel; logE("lot", `lot ${L.id} fully scrapped`, "warn"); emit("lot", { ev: "scrapped", lot: L }); return true; }
    const toZone = L.i < ops.length ? ops[L.i].zone : RT[L.route].end;
    if (toZone === fromZone) { L.state = "move"; later(180, () => arrive(L, toZone)); return true; }
    const ak = adjKey(fromZone, toZone);
    if (ak) { L.state = "move"; later(ADJ[ak][0] * 60, () => arrive(L, toZone)); return true; }
    if (B.tq.filter((q) => q.from === fromZone).length >= BUF) return false;   // out-buffer full
    L.state = "wait-agv"; L.zone = fromZone; B.tq.push({ lot: L, from: fromZone, to: toZone, t: B.t });
    return true;
  }
  function arrive(L, zone) {
    L.zone = zone;
    const ops = RT[L.route].ops;
    if (L.i < ops.length) { enqueue(L); emit("lot", { ev: "arrived", lot: L }); return; }
    L.state = "done"; L.tDone = B.t; L.machine = "";
    B.stats.lit.n++; B.stats.lit.flow += L.tDone - L.tRel;
    const f = B.stats.flow[L.route] || (B.stats.flow[L.route] = { n: 0, s: 0, pcs: 0 }); f.n++; f.s += L.tDone - L.tRel; f.pcs += L.qty;
    B.stats.out[L.route] += L.qty; B.today.out[L.route] += L.qty;
    const ord = orderOf(L.order);
    if (isSet(L.route)) {
      B.stores.fg[L.route] += L.qty;
      if (ord && ord.state === "open") { ord.done += L.qty; if (ord.done >= ord.qty) { const extra = ord.done - ord.qty; ord.done = ord.qty; if (extra) logE("lot", `${extra} extra sets of ${ord.id} stay in the FG store as free stock`); completeOrder(ord); } }
    } else {
      if (ord && B.stores.sm[ord.id]) B.stores.sm[ord.id][L.route] += L.qty; else B.stores.sm.free[L.route] += L.qty;
      if (ord) { tryAssembly(ord); partOrderDone(ord); }
    }
    B.lotsDone.push(L); B.lots.splice(B.lots.indexOf(L), 1); if (B.lotsDone.length > 400) B.lotsDone.shift();
    emit("lot", { ev: "done", lot: L }); emit("stock", { what: isSet(L.route) ? "fg" : "sm" });
  }

  /* ---------------- machines: dispatch + processing */
  const setState = (m, s) => { if (m.state === s) return; const old = m.state; m.state = s; m.code = STATES[s].code; m.since = B.t; emit("machine", { m, from: old, to: s }); };
  function pick(m) {
    const q = B.Q[m.type]; if (!q.length) return null;
    const ok = (L) => { const op = RT[L.route] ? RT[L.route].ops[L.i] : KITOP; const kit = KIT_AT[L.route] === op.no ? (L.route === "FABS" ? "BS" : "LB") : null; return !kit || B.stores.kits[kit] >= L.qty; };
    for (let k = 0; k < q.length; k++) { const L = q[k]; const op = RT[L.route] ? RT[L.route].ops[L.i] : KITOP; if (L.route + "|" + op.no === m._setupKey && m._setupCnt + L.qty <= op.batch && ok(L)) return q.splice(k, 1)[0]; }
    for (let k = 0; k < q.length; k++) if (ok(q[k])) return q.splice(k, 1)[0];
    return null;
  }
  const pieceDur = (m, op) => op.cycM * 60 / m.perf * (1 + 0.06 * (U() + U() + U() - 1.5) * 1.15);
  function startJob(m, L) {
    const op = RT[L.route] ? RT[L.route].ops[L.i] : KITOP;
    const key = L.route + "|" + op.no;
    let setup = 0;
    if (key !== m._setupKey || m._setupCnt + L.qty > op.batch) { setup = op.setup * 60 / m.perf; m._setupKey = key; m._setupCnt = 0; }
    m._setupCnt += L.qty;
    const kit = KIT_AT[L.route] === op.no ? (L.route === "FABS" ? "BS" : "LB") : null;
    if (kit) { B.stores.kits[kit] -= L.qty; emit("stock", { what: "kits" }); }
    m._job = { lots: [L], op, n: L.qty, done: 0, good: 0, sc: 0, setup, piece: pieceDur(m, op), left: 0, tIn: B.t };
    m._job.left = m._job.piece;
    L.state = setup > 0 ? "setup" : "run"; L.machine = m.id; L.op = op.no;
    m.lot = L.id; m.order = L.order; m.part = L.code; m.route = L.route; m.op = op.no; m.opName = op.op; m.pcsLot = L.qty; m.pcsDone = 0; m.cycleIdeal_s = op.cycM * 60;
    emit("lot", { ev: "start", lot: L, m: m.id });
  }
  function startLoad(m) {   // furnace: several lots, fill ≤ 100 %
    const q = B.Q[m.type]; if (!q.length) return false;
    const frac = (L) => L.qty / RT[L.route].ops[L.i].batch;
    let fill = 0; for (const L of q) fill += frac(L);
    const waited = (B.t - q[0].tQ) / 60;
    if (fill < 0.999 && waited < (MAXWAIT[m.type] || 60)) return false;
    const lots = []; let f = 0;
    for (let k = 0; k < q.length;) { const L = q[k], fr = frac(L); if (!lots.length || f + fr <= 1.0001) { lots.push(L); f += fr; q.splice(k, 1); } else k++; }
    const dur = Math.max(...lots.map((L) => { const op = RT[L.route].ops[L.i]; return op.cycM * op.batch; })) * 60 / m.perf;
    const op = RT[lots[0].route].ops[lots[0].i];
    m._job = { lots, op, n: lots.reduce((s, L) => s + L.qty, 0), done: 0, good: 0, sc: 0, setup: 0, piece: dur, left: dur, tIn: B.t, furnace: true, fill: f };
    m._loadNo = B.seq.load++;
    for (const L of lots) { L.state = "run"; L.machine = m.id; L.op = RT[L.route].ops[L.i].no; emit("lot", { ev: "start", lot: L, m: m.id }); }
    m.lot = lots.map((L) => L.id).join(","); m.order = lots[0].order; m.part = [...new Set(lots.map((L) => L.code))].join(" / "); m.route = lots[0].route; m.op = op.no; m.opName = op.op;
    m.pcsLot = m._job.n; m.pcsDone = 0; m.cycleIdeal_s = dur * m.perf;
    logE("machine", `${m.id} load ${m._loadNo} started: ${lots.length} lots, ${m._job.n} pcs, fill ${Math.round(f * 100)} %, ${r2(dur / 3600, 1)} h`);
    return true;
  }
  function finishJob(m) {
    const J = m._job; m._job = null;
    for (const L of J.lots) {
      const op = J.furnace ? RT[L.route].ops[L.i] : J.op;
      let good = L.qty, sc = 0;
      if (J.furnace) { for (let k = 0; k < L.qty; k++) if (U() < op.scrap / 100) sc++; good = L.qty - sc; m.good += good; m.scrap += sc; m._ideal += op.cycM * 60 * L.qty; }
      else { good = J.good; sc = J.sc; }
      L.h.push([op.no, m.id, Math.round(J.tIn), Math.round(B.t), good, sc]); if (L.h.length > 30) L.h.shift();
      L.qty = good; B.stats.scrap += sc; B.today.scrap += sc;
      if (L.kind === "kit") { B.stores.kits[L.route.slice(4)] += L.qty; L.state = "done"; L.tDone = B.t; B.lots.splice(B.lots.indexOf(L), 1); logE("stock", `kits ${L.route.slice(4)} +${L.qty} after incoming check`); emit("stock", { what: "kits" }); continue; }
      L.i++;
      if (!advance(L, m.zone)) { m._blocked = (m._blocked || []).concat([L]); L.state = "blocked"; }
      emit("lot", { ev: "op-done", lot: L, m: m.id, op: op.no, good, scrap: sc });
    }
    m.lastCycle_s = J.furnace ? J.piece : m.lastCycle_s;
    m.lot = ""; m.order = ""; m.part = ""; m.route = ""; m.op = ""; m.opName = ""; m.progress = 0; m.pcsDone = 0; m.pcsLot = 0;
  }
  function fail(m, code, text, rep) {
    m.alarm = code; m.alarmText = text; m.lastAlarm = { code, text, t: B.t, clock: clock(B.t) }; m._rep = rep;
    setState(m, "DOWN");
    const e = logE("alarm", `${m.id}: alarm ${code} – ${text}${rep ? ` (repair ≈ ${Math.round(rep / 60)} min)` : ""}`, "alarm", { m: m.id, code });
    emit("alarm", { m, code, text, on: true, e });
  }
  function repaired(m) {
    const code = m.alarm; m.alarm = 0; m.alarmText = ""; m._man = false; m._rep = 0; m._ttf = expo(m.mtbf_h * 3600);
    const e = logE("alarm", `${m.id}: alarm ${code} cleared – machine ready`, "info", { m: m.id, code });
    emit("alarm", { m, code, on: false, e }); setState(m, inShift(m.ht) ? "IDLE" : "OFF");
  }
  let needSet = new Set(), needT = -1e9;
  function updNeed() {   // machine types still needed by WIP lots → STARVED vs IDLE
    needSet = new Set();
    for (const L of B.lots) { if (L.kind === "kit") { needSet.add("QC-INC"); continue; } const ops = RT[L.route].ops; for (let k = L.i; k < ops.length; k++) needSet.add(ops[k].m); }
    for (const o of B.orders) if (o.state === "open") { if (o.product === "FABS") RT.FABS.ops.forEach((x) => needSet.add(x.m)); if (o.product === "FALG") RT.FALG.ops.forEach((x) => needSet.add(x.m)); }
    needT = B.t;
  }
  function stepMachine(m, dt) {
    const shift = inShift(m.ht), tt = m.t;
    // blocked lots try to leave
    if (m._blocked && m._blocked.length) { m._blocked = m._blocked.filter((L) => !advance(L, m.zone)); if (!m._blocked.length) m._blocked = null; }
    if (m.state === "DOWN") {
      tt.down += dt; tt.on += dt;
      if (!m._man || m._rep > 0) { m._rep -= dt; if (m._rep <= 0 && !(m._man && m._rep === 0)) repaired(m); }
      return energy(m, dt);
    }
    if (m._blocked) { setState(m, "BLOCKED"); tt.blocked += dt; tt.on += dt; return energy(m, dt); }
    const J = m._job;
    if (J && J.furnace) {   // furnaces finish a load even outside the shift
      tt.run += dt; tt.on += dt; setState(m, "RUN"); J.left -= dt; m.progress = 1 - Math.max(0, J.left) / J.piece;
      if (failures) { m._ttf -= dt; if (m._ttf <= 0) { const a = REL[m._rel].a[Math.floor(U() * REL[m._rel].a.length)]; fail(m, a[0], a[1], Math.max(300, expo(m.mttr_h * 3600))); return energy(m, dt); } }
      if (J.left <= 0) finishJob(m);
      return energy(m, dt);
    }
    if (!shift) { setState(m, "OFF"); tt.off += dt; return energy(m, dt); }
    tt.on += dt;
    if (!J) {
      let started = false;
      if (m.batch) started = startLoad(m); else { const L = pick(m); if (L) { startJob(m, L); started = true; } }
      if (!started) { const s = B.Q[m.type].length || needSet.has(m.type) ? "STARVED" : "IDLE"; setState(m, s); tt[s === "STARVED" ? "starved" : "idle"] += dt; return energy(m, dt); }
      if (m._job.furnace) { setState(m, "RUN"); return energy(m, dt); }
    }
    const j = m._job;
    let rest = dt;
    if (j.setup > 0) { const u = Math.min(rest, j.setup); j.setup -= u; rest -= u; tt.setup += u; setState(m, "SETUP"); if (j.setup <= 0) j.lots[0].state = "run"; }
    if (rest > 0 && j.setup <= 0) {
      setState(m, "RUN"); tt.run += rest;
      if (failures) { m._ttf -= rest; if (m._ttf <= 0) { const a = REL[m._rel].a[Math.floor(U() * REL[m._rel].a.length)]; fail(m, a[0], a[1], Math.max(300, expo(m.mttr_h * 3600))); return energy(m, dt); } }
      j.left -= rest;
      while (j.left <= 0 && m._job) {
        const op = j.op, isScrap = U() < op.scrap / 100;
        if (isScrap) { j.sc++; m.scrap++; } else { j.good++; m.good++; }
        j.done++; m.pcsDone = j.done; m.lastCycle_s = j.piece; m._ideal += op.cycM * 60;
        if (j.done >= j.n) { finishJob(m); break; }
        const over = -j.left; j.piece = pieceDur(m, op); j.left = j.piece - over;
      }
      if (m._job) m.progress = 1 - Math.max(0, m._job.left) / m._job.piece;
    }
    return energy(m, dt);
  }
  function powerOf(m) {
    const s = m.state, f = m.batch;
    if (s === "RUN") return m.kW * (f ? PWR.furnRun : m._rel === "ind" ? PWR.indRun : PWR.run);
    if (s === "DOWN") return m.kW * PWR.down;
    if (s === "OFF") return m.kW * (f ? PWR.furnHold : PWR.off);
    return m.kW * (f ? PWR.furnHold : PWR.base);
  }
  function energy(m, dt) { m.power_kW = powerOf(m); const e = m.power_kW * dt / 3600; m.energy_kWh += e; return e; }
  const infraPower = () => INFRA.hvac + (inShift(false) ? INFRA.airShift + INFRA.light : INFRA.airOff + INFRA.lightOff);

  /* ---------------- AGVs */
  const pathTo = (x, y, D) => { const lane = D[0] >= x ? LANES.east : LANES.west; const p = [[x, y], [x, lane], [D[0], lane], [D[0], D[1]]]; return p.filter((q, i) => i === 0 || Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) > 1e-6); };
  const pathLen = (p) => p.reduce((s, q, i) => (i ? s + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0), 0);
  function moveAlong(a, dist) {   // returns remaining distance (≤ 0 = arrived)
    let d = dist;
    while (a.path && a.pi < a.path.length - 1 && d > 0) {
      const p = a.path[a.pi], q = a.path[a.pi + 1], L = Math.hypot(q[0] - p[0], q[1] - p[1]), rem = L - a.ph;
      if (d >= rem) { d -= rem; a.pi++; a.ph = 0; a.x = q[0]; a.y = q[1]; }
      else { a.ph += d; a.x = p[0] + (q[0] - p[0]) * a.ph / L; a.y = p[1] + (q[1] - p[1]) * a.ph / L; d = 0; }
    }
    return a.path && a.pi >= a.path.length - 1;
  }
  const agvSet = (a, s) => { if (a.state !== s) { a.state = s; emit("agv", { a, state: s }); } };
  function dispatchAgvs() {
    if (!B.tq.length) return;
    for (let k = 0; k < B.tq.length; k++) {
      const T = B.tq[k]; if (T.agv) continue;
      const D = DOORS[T.from];
      let best = null, bd = 1e9;
      for (const a of B.agvs) {
        if (a.retire || !(a.state === "IDLE" || (a.state === "CHARGING" && a.soc >= 40) || a.state === "TO_CHARGE" && a.soc >= 50) || a.soc < AGV0.lowSoc) continue;
        const d = Math.abs(a.x - D[0]) + Math.abs(a.y - D[1]); if (d < bd) { bd = d; best = a; }
      }
      if (!best) return;
      T.agv = best.id; best.task = T; best.lot = null; best.from = T.from; best.to = T.to; best.path = pathTo(best.x, best.y, D); best.pi = 0; best.ph = 0; agvSet(best, "TO_PICK");
      T.lot.state = "wait-agv";
    }
  }
  function stepAgv(a, dt) {
    const v = AGV0.v, st = a.state;
    const busy = st === "TO_PICK" || st === "LOAD" || st === "TO_DROP" || st === "UNLOAD";
    if (busy) { a.busy_s += dt; B.stats.agvBusy += dt; }
    B.stats.agvTime += dt;
    if (st === "TO_PICK" || st === "TO_DROP" || st === "TO_CHARGE") {
      const x0 = a.x, y0 = a.y, done = moveAlong(a, v * dt), dd = Math.abs(a.x - x0) + Math.abs(a.y - y0);
      if (st === "TO_DROP") { a.mLoaded += dd; B.stats.mLoaded += dd; } else { a.mEmpty += dd; B.stats.mEmpty += dd; }
      a.soc -= 100 / AGV0.battH * dt / 3600;
      if (done) {
        if (st === "TO_PICK") { agvSet(a, "LOAD"); a.wait = AGV0.tLoad + AGV0.tDoor / 2; }
        else if (st === "TO_DROP") { agvSet(a, "UNLOAD"); a.wait = AGV0.tUnload + AGV0.tDoor / 2; }
        else agvSet(a, "CHARGING");
      }
      return;
    }
    if (st === "LOAD" || st === "UNLOAD") {
      a.soc -= 3 * dt / 3600; a.wait -= dt;
      if (a.wait > 0) return;
      const T = a.task;
      if (st === "LOAD") {
        a.lot = T.lot; T.lot.state = "agv"; T.lot.zone = "AGV"; B.tq.splice(B.tq.indexOf(T), 1);
        a.path = pathTo(a.x, a.y, DOORS[T.to]); a.pi = 0; a.ph = 0; agvSet(a, "TO_DROP");
        emit("lot", { ev: "agv", lot: T.lot, agv: a.id });
      } else {
        const L = a.lot; a.lot = null; a.task = null; a.trips++; B.stats.trips++;
        const k = T.from + ">" + T.to; B.stats.tripsFT[k] = (B.stats.tripsFT[k] || 0) + 1;
        arrive(L, T.to); a.idle_s = 0; agvSet(a, "IDLE");
        if (a.soc < AGV0.lowSoc + 10 || a.retire) goCharge(a);
      }
      return;
    }
    if (st === "CHARGING") { a.soc = Math.min(100, a.soc + AGV0.chargeRate * dt / 3600); return; }
    if (st === "IDLE") { a.soc -= 2 * dt / 3600; a.idle_s += dt; if ((a.idle_s > 180 && a.soc < 75) || a.soc < AGV0.lowSoc) goCharge(a); }
  }
  function goCharge(a) {
    const used = new Set(B.agvs.filter((b) => b !== a && (b.state === "CHARGING" || b.state === "TO_CHARGE")).map((b) => b.charger.join(",")));
    const c = CHARGERS.find((q) => !used.has(q.join(","))) || a.charger; a.charger = c;
    a.path = pathTo(a.x, a.y, c); a.pi = 0; a.ph = 0; agvSet(a, "TO_CHARGE");
  }

  /* ---------------- daily events */
  let lastTod = tod();
  function daily(prev, now) {
    const cross = (h) => (prev < h * 3600 && now >= h * 3600) || (now < prev && h === 0);
    if (now < prev) {   // new day 06:00
      const d = B.today; d.energyEnd = B.stats.energy; B.days.push(d); if (B.days.length > 60) B.days.shift();
      B.today = newDay(); B.today.e0 = B.stats.energy;
      if (B.autoOrders) { if (B.mix.FABS > 0) B.addOrder({ product: "FABS", qty: B.mix.FABS }); if (B.mix.FALG > 0) B.addOrder({ product: "FALG", qty: B.mix.FALG }); }
    }
    if (cross(1)) {   // 07:00 deliveries
      for (const r of ["BS", "BN", "LG", "LB"]) {
        const dem = startPerDay(r), rop = dem * 2, max = dem * 6;
        if (B.stores.raw[r] < rop) { const q = Math.round(max - B.stores.raw[r]); B.stores.raw[r] += q; logE("stock", `goods-in: ${q} blanks ${RAWINFO[r].code} (${Math.ceil(q / RAWINFO[r].per)} bars / profiles)`); }
      }
      for (const k of ["BS", "LB"]) {
        const dem = k === "BS" ? B.mix.FABS : 2 * B.mix.FALG, inbound = B.lots.filter((l) => l.kind === "kit" && l.route === "KIT-" + k).reduce((s, l) => s + l.qty, 0);
        if (B.stores.kits[k] + inbound < dem * 2) { const q = Math.round(dem * 4 - B.stores.kits[k] - inbound); const L = newLot({ route: "KIT-" + k, qty: q, kind: "kit", state: "queue", zone: "RAW" }); L.op = "IN"; B.Q["QC-INC"].push(L); logE("stock", `goods-in: ${q} kits ${k} → incoming check QC-INC`); }
      }
      emit("stock", { what: "raw" });
    }
    if (cross(8)) {   // 14:00 shipping
      let n = 0;
      for (const o of B.orders) if (o.state === "complete") { o.state = "shipped"; o.tShip = B.t; B.stores.fg[o.product] -= o.qty; n++; emit("order", o); }
      if (n) { logE("stock", `shipping: ${n} orders shipped`); emit("stock", { what: "fg" }); }
    }
  }
  function releaseRaw() {
    for (const L of B.lots) {
      if (L.state !== "raw") continue;
      if (B.stores.raw[L.route] >= L.qty) { B.stores.raw[L.route] -= L.qty; L.state = "move"; L.i = 0; L.tRel = B.t; if (!advance(L, "RAW")) { L.state = "raw"; B.stores.raw[L.route] += L.qty; } else emit("lot", { ev: "released", lot: L }); }
    }
  }

  /* ---------------- step */
  let sampleT = 0, slowT = 0;
  function sub(dt) {
    B.t += dt;
    const now = tod(); daily(lastTod, now); lastTod = now;
    // timed actions (hand carts)
    if (B.pending.length) { const due = B.pending.filter((p) => p.t <= B.t); if (due.length) { B.pending = B.pending.filter((p) => p.t > B.t); due.forEach((p) => p.fn()); } }
    if (B.t - needT >= 60) updNeed();
    if (B.t - slowT >= 60) { slowT = B.t; releaseRaw(); for (const o of B.orders) if (o.state === "open") { tryAssembly(o); partOrderDone(o); } }
    let eM = 0; for (const m of B.M) eM += stepMachine(m, dt);
    const eI = infraPower() * dt / 3600;
    B.stats.energyM += eM; B.stats.energyI += eI; B.stats.energy += eM + eI; B.today.energy += eM + eI;
    dispatchAgvs();
    for (const a of B.agvs) stepAgv(a, dt);
    if (B.agvs.some((a) => a.retire && a.state === "CHARGING")) B.agvs = B.agvs.filter((a) => !(a.retire && a.state === "CHARGING"));
    let nl = 0; for (const L of B.lots) if (L.kind !== "kit" && L.state !== "raw") nl++;
    B.stats.lit.area += nl * dt;
    if (B.t - sampleT >= 600) { sampleT = B.t; sample(); }
  }
  function sample() {
    const k = B.kpi(true);
    B.hist.push({ t: B.t, wip: k.wip.lots, oee: k.oee, kW: k.powerNow, FABS: B.today.out.FABS, FALG: B.today.out.FALG, agv: k.agvUtilNow, tod: tod() });
    if (B.hist.length > 432) B.hist.shift();   // 3 days at 10 min
  }
  B.step = (dt) => { let r = dt; while (r > 1e-9) { const d = Math.min(r, 10); sub(d); r -= d; } emit("tick", B); };
  B.runFor = (s, dt = 30) => { const n = Math.ceil(s / dt); for (let i = 0; i < n; i++) sub(dt); emit("tick", B); };
  B.run = () => { B.running = true; }; B.pause = () => { B.running = false; };
  B.setSpeed = (x) => { B.speed = Math.min(3600, Math.max(0.1, +x || 1)); };
  B.setShifts = (n) => { B.shifts = Math.min(3, Math.max(1, Math.round(+n || 2))); logE("plan", `shifts set to ${B.shifts}`); };
  B.setMix = (m = {}) => { for (const k of ["FABS", "FALG"]) if (m[k] !== undefined) B.mix[k] = Math.max(0, Math.round(+m[k] || 0)); logE("plan", `daily mix: ${B.mix.FABS} screw sets + ${B.mix.FALG} guide sets`); };
  B.setOEE = (x) => { B.oee = Math.min(1, Math.max(0.3, +x || PLANT.oee)); setPerf(); logE("plan", `OEE target ${B.oee}`); };
  B.setAGVs = (n) => {
    n = Math.min(8, Math.max(1, Math.round(+n || 1)));
    const act = B.agvs.filter((a) => !a.retire);
    if (n > act.length) for (let i = act.length; i < n; i++) B.agvs.push(mkAgv());
    else act.slice(n).forEach((a) => { a.retire = true; if (a.state === "IDLE" || a.state === "CHARGING") a.state = "CHARGING"; });
    logE("plan", `AGV fleet: ${n}`); emit("agv", { n });
  };
  B.setMachineDown = (id, down = true, minutes) => {
    const m = B.byId[id]; if (!m) return false;
    if (down) { m._man = true; fail(m, 900, ALARMS[900], minutes ? minutes * 60 : 0); if (!minutes) m._rep = 0; }
    else if (m.state === "DOWN") repaired(m);
    return true;
  };
  B.machine = (id) => (B.byId[id] ? B.signals(B.byId[id]) : null);

  /* ---------------- signals (Modbus groups) – deterministic + small noise */
  B.signals = (m) => {
    const run = m.state === "RUN", s = m.sig, ph = (B.t / 60 + m.x) % 1, nz = (a) => a * Math.sin(B.t / 37 + m.x * 1.7 + m.y);
    const bits = (1 << STATES[m.state].bit);
    if (s.std) Object.assign(s.std, { status: bits, mode: m.state === "SETUP" ? 2 : m.state === "DOWN" && m._man ? 3 : 1, stateCode: m.code, good: m.good, scrap: m.scrap,
      lastCycle_s: r2(m.lastCycle_s, 1), alarm: m.alarm, order: (m.lot || "").slice(0, 20), part: (m.part || "").slice(0, 20), power_kW: r2(m.power_kW, 2), energy_kWh: r2(m.energy_kWh, 2) });
    if (s.grind) Object.assign(s.grind, { wheelSpeed_ms: run ? (m.type === "BN-ITG" ? 30 : m.type === "BS-CGR" ? 45 : 35) : 0, spindlePower_pct: run ? r2(55 + 25 * ph + nz(3), 1) : 0,
      dressCount: Math.floor(m.good / 10) % 65536, wheelDia_mm: r2((m.type === "BS-TGR" ? 400 : m.type === "BN-ITG" ? 25 : 400) - (m.good % 500) * 0.004, 2), oilTemp_C: r2(20 + nz(0.25), 2), gaugeDev_um: run ? r2(nz(1.5), 2) : 0 });
    if (s.tgr) { const pas = 7; Object.assign(s.tgr, { pass: run ? 1 + Math.floor(m.progress * pas) : 0, passes: pas, workSpeed_rpm: run ? [40, 40, 40, 20, 20, 10, 10][Math.min(6, Math.floor(m.progress * pas))] : 0, leadComp_um_m: r2(-11.5 + nz(0.4), 2), screwTemp_C: r2(20.2 + nz(0.2), 2), wheelTilt_deg: m.type === "BS-TGR" ? 5.51 : 5.51 }); }
    if (s.ind) Object.assign(s.ind, { power_kW: run ? r2((m.type === "LG-IND" ? 80 : 36) + nz(1), 1) : 0, freq_kHz: run ? 30 : 0, scan_mm_s: run ? (m.type === "LG-IND" ? 8 : 4) : 0, quenchFlow_l_min: run ? r2(120 + nz(4), 1) : 0,
      quenchTemp_C: r2(25 + nz(1), 1), polymer_pct: r2(10 + nz(0.2), 2), energyPart_kJ: run ? r2((m.type === "LG-IND" ? 31800 : 8280) * (1 + nz(0.01)), 0) : 0, energyOK: run ? 1 : 0 });
    if (s.furn) { const J = m._job, car = m.type === "HT-CAR", Tset = car ? (m.progress < 0.6 ? 920 : m.progress < 0.8 ? 840 : 170) : 170;
      Object.assign(s.furn, { zone1_C: r2(J ? Tset + nz(2) : car ? 850 : 120, 1), zone2_C: r2(J ? Tset + nz(2.5) : car ? 850 : 120, 1), zone3_C: r2(J ? Tset + nz(1.8) : car ? 850 : 120, 1), zone4_C: r2(J ? Tset + nz(2.2) : car ? 850 : 120, 1),
        carbonPot_pct: car ? r2(J && m.progress < 0.5 ? 1.1 : 0.8, 2) : 0, co_pct: car ? r2(20 + nz(0.5), 2) : 0, oilTemp_C: car ? r2(60 + nz(2), 1) : 0, loadNo: m._loadNo % 65536,
        step: J ? 1 + Math.floor(m.progress * 5) : 0, remain_min: J ? r2(Math.max(0, J.left) / 60, 1) : 0 }); }
    if (s.press) Object.assign(s.press, { runoutBefore_um: run ? r2(m.type.startsWith("LG") ? 600 : 300 + nz(40), 0) : 0, runoutAfter_um: run ? r2((m.type.startsWith("LG") ? 80 : 18) + nz(3), 1) : 0,
      force_kN: run ? r2((m.type === "LG-STH" ? 80 : m.type === "BS-STH" ? 60 : 45) * (0.5 + ph * 0.5), 1) : 0, stroke_mm: run ? r2(1.2 * ph, 2) : 0, bends: run ? 1 + Math.floor(ph * 5) : 0 });
    if (s.meas) Object.assign(s.meas, { ep_um: r2(m.type === "QC-LED" ? 12 + nz(6) : 0, 1), vup_um: r2(m.type === "QC-LED" ? 14 + nz(4) : 0, 1), v300_um: r2(m.type === "QC-LED" ? 9 + nz(3) : 9 + nz(2), 1), v2pi_um: r2(m.type === "QC-LED" ? 4 + nz(1.5) : 0, 1),
      grade: m.good ? 5 : 0, matTemp_C: r2(20 + nz(0.15), 2) });
    if (s.torque) Object.assign(s.torque, { torqueMean_Nm: m.type === "AS-BSA" || m.type === "AS-RUN" ? r2(0.29 + nz(0.03), 3) : 0, torqueVar_Nm: m.type === "AS-BSA" || m.type === "AS-RUN" ? r2(0.05 + nz(0.01), 3) : 0,
      drag_N: m.type === "QC-MAT" || m.type === "AS-GAS" ? r2(15 + nz(2), 1) : 0, result: m.good ? 1 : 0, cls: 1 });
    if (s.cnc) Object.assign(s.cnc, { spindle_rpm: run ? r2(m.type === "BS-TRN" ? 1770 : m.type === "BN-TRN" ? 820 : m.type === "LB-MC" ? 875 : 2400, 0) : 0, spindleLoad_pct: run ? r2(45 + 30 * ph + nz(4), 1) : 0,
      toolNo: run ? 1 + Math.floor(ph * 12) : 0, toolLife_pct: Math.max(0, 100 - (m.good % 200) / 2) | 0, feedOvr_pct: 100 });
    if (s.wash) Object.assign(s.wash, { bathTemp_C: r2(55 + nz(1), 1), conduct_uS: r2(1800 + nz(80), 0), belt_m_min: m.state === "OFF" || m.state === "DOWN" ? 0 : 1 });
    return m;
  };
  function oeeOf(m) {
    const t = m.t, busy = t.run + t.setup + t.down, A = busy > 0 ? t.run / busy : 0, P = t.run > 0 ? Math.min(1, m._ideal / t.run) : 0;
    const g = m.good - (m._g0 || 0), s = m.scrap - (m._s0 || 0), Q = g + s > 0 ? g / (g + s) : 0;
    m.oee = { A: r2(A, 4), P: r2(P, 4), Q: r2(Q, 4), OEE: r2(A * P * Q, 4) }; m.util = t.on > 0 ? r2((t.run + t.setup) / t.on, 4) : 0; m.queue = (B.Q[m.type] || []).length;
    return m.oee;
  }

  /* ---------------- KPIs */
  B.kpi = (light = false) => {
    const S = B.stats, el = Math.max(1, B.t - S.t0), days = el / DAY;
    let wl = 0, wp = 0; const wr = {};
    for (const L of B.lots) { if (L.kind === "kit" || L.state === "raw") continue; wl++; wp += L.qty; wr[L.route] = (wr[L.route] || 0) + L.qty; }
    let oN = 0, oD = 0, pw = 0; const types = {};
    for (const m of B.M) {
      oeeOf(m); pw += m.power_kW;
      const busy = m.t.run + m.t.setup + m.t.down;
      if (busy > 0 && m.used) { oN += m.oee.OEE * busy; oD += busy; }
      const T = types[m.type] || (types[m.type] = { type: m.type, n: 0, busy: 0, on: 0, run: 0 }); T.n++; T.busy += m.t.run + m.t.setup + m.t.down; T.on += m.t.on; T.run += m.t.run;
    }
    const tl = Object.values(types).filter((T) => T.on > 0 && T.type !== "QC-LAB").map((T) => ({ ...T, share: T.busy / T.on })).sort((a, b) => b.share - a.share);
    const nA = B.agvs.filter((a) => !a.retire).length;
    const agvUtilNow = nA ? B.agvs.filter((a) => ["TO_PICK", "LOAD", "TO_DROP", "UNLOAD"].includes(a.state)).length / nA : 0;
    const k = { t: B.t, clock: B.clock(), day: B.day(), elapsedDays: r2(days, 3), wip: { lots: wl, pcs: wp, byRoute: wr }, oee: oD > 0 ? r2(oN / oD, 4) : 0, powerNow: r2(pw + infraPower(), 1), agvUtilNow };
    if (light) return k;
    const P = days < 0.5 && B.prevKpi ? B.prevKpi : null;   // first hours after a reset: show the previous (warm-up) values
    const out = S.out, perDay = {}; for (const r in out) perDay[r] = P ? P.outPerDay[r] : r2(out[r] / days, 1);
    const last = B.days.length ? B.days[B.days.length - 1] : null;
    const lead = S.ordersDone ? S.leadSum / S.ordersDone / 3600 : 0;
    const flow = {}; for (const r in S.flow) flow[r] = r2(S.flow[r].s / S.flow[r].n / 3600, 2);
    const L = S.lit.area / el, lam = S.lit.n / (el / 3600), W = S.lit.n ? S.lit.flow / S.lit.n / 3600 : 0;
    const sets = out.FABS + out.FALG;
    return Object.assign(k, {
      target: { FABS: B.mix.FABS, FALG: B.mix.FALG, BS: B.mix.FABS, BN: B.mix.FABS, LG: B.mix.FALG, LB: 2 * B.mix.FALG },
      outTotal: { ...out }, outPerDay: perDay, outToday: { ...B.today.out }, outLastDay: last ? { ...last.out } : null,
      bottleneck: tl[0] ? { type: tl[0].type, n: tl[0].n, share: r2(tl[0].share, 4) } : null, typeLoad: tl.slice(0, 8).map((T) => ({ type: T.type, n: T.n, share: r2(T.share, 4) })),
      leadTime_h: r2(lead, 2), flowTime_h: flow, ordersDone: S.ordersDone, ordersOpen: B.orders.filter((o) => o.state === "open").length,
      agvUtil: S.agvTime > 0 ? r2(S.agvBusy / S.agvTime, 4) : 0, agvs: nA, trips: S.trips, tripsPerDay: r2(S.trips / days, 1), mLoadedPerDay: r2(S.mLoaded / days, 0), mEmptyPerDay: r2(S.mEmpty / days, 0),
      energy_kWh: r2(S.energy, 1), energyPerDay_kWh: r2(S.energy / days, 0), energyMachines_kWh: r2(S.energyM, 1), energyInfra_kWh: r2(S.energyI, 1), kWhPerSet: sets ? r2(S.energy / sets, 2) : 0,
      scrapPcs: S.scrap, little: { L: r2(L, 2), lambda_h: r2(lam, 4), W_h: r2(W, 3), LW: r2(lam * W, 2), n: S.lit.n },
      shifts: B.shifts, oeeTarget: B.oee, mix: { ...B.mix },
    }, P ? { fromPrev: true, oee: P.oee, bottleneck: P.bottleneck, typeLoad: P.typeLoad, leadTime_h: P.leadTime_h, flowTime_h: P.flowTime_h, agvUtil: P.agvUtil, tripsPerDay: P.tripsPerDay,
      mLoadedPerDay: P.mLoadedPerDay, mEmptyPerDay: P.mEmptyPerDay, energyPerDay_kWh: P.energyPerDay_kWh, kWhPerSet: P.kWhPerSet, little: P.little } : { fromPrev: false });
  };

  /* ---------------- snapshot (JSON) */
  B.snapshot = () => {
    const k = B.kpi();
    return {
      version: VERSION, t: B.t, clock: B.clock(), day: B.day(), speed: B.speed, running: B.running, shifts: B.shifts, oeeTarget: B.oee, mix: { ...B.mix }, variant,
      machines: B.M.map((m) => { B.signals(m); return { id: m.id, type: m.type, name: m.name, zone: m.zone, x: m.x, y: m.y, rot: m.rot, kW: m.kW, state: m.state, code: m.code, since: m.since,
        lot: m.lot, order: m.order, part: m.part, route: m.route, op: m.op, opName: m.opName, pcsLot: m.pcsLot, pcsDone: m.pcsDone, progress: r2(m.progress, 3), cycleIdeal_s: r2(m.cycleIdeal_s, 1), lastCycle_s: r2(m.lastCycle_s, 1),
        good: m.good, scrap: m.scrap, alarm: m.alarm, alarmText: m.alarmText, lastAlarm: m.lastAlarm, power_kW: r2(m.power_kW, 2), energy_kWh: r2(m.energy_kWh, 2), queue: m.queue,
        t: Object.fromEntries(Object.entries(m.t).map(([a, b]) => [a, Math.round(b)])), oee: { ...m.oee }, util: m.util, mtbf_h: m.mtbf_h, mttr_h: m.mttr_h,
        sig: JSON.parse(JSON.stringify(m.sig)) }; }),
      agvs: B.agvs.map((a) => ({ id: a.id, x: r2(a.x, 2), y: r2(a.y, 2), state: a.state, soc: r2(a.soc, 1), lot: a.lot ? a.lot.id : "", from: a.from, to: a.to, trips: a.trips, busy_s: Math.round(a.busy_s), mLoaded: Math.round(a.mLoaded), mEmpty: Math.round(a.mEmpty) })),
      transport: B.tq.map((q) => ({ lot: q.lot.id, from: q.from, to: q.to, t: q.t, agv: q.agv || "" })),
      lots: B.lots.map((L) => ({ id: L.id, kind: L.kind, order: L.order, route: L.route, code: L.code, qty: L.qty, qty0: L.qty0, op: L.op, i: L.i, state: L.state, zone: L.zone, machine: L.machine, t0: L.t0 })),
      orders: B.orders.slice(-60).map((o) => ({ id: o.id, product: o.product, code: o.code, qty: o.qty, done: o.done, state: o.state, t0: o.t0, due: o.due, tDone: o.tDone, tShip: o.tShip })),
      stores: JSON.parse(JSON.stringify({ raw: B.stores.raw, kits: B.stores.kits, fg: B.stores.fg, smFree: B.stores.sm.free })),
      kpi: k, events: B.log.slice(0, 50),
    };
  };

  B.resetStats();
  if (B.autoOrders) { if (B.mix.FABS > 0) B.addOrder({ product: "FABS", qty: B.mix.FABS }); if (B.mix.FALG > 0) B.addOrder({ product: "FALG", qty: B.mix.FALG }); }
  if (opts.warmDays) {   // ramp-up from an empty plant, then 3 steady days whose KPIs are kept as "previous" values for the first hours
    const w = opts.warmDays, dt = opts.warmDt || 30;
    if (w > 4) { B.runFor((w - 3) * DAY, dt); B.resetStats(); B.runFor(3 * DAY, dt); B.resetStats(true); } else { B.runFor(w * DAY, dt); B.resetStats(); }
  }
  return B;
}

/* ================================================================ the shared instance + clock */
export function getBSF() {
  if (window.BSF) return window.BSF;
  const B = createSim({ seed: 7, warmDays: 8 });
  B.speed = 60;
  window.BSF = B;
  let last = performance.now();
  setInterval(() => {
    const now = performance.now(), dt = Math.min(2, (now - last) / 1000); last = now;
    if (B.running) B.step(dt * B.speed);
  }, 100);   // 10 Hz page clock (keeps running when the tab is hidden; browsers throttle hidden tabs to ≈ 1 Hz – dt is capped at 2 s)
  return B;
}
