# 08 – CNC and G-code: From the Part to a Safe NC Program

> **All machine data, tool data, cutting data, programs and times in this guide are example values.**
> They come from the digital twin (`web/gcode.js`). Real cutting data comes from your tool supplier's
> catalogue. **A real NC program must always be checked by a qualified CNC programmer and proved out on the
> machine before it runs in production.**

---

## 1. Purpose

The machining centres are the heart of the compressor factory: HMC-01…03 machine the crankcases, VMC-01
bores the cylinders. Each part needs an **NC program** (G-code). This guide explains:

1. **What G-code is** and how a CNC controller reads it, line by line.
2. **How the CNC tab of the twin works**: a small CAM system (you describe the part, it writes the program),
   a simulated CNC controller (it checks the program and raises alarms like a real control), and a 3D
   preview that cuts a virtual block of material.
3. **The cutting-data formulas** (spindle speed, feed, metal removal rate, cutting power) with the example
   numbers of the twin.
4. **How to do it in the real factory**: CAM → post-processor → DNC transfer → program release and
   versioning → prove-out on the machine → tool presetting → tool life management.
5. **The science and the specification** (chapters 10–15): cutting physics with numbers, a detailed
   manufacturing specification of the example parts, numbering, standards, a complete worked example from
   drawing to first-part inspection, and the list of data you still need. (Chapter 9 is not used – the
   numbering follows the common chapter plan in `00_INDEX.md`; the Glossary is chapter 16.)

Why this matters: a wrong NC program can **break a tool, scrap a casting, damage the spindle or hurt
a person**. Most crashes come from a few simple mistakes (a rapid move into the part, a wrong tool length,
a missing decimal point). If your team understands these mistakes, it can find them before the machine does.

---

## 2. Where in the twin

Tab **CNC / G-code** (`#cnc`). File: `web/gcode.js`. Everything runs in the browser; nothing is sent to the
twin server. The only server call is `GET /api/config` to read the spindle power and the twin cycle time of
the selected machine (the tab also works without it).

Screen parts:

| Part | What you do there |
|---|---|
| **Example** | Load a template: *Cylinder VC20 – OP10* (VMC-01), *Crankcase VC20 – OP20* (HMC), *Empty program* |
| **Machine / Controller / Material** | Machine VMC-01, HMC-01, HMC-02, HMC-03; controller *Fanuc / Haas (ISO)* or *Siemens Sinumerik 840D*; material GG25, AlSi9Cu3, C45 |
| **Program no. / Name / line numbers N** | Program number (O-number on Fanuc), name, N-numbers on or off |
| **1. Stock** | Raw part size W × L × H and top allowance. X0 Y0 = centre, Z0 = finished top face |
| **Tool table** | Tool number T, type, diameter D, number of teeth z, thread pitch (taps) |
| **Operations** | Face milling, rectangular pocket, circular pocket (helical), outside contour, holes (drill / tap / bore) – each with its own fields and a calculation line |
| **Cutting-data formula box** | n, F, Q, Pc and time of the selected operation, with the numbers filled in |
| **G-code listing** | Coloured program; click a line to see what every word means; edit by hand; download `.nc` / `.MPF`; copy |
| **Controller messages** | ALARM, CRASH, WARNING, INFO with line number |
| **KPIs** | Cycle time, cutting time, rapid + tool change, program size, controller check, twin cycle time |
| **3D preview** | Play / pause, step line by line, scrub bar, speed, show tool path, X-ray, fit; DRO (position display) |

Your last setup is stored in the browser (`localStorage`), only on your PC.

**Deep links** (useful for training and for screenshots):

| Parameter | Meaning | Example |
|---|---|---|
| `gctpl=cc \| cyl \| empty` | load a template | `/?gctpl=cc#cnc` |
| `gcctrl=siemens \| fanuc` | controller dialect | `/?gctpl=cc&gcctrl=siemens#cnc` |
| `gcmach=HMC-01` (VMC-01, HMC-02, HMC-03) | machine | `/?gctpl=cc&gcmach=HMC-02#cnc` |
| `gct=55` | jump to 55 % of the program time | `/?gctpl=cc&gct=55#cnc` |
| `gcline=N` | select line N and explain it | `/?gctpl=cc&gcline=12#cnc` |
| `gcplay=20` | start playing at speed 20 | `/?gctpl=cyl&gcplay=20#cnc` |

Full example: `/?gctpl=cc&gcctrl=siemens&gcmach=HMC-01&gct=55&gcline=12#cnc`

Related: in the Communication tab (guide 07), step 12 of the simulation shows how the MES sends an NC
program to HMC-02 by OPC UA file transfer.

---

## 3. Concepts, simply

### 3.1 What is G-code?

G-code (standardised as ISO 6983, with many controller dialects) is a list of **blocks** (lines). Each block
has **words**: one letter (the *address*) and a number.

```
N30 G0 G90 G54 X-114.5 Y-37.95 S1010 M3
│   │  │   │   │       │       │     └ M3  = spindle on, clockwise
│   │  │   │   │       │       └ S1010    = spindle speed 1010 rpm
│   │  │   │   └───────┴ X, Y            = target position in mm from work zero
│   │  │   └ G54                         = use work offset no. 1
│   │  └ G90                             = absolute coordinates
│   └ G0                                 = rapid move (not cutting)
└ N30                                    = line number (only a label)
```

| Address | Meaning |
|---|---|
| **N** | line number (label only) |
| **O** | program number (Fanuc); the MES / DNC calls the program by it |
| **G** | preparatory function: motion type, plane, units, offsets, cycles |
| **M** | machine function: spindle, coolant, tool change, program end |
| **X Y Z** | target position (G90) or distance (G91) |
| **I J** | arc centre, measured from the arc start point |
| **R** | arc radius, or the R level in a drilling cycle |
| **Q** | peck depth (G83) |
| **F** | feed rate in mm/min |
| **S** | spindle speed in rpm |
| **T** | tool number; **M6** puts it in the spindle |
| **H** | tool length offset number (Fanuc, with G43) |
| **D** | tool offset number (Siemens: length and radius) |
| **K** | thread pitch (Siemens G331/G332) |

### 3.2 "Modal" – the controller remembers

Most codes are **modal**: they stay active until another code of the same group changes them. That is why
many lines are short:

```
N60 G1 X114.5 F758.     ← G1 and F758 are now active
N70 Y0.                 ← still G1, still F758: straight cut to Y0
N80 X-114.5             ← still G1, still F758
```

The simulator shows, after every line, the **controller state**: motion code (G0/G1/G2/G3/G80), plane
G17, G90/G91, work offset G54, tool length G43/G49 (Siemens: D1/D0), active cycle, return level
G98/G99, F, S, T, spindle direction, coolant.

**Danger of modal codes:** if a code from an earlier program (or from manual MDI input) is still active,
your program behaves differently. That is why every program starts with a **safe start block** (3.6).

### 3.3 The most important G and M codes (as explained in the twin)

| Code | Meaning |
|---|---|
| G0 | Rapid move at full machine speed, NOT cutting. Modal. |
| G1 | Linear feed: cut in a straight line at feed F. Modal. |
| G2 / G3 | Arc clockwise / counter-clockwise. I, J = centre from the start point. With Z = helix. |
| G4 | Dwell (wait). |
| G17 | XY plane for arcs (normal for milling). |
| G21 / G71 | Millimetres (Fanuc / Siemens). |
| G28 | Return to machine home. `G91 G28 Z0.` = straight up to home. |
| G40 | Cancel cutter radius compensation. |
| G41 / G42 | Cutter radius compensation left / right (not simulated). |
| G43 H.. | Tool length compensation on: Z now means the tool **tip**. |
| G49 | Cancel tool length compensation. |
| G54 | Work offset no. 1 (the operator measures it with a probe). |
| G80 | Cancel canned (drilling) cycle. |
| G81 | Drilling: rapid to R, feed to Z, rapid out. |
| G83 | Peck drilling: drill Q mm, pull out to R, go back, repeat until Z. |
| G84 | Tapping: feed in with F = S × pitch, spindle reverses at the bottom, feed out. |
| G85 | Boring: feed in and feed out again (good bore surface). |
| G90 / G91 | Absolute / incremental coordinates. |
| G98 / G99 | After each hole return to the initial level / only to R. |
| G331 / G332 | Siemens rigid tapping in / out (K = pitch). |
| M3 / M4 / M5 | Spindle CW / CCW / stop. |
| M6 | Tool change. |
| M8 / M9 | Coolant on / off. |
| M29 | Rigid tapping mode (Fanuc, before G84). |
| M30 | Program end, rewind. |

### 3.4 Coordinates, work zero and offsets

* **Machine zero** is fixed by the machine builder.
* **Work zero (G54)** is where the program's X0 Y0 Z0 is on the part. In the twin: X0 Y0 = **centre of the
  stock**, Z0 = **finished top face**. The stock top is above Z0 by the top allowance (for example +1 mm).
* **Tool length offset (H on Fanuc, D on Siemens)**: every tool has a different length. The control adds
  the measured length, so Z in the program means the **tool tip**. Wrong or missing offset = crash or air cut.

### 3.5 CAM, post-processor, controller

```
Part drawing / 3D model
   → CAM: choose operations, tools, cutting data → tool path (neutral)
   → Post-processor: translate the tool path into the dialect of ONE controller (Fanuc, Siemens …)
   → NC program file (.nc, .MPF)
   → DNC transfer to the machine
   → CNC controller reads block by block, moves the axes
```

The twin's CNC tab contains a **mini version of every step**: the operation cards are the CAM, the
Fanuc/Siemens switch is the post-processor, the simulator is the controller.

### 3.6 The safe start block

Fanuc output of the twin: `G21 G17 G40 G49 G80 G90` – mm, XY plane, no cutter compensation, no length
compensation, no cycle, absolute. Siemens output: `G17 G40 G90 G71`.

**Why:** these lines put the controller into a known state, whatever the previous program or the operator
left active. Then the tool change, then the first move with work offset, spindle and tool length:

```
N20 T1 M6
N30 G0 G90 G54 X-114.5 Y-37.95 S1010 M3      ← go to start position in XY first (high above the part)
N40 G43 H1 Z50. M8                            ← then length compensation and Z to safe height
```

---

## 4. The model in the twin: formulas and examples

### 4.1 Example machines (from `web/gcode.js`)

