"""Assemble the thesis into one HTML / PDF and one Word (.docx) file – Python standard library only (offline).

  python build_thesis.py            -> thesis_modern/build/thesis.html, thesis.pdf (headless Chrome), thesis.docx

Markdown subset: headings, paragraphs, lists, tables, images (+ caption line "**Figure x.y** ..."), code blocks,
block quotes, inline/display LaTeX ($...$, $$...$$). LaTeX is converted to readable Unicode with sub/superscripts
(no equation editor offline). Draft notes ("> Draft ...") and per-chapter reference notes are dropped; the
consolidated reference list (references.md) is used.
"""
from __future__ import annotations

import base64
import datetime
import html
import os
import re
import shutil
import struct
import subprocess
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
T = os.path.join(HERE, '..')
OUT = os.path.join(T, 'build')
ORDER = ['00_front_matter.md', 'ch01_introduction.md', 'ch02_state_of_the_art.md', 'ch03_methodology.md', 'ch04_model.md',
         'ch05_architecture.md', 'ch06_bayesian_twin.md', 'ch07_staging_optimisation.md', 'ch08_implementation.md',
         'ch09_cases.md', 'ch10_discussion.md', 'ch11_conclusions.md', 'references.md', 'appendices.md']
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

# ============================================================ LaTeX -> Unicode mini-markup (<i>, <sub>, <sup>, <b>)
GREEK = {'alpha': 'α', 'beta': 'β', 'gamma': 'γ', 'delta': 'δ', 'epsilon': 'ε', 'varepsilon': 'ε', 'zeta': 'ζ', 'eta': 'η',
         'theta': 'θ', 'kappa': 'κ', 'lambda': 'λ', 'mu': 'μ', 'nu': 'ν', 'xi': 'ξ', 'pi': 'π', 'rho': 'ρ', 'sigma': 'σ',
         'tau': 'τ', 'phi': 'φ', 'chi': 'χ', 'psi': 'ψ', 'omega': 'ω', 'Gamma': 'Γ', 'Delta': 'Δ', 'Theta': 'Θ',
         'Lambda': 'Λ', 'Pi': 'Π', 'Sigma': 'Σ', 'Phi': 'Φ', 'Omega': 'Ω'}
SYM = {'cdot': '·', 'times': '×', 'le': '≤', 'leq': '≤', 'ge': '≥', 'geq': '≥', 'ne': '≠', 'neq': '≠', 'approx': '≈',
       'propto': '∝', 'sum': 'Σ', 'prod': 'Π', 'int': '∫', 'infty': '∞', 'in': '∈', 'cup': '∪', 'cap': '∩', 'mid': ' | ',
       'pm': '±', 'to': '→', 'rightarrow': '→', 'leftarrow': '←', 'Rightarrow': '⇒', 'sim': '∼', 'ldots': '…',
       'dots': '…', 'cdots': '⋯', 'quad': '  ', 'qquad': '    ', ',': ' ', ';': ' ', '!': '', ' ': ' ', 'max': 'max',
       'min': 'min', 'arg': 'arg', 'ln': 'ln', 'log': 'log', 'exp': 'exp', 'Pr': 'Pr', 'bmod': ' mod ', 'lfloor': '⌊',
       'rfloor': '⌋', 'lceil': '⌈', 'rceil': '⌉', 'left': '', 'right': '', 'big': '', 'Big': '', 'bigl': '', 'bigr': '',
       '{': '{', '}': '}', '%': '%', '_': '_', '#': '#', 'top': 'ᵀ', 'partial': '∂', 'nabla': '∇', 'forall': '∀',
       'exists': '∃', 'land': '∧', 'lor': '∨', 'neg': '¬', 'equiv': '≡', 'langle': '⟨', 'rangle': '⟩', 'circ': '∘'}
SCRIPT = {'A': '𝒜', 'I': 'ℐ', 'M': 'ℳ', 'O': '𝒪', 'P': '𝒫', 'N': '𝒩', 'D': '𝒟', 'X': '𝒳', 'S': '𝒮'}
COMBINE = {'hat': '\u0302', 'bar': '\u0304', 'tilde': '\u0303', 'dot': '\u0307', 'vec': '\u20d7'}


