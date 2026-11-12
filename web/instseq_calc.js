/* Installation tab – item 5: calculations (no DOM). Used by instseq.js. Guide: docs/28_installation_sequence_commissioning.md
 * CPM (critical path method) · sling forces · forklift capacity · compressed-air consumption + pressure drop · coolant mix ·
 * mist extraction · chips · spindle run-in temperature model · capability Cm/Cmk/Cp/Cpk/Ppk with deterministic example data.
 * All values are EXAMPLES – the real numbers come from the machine maker's installation manual and the site.
 */
export const G = 9.81;
export const ROLES = ["Buyer", "Maker", "Electrician", "Civil contractor", "Rigger"];
export const ROLE_SHORT = ["Buyer", "Maker", "Electr.", "Civil", "Rigger"];

/* ------------------------------------------------------------------ project tasks (durations = calendar days, EXAMPLE)
 * raci: 5 letters in the order Buyer, Maker, Electrician, Civil, Rigger. X = A + R (accountable and does it), R, A, C, I, - */
const T = (id, name, d, pre, raci, ph, note = "") => ({ id, name, d, pre, raci, ph, note });
export const BASE_TASKS = [
  T("PO", "Purchase order signed", 0, [], "XI---", 1, "milestone – the contract fixes the machine spec, delivery terms (Incoterms), FAT/SAT criteria, payment"),
  T("PIM", "Pre-installation meeting + layout approval", 14, ["PO"], "ARCCC", 1, "maker + buyer agree layout, foundation, utilities, route, dates"),
  T("FDW", "Maker sends foundation + installation drawings", 21, ["PIM"], "IX-I-", 1, "certified drawing: loads, anchor positions, levelling pads, CoG, lifting points"),
  T("FD", "Foundation design (structural engineer)", 14, ["FDW"], "AC-R-", 1, "block size, reinforcement, isolation joint (item 1)"),
  T("FP", "Excavation, reinforcement, concrete pour", 10, ["FD"], "AI-R-", 1, "embedded plates / anchor sleeves set to the drawing"),
  T("FC", "Concrete curing – 28 days", 28, ["FP"], "I--X-", 1, "C30/37 reaches design strength after 28 days; keep the surface wet; no machine load before"),
  T("UP", "Power supply: cable, breaker, distribution", 21, ["PIM"], "ACR--", 1, "item 3: 3×400 V TN-S, 45 kVA, cable sized for voltage drop"),
  T("UA", "Air, coolant, mist-exhaust piping", 15, ["PIM"], "XC---", 1, "ring main, drop with filter-regulator, condensate drain"),
  T("UN", "Network point + MES interface plan", 10, ["PIM"], "XC---", 1, "Communication tab: OPC UA / MTConnect, IP plan, firewall"),
  T("RT", "Route survey, rigging plan, crane booked", 7, ["PIM"], "AC--R", 2, "door size, floor load on the route, lifting plan signed"),
  T("MFG", "Machine build at the maker", 110, ["PO"], "IX---", 2, "lead time of an HMC 500 class machine: often 4–6 months"),
  T("FAT", "FAT – acceptance at the maker's plant", 5, ["MFG"], "AR---", 2, "geometry, test cut, cycle time, safety – before shipping"),
  T("SHIP", "Packing (VCI film, locks) + transport", 21, ["FAT"], "IX--I", 2, "sea/road; who pays and carries the risk = Incoterms"),
  T("DEL", "Delivery + delivery inspection", 1, ["SHIP", "FC", "RT"], "XC--C", 2, "shock + tilt indicators, packing damage, count boxes"),
  T("UNL", "Unloading from the truck", 1, ["DEL"], "AC--R", 2, "crane or heavy forklift, lifting points from the drawing"),
  T("PLC", "Moving in, placing on the foundation", 1, ["UNL"], "AC-IR", 3, "skates / air pads, steel plates on the floor"),
  T("LEV", "Rough levelling, anchors", 2, ["PLC"], "AR-C-", 3, "item 2 – precision level 0.02 mm/m"),
  T("ELC", "Electrical connection + checks", 2, ["LEV", "UP"], "ACR--", 3, "item 3 – PE, insulation, phase sequence, voltage"),
  T("UCN", "Connect air, coolant (first fill), chips, exhaust, network", 2, ["LEV", "UA", "UN"], "XC---", 3, "card F"),
  T("PON", "First power-on", 1, ["ELC", "UCN"], "ARC--", 4, "maker's engineer present – card G"),
  T("COM", "Maker's commissioning (locks, oils, home, run-in, safety)", 5, ["PON"], "CXI--", 4, "card G"),
  T("GEO", "Final levelling + geometry checks (ISO 10791)", 3, ["COM"], "AR---", 4, "item 2"),
  T("TC", "Test cuts with the crankcase", 3, ["GEO"], "AR---", 5, "first article inspected on the CMM"),
  T("SAT", "Run-off at site (SAT): Cmk, cycle time, 24 h run", 4, ["TC"], "AR---", 5, "card H"),
  T("TRN", "Training: operator, maintenance, programming", 3, ["TC"], "AR---", 5, "can run parallel to the run-off"),
  T("HO", "Handover, documents, final acceptance", 1, ["SAT", "TRN"], "AR---", 5, "signed acceptance protocol, warranty starts"),
  T("RAMP", "Production ramp-up to target OEE", 30, ["HO"], "XC---", 5, "step by step to the planned cycle time and OEE"),
];
const MACHINE_CHAIN = ["FAT", "SHIP", "DEL", "UNL", "PLC", "LEV", "ELC", "UCN", "PON", "COM", "GEO", "TC", "SAT"];

