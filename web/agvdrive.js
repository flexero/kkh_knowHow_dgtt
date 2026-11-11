/* AGV build tab - item 2: control of the AGV servo motors (the two drive motors of item 1).
   Layers: navigation PC (v, ω) -> kinematics -> CANopen CiA 402 (SYNC + PDOs) -> servo drive (position / speed / current loop)
   -> BLDC motor + encoder + brake.  Power electronics (battery, fuse, precharge, contactor, DC bus, brake chopper), STO wiring,
   a tunable control simulator, the CiA 402 state machine, example code (Python, Structured Text, C), parameter list, checks, guide.
   Motor, gear ratio, wheel, mass come from item 1 (window.AGV).  Example values only.  Offline, no libraries. */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f = (v, d = 1) => (Number.isFinite(v) ? (Math.round(v * 10 ** d) / 10 ** d).toLocaleString("en-US", { maximumFractionDigits: d }) : "–");
const hex = (v, n = 4) => "0x" + (v >>> 0).toString(16).toUpperCase().padStart(n, "0");
const G = 9.81;
const JM = { 100: 0.065e-4, 200: 0.2e-4, 400: 0.36e-4, 750: 1.15e-4, 1000: 1.65e-4 };   // rotor + brake, kg·m² (typical 48 V servo)
const FUSES = [20, 25, 32, 40, 50, 63, 80, 100, 125, 160];
const CABLE = [[1.5, 15], [2.5, 22], [4, 30], [6, 40], [10, 57], [16, 76], [25, 101], [35, 125]];   // mm², A (short run, 90 °C insulation)
const RBR = [3.3, 4.7, 6.8, 10, 15, 22, 33];

const GROUPS = [
  ["Encoder + control loops", [
    ["cpr", "Encoder counts per motor turn", "counts", 131072, "17-bit absolute; incremental 2500 ppr = 10000"],
    ["fbw", "Speed loop bandwidth", "Hz", 15, "AGV (high inertia ratio): 10–20 Hz"],
    ["kvf", "Position loop: Kv = 2π·f_speed / factor", "", 5, "4–8"],
    ["fci", "Current loop bandwidth (in the drive)", "Hz", 1000, ""],
    ["tcy", "Command cycle PC → drives (SYNC)", "ms", 10, ""]]],
  ["CAN bus", [
    ["br", "CAN bit rate", "kbit/s", 500, "≤ 40 m bus length"]]],
  ["Power electronics", [
    ["Cdc", "DC bus capacitance per drive", "µF", 1000, "drive data sheet"],
    ["Rpre", "Precharge resistor", "Ω", 47, ""],
    ["Ichg", "BMS max. charge current (regeneration)", "A", 30, "battery data sheet"],
    ["Uch", "Brake chopper switch-on voltage", "V", 56, "LiFePO4 16 s: max 58.4 V"],
    ["Lc", "Cable length battery → drives (one way)", "m", 1.5, ""]]],
];
const DEF = {}; GROUPS.forEach(([, fs]) => fs.forEach(([k, , , d]) => { DEF[k] = d; }));

/* ------------------------------------------------------------------ calculation */
function calc(A, P) {
  const M = A.M, R = A.R, D = {};
  D.r = M.Dw / 2000; D.i = R.i; D.mot = R.mot; D.Pw = R.mot[0]; D.Tr = R.mot[1]; D.Tp = R.mot[2];
  D.Ir = D.Pw / (M.Ub * 0.8); D.Ip = D.Ir * D.Tp / D.Tr; D.Kt = D.Tr / D.Ir;
  D.Jm = (JM[D.Pw] || 0.2e-4) + 0.05e-4;                                  // motor + gearbox
  D.mw = R.mt / 2; D.Jl = D.mw * D.r ** 2 / D.i ** 2; D.Jt = D.Jm + D.Jl; D.ratio = D.Jl / D.Jm;
  D.vtop = Math.min(M.vmax, R.vreal);                                    // top speed the gear allows at 3000 rpm
  D.nmax = D.vtop / (Math.PI * M.Dw / 1000) * 60 * D.i;
  D.rpmPerMs = 60 * D.i / (Math.PI * M.Dw / 1000);                       // motor rpm per (m/s) at the wheel
  D.res = Math.PI * M.Dw / (P.cpr * D.i);                                 // mm per encoder count at the wheel
  D.wbw = 2 * Math.PI * P.fbw; D.Kp = D.Jt * D.wbw; D.Ki = D.Kp * D.wbw / 4; D.Kv = D.wbw / P.kvf;
  D.efNoFF = D.vtop * 1000 / D.Kv;                                       // following error without feed-forward, mm
  D.Tfric = (R.Froll + R.Fsl) / 2 * D.r / D.i / 0.9;
  D.accRpm = M.acc * D.rpmPerMs; D.qsRpm = M.dec * D.rpmPerMs;
  // regeneration + brake chopper
  D.Preg = R.mt * M.dec * M.vmax * 0.8; D.Ireg = D.Preg / M.Ub; D.Ereg = 0.5 * R.mt * M.vmax ** 2 * 0.8;
  D.RbrMax = P.Uch ** 2 / D.Preg; D.Rbr = [...RBR].reverse().find((x) => x <= D.RbrMax) || RBR[0];
  // DC bus + precharge
  D.C = 3 * P.Cdc * 1e-6; D.tau = P.Rpre * D.C; D.tpre = 5 * D.tau; D.Epre = 0.5 * D.C * M.Ub ** 2; D.Ipre = M.Ub / P.Rpre;
  // currents, fuse, cable
  D.Ilift = R.lmot[0] / (M.Ub * 0.8);
  D.Icont = 2 * D.Ir + D.Ilift * 0.3 + M.Pel / M.Ub;
  D.Ipk = 2 * D.Ip + M.Pel / M.Ub;
  D.fuse = FUSES.find((x) => x >= D.Icont * 1.25) || FUSES[FUSES.length - 1];
  D.cable = CABLE.find((c) => c[1] >= D.fuse) || CABLE[CABLE.length - 1];
  D.dU = 2 * P.Lc * D.Ipk * 0.0175 / D.cable[0];
  D.drive = [[10, 30], [20, 60], [30, 90], [45, 135]].find((d) => d[0] >= D.Ir * 1.1 && d[1] >= D.Ip) || [45, 135];
  // CAN
  D.frames = 1 + 2 * 3 + 2 + 5 * P.tcy / 100;                            // SYNC + 2 drives × (RPDO, TPDO1, TPDO2) + lift (2) + heartbeats/BMS
  D.load = D.frames * 130 / (P.tcy / 1000 * P.br * 1000);
  return D;
}

/* ------------------------------------------------------------------ control simulation (one drive wheel, motor side) */
function simulate(A, D, P, opt) {
  const M = A.M, vmax = D.vtop, acc = M.acc, t1 = vmax / acc, tc = 1.2, Tend = 2 * t1 + tc + 0.8;
  const dt = 0.25e-3, N = Math.round(Tend / dt), q = 2 * Math.PI / P.cpr, ai = 1 - Math.exp(-dt * 2 * Math.PI * P.fci);
  const prof = (t) => (t < t1 ? acc * t : t < t1 + tc ? vmax : t < 2 * t1 + tc ? vmax - acc * (t - t1 - tc) : 0);
  const accAt = (t) => (t < t1 ? acc : t < t1 + tc ? 0 : t < 2 * t1 + tc ? -acc : 0);
  const td = t1 + 0.4, Td = A.R.mt * G * 0.04 / 2 * D.r / D.i;           // disturbance: floor step, 4 % of the weight for 0.15 s
  let th = 0, w = 0, Ta = 0, integ = 0, thRef = 0, wf = 0, thPrev = 0;
  const out = { t: [], vr: [], va: [], e: [], I: [] };
  let eMax = 0, Imax = 0, I2 = 0;
  for (let k = 0; k < N; k++) {
    const t = k * dt, v = prof(t), wRef = v / D.r * D.i, aRef = accAt(t) / D.r * D.i;
    thRef += wRef * dt;
    const thM = opt.quant ? Math.round(th / q) * q : th;
    const wRaw = (thM - thPrev) / dt; thPrev = thM; wf += (wRaw - wf) * 0.4;
    const wCmd = (opt.ff ? wRef : 0) + D.Kv * (thRef - thM);
    const e = wCmd - wf;
    let Tc = D.Kp * e + D.Ki * integ + (opt.ff ? D.Jt * aRef : 0);
    if (Tc > D.Tp) Tc = D.Tp; else if (Tc < -D.Tp) Tc = -D.Tp; else integ += e * dt;
    Ta += (Tc - Ta) * ai;
    const Tl = D.Tfric * Math.tanh(w * 20) + (opt.dist && t > td && t < td + 0.15 ? Td : 0);
    w += (Ta - Tl) / D.Jt * dt; th += w * dt;
    const err = (thRef - th) / D.i * D.r * 1000, I = Ta / D.Kt;
    eMax = Math.max(eMax, Math.abs(err)); Imax = Math.max(Imax, Math.abs(I)); I2 += I * I * dt;
    if (k % 8 === 0) { out.t.push(t); out.vr.push(v); out.va.push(w * D.r / D.i); out.e.push(err); out.I.push(I); }
  }
  out.eMax = eMax; out.Imax = Imax; out.Irms = Math.sqrt(I2 / Tend); out.Tend = Tend; out.td = td;
  return out;
}

