/* APC tab - detailed 3D structure of the 2-pallet rotary pallet changer (parametric, from the design inputs),
   the hydraulic circuit (ISO 1219 style) and a section through one zero-point clamping module.
   Everything follows the pallet-change step animation of apc.js (window.APC / window.apc3d hooks).

   Structure (as built):  base frame -> 4 guide columns + lift cylinder -> lift carriage (servo, gearbox, pinion,
   slewing bearing outer ring) -> rotor (bearing inner ring, ring gear, hub, arm, cross beams, fork rails,
   partition wall) -> pallets with lifting ledges and pull studs.  Machine side: B-axis table + receiver plate with
   zero-point modules, rotary union.  Load station with locating cones, light curtain, operator panel.
   Hydraulic power unit: tank, motor + pump, accumulator, filter, manifold with valves, pressure switches, pipes.
   All dimensions follow the inputs; details (module m, tube sizes, sheet thickness ...) are typical examples. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { niceControls } from "./view3d.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f = (v, d = 1) => (Number.isFinite(v) ? (Math.round(v * 10 ** d) / 10 ** d).toLocaleString("en-US", { maximumFractionDigits: d }) : "–");
const RODS = { 25: 12, 32: 18, 40: 22, 50: 28, 63: 36, 80: 45, 100: 56, 125: 70, 160: 90, 200: 110 };
const H0 = 1050;                    // receiver top = pallet bottom height above the floor (mm)

/* ------------------------------------------------------------------ geometry (all in mm) */
function dims(P, R) {
  const a = P.a, b = P.b, r = P.r;
  const D = R.D || 63, rod = RODS[D] || Math.round(D * 0.56);
  const tp = Math.max(50, Math.round(Math.min(a, b) * 0.14));       // pallet thickness
  const yArmTop = H0 - 5, yArmBot = yArmTop - P.secH;
  const yBearTop = yArmBot - 120, yBearBot = yBearTop - 70, yc = yBearBot;  // carriage plate top
  const S = Math.round(P.dm + 260);                                    // carriage plate size
  const yt = yc - 40 - 120;                                            // base top plate (top)
  const barrel = P.s + 140;
  const Rg = P.dm / 2 + 50, m = 4, zp = 15, zr = Math.round(2 * Rg / m), Rp = zp * m / 2;
  const Rb = Math.max(150, Math.min(a * 0.55, r - P.dm / 2 - 70));    // B-axis table radius
  const dmod = Math.max(70, Math.min(110, (Math.min(a, b) - P.pitch) + 40));
  const swing = R.swing || (2 * r + Math.hypot(a, b));
  const wallW = swing - 40, wallH = 950;                              // the wall must close the opening of the swing circle
  return { a, b, r, D, rod, tp, yArmTop, yArmBot, yBearTop, yBearBot, yc, S, yt, barrel, Rg, m, zp, zr, Rp, wallW, wallH, Rb, dmod, swing,
           iPlan: P.i / (zr / zp), height: yArmTop + wallH, zH: -(swing / 2 + 450) };
}

function accuSize(P, R) {          // bladder accumulator for one lift stroke (isothermal): V0 = dV / (p0/p1 - p0/p2)
  const dV = (R.A || 3117) * P.s / 1e6, p1 = P.p, p2 = P.p * 1.25, p0 = 0.9 * p1;
  const V0 = dV / (p0 / p1 - p0 / p2), std = [0.7, 1.4, 2.5, 4, 6, 10].find((x) => x >= V0) || 10;
  return { dV, V0, std, p0 };
}

