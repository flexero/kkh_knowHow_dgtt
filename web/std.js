/* Standards tab (#std) – offline library of every standard / law cited in the project, with plain-language summaries.
 * Data: std_data.js (GENERATED from docs/16 by tools/build_standards.py) + std_extra.js (hand-written: newer guides + explainers).
 * Deep links: /?std=ISO%2012100#std · /?stdq=hydraulic#std · /?stdg=AM#std
 * Summaries are our own short texts for orientation – NOT the official text. */
import { GROUPS, ROWS, BUY } from "./std_data.js";
import { EXTRA, EXPLAIN, INTRO, GROUPS_EXTRA } from "./std_extra.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const Q = new URLSearchParams(location.search);
const G = Object.assign({}, GROUPS, GROUPS_EXTRA);

// one list: generated rows + extra rows (extra ids that already exist only add nothing)
const LIB = ROWS.map((r) => Object.assign({ src: "16" }, r));
const have = new Set(LIB.map((r) => r.k));
EXTRA.forEach(([id, g, title, req, bind, used]) => { if (!have.has(id)) LIB.push({ id, k: id, g, gn: G[g], title, req, bind, used, status: "added from guides 30–49", src: "extra" }); });
const kind = (b) => (/^L/.test(b) ? "law" : /\bH\b|^H/.test(b) ? "harm" : "vol");
const KIND = { law: "Law (binding)", harm: "Harmonised standard", vol: "Voluntary / contract" };

let q = (Q.get("stdq") || "").toLowerCase(), fg = Q.get("stdg") || "", fk = "", onlyEx = false, sel = Q.get("std") || "ISO 12100", shown = 60, built = false;

function build() {
  const host = $("stdHost"); if (!host || built) return; built = true;
  const nEx = Object.keys(EXPLAIN).filter((k) => LIB.some((r) => r.k === k)).length;
  host.innerHTML = `
  <div class="kpis">
    <div class="kpi"><div class="label">Documents in the library</div><div class="value">${LIB.length}</div><div class="note">standards, guidelines and laws cited in the guides + tabs</div></div>
    <div class="kpi"><div class="label">Laws</div><div class="value">${LIB.filter((r) => kind(r.bind) === "law").length}</div><div class="note">binding (EU / national)</div></div>
    <div class="kpi"><div class="label">Harmonised standards</div><div class="value">${LIB.filter((r) => kind(r.bind) === "harm").length}</div><div class="note">presumption of conformity in the EU</div></div>
    <div class="kpi"><div class="label">Detailed explainers</div><div class="value">${nEx}</div><div class="note">longer plain-language summaries of the key standards</div></div>
  </div>
  <div class="card"><div class="card-head"><h2>Standards in 1 minute</h2><span class="sub">read this first if standards are new for you</span></div>
    <div class="std-intro">${INTRO.map(([h, t]) => `<div class="std-ib"><h4>${esc(h)}</h4><p>${esc(t)}</p></div>`).join("")}</div></div>
  <div class="std-grid">
    <div class="card"><div class="card-head"><h2>Library</h2><span class="sub" id="stdCount"></span></div>
      <div class="am-filt">
        <input type="search" id="stdQ" placeholder="search number, title or topic (e.g. 13849, hydraulic, weld, light curtain)" value="${esc(q)}" style="flex:1 1 280px">
        <select id="stdG"><option value="">all groups</option>${Object.entries(G).map(([k, n]) => `<option value="${k}" ${k === fg ? "selected" : ""}>${k} – ${esc(n)}</option>`).join("")}</select>
        <select id="stdK"><option value="">all types</option><option value="law">laws</option><option value="harm">harmonised</option><option value="vol">voluntary</option></select>
        <label class="am-chk"><input type="checkbox" id="stdEx"> only with explainer</label></div>
      <div class="am-wrap std-list"><table class="am-tab" id="stdT"></table></div>
      <div id="stdMore"></div></div>
    <div class="card std-detail"><div id="stdD"></div></div>
  </div>
  <div class="card"><div class="card-head"><h2>Buy first – the first 25 standards for this factory</h2><span class="sub">from guide 16 §21 · price class A &lt; €100, B €100–250, C €250–500, D &gt; €500 (estimates – ask for a quote)</span></div>
    <div class="am-wrap"><table class="am-tab"><thead><tr><th>Pos.</th><th>Document</th><th>Edition (check)</th><th>Why</th><th>Priority</th><th>Price</th></tr></thead><tbody>${BUY.map((b) => `<tr><td>${esc(b.pos)}</td><td><b>${esc(b.doc)}</b></td><td>${esc(b.ed)}</td><td>${esc(b.why)}</td><td>${esc(b.prio)}</td><td>${esc(b.price)}</td></tr>`).join("")}</tbody></table></div>
    <p class="am-note">Full register with editions, laws, CE / PED steps and how to keep it current: guide <b>16_standards_register.md</b> (in the docs folder). This library is regenerated from it with <code>python tools/build_standards.py</code>.</p></div>`;
  $("stdQ").addEventListener("input", (e) => { q = e.target.value.toLowerCase(); shown = 60; list(); });
  $("stdG").addEventListener("change", (e) => { fg = e.target.value; shown = 60; list(); });
  $("stdK").addEventListener("change", (e) => { fk = e.target.value; shown = 60; list(); });
  $("stdEx").addEventListener("change", (e) => { onlyEx = e.target.checked; shown = 60; list(); });
  $("stdT").addEventListener("click", (e) => { const r = e.target.closest("[data-k]"); if (r) { sel = r.dataset.k; list(); detail(); if (window.innerWidth < 1000) $("stdD").scrollIntoView({ behavior: "smooth" }); } });
  $("stdMore").addEventListener("click", (e) => { if (e.target.id === "stdMoreB") { shown += 100; list(); } });
  $("stdD").addEventListener("click", (e) => { const a = e.target.closest("[data-go]"); if (a) { sel = a.dataset.go; list(); detail(); } });
  list(); detail();
}

