/* AI tab (#ai) – what AI is, where it helps in THIS factory, live labs (ailab.js), and how to start.
 * Data: ai_data.js. Deep links: /?aiitem=2&aiuse=pdm#ai · /?aiitem=3&ailab=opt#ai · /?aiitem=4#ai */
import { KINDS, CAN, ROLES, USES, ROAD, ARCH, ROLESP, RISKS, LAW, QUIZ } from "./ai_data.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const Q = new URLSearchParams(location.search);
const dots = (n, m = 5) => "●".repeat(n) + "○".repeat(m - n);
const TABNAME = (k) => { const b = document.querySelector(`.tabs [data-tab="${k}"]`); return b ? b.textContent.trim() : k; };
const openTab = (k) => { const b = document.querySelector(`.tabs [data-tab="${k}"]`); if (b) { b.click(); window.scrollTo({ top: 0, behavior: "smooth" }); } };

/* ------------------------------------------------------------------ item switch */
let current = "1"; const built = {};
function showItem(n) {
  n = String(n); current = n;
  document.querySelectorAll("[data-aiitem]").forEach((b) => b.classList.toggle("active", b.dataset.aiitem === n));
  ["1", "2", "3", "4"].forEach((i) => { const el = $("aiItem" + i), it = $("aiIntro" + i); if (el) el.hidden = i !== n; if (it) it.hidden = i !== n; });
  build(n);
}
document.querySelectorAll("[data-aiitem]").forEach((b) => b.addEventListener("click", () => showItem(b.dataset.aiitem)));
const prevTab = window.onTabShown;
window.onTabShown = (name) => { if (prevTab) prevTab(name); if (name === "ai") build(current); };
function build(n) {
  if (built[n] || !$("aiItem" + n)) return; built[n] = true;
  if (n === "3") { import("./ailab.js").then((m) => m.mountLab($("aiItem3"))).catch((e) => { $("aiItem3").innerHTML = `<div class="card"><p class="am-warn">AI labs could not load: ${esc(e.message)}</p></div>`; }); return; }
  ({ 1: item1, 2: item2, 4: item4 })[n]();
}

