/* AGV build tab - item 4: docking accuracy, animated (2D SVG, no 3D).
   How an AGV that stops only about ±10 mm accurate still hands its load over exactly:
     A  pallet AGV -> APC load station: floating deck + cone pins + stop faces, then pull studs into receivers (±0.02 mm)
     B  crate AGV -> AS/RS (IN): V-flare side guides at the conveyor transfer position, conveyor stop, crane fork, rack
     C  AS/RS (OUT) -> crate AGV -> crate stand: the crate sits off-centre on the AGV plate (rim play),
        the V-guides of the stand centre it again - errors do not add up because every set-down re-centres.
   Left: overview (errors drawn bigger), right: magnifier at real scale, below: error ladder (log scale).
   All values are examples (same as AGV item 3, mechanical items 1-3).  Offline, no libraries. */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f = (v, d = 1) => (Number.isFinite(v) ? (Math.round(v * 10 ** d) / 10 ** d).toLocaleString("en-US", { maximumFractionDigits: d }) : "–");
const G = 9.81, TAN15 = Math.tan(15 * Math.PI / 180), HC = 320, CARRY = 435, PLOW = 300;
const ease = (u) => u * u * (3 - 2 * u), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, u) => a + (b - a) * u;

const GROUPS = [
  ["AGV (both vehicles)", [
    ["nav", "AGV stop accuracy", "± mm", 10, "typ. ±5–10 mm"],
    ["yaw", "AGV angle accuracy", "± °", 0.5, ""]]],
  ["A · Pallet AGV ↔ APC station", [
    ["zPin", "Lever: AGV centre → cone pin", "mm", 355, "item 3"],
    ["lead", "Cone pin catch range (lead-in)", "± mm", 16, "item 3"],
    ["fl", "Float range of the deck", "± mm", 20, ""],
    ["mfl", "Floating mass (deck + pallet)", "kg", 663, ""],
    ["mub", "Ball transfer unit friction", "", 0.01, ""],
    ["ksp", "Centring spring rate", "N/mm", 10, ""],
    ["llk", "Lock-pin catch range", "± mm", 9, ""],
    ["fit", "Deck position when docked", "± mm", 0.4, "pin H7/g6 + machining, mech. item 1"],
    ["xstop", "Pallet at the retractable stop", "± mm", 1.5, "PU pad + creep speed"],
    ["rlead", "Receiver catch range", "± mm", 3, "mech. item 1"],
    ["rec", "Receiver accuracy (zero-point)", "± mm", 0.02, ""]]],
  ["B · Crate AGV → AS/RS (IN)", [
    ["half", "Lever: half crate length", "mm", 600, "crate 1200 mm"],
    ["gfl", "V-flare per side (transfer position)", "mm", 40, "mech. item 3"],
    ["hfl", "Flare height", "mm", 70, ""],
    ["gcl", "Guide clearance per side", "mm", 7, ""],
    ["mug", "Friction crate ↔ PE guide", "", 0.25, ""],
    ["xconv", "Conveyor stop (lengthwise)", "± mm", 5, "stop sensor + brake motor"],
    ["fclr", "Fork clearance per side", "± mm", 90, "(680 − 500) / 2"],
    ["hpd", "Crane P&D accuracy", "± mm", 3, "laser positioning"],
    ["rack", "Allowed offset in the rack", "± mm", 25, "AS/RS supplier"]]],
  ["C · AS/RS (OUT) → crate AGV → crate stand", [
    ["rim", "Crate play on the AGV plate (rim)", "± mm", 25, "AGV item 1"],
    ["gst", "V-flare at the crate stand", "mm", 55, "mech. item 2"],
    ["gcs", "Guide clearance at the stand", "mm", 5, ""]]],
];
const DEF = {}; GROUPS.forEach(([, fs]) => fs.forEach(([k, , , d]) => { DEF[k] = d; }));

/* ------------------------------------------------------------------ geometry + calculation */
// male cone (pin / stud) from above into a female bore with a 45° chamfer c; catch K = rb + c - rt
function coneGeo(r, K, c, Ls) { const rt = Math.max(0.5, r + c - K); return { r, rb: r, c, rt, Ls, lc: (r - rt) / TAN15, K: r + c - rt }; }
function rc(g, y) { if (y < g.Ls) return g.r; if (y <= g.Ls + g.lc) return g.r - (y - g.Ls) * TAN15; return -1e9; }
function allowed(g, gap) { const a1 = g.rb + g.c - rc(g, gap), a2 = g.rb + 0.02 - rc(g, gap + g.c); return Math.max(0.02, Math.min(a1, a2)); }
function allowedFlare(P, hb) { return hb >= P.hs + P.hfl ? 1e9 : hb > P.hs ? P.gcl + P.gfl * (hb - P.hs) / P.hfl : P.gcl; }

function calc(M) {
  const R = {}, rad = Math.PI / 180;
  R.gD = coneGeo(12.5, M.lead, Math.max(0.5, M.lead - 10.5), 15);    // Ø25 pin, tip Ø4
  R.gR = coneGeo(12, M.rlead, 1.5, 10);                              // pull stud into receiver
  R.gL = coneGeo(10, M.llk, 3, 10);                                  // lock pin into the deck
  R.G0 = R.gD.Ls + R.gD.lc + 15; R.GR = R.gR.Ls + R.gR.lc + 8; R.GL = R.gL.Ls + R.gL.lc + 8;
  R.yawA = M.zPin * Math.sin(M.yaw * rad); R.capA = M.nav + R.yawA;
  R.yawB = M.half * Math.sin(M.yaw * rad); R.capB = M.nav + R.yawB;
  R.Ffric = M.mub * M.mfl * G; R.xres = R.Ffric / M.ksp; R.Ffl = R.Ffric + M.ksp * R.capA;
  R.Fv = R.Ffl * (TAN15 + 0.15) / (1 - 0.15 * TAN15);
  R.thB = Math.atan2(M.hfl, M.gfl) / rad; R.phi = Math.atan(M.mug) / rad;
  R.thS = Math.atan2(60, M.gst) / rad;
  R.plateC = R.capB + M.gcl; R.standC = R.capB + R.plateC;
  R.chains = {
    A: [
      { st: "1 · AGV stops", by: "navigation (laser scanner + wheel encoders)", acc: R.capA, how: `${M.nav} + ${M.zPin}·sin ${M.yaw}°`, cat: R.gD.K, cby: "cone pin lead-in" },
      { st: "2 · Deck docked", by: "2 cone pins (round + diamond) + stop faces", acc: M.fit, how: "pin fit + machined positions", cat: null, cby: "carried on to the pallet" },
      { st: "3 · Pallet at the stop", by: "station chains + retractable stop", acc: Math.max(M.fit, M.xstop), how: `sideways ±${M.fit}, lengthwise ±${M.xstop}`, cat: M.rlead, cby: "receiver lead-in" },
      { st: "4 · Pallet in receivers", by: "4 hardened receivers (zero-point type)", acc: M.rec, how: "ground bores, round + slot", cat: null, cby: "end – the APC takes it" }],
    B: [
      { st: "1 · AGV stops", by: "navigation", acc: R.capB, how: `${M.nav} + ${M.half}·sin ${M.yaw}°`, cat: M.gcl + M.gfl, cby: "V-flare of the side guides" },
      { st: "2 · Crate on the conveyor", by: "side guides", acc: M.gcl, how: "guide clearance", cat: null, cby: "guided on the way in" },
      { st: "3 · Crate at the P&D", by: "guides (sideways) + stop sensor (lengthwise)", acc: Math.max(M.gcl, M.xconv), need: M.hpd + Math.max(M.gcl, M.xconv), how: `±${M.gcl} / ±${M.xconv}, + crane ±${M.hpd}`, cat: M.fclr, cby: "fork clearance" },
      { st: "4 · Crate in the rack", by: "crane positioning", acc: M.hpd + M.gcl, how: `crane ±${M.hpd} + crate ±${M.gcl}`, cat: M.rack, cby: "support angle overlap" }],
    C: [
      { st: "1 · Crate at the OUT transfer", by: "side guides", acc: M.gcl, how: "guide clearance", cat: null, cby: "AGV drives under it" },
      { st: "2 · Crate on the AGV plate", by: "AGV error + crate position", acc: R.plateC, how: `${f(R.capB, 1)} + ${M.gcl}`, cat: M.rim, cby: "rim play on the plate" },
      { st: "3 · AGV at the crate stand", by: "AGV error again + offset on the plate", acc: R.standC, how: `${f(R.capB, 1)} + ${f(R.plateC, 1)}`, cat: M.gst + M.gcs, cby: "V-flare of the stand" },
      { st: "4 · Crate seated in the stand", by: "4 corner V-guides", acc: M.gcs, how: "guide clearance", cat: null, cby: "end" }],
  };
  for (const k in R.chains) for (const c of R.chains[k]) {
    const need = c.need ?? c.acc;
    c.st2 = c.cat == null ? "" : c.cat >= need * 1.2 && c.cat >= need + 1 ? "ok" : c.cat >= need ? "warn" : "bad"; c.needV = need;
  }
  return R;
}