def _group(s, i):
    """Return (content, next_index) of a {…} group or single token starting at i."""
    while i < len(s) and s[i] == ' ':
        i += 1
    if i >= len(s):
        return '', i
    if s[i] == '{':
        depth, j = 0, i
        while j < len(s):
            if s[j] == '{':
                depth += 1
            elif s[j] == '}':
                depth -= 1
                if depth == 0:
                    return s[i + 1:j], j + 1
            j += 1
        return s[i + 1:], len(s)
    if s[i] == '\\':
        m = re.match(r'\\([A-Za-z]+|.)', s[i:])
        return m.group(0), i + len(m.group(0))
    return s[i], i + 1


def tex(s):
    """Convert a LaTeX math string to mini-markup."""
    out, i = [], 0
    while i < len(s):
        c = s[i]
        if c == '\\':
            m = re.match(r'\\([A-Za-z]+|.)', s[i:])
            name = m.group(1)
            i += len(m.group(0))
            if name in ('frac', 'dfrac', 'tfrac'):
                a, i = _group(s, i)
                b, i = _group(s, i)
                ta, tb = tex(a), tex(b)
                wrap = lambda t, raw: t if re.fullmatch(r'[\w.\u0370-\u03ff]+', raw.strip()) else f'({t})'
                out.append(f'{wrap(ta, a)}/{wrap(tb, b)}')
            elif name == 'sqrt':
                a, i = _group(s, i)
                out.append(f'√({tex(a)})')
            elif name in ('mathbb',):
                a, i = _group(s, i)
                out.append({'E': '𝔼', 'R': 'ℝ', 'N': 'ℕ', 'P': 'ℙ', 'Z': 'ℤ'}.get(a.strip(), a))
            elif name in ('mathcal',):
                a, i = _group(s, i)
                out.append(SCRIPT.get(a.strip(), a))
            elif name in ('boldsymbol', 'mathbf', 'bm'):
                a, i = _group(s, i)
                out.append(f'<b>{tex(a)}</b>')
            elif name in ('mathrm', 'text', 'operatorname', 'textrm', 'mathit'):
                a, i = _group(s, i)
                out.append(html.escape(a) if name != 'mathit' else f'<i>{a}</i>')
            elif name in COMBINE:
                a, i = _group(s, i)
                t = tex(a)
                out.append(t + COMBINE[name] if len(re.sub(r'<[^>]+>', '', t)) == 1 else f'{t}{COMBINE[name]}')
            elif name == 'underbrace':
                a, i = _group(s, i)
                lab = ''
                if i < len(s) and s[i] == '_':
                    lab, i = _group(s, i + 1)
                out.append(f'{tex(a)} [{tex(lab)}]' if lab else tex(a))
            elif name == 'tag':
                a, i = _group(s, i)
                out.append(f'\u2003\u2003({a})')
            elif name in ('mathbb',):
                pass
            elif name in GREEK:
                out.append(f'<i>{GREEK[name]}</i>' if name[0].islower() else GREEK[name])
            elif name in SYM:
                out.append(SYM[name])
            else:
                out.append(name)
        elif c in '_^':
            a, i = _group(s, i + 1)
            tag = 'sub' if c == '_' else 'sup'
            out.append(f'<{tag}>{tex(a)}</{tag}>')
        elif c in '{}':
            i += 1
        elif c.isalpha():
            out.append(f'<i>{c}</i>')
            i += 1
        elif c == '<':
            out.append('&lt;'); i += 1
        elif c == '>':
            out.append('&gt;'); i += 1
        elif c == '&':
            out.append('&amp;'); i += 1
        elif c == '-':
            out.append('−'); i += 1
        else:
            out.append(c)
            i += 1
    r = ''.join(out)
    return re.sub(r'</i><i>', '', r)          # merge italic letters into words