| Machine | Type | Max spindle | Rapid | Max feed | Spindle power | Tool change | Travel from work zero (X / Y / Z) |
|---|---|---|---|---|---|---|---|
| VMC-01 Cylinder Boring Center | vertical | 8 000 rpm | 30 m/min | 12 000 mm/min | 11 kW | 3 s | ±300 / ±200 / −350…+150 mm |
| HMC-01…03 Crankcase Machining Centers | horizontal | 10 000 rpm | 50 m/min | 20 000 mm/min | 18 kW | 2.5 s | ±365 / ±365 / −450…+200 mm |

(The spindle power is read from `run_power_kw` in `config/factory.json` when the server runs: 18 kW for the HMCs,
11 kW for VMC-01.) In the 3D view an HMC is shown with a horizontal tool axis, a VMC with a vertical one.

### 4.2 Example materials

| Material | kc (N/mm²) | Vc face / end mill / drill / tap / bore (m/min) | fz face / end / drill / bore (mm) |
|---|---|---|---|
| Cast iron GG25 (EN-GJL-250) | 1100 | 200 / 150 / 90 / 12 / 150 | 0.15 / 0.08 / 0.20 / 0.15 |
| Aluminium AlSi9Cu3 (die-cast) | 700 | 600 / 400 / 150 / 20 / 300 | 0.12 / 0.07 / 0.15 / 0.12 |
| Steel C45 (crankshaft steel) | 2000 | 180 / 120 / 70 / 10 / 140 | 0.12 / 0.06 / 0.12 / 0.10 |

kc = specific cutting force. These are example values for carbide tools. You can type your own Vc and fz in
each operation card; they override the table.

**Correction / warning about kc.** The twin uses **one fixed kc per material**. In reality kc depends on the
chip thickness h (Kienzle law, chapter 10.2): thin chips need a much higher kc. For the GG25 face-milling
example (h ≈ 0.1 mm) the Kienzle value is about 2 100 N/mm², not 1 100 – the twin's cutting power is
therefore **about 2 times too low** for typical finishing chip thicknesses. Use the twin's Pc only as a
lower bound and check the spindle power with chapter 10.

### 4.3 The operations (the small CAM)

| Operation | Tools allowed | Inputs | How the tool path is made |
|---|---|---|---|
| **Face milling** | face mill, end mill | depth per pass ap, step-over % of Ø | zig-zag passes over the whole stock, starting outside the part; levels from stock top down to Z0 |
| **Rectangular pocket** | end mill | centre, width, length, corner radius, top, depth, ap, ae % | plunge in the centre (plunge feed), then rounded-rectangle rings from inside to outside, level by level |
| **Circular pocket (helical)** | end mill | centre, Ø, top, depth, helix pitch = ap, ae % | enter with a **helix** (G3 with Z), one flat turn at the bottom of each level, then bigger circles outwards |
| **Outside contour** | end mill | rectangle (W, L, corner radius) or circle (Ø), top, depth, ap | lead-in from outside, climb-milling path around the part (tool centre = contour + tool radius), lead-out |
| **Holes** | twist drill, tap, boring bar | bolt circle (Ø, number, start angle) or point list, top, depth, peck Q | **G81** drill, **G83** peck drill (Q > 0), **G84** tap, **G85** bore |

Warnings the generator gives (examples from the code): wrong tool type for the operation; pocket too small
for the tool; corner radius smaller than the tool radius ("the corners will get radius R"); depth ≤ 0; stock
top allowance 0 ("nothing to face"); spindle speed limited by the machine; feed above the machine maximum;
cutting power above 80 % of the spindle power.

Drill depth includes the drill point: `tip = 0.3 × D` (118° point), so `Z = top − depth − tip`.

### 4.4 Cutting-data formulas with the twin's numbers

All examples: template **Crankcase VC20 – OP20** on **HMC-01**, material **GG25**.

**Spindle speed**

```
n = 1000 · Vc / (π · D)          [rpm]       Vc in m/min, D in mm

T1 face mill D63:  n = 1000 · 200 / (π · 63) = 1010 rpm
T2 end mill  D16:  n = 1000 · 150 / (π · 16) = 2984 rpm
T3 end mill  D12:  n = 1000 · 150 / (π · 12) = 3979 rpm
T4 drill    D8.5:  n = 1000 ·  90 / (π · 8.5) = 3370 rpm
T5 tap  M10×1.5:   n = 1000 ·  12 / (π · 10) =  382 rpm
```
If n is above the machine maximum, the twin uses the maximum and shows the real Vc = π · D · n / 1000.

**Feed**

```
Milling:  F = n · z · fz          T1: 1010 · 5 · 0.15 = 758 mm/min
                                  T2: 2984 · 4 · 0.08 = 955 mm/min
                                  T3: 3979 · 3 · 0.08 = 955 mm/min
Drilling: F = n · f               T4: 3370 · 0.20     = 674 mm/min
Tapping:  F = n · pitch           T5:  382 · 1.5      = 573 mm/min   (must be exact: 1 turn = 1 pitch)
Plunge (pockets, contour):  F_plunge = max(20, 0.3 · F)   T3: 0.3 · 955 = 287 mm/min
```

**Metal removal rate and cutting power (milling)**

```
Q  = ap · ae · F / 1000           [cm³/min]   ap, ae in mm, F in mm/min
Pc = Q · kc / 60 000              [kW]        kc in N/mm²

T1 face milling: ap = 1, ae = 0.70 · 63 = 44.1
   Q  = 1 · 44.1 · 758 / 1000   = 33.4 cm³/min
   Pc = 33.4 · 1100 / 60 000    = 0.61 kW
T2 contour (twin assumes ae = tool radius = 8): ap = 4
   Q  = 4 · 8 · 955 / 1000      = 30.6 cm³/min
   Pc = 30.6 · 1100 / 60 000    = 0.56 kW
T3 pocket: ap = 2.5, ae = 0.40 · 12 = 4.8
   Q  = 2.5 · 4.8 · 955 / 1000  = 11.5 cm³/min
   Pc = 11.5 · 1100 / 60 000    = 0.21 kW
```

**Drilling**

```
Q  = (π · D² / 4) · F / 1000      = (π · 8.5² / 4) · 674 / 1000 = 38.2 cm³/min
Pc = f · Vc · D · kc / 240 000    = 0.20 · 90 · 8.5 · 1100 / 240 000 = 0.70 kW
```

**Power check:** the twin warns if `Pc > 0.8 × spindle power` (HMC: 0.8 × 18 = 14.4 kW). Here all
operations are far below – the example is a light finishing part. (With the Kienzle correction of chapter
10.2 the powers roughly double – T1 1.18 kW, T2 1.27 kW, drilling 1.39 kW – still far below.) Note: Pc is the power **at the cutting
edge**; the motor must also cover the losses of the spindle drive.

**Time of one operation**

```
t = (path length at feed / F) · 60  +  rapid length / rapid speed · 60  +  tool changes

Example T1 face milling: 3 passes of 229 mm (X −114.5 → +114.5) + 2 step-overs of 37.95 mm
   cutting path = 3 · 229 + 2 · 37.95 = 762.9 mm
   t_cut = 762.9 / 758 · 60 = 60.4 s
```

Second example, template **Cylinder VC20 – OP10** on VMC-01 (GG25): face mill D63 n = 1010 rpm,
F = 758 mm/min; rough bore D51.5 at Vc 120, f 0.25 → n = 742 rpm, F = 186 mm/min; finish bore D52 at Vc 180,
f 0.12 → n = 1102 rpm, F = 132 mm/min; drill D6.8 → n = 4213 rpm, F = 843 mm/min; tap M8×1.25 → n = 477 rpm,
F = 477 × 1.25 = 596.25 mm/min.

### 4.5 Generated program – Fanuc / Haas (first lines, template *cc*)

```
%
O2001 (CC VC20 OP20)
(GENERATED BY THE DIGITAL TWIN - EXAMPLE VALUES, CHECK BEFORE USE)
(MACHINE HMC-01, MATERIAL CAST IRON GG25 EN-GJL-250)
(STOCK 160 X 120 X 60 MM - WORK ZERO: X0 Y0 = STOCK CENTRE, Z0 = FINISHED TOP FACE)
N10 G21 G17 G40 G49 G80 G90               ← safe start block
(OP1 FACE MILLING TOP SURFACE - T1 FACE MILL D63)
(T1 = FACE MILL D63)
N20 T1 M6                                 ← tool change
N30 G0 G90 G54 X-114.5 Y-37.95 S1010 M3   ← start point outside the part, spindle on
N40 G43 H1 Z50. M8                        ← length offset 1, safe height Z50, coolant on
N50 Z0.                                   ← rapid down to Z0 – still OUTSIDE the part in X
N60 G1 X114.5 F758.                       ← first face pass
N70 Y0.
N80 X-114.5
N90 Y37.95
N100 X114.5
N110 G0 Z3.
(OP2 OUTSIDE CONTOUR - T2 END MILL D16)
N120 Z50.
N130 M9
N140 M5
N150 G91 G28 Z0.                          ← Z home for the tool change
N160 G90
(T2 = END MILL D16)
N170 T2 M6
N180 G0 G90 G54 X88. Y0. S2984 M3
N190 G43 H2 Z50. M8
...
```

Note how every number has a decimal point (`Z50.`, `Y0.`) – see the decimal-point alarm in 4.7.

Holes in Fanuc are canned cycles (one line per hole, from the same template):

```
N... G98 G83 X-55. Y-38. Z-22.55 R2. Q5. F674.    ← peck drill: depth 20 + tip 2.55, peck 5 mm
N... X55. Y-38.
N... X55. Y38.
N... X-55. Y38.
N... G80
...
N... M29 S382                                      ← rigid tapping mode
N... G98 G84 X-55. Y-38. Z-16. R2. F573.           ← F = S × pitch = 382 × 1.5
```

End of program: `M9`, `M5`, `G91 G28 Z0.`, `G90`, `M30`, `%`.

### 4.6 Generated program – Siemens 840D (same part)

```
%_N_CC_VC20_OP20_MPF
;$PATH=/_N_MPF_DIR
; Generated by the digital twin - EXAMPLE values, check before use
; Machine HMC-01, material Cast iron GG25 (EN-GJL-250)
; Stock 160 x 120 x 60 mm - work zero: X0 Y0 = stock centre, Z0 = finished top face
N10 G17 G40 G90 G71
; OP1 Face milling (top surface) - T1 Face mill D63
; T1 = Face mill D63
N20 T1 M6
N30 G0 G90 G54 D1 X-114.5 Y-37.95 S1010 M3        ← D1 = tool offset (instead of G43 H1)
N40 Z50 M8
...
```

Differences Fanuc ↔ Siemens in the generated code:

| Item | Fanuc / Haas | Siemens 840D (in the twin) |
|---|---|---|
| File header | `%` + `O2001 (NAME)` | `%_N_NAME_MPF` + `;$PATH=/_N_MPF_DIR` |
| File name on download | `O2001.nc` | `CC_VC20_OP20.MPF` |
| Comments | `( ... )`, upper case | `; ...` |
| Units | G21 | G71 |
| Tool length | `G43 H1` | `D1` |
| Decimal point | always written (`Z50.`) | not needed (`Z50`) |
| Tool change home | `G91 G28 Z0.` | (not written) |
| Drilling cycles | G81 / G83 / G84 / G85 canned cycles | written out **move by move**, with the comment *"a real 840D would use CYCLE81/83/84/85 here"* |
| Tapping | `M29 S..` + `G84` | `SPOS=0`, `G331 Z.. K1.5 S382`, `G332 Z.. K1.5`, then `M3 S..` |

On a real 840D a CNC programmer would normally use the Siemens standard cycles (CYCLE81, CYCLE83, CYCLE84,
CYCLE85 …) and the tool management of the machine (tool names, `T="..."`). The twin writes the moves out so
that the simulator can show every single move.

### 4.7 The simulated controller and its alarms

The simulator (`interpret()`) reads the program block by block like a real control:

1. Removes comments, reads the words (address + number).
2. Executes the non-motion words in order: F, S, T, M6 (tool change: Z goes up to home first, takes
   2.5 s or 3 s), spindle, coolant, offsets, G codes.
3. Executes the motion: rapid, feed, arc (I/J or R), canned cycle at each XY position, Siemens tapping.
4. Checks every move against the machine travel and the **height-map stock**.
5. On an **ALARM** or **CRASH** it stops: *"Program stopped at line N by the alarm above. Lines after it
   were not executed."* Lines after it are greyed.

Message levels: **ALARM** (program stops), **CRASH** (program stops – on a real machine this is damage),
**WARNING** (runs, but check), **INFO**.

Below each alarm: a small **broken example** and the message text the simulator shows. To try them, load the
template **Empty program** (VMC-01, stock 100 × 80 × 40 mm, top allowance 1 mm, tool T1 = end mill D10),
click *Edit*, replace the code with the test header below plus the broken lines, then click *Run edited code*.

```
%
O1000 (TEST)
N10 G21 G17 G40 G49 G80 G90
N20 T1 M6
N30 G0 G90 G54 X0. Y0. S3000 M3
N40 G43 H1 Z50. M8
```

**1. Feed zero** – a cutting move without F

```
N50 Z2.
N60 G1 Z-2.              ← no F programmed in this program
```
> ALARM: *PS0011 FEED ZERO: a cutting move (G1/G2/G3) needs a feed rate F. Without F the control stops
> (Fanuc-style alarm number).*

**2. Spindle off while cutting**

```
N50 M5
N60 Z2.
N70 G1 Z-2. F300.        ← cuts 3 mm of material with the spindle stopped
```
> ALARM: *The tool cuts material but the spindle is NOT turning (M3 missing or M5 active). On a real machine
> the tool breaks.*

**3. Rapid into material (crash)**

```
N50 Z-5.                 ← G0 (still modal from N30) straight down into the stock (stock top is Z+1)
```
> CRASH: *rapid move (G0) into the material. Rapid moves must stay in the air - cut with G1 and a feed, or go
> up first.*

**Important – how the simulator checks this, and why the order matters.** For every rapid move the
simulator first checks the whole path against the material **left by the earlier moves**, and only
**after** that check does it "stamp" the cutter footprint into the height map (remove material).
If it stamped first, the rapid move would remove the material along its own path, and then the check would
find no material – the crash would be invisible. The check uses small tolerances so that a tool sliding past
an already-cut edge is not a false alarm (material must be more than 0.3 mm above the tool tip, below the stock
top, inside slightly less than the tool radius).

Real-factory lesson: the same logic applies in CAM verification software – a rapid move must be checked
against the **stock at that moment**, not against the finished part.

**4. Below the part bottom**

```
N50 Z2.
N60 G1 Z-42. F200.       ← stock is 40 mm high, bottom = 1 − 40 = Z−39
```
> CRASH: *the tool goes below the bottom of the part (Z-39) into the fixture / machine table.*

**5. Over-travel**

```
N50 G0 X400.             ← VMC-01 travel X is −300 … +300 mm from work zero (example)
```
> ALARM: *Over-travel X+: X400 is outside the machine travel (-300 … 300 mm from work zero, example). The axis
> stops at the soft limit.*

**6. Arc radius error**

```
N50 Z2.
N60 G1 Z-1. F300.
N70 G2 X10. Y0. I3. J0.  ← centre (3, 0): start radius 3 mm, end radius 7 mm
```
> ALARM: *PS0020 OVER TOLERANCE OF RADIUS: start radius 3 ≠ end radius 7. Check X/Y and I/J.*

With R instead of I/J the simulator also alarms if R is too small for the distance
(*"R… is too small for this arc"*) or if R is used for a full circle (*"use I/J"*).

**7. Missing decimal point (Fanuc)**

```
N50 G1 X100 F500.
```
> WARNING: *X100 has no decimal point. Many Fanuc controls read it as X0.1 (= 0.1 mm)! Write X100. to mean
> 100 mm.*

This is a warning in the simulator because the real behaviour depends on a controller parameter. On the
real machine it is one of the most common causes of wrong positions. **Rule: on Fanuc-type controls always
write the decimal point.**

**Other warnings and alarms in the simulator** (from the code):

| Message | Why it matters |
|---|---|
| Cutting without `G43 H` (Fanuc) | control does not know the tool length: crash or air cut |
| `G43 H2` used with tool T3 | wrong H = wrong tool length = crash |
| No tool in the spindle (T.. M6 missing) | the move cuts air |
| Spindle started without S | spindle at speed 0 or the last speed |
| Tapping: F should be S × pitch | otherwise the thread is damaged |
| Rigid tapping normally needs `M29 S..` before G84 (info) | Fanuc rigid tapping |
| G83 needs Q; cycles need Z and R | cycle cannot run |
| Drilling cycle with the spindle stopped | tool breaks |
| Axis move without an active motion code (after G80) | write G0 or G1 |
| F or S above the machine maximum – limited | program not as planned |
| G18/G19, inch (G20/G70), unsupported cycles (G73, G76, G82, G86–G89) | not simulated → alarm |
| G41/G42, G95 | not simulated → warning (preview shows the programmed path) |
| G55…G59 | treated like G54 (one work zero in the simulator) |
| Same address twice in one block | the last one is used |
| No M30 at the end | control stops at the last line without rewinding |

### 4.8 The 3D height-map stock

The stock is a grid of points; each point stores the **height of the material** there. When the tool moves,
the simulator stamps a circle (flat tool bottom, radius = tool radius) at the tool tip height: every grid
point inside the circle that is higher than the tool tip is lowered to the tip height.

* Grid cell for the checks: `max(0.8 mm, max(W, L) / 150)` – for the 160 × 120 stock: 1.07 mm.
* Grid cell for the picture: `max(0.35 mm, max(W, L) / 220)` – for the 160 × 120 stock: 0.73 mm.
* Colours: dark grey = raw material, light = machined surface; blue lines = feed moves still to come, grey =
  done; dashed orange = rapid moves.
* Tool shapes: face mill, end mill, drill with 118° cone, boring bar with insert, tap, all with holder.

Limits of this method: one height per XY point – no undercuts, no side holes in an HMC part, no fixture
model, the drill cone is not cut into the material (the depth includes the tip, but the picture shows a
flat bottom).

### 4.9 Program cycle time vs twin cycle time

The KPI row shows:

| KPI | Meaning |
|---|---|
| Cycle time (program) | sum of all moves: cutting at F, rapid at the machine rapid speed (HMC 50 m/min, VMC 30 m/min) **without acceleration**, tool changes (HMC 2.5 s, VMC 3 s each), dwells |
| Cutting time | time and path length at feed |
| Rapid + tool change | non-cutting time |
| Program | number of lines and operations, dialect |
| Controller check | OK / warnings / alarms |
| Twin cycle time (MES) | the cycle time the factory twin uses for this machine and model VC20, and the program time as % of it |

Twin values (from `config/factory.json`, example): VC20 has no model-specific times, so the station times are
used: **HMC 345 s**, **VMC-01 100 s**.

```
program share = program cycle time / twin cycle time · 100 %
```

**How to read it.** The templates are **simplified** parts (one operation group). The real crankcase needs
many more operations on several sides (the HMC rotary table turns the part). If the program share is small,
that is expected. In the real project use this comparison the other way round: when the real CAM programs
exist, put their **real** cycle times (from the prove-out, see chapter 5) into the twin configuration, and the
twin will show if the FMS cell still reaches the planned output. Remember that real cycle times are longer
than "no acceleration" calculations – typically by several percent, more for programs with many short moves.

---

## 5. Implementing in the real factory, step by step

### Step 1 – Decide the CNC process chain

```
3D model + drawing (with tolerances)
  → process plan (operations, clamping, tools)          [manufacturing engineer]
  → CAM programming + simulation with machine model     [CNC programmer]
  → post-processor (one per machine/controller type)    [CAM supplier / machine builder]
  → NC program file
  → program release (PDM / DNC server)                  [CNC programmer + quality]
  → DNC transfer to the machine                          [automatic, MES-triggered]
  → prove-out on the machine                             [setter + programmer]
  → series production with tool life management          [operator + tool room]
```

Points to decide early:

1. **One CAM system** for all machines, if possible.
2. **A verified post-processor per machine type** (HMC with controller X, VMC with controller Y). A
   post-processor must know the machine: axes, rotary table, tool change position, cycles, options.
   Buy it from the CAM supplier or the machine builder and **test it** (Step 4).
3. **Machine simulation in CAM** with the real machine model, fixture and clamps. The twin simulator checks
   only the stock; real collisions with fixtures, the spindle nose, the rotary table and the pallet are the
   most expensive crashes.
4. **Same controller family on the same machine type** keeps programs, training and spare parts simple.

### Step 2 – Write a programming standard

A written standard makes every program look the same, so every setter can read it. Example content:

* **Program number scheme**, e.g. `O2001` = crankcase VC20 OP20 in the twin. The project scheme of guide 15
  is `O<product><part><op/10>` → the same program is **`O2102`** in the real factory (chapter 12).
  Program name in the first comment.
* **Header comment**: part number, drawing revision, operation, machine, material, fixture, programmer, date,
  program revision.
* **Work zero definition** (where is G54 on the part, which probe cycle sets it).
* **Safe start block** at program start **and after every tool change** (the twin writes the start block once;
  many companies repeat the modal resets with each tool).
