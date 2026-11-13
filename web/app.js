/* Digital Twin dashboard - plain JavaScript (3D view lives in factory3d.js). */
"use strict";

const STATES = {
  RUNNING:     { label: "Running",     icon: "▶" },
  SETUP:       { label: "Changeover (setup to another model)", short: "Setup", icon: "⇄" },
  STARVED:     { label: "Starved (waiting for parts)", short: "Starved", icon: "◌" },
  BLOCKED:     { label: "Blocked (output full)", short: "Blocked", icon: "▣" },
  DOWN:        { label: "Down (breakdown)", short: "Down", icon: "✖" },
  MAINTENANCE: { label: "Maintenance", icon: "⚙" },
  STOPPED:     { label: "Stopped", icon: "■" },
  OFFLINE:     { label: "Offline (no data)", short: "Offline", icon: "?" },
};
const STATE_VAR = {
  RUNNING: "--good", SETUP: "--setup", STARVED: "--warning", BLOCKED: "--serious", DOWN: "--critical",
  MAINTENANCE: "--maint", STOPPED: "--idle", OFFLINE: "--idle",
};
// product models (FMS) from the config: id -> {sku, name, color, ...}
let PRODUCTS = {};
const pdot = (v) => `<i class="pdot" style="background:${(PRODUCTS[v] && PRODUCTS[v].color) || "var(--idle)"}"></i>`;
const pchip = (v, long) => v ? `<span class="pchip">${pdot(v)}${esc(long && PRODUCTS[v] ? PRODUCTS[v].sku : v)}</span>` : "–";
function fillProductSelects() {
  const ps = Object.values(PRODUCTS);
  document.querySelectorAll("select[data-products]").forEach((s) => {
    if (s.options.length) return;
    if (!ps.length) { s.hidden = true; return; }
    s.innerHTML = ps.map((p) => `<option value="${esc(p.id)}">${esc(p.sku)} · ${esc(p.name.replace(/^V-compressor\s*/, ""))}</option>`).join("");
    const def = ps.reduce((a, b) => ((b.mix || 0) > (a.mix || 0) ? b : a), ps[0]);
    s.value = def.id;
  });
}
const $ = (id) => document.getElementById(id);
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const pct = (x, d = 0) => (x * 100).toFixed(d) + "%";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

let snap = null;
let selected = null;
let config = null;
let view3d = null;

function fmtTime(s) {
  s = Math.floor(s);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600),
        m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n) => String(n).padStart(2, "0");
  return (d ? `Day ${d + 1} ` : "T+ ") + `${p(h)}:${p(m)}:${p(sec)}`;
}
function toast(msg) {
  const t = $("toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2500);
}
async function post(url, body) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}
async function command(body) {
  try { const j = await post("/api/command", body); toast(j.message); }
  catch (e) { toast("Error: " + e.message); }
}

/* ------------------------------------------------------------------ tabs */
function showTab(name) {
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x.dataset.tab === name));
  document.querySelectorAll(".tabpane").forEach((p) => p.classList.toggle("active", p.id === "tab-" + name));
  if (name === "live") drawCharts();
  if (window.onTabShown) window.onTabShown(name);
}
document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
  history.replaceState(null, "", "#" + b.dataset.tab);
  showTab(b.dataset.tab);
}));
const TABS = ["live", "fms", "order", "mes", "erp", "scada", "cnc", "hmc", "asm", "apc", "mech", "agv", "robot", "asrs", "inst", "hyd", "bsf", "am", "comm", "whatif", "learn"];
window.addEventListener("load", () => { if (TABS.includes(location.hash.slice(1))) showTab(location.hash.slice(1)); });

