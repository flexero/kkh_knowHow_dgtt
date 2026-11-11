/* Communication tab: ISA-95 layers + protocols, end-to-end workflow (swimlane), live message log.
   Data: GET /api/comm. Uses helpers from app.js / ops.js: $, esc, fmtTime, num, snap, active. */
"use strict";

const CM_SHORT = { EXT: "Customer / supplier", L4: "ERP", L3: "MES", L2: "SCADA / twin", L1: "PLC / CNC / AGV", L0: "Sensors" };
const CM_ORDER = ["EXT", "L4", "L3", "L2", "L1", "L0"];
let cmData = null, cmPrevLinks = {}, cmPrevSteps = {}, cmSel = { step: 1, msg: null }, cmPaused = false, cmBuilt = false;

const cmAgo = (t) => {
  if (t == null || !cmData) return "never";
  const h = (cmData.sim_time - t) / 3600;
  return h < 0.02 ? "just now" : h < 1 ? `${Math.round(h * 60)} min ago` : `${h.toFixed(1)} h ago`;
};
const cmTag = (id) => `<span class="cm-tag cm-${id}">${id === "EXT" ? "Ext" : id}</span>`;

function cmBuild(d) {
  // static parts are built once; live numbers are updated in place
  $("cmStack").innerHTML = d.layers.map((l, i) => {
    const link = d.links[i];
    const layer = `
      <div class="cm-layer cm-${l.id}">
        <div class="cm-lvl">${esc(l.level)}</div>
        <div class="cm-main"><b>${esc(l.name)}</b><span>${esc(l.systems)}</span></div>
        <div class="cm-time"><span class="muted small">time scale</span><b>${esc(l.time)}</b></div>
        <div class="cm-twin"><span class="muted small">in this twin</span>${esc(l.twin)}</div>
      </div>`;
    if (!link) return layer;
    return layer + `
      <div class="cm-link" id="cmL-${link.id}">
        <div class="cm-track"><i class="cm-wire"></i></div>
        <div class="cm-proto">${link.protocols.map((p, k) => `<span class="cm-chip${k ? "" : " main"}">${esc(p)}</span>`).join("")}
          <span class="cm-net">${esc(link.net)}</span></div>
        <div class="cm-rate"><span title="messages going down (orders, commands)">↓ <b data-k="down">0</b></span>
          <span title="messages going up (results, data, alarms)">↑ <b data-k="up">0</b></span>
          <span class="muted small" data-k="per_h"></span></div>
      </div>`;
  }).join("");

  const lanes = CM_ORDER.map((id) => `<div class="cm-lane-h">${cmTag(id)}<span>${CM_SHORT[id]}</span></div>`).join("");
  $("cmFlow").innerHTML = `<div class="cm-grid">
    <div class="cm-row cm-head"><div class="cm-step-h">Step</div>${lanes}<div class="cm-cnt-h">Messages</div></div>
    ${d.steps.map((s) => {
      const a = CM_ORDER.indexOf(s.src), b = CM_ORDER.indexOf(s.dst);
      const lo = Math.min(a, b), span = Math.abs(a - b) + 1;
      const lanesBg = CM_ORDER.map((_, k) => `<div class="cm-lane" style="grid-column:${k + 2}"></div>`).join("");
      const mark = a === b
        ? `<div class="cm-self" style="grid-column:${a + 2}" title="${esc(s.proto)}">⟳ ${esc(s.proto)}</div>`
        : `<div class="cm-arrow ${b > a ? "down" : "up"}" style="grid-column:${lo + 2} / span ${span};--s:${span}">
             <i></i><span>${esc(s.proto)}</span></div>`;
      return `<div class="cm-row" data-step="${s.n}" tabindex="0" role="button" aria-label="Step ${s.n}: ${esc(s.msg)}">
        <div class="cm-step"><b>${s.n}</b><span>${esc(s.msg)}</span></div>${lanesBg}${mark}
        <div class="cm-cnt"><b data-c>0</b><span class="muted small" data-a></span></div></div>`;
    }).join("")}</div>`;

  $("cmFilter").innerHTML = `<option value="">all steps</option>` +
    d.steps.filter((s) => s.n !== 10).map((s) => `<option value="${s.n}">${s.n}. ${esc(s.msg)}</option>`).join("");
  cmBuilt = true;
}

function cmDots(el, n, dir) {
  const tr = el.querySelector(".cm-track");
  for (let k = 0; k < Math.min(3, n); k++) {
    const dot = document.createElement("b");
    dot.className = "cm-dot " + dir;
    dot.style.animationDelay = k * 0.25 + "s";
    tr.appendChild(dot);
    setTimeout(() => dot.remove(), 1600 + k * 250);
  }
}

