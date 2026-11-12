/* ASSEMBLY tab - item 3: LIVE digital twin of the motor-spindle assembly station ASSY-SP1 (operator terminal + live dashboard).
   Backend: twin/spstation.py via /api/spst (state, SSE stream, actions), contract docs/20_contract_spst.md, guide
   docs/20_spindle_station_live_twin.md chapter 16.  How-to lines + equipment / jigs per step come from the simulated
   assembly twin (window.asmSP.steps, web/asmsp.js), the 3D view is web/asmsp3d.js in live mode.
   Panels: KPI row, control bar (login, new unit, simulator, hold), operator terminal (step list, step card with checks,
   interlock, NCR), alarms + events, live run-in, final test + record, devices, history + SPC, 3D.
   The DOM is built once; each panel re-renders only when its data changes, typed values + focus are kept.
   All limits and values are EXAMPLES (see the guide).  Offline, no libraries. */
import { $, esc, tm, dt, ago, num, val, lineChart, profileChart } from "./spstui.js";

const box = $("arItem3");
const API = "/api/spst";
const ROLE_TXT = { operator: "operator", inspector: "inspector", admin: "admin" };
const FAULT_TXT = { mix: "bearing set mixed", spacer: "spacer 6 µm short", dirt: "dirt in bearing", grease: "too much grease", nut: "nut runout not corrected", rotor: "rotor fit too loose", spring: "springs stacked wrong", oring: "O-ring cut" };
const ST_TXT = { ok: "OK", warn: "WARN", bad: "BAD", pending: "open" };

let S = null;               // last station state
let started = false, es = null, pollT = null, sseFails = 0, pollOk = 0, lastOk = 0, lastErr = "";
const ui = { view: null, ncr: null, manual: {}, refuse: "", msg: null, hist: null, histSn: null, histDet: null, histRun: null, spcId: "nut.runout_after", spc: null, runSamples: null, runKey: "", runFetchT: 0, runOpenStep: null, d3: null, eqs: null, units: null, unitsKey: "" };
const sig = {};             // panel -> last rendered signature
const changed = (k, v) => { const s = typeof v === "string" ? v : JSON.stringify(v); if (sig[k] === s) return false; sig[k] = s; return true; };

/* ------------------------------------------------------------------ helpers */
const shown = () => !!box && !box.hidden && box.offsetParent !== null;
const steps = () => (S && S.steps) || [];
const simSteps = () => (window.asmSP && window.asmSP.steps) || [];
const unitOpen = (u) => u && (u.status === "in_work" || u.status === "hold");
const isInsp = () => S && S.user && (S.user.role === "inspector" || S.user.role === "admin");
function limits(c) {
  if (c.kind === "bool") return "yes";
  if (c.kind === "text") return c.eq === "sn" ? "= unit serial" : c.pre ? `starts ${c.pre}` : "any text";
  const u = c.unit ? " " + c.unit : "";
  if (c.lo !== null && c.lo !== undefined && c.hi !== null && c.hi !== undefined) return c.lo === c.hi ? `= ${num(c.lo)}${u}` : `${num(c.lo)} … ${num(c.hi)}${u}`;
  if (c.hi !== null && c.hi !== undefined) return `≤ ${num(c.hi)}${u}`;
  if (c.lo !== null && c.lo !== undefined) return `≥ ${num(c.lo)}${u}`;
  return "info only";
}
const srcBadge = (src) => { if (!src) return ""; const [a, b] = String(src).split(":"); const cls = a === "device" ? "dev" : a; return `<span class="st-src st-src-${esc(cls)}" title="where the value came from">${esc(a === "device" ? b || "device" : a)}</span>`; };
const stChip = (st, extra) => `<span class="st-chip st-${esc(st || "pending")}">${st === "ok" ? "✓ " : st === "bad" ? "✗ " : st === "warn" ? "! " : ""}${ST_TXT[st] || esc(st || "open")}${extra ? " · " + esc(extra) : ""}</span>`;
function fmtV(c, r) {
  if (!r || r.st === "pending" || r.v === null || r.v === undefined) return "–";
  if (c.kind === "bool") return r.v ? "yes" : "no";
  if (c.kind === "text") return esc(r.v);
  return esc(num(r.v)) + (c.unit ? ` <span class="muted">${esc(c.unit)}</span>` : "");
}
function concession(u, cid) { const r = u.results[cid]; return (u.ncr || []).some((n) => n.check === cid && n.decision === "concession" && n.t >= ((r && r.t) || 0)); }
function openRework(u, cid) { return (u.ncr || []).some((n) => n.check === cid && n.decision === "rework" && !n.closed); }
const devOf = (id) => (S ? S.devices.find((d) => d.id === id) : null);

async function api(path) { const r = await fetch(path, { cache: "no-store" }); if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json(); }
async function act(body, quiet) {
  try {
    const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    let j = {}; try { j = await r.json(); } catch (e) { j = { error: r.status === 404 ? "station server not reachable (404)" : r.statusText }; }
    if (!r.ok || j.ok === false) { const m = j.error || r.statusText; if (!quiet) msg(m, "bad"); return { ok: false, error: m }; }
    if (!quiet) msg(j.message, "ok");
    refresh();
    return { ok: true, message: j.message };
  } catch (e) { msg("Station server not reachable: " + e.message, "bad"); return { ok: false, error: e.message }; }
}
function msg(t, kind) { ui.msg = { t, kind, at: Date.now() }; const el = $("stMsg"); if (!el) return; el.className = "st-msg st-msg-" + kind; el.textContent = (kind === "bad" ? "Refused / error: " : "✓ ") + t; el.hidden = false; clearTimeout(msg._t); msg._t = setTimeout(() => { el.hidden = true; }, kind === "bad" ? 15000 : 5000); }
async function refresh() { try { onState(await api(API)); } catch (e) { /* stream / poll will show it */ } }