/* ------------------------------------------------------- 3D / 2D switch */
function showView(v) {
  document.querySelectorAll(".seg-btn[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
  $("view3d").hidden = v !== "3d";
  $("view2d").hidden = v !== "2d";
  try { localStorage.setItem("twin.view", v); } catch (e) { /* storage blocked */ }
}
document.querySelectorAll(".seg-btn[data-view]").forEach((b) => b.addEventListener("click", () => showView(b.dataset.view)));
try {
  const v = new URLSearchParams(location.search).get("view") || localStorage.getItem("twin.view");
  if (v === "2d") showView("2d");
} catch (e) { /* storage blocked */ }
document.querySelectorAll("[data-cam]").forEach((b) => b.addEventListener("click", () => view3d && view3d.setView(b.dataset.cam)));
$("focusBtn").addEventListener("click", () => view3d && selected && view3d.focus(selected));
$("colorMode").addEventListener("change", (e) => view3d && view3d.setColorMode(e.target.value));
$("labelsOn").addEventListener("change", (e) => view3d && view3d.setLabels(e.target.checked));
try {
  const b = new URLSearchParams(location.search).get("building") || localStorage.getItem("twin.building");
  if (b === "0") $("buildingOn").checked = false;
} catch (e) { /* storage blocked */ }
function setMouse(mode) {
  document.querySelectorAll("[data-mouse]").forEach((b) => b.classList.toggle("active", b.dataset.mouse === mode));
  if (view3d) view3d.setMouseMode(mode);
  try { localStorage.setItem("twin.mouse", mode); } catch (e) { /* storage blocked */ }
}
document.querySelectorAll("[data-mouse]").forEach((b) => b.addEventListener("click", () => setMouse(b.dataset.mouse)));
$("keyHelpClose").addEventListener("click", () => {
  $("keyHelp").hidden = true;
  try { localStorage.setItem("twin.keyhelp", "0"); } catch (e) { /* storage blocked */ }
});
try { if (localStorage.getItem("twin.keyhelp") === "0") $("keyHelp").hidden = true; } catch (e) { /* storage blocked */ }
$("buildingOn").addEventListener("change", (e) => {
  if (view3d) view3d.setBuilding(e.target.checked);
  try { localStorage.setItem("twin.building", e.target.checked ? "1" : "0"); } catch (err) { /* storage blocked */ }
});

/* -------------------------------------------------------------- controls */
$("speed").addEventListener("change", (e) => command({ action: "time_scale", value: +e.target.value }));
$("pauseBtn").addEventListener("click", () => command({ action: snap && snap.paused ? "resume" : "pause" }));
$("resetBtn").addEventListener("click", () => {
  if (confirm("Restart the simulation from zero? Counters and trends will be cleared.")) command({ action: "reset" });
});
document.querySelectorAll(".actions [data-act]").forEach((b) =>
  b.addEventListener("click", () => selected && command({ action: b.dataset.act, machine: selected })));
$("spd").addEventListener("input", (e) => ($("spdVal").textContent = e.target.value + "%"));
$("spd").addEventListener("change", (e) => selected && command({ action: "set_speed", machine: selected, value: +e.target.value }));

/* ---------------------------------------------------------------- legend */
function legendHTML(keys) {
  return keys.map((k) => `<span><i class="sw" style="background:var(${STATE_VAR[k]})"></i>${STATES[k].short || STATES[k].label}</span>`).join("");
}
$("stateLegend").innerHTML = legendHTML(["RUNNING", "SETUP", "STARVED", "BLOCKED", "DOWN", "MAINTENANCE", "STOPPED"]);

/* ------------------------------------------------------------------ KPIs */
function renderKpis(k) {
  const tiles = [
    ["Factory OEE", pct(k.line_oee, 1), "world class ≈ 85%"],
    ["Output last hour", k.throughput_last_hour, `ideal ${k.ideal_throughput_per_h.toFixed(1)} units/h`],
    ["Finished units", k.finished_good.toLocaleString(), `avg ${k.avg_throughput_per_h.toFixed(1)} /h`],
    ["Scrap rate", pct(k.scrap_rate, 1), `${k.scrap} parts scrapped / rejected`],
    ["Work in progress", k.wip, "parts inside factory"],
    ["Energy per unit", k.kwh_per_good_part.toFixed(1) + " kWh", `now ${k.power_kw.toFixed(0)} kW`],
    ["Bottleneck", k.bottleneck_name || nameOf(k.bottleneck) || "–", "improve this first"],
  ];
  const e = snap && snap.erp;
  if (e) tiles.push(["Order backlog", e.backlog_units, `${e.open_orders} open orders · ${e.late_orders ? `<b class="neg">${e.late_orders} late</b>` : "0 late"}`]);
  $("kpis").innerHTML = tiles.map(([l, v, n]) =>
    `<div class="kpi"><div class="label">${l}</div><div class="value${String(v).length > 9 ? " text" : ""}">${v}</div><div class="note">${n}</div></div>`).join("");
}
function nameOf(id) {
  const m = snap && snap.machines.find((x) => x.id === id);
  return m ? m.name : id;
}

/* -------------------------------------------------------- 2D schematic */
let floorBuilt = false;
function buildFloor() {
  const ms = snap.machines;
  const bufs = Object.fromEntries(snap.buffers.map((b) => [b.id, b]));
  const bufCol = (items) => `<div class="bufcol">${items.map(({ id, qty }) => `
    <div class="buffer${bufs[id].finished || bufs[id].infinite || bufs[id].store ? " end" : ""}" data-buf="${id}"><div class="box">
      <div class="cnt">–</div><div class="fill"><i></i></div></div>
      <div class="bn-name">${esc(bufs[id].name)}${qty > 1 ? ` <b>×${qty}</b>` : ""}</div></div>`).join("")}</div>`;
  const stCard = (m) => `<div class="station" id="st-${m.id}" data-id="${m.id}" tabindex="0">
      <span class="bn" hidden>BOTTLENECK</span>${m.external ? '<span class="ext">LIVE</span>' : ""}
      <div class="nm">${esc(m.name)}</div><div class="id">${m.id} · cycle ${m.cycle_time_s}s</div>
      <div class="badge"></div><div class="prog"><i></i></div>
      <div class="row"><span>Temp</span><b class="f-t"></b></div>
      <div class="row"><span>Vibration</span><b class="f-v"></b></div>
      <div class="row"><span>OEE</span><b class="f-o"></b></div>
      <div class="row"><span>Health</span><b class="f-h"></b></div>
      <div class="hbar"><i class="f-hb"></i></div>
      <div class="reason"></div></div>`;
  const lines = [...new Set(ms.map((m) => m.line || "Line"))];
  $("floor").innerHTML = lines.map((line) => {
    const groups = [];
    ms.filter((m) => (m.line || "Line") === line).forEach((m) => {
      const sig = m.output + "|" + m.inputs.map((i) => i.buffer + ":" + i.qty).join(",");
      const g = groups[groups.length - 1];
      if (g && g.sig === sig) g.ms.push(m); else groups.push({ sig, ms: [m] });
    });
    let row = "", prevOut = null;
    groups.forEach((g, gi) => {
      const ins = g.ms[0].inputs.filter((i) => i.buffer !== prevOut).map((i) => ({ id: i.buffer, qty: i.qty }));
      if (ins.length) row += bufCol(ins);
      row += `<div class="stcol">${g.ms.map(stCard).join("")}</div>`;
      const out = g.ms[0].output;
      const next = groups[gi + 1] && groups[gi + 1].ms[0].inputs.find((i) => i.buffer === out);
      row += bufCol([{ id: out, qty: next ? next.qty : 1 }]);
      prevOut = out;
    });
    return `<div class="line-row"><div class="line-name">${esc(line)}</div><div class="floor">${row}</div></div>`;
  }).join("");
  document.querySelectorAll(".station").forEach((el) => {
    el.addEventListener("click", () => select(el.dataset.id));
    el.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && select(el.dataset.id));
  });
  floorBuilt = true;
}
function setState(el, state) {
  Object.keys(STATES).forEach((s) => el.classList.remove("st-" + s));
  el.classList.add("st-" + state);
}
function renderFloor() {
  if (!floorBuilt) buildFloor();
  snap.buffers.forEach((b) => {
    $("floor").querySelectorAll(`[data-buf="${b.id}"]`).forEach((el) => {
      const store = b.finished || b.store;
      el.querySelector(".cnt").textContent = b.infinite ? "∞" : b.count;
      const fill = b.infinite ? 1 : store ? 0 : b.count / b.capacity;
      el.querySelector(".fill i").style.width = pct(fill);
      el.querySelector(".fill").style.visibility = store ? "hidden" : "visible";
      el.classList.toggle("full", !b.infinite && !store && b.count >= b.capacity);
      el.classList.toggle("empty", !!b.store && b.count === 0);
      el.title = b.infinite ? b.name : store ? `${b.name}: ${b.count} in stock${b.asrs ? " (" + b.asrs + ")" : ""}`
        : `${b.name}: ${b.count} / ${b.capacity}${b.incoming ? ` (+${b.incoming} on the way)` : ""}`;
    });
  });
  snap.machines.forEach((m) => {
    const el = $("st-" + m.id);
    if (!el) return;
    setState(el, m.state);
    el.classList.toggle("selected", m.id === selected);
    const st = STATES[m.state];
    el.querySelector(".badge").textContent = `${st.icon} ${st.short || st.label}`;
    el.querySelector(".prog i").style.width = m.state === "RUNNING" ? pct(Math.min(1, m.progress)) : "0%";
    el.querySelector(".f-t").textContent = m.sensors.temperature_c.toFixed(1) + " °C";
    el.querySelector(".f-v").textContent = m.sensors.vibration_avg_mm_s.toFixed(2) + " mm/s";
    el.querySelector(".f-o").textContent = pct(m.oee.oee);
    el.querySelector(".f-h").textContent = m.health.index.toFixed(0) + " / 100";
    const hb = el.querySelector(".f-hb");
    hb.style.width = m.health.index + "%";
    hb.style.background = `var(--${m.health.level === "good" ? "good" : m.health.level === "warning" ? "warning" : "critical"})`;
    el.querySelector(".reason").textContent = m.reason && m.state !== "STOPPED" ? m.reason : "";
    el.querySelector(".bn").hidden = snap.kpis.bottleneck !== m.id;
  });
}

