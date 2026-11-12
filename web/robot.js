/* ROBOT tab – item 1: 6-axis industrial robot, digital twin (UI, motion, teach pendant, program, charts).
 * Contract: docs/21_contract_robot.md · guide: docs/21_industrial_robot.md
 * Kinematics: robotkin.js (shared) · simulation engine: robotsim.js · 3D: robot3d.js (lazy import, builder A).
 * Offline, no libraries. All values are EXAMPLES – check with the current datasheet.
 * URL: &rb=irb4600 (robot) · &rbrun (start the program in AUTO) · &rbspeed=5 (sim speed) · &rbff=60 (fast-forward 60 s) · &rbtest (fast check of a full
 * cycle for all 4 robots, result in the console + #rbDebug).
 */
import { ROBOTS, PARTS, fk, envelope, payloadTorque, rotFromABC, ik, planPTP, planLIN } from "./robotkin.js";
import { createSim, insText, LOOP_START, SIM } from "./robotsim.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f0 = (v) => (Math.round(v) === 0 ? 0 : Math.round(v)).toString();
const f1 = (v) => (Math.abs(v) < 0.05 ? 0 : v).toFixed(1);
const box = $("rbItem1"), pane = $("tab-robot");
const Q = new URLSearchParams(location.search);
const AX_L = ["X", "Y", "Z", "Rx", "Ry", "Rz"];
const JNAME = ["J1 rotation (column)", "J2 lower arm", "J3 upper arm", "J4 forearm roll", "J5 wrist bend", "J6 flange roll"];

