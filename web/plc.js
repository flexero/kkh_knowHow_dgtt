/* FMS tab - PLC control of the current system (GET/POST /api/plc).
   Network diagram (plant network, PLCs, PLC-to-PLC couplings, stations, AS/RS cranes, AGVs), PLC detail with
   live I/O image, live ladder logic, field devices and E-stop, and the log of all handshakes.
   PLC types, addresses and devices are example values. */
(function () {
  const $ = (id) => document.getElementById(id);
  if (!$("plcNet")) return;
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const hms = (s) => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return `T+ ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
  const PCOL = { "OPC UA": "#2a78d6", "PROFINET": "#1a9a5b", "PN/PN coupler": "#6250d6", "Optical I/O (E84 style)": "#c2468f",
                 "MQTT / VDA 5050": "#b4620c", "PROFIsafe": "#d03b3b", "IO-Link": "#1590a8", "4-20 mA": "#8a6d1f" };
  const pcol = (p) => PCOL[p] || (p.startsWith("OPC UA") ? PCOL["OPC UA"] : p.startsWith("PROFINET") ? PCOL.PROFINET : "#898781");
  const NODE_NAME = { MES: "MES", SCADA: "SCADA", FLEET: "AGV fleet manager", AGVS: "AGVs", Safety: "Safety circuit" };
  let D = null, sel = new URLSearchParams(location.search).get("plc"), selSt = null, fPlc = "", fProto = "", openMsg = null;

  async function load() {
    try {
      const r = await fetch("/api/plc");
      if (!r.ok) throw new Error(r.status === 404 ? "the server is old - restart it (Ctrl+C, then python server.py)" : "HTTP " + r.status);
      D = await r.json();
    } catch (e) { $("plcNet").innerHTML = `<p class="muted" style="padding:12px">PLC data not available: ${esc(e.message)}</p>`; return; }
    if (!sel || !D.plcs.find((p) => p.id === sel)) sel = (D.plcs.find((p) => p.kind === "line") || D.plcs[0]).id;
    render();
  }
  function render() { kpis(); net(); detail(); log(); }

  function kpis() {
    const k = D.kpis;
    const c = [["PLCs", k.plcs, "one per line + one per AS/RS crane"], ["I/O points", k.io, "inputs, outputs, analog values"],
      ["Messages / min", k.per_min, "events in the last 10 min (cyclic data not counted)"],
      ["PLC ↔ PLC hand-overs", k.plc_plc, "buffer between two lines (PN/PN coupler)"],
      ["AGV docking hand-overs", k.handovers, "optical I/O, E84 style"],
      ["Safety", k.estops ? k.estops + " E-stop pressed" : k.faults ? k.faults + " PLC with fault" : "all OK", "E-stop / faults"]];
    $("plcKpis").innerHTML = c.map(([l, v, n], i) => `<div class="kpi"><div class="label">${l}</div><div class="value${i === 5 ? (k.estops ? " plc-bad" : k.faults ? " plc-mid" : " plc-good") : ""}${i === 5 ? " text" : ""}">${esc(v)}</div><div class="note">${n}</div></div>`).join("");
  }

  // ------------------------------------------------------------------ network diagram
  function link(a, b, proto) { return D.links.find((L) => ((L.a === a && L.b === b) || (L.a === b && L.b === a)) && L.proto === proto); }
  function net() {
    const asrs = D.plcs.filter((p) => p.kind === "asrs"), lines = D.plcs.filter((p) => p.kind === "line");
    const half = Math.ceil(asrs.length / 2);
    const order = [...asrs.slice(0, half), ...lines, ...asrs.slice(half)];
    const W = 1300, n = order.length, colW = W / n, bw = Math.min(colW - 18, 172);
    const maxSt = Math.max(2, ...order.map((p) => p.stations.length));
    const yBus = 96, yP = 196, hP = 64, hS = 26, gS = 30;
    const yS = yP + hP + 44 + D.couplings.length * 18 + 30;
    const yAgv = yS + maxSt * gS + 36, H = yAgv + 64;
    const X = {}; order.forEach((p, i) => { X[p.id] = colW * (i + 0.5); });
    const top = [["MES", W * 0.17, "MES", "orders, recipes, part data"], ["SCADA", W * 0.5, "SCADA", "screens, alarms, trends"], ["FLEET", W * 0.83, "AGV fleet manager", "drive orders (VDA 5050)"]];
    let s = `<svg viewBox="0 0 ${W} ${H}" class="plc-svg" role="img" aria-label="PLC network of the factory">
      <defs>${Object.entries(PCOL).map(([p, c], i) => `<marker id="pa${i}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`).join("")}</defs>`;
    // plant network bus
    s += `<line x1="16" y1="${yBus}" x2="${W - 16}" y2="${yBus}" class="plc-bus"/>
      <text x="20" y="${yBus - 8}" class="plc-lbl">Plant network · Ethernet · OPC UA (port 4840)</text>`;
    for (const [id, x, name, sub] of top) {
      const act = D.links.some((L) => (L.a === id || L.b === id) && L.active && !L.cyclic);
      s += `<line x1="${x}" y1="64" x2="${x}" y2="${yBus}" class="plc-drop${act ? " on" : ""}" style="--c:${PCOL["OPC UA"]}"/>
        <g class="plc-top"><rect x="${x - 100}" y="16" width="200" height="48" rx="8"/><text x="${x}" y="37" class="plc-t1">${name}</text><text x="${x}" y="54" class="plc-t2">${sub}</text></g>`;
    }
    // couplings (PLC to PLC): one lane each below the PLC boxes, arrow into the receiving PLC
    const into = {};
    D.couplings.forEach((c, k) => {
      const x1 = X[c.from], x2 = X[c.to]; if (x1 === undefined || x2 === undefined) return;
      const L = link(c.from, c.to, "PN/PN coupler"), lane = yP + hP + 30 + k * 18, dir = x2 > x1 ? 1 : -1;
      const n = into[c.to] = (into[c.to] || 0) + 1;
      const sx = x1 + dir * 26, ex = x2 - dir * 26 - dir * (n - 1) * 10;
      s += `<path d="M${sx},${yP + hP} V${lane} H${ex} V${yP + hP + 2}" class="plc-cpl${L && L.active ? " on" : ""}" marker-end="url(#pa2)"/>
        <text x="${(sx + ex) / 2}" y="${lane - 4}" class="plc-lbl c" style="fill:#6250d6 !important">${esc(c.name)} (${esc(c.buffer)}) · ${L ? L.n : 0}</text>`;
    });
    // PLC boxes
    for (const p of order) {
      const x = X[p.id];
      const mes = link(p.id, "MES", "OPC UA"), dock = D.links.filter((L) => (L.a === p.id || L.b === p.id) && L.proto.startsWith("Optical")).reduce((a, L) => a + L.n, 0);
      s += `<line x1="${x}" y1="${yBus}" x2="${x}" y2="${yP}" class="plc-drop${mes && mes.active ? " on" : " cyc"}" style="--c:${PCOL["OPC UA"]}"/>
        <g class="plc-box${p.id === sel ? " sel" : ""}${p.estop ? " estop" : p.fault ? " fault" : ""}" data-plc="${p.id}" tabindex="0" role="button" aria-label="${esc(p.id)}">
        <rect x="${x - bw / 2}" y="${yP}" width="${bw}" height="${hP}" rx="8"/>
        <text x="${x - bw / 2 + 10}" y="${yP + 19}" class="plc-t1 l">${esc(p.id)}</text>
        <circle cx="${x + bw / 2 - 30}" cy="${yP + 14}" r="4.5" class="led run"/><circle cx="${x + bw / 2 - 16}" cy="${yP + 14}" r="4.5" class="led ${p.estop || p.fault ? "err" : "off"}"/>
        <text x="${x - bw / 2 + 10}" y="${yP + 36}" class="plc-t2 l">${esc(short(p.name, 24))}</text>
        <text x="${x - bw / 2 + 10}" y="${yP + 52}" class="plc-t3 l">${esc(p.model.split(" (")[0])} · ${p.scan_ms} ms</text></g>`;
      if (dock) s += `<text x="${x}" y="${yP - 6}" class="plc-lbl c" style="fill:${PCOL["Optical I/O (E84 style)"]}">AGV docking ${dock}</text>`;
      // field level
      if (p.kind === "line") {
        const xl = x - bw / 2 + 8;
        s += `<line x1="${x}" y1="${yP + hP}" x2="${x}" y2="${yS - 14}" class="pn"/><line x1="${xl}" y1="${yS - 14}" x2="${x}" y2="${yS - 14}" class="pn"/>
          <line x1="${xl}" y1="${yS - 14}" x2="${xl}" y2="${yS + (p.stations.length - 1) * gS + hS / 2}" class="pn"/>
          <text x="${x + 6}" y="${yS - 20}" class="plc-lbl" style="fill:${PCOL.PROFINET}">PROFINET</text>`;
        p.stations.forEach((st, j) => {
          const y = yS + j * gS, sx = xl + 10, w = bw - 18;
          s += `<line x1="${xl}" y1="${y + hS / 2}" x2="${sx}" y2="${y + hS / 2}" class="pn"/>
            <g class="plc-st st-${st.state}${st.id === selSt && p.id === sel ? " sel" : ""}" data-plc="${p.id}" data-st="${st.id}" tabindex="0" role="button" aria-label="${esc(st.id)}">
            <rect x="${sx}" y="${y}" width="${w}" height="${hS}" rx="5"/><rect x="${sx}" y="${y}" width="5" height="${hS}" rx="2" class="bar"/>
            <text x="${sx + 11}" y="${y + 17}" class="plc-t3 l b">${esc(st.id)}</text>
            <text x="${sx + w - 7}" y="${y + 17}" class="plc-t3 r">${esc(st.state.toLowerCase())}${st.model ? " · " + esc(st.model) : ""}</text></g>`;
        });
      } else if (p.asrs) {
        const a = p.asrs, y = yS;
        s += `<line x1="${x}" y1="${yP + hP}" x2="${x}" y2="${y}" class="pn"/>
          <g class="plc-st ${a.busy ? "st-RUNNING" : "st-STOPPED"}" data-plc="${p.id}"><rect x="${x - bw / 2 + 8}" y="${y}" width="${bw - 16}" height="44" rx="5"/><rect x="${x - bw / 2 + 8}" y="${y}" width="5" height="44" rx="2" class="bar"/>
          <text x="${x - bw / 2 + 20}" y="${y + 17}" class="plc-t3 l b">Stacker crane ${a.busy ? "busy" : "idle"}</text>
          <text x="${x - bw / 2 + 20}" y="${y + 34}" class="plc-t3 l">queue ${a.queue} · I/O conveyor ${a.io_waiting}</text></g>`;
      }
    }
    // AGVs
    const agvs = D.agvs, aw = 92, gap = 10, x0 = W - 16 - agvs.length * (aw + gap);
    s += `<path d="M${W * 0.83 + 60},64 C${W - 10},120 ${W - 10},${yAgv - 30} ${W - 30},${yAgv}" class="plc-wifi"/>
      <text x="${x0 - 8}" y="${yAgv + 20}" class="plc-lbl r" style="fill:${PCOL["MQTT / VDA 5050"]}">AGVs · Wi-Fi · MQTT / VDA 5050 →</text>`;
    agvs.forEach((v, i) => {
      const x = x0 + i * (aw + gap), cls = /CHARG/.test(v.state) ? "st-STARVED" : v.state === "IDLE" ? "st-STOPPED" : "st-RUNNING";
      s += `<g class="plc-st ${cls}"><rect x="${x}" y="${yAgv}" width="${aw}" height="34" rx="5"/><rect x="${x}" y="${yAgv}" width="5" height="34" rx="2" class="bar"/>
        <text x="${x + 11}" y="${yAgv + 14}" class="plc-t3 l b">${esc(v.id)} · ${v.battery}%</text><text x="${x + 11}" y="${yAgv + 28}" class="plc-t3 l">${esc(v.state.toLowerCase().replace(/_/g, " "))}</text></g>`;
    });
    s += "</svg>";
    $("plcNet").innerHTML = s;
    $("plcLegend").innerHTML = ["OPC UA", "PROFINET", "PN/PN coupler", "Optical I/O (E84 style)", "MQTT / VDA 5050", "PROFIsafe"]
      .map((p) => `<span><i style="background:${PCOL[p]}"></i>${p}</span>`).join("") + `<span class="muted">moving dashes = message in the last minute · click a PLC or a station</span>`;
  }
  const short = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

  // ------------------------------------------------------------------ PLC detail
  function detail() {
    const p = D.plcs.find((x) => x.id === sel); if (!p) return;
    $("plcTitle").textContent = `${p.id} – ${p.name}`;
    const b = $("plcEstop");
    b.hidden = p.kind !== "line";
    b.classList.toggle("on", p.estop);
    b.innerHTML = p.estop ? "Release + reset<br><small>E-stop is pressed</small>" : "EMERGENCY<br>STOP";
    const chip = (l, v) => `<div><span>${l}</span><b>${esc(v)}</b></div>`;
    $("plcHead").innerHTML = chip("CPU", p.model) + chip("IP address", p.ip) + chip("Scan time (OB1)", p.scan_ms + " ms") +
      chip("CPU load", p.cpu_load + " %") + chip("I/O points", p.io_points) + chip("Values sent to SCADA", p.opc_values.toLocaleString("en-US")) +
      `<div><span>Status LEDs</span><b><i class="led2 run"></i>RUN <i class="led2 ${p.fault || p.estop ? "err" : "off"}"></i>ERROR${p.estop ? ' <i class="led2 err"></i>E-STOP' : ""}</b></div>`;
    if (p.kind === "asrs") {
      $("plcStations").innerHTML = "";
      $("plcLadder").innerHTML = ladderAsrs(p.asrs);
      $("plcIO").innerHTML = ioTable(p.asrs.io);
      $("plcDev").innerHTML = devTable([{ name: "Travel + lift drives (servo)", proto: "PROFINET IRT", use: "crane X and Y axes, position control" },
        { name: "Laser distance sensor", proto: "PROFINET", use: "exact bay position" }, { name: "Telescopic fork", proto: "PROFINET", use: "takes the load out of the rack" },
        { name: "I/O conveyor photo eyes", proto: "IO-Link", use: "load arrived / load gone" },
        { name: "Safety door + E-stop", proto: "PROFIsafe", use: "crane stops when the rack door is opened" }]);
      return;
    }
    if (!selSt || !p.stations.find((s) => s.id === selSt)) selSt = p.stations[0]?.id;
    $("plcStations").innerHTML = p.stations.map((s) => `<button class="seg-btn${s.id === selSt ? " active" : ""}" data-st="${s.id}"><span class="badge st-${s.state}" style="margin:0">${esc(s.id)}</span></button>`).join("");
    const st = p.stations.find((s) => s.id === selSt);
    if (!st) return;
    $("plcLadder").innerHTML = ladder(st);
    $("plcIO").innerHTML = ioTable(st.io);
    $("plcDev").innerHTML = devTable([...st.devices,
      { name: "ET 200SP remote I/O", proto: "PROFINET", use: "digital and analog I/O of this station" },
      { name: "Managed switch", proto: "Ethernet", use: "connects the station to the PLC and the plant network" }]);
  }
  function ioTable(rows) {
    return `<thead><tr><th>Address</th><th>Symbol</th><th>Type</th><th>Value</th><th>Raw</th><th>Signal</th></tr></thead><tbody>` +
      rows.map((r) => `<tr><td class="mono">${esc(r.addr)}</td><td class="mono">${esc(r.sym)}</td><td><span class="plc-ty ${r.type}">${r.type}</span></td>
        <td>${typeof r.value === "boolean" ? `<i class="led2 ${r.value ? "run" : "off"}"></i>${r.value ? "1" : "0"}` : `<b>${esc(r.value)}</b> ${esc(r.unit || "")}`}</td>
        <td class="mono muted">${r.raw ?? ""}</td><td class="muted">${esc(r.note)}</td></tr>`).join("") + "</tbody>";
  }
  function devTable(rows) {
    return `<thead><tr><th>Device</th><th>Connection</th><th>What it does</th></tr></thead><tbody>` +
      rows.map((d) => `<tr><td>${esc(d.name)}</td><td><span class="plc-proto" style="--c:${pcol(d.proto)}">${esc(d.proto)}</span></td><td class="muted">${esc(d.use)}</td></tr>`).join("") + "</tbody>";
  }

  // ---- live ladder logic (power flow is calculated from the real I/O values)
  function ladder(st) {
    const v = {}; const a = {};
    st.io.forEach((r) => { v[r.sym] = r.value; a[r.sym] = r.addr; });
    const C = (s, nc) => ({ s, nc }), P = (...items) => ({ par: items });
    const rungs = [
      ["Cycle start: everything safe and the part is clamped", [C("AutoMode"), C("DoorClosed"), C("Clamped"), C("Fault", true), C("EStopOK")], "CycleStart"],
      ["Release the finished part only if the next buffer has a free place", [C("CycleDone"), C("OutputFree")], "Unclamp"],
      ["Motor / spindle runs only with cycle start AND safety OK", [C("CycleStart"), C("EStopOK")], "Motor"],
      ["Red lamp: fault OR E-stop OR door open", [P(C("Fault"), C("EStopOK", true), C("DoorClosed", true))], "LampRed"],
      ["Green lamp while the station is producing", [C("CycleStart")], "LampGreen"],
    ];
    return rungs.map(([title, items, coil], ri) => rung(ri + 1, title, items, coil, v, a)).join("") +
      `<p class="hint">Green = current flows. <span class="mono">-| |-</span> normally open contact (true when the signal is 1),
       <span class="mono">-|/|-</span> normally closed contact (true when the signal is 0), <span class="mono">( )</span> output coil.
       The PLC runs these rungs from top to bottom every ${D.plcs.find((x) => x.id === sel).scan_ms} ms.</p>`;
  }
  function rung(no, title, items, coil, v, a) {
    const CW = 104, H1 = 68, rows = Math.max(1, ...items.map((it) => (it.par ? it.par.length : 1)));
    const W = 70 + items.length * CW + 170, H = 24 + rows * H1;
    const val = (c) => (c.nc ? !v[c.s] : !!v[c.s]);
    let x = 40, power = true, s = "";
    const y0 = 40;
    const contact = (c, x, y, pin) => {
      const ok = val(c), out = pin && ok, col = (on) => (on ? "plc-on" : "plc-off");
      return `<line x1="${x}" y1="${y}" x2="${x + 36}" y2="${y}" class="${col(pin)}"/>
        <line x1="${x + 36}" y1="${y - 12}" x2="${x + 36}" y2="${y + 12}" class="${col(pin)} t"/><line x1="${x + 52}" y1="${y - 12}" x2="${x + 52}" y2="${y + 12}" class="${col(out)} t"/>
        ${c.nc ? `<line x1="${x + 32}" y1="${y + 12}" x2="${x + 56}" y2="${y - 12}" class="${col(out)}"/>` : ""}
        <line x1="${x + 52}" y1="${y}" x2="${x + CW}" y2="${y}" class="${col(out)}"/>
        <text x="${x + 44}" y="${y - 18}" class="plc-t3 c b">${esc(c.s)}</text>
        <text x="${x + 44}" y="${y + 26}" class="plc-t3 c">${esc(a[c.s] || "")} = ${v[c.s] ? 1 : 0}</text>`;
    };
    for (const it of items) {
      if (it.par) {
        const outs = it.par.map((c, k) => { s += contact(c, x, y0 + k * H1, power); return power && val(c); });
        const any = outs.some(Boolean);
        s += `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y0 + (it.par.length - 1) * H1}" class="${power ? "plc-on" : "plc-off"}"/>
          <line x1="${x + CW}" y1="${y0}" x2="${x + CW}" y2="${y0 + (it.par.length - 1) * H1}" class="${any ? "plc-on" : "plc-off"}"/>`;
        power = power && any;
      } else { s += contact(it, x, y0, power); power = power && val(it); }
      x += CW;
    }
    const real = !!v[coil];
    s += `<line x1="${x}" y1="${y0}" x2="${x + 50}" y2="${y0}" class="${power ? "plc-on" : "plc-off"}"/>
      <circle cx="${x + 66}" cy="${y0}" r="15" class="coil ${real ? "on" : ""}"/>
      <text x="${x + 66}" y="${y0 - 22}" class="plc-t3 c b">${esc(coil)}</text><text x="${x + 66}" y="${y0 + 32}" class="plc-t3 c">${esc(a[coil] || "")} = ${real ? 1 : 0}</text>
      <line x1="${x + 81}" y1="${y0}" x2="${x + 120}" y2="${y0}" class="${power ? "plc-on" : "plc-off"}"/>
      <line x1="${x + 120}" y1="14" x2="${x + 120}" y2="${H - 6}" class="rail"/>`;
    return `<div class="plc-rung"><div class="plc-rung-h"><b>Network ${no}</b> ${esc(title)}</div>
      <svg viewBox="0 0 ${W} ${H}" style="max-width:${W}px"><line x1="40" y1="14" x2="40" y2="${H - 6}" class="rail"/>${s}</svg></div>`;
  }
  function ladderAsrs(a) {
    return `<div class="plc-seq">${["Job from fleet manager / MES (OPC UA)", "Travel + lift to bay " + a.target[0] + ", level " + a.target[1], "Fork out, take / put the load", "Back to the I/O conveyor", "Report 'job done' (OPC UA)"]
      .map((t, i) => `<div class="${a.busy && i < 4 ? "on" : ""}"><b>${i + 1}</b>${esc(t)}</div>`).join("")}</div>
      <p class="hint">The crane PLC runs a step sequence (GRAFCET / SFC): each step waits for its sensor before the next one starts.
        Now: ${a.busy ? "busy with '" + esc(a.job) + "'" : "idle, waiting for a job"}. Jobs done: ${a.stores} stored, ${a.retrievals} retrieved.</p>`;
  }

  // ------------------------------------------------------------------ message log
  function log() {
    const protos = [...new Set(D.messages.map((m) => m.proto))].sort();
    const fp = $("plcFiltPlc"), fr = $("plcFiltProto");
    if (fp.options.length !== D.plcs.length + 1) fp.innerHTML = `<option value="">all PLCs</option>` + D.plcs.map((p) => `<option value="${p.id}">${p.id}</option>`).join("");
    const cur = fr.value;
    fr.innerHTML = `<option value="">all protocols</option>` + protos.map((p) => `<option${p === cur ? " selected" : ""}>${esc(p)}</option>`).join("");
    fp.value = fPlc; fr.value = fProto;
    const ms = D.messages.filter((m) => (!fPlc || m.plc === fPlc || m.src === fPlc || m.dst === fPlc) && (!fProto || m.proto === fProto)).slice(0, 120);
    const nm = (x) => NODE_NAME[x] || x;
    $("plcLog").innerHTML = ms.map((m) => `<div class="plc-msg${openMsg === m.n ? " open" : ""}" data-n="${m.n}">
        <span class="muted mono">${hms(m.t)}</span>
        <span class="plc-proto" style="--c:${pcol(m.proto)}">${esc(m.proto)}</span>
        <span><b>${esc(nm(m.src))}</b> → <b>${esc(nm(m.dst))}</b> · ${esc(m.kind)}<br><span class="muted">${esc(m.text)}</span>
        ${openMsg === m.n ? `<code class="plc-data">${esc(JSON.stringify(m.data))}</code>` : ""}</span></div>`).join("") ||
      `<p class="muted">No messages yet – let the simulation run a little.</p>`;
  }

  // ------------------------------------------------------------------ events
  $("plcNet").addEventListener("click", (e) => {
    const g = e.target.closest("[data-plc]"); if (!g) return;
    sel = g.dataset.plc; if (g.dataset.st) selSt = g.dataset.st;
    render();
  });
  $("plcNet").addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.closest("[data-plc]")?.dispatchEvent(new Event("click", { bubbles: true })); });
  $("plcStations").addEventListener("click", (e) => { const b = e.target.closest("[data-st]"); if (b) { selSt = b.dataset.st; render(); } });
  $("plcFiltPlc").addEventListener("change", (e) => { fPlc = e.target.value; log(); });
  $("plcFiltProto").addEventListener("change", (e) => { fProto = e.target.value; log(); });
  $("plcLog").addEventListener("click", (e) => { const r = e.target.closest(".plc-msg"); if (r) { openMsg = openMsg === +r.dataset.n ? null : +r.dataset.n; log(); } });
  $("plcEstop").addEventListener("click", async () => {
    const p = D && D.plcs.find((x) => x.id === sel); if (!p) return;
    const on = !p.estop;
    if (on && !confirm(`Press the E-stop of ${p.id} (${p.name})?\nAll ${p.stations.length} stations stop at once and cannot be started until you release it.`)) return;
    try {
      const r = await fetch("/api/plc", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "estop", plc: p.id, on, user: (localStorage.getItem("scadaUser") || "Operator") }) });
      const j = await r.json();
      if (window.toast) window.toast(j.message || j.error); else if (!j.ok) alert(j.error);
    } catch (err) { alert("Error: " + err.message); }
    load();
  });
  setInterval(() => { if ($("tab-fms").classList.contains("active")) load(); }, 1500);
  const _prev = window.onTabShown;
  window.onTabShown = (name) => { if (_prev) _prev(name); if (name === "fms") load(); };
  if (location.hash === "#fms") setTimeout(load, 300);
})();
