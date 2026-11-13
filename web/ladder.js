/* Shared PLC ladder core (LAD) – Delta (ISPSoft / WPLSoft) and Siemens (TIA Portal) side by side.
 * Contract: docs/35_contract_ladder.md. Used by asrslad.js (AS/RS), apclad.js (APC), hydlad.js (hydraulics).
 *
 *   import { mountLadder, scaleLin } from "./ladder.js";
 *   const ctl = mountLadder(containerEl, program, { plant, onScan, height, view, speed, parts });
 *   ctl = { setInput(tag, v), force(tag, v|null), get(tag), state, start(), stop(), reset(), scan(n), setView(v), destroy(), engine, ... }
 *
 * program = { id, title, scanMs, plc: { delta: { cpu, sw }, siemens: { cpu, sw } }, tags: [...], networks: [{ title, comment, rungs: [{ in: TREE, out: [OUT…] }] }] }
 *   TREE: { s: [TREE…] } series (AND) · { p: [TREE…] } parallel (OR) · { c: "NO"|"NC"|"P"|"N", t } contact (P/N edge, optional m: edge memory name)
 *         · { cmp: ">="|"<="|">"|"<"|"=="|"<>", a, b } compare contact · { b: "TON"|"TOF"|"TP", t } timer box · { b: "CTU"|"CTD", t, r } counter box
 *   OUT:  { o: "OUT"|"SET"|"RST"|"NOT", t } · { mov: number|"TAG", to } · { calc: "A*B+C", to }
 *   tag:  { name, dir: I|Q|M|AI|AQ|T|C|W, type, delta, siemens, comment, wire, init, unit, min, max, pt (s), pv,
 *           ui: "push"|"switch"|"sensor"|"none" (input panel; push = momentary, value = !init while pressed; sensor = driven by the plant, click = force),
 *           inc (slider step for AI), label (panel text), hideIO, stepLabel,
 *           sys: "first"|"on"|"clk1" (Delta M1002 / M1000 / M1013, Siemens FirstScan / AlwaysTRUE / Clock_1Hz), group, step (a step bit, shown in the step strip) }
 *   Tag references may be dotted: "T_X.Q", "T_X.ET" (s), "C_X.CV", "C_X.Q". A timer / counter used as a contact = its Q bit, used as a number = ET / CV.
 *   Boxes (timers / counters) belong in the TOP-LEVEL series of a rung (the Delta IL generator splits the rung there, like TMR / CNT in ISPSoft).
 * plant(state, dt, engine) is called every scan BEFORE the logic (reads outputs, writes inputs); plant.reset() (optional) on Reset.
 * Self-test: URL parameter &ladtest → console "LADTEST …" (tree evaluation, seal-in, timers, edges, counters, compare, calc, IL + SCL generation).
 * Offline, no libraries. All addresses are EXAMPLES – check with your PLC configuration.
 */

const Q = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** linear scaling, e.g. scaleLin(raw, 0, 27648, 0, 16) → MPa (Siemens NORM_X + SCALE_X); clamp = true limits to the output range */
export function scaleLin(x, inMin, inMax, outMin, outMax, clamp = false) {
  const y = outMin + (x - inMin) * (outMax - outMin) / ((inMax - inMin) || 1);
  if (!clamp) return y;
  const lo = Math.min(outMin, outMax), hi = Math.max(outMin, outMax);
  return Math.max(lo, Math.min(hi, y));
}

/* ======================================================================= expression parser (calc) */
export function parseExpr(src) {
  const toks = String(src).match(/\d+\.?\d*(?:[eE][-+]?\d+)?|[A-Za-z_][\w.]*|[-+*/()]/g) || [];
  let i = 0;
  const peek = () => toks[i], next = () => toks[i++];
  function prim() {
    const t = next();
    if (t === undefined) throw new Error("calc: unexpected end in " + src);
    if (t === "(") { const e = add(); if (next() !== ")") throw new Error("calc: missing ) in " + src); return e; }
    if (t === "-") return { op: "neg", a: prim() };
    if (/^\d/.test(t)) return { num: +t };
    return { tag: t };
  }
  function mul() { let a = prim(); while (peek() === "*" || peek() === "/") { const op = next(); a = { op, a, b: prim() }; } return a; }
  function add() { let a = mul(); while (peek() === "+" || peek() === "-") { const op = next(); a = { op, a, b: mul() }; } return a; }
  const e = add();
  if (i < toks.length) throw new Error("calc: unexpected '" + toks[i] + "' in " + src);
  return e;
}
function exprTags(e, out = []) { if (!e) return out; if (e.tag) out.push(e.tag); exprTags(e.a, out); exprTags(e.b, out); return out; }

/* ======================================================================= program helpers */
const baseName = (t) => String(t).split(".")[0];
const isBox = (n) => !!(n && !n.cmp && typeof n.b === "string" && /^(TON|TOF|TP|CTU|CTD)$/.test(n.b));
const isLeaf = (n) => !!(n && (n.c || n.cmp || isBox(n)));
function unwrap(n) { while (n && (n.s || n.p) && (n.s || n.p).length === 1) n = (n.s || n.p)[0]; return n; }
function walk(n, f) { if (!n) return; f(n); (n.s || n.p || []).forEach((c) => walk(c, f)); }
function seriesList(tree) {               // top-level series as a flat list
  const n = unwrap(tree); if (!n) return [];
  if (n.s) { const out = []; n.s.forEach((c) => { const u = unwrap(c); if (u && u.s) out.push(...seriesList(u)); else out.push(u); }); return out; }
  return [n];
}
function ensureIds(program) {           // unique id per tree node (edge memories, SCL #edge<n>) – also for programs never run by an engine
  let uid = 0;
  eachRung(program, (r) => walk(r.in, (n) => { if (n._id !== undefined) uid = Math.max(uid, n._id); }));
  eachRung(program, (r) => walk(r.in, (n) => { if (n._id === undefined) n._id = ++uid; }));
}
function eachRung(program, f) { program.networks.forEach((net, ni) => (net.rungs || []).forEach((r, ri) => f(r, net, ni, ri))); }