/* ------------------------------------------------------------------ skeleton (built once) */
function build() {
  box.innerHTML = `
  <div class="st-wrap">
    <div class="st-banner" id="stBanner" hidden></div>
    <div class="st-kpis" id="stKpis"></div>
    <div class="st-ctrl">
      <div class="st-grp" id="stLogin">
        <div class="st-gh">Login</div>
        <div class="st-row st-who"><span id="stWho"></span><button class="btn ghost st-sm" id="stLogoutBtn">Log out</button></div>
        <div class="st-row"><input type="text" id="stUser" placeholder="your name" maxlength="40" style="width:110px">
          <select id="stRole"><option value="operator">operator</option><option value="inspector">inspector</option><option value="admin">admin</option></select>
          <button class="btn primary" id="stLoginBtn">Log in</button></div>
      </div>
      <div class="st-grp">
        <div class="st-gh">New unit (spindle)</div>
        <div class="st-row"><select id="stWo" title="work order from the queue"></select>
          <input type="text" id="stShaft" placeholder="shaft serial (optional)" style="width:150px" title="empty = the station makes SPS-yyww-nnnnn; if given, the scanned shaft serial must match it">
          <button class="btn primary" id="stNewBtn">New unit</button></div>
        <div class="small muted" id="stNewHint"></div>
      </div>
      <div class="st-grp">
        <div class="st-gh">Simulator <span class="small muted">(replaces missing devices)</span></div>
        <div class="st-row"><label class="st-ck"><input type="checkbox" id="stSimOn"> simulator on</label>
          <label class="st-ck" title="a simulated operator + inspector do all steps"><input type="checkbox" id="stSimAuto"> auto operator</label>
          <label class="st-ck">speed <input type="range" id="stSimSpeed" min="1" max="20" step="1" style="width:90px"> <b id="stSimSpeedV"></b>×</label></div>
        <div class="st-row st-faults" id="stFaults"></div>
      </div>
      <div class="st-grp">
        <div class="st-gh">Hold</div>
        <div class="st-row"><input type="text" id="stHoldWhy" placeholder="reason" style="width:120px"><button class="btn warn" id="stHoldBtn">Hold</button><button class="btn" id="stRelBtn">Release</button></div>
        <div class="small muted" id="stHoldHint"></div>
      </div>
    </div>
    <div class="st-msg" id="stMsg" hidden></div>
    <div class="st-main">
      <div class="st-steps card" id="stSteps"></div>
      <div class="st-term card">
        <div id="stCardHead"></div>
        <div id="stHow"></div>
        <div id="stChecks"></div>
        <div id="stNcr"></div>
        <div id="stConfirm"></div>
      </div>
      <div class="st-side">
        <div class="card"><div class="card-head"><h3 class="st-h3">Alarms</h3><button class="btn ghost st-sm" id="stAckAll">Ack all</button></div><div id="stAlarms" class="st-list"></div></div>
        <div class="card"><div class="card-head"><h3 class="st-h3">Events (audit trail)</h3><span class="small muted">last 30 · full trail per unit in History</span></div><div id="stEvents" class="st-list"></div></div>
      </div>
    </div>
    <details class="card st-det" id="stRunDet"><summary><b>Live run-in</b> <span id="stRunSum" class="small muted"></span></summary><div id="stRun"></div></details>
    <details class="card st-det" id="stFinDet"><summary><b>Final test + assembly record</b> <span id="stFinSum" class="small muted"></span></summary><div id="stFin"></div></details>
    <details class="card st-det" id="stDevDet" open><summary><b>Devices</b> <span id="stDevSum" class="small muted"></span></summary><div id="stDevs"></div>
      <div class="st-row st-devform"><b class="small">Change device:</b> <select id="stDevId"></select>
        <select id="stDevProto"><option value="sim">sim</option><option value="http">http (gateway)</option><option value="modbus">modbus</option><option value="mqtt">mqtt</option></select>
        <input type="text" id="stDevAddr" placeholder="address, e.g. 127.0.0.1:5020/unit1" style="width:230px">
        <label class="st-ck"><input type="checkbox" id="stDevEn" checked> enabled</label><button class="btn" id="stDevSave">Save</button>
        <span class="small muted">sim = built-in simulator · http = values arrive at /api/spst/ingest · modbus = station polls the address · mqtt = broker address</span></div>
    </details>
    <details class="card st-det" id="stHistDet"><summary><b>History + SPC</b> <span id="stHistSum" class="small muted"></span></summary>
      <div class="st-hist"><div><div class="card-head"><h3 class="st-h3">Units</h3><a class="btn ghost st-sm" href="${API}/export.csv" download>CSV export (all results)</a></div><div id="stUnits" class="st-scroll"></div></div>
        <div><div class="card-head"><h3 class="st-h3">SPC of one check</h3><select id="stSpcSel"></select></div><div id="stSpc"></div></div></div>
      <div id="stUnitDet"></div>
    </details>
    <div class="card st-3d"><div class="apc3d-bar"><button class="btn ghost" id="st3dBtn">Show 3D view</button><label class="small"><input type="checkbox" id="st3dCut" checked> quarter cut</label><span class="small muted">3D follows the live step, progress, run-in speed + temperatures and device LEDs</span></div>
      <div class="mf3d" id="st3d" hidden></div></div>
  </div>`;
  wire();
}

/* ------------------------------------------------------------------ events */
function wire() {
  $("stLoginBtn").onclick = () => { const n = $("stUser").value.trim(); if (!n) { msg("type your name first", "bad"); $("stUser").focus(); return; } act({ action: "login", user: n, role: $("stRole").value }); };
  $("stUser").addEventListener("keydown", (e) => { if (e.key === "Enter") $("stLoginBtn").click(); });
  $("stLogoutBtn").onclick = () => act({ action: "logout" });
  $("stNewBtn").onclick = () => { const b = { action: "new_unit" }; if ($("stWo").value) b.wo = $("stWo").value; if ($("stShaft").value.trim()) b.shaft_sn = $("stShaft").value.trim(); act(b).then((r) => { if (r.ok) { $("stShaft").value = ""; ui.view = null; ui.refuse = ""; } }); };
  $("stSimOn").onchange = (e) => act({ action: "sim", on: e.target.checked });
  $("stSimAuto").onchange = (e) => act({ action: "sim", auto: e.target.checked, on: e.target.checked ? true : undefined });
  $("stSimSpeed").oninput = (e) => { $("stSimSpeedV").textContent = e.target.value; };
  $("stSimSpeed").onchange = (e) => act({ action: "sim", speed: +e.target.value });
  $("stFaults").onclick = (e) => { const b = e.target.closest("[data-f]"); if (!b || !S) return; const f = new Set(S.sim.faults); f.has(b.dataset.f) ? f.delete(b.dataset.f) : f.add(b.dataset.f); act({ action: "sim", faults: [...f] }); };
  $("stHoldBtn").onclick = () => act({ action: "hold", reason: $("stHoldWhy").value.trim() }).then((r) => { if (r.ok) $("stHoldWhy").value = ""; });
  $("stRelBtn").onclick = () => act({ action: "release" });
  $("stAckAll").onclick = () => act({ action: "ack", id: "all" });
  $("stAlarms").onclick = (e) => { const b = e.target.closest("[data-ack]"); if (b) act({ action: "ack", id: +b.dataset.ack }); };
  $("stSteps").onclick = (e) => { const b = e.target.closest("[data-si]"); if (!b) return; const i = +b.dataset.si; ui.view = S && S.unit && i === S.unit.si ? null : i; ui.ncr = null; renderTerm(true); };
  box.addEventListener("click", onTermClick);
  box.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches("[data-in]")) { const b = box.querySelector(`[data-rec="${e.target.dataset.in}"]`); if (b) b.click(); } });
  $("stDevSave").onclick = () => { const id = $("stDevId").value; act({ action: "device", id, proto: $("stDevProto").value, addr: $("stDevAddr").value.trim(), enabled: $("stDevEn").checked }); };
  $("stDevId").onchange = fillDevForm;
  $("stDevs").onclick = (e) => { const b = e.target.closest("[data-dev]"); if (!b) return; $("stDevId").value = b.dataset.dev; fillDevForm(); $("stDevAddr").focus(); };
  $("stSpcSel").onchange = () => { ui.spcId = $("stSpcSel").value; loadSpc(); };
  $("stUnits").onclick = (e) => { const r = e.target.closest("[data-sn]"); if (r) loadUnit(r.dataset.sn); };
  $("stHistDet").addEventListener("toggle", () => { if ($("stHistDet").open) { loadUnits(); loadSpc(); } });
  $("stRunDet").addEventListener("click", (e) => { const b = e.target.closest("[data-run]"); if (b) act({ action: "runin", cmd: b.dataset.run }); });
  $("st3dBtn").onclick = toggle3d;
}
function fillDevForm() { const d = devOf($("stDevId").value); if (!d) return; $("stDevProto").value = d.proto; $("stDevAddr").value = d.addr || ""; $("stDevEn").checked = !!d.enabled; }

async function onTermClick(e) {
  const t = e.target;
  if (t.closest("#stStart")) { ui.refuse = ""; act({ action: "start_step" }); return; }
  if (t.closest("#stBack")) { ui.view = null; renderTerm(true); return; }
  const rec = t.closest("[data-rec]");
  if (rec) {
    const cid = rec.dataset.rec, inp = box.querySelector(`[data-in="${cid}"]`); if (!inp) return;
    let v = inp.value.trim(); if (v === "") { msg("enter a value first", "bad"); inp.focus(); return; }
    const c = findCheck(cid);
    if (c && c.kind === "num") { v = v.replace(",", "."); if (!isFinite(+v)) { msg(`${c.n}: a number is needed (dot or comma)`, "bad"); inp.focus(); return; } v = +v; }
    if (c && c.kind === "bool") v = v === "yes";
    const r = await act({ action: "record", id: cid, v });
    if (r.ok) { delete ui.manual[cid]; inp.value = ""; }
    return;
  }
  const man = t.closest("[data-man]"); if (man) { ui.manual[man.dataset.man] = !ui.manual[man.dataset.man]; renderTerm(true); return; }
  const nb = t.closest("[data-ncr]"); if (nb) { ui.ncr = { id: nb.dataset.ncr }; renderNcr(true); $("stNcr").scrollIntoView({ block: "nearest" }); return; }
  if (t.closest("#stNcrCancel")) { ui.ncr = null; renderNcr(true); return; }
  if (t.closest("#stNcrOk")) {
    const dec = (box.querySelector("input[name=stDec]:checked") || {}).value, text = $("stNcrText").value.trim();
    if (!dec) { msg("choose a decision", "bad"); return; }
    const r = await act({ action: "ncr", id: ui.ncr.id, decision: dec, text });
    if (r.ok) { ui.ncr = null; ui.refuse = ""; renderNcr(true); } else { ui.ncr.err = r.error; renderNcr(true); }
    return;
  }
  if (t.closest("#stConfirmBtn")) {
    const r = await act({ action: "confirm" }, true);
    if (r.ok) { ui.refuse = ""; msg(r.message, "ok"); } else { ui.refuse = r.error; msg(r.error, "bad"); }
    renderConfirm(true); return;
  }
}
function findCheck(cid) { for (const s of steps()) for (const c of s.checks) if (c.id === cid) return c; return null; }