function match(r) {
  if (fg && r.g !== fg) return false;
  if (fk && kind(r.bind) !== fk) return false;
  if (onlyEx && !EXPLAIN[r.k]) return false;
  if (!q) return true;
  const ex = EXPLAIN[r.k];
  return [r.id, r.title, r.req, r.gn, r.official, r.covers, r.project, ex && ex.what].join(" ").toLowerCase().includes(q);
}
function list() {
  const rows = LIB.filter(match);
  $("stdCount").textContent = `${rows.length} of ${LIB.length}`;
  $("stdT").innerHTML = `<thead><tr><th>Number</th><th>What it is (simple)</th><th>Group</th><th>Type</th></tr></thead><tbody>${rows.slice(0, shown).map((r) =>
    `<tr data-k="${esc(r.k)}" data-id="${esc(r.id)}" class="am-click ${r.k === sel ? "am-best" : ""}"><td><b>${esc(r.id)}</b>${EXPLAIN[r.k] ? ' <span class="std-ex" title="detailed explainer">★</span>' : ""}</td><td>${esc(r.title)}</td><td>${esc(r.g)}</td><td><span class="std-b std-${kind(r.bind)}">${kind(r.bind) === "law" ? "law" : kind(r.bind) === "harm" ? "harm." : "vol."}</span></td></tr>`).join("") || `<tr><td colspan="4" class="sub">nothing found – try a shorter word</td></tr>`}</tbody>`;
  $("stdMore").innerHTML = rows.length > shown ? `<button class="btn" id="stdMoreB">Show more (${rows.length - shown} left)</button>` : "";
}
function detail() {
  const rs = LIB.filter((r) => r.k === sel), r = rs[0];
  if (!r) { $("stdD").innerHTML = `<p class="sub">Click a row to see its summary.</p>`; return; }
  const ex = EXPLAIN[r.k];
  const rowKV = (x) => `<table class="am-kv"><tbody>
    <tr><td>Simple title</td><td><b>${esc(x.title)}</b></td></tr>
    ${x.official ? `<tr><td>Official title (short)</td><td>${esc(x.official)}</td></tr>` : ""}
    <tr><td>What it requires / key content</td><td>${esc(x.req)}</td></tr>
    ${x.covers ? `<tr><td>Covers</td><td>${esc(x.covers)}</td></tr>` : ""}
    ${x.project ? `<tr><td>For this project</td><td>${esc(x.project)}</td></tr>` : ""}
    <tr><td>Group</td><td>${esc(x.g)} – ${esc(x.gn || G[x.g] || "")}</td></tr>
    <tr><td>Type / binding</td><td><span class="std-b std-${kind(x.bind)}">${KIND[kind(x.bind)]}</span> <span class="sub">(${esc(x.bind)})</span></td></tr>
    ${x.ed ? `<tr><td>Edition</td><td>${esc(x.ed)} <span class="sub">– confirm before use</span></td></tr>` : ""}
    <tr><td>Status</td><td>${esc(x.status)}</td></tr>
    <tr><td>Used in guides / tabs</td><td>${esc(x.used || "–")}</td></tr>
    ${x.get ? `<tr><td>Where to get it</td><td>${esc(x.get)}</td></tr>` : ""}</tbody></table>`;
  $("stdD").innerHTML = `<h3 class="am-h std-h">${esc(r.id)}${rs.length > 1 ? ` <span class="sub">(+ ${rs.length - 1} more part${rs.length > 2 ? "s" : ""})</span>` : ""}</h3>
    ${ex ? `<div class="std-exp"><p><b>What it is:</b> ${esc(ex.what)}</p><p><b>Why it matters for you:</b> ${esc(ex.why)}</p>
      <h4>Main content</h4><ul class="am-ul">${ex.content.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
      <h4>Key numbers (examples)</h4><ul class="am-ul">${ex.numbers.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
      <h4>How to apply it here</h4><ul class="am-ul">${ex.apply.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
      <p class="sub">Related: ${ex.rel.split(", ").map((x) => { const t = LIB.find((y) => y.k === x || y.id === x); return t ? `<a href="#" data-go="${esc(t.k)}">${esc(x)}</a>` : esc(x); }).join(", ")}</p></div>` : ""}
    ${rs.map((x, i) => (rs.length > 1 ? `<h4 class="std-part">${esc(x.id)}</h4>` : "") + rowKV(x)).join("")}
    <p class="am-note">Summary in our own words for orientation – not the official text. Use the current official edition for design, contracts and certification.</p>`;
}

window.addEventListener("load", () => { if (location.hash === "#std") build(); });
const prevTab = window.onTabShown;
window.onTabShown = (name) => { if (prevTab) prevTab(name); if (name === "std") build(); };
if ($("tab-std") && $("tab-std").classList.contains("active")) build();
window.stdLib = { LIB, EXPLAIN, open: (k) => { sel = k; if (built) { list(); detail(); } } };