/* ======================================================================= engine */
export function createEngine(program, opts = {}) {
  const tags = new Map(program.tags.map((t) => [t.name, t]));
  const st = {};
  const edge = new Map();
  const forces = new Map();
  const warned = new Set();
  ensureIds(program);
  eachRung(program, (r) => { (r.out || []).forEach((o) => { if (o.calc && !o._ast) o._ast = parseExpr(o.calc); }); });
  const E = { program, tags, state: st, forces, time: 0, scans: 0, first: true, dt: (program.scanMs || 20) / 1000, execUs: 0, plant: opts.plant || null, onScan: opts.onScan || null };

  function warn(m) { if (!warned.has(m)) { warned.add(m); console.warn("ladder: " + m); } }
  function init() {
    for (const t of program.tags) {
      if (t.dir === "T") st[t.name] = { IN: false, Q: false, ET: 0, PT: +t.pt || 0, run: false };
      else if (t.dir === "C") st[t.name] = { CV: 0, Q: false, PV: +t.pv || 0, last: false };
      else st[t.name] = t.init !== undefined ? t.init : (t.type === "BOOL" || (!t.type && /^(I|Q|M)$/.test(t.dir)) ? false : 0);
    }
    edge.clear(); E.time = 0; E.scans = 0; E.first = true;
  }
  function sysVal(t) { return t.sys === "first" ? E.first : t.sys === "on" ? true : t.sys === "clk1" ? (E.time % 1) < 0.5 : null; }
  function raw(name) {
    const [b, f] = String(name).split(".");
    const t = tags.get(b);
    if (!t) { warn("unknown tag " + name); return 0; }
    if (t.sys) return sysVal(t);
    const v = st[b];
    if (v && typeof v === "object") { if (f) return v[f]; return t.dir === "T" || t.dir === "C" ? v : v; }
    return v;
  }
  function bit(name) {
    const v = raw(name);
    if (v && typeof v === "object") return !!v.Q;
    return !!v;
  }
  function num(x) {
    if (typeof x === "number") return x;
    const v = raw(x);
    if (v && typeof v === "object") return v.CV !== undefined ? v.CV : v.ET;
    return typeof v === "boolean" ? (v ? 1 : 0) : +v || 0;
  }
  function evalAst(e) {
    if (e.num !== undefined) return e.num;
    if (e.tag) return num(e.tag);
    if (e.op === "neg") return -evalAst(e.a);
    const a = evalAst(e.a), b = evalAst(e.b);
    return e.op === "+" ? a + b : e.op === "-" ? a - b : e.op === "*" ? a * b : b === 0 ? 0 : a / b;
  }
  const CMP = { ">=": (a, b) => a >= b, "<=": (a, b) => a <= b, ">": (a, b) => a > b, "<": (a, b) => a < b, "==": (a, b) => Math.abs(a - b) < 1e-9, "<>": (a, b) => Math.abs(a - b) >= 1e-9 };
  function timer(n, pin) {
    const tm = st[n.t]; if (!tm) { warn("timer tag missing " + n.t); return false; }
    const t = tags.get(n.t); tm.PT = +t.pt || tm.PT; const dt = E.dt;
    if (n.b === "TON") {
      if (pin) { tm.ET = tm.IN ? Math.min(tm.PT, tm.ET + dt) : 0; tm.Q = tm.ET >= tm.PT - 1e-9; } else { tm.ET = 0; tm.Q = false; }
    } else if (n.b === "TOF") {
      if (pin) { tm.Q = true; tm.ET = 0; } else if (tm.Q) { tm.ET = tm.IN ? 0 : Math.min(tm.PT, tm.ET + dt); if (tm.ET >= tm.PT - 1e-9) tm.Q = false; }
    } else {                                // TP pulse
      if (pin && !tm.IN && !tm.run) { tm.run = true; tm.ET = 0; }
      else if (tm.run) tm.ET = Math.min(tm.PT, tm.ET + dt);
      if (tm.run && tm.ET >= tm.PT - 1e-9) tm.run = false;
      tm.Q = tm.run;
      if (!pin && !tm.run) tm.ET = 0;
    }
    tm.IN = pin;
    return tm.Q;
  }
  function counter(n, pin) {
    const c = st[n.t]; if (!c) { warn("counter tag missing " + n.t); return false; }
    const t = tags.get(n.t); c.PV = +t.pv || c.PV;
    if (n.r && bit(n.r)) c.CV = n.b === "CTD" ? c.PV : 0;
    else if (pin && !c.last) c.CV += n.b === "CTD" ? -1 : 1;
    c.CV = Math.max(-32768, Math.min(32767, c.CV));
    c.last = pin;
    c.Q = n.b === "CTD" ? c.CV <= 0 : c.CV >= c.PV;
    return c.Q;
  }
  function ev(n, pin) {
    let out;
    if (n.s) { let p = pin; for (const c of n.s) p = ev(c, p); out = p; }
    else if (n.p) { let o = false; for (const c of n.p) { if (ev(c, pin)) o = true; } out = o; }
    else if (n.c) {
      const v = bit(n.t); let cl;
      if (n.c === "NO") cl = v; else if (n.c === "NC") cl = !v;
      else { const prev = edge.has(n._id) ? edge.get(n._id) : false; edge.set(n._id, v); cl = n.c === "P" ? v && !prev : !v && prev; }
      n._cl = cl; out = pin && cl;
    } else if (n.cmp) { const cl = (CMP[n.cmp] || CMP["=="])(num(n.a), num(n.b)); n._cl = cl; out = pin && cl; }
    else if (n.b === "TON" || n.b === "TOF" || n.b === "TP") { out = timer(n, pin); n._cl = out; }
    else if (n.b === "CTU" || n.b === "CTD") { out = counter(n, pin); n._cl = out; }
    else { warn("unknown element " + JSON.stringify(n)); out = false; }
    n._pin = pin; n._pout = out;
    return out;
  }
  function write(name, v) {
    const t = tags.get(baseName(name));
    if (!t) { warn("unknown tag " + name); return; }
    if (t.type === "INT" || t.type === "WORD") v = Math.round(v);
    st[t.name] = v;
  }
  function exec(o, p) {
    o._p = p;
    if (o.o) {
      const t = tags.get(o.t);
      if (!t) { warn("unknown tag " + o.t); return; }
      if (o.o === "OUT") write(o.t, p);
      else if (o.o === "NOT") write(o.t, !p);
      else if (o.o === "SET") { if (p) write(o.t, true); }
      else if (o.o === "RST" && p) {
        if (t.dir === "T") Object.assign(st[o.t], { IN: false, Q: false, ET: 0, run: false });
        else if (t.dir === "C") Object.assign(st[o.t], { CV: 0, Q: false });
        else write(o.t, typeof st[o.t] === "number" ? 0 : false);
      }
    } else if (o.mov !== undefined) { if (p) write(o.to, num(o.mov)); }
    else if (o.calc) { if (p) write(o.to, evalAst(o._ast)); }
  }
  function applyForces() { for (const [k, v] of forces) st[k] = v; }
  function scan() {
    const t0 = typeof performance !== "undefined" ? performance.now() : 0;
    E.time += E.dt;
    if (E.plant) { const f = typeof E.plant === "function" ? E.plant : E.plant.step; try { f.call(E.plant, st, E.dt, E); } catch (e) { warn("plant: " + e.message); } }
    applyForces();
    for (const net of program.networks) for (const r of net.rungs || []) {
      const p = r.in ? ev(r.in, true) : true;
      r._p = p;
      for (const o of r.out || []) exec(o, p);
    }
    E.first = false; E.scans++;
    if (E.onScan) E.onScan(st, E);
    if (t0) { E._accMs = (E._accMs || 0) + performance.now() - t0; E._accN = (E._accN || 0) + 1; if (E._accN >= 200) { E.execUs = E._accMs * 1000 / E._accN; E._accMs = 0; E._accN = 0; } }
  }
  E.init = init; E.scan = scan; E.bit = bit; E.num = num; E.raw = raw;
  E.set = (name, v) => { write(name, v); };
  E.force = (name, v) => { if (v === null || v === undefined) forces.delete(name); else { forces.set(name, v); st[name] = v; } };
  E.run = (seconds) => { const n = Math.round(seconds / E.dt); for (let i = 0; i < n; i++) scan(); };
  E.reset = () => { init(); forces.clear(); if (E.plant && typeof E.plant.reset === "function") E.plant.reset(st, E); };
  init();
  return E;
}

