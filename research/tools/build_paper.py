"""Build journal manuscripts (Markdown) into PDF + Word for submission – standard library only, offline.

    python research/tools/build_paper.py                      # every research/paper*/manuscript.md
    python research/tools/build_paper.py research/paper2_bayesian_twin [more folders]
    python research/tools/build_paper.py research/paper1_slr --file paper1_draft.md

Output per paper: <folder>/build/<name>.html, <name>.pdf (headless Chrome) and <name>.docx (continuous line
numbers, page numbers, figures as PNG). Uses the Markdown subset of the thesis builder (thesis/code/build_thesis.py):
headings, paragraphs, lists, tables, images + caption line "**Figure 3.** ..." / "**Table 2.** ...", display and
inline LaTeX, code. Image paths are relative to the paper folder.
"""
import argparse
import glob
import os
import re
import subprocess
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'thesis', 'code'))
import build_thesis as B                                                  # noqa: E402

CAP = re.compile(r'^\*\*(Figure|Table) (\d+)\.?(\*\*)?[ \t]*', re.M)


def normalise(md):
    """Paper captions "**Figure 3.**", "**Figure 3**" or "**Table 1. Title ...**" -> the thesis parser's caption
    form "**Figure 3.0**" (shown again as "Figure 3." in the output)."""
    def rep(m):
        return '**' + m.group(1) + ' ' + m.group(2) + '.0** ' + ('' if m.group(3) else '**')
    return CAP.sub(rep, md)


def build(folder, fname='manuscript.md'):
    md = open(os.path.join(folder, fname), encoding='utf-8').read()
    B.T = folder
    B.OUT = os.path.join(folder, 'build')
    tmp = os.path.join(B.OUT, '_tmp')
    os.makedirs(tmp, exist_ok=True)
    blocks = B.parse(normalise(md), fname)
    for i, b in enumerate(blocks):                                        # show "Figure 3." not "Figure 3.0"
        if b[0] == 'caption':
            blocks[i] = (b[0], re.sub(r'(Figure|Table) (\d+)\.0', lambda m: m.group(1) + ' ' + m.group(2) + '.', b[1], count=1), b[2])
    allb = [(fname, blocks)]
    doc, nf, nt = B.html_doc(allb)
    doc = doc.replace('h1 { font-size: 20pt; margin: 0 0 14pt; page-break-before: always;', 'h1 { font-size: 18pt; margin: 0 0 14pt;')
    base = os.path.splitext(fname)[0]
    hp = os.path.join(B.OUT, base + '.html')
    open(hp, 'w', encoding='utf-8').write(doc)
    pdf = os.path.join(B.OUT, base + '.pdf')
    pages = None
    if os.path.exists(B.CHROME):
        subprocess.run([B.CHROME, '--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + tmp + '\\chr',
                        '--allow-file-access-from-files', '--no-pdf-header-footer', '--print-to-pdf=' + pdf,
                        'file:///' + os.path.abspath(hp).replace('\\', '/')], capture_output=True, timeout=180)
        if os.path.exists(pdf):
            pages = len(re.findall(rb'/Type\s*/Page[^s]', open(pdf, 'rb').read()))
    dx = os.path.join(B.OUT, base + '.docx')
    n_img = B.build_docx(allb, dx, tmp)
    # post-process the Word file: title from the first heading, neutral author, continuous line numbers
    title = next((b[2] for b in blocks if b[0] == 'h' and b[1] == 1), 'Manuscript')
    title = B.plain(B.inline(title))
    with zipfile.ZipFile(dx) as zin:
        parts = {n: zin.read(n) for n in zin.namelist()}
    d = parts['word/document.xml'].decode('utf-8').replace('<w:titlePg/>', '')
    d = re.sub(r'(<w:pgMar [^>]*/>)', lambda m: m.group(1) + '<w:lnNumType w:countBy="1" w:restart="continuous"/>', d)
    parts['word/document.xml'] = d.encode('utf-8')
    c = parts['docProps/core.xml'].decode('utf-8')
    c = re.sub(r'<dc:title>.*?</dc:title>', lambda m: '<dc:title>' + B.x(title) + '</dc:title>', c)
    c = re.sub(r'<dc:creator>.*?</dc:creator>', '<dc:creator>[Author]</dc:creator>', c)
    parts['docProps/core.xml'] = c.encode('utf-8')
    parts['docProps/app.xml'] = parts['docProps/app.xml'].replace(b'build_thesis.py', b'build_paper.py')
    s = parts['word/styles.xml'].decode('utf-8')
    s = s.replace('<w:pageBreakBefore/><w:spacing w:before="0" w:after="280"/>', '<w:spacing w:before="0" w:after="280"/>')
    parts['word/styles.xml'] = s.encode('utf-8')
    with zipfile.ZipFile(dx, 'w', zipfile.ZIP_DEFLATED) as z:
        for n, data in parts.items():
            z.writestr(n, data)
    words = len(re.split(r'\n#+\s*References\b', md)[0].split())
    print(f'{os.path.relpath(folder, ROOT)}: PDF {pages} pages, DOCX {n_img} figures, {nf} figure / {nt} table captions, '
          f'~{words} words before the reference list')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('folders', nargs='*')
    ap.add_argument('--file', default='manuscript.md')
    a = ap.parse_args()
    folders = a.folders or sorted(os.path.dirname(p) for p in glob.glob(os.path.join(ROOT, 'research', 'paper*', 'manuscript.md')))
    for f in folders:
        build(os.path.abspath(f), a.file)


if __name__ == '__main__':
    main()
