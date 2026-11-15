#!/usr/bin/env python3
"""IEC 61131-3 standard function blocks (TON, TOF, TP, R_TRIG, F_TRIG, CTU, CTD, SR, RS) as a scan-based trace.

Python 3 standard library only, offline. Rule = "_rules.fb_trace" in examples/item9_examples.json, applied EXACTLY.
Guide docs/FMS system design/69_plc_programming.md and the web page use the same definitions, so the table and the
events are identical.

Definitions (one call per scan, time t = k*dt in ms):
  TON   IN: start (first scan) ; ET = min(PT, t - start) ; Q = ET >= PT.   not IN: start None, ET 0, Q False
  TOF   IN: run, fall None, ET 0, Q True. not IN after a run: fall (first scan) ; ET = min(PT, t - fall) ;
        Q = ET < PT.  never run: ET 0, Q False
  TP    rising IN (and no pulse running) starts the pulse ; el < PT: Q True, ET el ; el >= PT: Q False, ET PT and
        when IN is False the pulse is cleared (ET 0) - a TP cannot be re-triggered while it runs
  R_TRIG Q = CLK and not M ; M = CLK      F_TRIG Q = not CLK and P ; P = CLK (M, P start False)
  CTU   R: CV 0 ; elif rising CU and CV < 32767: CV += 1 ; Q = CV >= PV
  CTD   LD: CV PV ; elif rising CD and CV > -32768: CV -= 1 ; Q = CV <= 0
  SR    Q1 = S1 or (not R and Q1)   (set dominant)       RS  Q1 = not R1 and (S or Q1)   (reset dominant)
Wiring of the trace: TON/TOF/TP IN = A ; R_TRIG/F_TRIG CLK = A ; CTU CU = A, R = RST ; CTD CD = A, LD = LD ;
SR S1 = A, R = B ; RS S = A, R1 = B.

Usage:
  python tools/fmse/iec_std_fb.py                        (trace of the JSON example: table + events; = --trace)
  python tools/fmse/iec_std_fb.py --trace --diagram      (+ ASCII timing diagram)
  python tools/fmse/iec_std_fb.py --pt 30 --pv 2 --a 2-8,11-12 --b 6-7 --rst 33 --ld 0,36 --n 40
  python tools/fmse/iec_std_fb.py --md trace.md --csv trace.csv --json
  python tools/fmse/iec_std_fb.py --selftest
"""

import argparse
import json
from pathlib import Path

from fmse_common import InputError, SelfTest, fmt_table, load_json, run_main, write_csv

HERE = Path(__file__).resolve().parent
ITEM9_EXAMPLES = HERE / "examples" / "item9_examples.json"
INT_MAX, INT_MIN = 32767, -32768


# ----------------------------------------------------------------------------- the function blocks
class TON:
    """On-delay timer. Call with (IN, t_ms); outputs Q, ET."""

    def __init__(self, PT):
        self.PT, self.start, self.Q, self.ET = PT, None, False, 0

    def __call__(self, IN, t):
        if IN:
            if self.start is None:
                self.start = t
            self.ET = min(self.PT, t - self.start)
            self.Q = self.ET >= self.PT
        else:
            self.start, self.ET, self.Q = None, 0, False
        return self.Q


class TOF:
    """Off-delay timer."""

    def __init__(self, PT):
        self.PT, self.run, self.fall, self.Q, self.ET = PT, False, None, False, 0

    def __call__(self, IN, t):
        if IN:
            self.run, self.fall, self.ET, self.Q = True, None, 0, True
        elif self.run:
            if self.fall is None:
                self.fall = t
            self.ET = min(self.PT, t - self.fall)
            self.Q = self.ET < self.PT
        else:
            self.ET, self.Q = 0, False
        return self.Q


class TP:
    """Pulse timer (not re-triggerable)."""

    def __init__(self, PT):
        self.PT, self.start, self.prev, self.Q, self.ET = PT, None, False, False, 0

    def __call__(self, IN, t):
        if IN and not self.prev and self.start is None:
            self.start = t
        if self.start is not None:
            el = t - self.start
            if el < self.PT:
                self.Q, self.ET = True, el
            else:
                self.Q, self.ET = False, self.PT
                if not IN:
                    self.start, self.ET = None, 0
        else:
            self.Q, self.ET = False, 0
        self.prev = IN
        return self.Q


class R_TRIG:
    def __init__(self):
        self.M, self.Q = False, False

    def __call__(self, CLK):
        self.Q = CLK and not self.M
        self.M = CLK
        return self.Q


class F_TRIG:
    def __init__(self):
        self.P, self.Q = False, False

    def __call__(self, CLK):
        self.Q = (not CLK) and self.P
        self.P = CLK
        return self.Q