/* ------------------------------------------------------------------ part information (click a part) */
function partInfo(key, P, R, d) {
  const sv = R.servo;
  const accu = accuSize(P, R);
  const I = {
    pallet: ["Pallet", "MAKE", "GGG-60 nodular cast iron or C45 steel, stress relieved",
      "Carries the fixture and the parts from the load station into the machine and back.",
      `${d.a} × ${d.b} × ${d.tp} mm, ${P.mp} kg, ${P.nmod} pull studs on pitch ${P.pitch} mm, lifting ledges on 2 sides.`,
      "Grind top and bottom face: flatness ≤ 0.01 mm, parallel ≤ 0.01 mm. Jig-bore the pull-stud holes on pitch ±0.005 mm. Grid of M16 tapped holes or T-slots 18H8 on top. Mark the pallet number (RFID tag pocket)."],
    ledge: ["Lifting ledge on the pallet", "MAKE", "42CrMo4, induction hardened 52–56 HRC, screwed + pinned",
      "The fork rails of the arm lift the pallet under these ledges.",
      "2 per pallet, 25 mm wide, full pallet length.", "Hardened wear surface, replaceable. Same height on both sides ±0.02 mm."],
    stud: ["Pull stud (clamping pin)", "BUY", "case-hardened steel 58 HRC (from the module supplier)",
      "The zero-point module grips this pin and pulls the pallet down onto the reference face.",
      `${P.nmod} per pallet, pitch ${P.pitch} mm.`, "Screw in with the torque from the catalogue, use thread locker. One pin is the reference (fit), the others have a radial play to avoid over-determination."],
    fixture: ["Tombstone fixture with crankcases", "MAKE", "GG25 cast tombstone + hydraulic workholding",
      "Holds the workpieces on 2–4 faces, so one pallet carries several crankcases.",
      `Load per pallet ${P.mw} kg (fixture + parts), centre ${P.hc} mm above the pallet.`, "Not part of the APC – but its mass and height decide the APC size (inertia, tilting moment)."],
    module: ["Zero-point clamping module", "BUY", "hardened steel housing, spring package, ball / slide lock",
      "Clamps the pallet with spring force and positions it with taper + face contact (repeatability ≈ 0.002–0.005 mm). Oil pressure opens it.",
      `${P.nmod} modules, pull-in ${P.fmod} kN each, release ${P.prel} MPa, air seating check. Clamping used: slip ${f(R.slip * 100, 0)} %, tilt ${f(R.tilt * 100, 0)} %.`,
      "Bore in the receiver plate H7, depth and face from the catalogue. Seal the oil and air channels with O-rings. The modules stay CLAMPED when the oil pressure is lost (fail-safe)."],
    receiver: ["Receiver plate on the B-axis table", "MAKE", "S355 or GG25, stress relieved",
      "Carries the zero-point modules; oil (release) and air (seating check) channels are drilled inside.",
      `${d.a - 40} × ${d.b - 40} × 40 mm, ${P.nmod} module bores on pitch ${P.pitch} mm.`, "Grind the top face after mounting on the table (flatness ≤ 0.005 mm). Drill channels, close with plugs; pressure test at 1.5 × p."],
    btable: ["B-axis rotary table (machine)", "MACHINE", "part of the HMC",
      "Indexes / rotates the pallet in the machine (0.001° NC axis). For the change it goes to B = 0°.", `Table Ø ${f(2 * d.Rb, 0)} mm in this model.`, "Existing machine part – the APC must fit to its height and change position."],
    union: ["Rotary union (oil + air)", "BUY", "steel / bronze, 2 passages",
      "Brings oil (module release) and air (seating check) into the turning B-axis table.", "2 passages: oil 10 MPa, air 0.6 MPa.", "Mount below the table centre, flexible hoses to the fixed pipes."],
    arm: ["APC arm (main beam)", "MAKE", "S355J2 welded box, stress-relief annealed",
      "Connects the hub with the two cross beams and carries both pallets.",
      `Box ${P.secH} × ${P.secB} × ${P.secT} mm; bending stress ${f(R.sig, 0)} N/mm², deflection ${f(R.def, 3)} mm.`,
      "Weld, anneal (580–620 °C), then machine all interfaces (hub flange, cross-beam faces) in ONE setup so both ends are at the same height ±0.05 mm."],
    cross: ["Cross beam", "MAKE", "S355, welded to the arm", "Carries the two fork rails at each arm end.", `Length ${d.b + 110} mm.`, "Machined together with the arm (same setup)."],
    fork: ["Fork rail with hardened wear strip", "MAKE", "S355 rail + 90MnCrV8 strip 58 HRC",
      "Lifts the pallet under its ledges. The pallet hangs between the rails, so the receiver plate fits between them.",
      `Length ${d.a + 40} mm, ${P.s} mm lift stroke.`, "Shim plates under the wear strips to set all 4 rails to the same height (±0.02 mm). Lead-in chamfers."],
    wall: ["Partition wall (turns with the arm)", "MAKE", "2–3 mm stainless steel sheet on a steel frame, rubber wipers",
      "Separates the machine (chips, coolant) from the load station; it turns with the arm, so no extra door is needed at the APC.",
      `${f(d.wallW, 0)} × ${d.wallH} mm.`, "Wiper seals on all edges against the machine enclosure. Light: it is part of the rotating inertia."],
    hub: ["Hub", "MAKE", "42CrMo4 quenched + tempered", "Connects the bearing inner ring with the arm, transmits the turning torque.",
      `Ø ${f(P.dm - 60, 0)} mm, torque ${f(R.Tl, 0)} N·m (×1.5 = ${f(R.Tl * 1.5, 0)} N·m).`, "Bolted to the bearing inner ring (bolt circle and bolt size from the bearing catalogue), centring fit H7/g6."],
    ring: ["Ring gear", "BUY", "42CrMo4, teeth induction hardened",
      "The pinion turns the rotor through this gear.",
      `module m ${d.m}, z = ${d.zr} teeth, pitch Ø ${f(2 * d.Rg, 0)} mm, face 40 mm. Ratio to the pinion ${d.zr}:${d.zp} = ${f(d.zr / d.zp, 2)}.`,
      "Set the backlash with an eccentric pinion mount (0.05–0.1 mm). Grease lubrication."],
    pinion: ["Pinion", "BUY", "16MnCr5 case hardened", "Drives the ring gear.",
      `m ${d.m}, z = ${d.zp}, face ${40 + 20} mm.`, "Wider than the ring gear so the mesh is safe; mounted on the gearbox output shaft (shrink disc)."],
    gearbox: ["Planetary gearbox", "BUY", "precision planetary gearbox",
      "Reduces the servo speed and increases the torque.",
      `i ≈ ${f(d.iPlan, 1)} (total i = ${P.i} = ${f(d.iPlan, 1)} × ${f(d.zr / d.zp, 2)} ring/pinion), backlash ≤ ${P.backlash} arcmin.`, "Flange mount on the carriage with an eccentric ring to set the gear backlash."],
    servo: ["Servo motor + brake", "BUY", "AC servo, absolute encoder, holding brake",
      "Turns the arm 180° with the motion profile; the drive has STO (safe torque off).",
      sv ? `${sv.kw} kW class, Tmax ${sv.tmax} N·m, needs ${f(sv.need, 1)} N·m at ${f(R.nm, 0)} rpm, inertia ratio ${f(sv.ratio, 1)}:1.` : "no servo found – change the inputs.",
      "Drive on PROFINET (PROFIdrive positioning), STO wired to the safety PLC."],
    bearing: ["Slewing bearing (crossed roller)", "BUY", "crossed roller bearing, mounting holes in both rings",
      "Carries the rotor: axial load and the tilting moment when one pallet is full and the other empty.",
      `Fa = ${f(R.FaB / 1000, 1)} kN, Mk = ${f(R.Mk / 1000, 2)} kN·m → static rating M0 ≥ ${f(2 * R.Mk / 1000, 2)} kN·m, mean Ø ${P.dm} mm.`,
      "Mounting faces flat ≤ 0.02 mm, tighten the bolts crosswise with a torque wrench. Grease nipple reachable."],
    carriage: ["Lift carriage", "MAKE", "S355 thick plate or GG25 casting",
      "Is lifted by the cylinder along the 4 guide columns; it carries the bearing, gearbox and servo, so the gear mesh does not change during the lift.",
      `${d.S} × ${d.S} × 40 mm, stroke ${P.s} mm.`, "Bore the 4 bushing holes in one setup (position ±0.02 mm, parallel to each other)."],
    column: ["Guide column", "BUY", "induction-hardened, ground Ø50 h6 shafts + ball bushings",
      "Guide the carriage up and down and take the side forces, so the cylinder only pushes.", "4 columns Ø50 mm.", "Pressed into the base top plate; check parallelism ≤ 0.02 mm over the stroke."],
    bush: ["Linear ball bushing", "BUY", "flanged linear ball bushing", "Low-friction guiding of the carriage.", "4 pieces, for Ø50 shafts.", "With wipers against dust."],
    cylinder: ["Lift cylinder (hydraulic, double acting)", "BUY", "ISO 6020/6022 cylinder, flange mount",
      "Lifts the carriage with the rotor and both pallets.",
      `Ø ${d.D} / ${d.rod} mm, stroke ${P.s} mm, ${P.p} MPa → ${f(R.Fact / 1000, 1)} kN (needs ${f(R.Freq / 1000, 1)} kN), end cushioning both sides.`,
      "Flange on the base top plate; rod end with a self-aligning coupling to the carriage (no side load on the rod)."],
    base: ["Base frame", "MAKE", "S355 square tube 80×80×5 welded, top plate 30 mm",
      "Carries everything; anchored to the floor next to the machine.", `Footprint ${d.S} × ${d.S} mm, height ${f(d.yt, 0)} mm.`,
      "Weld, anneal, machine the top plate (column holes, cylinder flange). Leveling feet + chemical anchors M16; align to the machine change position ±0.1 mm."],
    station: ["Load station stand", "MAKE", "S355 welded stand",
      "Holds the waiting pallet at the same height as in the machine; the operator loads parts here.", `Pallet height ${H0} mm above the floor (ergonomic: 900–1100 mm).`, "Anchor to the floor; the height must match the machine receiver ±0.2 mm (cones catch the rest)."],
    cone: ["Locating receiver (load station)", "MAKE / BUY", "case-hardened bush 16MnCr5, 58–62 HRC", "The pull studs drop into these bushes: the pallet is centred at the load station (no clamping). Their top face is at the pallet height, so the turning arm passes over them.", `${P.nmod} receivers on pitch ${P.pitch} mm, face at ${H0} mm.`, "1 round bore, 1 slot, 2 with clearance (not over-determined). Detailed design: Mechanical elements tab."],
    curtain: ["Safety light curtain (type 4)", "BUY", "type 4 safety light curtain, OSSD outputs",
      "Stops the APC if the operator reaches into the turning area.", `resolution ${P.dlc} mm, safety distance ≥ ${f(R.Sd, 0)} mm (ISO 13855).`, "Wire the OSSDs to the safety PLC (F-DI), test after installation."],
    panel: ["Operator panel at the load station", "MAKE / BUY", "steel housing, IP54",
      "'Pallet ready' button, E-stop, stack light.", "", "E-stop on the safety circuit (PL d)."],
    door: ["APC door (sliding shutter)", "MAKE", "sheet steel with seals, pneumatic or electric drive",
      "Closes the machine enclosure above the partition wall during machining.", "Opens upwards before the arm turns.", "Door switch with guard locking (ISO 14119)."],
    tank: ["Hydraulic tank", "BUY (HPU)", "steel tank with level / temperature switch",
      "Stores the oil; part of the hydraulic power unit (HPU).", `≈ ${f(Math.max(30, 4 * R.Q), 0)} L (3–5 × pump flow per minute), HLP 46 oil.`, "Breather filter, level gauge, drain plug, oil cooler if the duty is high."],
    pump: ["Motor + pump", "BUY (HPU)", "internal gear pump + IE3 motor",
      "Builds the pressure.", `${f(R.Q, 1)} L/min at ${P.p} MPa → ${f(R.Pp, 2)} kW (with the accumulator a smaller pump is enough).`, "Bell housing + flexible coupling; pressure relief valve set to p + 10 %."],
    accu: ["Bladder accumulator", "BUY (HPU)", "bladder accumulator with safety block",
      "Gives the oil for the fast lift and keeps pressure on the module release during the change.",
      `one lift ΔV = A·s = ${f(accu.dV, 3)} L; isothermal V0 = ΔV/(p0/p1 − p0/p2) = ${f(accu.V0, 2)} L → ${accu.std} L, gas pre-charge p0 = ${f(accu.p0, 1)} MPa.`,
      "Safety block with relief valve + drain valve (pressure equipment rules)."],
    manifold: ["Valve manifold (NG6 / CETOP 3)", "BUY / MAKE", "steel block with drilled channels",
      "Carries the solenoid valves; all valves in one place = short pipes, easy service.", "3 valve stations + pressure switches + test points.", "Pressure test 1.5 × p, mark every port (P, T, A, B)."],
    vlift: ["Valve 1V1: 4/3 solenoid valve – lift", "BUY", "NG6, closed centre, 24 V DC",
      "Up / down / hold the lift cylinder. With pilot-operated check valves (1V2) the arm cannot sink, and meter-out throttles (1V3) set the speed.", `flow ${f(R.Q, 1)} L/min.`, "Manual override for service."],
    vclamp: ["Valve 2V1: 3/2 solenoid valve – module release", "BUY", "NG6 3/2 or 4/2 with plugged port, 24 V DC",
      "Energized: oil to the zero-point modules (open). Not energized: oil to tank, the springs clamp.", `${P.prel} MPa release pressure.`, "Pressure switch 2S1 after the valve confirms 'unclamped'."],
    vair: ["Valve 3V1: pneumatic 3/2 – seating check", "BUY", "3/2 solenoid valve + FRL unit",
      "Blows air through the nozzles in the receiver; if the pallet lies flat the air is blocked and pressure switch 3S1 switches.", "0.3–0.6 MPa, gap < 0.02 mm.", "Clean, dry air (filter 5 µm)."],
    filter: ["Return filter", "BUY (HPU)", "10 µm, with clogging indicator", "Keeps the oil clean (zero-point modules and valves are sensitive).", "", "Change the element when the indicator shows."],
    gauge: ["Pressure gauge + test point", "BUY", "glycerin gauge 0–10 MPa", "Shows the system pressure.", `${P.p} MPa set pressure.`, ""],
    pswitch: ["Pressure switch", "BUY", "electronic pressure switch, IO-Link", "Confirms 'unclamped' / 'clamped' to the PLC.", "", "Switch points set in the PLC (IO-Link)."],
    prox: ["Inductive proximity sensor M12", "BUY", "PNP, IO-Link", "Arm up / down, arm 0° / 180°: each sequence step waits for one of these.", "", "Adjustable bracket, switching distance 4 mm."],
    pipe: ["Hydraulic / air pipe", "MAKE", "precision steel tube 12×1.5 (E235+N) or 2SN hose; air: PU tube 8 mm",
      "Connects the HPU with the lift cylinder and (through the rotary union) with the zero-point modules.", "Red = pressure, blue = back to tank, cyan = air.", "Clamp every 1 m, flush the pipes before start-up."],
    guard: ["Guard / enclosure", "MAKE", "sheet steel + polycarbonate windows", "Keeps people out of the turning area and chips / coolant inside the machine.", `outside the swing circle Ø ${f(d.swing, 0)} mm.`, "Fixed guards need tools to open (ISO 14120)."],
    machine: ["Machining center (HMC)", "MACHINE", "", "Column, spindle head and B-axis table of the horizontal machining center.", "", "The APC is placed at the machine change position."],
  };
  return I[key] || [key, "", "", "", "", ""];
}

