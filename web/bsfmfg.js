/* Ball screw + guide factory – item 2 "Manufacturing processes – screw shaft, nut, rail, carriage: every operation in 3D" (#bfItem2).
 * Guide: docs/41_ballscrew_guide_manufacturing.md
 * Files: bsfmfg.js (UI, lazy build, flow, routing sheet, machine list, capacity, physics, quality gates, card, self-check) ·
 *   bsfmfg_data.js (SHARED process data – items 3 / 5 / 6 / 7 import it) · bsfmfg_calc.js (formulas + CHECK2) ·
 *   bsfmfg_3d.js (one parametric scene + kit) · bsfmfg_3dm.js (machine modules) · bsfmfg.css.
 * Lazy: built on window event "bfitemshow" (detail "2"); Three.js is imported only then; renders only when visible.
 * URL: /?bfitem=2#bsf · &bf2route=BS|BN|LG|LB|FABS|FALG · &bf2op=<op no> · &bf2var=G|W|R · &bf2speed=1..20 · &bf2pause ·
 *   &bf2phys=ind|burn|tgr|therm|str|ht|tq · &bf2card=flow|op|sheet|mach|cap|phys|qg (scroll) · &bf2test (self-check, console "BF2TEST …" + #bf2Debug) ·
 *   &bf2hold (headless: keep the load event pending, show the tab) · card: &bf2tab=draw|buy|shop · &bf2box=N.
 * Offline. ALL VALUES ARE EXAMPLES – check the machine maker's data.
 */
import { NOTE2, PLANT, VARIANTS, ROUTES, ROUTE_KEYS, MTYPES, MACHINES, QGATES, SIGNALS, capacity, CAP0, opsOf, cycOf, effCycle, CARD2 } from "./bsfmfg_data.js";
import * as P from "./bsfmfg_calc.js";
import { BS, BN } from "./bsfprod_data.js";
import { makeCard } from "./robotref.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const sp = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const fv = (v, d) => {
  if (typeof v !== "number" || !Number.isFinite(v)) return esc(v);
  if (d !== undefined) { const t = v.toFixed(d); const [a, b] = t.split("."); return sp(a) + (b ? "." + b : ""); }
  const a = Math.abs(v);
  return a >= 1000 ? sp(Math.round(v).toString()) : a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : a >= 1 ? v.toFixed(2) : v.toFixed(3);
};
const host = $("bfItem2");
const errs = [];
if (Q.has("bf2test")) {
  window.addEventListener("error", (e) => errs.push(e.message || String(e)));
  window.addEventListener("unhandledrejection", (e) => errs.push("promise: " + (e.reason && e.reason.message || e.reason)));
}
// test only (&bf2hold): a hidden iframe on the never-ending SSE stream keeps the load event pending (headless screenshots wait for --timeout), then shows the tab
if (Q.has("bf2hold")) { const fr = document.createElement("iframe"); fr.src = "/api/stream?bf2hold=" + Date.now(); fr.title = "test"; fr.style.display = "none"; document.body.appendChild(fr);
  setTimeout(() => { if (typeof window.showTab === "function") window.showTab("bsf"); else { const b = document.querySelector('[data-tab="bsf"]'); if (b) b.click(); } if (window.bfCtl) window.bfCtl.showItem("2"); }, 300); }

const RNAME = { BS: "Screw shaft", BN: "Ball nut", LG: "Rail", LB: "Carriage", FABS: "Ball screw set", FALG: "Guide set" };
const PHYS = [["ind", "Induction hardening"], ["burn", "Grinding power + burn"], ["tgr", "Thread grinding time"], ["therm", "Thermal growth + lead"], ["str", "Straightening force"], ["ht", "Tempering + carburising"], ["tq", "Preload torque"]];
const ST = {
  route: ROUTES[Q.get("bf2route")] ? Q.get("bf2route") : "BS",
  variant: VARIANTS[Q.get("bf2var")] ? Q.get("bf2var") : "G",
  op: null, phys: PHYS.some((p) => p[0] === Q.get("bf2phys")) ? Q.get("bf2phys") : "ind",
};
let built = false, V3 = null, capR = CAP0;