/* ------------------------------------------------------------------ item 1: AI explained */
let quiz = {};
function item1() {
  $("aiItem1").innerHTML = `
  <div class="card"><div class="card-head"><h2>What is AI – in one minute</h2><span class="sub">for engineers, no maths needed</span></div>
    <div class="ai-big">
      <div class="ai-flow">${["Data from the factory<br><small>sensors, images, orders, documents</small>", "Learning<br><small>the computer finds the pattern itself from examples</small>", "Model<br><small>a formula with thousands of numbers</small>", "Prediction / decision<br><small>'bearing will fail in ≈ 2 weeks' – with a probability</small>", "Action by people or the machine<br><small>plan repair, change feed, sort out part</small>"].map((s, i) => `<div class="ai-fs"><b>${i + 1}</b><span>${s}</span></div>`).join('<div class="ai-fa">→</div>')}</div>
      <p><b>Classic programming:</b> an engineer writes the rule (IF vibration &gt; 4.5 mm/s THEN alarm). <b>Machine learning:</b> the computer learns the rule from many examples – it can find patterns that combine many signals at once. <b>But:</b> it is only as good as the data, it gives probabilities (not certainty), and engineers must still set the goal, the limits and check the result.</p>
    </div></div>
  <div class="card"><div class="card-head"><h2>The 6 kinds of AI used in industry</h2><span class="sub">what it does · how it learns · example in your factory · what it needs</span></div>
    <div class="ai-kinds">${KINDS.map(([k, n, w, how, ex, need]) => `<div class="ai-kind"><div class="ai-ic">${icon(k)}</div><h4>${esc(n)}</h4><p>${esc(w)}</p><div class="sub"><b>Learns:</b> ${esc(how)}</div><div class="sub"><b>Example:</b> ${esc(ex)}</div><div class="sub"><b>Needs:</b> ${esc(need)}</div></div>`).join("")}</div></div>
  <div class="grid2 eq" style="margin-top:0">
    <div class="card"><div class="card-head"><h2>What AI can – and cannot – do</h2></div>
      <table class="am-tab"><thead><tr><th>✓ AI can</th><th>✗ AI cannot</th></tr></thead><tbody>${CAN.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</tbody></table></div>
    <div class="card"><div class="card-head"><h2>The 6 roles of AI in a factory</h2></div>
      <table class="am-kv"><tbody>${[["Predict", "failures, quality, tool wear, demand – before it happens"], ["Inspect", "see defects on 100 % of parts with cameras"], ["Optimise", "best cutting data, schedule, routes, energy"], ["Automate / control", "robots that see, CNCs that adapt"], ["Plan + forecast", "orders, stock, capacity"], ["Assist people", "answer questions from documents, explain alarms, draft code and instructions"]].map(([a, b]) => `<tr><td><b>${a}</b></td><td>${b} <span class="sub">(${USES.filter((u) => u.role === ROLES.find((r) => r[1] === a)[0]).length} use cases in item 2)</span></td></tr>`).join("")}</tbody></table>
      <p class="am-note">Rule of thumb: <b>first measure and connect, then statistics, then AI.</b> In most factories 70–80 % of the effort is data collection and cleaning, not the AI model.</p></div></div>
  <div class="card"><div class="card-head"><h2>Is AI the right tool for my problem? – 6 questions</h2><span class="sub">click yes / no</span></div>
    <div id="aiQuiz"></div></div>`;
  $("aiQuiz").addEventListener("click", (e) => { const b = e.target.closest("[data-q]"); if (b) { quiz[b.dataset.q] = b.dataset.v === "1"; renderQuiz(); } });
  renderQuiz();
}
function renderQuiz() {
  const rows = QUIZ.map(([q, h], i) => `<tr><td><b>${i + 1}.</b> ${esc(q)}<div class="sub">${esc(h)}</div></td><td class="ai-yn"><button class="chip ${quiz[i] === true ? "am-sel" : ""}" data-q="${i}" data-v="1">yes</button><button class="chip ${quiz[i] === false ? "am-sel" : ""}" data-q="${i}" data-v="0">no</button></td></tr>`).join("");
  const n = Object.keys(quiz).length, yes = Object.values(quiz).filter(Boolean).length;
  let verdict = "Answer all 6 questions.";
  if (n === 6) {
    if (quiz[1]) verdict = "→ A simple rule / limit already solves it: use the rule (cheaper, explainable). Keep AI for later.";
    else if (!quiz[0]) verdict = "→ First define the goal as a number with money behind it.";
    else if (!quiz[2]) verdict = "→ Not yet: start collecting the data now (3–6 months), then come back.";
    else if (!quiz[3]) verdict = "→ Stabilise the process first (standard work, SPC) – AI on an unstable process learns noise.";
    else if (!quiz[4]) verdict = "→ Use AI only as an advisor with a person or a limit in the loop – or not at all for this task.";
    else if (!quiz[5]) verdict = "→ Plan where the result appears (SCADA, MES, maintenance order) before you build the model.";
    else verdict = "✓ Good AI candidate: start a pilot on one machine (roadmap in item 4) and compare with today's method.";
  }
  $("aiQuiz").innerHTML = `<table class="am-tab"><tbody>${rows}</tbody></table><p class="ai-verdict"><b>${esc(verdict)}</b> <span class="sub">(${yes} yes of ${n} answered)</span></p>`;
}
function icon(k) {
  const s = (b) => `<svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">${b}</svg>`, c = "var(--series)", m = "var(--text-2)";
  return s({
    sup: `<circle cx="10" cy="34" r="3" fill="${c}"/><circle cx="16" cy="30" r="3" fill="${c}"/><circle cx="30" cy="16" r="3" fill="none" stroke="${c}" stroke-width="2"/><circle cx="36" cy="12" r="3" fill="none" stroke="${c}" stroke-width="2"/><line x1="6" y1="12" x2="42" y2="38" stroke="${m}" stroke-dasharray="3 2"/>`,
    unsup: `<circle cx="14" cy="16" r="8" fill="none" stroke="${m}"/><circle cx="32" cy="30" r="9" fill="none" stroke="${m}"/><circle cx="14" cy="16" r="2" fill="${c}"/><circle cx="32" cy="30" r="2" fill="${c}"/><circle cx="40" cy="10" r="3" fill="var(--critical)"/>`,
    vision: `<rect x="6" y="12" width="28" height="22" rx="3" fill="none" stroke="${m}" stroke-width="2"/><circle cx="20" cy="23" r="6" fill="none" stroke="${c}" stroke-width="2"/><rect x="34" y="18" width="8" height="10" fill="${m}"/>`,
    opt: `<path d="M6 38 Q16 8 24 26 T42 10" fill="none" stroke="${m}" stroke-width="2"/><circle cx="20" cy="20" r="3" fill="${c}"/><path d="M30 36 l6-6" stroke="${c}" stroke-width="2"/>`,
    fc: `<polyline points="4,34 12,28 20,30 28,20" fill="none" stroke="${m}" stroke-width="2"/><polyline points="28,20 36,16 44,12" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="3 2"/>`,
    gen: `<rect x="6" y="8" width="30" height="20" rx="4" fill="none" stroke="${m}" stroke-width="2"/><path d="M12 28 l-2 8 l8-8" fill="none" stroke="${m}" stroke-width="2"/><line x1="12" y1="15" x2="30" y2="15" stroke="${c}" stroke-width="2"/><line x1="12" y1="21" x2="24" y2="21" stroke="${c}" stroke-width="2"/>`,
  }[k] || "");
}

