# 55 – SOLIDWORKS model → Three.js 3D twin: convert, load, animate, connect to live data

> **Built in the twin (2026-11-14):** steps S5–S7 work with a test model on HMC-01..03 – see **2.1**. Continues guides 01 (twin core), 02 (FMS), 52 (CAD software) and
> 53 (tool coupling). State: **November 2026**. Menu names are from current versions – they move between releases,
> so check the help of your version. All numbers are **example values**.
> "3d.js" in the question = **Three.js**, the 3D library the twin already uses (`web/vendor/three.module.min.js`, r160).

## Contents
1. Purpose · 2. Where in the twin · 3. Concepts · 4. The full chain in one picture · 5. Step by step (S0–S8) ·
6. Formulas (units, tessellation, triangles, frame budget, smoothing, axis mapping) · 7. Three levels of simulation ·
8. Connect to the real FMS (PLC → server → 3D) · 9. Checklists · 10. Common mistakes · 11. Limits · 12. Glossary

---

## 1. Purpose

You have a SOLIDWORKS model of your FMS (HMCs, pallet changer, pallet stocker, AGV, washer …).
You want to:

1. **See** this real geometry in the twin's 3D view instead of the simple boxes.
2. **Simulate**: make the machines move (doors, pallet changer, axes, AGV) following the twin's simulation.
3. **Connect**: later, move them with **real data** from the PLCs of the real FMS.

Short answer:

| Step | What | Tool |
|---|---|---|
| 1 | Simplify the model and split it into moving groups | SOLIDWORKS |
| 2 | Export **STEP** (or glTF if your version offers it) | SOLIDWORKS |
| 3 | Convert to **.glb** (glTF binary), set pivots, reduce triangles | FreeCAD and/or Blender (free, offline) |
| 4 | Put the .glb in `web/models/`, load it with **GLTFLoader** | Three.js (local copy) |
| 5 | Drive the moving parts from the snapshot (`state`, `progress`) | `web/factory3d.js` |
| 6 | Later: read real axis positions from the PLC into the snapshot | `server.py` + PLC (Modbus TCP / OPC UA) |

---

## 2. Where in the twin

| Part | File | What it does today |
|---|---|---|
| Station list, position, rotation | `config/factory.json` → `stations[]` → `"pos": [x, z]`, `"rot"`, `"model": "hmc"` | Units **metres**, floor plane x–z, y = up |
| 3D builder per machine type | `web/factory3d.js` → `const BUILD = { hmc(g, c) {...}, ... }` | Builds each machine from **boxes** (procedural) |
| Placing stations | `web/factory3d.js` → `config.stations.forEach(...)` (≈ line 631) | Makes a group `g` at `pos`, rotates by `rot`, calls `BUILD[kind](g, ctx)` |
| Live update | `web/factory3d.js` → `update(s)` (≈ line 797) | Gets every snapshot: `m.state`, `m.progress`, `m.item.v` … |
| Animation per frame | `st.built.anim(t, dt, run, hasPart, progress)` (≈ line 888) | Door, spindle, pallet move per frame |
| Live data source | `server.py` → `GET /api/stream` (Server-Sent Events), `GET /api/state` | The simulation snapshot (or later real data) |
| Libraries | `web/vendor/` (import map in `web/index.html`: `"three/addons/": "./vendor/"`) | Offline. **GLTFLoader is not there yet** – see S5 |

So the plan is simple: **replace what `BUILD.hmc` draws with your SOLIDWORKS geometry**, and keep the same
`update` / `anim` hooks. The simulation logic does not change at all.

### 2.1 What is built now

| File | What it does |
|---|---|
| `web/vendor/loaders/GLTFLoader.js`, `web/vendor/utils/BufferGeometryUtils.js` | Three.js **r160** loader, local copy (offline) |
| `web/glbmodel.js` | `attachGLB()` loads the file and swaps out the boxes; `animGLB()` moves the parts every frame; F12 helper `twinGLB` |
| `web/factory3d.js` | 4 small hooks: import, `attachGLB` after each station is built, `animGLB` instead of the box animation, state tint |
| `config/factory.json` | HMC-01, -02, -03 have `"glb": "models/hmc_test.glb"` |
| `web/models/hmc_test.glb` | **Test model** (65 kB, 1 092 triangles) – a stand-in for your SOLIDWORKS export, with the right node names and pivots |
| `tools/make_test_glb.py` | Makes the test model (stdlib Python). Read it to see a correct node tree |
| `server.py` | Serves `.glb` as `model/gltf-binary` |

