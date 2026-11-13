/* Ball screw + guide factory – item 2: machine modules for the parametric scene (bsfmfg_3d.js).
 * MODS[key](K, op, ctx) → { g, cam: [[target], [camera]], dur (s per loop at ×1), tick(T), read() → { rows: [[label, value]], chart? }, tags: [[text, obj, local]] }
 * ctx = { route: "BS" | "BN" | "LG" | "LB" | "FABS" | "FALG", f: { turned, milled, drilled, hard, thread, groundJ, groundOD, asm } }
 * Generic but recognisable machines; the real cycle time + data are in the info panel. ALL VALUES ARE EXAMPLES.
 */
import { BS, BN, LG, LB } from "./bsfprod_data.js";
import { railOutline, blockOutline } from "./bsfprod_geo.js";
import * as P from "./bsfmfg_calc.js";

const PI = Math.PI, TAU = 2 * PI;
const f0 = (v) => Math.round(v).toLocaleString("en-US").replace(/,/g, " "), f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2), f3 = (v) => v.toFixed(3);
const H0 = 1050;                     // work centre height (mm) of most machines

/* workpiece of the route in its current state (before this operation) */
function wp(K, ctx, o = {}) {
  const f = ctx.f || {}, r = ctx.route;
  if (r === "BS" || r === "FABS") {
    const st = o.stage || (f.thread ? "thread" : f.turned ? "turned" : "bar");
    return K.shaft(st, { hard: f.hard, groundJ: f.groundJ, groundOD: f.groundOD, threadClip: o.threadClip });
  }
  if (r === "BN") return K.nut(o.stage || (f.turned ? "full" : "slug"), { hard: f.hard, holes: f.milled, windows: f.milled });
  if (r === "LG" || r === "FALG") return K.rail(1000, { hard: f.hard, holes: f.drilled, stripes: f.hard });
  return K.block({ hard: f.hard, caps: f.asm });
}
const isLong = (ctx) => ["BS", "LG", "FABS", "FALG"].includes(ctx.route);
const partName = (ctx) => ({ BS: "screw shaft", BN: "ball nut", LG: "rail", LB: "carriage body", FABS: "ball screw set", FALG: "guide set" }[ctx.route]);
const rows = (op, extra) => ({ rows: extra });
/* lathe-like frame: bed + headstock (+ tailstock) on a moving table; returns parts */
function frame(K, L = 2600, o = {}) {
  const { C } = K, g = K.grp();
  g.add(K.boxB(L, 760, 900, C.body)); g.add(K.boxB(L - 60, 14, 520, C.iron, 0, 760, 0));
  const table = K.grp(); table.position.y = 774; g.add(table);
  if (o.table !== false) table.add(K.boxB(L - 400, 40, 360, C.iron));
  const hs = K.grp(K.boxB(340, H0 - 774 + 150, 380, C.body, 0, 0, 0), K.boxB(350, 10, 390, C.blue, 0, H0 - 774 + 145, 0)); hs.position.x = o.hsX ?? (-L / 2 + 360); table.add(hs);
  const ts = K.grp(K.boxB(240, H0 - 774 - 40, 300, C.body), K.cylX(40, 260, C.body2, -60, H0 - 774, 0)); ts.position.x = o.tsX ?? (L / 2 - 340); if (o.tail !== false) table.add(ts);
  return { g, table, hs, ts };
}
const tagW = (ctx, obj, y = 40) => [partName(ctx), obj, [0, y, 0]];