# ============================================================ inline markdown -> mini-markup
def inline(s):
    parts = re.split(r'(`[^`]+`|\$[^$]+\$)', s)
    out = []
    for p in parts:
        if p.startswith('`') and p.endswith('`') and len(p) > 1:
            out.append(f'<code>{html.escape(p[1:-1])}</code>')
        elif p.startswith('$') and p.endswith('$') and len(p) > 1:
            out.append(tex(p[1:-1]))
        else:
            t = html.escape(p, quote=False)
            t = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', r'\1', t)
            t = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'\1', t)
            t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)
            t = re.sub(r'(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])', r'<i>\1</i>', t)
            out.append(t)
    return ''.join(out)


# ============================================================ block parser
def parse(md, fname):
    md = re.sub(r'<!--.*?-->', '', md, flags=re.S)          # editorial markers are never printed
    md = re.sub(r'\n---\n\*\*References cited in this chapter\*\*.*\Z', '\n', md, flags=re.S)
    lines = md.split('\n')
    blocks, i = [], 0
    while i < len(lines):
        ln = lines[i]
        st = ln.strip()
        if not st or st == '---':
            i += 1; continue
        if st.startswith('>'):
            q = []
            while i < len(lines) and lines[i].strip().startswith('>'):
                q.append(lines[i].strip()[1:].strip()); i += 1
            if not q[0].startswith('Draft') and not q[0].startswith('Status'):
                blocks.append(('quote', inline(' '.join(q))))
            continue
        m = re.match(r'^(#{1,6})\s+(.*)', ln)
        if m:
            blocks.append(('h', len(m.group(1)), m.group(2).strip())); i += 1; continue
        if st.startswith('```'):
            j = i + 1; code = []
            while j < len(lines) and not lines[j].strip().startswith('```'):
                code.append(lines[j]); j += 1
            blocks.append(('code', '\n'.join(code))); i = j + 1; continue
        if st.startswith('$$'):
            buf = st
            while not (buf.endswith('$$') and len(buf) > 2):
                i += 1; buf += ' ' + lines[i].strip()
            blocks.append(('math', tex(buf.strip('$').strip()))); i += 1; continue
        m = re.match(r'^!\[([^\]]*)\]\(([^)]+)\)\s*$', st)
        if m:
            blocks.append(('img', m.group(2), 'landscape' in m.group(1).lower())); i += 1; continue
        if st.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                cells = [c.strip() for c in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-{3,}:?', c) for c in cells if c):
                    rows.append([inline(c) for c in cells])
                i += 1
            blocks.append(('table', rows)); continue
        if re.match(r'^(\s*)([-*]|\d+\.)\s+', ln):
            items, ordered = [], bool(re.match(r'^\s*\d+\.', ln))
            while i < len(lines) and (re.match(r'^(\s*)([-*]|\d+\.)\s+', lines[i]) or (lines[i].startswith('  ') and lines[i].strip() and items)):
                mm = re.match(r'^(\s*)([-*]|\d+\.)\s+(.*)', lines[i])
                if mm:
                    items.append([len(mm.group(1)) // 2, mm.group(3)])
                else:
                    items[-1][1] += ' ' + lines[i].strip()
                i += 1
            blocks.append(('list', ordered, [(lvl, inline(t)) for lvl, t in items])); continue
        para = [st]; i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r'^(#{1,6}\s|\||```|\$\$|!\[|>|\s*([-*]|\d+\.)\s)', lines[i]):
            para.append(lines[i].strip()); i += 1
        text = ' '.join(para)
        if re.match(r'^\*\*(Figure|Table) \d+\.\d+\*\*', text):
            blocks.append(('caption', inline(text), 'Figure' if text.startswith('**Figure') else 'Table'))
        else:
            blocks.append(('p', inline(text)))
    return blocks


def load_all():
    allb = []
    for f in ORDER:
        b = parse(open(os.path.join(T, f), encoding='utf-8').read(), f)
        allb.append((f, b))
    return allb


def plain(m):
    return html.unescape(re.sub(r'<[^>]+>', '', m))


def collect(allb):
    toc, figs, tabs = [], [], []
    for f, blocks in allb:
        if f == '00_front_matter.md':
            continue
        for b in blocks:
            if b[0] == 'h' and b[1] <= 2:
                toc.append((b[1], b[2]))
            elif b[0] == 'caption':
                (figs if b[2] == 'Figure' else tabs).append(plain(b[1]))
    return toc, figs, tabs


# ============================================================ HTML / PDF
CSS = """
@page { size: A4; margin: 25mm 22mm 25mm 30mm; @bottom-center { content: counter(page); font: 10pt 'Times New Roman', serif; color: #444; } }
@page :first { @bottom-center { content: none; } }
body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.6; color: #111; }
h1 { font-size: 20pt; margin: 0 0 14pt; page-break-before: always; font-weight: normal; }
h1.title { page-break-before: avoid; font-size: 24pt; margin-top: 60mm; text-align: center; font-weight: bold; }
h2.subtitle { text-align: center; font-weight: normal; font-size: 15pt; margin-bottom: 30mm; }
h2 { font-size: 14pt; margin: 18pt 0 6pt; page-break-after: avoid; }
h3 { font-size: 12pt; margin: 12pt 0 4pt; page-break-after: avoid; }
h4 { font-size: 11pt; margin: 10pt 0 3pt; }
p { margin: 0 0 7pt; text-align: justify; hyphens: auto; }
table { border-collapse: collapse; width: 100%; font-size: 9.5pt; line-height: 1.3; margin: 4pt 0 10pt; page-break-inside: auto; }
th, td { border: 0.6pt solid #888; padding: 2.5pt 4pt; vertical-align: top; text-align: left; }
th { background: #eeeeea; }
tr { page-break-inside: avoid; }
.cap { font-size: 9.5pt; margin: 4pt 0 10pt; text-align: left; page-break-after: avoid; }
.cap.fig { text-align: center; page-break-before: avoid; }
figure { margin: 8pt 0 2pt; text-align: center; page-break-inside: avoid; }
figure img { max-width: 100%; max-height: 150mm; }
@page land { size: A4 landscape; margin: 18mm 20mm 18mm 20mm; @bottom-center { content: counter(page); font: 10pt 'Times New Roman', serif; color: #444; } }
.land { page: land; page-break-before: always; page-break-after: always; }
.land figure img { max-height: 150mm; max-width: 100%; }
.math { text-align: center; font-family: 'Cambria Math', 'Times New Roman', serif; font-size: 11.5pt; margin: 6pt 0 8pt; }
pre { font-size: 8.5pt; background: #f5f5f2; padding: 6pt; white-space: pre-wrap; page-break-inside: avoid; }
code { font-size: 9pt; font-family: Consolas, monospace; }
blockquote { margin: 6pt 18pt; font-style: italic; }
ul, ol { margin: 0 0 7pt 18pt; padding: 0; } li { margin: 0 0 2pt; }
.toc p { margin: 0 0 2pt; text-align: left; } .toc .l2 { margin-left: 16pt; font-size: 10pt; }
.lof p { margin: 0 0 2pt; font-size: 9.5pt; text-align: left; }
.pb { page-break-before: always; }
"""


def html_doc(allb):
    toc, figs, tabs = collect(allb)
    out = ['<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Doctoral thesis – edition 2 (OPC UA / MQTT)</title>',
           f'<style>{CSS}</style></head><body>']
    first_h1 = True
    land_open = False
    for f, blocks in allb:
        skip_until_h = False
        for b in blocks:
            k = b[0]
            if skip_until_h and k != 'h':
                continue
            if k == 'h':
                lvl, txt = b[1], b[2]
                skip_until_h = False
                if f == '00_front_matter.md':
                    if lvl == 1 and first_h1:
                        out.append(f'<h1 class="title">{inline(txt)}</h1>'); first_h1 = False; continue
                    if lvl == 2 and txt.startswith('Cases of'):
                        out.append(f'<h2 class="subtitle">{inline(txt)}</h2>'); continue
                    if txt == 'Contents':
                        out.append('<h2 class="pb">Contents</h2><div class="toc">' + ''.join(
                            f'<p class="l{l}">{html.escape(t)}</p>' for l, t in toc) + '</div>')
                        out.append('<h2 class="pb">List of figures</h2><div class="lof">' + ''.join(f'<p>{html.escape(x)}</p>' for x in figs) + '</div>')
                        out.append('<h2 class="pb">List of tables</h2><div class="lof">' + ''.join(f'<p>{html.escape(x)}</p>' for x in tabs) + '</div>')
                        skip_until_h = True
                        continue
                    if lvl == 2 and txt in ('Declaration', 'Abstract', 'Acknowledgements', 'Abbreviations'):
                        out.append(f'<h2 class="pb">{inline(txt)}</h2>'); continue
                tag = f'h{min(lvl, 4)}'
                out.append(f'<{tag}>{inline(txt)}</{tag}>')
            elif k == 'p':
                out.append(f'<p>{b[1]}</p>')
            elif k == 'quote':
                out.append(f'<blockquote>{b[1]}</blockquote>')
            elif k == 'math':
                out.append(f'<div class="math">{b[1]}</div>')
            elif k == 'code':
                out.append(f'<pre>{html.escape(b[1])}</pre>')
            elif k == 'img':
                if len(b) > 2 and b[2]:
                    out.append(f'<div class="land"><figure><img src="../{b[1]}" alt=""></figure>')
                    land_open = True
                else:
                    out.append(f'<figure><img src="../{b[1]}" alt=""></figure>')
            elif k == 'caption':
                out.append(f'<p class="cap {"fig" if b[2] == "Figure" else ""}">{b[1]}</p>')
                if land_open and b[2] == 'Figure':
                    out.append('</div>'); land_open = False
            elif k == 'table':
                rows = b[1]
                h = '<tr>' + ''.join(f'<th>{c}</th>' for c in rows[0]) + '</tr>'
                body = ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in r) + '</tr>' for r in rows[1:])
                out.append(f'<table><thead>{h}</thead><tbody>{body}</tbody></table>')
            elif k == 'list':
                tag = 'ol' if b[1] else 'ul'
                out.append(f'<{tag}>' + ''.join(f'<li style="margin-left:{lvl * 14}pt">{t}</li>' for lvl, t in b[2]) + f'</{tag}>')
    out.append('</body></html>')
    return '\n'.join(out), len(figs), len(tabs)


