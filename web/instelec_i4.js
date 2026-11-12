/* INSTALLATION tab – item 4 "Electrical noise (EMC), cable routing, signal wiring" (UI).
 * Numbers: instelec_calc.js. Guide: docs/27_installation_electrical_emc.md (part B).
 * URL: &ietray=bad|good|nodiv (tray preset) · &iefault=pigtail|tray|ferrite|peloop|zero|net|analog · &iefix (show the fixed trace)
 *      &iecard=noise|seg|shield|signal|sim|trouble (scroll to a card)
 * All values are EXAMPLES – the drive / machine maker's EMC installation guide always wins.
 */
import { noise, N4, CATS, TCABLES, TRAY, TRAY_PRESETS, checkTray, sepReq, loop420, drop24 } from "./instelec_calc.js";
import { $, Q, esc, f, ok, warn, wwh, card, tbl, ex, num } from "./instelec_ui.js";

/* ------------------------------------------------------------------ why texts for a segregation failure */
const WHYPAIR = {
  MS: "PWM edges of the motor cable (5–10 kV/µs) couple capacitively and inductively into the encoder / analog pair → position errors, encoder alarms, noisy readings.",
  MN: "Motor-cable noise couples into the network cable → CRC errors, lost frames, 'device failure' / watchdog.",
  MC: "Motor-cable noise on 24 V lines → random inputs on fast inputs (touch probe, counters), noisy 0 V.",
  PS: "50 Hz magnetic field and switching spikes of the power cable induce hum and spikes into analog / encoder signals.",
  PN: "Power-cable switching spikes (contactors, DOL starts) disturb the network cable.",
  PC: "Contactor and DOL-motor switching spikes couple into control lines.",
  CS: "Valve / relay switching on the 24 V lines (inductive kicks) couples into sensitive analog / encoder pairs.",
  CN: "Inductive switching spikes of 24 V coils couple into the network cable.",
};
const pairKey = (a, b) => { const o = "PMCSN"; return o.indexOf(a) <= o.indexOf(b) ? a + b : b + a; };

