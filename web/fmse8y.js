/* FMS engineering – item 8 sections 8G–8N (imported by fmse8.js).
 * 8G cable list (module / kit, CSV) · 8H terminal plan -XD2 (CSV) · 8I BOM (module / kit, CSV) · 8J cabinet FAT test generator (ticks in localStorage)
 * 8K documentation structure (IEC 81346, class letters, sheet list) · 8L design workflow library → project · 8M three cases · 8N checklists.
 * Engine + state: fmse8x.js. Example values only – real circuits need qualified sign-off (IEC 60204-1). */
import { PTXT, CLASSES, IN_CABINET, ASPECTS, WORKFLOW, CASES, CHECKS, SHEET_RULES } from "./fmse8_data.js";
import {
  $, esc, fx, store, ul, card, tab, kv, kpis, intro, useCase, csvDownload, PAT, MODS, TYPES, CODES, isSafety,
  calcModule, calcKit, S, KITS, getKit, refresh, onRefresh, modSel,
} from "./fmse8x.js";

export const html = () => [html8G(), html8H(), html8I(), html8J(), html8K(), html8L(), html8M(), html8N()].join("");
export function init() {
  [init8G, init8H, init8I, init8J, init8K, init8M, init8N].forEach((f) => f());
}
const scopeSel = (id, v) => `<label>Scope <select id="${id}" class="fe-sel"><option value="module"${v === "module" ? " selected" : ""}>selected module</option><option value="kit"${v === "kit" ? " selected" : ""}>whole kit (8F)</option></select></label>`;
const scopeMods = (scope) => (scope === "kit" ? getKit().mods : [calcModule(S.mod)]);

/* ================================================================== 8G cable list */
function cableRows(r) {
  return r.cab.map((c) => {
    const [p, g] = r.instances[c.ii];
    let to = [...new Set(r.io.filter((x) => x.cab === c && x.dev.cl !== "XD").map((x) => x.dev.short))];
    if (!to.length && /zone/i.test(c.ds)) to = [`zone ${g}: contactors / STO group / safety valves`];   // ZONE_OUT: -XD terminal block is in the safety cabinet
    if (!to.length) to = r.dev.filter((d) => d.ii === c.ii && !IN_CABINET.includes(d.cl)).map((d) => d.short);
    if (!to.length) to = [/Ethernet/.test(c.ds) ? "switch / partner" : "external load"];
    const from = /Power|Motor/i.test(c.ds) ? `+${r.unit}CAB -XD1` : /Ethernet|IO-Link/.test(c.ds) ? `+${r.unit}CAB ${r.dev.find((d) => d.ii === c.ii) ? r.dev.find((d) => d.ii === c.ii).short : ""}` : `+${r.unit}CAB -XD2`;
    return { des: `=FMS1.${r.unit}-${c.wd}`, unit: r.unit, wd: c.wd, from, to: to.join(" "), group: g, p, ds: c.ds, cores: c.cores, len: c.len };
  });
}
function html8G() {
  return card("f88G", "8G · Cable list", "one cable per pattern cable entry · WD numbers in expansion order · totals per cable type",
    intro(`<p>Every pattern brings its field cables with a default length. The cable list gives the installer what to pull and the buyer what
      to order:</p><p class="phd-eq">cable = =FMS1.&lt;unit&gt;-WD&lt;n&gt; (n counts per module in expansion order) · totals: number of cables, Σ metres, metres per cores type</p>
      <p>Lengths here are library defaults (5–20 m). In a project the real lengths come from the layout (item 4) plus 10–20 % reserve for routing.</p>`) +
    `<div class="fe-row">${modSel()}${scopeSel("f8GScope", S.scopeG)}<button class="mx-el" id="f8GCsv">Download CSV</button></div><div id="f8GTot"></div><div id="f8GTab"></div>` +
    useCase(`the installation contractor gets the cable list as CSV, prints cable labels from the WD numbers and pulls the cables before the
      cabinets arrive; the owner compares the Σ metres with the tender quantity.`));
}
function init8G() {
  $("f8GScope").addEventListener("change", () => { S.scopeG = $("f8GScope").value; store.set("scopeG", S.scopeG); draw8G(); });
  $("f8GCsv").addEventListener("click", () => { const rows = scopeMods(S.scopeG).flatMap(cableRows); csvDownload(`cable_list_${S.scopeG === "kit" ? "kit" : S.mod}.csv`, [["Cable", "From", "To", "Group", "Pattern", "Use", "Cores", "Length m"], ...rows.map((c) => [c.des, c.from, c.to, c.group, c.p, c.ds, c.cores, c.len])]); });
  onRefresh(draw8G);
}
function draw8G() {
  const rows = scopeMods(S.scopeG).flatMap(cableRows), byC = {};
  rows.forEach((c) => { byC[c.cores] = byC[c.cores] || [0, 0]; byC[c.cores][0]++; byC[c.cores][1] += c.len; });
  $("f8GTot").innerHTML = kpis([["cables", rows.length], ["metres", rows.reduce((s, c) => s + c.len, 0)], ["cable types", Object.keys(byC).length]]) +
    (rows.length ? tab(["Cores", "Cables", "Metres"], Object.keys(byC).sort().map((k) => `<tr><td>${esc(k)}</td><td class="f8-r">${byC[k][0]}</td><td class="f8-r">${byC[k][1]}</td></tr>`), "f8-small") : "");
  $("f8GTab").innerHTML = rows.length ? tab(["Cable", "From", "To", "Group", "Use", "Cores", "m"], rows.map((c) => `<tr><td>${esc(c.des)}</td><td>${esc(c.from)}</td><td>${esc(c.to)}</td><td>${esc(c.group)}</td><td>${esc(c.ds)}</td><td>${esc(c.cores)}</td><td class="f8-r">${c.len}</td></tr>`), "f8-small") : `<p class="am-note">No cables.</p>`;
}