/* ------------------------------------------------------------------ item 2: use-case map */
let sel = Q.get("aiuse") || "pdm", fArea = "";
function item2() {
  const areas = [...new Set(USES.map((u) => u.area))];
  $("aiItem2").innerHTML = `
  <div class="grid2 eq" style="margin-top:0">
    <div class="card"><div class="card-head"><h2>Where AI helps – area × role</h2><span class="sub">each dot = one use case · bigger = more value for this factory · click</span></div><div id="aiMx" class="am-wrap"></div></div>
    <div class="card"><div class="card-head"><h2>Value vs effort</h2><span class="sub">filled = proven products exist (maturity ≥ 4) · hollow = newer · top-left = start here</span></div><div id="aiSc"></div></div></div>
  <div class="card"><div class="card-head"><h2>Use case detail</h2><span class="sub">data needed · method · typical benefit · pitfalls · link to the twin tab</span></div><div id="aiD"></div></div>
  <div class="card"><div class="card-head"><h2>All ${USES.length} AI use cases for this factory</h2><span class="sub">benefits = typical ranges reported – your result depends on your data</span></div>
    <div class="am-filt"><span class="sub">Area:</span><select id="aiArea"><option value="">all</option>${areas.map((a) => `<option>${esc(a)}</option>`).join("")}</select></div>
    <div class="am-wrap"><table class="am-tab" id="aiT"></table></div></div>`;
  $("aiItem2").addEventListener("click", (e) => { const t = e.target.closest("[data-u]"); if (t) { sel = t.dataset.u; mx(); sc(); table(); det(); if (t.tagName === "TR") $("aiD").scrollIntoView({ behavior: "smooth", block: "start" }); } const o = e.target.closest("[data-open]"); if (o) openTab(o.dataset.open); });
  $("aiArea").addEventListener("change", (e) => { fArea = e.target.value; table(); });
  mx(); sc(); table(); det();
}
function mx() {
  const areas = [...new Set(USES.map((u) => u.area))], L = 200, cw = 92, rh = 34, W = L + ROLES.length * cw + 10, H = 34 + areas.length * rh;
  let g = ROLES.map(([k, n], j) => `<text x="${L + j * cw + cw / 2}" y="18" text-anchor="middle" class="am-s am-b">${n}</text>`).join("");
  areas.forEach((a, i) => { const y = 34 + i * rh + rh / 2; g += `<line x1="${L}" y1="${y}" x2="${W - 10}" y2="${y}" class="am-grid"/><text x="${L - 8}" y="${y + 4}" text-anchor="end" class="am-s">${esc(a)}</text>`;
    ROLES.forEach(([rk], j) => { const us = USES.filter((u) => u.area === a && u.role === rk); us.forEach((u, m) => { const x = L + j * cw + cw / 2 + (m - (us.length - 1) / 2) * 16, r = 3 + u.val * 1.3, on = u.k === sel;
      g += `<g data-u="${u.k}" data-tip="${esc(u.name)}" class="ai-pt"><circle cx="${x}" cy="${y}" r="11" class="am-hit"/><circle cx="${x}" cy="${y}" r="${r}" class="am-scd ${u.mat >= 4 ? "" : "am-hol"} ${on ? "am-on2" : ""}"/></g>`; }); }); });
  $("aiMx").innerHTML = `<div class="am-chart"><svg viewBox="0 0 ${W} ${H}" class="am-svgc" style="min-width:640px">${g}</svg><div class="am-tip" hidden></div></div>`;
  tips($("aiMx"));
}
function sc() {
  const W = 520, H = 360, L = 50, B = 44, T = 14, R = 14, sx = (v) => L + (v - 0.5) / 3 * (W - L - R), sy = (v) => H - B - (v - 0.5) / 5 * (H - T - B);
  let g = "";
  [1, 2, 3].forEach((v) => { g += `<line x1="${sx(v)}" y1="${T}" x2="${sx(v)}" y2="${H - B}" class="am-grid"/><text x="${sx(v)}" y="${H - B + 16}" text-anchor="middle" class="am-s">${["low", "medium", "high"][v - 1]}</text>`; });
  [1, 2, 3, 4, 5].forEach((v) => { g += `<line x1="${L}" y1="${sy(v)}" x2="${W - R}" y2="${sy(v)}" class="am-grid"/><text x="${L - 8}" y="${sy(v) + 4}" text-anchor="end" class="am-s">${v}</text>`; });
  g += `<text x="${(L + W) / 2}" y="${H - 8}" text-anchor="middle" class="am-s">effort (data, integration, cost)</text><text transform="translate(14 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle" class="am-s">value for this factory</text>`;
  g += `<text x="${sx(0.6)}" y="${sy(5.35)}" class="am-s am-b">quick wins</text><text x="${sx(3.4)}" y="${sy(5.35)}" text-anchor="end" class="am-s am-b">big projects</text>`;
  const seen = {};
  g += USES.map((u) => { const key = u.eff + "," + u.val, n = (seen[key] = (seen[key] || 0) + 1) - 1, ang = n * 2.4, off = n ? 9 + n * 2 : 0;
    const x = sx(u.eff) + Math.cos(ang) * off, y = sy(u.val) + Math.sin(ang) * off, on = u.k === sel;
    return `<g data-u="${u.k}" data-tip="${esc(u.name)} · value ${u.val} · effort ${u.eff} · maturity ${u.mat}" class="ai-pt"><circle cx="${x}" cy="${y}" r="10" class="am-hit"/><circle cx="${x}" cy="${y}" r="${on ? 7.5 : 5.5}" class="am-scd ${u.mat >= 4 ? "" : "am-hol"} ${on ? "am-on2" : ""}"/></g>`; }).join("");
  $("aiSc").innerHTML = `<div class="am-chart"><svg viewBox="0 0 ${W} ${H}" class="am-svgc">${g}</svg><div class="am-tip" hidden></div></div>`;
  tips($("aiSc"));
}
function tips(host) {
  const box = host.querySelector(".am-chart"), tip = box.querySelector(".am-tip");
  box.addEventListener("mousemove", (e) => { const t = e.target.closest("[data-tip]"); if (!t) { tip.hidden = true; return; } const r = box.getBoundingClientRect(); tip.textContent = t.dataset.tip; tip.hidden = false; tip.style.left = Math.min(r.width - 220, e.clientX - r.left + 12) + "px"; tip.style.top = (e.clientY - r.top + 12) + "px"; });
  box.addEventListener("mouseleave", () => { tip.hidden = true; });
}
function table() {
  $("aiT").innerHTML = `<thead><tr><th>Use case</th><th>Area</th><th>Role</th><th>Typical benefit</th><th>Maturity</th><th>Effort</th><th>Value</th></tr></thead><tbody>${USES.filter((u) => !fArea || u.area === fArea).map((u) =>
    `<tr data-u="${u.k}" class="am-click ${u.k === sel ? "am-best" : ""}"><td><b>${esc(u.name)}</b></td><td>${esc(u.area)}</td><td>${esc(ROLES.find((r) => r[0] === u.role)[1])}</td><td>${esc(u.benefit)}</td><td class="mt-dots">${dots(u.mat)}</td><td>${["low", "medium", "high"][u.eff - 1]}</td><td class="mt-dots">${dots(u.val)}</td></tr>`).join("")}</tbody>`;
}
function det() {
  const u = USES.find((x) => x.k === sel) || USES[0], kind = KINDS.find((k) => k[0] === u.kind);
  $("aiD").innerHTML = `<h3 class="am-h">${esc(u.name)}</h3><div class="sub">${esc(u.area)} · role: ${esc(ROLES.find((r) => r[0] === u.role)[1])} · AI kind: ${esc(kind ? kind[1] : "")} · maturity ${dots(u.mat)} · value ${dots(u.val)} · effort ${["low", "medium", "high"][u.eff - 1]}</div>
    <table class="am-kv"><tbody><tr><td>What it does</td><td>${esc(u.what)}</td></tr><tr><td>Data needed</td><td>${esc(u.data)}</td></tr><tr><td>Method</td><td>${esc(u.method)}</td></tr>
    <tr><td>Typical benefit</td><td><b>${esc(u.benefit)}</b></td></tr><tr><td>Pitfalls</td><td>${esc(u.pit)}</td></tr><tr><td>Examples in industry</td><td>${esc(u.ex)}</td></tr></tbody></table>
    <div class="ai-btns"><button class="btn" data-open="${u.tab}">Open the ${esc(TABNAME(u.tab))} tab →</button>${["pdm", "vision", "cutopt", "fc", "gen"].includes(u.k) ? `<button class="btn primary" id="aiToLab">Try it in the AI lab →</button>` : ""}</div>`;
  const b = $("aiToLab"); if (b) b.addEventListener("click", () => { const lab = { pdm: "pdm", vision: "vision", cutopt: "opt", fc: "fc", gen: "rag" }[u.k]; const url = new URL(location.href); url.searchParams.set("ailab", lab); history.replaceState(null, "", url); showItem("3"); const go = () => { const btn = document.querySelector(`#aiItem3 [data-lab="${lab}"]`); if (btn) btn.click(); else setTimeout(go, 100); }; go(); window.scrollTo({ top: 0, behavior: "smooth" }); });
}