/* ------------------------------------------------------------------ fault simulator definitions */
const hsh = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
const FAULTS = [
  { k: "pigtail", n: "Motor / encoder shield on a pigtail", sig: "Encoder track A, differential (V)", T: 100, tu: "µs", y: [-5, 5], th: [0.2, -0.2], thl: "receiver threshold ±0.2 V",
    g: (t, fx) => { const sq = ((t % 25) + 25) % 25 < 12.5 ? 2.5 : -2.5; const k = Math.floor(t / 20.833), te = k * 20.833, dt = t - te, a = (fx ? 0.12 : 3.2) * (0.6 + 0.6 * hsh(k)) * (hsh(k + 7) > 0.5 ? 1 : -1); return sq + a * Math.exp(-dt / 0.9) * Math.cos(2 * Math.PI * dt / 0.6); },
    path: "conductive + inductive: the HF common-mode current (I_cm = C·dv/dt) flows over the shield; a 50 mm pigtail (≈ 50 nH) has ≈ 3 Ω at 10 MHz → several volts between shield and cabinet → couples into the pairs.",
    sym: "Encoder alarm ('encoder communication error' / 'signal amplitude'), axis stops at high speed or when the spindle accelerates.",
    meas: "Oscilloscope with differential probe on the encoder pair (at the drive): spikes at every PWM edge (every 20.8 µs at 8 kHz). Clamp meter (HF) on the shield.",
    fix: "360° shield clamp / EMC gland at BOTH ends on bare metal (no paint), pigtail removed, connector shells metal and tightened." },
  { k: "tray", n: "Motor and encoder cable in the same tray, no divider", sig: "Following error X axis (µm)", T: 2, tu: "s", y: [-40, 40], th: [20, -20], thl: "following-error alarm limit ±20 µm (example)",
    g: (t, fx) => { const base = 1.2 * Math.sin(2 * Math.PI * 7 * t) + 0.8 * (hsh(Math.floor(t * 400)) - 0.5); const ph = t % 0.5; const burst = ph > 0.08 && ph < 0.16 ? (hsh(Math.floor(t * 300)) - 0.5) * 2 * 32 * Math.sin(Math.PI * (ph - 0.08) / 0.08) : 0; return base + (fx ? burst * 0.04 : burst); },
    path: "capacitive + inductive coupling over the parallel length: U = M·di/dt, M grows with length and falls with distance (card A).",
    sym: "Axis following-error spikes when the spindle or the axes accelerate; sometimes 'excess following error' alarm; marks on the surface at these moments.",
    meas: "Drive trace (servo scope of the CNC) of following error + spindle current: spikes coincide with spindle acceleration. Oscilloscope on the encoder pair.",
    fix: "Separate trays or an earthed metal divider; ≥ 300 mm without divider; cross at 90°; encoder cable with overall + pair shields." },
  { k: "ferrite", n: "No common-mode core / output filter on a long motor cable", sig: "Motor shaft voltage to frame (V)", T: 200, tu: "µs", y: [-25, 25], th: [], thl: "",
    g: (t, fx) => { const k = Math.floor(t / 20.833), lvl = (k % 2 ? 1 : -1) * (fx ? 1.4 : 18) * (0.85 + 0.3 * hsh(k)); const dt = t - k * 20.833; const tau = fx ? 1 : 2.5; let v = lvl * (1 - Math.exp(-dt / tau)); if (!fx && hsh(k + 3) > 0.45) { const tb = 3 + 12 * hsh(k + 11); if (dt > tb) v = lvl * 0.04 * Math.exp(-(dt - tb) / 0.3); } return v; },
    path: "common-mode voltage of the inverter charges the rotor through the winding capacitance; when the bearing grease film breaks down (EDM discharge) a current pulse flows through the bearing.",
    sym: "Bearing noise after months, 'washboard' pattern (fluting) on the race; spindle or motor bearing failure; also disturbs neighbour machines (no line filter).",
    meas: "Shaft voltage probe (brush on the shaft) + oscilloscope: steps with sudden collapses = discharges. HF clamp meter on the motor PE / shield (common-mode current).",
    fix: "Common-mode cores (nanocrystalline ferrite rings) on the motor cable at the drive, dv/dt or sine filter for long cables, symmetric 3-PE shielded motor cable, shaft grounding ring or insulated bearing (maker's choice), line filter at the cabinet entry." },
  { k: "peloop", n: "PE / bonding loop (two earth paths)", sig: "Current in a signal-cable shield (A)", T: 60, tu: "ms", y: [-5, 5], th: [], thl: "",
    g: (t, fx) => { const s = Math.sin(2 * Math.PI * 0.05 * t) * 3 + Math.sin(2 * Math.PI * 0.15 * t + 0.5) * 1.1 + 0.25 * (hsh(Math.floor(t * 50)) - 0.5); return fx ? s * 0.03 : s; },
    path: "inductive: the loop formed by a cable shield and a second PE path picks up the 50 Hz field of large power cables (U = A·dB/dt), and voltage differences between earth points drive current through the shield.",
    sym: "50/150 Hz hum on analog signals, warm shields, random bus errors; with an analog ±10 V speed reference: 50 Hz pattern / marks on the surface.",
    meas: "Clamp meter (AC, 0.1 A range) around the shield / PE: shield current > 0.1 A = problem. Oscilloscope on the analog input.",
    fix: "Bonding conductor (16 mm² Cu) parallel to the shielded cable between the two cabinets, meshed earthing (card 3F), no daisy-chained PE; route cables close to the earthed tray." },
  { k: "zero", n: "0 V of the 24 V supply not earthed (floating)", sig: "PLC input voltage – sensor OFF (V)", T: 50, tu: "ms", y: [0, 25], th: [15, 5], thl: "IEC 61131-2 type 1: ON ≥ 15 V, OFF ≤ 5 V",
    g: (t, fx) => { if (fx) return 0.15 + 0.1 * (hsh(Math.floor(t * 40)) - 0.5); const k = Math.floor(t * 1.2), sp = hsh(k) > 0.45 ? 12 * Math.exp(-((t * 1.2 - k) * 25)) : 0; return 7 + 4.5 * Math.sin(2 * Math.PI * 0.05 * t) + 1.2 * (hsh(Math.floor(t * 30)) - 0.5) + sp; },
    path: "capacitive: the floating 0 V takes any potential through the stray capacitance of the power supply and the cables; an earth fault is not detected.",
    sym: "Random PLC input (door 'closed' flickers, unexpected step in the sequence), inputs ON without a sensor; a second earth fault can switch an output ON (danger).",
    meas: "Multimeter 0 V → PE: should be 0 V (one link). Oscilloscope on the input vs 0 V and vs PE. Insulation monitor shows the fault.",
    fix: "PELV: earth the 0 V at ONE point (link terminal at the power supply); one 0 V reference per cabinet; separate 0 V return wires, never use PE as return." },
  { k: "net", n: "Network cable along the spindle motor cable", sig: "PROFINET frames received per 10 ms (%)", T: 2, tu: "s", y: [0, 110], th: [70], thl: "≈ watchdog: 3 lost cycles in a row → device failure",
    g: (t, fx) => { if (fx) return 100; const ph = t % 0.7; if (ph > 0.12 && ph < 0.3) { const v = 100 - 95 * hsh(Math.floor(t * 120)); return Math.max(0, v); } return 100 - (hsh(Math.floor(t * 120)) > 0.97 ? 15 : 0); },
    path: "capacitive + inductive coupling of the PWM edges into the network pairs over a long parallel run; a broken shield contact in the RJ45 makes it worse.",
    sym: "Network dropouts: 'PROFINET device failure', 'EtherCAT working counter error', I/O lost → machine stops, especially when the spindle runs up.",
    meas: "Network diagnostics: port statistics (CRC errors, lost frames) in the PLC / managed switch; certification tester for the cable (NEXT, return loss, shield continuity).",
    fix: "Separate the network ≥ 300 mm from motor cables or use a divider; industrial shielded Cat 5e/6 (PROFINET type B), shielded connectors on both ends, cross at 90°; fibre for long runs." },
  { k: "analog", n: "Long unshielded analog cable (4–20 mA / ±10 V)", sig: "Coolant pressure reading (bar)", T: 1, tu: "s", y: [0, 5], th: [2], thl: "low-pressure alarm 2.0 bar (example)",
    g: (t, fx) => { if (fx) return 3 + 0.02 * Math.sin(2 * Math.PI * 1.3 * t); const k = Math.floor(t * 25), sp = hsh(k) > 0.8 ? -1.6 * hsh(k + 1) * Math.exp(-((t * 25 - k) * 8)) : 0; return 3 + 0.45 * Math.sin(2 * Math.PI * 50 * t) + 0.25 * (hsh(Math.floor(t * 600)) - 0.5) + sp; },
    path: "inductive (loop between the two separated wires) + capacitive coupling from neighbouring power cables; no twisting, no shield.",
    sym: "Noisy / jumping analog values, false 'low coolant pressure' alarms; on older machines with ±10 V speed reference: speed ripple → surface finish marks.",
    meas: "Oscilloscope at the analog input (AC coupling): 50 Hz and spikes. Compare with a hand-held calibrator at the transmitter.",
    fix: "Shielded twisted pair, shield on the analog input side (or both ends + bonding conductor), away from power, input filter in the PLC (e.g. 50 Hz suppression); 4–20 mA instead of 0–10 V." },
];