/* ---------------------------------------------------------------- detail */
function select(id) {
  selected = id;
  const m = snap.machines.find((x) => x.id === id);
  if (!m) return;
  $("spd").value = m.speed_pct; $("spdVal").textContent = m.speed_pct + "%";
  renderFloor(); renderDetail(); loadTrend();
  if (view3d) view3d.select(id);
}
function sensorTile(label, val, unit, lim, level) {
  return `<div class="sensor ${level || ""}"><div class="l">${label}</div>
    <div class="v">${val} <small>${unit}</small></div><div class="lim">${lim || "&nbsp;"}</div></div>`;
}
function renderDetail() {
  const m = snap.machines.find((x) => x.id === selected);
  if (!m) return;
  $("dTitle").textContent = `${m.name} (${m.id})`;
  const b = $("dState"); setState(b, m.state);
  b.textContent = `${STATES[m.state].icon} ${STATES[m.state].label}`;
  const s = m.sensors, L = m.limits;
  const vl = s.vibration_avg_mm_s >= L.vib_alarm ? "alert" : s.vibration_avg_mm_s >= L.vib_warn ? "warnb" : "";
  const tiles = [];
  if (m.test) {
    const t = m.test;
    const last = t.last_flow_m3_h;
    tiles.push(sensorTile("Air flow (FAD)", (s.flow_m3_h ?? 0).toFixed(2), "m³/h", `spec ${t.spec_flow_m3_h} · min ${t.min_flow_m3_h}`));
    tiles.push(sensorTile("Test pressure", (s.pressure_bar ?? 0).toFixed(2), "bar", ""));
    const lmin = t.last_min_m3_h ?? t.min_flow_m3_h;
    tiles.push(sensorTile("Last unit result", last == null ? "–" : last.toFixed(2), "m³/h",
      last == null ? "" : last >= lmin ? `✔ PASS (min ${lmin})` : `✖ FAIL (min ${lmin})`, last != null && last < lmin ? "alert" : ""));
  }
  tiles.push(
    sensorTile("Temperature", s.temperature_c.toFixed(1), "°C", `limit ${L.temp_c} °C`, s.temperature_c > L.temp_c ? "alert" : ""),
    sensorTile("Vibration (avg)", s.vibration_avg_mm_s.toFixed(2), "mm/s", `warn ${L.vib_warn} · alarm ${L.vib_alarm}`, vl),
    sensorTile("Power", s.power_kw.toFixed(1), "kW", ""));
  if (s.spindle_rpm > 0 || m.type === "cnc") tiles.push(sensorTile("Spindle speed", s.spindle_rpm.toLocaleString(), "rpm", ""));
  if (s.tool_wear_pct > 0) tiles.push(sensorTile("Tool wear", s.tool_wear_pct.toFixed(1), "%", "change at 100%", s.tool_wear_pct >= 85 ? "warnb" : ""));
  const ideal = (m.fms && m.fms.cycle_now_s) || m.cycle_time_s + m.handling_s;
  tiles.push(sensorTile("Good / scrap", `${m.counters.good} / ${m.counters.scrap}`, "", `last cycle ${m.last_cycle_s}s (ideal now ${Math.round(ideal)}s)`));
  if (m.handling_s > 0) tiles.push(sensorTile("Part handling", m.handling_s, "s / part",
    m.pallet_changer ? "automatic pallet changer" : "manual load / unload"));
  if (m.item) tiles.push(sensorTile("Current part", `<span style="font-size:14px">${esc(m.item.id)}</span>`, "",
    (m.item.v ? `model ${pchip(m.item.v)} · ` : "") + (m.item.wo ? "work order " + esc(m.item.wo) : "")));
  const F = m.fms;
  if (F && (F.setup_s || F.mag_sets)) {
    if (m.state === "SETUP") tiles.push(sensorTile("Changeover", F.setup_left_s, "s left", `to model ${esc(F.model || "")}`, "warnb"));
    tiles.push(sensorTile("Changeovers", F.setups, "", `${F.setup_h} h in setup${F.setup_s ? ` · ${F.setup_s} s each` : ""}`));
    if (F.mag_sets) tiles.push(sensorTile("Tool magazine", `<span class="tools">${[...Array(F.mag_sets).keys()].map((i) =>
      F.tools[i] ? `<span class="tool">${pdot(F.tools[i])}${esc(F.tools[i])}</span>` : `<span class="tool empty">empty</span>`).join("")}</span>`, "",
      `other model: tool exchange ${Math.round(F.tool_load_s / 60)} min`));
  }
  if (F && F.cycle_v && Object.keys(F.cycle_v).length > 1) tiles.push(sensorTile("Cycle per model",
    `<span style="font-size:13px">${Object.entries(F.cycle_v).map(([v, s]) => `${pdot(v)}${Math.round(s)} s`).join(" ")}</span>`, "",
    F.set_up_for ? `set up for ${esc(F.set_up_for)}` : ""));
  $("dSensors").innerHTML = tiles.join("");

  const h = m.health;
  const col = h.level === "good" ? "var(--good)" : h.level === "warning" ? "var(--warning)" : "var(--critical)";
  const lvl = h.level === "good" ? "✔ Good" : h.level === "warning" ? "▲ Watch" : "✖ Act now";
  const rul = [];
  if (h.tool_rul_parts != null) rul.push(`Tool life left: <b>${h.tool_rul_parts}</b> parts (~${h.tool_rul_h.toFixed(1)} h)`);
  if (h.vib_to_alarm_h != null && h.vib_to_alarm_h < 48) rul.push(`Vibration alarm expected in <b>${h.vib_to_alarm_h.toFixed(1)} h</b>`);
  $("dHealth").innerHTML = `<div class="l" style="font-size:12px;color:var(--text-2)">Health index · predictive maintenance</div>
    <div class="big">${h.index.toFixed(0)} <small>/ 100 · ${lvl}</small></div>
    <div class="hbar"><i style="width:${h.index}%;background:${col}"></i></div>
    <div class="rul">${rul.join("<br>") || "No degradation trend detected"}</div>
    <div class="rec"><b>Advice:</b> ${esc(h.recommendation)}</div>`;

  const o = m.oee;
  $("dOee").innerHTML = [["Availability", o.availability], ["Performance", o.performance], ["Quality", o.quality], ["OEE", o.oee]]
    .map(([l, v], i) => `<div class="m ${i === 3 ? "total" : ""}"><div class="l">${l}<b>${pct(v, 1)}</b></div>
      <div class="hbar"><i style="width:${v * 100}%"></i></div></div>`).join("");
}

