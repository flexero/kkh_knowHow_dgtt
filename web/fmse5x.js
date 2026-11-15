/* FMS engineering – item 5, deep sections 5F–5M (loaded by fmse5.js at the end of item 5).
 * 5F ISA-95 operations model (MOM activity grid, object models, B2M verbs + B2MML-style message builder)
 * 5G naming & IEC 81346 (tag validator, data-block tag list, reference designation builder)
 * 5H PackML in depth (scenario runner, transition table, module meanings, PackTags, state → OEE loss, ST skeleton)
 * 5I ISA-88 procedural model and recipes for discrete manufacturing
 * 5J cell-controller logic simulation (rules of EX5.cell_sim._rules, animation, Gantt, log, KPIs)
 * 5K architecture availability (series / parallel blocks, MES job buffer)   5L alarm management (ISA-18.2 KPIs, ISA-101)
 * 5M robustness patterns (time-outs, idempotency, store-and-forward, heartbeat, restart, deadlock, message catalogue).
 * Example numbers: EX5 in fmse5x_data.js = copy of tools/fmse/examples/item5_examples.json (same rules as guide docs/65 and tools/fmse/*.py).
 * PackML rules reuse nextState() of fmse5.js (5C). Offline; user edits in localStorage keys "fmse.5x.*". Test hook: window.fe5x.results(). */
import { EX5, MOM_CAT, MOM_ACT, MOM_GRID, OBJ_MODELS, B2M_VERBS, IEC_CODES, MOD_TYPES, MOD_MEANING, PACKTAGS, STATE_OEE, ST_SKELETON,
  S88_FMS, S88_ASM, RECIPES, RECIPE_MAP, ALARM_LIFE, CONSEQ, TRESP, PRIO_M, RAT_HEAD, RAT_ROWS, ISA101, RESTART, MSG_HEAD, MSG_ROWS, USES5 } from "./fmse5x_data.js";
import { STATES, CMDS, EDGES, MODES } from "./fmse5_data.js";
import { BLOCK, EXTRA } from "./fmse6_data.js";
import { nextState } from "./fmse5.js";