function renderComm(d) {
  cmData = d;
  if (!cmBuilt) cmBuild(d);
  const total = d.steps.reduce((a, s) => a + (s.n === 10 ? 0 : s.count), 0);
  $("cmSub").textContent = `${fmtTime(d.sim_time)} · ${num(total)} workflow messages · ${num(d.steps.find((s) => s.n === 10).count)} sensor values`;

  for (const l of d.links) {
    const el = $("cmL-" + l.id);
    if (!el) continue;
    el.querySelector('[data-k="down"]').textContent = num(l.down);
    el.querySelector('[data-k="up"]').textContent = num(l.up);
    el.querySelector('[data-k="per_h"]').textContent = `${num(l.per_h)} / h`;
    const p = cmPrevLinks[l.id];
    if (p && !document.hidden) {
      if (l.down > p.down) cmDots(el, l.down - p.down, "down");
      if (l.up > p.up) cmDots(el, l.up - p.up, "up");
    }
    cmPrevLinks[l.id] = { down: l.down, up: l.up };
  }

  for (const s of d.steps) {
    const row = document.querySelector(`.cm-row[data-step="${s.n}"]`);
    if (!row) continue;
    row.querySelector("[data-c]").textContent = num(s.count);
    row.querySelector("[data-a]").textContent = s.count ? cmAgo(s.last_t) : "not yet";
    row.classList.toggle("sel", cmSel.msg == null && cmSel.step === s.n);
    row.classList.toggle("none", !s.count);
    if (cmPrevSteps[s.n] != null && s.count > cmPrevSteps[s.n]) {
      row.classList.remove("hot"); void row.offsetWidth; row.classList.add("hot");
    }
    cmPrevSteps[s.n] = s.count;
  }
  cmDetail();
  if (!cmPaused) cmLog();
}

function cmDetail() {
  const d = cmData;
  if (!d) return;
  const s = d.steps.find((x) => x.n === (cmSel.msg ? cmSel.msg.step : cmSel.step));
  const m = cmSel.msg || s.last;
  $("cmDetail").innerHTML = `
    <div class="cm-d-head"><span class="cm-num">${s.n}</span><b>${esc(s.msg)}</b>
      ${cmTag(s.src)} → ${cmTag(s.dst)} <span class="cm-chip main">${esc(s.proto)}</span></div>
    <div class="cm-d-grid">
      <div>
        <h4>What happens</h4><p>${esc(s.what)}</p>
        <h4>In this twin</h4><p><code>${esc(s.twin)}</code></p>
        <h4>Live count</h4><p>${num(s.count)} messages · ${num(s.per_h, 1)} per hour · last ${s.count ? cmAgo(s.last_t) : "never"}</p>
      </div>
      <div>
        <h4>${cmSel.msg ? "Selected message" : "Latest real message"}${m ? ` · ${fmtTime(m.t)}` : ""}</h4>
        ${m ? `<p class="cm-d-text">${cmTag(m.src)} → ${cmTag(m.dst)} ${esc(m.text)}</p>
               <pre class="cm-json">${esc(JSON.stringify(m.payload, null, 2))}</pre>`
            : `<p class="muted">No message yet. ${s.n === 4 ? "Suppliers need 12–20 h: run the factory faster or use <i>Deliver now</i> in the Order flow tab." :
               s.n === 14 ? "Orders ship when all their units are in the finished-goods store." : "Let the factory run a little."}</p>`}
      </div>
    </div>`;
}

function cmLog() {
  const f = $("cmFilter").value;
  const rows = cmData.log.filter((m) => !f || String(m.step) === f).slice(0, 60);
  $("cmLog").innerHTML = `<tr><th>Time</th><th class="num">Step</th><th>From → to</th><th>Protocol</th><th>Message</th></tr>` +
    (rows.length ? rows.map((m) => `<tr class="cm-logrow${cmSel.msg && cmSel.msg.id === m.id ? " sel" : ""}" data-id="${m.id}">
      <td class="nowrap">${fmtTime(m.t)}</td><td class="num">${m.step}</td>
      <td class="nowrap">${cmTag(m.src)} → ${cmTag(m.dst)}</td><td class="small">${esc(m.proto)}</td><td>${esc(m.text)}</td></tr>`).join("")
      : `<tr><td colspan="5" class="muted">No messages yet</td></tr>`);
}

$("cmFlow").addEventListener("click", (e) => {
  const r = e.target.closest(".cm-row[data-step]");
  if (!r) return;
  cmSel = { step: +r.dataset.step, msg: null };
  renderComm(cmData);
});
$("cmFlow").addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches(".cm-row[data-step]")) { e.preventDefault(); e.target.click(); }
});
$("cmLog").addEventListener("click", (e) => {
  const r = e.target.closest(".cm-logrow");
  if (!r || !cmData) return;
  const m = cmData.log.find((x) => x.id === +r.dataset.id);
  if (!m) return;
  cmSel = { step: m.step, msg: m };
  renderComm(cmData);
  $("cmDetail").scrollIntoView({ behavior: "smooth", block: "nearest" });
});
$("cmFilter").addEventListener("change", () => cmData && cmLog());
$("cmPause").addEventListener("click", (e) => {
  cmPaused = !cmPaused;
  e.target.textContent = cmPaused ? "Resume log" : "Pause log";
  if (!cmPaused && cmData) cmLog();
});

async function cmRefresh() {
  try {
    const r = await fetch("/api/comm");
    if (r.ok) renderComm(await r.json());
  } catch (e) { /* server restarting */ }
}
setInterval(() => { if (active === "comm" && !$("cmLive").hidden) cmRefresh(); }, 1000);
window.cmRefreshNow = cmRefresh;
const _cmPrevShown = window.onTabShown;
window.onTabShown = (name) => {
  if (_cmPrevShown) _cmPrevShown(name);
  if (name === "comm") { cmPrevLinks = {}; cmPrevSteps = {}; cmRefresh(); }
};
