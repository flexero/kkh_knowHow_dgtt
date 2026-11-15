"""Render-check SVG figures to PNG with headless Chrome (for visual inspection only; PNGs go to ../build_check/)."""
import os, subprocess, sys, re
HERE = os.path.dirname(os.path.abspath(__file__))
FIG = os.path.join(HERE, '..', 'figures')
OUT = os.path.join(HERE, '..', 'build_check')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
os.makedirs(OUT, exist_ok=True)
for f in sorted(os.listdir(FIG)):
    if not f.endswith('.svg') or (len(sys.argv) > 1 and sys.argv[1] not in f):
        continue
    svg = open(os.path.join(FIG, f), encoding='utf-8').read()
    w, h = re.search(r'width="(\d+)" height="(\d+)"', svg).groups()
    png = os.path.join(OUT, f[:-4] + '.png')
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
                    '--user-data-dir=' + os.path.join(OUT, 'chr'), f'--window-size={w},{h}', '--screenshot=' + png,
                    'file:///' + os.path.abspath(os.path.join(FIG, f)).replace(os.sep, '/')], capture_output=True, timeout=120)
    print(f, os.path.exists(png))