/* ================================================================== 8H terminal plan */
function termRows(r) {
  return r.terms.map((t) => {
    if (t.io) return { n: t.n, inner: `${t.io.addr} (card ${t.io.t}${t.io.card} ch ${String(t.io.ch).padStart(2, "0")})`, outer: `${t.io.dev.short} ${t.io.sig}`, cab: t.io.cab ? t.io.cab.wd : "–", tag: t.io.tag, ds: t.io.ds };
    const [p, g] = r.instances[t.ii], ai = PAT[p].io.some((q) => q[1] === "AI");
    const lab = t.of === 1 ? (ai ? "+24 V loop supply" : "0 V common") : t.extra % 2 === 0 ? "+24 V field supply" : "0 V field supply";
    return { n: t.n, inner: lab.startsWith("+") ? "24 V PSU + (ECB channel)" : "0 V bar (PELV earthed)", outer: `${g} ${lab}`, cab: t.cab ? t.cab.wd : "–", tag: "", ds: `supply for ${p} ${g}` };
  });
}
function html8H() {
  return card("f88H", "8H · Terminal plan -XD2", "control terminal strip numbered 1…n in expansion order: IO first, then the extra supply terminals of the same instance",
    intro(`<p>The terminal strip -XD2 is the border between the cabinet wiring (card side, "inner") and the field cables ("outer").</p>
      <p class="phd-eq">terminals = number of IO signals + Σ pattern extras tx (+24 V / 0 V for field devices) · number = position in expansion order</p>
      <p>Because the order follows the instances, all terminals of one device sit together – the electrician finds a sensor's three wires side by side.
      Power terminals (-XD1) are not in this list (they come with the feeder / motor patterns).</p>`) +
    `<div class="fe-row">${modSel()}<button class="mx-el" id="f8HCsv">Download CSV</button></div><div id="f8HTab"></div>` +
    useCase(`the panel builder prints terminal markers from this list; at site the loop check goes terminal by terminal. When a sensor is added
      later, it takes a spare terminal at the end and a spare channel (8D) – the plan is updated as-built.`));
}
function init8H() {
  $("f8HCsv").addEventListener("click", () => { const r = calcModule(S.mod); csvDownload(`terminal_plan_${r.unit}_XD2.csv`, [["Terminal", "Inner (cabinet)", "Outer (field)", "Cable", "Tag", "Description"], ...termRows(r).map((t) => ["-XD2:" + t.n, t.inner, t.outer, t.cab, t.tag, t.ds])]); });
  onRefresh(draw8H);
}
function draw8H() {
  const r = calcModule(S.mod), rows = termRows(r);
  $("f8HTab").innerHTML = rows.length ? `<p class="f8-pt">=FMS1.${r.unit}-XD2: <b>${rows.length}</b> terminals (${r.io.length} IO + ${rows.length - r.io.length} supply)</p>` +
    tab(["Terminal", "Inner (cabinet)", "Outer (field)", "Cable", "Tag", "Description"], rows.map((t) => `<tr class="${t.tag ? "" : "f8-dim"}"><td>-XD2:${t.n}</td><td>${esc(t.inner)}</td><td>${esc(t.outer)}</td><td>${esc(t.cab)}</td><td class="f8-tag2">${esc(t.tag)}</td><td>${esc(t.ds)}</td></tr>`), "f8-small") : `<p class="am-note">${S.mod}: no control terminals.</p>`;
}