/* ---------------------------------------------------------------- charts */
let trend = [];
async function loadTrend() {
  if (!selected) return;
  try {
    const r = await fetch("/api/trend?machine=" + encodeURIComponent(selected));
    trend = (await r.json()).points || [];
    drawCharts();
  } catch (e) { /* server restarting */ }
}
setInterval(loadTrend, 2000);

const charts = {};
function chart(id) {
  if (charts[id]) return charts[id];
  const host = $(id);
  const cv = document.createElement("canvas");
  host.appendChild(cv);
  const c = { host, cv, data: [], opt: {}, hover: null };
  cv.addEventListener("mousemove", (e) => {
    const r = cv.getBoundingClientRect();
    c.hover = e.clientX - r.left; draw(c, e);
  });
  cv.addEventListener("mouseleave", () => { c.hover = null; $("tooltip").hidden = true; draw(c); });
  charts[id] = c;
  return c;
}
function drawCharts() {
  if (!selected || !snap) return;
  const m = snap.machines.find((x) => x.id === selected);
  if (!m) return;
  const pts = (i) => trend.map((p) => [p[0], p[i]]);
  setChart("cTemp", pts(1), { unit: "°C", lines: [{ v: m.limits.temp_c, label: "limit", c: "--critical" }] });
  setChart("cVib", pts(2), { unit: "mm/s", lines: [{ v: m.limits.vib_warn, label: "warning", c: "--warning" }, { v: m.limits.vib_alarm, label: "alarm", c: "--critical" }] });
  setChart("cPow", pts(3), { unit: "kW", lines: [] });
}
function setChart(id, data, opt) { const c = chart(id); c.data = data; c.opt = opt; draw(c); }

