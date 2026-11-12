/* Communication tab, view "SCADA explained": what SCADA does, and a small working SCADA screen on the live
   twin data (line overview, faceplate with tags and signal scaling, alarm list with acknowledge, trend, scan cycle).
   Uses globals from app.js: $, esc, fmtTime, STATES, STATE_VAR, active. Commands are shown only, never sent.
   PLC addresses, signal ranges and the alarm rules are example values. */
"use strict";

(() => {
  let S = null, sel = null, built = false, test = false, trendPts = [], cmdMsg = null;
  // teaching: fake bearing damage = extra vibration on one machine, rises while the box is ticked, falls after
  let dmgId = null, dmg = 0;
  const vibOf = (m) => (m.sensors.vibration_avg_mm_s || 0) + (m.id === dmgId ? dmg : 0);
  const alarms = new Map(); // key -> {key, m, name, level, text, on, off, ack}
  const history = [];        // cleared + acknowledged alarms (newest first)
  const shown = () => active === "comm" && !$("cmScada").hidden;
  const f = (v, d = 1) => (v == null ? "–" : (+v).toFixed(d));

  // ---------------------------------------------------------------- static explanation
  $("scWhat").innerHTML = `
    <p class="sc-def"><b>SCADA = Supervisory Control And Data Acquisition.</b> It is the <b>control-room software</b>.
      It reads the values of all PLCs every second, shows the whole factory on one screen, raises alarms, records
      history and lets the operator send commands. <b>The PLC controls the machine</b> (in milliseconds);
      <b>SCADA watches all machines and supervises</b> (in seconds). If SCADA stops, the machines keep running – you only become blind.</p>
    <div class="sc-place">
      <div class="sc-pl cm-L3"><span class="cm-tag cm-L3">L3</span> <b>MES</b> – work orders, serial numbers, quality</div>
      <div class="sc-arr"><span>▼ orders, recipes</span><span>▲ machine states, counts, results</span></div>
      <div class="sc-pl cm-L2 me"><span class="cm-tag cm-L2">L2</span> <b>SCADA</b> – screens, alarms, trends, historian, operator commands</div>
      <div class="sc-arr"><span>▼ commands, set points (OPC UA Write / Call)</span><span>▲ tag values every 0.1–1 s (OPC UA subscription)</span></div>
      <div class="sc-pl cm-L1"><span class="cm-tag cm-L1">L1</span> <b>PLC / CNC</b> – controls the machine in milliseconds</div>
      <div class="sc-arr"><span>▼ outputs: motor, valve</span><span>▲ inputs: 4–20 mA, 24 V, IO-Link</span></div>
      <div class="sc-pl cm-L0"><span class="cm-tag cm-L0">L0</span> <b>Sensors and actuators</b></div>
    </div>
    <h3>The 5 jobs of SCADA</h3>
    <div class="sc-jobs">
      ${[["1", "Acquire data", "Read every <b>tag</b> (one named value, e.g. <code>HMC-02.Temperature</code>) from every PLC.",
          "16 machines × 8 tags = 128 values every second"],
        ["2", "Display", "Show the line as a <b>mimic</b> diagram and one <b>faceplate</b> per machine.",
          "Modern screens are grey; colour only when something is wrong (ISA-101)"],
        ["3", "Alarm", "Compare values with limits. Operator must <b>acknowledge</b> every alarm.",
          "alarm ON if value ≥ limit · OFF if value < limit − deadband"],
        ["4", "Record (historian)", "Store values with a time stamp for trends and analysis.",
          "store only if |new − last stored| > deadband"],
        ["5", "Supervisory control", "Operator commands and set points go down to the PLC.",
          "Write HMC-02.FeedOverride = 90 % → PLC answers Good"]]
        .map(([n, t, d, ex]) => `<div class="sc-job"><span class="sc-n">${n}</span><b>${t}</b><p>${d}</p><code class="sc-ex">${ex}</code></div>`).join("")}
    </div>
    <h3>SCADA compared with its neighbours</h3>
    <div class="table-wrap"><table>
      <tr><th></th><th>PLC / CNC (L1)</th><th>SCADA (L2)</th><th>MES (L3)</th></tr>
      <tr><td>Main question</td><td>How do I move this axis now?</td><td>What is happening in the whole factory right now?</td><td>Which order, which unit, which quality?</td></tr>
      <tr><td>Thinks in</td><td>signals, I/O bits</td><td><b>tags</b> (named values), alarms</td><td>work orders, serial numbers</td></tr>
      <tr><td>Time scale</td><td>1–10 ms</td><td>0.1–1 s</td><td>minutes – hours</td></tr>
      <tr><td>Example</td><td>spindle on, clamp closed</td><td>HMC-02 vibration 4.8 mm/s → alarm</td><td>WO-0012: 17 of 23 done</td></tr>
      <tr><td>Typical products</td><td>Siemens S7, Fanuc, Beckhoff</td><td>WinCC, Ignition, AVEVA, FactoryTalk</td><td>Opcenter, MPDV, Critical Manufacturing</td></tr>
      <tr><td>In this twin</td><td>twin/model.py (simulated)</td><td><b>Live factory tab</b> + this screen + data/history.db</td><td>MES and FMS tabs</td></tr>
    </table></div>`;

  // ---------------------------------------------------------------- tags of one machine
  // analog 4-20 mA:  I = 4 + 16·(v − lo)/(hi − lo)   PLC raw = 27648·(v − lo)/(hi − lo)  (Siemens analog card)
  const KEYS = Object.keys(STATES);
  function tags(m, i) {
    const s = m.sensors, base = 64 + i * 8, db = 10 + i, out = [];
    const ana = (name, v, lo, hi, unit, addr, d = 1) => {
      const r = v == null ? null : Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
      out.push({ name, addr, sig: r == null ? "–" : `${f(4 + 16 * r, 2)} mA`, raw: r == null ? "–" : Math.round(27648 * r),
        val: f(v, d), unit, range: `${lo}–${hi} ${unit}` });
    };
    out.push({ name: "State", addr: `DB${db}.DBW0`, sig: "PLC logic", raw: KEYS.indexOf(m.state), val: (STATES[m.state].short || STATES[m.state].label), unit: "", range: "0 = Running …" });
    ana("Temperature", s.temperature_c, 0, 150, "°C", `%IW${base}`);
    out.push({ name: "Vibration", addr: `IO-Link port 1`, sig: "IO-Link", raw: Math.round(vibOf(m) * 10),
      val: f(vibOf(m), 2), unit: "mm/s", range: "raw × 0.1" });
    out.push({ name: "Power", addr: "Modbus 40021", sig: "power meter", raw: Math.round((s.power_kw || 0) * 100), val: f(s.power_kw), unit: "kW", range: "raw × 0.01" });
    if (m.type === "cnc") out.push({ name: "SpindleSpeed", addr: "CNC var #4119", sig: "CNC", raw: s.spindle_rpm, val: (s.spindle_rpm || 0).toLocaleString(), unit: "rpm", range: "" });
    if (s.tool_wear_pct > 0) out.push({ name: "ToolWear", addr: "CNC var #5001", sig: "CNC", raw: Math.round(s.tool_wear_pct * 10), val: f(s.tool_wear_pct), unit: "%", range: "raw × 0.1" });
    if (s.flow_m3_h != null) ana("AirFlow", s.flow_m3_h, 0, 40, "m³/h", `%IW${base + 2}`, 2);
    if (s.pressure_bar != null) ana("Pressure", s.pressure_bar, 0, 16, "bar", `%IW${base + 4}`, 2);
    out.push({ name: "GoodCount", addr: `DB${db}.DBD4`, sig: "PLC counter", raw: m.counters.good, val: m.counters.good, unit: "pcs", range: "" });
    out.push({ name: "ScrapCount", addr: `DB${db}.DBD8`, sig: "PLC counter", raw: m.counters.scrap, val: m.counters.scrap, unit: "pcs", range: "" });
    return out;
  }

  // ---------------------------------------------------------------- alarm engine (ISA-18.2 style life cycle)
  const DB_VIB = 0.3, DB_TEMP = 2; // deadbands: an alarm goes OFF only below limit − deadband
  function conditions(m) {
    const s = m.sensors, L = m.limits, c = [];
    const on = (key) => alarms.has(m.id + key) && !alarms.get(m.id + key).off;
    const vib = vibOf(m), va = L.vib_alarm, vw = L.vib_warn, tl = L.temp_c;
    if (m.state === "DOWN") c.push(["down", "critical", "Breakdown – machine stopped"]);
    if (vib >= va || (on("vibHH") && vib >= va - DB_VIB)) c.push(["vibHH", "serious", `Vibration HIGH-HIGH ${f(vib, 2)} mm/s (limit ${f(va, 2)})`]);
    else if (vib >= vw || (on("vibH") && vib >= vw - DB_VIB)) c.push(["vibH", "warning", `Vibration HIGH ${f(vib, 2)} mm/s (limit ${f(vw, 2)})`]);
    if (s.temperature_c >= tl || (on("temp") && s.temperature_c >= tl - DB_TEMP)) c.push(["temp", "serious", `Temperature HIGH ${f(s.temperature_c)} °C (limit ${f(tl)})`]);
    if ((s.tool_wear_pct || 0) >= 90) c.push(["tool", "warning", `Tool wear ${f(s.tool_wear_pct)} % – change tool soon`]);
    return c;
  }
  function runAlarms() {
    const t = S.sim_time, seen = new Set();
    for (const m of S.machines) {
      for (const [k, level, text] of conditions(m)) {
        const key = m.id + k;
        seen.add(key);
        const a = alarms.get(key);
        if (!a || a.off) alarms.set(key, { key, m: m.id, name: m.name, level, text, on: t, off: null, ack: false });
        else a.text = text;
      }
    }
    for (const a of alarms.values()) {
      if (!seen.has(a.key) && !a.off) a.off = t;
      if (a.off && a.ack) { history.unshift(a); alarms.delete(a.key); }
    }
    history.length = Math.min(history.length, 6);
  }
  const mAlarm = (id) => {
    let worst = null;
    const rank = { warning: 1, serious: 2, critical: 3 };
    for (const a of alarms.values()) if (a.m === id && !a.off && (!worst || rank[a.level] > rank[worst])) worst = a.level;
    return worst;
  };

  // ---------------------------------------------------------------- rendering
  function build() {
    const lines = [...new Set(S.machines.map((m) => m.line))];
    $("scMimic").innerHTML = lines.map((ln) => `<div class="sc-line"><div class="sc-ln">${esc(ln)}</div><div class="sc-ms">` +
      S.machines.filter((m) => m.line === ln).map((m) => `<button class="sc-m" data-id="${m.id}">
        <span class="sc-m-h"><b>${esc(m.id)}</b><i class="sc-st"></i></span>
        <span class="sc-m-v" data-v></span></button>`).join('<i class="sc-flow">›</i>') + `</div></div>`).join("");
    built = true;
  }
  function renderMimic() {
    for (const m of S.machines) {
      const el = $("scMimic").querySelector(`.sc-m[data-id="${m.id}"]`);
      if (!el) { built = false; return; }
      const st = STATES[m.state], al = mAlarm(m.id);
      const chip = el.querySelector(".sc-st");
      chip.textContent = `${st.icon} ${st.short || st.label}`;
      chip.style.setProperty("--sc", `var(${STATE_VAR[m.state]})`);
      el.classList.toggle("abn", ["DOWN", "BLOCKED", "STARVED", "MAINTENANCE", "SETUP"].includes(m.state));
      el.dataset.al = al || "";
      el.classList.toggle("sel", m.id === sel);
      const s = m.sensors;
      el.querySelector("[data-v]").innerHTML = `${f(s.temperature_c)} °C · ${f(vibOf(m), 1)} mm/s<br>${f(s.power_kw)} kW · ${m.counters.good} pcs`
        + (al ? `<span class="sc-albadge lv-${al}">${al === "warning" ? "▲" : "!"} alarm</span>` : "");
    }
  }
  function renderFace() {
    const i = S.machines.findIndex((x) => x.id === sel), m = S.machines[i];
    if (!m) { $("scFace").innerHTML = ""; return; }
    const T = tags(m, i), temp = T.find((x) => x.name === "Temperature");
    const r = Math.max(0, Math.min(1, m.sensors.temperature_c / 150));
    $("scFace").innerHTML = `
      <div class="sc-fh"><b>Faceplate ${esc(m.id)}</b> <span class="muted small">${esc(m.name)}</span>
        <span class="sc-st" style="--sc:var(${STATE_VAR[m.state]})">${STATES[m.state].icon} ${STATES[m.state].short || STATES[m.state].label}</span></div>
      <div class="table-wrap"><table class="sc-tags">
        <tr><th>Tag</th><th>PLC address</th><th>Signal</th><th class="num">PLC raw</th><th class="num">Value</th><th>Quality</th></tr>
        ${T.map((x) => `<tr><td class="nowrap"><code>${esc(m.id)}.${x.name}</code></td><td class="nowrap small">${esc(x.addr)}</td>
          <td class="nowrap small">${esc(x.sig)}</td><td class="num small">${x.raw}</td>
          <td class="num nowrap"><b>${esc(x.val)}</b> ${esc(x.unit)}</td><td class="sc-good">${m.state === "OFFLINE" ? "Bad" : "Good"}</td></tr>`).join("")}
      </table></div>
      <div class="sc-scale"><b>How a value travels (temperature, range 0–150 °C, 4–20 mA):</b><br>
        sensor ${f(m.sensors.temperature_c)} °C → current I = 4 + 16 × ${f(m.sensors.temperature_c)}/150 = <b>${temp.sig}</b>
        → PLC analog card raw = 27648 × ${f(r, 3)} = <b>${temp.raw}</b> → SCADA scales back = 150 × ${temp.raw}/27648 = <b>${f(m.sensors.temperature_c)} °C</b></div>
      <div class="sc-cmds"><b>Operator commands</b>
        <button class="mini" data-cmd="feed">Feed override 90 %</button>
        <button class="mini" data-cmd="stop">Stop at end of cycle</button>
        <button class="mini" data-cmd="reset">Reset fault</button></div>
      ${cmdMsg && cmdMsg.id === m.id ? `<pre class="csim-code sc-cmdout">${cmdMsg.html}</pre>` : ""}`;
  }
  function renderAlarms() {
    const list = [...alarms.values()].sort((a, b) => b.on - a.on);
    const act = list.filter((a) => !a.off).length, unack = list.filter((a) => !a.ack).length;
    $("scAlmCount").textContent = `${act} active · ${unack} not acknowledged`;
    const stateTxt = (a) => !a.off ? (a.ack ? "ACTIVE · acknowledged" : "ACTIVE · not acknowledged") : "CLEARED · not acknowledged";
    const row = (a, old) => `<tr class="lv-${a.level}${!a.ack && !old ? " sc-blink" : ""}${old ? " sc-old" : ""}">
      <td class="nowrap small">${fmtTime(a.on).replace("T+ ", "")}</td><td class="nowrap"><b>${esc(a.m)}</b></td>
      <td><span class="sc-lv lv-${a.level}">${a.level}</span> ${esc(a.text)}</td>
      <td class="nowrap small">${old ? `cleared + acknowledged` : stateTxt(a)}</td>
      <td>${!a.ack && !old ? `<button class="mini" data-ack="${esc(a.key)}">Ack</button>` : ""}</td></tr>`;
    $("scAlarms").innerHTML = `<tr><th>Since</th><th>Machine</th><th>Alarm</th><th>State</th><th></th></tr>` +
      (list.length ? list.map((a) => row(a, false)).join("") : `<tr><td colspan="5" class="muted">✔ No active alarms. Tick the teaching box to see how alarms work.</td></tr>`) +
      history.map((a) => row(a, true)).join("");
  }
  function renderTrend() {
    const m = S.machines.find((x) => x.id === sel);
    const host = $("scTrend");
    $("scTrendT").textContent = m ? `${m.id} vibration, last ${trendPts.length} samples${trendPts.length > 1 ? ` (every ${Math.round(trendPts[trendPts.length - 1][0] - trendPts[trendPts.length - 2][0])} s of twin time)` : ""}` : "";
    if (!m || trendPts.length < 2) { host.innerHTML = `<p class="muted small">Collecting data…</p>`; return; }
    const W = 520, H = 170, p = { l: 36, r: 8, t: 8, b: 18 };
    const xs = trendPts.map((q) => q[0]), ys = trendPts.map((q) => q[2]);
    const warn = m.limits.vib_warn, alm = m.limits.vib_alarm;
    const hi = Math.max(...ys, warn) * 1.15, x0 = xs[0], x1 = xs[xs.length - 1];
    const X = (v) => p.l + ((v - x0) / (x1 - x0 || 1)) * (W - p.l - p.r), Y = (v) => H - p.b - (v / hi) * (H - p.t - p.b);
    const lim = (v, c, t) => v <= hi ? `<line x1="${p.l}" x2="${W - p.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(${c})" stroke-dasharray="4 4"/>
      <text x="${W - p.r}" y="${Y(v) - 3}" text-anchor="end" class="sc-tt">${t} ${f(v, 2)}</text>` : "";
    const ticks = [0, hi / 2, hi].map((v) => `<line x1="${p.l}" x2="${W - p.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--grid)"/>
      <text x="${p.l - 5}" y="${Y(v) + 4}" text-anchor="end" class="sc-tt">${f(v, 1)}</text>`).join("");
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="sc-svg" role="img" aria-label="Vibration trend of ${esc(m.id)}">
      ${ticks}${lim(warn, "--warning", "HIGH")}${lim(alm, "--critical", "HIGH-HIGH")}
      <polyline fill="none" stroke="var(--series)" stroke-width="2" stroke-linejoin="round"
        points="${trendPts.map((q) => `${X(q[0]).toFixed(1)},${Y(q[2]).toFixed(1)}`).join(" ")}"/>
      <text x="${p.l}" y="${H - 3}" class="sc-tt">${fmtTime(x0).replace("T+ ", "")}</text>
      <text x="${W - p.r}" y="${H - 3}" text-anchor="end" class="sc-tt">${fmtTime(x1).replace("T+ ", "")}</text></svg>
      <p class="muted small">mm/s · the historian stores a value with its time stamp; dashed lines = SCADA alarm limits${dmg > 0 ? ". The simulated bearing damage is not stored in the historian" : ""}.</p>`;
  }

  // ---------------------------------------------------------------- scan cycle animation
  const CYCLE = [
    ["Read", "OPC UA subscription: the PLCs send the tags that changed", () => `${S ? S.machines.length * 8 : 128} tags`],
    ["Scale", "raw number → engineering unit", () => "27648 → 150 °C"],
    ["Check limits", "compare with alarm limits, start / clear alarms", () => `${[...alarms.values()].filter((a) => !a.off).length} active`],
    ["Update screen", "colours, values, alarm list", () => "mimic + faceplates"],
    ["Historian", "store value + time stamp if it changed more than the deadband", () => "data/history.db"],
    ["Commands", "operator commands and set points → PLC", () => "OPC UA Write / Call"],
  ];
  $("scCycle").innerHTML = CYCLE.map(([t, d], i) => `<div class="sc-cy" data-i="${i}"><span class="sc-n">${i + 1}</span><b>${t}</b>
      <span class="small">${d}</span><code class="sc-ex" data-x></code></div>`).join('<i class="sc-cy-arr">→</i>') +
    `<div class="sc-cy-loop">↺ back to 1 – one full cycle takes 0.1–1 s in a real SCADA (in this twin: 1 s)</div>`;
  let cyc = 0;
  setInterval(() => {
    if (!shown()) return;
    cyc = (cyc + 1) % CYCLE.length;
    document.querySelectorAll(".sc-cy").forEach((el, i) => {
      el.classList.toggle("on", i === cyc);
      el.querySelector("[data-x]").textContent = CYCLE[i][2]();
    });
  }, 700);

  // ---------------------------------------------------------------- data + events
  async function loadTrend() {
    if (!sel || !shown()) return;
    try {
      const r = await fetch("/api/trend?machine=" + encodeURIComponent(sel));
      trendPts = ((await r.json()).points || []).slice(-120);
      if (S) renderTrend();
    } catch (e) { /* server restarting */ }
  }
  setInterval(loadTrend, 3000);

  function render() {
    if (!S || !shown()) return;
    if (!built) build();
    renderMimic();
    if (!built) { build(); renderMimic(); }
    renderFace();
    renderAlarms();
    renderTrend();
    $("scSub").textContent = `${fmtTime(S.sim_time)} · ${S.machines.length} PLCs · live`;
  }
  window.renderScada = (s) => {
    S = s;
    if (!sel) sel = (s.machines.find((m) => m.id === "HMC-02") || s.machines[0]).id;
    if (test) { if (dmgId !== sel) { dmgId = sel; dmg = 0; } dmg = Math.min(9, dmg + 0.6); }
    else if (dmg > 0) dmg = Math.max(0, dmg - 0.8);
    runAlarms();
    render();
  };
  window.scadaShown = () => { trendPts = []; render(); loadTrend(); };
  const _prev = window.onTabShown;
  window.onTabShown = (name) => { if (_prev) _prev(name); if (name === "comm" && !$("cmScada").hidden) window.scadaShown(); };

  $("scMimic").addEventListener("click", (e) => {
    const b = e.target.closest(".sc-m");
    if (!b) return;
    sel = b.dataset.id; trendPts = []; cmdMsg = null;
    render(); loadTrend();
  });
  $("scFace").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cmd]");
    if (!b || !S) return;
    const m = S.machines.find((x) => x.id === sel), id = esc(sel);
    const down = m && m.state === "DOWN";
    const msg = {
      feed: `[[v:Write]] [[n:${id}.FeedOverride]] = [[d:90]] %\n[[a:← StatusCode Good]]   [[c:the CNC now runs 10 % slower]]`,
      stop: `[[v:Call]] [[n:${id}.StopAtCycleEnd]]()\n[[a:← StatusCode Good]]   [[c:PLC finishes the part, then stops]]`,
      reset: down ? `[[v:Call]] [[n:${id}.ResetFault]]()\n[[a:← Bad_ConditionNotMet]]   [[c:the PLC refuses: repair first (safety!)]]`
        : `[[v:Call]] [[n:${id}.ResetFault]]()\n[[a:← StatusCode Good]]   [[c:no fault active, nothing to reset]]`,
    }[b.dataset.cmd];
    cmdMsg = { id: sel, html: "<span class=\"g-c\">teaching preview – OPC UA message SCADA → PLC (not sent to the twin)</span>\n" +
      msg.replace(/\[\[([evndac]):([\s\S]*?)\]\]/g, '<span class="g-$1">$2</span>') };
    renderFace();
  });
  $("scAlarms").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ack]");
    if (!b) return;
    const a = alarms.get(b.dataset.ack);
    if (a) a.ack = true;
    if (S) { runAlarms(); renderAlarms(); }
  });
  $("scAckAll").addEventListener("click", () => {
    for (const a of alarms.values()) a.ack = true;
    if (S) { runAlarms(); renderAlarms(); renderMimic(); }
  });
  if (new URLSearchParams(location.search).get("sctest")) { test = true; $("scTest").checked = true; }
  $("scTest").addEventListener("change", (e) => {
    test = e.target.checked;
    if (S) { runAlarms(); render(); }
  });
})();