/* ------------------------------------------------------------------ connection: SSE while visible, polling fallback */
function connect() {
  if (es || pollT) return;
  if (sseFails < 3 && window.EventSource) {
    es = new EventSource(API + "/stream");
    es.onmessage = (ev) => { try { onState(JSON.parse(ev.data)); sseFails = 0; } catch (e) { /* ignore */ } };
    es.onerror = () => { if (es) es.close(); es = null; sseFails++; startPoll(); };
  } else startPoll();
}
function startPoll() {
  if (pollT) return;
  const tick = async () => {
    if (!shown()) { stopAll(); return; }
    try { onState(await api(API)); pollOk++; if (pollOk > 10 && sseFails < 3) { clearInterval(pollT); pollT = null; pollOk = 0; connect(); } }
    catch (e) { lastErr = e.message; pollOk = 0; banner(true); }
  };
  tick(); pollT = setInterval(tick, 1500);
}
function stopAll() { if (es) { es.close(); es = null; } if (pollT) { clearInterval(pollT); pollT = null; } }
function banner(on) {
  const b = $("stBanner"); if (!b) return;
  if (on) { b.hidden = false; b.innerHTML = `<b>Station server not reachable – start <code>python server.py</code> (restart needed after update).</b> <span class="small">(${esc(lastErr || "no answer from /api/spst")} – the page retries every 1.5 s)</span>`; }
  else b.hidden = true;
}
function show() {
  if (!box) return;
  if (!started) { started = true; build(); import("./asmsp3dx.js").then((m) => { ui.eqs = m.EQS; sig.how = ""; if (S) renderTerm(true); }).catch(() => {}); }
  connect(); loadUnits();
}
window.addEventListener("asitemshow", (e) => { if (e.detail === "3") setTimeout(show, 0); });
setInterval(() => { if (shown()) { if (!started || (!es && !pollT)) show(); } else if (es || pollT) stopAll(); }, 1000);
if (new URLSearchParams(location.search).get("asitem") === "3") setTimeout(() => { if (box && box.hidden && window.asmTab) window.asmTab.showItem("3"); show(); }, 300);

/* ------------------------------------------------------------------ state -> panels */
function onState(s) {
  if (!s || !s.steps) return;
  const first = !S; S = s; lastOk = Date.now(); banner(false);
  if (!started) return;
  if (first) { fillDevSelect(); fillSpcSelect(); }
  try { renderKpis(); renderCtrl(); renderSteps(); renderTerm(); renderSide(); renderRun(); renderFin(); renderDevs(); maybeUnits(); }
  catch (e) { console.error("spst render", e); }
}

function renderKpis() {
  const u = S.unit, k = S.kpi || {}, dv = S.devices || [];
  const nSim = dv.filter((d) => d.proto === "sim").length, mode = nSim === dv.length ? "SIM" : nSim === 0 ? "LIVE" : "MIXED";
  const openAl = (S.alarms || []).filter((a) => !a.ack);
  const tile = (l, v, n, cls = "") => `<div class="st-kpi ${cls}"><div class="st-kl">${l}</div><div class="st-kv">${v}</div>${n ? `<div class="st-kn">${n}</div>` : ""}</div>`;
  const stt = u ? { in_work: "IN WORK", hold: "HOLD", accepted: "ACCEPTED", rejected: "REJECTED" }[u.status] || u.status : "no unit";
  const stc = u ? { in_work: "st-k-run", hold: "st-k-hold", accepted: "st-k-ok", rejected: "st-k-bad" }[u.status] : "";
  const h = tile("Station", esc(S.station), "spindle clean room") +
    tile("Mode", mode, mode === "SIM" ? "all devices simulated" : mode === "LIVE" ? "all devices real" : `${dv.length - nSim} real · ${nSim} simulated`, "st-k-" + mode.toLowerCase()) +
    tile("User", S.user ? esc(S.user.name) : "nobody", S.user ? esc(ROLE_TXT[S.user.role] || S.user.role) : "log in to work") +
    tile("Unit", u ? esc(u.sn) : "–", u ? `${esc(u.wo)} · shaft ${esc(u.shaft_sn)}` : "start a new unit", "st-k-wide") +
    tile("Status", stt, u ? (u.status === "in_work" ? esc(u.step_state.replace("_", " ")) : "") : "", stc) +
    tile("Step", u ? `${u.si + 1} / ${steps().length}` : "–", u ? esc(steps()[u.si].n) : "") +
    tile("Units", `${k.units ?? 0}`, `${k.accepted ?? 0} accepted · ${k.rejected ?? 0} rejected`) +
    tile("FPY", k.fpy === null || k.fpy === undefined ? "–" : Math.round(k.fpy * 100) + " %", "first pass yield = accepted without NCR / finished") +
    tile("Open NCRs", `${k.open_ncr ?? 0}`, `${k.ncr_total ?? 0} total`, k.open_ncr ? "st-k-hold" : "") +
    tile("Alarms", `${openAl.length}`, "not acknowledged", openAl.some((a) => a.sev === "alarm") ? "st-k-bad" : openAl.length ? "st-k-hold" : "");
  if (changed("kpi", h)) $("stKpis").innerHTML = h;
}

function renderCtrl() {
  const u = S.unit, act0 = document.activeElement;
  $("stWho").innerHTML = S.user ? `Logged in: <b>${esc(S.user.name)}</b> (${esc(S.user.role)})` : `<span class="st-warn-t">Nobody logged in – every action needs a login</span>`;
  $("stLogoutBtn").disabled = !S.user;
  const q = S.queue || [];
  if (changed("wo", q)) {
    const cur = $("stWo").value;
    $("stWo").innerHTML = `<option value="">next in queue (auto)</option>` + q.map((w) => `<option value="${esc(w.wo)}">${esc(w.wo)} · ${w.done}/${w.qty} done · due ${esc(dt(w.due).slice(5, 10))}</option>`).join("");
    if ([...$("stWo").options].some((o) => o.value === cur)) $("stWo").value = cur;
  }
  const busy = unitOpen(u);
  $("stNewBtn").disabled = busy || !S.user;
  $("stNewHint").textContent = !S.user ? "log in first" : busy ? `unit ${u.sn} is still in work – finish or scrap it first` : "serial SPU-yyww-nnnnn is given by the station";
  if (act0 !== $("stSimOn")) $("stSimOn").checked = S.sim.on;
  if (act0 !== $("stSimAuto")) $("stSimAuto").checked = S.sim.auto;
  if (act0 !== $("stSimSpeed")) { $("stSimSpeed").value = S.sim.speed; $("stSimSpeedV").textContent = S.sim.speed; }
  const fa = S.faults_available || Object.keys(FAULT_TXT);
  const fh = fa.map((f) => `<button class="chip st-fchip ${S.sim.faults.includes(f) ? "on" : ""}" data-f="${f}" title="simulated fault: ${esc(FAULT_TXT[f] || f)} (acts on simulated devices only)">${S.sim.faults.includes(f) ? "⚠ " : ""}${esc(FAULT_TXT[f] || f)}</button>`).join("");
  if (changed("faults", fh)) $("stFaults").innerHTML = `<span class="small muted">faults:</span> ` + fh;
  $("stHoldBtn").disabled = !(u && u.status === "in_work") || !S.user;
  $("stRelBtn").disabled = !(u && u.status === "hold") || !S.user;
  $("stHoldHint").textContent = u && u.status === "hold" ? "unit is on HOLD – nothing can be recorded" : "stops all work on the unit (e.g. part missing)";
}