* **Tool change sequence**: retract Z, M9, M5, home, T.. M6, first XY move with G54, spindle, then G43 H.. Z
  safe height, coolant.
* **H number = T number** (the twin warns when they differ).
* **Clearance heights**: safe height (twin: 50 mm, or stock top + 20 mm), R level (twin: top + 2 mm), initial
  level for G98 (twin: top + 10 mm).
* **Decimal point always** on Fanuc-type controls.
* **Optional stop (M1)** after each tool for prove-out; **M30** at the end.
* **No hand-edited code in production** without a new revision (Step 5).

### Step 3 – Tool presetting

Every tool is measured **outside the machine** on a tool presetter (length and radius). Steps:

1. Assemble tool + holder; check run-out.
2. Measure length (and radius for milling cutters, boring bars) on the presetter.
3. Transfer the values to the machine: by network (presetter → DNC/tool server → controller), by an
   ID chip/RFID on the holder, or (least preferred) by typing. **Typing errors are a common crash cause**, so
   automatic transfer is strongly recommended.
4. On the machine the values go into the tool offset table: **H** (length) and **D** (radius) for Fanuc;
   **D** (tool edge data) for Siemens.
5. Verify the first time: touch-off or tool-setter probe in the machine, compare with the preset value.

Tool list per program: tool number, description, holder, length range, preset values, magazine pocket.
In the twin each HMC magazine holds the tool sets of **2 models**; the third model costs a **10-minute
tool-set exchange** (example, `tool_magazine.load_s = 600`). Plan presetting so that the next tool set is
ready **before** the changeover starts.

### Step 4 – Verify the post-processor

Before the first real part, test the post-processor with a **test program**:

1. Simple moves in all axes (+ and −), check direction and sign on the machine (dry run, in the air).
2. Arcs G2/G3 in all quadrants, helix.
3. Every canned cycle you use (drill, peck, tap, bore) – check R level, depth and return level.
4. Tool change, tool length offset, work offsets.
5. Rotary table moves (HMC) – direction and angle.
6. Compare the post output with your programming standard line by line.

Keep the test program; repeat it after every post-processor or controller software update.

### Step 5 – Program release and versioning

An NC program is a **controlled document**, like a drawing.

| Status | Who | Where | May run in production? |
|---|---|---|---|
| Draft | CNC programmer | CAM / DNC "work" folder | no |
| Prove-out | programmer + setter | DNC "test" folder, sent to one machine | only under prove-out rules (Step 6) |
| Released | programmer + quality approve | DNC "released" folder, read-only | yes |
| Blocked / obsolete | quality | archive | no |

Rules:

1. **Every change = new revision** (number in the file header comment and in the DNC database), with a reason.
2. **Changes made at the machine** (e.g. a feed change during prove-out) must be **sent back** to the DNC
   server and to the CAM model. Otherwise the next download overwrites the correction – or the CAM program
   is different from what runs.
3. **Compare** the program in the machine with the released file regularly (DNC "compare" function or a
   checksum).
4. **Link** program revision ↔ part number ↔ drawing revision ↔ fixture. The MES can then record which program
   revision made which serial number (traceability).

### Step 6 – DNC transfer

DNC (Distributed Numerical Control) = the server that stores programs and sends them to the machines.

| Method | When | Notes |
|---|---|---|
| Ethernet file transfer to the controller memory (FTP / shared folder / controller software) | modern controls | most common |
| OPC UA file transfer (FileType: Open → Write → Close) | when the controller supports it | the twin's Communication step 12 shows the messages |
| Drip-feed over RS-232 | very old controls, very long programs | slow; cable and baud settings must match |
| USB stick / memory card | emergency only | no version control; avoid in production |

MES integration (as in the twin): the MES knows which model comes next; it requests the right program
**revision** from the DNC server, sends it to the machine and sets the active program
(example: `Write HMC-02.ActiveProgram = "O1020"`). The machine reports back the active program and
revision, and the MES checks it before the part starts.

### Step 7 – Prove-out on the real machine

Use this sequence for **every new program and every changed program**. The twin simulator is a good first
check (Step 0), but it does **not** replace the prove-out.

0. **Desk check:** CAM machine simulation without collisions; simulator in the twin (or the controller's own
   graphic simulation) without alarms; programming standard checked; tool list complete.
1. **Setup check:** fixture correct, part clamped, **work offset G54 measured** (probe), all tools preset and
   offsets loaded, H/D numbers match the tool list, coolant, chips cleared.
2. **Graphic simulation on the control** (if available), with the real offsets.
3. **Dry run in the air:** shift the work offset in Z upwards (for example +50 mm, in a way your company
   defines and the setter documents) or run with no part, rapid override low (for example 25 %).
   Watch every tool change and every approach.
4. **Single block:** run the first part with **single block** on, the hand on **feed hold**, rapid override
   and feed override low. Before pressing Cycle Start for each block, read the **distance-to-go** display:
   does the remaining move match what you expect?
5. **First approach to the material:** slow down near the surface (feed override 10–25 %), check the real
   position against the program.
6. **First cut:** increase feed override step by step to 100 % while listening (chatter) and watching the
   spindle load.
7. **First-part inspection:** measure the first part completely (CMM or gauges) against the drawing. Correct
   wear offsets (not the program) for small size errors. Only change the program for real errors – and then
   go back to Step 5 (new revision).
8. **Record the real cycle time**, spindle load per tool, and any changes. Update the twin configuration
   with the real cycle time.
9. **Release:** quality signs the first-part report; the program status becomes *Released*.

Safety rules during prove-out:

* Only trained setters. Doors closed. Nobody inside the machine guard.
* **Never bypass** door interlocks or safety functions for a prove-out.
* Know where the **emergency stop** and **feed hold** are – hand near them.
* One person at the control, one person responsible for the decision to continue.

### Step 8 – Tool life management

1. **Define tool life** for each tool: number of parts, minutes in cut, or metres of path (start values from
   the tool supplier, then from your own experience).
2. **Use the controller's tool life function** (counter per tool, pre-warning, end of life).
3. **Sister tools:** a second identical tool in the magazine; at end of life the control switches
   automatically.
4. **Breakage detection:** tool-setter probe or laser after critical small tools (drills, taps), or spindle
   load monitoring.
5. **Feedback to the twin / MES:** report tool changes and tool life to the MES. Example from the twin:
   `tool_wear_per_part_pct = 0.45` for the HMCs means one tool reaches 100 % wear after about
   `100 / 0.45 ≈ 222` parts (example value).
6. **Tool room planning:** tools to regrind or replace per shift = parts per shift / tool life.

### Step 9 – Connect the machines to MES and twin

* Machine state, active program, part counter, spindle load, alarms: OPC UA (for example OPC UA for Machine
  Tools) or MTConnect, see guide 07.
* Program download: DNC / OPC UA file transfer, triggered by the MES.
* Feed the real cycle times and tool life data back into the twin to keep the capacity model correct.

---

## 6. Checklists

### 6.1 Program checklist (before the first run)

- [ ] Correct part number, drawing revision, operation, machine in the header.
- [ ] Safe start block (G21/G71, G17, G40, G49, G80, G90 or the company standard).
- [ ] Every tool change: retract, M9, M5, home, T.. M6, G54 XY, S.. M3, G43 H.. (H = T) / D1, safe Z, M8.
- [ ] All tools in the tool list with preset values; H/D numbers match.
- [ ] Spindle speed and feed within the machine limits; tapping F = S × pitch.
- [ ] Cutting power below about 80 % of the spindle power (twin warning rule).
- [ ] Rapid moves only in the air; approach heights correct (safe height, R level, initial level).
- [ ] Deepest Z above the fixture / table; all positions inside the travel.
- [ ] Arcs checked (start radius = end radius).
- [ ] Decimal points on all coordinates (Fanuc-type controls).
- [ ] M30 at the end.
- [ ] CAM machine simulation and controller/twin simulation without alarms.

### 6.2 Prove-out checklist

- [ ] Fixture and part clamped, G54 measured and recorded.
- [ ] Tool offsets loaded and checked (first tool touch-off or probe).
- [ ] Graphic simulation on the control.
- [ ] Dry run in the air with low rapid override.
- [ ] Single block, feed hold ready, distance-to-go checked.
- [ ] Feed override increased step by step.
- [ ] First part measured completely; report signed.
- [ ] Real cycle time and spindle loads recorded.
- [ ] Changes sent back to DNC/CAM, new revision, released.

### 6.3 Factory setup checklist

- [ ] Programming standard written and trained.
- [ ] Post-processor per machine type tested with the test program.
- [ ] DNC server with folders Draft / Test / Released / Archive and access rights.
- [ ] Tool presetter with automatic data transfer.
- [ ] Tool life limits and sister tools defined.
- [ ] MES ↔ DNC ↔ machine program selection tested (right revision for the right model).
- [ ] Backups of all controller parameters and programs.

---

## 7. Common mistakes

| Mistake | What happens | How to avoid it |
|---|---|---|
| Rapid move (G0) into the part | crash, broken tool, spindle damage | approach above the part, then G1; CAM/twin simulation |
| Missing decimal point on Fanuc (`X100`) | axis goes to 0.1 mm instead of 100 mm | always write `X100.`; post-processor setting |
| No G43 H or wrong H number | control uses wrong tool length → crash or air cut | H = T rule; check the tool list |
| Spindle off (M5) or no M3 before cutting | tool breaks | start block per tool; simulator alarm |
| Feed F missing in the first G1 | alarm (or last feed from an old program!) | feed in the first cutting block of every tool |
| Tapping feed not equal to S × pitch | thread damaged, tap breaks | F = n · pitch; rigid tapping (M29 / G331) |
| Old modal state from MDI or previous program | unexpected incremental move, active cycle | safe start block |
| Z deeper than the part bottom | tool cuts fixture / table | check deepest Z; drill tip 0.3 × D included |
| Arc end point does not match centre | radius alarm on the control | let CAM write arcs; check I/J |
| Corrections made at the machine but not returned to DNC | next download brings the old error back | revision rule; DNC compare |
| Typing tool offsets by hand | wrong length/radius | automatic presetter transfer |
| Wrong program revision for the model | scrap series | MES checks program + revision before start |
| Prove-out at 100 % feed and rapid | no time to react | single block, low overrides |
| Cycle time from CAM without acceleration | capacity too optimistic | measure real cycle time; update the twin |
| Trusting a simulator that has no fixture model | collision with clamps | full machine simulation in CAM |

---

## 8. Limits of the twin's CNC tab

