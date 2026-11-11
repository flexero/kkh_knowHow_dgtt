/* Communication simulation (teaching mode): one customer order, step by step.
   Upper part  = information world: envelopes fly between Customer, ERP, MES, SCADA, PLCs (ISA-95 layers).
   Lower part  = physical world: truck, AS/RS crane, AGV, the part moving through the machines.
   Every step shows the real message with its grammar (colour-coded). All values are examples. */
"use strict";
(function () {
  const svg = document.getElementById("csimSvg");
  if (!svg) return;
  const NS = "http://www.w3.org/2000/svg";
  const byId = (i) => document.getElementById(i);
  const escH = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function mk(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  /* ------------------------------------------------------------ geometry */
  const FAM = {
    edi: { c: "#6250d6", n: "EDI / EDIFACT (business documents)" },
    b2m: { c: "#2a78d6", n: "ISA-95 B2MML / REST (ERP ↔ MES)" },
    opc: { c: "#1590a8", n: "OPC UA (MES/SCADA ↔ PLC, CNC)" },
    mqtt: { c: "#c2468f", n: "MQTT publish / subscribe" },
    vda: { c: "#8c5a2b", n: "VDA 5050 (AGV over MQTT)" },
    field: { c: "#6b6a65", n: "Field: 4–20 mA, IO-Link, barcode" },
  };
  const BANDS = [
    { y: 8, h: 68, a: "Outside", b: "customers, suppliers", L: "EXT" },
    { y: 84, h: 60, a: "Level 4", b: "ERP", L: "L4" },
    { y: 152, h: 60, a: "Level 3", b: "MES", L: "L3" },
    { y: 220, h: 64, a: "Level 2", b: "SCADA", L: "L2" },
    { y: 300, h: 70, a: "Level 1", b: "control", L: "L1" },
    { y: 384, h: 300, a: "Level 0", b: "shop floor", L: "L0" },
  ];
  const NODE0 = {
    SUP: { x: 215, y: 42, w: 150, h: 44, t: "Supplier", s: "Foundry A", L: "EXT" },
    CUS: { x: 1080, y: 42, w: 170, h: 44, t: "Customer", s: "Delta Compressors", L: "EXT" },
    ERP: { x: 620, y: 114, w: 380, h: 44, t: "ERP", s: "waiting for orders", L: "L4" },
    MES: { x: 620, y: 182, w: 380, h: 44, t: "MES", s: "waiting for work orders", L: "L3" },
    FLEET: { x: 300, y: 252, w: 190, h: 44, t: "AGV fleet manager", s: "AGV-02 parked", L: "L2" },
    SCADA: { x: 700, y: 252, w: 300, h: 44, t: "SCADA / HMI / MQTT broker / twin", s: "monitoring 6 machines", L: "L2" },
    P_ASRS: { x: 230, y: 335, w: 120, h: 40, t: "PLC AS/RS raw", s: "", L: "L1" },
    P_LOAD: { x: 380, y: 335, w: 120, h: 40, t: "PLC load station", s: "", L: "L1" },
    CNC: { x: 520, y: 335, w: 120, h: 40, t: "CNC controller", s: "program VC30", L: "L1" },
    P_ASSY: { x: 660, y: 335, w: 120, h: 40, t: "PLC assembly", s: "", L: "L1" },
    P_TEST: { x: 800, y: 335, w: 120, h: 40, t: "PLC test bench", s: "", L: "L1" },
    P_FG: { x: 950, y: 335, w: 120, h: 40, t: "PLC AS/RS FG", s: "", L: "L1" },
    M_ASRS: { x: 230, y: 460, w: 112, h: 80, t: "AS/RS raw", s: "5 bins", L: "L0", mach: 1, rack: 5, unit: "bins" },
    M_LOAD: { x: 380, y: 460, w: 112, h: 80, t: "Load + serial st.", s: "idle", L: "L0", mach: 1 },
    M_HMC: { x: 520, y: 460, w: 112, h: 80, t: "HMC-02 machining", s: "idle · tools VC30", L: "L0", mach: 1 },
    M_ASSY: { x: 660, y: 460, w: 112, h: 80, t: "Assembly", s: "idle", L: "L0", mach: 1 },
    M_TEST: { x: 800, y: 460, w: 112, h: 80, t: "Test bench", s: "idle", L: "L0", mach: 1 },
    M_FG: { x: 950, y: 460, w: 112, h: 80, t: "AS/RS finished", s: "0 units", L: "L0", mach: 1, rack: 0, unit: "units" },
  };
  const LINKS = [["CUS", "ERP"], ["SUP", "ERP"], ["ERP", "MES"], ["MES", "SCADA"], ["MES", "FLEET"],
    ["SCADA", "P_ASRS"], ["SCADA", "P_LOAD"], ["SCADA", "CNC"], ["SCADA", "P_ASSY"], ["SCADA", "P_TEST"], ["SCADA", "P_FG"],
    ["P_ASRS", "M_ASRS"], ["P_LOAD", "M_LOAD"], ["CNC", "M_HMC"], ["P_ASSY", "M_ASSY"], ["P_TEST", "M_TEST"], ["P_FG", "M_FG"]];
  const LANE = 600, CONV = 528, INY = 470, ONAGV = 584, TRUCKY = 462;
  const SCAN = { x: 120, y: 512 }, VIB = { x: 464, y: 470 }, FLOW = { x: 744, y: 470 };

  let NODE = {}, LINK = {}, OBJ = {}, gTop = null;

  /* ------------------------------------------------------------ drawing */
  function build() {
    svg.textContent = "";
    NODE = JSON.parse(JSON.stringify(NODE0));
    LINK = {}; OBJ = {};
    const gBand = mk("g", {}, svg);
    BANDS.forEach((b, i) => {
      mk("rect", { x: 0, y: b.y, width: 1200, height: b.h, rx: 6, class: "csim-band" + (i % 2 ? " alt" : "") }, gBand);
      const t = mk("text", { x: 10, y: b.y + 20, class: "csim-bandt cm-" + b.L }, gBand);
      mk("tspan", { x: 10, class: "a" }, t, b.a);
      mk("tspan", { x: 10, dy: 14, class: "b" }, t, b.b);
    });
    // floor furniture
    const gF = mk("g", {}, svg);
    mk("line", { x1: 380, y1: CONV, x2: 800, y2: CONV, class: "csim-conv" }, gF);
    mk("text", { x: 590, y: CONV + 16, class: "csim-small" }, gF, "pallet conveyor");
    mk("line", { x1: 90, y1: LANE, x2: 1140, y2: LANE, class: "csim-lane" }, gF);
    mk("text", { x: 1140, y: LANE + 26, class: "csim-small end" }, gF, "AGV route");
    mk("rect", { x: 84, y: 436, width: 72, height: 52, rx: 4, class: "csim-dock" }, gF);
    mk("text", { x: 120, y: 672, class: "csim-small" }, gF, "goods in");
    mk("rect", { x: 1059, y: 436, width: 72, height: 52, rx: 4, class: "csim-dock" }, gF);
    mk("text", { x: 1095, y: 672, class: "csim-small" }, gF, "goods out");
    // links
    const gL = mk("g", {}, svg);
    LINKS.forEach(([a, b]) => {
      const p = clip(NODE[a], NODE[b]), q = clip(NODE[b], NODE[a]);
      LINK[key(a, b)] = mk("line", { x1: p.x, y1: p.y, x2: q.x, y2: q.y,
        class: "csim-link" + (NODE[b].mach ? " wire" : "") }, gL);
    });
    // nodes
    const gN = mk("g", {}, svg);
    for (const id in NODE) drawNode(id, gN);
    // sensors
    sensor(gN, SCAN, "scanner", "middle", 0, 16);
    sensor(gN, VIB, "vib.", "end", -8, 4);
    sensor(gN, FLOW, "flow", "end", -8, 4);
    mk("circle", { cx: 576, cy: 470, r: 4, class: "csim-sensor" }, gN);
    mk("text", { x: 584, y: 474, class: "csim-small start" }, gN, "temp");
    // moving objects
    const gO = mk("g", {}, svg);
    OBJ.truckIn = obj(truck("Foundry A"), -110, TRUCKY, gO, false);
    OBJ.crate = obj(crate(), -118, TRUCKY - 2, gO, false);
    OBJ.truckOut = obj(truck("to Delta"), 1330, TRUCKY, gO, false);
    OBJ.fgload = obj(fgload(), 950, INY, gO, false);
    OBJ.agv = obj(agv(), 300, LANE, gO, true);
    OBJ.part = obj(mk("g", {}), 230, INY, gO, false);
    gTop = mk("g", {}, svg);
  }
  function sensor(g, p, label, anchor, dx, dy) {
    mk("circle", { cx: p.x, cy: p.y, r: 4, class: "csim-sensor" }, g);
    mk("text", { x: p.x + dx, y: p.y + dy, class: "csim-small " + anchor }, g, label);
  }
  function drawNode(id, parent) {
    const n = NODE[id];
    const g = mk("g", { class: `csim-node cm-${n.L}${n.mach ? " mach" : ""}` }, parent);
    mk("rect", { x: n.x - n.w / 2, y: n.y - n.h / 2, width: n.w, height: n.h, rx: n.mach ? 6 : 8 }, g);
    if (!n.mach) {
      mk("text", { x: n.x, y: n.y - 4, class: "csim-t" }, g, n.t);
      n.st = mk("text", { x: n.x, y: n.y + 12, class: "csim-s" }, g, n.s);
    } else {
      mk("text", { x: n.x, y: n.y - 24, class: "csim-mt" }, g, n.t);
      n.light = mk("circle", { cx: n.x + n.w / 2 - 9, cy: n.y - 31, r: 4.5, class: "csim-light idle" }, g);
      n.st = mk("text", { x: n.x, y: n.y + 33, class: "csim-ms" }, g, n.s);
      if (n.rack != null) { n.rackG = mk("g", {}, g); drawRack(n); }
    }
    n.g = g;
  }
  function drawRack(n) {
    n.rackG.textContent = "";
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const i = r * 4 + c;
      mk("rect", { x: n.x - 33 + c * 17, y: n.y - 15 + (2 - r) * 12, width: 14, height: 9, rx: 1.5,
        class: "csim-slot" + (i < Math.min(12, n.rack) ? " full" : "") }, n.rackG);
    }
    n.st.textContent = `${n.rack} ${n.unit}`;
  }
  function truck(label) {
    const g = mk("g", {});
    mk("rect", { x: -34, y: -18, width: 52, height: 34, rx: 3, class: "csim-truck" }, g);
    mk("rect", { x: 18, y: -10, width: 16, height: 26, rx: 3, class: "csim-cab" }, g);
    [-22, 6, 26].forEach((x) => mk("circle", { cx: x, cy: 18, r: 4.5, class: "csim-wheel" }, g));
    mk("text", { x: -8, y: -22, class: "csim-small" }, g, label);
    return g;
  }
  function crate() {
    const g = mk("g", {});
    mk("rect", { x: -15, y: -11, width: 30, height: 22, rx: 2, class: "csim-crate" }, g);
    mk("text", { x: 0, y: 4, class: "csim-tiny" }, g, "60");
    return g;
  }
  function fgload() {
    const g = mk("g", {});
    mk("rect", { x: -17, y: -12, width: 34, height: 24, rx: 2, class: "csim-box" }, g);
    mk("text", { x: 0, y: 4, class: "csim-tiny dark" }, g, "×23");
    return g;
  }
  function agv() {
    const g = mk("g", {});
    mk("rect", { x: -24, y: -8, width: 48, height: 16, rx: 4, class: "csim-agv" }, g);
    mk("text", { x: 0, y: 3.5, class: "csim-tiny" }, g, "AGV-02");
    return g;
  }
  function obj(g, x, y, parent, vis) {
    parent.appendChild(g);
    const o = { g, x, y };
    setPos(o, x, y);
    g.style.display = vis ? "" : "none";
    return o;
  }
  function setPos(o, x, y) { o.x = x; o.y = y; o.g.setAttribute("transform", `translate(${x},${y})`); }
  function setShape(kind, label) {
    const g = OBJ.part.g;
    g.textContent = "";
    if (kind === "casting") mk("rect", { x: -11, y: -8, width: 22, height: 16, rx: 2, class: "csim-cast" }, g);
    if (kind === "clamped" || kind === "machined") {
      mk("rect", { x: -14, y: 6, width: 28, height: 4, class: "csim-pallet" }, g);
      mk("rect", { x: -11, y: -9, width: 22, height: 15, rx: 2, class: kind === "machined" ? "csim-mach" : "csim-cast" }, g);
      if (kind === "machined") [-5, 5].forEach((x) => mk("circle", { cx: x, cy: -2, r: 3, class: "csim-bore" }, g));
    }
    if (kind === "compressor") {
      mk("ellipse", { cx: 0, cy: 6, rx: 15, ry: 5, class: "csim-tank" }, g);
      mk("rect", { x: -8, y: -12, width: 16, height: 14, rx: 2, class: "csim-mach" }, g);
      mk("path", { d: "M-8 -12 L-13 -18 M8 -12 L13 -18", class: "csim-cyl" }, g);
    }
    if (kind === "box") {
      mk("rect", { x: -12, y: -10, width: 24, height: 20, rx: 2, class: "csim-box" }, g);
      mk("text", { x: 0, y: 3, class: "csim-tiny dark" }, g, "VC20");
    }
    if (label) mk("text", { x: 0, y: -20, class: "csim-plabel" }, g, label);
  }
  const key = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
  function clip(n, p) {
    const dx = p.x - n.x, dy = p.y - n.y;
    const t = Math.min(dx ? n.w / 2 / Math.abs(dx) : Infinity, dy ? n.h / 2 / Math.abs(dy) : Infinity, 1);
    return { x: n.x + dx * t, y: n.y + dy * t };
  }
  function resolve(route) {
    const raw = route.map((r) => (typeof r === "string" ? { x: NODE[r].x, y: NODE[r].y } : r.obj ? { x: OBJ[r.obj].x, y: OBJ[r.obj].y } : r));
    if (typeof route[0] === "string") raw[0] = clip(NODE[route[0]], raw[1]);
    const L = route.length - 1;
    if (typeof route[L] === "string") raw[L] = clip(NODE[route[L]], raw[L - 1]);
    return raw;
  }
  function poly(pts) {
    const segs = [];
    let L = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], d = Math.hypot(b.x - a.x, b.y - a.y);
      segs.push({ a, b, d, s: L });
      L += d;
    }
    return {
      L,
      at(dist) {
        if (!segs.length) return pts[0];
        const s = segs.find((x) => dist <= x.s + x.d) || segs[segs.length - 1];
        const k = s.d ? Math.max(0, Math.min(1, (dist - s.s) / s.d)) : 1;
        return { x: s.a.x + (s.b.x - s.a.x) * k, y: s.a.y + (s.b.y - s.a.y) * k };
      },
    };
  }

  /* ------------------------------------------------------------ animation engine */
  let gen = 0, instant = false, speed = 1;
  const ABORT = { abort: true };
  const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  function tween(ms, fn) {
    const my = gen;
    if (instant || ms <= 0) { fn(1); return Promise.resolve(); }
    const dur = ms / speed;
    return new Promise((res, rej) => {
      const t0 = performance.now();
      function f(now) {
        if (my !== gen) return rej(ABORT);
        const k = Math.min(1, (now - t0) / dur);
        fn(k);
        if (k < 1) requestAnimationFrame(f); else res();
      }
      requestAnimationFrame(f);
    });
  }
  function hit(id) {
    if (instant) return;
    const g = NODE[id] && NODE[id].g;
    if (!g) return;
    g.classList.remove("hit"); void g.getBBox(); g.classList.add("hit");
    setTimeout(() => g.classList.remove("hit"), 900);
  }
  function envelope(label, fam, ack) {
    const g = mk("g", { class: "csim-env" }, gTop);
    const text = (ack ? "↩ " : "✉ ") + label;
    const w = text.length * 6.4 + 18;
    mk("rect", { x: -w / 2, y: -11, width: w, height: 22, rx: 11, fill: FAM[fam].c, class: ack ? "ack" : "" }, g);
    mk("text", { x: 0, y: 4, class: "csim-envt" }, g, text);
    return g;
  }
  const A = {
    wait: (ms) => tween(ms, () => {}),
    async msg(route, label, fam, o = {}) {
      if (instant) return;
      const P = poly(resolve(route));
      const lit = [];
      for (let i = 0; i < route.length - 1; i++) {
        const l = typeof route[i] === "string" && typeof route[i + 1] === "string" && LINK[key(route[i], route[i + 1])];
        if (l) { l.classList.add("on"); l.style.stroke = FAM[fam].c; lit.push(l); }
      }
      if (typeof route[0] === "string") hit(route[0]);
      const env = envelope(label, fam, o.ack);
      try {
        await tween(Math.max(1000, P.L * 3.4), (k) => {
          const p = P.at(ease(k) * P.L);
          env.setAttribute("transform", `translate(${p.x},${p.y})`);
        });
      } finally {
        env.remove();
        lit.forEach((l) => { l.classList.remove("on"); l.style.stroke = ""; });
      }
      const last = route[route.length - 1];
      if (typeof last === "string") hit(last);
    },
    status(id, text) { NODE[id].st.textContent = text; hit(id); },
    state(id, st, text) {
      const n = NODE[id];
      n.light.setAttribute("class", "csim-light " + st);
      n.g.classList.toggle("busy", st === "run" || st === "setup");
      if (text != null) n.st.textContent = text;
    },
    place(id, x, y) { setPos(OBJ[id], x, y); },
    show(id, v) { OBJ[id].g.style.display = v ? "" : "none"; },
    shape(kind, label) { setShape(kind, label); },
    async move(ids, pts, msPerPx = 5) {
      ids = [].concat(ids);
      const lead = OBJ[ids[0]];
      const offs = ids.map((i) => ({ o: OBJ[i], dx: OBJ[i].x - lead.x, dy: OBJ[i].y - lead.y }));
      const P = poly([{ x: lead.x, y: lead.y }, ...pts]);
      await tween(P.L * msPerPx, (k) => {
        const p = P.at(ease(k) * P.L);
        offs.forEach(({ o, dx, dy }) => setPos(o, p.x + dx, p.y + dy));
      });
    },
    async rack(id, target, ms = 0) {
      const n = NODE[id], from = n.rack;
      await tween(ms, (k) => { const v = Math.round(from + (target - from) * k); if (v !== n.rack || k === 1) { n.rack = v; drawRack(n); } });
    },
    async stream(route, ms, fam, label) {
      if (instant) return;
      const pts = resolve(route), P = poly(pts), my = gen;
      let tag = null;
      if (label) {
        const m = P.at(P.L / 2);
        tag = mk("text", { x: m.x + 8, y: m.y, class: "csim-streamt", fill: FAM[fam].c }, gTop, label);
      }
      const end = performance.now() + ms / speed;
      try {
        while (performance.now() < end) {
          if (my !== gen) throw ABORT;
          const dot = mk("circle", { r: 3.4, fill: FAM[fam].c, class: "csim-dot" }, gTop);
          tween(900, (k) => { const p = P.at(k * P.L); dot.setAttribute("cx", p.x); dot.setAttribute("cy", p.y); })
            .then(() => dot.remove(), () => dot.remove());
          await A.wait(170);
        }
        await A.wait(900);
      } finally { if (tag) tag.remove(); }
    },
    async counter(id, ms, fmt) {
      await tween(ms, (k) => { NODE[id].st.textContent = fmt(k); });
    },
  };

  /* ------------------------------------------------------------ the story: 20 steps */
  const STAGES = ["Order", "Planning", "Material", "Released", "Production", "Tested", "In stock", "Shipped", "Paid"];
  const S = [
    {
      t: "Customer sends a purchase order", stage: 0, who: [["CUS", "ERP"]], fam: "edi", gname: "EDIFACT ORDERS (purchase order)",
      what: "The customer's purchasing computer sends a purchase order directly to our ERP. Nobody types anything: the ERP reads the message and creates sales order SO-0006.",
      phys: "Nothing moves in the factory yet. Only information travels.",
      read: ["Each line is a <b>segment</b> = one sentence. It ends with <code>'</code>.",
        "<code>+</code> separates the words (data elements); <code>:</code> separates parts of one word.",
        "The first 3 letters say what the sentence is about: <code>BGM</code> = document, <code>NAD</code> = name/address, <code>QTY</code> = quantity.",
        "Codes such as <code>220</code>, <code>21</code>, <code>BY</code> come from the UN/EDIFACT code lists, so every computer in the world reads them the same way."],
      g: `[[e:UNB+UNOC:3+DELTA001:ZZ+VCFACTORY:ZZ+261109:0815+000123']]  [[c:← envelope: from, to, date, number]]
[[e:UNH+1+]][[v:ORDERS]][[e::D:96A:UN']]                [[c:← message type = the verb]]
[[n:BGM+220+]][[d:PO-88231]][[n:+9']]                   [[c:← 220 = order, 9 = original]]
[[n:DTM+2:]][[d:20261111]][[n::102']]                   [[c:← 2 = delivery date wanted]]
[[n:NAD+BY+]][[d:DELTA001]][[n:::92']]                  [[c:← BY = buyer]]
[[n:LIN+1++]][[d:VC20-300]][[n::SA']]                   [[c:← line 1: article]]
[[n:QTY+21:]][[d:23]][[n:']]                            [[c:← 21 = ordered quantity]]
[[n:PRI+AAA:]][[d:1450]][[n:']]                         [[c:← price per unit]]
[[e:UNT+8+1']]                                          [[c:← end: 8 segments]]
[[e:UNZ+1+000123']]`,
      run: async () => {
        A.status("CUS", "sends purchase order PO-88231");
        await A.msg(["CUS", "ERP"], "EDI ORDERS", "edi");
        A.status("ERP", "SO-0006: 23 × VC20-300, due 11 Nov");
      },
    },
    {
      t: "ERP confirms the order", stage: 0, who: [["ERP", "CUS"]], fam: "edi", gname: "EDIFACT ORDRSP (order response)",
      what: "Every request needs an answer. The ERP checks capacity and material, then promises a delivery date.",
      phys: "Still only information.",
      read: ["The verb changes: <code>ORDRSP</code> = order response.",
        "<code>RFF+ON</code> refers to the customer's original order number, so their computer knows which order is answered.",
        "Status code <code>29</code> = accepted without change. Other codes mean 'changed' or 'rejected'."],
      g: `[[e:UNH+1+]][[v:ORDRSP]][[e::D:96A:UN']]                [[c:← order response]]
[[n:BGM+231+]][[d:SO-0006]][[n:+]][[a:29]][[n:']]                [[c:← 29 = accepted without change]]
[[n:RFF+ON:]][[d:PO-88231]][[n:']]                      [[c:← answers the customer's order]]
[[n:DTM+2:]][[d:20261111]][[n::102']]                   [[c:← we promise this date]]
[[n:LIN+1++]][[d:VC20-300]][[n::SA']]
[[n:QTY+21:]][[d:23]][[n:']]
[[e:UNT+7+1']]`,
      run: async () => {
        await A.msg(["ERP", "CUS"], "EDI ORDRSP", "edi", { ack: 1 });
        A.status("CUS", "order confirmed for 11 Nov");
      },
    },
    {
      t: "MRP calculates what to make and what to buy", stage: 1, who: [["ERP", "ERP"]], fam: "b2m", gname: "Inside the ERP: MRP (a calculation, not a message)",
      what: "MRP (Material Requirements Planning) runs every hour. Output: work orders (make) and purchase orders (buy).",
      phys: "Nothing moves. The ERP only calculates.",
      read: ["Make-to-order: one work order for exactly this customer order.",
        "For each material: need + safety stock − stock on hand − already ordered. If the result is above 0, the ERP buys, rounded up to the supplier's lot size."],
      g: `[[c:Make-to-order: work order for exactly this customer order]]
work order quantity = [[d:23]] × VC20-300

[[c:Material CC20-CAST (1 casting per compressor)]]
net = need + safety − on hand − on order
    = [[d:23]]  + [[d:20]]     − [[d:15]]      − [[d:0]]       = [[a:28]]
[[c:→ purchase order, rounded up to the lot size]] [[a:60]]`,
      run: async () => {
        A.status("ERP", "MRP running …");
        await A.wait(1600);
        A.status("ERP", "MRP: make 23 × VC20 · buy 60 castings");
      },
    },
    {
      t: "ERP sends a purchase order to the supplier", stage: 1, who: [["ERP", "SUP"]], fam: "edi", gname: "EDIFACT ORDERS (now WE are the buyer)",
      what: "The same message type as step 1, but in the other direction: now our factory is the customer of the foundry.",
      phys: "The foundry starts to prepare 60 castings.",
      read: ["Same grammar as step 1: the roles in <code>NAD+BY</code> (buyer) and <code>NAD+SU</code> (supplier) are swapped.",
        "<code>BP</code> = buyer's part number (our number for the casting)."],
      g: `[[e:UNH+1+]][[v:ORDERS]][[e::D:96A:UN']]
[[n:BGM+220+]][[d:PO-0009]][[n:+9']]
[[n:DTM+2:]][[d:20261110]][[n::102']]                   [[c:← lead time 16 h → tomorrow]]
[[n:NAD+BY+]][[d:VCFACTORY]][[n:::92']]                 [[c:← now WE are the buyer]]
[[n:NAD+SU+]][[d:FOUNDRY-A]][[n:::92']]
[[n:LIN+1++]][[d:CC20-CAST]][[n::BP']]                  [[c:← BP = buyer's part number]]
[[n:QTY+21:]][[d:60]][[n:']]
[[e:UNT+8+1']]`,
      run: async () => {
        await A.msg(["ERP", "SUP"], "EDI ORDERS", "edi");
        A.status("SUP", "PO-0009: 60 × CC20 castings");
      },
    },
    {
      t: "Supplier announces the delivery, the truck arrives", stage: 2, who: [["SUP", "ERP"]], fam: "edi", gname: "EDIFACT DESADV (despatch advice)",
      what: "Before the truck arrives, the supplier tells the ERP what is coming, how many and which lot. The ERP can prepare the goods receipt.",
      phys: "The truck with a pallet of 60 castings drives to the goods-in dock.",
      read: ["<code>DESADV</code> = 'the truck is coming'.", "<code>GIN+BX</code> = batch (lot) number: the key for traceability later.",
        "<code>DTM+17</code> = estimated arrival; format <code>203</code> = date + time."],
      g: `[[e:UNH+1+]][[v:DESADV]][[e::D:96A:UN']]                [[c:← despatch advice]]
[[n:BGM+351+]][[d:DN-55120]][[n:+9']]
[[n:RFF+ON:]][[d:PO-0009]][[n:']]                       [[c:← our order number]]
[[n:DTM+17:]][[d:202611100600]][[n::203']]              [[c:← arrives 10 Nov 06:00]]
[[n:LIN+1++]][[d:CC20-CAST]][[n::BP']]
[[n:QTY+12:]][[d:60]][[n:']]                            [[c:← 12 = despatched quantity]]
[[n:GIN+BX+]][[d:FA-L0009]][[n:']]                      [[c:← lot number]]
[[e:UNT+8+1']]`,
      run: async () => {
        await A.msg(["SUP", "ERP"], "EDI DESADV", "edi");
        A.status("ERP", "PO-0009 on the way · lot FA-L0009");
        A.show("truckIn", 1); A.show("crate", 1);
        await A.move(["truckIn", "crate"], [{ x: 120, y: TRUCKY }], 5);
        A.status("SUP", "truck delivered");
      },
    },
    {
      t: "Goods receipt: scan, book, store", stage: 2, who: [["L0", "MES"], ["MES", "ERP"], ["MES", "P_ASRS"]], fam: "field", gname: "GS1-128 barcode + OPC UA method call",
      what: "A worker scans the pallet label. The MES/WMS checks it against the DESADV, the ERP books +60 in stock, and the AS/RS PLC gets a 'store' command.",
      phys: "The crane stores the pallet in the raw-material AS/RS. The truck leaves.",
      read: ["Barcode grammar: numbers in brackets are <b>Application Identifiers</b>: <code>(02)</code> product, <code>(10)</code> lot, <code>(37)</code> quantity.",
        "OPC UA: <code>Call</code> = run a function in the PLC. <code>ns=2;s=…</code> is the address (NodeId) of that function.",
        "The answer always contains a <b>StatusCode</b>: Good, or Bad_… with the reason."],
      g: `[[c:Pallet label, read by the scanner:]]
[[e:(02)]][[d:04012345000017]] [[e:(10)]][[d:FA-L0009]] [[e:(37)]][[d:60]]
[[c:(02) = product GTIN   (10) = lot   (37) = quantity]]

[[c:MES/WMS → AS/RS PLC, through SCADA (OPC UA):]]
[[v:Call]] [[n:ns=2;s=ASRS-RAW.Store]]
     ( [[d:"FA-L0009"]], [[d:"CC20-CAST"]], [[d:60]] )
[[a:→ StatusCode Good · slot R04-C2]]`,
      run: async () => {
        await A.msg([SCAN, "MES"], "GS1-128 scan", "field");
        await A.msg(["MES", "ERP"], "goods receipt", "b2m");
        A.status("ERP", "stock CC20-CAST +60 · lot FA-L0009");
        await A.msg(["MES", "SCADA", "P_ASRS"], "OPC UA Call Store", "opc");
        A.status("P_ASRS", "store FA-L0009");
        A.state("M_ASRS", "run", "crane storing");
        await A.move(["crate"], [{ x: 170, y: 440 }, { x: 230, y: INY }], 5);
        A.show("crate", 0);
        await A.rack("M_ASRS", 6);
        A.state("M_ASRS", "idle");
        await A.move(["truckIn"], [{ x: -120, y: TRUCKY }], 4);
        A.show("truckIn", 0);
      },
    },
    {
      t: "ERP sends the work order to the MES", stage: 3, who: [["ERP", "MES"]], fam: "b2m", gname: "ISA-95 B2MML ProcessProductionSchedule (shortened)",
      what: "The ERP tells the MES WHAT to make and WHEN: 23 × VC20-300, finished by 11 Nov. HOW to make it (route, machines, programs) is the MES's job.",
      phys: "Nothing moves yet. The message passes the firewall/DMZ between the office network and the plant network.",
      read: ["B2MML grammar = <b>verb + noun</b>: verb <code>Process</code> (do it), noun <code>ProductionSchedule</code>.",
        "<code>ApplicationArea</code> = envelope (who, when). <code>DataArea</code> = verb + noun + data.",
        "The names (ProductionRequest, MaterialDefinitionID…) come from the ISA-95 standard dictionary."],
      g: `[[e:<]][[v:Process]][[n:ProductionSchedule]][[e: xmlns="http://www.mesa.org/xml/B2MML">]]
 [[e:<ApplicationArea>]]
   [[e:<Sender><LogicalID>]][[d:ERP]][[e:</LogicalID></Sender>]]
   [[e:<CreationDateTime>]][[d:2026-11-09T08:20:00Z]][[e:</CreationDateTime>]]
 [[e:</ApplicationArea>]]
 [[e:<DataArea>]]
   [[v:<Process/>]]                                  [[c:← verb]]
   [[n:<ProductionSchedule><ProductionRequest>]]     [[c:← noun]]
     [[n:<ID>]][[d:WO-0012]][[n:</ID>]]
     [[n:<Priority>]][[d:3]][[n:</Priority>]]
     [[n:<EndTime>]][[d:2026-11-11T08:00:00Z]][[n:</EndTime>]]
     [[n:<MaterialProducedRequirement>]]
       [[n:<MaterialDefinitionID>]][[d:VC20-300]][[n:</MaterialDefinitionID>]]
       [[n:<Quantity>]][[d:23]][[n:</Quantity>]]
     [[n:</MaterialProducedRequirement>]]
   [[n:</ProductionRequest></ProductionSchedule>]]
 [[e:</DataArea>]]
[[e:</]][[v:Process]][[n:ProductionSchedule]][[e:>]]`,
      run: async () => {
        await A.msg(["ERP", "MES"], "B2MML ProductionSchedule", "b2m");
        A.status("MES", "WO-0012: 23 × VC20-300 (for SO-0006)");
      },
    },
    {
      t: "MES acknowledges the work order", stage: 3, who: [["MES", "ERP"]], fam: "b2m", gname: "B2MML AcknowledgeProductionSchedule",
      what: "The MES answers: 'received and accepted'. Without this answer the ERP would send the order again or raise an alarm.",
      phys: "Nothing moves.",
      read: ["Same noun, new verb: <code>Acknowledge</code>.", "<code>actionCode</code> = Accepted, Modified or Rejected."],
      g: `[[e:<]][[v:Acknowledge]][[n:ProductionSchedule]][[e:>]]
 [[e:<ApplicationArea><Sender><LogicalID>]][[d:MES]][[e:</LogicalID></Sender></ApplicationArea>]]
 [[e:<DataArea>]]
   [[v:<Acknowledge>]]
     [[a:<ResponseCriteria><ResponseExpression actionCode="Accepted"/></ResponseCriteria>]]
   [[v:</Acknowledge>]]
   [[n:<ProductionSchedule><ProductionRequest><ID>]][[d:WO-0012]][[n:</ID></ProductionRequest></ProductionSchedule>]]
 [[e:</DataArea>]]
[[e:</]][[v:Acknowledge]][[n:ProductionSchedule]][[e:>]]`,
      run: async () => {
        await A.msg(["MES", "ERP"], "B2MML Acknowledge", "b2m", { ack: 1 });
        A.status("ERP", "WO-0012 accepted by the MES");
      },
    },
    {
      t: "MES releases the order to the load station", stage: 3, who: [["MES", "P_LOAD"], ["P_LOAD", "MES"]], fam: "opc", gname: "OPC UA Call (method call) + response",
      what: "The dispatching rule (EDD = earliest due date) puts WO-0012 first. The MES calls the 'StartOrder' function in the PLC of the load station. The PLC answers 'Good'.",
      phys: "The load station shows 'ready: WO-0012' on its screen.",
      read: ["<b>NodeId</b> grammar: <code>ns=2;s=LOAD-CC.Orders</code> = namespace 2, name 'LOAD-CC.Orders'.",
        "Services are the verbs: <code>Read</code>, <code>Write</code>, <code>Browse</code>, <code>Call</code>, <code>Subscribe</code>.",
        "Arguments have <b>data types</b> (String, UInt32…), so the PLC cannot misread a number as text.",
        "Status codes: Good (0x00000000), Uncertain, or Bad_… (e.g. Bad_InvalidState if the station is in maintenance)."],
      g: `[[c:MES (OPC UA client) → PLC load station (OPC UA server)]]
[[v:CallRequest]]
  [[e:ObjectId :]] [[n:ns=2;s=LOAD-CC.Orders]]
  [[e:MethodId :]] [[v:ns=2;s=LOAD-CC.Orders.StartOrder]]
  [[e:InputArguments:]]
    [0] String  [[d:"WO-0012"]]      [[c:← order]]
    [1] String  [[d:"VC20-300"]]     [[c:← material]]
    [2] String  [[d:"VC20_v1"]]      [[c:← recipe]]
    [3] UInt32  [[d:23]]             [[c:← quantity]]
[[v:CallResponse]]
  [[a:StatusCode      : Good (0x00000000)]]
  [[e:OutputArguments :]] [0] UInt32 [[d:1]]   [[c:← position in the queue]]`,
      run: async () => {
        A.status("MES", "rule EDD: WO-0012 is first (due 11 Nov)");
        await A.wait(700);
        await A.msg(["MES", "SCADA", "P_LOAD"], "OPC UA Call StartOrder", "opc");
        A.status("P_LOAD", "order WO-0012");
        A.state("M_LOAD", "ready", "ready: WO-0012");
        await A.msg(["P_LOAD", "SCADA", "MES"], "StatusCode Good", "opc", { ack: 1 });
      },
    },
    {
      t: "AGV brings castings to the load station", stage: 4, who: [["MES", "FLEET"], ["FLEET", "AGV"], ["AGV", "FLEET"]], fam: "vda", gname: "VDA 5050 order (JSON over MQTT)",
      what: "The MES asks the fleet manager for a transport. The fleet manager picks a free AGV and sends it an order: drive to the AS/RS, pick, drive to the load station, drop.",
      phys: "The AGV drives to the AS/RS, the crane hands over a bin of castings, and the AGV brings it to the load station.",
      read: ["MQTT topic grammar: <code>interface / version / manufacturer / serial number / topic</code>. The last word is the verb: <code>order</code>, <code>state</code>, <code>instantActions</code>.",
        "An order is a path of <b>nodes</b> (even sequenceId 0, 2, 4…) and <b>edges</b> (odd 1, 3…).",
        "Actions at nodes: <code>pick</code>, <code>drop</code>. The AGV reports progress on its <code>state</code> topic."],
      g: `[[e:Topic:]] [[n:uagv/v2/AcmeAGV/AGV-02/]][[v:order]]     [[c:← address + verb]]
{ [[e:"headerId": 3412, "timestamp": "2026-11-09T09:02:11Z", "version": "2.0.0",]]
  [[e:"manufacturer": "AcmeAGV", "serialNumber": "AGV-02",]]
  [[n:"orderId":]] [[d:"T00146"]], [[n:"orderUpdateId":]] [[d:0]],
  [[n:"nodes":]] [
    { [[n:"nodeId":]] [[d:"ASRS-RAW-OUT"]], [[n:"sequenceId":]] [[d:0]], "released": true,
      [[n:"actions":]] [{ [[v:"actionType": "pick"]], "actionId": "a1", "blockingType": "HARD" }] },
    { [[n:"nodeId":]] [[d:"LOAD-IN"]], [[n:"sequenceId":]] [[d:2]], "released": true,
      [[n:"actions":]] [{ [[v:"actionType": "drop"]], "actionId": "a2", "blockingType": "HARD" }] } ],
  [[n:"edges":]] [{ [[n:"edgeId":]] [[d:"e1"]], [[n:"sequenceId":]] [[d:1]], "released": true,
              "startNodeId": "ASRS-RAW-OUT", "endNodeId": "LOAD-IN" }] }

[[c:AGV → fleet manager, topic .../AGV-02/state:]]
[[a:{ "orderId": "T00146", "actionStates": [{ "actionId": "a2", "actionStatus": "FINISHED" }],]]
[[a:  "batteryState": { "batteryCharge": 78 } }]]`,
      run: async () => {
        await A.msg(["MES", "FLEET"], "transport request", "vda");
        A.status("FLEET", "T00146: AS/RS → load station");
        await A.msg(["FLEET", { obj: "agv" }], "VDA 5050 order", "vda");
        A.status("FLEET", "AGV-02 driving");
        await A.move(["agv"], [{ x: 230, y: LANE }], 5);
        A.state("M_ASRS", "run", "crane retrieving");
        A.shape("casting", ""); A.place("part", 230, INY); A.show("part", 1);
        await A.rack("M_ASRS", 5);
        await A.move(["part"], [{ x: 230, y: ONAGV }], 6);
        A.state("M_ASRS", "idle");
        await A.move(["agv", "part"], [{ x: 380, y: LANE }], 5);
        await A.move(["part"], [{ x: 380, y: INY }], 6);
        await A.msg([{ obj: "agv" }, "FLEET"], "VDA 5050 state FINISHED", "vda", { ack: 1 });
        A.status("FLEET", "T00146 finished");
      },
    },
    {
      t: "Unit started: serial number marked and reported", stage: 4, who: [["P_LOAD", "MES"]], fam: "opc", gname: "OPC UA subscription (DataChangeNotification)",
      what: "The operator clamps the casting on a pallet; a laser marks the serial number. The PLC reports it, and the MES links serial ↔ work order ↔ customer order ↔ casting lot.",
      phys: "Casting clamped on a fixture pallet, serial VC20-000112 marked.",
      read: ["The MES <b>subscribed once</b>. The PLC sends a message <b>only when the value changes</b>: no polling, little network load.",
        "<code>SequenceNumber</code> lets the MES detect a lost message.",
        "<code>SourceTimestamp</code> = when it happened in the machine (not when it arrived)."],
      g: `[[c:once, at start-up:]]
[[v:CreateMonitoredItems]]  [[n:ns=2;s=LOAD-CC.UnitStarted]]   [[e:SamplingInterval = 100 ms]]

[[c:PLC → MES, only when the value changes:]]
[[v:DataChangeNotification]]
  [[e:SequenceNumber  :]] [[d:5821]]
  [[n:Value           :]] { [[n:"serial":]] [[d:"VC20-000112"]], [[n:"order":]] [[d:"WO-0012"]],
                      [[n:"casting_lot":]] [[d:"FA-L0009"]] }
  [[a:StatusCode      : Good]]
  [[e:SourceTimestamp :]] [[d:2026-11-09T09:14:37.120Z]]`,
      run: async () => {
        A.state("M_LOAD", "run", "clamping + laser marking");
        await A.wait(1500);
        A.shape("clamped", "VC20-000112");
        A.state("M_LOAD", "idle", "done");
        await A.msg(["P_LOAD", "SCADA", "MES"], "OPC UA DataChange", "opc");
        A.status("MES", "VC20-000112 ↔ WO-0012 ↔ SO-0006 ↔ lot FA-L0009");
      },
    },
    {
      t: "Changeover: new NC program for the machining center", stage: 4, who: [["MES", "CNC"], ["CNC", "SCADA"]], fam: "opc", gname: "OPC UA FileTransfer + G-code (ISO 6983)",
      what: "HMC-02 was making VC30. Before the VC20 part arrives, the MES downloads the VC20 program and the tool set is exchanged (state SETUP).",
      phys: "HMC-02 shows SETUP (cyan): program and tools change, about 10 min.",
      read: ["File download = 3 OPC UA method calls: <code>Open</code> → <code>Write</code> → <code>Close</code>.",
        "G-code grammar: <code>N</code> line number, <code>G</code> motion/mode, <code>M</code> machine function, <code>T</code> tool, <code>S</code> spindle speed, <code>F</code> feed."],
      g: `[[c:MES → CNC (OPC UA FileType methods)]]
[[v:Call Open]]( mode = [[d:Write]] )                      [[a:→ fileHandle 7]]
[[v:Call Write]]( fileHandle [[d:7]], data = [[d:<O1020_VC20.nc>]] )
[[v:Call Close]]( fileHandle [[d:7]] )
[[v:Write]] [[n:ns=2;s=HMC-02.ActiveProgram]] = [[d:"O1020"]]  [[a:→ Good]]

[[c:First lines of the NC program:]]
[[n:O1020]] [[c:(VC20 CRANKCASE OP10)]]
[[e:N10]] [[v:G90 G54]]              [[c:← absolute, work offset 1]]
[[e:N20]] [[v:T12 M06]]              [[c:← change to tool 12]]
[[e:N30]] [[v:S1800 M03]]            [[c:← spindle 1800 rpm, clockwise]]
[[e:N40]] [[v:G81]] [[d:Z-42 R2 F240]]      [[c:← drilling cycle, depth 42 mm]]`,
      run: async () => {
        A.state("M_HMC", "setup", "SETUP: VC30 → VC20");
        await A.msg(["MES", "SCADA", "CNC"], "OPC UA FileTransfer", "opc");
        A.status("CNC", "program O1020 (VC20)");
        await A.wait(1700);
        A.state("M_HMC", "ready", "ready for VC20");
        await A.msg(["CNC", "SCADA"], "StatusCode Good", "opc", { ack: 1 });
      },
    },
    {
      t: "Machining: sensor data flows up all the time", stage: 4, who: [["L0", "CNC"], ["CNC", "SCADA"]], fam: "mqtt", gname: "4–20 mA + IO-Link + MQTT publish",
      what: "While HMC-02 cuts, sensors measure vibration, temperature and power. The values go to the controller (field level) and then, every 10 s, to SCADA and the digital twin (MQTT).",
      phys: "The pallet moves into HMC-02 and the crankcase is machined (bores, faces, threads).",
      read: ["4–20 mA: the value is a current. The scale starts at 4 mA, so 0 mA means 'wire broken'.",
        "IO-Link: digital bytes; the sensor's IODD file says what each byte means.",
        "MQTT topic = a tree <code>company/site/area/line/machine/...</code> (Unified Namespace). Anyone may subscribe: twin, historian, dashboard.",
        "QoS 1 = delivered at least once (the broker answers PUBACK)."],
      g: `[[c:(1) vibration sensor → controller, 4–20 mA, range 0–50 mm/s]]
value = min + (I − 4) / 16 × (max − min)
I = [[d:4.77 mA]]  →  0 + (0.77 / 16) × 50 = [[a:2.4 mm/s]]
I < 3.6 mA  →  [[a:wire broken]]

[[c:(2) temperature sensor → controller, IO-Link, 0.1 °C per bit]]
process data [[d:0x02 0x9A]] = 666  →  [[a:66.6 °C]]

[[c:(3) controller → SCADA / twin, MQTT publish every 10 s]]
[[e:Topic:]] [[n:vcfactory/plant1/machining/fms/HMC-02/]][[v:telemetry]]   [[e:QoS 1]]
{ [[e:"ts": "2026-11-09T09:20:00Z",]] [[n:"state":]] [[d:"RUN"]], [[n:"temp_c":]] [[d:66.6]],
  [[n:"vib_mm_s":]] [[d:2.4]], [[n:"power_kw":]] [[d:14.8]] }
[[a:broker → controller: PUBACK]]`,
      run: async () => {
        await A.move(["part"], [{ x: 380, y: CONV }, { x: 520, y: CONV }, { x: 520, y: INY }], 5);
        A.state("M_HMC", "run", "machining OP10");
        await Promise.all([
          A.stream([VIB, { x: 470, y: 380 }, "CNC"], 3800, "field", "4–20 mA / IO-Link"),
          A.stream(["CNC", "SCADA"], 3800, "mqtt", "MQTT"),
          A.counter("SCADA", 3800, (k) => `HMC-02: ${(60 + 6.6 * k).toFixed(1)} °C · ${(2.1 + 0.3 * Math.sin(k * 9)).toFixed(1)} mm/s · ${(14 + 0.8 * k).toFixed(1)} kW`),
        ]);
        A.shape("machined", "VC20-000112");
        A.status("SCADA", "HMC-02: 66.6 °C · 2.4 mm/s · 14.8 kW");
      },
    },
    {
      t: "Alarm: vibration too high → maintenance order", stage: 4, who: [["CNC", "MES"], ["SCADA", "CNC"]], fam: "opc", gname: "OPC UA Alarms & Conditions",
      what: "The spindle vibration passes its limit. The controller raises an alarm; SCADA shows it, the MES creates a predictive maintenance order, and the operator acknowledges it on the HMI.",
      phys: "HMC-02 light turns amber. The part is finished; a bearing check is planned for the next break.",
      read: ["An alarm is an <b>event</b> with fixed fields: type, source, severity (1…1000), message, state.",
        "Two separate states: <code>ActiveState</code> (problem still there?) and <code>AckedState</code> (has a person seen it?).",
        "The operator answers with the method <code>Acknowledge</code>."],
      g: `[[v:EventNotification]]                              [[c:controller → SCADA → MES]]
  [[n:EventType   :]] [[d:OffNormalAlarmType]]
  [[n:SourceName  :]] [[d:HMC-02]]
  [[n:Severity    :]] [[d:600]]                          [[c:← 1 … 1000]]
  [[n:Message     :]] [[d:"Spindle vibration 7.3 mm/s > limit 7.1"]]
  [[n:ActiveState :]] [[d:TRUE]]
  [[n:AckedState  :]] [[d:FALSE]]

[[c:operator on the HMI:]]
[[v:Call Acknowledge]]( [[d:EventId]], [[d:"bearing check planned"]] )   [[a:→ AckedState = TRUE]]

[[c:MES: new maintenance order]] [[d:MWO-0004]] [[c:(predictive)]]`,
      run: async () => {
        A.state("M_HMC", "alarm", "ALARM: vibration 7.3 mm/s");
        await A.msg(["CNC", "SCADA", "MES"], "OPC UA Alarm (600)", "opc");
        A.status("SCADA", "ALARM HMC-02 vibration high");
        A.status("MES", "MWO-0004: predictive maintenance HMC-02");
        await A.msg(["SCADA", "CNC"], "Acknowledge", "opc", { ack: 1 });
        A.status("SCADA", "alarm acknowledged by the operator");
        A.state("M_HMC", "run", "finishing part · check planned");
        await A.wait(900);
        A.state("M_HMC", "idle", "idle · tools VC20, VC30");
      },
    },
    {
      t: "Assembly: which parts went into this compressor?", stage: 4, who: [["P_ASSY", "MES"]], fam: "opc", gname: "OPC UA DataChange: components consumed",
      what: "The crankcase gets 2 cylinders and 1 crankshaft. The assembly PLC reports the lots of these parts to the MES.",
      phys: "The machined crankcase moves to assembly and becomes a compressor pump.",
      read: ["This is the <b>genealogy</b> (family tree) of the unit.",
        "If a cylinder lot is found bad later, the MES lists every compressor that contains it, in seconds."],
      g: `[[c:assembly PLC → MES]]
[[v:DataChangeNotification]]  [[n:ns=2;s=ASSY-01.Consumed]]
{ [[n:"serial":]] [[d:"VC20-000112"]],
  [[n:"components":]] [
     { [[n:"part":]] [[d:"CYL-CAST"]], [[n:"lot":]] [[d:"CY-L0201"]], [[n:"qty":]] [[d:2]] },
     { [[n:"part":]] [[d:"CS-FORG"]],  [[n:"lot":]] [[d:"CS-L0107"]], [[n:"qty":]] [[d:1]] } ] }
[[a:StatusCode : Good]]`,
      run: async () => {
        await A.move(["part"], [{ x: 520, y: CONV }, { x: 660, y: CONV }, { x: 660, y: INY }], 5);
        A.state("M_ASSY", "run", "+2 cylinders +1 crankshaft");
        await A.wait(1500);
        A.shape("compressor", "VC20-000112");
        A.state("M_ASSY", "idle", "done");
        await A.msg(["P_ASSY", "SCADA", "MES"], "OPC UA: parts consumed", "opc");
        A.status("MES", "VC20-000112: + lots CY-L0201, CS-L0107");
      },
    },
    {
      t: "Performance test: result to the MES", stage: 5, who: [["L0", "P_TEST"], ["P_TEST", "MES"]], fam: "mqtt", gname: "MQTT publish: test result (JSON)",
      what: "The test bench runs the compressor at 8 bar and measures the air flow (FAD). The result is published; the MES checks the limit and adds the value to the SPC chart.",
      phys: "The unit runs on the test bench; the flow meter counts up to 20.31 m³/h → PASS.",
      read: ["JSON grammar: <code>{ \"name\": value, … }</code>; text in quotes, numbers without.",
        "The MES rule: PASS if FAD ≥ LSL. LSL = 97 % of nominal = 0.97 × 20 = 19.40 m³/h."],
      g: `[[e:Topic:]] [[n:vcfactory/plant1/test/TEST-01/]][[v:result]]   [[e:QoS 1]]
{ [[n:"serial":]] [[d:"VC20-000112"]], [[n:"model":]] [[d:"VC20"]],
  [[n:"fad_m3_h":]] [[d:20.31]], [[n:"lsl_m3_h":]] [[d:19.40]], [[n:"pressure_bar":]] [[d:8.0]],
  [[n:"result":]] [[a:"PASS"]], [[e:"ts": "2026-11-09T13:42:05Z"]] }

[[c:MES: 20.31 ≥ 19.40 → PASS · value goes into the SPC chart (UCL / LCL, Cpk)]]`,
      run: async () => {
        await A.move(["part"], [{ x: 660, y: CONV }, { x: 800, y: CONV }, { x: 800, y: INY }], 5);
        A.state("M_TEST", "run", "testing at 8 bar");
        await Promise.all([
          A.counter("M_TEST", 2600, (k) => `FAD ${(20.31 * k).toFixed(2)} m³/h`),
          A.stream([FLOW, { x: 750, y: 380 }, "P_TEST"], 2600, "field", "flow meter 4–20 mA"),
        ]);
        A.state("M_TEST", "pass", "20.31 m³/h · PASS");
        await A.msg(["P_TEST", "SCADA", "MES"], "MQTT test result", "mqtt");
        A.status("MES", "VC20-000112 PASS (≥ 19.40 m³/h)");
      },
    },
    {
      t: "Packed and stored: production confirmation to the ERP", stage: 6, who: [["FLEET", "AGV"], ["P_FG", "MES"], ["MES", "ERP"]], fam: "b2m", gname: "B2MML ProcessProductionPerformance (shortened)",
      what: "The packed unit goes into the finished-goods AS/RS. The MES reports to the ERP: 1 unit made, this casting lot used. The other 22 units follow exactly the same steps 10–17.",
      phys: "AGV takes the box to the finished-goods AS/RS; the crane stores it. Then the counter runs to 23 units.",
      read: ["Same grammar as step 7, new noun: <code>ProductionPerformance</code> = what really happened (actual).",
        "<code>MaterialProducedActual</code> = what was made; <code>MaterialConsumedActual</code> = what was used.",
        "ERP result: finished stock +1, casting stock −1 (backflush), cost booked."],
      g: `[[e:<]][[v:Process]][[n:ProductionPerformance]][[e:>]]
 [[e:<DataArea>]]  [[v:<Process/>]]
  [[n:<ProductionResponse><ID>]][[d:WO-0012]][[n:</ID>]]
   [[n:<MaterialProducedActual>]]
     [[n:<MaterialDefinitionID>]][[d:VC20-300]][[n:</MaterialDefinitionID>]]
     [[n:<MaterialLotID>]][[d:VC20-000112]][[n:</MaterialLotID>]]     [[c:← serial number]]
     [[n:<Quantity>]][[d:1]][[n:</Quantity>]]
     [[n:<StorageLocation>]][[d:ASRS-FG]][[n:</StorageLocation>]]
   [[n:</MaterialProducedActual>]]
   [[n:<MaterialConsumedActual>]]
     [[n:<MaterialDefinitionID>]][[d:CC20-CAST]][[n:</MaterialDefinitionID>]]
     [[n:<MaterialLotID>]][[d:FA-L0009]][[n:</MaterialLotID>]]
   [[n:</MaterialConsumedActual>]]
  [[n:</ProductionResponse>]]
 [[e:</DataArea>]]
[[e:</]][[v:Process]][[n:ProductionPerformance]][[e:>]]`,
      run: async () => {
        A.shape("box", "VC20-000112");
        A.state("M_TEST", "idle", "packed");
        await A.msg(["MES", "FLEET"], "transport request", "vda");
        await A.msg(["FLEET", { obj: "agv" }], "VDA 5050 order", "vda");
        await A.move(["agv"], [{ x: 800, y: LANE }], 5);
        await A.move(["part"], [{ x: 800, y: ONAGV }], 6);
        await A.move(["agv", "part"], [{ x: 950, y: LANE }], 5);
        A.state("M_FG", "run", "crane storing");
        await A.move(["part"], [{ x: 950, y: INY }], 6);
        A.show("part", 0);
        await A.rack("M_FG", 1);
        A.state("M_FG", "idle");
        await A.msg(["P_FG", "SCADA", "MES"], "OPC UA: stored", "opc");
        await A.msg(["MES", "ERP"], "B2MML ProductionPerformance", "b2m");
        A.status("ERP", "FG stock VC20-300: 1 · WO-0012 1 / 23");
        A.status("MES", "22 more units: same steps 10–17 …");
        await A.rack("M_FG", 23, 2200);
        A.status("MES", "WO-0012 completed: 23 good");
        A.status("ERP", "FG stock VC20-300: 23 · ready to ship");
      },
    },
    {
      t: "Shipping: ERP orders the delivery, the crane picks", stage: 7, who: [["ERP", "MES"], ["MES", "P_FG"]], fam: "b2m", gname: "REST (HTTP + JSON) + OPC UA Call",
      what: "The ERP creates delivery DN-0042 and sends it to the MES/WMS. The WMS tells the AS/RS PLC to retrieve the 23 units to dock OUT-1.",
      phys: "The customer's truck arrives at goods-out; the crane retrieves 23 boxes and they are loaded.",
      read: ["REST grammar: <b>method</b> (verb) + <b>URL</b> (noun) + JSON body. <code>POST</code> = create, <code>GET</code> = read, <code>PUT</code> = change, <code>DELETE</code> = remove.",
        "Answer = HTTP status: 2xx OK (201 = created), 4xx = error in the request, 5xx = server error."],
      g: `[[c:ERP → MES/WMS (REST, JSON)]]
[[v:POST]] [[n:/api/deliveries]]
{ [[n:"delivery":]] [[d:"DN-0042"]], [[n:"order":]] [[d:"SO-0006"]], [[n:"sku":]] [[d:"VC20-300"]],
  [[n:"qty":]] [[d:23]], [[n:"dock":]] [[d:"OUT-1"]] }
[[a:→ 201 Created]]

[[c:MES/WMS → AS/RS PLC (OPC UA), once per unit:]]
[[v:Call]] [[n:ns=2;s=ASRS-FG.Retrieve]]( [[d:"VC20-000112"]], [[d:"OUT-1"]] )   [[a:→ Good]]`,
      run: async () => {
        await A.msg(["ERP", "MES"], "REST: delivery DN-0042", "b2m");
        A.status("MES", "pick 23 units for SO-0006");
        await A.msg(["MES", "SCADA", "P_FG"], "OPC UA Call Retrieve ×23", "opc");
        A.status("P_FG", "retrieve 23 → OUT-1");
        A.show("truckOut", 1);
        await A.move(["truckOut"], [{ x: 1095, y: TRUCKY }], 4);
        A.state("M_FG", "run", "crane retrieving");
        A.place("fgload", 950, INY); A.show("fgload", 1);
        await A.rack("M_FG", 0, 1300);
        await A.move(["fgload"], [{ x: 1087, y: TRUCKY - 2 }], 6);
        A.state("M_FG", "idle", "0 units");
      },
    },
    {
      t: "Delivery note and invoice to the customer", stage: 7, who: [["ERP", "CUS"]], fam: "edi", gname: "EDIFACT DESADV + INVOIC",
      what: "When the truck leaves, the ERP sends the delivery note with all serial numbers, then the invoice.",
      phys: "The truck drives to Delta Compressors.",
      read: ["<code>RFF+ON</code> always uses the customer's own order number, so their system can match it.",
        "<code>GIN+BN</code> = serial numbers. <code>MOA+77</code> = invoice amount: 23 × 1450 = 33,350."],
      g: `[[c:Delivery note (when the truck leaves)]]
[[e:UNH+1+]][[v:DESADV]][[e::D:96A:UN']]
[[n:BGM+351+]][[d:DN-0042]][[n:+9']]
[[n:RFF+ON:]][[d:PO-88231]][[n:']]                      [[c:← customer's own number]]
[[n:LIN+1++]][[d:VC20-300]][[n::SA']]
[[n:QTY+12:]][[d:23]][[n:']]
[[n:GIN+BN+]][[d:VC20-000112]][[n:+]][[d:VC20-000113]][[n:']]       [[c:← serial numbers (… 23)]]
[[e:UNT+7+1']]

[[c:Invoice]]
[[e:UNH+2+]][[v:INVOIC]][[e::D:96A:UN']]
[[n:BGM+380+]][[d:INV-2026-0006]][[n:+9']]              [[c:← 380 = commercial invoice]]
[[n:RFF+ON:]][[d:PO-88231]][[n:']]
[[n:LIN+1++]][[d:VC20-300]][[n::SA']]
[[n:QTY+47:]][[d:23]][[n:']]                            [[c:← 47 = invoiced quantity]]
[[n:PRI+AAA:]][[d:1450]][[n:']]
[[n:MOA+77:]][[d:33350]][[n:']]                         [[c:← invoice amount]]
[[e:UNT+8+2']]`,
      run: async () => {
        await A.msg(["ERP", "CUS"], "EDI DESADV", "edi");
        await A.move(["truckOut", "fgload"], [{ x: 1330, y: TRUCKY }], 4);
        A.show("truckOut", 0); A.show("fgload", 0);
        await A.msg(["ERP", "CUS"], "EDI INVOIC", "edi");
        A.status("CUS", "delivery DN-0042 + invoice $33,350");
      },
    },
    {
      t: "Customer confirms receipt and pays: loop closed", stage: 8, who: [["CUS", "ERP"]], fam: "edi", gname: "EDIFACT RECADV + bank notification (ISO 20022)",
      what: "The customer's goods-in confirms 23 units received. Later the bank reports the payment, and the ERP closes the order.",
      phys: "The compressors are at the customer.",
      read: ["<code>RECADV</code> = receiving advice: 'we got it'. <code>RFF+AAK</code> refers to our delivery note.",
        "Banks use ISO 20022 XML: <code>camt.054</code> = 'money arrived on your account'."],
      g: `[[e:UNH+1+]][[v:RECADV]][[e::D:96A:UN']]                [[c:← receiving advice]]
[[n:BGM+632+]][[d:GR-7781]][[n:+9']]
[[n:RFF+AAK:]][[d:DN-0042]][[n:']]                      [[c:← our delivery note]]
[[n:LIN+1++]][[d:VC20-300]][[n::SA']]
[[n:QTY+48:]][[d:23]][[n:']]                            [[c:← 48 = received quantity]]
[[e:UNT+6+1']]

[[c:Bank → ERP, 30 days later (camt.054, shortened):]]
[[e:<]][[v:BkToCstmrDbtCdtNtfctn]][[e:>]]
  [[n:<Amt Ccy="USD">]][[d:33350.00]][[n:</Amt>]] [[n:<CdtDbtInd>]][[d:CRDT]][[n:</CdtDbtInd>]]
  [[n:<Ustrd>]][[d:INV-2026-0006]][[n:</Ustrd>]]
[[e:</]][[v:BkToCstmrDbtCdtNtfctn]][[e:>]]
[[a:ERP: invoice paid → SO-0006 closed]]`,
      run: async () => {
        await A.msg(["CUS", "ERP"], "EDI RECADV", "edi", { ack: 1 });
        A.status("CUS", "23 units received, OK");
        await A.wait(500);
        await A.msg(["CUS", "ERP"], "bank: payment", "edi", { ack: 1 });
        A.status("ERP", "SO-0006 closed · paid $33,350 · on time ✓");
      },
    },
  ];
  const N = S.length;
  const NAME = { CUS: "Customer", SUP: "Supplier", ERP: "ERP", MES: "MES", SCADA: "SCADA", FLEET: "Fleet manager",
    AGV: "AGV", CNC: "CNC", P_LOAD: "PLC load st.", P_ASRS: "PLC AS/RS", P_ASSY: "PLC assembly", P_TEST: "PLC test", P_FG: "PLC AS/RS FG", L0: "Sensor" };
  const LAYER = { CUS: "EXT", SUP: "EXT", ERP: "L4", MES: "L3", SCADA: "L2", FLEET: "L2", AGV: "L1", CNC: "L1",
    P_LOAD: "L1", P_ASRS: "L1", P_ASSY: "L1", P_TEST: "L1", P_FG: "L1", L0: "L0" };

  /* ------------------------------------------------------------ panel + controls */
  const grammar = (g) => escH(g).replace(/\[\[([evndac]):([\s\S]*?)\]\]/g, '<span class="g-$1">$2</span>');
  const who = (id) => `<span class="cm-tag cm-${LAYER[id]}">${LAYER[id] === "EXT" ? "Ext" : LAYER[id]}</span> ${NAME[id]}`;
  function renderPanel(i) {
    const p = byId("csPanel");
    document.querySelectorAll("#csSteps button").forEach((b, k) => {
      b.classList.toggle("cur", k === i);
      b.classList.toggle("done", k < i);
    });
    const stage = i < 0 ? -1 : i >= N ? STAGES.length : S[i].stage;
    byId("csStages").innerHTML = STAGES.map((s, k) =>
      `<span class="csim-stage${k < stage ? " done" : k === stage ? " cur" : ""}">${s}</span>`).join('<i class="csim-arr">›</i>');
    if (i < 0) {
      p.innerHTML = `<div class="csim-intro"><h3>How to use</h3>
        <p>Press <b>▶ Play</b> to watch the whole order, or <b>Next ▶</b> to go one step at a time. The upper part is the
        <b>information world</b> (computers, layers L4 → L1). The lower part is the <b>physical world</b> (trucks, AGV, crane, machines).</p>
        <p>An envelope ✉ is a message; ↩ is an answer. Its colour shows the protocol (legend above). Below each step you see the real
        message text, coloured by its grammar parts.</p></div>`;
      return;
    }
    if (i >= N) {
      p.innerHTML = `<div class="csim-intro"><h3>Finished: the order loop is closed</h3>
        <p>One customer order needed <b>about 30 messages</b> in 6 languages (protocols), from EDI between companies down to
        4–20 mA on a wire, and back up. Click any step number above to see it again.</p>
        <div class="table-wrap"><table><tr><th class="num">#</th><th>Step</th><th>From → to</th><th>Protocol</th></tr>
        ${S.map((s, k) => `<tr class="csim-sumrow" data-k="${k}"><td class="num">${k + 1}</td><td>${escH(s.t)}</td>
          <td class="nowrap">${s.who.map(([a, b]) => `${NAME[a]} → ${NAME[b]}`).join(", ")}</td>
          <td><i class="csim-sw" style="background:${FAM[s.fam].c}"></i>${escH(s.gname.split(" (")[0])}</td></tr>`).join("")}
        </table></div></div>`;
      return;
    }
    const s = S[i];
    p.innerHTML = `
      <div class="csim-info">
        <div class="csim-stepno">Step ${i + 1} of ${N}</div>
        <h3>${escH(s.t)}</h3>
        <div class="csim-who">${s.who.map(([a, b]) => a === b ? `${who(a)} (inside)` : `${who(a)} <b>→</b> ${who(b)}`).join("<br>")}</div>
        <h4>What happens</h4><p>${escH(s.what)}</p>
        <h4>In the factory</h4><p>${escH(s.phys)}</p>
        <h4>How to read the message</h4><ul>${s.read.map((r) => `<li>${r}</li>`).join("")}</ul>
      </div>
      <div class="csim-gram">
        <div class="csim-gname"><i class="csim-sw" style="background:${FAM[s.fam].c}"></i>${escH(s.gname)}</div>
        <pre class="csim-code">${grammar(s.g)}</pre>
        <div class="csim-glegend"><span class="g-e">envelope / header</span><span class="g-v">verb (what to do)</span>
          <span class="g-n">object / field names</span><span class="g-d">data values</span><span class="g-a">answer / status / result</span>
          <span class="g-c">comment (not sent)</span></div>
      </div>`;
  }

  let shown = -1, playing = false;
  async function goTo(i) {
    i = Math.max(0, Math.min(N, i));
    gen++;
    const my = gen;
    build();
    instant = true;
    try { for (let k = 0; k < Math.min(i, N); k++) await S[k].run(); } catch (e) { if (e !== ABORT) throw e; }
    instant = false;
    if (my !== gen) return;
    shown = i;
    renderPanel(i);
    if (i >= N) { setPlaying(false); return; }
    try { await S[i].run(); } catch (e) { if (e === ABORT) return; throw e; }
    if (my !== gen) return;
    if (playing) {
      try { await A.wait(1500); } catch (e) { return; }
      if (my === gen && playing) goTo(i + 1);
    }
  }
  function setPlaying(v) {
    playing = v;
    byId("csPlay").textContent = v ? "⏸ Pause" : "▶ Play";
  }

  byId("csSteps").innerHTML = S.map((s, k) => `<button title="${escH(s.t)}">${k + 1}</button>`).join("");
  byId("csLegend").innerHTML = Object.values(FAM).map((f) => `<span><i class="csim-sw" style="background:${f.c}"></i>${escH(f.n)}</span>`).join("") +
    `<span class="muted">✉ message · ↩ answer</span>`;
  byId("csSteps").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    setPlaying(false);
    goTo([...b.parentNode.children].indexOf(b));
  });
  byId("csPanel").addEventListener("click", (e) => {
    const r = e.target.closest(".csim-sumrow");
    if (r) { setPlaying(false); goTo(+r.dataset.k); }
  });
  byId("csPlay").addEventListener("click", () => {
    if (playing) { setPlaying(false); return; }
    setPlaying(true);
    goTo(shown < 0 || shown >= N ? 0 : shown + 1);
  });
  byId("csNext").addEventListener("click", () => { setPlaying(false); goTo(shown + 1); });
  byId("csPrev").addEventListener("click", () => { setPlaying(false); goTo(Math.max(0, shown - 1)); });
  byId("csReplay").addEventListener("click", () => { setPlaying(false); goTo(Math.max(0, Math.min(N - 1, shown))); });
  byId("csRestart").addEventListener("click", () => { setPlaying(false); goTo(0); });
  byId("csSpeed").addEventListener("change", (e) => { speed = +e.target.value || 1; });

  // Simulation / Protocols / Live monitor switch
  const PANES = { sim: "cmSim", proto: "cmProto", scada: "cmScada", live: "cmLive" };
  document.querySelectorAll("[data-cmmode]").forEach((b) => b.addEventListener("click", () => {
    const mode = b.dataset.cmmode;
    document.querySelectorAll("[data-cmmode]").forEach((x) => x.classList.toggle("active", x === b));
    for (const [m, id] of Object.entries(PANES)) byId(id).hidden = m !== mode;
    if (mode !== "sim") { setPlaying(false); gen++; }
    if (mode === "live" && window.cmRefreshNow) window.cmRefreshNow();
    if (mode === "scada" && window.scadaShown) window.scadaShown();
    try { localStorage.setItem("cmMode", mode); } catch (e) { /* storage blocked */ }
  }));
  try {
    const m = new URLSearchParams(location.search).get("cmmode") || localStorage.getItem("cmMode");
    if (m && m !== "sim" && PANES[m]) document.querySelector(`[data-cmmode="${m}"]`).click();
  } catch (e) { /* ignore */ }

  build();
  renderPanel(-1);
  // deep link for screenshots / teaching: /?csstep=13#comm
  const st = +new URLSearchParams(location.search).get("csstep");
  if (st) goTo(st - 1);
})();