function niceTicks(lo, hi, n = 4) {
  const span = hi - lo || 1, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= step0);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}
function draw(c, ev) {
  const dpr = window.devicePixelRatio || 1;
  const W = c.host.clientWidth, H = c.host.clientHeight;
  if (!W) return;
  c.cv.width = W * dpr; c.cv.height = H * dpr;
  const g = c.cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  g.font = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";
  const d = c.data;
  if (d.length < 2) {
    g.fillStyle = css("--muted"); g.fillText("Collecting data…", 8, H / 2); return;
  }
  const pad = { l: 40, r: 10, t: 8, b: 20 };
  const xs = d.map((p) => p[0]), ys = d.map((p) => p[1]);
  const x0 = xs[0], x1 = xs[xs.length - 1];
  let lo = Math.min(...ys), hi = Math.max(...ys);
  // show a threshold line only when it is near the data, so the trend stays readable
  c.opt.lines.forEach((l) => { if (l.v <= hi * 1.6 + 1) hi = Math.max(hi, l.v); });
  const m = (hi - lo) * 0.1 || 1;
  lo -= m; hi += m;
  if (Math.min(...ys) >= 0 && lo < 0) lo = 0;
  const X = (v) => pad.l + ((v - x0) / (x1 - x0 || 1)) * (W - pad.l - pad.r);
  const Y = (v) => H - pad.b - ((v - lo) / (hi - lo || 1)) * (H - pad.t - pad.b);

  g.strokeStyle = css("--grid"); g.lineWidth = 1; g.fillStyle = css("--muted"); g.textAlign = "right"; g.textBaseline = "middle";
  niceTicks(lo, hi).forEach((v) => {
    const y = Math.round(Y(v)) + 0.5;
    g.beginPath(); g.moveTo(pad.l, y); g.lineTo(W - pad.r, y); g.stroke();
    g.fillText(v, pad.l - 6, y);
  });
  g.textBaseline = "top";
  [x0, (x0 + x1) / 2, x1].forEach((v, i) => {
    g.textAlign = ["left", "center", "right"][i];
    g.fillText(fmtTime(v).replace("T+ ", ""), i === 0 ? pad.l : i === 2 ? W - pad.r : X(v), H - pad.b + 5);
  });
  c.opt.lines.forEach((l) => {
    if (l.v > hi || l.v < lo) return;
    const y = Math.round(Y(l.v)) + 0.5;
    g.setLineDash([4, 4]); g.strokeStyle = css(l.c); g.lineWidth = 1;
    g.beginPath(); g.moveTo(pad.l, y); g.lineTo(W - pad.r, y); g.stroke(); g.setLineDash([]);
    g.fillStyle = css("--text-2"); g.textAlign = "right"; g.textBaseline = "bottom";
    g.fillText(l.label, W - pad.r, y - 2);
  });
  g.strokeStyle = css("--series"); g.lineWidth = 2; g.lineJoin = "round";
  g.beginPath();
  d.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))));
  g.stroke();
  const lp = d[d.length - 1];
  g.fillStyle = css("--series"); g.strokeStyle = css("--surface"); g.lineWidth = 2;
  g.beginPath(); g.arc(X(lp[0]), Y(lp[1]), 4, 0, 7); g.fill(); g.stroke();

  const tt = $("tooltip");
  if (c.hover != null && c.hover >= pad.l) {
    const tv = x0 + ((c.hover - pad.l) / (W - pad.l - pad.r)) * (x1 - x0);
    let best = d[0];
    for (const p of d) if (Math.abs(p[0] - tv) < Math.abs(best[0] - tv)) best = p;
    const hx = Math.round(X(best[0])) + 0.5;
    g.strokeStyle = css("--axis"); g.lineWidth = 1;
    g.beginPath(); g.moveTo(hx, pad.t); g.lineTo(hx, H - pad.b); g.stroke();
    g.fillStyle = css("--series"); g.strokeStyle = css("--surface"); g.lineWidth = 2;
    g.beginPath(); g.arc(hx, Y(best[1]), 4, 0, 7); g.fill(); g.stroke();
    if (ev) {
      tt.innerHTML = `<div class="tt-t">${fmtTime(best[0])}</div><b>${best[1]}</b> ${c.opt.unit}`;
      tt.hidden = false;
      const tw = tt.offsetWidth;
      tt.style.left = Math.min(ev.clientX + 12, window.innerWidth - tw - 8) + "px";
      tt.style.top = ev.clientY - 40 + "px";
    }
  }
}
window.addEventListener("resize", drawCharts);
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", drawCharts);
window.addEventListener("themechange", drawCharts);

