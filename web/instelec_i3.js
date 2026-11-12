/* INSTALLATION tab – item 3 "Electrical installation – supply, cables, protection, earthing" (UI).
 * Numbers: instelec_calc.js. Guide: docs/27_installation_electrical_emc.md (part A).
 * URL: &ieinfo=T1|Q0|MDB|SPD1|MET|Q1|W1|SD|SPD2|Q2|COMP|Q3|Q4|Qb|Wb|Lb (open an info box) · &iem=HMC-02 (select a machine)
 *      &iefeed=bus (busbar trunking feeder) · &iet=40 (ambient °C) · &ieks=0.8 · &ietrafo (machines with input transformer)
 *      &iecard=sld|calc|work|prot|rcd|pq|earth|conn|test|ask (scroll to a card)
 * All values are EXAMPLES. Real design + tests: qualified electrician (IEC 60364, IEC 60204-1, local rules, maker's manual).
 */
import { calcLine, DEF, LOADS, COMP, SIZES, R20, AMP, TAMB, kHot, XKM, harmonics, SPECTRA, unbalance, bestTap, leakage, U, U0, SQ3 } from "./instelec_calc.js";
import { $, Q, esc, f, kA, ok, warn, wwh, card, tbl, ex, seg, num, sel, infoHtml } from "./instelec_ui.js";

/* ------------------------------------------------------------------ info boxes of the single-line diagram */
const I = (t, w, r, y, c, fl) => ({ t, w, r, y, c, f: fl });
const brOf = (R, id) => R.br.find((b) => b.id === id) || (id === "COMP-1" ? R.comp : R.br[0]);
const INFO = {
  MV: I("Medium-voltage supply 20 kV + ring main unit -Q00", "The utility (or the factory's own MV ring) brings 20 kV to the transformer station. The ring main unit has load-break switches for the ring and a switch-fuse (or circuit breaker) for the transformer.",
    (R) => `S″k (MV) = ${R.p.SkQ} MVA → Z_Q = 1.1·U²/S″k = ${f(R.src.ZQ, 3)} mΩ (seen from 400 V)`, "The MV short-circuit power sets a small part of the fault current at 400 V. Ask the utility for S″k (min and max) and the protection settings.", "MV switching and tests only by authorised MV personnel. Ask the utility for: S″k, earthing system of the MV network, protection settings, metering point.", "Using a guessed S″k – ask the utility, it changes Ik and the breaker breaking capacity."),
  T1: I("-T1 distribution transformer 20/0.4 kV Dyn11", "Converts 20 kV to 400/230 V. D = delta on the MV side, yn = star with neutral brought out on the LV side (needed for TN-S), 11 = phase shift 330°.",
    (R) => `${R.p.trafoS} kVA, u_k = ${R.p.uk} %, P_k = ${f(R.src.Pk / 1000, 1)} kW · I_n = S/(√3·U) = ${f(R.src.InT, 0)} A · Z_T = u_k·U²/S = ${f(R.src.ZT, 2)} mΩ (R_T ${f(R.src.RT, 2)}, X_T ${f(R.src.XT, 2)} mΩ)`,
    "The transformer impedance limits the short-circuit current at the main board (Ik3 ≈ I_n/u_k). Dyn gives a solid neutral and Z0 ≈ Z1, so the earth-fault current is high – good for fast disconnection in TN-S.",
    "Tap changer set so that the LV no-load voltage is ≈ 400–410 V (taps ±2 × 2.5 % are switched OFF-load only). Oil level / temperature alarm, neutral earthing link.", "Tap left on a wrong step → machines see 380 V or 430 V; the CNC trips on under/over-voltage."),
  Q0: I("-Q0 main circuit breaker (ACB) of the main LV board", "Air circuit breaker with electronic trip unit (L = long time, S = short time, I = instantaneous, G = earth fault). Switches and protects the transformer LV side.",
    (R) => `1600 A (≥ transformer I_n ${f(R.src.InT, 0)} A), I_cu ≥ ${R.mdbIcu} kA (Ik3 at the MDB = ${kA(R.mdb.Ik3)}, peak ip = ${kA(R.mdb.ip)} ≤ n·I_cu, IEC 60947-2)`, "Protects the busbar and the transformer. Its S setting (short-time delay) gives selectivity to the outgoing feeders.", "Settings record (Ir, Isd, tsd, Ii, Ig) signed; trip test with the test kit; interlock with the MV switch.", "Factory default settings left → whole factory dark when one machine cable has a short circuit."),
  MET: I("MET – main earthing terminal (main earth bar)", "The one point where the transformer neutral (N–PE link, TN-S), the earth electrode / foundation earth mesh, the PE bars of the boards and the main bonding conductors (water, gas, steel structure, pipework) meet.",
    "Cu bar, e.g. 60 × 10 mm, with labelled, removable connections", "In TN-S, N and PE are connected at ONE point only (here). After this point N and PE run separately – no N–PE link anywhere else, otherwise neutral current flows on PE, shields and pipes (EMC problems, corrosion).",
    "Each connection labelled; earth resistance measured (disconnect the link for the measurement); N–PE link only here (check: with all loads on, current in the link = neutral current of the whole system).", "Second N–PE link in a sub-board (TN-C-S by mistake) → stray currents on PE, cable shields and pipes; RCDs trip."),
  MDB: I("MDB – main LV distribution board", "Type-tested switchgear assembly (IEC 61439-1/-2) with copper busbars, outgoing breakers for each sub-distribution, the compressor, other areas and the power-factor correction.",
    (R) => `busbar 1600 A, Ik3 = ${kA(R.mdb.Ik3)} → rated short-time current I_cw ≥ ${R.mdbIcu} kA, outgoing breakers I_cu ≥ ${R.mdbIcu} kA`, "All the factory's energy goes through here. The short-circuit rating must be ≥ the prospective Ik3, otherwise the board can explode in a fault.", "Type-test certificate (IEC 61439), torque marks on busbar joints, thermography under load after 1 month.", "Breakers with too small breaking capacity (e.g. 10 kA MCBs at a 24 kA busbar)."),
  SPD1: I("SPD type 1 (+2) at the main board", "Surge protective device: varistor / spark gap from each line to PE. Type 1 takes direct lightning current (10/350 µs), type 2 induced surges (8/20 µs).",
    "Type 1+2, I_imp 12.5 kA per pole (10/350), U_p ≤ 1.5 kV, with back-up fuse as per maker", "Needed at the service entrance if the building has a lightning protection system or overhead lines (IEC 60364-4-44 §443, -5-53 §534, IEC 62305). Protects all equipment from surges.", "Status window green; connection leads short: total length a + b ≤ 0.5 m (each 10 cm of wire adds ≈ 100 V at a surge); remote contact to the BMS.", "Long connection wires (1 m loop) → the protection level is 1 kV higher than on the label."),
  Q4: I("-Q4 power-factor correction (PFC), detuned 7 %", "Capacitor bank with series reactors (detuned to ≈ 189 Hz for 7 %) switched in steps by a controller to keep cos φ ≈ 0.95–0.98.",
    "e.g. 300 kvar in 6 steps, 7 % detuned (p = 7 %)", "Utilities charge reactive energy. Plain capacitors with many 6-pulse drives make a resonance with the transformer at the 5th/7th harmonic → overvoltage, capacitor failure. Detuned reactors avoid this.", "Harmonic measurement before choosing (power analyser); temperature; capacitor current per step.", "Plain (not detuned) capacitors in a factory full of drives → exploding capacitors, high THDu."),
  Q1: I("-Q1 feeder breaker MDB → SD-ML1", "Moulded-case circuit breaker for the machining-line sub-distribution.",
    (R) => `${R.feed.brk.type}, I_n = ${R.feed.brk.In} A (I_b of the line = ${f(R.line.Ib, 1)} A), I_sd = 10·I_n = ${R.feed.brk.Isd} A${R.feed.brk.tsd ? ", t_sd = 0.1 s" : ""}, I_cu ≥ ${R.mdbIcu} kA`,
    "Protects the feeder cable / busbar trunking against overload and short circuit. With an electronic trip unit (LSI) and short-time delay it waits for the machine breaker to clear a fault first (time selectivity).", "Settings match the selectivity study; earth-fault loop at SD-ML1 checked (I_k1 ≥ 1.2 · I_sd).", "Ir set to the frame size (e.g. 250 A) instead of the cable rating → cable not protected against overload."),
  W1: I("W1 feeder MDB → SD-ML1 (cable or busbar trunking)", "Option A: multi-core XLPE copper cable on the main tray. Option B: busbar trunking along the line with tap-off units – flexible when machines move.",
    (R) => `${esc(R.feed.txt)} · I_z = ${f(R.feed.Iz, 0)} A ≥ I_n ${R.feed.In} A · ΔU = ${f(R.feed.dU, 2)} % at I_b = ${f(R.line.Ib, 1)} A`,
    "Carries the whole line current. Busbar trunking: lower voltage drop, fast changes (tap-off boxes), but higher price for one fixed machine.", "Cable: bending radius, fixing every 0.5–1 m, fire stops at walls. Busbar: joint torque, IP rating, earth continuity of the housing.", "Cable sized for today's machines only – plan 20–30 % reserve for one more machine."),
  Q10: I("-Q10 main switch of SD-ML1", "Switch-disconnector (load-break, isolating) at the entry of the sub-distribution – no own protection (Q1 protects).",
    (R) => `${R.feed.In >= 200 ? 250 : R.feed.In} A, AC-23A, lockable in OFF`, "Isolates the whole line for work (lock-out / tag-out).", "Lockable handle, label, interlock with the door.", "Not lockable → somebody switches on during work."),
  SD: I("SD-ML1 sub-distribution of the machining line", "Board near the line (short machine cables) with one breaker per machine, SPD type 2, metering (energy per machine) and spare ways.",
    (R) => `Ik3 = ${kA(R.sd.Ik3)} → breakers I_cu ≥ ${R.sdIcu} kA · earth-fault current I_k1 = ${kA(R.sd.Ik1)} · Σ connected ${R.line.Sconn} kVA × k_s ${R.p.ks} = ${f(R.line.Sd, 1)} kVA`,
    "Close to the loads → short branch cables, less voltage drop, energy metering per machine for the MES (kWh per part).", "IEC 61439 test certificate, 20–30 % spare ways, thermography after 1 month.", "Board in the chip / coolant area without IP54 → contamination, tracking."),
  SPD2: I("SPD type 2 in SD-ML1", "Second stage of surge protection: needed when the distance to the type-1 SPD is > 10 m (IEC 60364-5-53) and for sensitive electronic loads.",
    "Type 2, I_n 20 kA (8/20), U_p ≤ 1.5 kV", "Coordinated with the type-1 SPD (cable length between them ≥ 10 m or maker's decoupling rule). Type 3 (U_p ≤ 1 kV) in the CNC cabinet near the control power supply if the maker asks.", "Status, short leads, back-up fuse.", "No SPD at the machine line → control boards / power supplies fail after thunderstorms."),
  Q2: I("-Q2 compressor feeder", "Feeds the screw compressor directly from the main board (compressor room).",
    (R) => `${R.comp.brk.txt}, cable ${R.comp.cable} ${R.comp.L} m, ΔU ${f(R.comp.dUt, 2)} %`, "Air is needed by every machine (clamping, tool change, air blast): its supply should not depend on the machining line board.", "Phase rotation (screw compressor must turn the right way – check before the first start!).", "Wrong phase rotation → the screw runs backwards, oil injection fails, damage in seconds."),
  COMP: I("COMP-1 screw compressor 22 kW (VSD)", "Variable speed drive → the compressor follows the air demand; VSD = 6-pulse drive with reactor or AFE (harmonics).",
    (R) => `connected ${COMP.S} kVA, I_b = ${f(R.comp.Ib, 1)} A`, "Large drive load: check harmonics and leakage (EMC filter).", "Rotation, pressure set point, condensate drain.", "—"),
  Q3: I("-Q3 … other distributions", "Assembly, test benches, paint shop, offices, lighting.", "examples – not calculated here", "The transformer feeds the whole factory; the machining line is one part.", "Load list of the whole factory → transformer size (with reserve).", "—"),
  Qb: I("Machine breaker in SD-ML1", "Protects the machine cable (overload + short circuit) and gives automatic disconnection in an earth fault (TN-S).",
    (R) => { const b = brOf(R, R.selM); return `${b.id}: ${b.brk.txt} · I_b ${f(b.Ib, 1)} A ≤ I_n ${b.In} A ≤ I_z ${f(b.Iz, 1)} A · I_cu ≥ ${R.sdIcu} kA`; },
    "Rule IEC 60364-4-43: I_b ≤ I_n ≤ I_z (and I_2 ≤ 1.45·I_z, fulfilled by breakers). The machine maker states the required fuse / breaker in the manual – use it.", "Rating = maker's manual; loop impedance measured at the machine; label 'HMC-01'.", "C-curve MCB for a machine with an input transformer → trips at every power-on (inrush)."),
  Wb: I("Machine cable", "Multi-core copper cable from SD-ML1 to the main switch of the machine, on the cable tray.",
    (R) => { const b = brOf(R, R.selM); return `${b.id}: ${b.cable} Cu ${R.p.ins}, ${b.L} m, method ${R.p.method}, I_z = ${b.Itab} A × ${f(b.f, 3)} = ${f(b.Iz, 1)} A, ΔU ${f(b.dUb, 2)} % (total ${f(b.dUt, 2)} %), sized by: ${b.by}`; },
    "Size by current (with derating), voltage drop and disconnection time – the biggest of the three wins.", "Insulation test 500 V DC ≥ 1 MΩ; PE continuity; bending radius ≥ 10 × D (example); cable glands with strain relief.", "Machine cable sized with the 'run' power 18 kW instead of the connected load 45 kVA – the maker's fuse then does not protect the cable."),
  Lb: I("Machine (load)", "The machine's main switch is the interface between building installation (electrician, IEC 60364) and machine (maker, IEC 60204-1).",
    (R) => { const b = brOf(R, R.selM); return `${b.n}: connected ${b.S} kVA, run ≈ ${b.P} kW, cos φ ${b.cos}, Ik3 at the terminals ${kA(b.Ik3)}, I_k1 ${kA(b.Ik1)}`; },
    "Connected load = sum of all drives and auxiliaries at the same time (name plate); the real average is much lower (run power).", "Voltage 400 V ± 10 %, phase sequence, unbalance ≤ 2 %, PE ≥ 10 mm² Cu (high leakage).", "Feeding a 200 V machine without setting its transformer tap → under-voltage alarms."),
};