/* ======================================================================= address helpers */
function addrOf(program, name, view) {
  const t = program.tags.find((x) => x.name === baseName(name));
  if (!t) return "?";
  const a = view === "delta" ? t.delta : t.siemens;
  return a || "";
}
const deltaOp = (program, x) => {                       // operand for Delta IL
  if (typeof x === "number") return Number.isInteger(x) ? "K" + x : "F" + x;
  const t = program.tags.find((y) => y.name === baseName(x));
  if (!t) return "?" + x;
  return String(t.delta || x).split(/[\s(]/)[0];
};
const sieName = (program, x) => {                         // symbol for SCL
  if (typeof x === "number") return String(x);
  const [b, f] = String(x).split(".");
  const t = program.tags.find((y) => y.name === b);
  if (t && (t.dir === "T" || t.dir === "C")) return idb(t) + "." + (f || (t.dir === "T" ? "Q" : "Q"));
  return `"${b}"` + (f ? "." + f : "");
};
function idb(t) { const m = String(t.siemens || "").match(/"[^"]+"/); return m ? m[0] : `"IDB_${t.name}"`; }
export function timeLit(pt) {
  const ms = Math.round(pt * 1000), s = Math.floor(ms / 1000), r = ms % 1000;
  return "T#" + (s ? s + "S" : "") + (r ? r + "MS" : "") + (!s && !r ? "0MS" : "");
}
function deltaTimer(t) { const ten = Math.abs(t.pt * 10 - Math.round(t.pt * 10)) > 1e-6; return ten ? { op: "TMRH", k: Math.round(t.pt * 100) } : { op: "TMR", k: Math.round(t.pt * 10) }; }

/* ======================================================================= Delta instruction list */
export function genIL(program) {
  ensureIds(program);
  const out = [];
  const tagOf = (n) => program.tags.find((t) => t.name === baseName(n));
  const cm = (n) => { const t = tagOf(n); return t ? t.name : String(n); };
  const is32 = (x) => typeof x === "number" ? Number.isInteger(x) && (x > 32767 || x < -32768) : /^(DINT|UDINT|DWORD|INT32|UINT32)$/i.test((tagOf(x) || {}).type || "");   // Delta: 32-bit → D… instructions
  function leaf(n, mode, L) {
    if (n.c) {
      const op = { NO: ["LD", "AND", "OR"], NC: ["LDI", "ANI", "ORI"], P: ["LDP", "ANDP", "ORP"], N: ["LDF", "ANDF", "ORF"] }[n.c][["LD", "AND", "OR"].indexOf(mode)];
      L.push([op, deltaOp(program, n.t), cm(n.t)]);
    } else if (n.cmp) {
      const real = [n.a, n.b].some((x) => typeof x === "number" ? !Number.isInteger(x) : (tagOf(x) || {}).type === "REAL");
      const d32 = !real && (is32(n.a) || is32(n.b));
      const op = (real ? "F" : d32 ? "D" : "") + mode + (n.cmp === "==" ? "=" : n.cmp);
      const opd = (x) => real && typeof x === "number" ? "F" + x : deltaOp(program, x);   // float compare → float constant F10, not K10
      L.push([op, opd(n.a) + " " + opd(n.b), `${typeof n.a === "number" ? n.a : cm(n.a)} ${n.cmp} ${typeof n.b === "number" ? n.b : cm(n.b)}`]);
    } else if (n.b) L.push(["//", "box inside a branch – write it as its own rung in ISPSoft", n.t]);
  }
  function blk(n, L) {
    n = unwrap(n);
    if (isLeaf(n)) { leaf(n, "LD", L); return; }
    if (n.s) {
      blk(n.s[0], L);
      n.s.slice(1).forEach((c) => { c = unwrap(c); if (isLeaf(c)) leaf(c, "AND", L); else if (c.s) c.s.forEach((x) => { x = unwrap(x); if (isLeaf(x)) leaf(x, "AND", L); else { blk(x, L); L.push(["ANB", "", ""]); } }); else { blk(c, L); L.push(["ANB", "", ""]); } });
    } else if (n.p) {
      blk(n.p[0], L);
      n.p.slice(1).forEach((c) => { c = unwrap(c); if (isLeaf(c)) leaf(c, "OR", L); else { blk(c, L); L.push(["ORB", "", ""]); } });
    }
  }
  function calcIL(o, L) {
    const t = tagOf(o.to), real = t && t.type === "REAL";
    const ast0 = o._ast || parseExpr(o.calc);
    const any32 = (e) => !!e && (e.num !== undefined ? is32(e.num) : e.tag ? is32(e.tag) : any32(e.a) || any32(e.b));
    const w32 = !real && (is32(o.to) || any32(ast0));
    const nm = real ? { "+": "DEADD", "-": "DESUB", "*": "DEMUL", "/": "DEDIV" } : w32 ? { "+": "DADD", "-": "DSUB", "*": "DMUL", "/": "DDIV" } : { "+": "ADD", "-": "SUB", "*": "MUL", "/": "DIV" };
    let tmp = 0;
    const rec = (e, dest) => {
      if (e.num !== undefined) return real && Number.isInteger(e.num) ? "F" + e.num : deltaOp(program, e.num);
      if (e.tag) return deltaOp(program, e.tag);
      if (e.op === "neg") { const a = rec(e.a); const d = dest || "D" + (900 + 2 * tmp++); L.push([real ? "DESUB" : w32 ? "DSUB" : "SUB", (real ? "F0 " : "K0 ") + a + " " + d, "negate"]); return d; }
      const a = rec(e.a), b = rec(e.b), d = dest || "D" + (900 + 2 * tmp++);
      L.push([nm[e.op], `${a} ${b} ${d}`, dest ? `${o.to} := ${o.calc}` : "intermediate (scratch register)"]);
      return d;
    };
    const ast = o._ast || parseExpr(o.calc);
    if (ast.num !== undefined || ast.tag) L.push([real ? "DMOVR" : w32 ? "DMOV" : "MOV", rec(ast) + " " + deltaOp(program, o.to), `${o.to} := ${o.calc}`]);
    else rec(ast, deltaOp(program, o.to));
  }
  function outs(r, L) {
    const os = r.out || [];
    os.forEach((o, i) => {
      if (o.o === "OUT") L.push(["OUT", deltaOp(program, o.t), cm(o.t)]);
      else if (o.o === "SET") L.push(["SET", deltaOp(program, o.t), cm(o.t)]);
      else if (o.o === "RST") L.push(["RST", deltaOp(program, o.t), cm(o.t)]);
      else if (o.o === "NOT") { L.push(["INV", "", "invert the result"]); L.push(["OUT", deltaOp(program, o.t), cm(o.t) + " (negated coil)"]); if (i < os.length - 1) L.push(["INV", "", "restore"]); }
      else if (o.mov !== undefined) { const t = tagOf(o.to); L.push([t && t.type === "REAL" ? "DMOVR" : (is32(o.to) || is32(o.mov)) ? "DMOV" : "MOV", (t && t.type === "REAL" && typeof o.mov === "number" ? "F" + o.mov : deltaOp(program, o.mov)) + " " + deltaOp(program, o.to), `${o.to} := ${typeof o.mov === "number" ? o.mov : o.mov}`]); }
      else if (o.calc) calcIL(o, L);
    });
  }
  program.networks.forEach((net, ni) => {
    const L = [];
    (net.rungs || []).forEach((r) => {
      const list = seriesList(r.in);
      const after = [];
      let seg = [];
      const flush = (box) => {
        if (seg.length) blk(seg.length === 1 ? seg[0] : { s: seg }, L); else L.push(["LD", "M1000", "always ON (no condition)"]);
        const t = tagOf(box.t);
        if (box.b === "CTU" || box.b === "CTD") {
          L.push([box.b === "CTD" ? "DCNT" : "CNT", `${deltaOp(program, box.t)} K${t ? t.pv : 0}`, `${box.t} counter, preset ${t ? t.pv : "?"}${box.b === "CTD" ? " (down: C200+ with direction flag M1200+ – check)" : ""}`]);
          if (box.r) after.push([["LD", deltaOp(program, box.r), cm(box.r)], ["RST", deltaOp(program, box.t), "reset " + box.t]]);
        } else {
          const dt = deltaTimer(t || { pt: 0 });
          const op = box.b === "TON" ? dt.op : box.b;   // TOF / TP: AS series IEC timer instructions
          L.push([op, `${deltaOp(program, box.t)} K${dt.k}`, `${box.t} ${box.b} ${t ? t.pt : "?"} s (${dt.op === "TMRH" ? "10 ms" : "100 ms"} base)${box.b !== "TON" ? " – AS series instruction, check the manual" : ""}`]);
        }
        seg = [{ c: "NO", t: box.t }];
      };
      if (!list.length) L.push(["LD", "M1000", "always ON"]);
      list.forEach((n) => { if (isBox(n)) flush(n); else seg.push(n); });
      const endsInBox = list.length && isBox(list[list.length - 1]);
      if (list.length && !(endsInBox && !(r.out || []).length)) blk(seg.length === 1 ? seg[0] : { s: seg }, L);
      outs(r, L);
      after.forEach((a) => L.push(...a));
    });
    out.push({ net: ni + 1, title: net.title, lines: L });
  });
  return out;
}
export function ilText(program) {
  const pad = (s, n) => (s + " ".repeat(n)).slice(0, Math.max(n, s.length));
  return genIL(program).map((b) => `// ${b.title}\n` + b.lines.map(([op, a, c]) => op === "//" ? `// ${a} (${c})` : `${pad(op, 7)} ${pad(a, 20)} // ${c}`).join("\n")).join("\n\n");
}

/* ======================================================================= Siemens SCL equivalent */
export function genSCL(program) {
  ensureIds(program);
  const tagOf = (n) => program.tags.find((t) => t.name === baseName(n));
  const lines = [];
  const expr = (n, pre) => {
    n = unwrap(n);
    if (!n) return "TRUE";
    if (n.s) return n.s.map((c) => { const u = unwrap(c); const e = expr(u, pre); return u && u.p && u.p.length > 1 ? `(${e})` : e; }).join(" AND ");
    if (n.p) return n.p.map((c) => expr(c, pre)).join(" OR ");
    if (n.c === "NO") return sieName(program, n.t);
    if (n.c === "NC") return "NOT " + sieName(program, n.t);
    if (n.c === "P" || n.c === "N") {
      const m = n.m ? `"${n.m}"` : `"EdgeMem".M${n._id || 0}`;
      const v = `#edge${n._id || 0}`;
      pre.push(`${v} := ${n.c === "P" ? "" : "NOT "}${sieName(program, n.t)} AND ${n.c === "P" ? "NOT " : ""}${m};   // ${n.c === "P" ? "rising" : "falling"} edge (like -|${n.c}|-)`, `${m} := ${sieName(program, n.t)};`);
      return v;
    }
    if (n.cmp) { const s = (x) => typeof x === "number" ? String(x) : (tagOf(x) && tagOf(x).dir === "T" ? idb(tagOf(x)) + ".ET" : tagOf(x) && tagOf(x).dir === "C" ? idb(tagOf(x)) + ".CV" : sieName(program, x)); return `${s(n.a)} ${n.cmp === "==" ? "=" : n.cmp} ${s(n.b)}`; }
    return "FALSE";
  };
  const sclExpr = (e) => e.num !== undefined ? String(e.num) : e.tag ? sieName(program, e.tag) : e.op === "neg" ? `-(${sclExpr(e.a)})` : `(${sclExpr(e.a)} ${e.op} ${sclExpr(e.b)})`;
  program.networks.forEach((net) => {
    lines.push(`// ---- ${net.title}`);
    (net.rungs || []).forEach((r) => {
      const pre = [], list = seriesList(r.in), body = [];
      let seg = [], hasBox = false;
      const segExpr = () => seg.length ? seg.map((c) => { const u = unwrap(c); const e = expr(u, pre); return u && u.p && u.p.length > 1 ? `(${e})` : e; }).join(" AND ") : "TRUE";
      list.forEach((n) => {
        if (isBox(n)) {
          const t = tagOf(n.t), I = t ? idb(t) : `"IDB_${n.t}"`;
          const inE = segExpr();
          if (n.b === "CTU" || n.b === "CTD") body.push(`${I}.${n.b}(${n.b === "CTU" ? "CU" : "CD"} := ${inE}, ${n.b === "CTU" ? "R" : "LD"} := ${n.r ? sieName(program, n.r) : "FALSE"}, PV := ${t ? t.pv : 0});`);
          else body.push(`${I}.${n.b}(IN := ${inE}, PT := ${timeLit(t ? t.pt : 0)});`);
          seg = [{ c: "NO", t: n.t }]; hasBox = true;
        } else seg.push(n);
      });
      const os = r.out || [];
      if (!os.length) { lines.push(...pre, ...body); return; }
      const cond = segExpr();
      const simple = os.length === 1 && (os[0].o === "OUT" || os[0].o === "NOT");
      lines.push(...pre, ...body);
      if (simple) lines.push(`${sieName(program, os[0].t)} := ${os[0].o === "NOT" ? `NOT (${cond})` : cond};`);
      else {
        const v = cond === "TRUE" ? null : "#rlo";
        if (v) lines.push(`#rlo := ${cond};`);
        os.forEach((o) => {
          const gate = (s) => v ? `IF #rlo THEN ${s} END_IF;` : s;
          if (o.o === "OUT") lines.push(`${sieName(program, o.t)} := ${v || "TRUE"};`);
          else if (o.o === "NOT") lines.push(`${sieName(program, o.t)} := NOT ${v || "TRUE"};`);
          else if (o.o === "SET") lines.push(gate(`${sieName(program, o.t)} := TRUE;`));
          else if (o.o === "RST") { const t = tagOf(o.t); lines.push(gate(t && t.dir === "T" ? `RESET_TIMER(${idb(t)});` : t && t.dir === "C" ? `${idb(t)}.CV := 0;   // or the R input` : `${sieName(program, o.t)} := ${t && t.type && t.type !== "BOOL" ? "0" : "FALSE"};`)); }
          else if (o.mov !== undefined) lines.push(gate(`${sieName(program, o.to)} := ${typeof o.mov === "number" ? o.mov : sieName(program, o.mov)};`));
          else if (o.calc) lines.push(gate(`${sieName(program, o.to)} := ${sclExpr(o._ast || parseExpr(o.calc)).replace(/^\((.*)\)$/, "$1")};`));
        });
      }
      void hasBox;
    });
    lines.push("");
  });
  return lines.join("\n");
}

/* ======================================================================= program check (typical mistakes) */
export function checkProgram(program) {
  const W = [], names = new Set(program.tags.map((t) => t.name)), coils = {};
  const ref = (x, where) => { if (typeof x === "string" && !names.has(baseName(x))) W.push(`${where}: unknown tag ${x}`); };
  eachRung(program, (r, net, ni) => {
    const where = `network ${ni + 1}`;
    walk(r.in, (n) => { if (n.c || n.b) ref(n.t, where); if (n.cmp) { ref(n.a, where); ref(n.b, where); } if (n.r) ref(n.r, where); });
    (r.out || []).forEach((o) => {
      if (o.o) { ref(o.t, where); if (o.o === "OUT" || o.o === "NOT") (coils[o.t] = coils[o.t] || []).push(ni + 1); const t = program.tags.find((x) => x.name === o.t); if (t && (t.dir === "I" || t.dir === "AI")) W.push(`${where}: writes the input ${o.t}`); }
      if (o.mov !== undefined) { ref(o.mov, where); ref(o.to, where); }
      if (o.calc) { try { exprTags(parseExpr(o.calc)).forEach((t) => ref(t, where)); } catch (e) { W.push(`${where}: ${e.message}`); } ref(o.to, where); }
    });
  });
  for (const [t, nets] of Object.entries(coils)) if (nets.length > 1) W.push(`double coil: ${t} is an OUT in networks ${nets.join(", ")} – only the last one wins`);
  for (const t of program.tags) {
    const s = String(t.siemens || ""), d = String(t.delta || "");
    const m = s.match(/^%[IQM]B?(\d+)\.(\d+)/); if (m && +m[2] > 7) W.push(`${t.name}: Siemens bit address ${s} – bit numbers are 0 … 7 only`);
    const a = d.match(/^[XY](\d+)\.(\d+)/); if (a && +a[2] > 15) W.push(`${t.name}: Delta AS address ${d} – bit numbers are 0 … 15`);
    const o = d.match(/^[XY](\d+)$/); if (o && /[89]/.test(o[1])) W.push(`${t.name}: Delta DVP address ${d} – X / Y are octal (no 8 or 9)`);
    if (t.dir === "T" && t.pt * 10 > 32767) W.push(`${t.name}: preset too long for a 16-bit 100 ms timer`);
  }
  return W;
}

/* ======================================================================= I/O table */
export function ioRows(program) {
  return program.tags.filter((t) => !t.hideIO).map((t) => [t.name, t.dir, t.delta || "", t.siemens || "", t.comment || "", t.wire || "",
    t.dir === "T" ? `${t.pt} s` : t.dir === "C" ? `PV ${t.pv}` : t.unit ? `${t.min ?? ""} … ${t.max ?? ""} ${t.unit}` : ""]);
}

/* ======================================================================= SVG rendering */
const CWc = 100, LY = 30;                 // contact width, main-line y inside an element
const TRUNC = (s, n = 16) => { s = String(s); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
function size(n) {
  n = unwrap(n);
  if (!n) return { w: 20, h: 58, ly: LY };
  if (n._sz) return n._sz;
  let r;
  if (n.c) r = { w: CWc, h: 66, ly: LY };
  else if (n.cmp) r = { w: 118, h: 76, ly: LY };
  else if (n.b) r = { w: 132, h: 100, ly: LY };
  else if (n.s) { const ch = n.s.map(size); const ly = Math.max(...ch.map((c) => c.ly)); r = { w: ch.reduce((k, c) => k + c.w, 0), ly, h: Math.max(...ch.map((c) => ly + c.h - c.ly)) }; }
  else { const ch = n.p.map(size); r = { w: Math.max(...ch.map((c) => c.w)) + 16, ly: ch[0].ly, h: ch.reduce((k, c) => k + c.h, 0) }; }
  Object.defineProperty(n, "_sz", { value: r, enumerable: false, configurable: true, writable: true });
  return r;
}
const outSize = (o) => (o.o ? { w: 118, h: 74 } : { w: 168, h: 78 });

function makeRenderer(program, E, view) {
  const binds = [];
  const bind = (kind, f) => { binds.push({ kind, f }); return binds.length - 1; };
  const tagOf = (n) => program.tags.find((t) => t.name === baseName(n));
  const nameLbl = (n) => view === "siemens" ? `"${baseName(n)}"` : baseName(n);
  const fmtNum = (v, t) => { if (v === undefined || v === null) return ""; if (typeof v === "boolean") return v ? "1" : "0"; const real = t && t.type === "REAL"; return real ? (+v).toFixed(Math.abs(v) < 10 ? 2 : 1) : String(Math.round(v)); };
  const valTxt = (x) => { if (typeof x === "number") return String(x); const t = tagOf(x); return fmtNum(E.num(x), t); };
  const wire = (x1, y1, x2, y2, f) => `<line class="ld-w" data-k="${bind("w", f)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  const txt = (x, y, s, cls, anchor = "middle", full) => `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${full ? `<title>${esc(full)}</title>` : ""}${esc(s)}</text>`;
  const live = (x, y, f, cls = "ld-val", anchor = "middle") => `<text class="${cls}" data-k="${bind("t", f)}" x="${x}" y="${y}" text-anchor="${anchor}"></text>`;

  function addrLines(name) {
    const t = tagOf(name), a = addrOf(program, name, view);
    return { a, t, title: t ? `${t.name} – ${t.comment || ""} · Delta ${t.delta || "–"} · Siemens ${t.siemens || "–"}${t.wire ? " · " + t.wire : ""}` : name };
  }
  function contact(n, x, y) {
    const w = CWc, yl = y + LY, cx = x + w / 2, { a, title } = addrLines(n.t);
    let s = `<g class="ld-el" data-tag="${esc(baseName(n.t))}"><title>${esc(title)}</title>`;
    s += wire(x, yl, cx - 9, yl, () => n._pin) + wire(cx + 9, yl, x + w, yl, () => n._pout);
    s += `<g class="ld-sym" data-k="${bind("c", () => n._cl)}"><line x1="${cx - 9}" y1="${yl - 11}" x2="${cx - 9}" y2="${yl + 11}"/><line x1="${cx + 9}" y1="${yl - 11}" x2="${cx + 9}" y2="${yl + 11}"/>`;
    if (n.c === "NC") s += `<line x1="${cx - 13}" y1="${yl + 11}" x2="${cx + 13}" y2="${yl - 11}"/>`;
    s += `</g>`;
    if (n.c === "P" || n.c === "N") s += txt(cx, yl + 4, n.c, "ld-pn");
    s += txt(cx, y + 9, TRUNC(a, 15), "ld-addr", "middle", a);
    s += txt(cx, yl + 23, TRUNC(nameLbl(n.t), 15), "ld-name", "middle", baseName(n.t));
    if ((n.c === "P" || n.c === "N") && view === "siemens") s += txt(cx, yl + 33, TRUNC(n.m ? `"${n.m}"` : `"EdgeMem".M${n._id}`, 16), "ld-mem");
    return s + `</g>`;
  }
  function cmpBox(n, x, y) {
    const w = 118, yl = y + LY, bx = x + 14, bw = w - 28;
    const typ = [n.a, n.b].some((v) => typeof v === "number" ? !Number.isInteger(v) : (tagOf(v) || {}).type === "REAL") ? "Real" : "Int";
    const lbl = (v) => typeof v === "number" ? (view === "delta" ? (Number.isInteger(v) && typ === "Int" ? "K" + v : "F" + v) : String(v)) : TRUNC(view === "delta" ? deltaOp(program, v) : `"${baseName(v)}"`, 15);
    let s = `<g class="ld-el" data-tag="${esc(typeof n.a === "string" ? baseName(n.a) : "")}"><title>${esc(`compare ${n.a} ${n.cmp} ${n.b}`)}</title>`;
    s += wire(x, yl, bx, yl, () => n._pin) + wire(bx + bw, yl, x + w, yl, () => n._pout);
    s += `<rect class="ld-box" data-k="${bind("c", () => n._cl)}" x="${bx}" y="${yl - 14}" width="${bw}" height="58" rx="2"/>`;
    s += txt(bx + bw / 2, yl - 2, view === "delta" ? `${n.cmp === "==" ? "=" : n.cmp}` : `CMP ${n.cmp === "==" ? "==" : n.cmp} ${typ}`, "ld-bt");
    s += txt(bx + 4, yl + 12, lbl(n.a), "ld-op", "start") + txt(bx + 4, yl + 25, lbl(n.b), "ld-op", "start");
    s += live(bx + bw / 2, yl + 39, () => `${valTxt(n.a)} ${n.cmp === "==" ? "=" : n.cmp} ${valTxt(n.b)}`, "ld-val ld-small");
    return s + `</g>`;
  }
  function box(n, x, y) {
    const w = 132, yl = y + LY, bx = x + 16, bw = w - 32, t = tagOf(n.t) || { pt: 0, pv: 0 };
    const isT = n.b === "TON" || n.b === "TOF" || n.b === "TP";
    let s = `<g class="ld-el" data-tag="${esc(n.t)}"><title>${esc(`${n.b} ${n.t} – ${t.comment || ""}`)}</title>`;
    s += wire(x, yl, bx, yl, () => n._pin) + wire(bx + bw, yl, x + w, yl, () => n._pout);
    s += `<rect class="ld-box" data-k="${bind("c", () => n._pout)}" x="${bx}" y="${yl - 14}" width="${bw}" height="80" rx="2"/>`;
    if (view === "delta") {
      if (isT) { const dt = deltaTimer(t); s += txt(bx + bw / 2, yl - 18, `${t.delta || ""}`, "ld-addr"); s += txt(bx + bw / 2, yl + 2, n.b === "TON" ? dt.op : n.b, "ld-bt") + txt(bx + bw / 2, yl + 20, `${deltaOp(program, n.t)}  K${dt.k}`, "ld-op"); }
      else { s += txt(bx + bw / 2, yl - 18, `${t.delta || ""}`, "ld-addr"); s += txt(bx + bw / 2, yl + 2, n.b === "CTD" ? "DCNT" : "CNT", "ld-bt") + txt(bx + bw / 2, yl + 20, `${deltaOp(program, n.t)}  K${t.pv}`, "ld-op"); }
    } else {
      s += txt(bx + bw / 2, yl - 18, TRUNC(idb(t), 20), "ld-addr");
      s += txt(bx + bw / 2, yl + 2, isT ? `${n.b}  Time` : `${n.b}  Int`, "ld-bt");
      s += txt(bx + 3, yl + 4, isT ? "IN" : n.b === "CTU" ? "CU" : "CD", "ld-pin", "start") + txt(bx + bw - 3, yl + 4, "Q", "ld-pin", "end");
      s += txt(bx + 3, yl + 22, isT ? `PT ${timeLit(t.pt)}` : `PV ${t.pv}`, "ld-op", "start");
      if (!isT) s += txt(bx + 3, yl + 38, `${n.b === "CTU" ? "R" : "LD"} ${n.r ? '"' + n.r + '"' : "–"}`, "ld-op ld-small", "start");
    }
    s += live(bx + bw / 2, yl + 56, () => { const v = E.state[n.t]; if (!v) return ""; return isT ? `${view === "siemens" ? "ET" : "T"} ${v.ET.toFixed(1)} / ${(+t.pt).toFixed(1)} s` : `${view === "siemens" ? "CV" : "C"} ${v.CV} / ${t.pv}`; });
    s += txt(x + w / 2, yl + 78, TRUNC(n.t, 18), "ld-name");
    if (view === "delta" && !isT && n.r) s += txt(x + w / 2, yl + 89, TRUNC("RST by " + n.r, 22), "ld-mem");
    return s + `</g>`;
  }
  function draw(n, x, y) {
    n = unwrap(n);
    if (!n) return "";
    if (n.c) return contact(n, x, y);
    if (n.cmp) return cmpBox(n, x, y);
    if (n.b) return box(n, x, y);
    const sz = size(n);
    if (n.s) { let s = "", cx = x; for (const c of n.s) { const cs = size(c); s += draw(c, cx, y + sz.ly - cs.ly); cx += cs.w; } return s; }
    // parallel
    let s = "", cy = y; const W = sz.w, ch = n.p.map((c) => unwrap(c));
    const ys = [];
    ch.forEach((c) => {
      const cs = size(c), yl = cy + cs.ly; ys.push(yl);
      s += wire(x, yl, x + 8, yl, () => n._pin);
      s += draw(c, x + 8, cy);
      if (cs.w < W - 16) s += wire(x + 8 + cs.w, yl, x + W - 8, yl, () => c._pout);
      s += wire(x + W - 8, yl, x + W, yl, () => c._pout);
      cy += cs.h;
    });
    for (let i = 1; i < ys.length; i++) {
      const below = ch.slice(i);
      s += wire(x, ys[i - 1], x, ys[i], () => n._pin);
      s += wire(x + W, ys[i - 1], x + W, ys[i], () => below.some((c) => c._pout));
    }
    return s;
  }
  function outEl(o, x, y, r) {
    const yl = y + LY;
    if (o.o) {
      const w = 118, cx = x + w / 2, { a, title } = addrLines(o.t);
      let s = `<g class="ld-el" data-tag="${esc(o.t)}"><title>${esc(title)}</title>`;
      s += wire(x, yl, cx - 12, yl, () => r._p);
      s += `<g class="ld-sym" data-k="${bind("c", () => o._p)}"><path d="M${cx - 7} ${yl - 12} A 13 13 0 0 0 ${cx - 7} ${yl + 12}" fill="none"/><path d="M${cx + 7} ${yl - 12} A 13 13 0 0 1 ${cx + 7} ${yl + 12}" fill="none"/></g>`;
      const letter = o.o === "SET" ? "S" : o.o === "RST" ? "R" : o.o === "NOT" ? "/" : "";
      if (letter) s += txt(cx, yl + 4, letter, "ld-pn");
      s += `<line class="ld-w" x1="${cx + 12}" y1="${yl}" x2="${x + w}" y2="${yl}"/>`;
      s += txt(cx, y + 9, TRUNC(a, 18), "ld-addr", "middle", a);
      s += txt(cx, yl + 23, TRUNC(nameLbl(o.t), 17), "ld-name", "middle", o.t);
      s += live(cx, yl + 34, () => { const t = tagOf(o.t); if (!t) return ""; if (t.dir === "T" || t.dir === "C") return ""; return E.bit(o.t) ? "= 1" : "= 0"; }, "ld-val ld-small");
      return s + "</g>";
    }
    const w = 168, bx = x + 10, bw = w - 20, to = tagOf(o.to) || {};
    let s = `<g class="ld-el" data-tag="${esc(o.to)}"><title>${esc(o.mov !== undefined ? `move ${o.mov} → ${o.to}` : `${o.to} := ${o.calc}`)}</title>`;
    s += wire(x, yl, bx, yl, () => r._p);
    s += `<rect class="ld-box" data-k="${bind("c", () => o._p)}" x="${bx}" y="${yl - 14}" width="${bw}" height="58" rx="2"/>`;
    const opn = (v) => typeof v === "number" ? (view === "delta" ? (Number.isInteger(v) ? "K" + v : "F" + v) : String(v)) : TRUNC(view === "delta" ? deltaOp(program, v) : `"${baseName(v)}"`, 16);
    if (o.mov !== undefined) {
      s += txt(bx + bw / 2, yl - 1, view === "delta" ? (to.type === "REAL" ? "DMOVR" : "MOV") : "MOVE", "ld-bt");
      s += txt(bx + 4, yl + 15, (view === "siemens" ? "IN " : "S ") + opn(o.mov), "ld-op", "start") + txt(bx + 4, yl + 32, (view === "siemens" ? "OUT1 " : "D ") + opn(o.to), "ld-op", "start");
    } else {
      s += txt(bx + bw / 2, yl - 1, view === "delta" ? "calc (ADD / MUL …)" : `CALCULATE ${to.type === "REAL" ? "Real" : "Int"}`, "ld-bt");
      s += txt(bx + 4, yl + 15, TRUNC(`${o.to} := ${o.calc}`, 27), "ld-op ld-small", "start", `${o.to} := ${o.calc}`);
      s += txt(bx + 4, yl + 32, (view === "siemens" ? "OUT " : "D ") + opn(o.to), "ld-op", "start");
    }
    s += live(bx + bw - 4, yl + 32, () => "= " + fmtNum(E.num(o.to), to), "ld-val ld-small", "end");
    return s + "</g>";
  }
  function rungSvg(r, treeW, outW) {
    const tsz = size(r.in), os = (r.out || []).map(outSize);
    const outH = os.reduce((k, o) => k + o.h, 0);
    const H = Math.max(tsz.h, outH, 58) + 10, x0 = 14, xo = x0 + treeW + 20, W = xo + outW + 16;
    let s = "";
    s += `<line class="ld-rail" x1="6" y1="0" x2="6" y2="${H}"/>`;
    if (view === "delta") s += `<line class="ld-rail" x1="${W - 6}" y1="0" x2="${W - 6}" y2="${H}"/>`;
    s += wire(6, 4 + LY, x0, 4 + LY, () => true);
    s += draw(r.in, x0, 4 + tsz.ly - LY + (LY - tsz.ly));
    const tEnd = x0 + tsz.w;
    s += wire(tEnd, 4 + LY, xo, 4 + LY, () => r._p);
    let oy = 4;
    const yls = [];
    (r.out || []).forEach((o, i) => { yls.push(oy + LY); s += outEl(o, xo + 8, oy, r); s += wire(xo, oy + LY, xo + 8, oy + LY, () => r._p); if (view === "delta" && o.o) s += `<line class="ld-w ld-off" x1="${xo + 8 + 118}" y1="${oy + LY}" x2="${W - 6}" y2="${oy + LY}"/>`; oy += os[i].h; });
    if (yls.length > 1) s += wire(xo, yls[0], xo, yls[yls.length - 1], () => r._p);
    return { svg: `<svg class="ld-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="max-width:100%;height:auto" role="img" aria-label="ladder rung">${s}</svg>`, W };
  }
  function netHtml(net) {
    const rs = net.rungs || [];
    const treeW = Math.max(60, ...rs.map((r) => size(r.in).w)), outW = Math.max(118, ...rs.map((r) => Math.max(0, ...(r.out || []).map((o) => outSize(o).w))));
    let W = 0;
    const html = rs.map((r) => { const g = rungSvg(r, treeW, outW); W = Math.max(W, g.W); return `<div class="ld-rung">${r.comment ? `<div class="ld-rc">${esc(r.comment)}</div>` : ""}${g.svg}</div>`; }).join("");
    return { html, W };
  }
  return { netHtml, binds };
}

/* ======================================================================= the mounted page part */
export function mountLadder(container, program, opts = {}) {
  const E = createEngine(program, { plant: opts.plant, onScan: opts.onScan });
  let view = opts.view || (Q.get("ladview") || "both");
  let running = false, speed = opts.speed || 1, timer = 0, last = 0, acc = 0, destroyed = false, renderers = [];
  const pid = "ld" + Math.random().toString(36).slice(2, 7);
  const warns = checkProgram(program);
  const P = Object.assign({ io: true, il: true, scl: true }, opts.parts || {});
  const inTags = program.tags.filter((t) => (t.dir === "I" || t.dir === "AI") && t.ui !== "none" && !t.sys);
  const outTags = program.tags.filter((t) => (t.dir === "Q" || t.dir === "AQ") && !t.hideIO);
  const stepTags = program.tags.filter((t) => t.step);
  const groups = [];
  inTags.forEach((t) => { const g = t.group || (t.dir === "AI" ? "Analog values" : t.ui === "sensor" ? "Sensors + feedback (from the plant – click = force)" : "Operator"); let G = groups.find((x) => x.g === g); if (!G) groups.push(G = { g, tags: [] }); G.tags.push(t); });

  container.classList.add("ld-root");
  container.innerHTML = `
    <div class="ld-bar">
      <button type="button" class="ld-btn ld-run" data-a="run" title="run the PLC (scan cycle)">&#9654; Run</button>
      <button type="button" class="ld-btn" data-a="stop" title="stop the scan">&#9632; Stop</button>
      <button type="button" class="ld-btn" data-a="one" title="one scan only (stopped)">1 scan</button>
      <button type="button" class="ld-btn" data-a="reset" title="all tags to their initial value, timers and counters to 0">Reset</button>
      <span class="ld-seg" role="group" aria-label="view">
        <button type="button" class="ld-btn" data-v="delta">Delta</button><button type="button" class="ld-btn" data-v="siemens">Siemens</button><button type="button" class="ld-btn" data-v="both">Both</button>
      </span>
      <label class="ld-lbl">speed <select data-a="speed"><option value="1">1×</option><option value="2">2×</option><option value="5">5×</option><option value="10">10×</option></select></label>
      <span class="ld-stat" data-k="stat"></span>
      <input type="search" class="ld-search" placeholder="search tag / address / text" aria-label="search the program">
    </div>
    ${stepTags.length ? `<div class="ld-steps" data-k="steps">${stepTags.map((t) => `<span class="ld-step" data-step="${esc(t.name)}" title="${esc(t.comment || "")}">${esc(t.stepLabel || t.name)}</span>`).join("")}</div>` : ""}
    <div class="ld-main">
      <div class="ld-side">
        ${groups.map((G) => `<div class="ld-grp"><div class="ld-gh">${esc(G.g)}</div>${G.tags.map((t) => t.dir === "AI"
          ? `<label class="ld-ai" data-tag="${esc(t.name)}" title="${esc(t.comment || "")}"><span>${esc(t.name)} <b data-ai="${esc(t.name)}"></b> ${esc(t.unit || "")}</span><input type="range" min="${t.min ?? 0}" max="${t.max ?? 100}" step="${t.inc || ((t.max ?? 100) - (t.min ?? 0)) / 200}" data-in="${esc(t.name)}"></label>`
          : `<button type="button" class="ld-in" data-in="${esc(t.name)}" data-ui="${esc(t.ui || "switch")}" title="${esc(`${t.comment || ""} · Delta ${t.delta || "–"} · Siemens ${t.siemens || "–"}${t.wire ? " · " + t.wire : ""}`)}"><i></i><span>${esc(t.label || t.name)}</span><em></em></button>`).join("")}</div>`).join("")}
        ${outTags.length ? `<div class="ld-grp"><div class="ld-gh">Outputs</div><div class="ld-outs">${outTags.map((t) => `<span class="ld-out" data-out="${esc(t.name)}" title="${esc(`${t.comment || ""} · Delta ${t.delta || "–"} · Siemens ${t.siemens || "–"}`)}"><i></i>${esc(t.label || t.name)}${t.dir === "AQ" ? ' <b data-aq="' + esc(t.name) + '"></b>' : ""}</span>`).join("")}</div></div>` : ""}
        <div class="ld-chk ${warns.length ? "ld-chk-bad" : ""}" title="${esc(warns.join("\n"))}">Program check: ${warns.length ? warns.length + " warning(s) – " + esc(warns[0]) : "no double coils, addresses OK"}</div>
      </div>
      <div class="ld-nets" style="max-height:${opts.height || 680}px"></div>
    </div>
    ${P.io ? `<details class="ld-det"><summary>I/O and tag table – Delta + Siemens addresses (example – check with your PLC configuration)</summary><div class="table-wrap"><table class="ld-tbl"><thead><tr><th>Tag</th><th>Dir</th><th>Delta (${esc(program.plc?.delta?.cpu || "")})</th><th>Siemens (${esc(program.plc?.siemens?.cpu || "")})</th><th>Comment</th><th>Wiring / device</th><th>Range / preset</th><th>Live</th></tr></thead><tbody>${ioRows(program).map((r) => `<tr data-tag="${esc(r[0])}">${r.map((c, i) => `<td${i === 0 ? ' class="ld-mono"' : i === 2 || i === 3 ? ' class="ld-mono"' : ""}>${esc(c)}</td>`).join("")}<td class="ld-mono" data-live="${esc(r[0])}"></td></tr>`).join("")}</tbody></table></div></details>` : ""}
    ${P.il ? `<details class="ld-det"><summary>Delta instruction list (IL) – generated from the ladder (ISPSoft / WPLSoft mnemonic)</summary><pre class="ld-pre">${esc(ilText(program))}</pre></details>` : ""}
    ${P.scl ? `<details class="ld-det"><summary>Siemens SCL equivalent – the same logic as text (TIA Portal)</summary><pre class="ld-pre">${esc(genSCL(program))}</pre></details>` : ""}`;

  const $q = (s) => container.querySelector(s), $$ = (s) => [...container.querySelectorAll(s)];
  const nets = $q(".ld-nets"), stat = $q('[data-k="stat"]');
  let bindEls = [];
  function renderNets() {
    renderers = []; bindEls = [];
    const views = view === "both" ? ["delta", "siemens"] : [view];
    const R = views.map((v) => makeRenderer(program, E, v));
    let html = "";
    program.networks.forEach((net, ni) => {
      const txt = (net.title + " " + (net.comment || "") + " " + JSON.stringify(net.rungs)).toLowerCase();
      html += `<section class="ld-net" data-net="${ni}" data-txt="${esc(txt)}"><div class="ld-nh"><b>${esc(net.title)}</b>${net.comment ? `<span>${esc(net.comment)}</span>` : ""}</div>`;
      const parts = R.map((r) => r.netHtml(net)), wMin = Math.round(Math.max(...parts.map((p) => p.W)) * 0.85);
      html += `<div class="ld-cols ld-cols${views.length}" style="--ldw:${wMin}px">${views.map((v, i) => `<div class="ld-col" data-r="${i}">${views.length > 1 ? `<div class="ld-ch">${v === "delta" ? `Delta ${esc(program.plc?.delta?.cpu || "")} · ${esc(program.plc?.delta?.sw || "ISPSoft")}` : `Siemens ${esc(program.plc?.siemens?.cpu || "")} · ${esc(program.plc?.siemens?.sw || "TIA Portal")}`}</div>` : ""}${parts[i].html}</div>`).join("")}</div></section>`;
    });
    nets.innerHTML = html;
    R.forEach((r, i) => {
      const els = [...nets.querySelectorAll(`.ld-col[data-r="${i}"] [data-k]`)];
      els.forEach((el) => { const b = r.binds[+el.dataset.k]; if (b) bindEls.push({ el, b, last: undefined }); });
    });
    renderers = R;
    $$("[data-v]").forEach((b) => b.classList.toggle("on", b.dataset.v === view));
    applySearch();
    paint(true);
  }
  function paint(all) {
    for (const x of bindEls) {
      let v; try { v = x.b.f(); } catch (e) { v = x.b.kind === "t" ? "" : false; }
      if (!all && v === x.last) continue;
      x.last = v;
      if (x.b.kind === "t") x.el.textContent = v;
      else x.el.classList.toggle("ld-on", !!v);
    }
    $$("[data-in]").forEach((el) => {
      const n = el.dataset.in, t = E.tags.get(n), f = E.forces.has(n);
      if (el.tagName === "INPUT") { if (document.activeElement !== el) el.value = E.num(n); const b = container.querySelector(`[data-ai="${n}"]`); if (b) b.textContent = fmt(E.num(n), t); el.closest(".ld-ai").classList.toggle("ld-forced", f); }
      else { el.classList.toggle("ld-on", E.bit(n)); el.classList.toggle("ld-forced", f); el.querySelector("em").textContent = f ? "F" : ""; }
    });
    $$("[data-out]").forEach((el) => { el.classList.toggle("ld-on", E.bit(el.dataset.out)); const b = el.querySelector("b"); if (b) b.textContent = fmt(E.num(el.dataset.out), E.tags.get(el.dataset.out)); });
    $$("[data-step]").forEach((el) => el.classList.toggle("ld-on", E.bit(el.dataset.step)));
    $$("[data-live]").forEach((el) => { const n = el.dataset.live, t = E.tags.get(n), v = E.state[n]; el.textContent = !t ? "" : t.sys ? (E.bit(n) ? "1" : "0") : v && typeof v === "object" ? (t.dir === "T" ? `${v.Q ? 1 : 0} · ${v.ET.toFixed(1)} s` : `${v.Q ? 1 : 0} · ${v.CV}`) : fmt(v, t); el.classList.toggle("ld-livebit", E.bit(n) && (t.type === "BOOL" || /^(I|Q|M)$/.test(t.dir))); });
    stat.textContent = `${running ? "RUN" : "STOP"} · scan ${program.scanMs || 20} ms · t = ${E.time.toFixed(1)} s · ${E.scans} scans · logic ${E.execUs.toFixed(0)} µs`;
    stat.classList.toggle("ld-runs", running);
  }
  const fmt = (v, t) => typeof v === "boolean" ? (v ? "1" : "0") : v === undefined ? "" : t && t.type === "REAL" ? (+v).toFixed(Math.abs(v) < 10 ? 2 : 1) : String(Math.round(+v));
  function applySearch() {
    const q = ($q(".ld-search").value || "").trim().toLowerCase();
    $$(".ld-net").forEach((s) => { s.hidden = !!q && !s.dataset.txt.includes(q) && !addrHit(s, q); });
    $$(".ld-el").forEach((g) => g.classList.toggle("ld-hit", !!q && (g.dataset.tag || "").toLowerCase().includes(q)));
  }
  function addrHit(sec, q) { return [...sec.querySelectorAll(".ld-addr")].some((t) => t.textContent.toLowerCase().includes(q)); }

  /* input panel */
  $$("button[data-in]").forEach((el) => {
    const n = el.dataset.in, t = E.tags.get(n), ui = el.dataset.ui;
    if (ui === "push") {
      const on = () => { E.set(n, !t.init); paint(); }, off = () => { E.set(n, !!t.init); paint(); };
      el.addEventListener("pointerdown", (e) => { e.preventDefault(); el.setPointerCapture && el.setPointerCapture(e.pointerId); on(); });
      el.addEventListener("pointerup", off); el.addEventListener("pointercancel", off);
      el.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); on(); } });
      el.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") off(); });
    } else if (ui === "sensor") {
      el.addEventListener("click", () => { if (E.forces.has(n)) E.force(n, null); else E.force(n, !E.bit(n)); paint(); });
    } else el.addEventListener("click", () => { if (E.forces.has(n)) E.force(n, null); E.set(n, !E.bit(n)); paint(); });
  });
  $$("input[data-in]").forEach((el) => {
    const n = el.dataset.in, t = E.tags.get(n);
    el.addEventListener("input", () => { if (t.ui === "sensor") E.force(n, +el.value); else E.set(n, +el.value); paint(); });
    el.addEventListener("dblclick", () => { E.force(n, null); paint(); });
  });
  /* bar */
  container.querySelector(".ld-bar").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.v) { setView(b.dataset.v); return; }
    const a = b.dataset.a;
    if (a === "run") start(); else if (a === "stop") stop(); else if (a === "one") { stop(); E.scan(); paint(); } else if (a === "reset") reset();
  });
  $q('[data-a="speed"]').value = String(speed);
  $q('[data-a="speed"]').addEventListener("change", (e) => { speed = +e.target.value || 1; });
  $q(".ld-search").addEventListener("input", applySearch);

  function tick() {
    if (destroyed) return;
    if (!container.isConnected) { destroy(); return; }
    const now = performance.now();
    if (container.offsetParent === null || document.hidden) { last = now; return; }   // paused while hidden
    if (running) {
      acc += Math.min(250, now - last) * speed; last = now;
      const ms = program.scanMs || 20; let n = 0;
      while (acc >= ms && n < 400) { E.scan(); acc -= ms; n++; }
      if (n >= 400) acc = 0;
    } else last = now;
    paint(false);
  }
  function start() { running = true; last = performance.now(); $$(".ld-run").forEach((b) => b.classList.add("on")); paint(); }
  function stop() { running = false; $$(".ld-run").forEach((b) => b.classList.remove("on")); paint(); }
  function reset() { E.reset(); acc = 0; paint(true); if (opts.onReset) opts.onReset(E); }
  function setView(v) { if (!["delta", "siemens", "both"].includes(v)) return; view = v; renderNets(); }
  function destroy() { destroyed = true; clearInterval(timer); }
  renderNets();
  timer = setInterval(tick, 50);
  if (opts.autoStart !== false) start();
  const ctl = {
    engine: E, state: E.state, program,
    setInput: (tag, v) => { E.set(tag, v); paint(); },
    force: (tag, v) => { E.force(tag, v); paint(); },
    get: (tag) => { const t = E.tags.get(baseName(tag)); if (!t) return undefined; const v = E.raw(tag); return v && typeof v === "object" ? (tag.includes(".") ? v : v.Q) : v; },
    start, stop, reset, setView, destroy, scan: (n = 1) => { for (let i = 0; i < n; i++) E.scan(); paint(); },
    running: () => running, view: () => view, paint: () => paint(true), warnings: warns,
  };
  return ctl;
}