/* ------------------------------------------------------------------ 3D */
function create3D(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.localClippingEnabled = true;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 10, 40000);
  const controls = new OrbitControls(camera, renderer.domElement);
  const nice = niceControls(controls, camera, scene);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5a5a5a, 1.3));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(3000, 5000, 3500); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-3000, 2000, -2500); scene.add(fill);
  const root = new THREE.Group(); scene.add(root);
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  let M = {}, sel = null, selBox = null, labels = [], explode = 0, explodeTarget = 0, onPick = null;
  const cs = getComputedStyle(document.documentElement);
  scene.background = new THREE.Color((cs.getPropertyValue("--surface-2") || "#f2f1ed").trim() || "#f2f1ed");

  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, metalness: o.m ?? 0.35, roughness: o.r ?? 0.55, transparent: !!o.op, opacity: o.op ?? 1, side: o.ds ? THREE.DoubleSide : THREE.FrontSide, depthWrite: o.op ? false : true });
  const C = {
    steel: mat(0x9aa4ae, { m: 0.6, r: 0.35 }), ground: mat(0xc9d0d6, { m: 0.65, r: 0.28 }), frame: mat(0x3c6e9e), arm: mat(0xe1a32a, { m: 0.25, r: 0.5 }),
    wall: mat(0xb9c2ca, { m: 0.3, r: 0.4, op: 0.38, ds: true }), dark: mat(0x3a4048, { m: 0.5, r: 0.5 }), machine: mat(0x5b6670), cast: mat(0x67717b, { m: 0.2, r: 0.8 }),
    part: mat(0x8d99a5, { m: 0.4, r: 0.5 }), black: mat(0x23262a), yellow: mat(0xf2c200), red: mat(0xd03b3b), green: mat(0x2fa84f),
    hpu: mat(0x2f5f8f), motor: mat(0x51606f), brass: mat(0xc49a3c, { m: 0.7, r: 0.3 }), glass: mat(0xbcd4e6, { op: 0.16, ds: true, m: 0, r: 0.2 }),
    fence: mat(0xd9a400, { op: 0.12, ds: true, m: 0, r: 0.6 }), floor: mat(0xd8d6cf, { m: 0, r: 0.95 }), mod: mat(0x707a84, { m: 0.6, r: 0.35 }),
  };
  const modOn = mat(0xd03b3b, { m: 0.2, r: 0.4 }), modOff = mat(0x2fa84f, { m: 0.2, r: 0.4 });
  modOn.emissive = new THREE.Color(0x601010); modOff.emissive = new THREE.Color(0x0a3a16);

  // flow texture for pipes
  const stripe = (() => { const c = document.createElement("canvas"); c.width = 64; c.height = 4; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 64, 4); g.fillStyle = "#777"; g.fillRect(0, 0, 22, 4); return c; })();
  const PIPE = { p: 0xe0342f, hold: 0x8a1e1a, t: 0x2a6fd6, air: 0x19a7c8, off: 0x8d949b };

  const tag = (o, part) => { o.traverse((c) => { if (c.isMesh) c.userData.part = part; }); return o; };
  function box(w, h, dd, m, x, y, z, part, parent) {
    const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), m); me.position.set(x, y, z); me.userData.part = part; (parent || root).add(me); return me;
  }
  function cyl(r, h, m, x, y, z, part, parent, axis = "y", seg = 32, r2) {
    const g = new THREE.CylinderGeometry(r2 ?? r, r, h, seg);
    if (axis === "x") g.rotateZ(Math.PI / 2); else if (axis === "z") g.rotateX(Math.PI / 2);
    const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.userData.part = part; (parent || root).add(me); return me;
  }
  function ring(rIn, rOut, h, m, y, part, parent, seg = 64) {
    const pts = [new THREE.Vector2(rIn, 0), new THREE.Vector2(rOut, 0), new THREE.Vector2(rOut, h), new THREE.Vector2(rIn, h), new THREE.Vector2(rIn, 0)];
    const me = new THREE.Mesh(new THREE.LatheGeometry(pts, seg), m); me.position.y = y; me.userData.part = part; (parent || root).add(me); return me;
  }
  function pipe(pts, radius, kind) {
    const curve = new THREE.CurvePath();
    for (let i = 0; i < pts.length - 1; i++) curve.add(new THREE.LineCurve3(new THREE.Vector3(...pts[i]), new THREE.Vector3(...pts[i + 1])));
    let len = 0; for (let i = 0; i < pts.length - 1; i++) len += new THREE.Vector3(...pts[i]).distanceTo(new THREE.Vector3(...pts[i + 1]));
    const tex = new THREE.CanvasTexture(stripe); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(len / 90, 1);
    const m = new THREE.MeshStandardMaterial({ color: PIPE.off, map: tex, metalness: 0.3, roughness: 0.45 });
    const me = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, pts.length * 12), radius, 10, false), m);
    me.userData.part = "pipe"; me.userData.kind = kind; root.add(me);
    return { mesh: me, tex, m, state: "off" };
  }
  // label sprite (constant screen size) with a leader line from the part (anchor) to the label
  function label(text, anchor, off = [0, 0, 0], parent = root) {
    const c = document.createElement("canvas"), g = c.getContext("2d"); g.font = "600 30px system-ui, sans-serif";
    const w = Math.ceil(g.measureText(text).width) + 24; c.width = w; c.height = 46;
    g.font = "600 30px system-ui, sans-serif"; g.fillStyle = "rgba(255,255,255,.93)"; g.strokeStyle = "rgba(0,0,0,.3)";
    g.beginPath(); g.roundRect(1, 1, w - 2, 44, 10); g.fill(); g.stroke(); g.fillStyle = "#1b1f24"; g.fillText(text, 12, 33);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, sizeAttenuation: false }));
    const pos = [anchor[0] + off[0], anchor[1] + off[1], anchor[2] + off[2]];
    sp.scale.set(0.034 * w / 46, 0.034, 1); sp.position.set(...pos); sp.renderOrder = 20; parent.add(sp); labels.push(sp);
    if (off.some((v) => v)) {
      const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...anchor), new THREE.Vector3(...pos)]);
      const ln = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x30363d, depthTest: false, transparent: true, opacity: 0.8 }));
      ln.renderOrder = 19; parent.add(ln); labels.push(ln);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(9, 10, 8), new THREE.MeshBasicMaterial({ color: 0x30363d, depthTest: false }));
      dot.position.set(...anchor); dot.renderOrder = 19; parent.add(dot); labels.push(dot);
    }
    return sp;
  }


  function build(P, R) {
    while (root.children.length) { const o = root.children.pop(); o.traverse((c) => { if (c.geometry) c.geometry.dispose(); if (c.material && c.material.map && c.material.map.isCanvasTexture) c.material.map.dispose(); }); }
    labels = []; M = { pipes: {}, mods: [], ex: [] }; sel = null; if (selBox) { scene.remove(selBox); selBox = null; }
    const d = dims(P, R); M.d = d;
    const { a, b, r } = d;
    // floor
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(9000, 7000), C.floor); fl.rotation.x = -Math.PI / 2; fl.position.set(-400, 0, -400); fl.userData.part = null; root.add(fl);

    // ---------------- base frame (static)
    const base = new THREE.Group(); root.add(base); M.base = base;
    const pw = d.S / 2 - 50;
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      box(80, d.yt - 30, 80, C.frame, sx * pw, (d.yt - 30) / 2, sz * pw, "base", base);
      box(160, 15, 160, C.dark, sx * pw, 8, sz * pw, "base", base);
    }
    for (const y of [180, d.yt - 120]) {
      box(2 * pw, 60, 60, C.frame, 0, y, pw, "base", base); box(2 * pw, 60, 60, C.frame, 0, y, -pw, "base", base);
      box(60, 60, 2 * pw, C.frame, pw, y, 0, "base", base); box(60, 60, 2 * pw, C.frame, -pw, y, 0, "base", base);
    }
    box(d.S, 30, d.S, C.frame, 0, d.yt - 15, 0, "base", base);
    // guide columns + cylinder (static)
    const cp = d.S / 2 - 40;
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) cyl(25, d.yc + 220 - d.yt, C.ground, sx * cp, (d.yt + d.yc + 220) / 2, sz * cp, "column", base);
    const barrel = cyl(d.D / 2 + 14, d.barrel, C.hpu, 0, d.yt - 30 - d.barrel / 2, 0, "cylinder", base);
    cyl(d.D / 2 + 34, 28, C.dark, 0, d.yt - 44, 0, "cylinder", base);
    cyl(d.D / 2 + 22, 30, C.dark, 0, d.yt - 30 - d.barrel + 15, 0, "cylinder", base);
    M.ex.push({ o: barrel, v: [0, -260, 0] });
    // proximity sensors on a column bracket
    const sxp = cp + 45;
    for (const yy of [d.yc - 20, d.yc - 20 + P.s]) cyl(9, 50, C.yellow, sxp, yy, cp, "prox", base, "x", 16);

    // ---------------- lift carriage (moves up)
    const car = new THREE.Group(); root.add(car); M.car = car;
    box(d.S, 40, d.S, C.cast, 0, d.yc - 20, 0, "carriage", car);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) cyl(42, 90, C.dark, sx * cp, d.yc - 20, sz * cp, "bush", car);
    box(30, 12, 50, C.steel, sxp - 30, d.yc - 20, cp, "prox", car);     // switching flag
    const rod = cyl(d.rod / 2, (d.yc - 40) - (d.yt - 30) + 60, C.ground, 0, ((d.yc - 40) + (d.yt - 90)) / 2, 0, "cylinder", car);
    cyl(d.D / 2, 20, C.dark, 0, d.yt - 90, 0, "cylinder", car);            // piston (inside the barrel)
    ring(P.dm / 2 + 2, P.dm / 2 + 40, 70, C.steel, d.yBearBot, "bearing", car);
    // pinion + gearbox + servo (behind the bearing, -z)
    const zP = -(d.Rg + d.Rp);
    const drive = new THREE.Group(); car.add(drive); M.drive = drive;
    const pin = cyl(d.Rp, 60, C.steel, 0, d.yBearTop + 20, zP, "pinion", drive, "y", d.zp * 2);
    for (let k = 0; k < d.zp; k++) { const t = box(9, 60, 9, C.steel, 0, 0, 0, "pinion", pin); const an = k / d.zp * Math.PI * 2; t.position.set(Math.cos(an) * d.Rp, 0, Math.sin(an) * d.Rp); t.rotation.y = -an; }
    // right-angle planetary gearbox under the plate + horizontal servo (fits above the base top plate at the lowest position)
    cyl(22, d.yBearTop - d.yc, C.steel, 0, (d.yc + d.yBearTop) / 2, zP, "gearbox", drive);
    cyl(52, 110, C.dark, 0, d.yc - 95, zP, "gearbox", drive);
    box(110, 100, 110, C.dark, 0, d.yc - 95, zP - 60, "gearbox", drive);
    box(118, 110, 240, C.black, 0, d.yc - 95, zP - 235, "servo", drive);
    cyl(18, 50, C.black, 0, d.yc - 30, zP - 300, "servo", drive);
    M.ex.push({ o: drive, v: [0, 0, -280] });

    // ---------------- rotor (turns, inside the carriage)
    const rot = new THREE.Group(); car.add(rot); M.rot = rot;
    const rin = new THREE.Group(); rot.add(rin); M.rin = rin;
    ring(P.dm / 2 - 50, P.dm / 2, 70, C.ground, d.yBearBot, "bearing", rin);
    const rg = ring(d.Rg - 20, d.Rg - 4, 40, C.steel, d.yBearTop, "ring", rin, 96);
    const nT = Math.min(d.zr, 140);
    for (let k = 0; k < nT; k++) { const an = k / nT * Math.PI * 2, t = box(10, 40, 8, C.steel, Math.cos(an) * (d.Rg - 1), d.yBearTop + 20, Math.sin(an) * (d.Rg - 1), "ring", rin); t.rotation.y = -an; }
    cyl(P.dm / 2 - 30, d.yArmBot - d.yBearTop, C.steel, 0, (d.yArmBot + d.yBearTop) / 2, 0, "hub", rin);
    cyl(9, 30, C.red, d.Rg - 10, d.yBearTop + 55, 0, "prox", rin, "y", 12);      // cam for 0° / 180° sensors
    // arm, cross beams, fork rails
    const xin = r - a / 2 - 40;              // inner edge of the fork area
    box(2 * (xin - 50), P.secH, P.secB, C.arm, 0, d.yArmTop - P.secH / 2, 0, "arm", rin);
    const railZ = b / 2 + 12;
    for (const sx of [1, -1]) {
      box(100, 45, b + 110, C.arm, sx * (xin - 50), d.yArmTop - 22.5, 0, "cross", rin);   // flat (45 mm): passes over the station receivers when the arm turns
      for (const sz of [1, -1]) {
        box(a + 40, 45, 45, C.arm, sx * (xin - 50 + (a + 40) / 2 + 50), d.yArmTop - 22.5, sz * railZ, "fork", rin);
        box(a + 20, 6, 30, C.ground, sx * (xin - 50 + (a + 40) / 2 + 50), d.yArmTop + 3, sz * (railZ - 5), "fork", rin);
      }
    }
    // partition wall
    box(14, d.wallH, d.wallW, C.wall, 0, d.yArmTop + d.wallH / 2, 0, "wall", rin);
    box(40, 40, d.wallW, C.arm, 0, d.yArmTop + 20, 0, "wall", rin);
    box(40, 30, d.wallW, C.arm, 0, d.yArmTop + d.wallH - 15, 0, "wall", rin);
    for (const sz of [1, -1]) box(40, d.wallH, 30, C.arm, 0, d.yArmTop + d.wallH / 2, sz * (d.wallW / 2 - 15), "wall", rin);
    M.ex.push({ o: rin, v: [0, 520, 0] });

    // pallets with ledges, pull studs and fixtures
    M.pal = [];
    for (const [sx, name, col] of [[-1, "A", 0x2a78d6], [1, "B", 0xc98a0c]]) {
      const g = new THREE.Group(); rin.add(g);
      const cx = sx * r;
      box(a, d.tp, b, C.ground, cx, H0 + d.tp / 2, 0, "pallet", g);
      for (let k = -2; k <= 2; k++) box(a - 30, 3, 18, C.dark, cx, H0 + d.tp + 1, k * b / 6, "pallet", g);   // T-slots
      for (const sz of [1, -1]) box(a, 20, 25, C.steel, cx, H0 + 10, sz * (b / 2 + 12.5), "ledge", g);
      for (const [i, j] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        cyl(16, 34, C.brass, cx + i * P.pitch / 2, H0 - 17, j * P.pitch / 2, "stud", g, "y", 16);
        cyl(11, 10, C.brass, cx + i * P.pitch / 2, H0 - 39, j * P.pitch / 2, "stud", g, "y", 16);
      }
      // tombstone with 4 crankcases (2 faces)
      const th = Math.min(700, Math.max(300, P.hc * 2.2)), tw = Math.min(a, b) * 0.6;
      box(tw * 0.55, th, tw, C.cast, cx, H0 + d.tp + th / 2, 0, "fixture", g);
      const pm = new THREE.MeshStandardMaterial({ color: col, metalness: 0.4, roughness: 0.5 });
      for (const sxx of [1, -1]) for (const yy of [0.27, 0.73]) box(tw * 0.3, th * 0.36, tw * 0.75, pm, cx + sxx * tw * 0.42, H0 + d.tp + th * yy, 0, "fixture", g);
      M.pal.push({ g, name });
      M.ex.push({ o: g, v: [0, 450, 0] });
      label(`Pallet ${name}`, [cx, H0 + d.tp + th, 0], [0, 140, 0], g);
    }

    // ---------------- machine side
    const mx = -r;
    const recv = box(a - 40, 40, b - 40, C.steel, mx, H0 - 20, 0, "receiver", root);
    M.ex.push({ o: recv, v: [0, 130, 0] });
    for (const [i, j] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const g = new THREE.Group(); root.add(g);
      cyl(d.dmod / 2, 90, C.mod, mx + i * P.pitch / 2, H0 - 45, j * P.pitch / 2, "module", g);
      const top = ring(d.dmod / 2 - 18, d.dmod / 2 - 4, 3, modOn, H0 + 0.5, "module", g, 32); top.position.x = mx + i * P.pitch / 2; top.position.z = j * P.pitch / 2;
      cyl(14, 4, C.black, mx + i * P.pitch / 2, H0 + 1, j * P.pitch / 2, "module", g, "y", 16);
      M.mods.push(top);
      M.ex.push({ o: g, v: [0, 260, 0] });
      cyl(4, 3, C.black, mx + i * P.pitch / 4, H0 + 1, j * P.pitch / 4, "receiver", root, "y", 10);    // air nozzle
    }
    cyl(d.Rb, 180, C.machine, mx, H0 - 40 - 90, 0, "btable", root, "y", 64);
    ring(d.Rb, d.Rb + 6, 14, C.steel, H0 - 60, "btable", root);
    cyl(45, 90, C.brass, mx, H0 - 220 - 45, 0, "union", root);
    box(300, H0 - 220 - 300, 700, C.machine, mx, 300 + (H0 - 520) / 2, 0, "machine", root);
    box(1050, 300, 1200, C.machine, mx - 375, 150, 0, "machine", root);
    box(400, 2200, 700, C.machine, mx - 700, 300 + 1100, 0, "machine", root);
    box(260, 420, 440, C.dark, mx - 560, 1500, 0, "machine", root);
    cyl(70, 110, C.steel, mx - 375, 1500, 0, "machine", root, "x");
    cyl(28, 120, C.ground, mx - 260, 1500, 0, "machine", root, "x");
    label("Machine (HMC)", [mx - 700, 2500, 0], [0, 160, 0]);
    label("B-axis table + zero-point modules", [mx, H0 - 40, d.Rb * 0.7], [-500, -650, 900]);

    // ---------------- load station
    const lx = r;
    box(a - 40, 30, b - 40, C.steel, lx, H0 - 15, 0, "station", root);
    for (const [i, j] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      { cyl(28, 30, C.ground, lx + i * P.pitch / 2, H0 - 15, j * P.pitch / 2, "cone", root, "y", 20); cyl(17, 31, C.black, lx + i * P.pitch / 2, H0 - 15, j * P.pitch / 2, "cone", root, "y", 14); }
      box(70, H0 - 30, 70, C.frame, lx + i * (a / 2 - 80), (H0 - 30) / 2, j * (b / 2 - 80), "station", root);
    }
    box(a - 160, 50, 50, C.frame, lx, 200, b / 2 - 80, "station", root); box(a - 160, 50, 50, C.frame, lx, 200, -(b / 2 - 80), "station", root);
    const lcx = lx + a / 2 + 160, lcz = b / 2 + 260;
    const cur = new THREE.Group(); root.add(cur); M.curtain = cur;
    for (const sz of [1, -1]) box(45, 1600, 45, C.yellow, lcx, 800, sz * lcz, "curtain", cur);
    const beamPts = [];
    for (let y = 250; y <= 1550; y += 65) beamPts.push(lcx, y, -lcz, lcx, y, lcz);
    const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(beamPts, 3));
    cur.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.35 })));
    box(50, 1250, 50, C.dark, lx + a / 2 + 320, 625, b / 2 + 420, "panel", root);
    box(300, 200, 110, C.dark, lx + a / 2 + 320, 1330, b / 2 + 420, "panel", root);
    cyl(22, 30, C.red, lx + a / 2 + 250, 1330, b / 2 + 480, "panel", root, "z");
    cyl(16, 20, C.green, lx + a / 2 + 390, 1330, b / 2 + 480, "panel", root, "z");
    label("Load station (locating cones)", [lx, H0 - 30, b / 2 - 80], [1000, -350, 450]);
    label("Light curtain", [lcx, 1600, lcz], [0, 160, 0], cur);

    // ---------------- guards: machine enclosure (glass) with door, fence around the load station
    const gd = new THREE.Group(); root.add(gd); M.guards = gd;
    const encZ = Math.max(d.wallW / 2 + 260, 700);
    box(12, 2400, encZ - d.wallW / 2 - 10, C.glass, -30, 1200, (encZ + d.wallW / 2 + 10) / 2, "guard", gd);
    box(12, 2400, encZ - d.wallW / 2 - 10, C.glass, -30, 1200, -(encZ + d.wallW / 2 + 10) / 2, "guard", gd);
    box(12, 2400 - (d.yArmTop + d.wallH) - 20, d.wallW + 20, C.glass, -30, (2400 + d.yArmTop + d.wallH + 20) / 2, 0, "guard", gd);
    for (const sz of [1, -1]) box(r + 1300, 2400, 12, C.glass, -(r + 1300) / 2 - 30, 1200, sz * encZ, "guard", gd);
    const fz = Math.max(d.swing / 2 + 120, lcz + 60);
    for (const sz of [1, -1]) box(r + a / 2 + 400, 1800, 10, C.fence, (r + a / 2 + 400) / 2 + 30, 900, sz * fz, "guard", gd);
    M.door = box(12, d.wallH + 20, d.wallW + 10, C.wall, -55, d.yArmTop + d.wallH / 2, 0, "door", root);

    // ---------------- hydraulic power unit (behind, -z)
    const zH = d.zH, hx = 450;
    box(700, 450, 450, C.hpu, hx, 225, zH, "tank", root);
    box(720, 12, 470, C.dark, hx, 456, zH, "tank", root);
    cyl(105, 300, C.motor, hx - 130, 575, zH - 60, "pump", root, "x");
    cyl(80, 90, C.dark, hx + 65, 575, zH - 60, "pump", root, "x");
    cyl(60, 140, C.hpu, hx + 180, 575, zH - 60, "pump", root, "x");
    const acc = new THREE.Group(); root.add(acc);
    cyl(85, 420, C.red, hx + 470, 330, zH, "accu", acc); const sph = new THREE.Mesh(new THREE.SphereGeometry(85, 24, 12), C.red); sph.position.set(hx + 470, 540, zH); sph.userData.part = "accu"; acc.add(sph);
    box(140, 100, 140, C.dark, hx + 470, 70, zH, "accu", acc);
    cyl(45, 170, C.dark, hx + 250, 545, zH + 120, "filter", root);
    const man = new THREE.Group(); root.add(man); M.man = man;
    box(360, 110, 130, C.steel, hx - 60, 515, zH + 150, "manifold", man);
    M.vl = box(210, 70, 70, C.black, hx - 140, 605, zH + 150, "vlift", man);
    M.vlc = [cyl(24, 60, C.yellow, hx - 275, 605, zH + 150, "vlift", man, "x"), cyl(24, 60, C.yellow, hx - 5, 605, zH + 150, "vlift", man, "x")];
    box(150, 70, 70, C.black, hx + 60, 605, zH + 150, "vclamp", man);
    M.vcc = cyl(24, 60, C.yellow, hx + 165, 605, zH + 150, "vclamp", man, "x");
    cyl(42, 16, C.ground, hx - 260, 500, zH + 222, "gauge", man, "z");
    cyl(12, 50, C.black, hx + 120, 520, zH + 225, "pswitch", man, "z", 12);
    M.ex.push({ o: man, v: [0, 220, 160] });
    // air service unit + valve
    box(60, 900, 60, C.dark, -300, 450, zH + 150, "vair", root);
    cyl(30, 110, C.glass, -300, 820, zH + 210, "vair", root); cyl(30, 110, C.glass, -230, 820, zH + 210, "vair", root);
    M.va = box(90, 60, 50, C.black, -300, 680, zH + 215, "vair", root);
    label(`Accumulator ${accuSize(P, R).std} L`, [hx + 470, 560, zH], [650, 120, 200]);
    label("Hydraulic power unit", [hx, 456, zH], [200, 900, -300]);
    label("Valve manifold 1V1 / 2V1", [hx - 60, 640, zH + 150], [700, 450, 100]);

    // ---------------- pipes (static): lift A (cap side), lift B (rod side), module release, seating air
    const yb0 = d.yt - 30 - d.barrel, zf = zH + 260;
    M.pipes.liftA = pipe([[hx - 200, 640, zH + 150], [hx - 200, 640, zf], [hx - 200, 40, zf], [60, 40, zf], [60, 40, -60], [60, yb0 + 40, -60], [d.D / 2 + 14, yb0 + 40, -20]], 9, "liftA");
    M.pipes.liftB = pipe([[hx - 80, 640, zH + 150], [hx - 80, 640, zf + 40], [hx - 80, 70, zf + 40], [100, 70, zf + 40], [100, 70, -100], [100, d.yt - 70, -100], [d.D / 2 + 14, d.yt - 70, -30]], 9, "liftB");
    M.pipes.clamp = pipe([[hx + 60, 640, zH + 150], [hx + 60, 640, zf + 80], [hx + 60, 40, zf + 80], [hx + 60, 40, -500], [mx + 60, 40, -500], [mx + 60, 40, -380], [mx + 60, H0 - 290, -380], [mx + 60, H0 - 290, 0], [mx + 45, H0 - 270, 0]], 9, "clamp");
    M.pipes.air = pipe([[-300, 680, zH + 240], [-300, 30, zH + 240], [-300, 30, -540], [mx - 60, 30, -540], [mx - 60, 30, -400], [mx - 60, H0 - 300, -400], [mx - 60, H0 - 300, 0], [mx - 45, H0 - 280, 0]], 6, "air");

    // labels on the APC
    label("Partition wall (turns)", [0, d.yArmTop + d.wallH, d.wallW * 0.3], [0, 150, 0], rin);
    label("APC arm + fork rails", [r * 0.55, d.yArmTop - 25, b / 2 + 12], [150, -250, 1100], rin);
    label("Slewing bearing + ring gear", [d.Rg, d.yBearTop + 20, 0], [1100, 250, 500], car);
    label("Servo + right-angle gearbox + pinion", [0, d.yc - 95, zP - 300], [-900, -500, -400], car);
    label("Lift carriage + 4 guide columns", [d.S / 2, d.yc - 20, d.S / 2], [1100, -150, 600], car);
    label(`Lift cylinder Ø${d.D}`, [d.D / 2 + 14, d.yt - 30 - d.barrel / 2, 0], [400, -650, 1100]);
    label("Base frame", [-pw, 200, pw], [-700, -250, 800]);

    fit("overview");
    setLabels($("apc3dLbl") ? $("apc3dLbl").checked : true);
    if (M.guards) M.guards.visible = $("apc3dGuard") ? $("apc3dGuard").checked : false;
    if (M.curtain) M.curtain.visible = M.guards.visible;
    return d;
  }

  const VIEWS = {
    overview: (d) => [[2500, 2300, 3500], [-100, 750, -150]],
    clamp: (d) => [[-d.r - 150, H0 + 950, 1150], [-d.r, H0 + 180, 0]],
    drive: (d) => [[1350, d.yc + 280, -950], [0, d.yc - 40, -180]],
    hpu: (d) => [[1800, 1500, d.zH + 1900], [250, 450, d.zH]],
    station: (d) => [[d.r + 2400, 1700, 1500], [d.r, H0, 0]],
  };
  function fit(v) {
    const d = M.d; if (!d) return;
    const [p, t] = VIEWS[v](d);
    nice.stop(); camera.position.set(...p); controls.target.set(...t); controls.update();
  }
  function setLabels(on) { labels.forEach((l) => { l.visible = on; }); }

  function setPipe(p, state, dir = 1) {
    p.state = state; p.dir = dir;
    p.m.color.setHex(PIPE[state]);
    p.m.emissive = new THREE.Color(state === "p" ? 0x400000 : state === "t" ? 0x001840 : state === "air" ? 0x003040 : 0x000000);
  }
  function update(s, P) {
    if (!M.car) return;
    const d = M.d, liftmm = s.lift * P.s;
    M.car.position.y = liftmm + explode * 120;
    M.rot.rotation.y = -s.ang;
    const palOff = Math.max(0, liftmm - 5) - liftmm;           // pallet stays on its place until the forks touch the ledges
    M.pal.forEach((p) => { p.g.userData.baseY = palOff; });
    M.door.position.y = d.yArmTop + d.wallH / 2 + s.door * (d.wallH + 80);
    M.mods.forEach((m) => { m.material = s.clamp > 0.5 ? modOn : modOff; });
    const k = s.k;
    setPipe(M.pipes.clamp, k === 1 ? "p" : k >= 2 && k <= 4 ? "hold" : k === 5 ? "t" : "off", k === 5 ? -1 : 1);
    setPipe(M.pipes.liftA, k === 2 ? "p" : k === 3 ? "hold" : k === 4 ? "t" : "off", k === 4 ? -1 : 1);
    setPipe(M.pipes.liftB, k === 4 ? "p" : k === 2 ? "t" : "off", k === 2 ? -1 : 1);
    setPipe(M.pipes.air, k === 6 ? "air" : "off");
    const on = (m, x) => { m.material = x ? C.red : C.yellow; };
    on(M.vlc[0], k === 2); on(M.vlc[1], k === 4); on(M.vcc, k >= 1 && k <= 4);
    applyExplode();
  }
  function applyExplode() {
    if (!M.ex) return;
    for (const e of M.ex) {
      if (!e.o.userData.home) e.o.userData.home = e.o.position.clone();
      const h = e.o.userData.home;
      e.o.position.set(h.x + e.v[0] * explode, h.y + e.v[1] * explode + (e.o.userData.baseY || 0), h.z + e.v[2] * explode);
    }
  }
  function frame(dt) {
    if (Math.abs(explode - explodeTarget) > 1e-3) {
      explode += (explodeTarget - explode) * Math.min(1, dt * 5);
      const A = window.APC && window.APC.get(); if (A) update(A.s, A.P);
    }
    for (const p of Object.values(M.pipes || {})) if (p.state === "p" || p.state === "t" || p.state === "air") p.tex.offset.x -= dt * 1.6 * (p.dir || 1);
    if (selBox) selBox.update();
    controls.update(); renderer.render(scene, camera);
  }
  // picking
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let down = null;
  renderer.domElement.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const rc = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(root.children, true).find((h) => h.object.isMesh && h.object.userData.part && h.object.visible &&
      (!renderer.clippingPlanes.length || h.point.z <= 0.5));
    if (selBox) { scene.remove(selBox); selBox = null; }
    if (!hit) { if (onPick) onPick(null); return; }
    sel = hit.object;
    selBox = new THREE.BoxHelper(sel.parent && sel.parent !== root && sel.parent.type === "Group" && sel.userData.part !== "pipe" ? sel.parent : sel, 0xff2a2a);
    scene.add(selBox);
    if (onPick) onPick(hit.object.userData.part);
  });

  return {
    build, update, fit, setLabels, frame,
    setExplode(on) { explodeTarget = on ? 1 : 0; },
    setCut(on) { renderer.clippingPlanes = on ? [clipPlane] : []; },
    setGuards(on) { if (M.guards) M.guards.visible = on; if (M.curtain) M.curtain.visible = on; },
    onPick(fn) { onPick = fn; },
    resize() { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); },
  };
}