/** task list for a scope: "one" = HMC-01 only, "line" = 3 machines (HMC-01..03, staggered delivery, one install team) */
export function buildTasks(scope) {
  const base = BASE_TASKS.map((t) => ({ ...t, pre: t.pre.slice() }));
  if (scope !== "line") return base;
  base.forEach((t) => { if (MACHINE_CHAIN.includes(t.id)) t.name = "HMC-01 " + t.name; });
  const out = base.filter((t) => !["TRN", "HO", "RAMP"].includes(t.id));
  for (const k of [2, 3]) {
    const s = (id) => id + k, p = (id) => (k === 2 ? id : id + (k - 1));
    const B = (id) => BASE_TASKS.find((t) => t.id === id);
    const mk = (id, d, pre) => T(s(id), `HMC-0${k} ` + B(id).name, d, pre, B(id).raci, B(id).ph, B(id).note);
    out.push(
      mk("FAT", 3, [p("FAT") + "+7"]), mk("SHIP", 21, [s("FAT")]), mk("DEL", 1, [s("SHIP"), "FC", "RT"]), mk("UNL", 1, [s("DEL")]),
      mk("PLC", 1, [s("UNL")]), mk("LEV", 2, [s("PLC"), p("LEV")]), mk("ELC", 2, [s("LEV"), p("ELC"), "UP"]),
      mk("UCN", 2, [s("LEV"), p("UCN"), "UA", "UN"]), mk("PON", 1, [s("ELC"), s("UCN")]), mk("COM", 5, [s("PON"), p("COM")]),
      mk("GEO", 3, [s("COM"), p("GEO")]), mk("TC", 3, [s("GEO")]), mk("SAT", 3, [s("TC"), p("SAT")]));
  }
  out.push(T("LINE", "Line run-off: 3 HMC + washer + robot, line cycle", 3, ["SAT", "SAT2", "SAT3"], "AR---", 5, "all machines together, real pallets, MES connected"));
  const tail = BASE_TASKS.filter((t) => ["TRN", "HO", "RAMP"].includes(t.id)).map((t) => ({ ...t, pre: t.pre.slice() }));
  tail.find((t) => t.id === "HO").pre = ["LINE", "TRN"];
  return out.concat(tail);
}

