# Contract – Industrial robot tab (internal, for the builders)

Tab `#tab-robot` (button `data-tab="robot"`, already in index.html and in `TABS` of app.js). Item container `#rbItem1`,
intro `#rbIntro1`, nav buttons `[data-rbitem]`. Script `<script type="module" src="robot.js">` is already added.
Offline only: local `three` (importmap → `./vendor/three.module.min.js`, `three/addons/` → `./vendor/`), `view3d.js`
(`niceControls`) for the mouse control. No CDN, no fonts, no build step. Simple English (reader = mechanical engineer,
non-native English). Every value is an example → say "example" / "check with the current datasheet".

## Shared core – `web/robotkin.js` (DONE, tested – do not change the math; you may ADD helpers)
* `ROBOTS` – 4 reference robots (catalogue data): `id, ref, cls, payload (kg), reach (mm), mass, rep (mm), mount, ip,
  dims {h1,a1,a2,a3,d4,d6}, lim [[min,max]×6] deg, vmax [deg/s ×6], tacc (s, estimate), balancer (bool), gear, base [L,W] mm, ctrl`.
  `robotById(id)`. Default robot = `irb2600`.
* `PARTS` – structure texts `{k, n, ax, t}`; keys: `base j1 j2 bal larm j3 uarm farm wrist flange motor cable grip`.
* `fk(rb, q, tool)` → `{frames:[F0..F5], flange, tcp, p:[x,y,z], R:3x3, abc:[A,B,C], wc:[x,y,z]}`. Matrices are row-major 4×4 arrays.
  * F0 column frame (floor, turns with J1) · F1 lower-arm frame (origin = J2 axis; lower arm runs along local +Z, length a2)
  * F2 upper-arm frame (origin = J3 axis) · F3 forearm frame (origin a3 above J3 on the forearm axis; forearm along local +X, length d4; J4 already applied)
  * F4 wrist frame (origin = wrist centre, J5 applied; flange is d6 along local +X after J6) · F5 flange frame (Z out of the flange)
* `ik(rb, p, R, tool, qRef, cfg?)` → `{ok, q, cfg:{front,up,flip}, sing, err}`. Picks the solution nearest `qRef`.
* `planPTP(rb, q0, q1, ovr, vFrac)` → `{type:"J", T, at(t)→q, vel(t)→dq/dt, lead}` (synchronised trapezoid, real axis speeds).
* `planLIN(rb, q0, p1, R1, tool, v_mm_s, ovr)` → `{ok, type:"L", T, at(t), vel(t), limitedBy, sing}` or `{ok:false, err}`.
* `envelope(rb)` → wrist-centre points `[r, z]` (side view). `payloadTorque(rb, q, m, tool)` → `{j2, j3, j5}` N·m.
* `rotFromABC(A,B,C)` / `abcFromRot(R)` (deg, ZYX). `ORIENT.down()`, `ORIENT.front()`. `checkLimits(rb,q)` → `["J3",…]`.
* `cellLayout(rb)` → machine-tending cell, robot base frame, mm (all positions tested reachable for all 4 robots):
  `{k, pedestal, part:{d,h,mass}, toolLen, tool:{x,y,z}, gripMass, infeed:{x0,x1,y0,y1,z,w,dir,pick}, outfeed:{…,place},
  machine:{x0,x1,y0,y1,h, door:{y0,y1,z0,z1}, fixture:[x,y,z], load:[x,y,z]}, fence:{x0,x1,y0,y1,h}, home:[6]}`.
  `pedestal` > 0 → the robot stands on a pedestal of that height; the floor is at z = −pedestal.
  Conveyors run along Y at x = x0, top height z, width w; parts move in `dir`. Machine = box x0..x1, y0..y1, height h from the floor;
  door opening on its −X face. Part in the fixture: axis horizontal along X, centre at `fixture`.

Coordinates: robot base frame X forward, Y left, Z up, mm. Three.js is Y-up: put everything in one root group with
`rotation.x = -Math.PI/2` and `scale = 0.001` (mm → m), then use robot coordinates directly inside it.

## 3D – `web/robot3d.js` (builder A)
```js
export function createRobot3D(el, getState, opts = {}) → {
  rebuild(),            // robot or cell changed (getState().rb.id) – rebuild meshes (also called automatically when rb.id changes)
  fit(), setView(name), // "iso" | "front" | "side" | "top" | "follow" (follow = camera target follows the TCP)
  explode(on), select(k /* PARTS key or null */), resize(), dispose(),
  onPick(cb)            // cb(k) when the user clicks a robot part (PARTS key) – also shows the info box itself
}
```
`getState()` is called every frame and returns:
```js
{ rb, q:[6] /*deg*/, tool:{x,y,z}, C /*cellLayout(rb)*/, grip: 0..1 /*0 open, 1 closed*/,
  parts: [{ id, p:[x,y,z], ax:"z"|"x", done:false, held:false }],   // part centres; held:true → the part follows the gripper (draw it at the TCP, axis along tool Z)
  door: 0..1 /*machine door open*/, conv: number /*conveyor belt offset mm, for the moving belt texture/rollers*/,
  show: { cell:true, env:false, frames:false, trail:true, ghost:false },
  trail: [[x,y,z], …] /*TCP path, ≤ 600 points*/, targets: [{ n:"pPick", p:[x,y,z] }], ghostQ: null|[6],
  sel: null|k, live: { moving:bool, alarm:"" } }
```
Look: real articulated-robot shape driven by `rb.dims` (every size must look right, from IRB 120 to IRB 6700):
cast base with 4 anchor bolts, turning column with the J1 reducer hub, J2 motor + reducer on the column side, lower arm
(tapered box with round ends), **balancing device** (spring cylinder from the column rear to the lower arm, length updates
with J2) only when `rb.balancer`, elbow J3 housing with motor, upper-arm rear housing with the J4/J5/J6 motors (medium/large;
small robot: smooth housings), forearm tube, wrist fork, ISO flange with bolt circle, cable harness, pneumatic 2-finger
gripper (fingers open/close with `grip`). Neutral industrial colours (light grey / white castings, dark motors, black
cables) – no brand logo, no brand colour. Cell: floor grid, pedestal (if any), infeed + outfeed belt conveyors with legs and
moving belt, machine (box with sliding door that opens with `door`, fixture inside), safety fence with mesh panels + a gate,
the parts (compressor housing = cylinder + flange). Optional: work-envelope (side-section shell or ring), joint frames (axes),
TCP trail, target markers, ghost robot at `ghostQ`. Exploded view: links move apart along their axes. Click/hover a part
→ highlight + info box (PARTS text + live axis angle). Buttons inside the 3D: Fit, Iso/Front/Side/Top, Follow, Explode.
Test params you may read: `&rbex` (explode), `&rbpick=<k>`, `&rbview=side`.

## UI + motion – `web/robot.js` (builder B)
Owns the tab content of `#rbItem1`, the robot state, the motion engine (uses `planPTP/planLIN`), the program, the teach
pendant, charts and tables. Creates the 3D lazily when the tab is shown: `const m = await import("./robot3d.js");
view = m.createRobot3D(div, () => state)`. If the import fails, show a short message and keep the rest working.
Guide: `docs/21_industrial_robot.md` (builder B) – structure, catalogue table, kinematics with formulas and example
numbers, motion (trapezoid, PTP/LIN, singularity), teach pendant + safety (T1 ≤ 250 mm/s, enabling device), the cell
program, cycle time, payload check, how to use the page, and what to check with the supplier.