function renderSteps() {
  const u = S.unit;
  const h = `<h3 class="st-h3">Steps</h3><ol class="st-sl">` + steps().map((s, i) => {
    let cls = "lock", ic = "🔒";
    if (u) { if (i < u.si || (i === u.si && u.step_state === "done" && u.status === "accepted")) { cls = "done"; ic = "✓"; } else if (i === u.si) { cls = u.status === "rejected" ? "rej" : "cur"; ic = u.status === "rejected" ? "✗" : "▶"; } }
    const sel = ui.view === i ? " sel" : "";
    return `<li class="st-s st-s-${cls}${sel}" data-si="${i}" title="${esc(s.n)}${s.insp ? " – inspector signs" : ""}"><span class="st-si">${ic}</span><span class="st-sn">${s.no}</span><span class="st-st">${esc(s.n)}</span>${s.insp ? `<span class="st-insp" title="inspector must sign this step">INSP</span>` : ""}</li>`;
  }).join("") + `</ol><div class="small muted">click a step to see its checks</div>`;
  if (changed("steps", h)) $("stSteps").innerHTML = h;
}

/* --- operator terminal: current step card --- */
function renderTerm(force) {
  if (!S) return;
  const u = S.unit, si = ui.view !== null ? ui.view : u ? u.si : 0, s = steps()[si];
  if (!s) return;
  const cur = !!u && si === u.si && ui.view === null;
  const ss = simSteps().find((x) => x.k === s.k) || {};
  // head
  let head;
  if (!u) head = `<div class="st-ch"><div><div class="small muted">No unit yet</div><h2 class="st-h2">Start a new unit</h2></div></div><p class="small">1. Log in (name + role). 2. Choose a work order and press <b>New unit</b>. 3. Press <b>Start step</b> and follow the card. Or switch the <b>auto operator</b> on to watch a simulated assembly.</p>`;
  else {
    const stTxt = !cur ? (si < u.si || u.step_state === "done" ? "done" : "later step") : { idle: "not started", running: "running", wait_confirm: "all values in – sign off", done: u.status }[u.step_state] || u.step_state;
    head = `<div class="st-ch"><div><div class="small muted">Step ${s.no} / ${steps().length} · ${esc(s.ph)} · plan ${s.t_min} min${s.insp ? ` · <span class="st-insp">INSPECTOR SIGNS</span>` : ""}</div><h2 class="st-h2">${esc(s.n)}</h2></div>
      <div class="st-chr">${cur ? `<span class="st-state st-state-${esc(u.step_state)}">${esc(stTxt)}</span>` : `<span class="st-state">${esc(stTxt)}</span> <button class="btn ghost st-sm" id="stBack">← back to current step</button>`}
      ${cur && u.step_state === "idle" && u.status === "in_work" ? `<button class="btn primary" id="stStart">▶ Start step</button>` : ""}</div></div>
      ${cur ? `<div class="st-prog" title="progress of the step"><div style="width:${Math.round((u.u || 0) * 100)}%"></div></div>` : ""}`;
  }
  if (force || changed("head", head)) { sig.head = head; $("stCardHead").innerHTML = head; }
  // how-to + equipment
  const eqn = (id) => (ui.eqs && ui.eqs[id]) || "";
  const how = ss.how ? `<div class="st-how"><div><b class="small">How to</b><ol>${ss.how.map((l) => `<li>${esc(l)}</li>`).join("")}</ol></div>
     <div class="st-eq"><b class="small">Equipment</b><div>${(ss.eq || []).map((e) => `<span class="st-eqb" title="${esc(eqn(e))}">${esc(e)} ${esc(eqn(e))}</span>`).join("") || "–"}</div>
     <b class="small">Jigs (make)</b><div>${(ss.jig || []).map((j) => `<span class="st-eqb st-jig" title="${esc(eqn(j))}">${esc(j)} ${esc(eqn(j))}</span>`).join("") || "–"}</div>
     <div class="small muted">from Assembly item 2 (simulated twin) · guide 19</div></div></div>` : `<div class="small muted">How-to text: open Assembly item 2 once (asmsp.js not loaded).</div>`;
  if (force || changed("how", s.k + "|" + !!ui.eqs + "|" + !!ss.how)) $("stHow").innerHTML = u ? `<details class="st-howd" ${cur && u.step_state !== "wait_confirm" ? "open" : ""}><summary class="small">How to do this step · equipment + jigs</summary>${how}</details>` : "";
  // check table
  renderChecks(force, u, s, cur);
  renderNcr(force);
  renderConfirm(force);
}

function renderChecks(force, u, s, cur) {
  if (!u) { if (changed("checks", "")) $("stChecks").innerHTML = ""; return; }
  const res = u.results || {}, started = cur && (u.step_state === "running" || u.step_state === "wait_confirm") && u.status === "in_work";
  const devSt = {}; s.checks.forEach((c) => { if (c.dev) { const d = devOf(c.dev); devSt[c.dev] = d ? d.state : "?"; } });
  const key = JSON.stringify([s.k, cur, u.sn, u.step_state, u.status, s.checks.map((c) => res[c.id] || null), u.ncr, devSt, ui.manual, S.user && S.user.role]);
  if (!force && !changed("checks", key)) return;
  sig.checks = key;
  // keep typed values + focus
  const keep = {}; box.querySelectorAll("#stChecks [data-in]").forEach((i) => { keep[i.dataset.in] = i.value; });
  const fa = document.activeElement, fid = fa && fa.dataset && fa.dataset.in, sel = fid && fa.selectionStart !== undefined ? [fa.selectionStart, fa.selectionEnd] : null;
  let firstDevWait = true;
  const rows = s.checks.map((c) => {
    const r = res[c.id] || { st: "pending" }, pend = !r || r.st === "pending";
    let action = "";
    const conc = r && r.st === "bad" && concession(u, c.id), rw = openRework(u, c.id);
    if (!started) action = cur && unitOpen(u) && u.step_state === "idle" ? `<span class="small muted">start the step first</span>` : "";
    else if (pend) {
      if (c.calc) action = `<span class="small muted">calculated by the station from earlier values</span>`;
      else if (c.auto === "runin") action = `<span class="small muted">from the run-in program (RUN-01)</span>`;
      else {
        const input = c.kind === "bool" ? `<select data-in="${c.id}"><option value="">choose</option><option value="yes">yes / OK</option><option value="no">no / not OK</option></select>`
          : `<input type="text" data-in="${c.id}" ${c.kind === "num" ? 'inputmode="decimal"' : ""} placeholder="${c.kind === "num" ? "value" + (c.unit ? " in " + esc(c.unit) : "") : "scan / type"}" style="width:${c.kind === "text" ? 150 : 90}px">`;
        const rec = `${input} <button class="btn st-sm" data-rec="${c.id}">Record</button>`;
        if (c.dev && !ui.manual[c.id]) {
          const d = devOf(c.dev), stt = d ? d.state : "?";
          action = `<span class="st-wait ${firstDevWait ? "st-wait-now" : ""}"><span class="st-led st-led-${esc(stt)}"></span>${firstDevWait ? "waiting for" : "next from"} <b>${esc(c.dev)}</b> (${esc(stt)})…</span> <button class="btn ghost st-sm" data-man="${c.id}" title="device broken / offline: type the value by hand (source = manual)">✎ by hand</button>`;
          if (firstDevWait && c.dev) firstDevWait = false;
        } else action = rec + (c.dev ? ` <button class="btn ghost st-sm" data-man="${c.id}">× device</button>` : "");
      }
    } else if (r.st === "bad" || r.st === "warn") {
      action = conc ? `<span class="small">concession given</span>` : `<button class="btn ${r.st === "bad" ? "warn" : "ghost"} st-sm" data-ncr="${c.id}">NCR…</button>`;
    }
    if (rw && pend) action = `<span class="st-chip st-warn">rework – measure again</span> ` + action;
    const extra = conc ? "concession" : "";
    return `<tr class="st-r-${esc(r.st || "pending")}"><td><div>${esc(c.n)}${c.req ? "" : ' <span class="small muted">(optional)</span>'}</div><div class="small muted">${esc(c.id)}${c.note ? " · " + esc(c.note) : ""}</div></td>
      <td class="st-v">${fmtV(c, r)}</td><td class="small">${esc(limits(c))}</td><td>${stChip(r.st, extra)}</td>
      <td class="st-nw">${r.src ? srcBadge(r.src) : c.dev ? `<span class="small muted">${esc(c.dev)}</span>` : c.calc ? '<span class="small muted">calc</span>' : '<span class="small muted">manual</span>'}</td>
      <td class="small">${r.t ? esc(tm(r.t)) : ""}${r.user ? `<br><span class="muted">${esc(r.user)}</span>` : ""}</td><td class="st-act">${action}</td></tr>`;
  }).join("");
  $("stChecks").innerHTML = `<div class="st-scroll-x"><table class="st-tbl"><thead><tr><th>Check</th><th>Value</th><th>Limits (example)</th><th>Status</th><th>Source</th><th>Time · user</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  Object.entries(keep).forEach(([k, v]) => { const i = box.querySelector(`#stChecks [data-in="${k}"]`); if (i) i.value = v; });
  if (fid) { const i = box.querySelector(`#stChecks [data-in="${fid}"]`); if (i) { i.focus(); if (sel && i.setSelectionRange) try { i.setSelectionRange(sel[0], sel[1]); } catch (e) { /* select */ } } }
}