/* ------------------------------------------------------------------ single-line diagram (SVG) */
const XS = [300, 440, 580, 720, 860, 1000, 1140];
function brk(x, y, key, lab, selK, right) {   // circuit breaker: box with ×
  return `<g class="ie-dev${selK === key ? " ie-on" : ""}" data-ie="${key}"><rect x="${x - 9}" y="${y}" width="18" height="22" rx="2" class="ie-box"/><path d="M${x - 6},${y + 5} L${x + 6},${y + 17} M${x + 6},${y + 5} L${x - 6},${y + 17}" class="ie-w"/>${lab ? `<text x="${right ? x + 14 : x - 14}" y="${y + 15}" class="ie-t2" text-anchor="${right ? "start" : "end"}">${lab}</text>` : ""}<rect x="${x - 40}" y="${y - 2}" width="80" height="26" class="ie-hit"/></g>`;
}
function earth(x, y) { return `<path d="M${x},${y} v8 M${x - 9},${y + 8} h18 M${x - 6},${y + 12} h12 M${x - 3},${y + 16} h6" class="ie-w"/>`; }
function sld(R, info) {
  const sk = info, b = (k) => (sk === k ? " ie-on" : "");
  const feedBus = R.p.feedType === "bus";
  let s = "";
  // MV + transformer
  s += `<path d="M420,6 V36" class="ie-w ie-mv"/><g class="ie-dev${b("MV")}" data-ie="MV"><rect x="406" y="36" width="28" height="18" class="ie-box"/><text x="420" y="49" class="ie-t3" text-anchor="middle">RMU</text><rect x="300" y="4" width="250" height="52" class="ie-hit"/></g>`;
  s += `<text x="446" y="20" class="ie-t2">20 kV utility, S″k = ${R.p.SkQ} MVA ${"(example)"}</text><path d="M420,54 V63" class="ie-w ie-mv"/>`;
  s += `<g class="ie-dev${b("T1")}" data-ie="T1"><circle cx="420" cy="80" r="17" class="ie-box"/><circle cx="420" cy="102" r="17" class="ie-box"/><rect x="398" y="60" width="300" height="62" class="ie-hit"/>
    <text x="446" y="80" class="ie-t1">-T1 ${R.p.trafoS} kVA 20/0.4 kV Dyn11</text><text x="446" y="96" class="ie-t2">u_k ${R.p.uk} % · I_n ${f(R.src.InT, 0)} A</text></g>`;
  // N–PE link to MET
  s += `<path d="M436,108 H760 V128" class="ie-w ie-pe"/><text x="560" y="104" class="ie-t3">N–PE link (one point, TN-S)</text>`;
  s += `<g class="ie-dev${b("MET")}" data-ie="MET"><rect x="720" y="128" width="80" height="16" class="ie-box ie-pebox"/><text x="760" y="140" class="ie-t3" text-anchor="middle">MET</text>${earth(760, 144)}<text x="776" y="162" class="ie-t3">earth mesh</text><rect x="712" y="124" width="100" height="44" class="ie-hit"/></g>`;
  s += `<path d="M420,119 V150" class="ie-w"/>` + brk(420, 150, "Q0", "-Q0 ACB 1600 A", sk) + `<path d="M420,172 V200" class="ie-w"/>`;
  // MDB busbar
  s += `<g class="ie-dev${b("MDB")}" data-ie="MDB"><path d="M60,200 H820" class="ie-bus"/><rect x="60" y="192" width="760" height="16" class="ie-hit"/></g>`;
  s += `<text x="62" y="186" class="ie-t1">MDB 400/230 V TN-S · Ik3 = ${kA(R.mdb.Ik3)}</text>`;
  // SPD1
  s += `<g class="ie-dev${b("SPD1")}" data-ie="SPD1"><path d="M100,200 V222" class="ie-w"/><rect x="88" y="222" width="24" height="22" class="ie-box"/><path d="M100,226 v10 l-4,-4 m4,4 l4,-4" class="ie-w"/>${earth(100, 244)}<text x="116" y="238" class="ie-t2">SPD T1+2</text><rect x="84" y="212" width="80" height="54" class="ie-hit"/></g>`;
  // outgoings MDB
  s += `<path d="M230,200 V222" class="ie-w"/>` + brk(230, 222, "Q1", `-Q1 ${R.feed.brk.In} A`, sk, true);
  if (feedBus) s += `<g class="ie-dev${b("W1")}" data-ie="W1"><path d="M226,244 V352 M234,244 V352" class="ie-w ie-busw"/><rect x="214" y="244" width="200" height="100" class="ie-hit"/></g>`;
  else s += `<g class="ie-dev${b("W1")}" data-ie="W1"><path d="M230,244 V352" class="ie-w ie-cab"/><rect x="214" y="244" width="200" height="100" class="ie-hit"/></g>`;
  s += `<text x="242" y="282" class="ie-t2">W1 ${esc(R.feed.txt)}</text><text x="242" y="298" class="ie-t2">I_z ${f(R.feed.Iz, 0)} A · ΔU ${f(R.feed.dU, 2)} %</text>`;
  s += `<g class="ie-dev${b("Q10")}" data-ie="Q10"><path d="M230,352 V362 M230,382 V400 M230,362 L240,380" class="ie-w"/><path d="M225,362 h10" class="ie-w"/><text x="244" y="376" class="ie-t2">-Q10 main switch</text><rect x="214" y="354" width="120" height="30" class="ie-hit"/></g>`;
  const cb = R.comp;
  s += `<path d="M430,200 V222" class="ie-w"/>` + brk(430, 222, "Q2", `-Q2 ${cb.In} A`, sk, true) + `<path d="M430,244 V300" class="ie-w ie-cab"/><text x="438" y="272" class="ie-t3">${cb.cable} · ${cb.L} m</text>`;
  s += `<g class="ie-dev${b("COMP")}" data-ie="COMP"><rect x="380" y="300" width="100" height="40" rx="4" class="ie-box"/><text x="430" y="316" class="ie-t1" text-anchor="middle">COMP-1</text><text x="430" y="331" class="ie-t3" text-anchor="middle">22 kW VSD</text></g>`;
  s += `<path d="M590,200 V222" class="ie-w"/>` + brk(590, 222, "Q3", "-Q3…", sk, true) + `<path d="M590,244 V300" class="ie-w"/>`;
  s += `<g class="ie-dev${b("Q3")}" data-ie="Q3"><rect x="530" y="300" width="120" height="40" rx="4" class="ie-box ie-dash"/><text x="590" y="316" class="ie-t2" text-anchor="middle">other areas</text><text x="590" y="331" class="ie-t3" text-anchor="middle">assembly · test · paint</text></g>`;
  s += `<path d="M740,200 V222" class="ie-w"/>` + brk(740, 222, "Q4", "", sk) + `<g class="ie-dev${b("Q4")}" data-ie="Q4"><path d="M740,244 V270 M740,286 V300 M726,270 h28 M726,286 h28 M740,300 q6,4 0,8 q-6,4 0,8 q6,4 0,8" class="ie-w"/><text x="760" y="282" class="ie-t2">PFC 7 % detuned</text><rect x="716" y="244" width="110" height="80" class="ie-hit"/></g>`;
  // SD busbar
  s += `<g class="ie-dev${b("SD")}" data-ie="SD"><path d="M150,400 H1175" class="ie-bus"/><rect x="150" y="392" width="1025" height="16" class="ie-hit"/></g>`;
  s += `<text x="380" y="392" class="ie-t1">SD-ML1 machining line · Ik3 ${kA(R.sd.Ik3)} · Ik1 ${kA(R.sd.Ik1)} · Σ ${R.line.Sconn} kVA × k_s ${R.p.ks} = ${f(R.line.Sd, 0)} kVA → I_b ${f(R.line.Ib, 0)} A</text>`;
  s += `<g class="ie-dev${b("SPD2")}" data-ie="SPD2"><path d="M180,400 V420" class="ie-w"/><rect x="168" y="420" width="24" height="22" class="ie-box"/><path d="M180,424 v10 l-4,-4 m4,4 l4,-4" class="ie-w"/>${earth(180, 442)}<text x="168" y="474" class="ie-t2">SPD T2</text><rect x="160" y="410" width="60" height="70" class="ie-hit"/></g>`;
  R.br.forEach((m, i) => {
    const x = XS[i], selM = R.selM === m.id, bad = !m.ok;
    s += `<path d="M${x},400 V418" class="ie-w"/>` + brk(x, 418, "Qb:" + m.id, "", sk && sk === "Qb:" + m.id ? sk : "");
    s += `<text x="${x + 13}" y="433" class="ie-t3">${m.In} A</text>`;
    s += `<g class="ie-dev${sk === "Wb:" + m.id ? " ie-on" : ""}" data-ie="Wb:${m.id}"><path d="M${x},440 V520" class="ie-w ie-cab"/><text x="${x + 6}" y="470" class="ie-t3">${m.cable}</text><text x="${x + 6}" y="484" class="ie-t3">${m.L} m</text><rect x="${x - 10}" y="442" width="60" height="76" class="ie-hit"/></g>`;
    s += `<g class="ie-dev ie-load${selM ? " ie-selm" : ""}${bad ? " ie-badm" : ""}${sk === "Lb:" + m.id ? " ie-on" : ""}" data-ie="Lb:${m.id}"><rect x="${x - 64}" y="520" width="128" height="84" rx="5" class="ie-box"/>
      <text x="${x}" y="538" class="ie-t1" text-anchor="middle">${m.id}</text><text x="${x}" y="553" class="ie-t3" text-anchor="middle">${m.S} kVA · ${m.P} kW run</text>
      <text x="${x}" y="568" class="ie-t3" text-anchor="middle">I_b ${f(m.Ib, 1)} A · ΔU ${f(m.dUt, 2)} %</text><text x="${x}" y="583" class="ie-t3" text-anchor="middle">Ik3 ${kA(m.Ik3)} · Ik1 ${kA(m.Ik1)}</text>
      <text x="${x}" y="598" class="ie-t3 ${bad ? "ie-tbad" : "ie-tok"}" text-anchor="middle">${bad ? "check!" : "OK"}</text></g>`;
  });
  s += `<text x="10" y="632" class="ie-t3">Example values · click a device (breaker, cable, board, machine) for its information · thick line = busbar · dashed green = PE / earthing · the real design is made by a qualified electrician</text>`;
  return `<svg class="ie-svg ie-sld" viewBox="0 0 1200 640" role="img" aria-label="Single-line diagram of the machining line supply">${s}</svg>`;
}

