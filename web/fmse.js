/* FMS engineering tab (#fmse) – a general method to design, control and implement ANY flexible manufacturing system.
 * 14 items, built one by one (contract: docs/FMS system design/60_contract_fmse.md). Item 1: system types, project pipeline (owner +
 * integrator), requirements questionnaire, module standard.  Data: fmse_data.js.
 * Deep links: /?feitem=1&fephase=P5&femod=M03#fmse  ·  /?fevar=40&fevol=800#fmse  ·  /?feitem=2&fecap=asm#fmse  ·  /?feitem=3&feel=agv#fmse */
import { TYPES, DOMAINS, PHASES, QUEST, FACES, MODULES, KIT, DOMKIT, ITEMS } from "./fmse_data.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const Q = new URLSearchParams(location.search);
const store = {
  get(k, d) { try { const v = localStorage.getItem("fmse." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("fmse." + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
};
const openTab = (k) => { const b = document.querySelector(`.tabs [data-tab="${k}"]`); if (b) { b.click(); window.scrollTo({ top: 0, behavior: "smooth" }); } };

/* ------------------------------------------------------------------ item switch */
let current = "1"; const built = {};
function showItem(n) {
  n = String(n); current = n;
  document.querySelectorAll("[data-feitem]").forEach((b) => b.classList.toggle("active", b.dataset.feitem === n));
  ITEMS.forEach(([i]) => { const el = $("feItem" + i), it = $("feIntro" + i); if (el) el.hidden = i !== n; if (it) it.hidden = i !== n; });
  build(n);
}
document.querySelectorAll("[data-feitem]").forEach((b) => b.addEventListener("click", () => { if (!b.disabled) showItem(b.dataset.feitem); }));
const prevTab = window.onTabShown;
window.onTabShown = (name) => { if (prevTab) prevTab(name); if (name === "fmse") build(current); };
function build(n) {
  if (built[n] || !$("feItem" + n)) return;
  const mods = { 2: "./fmse2.js", 3: "./fmse3.js", 4: "./fmse4.js", 5: "./fmse5.js", 6: "./fmse6.js", 7: "./fmse7.js", 8: "./fmse8.js", 9: "./fmse9.js", 10: "./fmse10.js" };                 // later items live in their own module files
  if (mods[n]) {
    built[n] = true;
    import(mods[n]).then((m) => m.mount($("feItem" + n))).catch((e) => { built[n] = false; $("feItem" + n).innerHTML = `<div class="card"><p class="fe-no">Item ${n} could not load: ${esc(e.message)}</p></div>`; });
    return;
  }
  const fn = { 1: item1 }[n]; if (!fn) return;
  built[n] = true; fn();
}
window.feCtl = { showItem, current: () => current };

/* ================================================================== ITEM 1 */
const S = {
  variety: +Q.get("fevar") || store.get("var", 12), volume: +Q.get("fevol") || store.get("vol", 1500),
  type: null, role: store.get("role", "both"), phase: Q.get("fephase") || "P2", months: store.get("months", 18),
  mod: Q.get("femod") || "M19", kit: null, domain: "Machining (prismatic)", answers: store.get("answers", {}),
};

function item1() {
  $("feItem1").innerHTML = `
  <div class="card"><div class="card-head"><h2>1A · Which kind of system? – the volume–variety chart</h2>
      <span class="sub">enter your numbers · zones are typical and overlap · the final choice comes from the capacity + cost study (items 2, 4)</span></div>
    <div class="grid2">
      <div><div class="fe-row">
          <label>Different part numbers (variety) <input type="number" id="feVar" min="1" max="10000" step="1"></label>
          <label>Volume per part number per year <input type="number" id="feVol" min="1" max="2000000" step="1"></label>
          <span class="sub">total = <b id="feTot"></b> parts / year</span></div>
        <div class="fe-scroll"><svg id="feChart" class="fe-chart" viewBox="0 0 640 400" role="img" aria-label="Volume–variety chart with system zones"></svg></div></div>
      <div><h3 class="fe-h3">Result</h3><div id="feTypeRes"></div>
        <p class="am-note"><b>Rule behind the chart:</b> high volume + low variety → fixed, fast, cheap per part (line). Low volume + high
          variety → flexible, slow, expensive per part (stand-alone CNC). An <b>FMS</b> sits in the middle: medium volume, medium variety,
          random order. Check also: total hours = Σ (volume × cycle time) ÷ available hours per machine → number of machines (item 2).</p></div>
    </div>
    <table class="am-tab fe-types"><thead><tr><th>System</th><th>What it is</th><th>Flexibility</th><th>Example</th></tr></thead>
      <tbody>${TYPES.map((t) => `<tr data-type="${t.k}"><td><span class="fe-dot fe-c${t.c}"></span><b>${esc(t.n)}</b></td><td>${esc(t.what)}</td><td>${esc(t.flex)}</td><td>${esc(t.ex)}</td></tr>`).join("")}</tbody></table>
  </div>

  <div class="card"><div class="card-head"><h2>1B · "Flexible" is different in every process domain</h2>
      <span class="sub">the same method, other modules · click a row to see its module kit in 1E</span></div>
    <div class="fe-scroll"><table class="am-tab fe-dom"><thead><tr><th>Domain</th><th>What changes between products</th><th>Typical flexible system</th><th>Key modules</th><th>Changeover driver</th><th>Typical control</th></tr></thead>
      <tbody>${DOMAINS.map((d) => `<tr data-dom="${esc(d[0])}">${d.map((c, i) => `<td>${i ? esc(c) : "<b>" + esc(c) + "</b>"}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
  </div>

  <div class="card"><div class="card-head"><h2>1C · The project pipeline – 11 phases, 2 roles</h2>
      <span class="sub">the same pipeline for every FMS · gates = questions you must answer YES before the next phase</span></div>
    <div class="fe-row">
      <span class="sub">Show tasks of</span>
      <div class="mx-nav fe-inline" id="feRole">${[["both", "Both roles"], ["o", "Factory owner's engineer"], ["i", "Integrator / supplier"]].map(([k, n]) => `<button class="mx-el" data-role="${k}">${n}</button>`).join("")}</div>
      <label>Total project length <input type="number" id="feMonths" min="4" max="60" step="1"> months</label></div>
    <div id="fePipe" class="fe-pipe"></div>
    <div id="fePhase"></div>
  </div>

  <div class="card"><div class="card-head"><h2>1D · Requirements questionnaire – the 40 questions for any factory</h2>
      <span class="sub">phase P1 · answers are saved in this browser only · export to send or archive</span></div>
    <div class="fe-row"><div class="fe-prog"><i id="feProgBar"></i></div><span id="feProgTxt" class="sub"></span>
      <button class="mx-el" id="feQEx">Fill example answers</button><button class="mx-el" id="feQClr">Clear</button>
      <button class="mx-el" id="feQMd">Export Markdown</button><button class="mx-el" id="feQJs">Export JSON</button>
      <label class="mx-el fe-file">Import JSON<input type="file" id="feQImp" accept=".json,application/json" hidden></label>
      <button class="mx-el" id="feQUse">Use Q02 in chart 1A</button></div>
    <div id="feQuest"></div>
  </div>

  <div class="card"><div class="card-head"><h2>1E · The module standard – every FMS is built from the same modules</h2>
      <span class="sub">22 modules × 9 faces · items 3–10 fill each face (drawings, circuits, PLC blocks) · click a module</span></div>
    <div class="fe-row"><label>Kit for system <select id="feKit"><option value="">– all modules –</option>${TYPES.map((t) => `<option value="${t.k}">${esc(t.n)}</option>`).join("")}${Object.keys(DOMKIT).map((d) => `<option value="d:${esc(d)}">${esc(d)} system</option>`).join("")}</select></label>
      <span class="sub" id="feKitTxt"></span></div>
    <div class="fe-scroll"><svg id="feMods" class="fe-chart" viewBox="0 0 900 470" role="img" aria-label="Modules of an FMS around the cell controller"></svg></div>
    <div class="grid2 eq"><div id="feModD"></div>
      <div><h3 class="fe-h3">The 9 faces of every module (the module contract)</h3>
        <table class="am-tab"><thead><tr><th>Face</th><th>What is standardised</th><th>Filled in</th></tr></thead>
          <tbody>${FACES.map(([k, n, w, it]) => `<tr data-face="${k}"><td><b>${esc(n)}</b></td><td>${esc(w)}</td><td>${esc(it)}</td></tr>`).join("")}</tbody></table>
        <p class="am-note"><b>Why modules?</b> A new FMS is then <b>configured</b>, not invented: choose modules → copy their standard drawings,
          IO lists, PLC blocks, HMI screens and FAT steps → adapt parameters. Typical saving in engineering hours: 30–60 % from the
          second project on, and fewer commissioning errors because every block is already tested.</p></div></div>
  </div>`;

  // 1A
  $("feVar").value = S.variety; $("feVol").value = S.volume;
  ["feVar", "feVol"].forEach((id) => $(id).addEventListener("input", () => { S.variety = Math.max(1, +$("feVar").value || 1); S.volume = Math.max(1, +$("feVol").value || 1); store.set("var", S.variety); store.set("vol", S.volume); drawChart(); }));
  $("feItem1").querySelector(".fe-types").addEventListener("click", (e) => { const r = e.target.closest("[data-type]"); if (r) { S.type = r.dataset.type; drawChart(); setKit(r.dataset.type); } });
  $("feChart").addEventListener("click", (e) => { const z = e.target.closest("[data-type]"); if (z) { S.type = z.dataset.type; drawChart(); setKit(z.dataset.type); } });
  drawChart();
  // 1B
  $("feItem1").querySelector(".fe-dom").addEventListener("click", (e) => { const r = e.target.closest("[data-dom]"); if (!r) return; S.domain = r.dataset.dom; setKit(DOMKIT[S.domain] ? "d:" + S.domain : "fms"); $("feMods").scrollIntoView({ behavior: "smooth", block: "center" }); });
  // 1C
  $("feMonths").value = S.months;
  $("feMonths").addEventListener("input", () => { S.months = Math.max(4, +$("feMonths").value || 18); store.set("months", S.months); drawPipe(); });
  $("feRole").addEventListener("click", (e) => { const b = e.target.closest("[data-role]"); if (b) { S.role = b.dataset.role; store.set("role", S.role); drawPipe(); } });
  $("fePipe").addEventListener("click", (e) => { const b = e.target.closest("[data-ph]"); if (b) { S.phase = b.dataset.ph; drawPipe(); } });
  $("fePhase").addEventListener("click", (e) => { const b = e.target.closest("[data-open]"); if (b) openTab(b.dataset.open); });
  drawPipe();
  // 1D
  drawQuest();
  $("feQuest").addEventListener("input", (e) => { const f = e.target.closest("[data-q]"); if (!f) return; S.answers[f.dataset.q] = f.value; store.set("answers", S.answers); progress(); });
  $("feQEx").addEventListener("click", () => { QUEST.forEach(([id, , , , ex]) => { if (!S.answers[id]) S.answers[id] = ex; }); store.set("answers", S.answers); drawQuest(); });
  $("feQClr").addEventListener("click", () => { if (!confirm("Clear all answers in this browser?")) return; S.answers = {}; store.set("answers", S.answers); drawQuest(); });
  $("feQMd").addEventListener("click", () => download("fms_requirements.md", toMarkdown(), "text/markdown"));
  $("feQJs").addEventListener("click", () => download("fms_requirements.json", JSON.stringify({ format: "fms-requirements-v1", date: new Date().toISOString().slice(0, 10), answers: S.answers }, null, 2), "application/json"));
  $("feQImp").addEventListener("change", (e) => { const f = e.target.files[0]; if (!f) return; f.text().then((t) => { const j = JSON.parse(t); if (!j.answers) throw new Error("no 'answers' in file"); S.answers = j.answers; store.set("answers", S.answers); drawQuest(); }).catch((err) => alert("Import failed: " + err.message)); e.target.value = ""; });
  $("feQUse").addEventListener("click", () => { const v = parseFloat(S.answers.q02); if (!(v > 0)) { alert("Answer Q02 (number of part numbers) first."); return; } S.variety = v; $("feVar").value = v; store.set("var", v); drawChart(); $("feChart").scrollIntoView({ behavior: "smooth", block: "center" }); });
  // 1E
  $("feKit").addEventListener("change", () => setKit($("feKit").value));
  $("feMods").addEventListener("click", (e) => { const g = e.target.closest("[data-mod]"); if (g) { S.mod = g.dataset.mod; drawMods(); } });
  setKit(store.get("kit", ""));
  // 1F–1M: deep sections (guides + programs) live in fmse1x.js
  const deepEl = document.createElement("div"); deepEl.id = "feItem1x"; $("feItem1").appendChild(deepEl);
  import("./fmse1x.js").then((m) => m.mount(deepEl)).catch((e) => { deepEl.innerHTML = `<div class="card"><p class="fe-no">Sections 1F–1M could not load: ${esc(e.message)}</p></div>`; });
}

/* ---------- 1A chart: log x = variety (1 … 10 000), log y = volume per part per year (1 … 2 000 000) */
const CH = { x0: 70, x1: 620, y0: 360, y1: 20, vx: [0, 4], vy: [0, Math.log10(2e6)] };
const px = (v) => CH.x0 + (Math.log10(v) - CH.vx[0]) / (CH.vx[1] - CH.vx[0]) * (CH.x1 - CH.x0);
const py = (v) => CH.y0 - (Math.log10(v) - CH.vy[0]) / (CH.vy[1] - CH.vy[0]) * (CH.y0 - CH.y1);
function rank() {
  // distance in log space to the zone (0 = inside); sorted best first
  const lx = Math.log10(S.variety), ly = Math.log10(S.volume);
  return TYPES.map((t) => {
    const [a, b, c, d] = t.zone.map(Math.log10);
    const dx = lx < a ? a - lx : lx > b ? lx - b : 0, dy = ly < c ? c - ly : ly > d ? ly - d : 0;
    const cx = (a + b) / 2, cy = (c + d) / 2;
    return { t, inside: dx === 0 && dy === 0, dist: Math.hypot(dx, dy), centre: Math.hypot((lx - cx) / (b - a || 1), (ly - cy) / (d - c || 1)) };
  }).sort((p, q) => (p.dist - q.dist) || (p.centre - q.centre));
}
function drawChart() {
  const r = rank(), best = r[0].t.k, sel = S.type || best;
  $("feTot").textContent = Math.round(S.variety * S.volume).toLocaleString("en");
  let s = "";
  for (let e = 0; e <= 4; e++) { const x = px(10 ** e); s += `<line class="fe-grid" x1="${x}" x2="${x}" y1="${CH.y1}" y2="${CH.y0}"/><text class="fe-tick" x="${x}" y="${CH.y0 + 16}" text-anchor="middle">${(10 ** e).toLocaleString("en")}</text>`; }
  for (let e = 0; e <= 6; e++) { const y = py(10 ** e); s += `<line class="fe-grid" x1="${CH.x0}" x2="${CH.x1}" y1="${y}" y2="${y}"/><text class="fe-tick" x="${CH.x0 - 6}" y="${y + 4}" text-anchor="end">${e < 3 ? 10 ** e : 10 ** e / 1000 + "k"}</text>`; }
  TYPES.forEach((t) => {
    const [a, b, c, d] = t.zone, x = px(a), w = px(b) - x, y = py(d), h = py(c) - y;
    s += `<g data-type="${t.k}" class="fe-zone${t.k === sel ? " fe-zsel" : ""}"><rect class="fe-z${t.c}" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/>
      <text class="fe-zl" x="${x + w / 2}" y="${y + Math.min(h / 2, 40) + 4}" text-anchor="middle">${esc(t.n.replace(/ \(.*\)/, "").replace("Flexible manufacturing", "Flex. mfg.").replace("Reconfigurable manufacturing system", "Reconfig. (RMS)").replace("Flexible transfer line", "Flex. transfer line"))}</text></g>`;
  });
  const X = Math.min(CH.x1, Math.max(CH.x0, px(S.variety))), Y = Math.min(CH.y0, Math.max(CH.y1, py(S.volume)));
  s += `<circle class="fe-pt" cx="${X}" cy="${Y}" r="7"/><text class="fe-ptl" x="${X + 10}" y="${Y - 10}">your system</text>`;
  s += `<text class="fe-axis" x="${(CH.x0 + CH.x1) / 2}" y="394" text-anchor="middle">Variety – number of different part numbers (log)</text>
        <text class="fe-axis" transform="translate(16 ${(CH.y0 + CH.y1) / 2}) rotate(-90)" text-anchor="middle">Volume per part number per year (log)</text>`;
  $("feChart").innerHTML = s;
  const t = TYPES.find((x) => x.k === sel), inside = r.filter((x) => x.inside).map((x) => x.t.n);
  $("feTypeRes").innerHTML = `<p class="fe-big"><span class="fe-dot fe-c${r[0].t.c}"></span><b>${esc(r[0].t.n)}</b> ${r[0].inside ? "" : '<span class="sub">(nearest zone)</span>'}</p>
    ${inside.length > 1 ? `<p class="sub">Your point is also inside: ${inside.filter((n) => n !== r[0].t.n).map(esc).join(", ")} – compare these variants in phase P2.</p>` : ""}
    <table class="am-kv"><tbody><tr><td>Selected</td><td><b>${esc(t.n)}</b></td></tr><tr><td>What it is</td><td>${esc(t.what)}</td></tr><tr><td>Flexibility</td><td>${esc(t.flex)}</td></tr><tr><td>Example</td><td>${esc(t.ex)}</td></tr>
      <tr><td>Modules</td><td>${KIT[t.k].length} standard modules – see 1E</td></tr></tbody></table>`;
  document.querySelectorAll("#feItem1 .fe-types tr[data-type]").forEach((tr) => tr.classList.toggle("fe-sel", tr.dataset.type === sel));
}

/* ---------- 1C pipeline */
function drawPipe() {
  document.querySelectorAll("#feRole [data-role]").forEach((b) => b.classList.toggle("active", b.dataset.role === S.role));
  const tot = PHASES.reduce((a, p) => a + p.dur, 0);
  let start = 0;
  $("fePipe").innerHTML = PHASES.map((p) => {
    const m = S.months * p.dur / tot, from = start; start += m;
    return `<button class="fe-ph${p.k === S.phase ? " active" : ""}" data-ph="${p.k}" style="flex:${p.dur} 1 0"><b>${p.k}</b><span>${esc(p.n)}</span><em>${m.toFixed(1)} mo · m${Math.floor(from) + 1}</em></button>`;
  }).join("");
  const p = PHASES.find((x) => x.k === S.phase) || PHASES[0];
  const list = (a) => `<ul class="am-ul">${a.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  const cols = [];
  if (S.role !== "i") cols.push(`<div class="fe-lane fe-lo"><h4>Factory owner's engineer</h4>${list(p.o)}</div>`);
  if (S.role !== "o") cols.push(`<div class="fe-lane fe-li"><h4>Integrator / supplier</h4>${list(p.i)}</div>`);
  $("fePhase").innerHTML = `<div class="fe-phd"><h3 class="fe-h3">${p.k} · ${esc(p.n)} <span class="sub">≈ ${p.dur} % of the project = ${(S.months * p.dur / tot).toFixed(1)} months of ${S.months}</span></h3>
    <p><b>Goal:</b> ${esc(p.goal)}</p>
    <div class="fe-lanes">${cols.join("")}</div>
    <div class="grid2 eq"><div><h4>Deliverables (documents / results)</h4>${list(p.out)}</div>
      <div><h4>Gate – answer YES to all before ${p.k === "P10" ? "the next project" : "the next phase"}</h4><ul class="fe-gate">${p.gate.map((g) => `<li>☐ ${esc(g)}</li>`).join("")}</ul></div></div>
    <p class="sub">Worked examples in this twin: ${p.tabs.map(([k, n]) => `<button class="mx-el fe-link" data-open="${k}">${esc(n)}</button>`).join(" ")}</p></div>`;
}

/* ---------- 1D questionnaire */
function drawQuest() {
  const groups = [...new Set(QUEST.map((q) => q[1]))];
  $("feQuest").innerHTML = groups.map((g) => `<details class="fe-qg" ${g === "Products" ? "open" : ""}><summary><b>${esc(g)}</b> <span class="sub" data-qg="${esc(g)}"></span></summary>
    <div class="fe-qgrid">${QUEST.filter((q) => q[1] === g).map(([id, , q, why, ex, ty]) => {
      const v = S.answers[id] || "";
      const field = ty.startsWith("s:") ? `<select data-q="${id}"><option value=""></option>${ty.slice(2).split("|").map((o) => `<option${o === v ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>`
        : `<input data-q="${id}" type="${ty === "n" ? "number" : "text"}" value="${esc(v)}" placeholder="e.g. ${esc(ex)}">`;
      return `<label class="fe-q"><span><b>${id.toUpperCase()}</b> ${esc(q)}</span>${field}<span class="sub">Why: ${esc(why)}</span></label>`;
    }).join("")}</div></details>`).join("");
  progress();
}
function progress() {
  const n = QUEST.filter(([id]) => String(S.answers[id] || "").trim()).length;
  $("feProgBar").style.width = (100 * n / QUEST.length) + "%";
  $("feProgTxt").textContent = `${n} / ${QUEST.length} answered`;
  document.querySelectorAll("#feQuest [data-qg]").forEach((el) => { const qs = QUEST.filter((q) => q[1] === el.dataset.qg); el.textContent = `${qs.filter(([id]) => String(S.answers[id] || "").trim()).length} / ${qs.length}`; });
}
function toMarkdown() {
  const groups = [...new Set(QUEST.map((q) => q[1]))];
  return `# FMS requirements questionnaire\n\nDate: ${new Date().toISOString().slice(0, 10)} · answered ${QUEST.filter(([id]) => String(S.answers[id] || "").trim()).length} / ${QUEST.length}\n\n` +
    groups.map((g) => `## ${g}\n\n| No. | Question | Answer |\n|---|---|---|\n` + QUEST.filter((q) => q[1] === g).map(([id, , q]) => `| ${id.toUpperCase()} | ${q} | ${String(S.answers[id] || "").replace(/\|/g, "/").replace(/\n/g, " ") || "–"} |`).join("\n")).join("\n\n") + "\n";
}
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- 1E module map */
const GROUPS = ["Process", "Handling", "Storage", "Transport", "Quality", "Infrastructure", "Control"];
function setKit(v) {
  S.kit = v || ""; store.set("kit", S.kit);
  if ($("feKit")) $("feKit").value = S.kit;
  drawMods();
}
function kitList() {
  if (!S.kit) return null;
  return S.kit.startsWith("d:") ? DOMKIT[S.kit.slice(2)] : KIT[S.kit];
}
function drawMods() {
  const kit = kitList();
  $("feKitTxt").textContent = kit ? `${kit.length} of ${MODULES.length} modules used (highlighted). Starting kit only – add / remove modules in your concept.` : "";
  // control modules in the centre column, the others in group columns around
  const ctl = MODULES.filter((m) => m[2] === "Control"), others = GROUPS.filter((g) => g !== "Control");
  const colX = { Process: 10, Handling: 160, Storage: 310, Transport: 600, Quality: 750, Infrastructure: 750 };
  let s = "", bus = `<rect class="fe-bus" x="455" y="20" width="10" height="430" rx="5"/><text class="fe-tick" x="470" y="462">cell network (item 6)</text>`;
  let lines = "";
  const box = (m, x, y, w = 140) => {
    const on = !kit || kit.includes(m[0]), sel = m[0] === S.mod;
    lines += `<line class="fe-link-l${on ? "" : " fe-off"}" x1="${x < 455 ? x + w : x}" y1="${y + 22}" x2="${x < 455 ? 455 : 465}" y2="${y + 22}"/>`;
    return `<g data-mod="${m[0]}" class="fe-mod${on ? "" : " fe-off"}${sel ? " fe-msel" : ""}"><rect x="${x}" y="${y}" width="${w}" height="44" rx="7"/>
      <text class="fe-mc" x="${x + 8}" y="${y + 17}">${m[0]}</text><text class="fe-mn" x="${x + 8}" y="${y + 34}">${esc(((n) => n.length > 24 ? n.slice(0, 23) + "…" : n)(m[1].replace(/ \(.*?\)/g, "")))}</text>
</g>`;
  };
  others.forEach((g) => {
    const ms = MODULES.filter((m) => m[2] === g);
    let y0 = g === "Infrastructure" ? 250 : 40;
    s += `<text class="fe-gh" x="${colX[g]}" y="${y0 - 8}">${g}</text>`;
    ms.forEach((m, i) => { s += box(m, colX[g], y0 + i * 52); });
  });
  // control column sits between 310+140 and 600: draw it at the bus, stacked from the bottom
  s += `<text class="fe-gh" x="485" y="292">Control</text>`;
  ctl.forEach((m, i) => { s += box(m, 485, 300 + i * 52, 105); });
  $("feMods").innerHTML = lines + bus + s;
  const m = MODULES.find((x) => x[0] === S.mod) || MODULES[0];
  const crit = m[5].split(",").map((x) => x.trim());
  $("feModD").innerHTML = `<h3 class="fe-h3">${m[0]} · ${esc(m[1])}</h3>
    <table class="am-kv"><tbody><tr><td>Group</td><td>${esc(m[2])}</td></tr><tr><td>What it does</td><td>${esc(m[3])}</td></tr>
      <tr><td>Typical IO (DI / DO / AI)</td><td>${esc(m[4])} <span class="sub">example size</span></td></tr>
      <tr><td>Used in</td><td>${Object.entries(KIT).filter(([, l]) => l.includes(m[0])).map(([k]) => esc(TYPES.find((t) => t.k === k).n.replace(/ \(.*\)/, ""))).join(", ") || "–"}${Object.entries(DOMKIT).filter(([, l]) => l.includes(m[0])).map(([d]) => ", " + esc(d)).join("")}</td></tr></tbody></table>
    <h4>Its 9 faces <span class="sub">★ = most critical for this module</span></h4>
    <ul class="fe-faces">${FACES.map(([k, n, , it]) => `<li class="${crit.includes(k) ? "fe-crit" : ""}">${crit.includes(k) ? "★" : "·"} <b>${esc(n)}</b> <span class="sub">${esc(it)}</span></li>`).join("")}</ul>`;
}

const deep = Q.get("feitem");
if (deep && deep !== "1") showItem(deep);