/* ------------------------------------------------------- alarms / events */
function renderAlarms() {
  const a = snap.alarms;
  $("alarmCount").textContent = a.length;
  const ic = { critical: "!", serious: "!", warning: "▲" };
  $("alarms").innerHTML = a.length ? a.map((x) =>
    `<li class="lv-${x.level}" data-id="${x.machine}"><span class="ic">${ic[x.level]}</span><span><span class="who">${esc(x.name)}</span> · ${x.level}<br>${esc(x.text)}</span></li>`).join("")
    : `<li class="empty">✔ No active alarms</li>`;
  $("events").innerHTML = snap.events.length ? snap.events.map((e) =>
    `<li class="lv-${e.level}" data-id="${e.machine}"><span class="t">${fmtTime(e.t).replace("T+ ", "")}</span><span>${esc(e.text)}</span></li>`).join("")
    : `<li class="empty">No events yet</li>`;
}
["alarms", "events"].forEach((id) => $(id).addEventListener("click", (e) => {
  const li = e.target.closest("li[data-id]");
  if (li) { select(li.dataset.id); if (view3d) view3d.focus(li.dataset.id); }
}));

/* -------------------------------------------------------------- stream */
function onSnapshot(s) {
  const first = !snap;
  snap = s;
  $("factoryName").textContent = s.factory_name;
  $("productName").textContent = "Product: " + s.product;
  document.title = "Digital Twin · " + s.factory_name;
  $("clock").textContent = fmtTime(s.sim_time);
  $("pauseBtn").textContent = s.paused ? "Resume" : "Pause";
  const sp = $("speed");
  if (document.activeElement !== sp) {
    if (![...sp.options].some((o) => +o.value === s.time_scale)) sp.add(new Option(s.time_scale + "x", s.time_scale));
    sp.value = String(s.time_scale);
  }
  renderKpis(s.kpis);
  if (first || s.machines.length !== document.querySelectorAll(".station").length) floorBuilt = false;
  renderFloor();
  if (window.renderMH) window.renderMH(s);
  if (window.renderScada) window.renderScada(s);
  if (window.onApcSnapshot) window.onApcSnapshot(s);
  if (view3d) view3d.update(s);
  if (first) select(s.kpis.bottleneck || s.machines[0].id);
  renderDetail();
  renderAlarms();
}
function connect() {
  const es = new EventSource("/api/stream");
  es.onopen = () => { $("conn").textContent = "● live"; $("conn").className = "conn ok"; };
  es.onmessage = (e) => { try { onSnapshot(JSON.parse(e.data)); } catch (err) { console.error(err); } };
  es.onerror = () => { $("conn").textContent = "● reconnecting"; $("conn").className = "conn bad"; };
}
fetch("/api/state").then((r) => r.json()).then((s) => { if (!snap && s.machines) onSnapshot(s); }).catch(() => {});
connect();

/* API used by the 3D view */
window.TwinUI = {
  select: (id) => select(id),
  attach3D(v) {
    view3d = v;
    v.setBuilding($("buildingOn").checked);
    let mm = "rotate";
    try { mm = localStorage.getItem("twin.mouse") || "rotate"; } catch (e) { /* storage blocked */ }
    setMouse(mm);
    if (snap) { v.update(snap); if (selected) v.select(selected); }
  },
};