/* ------------------------------------------------------------------ SVG helpers */
function cmSvg() {
  const t = (x, y, s, c = "ie-t3", a = "start") => `<text x="${x}" y="${y}" class="${c}" text-anchor="${a}">${s}</text>`;
  let s = "";
  s += `<rect x="20" y="40" width="170" height="90" rx="4" class="ie-box"/>${t(105, 60, "drive (inverter)", "ie-t1", "middle")}${t(105, 78, "DC bus 565 V", "ie-t3", "middle")}${t(105, 94, "IGBT edges t_r 100–300 ns", "ie-t3", "middle")}`;
  s += `<path d="M54,120 l10,-14 h10 l10,14 h10 l10,-14 h10 l10,14" class="ie-w ie-pwm"/>`;
  s += `<path d="M190,70 H560" class="ie-w ie-cab"/><path d="M190,80 H560" class="ie-w ie-cab"/><path d="M190,90 H560" class="ie-w ie-cab"/>`;
  s += `<path d="M190,62 H560 M190,98 H560" class="ie-w ie-shield"/>${t(200, 52, "shielded motor cable, C' ≈ 0.2 nF/m cores → shield (example)")}`;
  for (let x = 240; x <= 520; x += 56) s += `<path d="M${x},90 v8" class="ie-w ie-capl"/><path d="M${x - 5},94 h10 M${x - 5},97 h10" class="ie-w"/>`;
  s += `<circle cx="610" cy="80" r="40" class="ie-box"/>${t(610, 84, "motor", "ie-t1", "middle")}${t(658, 132, "winding → frame ≈ 1 nF", "ie-t3")}`;
  s += `<path d="M560,98 H585" class="ie-w ie-shield"/>`;
  s += `<path d="M610,120 V180 H105 V130" class="ie-w ie-cm"/>${t(357, 200, "common-mode current returns over shield + PE (good) – or over the machine frame, signal shields, network (bad)", "ie-t3 ie-tcm", "middle")}`;
  s += `<path d="M420,62 q0,-36 40,-36" class="ie-w ie-cm"/>${t(466, 30, "I_cm = C · dv/dt", "ie-t1")}`;
  s += `<rect x="700" y="40" width="190" height="70" rx="4" class="ie-box ie-dash"/>${t(795, 62, "encoder / sensor / network", "ie-t2", "middle")}${t(795, 80, "victim: coupling by C (capacitive)", "ie-t3", "middle")}${t(795, 96, "and M (inductive, loop area)", "ie-t3", "middle")}`;
  s += `<path d="M650,80 H700" class="ie-w ie-cm ie-dashl"/>`;
  return `<svg class="ie-svg ie-mid" viewBox="0 0 900 210" role="img" aria-label="Common-mode current path of a drive">${s}</svg>`;
}
function shieldSvg() {
  const t = (x, y, s, c = "ie-t3", a = "start") => `<text x="${x}" y="${y}" class="${c}" text-anchor="${a}">${s}</text>`;
  let s = "";
  // pigtail
  s += t(20, 20, "✗ pigtail: shield twisted to a wire", "ie-t1 ie-tbad");
  s += `<path d="M20,60 H170" class="ie-w ie-cab2"/><path d="M20,52 H150 M20,68 H150" class="ie-w ie-shield"/><path d="M150,52 q20,10 0,16" class="ie-w ie-shield"/>`;
  s += `<path d="M150,68 q10,20 -10,40 q-10,10 10,22" class="ie-w ie-shield"/><path d="M110,140 H210" class="ie-w ie-plate"/>${t(118, 158, "mounting plate / PE")}${t(170, 112, "50 mm ≈ 50 nH → 3 Ω at 10 MHz")}`;
  // 360
  s += t(470, 20, "✓ 360° clamp on bare metal", "ie-t1 ie-tok");
  s += `<path d="M470,60 H700" class="ie-w ie-cab2"/><path d="M470,52 H640 M470,68 H640" class="ie-w ie-shield"/><rect x="560" y="46" width="30" height="28" rx="3" class="ie-box ie-clamp"/><path d="M575,74 V140" class="ie-w ie-plate"/><path d="M520,140 H660" class="ie-w ie-plate"/>${t(590, 100, "clamp all around: < 1 nH, mΩ")}${t(528, 158, "bare plate (no paint)")}`;
  // cabinet zoning
  s += `<rect x="760" y="10" width="290" height="160" rx="4" class="ie-box"/>${t(905, 28, "EMC zones in the cabinet", "ie-t1", "middle")}`;
  s += `<rect x="772" y="38" width="80" height="120" class="ie-box ie-zd"/>${t(812, 56, "dirty", "ie-t2", "middle")}${t(812, 72, "line filter", "ie-t3", "middle")}${t(812, 88, "drives", "ie-t3", "middle")}${t(812, 104, "motor cables", "ie-t3", "middle")}${t(812, 120, "brake res.", "ie-t3", "middle")}`;
  s += `<path d="M862,38 V158" class="ie-w ie-div"/>`;
  s += `<rect x="872" y="38" width="80" height="120" class="ie-box ie-zc"/>${t(912, 56, "clean", "ie-t2", "middle")}${t(912, 72, "CNC / PLC", "ie-t3", "middle")}${t(912, 88, "24 V PSU", "ie-t3", "middle")}${t(912, 104, "I/O, network", "ie-t3", "middle")}`;
  s += `<rect x="962" y="38" width="78" height="120" class="ie-box"/>${t(1001, 56, "entry", "ie-t2", "middle")}${t(1001, 72, "filter at", "ie-t3", "middle")}${t(1001, 88, "the entry,", "ie-t3", "middle")}${t(1001, 104, "in ≠ out", "ie-t3", "middle")}${t(1001, 120, "cables apart", "ie-t3", "middle")}`;
  return `<svg class="ie-svg ie-mid" viewBox="0 0 1060 175" role="img" aria-label="Pigtail versus 360 degree clamp and cabinet zones">${s}</svg>`;
}
function traySvg(T, chk) {
  const x0 = 100, px = 1.2, sp = TRAY.pitch * px, yb = 230, wall = 120;
  const t = (x, y, s, c = "ie-t3", a = "start") => `<text x="${x}" y="${y}" class="${c}" text-anchor="${a}">${s}</text>`;
  let s = `<path d="M${x0},${yb - wall} V${yb} H${x0 + TRAY.width * px} V${yb - wall}" class="ie-w ie-trayw"/>`;
  for (let x = x0 + 20; x < x0 + TRAY.width * px; x += 30) s += `<rect x="${x}" y="${yb + 2}" width="14" height="5" class="ie-perf"/>`;
  s += t(x0, yb + 64, `perforated cable tray ${TRAY.width} mm wide (earthed, joints bonded) · slot pitch ${TRAY.pitch} mm · click a boundary ┆ to add / remove an earthed steel divider`, "ie-t3");
  const at = {}; Object.entries(T.pos).forEach(([id, sl]) => (at[sl] = id));
  for (let b = 1; b < TRAY.slots; b++) {
    const x = x0 + b * sp, on = T.div.includes(b);
    s += `<g class="ie-dev" data-tdiv="${b}"><rect x="${x - 7}" y="${yb - wall}" width="14" height="${wall}" class="ie-hit"/>${on ? `<path d="M${x},${yb - wall + 8} V${yb}" class="ie-w ie-div"/>` : `<path d="M${x},${yb - 30} V${yb - 4}" class="ie-w ie-divoff"/>`}</g>`;
  }
  const failIds = new Set(); chk.fails.forEach((p) => { failIds.add(p.a.id); failIds.add(p.b.id); });
  for (let i = 0; i < TRAY.slots; i++) {
    const cx = x0 + (i + 0.5) * sp, id = at[i];
    if (id) {
      const c = TCABLES.find((q) => q.id === id), rr = Math.max(9, c.d * px / 2 + 2);
      s += `<g class="ie-dev" data-tslot="${i}"><circle cx="${cx}" cy="${yb - rr - 2}" r="${rr}" class="ie-cab-c ${CATS[c.cat].cls}${failIds.has(id) ? " ie-cfail" : ""}"/><text x="${cx}" y="${yb - rr + 2}" class="ie-t3 ie-tin" text-anchor="middle">${c.cat}</text>
        <text x="${cx}" y="${yb + 42}" class="ie-t3" text-anchor="middle">${id}</text></g>`;
    } else s += `<g class="ie-dev" data-tslot="${i}"><circle cx="${cx}" cy="${yb - 16}" r="12" class="ie-slot${T.selC ? " ie-slotsel" : ""}"/><text x="${cx}" y="${yb + 42}" class="ie-t3 ie-muted" text-anchor="middle">${i + 1}</text></g>`;
  }
  // failing pairs as arcs
  chk.fails.slice(0, 6).forEach((p, k) => {
    const xa = x0 + (T.pos[p.a.id] + 0.5) * sp, xb = x0 + (T.pos[p.b.id] + 0.5) * sp, y = yb - wall - 6 - k * 17;
    s += `<path d="M${xa},${yb - 40} V${y} H${xb} V${yb - 40}" class="ie-w ie-failarc"/><text x="${(xa + xb) / 2}" y="${y - 2}" class="ie-t3 ie-tbad" text-anchor="middle">${p.dist} &lt; ${p.req} mm</text>`;
  });
  return `<svg class="ie-svg ie-traysvg" viewBox="0 0 960 300" role="img" aria-label="Cable tray cross-section">${s}</svg>`;
}