# ============================================================ SVG -> PNG (headless Chrome) for Word
def svg_size(path):
    s = open(path, encoding='utf-8').read(2000)
    w = float(re.search(r'width="([\d.]+)"', s).group(1)); h = float(re.search(r'height="([\d.]+)"', s).group(1))
    return w, h


def svg_to_png(svg_path, png_path, tmpdir):
    w, h = svg_size(svg_path)
    page = os.path.join(tmpdir, 'svg_page.html')
    uri = 'file:///' + os.path.abspath(svg_path).replace('\\', '/')
    open(page, 'w', encoding='utf-8').write(f'<html><body style="margin:0"><img src="{uri}" style="display:block;width:{w}px;height:{h}px"></body></html>')
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--no-first-run', f'--user-data-dir={tmpdir}\\chr',
                    '--allow-file-access-from-files', '--hide-scrollbars', '--force-device-scale-factor=2',
                    f'--window-size={int(w)},{int(h)}', f'--screenshot={png_path}', 'file:///' + page.replace('\\', '/')],
                   capture_output=True, timeout=60)
    return w, h


# ============================================================ DOCX (Office Open XML, written by hand)
def x(s):
    return html.escape(s, quote=False)


def runs(markup, base_rpr=''):
    """Mini-markup (<b>, <i>, <sub>, <sup>, <code>) -> w:r elements."""
    out, stack = [], []
    for tok in re.split(r'(</?(?:b|i|sub|sup|code)>)', markup):
        if not tok:
            continue
        m = re.fullmatch(r'<(/?)(b|i|sub|sup|code)>', tok)
        if m:
            if m.group(1):
                if m.group(2) in stack:
                    stack.remove(m.group(2))
            else:
                stack.append(m.group(2))
            continue
        txt = html.unescape(tok)
        bold = 'b' in stack or '<w:b/>' in base_rpr
        # element order required by the OOXML schema: rFonts, b, i, sz, vertAlign
        rpr = ''
        if 'code' in stack: rpr += '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>'
        if bold: rpr += '<w:b/>'
        if 'i' in stack: rpr += '<w:i/>'
        if 'code' in stack: rpr += '<w:sz w:val="18"/>'
        if 'sub' in stack: rpr += '<w:vertAlign w:val="subscript"/>'
        elif 'sup' in stack: rpr += '<w:vertAlign w:val="superscript"/>'
        out.append(f'<w:r>{"<w:rPr>" + rpr + "</w:rPr>" if rpr else ""}<w:t xml:space="preserve">{x(txt)}</w:t></w:r>')
    return ''.join(out)