/* ================================================================== 8I BOM */
function html8I() {
  return card("f88I", "8I · Bill of materials", "count of each BOM item over all devices + IO station + 24 V PSU + control terminals, sorted by text",
    intro(`<p class="phd-eq">BOM = Σ device BOM items + 'IO station bus interface' + cards per type + '24 V power supply &lt;A&gt; A' + 'Control terminal' × terminals</p>
      <p>The library BOM gives generic items. The plant standard then maps each generic item to an order number of the approved brand
      (e.g. "Contactor AC-3" → brand X, size from 8E) – one mapping table for all projects.</p>`) +
    `<div class="fe-row">${modSel()}${scopeSel("f8IScope", S.scopeI)}<button class="mx-el" id="f8ICsv">Download CSV</button></div><div id="f8ITab"></div>` +
    useCase(`purchasing orders the long-lead items (inverters, safety PLC, light curtains) straight from the kit BOM in the basic design phase;
      the spare-parts list for maintenance is the same BOM with quantities 10 % (min. 1).`));
}
function bomOf(scope) {
  const out = {}, where = {};
  scopeMods(scope).forEach((r) => Object.entries(r.bom).forEach(([b, q]) => { out[b] = (out[b] || 0) + q; (where[b] = where[b] || []).push(r.unit); }));
  return Object.keys(out).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).map((b) => [b, out[b], [...new Set(where[b])].join(" ")]);
}
function init8I() {
  $("f8IScope").addEventListener("change", () => { S.scopeI = $("f8IScope").value; store.set("scopeI", S.scopeI); draw8I(); });
  $("f8ICsv").addEventListener("click", () => csvDownload(`bom_${S.scopeI === "kit" ? "kit" : S.mod}.csv`, [["Item", "Qty", "Units"], ...bomOf(S.scopeI)]));
  onRefresh(draw8I);
}
function draw8I() {
  const b = bomOf(S.scopeI);
  $("f8ITab").innerHTML = b.length ? kpis([["BOM lines", b.length], ["parts (incl. terminals)", b.reduce((s, x) => s + x[1], 0)]]) + tab(["Item", "Qty", "Units"], b.map(([i, q, u]) => `<tr><td>${esc(i)}</td><td class="f8-r"><b>${q}</b></td><td class="f8-units">${esc(u)}</td></tr>`), "f8-small") : `<p class="am-note">Empty BOM.</p>`;
}

