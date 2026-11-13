/* AS/RS item 6 – manufacturing twin: animated SVG of ONE operation of a part route (no libraries).
 * opSvg(routeKey, op, t) → SVG string for the operation type op[0] at progress t (0…1). Part side views are simplified shapes.
 * Op types: cut bevel fit weld check straight srelief machine ndt paint mark turn harden asm. ALL VALUES ARE EXAMPLES.
 */
const VW = 760, VH = 330, HOT = "#f07a1a", STEEL = "#b9c0c7", DARK = "#38414a", ACC = "#1f6fd1", RUST = "#9b6a43", PAINT = "#f0b323";
const ease = (t) => t * t * (3 - 2 * t);
const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const R = (x, y, w, h, fill, extra = "") => `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(0, w).toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" fill="${fill}" ${extra}/>`;
const T = (x, y, s, size = 12, extra = "") => `<text x="${x}" y="${y}" font-size="${size}" ${extra}>${s}</text>`;
const L = (x1, y1, x2, y2, st = DARK, w = 1.5, extra = "") => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${st}" stroke-width="${w}" ${extra}/>`;
const Ci = (x, y, r, fill, extra = "") => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${Math.max(0, r).toFixed(1)}" fill="${fill}" ${extra}/>`;

/* part outline (side view) as a list of rects [x, y, w, h] in a 0…520 × 0…120 box */
const SHAPE = {
  mast: [[0, 40, 520, 40]], bottom: [[0, 50, 520, 34], [20, 30, 80, 20], [420, 30, 80, 20], [70, 84, 60, 26], [400, 84, 60, 26]],
  wheel: [[200, 10, 120, 100], [140, 52, 240, 16]], carriage: [[40, 10, 40, 100], [80, 90, 360, 20], [420, 30, 20, 60]],
  top: [[60, 50, 400, 36], [100, 20, 60, 30], [360, 20, 60, 30]], fork: [[0, 40, 480, 16], [40, 58, 440, 14], [80, 74, 400, 12]], drum: [[100, 25, 320, 70], [40, 52, 440, 16]],
};
const SEAMS = { mast: [[0, 40, 520, 40], [0, 80, 520, 80]], bottom: [[0, 50, 520, 50], [0, 84, 520, 84]], wheel: [[200, 10, 320, 10]], carriage: [[80, 90, 80, 110], [420, 90, 440, 90]],
  top: [[100, 50, 160, 50], [360, 50, 420, 50]], fork: [[40, 58, 480, 58]], drum: [[100, 25, 100, 95], [420, 25, 420, 95]] };
const partSvg = (k, ox, oy, fill = STEEL, st = DARK) => (SHAPE[k] || SHAPE.mast).map(([x, y, w, h]) => R(ox + x, oy + y, w, h, fill, `stroke="${st}" stroke-width="1.2"`)).join("");

function frame(title, sub, t, body) {
  return `<svg viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg" font-family="Arial, Helvetica, sans-serif" role="img" aria-label="${title}">
  ${R(0, 0, VW, VH, "#ffffff")}${R(0.5, 0.5, VW - 1, VH - 1, "none", `stroke="#c8ced4"`)}
  ${T(14, 22, title, 14, 'font-weight="bold" fill="#111"')}${T(14, 40, sub, 11.5, 'fill="#555"')}
  ${body}
  ${R(14, VH - 16, VW - 28, 6, "#e3e7ea", 'rx="3"')}${R(14, VH - 16, (VW - 28) * cl(t), 6, ACC, 'rx="3"')}
  ${T(VW - 14, 22, "EXAMPLE – the crane maker's drawings decide", 11, 'text-anchor="end" fill="#888"')}</svg>`;
}