/* ------------------------------------------------------------------ TN-S earthing drawing */
function earthSvg() {
  const t = (x, y, s, c = "ie-t2", a = "start") => `<text x="${x}" y="${y}" class="${c}" text-anchor="${a}">${s}</text>`;
  let s = "";
  s += `<circle cx="70" cy="70" r="22" class="ie-box"/>${t(70, 75, "T1", "ie-t1", "middle")}${t(20, 110, "transformer Dyn11")}`;
  ["L1", "L2", "L3", "N"].forEach((n, i) => { s += `<path d="M92,${40 + i * 14} H880" class="ie-w ${n === "N" ? "ie-n" : ""}"/>${t(890, 44 + i * 14, n, "ie-t3")}`; });
  s += `<path d="M92,96 H880" class="ie-w ie-pe"/>${t(890, 100, "PE", "ie-t3")}`;
  s += `<path d="M110,82 V96" class="ie-w ie-pe"/><circle cx="110" cy="82" r="3" class="ie-dot"/>${t(120, 124, "N–PE link only here (at the MET)", "ie-t3")}`;
  s += `<path d="M110,96 V170" class="ie-w ie-pe"/><rect x="90" y="170" width="40" height="12" class="ie-box ie-pebox"/>${t(138, 181, "MET", "ie-t3")}`;
  // earth mesh
  s += `<path d="M40,240 H900 M40,270 H900" class="ie-w ie-pe ie-mesh"/>`;
  for (let x = 40; x <= 900; x += 60) s += `<path d="M${x},240 V270" class="ie-w ie-pe ie-mesh"/>`;
  s += t(40, 292, "foundation earth / meshed earth in the floor slab (e.g. 10 × 10 m … 5 × 5 m mesh, steel 30 × 3.5 mm or Cu 50 mm², bonded to the rebar)", "ie-t3");
  s += `<path d="M110,182 V240" class="ie-w ie-pe"/>`;
  // SD board
  s += `<rect x="300" y="110" width="80" height="40" class="ie-box"/>${t(340, 134, "SD-ML1", "ie-t1", "middle")}<path d="M340,96 V110" class="ie-w"/><path d="M340,150 V240" class="ie-w ie-pe"/>${t(346, 168, "PE bar", "ie-t3")}`;
  // machine
  s += `<rect x="520" y="120" width="150" height="70" rx="4" class="ie-box"/>${t(595, 146, "HMC-01", "ie-t1", "middle")}${t(595, 162, "PE terminal in cabinet", "ie-t3", "middle")}`;
  s += `<path d="M380,128 H520" class="ie-w ie-cab"/>${t(450, 122, "5G25 (PE inside)", "ie-t3", "middle")}`;
  s += `<path d="M600,190 V240" class="ie-w ie-pe"/>${t(594, 222, "machine base bonding 16–25 mm² Cu", "ie-t3", "end")}`;
  // tray, conveyor, pipe
  s += `<path d="M700,200 H860" class="ie-w ie-tray"/>${t(700, 194, "cable tray – bonded at every joint", "ie-t3")}<path d="M860,200 V240" class="ie-w ie-pe"/>`;
  s += `<rect x="720" y="120" width="70" height="30" class="ie-box"/>${t(755, 140, "conveyor", "ie-t3", "middle")}<path d="M720,135 H685 V240" class="ie-w ie-pe"/>`;
  s += `<path d="M190,215 H260" class="ie-w ie-pipe"/>${t(186, 208, "air / water pipe", "ie-t3")}<path d="M225,215 V240" class="ie-w ie-pe"/>`;
  s += `<g class="ie-x"><path d="M960,170 V250" class="ie-w ie-bad"/>${earth(960, 250)}${t(915, 160, "separate “clean earth” rod", "ie-t3 ie-tbad")}${t(915, 290, "✗ do NOT use", "ie-t3 ie-tbad")}</g>`;
  return `<svg class="ie-svg ie-mid" viewBox="0 0 1060 300" role="img" aria-label="TN-S earthing and bonding">${s}</svg>`;
}