/* ------------------------------------------------------------------ 2D: section through one zero-point module */
function sectionSVG(s, P) {
  const W = 640, H = 380, cx = 230;
  const c = s.clamp;                                   // 1 = clamped, 0 = open
  const pist = (1 - c) * 18;                           // piston moves up when oil comes in
  const ballX = 26 + (1 - c) * 12;                     // balls move out when the piston is up
  const lifted = s.k >= 2 && s.k <= 4;
  const palY = lifted ? -70 : -(1 - c) * 3;            // pallet lifted (APC) or pulled down (clamping)
  const away = s.k === 3;
  const oil = c < 0.99;
  const sp = (x0, y0, h, n) => { let d = `M${x0},${y0}`; for (let i = 0; i < n; i++) { const y = y0 + (h / n) * (i + 0.5), y2 = y0 + (h / n) * (i + 1); d += ` L${x0 + (i % 2 ? -9 : 9)},${y} L${x0},${y2}`; } return d; };
  const springH = 46 - pist * 0.9;
  let g = `<svg viewBox="0 0 ${W} ${H}" class="apc-svg sec" aria-label="Section through a zero-point clamping module">
    <defs><pattern id="hat" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#8a929a" stroke-width="2"/></pattern>
    <pattern id="hat2" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#6b8db0" stroke-width="2"/></pattern>
    <marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#d03b3b"/></marker>
    <marker id="arb" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#19a7c8"/></marker></defs>`;
  // receiver plate (machine table)
  g += `<rect x="40" y="150" width="380" height="200" fill="url(#hat)" stroke="#555"/>`;
  // module housing (pocket in the receiver)
  g += `<rect x="${cx - 120}" y="150" width="240" height="175" fill="#c9d0d6" stroke="#444"/>`;
  // oil chamber below the piston
  g += `<rect x="${cx - 100}" y="${290 - pist}" width="200" height="${22 + pist}" fill="${oil ? "#e0342f" : "#f4c7c4"}" opacity="${oil ? 0.85 : 0.5}"/>`;
  // piston (annular) with inner taper
  const py = 238 - pist;
  g += `<path d="M${cx - 100},${py} L${cx - 46},${py} L${cx - 34},${py + 52} L${cx - 100},${py + 52} Z" fill="url(#hat2)" stroke="#2f4f6f"/>
        <path d="M${cx + 100},${py} L${cx + 46},${py} L${cx + 34},${py + 52} L${cx + 100},${py + 52} Z" fill="url(#hat2)" stroke="#2f4f6f"/>`;
  // disc spring packs above the piston
  for (const x of [cx - 84, cx - 62, cx + 62, cx + 84]) g += `<path d="${sp(x, py - springH, springH, 6)}" fill="none" stroke="#2a2a2a" stroke-width="2"/>`;
  // cover (top face = reference face)
  g += `<rect x="${cx - 120}" y="150" width="240" height="${238 - 46 - 150}" fill="#aeb7bf" stroke="#444"/>`;
  g += `<rect x="${cx - 26}" y="150" width="52" height="175" fill="#f7f7f5"/>`;   // centre bore
  // pallet + pull stud
  const op = away ? 0.25 : 1;
  g += `<g transform="translate(0,${palY})" opacity="${op}">
    <rect x="40" y="70" width="380" height="76" fill="url(#hat)" stroke="#555"/><rect x="40" y="70" width="380" height="76" fill="#b8c0c8" opacity=".55"/>
    <rect x="${cx - 18}" y="146" width="36" height="58" fill="#c49a3c" stroke="#7a5d1e"/>
    <rect x="${cx - 13}" y="204" width="26" height="16" fill="#c49a3c" stroke="#7a5d1e"/>
    <rect x="${cx - 22}" y="220" width="44" height="18" rx="3" fill="#c49a3c" stroke="#7a5d1e"/></g>`;
  // locking balls
  for (const sx of [-1, 1]) g += `<circle cx="${cx + sx * ballX}" cy="${py + 6 + (lifted ? 0 : 0)}" r="9" fill="#555" stroke="#222"/>`;
  // seals
  for (const [x, y] of [[cx - 104, py + 20], [cx + 96, py + 20], [cx - 104, 296], [cx + 96, 296]]) g += `<rect x="${x}" y="${y}" width="8" height="8" fill="#111"/>`;
  // oil port + air nozzle
  g += `<path d="M420,${300} H${cx + 100}" stroke="${oil ? "#e0342f" : "#9aa"}" stroke-width="6"/>`;
  g += `<path d="M60,150 V128" stroke="#19a7c8" stroke-width="4"/>`;
  if (s.air) g += `<path d="M66,146 L66,128" stroke="#19a7c8" stroke-width="2" marker-end="url(#arb)"/><text x="72" y="124" class="apc-t" style="fill:#19a7c8">air: gap &lt; 0.02 mm?</text>`;
  if (c > 0.5 && !lifted) g += `<path d="M${cx},84 V128" stroke="#d03b3b" stroke-width="3" marker-end="url(#ar)"/><rect x="${cx + 8}" y="96" width="104" height="18" fill="#fff" opacity=".85"/><text x="${cx + 12}" y="109" class="apc-t" style="fill:#d03b3b;font-weight:700">pull-in ${P.fmod} kN</text>`;
  // labels
  const L = (x1, y1, x2, y2, t, anc = "start") => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#777"/><text x="${x2 + (anc === "end" ? -4 : 4)}" y="${y2 + 4}" class="apc-t" text-anchor="${anc}">${t}</text>`;
  g += L(380, 100 + palY, 440, 70, "Pallet");
  g += L(cx + 16, 175 + palY, 440, 104, "Pull stud");
  g += L(cx + ballX + 6, py + 6, 440, 150, "Locking balls");
  g += L(cx + 70, py + 40, 440, 196, "Piston with taper");
  g += L(cx + 84, py - springH / 2, 440, 236, "Disc springs (clamp)");
  g += L(cx + 60, 302, 440, 276, oil ? "Oil chamber: RELEASE" : "Oil chamber (0 bar)");
  g += L(400, 300, 440, 318, `Oil port ${P.prel} MPa`);
  g += L(80, 340, 440, 344, "Receiver plate (B-axis table)");
  g += `<text x="20" y="22" class="apc-t" style="font-weight:700;font-size:13px">${c > 0.5 ? (lifted ? "Pallet lifted" : "CLAMPED – springs pull the stud down") : "OPEN – oil lifts the piston, balls free"}</text>`;
  return g + "</svg>";
}