/* ------------------------------------------------------------------ phases (steps) */
function phases(scn, M, R, e) {
  const ae = f(Math.abs(e), 1);
  if (scn === "A") {
    const fault = Math.abs(e) >= R.gD.K;
    const P = [
      ["arr", `AGV drives in and stops. It is only ±${f(R.capA, 1)} mm accurate – this run it is ${ae} mm off`, 2.5],
      ["unl", `Lock pin opens: the deck can now float ±${M.fl} mm on ball transfer units`, 1],
      ["lift", "Scissor lifts the deck. The AGV body stays where it stopped", 2.2],
      ["dock", fault ? `The bush misses the cone (${ae} mm ≥ catch ±${f(R.gD.K, 1)} mm): the cone tip hits the bush face` : "Bush meets the 15° cone: the cone pushes the floating deck sideways until bush and pin are on one axis", 3.2]];
    if (fault) return P.concat([["flt", "FAULT: motor current rises too early (deck too low) → deck down, AGV re-positions and tries again, after 2 tries it calls the operator", 3]]);
    return P.concat([
      ["push", `Deck presses ${600} N up against the machined stop faces → height and position are now set by steel on steel`, 1.4],
      ["tr", `E84 handshake, both chains run: the pallet moves onto the station until the retractable stop (±${M.xstop} mm lengthwise)`, 2.6],
      ["set", `Station chains lower: the pull studs drop into the receivers (catch ±${M.rlead} mm) → pallet at ±${M.rec} mm`, 2.4],
      ["ret", `Deck lowers and leaves the pins. The springs pull it back to about ${f(R.xres, 1)} mm, then the conical lock pin centres it exactly`, 3],
      ["lv", "AGV drives away – the deck is locked and centred again for the next station", 1.4]]);
  }
  if (scn === "B") {
    const fault = Math.abs(e) >= M.gcl + M.gfl;
    const P = [
      ["arr", `AGV carries the crate in under the IN transfer position and stops – ${ae} mm off sideways (±${f(R.capB, 1)} mm possible)`, 2.4],
      ["low", fault ? `AGV lowers – but ${ae} mm is more than the flare catches (±${M.gcl + M.gfl} mm): the crate lands on top of the guide` : "AGV lowers: one crate edge touches the V-flare and slides down it. The crate slides on the PE top of the AGV plate to the middle", 3]];
    if (fault) return P.concat([["flt", "FAULT: crate tilted on the guide (sensor 'crate seated' missing) → AGV lifts again, re-positions, tries again", 2.6]]);
    return P.concat([
      ["set", `Crate sits on the chains between the guides: now ±${M.gcl} mm. The AGV lowers 20 mm more and drives out`, 1.8],
      ["conv", `Conveyor moves the crate to the P&D position: guided sideways ±${M.gcl} mm, stopped lengthwise ±${M.xconv} mm`, 2.4],
      ["fork", `Crane fork goes under the crate between the chains: clearance ±${M.fclr} mm, needed only ±${f(M.hpd + Math.max(M.gcl, M.xconv), 0)} mm`, 2.6],
      ["rack", `Crane stores the crate on 2 support angles: it is ±${f(M.hpd + M.gcl, 0)} mm off, the rack allows ±${M.rack} mm`, 2]]);
  }
  const c0 = M.gcl, rel = c0 + Math.abs(e), abs2 = Math.abs(e) + rel;
  const fRim = rel > M.rim, fSt = abs2 >= M.gcs + M.gst;
  const P = [
    ["wait", `Crate waits at the OUT transfer position, ${M.gcl} mm off (guide clearance – worst side)`, 1.4],
    ["arr", `AGV drives in under the crate and stops – ${ae} mm off, to the other side (worst case)`, 2],
    ["lift", fRim ? `AGV lifts: the crate is ${f(rel, 1)} mm off-centre – more than the rim play ±${M.rim} mm, the crate sits on the rim` : `AGV lifts: the crate now sits ${f(rel, 1)} mm off-centre on the plate. The rim (±${M.rim} mm) keeps it on the AGV`, 2.4]];
  if (fRim) return P.concat([["flt", "FAULT: crate tilted on the rim → load sensor on the plate stops the AGV. Fix: more rim play or less AGV error", 2.4]]);
  return P.concat([
    ["go", "AGV drives to the crate stand (mechanical item 2). Nothing centres the crate on the way", 1.6],
    ["arr2", `AGV stops at the stand – again ${ae} mm off. The two errors add up: crate ${f(abs2, 1)} mm off`, 2],
    ["low2", fSt ? `AGV lowers – ${f(abs2, 1)} mm is more than the stand flare catches (±${M.gst + M.gcs} mm)` : `AGV lowers: the 4 V-guides of the stand push the crate to the middle (catch ±${M.gst + M.gcs} mm)`, 3]].concat(fSt
    ? [["flt", "FAULT: crate on top of a V-guide → AGV lifts again and re-positions", 2.4]]
    : [["done", `Crate seated ±${M.gcs} mm – the errors did NOT stay, because the guides reset them at every set-down`, 1.6]]));
}
const phaseAt = (t, PH) => { let k = 0, t0 = 0; while (k < PH.length - 1 && t >= t0 + PH[k][2]) { t0 += PH[k][2]; k++; } return { k, key: PH[k][0], u: clamp((t - t0) / PH[k][2], 0, 1) }; };

