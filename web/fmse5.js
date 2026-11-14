/* FMS engineering – item 5: control architecture.  Loaded by fmse.js (build "5").
 * 5A ISA-95 levels + decision matrix (with quiz) · 5B equipment hierarchy + tag naming · 5C live PackML state machine
 * 5D one pallet through all levels (animated sequence) · 5E architecture variants.   Guide: docs/FMS system design/65_control_architecture.md */
import { LEVELS, DECIDE, HIER, STATES, CMDS, POS, EDGES, MEANING, MODES, LANES, LANE_LVL, FLOWSTEPS, VARIANTS } from "./fmse5_data.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const lvlBadge = (l) => `<span class="fe-lv fe-lv${l}">L${l}</span>`;

export function mount(el) {
  el.innerHTML = `
  <div class="card"><div class="card-head"><h2>5A · ISA-95 levels – who does what, how fast, with which data</h2>
      <span class="sub">IEC 62264 · click a level</span></div>
    <div class="grid2 eq"><div><svg id="fe5Pyr" class="fe-chart" viewBox="0 0 560 330" role="img" aria-label="ISA-95 pyramid"></svg></div><div id="fe5Lv"></div></div>
    <h3 class="fe-h3">Who decides? <span class="sub">rule: decide at the lowest level that has the information and the time – safety always at level 1, hard-wired</span></h3>
    <div class="fe-row"><button class="mx-el" id="fe5Quiz">Quiz: hide the answers</button><button class="mx-el" id="fe5Check" hidden>Check my answers</button><span id="fe5QRes" class="sub"></span></div>
    <div class="fe-scroll"><table class="am-tab" id="fe5Dec"></table></div>
  </div>

  <div class="card"><div class="card-head"><h2>5B · Equipment hierarchy and tag names</h2>
      <span class="sub">ISA-95 / ISA-88 role-based model · the same tree is used in PLC, SCADA, MES and the documents</span></div>
    <div class="grid2 eq"><div id="fe5Tree" class="fe-tree"></div>
      <div><h3 class="fe-h3">Tag name builder</h3>
        <table class="am-kv fe-calc"><tbody>${[["site", "Site", "PLT1"], ["area", "Area", "MACH"], ["cell", "Cell / line", "FMS1"], ["unit", "Unit (module)", "HMC02"], ["eq", "Equipment module", "APC"], ["sig", "Signal", "ClampOK"]].map(([k, n, d]) => `<tr><td>${n}</td><td><input type="text" id="fe5T_${k}" value="${d}" style="width:140px"></td></tr>`).join("")}</tbody></table>
        <p class="fe-big"><code id="fe5Tag"></code></p>
        <ul class="am-ul sub"><li>Same name everywhere: PLC variable, SCADA tag, MES equipment ID, circuit diagram (item 8), FAT list.</li>
          <li>Only A–Z, 0–9 and one separator; fixed length codes (HMC02 not HMC2) so lists sort correctly.</li>
          <li>Unit codes = module codes of the module standard (M01…M22) + number; signals in English, positive logic (ClampOK, not NotClamped).</li></ul></div></div>
  </div>

  <div class="card"><div class="card-head"><h2>5C · PackML – the same state machine for every module</h2>
      <span class="sub">ISA-TR88.00.02 · send commands, acting states (…ing) finish automatically (SC = state complete) · state numbers are the standard ones</span></div>
    <div class="fe-row"><span class="sub">Mode</span><div class="mx-nav fe-inline" id="fe5Mode">${Object.keys(MODES).map((m) => `<button class="mx-el" data-mode="${m}">${m}</button>`).join("")}</div>
      <label><input type="checkbox" id="fe5Auto" checked> job ends by itself (Execute → Completing after 4 s)</label></div>
    <div class="fe-row" id="fe5Cmds">${Object.keys(CMDS).map((c) => `<button class="mx-el" data-cmd="${c}">${c} <span class="sub">(${CMDS[c]})</span></button>`).join("")}</div>
    <div class="grid2"><div class="fe-scroll"><svg id="fe5Pk" class="fe-chart" viewBox="0 0 830 490" role="img" aria-label="PackML state model"></svg></div>
      <div><div id="fe5PkInfo"></div><h4>PackTags (what the module offers on the network)</h4><table class="am-kv" id="fe5Tags"></table><h4>Log</h4><div id="fe5Log" class="fe-log"></div></div></div>
  </div>

  <div class="card"><div class="card-head"><h2>5D · One pallet through all levels – the messages</h2>
      <span class="sub">example: production order → 4 crankcases machined, measured, confirmed · step by step</span></div>
    <div class="fe-row"><button class="mx-el" id="fe5Back">◀ Back</button><button class="mx-el" id="fe5Next">Next ▶</button><button class="mx-el" id="fe5Play">▶ Play</button><button class="mx-el" id="fe5Rst">Reset</button><span id="fe5StepN" class="sub"></span></div>
    <div id="fe5StepD"></div>
    <div class="fe-scroll"><svg id="fe5Seq" class="fe-chart" role="img" aria-label="Sequence diagram of one pallet"></svg></div>
  </div>

  <div class="card"><div class="card-head"><h2>5E · Architecture variants – where does the cell logic live?</h2><span class="sub">choose per project; the module standard works with all of them</span></div>
    <div class="fe-scroll"><table class="am-tab"><thead><tr><th>Variant</th><th>How</th><th>+ Strengths</th><th>− Weaknesses</th><th>Use when</th></tr></thead>
      <tbody>${VARIANTS.map((r) => `<tr>${r.map((c, i) => `<td>${i ? esc(c) : "<b>" + esc(c) + "</b>"}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="am-note"><b>Whatever the variant:</b> (1) every module offers the same PackML states + commands and a standard data block; (2) hand-overs use a handshake with time-outs;
      (3) safety is never in the cell controller; (4) the cell keeps running for a while if MES / ERP are down (local job buffer); (5) there is a manual fallback mode for each module.</p>
  </div>`;

  initLevels(); initTree(); initPack(); initSeq();
}

/* ================================================================== 5A */
let lvSel = 2, quiz = false;
function initLevels() {
  $("fe5Pyr").addEventListener("click", (e) => { const g = e.target.closest("[data-lv]"); if (g) { lvSel = +g.dataset.lv; drawLevels(); } });
  $("fe5Quiz").addEventListener("click", () => { quiz = !quiz; $("fe5Quiz").textContent = quiz ? "Show the answers" : "Quiz: hide the answers"; $("fe5Check").hidden = !quiz; $("fe5QRes").textContent = ""; drawDec(); });
  $("fe5Check").addEventListener("click", () => {
    let ok = 0; document.querySelectorAll("#fe5Dec select").forEach((s) => { const r = DECIDE[+s.dataset.r], good = +s.value === r[1]; s.closest("tr").classList.toggle("fe-good", good); s.closest("tr").classList.toggle("fe-bad", !good); if (good) ok++; });
    $("fe5QRes").textContent = `${ok} / ${DECIDE.length} correct`;
  });
  drawLevels(); drawDec();
}
function drawLevels() {
  let s = "";
  LEVELS.forEach((L, i) => {
    const y = 10 + i * 62, w0 = 140 + i * 80, w1 = 140 + (i + 1) * 80, cx = 280;
    s += `<g data-lv="${L.l}" class="fe-pyr${L.l === lvSel ? " fe-msel" : ""}"><polygon class="fe-lv${L.l}f" points="${cx - w0 / 2},${y} ${cx + w0 / 2},${y} ${cx + w1 / 2},${y + 58} ${cx - w1 / 2},${y + 58}"/>
      <text class="fe-mn" x="${cx}" y="${y + 25}" text-anchor="middle"><tspan font-weight="700">L${L.l}</tspan> ${esc(L.sys.split(" (")[0])}</text><text class="fe-tick" x="${cx}" y="${y + 43}" text-anchor="middle">${esc(L.time)}</text></g>`;
  });
  $("fe5Pyr").innerHTML = s;
  const L = LEVELS.find((x) => x.l === lvSel);
  $("fe5Lv").innerHTML = `<h3 class="fe-h3">${lvlBadge(L.l)} ${esc(L.n)}</h3><table class="am-kv"><tbody>
    <tr><td>Systems</td><td><b>${esc(L.sys)}</b></td></tr><tr><td>Time frame</td><td>${esc(L.time)}</td></tr>
    <tr><td>Does</td><td><ul class="am-ul">${L.does.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></td></tr>
    <tr><td>Gives down</td><td>${esc(L.out)}</td></tr><tr><td>Gets from below</td><td>${esc(L.inp)}</td></tr>
    <tr><td>In an FMS</td><td>${esc(L.fms)}</td></tr></tbody></table>`;
}
function drawDec() {
  $("fe5Dec").innerHTML = `<thead><tr><th>Decision</th><th>Level</th><th>System</th><th>Why there</th></tr></thead><tbody>${DECIDE.map((r, i) => `<tr><td>${esc(r[0])}</td>
    <td>${quiz ? `<select data-r="${i}"><option value="-1">?</option>${[4, 3, 2, 1, 0].map((l) => `<option value="${l}">L${l}</option>`).join("")}</select>` : lvlBadge(r[1])}</td>
    <td>${quiz ? "…" : esc(r[2])}</td><td>${quiz ? "…" : esc(r[3])}</td></tr>`).join("")}</tbody>`;
}

/* ================================================================== 5B */
function initTree() {
  const node = (n) => `<li><span class="fe-tt">${esc(n.t)}</span> ${esc(n.n)}${n.c ? `<ul>${n.c.map(node).join("")}</ul>` : ""}</li>`;
  $("fe5Tree").innerHTML = `<ul>${node(HIER)}</ul>`;
  const upd = () => { const v = ["site", "area", "cell", "unit", "eq", "sig"].map((k) => $("fe5T_" + k).value.trim().replace(/[^A-Za-z0-9]/g, "")).filter(Boolean); $("fe5Tag").textContent = v.join("."); };
  ["site", "area", "cell", "unit", "eq", "sig"].forEach((k) => $("fe5T_" + k).addEventListener("input", upd)); upd();
}

/* ================================================================== 5C PackML */
const P = { st: "Stopped", mode: "Production", timer: null, log: [], cmd: 0 };
const ACT = ["Resetting", "Starting", "Completing", "Holding", "Unholding", "Suspending", "Unsuspending", "Stopping", "Aborting", "Clearing"];
const STOP_SCOPE = (s) => !["Stopped", "Stopping", "Aborting", "Aborted", "Clearing"].includes(s);
function nextState(st, cmd) {
  if (cmd === "Abort") return st !== "Aborting" && st !== "Aborted" ? "Aborting" : null;
  if (cmd === "Stop") return STOP_SCOPE(st) ? "Stopping" : null;
  const e = EDGES.find(([a, , c]) => a === st && c === cmd); return e ? e[1] : null;
}
function setState(s, why) {
  clearTimeout(P.timer); P.st = s;
  P.log.unshift(`${new Date().toLocaleTimeString()} · ${why} → ${s} (${STATES[s]})`); P.log = P.log.slice(0, 12);
  if (ACT.includes(s)) P.timer = setTimeout(() => { const e = EDGES.find(([a, , c]) => a === s && c === "SC"); if (e) setState(e[1], "SC"); }, 1200);
  else if (s === "Execute" && $("fe5Auto").checked) P.timer = setTimeout(() => { if (P.st === "Execute") setState("Completing", "SC (job done)"); }, 4000);
  drawPack();
}
function initPack() {
  $("fe5Cmds").addEventListener("click", (e) => { const b = e.target.closest("[data-cmd]"); if (!b || b.disabled) return; const n = nextState(P.st, b.dataset.cmd); P.cmd = CMDS[b.dataset.cmd]; if (n) setState(n, "Cmd " + b.dataset.cmd); });
  $("fe5Mode").addEventListener("click", (e) => { const b = e.target.closest("[data-mode]"); if (!b) return; if (!["Stopped", "Idle", "Aborted"].includes(P.st)) { P.log.unshift(`Mode change refused in ${P.st} – only in Stopped, Idle or Aborted`); drawPack(); return; } P.mode = b.dataset.mode; P.log.unshift(`Mode → ${P.mode}`); drawPack(); });
  $("fe5Pk").addEventListener("click", (e) => { const g = e.target.closest("[data-st]"); if (g) { $("fe5PkInfo").dataset.peek = g.dataset.st; drawPack(); } });
  drawPack();
}
function drawPack() {
  const X = (c) => 65 + c * 170, Y = (r) => 58 + r * 95, bw = 112, bh = 44;
  let s = `<defs><marker id="fe5Ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="fe-arh"/></marker></defs>`;
  s += `<rect class="fe-scope" x="${X(0) - 70}" y="${Y(0) - 32}" width="${X(4) - X(0) + 140}" height="${Y(3) - Y(0) + 64}" rx="10"/><text class="fe-tick" x="${X(0) - 58}" y="${Y(0) - 40}">Stop allowed from every state inside this box → Stopping · Abort allowed from every state → Aborting</text>`;
  EDGES.forEach(([a, b, c]) => {
    if (a === "Complete" && b === "Resetting") {        // route around the bottom so it does not cross other states
      const yb = (Y(3) + Y(4)) / 2, on = a === P.st;
      s += `<polyline class="fe-pe${on ? " fe-pe-on" : ""}" fill="none" points="${X(4)},${Y(1) + bh / 2} ${X(4)},${yb} ${X(0)},${yb} ${X(0)},${Y(3) + bh / 2 + 3}" marker-end="url(#fe5Ar)"/>
        <text class="fe-tick fe-pel" x="${X(4) + 6}" y="${(Y(2) + Y(3)) / 2}">Reset</text>`;
      return;
    }
    let [x1, y1] = [X(POS[a][0]), Y(POS[a][1])], [x2, y2] = [X(POS[b][0]), Y(POS[b][1])];
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const off = (u, v) => Math.min(Math.abs((bw / 2) / (u || 1e-9)), Math.abs((bh / 2) / (v || 1e-9)));
    const o = off(ux, uy);
    const p1 = [x1 + ux * o, y1 + uy * o], p2 = [x2 - ux * (o + 3), y2 - uy * (o + 3)];
    const on = a === P.st;
    s += `<line class="fe-pe${on ? " fe-pe-on" : ""}${c === "SC" ? " fe-pe-sc" : ""}" x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}" marker-end="url(#fe5Ar)"/>
      <text class="fe-tick fe-pel" x="${(p1[0] + p2[0]) / 2 + (Math.abs(uy) > 0.5 ? 6 : 0)}" y="${(p1[1] + p2[1]) / 2 - (Math.abs(uy) > 0.5 ? 0 : 5)}" text-anchor="${Math.abs(uy) > 0.5 ? "start" : "middle"}">${c}</text>`;
  });
  Object.keys(POS).forEach((k) => {
    const [c, r] = POS[k], x = X(c), y = Y(r), act = ACT.includes(k), cur = k === P.st;
    s += `<g data-st="${k}" class="fe-ps${act ? " fe-ps-act" : ""}${cur ? " fe-ps-cur" : ""}${k === "Execute" ? " fe-ps-ex" : ""}"><rect x="${x - bw / 2}" y="${y - bh / 2}" width="${bw}" height="${bh}" rx="${act ? 22 : 6}"/>
      <text class="fe-mn" x="${x}" y="${y + 1}" text-anchor="middle">${k}</text><text class="fe-tick" x="${x}" y="${y + 15}" text-anchor="middle">${STATES[k]}</text></g>`;
  });
  $("fe5Pk").innerHTML = s;
  const allowed = MODES[P.mode];
  document.querySelectorAll("#fe5Cmds [data-cmd]").forEach((b) => { const c = b.dataset.cmd; b.disabled = !allowed.includes(c) || !nextState(P.st, c); });
  document.querySelectorAll("#fe5Mode [data-mode]").forEach((b) => b.classList.toggle("active", b.dataset.mode === P.mode));
  const peek = $("fe5PkInfo").dataset.peek || P.st;
  $("fe5PkInfo").innerHTML = `<p class="fe-big">State: <b>${P.st}</b> (${STATES[P.st]}) <span class="sub">${ACT.includes(P.st) ? "acting – finishes by itself" : "waiting – needs a command"}</span></p>
    <p><b>${esc(peek)}:</b> ${esc(MEANING[peek])}</p>`;
  $("fe5Tags").innerHTML = `<tbody>${[["Command.CntrlCmd", `${P.cmd} <span class="sub">(1 Reset · 2 Start · 3 Stop · 4 Hold · 5 Unhold · 6 Suspend · 7 Unsuspend · 8 Abort · 9 Clear)</span>`], ["Command.CmdChangeRequest", "BOOL – rising edge executes CntrlCmd"], ["Command.UnitMode", `${P.mode} <span class="sub">(1 Production · 2 Maintenance · 3 Manual)</span>`], ["Status.StateCurrent", `<b>${STATES[P.st]}</b> = ${P.st}`], ["Status.UnitModeCurrent", P.mode], ["Admin.Alarm[ ] / Warning[ ]", "number, text, time – same numbering in every module"], ["Admin.ProdProcessedCount / ProdDefectiveCount", "counters for OEE (MES)"]].map(([a, b]) => `<tr><td><code>${a}</code></td><td>${b}</td></tr>`).join("")}</tbody>`;
  $("fe5Log").innerHTML = P.log.map((l) => `<div>${esc(l)}</div>`).join("") || '<div class="sub">Press Reset to start.</div>';
}

/* ================================================================== 5D sequence */
let step = 0, play = null;
function initSeq() {
  $("fe5Next").addEventListener("click", () => { step = Math.min(FLOWSTEPS.length, step + 1); drawSeq(); });
  $("fe5Back").addEventListener("click", () => { step = Math.max(0, step - 1); drawSeq(); });
  $("fe5Rst").addEventListener("click", () => { stopPlay(); step = 0; drawSeq(); });
  $("fe5Play").addEventListener("click", () => { if (play) { stopPlay(); return; } if (step >= FLOWSTEPS.length) step = 0; $("fe5Play").textContent = "❚❚ Pause"; play = setInterval(() => { if (!document.body.contains($("fe5Seq"))) return stopPlay(); step++; drawSeq(); if (step >= FLOWSTEPS.length) stopPlay(); }, 1800); });
  drawSeq();
}
function stopPlay() { clearInterval(play); play = null; const b = $("fe5Play"); if (b) b.textContent = "▶ Play"; }
function drawSeq() {
  const lw = 96, x0 = 20, top = 46, rh = 30, W = x0 * 2 + LANES.length * lw, H = top + FLOWSTEPS.length * rh + 16, LX = (i) => x0 + i * lw + lw / 2;
  let s = `<defs><marker id="fe5Ar2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="fe-arh"/></marker></defs>`;
  LANES.forEach((n, i) => { s += `<rect class="fe-lv${LANE_LVL[i]}f" x="${x0 + i * lw + 3}" y="4" width="${lw - 6}" height="34" rx="6"/><text class="fe-tick fe-pl" x="${LX(i)}" y="19" text-anchor="middle">${esc(n)}</text><text class="fe-tick" x="${LX(i)}" y="32" text-anchor="middle">L${LANE_LVL[i]}</text><line class="fe-grid" x1="${LX(i)}" x2="${LX(i)}" y1="40" y2="${H - 6}"/>`; });
  FLOWSTEPS.forEach(([a, b, l, t], k) => {
    if (k >= step) return;
    const y = top + k * rh + rh / 2, cur = k === step - 1, cls = `fe-sq${cur ? " fe-sq-cur" : ""}`;
    if (a === b) {     // work inside one system: small box, label beside it
      s += `<rect class="${cls} fe-sq-self" x="${LX(a) - 14}" y="${y - 9}" width="28" height="18" rx="5"/>`;
      const right = a < LANES.length - 2;
      s += `<text class="fe-tick${cur ? " fe-pl" : ""}" x="${LX(a) + (right ? 20 : -20)}" y="${y + 4}" text-anchor="${right ? "start" : "end"}">${k + 1}. ${esc(t)}</text>`;
      return;
    }
    s += `<line class="${cls}" x1="${LX(a)}" y1="${y}" x2="${LX(b) + (b > a ? -4 : 4)}" y2="${y}" marker-end="url(#fe5Ar2)"/>`;
    s += `<text class="fe-tick${cur ? " fe-pl" : ""}" x="${(LX(a) + LX(b)) / 2}" y="${y - 6}" text-anchor="middle">${k + 1}. ${esc(t)}</text>`;
  });
  $("fe5Seq").setAttribute("viewBox", `0 0 ${W} ${H}`); $("fe5Seq").innerHTML = s;
  $("fe5StepN").textContent = `step ${step} / ${FLOWSTEPS.length}`;
  const f = FLOWSTEPS[step - 1];
  $("fe5StepD").innerHTML = f ? `<div class="fe-phd"><p class="fe-big">${lvlBadge(f[2])} <b>${step}. ${esc(f[3])}</b> <span class="sub">${esc(LANES[f[0]])} → ${esc(LANES[f[1]])}</span></p><pre class="fe-msg">${esc(f[4])}</pre></div>`
    : `<p class="sub">Press Next or Play. Each arrow is one real message between two systems; the colour of the lane header is its ISA-95 level.</p>`;
}