/* ------------------------------------------------------------------ 2D: hydraulic circuit (ISO 1219 style) */
function hydSVG(s, P, R) {
  const k = s.k, W = 800, H = 520;
  const st = {
    A: k === 2 ? "p" : k === 3 ? "hold" : k === 4 ? "t" : "off",
    B: k === 4 ? "p" : k === 2 ? "t" : "off",
    C: k === 1 ? "p" : k >= 2 && k <= 4 ? "hold" : k === 5 ? "t" : "off",
    AIR: k === 6 ? "air" : "off",
  };
  const ln = (d, cl, w = 3) => `<path d="${d}" class="hy ${cl}" stroke-width="${w}" fill="none"/>`;
  const T = (x, y, t, a = "middle", cls = "") => `<text x="${x}" y="${y}" class="apc-t ${cls}" text-anchor="${a}">${t}</text>`;
  let g = `<svg viewBox="0 0 ${W} ${H}" class="apc-svg hyd" aria-label="Hydraulic circuit of the pallet changer">
    <defs><marker id="ha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#333"/></marker></defs>`;
  // supply: tank, pump, motor, relief, check, filter, accumulator, gauge
  const yP = 440, yT = 480;
  g += ln(`M40,${yP} H760`, "p", 3) + T(770, yP + 4, "P", "start") + ln(`M40,${yT} H760`, "t", 3) + T(770, yT + 4, "T", "start");
  g += `<path d="M40,500 v14 h50 v-14" class="sym"/>` + T(65, 512, "tank");
  g += `<circle cx="65" cy="455" r="14" class="sym"/><path d="M58,462 L65,446 L72,462 Z" fill="#333"/>` + T(65, 432, "0P1");
  g += `<circle cx="22" cy="455" r="10" class="sym"/>` + T(22, 459, "M") + `<line x1="32" y1="455" x2="51" y2="455" class="sym"/>`;
  g += ln(`M65,469 V500`, "t", 2);
  g += `<rect x="110" y="448" width="18" height="28" class="sym"/><path d="M119,472 L119,452" class="sym" marker-end="url(#ha)"/>` + T(119, 494, "0V1 relief", "middle") ;
  g += `<path d="M150,440 m-8,0 l8,-8 l8,8" class="sym"/>` + T(150, 424, "check");
  g += `<path d="M190,470 l10,-10 l10,10 l-10,10 z" class="sym"/><line x1="190" y1="470" x2="210" y2="470" class="sym" stroke-dasharray="3 2"/>` + T(200, 500, "filter 10 µm");
  g += `<rect x="236" y="384" width="26" height="40" rx="12" class="sym"/><line x1="236" y1="400" x2="262" y2="400" class="sym"/><line x1="249" y1="424" x2="249" y2="440" class="sym"/>` + T(249, 376, `0Z2 accumulator ${accuSize(P, R).std} L`);
  g += `<circle cx="290" cy="420" r="10" class="sym"/><line x1="285" y1="425" x2="296" y2="414" class="sym"/><line x1="290" y1="430" x2="290" y2="440" class="sym"/>` + T(290, 404, `${P.p} MPa`);

  // ---- branch 1: lift cylinder 1A1 with 4/3 valve 1V1, pilot check 1V2, throttles 1V3
  const x1 = 400, vy = 340;
  const vbox = (x, y, w, act) => `<rect x="${x}" y="${y}" width="${w}" height="34" class="sym ${act ? "act" : ""}"/>`;
  const pos = k === 2 ? 0 : k === 4 ? 2 : 1;
  g += vbox(x1 - 60, vy, 40, pos === 0) + vbox(x1 - 20, vy, 40, pos === 1) + vbox(x1 + 20, vy, 40, pos === 2);
  g += `<path d="M${x1 - 50},${vy + 30} V${vy + 4}" class="sym" marker-end="url(#ha)"/><path d="M${x1 - 30},${vy + 4} V${vy + 30}" class="sym" marker-end="url(#ha)"/>`;
  g += `<path d="M${x1 - 10},${vy + 4} v6 m-5,0 h10 M${x1 + 10},${vy + 4} v6 m-5,0 h10 M${x1 - 10},${vy + 30} v-6 m-5,0 h10 M${x1 + 10},${vy + 30} v-6 m-5,0 h10" class="sym"/>`;
  g += `<path d="M${x1 + 30},${vy + 30} L${x1 + 50},${vy + 4}" class="sym" marker-end="url(#ha)"/><path d="M${x1 + 50},${vy + 30} L${x1 + 30},${vy + 4}" class="sym" marker-end="url(#ha)"/>`;
  g += `<rect x="${x1 - 76}" y="${vy + 8}" width="16" height="18" class="sym ${pos === 0 ? "act" : ""}"/><line x1="${x1 - 76}" y1="${vy + 26}" x2="${x1 - 60}" y2="${vy + 8}" class="sym"/>`;
  g += `<rect x="${x1 + 60}" y="${vy + 8}" width="16" height="18" class="sym ${pos === 2 ? "act" : ""}"/><line x1="${x1 + 60}" y1="${vy + 26}" x2="${x1 + 76}" y2="${vy + 8}" class="sym"/>`;
  g += T(x1, vy + 54, "1V1  4/3 solenoid valve (lift)");
  g += ln(`M${x1 - 10},${vy + 34} V${yP}`, k === 2 || k === 4 ? "p" : "off", 2) + ln(`M${x1 + 10},${vy + 34} V${yT}`, k === 2 || k === 4 ? "t" : "off", 2);
  // A / B lines up through pilot check valves and throttles to the cylinder
  const xa = x1 - 10, xb = x1 + 10;
  g += ln(`M${xa},${vy} V100 H${x1 - 30} V86`, st.A, 3) + ln(`M${xb},${vy} V120 H${x1 + 60} V60 H${x1 + 30} V66`, st.B, 3);
  g += `<path d="M${xa - 8},250 l8,-9 l8,9" class="sym"/><path d="M${xb - 8},250 l8,-9 l8,9" class="sym"/><path d="M${xa + 8},246 L${xb - 8},246" class="sym" stroke-dasharray="4 3"/>` + T(x1 + 26, 250, "1V2 pilot check", "start");
  g += `<path d="M${xa - 7},200 q7,-10 0,-20 M${xa + 7},200 q-7,-10 0,-20" class="sym"/><path d="M${xb - 7},200 q7,-10 0,-20 M${xb + 7},200 q-7,-10 0,-20" class="sym"/>` + T(x1 + 26, 194, "1V3 meter-out throttles", "start");
  // cylinder 1A1 (vertical, rod up), piston follows the lift
  const cyY = 40, lp = s.lift * 20;
  g += `<rect x="${x1 - 50}" y="${cyY}" width="100" height="46" class="sym"/><rect x="${x1 - 48}" y="${cyY + 30 - lp}" width="96" height="6" fill="#333"/>
        <rect x="${x1 - 5}" y="${cyY - 20 - lp}" width="10" height="${50}" fill="#333"/>` + T(x1 - 62, cyY + 26, `1A1 lift cylinder Ø${R.D ?? "–"}/${R.D ? RODS[R.D] : "–"} × ${P.s}`, "end");

  // ---- branch 2: zero-point modules via 3/2 valve 2V1, pressure switch 2S1, rotary union
  const x2 = 620;
  const on2 = k >= 1 && k <= 4;
  g += vbox(x2 - 40, vy, 40, on2) + vbox(x2, vy, 40, !on2);
  g += `<path d="M${x2 - 30},${vy + 30} V${vy + 4}" class="sym" marker-end="url(#ha)"/><path d="M${x2 - 10},${vy + 30} v-6 m-5,0 h10" class="sym"/>`;
  g += `<path d="M${x2 + 30},${vy + 4} L${x2 + 10},${vy + 30}" class="sym" marker-end="url(#ha)"/><path d="M${x2 + 30},${vy + 30} v-6 m-5,0 h10" class="sym"/>`;
  g += `<rect x="${x2 - 56}" y="${vy + 8}" width="16" height="18" class="sym ${on2 ? "act" : ""}"/><line x1="${x2 - 56}" y1="${vy + 26}" x2="${x2 - 40}" y2="${vy + 8}" class="sym"/>`;
  g += `<path d="M${x2 + 40},${vy + 17} l6,-8 l6,16 l6,-16 l6,8" class="sym"/>`;
  g += T(x2, vy + 54, "2V1  3/2 valve (module release)");
  g += ln(`M${x2 - 30},${vy + 34} V${yP}`, k === 1 ? "p" : "off", 2) + ln(`M${x2 + 30},${vy + 34} V${yT}`, k === 5 ? "t" : "off", 2);
  g += ln(`M${x2 - 20},${vy} V170`, st.C, 3);
  g += `<rect x="${x2 + 2}" y="226" width="28" height="22" class="sym ${st.C === "p" || st.C === "hold" ? "act" : ""}"/>` + T(x2 + 36, 241, "2S1 pressure switch", "start") + `<line x1="${x2 - 20}" y1="237" x2="${x2 + 2}" y2="237" class="sym"/>`;
  g += `<circle cx="${x2 - 20}" cy="160" r="10" class="sym"/><circle cx="${x2 - 20}" cy="160" r="5" class="sym"/>` + T(x2 + 2, 164, "rotary union", "start");
  g += ln(`M${x2 - 20},150 V128 H${x2 - 75} M${x2 - 20},128 H${x2 + 90}`, st.C, 3);
  for (let i = 0; i < 4; i++) {
    const xm = x2 - 75 + i * 55, pp = (1 - s.clamp) * 10;
    g += ln(`M${xm},128 V108`, st.C, 2);
    g += `<rect x="${xm - 18}" y="70" width="36" height="38" class="sym"/><rect x="${xm - 16}" y="${92 - pp}" width="32" height="5" fill="#333"/>
          <path d="M${xm - 10},${88 - pp} l20,-4 l-20,-4 l20,-4 l-20,-4" class="sym"/><rect x="${xm - 3}" y="${56 - pp}" width="6" height="${36}" fill="#333"/>`;
  }
  g += T(x2 + 8, 40, `2A1–2A4 zero-point modules ${P.fmod} kN`);

  // ---- branch 3: seating air
  const x3 = 740;
  g += `<path d="M${x3 - 10},${yP - 60} l10,-14 l10,14 z" class="sym" fill="none"/>` + T(x3, yP - 36, "air 0.6 MPa") ;
  g += vbox(x3 - 20, 250, 40, k === 6);
  g += ln(`M${x3},${yP - 74} V284`, k === 6 ? "air" : "off", 2) + ln(`M${x3},250 V200`, st.AIR, 2);
  g += `<rect x="${x3 - 14}" y="174" width="28" height="22" class="sym ${k === 6 ? "act" : ""}"/>` + T(x3, 166, "3S1");
  g += T(x3, 304, "3V1", "middle");
  // legend
  g += `<g transform="translate(20,20)">${[["p", "pressure"], ["hold", "pressure held"], ["t", "to tank"], ["air", "air"], ["off", "no flow"]]
    .map(([c, t], i) => `<line x1="${i * 104}" y1="0" x2="${i * 104 + 24}" y2="0" class="hy ${c}" stroke-width="4"/><text x="${i * 104 + 30}" y="4" class="apc-t">${t}</text>`).join("")}</g>`;
  return g + "</svg>";
}

