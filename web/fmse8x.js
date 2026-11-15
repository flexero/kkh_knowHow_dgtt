/* FMS engineering – item 8 engine + drawings (used by fmse8.js).
 * calcList / calcModule / calcKit implement EX8._rules of tools/fmse/examples/item8_examples.json EXACTLY
 * (same results as guide docs/FMS system design/68_module_circuits.md and tools/fmse/*.py; Python round() emulated).
 * SVG generators: pattern / instance schematic, module overview (cabinet ↔ field), kit single-line diagram.
 * All values are EXAMPLES – real circuits need qualified design and sign-off to IEC 60204-1. */
import { EX8, PTXT, IN_CABINET } from "./fmse8_data.js";
import { KITS } from "./fmse6_data.js";
export { KITS };

/* ------------------------------------------------------------------ helpers */
export const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const fx = (x, d = 1) => (Number.isFinite(x) ? x.toLocaleString("en", { maximumFractionDigits: d, minimumFractionDigits: d }) : "–");
export const store = {   // own keys "fmse.8.<k>"
  get(k, d) { try { const v = localStorage.getItem("fmse.8." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("fmse.8." + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  del(k) { try { localStorage.removeItem("fmse.8." + k); } catch (e) { /* storage blocked */ } },
};
export const ul = (a) => `<ul class="am-ul">${a.map((x) => `<li>${x}</li>`).join("")}</ul>`;
export const card = (id, title, sub, body) => `<div class="card" id="${id}"><div class="card-head"><h2>${title}</h2><span class="sub">${sub}</span></div>${body}</div>`;
export const tab = (head, rows, cls = "") => `<div class="fe-scroll"><table class="am-tab ${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
export const kv = (rows) => `<table class="am-kv f8-kv"><tbody>${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join("")}</tbody></table>`;
export const kpis = (a) => `<div class="phd-kpis">${a.map(([n, v, c]) => `<div class="phd-kpi"><b class="${c || ""}">${v}</b><span>${n}</span></div>`).join("")}</div>`;
export const intro = (html) => `<div class="fx-guide"><div class="fx-prin">${html}</div></div>`;
export const useCase = (t) => `<p class="am-note f8-use"><b>Use case in an FMS:</b> ${t}</p>`;
export const csvDownload = (name, rows) => {
  const q = (v) => { const s = String(v == null ? "" : v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const blob = new Blob(["﻿" + rows.map((r) => r.map(q).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
};

/* Python round(x, n): exact decimal expansion, ties to even (toFixed alone rounds ties up) */
export function pyRound(x, n) {
  if (!Number.isFinite(x)) return x;
  const s = Math.abs(x).toFixed(Math.min(100, n + 40)), dot = s.indexOf("."), tail = s.slice(dot + 1 + n);
  if (/^50*$/.test(tail)) {   // exact tie
    const digits = (s.slice(0, dot) + s.slice(dot + 1, dot + 1 + n)).replace(/^0+(?=\d)/, "");
    let v = BigInt(digits || "0"); if (v % 2n === 1n) v += 1n;
    return Math.sign(x) * Number(v) / Math.pow(10, n);
  }
  return +x.toFixed(n);
}

/* ------------------------------------------------------------------ the rules (EX8._rules) */
export const C = EX8.constants, PAT = EX8.patterns, MODS = EX8.modules, CH = C.channels, UC = EX8.unit_codes;
export const TYPES = ["DI", "DO", "AI", "AO", "FDI", "FDO"];
export const CODES = Object.keys(MODS);
const SQ3 = Math.sqrt(3);
const nextGE = (arr, v) => arr.find((x) => x >= v);
const nsum = (a) => { let s = 0, c = 0; for (const x of a) { const t = s + x; c += Math.abs(s) >= Math.abs(x) ? (s - t) + x : (x - t) + s; s = t; } return s + c; };
export const isSafety = (p) => PAT[p].io.some((x) => x[1] === "FDI" || x[1] === "FDO");
export const unitOf = (code, nr = 1) => UC[code] + String(nr).padStart(2, "0");

/** expand an instance list for one module unit – returns every derived list + the reference numbers */
export function calcList(instances, unit) {
  const io = [], dev = [], cab = [], cnt = {}, bom = {}, loads = [], motors = [], terms = [], i24L = [], lossL = [], pcabs = [];
  let tx = 0, i24 = 0, loss = 0;
  instances.forEach(([p, g, k], ii) => {
    const pt = PAT[p], sym = (PTXT[p] && PTXT[p].sym) || [];
    const d0 = dev.length, c0 = cab.length, io0 = io.length;
    pt.dev.forEach(([cl, ds, b]) => { cnt[cl] = (cnt[cl] || 0) + 1; dev.push({ ii, cl, n: cnt[cl], des: `=${C.cell}.${unit}-${cl}${cnt[cl]}`, short: `-${cl}${cnt[cl]}`, ds, bom: b }); bom[b] = (bom[b] || 0) + 1; });
    const pc = pt.pcab; let pcRow = null;
    if (pc) {   // _rules.power_cable: cores of the power cable sized per instance (Ib <= Ip <= Iz*k)
      const motor = pt.power === "motor" || pt.power === "vfd";
      const Ib = motor ? k.kW * 1000 / (SQ3 * 400 * (k.eta != null ? k.eta : 0.88) * (k.cos != null ? k.cos : 0.82)) : k.kW * 1000 / (SQ3 * 400 * (k.cos != null ? k.cos : 1.0));
      const Ip = motor ? pyRound(Ib, 2) : nextGE(C.breaker_ratings, Ib), Izreq = Ip / (C.k_temp * C.k_group), row = C.ampacity_table.find(([, z]) => z >= Izreq);
      pcRow = { ii, group: g, p, kW: k.kW, Ib: pyRound(Ib, 2), Ip, Izreq, A: row[0], Iz: row[1], cores: pc.prefix + String(row[0]) + pc.suffix, motor };
      pcabs.push(pcRow);
    }
    pt.cab.forEach(([ds, cores, ln], ci) => { const c = { ii, wd: "WD" + (cab.length + 1), ds, cores: pcRow && ci === pc.index ? pcRow.cores : cores, len: k.len != null ? k.len : ln }; if (pcRow && ci === pc.index) { pcRow.wd = c.wd; pcRow.len = c.len; pcRow.old = cores; } cab.push(c); });
    pt.io.forEach(([s, t, ds], j) => { const sy = sym[j] || [0, "no", -1]; io.push({ ii, tag: `PLT1.MACH.FMS1.${unit}.${g}.${s}`, sig: s, group: g, t, ds, dev: dev[d0 + sy[0]], kind: sy[1], cab: sy[2] >= 0 ? cab[c0 + sy[2]] : null }); });
    pt.io.forEach((x, j) => terms.push({ ii, io: io[io0 + j] }));
    for (let j = 0; j < pt.tx; j++) terms.push({ ii, extra: j, of: pt.tx, cab: cab[c0] || null });
    tx += pt.tx; i24 += pt.i24; i24L.push([g, p, pt.i24]);
    const kind = pt.power;
    if (kind === "load") loads.push([k.kW, k.ku, k.cos, g, p]);
    if (kind === "motor" || kind === "vfd") {
      const kw = k.kW, eta = k.eta != null ? k.eta : 0.88, cs = k.cos != null ? k.cos : 0.82, In = kw * 1000 / (SQ3 * 400 * eta * cs);
      const sz = kind === "motor" ? nextGE(C.contactor_ac3, In) : nextGE(C.vfd_kw, kw);
      motors.push([g, p, kw, pyRound(In, 3), sz]); loads.push([kw, k.ku != null ? k.ku : 0.7, cs, g, p]);
      const l = kind === "vfd" ? 0.03 * kw * 1000 : pt.loss; loss += l; lossL.push([g, p, l]);
    } else { loss += pt.loss; lossL.push([g, p, pt.loss]); }
    if (kind === "heater") loads.push([k.kW, k.ku != null ? k.ku : 0.8, k.cos != null ? k.cos : 1.0, g, p]);
  });
  const used = {}, cards = {};
  TYPES.forEach((t) => { used[t] = io.filter((x) => x.t === t).length; });
  TYPES.forEach((t) => { cards[t] = used[t] ? Math.ceil(used[t] * (1 + C.reserve) / CH[t]) : 0; });
  const ct = TYPES.reduce((s, t) => s + cards[t], 0);
  if (io.length) {
    i24 += 0.3 + 0.05 * ct; loss += 4 + ct; bom["IO station bus interface"] = 1;
    i24L.push(["IO station", "bus interface + " + ct + " cards", 0.3 + 0.05 * ct]); lossL.push(["IO station", "bus interface + cards", 4 + ct]);
    TYPES.forEach((t) => { if (cards[t]) bom[`${t} ${CH[t]} card`] = cards[t]; });
  }
  const psu = i24 > 0 ? nextGE(C.psu_sizes, i24 * 1.25) : 0;
  if (psu) { const l = psu * 24 * (1 / 0.92 - 1); loss += l; lossL.push(["24 V PSU", psu + " A", l]); bom[`24 V power supply ${psu} A`] = 1; loads.push([psu * 24 / 0.9 / 1000, 0.6, 0.95, "Control power", "PSU"]); }
  const nT = io.length + tx;
  if (nT) bom["Control terminal"] = nT;
  terms.forEach((t, i) => { t.n = i + 1; });
  const sum = (f) => nsum(loads.map(f));   // Python 3.12 sum() of floats is compensated (Neumaier)
  const Pk = sum(([a, b]) => a * b), Qk = sum(([a, b, c]) => a * b * Math.tan(Math.acos(c))), S = Math.hypot(Pk, Qk), I = S * 1000 / (SQ3 * 400);
  const Pi = sum(([a]) => a), Qi = sum(([a, , c]) => a * Math.tan(Math.acos(c))), Ii = Math.hypot(Pi, Qi) * 1000 / (SQ3 * 400);
  const In = Ii > 0 ? nextGE(C.breaker_ratings, Ii) : 0;
  const A = In ? C.ampacity_table.find(([, z]) => z >= In / (C.k_temp * C.k_group))[0] : 0;
  const k = {}; TYPES.forEach((t) => { k[t] = 0; });
  io.forEach((x) => { const n = k[x.t]; x.card = Math.floor(n / CH[x.t]) + 1; x.ch = n % CH[x.t]; x.addr = `${x.t}${x.card}.${String(x.ch).padStart(2, "0")}`; k[x.t]++; });
  const bomS = {}; Object.keys(bom).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).forEach((b) => { bomS[b] = bom[b]; });
  return {
    unit, instances, io, dev, cab, terms, loads, i24L, lossL, used, cards, cardsTotal: ct, spare: Object.fromEntries(TYPES.map((t) => [t, cards[t] * CH[t] - used[t]])),
    nTerms: nT, nCables: cab.length, metres: cab.reduce((s, c) => s + c.len, 0), nDevices: dev.length, i24: pyRound(i24, 4), i24raw: i24, psu,
    P: pyRound(Pk, 3), Q: Qk, S: pyRound(S, 3), I: pyRound(I, 2), Pinst: Pi, Qinst: Qi, Sinst: Math.hypot(Pi, Qi), Iinst: loads.length ? pyRound(Ii, 2) : 0, In, A,
    loss: pyRound(loss, 1), motors, pcabs, bom: bomS, maxtag: io.reduce((m, x) => Math.max(m, x.tag.length), 0),
  };
}
export function calcModule(code, nr = 1) { const r = calcList(MODS[code].instances, unitOf(code, nr)); r.code = code; r.nr = nr; r.title = MODS[code].title; r.feederN = r.dev.filter((d) => d.cl === "FC").length + 1; r.feeder = `=${C.cell}.${r.unit}-FC${r.feederN}`; return r; }

/** kit = list of module codes (codes may repeat; unit number counts up per code) */
export function calcKit(list) {
  const nr = {}, mods = list.map((c) => { nr[c] = (nr[c] || 0) + 1; return calcModule(c, nr[c]); });
  const tot = { io: 0, cards: {}, used: {}, terms: 0, cables: 0, metres: 0, P: 0, S: 0, psu: 0, loss: 0, devices: 0 };
  TYPES.forEach((t) => { tot.cards[t] = 0; tot.used[t] = 0; });
  mods.forEach((r) => {
    tot.io += r.io.length; tot.terms += r.nTerms; tot.cables += r.nCables; tot.metres += r.metres; tot.P += r.P; tot.S += r.S; tot.psu += r.psu; tot.loss += r.loss; tot.devices += r.nDevices;
    TYPES.forEach((t) => { tot.cards[t] += r.cards[t]; tot.used[t] += r.used[t]; });
  });
  ["P", "S", "psu", "loss"].forEach((x) => { tot[x] = pyRound(tot[x], 3); });
  tot.I = pyRound(tot.S * 1000 / (SQ3 * 400), 2); tot.modules = list.length; tot.cardsTotal = TYPES.reduce((s, t) => s + tot.cards[t], 0);
  return { mods, tot };
}
/** demo instance of one pattern (8B): typical parameters, unit "XX01" */
export const DEMO_PAR = { motor: { kW: 4 }, vfd: { kW: 4 }, heater: { kW: 9 }, load: { kW: 10, ku: 0.6, cos: 0.9 } };
export const calcPattern = (p) => calcList([[p, "Demo", DEMO_PAR[PAT[p].power] || {}]], "XX01");

/* ================================================================== shared page state (fmse8.js + fmse8y.js) */
export const DEFAULT_KIT = EX8.kit.name;
export const S = {
  pat: store.get("pat", "DOL"), mod: store.get("mod", "M03"), inst: 0,
  kitName: store.get("kitName", DEFAULT_KIT), kit: store.get("kit", null),
  scopeG: store.get("scopeG", "module"), scopeI: store.get("scopeI", "module"),
  fat: store.get("fat", {}), chk: store.get("chk", {}),
};
if (!PAT[S.pat]) S.pat = "DOL";
export const kitList = () => (S.kit && S.kit.length ? S.kit : (KITS[S.kitName] || EX8.kit.modules)).slice();
export const getKit = () => calcKit(kitList());
if (!MODS[S.mod]) S.mod = "M03";
const redraws = [];
export const onRefresh = (f) => redraws.push(f);
export function refresh() { redraws.forEach((f) => { try { f(); } catch (e) { console.error("fmse8 redraw", e); } }); }
export function setMod(code) { if (!MODS[code]) return; S.mod = code; S.inst = 0; store.set("mod", code); refresh(); }
export const modSel = (cls) => `<label class="f8-msel">Module <select class="fe-sel f8-modsel ${cls || ""}">${CODES.map((c) => `<option value="${c}"${c === S.mod ? " selected" : ""}>${c} · ${esc(MODS[c].title)}</option>`).join("")}</select></label>`;
export function wireModSel(root) { root.querySelectorAll(".f8-modsel").forEach((s) => s.addEventListener("change", () => setMod(s.value))); }
onRefresh(() => document.querySelectorAll(".f8-modsel").forEach((s) => { s.value = S.mod; }));

/* ================================================================== SVG primitives */
const L = (x1, y1, x2, y2, c = "f8-w") => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${c}"/>`;
const T = (x, y, t, a = "start", c = "f8-sm") => `<text x="${x}" y="${y}" text-anchor="${a}" class="${c}">${t}</text>`;
const R = (x, y, w, h, c = "f8-box", rx = 3) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="${c}"/>`;
const CIRC = (x, y, r, c = "f8-sym") => `<circle cx="${x}" cy="${y}" r="${r}" class="${c}"/>`;
const short = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const lineCls = (t) => (t === "FDI" || t === "FDO" ? "f8-safe" : t === "AI" || t === "AO" ? "f8-ana" : "f8-w");

/* horizontal power-path symbols centred at x on line y (single-line, /// = 3 phases) */
const PW = {
  breaker: (x, y, mp) => L(x - 22, y, x - 12, y, "f8-pw") + L(x - 12, y, x + 10, y - 12, "f8-pw") + L(x + 12, y, x + 22, y, "f8-pw") + L(x + 9, y - 4, x + 15, y + 4) + L(x + 9, y + 4, x + 15, y - 4) +
    (mp ? R(x - 8, y + 8, 16, 10, "f8-sym", 1) + T(x, y + 16, "I&gt;", "middle", "f8-xs") : ""),
  contactor: (x, y) => L(x - 22, y, x - 12, y, "f8-pw") + L(x - 12, y, x + 10, y - 12, "f8-pw") + L(x + 12, y, x + 22, y, "f8-pw") + `<path d="M${x + 12} ${y} a4 4 0 0 0 0 -8" class="f8-w"/>`,
  inverter: (x, y) => L(x - 30, y, x - 20, y, "f8-pw") + R(x - 20, y - 18, 40, 36, "f8-sym", 1) + L(x - 20, y + 18, x + 20, y - 18) + T(x - 9, y - 5, "~", "middle", "f8-lbl") + T(x + 9, y + 13, "~", "middle", "f8-lbl") + L(x + 20, y, x + 30, y, "f8-pw"),
  motor: (x, y) => CIRC(x, y, 18) + T(x, y - 1, "M", "middle", "f8-lbl") + T(x, y + 12, "3~", "middle", "f8-xs"),
  heater: (x, y) => R(x - 22, y - 10, 44, 20, "f8-sym", 1) + `<path d="M${x - 16} ${y}l4 -6l6 12l6 -12l6 12l6 -12l4 6" class="f8-w"/>`,
  load: (x, y) => R(x - 40, y - 18, 80, 36, "f8-box") + T(x, y - 3, "machine", "middle", "f8-lbl") + T(x, y + 11, "own electrics", "middle", "f8-xs"),
  phases: (x, y) => [0, 5, 10].map((d) => L(x + d - 3, y + 5, x + d + 3, y - 5)).join(""),
};
/* control symbols centred at x on row line y (line arrives from the left) */
const SY = {
  no: (x, y, c) => L(x - 20, y, x - 10, y, c) + L(x - 10, y, x + 8, y - 10, c) + L(x + 10, y, x + 20, y, c),
  nc: (x, y, c) => L(x - 20, y, x - 10, y, c) + L(x - 10, y, x + 10, y + 8, c) + L(x + 10, y, x + 10, y + 10, c) + L(x + 10, y, x + 20, y, c),
  pb: (x, y, c) => SY.no(x, y, c) + L(x - 1, y - 5, x - 1, y - 16, "f8-dash") + L(x - 7, y - 16, x + 5, y - 16),
  pnp: (x, y, c) => L(x - 20, y, x - 14, y, c) + R(x - 14, y - 10, 28, 20, "f8-sym", 1) + `<path d="M${x} ${y - 7}l7 7l-7 7l-7 -7z" class="f8-w"/>` + L(x + 14, y, x + 20, y, c),
  ossd: (x, y, c) => L(x - 20, y, x - 18, y, c) + R(x - 18, y - 9, 36, 18, "f8-sym", 1) + T(x, y + 4, "OSSD", "middle", "f8-xs") + L(x + 18, y, x + 20, y, c),
  coil: (x, y, c, valve) => L(x - 20, y, x - 12, y, c) + R(x - 12, y - 8, 24, 16, "f8-sym", 0) + (valve ? L(x - 12, y + 8, x + 12, y - 8) : "") + L(x + 12, y, x + 20, y, c),
  lamp: (x, y, c) => L(x - 20, y, x - 8, y, c) + CIRC(x, y, 8) + L(x - 5.5, y - 5.5, x + 5.5, y + 5.5) + L(x - 5.5, y + 5.5, x + 5.5, y - 5.5) + L(x + 8, y, x + 20, y, c),
  sto: (x, y, c) => L(x - 20, y, x - 16, y, c) + R(x - 16, y - 9, 32, 18, "f8-sym", 1) + T(x, y + 4, "STO", "middle", "f8-xs") + L(x + 16, y, x + 20, y, c),
  ai: (x, y, c, letter) => L(x - 20, y, x - 10, y, c) + CIRC(x, y, 10) + T(x, y + 4, letter || "P", "middle", "f8-xs") + L(x + 10, y, x + 20, y, c),
  relay: (x, y, c) => L(x - 20, y, x - 14, y, c) + R(x - 14, y - 8, 14, 16, "f8-sym", 0) + L(x, y, x + 2, y, c) + L(x + 2, y, x + 14, y - 8, c) + L(x + 14, y, x + 20, y, c),
  edm: (x, y, c) => L(x - 20, y, x - 16, y, c) + L(x - 16, y, x - 6, y + 6, c) + L(x - 6, y, x - 6, y + 7, c) + L(x - 6, y, x + 4, y, c) + L(x + 4, y, x + 14, y + 6, c) + L(x + 14, y, x + 14, y + 7, c) + L(x + 14, y, x + 20, y, c),
  sout: (x, y, c) => L(x - 20, y, x + 14, y, c) + `<path d="M${x + 8} ${y - 5}L${x + 16} ${y}L${x + 8} ${y + 5}" class="${c}"/>` + L(x + 16, y, x + 20, y, c),
  sig: (x, y, c) => SY.sout(x, y, c),
};

/** schematic of one instance ii of a module result r (or a calcPattern result, ii = 0) */
export function svgInstance(r, ii = 0) {
  const [p, g] = r.instances[ii], pt = PAT[p], W = 760;
  const io = r.io.filter((x) => x.ii === ii), dv = r.dev.filter((d) => d.ii === ii), cb = r.cab.filter((c) => c.ii === ii), tm = r.terms.filter((t) => t.ii === ii);
  const power = ["motor", "vfd", "heater", "load"].includes(pt.power);
  let s = T(10, 16, `${esc(p)} · ${esc(pt.title)} · instance "${esc(g)}" of unit ${esc(r.unit)}`, "start", "f8-lbl"), y = 34;
  const drawnDev = new Set();
  if (power) {   // ---- power path
    const yl = y + 48, byCl = (cl) => dv.find((d) => d.cl === cl);
    s += T(10, y + 6, "power circuit (single-line, /// = 3 phases + PE)", "start", "f8-xs");
    s += T(12, yl - 8, "-XD1", "start", "f8-xs") + T(12, yl + 16, "400 V 3~", "start", "f8-xs") + L(10, yl, 640, yl, "f8-pw") + PW.phases(60, yl);
    const pc = cb.find((c) => /power|motor/i.test(c.ds)) || cb[0];
    const els = pt.power === "load" ? [["FC", 160, "breaker"]] : pt.power === "vfd" ? [["FC", 140, "breaker"], ["TA", 270, "inverter"]] : [["FC", 140, "breaker"], ["QA", 260, "contactor"]];
    els.forEach(([cl, x, kind]) => { const d = byCl(cl); if (!d) return; drawnDev.add(d); s += `<rect x="${x - 34}" y="${yl - 6}" width="68" height="12" class="f8-bg"/>` + PW[kind](x, yl, pt.power === "motor" && kind === "breaker") + T(x, yl - 24, d.short, "middle", "f8-lbl") + T(x, yl + 34, esc(short(d.ds, 26)), "middle", "f8-xs"); });
    const endX = 560, endEl = pt.power === "load" ? "load" : pt.power === "heater" ? "heater" : "motor", endD = byCl(pt.power === "heater" ? "EB" : "MA");
    s += `<rect x="${endX - 46}" y="${yl - 22}" width="140" height="44" class="f8-bg"/>` + PW[endEl](endX, yl) + L(endX + (endEl === "load" ? 40 : 22), yl, endX + 80, yl, "f8-bg2");
    if (endD) { drawnDev.add(endD); s += T(endX, yl - 26, endD.short, "middle", "f8-lbl") + T(endX, yl + 34, esc(short(endD.ds, 26)), "middle", "f8-xs"); }
    if (pc) s += T(420, yl - 6, `-${pc.wd}  ${esc(pc.cores)}`, "middle", "f8-xs") + T(420, yl + 14, `${pc.len} m`, "middle", "f8-xs") + (pt.power === "vfd" ? `<ellipse cx="420" cy="${yl}" rx="14" ry="6" class="f8-dash"/>` : "");
    if (pt.power === "motor" || pt.power === "vfd") { const m = r.motors.find((mm) => mm[0] === g); if (m) s += T(756, yl - 26, `I<tspan class="f8-subs">n</tspan> = ${fx(m[3], 2)} A · ${pt.power === "motor" ? "contactor " + m[4] + " A AC-3" : "inverter " + m[4] + " kW"}`, "end", "f8-xs"); }
    y = yl + 50;
  }
  // ---- control rows
  if (io.length || tm.length) {
    s += T(10, y + 10, "control circuit: IO card → terminal -XD2 → (cable) → field device · red = safety channel (F-DI / F-DO), blue = analogue", "start", "f8-xs"); y += 24;
    const rows = tm.length, y0 = y;
    s += R(10, y0 - 6, 168, rows * 34 + 4, "f8-card") + T(16, y0 + 6, "", "start");
    let runStart = 0;
    tm.forEach((t, j) => {
      const yy = y0 + 12 + j * 34;
      if (t.io) {
        const x = t.io, c = lineCls(x.t);
        s += T(16, yy + 4, `<tspan class="f8-b">${x.addr}</tspan> ${esc(short(x.sig, 12))}`, "start", "f8-sm") + L(178, yy, 236, yy, c) + CIRC(240, yy, 4, "f8-term") + T(240, yy - 7, "-XD2:" + t.n, "middle", "f8-xs") + L(244, yy, 420, yy, c);
        s += T(330, yy - 4, x.cab ? "-" + x.cab.wd : "in cabinet", "middle", "f8-xs");
        const letter = x.dev && x.dev.cl === "BT" ? "T" : "P";
        s += (SY[x.kind] || SY.no)(440, yy, c, x.kind === "ai" ? letter : x.dev && x.dev.cl === "MB") + L(460, yy, 486, yy, c);
        drawnDev.add(x.dev);
        const nxt = tm[j + 1];
        if (!nxt || !nxt.io || nxt.io.dev !== x.dev) {   // close the device box for the run
          const ya = y0 + 12 + runStart * 34 - 15, yb = yy + 15;
          s += R(486, ya, 266, yb - ya, "f8-dev") + T(494, ya + 12, `<tspan class="f8-b">${x.dev.short}</tspan> ${esc(short(x.dev.ds, 34))}`, "start", "f8-sm") + T(494, ya + 25, esc(short(x.ds, 44)), "start", "f8-xs");
          runStart = j + 1;
        }
      } else {
        const lab = t.of === 1 ? (pt.io.some((q) => q[1] === "AI") ? "+24 V loop supply" : "0 V common") : t.extra % 2 === 0 ? "+24 V field supply" : "0 V field supply";
        s += T(16, yy + 4, esc(lab), "start", "f8-sm") + L(178, yy, 236, yy) + CIRC(240, yy, 4, "f8-term") + T(240, yy - 7, "-XD2:" + t.n, "middle", "f8-xs") + L(244, yy, 486, yy, "f8-dash") + T(494, yy + 4, t.cab ? "to the field devices in -" + t.cab.wd : "supply", "start", "f8-xs");
        runStart = j + 1;
      }
    });
    y = y0 + rows * 34 + 10;
  }
  // ---- devices without IO (bus devices, PCs …)
  const rest = dv.filter((d) => !drawnDev.has(d));
  if (rest.length) {
    s += T(10, y + 10, "devices without IO wires (bus / Ethernet / internal)", "start", "f8-xs"); y += 18;
    rest.forEach((d, j) => {
      const yy = y + j * 34, c = cb.find((cc) => /Ethernet|IO-Link/.test(cc.ds));
      s += R(10, yy, 240, 26, "f8-dev") + T(18, yy + 17, `<tspan class="f8-b">${d.short}</tspan> ${esc(short(d.ds, 30))}`, "start", "f8-sm");
      s += c ? L(250, yy + 13, 486, yy + 13, "f8-net") + T(368, yy + 9, `-${c.wd} ${esc(short(c.cores, 30))}`, "middle", "f8-xs") + R(486, yy, 200, 26, "f8-box") + T(586, yy + 17, /IO-Link/.test(c.ds) ? "IO-Link master port" : "cell switch / partner", "middle", "f8-sm")
        : L(250, yy + 13, 300, yy + 13, "f8-dash") + T(306, yy + 17, d.cl === "MB" ? "valve block, see coils above" : "24 V + internal wiring", "start", "f8-xs");
    });
    y += rest.length * 34 + 4;
  }
  return `<svg class="fe-chart f8-sch" viewBox="0 0 ${W} ${y + 6}" role="img" aria-label="Schematic of ${esc(p)} ${esc(g)}">${s}</svg>`;
}

/** module overview: cabinet with IO station + cards + cabinet devices ↔ field devices per instance with cables */
export function svgModule(r) {
  const W = 780, inst = r.instances.map((x, ii) => ({ ii, p: x[0], g: x[1], fd: r.dev.filter((d) => d.ii === ii && !IN_CABINET.includes(d.cl)), cb: r.cab.filter((c) => c.ii === ii) }));
  const rows = inst.filter((x) => x.fd.length || x.cb.length), cabDev = r.dev.filter((d) => IN_CABINET.includes(d.cl));
  const cardsL = []; TYPES.forEach((t) => { for (let c = 1; c <= r.cards[t]; c++) cardsL.push([t, c, Math.max(0, Math.min(CH[t], r.used[t] - (c - 1) * CH[t]))]); });
  const cabRowsH = 24 + (cardsL.length ? 54 : 0) + Math.ceil(cabDev.length / 3) * 24 + 40;
  const H = Math.max(cabRowsH + 40, rows.length * 26 + 70);
  let s = R(10, 30, 330, H - 40, "f8-cab", 6) + T(18, 46, `cabinet =FMS1.${esc(r.unit)} +${esc(r.unit)}CAB`, "start", "f8-lbl");
  let y = 56;
  if (cardsL.length) {
    s += R(20, y, 40, 46, "f8-sym", 2) + T(40, y + 20, "bus", "middle", "f8-xs") + T(40, y + 32, "IF", "middle", "f8-xs");
    cardsL.forEach(([t, c, u], i) => { const x = 62 + i * 34; if (x > 300) return; s += R(x, y, 32, 46, "f8-card", 2) + T(x + 16, y + 12, t, "middle", "f8-xs") + T(x + 16, y + 24, "#" + c, "middle", "f8-xs") + `<rect x="${x + 4}" y="${y + 30}" width="24" height="8" class="f8-barbg"/><rect x="${x + 4}" y="${y + 30}" width="${(24 * u / CH[t]).toFixed(1)}" height="8" class="${t.startsWith("F") ? "f8-barS" : "f8-bar"}"/>`; });
    y += 54;
  }
  if (r.psu) { s += R(20, y, 96, 20, "f8-sym", 2) + T(68, y + 14, `PSU 24 V ${r.psu} A`, "middle", "f8-xs"); }
  s += R(122, y, 96, 20, "f8-sym", 2) + T(170, y + 14, `-XD2 (${r.nTerms})`, "middle", "f8-xs");
  if (r.In) s += R(224, y, 106, 20, "f8-sym", 2) + T(277, y + 14, `feeder ${r.In} A / ${r.A} mm²`, "middle", "f8-xs");
  y += 28;
  cabDev.forEach((d, i) => { const x = 20 + (i % 3) * 104, yy = y + Math.floor(i / 3) * 24; s += R(x, yy, 100, 20, "f8-dev", 2) + T(x + 4, yy + 14, `<tspan class="f8-b">${d.short}</tspan> ${esc(short(d.ds, 11))}`, "start", "f8-xs"); });
  // field side
  s += T(420, 22, "field devices (per instance) and cables", "start", "f8-lbl");
  rows.forEach((x, i) => {
    const yy = 40 + i * 26, safe = isSafety(x.p), cls = safe ? "f8-safe" : x.cb.some((c) => /Ethernet/.test(c.ds)) ? "f8-net" : "f8-w";
    s += L(340, yy + 9, 412, yy + 9, cls) + T(376, yy + 5, x.cb.length ? (x.cb.length > 1 ? `-${x.cb[0].wd}…${x.cb[x.cb.length - 1].wd.slice(2)}` : "-" + x.cb[0].wd) : "", "middle", "f8-xs");
    s += R(412, yy, 360, 20, safe ? "f8-devS" : "f8-dev", 2) + T(418, yy + 14, `<tspan class="f8-b">${esc(x.g)}</tspan> ${esc(x.p)} · ${x.fd.map((d) => d.short).join(" ") || "cable only"}`, "start", "f8-xs");
  });
  if (!rows.length) s += T(420, 50, "no field devices (server / virtual machine)", "start", "f8-xs");
  return `<svg class="fe-chart f8-mod" viewBox="0 0 ${W} ${H}" role="img" aria-label="Module overview ${esc(r.unit)}">${s}</svg>`;
}

/** single-line of the cell distribution board: one feeder per module instance */
export function svgSingleLine(kit) {
  const f = kit.mods, n = f.length, dx = 56, W = Math.max(520, 80 + n * dx), H = 230;
  let s = T(10, 18, `cell distribution board =FMS1+CB · 400 V 3~ · ΣS = ${fx(kit.tot.S, 1)} kVA (arithmetic sum, no simultaneity) → I ≈ ${fx(kit.tot.I, 0)} A`, "start", "f8-lbl");
  s += L(30, 30, 30, 50, "f8-pw") + T(36, 44, "incoming feeder from plant board (item 7)", "start", "f8-xs") + L(20, 56, 60 + n * dx, 56, "f8-busbar");
  f.forEach((r, i) => {
    const x = 70 + i * dx;
    s += L(x, 56, x, 76, "f8-pw");
    if (r.In) s += `<g transform="rotate(90 ${x} 92)">${PW.breaker(x, 92, false)}</g>` + L(x, 108, x, 168, "f8-pw") + T(x + 4, 128, `${r.In} A`, "start", "f8-xs") + T(x + 4, 150, `${r.A} mm²`, "start", "f8-xs") + R(x - 24, 168, 48, 26, "f8-dev", 2);
    else s += L(x, 76, x, 168, "f8-dash") + T(x + 4, 128, "–", "start", "f8-xs") + R(x - 24, 168, 48, 26, "f8-box", 2);
    s += T(x, 180, esc(r.unit), "middle", "f8-xs") + T(x, 190, esc(r.code), "middle", "f8-xs") + (r.In ? T(x, 208, "-FC" + r.feederN, "middle", "f8-xs") : "");
  });
  s += T(10, 226, "feeder breaker In ≥ I_inst (installed, ku = 1) · cable with k_temp · k_group (item 7) · dashed = no power circuit", "start", "f8-xs");
  return `<svg class="fe-chart f8-sld" viewBox="0 0 ${W} ${H}" style="min-width:${Math.min(W, 1400)}px" role="img" aria-label="Single-line diagram of the cell board">${s}</svg>`;
}