**See it:** restart `python server.py` (the config is read at start), open `http://localhost:8080`, Live factory →
3D factory → camera *Machining*, or deep link `/?cam=fms&focus=HMC-01#3d`. Colour *State* tints the machine paint.

**Use your own model:**
1. Export your HMC as GLB (S0–S4) with these node names: `Door`, `Spindle`, `Table`, `Head`, `Column`, `B_axis`,
   `Workpiece`, `Magazine`, `APC_Arm`, `Andon` (empty marker for the light tower). Missing names are simply not
   animated. Name the paint appearance `Body` (or `Paint…`) to get the state colour.
2. Optional custom property on `Door` (Blender: Object → Custom Properties, exported as glTF *extras*):
   `travel_m` = opening in metres (default 0.9).
3. Copy it to `web/models/hmc.glb` and change `"glb"` in `config/factory.json`. Restart the server.
4. F12 → Console must show `[glb] HMC-01: loaded models/hmc.glb - moving parts found: …`.
   `twinGLB.pose("HMC-01")` shows position / angle of every moving part (check signs and pivots).
5. Problem? The boxes stay and the console says why. `?glb=0` in the address turns all CAD models off.

**What moves (L2, from the simulation snapshot):**

| Node | Motion | Rule |
|---|---|---|
| `Door` | slides +X by `travel_m` | open when not RUNNING or progress < 4 % or > 97 % (smoothing τ = 0.25 s) |
| `Spindle` | turns about local Z | while RUNNING (visual speed, not real rpm) |
| `Table` / `Head` / `Column` | X / Y / Z tool path | sine path while RUNNING, back to home otherwise (τ = 0.15 s) |
| `B_axis` | turns about Y | indexes 90° per quarter of the cycle: angle = floor(4·progress)·90° |
| `APC_Arm` | turns 180° about Y | in the first 4.5 % of each new cycle |
| `Magazine` | turns about X | slowly while RUNNING |
| `Workpiece` | visible + scale | visible when a part is in; scale per product model (VC10 small … VC30 big) |

**Real axes (L3, prepared):** when a machine snapshot contains `"axes": {"X": 412.5, "B": 90}` (section 8), add to
the station in `factory.json`:

```json
"glb_axes": {"X": {"node": "Table",  "axis": "x", "sign": 1},
             "Y": {"node": "Head",   "axis": "y", "sign": 1},
             "Z": {"node": "Column", "axis": "z", "sign": -1},
             "B": {"node": "B_axis", "axis": "y", "sign": 1, "deg": true}}
```

Then those nodes follow the real values (formula 6.6, mm → m, ° → rad, smoothing τ = 0.1 s) instead of the script.
The PLC/CNC collector in `server.py` that fills `axes` is **not built yet** (next step when you know the signals).

**Tested (2026-11-14):** all 3 HMCs load the model, all 10 nodes found; at progress 0.547 the door was closed, B = 180°,
APC swapped once, X/Y/Z and spindle moving; with the file removed the boxes stayed with a console warning;
`tools/verify_engine.py` passes.

---

## 3. Concepts

### 3.1 CAD geometry vs. 3D-view geometry

- SOLIDWORKS stores **exact surfaces** (B-rep: planes, cylinders, NURBS). Very accurate, very heavy.
- A web 3D view only draws **triangles** (a mesh). Converting surfaces to triangles = **tessellation**.
- You choose the accuracy: more triangles = rounder circles but slower view. For a twin you need **looks**,
  not ±0.01 mm. A tolerance of 0.2–1 mm is enough (see 6.2).

### 3.2 File formats

| Format | Contains | Colours | Assembly tree (separate parts) | Use for the twin |
|---|---|---|---|---|
| `.SLDPRT` / `.SLDASM` | Exact CAD, mates, features | ✓ | ✓ | Cannot be read by a browser |
| **STEP AP214 / AP242** (`.step`) | Exact surfaces + tree | ✓ (AP214/242) | ✓ | **Best export from SOLIDWORKS** → convert |
| STL | Triangles only | ✗ | ✗ (one file per part) | Works, but no colours, no names |
| OBJ (+ MTL) | Triangles + simple materials | ✓ basic | partly (groups) | OK |
| VRML (`.wrl`) | Triangles + colours + tree | ✓ | ✓ | Old, works in some converters |
| **glTF 2.0 / GLB** | Triangles + PBR materials + **node tree with pivots** + animations | ✓ | ✓ | **Target format for Three.js** ("the JPEG of 3D") |