/* ------------------------------------------------------------------ tests before first switch-on */
function testRows(R) {
  const b = brOf(R, R.selM);
  const feedPE = b.id === "COMP-1" ? 0 : (R.p.feedType === "bus" ? R.feed.RPE / 1000 : R20[SIZES.indexOf(R.feed.PE)] * R.p.feedL / 1000);   // Ω at 20 °C (busbar: data-sheet value)
  const RpeCalc = feedPE + b.RPE20;
  return [
    { k: "vis", s: "Visual inspection (dead): cable type + size = plan, glands, bending radius, torque marks, labels, PE green-yellow, SPD fitted, IP, no damage", std: "IEC 60364-6 §6.4.2", ins: "eyes, torque wrench, drawing", lim: "all OK", v: null },
    { k: "loto", s: "Lock-out / tag-out at -Q1 and -Q10, prove dead (test the voltage tester before and after)", std: "EN 50110-1", ins: "2-pole voltage tester (IEC 61243-3)", lim: "0 V all lines", v: null },
    { k: "pe", s: `PE continuity: PE bar MDB → PE terminal ${b.id} (incl. feeder PE)`, std: "IEC 60364-6 §6.4.3.2 · IEC 60204-1 §18.2", ins: "low-ohm meter ≥ 0.2 A (IEC 61557-4)", lim: `≤ ${f(RpeCalc * 1.5, 3)} Ω (1.5 × calculated ${f(RpeCalc, 3)} Ω)`, v: 0.046, unit: "Ω", fn: (v) => v <= RpeCalc * 1.5 },
    { k: "pe2", s: "PE continuity: machine base, cabinet doors, tray joints, conveyor frame → machine PE terminal", std: "IEC 60204-1 §18.2", ins: "low-ohm meter, 10 A for the machine", lim: "≤ 0.1 Ω each (example)", v: 0.03, unit: "Ω", fn: (v) => v <= 0.1 },
    { k: "ins", s: "Insulation resistance of the cable: L1, L2, L3, N → PE and between lines (drives, SPDs, filters disconnected)", std: "IEC 60364-6 §6.4.3.3 (Table 6.1)", ins: "insulation tester 500 V DC (IEC 61557-2)", lim: "≥ 1 MΩ (new cable: ≫ 100 MΩ)", v: 250, unit: "MΩ", fn: (v) => v >= 1 },
    { k: "ins2", s: "Insulation resistance of the machine power circuit (by the maker, all lines together → PE)", std: "IEC 60204-1 §18.3", ins: "500 V DC", lim: "≥ 1 MΩ", v: 18, unit: "MΩ", fn: (v) => v >= 1 },
    { k: "rot", s: "Phase sequence at the machine main switch = clockwise (L1-L2-L3)", std: "IEC 60364-6 §6.4.3.9", ins: "phase-sequence indicator (IEC 61557-7)", lim: "clockwise", v: null },
    { k: "volt", s: "Voltage L-L at the machine terminals (no load)", std: "IEC 60204-1 §4.3.2", ins: "multimeter CAT III 600 V", lim: "360–440 V (400 V ± 10 %)", v: 403, unit: "V", fn: (v) => v >= 360 && v <= 440 },
    { k: "npe", s: "Voltage N–PE at the machine (TN-S: N and PE separate)", std: "good practice", ins: "multimeter", lim: "< 2 V (example)", v: 0.4, unit: "V", fn: (v) => v < 2 },
    { k: "zs", s: `Loop impedance L–PE at the main switch of ${b.id}`, std: "IEC 60364-6 §6.4.3.6 · IEC 60364-4-41", ins: "loop tester (IEC 61557-3)", lim: `≤ ${f(0.8 * b.ZsMax / 1000, 3)} Ω (0.8 × Z_s,max ${f(b.ZsMax / 1000, 3)} Ω; calc. ${f(b.Zs / 1000, 3)} Ω)`, v: 0.105, unit: "Ω", fn: (v) => v <= 0.8 * b.ZsMax / 1000 },
    { k: "ipf", s: "Prospective fault current shown by the loop tester (U0 / Z_s)", std: "IEC 60364-4-41", ins: "loop tester", lim: `≥ I_a = ${f(b.Ia, 0)} A (instantaneous trip)`, v: 2200, unit: "A", fn: (v) => v >= b.Ia },
    { k: "rcd", s: "RCD of the socket / light circuit (30 mA type A): trip time at I_Δn", std: "IEC 60364-6 §6.4.3.7 · IEC 61557-6", ins: "RCD tester", lim: "≤ 300 ms (at 5·I_Δn ≤ 40 ms)", v: 24, unit: "ms", fn: (v) => v <= 300 },
    { k: "rcdi", s: "RCD trip current (ramp test)", std: "IEC 61008/61009", ins: "RCD tester", lim: "15–30 mA (0.5–1.0 × I_Δn)", v: 22, unit: "mA", fn: (v) => v >= 15 && v <= 30 },
    { k: "re", s: "Earth electrode / mesh resistance (link at the MET opened for the test)", std: "IEC 60364-6 §6.4.3.6.2", ins: "earth tester, fall-of-potential 62 % (IEC 61557-5)", lim: "≤ 2 Ω (example design value – utility / local rule)", v: 0.6, unit: "Ω", fn: (v) => v <= 2 },
    { k: "leak", s: `PE current of ${b.id} while running (clamp meter on the PE conductor)`, std: "IEC 61800-5-1 §4.3.5.5 · IEC 60204-1 §8.2.6", ins: "leakage clamp meter (mA range)", lim: "> 10 mA → PE ≥ 10 mm² Cu + label", v: 24, unit: "mA", fn: (v) => v <= 10 || b.PE >= 10 },
    { k: "pq", s: "Power analyser 1 week at SD-ML1: THDu (95 % of 10-min values)", std: "IEC 61000-4-30 class A · IEC 61000-2-4 class 2", ins: "3-phase power analyser", lim: "≤ 5 % (design goal; class 2 limit 8 %)", v: 3.1, unit: "%", fn: (v) => v <= 5 },
    { k: "ub", s: "Voltage unbalance (same record)", std: "IEC 61000-2-4 · IEC 60204-1 §4.3.2", ins: "power analyser", lim: "≤ 2 %", v: 0.6, unit: "%", fn: (v) => v <= 2 },
    { k: "fun", s: "Function: main switch locks in OFF, e-stop, phase-sequence relay, SPD status, then first power-on with the maker; records signed", std: "IEC 60204-1 §18.6 · IEC 60364-6 §6.4.3.10", ins: "test sheet", lim: "all OK", v: null },
  ];
}