/* the operation scenes (ox, oy = part origin) */
const OPS = {
  cut(k, t) {
    const ox = 110, oy = 90, P = R(70, 70, 620, 190, "#c9ced3", 'stroke="#888"'), nest = (SHAPE[k] || SHAPE.mast).map(([x, y, w, h]) => R(ox + x, oy + y, w, h, "none", `stroke="${DARK}" stroke-dasharray="5 4"`)).join("");
    const per = (SHAPE[k] || SHAPE.mast)[0], len = 2 * (per[2] + per[3]), d = len * ease(t);
    let x = ox + per[0], y = oy + per[1], s = "", left = d;
    for (const [dx, dy] of [[per[2], 0], [0, per[3]], [-per[2], 0], [0, -per[3]]]) { const seg = Math.abs(dx + dy), u = cl(left / seg); s += L(x, y, x + dx * u, y + dy * u, "#111", 2.5); if (left < seg) { x += dx * u; y += dy * u; left = -1; break; } x += dx; y += dy; left -= seg; }
    const sp = Array.from({ length: 10 }, (_, i) => Ci(x + Math.sin(t * 90 + i) * 8, y + 6 + i * 3, 1.6, HOT)).join("");
    return P + nest + s + `<polygon points="${x - 9},${y - 46} ${x + 9},${y - 46} ${x + 3},${y - 8} ${x - 3},${y - 8}" fill="${DARK}"/>` + Ci(x, y, 5, "#ffd34d") + sp +
      T(80, 290, "nesting: parts placed to use the plate; kerf compensated; heat number marked on every part", 12, 'fill="#333"');
  },
  bevel(k, t) {
    const ox = 120, oy = 120; const bev = 40 * ease(t);
    return R(ox, oy, 420, 60, STEEL, `stroke="${DARK}"`) + `<polygon points="${ox + 420},${oy} ${ox + 420},${oy + 60} ${ox + 420 - bev * 0.0},${oy + 60} ${ox + 420 - bev},${oy}" fill="#fff" stroke="${DARK}"/>` +
      Ci(ox + 420 - bev / 2, oy + 30 - 40 + t * 60, 26, "#9aa3ab", `stroke="${DARK}"`) + L(ox + 420 - bev / 2, oy - 40 + t * 60 + 30, ox + 470, oy - 60, DARK, 6) +
      T(ox + 440, oy + 90, "HV 45°, land 1–2 mm", 12, 'fill="#333"') + T(80, 290, "edge prepared for a partial / full penetration weld – check angle with a gauge", 12, 'fill="#333"');
  },
  fit(k, t) {
    const ox = 110, oy = 100, n = 9, shown = Math.floor(n * cl(t * 1.2));
    let s = R(90, oy + 128, 580, 18, "url(#sr6h)", `stroke="${DARK}"`) + partSvg(k, ox, oy);
    for (let i = 0; i < 4; i++) { const x = ox + 40 + i * 140, c = ease(cl(t * 3 - i * 0.3)); s += R(x, oy - 30 + 18 * c, 14, 30, ACC) + R(x - 8, oy + 125, 30, 10, ACC); }
    for (let i = 0; i < shown; i++) { const x = ox + 20 + i * 60; s += Ci(x, oy + (SHAPE[k] ? SHAPE[k][0][1] : 40), 4, HOT) + Ci(x, oy + (SHAPE[k] ? SHAPE[k][0][1] + SHAPE[k][0][3] : 80), 4, HOT); }
    return `<defs><pattern id="sr6h" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#888"/></pattern></defs>` + s +
      T(80, 290, `jig + clamps; tacks 30–40 mm every ≈ 300 mm (${shown}/${n} placed); check diagonals BEFORE welding (hold point)`, 12, 'fill="#333"');
  },
  weld(k, t) {
    const ox = 110, oy = 80; let s = partSvg(k, ox, oy);
    const seams = SEAMS[k] || SEAMS.mast, nS = k === "mast" ? 4 : seams.length;
    // mast: cross-section inset with the diagonal order 1-2, 3-4
    if (k === "mast") {
      const cx = 640, cy = 170, w = 70, h = 100, order = [[cx - w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx + w / 2, cy - h / 2], [cx - w / 2, cy + h / 2]];
      s += R(cx - w / 2, cy - h / 2, w, h, "none", `stroke="${DARK}" stroke-width="5"`);
      order.forEach(([x, y], i) => { const u = cl(t * 4 - i); s += Ci(x, y, 9, u >= 1 ? "#777" : u > 0 ? HOT : "#fff", `stroke="${DARK}"`) + T(x - 4, y + 4, String(i + 1), 11, 'fill="#111" font-weight="bold"'); });
      s += T(cx - 60, cy + h / 2 + 24, "order: 1 + 2 diagonal,", 11.5, 'fill="#333"') + T(cx - 60, cy + h / 2 + 38, "then 3 + 4", 11.5, 'fill="#333"');
      const cur = Math.min(3, Math.floor(t * 4)), u = t * 4 - cur, segs = 5; // backstep: 5 segments from the middle out
      for (let j = 0; j < segs; j++) { const a = cl(u * segs - j); const x0 = ox + 260 + (j % 2 ? -1 : 1) * Math.ceil(j / 2) * 52 - (j % 2 ? 52 : 0), y = oy + (cur % 2 ? 80 : 40); s += L(x0, y, x0 + 52 * a, y, a >= 1 ? "#666" : HOT, 5); }
      s += T(ox, oy + 120, `seam ${cur + 1}: backstep segments from the middle out; 26 V · 240 A · 6 mm/s → 832 J/mm`, 12, 'fill="#333"');
    } else {
      seams.forEach(([x1, y1, x2, y2], i) => { const u = ease(cl(t * nS - i)); s += L(ox + x1, oy + y1, ox + x1 + (x2 - x1) * u, oy + y1 + (y2 - y1) * u, u >= 1 ? "#666" : HOT, 5); });
      const i = Math.min(nS - 1, Math.floor(t * nS)), [x1, y1, x2, y2] = seams[i], u = cl(t * nS - i);
      s += `<polygon points="${ox + x1 + (x2 - x1) * u - 6},${oy + y1 + (y2 - y1) * u - 40} ${ox + x1 + (x2 - x1) * u + 6},${oy + y1 + (y2 - y1) * u - 40} ${ox + x1 + (x2 - x1) * u},${oy + y1 + (y2 - y1) * u - 4}" fill="${DARK}"/>`;
      s += T(ox, oy + 150, "MAG 135, alternate sides to balance the shrinkage; VT 100 % after welding", 12, 'fill="#333"');
    }
    const fl = Ci(110 + 260, 60, 0, "none"); return s + fl;
  },
  check(k, t) {
    const ox = 110, oy = 120, bow = 14 * (1 - 0.0 * t); let s = `<path d="M${ox},${oy} Q${ox + 260},${oy - bow * 2} ${ox + 520},${oy}" fill="none" stroke="${DARK}" stroke-width="30" stroke-opacity="0.25"/>`;
    s += partSvg(k, ox, oy - 40, "none", "#aaa") + L(ox - 20, oy - 26, ox + 540, oy - 26, "#e02020", 1.5, 'stroke-dasharray="6 4"');
    const n = Math.floor(9 * t); for (let i = 0; i <= n; i++) { const x = ox + i * 65, dev = Math.sin(Math.PI * i / 8) * 2.1; s += L(x, oy - 26, x, oy - 26 + dev * 6, ACC, 2) + T(x - 8, oy - 34, dev.toFixed(1), 11, `fill="${ACC}"`); }
    for (const x of [ox + 20, ox + 260, ox + 500]) s += `<polygon points="${x - 14},${oy + 60} ${x + 14},${oy + 60} ${x},${oy + 22}" fill="#777"/>`;
    return s + T(80, 270, "laser line / taut wire, every 1 m, both axes; measured max 2.1 mm ≤ L/3000 ≈ 3 mm (example) → OK, else straighten", 12, 'fill="#333"');
  },
  straight(k, t) {
    const ox = 110, oy = 140, bow = 24 * (1 - ease(t) * 0.85);
    let s = `<path d="M${ox},${oy} Q${ox + 260},${oy - bow * 2} ${ox + 520},${oy}" fill="none" stroke="${STEEL}" stroke-width="34"/>`;
    for (let i = 0; i < 5; i++) { const x = ox + 120 + i * 70, on = t > i * 0.18 && t < i * 0.18 + 0.3; s += `<polygon points="${x - 14},${oy - bow - 17} ${x + 14},${oy - bow - 17} ${x},${oy - bow + 10}" fill="${on ? HOT : "#e8b48a"}" opacity="${on ? 1 : 0.45}"/>`; }
    return s + T(80, 270, "heat wedges on the CONVEX side, ≤ 650 °C (dark red) for S355+N, cool in air → the wedge shrinks and pulls the bow back", 12, 'fill="#333"');
  },
  srelief(k, t) {
    let s = R(60, 70, 300, 170, "#5a5f66", 'rx="6"') + R(75, 85, 270, 140, `rgb(${Math.round(60 + 180 * Math.sin(Math.PI * cl(t)))},40,20)`) + partSvg(k, 85, 120, STEEL, "#222").replace(/width="(\d+)/g, (m, w) => `width="${(+w * 0.5).toFixed(0)}`);
    const gx = 400, gy = 240, gw = 330, gh = 160, pts = [[0, 20], [0.3, 600], [0.55, 600], [0.9, 300], [1, 120]].map(([u, T2]) => [gx + u * gw, gy - T2 / 650 * gh]);
    s += L(gx, gy, gx + gw, gy, DARK) + L(gx, gy, gx, gy - gh, DARK) + `<polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${ACC}" stroke-width="2.5"/>`;
    let i = 1; while (i < pts.length - 1 && (pts[i][0] - gx) / gw < t) i++; const u = cl(((t * gw + gx) - pts[i - 1][0]) / Math.max(1, pts[i][0] - pts[i - 1][0])), cx = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, cy = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u;
    s += Ci(cx, cy, 6, HOT) + T(gx + 4, gy - gh - 6, "°C", 11) + T(gx + 0.3 * gw, gy - 600 / 650 * gh - 8, "580–620 °C hold ≈ 2 min/mm (min 1 h)", 11, 'fill="#333"') + T(gx + gw - 140, gy + 16, "time → slow cool < 100 °C/h", 11, 'fill="#333"');
    return s + T(60, 280, "bogie furnace; thermocouples ON the part; chart = quality record. Releases weld stresses before machining.", 12, 'fill="#333"');
  },
  machine(k, t) {
    const ox = 110, oy = 140; let s = R(80, oy + 70, 600, 24, "#7d858c") + partSvg(k, ox, oy - 40);
    const pads = (SHAPE[k] || SHAPE.mast).slice(0, 3), x = ox + 20 + 470 * ease(t);
    for (const [px, py, pw] of pads) { const done = cl((x - (ox + px)) / pw); s += R(ox + px, oy - 40 + py - 3, pw * done, 4, "#7fc8ff"); }
    const a = t * 60; s += R(x - 22, oy - 150, 44, 90, "#56606a") + `<g transform="translate(${x},${oy - 48}) rotate(${(a * 57) % 360})">${Ci(0, 0, 18, "#c3c9ce", `stroke="${DARK}"`)}${L(-18, 0, 18, 0, DARK, 2)}${L(0, -18, 0, 18, DARK, 2)}</g>`;
    return s + T(80, 280, "one set-up on the boring / milling machine: datums A/B/C, pads flat 0.05–0.1, bores H7, CMM / laser-tracker report", 12, 'fill="#333"');
  },
  ndt(k, t) {
    const ox = 110, oy = 120; let s = partSvg(k, ox, oy - 40) + L(ox, oy, ox + 520, oy, "#666", 5);
    const x = ox + 20 + 480 * t; s += `<path d="M${x - 20},${oy - 4} L${x - 20},${oy - 40} L${x + 20},${oy - 40} L${x + 20},${oy - 4}" fill="none" stroke="${ACC}" stroke-width="8"/>`;
    for (let i = 0; i < 14; i++) s += Ci(x - 22 + (i * 7) % 44, oy + 3 + (i % 3) * 2, 1.4, "#444");
    const hit = t > 0.55 && t < 0.75; if (hit) s += L(ox + 300, oy - 3, ox + 306, oy + 3, "#e02020", 3) + T(ox + 290, oy + 30, "indication 2 mm – below the ISO 23278 limit → OK", 11.5, 'fill="#e02020"');
    return s + T(80, 280, "MT yoke (ISO 17638): magnetise, spray particles, look for lines across the weld; level 2 operator (ISO 9712)", 12, 'fill="#333"');
  },
  paint(k, t) {
    const ox = 110, oy = 120, blast = t < 0.5, u = blast ? t / 0.5 : (t - 0.5) / 0.5;
    const col = blast ? RUST : "#aab2b9", col2 = blast ? "#aab2b9" : PAINT;
    let s = partSvg(k, ox, oy - 40, col) + `<clipPath id="sr6pc"><rect x="${ox}" y="0" width="${520 * u}" height="${VH}"/></clipPath><g clip-path="url(#sr6pc)">${partSvg(k, ox, oy - 40, col2)}</g>`;
    const nx = ox + 520 * u; s += R(nx - 6, oy - 120, 12, 50, DARK);
    for (let i = 0; i < 12; i++) s += Ci(nx + Math.sin(i * 7 + t * 40) * 14, oy - 64 + i * 6, blast ? 1.6 : 2.4, blast ? "#777" : PAINT, `opacity="0.8"`);
    const dft = blast ? "" : ` · DFT ${(160 * u).toFixed(0)} / 160 µm`;
    return s + T(80, 280, blast ? "blasting Sa 2½ (ISO 8501-1), roughness medium G (ISO 8503) – rust and mill scale off" : `airless spray: EP primer 80 µm + PUR top 80 µm (C3)${dft} – machined faces masked`, 12, 'fill="#333"');
  },
  mark(k, t) {
    const ox = 110, oy = 120, hit = t > 0.4; let s = partSvg(k, ox, oy - 40, PAINT);
    s += R(ox + 200, oy - 120 + (hit ? 40 : 40 * ease(t / 0.4)), 50, 50, DARK) + (hit ? T(ox + 170, oy + 4, "SC-01 · P-007 · H 4721", 14, 'fill="#111" font-family="monospace"') : "");
    return s + T(80, 280, "crane no., part no., heat no. of the plate (traceability to the 3.1 certificate), weld-map reference", 12, 'fill="#333"');
  },
  turn(k, t) {
    const ox = 130, oy = 150; let s = R(60, oy - 60, 60, 120, "#56606a") + R(640, oy - 20, 60, 40, "#56606a");
    for (let i = 0; i < 12; i++) { const y = oy - 50 + ((i * 9 + t * 300) % 100); s += L(ox, y, ox + 500, y, "#d4d9dd", 2); }
    s += R(ox, oy - 50, 500, 100, "none", `stroke="${DARK}" stroke-width="1.5"`) + R(ox, oy - 50, 500 * (1 - ease(t)), 6, "#9aa3ab");
    const x = ox + 500 * (1 - ease(t)); s += `<polygon points="${x},${oy - 52} ${x + 16},${oy - 90} ${x + 30},${oy - 90}" fill="${DARK}"/>`;
    for (let i = 0; i < 5; i++) s += `<path d="M${x + 4},${oy - 58} q ${8 + i * 3},${-10 - i * 4} ${16 + i * 2},${-2}" stroke="#a98" fill="none"/>`;
    return s + T(60, 280, "CNC lathe: seats Ø80 m6 / k6, shoulders with R2 radius (no sharp corner), grooves for the drum", 12, 'fill="#333"');
  },
  harden(k, t) {
    const cx = 380, cy = 150, r = 100; let s = Ci(cx, cy, r, STEEL, `stroke="${DARK}" stroke-width="1.5"`) + Ci(cx, cy, 30, "#fff", `stroke="${DARK}"`);
    const a = t * Math.PI * 2; s += `<path d="M${cx + r * Math.cos(a - 0.6)},${cy + r * Math.sin(a - 0.6)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}" stroke="${HOT}" stroke-width="10" fill="none"/>`;
    s += R(cx + (r + 8) * Math.cos(a) - 10, cy + (r + 8) * Math.sin(a) - 10, 20, 20, "#b87333");
    return s + T(60, 280, "induction coil heats the tread to ≈ 900 °C, water quench → 50–55 HRC, depth 3–5 mm; then temper 180 °C", 12, 'fill="#333"');
  },
  asm(k, t) {
    const ox = 110, oy = 120; let s = partSvg(k, ox, oy - 40);
    for (let i = 0; i < 5; i++) { const u = ease(cl(t * 2 - i * 0.25)), x = ox + 60 + i * 100, y = oy - 40 - 90 * (1 - u); s += Ci(x, y, 16, i % 2 ? "#3a6ea8" : "#1d1f21", `stroke="${DARK}"`); }
    return s + T(80, 280, "fit bearings (heated ≈ 110 °C, never with a flame), rollers, seals; set play; function test on the bench", 12, 'fill="#333"');
  },
};
export function opSvg(routeKey, op, t, idx, n) {
  const f = OPS[op[0]] || OPS.asm;
  return frame(`${idx + 1}/${n} · ${op[1]}`, `${op[2]} · ≈ ${op[4]} min (example)`, t, f(routeKey, cl(t)));
}
export const OP_TYPES = Object.keys(OPS);