const tbl = (cols, rows, cls = "") => `<div class="table-wrap"><table class="bf2-tbl ${cls}"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const seg = (attr, items, cur) => `<span class="seg" role="group">${items.map(([k, t]) => `<button class="seg-btn${k === cur ? " active" : ""}" type="button" data-${attr}="${k}">${esc(t)}</button>`).join("")}</span>`;
const ops = () => opsOf(ST.route, ST.variant);
const curOp = () => ops().find((o) => o.no === ST.op) || ops()[0];
const gateOf = (r, no) => QGATES.find((g) => g.r === r && g.after === no);

/* ------------------------------------------------------------------ build */
function build() {
  if (built || !host) return; built = true;
  const o0 = opsOf(ST.route, ST.variant); ST.op = o0.some((o) => o.no === Q.get("bf2op")) ? Q.get("bf2op") : (ST.route === "BS" ? "100" : o0[0].no);
  const speed0 = Math.min(20, Math.max(1, +Q.get("bf2speed") || 1));
  host.innerHTML = `
  <div class="bf2-wrap">
    <div class="card" id="bf2Flow">
      <div class="card-head"><h2>Process flow – click a part, then an operation</h2>
        <span class="bf2-ctl">${seg("bf2r", ROUTE_KEYS.map((k) => [k, RNAME[k]]), ST.route)}
          <label class="bf2-lbl" id="bf2VarL">screw thread <select id="bf2Var" aria-label="screw thread variant">${Object.entries(VARIANTS).map(([k, v]) => `<option value="${k}"${k === ST.variant ? " selected" : ""}>${k} – ${esc(v.n)}</option>`).join("")}</select></label></span></div>
      <p class="bf2-p" id="bf2RSum"></p>
      <div class="bf2-flowsvg" id="bf2FlowSvg"></div>
      <p class="hint">Plant: <b>screw shaft + ball nut → ball screw set</b>; <b>rail + 2 carriages → guide set</b>. Box = operation: no., name, machine type id, cycle per piece.
        Blue frame = quality gate (feeds item 5 quality); dashed = only in some screw variants. Click a box → the 3D machine and the routing line below. ${esc(NOTE2)}</p>
    </div>

    <div class="card" id="bf2Op">
      <div class="card-head"><h2 id="bf2OpH">Operation in 3D</h2>
        <span class="bf2-ctl"><button class="btn" type="button" id="bf2Prev" aria-label="previous operation">◀ prev</button><select id="bf2OpSel" aria-label="operation"></select><button class="btn" type="button" id="bf2Next" aria-label="next operation">next ▶</button></span></div>
      <div class="bf2-bar">
        <button class="btn primary" type="button" id="bf2Play">${Q.has("bf2pause") ? "▶ Play" : "❚❚ Pause"}</button>
        <label class="bf2-lbl">speed <input type="range" id="bf2Spd" min="1" max="20" step="1" value="${speed0}" aria-label="animation speed"> <b id="bf2SpdV">× ${speed0}</b></label>
        <label class="bf2-chk"><input type="checkbox" id="bf2Lbl" checked> labels</label>
        <span class="bf2-small">The animation is time-compressed – the real cycle time is in the panel.</span>
      </div>
      <div class="bf2-main">
        <div class="scene3d bf2-3d" id="bf23d"><div class="bf2-msg">3D view is loading …</div></div>
        <div class="bf2-info" id="bf2Info"></div>
      </div>
      <p class="hint">Mouse: left = turn, right = move, wheel = zoom, double-click = new orbit point. One parametric scene: the machine module changes with the operation;
        the part shows its real state (bar → turned → hardened → ground). Numbers in the panel are live (pass, speed, feed, position) and the formulas use the operation data. ${esc(NOTE2)}</p>
    </div>

    <div class="card" id="bf2Sheet">
      <div class="card-head"><h2 id="bf2SheetH">Routing sheet</h2><span class="bf2-small" id="bf2SheetSub"></span></div>
      <div id="bf2SheetBody"></div>
    </div>

    <div class="card" id="bf2Mach">
      <div class="card-head"><h2>Machine list – types, number needed, Modbus TCP signals</h2><span class="bf2-small" id="bf2MachSub"></span></div>
      <div id="bf2MachBody"></div>
    </div>

    <div class="card" id="bf2Cap">
      <div class="card-head"><h2>Capacity calculator – machines needed, bottleneck, takt</h2></div>
      <div class="bf2-capgrid">
        <div class="bf2-inp" id="bf2CapIn"></div>
        <div id="bf2CapOut"></div>
      </div>
    </div>

    <div class="card" id="bf2Phys">
      <div class="card-head"><h2>Process physics – formulas with example numbers</h2></div>
      <div class="bf2-ptabs">${seg("bf2p", PHYS, ST.phys)}</div>
      <div class="bf2-pgrid"><div class="bf2-inp" id="bf2PhIn"></div><div id="bf2PhOut"></div></div>
    </div>

    <div class="card" id="bf2QG">
      <div class="card-head"><h2>Quality gates per route (→ item 5 quality)</h2></div>
      <div id="bf2QGBody"></div>
    </div>
    <div class="bf2-debug" id="bf2Debug" hidden></div>
  </div>`;

  host.querySelectorAll("[data-bf2r]").forEach((b) => b.addEventListener("click", () => setRoute(b.dataset.bf2r)));
  $("bf2Var").addEventListener("change", (e) => { ST.variant = e.target.value; const o = opsOf(ST.route, ST.variant); if (!o.some((x) => x.no === ST.op)) ST.op = o[0].no; renderRoute(); $("bf2CVar").value = ST.variant; runCap(); });
  $("bf2OpSel").addEventListener("change", (e) => selectOp(e.target.value));
  $("bf2Prev").addEventListener("click", () => stepOp(-1)); $("bf2Next").addEventListener("click", () => stepOp(1));
  $("bf2Play").addEventListener("click", () => { if (!V3) return; const on = !V3.S.playing; V3.play(on); $("bf2Play").textContent = on ? "❚❚ Pause" : "▶ Play"; });
  $("bf2Spd").addEventListener("input", (e) => { $("bf2SpdV").textContent = "× " + e.target.value; if (V3) V3.setSpeed(+e.target.value); });
  $("bf2Lbl").addEventListener("change", (e) => { if (V3) V3.setTags(e.target.checked); });
  host.querySelectorAll("[data-bf2p]").forEach((b) => b.addEventListener("click", () => { ST.phys = b.dataset.bf2p; host.querySelectorAll("[data-bf2p]").forEach((x) => x.classList.toggle("active", x === b)); buildPhys(); }));

  buildMach(); buildCapIn(); runCap(); buildPhys(); buildQG(); renderRoute();
  try { makeCard(CARD2, host.querySelector(".bf2-wrap"), { card: "bfCard2", q: "bfQ2", g: "bfG2", cnt: "bfCnt2", buy: "bfBuy2" }, "bf2"); } catch (e) { console.error(e); }
  host.querySelector(".bf2-wrap").appendChild($("bf2Debug"));
  const cardMap = { flow: "bf2Flow", op: "bf2Op", sheet: "bf2Sheet", mach: "bf2Mach", cap: "bf2Cap", phys: "bf2Phys", qg: "bf2QG" };
  if (cardMap[Q.get("bf2card")]) setTimeout(() => $(cardMap[Q.get("bf2card")]).scrollIntoView({ block: "start" }), 900);

  import("./bsfmfg_3d.js").then((M) => {
    const el = $("bf23d"); el.querySelector(".bf2-msg").remove();
    V3 = M.createMfg3D(el, { onState: liveInfo });
    window.bf2View = V3;
    V3.setSpeed(speed0); if (Q.has("bf2pause")) V3.play(false);
    show3D();
    if (Q.has("bf2test")) setTimeout(selfTest, 600);
  }).catch((e) => { console.error(e); $("bf23d").innerHTML = `<div class="bf2-msg">3D could not load: ${esc(e.message)}</div>`; if (Q.has("bf2test")) setTimeout(selfTest, 300); });
}

/* ------------------------------------------------------------------ route + operation selection */
function setRoute(r) {
  ST.route = r; const o = ops(); ST.op = r === "BS" && o.some((x) => x.no === "100") ? "100" : o[0].no;
  host.querySelectorAll("[data-bf2r]").forEach((b) => b.classList.toggle("active", b.dataset.bf2r === r));
  renderRoute();
}
function selectOp(no) { ST.op = no; renderFlow(); renderOpSel(); renderInfo(); show3D(); markSheet(); }
function stepOp(d) { const o = ops(), i = o.findIndex((x) => x.no === ST.op); selectOp(o[(i + d + o.length) % o.length].no); }
function renderRoute() {
  $("bf2VarL").hidden = !["BS"].includes(ST.route);
  const R = ROUTES[ST.route], o = ops(), sumC = o.reduce((t, x) => t + cycOf(x, ST.variant), 0), q = PLANT.qty[R.qtyKey];
  const mt = [...new Set(o.map((x) => x.m))];
  $("bf2RSum").innerHTML = `<b>${esc(R.n)}</b> <code>${esc(R.code)}</code> – material: ${esc(R.material)}. ${o.length} operations, Σ cycle ${fv(sumC, 1)} min per piece,
    target ${q} per day → takt ${fv(capR.takt[ST.route], 2)} min. Machine types: ${mt.map((m) => `<code>${m}</code>`).join(" ")}.${ST.route === "BS" ? " Variant: <b>" + esc(VARIANTS[ST.variant].n) + "</b> – " + esc(VARIANTS[ST.variant].t) : ""}`;
  renderFlow(); renderOpSel(); renderInfo(); renderSheet(); show3D();
}
function renderOpSel() {
  $("bf2OpSel").innerHTML = ops().map((o) => `<option value="${o.no}"${o.no === ST.op ? " selected" : ""}>${o.no} · ${esc(o.op)}</option>`).join("");
  const o = curOp(); $("bf2OpH").textContent = `Operation in 3D – ${RNAME[ST.route]} op ${o.no}: ${o.op}`;
}

/* ------------------------------------------------------------------ flow diagram (SVG, clickable) */
function wrapTxt(s, n) { const w = s.split(" "), out = [""]; for (const x of w) { if ((out[out.length - 1] + " " + x).trim().length > n) out.push(x); else out[out.length - 1] = (out[out.length - 1] + " " + x).trim(); } return out; }
function renderFlow() {
  const o = ops(), per = 5, bw = 196, bh = 92, gx = 30, gy = 46, x0 = 14, y0 = 14, rowsN = Math.ceil(o.length / per);
  const W = x0 * 2 + per * bw + (per - 1) * gx, H = y0 * 2 + rowsN * bh + (rowsN - 1) * gy;
  const pos = (i) => { const r = Math.floor(i / per), c = i % per, cc = r % 2 ? per - 1 - c : c; return [x0 + cc * (bw + gx), y0 + r * (bh + gy)]; };
  let s = `<svg viewBox="0 0 ${W} ${H}" class="bf2-flow" role="img" aria-label="process flow ${esc(RNAME[ST.route])}"><defs><marker id="bf2ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,1 L10,5 L0,9 Z" fill="#555"/></marker></defs>`;
  for (let i = 0; i < o.length - 1; i++) {
    const [ax, ay] = pos(i), [bx, by] = pos(i + 1);
    if (ay === by) { const l2r = bx > ax; s += `<line x1="${l2r ? ax + bw : ax}" y1="${ay + bh / 2}" x2="${l2r ? bx - 3 : bx + bw + 3}" y2="${by + bh / 2}" stroke="#555" stroke-width="1.4" marker-end="url(#bf2ar)"/>`; }
    else s += `<line x1="${ax + bw / 2}" y1="${ay + bh}" x2="${bx + bw / 2}" y2="${by - 3}" stroke="#555" stroke-width="1.4" marker-end="url(#bf2ar)"/>`;
  }
  o.forEach((op, i) => {
    const [x, y] = pos(i), g = gateOf(ST.route, op.no), sel = op.no === ST.op, vOnly = op.v && op.v.length < 3;
    const lines = wrapTxt(op.op, 30).slice(0, 3);
    s += `<g class="bf2-box${sel ? " sel" : ""}${g ? " gate" : ""}" data-bf2op="${op.no}" tabindex="0" role="button" aria-label="operation ${op.no} ${esc(op.op)}">
      <rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="6" ${vOnly ? 'stroke-dasharray="6 3"' : ""}/>
      <text x="${x + 8}" y="${y + 17}" class="b">op ${op.no}</text><text x="${x + bw - 8}" y="${y + 17}" class="m" text-anchor="end">${op.m}</text>
      ${lines.map((l, k) => `<text x="${x + 8}" y="${y + 35 + k * 14}">${esc(l)}</text>`).join("")}
      <text x="${x + 8}" y="${y + bh - 8}" class="b">${op.buy ? "BOUGHT · check " : "cycle "}${fv(cycOf(op, ST.variant), 1)} min</text>${g ? `<text x="${x + bw - 8}" y="${y + bh - 8}" class="g" text-anchor="end">${g.id}</text>` : ""}</g>`;
  });
  s += "</svg>";
  $("bf2FlowSvg").innerHTML = s;
  $("bf2FlowSvg").querySelectorAll("[data-bf2op]").forEach((b) => { b.addEventListener("click", () => selectOp(b.dataset.bf2op)); b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectOp(b.dataset.bf2op); } }); });
}

/* ------------------------------------------------------------------ info panel */
function renderInfo() {
  const o = curOp(), T = MTYPES[o.m] || {}, g = gateOf(ST.route, o.no), c = cycOf(o, ST.variant);
  $("bf2Info").innerHTML = `<h3>op ${o.no} · ${esc(o.op)}</h3>
    <dl class="bf2-dl"><dt>Machine</dt><dd><code>${o.m}</code> ${esc(T.n || "")} – makers e.g. ${esc(T.makers || "")}</dd>
    <dt>Tool</dt><dd>${esc(o.tool)}</dd><dt>Cutting / process data</dt><dd>${esc(o.data)}</dd>
    <dt>Time</dt><dd>cycle <b>${fv(c, 1)} min</b> per piece · set-up ${o.setup} min per batch of ${o.batch} → effective ${fv(effCycle(o, ST.variant), 2)} min</dd>
    <dt>Check</dt><dd>${esc(o.chk)} – <i>${esc(o.gauge)}</i> – ${esc(o.freq)}${g ? ` <span class="bf2-gate">${g.id}</span>` : ""}</dd>
    <dt>Typical mistake → effect</dt><dd>${esc(o.err)} → ${esc(o.eff)}</dd><dt>Scrap (example)</dt><dd>${o.scrap} %${o.buy ? " · BOUGHT part – our time is the incoming check" : ""}</dd></dl>
    <h4 class="bf2-h">Live in the 3D view</h4><div id="bf2Live"></div><p class="bf2-small">${esc(NOTE2)}</p>`;
  liveInfo();
}
function liveInfo() {
  const el = $("bf2Live"); if (!el || !V3) return;
  const r = V3.read() || {}; const rows = r.rows || [];
  el.innerHTML = `<table class="bf2-kv"><tbody>${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table>${r.chart || ""}`;
}
/* the part state before the current op (bar → turned → hardened → ground) */
function flagsBefore() {
  const f = {}, o = ops();
  for (const x of o) {
    if (x.no === ST.op) break;
    if (x.mod === "lathe") f.turned = true; if (x.mod === "mill") f.milled = true; if (x.mod === "raildrill") f.drilled = true;
    if (["induction", "railind"].includes(x.mod) || (x.mod === "furnace" && x.m === "HT-CAR")) f.hard = true;
    if (["threadgrind", "whirl", "roll"].includes(x.mod)) f.thread = true; if (x.mod === "cylgrind") { f.groundJ = true; f.groundOD = true; } if (x.mod === "bench") f.asm = true;
  }
  if (["FABS", "FALG"].includes(ST.route)) Object.assign(f, { turned: true, hard: true, thread: true, groundJ: true, drilled: true, asm: true });
  return f;
}
function show3D() { if (!V3) return; V3.setOp(curOp(), { route: ST.route, f: flagsBefore(), variant: ST.variant }); liveInfo(); }

/* ------------------------------------------------------------------ routing sheet */
function renderSheet() {
  const R = ROUTES[ST.route], o = ops(), q = PLANT.qty[R.qtyKey];
  let y = 1; const yl = []; for (let i = o.length - 1; i >= 0; i--) { y *= 1 - o[i].scrap / 100; yl[i] = y; }
  const rowsH = o.map((x, i) => { const g = gateOf(ST.route, x.no), e = effCycle(x, ST.variant); return [`<b>${x.no}</b>`, esc(x.op), `<code>${x.m}</code>`, esc(x.tool), esc(x.data), x.setup, fv(cycOf(x, ST.variant), 1), x.batch, fv(e, 2), x.scrap, fv(q / yl[i], 1), fv(e * q / yl[i], 0), `${esc(x.chk)}<br><i>${esc(x.gauge)}</i> · ${esc(x.freq)}`, `${esc(x.err)} → ${esc(x.eff)}`, g ? `<span class="bf2-gate">${g.id}</span>` : ""]; });
  const sumC = o.reduce((t, x) => t + cycOf(x, ST.variant), 0), sumS = o.reduce((t, x) => t + x.setup / x.batch, 0), sumL = o.reduce((t, x, i) => t + effCycle(x, ST.variant) * q / yl[i], 0);
  rowsH.push(["", "<b>Totals</b>", "", "", "", "", `<b>Σ ${fv(sumC, 1)}</b>`, "", `<b>Σ ${fv(sumC + sumS, 2)}</b>`, `yield ${fv(yl[0] * 100, 2)} %`, `start ${fv(q / yl[0], 1)}`, `<b>${fv(sumL, 0)}</b>`, "", "", ""]);
  $("bf2SheetH").textContent = `Routing sheet – ${R.n} ${R.code}${ST.route === "BS" ? " (variant " + ST.variant + ")" : ""}`;
  $("bf2SheetSub").textContent = `${o.length} operations · target ${q} good parts per day · times in min`;
  $("bf2SheetBody").innerHTML = tbl(["No.", "Operation", "Machine", "Tool", "Cutting / process data", "Set-up", "Cycle", "Batch", "Effective", "Scrap %", "Start qty / day", "Machine-min / day", "Check (gauge · frequency)", "Typical mistake → effect", "Gate"], rowsH, "bf2-sheet") +
    `<p class="bf2-small">Effective = cycle + set-up / batch. Start quantity = good quantity / Π(1 − scrap) of this and all later operations. Machine-minutes per day = effective × start quantity. ${esc(NOTE2)}</p>`;
  markSheet();
}
function markSheet() { const o = ops(), i = o.findIndex((x) => x.no === ST.op); $("bf2SheetBody").querySelectorAll("tbody tr").forEach((tr, k) => tr.classList.toggle("sel", k === i)); }

/* ------------------------------------------------------------------ machine list */
function buildMach() {
  const ids = Object.keys(MTYPES);
  const rowsH = ids.map((id) => {
    const T = MTYPES[id], m = CAP0.mach[id], n = T.lab ? 1 : (m ? m.n : 0), inst = MACHINES.filter((x) => x.type === id).map((x) => x.id);
    return [`<code>${id}</code>`, esc(T.n), T.area, n, inst.length ? `${inst[0]}${inst.length > 1 ? " … " + inst[inst.length - 1] : ""}` : "–", fv(T.kW, T.kW < 10 ? 1 : 0), `${T.foot[0]} × ${T.foot[1]}`, T.sig.map((s) => `<span class="bf2-sig" title="${esc(SIGNALS[s].join(" · "))}">${s}</span>`).join(" "), esc(T.makers), esc(T.cost)];
  });
  const kw = ids.reduce((t, id) => t + (MTYPES[id].lab ? 1 : (CAP0.mach[id] ? CAP0.mach[id].n : 0)) * MTYPES[id].kW, 0);
  $("bf2MachSub").textContent = `${ids.length} types · ${MACHINES.length} instances at the design point · ≈ ${fv(kw, 0)} kW installed (incl. lab)`;
  $("bf2MachBody").innerHTML = tbl(["Type id", "Machine", "Area", "Needed", "Instances (item 3 / 4)", "kW", "Footprint m", "Modbus TCP signal groups (item 4)", "Maker examples", "Price class (estimate – ask for a quote)"], rowsH, "bf2-mach") +
    `<p class="bf2-small">Areas: soft = soft machining hall, ht = heat treatment, grind = grinding room 20 ± 1 °C, qc = metrology 20 ± 0.5 °C, assy = assembly + packing. Signal groups (hover): ${Object.entries(SIGNALS).map(([k, v]) => `<b>${k}</b> = ${esc(v.join(" · "))}`).join("; ")}. Every machine talks Modbus TCP (port 502) to the gateway; MES / ERP / twin use HTTP (contract). ${esc(NOTE2)}</p>`;
}

/* ------------------------------------------------------------------ capacity calculator */
function buildCapIn() {
  const q = PLANT.qty;
  $("bf2CapIn").innerHTML = `<h4>Target good parts per day</h4>${ROUTE_KEYS.map((k) => `<label>${esc(RNAME[k])} <input type="number" min="0" max="2000" step="10" data-cq="${k}" value="${q[ROUTES[k].qtyKey]}"><em>pcs</em></label>`).join("")}
    <h4>Time + efficiency</h4>
    <label>shifts per day <input type="number" id="bf2CSh" min="1" max="3" step="1" value="${PLANT.shifts}"><em>–</em></label>
    <label>net hours per shift <input type="number" id="bf2CH" min="4" max="8" step="0.25" value="${PLANT.hShift}"><em>h</em></label>
    <label>OEE <input type="number" id="bf2COee" min="0.3" max="0.95" step="0.01" value="${PLANT.oee}"><em>–</em></label>
    <label>heat-treatment shifts <input type="number" id="bf2CHt" min="1" max="3" step="1" value="${PLANT.shiftsHT}"><em>–</em></label>
    <label>screw thread variant <select id="bf2CVar">${Object.keys(VARIANTS).map((k) => `<option value="${k}"${k === ST.variant ? " selected" : ""}>${k}</option>`).join("")}</select><em></em></label>
    <p class="bf2-small">${esc(PLANT.qtyTxt)}. Design point: ${PLANT.shifts} shifts × ${PLANT.hShift} h, OEE ${PLANT.oee}, heat treatment ${PLANT.shiftsHT} shifts.</p>
    <button class="btn" type="button" id="bf2CReset">reset to the design point</button>`;
  $("bf2CapIn").querySelectorAll("input,select").forEach((el) => el.addEventListener("input", runCap));
  $("bf2CReset").addEventListener("click", () => { buildCapIn(); runCap(); });
}
function runCap() {
  const qty = {}; $("bf2CapIn").querySelectorAll("[data-cq]").forEach((el) => { qty[ROUTES[el.dataset.cq].qtyKey] = Math.max(0, +el.value || 0); });
  const R = capacity({ qty, shifts: +$("bf2CSh").value || 2, hShift: +$("bf2CH").value || 7.5, oee: +$("bf2COee").value || 0.75, shiftsHT: +$("bf2CHt").value || 3, variant: $("bf2CVar").value });
  capR = R;
  const kw = R.list.reduce((t, m) => t + m.n * MTYPES[m.id].kW, 0), area = R.list.reduce((t, m) => t + m.n * MTYPES[m.id].foot[0] * MTYPES[m.id].foot[1], 0);
  const b = R.bottleneck;
  const rowsH = R.list.map((m) => [`<code>${m.id}</code>`, esc(MTYPES[m.id].n), fv(m.load, 0), fv(m.avail * R.oee, 0), fv(m.need, 2), `<b>${m.n}</b>`,
    `<span class="bf2-barw"><span class="bf2-barf${m === b ? " bf2-bnk" : m.util > 0.85 ? " bf2-hi" : ""}" style="width:${Math.min(100, m.util * 100).toFixed(1)}%"></span></span> ${fv(m.util * 100, 1)} %`, esc(m.ops.join(", "))]);
  $("bf2CapOut").innerHTML = `<p class="bf2-p"><b>Machines needed = Σ (effective cycle × start quantity) / (available minutes × OEE)</b> per machine type, rounded up.
      Available ${fv(R.avail, 0)} min/day (heat treatment ${fv(R.availHT, 0)} min), OEE ${R.oee}. Result: <b>${R.machines} machines</b>, ≈ ${fv(kw, 0)} kW installed, ≈ ${fv(area, 0)} m² machine footprint (hall ≈ 2.5 × → ${fv(area * 2.5, 0)} m²).
      <span class="bf2-bn">Bottleneck: ${b.id} – ${esc(MTYPES[b.id].n)} – ${b.n} × at ${fv(b.util * 100, 1)} %</span></p>
    <p class="bf2-p">Takt time = available time / quantity: ${ROUTE_KEYS.map((k) => `${esc(RNAME[k])} ${fv(R.takt[k], 2)} min`).join(" · ")}.</p>
    ${tbl(["Type", "Machine", "Load min/day", "Capacity per machine (min)", "Need", "n", "Utilisation", "Operations"], rowsH, "bf2-cap")}
    <details class="bf2-det"><summary>Per operation (start quantity with scrap, need)</summary>${tbl(["Route", "Op", "Machine", "Effective min", "Start qty", "Load min", "Need"], R.rows.map((r) => [r.r, r.no, `<code>${r.m}</code>`, fv(r.eff, 2), fv(r.start, 1), fv(r.load, 0), fv(r.need, 3)]), "bf2-cap")}</details>
    <p class="bf2-small">Rows above 85 % have no reserve (breakdowns, set-up for other sizes). Single machines at 30 – 50 % exist because the step is needed, not for capacity. ${esc(NOTE2)}</p>`;
}

/* ------------------------------------------------------------------ physics calculators */
const PHIN = {
  ind: [["rho", "resistivity ρ hot (Ω·m)", 1.2e-6, 1e-7], ["mur", "relative permeability μr (hot 1, cold ≈ 100)", 1, 1], ["f", "frequency f (kHz)", 30, 1], ["Do", "outside Ø (mm)", 31.5, 0.5], ["cs", "case depth (mm)", 2.5, 0.1], ["v", "scan speed (mm/s)", 4, 0.5]],
  burn: [["a", "infeed per work rev a (mm)", 0.005, 0.001], ["ec", "specific energy ec (J/mm³)", 40, 1], ["eps", "energy into the work ε (corundum 0.75, CBN 0.3)", 0.75, 0.05], ["nw", "work speed (min⁻¹)", 150, 10], ["dw", "work Ø (mm)", 32, 1], ["ds", "wheel Ø (mm)", 500, 10], ["b", "contact width b (mm)", 20, 1], ["limit", "temper-burn limit (°C)", 450, 10]],
  tgr: [["n1", "rough passes", 3, 1], ["w1", "rough work speed (min⁻¹)", 40, 1], ["n2", "semi passes", 2, 1], ["w2", "semi work speed (min⁻¹)", 20, 1], ["n3", "finish passes", 2, 1], ["w3", "finish work speed (min⁻¹)", 10, 1], ["L", "thread length (mm)", 850, 10], ["over", "overrun (mm)", 50, 5], ["Ph", "lead (mm)", 10, 1], ["hand", "load + dress + probe (min)", 6.25, 0.25]],
  therm: [["L", "length (mm)", 850, 10], ["dT", "temperature difference ΔT (K)", 1, 0.1], ["alpha", "α (1/K)", 11.8e-6, 1e-7], ["ep", "C5 e_p limit (µm)", 35, 1]],
  str: [["d", "Ø at the bend (mm)", 36, 0.5], ["sy", "yield strength σ_y (MPa)", 700, 10], ["span", "span between V-blocks L (mm)", 400, 10], ["over", "overbend factor", 1.5, 0.1]],
  ht: [["Tt", "temper temperature (°C)", 170, 5], ["tt", "temper time (h)", 2, 0.25], ["Kc", "carburising K (mm/√h)", 0.63, 0.01], ["tc", "carburising time (h)", 5, 0.25], ["dc", "wanted total case (mm)", 1.2, 0.05]],
  tq: [["Fpr", "preload Fpr (N)", BN.Fpr, 10], ["Ph", "lead (mm)", BS.Ph, 1], ["dpw", "ball circle Ø (mm)", BS.dpw, 0.5], ["tol", "tolerance band ± (%)", 40, 5]],
};
function buildPhys() {
  const defs = PHIN[ST.phys];
  $("bf2PhIn").innerHTML = `<h4>${esc(PHYS.find((p) => p[0] === ST.phys)[1])} – inputs</h4>` + defs.map(([k, t, v, s]) => `<label>${esc(t)} <input type="number" data-ph="${k}" value="${v}" step="${s}" aria-label="${esc(t)}"></label>`).join("");
  $("bf2PhIn").querySelectorAll("[data-ph]").forEach((el) => el.addEventListener("input", runPhys));
  runPhys();
}
let physRows = [];
function runPhys() {
  const v = {}; $("bf2PhIn").querySelectorAll("[data-ph]").forEach((el) => { v[el.dataset.ph] = +el.value; });
  let rowsH = [], note = "";
  if (ST.phys === "ind") {
    const dh = P.inductionDepth(v.rho, v.mur, v.f * 1000), dc = P.inductionDepth(2e-7, 100, v.f * 1000), ip = P.inductionPower({ Do: v.Do, cs: v.cs, v: v.v }), f3 = P.freqForDepth(1.2e-6, 3);
    rowsH = [["Penetration depth", "δ = 503·√(ρ/(μr·f))", `503·√(${v.rho}/(${v.mur}·${v.f * 1000}))`, fv(dh, 2) + " mm"], ["Cold steel (below Curie, μr ≈ 100, ρ 2·10⁻⁷)", "same", `at ${v.f} kHz`, fv(dc, 3) + " mm"],
      ["Frequency for δ hot = 3 mm", "f = ρ·(503/δ)²", "1.2·10⁻⁶·(503/0.003)²", fv(f3 / 1000, 1) + " kHz"], ["Heated case ring", "A = π/4·(Do² − (Do − 2·case)²)", `π/4·(${v.Do}² − ${fv(v.Do - 2 * v.cs, 1)}²)`, fv(ip.A, 1) + " mm²"],
      ["Heat into the case", "P = A·v·ρ_steel·c·ΔT (c 0.65 J/gK, 20 → 900 °C)", `${fv(ip.A, 1)}·${v.v}·7.85·10⁻³·0.65·880`, fv(ip.Pnet, 2) + " kW"], ["Generator power (conduction 50 %, coil η 0.65)", "P_gen = P / (0.5·0.65)", "", fv(ip.Pgen, 1) + " kW"], ["Scan time", "t = L / v", `850 / ${v.v}`, fv(ip.tScan, 0) + " s"]];
    note = "Rule: choose f so that the hot depth δ is about 1 – 1.5 × the wanted case. Higher frequency → thinner case. The real machine uses more power (spray, coil losses, start / end dwell) – the data sheet says ≈ 30 – 40 kW.";
  } else if (ST.phys === "burn") {
    const B = P.grindBurn(v), B2 = P.grindBurn({ ...v, a: 2 * v.a }), Bc = P.grindBurn({ ...v, ec: 30, eps: 0.3 });
    rowsH = [["Work speed", "vw = π·dw·nw/60", `π·${v.dw}·${v.nw}/60`, fv(B.vw, 0) + " mm/s"], ["Specific removal rate", "Q'w = a·vw", `${v.a}·${fv(B.vw, 0)}`, fv(B.Qp, 3) + " mm³/(mm·s)"], ["Power per mm width", "P' = ec·Q'w", `${v.ec}·${fv(B.Qp, 3)}`, fv(B.Pp, 1) + " W/mm"],
      ["Power", "P = P'·b", `${fv(B.Pp, 1)}·${v.b}`, fv(B.P, 0) + " W"], ["Equivalent wheel Ø", "de = ds·dw/(ds + dw)", `${v.ds}·${v.dw}/${v.ds + v.dw}`, fv(B.de, 2) + " mm"], ["Contact length", "lc = √(a·de)", `√(${v.a}·${fv(B.de, 2)})`, fv(B.lc, 3) + " mm"],
      ["Heat flux into the work", "q = ε·P'/lc", `${v.eps}·${fv(B.Pp, 1)}/${fv(B.lc, 3)}`, fv(B.q, 1) + " W/mm²"], ["Max. surface temperature (Jaeger)", "θ = 1.13·q·√(α·lc/vw)/k (k 40 W/mK, α 1.1·10⁻⁵ m²/s)", "", `${fv(B.th, 0)} °C ${B.burn ? "→ BURN" : "→ OK"}`],
      ["Same with 2 × infeed", "", "", `${fv(B2.th, 0)} °C ${B2.burn ? "→ BURN" : "→ OK"}`], ["Same with CBN (ec 30, ε 0.3)", "", "", `${fv(Bc.th, 0)} °C ${Bc.burn ? "→ BURN" : "→ OK"}`]];
    note = "Grinding burn = the surface is tempered (soft, tensile stress) or even re-hardened (white, brittle). Doubling the infeed gives +68 % temperature. CBN conducts heat away from the part (ε ≈ 0.3) – that is why it burns less.";
  } else if (ST.phys === "tgr") {
    const ps = [[v.n1, v.w1], [v.n2, v.w2], [v.n3, v.w3]], t = P.threadTime(ps, v.L, v.over, v.Ph);
    rowsH = ps.map(([n, w], i) => [["Rough", "Semi-finish", "Finish"][i] + " passes", "t = n·(L + o)/(Ph·nw); table feed = Ph·nw", `${n}·${v.L + v.over}/(${v.Ph}·${w})  (feed ${v.Ph * w} mm/min)`, fv(n * (v.L + v.over) / (v.Ph * w), 2) + " min"]);
    rowsH.push(["Grinding time", "Σ", "", fv(t, 2) + " min"], ["Cycle", "grinding + load / dress / probe", `${fv(t, 2)} + ${v.hand}`, fv(t + v.hand, 2) + " min"], ["Thread grinders for 120 / day", "n = 120·1.02·(cycle + 45/20)/(900·0.75)", "", fv(120 * 1.0206 * (t + v.hand + 2.25) / 675, 2)]);
    note = "The work rotation and the table are coupled by the CNC like gears: one turn = one lead. Slow finishing passes give the accuracy – they are 2/3 of the time.";
  } else if (ST.phys === "therm") {
    const dL = P.thermalGrowth(v.L, v.dT, v.alpha);
    rowsH = [["Thermal growth", "ΔL = α·L·ΔT", `${v.alpha}·${v.L}·${v.dT}`, fv(dL, 2) + " µm"], ["Share of the C5 e_p", "ΔL / e_p", `${fv(dL, 2)} / ${v.ep}`, fv(dL / v.ep * 100, 0) + " %"],
      ["Lead compensation (set lead)", "Ph_set = Ph·(1 − α·ΔT_expected)", `10·(1 − ${v.alpha}·${v.dT})`, fv(10 * (1 - v.alpha * v.dT), 6) + " mm"], ["ΔT that uses the full v_300 (18 µm) over 300 mm", "ΔT = v_300 / (α·300)", "", fv(18 / (v.alpha * 300 * 1000), 2) + " K"]];
    note = "Grinding oil 20 ± 0.5 °C, screw temperature measured in the machine; the CNC corrects the lead. Measure the lead only after ≥ 4 h soaking in the 20 °C room.";
  } else if (ST.phys === "str") {
    const s = P.straighten({ d: v.d, sy: v.sy, span: v.span, over: v.over });
    rowsH = [["Section modulus", "W = π·d³/32", `π·${v.d}³/32`, fv(s.W, 0) + " mm³"], ["Moment of inertia", "I = π·d⁴/64", `π·${v.d}⁴/64`, fv(s.I, 0) + " mm⁴"], ["Yield moment", "M_y = σ_y·W", `${v.sy}·${fv(s.W, 0)}`, fv(s.My, 2) + " kN·m"],
      ["Force at first yield (3-point)", "F_y = 4·M_y / L", `4·${fv(s.My * 1e6, 0)} / ${v.span}`, fv(s.F, 1) + " kN"], ["Elastic deflection at yield", "δ_y = F·L³/(48·E·I)", `E 206 000`, fv(s.dy, 2) + " mm"], ["Force for a permanent set", `≈ ${v.over} × F_y`, "", fv(s.Fover, 1) + " kN → press ≥ 100 kN"]];
    note = "Overbend = spring-back + wanted set. Hardened shafts: bend in the soft journal zone or with very small strokes – the case can crack (100 % crack test after straightening).";
  } else if (ST.phys === "ht") {
    const hp = P.hollomon(v.Tt, v.tt), d = P.carbDepth(v.tc, v.Kc), t = P.carbTime(v.dc, v.Kc);
    rowsH = [["Tempering parameter (Hollomon–Jaffe)", "P = T·(20 + log t), T in K, t in h", `${fv(v.Tt + 273.15, 2)}·(20 + log ${v.tt})`, fv(hp, 0)], ["Equal effect at 200 °C", "t = 10^(P/T − 20)", "", fv(Math.pow(10, hp / 473.15 - 20) * 60, 1) + " min"],
      ["Carburising case depth", "d = K·√t", `${v.Kc}·√${v.tc}`, fv(d, 2) + " mm"], ["Time for the wanted case", "t = (d / K)²", `(${v.dc} / ${v.Kc})²`, fv(t, 2) + " h"]];
    note = "Same P → same hardness after tempering. Temper within 1 h after quenching (crack risk). Sub-zero −80 °C before tempering transforms retained austenite (dimensional stability for C3).";
  } else {
    const r = P.preloadTorque(v.Fpr, v.Ph, v.dpw);
    rowsH = [["Lead angle", "λ = atan(Ph/(π·dpw))", `atan(${v.Ph}/(π·${v.dpw}))`, fv(r.lamDeg, 3) + " °"], ["Preload drag torque", "Tp = 0.05/√tanλ · Fpr·Ph/(2π)", `0.05/√${fv(Math.tan(r.lamDeg * Math.PI / 180), 4)} · ${v.Fpr}·${v.Ph / 1000}/(2π)`, fv(r.Tp, 3) + " N·m"],
      ["Accepted band (example)", `Tp ± ${v.tol} %`, "", `${fv(r.Tp * (1 - v.tol / 100), 3)} – ${fv(r.Tp * (1 + v.tol / 100), 3)} N·m`]];
    note = "Measured on the torque tester (screw turns, nut held by a force arm). Too high → the ball class is too big (heat); too low → backlash. The band depends on the grade and the stroke – see ISO 3408-3 / JIS B 1192-3 (check).";
  }
  physRows = rowsH;
  $("bf2PhOut").innerHTML = tbl(["Step", "Formula", "Numbers", "Result"], rowsH.map((r) => [esc(r[0]), `<span class="bf2-f">${esc(r[1])}</span>`, `<span class="bf2-f">${esc(r[2])}</span>`, `<b>${esc(r[3])}</b>`]), "bf2-res") + `<p class="bf2-p">${esc(note)} ${esc(NOTE2)}</p>`;
}

/* ------------------------------------------------------------------ quality gates */
function buildQG() {
  $("bf2QGBody").innerHTML = tbl(["Gate", "Route", "After op", "What is measured", "Spec (example)", "How (gauge / method)", "Frequency", "Reaction if NOT OK"],
    QGATES.map((g) => [`<button class="bf2-link" type="button" data-qg="${g.r}|${g.after}">${g.id}</button>`, esc(RNAME[g.r]), g.after, esc(g.what), esc(g.spec), esc(g.how), esc(g.freq), esc(g.react)]), "bf2-qg") +
    `<p class="bf2-small">${QGATES.length} gates. Run-out, hardness, lead error, profile and preload are measured where the next step cannot correct them any more. Item 5 (quality) takes these gates as its inspection plan. ${esc(NOTE2)}</p>`;
  $("bf2QGBody").querySelectorAll("[data-qg]").forEach((b) => b.addEventListener("click", () => { const [r, no] = b.dataset.qg.split("|"); if (ST.route !== r) setRoute(r); selectOp(no); $("bf2Op").scrollIntoView({ block: "start", behavior: "smooth" }); }));
}

/* ------------------------------------------------------------------ self-check (&bf2test) */
function selfTest() {
  const out = [], log = (s) => { out.push(s); console.log("BF2TEST " + s); };
  let pass = 0, fail = 0;
  const chk = (name, got, exp, tol) => { const ok = Math.abs(got - exp) <= tol; ok ? pass++ : fail++; log(`${ok ? "PASS" : "FAIL"} ${name} = ${Number(got).toPrecision(6)} (hand ${exp} ± ${Number(tol).toPrecision(3)})`); };
  const ok = (name, cond, txt = "") => { cond ? pass++ : fail++; log(`${cond ? "PASS" : "FAIL"} ${name}${txt ? " – " + txt : ""}`); };
  const X = P.CHECK2, rel = (e) => Math.max(Math.abs(e) * 1e-4, 1e-6);
  chk("δ hot 30 kHz (mm)", P.inductionDepth(1.2e-6, 1, 30e3), X.deltaHot30k, rel(X.deltaHot30k)); chk("δ hot 10 kHz (mm)", P.inductionDepth(1.2e-6, 1, 10e3), X.deltaHot10k, rel(X.deltaHot10k));
  chk("δ cold 30 kHz (mm)", P.inductionDepth(2e-7, 100, 30e3), X.deltaCold30k, rel(X.deltaCold30k)); chk("f for δ 3 mm (Hz)", P.freqForDepth(1.2e-6, 3), X.fFor3, 0.05);
  const ip = P.inductionPower(); chk("case ring area (mm²)", ip.A, X.Acase, 1e-3); chk("heat into the case (kW)", ip.Pnet, X.Pnet, 1e-4); chk("generator power (kW)", ip.Pgen, X.Pgen, 1e-4); chk("scan time (s)", ip.tScan, X.tScan, 1e-9);
  chk("thread grinding time G (min)", P.threadTime([[3, 40], [2, 20], [2, 10]], 850, 50, 10), X.tGrindG, 1e-9); chk("W finish grinding (min)", P.threadTime([[2, 10]], 850, 50, 10), X.tGrindWfin, 1e-9);
  chk("whirling time (min)", P.threadTime([[1, 6]], 850, 50, 10), X.tWhirl, 1e-9); chk("nut internal grinding (min)", P.threadTime([[4, 30], [2, 8]], 80, 0, 10), X.tIntGrind, 1e-6);
  chk("thread wheel rpm", P.wheelRpm(40, 400), X.nTgr, 1e-3); chk("internal wheel rpm", P.wheelRpm(30, 25), X.nInt, 0.01); chk("cyl. wheel rpm", P.wheelRpm(45, 500), X.nCgr, 1e-3);
  const t1 = P.turning({ d: 36, L: 870, vc: 200, f: 0.3, ap: 1.8 }), t2 = P.turning({ d: 32.4, L: 870, vc: 250, f: 0.12 });
  chk("turning n rough", t1.n, X.nRough, 1e-3); chk("turning t rough (min)", t1.t, X.tRough, 1e-6); chk("turning t finish (min)", t2.t, X.tFin, 1e-6); chk("turning power (kW)", t1.P, X.Prough, 1e-6);
  const b1 = P.grindBurn(), b2 = P.grindBurn({ a: 0.01 }), b3 = P.grindBurn({ ec: 30, eps: 0.3 });
  chk("burn θ corundum (°C)", b1.th, X.thCor, 1e-3); chk("burn θ 2× infeed (°C)", b2.th, X.thCor2, 1e-3); chk("burn θ CBN (°C)", b3.th, X.thCbn, 1e-3); chk("contact length (mm)", b1.lc, X.lcCor, 1e-6); chk("grinding power (W)", b1.P, X.Pcor, 0.01);
  ok("burn flags: corundum OK, 2× infeed BURN", !b1.burn && b2.burn);
  chk("ΔL 1 K (µm)", P.thermalGrowth(850, 1), X.dL1K, 1e-9); chk("ΔL 2 K (µm)", P.thermalGrowth(850, 2), X.dL2K, 1e-9);
  const s1 = P.straighten(), s2 = P.straighten({ d: 26.4, sy: 1400, span: 300 });
  chk("straightening F_y soft (kN)", s1.F, X.strF, 1e-4); chk("δ_y (mm)", s1.dy, X.strDy, 1e-5); chk("straightening F_y hard core (kN)", s2.F, X.strHardF, 1e-4);
  chk("Hollomon 170 °C 2 h", P.hollomon(170, 2), X.HJ170, 1e-3); chk("carburising t for 1.2 mm (h)", P.carbTime(1.2), X.carbT12, 1e-6); chk("case after 5 h (mm)", P.carbDepth(5), X.carbD5, 1e-6);
  const tq = P.preloadTorque(); chk("preload torque Tp (N·m)", tq.Tp, X.Tp, 1e-6); chk("lead angle (°)", tq.lamDeg, X.lamDeg, 1e-6);
  chk("saw time Ø36 (min)", P.sawTime(36, 30), X.saw36, 1e-6); chk("saw time Ø85 (min)", P.sawTime(85, 30), X.saw85, 1e-6); chk("cost thread grinding (€)", P.costPerPart(150, 40, 0.75), X.costTgr, 1e-3);
  // data + capacity
  const all = ROUTE_KEYS.flatMap((r) => ROUTES[r].ops.map((o) => ({ r, ...o })));
  ok("every op has a machine type", all.every((o) => MTYPES[o.m]), all.filter((o) => !MTYPES[o.m]).map((o) => o.r + o.no).join(","));
  ok("every quality gate points to an op", QGATES.every((g) => ROUTES[g.r].ops.some((o) => o.no === g.after)));
  ok("every gate id used in an op exists", all.every((o) => !o.gate || QGATES.some((g) => g.id === o.gate)));
  chk("ops total", all.length, 51, 0);
  chk("capacity G: machines", CAP0.machines, 72, 0); ok("capacity G: bottleneck BS-TGR", CAP0.bottleneck.id === "BS-TGR", (CAP0.bottleneck.util * 100).toFixed(1) + " %");
  chk("BS-TGR need", CAP0.mach["BS-TGR"].need, 7.664, 0.001); chk("BS-TGR n", CAP0.mach["BS-TGR"].n, 8, 0); chk("takt screw (min)", CAP0.takt.BS, 7.5, 1e-9); chk("takt block (min)", CAP0.takt.LB, 2.25, 1e-9);
  chk("capacity W: machines", capacity({ variant: "W" }).machines, 73, 0); chk("capacity R: machines", capacity({ variant: "R" }).machines, 64, 0);
  chk("MACHINES instances", MACHINES.length, 73, 0); chk("OEE 0.65 thread grinders", capacity({ oee: 0.65 }).mach["BS-TGR"].n, 9, 0);
  chk("flow boxes (BS, G)", $("bf2FlowSvg").querySelectorAll("[data-bf2op]").length, 12, 0);
  chk("quality gate rows", $("bf2QGBody").querySelectorAll("tbody tr").length, QGATES.length, 0);
  chk("machine list rows", $("bf2MachBody").querySelectorAll("tbody tr").length, Object.keys(MTYPES).length, 0);
  chk("capacity rows", $("bf2CapOut").querySelector("table tbody").querySelectorAll("tr").length, Object.keys(CAP0.mach).length, 0);
  // physics tabs
  PHYS.forEach(([k]) => { host.querySelector(`[data-bf2p="${k}"]`).click(); ok(`physics tab ${k}`, physRows.length >= 3 && !physRows.some((r) => /NaN|undefined/.test(r[3])), physRows.length + " rows"); });
  host.querySelector(`[data-bf2p="ind"]`).click();
  // 3D: every module once
  const V = window.bf2View;
  if (V) {
    const seen = new Set(), errs3 = [];
    for (const r of ROUTE_KEYS) for (const v of r === "BS" ? ["G", "W", "R"] : ["G"]) for (const o of opsOf(r, v)) {
      if (seen.has(o.mod + "|" + o.m + "|" + r)) continue; seen.add(o.mod + "|" + o.m + "|" + r);
      try { V.setOp(o, { route: r, f: {}, variant: v }); V.step(0.37); V.step(3.1); V.step(5.3); const rd = V.read(); if (!rd || !rd.rows || !rd.rows.length) errs3.push(o.mod + " no read"); if (rd.rows.some(([a, b]) => /NaN|undefined/.test(String(b)))) errs3.push(o.mod + " NaN"); }
      catch (e) { errs3.push(`${r} ${o.no} ${o.mod}: ${e.message}`); }
    }
    const modsN = new Set([...seen].map((s) => s.split("|")[0])).size;
    ok("3D modules run without error", errs3.length === 0, `${seen.size} module/machine/route combinations, ${modsN} module types${errs3.length ? " – " + errs3.join(" | ") : ""}`);
    chk("3D module types used = types in the data", modsN, new Set(all.map((o) => o.mod)).size, 0);
    // thread grinding sync: table travel per work turn = lead
    ST.route = "BS"; ST.variant = "G"; renderRoute(); selectOp("100");
    V.step(0.5);
    ok("thread grinding module active", V.S.key === "threadgrind");
    const shots = []; const keys = [["BS", "100"], ["BS", "50"], ["LG", "80"], ["BN", "60"]];
    const doShot = (i) => {
      if (i >= keys.length) return evalShots();
      const [r, no] = keys[i]; if (ST.route !== r) setRoute(r); selectOp(no); V.step(2.2);
      setTimeout(() => { shots.push([r + " " + no, V.snapshot()]); doShot(i + 1); }, 450);
    };
    const evalShots = () => {
      let k = 0;
      shots.forEach(([n, url]) => {
        const img = new Image(); img.onload = () => {
          const cv = document.createElement("canvas"); cv.width = 120; cv.height = 80; const g2 = cv.getContext("2d"); g2.drawImage(img, 0, 0, 120, 80);
          const d = g2.getImageData(0, 0, 120, 80).data; let mm = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 232) + Math.abs(d[i + 1] - 236) + Math.abs(d[i + 2] - 240) > 40) mm++;
          ok(`3D snapshot ${n} not blank`, mm > 300, `${mm} of 9600 pixels differ from the background`);
          const dbg = $("bf2Debug"); const im = document.createElement("img"); im.src = url; im.alt = "3D snapshot " + n + " (test)"; im.className = "bf2-shot"; dbg.appendChild(im);
          if (++k === shots.length) { setRoute("BS"); selectOp("100"); finish(); }
        }; img.src = url;
      });
    };
    setTimeout(() => doShot(0), 300);
  } else { ok("3D view built", false); finish(); }
  function finish() {
    const card = $("bfCard2"), imgs = card ? [...card.querySelectorAll(".rr-fig img")] : [];
    imgs.forEach((i) => { i.loading = "eager"; });
    setTimeout(() => {
      ok("card bfCard2", !!card, `buyRows ${card ? card.querySelectorAll('[data-rrp="buy"] tbody tr').length : 0} shopRows ${card ? card.querySelectorAll('[data-rrp="shop"] tbody tr').length : 0}`);
      chk("card drawings", imgs.length, 13, 0); chk("card drawings loaded", imgs.filter((i) => i.complete && i.naturalWidth > 0).length, 13, 0);
      ok("card is after the quality-gate card", card && card.previousElementSibling && card.previousElementSibling.id === "bf2QG");
      log(`DONE pass=${pass} fail=${fail} errors=${errs.length ? errs.join(" | ") : "none"}`);
      const d = $("bf2Debug"); d.hidden = false; const pre = document.createElement("pre"); pre.textContent = out.join("\n"); d.prepend(pre);
    }, 2500);
  }
}

window.addEventListener("bfitemshow", (e) => { if (String(e.detail) === "2") { build(); setTimeout(() => { if (V3) V3.resize(); }, 0); } });
if (window.bfCtl && window.bfCtl.current() === "2" && window.bfCtl.tabVisible()) build();