/* ------------------------------------------------------------------ build */
export function build3(box) {
  const S = {
    p: { ...DEF }, lens: {}, selM: LOADS.some((l) => l.id === Q.get("iem")) ? Q.get("iem") : "HMC-01", info: Q.get("ieinfo") || "T1",
    pq: { tech: "reactor", other: 200 }, ub: [402, 398, 405], Umeas: 408, leak: { n: 3, mA: 6, cab: 10 }, tick: {}, val: {},
  };
  { const id = (S.info || "").split(":")[1]; if (id && LOADS.some((l) => l.id === id)) S.selM = id; }
  if (Q.get("iefeed") === "bus") S.p.feedType = "bus";
  if (Q.get("iet")) S.p.tAmb = +Q.get("iet");
  if (Q.get("ieks")) S.p.ks = +Q.get("ieks");
  if (Q.has("ietrafo")) S.p.trafoMach = true;
  let R = null;

  const opt = (a) => a.map((v) => [v, String(v)]);
  box.innerHTML = `<div class="ie-wrap">
  ${card("ieCardSld", "A · Single-line diagram – transformer → main board → line → machines", "click a device · live numbers from card B · example design",
    `<p class="ie-why"><b>What you see:</b> the power path of the crankcase line: 20 kV → transformer → main LV board (MDB) → feeder → sub-distribution SD-ML1 → one breaker + cable per machine.
     <b>Why it matters:</b> every value on site (cable size, breaker, short-circuit rating, test limit) comes from this drawing. Ask the electrician for it <i>before</i> the machines arrive.</p>
     <div class="ie-sldwrap"><div class="ie-sheet" id="ieSld"></div><div class="ie-info" id="ieInfo3"></div></div>
     ${wwh({ what: "A <b>single-line diagram</b> (SLD) draws the 3 phases as one line. It shows every board, breaker, cable and its rating.", why: "It is the base for cable sizing, short-circuit and selectivity calculation, test limits and later fault finding.", how: "Electrician makes the load list (machine name plates) → SLD → calculations (this card + card B/C) → approval → installation → test → <i>as-built</i> SLD in each board.", check: "Each breaker label in the board = SLD; the SLD shows Ik at each board and the cable size/length of each machine.", mistake: "No SLD, only a list of cables – then nobody knows the short-circuit current or the selectivity." })}`)}

  ${card("ieCardCalc", "B · Load, cable size, voltage drop – live for each machine and the line", "IEC 60364-5-52 · change the inputs · all values are examples",
    `<div class="ie-inputs">
      <label>Transformer ${sel("ieTrS", opt([630, 800, 1000, 1250, 1600]).map(([v]) => [v, v + " kVA"]), S.p.trafoS)}</label>
      <label>u_k ${num("ieUk", S.p.uk, 0.5, 4, 8, 56)} %</label>
      <label>MV S″k ${num("ieSkQ", S.p.SkQ, 50, 50, 2000, 64)} MVA</label>
      <label>Feeder ${sel("ieFeed", [["cable", "cable"], ["bus", "busbar trunking"]], S.p.feedType)}</label>
      <label>Feeder length ${num("ieFeedL", S.p.feedL, 5, 5, 300, 60)} m</label>
      <label>Installation ${sel("ieMeth", [["E", "E – perforated tray (free air)"], ["C", "C – wall / closed tray"]], S.p.method)}</label>
      <label>Insulation ${sel("ieIns", [["XLPE", "XLPE 90 °C"], ["PVC", "PVC 70 °C"]], S.p.ins)}</label>
      <label>Ambient ${sel("ieTamb", TAMB.map((t) => [t, t + " °C"]), S.p.tAmb)}</label>
      <label>Cables touching on tray ${num("ieNg", S.p.nGroup, 1, 1, 20, 50)}</label>
      <label>Simultaneity k_s ${num("ieKs", S.p.ks, 0.05, 0.3, 1, 60)}</label>
      <label>ΔU limit ${num("ieDUmax", S.p.dUmax, 0.5, 1, 8, 56)} %</label>
      <label>Min. size ${sel("ieMinA", [[1.5, "1.5 mm²"], [2.5, "2.5 mm²"], [4, "4 mm²"], [10, "10 mm² (high leakage)"]], S.p.minA)}</label>
      <label class="ie-chk"><input type="checkbox" id="ieTrM"${S.p.trafoMach ? " checked" : ""}> machines with input transformer (400/200 V)</label>
      <label>Feeder trip unit ${sel("ieTrip", [["LSI", "electronic LSI (short-time delay)"], ["TM", "thermal-magnetic"]], S.p.feedTrip)}</label>
     </div>
     <div id="ieCalcT"></div><div id="ieLineSum"></div>
     ${wwh({ what: "Design current I_b, breaker I_n, cable current capacity I_z (table value × derating), voltage drop ΔU, for each machine and the feeder.", why: "Too small → hot cable, nuisance trips, voltage dips during spindle acceleration (CNC alarms). Too big → money wasted. Rule: <b>I_b ≤ I_n ≤ I_z</b> and ΔU ≤ limit.", how: "Machine cables: use the <b>connected load</b> (name plate kVA / maker's fuse size), not the average power. Line feeder: Σ connected × simultaneity k_s (0.5–0.7 typical for machine shops; check with real measurements of a similar line). Derate for ambient and grouping.", check: "Cable label + size on site = table; tray temperature in summer (near the roof often 35–40 °C); spare capacity 20–30 %.", mistake: "Using the 30 °C table value for a cable in a full tray under a hot roof: real capacity only 60–70 % of the table." })}`)}

  ${card("ieCardWork", "B2 · Worked example for one machine (formula → numbers → result)", "select the machine",
    `<div class="ie-row" id="ieWorkSel"></div><div id="ieWork"></div>`)}

  ${card("ieCardProt", "C · Short circuit, breakers, selectivity, disconnection time, inrush", "IEC 60909 (simplified) · IEC 60364-4-41/-4-43 · IEC 60947-2",
    `<div id="ieProt"></div>
     ${wwh({ what: "Max short-circuit current Ik3 (sizes the breaking capacity I_cu) and minimum earth-fault current Ik1 (must trip the breaker fast). Selectivity = only the breaker nearest to the fault trips.", why: "If Ik3 > I_cu the breaker can explode. If Ik1 is too small the breaker trips too late → dangerous touch voltage on the machine frame. Without selectivity one machine fault stops the whole line.", how: "Z = source (MV + transformer) + feeder + machine cable. Ik3 = c_max·U/(√3·Z) with cold conductors; Ik1 = c_min·U0/Z_loop with hot conductors (phase + PE). Choose breakers with I_cu ≥ Ik3 and check Ik1 ≥ I_a (instantaneous trip current).", check: "Measure Z_s at each machine (card H). Get the breaker maker's selectivity tables for the pair feeder / machine breaker.", mistake: "Calculating only Ik3 (max) and forgetting Ik1 (min) at the END of a long, thin cable." })}`)}

  ${card("ieCardRcd", "D · RCD type, leakage current, reinforced PE", "IEC 60364-4-41/-5-53 · IEC 61800-5-1 · IEC 60204-1 §8.2.6 · IEC 62423",
    `<div id="ieRcd"></div>`)}

  ${card("ieCardPq", "E · Surge protection (SPD) and power quality", "IEC 60364-5-53 §534 · IEC 61643 · IEC 61000-2-4 · IEC 61000-3-12 · IEC 61000-4-30",
    `<div id="iePq"></div>`)}

  ${card("ieCardEarth", "F · Earthing and equipotential bonding (TN-S)", "IEC 60364-5-54 · IEC 60364-4-44 · IEC 61000-5-2 · example sizes",
    `<div class="ie-sheet">${earthSvg()}</div><div id="ieEarth"></div>`)}

  ${card("ieCardConn", "G · Machine connection – cable entry, main switch, phase rotation, voltage, transformer tap", "IEC 60204-1 §4.3, §5.3 · maker's installation manual",
    `<div id="ieConn"></div>`)}

  ${card("ieCardTest", "H · Electrical tests before the first switch-on – checklist with example measured values", "IEC 60364-6 (initial verification) · IEC 60204-1 §18 · tick each step, edit the measured values",
    `<div id="ieTest"></div>`)}

  ${card("ieCardAsk", "I · Questions for the electrician and the machine maker", "print / copy before the order",
    `<div id="ieAsk"></div>`)}
  </div>`;

  /* ---------------- renderers */
  function calc() { R = calcLine(S.p, S.lens); R.selM = S.selM; return R; }
  function renderSld() { $("ieSld").innerHTML = sld(R, S.info); renderInfo(); }
  function renderInfo() {
    let k = S.info; const base = k && k.includes(":") ? k.split(":")[0] : k;
    if (k && k.includes(":")) { const id = k.split(":")[1]; if (R.br.some((b) => b.id === id)) { S.selM = id; R.selM = id; } }
    const it = INFO[base];
    $("ieInfo3").innerHTML = it ? infoHtml(it, R) : `<h3>Information</h3><p class="muted">Click a device in the drawing.</p>`;
  }
  function renderCalc() {
    const rows = R.br.map((b) => [
      `<button class="ie-lnk${b.id === S.selM ? " ie-act" : ""}" data-iem="${b.id}">${b.id}</button>`, `${b.S}`, `${b.P}`,
      `<input type="number" class="ie-len" data-len="${b.id}" value="${b.L}" min="1" max="300" step="1" style="width:56px">`,
      f(b.Ib, 1), esc(b.brk.txt.replace(/, Im.*$/, "")), `<b>${b.cable}</b>`, `${b.Itab} × ${f(b.f, 3)} = ${f(b.Iz, 1)}`,
      f(b.dUb, 2), `${f(b.dUt, 2)} ${b.dUok ? "" : warn(">limit")}`, f(b.Ik3 / 1000, 2), `${f(b.Ik1, 0)} / ${f(b.Ia, 0)} ${ok(b.discOk)}`,
      `${f(b.Iinr, 0)} ${b.inrOk ? "" : warn("may trip")}`, esc(b.by), ok(b.ok),
    ]);
    $("ieCalcT").innerHTML = tbl(["Machine", "S conn. kVA", "P run kW", "L m", "I_b A", "Breaker", "Cable", "I_z = I_tab × f (A)", "ΔU branch %", "ΔU total %", "Ik3 kA", "Ik1 / I_a (A)", "Inrush A", "Sized by", "Status"], rows, "ie-calc");
    const L = R.line, F = R.feed;
    $("ieLineSum").innerHTML = `<div class="ie-sum">
      <div><b>Line SD-ML1:</b> Σ connected ${L.Sconn} kVA · Σ run ${f(L.Prun, 1)} kW (${f(L.Srun, 0)} kVA, I = ${f(L.IbRun, 0)} A average) · design S_d = k_s · ΣS = ${R.p.ks} × ${L.Sconn} = <b>${f(L.Sd, 1)} kVA</b> → I_b = S_d/(√3·400 V) = <b>${f(L.Ib, 1)} A</b> → feeder breaker <b>${F.brk.In} A</b></div>
      <div><b>Feeder W1:</b> ${esc(F.txt)} · ${F.type === "bus" ? `rating ${F.rating} A × ${f(F.kb, 2)}` : `I_tab ${F.Itab} A × f ${f(F.f, 3)} (k_θ ${f(R.kT, 2)} × k_group(${R.p.feedN}) )`} = I_z <b>${f(F.Iz, 0)} A</b> ≥ ${F.In} A ${ok(F.Iz >= F.In)} · ΔU = <b>${f(F.dU, 2)} %</b> (limit for the feeder: half of ${R.p.dUmax} %)</div>
      <div><b>Branch derating:</b> f = k_θ(${R.p.tAmb} °C, ${R.p.ins}) × k_group(${R.p.nGroup} cables, method ${R.p.method}) = ${f(R.kT, 2)} × ${f(R.kG, 2)} = <b>${f(R.fBranch, 3)}</b> · voltage drop limit ${R.p.dUmax} % from the MDB to the machine terminals ${ex("example design value")}</div>
      <div class="muted">Machine cable sizes use the full connected load (worst case). ΔU at the average run current is much smaller (e.g. ${R.br[0].id}: ${f(R.br[0].dUrun, 2)} % in the branch). Cable tables: IEC 60364-5-52 Annex B, Cu, 3 loaded conductors, 30 °C – check the national annex.</div></div>`;
  }
  function renderWork() {
    $("ieWorkSel").innerHTML = seg("iem", R.br.map((b) => [b.id, b.id]).concat([["COMP-1", "COMP-1"]]), S.selM);
    const b = brOf(R, S.selM), p = R.p, i = SIZES.indexOf(b.A), Rh = R20[i] * kHot(p.ins), sin = Math.sqrt(1 - b.cos * b.cos);
    const base = b.id === "COMP-1" ? R.mdb : R.sd, feedDU = b.id === "COMP-1" ? 0 : R.feed.dU;
    const tab = AMP[p.ins][p.method];
    const step = (n, t, fm, res) => `<tr><td class="ie-n">${n}</td><td class="wrap">${t}</td><td class="wrap ie-fm">${fm}</td><td class="wrap"><b>${res}</b></td></tr>`;
    $("ieWork").innerHTML = `<div class="table-wrap"><table class="ie-tbl ie-work"><thead><tr><th>#</th><th>Step</th><th>Formula with numbers</th><th>Result</th></tr></thead><tbody>
      ${step(1, "Design current from the connected load", `I_b = S/(√3·U) = ${b.S * 1000} / (1.732 × 400)`, `${f(b.Ib, 2)} A`)}
      ${step(2, "Breaker: next standard size ≥ I_b (or the size in the maker's manual)", `I_n ≥ ${f(b.Ib, 1)} A`, `${b.brk.txt}`)}
      ${step(3, "Derating for ambient and grouping", `f = k_θ × k_group = ${f(R.kT, 2)} × ${f(R.kG, 2)}`, `f = ${f(b.f, 3)}`)}
      ${step(4, `Smallest cable with I_tab · f ≥ I_n (table ${p.ins}, method ${p.method})`, `I_tab ≥ I_n / f = ${b.In} / ${f(b.f, 3)} = ${f(b.In / b.f, 1)} A → ${b.A} mm² has I_tab = ${b.Itab} A${i > 0 ? ` (${SIZES[i - 1]} mm²: ${tab[i - 1]} A)` : ""}`, `${b.cable}, I_z = ${f(b.Iz, 1)} A · I_b ${f(b.Ib, 1)} ≤ I_n ${b.In} ≤ I_z ${f(b.Iz, 1)} ${b.Iz >= b.In ? "✓" : "✗"} · sized by ${esc(b.by)}`)}
      ${step(5, "Voltage drop of the machine cable (R at operating temperature)", `R = ${R20[i]} Ω/km × ${f(kHot(p.ins), 3)} = ${f(Rh, 3)} Ω/km, X = ${XKM} Ω/km, cos φ ${b.cos} (sin φ ${f(sin, 3)})<br>ΔU = √3 · I · L · (R cos φ + X sin φ) / U · 100 = 1.732 × ${f(b.Ib, 2)} × ${b.L / 1000} km × (${f(Rh * b.cos, 4)} + ${f(XKM * sin, 4)}) / 400 × 100`, `${f(b.dUb, 3)} % + feeder ${f(feedDU, 3)} % = ${f(b.dUt, 2)} % ${b.dUok ? "≤" : ">"} ${p.dUmax} % ${b.dUok ? "✓" : "✗"}`)}
      ${step(6, "Max short-circuit current at the machine (cold cables, c_max = 1.05)", `R = ${f(base.R, 2)} + ${R20[i]} × ${b.L} = ${f(b.R, 2)} mΩ, X = ${f(base.X, 2)} + ${XKM} × ${b.L} = ${f(b.X, 2)} mΩ, Z = √(R² + X²) = ${f(Math.hypot(b.R, b.X), 2)} mΩ<br>Ik3 = c·U / (√3·Z) = 1.05 × 400 / (1.732 × ${f(Math.hypot(b.R, b.X) / 1000, 5)} Ω)`, `${kA(b.Ik3)} at the machine; ${kA(base.Ik3)} at the breaker → I_cu ≥ ${b.id === "COMP-1" ? R.mdbIcu : R.sdIcu} kA`)}
      ${step(7, "Min earth-fault current L–PE (hot cables, c_min = 0.95)", `Z_loop: R = ${f(base.RL, 2)} + (${R20[i]} + ${R20[SIZES.indexOf(b.PE)]}) × ${f(kHot(p.ins), 3)} × ${b.L} = ${f(b.RL, 2)} mΩ, X = ${f(b.XL, 2)} mΩ → Z_s = ${f(b.Zs, 2)} mΩ<br>Ik1 = 0.95 × 230.9 V / ${f(b.Zs / 1000, 4)} Ω`, `${f(b.Ik1, 0)} A ${b.discOk ? "≥" : "<"} I_a = ${f(b.Ia, 0)} A → ${b.discOk ? "instantaneous trip (< 0.1 s) ≤ " + b.tMax + " s ✓" : "too slow ✗ (bigger cable / lower I_m / RCD)"}`)}
      ${step(8, "Max loop impedance for this breaker (for the test on site)", `Z_s,max = U0 / I_a = 230.9 / ${f(b.Ia, 0)}`, `${f(b.ZsMax / 1000, 3)} Ω; measured value must be ≤ 0.8 × Z_s,max = ${f(0.8 * b.ZsMax / 1000, 3)} Ω (cable is warm in service)`)}
      ${step(9, "Inrush at power-on", b.kInr === 12 ? `input transformer: I_inrush ≈ 12 × I_b = 12 × ${f(b.Ib, 1)}` : `drive precharge limits the inrush: ≈ 2 × I_b = 2 × ${f(b.Ib, 1)}`, `${f(b.Iinr, 0)} A ${b.inrOk ? "<" : "≥"} lowest magnetic trip ${f(b.brk.ImLow, 0)} A ${b.inrOk ? "✓ no nuisance trip" : "✗ choose D-curve / higher I_m"}`)}
    </tbody></table></div><p class="ie-note">Example: same numbers as the guide docs/27 §A.4 for HMC-01 with the default inputs. The machine maker's manual (fuse size, cable size, inrush, leakage) always wins.</p>`;
  }
  function renderProt() {
    const s = R.sel, F = R.feed, big = s.down;
    const rows = [["MDB busbar", kA(R.mdb.Ik3), `${R.mdbIcu} kA`, "—", "-Q0 ACB, -Q1…-Q4 MCCB"], ["SD-ML1 busbar", kA(R.sd.Ik3), `${R.sdIcu} kA`, kA(R.sd.Ik1), `machine breakers; feeder -Q1 I_k1 ${f(R.sd.Ik1, 0)} A ≥ 1.2·I_sd = ${f(F.brk.Ia, 0)} A ${ok(F.discOk)}`]]
      .concat(R.br.map((b) => [`${b.id} terminals`, kA(b.Ik3), "—", kA(b.Ik1), `${esc(b.brk.txt)} → I_a ${f(b.Ia, 0)} A ${ok(b.discOk)}`]));
    $("ieProt").innerHTML = `<div class="ie-grid2"><div>
      <h3>Short-circuit currents along the line ${ex()}</h3>${tbl(["Point", "Ik3 max", "I_cu needed", "Ik1 min (L–PE)", "Protective device / check"], rows)}
      <p class="ie-note">Source: Z_Q = 1.1·U²/S″k = ${f(R.src.ZQ, 3)} mΩ · Z_T = u_k·U²/S_T = ${f(R.src.ZT, 2)} mΩ (R_T = P_k·U²/S² = ${f(R.src.RT, 2)} mΩ) · Ik3 at the MDB ≈ I_nT/u_k = ${f(R.src.InT, 0)}/${R.p.uk / 100} = ${kA(R.src.InT / (R.p.uk / 100))} (quick check; exact ${kA(R.mdb.Ik3)}).</p>
      <h3>Disconnection times in TN systems (IEC 60364-4-41 Table 41.1, U0 = 230 V)</h3>
      ${tbl(["Circuit", "Max time", "How it is met here"], [["final circuits ≤ 32 A (sockets, small loads)", "0.4 s", "MCB magnetic trip (B 5×, C 10×, D 20× I_n) or RCD"], ["final circuits > 32 A and distribution circuits", "5 s", "machine MCCBs and the feeder: Ik1 ≥ I_a → instantaneous trip anyway"], ["where Ik1 is too low", "—", "bigger cable (less Z_s), lower I_m setting, electronic trip with G (earth fault) function, or RCD type B"]])}
     </div><div>
      <h3>Selectivity feeder -Q1 ↔ machine breaker (${big.id})</h3>
      ${tbl(["Check", "Value", "Result"], [
        ["Overload: I_n,up / I_n,down ≥ 1.6", `${F.brk.In} / ${big.In} = ${f(s.ratio, 2)}`, ok(s.ovl)],
        ["Current selectivity: Ik3 at SD-ML1 ≤ 0.8 · I_sd,up", `${kA(R.sd.Ik3)} vs ${kA(s.limit)}`, s.current ? ok(true) : warn("not by current")],
        ["Time selectivity: upstream short-time delay", s.time ? "t_sd = 0.1 s, I_i off / ≥ Ik3" : "none (thermal-magnetic)", s.time ? ok(true, "selective") : `<span class="ie-st ie-bad">partial only</span>`],
      ])}
      <p class="ie-note">${s.time ? "With an electronic LSI trip unit the feeder waits 0.1 s; the machine breaker clears its fault in < 10 ms → only the faulty machine stops. Confirm with the breaker maker's selectivity table (energy selectivity)." : `With a thermal-magnetic feeder breaker, a short circuit above ≈ ${kA(s.limit)} in a machine cable trips BOTH breakers → the whole line stops. Choose LSI or check the maker's table.`}</p>
      <h3>Inrush current at power-on</h3>
      ${tbl(["Load", "Typical inrush", "Breaker choice"], [["servo / spindle drive with precharge (diode or thyristor)", "≈ 1–2 × I_n, a few ms", "MCB C / MCCB I_m 10×"], ["machine with input transformer (e.g. 400/200 V, Japanese machines)", "10–15 × I_n,trafo, first half cycle", "MCB D or MCCB I_m 12–14× (then re-check Ik1 ≥ I_a)"], ["DOL motor (pump, chip conveyor)", "6–8 × I_n start, 1–5 s", "motor-protective breaker, class 10"], ["switched-mode power supplies 24 V", "30–60 A for < 5 ms", "C-curve, or inrush limiter"]])}
      <p class="ie-note">Machines with input transformer: <b>${R.p.trafoMach ? "ON" : "off"}</b> (switch in card B). Then the machine breakers become D-curve / I_m = 14·I_n and the loop check uses the higher I_a.</p>
     </div></div>`;
  }
  function renderRcd() {
    const L = S.leak, lk = leakage(L.n, L.mA, L.cab);
    $("ieRcd").innerHTML = `<div class="ie-grid2"><div>
      <h3>RCD types (IEC 60755 / IEC 62423)</h3>
      ${tbl(["Type", "Detects", "Use"], [["AC", "sinusoidal AC only", "not for machines (not allowed in many countries)"], ["A", "AC + pulsating DC (single-phase rectifier)", "sockets, lights (30 mA)"], ["F", "A + mixed frequencies up to 1 kHz", "single-phase inverters (washing pumps, fans)"], ["<b>B</b>", "<b>F + smooth DC + up to 1 kHz</b> (B+: up to 20 kHz)", "<b>3-phase drives</b> – a fault on the DC bus gives smooth DC that 'blinds' type A/F"]], "ie-wrapt")}
      ${wwh({ what: "An RCD trips when the current in L1+L2+L3+N does not add to zero (current leaks to PE).", why: "In a 3-phase drive an earth fault behind the rectifier is <b>smooth DC</b>. It saturates the core of a type A RCD → the RCD does not trip any more, also not for other faults. Therefore: <b>type B</b> (IEC 60364-5-53 §531.3.3, IEC 61800-5-1 warning label).", how: "Normal machine feed in TN-S: <b>no RCD</b> – protection by automatic disconnection with the breaker (card C). RCD only where required: TT system, fire-risk areas (300 mA type B), or local rule. Alternative: <b>RCM type B</b> (residual current monitor, IEC 62020) – alarms the creeping insulation fault without tripping.", check: "Machine manual: 'RCD type B, I_Δn ≥ 300 mA' or 'no RCD'. Leakage current below 30 % of I_Δn.", mistake: "30 mA type A RCD in front of a CNC → trips at power-on (filter capacitors) or, worse, is blinded by DC and does not protect." })}
     </div><div>
      <h3>Leakage (PE) current and reinforced PE ${ex()}</h3>
      <div class="ie-inputs"><label>EMC filters ${num("ieLkN", L.n, 1, 0, 10, 50)}</label><label>leakage each ${num("ieLkMa", L.mA, 0.5, 0, 50, 56)} mA</label><label>motor-cable HF leakage ${num("ieLkCab", L.cab, 1, 0, 100, 56)} mA</label></div>
      ${tbl(["Quantity", "Value", "Consequence"], [
        ["normal PE current I = n · I_filter + I_cable", `${L.n} × ${L.mA} + ${L.cab} = <b>${f(lk.I, 1)} mA</b>`, lk.reinforced60204 ? "> 10 mA → reinforced PE (IEC 60204-1 §8.2.6)" : (lk.reinforced61800 ? "> 3.5 mA → reinforced PE (IEC 61800-5-1)" : "small")],
        ["one phase lost (filter unbalanced) ≈ 3 × filter part", `<b>${f(lk.Ifault, 1)} mA</b>`, "touch current if the PE is broken → PE must never break"],
        ["RCD would need I_Δn ≥ I / 0.3", `${f(lk.IdnMin, 0)} mA`, `→ smallest usable: <b>${lk.rcd} mA type B</b>; 30 mA ${lk.I > 9 ? "impossible" : "possible"}`],
      ])}
      <p class="ie-note"><b>Reinforced PE</b> (IEC 61800-5-1 §4.3.5.5.2, touch current > 3.5 mA AC; IEC 60204-1 §8.2.6, > 10 mA): one of (a) PE ≥ <b>10 mm² Cu</b> (16 mm² Al) over the whole length, (b) a <b>second PE</b> of the same size with its own terminal, (c) automatic disconnection if the PE breaks. Plus a warning label "High leakage current – connect PE first". A 5G25 machine cable (PE 25 mm²) fulfils (a).</p>
     </div></div>`;
  }
  function renderPq() {
    const Pd = R.br.filter((b) => b.drive).reduce((a, b) => a + b.P, 0) + COMP.P;
    const H = harmonics(S.pq.tech, Pd + S.pq.other, R.src.X);
    const ub = unbalance(...S.ub);
    $("iePq").innerHTML = `<div class="ie-grid2"><div>
      <h3>Surge protective devices – where</h3>
      ${tbl(["Type", "Test wave", "Where", "Example rating"], [["Type 1 (lightning current)", "10/350 µs", "MDB (service entrance) if the building has lightning protection / overhead line", "I_imp 12.5 kA/pole, U_p ≤ 1.5 kV"], ["Type 2", "8/20 µs", "SD-ML1 and every board > 10 m from the type-1 SPD", "I_n 20 kA, U_p ≤ 1.5 kV"], ["Type 3", "combination wave", "≤ 10 m before sensitive devices: CNC control supply, PLC, PC (if the maker asks)", "U_p ≤ 1 kV"], ["Data-line SPD", "—", "network / signal cables entering from another building or outdoors", "fibre is better (card 4)"]], "ie-wrapt")}
      ${wwh({ what: "SPDs divert surge current to PE and limit the voltage to the protection level U_p.", why: "Switching of the factory's large loads, MV switching and lightning make surges of several kV; electronics in the CNC fail or age.", how: "Coordinated stages type 1 → 2 → 3. Connect with short, straight leads (≤ 0.5 m total, 'V-wiring' best) to the local PE bar. Back-up fuse as the SPD maker says.", check: "Status indicator, remote alarm, connection length, after every thunderstorm.", mistake: "SPD with 1.5 m loop of wire to the PE bar → U_p + 1.5 kV: no protection." })}
      <h3>Voltage unbalance at the machine ${ex()}</h3>
      <div class="ie-inputs"><label>U12 ${num("ieU1", S.ub[0], 1, 300, 500, 60)} V</label><label>U23 ${num("ieU2", S.ub[1], 1, 300, 500, 60)} V</label><label>U31 ${num("ieU3", S.ub[2], 1, 300, 500, 60)} V</label></div>
      <p>mean = ${f(ub.mean, 1)} V · max deviation ${f(ub.dev, 2)} V → unbalance = max deviation / mean × 100 = <b>${f(ub.pct, 2)} %</b> ${ok(ub.pct <= 2, "≤ 2 % OK", "> 2 %")} · voltage window 360–440 V ${ok(ub.tolOk)}</p>
      <p class="ie-note">1 % voltage unbalance gives ≈ 6–10 % current unbalance in motors and drives (more heating, DC-bus ripple). Limit ≤ 2 % (IEC 61000-2-4 class 2, IEC 60204-1 §4.3.2). Cause: big single-phase loads (welding, heaters) on one phase.</p>
     </div><div>
      <h3>Harmonics of drives (live estimate at the MDB) ${ex()}</h3>
      <div class="ie-inputs"><label>Drive input ${sel("iePqT", Object.entries(SPECTRA).map(([k, v]) => [k, v.n]), S.pq.tech)}</label><label>other drives on the transformer ${num("iePqO", S.pq.other, 10, 0, 2000, 64)} kW</label></div>
      <p>Drive load: line drives ${f(Pd, 1)} kW (HMC, VMC, robot, compressor run power) + other ${S.pq.other} kW → I1 = P/(√3·400·0.95) = <b>${f(H.I1, 0)} A</b> · source reactance X = ${f(R.src.X, 2)} mΩ (MV + transformer)</p>
      ${tbl(["h", "f Hz", "I_h % of I1", "I_h A", "U_h = h·X·I_h (V)", "U_h % of 230 V"], H.rows.map((r) => [r.h, r.h * 50, r.pct, f(r.Ih, 1), f(r.Uh, 2), f(r.UhPct, 2)]))}
      <p>THDi = √Σ(I_h/I1)² = <b>${f(H.THDi, 1)} %</b> · THDu ≈ √ΣU_h² / 230.9 V = <b>${f(H.THDu, 2)} %</b> ${ok(H.THDu <= 5, "≤ 5 % OK", "> 5 % – reactors / AFE / filter")} · true power factor λ = cos φ1 / √(1 + THDi²) = ${H.cos} / √(1 + ${f(H.THDi / 100, 3)}²) = <b>${f(H.PF, 3)}</b></p>
      <p class="ie-note">Rules: line reactor 3–4 % (u_k) or DC choke on every 6-pulse drive (most CNC drive systems include it – check); active front end for large drive groups (also regenerates braking energy). Goal THDu ≤ 5 % at the main board (IEC 61000-2-4 class 2 limit 8 %). Capacitor banks only <b>detuned</b> (7 %). <b>Before acceptance:</b> 3-phase power analyser (IEC 61000-4-30 class A) for 1 week at SD-ML1: U, I, THDu, THDi per harmonic, unbalance, PF, dips, flicker – keep the record as the baseline.</p>
     </div></div>`;
  }
  function renderEarth() {
    $("ieEarth").innerHTML = `<div class="ie-grid2"><div>
      ${wwh({ what: "<b>TN-S</b>: the transformer star point is earthed; N and PE run as separate conductors to every board. <b>PE</b> = protective earth (safety, carries fault current). <b>Functional earth / bonding</b> = low-impedance reference for electronics and EMC (carries HF noise current). Both end in ONE earthing system.", why: "Safety: a fault L → frame becomes a short circuit L → PE → the breaker trips. EMC: all metal at the same potential → no noise currents through signal shields, no ground loops with large voltage.", how: "Main earthing terminal (MET) at the MDB · foundation / mesh earth in the slab connected to the rebar · main bonding of all incoming pipes and the steel structure · each machine base, conveyor, tray and pipework bonded to the nearest PE / mesh point with short Cu conductors · tray joints bridged.", check: "Earth resistance (fall-of-potential, 62 % rule): auxiliary current spike at ≥ 5 × the size of the mesh away, voltage spike at 62 % of the distance; 3 readings at 52/62/72 % must agree within ±5 %. Clamp method for single rods. Continuity of every bonding conductor ≤ 0.1 Ω (example).", mistake: "A separate 'clean earth' rod for the CNC: during a fault or lightning, the two earths have different potentials (kV) → danger and destroyed electronics; in normal operation a ground loop through the signal cables." })}
     </div><div>
      <h3>Conductor sizes (examples – IEC 60364-5-54)</h3>
      ${tbl(["Conductor", "Size (Cu)", "Rule"], [["PE in the machine cable", "= phase up to 16 mm²; 16 mm² for 25–35; S/2 above", "Table 54.2 (or adiabatic S = √(I²t)/k)"], ["PE with high leakage (> 10 mA)", "≥ 10 mm² or two PE", "IEC 60204-1 §8.2.6 / IEC 61800-5-1"], ["main bonding conductor", "≥ ½ largest PE, min 6 mm², max needed 25 mm²", "§544.1.1"], ["machine base / frame to mesh", "16–25 mm² (flexible braid where it moves)", "good practice for EMC (short!)"], ["cable tray joints", "bonding jumper or certified continuity", "IEC 61537 tray continuity"], ["earth mesh / ring", "steel 30 × 3.5 mm or Cu 50 mm²", "IEC 62305-3 / DIN 18014 style"]], "ie-wrapt")}
      <h3>Why not a separate "clean earth"?</h3>
      <p class="ie-note">IEC 61000-5-2 and the drive makers say: <b>one</b> common, meshed earthing system. High-frequency noise is controlled by low inductance (short, wide conductors, meshed bonding, 360° shields), not by isolating earths. A separate electrode has 10–100 Ω to the main earth: in a fault or lightning several kV appear between the CNC and the building → dangerous touch voltage and destroyed interfaces. In normal use 50 Hz and HF currents flow through the signal cables that connect the two earths.</p>
     </div></div>`;
  }
  function renderConn() {
    const tp = bestTap(S.Umeas);
    $("ieConn").innerHTML = `<div class="ie-grid2"><div>
      ${wwh({ what: "The interface building ↔ machine: cable entry, PE first, the machine main switch (IEC 60204-1 §5.3: one supply disconnecting device, lockable in OFF), phase rotation, voltage and frequency at the terminals, transformer tap if the machine has its own transformer.", why: "Wrong rotation runs hydraulic, coolant and chip-conveyor pumps backwards (pump damage in minutes; servo drives do not care). Wrong voltage → CNC under/over-voltage alarms, drive damage.", how: "1) LOTO upstream (-Q1x in SD-ML1). 2) Cable in through the maker's gland plate (top or bottom entry as in the manual), EMC gland if required, strain relief. 3) Connect PE FIRST, then L1-L2-L3 (N only if the maker needs it – most CNCs do not). 4) Torque per the terminal label, mark the screws. 5) Insulation + continuity tests (card H). 6) Power on upstream with the machine main switch OFF → measure voltage + rotation at the main switch. 7) Set the transformer tap if fitted. 8) Main switch ON with the maker's engineer.", check: "Voltage 400 V ± 10 % (IEC 60204-1 §4.3.2), frequency 50 Hz ± 1 % (± 2 % short time), unbalance ≤ 2 %, rotation clockwise, PE ≥ 10 mm², N–PE < 2 V.", mistake: "Connecting PE last (or forgetting it) on a machine with 25 mA leakage – the frame is live until PE is on." })}
      <h3>Voltage and frequency tolerances (IEC 60204-1 §4.3.2)</h3>
      ${tbl(["Quantity", "Limit"], [["steady-state voltage", "0.9 … 1.1 × U_n (360–440 V)"], ["frequency", "0.99 … 1.01 × f_n continuous, 0.98 … 1.02 short time"], ["harmonics (2nd–5th sum / 6th–30th)", "≤ 10 % / ≤ 2 % additional of U (r.m.s.)"], ["voltage unbalance (negative sequence)", "≤ 2 %"], ["voltage dips", "≤ 3 ms interruption, dips ≤ 20 % for ≤ 1 cycle; > 1 s apart"]])}
     </div><div>
      <h3>Transformer tap at the machine (e.g. 400 V → 200 V machine) ${ex()}</h3>
      <div class="ie-inputs"><label>measured supply ${num("ieUm", S.Umeas, 1, 340, 500, 64)} V L-L</label></div>
      ${tbl(["Tap (primary)", "Secondary U = 200 × U_meas / tap", "Deviation"], tp.rows.map((r) => [r.tap === tp.best.tap ? `<b>${r.tap} V ◀</b>` : r.tap + " V", f(r.Us, 1) + " V", `${r.dev > 0 ? "+" : ""}${f(r.dev, 2)} %`]))}
      <p>Best tap: <b>${tp.best.tap} V</b> → ${f(tp.best.Us, 1)} V on the 200 V side. Measure under load later (the drop at full spindle power can be 2–3 %). Switch taps only with the machine isolated.</p>
      <h3>Phase rotation</h3>
      <p class="ie-note">Measure with a phase-sequence indicator at the machine main switch (clockwise = L1-L2-L3). If wrong: swap <b>two phases at the machine end</b> (not in the board – other loads would change). Many machines have a phase-sequence relay that blocks the start. After swapping: check the hydraulic pump / coolant pump / chip-conveyor direction (arrow on the motor) with a short jog.</p>
      <h3>Main cable entry</h3>
      <p class="ie-note">Enter where the maker's drawing says (gland plate of the main cabinet). Keep the unshielded supply cable away from the motor/encoder cables inside the cabinet (card 4). Use cable lugs matching the conductor class (fine-stranded: ferrules / pressed lugs), crimp tool + die of the lug maker. Leave a service loop. Seal the gland (IP54) against coolant mist.</p>
     </div></div>`;
  }
  function renderTest() {
    const rows = testRows(R);
    let pass = 0;
    const body = rows.map((t) => {
      const v = S.val[t.k] != null ? S.val[t.k] : t.v, tick = !!S.tick[t.k];
      const good = t.fn ? t.fn(+v) : true, okRow = tick && good; if (okRow) pass++;
      return `<tr class="${okRow ? "ie-rowok" : ""}"><td><input type="checkbox" data-tick="${t.k}"${tick ? " checked" : ""} aria-label="done"></td><td class="wrap">${esc(t.s)}</td><td class="wrap ie-small">${esc(t.std)}</td><td class="wrap ie-small">${esc(t.ins)}</td><td class="wrap">${esc(t.lim)}</td>
        <td>${t.v == null ? "—" : `<input type="number" data-val="${t.k}" value="${v}" step="any" style="width:76px"> ${t.unit}`}</td><td>${t.fn ? ok(good, "pass", "FAIL") : ""} ${tick ? "" : `<span class="muted">open</span>`}</td></tr>`;
    }).join("");
    $("ieTest").innerHTML = `<p class="ie-why"><b>Order:</b> first everything <b>dead</b> (visual, continuity, insulation), then <b>live</b> (voltage, rotation, loop impedance, RCD), then function + power quality. The measured values are <b>examples</b> for ${R.selM}; the limits update with the calculation. Only a qualified electrician performs the tests and signs the report.</p>
      <div class="ie-row"><button class="btn" data-ieact="tickall">tick all (example run)</button> <button class="btn" data-ieact="untick">clear ticks</button> <span class="ie-sumt">${pass} / ${rows.length} steps done and passed</span></div>
      <div class="table-wrap"><table class="ie-tbl ie-test"><thead><tr><th>✓</th><th>Step</th><th>Standard</th><th>Instrument</th><th>Limit (example)</th><th>Measured</th><th>Result</th></tr></thead><tbody>${body}</tbody></table></div>
      <p class="ie-note">Record every value in the test report (IEC 60364-6 §6.5) with instrument serial numbers and calibration date. Insulation test: disconnect drives, SPDs, EMC filters and electronics first (or test lines bridged together against PE) – 500 V DC can damage them, and filter capacitors give false low readings.</p>`;
  }
  function renderAsk() {
    const A = [
      ["Machine maker", ["Connected load (kVA), rated current, recommended fuse / breaker type and size, maximum allowed upstream short-circuit current (SCCR)?", "Supply: 3×400 V ± 10 %, 50 Hz, TN-S – is N needed? Allowed voltage unbalance, THDu?", "Inrush current at power-on (input transformer? taps?)", "Leakage / PE current (mA) – RCD type allowed (type B, I_Δn)? Is a reinforced PE (≥ 10 mm²) or a second PE needed?", "Cable entry position, gland size, terminal size (max mm²), cable type requirements (shielded supply?)", "Drive input: line reactor or active front end? THDi at full load? Regenerative energy?", "EMC class of the machine (IEC 61800-3 C2 / C3) – any conditions for the network?", "Power-quality requirements: allowed dips, need for a UPS for the CNC control?"]],
      ["Electrician / designer", ["Single-line diagram with Ik3 / Ik1 at each board and each machine (calculation software report)", "Cable sizing with derating (ambient, grouping), voltage drop at full load, reserve 20–30 %", "Selectivity study feeder ↔ machine breakers (maker's tables), breaker settings record", "Earthing concept: TN-S, MET, mesh in the slab, bonding of machines, trays, pipes – drawing", "SPD concept (type 1/2/3) and lightning protection interface", "Harmonics / PFC: detuned capacitor bank? AFE? Power analyser record before and after", "Test report IEC 60364-6 (initial verification) incl. loop impedance per machine, insulation, RCDs, earth resistance", "As-built drawings and labels in every board; spare ways in SD-ML1"]],
      ["Utility / factory", ["MV short-circuit power S″k (min / max), MV earthing, protection settings", "Transformer: kVA, u_k, vector group, tap position, load today + future", "Lightning protection system on the building (needs SPD type 1)?"]],
    ];
    $("ieAsk").innerHTML = `<div class="ie-grid3">${A.map(([h, l]) => `<div><h3>${h}</h3><ol class="ie-ol">${l.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div>`).join("")}</div>
      <p class="ie-note"><b>Important:</b> this tab teaches the method with example numbers. The real installation design, the calculations, the work and the tests must be done by a <b>qualified electrician / electrical designer</b> under the local rules (IEC 60364 + national version, utility rules) and the machine maker's installation manual.</p>`;
  }
  function renderAll() { calc(); renderSld(); renderCalc(); renderWork(); renderProt(); renderRcd(); renderPq(); renderEarth(); renderConn(); renderTest(); renderAsk(); }
  function renderLive() { calc(); renderSld(); renderCalc(); renderWork(); renderProt(); renderPq(); renderTest(); }

  /* ---------------- events */
  const inputMap = { ieTrS: ["trafoS", 1], ieUk: ["uk", 1], ieSkQ: ["SkQ", 1], ieFeed: ["feedType", 0], ieFeedL: ["feedL", 1], ieMeth: ["method", 0], ieIns: ["ins", 0], ieTamb: ["tAmb", 1], ieNg: ["nGroup", 1], ieKs: ["ks", 1], ieDUmax: ["dUmax", 1], ieMinA: ["minA", 1], ieTrip: ["feedTrip", 0] };
  box.addEventListener("change", (e) => {
    const t = e.target, id = t.id;
    if (inputMap[id]) { const [k, n] = inputMap[id]; let v = n ? +t.value : t.value; if (n && (isNaN(v) || v <= 0)) return; if (k === "ks") v = Math.min(1, Math.max(0.3, v)); S.p[k] = v; renderLive(); return; }
    if (id === "ieTrM") { S.p.trafoMach = t.checked; renderLive(); return; }
    if (t.dataset.len) { const v = +t.value; if (v > 0) { S.lens[t.dataset.len] = v; renderLive(); } return; }
    if (id === "ieLkN" || id === "ieLkMa" || id === "ieLkCab") { S.leak = { n: +$("ieLkN").value || 0, mA: +$("ieLkMa").value || 0, cab: +$("ieLkCab").value || 0 }; renderRcd(); return; }
    if (id === "iePqT" || id === "iePqO") { S.pq = { tech: $("iePqT").value, other: +$("iePqO").value || 0 }; renderPq(); return; }
    if (/^ieU[123]$/.test(id)) { S.ub = [+$("ieU1").value, +$("ieU2").value, +$("ieU3").value]; renderPq(); return; }
    if (id === "ieUm") { S.Umeas = +t.value || 400; renderConn(); return; }
    if (t.dataset.tick) { S.tick[t.dataset.tick] = t.checked; renderTest(); return; }
    if (t.dataset.val) { S.val[t.dataset.val] = +t.value; renderTest(); return; }
  });
  box.addEventListener("click", (e) => {
    const d = e.target.closest("[data-ie]");
    if (d && box.querySelector("#ieSld").contains(d)) { S.info = d.dataset.ie; const id = S.info.split(":")[1]; if (id && R.br.some((b) => b.id === id)) S.selM = id; R.selM = S.selM; renderSld(); renderCalc(); renderWork(); renderTest(); return; }
    const m = e.target.closest("[data-iem]"); if (m) { S.selM = m.dataset.iem; S.info = "Lb:" + S.selM; renderLive(); return; }
    const sg = e.target.closest("[data-ieseg='iem']"); if (sg) { S.selM = sg.dataset.v; if (S.selM !== "COMP-1") S.info = "Lb:" + S.selM; else S.info = "Q2"; renderLive(); return; }
    const a = e.target.closest("[data-ieact]");
    if (a) { if (a.dataset.ieact === "tickall") testRows(R).forEach((t) => (S.tick[t.k] = true)); else S.tick = {}; renderTest(); }
  });

  renderAll();
  return { S, calc: () => calcLine(S.p, S.lens), render: renderAll, R: () => R, testRows: () => testRows(R) };
}