/* ------------------------------------------------------------------ drawings */
function simSVG(S, D) {
  const W = 760, L = 54, Rr = 14, ph = 112, gap = 26, top = 26, H = top + 3 * ph + 2 * gap + 26;
  const X = (t) => L + t / S.Tend * (W - L - Rr);
  const panel = (k, data, refs, unit, lim) => {
    const y0 = top + k * (ph + gap), all = data.flat().concat(lim ? [lim, -lim] : []);
    let mn = Math.min(...all), mx = Math.max(...all); if (mx - mn < 1e-9) { mx += 1; mn -= 1; } const pad = (mx - mn) * 0.1; mn -= pad; mx += pad;
    const Y = (v) => y0 + ph - (v - mn) / (mx - mn) * ph;
    let g = "";
    for (let j = 0; j <= 3; j++) { const v = mn + (mx - mn) * j / 3; g += `<line x1="${L}" y1="${Y(v)}" x2="${W - Rr}" y2="${Y(v)}" stroke="var(--grid)"/><text x="${L - 6}" y="${Y(v) + 4}" class="apc-t r">${f(v, Math.abs(mx - mn) < 5 ? 2 : 0)}</text>`; }
    if (lim) for (const s of [1, -1]) g += `<line x1="${L}" y1="${Y(s * lim)}" x2="${W - Rr}" y2="${Y(s * lim)}" stroke="var(--critical)" stroke-dasharray="5 4"/>`;
    data.forEach((arr, j) => { g += `<path d="${arr.map((v, i) => `${i ? "L" : "M"}${X(S.t[i]).toFixed(1)},${Y(v).toFixed(1)}`).join("")}" fill="none" stroke="${refs[j]}" stroke-width="${j === 0 && data.length > 1 ? 1.5 : 2}" ${j === 0 && data.length > 1 ? 'stroke-dasharray="5 4"' : ""}/>`; });
    g += `<text x="${L}" y="${y0 - 8}" class="apc-t" style="font-weight:600;fill:var(--text)">${unit}</text>`;
    return g;
  };
  let g = `<svg viewBox="0 0 ${W} ${H}" class="apc-svg" id="adSimSvg" aria-label="Control simulation: speed, following error, motor current">`;
  g += panel(0, [S.vr, S.va], ["var(--text-2)", "var(--accent)"], "Wheel speed (m/s) – dashed = command, line = actual");
  g += panel(1, [S.e], ["var(--accent)"], "Following error at the wheel (mm)");
  g += panel(2, [S.I], ["var(--accent)"], `Motor current (A) – red dashed = peak limit ±${f(D.Ip, 1)} A`, D.Ip);
  g += `<rect x="${X(S.td)}" y="${top}" width="${X(S.td + 0.15) - X(S.td)}" height="${3 * ph + 2 * gap}" fill="color-mix(in srgb, var(--warning) 18%, transparent)"/>`;
  for (let s = 0; s <= S.Tend; s += 1) g += `<text x="${X(s)}" y="${H - 8}" class="apc-t c">${s} s</text>`;
  g += `<line id="avSimX" x1="0" y1="${top}" x2="0" y2="${top + 3 * ph + 2 * gap}" stroke="var(--text)" stroke-width="1" visibility="hidden"/>`;
  g += `<rect id="adSimOv" x="${L}" y="${top}" width="${W - L - Rr}" height="${3 * ph + 2 * gap}" fill="transparent"/>`;
  return g + `</svg>`;
}
function layerSVG(A, D, P) {
  const W = 760, rows = [
    ["Fleet manager", "VDA 5050 order: drive to station OUT-1-T", "seconds", "var(--border)"],
    ["Navigation PC", "localisation + path following → v (m/s), ω (rad/s)", `every ${P.tcy} ms`, "var(--accent)"],
    ["Kinematics", "v, ω → left / right wheel speed → motor rpm", `every ${P.tcy} ms`, "var(--accent)"],
    ["CANopen CiA 402", `SYNC → RPDO target velocity, TPDO actual position / speed (${P.br} kbit/s)`, `every ${P.tcy} ms`, "#2a78d6"],
    ["Servo drive", "position loop → speed loop → current loop → PWM", "2 kHz · 4 kHz · 16 kHz", "var(--warning)"],
    ["Motor + gearbox + wheel", `BLDC ${D.Pw} W, encoder ${P.cpr} counts, brake, i = ${D.i}, Ø${A.M.Dw}`, "", "var(--text-2)"]];
  const rh = 44, H = rows.length * (rh + 14) + 6;
  let g = `<svg viewBox="0 0 ${W} ${H}" class="apc-svg" aria-label="Control layers from fleet manager to motor"><defs><marker id="avL" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,1 L10,5 L0,9 z" fill="var(--text-2)"/></marker></defs>`;
  rows.forEach(([a, b, c, col], i) => {
    const y = 4 + i * (rh + 14);
    g += `<rect x="40" y="${y}" width="560" height="${rh}" rx="7" fill="color-mix(in srgb, ${col} 10%, var(--surface))" stroke="${col}" stroke-width="1.4"/>`;
    g += `<text x="56" y="${y + 18}" class="apc-t" style="font-weight:600;fill:var(--text)">${esc(a)}</text><text x="56" y="${y + 34}" class="apc-t">${esc(b)}</text>`;
    g += `<text x="612" y="${y + 27}" class="apc-t">${esc(c)}</text>`;
    if (i < rows.length - 1) g += `<line x1="250" y1="${y + rh}" x2="250" y2="${y + rh + 12}" stroke="var(--text-2)" stroke-width="1.6" marker-end="url(#avL)"/>`;
  });
  const yb = 4 + 5 * (rh + 14) + rh / 2, yt = 4 + 1 * (rh + 14) + rh / 2;
  g += `<path d="M40,${yb} H18 V${yt} H38" fill="none" stroke="var(--good)" stroke-width="1.6" marker-end="url(#avL)"/><text x="14" y="${(yb + yt) / 2}" class="apc-t" transform="rotate(-90 14 ${(yb + yt) / 2})" style="text-anchor:middle;fill:var(--good-text)">encoder counts → odometry</text>`;
  return g + `</svg>`;
}
function wireSVG(A, D, P) {
  const W = 760, H = 505, M = A.M;
  const bx = (x, y, w, h, t, s, col = "var(--border)") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="var(--surface)" stroke="${col}" stroke-width="1.4"/><text x="${x + w / 2}" y="${y + (s ? h / 2 - 2 : h / 2 + 4)}" class="apc-t c" style="font-weight:600;fill:var(--text)">${t}</text>${s ? `<text x="${x + w / 2}" y="${y + h / 2 + 12}" class="apc-t c" style="font-size:10px">${s}</text>` : ""}`;
  const ln = (d, col, w = 2, dash = "") => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ""}/>`;
  const pw = "#d03b3b", lo = "#c98a0c", can = "#2a78d6", ph = "var(--text)";
  let g = `<svg viewBox="0 0 ${W} ${H}" class="apc-svg" aria-label="Power and signal wiring of the drives">`;
  g += bx(10, 20, 110, 56, `Battery ${M.Ub} V`, `LiFePO4 ${M.Ah} Ah + BMS`);
  g += bx(150, 30, 70, 36, `F1 ${D.fuse} A`, "main fuse");
  g += bx(245, 30, 70, 36, "Q1", "main switch");
  g += bx(340, 6, 110, 34, `R ${P.Rpre} Ω + K2`, "precharge");
  g += bx(340, 52, 110, 34, "K1", "main contactor");
  g += ln("M120,48 H150 M220,48 H245 M315,48 H330 V23 H340 M330,48 V69 H340 M450,23 H462 V69 M450,69 H480", pw, 2.5);
  // DC bus
  g += `<rect x="480" y="40" width="10" height="250" fill="${pw}" opacity=".85"/><text x="470" y="306" class="apc-t" style="fill:${pw}">DC bus +48 V / 0 V</text>`;
  g += `<rect x="470" y="40" width="6" height="250" fill="var(--text-2)" opacity=".6"/>`;
  g += bx(520, 30, 110, 44, "A1 servo drive", "left · node 1", "#2a78d6");
  g += bx(520, 100, 110, 44, "A2 servo drive", "right · node 2", "#2a78d6");
  g += bx(520, 170, 110, 44, "A3 lift drive", "node 3", "#2a78d6");
  g += bx(520, 240, 110, 44, "U1 DC/DC", "48 → 24 V", lo);
  g += bx(360, 120, 90, 50, "Brake chopper", `R ${D.Rbr} Ω`);
  for (const y of [52, 122, 192, 262]) g += ln(`M490,${y} H520`, pw, 2.5);
  g += ln("M480,145 H450", pw, 2);
  // motors
  g += bx(670, 26, 80, 52, "M1", `${D.Pw} W BLDC`); g += bx(670, 96, 80, 52, "M2", `${D.Pw} W BLDC`); g += bx(670, 166, 80, 52, "M3", "lift motor");
  for (const y of [42, 112, 182]) { g += ln(`M630,${y} H670`, ph, 2.2); g += ln(`M670,${y + 12} H630`, "#2fa84f", 1.4, "4 3"); g += ln(`M630,${y + 22} H670`, lo, 1.4); }
  g += `<text x="636" y="38" class="apc-t" style="font-size:9.5px">U V W + PE</text><text x="636" y="62" class="apc-t" style="font-size:9.5px;fill:#2fa84f">encoder</text><text x="636" y="74" class="apc-t" style="font-size:9.5px;fill:${lo}">brake 24 V</text>`;
  // 24 V
  g += ln("M575,284 V312 H120 V330", lo, 2);
  g += bx(20, 330, 150, 50, "Safety controller", "STO, E-stop, scanners", "var(--critical)");
  g += bx(200, 330, 150, 50, "Navigation PC", "CAN interface", "var(--accent)");
  g += ln("M275,312 V330", lo, 2); g += `<text x="300" y="306" class="apc-t" style="fill:${lo}">24 V (logic, brakes, sensors)</text>`;
  // STO
  g += ln("M170,345 H500 V64 H520 M500,134 H520 M500,204 H520", "var(--critical)", 1.6, "6 3");
  g += `<text x="380" y="340" class="apc-t" style="fill:var(--critical)">STO 1 + STO 2 (2 channels)</text>`;
  // CAN
  g += ln("M350,365 H645 V78 M645,92 V148 M645,162 V218 M645,365 V420 H120 V430", can, 2);
  for (const y of [78, 148, 218]) g += ln(`M645,${y - 8} H630`, can, 2);
  g += bx(40, 430, 140, 32, "BMS", "CAN node 10 (end: 120 Ω)", can);
  g += `<text x="654" y="300" class="apc-t" style="fill:${can}">CAN ${P.br} kbit/s</text><text x="654" y="314" class="apc-t" style="fill:${can}">120 Ω at both ends</text>`;
  g += `<text x="10" y="${H - 8}" class="apc-t" style="font-size:10px"><tspan style="fill:${pw}">red = 48 V power</tspan> · <tspan style="fill:${lo}">orange = 24 V</tspan> · <tspan style="fill:${can}">blue = CAN</tspan> · <tspan style="fill:var(--critical)">dashed = STO (safety)</tspan></text>`;
  return g + `</svg>`;
}
const CIA = {
  nrdy: { n: "Not ready to switch on", sw: 0x0000, x: 30, y: 20 },
  sod: { n: "Switch on disabled", sw: 0x0040, x: 30, y: 100 },
  rdy: { n: "Ready to switch on", sw: 0x0021, x: 30, y: 180 },
  son: { n: "Switched on", sw: 0x0023, x: 30, y: 260 },
  op: { n: "Operation enabled", sw: 0x0027, x: 30, y: 340 },
  qs: { n: "Quick stop active", sw: 0x0007, x: 330, y: 340 },
  flt: { n: "Fault", sw: 0x0008, x: 330, y: 100 },
};
function ciaSVG(st) {
  const W = 620, H = 400, bw = 210, bh = 40;
  let g = `<svg viewBox="0 0 ${W} ${H}" class="apc-svg" aria-label="CiA 402 drive state machine"><defs><marker id="avS" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,1 L10,5 L0,9 z" fill="var(--text-2)"/></marker></defs>`;
  const ar = (x1, y1, x2, y2, t, tx, ty) => `<path d="M${x1},${y1} L${x2},${y2}" stroke="var(--text-2)" stroke-width="1.4" marker-end="url(#avS)"/>${t ? `<text x="${tx}" y="${ty}" class="apc-t" style="font-size:10px">${t}</text>` : ""}`;
  g += ar(135, 60, 135, 98, "automatic", 142, 82);
  g += ar(120, 140, 120, 178, "", 0, 0);
  g += `<text x="128" y="164" class="apc-t" style="font-size:10px">0x0006 shutdown</text>`;
  g += ar(120, 220, 120, 258, "", 0, 0) + `<text x="128" y="244" class="apc-t" style="font-size:10px">0x0007 switch on</text>`;
  g += ar(120, 300, 120, 338, "", 0, 0) + `<text x="128" y="324" class="apc-t" style="font-size:10px">0x000F enable operation</text>`;
  g += ar(240, 360, 328, 360, "", 0, 0) + `<text x="248" y="354" class="apc-t" style="font-size:10px">0x0002 quick stop</text>`;
  g += `<path d="M435,340 V300 Q435,120 242,120" stroke="var(--text-2)" fill="none" stroke-width="1.4" marker-end="url(#avS)"/><text x="442" y="250" class="apc-t" style="font-size:10px">motor stopped → disable</text>`;
  g += `<path d="M330,120 H242" stroke="var(--critical)" fill="none" stroke-width="1.4" marker-end="url(#avS)" stroke-dasharray="5 3"/><text x="252" y="112" class="apc-t" style="font-size:10px;fill:var(--critical)">0x0080 fault reset</text>`;
  g += `<text x="330" y="70" class="apc-t" style="font-size:10px;fill:var(--critical)">from ANY state on a fault:</text><text x="330" y="84" class="apc-t" style="font-size:10px;fill:var(--critical)">over-current, encoder, following error, voltage</text>`;
  g += `<path d="M30,360 H12 V120 H28" stroke="var(--text-2)" fill="none" stroke-width="1.2" marker-end="url(#avS)" stroke-dasharray="3 3"/><text x="4" y="236" class="apc-t" style="font-size:9.5px" transform="rotate(-90 4 236)">0x0000 disable voltage</text>`;
  for (const [k, s] of Object.entries(CIA)) {
    const on = k === st;
    g += `<rect x="${s.x}" y="${s.y}" width="${bw}" height="${bh}" rx="8" fill="${on ? (k === "flt" ? "color-mix(in srgb, var(--critical) 30%, var(--surface))" : "color-mix(in srgb, var(--accent) 30%, var(--surface))") : "var(--surface)"}" stroke="${on ? (k === "flt" ? "var(--critical)" : "var(--accent)") : "var(--border)"}" stroke-width="${on ? 2.2 : 1.2}"/>`;
    g += `<text x="${s.x + bw / 2}" y="${s.y + 17}" class="apc-t c" style="font-weight:600;fill:var(--text)">${s.n}</text><text x="${s.x + bw / 2}" y="${s.y + 32}" class="apc-t c">statusword ${hex(s.sw)}</text>`;
  }
  return g + `</svg>`;
}