/* ============================================================ WHAT-IF */
const WI_FIELDS = [
  ["cycle_time_s", "Cycle time (s)"], ["setup_s", "Changeover (s)"], ["mtbf_h", "MTBF (h)"], ["mttr_min", "MTTR (min)"],
  ["base_scrap_rate", "Scrap rate"], ["tool_wear_per_part_pct", "Tool wear/part (%)"],
];
async function buildWhatIf() {
  config = await (await fetch("/api/config")).json();
  PRODUCTS = Object.fromEntries((config.products || []).map((p) => [p.id, p]));
  fillProductSelects();
  // FMS: dispatching rule, batch size, product mix, machines that can be switched off, tool magazines, kanban sizes
  const fr = [];
  const fms = config.fms || {};
  if ((config.products || []).length) {
    const rule = fms.rule || "FIFO";
    fr.push(["Dispatching rule", `<select data-fms="rule" data-orig="${rule}">${["FIFO", "EDD", "SPT", "SETUP"].map((r) =>
      `<option${r === rule ? " selected" : ""}>${r}</option>`).join("")}</select>`, "which model starts next"]);
    fr.push(["Batch size (SETUP rule)", `<input type="number" min="1" step="1" data-fms="max_batch" value="${fms.max_batch || 10}" data-orig="${fms.max_batch || 10}">`, "units of one model in a row"]);
    config.products.forEach((p) => fr.push([`${pdot(p.id)}${esc(p.sku)}: share of the mix`,
      `<input type="number" min="0" step="0.05" data-mix="${p.id}" value="${p.mix}" data-orig="${p.mix}">`, "0.3 = 30%"]));
  }
  const sig = (s) => s.output + "|" + (s.inputs || []).map((i) => i.buffer + ":" + (i.qty || 1)).join(",");
  config.stations.forEach((s) => {
    if (config.stations.some((o) => o !== s && sig(o) === sig(s)))
      fr.push([`${esc(s.name)} in use`, `<input type="checkbox" data-en="${s.id}" data-orig="1" checked>`, "off = machine removed"]);
  });
  const mag = config.stations.find((s) => s.tool_magazine);
  if (mag) {
    fr.push(["Tool sets per magazine (machining centers)", `<input type="number" min="1" max="3" step="1" data-tools="tool_sets" value="${mag.tool_magazine.sets}" data-orig="${mag.tool_magazine.sets}">`, "3 = tools of every model"]);
    fr.push(["Tool-set exchange time", `<input type="number" min="0" step="30" data-tools="tool_load_s" value="${mag.tool_magazine.load_s}" data-orig="${mag.tool_magazine.load_s}">`, "s"]);
  }
  config.stations.filter((s) => s.kanban).forEach((s) => {
    const sm = config.buffers.find((b) => b.id === s.kanban.buffer);
    fr.push([`${esc(sm ? sm.name : s.kanban.buffer)}: kanban target`, `<input type="number" min="2" step="1" data-kb="${s.id}" value="${s.kanban.target}" data-orig="${s.kanban.target}">`, `${esc(sm ? sm.part : "")}s per model`]);
  });
  $("wiFms").innerHTML = fr.length ? `<tr><th>Item</th><th class="num">Value</th><th></th></tr>` +
    fr.map(([l, inp, u]) => `<tr><td>${l}</td><td class="num">${inp}</td><td class="muted">${u}</td></tr>`).join("")
    : `<tr><td class="muted">Only one product in this configuration</td></tr>`;
  $("wiStations").innerHTML = `<tr><th>Machine</th>${WI_FIELDS.map((f) => `<th class="num">${f[1]}</th>`).join("")}</tr>` +
    config.stations.map((s) => `<tr><td>${esc(s.name)}</td>${WI_FIELDS.map(([k]) =>
      `<td class="num"><input type="number" step="any" data-st="${s.id}" data-k="${k}" value="${s[k] ?? 0}" data-orig="${s[k] ?? 0}"></td>`).join("")}</tr>`).join("");
  $("wiBuffers").innerHTML = `<tr><th>Buffer</th><th class="num">Capacity</th></tr>` +
    config.buffers.filter((b) => !b.infinite && !b.finished && !b.store && !b.asrs).map((b) =>
      `<tr><td>${esc(b.name)}</td><td class="num"><input type="number" min="1" data-buf="${b.id}" value="${b.capacity}" data-orig="${b.capacity}"></td></tr>`).join("");
  // material handling: AGV fleet, AS/RS cranes, pallet pools, pallet changers
  const mh = [];
  const num = (key, val, step = "any") => `<input type="number" step="${step}" min="0" data-mh="${key}" value="${val}" data-orig="${val}">`;
  if (config.agv) {
    mh.push([`AGV fleet size`, num("agv:count", config.agv.count || 0, 1), "vehicles"]);
    mh.push([`AGV speed`, num("agv:speed_m_s", config.agv.speed_m_s || 1.2), "m/s"]);
  }
  (config.asrs || []).forEach((a) => mh.push([`${esc(a.name)}: crane cycle`, num(`asrs:${a.id}:crane_cycle_s`, a.crane_cycle_s), "s per move"]));
  (config.pools || []).forEach((p) => mh.push([`${esc(p.name)}`, num(`pool:${p.id}:count`, p.count, 1), "pallets"]));
  config.stations.filter((s) => s.pallet_changer || s.load_unload_s).forEach((s) => {
    const on = s.pallet_changer ? 1 : 0;
    mh.push([`${esc(s.name)}: pallet changer`, `<input type="checkbox" data-mh="pc:${s.id}" data-orig="${on}" ${on ? "checked" : ""}>`,
      `off = ${s.load_unload_s || 120} s manual load`]);
  });
  $("wiMH").innerHTML = mh.length ? `<tr><th>Item</th><th class="num">Value</th><th></th></tr>` +
    mh.map(([l, inp, u]) => `<tr><td>${l}</td><td class="num">${inp}</td><td class="muted">${u}</td></tr>`).join("")
    : `<tr><td class="muted">No material handling in this configuration</td></tr>`;
  document.querySelectorAll("table.wi input, table.wi select").forEach((i) =>
    i.addEventListener(i.type === "checkbox" || i.tagName === "SELECT" ? "change" : "input", () =>
      i.classList.toggle("changed", (i.type === "checkbox" ? (i.checked ? "1" : "0") : i.value) !== i.dataset.orig)));
}
buildWhatIf();

$("wiClear").addEventListener("click", () => document.querySelectorAll("table.wi input, table.wi select").forEach((i) => {
  if (i.type === "checkbox") i.checked = i.dataset.orig === "1"; else i.value = i.dataset.orig;
  i.classList.remove("changed");
}));
$("wiRun").addEventListener("click", async () => {
  const changes = { stations: {}, buffers: {}, agv: {}, asrs: {}, pools: {}, fms: {}, products: {} };
  document.querySelectorAll("table.wi .changed").forEach((i) => {
    if (i.dataset.fms) changes.fms[i.dataset.fms] = i.dataset.fms === "rule" ? i.value : +i.value;
    else if (i.dataset.mix) changes.products[i.dataset.mix] = { mix: +i.value };
    else if (i.dataset.en) (changes.stations[i.dataset.en] ||= {}).enabled = i.checked ? 1 : 0;
    else if (i.dataset.tools) config.stations.filter((s) => s.tool_magazine).forEach((s) => ((changes.stations[s.id] ||= {})[i.dataset.tools] = +i.value));
    else if (i.dataset.kb) (changes.stations[i.dataset.kb] ||= {}).kanban_target = +i.value;
    else if (i.dataset.st) (changes.stations[i.dataset.st] ||= {})[i.dataset.k] = +i.value;
    else if (i.dataset.buf) changes.buffers[i.dataset.buf] = { capacity: +i.value };
    else if (i.dataset.mh) {
      const [kind, a, b] = i.dataset.mh.split(":");
      if (kind === "agv") changes.agv[a] = +i.value;
      if (kind === "asrs") (changes.asrs[a] ||= {})[b] = +i.value;
      if (kind === "pool") (changes.pools[a] ||= {})[b] = +i.value;
      if (kind === "pc") (changes.stations[a] ||= {}).pallet_changer = i.checked ? 1 : 0;
    }
  });
  const btn = $("wiRun");
  btn.disabled = true; btn.textContent = "Simulating…";
  try {
    const r = await post("/api/whatif", { changes, hours: +$("wiHours").value, replications: +$("wiReps").value });
    renderWhatIf(r);
  } catch (e) { toast("Error: " + e.message); }
  btn.disabled = false; btn.textContent = "Run simulation";
});

