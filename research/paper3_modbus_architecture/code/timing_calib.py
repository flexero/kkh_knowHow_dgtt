"""Paper 3 - Windows timing calibration of the measurement PC (no network).

Measures what the benches rely on:
  1 granularity of time.time() and time.perf_counter() (smallest observed positive step)
  2 actual duration of time.sleep(d) for d = 1, 5, 10 ms, with and without timeBeginPeriod(1)
  3 asyncio.sleep(d): share of wake-ups EARLIER than requested (d = 1, 10 ms), Proactor loop
Each case in a fresh subprocess, because timeBeginPeriod changes the timer resolution of the calling process.

    python timing_calib.py    -> ../data/timing_calib.json
"""
import asyncio
import json
import os
import platform
import statistics
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))


def steps(clock, n=200000):
    out, last = [], clock()
    for _ in range(n):
        t = clock()
        if t != last:
            out.append(t - last)
            last = t
    return out


def pct(v, p):
    v = sorted(v)
    return v[min(len(v) - 1, int(p * len(v)))]


def child(hires):
    if hires:
        import ctypes
        ctypes.windll.winmm.timeBeginPeriod(1)
    res = {'timeBeginPeriod_1ms': hires}
    st = steps(time.time)
    res['time_time_step_ms'] = {'min': 1000 * min(st), 'median': 1000 * statistics.median(st)} if st else None
    sp = steps(time.perf_counter)
    res['perf_counter_step_us'] = {'min': 1e6 * min(sp), 'median': 1e6 * statistics.median(sp)}
    res['clock_info'] = {c: str(time.get_clock_info(c)) for c in ('time', 'perf_counter', 'monotonic')}
    for d in (0.001, 0.005, 0.010):
        v = []
        for _ in range(300):
            t = time.perf_counter(); time.sleep(d); v.append(1000 * (time.perf_counter() - t))
        res[f'sleep_{int(d * 1000)}ms'] = {'mean': statistics.mean(v), 'p50': pct(v, 0.5), 'p99': pct(v, 0.99),
                                           'max': max(v), 'min': min(v)}

    async def asl(d, n=300):
        v = []
        for _ in range(n):
            t = time.perf_counter(); await asyncio.sleep(d); v.append(1000 * (time.perf_counter() - t))
        return v
    for d in (0.001, 0.010):
        v = asyncio.run(asl(d))
        res[f'asyncio_sleep_{int(d * 1000)}ms'] = {'mean': statistics.mean(v), 'p50': pct(v, 0.5), 'p99': pct(v, 0.99),
                                                   'min': min(v), 'share_early': sum(x < 1000 * d for x in v) / len(v)}
    print(json.dumps(res))


if __name__ == '__main__':
    if len(sys.argv) > 1:
        child(sys.argv[1] == '1')
    else:
        out = {'host': platform.platform(), 'python': platform.python_version(), 'processor': platform.processor(),
               'date': time.strftime('%Y-%m-%d %H:%M'), 'cases': []}
        for h in ('0', '1'):
            r = subprocess.run([sys.executable, __file__, h], capture_output=True, text=True, timeout=300)
            out['cases'].append(json.loads(r.stdout))
            print(r.stdout.strip()[:600])
        json.dump(out, open(os.path.join(HERE, '..', 'data', 'timing_calib.json'), 'w'), indent=1)