/* ------------------------------------------------------------------ states */
function stA(t, PH, M, R, e) {
  const p = phaseAt(t, PH), u = p.u, E = ease(u), sg = Math.sign(e) || 1, gD = R.gD, gR = R.gR, gL = R.gL;
  const fault = Math.abs(e) >= gD.K, gStop = fault ? gD.Ls + gD.lc : 0, xs = M.xstop * 0.7;
  const dTop = (gap) => 140 + gap / R.G0 * 10;
  const s = { ...p, e, appr: 0, deckTop: 210, dOff: 0, lock: true, stCh: 152, stopUp: true, pal: 0, palB: null, push: false,
    mag: "dock", mo: e, mg: R.G0, err: Math.abs(e), lad: 0, fault };
  if (p.key === "arr") s.appr = 260 * (1 - E);
  else if (p.key === "unl") s.lock = u < 0.5;
  else if (p.key === "lift") { s.lock = false; s.deckTop = 210 - 60 * E; }
  else if (p.key === "dock" || p.key === "flt") {
    s.lock = false; const gap = p.key === "flt" ? gStop : R.G0 + (gStop - R.G0) * E;
    s.mg = gap; s.mo = fault ? e : sg * Math.min(Math.abs(e), allowed(gD, gap)); s.dOff = s.mo - e; s.deckTop = dTop(gap);
    s.err = Math.abs(s.mo); s.lad = !fault && gap < gD.Ls ? 1 : 0;
  } else if (p.key === "push") { s.lock = false; s.mg = 0; s.mo = sg * 0.02; s.dOff = -e; s.deckTop = 140; s.push = true; s.err = 0.03; s.lad = 1; }
  else if (p.key === "tr") {
    s.lock = false; s.dOff = -e; s.deckTop = 140; s.stCh = 152 - 12 * Math.min(1, u / 0.15); s.pal = ease(clamp((u - 0.15) / 0.85, 0, 1));
    s.mag = "rec"; s.mg = R.GR; s.mo = xs; s.err = xs; s.lad = 2;
  } else if (p.key === "set") {
    s.lock = false; s.dOff = -e; s.deckTop = 140; s.pal = 1; s.stCh = 140 + 12 * E; s.palB = Math.min(s.stCh, 150);
    s.mag = "rec"; s.mg = R.GR * (1 - E); s.mo = Math.min(xs, allowed(gR, s.mg)); s.err = Math.abs(s.mo) < 0.03 ? M.rec : Math.abs(s.mo); s.lad = E > 0.9 ? 3 : 2;
  } else if (p.key === "ret") {
    s.pal = 1; s.palB = 150; s.mag = "lock"; s.lad = 3; s.err = M.rec; s.stopUp = true;
    const u1 = clamp(u / 0.55, 0, 1), xr = Math.min(Math.abs(e), R.xres);
    s.deckTop = u1 < 0.3 ? dTop(R.G0 * ease(u1 / 0.3)) : 150 + 60 * ease((u1 - 0.3) / 0.7);
    s.dOff = -sg * lerp(Math.abs(e), xr, ease(clamp((u1 - 0.15) / 0.5, 0, 1)));
    s.lock = u > 0.6; s.mg = R.GL;
    if (u > 0.6) { s.mg = R.GL * (1 - ease((u - 0.6) / 0.4)); s.dOff = xr < gL.K ? -sg * Math.min(xr, allowed(gL, s.mg)) : s.dOff; }
    s.deckTop = Math.min(210, s.deckTop); s.mo = s.dOff;
  } else if (p.key === "lv") { s.pal = 1; s.palB = 150; s.appr = 260 * E; s.mag = "lock"; s.mg = 0; s.mo = 0.02; s.lad = 3; s.err = M.rec; }
  return s;
}
function stB(t, PH, M, R, e) {
  const p = phaseAt(t, PH), u = p.u, E = ease(u), sg = Math.sign(e) || 1;
  const P = { gcl: M.gcl, gfl: M.gfl, hs: 40, hfl: M.hfl }, fault = Math.abs(e) >= M.gcl + M.gfl, o = sg * Math.min(Math.abs(e), M.gcl);
  const s = { ...p, scene: "tr", agv: { vis: 1, x: e, plate: CARRY }, crate: { x: e, hb: CARRY - HC, tilt: 0, op: 1 }, fork: null, mag: "flare", P, err: Math.abs(e), lad: 0, fault };
  if (p.key === "arr") s.agv.vis = E;
  else if (p.key === "low" || p.key === "flt") {
    const plate = p.key === "flt" ? PLOW : CARRY - (CARRY - PLOW) * E; s.agv.plate = plate;
    if (fault) {
      const top = P.hs + P.hfl; s.crate.hb = Math.max(plate - HC, top); s.crate.x = e;
      s.crate.tilt = plate - HC < top ? -sg * 2.2 * Math.min(1, (top - (plate - HC)) / 40) : 0;
    } else { s.crate.hb = Math.max(0, plate - HC); s.crate.x = sg * Math.min(Math.abs(e), allowedFlare(P, s.crate.hb)); s.err = Math.abs(s.crate.x); s.lad = s.crate.hb <= 0 ? 1 : 0; }
  } else if (p.key === "set") {
    s.agv.plate = PLOW - 20 * Math.min(1, u / 0.3); s.agv.vis = 1 - ease(clamp((u - 0.4) / 0.6, 0, 1)); s.crate.x = o; s.crate.hb = 0; s.err = Math.abs(o); s.lad = 1;
  } else if (p.key === "conv") {
    s.agv.vis = 0; s.crate.x = o; s.crate.hb = 0; s.lad = 2; s.err = Math.max(Math.abs(o), M.xconv * 0.6);
    if (u < 0.5) s.crate.op = 1 - 2 * u; else { s.scene = "pd"; s.crate.op = 2 * u - 1; }
  } else if (p.key === "fork") {
    s.scene = "pd"; s.agv.vis = 0; s.crate.x = o; s.mag = "fork"; s.lad = 2; s.err = Math.abs(o) + M.hpd;
    s.fork = { vis: Math.min(1, u / 0.3), x: sg * M.hpd, top: HC - 20 + 70 * ease(clamp((u - 0.35) / 0.65, 0, 1)) };
    s.crate.hb = Math.max(0, s.fork.top - HC);
  } else if (p.key === "rack") {
    s.scene = "rack"; s.agv.vis = 0; s.crate.x = o + sg * M.hpd; s.crate.hb = 0; s.crate.op = Math.min(1, u * 3); s.mag = "rack"; s.lad = 3; s.err = Math.abs(s.crate.x);
  }
  return s;
}
function stC(t, PH, M, R, e) {
  const p = phaseAt(t, PH), u = p.u, E = ease(u), sg = Math.sign(e) || 1;
  const P = { gcl: M.gcl, gfl: M.gfl, hs: 40, hfl: M.hfl }, P2 = { gcl: M.gcs, gfl: M.gst, hs: 40, hfl: 60 };
  const c0 = -sg * M.gcl, rel = c0 - e, e2 = -e, abs2 = e2 + rel, sg2 = Math.sign(abs2) || 1;
  const fRim = Math.abs(rel) > M.rim, fSt = Math.abs(abs2) >= M.gcs + M.gst;
  const s = { ...p, scene: "tr", agv: { vis: 0, x: e, plate: PLOW }, crate: { x: c0, hb: 0, tilt: 0, op: 1 }, fork: null, mag: "flare", P, rel, err: M.gcl, lad: 0, fault: fRim || fSt };
  if (p.key === "arr") { s.agv.vis = E; }
  else if (p.key === "lift" || (p.key === "flt" && fRim)) {
    s.agv.vis = 1; s.agv.plate = p.key === "flt" ? CARRY : PLOW + (CARRY - PLOW) * E; s.crate.hb = Math.max(0, s.agv.plate - HC);
    s.mag = "rim"; s.err = Math.abs(rel); s.lad = 1; if (fRim) s.crate.tilt = sg * 2 * Math.min(1, s.crate.hb / 40);
  } else if (p.key === "go") {
    s.mag = "rim"; s.lad = 1; s.err = Math.abs(rel); s.agv.plate = CARRY; s.crate.hb = CARRY - HC;
    if (u < 0.5) { s.agv.vis = 1 - 2 * u; s.crate.op = 1 - 2 * u; }
    else { s.scene = "stand"; s.agv.vis = 0; s.crate.op = 0; }
  } else if (p.key === "arr2") {
    s.scene = "stand"; s.agv = { vis: E, x: e2, plate: CARRY }; s.crate = { x: abs2, hb: CARRY - HC, tilt: 0, op: E }; s.P = P2; s.lad = 2; s.err = Math.abs(abs2);
  } else if (p.key === "low2" || (p.key === "flt" && fSt)) {
    s.scene = "stand"; s.P = P2; const plate = p.key === "flt" ? PLOW : CARRY - (CARRY - PLOW) * E; s.agv = { vis: 1, x: e2, plate };
    if (fSt) { const top = P2.hs + P2.hfl; s.crate = { x: abs2, hb: Math.max(plate - HC, top), op: 1, tilt: plate - HC < top ? -sg2 * 2.2 * Math.min(1, (top - (plate - HC)) / 40) : 0 }; s.lad = 2; s.err = Math.abs(abs2); }
    else { const hb = Math.max(0, plate - HC); s.crate = { x: sg2 * Math.min(Math.abs(abs2), allowedFlare(P2, hb)), hb, tilt: 0, op: 1 }; s.err = Math.abs(s.crate.x); s.lad = hb <= 0 ? 3 : 2; }
  } else if (p.key === "done") {
    s.scene = "stand"; s.P = P2; s.agv = { vis: 1 - E, x: e2, plate: PLOW - 20 }; s.crate = { x: sg2 * Math.min(Math.abs(abs2), M.gcs), hb: 0, tilt: 0, op: 1 }; s.lad = 3; s.err = Math.abs(s.crate.x);
  }
  return s;
}

/* ------------------------------------------------------------------ drawing: overview */
const BOX = { x: 470, y: 34, w: 280, h: 250 };
const arrowDefs = `<defs><marker id="dkA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" fill="var(--critical)"/></marker>
  <marker id="dkB" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" fill="var(--text-2)"/></marker>
  <clipPath id="dkClip"><rect x="${BOX.x + 1}" y="${BOX.y + 1}" width="${BOX.w - 2}" height="${BOX.h - 2}" rx="8"/></clipPath></defs>`;

function sceneA(s) {
  const F = 312, amp = 2.5;
  const bx = 190 + s.e * amp + s.appr, deckX = bx + 10 + s.dOff * amp, dT = s.deckTop;
  let g = `<text x="10" y="18" class="apc-t" style="font-weight:600">Side view – pallet AGV at the APC load station</text><text x="10" y="32" class="apc-t">errors drawn ×16 so you can see them</text>`;
  g += `<line x1="8" y1="${F}" x2="455" y2="${F}" class="mx-floor"/>`;
  g += `<rect x="20" y="160" width="170" height="${F - 160}" class="mx-st" opacity=".3"/><text x="105" y="250" class="apc-t c">APC load station</text>`;
  for (const x of [70, 140]) g += `<rect x="${x - 11}" y="150" width="22" height="10" class="mx-rec"/>`;
  g += `<text x="105" y="178" class="apc-t c">receivers</text>`;
  g += `<rect x="24" y="${s.stCh}" width="164" height="5" fill="#3a4048"/>`;
  const sy = s.stopUp ? 116 : 150; g += `<rect x="11" y="${sy}" width="9" height="${F - sy}" class="mx-stop"/><text x="8" y="${sy - 6}" class="apc-t">stop</text>`;
  // bracket with cone pin + stop face (station)
  g += `<rect x="430" y="80" width="12" height="${F - 80}" class="mx-fix"/><rect x="362" y="86" width="80" height="14" class="mx-fix"/>`;
  g += `<path d="M380,100 L380,106 L383.6,116 L386.4,116 L390,106 L390,100 Z" fill="#3a4048"/><text x="372" y="78" class="apc-t r">cone pin + stop face</text>`;
  g += `<line x1="385" y1="60" x2="385" y2="${F}" stroke="var(--muted)" stroke-dasharray="4 3"/>`;
  // AGV body + scissor + floating deck
  g += `<line x1="${bx + 50}" y1="262" x2="${bx + 180}" y2="${dT + 14}" stroke="var(--text-2)" stroke-width="4"/><line x1="${bx + 50}" y1="${dT + 14}" x2="${bx + 180}" y2="262" stroke="var(--text-2)" stroke-width="4"/>`;
  g += `<rect x="${bx}" y="262" width="230" height="36" rx="4" class="mx-agv"/><circle cx="${bx + 45}" cy="300" r="12" class="mx-agvd"/><circle cx="${bx + 185}" cy="300" r="12" class="mx-agvd"/><text x="${bx + 70}" y="284" class="apc-t c">AGV body</text>`;
  g += `<rect x="${deckX}" y="${dT}" width="170" height="14" fill="#4f7fb0" stroke="#2f5680"/>`;
  g += `<rect x="${deckX + 170}" y="${dT - 40}" width="30" height="54" fill="#4f7fb0" stroke="#2f5680"/><rect x="${deckX + 181}" y="${dT - 40}" width="8" height="16" fill="var(--surface)"/>`;
  g += `<circle cx="${bx + 150}" cy="${280}" r="5" fill="${s.lock ? "#d03b3b" : "#2fa84f"}"/><text x="${bx + 158}" y="${284}" class="apc-t">lock pin ${s.lock ? "closed" : "open"}</text>`;
  g += `<line x1="${deckX + 185}" y1="${dT - 50}" x2="${deckX + 185}" y2="${dT + 18}" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="3 2"/>`;
  if (s.k <= 1) g += `<text x="${deckX + 85}" y="${dT - 8}" class="apc-t c">floating deck</text>`;
  if (s.push) g += `<line x1="${deckX + 185}" y1="${dT + 6}" x2="${deckX + 185}" y2="${dT - 34}" stroke="var(--critical)" stroke-width="3" marker-end="url(#dkA)"/><text x="${deckX + 160}" y="${dT + 34}" class="apc-t" style="fill:var(--critical)">600 N up</text>`;
  // pallet
  const px0 = deckX + 10, pX = lerp(px0, 30, s.pal), pB = s.palB ?? (s.pal > 0 ? 140 : dT);
  g += `<rect x="${pX}" y="${pB - 20}" width="150" height="20" class="mx-pal"/><text x="${pX + 75}" y="${pB - 6}" class="apc-t c">pallet</text>`;
  for (const dx of [40, 110]) g += `<rect x="${pX + dx - 4}" y="${pB}" width="8" height="10" fill="#3a4048"/>`;
  // error dimension
  const bushX = deckX + 185;
  if (Math.abs(bushX - 385) > 1.5 && s.appr === 0 && s.k <= 4) {
    const y = 52; g += `<line x1="385" y1="${y}" x2="${bushX}" y2="${y}" stroke="var(--critical)" stroke-width="1.5" marker-start="url(#dkA)" marker-end="url(#dkA)"/>`;
    g += `<text x="${Math.max(385, bushX) + 6}" y="${y + 4}" class="apc-t" style="fill:var(--critical)">${f(Math.abs((bushX - 385) / amp), 1)} mm</text>`;
  }
  return g;
}