function renderWhatIf(r) {
  $("wiResult").hidden = false;
  const g = $("wiGain");
  g.textContent = (r.gain_pct >= 0 ? "▲ +" : "▼ ") + r.gain_pct.toFixed(1) + "% finished units" +
    (r.gain_err_pct != null ? `  (± ${r.gain_err_pct.toFixed(1)}%)` : "");
  g.title = "± = standard error of the difference between the paired runs (same random events). " +
    "If the gain is smaller than about 2 × this value, it may be luck.";
  g.className = "gain " + (r.gain_pct > 0.5 ? "up" : r.gain_pct < -0.5 ? "down" : "");
  const B = r.baseline, S = r.scenario;
  const nm = (id) => (config.stations.find((s) => s.id === id) || {}).name
    || ((config.asrs || []).find((a) => a.id === id) || {}).name && `${config.asrs.find((a) => a.id === id).name} (crane)`
    || (id === "AGV-FLEET" ? "AGV fleet" : id);
  const rows = [
    ["Finished units", B.good.toFixed(0), S.good.toFixed(0), S.good - B.good, true],
    ...Object.keys(B.by_model || {}).map((v) => [`&nbsp;&nbsp;${pchip(v, true)}`, (B.by_model[v] || 0).toFixed(0),
      ((S.by_model || {})[v] || 0).toFixed(0), ((S.by_model || {})[v] || 0) - (B.by_model[v] || 0), true]),
    ["Changeovers (all stations)", B.setups.toFixed(0), S.setups.toFixed(0), S.setups - B.setups, false],
    ["Hours in changeover", B.setup_h.toFixed(1), S.setup_h.toFixed(1), S.setup_h - B.setup_h, false],
    ["Throughput (units/h)", B.throughput_per_h.toFixed(1), S.throughput_per_h.toFixed(1), S.throughput_per_h - B.throughput_per_h, true],
    ["Factory OEE", pct(B.line_oee, 1), pct(S.line_oee, 1), (S.line_oee - B.line_oee) * 100, true, " pts"],
    ["Scrap (parts)", B.scrap.toFixed(1), S.scrap.toFixed(1), S.scrap - B.scrap, false],
    ["Energy per unit (kWh)", B.kwh_per_good_part.toFixed(2), S.kwh_per_good_part.toFixed(2), S.kwh_per_good_part - B.kwh_per_good_part, false],
    ["Bottleneck", nm(B.bottleneck), nm(S.bottleneck), null],
  ];
  // utilization is neither good nor bad by itself, so no coloured change
  if (B.agv_util != null && config.agv) rows.push(["AGV fleet utilization", pct(B.agv_util, 0), pct(S.agv_util, 0), null]);
  Object.keys(B.asrs_util || {}).forEach((id) => {
    const a = (config.asrs || []).find((x) => x.id === id);
    rows.push([`${a ? a.name : id}: crane utilization`, pct(B.asrs_util[id], 0), pct(S.asrs_util[id], 0), null]);
  });
  $("wiCmp").innerHTML = `<tr><th>Result (${r.hours} h, avg of ${r.replications} runs)</th><th class="num">Current design</th><th class="num">Your scenario</th><th class="num">Change</th></tr>` +
    rows.map(([l, b, s, d, upGood, unit]) => {
      let dc = "";
      if (d != null && Math.abs(d) > 1e-6) {
        const good = upGood ? d > 0 : d < 0;
        dc = `<span class="delta ${good ? "up" : "down"}">${d > 0 ? "+" : ""}${Math.abs(d) < 1 ? d.toFixed(2) : d.toFixed(1)}${unit || ""}</span>`;
      }
      return `<tr><td>${l}</td><td class="num">${b}</td><td class="num">${s}</td><td class="num">${dc || "–"}</td></tr>`;
    }).join("");

  const keys = ["RUNNING", "SETUP", "STARVED", "BLOCKED", "DOWN"];
  $("wiLegend").innerHTML = legendHTML(keys);
  const bar = (st) => !st ? `<div class="stack"><span class="muted small" style="padding-left:6px">switched off</span></div>` :
    `<div class="stack">${keys.map((k) => st[k] > 0.001 ?
    `<i style="width:${st[k] * 100}%;background:var(${STATE_VAR[k]})" data-tip="${STATES[k].short || STATES[k].label}: ${pct(st[k], 1)}"></i>` : "").join("")}</div>`;
  $("wiBars").innerHTML = Object.keys(B.stations).map((id) => `
    <div class="wibar-row"><span class="who">${esc(nm(id))}</span><span class="tag">Current</span>${bar(B.stations[id])}</div>
    <div class="wibar-row"><span></span><span class="tag">Scenario</span>${bar(S.stations[id])}</div>`).join("");
  $("wiBars").querySelectorAll("[data-tip]").forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const tt = $("tooltip"); tt.textContent = el.dataset.tip; tt.hidden = false;
      tt.style.left = e.clientX + 12 + "px"; tt.style.top = e.clientY - 30 + "px";
    });
    el.addEventListener("mouseleave", () => ($("tooltip").hidden = true));
  });
}