def para(markup, style=None, extra_ppr='', base_rpr=''):
    ppr = (f'<w:pStyle w:val="{style}"/>' if style else '') + extra_ppr
    return f'<w:p>{"<w:pPr>" + ppr + "</w:pPr>" if ppr else ""}{runs(markup, base_rpr)}</w:p>'


def table_xml(rows):
    ncol = max(len(r) for r in rows)
    w = 9000 // ncol
    grid = ''.join(f'<w:gridCol w:w="{w}"/>' for _ in range(ncol))
    out = [f'<w:tbl><w:tblPr><w:tblStyle w:val="ThesisTable"/><w:tblW w:w="5000" w:type="pct"/>'
           f'<w:tblBorders>' + ''.join(f'<w:{s} w:val="single" w:sz="4" w:space="0" w:color="888888"/>' for s in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV')) +
           f'</w:tblBorders><w:tblCellMar><w:left w:w="60" w:type="dxa"/><w:right w:w="60" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>{grid}</w:tblGrid>']
    for ri, r in enumerate(rows):
        trpr = '<w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>' if ri == 0 else '<w:trPr><w:cantSplit/></w:trPr>'
        cells = ''
        for c in r + [''] * (ncol - len(r)):
            shade = '<w:shd w:val="clear" w:color="auto" w:fill="EEEEEA"/>' if ri == 0 else ''
            cells += f'<w:tc><w:tcPr><w:tcW w:w="{w}" w:type="dxa"/>{shade}</w:tcPr>{para(c, "TableText", base_rpr="<w:b/>" if ri == 0 else "")}</w:tc>'
        out.append(f'<w:tr>{trpr}{cells}</w:tr>')
    out.append('</w:tbl>')
    return ''.join(out)


def image_xml(rid, idx, w_px, h_px, max_w_cm=15.5, max_h_cm=17):
    w_cm = min(max_w_cm, w_px / 96 * 2.54 * 1.0)
    h_cm = w_cm * h_px / w_px
    if h_cm > max_h_cm:
        h_cm = max_h_cm; w_cm = h_cm * w_px / h_px
    cx, cy = int(w_cm * 360000), int(h_cm * 360000)
    return (f'<w:p><w:pPr><w:pStyle w:val="Figure"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">'
            f'<wp:extent cx="{cx}" cy="{cy}"/><wp:docPr id="{idx}" name="Figure {idx}"/>'
            f'<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
            f'<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="{idx}" name="fig{idx}.png"/><pic:cNvPicPr/></pic:nvPicPr>'
            f'<pic:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
            f'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>'
            f'</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>')


STYLES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="24"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="360" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="3000" w:after="400"/><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:sz w:val="48"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="1600"/><w:jc w:val="center"/></w:pPr><w:rPr><w:sz w:val="30"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:pageBreakBefore/><w:spacing w:before="0" w:after="280"/><w:jc w:val="left"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:sz w:val="40"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="320" w:after="120"/><w:jc w:val="left"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="220" w:after="80"/><w:jc w:val="left"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="60"/><w:jc w:val="left"/></w:pPr><w:rPr><w:b/><w:i/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="80" w:after="200"/><w:jc w:val="left"/></w:pPr><w:rPr><w:sz w:val="19"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="FigCaption"><w:name w:val="Figure caption"/><w:basedOn w:val="Caption"/><w:pPr><w:keepNext w:val="0"/><w:jc w:val="center"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Figure"><w:name w:val="Figure"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="40"/><w:jc w:val="center"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:rPr><w:sz w:val="19"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Math"><w:name w:val="Equation"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="120" w:after="160"/><w:jc w:val="center"/></w:pPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/><w:sz w:val="23"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F5F5F2"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="16"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="567" w:right="567"/></w:pPr><w:rPr><w:i/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListPara"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="60"/><w:ind w:left="567" w:hanging="283"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="TOCHeading"><w:name w:val="TOC Heading"/><w:basedOn w:val="Heading2"/><w:pPr><w:pageBreakBefore/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="TOC1"><w:name w:val="toc 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="40"/><w:jc w:val="left"/></w:pPr><w:rPr><w:b/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="TOC2"><w:name w:val="toc 2"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="20"/><w:ind w:left="284"/><w:jc w:val="left"/></w:pPr><w:rPr><w:sz w:val="20"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="PlainList"><w:name w:val="Plain list"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="20"/><w:jc w:val="left"/></w:pPr><w:rPr><w:sz w:val="19"/></w:rPr></w:style>
<w:style w:type="table" w:styleId="ThesisTable"><w:name w:val="Thesis table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/></w:tblPr></w:style>
</w:styles>"""


def field_par(instr, placeholder, style=None):
    ppr = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ''
    return (f'<w:p>{ppr}<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve"> {instr} </w:instrText></w:r>'
            f'<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>{x(placeholder)}</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>')


def build_docx(allb, path, tmpdir):
    toc, figs, tabs = collect(allb)
    body, rels, media, img_i = [], [], [], 0
    n_sect, land_open = 0, False
    rels.append('<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>')
    rels.append('<Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>')
    rels.append('<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>')
    first_h1 = True
    for f, blocks in allb:
        skip = False
        for b in blocks:
            k = b[0]
            if skip and k != 'h':
                continue
            if k == 'h':
                lvl, txt = b[1], b[2]; skip = False
                if f == '00_front_matter.md':
                    if lvl == 1 and first_h1:
                        body.append(para(inline(txt), 'Title')); first_h1 = False; continue
                    if lvl == 2 and txt.startswith('Cases of'):
                        body.append(para(inline(txt), 'Subtitle')); continue
                    if txt == 'Contents':
                        body.append(para('Contents', 'TOCHeading'))
                        body.append(field_par('TOC \\o "1-2" \\h \\z \\u', 'Right-click → Update field to build the table of contents.'))
                        body.append(para('List of figures', 'TOCHeading'))
                        body += [para(html.escape(t), 'PlainList') for t in figs]
                        body.append(para('List of tables', 'TOCHeading'))
                        body += [para(html.escape(t), 'PlainList') for t in tabs]
                        skip = True; continue
                    if lvl == 2 and txt in ('Declaration', 'Abstract', 'Acknowledgements', 'Abbreviations'):
                        body.append(para(inline(txt), 'Heading2', '<w:pageBreakBefore/>')); continue
                body.append(para(inline(txt), f'Heading{min(lvl, 4)}'))
            elif k == 'p':
                body.append(para(b[1]))
            elif k == 'quote':
                body.append(para(b[1], 'Quote'))
            elif k == 'math':
                body.append(para(b[1], 'Math'))
            elif k == 'code':
                body += [para(html.escape(l) or ' ', 'Code') for l in b[1].split('\n')]
            elif k == 'caption':
                body.append(para(b[1], 'FigCaption' if b[2] == 'Figure' else 'Caption'))
                if land_open and b[2] == 'Figure':        # end of the landscape section
                    body.append('<w:p><w:pPr><w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>'
                            '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/>'
                            '</w:sectPr></w:pPr></w:p>')
                    n_sect += 1
                    land_open = False
            elif k == 'table':
                body.append(table_xml(b[1]))
                body.append(para('', extra_ppr='<w:spacing w:after="60"/>'))
            elif k == 'list':
                for idx, (lvl, t) in enumerate(b[2]):
                    mark = f'{idx + 1}.' if b[1] else '•'
                    body.append(para(f'{mark}\u00a0{t}', 'ListPara', f'<w:ind w:left="{567 + lvl * 340}" w:hanging="283"/>'))
            elif k == 'img':
                img_i += 1
                svgp = os.path.join(T, b[1])
                png = os.path.join(tmpdir, f'fig{img_i}.png')
                w, h = svg_to_png(svgp, png, tmpdir)
                if not os.path.exists(png):
                    body.append(para(f'[figure {html.escape(b[1])} – PNG conversion failed]')); continue
                rid = f'rIdImg{img_i}'
                media.append((f'media/fig{img_i}.png', png))
                rels.append(f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/fig{img_i}.png"/>')
                if len(b) > 2 and b[2]:                    # landscape page: close the portrait section first
                    body.append('<w:p><w:pPr><w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="11906" w:h="16838"/>'
                            '<w:pgMar w:top="1418" w:right="1247" w:bottom="1418" w:left="1701" w:header="709" w:footer="709" w:gutter="0"/>'
                            + ('<w:titlePg/>' if not n_sect else '') + '</w:sectPr></w:pPr></w:p>')
                    n_sect += 1
                    body.append(image_xml(rid, img_i, w, h, max_w_cm=26.5, max_h_cm=15.5))
                    land_open = True
                else:
                    body.append(image_xml(rid, img_i, w, h))
    sect = ('<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="11906" w:h="16838"/>'
            '<w:pgMar w:top="1418" w:right="1247" w:bottom="1418" w:left="1701" w:header="709" w:footer="709" w:gutter="0"/>'
            + ('' if n_sect else '<w:titlePg/>') + '</w:sectPr>')
    doc = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
           '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
           'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
           'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
           'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
           'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
           f'<w:body>{"".join(body)}{sect}</w:body></w:document>')
    footer = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
              '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>'
              '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>')
    settings = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
                '<w:defaultTabStop w:val="708"/><w:updateFields w:val="true"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>')
    ctypes = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
              '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
              '<Default Extension="png" ContentType="image/png"/>'
              '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
              '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
              '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>'
              '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
              '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
              '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>')
    root_rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                 '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
                 '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
                 '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>')
    now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    core = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
            'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
            '<dc:title>An Uncertainty-Aware Digital Twin Method with Interoperable OPC UA / MQTT Communication for the Stepwise Introduction of FMS (Edition 2)</dc:title><dc:creator>Kenzo</dc:creator>'
            f'<dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified></cp:coreProperties>')
    app = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">'
           '<Application>build_thesis.py</Application></Properties>')
    doc_rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                + ''.join(rels) + '</Relationships>')
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', ctypes); z.writestr('_rels/.rels', root_rels)
        z.writestr('word/document.xml', doc); z.writestr('word/styles.xml', STYLES); z.writestr('word/settings.xml', settings)
        z.writestr('word/footer1.xml', footer); z.writestr('word/_rels/document.xml.rels', doc_rels)
        z.writestr('docProps/core.xml', core); z.writestr('docProps/app.xml', app)
        for name, src in media:
            z.write(src, 'word/' + name)
    return img_i


def main():
    os.makedirs(OUT, exist_ok=True)
    tmp = os.path.join(OUT, '_tmp')
    os.makedirs(tmp, exist_ok=True)
    allb = load_all()
    doc, nf, nt = html_doc(allb)
    hp = os.path.join(OUT, 'thesis.html')
    open(hp, 'w', encoding='utf-8').write(doc)
    pdf = os.path.join(OUT, 'thesis.pdf')
    if os.path.exists(CHROME):
        subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--no-first-run', f'--user-data-dir={tmp}\\chr',
                        '--allow-file-access-from-files', '--no-pdf-header-footer', f'--print-to-pdf={pdf}',
                        'file:///' + os.path.abspath(hp).replace('\\', '/')], capture_output=True, timeout=180)
    pages = None
    if os.path.exists(pdf):
        data = open(pdf, 'rb').read()
        pages = len(re.findall(rb'/Type\s*/Page[^s]', data))
    n_img = build_docx(allb, os.path.join(OUT, 'thesis.docx'), tmp)
    words = sum(len(open(os.path.join(T, f), encoding='utf-8').read().split()) for f in ORDER)
    print(f'HTML  {hp}\nPDF   {pdf}  pages: {pages}\nDOCX  {os.path.join(OUT, "thesis.docx")}  images: {n_img}')
    print(f'figures listed: {nf}, tables listed: {nt}, source words: {words}')
    shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