/* ------------------------------------------------------------------ helpers */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fx = (x, d = 1) => (Number.isFinite(x) ? x.toLocaleString("en", { maximumFractionDigits: d, minimumFractionDigits: d }) : "–");
const rnd = (x, d = 6) => (Number.isFinite(x) ? +x.toFixed(d) : null);
const clone = (o) => JSON.parse(JSON.stringify(o));
const num = (v, d = 0) => { const x = parseFloat(v); return Number.isFinite(x) ? x : d; };
const store = {   // own keys "fmse.5x.<k>"
  get(k, d) { try { const v = localStorage.getItem("fmse.5x." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("fmse.5x." + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  del(k) { try { localStorage.removeItem("fmse.5x." + k); } catch (e) { /* storage blocked */ } },
};
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const csvCell = (v) => { const s = String(v == null ? "" : v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const toCSV = (rows) => rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
const ul = (a) => `<ul class="am-ul">${a.map((x) => `<li>${x}</li>`).join("")}</ul>`;   // items are trusted HTML written in this file
const ok = (b, y, n) => (b ? `<span class="fe-ok">✓ ${y}</span>` : `<span class="fe-no">✗ ${n}</span>`);
const wx = (title, steps) => `<details class="fx-more f5-wx"><summary><b>Worked example</b> – ${title}</summary><ol class="fx-steps">${steps.map((s) => `<li>${s}</li>`).join("")}</ol></details>`;
const card = (id, title, sub, body) => `<div class="card" id="${id}"><div class="card-head"><h2>${title}</h2><span class="sub">${sub}</span></div>${body}</div>`;
const tab = (head, rows, cls = "") => `<div class="fe-scroll"><table class="am-tab ${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
const kv = (rows) => `<table class="am-kv f5-kv"><tbody>${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join("")}</tbody></table>`;
const kpis = (a) => `<div class="phd-kpis">${a.map(([n, v, c]) => `<div class="phd-kpi"><b class="${c || ""}">${v}</b><span>${n}</span></div>`).join("")}</div>`;
const live = (el) => !!el && document.body.contains(el) && el.offsetParent !== null && !document.hidden;   // animation only while visible

function guide({ principle, uses, howto }) {
  return `<div class="fx-guide">
    <div class="fx-prin"><h3 class="fe-h3">Principle</h3>${principle}</div>
    <details class="fx-more"><summary><b>Use cases</b> <span class="sub">different domains</span></summary>
      <div class="fx-uses">${uses.map(([d, t]) => `<div class="fx-use"><b>${esc(d)}</b><p>${esc(t)}</p></div>`).join("")}</div></details>
    <details class="fx-more"><summary><b>How to use it in a real project</b></summary>${ul(howto)}</details></div>`;
}

/* small SVG chart: lines / dots / bars on x-y axes */
function chart(svg, { series, xmin, xmax, ymin = 0, ymax, xl, yl, hmarks = [], W = 680, H = 300, xfmt, yfmt, bw: bwFix }) {
  const x0 = 58, x1 = W - 14, y0 = H - 40, y1 = 12;
  const X = (v) => x0 + (v - xmin) / (xmax - xmin || 1) * (x1 - x0);
  const Y = (v) => y0 - (Math.min(Math.max(v, ymin), ymax) - ymin) / (ymax - ymin || 1) * (y0 - y1);
  const ticks = (lo, hi) => { const raw = (hi - lo) / 6, p = 10 ** Math.floor(Math.log10(raw || 1)), st = [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) || p; const a = []; for (let v = Math.ceil(lo / st - 1e-9) * st; v <= hi + 1e-9; v += st) a.push(+v.toFixed(10)); return a; };
  const f0 = (v) => fx(v, Math.abs(v) < 10 && v % 1 ? 1 : 0);
  let s = "";
  ticks(ymin, ymax).forEach((v) => { const y = Y(v); s += `<line class="fe-grid" x1="${x0}" x2="${x1}" y1="${y}" y2="${y}"/><text class="fe-tick" x="${x0 - 6}" y="${y + 4}" text-anchor="end">${(yfmt || f0)(v)}</text>`; });
  ticks(xmin, xmax).forEach((v) => { const x = X(v); s += `<line class="fe-grid" x1="${x}" x2="${x}" y1="${y1}" y2="${y0}"/><text class="fe-tick" x="${x}" y="${y0 + 15}" text-anchor="middle">${(xfmt || f0)(v)}</text>`; });
  hmarks.forEach(([v, cls, lab]) => { const y = Y(v); s += `<line class="${cls}" x1="${x0}" x2="${x1}" y1="${y}" y2="${y}"/>${lab ? `<text class="fe-tick" x="${x1 - 4}" y="${y - 5}" text-anchor="end">${esc(lab)}</text>` : ""}`; });
  series.forEach((sr) => {
    if (sr.bars) { const bw = bwFix || (x1 - x0) / (xmax - xmin + 1) * 0.75; sr.pts.forEach(([a, b], i) => { s += `<rect class="f5-bar ${sr.cls}${sr.hi && sr.hi(i) ? " f5-barhi" : ""}" x="${(X(a) - bw / 2 + (sr.dx || 0)).toFixed(1)}" y="${Y(b).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, Y(ymin) - Y(b)).toFixed(1)}"><title>${esc(sr.n || "")} ${fx(a, 0)}: ${fx(b, 2)}</title></rect>`; }); return; }
    const pts = sr.pts.map(([a, b]) => [X(a), Y(b)]);
    if (!sr.noline && pts.length > 1) s += `<polyline class="f5-ln ${sr.cls}" points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ")}"/>`;
    if (sr.dots) pts.forEach(([a, b]) => { s += `<circle class="f5-dot ${sr.cls}" cx="${a.toFixed(1)}" cy="${b.toFixed(1)}" r="3.4"/>`; });
  });
  s += `<text class="fe-axis" x="${(x0 + x1) / 2}" y="${H - 6}" text-anchor="middle">${esc(xl)}</text><text class="fe-axis" transform="translate(12 ${(y0 + y1) / 2}) rotate(-90)" text-anchor="middle">${esc(yl)}</text>`;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.innerHTML = s;
  return series.filter((sr) => sr.n).map((sr) => `<span class="fx-lg"><i class="f5-lg ${sr.cls}"></i>${esc(sr.n)}</span>`).join(" ");
}

/* ================================================================== pure functions (exactly as EX5._formulas) – used by programs AND results() */
// PackML: one command against (state, mode). Same rules as 5C (nextState of fmse5.js) + mode filter + SC only where an SC edge exists.
const WAIT_MODE_OK = ["Stopped", "Idle", "Aborted"];
function packStep(st, mode, cmd) {
  if (/^Mode:/i.test(cmd)) {
    const m = Object.keys(MODES).find((k) => k.toLowerCase() === cmd.slice(5).trim().toLowerCase());
    if (!m) return { st, mode, ok: false, why: "unknown mode" };
    return WAIT_MODE_OK.includes(st) ? { st, mode: m, ok: true, why: `mode → ${m}` } : { st, mode, ok: false, why: "mode change only in Stopped, Idle or Aborted" };
  }
  if (cmd === "SC") {
    const e = EDGES.find(([a, , c]) => a === st && c === "SC");
    return e ? { st: e[1], mode, ok: true, why: "state complete" } : { st, mode, ok: false, why: `${st} is a wait state – SC not possible, it needs a command` };
  }
  if (!(cmd in CMDS)) return { st, mode, ok: false, why: "unknown command" };
  if (!MODES[mode].includes(cmd)) return { st, mode, ok: false, why: `${cmd} not allowed in ${mode} mode` };
  const n = nextState(st, cmd);
  return n ? { st: n, mode, ok: true, why: cmd === "Stop" || cmd === "Abort" ? `${cmd} is allowed from (almost) every state` : "transition in the state model" } : { st, mode, ok: false, why: `${cmd} not allowed in state ${st}` };
}
function packRun(mode, cmds, start = "Stopped") {
  let st = start, md = mode; const trace = [];
  cmds.forEach((c, i) => { const r = packStep(st, md, c); trace.push({ i: i + 1, cmd: c, before: st, after: r.st, mode: r.mode, ok: r.ok, why: r.why }); st = r.st; md = r.mode; });
  return { trace, end: st, mode: md, rejected: trace.filter((r) => !r.ok).map((r) => r.cmd) };
}

// naming
function negWord(sig, words) { return [...words].sort((a, b) => b.length - a.length).find((w) => sig.startsWith(w) && (sig.length === w.length || /[A-Z]/.test(sig[w.length]))) || null; }
function checkTags(list, N = EX5.naming) {   // same checks, order and reasons as tools/fmse/tag_namer.py
  const PART = /^[A-Za-z0-9]+$/, SIG = /^[A-Za-z0-9]+(_[A-Za-z0-9]+)?$/, UNIT = /^[A-Za-z]+[0-9]{2}$/, seen = new Set();
  return list.map((tag) => {
    const why = [], p = tag.split("."), kind = [];
    const add = (k, r) => { kind.push(k); why.push(r); };
    if (p.length !== 6) add("parts", `${p.length} parts, need exactly 6 (site.area.cell.unit.equipment.signal)`);
    const bad = p.filter((x, k) => !((k === p.length - 1 && p.length === 6) ? SIG : PART).test(x));
    if (bad.length) add("bad characters", `bad characters in ${bad.map((x) => "“" + x + "”").join(", ")} (only A–Z a–z 0–9; signal: one '_' + unit suffix allowed)`);
    if (p.length >= 4 && !UNIT.test(p[3])) add("unit number format", `unit “${p[3]}” must be unit code + 2-digit number (e.g. MC02)`);
    if (tag.length > N.max_len) add("length", `${tag.length} characters > ${N.max_len}`);
    if (p.length === 6) { const w = negWord(p[5], N.negative_words); if (w) add("negative word", `signal “${p[5]}” starts with “${w}” – name the positive state`); }
    if (seen.has(tag)) add("duplicate", "same tag already in the list"); seen.add(tag);
    return { tag, ok: !why.length, why, kind };
  });
}
function dbTags(N = EX5.naming) {   // 6-part tags site.area.cell.unit.group.item (group = equipment part)
  const rows = [];
  N.units.forEach(([mod, code, n]) => {
    for (let k = 1; k <= n; k++) {
      const u = code + String(k).padStart(2, "0"), pre = [N.site, N.area, N.cell, u].join(".");
      BLOCK.forEach((b) => rows.push({ tag: pre + "." + b[1], unit: u, mod, off: b[0], type: b[2], dir: b[3], mean: b[4], part: "standard" }));
      (EXTRA[mod] || []).forEach((b) => rows.push({ tag: pre + "." + b[1], unit: u, mod, off: b[0], type: b[2], dir: b[3], mean: b[4], part: "module" }));
    }
  });
  return rows;
}

// availability
const aOf = (mtbf, mttr) => mtbf / (mtbf + mttr);
function availVariant(chain, comps, hy) {
  const blocks = chain.map(([name, n]) => { const c = comps.find((x) => x[0] === name) || [name, 1, 0]; const a = aOf(c[1], c[2]); return { name, n, a, ab: 1 - (1 - a) ** n }; });
  const A = blocks.reduce((p, b) => p * b.ab, 1);
  return { blocks, A, down: (1 - A) * hy };
}
function mesLoss(comps, hy, b) { const c = comps.find((x) => x[0] === "MES server"); const f = hy / (c[1] + c[2]), p = Math.exp(-b / c[2]); return { b, f, mttr: c[2], p, loss: f * c[2] * p }; }

// alarms
function alarmKPI(L) {
  const nW = Math.ceil(L.shift_s / 600), win = Array(nW).fill(0);
  L.alarms.forEach(([t]) => { const w = Math.floor(t / 600); if (w >= 0 && w < nW) win[w]++; });
  const n = L.alarms.length, hours = L.shift_s / 3600, avg = n / hours / L.operators, peak = Math.max(0, ...win), peakW = win.indexOf(peak);
  const flood = win.filter((x) => x > 10).length, prio = { 1: 0, 2: 0, 3: 0 };
  L.alarms.forEach((a) => { prio[a[2]] = (prio[a[2]] || 0) + 1; });
  const byTag = new Map(); L.alarms.forEach(([t, tag]) => { if (!byTag.has(tag)) byTag.set(tag, []); byTag.get(tag).push(t); });
  const chatter = []; byTag.forEach((ts, tag) => { const s = [...ts].sort((a, b) => a - b); for (let i = 0; i + 2 < s.length; i++) if (s[i + 2] - s[i] <= 60) { chatter.push(tag); break; } });
  const top5 = [...byTag.entries()].map(([tag, ts], i) => ({ tag, n: ts.length, i })).sort((a, b) => b.n - a.n || a.i - b.i).slice(0, 5).map(({ tag, n: c }) => ({ tag, n: c, share: c / n }));
  const share = { high: prio[1] / n, medium: prio[2] / n, low: prio[3] / n };
  return { n, hours, nW, win, avg, peak, peakW, flood, floodPct: flood / nW * 100, prio, share, chatter, top5,
    verdictAvg: avg <= 6 ? "acceptable" : avg <= 12 ? "manageable" : "overloaded", verdictPeak: peak > 10 ? "flood" : "no flood" };
}

// cell-controller simulation – EX5.cell_sim._rules step by step (returns log, KPIs and a snapshot per minute)
function cellSim(cs, events, opt = {}) {
  const T = cs.T, LM = cs.load_min, MV = cs.move_min, BM = opt.buffer != null ? opt.buffer : cs.job_buffer_max;
  const jt = Object.fromEntries(cs.jobs.map((j) => [j[0], j[2]])), prog = Object.fromEntries(cs.jobs.map((j) => [j[0], j[1]]));
  const mes = cs.jobs.map((j) => j[0]), ms = cs.machines;
  const M = Object.fromEntries(ms.map((m) => [m, { st: "Idle", end: null, res: false, flt: false, rem: null, pal: null, ex: 0, held: 0 }]));
  const q = [...cs.pallets], pjob = {}, ready = [], reqs = [], buf = [], out = [], log = [], snaps = [];
  let ls = null, veh = null, up = true, maxout = 0, starved = 0, started = 0, done = 0, sent = 0, mvn = 0;
  const ev = events.map((e, i) => [e, i]).sort((a, b) => a[0][0] - b[0][0] || a[1] - b[1]).map((x) => x[0]);
  const L = (t, s) => log.push(`${t} ${s}`);
  for (let t = 0; t <= T; t++) {
    // 1 external events
    ev.forEach(([et, k, o]) => {
      if (et !== t) return;
      if (k === "FAULT" && M[o]) { const m = M[o]; m.flt = true; if (m.st === "Execute") { m.rem = m.end - t; m.end = null; m.st = "Held"; } L(t, `FAULT ${o} ${m.st}`); }
      else if (k === "REPAIRED" && M[o]) { const m = M[o]; m.flt = false; if (m.rem != null) { m.end = t + m.rem; m.rem = null; m.st = "Execute"; } L(t, `REPAIRED ${o} ${m.st}`); }
      else if (k === "MES_DOWN") { up = false; L(t, "MES_DOWN"); }
      else if (k === "MES_UP") { up = true; L(t, "MES_UP"); }
    });
    // 2 completions: vehicle, machines by index, load station
    if (veh && veh.end === t) {
      const { p, to } = veh; veh = null;
      if (to === "LS") { q.push(p); out.push(pjob[p]); L(t, `ARRIVE_LS ${p} ${pjob[p]}`); }
      else {   // a vehicle arriving at a faulted machine starts it in Held with the full machining time remaining
        const m = M[to]; m.pal = p; started++;
        if (m.flt) { m.st = "Held"; m.rem = jt[pjob[p]]; m.end = null; } else { m.st = "Execute"; m.end = t + jt[pjob[p]]; }
        L(t, `START ${to} ${p} ${pjob[p]}`);
      }
    }
    ms.forEach((mn) => { const m = M[mn]; if (m.st === "Execute" && m.end === t) { m.st = "Complete"; m.end = null; done++; L(t, `DONE ${mn} ${m.pal} ${pjob[m.pal]}`); reqs.push({ p: m.pal, f: mn, to: "LS" }); } });
    if (ls && ls.end === t) { const p = ls.p; ls = null; ready.push(p); L(t, `LOADED ${p} ${pjob[p]}`); }
    maxout = Math.max(maxout, out.length);   // max outbox: measured after step 2, before sending
    // 3 MES link
    if (up) {
      while (out.length) { const j = out.shift(); sent++; L(t, `SEND_CONF ${j}`); }
      if (buf.length < BM && mes.length) { const j = mes.shift(); buf.push(j); L(t, `JOB ${j}`); }
    }
    // 4 decisions
    if (!ls && q.length && buf.length) { const p = q.shift(), j = buf.shift(); pjob[p] = j; ls = { p, start: t, end: t + LM }; L(t, `LOAD ${p} ${j}`); }
    else if (!ls && q.length && !buf.length && mes.length) starved++;
    [...ready].forEach((p) => {
      const c = ms.find((mn) => M[mn].st === "Idle" && !M[mn].res && !M[mn].flt);
      if (c) { M[c].res = true; ready.splice(ready.indexOf(p), 1); reqs.push({ p, f: "LS", to: c }); L(t, `ROUTE ${p} ${c}`); }
    });
    if (!veh && reqs.length) {
      const r = reqs.shift(); veh = { ...r, start: t, end: t + MV, id: ++mvn };
      if (r.f !== "LS") { const m = M[r.f]; m.st = "Idle"; m.res = false; m.pal = null; }
      L(t, `MOVE ${r.p} ${r.f}->${r.to}`);
    }
    ms.forEach((mn) => { if (M[mn].st === "Execute") M[mn].ex++; if (M[mn].st === "Held") M[mn].held++; });
    snaps.push({ t, m: ms.map((mn) => ({ n: mn, st: M[mn].st, pal: M[mn].pal, job: M[mn].pal ? pjob[M[mn].pal] : null, end: M[mn].end, rem: M[mn].rem, flt: M[mn].flt, res: M[mn].res })),
      ls: ls ? { ...ls, job: pjob[ls.p] } : null, q: [...q], ready: [...ready], veh: veh ? { ...veh } : null, buf: [...buf], out: [...out], up, mesLeft: mes.length, nlog: log.length, starved });
  }
  const K = { started, done, sent, outbox: out.length, maxout, starved, ex: Object.fromEntries(ms.map((m) => [m, M[m].ex])), held: Object.fromEntries(ms.map((m) => [m, M[m].held])) };
  return { K, log, snaps, prog, jt, T };
}

// deadlock in a pallet system: breadth-first search over all reachable states (exhaustive – a proof, not a random test)
// state: [store, LS (0/1 loaded pallet waiting to leave), pool fresh, machines occupied, pool finished]
function deadlockBFS(N, P, M, rule) {
  const key = (s) => s.join(","), s0 = [N, 0, 0, 0, 0], prev = new Map([[key(s0), null]]);
  let fr = [s0]; const dead = [];
  while (fr.length) {
    const nf = [];
    fr.forEach((s) => {
      const [st, ls, pf, m, pd] = s, free = P - pf - pd, inLoop = ls + pf + m + pd, nx = [];
      if (st && !ls && (!rule || inLoop + 1 <= P + M)) nx.push([[st - 1, 1, pf, m, pd], "new pallet enters the load station"]);
      if (ls && m < M) nx.push([[st, 0, pf, m + 1, pd], "LS → machine"]);
      if (ls && free >= 1) nx.push([[st, 0, pf + 1, m, pd], "LS → pool"]);
      if (pf && m < M) nx.push([[st, ls, pf - 1, m + 1, pd], "pool → machine"]);
      if (m && !ls) nx.push([[st, 1, pf, m - 1, pd], "machine → LS (unload + reload)"]);
      if (m && free >= 1) nx.push([[st, ls, pf, m - 1, pd + 1], "machine → pool"]);
      if (pd && !ls) nx.push([[st, 1, pf, m, pd - 1], "pool → LS (unload + reload)"]);
      if (!nx.length) dead.push(s);
      nx.forEach(([t, lab]) => { const k = key(t); if (!prev.has(k)) { prev.set(k, [key(s), lab]); nf.push(t); } });
    });
    fr = nf;
  }
  const path = [];
  if (dead.length) { let k = key(dead[0]); while (prev.get(k)) { const [pk, lab] = prev.get(k); path.unshift([lab, k.split(",").map(Number)]); k = pk; } }
  return { states: prev.size, dead, path };
}

/* ================================================================== mount */
const R = {};
let simA = null, simB = null;
export function mount(el) {
  simA = cellSim(EX5.cell_sim, EX5.cell_sim.events); simB = cellSim(EX5.cell_sim, EX5.cell_sim.events_b);
  el.innerHTML = [html5F(), html5G(), html5H(), html5I(), html5J(), html5K(), html5L(), html5M()].join("");
  const it = [init5F, init5G, init5H, init5I, init5J, init5K, init5L, init5M];
  it.forEach((f) => { try { f(); } catch (e) { console.error("fmse5x " + f.name, e); R.errors = (R.errors || []).concat(f.name + ": " + e.message); } });
  window.fe5x = { results, R };   // for tests / cross-checks: window.fe5x.results()
}

/* ================================================================== 5F ISA-95 operations model */
function html5F() {
  return card("f55F", "5F · ISA-95 operations model – the activities of level 3 (MOM) and the messages to level 4", "IEC 62264-3 activity model · IEC 62264-2 object models · IEC 62264-5 B2M transactions · click a cell",
    guide({
      principle: `<p>ISA-95 (IEC 62264) does not only define the <b>levels</b> (5A). Part 3 describes <b>what level 3 does</b>: manufacturing operations management (MOM) has four
        <b>categories</b> – production, maintenance, quality, inventory – and in each category the <b>same eight activities</b>: resource management, definition management,
        detailed scheduling, dispatching, execution management, data collection, tracking and performance analysis. This gives a 4 × 8 grid = <b>32 activities</b>.</p>
        <p>Why is it useful? (1) A <b>checklist</b>: for each cell you write which system does it (MES, CMMS, CAQ, WMS, cell controller, Excel …) – gaps and double work become visible.
        (2) A <b>common language</b> with MES suppliers. (3) The <b>interfaces</b> are the arrows between cells that sit in different systems.</p>
        <p>Part 2 defines the <b>object models</b> – the data that is exchanged (personnel, equipment, material, process segment, production schedule / performance …).
        Part 5 defines <b>business-to-manufacturing (B2M) transactions</b>: every message = <b>verb + noun</b>, e.g. <code>Process</code> + <code>ProductionSchedule</code>.
        B2MML (from MESA) is the XML implementation of these models; many projects use the same structure in JSON over REST.</p>
        <p class="phd-eq">message = Verb (GET · SHOW · PROCESS · ACKNOWLEDGE · CHANGE · CANCEL · SYNC · RESPOND) + Noun (object model)<br>
        pairs: GET → SHOW · PROCESS → ACKNOWLEDGE · CHANGE → RESPOND · CANCEL, SYNC → no answer</p>`,
      uses: USES5.F,
      howto: ["Print the 4 × 8 grid, write the system that covers each cell today and in the target state – use it as the scope chapter of the MES specification.",
        "Every arrow between two systems = one interface: write it into the message catalogue (5M) with verb + noun, trigger, content and answer.",
        "Use the ISA-95 object names for tables and API resources (Equipment, MaterialLot, JobOrder, JobResponse) – new people and suppliers understand them.",
        "Agree the B2MML / schema version with the MES and ERP suppliers in the contract; validate example messages against the XSD before the FAT.",
        "Keep level-4 messages coarse (production order, confirmation per operation) – pallets, machines and seconds stay inside level 3 / 2."],
    }) + `
    <h3 class="fe-h3">MOM activity model – 4 categories × 8 activities <span class="sub">click a cell</span></h3>
    <div class="fe-scroll"><table class="am-tab f5-mom" id="f5Mom"></table></div>
    <div id="f5MomD" class="f5-detail"></div>
    <h3 class="fe-h3">ISA-95 object models (Part 2 and Part 4)</h3>
    ${tab(["Object model", "What it holds", "FMS example"], OBJ_MODELS.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`))}
    <h3 class="fe-h3">B2M transaction verbs (Part 5)</h3>
    ${tab(["Verb", "Meaning", "Answer", "FMS example"], B2M_VERBS.map((r) => `<tr><td><code>${r[0]}</code></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`))}
    <h3 class="fe-h3">Message builder <span class="sub">jobs of the cell simulation (5J, scenario A) · B2MML-style example – check your schema version</span></h3>
    <div class="fe-row"><label>Object <select id="f5BObj"><option value="po">Production order (ERP → MES)</option><option value="job" selected>Job order (MES → cell)</option><option value="conf">Confirmation (cell → MES)</option></select></label>
      <label>Verb <select id="f5BVerb">${B2M_VERBS.map((v) => `<option${v[0] === "PROCESS" ? " selected" : ""}>${v[0]}</option>`).join("")}</select></label>
      <label>Job <select id="f5BJob">${EX5.cell_sim.jobs.map((j) => `<option>${j[0]}</option>`).join("")}</select></label>
      <button class="mx-el" id="f5BXml">Download XML</button></div>
    <p class="sub" id="f5BInfo"></p>
    <div class="grid2 eq"><div><h4>B2MML-style XML</h4><pre class="f5-pre" id="f5BX"></pre></div><div><h4>Same content as JSON (REST)</h4><pre class="f5-pre" id="f5BJ"></pre></div></div>
    ${wx("which messages does one production order need?", ["ERP sends <code>ProcessProductionSchedule</code> (PO 4711, 12 pallets) → MES answers <code>AcknowledgeProductionSchedule</code> accepted.",
      "MES splits the PO into 12 job orders J01…J12 and sends each with <code>ProcessJobOrder</code> when the cell's job buffer has a free place (5J: at most 3 jobs).",
      "Cell controller answers <code>AcknowledgeJobOrder</code>; when pallet P1 with J01 is back at the load station (minute 44 in scenario A) it sends the confirmation (<code>ProcessProductionPerformance</code> / job response) – start 12, end 42, machine MC01.",
      "MES sums the 12 confirmations and sends one confirmation per operation to the ERP. 2 + 12 + 12 + 12 + 1 = 39 messages for one production order – each needs an ID, a time-out and a duplicate check (5M)."])}`);
}
let momSel = [0, 3];
function init5F() {
  const draw = () => {
    $("f5Mom").innerHTML = `<thead><tr><th>Activity ↓ / category →</th>${MOM_CAT.map((c, i) => `<th class="fe-k${i + 1}">${c}</th>`).join("")}</tr></thead><tbody>${MOM_ACT.map((a, j) => `<tr><td><b>${esc(a[0])}</b></td>${MOM_CAT.map((c, i) => `<td class="f5-momc${momSel[0] === i && momSel[1] === j ? " f5-sel" : ""}" data-c="${i}" data-a="${j}"><span class="sub">${esc(MOM_GRID[i][j][1])}</span></td>`).join("")}</tr>`).join("")}</tbody>`;
    const [i, j] = momSel, g = MOM_GRID[i][j];
    $("f5MomD").innerHTML = `<h4>${esc(MOM_CAT[i])} · ${esc(MOM_ACT[j][0])}</h4>${kv([["What it does", esc(MOM_ACT[j][1])], ["FMS example", esc(g[0])], ["Typical system", `<b>${esc(g[1])}</b>`]])}`;
  };
  $("f5Mom").addEventListener("click", (e) => { const c = e.target.closest("[data-c]"); if (c) { momSel = [+c.dataset.c, +c.dataset.a]; draw(); } });
  draw();
  ["f5BObj", "f5BVerb", "f5BJob"].forEach((id) => $(id).addEventListener("change", drawB2M));
  $("f5BXml").addEventListener("click", () => { const m = b2m($("f5BObj").value, $("f5BVerb").value, $("f5BJob").value); download(`${m.root}_${$("f5BJob").value}.xml`, m.xml, "application/xml"); });
  drawB2M();
}
const T0 = "2026-11-20T06:00:00";   // example shift start; minute t of the simulation = T0 + t min
const tIso = (min) => (min == null ? "" : new Date(Date.UTC(2026, 10, 20, 6, 0, 0) + min * 60000).toISOString().slice(0, 19));
function jobTimes(sim, job) {   // from the scenario-A log: START / DONE / SEND_CONF lines of the job
  const f = (re) => { const l = sim.log.find((x) => re.test(x)); return l ? l.split(" ") : null; };
  const st = f(new RegExp(`^\\d+ START \\S+ \\S+ ${job}$`)), dn = f(new RegExp(`^\\d+ DONE \\S+ \\S+ ${job}$`)), sc = f(new RegExp(`^\\d+ SEND_CONF ${job}$`));
  return { start: st ? +st[0] : null, machine: st ? st[2] : null, pallet: st ? st[3] : null, end: dn ? +dn[0] : null, sent: sc ? +sc[0] : null };
}
function b2m(obj, verb, job) {
  const j = EX5.cell_sim.jobs.find((x) => x[0] === job), jt = jobTimes(simA, job), V = verb[0] + verb.slice(1).toLowerCase();
  const noun = { po: "ProductionSchedule", job: "JobOrder", conf: "ProductionPerformance" }[obj], root = V + noun;
  const sender = { po: "ERP", job: "MES", conf: "CC1" }[obj], recv = { po: "MES", job: "CC1", conf: "MES" }[obj];
  const idOnly = verb === "GET" || verb === "CANCEL";
  let body, data;
  if (obj === "po") {
    data = { ID: "PS-4711", ProductionRequest: { ID: "PR-4711-" + job, SegmentRequirement: { ProcessSegmentID: "MACH-OP10", WorkMasterID: j[1], Duration: `PT${j[2]}M`, EquipmentID: "FMS1", MaterialProducedRequirement: { MaterialDefinitionID: "CC20-MACH", Quantity: 1, UnitOfMeasure: "pallet" }, EarliestStartTime: tIso(0), LatestEndTime: tIso(EX5.cell_sim.T) } } };
    body = idOnly ? `<ID>PS-4711</ID>` : `<ID>PS-4711</ID>
      <ProductionRequest>
        <ID>PR-4711-${job}</ID>
        <SegmentRequirement>
          <ProcessSegmentID>MACH-OP10</ProcessSegmentID>
          <WorkMasterID>${j[1]}</WorkMasterID>
          <Duration>PT${j[2]}M</Duration>
          <EquipmentRequirement><EquipmentID>FMS1</EquipmentID></EquipmentRequirement>
          <MaterialProducedRequirement><MaterialDefinitionID>CC20-MACH</MaterialDefinitionID><Quantity><QuantityString>1</QuantityString><UnitOfMeasure>pallet</UnitOfMeasure></Quantity></MaterialProducedRequirement>
          <EarliestStartTime>${tIso(0)}</EarliestStartTime><LatestEndTime>${tIso(EX5.cell_sim.T)}</LatestEndTime>
        </SegmentRequirement>
      </ProductionRequest>`;
  } else if (obj === "job") {
    data = { ID: job, WorkMasterID: j[1], Priority: 1, Duration: `PT${j[2]}M`, EquipmentClassID: "HMC", EquipmentID: EX5.cell_sim.machines, Parameter: [{ ID: "NCProgram", Value: j[1] }] };
    body = idOnly ? `<ID>${job}</ID>` : `<ID>${job}</ID>
      <WorkMasterID>${j[1]}</WorkMasterID>
      <Priority>1</Priority>
      <Duration>PT${j[2]}M</Duration>
      <EquipmentRequirement><EquipmentClassID>HMC</EquipmentClassID>${EX5.cell_sim.machines.map((m) => `<EquipmentID>${m}</EquipmentID>`).join("")}</EquipmentRequirement>
      <Parameter><ID>NCProgram</ID><Value><ValueString>${j[1]}</ValueString></Value></Parameter>`;
  } else {
    data = { ID: "PP-" + job, ProductionResponse: { ID: job, SegmentResponse: { ProcessSegmentID: "MACH-OP10", ActualStartTime: tIso(jt.start), ActualEndTime: tIso(jt.end), EquipmentID: jt.machine, MaterialProducedActual: { MaterialDefinitionID: "CC20-MACH", MaterialLotID: jt.pallet, Quantity: 1, UnitOfMeasure: "pallet" } } } };
    body = idOnly ? `<ID>PP-${job}</ID>` : `<ID>PP-${job}</ID>
      <ProductionResponse>
        <ID>${job}</ID>
        <SegmentResponse>
          <ProcessSegmentID>MACH-OP10</ProcessSegmentID>
          <ActualStartTime>${tIso(jt.start)}</ActualStartTime><ActualEndTime>${tIso(jt.end)}</ActualEndTime>
          <EquipmentActual><EquipmentID>${jt.machine}</EquipmentID></EquipmentActual>
          <MaterialProducedActual><MaterialDefinitionID>CC20-MACH</MaterialDefinitionID><MaterialLotID>${jt.pallet}</MaterialLotID><Quantity><QuantityString>1</QuantityString><UnitOfMeasure>pallet</UnitOfMeasure></Quantity></MaterialProducedActual>
        </SegmentResponse>
      </ProductionResponse>`;
  }
  const answer = ["ACKNOWLEDGE", "RESPOND", "SHOW"].includes(verb), from = answer ? recv : sender, to = answer ? sender : recv;
  const verbEl = {
    GET: `<Get/>`, SHOW: `<Show/>`, PROCESS: `<Process/>`, CHANGE: `<Change/>`, CANCEL: `<Cancel/>`,
    ACKNOWLEDGE: `<Acknowledge><OriginalApplicationArea><BODID>MSG-${to}-${job}</BODID></OriginalApplicationArea><ResponseCriteria><ResponseExpression actionCode="Accepted"/></ResponseCriteria></Acknowledge>`,
    RESPOND: `<Respond><OriginalApplicationArea><BODID>MSG-${to}-${job}</BODID></OriginalApplicationArea><ResponseCriteria><ResponseExpression actionCode="Accepted"/></ResponseCriteria></Respond>`,
    SYNC: `<Sync><ActionCriteria><ActionExpression actionCode="Change"/></ActionCriteria></Sync>`,
  }[verb];
  const created = obj === "conf" && jt.sent != null ? tIso(jt.sent) : tIso(0), mid = `MSG-${from}-${job}${answer ? "-R" : ""}`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- B2MML-style example – check your schema version (element names and namespaces differ between B2MML releases) -->
<${root} xmlns="http://www.mesa.org/xml/B2MML" releaseID="example">
  <ApplicationArea>
    <Sender><LogicalID>${from}</LogicalID></Sender>
    <Receiver><LogicalID>${to}</LogicalID></Receiver>
    <BODID>${mid}</BODID>
    <CreationDateTime>${created}</CreationDateTime>
  </ApplicationArea>
  <DataArea>
    ${verbEl}
    <${noun}>
      ${body}
    </${noun}>
  </DataArea>
</${root}>`;
  const json = { _note: "B2MML-style example – check your schema version", verb, noun, messageId: mid, from, to, created, [noun]: idOnly ? { ID: data.ID } : data };
  if (answer && verb !== "SHOW") json.response = "Accepted";
  return { root, xml, json, jt, from, to };
}
function drawB2M() {
  const m = b2m($("f5BObj").value, $("f5BVerb").value, $("f5BJob").value), v = B2M_VERBS.find((x) => x[0] === $("f5BVerb").value);
  $("f5BX").textContent = m.xml; $("f5BJ").textContent = JSON.stringify(m.json, null, 2);
  $("f5BInfo").innerHTML = `<b>${esc(m.root)}</b> · ${esc(m.from)} → ${esc(m.to)} · ${esc(v[1])}${$("f5BObj").value === "conf" ? ` · from the 5J log (scenario A): START ${m.jt.start}, DONE ${m.jt.end}, confirmation sent ${m.jt.sent} (minutes after ${T0})` : ""}`;
}

/* ================================================================== 5G naming & IEC 81346 */
function html5G() {
  const N = EX5.naming;
  return card("f55G", "5G · Naming rules and IEC 81346 – one name for every signal, in every system", "tag validator · data-block tag list for all units · reference designation builder",
    guide({
      principle: `<p>A cell has thousands of signals. If the PLC calls a signal <code>M2_DOOR_CL</code>, the SCADA <code>HMC2.DoorClosed</code> and the MES <code>Machine 2 door</code>,
        every interface needs a mapping table – and every mapping table has errors. The rule: <b>one name, built from the equipment hierarchy (5B), used everywhere</b>.</p>
        <p class="phd-eq">tag = site . area . cell . unit . equipment . signal &nbsp;&nbsp; e.g. ${esc(N.site)}.${esc(N.area)}.${esc(N.cell)}.MC02.APC.ClampOK</p>
        <p>Rules of this example standard (the same as in the guide and the Python tool <code>tools/fmse/tag_namer.py</code>): <b>exactly 6 parts</b>; parts 1–5 only <b>A–Z a–z 0–9</b>;
        the signal (part 6) also, plus at most <b>one '_' followed by a unit suffix</b> (SpindleLoad_pct, Torque_Nm, LastCycle_s); the unit = <b>unit code + 2 digits</b>
        (MC02, not MC2 – lists sort correctly); total length <b>≤ ${N.max_len}</b> characters (old SCADA / HMI limits); <b>positive logic</b> – the signal must not start with
        ${N.negative_words.map((w) => `<code>${w}</code>`).join(", ")} followed by a capital letter or the end (ClampOK, not NotClamped – double negations cause wiring errors);
        <b>no duplicates</b>.</p>
        <p><b>IEC 81346</b> is the standard for <b>reference designations</b> of the physical things in drawings and on labels: <code>=</code> function aspect (what it does),
        <code>+</code> location aspect (where it is), <code>−</code> product aspect (what it is) with letter codes of IEC 81346-2 (KF = control device, MA = motor, BG = position sensor …).
        The tag name is for <b>signals in software</b>, the reference designation is for <b>devices in hardware</b>; link both in the I/O list.</p>`,
      uses: USES5.G,
      howto: ["Write the naming standard (1–2 pages) before the first PLC line: hierarchy codes, unit codes, signal words list (English), abbreviations, max length.",
        "Put the validator rules into the engineering tool (export of the PLC tag table → check script, like the Python tool) and run it at every FAT / SAT.",
        "Generate the standard data-block tags of every module automatically (table below) – nobody types 297 tags by hand.",
        "Reference designations: agree the function structure (=FMS1.MC02) with the electrical designer; the same code is printed on the cabinet labels.",
        "Keep a mapping table only for bought-in machines that cannot change their internal names – map at the module interface, not inside the cell logic."],
    }) + `
    <h3 class="fe-h3">Tag validator <span class="sub">one tag per line · preloaded with the 6 test tags of the example</span></h3>
    <div class="grid2 eq"><div><textarea id="f5Tags" class="f5-ta" rows="8" spellcheck="false" aria-label="Tags to check"></textarea>
      <div class="fe-row"><button class="mx-el" id="f5TagRst">Reset to the 6 test tags</button><span class="sub" id="f5TagCnt"></span></div></div>
      <div id="f5TagRes"></div></div>
    <h3 class="fe-h3">Data-block tag list for all unit instances <span class="sub">15 standard items (item 6F) + module part per module code</span></h3>
    <div id="f5DbSum"></div>
    <div class="fe-row"><label>Filter <input type="text" id="f5DbF" placeholder="e.g. MC02 or Heartbeat" style="width:180px"></label><button class="mx-el" id="f5DbCsv">Export CSV (all tags)</button><span class="sub" id="f5DbN"></span></div>
    <div class="fe-scroll f5-tall"><table class="am-tab f5-small" id="f5DbTab"></table></div>
    <h3 class="fe-h3">IEC 81346 reference designation builder</h3>
    <div class="grid2 eq"><div>${kv([["= function (what it does)", `<input type="text" id="f5Df" value="${esc(N.iec81346_example.function)}" class="f5-in">`],
      ["+ location (where)", `<input type="text" id="f5Dl" value="${esc(N.iec81346_example.location)}" class="f5-in">`],
      ["− product (what it is)", `<input type="text" id="f5Dp" value="${esc(N.iec81346_example.product)}" class="f5-in"><br><select id="f5Dc" class="f5-in"><option value="">letter code…</option>${IEC_CODES.filter((c) => c[1] !== "–").map((c) => `<option value="${c[1]}">${c[1]} – ${esc(c[2])}</option>`).join("")}</select>`]])}
      <p class="fe-big"><code id="f5Dout"></code></p><div id="f5Dmsg" class="sub"></div>
      <p class="sub">${esc(N.iec81346_example.note)}</p>
      <p class="sub">Read the example as: the control device KF1 (product) that belongs to machining centre MC02 of cell FMS1 (function) and sits in hall 1, column A3 (location).
        The same device can be found from any aspect – the electrician looks for +HALL1.A3, the programmer for =FMS1.MC02.</p></div>
      <div>${tab(["Class", "Code", "Purpose", "Example in an FMS"], IEC_CODES.map((c) => `<tr><td>${c[0]}</td><td><code>${c[1]}</code></td><td>${esc(c[2])}</td><td>${esc(c[3])}</td></tr>`), "f5-small")}
      <p class="sub">Letter codes are typical examples of IEC 81346-2:2019 – check the edition and the plant standard you work with.</p></div></div>
    ${wx("check the 6 test tags by hand", ["<code>PLT1.MACH.FMS1.MC02.APC.ClampOK</code> – 6 parts, only letters / digits, MC02 = code MC + 2 digits, 31 characters ≤ 48, positive → <b>OK</b>.",
      "<code>…MC2.Door.Closed</code> – unit MC2 has only one digit → <b>error</b> (sorting: MC10 would come before MC2).",
      "<code>…LS01.LightCurtain.NotOK</code> – signal starts with “Not” + capital → <b>error</b>: use <code>LightCurtainOK</code> and invert in the logic.",
      "<code>…POOL01.Fork.Pos-Ok</code> – “-” is not allowed → <b>error</b>: <code>PosOK</code>.",
      "<code>…WASH01.Tank.LevelHighHighAlarmWithDelay</code> – 54 characters > 48 → <b>error</b>: <code>LevelHH</code>; the delay is a property of the alarm, not part of the name.",
      "Line 6 is the same as line 1 → <b>duplicate</b>. Result: 1 valid, 5 errors."])}`);
}
function init5G() {
  const N = EX5.naming, ta = $("f5Tags");
  ta.value = store.get("tags", N.test_tags.join("\n"));
  const run = () => {
    const list = ta.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean), res = checkTags(list), nOk = res.filter((r) => r.ok).length;
    $("f5TagCnt").textContent = `${list.length} tags · ${nOk} valid · ${list.length - nOk} with errors`;
    $("f5TagRes").innerHTML = tab(["#", "Tag", "Len", "Verdict", "Rule broken", "Reason"], res.map((r, i) => `<tr class="${r.ok ? "" : "f5-badrow"}"><td>${i + 1}</td><td><code class="f5-brk">${esc(r.tag)}</code></td><td>${r.tag.length}</td><td>${ok(r.ok, "OK", "error")}</td><td>${r.ok ? "–" : esc(r.kind.join(", "))}</td><td>${r.ok ? "–" : esc(r.why.join("; "))}</td></tr>`), "f5-small");
  };
  ta.addEventListener("input", () => { store.set("tags", ta.value); run(); });
  $("f5TagRst").addEventListener("click", () => { store.del("tags"); ta.value = N.test_tags.join("\n"); run(); });
  run();
  const rows = dbTags(), long = rows.filter((r) => r.tag.length > N.max_len).length, nValid = checkTags(rows.map((r) => r.tag)).filter((r) => r.ok).length, longest = rows.reduce((a, r) => (r.tag.length > a.tag.length ? r : a), rows[0]), inst = N.units.reduce((a, u) => a + u[2], 0), std = rows.filter((r) => r.part === "standard").length;
  R.db = { instances: inst, standard: std, module: rows.length - std, total: rows.length, valid: nValid, longest: longest.tag.length, longer: long };
  $("f5DbSum").innerHTML = kpis([["unit instances", inst], [`standard tags (15 × ${inst})`, std], ["module-part tags", rows.length - std], ["tags in total", rows.length], [`tags longer than ${N.max_len} characters`, long, long ? "f5-warnc" : ""]]) +
    `<p class="sub">Units: ${N.units.map((u) => `${u[1]} ×${u[2]} (${u[0]}${EXTRA[u[0]] ? ", +" + EXTRA[u[0]].length + " module items" : ""})`).join(" · ")}. Every data-block tag has the 6 parts site.area.cell.unit.<b>group.item</b> – the group of the block item (Status, Command, Admin, Job, NC, Move …) is the equipment part, the item is the signal.
      All generated tags are checked with the same tag rule: <b>${nValid} valid</b>, longest ${longest.tag.length} characters (${esc(longest.tag)}) ≤ ${N.max_len}.</p>`;
  const draw = () => {
    const f = $("f5DbF").value.trim().toLowerCase(), sel = f ? rows.filter((r) => (r.tag + " " + r.mean).toLowerCase().includes(f)) : rows;
    $("f5DbN").textContent = `${sel.length} of ${rows.length} shown`;
    $("f5DbTab").innerHTML = `<thead><tr><th>Tag</th><th>Len</th><th>Unit</th><th>Word</th><th>Type</th><th>Dir</th><th>Part</th><th>Meaning</th></tr></thead><tbody>${sel.map((r) => `<tr><td><code>${esc(r.tag)}</code></td><td class="${r.tag.length > N.max_len ? "fe-no" : ""}">${r.tag.length}</td><td>${r.unit}</td><td>${r.off}</td><td>${esc(r.type)}</td><td>${r.dir}</td><td>${r.part}</td><td>${esc(r.mean)}</td></tr>`).join("")}</tbody>`;
  };
  $("f5DbF").addEventListener("input", draw); draw();
  $("f5DbCsv").addEventListener("click", () => download("datablock_tags_FMS1.csv", toCSV([["tag", "length", "unit", "module", "word_offset", "type", "direction", "part", "meaning"], ...rows.map((r) => [r.tag, r.tag.length, r.unit, r.mod, r.off, r.type, r.dir, r.part, r.mean])]), "text/csv"));
  const des = () => {
    const f = $("f5Df").value.trim(), l = $("f5Dl").value.trim(), p = $("f5Dp").value.trim(), msg = [];
    if (f && f[0] !== "=") msg.push("function aspect starts with ="); if (l && l[0] !== "+") msg.push("location aspect starts with +"); if (p && p[0] !== "-" && p[0] !== "−") msg.push("product aspect starts with −");
    const code = (p.replace(/^[-−]/, "").match(/^[A-Z]{1,2}/) || [""])[0], c = IEC_CODES.find((x) => x[1] === code);
    $("f5Dout").textContent = f + l + p;
    $("f5Dmsg").innerHTML = (msg.length ? `<span class="fe-no">${esc(msg.join(" · "))}</span><br>` : "") + (c ? `Letter code <b>${esc(code)}</b>: ${esc(c[2])} – e.g. ${esc(c[3])}` : code ? `Letter code ${esc(code)} is not in the short table` : "");
  };
  ["f5Df", "f5Dl", "f5Dp"].forEach((id) => $(id).addEventListener("input", des));
  $("f5Dc").addEventListener("change", () => { if ($("f5Dc").value) { $("f5Dp").value = "-" + $("f5Dc").value + "1"; des(); } });
  des();
}

/* ================================================================== 5H PackML in depth */
const PK_ALL = [...Object.keys(CMDS), "SC"];
function html5H() {
  const sc = EX5.packml_scenarios;
  return card("f55H", "5H · PackML in depth – test scenarios, full transition table, meaning per module, PackTags, OEE", "ISA-TR88.00.02 · same rules as the live machine 5C · scenarios of the shared example",
    guide({
      principle: `<p>The live machine in 5C shows the PackML states one click at a time. For engineering and for the <b>FAT</b> you need the rules written down so that every module
        supplier implements <b>exactly the same</b> behaviour. The rules used here (identical to 5C, the guide and the Python tool):</p>
        ${ul(["A command is <b>accepted</b> only if the state model has an arrow for it from the current state; otherwise it is <b>rejected</b> – state unchanged, logged.",
          "<b>Stop</b> is accepted in every state except Stopped, Stopping, Aborting, Aborted, Clearing → Stopping. <b>Abort</b> in every state except Aborting, Aborted → Aborting.",
          "<b>SC</b> (state complete) is not a command from outside – the unit's own sequence ends an acting state (Resetting, Starting, Execute, Completing, Holding …). SC in a wait state (Idle, Held, Suspended, Complete, Stopped, Aborted) is rejected.",
          "Each <b>mode</b> allows only some commands: Production all 9; Maintenance no Suspend / Unsuspend; Manual only Reset, Start, Stop, Abort, Clear.",
          "The <b>mode</b> may change only in Stopped, Idle or Aborted (no mode change while the machine moves)."])}
        <p class="phd-eq">state(k+1) = δ(state(k), command(k)) if (command allowed in mode) and (arrow exists) · else state(k+1) = state(k) and “rejected”</p>`,
      uses: USES5.H,
      howto: ["Put the transition table (CSV below) into the specification of every machine and module – it is the contract for the state machine.",
        "At the FAT play the 6 scenarios with a test client (OPC UA / Modbus script or the cell controller) and compare the end state and every rejected command.",
        "Ask the supplier which acting states really do something in his machine (table 'meaning per module type') – empty acting states finish with SC at once.",
        "Map the states to OEE losses (table below) once for the whole plant – then OEE is comparable between machines from different suppliers.",
        "Use the Structured Text skeleton as the base function block in your PLC library; the unit-specific sequence only sets SC."],
    }) + `
    <h3 class="fe-h3">Scenario runner</h3>
    <div class="fe-row"><label>Scenario <select id="f5PkS">${sc.map((s, i) => `<option value="${i}">${i + 1}. ${esc(s.name)}</option>`).join("")}<option value="c">Own scenario …</option></select></label>
      <label>Mode <select id="f5PkM">${Object.keys(MODES).map((m) => `<option>${m}</option>`).join("")}</select></label>
      <label class="f5-grow">Commands <input type="text" id="f5PkC" class="f5-wide" spellcheck="false"></label></div>
    <p class="sub">Commands separated by commas: ${PK_ALL.join(", ")} and Mode:Production / Mode:Maintenance / Mode:Manual. Start state is Stopped.</p>
    <div class="fe-row"><button class="mx-el" id="f5PkStep">Step ▶</button><button class="mx-el" id="f5PkAll">Run all</button><button class="mx-el" id="f5PkRst">Reset</button><span id="f5PkN" class="sub"></span></div>
    <div class="grid2"><div id="f5PkTr"></div><div><div id="f5PkEnd"></div><h4>All 6 example scenarios</h4><div id="f5PkSum"></div></div></div>
    <h3 class="fe-h3">Full transition table <span class="sub">row = current state, column = command → next state (– = rejected) · Production mode</span></h3>
    <div class="fe-row"><label>Mode filter <select id="f5PkTm">${Object.keys(MODES).map((m) => `<option>${m}</option>`).join("")}</select></label><button class="mx-el" id="f5PkCsv">Export CSV</button></div>
    <div class="fe-scroll"><table class="am-tab f5-small f5-tt" id="f5PkTab"></table></div>
    <h3 class="fe-h3">Meaning of the states for typical FMS modules</h3>
    ${tab(["State", ...MOD_TYPES.map(esc)], MOD_MEANING.map(([s, a]) => `<tr><td><b>${s}</b> <span class="sub">${STATES[s]}</span></td>${a.map((x) => `<td>${esc(x)}</td>`).join("")}</tr>`), "f5-small f5-mm")}
    <div class="grid2 eq"><div><h3 class="fe-h3">PackTags – what every unit offers</h3>
      ${tab(["Group", "Tag", "Type", "Meaning"], PACKTAGS.map((r) => `<tr><td>${r[0]}</td><td><code class="f5-brk">${esc(r[1])}</code></td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`), "f5-small")}</div>
      <div><h3 class="fe-h3">State → OEE loss</h3>
      ${tab(["State", "OEE class", "Comment"], STATE_OEE.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`), "f5-small")}
      <p class="am-note">With <code>Admin.StateCumulativeTime[mode][state]</code> the OEE time model of item 4F is filled directly: availability = Execute (+ acting cycle states) ÷ planned time; the Suspended time is the <b>system</b> loss caused by transport and buffers – exactly what the cell controller has to minimise.</p></div></div>
    <h3 class="fe-h3">Structured Text skeleton <span class="sub">preview of items 9 / 10 – same rules as above</span></h3>
    <details class="fx-more"><summary><b>Show FB_PackML (IEC 61131-3)</b></summary><pre class="f5-pre f5-st">${esc(ST_SKELETON)}</pre></details>
    ${wx("scenario 6 – manual mode limits", ["Start Stopped, mode Manual. <b>Reset</b> is allowed in Manual → Resetting; <b>SC</b> → Idle.",
      "<b>Start</b> → Starting; <b>SC</b> → Execute (the operator jogs / runs a single block).",
      "<b>Hold</b>: not in the Manual command list → <b>rejected</b>, still Execute. <b>Suspend</b>: also not allowed → <b>rejected</b>.",
      "<b>Stop</b> is allowed in Manual and Execute is inside the Stop box → Stopping; <b>SC</b> → <b>Stopped</b>. Result: end Stopped, 2 rejected (Hold, Suspend)."])}`);
}
let pkTrace = null, pkPos = 0;
function pkInput() {
  const v = $("f5PkS").value, sc = EX5.packml_scenarios;
  if (v !== "c") { $("f5PkM").value = sc[+v].mode; $("f5PkC").value = sc[+v].cmds.join(", "); }
}
function pkParse() { return $("f5PkC").value.split(",").map((s) => s.trim()).filter(Boolean).map((s) => (/^sc$/i.test(s) ? "SC" : /^mode:/i.test(s) ? s : (Object.keys(CMDS).find((c) => c.toLowerCase() === s.toLowerCase()) || s))); }
function init5H() {
  const own = store.get("pk", null);
  $("f5PkS").addEventListener("change", () => { pkInput(); pkPos = 0; drawPk(); });
  $("f5PkM").addEventListener("change", () => { $("f5PkS").value = "c"; pkPos = 0; drawPk(); });
  $("f5PkC").addEventListener("input", () => { $("f5PkS").value = "c"; store.set("pk", { mode: $("f5PkM").value, cmds: $("f5PkC").value }); pkPos = 0; drawPk(); });
  $("f5PkStep").addEventListener("click", () => { pkPos = Math.min(pkTrace.trace.length, pkPos + 1); drawPk(); });
  $("f5PkAll").addEventListener("click", () => { pkPos = pkTrace.trace.length; drawPk(); });
  $("f5PkRst").addEventListener("click", () => { pkPos = 0; drawPk(); });
  if (own) { $("f5PkS").value = "c"; $("f5PkM").value = own.mode; $("f5PkC").value = own.cmds; } else pkInput();
  pkPos = 1e9; drawPk();
  // summary of the 6 example scenarios
  const sum = EX5.packml_scenarios.map((s) => ({ name: s.name, mode: s.mode, ...packRun(s.mode, s.cmds) }));
  R.packml = sum.map((s) => ({ name: s.name, end: s.end, rejected: s.rejected }));
  $("f5PkSum").innerHTML = tab(["Scenario", "Mode", "End state", "Rejected", "Expected (hint)"], sum.map((s, i) => `<tr><td>${i + 1}. ${esc(s.name)}</td><td>${s.mode}</td><td><b>${s.end}</b> <span class="sub">${STATES[s.end]}</span></td><td>${s.rejected.length ? esc(s.rejected.join(", ")) : "–"}</td><td class="sub">${esc(EX5.packml_scenarios[i]._hint)}</td></tr>`), "f5-small f5-nw23");
  $("f5PkTm").addEventListener("change", drawPkTab); drawPkTab();
  $("f5PkCsv").addEventListener("click", () => { const m = $("f5PkTm").value; download(`packml_transitions_${m}.csv`, toCSV([["state", "number", ...PK_ALL], ...Object.keys(STATES).sort((a, b) => STATES[a] - STATES[b]).map((s) => [s, STATES[s], ...PK_ALL.map((c) => { const r = packStep(s, m, c); return r.ok ? r.st : "rejected"; })])]), "text/csv"); });
}
function drawPk() {
  pkTrace = packRun($("f5PkM").value, pkParse());
  pkPos = Math.min(pkPos, pkTrace.trace.length);
  const tr = pkTrace.trace;
  $("f5PkN").textContent = `step ${pkPos} / ${tr.length}`;
  $("f5PkTr").innerHTML = tab(["Step", "Command", "Before", "After", "Result", "Why"], tr.map((r, i) => `<tr class="${i >= pkPos ? "f5-dim" : r.ok ? "" : "f5-badrow"}${i === pkPos - 1 ? " f5-cur" : ""}"><td>${r.i}</td><td><code>${esc(r.cmd)}</code></td><td>${r.before}</td><td><b>${i < pkPos ? r.after : "…"}</b></td><td>${i < pkPos ? ok(r.ok, "accepted", "rejected") : ""}</td><td class="sub">${i < pkPos ? esc(r.why) : ""}</td></tr>`), "f5-small");
  const cur = pkPos ? tr[pkPos - 1] : null, st = cur ? cur.after : "Stopped", md = cur ? cur.mode : $("f5PkM").value, fin = pkPos === tr.length;
  $("f5PkEnd").innerHTML = kpis([[fin ? "end state" : "state after step " + pkPos, `${st} (${STATES[st]})`], ["mode", md], ["rejected so far", tr.slice(0, pkPos).filter((r) => !r.ok).length]]);
}
function drawPkTab() {
  const m = $("f5PkTm").value, sts = Object.keys(STATES).sort((a, b) => STATES[a] - STATES[b]);
  $("f5PkTab").innerHTML = `<thead><tr><th>State</th><th>No</th>${PK_ALL.map((c) => `<th>${c}${CMDS[c] ? ` <span class="sub">${CMDS[c]}</span>` : ""}</th>`).join("")}</tr></thead><tbody>${sts.map((s) => `<tr><td><b>${s}</b></td><td>${STATES[s]}</td>${PK_ALL.map((c) => { const r = packStep(s, m, c); return `<td class="${r.ok ? "f5-okc" : "f5-nc"}">${r.ok ? r.st : "–"}</td>`; }).join("")}</tr>`).join("")}</tbody>`;
}

/* ================================================================== 5I ISA-88 */
function html5I() {
  const tree = (n) => `<li><span class="fe-tt f5-t${n.t.split(" ")[0].toLowerCase()}">${esc(n.t)}</span> ${esc(n.n.replace(/^[^:]+: /, ""))}${n.d ? ` <span class="sub">– ${esc(n.d)}</span>` : ""}${n.c ? `<ul>${n.c.map(tree).join("")}</ul>` : ""}</li>`;
  const count = (n, t) => (n.t === t ? 1 : 0) + (n.c || []).reduce((a, c) => a + count(c, t), 0);
  return card("f55I", "5I · ISA-88 procedural model and recipes – applied to machining and assembly", "IEC 61512 · procedure → unit procedure → operation → phase · general / site / master / control recipe",
    guide({
      principle: `<p>ISA-88 (IEC 61512) was written for batch processes (chemicals, food, pharma), but its two ideas are very useful in discrete manufacturing:</p>
        <p><b>1. Separate the recipe from the equipment.</b> The <b>equipment</b> (5B: cell → unit → equipment module → control module) knows <i>how</i> to do things (clamp, change pallet, run a program).
        The <b>recipe</b> says <i>what</i> to do for a product, in which order and with which parameters. A new part type = a new recipe, <b>not new PLC code</b>.</p>
        <p><b>2. A procedure is a tree with four levels.</b></p>
        <p class="phd-eq">Procedure (whole job) → Unit procedure (on one unit) → Operation (one major step) → Phase (smallest step the equipment can do)</p>
        <p>The <b>phase</b> is where recipe and equipment meet: each phase is one PackML-like state machine in the PLC (Idle → Execute → Complete, Held …), started by the procedure with
        parameters. The four <b>recipe types</b> go from general (company knowledge) to control recipe (one job, actual values) – in an FMS the control recipe is the job with its
        NC program, pallet, machine and serial numbers, and its record is the genealogy.</p>`,
      uses: USES5.I,
      howto: ["List the phases your equipment can do (library) – e.g. 'APC change', 'Run NC program (no, rev)', 'Clamp (pressure)', 'Wash (recipe no)'. Each gets a PackML state machine.",
        "Write the master recipe per part type as data: unit procedures, operations, phases, parameters (table below) – stored in the MES / cell controller, versioned and released.",
        "The cell controller builds the control recipe per job (actual machine, pallet, serials) and records actual values → that record is the batch / genealogy record.",
        "Keep the equipment logic free of part-type specific code: if a PLC program needs 'IF part = CC20 THEN …', a recipe parameter is missing.",
        "For assembly lines the same structure works: station = unit, screw / press / test = phases with parameter sets."],
    }) + `
    <div class="grid2 eq"><div><h3 class="fe-h3">FMS example – machining a crankcase pallet</h3><div class="fe-tree f5-tree"><ul>${tree(S88_FMS)}</ul></div>
        <p class="sub">${count(S88_FMS, "Unit procedure")} unit procedures · ${count(S88_FMS, "Operation")} operations · ${count(S88_FMS, "Phase")} phases</p></div>
      <div><h3 class="fe-h3">Assembly example – compressor VC20</h3><div class="fe-tree f5-tree"><ul>${tree(S88_ASM)}</ul></div>
        <p class="sub">${count(S88_ASM, "Unit procedure")} unit procedures · ${count(S88_ASM, "Operation")} operations · ${count(S88_ASM, "Phase")} phases</p></div></div>
    <h3 class="fe-h3">Recipe types</h3>
    ${tab(["Recipe type", "Contains", "Owner", "Example (machining / assembly)"], RECIPES.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`))}
    <h3 class="fe-h3">Master recipe → FMS data <span class="sub">where each recipe parameter lives and who executes it</span></h3>
    ${tab(["Parameter", "Master value", "Stored in", "Used by (phase)"], RECIPE_MAP.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`))}
    <h3 class="fe-h3">Control recipe builder <span class="sub">master recipe + job of the simulation (5J, scenario A) = control recipe</span></h3>
    <div class="fe-row"><label>Job <select id="f5RcJ">${EX5.cell_sim.jobs.map((j) => `<option>${j[0]}</option>`).join("")}</select></label></div>
    <div id="f5Rc"></div>
    ${wx("from master to control recipe for job J04", ["Master recipe for program O2030A: unit procedures Load → Machine → Wash → Measure → Unload; phase 'Run NC program' parameter = O2030A, planned 40 min.",
      "MES releases job J04 (work master O2030A). The cell controller copies the master into a control recipe J04.",
      "5J scenario A: LOAD P4 J04 at minute 30, ROUTE P4 MC01 at 43, START MC01 at 46 → actual unit = MC01, pallet P4 are written into the control recipe.",
      "DONE at 86 → actual duration 40 min (= planned, no hold). The completed control recipe is the record of J04: who, where, when, with which program – the genealogy."])}`);
}
function init5I() {
  const draw = () => {
    const job = $("f5RcJ").value, j = EX5.cell_sim.jobs.find((x) => x[0] === job), jt = jobTimes(simA, job);
    const ld = simA.log.find((l) => new RegExp(`^\\d+ LOAD \\S+ ${job}$`).test(l)), ldT = ld ? +ld.split(" ")[0] : null;
    const rows = [["Load at LS01", "Clamp + pressure check", "pallet " + (jt.pallet || "–"), `LOAD at ${ldT} min, LOADED at ${ldT != null ? ldT + EX5.cell_sim.load_min : "–"}`],
      ["Machine", "Run NC program", `program ${j[1]}, planned ${j[2]} min`, jt.start != null ? `${jt.machine}: START ${jt.start}, DONE ${jt.end} → ${jt.end - jt.start} min${jt.end - jt.start > j[2] ? ` (incl. ${jt.end - jt.start - j[2]} min Held)` : ""}` : "not started"],
      ["Unload at LS01", "Unclamp, confirmation", "–", jt.sent != null ? `confirmation sent at ${jt.sent} min` : "not yet sent"]];
    $("f5Rc").innerHTML = tab(["Unit procedure", "Phase", "Master parameter", "Actual (control recipe record)"], rows.map((r) => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`), "f5-small");
  };
  $("f5RcJ").addEventListener("change", draw); draw();
}

/* ================================================================== 5J cell-controller logic simulation */
const CS = EX5.cell_sim;
const SCN = { A: { down: 50, dur: 30, fm: "MC02", ft: 60, fd: 25, ev: CS.events }, B: { down: 50, dur: 90, fm: "MC02", ft: 60, fd: 25, ev: CS.events_b } };
const J = { sim: null, tf: 0, playing: false, raf: 0, last: 0, speed: 5, lastT: -1 };
function html5J() {
  return card("f55J", "5J · Cell-controller logic – the decision rules, simulated minute by minute", "rules of the shared example (EX5.cell_sim._rules) · same log line by line as the guide and the Python tool",
    guide({
      principle: `<p>The cell controller (level 2) is a <b>loop of simple rules</b>, executed again and again (here every minute; in reality every 100–500 ms or on every event).
        The rules decide which pallet is loaded with which job, which machine gets which pallet, where the vehicle drives, and what is reported to the MES.
        Because the rules are written down exactly, a simulation, the real controller and the textbook give the <b>same log</b> – that log is the test case for the FAT.</p>
        <p class="phd-eq">every minute t: &nbsp;1 external events → 2 completions (vehicle, machines, load station) → 3 MES link (send confirmations, get ≤ 1 job) → 4 decisions (load, route, move)</p>
        ${ul(["<b>Job buffer</b>: the cell keeps up to b jobs from the MES locally (here b = " + CS.job_buffer_max + "). If the MES is down the cell works on with the buffer.",
          "<b>Outbox</b> (store-and-forward): confirmations are queued and sent when the link is up – nothing is lost during an MES outage.",
          "<b>Routing</b>: a READY pallet gets the lowest-numbered machine that is Idle, not reserved and not faulted; the machine is reserved until the vehicle takes the pallet away again.",
          "<b>Vehicle</b>: one transport at a time, requests first-in-first-out. A FAULT puts an executing machine into Held (remaining time stored); REPAIRED continues it. A pallet that arrives at a machine which became faulted on the way starts it in Held with the full machining time remaining.",
          "<b>KPIs</b>: Execute / Held minutes = state after all 4 steps of each minute t = 0 … T (so a job counts t ∈ [start, end)); the max outbox is measured after step 2, before sending.",
          "<b>Starved minute</b>: the load station is free, pallets are waiting, but the job buffer is empty although the MES still has jobs – the price of an MES outage longer than the buffer."])}`,
      uses: USES5.J,
      howto: ["Write the rules of your real cell controller in this form (numbered, ordered, with tie-breaks) – it is the core chapter of the cell-controller specification.",
        "Define the log format first; the real controller must write the same events. Then every test run can be compared line by line with the simulation (regression test).",
        "Play the disturbance scenarios at the FAT: MES down shorter / longer than the buffer, machine fault during Execute, fault while a pallet is on its way.",
        "Choose the job-buffer size from the expected MES outage time (5K) and from the job length: buffer [h] ≈ b × average job time ÷ number of machines.",
        "Use the Execute minutes per machine and the starved minutes as KPIs in the real cell (they come from the PackML state times)."],
    }) + `
    <div class="fe-row"><label>Scenario <select id="f5JS"><option value="A">A – MES down 50–80, MC02 fault 60–85</option><option value="B">B – MES down 50–140 (90 min), MC02 fault 60–85</option><option value="C">Own values</option></select></label>
      <label>Job buffer <input type="number" id="f5Jb" min="1" max="12" step="1"> jobs</label>
      <label>Fault <select id="f5Jfm">${CS.machines.map((m) => `<option>${m}</option>`).join("")}</select> at <input type="number" id="f5Jft" min="0" max="${CS.T}" step="1"> for <input type="number" id="f5Jfd" min="0" max="${CS.T}" step="1"> min</label>
      <label>MES down at <input type="number" id="f5Jmd" min="0" max="${CS.T}" step="1"> for <input type="number" id="f5Jmu" min="0" max="${CS.T}" step="1"> min</label></div>
    <div class="fe-row"><button class="mx-el" id="f5JPlay">▶ Play</button><button class="mx-el" id="f5JBk">◀ −1 min</button><button class="mx-el" id="f5JSt">+1 min ▶</button><button class="mx-el" id="f5JNx">next event ▶▶</button><button class="mx-el" id="f5JRst">Reset</button>
      <label>Speed <select id="f5JSp"><option value="1">1 min/s</option><option value="2">2 min/s</option><option value="5" selected>5 min/s</option><option value="10">10 min/s</option><option value="30">30 min/s</option></select></label>
      <label class="f5-grow">Minute <input type="range" id="f5JR" min="0" max="${CS.T}" step="1" value="0" class="f5-range"></label><b id="f5JT" class="f5-tnow"></b><button class="mx-el" id="f5JCsv">Log CSV</button></div>
    <div class="fe-scroll"><svg id="f5JPlant" class="fe-chart f5-plant" viewBox="0 0 900 360" role="img" aria-label="Animated cell: MES, cell controller, job buffer, outbox, load station, vehicle and three machines"></svg></div>
    <div id="f5JNow"></div>
    <div class="fe-scroll"><svg id="f5JG" class="fe-chart f5-gantt" role="img" aria-label="Gantt chart of machines, load station, vehicle and MES link"></svg></div>
    <div class="sub f5-lgd"><span class="fx-lg"><i class="f5-sw f5-ex"></i>Execute</span><span class="fx-lg"><i class="f5-sw f5-held"></i>Held (fault)</span><span class="fx-lg"><i class="f5-sw f5-cpl"></i>Complete – waits for vehicle</span><span class="fx-lg"><i class="f5-sw f5-load"></i>loading at LS</span><span class="fx-lg"><i class="f5-sw f5-mv"></i>vehicle move</span><span class="fx-lg"><i class="f5-sw f5-down"></i>MES link down</span><span class="fx-lg"><i class="f5-sw f5-outb"></i>outbox (count)</span> · click the chart to jump to a minute</div>
    <div class="grid2"><div><h4>Message log <span class="sub" id="f5JLn"></span></h4><div id="f5JLog" class="f5-log"></div></div><div><h4>KPIs at T = ${CS.T} min</h4><div id="f5JK"></div><h4>Scenario A vs B (shared example values)</h4><div id="f5JAB"></div></div></div>
    ${wx("the first 12 minutes of scenario A, rule by rule", ["t = 0: step 3 – MES up, buffer 0 < 3 → <code>0 JOB J01</code>. Step 4a – LS free, queue P1…P6, buffer has J01 → <code>0 LOAD P1 J01</code> (ends at 0 + 10 = 10).",
      "t = 1, 2, 3: one job per minute → <code>1 JOB J02</code>, <code>2 JOB J03</code>, <code>3 JOB J04</code>; now the buffer is full (3), so no job at t = 4…9.",
      "t = 10: step 2 – LS end → <code>10 LOADED P1 J01</code>. Step 3 – buffer still 3 → no job. Step 4a – <code>10 LOAD P2 J02</code> (buffer 2). 4b – P1 READY, MC01 Idle → <code>10 ROUTE P1 MC01</code>. 4c – vehicle free → <code>10 MOVE P1 LS-&gt;MC01</code> (ends 12).",
      "t = 11: buffer 2 &lt; 3 → <code>11 JOB J05</code>.",
      "t = 12: vehicle arrives → <code>12 START MC01 P1 J01</code>, end = 12 + 30 = 42. Execute minutes of MC01 count t = 12 … 41 (30 minutes) – counting rule t ∈ [start, end).",
      "t = 60 (fault): MC02 runs J02 since 22 with end 62 → remaining 2 min stored, state Held → <code>60 FAULT MC02 Held</code>; at 85 → <code>85 REPAIRED MC02 Execute</code>, new end 87. Held minutes 60 … 84 = 25."])}`);
}
function jEvents() {
  const s = $("f5JS").value;
  if (s !== "C") return SCN[s].ev;
  const md = num($("f5Jmd").value), mu = md + num($("f5Jmu").value), ft = num($("f5Jft").value), fr = ft + num($("f5Jfd").value), fm = $("f5Jfm").value;
  return [[md, "MES_DOWN", ""], [ft, "FAULT", fm], [mu, "MES_UP", ""], [fr, "REPAIRED", fm]];
}
function jFill(s) {
  const v = SCN[s]; if (!v) return;
  $("f5Jb").value = CS.job_buffer_max; $("f5Jfm").value = v.fm; $("f5Jft").value = v.ft; $("f5Jfd").value = v.fd; $("f5Jmd").value = v.down; $("f5Jmu").value = v.dur;
}
function jRun() {
  const b = Math.max(1, Math.round(num($("f5Jb").value, CS.job_buffer_max)));
  J.sim = cellSim(CS, jEvents(), { buffer: b });
  J.tf = Math.min(J.tf, CS.T); J.lastT = -1;
  store.set("sim", { s: $("f5JS").value, b, fm: $("f5Jfm").value, ft: $("f5Jft").value, fd: $("f5Jfd").value, md: $("f5Jmd").value, mu: $("f5Jmu").value });
  drawGantt(); drawJK(); jDraw(true);
}
export function jSetScenario(s) { if (!$("f5JS")) return; $("f5JS").value = s; jFill(s); J.tf = 0; jRun(); }
function init5J() {
  const sv = store.get("sim", null);
  if (sv && sv.s) { $("f5JS").value = sv.s; jFill(sv.s === "C" ? "A" : sv.s); if (sv.s === "C") { $("f5Jb").value = sv.b; $("f5Jfm").value = sv.fm; $("f5Jft").value = sv.ft; $("f5Jfd").value = sv.fd; $("f5Jmd").value = sv.md; $("f5Jmu").value = sv.mu; } else $("f5Jb").value = sv.b || CS.job_buffer_max; }
  else { $("f5JS").value = "A"; jFill("A"); }
  $("f5JS").addEventListener("change", () => { jFill($("f5JS").value); jRun(); });
  ["f5Jfm", "f5Jft", "f5Jfd", "f5Jmd", "f5Jmu"].forEach((id) => $(id).addEventListener("change", () => { $("f5JS").value = "C"; jRun(); }));
  $("f5Jb").addEventListener("change", jRun);
  $("f5JPlay").addEventListener("click", jPlay);
  $("f5JSt").addEventListener("click", () => { jPause(); J.tf = Math.min(CS.T, Math.floor(J.tf) + 1); jDraw(); });
  $("f5JBk").addEventListener("click", () => { jPause(); J.tf = Math.max(0, Math.ceil(J.tf) - 1); jDraw(); });
  $("f5JNx").addEventListener("click", () => { jPause(); const t = Math.floor(J.tf), nx = J.sim.log.map((l) => +l.split(" ")[0]).find((x) => x > t); J.tf = nx != null ? nx : CS.T; jDraw(); });
  $("f5JRst").addEventListener("click", () => { jPause(); J.tf = 0; jDraw(); });
  $("f5JSp").addEventListener("change", () => { J.speed = +$("f5JSp").value; });
  $("f5JR").addEventListener("input", () => { jPause(); J.tf = +$("f5JR").value; jDraw(); });
  $("f5JG").addEventListener("click", (e) => { const r = $("f5JG").getBoundingClientRect(), vb = $("f5JG").viewBox.baseVal, x = (e.clientX - r.left) / r.width * vb.width; if (x < GX0) return; jPause(); J.tf = Math.max(0, Math.min(CS.T, Math.round((x - GX0) / (GX1 - GX0) * CS.T))); jDraw(); });
  $("f5JLog").addEventListener("click", (e) => { const d = e.target.closest("[data-t]"); if (d) { jPause(); J.tf = +d.dataset.t; jDraw(); } });
  $("f5JCsv").addEventListener("click", () => download(`cell_sim_log_${$("f5JS").value}.csv`, toCSV([["t_min", "event", "object", "details"], ...J.sim.log.map((l) => { const p = l.split(" "); return [p[0], p[1], p[2] || "", p.slice(3).join(" ")]; })]), "text/csv"));
  document.addEventListener("visibilitychange", () => { if (document.hidden) jPause(); });
  // A vs B table (always the shared example)
  const row = (n, f) => `<tr><td>${n}</td><td>${f(simA.K)}</td><td>${f(simB.K)}</td></tr>`;
  $("f5JAB").innerHTML = tab(["KPI", "A (MES down 30 min)", "B (MES down 90 min)"], [row("jobs started / done", (k) => `${k.started} / ${k.done}`), row("confirmations sent", (k) => k.sent), row("outbox at T / max", (k) => `${k.outbox} / ${k.maxout}`),
    row("starved minutes (LS)", (k) => k.starved), ...CS.machines.map((m) => row(`Execute minutes ${m}`, (k) => k.ex[m])), row("MC02 held minutes", (k) => k.held.MC02)], "f5-small f5-num") +
    `<p class="sub">B: the 3-job buffer is empty about 20 min after the MES goes down; the load station waits ${simB.K.starved} min, MC01 takes over work (180 min) because MC02 is faulted and later starved; up to ${simB.K.maxout} confirmations wait in the outbox and are all sent at minute 140 – none is lost.</p>`;
  R.cellA = { ...simA.K, first11: simA.log.slice(0, 11) }; R.cellB = { ...simB.K };
  jRun();
}
function jPlay() {
  if (J.playing) { jPause(); return; }
  if (J.tf >= CS.T) J.tf = 0;
  J.playing = true; J.last = performance.now(); $("f5JPlay").textContent = "❚❚ Pause";
  J.raf = requestAnimationFrame(jTick);
}
function jPause() { J.playing = false; cancelAnimationFrame(J.raf); const b = $("f5JPlay"); if (b) b.textContent = "▶ Play"; }
function jTick(now) {
  if (!J.playing) return;
  if (!live($("f5JPlant"))) { jPause(); return; }
  const dt = Math.min(0.25, (now - J.last) / 1000); J.last = now;
  J.tf = Math.min(CS.T, J.tf + dt * J.speed); jDraw();
  if (J.tf >= CS.T) { jPause(); return; }
  J.raf = requestAnimationFrame(jTick);
}
const GX0 = 76, GX1 = 888;
function drawGantt() {
  const S = J.sim, sn = S.snaps, T = S.T, X = (t) => GX0 + t / T * (GX1 - GX0), rows = [...CS.machines, "LS", "Vehicle", "MES link", "Outbox"], rh = 26, top = 18, H = top + rows.length * rh + 26;
  let s = "";
  rows.forEach((r, i) => { const y = top + i * rh; s += `<text class="fe-tick f5-gl" x="${GX0 - 6}" y="${y + rh / 2 + 4}" text-anchor="end">${r}</text><line class="fe-grid" x1="${GX0}" x2="${GX1}" y1="${y + rh}" y2="${y + rh}"/>`; });
  for (let t = 0; t <= T; t += 30) s += `<line class="fe-grid" x1="${X(t)}" x2="${X(t)}" y1="${top}" y2="${top + rows.length * rh}"/><text class="fe-tick" x="${X(t)}" y="${top + rows.length * rh + 14}" text-anchor="middle">${t}</text>`;
  s += `<text class="fe-tick" x="${GX1}" y="${H - 1}" text-anchor="end">minutes</text>`;
  const segs = (key) => { const out = []; let cur = null; sn.forEach((x) => { const k = key(x); if (cur && cur.k === k) cur.t1 = x.t + 1; else { if (cur && cur.k) out.push(cur); cur = { k, t0: x.t, t1: x.t + 1, x }; } }); if (cur && cur.k) out.push(cur); return out; };
  const bar = (row, sg, cls, lab, tip) => { const y = top + row * rh + 4, x0 = X(sg.t0), w = Math.max(1, X(sg.t1) - x0); s += `<rect class="f5-gb ${cls}" x="${x0.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${rh - 8}" rx="2"><title>${esc(tip)} · ${sg.t0}–${sg.t1} min</title></rect>${w > 26 && lab ? `<text class="f5-gt" x="${(x0 + w / 2).toFixed(1)}" y="${y + rh / 2 + 0}" text-anchor="middle">${esc(lab)}</text>` : ""}`; };
  CS.machines.forEach((mn, i) => segs((x) => { const m = x.m[i]; return ["Execute", "Held", "Complete"].includes(m.st) ? m.st + "|" + (m.job || "") : ""; }).forEach((g) => { const [st, job] = g.k.split("|"); bar(i, g, { Execute: "f5-ex", Held: "f5-held", Complete: "f5-cpl" }[st], st === "Execute" ? job : st === "Held" ? "Held" : "", `${mn} ${st} ${job}`); }));
  const r0 = CS.machines.length;
  segs((x) => (x.ls ? x.ls.p + " " + x.ls.job : "")).forEach((g) => bar(r0, g, "f5-load", g.k.split(" ")[1], "LS loading " + g.k));
  segs((x) => (x.veh ? x.veh.id + "|" + x.veh.p + "|" + x.veh.to : "")).forEach((g) => { const [, p, to] = g.k.split("|"); bar(r0 + 1, g, to === "LS" ? "f5-mvb" : "f5-mv", p, `MOVE ${p} → ${to}`); });
  segs((x) => (x.up ? "" : "down")).forEach((g) => bar(r0 + 2, g, "f5-down", "MES down", "MES link down"));
  const yb = top + (r0 + 4) * rh - 3, mx = Math.max(1, ...sn.map((x) => x.out.length));
  sn.forEach((x) => { if (x.out.length) { const h = x.out.length / mx * (rh - 8); s += `<rect class="f5-outb" x="${X(x.t).toFixed(1)}" y="${(yb - h).toFixed(1)}" width="${(X(1) - X(0) + 0.3).toFixed(2)}" height="${h.toFixed(1)}"/>`; } });
  s += `<text class="fe-tick" x="${GX1 - 2}" y="${top + (r0 + 3) * rh + 11}" text-anchor="end">max ${S.K.maxout}</text>`;
  s += `<line id="f5JCur" class="f5-cur" x1="${X(0)}" x2="${X(0)}" y1="${top - 6}" y2="${top + rows.length * rh}"/>`;
  $("f5JG").setAttribute("viewBox", `0 0 900 ${H}`); $("f5JG").innerHTML = s;
  $("f5JLog").innerHTML = S.log.map((l, i) => `<div data-t="${l.split(" ")[0]}" data-i="${i}">${esc(l)}</div>`).join("");
  $("f5JLn").textContent = `${S.log.length} lines · click a line to jump`;
}
function drawJK() {
  const K = J.sim.K, util = (m) => K.ex[m] / CS.T * 100;
  $("f5JK").innerHTML = kpis([["jobs started", K.started], ["jobs completed (DONE)", K.done], ["confirmations sent", K.sent], ["outbox at T", K.outbox, K.outbox ? "fe-no" : ""], ["max outbox", K.maxout],
    ["starved minutes (LS)", K.starved, K.starved ? "f5-warnc" : ""], ...CS.machines.map((m) => [`Execute min ${m} (${fx(util(m), 0)} %)`, K.ex[m]]), [`held min ${$("f5Jfm").value}`, K.held[$("f5Jfm").value]]]);
}
function jDraw(force) {
  const S = J.sim, t = Math.floor(J.tf + 1e-9), sn = S.snaps[Math.min(t, S.T)];
  drawPlant(sn, J.tf);
  if (t === J.lastT && !force) return;
  J.lastT = t;
  $("f5JR").value = t; $("f5JT").textContent = `t = ${t} min`;
  const X = GX0 + t / S.T * (GX1 - GX0), c = $("f5JCur"); if (c) { c.setAttribute("x1", X); c.setAttribute("x2", X); }
  const box = $("f5JLog"); let first = null;
  box.querySelectorAll("div[data-t]").forEach((d) => { const dt = +d.dataset.t; d.className = dt === t ? "f5-now" : dt > t ? "f5-fut" : ""; if (dt === t && !first) first = d; });
  const tgt = first || [...box.querySelectorAll("div[data-t]")].filter((d) => +d.dataset.t <= t).pop();
  if (tgt) box.scrollTop = Math.max(0, tgt.offsetTop - box.offsetTop - 60);
  const startedNow = S.log.slice(0, sn.nlog).filter((l) => / START /.test(l)).length, doneNow = S.log.slice(0, sn.nlog).filter((l) => / DONE /.test(l)).length;
  const here = S.log.filter((l) => +l.split(" ")[0] === t);
  $("f5JNow").innerHTML = `<div class="f5-nowbar"><b>Minute ${t}</b> · MES link ${sn.up ? '<span class="fe-ok">up</span>' : '<span class="fe-no">DOWN</span>'} · jobs left at MES ${sn.mesLeft} · buffer ${sn.buf.length}/${num($("f5Jb").value, CS.job_buffer_max)} · outbox ${sn.out.length} · started ${startedNow} · done ${doneNow} · starved so far ${sn.starved}
    ${here.length ? `<br><span class="sub">this minute:</span> ${here.map((l) => `<code>${esc(l)}</code>`).join(" ")}` : ""}</div>`;
}
function drawPlant(sn, tf) {
  const MX = [430, 600, 770], LSX = 125, TY = 236, st = { Execute: "f5-ex", Held: "f5-held", Complete: "f5-cpl", Idle: "f5-idle" };
  const chip = (x, y, lab, cls, w = 40) => `<rect class="f5-chip ${cls}" x="${x}" y="${y}" width="${w}" height="20" rx="4"/><text class="f5-ct" x="${x + w / 2}" y="${y + 14}" text-anchor="middle">${esc(lab)}</text>`;
  let s = "";
  // MES + link + cell controller
  s += `<rect class="f5-box" x="16" y="14" width="150" height="58" rx="8"/><text class="f5-bt" x="91" y="38" text-anchor="middle">MES (level 3)</text><text class="fe-tick" x="91" y="56" text-anchor="middle">${sn.mesLeft} jobs not yet sent</text>`;
  s += `<line class="${sn.up ? "f5-linkup" : "f5-linkdn"}" x1="166" y1="43" x2="300" y2="43"/>${sn.up ? `<text class="fe-tick" x="233" y="36" text-anchor="middle">link up</text>` : `<text class="f5-dnx" x="233" y="50" text-anchor="middle">✕</text><text class="fe-tick fe-no" x="233" y="34" text-anchor="middle">MES DOWN</text>`}`;
  s += `<rect class="f5-box" x="300" y="14" width="170" height="58" rx="8"/><text class="f5-bt" x="385" y="38" text-anchor="middle">Cell controller CC1</text><text class="fe-tick" x="385" y="56" text-anchor="middle">level 2 · rules 1–4 every minute</text>`;
  const bmax = Math.max(1, Math.round(num($("f5Jb").value, CS.job_buffer_max)));
  s += `<text class="fe-tick" x="300" y="92">job buffer (max ${bmax})</text>`;
  for (let i = 0; i < Math.min(bmax, 8); i++) s += sn.buf[i] ? chip(300 + i * 46, 98, sn.buf[i], "f5-cjob") : `<rect class="f5-slot" x="${300 + i * 46}" y="98" width="40" height="20" rx="4"/>`;
  s += `<text class="fe-tick" x="490" y="22">outbox – confirmations waiting for the MES (${sn.out.length})</text>`;
  sn.out.slice(0, 8).forEach((j, i) => { s += chip(490 + i * 48, 28, "C·" + j, "f5-cconf", 44); });
  if (sn.out.length > 8) s += `<text class="fe-tick" x="${490 + 8 * 48}" y="42">+${sn.out.length - 8}</text>`;
  // track
  s += `<line class="f5-track" x1="${LSX - 30}" y1="${TY}" x2="${MX[2] + 50}" y2="${TY}"/>`;
  // machines
  sn.m.forEach((m, i) => {
    const x = MX[i] - 70, y = 132, rem = m.st === "Execute" ? m.end - tf : m.st === "Held" ? m.rem : null;
    s += `<line class="f5-drop" x1="${MX[i]}" y1="${y + 74}" x2="${MX[i]}" y2="${TY}"/><rect class="f5-mach ${st[m.st] || "f5-idle"}" x="${x}" y="${y}" width="140" height="74" rx="8"/>
      <text class="f5-bt" x="${MX[i]}" y="${y + 18}" text-anchor="middle">${m.n}</text><text class="f5-mt" x="${MX[i]}" y="${y + 36}" text-anchor="middle">${m.st}${m.res && m.st === "Idle" ? " (reserved)" : ""}</text>
      <text class="fe-tick" x="${MX[i]}" y="${y + 52}" text-anchor="middle">${m.pal ? `${m.pal} · ${m.job}` : "–"}</text>${rem != null ? `<text class="fe-tick" x="${MX[i]}" y="${y + 67}" text-anchor="middle">${fx(Math.max(0, rem), 0)} min left${m.st === "Held" ? " (frozen)" : ""}</text>` : ""}
      ${m.flt ? `<rect class="f5-flt" x="${x + 96}" y="${y - 9}" width="50" height="18" rx="4"/><text class="f5-ct f5-fltt" x="${x + 121}" y="${y + 4}" text-anchor="middle">FAULT</text>` : ""}`;
  });
  // load station, queue, ready
  s += `<line class="f5-drop" x1="${LSX}" y1="${TY}" x2="${LSX}" y2="262"/><rect class="f5-mach ${sn.ls ? "f5-load" : "f5-idle"}" x="${LSX - 60}" y="262" width="120" height="58" rx="8"/><text class="f5-bt" x="${LSX}" y="280" text-anchor="middle">Load station LS</text>`;
  if (sn.ls) { const fr = Math.max(0, Math.min(1, (tf - sn.ls.start) / (sn.ls.end - sn.ls.start))); s += `<text class="fe-tick" x="${LSX}" y="296" text-anchor="middle">loading ${sn.ls.p} · ${sn.ls.job}</text><rect class="f5-slot" x="${LSX - 48}" y="304" width="96" height="8" rx="3"/><rect class="f5-prog" x="${LSX - 48}" y="304" width="${(96 * fr).toFixed(1)}" height="8" rx="3"/>`; }
  else s += `<text class="fe-tick" x="${LSX}" y="298" text-anchor="middle">${sn.q.length ? (sn.buf.length ? "free" : "waiting for a job") : "free – no pallet"}</text>`;
  s += `<text class="fe-tick" x="16" y="340">queue at LS:</text>`; sn.q.slice(0, 9).forEach((p, i) => { s += chip(96 + i * 34, 328, p, "f5-cpal", 30); });
  s += `<text class="fe-tick" x="210" y="262">READY (loaded, waiting for a machine):</text>`; sn.ready.slice(0, 6).forEach((p, i) => { s += chip(210 + i * 34, 268, p, "f5-cready", 30); });
  // vehicle
  let vx = LSX, lab = "free";
  const pos = (n) => (n === "LS" ? LSX : MX[CS.machines.indexOf(n)]);
  if (sn.veh) { const fr = Math.max(0, Math.min(1, (tf - sn.veh.start) / (sn.veh.end - sn.veh.start))); vx = pos(sn.veh.f) + (pos(sn.veh.to) - pos(sn.veh.f)) * fr; lab = sn.veh.p; }
  else { const last = J.sim.snaps.slice(0, sn.t + 1).reverse().find((x) => x.veh); if (last) vx = pos(last.veh.to); }
  s += `<rect class="f5-veh${sn.veh ? " f5-vehon" : ""}" x="${(vx - 24).toFixed(1)}" y="${TY - 13}" width="48" height="26" rx="5"/><text class="f5-ct" x="${vx.toFixed(1)}" y="${TY + 4}" text-anchor="middle">${esc(lab)}</text>`;
  s += `<text class="fe-tick" x="${MX[2] + 50}" y="${TY + 30}" text-anchor="end">vehicle: ${sn.veh ? `${sn.veh.p} ${sn.veh.f} → ${sn.veh.to} (arrives ${sn.veh.end})` : "free"}</text>`;
  $("f5JPlant").innerHTML = s;
}

/* ================================================================== 5K architecture availability */
const AV = EX5.availability;
function html5K() {
  return card("f55K", "5K · Architecture availability – how often does the control system stop the whole cell?", "series / parallel reliability blocks · MES outage vs local job buffer · edit MTBF / MTTR",
    guide({
      principle: `<p>Every device in the <b>control chain</b> (network switch → cell controller → cell PLC …) can fail. If any one of them stops, the whole cell stops – the devices are in
        <b>series</b>. A redundant pair (two cell controllers, a switch ring) works as long as one of the two works – the devices are <b>parallel</b>.</p>
        <p class="phd-eq">A = MTBF ÷ (MTBF + MTTR) &nbsp;·&nbsp; series: A = A₁ × A₂ × … &nbsp;·&nbsp; parallel (independent): A = 1 − (1 − A₁)(1 − A₂)… &nbsp;·&nbsp; downtime = (1 − A) × ${AV.hours_year} h/year</p>
        <p>The weakest block dominates: a PC with MTTR 8 h (no spare on site) costs more availability than a PLC with MTBF 100 000 h. Redundancy helps only if failures are
        <b>independent</b> (separate power supply, no common software bug) and the switch-over works – test it at the SAT.</p>
        <p><b>MES outages</b> are handled differently: the cell does not stop at once because it has a <b>local job buffer</b> of b hours of work (5J). With outages of exponential
        length (mean = MTTR of the MES), only the part of an outage longer than b costs production:</p>
        <p class="phd-eq">f = ${AV.hours_year} ÷ (MTBF + MTTR) outages/year &nbsp;·&nbsp; P(outage &gt; b) = e<sup>−b/MTTR</sup> &nbsp;·&nbsp; expected loss = f × MTTR × e<sup>−b/MTTR</sup> h/year</p>`,
      uses: USES5.K,
      howto: ["Draw the control chain of your architecture variant (5E) as blocks: which device failure stops the whole cell? Only those are in the series chain.",
        "Ask the suppliers for MTBF (or failure rate) and agree the MTTR with maintenance: MTTR = detection + travel + spare part + repair + restart.",
        "Compare the variants in h/year and in money (lost hours × contribution per hour) against the cost of the redundancy.",
        "Size the local job buffer with the MES table: e.g. 2 h of buffered jobs when the MES MTTR is 4 h; check with the cell simulation (5J scenario B).",
        "Remember what the formula does not cover: common-cause failures, software errors, planned updates – add a margin or model them separately."],
    }) + `
    <div class="grid2"><div><h3 class="fe-h3">Components <span class="sub">editable</span></h3><div class="fe-scroll"><table class="am-tab fe-calc f5-small" id="f5AvC"></table></div>
      <div class="fe-row"><button class="mx-el" id="f5AvRst">Reset to example</button></div></div>
      <div><h3 class="fe-h3">Own variant – series of parallel blocks</h3><div id="f5AvB"></div>
      <div class="fe-row"><button class="mx-el" id="f5AvAdd">+ Block</button></div></div></div>
    <h3 class="fe-h3">Variants compared</h3><div id="f5AvRes"></div>
    <svg id="f5AvG" class="fe-chart" role="img" aria-label="Control downtime per year for each variant"></svg>
    <h3 class="fe-h3">MES outage and local job buffer</h3>
    <div class="grid2"><div id="f5MbT"></div><div><svg id="f5MbG" class="fe-chart" role="img" aria-label="Expected production loss per year versus job buffer hours"></svg><div class="sub" id="f5MbLg"></div></div></div>
    ${wx("single vs redundant cell controller (example values)", ["Core switch: A = 50 000 ÷ 50 002 = 0.99996; cell PC: 20 000 ÷ 20 008 = 0.99960; cell PLC: 100 000 ÷ 100 004 = 0.99996.",
      "Variant 1 (all single, series): A = 0.99996 × 0.99960 × 0.99996 = 0.99952 → downtime (1 − 0.99952) × 8760 = 4.20 h/year. The PC alone causes 3.5 h of it.",
      "Variant 2: switch pair 1 − 0.00004² ≈ 1.0000000; PC pair 1 − 0.0004² = 0.99999984; PLC single 0.99996 → A = 0.99996 → 0.35 h/year – now the single PLC dominates.",
      "MES: f = 8760 ÷ 8004 = 1.094 outages/year, MTTR 4 h → without buffer 1.094 × 4 = 4.38 h/year lost; with b = 2 h: × e^(−0.5) = 2.66 h; with b = 8 h: × e^(−2) = 0.59 h."])}`);
}
let avComps = null, avOwn = null;
function init5K() {
  avComps = store.get("comps", clone(AV.components)); avOwn = store.get("own", clone(AV.variants[1].chain));
  const save = () => { store.set("comps", avComps); store.set("own", avOwn); };
  $("f5AvC").addEventListener("input", (e) => { const i = e.target.dataset.i, k = e.target.dataset.k; if (i == null) return; avComps[+i][+k] = Math.max(0.0001, num(e.target.value, avComps[+i][+k])); save(); drawAv(false); });
  $("f5AvRst").addEventListener("click", () => { store.del("comps"); store.del("own"); avComps = clone(AV.components); avOwn = clone(AV.variants[1].chain); drawAv(true); });
  $("f5AvB").addEventListener("change", (e) => { const i = e.target.dataset.b; if (i == null) return; if (e.target.dataset.f === "c") avOwn[+i][0] = e.target.value; else avOwn[+i][1] = Math.max(1, Math.round(num(e.target.value, 1))); save(); drawAv(false); });
  $("f5AvB").addEventListener("click", (e) => { const b = e.target.closest("[data-del]"); if (b) { avOwn.splice(+b.dataset.del, 1); save(); drawAv(true); } });
  $("f5AvAdd").addEventListener("click", () => { avOwn.push([avComps[0][0], 1]); save(); drawAv(true); });
  drawAv(true);
}
function drawAv(full) {
  if (full) {
    $("f5AvC").innerHTML = `<thead><tr><th>Component</th><th>MTBF h</th><th>MTTR h</th><th>A</th><th>downtime h/y alone</th></tr></thead><tbody>${avComps.map((c, i) => `<tr><td>${esc(c[0])}</td><td><input type="number" step="any" data-i="${i}" data-k="1" value="${c[1]}"></td><td><input type="number" step="any" data-i="${i}" data-k="2" value="${c[2]}"></td><td id="f5AvA${i}"></td><td id="f5AvD${i}"></td></tr>`).join("")}</tbody>`;
    $("f5AvB").innerHTML = avOwn.map((b, i) => `<div class="fe-row f5-blk"><span class="sub">block ${i + 1}</span><select data-b="${i}" data-f="c">${avComps.map((c) => `<option${c[0] === b[0] ? " selected" : ""}>${esc(c[0])}</option>`).join("")}</select>
      <label>× <input type="number" min="1" max="4" step="1" data-b="${i}" data-f="n" value="${b[1]}"> in parallel</label><button class="mx-el fx-x" data-del="${i}" aria-label="remove block">✕</button></div>`).join("") || '<p class="sub">No block – add one.</p>';
  }
  avComps.forEach((c, i) => { const a = aOf(c[1], c[2]); $("f5AvA" + i).textContent = fx(a, 6); $("f5AvD" + i).textContent = fx((1 - a) * AV.hours_year, 2); });
  const vs = [...AV.variants.map((v) => ({ name: v.name, chain: v.chain })), { name: "Own variant", chain: avOwn }].map((v) => ({ ...v, ...availVariant(v.chain, avComps, AV.hours_year) }));
  $("f5AvRes").innerHTML = tab(["Variant", "Blocks (component × parallel → block A)", "A", "Downtime h/year", "min/year"], vs.map((v) => `<tr><td><b>${esc(v.name)}</b></td><td class="sub">${v.blocks.map((b) => `${esc(b.name)} ×${b.n} → ${fx(b.ab, 7)}`).join(" · ")}</td><td>${fx(v.A, 7)}</td><td><b>${fx(v.down, 2)}</b></td><td>${fx(v.down * 60, 0)}</td></tr>`), "f5-small");
  const mx = Math.max(0.5, ...vs.map((v) => v.down)) * 1.1, W = 1000, rh = 34, H = vs.length * rh + 30;
  let s = ""; vs.forEach((v, i) => { const y = 8 + i * rh, w = v.down / mx * (W - 360); s += `<text class="fe-tick" x="236" y="${y + 17}" text-anchor="end">${esc(v.name.length > 38 ? v.name.slice(0, 37) + "…" : v.name)}</text><rect class="f5-bar f5-s${i + 1}" x="242" y="${y + 4}" width="${Math.max(1, w).toFixed(1)}" height="${rh - 12}" rx="3"/><text class="fe-tick" x="${(248 + w).toFixed(1)}" y="${y + 18}">${fx(v.down, 2)} h/year</text>`; });
  s += `<text class="fe-axis" x="242" y="${H - 6}">control downtime per year (stops the whole cell)</text>`;
  $("f5AvG").setAttribute("viewBox", `0 0 ${W} ${H}`); $("f5AvG").innerHTML = s;
  // MES buffer
  const mes = avComps.find((c) => c[0] === "MES server"), pts = AV.mes_buffer_h.map((b) => mesLoss(avComps, AV.hours_year, b));
  $("f5MbT").innerHTML = `<p class="sub">MES server MTBF ${fx(mes[1], 0)} h, MTTR ${fx(mes[2], 1)} h → f = ${fx(pts[0].f, 4)} outages/year, mean ${fx(mes[2], 1)} h each.</p>` +
    tab(["Buffer b [h]", "P(outage > b)", "Expected loss h/year", "Saved vs b = 0"], pts.map((p) => `<tr><td>${p.b}</td><td>${fx(p.p, 4)}</td><td><b>${fx(p.loss, 3)}</b></td><td>${fx(pts[0].loss - p.loss, 3)} h</td></tr>`), "f5-small f5-num");
  const curve = []; for (let b = 0; b <= 8.0001; b += 0.1) curve.push([b, mesLoss(avComps, AV.hours_year, b).loss]);
  $("f5MbLg").innerHTML = chart($("f5MbG"), { series: [{ pts: curve, cls: "f5-s1", n: "expected loss f·MTTR·e^(−b/MTTR)" }, { pts: pts.map((p) => [p.b, p.loss]), cls: "f5-s2", dots: true, noline: true, n: "example buffer sizes" }], xmin: 0, xmax: 8, ymax: Math.max(0.5, pts[0].loss * 1.1), xl: "local job buffer b [h]", yl: "loss h/year" });
}

/* ================================================================== 5L alarm management */
const AL = EX5.alarm_log;
function html5L() {
  return card("f55L", "5L · Alarm management – ISA-18.2 KPIs, rationalisation and ISA-101 displays", "alarm log of one shift (shared example) · EEMUA 191 targets · lifecycle checklist",
    guide({
      principle: `<p>An <b>alarm</b> is a signal that <b>needs an operator action</b> within a certain time. Everything else is an event or a message. Too many alarms are dangerous:
        in an <b>alarm flood</b> the operator cannot see the one important alarm. ISA-18.2 (IEC 62682) and EEMUA 191 define a lifecycle and KPIs to keep the alarm system usable.</p>
        <p class="phd-eq">windows of 10 min: [0, 600), [600, 1200) … s · average = alarms ÷ hours ÷ operators · flood = window with &gt; 10 alarms · chattering = same tag ≥ 3 times within 60 s</p>
        ${ul(["Average per operator: <b>≤ 6 alarms/h</b> (about 1 per 10 min) acceptable, ≤ 12 manageable, more = overloaded.",
          "Peak: &gt; 10 alarms in 10 min = flood; target: less than 1 % of the windows in flood.",
          "Priority distribution target: <b>low 80 %, medium 15 %, high 5 %</b> – if many alarms are 'high', priority means nothing.",
          "Bad actors: the top 5–10 tags usually give 50 % of all alarms – fix them first (dead band, delay, suppression, repair the sensor)."])}
        <p><b>ISA-101</b> gives the rules for the HMI: a display hierarchy (level 1 overview → level 4 diagnosis), grey normal states, colour only for abnormal situations, alarms visible on every display.</p>`,
      uses: USES5.L,
      howto: ["Write the alarm philosophy before the HMI is designed (definitions, priorities, colours, KPIs, roles) – it is a 10–20 page document.",
        "Rationalise every alarm with the template below in a workshop (operator, process engineer, maintenance) – remove alarms without an action.",
        "Use state-based suppression: no consequential alarms (clamp pressure low of every machine) when the root alarm (air pressure low) is active; no alarms from a module in Manual / Stopped.",
        "Export the alarm log every week and run the KPIs (this card or tools/fmse/alarm_kpi.py) – top 5 bad actors go to maintenance.",
        "Demand from every machine supplier: ISA-18.2 priorities, first-out alarm, alarm number ranges per module, time stamps from a synchronised clock."],
    }) + `
    <div class="fe-row"><span class="sub">Alarm log (t_s, tag, priority 1 high / 2 medium / 3 low) – one alarm per line:</span><button class="mx-el" id="f5AlRst">Reset to example</button><span id="f5AlMsg" class="sub"></span></div>
    <div class="grid2"><div><textarea id="f5AlTa" class="f5-ta" rows="10" spellcheck="false" aria-label="Alarm log"></textarea></div><div id="f5AlK"></div></div>
    <svg id="f5AlH" class="fe-chart" role="img" aria-label="Alarms per 10-minute window over the shift"></svg><div class="sub" id="f5AlHLg"></div>
    <div class="grid2"><div><h4>Priority distribution vs target</h4><svg id="f5AlP" class="fe-chart" role="img" aria-label="Priority distribution compared with the 80/15/5 target"></svg><div class="sub" id="f5AlPLg"></div></div>
      <div><h4>Top-5 bad actors and chattering tags</h4><div id="f5AlT"></div><div id="f5AlV"></div></div></div>
    <h3 class="fe-h3">ISA-18.2 lifecycle checklist <span class="sub" id="f5LcN"></span></h3>
    <div class="f5-chk" id="f5Lc">${ALARM_LIFE.map((r, i) => `<label class="f5-ck"><input type="checkbox" data-lc="${i}"><span><b>${r[0]} · ${esc(r[1])}</b> – ${esc(r[2])}</span></label>`).join("")}</div>
    <div class="grid2"><div><h3 class="fe-h3">Priority matrix helper</h3>
      <div class="fe-row"><label>Consequence <select id="f5PmC">${CONSEQ.map((c, i) => `<option value="${i}"${i === 1 ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
        <label>Time to respond <select id="f5PmT">${TRESP.map((c, i) => `<option value="${i}"${i === 2 ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></label></div>
      <div id="f5PmR"></div><div class="fe-scroll"><table class="am-tab f5-small f5-pm" id="f5PmTab"></table></div>
      <p class="sub">* Safety functions are never only an alarm – they are done by the safety system (SIL / PL). Example matrix – each plant fixes its own in the alarm philosophy.</p></div>
      <div><h3 class="fe-h3">ISA-101 display hierarchy</h3><div class="f5-isa">${ISA101.map((r) => `<div class="fx-box"><h4>Level ${r[0]} · ${esc(r[1])}</h4><svg class="f5-sk" viewBox="0 0 240 90" role="img" aria-label="Sketch of level ${r[0]} display">${isaSketch(r[0])}</svg><p class="sub">${esc(r[2])}</p><p>${esc(r[3])}</p></div>`).join("")}</div></div></div>
    <h3 class="fe-h3">Alarm rationalisation template <button class="mx-el fx-x" id="f5RatCsv">CSV</button></h3>
    ${tab(RAT_HEAD.map(esc), RAT_ROWS.map((r) => `<tr>${r.map((c, i) => `<td>${i ? esc(c) : `<code>${esc(c)}</code>`}</td>`).join("")}</tr>`), "f5-small")}
    ${wx("the flood at 7 800 s", ["UTIL1.AirPressLow (high) comes at 7 800 s. Within 300 s 14 more alarms follow: clamp pressure low at 3 machines + pool + LS, 3 APC faults, 3 feed holds, pool stopped, job aborted.",
      "Window [7 800, 8 400) has 15 alarms &gt; 10 → <b>flood</b>. It is 1 of 48 windows = 2.08 % (target &lt; 1 %).",
      "13 of them are <b>consequences</b> of the air pressure: rationalisation says 'no separate action' → suppress them while UTIL1.AirPressLow is active. Then the window has 2 alarms.",
      "WASH1.LevelHigh comes 6 times in 60 s (16 200 … 16 260 s) → <b>chattering</b>: add a 10 s on-delay and 2 % dead band → 1 alarm.",
      "After both measures: 39 − 13 − 5 = 21 alarms per shift = 2.6 /h, no flood."])}`);
}
function isaSketch(l) {
  const r = (x, y, w, h, c = "f5-skb") => `<rect class="${c}" x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>`;
  if (l === 1) return r(4, 4, 232, 14, "f5-skh") + [0, 1, 2, 3, 4, 5].map((i) => r(8 + i * 38, 28, 32, 26, i === 1 ? "f5-ska" : "f5-skb")).join("") + r(8, 62, 108, 22, "f5-skb") + r(124, 62, 108, 22, "f5-skb");
  if (l === 2) return r(4, 4, 232, 14, "f5-skh") + r(8, 26, 120, 58, "f5-skb") + r(136, 26, 96, 26, "f5-skb") + `<polyline class="f5-skl" points="140,78 160,70 180,74 200,62 228,66"/>`;
  if (l === 3) return r(4, 4, 232, 14, "f5-skh") + r(8, 26, 70, 58, "f5-skb") + `<circle class="f5-ska" cx="120" cy="54" r="16"/><polyline class="f5-skl" points="150,80 165,40 180,60 195,35 228,50"/>`;
  return r(4, 4, 232, 14, "f5-skh") + [0, 1, 2, 3, 4].map((i) => `<line class="f5-skl" x1="10" x2="${200 - i * 20}" y1="${30 + i * 12}" y2="${30 + i * 12}"/>`).join("") + r(200, 28, 30, 50, "f5-skb");
}
function parseAlarms(txt) {
  const out = [], bad = [];
  txt.split(/\r?\n/).forEach((l, i) => { const s = l.trim(); if (!s || s[0] === "#") return; const p = s.split(/[,;\t]/).map((x) => x.trim()); const t = parseFloat(p[0]), pr = parseInt(p[2], 10); if (!Number.isFinite(t) || !p[1] || ![1, 2, 3].includes(pr)) bad.push(i + 1); else out.push([t, p[1], pr]); });
  return { out, bad };
}
function init5L() {
  const def = AL.alarms.map((a) => a.join(", ")).join("\n"), ta = $("f5AlTa");
  ta.value = store.get("alarms", def);
  ta.addEventListener("input", () => { store.set("alarms", ta.value); drawAl(); });
  $("f5AlRst").addEventListener("click", () => { store.del("alarms"); ta.value = def; drawAl(); });
  const lc = store.get("life", {}), cnt = () => { const n = document.querySelectorAll("#f5Lc input:checked").length; $("f5LcN").textContent = `${n} of ${ALARM_LIFE.length} stages done in your project`; };
  document.querySelectorAll("#f5Lc [data-lc]").forEach((c) => { c.checked = !!lc[c.dataset.lc]; });
  $("f5Lc").addEventListener("change", (e) => { const c = e.target; if (c.dataset.lc == null) return; const s = store.get("life", {}); s[c.dataset.lc] = c.checked; store.set("life", s); cnt(); }); cnt();
  const pm = () => {
    const c = +$("f5PmC").value, t = +$("f5PmT").value, p = PRIO_M[t][c], name = { 0: "no alarm – event / message only", 1: "HIGH (1)", 2: "MEDIUM (2)", 3: "LOW (3)" }[p];
    $("f5PmR").innerHTML = `<p class="fe-big">→ <b>${name}</b></p>`;
    $("f5PmTab").innerHTML = `<thead><tr><th>Time to respond ↓ / consequence →</th>${CONSEQ.map((x) => `<th>${esc(x.split(" (")[0])}</th>`).join("")}</tr></thead><tbody>${TRESP.map((tr, i) => `<tr><td>${tr}</td>${CONSEQ.map((x, j) => `<td class="f5-p${PRIO_M[i][j]}${i === t && j === c ? " f5-sel" : ""}">${["–", "high", "medium", "low"][PRIO_M[i][j]]}</td>`).join("")}</tr>`).join("")}</tbody>`;
  };
  $("f5PmC").addEventListener("change", pm); $("f5PmT").addEventListener("change", pm); pm();
  $("f5RatCsv").addEventListener("click", () => download("alarm_rationalisation_template.csv", toCSV([RAT_HEAD, ...RAT_ROWS]), "text/csv"));
  R.alarms = (() => { const k = alarmKPI(AL); return { n: k.n, avg: k.avg, peak: k.peak, floodWindows: k.flood, floodPct: rnd(k.floodPct, 4), prio: k.prio, sharePct: { low: rnd(k.share.low * 100, 2), medium: rnd(k.share.medium * 100, 2), high: rnd(k.share.high * 100, 2) }, chatter: k.chatter, top5: k.top5.map((x) => [x.tag, x.n]), verdictAvg: k.verdictAvg, verdictPeak: k.verdictPeak }; })();
  drawAl();
}
function drawAl() {
  const { out, bad } = parseAlarms($("f5AlTa").value);
  $("f5AlMsg").innerHTML = bad.length ? `<span class="fe-no">lines ignored (format): ${bad.slice(0, 8).join(", ")}${bad.length > 8 ? " …" : ""}</span>` : `${out.length} alarms read`;
  if (!out.length) { $("f5AlK").innerHTML = '<p class="sub">No alarms.</p>'; return; }
  const k = alarmKPI({ ...AL, alarms: out });
  $("f5AlK").innerHTML = kpis([["alarms in the shift", k.n], ["average alarms / h / operator", fx(k.avg, 3), k.avg > 12 ? "fe-no" : k.avg > 6 ? "f5-warnc" : "fe-ok"], ["peak per 10 min", k.peak, k.peak > 10 ? "fe-no" : ""],
    [`flood windows (> 10) of ${k.nW}`, `${k.flood} = ${fx(k.floodPct, 2)} %`, k.flood ? "fe-no" : "fe-ok"], ["chattering tags", k.chatter.length, k.chatter.length ? "f5-warnc" : "fe-ok"], ["top-5 share of all alarms", fx(k.top5.reduce((a, x) => a + x.share, 0) * 100, 1) + " %"]]);
  $("f5AlHLg").innerHTML = chart($("f5AlH"), { series: [{ pts: k.win.map((v, i) => [i, v]), bars: true, cls: "f5-s1", n: "alarms per 10-min window", hi: (i) => k.win[i] > 10 }], xmin: -0.5, xmax: k.nW - 0.5, ymax: Math.max(12, k.peak + 1), xl: "10-min window number (0 = shift start)", yl: "alarms", hmarks: [[10, "f5-flood", "flood limit 10"], [1, "f5-tgt", "target ≈ 1 per 10 min"]], W: 1000, H: 260 }) + ' <span class="fx-lg"><i class="f5-lg f5-barhi"></i>flood window</span>';
  const act = [k.share.low, k.share.medium, k.share.high].map((x) => x * 100), tgt = [80, 15, 5];
  $("f5AlPLg").innerHTML = chart($("f5AlP"), { series: [{ pts: act.map((v, i) => [i, v]), bars: true, cls: "f5-s1", n: "actual %", dx: -14 }, { pts: tgt.map((v, i) => [i, v]), bars: true, cls: "f5-s3", n: "target %", dx: 14 }], xmin: -0.6, xmax: 2.6, ymax: 100, xl: "priority: 0 = low (3) · 1 = medium (2) · 2 = high (1)", yl: "% of alarms", W: 420, H: 240, bw: 26, xfmt: (v) => ["low", "medium", "high"][v] || "" });
  $("f5AlT").innerHTML = tab(["#", "Tag", "Count", "Share", "Chattering"], k.top5.map((x, i) => `<tr><td>${i + 1}</td><td><code>${esc(x.tag)}</code></td><td>${x.n}</td><td>${fx(x.share * 100, 1)} %</td><td>${k.chatter.includes(x.tag) ? '<span class="fe-no">yes</span>' : "–"}</td></tr>`), "f5-small");
  $("f5AlV").innerHTML = `<h4>Verdicts</h4>${ul([`Average ${fx(k.avg, 3)} /h → <b>${k.verdictAvg}</b> (≤ 6 acceptable, ≤ 12 manageable).`, `Peak ${k.peak} in window ${k.peakW} (${k.peakW * 600}–${k.peakW * 600 + 600} s) → <b>${k.verdictPeak}</b>; ${fx(k.floodPct, 2)} % of windows in flood (target &lt; 1 %).`,
    `Priorities low / medium / high = ${fx(act[0], 1)} / ${fx(act[1], 1)} / ${fx(act[2], 1)} % vs 80 / 15 / 5 % → ${act[2] > 5 || act[1] > 15 ? "<b>too many high / medium alarms</b> – re-rationalise priorities" : "OK"}.`,
    k.chatter.length ? `Chattering: <b>${k.chatter.map(esc).join(", ")}</b> → on-delay / dead band.` : "No chattering tag."])}`;
}

/* ================================================================== 5M robustness patterns */
function html5M() {
  return card("f55M", "5M · Robustness patterns – what keeps the cell running when messages, links or computers fail", "time-outs · idempotent messages · store-and-forward · heartbeat · restart · deadlock · message catalogue",
    guide({
      principle: `<p>In a cell many computers talk to each other over a network. Messages get <b>lost</b>, arrive <b>twice</b>, arrive <b>late</b>; computers <b>restart</b>; links go <b>down</b>.
        The control system must be designed so that none of this causes a wrong action or a blocked cell. Six patterns cover most cases:</p>
        ${ul(["<b>Time-out + retry</b>: never wait for an answer forever; after n failed tries go to a defined error state and alarm.",
          "<b>Idempotent messages</b>: every message has a unique ID; the receiver remembers processed IDs, so a repeated message does nothing the second time.",
          "<b>Store-and-forward</b>: outgoing messages are written to a local outbox first and sent when the link is up (5J outbox).",
          "<b>Heartbeat / watchdog</b>: partners exchange a counter every second; if it stops changing for the watchdog time, the partner is treated as dead.",
          "<b>Restart recovery</b>: after a restart, the real state of the plant is read and compared with the saved state (reconciliation) before automatic operation continues.",
          "<b>Deadlock avoidance</b>: in pallet systems with limited places, keep at least one place free, otherwise the transport can block for ever."])}`,
      uses: USES5.M,
      howto: ["For every interface write into the message catalogue: time-out, number of retries, idempotency key, what happens after the last retry.",
        "Use database transactions: 'state change + outbox entry' in one transaction – then a crash never loses or doubles a confirmation.",
        "Test at the FAT: pull the network cable for 10 s and for 10 min, kill the cell-controller process, power-cycle one PLC – the cell must recover without manual data repair.",
        "Set heartbeat time-outs from the reaction time needed (e.g. 3 s) – not so short that a busy network causes false trips.",
        "Calculate the maximum pallets in a closed system (places − 1) and enforce it in the cell controller, not only in the operator instructions."],
    }) + `
    <div class="grid2 eq"><div class="fx-box"><h4>1 · Time-out and retry</h4>
      <div class="fe-row"><label>Time-out <input type="number" id="f5ToT" value="5" min="0.1" step="any"> s</label><label>Retries <input type="number" id="f5ToN" value="3" min="0" max="10" step="1"></label><label>Back-off factor <input type="number" id="f5ToK" value="2" min="1" step="any"></label></div>
      <svg id="f5ToG" class="fe-chart" viewBox="0 0 520 90" role="img" aria-label="Time line of attempts and time-outs"></svg><div id="f5ToR"></div></div>
    <div class="fx-box"><h4>2 · Idempotent messages – duplicate demo</h4>
      <p class="sub">The cell sends confirmations; after a time-out it re-sends the same message (same ID). After a restart the whole outbox is re-sent.</p>
      <div class="fe-row"><label><input type="checkbox" id="f5IdOn" checked> receiver keeps a list of processed message IDs</label><button class="mx-el" id="f5IdDup">+ re-send last message</button><button class="mx-el" id="f5IdRst">Reset</button></div>
      <div id="f5IdR"></div></div></div>
    <div class="grid2 eq"><div class="fx-box"><h4>3 · Store-and-forward</h4>
      <p>Confirmations are not sent directly. They go into a local <b>outbox</b> (a database table) and a sender loop transmits them in order when the link is up; an entry is deleted only after the receiver's acknowledgement.
      In 5J scenario B the MES is down for 90 min: up to <b>${simB.K.maxout}</b> confirmations wait in the outbox and all ${simB.K.sent} are sent – none lost, order kept.</p>
      <div class="fe-row"><button class="mx-el" id="f5SfGo">Show it in 5J (scenario B)</button></div>
      <p class="sub">Design rules: outbox entry and state change in one transaction · send in order of creation · receiver idempotent (pattern 2) · alarm if the outbox is older than x minutes.</p></div>
    <div class="fx-box"><h4>4 · Heartbeat / watchdog – live</h4>
      <div class="fe-row"><label>Period <input type="number" id="f5HbP" value="1" min="0.2" step="any"> s</label><label>Watchdog <input type="number" id="f5HbW" value="3" min="0.5" step="any"> s</label><button class="mx-el" id="f5HbCut">Cut the link</button></div>
      <div id="f5HbLive" class="f5-hb"></div><div id="f5HbR" class="sub"></div></div></div>
    <h3 class="fe-h3">5 · Restart recovery – reconciliation checklist <span class="sub" id="f5RsN"></span></h3>
    <div class="f5-chk" id="f5Rs">${RESTART.map((r, i) => `<label class="f5-ck"><input type="checkbox" data-rs="${i}"><span>${i + 1}. ${esc(r)}</span></label>`).join("")}</div>
    <h3 class="fe-h3">6 · Deadlock in a pallet system</h3>
    <div class="fx-prin"><p>Model: one load station (1 place), a pool with P places, M machines (1 place each). A loaded pallet goes LS → machine (or pool → machine); a finished pallet goes machine → LS (or machine → pool → LS),
      where it is unloaded and loaded again. The stacker moves a pallet only into a <b>free</b> place. New pallets come from a pallet store into the LS.
      The program searches <b>all reachable states</b> (breadth-first search) – if a state without any possible move exists, the system can block.
      Rule “keep ≥ 1 free place”: a new pallet may enter only if afterwards at least one of the 1 + P + M places stays free (pallets in the system ≤ P + M).</p></div>
    <div class="fe-row"><label>Pallets N <input type="number" id="f5DlN" value="6" min="1" max="30" step="1"></label><label>Pool places P <input type="number" id="f5DlP" value="3" min="0" max="20" step="1"></label><label>Machines M <input type="number" id="f5DlM" value="2" min="1" max="8" step="1"></label>
      <label><input type="checkbox" id="f5DlR"> rule “keep ≥ 1 free place”</label></div>
    <div class="grid2"><div id="f5DlRes"></div><div><svg id="f5DlG" class="fe-chart" viewBox="0 0 520 170" role="img" aria-label="Blocked state of the pallet system"></svg><div id="f5DlTab"></div></div></div>
    <h3 class="fe-h3">Message catalogue template <button class="mx-el fx-x" id="f5MsgCsv">CSV</button></h3>
    ${tab(MSG_HEAD.map(esc), MSG_ROWS.map((r) => `<tr>${r.map((c, i) => `<td>${i === 1 ? `<b>${esc(c)}</b>` : esc(c)}</td>`).join("")}</tr>`), "f5-small")}
    ${wx("deadlock with 3 pool places and 2 machines", ["Places in the loop = 1 (LS) + 3 (pool) + 2 (machines) = 6.",
      "Without the rule and N = 6 pallets: the search finds a blocked state – LS holds a loaded pallet, pool full of loaded pallets waiting for a machine, both machines hold finished pallets that want to go to the LS or the pool. Nobody can move.",
      "With N = 5 (= P + M) there is always one free place – the search finds no blocked state. The rule 'keep ≥ 1 free place' lets the 6th pallet wait in the pallet store.",
      "Real systems: the cell controller counts pallets per closed area and refuses a new pallet (or a new job) when the count reaches places − 1; the same idea is used for AGV zones and conveyor loops."])}`);
}
const ID = { msgs: null, on: true };
const ID0 = [["CONF-J01-1", "J01"], ["CONF-J02-1", "J02"], ["CONF-J02-1", "J02"], ["CONF-J03-1", "J03"], ["CONF-J01-1", "J01"]];
const HB = { t0: 0, cut: null, timer: null };
function init5M() {
  const to = () => {
    const T = Math.max(0.1, num($("f5ToT").value, 5)), n = Math.max(0, Math.round(num($("f5ToN").value, 3))), k = Math.max(1, num($("f5ToK").value, 2));
    const att = []; let t = 0; for (let i = 0; i <= n; i++) { const d = T * k ** i; att.push([t, d]); t += d; }
    const X = (v) => 10 + v / t * 500;
    $("f5ToG").innerHTML = att.map(([a, d], i) => `<rect class="f5-gb ${i === n ? "f5-held" : "f5-mv"}" x="${X(a).toFixed(1)}" y="20" width="${Math.max(1, X(a + d) - X(a) - 2).toFixed(1)}" height="26" rx="3"/><text class="f5-gt" x="${((X(a) + X(a + d)) / 2).toFixed(1)}" y="34" text-anchor="middle">${i ? "retry " + i : "try"}</text><text class="fe-tick" x="${X(a).toFixed(1)}" y="62">${fx(a, 1)}</text>`).join("") + `<text class="fe-tick" x="510" y="62" text-anchor="end">${fx(t, 1)} s → error state + alarm</text>`;
    $("f5ToR").innerHTML = `<p class="phd-eq">worst-case detection = Σ T·kⁱ (i = 0 … n) = ${att.map((a) => fx(a[1], 1)).join(" + ")} = <b>${fx(t, 1)} s</b></p><p class="sub">Rule of thumb: time-out ≥ 3 × the normal answer time; the total must be shorter than the time the process can wait (e.g. the next pallet change).</p>`;
  };
  ["f5ToT", "f5ToN", "f5ToK"].forEach((id) => $(id).addEventListener("input", to)); to();
  ID.msgs = clone(ID0);
  const idDraw = () => {
    const seen = new Set(), rows = ID.msgs.map(([mid, job], i) => { const dup = seen.has(mid); seen.add(mid); const booked = !(ID.on && dup); return { i, mid, job, dup, booked }; });
    const nb = rows.filter((r) => r.booked).length, jobs = new Set(ID.msgs.map((m) => m[1])).size;
    $("f5IdR").innerHTML = tab(["#", "Message ID", "Job", "Duplicate?", "Booked in MES"], rows.map((r) => `<tr class="${r.dup && r.booked ? "f5-badrow" : ""}"><td>${r.i + 1}</td><td><code>${r.mid}</code></td><td>${r.job}</td><td>${r.dup ? "yes" : "–"}</td><td>${r.booked ? (r.dup ? '<span class="fe-no">booked again!</span>' : "booked") : '<span class="fe-ok">ignored (already processed)</span>'}</td></tr>`), "f5-small") +
      `<p>${ID.msgs.length} messages, ${jobs} real confirmations → MES booked <b>${nb}</b> ${nb === jobs ? ok(true, "correct", "") : ok(false, "", `${nb - jobs} double bookings (parts counted twice)`)}</p>`;
  };
  $("f5IdOn").addEventListener("change", () => { ID.on = $("f5IdOn").checked; idDraw(); });
  $("f5IdDup").addEventListener("click", () => { ID.msgs.push(clone(ID.msgs[ID.msgs.length - 1])); idDraw(); });
  $("f5IdRst").addEventListener("click", () => { ID.msgs = clone(ID0); idDraw(); });
  idDraw();
  $("f5SfGo").addEventListener("click", () => { jSetScenario("B"); const c = $("f55J"); if (c) c.scrollIntoView({ behavior: "smooth", block: "start" }); });
  // heartbeat live demo (setInterval runs only while the card is visible)
  HB.t0 = performance.now();
  $("f5HbCut").addEventListener("click", () => { if (HB.cut == null) { HB.cut = performance.now(); $("f5HbCut").textContent = "Restore the link"; } else { HB.cut = null; HB.t0 = performance.now(); $("f5HbCut").textContent = "Cut the link"; } hbTick(); });
  HB.timer = setInterval(hbTick, 200);
  const rs = store.get("restart", {}), rc = () => { $("f5RsN").textContent = `${document.querySelectorAll("#f5Rs input:checked").length} of ${RESTART.length} done`; };
  document.querySelectorAll("#f5Rs [data-rs]").forEach((c) => { c.checked = !!rs[c.dataset.rs]; });
  $("f5Rs").addEventListener("change", (e) => { const c = e.target; if (c.dataset.rs == null) return; const s = store.get("restart", {}); s[c.dataset.rs] = c.checked; store.set("restart", s); rc(); }); rc();
  ["f5DlN", "f5DlP", "f5DlM", "f5DlR"].forEach((id) => $(id).addEventListener("input", drawDl)); drawDl();
  $("f5MsgCsv").addEventListener("click", () => download("message_catalogue_template.csv", toCSV([MSG_HEAD, ...MSG_ROWS]), "text/csv"));
}
function hbTick() {
  const el = $("f5HbLive");
  if (!el || !document.body.contains(el)) { clearInterval(HB.timer); return; }
  if (!live(el)) return;   // card hidden: no work
  const P = Math.max(0.2, num($("f5HbP").value, 1)), W = Math.max(0.5, num($("f5HbW").value, 3)), now = performance.now();
  const until = HB.cut != null ? HB.cut : now, cnt = Math.floor((until - HB.t0) / 1000 / P) % 65536;
  const lastChange = HB.t0 + Math.floor((until - HB.t0) / 1000 / P) * P * 1000, since = (now - lastChange) / 1000, dead = since > W;
  el.innerHTML = `<span>Module counter <b>${cnt}</b></span><span>unchanged for ${fx(since, 1)} s</span><span class="${dead ? "fe-no" : "fe-ok"}"><b>${dead ? "WATCHDOG: partner lost → module to safe state, alarm" : "partner alive"}</b></span>`;
  $("f5HbR").innerHTML = `Detection delay after a link loss: between W − P = ${fx(W - P, 1)} s and W = ${fx(W, 1)} s. The counter (not a constant TRUE bit) also detects a frozen program that still holds the old value.`;
}
function drawDl() {
  const N = Math.max(1, Math.round(num($("f5DlN").value, 6))), P = Math.max(0, Math.round(num($("f5DlP").value, 3))), M = Math.max(1, Math.round(num($("f5DlM").value, 2))), rule = $("f5DlR").checked;
  if (N + P + M > 60) { $("f5DlRes").innerHTML = '<p class="fe-no">Too large for the exhaustive search (keep N + P + M ≤ 60).</p>'; return; }
  const r = deadlockBFS(N, P, M, rule), places = 1 + P + M;
  $("f5DlRes").innerHTML = kpis([["places in the loop (1 + P + M)", places], ["pallets N", N], ["reachable states searched", r.states], ["blocked states", r.dead.length, r.dead.length ? "fe-no" : "fe-ok"]]) +
    `<p class="fe-big">${r.dead.length ? `<span class="fe-no">✗ The system CAN block</span> – shortest way into the deadlock: ${r.path.length} moves.` : `<span class="fe-ok">✓ No blocked state is reachable</span>${rule && N > P + M ? ` – the rule keeps ${N - (P + M)} pallet(s) in the store.` : ""}`}</p>
    <p class="sub">${N <= P + M ? `N ≤ P + M = ${P + M}: there is always a free place, so a deadlock is impossible even without the rule.` : rule ? `Rule on: at most ${P + M} pallets in the loop.` : `N ≥ ${P + M + 1} and no rule: all ${places} places can be filled.`}</p>`;
  const show = r.dead.length ? r.dead[0] : null;
  const s0 = show || [0, 0, 0, 0, 0], [st, ls, pf, m, pd] = s0;
  let s = `<text class="fe-tick" x="8" y="14">${show ? "blocked state (no move possible):" : "no blocked state – example: all places shown empty"}</text>`;
  const box = (x, y, lab, filled, cls) => `<rect class="f5-dlp ${filled ? cls : ""}" x="${x}" y="${y}" width="34" height="26" rx="4"/>${lab ? `<text class="f5-ct" x="${x + 17}" y="${y + 17}" text-anchor="middle">${lab}</text>` : ""}`;
  s += `<text class="fe-tick" x="8" y="44">LS</text>` + box(8, 50, ls ? "L" : "", ls, "f5-dll");
  s += `<text class="fe-tick" x="70" y="44">pool (${P})</text>`; for (let i = 0; i < Math.min(P, 10); i++) s += box(70 + i * 38, 50, i < pf ? "L" : i < pf + pd ? "F" : "", i < pf + pd, i < pf ? "f5-dll" : "f5-dlf");
  s += `<text class="fe-tick" x="70" y="102">machines (${M})</text>`; for (let i = 0; i < Math.min(M, 10); i++) s += box(70 + i * 38, 108, i < m ? "F" : "", i < m, "f5-dlf");
  s += `<text class="fe-tick" x="8" y="102">store</text><text class="f5-bt" x="20" y="128">${st}</text><text class="fe-tick" x="8" y="160">L = loaded, wants a machine · F = finished, wants the LS</text>`;
  $("f5DlG").innerHTML = s;
  $("f5DlTab").innerHTML = r.path.length ? tab(["#", "Move", "store", "LS", "pool L", "machines", "pool F"], r.path.map(([lab, v], i) => `<tr><td>${i + 1}</td><td>${esc(lab)}</td>${v.map((x) => `<td>${x}</td>`).join("")}</tr>`), "f5-small f5-num") : "";
}

/* ================================================================== results for tests / cross-checks */
function results() {
  const N = EX5.naming, tags = checkTags(N.test_tags), db = dbTags(), dbv = checkTags(db.map((r) => r.tag));
  const av = AV.variants.map((v) => { const r = availVariant(v.chain, AV.components, AV.hours_year); return { name: v.name, A: rnd(r.A, 7), down_h: rnd(r.down, 3) }; });
  const mb = AV.mes_buffer_h.map((b) => { const r = mesLoss(AV.components, AV.hours_year, b); return { b, p: rnd(r.p, 4), loss_h: rnd(r.loss, 3) }; });
  const k = alarmKPI(AL), pk = EX5.packml_scenarios.map((s) => { const r = packRun(s.mode, s.cmds); return { name: s.name, end: r.end, rejected: r.rejected }; });
  return {
    packml: pk,
    tags: { verdicts: tags.map((t) => ({ tag: t.tag, ok: t.ok, rule: t.kind.join(", ") || "OK" })), valid: tags.filter((t) => t.ok).length, errors: tags.filter((t) => !t.ok).length },
    datablock: { total: db.length, standard: db.filter((r) => r.part === "standard").length, module: db.filter((r) => r.part === "module").length, valid: dbv.filter((t) => t.ok).length, longest: Math.max(...db.map((r) => r.tag.length)) },
    availability: av, mesBuffer: mb,
    alarms: { n: k.n, avg_per_h: rnd(k.avg, 4), peak: k.peak, flood_windows: k.flood, flood_pct: rnd(k.floodPct, 2), share_pct: { low: rnd(k.share.low * 100, 1), medium: rnd(k.share.medium * 100, 1), high: rnd(k.share.high * 100, 1) }, chattering: k.chatter, top5: k.top5.map((x) => [x.tag, x.n]), verdictAvg: k.verdictAvg, verdictPeak: k.verdictPeak },
    cellA: { ...simA.K, logLines: simA.log.length, first11: simA.log.slice(0, 11) }, cellB: { ...simB.K, logLines: simB.log.length },
    logA: simA.log, logB: simB.log,
    errors: R.errors || [],
  };
}