const parsePre = (s) => { const m = /^([A-Z0-9]+)(?:\+(\d+))?$/.exec(s); return { id: m[1], lag: m[2] ? +m[2] : 0 }; };

/** CPM forward + backward pass. dur = {id: days} overrides. Returns tasks with ES, EF, LS, LF, TF (total float), FF (free float), crit. */
export function cpm(tasks, dur = {}) {
  const L = tasks.map((t) => ({ ...t, d: Math.max(0, Math.round(dur[t.id] != null ? +dur[t.id] : t.d)), P: t.pre.map(parsePre), S: [] }));
  const by = Object.fromEntries(L.map((t) => [t.id, t]));
  L.forEach((t) => t.P.forEach((p) => { if (!by[p.id]) throw new Error("unknown predecessor " + p.id); by[p.id].S.push({ id: t.id, lag: p.lag }); }));
  for (const t of L) { t.ES = t.P.reduce((m, p) => Math.max(m, by[p.id].EF + p.lag), 0); t.EF = t.ES + t.d; }   // list is in topological order
  const end = L.reduce((m, t) => Math.max(m, t.EF), 0);
  for (let i = L.length - 1; i >= 0; i--) { const t = L[i]; t.LF = t.S.reduce((m, s) => Math.min(m, by[s.id].LS - s.lag), end); t.LS = t.LF - t.d; }
  for (const t of L) {
    t.TF = t.LS - t.ES;
    t.FF = t.S.reduce((m, s) => Math.min(m, by[s.id].ES - s.lag), end) - t.EF;
    t.crit = t.TF === 0;
  }
  // the critical path as a chain: start at a critical task without critical predecessor, follow critical successors with zero gap
  const path = [];
  let cur = L.find((t) => t.crit && t.ES === 0 && !t.P.some((p) => by[p.id].crit));
  while (cur) {
    path.push(cur.id);
    const c = cur;
    const nx = c.S.map((s) => by[s.id]).filter((s) => s.crit && s.ES === c.EF + (c.S.find((x) => x.id === s.id).lag));
    cur = nx.sort((a, b) => b.d - a.d)[0];
  }
  return { tasks: L, by, end, path };
}