function renderNcr(force) {
  const el = $("stNcr"); if (!el) return;
  if (!ui.ncr || !S || !S.unit) { if (el.innerHTML) el.innerHTML = ""; return; }
  const key = JSON.stringify([ui.ncr, S.user && S.user.role]);
  if (!force && !changed("ncr", key)) return; sig.ncr = key;
  const c = findCheck(ui.ncr.id) || { n: ui.ncr.id, unit: "" }, r = S.unit.results[ui.ncr.id] || {};
  const insp = isInsp(), keepTxt = $("stNcrText") ? $("stNcrText").value : "", keepDec = (box.querySelector("input[name=stDec]:checked") || {}).value;
  el.innerHTML = `<div class="st-ncrbox"><h3 class="st-h3">NCR – non-conformance report</h3>
    <div class="small">Check <b>${esc(c.n)}</b> (${esc(ui.ncr.id)}): value <b>${esc(num(r.v))} ${esc(c.unit || "")}</b>, limits ${esc(limits(c))}, status ${stChip(r.st)}</div>
    <div class="st-row"><label class="st-ck"><input type="radio" name="stDec" value="rework"> <b>rework</b> – fix the cause, measure again</label>
      <label class="st-ck"><input type="radio" name="stDec" value="concession" ${insp ? "" : "disabled"}> <b>concession</b> – accept as it is ${insp ? "" : '<span class="small muted">(inspector only)</span>'}</label>
      <label class="st-ck"><input type="radio" name="stDec" value="scrap"> <b>scrap</b> – the whole unit is rejected</label></div>
    <div class="st-row"><input type="text" id="stNcrText" placeholder="text: what was found, what was done, who decided (needed for a concession)" style="flex:1;min-width:260px"></div>
    ${ui.ncr.err ? `<div class="st-refuse">Refused: ${esc(ui.ncr.err)}</div>` : ""}
    <div class="st-row"><button class="btn primary" id="stNcrOk">Save NCR</button><button class="btn ghost" id="stNcrCancel">Cancel</button></div></div>`;
  $("stNcrText").value = keepTxt; if (keepDec) { const rr = box.querySelector(`input[name=stDec][value=${keepDec}]`); if (rr) rr.checked = true; }
}