**GLB** = glTF in one binary file (geometry + materials inside). Use GLB, not `.gltf` + separate `.bin` files.

### 3.3 Node tree and pivots – the key idea for animation

To move a part in 3D it must be **its own node** (object) in the file, and its **origin (pivot)** must be on the
**joint axis**:

```
HMC-01 (root, origin = floor centre of machine)
├── Base            (fixed)
├── Column          (moves in Z  → pivot anywhere, linear)
│   └── Head        (moves in Y)
│       └── Spindle (rotates → pivot ON the spindle axis)
├── Table           (moves in X)
│   └── B_axis      (rotates → pivot on table centre axis)
├── Door            (slides X)
└── APC_Arm         (rotates 180° → pivot on the changer axis)
    ├── Pallet_A
    └── Pallet_B
```

Parent–child = the child moves with its parent (Head moves with Column). This is the same as a kinematic chain
in a robot (guide 22). **If everything is merged into one mesh, nothing can move.**

### 3.4 Units and axes

| | SOLIDWORKS | glTF / Three.js | This twin |
|---|---|---|---|
| Length unit | mm (usually) | **metre** | metre |
| Up axis | **Y** (Top plane normal) by default | **Y** | Y |
| Floor | X–Z plane (Top plane) | X–Z | X–Z (`pos: [x, z]`) |

Good news: SOLIDWORKS default orientation already matches Three.js. You only must convert **mm → m (× 0.001)**.
If your model was drawn with Z up (common when the floor is the Front plane), rotate −90° about X in the converter.

### 3.5 What "simulation in the twin" means here

The 3D view **does not compute physics**. The Python engine (`twin/model.py`) decides *what* happens
(RUNNING, SETUP, DOWN, progress 0→1). The 3D view only **shows** it by moving nodes = **kinematic animation**.
If you need real dynamics (forces, vibration, servo tuning) do that in Simscape / Adams (guide 53) and send the
result values to the twin.

---

## 4. The full chain in one picture

```
 SOLIDWORKS (.SLDASM)
   │  S0 simplify, split moving groups, set coordinate system
   │  S1 Save As STEP AP214 (mm, with colours)
   ▼
 FreeCAD  ── S2 open STEP, check tree, export .glb ──►  Blender (optional)
                                                        S3 decimate, set pivots, rename, scale 0.001
                                                        S4 export glTF Binary (.glb), +Y up, no Draco
   ▼
 web/models/hmc.glb
   │  S5 GLTFLoader (local copy in web/vendor/loaders/)
   ▼
 web/factory3d.js  ── S6 place at station pos/rot ── S7 drive nodes from snapshot
   ▲
   │  /api/stream  (SSE, JSON snapshot: state, progress, item, later axes[])
 server.py  ◄── twin engine (simulation)    or   ◄── S8 PLC of the real FMS (Modbus TCP / OPC UA)
```

---

## 5. Step by step

### S0 – Prepare the model in SOLIDWORKS (the most important step)

1. **Save a copy** of the assembly for visualisation (`HMC-01_VIS.SLDASM`). Never simplify the design master.
2. **Remove what nobody sees**: internal parts of the spindle, bearings, cables, small screws, nuts, washers,
   threads (cosmetic threads are fine), springs, the inside of the electrical cabinet.
   Tool: **Tools → Defeature** (assembly) – keeps the outside shape, removes the inside, can also merge parts.
3. **Make one sub-assembly per moving group** (Base, Column, Head, Table, Door, APC arm, each pallet).
   Fixed parts may be merged; moving parts must stay separate.
4. **Coordinate system**: Insert → Reference Geometry → Coordinate System at the **floor centre of the machine**,
   Y up, Z towards the operator door. This becomes the machine origin in the twin (matches `pos` in factory.json).
5. **Name clearly** in English, no spaces: `Column`, `Head`, `Spindle`, `Door`, `APC_Arm`. The code will find
   nodes by these names.
6. **Appearances**: use simple colours (machine white, guards grey, glass transparent). Decals and complex
   textures are lost or become heavy.