function sceneFront(s, M) {
  const F = 312, cx = 225, sc = 0.22, amp = 1.5, CY = 242, VS = 0.8;     // widths 0.22 px/mm, small widths 1.5 px/mm, heights near the chain 0.8 px/mm
  const X = (big, small = 0) => cx + big * sc + small * amp, Yh = (h) => CY - (h - HC) * VS;
  const titles = { tr: "Front view – AS/RS conveyor, AGV transfer position", pd: "Front view – P&D position (inside the fence)", rack: "Front view – rack compartment", stand: "Front view – crate stand (mechanical item 2)" };
  let g = `<text x="10" y="18" class="apc-t" style="font-weight:600">${titles[s.scene]}</text><text x="10" y="32" class="apc-t">not to scale: small distances drawn bigger – real scale in the magnifier</text>`;
  g += `<line x1="8" y1="${F}" x2="455" y2="${F}" class="mx-floor"/>`;
  g += `<line x1="${cx}" y1="44" x2="${cx}" y2="${F}" stroke="var(--muted)" stroke-dasharray="4 3"/>`;
  const P = s.P;
  if (s.scene === "rack") {
    for (const sx of [1, -1]) {
      g += `<rect x="${X(sx * 500) - 4}" y="60" width="8" height="${F - 60}" class="mx-fix"/>`;
      const xi = X(sx * 400, -sx * (M.rack + 5)), xo = X(sx * 500); g += `<rect x="${Math.min(xi, xo)}" y="${Yh(HC)}" width="${Math.abs(xo - xi)}" height="5" fill="#3a4048"/>`;
    }
    g += `<text x="${X(500) + 8}" y="${Yh(HC) + 4}" class="apc-t">support angle</text>`;
  } else {
    for (const sx of [1, -1]) {
      g += `<rect x="${X(sx * 360) - 5}" y="${CY}" width="10" height="26" class="mx-fix"/><line x1="${X(sx * 360)}" y1="${CY + 26}" x2="${X(sx * 360)}" y2="${F}" stroke="#67717b" stroke-width="3"/>`;
      g += `<rect x="${X(sx * 360) - 6}" y="${Yh(HC) - 3}" width="12" height="3" fill="#3a4048"/>`;
      const xi = X(sx * 400, sx * P.gcl), y0 = Yh(HC + 8), y1 = Yh(HC + P.hs);
      g += `<line x1="${xi + sx * 1.5}" y1="${y0}" x2="${xi + sx * 1.5}" y2="${y1}" stroke="#c9b98a" stroke-width="3"/>`;
      if (s.scene !== "pd") g += `<line x1="${xi + sx * 1.5}" y1="${y1}" x2="${X(sx * 400, sx * (P.gcl + P.gfl)) + sx * 1.5}" y2="${Yh(HC + P.hs + P.hfl)}" stroke="#c9b98a" stroke-width="3"/>`;
    }
    g += `<text x="${X(-400, -(P.gcl + P.gfl))}" y="${Yh(HC + P.hs + P.hfl) - 8}" class="apc-t c">${s.scene === "pd" ? "side guide" : "V-flare (PE)"}</text>`;
    g += `<text x="${X(-360) - 10}" y="${CY + 20}" class="apc-t r">${s.scene === "stand" ? "stand rail" : "chain conveyor"}</text>`;
  }
  // AGV
  if (s.agv && s.agv.vis > 0.01) {
    const ax = X(0, s.agv.x), pw = 480 * sc, bw = 560 * sc;
    g += `<g opacity="${s.agv.vis.toFixed(2)}"><rect x="${ax - bw / 2}" y="${Yh(290)}" width="${bw}" height="${F - 8 - Yh(290)}" rx="4" class="mx-agv"/>`;
    g += `<circle cx="${ax - bw / 2 + 18}" cy="${F - 9}" r="9" class="mx-agvd"/><circle cx="${ax + bw / 2 - 18}" cy="${F - 9}" r="9" class="mx-agvd"/>`;
    g += `<rect x="${ax - 12}" y="${Yh(s.agv.plate)}" width="24" height="${Math.max(0, Yh(290) - Yh(s.agv.plate))}" fill="#9aa4ae"/>`;
    g += `<rect x="${ax - pw / 2}" y="${Yh(s.agv.plate)}" width="${pw}" height="4" fill="#3c6e9e"/><text x="${ax}" y="${F - 18}" class="apc-t c">AGV</text></g>`;
    g += `<line x1="${ax}" y1="${Yh(290)}" x2="${ax}" y2="${F}" stroke="var(--accent)" stroke-dasharray="3 2" opacity="${s.agv.vis.toFixed(2)}"/>`;
  }
  // fork
  if (s.fork) g += `<g opacity="${s.fork.vis.toFixed(2)}"><rect x="${X(-250, s.fork.x)}" y="${Yh(s.fork.top)}" width="${500 * sc}" height="12" fill="#e1a32a" stroke="#9a6b10"/><text x="${X(0, s.fork.x)}" y="${F - 30}" class="apc-t c">crane fork (comes towards you)</text></g>`;
  // crate
  const c = s.crate, ccx = X(0, c.x), cb = Yh(HC + c.hb), w = 800 * sc, h = 105;
  if (c.op > 0.01) {
    g += `<g opacity="${c.op.toFixed(2)}" transform="rotate(${c.tilt || 0} ${ccx} ${cb})"><rect x="${ccx - w / 2}" y="${cb - h}" width="${w}" height="${h}" fill="color-mix(in srgb, #b07a3a 28%, transparent)" stroke="#8a5a24" stroke-width="1.5"/>`;
    g += `<text x="${ccx}" y="${cb - h / 2}" class="apc-t c">crate</text><line x1="${ccx}" y1="${cb - h}" x2="${ccx}" y2="${cb}" stroke="#8a5a24" stroke-dasharray="3 3"/></g>`;
    if (Math.abs(c.x) > 0.3) {
      const y = cb - h - 10; g += `<line x1="${cx}" y1="${y}" x2="${ccx}" y2="${y}" stroke="var(--critical)" stroke-width="1.5" marker-start="url(#dkA)" marker-end="url(#dkA)"/>`;
      g += `<text x="${Math.max(cx, ccx) + 6}" y="${y + 4}" class="apc-t" style="fill:var(--critical)">${f(Math.abs(c.x), 1)} mm</text>`;
    }
  }
  if (s.agv && s.agv.vis > 0.01 && s.k === 0 && s.agv.vis < 0.99) g += `<text x="${cx}" y="${F - 50}" class="apc-t c">⊙ drives in towards you</text>`;
  return g;
}