class CTU:
    def __init__(self, PV):
        self.PV, self.CV, self.prev, self.Q = PV, 0, False, False

    def __call__(self, CU, R):
        edge = CU and not self.prev
        self.prev = CU
        if R:
            self.CV = 0
        elif edge and self.CV < INT_MAX:
            self.CV += 1
        self.Q = self.CV >= self.PV
        return self.Q


class CTD:
    def __init__(self, PV):
        self.PV, self.CV, self.prev, self.Q = PV, 0, False, False

    def __call__(self, CD, LD):
        edge = CD and not self.prev
        self.prev = CD
        if LD:
            self.CV = self.PV
        elif edge and self.CV > INT_MIN:
            self.CV -= 1
        self.Q = self.CV <= 0
        return self.Q


class SR:
    """Set dominant bistable."""

    def __init__(self):
        self.Q1 = False

    def __call__(self, S1, R):
        self.Q1 = S1 or ((not R) and self.Q1)
        return self.Q1


class RS:
    """Reset dominant bistable."""

    def __init__(self):
        self.Q1 = False

    def __call__(self, S, R1):
        self.Q1 = (not R1) and (S or self.Q1)
        return self.Q1


# ----------------------------------------------------------------------------- trace
COLS = ["k", "A", "B", "RST", "LD", "TON_Q", "TON_ET", "TOF_Q", "TOF_ET", "TP_Q", "TP_ET", "RTRIG", "FTRIG",
        "CTU_CV", "CTU_Q", "CTD_CV", "CTD_Q", "SR", "RS"]
EVENT_KEYS = ["TON_Q", "TOF_Q", "TP_Q", "RTRIG", "FTRIG", "CTU_Q", "CTD_Q", "SR", "RS", "CTU_CV", "CTD_CV"]
BOOL_COLS = ["A", "B", "RST", "LD", "TON_Q", "TOF_Q", "TP_Q", "RTRIG", "FTRIG", "CTU_Q", "CTD_Q", "SR", "RS"]


def check_trace(F):
    for k in ("dt_ms", "N", "PT_ms", "PV", "signals"):
        if k not in F:
            raise InputError(f"fb_trace: value '{k}' is missing")
    for k in ("dt_ms", "N", "PT_ms"):
        if not isinstance(F[k], int) or F[k] < 1:
            raise InputError(f"fb_trace: '{k}' must be a whole number >= 1")
    for s in ("A", "B", "RST", "LD"):
        for r in F["signals"].get(s, []):
            if len(r) != 2 or r[0] > r[1]:
                raise InputError(f"fb_trace: signal {s} range {r!r} must be [first, last] with first <= last")


def trace(F):
    """Run the scan trace. Returns (rows, events) with ints for booleans like the guide table."""
    check_trace(F)
    dt, PT, PV = F["dt_ms"], F["PT_ms"], F["PV"]
    sig = lambda name, k: any(a <= k <= b for a, b in F["signals"].get(name, []))
    ton, tof, tp = TON(PT), TOF(PT), TP(PT)
    rt, ft, ctu, ctd, sr, rs = R_TRIG(), F_TRIG(), CTU(PV), CTD(PV), SR(), RS()
    rows = []
    for k in range(F["N"]):
        t = k * dt
        A, B, RST, LD = sig("A", k), sig("B", k), sig("RST", k), sig("LD", k)
        ton(A, t)
        tof(A, t)
        tp(A, t)
        rt(A)
        ft(A)
        ctu(A, RST)
        ctd(A, LD)
        sr(A, B)
        rs(A, B)
        vals = [k, A, B, RST, LD, ton.Q, ton.ET, tof.Q, tof.ET, tp.Q, tp.ET, rt.Q, ft.Q, ctu.CV, ctu.Q, ctd.CV,
                ctd.Q, sr.Q1, rs.Q1]
        rows.append({c: (int(v) if isinstance(v, bool) else v) for c, v in zip(COLS, vals)})
    ev = {}
    for key in EVENT_KEYS:
        ev[key] = [(r["k"], r[key]) for i, r in enumerate(rows)
                   if (i == 0 and r[key]) or (i > 0 and r[key] != rows[i - 1][key])]
    return rows, ev


