/* ROBOT tab – item 3 "Control circuits": SVG SYMBOL LIBRARY + drawing frame (IEC 60617 style, device tags IEC 81346).
 * A "pen" collects SVG strings for one page. Coordinates: page 1190 × 842 (A3 landscape shape), grid 10, power / signal flow
 * from top to bottom. Columns 1–8 across the top (for cross-references "page.column", e.g. /4.6).
 * Symbols are drawn VERTICAL: (x, y) = upper terminal, the symbol is 40 long (lower terminal at y + 40).
 */
export const PW = 1190, PH = 842, X0 = 30, X1 = 1160, NCOL = 8;
const CW = (X1 - X0) / NCOL;
export const colOf = (x) => Math.max(1, Math.min(NCOL, Math.floor((x - X0) / CW) + 1));
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// cross-reference registry: key -> [{p, c}] (filled by a first drawing pass over all pages)
export const REG = new Map();
export function refOf(key, notPage) {
  const l = REG.get(key); if (!l || !l.length) return "";
  return l.filter((e) => e.p !== notPage || true).map((e) => `/${e.p}.${e.c}`).join(" ");
}

export function pen(page, opt = {}) {
  const s = [];
  const P = {
    page,
    raw(x) { s.push(x); return P; },
    reg(key, x) { const l = REG.get(key) || []; if (!l.some((e) => e.p === page && e.c === colOf(x))) l.push({ p: page, c: colOf(x) }); REG.set(key, l); return P; },
    ref(key) { return refOf(key, page); },
    /* ---------------- text */
    t(x, y, txt, o = {}) {
      const cls = ["ck-tx", o.c ? "ck-" + o.c : "", o.b ? "ck-b" : "", o.cls || ""].filter(Boolean).join(" ");
      const tr = o.rot ? ` transform="rotate(${o.rot} ${x} ${y})"` : "";
      s.push(`<text x="${x}" y="${y}" class="${cls}" text-anchor="${o.a || "start"}"${o.s ? ` font-size="${o.s}"` : ""}${tr}${o.id ? ` id="${o.id}"` : ""}>${o.html ? txt : esc(txt)}</text>`);
      return P;
    },
    // tag (bold) + lines of description below (small)
    tag(x, y, tag, lines = [], o = {}) {
      P.t(x, y, tag, { b: 1, a: o.a, s: o.s || 12 });
      (Array.isArray(lines) ? lines : [lines]).forEach((l, i) => l && P.t(x, y + 12 + i * 11, l, { a: o.a, s: 10, c: o.c || "mut" }));
      return P;
    },
    /* ---------------- wires */
    // cls: L1 L2 L3 N PE DC 24 0V ext sig bus sh ; st: true = energised, false = dead, undefined = neutral ; flow: animate
    w(pts, cls, st, o = {}) {
      const d = "M" + pts.map((p) => p[0] + "," + p[1]).join(" L");
      const dead = st === false ? " ck-dead" : "";
      s.push(`<path d="${d}" class="ck-w ck-w-${cls}${dead}${o.cls ? " " + o.cls : ""}"${o.id ? ` id="${o.id}"` : ""}/>`);
      if (cls === "PE") s.push(`<path d="${d}" class="ck-w ck-w-PEy${dead}"/>`);
      if (cls === "0V") s.push(`<path d="${d}" class="ck-w ck-w-0Vs${dead}"/>`);
      if (st === true && o.flow !== false) s.push(`<path d="${d}" class="ck-flow${o.rev ? " ck-rev" : ""}${o.fcls ? " " + o.fcls : ""}"/>`);
      return P;
    },
    dot(x, y) { s.push(`<circle cx="${x}" cy="${y}" r="2.6" class="ck-dot"/>`); return P; },
    // terminal of a terminal strip: small circle, label (e.g. "X2:5")
    term(x, y, lab, o = {}) {
      s.push(`<circle cx="${x}" cy="${y}" r="3.2" class="ck-term"/>`);
      if (lab) P.t(x + (o.left ? -6 : 6), y + 3.5, lab, { a: o.left ? "end" : "start", s: 9.5, c: "mut" });
      return P;
    },
    // potential / page reference arrow: text like "L1 → /2.1"
    xref(x, y, txt, o = {}) { P.t(x, y, txt, { a: o.a || "start", s: 10, c: "ref" }); return P; },
    /* ---------------- contacts */
    // type NO | NC ; act = actuated (drawn in the switched position, highlighted) ; fn: '' | 'ctr' (contactor) | 'brk' (breaker) | 'dis' (disconnector)
    contact(x, y, o = {}) {
      const nc = o.type === "NC", act = !!o.act, closed = nc ? !act : act;
      const cls = "ck-sym" + (act && o.hl !== false ? " ck-act" : "");
      let g = `<g class="${cls}"><path d="M${x},${y} V${y + 12} M${x},${y + 28} V${y + 40}"/>`;
      if (nc) g += `<path d="M${x},${y + 12} H${x + 8}"/>`;
      const tip = closed ? (nc ? [x + 10, y + 10] : [x + 4, y + 11]) : [x - 10, y + 13];
      g += `<path d="M${x},${y + 28} L${tip[0]},${tip[1]}"/>`;
      if (o.fn === "ctr") g += `<path d="M${x - 3.5},${y + 12} A3.5,3.5 0 0 0 ${x + 3.5},${y + 12}" />`;
      if (o.fn === "brk") g += `<path d="M${x - 3.5},${y + 8.5} L${x + 3.5},${y + 15.5} M${x + 3.5},${y + 8.5} L${x - 3.5},${y + 15.5}"/>`;
      if (o.fn === "dis") g += `<path d="M${x - 4},${y + 12} H${x + 4}"/>`;
      g += "</g>";
      s.push(g);
      if (o.t1) P.t(x + 5, y + 9, o.t1, { s: 9, c: "mut" });
      if (o.t2) P.t(x + 5, y + 38, o.t2, { s: 9, c: "mut" });
      return P;
    },
    // dashed mechanical link at height y from x0 to x1 (actuator / coupled poles)
    link(x0, x1, y) { s.push(`<path d="M${x0},${y} H${x1}" class="ck-mech"/>`); return P; },
    // actuator at (x, y) (right end touches the link): push | mush (e-stop) | key | pos (cam / roller) | turn | hand
    act(x, y, kind) {
      let g = "";
      if (kind === "push") g = `<path d="M${x},${y} H${x - 6} M${x - 6},${y - 6} V${y + 6} M${x - 6},${y - 6} H${x - 2} M${x - 6},${y + 6} H${x - 2}"/>`;
      else if (kind === "mush") g = `<path d="M${x},${y} H${x - 6}"/><path d="M${x - 6},${y - 9} A9,9 0 0 0 ${x - 6},${y + 9} Z" class="ck-estop"/>`;
      else if (kind === "key") g = `<path d="M${x},${y} H${x - 8}"/><circle cx="${x - 12}" cy="${y}" r="4"/><path d="M${x - 12},${y - 4} V${y - 8}"/>`;
      else if (kind === "pos") g = `<path d="M${x},${y} H${x - 5} L${x - 13},${y - 6} V${y + 6} Z"/>`;
      else if (kind === "turn") g = `<path d="M${x},${y} H${x - 6} M${x - 6},${y - 6} V${y + 6} M${x - 6},${y - 6} L${x - 10},${y - 6} M${x - 6},${y + 6} L${x - 2},${y + 6}"/>`;
      else if (kind === "hand") g = `<path d="M${x},${y} H${x - 6} M${x - 10},${y - 6} H${x - 6} V${y + 6} H${x - 10}"/>`;
      s.push(`<g class="ck-sym">${g}</g>`);
      return P;
    },
    // positive (forced) opening symbol on a link (IEC 60947-5-1): circle with an arrow
    forced(x, y) { s.push(`<g class="ck-sym"><circle cx="${x}" cy="${y}" r="5" class="ck-bg"/><path d="M${x - 3},${y} H${x + 2.5} M${x + 0.5},${y - 2} L${x + 2.5},${y} L${x + 0.5},${y + 2}"/></g>`); return P; },
    /* ---------------- passive + loads */
    coil(x, y, o = {}) {
      const on = !!o.on, k = o.kind || "relay";
      let g = `<g class="ck-sym${on ? " ck-on" : ""}"><path d="M${x},${y} V${y + 12} M${x},${y + 28} V${y + 40}"/><rect x="${x - 13}" y="${y + 12}" width="26" height="16" class="ck-fill"/>`;
      if (k === "valve") g += `<path d="M${x - 13},${y + 28} L${x + 13},${y + 12}"/>`;
      if (k === "safety") g += `<path d="M${x - 13},${y + 12} V${y + 28}" stroke-width="4"/>`;
      if (k === "lock") g += `<path d="M${x - 7},${y + 24} H${x + 7} M${x - 4},${y + 24} V${y + 17} A4,4 0 0 1 ${x + 4},${y + 17} V${y + 24}"/>`;
      if (k === "brake") g += `<path d="M${x - 8},${y + 16} V${y + 24} M${x + 8},${y + 16} V${y + 24} M${x - 8},${y + 20} H${x + 8}"/>`;
      g += "</g>";
      s.push(g);
      if (o.t !== false) { P.t(x + 5, y + 9, (o.t || ["A1", "A2"])[0], { s: 9, c: "mut" }); P.t(x + 5, y + 38, (o.t || ["A1", "A2"])[1], { s: 9, c: "mut" }); }
      return P;
    },
    res(x, y, o = {}) { s.push(`<g class="ck-sym${o.on ? " ck-hot" : ""}"><path d="M${x},${y} V${y + 10} M${x},${y + 30} V${y + 40}"/><rect x="${x - 5}" y="${y + 10}" width="10" height="20" class="ck-fill"/></g>`); return P; },
    resH(x, y, o = {}) { s.push(`<g class="ck-sym${o.on ? " ck-hot" : ""}"><path d="M${x},${y} H${x + 10} M${x + 30},${y} H${x + 40}"/><rect x="${x + 10}" y="${y - 5}" width="20" height="10" class="ck-fill"/></g>`); return P; },
    fuse(x, y, o = {}) { s.push(`<g class="ck-sym${o.act ? " ck-act" : ""}"><path d="M${x},${y} V${y + 40}"/><rect x="${x - 5}" y="${y + 8}" width="10" height="24" class="ck-fill"/><path d="M${x},${y + 8} V${y + 32}"/></g>`); return P; },
    cap(x, y, o = {}) { s.push(`<g class="ck-sym"><path d="M${x},${y} V${y + 17} M${x},${y + 23} V${y + 40} M${x - 11},${y + 17} H${x + 11}"/><path d="M${x - 11},${y + 23} H${x + 11}"/>${o.pol ? `<path d="M${x + 7},${y + 8} H${x + 13} M${x + 10},${y + 5} V${y + 11}"/>` : ""}</g>`); return P; },
    // diode, vertical, conducting downward (anode top). up: conducting upward
    diode(x, y, o = {}) {
      const a = o.up ? y + 27 : y + 13, b = o.up ? y + 13 : y + 27;
      s.push(`<g class="ck-sym${o.on ? " ck-act" : ""}"><path d="M${x},${y} V${y + 40}"/><path d="M${x - 7},${a} H${x + 7} L${x},${b} Z" class="ck-fillt"/><path d="M${x - 7},${b} H${x + 7}"/></g>`);
      return P;
    },
    // diode horizontal, conducting to the right
    diodeH(x, y) { s.push(`<g class="ck-sym"><path d="M${x},${y} H${x + 40}"/><path d="M${x + 13},${y - 7} V${y + 7} L${x + 27},${y} Z" class="ck-fillt"/><path d="M${x + 27},${y - 7} V${y + 7}"/></g>`); return P; },
    // IGBT (vertical, collector top, emitter bottom) with anti-parallel diode; gate on the left. on = conducting (highlight)
    igbt(x, y, o = {}) {
      const c = o.on ? " ck-act" : "", gb = o.blocked ? " ck-dead" : "";
      s.push(`<g class="ck-sym${c}"><path d="M${x},${y} V${y + 10} L${x - 8},${y + 16} M${x - 8},${y + 24} L${x},${y + 30} V${y + 40} M${x - 8},${y + 13} V${y + 27}"/>` +
        `<path d="M${x - 4},${y + 27.5} L${x},${y + 30} L${x - 4.5},${y + 31}" /><path d="M${x - 11},${y + 14} V${y + 26} M${x - 11},${y + 20} H${x - 18}" class="${gb}"/>` +
        `<path d="M${x},${y + 10} H${x + 10} V${y + 30} H${x}"/><path d="M${x + 5},${y + 24} H${x + 15} L${x + 10},${y + 16} Z" class="ck-fillt"/><path d="M${x + 5},${y + 16} H${x + 15}"/></g>`);
      return P;
    },
    lamp(x, y, o = {}) { s.push(`<g class="ck-sym${o.on ? " ck-lampon" : ""}"><path d="M${x},${y} V${y + 11} M${x},${y + 29} V${y + 40}"/><circle cx="${x}" cy="${y + 20}" r="9" class="ck-fill"/><path d="M${x - 6.4},${y + 13.6} L${x + 6.4},${y + 26.4} M${x + 6.4},${y + 13.6} L${x - 6.4},${y + 26.4}"/></g>`); return P; },
    motor(x, y, r, o = {}) { s.push(`<g class="ck-sym${o.on ? " ck-on" : ""}"><circle cx="${x}" cy="${y}" r="${r}" class="ck-fill"/></g>`); P.t(x, y - 1, "M", { a: "middle", s: r > 20 ? 15 : 13, b: 1 }); P.t(x, y + 13, o.sub || "3~", { a: "middle", s: 10 }); return P; },
    // protective earth symbol at (x, y) (wire comes from above)
    pe(x, y) { s.push(`<g class="ck-sym ck-pesym"><path d="M${x},${y} V${y + 8} M${x - 9},${y + 8} H${x + 9} M${x - 6},${y + 12} H${x + 6} M${x - 3},${y + 16} H${x + 3}"/><circle cx="${x}" cy="${y + 11}" r="11"/></g>`); return P; },
    // functional earth / chassis
    gnd(x, y) { s.push(`<g class="ck-sym"><path d="M${x},${y} V${y + 8} M${x - 9},${y + 8} H${x + 9} M${x - 6},${y + 12} H${x + 6} M${x - 3},${y + 16} H${x + 3}"/></g>`); return P; },
    // generic device box; title/tag inside or outside
    box(x, y, w, h, o = {}) {
      s.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx || 2}" class="ck-box${o.dash ? " ck-dash" : ""}${o.on ? " ck-boxon" : ""}${o.cls ? " " + o.cls : ""}"/>`);
      return P;
    },
    // LED-like status dot
    led(x, y, on, o = {}) { s.push(`<circle cx="${x}" cy="${y}" r="${o.r || 4}" class="ck-led ${on === true ? (o.bad ? "ck-ledbad" : "ck-ledon") : on === "bad" ? "ck-ledbad" : ""}"/>`); return P; },
    // clickable hit area for the info box
    hit(key, x, y, w, h) { s.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" class="ck-hit" data-ck="${key}"><title>${esc(key)}</title></rect>`); return P; },
    out() { return s.join(""); },
  };
  return P;
}