/* ------------------------------------------------------------------ build */
export function build4(box) {
  const pre = TRAY_PRESETS[Q.get("ietray")] || TRAY_PRESETS.bad;
  const S = {
    n: { ...N4 }, tray: { pos: { ...pre.pos }, div: [...pre.div], selC: null },
    fault: FAULTS.some((x) => x.k === Q.get("iefault")) ? Q.get("iefault") : "pigtail", fix: Q.has("iefix"), phase: 0,
    l420: { Us: 24, Utx: 12, Rl: 250, A: 0.5 }, d24: { I: 2, L: 30, A: 0.75 },
  };
  box.innerHTML = `<div class="ie-wrap">
  ${card("ieCardNoise", "A · Why drives make noise – and how it reaches other cables", "PWM dv/dt · common-mode current · coupling paths · live calculator (example values)",
    `<div class="ie-sheet">${cmSvg()}</div>
     <div class="ie-grid2"><div>
      ${wwh({ what: "A servo or spindle drive switches the DC bus (565 V) to the motor with IGBTs, 8 000 times per second per phase, each edge in 100–300 ns. These steep edges (dv/dt) push current through every small capacitance: cable cores → shield, winding → motor frame, bearing.", why: "This high-frequency <b>common-mode current</b> must flow back to the drive. If its path is long or goes through signal shields, the frame or the network, it makes voltage drops and fields that disturb encoders, sensors, networks – and can damage bearings.", how: "Give the noise a short, planned way home: shielded motor cable with 360° clamps at both ends, symmetric PE, filter at the cabinet entry, meshed bonding; keep signal cables away (card B) and short loops.", check: "Clamp meter (HF) on PE / shields, oscilloscope with differential probe on signals, drive alarm history.", mistake: "Thinking 'earth' is a clean 0 V: at 10 MHz a 1 m earth wire has ≈ 1 µH = 60 Ω." })}
      <h3>Coupling paths (simple)</h3>
      ${tbl(["Path", "How", "Formula", "Remedy"], [["conductive", "common wire / earth impedance shared by noise and signal", "U = I · Z (Z = R + jωL)", "separate returns, star / mesh, short wide bonding"], ["capacitive (electric field)", "two cables close together, fast voltage change", "I = C · dv/dt", "distance, shield earthed, divider"], ["inductive (magnetic field)", "current change near a signal loop", "U = M · di/dt = A · dB/dt", "twisted pairs (small loop), distance, cross at 90°"], ["radiated", "cable acts as antenna at MHz (λ/4 at 30 MHz = 2.5 m)", "E ∝ I · f · l", "shields 360°, filters, closed cabinet"]], "ie-wrapt")}
     </div><div>
      <h3>Noise calculator ${ex()}</h3>
      <div class="ie-inputs" id="ieNIn">
        <label>DC bus ${num("ieNUdc", S.n.Udc, 5, 100, 1200, 60)} V</label><label>rise time t_r ${num("ieNtr", S.n.tr, 10, 20, 2000, 60)} ns</label>
        <label>cable C' ${num("ieNCpm", S.n.Cpm, 0.05, 0.01, 2, 56)} nF/m</label><label>motor cable ${num("ieNLm", S.n.Lm, 1, 1, 300, 56)} m</label>
        <label>winding C ${num("ieNCm", S.n.Cmot, 0.5, 0, 50, 56)} nF</label><label>f_PWM ${num("ieNf", S.n.fpwm, 1, 1, 32, 50)} kHz</label>
        <label>parallel length ${num("ieNl", S.n.l, 1, 1, 200, 56)} m</label><label>distance ${num("ieNr", S.n.rr * 1000, 10, 10, 2000, 60)} mm</label><label>victim loop width ${num("ieNw", S.n.w, 1, 0.5, 200, 56)} mm</label>
      </div>
      <div id="ieNOut"></div>
     </div></div>`)}

  ${card("ieCardSeg", "B · Cable categories, segregation and the cable tray – live checker", "IEC 61000-5-2 · EN 50174-2 · IEC 60204-1 §13 · drive makers' EMC guides · example distances",
    `<div class="ie-grid2"><div>
      <h3>Cable categories</h3>
      ${tbl(["Cat.", "Cables", "Noise", "Sensitivity"], [["<span class='ie-dot ie-cP'></span> P", "400 V supply, DOL motors, heaters", "medium (50 Hz field, switching)", "low"], ["<span class='ie-dot ie-cM'></span> M", "motor cables from drives (PWM)", "<b>very high</b> (dv/dt)", "low"], ["<span class='ie-dot ie-cC'></span> C", "24 V DC / 230 V AC control, valves, relays", "medium (coil kicks)", "medium"], ["<span class='ie-dot ie-cS'></span> S", "encoder, analog 4–20 mA / ±10 V, probes", "low", "<b>very high</b>"], ["<span class='ie-dot ie-cN'></span> N", "PROFINET / EtherCAT / Ethernet", "low", "high"]], "ie-wrapt")}
     </div><div>
      <h3>Minimum separation without divider (centre to centre, example)</h3>
      <div id="ieSepT"></div>
      <p class="ie-note">With an <b>earthed metal divider</b> (continuous, bonded at every joint) or separate metal trays the cables may be closer. Cross other categories at <b>90°</b>. In cable trays: noisy cables on one side, sensitive on the other, control in the middle. Several tray levels: power on top, signals at the bottom (or the order in the maker's guide). Always use the <b>larger</b> value of the drive / machine maker.</p>
      <h3>Coupling into the victim falls with distance</h3>
      <p class="ie-note">Inductive: M ∝ ln(1 + w/r) – doubling the distance r roughly halves the induced voltage for a small loop w. Capacitive: C ∝ 1/ln(2r/d) – also falls, and an earthed metal divider (or the earthed shield) catches almost all of the field. Card A calculates it.</p>
     </div></div>
     <h3>Place the cables of HMC-01 into the tray (cross-section)</h3>
     <div class="ie-row"><button class="btn" data-tpre="bad">as found (bad)</button> <button class="btn" data-tpre="good">good – with divider</button> <button class="btn" data-tpre="nodiv">good – by distance</button> <button class="btn" data-tpre="clear">empty tray</button></div>
     <div id="iePal" class="ie-pal"></div>
     <div class="ie-simwrap"><div class="ie-sheet" id="ieTray"></div><div id="ieTrayRes" class="ie-info"></div></div>
     ${wwh({ what: "Segregation = keeping cable categories apart in the tray, in the cabinet and in the machine, so that noisy cables (M, P) do not couple into sensitive ones (S, N).", why: "Coupling falls fast with distance (inductive ∝ ln(1 + w/r), capacitive ∝ 1/r). A metal divider earthed at both ends stops most of the field.", how: "Plan the tray layout on the drawing: one tray per category or dividers; motor cables of one machine together; signals on the opposite side; 90° crossings; no loops of spare length next to motor cables.", check: "Walk the tray route with the drawing; divider continuous at bends; tray earthed and bonded (≤ 0.1 Ω across joints, example).", mistake: "'There was space' – the network cable added later on top of the spindle cable." })}`)}

  ${card("ieCardShield", "C · Shielding, cabinet EMC zones, filters, ferrites, long motor cables", "IEC 61800-3 · IEC 60034-25 · IEC 61000-5-2 · drive maker's EMC guide",
    `<div class="ie-sheet">${shieldSvg()}</div>
     <div class="ie-grid2"><div>
      ${wwh({ what: "A shield works only if the HF current can flow on it back to its source with low impedance: 360° contact on bare metal at <b>both ends</b> (motor + drive) for motor and encoder cables.", why: "A pigtail has ≈ 1 nH per mm: 50 mm = 50 nH → X = 2π·f·L = 3.1 Ω at 10 MHz. 1 A of shield current then makes 3 V of noise right at the connector.", how: "EMC glands at the motor terminal box, shield clamps on the mounting plate directly at the drive; analog shields: at the input side (or both ends + bonding conductor 16 mm² parallel to the cable to carry the 50 Hz potential difference); metal connector shells.", check: "Visual: every shield clamped, no paint under clamps, no pigtails; HF clamp-meter reading on shields compared between axes.", mistake: "Shield cut back 20 cm and the cores run unshielded through the cabinet next to the PLC." })}
      <h3>Pigtail impedance ${ex()}</h3>
      <div class="ie-inputs"><label>pigtail length ${num("iePl", S.n.plen, 5, 0, 300, 56)} mm</label><label>frequency ${num("iePf", S.n.fsh, 1, 0.1, 100, 56)} MHz</label><label>shield current ${num("iePi", S.n.Ish, 0.1, 0, 20, 56)} A</label></div>
      <div id="iePigOut"></div>
      <h3>Long motor cables – reflected wave ${ex()}</h3>
      <div id="ieReflOut"></div>
     </div><div>
      <h3>Measures and when to use them</h3>
      ${tbl(["Measure", "What it does", "Use when"], [["EMC line filter (C2/C3)", "keeps drive noise out of the mains; leakage current mA (card 3D)", "always per maker; at the cabinet entry, on the bare plate, input and output cables apart"], ["shielded motor cable, symmetric 3-PE", "closes the HF loop on the shield; symmetric PE cancels the field", "every drive-fed motor (≥ 1.5 kW: symmetric 3+3 PE type)"], ["common-mode cores (ferrite / nanocrystalline)", "add impedance for I_cm, reduce bearing currents", "long cables, bearing damage, many axes"], ["dv/dt filter (output reactor)", "slows edges to ≈ 0.5–1 kV/µs, less peak voltage at the motor", "cable > 50–100 m (check maker), old motors"], ["sine filter (LC)", "almost sinusoidal motor voltage", "very long cables, standard motors, low noise"], ["ferrite on signal cables", "damps HF on sensor / USB / network leads", "retrofit fix, not as design"], ["flyback diode / RC on coils", "kills switch-off spikes", "every DC coil / AC coil (RC)"], ["separate 24 V 0 V reference, earthed once (PELV)", "defined potential, earth faults detected", "always"]], "ie-wrapt")}
      <p class="ie-note">Cabinet: drives and line filter on a <b>bare, zinc-plated mounting plate</b> (the HF reference), dirty and clean zones apart (≥ 200 mm or a metal wall), motor cables leave directly from the drive downwards, signal cables on the other side; doors bonded with braids; LED lights / fans outside the motor-cable area.</p>
     </div></div>`)}

  ${card("ieCardSignal", "D · Signal wiring – encoder, 24 V sensors, 4–20 mA, networks, fibre", "IEC 61131-2 · IEC 61784-5-3 (PROFINET installation) · IEC 61918 · example values",
    `<div class="ie-grid2"><div>
      ${tbl(["Signal", "Cable", "Rules", "Max length (example)"], [["encoder (RS-422, EnDat, serial)", "maker's cable: twisted pairs, pair + overall shield", "360° both ends, never extend with terminals, separate from motor cable (or hybrid cable from the maker)", "per maker, e.g. 50–100 m"], ["24 V sensor PNP 3-wire", "M12 4-pin, unshielded PUR", "brown +24 V, blue 0 V, black signal; 0 V return in the same cable; PNP = '1' when +24 V", "≈ 30 m (drop + noise)"], ["4–20 mA analog", "shielded twisted pair 2 × 0.5 mm²", "shield at input side (or both + bonding), loop budget below", "km (budget) – noise limits"], ["±10 V analog (old drives)", "shielded twisted pair", "differential input, short, avoid", "< 10–20 m"], ["PROFINET / EtherCAT", "Cat 5e shielded 4-wire (PROFINET type A fixed / B flexible / C high-flex), green", "max 100 m per link, bend radius ≥ 8–10 × D (fixed) / 15–20 × D (moving), shielded RJ45/M12 D-coded, no splices", "100 m copper"], ["between buildings / > 100 m / high-noise areas", "fibre: POF ≤ 50 m, PCF ≤ 100 m, multimode glass ≤ 2 km, single-mode ≫ 10 km", "no earth loop, immune to noise and lightning", "see left"]], "ie-wrapt")}
      ${wwh({ what: "The low-voltage side: encoders, sensors, analog signals, field buses – category S and N.", why: "They are the victims. One bad connector shield or a floating 0 V gives random faults that cost weeks.", how: "Use the maker's cables, twisted pairs, keep the 0 V of the 24 V system earthed at one point (PELV), return currents in the same cable, shielded connectors, certify network links.", check: "Network acceptance: link test (length, NEXT, shield continuity) with a certifier, PLC port diagnostics zero errors after 1 week.", mistake: "Using PE as the 0 V return of sensors – noise current of the drives then flows through the signal reference." })}
     </div><div>
      <h3>4–20 mA loop budget ${ex()}</h3>
      <div class="ie-inputs"><label>supply ${num("ieLUs", S.l420.Us, 1, 12, 36, 50)} V</label><label>transmitter min. ${num("ieLUt", S.l420.Utx, 0.5, 5, 30, 50)} V</label><label>input resistor ${num("ieLRl", S.l420.Rl, 10, 0, 1000, 56)} Ω</label><label>wire ${num("ieLA", S.l420.A, 0.25, 0.14, 2.5, 56)} mm²</label></div>
      <div id="ieL420"></div>
      <h3>24 V voltage drop to a sensor / valve group ${ex()}</h3>
      <div class="ie-inputs"><label>current ${num("ieDI", S.d24.I, 0.1, 0.1, 20, 50)} A</label><label>length ${num("ieDL", S.d24.L, 1, 1, 200, 50)} m</label><label>wire ${num("ieDA", S.d24.A, 0.25, 0.25, 6, 50)} mm²</label></div>
      <div id="ieD24"></div>
      <p class="ie-note"><b>Separate 24 V 0 V reference:</b> the CNC and the robot cell each have their own 24 V supply with 0 V earthed at ONE point in their cabinet. Signals between them go via potential-free relay contacts or opto-couplers (not by connecting the two 0 V). This avoids ground-loop currents through the 0 V wires.</p>
     </div></div>`)}

  ${card("ieCardSim", "E · Fault simulator – pick a wiring mistake, see the symptom, apply the fix", "simulated oscilloscope trace (one axis) · simplified physics · example values",
    `<div class="ie-row" id="ieFaultSel"></div>
     <div class="ie-simwrap"><div><canvas id="ieScope" class="ie-scope" height="280" aria-label="Simulated scope trace"></canvas>
       <div class="ie-row"><button class="btn primary" id="ieFixBtn"></button> <span id="ieSimChip"></span></div></div>
       <div class="ie-info" id="ieSimInfo"></div></div>`)}

  ${card("ieCardTrouble", "F · Troubleshooting – symptom → likely cause → measurement → fix", "start with the cheapest measurement · log what you change",
    `${tbl(["Symptom on the machine", "Likely cause", "Measurement", "Fix"], [
      ["encoder alarm at high speed / spindle run-up", "encoder shield on pigtail, motor + encoder in one tray, connector shell loose", "oscilloscope + differential probe on the encoder pair at the drive; HF clamp on shield", "360° clamps, separate routing, maker's cable"],
      ["following-error spikes, marks on the surface", "coupling into encoder / scale cable, PE loop", "CNC servo trace of following error + spindle load; check timing", "segregation, divider, bonding conductor"],
      ["random PLC input / sequence step", "0 V floating, missing flyback diode, input cable next to motor cable", "multimeter 0 V–PE; scope on input; check diode", "earth 0 V once (PELV), diodes / RC, re-route"],
      ["network dropouts, 'device failure'", "network along motor cable, bad RJ45 shield, > 100 m, unmanaged switch", "port statistics (CRC, lost frames), cable certifier", "re-route ≥ 300 mm, industrial cable + connectors, fibre"],
      ["analog value jumps, false alarms", "unshielded analog, shield both ends without bonding, PE loop", "scope at the input, clamp meter on the shield (50 Hz)", "shielded twisted pair, shield at input side, 4–20 mA"],
      ["bearing noise after months (fluting)", "bearing currents from common-mode voltage, no symmetric PE, no CM cores", "shaft-voltage probe + scope; vibration spectrum (bearing frequencies)", "CM cores, symmetric shielded cable, shaft grounding ring / insulated bearing"],
      ["RCD trips at power-on / randomly", "EMC filter leakage, wrong RCD type", "leakage clamp on all lines together (residual)", "no 30 mA RCD on drives; type B ≥ 300 mA if needed"],
      ["neighbour machine / radio disturbed", "no line filter, filter on painted plate, in/out cables together", "spectrum or HF clamp on the supply cable", "filter at the entry, bare plate, cables apart"],
      ["warm PE / shield, 50 Hz hum", "N–PE link in a sub-board (neutral current on PE), PE loop", "clamp meter on PE and N at each board", "remove the second N–PE link (TN-S!), bonding conductor"],
      ["drive DC-bus under-voltage alarm at spindle acceleration", "voltage drop / weak supply, high THDu", "power analyser at the machine during acceleration", "bigger cable, check transformer tap, reactors"],
    ], "ie-wrapt")}
    <p class="ie-note"><b>Instruments:</b> leakage clamp meter (mA, also HF-capable for common-mode current), oscilloscope with <b>differential</b> probe (never 'float' a scope by removing its PE!), power analyser (IEC 61000-4-30), network diagnostics / cable certifier, shaft-voltage probe. Change one thing at a time and write down the result.</p>`)}
  </div>`;

  /* ---------------- renderers */
  function renderNoise() {
    const R = noise(S.n);
    const p = R.p;
    $("ieNOut").innerHTML = tbl(["Quantity", "Formula with numbers", "Result"], [
      ["edge steepness", `dv/dt = U_DC / t_r = ${p.Udc} V / ${p.tr} ns`, `<b>${f(R.dvdt_kVus, 2)} kV/µs</b>`],
      ["common-mode capacitance", `C = C'·L + C_w = ${p.Cpm} × ${p.Lm} + ${p.Cmot}`, `${f(R.C_nF, 2)} nF`],
      ["common-mode current peak", `I_cm = C · dv/dt = ${f(R.C_nF, 2)} nF × ${f(R.dvdt_kVus, 2)} kV/µs`, `<b>${f(R.Icm, 1)} A</b> (upper estimate)`],
      ["number of edges", `6 × f_PWM = 6 × ${p.fpwm} kHz`, `${R.edges.toLocaleString("en")} pulses / s`],
      ["mutual inductance to a victim loop", `M = μ0/(2π) · l · ln((r + w)/r) = 2·10⁻⁷ × ${p.l} × ln((${f(p.rr * 1000, 0)} + ${p.w})/${f(p.rr * 1000, 0)})`, `${f(R.M_nH, 1)} nH`],
      ["induced spike in the victim", `U = M · di/dt = ${f(R.M_nH, 1)} nH × ${f(R.Icm, 1)} A / ${p.tr} ns`, `<b>${f(R.Uind, 2)} V</b> ${R.Uind > 1 ? warn("disturbs RS-422 / analog") : ok(true, "small")}`],
      ["capacitive current next to an UNSHIELDED motor cable", `I = C_c · dv/dt = ${p.Cc} pF/m × ${p.l} m × ${f(R.dvdt_kVus, 2)} kV/µs`, `${f(R.Icap * 1000, 0)} mA peak`],
    ]) + `<p class="ie-note">Try: distance 100 → 300 mm, loop width 10 → 1 mm (twisted pair), rise time 200 → 100 ns. The real peak is lower than C·dv/dt (cable inductance spreads the edge) – measured common-mode peaks of 2–20 A are common.</p>`;
    $("iePigOut").innerHTML = `<p>L = 1 nH/mm × ${p.plen} mm = ${p.plen} nH → X = 2π · f · L = 2π × ${p.fsh} MHz × ${p.plen} nH = <b>${f(R.Zpig, 2)} Ω</b> → U = I · X = ${p.Ish} A × ${f(R.Zpig, 2)} Ω = <b>${f(R.Upig, 2)} V</b> of noise at the connector. A 360° clamp (≈ 0.5 nH) gives ≈ ${f(2 * Math.PI * p.fsh * 1e6 * 0.5e-9 * p.Ish * 1000, 0)} mV.</p>`;
    $("ieReflOut").innerHTML = `<p>Critical length l_c = v · t_r / 2 = 150 m/µs × ${p.tr} ns / 2 = <b>${f(R.lc, 1)} m</b>. Motor cable ${p.Lm} m ${p.Lm > R.lc ? "&gt;" : "&lt;"} l_c → peak at the motor U_pk ≈ U_DC · (1 + Γ·min(1, L/l_c)) = ${p.Udc} × (1 + ${p.gamma} × ${f(Math.min(1, p.Lm / R.lc), 2)}) = <b>${f(R.Upk, 0)} V</b> ${R.Upk > 1000 ? warn("check motor insulation") : ok(true)}.</p>
      <p class="ie-note">Standard 400 V motors are made for about 1 000–1 350 V peak (IEC 60034-25 / TS 60034-17, check the motor maker); inverter-duty motors ≥ 1 500 V. Long cables → dv/dt filter or sine filter; also more leakage current (C' · L) and drive over-current alarms.</p>`;
  }
  function renderSepT() {
    const o = "PMCSN";
    $("ieSepT").innerHTML = tbl(["", ...o.split("")], o.split("").map((a) => [`<b>${a}</b>`, ...o.split("").map((b) => { const v = sepReq(a, b); return v ? `${v} mm` : "0"; })]));
  }
  function renderTray() {
    const T = S.tray, chk = checkTray(T.pos, T.div);
    const unplaced = TCABLES.filter((c) => T.pos[c.id] == null);
    $("iePal").innerHTML = unplaced.length ? `<span class="muted">Not placed – click one, then an empty slot:</span> ` + unplaced.map((c) => `<button class="ie-chipbtn${T.selC === c.id ? " ie-act" : ""}" data-tcab="${c.id}"><span class="ie-dot ${CATS[c.cat].cls}"></span>${c.id} · ${esc(c.n)}</button>`).join("") : `<span class="muted">All cables placed. Click a cable in the tray to take it out (then place it again).</span>`;
    $("ieTray").innerHTML = traySvg(T, chk);
    const legend = TCABLES.filter((c) => T.pos[c.id] != null).map((c) => `<span class="ie-leg"><span class="ie-dot ${CATS[c.cat].cls}"></span><b>${c.id}</b> ${esc(c.n)}</span>`).join(" ");
    let res;
    if (chk.placed < 2) res = `<p class="muted">Place at least two cables.</p>`;
    else if (!chk.fails.length) res = `<p>${ok(true, "PASS")} ${chk.pairs.length} pairs with a separation rule are all OK (by distance or by an earthed divider). ${chk.placed < TCABLES.length ? `<span class="muted">${TCABLES.length - chk.placed} cable(s) not placed yet.</span>` : ""}</p>`;
    else {
      const keys = [...new Set(chk.fails.map((x) => pairKey(x.a.cat, x.b.cat)))];
      res = `<p>${ok(false, "FAIL")} <b>${chk.fails.length}</b> of ${chk.pairs.length} pairs too close (no divider between):</p>
        <div class="table-wrap"><table class="ie-tbl"><thead><tr><th>Pair</th><th>Distance</th><th>Needed</th></tr></thead><tbody>${chk.fails.map((x) => `<tr><td><b>${x.a.id}</b> (${x.a.cat}) ↔ <b>${x.b.id}</b> (${x.b.cat})</td><td>${x.dist} mm</td><td>≥ ${x.req} mm</td></tr>`).join("")}</tbody></table></div>
        <p><b>Why it matters:</b></p><ul class="ie-ul">${keys.map((k) => `<li><b>${k[0]} ↔ ${k[1]}:</b> ${esc(WHYPAIR[k] || "")}</li>`).join("")}</ul>
        <p><b>Fix:</b> move the cables apart (≥ the needed distance) or click a boundary to put an earthed steel divider between them.</p>`;
    }
    $("ieTrayRes").innerHTML = res + `<div class="ie-legrow">${legend}</div>`;
  }
  function renderSignal() {
    const L = loop420(S.l420.Us, S.l420.Utx, S.l420.Rl, S.l420.A), D = drop24(S.d24.I, S.d24.L, S.d24.A);
    $("ieL420").innerHTML = `<p>R_max = (U_s − U_tx,min) / 20 mA = (${S.l420.Us} − ${S.l420.Utx}) / 0.02 = ${f(L.Rmax, 0)} Ω → for the cable: ${f(L.Rmax, 0)} − ${S.l420.Rl} = <b>${f(L.Rcable, 0)} Ω</b> · loop resistance 2 × 0.0178 / ${S.l420.A} = ${f(L.rpm, 4)} Ω/m → max length ≈ <b>${L.Lmax > 0 ? f(L.Lmax, 0) + " m" : "not possible"}</b>. ${L.Lmax > 0 ? "Length is rarely the limit – noise is (shield, twisting, routing)." : warn("supply too low")}</p>`;
    $("ieD24").innerHTML = `<p>ΔU = 2 · I · L / (κ · A) = 2 × ${S.d24.I} × ${S.d24.L} / (56 × ${S.d24.A}) = <b>${f(D.dU, 2)} V</b> → U at the load = ${f(D.Uend, 2)} V ${ok(D.ok, "≥ 21.6 V OK", "< 21.6 V – bigger wire / local supply")} (target ≥ 21.6 V = 24 V − 10 %; IEC 61131-2 range 19.2–30 V incl. ripple).</p>`;
  }
  /* ---------------- fault simulator */
  const cv = () => $("ieScope");
  function renderFaultSel() {
    $("ieFaultSel").innerHTML = `<span class="seg ie-segwrap">${FAULTS.map((x) => `<button class="seg-btn${x.k === S.fault ? " active" : ""}" data-iefault="${x.k}">${esc(x.n)}</button>`).join("")}</span>`;
    const F = FAULTS.find((x) => x.k === S.fault);
    $("ieFixBtn").textContent = S.fix ? "Undo fix (show the fault again)" : "Apply the fix";
    $("ieSimChip").innerHTML = S.fix ? `<span class="ie-st ie-ok">FIXED – machine OK</span>` : `<span class="ie-st ie-bad">FAULT – ${esc(F.sym.split(/[;(]/)[0])}</span>`;
    $("ieSimInfo").innerHTML = `<h3>${esc(F.n)}</h3><p><b>Machine shows:</b> ${esc(F.sym)}</p><p><b>Coupling path:</b> ${esc(F.path)}</p><p><b>Measure:</b> ${esc(F.meas)}</p><p><b>Fix:</b> ${esc(F.fix)}</p><p class="muted">Trace: ${esc(F.sig)} – simplified, example values.</p>`;
    drawScope();
  }
  function cssv(n, fb) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb; }
  function drawScope() {
    const c = cv(); if (!c || !c.offsetParent) return;
    const F = FAULTS.find((x) => x.k === S.fault), dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth, H = 280;
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const L = 58, Rm = 26, T = 18, B = 26, pw = W - L - Rm, ph = H - T - B;
    const [y0, y1] = F.y, Y = (v) => T + ph - (v - y0) / (y1 - y0) * ph, X = (t) => L + t / F.T * pw;
    g.font = "11px system-ui, sans-serif"; g.lineWidth = 1;
    g.strokeStyle = cssv("--grid", "#ddd"); g.fillStyle = cssv("--text-2", "#555");
    for (let i = 0; i <= 5; i++) { const v = y0 + (y1 - y0) * i / 5, y = Y(v); g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); g.textAlign = "right"; g.fillText((Math.abs(v) < 1e-9 ? 0 : +v.toFixed(1)).toString(), L - 6, y + 4); }
    for (let i = 0; i <= 10; i++) { const x = L + pw * i / 10; g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke(); if (i % 2 === 0) { g.textAlign = "center"; g.fillText(+(F.T * i / 10).toFixed(2) + " " + F.tu, x, T + ph + 16); } }
    g.textAlign = "left"; g.fillText(F.sig, L + 4, T - 4 + 0);
    g.strokeStyle = cssv("--critical", "#d03b3b"); g.setLineDash([5, 4]);
    F.th.forEach((v) => { g.beginPath(); g.moveTo(L, Y(v)); g.lineTo(L + pw, Y(v)); g.stroke(); });
    g.setLineDash([]);
    if (F.thl) { g.fillStyle = cssv("--critical", "#d03b3b"); g.textAlign = "right"; g.fillText(F.thl, L + pw - 4, T - 5); }
    g.strokeStyle = S.fix ? cssv("--good", "#0ca30c") : cssv("--accent", "#2a78d6"); g.lineWidth = 1.4; g.beginPath();
    const N = Math.max(400, Math.round(pw * 1.5)), off = S.phase * F.T;
    for (let i = 0; i <= N; i++) { const t = F.T * i / N; let v = F.g(t + off, S.fix); v = Math.max(y0, Math.min(y1, v)); const x = X(t), y = Y(v); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
  }
  let raf = 0, last = 0;
  function loop(ts) {
    raf = 0;
    if (box.hidden || !box.offsetParent) return;
    const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0; last = ts;
    S.phase = (S.phase + dt * 0.12) % 1000;
    drawScope();
    raf = requestAnimationFrame(loop);
  }
  function show() { if (!raf) { last = 0; raf = requestAnimationFrame(loop); } }
  function hide() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  /* ---------------- events */
  const nMap = { ieNUdc: "Udc", ieNtr: "tr", ieNCpm: "Cpm", ieNLm: "Lm", ieNCm: "Cmot", ieNf: "fpwm", ieNl: "l", ieNw: "w", iePl: "plen", iePf: "fsh", iePi: "Ish" };
  box.addEventListener("input", (e) => {
    const t = e.target, v = +t.value;
    if (nMap[t.id]) { if (!isNaN(v) && v >= 0) { S.n[nMap[t.id]] = v; renderNoise(); } return; }
    if (t.id === "ieNr") { if (v > 0) { S.n.rr = v / 1000; renderNoise(); } return; }
    if (t.id === "ieLUs" || t.id === "ieLUt" || t.id === "ieLRl" || t.id === "ieLA") { S.l420 = { Us: +$("ieLUs").value, Utx: +$("ieLUt").value, Rl: +$("ieLRl").value, A: +$("ieLA").value || 0.5 }; renderSignal(); return; }
    if (t.id === "ieDI" || t.id === "ieDL" || t.id === "ieDA") { S.d24 = { I: +$("ieDI").value, L: +$("ieDL").value, A: +$("ieDA").value || 0.75 }; renderSignal(); }
  });
  box.addEventListener("click", (e) => {
    const T = S.tray;
    const pr = e.target.closest("[data-tpre]");
    if (pr) { const k = pr.dataset.tpre; if (k === "clear") { T.pos = {}; T.div = []; } else { T.pos = { ...TRAY_PRESETS[k].pos }; T.div = [...TRAY_PRESETS[k].div]; } T.selC = null; renderTray(); return; }
    const cb = e.target.closest("[data-tcab]"); if (cb) { T.selC = T.selC === cb.dataset.tcab ? null : cb.dataset.tcab; renderTray(); return; }
    const sl = e.target.closest("[data-tslot]");
    if (sl) { const i = +sl.dataset.tslot, id = Object.keys(T.pos).find((k) => T.pos[k] === i);
      if (id) { delete T.pos[id]; T.selC = id; } else if (T.selC) { T.pos[T.selC] = i; T.selC = null; }
      renderTray(); return; }
    const dv = e.target.closest("[data-tdiv]");
    if (dv) { const b = +dv.dataset.tdiv; T.div = T.div.includes(b) ? T.div.filter((x) => x !== b) : T.div.concat([b]); renderTray(); return; }
    const fb = e.target.closest("[data-iefault]"); if (fb) { S.fault = fb.dataset.iefault; S.fix = false; renderFaultSel(); return; }
    if (e.target.closest("#ieFixBtn")) { S.fix = !S.fix; renderFaultSel(); }
  });
  window.addEventListener("resize", () => { if (!box.hidden) drawScope(); });
  window.addEventListener("themechange", () => drawScope());

  renderNoise(); renderSepT(); renderTray(); renderSignal(); renderFaultSel();
  return { S, show, hide, FAULTS, checkTray: () => checkTray(S.tray.pos, S.tray.div), drawScope, setFault: (k, fx) => { S.fault = k; S.fix = !!fx; renderFaultSel(); } };
}