7. Note the **joint axis** of every moving group (point + direction) and its **travel** (e.g. X 0…800 mm,
   APC 0…180°). You need these in S3 and S7. Put them in a small table (see 9.2).

### S1 – Export from SOLIDWORKS

**Route A (recommended): STEP**
File → Save As → *STEP AP214 (\*.step)* → Options: output as **AP214** (keeps colours), "Export as one file",
units **mm**, select your new coordinate system ("Output coordinate system").

**Route B: direct glTF / GLB** – some newer SOLIDWORKS releases and **SOLIDWORKS Visualize** (included with
Professional / Premium) can save glTF / GLB. Look in the *Save as type* list of your version. If it is there,
you can skip FreeCAD, but still check the tree, scale and pivots in Blender (S3).

**Route C: STL per part** – File → Save As → STL → Options: units mm, resolution *Custom* (deviation, angle),
untick "Save all components of an assembly in a single file" → one STL per part. No colours, no tree – you
re-assemble and colour in Blender. Use only if A and B fail.

### S2 – Convert STEP → GLB with FreeCAD (free, offline install)

1. Install FreeCAD (one installer, works offline after install).
2. File → Open → your `.step`. Check the tree on the left: you should see `Column`, `Head`, … as separate items.
3. Optional: set mesh quality in Edit → Preferences → Import-Export → *Mesh* (deviation e.g. 0.2 mm, angle 15°).
4. Select the top object → File → Export → type **glTF (\*.glb)** → save `hmc_raw.glb`.
5. FreeCAD writes metres in glTF (it converts mm → m). Check this in S3 – if the machine is 1000× too big,
   scale 0.001.

If the model is simple and the tree, size and origin are already right, `hmc_raw.glb` can go straight to S5.
Usually you still want S3.

### S3 – Clean up in Blender (free, offline)

1. File → Import → glTF 2.0 → `hmc_raw.glb`.
2. **Check size**: press N, look at *Dimensions*. An HMC should be ≈ 3–4 m, not 3 000 m. Fix: select all → S
   → 0.001 → Ctrl+A → *Apply Scale*.
3. **Check orientation**: machine stands on the floor, door towards +Z (front view = Numpad 1 looks along −Y …
   use the gizmo). If lying down: R X −90, Apply Rotation.
4. **Join fixed parts**: select all fixed pieces of `Base` → Ctrl+J. Fewer objects = faster.
5. **Set pivots** for moving parts: put the 3D cursor on the joint axis (select an edge/circle of the axis in Edit
   mode → Shift+S → *Cursor to Selected*), then in Object mode: Object → Set Origin → *Origin to 3D Cursor*.
6. **Parent** moving parts: select child, then parent, Ctrl+P → *Object (Keep Transform)*.
7. **Reduce triangles**: Modifier → *Decimate* (ratio 0.2–0.5) on heavy parts (castings, covers). Watch the
   triangle count in the status bar (right-click status bar → *Scene Statistics*). Targets in 6.3.
8. **Rename** objects exactly as in your table (`Door`, `APC_Arm` …).
9. **Materials**: keep simple Principled BSDF colours. Glass: Alpha 0.3, Blend mode *Alpha Blend*.
10. Optional: make **animations** in Blender (keyframes, e.g. `door_open`, `apc_swap`) – glTF stores them and
    Three.js can play them (`AnimationMixer`). For a twin, coding the motion from data (S7) is usually better.

### S4 – Export the final GLB

File → Export → glTF 2.0 → Format **glTF Binary (.glb)**, Include: *Selected* or *Visible*, Transform: **+Y Up**,
Mesh: *Apply Modifiers* ✓, Normals ✓, Compression (**Draco**) ✗ – Draco needs an extra decoder library (more files
to vendor). Save as `web/models/hmc.glb`. One file per machine *type* (all 3 HMCs reuse the same file).

### S5 – Add the loader to the twin (offline)

The twin has `three.module.min.js` r160 + `OrbitControls.js`. You need two more files **from the same version
r160** (mixing versions breaks):

| Copy from the Three.js r160 package | To |
|---|---|
| `examples/jsm/loaders/GLTFLoader.js` | `web/vendor/loaders/GLTFLoader.js` |
| `examples/jsm/utils/BufferGeometryUtils.js` | `web/vendor/utils/BufferGeometryUtils.js` |