// page frame: border, column numbers 1–8, row letters A–F, title block
export function frame(P, o) {
  const s = [];
  s.push(`<rect x="16" y="16" width="${PW - 32}" height="${PH - 32}" class="ck-frame"/>`);
  s.push(`<rect x="${X0}" y="32" width="${X1 - X0}" height="${764 - 32}" class="ck-frame2"/>`);
  for (let i = 0; i < NCOL; i++) {
    const x = X0 + i * CW;
    s.push(`<path d="M${x},16 V32" class="ck-frame2"/>`);
    s.push(`<text x="${x + CW / 2}" y="28" text-anchor="middle" class="ck-tx ck-mut" font-size="10">${i + 1}</text>`);
  }
  "ABCDEF".split("").forEach((L, i) => { const y = 32 + i * 122; s.push(`<path d="M16,${y} H${X0}" class="ck-frame2"/><text x="23" y="${y + 64}" text-anchor="middle" class="ck-tx ck-mut" font-size="10">${L}</text>`); });
  // title block
  const y = 764, h = PH - 16 - y;
  const cells = [[X0, 220, "Project", "Compressor factory – robot cell R1"], [X0 + 220, 290, "Page title", o.title], [X0 + 510, 200, "Robot / controller", o.robot],
    [X0 + 710, 190, "Drawn to", "IEC 60617 · 81346 · 60204-1"], [X0 + 900, 170, "Status", "EXAMPLE – not for manufacture"], [X0 + 1070, X1 - X0 - 1070, "Page", `${o.page} / ${o.of}`]];
  cells.forEach(([x, w, k, v]) => {
    s.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" class="ck-frame2"/>`);
    s.push(`<text x="${x + 5}" y="${y + 13}" class="ck-tx ck-mut" font-size="9">${esc(k)}</text>`);
    s.push(`<text x="${x + 5}" y="${y + 34}" class="ck-tx${k === "Status" ? " ck-warnTx" : ""}" font-size="${k === "Page" ? 16 : k === "Status" ? 10 : k === "Page title" ? 11.5 : 10.5}"${k === "Page title" || k === "Page" ? ' font-weight="700"' : ""}>${esc(v)}</text>`);
    if (k === "Status") s.push(`<text x="${x + 5}" y="${y + 50}" class="ck-tx ck-mut" font-size="9">real design: qualified designer</text>`);
    if (k === "Project") s.push(`<text x="${x + 5}" y="${y + 50}" class="ck-tx ck-mut" font-size="9">cell cabinet =R1+CC1 · robot controller =R1+A1</text>`);
  });
  P.raw(s.join(""));
}
