"""Shared helpers of the edition-2 (OPC UA + MQTT) code: paths, clocks, device tables, statistics, process memory.

Run every script of this folder with the offline venv:  thesis_modern\\.venv\\Scripts\\python.exe <script>
Clock convention (as in edition 1): time.perf_counter() is QueryPerformanceCounter on Windows and therefore one
system-wide clock for all processes of a run. Machine (source) time stamps are written as
    SourceTimestamp = BASE + perf_counter seconds
so that every receiver can convert a received OPC UA / Sparkplug time stamp back to the exact perf_counter time of the
state change and compute latencies without any clock synchronisation error.
"""
from __future__ import annotations

import ctypes
import datetime as _dt
import json
import math
import os
import statistics
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TM = os.path.normpath(os.path.join(HERE, '..', '..'))          # thesis_modern/
ROOT = os.path.normpath(os.path.join(TM, '..'))                 # project root (fmsctl/ lives here)
DATA = os.path.join(TM, 'data', 'modern')
RAW = os.path.join(DATA, 'raw')
PKI = os.path.join(DATA, 'pki')
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

UTC = _dt.timezone.utc
BASE = _dt.datetime(2026, 1, 1, tzinfo=UTC)
NS_URI = 'urn:compressor-fms:ua:fms'                            # namespace of the FMS information model (V2.0)
GROUP, EDGE, HOST_ID = 'fms', 'gw1', 'twin'                     # Sparkplug group id, edge node id, primary host id

# port plan (task rule): OPC UA 48400-48999, MQTT 18800-18899, Modbus reference 18850+
UA_SINGLE = 48410            # one server with N device objects
UA_PERDEV = 48500            # one server per device: 48500 + i  (i < 400)
UA_JOB = 48450               # job-mode plant for tests / command bench
MQTT_PORT, MQTT_TLS_PORT = 18830, 18831
MODBUS_REF = 18850


def perf_to_dt(t):
    return BASE + _dt.timedelta(microseconds=round(t * 1e6))


def dt_to_perf(d):
    if d.tzinfo is None:
        d = d.replace(tzinfo=UTC)
    return (d - BASE) / _dt.timedelta(microseconds=1) / 1e6


def timer_resolution_1ms():
    try:
        ctypes.windll.winmm.timeBeginPeriod(1)
    except Exception:
        pass


def device_table(n=21):
    """The 21 devices of the case factory (fmsctl.spec.plant), replicated with suffixes for scaling runs (50, 100)."""
    from fmsctl.spec import plant
    out = []
    for i in range(n):
        did, typ, zone, host, desc = plant.DEVICES[i % len(plant.DEVICES)]
        rep = i // len(plant.DEVICES)
        out.append({'id': did if rep == 0 else f'{did}-R{rep}', 'type': typ, 'desc': desc, 'i': i,
                    'ip': f'10.70.{zone}.{host}', 'unit': 1})
    return out


# ------------------------------------------------------------------ statistics
T95 = {1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228}


def mean_ci(xs):
    """Mean and half-width of the 95 % t confidence interval over repetitions."""
    xs = [x for x in xs if x is not None]
    if not xs:
        return None, None
    m = statistics.fmean(xs)
    if len(xs) < 2:
        return m, None
    return m, T95.get(len(xs) - 1, 1.96) * statistics.stdev(xs) / math.sqrt(len(xs))


def pct(xs, q):
    if not xs:
        return None
    s = sorted(xs)
    k = (len(s) - 1) * q / 100.0
    f = math.floor(k)
    c = min(f + 1, len(s) - 1)
    return s[f] + (s[c] - s[f]) * (k - f)


def wilson(k, n, z=1.96):
    """95 % Wilson interval of a proportion k/n (for completeness = 100 % the lower bound is informative)."""
    if n == 0:
        return None, None
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return max(0.0, c - h), min(1.0, c + h)


# ------------------------------------------------------------------ process resources (stdlib only, no psutil)
class _PMC(ctypes.Structure):
    _fields_ = [('cb', ctypes.c_ulong), ('PageFaultCount', ctypes.c_ulong), ('PeakWorkingSetSize', ctypes.c_size_t),
                ('WorkingSetSize', ctypes.c_size_t), ('QuotaPeakPagedPoolUsage', ctypes.c_size_t),
                ('QuotaPagedPoolUsage', ctypes.c_size_t), ('QuotaPeakNonPagedPoolUsage', ctypes.c_size_t),
                ('QuotaNonPagedPoolUsage', ctypes.c_size_t), ('PagefileUsage', ctypes.c_size_t),
                ('PeakPagefileUsage', ctypes.c_size_t)]


def working_set_mb():
    """(current, peak) working set of this process in MB via GetProcessMemoryInfo (Windows); (None, None) elsewhere."""
    try:
        pmc = _PMC()
        pmc.cb = ctypes.sizeof(_PMC)
        k32 = ctypes.windll.kernel32
        k32.GetCurrentProcess.restype = ctypes.c_void_p
        f = k32.K32GetProcessMemoryInfo
        f.argtypes = [ctypes.c_void_p, ctypes.POINTER(_PMC), ctypes.c_ulong]
        if not f(k32.GetCurrentProcess(), ctypes.byref(pmc), pmc.cb):
            return None, None
        return pmc.WorkingSetSize / 2 ** 20, pmc.PeakWorkingSetSize / 2 ** 20
    except Exception:
        return None, None


_HZ = []


def _cycles():
    k32 = ctypes.windll.kernel32
    k32.GetCurrentProcess.restype = ctypes.c_void_p
    k32.QueryProcessCycleTime.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_ulonglong)]
    c = ctypes.c_ulonglong()
    k32.QueryProcessCycleTime(k32.GetCurrentProcess(), ctypes.byref(c))
    return c.value


def cpu_s():
    """CPU time of this process (all threads) in seconds from QueryProcessCycleTime, calibrated against perf_counter.
    time.process_time() is NOT used: on Windows it is sampled at the clock tick and reported ~0 s for timer-driven
    processes whose work starts right after a tick (pitfall found in this campaign)."""
    try:
        if not _HZ:
            path = os.path.join(DATA, 'cpu_hz.json')
            if os.path.exists(path):
                _HZ.append(load(path)['hz'])
            else:
                c0, t0 = _cycles(), __import__('time').perf_counter()
                while __import__('time').perf_counter() - t0 < 0.3:
                    pass
                _HZ.append((_cycles() - c0) / (__import__('time').perf_counter() - t0))
                dump(path, {'hz': _HZ[0], 'note': 'process cycles per busy second (QueryProcessCycleTime calibration)'})
        return _cycles() / _HZ[0]
    except Exception:
        return __import__('time').process_time()


def dump(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f)


def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)
