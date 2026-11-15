/* FMS engineering – item 8: module library – complete circuits per module.  Loaded by fmse.js (build "8").
 * 8A library overview (pattern × module matrix) · 8B pattern browser (schematic, IO, devices, cables, FAT, faults)
 * 8C module browser (instances, IO list with addresses, devices =FMS1.<unit>-XX, overview drawing) · 8D IO cards & addresses
 * 8E power & 24 V per module · 8F kit builder (totals, distribution-board schedule, single-line).
 * 8G–8N (cable list, terminal plan, BOM, FAT generator, documentation, workflow, cases, checklists) live in fmse8y.js.
 * Engine + drawings: fmse8x.js (rules = EX8._rules of tools/fmse/examples/item8_examples.json, exactly).
 * Offline; user choices in localStorage "fmse.8.*". Test hook: window.fe8.results() (always from the JSON library). */
import { EX8, PTXT, CASES } from "./fmse8_data.js";
import {
  $, esc, fx, store, ul, card, tab, kv, kpis, intro, useCase, pyRound, C, PAT, MODS, CH, TYPES, CODES, isSafety, unitOf,
  calcList, calcModule, calcKit, calcPattern, DEMO_PAR, svgInstance, svgModule, svgSingleLine, S, KITS, kitList, refresh, onRefresh, setMod, modSel, wireModSel, DEFAULT_KIT,
} from "./fmse8x.js";
import * as Y from "./fmse8y.js";

const R = { errors: [] };
const PNAMES = Object.keys(PAT);

/* ------------------------------------------------------------------ test hook: reference numbers from the JSON library */
function modOut(r) {
  return { unit: r.unit, io: r.io.length, used: r.used, cards: r.cards, terms: r.nTerms, cables: r.nCables, metres: r.metres, devices: r.nDevices,
    i24: r.i24, psu: r.psu, P: r.P, S: r.S, I: r.I, Iinst: r.Iinst, In: r.In, A: r.A, loss: r.loss, maxtag: r.maxtag, motors: r.motors,
    pcabs: r.pcabs.map((x) => [x.group, x.p, x.kW, x.Ib, x.Ip, x.A, x.cores]), cab: r.cab.map((c) => [c.ds, c.cores, c.len]) };
}
export function results() {
  const modules = {}; let maxtag = 0;
  CODES.forEach((c) => { const r = calcModule(c); modules[c] = modOut(r); maxtag = Math.max(maxtag, r.maxtag); });
  const m3 = calcModule("M03"), m18 = calcModule("M18"), k = calcKit(EX8.kit.modules).tot;
  const cases = Object.fromEntries(CASES.map((c) => { const t = calcKit(Y.caseList(c)).tot; return [c[0], { io: t.io, used: t.used, cards: t.cardsTotal, terms: t.terms, cables: t.cables, metres: t.metres, devices: t.devices, P: t.P, S: t.S, psu: t.psu, loss: t.loss }]; }));
  return { modules, maxtag, cases, m03: { io: m3.io.map((x) => [x.addr, x.tag, x.t]), bom: m3.bom }, m18: { io: m18.io.map((x) => [x.addr, x.tag, x.t]), bom: m18.bom },
    kit: { io: k.io, cards: k.cards, cardsTotal: k.cardsTotal, used: k.used, terms: k.terms, cables: k.cables, metres: k.metres, P: k.P, S: k.S, psu: k.psu, loss: k.loss, devices: k.devices } };
}

export function mount(el) {
  el.innerHTML = htmlTop() + [html8A(), html8B(), html8C(), html8D(), html8E(), html8F()].join("") + Y.html();
  [init8A, init8B, init8C, init8D, init8E, init8F, Y.init].forEach((f) => { try { f(el); } catch (e) { console.error("fmse8 " + f.name, e); R.errors.push(f.name + ": " + e.message); } });
  wireModSel(el);
  refresh();
  window.fe8 = { results, R, S, calc: { calcList, calcModule, calcKit, calcPattern, pyRound }, refresh };
}

function htmlTop() {
  return `<div class="card f8-warnbox"><p><b>Example values only.</b> The circuit library on this page (31 patterns, 22 modules – file
    <code>tools/fmse/examples/item8_examples.json</code>, shared with guide 68 and the Python tools) is a <b>teaching example</b>. Card sizes,
    device types, ratings, cable sizes and lengths are typical values. Real circuits must follow <b>IEC 60204-1</b>, IEC 60364, IEC 61439,
    ISO 13849 and the manufacturers' manuals, and must be designed, checked and <b>signed off by qualified electrical and safety engineers</b>.</p>
    <p class="f8-rev"><b>Revision 2026-11-15 (two gaps fixed):</b> (1) <b>power cables</b> are now sized <b>per instance</b> (rule <code>power_cable</code>,
    item-7 check I<sub>b</sub> ≤ I<sub>p</sub> ≤ I<sub>z</sub>·k) – before, every DOL / heater / inverter had a fixed 4G1.5 or 4G2.5 and every
    feeder said "size from the feeder calculation", so the 18 kW washer heater got 4G2.5 (now 4G6) and the 15 kW hydraulic pump 4G1.5 (now 4G6);
    (2) the cell safety controller <b>M18</b> now has its <b>zone safety outputs</b>: 4 × pattern <b>ZONE_OUT</b> (F-DO release + F-DI EDM feedback per zone) –
    before, SAFE01 had no F-DO at all. All lists below are recalculated from the revised library.</p></div>`;
}

