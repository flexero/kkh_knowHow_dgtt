# Drawings for docs/31_asrs_mechanical_3d.md (stdlib only). Writes docs/img/31_*.svg and web/img/31_*.svg
import math, os, shutil
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AC = "#1f6fd1"   # one accent colour
W, H = 1200, 830

class S:
    def __init__(s, title):
        s.o = []; s.title = title
    def add(s, x): s.o.append(x)
    def line(s, x1, y1, x2, y2, w=1.2, c="#000", dash=None, m1=None, m2=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        ms = (f' marker-start="url(#{m1})"' if m1 else "") + (f' marker-end="url(#{m2})"' if m2 else "")
        s.add(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{c}" stroke-width="{w}"{d}{ms}/>')
    def rect(s, x, y, w, h, fill="none", c="#000", sw=1.2, rx=0, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        s.add(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}" stroke="{c}" stroke-width="{sw}"{d}/>')
    def circle(s, x, y, r, fill="none", c="#000", sw=1.2):
        s.add(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{fill}" stroke="{c}" stroke-width="{sw}"/>')
    def poly(s, pts, fill="none", c="#000", sw=1.2, close=True, dash=None):
        p = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts); d = f' stroke-dasharray="{dash}"' if dash else ""
        s.add(f'<{"polygon" if close else "polyline"} points="{p}" fill="{fill}" stroke="{c}" stroke-width="{sw}"{d}/>')
    def path(s, d, fill="none", c="#000", sw=1.2, dash=None):
        dd = f' stroke-dasharray="{dash}"' if dash else ""
        s.add(f'<path d="{d}" fill="{fill}" stroke="{c}" stroke-width="{sw}"{dd}/>')
    def text(s, x, y, t, size=12, anchor="start", bold=False, c="#000", rot=None, italic=False):
        t = str(t).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        r = f' transform="rotate({rot} {x:.1f} {y:.1f})"' if rot is not None else ""
        s.add(f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" text-anchor="{anchor}"{" font-weight=\"bold\"" if bold else ""}{" font-style=\"italic\"" if italic else ""} fill="{c}"{r}>{t}</text>')
    def dim(s, x1, y1, x2, y2, label, off=0, c="#000", size=11.5, side=1):
        # dimension line with arrows; label at the middle (rotated for vertical lines)
        s.line(x1, y1, x2, y2, 0.9, c, m1="sa" if c != "#000" else "sk", m2="ea" if c != "#000" else "ek")
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        if abs(x2 - x1) < 1e-3: s.text(mx - 6 * side, my, label, size, "middle", c=c, rot=-90)
        else: s.text(mx, my - 5 + off, label, size, "middle", c=c)
    def ext(s, x1, y1, x2, y2): s.line(x1, y1, x2, y2, 0.6, "#555")
    def svg(s, block=True):
        head = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Arial, Helvetica, sans-serif">
<title>{s.title}</title>
<defs>
<marker id="ek" viewBox="0 0 10 10" refX="9.5" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M0,1.5 L10,5 L0,8.5 Z" fill="#000"/></marker>
<marker id="sk" viewBox="0 0 10 10" refX="0.5" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M10,1.5 L0,5 L10,8.5 Z" fill="#000"/></marker>
<marker id="ea" viewBox="0 0 10 10" refX="9.5" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M0,1.5 L10,5 L0,8.5 Z" fill="{AC}"/></marker>
<marker id="sa" viewBox="0 0 10 10" refX="0.5" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M10,1.5 L0,5 L10,8.5 Z" fill="{AC}"/></marker>
<pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="#fff"/><line x1="0" y1="0" x2="0" y2="7" stroke="#777" stroke-width="1"/></pattern>
<pattern id="hatchA" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#eaf1fb"/><line x1="0" y1="0" x2="0" y2="6" stroke="{AC}" stroke-width="0.9"/></pattern>
</defs>
<rect x="0" y="0" width="{W}" height="{H}" fill="#fff"/>
<rect x="6" y="6" width="{W-12}" height="{H-12}" fill="none" stroke="#000" stroke-width="1.5"/>
'''
        tb = ""
        if block:
            x0, y0 = W - 426, H - 66
            tb = (f'<rect x="{x0}" y="{y0}" width="414" height="54" fill="#fff" stroke="#000" stroke-width="1.2"/>'
                  f'<line x1="{x0}" y1="{y0+22}" x2="{x0+414}" y2="{y0+22}" stroke="#000" stroke-width="0.8"/>'
                  f'<text x="{x0+8}" y="{y0+16}" font-size="12" font-weight="bold" fill="#000">{s.title[:58]}</text>'
                  f'<text x="{x0+8}" y="{y0+37}" font-size="11.5" font-weight="bold" fill="#b00000">EXAMPLE – check the AS/RS supplier\'s documentation</text>'
                  f'<text x="{x0+8}" y="{y0+50}" font-size="11" fill="#000">Digital twin · ASRS-RAW · guide 31 · dimensions in mm unless stated</text>')
        return head + "\n".join(s.o) + "\n" + tb + "\n</svg>\n"

def save(name, s):
    txt = s.svg()
    assert "↑" not in txt and "↓" not in txt
    for d in (os.path.join(ROOT, "docs", "img"), os.path.join(ROOT, "web", "img")):
        with open(os.path.join(d, name), "w", encoding="utf-8") as f: f.write(txt)
    print("wrote", name, len(txt))

# ---------------------------------------------------------------- 1 rack elevation (front + cross-section)
def rack_elevation():
    s = S("High-bay rack ASRS-RAW – front elevation + cross-section")
    s.text(24, 30, "Front elevation of rack side L (seen from the aisle) – bays 1–3 and 14 shown, bays 4–13 identical", 12.5, bold=True)
    k = 0.058   # px per mm (front)
    gx, gy = 80, 650   # floor line, x of first upright
    pitch, up = 1925, 100
    bays = [0, 1, 2, None, 13]
    x = gx; xs = []
    for b in bays:
        if b is None:
            s.text(x + 55, gy - 300, "bays 4 … 13", 12, "middle", italic=True, rot=-90); s.line(x + 20, gy - 560, x + 90, gy - 540, 0.8, "#555", "4 3"); s.line(x + 20, gy - 40, x + 90, gy - 20, 0.8, "#555", "4 3"); xs.append(None); x += 110; continue
        xs.append(x); x += pitch * k
    xs.append(x)
    # uprights
    H = 9500
    allx = [v for v in xs if v is not None]
    for i, xu in enumerate(allx):
        s.rect(xu, gy - H * k, up * k, H * k, "url(#hatchA)", AC if False else "#000", 1.0)
        s.rect(xu - 2, gy - 4, up * k + 4, 4, "#000", "#000", 0.6)
    # beams + crates per bay
    for bi, b in enumerate(bays):
        if b is None: continue
        x0 = xs[bi] + up * k; x1 = x0 + (pitch - up) * k
        for l in range(7):
            z = 450 + l * 1250 - 50
            s.rect(x0, gy - z * k, x1 - x0, 120 * k, "#fff", "#000", 1.0)
            for c in range(2):
                cx = x0 + (75 + c * 875) * k
                s.rect(cx, gy - (z + 600) * k, 800 * k, 600 * k, "none", AC, 1.1)
                if l == 6 and b == 0: pass
    # level marks
    xl = allx[-1] + up * k + 20
    for l in range(7):
        z = 450 + l * 1250
        s.line(xl, gy - z * k, xl + 70, gy - z * k, 0.7, "#555")
        s.text(xl + 74, gy - z * k + 4, f"L{l+1}  {z/1000:.2f} m", 11.5)
    s.ext(gx - 4, gy - H * k, gx - 40, gy - H * k)
    s.dim(gx - 30, gy, gx - 30, gy - H * k, "9 500 (rack height)", side=1)
    s.text(xl + 236, gy - H * k / 2 + 60, "", 11)
    # bay pitch dims
    s.ext(xs[0], gy + 4, xs[0], gy + 50); s.ext(xs[1], gy + 4, xs[1], gy + 50)
    s.dim(xs[0], gy + 44, xs[1], gy + 44, "1 925 bay pitch")
    x0 = xs[0] + up * k
    s.ext(x0 + 75 * k, gy - 400 * k, x0 + 75 * k, gy + 88); s.ext(x0 + 875 * k, gy - 400 * k, x0 + 875 * k, gy + 88)
    s.dim(x0 + 75 * k, gy + 82, x0 + 875 * k, gy + 82, "800 crate")
    s.text(xs[0] + 10, gy + 118, "bay = 100 upright + 75 + 800 + 75 + 800 + 75 = 1 925 · rack length 14 × 1 925 + 100 = 27 050", 11.5)
    s.text(xs[0], gy + 136, "beam 120 × 50 box, top 50 below the fork level · free height above a 600 crate: 1 250 − 600 − 120 = 530", 11.5)
    s.line(30, gy, 640, gy, 1.6); s.text(36, gy + 16, "floor ± 0.00", 11)
    # cross-section
    ox, oy, k2 = 800, 650, 0.052
    s.text(700, 30, "Cross-section A–A (across the aisle)", 12.5, bold=True)
    yL = [-1950, -1950 + 1200];
    def X(y): return ox + y * k2 + 120
    for sg in (-1, 1):
        for yy in (810, 1890):
            xx = X(sg * yy)
            s.rect(xx - 35 * k2, oy - 9500 * k2, 70 * k2, 9500 * k2, "url(#hatchA)", "#000", 0.8)
        for l in range(7):
            z = 450 + l * 1250
            y0, y1 = sorted((sg * 750, sg * 1950))
            s.rect(X(y0), oy - (z + 600 - 50) * k2, (y1 - y0) * k2, 600 * k2, "none", AC, 1.0)
            for yy in (810, 1890): s.rect(X(sg * yy) - 25 * k2, oy - (z - 50) * k2, 50 * k2, 120 * k2, "#000", "#000", 0.5)
        # bracing zig-zag
        xa, xb = X(sg * 810), X(sg * 1890)
        zz = [150 + 900 * i for i in range(11)]
        for i in range(len(zz) - 1):
            a, b = (xa, xb) if i % 2 == 0 else (xb, xa)
            s.line(a, oy - zz[i] * k2, b, oy - zz[i + 1] * k2, 0.6, "#555")
    # crane in the aisle
    s.rect(X(-175), oy - 9000 * k2, 350 * k2, (9000 - 280) * k2, "#e8e8e8", "#000", 1.2)
    s.rect(X(-210), oy - 280 * k2, 420 * k2, 160 * k2, "#ccc", "#000", 1)
    s.circle(X(0), oy - 250 * k2, 200 * k2, "#fff", "#000", 1)
    s.rect(X(-25), oy - 30 * k2, 50 * k2, 30 * k2, "#000", "#000", 0.5)
    s.rect(X(-10), oy - 9360 * k2, 20 * k2, 100 * k2, "#000", "#000", 0.5)
    s.line(X(-1950), oy - 9440 * k2, X(1950), oy - 9440 * k2, 2.0)
    s.text(X(0), oy - 9500 * k2 - 8, "top tie + top guide rail", 11, "middle")
    # fork extended to R level 4
    z4 = 450 + 3 * 1250
    s.rect(X(-400), oy - (z4 + 900) * k2, 800 * k2, 950 * k2, "none", "#000", 0.9, dash="4 3")
    s.line(X(0), oy - z4 * k2, X(1350), oy - z4 * k2, 2.4, AC)
    s.text(X(0) + 4, oy - z4 * k2 - 6, "fork stroke 1 350", 11, c=AC)
    s.line(ox - 30, oy, ox + 380, oy, 1.6)
    # dims across
    yb = oy + 40
    for yy in (-1950, -750, 750, 1950): s.ext(X(yy), oy + 4, X(yy), yb + 6)
    s.dim(X(-1950), yb, X(-750), yb, "1 200")
    s.dim(X(-750), yb, X(750), yb, "1 500 aisle")
    s.dim(X(750), yb, X(1950), yb, "1 200")
    s.ext(X(-2050), oy + 4, X(-2050), yb + 34); s.ext(X(2050), oy + 4, X(2050), yb + 34)
    s.dim(X(-2050), yb + 26, X(2050), yb + 26, "4 100 over the rear gaps (2 × 100)")
    s.text(700, yb + 52, "Side L = −y, R = +y · crate 1 200 deep, 800 to the aisle · frame depth 1 080,", 11.5)
    s.text(700, yb + 68, "zig-zag bracing ≈ 900 pitch · single mast 500 × 350 · top guide rail 100 × 20", 11.5)
    save("31_rack_elevation.svg", s)

# ---------------------------------------------------------------- 2 slot numbering
def slot_numbering():
    s = S("Slot numbering scheme – side-bay-position-level")
    s.text(24, 32, "Slot id = SIDE - BAY - POSITION - LEVEL      example: L-03-2-5 = side L, bay 3, 2nd crate position in the bay, level 5", 13, bold=True)
    # plan view
    ox, oy, k = 110, 110, 0.036
    s.text(ox, oy - 10, "Plan view (from above)", 12, bold=True)
    L = 27050; x0 = 0
    def X(x): return ox + 60 + x * k
    for sg, lab, yy in ((-1, "side L (−y)", oy + 20), (1, "side R (+y)", oy + 150)):
        for b in range(14):
            xb = X(b * 1925)
            s.rect(xb, yy, 100 * k, 70, "#000", "#000", 0.4)
            for p in range(2):
                xc = X(b * 1925 + 100 + 75 + p * 875)
                hl = (sg == -1 and b == 2 and p == 1)
                s.rect(xc, yy + 6, 800 * k, 58, "url(#hatchA)" if hl else "#fff", AC if hl else "#000", 1.4 if hl else 0.8)
                s.text(xc + 400 * k, yy + 40, f"{p+1}", 11, "middle")
            s.text(X(b * 1925 + 100 + 912), yy - 5 if sg == -1 else yy + 86, f"{b+1:02d}", 11.5, "middle", bold=True)
        s.rect(X(14 * 1925), yy, 100 * k, 70, "#000", "#000", 0.4)
        s.text(ox - 4, yy + 40, lab, 11.5, "end")
    s.rect(X(-1200), oy + 95, (L + 1200 + 1650) * k, 45, "#f3f3f3", "#555", 0.8, dash="5 3")
    s.text(X(13000), oy + 122, "crane aisle 1 500 – crane rail along the centre line", 11.5, "middle")
    s.text(X(-1200) + 4, oy + 122, "I/O", 11.5, bold=True)
    s.line(X(-1000), oy + 260, X(3000), oy + 260, 1.2, AC, m2="ea"); s.text(X(3200), oy + 264, "x (along the aisle, 0 = I/O transfer point)", 11.5, c=AC)
    s.text(X(-1200), oy + 280, "bay numbers 01 … 14 count from the I/O end; position 1 = crate nearer the I/O, 2 = farther", 11.5)
    # front view of bay 3 side L (schematic, not to scale)
    fx, fy = 110, 770
    s.text(60, 452, "Front view of bay 03, side L (from the aisle) – schematic", 12, bold=True)
    bw, lp, ch = 270, 42, 26
    s.rect(fx - 8, fy - 7 * lp - 20, 8, 7 * lp + 20, "#000", "#000", 0.4); s.rect(fx + bw, fy - 7 * lp - 20, 8, 7 * lp + 20, "#000", "#000", 0.4)
    for l in range(7):
        yb2 = fy - 8 - l * lp
        s.rect(fx, yb2, bw, 6, "#fff", "#000", 0.7)
        for p in range(2):
            xc = fx + 10 + p * 130; hl = (l == 4 and p == 1)
            s.rect(xc, yb2 - ch, 120, ch, "url(#hatchA)" if hl else "#fff", AC if hl else "#000", 1.4 if hl else 0.7)
            s.text(xc + 60, yb2 - 9, f"L-03-{p+1}-{l+1}", 11.5, "middle", bold=hl, c=AC if hl else "#000")
        s.text(fx + bw + 16, yb2 - 9, f"level {l+1} ({0.45 + l*1.25:.2f} m)", 11.5)
    s.line(60, fy, 400, fy, 1.4)
    # explanation table
    tx, ty = 560, 470
    rows = [("Part", "Values", "Meaning"), ("SIDE", "L / R", "rack side: L = −y, R = +y (fork direction)"), ("BAY", "01 … 14", "bay between two upright frames, from the I/O end"),
            ("POSITION", "1 / 2", "crate position inside the bay (1 = nearer the I/O)"), ("LEVEL", "1 … 7", "beam level, L1 0.45 m … L7 7.95 m fork level"),
            ("Total", "2 × 14 × 2 × 7", "= 392 slots (one crate each, single-deep)")]
    cw = [110, 130, 330]
    for i, r in enumerate(rows):
        x = tx
        for j, c in enumerate(r):
            s.rect(x, ty + i * 26, cw[j], 26, "#eef3fb" if i == 0 else "#fff", "#000", 0.8)
            s.text(x + 6, ty + i * 26 + 17, c, 11.5, bold=(i == 0 or j == 0))
            x += cw[j]
    s.text(tx, ty + 186, "Rules: the id never changes when stock moves; label + bar code on every front beam;", 11.5)
    s.text(tx, ty + 202, "the WMS (item 4) holds slot → load → lot; the crane PLC gets x / z / side from the slot table.", 11.5)
    s.text(tx, ty + 218, "Coordinates: x = 1.2 + 0.1 + (bay−1)·1.925 + 0.075 + 0.4 + (pos−1)·0.875;  z = 0.45 + (level−1)·1.25 m", 11.5, c=AC)
    s.text(tx, ty + 234, "Example L-03-2-5: x = 1.3 + 3.85 + 0.475 + 0.875 = 6.500 m, z = 5.45 m, y = −1.35 m", 11.5, c=AC)
    save("31_slot_numbering.svg", s)

# ---------------------------------------------------------------- 3 crane general arrangement
def crane_ga():
    s = S("Stacker crane – general arrangement (single mast)")
    s.text(24, 30, "Side view along the aisle (crane at the I/O point)", 12.5, bold=True)
    k = 0.06; ox, oy = 300, 720    # x = 0 at the fork centre
    def X(x): return ox + x * 1000 * k
    def Z(z): return oy - z * 1000 * k
    def lab(x, y, t, px, py, anchor="end", c="#000"):
        s.line(px, py, x + (4 if anchor == "end" else -4), y - 4, 0.6, "#555"); s.circle(px, py, 2, "#000"); s.text(x, y, t, 11.5, anchor, c=c)
    s.line(X(-3.4), Z(0), X(5.6), Z(0), 1.6); s.rect(X(-3.0), Z(0.05), 6.0 * 1000 * k, 0.03 * 1000 * k, "#000", "#000", 0.4)
    # bottom frame + wheels
    s.rect(X(-1.25), Z(0.28), 2.9 * 1000 * k, 0.16 * 1000 * k, "url(#hatch)", "#000", 1.2)
    for x in (-1.05, 1.35):
        s.rect(X(x - 0.21), Z(0.51), 0.42 * 1000 * k, 0.42 * 1000 * k, "#fff", "#000", 1.0)
        s.circle(X(x), Z(0.25), 0.2 * 1000 * k, "#fff", "#000", 1.3); s.circle(X(x), Z(0.25), 3, "#000")
    s.text(X(-1.05), Z(0) + 18, "drive wheel Ø400", 11.5, "middle"); s.text(X(1.35), Z(0) + 18, "idler wheel Ø400", 11.5, "middle")
    s.ext(X(-1.05), Z(0) + 24, X(-1.05), Z(0) + 50); s.ext(X(1.35), Z(0) + 24, X(1.35), Z(0) + 50)
    s.dim(X(-1.05), Z(0) + 44, X(1.35), Z(0) + 44, "wheelbase 2 400")
    s.ext(X(-1.25), Z(0) + 56, X(-1.25), Z(0) + 80); s.ext(X(1.65), Z(0) + 56, X(1.65), Z(0) + 80)
    s.dim(X(-1.25), Z(0) + 74, X(1.65), Z(0) + 74, "bottom frame 2 900")
    # travel motor, hoist drive
    s.rect(X(-1.6), Z(0.47), 0.42 * 1000 * k, 0.22 * 1000 * k, "#ddd", "#000", 1)
    s.rect(X(-0.9), Z(0.6), 0.5 * 1000 * k, 0.28 * 1000 * k, "#ddd", "#000", 1)
    # mast, top frame, pulleys, top rail
    s.rect(X(-1.0), Z(9.0), 0.5 * 1000 * k, (9.0 - 0.28) * 1000 * k, "#f0f0f0", "#000", 1.4)
    s.text(X(-0.75) + 4, Z(5.0), "mast box 500 × 350 × 6", 11.5, "middle", rot=-90)
    s.rect(X(-1.1), Z(9.18), 0.7 * 1000 * k, 0.18 * 1000 * k, "url(#hatch)", "#000", 1.1)
    s.circle(X(-0.5), Z(9.12), 0.16 * 1000 * k, "#fff", "#000", 1); s.circle(X(-1.0), Z(9.12), 0.16 * 1000 * k, "#fff", "#000", 1)
    s.rect(X(-1.9), Z(9.36), 3.6 * 1000 * k, 0.1 * 1000 * k, "#000", "#000", 0.4)
    # ladder + platform
    s.line(X(-1.13), Z(0.4), X(-1.13), Z(8.9), 0.8); s.line(X(-1.17), Z(0.4), X(-1.17), Z(8.9), 0.8)
    for zz in [0.5 + 0.56 * i for i in range(15)]: s.line(X(-1.2), Z(zz), X(-1.1), Z(zz), 0.6)
    s.rect(X(-1.45), Z(8.77), 0.6 * 1000 * k, 0.04 * 1000 * k, "#000", "#000", 0.4)
    # carriage at level 4 + ropes
    zc = 4.2
    s.rect(X(-0.53), Z(zc + 0.92), 0.12 * 1000 * k, 1.0 * 1000 * k, "#ddd", "#000", 1.1)
    s.rect(X(-0.5), Z(zc - 0.07), 1.0 * 1000 * k, 0.07 * 1000 * k, AC, AC, 0.6)
    s.rect(X(-0.4), Z(zc + 0.6), 0.8 * 1000 * k, 0.6 * 1000 * k, "none", "#000", 0.9, dash="4 3")
    s.line(X(-0.45), Z(zc + 0.92), X(-0.45), Z(9.0), 0.9, "#000", "3 2")
    # cabinet + laser
    s.rect(X(0.875), Z(2.27), 0.55 * 1000 * k, 1.75 * 1000 * k, "#fff", "#000", 1.2)
    s.text(X(1.15) + 4, Z(1.4), "control cabinet", 11.5, "middle", rot=-90)
    s.rect(X(1.65), Z(0.69), 0.16 * 1000 * k, 0.14 * 1000 * k, AC, AC)
    # labels: left column (end at x = 200) and right column (start at x = 420)
    L, Rx = 200, 420
    lab(L, Z(8.85) + 4, "maintenance platform", X(-1.3), Z(8.8))
    lab(L, Z(7.9), "ladder + fall-arrest rail", X(-1.15), Z(7.5))
    lab(L, Z(2.0), "hoist drive 11 kW", X(-0.7), Z(0.55)); s.text(L, Z(2.0) + 15, "+ drum Ø250", 11.5, "end")
    lab(L, Z(1.0), "travel drive 7.5 kW", X(-1.45), Z(0.4))
    lab(Rx, Z(9.6), "top guide rail 100 × 20", X(1.3), Z(9.33), "start")
    lab(Rx, Z(8.8), "top frame + guide rollers", X(-0.6), Z(9.05), "start")
    lab(Rx, Z(7.3), "2 hoist ropes", X(-0.45), Z(7.0), "start")
    lab(Rx, Z(zc + 1.4), "lifting carriage +", X(0.3), Z(zc + 0.4), "start", AC); s.text(Rx, Z(zc + 1.4) + 15, "telescopic fork, 300 kg", 11.5, c=AC)
    lab(Rx, Z(2.8), "laser distance sensor", X(1.73), Z(0.62), "start", AC); s.text(Rx, Z(2.8) + 15, "(to the aisle-end reflector)", 11.5, c=AC)
    s.text(X(3.0), Z(0) + 18, "bottom rail 50 × 30 on grout", 11.5)
    # vertical dims on the right
    s.ext(X(0.5), Z(0.35), X(5.0), Z(0.35)); s.ext(X(0.5), Z(8.05), X(5.0), Z(8.05))
    s.dim(X(4.9), Z(0.35), X(4.9), Z(8.05), "fork level 350 … 8 050", side=1)
    s.ext(X(1.8), Z(9.18), X(6.0), Z(9.18))
    s.dim(X(5.9), Z(0), X(5.9), Z(9.18), "≈ 9 300 crane height", side=1)
    # view across the aisle
    fx, fy, k2 = 1010, 720, 0.05
    s.text(800, 30, "View across the aisle (fork extended to R)", 12.5, bold=True)
    def Y(y): return fx + y * 1000 * k2
    s.line(Y(-2.3), fy, Y(2.3), fy, 1.6)
    for sg in (-1, 1):
        for yy in (0.81, 1.89): s.rect(Y(sg * yy) - 2, fy - 9.5 * 1000 * k2, 4, 9.5 * 1000 * k2, "#bbb", "#888", 0.5)
    s.rect(Y(-0.175), fy - 9.0 * 1000 * k2, 0.35 * 1000 * k2, 8.72 * 1000 * k2, "#f0f0f0", "#000", 1.3)
    s.rect(Y(-0.21), fy - 0.28 * 1000 * k2, 0.42 * 1000 * k2, 0.16 * 1000 * k2, "url(#hatch)", "#000", 1)
    s.circle(Y(0), fy - 0.25 * 1000 * k2, 0.2 * 1000 * k2, "#fff", "#000", 1)
    s.rect(Y(-1.0), fy - 9.44 * 1000 * k2, 2.0 * 1000 * k2, 4, "#000")
    zc2 = 5.45
    s.rect(Y(-0.5), fy - zc2 * 1000 * k2 - 4, 1.0 * 1000 * k2, 4, "#000")
    s.rect(Y(0.15), fy - zc2 * 1000 * k2 - 3, 1.7 * 1000 * k2, 3, AC, AC)
    s.rect(Y(0.75), fy - (zc2 + 0.6) * 1000 * k2, 1.2 * 1000 * k2, 0.6 * 1000 * k2, "none", "#000", 1, dash="4 3")
    s.ext(Y(0), fy - zc2 * 1000 * k2 - 10, Y(0), fy - zc2 * 1000 * k2 - 70); s.ext(Y(1.35), fy - zc2 * 1000 * k2 - 40, Y(1.35), fy - zc2 * 1000 * k2 - 70)
    s.dim(Y(0), fy - zc2 * 1000 * k2 - 62, Y(1.35), fy - zc2 * 1000 * k2 - 62, "1 350", c=AC)
    s.text(Y(0), fy + 18, "aisle 1 500 · uprights grey", 11.5, "middle")
    s.text(Y(0), fy + 34, "fork stroke ± 1 350 to L and R", 11.5, "middle", c=AC)
    # data table
    tx, ty = 690, 120
    data = [("Moving mass", "4 200 kg + 300 kg load"), ("Travel", "3 m/s, 0.5 m/s², 7.5 kW"), ("Hoist", "1 m/s, 0.5 m/s², 11 kW"), ("Fork", "1 m/s, 1.2 m/s², 1.1 kW"),
            ("Max wheel load", "≈ 30 kN (φ = 1.15)"), ("Mast deflection", "≈ 1.9 mm, f₁ ≈ 2.5 Hz"), ("FEM 9.851", "SC 34.8 s · DC 57.8 s")]
    s.rect(tx - 6, ty - 20, 262, 22 * len(data) + 26, "#fff", "#000", 0.8)
    s.text(tx, ty - 4, "Main data (example)", 12, bold=True)
    for i, (a, b) in enumerate(data):
        s.text(tx, ty + 18 + i * 22, a, 11.5, bold=True); s.text(tx + 104, ty + 18 + i * 22, b, 11.5)
    save("31_crane_ga.svg", s)

# ---------------------------------------------------------------- 4 drive train
def drive_train():
    s = S("Stacker crane drive trains – travel and hoist")
    s.text(24, 30, "Travel drive (one driven wheel)", 12.5, bold=True)
    y = 160
    boxes = [(40, "encoder", "#fff"), (120, "motor 7.5 kW\n1 450 rpm", "#eef3fb"), (270, "brake\n(spring-applied)", "#fff"), (400, "helical-bevel\ngear i ≈ 10", "#fff")]
    for x, t, f in boxes:
        s.rect(x, y - 40, 120 if x != 40 else 70, 80, f, "#000", 1.2)
        for i, ln in enumerate(t.split("\n")): s.text(x + (60 if x != 40 else 35), y - 4 + i * 15, ln, 11.5, "middle")
    s.line(110, y, 120, y, 2); s.line(240, y, 270, y, 2); s.line(390, y, 400, y, 2); s.line(520, y, 560, y, 3)
    s.circle(620, y + 10, 60, "#fff", "#000", 1.4); s.circle(620, y + 10, 6, "#000"); s.text(620, y + 100, "steel wheel Ø400 · 143 rpm", 11.5, "middle")
    s.rect(540, y + 70, 160, 14, "url(#hatch)", "#000", 1); s.text(710, y + 82, "rail", 11.5)
    s.text(40, y + 70, "Inverter in the crane cabinet (shared DC link with the hoist).", 11.5)
    s.text(40, y + 88, "F = m·a·k_rot + w·m·g = 4 500 × 0.5 × 1.05 + 0.01 × 4 500 × 9.81 = 2 362 + 441 = 2 804 N", 11.5, c=AC)
    s.text(40, y + 106, "P_peak = F·v/η = 2 804 × 3 / 0.9 = 9.35 kW → motor 7.5 kW (9.35 / 1.5 = 6.2 kW ≤ 7.5)", 11.5, c=AC)
    s.text(40, y + 124, "wheel torque = F·D/2 = 2 804 × 0.2 = 561 N·m; i = 1 450 / 143 = 10.1", 11.5, c=AC)
    # hoist
    s.text(24, 330, "Hoist drive (no counterweight) – rope over the mast-top pulley", 12.5, bold=True)
    hy = 700
    s.rect(60, hy - 50, 110, 70, "#eef3fb", "#000", 1.2); s.text(115, hy - 18, "motor 11 kW", 11.5, "middle"); s.text(115, hy - 3, "+ brake + enc.", 11.5, "middle")
    s.rect(190, hy - 50, 110, 70, "#fff", "#000", 1.2); s.text(245, hy - 18, "gear i ≈ 19", 11.5, "middle")
    s.line(170, hy - 15, 190, hy - 15, 2); s.line(300, hy - 15, 330, hy - 15, 3)
    s.rect(330, hy - 50, 120, 70, "url(#hatch)", "#000", 1.3); s.text(390, hy + 40, "drum Ø250 · 76 rpm", 11.5, "middle")
    # mast + pulley + carriage
    mx = 600
    s.rect(mx, 360, 60, hy - 360, "#f2f2f2", "#000", 1.2)
    s.circle(mx + 30, 360, 26, "#fff", "#000", 1.3); s.circle(mx + 30, 360, 4, "#000")
    s.line(450, hy - 40, mx + 4, 362, 1.2, "#000", "4 2"); s.line(mx + 56, 362, mx + 90, 362, 1.2); s.line(mx + 90, 362, mx + 90, 520, 1.2)
    s.rect(mx + 65, 520, 150, 60, "#eef3fb", AC, 1.4); s.text(mx + 140, 545, "carriage + fork", 11.5, "middle"); s.text(mx + 140, 562, "600 kg + load 300 kg", 11.5, "middle")
    s.line(mx + 140, 600, mx + 140, 650, 1.2, AC, m2="ea"); s.text(mx + 150, 640, "m·g = 8 829 N", 11.5, c=AC)
    s.text(mx + 70, 350, "pulley D/d ≥ 20 · slack-rope + overload switch", 11.5)
    s.text(40, 760, "P = m·g·v/η = 900 × 9.81 × 1.0 / 0.85 = 10.4 kW (continuous while lifting) → 11 kW;  rope force with a = 900 × (9.81 + 0.5) = 9 279 N", 11.5, c=AC)
    s.text(40, 778, "2 ropes, minimum breaking force 40 kN each → Z_p = 80 000 / 9 279 = 8.6  (check the required factor with the crane maker / EN 528)", 11.5, c=AC)
    # safety notes right
    tx = 850
    s.text(tx, 90, "Design rules (example)", 12, bold=True)
    for i, t in enumerate(["Brakes: spring-applied, fail-safe,", "  tested each shift (brake test).", "Encoders: motor encoder for speed,", "  absolute laser / BPS for position.",
                           "Overspeed + end-of-aisle slowdown:", "  monitored by the safety PLC.", "Regenerative braking: shared DC link,", "  feed-back unit or braking resistor.",
                           "Gearbox oil: change ≈ 10 000 h", "  (maker's table).", "Rope: inspect per ISO 4309,", "  discard criteria = broken wires."]):
        s.text(tx, 112 + i * 17, t, 11.5)
    save("31_crane_drive_train.svg", s)

# ---------------------------------------------------------------- 5 FEM 9.851
def fem():
    s = S("FEM 9.851 cycle – reference points P1 / P2 and cycle times")
    L, Hh, zio = 28.25, 7.2, 0.75
    P1 = (L / 5, zio + 2 * Hh / 3); P2 = (2 * L / 3, zio + Hh / 5)
    ox, oy, kx, kz = 80, 560, 22, 50
    def X(x): return ox + x * kx
    def Z(z): return oy - z * kz
    s.text(24, 30, "Rack face (x along the aisle, z height) – the crane moves in x and z at the same time; the slower axis decides", 12.5, bold=True)
    s.rect(X(1.2), Z(9.5), 27.05 * kx, 9.5 * kz, "#fafafa", "#000", 1.0)
    for b in range(15): s.line(X(1.2 + b * 1.925), Z(0), X(1.2 + b * 1.925), Z(9.5), 0.4, "#999")
    for l in range(7): s.line(X(1.2), Z(0.45 + l * 1.25), X(28.25), Z(0.45 + l * 1.25), 0.4, "#999")
    s.line(X(0) - 30, Z(0), X(29) + 10, Z(0), 1.4)
    s.circle(X(0), Z(zio), 7, "#000"); s.text(X(0) - 10, Z(zio) + 22, "I/O (0; 0.75)", 11.5, "middle")
    for P, n in ((P1, "P1"), (P2, "P2")):
        s.circle(X(P[0]), Z(P[1]), 8, "#fff", AC, 2.2); s.text(X(P[0]) + 12, Z(P[1]) - 10, f"{n} ({P[0]:.2f}; {P[1]:.2f}) m", 12, bold=True, c=AC)
    s.line(X(0), Z(zio), X(P1[0]), Z(P1[1]), 1.6, AC, m2="ea"); s.line(X(P1[0]), Z(P1[1]), X(P2[0]), Z(P2[1]), 1.6, AC, "6 3", m2="ea"); s.line(X(P2[0]), Z(P2[1]), X(0), Z(zio), 1.6, AC, "2 3", m2="ea")
    s.ext(X(0), Z(0) + 4, X(0), Z(0) + 46); s.ext(X(L), Z(0) + 4, X(L), Z(0) + 46)
    s.dim(X(0), Z(0) + 40, X(L), Z(0) + 40, "L = 1.2 + 27.05 = 28.25 m (I/O to rack end)")
    s.ext(X(28.25) + 4, Z(zio), X(28.25) + 60, Z(zio)); s.ext(X(28.25) + 4, Z(7.95), X(28.25) + 60, Z(7.95))
    s.dim(X(28.25) + 54, Z(zio), X(28.25) + 54, Z(7.95), "H = 7.95 − 0.75 = 7.2 m", side=-1)
    s.text(X(P1[0]) - 30, Z(9.5) - 10, "P1 = (L/5, I/O + 2H/3)   P2 = (2L/3, I/O + H/5)", 11.5)
    # table
    tx, ty = 60, 640
    rows = [("Move", "Δx m", "t_travel s", "Δz m", "t_hoist s", "t_move s"), ("I/O → P1", "5.65", "2√(5.65/0.5) = 6.72", "4.80", "4.8/1 + 1/0.5 = 6.80", "6.80"),
            ("I/O → P2", "18.83", "18.83/3 + 3/0.5 = 12.28", "1.44", "2√(1.44/0.5) = 3.39", "12.28"), ("P1 → P2", "13.18", "2√(13.18/0.5) = 10.27", "3.36", "3.36 + 2 = 5.36", "10.27")]
    cw = [90, 60, 190, 60, 190, 80]
    for i, r in enumerate(rows):
        x = tx
        for j, c in enumerate(r):
            s.rect(x, ty + i * 24, cw[j], 24, "#eef3fb" if i == 0 else "#fff", "#000", 0.7); s.text(x + 5, ty + i * 24 + 16, c, 11.5, bold=(i == 0)); x += cw[j]
    s.text(tx, ty + 116, "one stop = positioning 3.0 + fork out 2.18 + lift 0.5 + fork in 2.18 = 7.87 s  (fork 1.35 m at 1 m/s, 1.2 m/s²: 1.35/1 + 1/1.2 = 2.18 s)", 11.5)
    s.text(tx + 690, ty + 18, "t_SC = (2·6.80 + 2·12.28)/2 + 2·7.87", 12, c=AC); s.text(tx + 690, ty + 36, "     = 19.08 + 15.73 = 34.8 s → 103 jobs/h", 12, bold=True, c=AC)
    s.text(tx + 690, ty + 62, "t_DC = 6.80 + 10.27 + 12.28 + 4·4.87 + 3·3.0", 12, c=AC); s.text(tx + 690, ty + 80, "     = 29.35 + 28.47 = 57.8 s → 125 jobs/h", 12, bold=True, c=AC)
    save("31_fem9851_cycle.svg", s)

# ---------------------------------------------------------------- 6 I/O layout (plan)
def io_layout():
    s = S("I/O area – conveyors, checks, fence, light curtains (plan)")
    s.text(24, 30, "Plan view of the I/O front end (x along the aisle, 0 = crane transfer point)", 12.5, bold=True)
    k = 70; ox, oy = 560, 420
    def X(x): return ox + x * k
    def Y(y): return oy + y * k     # +y (side R) downwards in this plan
    # rack start
    for sg in (-1, 1):
        y0, y1 = sorted((sg * 0.75, sg * 1.95)); s.rect(X(1.2), Y(y0), 7.0 * k, (y1 - y0) * k, "url(#hatchA)", "#000", 1)
        s.text(X(3.5), Y(sg * 1.35) + 4, f"rack side {'L' if sg < 0 else 'R'} (bay 01 …)", 11.5, "middle")
    s.rect(X(-1.9), Y(-0.03), 10.1 * k, 0.06 * k, "#000", "#000", 0.4); s.text(X(6.0), Y(0) - 8, "bottom rail", 11.5)
    # crane at x=0
    s.rect(X(-1.25), Y(-0.21), 2.9 * k, 0.42 * k, "#ddd", "#000", 1.2); s.rect(X(-1.0), Y(-0.175), 0.5 * k, 0.35 * k, "#fff", "#000", 1.2)
    s.text(X(1.75), Y(0) - 8, "crane", 11.5)
    # conveyors
    for sg, name in ((-1, "INFEED (side L)"), (1, "OUTFEED (side R)")):
        y = sg * 1.35
        s.rect(X(-6.6), Y(y - 0.65), 6.1 * k, 1.3 * k, "#fff", "#000", 1.2)
        for xx in [-6.6 + 0.3 * i for i in range(21)]: s.line(X(xx), Y(y - 0.65), X(xx), Y(y + 0.65), 0.3, "#999")
        s.rect(X(-0.475), Y(y - 0.65), 0.95 * k, 1.3 * k, "url(#hatchA)", AC, 1.4)
        s.text(X(-3.5), Y(sg * 3.0) + 4, name + " – chain conveyor 0.2 m/s, top 0.70 m", 11.5, "middle", bold=True)
        s.line(X(-6.2 if sg < 0 else -0.6), Y(y), X(-0.6 if sg < 0 else -6.2), Y(y), 1.6, AC, m2="ea")
        s.text(X(0), Y(sg * 0.5) + 4, "transfer", 11.5, "middle", c=AC)
    # crate example
    s.rect(X(-0.4), Y(-1.95), 0.8 * k, 1.2 * k, "none", "#000", 1, dash="4 3"); s.text(X(0.45), Y(-2.1), "crate 800 × 1 200", 11.5)
    # infeed devices
    yi = -1.35
    s.rect(X(-6.3), Y(yi - 0.68), 1.0 * k, 1.36 * k, "none", AC, 1.6, dash="6 3"); s.text(X(-5.8), Y(yi - 0.85), "weighing", 11.5, "middle", c=AC)
    s.line(X(-4.6), Y(yi - 0.85), X(-4.6), Y(yi + 0.85), 3, AC); s.text(X(-4.6), Y(yi - 0.95), "contour + height gate", 11.5, "middle", c=AC)
    s.circle(X(-3.6), Y(yi - 0.85), 7, AC, AC); s.text(X(-3.6) + 10, Y(yi - 0.95), "ID scanner", 11.5, c=AC)
    s.text(X(-6.6), Y(-3.4), "reject lane / manual station (not shown) after a failed check", 11.5)
    # fence
    xf = -2.3
    s.line(X(xf), Y(-2.35), X(xf), Y(-2.05), 2.2); s.line(X(xf), Y(-0.65), X(xf), Y(0.65), 2.2, "#000", "8 3"); s.line(X(xf), Y(2.05), X(xf), Y(2.35), 2.2)
    s.line(X(xf), Y(-2.35), X(1.1), Y(-2.35), 2.2); s.line(X(xf), Y(2.35), X(1.1), Y(2.35), 2.2)
    s.path(f"M{X(xf):.1f},{Y(-0.65):.1f} A{1.3*k:.1f},{1.3*k:.1f} 0 0 0 {X(xf - 1.3):.1f},{Y(0.65):.1f}", "none", "#000", 0.8, "3 3")
    s.text(X(xf - 1.4) - 4, Y(0.05) + 4, "door", 11.5, "end")
    for sg in (-1, 1):
        s.line(X(xf + 0.05), Y(sg * 1.35 - 0.62), X(xf + 0.05), Y(sg * 1.35 + 0.62), 3.5, AC)
    # dims
    s.ext(X(-6.6), Y(2.0) + 4, X(-6.6), Y(3.45) + 6); s.ext(X(-0.5), Y(2.0) + 4, X(-0.5), Y(3.45) + 6)
    s.dim(X(-6.6), Y(3.45), X(-0.5), Y(3.45), "6 100 conveyor")
    s.ext(X(xf), Y(2.35) + 4, X(xf), Y(3.9) + 6); s.ext(X(0), Y(2.0) + 4, X(0), Y(3.9) + 6)
    s.dim(X(xf), Y(3.9), X(0), Y(3.9), "2 300 fence to transfer point")
    s.ext(X(0), Y(-2.35) - 4, X(0), Y(-2.35) - 50); s.ext(X(1.2), Y(-1.95) - 4, X(1.2), Y(-2.35) - 50)
    s.dim(X(0), Y(-2.35) - 44, X(1.2), Y(-2.35) - 44, "1 200")
    s.ext(X(1.0), Y(-1.35), X(1.15) + 0, Y(-1.35));
    s.text(40, 744, "Infeed: weigh (≤ 300 kg) → contour / height check → read the ID → WMS assigns the slot → crane picks.", 11.5)
    s.text(40, 762, "Fence 2 200 high (ISO 13857), door: interlock + guard locking, light curtains type 4 + muting (blue bars).", 11.5)
    save("31_io_layout.svg", s)

# ---------------------------------------------------------------- 7 load diagram (beam + upright)
def load_diagram():
    s = S("Rack loads – beam moment / deflection, upright load, floor")
    s.text(24, 30, "Beam (one of the front / rear pair) with 2 crates – two point loads P = 300 × 9.81 / 2 = 1 471.5 N", 12.5, bold=True)
    bx0, by, L, k = 90, 150, 1825, 0.33
    s.rect(bx0 - 14, by - 40, 14, 120, "url(#hatch)", "#000", 1); s.rect(bx0 + L * k, by - 40, 14, 120, "url(#hatch)", "#000", 1)
    s.rect(bx0, by, L * k, 14, "#fff", "#000", 1.4)
    for a in (475, L - 475):
        s.line(bx0 + a * k, by - 60, bx0 + a * k, by - 2, 1.6, AC, m2="ea"); s.text(bx0 + a * k, by - 66, "P", 12, "middle", bold=True, c=AC)
    s.ext(bx0, by + 20, bx0, by + 46); s.ext(bx0 + 475 * k, by + 20, bx0 + 475 * k, by + 46); s.ext(bx0 + L * k, by + 20, bx0 + L * k, by + 46)
    s.dim(bx0, by + 40, bx0 + 475 * k, by + 40, "a = 475"); s.dim(bx0 + 475 * k, by + 40, bx0 + L * k, by + 40, "L = 1 825 (clear span)")
    # moment diagram
    my = 290
    s.line(bx0, my, bx0 + L * k, my, 0.8)
    s.poly([(bx0, my), (bx0 + 475 * k, my + 70), (bx0 + (L - 475) * k, my + 70), (bx0 + L * k, my)], "url(#hatchA)", AC, 1.4)
    s.text(bx0 + L * k / 2, my + 90, "M_max = P·a = 1 471.5 × 0.475 = 699 N·m (constant between the loads)", 11.5, "middle", c=AC)
    s.text(bx0 - 10, my + 4, "M", 12, "end", bold=True)
    # deflection
    dy = 410
    pts = []
    for i in range(41):
        x = L * i / 40; a = 475
        # shape for symmetric loads (normalised)
        if x < a: w = x * (3 * L * a - 3 * a * a - x * x)
        elif x <= L - a: w = a * (3 * L * x - 3 * x * x - a * a)
        else: xx = L - x; w = xx * (3 * L * a - 3 * a * a - xx * xx)
        pts.append((x, w))
    wmax = max(p[1] for p in pts)
    s.line(bx0, dy, bx0 + L * k, dy, 0.8, "#555", "4 3")
    s.poly([(bx0 + x * k, dy + w / wmax * 40) for x, w in pts], "none", "#000", 1.6, close=False)
    s.text(bx0 + L * k / 2, dy + 62, "δ = P·a·(3L² − 4a²)/(24·E·I) = 1.04 mm ≤ L/200 = 9.1 mm", 11.5, "middle", c=AC)
    s.text(bx0, 520, "Box beam 120 × 50 × 2.0: I = (50·120³ − 46·116³)/12 = 1.217 × 10⁶ mm⁴, W = 20.3 × 10³ mm³", 11.5)
    s.text(bx0, 538, "σ_d = 1.4 × 699 000 / 20 276 = 48.3 N/mm² ≤ 355 (S355) – the connector moment / shear is proven by test (EN 15512).", 11.5)
    # upright load build-up
    ux, uy = 860, 640
    s.text(700, 30, "Inner upright – load from 7 levels", 12.5, bold=True)
    s.rect(ux, uy - 560, 22, 560, "url(#hatchA)", "#000", 1.2)
    for l in range(7):
        z = uy - 40 - l * 75
        s.rect(ux - 80, z - 6, 80, 10, "#fff", "#000", 0.8); s.rect(ux + 22, z - 6, 80, 10, "#fff", "#000", 0.8)
        s.line(ux - 50, z - 34, ux - 50, z - 8, 1.2, AC, m2="ea"); s.line(ux + 72, z - 34, ux + 72, z - 8, 1.2, AC, m2="ea")
        s.text(ux + 130, z, f"level {l+1}: + 300 kg (2 half-crates)", 11.5)
    s.rect(ux - 30, uy, 82, 8, "#000", "#000", 0.5); s.rect(ux - 60, uy + 8, 142, 30, "url(#hatch)", "#000", 0.8)
    s.line(ux + 11, uy + 60, ux + 11, uy + 42, 1.6, "#000", m2="ek")
    s.text(90, 600, "N_k = 7 × 300 × 9.81 = 20.6 kN · N_Ed = 1.4 × 20.6 + 1.3 × 1.18 = 30.4 kN", 11.5, c=AC)
    s.text(90, 618, "inner upright, base plate 150 × 120: p = 21.8 kN / 18 000 mm² = 1.21 N/mm²", 11.5, c=AC)
    s.text(960, 640 - 560 + 10, "lever rule: crate 74 % to the near upright,", 11.5); s.text(960, 640 - 560 + 26, "26 % to the far one; 50 / 50 front / rear", 11.5)
    save("31_rack_load_diagram.svg", s)

# ---------------------------------------------------------------- 8 mast deflection model
def mast_model():
    s = S("Mast deflection under acceleration – cantilever model")
    s.text(24, 30, "Model: mast = cantilever clamped in the bottom frame; inertia forces act opposite to the acceleration a", 12.5, bold=True)
    bx, by, Hpx = 380, 740, 600
    s.rect(bx - 90, by, 260, 26, "url(#hatch)", "#000", 1.2); s.text(bx + 40, by + 44, "bottom frame (clamp)", 11.5, "middle")
    s.rect(bx, by - Hpx, 40, Hpx, "#f2f2f2", "#000", 1.4)
    # deflected shape
    pts = []
    for i in range(31):
        x = i / 30; w = (x * x * (6 - 4 * x + x * x)) / 3 * 0.35 + (x * x * (3 - x)) / 2 * 0.65
        pts.append((bx + 20 + w * 80, by - x * Hpx))
    s.poly(pts, "none", AC, 2.0, close=False, dash="7 4")
    s.text(bx - 10, by - Hpx - 8, "deflected axis (exaggerated, dashed)", 11.5, "end", c=AC)
    # distributed load arrows
    for i in range(10):
        y = by - 30 - i * 57; s.line(bx - 70, y, bx - 4, y, 1.0, "#000", m2="ek")
    s.text(bx - 76, by - Hpx / 2, "q = m_mast·a / H", 12, "end", bold=True)
    hp = by - Hpx * 8.0 / 9.3
    s.line(bx - 120, hp, bx - 4, hp, 2.2, AC, m2="ea"); s.text(bx - 126, hp - 6, "P = (m_carr + m_load)·a", 12, "end", bold=True, c=AC)
    s.ext(bx + 44, by, bx + 160, by); s.ext(bx + 44, hp, bx + 100, hp); s.ext(bx + 44, by - Hpx, bx + 160, by - Hpx)
    s.dim(bx + 95, by, bx + 95, hp, "h = 8.0 m", side=-1); s.dim(bx + 150, by, bx + 150, by - Hpx, "H = 9.3 m", side=-1)
    s.line(bx + 200, by - 20, bx + 290, by - 20, 1.8, "#000", m2="ek"); s.text(bx + 300, by - 16, "travel acceleration a = 0.5 m/s²", 11.5)
    tx, ty = 600, 110
    lines = ["Section: welded box 500 × 350 × 6 mm (bending about the 500 depth)", "I = (350·500³ − 338·488³)/12 = 372.5 × 10⁶ mm⁴ ; E = 210 000 N/mm²", "",
             "q = 1 000 kg × 0.5 / 9 300 mm = 0.0538 N/mm", "δ_q = q·H⁴/(8·E·I) = 0.0538 × 9 300⁴ / (8 × 210 000 × 372.5·10⁶) = 0.64 mm", "",
             "P = (600 + 300) × 0.5 = 450 N at h = 8 000 mm", "δ_P = P·h²·(3H − h)/(6·E·I) = 450 × 8 000² × 19 900 / (6 E I) = 1.22 mm", "",
             "static top deflection δ = 0.64 + 1.22 = 1.86 mm", "sudden start / stop (no jerk limit): dynamic factor ≈ 2 → ≈ 3.7 mm", "",
             "stiffness k = 3·E·I/H³ = 292 kN/m (at the top)", "m_eq = 0.24 × 1 000 + 900 = 1 140 kg", "f₁ = √(k/m_eq) / 2π = √(291 727 / 1 140) / 2π = 2.55 Hz", "",
             "What it means: after each stop the mast swings with ≈ 2.5 Hz;", "jerk-limited (S-curve) moves and sway damping in the drive", "keep the residual amplitude at the fork < ± 2 mm within the", "3 s fine-positioning time (budget, guide 31 §9)."]
    for i, t in enumerate(lines): s.text(tx, ty + i * 19, t, 12 if i in (9, 14) else 11.5, bold=i in (9, 14), c=AC if i in (9, 14) else "#000")
    save("31_mast_deflection.svg", s)

# ---------------------------------------------------------------- 9 positioning budget
def budget():
    s = S("Positioning accuracy budget – x and z (example tolerances)")
    s.text(24, 30, "Each error as ± mm; RSS = √Σe² (independent errors), worst case = Σe; both must fit the free space", 12.5, bold=True)
    X = [("crane travel positioning (laser / BPS)", 3), ("mast sway left at the fork", 2), ("rack bay position vs nominal", 5), ("upright straightness + beam position", 3), ("load position on the fork", 2), ("crate deformation / overhang", 5)]
    Zl = [("hoist positioning", 2), ("carriage tilt on the mast", 1), ("beam level tolerance", 5), ("rail / floor level", 3), ("beam deflection under load", 2), ("fork deflection under load", 5)]
    for gi, (lst, ttl, avail, y0) in enumerate(((X, "x – along the aisle (free gap crate ↔ upright 75 mm)", 75, 80), (Zl, "z – vertical (half the lift stroke 100 mm = 50 mm)", 50, 440))):
        s.text(40, y0, ttl, 12.5, bold=True)
        sc = 9.0
        for i, (n, v) in enumerate(lst):
            y = y0 + 20 + i * 30
            s.text(330, y + 15, n, 11.5, "end"); s.rect(340, y + 3, v * sc, 18, "url(#hatchA)", AC, 1); s.text(345 + v * sc, y + 16, f"± {v}", 11.5)
        rss = math.sqrt(sum(v * v for _, v in lst)); sm = sum(v for _, v in lst)
        y = y0 + 20 + len(lst) * 30 + 6
        s.text(330, y + 15, "RSS", 12, "end", bold=True); s.rect(340, y + 3, rss * sc, 18, AC, AC); s.text(345 + rss * sc, y + 16, f"± {rss:.1f}", 12, bold=True)
        s.text(330, y + 45, "worst case Σ", 12, "end", bold=True); s.rect(340, y + 33, sm * sc, 18, "#555", "#555"); s.text(345 + sm * sc, y + 46, f"± {sm}", 12, bold=True)
        s.line(340 + avail * sc, y0 + 10, 340 + avail * sc, y + 58, 1.6, "#b00000", "6 3"); s.text(345 + avail * sc, y0 + 22, f"free space {avail} mm", 11.5, c="#b00000")
    s.text(40, 790, "Values are planning examples – the crane maker states the positioning accuracy; the rack maker the tolerance class (EN 15620 / FEM 9.831).", 11.5)
    save("31_positioning_budget.svg", s)

for fn in (rack_elevation, slot_numbering, crane_ga, drive_train, fem, io_layout, load_diagram, mast_model, budget): fn()