def diagram(rows):
    """ASCII timing diagram: one line per boolean signal, '#' = TRUE, '_' = FALSE; + the counter values."""
    n = len(rows)
    ruler = "".join(str((k // 10) % 10) if k % 10 == 0 else " " for k in range(n))
    ruler2 = "".join(str(k % 10) for k in range(n))
    out = [f"{'scan k':>7}  {ruler}", f"{'':>7}  {ruler2}"]
    for c in BOOL_COLS:
        out.append(f"{c:>7}  " + "".join("#" if r[c] else "_" for r in rows))
    for c in ("CTU_CV", "CTD_CV"):
        out.append(f"{c:>7}  " + "".join(str(r[c]) if 0 <= r[c] <= 9 else "*" for r in rows))
    return "\n".join(out)


def ranges_text(rs):
    return ", ".join(f"{a}" if a == b else f"{a}-{b}" for a, b in rs) or "-"


def parse_ranges(text, name):
    out = []
    for part in [p.strip() for p in str(text).split(",") if p.strip()]:
        try:
            if "-" in part:
                a, b = part.split("-", 1)
                out.append([int(a), int(b)])
            else:
                out.append([int(part), int(part)])
        except ValueError:
            raise InputError(f"--{name}: '{part}' must be a scan number or a range like 2-8")
    return out


def md_trace(F, rows, ev):
    L = ["# IEC 61131-3 standard FB trace (item 9)", "",
         f"dt = {F['dt_ms']} ms, N = {F['N']} scans, PT = {F['PT_ms']} ms, PV = {F['PV']}; "
         + "; ".join(f"{s} on {ranges_text(F['signals'].get(s, []))}" for s in ("A", "B", "RST", "LD")), "",
         "| " + " | ".join(COLS) + " |", "|" + "---:|" * len(COLS)]
    L += ["| " + " | ".join(str(r[c]) for c in COLS) + " |" for r in rows]
    L += ["", "## Events (scan, new value)", ""] + [f"- {k}: {v}" for k, v in ev.items()]
    return "\n".join(L) + "\n"


# ----------------------------------------------------------------------------- self-test
REF_EVENTS = {"TON_Q": [(7, 1), (9, 0), (20, 1), (30, 0)], "TOF_Q": [(2, 1), (35, 0)],
              "TP_Q": [(2, 1), (7, 0), (11, 1), (16, 0)],
              "RTRIG": [(2, 1), (3, 0), (11, 1), (12, 0), (15, 1), (16, 0)],
              "FTRIG": [(9, 1), (10, 0), (13, 1), (14, 0), (30, 1), (31, 0)], "CTU_Q": [(15, 1), (33, 0)],
              "CTD_Q": [(15, 1), (36, 0)], "SR": [(2, 1), (32, 0)],
              "RS": [(2, 1), (6, 0), (8, 1), (20, 0), (23, 1), (32, 0)],
              "CTU_CV": [(2, 1), (11, 2), (15, 3), (33, 0)], "CTD_CV": [(0, 3), (2, 2), (11, 1), (15, 0), (36, 3)]}
# selected full rows of the reference table (k: values in COLS order)
REF_ROWS = {
    0: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0],
    2: [2, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 2, 0, 1, 1],
    6: [6, 1, 1, 0, 0, 0, 40, 1, 0, 1, 40, 0, 0, 1, 0, 2, 0, 1, 0],
    7: [7, 1, 1, 0, 0, 1, 50, 1, 0, 0, 50, 0, 0, 1, 0, 2, 0, 1, 0],
    9: [9, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 2, 0, 1, 1],
    13: [13, 0, 0, 0, 0, 0, 0, 1, 0, 1, 20, 0, 1, 2, 0, 1, 0, 1, 1],
    15: [15, 1, 0, 0, 0, 0, 0, 1, 0, 1, 40, 1, 0, 3, 1, 0, 1, 1, 1],
    16: [16, 1, 0, 0, 0, 0, 10, 1, 0, 0, 50, 0, 0, 3, 1, 0, 1, 1, 1],
    20: [20, 1, 1, 0, 0, 1, 50, 1, 0, 0, 50, 0, 0, 3, 1, 0, 1, 1, 0],
    30: [30, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 3, 1, 0, 1, 1, 1],
    32: [32, 0, 1, 0, 0, 0, 0, 1, 20, 0, 0, 0, 0, 3, 1, 0, 1, 0, 0],
    33: [33, 0, 1, 1, 0, 0, 0, 1, 30, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    35: [35, 0, 0, 0, 0, 0, 0, 0, 50, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    36: [36, 0, 0, 0, 1, 0, 0, 0, 50, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0],
    39: [39, 0, 0, 0, 0, 0, 0, 0, 50, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0]}


def row_text(r):
    return "fb " + " ".join(f"{c}={r[c]}" for c in COLS)


def selftest(path):
    import zlib
    t = SelfTest("iec_std_fb")
    F = load_json(path or ITEM9_EXAMPLES)["fb_trace"]
    rows, ev = trace(F)
    t.equal("40 scan rows", len(rows), 40)
    for key, want in REF_EVENTS.items():
        t.equal(f"events {key} = reference", ev[key], want)
    for k, want in REF_ROWS.items():
        t.equal(f"row k={k} = reference", [rows[k][c] for c in COLS], want)
    full = "\n".join(row_text(r) for r in rows)
    t.equal("whole 40-row table: Adler-32 of the reference row text 'fb k=.. ..' = fd8a8658",
            format(zlib.adler32(full.encode()) & 0xffffffff, "08x"), REF_FULL_TEXT_SUM)
    # unit checks of the single blocks
    ton = TON(50)
    t.equal("TON: Q after exactly PT (0,10,..,50 ms -> TRUE at 50)",
            [ton(True, x) for x in range(0, 60, 10)], [False] * 5 + [True])
    tof = TOF(30)
    t.equal("TOF: Q stays TRUE for PT after IN falls, never run -> FALSE",
            [TOF(30)(False, 0)] + [tof(v, x) for v, x in ((True, 0), (False, 10), (False, 20), (False, 30), (False, 40))],
            [False, True, True, True, True, False])
    tp = TP(20)
    t.equal("TP: not re-triggerable, pulse length PT",
            [tp(v, x) for v, x in ((True, 0), (False, 10), (True, 20), (True, 30), (False, 40), (True, 50))],
            [True, True, False, False, False, True])
    c = CTU(2)
    c.CV = 32767
    c(True, False)
    t.equal("CTU stops at 32767 (INT)", c.CV, 32767)
    d = CTD(0)
    d.CV = -32768
    d(True, False)
    t.equal("CTD stops at -32768 (INT)", d.CV, -32768)
    s, r = SR(), RS()
    t.equal("SR: S1 and R both TRUE -> Q1 TRUE (set dominant)", s(True, True), True)
    t.equal("RS: S and R1 both TRUE -> Q1 FALSE (reset dominant)", r(True, True), False)
    f = F_TRIG()
    t.equal("F_TRIG with P = False at start: no pulse in the first scan", f(False), False)
    t.true("ASCII diagram has one line per boolean + 2 counters + 2 ruler lines",
           len(diagram(rows).splitlines()) == len(BOOL_COLS) + 4)
    t.equal("parse ranges '2-8, 11'", parse_ranges("2-8, 11", "a"), [[2, 8], [11, 11]])
    try:
        trace({**F, "PT_ms": 0})
        t.true("PT 0 -> InputError", False)
    except InputError:
        t.true("PT 0 -> InputError", True)
    return t.finish()


REF_FULL_TEXT_SUM = "fd8a8658"


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", default=str(ITEM9_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--example", action="store_true", help="trace of the JSON example (default)")
    ap.add_argument("--trace", action="store_true", help="print the scan table + events (default)")
    ap.add_argument("--diagram", action="store_true", help="also print an ASCII timing diagram")
    ap.add_argument("--pt", type=int, help="own PT in ms")
    ap.add_argument("--pv", type=int, help="own PV of CTU / CTD")
    ap.add_argument("--n", type=int, help="own number of scans")
    ap.add_argument("--dt", type=int, help="own scan time ms")
    for s in ("a", "b", "rst", "ld"):
        ap.add_argument(f"--{s}", help=f"own scan ranges where {s.upper()} is TRUE, e.g. 2-8,11-12")
    ap.add_argument("--md", help="write a Markdown report")
    ap.add_argument("--csv", help="write the table to a CSV file")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    F = dict(load_json(a.examples)["fb_trace"])
    F["signals"] = dict(F["signals"])
    for key, val in (("PT_ms", a.pt), ("PV", a.pv), ("N", a.n), ("dt_ms", a.dt)):
        if val is not None:
            F[key] = val
    for s in ("a", "b", "rst", "ld"):
        v = getattr(a, s)
        if v is not None:
            F["signals"][s.upper()] = parse_ranges(v, s)
    rows, ev = trace(F)
    if a.csv:
        write_csv(a.csv, COLS, [[r[c] for c in COLS] for r in rows])
    if a.md:
        Path(a.md).write_text(md_trace(F, rows, ev), encoding="utf-8")
    if a.json:
        print(json.dumps({"params": F, "rows": rows, "events": ev}, indent=1))
        return 0
    print(f"IEC 61131-3 STANDARD FB TRACE  dt {F['dt_ms']} ms, {F['N']} scans, PT {F['PT_ms']} ms, PV {F['PV']}")
    print("  " + " ; ".join(f"{s} TRUE on {ranges_text(F['signals'].get(s, []))}" for s in ("A", "B", "RST", "LD")))
    print()
    print(fmt_table(COLS, [[r[c] for c in COLS] for r in rows], "r" * len(COLS)))
    print()
    print("EVENTS (scan, new value)")
    for k, v in ev.items():
        print(f"  {k:7} {', '.join(f'{s}:{x}' for s, x in v) or '-'}")
    if a.diagram:
        print()
        print(diagram(rows))
    for p, what in ((a.csv, "CSV"), (a.md, "Markdown")):
        if p:
            print(f"\n{what} written: {p}")
    return 0


if __name__ == "__main__":
    run_main(main)
