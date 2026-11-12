/* ROBOT tab – "Mathematics + dynamics, live" card. Reads the running simulation (window.rbSim from robot.js)
 * and shows, for the current motion: joint speed + acceleration, joint torques split in gravity / balancer /
 * inertia + Coriolis, motor torque + speed via the gear ratio, peak + RMS (motor sizing), Jacobian + singularity,
 * and a static force calculator  τ = Jᵀ·F.  Guide: docs/22_robot_math_dynamics.md.
 * Link masses are ESTIMATES (catalogue gives only the total mass) – examples, check with the supplier's sizing tool.
 */
import { fk } from "./robotkin.js";
import { invDyn, massModel, motorSide, drive, jacobian, det, staticTorque, singularity, MASS_SHARE } from "./robotdyn.js";

const $ = (id) => document.getElementById(id);
const D2R = Math.PI / 180;
const f0 = (v) => (Math.abs(v) < 0.5 ? "0" : Math.round(v).toString());
const f1 = (v) => (Math.abs(v) < 0.05 ? "0.0" : v.toFixed(1));
const f2 = (v) => (Math.abs(v) < 0.005 ? "0.00" : v.toFixed(2));

function start() {
  const host = $("rbItem1"), sim = window.rbSim;
  if (!host || !sim || !$("rbParts")) return false;
  const card = document.createElement("div");
  card.className = "card"; card.id = "rbDyn";
  card.innerHTML = `
    <div class="card-head"><h2>Mathematics + dynamics – live</h2>
      <span class="sub">τ = M(q)·q̈ + C(q,q̇)·q̇ + g(q) · Newton–Euler · link masses are ESTIMATES · guide 22</span></div>
    <p class="muted rbd-note">Run the program or jog the robot. For every joint: speed q̇ and acceleration q̈ (from the motion), the torque the joint needs
      = <b>gravity</b> (holds the arm) + <b>inertia + Coriolis</b> (accelerates it) − <b>balancer</b> (spring helps J2). Through the gear (ratio n, efficiency η)
      this becomes the <b>motor torque</b> τ<sub>m</sub> = τ / (n·η) and motor speed n<sub>m</sub> = q̇·n / 6 (rpm, q̇ in °/s).</p>
    <div class="table-wrap"><table class="rb-tbl rbd-tbl" id="rbdTbl"></table></div>
    <div class="rb-grid2 rbd-grid">
      <div>
        <h3>Joint torque over time (N·m, net = gravity + inertia − balancer)</h3>
        <div class="rbd-legend" id="rbdLeg"></div>
        <canvas id="rbdCv" height="200" class="rbd-cv" aria-label="joint torque chart"></canvas>
        <p class="muted rbd-small">Peaks = acceleration phases (inertia). Flat parts = constant speed or stop (gravity only). Last 25 s of simulated time.</p>
      </div>
      <div>
        <h3>Jacobian + singularity</h3>
        <div id="rbdJac"></div>
        <h3>Static force at the TCP → joint torques (τ = Jᵀ·F)</h3>
        <div class="rbd-force">
          <label>F <input id="rbdF" type="number" value="100" step="10"> N</label>
          <label>direction <select id="rbdDir"><option value="-z">base −Z (down, e.g. press / weight)</option><option value="x">base +X</option><option value="y">base +Y</option><option value="tz">along tool Z (push with the tool)</option></select></label>
        </div>
        <div id="rbdStat"></div>
      </div>
    </div>
    <details class="rbd-det"><summary>Estimated mass model of this robot (used for the dynamics)</summary><div id="rbdMass"></div></details>`;
  const partsCard = $("rbParts").closest(".card");
  partsCard.parentNode.insertBefore(card, partsCard);

  const COL = () => [1, 2, 3, 4, 5, 6].map((i) => getComputedStyle(document.documentElement).getPropertyValue("--rb-c" + i).trim() || "#2a78d6");
  const cache = new Map();     // t -> {net, qd, qdd}
  let rbId = "", lastT = -1;

  function loadOf(S) {
    const C = S.C, held = S.parts.some((p) => p.held);
    const mg = C.gripMass, mp = held ? C.part.mass : 0, L = C.toolLen / 1000;
    const m = mg + mp, z = m > 0 ? (mg * 0.5 * L + mp * (L + C.part.h / 2000)) / m : 0;
    return { m, z, held };
  }
  // speed + acceleration from the 50 ms history (central differences)
  function derivs(H, i) {
    const a = H[Math.max(0, i - 1)], b = H[i], c = H[Math.min(H.length - 1, i + 1)];
    const dt1 = b.t - a.t || 0.05, dt2 = c.t - b.t || 0.05;
    const qd = b.q.map((v, j) => (c.q[j] - a.q[j]) / (dt1 + dt2));
    const qdd = b.q.map((v, j) => 2 * ((c.q[j] - v) / dt2 - (v - a.q[j]) / dt1) / (dt1 + dt2));
    return { qd, qdd };
  }

  function buildMass(S) {
    const rb = S.rb, L = loadOf(S), body = massModel(rb, L), Dv = drive(rb);
    $("rbdMass").innerHTML = `<p class="muted rbd-small">Catalogue mass ${rb.mass} kg split by estimate: base ${MASS_SHARE.base * 100} % (does not move), column ${MASS_SHARE.column * 100} %,
      lower arm ${MASS_SHARE.larm * 100} %, upper arm + J4–J6 motors ${MASS_SHARE.uarm * 100} %, forearm ${MASS_SHARE.farm * 100} %, wrist ${MASS_SHARE.wrist * 100} %.
      Centre of mass c in the link frame (m), inertia about the centre of mass (kg·m², link frame axes). Gear ratio from "motor ≈ ${Dv.nMot} rpm at the catalogue axis speed":
      n = ${Dv.nMot}·6 / v<sub>axis</sub>, efficiency η = ${Dv.eta}. All ESTIMATES.</p>
      <table class="rb-tbl"><tr><th>Body</th><th class="num">m kg</th><th class="num">c<sub>x</sub></th><th class="num">c<sub>y</sub></th><th class="num">c<sub>z</sub></th><th class="num">I<sub>xx</sub></th><th class="num">I<sub>yy</sub></th><th class="num">I<sub>zz</sub></th></tr>
      ${body.map((b) => `<tr><td>${b.n}</td><td class="num">${f1(b.m)}</td>${b.c.map((v) => `<td class="num">${v.toFixed(3)}</td>`).join("")}${b.Id.map((v) => `<td class="num">${f2(v)}</td>`).join("")}</tr>`).join("")}
      <tr><td>gear ratio n (J1…J6)</td><td colspan="7">${Dv.ratio.map((n, i) => `J${i + 1} 1:${n}`).join(" · ")}</td></tr></table>`;
  }

  function update() {
    const S = sim.S, H = sim.hist;
    if (!S) return;
    if (S.rb.id !== rbId) { rbId = S.rb.id; cache.clear(); buildMass(S); }
    const L = loadOf(S);
    // torques for every new history sample (needs the next sample for the central difference)
    for (let i = 0; i < H.length - 1; i++) {
      const t = H[i].t;
      if (cache.has(t)) continue;
      const { qd, qdd } = derivs(H, i);
      const r = invDyn(S.rb, H[i].q, qd, qdd, L);
      cache.set(t, { t, q: H[i].q, qd, qdd, r });
    }
    const t0 = H.length ? H[0].t : 0;
    for (const k of cache.keys()) if (k < t0) cache.delete(k);
    const rows = [...cache.values()].sort((a, b) => a.t - b.t);
    // current values: last computed sample, or the static pose
    let cur = rows[rows.length - 1];
    if (!cur || !S.live.moving && !sim.motion && !sim.jog) {
      const z = [0, 0, 0, 0, 0, 0];
      cur = { q: S.q, qd: z, qdd: z, r: invDyn(S.rb, S.q, z, z, L) };
    }
    const ms = motorSide(S.rb, cur.r.net, cur.qd);
    const pk = [0, 0, 0, 0, 0, 0], rms = [0, 0, 0, 0, 0, 0];
    rows.forEach((x) => x.r.net.forEach((v, i) => { pk[i] = Math.max(pk[i], Math.abs(v)); rms[i] += v * v; }));
    if (rows.length) rms.forEach((v, i) => { rms[i] = Math.sqrt(v / rows.length); });
    const Dv = drive(S.rb);
    $("rbdTbl").innerHTML = `<tr><th>Joint</th><th class="num">q °</th><th class="num">q̇ °/s</th><th class="num">q̈ °/s²</th><th class="num">gravity N·m</th>
      <th class="num">inertia + Coriolis</th><th class="num">balancer</th><th class="num">net τ N·m</th><th class="num">gear n</th><th class="num">motor τ<sub>m</sub> N·m</th>
      <th class="num">motor rpm</th><th class="num">power W</th><th class="num">peak |τ| 25 s</th><th class="num">RMS τ 25 s</th></tr>` +
      cur.r.net.map((v, i) => `<tr><td>J${i + 1}</td><td class="num">${f1(cur.q[i])}</td><td class="num">${f0(cur.qd[i])}</td><td class="num">${f0(cur.qdd[i])}</td>
        <td class="num">${f0(cur.r.grav[i])}</td><td class="num">${f0(cur.r.dyn[i])}</td><td class="num">${i === 1 && S.rb.balancer ? f0(cur.r.bal[i]) : "–"}</td>
        <td class="num"><b>${f0(v)}</b></td><td class="num">1:${Dv.ratio[i]}</td><td class="num">${f2(ms[i].tm)}</td><td class="num">${f0(ms[i].rpm)}</td><td class="num">${f0(ms[i].P)}</td>
        <td class="num">${f0(pk[i])}</td><td class="num">${f0(rms[i])}</td></tr>`).join("") +
      `<tr class="rbd-sum"><td colspan="14">Load on the flange: gripper ${S.C.gripMass} kg${L.held ? " + part " + S.C.part.mass + " kg" : " (no part)"} → ${f1(L.m)} kg, centre of mass ${Math.round(L.z * 1000)} mm from the flange.
        Motor sizing rule: RMS torque ≤ motor rated torque, peak ≤ motor max torque (both on the motor side: ÷ n·η). Example values.</td></tr>`;
    // chart
    drawChart(rows);
    // Jacobian
    const J = jacobian(S.rb, S.q, S.tool), dJ = det(J), sg = singularity(S.rb, S.q);
    const vJ = [0, 1, 2].map((r) => J[r].reduce((s, x, i) => s + x * cur.qd[i] * D2R, 0) * 1000);
    const st = (ok, warn) => (ok ? `<span class="rbd-ok">✓ ok</span>` : warn ? `<span class="rbd-warn">⚠ near</span>` : `<span class="rbd-bad">✕ singular</span>`);
    const shM = sg.shoulder, elA = Math.abs(sg.elbow), wrA = Math.abs(sg.wrist);
    $("rbdJac").innerHTML = `<table class="rb-tbl"><tr><th>Item</th><th class="num">Value</th><th>Meaning</th></tr>
      <tr><td>TCP speed v = J·q̇</td><td class="num">${f0(Math.hypot(...vJ))} mm/s</td><td>(${vJ.map(f0).join(", ")}) – the same speed the motion card shows</td></tr>
      <tr><td>det J</td><td class="num">${dJ.toExponential(2)}</td><td>0 = singular: the 6 joints can no longer move the TCP in all 6 directions</td></tr>
      <tr><td>Wrist: |sin q5|</td><td class="num">${f2(wrA)}</td><td>${st(wrA > 0.17, wrA > 0.035)} q5 ≈ 0 → J4 and J6 on one line (most common singularity)</td></tr>
      <tr><td>Elbow: |cos(q3 − β)|</td><td class="num">${f2(elA)}</td><td>${st(elA > 0.17, elA > 0.035)} 0 → arm fully stretched (edge of reach)</td></tr>
      <tr><td>Shoulder: wrist centre to J1 axis</td><td class="num">${f0(shM)} mm</td><td>${st(shM > 150, shM > 40)} 0 → wrist centre on the J1 axis</td></tr></table>`;
    // static force
    const F = +$("rbdF").value || 0, dir = $("rbdDir").value, R = fk(S.rb, S.q, S.tool).R;
    const u = dir === "-z" ? [0, 0, -1] : dir === "x" ? [1, 0, 0] : dir === "y" ? [0, 1, 0] : [R[2], R[5], R[8]];
    const ts = staticTorque(J, u.map((v) => v * F));
    $("rbdStat").innerHTML = `<table class="rb-tbl"><tr>${ts.map((v, i) => `<th class="num">J${i + 1}</th>`).join("")}</tr><tr>${ts.map((v) => `<td class="num">${f1(v)}</td>`).join("")}</tr></table>
      <p class="muted rbd-small">N·m that the joints must give to hold ${F} N at the TCP (no gravity, no motion). Big value on a joint = that joint has a long lever to the TCP.</p>`;
  }

  function drawChart(rows) {
    const cv = $("rbdCv"), dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 400, Hh = 200;
    cv.width = W * dpr; cv.height = Hh * dpr;
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Hh);
    const cs = getComputedStyle(document.documentElement), ink = cs.getPropertyValue("--text-2").trim() || "#666", grid = cs.getPropertyValue("--grid").trim() || "#ddd";
    const cols = COL(), show = [0, 1, 2, 4];
    $("rbdLeg").innerHTML = show.map((i) => `<span><i style="background:${cols[i]}"></i>J${i + 1}</span>`).join("");
    if (rows.length < 2) { g.fillStyle = ink; g.font = "12px sans-serif"; g.fillText("no motion yet – run the program or jog", 50, Hh / 2); return; }
    let m = 10; rows.forEach((x) => show.forEach((i) => { m = Math.max(m, Math.abs(x.r.net[i])); }));
    const step = Math.pow(10, Math.floor(Math.log10(m))), top = Math.ceil(m / step) * step;
    const x0 = 46, x1 = W - 8, y0 = 8, y1 = Hh - 20, t0 = rows[0].t, t1 = Math.max(t0 + 1, rows[rows.length - 1].t);
    const X = (t) => x0 + (t - t0) / (t1 - t0) * (x1 - x0), Y = (v) => y0 + (top - v) / (2 * top) * (y1 - y0);
    g.font = "11px sans-serif"; g.fillStyle = ink; g.strokeStyle = grid; g.lineWidth = 1;
    [-top, -top / 2, 0, top / 2, top].forEach((v) => { g.beginPath(); g.moveTo(x0, Y(v)); g.lineTo(x1, Y(v)); g.stroke(); g.fillText(String(Math.round(v)), 4, Y(v) + 4); });
    g.fillText(Math.round(t0) + " s", x0, Hh - 5); g.fillText(Math.round(t1) + " s", x1 - 30, Hh - 5);
    g.lineWidth = 2;
    show.forEach((i) => { g.strokeStyle = cols[i]; g.beginPath(); rows.forEach((x, k) => { const px = X(x.t), py = Y(x.r.net[i]); if (k) g.lineTo(px, py); else g.moveTo(px, py); }); g.stroke(); });
  }

  let timer = null;
  const pane = $("tab-robot");
  timer = setInterval(() => { if (pane.classList.contains("active") && card.offsetParent) { try { update(); } catch (e) { console.error(e); } } }, 250);
  $("rbdF").addEventListener("input", update); $("rbdDir").addEventListener("change", update);
  update();
  return true;
}

// robot.js builds the tab content when the module runs; wait until it is there.
let tries = 0;
(function wait() { if (start()) return; if (++tries < 200) setTimeout(wait, 100); })();