export const MODS = {
  /* ---------------------------------------------------------------- bandsaw / cold saw / cut-off */
  saw(K, op, ctx) {
    const { C } = K, g = K.grp(), p = op.p || {};
    g.add(K.boxB(1300, 820, 900, C.body)); g.add(K.boxB(1310, 10, 910, C.blue, 0, 815, 0));
    for (let k = 0; k < 7; k++) g.add(K.cylZ(30, 300, C.steel, -1500 + k * 180, 820, 0, 16));   // in-feed roller table
    g.add(K.boxB(1200, 780, 360, C.body2, -1100, 0, 0));
    const isRail = ["LG", "LB"].includes(ctx.route), y0 = 850;
    const len = ctx.route === "BN" || ctx.route === "LB" ? 800 : 1600, plen = { BS: 120, BN: 108, LG: 160, LB: 62 }[ctx.route] || 100;
    const mk = (L) => ctx.route === "LG" ? K.mesh(K.extrX(railOutline("O"), L), C.steel) : ctx.route === "LB" ? K.mesh(K.extrX(blockOutline("O"), L), C.steel) : K.cylX((p.d || 36) / 2, L, C.steel, 0, 0, 0, 40);
    const bar = mk(len), barX = -len / 2 - 2;
    const barG = K.grp(bar); barG.position.set(barX, isRail ? y0 : y0 + (p.d || 36) / 2, 0); g.add(barG);
    const piece = K.grp(mk(plen)); piece.position.y = barG.position.y; g.add(piece);
    const hgt = isRail ? (ctx.route === "LB" ? 36 : 22) : (p.d || 36);
    // vice
    g.add(K.boxB(60, 120, 60, C.dark, 80, 820, -(hgt / 2 + 40))); const jaw = K.boxB(60, 120, 60, C.dark, 80, 820, hgt / 2 + 60); g.add(jaw);
    // saw head: bow with 2 band wheels + band (or circular blade)
    const head = K.grp(); g.add(head);
    const circ = op.m === "LG-SAW" || op.m === "LG-CUT";
    let blade;
    if (circ) { blade = K.cylX(175, 4, C.steel, 0, 0, 0, 64); head.add(blade); head.add(K.cylX(30, 80, C.dark, -40, 0, 0, 16)); head.add(K.boxB(200, 200, 260, C.blue, -160, 60, 0)); blade.userData.spin = true; }
    else {
      head.add(K.boxB(40, 40, 1100, C.blue, 0, 260, 0));
      const wa = K.cylX(170, 40, C.body2, 0, 120, -500), wb = K.cylX(170, 40, C.body2, 0, 120, 500); head.add(wa, wb); blade = K.boxB(2, 26, 1000, C.steel, 0, -40, 0); head.add(blade);
    }
    const chips = K.chips(200); g.add(chips.obj);
    const yTop = y0 + hgt + 60, yBot = y0 - 30;
    const tick = (T) => {
      const ph = K.phase(T.p, [["feed", 2], ["clamp", 0.6], ["cut", 6], ["lift", 1.2], ["eject", 1.5]]);
      jaw.position.z = hgt / 2 + 60 - (ph.name === "cut" || ph.name === "clamp" && ph.s > 0.5 ? 18 : 0);
      if (ph.name === "feed") { barG.position.x = barX - plen + plen * K.ease(ph.s); piece.visible = false; }
      const hy = ph.name === "cut" ? K.lerp(yTop, yBot, ph.s) : ph.name === "lift" ? K.lerp(yBot, yTop, ph.s) : yTop;
      head.position.y = circ ? hy - 30 + 140 : hy + 20; head.position.x = 0;
      if (blade.userData.spin) blade.rotation.x += T.dt * 30;
      if (ph.name === "cut" && T.dt) chips.emit(2, [0, hy, 0], () => [K.rnd(400), 300 + K.rnd(300), K.rnd(600)]);
      if (ph.name === "eject") { piece.visible = true; piece.position.x = plen / 2 + 4 + 500 * ph.s; }
      S.cut = ph.name === "cut" ? ph.s : ph.name === "lift" || ph.name === "eject" ? 1 : 0; S.ph = ph.name;
    };
    const S = { cut: 0, ph: "" };
    const tc = P.sawTime(p.d || 36, p.rate || 30);
    return { g, dur: 11, cam: [[0, 900, 0], [1500, 1700, 2300]], tick,
      tags: [[circ ? "circular cold saw blade" : "bi-metal band", head, [0, 60, 0]], [partName(ctx) + " blank", barG, [-300, hgt + 30, 0]], ["vice", jaw, [0, 130, 0]]],
      read: () => ({ rows: [["step", S.ph], ["cut progress", f0(S.cut * 100) + " %"], ["band / blade speed vc", (p.vc || 60) + " m/min"], ["cutting rate", (p.rate || 30) + " cm²/min"],
        ["cut time (round bar) = A / rate", isRail ? "profile – see the cycle" : `π/4·${((p.d || 36) / 10).toFixed(1)}² / ${p.rate || 30} = ${f2(tc)} min`]] }) };
  },

  /* ---------------------------------------------------------------- straightening press (3-point bending + dial gauge) */
  press(K, op, ctx) {
    const { C, THREE } = K, g = K.grp(), p = op.p || {};
    const long = ctx.route === "LG" ? 1000 : 1000, isRail = ctx.route === "LG";
    g.add(K.boxB(2200, 800, 800, C.body)); g.add(K.boxB(2210, 12, 810, C.blue, 0, 795, 0));
    const span = (p.span || 400), y0 = 900;
    // C-frame + hydraulic cylinder above
    const fr = K.grp(K.boxB(500, 1300, 160, C.body2, 0, 800, -420), K.boxB(500, 180, 700, C.body2, 0, 1980, -160)); g.add(fr);
    g.add(K.cylY(110, 400, C.blue, 0, 1880, 0));
    const ram = K.grp(K.cylY(55, 600, C.steel, 0, 300, 0), K.boxB(90, 60, 90, C.dark, 0, -30, 0)); g.add(ram);
    for (const s of [-1, 1]) { g.add(K.boxB(80, 90, 120, C.dark, s * span / 2, 810, 0)); }
    // rollers for turning the part (measurement)
    for (const s of [-1, 1]) g.add(K.cylX(30, 60, C.steel, s * 800, 820 + 30, 0, 20));
    // part: high-segment geometry so it can bend
    let geo;
    if (isRail) geo = new THREE.ExtrudeGeometry(K.shapeOf(railOutline("O")), { depth: long, bevelEnabled: false, steps: 80 }).rotateY(PI / 2).translate(-long / 2, -11, 0);
    else { const r = ctx.f.turned ? 15.75 : 18; geo = new THREE.CylinderGeometry(r, r, long, 36, 100).rotateZ(PI / 2); }
    const work = K.part(K.mesh(geo, ctx.f.hard ? C.hard : C.steel), "work"), rW = isRail ? 11 : (ctx.f.turned ? 15.75 : 18);
    const wg = K.grp(work); wg.position.y = y0 + rW; g.add(wg);
    const bend = K.bendable(work);
    const D = K.dial(30); D.g.position.set(-260, y0 + 2 * rW + 30 + 60, 0); g.add(D.g);
    g.add(K.boxB(30, 300, 30, C.dark, -260, 800, -90)); g.add(K.boxB(30, 30, 90, C.dark, -260, 1080, -45));
    const ro0 = p.ro0 || 0.5, ro1 = p.ro1 || 0.05, loops = 3, X = 60;      // visual exaggeration ×60
    const S = { ro: ro0, loop: 0, ph: "", F: 0 };
    const tick = (T) => {
      const n = T.loop % 1000, ph = K.phase(T.p, [["measure 1", 2.4], ["press 1", 1.6], ["measure 2", 2.4], ["press 2", 1.6], ["measure 3", 2.4], ["press 3", 1.4], ["final check", 2.4]]);
      const k = Math.floor(ph.i / 2), r0 = ro0 * Math.pow(ro1 / ro0, Math.min(k, loops) / loops), r1 = ro0 * Math.pow(ro1 / ro0, Math.min(k + 1, loops) / loops);
      let amp, ang = 0;
      if (ph.name.startsWith("measure") || ph.name.startsWith("final")) { ang = ph.s * TAU * (ph.s < 0.8 ? 1 : 1); amp = r0 * Math.cos(ang); S.ro = r0; S.F = 0; ram.position.y = 1600; }
      else { const s = ph.s, down = s < 0.5 ? K.ease(s * 2) : K.ease((1 - s) * 2); ram.position.y = K.lerp(1600, y0 + 2 * rW + 60, down); amp = K.lerp(r0, -(r0 - r1) * 0.6 - 0.2, down); if (s > 0.5) amp = K.lerp(r1, amp, down); S.F = (p.F || 40) * down; S.ro = s > 0.5 ? r1 : r0; }
      bend(amp * X, 0, 520); work.rotation.x = ang;
      D.needle.rotation.z = -(amp / 0.01) * (TAU / 100) * 0.6;
      S.ph = ph.name; S.loop = n;
    };
    const st = ctx.f.hard ? P.straighten({ d: 26.4, sy: 1400, span: 300 }) : P.straighten({ d: 36, sy: 700, span: 400 });
    return { g, dur: 15, cam: [[0, 950, 0], [1300, 1600, 2200]], tick,
      tags: [["ram (hydraulic)", ram, [0, -40, 0]], ["dial gauge 0.01 mm", D.g, [0, 40, 0]], [partName(ctx) + (ctx.f.hard ? " (hardened)" : ""), wg, [400, 30, 0]], ["V-block", g, [span / 2, 900, 0]]],
      read: () => ({ rows: [["step", S.ph], ["run-out now (TIR)", f3(S.ro) + " mm"], ["target", "≤ " + (p.ro1 ?? 0.05) + " mm"], ["press force now", f1(S.F) + " kN"], ["span between V-blocks", span + " mm"],
        ["yield force F = 4·σ·W / L", ctx.f.hard ? `core Ø26.4, σ 1 400 MPa, L 300 → ${f1(st.F)} kN` : `Ø36, σ 700 MPa, L 400 → ${f1(st.F)} kN`], ["picture", "bend shown × 60 (real run-out is tiny)"]] }) };
  },

  /* ---------------------------------------------------------------- facing + centring / centre-hole grinding */
  centre(K, op, ctx) {
    const { C } = K, g = K.grp(), grind = op.m === "BS-CLP";
    g.add(K.boxB(2600, 800, 800, C.body)); g.add(K.boxB(2610, 12, 810, C.blue, 0, 795, 0));
    const work = wp(K, ctx); work.position.y = H0; g.add(work);
    for (const s of [-1, 1]) { g.add(K.boxB(120, H0 - 800 - 20, 200, C.dark, s * 200, 800, 0)); g.add(K.boxB(120, 40, 200, C.dark, s * 200, H0 + 24, 0)); }
    const heads = [-1, 1].map((s) => {
      const h = K.grp(K.boxB(320, 420, 400, C.body2, 0, -H0 + 820, 0)); const sp = K.grp(); sp.position.set(-s * 170, 0, 0); h.add(sp);
      if (grind) { const pnt = K.mesh(new K.THREE.ConeGeometry(9, 26, 20), C.wheel); pnt.rotation.z = s > 0 ? PI / 2 : -PI / 2; sp.add(K.cylX(12, 80, C.steel, s * 40, 0, 0, 16)); pnt.position.x = 0; sp.add(pnt); }
      else { const fh = K.cylX(55, 30, C.dark, 0, 0, 0, 24); sp.add(fh); const cd = K.mesh(new K.THREE.ConeGeometry(6, 34, 16), C.insert); cd.rotation.z = s > 0 ? PI / 2 : -PI / 2; cd.position.x = -s * 26; sp.add(cd); sp.add(K.cylX(30, 120, C.steel, s * 70, 0, 0, 20)); }
      h.position.set(s * 900, H0, 0); g.add(h); if (grind && s > 0) h.visible = false; return { h, sp, s };
    });
    const ch = grind ? K.sparks(200) : K.chips(200); g.add(ch.obj);
    const S = { ph: "" };
    const tick = (T) => {
      const ph = K.phase(T.p, [["clamp", 1], ["approach", 1.5], [grind ? "grind centre" : "face + centre drill", 4], ["retract", 1.5], ["unclamp", 1]]);
      const x = ph.name === "approach" ? K.ease(ph.s) : ph.name.startsWith("face") || ph.name.startsWith("grind") ? 1 + 0.06 * ph.s : ph.name === "retract" ? 1 - K.ease(ph.s) : 0;
      heads.forEach(({ h, sp, s }) => { h.position.x = s * (900 - 210 * x); sp.rotation.x += T.dt * 25; if (grind) { sp.position.y = 2 * Math.sin(T.t * 12); sp.position.z = 2 * Math.cos(T.t * 12); } });
      if ((ph.name.startsWith("face") || ph.name.startsWith("grind")) && T.dt) heads.forEach(({ s, h }) => h.visible && ch.emit(1, [s * 520, H0, 0], () => [s * 300 + K.rnd(300), 300 + K.rnd(200), K.rnd(300)]));
      S.ph = ph.name;
    };
    const p = op.p || {};
    return { g, dur: 9, cam: [[0, 1000, 0], [1400, 1500, 2200]], tick,
      tags: [[grind ? "60° mounted point (planetary)" : "facing head + centre drill B4", heads[0].h, [-170, 80, 0]], [partName(ctx), work, [0, 40, 0]]],
      read: () => ({ rows: [["step", S.ph], ...(grind ? [["spindle", "30 000 min⁻¹, planetary 300 min⁻¹"], ["removal", "0.02 – 0.05 mm per centre"]] : [["facing vc / f", `${p.vc || 150} m/min / ${p.f || 0.15} mm/rev`], ["centre drill", "B4, 60°, protected cone (DIN 332)"], ["n facing (Ø36)", f0(1000 * (p.vc || 150) / (PI * 36)) + " min⁻¹"]]),
        ["why", "the centres are the datum of every later operation"]] }) };
  },

  /* ---------------------------------------------------------------- CNC lathe (between centres for the shaft, chuck for the nut, hard turning) */
  lathe(K, op, ctx) {
    const { C } = K, p = op.p || {}, long = ctx.route === "BS";
    const F = frame(K, long ? 2900 : 1800, { tail: long, hsX: long ? -760 : undefined, tsX: 735 }); const { g, table, hs } = F;
    const yW = H0 - 774;
    const ch = K.chuck(long ? 90 : 120, 80); ch.position.set(hs.position.x + 210, yW, 0); table.add(ch);
    let A, B, work, front0, front1;
    if (long) {
      A = K.shaft("bar"); B = K.shaft("turned"); const wgp = K.grp(A, B); wgp.position.set(-20, yW, 0); table.add(wgp); work = wgp;
      table.add(K.at(K.centre(-1), 520, yW, 0));
      // steady rest
      const sr = K.grp(K.torus(60, 12, C.body2), K.boxB(60, 120, 60, C.body2, 0, -180, 0)); sr.rotation.y = PI / 2; sr.position.set(80, yW, 0); table.add(sr);
      front0 = 470; front1 = -470;
    } else {
      const hard = ctx.f.hard;
      A = hard ? K.nut("full", { hard: true, holes: true, windows: true }) : K.nut("slug"); B = K.nut("full", { hard, holes: hard, windows: hard }); if (hard) B.traverse((o) => { if (o.isMesh && o.material === C.hard) o.material = C.ground; });
      const wgp = K.grp(A, B); wgp.position.set(ch.position.x + 100, yW, 0); table.add(wgp); work = wgp;
      front0 = wgp.position.x + 55; front1 = wgp.position.x - 40;
    }
    const setF = K.revealX(A, B);
    // carriage + turret
    const car = K.grp(K.boxB(300, 120, 300, C.body2, 0, 0, 0), K.boxB(200, yW - 160, 160, C.body2, 0, 120, -40), K.cylX(80, 90, C.dark, 0, yW, -150, 8)); car.position.set(0, 0, -300); table.add(car);
    const tool = K.grp(K.boxB(26, 26, 150, C.dark, 0, 0, 75), K.boxB(14, 6, 14, C.insert, 0, 0, 150)); car.add(tool); tool.position.set(0, yW, 0);
    const chips = K.chips(260, ctx.f.hard ? 0x5b6fb3 : 0x8a5a2a); g.add(chips.obj);
    const S = { x: 0, ph: "" }, rad = long ? 18 : 42.5;
    const tick = (T) => {
      const ph = K.phase(T.p, [["rapid in", 1], [long ? "turning pass (rough → finish)" : (ctx.f.hard ? "hard turning (CBN)" : "turning OD + face + bore"), 9], ["retract", 1.4]]);
      const xw = ph.name === "rapid in" ? front0 + 60 * (1 - ph.s) : ph.name === "retract" ? front1 : K.lerp(front0, front1, ph.s);
      car.position.x = xw; tool.position.z = 140 - rad - (ph.name === "retract" ? 80 * ph.s : 0);
      if (ph.name !== "retract") setF(xw + table.position.x); else setF(front1 - 9999);
      work.rotation.x += T.dt * 18; ch.rotation.x = work.rotation.x;
      if (ph.name.includes("turn") && T.dt) chips.emit(2, [xw, 774 + yW + 10, -rad], () => [K.rnd(400), 600 + K.rnd(300), -300 + K.rnd(300)]);
      S.ph = ph.name; S.x = xw;
    };
    const t = P.turning({ d: p.d || 36, L: p.L || 870, vc: p.vcR || 200, f: p.fR || 0.3, ap: p.apR || 1.8 });
    return { g, dur: 11.5, cam: long ? [[0, 1000, 0], [900, 1500, 2300]] : [[-200, 1000, 0], [600, 1300, 1300]], tick,
      tags: [[ctx.f.hard ? "CBN insert" : "carbide insert (turret)", tool, [0, 0, -150]], [partName(ctx), work, [long ? 200 : 0, 50, 0]], ...(long ? [["steady rest", F.table, [80, H0 - 774 + 75, 0]], ["tailstock centre", F.table, [560, H0 - 774 + 40, 0]]] : [["chuck", ch, [0, 130, 0]]])],
      read: () => ({ rows: [["step", S.ph], ["spindle n = 1 000·vc/(π·d)", `1 000·${p.vcR || 200}/(π·${p.d || 36}) = ${f0(t.n)} min⁻¹`], ["vc / f / ap", `${p.vcR || 200} m/min / ${p.fR || 0.3} mm/rev / ${p.apR || (ctx.f.hard ? 0.1 : 2)} mm`],
        ["pass time t = L/(f·n)", `${p.L || 870}/(${p.fR || 0.3}·${f0(t.n)}) = ${f2(t.t)} min`], ["cutting power (kc 2 600 N/mm², η 0.85)", f1(t.P) + " kW"], ...(p.vcF ? [["finish", `vc ${p.vcF} m/min, f ${p.fF} mm/rev → Ø${p.d1}`]] : [])] }) };
  },

  /* ---------------------------------------------------------------- thread rolling (rolled screw) */
  roll(K, op, ctx) {
    const { C } = K, g = K.grp(), p = op.p || {};
    g.add(K.boxB(2400, 800, 1300, C.body)); g.add(K.boxB(700, 900, 260, C.body2, 0, 800, -500)); g.add(K.boxB(700, 420, 260, C.body2, 0, 800, 500));
    const dies = [-1, 1].map((s) => { const d = K.cylX(100, 160, C.hard, 0, H0, s * 118, 48); d.rotation.set(0, s * 0.03, PI / 2); g.add(d); return d; });
    for (const s of [-1, 1]) g.add(K.boxB(260, 260, 200, C.blue, 0, H0 - 130, s * 330));
    g.add(K.boxB(900, 40, 8, C.dark, 0, H0 - 40, 0));            // work rest blade
    const work = wp(K, { ...ctx, f: { ...ctx.f } }, { stage: "turned", threadClip: true });
    const wg = K.grp(work); wg.position.y = H0; g.add(wg);
    const setF = K.threadReveal(work, false);
    const S = { x: 0 };
    const tick = (T) => {
      const ph = K.phase(T.p, [["load", 1], ["roll (through-feed)", 9], ["unload", 1]]);
      const xl = ph.name === "load" ? -560 : ph.name === "unload" ? 560 : K.lerp(-430, 470, ph.s);
      wg.position.x = -xl; work.rotation.x -= T.dt * 4; dies.forEach((d, i) => { d.rotation.x += (i ? -1 : 1) * T.dt * 2; });
      setF(ph.name === "load" ? -600 : ph.name === "unload" ? 600 : xl); S.x = xl; S.ph = ph.name;
    };
    return { g, dur: 11, cam: [[0, 1050, 0], [1500, 1900, 1300]], tick,
      tags: [["rolling die (groove profile)", dies[1], [0, 110, 0]], ["shaft – soft (QT)", wg, [300, 30, 0]]],
      read: () => ({ rows: [["step", S.ph], ["die speed", (p.n || 30) + " min⁻¹"], ["axial feed", f0(p.vax || 1000) + " mm/min"], ["rolling time = L / v", `900 / ${p.vax || 1000} = ${f2(900 / (p.vax || 1000))} min (+ load)`], ["force", "≈ 100 – 150 kN"], ["grade", "C7 / C10 – no chips, fibres follow the groove"]] }) };
  },

  /* ---------------------------------------------------------------- induction scanning hardening (vertical) */
  induction(K, op, ctx) {
    const { C } = K, g = K.grp(), p = op.p || {};
    g.add(K.boxB(1200, 400, 1000, C.body)); g.add(K.boxB(300, 2600, 300, C.body2, 0, 0, -380)); g.add(K.boxB(500, 200, 400, C.body2, 0, 2500, -200));
    g.add(K.boxB(1100, 2200, 900, C.glass, 0, 400, 0));
    const yc = 1500;
    const sh = wp(K, ctx); const wg = K.grp(sh); wg.rotation.z = PI / 2; wg.position.set(0, yc, 0); g.add(wg);   // local x → world y
    const c1 = K.centre(1); c1.rotation.z = 0; c1.position.set(0, yc - 525, 0); g.add(c1);
    const c2 = K.centre(1); c2.rotation.z = PI; c2.position.set(0, yc + 525, 0); g.add(c2);
    const car = K.grp(); g.add(car);
    const coil = K.torus(25, 5, C.copper); coil.rotation.x = PI / 2; car.add(coil);
    const spray = K.torus(34, 4, C.blue); spray.rotation.x = PI / 2; spray.position.y = -24; car.add(spray);
    car.add(K.boxB(30, 30, 330, C.copper, 0, -15, -200)); car.add(K.boxB(140, 160, 140, C.blue, 0, -80, -380));
    const glow = K.cylY(16.3, 26, C.glow, 0, 0, 0, 32); car.add(glow);
    const hardZ = K.cylY(16.05, 1, C.hard, 0, 0, 0, 32); g.add(hardZ);
    const spr = K.coolant(500); g.add(spr.obj);
    const z0 = yc - 400, z1 = yc + 450, S = { y: 0, ph: "" };
    const tick = (T) => {
      const ph = K.phase(T.p, [["load + centre", 1], ["scan up (heat + quench)", 9], ["rinse + unload", 1.5]]);
      const y = ph.name === "load + centre" ? z0 - 40 : ph.name.startsWith("scan") ? K.lerp(z0, z1, ph.s) : z1 + 30;
      car.position.y = y; glow.visible = ph.name.startsWith("scan");
      const hz = ph.name === "load + centre" ? 0 : Math.max(1, y - z0 - 20);
      hardZ.scale.y = hz; hardZ.position.y = z0 + hz / 2; hardZ.visible = hz > 2;
      sh.rotation.x += T.dt * 15;
      if (ph.name.startsWith("scan") && T.dt) spr.emit(6, [0, y - 24, 0], (i) => { const a = Math.random() * TAU; return [Math.cos(a) * 30 + K.rnd(40), -300 + K.rnd(100), Math.sin(a) * 30 + K.rnd(40)]; });
      S.y = y - z0; S.ph = ph.name;
    };
    const dh = P.inductionDepth(1.2e-6, 1, (p.f || 30) * 1000), dc = P.inductionDepth(2e-7, 100, (p.f || 30) * 1000), ip = P.inductionPower({ v: p.v || 4 });
    return { g, dur: 11.5, cam: [[0, 1400, 0], [1800, 2000, 2600]], tick,
      tags: [["copper coil (1 turn)", coil, [0, 30, 0]], ["spray quench ring", spray, [40, -10, 0]], ["hardened case 2 – 3 mm", hardZ, [0, 0.5, 20]], ["shaft turns 150 min⁻¹", wg, [-300, 30, 0]]],
      read: () => ({ rows: [["step", S.ph], ["scan position", f0(Math.max(0, S.y)) + " / 850 mm"], ["frequency / power", `${p.f || 30} kHz / ≈ ${p.P || 35} kW`], ["scan speed / rotation", `${p.v || 4} mm/s / ${p.rpm || 150} min⁻¹`],
        ["δ hot = 503·√(ρ/(μr·f))", `ρ 1.2·10⁻⁶ Ω·m, μr 1 → ${f2(dh)} mm (cold: μr 100 → ${f2(dc)} mm)`], ["scan time = L / v", `850 / ${p.v || 4} = ${f0(ip.tScan)} s`], ["heat in the case", `${f1(ip.Pnet)} kW (generator ≈ ${f1(ip.Pgen)} kW + losses)`], ["result", "58 – 62 HRC, case 2 – 3 mm, journals soft"]] }) };
  },

  /* ---------------------------------------------------------------- batch furnace (tempering) / sealed-quench carburising line */
  furnace(K, op, ctx) {
    const { C } = K, g = K.grp(), p = op.p || {}, carb = op.m === "HT-CAR";
    const fx = carb ? 300 : 0;
    g.add(K.boxB(1600, 2000, 1500, C.body2, fx, 0, -200)); g.add(K.boxB(1610, 60, 1510, C.blue, fx, 2000, -200));
    const inner = K.boxB(1100, 1200, 1000, C.dark, fx, 350, -250); g.add(inner);
    const door = K.boxB(1300, 1400, 120, C.body, fx, 300, 610); g.add(door);
    const win = K.boxB(300, 200, 10, C.glow.clone(), 0, 700, 62); door.add(win); win.position.x = 0; win.position.y = 300;
    if (carb) { g.add(K.boxB(1200, 700, 1200, C.body, -1300, 0, -100)); const oil = K.boxB(1100, 20, 1100, C.oil, -1300, 690, -100); g.add(oil); g.add(K.boxB(1210, 30, 1210, C.blue, -1300, 700, -100)); }
    // basket / rack with parts
    const bsk = K.grp(K.boxB(900, 30, 800, C.iron)); g.add(bsk);
    const r = ctx.route;
    if (r === "BS") for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const s = K.cylY(16, 1000, C.hard, -300 + i * 200, 530, -250 + j * 250, 16); bsk.add(s); }
    else if (r === "LG") for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) { const rr = K.rail(800); rr.position.set(0, 40 + j * 40, -300 + i * 150); bsk.add(rr); }
    else if (r === "BN") for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 2; k++) bsk.add(K.cylY(25, 100, C.steel, -320 + i * 160, 80 + k * 120, -280 + j * 180, 20));
    else for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 2; k++) { const b = K.boxB(58, 30, 70, C.steel, -350 + i * 140, 40 + k * 60, -270 + j * 180); bsk.add(b); }
    const glowM = C.glow.clone(), inGlow = K.boxB(1080, 1180, 980, glowM, fx, 360, -250); inGlow.visible = false; g.add(inGlow);
    const bub = K.particles(300, 0xfff2c0, 8, { life: 0.8, g: 1500, op: 0.7 }); g.add(bub.obj);
    const S = { T: 20, ph: "" };
    const list = carb ? [["load", 1.2], ["carburise 920 °C (5 h)", 3], ["harden 840 °C", 1.2], ["oil quench 60 °C", 1.6], ["wash", 0.8], ["temper 170 °C (2 h)", 1.6], ["unload", 1]]
      : [["load", 1.2], ["heat up", 1.6], ["temper 170 °C (2 h)", 4], ["cool + unload", 1.6]];
    const tick = (T) => {
      const ph = K.phase(T.p, list);
      const inF = !["load", "unload", "oil quench 60 °C", "wash", "cool + unload"].includes(ph.name) || (ph.name === "load" && ph.s > 0.8);
      let bx = fx, by = 400, bz = -250;
      if (ph.name === "load") { bz = K.lerp(1500, -250, K.ease(ph.s)); by = 400; }
      if (ph.name === "unload" || ph.name === "cool + unload") { bz = K.lerp(-250, 1500, K.ease(ph.s)); }
      if (ph.name === "oil quench 60 °C") { bx = -1300; by = K.lerp(900, 200, K.ease(Math.min(1, ph.s * 2))); bz = -100; if (T.dt) bub.emit(4, [-1300 + K.rnd(450), 690, -100 + K.rnd(450)], () => [K.rnd(50), 200 + K.rnd(200), K.rnd(50)]); }
      if (ph.name === "wash") { bx = -1300; by = 900; bz = 600; }
      if (carb && ph.name.startsWith("temper")) { bx = fx; bz = -250; }
      bsk.position.set(bx, by, bz);
      door.position.y = inF ? 300 : 1500;
      inGlow.visible = inF && !ph.name.startsWith("load"); win.visible = inGlow.visible; win.material.emissiveIntensity = glowM.emissiveIntensity;
      glowM.emissiveIntensity = ph.name.includes("920") ? 1.4 : ph.name.includes("840") ? 1.0 : ph.name.includes("170") ? 0.15 : 0.5;
      const temps = { "carburise 920 °C (5 h)": 920, "harden 840 °C": 840, "oil quench 60 °C": 60, "temper 170 °C (2 h)": 170, "heat up": 20 + 150 * ph.s, wash: 50 };
      S.T = temps[ph.name] ?? 20; S.ph = ph.name;
    };
    return { g, dur: carb ? 16 : 12, cam: [[-200, 900, 0], [2600, 2200, 3400]], tick,
      tags: [[carb ? "sealed-quench furnace" : "tempering furnace", door, [0, 760, 0]], ["basket / rack", bsk, [0, 60, 0]], ...(carb ? [["oil quench tank", g, [-1300, 760, -100]]] : [])],
      read: () => ({ rows: [["step", S.ph], ["temperature now", f0(S.T) + " °C"], ["load", `${p.load} pieces, ≈ ${p.h} h per load`], ["machine time per piece", `${p.h} h · 60 / ${p.load} = ${f2(p.h * 60 / p.load)} min`],
        ...(carb ? [["case depth d = K·√t (K 0.63)", `5 h → ${f2(P.carbDepth(5))} mm total case (Eht 0.8 – 1.2 mm at 550 HV)`]] : [["Hollomon P = T·(20 + log t)", `443 K · (20 + log 2) = ${f0(P.hollomon(170, 2))}`]]), ["runs", "3 shifts (furnaces stay hot)"]] }) };
  },

  /* ---------------------------------------------------------------- cylindrical grinding (and film polishing for rolled screws) */
  cylgrind(K, op, ctx) {
    const { C } = K, p = op.p || {}, polish = op.no === "110";
    const F = frame(K, 2900, { hsX: -760, tsX: 735 }); const { g, table, hs, ts } = F; const yW = H0 - 774;
    const work = wp(K, ctx); work.position.set(0, yW, 0); table.add(work);
    table.add(K.at(K.centre(1), -525, yW, 0)); table.add(K.at(K.centre(-1), 525, yW, 0));
    const dog = K.boxB(20, 70, 20, C.dark, -505, yW - 10, 0); table.add(dog);
    // OD ground overlay (grows) + journals
    const od = K.cylX(15.8, 1, C.ground, 0, yW, 0, 48); table.add(od); od.visible = false;
    const jl = K.cylX(12.6, 50, C.ground, -445, yW, 0, 32), jr = K.cylX(10.1, 50, C.ground, 475, yW, 0, 32); table.add(jl, jr); jl.visible = jr.visible = !!ctx.f.groundJ;
    // wheel head behind (−z)
    const R = polish ? 50 : (p.ds || 500) / 2;
    const wh = K.grp(K.boxB(600, 500, 600, C.body2, 0, -250, -R - 300)); g.add(wh); wh.position.y = H0;
    const whl = polish ? K.grp(K.boxB(80, 60, 120, C.dark, 0, 0, 0)) : K.grp(K.cylX(R, 63, C.wheel, 0, 0, 0, 72), K.cylX(R * 0.32, 72, C.steel, 0, 0, 0, 24)); whl.position.z = -(R + 15.75 + 2); wh.add(whl);
    if (!polish) { const gd = new K.THREE.Mesh(new K.THREE.CylinderGeometry(R + 18, R + 18, 90, 40, 1, true, PI * 0.25, PI * 1.2), C.body2); gd.rotation.z = PI / 2; gd.position.copy(whl.position); wh.add(gd); }
    const dresser = K.cylX(30, 70, C.cbn, 0, 0, -(R + 15.75) - R - 20, 24); wh.add(dresser);
    const sp = K.sparks(500), cl = K.coolant(300); g.add(sp.obj, cl.obj);
    const S = { ph: "", dev: 0 };
    const tick = (T) => {
      const ph = K.phase(T.p, polish ? [["film polishing pass", 8], ["change film", 1]] : [["plunge journal (fixed side)", 2.4], ["plunge journal (floating side)", 2.0], ["traverse OD of the thread lands", 5.5], ["dress (diamond roll)", 1.2]]);
      let tx = 0, inz = 0;
      if (ph.name.startsWith("plunge journal (fixed")) { tx = 445; inz = K.ease(Math.min(1, ph.s * 1.5)); if (ph.s > 0.6) jl.visible = true; }
      else if (ph.name.startsWith("plunge journal (float")) { tx = -475; inz = K.ease(Math.min(1, ph.s * 1.5)); if (ph.s > 0.6) jr.visible = true; }
      else if (ph.name.startsWith("traverse") || ph.name.startsWith("film")) { tx = K.lerp(400, -440, ph.s); inz = 1; od.visible = true; const L = 840 * ph.s; od.scale.y = Math.max(1, L); od.position.x = -400 + L / 2; }
      else { tx = 0; inz = -0.5; }
      if (T.p < 0.01) { od.visible = false; jl.visible = jr.visible = !!ctx.f.groundJ; }
      table.position.x = tx; whl.position.z = -(R + 15.75 + 2) + inz * 3; whl.rotation.x -= T.dt * 40;
      dresser.position.z = whl.position.z - R - 30 + (ph.name.startsWith("dress") ? 18 * Math.sin(ph.s * PI) : 0);
      work.rotation.x += T.dt * 6; dog.rotation.x = work.rotation.x;
      if (inz > 0.5 && T.dt && !polish) { sp.emit(5, [0, H0 - 6, -16], () => [K.rnd(500), -400 - Math.random() * 600, 1200 + Math.random() * 600]); cl.emit(2, [0, H0 + 70, -30], () => [K.rnd(30), -600, 80]); }
      S.dev = inz > 0.5 ? Math.max(0, 12 * (1 - ph.s)) : 0; S.ph = ph.name;
    };
    const B = P.grindBurn({ a: p.a || 0.005 }), B2 = P.grindBurn({ a: 2 * (p.a || 0.005) }), Bc = P.grindBurn({ a: p.a || 0.005, ec: 30, eps: 0.3 });
    return { g, dur: polish ? 9 : 11, cam: [[0, 1050, -150], [900, 1500, 1700]], tick,
      tags: polish ? [["polishing film unit", whl, [0, 40, 0]], [partName(ctx), work, [200, 40, 0]]] : [["grinding wheel Ø500 (89A 60 K / CBN)", whl, [0, R, 0]], ["diamond roll dresser", dresser, [0, 30, 0]], [partName(ctx) + " – between centres", work, [250, 40, 0]]],
      read: () => ({ rows: polish ? [["step", S.ph], ["work speed", "300 min⁻¹"], ["film", "30 µm → 9 µm, Ra ≤ 0.4 µm"]] : [["step", S.ph], ["wheel n = vs·60 000/(π·ds)", `${p.vs || 45}·60 000/(π·${p.ds || 500}) = ${f0(P.wheelRpm(p.vs || 45, p.ds || 500))} min⁻¹`],
        ["work vw = π·dw·nw", `π·32·${p.nw || 150}/60 = ${f0(B.vw)} mm/s`], ["Q'w = a·vw", `${p.a || 0.005}·${f0(B.vw)} = ${f2(B.Qp)} mm³/(mm·s)`], ["power (ec 40 J/mm³, b 20)", f0(B.P) + " W"],
        ["surface temp. θ (Jaeger)", `${f0(B.th)} °C ${B.burn ? "BURN" : "< 450 °C OK"}; 2× infeed → ${f0(B2.th)} °C BURN; CBN → ${f0(Bc.th)} °C`], ["in-process gauge Δd", f1(S.dev) + " µm"]] }) };
  },

  /* ---------------------------------------------------------------- hard whirling */
  whirl(K, op, ctx) {
    const { C } = K, p = op.p || {};
    const F = frame(K, 2900, { hsX: -780, tsX: 715 }); const { g, table } = F; const yW = H0 - 774;
    const ch = K.chuck(90, 80); ch.position.set(F.hs.position.x + 210, yW, 0); table.add(ch);
    const work = K.shaft("turned", { hard: true, groundJ: true, groundOD: true, threadClip: true }); work.position.set(-20, yW, 0); table.add(work); table.add(K.at(K.centre(-1), 500, yW, 0));
    const setF = K.threadReveal(work, true);
    const unit = K.grp(K.boxB(260, 700, 300, C.body2, 0, -300, -320)); unit.position.set(0, H0, 0); g.add(unit);
    const ringG = K.grp(); ringG.rotation.z = (BS.leadAngleDeg * PI / 180); unit.add(ringG);
    const ring = K.grp(K.torus(95, 18, C.blue)); ring.rotation.y = PI / 2; ringG.add(ring);
    const inserts = K.grp(); ringG.add(inserts); ringG.position.y = 56;                 // eccentric: ring centre above the shaft axis
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU, ins = K.boxB(10, 16, 10, C.insert, 0, 0, 0); ins.position.set(0, 77 * Math.cos(a), 77 * Math.sin(a)); ins.rotation.x = -a; inserts.add(ins); }
    const chips = K.chips(300, 0x4a63a8); g.add(chips.obj);
    const S = { x: 0, ph: "" };
    const tick = (T) => {
      const ph = K.phase(T.p, [["load + probe the groove phase", 1.2], ["whirling – 1 pass full depth", 9.5], ["retract", 1]]);
      const xl = ph.name.startsWith("whirl") ? K.lerp(470, -420, ph.s) : ph.name.startsWith("load") ? 500 : -440;
      unit.position.x = xl + work.position.x; inserts.rotation.x += T.dt * 25; work.rotation.x += T.dt * 0.6; ch.rotation.x = work.rotation.x;
      setF(ph.name.startsWith("load") ? 600 : xl);
      if (ph.name.startsWith("whirl") && T.dt) chips.emit(2, [unit.position.x, H0 - 14, 0], () => [K.rnd(300), 500 + K.rnd(300), K.rnd(500)]);
      S.x = 470 - xl; S.ph = ph.name;
    };
    return { g, dur: 11.7, cam: [[0, 1050, 0], [800, 1400, 1500]], tick,
      tags: [["whirling ring, 6 inserts, tilted 5.51°", ring, [0, 110, 0]], ["hardened shaft 58 – 62 HRC", work, [-250, 40, 0]]],
      read: () => ({ rows: [["step", S.ph], ["position", f0(Math.max(0, Math.min(900, S.x))) + " / 900 mm"], ["ring speed", (p.nr || 1500) + " min⁻¹ (vc ≈ 150 – 200 m/min)"], ["work speed", (p.nw || 6) + " min⁻¹"],
        ["axial feed = Ph·n", `${p.Ph || 10}·${p.nw || 6} = ${(p.Ph || 10) * (p.nw || 6)} mm/min`], ["time = (L + overrun)/feed", `900 / 60 = ${f1(P.threadTime([[1, p.nw || 6]], 850, 50, 10))} min, 1 pass`], ["then", "2 finish grinding passes (variant W)"]] }) };
  },

  /* ---------------------------------------------------------------- thread grinding (single-rib wheel tilted by the lead angle, table synced) */
  threadgrind(K, op, ctx) {
    const { C } = K, p = op.p || {};
    const F = frame(K, 3300, { hsX: -760, tsX: 735 }); const { g, table } = F; const yW = H0 - 774;
    const work = K.shaft("turned", { hard: true, groundJ: true, groundOD: true, threadClip: true }); work.position.set(0, yW, 0); table.add(work);
    table.add(K.at(K.centre(1), -525, yW, 0)); table.add(K.at(K.centre(-1), 525, yW, 0));
    const dog = K.boxB(20, 70, 20, C.dark, -505, yW - 10, 0); table.add(dog);
    const setF = K.threadReveal(work, false);
    const R = (p.ds || 400) / 2, lam = (p.tilt || 5.51) * PI / 180;
    const wh = K.grp(K.boxB(700, 520, 700, C.body2, 0, -260, -R - 380)); wh.position.y = H0; g.add(wh);
    const wTilt = K.grp(); wTilt.position.z = -(R + 13.2 + 1.5); wTilt.rotation.z = lam; wh.add(wTilt);
    const whl = K.grp(K.cylX(R, 12, C.wheel, 0, 0, 0, 72), K.cylX(R * 0.35, 40, C.steel, 0, 0, 0, 24)); wTilt.add(whl);
    const gd = new K.THREE.Mesh(new K.THREE.CylinderGeometry(R + 16, R + 16, 60, 40, 1, true, PI * 0.2, PI * 1.25), C.body2); gd.rotation.z = PI / 2; wTilt.add(gd);
    const disc = K.cylZ(40, 8, C.cbn, 0, 0, 0, 32); const dg = K.grp(disc); dg.position.set(60, R + 60, 0); wTilt.add(dg);
    const sp = K.sparks(600), cl = K.coolant(300); g.add(sp.obj, cl.obj);
    const passes = (p.passes || [[3, 40], [2, 20], [2, 10]]).flatMap(([n, nw], i) => Array.from({ length: n }, () => ({ nw, kind: ["rough", "semi-finish", "finish"][i] })));
    const list = []; passes.forEach((q, i) => { if (i === passes.length - 2) list.push(["dress the wheel (CNC diamond disc)", 1.2]); list.push([`pass ${i + 1}/${passes.length} ${q.kind} – work ${q.nw} min⁻¹`, 40 / q.nw]); list.push(["rapid return + infeed", 0.35]); });
    const S = { ph: "", x: 0, nw: 0, pass: 0 };
    let ang = 0;
    const tick = (T) => {
      const ph = K.phase(T.p, list);
      let xl = -425;
      if (ph.name.startsWith("pass")) { xl = K.lerp(-425, 475, ph.s); S.pass = +ph.name.split(" ")[1].split("/")[0]; S.nw = passes[S.pass - 1].nw; }
      else if (ph.name.startsWith("rapid")) xl = K.lerp(475, -425, K.ease(ph.s));
      else { xl = -470; S.nw = 0; }
      if (T.p < 0.005) S.pass = 0;
      table.position.x = -xl;
      ang = TAU * xl / (p.Ph || 10);            // rotation synchronised with the table: one turn = one lead
      work.rotation.x = -ang; dog.rotation.x = -ang;
      setF(ph.name.startsWith("pass 1/") ? xl : 9999);
      whl.rotation.x -= T.dt * 30;
      dg.position.y = R + 60 - (ph.name.startsWith("dress") ? 58 * Math.sin(ph.s * PI) : 0);
      wTilt.position.z = -(R + 13.2 + 1.5) - (ph.name.startsWith("rapid") ? 6 : ph.name.startsWith("dress") ? 30 : 0);
      if (ph.name.startsWith("pass") && T.dt) { const k = S.nw >= 40 ? 6 : S.nw >= 20 ? 4 : 2; sp.emit(k, [0, H0 - 4, -15], () => [K.rnd(300) + 300 * Math.sin(lam), -500 - Math.random() * 500, 900 + Math.random() * 500]); cl.emit(2, [0, H0 + 80, -40], () => [K.rnd(20), -700, 60]); }
      S.ph = ph.name; S.x = xl + 425;
    };
    const tg = P.threadTime(p.passes || [[3, 40], [2, 20], [2, 10]], p.L || 850, p.over || 50, p.Ph || 10);
    return { g, dur: 20, cam: [[0, 1060, -120], [700, 1350, 1250]], tick,
      tags: [["single-rib wheel Ø400, tilted λ 5.51°", whl, [0, R, 0]], ["diamond dressing disc", dg, [0, 50, 0]], ["table + work: 1 turn = 10 mm", work, [-300, 40, 0]]],
      read: () => ({ rows: [["step", S.ph], ["pass", S.pass ? `${S.pass} / ${passes.length}` : "–"], ["work speed / table feed = Ph·n", S.nw ? `${S.nw} min⁻¹ → ${(p.Ph || 10) * S.nw} mm/min` : "–"], ["table position", f0(Math.max(0, Math.min(900, S.x))) + " / 900 mm"],
        ["wheel n = vs·60 000/(π·ds)", `${p.vs || 40}·60 000/(π·${p.ds || 400}) = ${f0(P.wheelRpm(p.vs || 40, p.ds || 400))} min⁻¹`], ["grinding time Σ passes·(L+o)/(Ph·n)", `3·900/400 + 2·900/200 + 2·900/100 = ${f2(tg)} min`],
        ["thermal: ΔL = α·L·ΔT", `1 K → ${f1(P.thermalGrowth(850, 1))} µm over 850 mm – oil 20 ± 0.5 °C + lead compensation`]] }) };
  },

  /* ---------------------------------------------------------------- lead measuring machine (laser) */
  lead(K, op, ctx) {
    const { C } = K, p = op.p || {}, g = K.grp();
    g.add(K.boxB(2600, 700, 900, C.body2)); g.add(K.boxB(2500, 260, 700, C.granite, 0, 700, 0));
    const yW = H0 + 100;
    g.add(K.boxB(300, yW - 960, 320, C.body, -1000, 960, 0)); g.add(K.cylX(60, 60, C.dark, -1180, yW, 0, 32));    // encoder
    g.add(K.boxB(220, yW - 960 - 30, 260, C.body, 860, 960, 0));
    const work = K.shaft("thread", { hard: true, groundJ: true }); work.position.set(-180, yW, 0); g.add(work);
    g.add(K.at(K.centre(1), -705, yW, 0)); g.add(K.at(K.centre(-1), 345, yW, 0));
    const car = K.grp(K.boxB(200, 80, 360, C.body, 0, 960 - 0, 0), K.boxB(30, yW - 1040 + 60, 30, C.steel, 0, 1040, -140), K.boxB(30, 30, 140, C.steel, 0, yW + 30, -80)); g.add(car);
    const probe = K.mesh(new K.THREE.SphereGeometry(3.2, 16, 12), C.ball); probe.position.set(0, yW + 15.5, 0); car.add(probe);
    const refl = K.cylX(25, 30, C.steel, 110, 1110, 140, 6); car.add(refl);
    const laser = K.grp(K.boxB(160, 140, 160, C.dark, 0, 0, 0)); laser.position.set(1180, 1040, 140); g.add(laser);
    const beam = K.cylX(1.8, 1, C.laser, 0, 1110, 140, 6); g.add(beam);
    const sensor = K.grp(K.boxB(20, 14, 20, C.yellow, 0, 0, 0)); sensor.position.set(-300, yW + 18, 0); g.add(sensor);
    // synthetic example lead deviation (µm) of a good C5 screw: trend + 300-mm wave + 2π wobble
    const dev = (x) => 14 * (x / 850) - 7 + 4.5 * Math.sin(TAU * x / 300 + 0.6) + 1.6 * Math.sin(TAU * x / 10);
    const pts = []; const S = { x: 0, ph: "" };
    const tick = (T) => {
      const ph = K.phase(T.p, [["soak check 20.0 °C", 1], ["measure (screw turns, probe follows the groove)", 11], ["evaluate + print the lead chart", 2]]);
      const x = ph.name.startsWith("measure") ? 850 * ph.s : ph.name.startsWith("soak") ? 0 : 850;
      car.position.x = -580 + x; work.rotation.x = -TAU * x / 10;
      beam.scale.y = Math.max(1, 1180 - 80 - (car.position.x + 110)); beam.position.x = (1100 + car.position.x + 110) / 2;
      if (T.p < 0.01) pts.length = 0;
      if (ph.name.startsWith("measure")) { const last = pts.length ? pts[pts.length - 1][0] : -1; for (let xx = Math.floor(last / 5) * 5 + 5; xx <= x; xx += 5) pts.push([xx, dev(xx)]); }
      S.x = x; S.ph = ph.name;
    };
    function stats() {
      if (pts.length < 3) return null;
      const n = pts.length, sx = pts.reduce((a, b) => a + b[0], 0), sy = pts.reduce((a, b) => a + b[1], 0), sxx = pts.reduce((a, b) => a + b[0] * b[0], 0), sxy = pts.reduce((a, b) => a + b[0] * b[1], 0);
      const k = (n * sxy - sx * sy) / (n * sxx - sx * sx), c0 = (sy - k * sx) / n, ep = k * (pts[n - 1][0] - pts[0][0]);
      const res = pts.map(([x, y]) => y - (c0 + k * x));
      let v300 = 0; for (let i = 0; i < n; i++) for (let j = i; j < n && pts[j][0] - pts[i][0] <= 300; j++) { const lo = Math.min(...res.slice(i, j + 1)), hi = Math.max(...res.slice(i, j + 1)); v300 = Math.max(v300, hi - lo); }
      return { ep, vu: Math.max(...res) - Math.min(...res), v300 };
    }
    function chart() {
      const W = 300, Hh = 120, X = (x) => 20 + x / 850 * (W - 30), Y = (y) => Hh / 2 - y * 1.4;
      const pl = pts.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(" ");
      return `<svg viewBox="0 0 ${W} ${Hh}" class="bf2-chart" role="img" aria-label="lead deviation chart"><rect x="0" y="0" width="${W}" height="${Hh}" fill="#fff"/>
        <line x1="20" y1="${Y(0)}" x2="${W - 10}" y2="${Y(0)}" stroke="#999" stroke-width="0.6"/><line x1="20" y1="${Y(35)}" x2="${W - 10}" y2="${Y(35)}" stroke="#d62828" stroke-dasharray="4 3" stroke-width="0.8"/>
        <line x1="20" y1="${Y(-35)}" x2="${W - 10}" y2="${Y(-35)}" stroke="#d62828" stroke-dasharray="4 3" stroke-width="0.8"/><text x="22" y="${Y(35) - 3}" font-size="9" fill="#d62828">+35 µm (C5 e_p)</text>
        <text x="22" y="${Y(-35) + 10}" font-size="9" fill="#d62828">−35 µm</text><polyline points="${pl}" fill="none" stroke="#1f6fd1" stroke-width="1.4"/><text x="${W - 12}" y="${Hh - 4}" font-size="9" text-anchor="end">travel 0 – 850 mm</text></svg>`;
    }
    return { g, dur: 14, cam: [[0, 1100, 0], [600, 1600, 2000]], tick,
      tags: [["laser interferometer (XL-80 class)", laser, [0, 90, 0]], ["ball probe carriage + retro-reflector", car, [0, 140, 0]], ["rotary encoder", g, [-1180, yW + 80, 0]], ["material temp. sensor", sensor, [0, 20, 0]]],
      read: () => { const s = stats(); return { rows: [["step", S.ph], ["travel", f0(S.x) + " / 850 mm (point every 5 mm)"], ["room / screw", "20 ± 0.5 °C, soaked ≥ 4 h"],
        ["e_p (mean travel deviation)", s ? f1(s.ep) + " µm (C5 ± 35)" : "–"], ["v_u (in the useful travel)", s ? f1(s.vu) + " µm (C5 25)" : "–"], ["v_300", s ? f1(s.v300) + " µm (C5 18)" : "–"], ["result", s && S.x > 840 ? (Math.abs(s.ep) <= 35 && s.v300 <= 18 ? "C5 OK – print lead chart" : "NOT C5") : "measuring …"]], chart: chart() }; } };
  },

  /* ---------------------------------------------------------------- through-feed washer */
  wash(K, op, ctx) {
    const { C } = K, g = K.grp();
    g.add(K.boxB(3600, 800, 1000, C.body)); g.add(K.boxB(2400, 900, 1000, C.glass, 0, 800, 0)); g.add(K.boxB(2410, 30, 1010, C.blue, 0, 1700, 0));
    g.add(K.boxB(3600, 20, 700, C.dark, 0, 800, 0));
    const demag = K.torus(260, 40, C.copper); demag.rotation.y = PI / 2; demag.position.set(1500, 1000, 0); g.add(demag);
    const parts = []; for (let k = 0; k < 3; k++) { const w = isLong(ctx) ? (ctx.route === "LG" ? K.rail(1000) : K.shaft("thread", { hard: true, groundJ: true })) : wp(K, ctx); const gg = K.grp(w); gg.position.y = isLong(ctx) && ctx.route !== "LG" ? 840 : 820; if (!isLong(ctx)) gg.scale.setScalar(2); g.add(gg); parts.push(gg); }
    const spr = K.coolant(600); g.add(spr.obj);
    const tick = (T) => {
      parts.forEach((q, i) => { q.position.x = -1800 + ((T.t * 260 + i * 1300) % 3900); });
      if (T.dt) for (const x of [-800, -200, 400]) spr.emit(3, [x + K.rnd(200), 1600, K.rnd(300)], () => [K.rnd(80), -900, K.rnd(80)]);
    };
    return { g, dur: 15, cam: [[0, 1000, 0], [2200, 2000, 3200]], tick,
      tags: [["alkaline wash 55 °C + rinse + dry", g, [-200, 1750, 0]], ["demagnetising coil", demag, [0, 300, 0]]],
      read: () => ({ rows: [["belt", "1 m/min (example)"], ["bath", "alkaline 55 °C, rinse, hot-air dry"], ["residual magnetism", "≤ 0.3 mT (Gauss meter, 1 in 20)"], ["why", "chips + sludge in the groove → noise, wear"]] }) };
  },

  /* ---------------------------------------------------------------- machining centre (VMC + rotary table / 4th axis for the nut, HMC + tombstone for blocks) */
  mill(K, op, ctx) {
    const { C, THREE } = K, g = K.grp(), hmc = op.m === "LB-MC", v = new THREE.Vector3();
    g.add(K.boxB(2200, 800, 1800, C.body));
    const S = { ph: "", k: 0 };
    const sp = K.grp(); g.add(sp);
    const chips = K.chips(250); g.add(chips.obj);
    if (!hmc) {
      g.add(K.boxB(800, 2600, 700, C.body2, 0, 0, -900)); g.add(K.boxB(1200, 140, 700, C.iron, 0, 800, 0));
      const rt = K.grp(K.cylY(160, 60, C.dark, 0, 0, 0, 40)); rt.position.set(0, 940, 0); g.add(rt);             // rotary table (flange holes)
      const hold = K.grp(); rt.add(hold);
      const work = K.nut("full", { holes: true, windows: true }); hold.add(work);
      const hs = work.userData.holes || [], ws = work.userData.win || [];
      const tool = K.cylY(4.5, 60, C.insert, 0, 30, 0, 16);
      const head = K.grp(K.boxB(360, 700, 420, C.body2, 0, 260, -250), K.cylY(70, 200, C.dark, 0, 160, 0, 24), tool); sp.add(head);
      const tipAt = (o, lift) => { g.updateMatrixWorld(true); o.getWorldPosition(v); sp.position.set(v.x, v.y + 7 + lift, v.z); return v; };
      const tick = (T) => {
        const ph = K.phase(T.p, [["drill 6 × Ø9 flange holes (rotary table)", 6], ["re-clamp in the 4th axis", 1], ["mill 4 deflector windows (Ø6 end mill)", 5]]);
        if (T.p < 0.01) [...hs, ...ws].forEach((h) => { h.visible = false; });
        if (ph.name.startsWith("drill")) {
          hold.rotation.set(0, 0, PI / 2); hold.position.set(0, 80, 0);                          // nut axis vertical, flange down
          const k = Math.min(5, Math.floor(ph.s * 6)), s = (ph.s * 6) % 1; rt.rotation.y = -k / 6 * TAU;
          const lift = 60 * Math.abs(Math.cos(s * PI)) - 14 * Math.sin(s * PI); tipAt(hs[k], lift); if (s > 0.5) hs[k].visible = true; S.k = k + 1;
          if (s > 0.25 && s < 0.7 && T.dt) chips.emit(2, [v.x, v.y + 8, v.z], () => [K.rnd(300), 400, K.rnd(300)]);
        } else if (ph.name.startsWith("re-clamp")) { hold.rotation.set(0, 0, 0); rt.rotation.y = 0; hold.position.set(0, 90, 0); sp.position.set(0, 1400, 0); }
        else {
          const k = Math.min(3, Math.floor(ph.s * 4)), s = (ph.s * 4) % 1; hold.rotation.set(-k * PI / 2, 0, 0); hold.position.set(0, 90, 0); rt.rotation.y = 0;
          tipAt(ws[k], 30 * Math.abs(Math.cos(s * PI)) - 4); sp.position.x += 5 * Math.sin(s * TAU); if (s > 0.5) ws[k].visible = true; S.k = k + 1;
          if (T.dt) chips.emit(1, [v.x, v.y + 6, v.z], () => [K.rnd(300), 400, K.rnd(300)]);
        }
        tool.rotation.y += T.dt * 40; S.ph = ph.name;
      };
      return { g, dur: 12, cam: [[0, 1050, 0], [1100, 1650, 1700]], tick, tags: [["rotary table / 4th axis", rt, [0, 40, 160]], ["ball nut (soft)", work, [0, 50, 0]], ["spindle + carbide tool", tool, [0, 70, 0]]],
        read: () => ({ rows: [["step", S.ph], ["feature", S.k], ["drill Ø9 carbide", "vc 80 m/min, f 0.15 mm/rev → n = " + f0(1000 * 80 / (PI * 9)) + " min⁻¹"], ["deflector windows", "± 0.02 mm to the groove phase (probe the groove first)"], ["mistake", "window not phased → step in the ball path"]] }) };
    }
    // HMC with tombstone: spindle comes from +z
    g.add(K.boxB(900, 2600, 700, C.body2, 0, 0, 1350));
    const tomb = K.grp(K.boxB(500, 900, 300, C.iron, 0, 0, 0)); tomb.position.set(0, 950, 0); g.add(tomb); g.add(K.boxB(900, 150, 900, C.iron, 0, 800, 0));
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const b = K.block({}); b.scale.setScalar(2); b.rotation.set(s * PI / 2, 0, 0); b.position.set(-120 + j * 240, 120 + 240 * i, s * 150); tomb.add(b); }
    const tool = K.cylZ(40, 40, C.dark, 0, 0, 0, 20);
    const head = K.grp(K.boxB(320, 320, 420, C.blue, 0, -160, 330), K.cylZ(60, 160, C.dark, 0, 0, 100, 24), tool); sp.add(head);
    const zc = 150 + 72 + 20;
    const tick = (T) => {
      const ph = K.phase(T.p, [["face mill top + flange (face 1)", 4], ["index B 180°", 1], ["face mill (face 2)", 4], ["drill + tap M8, return holes", 3]]);
      const row = Math.min(2, Math.floor(ph.s * 3)), u = (ph.s * 3) % 1;
      if (ph.name.startsWith("face mill top")) { tomb.rotation.y = 0; sp.position.set(K.lerp(-330, 330, u), 950 - 240 + 240 * row, zc); }
      else if (ph.name.startsWith("index")) { tomb.rotation.y = PI * K.ease(ph.s); sp.position.z = zc + 400; }
      else if (ph.name.startsWith("face mill (")) { tomb.rotation.y = PI; sp.position.set(K.lerp(-330, 330, u), 950 - 240 + 240 * row, zc); }
      else { const k = Math.floor(ph.s * 6); sp.position.set(-120 + 240 * (k % 2), 710 + 240 * Math.min(2, Math.floor(k / 2)), zc + 30 - 30 * Math.abs(Math.sin(ph.s * 6 * PI))); }
      tool.rotation.z += T.dt * 30;
      if (!ph.name.startsWith("index") && T.dt) chips.emit(2, [sp.position.x, sp.position.y, sp.position.z - 20], () => [K.rnd(400), 300 + K.rnd(300), 300]);
      S.ph = ph.name;
    };
    return { g, dur: 12, cam: [[0, 1000, 150], [2300, 1700, 1100]], tick, tags: [["tombstone with 12 blocks", tomb, [0, 520, 0]], ["horizontal spindle, face mill Ø80", tool, [0, 60, 0]]],
      read: () => ({ rows: [["step", S.ph], ["face mill Ø80", "vc 220 m/min, fz 0.15 mm → n = " + f0(1000 * 220 / (PI * 80)) + " min⁻¹"], ["blocks per tombstone", "12 (example)"], ["channel stock", "0.25 mm for grinding"], ["cycle per block", op.cyc + " min"]] }) };
  },

  /* ---------------------------------------------------------------- internal thread grinding of the nut */
  intgrind(K, op, ctx) {
    const { C, THREE } = K, p = op.p || {}, g = K.grp();
    g.add(K.boxB(2600, 800, 1000, C.body)); g.add(K.boxB(2610, 12, 1010, C.blue, 0, 795, 0));
    const wh = K.grp(K.boxB(420, H0 - 800 + 160, 420, C.body2, 0, -(H0 - 800), 0)); wh.position.set(-700, H0, 0); g.add(wh);
    const ch = K.chuck(110, 80); ch.position.x = 250; wh.add(ch);
    const nut = K.nut("full", { hard: true, holes: true, windows: true }); nut.position.x = 360; wh.add(nut);
    const cut = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
    nut.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.clippingPlanes = [cut]; o.material.side = THREE.DoubleSide; } });
    const head = K.grp(K.boxB(500, 400, 500, C.body2, 0, -200, 0), K.cylX(55, 260, C.dark, -240, 0, 0, 24)); g.add(head);
    const lam = (p.tilt || 5.51) * PI / 180, ql = K.grp(); ql.rotation.y = lam; ql.position.x = -370; head.add(ql);
    ql.add(K.cylX(8, 120, C.steel, -60, 0, 0, 16)); const whl = K.cylX(12.5, 6, C.cbn, -123, 0, 0, 32); ql.add(whl);
    const sp = K.sparks(300); g.add(sp.obj);
    const passes = (p.passes || [[4, 30], [2, 8]]).flatMap(([n, nw], i) => Array.from({ length: n }, () => ({ nw, kind: i ? "finish" : "rough" })));
    const list = []; passes.forEach((q, i) => { list.push([`pass ${i + 1}/${passes.length} ${q.kind} – work ${q.nw} min⁻¹`, 30 / q.nw]); list.push(["return + infeed", 0.4]); }); list.unshift(["enter the bore", 1]); list.push(["withdraw + measure (ball gauge)", 1.2]);
    const S = { ph: "", pass: 0, nw: 0 };
    const nx0 = -700 + 360;                         // nut centre x (world)
    const tick = (T) => {
      const ph = K.phase(T.p, list);
      let xw;
      if (ph.name.startsWith("pass")) { xw = K.lerp(nx0 + 40, nx0 - 40, ph.s); S.pass = +ph.name.split(" ")[1].split("/")[0]; S.nw = passes[S.pass - 1].nw; }
      else if (ph.name.startsWith("return")) xw = K.lerp(nx0 - 40, nx0 + 40, ph.s);
      else if (ph.name.startsWith("enter")) { xw = K.lerp(nx0 + 400, nx0 + 40, K.ease(ph.s)); S.pass = 0; }
      else xw = K.lerp(nx0 + 40, nx0 + 400, K.ease(ph.s));
      head.position.set(xw + 123 + 370, H0, ph.name.startsWith("pass") ? -6.3 : 0);
      whl.rotation.x += T.dt * 60; nut.rotation.x += T.dt * (S.nw ? S.nw / 10 : 0.5); ch.rotation.x = nut.rotation.x;
      if (ph.name.startsWith("pass") && T.dt) sp.emit(3, [xw, H0, -16], () => [K.rnd(200), K.rnd(300), 300 + Math.random() * 300]);
      S.ph = ph.name;
    };
    return { g, dur: 13, cam: [[-300, 1050, 0], [250, 1400, 1150]], tick,
      tags: [["CBN wheel Ø25 on a 120 mm quill", whl, [0, 20, 0]], ["ball nut (cut open) – hardened", nut, [0, 50, 0]], ["work head chuck", ch, [0, 130, 0]]],
      read: () => ({ rows: [["step", S.ph], ["pass", S.pass ? `${S.pass} / ${passes.length}` : "–"], ["wheel n = vs·60 000/(π·d)", `${p.vs || 30}·60 000/(π·${p.ds || 25}) = ${f0(P.wheelRpm(p.vs || 30, p.ds || 25))} min⁻¹`],
        ["work speed / table", S.nw ? `${S.nw} min⁻¹ → ${10 * S.nw} mm/min` : "–"], ["grinding time", `4·80/300 + 2·80/80 = ${f2(P.threadTime(p.passes || [[4, 30], [2, 8]], 80, 0, 10))} min (+ dress, measure, load)`], ["risk", "long thin quill bends → tapered thread (bell-mouth)"]] }) };
  },

  /* ---------------------------------------------------------------- rail drilling centre (gantry, 2 spindles) */
  raildrill(K, op, ctx) {
    const { C } = K, g = K.grp(), p = op.p || {};
    g.add(K.boxB(1800, 800, 900, C.body)); g.add(K.boxB(1700, 60, 400, C.iron, 0, 800, 0));
    const rail = K.rail(1000, { holes: true }); rail.position.y = 860; g.add(rail);
    const holes = rail.children.slice(1); holes.forEach((h) => { h.visible = false; });
    for (let k = 0; k < 5; k++) g.add(K.boxB(40, 40, 120, C.blue, -400 + k * 200, 860, -60));
    const gan = K.grp(K.boxB(120, 1300, 120, C.body2, 0, 0, -600), K.boxB(120, 1300, 120, C.body2, 0, 0, 600), K.boxB(160, 160, 1360, C.body2, 0, 1300, 0)); g.add(gan);
    const spins = [-1, 1].map((s) => { const sp = K.grp(K.boxB(140, 300, 160, C.blue, 0, 0, 0), K.cylY(3.5, 90, C.insert, 0, -190, 0, 12)); sp.position.set(s * 60, 1150, 0); gan.add(sp); return sp; });
    const chips = K.chips(200); g.add(chips.obj);
    const n = holes.length, S = { k: 0, ph: "" };
    const tick = (T) => {
      if (T.p < 0.01) holes.forEach((h) => { h.visible = false; });
      const steps = Math.ceil(n / 2), st = Math.min(steps - 1, Math.floor(T.p * steps)), s = (T.p * steps) % 1;
      gan.position.x = -500 + LG.E + st * 2 * LG.pitch + 30;
      spins.forEach((q, i) => { const idx = st * 2 + i; if (idx >= n) { q.position.y = 1150; return; } q.position.y = 1150 - 220 * Math.sin(Math.min(1, s * 1.2) * PI); q.children[1].rotation.y += T.dt * 50; if (s > 0.5) holes[idx].visible = true; if (s > 0.2 && s < 0.6 && T.dt) chips.emit(1, [gan.position.x + (i ? 60 : -60), 885, 0], () => [K.rnd(200), 300, K.rnd(200)]); });
      S.k = Math.min(n, st * 2 + (s > 0.5 ? 2 : 0)); S.ph = `holes ${S.k} / ${n}`;
    };
    return { g, dur: 10, cam: [[0, 900, 0], [900, 1500, 1500]], tick, tags: [["2 spindles: step drill Ø7 + counterbore Ø11", spins[0], [0, -240, 0]], ["rail (soft) clamped", rail, [300, 30, 0]]],
      read: () => ({ rows: [["holes", S.ph], ["pitch / end distance", `${LG.pitch} / ${LG.E} mm → ${n} holes`], ["drill n = 1 000·vc/(π·d)", `1 000·90/(π·7) = ${f0(1000 * 90 / (PI * 7))} min⁻¹, f 0.12 mm/rev`], ["counterbore", "Ø11 × 9 for M6 (ISO 4762)"], ["mistake", "burr in the counterbore, wrong reference end"]] }) };
  },

  /* ---------------------------------------------------------------- rail induction line (through-feed) */
  railind(K, op, ctx) {
    const { C } = K, g = K.grp(), p = op.p || {};
    g.add(K.boxB(3600, 800, 600, C.body)); for (let k = 0; k < 12; k++) g.add(K.cylZ(25, 300, C.steel, -1650 + k * 300, 825, 0, 16));
    g.add(K.boxB(500, 700, 700, C.body2, 0, 850, -500)); g.add(K.boxB(200, 400, 500, C.glass, 0, 850, 0));
    const rail = K.rail(1000, { hard: false, holes: true, stripes: true }); const rg = K.grp(rail); rg.position.y = 850; g.add(rg);
    const stripes = rail.userData.stripes; stripes.forEach((s) => { s.material = C.hard; });
    for (const s of [-1, 1]) { const c = K.boxB(80, 14, 10, C.copper, 0, 850 + 17, s * 17); g.add(c); g.add(K.boxB(10, 10, 300, C.copper, 0, 850 + 30, s * 120 - (s > 0 ? -150 : 150) * 0)); }
    const glow = K.boxB(40, 26, 30, C.glow, 0, 850 + 10, 0); g.add(glow);
    const spr = K.coolant(500); g.add(spr.obj);
    const S = { x: 0 };
    const tick = (T) => {
      const s = T.p, x = K.lerp(-560, 560, s); rg.position.x = -x;
      const front = x + 500, L = Math.max(1, Math.min(1000, front));
      stripes.forEach((st) => { st.scale.x = L / 1000; st.position.x = -500 + L / 2; st.visible = front > 0; });
      glow.visible = front > 0 && front < 1000;
      if (glow.visible && T.dt) spr.emit(5, [80 + K.rnd(30), 900, 0], () => [100 + K.rnd(100), -200, K.rnd(200)]);
      S.x = Math.max(0, Math.min(1000, front));
    };
    const dh = P.inductionDepth(1.2e-6, 1, (p.f || 30) * 1000);
    return { g, dur: 12, cam: [[0, 900, 0], [1000, 1400, 1500]], tick, tags: [["2 hairpin coils (left + right shoulder)", glow, [0, 40, 0]], ["hardened raceway shoulders", rg, [-300, 25, 0]]],
      read: () => ({ rows: [["hardened length", f0(S.x) + " / 1 020 mm"], ["frequency / power", `${p.f || 30} kHz / ≈ ${p.P || 80} kW`], ["feed", `${p.v || 8} mm/s → ${f0((p.L || 1020) / (p.v || 8))} s per rail`], ["δ hot", f2(dh) + " mm → case 1.5 – 2.5 mm"], ["base", "stays soft (bolt holes, straightening)"]] }) };
  },

  /* ---------------------------------------------------------------- surface grinder (magnetic chuck) */
  surfgrind(K, op, ctx) {
    const { C } = K, g = K.grp(), p = op.p || {}, rails = ctx.route === "LG";
    g.add(K.boxB(3000, 800, 1200, C.body)); g.add(K.boxB(500, 2000, 600, C.body2, 0, 0, -900));
    const tab = K.grp(K.boxB(2200, 80, 520, C.dark, 0, 0, 0)); tab.position.y = 800; g.add(tab);
    if (rails) for (let k = 0; k < 6; k++) { const r = K.rail(1000, { hard: true, holes: true, stripes: true }); r.rotation.x = PI; r.position.set(0, 80 + 22, -200 + k * 80); tab.add(r); }
    else for (let i = 0; i < 10; i++) for (let j = 0; j < 2; j++) { const b = K.block({ hard: true }); b.rotation.x = PI; b.position.set(-560 + i * 120, 80 + 36, -100 + j * 200); tab.add(b); }
    const wh = K.grp(K.boxB(500, 400, 500, C.body2, 0, 100, -350)); g.add(wh);
    const whl = K.wheel(200, 50, C.wheel); wh.add(whl);
    const sp = K.sparks(500); g.add(sp.obj);
    const S = { cross: 0 };
    const tick = (T) => {
      const s = (T.t * 0.35) % 2, x = s < 1 ? K.lerp(-900, 900, K.ease(s)) : K.lerp(900, -900, K.ease(s - 1));
      tab.position.x = x; const cz = ((Math.floor(T.t * 0.7) % 8) * 60) - 200;
      wh.position.set(0, 800 + 80 + (rails ? 22 + 0 : 36 - 5.5) + 200 + 0.5, cz); whl.rotation.z -= T.dt * 30;
      if (T.dt) sp.emit(4, [0, wh.position.y - 200, cz], () => [(s < 1 ? 1 : -1) * (800 + Math.random() * 600), 200 + Math.random() * 400, K.rnd(200)]);
      S.cross = cz;
    };
    return { g, dur: 10, cam: [[0, 1000, 0], [1600, 1800, 2200]], tick, tags: [["wheel 89A 46 J Ø400", whl, [0, 210, 0]], [rails ? "rails, base up, on the magnetic chuck" : "blocks in a string, base up", tab, [600, 160, 0]]],
      read: () => ({ rows: [["wheel n", `${p.vs || 30}·60 000/(π·400) = ${f0(P.wheelRpm(p.vs || 30, 400))} min⁻¹`], ["table speed", (p.vt || 15) + " m/min"], ["cross feed / depth", "10 mm per stroke / ap 0.01 mm"], ["stock", "0.1 mm"], ["mistake", "the magnet pulls a bent part flat – it springs back after unclamping"]] }) };
  },

  /* ---------------------------------------------------------------- rail profile grinder (3 heads) */
  profgrind(K, op, ctx) {
    const { C } = K, g = K.grp(), p = op.p || {};
    g.add(K.boxB(5600, 800, 1400, C.body));
    const tab = K.grp(K.boxB(4600, 80, 400, C.dark)); tab.position.y = 800; g.add(tab);
    for (let k = 0; k < 4; k++) { const r = K.rail(1000, { hard: true, holes: true, stripes: true }); r.position.set(-1530 + k * 1020, 80, 0); tab.add(r); }
    const heads = [];
    const mk = (x, kind) => {
      const gan = K.grp(K.boxB(140, 1500, 140, C.body2, 0, 0, -700), K.boxB(140, 1500, 140, C.body2, 0, 0, 700), K.boxB(180, 200, 1540, C.body2, 0, 1500, 0)); gan.position.x = x; g.add(gan);
      const head = K.grp(); gan.add(head);
      if (kind === "top") { const w = K.wheel(175, 40, C.wheel); w.position.set(0, 800 + 80 + 22 + 175, 0); head.add(w); head.add(K.boxB(300, 300, 400, C.blue, 0, 1150, -260)); heads.push({ w, kind }); }
      else for (const s of [-1, 1]) {
        const w = K.wheel(120, 14, C.wheelB); const wg = K.grp(w); wg.position.set(0, 800 + 80 + 15 + 87, s * (11.6 + 87)); wg.rotation.x = s * PI / 4;
        const hb = K.grp(wg, K.boxB(200, 200, 260, C.blue, 0, 1160, s * 300)); head.add(hb); heads.push({ w, kind, s });
        if (kind === "left" && s < 0 || kind === "right" && s > 0) hb.visible = true; else hb.visible = false;
      }
      const roll = K.cylX(40, 60, C.cbn, 160, 1240, 0, 24); head.add(roll);
      return gan;
    };
    const G = [mk(-900, "top"), mk(0, "left"), mk(900, "right")];
    const sp = K.sparks(800); g.add(sp.obj);
    const S = { pass: 1, v: 10 };
    const tick = (T) => {
      const ph = K.phase(T.p, [["rough pass 1 – 10 m/min", 3], ["rough pass 2 – 10 m/min", 3], ["finish pass – 3 m/min", 6], ["dress all wheels (diamond rolls)", 1.2]]);
      tab.position.x = ph.name.startsWith("dress") ? 2300 : K.lerp(2300, -2300, ph.s);
      heads.forEach(({ w }) => { w.rotation.z -= T.dt * 30; });
      if (!ph.name.startsWith("dress") && T.dt) { sp.emit(3, [-900, 905, 0], () => [K.rnd(500), 300 + Math.random() * 300, 600 + Math.random() * 400]); sp.emit(2, [0, 897, -12], () => [K.rnd(300), 300, -600]); sp.emit(2, [900, 897, 12], () => [K.rnd(300), 300, 600]); }
      S.ph = ph.name; S.v = ph.name.includes("3 m") ? 3 : 10;
    };
    return { g, dur: 13, cam: [[0, 950, 0], [2000, 2000, 3000]], tick,
      tags: [["head 1: top + datum side", G[0], [0, 1600, 0]], ["head 2: left raceways (form wheel 45°)", G[1], [0, 1600, 0]], ["head 3: right raceways", G[2], [0, 1600, 0]], ["4 rails in a string", tab, [-1000, 140, 0]]],
      read: () => ({ rows: [["step", S.ph || ""], ["table speed", S.v + " m/min"], ["wheel speed", `vs ${p.vs || 35} m/s → Ø350: ${f0(P.wheelRpm(p.vs || 35, 350))} min⁻¹`], ["string time", `2·4.38/10 + 4.38/3 = ${f2(2 * 4.38 / 10 + 4.38 / 3)} min for 4 rails`], ["dressing", "CNC diamond profile rolls, Ud ≈ 3"]] }) };
  },

  /* ---------------------------------------------------------------- block raceway grinder (form wheel inside the channel) */
  blockgrind(K, op, ctx) {
    const { C } = K, g = K.grp(), p = op.p || {};
    g.add(K.boxB(2600, 800, 1200, C.body)); g.add(K.boxB(500, 2000, 600, C.body2, 0, 0, -900));
    const tab = K.grp(K.boxB(1600, 80, 400, C.dark), K.boxB(1400, 20, 23, C.steel, 0, 80, 0)); tab.position.y = 800; g.add(tab);
    for (let i = 0; i < 10; i++) { const b = K.block({ hard: true }); b.rotation.x = PI; b.position.set(-585 + i * 130, 80 + 36 + 5, 0); b.scale.set(2, 1, 1); b.scale.set(1, 1, 1); tab.add(b); }
    const head = K.grp(K.boxB(400, 500, 400, C.body2, 0, 300, -300), K.cylZ(40, 300, C.dark, 0, 0, -150, 20)); g.add(head);
    const whl = K.wheel(40, 22, C.cbn); head.add(whl);
    const sp = K.sparks(400); g.add(sp.obj);
    const S = { ph: "" };
    const tick = (T) => {
      const ph = K.phase(T.p, [["pass 1 – table 3 m/min", 3], ["pass 2", 3], ["pass 3 (finish)", 3.5], ["dress (diamond roll)", 1]]);
      tab.position.x = ph.name.startsWith("dress") ? 800 : K.lerp(800, -800, ph.s);
      head.position.set(0, 800 + 80 + 41 - 17.5 + 40 - 0, 0); head.position.y = 800 + 80 + 5 + 36 - 23 + 40 - 4 + (ph.name.startsWith("dress") ? 80 : 0);
      whl.rotation.z -= T.dt * 50;
      if (!ph.name.startsWith("dress") && T.dt) sp.emit(3, [0, head.position.y - 30, 0], () => [K.rnd(700), 400 + Math.random() * 300, K.rnd(200)]);
      S.ph = ph.name;
    };
    return { g, dur: 10.5, cam: [[0, 950, 0], [900, 1300, 1300]], tick, tags: [["form wheel Ø80 inside the channel (2 raceways per side)", whl, [0, 50, 0]], ["10 blocks in a string, channel up", tab, [400, 140, 0]]],
      read: () => ({ rows: [["step", S.ph], ["wheel n", `${p.vs || 30}·60 000/(π·80) = ${f0(P.wheelRpm(p.vs || 30, 80))} min⁻¹ (CBN 45 m/s → ${f0(P.wheelRpm(45, 80))})`], ["table", (p.vt || 3) + " m/min, 3 passes"], ["string", "10 blocks on a dummy-rail fixture"], ["check", "raceway height + width over gauge balls vs master rail"]] }) };
  },

  /* ---------------------------------------------------------------- injection moulding (bought end caps – supplier) */
  mould(K, op, ctx) {
    const { C } = K, g = K.grp();
    g.add(K.boxB(3600, 900, 1000, C.body)); g.add(K.cylX(70, 1300, C.steel, 900, 1150, 0, 24)); for (let k = 0; k < 4; k++) g.add(K.cylX(78, 60, C.copper, 500 + k * 220, 1150, 0, 24));
    const hop = K.mesh(new K.THREE.ConeGeometry(160, 300, 24), C.body2, 1300, 1450, 0); hop.rotation.x = PI; g.add(hop);
    g.add(K.boxB(80, 700, 900, C.body2, -400, 900, 0)); const mov = K.boxB(80, 700, 900, C.body2, -800, 900, 0); g.add(mov); g.add(K.boxB(80, 700, 900, C.body2, -1500, 900, 0));
    for (const y of [1000, 1500]) for (const z of [-350, 350]) g.add(K.cylX(30, 1200, C.steel, -950, y, z, 16));
    const bin = K.boxB(500, 300, 500, C.blue, -600, 0, 800); g.add(bin);
    const caps = []; for (let k = 0; k < 4; k++) { const c = K.boxB(70, 36, 14, C.pom, -600, 1200, 0); g.add(c); caps.push(c); }
    const tick = (T) => {
      const ph = K.phase(T.p, [["inject + hold", 3], ["cool", 2], ["open + eject", 2], ["close", 1]]);
      mov.position.x = ph.name.startsWith("open") ? -800 - 200 * K.ease(ph.s) : ph.name === "close" ? -1000 + 200 * K.ease(ph.s) : -800;
      caps.forEach((c, i) => { if (ph.name.startsWith("open")) { c.visible = true; c.position.set(-600 + K.rnd(5), 1200 - 900 * ph.s * ph.s, 200 + ph.s * 600 + i * 30); } else c.visible = false; });
    };
    return { g, dur: 8, cam: [[0, 1100, 0], [2400, 2000, 3200]], tick, tags: [["BOUGHT – supplier's moulding machine", g, [0, 1700, 0]], ["4-cavity tool (POM end caps)", mov, [0, 400, 0]]],
      read: () => ({ rows: [["make / buy", "BUY – injection moulded by a supplier"], ["machine", "80 t, 4-cavity tool, POM / PA66"], ["our operation", "incoming check: ball path step, flash, size (AQL 0.65)"], ["time in our plant", op.cyc + " min per piece (QC-INC)"]] }) };
  },

  /* ---------------------------------------------------------------- assembly bench (deflectors into the nut / balls + end caps into the block) */
  bench(K, op, ctx) {
    const { C } = K, g = K.grp(), nutR = ctx.route === "BN";
    g.add(K.boxB(1800, 850, 900, C.body)); g.add(K.boxB(1810, 30, 910, C.wood, 0, 850, 0));
    const press = K.grp(K.boxB(200, 900, 200, C.body2, 0, 880, -300), K.boxB(200, 120, 500, C.body2, 0, 1700, -100)); g.add(press);
    const ram = K.cylY(14, 300, C.steel, 0, 0, 0, 16); const rg = K.grp(ram); rg.position.set(0, 1500, 60); g.add(rg);
    const balls = []; const S = { n: 0, ph: "" };
    let work, items = [];
    if (nutR) {
      work = K.nut("full", { hard: true, holes: true, windows: true }); work.scale.setScalar(3); work.rotation.z = PI / 2; work.position.set(0, 880 + 150, 60); g.add(work);
      for (let k = 0; k < 4; k++) { const d = K.boxB(16, 10, 10, C.pom, 0, 0, 0); d.scale.setScalar(3); g.add(d); items.push(d); }
      const lv = K.grp(K.boxB(60, 200, 60, C.dark, 0, 0, 0)); lv.position.set(500, 880, 60); g.add(lv); g.add(K.cylX(16.5 * 3, 600, C.ground, -600, 880 + 150, 60, 32));
    } else {
      const dr = K.boxB(1200, 66, 23 * 3, C.white, 0, 880, 60); g.add(dr);
      work = K.block({ hard: true }); work.scale.setScalar(3); work.position.set(0, 880, 60); g.add(work);
      for (const s of [-1, 1]) { const c = K.boxB(36, 90, 210, C.pom, s * 600, 880 + 70, 60); g.add(c); items.push(c); }
      const tube = K.cylY(10, 500, C.glass, 300, 1250, 60, 12); g.add(tube);
      for (let k = 0; k < 12; k++) { const b = K.mesh(new K.THREE.SphereGeometry(7, 12, 10), C.ball); g.add(b); balls.push(b); }
    }
    const tick = (T) => {
      if (nutR) {
        const ph = K.phase(T.p, [["press deflector 1", 2], ["press deflector 2", 2], ["press deflector 3", 2], ["press deflector 4", 2], ["gauge-ball fit on the master screw → ball class", 3]]);
        items.forEach((d, i) => { const k = Math.min(3, ph.i); if (i < k || ph.name.startsWith("gauge")) { d.position.set(-60 + i * 48, 880 + 150 + 22 * 3 * 0 + 66, 60); d.visible = true; } else if (i === k && !ph.name.startsWith("gauge")) { d.position.set(-60 + i * 48, 1300 - 230 * ph.s, 60); d.visible = true; } else d.visible = false; });
        if (T.p < 0.01) items.forEach((d) => { d.visible = false; });
        rg.position.set(-60 + Math.min(3, ph.i) * 48, ph.name.startsWith("gauge") ? 1500 : 1500 - 230 * Math.sin(ph.s * PI), 60);
        S.ph = ph.name; S.n = Math.min(4, ph.i + (ph.s > 0.5 ? 1 : 0));
      } else {
        const ph = K.phase(T.p, [["insert return pipes + retainers", 2], ["fill 4 × 30 balls (counting feeder)", 6], ["fit end caps + seals + nipple", 3]]);
        balls.forEach((b, i) => { const s = (T.t * 1.5 + i / balls.length) % 1; b.position.set(300, 1500 - 600 * s, 60); b.visible = ph.name.startsWith("fill"); });
        items.forEach((c, i) => { c.position.x = (i ? 1 : -1) * (ph.name.startsWith("fit") ? K.lerp(600, 105, K.ease(Math.min(1, ph.s * 1.5))) : 600); });
        if (ph.name.startsWith("fill")) S.n = Math.round(120 * ph.s); else if (ph.name.startsWith("insert")) S.n = 0; else S.n = 120;
        S.ph = ph.name;
      }
    };
    return { g, dur: 11, cam: [[0, 1050, 0], [900, 1500, 1500]], tick, tags: nutR ? [["deflector press", rg, [0, 0, 0]], ["nut (scale 3 : 1)", work, [0, 0, 0]], ["master screw + gauge balls", g, [-600, 1080, 60]]] : [["ball feeder", g, [300, 1550, 60]], ["block on dummy rail (scale 3 : 1)", work, [0, 40, 0]], ["end cap", items[1], [0, 60, 0]]],
      read: () => ({ rows: nutR ? [["step", S.ph], ["deflectors seated", `${S.n} / 4`], ["press force", "≤ 0.5 kN, flush ≤ 0.01 mm"], ["ball class", "from the axial play on the master screw → oversize for P1 (3 % Ca)"]] : [["step", S.ph], ["balls", `${S.n} / 120 (4 rows × 30, Ø4.763 G10)`], ["end-cap screws", "0.6 N·m"], ["grease", "1.5 cm³"]] }) };
  },

  /* ---------------------------------------------------------------- ball screw assembly + preload torque test */
  assy(K, op, ctx) {
    const { C } = K, g = K.grp();
    g.add(K.boxB(2600, 850, 900, C.body)); g.add(K.boxB(2610, 30, 910, C.wood, 0, 850, 0));
    const yS = 1050;
    const sh = K.shaft("thread", { hard: true, groundJ: true }); sh.position.set(0, yS, 0); g.add(sh);
    for (const x of [-440, 470]) g.add(K.boxB(80, yS - 880 - 14, 120, C.dark, x, 880, 0));
    g.add(K.boxB(260, 260, 260, C.dark, -720, yS - 130, 0)); g.add(K.cylX(40, 100, C.blue, -560, yS, 0, 20));
    const sleeve = K.cylX(13.2, 300, C.glass, 650, yS, 0, 24); g.add(sleeve);
    const nut = K.nut("full", { hard: true, holes: true, windows: true }); g.add(nut);
    const arm = K.grp(K.boxB(20, 200, 20, C.dark, 0, -100, 0)); nut.add(arm); arm.position.set(0, -25, 0);
    const lc = K.boxB(60, 40, 60, C.yellow, 0, 880 + 20, 0); g.add(lc);
    const S = { ph: "", T: 0, pts: [] };
    const Tp = P.preloadTorque().Tp;
    const tick = (T) => {
      const ph = K.phase(T.p, [["balls loaded into the nut on the sleeve (arbor)", 2.5], ["nut slides from the sleeve onto the screw", 2.5], ["preload torque test – screw turns 60 min⁻¹", 7]]);
      if (ph.name.startsWith("balls")) { nut.position.set(700, yS, 0); }
      else if (ph.name.startsWith("nut")) nut.position.set(K.lerp(700, 300, K.ease(ph.s)), yS, 0);
      else { const x = K.lerp(300, -300, ph.s); nut.position.set(x, yS, 0); sh.rotation.x = TAU * (300 - x) / 10; }
      lc.position.x = nut.position.x; lc.visible = ph.name.startsWith("pre");
      if (T.p < 0.01) S.pts = [];
      if (ph.name.startsWith("pre")) { const v = Tp * (1 + 0.12 * Math.sin(ph.s * 37) + 0.05 * Math.sin(ph.s * 151)); S.T = v; if (!S.pts.length || ph.s - S.pts[S.pts.length - 1][0] > 0.01) S.pts.push([ph.s, v]); }
      S.ph = ph.name;
    };
    const chart = () => { const W = 300, Hh = 110, X = (s) => 20 + s * (W - 30), Y = (v) => Hh - 10 - v / (Tp * 2) * (Hh - 20);
      return `<svg viewBox="0 0 ${W} ${Hh}" class="bf2-chart" role="img" aria-label="preload torque chart"><rect width="${W}" height="${Hh}" fill="#fff"/><rect x="20" y="${Y(Tp * 1.4)}" width="${W - 30}" height="${Y(Tp * 0.6) - Y(Tp * 1.4)}" fill="#eaf1fb"/>
        <line x1="20" y1="${Y(Tp)}" x2="${W - 10}" y2="${Y(Tp)}" stroke="#1f6fd1" stroke-dasharray="4 3"/><polyline points="${S.pts.map(([s, v]) => `${X(s).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")}" fill="none" stroke="#d62828" stroke-width="1.3"/>
        <text x="22" y="12" font-size="9">band Tp ± 40 % (example) – stroke →</text></svg>`; };
    return { g, dur: 12, cam: [[200, 1050, 0], [800, 1450, 1400]], tick, tags: [["ball loading sleeve (arbor)", sleeve, [0, 40, 0]], ["ball nut BN-3210-FL", nut, [0, 60, 0]], ["force arm + load cell", lc, [0, 40, 0]]],
      read: () => ({ rows: [["step", S.ph], ["Tp = 0.05/√tanλ · Fpr·Ph/(2π)", `λ ${f2(BS.leadAngleDeg)}°, Fpr ${BN.Fpr} N → ${f3(Tp)} N·m`], ["measured now", S.T ? f3(S.T) + " N·m" : "–"], ["limit", `${f3(Tp * 0.6)} – ${f3(Tp * 1.4)} N·m (± 40 %, example)`]], chart: chart() }) };
  },

  /* ---------------------------------------------------------------- run-in stand */
  runin(K, op, ctx) {
    const { C } = K, g = K.grp(), p = op.p || {};
    g.add(K.boxB(2800, 800, 900, C.body2)); g.add(K.boxB(2700, 40, 700, C.iron, 0, 800, 0));
    const yS = 1000; const sh = K.shaft("thread", { hard: true, groundJ: true }); sh.position.set(0, yS, 0); g.add(sh);
    g.add(K.boxB(140, yS - 840 + 60, 200, C.blue, -445, 840, 0)); g.add(K.boxB(100, yS - 840 + 40, 160, C.blue, 475, 840, 0));
    g.add(K.boxB(300, 240, 240, C.dark, -900, yS - 120, 0)); g.add(K.cylX(30, 90, C.steel, -690, yS, 0, 16));
    for (const z of [-200, 200]) g.add(K.boxB(1200, 22, 23, C.steel, 0, 840, z));
    const tab = K.grp(K.boxB(200, 30, 480, C.body, 0, 0, 0)); g.add(tab);
    const nut = K.nut("full", { hard: true, holes: true }); g.add(nut);
    const S = { k: 0, T: 0, dir: 1 };
    const tick = (T) => {
      const s = T.t * 0.25, k = Math.floor(s), u = s % 1, x = (k % 2 === 0 ? K.lerp(-300, 380, K.ease(u)) : K.lerp(380, -300, K.ease(u)));
      nut.position.set(x, yS, 0); tab.position.set(x, yS + 55, 0); sh.rotation.x = TAU * x / 10;
      S.k = (k % 10) + 1; S.T = 0.29 * (1 + 0.1 * Math.sin(T.t * 9)) + 0.05; S.dir = k % 2 ? -1 : 1;
    };
    return { g, dur: 16, cam: [[0, 1000, 0], [1000, 1500, 1700]], tick, tags: [["servo motor + torque sensor", g, [-900, yS + 150, 0]], ["nut on a guided table", tab, [0, 40, 0]]],
      read: () => ({ rows: [["stroke", `${S.k} / 10 (${S.dir > 0 ? "forward" : "back"})`], ["speed", `${p.rpm || 500} min⁻¹ → ${(p.rpm || 500) * 10 / 1000} m/min`], ["torque now", f3(S.T) + " N·m"], ["noise limit", "≤ 65 dB(A) at 500 min⁻¹ (example)"], ["mistake", "running dry → false torque peaks, wear"]] }) };
  },

  /* ---------------------------------------------------------------- preload matching / guide set check */
  match(K, op, ctx) {
    const { C } = K, g = K.grp(), set = op.m === "AS-GAS";
    g.add(K.boxB(1800, 800, 900, C.body2)); g.add(K.boxB(1700, 200, 700, C.granite, 0, 800, 0));
    const r = K.rail(set ? 1000 : 400, { hard: true, holes: true, stripes: true }); r.position.y = 1000; g.add(r);
    const blocks = (set ? [-150, 150] : [0]).map((x) => { const b = K.block({ hard: true, caps: true }); b.position.set(x, 1000, 0); g.add(b); return b; });
    const pusher = K.grp(K.boxB(200, 80, 80, C.blue, 0, 0, 0), K.cylX(8, 120, C.steel, 160, 0, 0, 12)); pusher.position.set(-500, 1020, 0); g.add(pusher);
    const D = K.dial(26); D.g.position.set(0, 1036 + 26 + 60 + 26, 60); g.add(D.g);
    const S = { F: 0, ph: "" };
    const tick = (T) => {
      const ph = K.phase(T.p, set ? [["block 1: drag force", 3], ["block 2: drag force", 3], ["running parallelism (probe along the rail)", 4]] : [["push the block: drag force", 4], ["height H", 2], ["classify", 1.5]]);
      const bi = set && ph.name.startsWith("block 2") ? 1 : 0, b = blocks[bi];
      if (ph.name.includes("drag")) { const x0 = set ? (bi ? 150 : -150) : 0; b.position.x = x0 + 60 * Math.sin(ph.s * PI); pusher.position.x = b.position.x - 29 - 280; S.F = 14 + 2 * Math.sin(ph.s * 20); }
      else { S.F = 0; pusher.position.x = -600; }
      D.g.position.x = ph.name.startsWith("running") ? K.lerp(-400, 400, ph.s) : blocks[0].position.x;
      D.needle.rotation.z = ph.name.startsWith("running") ? -0.4 * Math.sin(ph.s * 5) : -0.2;
      S.ph = ph.name;
    };
    return { g, dur: set ? 10 : 7.5, cam: [[0, 1050, 0], [700, 1350, 1100]], tick, tags: [[set ? "rail + 2 matched blocks" : "master rail section", r, [0, 30, 0]], ["push-pull force sensor", pusher, [0, 60, 0]], ["height probe", D.g, [0, 40, 0]]],
      read: () => ({ rows: [["step", S.ph], ["drag force now", S.F ? f1(S.F) + " N" : "–"], ["Z1 window (example)", "10 – 20 N per block"], ["height class H", "± 0.04 mm, pair variation ≤ 15 µm"], ["outside the window", "re-ball with the next ball size class"]] }) };
  },

  /* ---------------------------------------------------------------- laser marking */
  mark(K, op, ctx) {
    const { C } = K, g = K.grp();
    g.add(K.boxB(1200, 850, 900, C.body)); g.add(K.boxB(1200, 1000, 900, C.glass, 0, 850, 0)); g.add(K.boxB(1210, 40, 910, C.blue, 0, 1850, 0));
    const head = K.grp(K.boxB(160, 260, 160, C.dark, 0, 0, 0)); head.position.set(0, 1500, 0); g.add(head);
    const part = ctx.route === "FALG" ? K.rail(400, { hard: true, holes: true }) : K.nut("full", { hard: true, holes: true }); part.position.set(0, 900, 0); if (ctx.route !== "FALG") { part.rotation.z = PI / 2; part.position.y = 950; } g.add(part);
    const beam = K.cylY(1.5, 1, C.laser, 0, 0, 0, 6); g.add(beam);
    const mk = K.boxB(1, 1, 1, C.black, 0, 0, 0); g.add(mk);
    const tick = (T) => {
      const s = T.p, x = 20 * Math.sin(s * 40), z = 12 * Math.cos(s * 23);
      const yT = ctx.route === "FALG" ? 922 : 1000;
      beam.scale.y = 1500 - 130 - yT; beam.position.set(x * 0.3, (1500 - 130 + yT) / 2, z * 0.3);
      mk.scale.set(Math.max(1, 50 * s), 1, 24); mk.position.set(-25 + 25 * s, yT + 0.6, 0);
    };
    return { g, dur: 6, cam: [[0, 1050, 0], [600, 1400, 1100]], tick, tags: [["fibre laser 20 W", head, [0, 150, 0]], ["data-matrix + text", mk, [0, 10, 0]]],
      read: () => ({ rows: [["content", "code, serial, grade / class, date (from MES over HTTP)"], ["laser", "fibre 20 W, class 1 cabin"], ["check", "code reader 100 %"], ["mistake", "wrong serial → certificate does not match"]] }) };
  },

  /* ---------------------------------------------------------------- packing */
  pack(K, op, ctx) {
    const { C } = K, g = K.grp(), rail = ctx.route === "FALG";
    g.add(K.boxB(2200, 850, 900, C.body)); g.add(K.boxB(2210, 30, 910, C.wood, 0, 850, 0));
    const part = rail ? K.rail(1000, { hard: true, holes: true }) : K.shaft("thread", { hard: true, groundJ: true }); part.position.y = rail ? 900 : 930; g.add(part);
    if (!rail) { const n = K.nut("full", { hard: true, holes: true }); n.position.set(0, 930, 0); g.add(n); } else for (const x of [-200, 200]) { const b = K.block({ hard: true, caps: true }); b.position.set(x + 900, 880, 300); g.add(b); }
    const film = K.boxB(1080, 120, 140, C.film, 0, 880, 0); g.add(film);
    const box = K.grp(K.boxB(1200, 20, 260, C.wood, 0, 0, 0), K.boxB(1200, 160, 20, C.wood, 0, 0, -130), K.boxB(1200, 160, 20, C.wood, 0, 0, 130)); box.position.y = 865; g.add(box);
    const lid = K.boxB(1200, 20, 260, C.wood, 0, 0, 130); const lg = K.grp(lid); lg.position.set(0, 1030, -130); g.add(lg); lid.position.z = 130;
    const mist = K.particles(300, 0xc8b070, 6, { life: 0.6, g: -800, op: 0.5 }); g.add(mist.obj);
    const tick = (T) => {
      const ph = K.phase(T.p, [["oil (rust protection)", 2], ["VCI film / tube", 2.5], ["documents (lead chart, report)", 1], ["close the box", 1.5]]);
      if (ph.name.startsWith("oil") && T.dt) mist.emit(4, [K.lerp(-500, 500, ph.s), 1150, 0], () => [K.rnd(60), -500, K.rnd(60)]);
      film.visible = !ph.name.startsWith("oil"); film.scale.x = ph.name.startsWith("VCI") ? Math.max(0.01, ph.s) : 1; film.position.x = ph.name.startsWith("VCI") ? -540 + 540 * ph.s : 0;
      lg.rotation.x = ph.name.startsWith("close") ? -PI / 2 * (1 - K.ease(ph.s)) : -PI / 2;
    };
    return { g, dur: 7, cam: [[0, 950, 0], [900, 1500, 1500]], tick, tags: [["VCI film", film, [0, 70, 0]], ["wood box, supports every 300 mm", box, [400, 170, 0]]],
      read: () => ({ rows: [["steps", "oil → VCI film / tube → documents → box"], ["supports", "every 300 mm (screw must not bend)"], ["papers", rail ? "class, datum side, serial" : "lead chart + test report"], ["mistake", rail ? "block slides off the dummy rail → balls fall out" : "no supports → bent in transport"]] }) };
  },

  /* ---------------------------------------------------------------- rail measuring bench */
  railcheck(K, op, ctx) {
    const { C } = K, g = K.grp();
    g.add(K.boxB(1800, 750, 900, C.body2)); g.add(K.boxB(1700, 250, 700, C.granite, 0, 750, 0));
    const r = K.rail(1000, { hard: true, holes: true, stripes: true }); r.position.y = 1000; g.add(r);
    const gan = K.grp(K.boxB(80, 500, 80, C.body2, 0, 0, -350), K.boxB(80, 500, 80, C.body2, 0, 0, 350), K.boxB(120, 100, 780, C.body2, 0, 500, 0)); gan.position.y = 1000; g.add(gan);
    const cam = K.grp(K.cylY(30, 120, C.dark, 0, 0, 0, 20), K.torus(34, 4, C.red)); cam.position.set(0, 1200, 0); cam.children[1].rotation.x = PI / 2; cam.children[1].position.y = -62; g.add(cam);
    const n = r.userData.nHoles, dv = (k) => 0.04 * Math.sin(k * 1.3) + 0.02 * k / n, S = { k: 0 };
    const tick = (T) => { const k = Math.min(n - 1, Math.floor(T.p * n)); gan.position.x = cam.position.x = -500 + LG.E + k * LG.pitch; S.k = k + 1; };
    return { g, dur: 9, cam: [[0, 1050, 0], [700, 1400, 1200]], tick, tags: [["camera + ring light", cam, [0, 70, 0]], ["finished rail", r, [300, 30, 0]]],
      read: () => ({ rows: [["hole", `${S.k} / ${n}`], ["pitch deviation (cumulative)", (dv(S.k) >= 0 ? "+" : "") + dv(S.k).toFixed(3) + " mm (limit ± 0.2)"], ["running parallelism", "class H: 13 µm / 700 mm (block + probe)"], ["marks", "datum side, class, serial"]] }) };
  },
};