/* ================================================================== 8J cabinet FAT generator */
function fatSteps(r) {
  const st = [];
  const add = (sec, id, item, action, expect) => st.push({ sec, id, item, action, expect });
  add("A General", "G1", "Cabinet", "Visual inspection: labels, ferrules, ducts, torque marks, documents in the pocket", "As drawings, no damage");
  add("A General", "G2", "PE", "Measure PE continuity main PE bar → every exposed part (IEC 60204-1 test 1)", "Low resistance, all points");
  add("A General", "G3", "Insulation", "Insulation resistance power circuits at 500 V DC (IEC 60204-1)", "≥ 1 MΩ");
  if (r.psu) add("A General", "G4", "24 V PSU", `Switch on ${r.psu} A PSU with all ECB channels off, measure output and polarity`, "24 V ± 5 %, 0 V earthed at one point");
  if (r.io.length) add("A General", "G5", "IO station", "Power IO station, check it is online in the PLC configuration with all cards", `${r.cardsTotal} cards OK, no diagnostics`);
  r.terms.forEach((t) => add("B Point-to-point", "P" + t.n, "-XD2:" + t.n, t.io ? `Ring out -XD2:${t.n} → card ${t.io.addr}` : "Ring out supply terminal → PSU / 0 V bar", "Continuity, wire label correct"));
  r.io.forEach((x, i) => {
    const d = x.dev.short, a = {
      DI: [`Actuate / simulate ${d} (${x.sig})`, `${x.addr} LED on, tag TRUE`], DO: [`Force ${x.tag.split(".").slice(-2).join(".")} in test mode`, `${x.addr} LED on, ${d} actuates`],
      AI: ["Inject 4 / 12 / 20 mA at the terminal", "Value 0 / 50 / 100 %, wire break < 3.6 mA alarm"], AO: ["Write 0 / 50 / 100 %", "4 / 12 / 20 mA measured"],
      FDI: [`Open the channel of ${d} (${x.sig})`, `${x.addr} = 0, safety program reacts; single channel → discrepancy fault`], FDO: [`Safety test: switch ${x.sig} on / off`, `${x.addr} switches, test pulses OK, load follows`],
    }[x.t];
    add("C IO test", "I" + (i + 1), x.addr, a[0], a[1]);
  });
  r.instances.forEach(([p, g], ii) => { if (!isSafety(p)) return; (PTXT[p].fat || []).forEach((f, j) => add("D Safety validation", `S${ii + 1}.${j + 1}`, `${g} (${p})`, f, "Pass – record in validation report (ISO 13849-2)")); });
  return st;
}
function html8J() {
  return card("f88J", "8J · Cabinet FAT test generator", "test sheet generated from the module: general tests, point-to-point per terminal, IO test per tag, safety validation per safety pattern",
    intro(`<p>The factory acceptance test (FAT) of a cabinet proves that it is built and wired as drawn <b>before</b> it goes to site. Because the
      IO list, the terminal plan and the patterns are known, the test sheet can be generated: <b>A</b> general (visual, PE, insulation, 24 V),
      <b>B</b> point-to-point (every terminal to its card channel), <b>C</b> IO test (every tag with LED and PLC value), <b>D</b> safety validation
      (the FAT steps of every safety pattern instance). Ticks are saved in this browser.</p>`) +
    `<div class="fe-row">${modSel()}<button class="mx-el" id="f8JCsv">Download test sheet CSV</button><button class="mx-el" id="f8JClr">Clear ticks of this module</button></div><div id="f8JProg"></div><div id="f8JTab"></div>` +
    useCase(`at the integrator's workshop the owner's engineer witnesses section D and samples section C; the signed sheet is part of the
      FAT report. The same sheet is reused at site (SAT) for the loop check with the real field devices.`));
}
function init8J() {
  $("f8JTab").addEventListener("change", (e) => { const c = e.target.closest("[data-f]"); if (!c) return; const u = calcModule(S.mod).unit; S.fat[u] = S.fat[u] || {}; if (c.checked) S.fat[u][c.dataset.f] = 1; else delete S.fat[u][c.dataset.f]; store.set("fat", S.fat); prog8J(); });
  $("f8JClr").addEventListener("click", () => { delete S.fat[calcModule(S.mod).unit]; store.set("fat", S.fat); draw8J(); });
  $("f8JCsv").addEventListener("click", () => { const r = calcModule(S.mod), f = S.fat[r.unit] || {}; csvDownload(`FAT_${r.unit}.csv`, [["Section", "Step", "Item", "Action", "Expected result", "OK"], ...fatSteps(r).map((s) => [s.sec, s.id, s.item, s.action, s.expect, f[s.id] ? "x" : ""])]); });
  onRefresh(draw8J);
}
function prog8J() {
  const r = calcModule(S.mod), st = fatSteps(r), f = S.fat[r.unit] || {}, secs = [...new Set(st.map((s) => s.sec))];
  $("f8JProg").innerHTML = kpis(secs.map((sc) => { const a = st.filter((s) => s.sec === sc); return [sc, `${a.filter((s) => f[s.id]).length} / ${a.length}`]; }).concat([["total", `${st.filter((s) => f[s.id]).length} / ${st.length}`]]));
}
function draw8J() {
  const r = calcModule(S.mod), st = fatSteps(r), f = S.fat[r.unit] || {};
  let last = "";
  $("f8JTab").innerHTML = tab(["Step", "Item", "Action", "Expected result", "OK"], st.map((s) => { const h = s.sec !== last ? `<tr class="f8-sec"><td colspan="5">${esc(s.sec)} – ${esc(r.unit)}</td></tr>` : ""; last = s.sec; return h + `<tr><td>${s.id}</td><td>${esc(s.item)}</td><td>${esc(s.action)}</td><td>${esc(s.expect)}</td><td><input type="checkbox" data-f="${s.id}"${f[s.id] ? " checked" : ""} aria-label="step ${s.id} OK"></td></tr>`; }), "f8-small f8-fat");
  prog8J();
}