/* ------------------------------------------------------------------ example code */
function code(A, D, P) {
  const M = A.M, R = A.R;
  const kin = `# Differential drive kinematics - navigation PC, every ${P.tcy} ms
import math

WHEEL_D = ${f(M.Dw / 1000, 3)}    # m, drive wheel diameter
TRACK   = ${f(R.trk / 1000, 3)}    # m, distance between the two drive wheels
GEAR_I  = ${D.i}       # gearbox ratio
V_MAX   = ${f(D.vtop, 2)}     # m/s, max. wheel speed (motor 3000 rpm)

def motor_rpm(v_wheel):
    return v_wheel / (math.pi * WHEEL_D) * 60 * GEAR_I

def wheel_speeds(v, w):
    """v = forward speed (m/s), w = turn rate (rad/s, + = left) -> motor rpm left, right"""
    v_l = v - w * TRACK / 2
    v_r = v + w * TRACK / 2
    k = max(abs(v_l), abs(v_r)) / V_MAX        # keep the curve shape if one wheel is too fast
    if k > 1.0:
        v_l, v_r = v_l / k, v_r / k
    return motor_rpm(v_l), -motor_rpm(v_r)      # right motor is mounted mirrored -> sign flipped

# example: 0.5 m/s straight -> ${f(0.5 * D.rpmPerMs, 0)} rpm on both motors
# example: turn on the spot at 0.5 rad/s -> wheels +/- ${f(0.5 * R.trk / 2000, 3)} m/s`;
  const can = `# CANopen CiA 402 - set up and command the drives (node 1 = left, 2 = right, 3 = lift)
# can_send(cob_id, data) = your CAN interface. On an offline PC: install python-can from a wheel file,
# or use the C library of your CAN adapter. Objects and units: check the drive manual (velocity unit often rpm).

def sdo_write(node, index, sub, value, size):
    cmd = {1: 0x2F, 2: 0x2B, 4: 0x23}[size]                     # expedited SDO download
    data = [cmd, index & 0xFF, index >> 8, sub] + list(value.to_bytes(4, "little", signed=value < 0))
    can_send(0x600 + node, data)                                 # drive answers on 0x580 + node

def setup_drive(node):
    can_send(0x000, [0x80, node])                                # NMT pre-operational
    sdo_write(node, 0x6060, 0, 9, 1)                             # mode: 9 = cyclic synchronous velocity (CSV)
    sdo_write(node, 0x6083, 0, ${f(D.accRpm, 0).replace(/,/g, "")}, 4)                          # acceleration  ${M.acc} m/s2 -> rpm/s
    sdo_write(node, 0x6084, 0, ${f(D.accRpm, 0).replace(/,/g, "")}, 4)                          # deceleration
    sdo_write(node, 0x6085, 0, ${f(D.qsRpm, 0).replace(/,/g, "")}, 4)                          # quick-stop deceleration ${M.dec} m/s2
    sdo_write(node, 0x605A, 0, 6, 2)                             # quick stop: brake on the quick-stop ramp, stay stopped
    sdo_write(node, 0x1006, 0, ${P.tcy * 1000}, 4)                         # SYNC period in microseconds
    sdo_write(node, 0x1017, 0, 100, 2)                           # send heartbeat every 100 ms
    sdo_write(node, 0x1016, 1, (10 << 16) | 300, 4)              # watch the PC heartbeat (node 10), timeout 300 ms
    # RPDO1 (COB-ID 0x200 + node): controlword 0x6040 (16 bit) + target velocity 0x60FF (32 bit)
    sdo_write(node, 0x1600, 0, 0, 1)
    sdo_write(node, 0x1600, 1, 0x60400010, 4)
    sdo_write(node, 0x1600, 2, 0x60FF0020, 4)
    sdo_write(node, 0x1600, 0, 2, 1)
    sdo_write(node, 0x1400, 2, 1, 1)                             # take the RPDO on every SYNC
    # TPDO1 (0x180 + node): statusword 0x6041 + velocity actual 0x606C;  TPDO2 (0x280 + node): position actual 0x6064
    sdo_write(node, 0x1A00, 0, 0, 1)
    sdo_write(node, 0x1A00, 1, 0x60410010, 4)
    sdo_write(node, 0x1A00, 2, 0x606C0020, 4)
    sdo_write(node, 0x1A00, 0, 2, 1)
    can_send(0x000, [0x01, node])                                # NMT start -> operational

def send_cycle(cw_l, rpm_l, cw_r, rpm_r):                        # every ${P.tcy} ms
    for node, cw, rpm in ((1, cw_l, rpm_l), (2, cw_r, rpm_r)):
        can_send(0x200 + node, list(cw.to_bytes(2, "little")) + list(int(rpm).to_bytes(4, "little", signed=True)))
    can_send(0x080, [])                                          # SYNC: both drives take the new speed at the same moment
    can_send(0x70A, [0x05])                                      # PC heartbeat (node 10, operational)

# Example frames on the bus (0.5 m/s straight, both drives enabled):
#   0x201  0F 00 ${D.frameHexL}      left:  controlword 0x000F + ${f(0.5 * D.rpmPerMs, 0)} rpm
#   0x202  0F 00 ${D.frameHexR}      right: controlword 0x000F - ${f(0.5 * D.rpmPerMs, 0)} rpm (mirrored)
#   0x080                       SYNC
#   0x181  27 06 ...            left statusword 0x0627 (operation enabled, target reached) + speed`;
  const st = `(* CiA 402 enable sequence for one drive - IEC 61131-3 Structured Text *)
FUNCTION_BLOCK FB_Cia402
VAR_INPUT
    xEnable      : BOOL;    (* vehicle logic wants to drive *)
    xSafetyOk    : BOOL;    (* safety controller: STO not active, E-stop released *)
    xResetFault  : BOOL;    (* operator / fleet manager: reset *)
    wStatus      : WORD;    (* statusword 0x6041 from TPDO1 *)
    diTargetRpm  : DINT;    (* from the kinematics *)
END_VAR
VAR_OUTPUT
    wControl     : WORD;    (* controlword 0x6040 to RPDO1 *)
    diVelCmd     : DINT;    (* target velocity 0x60FF to RPDO1 *)
    xReady       : BOOL;
    xFault       : BOOL;
END_VAR
VAR
    wState       : WORD;
    rtReset      : R_TRIG;
END_VAR

wState   := wStatus AND 16#006F;              (* mask the state bits *)
xFault   := (wStatus AND 16#0008) <> 0;
xReady   := FALSE;
diVelCmd := 0;
rtReset(CLK := xResetFault);

IF xFault THEN
    IF rtReset.Q THEN wControl := 16#0080;    (* fault reset needs a rising edge of bit 7 *)
    ELSE wControl := 16#0000; END_IF;
ELSIF NOT xEnable OR NOT xSafetyOk THEN
    wControl := 16#0006;                      (* shutdown: power stage off, brake closes *)
ELSE
    CASE wState OF
        16#0040, 16#0060: wControl := 16#0006;    (* switch on disabled  -> shutdown *)
        16#0021:          wControl := 16#0007;    (* ready to switch on  -> switch on *)
        16#0023:          wControl := 16#000F;    (* switched on         -> enable operation *)
        16#0027:          wControl := 16#000F;    (* operation enabled: brake open, speed control *)
                          xReady   := TRUE;
                          diVelCmd := diTargetRpm;
        16#0007:          wControl := 16#0002;    (* quick stop active: wait *)
    ELSE
        wControl := 16#0006;
    END_CASE;
END_IF;
END_FUNCTION_BLOCK`;
  const cas = `/* What runs INSIDE the servo drive (simplified) - every 250 us (4 kHz).
   The current loop (16 kHz) and the PWM / commutation are below this. */
typedef struct { float kp, ki, integ, out_max; } PI;

static float pi_step(PI *c, float err, float dt)
{
    float out = c->kp * err + c->ki * c->integ;
    if (out >  c->out_max) out =  c->out_max;           /* torque limit = motor peak torque */
    else if (out < -c->out_max) out = -c->out_max;
    else c->integ += err * dt;                          /* anti-windup: integrate only when not limited */
    return out;
}

#define J_TOTAL  ${D.Jt.toExponential(3)}f   /* kg m2: motor ${D.Jm.toExponential(2)} + AGV reflected ${D.Jl.toExponential(2)} (ratio ${f(D.ratio, 0)}:1) */
#define KT       ${f(D.Kt, 3)}f      /* Nm/A torque constant */
#define KV       ${f(D.Kv, 1)}f       /* 1/s position loop gain */

static PI speed = { ${f(D.Kp, 4)}f, ${f(D.Ki, 3)}f, 0.0f, ${D.Tp}f };   /* Kp = J*2*pi*${P.fbw} Hz, Ki = Kp*2*pi*${P.fbw}/4 */

void control_250us(float pos_ref, float vel_ref, float acc_ref)   /* rad, rad/s, rad/s2 at the motor */
{
    float pos     = encoder_rad();                      /* ${P.cpr} counts per turn */
    float vel     = speed_filter(pos);                  /* derivative + low-pass */
    float vel_cmd = vel_ref + KV * (pos_ref - pos);     /* position loop + velocity feed-forward */
    float trq     = pi_step(&speed, vel_cmd - vel, 250e-6f)
                  + J_TOTAL * acc_ref;                  /* + acceleration feed-forward */
    current_ref(trq / KT);                              /* -> current loop -> PWM -> motor phases U V W */
}`;
  const odo = `/* Odometry on the navigation PC from TPDO2 (position actual 0x6064), every ${P.tcy} ms */
#include <math.h>
#include <stdint.h>

#define CPR     ${P.cpr}.0
#define GEAR_I  ${D.i}.0
#define WHEEL_D ${f(M.Dw / 1000, 3)}
#define TRACK   ${f(R.trk / 1000, 3)}
#define COUNTS_PER_M (CPR * GEAR_I / (M_PI * WHEEL_D))      /* = ${f(P.cpr * D.i / (Math.PI * M.Dw / 1000), 0)} counts per metre */

static int32_t last_l, last_r;
static double x, y, th;                                      /* m, m, rad */

void odom_update(int32_t cnt_l, int32_t cnt_r)
{
    double dl =  (int32_t)(cnt_l - last_l) / COUNTS_PER_M;  /* int32 difference works over the overflow */
    double dr = -(int32_t)(cnt_r - last_r) / COUNTS_PER_M;  /* right motor mirrored */
    last_l = cnt_l;  last_r = cnt_r;
    double ds  = (dl + dr) / 2.0;
    double dth = (dr - dl) / TRACK;
    x  += ds * cos(th + dth / 2.0);
    y  += ds * sin(th + dth / 2.0);
    th += dth;
    /* the localisation (scanner + map) corrects x, y, th - odometry alone drifts (wheel wear, slip) */
}`;
  const wd = `(* Communication watchdog + drive faults - vehicle controller, every ${P.tcy} ms *)
(* Software stops are COMFORT functions. The SAFETY stop is the safety controller -> STO, wired, PL d. *)
tonNoCmd(IN := NOT xNewCmdFromNav, PT := T#100MS);          (* navigation PC alive? *)
tonHbL(IN := NOT xHeartbeatLeft,  PT := T#300MS);
tonHbR(IN := NOT xHeartbeatRight, PT := T#300MS);

IF tonNoCmd.Q THEN
    eMode := E_MODE.QUICK_STOP;  sAlarm := 'no command from navigation';
END_IF;
IF tonHbL.Q OR tonHbR.Q THEN
    eMode := E_MODE.QUICK_STOP;  sAlarm := 'drive heartbeat missing';
END_IF;
IF ABS(diFollowErrL) > FOLLOW_MAX OR ABS(diFollowErrR) > FOLLOW_MAX THEN   (* 0x60F4, limit ${f(Math.max(20, D.efNoFF * 0.5), 0)} mm *)
    eMode := E_MODE.QUICK_STOP;  sAlarm := 'following error (wheel blocked / slipping?)';
END_IF;
IF rBatteryV < 44.0 THEN
    eMode := E_MODE.SLOW_TO_CHARGER;                         (* LiFePO4 low: drive slowly to the charger *)
END_IF;

CASE eMode OF
    E_MODE.QUICK_STOP: wControlL := 16#0002;  wControlR := 16#0002;   (* drives brake on the 0x6085 ramp *)
    E_MODE.RUN:        (* FB_Cia402 outputs are used *)
END_CASE;`;
  return [["kin", "Kinematics (Python)", kin], ["can", "CANopen setup + frames (Python)", can], ["st", "Enable sequence (Structured Text)", st],
    ["cas", "Cascade controller (C, in the drive)", cas], ["odo", "Odometry (C)", odo], ["wd", "Watchdog + faults (Structured Text)", wd]];
}