/* ------------------------------------------------------------------ UI */
const host = $("apc3d");
if (host) {
  let view = null, lastKey = "", raf = 0, last = performance.now(), cur = null;
  const pane = $("tab-apc");
  const geoKey = (P, R) => ["a", "b", "r", "s", "mp", "secH", "secB", "dm", "pitch", "nmod", "hc", "i"].map((k) => P[k]).join("|") + "|" + R.D;
  function info(key) {
    const A = window.APC && window.APC.get(); if (!A) return;
    const el = $("apc3dInfo");
    if (!key) { el.innerHTML = dimsHTML(A.P, A.R); return; }
    const [n, mb, matl, fn, spec, mfg] = partInfo(key, A.P, A.R, dims(A.P, A.R));
    el.innerHTML = `<div class="apc-pi-h"><b>${esc(n)}</b><span class="apc-mb ${mb.split(" ")[0].replace("/", "")}">${esc(mb)}</span></div>
      <p>${esc(fn)}</p>${spec ? `<p><span class="muted">Specification</span><br>${esc(spec)}</p>` : ""}${matl ? `<p><span class="muted">Material</span><br>${esc(matl)}</p>` : ""}
      ${mfg ? `<p><span class="muted">Manufacturing / mounting</span><br>${esc(mfg)}</p>` : ""}<button class="btn ghost" id="apc3dBack">◀ main dimensions</button>`;
    $("apc3dBack").onclick = () => info(null);
  }
  function dimsHTML(P, R) {
    const d = dims(P, R);
    const rows = [["Pallet height above floor", `${H0} mm`], ["Swing circle", `Ø ${f(d.swing, 0)} mm`], ["Total height (top of wall)", `${f(d.height, 0)} mm`],
      ["Arm radius r", `${P.r} mm`], ["Lift stroke", `${P.s} mm`], ["Base footprint", `${d.S} × ${d.S} mm`],
      ["Ring gear / pinion", `m ${d.m}, z ${d.zr} / ${d.zp}`], ["Planetary gearbox", `i ≈ ${f(d.iPlan, 1)}`], ["Lift cylinder", `Ø${d.D} / ${d.rod} × ${P.s}`],
      ["Zero-point modules", `${P.nmod} × ${P.fmod} kN, pitch ${P.pitch}`]];
    return `<div class="apc-pi-h"><b>Main dimensions</b></div><table class="apc-dim"><tbody>${rows.map(([a, b]) => `<tr><td>${a}</td><td><b>${b}</b></td></tr>`).join("")}</tbody></table>
      <p class="hint">Click any part in the 3D view to see its function, specification, material and how to make or mount it. MAKE = parts you manufacture, BUY = catalogue parts.</p>`;
  }
  function init() {
    if (view) return;
    try { view = create3D(host); } catch (e) { host.innerHTML = `<p class="muted" style="padding:16px">3D could not start (${esc(e.message)}).</p>`; return; }
    new ResizeObserver(() => view.resize()).observe(host);
    view.resize();
    view.onPick(info);
    const A = window.APC.get();
    view.build(A.P, A.R); lastKey = geoKey(A.P, A.R);
    view.update(A.s, A.P);
    info(null);
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (!pane.classList.contains("active")) return;
      view.frame(dt);
    };
    raf = requestAnimationFrame(loop);
  }
  window.apc3d = {
    rebuild(P, R) {
      if (!view) return;
      const k = geoKey(P, R);
      if (k !== lastKey) { lastKey = k; view.build(P, R); info(null); }
    },
    update(s, P, R, T) {
      cur = s;
      if (view) view.update(s, P);
      $("apcSec").innerHTML = sectionSVG(s, P);
      $("apcHyd").innerHTML = hydSVG(s, P, R);
      $("apc3dStep").innerHTML = s.k < R.steps.length ? `Step ${s.k + 1}: <b>${esc(R.steps[s.k][0])}</b>` : "<b>Change complete</b>";
      $("apc3dScrub").value = Math.round((T || 0) / R.tch * 1000);
      const A = window.APC.get();
      $("apc3dPlay").textContent = A.playing ? "❚❚ Pause" : "▶ Play change";
    },
  };
  $("apc3dPlay").addEventListener("click", () => window.APC.play());
  $("apc3dScrub").addEventListener("input", (e) => window.APC.seek(e.target.value / 1000));
  document.querySelectorAll("[data-apcview]").forEach((b) => b.addEventListener("click", () => { if (!view) return; view.fit(b.dataset.apcview);
    if (b.dataset.apcview === "drive") { $("apc3dCut").checked = true; view.setCut(true); }
    if (b.dataset.apcview === "clamp") { $("apc3dExp").checked = true; view.setExplode(true); $("apc3dCut").checked = false; view.setCut(false); } }));
  $("apc3dExp").addEventListener("change", (e) => view && view.setExplode(e.target.checked));
  $("apc3dCut").addEventListener("change", (e) => view && view.setCut(e.target.checked));
  $("apc3dGuard").addEventListener("change", (e) => view && view.setGuards(e.target.checked));
  $("apc3dLbl").addEventListener("change", (e) => view && view.setLabels(e.target.checked));
  const _prev = window.onTabShown;
  window.onTabShown = (name) => { if (_prev) _prev(name); if (name === "apc") { init(); if (view) view.resize(); } };
  if (pane.classList.contains("active") || location.hash === "#apc") setTimeout(() => { if (pane.classList.contains("active")) init(); }, 50);
  // first 2D drawing
  const A0 = window.APC && window.APC.get();
  if (A0) window.apc3d.update(A0.s, A0.P, A0.R, A0.T);
  const q = new URLSearchParams(location.search);
  if (q.get("apcview")) setTimeout(() => { init(); const b = document.querySelector(`[data-apcview="${q.get("apcview")}"]`); if (b) b.click(); }, 400);
  if (q.get("apcexp")) setTimeout(() => { init(); $("apc3dExp").checked = true; view && view.setExplode(true); }, 400);
  if (q.get("apccut")) setTimeout(() => { init(); $("apc3dCut").checked = true; view && view.setCut(true); }, 400);
  if (q.get("apcpart")) setTimeout(() => { init(); info(q.get("apcpart")); }, 600);
}
