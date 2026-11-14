"""FMS figures of the thesis (chapters 4, 8, 9) – standard library only.

    python thesis/code/make_fms_figures.py

Figures 4.2 – 4.4, 8.3, 8.4 and 9.1 are derived from the engineering drawings of the project (docs/img, Doctor paper/img):
the drawing titles, title blocks and references to project guides are removed and the drawing area is cropped, so that
the thesis caption carries the title. Figure 8.2 (control hierarchy) is drawn here in the thesis style.
"""
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
F = os.path.join(HERE, '..', 'figures')
INK, INK2, BOX = '#1f1f1e', '#5f5e57', '#f4f3ef'
C = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100']
FONT = 'font-family="Arial, Helvetica, sans-serif"'

ELEM = re.compile(r'<(text|rect|line)\b[^>]*?(?:/>|>.*?</\1>)', re.S)


def _xy(tag):
    def num(a):
        m = re.search(r'\b' + a + r'="(-?[0-9.]+)"', tag)
        return float(m.group(1)) if m else None
    x = num('x') if num('x') is not None else num('x1')
    y = num('y') if num('y') is not None else num('y1')
    return x, y


def clean(src, dst, viewbox, drop_boxes=(), replace=(), drop_text=()):
    """Copy an engineering drawing into the thesis: remove elements inside drop_boxes (x0, y0, x1, y1), texts that
    contain one of drop_text, apply text replacements, set a new viewBox (crop) and matching width / height."""
    s = open(os.path.join(ROOT, src), encoding='utf-8').read()

    def keep(m):
        tag = m.group(0)
        x, y = _xy(tag.split('>')[0])
        if x is not None and y is not None:
            for x0, y0, x1, y1 in drop_boxes:
                if x0 <= x <= x1 and y0 <= y <= y1:
                    return ''
        if m.group(1) == 'text' and any(t in tag for t in drop_text):
            return ''
        return tag
    s = ELEM.sub(keep, s)
    for a, b in replace:
        s = s.replace(a, b)
    vx, vy, vw, vh = viewbox
    s = re.sub(r'(<svg\b[^>]*?)\sviewBox="[^"]*"', rf'\1 viewBox="{vx} {vy} {vw} {vh}"', s, count=1)
    s = re.sub(r'(<svg\b[^>]*?)\swidth="[^"]*"', rf'\1 width="{vw}"', s, count=1)
    s = re.sub(r'(<svg\b[^>]*?)\sheight="[^"]*"', rf'\1 height="{vh}"', s, count=1)
    # white background for the cropped area
    s = re.sub(r'(<svg\b[^>]*>)', rf'\1<rect x="{vx}" y="{vy}" width="{vw}" height="{vh}" fill="#ffffff"/>', s, count=1)
    open(os.path.join(F, dst), 'w', encoding='utf-8').write(s)
    print('figure', dst)


def box(x, y, w, h, lines, fill=BOX, fs=13, stroke=INK2, bold_first=True):
    s = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{fill}" stroke="{stroke}" stroke-width="1.2"/>'
    ty = y + h / 2 - (len(lines) - 1) * (fs + 3) / 2 + fs / 3
    for i, t in enumerate(lines):
        wgt = ' font-weight="bold"' if (i == 0 and bold_first) else ''
        s += (f'<text x="{x + w / 2}" y="{ty + i * (fs + 3):.1f}" font-size="{fs if i == 0 else fs - 1.5}" fill="{INK}" '
              f'text-anchor="middle"{wgt}>{t}</text>')
    return s


def darrow(x, y1, y2, label, col=INK2):
    return (f'<line x1="{x}" y1="{y1}" x2="{x}" y2="{y2}" stroke="{col}" stroke-width="2" marker-start="url(#ah2)" marker-end="url(#ah2)"/>'
            f'<text x="{x + 10}" y="{(y1 + y2) / 2 + 4}" font-size="12" fill="{col}" font-weight="bold">{label}</text>')