* **Example data only:** machines, tools, materials (Vc, fz, kc) and limits are examples.
* **3 axes, XY plane only.** No rotary table (B-axis) of the HMC, no multi-side machining, no G18/G19.
* **No cutter radius compensation** (G41/G42 are only warned; the preview shows the programmed path).
* **One work offset** (G55–G59 treated like G54); no inch programs; G95 feed per revolution not simulated.
* **Canned cycles:** only G81, G83, G84, G85 (Fanuc). On Siemens the cycles are written out move by move;
  real Siemens CYCLE81…85 and tool management are not used.
* **Height-map stock:** one height per XY point – no undercuts, no side features, flat tool bottom, no drill
  cone in the material. No fixture, clamp, spindle-nose or machine collision check.
* **Times without acceleration and jerk**; tool change time fixed; no pallet change, no probing time.
* **Cutting power** is a simple estimate (no tool wear, no edge geometry, no spindle efficiency).
* **The generator is not a real CAM system:** no rest machining, no adaptive/trochoidal paths, no
  finishing allowance strategy, no tool deflection check.
* **The simulator is not a real controller:** real controls have many more alarms, parameters and options.
  A program without alarms in the twin can still be wrong on the machine.
* **Physics not modelled:** one fixed kc (no Kienzle chip-thickness effect, power about 2 × too low for thin
  chips), no tool life (Taylor), no surface roughness, no tool deflection, no chatter, no thermal growth.
  Chapter 10 shows how to check these by hand.

---

## 10. Science principles

The formulas of chapter 4 (n, F, Q, Pc) are bookkeeping. This chapter explains the **physics** behind
cutting, so you can judge cutting data, tools, fixtures and accuracy yourself. Generic tables are in
`14_engineering_reference_data.md`; values for our parts are given here.

### 10.1 Chip formation and chip thickness

The cutting edge pushes the material until it **shears** off along a thin shear plane and slides up the
rake face as a chip. Almost all cutting energy becomes **heat** (shear zone + friction on the rake face).

| Material | Chip type | What it means |
|---|---|---|
| Steel C45, 16MnCr5, 42CrMo4 | continuous (long) chip | needs a chip breaker geometry and feed high enough to break chips |
| Hardened / high-strength steel | segmented chip | high, pulsing forces |
| Grey cast iron EN-GJL | discontinuous (short, crumbly) – graphite flakes break the chip | easy chips, but dust; abrasive wear |
| Aluminium AlSi | continuous, sticky | built-up edge at low vc → use high vc, sharp positive edges, polished tools |

The **chip thickness h** decides the force per mm of edge. It is not the feed:

| Process | Formula | Example |
|---|---|---|
| Turning, face milling (cutter centred, ae ≥ ≈ 0.5·D) | h ≈ f · sin κ (turning) / h ≈ fz · sin κ | face mill κ = 45°, fz = 0.15 → h ≈ 0.106 mm |
| Side milling with small ae (exact mean value) | hm = 360 · sin κ · ae · fz / (π · D · φs), φs = arccos(1 − 2·ae/D) in degrees | end mill D16, κ 90°, ae 1.6 (10 %), fz 0.08: φs = 36.9°, hm = 46.08 / 1 853 = **0.025 mm** |
| Approximation for ae/D ≤ 0.3 | hm ≈ fz · √(ae/D) | 0.08 · √0.1 = 0.025 mm |

**Chip thinning:** with small ae the chip is much thinner than fz. If h becomes smaller than the edge
radius (≈ 0.02–0.05 mm for coated carbide) the edge **rubs** instead of cutting → heat, wear, bad surface.
Rule: for small ae increase fz so that hm reaches the value the supplier recommends (example: hm 0.05 mm
at ae 10 % → fz ≈ 0.16 mm).

### 10.2 Specific cutting force – the Kienzle law

```
kc = kc1.1 · h^(−mc)        [N/mm²]     h in mm
Fc = kc · b · h = kc1.1 · b · h^(1 − mc)   b = width of cut (turning: b = ap / sin κ, so b·h = ap·f)
```

kc1.1 = specific cutting force at h = 1 mm and b = 1 mm; mc = slope (thin chips need more force per mm²).

| Material | kc1.1 (N/mm²) | mc | kc at h = 0.1 mm | kc at h = 0.3 mm |
|---|---|---|---|---|
| C45 (normalised, ≈ 600–650 MPa) | ≈ 1 450–1 500 | ≈ 0.25–0.27 | ≈ 2 600–2 800 | ≈ 2 000 |
| 42CrMo4 (QT, ≈ 1 000 MPa) | ≈ 1 550–1 800 | ≈ 0.21–0.26 | ≈ 2 800–3 200 | ≈ 2 200–2 400 |
| 16MnCr5 (+FP) | ≈ 1 400 | ≈ 0.30 | ≈ 2 800 | ≈ 2 000 |
| EN-GJL-250 (GG25) | ≈ 1 100–1 150 | ≈ 0.25–0.28 | ≈ 2 000–2 100 | ≈ 1 500–1 600 |
| AlSi9Cu3 (die cast) | ≈ 650–800 | ≈ 0.25 | ≈ 1 150–1 400 | ≈ 900–1 000 |

These are **typical textbook / catalogue values** (sources differ by about ±15 %). Corrections: about
−1 to −1.5 % per degree more rake angle; worn tool **+20 to +40 %**; low vc higher. Use the tool supplier's
values when you have them.

### 10.3 Cutting force, power and torque

| Quantity | Formula | Units |
|---|---|---|
| Cutting force (turning) | Fc = kc · ap · f | N |
| Cutting power | Pc = Fc · vc / 60 000 | kW (Fc in N, vc in m/min) |
| Milling power | Pc = ap · ae · vf · kc / (60 · 10⁶) = Q · kc / 60 000 | kW (Q in cm³/min) |
| Spindle torque | M = Pc · 9 550 / n | N·m (Pc in kW, n in rpm) |
| Motor power needed | P_motor = Pc / η, η ≈ 0.75–0.85 | kW |
| Feed force / passive force | roughly 0.3–0.6 · Fc (depends on κ, wear) | N – needed for fixture design |

The twin's crankcase OP20 with Kienzle (GG25, kc1.1 = 1 150, mc = 0.26):

| Tool | Chip thickness | kc | Q (from 4.4) | Pc Kienzle | Pc twin | Torque |
|---|---|---|---|---|---|---|
| T1 face mill D63, κ 45°, ae 44.1, fz 0.15 | φs = 2·arcsin(44.1/63) = 88.9° → hm = 360·0.707·44.1·0.15 / (π·63·88.9) = 0.096 mm | 2 116 N/mm² | 33.4 cm³/min | **1.18 kW** | 0.61 kW | 1.18 · 9 550 / 1 010 = **11.2 N·m** |
| T2 end mill D16 contour, ae 8, fz 0.08 | φs = 90° → hm = 360·8·0.08 / (π·16·90) = 0.051 mm | 2 494 N/mm² | 30.6 | **1.27 kW** | 0.56 kW | 4.1 N·m |
| T3 end mill D12 pocket, ae 4.8 | φs = 78.5° → hm = 0.047 mm | 2 551 N/mm² | 11.5 | **0.49 kW** | 0.21 kW | 1.2 N·m |
| T4 drill D8.5, f 0.20, point 118° | h = f/2 · sin 59° = 0.086 mm | 2 178 N/mm² | – | Pc = f·vc·D·kc / 240 000 = **1.39 kW** | 0.70 kW | **3.9 N·m** |

Example turning (worm, guide 12, 14.3): 16MnCr5, ap 2, f 0.3, vc 200, κ 95° → h = 0.299 mm,
kc = 1 400 · 0.299^−0.30 = 2 010 N/mm², Fc = 2 010 · 2 · 0.3 = 1 206 N, Pc = 4.0 kW, torque at Ø65 = 39 N·m.

### 10.4 Tool life – Taylor's law v · T^n = C

Tool wear grows much faster than the cutting speed. Taylor found a straight line in a log–log plot:

```
vc · T^n = C        T = tool life in minutes in cut
```

| Tool material | n (typical) |
|---|---|
| HSS | 0.10–0.15 |
| Carbide (coated) | 0.20–0.30 |
| Ceramics, CBN | ≈ 0.4–0.7 |

Example (carbide, n = 0.25): a test gives T = 15 min at vc = 200 m/min → C = 200 · 15^0.25 = **393.6**.

| vc (m/min) | T = (C / vc)^(1/n) | Change |
|---|---|---|
| 160 | (393.6/160)⁴ = **36.6 min** | −20 % speed → 2.4 × life |
| 200 | 15 min | reference |
| 250 | (393.6/250)⁴ = **6.1 min** | +25 % speed → only 41 % of the life |

**Economic tool life** (classic Taylor economics): T_econ = (1/n − 1) · (t_change + K_edge / K_machine).
Example: n = 0.25, edge change 1 min, edge cost 6 $, machine rate 1.5 $/min (90 $/h, example) →
T_econ = 3 · (1 + 4) = **15 min**. Expensive machine → shorter tool life (faster cutting) pays; expensive
tools → slower cutting. In production you then set the tool life counter (guide 08 Step 8) in parts:
T / cutting time per part.

### 10.5 Surface roughness – Rth = f² / (8 · r)

A turning or boring insert with corner radius r leaves scallops with the height:

```
Rth = f² / (8 · r)        (theoretical peak-to-valley, ≈ Rz)        Ra ≈ Rth / 4
```

| Rth in µm | f = 0.10 | f = 0.15 | f = 0.20 | f = 0.30 mm |
|---|---|---|---|---|
| r = 0.4 mm | 3.1 | 7.0 | 12.5 | 28.1 |
| r = 0.8 mm | 1.6 | 3.5 | 6.3 | 14.1 |
| r = 1.2 mm | 1.0 | 2.3 | 4.2 | 9.4 |

Inverse use: required Ra 0.8 → Rth ≈ 3.2 µm → with r = 0.8: f = √(8 · r · Rth) = √(8 · 0.8 · 0.0032)
= **0.14 mm**. Example cylinder bore (11.4): fine boring f = 0.12, r = 0.8 → Rth = 2.25 µm, Ra ≈ 0.56 µm ✓;
with r = 0.4 → Ra ≈ 1.1 µm ✗. Real roughness is higher than Rth with vibration, built-up edge, worn
edges or too small feeds (rubbing). Wiper inserts allow about 2 × feed for the same Ra.

### 10.6 Heat and thermal effects

In dry steel turning roughly 75–80 % of the heat leaves with the chip, 10–20 % goes into the tool and
5–10 % into the part (typical figures). Rake face temperatures of 600–1 000 °C are normal at high vc –
this drives crater and diffusion wear (Taylor). For accuracy the **part, machine and tool growth** matter:

| Example | ΔL = α · L · ΔT | Result |
|---|---|---|
| Cast iron crankcase 160 mm, 8 K warm after dry machining | 10.5·10⁻⁶ · 160 · 8 | **13 µm** |
| Aluminium part 300 mm, 5 K warm | 23·10⁻⁶ · 300 · 5 | **35 µm** |
| Spindle growth during warm-up (typical, measure your machine) | – | 10–30 µm in Z |

Consequences: measure at 20 °C (ISO 1) or correct for temperature; warm-up programme before precision
work; constant coolant temperature; for tight tolerances finish after the part has cooled, or probe
in-process.

### 10.7 Stiffness, deflection and chatter

**Static deflection** of an end mill (cantilever): δ = F · L³ / (3 · E · I), I = π · d_e⁴ / 64 with the
effective core diameter d_e ≈ 0.8 · D for a fluted cutter.

Example: D16 solid carbide (E ≈ 600 000 N/mm²), d_e = 12.8 mm → I = 1 318 mm⁴; overhang L = 50 mm;
radial force F ≈ 500 N (contour T2, from Pc: Fc = 1 270 · 60 / 150 ≈ 510 N):
δ = 500 · 50³ / (3 · 600 000 · 1 318) = **0.026 mm**. Overhang 60 mm → (60/50)³ = 1.73 × → 0.046 mm.
A steel extension (E = 210 000) would bend 2.9 × more. **Overhang is cubed – keep it short.** In
climb milling of an outside contour the tool bends away from the wall → the part becomes **too big**
(worked example 14.6).

**Chatter (regenerative vibration):** the tool vibrates, leaves a wavy surface, and the next tooth cuts
that wave again → the vibration grows. For one dominant vibration mode (stiffness k, damping ratio ζ),
the depth of cut that is stable at **every** spindle speed is approximately

```
b_lim ≈ 2 · k · ζ · (1 + ζ) / Ks          Ks = specific cutting force ≈ kc
```

Example: k = 20 N/µm = 2·10⁷ N/m, ζ = 0.03, Ks = 2 000 N/mm² = 2·10⁹ N/m² →
b_lim = 2 · 2·10⁷ · 0.03 · 1.03 / 2·10⁹ = 6.2·10⁻⁴ m ≈ **0.6 mm** (single edge, simple orientation).
Above this, chatter appears at some speeds; between the "stability lobes" (when the tooth-passing frequency
is close to the natural frequency divided by an integer) much larger depths are stable.
Practical cures: shorter overhang, stiffer holder (shrink-fit, HSK), change the spindle speed by 10–20 %
(towards a stable lobe), smaller ap/ae, variable-pitch cutters, better clamping / damping.

### 10.8 Accuracy chain (error budget)

A feature position on the part is the sum of many small errors. If they are independent, add them by
**root-sum-square (RSS)**; the worst case is the plain sum.

Example: position tolerance Ø0.02 (radius 10 µm) for the M10 holes relative to the bore on an HMC:

| Error source | µm (example) |
|---|---|
| Machine positioning (ISO 230-2 A value over the short distance) | 4 |
| Thermal drift of machine and part | 4 |
| Pallet / zero-point repeatability (guide 09) | 3 |
| Fixture + clamping deformation | 3 |
| Tool deflection + wear | 3 |
| Work-offset probing (G54) | 2 |
| **RSS** = √(16 + 16 + 9 + 9 + 9 + 4) | **7.9 µm** ≤ 10 ✓ |
| Worst case sum | 19 µm ✗ |

Meaning: the process normally meets the tolerance, but not with all errors at the limit at the same time
→ first-part inspection and SPC are needed. Measuring rules (10:1 rule, gauge R&R, decision rules with
uncertainty, Abbe principle) are explained in guide 12, chapter 10.9–10.10; the same rules apply to CNC
parts. Example: Ø52 H7 bore (T = 30 µm) → gauge resolution ≤ 3 µm (bore gauge 1 µm or air plug).

---

## 11. Detailed manufacturing specification

The two twin templates are **simplified** compressor parts. Below they are written as an **example
specification** that you can transfer to a drawing. The compressor designer must approve every value
(gasket faces, bore finish and the piston/ring design decide the real numbers). General tolerances:
ISO 2768-mK (example). Large generic tables: `14_engineering_reference_data.md`.

### 11.1 Materials of the machined compressor parts

| Part | Material | No. | Standard | Rm (MPa) | Rp0.2 (MPa) | Hardness | Note |
|---|---|---|---|---|---|---|---|
| Crankcase, cylinder (twin "GG25") | EN-GJL-250 | EN-JL1040 | EN 1561 | ≥ 250 (separately cast test bar; lower in thick walls) | – (no yield) | ≈ 180–230 HB, depends on wall thickness – agree with foundry | good damping, short chips |
| Alternative die-cast part | EN AC-AlSi9Cu3(Fe) | EN AC-46000 | EN 1706 | ≈ 240 (die cast, typical min.) | ≈ 140 | ≈ 80 HB | check the EN 1706 table |
| Crankshaft (twin "C45") | C45+QT | 1.0503 | EN 10083-2 | 650–800 (16 < d ≤ 40) | ≥ 430 | ≈ 200–240 HB | or 42CrMo4+QT for higher load |
| Crankshaft, high load | 42CrMo4+QT | 1.7225 | EN 10083-3 | 1 000–1 200 (16 < d ≤ 40) | ≥ 750 | ≈ 300–360 HB | |
| Fixture plates | S355J2 or C45 | 1.0577 / 1.0503 | EN 10025-2 / EN 10083-2 | ≥ 470 / see above | ≥ 355 | – | stress relieve welded fixtures |
| Locating pins / rest pads | 16MnCr5 case hardened or 100Cr6 | 1.7131 / 1.3505 | EN 10084 / ISO 683-17 | – | – | 58–62 HRC | replaceable wear parts |

Order castings and bars with a 3.1 certificate (EN 10204).

### 11.2 Machining parameters (example starting values, coated carbide; your tool supplier decides)

| Material (ISO group) | Face milling vc / fz / ap | End milling (side) vc / fz / ae | Drilling (carbide) vc / f | Tapping vc | Fine boring vc / f / ap |
|---|---|---|---|---|---|
| EN-GJL-250 (K) | 200–250 / 0.15–0.25 / 1–4 (finish 0.3–0.5) | 150–200 / 0.06–0.10 / ≤ 0.5·D | 80–110 / 0.20–0.30 | 10–15 | 150–200 / 0.08–0.15 / 0.1–0.3 |
| AlSi9Cu3 (N) | 500–1 500 / 0.10–0.20 / 1–4 | 300–800 / 0.05–0.12 | 150–250 / 0.15–0.30 | 15–25 | 300–600 / 0.05–0.12 / 0.1–0.3 |
| C45+N / 16MnCr5+FP (P) | 180–250 / 0.12–0.20 / 1–3 | 120–180 / 0.05–0.08 | 70–100 / 0.12–0.20 | 8–12 | 140–200 / 0.06–0.12 / 0.1–0.3 |
| 42CrMo4+QT ≈ 1 000 MPa (P) | 120–180 / 0.10–0.18 / 1–3 | 90–140 / 0.04–0.07 | 50–80 / 0.10–0.18 | 5–8 | 100–150 / 0.05–0.10 / 0.1–0.2 |

The twin's values (4.2) are inside these ranges. Remember chip thinning (10.1): the fz values are for
ae ≥ 0.5·D; with smaller ae raise fz.

### 11.3 Crankcase VC20 – OP20 (template *cc*): drawing VC-PRD-CC-0020-C, program O2102

Features as in the twin template (stock 160 × 120 × 60, work zero = stock centre, Z0 = finished top face):

| No. | Feature | Specification (example) | Numeric limits | Method / gauge | Frequency |
|---|---|---|---|---|---|
| 1 | Top face (datum A) | flatness 0.03; Ra ≤ 3.2 (gasket face: Ra per gasket maker, often 1.6–3.2) | – | CMM or surface plate + dial gauge; roughness tester | first part, then 1/shift |
| 2 | Outside contour 140 × 100, R10 | 140 ±0.05 / 100 ±0.05; depth 12 ±0.1 | 139.95–140.05 / 99.95–100.05 | micrometer / caliper 0.01 (10:1 rule: T = 0.10 → resolution ≤ 0.01) | first part, 1/20 |
| 3 | Pocket 80 × 50, R8 | 80 +0.1/0, 50 +0.1/0; depth 10 ±0.05 | 80.00–80.10 / 50.00–50.10 | inside micrometer / CMM; depth gauge | first part, 1/20 |
| 4 | Bore Ø36 (helical milled), datum B | Ø36 H8; ⟂ to A 0.02 | 36.000–36.039 | bore gauge 0.001 / air plug | first part, 1/10 |
| 5 | 4 × M10 at (±55, ±38) | M10-6H, full thread depth ≥ 16; drill Ø8.5 depth 20 + point; position Ø0.2 to A, B | – | thread plug gauge GO/NO-GO (ISO 1502 gauges); CMM for position | GO/NO-GO 100 % first lot, then 1/10 |
| 6 | Edges | ISO 13715: external −0.2…−0.5, no burrs; thread entry countersink 90° × Ø11 | – | visual | 100 % |
| 7 | Cleanliness | no chips in threads / pockets | – | visual, washer | 100 % |

Machining parameters for this part = the twin values (4.4) with the Kienzle powers of 10.3.

**Tool list – O2102 (tool numbers per guide 15, `T<family><nnn>`; examples):**

| Pocket in program | Tool no. | Description | Holder (HMC: check your spindle interface, e.g. HSK-A63 or SK40) | Ø / z | vc / fz |
|---|---|---|---|---|---|
| T1 | T3063 | Face mill Ø63, 45°, 5 inserts, K grade (ISO 513 K10–K20) | arbor | 63 / 5 | 200 / 0.15 |
| T2 | T2016 | Solid carbide end mill Ø16, 4 flutes | shrink-fit chuck, overhang ≤ 50 mm | 16 / 4 | 150 / 0.08 |
| T3 | T2012 | Solid carbide end mill Ø12, 3 flutes | shrink-fit chuck | 12 / 3 | 150 / 0.08 |
| T4 | T1085 | Carbide drill Ø8.5, internal coolant | hydraulic / shrink chuck | 8.5 / 2 | 90 / 0.20 |
| T5 | T4010 | Machine tap M10 – 6H, for cast iron (straight flute) | tapping chuck / rigid | 10 / – | 12 / pitch 1.5 |

In the program the **pocket / T word** is a magazine position; the **tool number** (T3063 …) is the
identity in tool management (random tool change, guide 15).