Get them once on a PC with internet (e.g. `npm pack three@0.160.0` and unpack the `.tgz`, or the r160 zip from
the Three.js GitHub releases) and copy by USB. GLTFLoader imports `'three'` and `'../utils/BufferGeometryUtils.js'`,
so the folder layout above is required. The import map already maps `three/addons/` → `./vendor/`, so you import:

```js
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
```

Server: `server.py` serves any file under `web/`. `.glb` may come as `application/octet-stream` on Windows – that
is fine for GLTFLoader. (Optional, cleaner: `mimetypes.add_type("model/gltf-binary", ".glb")` in `server.py`.)
Always open the twin via `http://localhost:8080`, not by double-clicking the HTML (file:// blocks loading).

### S6 – Load and place the model (code sketch for `web/factory3d.js`)

Idea: keep the box machine as a **placeholder**, load the GLB in the background, and swap it in when ready.
If the file is missing, the boxes stay – the twin never breaks.

```js
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const loader = new GLTFLoader();
const glbCache = {};                                   // one download per file, reused by HMC-01..03
function loadGLB(url) {
  if (!glbCache[url]) glbCache[url] = new Promise((ok, bad) => loader.load(url, (gltf) => ok(gltf.scene), undefined, bad));
  return glbCache[url];
}

// in config.stations.forEach((s) => { ... }) after: const built = BUILD[kind](g, ctx);
if (s.glb) {                                           // new optional field in factory.json, e.g. "glb": "models/hmc.glb"
  loadGLB(s.glb).then((proto) => {
    const model = proto.clone(true);                   // deep clone: each station gets its own nodes
    model.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.userData.stationId = s.id; } });
    g.clear();                                         // remove the boxes
    g.add(model);
    const st = stations[s.id];
    st.nodes = {                                       // find moving parts by the names from S0 / S3
      door: model.getObjectByName("Door"),
      apc: model.getObjectByName("APC_Arm"),
      spindle: model.getObjectByName("Spindle"),
      column: model.getObjectByName("Column"),
    };
    st.home = {};                                      // remember the start pose of every node
    for (const [k, n] of Object.entries(st.nodes)) if (n) st.home[k] = { p: n.position.clone(), r: n.rotation.clone() };
  }).catch((e) => console.warn("GLB not loaded, keeping boxes:", s.glb, e));
}
```

`config/factory.json`, one new field per station (position and rotation stay as they are):

```json
{"id": "HMC-01", "model": "hmc", "glb": "models/hmc.glb", "pos": [-23.3, -21.2], "rot": 0, ...}
```

Note: `tint()` and the screen/lamps of the box model use `ctx.body`, `ctx.lamps`. With a GLB you either keep a
small status lamp (a box on top of the model) or tint a named node (e.g. `Lamp`) – see S7.

### S7 – Drive the moving parts from the simulation

The snapshot already gives, per machine: `state` (RUNNING, SETUP, STARVED, BLOCKED, DOWN, MAINTENANCE, STOPPED,
OFFLINE), `progress` (0…1 of the current cycle), `item.v` (model VC10/20/30), `fms.setup_left_s`,
`pallet_changer.change_s`. Write a per-frame function:

```js
// call every frame for each station that has st.nodes (next to st.built.anim(...))
function animGLB(st, t, dt) {
  const m = st.snap; if (!m || !st.nodes) return;
  const N = st.nodes, H = st.home, run = m.state === "RUNNING", p = m.progress || 0;

  // 1) spindle turns only while cutting: angle += ω·dt, ω = 2π·rpm/60 (slowed ×0.01 so the eye can follow)
  if (N.spindle && run) N.spindle.rotation.z += 2 * Math.PI * (st.cfg.spindle_rpm || 6000) / 60 * dt * 0.01;

  // 2) pallet changer: swap (0→180°) in the first 5 % of the cycle = the pallet change time
  if (N.apc) {
    const pc = 0.05, a = run && p < pc ? (p / pc) * Math.PI : 0;     // smooth: use ease() below
    N.apc.rotation.y = H.apc.r.y + ease(a / Math.PI) * Math.PI;
  }

  // 3) door: closed while cutting, open otherwise; moves with first-order smoothing (formula 6.5)
  if (N.door) {
    const target = H.door.p.x + (run ? 0 : 0.9);                     // 0.9 m opening (example)
    N.door.position.x += (target - N.door.position.x) * (1 - Math.exp(-dt / 0.4));
  }

  // 4) column "fake" machining path: Z goes in and out 6 times per cycle (visual only)
  if (N.column) N.column.position.z = H.column.p.z + (run ? 0.15 * Math.sin(p * 6 * 2 * Math.PI) : 0);
}
const ease = (u) => u * u * (3 - 2 * u);                             // smoothstep, 0→1 with zero speed at ends
```

Status colour on a named lamp node: `N.lamp.material.color.set(m.state === "RUNNING" ? 0x2e9e4f : m.state === "DOWN" ? 0xd03030 : 0xe0b020)`
(clone the material first, otherwise all 3 HMCs change colour together – clones share materials).

### S8 – Test

1. Start `python server.py`, open `http://localhost:8080`, 3D tab. Browser F12 → Console: no red errors.
2. HMCs show your SOLIDWORKS geometry at the right place and size (compare with the floor grid: 1 square = 1 m).
3. Doors, APC and spindle move when the state changes; speed slider (time scale) speeds them up.
4. FPS: F12 → Performance, or watch smoothness. Target ≥ 30 fps on the factory PC (budget 6.4).
5. Delete / rename the `.glb` → boxes come back (fallback works).

---

## 6. Formulas (all numbers are examples)

### 6.1 Unit conversion

$$ x_{\text{three}}\,[\text{m}] = x_{\text{SW}}\,[\text{mm}] \times 0.001 $$

Example: HMC width 3 800 mm → 3.8 m. If you see 3 800 m in Blender, the scale was not applied.

### 6.2 Tessellation – how many segments for a circle

Chord error (sagitta) $s$ of a circle with radius $r$ divided into $n$ segments:

$$ s = r\left(1-\cos\frac{\pi}{n}\right) \quad\Rightarrow\quad n = \frac{\pi}{\arccos\left(1-\dfrac{s}{r}\right)} $$

| Part | r | allowed s | n (segments per circle) |
|---|---|---|---|
| Spindle nose | 50 mm | 0.05 mm | π / arccos(0.999) = π / 0.0447 ≈ **70** |
| Spindle nose | 50 mm | 0.5 mm | π / arccos(0.99) = π / 0.1415 ≈ **22** |
| Rotary table | 400 mm | 1 mm | π / arccos(0.9975) = π / 0.0707 ≈ **44** |

For a twin, 0.5–1 mm (or angle 15°) looks round at 2 m viewing distance. 70 segments is CAM accuracy – wasted here.

### 6.3 Triangle budget and file size

Rough memory per triangle in a GLB (positions + normals + indices): about **40 bytes**.

$$ \text{size} \approx N_{\text{tri}} \times 40\ \text{B} $$

| Object | Triangle target | ≈ GLB size |
|---|---|---|
| One HMC (outside shell, doors, APC, table) | 50 000 – 150 000 | 2 – 6 MB |
| AGV | 10 000 – 30 000 | 0.4 – 1.2 MB |
| Whole factory on screen | < 1 – 2 million | – |

Example: raw STEP export of an HMC = 2.4 million triangles → ≈ 96 MB. After Defeature + Decimate 0.1 →
240 000 → ≈ 10 MB, and the 3 HMCs reuse one file (and, with `clone`, share the geometry memory).

### 6.4 Frame budget

$$ t_{\text{frame}} = \frac{1000\ \text{ms}}{\text{fps}} \qquad 30\ \text{fps} \Rightarrow 33\ \text{ms}, \quad 60\ \text{fps} \Rightarrow 16.7\ \text{ms} $$

Draw calls (one per mesh × material) cost more than triangles on office PCs: keep **< 300–500 meshes** in the
whole scene → join fixed parts (S3 step 4).

### 6.5 Smooth motion between data updates (first-order filter)

Data arrives every 0.2–1 s (snapshot or PLC), the screen draws every 16–33 ms. Without smoothing parts jump.

$$ x \leftarrow x + (x_{\text{target}} - x)\left(1 - e^{-\Delta t/\tau}\right) $$

Example: τ = 0.4 s, Δt = 0.033 s → factor = 1 − e^(−0.0825) = 0.079: each frame the part moves 7.9 % of the
remaining distance; after 3τ = 1.2 s it has done 95 %. Smaller τ = faster but more jumpy.

For **real** axis data (S8 / section 8) prefer **linear interpolation** between the last two samples (time-stamped),
it shows the true speed: $x(t) = x_1 + (x_2 - x_1)\dfrac{t - t_1}{t_2 - t_1}$.

### 6.6 Mapping a machine axis to a node

$$ \text{node.position.axis} = \text{home} + \text{sign}\times\frac{x_{\text{machine}}\,[\text{mm}]}{1000} \qquad
   \text{node.rotation.axis} = \text{home} + \text{sign}\times x_{\text{deg}}\cdot\frac{\pi}{180} $$

Example: PLC says B-axis = 90° → `B_axis.rotation.y = home + 90·π/180 = home + 1.571 rad`.
`sign` = +1 or −1 because machine axis directions (ISO 841, right-hand rule, tool-relative) often differ from the
3D axes. Test each axis once: jog +X on the machine, check the 3D part moves the same way.

---

## 7. Three levels of "simulation" in the 3D view

| Level | What moves | Data needed | Effort | Use |
|---|---|---|---|---|
| **L1 – status** | Nothing moves; colour / lamp / label shows state | `state` | 1 day | Overview, KPIs |
| **L2 – scripted kinematics** | Door, APC, spindle, "fake" axis path from `progress` (S7) | `state`, `progress` | 2–5 days | Training, presentations, layout checks, AGV/pallet flow |
| **L3 – real kinematics** | Every axis at its real position | Axis positions from CNC/PLC (section 8) or from the G-code interpreter (`web/gcode.js`) | weeks | Remote monitoring, collision check, virtual commissioning |

Start with L1 → L2 using the simulation. Go to L3 only for machines where you really need it.

---

## 8. Connect to the real FMS (later)

```
CNC / PLC of HMC-01  ──Modbus TCP / OPC UA / MTConnect──►  server.py (collector thread)
                                                              │ adds  "axes": {"X":412.5,"Y":120.0,"Z":-33.1,"B":90.0,"apc":0}
                                                              ▼
                                                        /api/stream (SSE JSON, same as today)
                                                              ▼
                                         factory3d.js  →  node.position / rotation (formula 6.6 + 6.5)
```

1. **Which signals**: per machine the axis actual positions (X, Y, Z, B), door open/closed, APC position,
   spindle running/speed, state. A typical Siemens / Fanuc / Heidenhain CNC exposes these via OPC UA or the
   machine builder's PLC interface; a PLC-only machine (APC, washer, AGV) via Modbus TCP holding registers.
   (For the ball-screw line, guide 43 rule: **Modbus TCP + HTTP only**.)
2. **Interface sheet** (one row per signal): name, address/node id, type, unit, scale, update rate, sign.
   Example Modbus: `HR 40100–40101 = X actual, REAL (2 registers), mm`; `HR 40110 = APC angle ×10 (INT, 0.1°)`.
3. **Collector**: a thread in `server.py` (stdlib `socket` for Modbus TCP – see guide 43) reads every 100–500 ms
   and writes the values into the machine's snapshot under `"axes"`. Read-only: the 3D view never writes to a
   machine.
4. **3D**: in `animGLB` use `m.axes` when present, else the L2 script:
   `if (m.axes && N.table) N.table.position.x = H.table.p.x + sign.X * m.axes.X / 1000;`
5. **Data rate**: SSE snapshot rate of the twin ≈ every few hundred ms – enough for doors, APC, AGVs. For
   smooth axis motion add interpolation (6.5). Do not stream 1 kHz servo data to a browser.
6. **Safety**: the 3D twin is for **viewing**. Never use it as a safety function or as an interlock; that is
   the job of the machine's safety PLC.

---

## 9. Checklists

### 9.1 Before export (SOLIDWORKS)
- [ ] Visualisation copy of the assembly, not the master
- [ ] Inside parts, screws, cables removed (Defeature)
- [ ] One sub-assembly per moving group, clear English names
- [ ] Coordinate system at floor centre, Y up, Z to the operator side
- [ ] Simple appearances (colour, glass)
- [ ] Joint table written (9.2)

### 9.2 Joint table (example for HMC-01)

| Node | Type | Axis (3D) | Pivot (mm, machine coords) | Travel | Sign | Source |
|---|---|---|---|---|---|---|
| Table | linear | x | – | 0 … 800 mm | +1 | `axes.X` |
| Head | linear | y | – | 0 … 700 mm | +1 | `axes.Y` |
| Column | linear | z | – | 0 … 750 mm | −1 | `axes.Z` |
| B_axis | rotary | y | (0, 900, −300) | 0 … 360° | +1 | `axes.B` |
| APC_Arm | rotary | y | (0, 0, 1 650) | 0 / 180° | +1 | script / `axes.apc` |
| Door | linear | x | – | 0 … 900 mm | +1 | state (open if not RUNNING) |
| Spindle | rotary | z | on spindle axis | continuous | +1 | `run`, `spindle_rpm` |

### 9.3 After conversion (Blender / three.js)
- [ ] Size correct (HMC ≈ 3–4 m), standing on floor, door to +Z
- [ ] Pivots on joint axes (rotate in Blender – does it turn around the right axis?)
- [ ] Triangles within budget (6.3), meshes < 300–500 in scene
- [ ] GLB without Draco, in `web/models/`
- [ ] GLTFLoader + BufferGeometryUtils r160 in `web/vendor/…`, no `https://` imports
- [ ] Fallback to boxes works when the file is missing

---

## 10. Common mistakes

| Mistake | Symptom | Fix |
|---|---|---|
| mm not converted | Machine 1000× too big, camera inside it | Scale 0.001 and *Apply Scale* |
| Pivot at world origin | Door/arm swings around the factory centre | Origin to 3D cursor on the joint axis (S3.5) |
| Everything one mesh | Nothing can move | Separate moving groups in S0, check the tree |
| Raw export, no simplification | 100 MB file, 5 fps | Defeature + Decimate, 6.3 budget |
| Draco compression on | "DRACOLoader required" error | Export without Draco (or vendor the decoder) |
| Loader from CDN (`https://unpkg…`) | Works in office, blank on factory PC | Local copy in `web/vendor/` (offline rule) |
| GLTFLoader from another Three.js version | Errors like "… is not a function" | Same release as `three.module.min.js` (r160) |
| Opened as file:// | CORS / fetch error | Use `http://localhost:8080` |
| Shared material changed | All 3 HMCs turn red when one fails | `mesh.material = mesh.material.clone()` per station |
| Black or missing faces | Flipped normals from STL | Blender: Recalculate Normals, or `material.side = THREE.DoubleSide` |
| Flickering surfaces | Two coincident faces (z-fighting) | Delete duplicates / move 0.5 mm apart |
| Axis moves the wrong way | 3D opposite to machine | Fix `sign` in the joint table (6.6) |
| Supplier model published | Legal problem | Machine builders' CAD often has licence limits – keep it on the factory LAN |

---

## 11. Limits

- SOLIDWORKS **mates, motion studies and physics are not exported**. Motion is re-created in code (S7) or as
  Blender keyframes.
- Materials are approximations (colour, roughness); no exact SOLIDWORKS appearance or RealView look.
- The 3D view is kinematic, not dynamic: no forces, no collisions unless you add a check (e.g. bounding boxes,
  as `web/gcode.js` does for the tool).
- Live axis display depends on what the real CNC/PLC exposes and how fast (section 8).
- Menu names (Save As options, FreeCAD/Blender export dialogs) change between versions.

---

## 12. Glossary

| Term | Meaning |
|---|---|
| **B-rep** | Boundary representation: exact CAD surfaces (planes, cylinders, NURBS) |
| **Tessellation** | Turning exact surfaces into triangles |
| **Mesh** | A set of triangles (vertices + faces) |
| **glTF / GLB** | Open 3D format for the web (Khronos). GLB = one binary file |
| **Node** | One object in the 3D tree; has position, rotation, scale and children |
| **Pivot / origin** | The point a node rotates around |
| **Decimate** | Reduce the number of triangles while keeping the shape |
| **Draco** | Compression for glTF geometry; needs an extra decoder |
| **Draw call** | One command to the graphics card (≈ one mesh × material) |
| **Kinematic animation** | Moving parts by setting positions, without physics |
| **SSE** | Server-Sent Events – the live stream `/api/stream` of the twin |
| **Defeature** | SOLIDWORKS tool that removes inside details and keeps the outside shape |
| **Virtual commissioning** | Testing the PLC program against a 3D/simulated machine before the real one |