/* ------------------------------------------------------------------ drawing: magnifier (real scale) */
function boxFrame(title) {
  return `<rect x="${BOX.x}" y="${BOX.y}" width="${BOX.w}" height="${BOX.h}" rx="8" fill="var(--surface)" stroke="var(--border)"/>
    <text x="${BOX.x}" y="${BOX.y - 8}" class="apc-t" style="font-weight:600">🔍 ${esc(title)}</text>`;
}
function poly(pts) { return pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" "); }
function magCone(geo, o, gap, opt) {
  const s = opt.s, cx = BOX.x + BOX.w / 2, base = opt.flip ? BOX.y + BOX.h - 34 : BOX.y + 30;
  const X = (x) => cx + x * s, Y = (y) => opt.flip ? base - y * s : base + y * s;
  const P = (pts) => poly(pts.map(([x, y]) => [X(x), Y(y)]));
  const r = geo.r, rt = geo.rt, Ls = geo.Ls, lc = geo.lc, h = opt.h || 22, w = r + geo.c + 9, gp = Math.min(gap, opt.gmax || 999);
  let g = boxFrame(opt.title) + `<g clip-path="url(#dkClip)">`;
  if (opt.face) g += `<rect x="${X(-(r + 22))}" y="${Math.min(Y(-9), Y(0))}" width="${(2 * r + 44) * s}" height="${9 * s}" fill="#67717b"/><text x="${X(r + 4)}" y="${Y(-3)}" class="apc-t" style="fill:#fff">stop face</text>`;
  g += `<polygon points="${P([[-r, opt.face ? 0 : -12], [-r, Ls], [-rt, Ls + lc], [rt, Ls + lc], [r, Ls], [r, opt.face ? 0 : -12]])}" fill="#3a4048"/>`;
  g += `<line x1="${X(0)}" y1="${BOX.y}" x2="${X(0)}" y2="${BOX.y + BOX.h}" stroke="var(--muted)" stroke-dasharray="5 3"/>`;
  const fx = o, top = gp, rb = geo.rb + 0.02, c = geo.c;
  const half = (sg) => P([[fx + sg * w, top], [fx + sg * (rb + c), top], [fx + sg * rb, top + c], [fx + sg * rb, top + h], [fx + sg * w, top + h]]);
  g += `<polygon points="${half(-1)}" fill="${opt.fc || "#4f7fb0"}" stroke="#2f5680"/><polygon points="${half(1)}" fill="${opt.fc || "#4f7fb0"}" stroke="#2f5680"/>`;
  g += `<line x1="${X(fx)}" y1="${BOX.y}" x2="${X(fx)}" y2="${BOX.y + BOX.h}" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="3 2"/>`;
  g += `</g>`;
  return g + magRead(o, geo.K, gap, { ...opt, leg: [["#3a4048", opt.lm], [opt.fc || "#4f7fb0", opt.lf]] });
}
function magRead(o, K, gap, opt) {
  const ok = Math.abs(o) <= 0.05, yl = BOX.y + BOX.h + 50;
  const leg = (opt.leg || []).map(([c, t], i) => `<rect x="${BOX.x + 10 + i * 140}" y="${yl - 9}" width="10" height="10" fill="${c}"/><text x="${BOX.x + 24 + i * 140}" y="${yl}" class="apc-t" style="font-size:10px">${esc(t)}</text>`).join("");
  return leg + `<rect x="${BOX.x}" y="${BOX.y + BOX.h + 6}" width="${BOX.w}" height="34" rx="6" fill="var(--surface-2)"/>
    <text x="${BOX.x + 10}" y="${BOX.y + BOX.h + 20}" class="apc-t" style="fill:var(--text)">offset now <tspan style="font-weight:700;fill:${ok ? "var(--good-text)" : "var(--critical)"}">${f(Math.abs(o), Math.abs(o) < 1 ? 2 : 1)} mm</tspan>   ·   catch range ±${f(K, 1)} mm</text>
    <text x="${BOX.x + 10}" y="${BOX.y + BOX.h + 34}" class="apc-t">${gap != null ? `gap still ${f(Math.max(0, gap), 1)} mm · ` : ""}${esc(opt.note || "drawn at real scale ×" + opt.s)}</text>`;
}
function magFlare(P, o, hb, opt) {
  const s = Math.min(265 / (100 + P.gcl + P.gfl), 210 / (P.hs + P.hfl + 85));
  const X = (x) => BOX.x + 10 + (x + 75) * s, Y = (y) => BOX.y + BOX.h - 14 - (y + 15) * s, Pp = (pts) => poly(pts.map(([x, y]) => [X(x), Y(y)]));
  let g = boxFrame(opt.title) + `<g clip-path="url(#dkClip)">`;
  g += `<rect x="${X(-60)}" y="${Y(0)}" width="${40 * s}" height="${15 * s}" fill="#3a4048"/>`;
  g += `<polygon points="${Pp([[P.gcl, 8], [P.gcl, P.hs], [P.gcl + P.gfl, P.hs + P.hfl], [P.gcl + P.gfl + 10, P.hs + P.hfl], [P.gcl + 10, P.hs], [P.gcl + 10, 8]])}" fill="#e9dfbf" stroke="#9a8650"/>`;
  g += `<rect x="${X(o - 90)}" y="${Y(hb + 90)}" width="${90 * s}" height="${90 * s}" fill="color-mix(in srgb, #b07a3a 28%, transparent)" stroke="#8a5a24" stroke-width="1.5"/>`;
  g += `<line x1="${X(0)}" y1="${BOX.y}" x2="${X(0)}" y2="${BOX.y + BOX.h}" stroke="var(--muted)" stroke-dasharray="5 3"/>`;
  g += `</g><text x="${X(o - 45)}" y="${Y(hb + 45)}" class="apc-t c">crate edge</text><text x="${X(P.gcl + P.gfl) - 4}" y="${Y(P.hs + P.hfl) - 8}" class="apc-t r">V-flare ${P.gfl} mm</text>`;
  g += `<text x="${X(-40)}" y="${Y(0) + 15 * s + 12}" class="apc-t c">${esc(opt.sup || "chain")}</text><text x="${X(0) + 3}" y="${BOX.y + 14}" class="apc-t">centre position</text>`;
  return g + magRead(o, P.gcl + P.gfl, null, { s: f(s, 1), note: `seated: ±${P.gcl} mm (guide clearance) · real scale ×${f(s, 1)}` });
}
function magRim(M, rel, hb) {
  const o = Math.abs(rel), s = 260 / (M.rim + 110);
  const X = (x) => BOX.x + 10 + (x + 90) * s, Y = (y) => BOX.y + BOX.h - 40 - y * s;
  let g = boxFrame("Magnifier – crate on the AGV plate (rim)") + `<g clip-path="url(#dkClip)">`;
  g += `<rect x="${X(-120)}" y="${Y(0)}" width="${(M.rim + 120) * s}" height="${10 * s}" fill="#3c6e9e"/><rect x="${X(M.rim)}" y="${Y(15)}" width="${8 * s}" height="${25 * s}" fill="#3c6e9e"/>`;
  g += `<rect x="${X(o - 120)}" y="${Y(hb + 100)}" width="${120 * s}" height="${100 * s}" fill="color-mix(in srgb, #b07a3a 28%, transparent)" stroke="#8a5a24" stroke-width="1.5"/>`;
  g += `<line x1="${X(0)}" y1="${BOX.y}" x2="${X(0)}" y2="${BOX.y + BOX.h}" stroke="var(--muted)" stroke-dasharray="5 3"/></g>`;
  g += `<text x="${X(M.rim) + 4}" y="${Y(28)}" class="apc-t r">rim</text><text x="${X(-60)}" y="${Y(0) + 10 * s + 13}" class="apc-t c">AGV plate (PE top)</text><text x="${X(o - 60)}" y="${Y(hb + 50)}" class="apc-t c">crate edge</text>`;
  return g + magRead(rel, M.rim, null, { note: `play left to the rim: ${f(M.rim - o, 1)} mm · real scale ×${f(s, 1)}` });
}
function magFork(M, o) {
  const s = 260 / 820, cx = BOX.x + BOX.w / 2, X = (x) => cx + x * s, yb = BOX.y + 150, cl = 500 + 2 * M.fclr;
  let g = boxFrame("Clearance – fork between the chains (to scale)");
  for (const sx of [1, -1]) g += `<rect x="${X(sx * cl / 2) - (sx > 0 ? 0 : 40 * s)}" y="${yb - 40}" width="${40 * s}" height="70" fill="#67717b"/>`;
  g += `<rect x="${X(-400 + o)}" y="${yb - 130}" width="${800 * s}" height="88" fill="color-mix(in srgb, #b07a3a 28%, transparent)" stroke="#8a5a24"/>`;
  g += `<rect x="${X(-250 + M.hpd)}" y="${yb - 30}" width="${500 * s}" height="16" fill="#e1a32a" stroke="#9a6b10"/>`;
  g += `<line x1="${X(250 + M.hpd)}" y1="${yb + 10}" x2="${X(cl / 2)}" y2="${yb + 10}" stroke="var(--text-2)" marker-start="url(#dkB)" marker-end="url(#dkB)"/><text x="${X(cl / 2)}" y="${yb + 50}" class="apc-t r">≈ ${f(M.fclr - M.hpd, 0)} mm left</text>`;
  g += `<text x="${cx}" y="${yb - 80}" class="apc-t c">crate (${f(Math.abs(o), 0)} mm off)</text><text x="${cx}" y="${yb - 17}" class="apc-t c">fork 500 mm (crane ±${M.hpd})</text><text x="${cx}" y="${yb + 70}" class="apc-t c">clear width between the chains ${f(cl, 0)} mm</text>`;
  return g + magRead(Math.abs(o) + M.hpd, M.fclr, null, { note: "a fork needs clearance, not a cone" });
}
function magRack(M, o) {
  const a = Math.abs(o), ov = M.rack + 5 - a, s = 240 / (M.rack + 110);
  const X = (x) => BOX.x + 20 + (x + M.rack + 40) * s, Y = (y) => BOX.y + BOX.h - 60 - y * s;
  let g = boxFrame("Magnifier – crate edge on the support angle") + `<g clip-path="url(#dkClip)">`;
  g += `<rect x="${X(-(M.rack + 5))}" y="${Y(0)}" width="${(M.rack + 5 + 80) * s}" height="${8 * s}" fill="#3a4048"/><rect x="${X(80)}" y="${Y(120)}" width="${12 * s}" height="${200 * s}" fill="#67717b"/>`;
  g += `<rect x="${X(-a - 140) }" y="${Y(100)}" width="${140 * s}" height="${100 * s}" fill="color-mix(in srgb, #b07a3a 28%, transparent)" stroke="#8a5a24" stroke-width="1.5"/>`;
  g += `<line x1="${X(0)}" y1="${BOX.y}" x2="${X(0)}" y2="${BOX.y + BOX.h}" stroke="var(--muted)" stroke-dasharray="5 3"/></g>`;
  g += `<text x="${X(40)}" y="${Y(0) + 26}" class="apc-t c">support angle</text><text x="${X(86)}" y="${Y(120) - 6}" class="apc-t c">upright</text>`;
  g += `<text x="${BOX.x + 10}" y="${BOX.y + 20}" class="apc-t">worst side: crate moved away from this angle</text>`;
  return g + magRead(a, M.rack, null, { note: `the crate edge still rests ${f(ov, 0)} mm on the angle · real scale ×${f(s, 1)}` });
}
function magnifier(s, M, R) {
  if (s.mag === "dock") return magCone(R.gD, s.mo, s.mg, { s: 3, face: true, gmax: 80, title: "Magnifier – cone pin + bush (real scale ×3)", lm: "cone pin Ø25 (station)", lf: "bush Ø25 H7 (deck)" });
  if (s.mag === "rec") return magCone(R.gR, s.mo, s.mg, { s: 5, h: 18, title: "Magnifier – pull stud into receiver (×5)", lm: "pull stud (pallet)", lf: "receiver (station)", fc: "#c9d0d6" });
  if (s.mag === "lock") return magCone(R.gL, s.mo, s.mg, { s: 4, flip: true, h: 18, title: "Magnifier – lock pin into the deck (×4)", lm: "lock pin (AGV body)", lf: "cone hole (deck)" });
  if (s.mag === "flare") return magFlare(s.P, Math.abs(s.crate.x), s.crate.hb, { title: "Magnifier – crate edge on the V-flare", sup: s.scene === "stand" ? "rail" : "chain" });
  if (s.mag === "rim") return magRim(M, s.rel, Math.max(0, HC + (s.crate.hb || 0) - s.agv.plate));
  if (s.mag === "fork") return magFork(M, s.crate.x);
  return magRack(M, s.crate.x);
}