/* the interlock, shown before the operator presses Confirm */
function lockReasons() {
  const u = S.unit, out = [];
  if (!S.user) out.push("nobody is logged in");
  if (!u || !unitOpen(u)) { out.push("no unit in work"); return out; }
  const s = steps()[u.si];
  if (u.status === "hold") out.push("unit is on HOLD – press Release");
  if (u.step_state === "idle") out.push("the step is not started – press Start step");
  if (s.insp && S.user && !isInsp()) out.push(`an inspector must sign this step (logged in as ${S.user.role}) – the inspector logs in and confirms`);
  if (s.k === "runin" && S.runin && S.runin.active) out.push("the run-in program is still running");
  if (u.step_state !== "idle") {
    const pend = s.checks.filter((c) => c.req && (!u.results[c.id] || u.results[c.id].st === "pending"));
    if (pend.length) out.push(`${pend.length} value(s) still missing: ` + pend.map((c) => c.n).slice(0, 4).join(" · ") + (pend.length > 4 ? " …" : ""));
    const bad = s.checks.filter((c) => u.results[c.id] && u.results[c.id].st === "bad" && !concession(u, c.id));
    if (bad.length) out.push(`out of limits without NCR decision: ${bad.map((c) => c.n).join(" · ")} – press NCR… on the red line`);
  }
  return out;
}
function renderConfirm(force) {
  const el = $("stConfirm"); if (!el || !S) return;
  const u = S.unit;
  if (!u || ui.view !== null) { if (changed("conf", "")) el.innerHTML = ""; return; }
  if (!unitOpen(u)) {
    const h = u.status === "accepted" ? `<div class="st-done st-done-ok">✓ Unit ${esc(u.sn)} ACCEPTED – all 21 steps signed. Download the record in "Final test + assembly record". Start the next unit with <b>New unit</b>.</div>`
      : `<div class="st-done st-done-bad">✗ Unit ${esc(u.sn)} REJECTED (scrap). The record stays in the history. Start the next unit with <b>New unit</b>.</div>`;
    if (force || changed("conf", h)) el.innerHTML = h; return;
  }
  const rk = `${u.sn}|${u.si}|${S.user ? S.user.name + S.user.role : ""}`;
  if (rk !== ui.refuseKey) { ui.refuseKey = rk; ui.refuse = ""; }
  const rs = lockReasons(), s = steps()[u.si];
  const h = `<div class="st-conf ${rs.length ? "locked" : "free"}">
     <div class="st-confl">${rs.length ? `<b>🔒 Confirm is locked (interlock):</b><ul>${rs.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : `<b>✓ All required values are in and in limits.</b> ${s.insp ? "The inspector signs with Confirm." : "Sign off the step with Confirm."}`}
       ${ui.refuse ? `<div class="st-refuse"><b>The station refused:</b> ${esc(ui.refuse)}</div>` : ""}</div>
     <div class="st-confr"><button class="btn ${rs.length ? "" : "primary"} st-big" id="stConfirmBtn" title="sign off step ${s.no} with your name (${S.user ? esc(S.user.name) : "login needed"})">✍ Confirm step ${s.no}</button>
       <div class="small muted">${s.insp ? "inspector signature" : "operator signature"}</div>
       <button class="btn ghost st-sm" data-ncr="unit" title="scrap the whole unit">Scrap unit…</button></div></div>`;
  if (force || changed("conf", h)) el.innerHTML = h;
}

/* --- alarms + events --- */
function renderSide() {
  const al = S.alarms || [];
  const ah = al.length ? al.slice(0, 20).map((a) => `<div class="st-li st-al-${esc(a.sev)} ${a.ack ? "acked" : ""}"><span class="st-alsev">${a.sev === "alarm" ? "⛔" : a.sev === "warn" ? "⚠" : "ℹ"} ${esc(a.sev)}</span><span class="small muted">${esc(tm(a.t))}</span><span class="st-lt">${esc(a.text)}</span>${a.ack ? `<span class="small muted">ack</span>` : `<button class="btn ghost st-sm" data-ack="${a.id}">Ack</button>`}</div>`).join("") : `<div class="small muted">no alarms</div>`;
  if (changed("al", ah)) $("stAlarms").innerHTML = ah;
  const eh = (S.events || []).map((e) => `<div class="st-li"><span class="small muted">${esc(tm(e.t))}</span><span class="st-lt">${esc(e.text)}</span><span class="small muted">${esc(e.user || "")}</span></div>`).join("") || `<div class="small muted">no events</div>`;
  if (changed("ev", eh)) $("stEvents").innerHTML = eh;
}

/* --- live run-in --- */
async function loadRunin(sn, force) {
  const now = Date.now();
  if (!force && now - ui.runFetchT < 3000) return;
  ui.runFetchT = now;
  try { const r = await api(`${API}/runin?sn=${encodeURIComponent(sn)}`); ui.runSamples = r; sig.run = ""; renderRun(); } catch (e) { /* keep */ }
}
function runCharts(samples, R, w) {
  const sm = samples || [], X = (p) => +(p.t / 60).toFixed(2);
  const live = R && R.active && R.elapsed_s ? { t: R.elapsed_s, rpm: R.rpm, tf: R.T.front, tr: R.T.rear, ts: R.T.stator, win: R.T.win, wout: R.T.wout, vib: R.vib } : null;
  const all = live && (!sm.length || live.t > sm[sm.length - 1].t) ? [...sm, live] : sm;
  const ser = (k) => all.map((p) => [X(p), p[k]]);
  const x1 = all.length ? Math.max(X(all[all.length - 1]), 1) : 1, base = { w, h: 150, xl: "min (process time)", x0: 0, x1 };
  const wIn = all.length ? all[all.length - 1].win : 20;
  return [
    lineChart({ ...base, title: "Speed", unit: "rpm", y0: 0, series: [{ n: "speed", c: "var(--st-s1)", pts: ser("rpm") }], hl: R && R.rpm_set ? [{ y: R.rpm_set, n: "set " + num(R.rpm_set), c: "var(--muted)" }] : [] }),
    lineChart({ ...base, title: "Bearing + stator temperature", unit: "°C", series: [{ n: "front", c: "var(--st-s1)", pts: ser("tf") }, { n: "rear", c: "var(--st-s2)", pts: ser("tr") }, { n: "stator", c: "var(--st-s3)", pts: ser("ts") }],
      hl: [{ y: (wIn ?? 20) + 25, n: "stop: front ΔT 25 K (example)" }, { y: (wIn ?? 20) + 20, n: "hold: ΔT 20 K", c: "var(--warning)" }] }),
    lineChart({ ...base, title: "Cooling water", unit: "°C", series: [{ n: "in", c: "var(--st-s1)", pts: ser("win") }, { n: "out", c: "var(--st-s2)", pts: ser("wout") }] }),
    lineChart({ ...base, title: "Vibration", unit: "mm/s", y0: 0, series: [{ n: "vibration", c: "var(--st-s1)", pts: ser("vib") }], hl: [{ y: 1.8, n: "stop 1.8 (example)" }, { y: 1.0, n: "end limit 1.0", c: "var(--warning)" }] }),
  ];
}
function renderRun() {
  const R = S.runin, u = S.unit, det = $("stRunDet");
  const k = u ? steps()[u.si].k : "";
  // open automatically at step runin / test (only when the step changes, so the user can close it)
  const stepKey = u ? u.sn + "|" + u.si : "";
  if (stepKey !== ui.runOpenStep) { ui.runOpenStep = stepKey; det.open = k === "runin" || k === "test"; }
  $("stRunSum").textContent = R.active ? `running · ${R.phase} · ${num(R.rpm)} rpm · front ΔT ${num(R.dT)} K` : R.run ? `run ${R.run} ${R.finished ? "finished" : "stopped"}${R.msg ? " – " + R.msg : ""}` : "not started (step 19)";
  if (!det.open) return;
  if (u) { const rk = u.sn + "|" + (R.run || 0); if (rk !== ui.runKey) { ui.runKey = rk; ui.runSamples = null; loadRunin(u.sn, true); } else if (R.active) loadRunin(u.sn); }
  const cw = $("stRun").querySelector(".st-charts"), W = Math.round(Math.max(300, Math.min(620, cw && cw.clientWidth > 300 ? (cw.clientWidth - 8) / (cw.clientWidth > 640 ? 2 : 1) : 430)));
  const sm = ui.runSamples && u && ui.runSamples.sn === u.sn ? ui.runSamples.samples : [];
  const canRun = u && k === "runin" && unitOpen(u) && (u.step_state === "running" || u.step_state === "wait_confirm");
  const tiles = [["Speed", `${num(R.rpm)} rpm`, `set ${num(R.rpm_set)} rpm`], ["Phase", R.phase || "–", R.cooling ? "cooling – waiting for ΔT ≤ 12 K" : ""],
    ["Front bearing ΔT", `${num(R.dT)} K`, `max ${num(R.dT_max ?? 0)} K · stop at 25 K`], ["Rise rate", `${num(R.rate_k_min)} K/min`, "hold above 1.0 K/min"],
    ["Vibration", `${num(R.vib)} mm/s`, "stop above 1.8 mm/s"], ["Water flow", R.flow_lpm !== undefined ? `${num(R.flow_lpm)} l/min` : "–", "stop below 2 l/min"],
    ["Stops", `${R.stops ?? 0}`, "temperature stops"], ["Time", `${num((R.elapsed_s || 0) / 60, 1)} min`, `process time · ${num(R.time_factor)}× faster than real (sim)`],
    ["Source", R.source === "sim" ? "simulator" : "RUN-01 " + esc(R.source), R.waiting ? "⚠ waiting for RUN-01 data" : R.source === "sim" ? "thermal model of the twin" : "real PLC values"]];
  const h = `<div class="st-run">
    <div class="st-runl">
      <div class="st-rtiles">${tiles.map(([l, v, n]) => `<div class="st-kpi"><div class="st-kl">${l}</div><div class="st-kv st-kv-s">${v}</div><div class="st-kn">${n}</div></div>`).join("")}</div>
      <div class="st-row"><button class="btn primary" data-run="start" ${canRun && !R.active ? "" : "disabled"}>▶ Start run-in</button><button class="btn warn" data-run="stop" ${R.active ? "" : "disabled"}>■ Stop</button><button class="btn" data-run="ack" title="acknowledge run-in alarms (after a trip)">Ack alarms</button>
        <span class="small muted">${canRun ? "" : "start/stop only in step 19 after Start step"}</span></div>
      ${R.waiting ? `<div class="st-refuse">Waiting for RUN-01 data – the stand PLC sends nothing (check proto / address in Devices).</div>` : ""}
      ${R.msg ? `<div class="small">Message: <b>${esc(R.msg)}</b></div>` : ""}
      <h4 class="st-h4">Rules (examples)</h4><ul class="st-rules">${(R.rules || []).map((r) => `<li class="${r.on ? "on" : ""}"><span class="st-rid">${esc(r.id)}</span> ${esc(r.n)} ${r.on ? "<b>← ACTIVE</b>" : ""}</li>`).join("")}</ul>
      ${profileChart(R.profile || [], R.step_i, R.active, 420, 130)}
    </div>
    <div class="st-charts">${runCharts(sm, R, W).join("")}<div class="small muted">1 sample every 5 s process time from /api/spst/runin + the live value. Limit lines are examples (bearing / grease maker gives the real ones).</div></div></div>`;
  if (changed("run", h)) $("stRun").innerHTML = h;
}

/* --- final test + record --- */
function renderFin() {
  const u = S.unit, det = $("stFinDet");
  const idx = steps().findIndex((s) => s.k === "runin");
  const rel = u && (u.si >= idx || !unitOpen(u));
  $("stFinSum").textContent = !u ? "no unit" : rel ? `${u.sn} · ${u.status}` : `available from step ${idx + 1}`;
  if (!rel) { if (changed("fin", "")) $("stFin").innerHTML = `<div class="small muted">The final test report appears from step ${idx + 1} (run-in).</div>`; return; }
  const keys = ["runin", "test", "pack"], res = u.results || {};
  const rows = steps().filter((s) => keys.includes(s.k)).flatMap((s) => s.checks.map((c) => { const r = res[c.id]; return `<tr class="st-r-${esc(r ? r.st : "pending")}"><td class="small">${s.no}</td><td>${esc(c.n)}</td><td class="st-v">${fmtV(c, r)}</td><td class="small">${esc(limits(c))}</td><td>${stChip(r ? r.st : "pending", r && r.st === "bad" && concession(u, c.id) ? "concession" : "")}</td><td>${r && r.src ? srcBadge(r.src) : ""}</td></tr>`; })).join("");
  const nBad = Object.values(res).filter((r) => r.st === "bad").length, nWarn = Object.values(res).filter((r) => r.st === "warn").length;
  const verdict = u.status === "accepted" ? `<span class="st-chip st-ok">✓ ACCEPTED</span>` : u.status === "rejected" ? `<span class="st-chip st-bad">✗ REJECTED</span>` : `<span class="st-chip st-pending">in work – step ${u.si + 1}</span>`;
  const h = `<div class="st-row">${verdict} <span class="small">unit <b>${esc(u.sn)}</b> · ${esc(u.wo)} · shaft ${esc(u.shaft_sn)} · ${u.signed.length} signatures · ${nBad} bad · ${nWarn} warn · ${u.ncr.length} NCR</span>
      <a class="btn" href="${API}/unit?sn=${encodeURIComponent(u.sn)}" download="${esc(u.sn)}_assembly_record.json">⬇ Assembly record (JSON)</a><a class="btn ghost" href="${API}/export.csv" download>⬇ CSV (all units)</a></div>
    <div class="st-scroll-x"><table class="st-tbl"><thead><tr><th>Step</th><th>Check</th><th>Value</th><th>Limits (example)</th><th>Status</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  if (changed("fin", h)) $("stFin").innerHTML = h;
}