const DAY = 86400000;
export function parseDate(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : Date.UTC(2027, 0, 4); }
export function addDays(t0, d) { return t0 + d * DAY; }
export function fmtDate(t) { const d = new Date(t); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`; }
/** day number → calendar date of the LAST day of a task (EF is exclusive: a task on days 0..4 has EF = 5, last day = day 4) */
export const finishDate = (t0, EF, d) => fmtDate(addDays(t0, d > 0 ? EF - 1 : EF));

/* ------------------------------------------------------------------ rigging */
export const SLING_WLL = [[1, "violet"], [2, "green"], [3, "yellow"], [4, "grey"], [5, "red"], [6, "brown"], [8, "blue"], [10, "orange"], [12, "orange"], [15, "orange"], [20, "orange"]];   // EN 1492-2 round slings
export const SHACKLE_WLL = [1, 1.5, 2, 3.25, 4.75, 6.5, 8.5, 9.5, 12, 13.5, 17, 25, 35];   // bow shackles (typical catalogue sizes, t)
/**
 * Sling forces. m kg, n legs (2 or 4), theta deg (nominal angle FROM VERTICAL when the CoG is centred), e mm CoG offset along
 * the lifting-point line, Lp mm distance between the lifting points, spreader (lower slings vertical), mb kg spreader-beam mass.
 */
export function sling({ m = 12000, n = 4, theta = 30, e = 300, Lp = 2400, spreader = false, mb = 300 }) {
  const W = m * G / 1000;                                     // kN
  const th = theta * Math.PI / 180, c = Math.cos(th);
  const r = { W, n, theta };
  r.Feq = spreader ? W / n : W / (n * c);                     // F = m·g / (n·cos θ)   (θ = 0 below a spreader beam)
  r.F3 = n === 4 && !spreader ? W / (3 * c) : r.Feq;          // 4-leg sling: only 3 legs are counted (EN 13414-1 rating rule)
  const half = Lp / 2, a = half + e, b = half - e;            // horizontal distances CoG → lifting point A / B (mm)
  const perSide = n / 2;
  if (spreader) {
    r.FA = W * b / Lp / perSide; r.FB = W * a / Lp / perSide; r.thA = 0; r.thB = 0; r.HA = 0;
    r.Ftop = (W + mb * G / 1000) / (2 * c);                   // two top legs from the beam to the hook
    r.h = half / Math.tan(th);
  } else {
    const h = half / Math.tan(Math.max(th, 1e-6));            // hook height above the lifting points (hook above the CoG)
    const tA = Math.atan2(a, h), tB = Math.atan2(b, h), s = Math.sin(tA + tB);
    r.h = h; r.thA = tA * 180 / Math.PI; r.thB = tB * 180 / Math.PI;
    r.FA = W * Math.sin(tB) / s / perSide; r.FB = W * Math.sin(tA) / s / perSide;    // exact 2D statics: F_A = W·sin θB / sin(θA+θB)
    r.HA = W * Math.sin(tB) / s * Math.sin(tA);                // horizontal force that squeezes the machine (per side, kN)
    r.LA = Math.hypot(a, h); r.LB = Math.hypot(b, h);
  }
  r.Fdesign = Math.max(r.F3, r.FA, r.FB);
  r.tReq = r.Fdesign / G;                                     // required WLL per leg, t (1 t ≙ 9.81 kN)
  r.slingWll = SLING_WLL.find((x) => x[0] >= r.tReq - 1e-9) || [NaN, "special"];
  r.shackle = SHACKLE_WLL.find((x) => x >= r.tReq - 1e-9) || NaN;
  r.hookLoad = m + (spreader ? mb : 0) + 120;                 // kg: machine + beam + slings/shackles (example 120 kg)
  r.warn = theta > 60 ? "forbidden" : theta > 45 ? "avoid" : "ok";
  /* EN 1492-2 marking (band) rating: a multi-leg set is marked for an angle BAND, not the exact angle.
     Mode factor M: 2 legs 1.4 (0–45°) / 1.0 (45–60°); 3–4 legs 2.1 / 1.5. Required single-leg WLL = hook load / M.
     Below a spreader beam the legs hang vertical: n straight legs, M = n (only if the beam keeps them equally loaded). */
  const thBand = spreader ? 0 : theta;
  r.bandM = spreader ? n : n >= 3 ? (thBand <= 45 ? 2.1 : 1.5) : (thBand <= 45 ? 1.4 : 1.0);
  r.tBand = r.hookLoad / 1000 / r.bandM;
  r.slingBand = SLING_WLL.find((x) => x[0] >= r.tBand - 1e-9) || [NaN, "special"];
  r.slingSafe = Number.isFinite(r.slingBand[0]) && Number.isFinite(r.slingWll[0]) ? (r.slingBand[0] >= r.slingWll[0] ? r.slingBand : r.slingWll) : [NaN, "special"];
  return r;
}
/** forklift: actual capacity at a bigger load centre, moment about the front axle: Q·(c0 + x) = Qact·(c + x) */
export function forklift({ Q = 16000, c0 = 1200, x = 700, c = 1600, m = 12000 }) {
  const Qact = Q * (c0 + x) / (c + x);
  return { Qact, ok: Qact >= m, margin: (Qact / m - 1) * 100 };
}

/* ------------------------------------------------------------------ compressed air */
export const AIR_CONSUMERS = [   // NL/min average and peak per unit (EXAMPLE values – ask each maker)
  { id: "hmc", name: "HMC 500 (spindle air seal, taper blow, APC, tool clamp)", n: 3, avg: 120, peak: 300 },
  { id: "wash", name: "Washer WASH-01 (blow-off nozzles)", n: 1, avg: 400, peak: 900 },
  { id: "vmc", name: "VMC-01 (air seal, taper blow)", n: 1, avg: 100, peak: 250 },
  { id: "rob", name: "Robot cell (gripper valves, blow-off)", n: 1, avg: 50, peak: 150 },
];
export function airDemand(list = AIR_CONSUMERS, leak = 10, reserve = 20) {
  const avg = list.reduce((s, c) => s + c.n * c.avg, 0), peak = list.reduce((s, c) => s + c.n * c.peak, 0);
  const design = avg * (1 + leak / 100) * (1 + reserve / 100);
  return { avg, peak, design, ls: design / 60, m3h: design * 60 / 1000 };
}
export const PIPE_ID = [16, 20, 25, 32, 40, 50, 63];   // inner diameters of typical aluminium air-pipe systems, mm
/** pressure drop (bar) – Atlas Copco empirical formula: Δp = 450 · q^1.85 · L / (d^5 · p)  [q l/s free air, L m, d mm, p bar(a)] */
export function airDrop({ q, L, d, pg = 7, ring = false }) {
  const p = pg + 1.013;                    // absolute pressure, bar(a)
  const qq = ring ? q / 2 : q, LL = ring ? L / 2 : L;   // ring main ≈ two parallel paths of half length (approximation)
  const dp = 450 * Math.pow(qq, 1.85) * LL / (Math.pow(d, 5) * p);
  const qAct = qq * 1.013 / p / 1000;       // m³/s compressed
  const v = qAct / (Math.PI * (d / 1000) ** 2 / 4);
  return { dp, p, v, pEnd: pg - dp };
}

/* ------------------------------------------------------------------ coolant, mist, chips */
export function coolant({ V = 800, c = 7, k = 1.0, brix = 4.2 }) {
  const conc = V * c / 100, water = V - conc;
  const readTarget = c / k;                 // refractometer reading (°Brix) that means the target concentration
  const cNow = k * brix;                    // concentration % = factor × reading
  const add = cNow < c ? V * (c - cNow) / (100 - c) : 0;   // litres of concentrate to add: (V·c1 + x)/(V + x) = c2
  const addWater = cNow > c ? V * (cNow - c) / c : 0;        // litres of water to add to bring it down
  return { conc, water, readTarget, cNow, add, addWater };
}
export const mist = ({ Venc = 6, ach = 5, n = 3 }) => ({ perMachine: Venc * ach * 60, total: Venc * ach * 60 * n });
export const chips = ({ ct = 360, hours = 7.5, mChip = 1.5, rho = 1500, n = 3 }) => { const parts = hours * 3600 / ct * n, kg = parts * mChip; return { parts, kg, m3: kg / rho }; };

/* ------------------------------------------------------------------ spindle run-in (illustration model) */
export const RUNIN = [[500, 10], [1000, 10], [2000, 10], [3000, 10], [4000, 15], [5000, 15], [6000, 30]];   // rpm, min
export const RUNIN_LIMIT = 25;   // K rise of the spindle housing above room (EXAMPLE limit – use the maker's value)
/** first-order thermal model: τ = 12 min, steady rise 22·(n/6000)^1.3 K; fresh grease adds heat until it is distributed */
export function runin(steps = RUNIN, skip = false) {
  const prog = skip ? [[6000, steps.reduce((s, x) => s + x[1], 0)]] : steps;
  const dt = 0.25, tau = 12, out = [];
  let T = 0, g = 1, t = 0;
  for (const [n, min] of prog) {
    for (let i = 0; i < min / dt; i++) {
      const r = n / 6000, ss = 22 * Math.pow(r, 1.3) + 45 * g * r * r;
      T += (ss - T) * dt / tau; g -= g * r * dt / 10; t += dt;
      out.push([t, n, T]);
    }
  }
  const max = out.reduce((m, p) => Math.max(m, p[2]), 0);
  return { pts: out, max, total: t, over: max > RUNIN_LIMIT };
}
export function runinProgram(steps = RUNIN) {
  const L = ["O9001 (SPINDLE RUN-IN - EXAMPLE, CHECK THE MAKER'S PROGRAM)", "G91 G28 Z0 ;", "G90 ;"];
  steps.forEach(([n, min], i) => { L.push(`${i === 0 ? "M03 " : ""}S${n} ;`); L.push(`G04 X${min * 60}. ; (${min} MIN - WATCH TEMPERATURE)`); });
  L.push("M05 ;", "M30 ;");
  return L.join("\n");
}

/* ------------------------------------------------------------------ capability (deterministic example data) */
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function normals(seed, n) { const r = rng(seed), z = []; while (z.length < n) { const u1 = 1 - r(), u2 = r(); z.push(Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)); } return z; }
export const BORE = { name: "main bearing bore Ø62 H7", nom: 62.000, lsl: 62.000, usl: 62.030 };
/** 50-part run-off data sets (mm, 0.1 µm resolution of an air gauge). A = warm machine, B = cold start drift, C = loose fixture */
export function boreData(set = "A") {
  const z = normals(20271112, 50);
  return z.map((v, i) => {
    let x = 62.0160 + 0.0021 * v;
    if (set === "B") x += 0.0070 * Math.exp(-i / 10);                 // first parts larger: machine not warm yet (illustration)
    if (set === "C") x = 62.0160 + 0.0048 * v + (i % 2 ? 0.002 : -0.002);   // loose clamp: more spread, alternating pallets
    return Math.round(x * 10000) / 10000;
  });
}
export function stats(x) {
  const n = x.length, mean = x.reduce((s, v) => s + v, 0) / n;
  const s = Math.sqrt(x.reduce((q, v) => q + (v - mean) ** 2, 0) / (n - 1));
  return { n, mean, s, min: Math.min(...x), max: Math.max(...x) };
}
/** machine capability: Cm = T / (6s), Cmk = min(USL − x̄, x̄ − LSL) / (3s) */
export function capability(x, lim = BORE) {
  const st = stats(x), T = lim.usl - lim.lsl;
  return { ...st, Cm: T / (6 * st.s), Cmk: Math.min(lim.usl - st.mean, st.mean - lim.lsl) / (3 * st.s) };
}
/** process preview: 25 subgroups of 5 over several days. Cp/Cpk with σ_within = R̄/d2 (d2 = 2.326), Pp/Ppk with the overall s */
export function processData() {
  const zg = normals(4711, 25), zw = normals(815, 125), groups = [];
  for (let g = 0; g < 25; g++) groups.push(zw.slice(g * 5, g * 5 + 5).map((v) => Math.round((62.0160 + 0.0016 * zg[g] + 0.0021 * v) * 10000) / 10000));
  return groups;
}
export function processCap(groups, lim = BORE) {
  const all = groups.flat(), st = stats(all), T = lim.usl - lim.lsl;
  const Rbar = groups.reduce((s, g) => s + (Math.max(...g) - Math.min(...g)), 0) / groups.length, sw = Rbar / 2.326;
  const dn = Math.min(lim.usl - st.mean, st.mean - lim.lsl);
  return { ...st, Rbar, sw, Cp: T / (6 * sw), Cpk: dn / (3 * sw), Pp: T / (6 * st.s), Ppk: dn / (3 * st.s) };
}
/** cycle-time proof: 10 measured floor-to-floor cycles (s) vs the quoted 360 s (345 s machining + 15 s pallet change) */
export function cycleData() { const z = normals(360, 10); return z.map((v) => Math.round((356 + 2.2 * v) * 10) / 10); }