/* ------------------------------------------------------------------ item 4: how to start */
function item4() {
  $("aiItem4").innerHTML = `
  <div class="card"><div class="card-head"><h2>Roadmap – from problem to AI in production</h2><span class="sub">typical durations for one use case (example)</span></div>
    <div class="ai-road">${ROAD.map(([h, t, d]) => `<div class="ai-step"><h4>${esc(h)}</h4><p>${esc(t)}</p><span class="sub">${esc(d)}</span></div>`).join("")}</div></div>
  <div class="grid2 eq" style="margin-top:0">
    <div class="card"><div class="card-head"><h2>Data architecture for an OFFLINE factory</h2><span class="sub">everything on-premise – no internet needed</span></div>${archSvg()}
      <table class="am-kv"><tbody>${ARCH.map(([a, b, c]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)} <span class="sub">(${esc(c)})</span></td></tr>`).join("")}</tbody></table></div>
    <div class="card"><div class="card-head"><h2>Team, cost, success measures</h2></div>
      <table class="am-kv"><tbody>${ROLESP.map(([a, b]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td></tr>`).join("")}</tbody></table>
      <h4 class="ai-h4">Typical cost of a first pilot (example)</h4>
      <table class="am-kv"><tbody><tr><td>Sensors + edge PC for one machine</td><td>≈ $3 000 – 15 000</td></tr><tr><td>On-premise GPU server (vision, local LLM)</td><td>≈ $10 000 – 40 000</td></tr><tr><td>Partner / software for the pilot</td><td>≈ $20 000 – 80 000</td></tr><tr><td>Own people time</td><td>often the largest part – plan it</td></tr></tbody></table>
      <h4 class="ai-h4">Measure success with numbers</h4>
      <ul class="am-ul"><li>before / after on the same KPI (downtime h, scrap %, forecast error, tool cost per part)</li><li>false alarms per week (people stop trusting a system with too many)</li><li>missed events (failures the model did not see)</li><li>payback in months</li></ul></div></div>
  <div class="grid2 eq" style="margin-top:0">
    <div class="card"><div class="card-head"><h2>Risks and how to handle them</h2></div><table class="am-tab"><thead><tr><th>Risk</th><th>What to do</th></tr></thead><tbody>${RISKS.map(([a, b]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td></tr>`).join("")}</tbody></table></div>
    <div class="card"><div class="card-head"><h2>Law and rules (EU, orientation)</h2><span class="sub">check current texts – see Standards tab</span></div><table class="am-kv"><tbody>${LAW.map(([a, b]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td></tr>`).join("")}</tbody></table></div></div>
  <div class="card"><div class="card-head"><h2>Recommended first 3 AI projects for this compressor factory</h2></div>
    <ol class="am-rules"><li><b>Tool wear / breakage monitoring on the HMCs</b> – data is in the CNC already, products exist, fast payback.</li>
      <li><b>Spindle condition monitoring (anomaly detection)</b> – start collecting vibration now; predictive models come with the first recorded failures.</li>
      <li><b>Offline engineering assistant</b> over your guides + standards library – retrieval works today (lab 'rag'); add a local LLM server when ready.</li></ol>
    <p class="am-note">Next steps after that: visual inspection of castings / seal faces, quality prediction of cylinder bores, demand forecasting for MRP, FMS scheduling tested in the twin.</p></div>`;
}
function archSvg() {
  const lay = ["Apps: SCADA · MES · maintenance · assistant", "AI server (on-premise GPU): training · local LLM · model registry", "Historian + MES: time series + part data by serial", "Edge PCs at the machines: features · real-time models", "Machines + sensors: CNC · PLC · robots · cameras · vibration"];
  return `<svg viewBox="0 0 520 250" class="am-svgc">${lay.map((t, i) => { const y = 10 + i * 46; return `<rect x="30" y="${y}" width="460" height="36" rx="6" fill="var(--surface-2)" stroke="var(--border)"/><text x="260" y="${y + 23}" text-anchor="middle" class="am-s am-b">${esc(t)}</text>${i < 4 ? `<line x1="260" y1="${y + 46}" x2="260" y2="${y + 36}" stroke="var(--accent)" stroke-width="2"/><polygon points="255,${y + 41} 265,${y + 41} 260,${y + 36}" fill="var(--accent)"/>` : ""}`; }).join("")}
    <text x="505" y="130" class="am-s" transform="rotate(90 505 130)" text-anchor="middle">data flows up · decisions flow down</text></svg>`;
}

/* ------------------------------------------------------------------ boot */
const qi = Q.get("aiitem");
if (qi && ["2", "3", "4"].includes(qi)) showItem(qi); else if (Q.get("ailab")) showItem("3");
else if (location.hash === "#ai" || ($("tab-ai") && $("tab-ai").classList.contains("active"))) build("1");
window.aiCtl = { showItem };