def fig8_2():
    """Control hierarchy of the compressor FMS (ISA-95 levels) with the real control system and the twin."""
    w, h = 1180, 760
    defs = (f'<defs><marker id="ah2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
            f'<path d="M0,0 L10,5 L0,10 z" fill="{INK2}"/></marker></defs>')
    b = defs
    lv = [('Level 4', 'business planning', 30, 60, '#efe7f3'), ('Level 3', 'manufacturing operations', 120, 60, '#efe7f3'),
          ('Level 2', 'supervisory control', 220, 200, '#e3eefa'), ('Level 1', 'basic control', 470, 150, '#e5f4ec'),
          ('Level 0', 'process', 670, 60, '#fdf1dc')]
    for name, sub, y, hh, col in lv:
        b += box(20, y, 150, hh, [name, sub], fill=col, fs=13)
    b += box(200, 30, 640, 60, ['ERP', 'orders, bill of materials, stock, cost'], fill='#ffffff')
    b += box(200, 120, 640, 60, ['MES', 'work orders, serial numbers, OEE, test records'], fill='#ffffff')
    b += f'<rect x="200" y="220" width="640" height="200" rx="6" fill="#ffffff" stroke="{C[0]}" stroke-width="1.8"/>'
    b += (f'<text x="520" y="244" font-size="13.5" fill="{INK}" text-anchor="middle" font-weight="bold">FMS control PC (fmsctl, Python standard '
          f'library, offline) – the only Modbus client</text>')
    for i, (t1, t2) in enumerate([('Cell controller', 'dispatching, pallets'), ('Tool management', 'tool check, offsets'),
                                  ('Logistics', 'AGV fleet, AS/RS'), ('HTTP server', 'API, operator screens')]):
        b += box(215 + i * 155, 260, 145, 64, [t1, t2], fs=12.5)
    b += box(215, 338, 610, 66, ['Interface layer', 'register map V1.2 · Modbus TCP driver · toggle-bit job handshake · virtual plant'],
             fill='#fbf6e4', fs=12.5)
    b += f'<rect x="200" y="470" width="640" height="150" rx="6" fill="#ffffff" stroke="{C[2]}" stroke-width="1.8"/>'
    b += (f'<text x="520" y="494" font-size="13.5" fill="{INK}" text-anchor="middle" font-weight="bold">21 machine PLCs as Modbus TCP '
          f'servers – each runs the standard interface block V1.2</text>')
    for i, (t1, t2) in enumerate([('CNC × 7', 'HMC, VMC, ...'), ('Pallet × 1', 'pool + shuttle'), ('Load × 1', 'operator station'),
                                  ('Station × 7', 'wash, assembly, ...'), ('Test × 2', 'ISO 1217'), ('AGV × 2', 'Wi-Fi'), ('AS/RS × 2', 'raw + FG')]):
        b += box(210 + i * 89, 512, 84, 84, [t1, t2], fs=11.5)
    b += box(200, 670, 640, 60, ['Machines', 'motors, valves, sensors, axes, clamps, AGV and crane drives'], fill='#ffffff')
    b += darrow(520, 92, 118, 'HTTP / JSON', '#7a3ea1')
    b += darrow(520, 182, 218, 'HTTP / JSON', '#7a3ea1')
    b += darrow(520, 422, 468, 'Modbus TCP (FC03 / FC06 / FC16)', C[0])
    b += darrow(520, 622, 668, 'hard-wired I/O, drives, machine-internal fieldbus', C[2])
    # twin and safety
    b += box(880, 120, 280, 110, ['Digital twin (Chapters 4 – 7)', 'reads snapshots and events over HTTP;', 'Bayesian updating, prediction;',
                                  'never commands the machines'], fill='#f2f2f2', fs=12.5)
    b += (f'<path d="M880,175 C860,175 860,300 842,300" fill="none" stroke="{INK2}" stroke-width="1.5" stroke-dasharray="6 4" '
          f'marker-end="url(#ah2)"/>')
    b += f'<rect x="880" y="300" width="280" height="300" rx="6" fill="#fdecec" stroke="#c0392b" stroke-width="1.8"/>'
    sl = ['Safety – hard-wired', 'e-stop chains, guard doors,', 'light curtains, safe torque off,', 'safety relays / safety CPU per machine',
          '(ISO 13849-1, IEC 60204-1)', '', 'never over Modbus or HTTP;', 'a lost network means no new jobs –', 'running cycles end safely,',
          'PLC watchdog on the gateway', 'heartbeat (5 s)']
    for i, t in enumerate(sl):
        b += (f'<text x="1020" y="{330 + i * 23}" font-size="{14 if i == 0 else 12.5}" fill="{"#c0392b" if i == 0 else INK}" '
              f'text-anchor="middle"{" font-weight=\"bold\"" if i == 0 else ""}>{t}</text>')
    b += f'<line x1="842" y1="555" x2="878" y2="555" stroke="#c0392b" stroke-width="1.5" stroke-dasharray="6 4"/>'
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" {FONT}>'
           f'<title>Control hierarchy of the compressor FMS</title><rect width="{w}" height="{h}" fill="#ffffff"/>{b}</svg>')
    open(os.path.join(F, 'fig8_2_control_levels.svg'), 'w', encoding='utf-8').write(svg)
    print('figure fig8_2_control_levels.svg')


def main():
    tb = (790, 650, 1240, 860)                                # title block of the guide-13 drawings
    clean('docs/img/13_factory_layout.svg', 'fig4_2_factory_layout.svg', (0, 62, 1240, 790),
          drop_boxes=[(0, 0, 1240, 58), (795, 785, 1240, 860)],
          replace=[('zone from config layout.zones', 'zone of the layout'), ('station (id = config station id)', 'station (device name)')])
    clean('docs/img/13_process_flow.svg', 'fig4_3_process_flow.svg', (0, 62, 1240, 576),
          drop_boxes=[(0, 0, 1240, 58), (795, 645, 1240, 720)],
          replace=[(' – guide 02.', '.')])
    clean('Doctor paper/img/54_cell_layout.svg', 'fig4_4_crankcase_cell.svg', (20, 66, 1070, 560),
          drop_boxes=[(0, 0, 1100, 60)],
          replace=[('Fixed design data [example, fmsctl/cell/controller.py]', 'Design data [example]'),
                   ('(deadlock margin, chapter 7)', '(deadlock margin)'), (' – FIXTURE_OF_PALLET', '')])
    fig8_2()
    clean('Doctor paper/img/53_handshake_timing.svg', 'fig8_3_handshake.svg', (0, 66, 1400, 750),
          drop_boxes=[(0, 0, 1400, 62), (1000, 850, 1400, 900)],
          drop_text=['Timeouts (fmsctl)'])
    clean('Doctor paper/img/56_node_map.svg', 'fig8_4_agv_nodes.svg', (0, 50, 1100, 720),
          drop_boxes=[(0, 0, 1100, 40)],
          replace=[(' (config agv.aisle_z)', ''), ('Nodes 9 / 10 = chargers (config agv.chargers). Nodes 3–6 exist in the map but no item-4 flow uses them yet.',
                                                   'Nodes 9 / 10 = chargers; nodes 3 – 6 serve later flows.'),
                   ('as in the code (math.dist);', 'as used by the fleet manager;')])
    clean('Doctor paper/img/54_throughput_vs_pallets.svg', 'fig9_1_cell_throughput.svg', (0, 66, 1100, 560),
          drop_boxes=[(0, 0, 1100, 60)])


if __name__ == '__main__':
    main()