### 11.4 Cylinder VC20 – OP10 (template *cyl*): drawing VC-PRD-CYL-0020-A (example), program O2201

| No. | Feature | Specification (example) | Numeric limits | Method / gauge |
|---|---|---|---|---|
| 1 | Top face (datum A) | flatness 0.02; Ra ≤ 1.6 | – | CMM / surface plate; roughness tester |
| 2 | Cylinder bore Ø52 (datum B) | Ø52 H7 after fine boring; cylindricity 0.010; ⟂ to A 0.02; Ra ≤ 0.8 (if the design asks for honing: honing allowance and plateau-honed profile per piston/ring supplier) | 52.000–52.030 | air plug or bore gauge 0.001 with setting ring; GO/NO-GO plug GA-PLG-0045 (Ø52 H7); CMM for form |
| 3 | Bore entry | chamfer 1 × 30° (piston rings slide in without damage) | – | visual / gauge |
| 4 | 4 × M8 on PCD 80, start 45° | M8-6H, full thread ≥ 12; drill Ø6.8 depth 16 + point; position Ø0.2 to A, B | – | thread plug gauge; CMM |

Cutting data cylinder (twin): rough bore Ø51.5 vc 120, f 0.25; finish bore Ø52 vc 180, f 0.12 with
**r = 0.8 insert** (10.5 → Ra ≈ 0.56 µm); finish allowance 0.25 mm on the radius.

Tool list O2201: T3063 face mill Ø63 · T5051 rough boring bar Ø51.5 · T5052 fine boring head Ø52 (guide
15 example number) · T1068 drill Ø6.8 · T4008 tap M8.

### 11.5 Fixture concept (crankcase on the HMC)

* **3-2-1 location:** 3 points on the bottom (primary datum), 2 on a long side, 1 on the end. For the raw
  casting use **datum targets** on cast pads agreed with the foundry (ISO 5459); from OP20 on, use the
  machined face + 2 holes (one round pin, one diamond pin, holes Ø10 H7 = 10.000–10.015).
* **Clamp towards the locators**, directly above the supports, so the cutting force pushes the part into
  the locators and the clamp does not bend the part.
* Clamp force if only friction holds (worst case): F_clamp ≥ S · F_cut / μ. Example face milling:
  F_cut = 2 · M / D = 2 · 11.2 / 0.063 = 355 N; S = 2.5; μ = 0.15 → F_clamp ≥ **5 900 N** (total).
* Hydraulic clamping on the pallet (guide 09), pressure monitored; fixture drawing VC-MCH-FIX-0014-A
  (guide 15 example).
* Fixture bolts ISO 4762 10.9/12.9, torques for μ = 0.12 in guide 12, 11.9 (e.g. M10-10.9: 73 N·m,
  M12-10.9: 125 N·m).

### 11.6 Drawing notes – template for machined castings (copy, then adapt)

```
1  General tolerances ISO 2768-mK. Tolerancing ISO 8015.               [example]
2  Dimensions in mm at 20 °C (ISO 1).
3  Surface texture ISO 21920-1; unspecified machined surfaces Ra 6.3.
4  Edges ISO 13715: external −0.2…−0.5, internal +0.2; free of burrs and chips.
5  Material EN-GJL-250 (EN 1561), hardness 180–230 HB at position X. Certificate EN 10204-3.1.
6  Threads ISO 965-1, 6H; usable full thread length as dimensioned.
7  Casting datums: datum targets A1–A3, B1–B2, C1 (ISO 5459) – see view Y.
8  No porosity > 0.5 mm on sealing surfaces and in bores (agree with foundry).
9  Part clean: residual dirt per cleanliness specification (to be defined).
10 Mark serial (Data Matrix + plain text) at position Z.
```

---

## 12. Identification and numbering

The project scheme is in `15_numbering_and_identification.md` (guide 15 wins if anything differs). Applied
to CNC parts and programs:

| Object | Format | Example | Note |
|---|---|---|---|
| Drawing | `VC-<area>-<group>-<4 digits>-<rev>` | VC-PRD-CC-0020-C (crankcase VC20, machined) | area PRD = product; revisions skip I, O, Q, S, X, Z |
| MAKE part number | drawing number without revision | VC-PRD-CC-0020 | revision is a separate ERP field |
| Bought casting | ERP item | CC20-CAST | from `config/factory.json` |
| Own lot of castings | `LOT-<item prefix>-<YYWW>-<3 digits>` | LOT-CC20-2546-003 | + foundry batch / heat as on the 3.1 certificate |
| Product serial (on the crankcase) | `<type>-<YYWW>-<5 digits>`, sequence restarts every ISO week | VC20-2546-00123 | marked at the load station, Data Matrix + text |
| NC program | `O<product><part><op/10>` | **O2102** = VC20 · crankcase · OP20; O2201 = VC20 · cylinder · OP10 | twin uses O2001 / O1001 – same programs, old numbers |
| NC file on the DNC server | `<part number>_<OP>_<machine type>_<drawing rev>.nc` | VC-PRD-CC-0020_OP20_HMC_C.nc | Siemens: `.MPF`, underscores |
| Program version | MAJOR.MINOR.PATCH in the header | `(PROGRAM V1.4.0  AUTHOR XY  2026-11-11)` | every change = new version (Step 5) |
| Tool | `T<family><nnn>`, assembly `-nn` | T3063 face mill Ø63; T2016-02 = second Ø16 end mill (sister tool) | family 1 drills, 2 end mills, 3 face mills, 4 taps, 5 boring, 6 reamers, 7 turning, 8 grinding, 9 probes/special |
| Gauge | `GA-<type>-<4 digits>` | GA-PLG-0045 plug Ø52 H7; GA-THR-0020 thread plug M10-6H; GA-CMM-0001 | calibration due date on label + MES |
| Fixture | drawing number | VC-MCH-FIX-0014-A | fixture ID linked to program + pallet |
| Work order | `WO-<YYWW>-<4 digits>` | WO-2546-0001 | |

Header of the real program (Fanuc-type):

```
%
O2102 (VC-PRD-CC-0020 REV C OP20 HMC)
(PROGRAM V1.4.0  AUTHOR XY  2026-11-11)
(FIXTURE VC-MCH-FIX-0014-A  MATERIAL EN-GJL-250)
(T1=T3063 FACE MILL D63  T2=T2016 EM D16  T3=T2012 EM D12  T4=T1085 DR 8.5  T5=T4010 TAP M10)
```

Work offsets (example convention, write it in the programming standard): G54 = fixture position 1 on
pallet side A, G55 = position 2 … one table in the setup sheet. The MES records per serial: program number +
version, tool numbers + assembly numbers used, gauge IDs, measured values.

---

## 13. Standards

Full register: `16_standards_register.md`. Read the **current edition** before use.

| Standard | Title (short) | What it requires (simplified) | Value used here | Verification |
|---|---|---|---|---|
| ISO 6983-1 | Numerical control of machines – program format and definitions of address words | block format, address letters (N, G, X, F, S, T, M …), basic G/M meanings | programs of 4.5 (controller dialects add more) | post-processor test (Step 4) |
| ISO 841 | Numerical control – coordinate system and motion nomenclature | right-hand system, axis names X Y Z, A B C | HMC: B = rotary table | dry run, sign check |
| ISO 1 | Standard reference temperature | dimensions at 20 °C | measuring | room temperature log |
| ISO 286-1 / -2 | ISO code system for tolerances on linear sizes | IT grades, deviations, fits | Ø36 H8 = 0/+0.039; Ø52 H7 = 0/+0.030; Ø10 H7 = 0/+0.015 | gauges 11.3/11.4 |
| ISO 1101 | Geometrical tolerancing | form, orientation, location, run-out | flatness 0.02–0.03; ⟂ 0.02; position Ø0.2 | CMM |
| ISO 5459 | Datums and datum systems | datums, datum targets | casting datum targets, A/B datums | fixture design |
| ISO 2768-1 / -2 | General tolerances | linear/angular (f, m, c, v) and geometric (H, K, L) | ISO 2768-mK (example) | drawing check |
| ISO 21920-1 / -2 / -3 | Surface texture: profile | indication on drawings, parameters (Ra, Rz …), specification operators; replaced ISO 1302, ISO 4287, ISO 4288 | Ra 0.8 / 1.6 / 3.2 | stylus roughness tester |
| ISO 13715 | Edges of undefined shape | edge break / burr notation | −0.2…−0.5 | visual |
| ISO 965-1 | Metric threads – tolerances | 6H nut thread class | M8/M10-6H | thread plug gauges |
| ISO 1502 | Metric threads – gauges and gauging | GO / NO-GO thread gauges | M10-6H gauges | calibration |
| EN 1561 | Grey cast iron | grades by Rm (or HB) | EN-GJL-250 | test bar, hardness |
| EN 1706 | Aluminium castings – composition and mechanical properties | grades, e.g. EN AC-46000 | alternative material | certificate |
| EN 10083-2 / -3 | Steels for quenching and tempering | composition, Rm by section | C45, 42CrMo4 | 3.1 certificate |
| EN 10204 | Inspection documents | 3.1 certificate | all castings, bars | goods receipt |
| ISO 513 | Classification of hard cutting materials | groups P, M, K, N, S, H and application numbers | K10–K20 for GJL, P15–P25 for steel | tool data |
| ISO 1832 | Indexable inserts – designation | insert code (e.g. CNMG 120408) | tool lists | – |
| ISO 3685 / ISO 8688-1, -2 | Tool-life testing (single-point turning / face milling, end milling) | test conditions for tool life (VB criterion) | Taylor tests (10.4) | own trials |
| ISO 13399 | Cutting tool data representation | exchange format for tool data | presetter / CAM data | – |
| ISO 230-1 / -2 | Test code for machine tools – geometric accuracy / positioning of NC axes | measurement + evaluation (A, R, B) | accuracy budget 10.8 | laser interferometer acceptance |
| ISO 10791-1 / -4 / -7 | Test conditions for machining centres – geometry (horizontal spindle) / positioning of linear and rotary axes / finished test piece | acceptance tests of HMC/VMC | machine acceptance | FAT / SAT |
| ISO 16090-1 | Machine tools safety – machining centres, milling machines, transfer machines | safety requirements (guards, modes, speeds) | prove-out rules (Step 7) | CE / risk assessment |
| ISO 4762 / ISO 898-1 | Socket head cap screws / property classes | dimensions / Rm, Rp0.2 of 10.9, 12.9 | fixture bolts | certificate, torque |
| ISO 14253-1 | Decision rules for conformity | guard band with measurement uncertainty | first-part inspection | measuring plan |

---