/* --- devices --- */
function fillDevSelect() { $("stDevId").innerHTML = S.devices.map((d) => `<option value="${esc(d.id)}">${esc(d.id)} ${esc(d.n)}</option>`).join(""); fillDevForm(); }
function renderDevs() {
  const now = S.t || Date.now() / 1000, dv = S.devices || [];
  const cnt = (st) => dv.filter((d) => d.state === st).length;
  $("stDevSum").textContent = `${dv.length} devices · ${cnt("online")} online · ${cnt("sim")} simulated · ${cnt("offline")} offline${dv.some((d) => d.err && d.state !== "sim") ? " · errors!" : ""}`;
  if (!$("stDevDet").open) return;
  const need = new Set(); const u = S.unit; if (u && unitOpen(u)) steps()[u.si].checks.forEach((c) => { if (c.dev) need.add(c.dev); });
  const h = `<div class="st-scroll-x"><table class="st-tbl st-devt"><thead><tr><th></th><th>Device</th><th>Protocol</th><th>Address</th><th>State</th><th>Last values</th><th>Last seen</th><th></th></tr></thead><tbody>` +
    dv.map((d) => { const st = d.err && d.state !== "sim" ? "error" : d.state;
      return `<tr class="${need.has(d.id) ? "st-need" : ""}"><td><span class="st-led st-led-${esc(st)}" title="${esc(st)}"></span></td><td><b>${esc(d.id)}</b><div class="small muted">${esc(d.n)}${need.has(d.id) ? " · <b>used in this step</b>" : ""}</div></td>
        <td>${esc(d.proto)}${d.enabled ? "" : ' <span class="small muted">(disabled)</span>'}</td><td class="small">${esc(d.addr || (d.proto === "sim" ? "–" : "default"))}</td>
        <td><span class="st-dst st-dst-${esc(st)}">${esc(st)}</span>${d.err && d.state !== "sim" ? `<div class="small st-bad-t">${esc(d.err)}</div>` : ""}</td>
        <td class="small">${Object.keys(d.last || {}).length ? Object.entries(d.last).map(([k, v]) => `${esc(k)} = <b>${esc(num(v))}</b>`).join(" · ") : `<span class="muted">${esc((d.values || []).join(", "))}</span>`}</td>
        <td class="small st-nw">${esc(ago(d.seen, now))}</td><td><button class="btn ghost st-sm" data-dev="${esc(d.id)}">edit</button></td></tr>`; }).join("") + `</tbody></table></div>
    <div class="small muted">LED: <span class="st-led st-led-online"></span> online (real data in the last 10 s) · <span class="st-led st-led-sim"></span> simulated · <span class="st-led st-led-offline"></span> offline (no data) · <span class="st-led st-led-error"></span> error. Highlighted rows = devices the current step waits for.</div>`;
  if (changed("devs", h)) $("stDevs").innerHTML = h;
}