if (box) {
  const sim = createSim(ROBOTS.some((r) => r.id === Q.get("rb")) ? Q.get("rb") : "irb2600");
  window.rbSim = sim;                     // for debugging in the browser console
  let view = null, view3dState = "none";  // none | loading | ok | fail
  const ui = { jogKind: "J", frame: "base", inc: 0, enLatch: false, enHold: false, enKey: false, lastUi: 0, lastSlow: 0, tip: null };
  const getState = () => sim.S;

  /* ------------------------------------------------------------------ skeleton */
  box.innerHTML = `
  <div class="rb-wrap">
    <div class="card rb-bar">
      <div class="rb-row">
        <label class="rb-lbl">Robot <select id="rbSel">${ROBOTS.map((r) => `<option value="${r.id}">${esc(r.ref)} – ${r.payload} kg / ${r.reach} mm</option>`).join("")}</select></label>
        <span class="rb-sep"></span>
        <button class="btn primary" id="rbRun" title="run the program (AUTO: full speed · T1: hold the enabling button)">▶ Run</button>
        <button class="btn" id="rbStep" title="execute one instruction">Step</button>
        <button class="btn" id="rbStop">■ Stop</button>
        <button class="btn ghost" id="rbPP" title="program pointer back to the first line">PP to main</button>
        <label class="rb-chk"><input type="checkbox" id="rbLoop" checked> loop</label>
        <span class="rb-sep"></span>
        <label class="rb-lbl" title="speed override – scales every programmed speed">Override <input type="range" id="rbOvr" min="5" max="100" step="5" value="100"> <b id="rbOvrV">100 %</b></label>
        <span class="seg" role="group" aria-label="simulation speed">${[1, 2, 5].map((s) => `<button class="seg-btn" data-rbspeed="${s}">${s}×</button>`).join("")}</span>
        <span class="rb-sep"></span>
        <button class="btn ghost" id="rbResetCell" title="parts, machine and robot back to the start state">Reset cell</button>
      </div>
      <div class="rb-status" id="rbStatus"></div>
      <div class="rb-alarm" id="rbAlarm" hidden><span id="rbAlarmT"></span> <button class="btn" id="rbAlarmReset">Reset alarm</button></div>
      <div class="rb-msg" id="rbMsg" hidden></div>
    </div>

    <div class="rb-main">
      <div class="card rb-3dcard">
        <div class="card-head"><h2>3D twin – robot + machine-tending cell</h2>
          <span class="rb-toggles">${["cell", "env", "frames", "trail", "ghost"].map((k) => `<label class="rb-chk"><input type="checkbox" data-rbshow="${k}"${sim.S.show[k] ? " checked" : ""}> ${{ cell: "cell", env: "work envelope", frames: "joint frames", trail: "TCP trail", ghost: "ghost (target)" }[k]}</label>`).join("")}</span></div>
        <div class="scene3d rb-3d" id="rb3d"><div class="rb-3dmsg" id="rb3dMsg">3D view is loading …</div></div>
        <p class="hint">Mouse: left = turn, right = move, wheel = zoom. Click a robot part for its description. The cell scales with the robot reach (example layout).</p>
      </div>

      <div class="card rb-tp" id="rbTP">
        <div class="card-head"><h2>Teach pendant</h2><span class="sub">simulation of the hand-held operator panel</span></div>
        <div class="rb-tprow">
          <span class="rb-tpl">Mode</span>
          <span class="seg" role="group" aria-label="operating mode"><button class="seg-btn" data-rbmode="T1" title="manual reduced speed – TCP ≤ 250 mm/s, enabling device needed">T1 manual</button><button class="seg-btn" data-rbmode="AUTO" title="automatic – full speed, safety gate must be closed, nobody in the cell">AUTO</button></span>
          <label class="rb-chk" title="the interlocked gate of the safety fence"><input type="checkbox" id="rbGate" checked> safety gate closed</label>
        </div>
        <div class="rb-tprow">
          <button class="rb-en" id="rbEn" title="3-position enabling switch: hold it (mouse or Space key)">Enabling device<br><small>hold (or Space)</small></button>
          <label class="rb-chk small" title="only a help for the mouse – a real enabling switch must be held by hand"><input type="checkbox" id="rbEnLatch"> keep pressed (simulation help)</label>
        </div>
        <div class="rb-tprow">
          <span class="seg" role="group" aria-label="jog type"><button class="seg-btn" data-rbjog="J">Joints</button><button class="seg-btn" data-rbjog="L">Linear</button></span>
          <span class="seg" role="group" aria-label="jog frame"><button class="seg-btn" data-rbframe="base" title="X Y Z of the robot base">BASE</button><button class="seg-btn" data-rbframe="tool" title="X Y Z of the tool (Z = out of the gripper)">TOOL</button></span>
          <span class="seg" role="group" aria-label="increment"><button class="seg-btn" data-rbinc="0">continuous</button><button class="seg-btn" data-rbinc="1">1 mm / 1°</button><button class="seg-btn" data-rbinc="0.1">0.1</button></span>
        </div>
        <div class="rb-jog" id="rbJog"></div>
        <div class="rb-tprow">
          <button class="btn" id="rbGripO">Gripper open</button><button class="btn" id="rbGripC">Gripper close</button>
          <button class="btn" id="rbHome">Go home</button>
        </div>
        <div class="rb-pose" id="rbPose"></div>
        <p class="hint">T1 = manual reduced speed: TCP ≤ 250 mm/s (ISO 10218-1). Jog and run only while the enabling device is held. AUTO = full speed, only with the safety gate closed – no jogging in AUTO.</p>
      </div>
    </div>

    <div class="rb-grid2">
      <div class="card"><div class="card-head"><h2>Axes – range, speed, live values</h2><span class="sub">catalogue values (example – check with the datasheet)</span></div>
        <div class="table-wrap"><table class="rb-tbl" id="rbAxes"></table></div>
        <p class="hint">Bar = position inside the axis range (red near the limit). Speed % = live axis speed ÷ max axis speed.</p></div>
      <div class="card"><div class="card-head"><h2>Program – machine tending (single gripper)</h2><span class="sub">syntax similar to real robot languages – not a real controller program</span></div>
        <div class="rb-prog" id="rbProg"></div>
        <p class="hint">Click a line to move the program pointer (when stopped). v1000 = 1000 mm/s TCP speed, z50 = 50 mm corner zone, fine = exact stop, tGripper = tool data. In this simulation every point is an exact stop (no corner blending).</p></div>
    </div>

    <div class="card"><div class="card-head"><h2>Teach points</h2><span class="sub">robot base frame, mm and degrees (A B C = rotation about Z, Y, X) · click a row to select</span></div>
      <div class="rb-row" style="margin-bottom:8px">
        <button class="btn" id="rbTouch" title="store the current robot pose into the selected point">Touch up selected point</button>
        <button class="btn" id="rbGoJ">Go to point (MoveJ)</button><button class="btn" id="rbGoL">Go to point (MoveL)</button>
        <button class="btn ghost" id="rbPtsReset">Reset points</button><span class="muted small" id="rbSelPt"></span></div>
      <div class="table-wrap"><table class="rb-tbl" id="rbPts"></table></div></div>

    <div class="rb-grid2">
      <div class="card"><div class="card-head"><h2>Live charts</h2><span class="sub">last 25 s of simulated time</span></div>
        <div class="rb-legend" id="rbLegend"></div>
        <div class="rb-ch"><div class="rb-cht">Joint angles <span class="muted">deg</span></div><canvas id="rbChA" height="170"></canvas></div>
        <div class="rb-ch"><div class="rb-cht">Joint speeds <span class="muted">% of the max axis speed</span></div><canvas id="rbChV" height="170"></canvas></div>
        <div class="rb-ch"><div class="rb-cht">TCP speed <span class="muted">mm/s</span> <span class="muted small">(dashed line = 250 mm/s T1 limit)</span></div><canvas id="rbChT" height="120"></canvas></div>
      </div>
      <div class="card"><div class="card-head"><h2>Cycle time</h2><span class="sub">measured in the simulation, last full cycle</span></div><div id="rbCycle"></div></div>
    </div>

    <div class="rb-grid2">
      <div class="card"><div class="card-head"><h2>Catalogue data</h2><span class="sub" id="rbRef"></span></div><div id="rbCat"></div></div>
      <div class="card"><div class="card-head"><h2>Work envelope (side view) + payload check</h2><span class="sub">wrist-centre envelope from the axis ranges</span></div>
        <div id="rbEnv"></div><div id="rbPay"></div></div>
    </div>

    <div class="card"><div class="card-head"><h2>Mechanical structure</h2><span class="sub">typical for this robot class – click a row to highlight the part in 3D</span></div>
      <div class="table-wrap"><table class="rb-tbl rb-parts" id="rbParts"></table></div></div>
    <pre id="rbDebug" hidden></pre>
  </div>`;

  /* ------------------------------------------------------------------ helpers */
  const msg = (t) => { const el = $("rbMsg"); el.textContent = t; el.hidden = !t; };
  const enabled = () => ui.enLatch || ui.enHold || ui.enKey;
  function syncEnable() { sim.enable = enabled(); $("rbEn").classList.toggle("on", sim.enable); }
  function segs(attr, val) { box.querySelectorAll(`[${attr}]`).forEach((b) => b.classList.toggle("active", b.getAttribute(attr) === String(val))); }
  function setMode(m) {
    sim.mode = m; segs("data-rbmode", m);
    if (m === "AUTO") { sim.jog = null; }
    $("rbTP").classList.toggle("rb-auto", m === "AUTO");
  }
  function css(name, fb) { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fb; }
  const COLS = () => [1, 2, 3, 4, 5, 6].map((i) => css("--rb-c" + i, "#2a78d6"));

  /* ------------------------------------------------------------------ static cards (rebuilt when the robot changes) */
  function buildStatic() {
    const rb = sim.S.rb, C = sim.S.C, d = rb.dims;
    $("rbSel").value = rb.id;
    $("rbRef").textContent = rb.ref + " – reference robot, values from the public catalogue (example)";
    const rows = [
      ["Class / typical use", rb.cls], ["Payload (max, at the flange)", rb.payload + " kg"], ["Reach (wrist centre, max)", rb.reach + " mm"],
      ["Robot mass", rb.mass + " kg"], ["Repeatability (ISO 9283)", "± " + rb.rep + " mm"], ["Mounting", rb.mount], ["Protection", rb.ip],
      ["Controller", rb.ctrl], ["Reducers", rb.gear], ["Balancing device on J2", rb.balancer ? "yes (spring / gas cylinder)" : "no (small robot)"],
      ["Base footprint", rb.base[0] + " × " + rb.base[1] + " mm"], ["Acceleration time (model)", rb.tacc + " s – ESTIMATE, not catalogue"],
    ];
    $("rbCat").innerHTML = `<div class="rb-cat"><table class="rb-kv">${rows.map((r) => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join("")}
      <tr><th>Arm dimensions</th><td>h1 ${d.h1} · a1 ${d.a1} · a2 ${d.a2} · a3 ${d.a3} · d4 ${d.d4} · d6 ${d.d6} mm</td></tr></table>${dimSvg(rb)}</div>
      <p class="hint">Check every value with the current datasheet of the supplier before you design or buy. The acceleration time is our estimate (it depends on the load).</p>`;
    // axes table skeleton
    $("rbAxes").innerHTML = `<tr><th>Axis</th><th class="num">Range °</th><th class="num">Max speed °/s</th><th class="num">Angle °</th><th>Position in range</th><th class="num">Speed °/s</th><th class="num">%</th></tr>` +
      rb.lim.map((l, i) => `<tr><td>${JNAME[i]}</td><td class="num">${l[0]} … +${l[1]}</td><td class="num">${rb.vmax[i]}</td><td class="num" id="rbA${i}"></td>
        <td><div class="rb-lim"><i id="rbAb${i}"></i></div></td><td class="num" id="rbAv${i}"></td><td class="num" id="rbAp${i}"></td></tr>`).join("");
    buildPts(); buildProg(); buildEnv(); buildPay(); buildCycle();
  }
  function dimSvg(rb) {
    const d = rb.dims, W = 330, H = 250, X1 = d.a1 + d.d4 + d.d6, Z1 = d.h1 + d.a2 + d.a3;
    const s = Math.min((W - 115) / (X1 + rb.base[0] / 2), (H - 82) / Z1);
    const ox = rb.base[0] / 2 * s + 95, oy = H - 22;
    const X = (x) => ox + x * s, Y = (z) => oy - z * s;
    const J2 = [d.a1, d.h1], J3 = [d.a1, d.h1 + d.a2], FA = [d.a1, Z1], WC = [d.a1 + d.d4, Z1], FL = [X1, Z1];
    const L = (a, b, cls = "rb-arm") => `<line class="${cls}" x1="${X(a[0])}" y1="${Y(a[1])}" x2="${X(b[0])}" y2="${Y(b[1])}"/>`;
    const dimV = (x, z0, z1, t) => `<line class="rb-dim" x1="${X(x)}" y1="${Y(z0)}" x2="${X(x)}" y2="${Y(z1)}"/><text class="rb-dt" x="${X(x) - 4}" y="${(Y(z0) + Y(z1)) / 2 + 4}" text-anchor="end">${t}</text>`;
    const dimH = (z, x0, x1, t, dy = -5) => `<line class="rb-dim" x1="${X(x0)}" y1="${Y(z)}" x2="${X(x1)}" y2="${Y(z)}"/><text class="rb-dt" x="${(X(x0) + X(x1)) / 2}" y="${Y(z) + dy}" text-anchor="middle">${t}</text>`;
    const bw = rb.base[0] * s, bh = Math.max(10, d.h1 * 0.35 * s);
    return `<svg class="rb-dimsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="arm dimensions side view">
      <line class="rb-floor" x1="10" y1="${oy}" x2="${W - 10}" y2="${oy}"/>
      <rect class="rb-body" x="${X(0) - bw / 2}" y="${oy - bh}" width="${bw}" height="${bh}" rx="3"/>
      ${L([0, 0], [0, d.h1])}${L([0, d.h1], J2)}${L(J2, J3)}${L(J3, FA)}${L(FA, WC)}${L(WC, FL)}
      ${[J2, J3, WC].map((p) => `<circle class="rb-jt" cx="${X(p[0])}" cy="${Y(p[1])}" r="5"/>`).join("")}
      <rect class="rb-body" x="${X(X1)}" y="${Y(Z1) - 6}" width="4" height="12"/>
      ${dimV(-rb.base[0] / 2 / 1 - 40 / s, 0, d.h1, "h1 " + d.h1)}
      ${d.a1 ? dimH(d.h1 - 22 / s, 0, d.a1, "a1 " + d.a1, 13) : ""}
      ${dimV(d.a1 - 14 / s, d.h1, d.h1 + d.a2, "a2 " + d.a2)}
      ${dimV(d.a1 - 14 / s, d.h1 + d.a2, Z1, "a3 " + d.a3)}
      ${dimH(Z1 + 30 / s, d.a1, d.a1 + d.d4, "d4 " + d.d4)}
      ${dimH(Z1 + 30 / s, d.a1 + d.d4, X1, "d6 " + d.d6, -18)}
      <text class="rb-dt" x="${X(J2[0]) + 8}" y="${Y(J2[1]) + 14}">J2</text><text class="rb-dt" x="${X(J3[0]) + 8}" y="${Y(J3[1]) + 14}">J3</text>
      <text class="rb-dt" x="${X(WC[0])}" y="${Y(WC[1]) + 18}" text-anchor="middle">wrist centre</text>
      <text class="rb-dt" x="${W - 12}" y="${oy - 6}" text-anchor="end">zero pose, side view, mm</text></svg>`;
  }

  /* ---------------- points */
  function buildPts() {
    $("rbPts").innerHTML = `<tr><th>Name</th><th>Type</th><th class="num">X</th><th class="num">Y</th><th class="num">Z</th><th class="num">A</th><th class="num">B</th><th class="num">C</th><th>Meaning</th></tr>` +
      sim.pts.map((p) => `<tr data-pt="${p.n}" class="${sim.selPt === p.n ? "rb-sel" : ""}"><td><code>${p.n}</code></td><td>${p.type === "joint" ? "joint target" : "TCP pose"}</td>
        ${p.p.concat(p.abc).map((v) => `<td class="num">${f1(v)}</td>`).join("")}<td class="muted">${esc(p.note)}${p.type === "joint" ? " · J = " + p.q.map(f0).join(" / ") : ""}</td></tr>`).join("");
    $("rbSelPt").textContent = sim.selPt ? "selected: " + sim.selPt : "no point selected";
  }
  $("rbPts").addEventListener("click", (e) => { const tr = e.target.closest("tr[data-pt]"); if (!tr) return; sim.selPt = tr.dataset.pt; buildPts(); });
  $("rbTouch").addEventListener("click", () => {
    if (!sim.selPt) return msg("Select a point in the table first");
    if (sim.run.on) return msg("Stop the program before touch up");
    sim.touchUp(sim.selPt); buildPts(); msg(sim.selPt + " touched up = current robot pose stored");
  });
  $("rbGoJ").addEventListener("click", () => goPt(false));
  $("rbGoL").addEventListener("click", () => goPt(true));
  function goPt(lin) {
    if (!sim.selPt) return msg("Select a point in the table first");
    if (sim.run.on) return msg("Stop the program first");
    sim.goPoint(sim.selPt, lin);
    msg(sim.mode === "T1" && !sim.enable ? "Moving to " + sim.selPt + " – hold the enabling button" : "Moving to " + sim.selPt + (lin ? " (MoveL 250 mm/s)" : " (MoveJ)"));
  }
  $("rbPtsReset").addEventListener("click", () => { if (sim.run.on) return msg("Stop the program first"); const id = sim.S.rb.id; const S = sim.S; sim.pts = null; sim.setRobot(id); sim.S.show = S.show; buildStatic(); msg("Points back to the generated example values (cell reset)"); });

  /* ---------------- program listing */
  function buildProg() {
    const L = [];
    L.push(`<div class="rb-pl rb-pk">PROC main()</div>`);
    sim.prog.forEach((ins, i) => {
      if (i === LOOP_START) L.push(`<div class="rb-pl rb-pk">&nbsp;&nbsp;WHILE TRUE DO</div>`);
      const ind = i >= LOOP_START ? "&nbsp;&nbsp;&nbsp;&nbsp;" : "&nbsp;&nbsp;";
      L.push(`<div class="rb-pl" data-pc="${i}" id="rbPl${i}"><span class="rb-ln">${i + 1}</span>${ind}${esc(insText(ins))} <span class="rb-cm">! ${esc(ins.c)}</span></div>`);
    });
    L.push(`<div class="rb-pl rb-pk">&nbsp;&nbsp;ENDWHILE</div><div class="rb-pl rb-pk">ENDPROC</div>`);
    $("rbProg").innerHTML = L.join("");
  }
  $("rbProg").addEventListener("click", (e) => {
    const el = e.target.closest("[data-pc]"); if (!el) return;
    if (sim.run.on) return msg("Stop the program before you move the program pointer");
    sim.run.pc = +el.dataset.pc; sim.run.act = null; sim.run.pass = []; msg("Program pointer on line " + (sim.run.pc + 1));
  });

  /* ---------------- envelope + payload */
  let envMap = null;
  function buildEnv() {
    const S = sim.S, rb = S.rb, C = S.C, pts = envelope(rb, 4);
    let r0 = Infinity, r1 = -Infinity, z0 = -C.pedestal, z1 = -Infinity;
    for (const [r, z] of pts) { r0 = Math.min(r0, r); r1 = Math.max(r1, r); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const W = 460, H = 330, m = 26, s = Math.min((W - 2 * m) / (r1 - r0), (H - 2 * m) / (z1 - z0));
    const X = (r) => m + (r - r0) * s, Y = (z) => H - m - (z - z0) * s;
    envMap = { X, Y, s };
    const dots = pts.map(([r, z]) => `M${X(r).toFixed(1)} ${Y(z).toFixed(1)}h0`).join("");
    const rp = Math.hypot(C.infeed.pick[0], C.infeed.pick[1]), rq = Math.hypot(C.outfeed.place[0], C.outfeed.place[1]);
    const cp = Math.abs(rp - rq) < 1 && Math.abs(C.infeed.pick[2] - C.outfeed.place[2]) < 1 ? [["pick / place (TCP)", rp, C.infeed.pick[2]]] : [["pick (TCP)", rp, C.infeed.pick[2]], ["place (TCP)", rq, C.outfeed.place[2]]];
    cp.push(["machine (TCP)", C.machine.load[0], C.machine.load[2]]);
    $("rbEnv").innerHTML = `<svg class="rb-envsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="work envelope side view">
      <path class="rb-envd" d="${dots}"/>
      <line class="rb-floor" x1="${m}" y1="${Y(-C.pedestal)}" x2="${W - m}" y2="${Y(-C.pedestal)}"/>
      <line class="rb-ax" x1="${X(0)}" y1="${m / 2}" x2="${X(0)}" y2="${H - m / 2}"/>
      <text class="rb-dt" x="${X(0) + 4}" y="${m}">J1 axis</text>
      <text class="rb-dt" x="${W - m}" y="${Y(-C.pedestal) - 5}" text-anchor="end">${C.pedestal ? "floor (robot on " + C.pedestal + " mm pedestal)" : "floor"}</text>
      ${cp.map(([n, r, z], i) => `<g><rect class="rb-cp" x="${X(r) - 4}" y="${Y(z) - 4}" width="8" height="8"/><text class="rb-dt" x="${X(r) + 7}" y="${Y(z) + (i === cp.length - 1 ? -6 : 16)}">${n}</text></g>`).join("")}
      <polyline class="rb-envarm" id="rbEnvArm" points=""/><circle class="rb-envwc" id="rbEnvWc" r="5"/>
      <text class="rb-dt" x="${m}" y="${H - 6}">r = distance from J1 axis, mm · grey = wrist-centre positions · reach ${rb.reach} mm</text></svg>`;
  }
  function updEnv() {
    if (!envMap) return;
    const S = sim.S, st = fk(S.rb, S.q, S.tool), c = Math.cos(S.q[0] * Math.PI / 180), sn = Math.sin(S.q[0] * Math.PI / 180);
    const rz = (p) => [p[0] * c + p[1] * sn, p[2]];
    const ch = [[0, 0, 0], [0, 0, S.rb.dims.h1], ...[1, 2, 3, 4].map((i) => [st.frames[i][3], st.frames[i][7], st.frames[i][11]]), st.p];
    const pts = ch.map((p) => rz(p)).map(([r, z]) => `${envMap.X(r).toFixed(1)},${envMap.Y(z).toFixed(1)}`).join(" ");
    $("rbEnvArm").setAttribute("points", pts);
    const w = rz(st.wc); $("rbEnvWc").setAttribute("cx", envMap.X(w[0])); $("rbEnvWc").setAttribute("cy", envMap.Y(w[1]));
  }
  function buildPay() {
    const S = sim.S, rb = S.rb, C = S.C, P = sim.payload(), ratio = P.m / rb.payload;
    const lp = sim.pt("pMachLoad"), lq = lp ? sim.pointQ(lp) : null;
    const tq = lq && lq.ok ? payloadTorque(rb, lq.q, P.m, S.tool) : null;
    const st = ratio <= 0.8 ? ["ok", "OK – the load uses " + Math.round(ratio * 100) + " % of the max payload"] : ratio <= 1 ? ["warn", "WARN – close to the max payload (" + Math.round(ratio * 100) + " %), check the load diagram carefully"] : ["bad", "NOT OK – heavier than the max payload (" + Math.round(ratio * 100) + " %)"];
    $("rbPay").innerHTML = `<h3>Payload check (example values)</h3>
      <table class="rb-kv"><tr><th>Part (compressor housing, example)</th><td>${P.part} kg · Ø${C.part.d} × ${C.part.h} mm</td></tr>
      <tr><th>Gripper + adapter plate (example)</th><td>${P.grip} kg</td></tr>
      <tr><th>Total load m = part + gripper</th><td><b>${P.m.toFixed(1)} kg</b> of max ${rb.payload} kg</td></tr>
      <tr><th>Centre of gravity from the flange (tool Z)</th><td>≈ ${Math.round(P.cog)} mm (TCP ${C.toolLen} mm + half part ${C.part.h / 2} mm)</td></tr>
      ${tq ? `<tr><th>Gravity torque from the load at pMachLoad</th><td>J2 ${tq.j2.toFixed(0)} N·m · J3 ${tq.j3.toFixed(0)} N·m · J5 ${tq.j5.toFixed(1)} N·m</td></tr>` : ""}</table>
      <div class="rb-paybar"><i style="width:${Math.min(100, ratio * 100)}%" class="rb-pb-${st[0]}"></i></div>
      <p class="rb-st rb-st-${st[0]}">${st[0] === "ok" ? "✓" : "!"} ${esc(st[1])}</p>
      <p class="hint">Formula: torque = m · g · lever. Example J5: ${P.m.toFixed(1)} kg × 9.81 m/s² × ${(tq ? tq.j5 / (P.m * 9.81) : 0).toFixed(3)} m = ${tq ? tq.j5.toFixed(1) : "–"} N·m (horizontal lever from the wrist centre to the load). The max payload is only allowed with the centre of gravity close to the flange – the real limit is the <b>load diagram</b> of the robot (allowed mass vs. CoG distance) and the allowed wrist moments of J4/J5/J6. Arm masses are not included here. Check with the supplier's load-diagram tool.</p>`;
  }

  /* ---------------- cycle time card */
  function buildCycle() {
    const c = sim.run.last, el = $("rbCycle");
    if (!c) { el.innerHTML = `<p class="muted">Run the program (loop) – the table fills after the first full cycle (from "WaitDI diMachDone" to "MoveJ pHome").</p>`; return; }
    const rows = sim.prog.map((ins, i) => c.times[i] === null ? "" : `<tr><td class="num">${i + 1}</td><td><code>${esc(insText(ins))}</code></td><td>${ins.g}</td><td class="num">${c.times[i].toFixed(2)}</td><td><div class="rb-tbar"><i style="width:${Math.min(100, 100 * c.times[i] / c.total * 3)}%" class="${ins.op === "WaitDI" ? "rb-tw" : ""}"></i></div></td></tr>`).join("");
    el.innerHTML = `<div class="rb-kpis">
        <div class="kpi"><div class="label">Cycle time</div><div class="value">${c.total.toFixed(1)} s</div><div class="note">cycle #${c.n} · ${c.mode} · override ${Math.round(c.ovr * 100)} %</div></div>
        <div class="kpi"><div class="label">Output</div><div class="value">${c.pph.toFixed(0)}</div><div class="note">parts / hour = 3600 / ${c.total.toFixed(1)}</div></div>
        <div class="kpi"><div class="label">Robot busy</div><div class="value">${c.robot.toFixed(1)} s</div><div class="note">waiting for the machine ${c.wait.toFixed(1)} s</div></div>
        <div class="kpi"><div class="label">Machine idle</div><div class="value">${c.machIdle.toFixed(1)} s</div><div class="note">= cycle − machining ${SIM.machTime} s</div></div></div>
      <div class="rb-dbl"><b>Double gripper (estimate):</b> with two grippers the robot picks the raw part and places the finished part while the machine is cutting.
        The machine only waits for the exchange: door + in + take finished part + turn gripper 180° (${c.swap.toFixed(1)} s) + put raw part + out + door ≈ <b>${c.dblIdle.toFixed(1)} s</b>.
        Cycle ≈ max(${SIM.machTime} + ${c.dblIdle.toFixed(1)}, ${c.dblIdle.toFixed(1)} + ${c.outside.toFixed(1)}) = <b>${c.dblCycle.toFixed(1)} s</b> → <b>${(3600 / c.dblCycle).toFixed(0)} parts/h</b>
        (+${(100 * (c.total / c.dblCycle - 1)).toFixed(0)} %). Cost: heavier gripper (check the payload), more complex.</div>
      <div class="table-wrap rb-scroll"><table class="rb-tbl"><tr><th class="num">Line</th><th>Instruction</th><th>Group</th><th class="num">Time s</th><th></th></tr>${rows}
        <tr><th></th><th>Total cycle</th><th></th><th class="num">${c.total.toFixed(2)}</th><th></th></tr></table></div>
      <p class="hint">Times come from the real axis speeds (catalogue) + an estimated acceleration time. Real cycle times are usually 5–15 % different (corner zones, load, controller tuning) – check with an offline simulation of the supplier.</p>`;
  }

  /* ---------------- structure table */
  function buildParts() {
    $("rbParts").innerHTML = `<tr><th>Part</th><th>Axis</th><th>What it is / why it is there</th></tr>` +
      PARTS.map((p) => `<tr data-part="${p.k}"><td><b>${esc(p.n)}</b></td><td>${p.ax ? "J" + p.ax : "–"}</td><td class="rb-wrapt">${esc(p.t)}</td></tr>`).join("");
  }
  function selPart(k, from3d) {
    sim.S.sel = k;
    box.querySelectorAll("#rbParts tr[data-part]").forEach((tr) => tr.classList.toggle("rb-sel", tr.dataset.part === k));
    if (!from3d && view) try { view.select(k); } catch (e) { console.warn(e); }
  }
  $("rbParts").addEventListener("click", (e) => { const tr = e.target.closest("tr[data-part]"); if (!tr) return; const k = tr.dataset.part; selPart(sim.S.sel === k ? null : k); });

  /* ------------------------------------------------------------------ teach pendant */
  function buildJog() {
    const L = ui.jogKind === "L";
    $("rbJog").innerHTML = [0, 1, 2, 3, 4, 5].map((i) => `<div class="rb-jr"><button class="rb-jb" data-jax="${i}" data-jdir="-1">−</button>
      <span class="rb-jn">${L ? AX_L[i] : "J" + (i + 1)}</span><button class="rb-jb" data-jax="${i}" data-jdir="1">+</button></div>`).join("");
    segs("data-rbjog", ui.jogKind); segs("data-rbframe", ui.frame); segs("data-rbinc", ui.inc);
    box.querySelectorAll("[data-rbframe]").forEach((b) => (b.disabled = !L));
  }
  function jogStart(ax, dir) {
    if (sim.mode !== "T1") return msg("Jog is only possible in T1 (manual reduced speed). Switch the mode.");
    if (sim.run.on) return msg("Stop the program first");
    if (sim.S.live.alarm) return msg("Reset the alarm first");
    if (!sim.enable) return msg("Hold the enabling device (button or Space key) – no motion without it");
    msg("");
    if (ui.inc > 0) { sim.jogStep(ui.jogKind, ax, dir, ui.inc, ui.frame); return; }
    sim.jog = { kind: ui.jogKind, axis: ax, dir, frame: ui.frame };
  }
  const jogStop = () => { sim.jog = null; };
  $("rbJog").addEventListener("pointerdown", (e) => { const b = e.target.closest("[data-jax]"); if (!b) return; e.preventDefault(); b.setPointerCapture(e.pointerId); jogStart(+b.dataset.jax, +b.dataset.jdir); });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => $("rbJog").addEventListener(ev, jogStop));
  box.querySelectorAll("[data-rbjog]").forEach((b) => b.addEventListener("click", () => { ui.jogKind = b.dataset.rbjog; buildJog(); }));
  box.querySelectorAll("[data-rbframe]").forEach((b) => b.addEventListener("click", () => { ui.frame = b.dataset.rbframe; buildJog(); }));
  box.querySelectorAll("[data-rbinc]").forEach((b) => b.addEventListener("click", () => { ui.inc = +b.dataset.rbinc; buildJog(); }));
  box.querySelectorAll("[data-rbmode]").forEach((b) => b.addEventListener("click", () => {
    if (sim.run.on) return msg("Stop the program before you change the mode (on a real robot: key switch)");
    setMode(b.dataset.rbmode);
  }));
  const en = $("rbEn");
  en.addEventListener("pointerdown", (e) => { e.preventDefault(); en.setPointerCapture(e.pointerId); ui.enHold = true; syncEnable(); });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => en.addEventListener(ev, () => { ui.enHold = false; syncEnable(); }));
  $("rbEnLatch").addEventListener("change", (e) => { ui.enLatch = e.target.checked; syncEnable(); });
  const typing = (e) => /INPUT|SELECT|TEXTAREA/.test((e.target && e.target.tagName) || "") && e.target.type !== "checkbox" && e.target.type !== "range";
  window.addEventListener("keydown", (e) => { if (e.code === "Space" && pane.classList.contains("active") && !typing(e)) { e.preventDefault(); if (!ui.enKey) { ui.enKey = true; syncEnable(); } } });
  window.addEventListener("keyup", (e) => { if (e.code === "Space" && ui.enKey) { ui.enKey = false; syncEnable(); } });
  window.addEventListener("blur", () => { ui.enKey = false; ui.enHold = false; syncEnable(); jogStop(); });
  $("rbGate").addEventListener("change", (e) => { sim.gateClosed = e.target.checked; if (!sim.gateClosed && sim.mode === "AUTO" && (sim.run.on || sim.motion)) sim.alarm("Protective stop: safety gate opened in AUTO"); });
  $("rbGripO").addEventListener("click", () => { if (sim.run.on) return msg("Stop the program first"); sim.gripper(0); });
  $("rbGripC").addEventListener("click", () => { if (sim.run.on) return msg("Stop the program first"); sim.gripper(1); });
  $("rbHome").addEventListener("click", () => { if (sim.run.on) return msg("Stop the program first"); sim.goHome(); msg(sim.mode === "T1" && !sim.enable ? "Go home – hold the enabling button" : "Moving home (MoveJ)"); });

  /* ------------------------------------------------------------------ bar */
  $("rbSel").addEventListener("change", (e) => setRobot(e.target.value));
  function setRobot(id) {
    sim.stopProg(); sim.selPt = null; sim.setRobot(id); buildStatic(); selPart(null);
    if (view) try { view.rebuild(); view.fit(); } catch (er) { console.warn(er); }
    msg("Robot changed: " + sim.S.rb.ref + " – the cell layout scales with the reach");
  }
  $("rbRun").addEventListener("click", () => { const r = sim.runProg(false); msg(r || (sim.mode === "T1" ? "T1: program runs only while the enabling device is held, TCP ≤ 250 mm/s" : "")); });
  $("rbStep").addEventListener("click", () => { const r = sim.runProg(true); msg(r); });
  $("rbStop").addEventListener("click", () => { sim.stopProg(); msg("Stopped. Run continues with the current line."); });
  $("rbPP").addEventListener("click", () => { sim.ppToMain(); msg("Program pointer on line 1"); });
  $("rbLoop").addEventListener("change", (e) => (sim.run.loop = e.target.checked));
  $("rbOvr").addEventListener("input", (e) => { sim.ovr = e.target.value / 100; $("rbOvrV").textContent = e.target.value + " %"; });
  box.querySelectorAll("[data-rbspeed]").forEach((b) => b.addEventListener("click", () => { sim.speed = +b.dataset.rbspeed; segs("data-rbspeed", sim.speed); }));
  $("rbResetCell").addEventListener("click", () => { sim.resetCell(); sim.run.loop = $("rbLoop").checked; msg("Cell reset: robot home, machine holds a finished part, 3 raw parts on the infeed"); });
  $("rbAlarmReset").addEventListener("click", () => { sim.resetAlarm(); msg("Alarm reset – correct the cause, then Run again (continues with the current line)"); });
  box.querySelectorAll("[data-rbshow]").forEach((c) => c.addEventListener("change", () => { sim.S.show[c.dataset.rbshow] = c.checked; }));
  sim.onCycle = (c) => {
    buildCycle();
    const line = `RBCYCLE rb=${c.rb} n=${c.n} cycle=${c.total.toFixed(2)}s robot=${c.robot.toFixed(2)}s wait=${c.wait.toFixed(2)}s pph=${c.pph.toFixed(1)} dbl=${c.dblCycle.toFixed(2)}s`;
    console.log(line); $("rbDebug").textContent = line + "\n" + $("rbDebug").textContent;
  };
  sim.onAlarm = (t) => { console.warn("RBALARM " + sim.S.rb.id + ": " + t); };

  /* ------------------------------------------------------------------ live UI (10 Hz) */
  function updLive() {
    const S = sim.S, rb = S.rb, R = sim.run, M = sim.mach, P = sim.pose(), st = P.st;
    const h = sim.hist[sim.hist.length - 1];
    // axes
    for (let i = 0; i < 6; i++) {
      const [lo, hi] = rb.lim[i], q = S.q[i], u = (q - lo) / (hi - lo);
      $("rbA" + i).textContent = f1(q);
      const b = $("rbAb" + i); b.style.left = (100 * u).toFixed(1) + "%"; b.className = u < 0.05 || u > 0.95 ? "rb-near" : "";
      const pct = h ? h.pct[i] : 0;
      $("rbAv" + i).textContent = f0(pct * rb.vmax[i] / 100); $("rbAp" + i).textContent = f0(pct);
    }
    // pose
    const cfg = P.cfg;
    $("rbPose").innerHTML = `<div class="rb-pg">${["X", "Y", "Z"].map((n, i) => `<span><small>${n}</small><b>${f1(st.p[i])}</b></span>`).join("")}
      ${["A", "B", "C"].map((n, i) => `<span><small>${n}</small><b>${f1(st.abc[i])}</b></span>`).join("")}</div>
      <div class="small">TCP in BASE, mm / deg · tool tGripper (Z ${S.tool.z} mm) · TCP speed ${h ? f0(h.v) : 0} mm/s</div>
      <div class="small">Configuration: ${cfg ? `${cfg.front ? "front" : "back"} · elbow ${cfg.up ? "up" : "down"} · wrist ${cfg.flip ? "flipped (J5 < 0)" : "not flipped"}` : "–"}
      ${P.sing ? ' · <b class="rb-wtxt">near wrist singularity (J5 ≈ 0)</b>' : ""}</div>`;
    // status
    const ins = sim.prog[R.pc];
    const state = S.live.alarm ? "ALARM" : R.on ? (R.act && R.act.k === "wait" ? "waiting" : "running") : sim.motion ? "moving" : sim.jog && sim.enable ? "jogging" : "stopped";
    const mst = M.state === "run" ? `cutting · ${M.tLeft.toFixed(1)} s left` : M.state === "done" ? "part finished" : M.part ? "part loaded" : "empty";
    $("rbStatus").innerHTML = `<span class="rb-chip rb-c-${state}">${state}</span>
      <span><small>Mode</small> <b>${sim.mode}</b>${sim.mode === "T1" ? (sim.enable ? " · enabled" : " · not enabled") : ""}</span>
      <span><small>Line</small> <b>${R.pc + 1}</b> <code>${ins ? esc(insText(ins)) : "–"}</code></span>
      <span><small>Machine</small> <b>${mst}</b> · door ${Math.round(S.door * 100)} %</span>
      <span><small>Gripper</small> <b>${S.grip > 0.5 ? "closed" : "open"}</b>${S.parts.some((p) => p.held) ? " · holding a part" : ""}</span>
      <span><small>Parts done</small> <b>${sim.stats.done}</b></span>
      <span><small>Last cycle</small> <b>${R.last ? R.last.total.toFixed(1) + " s" : "–"}</b></span>
      <span><small>Sim time</small> ${sim.simT.toFixed(0)} s</span>`;
    const al = S.live.alarm; $("rbAlarm").hidden = !al; if (al) $("rbAlarmT").textContent = "ALARM: " + al;
    if (sim.msg) { msg(sim.msg); sim.msg = ""; }
    box.querySelectorAll(".rb-pl.rb-cur").forEach((e) => e.classList.remove("rb-cur"));
    const pl = $("rbPl" + R.pc); if (pl) pl.classList.add("rb-cur");
    $("rbRun").disabled = R.on; $("rbStop").disabled = !R.on && !sim.motion;
  }

  /* ---------------- charts (canvas, no libraries) */
  function chart(cv, series, o) {
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 400, H = +cv.getAttribute("height");
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.style.height = H + "px"; cv.height = Math.round(H * dpr); }
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const hs = sim.hist, n = hs.length, ml = 40, mr = 8, mt = 6, mb = 18;
    const grid = css("--grid", "#ddd"), muted = css("--muted", "#888"), axis = css("--axis", "#bbb");
    let lo = o.min, hi = o.max;
    if (lo === undefined || hi === undefined) {
      lo = Infinity; hi = -Infinity;
      for (const s of series) for (const h of hs) { const v = s.f(h); if (v < lo) lo = v; if (v > hi) hi = v; }
      if (!isFinite(lo)) { lo = -1; hi = 1; }
      const pad = Math.max(5, (hi - lo) * 0.08); lo -= pad; hi += pad;
      if (o.min !== undefined) lo = o.min; if (o.floor !== undefined) hi = Math.max(o.floor, hi);
    }
    const t1 = n ? hs[n - 1].t : 0, t0 = t1 - SIM.histLen * SIM.histDt;
    const X = (t) => ml + (t - t0) / (t1 - t0 || 1) * (W - ml - mr), Y = (v) => mt + (hi - v) / (hi - lo || 1) * (H - mt - mb);
    g.font = "10px system-ui, sans-serif"; g.lineWidth = 1;
    const step = niceStep((hi - lo) / 4);
    g.fillStyle = muted; g.textAlign = "right"; g.textBaseline = "middle";
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) { g.strokeStyle = Math.abs(v) < 1e-9 ? axis : grid; g.beginPath(); g.moveTo(ml, Y(v) + 0.5); g.lineTo(W - mr, Y(v) + 0.5); g.stroke(); g.fillText(f0(v), ml - 4, Y(v)); }
    g.textAlign = "center"; g.textBaseline = "top";
    for (let t = Math.ceil(t0 / 5) * 5; t <= t1; t += 5) g.fillText(t.toFixed(0) + " s", X(t), H - mb + 4);
    if (o.ref !== undefined && o.ref <= hi) { g.strokeStyle = muted; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(ml, Y(o.ref)); g.lineTo(W - mr, Y(o.ref)); g.stroke(); g.setLineDash([]); }
    g.lineWidth = 2; g.lineJoin = "round";
    for (const s of series) {
      g.strokeStyle = s.c; g.beginPath();
      hs.forEach((h, i) => { const x = X(h.t), y = Y(s.f(h)); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.stroke();
    }
    cv._map = { X, t0, t1, ml, mr, W, series, unit: o.unit };
    if (ui.tip && ui.tip.cv === cv) drawCross(cv, ui.tip.x);
  }
  function niceStep(r) { const p = Math.pow(10, Math.floor(Math.log10(Math.max(1e-9, r)))), m = r / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
  function drawCross(cv, x) {
    const mp = cv._map; if (!mp || !sim.hist.length) return;
    const g = cv.getContext("2d"), H = +cv.getAttribute("height");
    g.strokeStyle = css("--text-2", "#555"); g.lineWidth = 1; g.beginPath(); g.moveTo(x + 0.5, 6); g.lineTo(x + 0.5, H - 18); g.stroke();
  }
  function hover(cv) {
    const tip = document.createElement("div"); tip.className = "rb-tip"; tip.hidden = true; document.body.appendChild(tip);
    cv.addEventListener("mousemove", (e) => {
      const mp = cv._map; if (!mp || !sim.hist.length) return;
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left;
      const t = mp.t0 + (x - mp.ml) / (mp.W - mp.ml - mp.mr) * (mp.t1 - mp.t0);
      let best = null; for (const h of sim.hist) if (!best || Math.abs(h.t - t) < Math.abs(best.t - t)) best = h;
      if (!best) return;
      ui.tip = { cv, x: mp.X(best.t) };
      tip.innerHTML = `<b>t = ${best.t.toFixed(2)} s</b><br>` + mp.series.map((s) => `<span class="rb-sw" style="background:${s.c}"></span>${s.n}: ${f1(s.f(best))} ${mp.unit}`).join("<br>");
      tip.hidden = false; tip.style.left = Math.min(window.innerWidth - 200, e.clientX + 14) + "px"; tip.style.top = e.clientY + 14 + "px";
    });
    cv.addEventListener("mouseleave", () => { tip.hidden = true; ui.tip = null; });
  }
  ["rbChA", "rbChV", "rbChT"].forEach((id) => hover($(id)));
  function updCharts() {
    const c = COLS();
    $("rbLegend").innerHTML = c.map((col, i) => `<span><i class="rb-sw" style="background:${col}"></i>J${i + 1}</span>`).join("");
    chart($("rbChA"), c.map((col, i) => ({ n: "J" + (i + 1), c: col, f: (h) => h.q[i] })), { unit: "°" });
    chart($("rbChV"), c.map((col, i) => ({ n: "J" + (i + 1), c: col, f: (h) => h.pct[i] })), { min: 0, max: 100, unit: "%" });
    chart($("rbChT"), [{ n: "TCP", c: css("--series", "#2a78d6"), f: (h) => h.v }], { min: 0, unit: "mm/s", ref: SIM.t1Max, floor: 300 });
  }

  /* ------------------------------------------------------------------ 3D (lazy) */
  async function init3d() {
    if (view3dState !== "none") return;
    view3dState = "loading";
    const el = $("rb3d"), m3 = $("rb3dMsg");
    try {
      const m = await import("./robot3d.js");
      view = m.createRobot3D(el, getState, {});
      view3dState = "ok"; if (m3) m3.remove();
      if (view.onPick) view.onPick((k) => selPart(k, true));
      if (sim.S.sel) view.select(sim.S.sel);
    } catch (e) {
      console.warn("robot3d.js not available: " + e.message);
      view3dState = "fail";
      if (m3) m3.textContent = "The 3D view could not start (" + e.message + "). Everything else on this page works without it.";
    }
  }

  /* ------------------------------------------------------------------ main loop */
  let last = performance.now();
  function frame(ts) {
    const dtR = Math.min(0.1, Math.max(0, (ts - last) / 1000)); last = ts;
    let dt = dtR * sim.speed;
    while (dt > 1e-6) { const h = Math.min(0.02, dt); sim.step(h); dt -= h; }
    const vis = pane.classList.contains("active");
    if (vis && ts - ui.lastUi > 100) { ui.lastUi = ts; updLive(); updEnv(); }
    if (vis && ts - ui.lastSlow > 200) { ui.lastSlow = ts; updCharts(); }
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------ fast self test (&rbtest) */
  function selfTest() {
    const out = [];
    for (const r of ROBOTS) {
      const s = createSim(r.id); s.mode = "AUTO"; s.runProg(false);
      let t = 0, al = "";
      s.onAlarm = (m) => (al = m);
      while (t < 400 && s.cycles.length < 3 && !al) { s.step(0.02); t += 0.02; }
      const c = s.cycles.map((x) => x.total.toFixed(2)).join(" / ");
      const last = s.cycles[s.cycles.length - 1];
      out.push(`RBTEST ${r.id}: cycles ${c} s · ${last ? last.pph.toFixed(1) + " parts/h · robot " + last.robot.toFixed(2) + " s · dbl " + last.dblCycle.toFixed(2) + " s" : ""} · parts done ${s.stats.done} · alarm: ${al || "none"}`);
      // T1 check: hold-to-run, TCP limited to 250 mm/s
      const s2 = createSim(r.id); s2.mode = "T1"; s2.enable = true; s2.runProg(false); let vmax = 0, al2 = ""; s2.onAlarm = (m) => (al2 = m);
      for (let k = 0; k < 2500 && !al2; k++) { s2.step(0.02); const h = s2.hist[s2.hist.length - 1]; if (h) vmax = Math.max(vmax, h.v); }
      out.push(`RBTEST ${r.id} T1: max TCP speed ${vmax.toFixed(0)} mm/s · line ${s2.run.pc + 1} · alarm: ${al2 || "none"}`);
    }
    { // jog + teach checks (irb2600)
      const s = createSim("irb2600"); s.mode = "T1"; s.enable = true;
      const p0 = fk(s.S.rb, s.S.q, s.S.tool).p.slice();
      for (let i = 0; i < 100; i++) s.jogStep("L", 0, 1, 1, "base");
      const p1 = fk(s.S.rb, s.S.q, s.S.tool).p;
      out.push(`RBTEST jog BASE +X 100 × 1 mm: dX=${(p1[0] - p0[0]).toFixed(2)} dY=${(p1[1] - p0[1]).toFixed(2)} dZ=${(p1[2] - p0[2]).toFixed(2)}`);
      const st0 = fk(s.S.rb, s.S.q, s.S.tool);
      for (let i = 0; i < 50; i++) s.jogStep("L", 2, 1, 1, "tool");
      const st1 = fk(s.S.rb, s.S.q, s.S.tool), d = [0, 1, 2].map((k) => st1.p[k] - st0.p[k]);
      out.push(`RBTEST jog TOOL +Z 50 mm: moved ${Math.hypot(...d).toFixed(2)} mm along tool Z (dot = ${(d[0] * st0.R[2] + d[1] * st0.R[5] + d[2] * st0.R[8]).toFixed(2)})`);
      let n = 0, al = ""; s.onAlarm = (m) => (al = m);
      while (!al && n++ < 5000) s.jogStep("L", 0, 1, 5, "base");
      out.push(`RBTEST jog to the reach limit: stopped after ${n} × 5 mm · alarm: ${al}`);
      s.resetAlarm(); s.setRobot("irb2600"); s.selPt = "pInfPick";
      s.jogStep("J", 0, 1, 10); s.touchUp("pInfPick");
      const r = s.pointQ(s.pt("pInfPick")); out.push(`RBTEST touch up pInfPick after J1 +10°: ik back J1 = ${r.ok ? r.q[0].toFixed(2) : r.err}`);
      const s3 = createSim("irb2600"); s3.mode = "AUTO"; let al3 = ""; s3.onAlarm = (m) => (al3 = m);
      s3.pt("pMachLoad").p = [2400, 0, 1050]; s3.run.pc = 4; s3.runProg(false);
      for (let i = 0; i < 500 && !al3; i++) s3.step(0.02);
      out.push(`RBTEST unreachable point pMachLoad: alarm: ${al3 || "NONE (wrong)"}`);
    }
    { // worked example numbers for the guide (irb2600)
      const s = createSim("irb2600"), rb = s.S.rb, q = [30, 20, -10, 0, 60, 0];
      const a = fk(rb, q, { x: 0, y: 0, z: 0 }), b = fk(rb, q, s.S.tool);
      out.push(`RBDOC fk q=${q} flange p=${a.p.map((v) => v.toFixed(1))} abc=${a.abc.map((v) => v.toFixed(1))} wc=${a.wc.map((v) => v.toFixed(1))} · tcp(tool 180) p=${b.p.map((v) => v.toFixed(1))}`);
      const r = ik(rb, a.p, a.R, { x: 0, y: 0, z: 0 }, [0, 0, 0, 0, 30, 0]);
      out.push(`RBDOC ik back q=${r.q.map((v) => v.toFixed(2))} cfg=${JSON.stringify(r.cfg)} · all solutions: ${r.all.map((x) => "[" + x.q.map((v) => v.toFixed(0)).join(",") + (x.okLim ? "" : " LIMIT") + (x.front ? " F" : " B") + (x.up ? "U" : "D") + (x.flip ? "f" : "") + "]").join(" ")}`);
      const h = s.pointQ(s.pt("pMachApp"), s.S.C.home), pl = planPTP(rb, s.S.C.home, h.q, 1, 1);
      out.push(`RBDOC PTP home->pMachApp q1=${h.q.map((v) => v.toFixed(1))} T=${pl.T.toFixed(3)} lead=J${pl.lead + 1} tacc=${rb.tacc}`);
      const ll = planLIN(rb, h.q, s.pt("pMachLoad").p, rotFromABC(...s.pt("pMachLoad").abc), s.S.tool, 500, 1);
      out.push(`RBDOC LIN pMachApp->pMachLoad L=${ll.L.toFixed(1)} T=${ll.T.toFixed(3)} by=${ll.limitedBy} sing=${ll.sing}`);
      const C = s.S.C; out.push(`RBDOC cell k=${C.k} part=${JSON.stringify(C.part)} tool=${C.toolLen} grip=${C.gripMass} fixture=${C.machine.fixture} load=${C.machine.load} pick=${C.infeed.pick} place=${C.outfeed.place}`);
      const lq = s.pointQ(s.pt("pMachLoad")); out.push(`RBDOC payloadTorque at pMachLoad q=${lq.q.map((v) => v.toFixed(1))} ${JSON.stringify(payloadTorque(rb, lq.q, C.part.mass + C.gripMass, s.S.tool))}`);
      for (const r2 of ROBOTS) { const c2 = createSim(r2.id).S.C; out.push(`RBDOC ${r2.id} part ${c2.part.mass} kg grip ${c2.gripMass} kg pedestal ${c2.pedestal} tool ${c2.toolLen}`); }
    }
    out.forEach((l) => console.log(l));
    $("rbDebug").textContent = out.join("\n") + "\n" + $("rbDebug").textContent;
  }

  /* ------------------------------------------------------------------ start */
  buildStatic(); buildParts(); buildJog(); setMode("T1"); segs("data-rbspeed", 1);
  if (Q.has("rbspeed")) { const v = +Q.get("rbspeed"); if ([1, 2, 5].includes(v)) { sim.speed = v; segs("data-rbspeed", v); } }
  if (Q.has("rbrun")) { setMode("AUTO"); sim.runProg(false); }
  if (Q.has("rbff")) { const n = Math.min(3600, +Q.get("rbff") || 60) / 0.02; for (let i = 0; i < n; i++) sim.step(0.02); }  // fast-forward (test screenshots)
  if (Q.has("rbtest")) setTimeout(selfTest, 50);
  const prev = window.onTabShown;
  window.onTabShown = (name) => { if (prev) prev(name); if (name === "robot") { init3d(); if (view) try { view.resize(); } catch (e) { /* ignore */ } updCharts(); } };
  if (pane.classList.contains("active") || location.hash === "#robot") setTimeout(init3d, 0);
  requestAnimationFrame(frame);
}