/* ------------------------------------------------------------------ drawing: error ladder */
function ladderSVG(ch, idx, run, fault) {
  const W = 760, rowH = 36, H = 50 + ch.length * rowH, X0 = 250, X1 = W - 110;
  const lx = (v) => X0 + (Math.log10(clamp(v, 0.01, 100)) + 2) / 4 * (X1 - X0);
  let g = `<svg viewBox="0 0 ${W} ${H}" class="apc-svg" aria-label="Error ladder: accuracy at each stage">`;
  for (const v of [0.01, 0.1, 1, 10, 100]) g += `<line x1="${lx(v)}" y1="22" x2="${lx(v)}" y2="${H - 22}" stroke="var(--grid)"/><text x="${lx(v)}" y="${H - 8}" class="apc-t c">${v} mm</text>`;
  g += `<text x="${X0}" y="14" class="apc-t">worst-case error (± mm, log scale)   │ = what the next part can catch   ● = this run</text>`;
  ch.forEach((c, i) => {
    const y = 30 + i * rowH, on = i === idx, bad = fault && on;
    g += `<rect x="4" y="${y - 4}" width="${W - 8}" height="${rowH - 4}" rx="6" fill="${on ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "none"}"/>`;
    g += `<text x="12" y="${y + 12}" class="apc-t" style="fill:var(--text);font-weight:${on ? 700 : 400}">${esc(c.st)}</text><text x="12" y="${y + 25}" class="apc-t" style="font-size:10px">${esc(c.by)}</text>`;
    g += `<rect x="${X0}" y="${y + 4}" width="${Math.max(2, lx(c.acc) - X0)}" height="12" rx="3" fill="var(--accent)" opacity="${on ? 0.9 : 0.45}"/>`;
    g += `<text x="${X1 + 10}" y="${y + 15}" class="apc-t" style="fill:var(--text);font-weight:600">±${f(c.acc, c.acc < 0.1 ? 2 : 1)} mm</text>`;
    if (c.cat != null) {
      const col = c.st2 === "bad" ? "var(--critical)" : c.st2 === "warn" ? "var(--warning)" : "var(--good)";
      g += `<line x1="${lx(c.cat)}" y1="${y}" x2="${lx(c.cat)}" y2="${y + 22}" stroke="${col}" stroke-width="3"/><text x="${lx(c.cat) + 5}" y="${y + 27}" class="apc-t" style="font-size:10px">${esc(c.cby)} ±${f(c.cat, 1)}</text>`;
    }
    if (run[i] != null) g += `<circle cx="${lx(run[i])}" cy="${y + 10}" r="5" fill="${bad ? "var(--critical)" : "var(--text)"}" stroke="var(--surface)" stroke-width="2"/>`;
  });
  return g + `</svg>`;
}