/* ================================================================== 8K documentation structure */
function sheetList(r) {
  const sh = ["Cover sheet (project, unit, revision, sign-off)", "Table of contents"];
  if (r.In) sh.push(`Power supply: main switch, feeder ${r.In} A, PE`);
  r.instances.forEach(([p, g]) => { if (PAT[p].power) sh.push(`Power: ${g} (${p})`); });
  if (r.psu) sh.push(`24 V distribution: PSU ${r.psu} A, ECB channels`);
  r.instances.forEach(([p, g]) => { if (isSafety(p)) sh.push(`Safety: ${g} (${p})`); });
  TYPES.forEach((t) => { for (let c = 1; c <= r.cards[t]; c++) sh.push(`IO card ${t}${c}`); });
  if (r.instances.some(([p]) => /BUS|IPC|HMI|SWITCH|FIREWALL|SAFETY_PLC|RFID/.test(p))) sh.push("Network / bus overview");
  if (r.nTerms) sh.push("Terminal plan -XD2");
  if (r.nCables) sh.push("Cable list");
  sh.push("Bill of materials", "Cabinet layout (mounting plate, door)");
  return sh;
}
function html8K() {
  return card("f88K", "8K · Documentation structure", "IEC 81346 reference designations · class letters used · sheet list of one module project",
    intro(`<p>IEC 81346 gives every object a name in three <b>aspects</b>: what it does (=), what it is (−), where it is (+). One device can be
      found by any of them. IEC 61082 / IEC 81714 cover the drawing rules; the circuit diagrams follow IEC 60617 symbols.</p>`) +
    tab(["Prefix", "Aspect", "Meaning", "Example"], ASPECTS.map((a) => `<tr><td><b>${esc(a[0])}</b></td><td>${esc(a[1])}</td><td>${esc(a[2])}</td><td><code>${esc(a[3])}</code></td></tr>`), "f8-small") +
    `<div class="fe-row">${modSel()}</div><div class="grid2 eq"><div><h3 class="fe-h3">Class letters in this module</h3><div id="f8KCls"></div></div><div><h3 class="fe-h3">Sheet list (generated)</h3><div id="f8KSh"></div></div></div>
    <p class="am-note">${esc(SHEET_RULES)}</p>` +
    useCase(`the owner's plant standard fixes the designation system, sheet order and title block once; every integrator delivers the same
      structure, and the maintenance electrician finds -QA1 of POOL01 on the same sheet type in every project.`));
}
function init8K() { onRefresh(draw8K); }
function draw8K() {
  const r = calcModule(S.mod), cnt = {};
  r.dev.forEach((d) => { cnt[d.cl] = (cnt[d.cl] || 0) + 1; });
  if (r.nCables) cnt.WD = r.nCables; if (r.nTerms) cnt.XD = 1;
  $("f8KCls").innerHTML = Object.keys(cnt).length ? tab(["Class", "Count", "Meaning", "Example"], Object.keys(cnt).sort().map((c) => `<tr><td><b>${c}</b></td><td class="f8-r">${cnt[c]}</td><td>${esc(CLASSES[c] || "")}</td><td><code>=FMS1.${r.unit}-${c}${c === "XD" ? 2 : 1}</code></td></tr>`), "f8-small") : `<p class="am-note">No devices.</p>`;
  const sh = sheetList(r);
  $("f8KSh").innerHTML = `<ol class="f8-sheets">${sh.map((s) => `<li>${esc(s)}</li>`).join("")}</ol><p class="am-note">${sh.length} sheets for =FMS1.${r.unit}</p>`;
}

