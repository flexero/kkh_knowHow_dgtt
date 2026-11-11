/* SCADA tab: plant overview + faceplates with real operator commands, alarm management (ack, shelve, comment,
   journal, performance), tag database with writable set points, historian trends, audit trail, shift report,
   alarm limit settings. Data: GET/POST /api/scada, GET /api/scada/trend.
   Uses globals from app.js / ops.js: $, esc, fmtTime, pct, num, kpiTiles, post, toast, STATES, STATE_VAR, active. */
"use strict";

(() => {
  let D = null, page = "overview", sel = null, faceTrend = [], pens = null, settingsBuilt = false;
  const SIGNALS = ["Temperature", "Vibration", "Power", "SpindleSpeed", "ToolWear", "GoodCount", "ScrapCount"];
  const LV = { critical: "!", serious: "!", warning: "▲" };
  const tm = (t) => (t == null ? "–" : fmtTime(t).replace("T+ ", ""));
  const dur = (s) => (s < 60 ? `${Math.round(s)} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`);
  const stName = (s) => (STATES[s] ? STATES[s].short || STATES[s].label : s);
  const chip = (s) => `<span class="sc-st" style="--sc:var(${STATE_VAR[s] || "--idle"})">${STATES[s] ? STATES[s].icon : ""} ${esc(stName(s))}</span>`;
  const lvTag = (l) => `<span class="sx-lv lv-${l}"><span class="ic">${LV[l]}</span>${l}</span>`;

  // ---------------------------------------------------------------- operator name
  const userIn = $("sxUser");
  try { userIn.value = localStorage.getItem("scadaUser") || "Operator 1"; } catch (e) { userIn.value = "Operator 1"; }
  userIn.addEventListener("change", () => { try { localStorage.setItem("scadaUser", userIn.value.trim()); } catch (e) { /* ignore */ } });
  const user = () => userIn.value.trim() || "Operator";

  async function act(body, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return;
    try { const j = await post("/api/scada", { ...body, user: user() }); toast(j.message); load(); }
    catch (e) { toast("Error: " + e.message); }
  }

  // ---------------------------------------------------------------- pages
  document.querySelectorAll("[data-scp]").forEach((b) => b.addEventListener("click", () => setPage(b.dataset.scp)));
  function setPage(p) {
    page = p;
    document.querySelectorAll("[data-scp]").forEach((x) => x.classList.toggle("active", x.dataset.scp === p));
    document.querySelectorAll(".sx-page").forEach((x) => { x.hidden = x.id !== "sxP-" + p; });
    try { localStorage.setItem("scadaPage", p); } catch (e) { /* ignore */ }
    if (p === "settings") settingsBuilt = false;
    if (D) render();
    if (p === "trends") loadTrends();
  }

  // ---------------------------------------------------------------- KPIs
  function renderKpis() {
    const k = D.kpis;
    $("sxKpis").innerHTML = kpiTiles([
      ["Machines running", `${k.running} / ${k.machines}`, `${k.down} down / maintenance · ${k.stopped} stopped by operator`],
      ["Active alarms", k.active, k.unack ? `<b class="neg">${k.unack} not acknowledged</b>` : "all acknowledged"],
      ["Alarm rate", `${k.rate_1h} / h`, `average ${k.rate_avg} / h · ${k.rate_1h > 6 ? `<b class="neg">above benchmark 6/h</b>` : "within benchmark (≤ 6/h)"}`],
      ["Standing / chattering", `${k.standing} / ${k.chattering}`, `shelved: ${k.shelved}`],
      ["Line OEE", pct(k.line_oee, 1), `power now ${num(k.power_kw, 1)} kW`],
    ]);
    const b = $("sxAlmBadge");
    b.hidden = !k.unack;
    b.textContent = k.unack;
    $("sxScan").textContent = `${fmtTime(D.sim_time)} · scan every ${D.scan_s} s · ${num(D.scans)} scans · ${D.tags.length} tags`;
  }

  // ---------------------------------------------------------------- overview
  function renderOverview() {
    const M = Object.fromEntries(D.machines.map((m) => [m.id, m]));
    $("sxMimic").innerHTML = D.lines.map((ln) => `<div class="sx-line">
      <div class="sx-line-h"><span class="sc-ln">${esc(ln.name)}</span>
        <span class="sx-line-b"><button class="mini" data-line="start" data-name="${esc(ln.name)}">Start line</button>
        <button class="mini ghost" data-line="stop" data-name="${esc(ln.name)}">Stop line</button></span></div>
      <div class="sc-ms">${ln.machines.map((id) => {
        const m = M[id];
        return `<button class="sc-m${m.id === sel ? " sel" : ""}${["DOWN", "STOPPED", "MAINTENANCE", "OFFLINE"].includes(m.state) ? " abn" : ""}"
          data-id="${m.id}" data-al="${m.alarm || ""}"><span class="sc-m-h"><b>${m.id}</b>${chip(m.state)}</span>
          <span class="sc-m-v">${m.temp} °C · ${m.vib} mm/s<br>${m.power} kW · ${m.good} pcs${m.speed !== 100 ? ` · <b>${m.speed}%</b>` : ""}</span>
          ${m.alarm ? `<span class="sc-albadge lv-${m.alarm}">${LV[m.alarm]} alarm</span>` : ""}</button>`;
      }).join('<i class="sc-flow">›</i>')}</div></div>`).join("");
    $("sxAux").innerHTML = D.buffers.filter((b) => b.store || b.cap).map((b) => {
      const f = b.cap ? b.count / b.cap : null;
      return `<div class="sx-buf${b.store && b.count === 0 ? " empty" : ""}" title="${esc(b.name)}"><span>${esc(b.id)}</span><b>${b.count}${b.cap ? ` / ${b.cap}` : ""}</b>
        ${f == null ? "" : `<div class="hbar"><i style="width:${Math.min(1, f) * 100}%"></i></div>`}</div>`;
    }).join("") + D.agvs.map((a) => `<div class="sx-buf${a.battery < 15 ? " empty" : ""}"><span>${a.id}</span><b>${a.battery} %</b>
        <div class="hbar ${a.battery < 25 ? "warnbar" : "goodbar"}"><i style="width:${a.battery}%"></i></div></div>`).join("");
    renderFace();
  }

  function renderFace() {
    const m = D.machines.find((x) => x.id === sel);
    if (!m) { $("sxFace").innerHTML = `<p class="muted">Click a machine.</p>`; return; }
    // operator is moving the speed slider: do not rebuild the faceplate under the mouse
    if (document.activeElement && document.activeElement.id === "sxSpeed" && $("sxFace").dataset.id === m.id) return;
    $("sxFace").dataset.id = m.id;
    const L = m.limits, al = D.alarms.filter((a) => a.src === m.id);
    const keepSpeed = m.speed;
    const tile = (l, v, u, lim, bad) => `<div class="sensor ${bad || ""}"><div class="l">${l}</div><div class="v">${v} <small>${u}</small></div><div class="lim">${lim || "&nbsp;"}</div></div>`;
    $("sxFace").innerHTML = `
      <div class="card-head"><h2>Faceplate ${esc(m.id)}</h2>${chip(m.state)}</div>
      <p class="muted small" style="margin:-6px 0 8px">${esc(m.name)} · ${esc(m.line)}${m.reason ? ` · <b>${esc(m.reason)}</b>` : ""}${m.item ? ` · part ${esc(m.item)}` : ""}</p>
      <div class="sx-tiles">
        ${tile("Temperature", m.temp, "°C", `HIGH ${L.temp_h}`, m.temp >= L.temp_h ? "alert" : "")}
        ${tile("Vibration (1-min avg)", m.vib, "mm/s", `HIGH ${L.vib_h} · HIGH-HIGH ${L.vib_hh}`, m.vib >= L.vib_hh ? "alert" : m.vib >= L.vib_h ? "warnb" : "")}
        ${tile("Power", m.power, "kW", "")}
        ${m.rpm ? tile("Spindle", num(m.rpm), "rpm", "") : ""}
        ${m.wear != null ? tile("Tool wear", m.wear, "%", L.wear_h ? `HIGH ${L.wear_h}` : "", L.wear_h && m.wear >= L.wear_h ? "warnb" : "") : ""}
        ${tile("Good / scrap", `${m.good} / ${m.scrap}`, "pcs", `OEE ${pct(m.oee, 1)}`)}
      </div>
      <h3>Operator commands ${m.external ? `<span class="muted small">(real machine: commands go to its own PLC)</span>` : ""}</h3>
      <div class="sx-cmds">
        <button class="btn primary" data-cmd="start" ${m.external ? "disabled" : ""}>▶ Start</button>
        <button class="btn" data-cmd="stop" ${m.external ? "disabled" : ""}>■ Stop</button>
        <button class="btn" data-cmd="maintenance" ${m.external ? "disabled" : ""}>⚙ Maintenance</button>
      </div>
      <div class="sx-speed"><label for="sxSpeed">Speed set point</label>
        <input type="range" id="sxSpeed" min="50" max="130" step="5" value="${keepSpeed}" ${m.external ? "disabled" : ""}>
        <b id="sxSpeedV">${keepSpeed} %</b>
        <button class="btn" data-cmd="set_speed" ${m.external ? "disabled" : ""}>Write to PLC</button></div>
      <p class="hint" style="margin:4px 0 0">Faster = more parts per hour, but more tool wear (∝ speed<sup>1.5</sup>) and more breakdowns (∝ speed²).
        <button class="mini ghost" data-cmd="inject_bearing_fault" ${m.external ? "disabled" : ""}>Training: inject bearing fault</button></p>
      <h3>Alarms of this machine</h3>
      ${al.length ? `<ul class="sx-malm">${al.map((a) => `<li class="lv-${a.level}">${lvTag(a.level)} ${esc(a.text)}
        <span class="muted small">${a.off == null ? "active" : "cleared"} · ${a.ack ? "acknowledged" : "not acknowledged"}</span>
        ${a.ack ? "" : `<button class="mini" data-ack="${a.id}">Ack</button>`}</li>`).join("")}</ul>` : `<p class="muted small">✔ No alarms</p>`}
      <h3>Last hour <span class="muted small">temperature and vibration (historian)</span></h3>
      <div id="sxFaceTrend"></div>`;
    drawFaceTrend();
  }
  function drawFaceTrend() {
    const host = $("sxFaceTrend");
    if (!host) return;
    host.innerHTML = faceTrend.length ? faceTrend.map((s) => chart(s, 130, 520)).join("") : `<p class="muted small">Collecting data…</p>`;
  }
  async function loadFaceTrend() {
    if (!sel || page !== "overview") return;
    try {
      const r = await fetch(`/api/scada/trend?hours=1&tags=${encodeURIComponent(sel + ".Temperature," + sel + ".Vibration")}`);
      faceTrend = (await r.json()).series;
      drawFaceTrend();
    } catch (e) { /* server restarting */ }
  }

  // ---------------------------------------------------------------- alarms
  function renderAlarms() {
    const lv = $("sxAlmLevel").value, sh = $("sxShowShelved").checked, t = D.sim_time;
    const rows = D.alarms.filter((a) => (!lv || a.level === lv) && (sh || a.shelved_until == null));
    const state = (a) => a.off == null ? (a.ack ? "ACTIVE · acknowledged" : "ACTIVE · not acknowledged") : "CLEARED · not acknowledged";
    $("sxAlarms").innerHTML = `<tr><th>Level</th><th>Since</th><th>Source</th><th>Alarm</th><th class="num">Value</th><th class="num">Limit</th>
      <th>State</th><th>Comment</th><th></th></tr>` + (rows.length ? rows.map((a) => `
      <tr class="lv-${a.level}${!a.ack ? " sc-blink" : ""}${a.shelved_until != null ? " sc-old" : ""}">
        <td>${lvTag(a.level)}</td><td class="nowrap small">${tm(a.on)}<br><span class="muted">${dur(t - a.on)}</span></td>
        <td class="nowrap"><b>${esc(a.src)}</b><br><span class="muted small">${esc(a.tag)}</span></td><td>${esc(a.text)}${a.count > 1 ? ` <span class="muted small">(${a.count}×)</span>` : ""}</td>
        <td class="num">${a.value == null ? "" : esc(a.value)}</td><td class="num">${a.limit == null ? "" : a.limit}</td>
        <td class="nowrap small">${state(a)}${a.ack ? `<br><span class="muted">by ${esc(a.ack_by)} ${tm(a.ack_t)}</span>` : ""}
          ${a.shelved_until != null ? `<br><b>shelved</b> until ${tm(a.shelved_until)} (${esc(a.shelved_by)})` : ""}</td>
        <td class="small">${esc(a.comment || "")}</td>
        <td class="acts nowrap">${a.ack ? "" : `<button class="mini" data-ack="${a.id}">Ack</button>`}
          ${a.shelved_until == null ? `<button class="mini ghost" data-shelve="${a.id}">Shelve</button>` : `<button class="mini ghost" data-unshelve="${a.id}">Unshelve</button>`}
          <button class="mini ghost" data-comment="${a.id}">Comment</button></td></tr>`).join("")
      : `<tr><td colspan="9" class="muted">✔ No active alarms${D.kpis.shelved && !sh ? ` (${D.kpis.shelved} shelved)` : ""}</td></tr>`);

    // alarms per hour, last 12 h (bars) with the benchmark line
    const ph = D.stats.per_hour, W = 520, H = 130, p = { l: 28, r: 6, t: 8, b: 20 };
    const hi = Math.max(8, ...ph) * 1.1, bw = (W - p.l - p.r) / 12;
    const Y = (v) => H - p.b - (v / hi) * (H - p.t - p.b);
    $("sxRate").innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="sc-svg" role="img" aria-label="New alarms per hour, last 12 hours">
      ${[0, Math.round(hi / 2)].map((v) => `<line x1="${p.l}" x2="${W - p.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--grid)"/><text x="${p.l - 4}" y="${Y(v) + 3}" text-anchor="end" class="sc-tt">${v}</text>`).join("")}
      ${ph.map((v, i) => `<rect x="${p.l + i * bw + 2}" y="${Y(v)}" width="${bw - 4}" height="${Math.max(0, H - p.b - Y(v))}" rx="3" fill="${v > 6 ? "var(--serious)" : "var(--series)"}"><title>${v} new alarms</title></rect>
        ${v ? `<text x="${p.l + i * bw + bw / 2}" y="${Y(v) - 3}" text-anchor="middle" class="sc-tt">${v}</text>` : ""}`).join("")}
      <line x1="${p.l}" x2="${W - p.r}" y1="${Y(6)}" y2="${Y(6)}" stroke="var(--critical)" stroke-dasharray="4 4"/>
      <text x="${W - p.r}" y="${Y(6) - 3}" text-anchor="end" class="sc-tt">benchmark 6 / h</text>
      <text x="${p.l}" y="${H - 5}" class="sc-tt">12 h ago</text><text x="${W - p.r}" y="${H - 5}" text-anchor="end" class="sc-tt">last hour</text></svg>
      <p class="muted small">Total ${D.kpis.total} alarms this run · standing (active &gt; 1 h): ${D.stats.standing.join(", ") || "none"} ·
        chattering (≥ 3 in 10 min): ${D.stats.chattering.join(", ") || "none"}</p>`;
    $("sxBad").innerHTML = `<tr><th>Alarm</th><th class="num">Count</th><th>Share</th></tr>` + (D.stats.bad_actors.length
      ? D.stats.bad_actors.map((b) => `<tr><td><code>${esc(b.key)}</code></td><td class="num">${b.count}</td>
        <td style="min-width:90px"><div class="hbar"><i style="width:${(b.count / D.kpis.total) * 100}%"></i></div></td></tr>`).join("")
      : `<tr><td colspan="3" class="muted">No alarms yet</td></tr>`);
    $("sxJournal").innerHTML = `<tr><th class="num">#</th><th>On</th><th>Off</th><th>Source</th><th>Alarm</th><th>Acknowledged</th></tr>` +
      (D.journal.length ? D.journal.map((a) => `<tr class="lv-${a.level}"><td class="num">${a.id}</td><td class="small nowrap">${tm(a.on)}</td>
        <td class="small nowrap">${a.off == null ? "<b>active</b>" : `${tm(a.off)} <span class="muted">(${dur(a.off - a.on)})</span>`}</td>
        <td class="nowrap">${esc(a.src)}</td><td>${lvTag(a.level)} ${esc(a.text)}</td>
        <td class="small">${a.ack ? `${esc(a.ack_by)} ${tm(a.ack_t)}` : "–"}</td></tr>`).join("") : `<tr><td colspan="6" class="muted">No alarms yet</td></tr>`);
  }

  // ---------------------------------------------------------------- tags
  function renderTags() {
    if ($("sxTags").contains(document.activeElement) && document.activeElement.tagName === "INPUT") return; // operator is typing
    const srcSel = $("sxTagSrc");
    if (srcSel.options.length <= 1) srcSel.innerHTML += [...new Set(D.tags.map((x) => x.src))].map((s) => `<option>${esc(s)}</option>`).join("");
    const q = $("sxTagFilter").value.trim().toLowerCase(), src = srcSel.value;
    const rows = D.tags.filter((x) => (!src || x.src === src) && (!q || x.tag.toLowerCase().includes(q)));
    const lim = (l) => !l ? "" : [l[0] != null ? `H ${l[0]}` : "", l[1] != null ? `HH ${l[1]}` : ""].filter(Boolean).join(" · ");
    $("sxTags").innerHTML = `<tr><th>Tag</th><th class="num">Value</th><th>Unit</th><th>Quality</th><th>Time stamp</th><th>PLC address</th>
      <th>Signal</th><th>Alarm limits</th><th>Write</th></tr>` + rows.slice(0, 400).map((x) => `<tr>
      <td class="nowrap"><code>${esc(x.tag)}</code></td><td class="num"><b>${esc(x.value)}</b></td><td>${esc(x.unit)}</td>
      <td class="${x.quality === "Good" ? "sc-good" : "neg"}">${esc(x.quality)}</td><td class="small nowrap">${tm(x.t)}</td>
      <td class="small nowrap">${esc(x.addr)}</td><td class="small">${esc(x.sig)}</td><td class="small nowrap">${lim(x.lim)}</td>
      <td class="nowrap">${x.write ? `<input type="number" min="50" max="130" step="5" value="${esc(x.value)}" data-wtag="${esc(x.tag)}" style="width:64px" aria-label="New value for ${esc(x.tag)}">
        <button class="mini" data-write="${esc(x.tag)}">Write</button>` : ""}</td></tr>`).join("") +
      (rows.length > 400 ? `<tr><td colspan="9" class="muted">… ${rows.length - 400} more, use the filter</td></tr>` : "");
  }

  // ---------------------------------------------------------------- trends (small multiples: one chart per pen)
  function chart(s, h = 170, W = 1300) {
    const pts = s.points.filter((q) => q[1] != null);
    if (pts.length < 2) return `<div class="sx-chart"><div class="sx-ch-h"><b>${esc(s.tag)}</b></div><p class="muted small">Not enough data yet</p></div>`;
    const H = h, p = { l: 44, r: 10, t: 10, b: 20 };
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const lims = (s.limits || []).filter((l) => l[1] != null);
    let lo = Math.min(...ys), hi = Math.max(...ys);
    lims.forEach((l) => { if (l[1] <= hi * 1.8 + 1) hi = Math.max(hi, l[1]); });
    const m = (hi - lo) * 0.1 || 1; lo = Math.max(lo >= 0 ? 0 : -Infinity, lo - m); hi += m;
    const x0 = xs[0], x1 = xs[xs.length - 1];
    const X = (v) => p.l + ((v - x0) / (x1 - x0 || 1)) * (W - p.l - p.r), Y = (v) => H - p.b - ((v - lo) / (hi - lo || 1)) * (H - p.t - p.b);
    const last = pts[pts.length - 1];
    return `<div class="sx-chart"><div class="sx-ch-h"><b>${esc(s.tag)}</b> <span class="muted small">${esc(s.unit)} · now <b>${last[1]}</b></span></div>
      <svg viewBox="0 0 ${W} ${H}" class="sc-svg sx-tr" data-x0="${x0}" data-x1="${x1}" data-pl="${p.l}" data-pr="${p.r}" data-w="${W}" role="img" aria-label="Trend ${esc(s.tag)}">
      ${[lo, (lo + hi) / 2, hi].map((v) => `<line x1="${p.l}" x2="${W - p.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--grid)"/>
        <text x="${p.l - 5}" y="${Y(v) + 3}" text-anchor="end" class="sc-tt">${+v.toFixed(v > 100 ? 0 : 2)}</text>`).join("")}
      ${lims.filter((l) => l[1] >= lo && l[1] <= hi).map((l) => `<line x1="${p.l}" x2="${W - p.r}" y1="${Y(l[1])}" y2="${Y(l[1])}"
        stroke="var(${l[0] === "HIGH-HIGH" ? "--critical" : "--warning"})" stroke-dasharray="4 4"/>
        <text x="${W - p.r}" y="${Y(l[1]) - 3}" text-anchor="end" class="sc-tt">${l[0]} ${l[1]}</text>`).join("")}
      <polyline fill="none" stroke="var(--series)" stroke-width="2" stroke-linejoin="round" points="${pts.map((q) => `${X(q[0]).toFixed(1)},${Y(q[1]).toFixed(1)}`).join(" ")}"/>
      <circle cx="${X(last[0])}" cy="${Y(last[1])}" r="4" fill="var(--series)" stroke="var(--surface)" stroke-width="2"/>
      <text x="${p.l}" y="${H - 5}" class="sc-tt">${tm(x0)}</text><text x="${W - p.r}" y="${H - 5}" text-anchor="end" class="sc-tt">${tm(x1)}</text>
      <line class="sx-cross" x1="0" x2="0" y1="${p.t}" y2="${H - p.b}" stroke="var(--axis)" visibility="hidden"/>
      </svg><script type="application/json">${JSON.stringify(pts)}</script></div>`;
  }
  function buildPens() {
    if (pens) return;
    pens = [[sel || "HMC-02", "Temperature"], [sel || "HMC-02", "Vibration"], ["", ""], ["", ""]];
    try { const s = JSON.parse(localStorage.getItem("scadaPens") || "null"); if (Array.isArray(s) && s.length === 4) pens = s; } catch (e) { /* ignore */ }
    const mOpts = (v) => `<option value="">– none –</option>` + D.machines.map((m) => `<option${m.id === v ? " selected" : ""}>${m.id}</option>`).join("");
    const sOpts = (v) => SIGNALS.map((s) => `<option${s === v ? " selected" : ""}>${s}</option>`).join("");
    $("sxPens").innerHTML = pens.map((p, i) => `<label class="sx-pen">Pen ${i + 1}
      <select data-pen="${i}" data-k="0" aria-label="Pen ${i + 1} machine">${mOpts(p[0])}</select>
      <select data-pen="${i}" data-k="1" aria-label="Pen ${i + 1} signal">${sOpts(p[1] || "Temperature")}</select></label>`).join("");
  }
  async function loadTrends() {
    if (page !== "trends" || !D) return;
    buildPens();
    const tags = pens.filter((p) => p[0]).map((p) => `${p[0]}.${p[1] || "Temperature"}`);
    if (!tags.length) { $("sxCharts").innerHTML = `<p class="muted">Choose a machine for at least one pen.</p>`; return; }
    try {
      const r = await fetch(`/api/scada/trend?hours=${$("sxRange").value}&tags=${encodeURIComponent(tags.join(","))}`);
      const d = await r.json();
      $("sxCharts").innerHTML = d.series.map((s) => chart(s)).join("");
    } catch (e) { /* server restarting */ }
  }
  // crosshair + tooltip on every trend chart
  document.addEventListener("mousemove", (e) => {
    const svg = e.target.closest && e.target.closest("svg.sx-tr");
    const tt = $("tooltip");
    document.querySelectorAll("svg.sx-tr .sx-cross").forEach((l) => { if (!svg || !svg.contains(l)) l.setAttribute("visibility", "hidden"); });
    if (!svg) { if (tt.dataset.sx) { tt.hidden = true; delete tt.dataset.sx; } return; }
    const pts = JSON.parse(svg.nextElementSibling.textContent), r = svg.getBoundingClientRect();
    const W = +svg.dataset.w, pl = +svg.dataset.pl, pr = +svg.dataset.pr, x0 = +svg.dataset.x0, x1 = +svg.dataset.x1;
    const vx = ((e.clientX - r.left) / r.width) * W;
    const tv = x0 + ((vx - pl) / (W - pl - pr)) * (x1 - x0);
    let best = pts[0];
    for (const q of pts) if (Math.abs(q[0] - tv) < Math.abs(best[0] - tv)) best = q;
    const cx = pl + ((best[0] - x0) / (x1 - x0 || 1)) * (W - pl - pr);
    const l = svg.querySelector(".sx-cross");
    l.setAttribute("x1", cx); l.setAttribute("x2", cx); l.setAttribute("visibility", "visible");
    tt.innerHTML = `<div class="tt-t">${fmtTime(best[0])}</div><b>${best[1]}</b>`;
    tt.hidden = false; tt.dataset.sx = "1";
    tt.style.left = Math.min(e.clientX + 12, window.innerWidth - tt.offsetWidth - 8) + "px";
    tt.style.top = e.clientY - 40 + "px";
  });

  // ---------------------------------------------------------------- audit, report, settings
  function renderAudit() {
    $("sxAudit").innerHTML = `<tr><th>Time</th><th>Operator</th><th>Action</th><th>Target</th><th>Detail</th><th>Result</th></tr>` +
      (D.audit.length ? D.audit.map((a) => `<tr><td class="small nowrap">${tm(a.t)}</td><td><b>${esc(a.user)}</b></td><td>${esc(a.action)}</td>
        <td class="nowrap">${esc(a.target)}</td><td class="small">${esc(a.detail)}</td><td class="small">${esc(a.result)}</td></tr>`).join("")
        : `<tr><td colspan="6" class="muted">No operator actions yet. Every command, acknowledge, shelve and limit change appears here.</td></tr>`);
  }
  function renderReport() {
    const R = D.report, tot = R.reduce((a, r) => ({ good: a.good + r.good, scrap: a.scrap + r.scrap, run: a.run + r.run_h, down: a.down + r.down_h, stop: a.stop + r.stop_h, al: a.al + r.alarms }),
      { good: 0, scrap: 0, run: 0, down: 0, stop: 0, al: 0 });
    $("sxReport").innerHTML = `<tr><th>Machine</th><th class="num">Good</th><th class="num">Scrap</th><th class="num">Availability</th><th class="num">Performance</th>
      <th class="num">Quality</th><th class="num">OEE</th><th class="num">Running h</th><th class="num">Down + maint. h</th><th class="num">Stopped h</th><th class="num">Alarms</th></tr>` +
      R.map((r) => `<tr><td><b>${r.id}</b> <span class="muted small">${esc(r.name)}</span></td><td class="num">${r.good}</td><td class="num">${r.scrap}</td>
        <td class="num">${pct(r.availability, 1)}</td><td class="num">${pct(r.performance, 1)}</td><td class="num">${pct(r.quality, 1)}</td>
        <td class="num"><b>${pct(r.oee, 1)}</b></td><td class="num">${r.run_h}</td><td class="num">${r.down_h}</td><td class="num">${r.stop_h}</td><td class="num">${r.alarms}</td></tr>`).join("") +
      `<tr class="sx-tot"><td><b>Total</b></td><td class="num">${tot.good}</td><td class="num">${tot.scrap}</td><td colspan="4" class="num">line OEE ${pct(D.kpis.line_oee, 1)}</td>
        <td class="num">${tot.run.toFixed(1)}</td><td class="num">${tot.down.toFixed(1)}</td><td class="num">${tot.stop.toFixed(1)}</td><td class="num">${tot.al}</td></tr>`;
  }
  function renderSettings() {
    $("sxDb").textContent = `deadbands: vibration ${D.deadbands.vib} mm/s · temperature ${D.deadbands.temp} °C · tool wear ${D.deadbands.wear} %`;
    if (settingsBuilt) return;
    const inp = (m, k, step) => m.limits[k] == null ? `<span class="muted">–</span>` :
      `<input type="number" step="${step}" min="0" value="${m.limits[k]}" data-lim="${k}" style="width:72px" aria-label="${m.id} ${k}">`;
    $("sxLimits").innerHTML = `<tr><th>Machine</th><th>Vibration HIGH (mm/s)</th><th>Vibration HIGH-HIGH (mm/s)</th><th>Temperature HIGH (°C)</th>
      <th>Tool wear HIGH (%)</th><th></th></tr>` + D.machines.map((m) => `<tr data-mid="${m.id}"><td><b>${m.id}</b> <span class="muted small">${esc(m.name)}</span></td>
      <td>${inp(m, "vib_h", 0.1)}</td><td>${inp(m, "vib_hh", 0.1)}</td><td>${inp(m, "temp_h", 1)}</td><td>${inp(m, "wear_h", 1)}</td>
      <td><button class="mini" data-savelim="${m.id}">Save</button></td></tr>`).join("");
    settingsBuilt = true;
  }

  // ---------------------------------------------------------------- render + load
  function render() {
    renderKpis();
    if (page === "overview") renderOverview();
    if (page === "alarms") renderAlarms();
    if (page === "tags") renderTags();
    if (page === "audit") renderAudit();
    if (page === "report") renderReport();
    if (page === "settings") renderSettings();
  }
  async function load() {
    try {
      const r = await fetch("/api/scada");
      if (!r.ok) return;
      D = await r.json();
      if (!sel || !D.machines.some((m) => m.id === sel)) sel = (D.machines.find((m) => m.id === "HMC-02") || D.machines[0]).id;
      render();
    } catch (e) { /* server restarting */ }
  }
  setInterval(() => { if (active === "scada") load(); }, 1500);
  setInterval(() => { if (active === "scada") { if (page === "trends") loadTrends(); if (page === "overview") loadFaceTrend(); } }, 5000);
  const _prev = window.onTabShown;
  window.onTabShown = (name) => { if (_prev) _prev(name); if (name === "scada") { load().then(() => { loadFaceTrend(); if (page === "trends") loadTrends(); }); } };

  // ---------------------------------------------------------------- events
  const tab = $("tab-scada");
  tab.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const m = e.target.closest(".sc-m[data-id]");
    if (m) { sel = m.dataset.id; faceTrend = []; renderOverview(); loadFaceTrend(); return; }
    if (b.dataset.line) {
      const n = b.dataset.name;
      return act({ action: "line", line: n, cmd: b.dataset.line }, b.dataset.line === "stop" ? `Stop all machines of "${n}"?` : null);
    }
    if (b.dataset.cmd) {
      const c = b.dataset.cmd;
      if (c === "set_speed") return act({ action: "machine", machine: sel, cmd: c, value: +$("sxSpeed").value });
      const ask = { stop: `Stop ${sel}? The part in the machine waits.`, maintenance: `Start maintenance on ${sel}? The machine is not available during maintenance.`,
        inject_bearing_fault: `Training: damage the bearing of ${sel}? Vibration will rise slowly, then alarms come.` }[c];
      return act({ action: "machine", machine: sel, cmd: c }, ask);
    }
    if (b.dataset.ack) return act({ action: "ack", id: +b.dataset.ack });
    if (b.dataset.shelve) {
      const h = window.prompt("Shelve this alarm for how many hours? (0.25 – 24)", "1");
      if (h == null) return;
      const reason = window.prompt("Reason (written to the audit trail)", "") || "";
      return act({ action: "shelve", id: +b.dataset.shelve, hours: +h || 1, reason });
    }
    if (b.dataset.unshelve) return act({ action: "unshelve", id: +b.dataset.unshelve });
    if (b.dataset.comment) {
      const a = D.alarms.find((x) => x.id === +b.dataset.comment);
      const t = window.prompt("Comment for this alarm", a ? a.comment : "");
      if (t != null) act({ action: "comment", id: +b.dataset.comment, text: t });
      return;
    }
    if (b.dataset.write) {
      const inpEl = tab.querySelector(`input[data-wtag="${CSS.escape(b.dataset.write)}"]`);
      return act({ action: "write", tag: b.dataset.write, value: +inpEl.value });
    }
    if (b.dataset.savelim) {
      const row = b.closest("tr"), body = { action: "limits", machine: b.dataset.savelim };
      row.querySelectorAll("input[data-lim]").forEach((i) => { body[i.dataset.lim] = i.value; });
      settingsBuilt = false;
      return act(body);
    }
  });
  tab.addEventListener("input", (e) => { if (e.target.id === "sxSpeed") $("sxSpeedV").textContent = e.target.value + " %"; });
  tab.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.dataset && e.target.dataset.wtag) tab.querySelector(`button[data-write="${CSS.escape(e.target.dataset.wtag)}"]`).click();
  });
  $("sxAckAll").addEventListener("click", () => act({ action: "ack", id: "all" }));
  ["sxAlmLevel", "sxShowShelved"].forEach((id) => $(id).addEventListener("change", () => D && renderAlarms()));
  $("sxTagFilter").addEventListener("input", () => D && renderTags());
  $("sxTagSrc").addEventListener("change", () => D && renderTags());
  $("sxRange").addEventListener("change", loadTrends);
  $("sxPens").addEventListener("change", (e) => {
    const s = e.target.closest("select[data-pen]");
    if (!s) return;
    pens[+s.dataset.pen][+s.dataset.k] = s.value;
    try { localStorage.setItem("scadaPens", JSON.stringify(pens)); } catch (er) { /* ignore */ }
    loadTrends();
  });
  $("sxCsv").addEventListener("click", () => {
    if (!D) return;
    const head = ["machine", "name", "good", "scrap", "availability", "performance", "quality", "oee", "running_h", "down_maint_h", "stopped_h", "alarms"];
    const rows = D.report.map((r) => [r.id, `"${r.name}"`, r.good, r.scrap, r.availability.toFixed(4), r.performance.toFixed(4), r.quality.toFixed(4),
      r.oee.toFixed(4), r.run_h, r.down_h, r.stop_h, r.alarms].join(","));
    const blob = new Blob([[head.join(","), ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `shift_report_${tm(D.sim_time).replace(/[: ]/g, "-")}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  try { const p = new URLSearchParams(location.search).get("scp") || localStorage.getItem("scadaPage"); if (p && p !== "overview" && $("sxP-" + p)) setPage(p); } catch (e) { /* ignore */ }
})();