/* ================================================================== 8A library overview */
function html8A() {
  const cnt = {}; CODES.forEach((m) => MODS[m].instances.forEach(([p]) => { cnt[p + "|" + m] = (cnt[p + "|" + m] || 0) + 1; }));
  const tot = (p) => CODES.reduce((s, m) => s + (cnt[p + "|" + m] || 0), 0);
  const head = ["Pattern", ...CODES.map((m) => `<span title="${esc(MODS[m].title)}">${m.slice(1)}</span>`), "Σ"];
  const rows = PNAMES.map((p) => `<tr><td class="f8-pn${isSafety(p) ? " f8-sf" : ""}" title="${esc(PAT[p].title)}">${p}</td>${CODES.map((m) => { const n = cnt[p + "|" + m]; return n ? `<td class="f8-mc f8-h${Math.min(n, 4)}" data-p="${p}" data-m="${m}" title="${p} in ${m}: ${n}">${n}</td>` : `<td class="f8-mc"></td>`; }).join("")}<td class="f8-r"><b>${tot(p)}</b></td></tr>`);
  rows.push(`<tr class="f8-tot"><td>instances</td>${CODES.map((m) => `<td class="f8-mc">${MODS[m].instances.length || ""}</td>`).join("")}<td class="f8-r">${CODES.reduce((s, m) => s + MODS[m].instances.length, 0)}</td></tr>`);
  const nInst = CODES.reduce((s, m) => s + MODS[m].instances.length, 0);
  return card("f88A", "8A · Library overview", `${PNAMES.length} circuit patterns × ${CODES.length} modules · each module = a list of pattern instances`,
    intro(`<p>A <b>circuit library</b> has two levels. A <b>pattern</b> is a small complete circuit that is drawn, tested and documented once:
      a motor starter, a guard door with guard locking, a valve with two end sensors … Each pattern knows its <b>IO signals</b>, its <b>devices</b>
      (with class letter), its <b>cables</b>, its 24 V current, its heat loss and its extra terminals. A <b>module</b> (M01–M22 from item 1) is only
      a <b>list of pattern instances</b> with a group name and a few parameters (motor kW, feeder kW …).</p>
      <p class="phd-eq">module = Σ instances (pattern, group, parameters) &nbsp;→&nbsp; IO list · IO cards · terminals · cables · devices · BOM · power · 24 V &nbsp;(all by fixed rules)</p>
      <p>So the electrical design of a whole FMS becomes: choose modules → set parameters → generate. The matrix shows how often each pattern is
      used in each module (red pattern names = safety patterns with F-DI / F-DO). Click a number to open that pattern and module below.</p>`) +
    kpis([["patterns", PNAMES.length], ["modules", CODES.length], ["pattern instances", nInst], ["safety patterns", PNAMES.filter(isSafety).length]]) +
    tab(head, rows, "f8-mat") +
    `<p class="am-note">Columns = module numbers (01 = M01 … 22 = M22); hover for the module name. Darker = more instances.</p>` +
    useCase(`the integrator keeps one library in the E-CAD system (EPLAN / E3 / SEE macros = the patterns). For a new FMS the engineer picks
      M01 × 3, M03, M04 × 2 … and gets 80 % of the schematics in one day; only the special parts are drawn by hand. The owner asks in the
      specification that every cabinet uses the library patterns, so the maintenance team meets the same circuits in every module.`));
}
function init8A(el) {
  el.querySelector("#f88A .f8-mat").addEventListener("click", (e) => {
    const td = e.target.closest("td[data-p]"); if (!td) return;
    S.pat = td.dataset.p; store.set("pat", S.pat); setMod(td.dataset.m);
    S.inst = MODS[S.mod].instances.findIndex((x) => x[0] === S.pat); if (S.inst < 0) S.inst = 0; refresh();
    $("f88B").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

/* ================================================================== 8B pattern browser */
function html8B() {
  return card("f88B", "8B · Pattern browser", "one standard circuit: schematic, IO, devices, cables, 24 V, loss, FAT test steps, typical faults",
    intro(`<p>Select a pattern. The schematic is <b>generated from the pattern data</b>: the power path (feeder, motor starter, inverter, heater)
      as a single-line, then one row per IO signal: <b>card channel → terminal -XD2:n → cable -WDn → field device</b>. Device names follow
      IEC 81346: <b>-</b> + class letter + running number (-QA1 contactor, -BG1 sensor, -SF1 push-button …, see 8K). Here the pattern is shown
      alone as unit "XX01" with typical parameters; in 8C the same drawing shows the real numbers inside a module.</p>`) +
    `<div class="fe-row"><label class="f8-msel">Pattern <select id="f8BSel" class="fe-sel f8-selw">${PNAMES.map((p) => `<option value="${p}">${p} · ${esc(PAT[p].title)}</option>`).join("")}</select></label></div>
    <div id="f8BHead"></div><div class="fe-scroll" id="f8BSvg"></div>
    <div class="grid2 eq"><div><h3 class="fe-h3">IO signals</h3><div id="f8BIo"></div><h3 class="fe-h3">Devices &amp; cables</h3><div id="f8BDev"></div></div>
      <div><h3 class="fe-h3">FAT test steps</h3><div id="f8BFat"></div><h3 class="fe-h3">Typical faults</h3><div id="f8BFlt"></div><h3 class="fe-h3">Used in</h3><div id="f8BUse"></div></div></div>` +
    useCase(`before the first project the integrator builds each pattern once on a test board and runs its FAT steps; the faults list comes
      from real commissioning problems. When a new fault is found on site, it is added to the pattern – so every future module gets better.`));
}
function init8B() {
  $("f8BSel").addEventListener("change", () => { S.pat = $("f8BSel").value; store.set("pat", S.pat); draw8B(); });
  onRefresh(draw8B);
}
function draw8B() {
  const p = S.pat, pt = PAT[p], tx = PTXT[p] || {}, r = calcPattern(p);
  $("f8BSel").value = p;
  const par = DEMO_PAR[pt.power];
  $("f8BHead").innerHTML = `<p class="f8-pt"><b>${esc(pt.title)}</b>${isSafety(p) ? ' <span class="f8-tag f8-tagS">safety</span>' : ""}${pt.power ? ` <span class="f8-tag">power: ${pt.power}</span>` : ""} – ${esc(tx.use || "")}</p>` +
    kpis([["IO signals", pt.io.length], ["devices", pt.dev.length], ["cables", pt.cab.length], ["extra terminals tx", pt.tx], ["24 V current", fx(pt.i24, 3) + " A"], ["cabinet loss", pt.loss === "3%" ? "3 % of kW" : pt.loss + " W"]]) +
    (par ? `<p class="am-note">Demo parameters: ${esc(JSON.stringify(par))}${pt.power === "motor" || pt.power === "vfd" ? ` → I<sub>n</sub> = ${fx(r.motors[0][3], 2)} A, ${pt.power === "motor" ? "contactor " + r.motors[0][4] + " A AC-3" : "inverter " + r.motors[0][4] + " kW"}` : ""}.</p>` : "");
  const pc = r.pcabs[0];
  if (pc) $("f8BHead").innerHTML += `<p class="am-note">Power cable (rule power_cable, per instance): I<sub>b</sub> = ${fx(pc.Ib, 2)} A, I<sub>p</sub> = ${pc.motor ? fx(pc.Ip, 2) + " A (motor setting)" : pc.Ip + " A (breaker)"} → I<sub>p</sub> ÷ (0.87·0.77) = ${fx(pc.Izreq, 2)} A ≤ I<sub>z</sub> ${pc.Iz} A → <b>${esc(pc.cores)}</b> (pattern default text "${esc(pc.old)}" is replaced in every module).</p>`;
  $("f8BSvg").innerHTML = svgInstance(r, 0);
  $("f8BIo").innerHTML = pt.io.length ? tab(["Addr.*", "Signal", "Type", "Description", "Device", "Symbol"], r.io.map((x) => `<tr><td>${x.addr}</td><td>${esc(x.sig)}</td><td>${typeTag(x.t)}</td><td>${esc(x.ds)}</td><td>${x.dev.short}</td><td>${x.kind}</td></tr>`), "f8-small") + `<p class="am-note">* address when the pattern is alone in a module.</p>` : `<p class="am-note">No IO wires – the device talks over the bus / Ethernet or is internal.</p>`;
  $("f8BDev").innerHTML = tab(["Device", "Description", "BOM item"], r.dev.map((d) => `<tr><td>${d.short}</td><td>${esc(d.ds)}</td><td>${esc(d.bom)}</td></tr>`), "f8-small") +
    (r.cab.length ? tab(["Cable", "Use", "Cores", "Length m"], r.cab.map((c) => `<tr><td>-${c.wd}</td><td>${esc(c.ds)}</td><td>${esc(c.cores)}</td><td class="f8-r">${c.len}</td></tr>`), "f8-small") : `<p class="am-note">No field cable (wired inside the cabinet).</p>`);
  $("f8BFat").innerHTML = ul((tx.fat || []).map(esc));
  $("f8BFlt").innerHTML = ul((tx.faults || []).map(esc));
  const use = CODES.filter((m) => MODS[m].instances.some((x) => x[0] === p));
  $("f8BUse").innerHTML = use.length ? `<div class="f8-chips">${use.map((m) => `<button class="mx-el f8-mini" data-gom="${m}">${m} × ${MODS[m].instances.filter((x) => x[0] === p).length}</button>`).join("")}</div>` : "<p class='am-note'>not used in a module</p>";
  $("f8BUse").querySelectorAll("[data-gom]").forEach((b) => b.addEventListener("click", () => { setMod(b.dataset.gom); S.inst = Math.max(0, MODS[S.mod].instances.findIndex((x) => x[0] === p)); refresh(); $("f88C").scrollIntoView({ behavior: "smooth", block: "start" }); }));
}
/* power cable sizing table (_rules.power_cable) – used in 8C and 8E */
function pcabTab(r) {
  if (!r.pcabs.length) return `<p class="am-note">No power cables sized in this module (no DOL / VFD_STO / HEATER / FEEDER_EXT instance).</p>`;
  const k = C.k_temp * C.k_group;
  return `<p class="phd-eq">I<sub>b</sub> = motor I<sub>n</sub> (DOL / VFD) or kW·1000 ÷ (√3·400·cos φ) · I<sub>p</sub> = MPCB / overload setting = I<sub>n</sub> (motors) or smallest breaker ≥ I<sub>b</sub> (heater, feeder) ·
    cable: <b>I<sub>p</sub> ÷ (${C.k_temp} · ${C.k_group}) ≤ I<sub>z,table</sub></b> → smallest size A (≥ 1.5 mm²)</p>` +
    tab(["Instance", "Pattern", "kW", "I<sub>b</sub> A", "I<sub>p</sub> A", "I<sub>p</sub>/(0.87·0.77) A", "A mm²", "I<sub>z,table</sub> A", "Cores", "Cable", "pattern default"], r.pcabs.map((x) =>
      `<tr><td>${esc(x.group)}</td><td>${x.p}</td><td class="f8-r">${x.kW}</td><td class="f8-r">${fx(x.Ib, 2)}</td><td class="f8-r">${x.motor ? fx(x.Ip, 2) : x.Ip}${x.motor ? "" : ' <span class="sub">breaker</span>'}</td><td class="f8-r">${fx(x.Ip / k, 2)}</td><td class="f8-r"><b>${x.A}</b></td><td class="f8-r">${x.Iz}</td><td><b>${esc(x.cores)}</b></td><td>-${x.wd} · ${x.len} m</td><td class="sub">${esc(x.old)}</td></tr>`), "f8-small") +
    `<p class="am-note">k<sub>temp</sub> ${C.k_temp} · k<sub>group</sub> ${C.k_group} → divisor ${fx(k, 4)} (item 7). Lengths and cable counts are unchanged by the rule; only the cores text of the power cable changes. "pattern default" = the cores text written in the pattern, replaced by the sized text (before revision 2026-11-15 the default was used unchanged – 4G1.5 / 4G2.5 or "size from the feeder calculation").</p>`;
}
const typeTag = (t) => `<span class="f8-tt f8-t${t}">${t}</span>`;

/* ================================================================== 8C module browser */
function html8C() {
  return card("f88C", "8C · Module browser", "instances → IO list with tags and addresses, devices with IEC 81346 names, module drawing",
    intro(`<p>The rules expand a module in a fixed order: walk the instances, each adds its pattern's IO, devices and cables. From that come:</p>
      <p class="phd-eq">tag = PLT1.MACH.FMS1.&lt;unit&gt;.&lt;group&gt;.&lt;signal&gt; (≤ 48 characters, item 5) · device = =FMS1.&lt;unit&gt;-&lt;class&gt;&lt;n&gt; (n counts per class) · cable = WD1, WD2 … · address = TYPE card.channel</p>
      <p>Unit = unit code + number: MC01, POOL01, LS01 … (in a kit the number counts up per module type: MC01, MC02, MC03). Click an instance row
      to see its schematic with the real designations, terminals and addresses of this module.</p>`) +
    `<div class="fe-row">${modSel()}</div><div id="f8CHead"></div>
    <h3 class="fe-h3">Instances</h3><div id="f8CInst"></div><div class="fe-scroll" id="f8CSch"></div>
    <h3 class="fe-h3">Power cable sizing</h3><div id="f8CPcab"></div>
    <h3 class="fe-h3">Module overview: cabinet ↔ field</h3><div class="fe-scroll" id="f8CSvg"></div>
    <h3 class="fe-h3">IO list</h3><div id="f8CIo"></div>
    <h3 class="fe-h3">Devices</h3><div id="f8CDev"></div>` +
    useCase(`the IO list of 8C is exactly what the PLC programmer (item 9–10) and the HMI designer need on day one: tags, types and
      addresses come from the same rules, so the PLC hardware configuration, the E-CAD project and the SCADA tag list never disagree.`));
}
function init8C() {
  $("f8CInst").addEventListener("click", (e) => { const tr = e.target.closest("tr[data-ii]"); if (!tr) return; S.inst = +tr.dataset.ii; draw8C(); });
  onRefresh(draw8C);
}
function draw8C() {
  const r = calcModule(S.mod), n = r.instances.length;
  if (S.inst >= n) S.inst = 0;
  $("f8CHead").innerHTML = `<p class="f8-pt"><b>${S.mod} · ${esc(r.title)}</b> – unit <b>${r.unit}</b>, function =FMS1.${r.unit}</p>` +
    kpis([["instances", n], ["IO signals", r.io.length], ["IO cards", r.cardsTotal], ["terminals -XD2", r.nTerms], ["cables / m", `${r.nCables} / ${r.metres}`], ["devices", r.nDevices], ["longest tag", r.maxtag + " ch", r.maxtag > 48 ? "fe-no" : ""]]);
  if (!n) { ["f8CInst", "f8CSch", "f8CIo", "f8CDev", "f8CPcab"].forEach((id) => { $(id).innerHTML = ""; }); $("f8CInst").innerHTML = `<p class="am-note">This module has no field circuits (software on a server / virtual machine) – nothing to wire, only network access (item 6).</p>`; $("f8CSvg").innerHTML = svgModule(r); return; }
  $("f8CInst").innerHTML = tab(["#", "Pattern", "Group", "Parameters", "IO", "Devices", "Cables"], r.instances.map(([p, g, k], ii) => `<tr data-ii="${ii}" class="f8-click${ii === S.inst ? " f8-hl" : ""}"><td>${ii + 1}</td><td class="${isSafety(p) ? "f8-sf" : ""}">${p}</td><td>${esc(g)}</td><td>${Object.keys(k).length ? esc(Object.entries(k).map(([a, b]) => a + " " + b).join(", ")) : "–"}</td><td class="f8-r">${PAT[p].io.length}</td><td>${r.dev.filter((d) => d.ii === ii).map((d) => d.short).join(" ")}</td><td>${r.cab.filter((c) => c.ii === ii).map((c) => c.wd).join(" ") || "–"}</td></tr>`), "f8-small");
  $("f8CSch").innerHTML = svgInstance(r, S.inst);
  $("f8CPcab").innerHTML = pcabTab(r);
  $("f8CSvg").innerHTML = svgModule(r);
  $("f8CIo").innerHTML = r.io.length ? tab(["Address", "Tag", "Type", "Terminal", "Device", "Cable", "Description"], r.io.map((x) => { const t = r.terms.find((q) => q.io === x); return `<tr><td>${x.addr}</td><td class="f8-tag2">${esc(x.tag)}</td><td>${typeTag(x.t)}</td><td>-XD2:${t.n}</td><td>${x.dev.short}</td><td>${x.cab ? x.cab.wd : "–"}</td><td>${esc(x.ds)}</td></tr>`; }), "f8-small") : `<p class="am-note">No IO wires – only bus devices.</p>`;
  $("f8CDev").innerHTML = tab(["Designation", "Class", "Description", "BOM item", "Mounted"], r.dev.map((d) => `<tr><td>${esc(d.des)}</td><td>${d.cl}</td><td>${esc(d.ds)}</td><td>${esc(d.bom)}</td><td>${["FC", "QA", "TA", "KF", "TB"].includes(d.cl) ? "cabinet" : "field"}</td></tr>`), "f8-small");
}

/* ================================================================== 8D IO cards & addresses */
function html8D() {
  return card("f88D", "8D · IO cards & addresses", "used channels per type → cards with 20 % reserve → spare · fill per card",
    intro(`<p>Every IO signal needs one channel of a card of its type. Example card sizes (ET 200SP-class): DI 16, DO 16, AI 4, AO 2, F-DI 8, F-DO 4.
      The library keeps <b>20 % reserve</b> for later changes:</p>
      <p class="phd-eq">cards(type) = ⌈ used · (1 + 0.2) ÷ channels ⌉ (0 if used = 0) · spare = cards · channels − used · address of the k-th signal = TYPE (k ÷ ch + 1) . (k mod ch)</p>
      <p>Example: POOL01 has 11 F-DI → ⌈11 · 1.2 ÷ 8⌉ = ⌈1.65⌉ = 2 cards, 16 channels, 5 spare. The 12th DI would still fit in card DI1 (16 channels).</p>`) +
    `<div class="fe-row">${modSel()}</div><div id="f8DTab"></div><div id="f8DCards"></div>` +
    useCase(`the owner's specification says "≥ 20 % spare per IO type, distributed over the cards" – at FAT the owner checks it with this table.
      Safety cards (F-DI / F-DO) are expensive: two-channel sensors use two F-DI channels each, so the safety channel count drives the cost.`));
}
function init8D() { onRefresh(draw8D); }
function draw8D() {
  const r = calcModule(S.mod), used = TYPES.filter((t) => r.used[t]);
  if (!used.length) { $("f8DTab").innerHTML = `<p class="am-note">${S.mod}: no IO signals → no IO station.</p>`; $("f8DCards").innerHTML = ""; return; }
  $("f8DTab").innerHTML = tab(["Type", "Used", "Ch./card", "used·1.2÷ch", "Cards", "Capacity", "Spare", "Spare %", "Fill"], used.map((t) => {
    const cap = r.cards[t] * CH[t], f = r.used[t] / cap;
    return `<tr><td>${typeTag(t)}</td><td class="f8-r">${r.used[t]}</td><td class="f8-r">${CH[t]}</td><td class="f8-r">${fx(r.used[t] * 1.2 / CH[t], 2)}</td><td class="f8-r"><b>${r.cards[t]}</b></td><td class="f8-r">${cap}</td><td class="f8-r">${r.spare[t]}</td><td class="f8-r">${fx(100 * r.spare[t] / cap, 0)} %</td><td><span class="f8-fill"><i style="width:${(100 * f).toFixed(0)}%" class="${t.startsWith("F") ? "f8-fs" : ""}"></i></span></td></tr>`;
  }).concat(`<tr class="f8-tot"><td>Σ</td><td class="f8-r">${r.io.length}</td><td></td><td></td><td class="f8-r"><b>${r.cardsTotal}</b></td><td colspan="4">IO station: bus interface + ${r.cardsTotal} cards → 24 V = 0.3 + 0.05·${r.cardsTotal} = ${fx(0.3 + 0.05 * r.cardsTotal, 2)} A, loss = 4 + ${r.cardsTotal} = ${4 + r.cardsTotal} W</td></tr>`), "f8-small");
  const cards = []; used.forEach((t) => { for (let c = 1; c <= r.cards[t]; c++) cards.push([t, c, r.io.filter((x) => x.t === t && x.card === c)]); });
  $("f8DCards").innerHTML = `<h3 class="fe-h3">Cards and their channels</h3><div class="f8-cards">${cards.map(([t, c, xs]) => `<div class="f8-cardbox"><b>${t}${c}</b> <span class="sub">${xs.length}/${CH[t]}</span><span class="f8-fill"><i style="width:${(100 * xs.length / CH[t]).toFixed(0)}%" class="${t.startsWith("F") ? "f8-fs" : ""}"></i></span>
    <ol start="0" class="f8-ch">${Array.from({ length: CH[t] }, (z, i) => { const x = xs.find((q) => q.ch === i); return `<li class="${x ? "" : "f8-spare"}">${String(i).padStart(2, "0")} ${x ? esc(x.group + "." + x.sig) : "spare"}</li>`; }).join("")}</ol></div>`).join("")}</div>`;
}

/* ================================================================== 8E power & 24 V */
function html8E() {
  return card("f88E", "8E · Power & 24 V per module", "motors (In, contactor / inverter) · demand and installed current · feeder breaker + cable · 24 V PSU · losses",
    intro(`<p>The item-7 formulas applied to one module:</p>
      <p class="phd-eq">motor I<sub>n</sub> = kW·1000 ÷ (√3 · 400 · η · cos φ) (η 0.88, cos φ 0.82) · DOL contactor = smallest AC-3 size ≥ I<sub>n</sub> · inverter = smallest kW size ≥ kW · VFD loss = 3 % of kW</p>
      <p class="phd-eq">demand: P = Σ kW·k<sub>u</sub> · Q = Σ P·tan(acos cos φ) · S = √(P² + Q²) · I = S·1000 ÷ (√3·400) &nbsp;|&nbsp; installed (k<sub>u</sub> = 1): I<sub>inst</sub> → feeder I<sub>n</sub> ≥ I<sub>inst</sub> → cable I<sub>z,table</sub> ≥ I<sub>n</sub> ÷ (0.87 · 0.77)</p>
      <p class="phd-eq">24 V: I = Σ pattern i24 + IO station (0.3 + 0.05·cards) · PSU = smallest size ≥ 1.25·I · control power = PSU·24 ÷ 0.9 ÷ 1000 kW (k<sub>u</sub> 0.6, cos φ 0.95) · PSU loss = PSU·24·(1/0.92 − 1) W</p>
      <p class="phd-eq">power cable of each DOL / VFD / heater / feeder instance: I<sub>b</sub> ≤ I<sub>p</sub> ≤ I<sub>z</sub>·k → I<sub>p</sub> ÷ (0.87 · 0.77) ≤ I<sub>z,table</sub> (rule power_cable, revision 2026-11-15)</p>
      <p>The <b>demand</b> values go into the cell load list (item 7A); the <b>feeder</b> is sized from the installed values, because all loads of
      one module can run together (simplification: motor kW used as electrical kW in the load list).</p>`) +
    `<div class="fe-row">${modSel()}</div><div id="f8EKpi"></div>
    <div class="grid2 eq"><div><h3 class="fe-h3">Motors</h3><div id="f8EMot"></div><h3 class="fe-h3">Load list of the module</h3><div id="f8ELoad"></div></div>
    <div><h3 class="fe-h3">24 V budget</h3><div id="f8E24"></div><h3 class="fe-h3">Cabinet losses</h3><div id="f8ELoss"></div></div></div>
    <h3 class="fe-h3">Power cable sizing (per instance)</h3><div id="f8EPcab"></div>` +
    useCase(`the module power values feed the cell distribution board (8F) and the transformer check (item 7A); the losses go to the cabinet
      thermal design (item 7D): e.g. POOL01 with three inverters has ≈ 630 W losses – a 600 × 2000 cabinet needs a filter fan or a cooling unit.`));
}
function init8E() { onRefresh(draw8E); }
function draw8E() {
  const r = calcModule(S.mod);
  $("f8EKpi").innerHTML = kpis([["demand P", fx(r.P, 2) + " kW"], ["demand S", fx(r.S, 2) + " kVA"], ["demand I", fx(r.I, 2) + " A"], ["installed I_inst", fx(r.Iinst, 2) + " A"], ["feeder breaker", r.In ? r.In + " A" : "none"], ["feeder cable", r.A ? "4G" + r.A + " mm²" : "–"], ["24 V current", fx(r.i24, 3) + " A"], ["PSU", r.psu ? r.psu + " A" : "none"], ["losses", fx(r.loss, 1) + " W"]]);
  $("f8EMot").innerHTML = r.motors.length ? tab(["Group", "Starter", "kW", "In A", "Size", "Protection"], r.motors.map(([g, p, kw, In, sz]) => `<tr><td>${esc(g)}</td><td>${p}</td><td class="f8-r">${kw}</td><td class="f8-r">${fx(In, 3)}</td><td>${p === "DOL" ? sz + " A AC-3 contactor" : sz + " kW inverter"}</td><td>${p === "DOL" ? "MPCB set to " + fx(In, 2) + " A" : "line MCB / fuses per manual, STO"}</td></tr>`), "f8-small") : `<p class="am-note">No motors switched in this cabinet.</p>`;
  const tan = (c) => Math.tan(Math.acos(c));
  $("f8ELoad").innerHTML = r.loads.length ? tab(["Load", "kW", "k<sub>u</sub>", "cos φ", "P kW", "Q kvar"], r.loads.map(([kw, ku, cs, g, p]) => `<tr><td>${esc(g)} <span class="sub">${p}</span></td><td class="f8-r">${fx(kw, 3)}</td><td class="f8-r">${ku}</td><td class="f8-r">${cs}</td><td class="f8-r">${fx(kw * ku, 3)}</td><td class="f8-r">${fx(kw * ku * tan(cs), 3)}</td></tr>`).concat(
    `<tr class="f8-tot"><td>demand Σ</td><td class="f8-r">${fx(r.Pinst, 3)}</td><td></td><td></td><td class="f8-r">${fx(r.P, 3)}</td><td class="f8-r">${fx(r.Q, 3)}</td></tr>`), "f8-small") +
    kv([["Demand S = √(P² + Q²)", fx(r.S, 3) + " kVA → I = " + fx(r.I, 2) + " A"], ["Installed S<sub>inst</sub> (k<sub>u</sub> = 1)", fx(r.Sinst, 3) + " kVA → I<sub>inst</sub> = " + fx(r.Iinst, 2) + " A"],
      ["Feeder breaker I<sub>n</sub> ≥ I<sub>inst</sub>", r.In ? r.In + " A" : "no feeder"], ["Cable: I<sub>z,table</sub> ≥ I<sub>n</sub> ÷ 0.67", r.A ? `${fx(r.In / (C.k_temp * C.k_group), 1)} A → ${r.A} mm² (${C.ampacity_table.find((a) => a[0] === r.A)[1]} A)` : "–"]]) : `<p class="am-note">No loads – no feeder needed.</p>`;
  $("f8E24").innerHTML = r.i24L.length ? tab(["Instance", "Pattern", "I A"], r.i24L.map(([g, p, i]) => `<tr><td>${esc(g)}</td><td>${esc(p)}</td><td class="f8-r">${fx(i, 3)}</td></tr>`).concat(`<tr class="f8-tot"><td>Σ</td><td>× 1.25 = ${fx(r.i24raw * 1.25, 3)} A</td><td class="f8-r">${fx(r.i24, 3)}</td></tr>`), "f8-small") + `<p class="f8-pt">PSU = <b>${r.psu ? r.psu + " A" : "none"}</b> (sizes ${C.psu_sizes.join(", ")} A)</p>` : `<p class="am-note">No 24 V loads.</p>`;
  $("f8EPcab").innerHTML = pcabTab(r);
  $("f8ELoss").innerHTML = r.lossL.length ? tab(["Source", "", "W"], r.lossL.filter((x) => x[2]).map(([g, p, w]) => `<tr><td>${esc(g)}</td><td>${esc(p)}</td><td class="f8-r">${fx(w, 1)}</td></tr>`).concat(`<tr class="f8-tot"><td>Σ</td><td></td><td class="f8-r">${fx(r.loss, 1)}</td></tr>`), "f8-small") : `<p class="am-note">No losses.</p>`;
}

/* ================================================================== 8F kit builder */
function html8F() {
  return card("f88F", "8F · Kit builder", "a whole FMS = list of modules → totals, distribution-board schedule (one feeder per module instance), single-line",
    intro(`<p>A <b>kit</b> is the list of modules of one cell. The same module type can appear many times; each copy gets its own unit number
      (MC01, MC02, MC03 …), its own cabinet (or cabinet section) and its own feeder in the cell distribution board.</p>
      <p class="phd-eq">kit totals = Σ over the module instances (IO per type, cards, terminals, cables, metres, P, S, PSU, losses, devices) · S<sub>kit</sub> = arithmetic Σ S (no simultaneity – item 7A applies k<sub>s</sub>)</p>`) +
    `<div class="fe-row"><label class="f8-msel">Kit <select id="f8FKit" class="fe-sel f8-selw">${Object.keys(KITS).map((k) => `<option>${esc(k)}</option>`).join("")}<option value="__custom">custom (edited)</option></select></label>
      <button class="mx-el" id="f8FRst">Reset to the example kit</button></div>
    <div id="f8FGrid" class="f8-kitgrid"></div><div id="f8FKpi"></div>
    <h3 class="fe-h3">Modules of the kit</h3><div id="f8FTab"></div>
    <h3 class="fe-h3">Distribution-board schedule</h3><div id="f8FDb"></div>
    <h3 class="fe-h3">Single-line diagram</h3><div class="fe-scroll" id="f8FSld"></div>` +
    useCase(`in the basic design phase the owner's engineer builds the kit, sends the distribution-board schedule to the electrical contractor
      (feeder breakers and cables), the IO totals to the PLC supplier and the cable metres to the installation tender – all from the library,
      weeks before the detailed schematics exist.`));
}
function init8F() {
  $("f8FKit").addEventListener("change", () => { const v = $("f8FKit").value; if (v === "__custom") return; S.kitName = v; S.kit = null; store.set("kitName", v); store.del("kit"); refresh(); });
  $("f8FRst").addEventListener("click", () => { S.kitName = DEFAULT_KIT; S.kit = null; store.set("kitName", S.kitName); store.del("kit"); refresh(); });
  $("f8FGrid").addEventListener("click", (e) => {
    const b = e.target.closest("[data-k]"); if (!b) return;
    const list = kitList(), c = b.dataset.k;
    if (b.dataset.d === "+") { const at = list.lastIndexOf(c); if (at >= 0) list.splice(at + 1, 0, c); else list.push(c); }
    else { const at = list.lastIndexOf(c); if (at < 0) return; list.splice(at, 1); }
    S.kit = list; store.set("kit", list); refresh();
  });
  $("f8FTab").addEventListener("click", (e) => { const tr = e.target.closest("tr[data-m]"); if (tr) { setMod(tr.dataset.m); $("f88C").scrollIntoView({ behavior: "smooth", block: "start" }); } });
  onRefresh(draw8F);
}
function draw8F() {
  const list = kitList(), K = calcKit(list), t = K.tot;
  $("f8FKit").value = S.kit ? "__custom" : S.kitName;
  const cnt = {}; list.forEach((c) => { cnt[c] = (cnt[c] || 0) + 1; });
  $("f8FGrid").innerHTML = CODES.map((c) => `<div class="f8-kc${cnt[c] ? " f8-kon" : ""}" title="${esc(MODS[c].title)}"><span><b>${c}</b> ${esc(MODS[c].title.split(" (")[0])}</span><span class="f8-kb"><button class="mx-el f8-mini" data-k="${c}" data-d="-">−</button><b>${cnt[c] || 0}</b><button class="mx-el f8-mini" data-k="${c}" data-d="+">+</button></span></div>`).join("");
  $("f8FKpi").innerHTML = kpis([["module instances", t.modules], ["IO signals", t.io], ["IO cards", t.cardsTotal], ["terminals", t.terms], ["cables", t.cables], ["cable metres", t.metres], ["devices", t.devices], ["P demand", fx(t.P, 1) + " kW"], ["ΣS", fx(t.S, 1) + " kVA"], ["ΣPSU", fx(t.psu, 1) + " A"], ["losses", fx(t.loss / 1000, 2) + " kW"]]) +
    `<p class="am-note">IO per type used / cards: ${TYPES.map((x) => `${x} ${t.used[x]} / ${t.cards[x]}`).join(" · ")}</p>`;
  $("f8FTab").innerHTML = tab(["Unit", "Module", "IO", "Cards", "Term.", "Cables / m", "Dev.", "P kW", "S kVA", "PSU A", "Loss W"], K.mods.map((r) => `<tr data-m="${r.code}" class="f8-click"><td><b>${r.unit}</b></td><td>${r.code} ${esc(r.title.split(" (")[0])}</td><td class="f8-r">${r.io.length}</td><td class="f8-r">${r.cardsTotal}</td><td class="f8-r">${r.nTerms}</td><td class="f8-r">${r.nCables} / ${r.metres}</td><td class="f8-r">${r.nDevices}</td><td class="f8-r">${fx(r.P, 3)}</td><td class="f8-r">${fx(r.S, 3)}</td><td class="f8-r">${r.psu}</td><td class="f8-r">${fx(r.loss, 1)}</td></tr>`).concat(
    `<tr class="f8-tot"><td>Σ</td><td>${t.modules} modules</td><td class="f8-r">${t.io}</td><td class="f8-r">${t.cardsTotal}</td><td class="f8-r">${t.terms}</td><td class="f8-r">${t.cables} / ${t.metres}</td><td class="f8-r">${t.devices}</td><td class="f8-r">${fx(t.P, 3)}</td><td class="f8-r">${fx(t.S, 3)}</td><td class="f8-r">${fx(t.psu, 1)}</td><td class="f8-r">${fx(t.loss, 1)}</td></tr>`), "f8-small");
  let nf = 0;
  $("f8FDb").innerHTML = tab(["Feeder", "Unit", "Module", "I_inst A", "Breaker In A", "Cable", "S demand kVA", "I demand A"], K.mods.map((r, i) => (r.In ? (nf++, `<tr><td>${r.feeder}</td><td>${r.unit}</td><td>${r.code}</td><td class="f8-r">${fx(r.Iinst, 2)}</td><td class="f8-r"><b>${r.In}</b></td><td>4G${r.A} mm²</td><td class="f8-r">${fx(r.S, 3)}</td><td class="f8-r">${fx(r.I, 2)}</td></tr>`) : `<tr class="f8-dim"><td>(no feeder)</td><td>${r.unit}</td><td>${r.code}</td><td colspan="5">no loads → no feeder</td></tr>`)), "f8-small") +
    `<p class="am-note">${nf} feeders · feeder designation = =FMS1.&lt;unit&gt;-FC(number of FC devices in the module + 1), the breaker sits in the cell board but belongs to the module function · incoming: ΣS = ${fx(t.S, 1)} kVA → I = ΣS·1000 ÷ (√3·400) = ${fx(t.I, 0)} A before simultaneity (item 7A applies k<sub>s</sub> and the growth reserve).</p>`;
  $("f8FSld").innerHTML = svgSingleLine(K);
}