/* ================================================================== 8L workflow */
function html8L() {
  const W = 760, n = WORKFLOW.length, bw = 64;
  const svg = `<svg class="fe-chart f8-flow" viewBox="0 0 ${W} 110" role="img" aria-label="Workflow from library to project">${WORKFLOW.map((w, i) => {
    const x = 6 + i * (bw + 4.5), own = /Owner/.test(w[3]) ? "f8-own" : /Both|\+/.test(w[3]) ? "f8-both" : "f8-int";
    return `<rect x="${x}" y="20" width="${bw}" height="56" rx="5" class="${own}"/><text x="${x + bw / 2}" y="40" text-anchor="middle" class="f8-lbl">${w[0]}</text>${w[1].split(" ").reduce((a, word) => { const l = a[a.length - 1]; if (l && (l + " " + word).length <= 10) a[a.length - 1] = l + " " + word; else a.push(word); return a; }, []).slice(0, 2).map((t, j) => `<text x="${x + bw / 2}" y="${54 + j * 11}" text-anchor="middle" class="f8-xs">${esc(t)}</text>`).join("")}${i < n - 1 ? `<path d="M${x + bw} 48 l4.5 0" class="f8-w"/>` : ""}`;
  }).join("")}<rect x="6" y="90" width="10" height="10" class="f8-own"/><text x="20" y="99" class="f8-xs">owner</text><rect x="70" y="90" width="10" height="10" class="f8-int"/><text x="84" y="99" class="f8-xs">integrator / panel builder</text><rect x="230" y="90" width="10" height="10" class="f8-both"/><text x="244" y="99" class="f8-xs">both</text></svg>`;
  return card("f88L", "8L · Design workflow: library → project", "11 steps from choosing modules to as-built drawings · who does what (owner vs integrator)",
    intro(`<p>The library only pays off when it is used the same way every time. The workflow below turns the library into a project;
      steps 3 and 6 are almost automatic, the engineering time goes into parameters (2), safety (5) and the review (7).</p>`) +
    `<div class="fe-scroll">${svg}</div>` +
    tab(["#", "Step", "What", "Done by", "Other side"], WORKFLOW.map((w) => `<tr><td>${w[0]}</td><td><b>${esc(w[1])}</b></td><td>${esc(w[2])}</td><td>${esc(w[3])}</td><td>${esc(w[4])}</td></tr>`), "f8-small") +
    useCase(`a typical saving: a 3-HMC FMS without a library needs ≈ 600–900 h electrical design; with a mature library ≈ 250–400 h, and
      fewer FAT findings because every pattern is pre-tested (experience values, vary by company).`));
}