/* ------------------------------------------------------------------ UI */
const box = $("avItem4");
if (box) {
  box.innerHTML = `
    <div class="kpis" id="dkKpis"></div>
    <div class="card">
      <div class="card-head"><h2>Docking animation – how ±10 mm becomes exact</h2><span class="sub">left: overview · right: magnifier at real scale · below: error at each stage</span></div>
      <div class="apc3d-bar">
        <span class="tb-label">Case</span><div class="seg" role="group" aria-label="Case">
          <button class="seg-btn active" data-dkscn="A">A · Pallet AGV → APC station</button><button class="seg-btn" data-dkscn="B">B · Crate AGV → AS/RS (IN)</button><button class="seg-btn" data-dkscn="C">C · AS/RS (OUT) → AGV → crate stand</button></div>
      </div>
      <div class="apc3d-bar"><button class="btn primary" id="dkPlay">▶ Play</button><button class="btn ghost" id="dkPrev" title="previous step">◀</button><button class="btn ghost" id="dkNext" title="next step">▶|</button>
        <input type="range" id="dkScrub" min="0" max="1000" value="0" aria-label="Time"></div>
      <div class="apc3d-bar">
        <span class="tb-label">AGV stop error this run</span><input type="range" id="dkE" min="-60" max="60" step="0.5" value="6" aria-label="AGV stop error" style="max-width:220px"><b id="dkEv"></b>
        <button class="btn ghost" id="dkRnd">🎲 random run</button><button class="btn ghost" id="dkWorst">worst case</button><button class="btn ghost" id="dkBig">too big (fault)</button>
      </div>
      <div class="dk-step" id="dkStep"></div>
      <div id="dkSvg" class="dk-svg"></div>
      <div id="dkLad" class="dk-svg" style="margin-top:6px"></div>
      <p class="hint" id="dkNote"></p>
    </div>
    <div class="grid2 eq" style="margin-top:0">
      <div class="card"><div class="card-head"><h2>Steps</h2><span class="sub">click a step to jump</span></div><div class="table-wrap"><table class="apc-bom apc-seq"><thead><tr><th>#</th><th>Step</th><th>Time</th></tr></thead><tbody id="dkSteps"></tbody></table></div></div>
      <div class="card"><div class="card-head"><h2>Accuracy chain</h2><span class="sub">each stage must fit into the catch range of the next part</span></div><div class="table-wrap"><table class="apc-bom" id="dkChain"></table></div></div>
    </div>
    <div class="grid2 eq" style="margin-top:0">
      <div class="card"><div class="card-head"><h2>7 rules for every docking point</h2></div><div class="mx-guide" id="dkRules"></div></div>
      <div class="card"><div class="card-head"><h2>Why so different? APC ±0.02 mm, AS/RS ±10 mm</h2></div><div class="table-wrap"><table class="apc-bom" id="dkCmp"></table></div><p class="hint" id="dkCmpNote"></p></div>
    </div>
    <div class="apc-main">
      <div class="card apc-incard"><div class="card-head"><h2>Inputs</h2><button class="btn ghost" id="dkReset">Example values</button></div><div id="dkInputs"></div>
        <p class="hint">Same example values as AGV item 3 and mechanical items 1–3. Change them here to try other designs.</p></div>
      <div class="apc-right">
        <div class="card"><div class="card-head"><h2>Checks</h2></div><div id="dkChecks" class="apc-checks"></div></div>
        <div class="card"><div class="card-head"><h2>Calculations</h2><span class="sub">formulas with your numbers</span></div><div id="dkCalc" class="apc-calc"></div></div>
      </div>
    </div>
    <div class="card" style="margin-top:16px"><div class="card-head"><h2>How to prove it in the real factory</h2><span class="sub">acceptance tests for the docking points</span></div><div class="table-wrap"><table class="apc-bom" id="dkTest"></table></div></div>`;

  let M = { ...DEF };
  try { Object.assign(M, JSON.parse(localStorage.getItem("agvDockState") || "{}")); } catch (er) { /* private window */ }
  let R = calc(M), scn = "A", e = 6, PH = phases(scn, M, R, e), T = 0, playing = false, last = performance.now(), started = false;
  const tot = () => PH.reduce((s, r) => s + r[2], 0), pane = $("tab-agv"), cls = { ok: "apc-ok", warn: "apc-warn", bad: "apc-bad" };
  const blk = (t, rows, note) => `<div class="apc-blk"><h3>${t}</h3><div class="gc-formula">${rows.join("\n")}</div>${note ? `<p class="hint">${note}</p>` : ""}</div>`;
  const cap = () => (scn === "A" ? R.capA : R.capB);
  const limit = () => (scn === "A" ? R.gD.K : scn === "B" ? M.gcl + M.gfl : Math.min(M.rim - M.gcl, (M.gst + M.gcs - M.gcl) / 2));

  function inputs() {
    $("dkInputs").innerHTML = GROUPS.map(([g, fs]) => `<fieldset class="apc-fs"><legend>${esc(g)}</legend>${fs.map(([k, l, u, d, n]) =>
      `<label class="apc-f" title="${esc(n || "")}"><span>${esc(l)}${n ? ` <i class="muted">${esc(n)}</i>` : ""}</span>
        <span class="apc-in"><input type="number" step="any" data-k="${k}" value="${M[k]}" aria-label="${esc(l)}"${M[k] !== d ? ' class="chg"' : ""}><em>${esc(u)}</em></span></label>`).join("")}</fieldset>`).join("");
  }
  function checks() {
    const c = [], add = (l, ok, warn, t) => c.push([l, ok ? "ok" : warn ? "warn" : "bad", t]);
    add("A · Cone pin catches the AGV", R.gD.K >= R.capA + 2, R.gD.K >= R.capA, `±${f(R.gD.K, 1)} ≥ ±${f(R.capA, 1)} mm + 2`);
    add("A · Deck float ≥ AGV error", M.fl >= R.capA + 5, M.fl >= R.capA, `±${M.fl} ≥ ±${f(R.capA, 1)} mm + 5`);
    add("A · Lock pin re-centres the deck", R.xres <= M.llk - 2, R.xres < M.llk, `springs leave ${f(R.xres, 1)} mm, lock pin catches ±${M.llk} mm`);
    add("A · Receivers catch the pallet", M.rlead >= Math.max(M.fit, M.xstop) * 1.5, M.rlead >= Math.max(M.fit, M.xstop), `±${M.rlead} ≥ ±${Math.max(M.fit, M.xstop)} mm`);
    add("A · Cone force small", R.Fv <= 300, R.Fv <= 600, `${f(R.Fv, 0)} N vertical to slide the deck (lift has kN)`);
    add("B · V-flare catches the AGV", M.gcl + M.gfl >= R.capB + 5, M.gcl + M.gfl >= R.capB, `±${M.gcl + M.gfl} ≥ ±${f(R.capB, 1)} mm + 5`);
    add("B · Flare steep enough (crate slides)", R.thB >= R.phi + 20, R.thB > R.phi, `${f(R.thB, 0)}° from horizontal > friction angle ${f(R.phi, 0)}°`);
    add("B · Fork clearance", M.fclr >= M.hpd + Math.max(M.gcl, M.xconv) + 20, M.fclr >= M.hpd + Math.max(M.gcl, M.xconv), `±${M.fclr} ≥ ±${f(M.hpd + Math.max(M.gcl, M.xconv), 0)} mm`);
    add("B · Crate rests safely in the rack", M.rack >= (M.hpd + M.gcl) * 1.5, M.rack >= M.hpd + M.gcl, `±${M.rack} ≥ ±${M.hpd + M.gcl} mm`);
    add("C · Rim holds the off-centre crate", M.rim >= R.plateC + 3, M.rim >= R.plateC, `±${M.rim} ≥ ±${f(R.plateC, 1)} mm`);
    add("C · Stand flare catches both errors", M.gst + M.gcs >= R.standC + 5, M.gst + M.gcs >= R.standC, `±${M.gst + M.gcs} ≥ ±${f(R.standC, 1)} mm`);
    add("C · Stand flare steep enough", R.thS > R.phi + 20, R.thS > R.phi, `${f(R.thS, 0)}° > ${f(R.phi, 0)}°`);
    return c;
  }
  function formulas() {
    $("dkCalc").innerHTML = [
      blk("1 · Worst AGV error at the docking point", [`e = stop error + lever · sin(angle)`, `A: e = ${M.nav} + ${M.zPin} · sin ${M.yaw}° = ${M.nav} + ${f(R.yawA, 1)} = <b>±${f(R.capA, 1)} mm</b>`, `B: e = ${M.nav} + ${M.half} · sin ${M.yaw}° = ${M.nav} + ${f(R.yawB, 1)} = <b>±${f(R.capB, 1)} mm</b>`],
        "The angle error matters: 0.5° over a long lever adds several mm."),
      blk("2 · Catch range of a cone", [`K = bore radius + chamfer − tip radius`, `cone pin: K = 12.5 + ${f(R.gD.c, 1)} − ${f(R.gD.rt, 1)} = <b>±${f(R.gD.K, 1)} mm</b>`, `cone length = (12.5 − ${f(R.gD.rt, 1)}) / tan 15° = ${f(R.gD.lc, 0)} mm`,
        `per mm lift the deck moves sideways tan 15° = ${f(TAN15, 2)} mm`]),
      blk("3 · Forces at the cone (A)", [`friction  F = μ · m · g = ${M.mub} · ${M.mfl} · 9.81 = ${f(R.Ffric, 0)} N`, `+ springs k · e = ${M.ksp} · ${f(R.capA, 1)} = ${f(M.ksp * R.capA, 0)} N  → ${f(R.Ffl, 0)} N sideways`,
        `vertical  Fv = F · (tan15° + μ) / (1 − μ·tan15°) = <b>${f(R.Fv, 0)} N</b>`, `springs leave x = F_friction / k = <b>${f(R.xres, 1)} mm</b> → lock pin ±${M.llk}`],
        "That is why the deck must FLOAT: pushing the whole AGV sideways would need several kN against the tyre grip."),
      blk("4 · V-flare (B, C)", [`catch = clearance + flare = ${M.gcl} + ${M.gfl} = <b>±${M.gcl + M.gfl} mm</b>`, `flare angle θ = atan(${M.hfl} / ${M.gfl}) = ${f(R.thB, 0)}°, friction angle φ = atan ${M.mug} = ${f(R.phi, 0)}°`, `θ > φ → the crate slides down, it does not stick`]),
      blk("5 · Errors add up when nothing re-centres (C)", [`on the plate:  ${f(R.capB, 1)} + ${M.gcl} = ${f(R.plateC, 1)} mm  (rim ±${M.rim})`, `at the stand:  ${f(R.capB, 1)} + ${f(R.plateC, 1)} = <b>${f(R.standC, 1)} mm</b>  (stand flare ±${M.gst + M.gcs})`, `after the guides: ±${M.gcs} mm – reset`]),
    ].join("");
  }
  function tables() {
    const ch = R.chains[scn];
    $("dkChain").innerHTML = `<thead><tr><th>Stage</th><th>Set by</th><th>Accuracy</th><th>Next part catches</th><th></th></tr></thead><tbody>${ch.map((c) =>
      `<tr><td><b>${esc(c.st)}</b></td><td>${esc(c.by)}<br><span class="muted small">${esc(c.how)}</span></td><td>±${f(c.acc, c.acc < 0.1 ? 2 : 1)} mm</td><td>${c.cat == null ? `<span class="muted">${esc(c.cby)}</span>` : `${esc(c.cby)}: ±${f(c.cat, 1)} mm${c.needV !== c.acc ? `<br><span class="muted small">needs ±${f(c.needV, 1)}</span>` : ""}`}</td>
        <td>${c.st2 ? `<span class="${cls[c.st2]}" style="padding:2px 8px;border-radius:6px">${c.st2 === "ok" ? "✓" : c.st2 === "warn" ? "! tight" : "✕"}</span>` : ""}</td></tr>`).join("")}</tbody>`;
    $("dkRules").innerHTML = `<ol>
      <li><b>The AGV only brings the load close (±${M.nav} mm).</b> Never ask the navigation for the fine position – mechanical parts do that.</li>
      <li><b>The part that must move must be free to move:</b> floating deck (A), crate sliding on the PE plate (B, C). A rigid AGV cannot be pushed sideways.</li>
      <li><b>Catch range ≥ worst error + reserve.</b> Worst error = stop error + lever · sin(angle). Reserve 2–5 mm.</li>
      <li><b>Guide faces steeper than the friction angle</b> (θ > φ = atan μ), hardened or PE, with a chamfer – then it slides, it does not jam.</li>
      <li><b>The reference is on the STATION, not on the AGV:</b> cone pins, stop faces, receivers, guides. Floor, tyres and AGV wear then do not matter.</li>
      <li><b>Never fix one direction twice:</b> 1 round + 1 diamond pin, receivers round + slot + clearance. Over-determined parts jam.</li>
      <li><b>Confirm with a sensor before the next step</b> ("docked", "seated", "pallet present"). If missing: back off and retry, never force.</li></ol>`;
    $("dkCmp").innerHTML = `<thead><tr><th></th><th>A · APC station</th><th>B/C · AS/RS + crate stand</th></tr></thead><tbody>
      <tr><td>Load</td><td>machining pallet with workpiece</td><td>crate with castings / parts</td></tr>
      <tr><td>Needed at the end</td><td><b>±${M.rec} mm</b> (machine zero-point)</td><td><b>±${M.rack} mm</b> (rack), fork ±${M.fclr}</td></tr>
      <tr><td>Steps</td><td>3: cone pins → stop → receivers</td><td>1: V-flare (then just clearance)</td></tr>
      <tr><td>Parts</td><td>floating deck, hardened pins + bushes, machined faces, receivers</td><td>bent steel + PE strips, rim on the plate</td></tr>
      <tr><td>Cost (example)</td><td>high – precision machining</td><td>low – welded + PE</td></tr></tbody>`;
    $("dkCmpNote").textContent = "The accuracy needed at the END decides how many catching steps you build. Each step reduces the error about 10–100 ×. Do not build precision where a crane only needs clearance.";
    const tests = {
      A: [["Catch range", `teach the stop ${f(R.capA + 2, 0)} mm wrong on purpose (all 4 directions) and ±${M.yaw}°`, "cones still catch, no hard hit, 'docked' sensor ON"],
        ["Repeatability", "50 deliveries + 50 pick-ups, AGV stops anywhere inside its tolerance", "no fault, studs seated every time (air check)"],
        ["Height", "dial gauge on the deck chain top when docked", "transfer height ±0.2 mm"], ["Re-centring", "after each hand-over: feeler gauge at the lock pin", "deck locked, 0 mm offset"],
        ["Fault test", "teach the stop " + f(R.gD.K + 3, 0) + " mm wrong", "deck stops early → fault + retry, no damage"]],
      B: [["Catch range", `AGV stopped ±${f(R.capB + 2, 0)} mm off, 20 transfers per lane`, "crate seated, no tilt, 'seated' sensor ON"], ["Fork", "100 crane cycles at the P&D", "fork never touches crate or chains"],
        ["Rack", "store / retrieve 50 crates, measure the edge overlap", `≥ ${f(M.rack - M.hpd - M.gcl, 0)} mm on both angles`], ["Fault test", `AGV ${f(M.gcl + M.gfl + 5, 0)} mm off`, "crate tilt detected, AGV lifts and retries"]],
      C: [["Rim", "pick up 20 crates with the AGV taught 10 mm off", "crate always inside the rim, no tilt"], ["Stand", "deliver with stop error left / right / angle", "crate seated in all 4 V-guides"],
        ["Chain of errors", "pick at the AS/RS, deliver to the stand 30 ×, measure the crate position at the stand", `±${M.gcs} mm every time`]],
    };
    $("dkTest").innerHTML = `<thead><tr><th>Test</th><th>How</th><th>Pass if</th></tr></thead><tbody>${tests[scn].map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join("")}</tbody>`;
  }
  function render() {
    R = calc(M); PH = phases(scn, M, R, e); T = Math.min(T, tot());
    const ch = checks();
    $("dkKpis").innerHTML = [["A · AGV error at the pin", "±" + f(R.capA, 1) + " mm", `cone catches ±${f(R.gD.K, 1)} mm`], ["A · Pallet at the end", "±" + M.rec + " mm", "receivers (zero-point)"],
      ["B · AGV error at the crate", "±" + f(R.capB, 1) + " mm", `V-flare catches ±${M.gcl + M.gfl} mm`], ["B · Crate on the conveyor", "±" + M.gcl + " mm", "guide clearance"],
      ["C · Crate at the stand", "±" + f(R.standC, 1) + " mm", `two errors added, flare ±${M.gst + M.gcs}`],
      ["Checks", ch.filter((x) => x[1] === "ok").length + " / " + ch.length + " OK", ch.some((x) => x[1] === "bad") ? "see the red lines" : ch.some((x) => x[1] === "warn") ? "some are tight" : "all fine"]]
      .map(([l, v, n]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="note">${esc(n)}</div></div>`).join("");
    $("dkChecks").innerHTML = ch.map(([l, s, t]) => `<div class="apc-chk ${cls[s]}"><b>${s === "ok" ? "✓" : s === "warn" ? "!" : "✕"}</b><span>${esc(l)}</span><span class="muted">${esc(t)}</span></div>`).join("");
    formulas(); tables(); draw();
  }
  function runVals(s) {
    const a = Math.abs(e);
    if (scn === "A") return [a, 0.03, M.xstop * 0.7, M.rec];
    if (scn === "B") { const o = Math.min(a, M.gcl); return [a, o, Math.max(o, M.xconv * 0.6), o + M.hpd]; }
    return [M.gcl, M.gcl + a, 2 * a + M.gcl, Math.min(2 * a + M.gcl, M.gcs)];
  }
  function draw() {
    const s = scn === "A" ? stA(T, PH, M, R, e) : scn === "B" ? stB(T, PH, M, R, e) : stC(T, PH, M, R, e);
    const W = 760, H = 350;
    $("dkSvg").innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="apc-svg" aria-label="Docking animation">${arrowDefs}${scn === "A" ? sceneA(s) : sceneFront(s, M)}${magnifier(s, M, R)}</svg>`;
    const fl = s.key === "flt" || (s.fault && (s.key === "dock" || s.key === "low" || s.key === "low2" || s.key === "lift") && s.u > 0.95);
    $("dkStep").innerHTML = `<span class="dk-n">${s.k + 1}/${PH.length}</span> <b${s.key === "flt" ? ' style="color:var(--critical)"' : ""}>${esc(PH[s.k][1])}</b>
      <span class="dk-err">load error now <b>${f(s.err, s.err < 1 ? 2 : 1)} mm</b></span>`;
    $("dkLad").innerHTML = ladderSVG(R.chains[scn], s.lad, runVals(s), fl);
    $("dkScrub").value = Math.round(T / tot() * 1000); $("dkPlay").textContent = playing ? "❚❚ Pause" : "▶ Play";
    $("dkSteps").innerHTML = PH.map((r, i) => `<tr class="${i === s.k ? "on" : ""}" data-dkk="${i}" style="cursor:pointer"><td>${i + 1}</td><td>${esc(r[1])}</td><td>${f(r[2], 1)} s</td></tr>`).join("");
    $("dkEv").textContent = `${e > 0 ? "+" : ""}${f(e, 1)} mm` + (Math.abs(e) > limit() ? " → fault" : Math.abs(e) > cap() ? " (more than the AGV should do)" : "");
    const notes = {
      A: `The AGV error is taken by the floating deck, not by moving the AGV. The magnifier is at real scale: watch the bush slide ${f(TAN15, 2)} mm sideways per mm of lift.`,
      B: "One step is enough here: the crane fork needs clearance, not precision. The crate slides on the PE plate of the AGV while the V-flare pushes it.",
      C: "Errors add up while the crate rides on the AGV, so the next set-down point needs a bigger flare. Every V-guide resets the error to its small clearance.",
    };
    $("dkNote").textContent = notes[scn];
  }
  const stepStart = (k) => PH.slice(0, k).reduce((a, r) => a + r[2], 0);
  function init() {
    if (started) return; started = true;
    const loop = (now) => { requestAnimationFrame(loop); const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (!pane || !pane.classList.contains("active") || box.hidden || !playing) return;
      T += dt; if (T >= tot()) { T = tot(); playing = false; } draw(); };
    requestAnimationFrame(loop);
  }
  const setE = (v) => { e = clamp(Math.round(v * 2) / 2, -60, 60); $("dkE").value = e; T = 0; playing = true; last = performance.now(); render(); };
  inputs(); render();
  $("dkInputs").addEventListener("change", (ev) => {
    const k = ev.target.dataset.k; if (!k) return;
    const v = parseFloat(ev.target.value); if (!Number.isFinite(v) || v <= 0) { ev.target.value = M[k]; return; }
    M[k] = v; ev.target.classList.toggle("chg", v !== DEF[k]);
    try { localStorage.setItem("agvDockState", JSON.stringify(M)); } catch (er) { /* ignore */ }
    render();
  });
  $("dkReset").addEventListener("click", () => { if (!confirm("Back to the example values?")) return; M = { ...DEF }; try { localStorage.removeItem("agvDockState"); } catch (er) { /* ignore */ } inputs(); render(); });
  $("dkPlay").addEventListener("click", () => { if (!playing && T >= tot()) T = 0; playing = !playing; last = performance.now(); draw(); });
  $("dkPrev").addEventListener("click", () => { playing = false; const k = phaseAt(T, PH).k; T = stepStart(Math.max(0, T - stepStart(k) < 0.3 ? k - 1 : k)); draw(); });
  $("dkNext").addEventListener("click", () => { playing = false; const k = phaseAt(T, PH).k; T = k + 1 < PH.length ? stepStart(k + 1) : tot(); draw(); });
  $("dkScrub").addEventListener("input", (ev) => { playing = false; T = tot() * ev.target.value / 1000; draw(); });
  $("dkSteps").addEventListener("click", (ev) => { const tr = ev.target.closest("[data-dkk]"); if (!tr) return; playing = false; T = stepStart(+tr.dataset.dkk) + 0.01; draw(); });
  $("dkE").addEventListener("input", (ev) => { e = parseFloat(ev.target.value); T = 0; playing = false; render(); });
  $("dkRnd").addEventListener("click", () => { const g = () => { let u = 0, v = 0; while (!u) u = Math.random(); v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    setE(clamp(g() * cap() / 2.5, -cap(), cap())); });
  $("dkWorst").addEventListener("click", () => setE(cap()));
  $("dkBig").addEventListener("click", () => setE(limit() + 3));
  box.querySelectorAll("[data-dkscn]").forEach((b) => b.addEventListener("click", () => {
    box.querySelectorAll("[data-dkscn]").forEach((x) => x.classList.toggle("active", x === b)); scn = b.dataset.dkscn; T = 0; playing = false; render(); }));
  window.agvDock = { show() { render(); init(); } };
  const q = new URLSearchParams(location.search);
  if (q.get("dkscn")) { const b = box.querySelector(`[data-dkscn="${q.get("dkscn")}"]`); if (b) b.click(); }
  if (q.get("dke")) { e = parseFloat(q.get("dke")) || 6; $("dkE").value = e; render(); }
  if (q.get("dkt")) { T = Math.min(tot(), parseFloat(q.get("dkt")) || 0); draw(); }
}
