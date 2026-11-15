/* FMS engineering – item 7: electrical & safety principles.  Loaded by fmse.js (build "7").
 * 7A power distribution & load list (+ single-line) · 7B cable sizing (ampacity, PE, voltage drop, fault loop, L_max, Ik1 chart)
 * 7C 24 V control power (budget, PSU, ECB channels, line drop) · 7D cabinet thermal (IEC 60890 surface, fan / cooling unit)
 * 7E risk assessment ISO 12100 + risk graph → PLr · 7F ISO 13849-1 PL calculator (MTTFd, DCavg, CCF, Table 11)
 * 7G safety distances ISO 13855 + guard locking ISO 14119.   7H–7N (zones, drive functions, circuits, standards, tests, cases,
 * checklists) live in fmse7x.js.
 * Example numbers: EX7 in fmse7_data.js = copy of tools/fmse/examples/item7_examples.json; formulas = EX7._formulas exactly
 * (same as guide docs/FMS system design/67_electrical_safety.md and tools/fmse/*.py).
 * Offline; user edits in localStorage keys "fmse.7.*". Test hook: window.fe7.results() (always from the JSON defaults),
 * window.fe7.now() (from the values currently on the page). */
import { EX7 } from "./fmse7_data.js";

/* ------------------------------------------------------------------ helpers (exported for fmse7x.js) */
export const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const fx = (x, d = 1) => (Number.isFinite(x) ? x.toLocaleString("en", { maximumFractionDigits: d, minimumFractionDigits: d }) : "–");
export const rnd = (x, d = 6) => (Number.isFinite(x) ? +x.toFixed(d) : null);
export const clone = (o) => JSON.parse(JSON.stringify(o));
export const num = (v, d = 0) => { const x = parseFloat(v); return Number.isFinite(x) ? x : d; };
export const store = {   // own keys "fmse.7.<k>"
  get(k, d) { try { const v = localStorage.getItem("fmse.7." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("fmse.7." + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  del(k) { try { localStorage.removeItem("fmse.7." + k); } catch (e) { /* storage blocked */ } },
};
export const ul = (a) => `<ul class="am-ul">${a.map((x) => `<li>${x}</li>`).join("")}</ul>`;   // trusted HTML written in these files
export const ok = (b, y, n) => (b ? `<span class="fe-ok">✓ ${y}</span>` : `<span class="fe-no">✗ ${n}</span>`);
export const card = (id, title, sub, body) => `<div class="card" id="${id}"><div class="card-head"><h2>${title}</h2><span class="sub">${sub}</span></div>${body}</div>`;
export const tab = (head, rows, cls = "") => `<div class="fe-scroll"><table class="am-tab ${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
export const kv = (rows) => `<table class="am-kv f7-kv"><tbody>${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join("")}</tbody></table>`;
export const kpis = (a) => `<div class="phd-kpis">${a.map(([n, v, c]) => `<div class="phd-kpi"><b class="${c || ""}">${v}</b><span>${n}</span></div>`).join("")}</div>`;
export const intro = (html) => `<div class="fx-guide"><div class="fx-prin">${html}</div></div>`;
export const useCase = (t) => `<p class="am-note f7-use"><b>Use case in an FMS:</b> ${t}</p>`;
export const getP = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
export const setP = (o, p, v) => { const ks = p.split("."), last = ks.pop(); const t = ks.reduce((a, k) => a[k], o); t[last] = v; };
const SQ3 = Math.sqrt(3);
const sum = (a) => a.reduce((s, x) => s + x, 0);
// number-input table bound to a state path: rows [key, label, unit, step]
const inTab = (path, obj, rows) => `<table class="am-kv f7-kv f7-in"><tbody>${rows.map(([k, n, u, st]) => `<tr><td>${n}</td><td><input type="number" step="${st || "any"}" data-p="${path}.${k}" value="${esc(obj[k])}"> <span class="sub">${u || ""}</span></td></tr>`).join("")}</tbody></table>`;
const cellIn = (path, v, w) => `<input type="${typeof v === "string" ? "text" : "number"}" step="any" data-p="${path}" value="${esc(v)}" class="${w || "f7-n"}">`;

/* ================================================================== pure calculations (exact formulas of EX7._formulas) */
export function calcLoad(L) {
  const rows = L.loads.map(([n, q, p, ku, c]) => { const Pd = q * p * ku; return { n, Pd, Qd: Pd * Math.tan(Math.acos(c)) }; });
  const P = sum(rows.map((r) => r.Pd)), Q = sum(rows.map((r) => r.Qd)), S0 = Math.hypot(P, Q);
  const S = L.ks * S0, cos = P / S0, I = S * 1000 / (SQ3 * L.U), Sreq = S * L.growth;
  const T = L.transformer_sizes.find((s) => s >= Sreq) || null;
  const Ik3 = L.plant_transformer_kVA * 1000 / (SQ3 * L.U * L.uk);
  return { rows, P, Q, S, cos, I, Sreq, T, loading: T ? S / T : NaN, Ik3 };
}
export function calcMotor(m) {
  const In = m.P_kW * 1000 / (SQ3 * m.U * m.eta * m.cosphi);
  return { In, dol: m.k_start * In, yd: m.k_start * In / 3 };
}
export function calcCable(c) {
  const kk = c.k_temp * c.k_group, req = c.In / kk;
  const row = c.ampacity_table.find(([, iz]) => iz >= req) || null;
  const A = row ? row[0] : NaN, IzT = row ? row[1] : NaN, Izc = IzT * kk;
  const sizes = c.ampacity_table.map((r) => r[0]);
  const Ape = !row ? NaN : A <= 16 ? A : A <= 35 ? 16 : (sizes.find((s) => s >= A / 2) || A);
  const cond = c.Ib <= c.In && c.In <= Izc + 1e-9;
  const dU = SQ3 * c.Ib * c.L * c.rho * c.cosphi / A, dUp = dU / c.U * 100, lim = c.dU_limit == null ? 5 : c.dU_limit;
  const rpm = c.rho * (1 / A + 1 / Ape);   // loop resistance per metre of route
  const Rloop = c.L * rpm, Zs = c.Z_ext + Rloop, Ik1 = c.U0 / Zs, Ia = c.m * c.In;
  const Lmax = (c.U0 / Ia - c.Z_ext) / rpm;
  return { req, A, IzT, Izc, Ape, cond, dU, dUp, dUok: dUp <= lim, lim, Rloop, Zs, Ik1, Ia, ikOk: Ik1 >= Ia, Lmax, rpm };
}
export function calcDC(d) {
  const rows = d.loads.map(([n, I, q, sim, ch]) => ({ n, ch, I: I * q * sim }));
  const total = sum(rows.map((r) => r.I)), need = total * d.reserve;
  const psu = d.psu_sizes.find((s) => s >= need - 1e-9) || null;
  const chans = [...new Set(rows.map((r) => r.ch))].sort().map((ch) => {
    const I = sum(rows.filter((r) => r.ch === ch).map((r) => r.I)), nd = I * d.reserve;
    return { ch, I, need: nd, rating: d.ecb_ratings.find((r) => r >= nd - 1e-9) || null };
  });
  const l = d.line, dU = 2 * l.L * l.I * l.rho / l.A, Uload = d.U_psu - dU;
  const Lmax = (d.U_psu - d.U_min) * l.A / (2 * l.I * l.rho);
  return { rows, total, need, psu, chans, dU, Uload, lineOk: Uload >= d.U_min, Lmax };
}
export function calcCab(c) {
  const { W, H, D } = c;
  const A = c.mounting === "free" ? 1.8 * H * (W + D) + 1.4 * W * D : 1.4 * W * (H + D) + 1.8 * D * H;
  const P = sum(c.losses.map((r) => r[1]));
  const cases = c.Ta_cases.map((Ta) => {
    const Pnat = c.k * A * (c.Ti - Ta), Q = P - Pnat;
    if (Q <= 0) return { Ta, Pnat, Q, kind: "none", V: 0, cool: 0 };
    if (Ta < c.Ti - 5) return { Ta, Pnat, Q, kind: "fan", V: 3.1 * Q / (c.Ti - Ta), cool: 0 };
    return { Ta, Pnat, Q, kind: "cooling", V: 0, cool: Q };
  });
  return { A, P, cases };
}
/* --- safety */
export const PLS = ["a", "b", "c", "d", "e"];
const plIdx = (p) => PLS.indexOf(p);
export const RG = { S1F1P1: "a", S1F1P2: "b", S1F2P1: "b", S1F2P2: "c", S2F1P1: "c", S2F1P2: "d", S2F2P1: "d", S2F2P2: "e" };
export const plr = (S, F, P) => RG[S + F + P];
export function comp([name, B10d, dop, hop, tc, DC]) {
  const nop = dop * hop * 3600 / tc;
  return { name, nop, mttfd: B10d / (0.1 * nop), t10d: B10d / nop, DC };
}
export const mttfBand = (x) => { x = rnd(x, 6); return x < 3 ? "none" : x < 10 ? "low" : x < 30 ? "medium" : "high"; };
export const dcBand = (x) => { x = rnd(x, 6); return x < 60 ? "none" : x < 90 ? "low" : x < 99 ? "medium" : "high"; };
export function ccfScore(applied) { return sum(EX7.safety.ccf_measures.filter(([n]) => applied.includes(n)).map((r) => r[1])); }
export function subsys(s, ccf) {
  if (s.pl) return { cert: true, pl: s.pl };
  const ch = s.channels.map((c) => c.map(comp));
  const chM = ch.map((c) => 1 / sum(c.map((k) => 1 / k.mttfd)));
  const mt = chM.length === 1 ? chM[0] : (2 / 3) * (chM[0] + chM[1] - 1 / (1 / chM[0] + 1 / chM[1]));
  const capped = Math.min(100, mt), mb = mttfBand(capped);
  const all = ch.flat();
  const dc = sum(all.map((k) => k.DC / k.mttfd)) / sum(all.map((k) => 1 / k.mttfd)), db = dcBand(dc);
  const cat = String(s.cat);
  let col = null, why = "";
  if (cat === "B" || cat === "1") col = "none";
  else if (cat === "2" || cat === "3") { col = db === "low" ? "low" : db === "medium" || db === "high" ? "medium" : null; if (!col) why = "DCavg < 60 % is not allowed for Cat " + cat; }
  else if (cat === "4") { col = db === "high" ? "high" : null; if (!col) why = "Cat 4 needs DCavg ≥ 99 %"; }
  let pl = null;
  if (col) { const r = EX7.safety.pl_table[cat + "|" + col]; pl = r ? r[mb] || null : null; if (pl === "n/a") { pl = null; why = `Cat ${cat} with MTTFd ${mb} is not allowed`; } }
  if (mb === "none") { pl = null; why = "MTTFd below 3 years"; }
  if (pl && ["2", "3", "4"].includes(cat) && ccf < 65) { pl = null; why = `CCF score ${ccf} < 65 required for Cat ${cat}`; }
  return { cert: false, ch, chM, mt, capped, mb, dc, db, col, cat, pl, why };
}
export function combine(pls) {
  if (pls.some((p) => !p)) return null;
  const low = pls.reduce((m, p) => (plIdx(p) < plIdx(m) ? p : m), "e"), N = pls.filter((p) => p === low).length;
  return { a: N <= 3 ? "a" : null, b: N <= 2 ? "b" : "a", c: N <= 2 ? "c" : "b", d: N <= 3 ? "d" : "c", e: N <= 3 ? "e" : "d" }[low];
}
export function evalSF(f, ccf) {
  const r = plr(f.S, f.F, f.P), subs = f.subsystems.map((s) => subsys(s, ccf)), pl = combine(subs.map((s) => s.pl));
  return { id: f.id, plr: r, subs, pl, ok: !!pl && plIdx(pl) >= plIdx(r) };
}
export function distance(c) {
  const T = sum(c.times.map((t) => t[1]));
  let S, K, C = 0, Z = 0, note = "";
  if (c.type === "aopd" && c.d <= 40) {
    K = 2000; C = 8 * (c.d - 14); S = 2000 * T + C;
    if (S < 100) { S = 100; note = "S < 100 mm → 100 mm"; }
    if (S > 500) { K = 1600; S = 1600 * T + C; note = "2000·T + C > 500 mm → recalculated with K = 1600"; if (S < 500) { S = 500; note += ", < 500 → 500 mm"; } }
  } else if (c.type === "aopd" || c.type === "multibeam") { K = 1600; C = 850; S = 1600 * T + 850; note = c.type === "aopd" ? "d > 40 mm → body detection" : "multi-beam → body detection"; }
  else if (c.type === "scanner") { K = 1600; C = Math.max(850, 1200 - 0.4 * c.H); Z = c.Z; S = 1600 * T + C + Z; }
  else { K = 1600; C = c.covered ? 0 : 250; S = 1600 * T + C; }
  return { T, K, C, Z, S, note };
}
export const guardLock = ([hz, ts, dist]) => { const ta = dist / 1600; return { hz, ts, dist, ta, req: ts > ta }; };
export const RANK = { "-": -1, RUN: 0, SLS: 1, SS1: 2, STO: 3 };
export function evalZones(Z, active) {
  const on = (i) => active.includes(i);
  const fired = Z.rows.filter((r) => r.all_of.every(on) && r.none_of.every((i) => !on(i))).map((r) => r.id);
  return evalOut(Z, fired);
}
export function evalOut(Z, fired) {
  const out = {};
  Z.outputs.forEach((o) => { let a = "RUN"; Z.rows.filter((r) => fired.includes(r.id)).forEach((r) => { const x = r.act[o] || "-"; if (RANK[x] > RANK[a]) a = x; }); out[o] = a; });
  return { fired, out, run: Z.outputs.filter((o) => out[o] === "RUN").length };
}

/* ------------------------------------------------------------------ all key numbers (for tests / the lead's cross-check) */
function allResults(src, ccfApplied) {
  const L = calcLoad(src.load_list), m = calcMotor(src.motor), c = calcCable(src.cable), d = calcDC(src.dc24), k = calcCab(src.cabinet);
  const ccf = ccfScore(ccfApplied);
  const sf = src.safety.functions.map((f) => evalSF(f, ccf));
  return {
    load: { P_kW: rnd(L.P, 3), Q_kvar: rnd(L.Q, 3), S_kVA: rnd(L.S, 3), cosphi: rnd(L.cos, 4), I_A: rnd(L.I, 2), S_req: rnd(L.Sreq, 2), transformer_kVA: L.T, loading: rnd(L.loading, 3), Ik3_A: rnd(L.Ik3, 0) },
    motor: { In: rnd(m.In, 3), dol: rnd(m.dol, 2), star_delta: rnd(m.yd, 2) },
    cable: { req_Iz: rnd(c.req, 2), A: c.A, Iz_table: c.IzT, Iz_corr: rnd(c.Izc, 2), A_pe: c.Ape, cond: c.cond, dU_V: rnd(c.dU, 3), dU_pct: rnd(c.dUp, 3), R_loop: rnd(c.Rloop, 4), Zs: rnd(c.Zs, 4), Ik1_A: rnd(c.Ik1, 1), Ia_A: c.Ia, ik_ok: c.ikOk, L_max: rnd(c.Lmax, 2) },
    dc24: { I_load: rnd(d.total, 3), I_need: rnd(d.need, 3), psu_A: d.psu, channels: d.chans.map((h) => [h.ch, rnd(h.I, 3), h.rating]), line_dU: rnd(d.dU, 3), U_load: rnd(d.Uload, 3), line_ok: d.lineOk, L_max: rnd(d.Lmax, 2) },
    cabinet: { A_m2: rnd(k.A, 3), P_loss: k.P, cases: k.cases.map((x) => ({ Ta: x.Ta, P_nat: rnd(x.Pnat, 2), Q: rnd(x.Q, 2), kind: x.kind, fan_m3h: rnd(x.V, 1), cooling_W: rnd(x.cool, 2) })) },
    ccf: { score: ccf, cases: src.safety.ccf_cases.map((x) => [x.name, ccfScore(x.applied)]) },
    safety: sf.map((r) => ({ id: r.id, PLr: r.plr, PL: r.pl, ok: r.ok,
      subs: r.subs.map((s) => (s.cert ? { pl: s.pl, cert: true } : { pl: s.pl, ch: s.chM.map((x) => rnd(x, 2)), mttfd: rnd(s.mt, 2), capped: rnd(s.capped, 2), band: s.mb, dcavg: rnd(s.dc, 2), dc_band: s.db })) })),
    distances: src.safety.distance_cases.map((x) => { const r = distance(x); return [x.name.split(" ")[0], rnd(r.T, 3), rnd(r.S, 1)]; }),
    guard_locking: src.safety.guard_locking.map((g) => { const r = guardLock(g); return [g[0], rnd(r.ta, 3), r.req]; }),
    zones: src.safety.zones.scenarios.map(([n, a]) => { const r = evalZones(src.safety.zones, a); return [n, r.fired.join("+") || "–", r.run]; }),
  };
}
export const results = () => allResults(EX7, EX7.safety.ccf_cases[0].applied);
function now() {
  const src = clone(EX7);
  src.load_list = S.load; src.motor = S.motor; src.cable = S.cable; src.dc24 = S.dc24; src.cabinet = S.cab;
  src.safety.functions = S.sf.functions; src.safety.distance_cases = S.dist.cases; src.safety.guard_locking = S.dist.gl;
  return allResults(src, S.sf.ccf);
}

/* ------------------------------------------------------------------ state */
const DEF = {
  load: clone(EX7.load_list), motor: clone(EX7.motor), cable: Object.assign(clone(EX7.cable), { dU_limit: 5 }), dc24: clone(EX7.dc24), cab: clone(EX7.cabinet),
  risk: { S: "S2", F: "F2", P: "P1" },
  sf: { sel: "SF1", ccf: clone(EX7.safety.ccf_cases[0].applied), functions: clone(EX7.safety.functions) },
  dist: { sel: 0, cases: clone(EX7.safety.distance_cases), gl: clone(EX7.safety.guard_locking) },
};
export const S = {};
function loadState() { Object.keys(DEF).forEach((k) => { const v = store.get(k, null); S[k] = v && typeof v === "object" ? Object.assign(clone(DEF[k]), v) : clone(DEF[k]); }); }
const save = (k) => store.set(k, S[k]);
function resetSec(k) { store.del(k); S[k] = clone(DEF[k]); }
function bindIn(id, key, redraw) {   // delegated input → state path → save → redraw outputs (inputs keep focus)
  $(id).addEventListener("input", (e) => {
    const t = e.target; if (!t.dataset.p) return;
    setP(S, t.dataset.p, t.type === "checkbox" ? t.checked : t.type === "number" ? num(t.value) : t.value); save(key); redraw();
  });
}
const R = {};

/* ================================================================== mount */
export function mount(el) {
  loadState();
  el.innerHTML = htmlTop() + [html7A(), html7B(), html7C(), html7D(), html7E(), html7F(), html7G()].join("");
  [init7A, init7B, init7C, init7D, init7E, init7F, init7G].forEach((f) => { try { f(); } catch (e) { console.error("fmse7 " + f.name, e); R.errors = (R.errors || []).concat(f.name + ": " + e.message); } });
  window.fe7 = { results, now, R, calc: { calcLoad, calcMotor, calcCable, calcDC, calcCab, evalSF, subsys, combine, distance, guardLock, evalZones, plr, ccfScore } };
  const deepEl = document.createElement("div"); deepEl.id = "feItem7x"; el.appendChild(deepEl);
  import("./fmse7x.js").then((m) => m.mount(deepEl)).catch((e) => { deepEl.innerHTML = `<div class="card"><p class="fe-no">Sections 7H–7N could not load: ${esc(e.message)}</p></div>`; });
}

function htmlTop() {
  return `<div class="card f7-warnbox"><p><b>Example values only.</b> Every number on this page is a teaching example (shared with guide 67 and the
    Python tools, file <code>tools/fmse/examples/item7_examples.json</code>). Tables marked "example table" must be checked against the
    <b>current edition</b> of the standard used in your project (IEC 60364, IEC 60204-1, IEC 60890 / IEC 61439, ISO 12100, ISO 13849-1/-2,
    ISO 13855, ISO 14119, ISO 13850, IEC 62061 …) and against the manufacturers' data. A real electrical and safety design must be done,
    checked and <b>signed off by qualified, responsible persons</b> (electrical designer, safety engineer, CE responsible person).</p></div>`;
}

/* ================================================================== 7A power distribution & load list */
function html7A() {
  return card("f77A", "7A · Power distribution & load list", "from the list of consumers to the transformer, short-circuit current and motor currents · example cell: 3 HMC machining FMS",
    intro(`<p>Every FMS starts the electrical design with a <b>load list</b>: all consumers with installed power, how much of it is really used
      (<b>utilisation factor k<sub>u</sub></b>) and their power factor <b>cos φ</b>. Not all machines run at full power at the same time, so the sum is
      multiplied by a <b>simultaneity factor k<sub>s</sub></b>. A growth reserve gives the size of the supply.</p>
      <p class="phd-eq">P<sub>d</sub> = qty · P · k<sub>u</sub> · Q<sub>d</sub> = P<sub>d</sub> · tan(acos cos φ) · S = k<sub>s</sub> · √(ΣP² + ΣQ²) · I = S·1000 ÷ (√3 · U) · S<sub>req</sub> = S · growth</p>
      <p>The cell is fed from the <b>plant transformer</b>. Its short-circuit current at the low-voltage side is the worst case every breaker and
      every panel must withstand (breaking capacity I<sub>cu</sub> ≥ I<sub>k3</sub>, panel SCCR ≥ I<sub>k3</sub>):</p>
      <p class="phd-eq">I<sub>k3</sub> = S<sub>T</sub> · 1000 ÷ (√3 · U · u<sub>k</sub>) &nbsp;·&nbsp; motor I<sub>n</sub> = P·1000 ÷ (√3 · U · η · cos φ) · DOL start = k<sub>start</sub>·I<sub>n</sub> · star-delta = k<sub>start</sub>·I<sub>n</sub> ÷ 3</p>`) +
    `<div class="fe-row"><button class="mx-el" id="f7ARst">Reset to example values</button><button class="mx-el" id="f7AAdd">+ add load</button></div>
    <div id="f7ATab"></div>
    <div class="grid2">
      <div><h3 class="fe-h3">Supply parameters</h3><div id="f7APar"></div><h3 class="fe-h3">Motor example</h3><div id="f7AMot"></div></div>
      <div><h3 class="fe-h3">Results</h3><div id="f7ARes"></div></div>
    </div>
    <h3 class="fe-h3">Single-line diagram (simplified)</h3>
    <div class="fe-scroll"><svg id="f7ASld" class="fe-chart f7-wide" viewBox="0 0 720 330" role="img" aria-label="Single-line diagram: plant transformer, main board, cell board, module cabinets"></svg></div>` +
    useCase(`the owner's engineer sends the load list to the plant electrical department 6–12 months before installation – they check the free
      capacity of the plant transformer, reserve a feeder in the main low-voltage board and tell the integrator the short-circuit current
      (here I<sub>k3</sub> ≈ 24 kA) so that every module cabinet is ordered with breakers and an SCCR that are high enough.`));
}
const LOAD_PAR = [["U", "Line voltage U", "V"], ["ks", "Simultaneity factor k<sub>s</sub>", ""], ["growth", "Growth reserve", "×"], ["uk", "Transformer u<sub>k</sub>", "(0.06 = 6 %)"], ["plant_transformer_kVA", "Plant transformer S<sub>T</sub>", "kVA"]];
const MOT_PAR = [["P_kW", "Motor power P", "kW"], ["U", "Voltage U", "V"], ["eta", "Efficiency η", ""], ["cosphi", "cos φ", ""], ["k_start", "Starting current factor k<sub>start</sub>", "× I<sub>n</sub>"]];
function init7A() {
  const drawTab = () => {
    $("f7ATab").innerHTML = tab(["Load", "Qty", "P each kW", "k<sub>u</sub>", "cos φ", "P<sub>d</sub> kW", "Q<sub>d</sub> kvar", ""],
      S.load.loads.map((r, i) => `<tr>${r.map((v, j) => `<td>${cellIn(`load.loads.${i}.${j}`, v, j ? "f7-n" : "f7-t")}</td>`).join("")}<td class="f7-r" id="f7APd${i}"></td><td class="f7-r" id="f7AQd${i}"></td><td><button class="mx-el f7-mini" data-del="${i}" title="delete row">✕</button></td></tr>`), "f7-small");
    draw();
  };
  const draw = () => {
    const L = calcLoad(S.load), m = calcMotor(S.motor);
    L.rows.forEach((r, i) => { const a = $("f7APd" + i), b = $("f7AQd" + i); if (a) a.textContent = fx(r.Pd, 2); if (b) b.textContent = fx(r.Qd, 2); });
    $("f7ARes").innerHTML = kpis([["P total kW", fx(L.P, 1)], ["S kVA (with k<sub>s</sub>)", fx(L.S, 1)], ["I at " + S.load.U + " V", fx(L.I, 1) + " A"], ["I<sub>k3</sub> plant transformer", fx(L.Ik3 / 1000, 2) + " kA"]]) +
      kv([["ΣP / ΣQ", `${fx(L.P, 3)} kW / ${fx(L.Q, 3)} kvar`], ["S = k<sub>s</sub>·√(P²+Q²)", fx(L.S, 3) + " kVA"], ["cos φ total", fx(L.cos, 4) + (L.cos < 0.9 ? ' <span class="sub">(&lt; 0.9: check power-factor correction of the plant)</span>' : "")],
        ["Current I", fx(L.I, 2) + " A"], ["S<sub>req</sub> = S · growth", fx(L.Sreq, 2) + " kVA"],
        ["Dedicated cell transformer would be", L.T ? `<b>${L.T} kVA</b> (loading S/S<sub>T</sub> = ${fx(L.loading, 3)})` : '<span class="fe-no">larger than the size list</span>'],
        ["I<sub>k3</sub> at the plant transformer (" + S.load.plant_transformer_kVA + " kVA)", `<b>${fx(L.Ik3, 0)} A</b> → breakers I<sub>cu</sub> ≥ ${fx(Math.ceil(L.Ik3 / 1000), 0)} kA, cabinets SCCR ≥ ${fx(Math.ceil(L.Ik3 / 1000), 0)} kA`],
        ["Motor " + S.motor.P_kW + " kW: I<sub>n</sub>", fx(m.In, 3) + " A"], ["Start current DOL / star-delta", `${fx(m.dol, 2)} A / ${fx(m.yd, 2)} A <span class="sub">(VFD: ≈ I<sub>n</sub>, no inrush)</span>`]]);
    drawSld(L);
  };
  $("f7APar").innerHTML = inTab("load", S.load, LOAD_PAR);
  $("f7AMot").innerHTML = inTab("motor", S.motor, MOT_PAR);
  bindIn("f7ATab", "load", draw); bindIn("f7APar", "load", draw); bindIn("f7AMot", "motor", draw);
  $("f7ATab").addEventListener("click", (e) => { const b = e.target.closest("[data-del]"); if (!b) return; S.load.loads.splice(+b.dataset.del, 1); save("load"); drawTab(); });
  $("f7AAdd").addEventListener("click", () => { S.load.loads.push(["New load", 1, 5, 0.5, 0.85]); save("load"); drawTab(); });
  $("f7ARst").addEventListener("click", () => { resetSec("load"); resetSec("motor"); $("f7APar").innerHTML = inTab("load", S.load, LOAD_PAR); $("f7AMot").innerHTML = inTab("motor", S.motor, MOT_PAR); drawTab(); });
  drawTab();
}
function drawSld(L) {
  const n = Math.max(1, L.rows.length), x0 = 40, x1 = 700, dx = (x1 - x0) / n;
  let s = `<text x="20" y="18" class="fe-axis">MV network</text><line x1="110" y1="12" x2="110" y2="34" class="f7-w"/>
    <circle cx="110" cy="46" r="12" class="f7-sym"/><circle cx="110" cy="62" r="12" class="f7-sym"/>
    <text x="130" y="50" class="f7-lbl">Plant transformer ${esc(S.load.plant_transformer_kVA)} kVA, u<tspan baseline-shift="sub" font-size="8">k</tspan> ${fx(S.load.uk * 100, 1)} %</text>
    <line x1="110" y1="74" x2="110" y2="96" class="f7-w"/><line x1="40" y1="96" x2="420" y2="96" class="f7-bus"/>
    <text x="430" y="100" class="f7-lbl">Main LV board · I<tspan baseline-shift="sub" font-size="8">k3</tspan> = ${fx(L.Ik3 / 1000, 1)} kA</text>
    <line x1="300" y1="96" x2="300" y2="150" class="f7-w"/><rect x="292" y="112" width="16" height="16" class="f7-sym"/><line x1="292" y1="128" x2="308" y2="112" class="f7-w"/>
    <text x="316" y="125" class="f7-lbl">cell feeder ≥ ${fx(Math.ceil(L.I / 10) * 10, 0)} A · cable (7B)</text>
    <line x1="${x0}" y1="150" x2="${x1}" y2="150" class="f7-bus"/><text x="${x0}" y="144" class="f7-lbl">Cell distribution board · S = ${fx(L.S, 1)} kVA · I = ${fx(L.I, 1)} A</text>`;
  L.rows.forEach((r, i) => {
    const cx = x0 + dx * (i + 0.5);
    s += `<line x1="${cx}" y1="150" x2="${cx}" y2="226" class="f7-w"/><rect x="${cx - 6}" y="166" width="12" height="12" class="f7-sym"/>
      <rect x="${cx - dx / 2 + 4}" y="226" width="${dx - 8}" height="40" rx="4" class="f7-box"/>
      <text x="${cx}" y="244" text-anchor="middle" class="f7-sm">${esc(String(r.n).slice(0, Math.max(5, Math.floor(dx / 6))))}</text>
      <text x="${cx}" y="258" text-anchor="middle" class="f7-sm">${fx(r.Pd, 1)} kW</text>`;
  });
  s += `<text x="${x0}" y="290" class="f7-sm">Each module cabinet: main switch (IEC 60204-1) · own breakers · 24 V PSU (7C) · safety relays / safety PLC IO (7F) · cooling (7D)</text>
    <text x="${x0}" y="306" class="f7-sm">Earthing system TN-S: separate PE and N from the main board – one equipotential bonding bar per cabinet</text>`;
  $("f7ASld").innerHTML = s;
}

/* ================================================================== 7B cable sizing */
const CAB_PAR = [["Ib", "Design current I<sub>b</sub>", "A"], ["In", "Breaker rating I<sub>n</sub>", "A"], ["L", "Length L", "m"], ["cosphi", "cos φ", ""], ["U", "Line voltage U", "V"], ["U0", "Phase voltage U<sub>0</sub>", "V"],
  ["rho", "Resistivity ρ (Cu at operating temperature)", "Ω·mm²/m"], ["Z_ext", "Loop impedance upstream Z<sub>ext</sub>", "Ω"], ["k_temp", "Ambient factor k<sub>temp</sub>", ""], ["k_group", "Grouping factor k<sub>group</sub>", ""], ["dU_limit", "Voltage drop limit", "%"]];
function html7B() {
  return card("f77B", "7B · Cable sizing – current, PE, voltage drop, fault loop", "IEC 60364-5-52 / -5-54 / -4-41 orientation · example: feeder to HMC MC02 · example ampacity table",
    intro(`<p>A cable must do three things: <b>carry the current</b> without overheating (corrected ampacity ≥ breaker rating), keep the
      <b>voltage drop</b> small, and in case of a fault to the housing let enough current flow so that the breaker <b>trips fast enough</b>
      (automatic disconnection, protection against electric shock in a TN system).</p>
      <p class="phd-eq">required I<sub>z</sub> = I<sub>n</sub> ÷ (k<sub>temp</sub>·k<sub>group</sub>) · I<sub>b</sub> ≤ I<sub>n</sub> ≤ I<sub>z,table</sub>·k<sub>temp</sub>·k<sub>group</sub> · PE: A ≤ 16 → A, ≤ 35 → 16, else A/2</p>
      <p class="phd-eq">ΔU = √3·I<sub>b</sub>·L·ρ·cos φ ÷ A · R<sub>loop</sub> = L·ρ·(1/A + 1/A<sub>PE</sub>) · Z<sub>s</sub> = Z<sub>ext</sub> + R<sub>loop</sub> · I<sub>k1</sub> = U<sub>0</sub> ÷ Z<sub>s</sub> ≥ I<sub>a</sub> = m·I<sub>n</sub> · L<sub>max</sub> = (U<sub>0</sub>/I<sub>a</sub> − Z<sub>ext</sub>) ÷ (ρ·(1/A + 1/A<sub>PE</sub>))</p>`) +
    `<div class="fe-row"><button class="mx-el" id="f7BRst">Reset to example values</button>
      <label>Breaker curve <select id="f7BCurve" class="fe-sel"><option value="B">B (m = 5)</option><option value="C">C (m = 10)</option><option value="D">D (m = 20)</option><option value="X">setting (enter m)</option></select></label>
      <label>m <input type="number" id="f7BM" step="any" class="f7-n"></label></div>
    <div class="grid2">
      <div><div id="f7BPar"></div><p class="sub">${esc(EX7.cable._factors)}</p></div>
      <div><h3 class="fe-h3">Results</h3><div id="f7BRes"></div></div>
    </div>
    <div class="grid2">
      <div><h3 class="fe-h3">Ampacity – example table</h3><div id="f7BAmp"></div><p class="sub">${esc(EX7.cable._table)}</p></div>
      <div><h3 class="fe-h3">Fault current I<sub>k1</sub> versus cable length</h3>
        <div class="fe-scroll"><svg id="f7BChart" class="fe-chart" viewBox="0 0 640 300" role="img" aria-label="Earth-fault current versus cable length with the trip current line"></svg></div>
        <div class="sub"><span class="fx-lg"><i class="fx-s1"></i>I<sub>k1</sub>(L)</span> <span class="fx-lg"><i class="fx-gc"></i>I<sub>a</sub> = m·I<sub>n</sub></span> dashed: chosen L and L<sub>max</sub></div></div>
    </div>` +
    useCase(`long feeders in a big hall (pallet pool, AGV chargers, central chip system 60–120 m away) usually fail the <b>fault-loop</b> check before
      they fail the current check. Fixes: bigger cross-section, shorter route, a breaker with lower magnetic trip (curve B or electronic setting),
      or an RCD. The integrator writes these numbers in the cable list; the owner's electrician measures Z<sub>s</sub> at commissioning (7L).`));
}
function init7B() {
  const par = () => { $("f7BPar").innerHTML = inTab("cable", S.cable, CAB_PAR); $("f7BCurve").value = S.cable.curve || "C"; $("f7BM").value = S.cable.m; };
  const draw = () => {
    const c = calcCable(S.cable);
    $("f7BRes").innerHTML = kv([
      ["Required table ampacity", fx(c.req, 2) + " A"],
      ["Chosen cross-section A", Number.isFinite(c.A) ? `<b>${c.A} mm²</b> (table ${c.IzT} A, corrected ${fx(c.Izc, 2)} A)` : '<span class="fe-no">larger than the table</span>'],
      ["I<sub>b</sub> ≤ I<sub>n</sub> ≤ I<sub>z</sub>", ok(c.cond, `${S.cable.Ib} ≤ ${S.cable.In} ≤ ${fx(c.Izc, 1)} A`, "condition not met")],
      ["PE conductor", `${c.Ape} mm²`],
      ["Voltage drop ΔU", `${fx(c.dU, 3)} V = ${fx(c.dUp, 3)} % ` + ok(c.dUok, "≤ " + c.lim + " %", "> " + c.lim + " %")],
      ["R<sub>loop</sub> / Z<sub>s</sub>", `${fx(c.Rloop, 4)} Ω / ${fx(c.Zs, 4)} Ω`],
      ["I<sub>k1</sub> vs I<sub>a</sub> = " + S.cable.m + "·" + S.cable.In, `${fx(c.Ik1, 1)} A vs ${fx(c.Ia, 0)} A ` + ok(c.ikOk, "disconnects in time", "does NOT disconnect in time")],
      ["Maximum length L<sub>max</sub>", `<b>${fx(c.Lmax, 2)} m</b> ` + ok(S.cable.L <= c.Lmax, "L = " + S.cable.L + " m OK", "L = " + S.cable.L + " m too long")]]) +
      (c.ikOk && c.dUok && c.cond ? "" : `<p class="am-note f7-hint"><b>How to fix:</b> larger A (also raises A<sub>PE</sub>), shorter route, curve B / lower electronic I<sub>i</sub> setting, or an RCD (30–300 mA) for fault protection.</p>`);
    $("f7BAmp").innerHTML = tab(["A mm²", "I<sub>z</sub> table A", "corrected A", ""], S.cable.ampacity_table.map(([a, iz]) => `<tr class="${a === c.A ? "f7-hl" : ""}"><td>${a}</td><td>${iz}</td><td>${fx(iz * S.cable.k_temp * S.cable.k_group, 1)}</td><td>${a === c.A ? "← chosen" : ""}</td></tr>`), "f7-small");
    drawIk(c);
  };
  par(); bindIn("f7BPar", "cable", draw);
  $("f7BCurve").addEventListener("change", () => { const v = $("f7BCurve").value; S.cable.curve = v; if (v !== "X") { S.cable.m = { B: 5, C: 10, D: 20 }[v]; $("f7BM").value = S.cable.m; } save("cable"); draw(); });
  $("f7BM").addEventListener("input", () => { S.cable.m = num($("f7BM").value, 10); S.cable.curve = "X"; $("f7BCurve").value = "X"; save("cable"); draw(); });
  $("f7BRst").addEventListener("click", () => { resetSec("cable"); par(); draw(); });
  draw();
}
function drawIk(c) {
  const W = 640, H = 300, l = 60, r = 20, t = 16, b = 40;
  if (!Number.isFinite(c.A)) { $("f7BChart").innerHTML = ""; return; }
  const Lx = Math.max(120, Math.ceil(Math.max(S.cable.L, c.Lmax) * 1.4 / 20) * 20), ik = (L) => S.cable.U0 / (S.cable.Z_ext + L * c.rpm);
  const Ymax = Math.ceil(Math.max(ik(0), c.Ia) * 1.1 / 200) * 200;
  const X = (L) => l + (L / Lx) * (W - l - r), Y = (v) => H - b - (v / Ymax) * (H - t - b);
  let s = "";
  for (let i = 0; i <= 5; i++) { const v = Ymax * i / 5; s += `<line x1="${l}" x2="${W - r}" y1="${Y(v)}" y2="${Y(v)}" class="fe-grid"/><text x="${l - 6}" y="${Y(v) + 4}" text-anchor="end" class="fe-tick">${fx(v, 0)}</text>`; }
  for (let i = 0; i <= 6; i++) { const L = Lx * i / 6; s += `<text x="${X(L)}" y="${H - b + 16}" text-anchor="middle" class="fe-tick">${fx(L, 0)}</text>`; }
  s += `<text x="${(W + l) / 2}" y="${H - 6}" text-anchor="middle" class="fe-axis">cable length L [m]</text><text x="14" y="${t + 6}" class="fe-axis">I [A]</text>`;
  let p = ""; for (let i = 0; i <= 60; i++) { const L = Lx * i / 60; p += (i ? "L" : "M") + X(L).toFixed(1) + " " + Y(ik(L)).toFixed(1); }
  s += `<path d="${p}" class="fx-ln fx-s1"/><line x1="${l}" x2="${W - r}" y1="${Y(c.Ia)}" y2="${Y(c.Ia)}" class="f7-ia"/>
    <text x="${W - r - 4}" y="${Y(c.Ia) - 6}" text-anchor="end" class="f7-lbl">I<tspan baseline-shift="sub" font-size="8">a</tspan> = ${fx(c.Ia, 0)} A</text>`;
  [[S.cable.L, "L = " + fx(S.cable.L, 0) + " m"], [c.Lmax, "L_max = " + fx(c.Lmax, 1) + " m"]].forEach(([L, txt], i) => {
    if (L < 0 || L > Lx) return;
    s += `<line x1="${X(L)}" x2="${X(L)}" y1="${t}" y2="${H - b}" class="f7-dash"/><circle cx="${X(L)}" cy="${Y(ik(L))}" r="4" class="f7-dot"/>
      <text x="${X(L) + 5}" y="${t + 12 + i * 14}" class="f7-lbl">${txt}</text>`;
  });
  $("f7BChart").innerHTML = s;
}

/* ================================================================== 7C 24 V control power */
const DC_PAR = [["U_psu", "PSU output voltage", "V"], ["U_min", "Minimum voltage at the load", "V (24 V − 10 %)"], ["reserve", "Reserve factor", "×"]];
const LINE_PAR = [["L", "Line length L (one way)", "m"], ["I", "Current I", "A"], ["A", "Cross-section A", "mm²"], ["rho", "Resistivity ρ (Cu 20 °C)", "Ω·mm²/m"]];
function html7C() {
  return card("f77C", "7C · 24 V DC control power – budget, PSU, protected channels, line drop", "IEC 60204-1 PELV control circuit · one PSU per cabinet, outputs split by electronic circuit breakers (ECB)",
    intro(`<p>All sensors, PLCs, safety IO, valves and HMIs run on <b>24 V DC</b> (PELV, one side earthed). The current of all consumers gives the
      power-supply size; the consumers are split into <b>channels</b>, each protected by an <b>electronic circuit breaker</b> so that a short circuit
      at one valve terminal does not switch off the PLC. Long thin cables lose voltage – the load must still see at least 21.6 V.</p>
      <p class="phd-eq">I<sub>load</sub> = Σ I·qty·sim · PSU ≥ I<sub>load</sub>·reserve · channel rating ≥ I<sub>ch</sub>·reserve · ΔU = 2·L·I·ρ ÷ A · U<sub>load</sub> = U<sub>PSU</sub> − ΔU ≥ U<sub>min</sub> · L<sub>max</sub> = (U<sub>PSU</sub> − U<sub>min</sub>)·A ÷ (2·I·ρ)</p>`) +
    `<div class="fe-row"><button class="mx-el" id="f7CRst">Reset to example values</button><button class="mx-el" id="f7CAdd">+ add consumer</button></div>
    <div id="f7CTab"></div>
    <div class="grid2">
      <div><h3 class="fe-h3">Supply</h3><div id="f7CPar"></div><div id="f7CRes"></div></div>
      <div><h3 class="fe-h3">Line to a remote consumer – ${esc(EX7.dc24.line._case)}</h3><div id="f7CLin"></div><div id="f7CLRes"></div></div>
    </div>` +
    useCase(`in a pallet-pool cabinet the PLC, safety IO and IO-Link masters sit on channel 1, field sensors on channel 2, valve coils on channel 3 and
      HMI + light curtain on channel 4. Each channel reports "tripped" to the PLC (diagnosis bit on the module data block, item 6F), so the HMI tells
      the operator exactly which branch has the fault. Safety outputs (STO, contactor coils) get their own channel or come from the safety PLC.`));
}
function init7C() {
  const drawTab = () => {
    const chs = ["ch1", "ch2", "ch3", "ch4", "ch5", "ch6"];
    $("f7CTab").innerHTML = tab(["Consumer", "I each A", "Qty", "Simultaneity", "Channel", "I A", ""],
      S.dc24.loads.map((r, i) => `<tr><td>${cellIn(`dc24.loads.${i}.0`, r[0], "f7-t")}</td><td>${cellIn(`dc24.loads.${i}.1`, r[1])}</td><td>${cellIn(`dc24.loads.${i}.2`, r[2])}</td><td>${cellIn(`dc24.loads.${i}.3`, r[3])}</td>
        <td><select data-p="dc24.loads.${i}.4" class="fe-sel">${chs.map((c) => `<option${c === r[4] ? " selected" : ""}>${c}</option>`).join("")}</select></td><td class="f7-r" id="f7CI${i}"></td><td><button class="mx-el f7-mini" data-del="${i}">✕</button></td></tr>`), "f7-small");
    draw();
  };
  const draw = () => {
    const d = calcDC(S.dc24);
    d.rows.forEach((r, i) => { const e = $("f7CI" + i); if (e) e.textContent = fx(r.I, 3); });
    $("f7CRes").innerHTML = kv([["I<sub>load</sub>", fx(d.total, 3) + " A"], ["× reserve " + S.dc24.reserve, fx(d.need, 3) + " A"], ["PSU size", d.psu ? `<b>${d.psu} A</b> (${d.psu * 24} W)` : '<span class="fe-no">larger than the size list – split into 2 PSUs</span>']]) +
      tab(["Channel", "I A", "× reserve", "ECB rating"], d.chans.map((h) => `<tr><td>${esc(h.ch)}</td><td>${fx(h.I, 3)}</td><td>${fx(h.need, 3)}</td><td><b>${h.rating ? h.rating + " A" : "–"}</b></td></tr>`), "f7-small");
    $("f7CLRes").innerHTML = kv([["ΔU = 2·L·I·ρ/A", fx(d.dU, 3) + " V"], ["U at the load", `${fx(d.Uload, 3)} V ` + ok(d.lineOk, "≥ " + S.dc24.U_min + " V", "< " + S.dc24.U_min + " V")], ["Maximum length L<sub>max</sub>", `<b>${fx(d.Lmax, 2)} m</b> at ${S.dc24.line.I} A and ${S.dc24.line.A} mm²`]]);
  };
  const par = () => { $("f7CPar").innerHTML = inTab("dc24", S.dc24, DC_PAR); $("f7CLin").innerHTML = inTab("dc24.line", S.dc24.line, LINE_PAR); };
  par(); bindIn("f7CTab", "dc24", draw); bindIn("f7CPar", "dc24", draw); bindIn("f7CLin", "dc24", draw);
  $("f7CTab").addEventListener("change", (e) => { if (e.target.tagName === "SELECT") { setP(S, e.target.dataset.p, e.target.value); save("dc24"); draw(); } });
  $("f7CTab").addEventListener("click", (e) => { const b = e.target.closest("[data-del]"); if (!b) return; S.dc24.loads.splice(+b.dataset.del, 1); save("dc24"); drawTab(); });
  $("f7CAdd").addEventListener("click", () => { S.dc24.loads.push(["New consumer", 0.1, 1, 1, "ch2"]); save("dc24"); drawTab(); });
  $("f7CRst").addEventListener("click", () => { resetSec("dc24"); par(); drawTab(); });
  drawTab();
}

/* ================================================================== 7D cabinet thermal */
const CABT_PAR = [["W", "Width W", "m"], ["H", "Height H", "m"], ["D", "Depth D", "m"], ["k", "Heat transfer k (painted steel)", "W/(m²K)"], ["Ti", "Allowed inside temperature T<sub>i</sub>", "°C"]];
function html7D() {
  return card("f77D", "7D · Cabinet thermal design – losses, natural dissipation, fan or cooling unit", "IEC 60890 / IEC 61439 orientation · example: " + esc(EX7.cabinet._case),
    intro(`<p>Drives, power supplies and PLCs turn part of their power into heat. The cabinet surface gives some of it away if the room is cooler
      than the inside (35 °C is a common design limit for electronics). If not enough, a <b>filter fan</b> blows room air through (only when the
      room is at least 5 K cooler), otherwise a <b>cooling unit</b> (closed, no dust) is needed.</p>
      <p class="phd-eq">A (against a wall) = 1.4·W·(H + D) + 1.8·D·H · A (free-standing) = 1.8·H·(W + D) + 1.4·W·D · P<sub>nat</sub> = k·A·(T<sub>i</sub> − T<sub>a</sub>) · Q = P<sub>loss</sub> − P<sub>nat</sub></p>
      <p class="phd-eq">Q ≤ 0 → nothing · T<sub>a</sub> &lt; T<sub>i</sub> − 5 → fan V = 3.1·Q ÷ (T<sub>i</sub> − T<sub>a</sub>) [m³/h] · else cooling unit ≥ Q [W]</p>`) +
    `<div class="fe-row"><button class="mx-el" id="f7DRst">Reset to example values</button><button class="mx-el" id="f7DAdd">+ add loss</button>
      <label>Mounting <select id="f7DMnt" class="fe-sel"><option value="wall">against a wall / wall-hung</option><option value="free">free-standing, all sides free</option></select></label></div>
    <div class="grid2">
      <div><div id="f7DPar"></div><h3 class="fe-h3">Room temperature cases T<sub>a</sub> [°C]</h3><div class="fe-row" id="f7DTa"></div><div id="f7DLoss"></div></div>
      <div><h3 class="fe-h3">Results</h3><div id="f7DRes"></div>
        <div class="fe-scroll"><svg id="f7DChart" class="fe-chart" viewBox="0 0 640 260" role="img" aria-label="Needed cooling power versus room temperature"></svg></div>
        <div class="sub"><span class="fx-lg"><i class="fx-s1"></i>Q needed</span> shaded: fan possible (T<sub>a</sub> &lt; T<sub>i</sub> − 5) · right: cooling unit</div></div>
    </div>` +
    useCase(`a stacker-crane cabinet in a hall that reaches 35–40 °C in summer cannot use filter fans: the integrator offers a cooling unit (here ≈ 1 kW)
      and the owner's engineer checks that the hall has room for its heat and that condensate is drained. Hot spots: VFDs at the bottom, PLC at the
      top is wrong – put heat sources high and electronics low, keep 100 mm free above drives.`));
}
function init7D() {
  const par = () => {
    $("f7DPar").innerHTML = inTab("cab", S.cab, CABT_PAR); $("f7DMnt").value = S.cab.mounting;
    $("f7DTa").innerHTML = S.cab.Ta_cases.map((t, i) => `<label>case ${i + 1} ${cellIn("cab.Ta_cases." + i, t)}</label>`).join("");
    drawLoss();
  };
  const drawLoss = () => {
    $("f7DLoss").innerHTML = tab(["Loss source", "W", ""], S.cab.losses.map((r, i) => `<tr><td>${cellIn(`cab.losses.${i}.0`, r[0], "f7-t")}</td><td>${cellIn(`cab.losses.${i}.1`, r[1])}</td><td><button class="mx-el f7-mini" data-del="${i}">✕</button></td></tr>`), "f7-small");
    draw();
  };
  const draw = () => {
    const k = calcCab(S.cab);
    $("f7DRes").innerHTML = kv([["Effective surface A", fx(k.A, 3) + " m²"], ["Total losses P<sub>loss</sub>", fx(k.P, 0) + " W"]]) +
      tab(["T<sub>a</sub> °C", "P<sub>nat</sub> W", "Q W", "Decision"], k.cases.map((x) => `<tr><td>${x.Ta}</td><td>${fx(x.Pnat, 2)}</td><td>${fx(x.Q, 2)}</td><td>${x.kind === "none" ? '<span class="fe-ok">no active cooling</span>' : x.kind === "fan" ? `<b>filter fan ≥ ${fx(x.V, 1)} m³/h</b>` : `<b class="f7-warn">cooling unit ≥ ${fx(x.cool, 1)} W</b>`}</td></tr>`), "f7-small");
    drawCabChart(k);
  };
  par();
  bindIn("f7DPar", "cab", draw); bindIn("f7DTa", "cab", draw); bindIn("f7DLoss", "cab", draw);
  $("f7DMnt").addEventListener("change", () => { S.cab.mounting = $("f7DMnt").value; save("cab"); draw(); });
  $("f7DLoss").addEventListener("click", (e) => { const b = e.target.closest("[data-del]"); if (!b) return; S.cab.losses.splice(+b.dataset.del, 1); save("cab"); drawLoss(); });
  $("f7DAdd").addEventListener("click", () => { S.cab.losses.push(["New loss", 20]); save("cab"); drawLoss(); });
  $("f7DRst").addEventListener("click", () => { resetSec("cab"); par(); });
}
function drawCabChart(k) {
  const W = 640, H = 260, l = 60, r = 20, t = 16, b = 40, c = S.cab, t0 = 15, t1 = 50;
  const q = (Ta) => k.P - c.k * k.A * (c.Ti - Ta), Ymax = Math.max(200, Math.ceil(Math.max(q(t1), k.P) * 1.1 / 200) * 200), Ymin = Math.min(0, Math.floor(q(t0) / 200) * 200);
  const X = (T) => l + (T - t0) / (t1 - t0) * (W - l - r), Y = (v) => H - b - (v - Ymin) / (Ymax - Ymin) * (H - t - b);
  let s = `<rect x="${X(t0)}" y="${t}" width="${Math.max(0, X(Math.min(t1, c.Ti - 5)) - X(t0))}" height="${H - t - b}" class="f7-fanz"/>`;
  for (let i = 0; i <= 5; i++) { const v = Ymin + (Ymax - Ymin) * i / 5; s += `<line x1="${l}" x2="${W - r}" y1="${Y(v)}" y2="${Y(v)}" class="fe-grid"/><text x="${l - 6}" y="${Y(v) + 4}" text-anchor="end" class="fe-tick">${fx(v, 0)}</text>`; }
  for (let T = t0; T <= t1; T += 5) s += `<text x="${X(T)}" y="${H - b + 16}" text-anchor="middle" class="fe-tick">${T}</text>`;
  s += `<line x1="${l}" x2="${W - r}" y1="${Y(0)}" y2="${Y(0)}" class="f7-axis0"/><path d="M${X(t0)} ${Y(q(t0))}L${X(t1)} ${Y(q(t1))}" class="fx-ln fx-s1"/>
    <text x="${(W + l) / 2}" y="${H - 6}" text-anchor="middle" class="fe-axis">room temperature T<tspan baseline-shift="sub" font-size="8">a</tspan> [°C]</text><text x="14" y="${t + 6}" class="fe-axis">Q [W]</text>`;
  k.cases.forEach((x) => { s += `<circle cx="${X(x.Ta)}" cy="${Y(x.Q)}" r="4.5" class="f7-dot"/><text x="${X(x.Ta) + 6}" y="${Y(x.Q) - 6}" class="f7-lbl">${fx(x.Q, 0)} W</text>`; });
  $("f7DChart").innerHTML = s;
}

/* ================================================================== 7E risk assessment & PLr */
export const HAZ = [
  ["Pallet pool / stacker crane", "Crushing / impact by the moving crane and fork", "S2", "F2", "P1", "Fence + interlocked door with guard locking, SS1 + STO, maintenance mode with enabling device + SLS"],
  ["Load / unload station", "Crushing by rotary table, clamping, falling pallet", "S2", "F2", "P1", "Light curtain (Type 4), safe stop of the table, clamp valve stays closed"],
  ["Machine tool (HMC)", "Contact with spindle / tool, ejected chips and parts", "S2", "F1", "P2", "Machine-builder's door interlock with guard locking (machine CE), cell only couples e-stop + door status"],
  ["AGV dock / transfer", "Crushing at the transfer conveyor, AGV collision", "S1", "F2", "P1", "Safety laser scanner on the AGV and at the dock, conveyor STO"],
  ["Robot cell", "Impact by the robot arm", "S2", "F2", "P2", "Fence + interlocked door, light curtain at the material port, safe robot zones / speed"],
  ["Parts washer", "Hot fluid spray, pumps, moving basket", "S2", "F2", "P1", "Interlocked door two-channel, pumps STO / contactors"],
  ["Electrical cabinets", "Electric shock, arc flash", "S2", "F1", "P2", "IP2X finger safe, main switch lockable, covers for parts live after switch-off, IEC 60204-1"],
  ["Compressed air / hydraulics", "Unexpected movement, whipping hose", "S2", "F1", "P1", "Safe exhaust valve, lockable shut-off, stored-energy release before work"],
];
function html7E() {
  return card("f77E", "7E · Risk assessment (ISO 12100) and required performance level PLr", "the risk decides how good each safety function must be · interactive risk graph after ISO 13849-1 Annex A",
    intro(`<p><b>ISO 12100</b> gives the steps: (1) determine the <b>limits</b> of the machine (use, space, time, people), (2) identify the
      <b>hazards</b> in every life phase (automatic, set-up, cleaning, maintenance, fault finding), (3) <b>estimate</b> the risk (how bad, how often,
      can you avoid it), (4) <b>evaluate</b> – is it acceptable? (5) <b>reduce</b> it in this order: inherently safe design → safeguards and
      safety functions → information for use. Then repeat until the risk is acceptable and document everything (risk assessment file).</p>
      <p>For every risk that a <b>safety function</b> must reduce, the <b>risk graph</b> gives the required performance level PLr:</p>
      <p class="phd-eq">S1 slight / S2 serious injury · F1 seldom or short / F2 frequent or long exposure · P1 possible / P2 scarcely possible to avoid → PLr a … e</p>`) +
    `<div class="grid2">
      <div><h3 class="fe-h3">Risk graph – choose S, F, P</h3>
        <div class="fe-row" id="f7ESel">${[["S", ["S1", "S2"]], ["F", ["F1", "F2"]], ["P", ["P1", "P2"]]].map(([k, v]) => `<span class="mx-nav fe-inline">${v.map((x) => `<button class="mx-el" data-k="${k}" data-v="${x}">${x}</button>`).join("")}</span>`).join("")}</div>
        <div id="f7ERes"></div>
        <div class="fe-scroll"><svg id="f7EGraph" class="fe-chart" viewBox="0 0 640 300" role="img" aria-label="Risk graph S F P to PLr"></svg></div></div>
      <div><h3 class="fe-h3">ISO 12100 – the 5 steps in an FMS project</h3>
        <ol class="fx-steps"><li><b>Limits:</b> whole cell incl. pool, load stations, AGV path, machines (machine CE stays with the builder – the cell is an <i>assembly of machines</i> and needs its own risk assessment + CE).</li>
          <li><b>Hazards:</b> walk every life phase with the operators: automatic, loading, tool change, set-up, cleaning chips, maintenance, fault recovery.</li>
          <li><b>Estimate:</b> S, F, P per hazard (table below) → PLr.</li><li><b>Evaluate:</b> acceptable? compare with state of the art (type-C standards, e.g. ISO 10218 for robots, ISO 16090 for machining centres).</li>
          <li><b>Reduce:</b> design out → guards / safety functions with PL ≥ PLr (7F) → warnings, training, manual. Validate (ISO 13849-2, 7L).</li></ol>
        <p class="am-note">The six example safety functions of 7F get their PLr from this graph: ${EX7.safety.functions.map((f) => `<b>${f.id}</b> ${f.S}${f.F}${f.P} → ${plr(f.S, f.F, f.P)}`).join(" · ")}</p></div>
    </div>
    <h3 class="fe-h3">Typical hazard list of an FMS (example estimates – your team decides)</h3>
    ${tab(["Area", "Hazard", "S", "F", "P", "PLr", "Typical measure"], HAZ.map((h) => `<tr><td><b>${esc(h[0])}</b></td><td>${esc(h[1])}</td><td>${h[2]}</td><td>${h[3]}</td><td>${h[4]}</td><td><b>${plr(h[2], h[3], h[4])}</b></td><td>${esc(h[5])}</td></tr>`), "f7-small")}` +
    useCase(`the owner's engineer leads the risk-assessment workshop with production, maintenance and the integrator in the basic-design phase
      (pipeline P4–P5, item 1). The list of safety functions with their PLr goes into the specification (URS / FDS) – the integrator must prove
      PL ≥ PLr for each one (7F) and validate it before handover (7L).`));
}
function init7E() {
  const draw = () => {
    const r = S.risk, p = plr(r.S, r.F, r.P);
    document.querySelectorAll("#f7ESel [data-k]").forEach((b) => b.classList.toggle("active", r[b.dataset.k] === b.dataset.v));
    $("f7ERes").innerHTML = `<p class="fe-big">${r.S} · ${r.F} · ${r.P} → <b>PLr ${p}</b></p><p class="sub">${{ a: "low contribution to risk reduction", b: "e.g. Cat B / 1 with good components", c: "Cat 1 well-tried or Cat 2–3", d: "usually two channels (Cat 3) with good diagnosis", e: "Cat 4 or certified devices – high risk" }[p]}</p>`;
    drawRG(r);
  };
  $("f7ESel").addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (!b) return; S.risk[b.dataset.k] = b.dataset.v; save("risk"); draw(); });
  draw();
}
function drawRG(r) {
  const x0 = 30, xs = 130, xf = 270, xp = 410, xl = 560, yc = 150;
  const yS = { S1: 80, S2: 220 }, yF = (s, f) => yS[s] + (f === "F1" ? -40 : 40), yP = (s, f, p) => yF(s, f) + (p === "P1" ? -18 : 18);
  let s = `<circle cx="${x0}" cy="${yc}" r="6" class="f7-dot"/><text x="${x0 - 4}" y="${yc - 12}" class="f7-lbl">start</text>`;
  const on = (a) => (a ? "f7-rgon" : "f7-rg");
  ["S1", "S2"].forEach((S_) => {
    s += `<path d="M${x0} ${yc}L${xs} ${yS[S_]}" class="${on(r.S === S_)}"/><text x="${xs - 30}" y="${yS[S_] + (S_ === "S1" ? -8 : 16)}" class="f7-lbl">${S_}</text>`;
    ["F1", "F2"].forEach((F) => {
      s += `<path d="M${xs} ${yS[S_]}L${xf} ${yF(S_, F)}" class="${on(r.S === S_ && r.F === F)}"/><text x="${xf - 30}" y="${yF(S_, F) + (F === "F1" ? -6 : 14)}" class="f7-lbl">${F}</text>`;
      ["P1", "P2"].forEach((P) => {
        const a = r.S === S_ && r.F === F && r.P === P, y = yP(S_, F, P), pl = plr(S_, F, P);
        s += `<path d="M${xf} ${yF(S_, F)}L${xp} ${y}L${xl} ${y}" class="${on(a)}"/><text x="${xp - 28}" y="${y + (P === "P1" ? -4 : 12)}" class="f7-sm">${P}</text>
          <rect x="${xl}" y="${y - 9}" width="44" height="18" rx="4" class="f7-pl f7-pl-${pl}${a ? " f7-plon" : ""}"/><text x="${xl + 22}" y="${y + 4}" text-anchor="middle" class="f7-lbl">PLr ${pl}</text>`;
      });
    });
  });
  $("f7EGraph").innerHTML = s;
}

/* ================================================================== 7F ISO 13849-1 PL calculator */
const ROLE = { input: "Input (sensor)", logic: "Logic", output: "Output (actuator)" };
function html7F() {
  return card("f77F", "7F · ISO 13849-1 performance level calculator", "MTTFd from B10d · two-channel symmetrisation · DCavg · CCF · PL from category · Table 11 combination · six example safety functions",
    intro(`<p>A <b>safety function</b> (e.g. "door open → crane stops") is a chain of <b>subsystems</b>: input (switch, light curtain) → logic (safety
      PLC / relay) → output (contactors, drive STO). Each subsystem reaches a <b>PL</b> from its <b>category</b> (structure: 1 or 2 channels, B/1/2/3/4),
      the reliability of its parts (<b>MTTFd</b>), how many faults the diagnosis finds (<b>DCavg</b>) and the protection against common-cause
      failures (<b>CCF</b>). Certified devices bring their PL from the data sheet.</p>
      <p class="phd-eq">n<sub>op</sub> = d<sub>op</sub>·h<sub>op</sub>·3600 ÷ t<sub>cycle</sub> · MTTFd = B10d ÷ (0.1·n<sub>op</sub>) · T10d = B10d ÷ n<sub>op</sub> · channel: 1 ÷ Σ(1/MTTFd<sub>i</sub>) · two channels: ⅔·(C1 + C2 − 1 ÷ (1/C1 + 1/C2)), cap 100 a</p>
      <p class="phd-eq">DCavg = Σ(DC<sub>i</sub>/MTTFd<sub>i</sub>) ÷ Σ(1/MTTFd<sub>i</sub>) · MTTFd band low 3–10, medium 10–30, high 30–100 · DC band none &lt; 60, low &lt; 90, medium &lt; 99, high ≥ 99 · CCF ≥ 65 for Cat 2–4</p>
      <p class="phd-eq">Series: lowest PL, N = how many have it · a N≤3 a · b N≤2 b else a · c N≤2 c else b · d N≤3 d else c · e N≤3 e else d · verdict PL ≥ PLr</p>`) +
    `<div class="fe-row"><button class="mx-el" id="f7FRst">Reset all functions to the example</button></div>
    <h3 class="fe-h3">All safety functions</h3><div id="f7FSum"></div>
    <div class="grid2">
      <div><h3 class="fe-h3">CCF measures (ISO 13849-1 Annex F) – applies to all Cat 2–4 subsystems</h3>
        <div class="fe-row">${EX7.safety.ccf_cases.map((c, i) => `<button class="mx-el" data-ccf="${i}">${esc(c.name)}</button>`).join("")}</div>
        <div id="f7FCcf"></div></div>
      <div><h3 class="fe-h3">Selected function</h3>
        <label>Safety function <select id="f7FSel" class="fe-sel f7-selw">${EX7.safety.functions.map((f) => `<option value="${f.id}">${f.id} · ${esc(f.name)}</option>`).join("")}</select></label>
        <div id="f7FHead"></div></div>
    </div>
    <div id="f7FSubs"></div><div id="f7FVer"></div>` +
    useCase(`the integrator delivers this calculation for every safety function (usually with the free tool SISTEMA and the manufacturers' libraries);
      the owner's engineer checks it: right PLr from the risk assessment, B10d and n<sub>op</sub> realistic (a door opened every 30 s wears a switch out
      fast – T10d!), DC claims backed by real diagnosis (EDM feedback contacts, cross-monitoring), CCF list filled. SF6 shows a typical first design that
      fails – the fix is a second channel.`));
}
const CATS = ["B", "1", "2", "3", "4"];
function init7F() {
  const fn = () => S.sf.functions.find((f) => f.id === S.sf.sel) || S.sf.functions[0];
  const drawCcf = () => {
    const sc = ccfScore(S.sf.ccf);
    $("f7FCcf").innerHTML = EX7.safety.ccf_measures.map(([n, p]) => `<label class="f7-ci"><input type="checkbox" data-ccfm="${esc(n)}"${S.sf.ccf.includes(n) ? " checked" : ""}> ${esc(n)} <span class="sub">(${p})</span></label>`).join("") +
      `<p class="fe-big">CCF score = <b>${sc}</b> ${ok(sc >= 65, "≥ 65", "< 65 → Cat 2, 3, 4 not allowed")}</p>`;
  };
  const drawSubs = () => {
    const f = fn();
    $("f7FHead").innerHTML = `<div class="fe-row">${["S", "F", "P"].map((k) => `<label>${k} <select data-sfp="${k}" class="fe-sel">${[k + "1", k + "2"].map((v) => `<option${f[k] === v ? " selected" : ""}>${v}</option>`).join("")}</select></label>`).join("")}
      <span id="f7FPlr"></span></div>`;
    $("f7FSubs").innerHTML = f.subsystems.map((s, si) => {
      const base = `sf.functions.${S.sf.functions.indexOf(f)}.subsystems.${si}`;
      const head = `<div class="card-head"><h3 class="fe-h3">${ROLE[s.role] || esc(s.role)} · ${esc(s.name)}</h3><span class="sub" id="f7FSP${si}"></span></div>`;
      if (s.pl) return `<div class="f7-sub">${head}<label>Certified device – PL from the data sheet <select class="fe-sel" data-plsel="${base}">${PLS.map((p) => `<option${p === s.pl ? " selected" : ""}>${p}</option>`).join("")}</select></label></div>`;
      const rows = []; s.channels.forEach((ch, ci) => ch.forEach((c, ki) => {
        const p = `${base}.channels.${ci}.${ki}`;
        rows.push(`<tr><td>C${ci + 1}</td><td>${cellIn(p + ".0", c[0], "f7-t")}</td>${[1, 2, 3, 4, 5].map((j) => `<td>${cellIn(p + "." + j, c[j], j === 1 ? "f7-nw" : "f7-n")}</td>`).join("")}<td class="f7-r" id="f7Fn${si}_${ci}_${ki}"></td><td class="f7-r" id="f7Fm${si}_${ci}_${ki}"></td><td class="f7-r" id="f7Ft${si}_${ci}_${ki}"></td></tr>`);
      }));
      return `<div class="f7-sub">${head}<div class="fe-row"><label>Category <select class="fe-sel" data-catsel="${base}">${CATS.map((c) => `<option${c === String(s.cat) ? " selected" : ""}>${c}</option>`).join("")}</select></label>
        <span class="sub">channels: ${s.channels.length} ${s.channels.length === 1 ? "(Cat B / 1 / 2 single channel)" : "(Cat 3 / 4 need two channels)"}</span></div>
        ${tab(["Ch", "Component", "B10d", "d<sub>op</sub> d/a", "h<sub>op</sub> h/d", "t<sub>cycle</sub> s", "DC %", "n<sub>op</sub> /a", "MTTFd a", "T10d a"], rows, "f7-small")}<div id="f7FSR${si}"></div></div>`;
    }).join("");
    drawRes();
  };
  const drawRes = () => {
    const ccf = ccfScore(S.sf.ccf), f = fn(), r = evalSF(f, ccf);
    $("f7FPlr").innerHTML = `PLr = <b>${r.plr}</b>`;
    r.subs.forEach((s, si) => {
      const sp = $("f7FSP" + si); if (sp) sp.innerHTML = s.pl ? `PL <b>${s.pl}</b>` : `<span class="fe-no">not allowed</span>`;
      if (s.cert) return;
      s.ch.forEach((ch, ci) => ch.forEach((k, ki) => { const id = `${si}_${ci}_${ki}`; const a = $("f7Fn" + id), b = $("f7Fm" + id), c = $("f7Ft" + id); if (a) a.textContent = fx(k.nop, 0); if (b) b.textContent = fx(k.mttfd, 2); if (c) c.innerHTML = fx(k.t10d, 2) + (k.t10d < 20 ? ' <span class="f7-warn">replace!</span>' : ""); }));
      const e = $("f7FSR" + si);
      if (e) e.innerHTML = kv([["Channel MTTFd", s.chM.map((x, i) => `C${i + 1} = ${fx(x, 2)} a`).join(" · ")],
        ["MTTFd of the subsystem", (s.chM.length > 1 ? `symmetrised ${fx(s.mt, 2)} a → ` : "") + `capped <b>${fx(s.capped, 2)} a</b> = <b>${s.mb}</b>`],
        ["DCavg", `${fx(s.dc, 2)} % = <b>${s.db}</b>`], ["Category / table column", `Cat ${s.cat} / ${s.col || "–"}`],
        ["PL", s.pl ? `<b>${s.pl}</b>` : `<span class="fe-no">not allowed – ${esc(s.why)}</span>`]]);
    });
    $("f7FVer").innerHTML = `<div class="f7-sub f7-ver">${kv([["Subsystem PLs", r.subs.map((s) => s.pl || "n/a").join(" → ")], ["Combined PL (Table 11)", r.pl ? `<b class="fe-big">${r.pl}</b>` : '<span class="fe-no">not allowed</span>'],
      ["Verdict", ok(r.ok, `PL ${r.pl} ≥ PLr ${r.plr} – safety function OK`, `PL ${r.pl || "n/a"} < PLr ${r.plr} – NOT OK`)]])}
      ${r.ok ? "" : `<p class="am-note f7-hint"><b>How to fix:</b> ${r.subs.map((s, i) => (!s.pl || PLS.indexOf(s.pl) < PLS.indexOf(r.plr) ? `${ROLE[f.subsystems[i].role]}: ${s.cert ? "choose a certified device with PL ≥ " + r.plr : "make it two-channel Cat 3 (second switch / second contactor with feedback EDM, DC ≥ 90 %, CCF ≥ 65) or use a certified device with PL ≥ " + r.plr}` : "")).filter(Boolean).join(" · ")}.</p>
        ${f.id === "SF6" ? `<div class="fe-row"><button class="mx-el" id="f7FFix">Apply the fix to SF6 (two channels, Cat 3)</button></div>` : ""}`}</div>`;
    const fixB = $("f7FFix"); if (fixB) fixB.addEventListener("click", () => {
      const f6 = fn(); const io = f6.subsystems.find((s) => s.role === "input"), oo = f6.subsystems.find((s) => s.role === "output");
      Object.assign(io, { name: "Interlock switch + position switch (Cat 3)", cat: "3", channels: [[["Interlock switch", 2000000, 240, 16, 600, 99]], [["Position switch", 10000000, 240, 16, 600, 90]]] });
      Object.assign(oo, { name: "Two contactors K1/K2 with EDM (Cat 3)", cat: "3", channels: [[["Contactor K1", 1000000, 240, 16, 600, 99]], [["Contactor K2", 1000000, 240, 16, 600, 99]]] });
      save("sf"); drawSubs(); drawSum();
    });
  };
  const drawSum = () => {
    const ccf = ccfScore(S.sf.ccf);
    $("f7FSum").innerHTML = tab(["ID", "Safety function", "S F P", "PLr", "Subsystem PLs", "PL", "Verdict"], S.sf.functions.map((f) => { const r = evalSF(f, ccf);
      return `<tr class="f7-click${f.id === S.sf.sel ? " f7-hl" : ""}" data-sf="${f.id}"><td><b>${f.id}</b></td><td>${esc(f.name)}</td><td>${f.S} ${f.F} ${f.P}</td><td>${r.plr}</td><td>${r.subs.map((s) => s.pl || "n/a").join(" / ")}</td><td><b>${r.pl || "n/a"}</b></td><td>${ok(r.ok, "OK", "NOT OK")}</td></tr>`; }), "f7-small");
  };
  const all = () => { drawSum(); drawRes(); };
  $("f7FSel").value = S.sf.sel;
  $("f7FSel").addEventListener("change", () => { S.sf.sel = $("f7FSel").value; save("sf"); drawSubs(); drawSum(); });
  $("f7FSum").addEventListener("click", (e) => { const t = e.target.closest("[data-sf]"); if (!t) return; S.sf.sel = t.dataset.sf; $("f7FSel").value = S.sf.sel; save("sf"); drawSubs(); drawSum(); });
  $("f7FCcf").addEventListener("change", (e) => { const n = e.target.dataset.ccfm; if (!n) return; S.sf.ccf = S.sf.ccf.filter((x) => x !== n); if (e.target.checked) S.sf.ccf.push(n); save("sf"); drawCcf(); all(); });
  document.querySelectorAll("#f77F [data-ccf]").forEach((b) => b.addEventListener("click", () => { S.sf.ccf = clone(EX7.safety.ccf_cases[+b.dataset.ccf].applied); save("sf"); drawCcf(); all(); }));
  bindIn("f7FSubs", "sf", all);
  $("f7FSubs").addEventListener("change", (e) => { const t = e.target;
    if (t.dataset.catsel) { getP(S, t.dataset.catsel).cat = t.value; save("sf"); all(); }
    if (t.dataset.plsel) { getP(S, t.dataset.plsel).pl = t.value; save("sf"); all(); } });
  $("f7FHead").addEventListener("change", (e) => { const k = e.target.dataset.sfp; if (!k) return; fn()[k] = e.target.value; save("sf"); all(); });
  $("f7FRst").addEventListener("click", () => { const sel = S.sf.sel; resetSec("sf"); S.sf.sel = sel; drawCcf(); drawSubs(); drawSum(); });
  drawCcf(); drawSubs(); drawSum();
}

/* ================================================================== 7G safety distances ISO 13855 + guard locking */
const DTYPE = { aopd: "Light curtain (AOPD), perpendicular approach", multibeam: "Multi-beam light grid (body)", scanner: "Laser scanner, parallel approach", twohand: "Two-hand control" };
function html7G() {
  return card("f77G", "7G · Safety distances (ISO 13855) and guard locking (ISO 14119)", "how far from the hazard must the protective device be? · all example cases editable",
    intro(`<p>A light curtain does not stop the machine immediately: the curtain, the safety PLC and the brakes all need time. During this time
      <b>T</b> a hand or body moves on with a standard approach speed (2000 mm/s hand, 1600 mm/s body / walking). The device must be far enough
      away that the hazard has stopped before the person reaches it. <b>C</b> is the extra distance a finger or hand can reach through the field.</p>
      <p class="phd-eq">T = Σ times · AOPD d ≤ 40 mm: S = 2000·T + 8·(d − 14) (min 100; if &gt; 500 → S = 1600·T + 8·(d − 14), min 500) · body / multi-beam: S = 1600·T + 850</p>
      <p class="phd-eq">scanner (parallel): C = max(850, 1200 − 0.4·H) · S = 1600·T + C + Z · two-hand: S = 1600·T + 250 (C = 0 if hands covered) · guard locking needed if t<sub>stop</sub> &gt; distance ÷ 1600</p>`) +
    `<div class="fe-row"><button class="mx-el" id="f7GRst">Reset to example values</button></div>
    <div id="f7GSum"></div>
    <div class="grid2">
      <div><h3 class="fe-h3">Selected case</h3><div id="f7GIn"></div></div>
      <div><h3 class="fe-h3">Result</h3><div id="f7GRes"></div></div>
    </div>
    <div class="fe-scroll"><svg id="f7GDraw" class="fe-chart f7-wide" viewBox="0 0 720 210" role="img" aria-label="Drawing of the safety distance"></svg></div>
    <h3 class="fe-h3">Guard locking decision (ISO 14119) – is the hazard still moving when the person arrives?</h3>
    <div id="f7GGl"></div>` +
    useCase(`at the load station a 30 mm curtain needs 498 mm, but if the rotary table brake wears and the stop time grows from 150 to 265 ms the
      distance jumps to 608 mm – that is why the stop time is <b>measured</b> at commissioning and every year (7L) and the curtain is mounted with
      margin. Spindles that run down for seconds always need guard locking (the door stays locked until standstill is detected).`));
}
function init7G() {
  const drawSum = () => {
    $("f7GSum").innerHTML = tab(["Case", "Type", "T s", "S mm"], S.dist.cases.map((c, i) => { const r = distance(c); return `<tr class="f7-click${i === S.dist.sel ? " f7-hl" : ""}" data-dc="${i}"><td><b>${esc(c.name)}</b></td><td>${DTYPE[c.type]}</td><td>${fx(r.T, 3)}</td><td><b>${fx(r.S, 0)}</b></td></tr>`; }), "f7-small");
  };
  const drawIn = () => {
    const i = S.dist.sel, c = S.dist.cases[i], p = `dist.cases.${i}`;
    let extra = "";
    if (c.type === "aopd") extra = `<tr><td>Resolution d [mm]</td><td>${cellIn(p + ".d", c.d)}</td></tr>`;
    if (c.type === "scanner") extra = `<tr><td>Height of the protective field H [mm]</td><td>${cellIn(p + ".H", c.H)}</td></tr><tr><td>Tolerance Z [mm]</td><td>${cellIn(p + ".Z", c.Z)}</td></tr>`;
    if (c.type === "twohand") extra = `<tr><td>Hands covered (C = 0)</td><td><input type="checkbox" data-p="${p}.covered"${c.covered ? " checked" : ""}></td></tr>`;
    $("f7GIn").innerHTML = `<p class="sub">${DTYPE[c.type]}</p><table class="am-kv f7-kv f7-in"><tbody>${c.times.map((t, j) => `<tr><td>Time: ${esc(t[0])} [s]</td><td>${cellIn(`${p}.times.${j}.1`, t[1])}</td></tr>`).join("")}${extra}</tbody></table>`;
  };
  const draw = () => {
    drawSum();
    const c = S.dist.cases[S.dist.sel], r = distance(c);
    $("f7GRes").innerHTML = kv([["T = Σ times", fx(r.T, 3) + " s"], ["Approach speed K", r.K + " mm/s"], ["K·T", fx(r.K * r.T, 1) + " mm"], ["C (reach-through)" + (r.Z ? " + Z" : ""), fx(r.C, 1) + (r.Z ? " + " + fx(r.Z, 0) : "") + " mm"], ["Rule applied", esc(r.note || "standard formula")], ["Safety distance S", `<b class="fe-big">${fx(r.S, 0)} mm</b>`]]);
    drawDist(c, r);
    $("f7GGl").innerHTML = tab(["Hazard", "Stopping time t<sub>stop</sub> s", "Distance door → hazard mm", "Access time s", "Guard locking"], S.dist.gl.map((g, i) => { const x = guardLock(g);
      return `<tr><td><b>${esc(g[0])}</b></td><td>${cellIn(`dist.gl.${i}.1`, g[1])}</td><td>${cellIn(`dist.gl.${i}.2`, g[2])}</td><td>${fx(x.ta, 3)}</td><td>${x.req ? '<b class="f7-warn">required</b> – lock until standstill' : '<span class="fe-ok">not required</span> – interlock without locking is enough'}</td></tr>`; }), "f7-small");
  };
  $("f7GSum").addEventListener("click", (e) => { const t = e.target.closest("[data-dc]"); if (!t) return; S.dist.sel = +t.dataset.dc; save("dist"); drawIn(); draw(); });
  bindIn("f7GIn", "dist", draw);
  $("f7GGl").addEventListener("input", (e) => { const t = e.target; if (!t.dataset.p) return; setP(S, t.dataset.p, num(t.value)); save("dist");
    const i = +t.dataset.p.split(".")[2], x = guardLock(S.dist.gl[i]); const row = t.closest("tr"); row.cells[3].textContent = fx(x.ta, 3);
    row.cells[4].innerHTML = x.req ? '<b class="f7-warn">required</b> – lock until standstill' : '<span class="fe-ok">not required</span> – interlock without locking is enough'; });
  $("f7GRst").addEventListener("click", () => { resetSec("dist"); drawIn(); draw(); });
  drawIn(); draw();
}
function drawDist(c, r) {
  const x0 = 70, sc = 600 / Math.max(2000, r.S * 1.05), y = 110, X = (mm) => x0 + mm * sc;
  const kt = Math.min(r.S, r.K * r.T), rest = r.S - kt;
  let s = `<rect x="20" y="40" width="${x0 - 20}" height="140" rx="4" class="f7-haz"/><text x="${(x0 + 20) / 2}" y="34" text-anchor="middle" class="f7-lbl">hazard</text>
    <line x1="${X(r.S)}" y1="40" x2="${X(r.S)}" y2="180" class="f7-dev"/><text x="${X(r.S)}" y="34" text-anchor="middle" class="f7-lbl">${c.type === "twohand" ? "two-hand device" : c.type === "scanner" ? "edge of scanner field" : "light curtain"}</text>
    <rect x="${x0}" y="${y - 8}" width="${kt * sc}" height="16" class="f7-seg1"/><rect x="${X(kt)}" y="${y - 8}" width="${rest * sc}" height="16" class="f7-seg2"/>
    <text x="${x0 + kt * sc / 2}" y="${y + 26}" text-anchor="middle" class="f7-sm">K·T = ${fx(r.K * r.T, 0)}</text>
    ${rest > 0.5 ? `<text x="${X(kt) + rest * sc / 2}" y="${y + 26}" text-anchor="middle" class="f7-sm">C${r.Z ? "+Z" : ""} = ${fx(rest, 0)}</text>` : ""}
    <line x1="${x0}" y1="${y - 26}" x2="${X(r.S)}" y2="${y - 26}" class="f7-dim"/><text x="${(x0 + X(r.S)) / 2}" y="${y - 32}" text-anchor="middle" class="f7-lbl">S = ${fx(r.S, 0)} mm</text>
    <path d="M${Math.min(700, X(r.S) + 80)} ${y + 44}L${X(r.S) + 10} ${y + 44}" class="f7-arrow"/><text x="${Math.min(700, X(r.S) + 84)}" y="${y + 48}" class="f7-sm">${c.type === "aopd" && c.d <= 40 ? "hand" : "person"} approaches</text>`;
  for (let mm = 0; mm <= Math.max(2000, r.S * 1.05); mm += 500) s += `<text x="${X(mm)}" y="200" text-anchor="middle" class="fe-tick">${mm}</text>`;
  $("f7GDraw").innerHTML = s;
}