/* ================================================================== 8M cases */
export const caseList = (c) => (Array.isArray(c[2]) ? c[2] : KITS[c[2]]);
function html8M() {
  return card("f88M", "8M · Cases", "three cells computed by the same rules: machining FMS, assembly line, robot welding",
    intro(`<p>Three typical cells, each just a list of modules. All totals come from the library rules – the same numbers the guide and the
      Python tools give. Click "open in 8F" to edit a case in the kit builder.</p>`) + `<div id="f8MTab"></div>` +
    useCase(`in a feasibility study the owner compares concepts (e.g. machining FMS vs. two stand-alone cells) by IO count, cabinet losses and
      connected load in minutes – the order of magnitude is right long before suppliers are asked.`));
}
function init8M() {
  $("f8MTab").addEventListener("click", (e) => { const b = e.target.closest("[data-case]"); if (!b) return; const c = CASES[+b.dataset.case]; if (Array.isArray(c[2])) { S.kit = c[2].slice(); store.set("kit", S.kit); } else { S.kitName = c[2]; S.kit = null; store.set("kitName", c[2]); store.del("kit"); } refresh(); $("f88F").scrollIntoView({ behavior: "smooth", block: "start" }); });
  onRefresh(draw8M);
}
function draw8M() {
  const ks = CASES.map((c) => calcKit(caseList(c)).tot);
  const row = (n, f) => `<tr><td>${n}</td>${ks.map((t) => `<td class="f8-r">${f(t)}</td>`).join("")}</tr>`;
  const mods = (c) => { const cnt = {}; caseList(c).forEach((m) => { cnt[m] = (cnt[m] || 0) + 1; }); return Object.entries(cnt).map(([m, n]) => (n > 1 ? m + "×" + n : m)).join(" + "); };
  $("f8MTab").innerHTML = CASES.map((c) => `<p class="f8-pt"><b>${esc(c[0])}:</b> ${esc(c[1])}<br><span class="f8-units">${esc(mods(c))}</span></p>`).join("") +
    tab(["", ...CASES.map((c, i) => `${esc(c[0])} <button class="mx-el f8-mini" data-case="${i}">open in 8F</button>`)], [
      row("module instances", (t) => t.modules), row("IO signals", (t) => t.io), ...TYPES.map((x) => row(`&nbsp; ${x} used / cards`, (t) => `${t.used[x]} / ${t.cards[x]}`)),
      row("IO cards total", (t) => t.cardsTotal), row("terminals", (t) => t.terms), row("cables / metres", (t) => `${t.cables} / ${t.metres}`), row("devices", (t) => t.devices),
      row("P demand kW", (t) => fx(t.P, 1)), row("ΣS kVA", (t) => fx(t.S, 1)), row("I (ΣS) A", (t) => fx(t.I, 0)), row("Σ PSU A", (t) => fx(t.psu, 1)), row("losses kW", (t) => fx(t.loss / 1000, 2)),
    ], "f8-small");
}

/* ================================================================== 8N checklists */
function html8N() {
  return card("f88N", "8N · Checklists", "circuit design · cabinet build · FAT · site – ticks saved in this browser",
    `<div class="fe-row"><span id="f8NProg" class="f8-pt"></span><button class="mx-el" id="f8NClr">Clear ticks</button></div>
    <div class="f8-chk">${CHECKS.map(([h, a], i) => `<div class="f8-sub"><h3 class="fe-h3">${esc(h)}</h3>${a.map((t, j) => `<label class="f8-ci"><input type="checkbox" data-c="${i}.${j}"> ${esc(t)}</label>`).join("")}</div>`).join("")}</div>` +
    useCase(`the checklists are attached to the order: the integrator ticks "circuit design" before the design review, the panel builder
      "cabinet build" before FAT, both sides sign "FAT" and "site".`));
}
function init8N() {
  const boxes = () => document.querySelectorAll("#f88N [data-c]");
  const prog = () => { const b = [...boxes()]; $("f8NProg").textContent = `${b.filter((x) => x.checked).length} / ${b.length} ticked`; };
  boxes().forEach((b) => { b.checked = !!S.chk[b.dataset.c]; b.addEventListener("change", () => { if (b.checked) S.chk[b.dataset.c] = 1; else delete S.chk[b.dataset.c]; store.set("chk", S.chk); prog(); }); });
  $("f8NClr").addEventListener("click", () => { S.chk = {}; store.set("chk", S.chk); boxes().forEach((b) => { b.checked = false; }); prog(); });
  prog();
}