/* ======================================================================= self-test (&ladtest) */
export function selfTest(log = (s) => console.log(s)) {
  let bad = 0;
  const ok = (cond, msg) => { if (!cond) bad++; log(`LADTEST ${cond ? "ok  " : "FAIL"} ${msg}`); };
  const prog = {
    id: "t", title: "self-test", scanMs: 20,
    tags: [
      { name: "A", dir: "I", type: "BOOL", delta: "X0.0", siemens: "%I0.0" }, { name: "B", dir: "I", type: "BOOL", delta: "X0.1", siemens: "%I0.1" },
      { name: "C", dir: "I", type: "BOOL", delta: "X0.2", siemens: "%I0.2" }, { name: "STOP", dir: "I", type: "BOOL", delta: "X0.3", siemens: "%I0.3", init: true },
      { name: "Y1", dir: "Q", type: "BOOL", delta: "Y0.0", siemens: "%Q0.0" }, { name: "RUN", dir: "Q", type: "BOOL", delta: "Y0.1", siemens: "%Q0.1" },
      { name: "TD", dir: "Q", type: "BOOL", delta: "Y0.2", siemens: "%Q0.2" }, { name: "PUL", dir: "M", type: "BOOL", delta: "M1", siemens: "%M10.1" },
      { name: "NPUL", dir: "M", type: "BOOL", delta: "M2", siemens: "%M10.2" }, { name: "NC", dir: "M", type: "BOOL", delta: "M3", siemens: "%M10.3" },
      { name: "HI", dir: "M", type: "BOOL", delta: "M4", siemens: "%M10.4" }, { name: "P", dir: "AI", type: "REAL", delta: "D100", siemens: "%IW64", min: 0, max: 16 },
      { name: "N", dir: "W", type: "INT", delta: "D10", siemens: '"DB".N' }, { name: "R", dir: "W", type: "REAL", delta: "D20", siemens: '"DB".R' },
      { name: "T1", dir: "T", delta: "T0", siemens: '"DB_T1" (TON)', pt: 2.0 }, { name: "T2", dir: "T", delta: "T1", siemens: '"DB_T2" (TOF)', pt: 1.0 },
      { name: "T3", dir: "T", delta: "T2", siemens: '"DB_T3" (TP)', pt: 0.5 }, { name: "C1", dir: "C", delta: "C0", siemens: '"DB_C1" (CTU)', pv: 3 },
      { name: "TPQ", dir: "M", type: "BOOL", delta: "M5", siemens: "%M10.5" }, { name: "TOFQ", dir: "M", type: "BOOL", delta: "M6", siemens: "%M10.6" },
    ],
    networks: [
      { title: "N1 tree", rungs: [{ in: { s: [{ p: [{ c: "NO", t: "A" }, { c: "NO", t: "B" }] }, { c: "NC", t: "C" }] }, out: [{ o: "OUT", t: "Y1" }] }] },
      { title: "N2 seal-in", rungs: [{ in: { s: [{ p: [{ c: "NO", t: "A" }, { c: "NO", t: "RUN" }] }, { c: "NO", t: "STOP" }] }, out: [{ o: "OUT", t: "RUN" }] }] },
      { title: "N3 timer", rungs: [{ in: { s: [{ c: "NO", t: "RUN" }, { b: "TON", t: "T1" }] }, out: [{ o: "OUT", t: "TD" }] }] },
      { title: "N4 edges", rungs: [{ in: { c: "P", t: "B" }, out: [{ o: "OUT", t: "PUL" }] }, { in: { c: "N", t: "B" }, out: [{ o: "OUT", t: "NPUL" }] }] },
      { title: "N5 counter", rungs: [{ in: { s: [{ c: "NO", t: "B" }, { b: "CTU", t: "C1", r: "C" }] }, out: [{ o: "NOT", t: "NC" }] }] },
      { title: "N6 compare + calc", rungs: [{ in: { cmp: ">=", a: "P", b: 10.7 }, out: [{ o: "OUT", t: "HI" }, { calc: "P*10+2", to: "R" }, { mov: 7, to: "N" }] }] },
      { title: "N7 TOF + TP", rungs: [{ in: { s: [{ c: "NO", t: "A" }, { b: "TOF", t: "T2" }] }, out: [{ o: "OUT", t: "TOFQ" }] }, { in: { s: [{ c: "NO", t: "C" }, { b: "TP", t: "T3" }] }, out: [{ o: "OUT", t: "TPQ" }] }] },
    ],
  };
  const E = createEngine(prog);
  E.scan(); ok(!E.bit("Y1"), "tree (A OR B) AND NOT C = 0 with all inputs 0");
  E.set("B", true); E.scan(); ok(E.bit("Y1"), "tree = 1 with B = 1");
  E.set("C", true); E.scan(); ok(!E.bit("Y1"), "tree = 0 with C = 1 (NC contact opens)");
  E.set("B", false); E.set("C", false); E.scan();
  E.set("A", true); E.scan(); E.set("A", false); E.scan(); ok(E.bit("RUN"), "seal-in: RUN stays 1 after the start pulse");
  let n = 0; while (!E.bit("TD") && n < 500) { E.scan(); n++; }
  const tOn = (n + 1) * E.dt;
  ok(Math.abs(tOn - 2.0) <= E.dt + 1e-9, `TON 2.0 s: output after ${tOn.toFixed(2)} s (± 1 scan = ${E.dt * 1000} ms)`);
  E.set("STOP", false); E.scan(); E.set("STOP", true); E.scan(); ok(!E.bit("RUN") && !E.bit("TD") && E.state.T1.ET === 0, "stop opens the seal-in, timer resets (ET = 0)");
  E.set("B", true); E.scan(); const p1 = E.bit("PUL"); E.scan(); const p2 = E.bit("PUL"); ok(p1 && !p2, "rising edge P = 1 for exactly one scan");
  E.set("B", false); E.scan(); const n1 = E.bit("NPUL"); E.scan(); ok(n1 && !E.bit("NPUL"), "falling edge N = 1 for exactly one scan");
  E.set("C", true); E.scan(); E.set("C", false); E.scan();
  for (let i = 0; i < 3; i++) { E.set("B", true); E.scan(); E.set("B", false); E.scan(); }
  ok(E.state.C1.CV === 3 && E.state.C1.Q && !E.bit("NC"), `CTU counts 3 rising edges → CV = ${E.state.C1.CV}, Q = 1 (NOT coil = 0)`);
  E.set("C", true); E.scan(); ok(E.state.C1.CV === 0, "counter reset input R → CV = 0");
  E.set("C", false); E.set("P", 10.69); E.scan(); ok(!E.bit("HI"), "compare 10.69 >= 10.7 = 0");
  E.set("P", 10.7); E.scan(); ok(E.bit("HI") && Math.abs(E.num("R") - 109) < 1e-9 && E.num("N") === 7, `compare 10.7 >= 10.7 = 1, calc P*10+2 = ${E.num("R")}, MOV 7 → N = ${E.num("N")}`);
  E.set("A", true); E.scan(); E.set("A", false); let k = 0; while (E.bit("TOFQ") && k < 200) { E.scan(); k++; } ok(Math.abs((k - 1) * E.dt - 1.0) <= E.dt + 1e-9, `TOF 1.0 s: output off ${((k - 1) * E.dt).toFixed(2)} s after the input goes 0`);
  E.set("C", true); let m = 0; E.scan(); while (E.bit("TPQ") && m < 200) { E.scan(); m++; } ok(Math.abs(m * E.dt - 0.5) <= E.dt + 1e-9, `TP 0.5 s: pulse ${(m * E.dt).toFixed(2)} s long while the input stays 1`);
  const il = ilText(prog);
  ok(/LD\s+X0\.0[\s\S]*OR\s+X0\.1[\s\S]*ANI\s+X0\.2[\s\S]*OUT\s+Y0\.0/.test(il), "IL network 1: LD X0.0 / OR X0.1 / ANI X0.2 / OUT Y0.0");
  ok(/LD\s+Y0\.1[\s\S]*TMR\s+T0 K20[\s\S]*LD\s+T0[\s\S]*OUT\s+Y0\.2/.test(il), "IL network 3: LD Y0.1 / TMR T0 K20 / LD T0 / OUT Y0.2");
  ok(/CNT\s+C0 K3[\s\S]*LD\s+X0\.2\s+\/\/ C[\s\S]*RST\s+C0/.test(il), "IL network 5: CNT C0 K3 + LD X0.2 / RST C0");
  ok(/FLD>=\s+D100 F10\.7/.test(il) && /LDP\s+X0\.1/.test(il) && /LDF\s+X0\.1/.test(il), "IL: FLD>= D100 F10.7, LDP / LDF edges");
  const scl = genSCL(prog);
  ok(/"Y1" := \("A" OR "B"\) AND NOT "C";/.test(scl) && /"DB_T1"\.TON\(IN := "RUN", PT := T#2S\);/.test(scl), 'SCL: "Y1" := ("A" OR "B") AND NOT "C"; "DB_T1".TON(IN := "RUN", PT := T#2S);');
  const pE = { tags: [{ name: "A", dir: "I" }, { name: "B", dir: "I" }, { name: "Y", dir: "Q" }, { name: "Z", dir: "Q" }, { name: "R", dir: "AI", type: "REAL", delta: "D100" }],
    networks: [{ title: "e", rungs: [{ in: { c: "P", t: "A" }, out: [{ o: "OUT", t: "Y" }] }, { in: { s: [{ c: "P", t: "B" }, { cmp: "<", a: "R", b: 10 }] }, out: [{ o: "OUT", t: "Z" }] }] }] };
  const scl2 = genSCL(pE), il2 = ilText(pE);
  const edges = new Set((scl2.match(/"EdgeMem"\.M\d+ :=/g) || []));
  ok(edges.size === 2 && !/EdgeMem"\.M0\b/.test(scl2) && /FAND<\s+D100 F10/.test(il2), `fresh program (never run): own edge memory per P contact (${[...edges].join(" ")}), float compare uses F10`);
  const w = checkProgram({ tags: [{ name: "X", dir: "I", delta: "X8", siemens: "%I0.8" }, { name: "Y", dir: "Q", delta: "Y0.0", siemens: "%Q0.0" }], networks: [{ title: "a", rungs: [{ in: { c: "NO", t: "X" }, out: [{ o: "OUT", t: "Y" }] }, { in: { c: "NC", t: "X" }, out: [{ o: "OUT", t: "Y" }] }] }] });
  ok(w.length === 3, `program check finds double coil + %I0.8 + octal X8 (${w.length} warnings)`);
  ok(Math.abs(scaleLin(13824, 0, 27648, 0, 16) - 8) < 1e-9 && scaleLin(40000, 0, 27648, 0, 16, true) === 16, "scaleLin 13824 of 27648 → 8.0 MPa, clamp → 16");
  log(`LADTEST DONE errors=${bad}`);
  return bad;
}
if (Q.has("ladtest")) setTimeout(() => { try { selfTest(); } catch (e) { console.error("LADTEST exception " + e.message); } }, 200);