## 14. Complete worked example: crankcase VC20 OP20 – from drawing to program to first part

Example numbers; the part is the twin template *cc* (HMC-01, EN-GJL-250).

### 14.1 Read the drawing (VC-PRD-CC-0020-C, extract = 11.3)

Critical features: contour 140 ±0.05 (T = 0.10), Ø36 H8 (T = 0.039), pocket depth 10 ±0.05, M10-6H
position Ø0.2. Datums: A = top face (machined first in this op), B = Ø36 bore.

### 14.2 Process decisions

| Decision | Choice | Reason |
|---|---|---|
| Machine | HMC-01 (18 kW, 10 000 rpm) | crankcase family on HMCs (twin config) |
| Work zero | X0 Y0 = stock centre, Z0 = finished top face, measured with spindle probe | as twin |
| Fixture | VC-MCH-FIX-0014-A, 3-2-1 on cast datum targets, hydraulic clamps above the supports | 11.5 |
| Sequence | face (T1) → contour (T2) → pocket (T3) → Ø36 helical (T2) → drill (T4) → tap (T5) | face first creates datum A |
| Tools | T3063, T2016, T2012, T1085, T4010 | 11.3 |

### 14.3 Cutting data and checks

| Tool | n (rpm) | F (mm/min) | Pc Kienzle (kW) | Check |
|---|---|---|---|---|
| T1 face mill | 1 010 | 758 | 1.18 | ≤ 0.8 · 18 = 14.4 ✓ |
| T2 end mill D16 | 2 984 | 955 | 1.27 | ✓; deflection 0.026 mm at 50 mm overhang (10.7) – **close to half the contour tolerance** → plan a finishing pass |
| T3 end mill D12 | 3 979 | 955 | 0.49 | ✓; hm 0.047 mm > edge radius ✓ |
| T4 drill D8.5 | 3 370 | 674 | 1.39 (3.9 N·m) | ✓ |
| T5 tap M10 | 382 | 573 (= 382 · 1.5 exactly) | small | rigid tapping M29 |

Surface of the top face (face mill, fz 0.15 with wiper insert) expected Ra ≈ 1–2 µm ✓ (≤ 3.2).
Tool life (Taylor, example C for this insert from supplier data): face-mill edge ≈ 45 min in cut;
cut time per part 1.0 min (4.4) → tool life counter **≈ 45 parts per edge** (start value, adjust from wear).

### 14.4 Program

Generated in the twin (`/?gctpl=cc#cnc`), listing in 4.5. Changes for the real factory: O-number
**O2102**, header as in chapter 12, tool numbers in comments, **M1** optional stop after each tool, and
an added **finishing pass** for the contour (T2, ae 0.2 mm, same path, to remove the deflection error):

```
(OP2B CONTOUR FINISH - T2 = T2016 END MILL D16, AE 0.2)
N... G0 G90 G54 X88.2 Y0. S2984 M3
N... G43 H2 Z50. M8
...                                   (same contour, radius offset D2 controls the size)
```

Desk check: twin simulator without alarms; CAM machine simulation with the fixture; programming standard
checklist 6.1 ✓.

### 14.5 Prove-out (Step 7)

Dry run 50 mm above the part, rapid override 25 % → no collision. Single block for the first part, feed
override 25 % → 100 %. Spindle load seen: T1 9 %, T2 8 %, T4 10 % (1.2–1.8 kW of 18 kW – consistent with
the Kienzle estimate, not with the twin's 0.6 kW). Real cycle time 6 min 40 s (twin program time without
acceleration was shorter) → entered in the twin configuration.

### 14.6 First-part inspection (after 2 h at 20 °C; gauge IDs recorded)

| Feature | Limit | Measured | Gauge | Result / action |
|---|---|---|---|---|
| Top face flatness | 0.03 | 0.012 | GA-CMM-0001 | ✓ |
| Top face Ra | ≤ 3.2 | 1.4 µm | roughness tester | ✓ |
| Contour X 140 ±0.05 | 139.95–140.05 | **140.056** | GA-MIC-0012 | ✗ +6 µm → tool deflection (10.7): wear offset D2 −0.028 (radius) → second part 140.004 ✓ |
| Contour Y 100 ±0.05 | 99.95–100.05 | 100.052 → 100.000 after the same correction | GA-MIC-0012 | ✓ after correction |
| Pocket 80 × 50 | +0.1 / 0 | 80.04 × 50.03 | CMM | ✓ |
| Pocket depth 10 ±0.05 | 9.95–10.05 | 10.02 | depth gauge | ✓ |
| Ø36 H8 | 36.000–36.039 | 36.018 | bore gauge 0.001 | ✓ |
| ⟂ Ø36 to A | 0.02 | 0.008 | CMM | ✓ |
| M10-6H (4×) | GO enters full depth, NO-GO max 2 turns | ✓ | GA-THR-0020 | ✓ |
| Position M10 | Ø0.2 | max Ø0.06 | CMM | ✓ |
| Edges / burrs | ISO 13715 | ok | visual | ✓ |

Decision: correct **offsets**, not the program (Step 7.7). Program version stays V1.4.0, offset change
recorded on the setup sheet. Quality signs the first-part report → status **Released**. SPC from now on:
contour X every 20th part (with D2 wear compensation when the trend reaches half the tolerance).

---

## 15. Data you still need

| # | Data | From whom | Why |
|---|---|---|---|
| 1 | Real part drawings of crankcase, cylinder, crankshaft (all operations, all sides) | compressor design | the twin templates are simplified single-side parts |
| 2 | Cutting data, kc1.1/mc and tool-life data for the chosen tools and your castings | tool supplier, own trials | values in 10.2/11.2 are typical only |
| 3 | Casting data: real hardness range, porosity limits, casting datums, machining allowances | foundry | decides tool life, datums and fixture |
| 4 | Gasket face and bore finish requirements (Ra / Rz, honing yes/no, plateau profile) | compressor design, gasket and piston-ring suppliers | 11.3/11.4 examples |
| 5 | Machine data: spindle power/torque curve, interface (HSK/SK), magazine, accuracy (ISO 230-2 report), thermal behaviour | machine builder | power checks, accuracy chain 10.8 |
| 6 | Post-processor for each machine + controller options (cycles, tool management, probing) | CAM supplier / machine builder | Step 4 |
| 7 | Fixture designs with clamping force calculation and collision models | fixture designer | 11.5, CAM simulation |
| 8 | Gauge list with capability (%GRR) for Ø52 H7, Ø36 H8, contour | quality, MSA studies | 10:1 rule, guard bands |
| 9 | Cleanliness specification for the compressor parts | compressor design / quality | drawing note 9 |
| 10 | Real cycle times from prove-out | prove-out | twin capacity model |
| 11 | O-number, tool-number and gauge-number allocations in the guide 15 registers | guide 15 owner | chapter 12 numbers are examples |
| 12 | Current editions of the standards in chapter 13 | standards purchase | |

---

## 16. Glossary

| Term | Simple meaning |
|---|---|
| **ae** | radial depth of cut (step-over), mm |
| **ap** | axial depth of cut (depth per pass), mm |
| **CAM** | Computer-Aided Manufacturing: software that creates tool paths from the 3D model |
| **Canned cycle** | one G-code that does a whole drilling/tapping/boring sequence (G81, G83, G84, G85) |
| **Climb milling** | cutter rotation and feed in the same direction at the contact point; better surface, less wear |
| **DNC** | Distributed Numerical Control: server that stores NC programs and sends them to machines |
| **Dry run** | running the program without cutting (in the air) to check the moves |
| **DRO** | Digital Read-Out: position display |
| **Distance-to-go** | remaining distance of the current block, shown on the control |
| **F** | feed rate, mm/min |
| **Feed hold** | button that stops the axis motion immediately (spindle keeps turning) |
| **Feed / rapid override** | knob that scales feed or rapid speed (e.g. 0–150 %) |
| **First-part inspection** | complete measurement of the first part of a new or changed program |
| **fz** | feed per tooth, mm |
| **G54** | work offset no. 1: the position of the work zero in machine coordinates |
| **G-code** | the NC programming language (ISO 6983 and controller dialects) |
| **H / D offset** | tool length (H, Fanuc) / tool edge data (D) stored in the control |
| **Height map** | grid of material heights used by the twin to show the cut stock |
| **HMC / VMC** | Horizontal / Vertical Machining Centre |
| **kc** | specific cutting force of the material, N/mm² |
| **MDI** | Manual Data Input: typing single blocks at the control |
| **Modal** | a code that stays active until another code of its group replaces it |
| **n** | spindle speed, rpm |
| **Pc** | cutting power at the tool edge, kW |
| **Peck drilling** | drilling in steps of Q mm with retracts to break and clear chips (G83) |
| **Post-processor** | translator from the CAM tool path to the G-code dialect of one machine |
| **Prove-out** | controlled first run of a new program on the machine |
| **Q** | metal removal rate, cm³/min (also: peck depth in G83) |
| **R level** | height where a drilling cycle changes from rapid to feed |
| **Rigid tapping** | spindle rotation and Z feed are synchronised (M29 / G84, Siemens G331/G332) |
| **Safe start block** | first line that resets all important modal states |
| **Single block** | the control stops after every block; Cycle Start for the next |
| **Sister tool** | identical spare tool in the magazine, used when the first reaches end of life |
| **Tool presetter** | device that measures tool length and radius outside the machine |
| **Vc** | cutting speed at the tool edge, m/min |
| **Work zero** | the origin X0 Y0 Z0 of the program on the part |
| **Abbe error** | measuring error = offset from the scale line × tilt angle |
| **Accuracy chain / error budget** | list of all error sources of a feature, added by root-sum-square |
| **Chatter** | self-excited (regenerative) vibration in cutting; wavy surface, noise |
| **Chip thinning** | with small ae the real chip thickness hm is smaller than fz |
| **hm** | mean chip thickness, mm |
| **kc1.1, mc** | Kienzle constants: specific cutting force at h = 1 mm, and slope of kc over h |
| **Kienzle law** | kc = kc1.1 · h^−mc: thin chips need more force per mm² |
| **κ (kappa)** | entering (lead) angle of the cutting edge |
| **Rth** | theoretical roughness of a turned/bored surface = f² / (8 · r) |
| **RSS** | root-sum-square: √(a² + b² + …), used to add independent errors |
| **Taylor law** | vc · T^n = C: tool life T falls fast when the cutting speed rises |
| **Tool number vs pocket** | tool number (T3063) = identity in tool management; T word in the program = magazine pocket |
| **O2102** | project NC program number: product 2 (VC20), part 1 (crankcase), OP20 (guide 15) |
