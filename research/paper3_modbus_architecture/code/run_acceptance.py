"""Re-runs the fmsctl acceptance tests (items 1-4, 61 checks) WITHOUT editing them, on TCP ports 18900-18999 only.

The original tests use virtual-plant ports 15300-16100 and HTTP ports 18091-18094. This runner imports each test
module, remaps those ports (virtual_plant.start / plant.device_table base_port, the module's ThreadingHTTPServer and
urllib.request.urlopen), runs main() and records every PASS / FAIL line.

    python run_acceptance.py            # all four, each in its own process -> ../data/acceptance.json
"""
import contextlib
import importlib
import io
import json
import os
import re
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
PORTS = {15300: 18900, 15500: 18900, 15900: 18900, 15950: 18930, 16100: 18900}
HTTP = {18091: 18991, 18093: 18993, 18094: 18994}


def run_one(name):
    sys.path.insert(0, ROOT)
    import urllib.request
    from fmsctl.sim import virtual_plant
    from fmsctl.spec import plant
    o_start, o_table, o_open = virtual_plant.start, plant.device_table, urllib.request.urlopen

    def start(*a, base_port=15100, **k):
        return o_start(*a, base_port=PORTS.get(base_port, base_port), **k)

    def table(*a, base_port=15100, **k):
        return o_table(*a, base_port=PORTS.get(base_port, base_port), **k)

    def remap_url(u):
        for a, b in HTTP.items():
            u = u.replace(f':{a}/', f':{b}/')
        return u

    def urlopen(req, *a, **k):
        if isinstance(req, str):
            req = remap_url(req)
        else:
            req.full_url = remap_url(req.full_url)
        return o_open(req, *a, **k)
    virtual_plant.start, plant.device_table, urllib.request.urlopen = start, table, urlopen
    mod = importlib.import_module(f'fmsctl.tests.{name}')
    if hasattr(mod, 'ThreadingHTTPServer'):
        base = mod.ThreadingHTTPServer

        class Srv(base):
            def __init__(self, addr, h, *a, **k):
                super().__init__((addr[0], HTTP.get(addr[1], addr[1])), h, *a, **k)
        mod.ThreadingHTTPServer = Srv
    if hasattr(mod, 'HTTP'):
        pass                                     # module constant only used to build URLs (remapped above)
    return mod.main()


if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == 'one':
        sys.exit(run_one(sys.argv[2]) or 0)
    out = {'date': time.strftime('%Y-%m-%d %H:%M'), 'tests': {}}
    env = dict(os.environ, PYTHONIOENCODING='utf-8')
    for name in ('test_item1', 'test_item2', 'test_item3', 'test_item4'):
        t0 = time.perf_counter()
        r = subprocess.run([sys.executable, __file__, 'one', name], capture_output=True, text=True, encoding='utf-8',
                           env=env, cwd=ROOT, timeout=1800)
        lines = [l for l in r.stdout.splitlines() if l.startswith(('PASS', 'FAIL'))]
        out['tests'][name] = {'passed': sum(l.startswith('PASS') for l in lines), 'checks': len(lines),
                              'exit': r.returncode, 'wall_s': round(time.perf_counter() - t0, 1), 'lines': lines,
                              'stderr_tail': r.stderr[-500:]}
        print(name, out['tests'][name]['passed'], '/', out['tests'][name]['checks'], 'exit', r.returncode, flush=True)
    out['total_passed'] = sum(v['passed'] for v in out['tests'].values())
    out['total_checks'] = sum(v['checks'] for v in out['tests'].values())
    json.dump(out, open(os.path.join(HERE, '..', 'data', 'acceptance.json'), 'w'), indent=1)
    print('total', out['total_passed'], '/', out['total_checks'])
