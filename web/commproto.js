/* Communication tab, view "Protocols by layer": static reference of the communication types and the
   typical protocols between every pair of ISA-95 layers, each with a small real message example.
   All protocol choices, ports, speeds and values are typical examples. Grammar markup as in commsim.js:
   [[e:envelope]] [[v:verb]] [[n:field name]] [[d:data]] [[a:answer]] [[c:comment]]. */
"use strict";

(() => {
  const byId = (id) => document.getElementById(id);
  const escH = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const grammar = (g) => escH(g).replace(/\[\[([evndac]):([\s\S]*?)\]\]/g, '<span class="g-$1">$2</span>');

  // ---- the 5 communication types -------------------------------------------------------------
  const TYPES = {
    req: { icon: "⇄", name: "Request / response", c: "#2a78d6",
      how: "A client asks, the server answers. Like a phone call: one question, one answer.",
      when: "Read a value, start a job, ask for stock.",
      pic: "Client ─question─▶ Server\nClient ◀──answer── Server" },
    pub: { icon: "◎", name: "Publish / subscribe", c: "#c2468f",
      how: "The sender publishes to a topic on a broker. Everybody who subscribed to the topic receives it. Like a radio station.",
      when: "Status, events and data that many systems need.",
      pic: "Machine ─▶ Broker ─▶ MES\n                  ├─▶ SCADA\n                  └─▶ Cloud" },
    doc: { icon: "▤", name: "Document exchange", c: "#6250d6",
      how: "A complete business document (order, invoice, work order) is sent at once and answered later.",
      when: "Business transactions between companies and between ERP and MES.",
      pic: "ERP ─[ORDER]──▶ Supplier\nERP ◀─[CONFIRM]─ Supplier" },
    cyc: { icon: "⟳", name: "Cyclic real-time I/O", c: "#1590a8",
      how: "Fixed small data frames are exchanged again and again in a strict cycle (every 0.25–10 ms), even if nothing changes.",
      when: "Drives, servo axes, remote I/O, valve islands, safety.",
      pic: "PLC ⇄ drive  every 1 ms\n  out: target position\n  in : actual position" },
    sig: { icon: "∿", name: "Signal on a wire", c: "#8c5a2b",
      how: "The value is a current, a voltage or a simple serial line on a sensor cable. No network address.",
      when: "Sensors and actuators connected to the PLC input/output cards.",
      pic: "Sensor ═4–20 mA═▶ PLC AI\nSwitch ═24 V════▶ PLC DI\n(AI/DI = analog/digital in)" },
  };

  const LAYERS = [
    { id: "EXT", lvl: "Outside", name: "Customers, suppliers, banks, carriers", time: "days" },
    { id: "L4", lvl: "Level 4", name: "ERP – business planning", time: "days / hours" },
    { id: "L3", lvl: "Level 3", name: "MES – manufacturing operations", time: "hours / minutes" },
    { id: "L2", lvl: "Level 2", name: "SCADA / HMI / historian / AGV fleet manager / twin", time: "seconds" },
    { id: "L1", lvl: "Level 1", name: "PLC, CNC, robot and AGV controllers", time: "milliseconds" },
    { id: "L0", lvl: "Level 0", name: "Sensors and actuators", time: "micro- to milliseconds" },
  ];

  // ---- protocols on each neighbour link -----------------------------------------------------------
  // p: name, t: type, fmt: data format, net: transport / port, speed, use: used for, ex: example
  const LINKS = [
    { a: "EXT", b: "L4", net: "Internet, encrypted (TLS). Partners never reach the plant network.",
      why: "Different companies, different software: they need a strict, agreed document standard.",
      list: [
        { p: "EDI – EDIFACT / ANSI X12", t: "doc", main: true, fmt: "text segments, ' ends a segment, + separates fields",
          net: "AS2 over HTTPS (443), SFTP or a VAN provider", speed: "minutes – hours",
          use: "ORDERS (order), ORDRSP (confirmation), DESADV (delivery note), INVOIC (invoice), RECADV (receipt)",
          ex: `[[e:UNH+1+]][[v:ORDERS]][[e::D:96A:UN']]          [[c:← message type = purchase order]]
[[n:BGM+220+]][[d:PO-4711]][[n:']]                 [[c:← customer's order number]]
[[n:LIN+1++]][[d:VC20-300]][[n::SA']]              [[c:← item]]
[[n:QTY+21:]][[d:23]][[n:']]                       [[c:← quantity]]
[[n:DTM+2:]][[d:20261115]][[n::102']]              [[c:← wanted delivery date]]
[[e:UNT+5+1']]` },
        { p: "REST API (web portal, e-shop)", t: "req", fmt: "JSON", net: "HTTPS (443)", speed: "seconds",
          use: "small customers without EDI, order status, track & trace",
          ex: `[[v:POST]] [[e:/api/orders]]
{ [[n:"model":]] [[d:"VC20-300"]], [[n:"qty":]] [[d:23]], [[n:"due":]] [[d:"2026-11-15"]] }
[[a:← 201 Created  { "order": "SO-0006" }]]` },
        { p: "Bank: ISO 20022 XML (camt.054)", t: "doc", fmt: "XML", net: "EBICS or SFTP", speed: "daily",
          use: "the bank tells the ERP that the customer has paid",
          ex: `[[e:<Ntry>]]
  [[n:<Amt Ccy="EUR">]][[d:33350.00]][[n:</Amt>]]
  [[n:<CdtDbtInd>]][[d:CRDT]][[n:</CdtDbtInd>]]   [[c:← money in]]
  [[n:<Ustrd>]][[d:INV-0006]][[n:</Ustrd>]]       [[c:← invoice it pays]]
[[e:</Ntry>]]` },
      ] },
    { a: "L4", b: "L3", net: "Office IT network → firewall / DMZ → plant network.",
      why: "ERP thinks in orders and days, MES in units and minutes. ISA-95 defines the common words.",
      list: [
        { p: "ISA-95 B2MML", t: "doc", main: true, fmt: "XML or JSON, grammar = VERB + NOUN",
          net: "HTTPS web service or message queue", speed: "minutes",
          use: "work orders (ProductionSchedule), results (ProductionPerformance), material, master data",
          ex: `[[e:<]][[v:Process]][[e:ProductionSchedule>]]       [[c:← verb + noun]]
  [[n:<ID>]][[d:WO-0012]][[n:</ID>]]
  [[n:<MaterialDefinitionID>]][[d:VC20-300]][[n:</MaterialDefinitionID>]]
  [[n:<Quantity>]][[d:23]][[n:</Quantity>]]
  [[n:<EndTime>]][[d:2026-11-14T16:00]][[n:</EndTime>]]
[[e:</ProcessProductionSchedule>]]
[[a:← <AcknowledgeProductionSchedule> … Accepted]]` },
        { p: "REST or SOAP web service", t: "req", fmt: "JSON or XML", net: "HTTPS (443)", speed: "seconds",
          use: "quick questions: stock of a material, status of an order",
          ex: `[[v:GET]] [[e:/erp/stock/]][[d:CC20-CAST]]
[[a:← 200 OK  { "on_hand": 15, "on_order": 60 }]]` },
        { p: "Message queue (AMQP, Kafka)", t: "pub", fmt: "JSON", net: "TCP 5672 (AMQP) / 9092 (Kafka)", speed: "seconds, guaranteed",
          use: "messages are stored until the receiver is back online – nothing is lost during an ERP update",
          ex: `[[e:queue:]] [[n:mes.workorders]]
[[e:message:]] { [[n:"verb":]] [[v:"Process"]], [[n:"wo":]] [[d:"WO-0012"]], [[n:"qty":]] [[d:23]] }
[[a:← ack (message removed from queue)]]` },
      ] },
    { a: "L3", b: "L2", net: "Plant network (Ethernet), split into security zones (IEC 62443).",
      why: "MES needs machine states and results within seconds and must send commands safely.",
      list: [
        { p: "OPC UA (client / server)", t: "req", main: true, fmt: "binary UA, typed values with quality and time stamp",
          net: "TCP 4840, signed + encrypted", speed: "100 ms – 1 s",
          use: "read / write values, method calls (start, release), subscriptions, alarms",
          ex: `[[v:Call]] [[n:LoadStation.Release]]( [[d:"WO-0012"]], [[d:"VC20-300"]], [[d:23]] )
[[a:← StatusCode Good]]
[[v:Subscribe]] [[n:HMC-02.State]]  sampling [[d:500 ms]]
[[a:← DataChange  "RUN"  Good  10:42:07.250]]` },
        { p: "MQTT / Sparkplug B (Unified Namespace)", t: "pub", fmt: "JSON or protobuf on a topic tree",
          net: "TCP 1883, 8883 with TLS, via a broker", speed: "≈ 1 s",
          use: "one central data space: every system publishes its state, every system can read it",
          ex: `[[v:PUBLISH]] [[e:topic]] [[n:plant/line1/HMC-02/state]]
{ [[n:"state":]] [[d:"RUN"]], [[n:"serial":]] [[d:"VC20-000112"]], [[n:"oee":]] [[d:0.82]] }
[[c:QoS 1 = delivered at least once; retained = new subscribers get the last value]]` },
        { p: "SQL / historian API", t: "req", fmt: "SQL tables / time series", net: "TCP (1433, 5432 …)", speed: "minutes",
          use: "reports, trends, OEE and quality analysis over hours or months",
          ex: `[[v:SELECT]] avg([[n:vib_mm_s]]) [[v:FROM]] [[n:samples]]
 [[v:WHERE]] [[n:machine]] = [[d:'HMC-02']] [[v:AND]] [[n:t]] > now() - [[d:1 h]]
[[a:← 2.8]]` },
      ] },
    { a: "L2", b: "L1", net: "Control network (industrial Ethernet); Wi-Fi or 5G for AGVs.",
      why: "Every controller brand has its own protocol; OPC UA and MTConnect give one common view.",
      list: [
        { p: "OPC UA (server inside the PLC / CNC)", t: "req", main: true, fmt: "binary UA, information model",
          net: "TCP 4840", speed: "10 – 500 ms", use: "machine state, counters, recipes, NC program transfer, alarms",
          ex: `[[v:Write]] [[n:HMC-02.Program]] = [[d:"O2030_VC20.nc"]]
[[a:← Good]]
[[e:Event]] [[n:AlarmCondition]] [[d:"Spindle vibration high"]] severity [[d:700]]` },
        { p: "MTConnect (CNC machines)", t: "req", fmt: "XML, read-only", net: "HTTP (port 5000 typical)", speed: "≈ 1 s",
          use: "spindle speed, program, part count, execution state of CNC machines",
          ex: `[[v:GET]] [[e:/current]]
[[a:← <Execution>]][[d:ACTIVE]][[a:</Execution>]]
[[a:  <PartCount>]][[d:112]][[a:</PartCount>]]
[[a:  <SpindleSpeed>]][[d:6000]][[a:</SpindleSpeed>]]` },
        { p: "VDA 5050 over MQTT (AGVs)", t: "pub", fmt: "JSON", net: "MQTT 1883 / 8883 over Wi-Fi or 5G",
          speed: "order on demand, state every ≈ 1 s", use: "the fleet manager sends driving orders; each AGV reports position and battery",
          ex: `[[v:PUBLISH]] [[n:uagv/v2/FleetCo/AGV-03/order]]
{ [[n:"orderId":]] [[d:"T-0042"]],
  [[n:"nodes":]] [ {[[n:"nodeId":]] [[d:"RAW_CC"]], [[n:"actions":]] [[[v:"pick"]]]},
           {[[n:"nodeId":]] [[d:"LOAD"]],   [[n:"actions":]] [[[v:"drop"]]]} ] }
[[a:← …/state  { "orderId": "T-0042", "battery": 78, "driving": true }]]` },
        { p: "Vendor PLC protocols: S7, EtherNet/IP CIP, Modbus TCP", t: "req", fmt: "registers / tags (raw numbers)",
          net: "TCP 102 (S7), 44818 (CIP), 502 (Modbus)", speed: "50 – 500 ms",
          use: "HMI panels and older SCADA; you must know the register map",
          ex: `[[v:Read Holding Register]] [[n:40001]]   [[c:(Modbus function 03)]]
[[a:← 2350]]
[[c:register map: 40001 = air pressure × 100  →  23.50 bar]]` },
      ] },
    { a: "L1", b: "L0", net: "Field cables and field buses, inside the machine or the cell.",
      why: "Sensors are simple and must be fast, cheap and robust.",
      list: [
        { p: "IO-Link", t: "sig", main: true, fmt: "small process-data frame + parameters on request",
          net: "3-wire sensor cable (M12), point to point, 230 kbit/s", speed: "≈ 2 ms cycle",
          use: "smart sensors: vibration, pressure, temperature, with diagnosis and device name",
          ex: `[[e:process data]] [[d:0x00 0x2D]]  →  [[d:45]]
[[c:device description (IODD): value × 0.1 = mm/s]]
[[a:→ vibration 4.5 mm/s]]` },
        { p: "4–20 mA / 0–10 V analog", t: "sig", fmt: "a current or a voltage", net: "2-wire cable to an analog input card",
          speed: "continuous", use: "flow meter, pressure transmitter, power meter (old and very common)",
          ex: `[[c:value = min + (I − 4 mA) / 16 mA × (max − min)]]
[[n:I]] = [[d:12 mA]], range [[d:0 … 10 bar]]
[[a:→ 0 + (12 − 4)/16 × 10 = 5 bar]]
[[c:I < 3.6 mA = wire broken (that is why it starts at 4, not 0)]]` },
        { p: "24 V digital I/O", t: "sig", fmt: "on / off", net: "wire to a digital input or output card", speed: "< 1 ms",
          use: "part present, door closed, clamp closed, valve open, lamp on",
          ex: `[[n:I0.3]] (clamp closed)  = [[d:24 V]] → [[a:1 (TRUE)]]
[[n:Q1.0]] (open valve)    = [[d:0 V]]  → [[a:0 (FALSE)]]` },
        { p: "PROFINET IO / EtherCAT", t: "cyc", fmt: "fixed I/O frame", net: "industrial Ethernet, real-time",
          speed: "0.25 – 4 ms cycle", use: "servo drives, remote I/O, valve islands, safety (PROFIsafe / FSoE)",
          ex: `[[e:every 1 ms:]]
 PLC → drive  [[n:target position]] = [[d:125.400 mm]]
 drive → PLC  [[n:actual position]] = [[d:125.398 mm]], [[n:status]] = [[a:OK]]` },
      ] },
  ];

  // ---- connections that skip a layer or stay inside one ------------------------------------
  const OTHER = [
    { a: "L3", b: "L1", title: "MES directly to PLC / CNC (no SCADA in between)", t: "req", p: "OPC UA, MTConnect",
      text: "Modern plants often skip SCADA for orders and results. SCADA then only shows and alarms." },
    { a: "L1", b: "L1", title: "Machine to machine / robot (handshake)", t: "cyc", p: "PROFINET, EtherNet/IP, safety: PROFIsafe",
      text: "Station A sets 'part ready', the robot answers 'part taken'. Safety signals (door, e-stop) use a safety protocol." },
    { a: "L0", b: "L1", title: "Identification: barcode and RFID", t: "sig", p: "GS1-128 barcode, RFID (ISO 15693, UHF EPC)",
      text: "A reader on the conveyor reads the label or tag and gives the text to the PLC (IO-Link or Ethernet)." },
    { a: "L2", b: "EXT", title: "Plant to cloud (analytics, remote service)", t: "pub", p: "MQTT over TLS (8883), HTTPS",
      text: "Data goes out only, through the DMZ. The cloud never sends commands directly to machines." },
    { a: "L2", b: "L2", title: "Twin ↔ browser (this project)", t: "pub", p: "HTTP JSON + Server-Sent Events",
      text: "This twin uses /api/… (request / response) and /api/stream (the server pushes updates to your browser)." },
  ];

  const tag = (id) => `<span class="cm-tag cm-${id}">${id === "EXT" ? "Ext" : id}</span>`;
  const badge = (t) => `<span class="cp-badge" style="--tc:${TYPES[t].c}">${TYPES[t].icon} ${TYPES[t].name}</span>`;
  const LNAME = Object.fromEntries(LAYERS.map((l) => [l.id, l.name.split(" – ")[0].split(" / ")[0]]));

  function protoCard(x) {
    return `<div class="cp-card${x.main ? " main" : ""}" data-t="${x.t}">
      <div class="cp-card-h"><b>${escH(x.p)}</b>${x.main ? '<span class="cp-main">main</span>' : ""}</div>
      ${badge(x.t)}
      <dl class="cp-facts">
        <dt>Used for</dt><dd>${escH(x.use)}</dd>
        <dt>Data format</dt><dd>${escH(x.fmt)}</dd>
        <dt>Transport</dt><dd>${escH(x.net)}</dd>
        <dt>Speed</dt><dd>${escH(x.speed)}</dd>
      </dl>
      <details class="cp-ex"><summary>Example message</summary><pre class="csim-code">${grammar(x.ex)}</pre></details>
    </div>`;
  }

  function render() {
    byId("cpTypes").innerHTML = Object.entries(TYPES).map(([k, t]) => `
      <button class="cp-type" data-t="${k}" style="--tc:${t.c}" aria-pressed="false">
        <span class="cp-type-h"><span class="cp-ico">${t.icon}</span><b>${t.name}</b></span>
        <span class="cp-type-how">${escH(t.how)}</span>
        <pre class="cp-pic">${escH(t.pic)}</pre>
        <span class="cp-type-when"><b>Typical use:</b> ${escH(t.when)}</span>
      </button>`).join("");

    byId("cpSum").innerHTML = `<tr><th>Between</th><th>Main protocol</th><th>Type</th><th>Speed</th><th>Other options</th></tr>` +
      LINKS.map((l) => {
        const m = l.list.find((x) => x.main);
        return `<tr><td class="nowrap">${tag(l.a)} ${LNAME[l.a]} ⇅ ${tag(l.b)} ${LNAME[l.b]}</td>
          <td><b>${escH(m.p)}</b></td><td class="nowrap">${badge(m.t)}</td><td class="nowrap">${escH(m.speed)}</td>
          <td class="small">${l.list.filter((x) => !x.main).map((x) => escH(x.p)).join(" · ")}</td></tr>`;
      }).join("");

    const layerRow = (l) => `<div class="cp-layer cm-${l.id}"><span class="cm-lvl">${l.lvl}</span><b>${escH(l.name)}</b>
      <span class="muted small">works in ${l.time}</span></div>`;
    byId("cpStack").innerHTML = LAYERS.map((l, i) => {
      const k = LINKS[i];
      if (!k) return layerRow(l);
      return layerRow(l) + `<div class="cp-link">
        <div class="cp-wire" aria-hidden="true"><span>▼ orders<br>commands</span><i></i><span>results ▲<br>data, alarms</span></div>
        <div class="cp-link-body">
          <div class="cp-link-h">${tag(k.a)} ${LNAME[k.a]} ⇅ ${tag(k.b)} ${LNAME[k.b]}</div>
          <p class="cp-why"><b>Why these protocols:</b> ${escH(k.why)} <span class="muted">Network: ${escH(k.net)}</span></p>
          <div class="cp-grid">${k.list.map(protoCard).join("")}</div>
        </div></div>`;
    }).join("");

    byId("cpGLegend").innerHTML = "Message colours: " + [["e", "envelope / header"], ["v", "verb (what to do)"], ["n", "field name"],
      ["d", "data value"], ["a", "answer / result"], ["c", "comment (not sent)"]].map(([c, n]) => `<span class="g-${c}">${n}</span>`).join("");

    byId("cpOther").innerHTML = OTHER.map((o) => `<div class="cp-card" data-t="${o.t}">
      <div class="cp-card-h">${tag(o.a)} ⇄ ${tag(o.b)} <b>${escH(o.title)}</b></div>
      ${badge(o.t)}<p class="cp-why"><b>${escH(o.p)}</b><br>${escH(o.text)}</p></div>`).join("");
  }

  render();
  // /?cmmode=proto&cpopen=1#comm opens every example (for printing / screenshots)
  if (new URLSearchParams(location.search).get("cpopen")) document.querySelectorAll(".cp-ex").forEach((d) => { d.open = true; });

  // click a communication type -> highlight the protocols of that type
  let sel = null;
  byId("cpTypes").addEventListener("click", (e) => {
    const b = e.target.closest(".cp-type");
    if (!b) return;
    sel = sel === b.dataset.t ? null : b.dataset.t;
    document.querySelectorAll(".cp-type").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.t === sel)));
    byId("cmProto").classList.toggle("cp-filtering", !!sel);
    document.querySelectorAll("#cmProto .cp-card").forEach((c) => c.classList.toggle("hit", c.dataset.t === sel));
  });
})();