/* --- history + SPC --- */
function maybeUnits() { const k = JSON.stringify([S.kpi.units, S.kpi.accepted, S.kpi.rejected, S.unit && S.unit.sn]); if (k !== ui.unitsKey) { ui.unitsKey = k; loadUnits(); if ($("stHistDet").open) loadSpc(); } $("stHistSum").textContent = `${S.kpi.units} units · ${S.kpi.accepted} accepted`; }
async function loadUnits() {
  if (!started || !$("stHistDet") || !$("stHistDet").open) return;
  try { ui.units = await api(API + "/units"); } catch (e) { return; }
  const h = `<table class="st-tbl st-click"><thead><tr><th>Serial</th><th>Work order</th><th>Status</th><th>Started</th><th>Lead time</th><th>NCR</th><th>First pass</th></tr></thead><tbody>` +
    ui.units.map((x) => `<tr data-sn="${esc(x.sn)}" class="${ui.histSn === x.sn ? "sel" : ""}"><td><b>${esc(x.sn)}</b><div class="small muted">${esc(x.shaft_sn)}</div></td><td class="small">${esc(x.wo)}</td><td>${stChip(x.status === "accepted" ? "ok" : x.status === "rejected" ? "bad" : "pending", x.status)}</td><td class="small">${esc(dt(x.started))}</td><td class="small">${x.lead_h !== null ? num(x.lead_h, 2) + " h" : "–"}</td><td>${x.ncr}</td><td>${x.fpy === null ? "–" : x.fpy ? "✓ yes" : "✗ no"}</td></tr>`).join("") + `</tbody></table>`;
  $("stUnits").innerHTML = ui.units.length ? h : `<div class="small muted">no units yet</div>`;
}
function fillSpcSelect() {
  const opts = steps().flatMap((s) => s.checks.filter((c) => c.kind === "num").map((c) => `<option value="${esc(c.id)}">${s.no} · ${esc(c.n)}${c.unit ? " [" + esc(c.unit) + "]" : ""}${c.lo === null && c.hi === null ? " (info)" : ""}</option>`));
  $("stSpcSel").innerHTML = opts.join(""); $("stSpcSel").value = ui.spcId;
}
async function loadSpc() {
  if (!$("stHistDet").open) return;
  let d; try { d = await api(`${API}/spc?id=${encodeURIComponent(ui.spcId)}`); } catch (e) { $("stSpc").innerHTML = `<div class="small st-bad-t">SPC not available: ${esc(e.message)}</div>`; return; }
  ui.spc = d;
  const pts = d.values.map((p, i) => { const bad = (d.lo !== null && p.v < d.lo) || (d.hi !== null && p.v > d.hi); return [i + 1, p.v, bad ? "var(--critical)" : "var(--st-s1)", p.sn]; });
  const hl = [];
  if (d.lo !== null) hl.push({ y: d.lo, n: "lower limit " + num(d.lo) });
  if (d.hi !== null) hl.push({ y: d.hi, n: "upper limit " + num(d.hi) });
  if (d.mean !== null) hl.push({ y: d.mean, n: "mean " + num(d.mean), c: "var(--muted)", dash: false, right: true });
  if (d.mean !== null && d.sigma) { hl.push({ y: d.mean + 3 * d.sigma, n: "+3σ", c: "var(--muted)", right: true }); hl.push({ y: d.mean - 3 * d.sigma, n: "−3σ", c: "var(--muted)", right: true }); }
  const ch = d.n ? lineChart({ title: d.name, unit: d.unit, w: 560, h: 220, xl: "unit no.", x0: 0.5, x1: Math.max(1.5, d.n + 0.5), series: [{ n: "value", c: "var(--st-s1)", pts, dots: true, lab: true, u: d.unit }], hl }) : `<div class="small muted">no values yet for this check</div>`;
  const cpkTxt = d.cpk === null ? "–" : num(d.cpk, 2), cpkCls = d.cpk === null ? "" : d.cpk >= 1.33 ? "st-ok" : d.cpk >= 1.0 ? "st-warn" : "st-bad";
  $("stSpc").innerHTML = ch + `<div class="st-row st-spcs"><span>n = <b>${d.n}</b></span><span>mean = <b>${val(d.mean, d.unit)}</b></span><span>σ = <b>${val(d.sigma, d.unit)}</b></span><span>Cp = <b>${d.cp === null ? "–" : num(d.cp, 2)}</b></span><span>Cpk = <span class="st-chip ${cpkCls}">${cpkTxt}</span></span></div>
    <div class="small muted">Cpk = min(upper − mean, mean − lower) / (3 σ). ≥ 1.33 good, 1.0–1.33 watch, &lt; 1.0 not capable (usual rule – check your customer). ${esc(d.note || "")} Example values.</div>`;
}
async function loadUnit(sn) {
  ui.histSn = sn; $("stUnits").querySelectorAll("tr[data-sn]").forEach((r) => r.classList.toggle("sel", r.dataset.sn === sn));
  const el = $("stUnitDet"); el.innerHTML = `<div class="small muted">loading ${esc(sn)}…</div>`;
  let d, rs; try { [d, rs] = await Promise.all([api(`${API}/unit?sn=${encodeURIComponent(sn)}`), api(`${API}/runin?sn=${encodeURIComponent(sn)}`)]); } catch (e) { el.innerHTML = `<div class="st-refuse">${esc(e.message)}</div>`; return; }
  const u = d.unit, stepName = (k) => { const s = steps().find((x) => x.k === k); return s ? `${s.no} ${s.n}` : k; };
  const res = d.results.map((r) => `<tr class="st-r-${esc(r.st)} ${r.superseded ? "st-sup" : ""}"><td class="small">${esc(stepName(r.step).split(" ")[0])}</td><td>${esc(r.n)}<div class="small muted">${esc(r.id)}${r.superseded ? " · replaced (rework)" : ""}</div></td><td class="st-v">${esc(num(r.v))} ${esc(r.unit || "")}</td><td>${stChip(r.st)}</td><td>${srcBadge(r.src)}</td><td class="small">${esc(tm(r.t))} ${esc(r.user || "")}</td></tr>`).join("");
  const sig2 = d.signatures.map((s) => `<tr><td class="small">${esc(stepName(s.step))}</td><td>${esc(s.user)}</td><td>${esc(s.role)}</td><td class="small">${esc(dt(s.t))}</td></tr>`).join("");
  const ncr = d.ncr.map((n) => `<tr><td>${esc(n.id)}</td><td class="small">${esc(n.check)}</td><td>${esc(n.decision)}</td><td class="small">${esc(n.text)}</td><td class="small">${esc(n.user)} (${esc(n.role)})</td><td>${n.closed ? "closed" : "open"}</td></tr>`).join("");
  const ev = d.events.map((e) => `<div class="st-li"><span class="small muted">${esc(dt(e.t))}</span><span class="st-lt">${esc(e.text)}</span><span class="small muted">${esc(e.user)}</span></div>`).join("");
  const dl = d.device_log.slice(0, 60).map((l) => `<tr><td class="small">${esc(tm(l.t))}</td><td class="st-nw">${esc(l.device)}</td><td class="small">${esc(Object.entries(l.values).map(([k, v]) => `${k}=${num(v)}`).join(" "))}</td><td class="small">${esc(l.src)}</td><td class="small">${esc(l.mapped || "")}</td></tr>`).join("");
  const W = Math.max(300, Math.min(560, (el.clientWidth - 40) / 2));
  el.innerHTML = `<div class="st-udet"><div class="card-head"><h3 class="st-h3">Unit ${esc(u.sn)} – ${esc(u.status)}</h3><span class="small">${esc(u.wo)} · shaft ${esc(u.shaft_sn)} · started ${esc(dt(u.started))} · lead time ${u.lead_h !== null ? num(u.lead_h, 2) + " h" : "–"}</span>
      <a class="btn st-sm" href="${API}/unit?sn=${encodeURIComponent(u.sn)}" download="${esc(u.sn)}_assembly_record.json">⬇ record JSON</a></div>
    <div class="st-hist"><div><h4 class="st-h4">Results (${d.results.length})</h4><div class="st-scroll"><table class="st-tbl"><thead><tr><th>Step</th><th>Check</th><th>Value</th><th>Status</th><th>Source</th><th>Time · user</th></tr></thead><tbody>${res}</tbody></table></div></div>
      <div><h4 class="st-h4">Signatures (${d.signatures.length})</h4><div class="st-scroll st-scroll-s"><table class="st-tbl"><thead><tr><th>Step</th><th>User</th><th>Role</th><th>Time</th></tr></thead><tbody>${sig2}</tbody></table></div>
        <h4 class="st-h4">NCRs (${d.ncr.length})</h4>${d.ncr.length ? `<table class="st-tbl"><thead><tr><th>NCR</th><th>Check</th><th>Decision</th><th>Text</th><th>By</th><th></th></tr></thead><tbody>${ncr}</tbody></table>` : '<div class="small muted">none</div>'}
        <h4 class="st-h4">Run-in (run ${rs.run || "–"} of ${(rs.runs || []).length})</h4>${rs.samples.length ? runCharts(rs.samples, null, W).slice(0, 2).join("") : '<div class="small muted">no run-in data</div>'}</div></div>
    <div class="st-hist"><div><h4 class="st-h4">Events (audit trail, ${d.events.length})</h4><div class="st-scroll st-list">${ev}</div></div>
      <div><h4 class="st-h4">Device log (newest ${Math.min(60, d.device_log.length)} of ${d.device_log.length})</h4><div class="st-scroll"><table class="st-tbl"><thead><tr><th>Time</th><th>Device</th><th>Values</th><th>Source</th><th>Mapped to</th></tr></thead><tbody>${dl}</tbody></table></div></div></div></div>`;
}

/* ------------------------------------------------------------------ 3D (lazy) */
let localGeo = null;
async function geoFallback() {   // G, M, R, PK when item 2 was never rendered
  if (localGeo) return localGeo;
  try { const [sp, as] = await Promise.all([import("./spindle.js"), import("./asmsp.js")]); const M = { ...sp.SP_DEF }, R = sp.spCalc(M), PK = as.packCalc(R); localGeo = { M, R, PK, G: as.spAsmGeom(R.g, M, PK) }; } catch (e) { console.error("spst 3D geometry", e); }
  return localGeo;
}
function get3dState() {
  if (!S || !window.asmSP) return null;
  const base = window.asmSP.state(), u = S.unit, st = simSteps();
  const si = u ? u.si : 0, k = st[si] ? st[si].k : "kit";
  const geo = base.G ? {} : localGeo || {};
  const F = {}; if (S.sim.on) S.sim.faults.forEach((f) => { F[f] = true; });
  const res = (u && u.results) || {}, rv = (id) => (res[id] && res[id].st !== "pending" ? res[id].v : "");
  const ids = { ...(base.ids || {}), spu: u ? u.sn : "–", shaft: u ? u.shaft_sn : "", setF: rv("kit.set_front") || (base.ids || {}).setF, setR: rv("kit.set_rear") || (base.ids || {}).setR, motor: rv("kit.motor_kit") || (base.ids || {}).motor };
  const devs = {}; (S.devices || []).forEach((d) => { devs[d.id] = { state: d.state, last: d.last }; });
  const R = S.runin, runOn = R && (R.active || R.run) && (k === "runin" || k === "test");
  const uu = !u ? 0 : u.step_state === "idle" ? 0 : u.step_state === "running" ? (u.u || 0) : 1;
  return { ...base, ...geo, k, si, ori: st[si] ? st[si].ori : "c", no: si + 1, n: st[si] ? st[si].n : "", u: uu, F, ids, visible: true, cut: $("st3dCut").checked,
    live: { rpm: runOn ? R.rpm : null, T: runOn ? { front: R.T.front, rear: R.T.rear, stator: R.T.stator } : {}, vib: runOn ? R.vib : null, devices: devs } };
}
async function toggle3d() {
  const el = $("st3d"); el.hidden = !el.hidden; $("st3dBtn").textContent = el.hidden ? "Show 3D view" : "Hide 3D view";
  if (el.hidden || el.dataset.on) return;
  el.dataset.on = "1";
  if (!window.asmSP) { el.innerHTML = `<div class="st-refuse">The 3D view needs the spindle assembly model (Assembly item 2, asmsp.js) – it is not loaded.</div>`; return; }
  if (!window.asmSP.state().G) await geoFallback();
  try { const m = await import("./asmsp3d.js"); ui.d3 = m.create(el, get3dState); } catch (e) { el.innerHTML = `<div class="st-refuse">3D view failed: ${esc(e.message)}</div>`; console.error(e); }
}
if (new URLSearchParams(location.search).has("st3d")) setTimeout(() => { if (started && $("st3d").hidden) toggle3d(); }, 1500);