/* ------------------------------------------------------------------ UI */
const box = $("avItem2");
if (box) {
  box.innerHTML = `
    <div class="kpis" id="adKpis"></div>
    <div class="grid2 eq" style="margin-top:0">
      <div class="card"><div class="card-head"><h2>Control layers</h2><span class="sub">who decides what, how often</span></div><div id="adLayers"></div></div>
      <div class="card"><div class="card-head"><h2>Inside the servo drive</h2><span class="sub">cascade control</span></div>
        <div class="gc-formula" id="adCascade"></div>
        <p class="hint">Each loop gives the set value to the next, faster loop. The outer loop must be about 5–10 × slower than the inner one, otherwise they fight each other.
          <b>Feed-forward</b> sends the known speed and acceleration directly to the inner loops – then the position loop only has to correct small errors.</p></div>
    </div>
    <div class="card"><div class="card-head"><h2>Control simulator – one drive wheel</h2><span class="sub">move profile ${"0 → v_max → 0"} with the real motor, gear and AGV mass from item 1</span></div>
      <div class="apc3d-bar">
        <label class="tb-check">Speed loop bandwidth <input type="range" id="adFbw" min="3" max="60" step="1" style="width:130px;vertical-align:middle"> <b id="adFbwV"></b></label>
        <label class="tb-check">Kv factor <input type="range" id="adKvf" min="2" max="12" step="0.5" style="width:100px;vertical-align:middle"> <b id="adKvfV"></b></label>
        <label class="tb-check"><input type="checkbox" id="adFF" checked> feed-forward</label>
        <label class="tb-check"><input type="checkbox" id="adDist" checked> floor step (yellow band)</label>
        <label class="tb-check"><input type="checkbox" id="adQ" checked> encoder steps</label>
        <button class="btn ghost" id="adAuto">Recommended tuning</button>
      </div>
      <div class="grid2" style="margin-top:0"><div><div id="adSim"></div><div id="adSimHover" class="small muted" style="min-height:18px"></div></div><div id="adSimStats"></div></div>
    </div>
    <div class="card"><div class="card-head"><h2>Power + signal wiring</h2><span class="sub">battery → fuse → main switch → precharge → contactor → DC bus → drives → motors</span></div>
      <div class="grid2" style="margin-top:0"><div id="adWire"></div><div><div class="table-wrap"><table class="apc-bom" id="adParts"></table></div></div></div></div>
    <div class="card"><div class="card-head"><h2>Drive state machine (CiA 402)</h2><span class="sub">click the commands – this is what the PLC / PC sends in the controlword</span></div>
      <div class="grid2" style="margin-top:0"><div id="adCia"></div><div>
        <div class="mx-nav" id="adCiaBtns" style="flex-direction:column;align-items:stretch"></div>
        <div class="gc-formula" id="adCiaFrame" style="margin-top:8px"></div></div></div></div>
    <div class="card"><div class="card-head"><h2>Control code (examples)</h2><span class="sub">values filled in from your AGV · adapt to your drive manual</span></div>
      <div class="mx-nav" id="adCodeTabs"></div>
      <div style="position:relative"><button class="btn ghost" id="adCopy" style="position:absolute;right:8px;top:8px">Copy</button><pre class="gc-formula" id="adCode" style="max-height:560px;overflow:auto;white-space:pre"></pre></div></div>
    <div class="grid2 eq" style="margin-top:0">
      <div class="card"><div class="card-head"><h2>Drive parameters (object dictionary)</h2><span class="sub">set once at commissioning</span></div><div class="table-wrap"><table class="apc-bom" id="adOD"></table></div></div>
      <div class="card"><div class="card-head"><h2>Checks</h2></div><div id="adChecks" class="apc-checks"></div></div>
    </div>
    <div class="apc-main">
      <div class="card apc-incard"><div class="card-head"><h2>Design inputs</h2><button class="btn ghost" id="adReset">Example values</button></div><div id="adInputs"></div>
        <p class="hint">Motor, gear ratio, wheel, speed, acceleration and mass come from item 1 – change them there.</p></div>
      <div class="apc-right"><div class="card"><div class="card-head"><h2>Calculations</h2><span class="sub">formulas with your numbers</span></div><div id="adCalc" class="apc-calc"></div></div></div>
    </div>
    <div class="card"><div class="card-head"><h2>Guide – build, wire, commission, tune</h2></div><div id="adGuide" class="mx-guide"></div></div>`;

  let P = { ...DEF };
  try { Object.assign(P, JSON.parse(localStorage.getItem("agvDriveState") || "{}")); } catch (e) { /* private window */ }
  const opt = { ff: true, dist: true, quant: true };
  let A = null, D = null, S = null, cia = "sod", codeTab = "kin", codes = [];
  const cls = { ok: "apc-ok", warn: "apc-warn", bad: "apc-bad" };
  const blk = (t, rows, note) => `<div class="apc-blk"><h3>${t}</h3><div class="gc-formula">${rows.join("\n")}</div>${note ? `<p class="hint">${note}</p>` : ""}</div>`;
  const b2 = (v) => [v & 0xFF, (v >> 8) & 0xFF].map((x) => x.toString(16).toUpperCase().padStart(2, "0")).join(" ");
  const le32 = (v) => { const b = new DataView(new ArrayBuffer(4)); b.setInt32(0, Math.round(v), true); return [0, 1, 2, 3].map((i) => b.getUint8(i).toString(16).toUpperCase().padStart(2, "0")).join(" "); };

  function inputs() {
    $("adInputs").innerHTML = GROUPS.map(([g, fs]) => `<fieldset class="apc-fs"><legend>${esc(g)}</legend>${fs.map(([k, l, u, d, n]) =>
      `<label class="apc-f" title="${esc(n || "")}"><span>${esc(l)}${n ? ` <i class="muted">${esc(n)}</i>` : ""}</span>
        <span class="apc-in"><input type="number" step="any" data-k="${k}" value="${P[k]}" aria-label="${esc(l)}"${P[k] !== d ? ' class="chg"' : ""}><em>${esc(u)}</em></span></label>`).join("")}</fieldset>`).join("");
    $("adFbw").value = P.fbw; $("adKvf").value = P.kvf;
  }
  function save() { try { localStorage.setItem("agvDriveState", JSON.stringify(P)); } catch (e) { /* ignore */ } }
  function checks() {
    const c = [], add = (l, ok, warn, t) => c.push([l, ok ? "ok" : warn ? "warn" : "bad", t]), M = A.M;
    add("Servo drive size", true, true, `${D.drive[0]} A rated / ${D.drive[1]} A peak for ${f(D.Ir, 1)} A / ${f(D.Ip, 1)} A`);
    add("Inertia ratio AGV : motor", D.ratio <= 30, D.ratio <= 250, `${f(D.ratio, 0)} : 1 – ${D.ratio > 30 ? "normal for AGVs, keep the speed loop at 10–20 Hz (or a bigger gear ratio)" : "easy to tune"}`);
    add("Encoder resolution at the wheel", D.res <= 0.05, D.res <= 0.5, `${f(D.res * 1000, 2)} µm per count`);
    add("Motor speed at top speed", D.nmax <= 3000, D.nmax <= 3300, `${f(D.nmax, 0)} rpm at ${f(D.vtop, 2)} m/s ≤ 3000 rpm`);
    add("Following error (simulation)", S.eMax <= 3, S.eMax <= 15, `max ${f(S.eMax, 1)} mm${opt.ff ? "" : " – switch feed-forward on"}`);
    add("Peak current (simulation)", S.Imax <= D.Ip * 0.95, S.Imax <= D.Ip, `${f(S.Imax, 1)} A ≤ ${f(D.Ip, 1)} A`);
    add("Motor temperature (RMS current)", S.Irms <= D.Ir, S.Irms <= D.Ir * 1.2, `${f(S.Irms, 1)} A RMS ≤ ${f(D.Ir, 1)} A rated (during the move)`);
    add("Current loop ≫ speed loop", P.fci >= 10 * P.fbw, P.fci >= 5 * P.fbw, `${P.fci} Hz ≥ 10 × ${P.fbw} Hz`);
    add("Regeneration into the battery", D.Ireg <= P.Ichg, D.Ireg <= P.Ichg * 1.5, `${f(D.Ireg, 1)} A at an emergency stop ≤ BMS ${P.Ichg} A`);
    add("Brake chopper (battery full / BMS open)", true, true, `R ≤ ${f(D.RbrMax, 1)} Ω → ${D.Rbr} Ω, ${f(D.Preg, 0)} W peak, ${f(D.Ereg, 0)} J per stop`);
    add("Precharge time", D.tpre <= 2, D.tpre <= 5, `5·R·C = 5 × ${P.Rpre} Ω × ${f(D.C * 1e6, 0)} µF = ${f(D.tpre, 2)} s`);
    add("Main fuse protects the cable", D.cable[1] >= D.fuse, false, `fuse ${D.fuse} A ≤ cable ${D.cable[0]} mm² (${D.cable[1]} A)`);
    add("Voltage drop at peak current", D.dU <= M.Ub * 0.02, D.dU <= M.Ub * 0.04, `${f(D.dU, 2)} V at ${f(D.Ipk, 0)} A (${f(D.dU / M.Ub * 100, 1)} %)`);
    add("CAN bus load", D.load <= 0.4, D.load <= 0.6, `${f(D.load * 100, 0)} % at ${P.br} kbit/s, cycle ${P.tcy} ms`);
    return c;
  }
  function formulas() {
    const M = A.M, R = A.R;
    $("adCalc").innerHTML = [
      blk("1 · Motor current", [`Rated     I = P/(U·0.8) = ${D.Pw}/(${M.Ub}·0.8) = <b>${f(D.Ir, 1)} A</b>`, `Peak      I_pk = I·T_pk/T = <b>${f(D.Ip, 1)} A</b>`, `Torque k  K_t = T/I = ${f(D.Kt, 3)} Nm/A`]),
      blk("2 · Inertia", [`Motor     J_m = ${D.Jm.toExponential(2)} kg·m²`, `AGV       J_l = (m/2)·r²/i² = ${f(D.mw, 0)}·${f(D.r, 3)}²/${D.i}² = ${D.Jl.toExponential(2)}`, `Ratio     J_l/J_m = <b>${f(D.ratio, 0)} : 1</b>`],
        "The AGV mass seen at the motor shaft is divided by i². A bigger gear ratio = smaller ratio = easier tuning, but lower top speed."),
      blk("3 · Gains (recommended)", [`Speed     K_p = J·2π·f = ${f(D.Kp, 4)} Nm/(rad/s)`, `          K_i = K_p·2π·f/4 = ${f(D.Ki, 3)}`, `Position  K_v = 2π·f/${P.kvf} = <b>${f(D.Kv, 1)} 1/s</b>`,
        `Following error without feed-forward = v/K_v = ${f(D.efNoFF, 0)} mm at ${M.vmax} m/s`]),
      blk("4 · Regeneration + brake chopper", [`Peak      P = m·a·v·0.8 = ${f(R.mt, 0)}·${M.dec}·${M.vmax}·0.8 = ${f(D.Preg, 0)} W → ${f(D.Ireg, 1)} A`, `Energy    ½·m·v²·0.8 = ${f(D.Ereg, 0)} J per emergency stop`,
        `Resistor  R ≤ U²/P = ${P.Uch}²/${f(D.Preg, 0)} = ${f(D.RbrMax, 1)} Ω → <b>${D.Rbr} Ω</b>`], "When the battery is full or the BMS opens the charge path, the braking energy pumps the DC bus voltage up → the chopper burns it in the resistor."),
      blk("5 · Precharge", [`DC bus    C = 3 × ${P.Cdc} µF = ${f(D.C * 1e6, 0)} µF`, `Time      5·R·C = <b>${f(D.tpre, 2)} s</b>, max ${f(D.Ipre, 1)} A`, `Energy    ½·C·U² = ${f(D.Epre, 1)} J in the resistor`],
        "Without precharge the empty capacitors short-circuit the battery for a moment (hundreds of A): contactor welds, fuse blows."),
      blk("6 · Fuse + cable", [`Continuous  2·${f(D.Ir, 1)} + lift + electronics = ${f(D.Icont, 1)} A → ×1.25 → <b>${D.fuse} A</b>`, `Cable       ${D.cable[0]} mm² (${D.cable[1]} A)`, `Drop        2·L·I·ρ/A = ${f(D.dU, 2)} V`]),
      blk("7 · CAN bus load", [`Frames / cycle  ${f(D.frames, 1)} × ~130 bit`, `Load = ${f(D.frames, 1)}·130/(${P.tcy} ms · ${P.br} kbit/s) = <b>${f(D.load * 100, 0)} %</b>`]),
    ].join("");
  }
  function partsTab() {
    const M = A.M, rows = [
      ["Battery + BMS", "G1", `LiFePO4 ${M.Ub} V ${M.Ah} Ah, charge ≤ ${P.Ichg} A, CAN`, "BMS can open charge / discharge path"],
      ["Main fuse", "F1", `${D.fuse} A, DC rated ≥ 80 V`, "close to the battery terminal"],
      ["Main switch", "Q1", `≥ ${D.fuse} A DC, lockable`, "service / LOTO"],
      ["Precharge resistor + relay", "R1, K2", `${P.Rpre} Ω, ≥ 10 W pulse (${f(D.Epre, 1)} J)`, `${f(D.tpre, 2)} s before K1 closes`],
      ["Main contactor", "K1", `≥ ${D.fuse} A DC, 24 V coil`, "opened by E-stop chain / BMS"],
      ["Servo drive (2×)", "A1, A2", `48 V, ${D.drive[0]} A / ${D.drive[1]} A peak, CANopen CiA 402, STO (SIL 2 / PL d), encoder input, brake output`, "node 1 left, node 2 right"],
      ["Lift drive", "A3", `48 V, for ${A.R.lmot[0]} W`, "node 3"],
      ["Brake chopper + resistor", "A4, R2", `switch-on ${P.Uch} V, ${D.Rbr} Ω, ≥ 100 W cont.`, "often built into the drive"],
      ["DC/DC 48 → 24 V", "U1", `≥ ${f(M.Pel * 1.5 / 24 + 4, 0)} A`, "logic, brakes, sensors"],
      ["Drive motor (2×)", "M1, M2", `${D.Pw} W BLDC, ${D.Tr}/${D.Tp} Nm, ${P.cpr}-count encoder, 24 V brake`, ""],
      ["Motor cable", "W1, W2", `4 × ${D.Ir > 10 ? "2.5" : "1.5"} mm² shielded, shield 360° both ends`, "EMC"],
      ["Encoder cable", "W3, W4", "twisted pairs, shielded, separate from motor cable", ""],
      ["Battery cable", "W0", `${D.cable[0]} mm², ${P.Lc} m`, `drop ${f(D.dU, 2)} V`],
      ["CAN interface (PC)", "A10", "USB / PCIe CAN, galvanically isolated", "120 Ω on, node 10"],
      ["CAN cable", "W10", "twisted pair 120 Ω, shielded, M12 A-coded", `${P.br} kbit/s`]];
    $("adParts").innerHTML = `<thead><tr><th>Part</th><th>Tag</th><th>Specification</th><th>Note</th></tr></thead><tbody>${rows.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td><code>${esc(r[1])}</code></td><td>${esc(r[2])}</td><td class="muted">${esc(r[3])}</td></tr>`).join("")}</tbody>`;
  }
  function odTab() {
    const M = A.M, rows = [
      ["0x6040", "Controlword", "from PC every cycle", "commands the state machine"], ["0x6041", "Statusword", "to PC", "state + warnings"],
      ["0x6060", "Modes of operation", "9 (CSV) or 3 (profile velocity)", "speed control"], ["0x60FF", "Target velocity", "rpm (check unit)", "from the kinematics"],
      ["0x606C", "Velocity actual", "rpm", "monitoring"], ["0x6064", "Position actual", "counts", "odometry"],
      ["0x6083 / 0x6084", "Acceleration / deceleration", `${f(D.accRpm, 0)} rpm/s`, `${M.acc} m/s²`], ["0x6085", "Quick-stop deceleration", `${f(D.qsRpm, 0)} rpm/s`, `${M.dec} m/s²`],
      ["0x605A", "Quick-stop option code", "6", "stop on QS ramp, stay"], ["0x6075", "Motor rated current", `${f(D.Ir * 1000, 0)} mA`, ""],
      ["0x6073", "Max. current", `${f(D.Ip / D.Ir * 1000, 0)} ‰ of rated`, "= peak"], ["0x607F", "Max. profile velocity", `${f(Math.min(3000, D.nmax * 1.1), 0)} rpm`, "top speed + 10 %, max. motor 3000 rpm"],
      ["0x6065", "Following error window", `${f(Math.max(20, D.efNoFF * 0.5) / 1000 * P.cpr * D.i / (Math.PI * M.Dw / 1000), 0)} counts`, `≈ ${f(Math.max(20, D.efNoFF * 0.5), 0)} mm at the wheel`],
      ["0x1006", "Communication cycle (SYNC)", `${P.tcy * 1000} µs`, ""], ["0x1017 / 0x1016", "Heartbeat producer / consumer", "100 ms / 300 ms", "detects a dead node"],
      ["0x1600 / 0x1A00", "PDO mapping", "RPDO1: 6040+60FF · TPDO1: 6041+606C", ""]];
    $("adOD").innerHTML = `<thead><tr><th>Index</th><th>Name</th><th>Value</th><th>Note</th></tr></thead><tbody>${rows.map((r) => `<tr><td><code>${r[0]}</code></td><td>${esc(r[1])}</td><td><b>${esc(r[2])}</b></td><td class="muted">${esc(r[3])}</td></tr>`).join("")}</tbody>`;
  }
  function ciaUI() {
    $("adCia").innerHTML = ciaSVG(cia);
    const cmds = [["Shutdown", 0x0006, { sod: "rdy", son: "rdy", op: "rdy" }], ["Switch on", 0x0007, { rdy: "son" }], ["Enable operation", 0x000F, { son: "op", rdy: "op" }],
      ["Quick stop", 0x0002, { op: "qs", rdy: "sod", son: "sod" }], ["Disable voltage", 0x0000, { rdy: "sod", son: "sod", op: "sod", qs: "sod" }],
      ["Simulate a fault (e.g. over-current)", -1, {}], ["Fault reset", 0x0080, { flt: "sod" }]];
    $("adCiaBtns").innerHTML = cmds.map(([n, cw], i) => `<button class="mx-el" data-ci="${i}">${esc(n)}${cw >= 0 ? ` <code>${hex(cw)}</code>` : ""}</button>`).join("");
    $("adCiaBtns").querySelectorAll("[data-ci]").forEach((b) => b.addEventListener("click", () => {
      const [n, cw, tr] = cmds[+b.dataset.ci];
      const before = cia;
      if (cw < 0) cia = "flt"; else if (tr[cia]) cia = tr[cia];
      if (cia === "qs" && before === "qs") cia = "qs";
      ciaUI(); ciaFrame(n, cw, before);
    }));
  }
  function ciaFrame(n, cw, before) {
    const s = CIA[cia], rpm = cia === "op" ? Math.round(0.5 * D.rpmPerMs) : 0;
    const cwv = cw < 0 ? 0x000F : cw;
    $("adCiaFrame").innerHTML = esc([
      n ? `Command: ${n}${cw >= 0 ? ` → controlword ${hex(cw)}` : ""}` : "Click a command.",
      before && before !== cia ? `State:   ${CIA[before].n} → ${s.n}` : `State:   ${s.n}${n && before === cia ? "  (command not allowed here – no change)" : ""}`,
      `Status:  ${hex(s.sw)}`,
      "",
      `CAN frame PC → left drive (RPDO1):`,
      `  ID 0x201  ${b2(cwv)}  ${le32(rpm)}   (controlword LSB first + target ${rpm} rpm)`,
      `Answer drive → PC (TPDO1):`,
      `  ID 0x181  ${b2(s.sw)}  ...   (statusword LSB first)`,
      "",
      cia === "op" ? "Brake open, power stage on – the motor follows the target velocity." : cia === "flt" ? "Power stage off, brake closed. Read the error code 0x603F, fix the cause, then Fault reset." : "Power stage off, holding brake closed – the AGV cannot move."].join("\n"));
  }
  function codeUI() {
    codes = code(A, D, P);
    $("adCodeTabs").innerHTML = codes.map(([k, n]) => `<button class="mx-el${k === codeTab ? " active" : ""}" data-ct="${k}">${esc(n)}</button>`).join("");
    $("adCodeTabs").querySelectorAll("[data-ct]").forEach((b) => b.addEventListener("click", () => { codeTab = b.dataset.ct; codeUI(); }));
    $("adCode").textContent = (codes.find((c) => c[0] === codeTab) || codes[0])[2];
  }
  function simUI() {
    S = simulate(A, D, P, opt);
    $("adFbwV").textContent = P.fbw + " Hz"; $("adKvfV").textContent = P.kvf;
    $("adSim").innerHTML = simSVG(S, D);
    const st = [["Max. following error", `${f(S.eMax, 1)} mm`, S.eMax <= 3], ["Peak current", `${f(S.Imax, 1)} A (limit ${f(D.Ip, 1)})`, S.Imax <= D.Ip * 0.95], ["RMS current", `${f(S.Irms, 1)} A (rated ${f(D.Ir, 1)})`, S.Irms <= D.Ir],
      ["Kp / Ki", `${f(D.Kp, 4)} / ${f(D.Ki, 3)}`, true], ["Kv", `${f(D.Kv, 1)} 1/s`, true], ["Inertia ratio", `${f(D.ratio, 0)} : 1`, D.ratio <= 250]];
    $("adSimStats").innerHTML = `<table class="apc-dim"><tbody>${st.map(([a, b, ok]) => `<tr><td>${a}</td><td><b style="color:${ok ? "inherit" : "var(--critical)"}">${b}</b></td></tr>`).join("")}</tbody></table>
      <p class="hint">Try it: switch <b>feed-forward</b> off → the position loop must do all the work and the wheel lags ${f(D.efNoFF, 0)} mm behind at full speed.
        Turn the <b>bandwidth</b> up → faster correction of the floor step, but more current noise from the encoder steps and, on a real AGV, vibration.
        Too low → big error at the floor step. Real AGVs: 10–20 Hz.</p>`;
    const svg = $("adSimSvg"), ov = $("adSimOv"), xl = $("avSimX");
    ov.addEventListener("mousemove", (e) => {
      const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, x = (e.clientX - r.left) / r.width * vb.width;
      const L = 54, t = (x - L) / (vb.width - L - 14) * S.Tend, i = Math.max(0, Math.min(S.t.length - 1, Math.round(t / S.Tend * (S.t.length - 1))));
      xl.setAttribute("x1", x); xl.setAttribute("x2", x); xl.setAttribute("visibility", "visible");
      $("adSimHover").textContent = `t = ${f(S.t[i], 2)} s · command ${f(S.vr[i], 3)} m/s · actual ${f(S.va[i], 3)} m/s · error ${f(S.e[i], 2)} mm · current ${f(S.I[i], 2)} A`;
    });
    ov.addEventListener("mouseleave", () => { xl.setAttribute("visibility", "hidden"); $("adSimHover").textContent = ""; });
  }
  function guide() {
    const M = A.M;
    $("adGuide").innerHTML = `
      <h3>1 · Build the control box</h3>
      <ol class="apc-list">
        <li>Mounting plate: battery side (F1, Q1, K1, K2, R1) top left, DC bus bars, then drives A1–A3 in a row, DC/DC and 24 V terminals, safety controller, PC.</li>
        <li>48 V power with ${D.cable[0]} mm² from the battery to the bus bar, ring terminals, torque per data sheet; 24 V and signals in separate ducts.</li>
        <li>Motor cables shielded, shield clamped 360° at the drive and the motor; encoder cables separate. Ferrite on the CAN line at the PC.</li>
        <li>CAN as a line (no star): PC → A1 → A2 → A3 → BMS; 120 Ω only at the two ends. Measure 60 Ω between CAN_H and CAN_L with power off.</li>
        <li>STO: 2 channels from the safety controller to every drive; test pulses allowed only if the drive accepts them (data sheet).</li></ol>
      <h3>2 · First power-on</h3>
      <ol class="apc-list">
        <li>AGV on blocks, wheels free. Check polarity, then switch Q1: K2 precharges (${f(D.tpre, 2)} s), then K1 closes. DC bus = battery voltage ±0.5 V.</li>
        <li>Set node IDs and bit rate on each drive (${P.br} kbit/s); check heartbeats on the bus.</li>
        <li>Motor data into the drive: rated ${f(D.Ir, 1)} A, peak ${f(D.Ip, 1)} A, poles, encoder ${P.cpr} counts; run the commutation / phasing test.</li>
        <li>Brake test: brake released only in "Operation enabled"; with STO the brake must close.</li></ol>
      <h3>3 · Tune (in this order)</h3>
      <ol class="apc-list">
        <li><b>Current loop</b>: drive auto-tune (${P.fci} Hz). Usually done once with the motor data.</li>
        <li><b>Direction</b>: +rpm on both drives must move the AGV forward (right drive mirrored: invert in the drive or in the kinematics – only one place!).</li>
        <li><b>Speed loop</b> on the floor, loaded: start at ${Math.max(5, P.fbw - 5)} Hz, step 0.1 → 0.3 m/s; increase until a little overshoot, then go back 20 %. Use the drive oscilloscope.</li>
        <li><b>Position loop / feed-forward</b>: Kv ≈ ${f(D.Kv, 1)} 1/s, velocity + acceleration feed-forward ON; check the following error at ${M.vmax} m/s is &lt; 3 mm.</li>
        <li>Quick stop: from ${M.vmax} m/s loaded → measure the stopping distance; it must match the safety field table (item 1).</li>
        <li>Odometry: drive 10 m straight, compare with a tape → correct the wheel Ø; turn 10 × 360° → correct the track width.</li></ol>
      <h3>4 · Typical faults</h3>
      <div class="table-wrap"><table class="apc-bom"><thead><tr><th>Symptom</th><th>Likely cause</th><th>Fix</th></tr></thead><tbody>
        <tr><td>AGV drives in a circle</td><td>one motor direction wrong</td><td>invert in the drive OR the kinematics (not both)</td></tr>
        <tr><td>Following-error fault when starting loaded</td><td>accel too high, current limit, brake not released</td><td>check 0x6083, 0x6073, brake output</td></tr>
        <tr><td>Over-voltage fault when braking</td><td>battery full / BMS open, no chopper</td><td>brake chopper ${D.Rbr} Ω, check its threshold ${P.Uch} V</td></tr>
        <tr><td>Wheel buzzes / vibrates at standstill</td><td>speed loop gain too high, encoder noise</td><td>lower bandwidth, speed filter 0.5–1 ms</td></tr>
        <tr><td>Random CAN errors</td><td>missing / double termination, shield not connected</td><td>60 Ω check, shield at one point to PE</td></tr>
        <tr><td>Fuse blows at switch-on</td><td>precharge missing / K1 closes too early</td><td>K1 only after DC bus ≥ 90 % battery voltage</td></tr></tbody></table></div>`;
  }
  function render() {
    A = window.AGV; if (!A) return;
    D = calc(A, P);
    D.frameHexL = le32(0.5 * D.rpmPerMs); D.frameHexR = le32(-0.5 * D.rpmPerMs);
    simUI();
    const ch = checks();
    $("adKpis").innerHTML = [["Motor current", `${f(D.Ir, 1)} / ${f(D.Ip, 1)} A`, "rated / peak per drive"], ["Inertia ratio", `${f(D.ratio, 0)} : 1`, "AGV : motor"], ["Encoder at wheel", `${f(D.res * 1000, 1)} µm`, `${P.cpr} counts × i ${D.i}`],
      ["Following error", `${f(S.eMax, 1)} mm`, opt.ff ? "with feed-forward" : "no feed-forward"], ["CAN load", `${f(D.load * 100, 0)} %`, `${P.br} kbit/s, ${P.tcy} ms`],
      ["Checks", ch.filter((x) => x[1] === "ok").length + " / " + ch.length + " OK", ch.some((x) => x[1] === "bad") ? "see the red lines" : ch.some((x) => x[1] === "warn") ? "some warnings" : "all fine"]]
      .map(([l, v, n]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="note">${esc(n)}</div></div>`).join("");
    $("adChecks").innerHTML = ch.map(([l, s, t]) => `<div class="apc-chk ${cls[s]}"><b>${s === "ok" ? "✓" : s === "warn" ? "!" : "✕"}</b><span>${esc(l)}</span><span class="muted">${esc(t)}</span></div>`).join("");
    $("adLayers").innerHTML = layerSVG(A, D, P);
    $("adCascade").innerHTML = esc([`position loop   ${f(2000, 0)} Hz   Kv = ${f(D.Kv, 1)} 1/s        error (rad) → speed command`, `speed loop      4000 Hz   PI  Kp ${f(D.Kp, 4)}  Ki ${f(D.Ki, 3)}   speed error → torque command`,
      `current loop   16000 Hz   PI (auto-tune ${P.fci} Hz)        torque/K_t → phase currents`, `PWM            16 kHz    6 MOSFETs, 48 V DC bus           → motor U V W`, "", `feed-forward:   speed  ω_ref → speed loop,  acceleration  J·α_ref → torque`].join("\n"));
    $("adWire").innerHTML = wireSVG(A, D, P);
    partsTab(); odTab(); formulas(); guide(); codeUI(); ciaUI(); ciaFrame("", 0, null);
  }
  inputs(); render();
  window.addEventListener("agvchange", () => { if (!box.hidden) render(); else A = null; });
  $("adInputs").addEventListener("change", (e) => {
    const k = e.target.dataset.k; if (!k) return;
    const v = parseFloat(e.target.value); if (!Number.isFinite(v) || v <= 0) { e.target.value = P[k]; return; }
    P[k] = v; e.target.classList.toggle("chg", v !== DEF[k]); save(); inputs(); render();
  });
  $("adReset").addEventListener("click", () => { if (!confirm("Back to the example values?")) return; P = { ...DEF }; save(); inputs(); render(); });
  $("adFbw").addEventListener("input", (e) => { P.fbw = +e.target.value; save(); render(); inputs(); });
  $("adKvf").addEventListener("input", (e) => { P.kvf = +e.target.value; save(); render(); inputs(); });
  $("adFF").addEventListener("change", (e) => { opt.ff = e.target.checked; render(); });
  $("adDist").addEventListener("change", (e) => { opt.dist = e.target.checked; render(); });
  $("adQ").addEventListener("change", (e) => { opt.quant = e.target.checked; render(); });
  $("adAuto").addEventListener("click", () => { P.fbw = 15; P.kvf = 5; opt.ff = true; $("adFF").checked = true; save(); inputs(); render(); });
  $("adCopy").addEventListener("click", async () => { try { await navigator.clipboard.writeText($("adCode").textContent); $("adCopy").textContent = "Copied"; } catch (e) { $("adCopy").textContent = "Select + Ctrl+C"; } setTimeout(() => { $("adCopy").textContent = "Copy"; }, 1500); });

  // item switch (1 = AGV structure, 2 = drive control)
  const showItem = (it) => {
    document.querySelectorAll("[data-avitem]").forEach((b) => b.classList.toggle("active", b.dataset.avitem === it));
    ["1", "2", "3", "4"].forEach((n) => { const c = $("avItem" + n), p = $("avIntro" + n); if (c) c.hidden = n !== it; if (p) p.hidden = n !== it; });
    if (it === "2") render();
    if (it === "3") { const go = () => window.agvPal && window.agvPal.show(); if (window.agvPal) go(); else setTimeout(go, 300); }
    if (it === "4") { const go = () => window.agvDock && window.agvDock.show(); if (window.agvDock) go(); else setTimeout(go, 300); }
  };
  document.querySelectorAll("[data-avitem]").forEach((b) => b.addEventListener("click", () => showItem(b.dataset.avitem)));
  const q = new URLSearchParams(location.search);
  if (q.get("avitem")) showItem(q.get("avitem"));
  if (q.get("adcode")) { codeTab = q.get("adcode"); codeUI(); }
}
