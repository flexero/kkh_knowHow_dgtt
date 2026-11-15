"""Shared helpers for the FMS engineering tools (tools/fmse/*.py).

Python 3 standard library only. Works offline.

What is here:
  - DEFAULT_EXAMPLES : path of the shared worked-example file (examples/item1_examples.json)
  - utf8_console()   : make print() safe for UTF-8 text on the Windows console
  - load_json()      : read a JSON file with clear error messages
  - load_examples()  : read the shared example file and check that a section exists
  - fmt_table()      : simple fixed-width text table
  - SelfTest         : tiny assert collector that prints PASS / FAIL lines
  - write_csv()      : write a semicolon CSV (Excel-friendly in Europe) as UTF-8 with BOM
  - ITEM2_EXAMPLES   : path of the item-2 example file (examples/item2_examples.json)
  - text_bar()       : a horizontal text bar (#####) for quick charts in the console
  - parse_float_list(): "1, 2.5, 3" -> [1.0, 2.5, 3.0] with a clear error message
  - ITEM3_EXAMPLES   : path of the item-3 example file (examples/item3_examples.json)
  - G                : 9.81 m/s2, the same value as the web page (web/fmse3.js)
  - t_move()         : motion time over a distance (trapezoid / triangle profile) = web tMove
  - fmt_web()        : number text exactly like the web page (toLocaleString "en", half away from zero)
  - ITEM4_EXAMPLES   : path of the item-4 example file (examples/item4_examples.json)
  - T_975            : two-sided 95 % Student t quantiles t_{df,0.975} (df 1..30)
  - mean_ci()        : mean, sample std, half width and CI of replication results
  - Mulberry32       : the seeded random generator of web/fmse4.js rng() (32-bit integer arithmetic)
  - expo(), logn()   : exponential and lognormal (Box-Muller) samples exactly like web/fmse4.js
  - with_failures()  : processing with time-based failures = web/fmse4.js withFailures
  - ITEM5_EXAMPLES   : path of the item-5 example file (examples/item5_examples.json)
  - read_js_const()  : read one `export const NAME = ...;` value of a web data file (JSON-like JS)
"""

import csv
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_EXAMPLES = HERE / "examples" / "item1_examples.json"
ITEM2_EXAMPLES = HERE / "examples" / "item2_examples.json"   # item 2: product -> process -> machines
ITEM3_EXAMPLES = HERE / "examples" / "item3_examples.json"   # item 3: elements of an FMS
ITEM4_EXAMPLES = HERE / "examples" / "item4_examples.json"   # item 4: capacity, layout, simulation
ITEM5_EXAMPLES = HERE / "examples" / "item5_examples.json"   # item 5: control architecture
G = 9.81                                                       # same g as web/fmse3.js


class InputError(Exception):
    """Raised for bad user input (file missing, wrong format). Printed without a traceback."""


def utf8_console():
    """Reconfigure stdout / stderr to UTF-8 so symbols like '€', '≤', '×' never crash on Windows."""
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass


def load_json(path):
    """Read a JSON file. Raise InputError with a readable message if it is missing or broken."""
    p = Path(path)
    if not p.is_file():
        raise InputError(f"File not found: {p}")
    try:
        with p.open("r", encoding="utf-8-sig") as fh:
            return json.load(fh)
    except json.JSONDecodeError as exc:
        raise InputError(f"{p} is not valid JSON: line {exc.lineno}, column {exc.colno}: {exc.msg}")
    except UnicodeDecodeError:
        raise InputError(f"{p} is not a UTF-8 text file")


def load_examples(path, section):
    """Load the shared example file and return (whole_dict, data[section])."""
    data = load_json(path or DEFAULT_EXAMPLES)
    if not isinstance(data, dict) or section not in data:
        raise InputError(f"{path or DEFAULT_EXAMPLES}: section '{section}' is missing")
    return data, data[section]


def fmt_num(x, nd=2, thousands=True):
    """Format a number with a fixed number of decimals and a thin thousands separator (space)."""
    if x is None:
        return "-"
    if isinstance(x, float) and (math.isnan(x) or math.isinf(x)):
        return "-"
    s = f"{x:,.{nd}f}" if thousands else f"{x:.{nd}f}"
    return s.replace(",", " ")


def fmt_table(headers, rows, align=None):
    """Return a text table. align: string of 'l'/'r' per column (default: first left, others right)."""
    cols = len(headers)
    if align is None:
        align = "l" + "r" * (cols - 1)
    srows = [[str(c) for c in r] for r in rows]
    widths = [len(str(h)) for h in headers]
    for r in srows:
        for k, c in enumerate(r):
            widths[k] = max(widths[k], len(c))

    def line(cells):
        out = []
        for k, c in enumerate(cells):
            out.append(c.ljust(widths[k]) if align[k] == "l" else c.rjust(widths[k]))
        return "  ".join(out).rstrip()

    sep = "  ".join("-" * w for w in widths)
    return "\n".join([line([str(h) for h in headers]), sep] + [line(r) for r in srows])


def write_csv(path, headers, rows):
    """Write a semicolon-separated CSV (UTF-8 with BOM so Excel shows umlauts / € correctly)."""
    p = Path(path)
    if p.parent and not p.parent.exists():
        p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", encoding="utf-8-sig", newline="") as fh:
        w = csv.writer(fh, delimiter=";")
        w.writerow(headers)
        for r in rows:
            w.writerow(r)
    return p


class SelfTest:
    """Collect checks and print one PASS / FAIL line per check.

    Usage:
        t = SelfTest("tool name")
        t.close("CRF", value, 0.174014760, tol=1e-9)
        t.true("critical path found", ok)
        sys.exit(t.finish())
    """

    def __init__(self, name):
        self.name = name
        self.n_pass = 0
        self.n_fail = 0
        print(f"Self-test: {name}")

    def _report(self, ok, label, detail=""):
        if ok:
            self.n_pass += 1
        else:
            self.n_fail += 1
        print(f"  {'PASS' if ok else 'FAIL'}  {label}{('  ' + detail) if detail else ''}")

    def close(self, label, got, want, tol=1e-6):
        """Numeric check |got - want| <= tol."""
        ok = got is not None and abs(got - want) <= tol
        self._report(ok, label, f"got {got!r}, expected {want!r} (tol {tol})")

    def equal(self, label, got, want):
        """Exact equality check."""
        self._report(got == want, label, "" if got == want else f"got {got!r}, expected {want!r}")

    def true(self, label, cond, detail=""):
        """Boolean check."""
        self._report(bool(cond), label, detail)

    def finish(self):
        """Print the summary and return the process exit code (0 = all passed)."""
        print(f"  -> {self.n_pass} passed, {self.n_fail} failed")
        return 0 if self.n_fail == 0 else 1


def text_bar(value, vmax, width=40, char="#"):
    """Return a bar of `char` whose length is value/vmax * width (empty for value <= 0)."""
    if vmax <= 0 or value <= 0:
        return ""
    return char * max(1, int(round(min(value, vmax) / vmax * width)))


def parse_float_list(text, name="list"):
    """Parse a comma list of numbers. Raise InputError with the option name if it is not valid."""
    try:
        vals = [float(x) for x in str(text).split(",") if x.strip()]
    except ValueError:
        raise InputError(f"{name} must be a comma list of numbers, e.g. 25,50,100")
    if not vals:
        raise InputError(f"{name} is empty")
    return vals


def t_move(s, v, a):
    """Time [s] to move a distance s [m] with top speed v [m/s] and acceleration a [m/s2].

    Same as web/fmse3.js tMove: s <= 0 -> 0; if s > v^2/a the axis reaches top speed
    (trapezoid: t = s/v + v/a), else it never does (triangle: t = 2*sqrt(s/a)).
    """
    if s <= 0:
        return 0.0
    if v <= 0 or a <= 0:
        raise InputError("speed and acceleration must be > 0")
    return s / v + v / a if s > v * v / a else 2 * math.sqrt(s / a)


def fmt_web(x, nd=1, thousands=True):
    """Format like the web page: fixed decimals, ',' thousands, round half away from zero.

    JavaScript toLocaleString("en") rounds the exact binary value half away from zero;
    Decimal(x) is the exact binary value, so ROUND_HALF_UP gives the same digits.
    """
    from decimal import ROUND_HALF_UP, Decimal
    if x is None or (isinstance(x, float) and (math.isnan(x) or math.isinf(x))):
        return "-"
    q = Decimal(1).scaleb(-nd) if nd > 0 else Decimal(1)
    d = Decimal(x).quantize(q, rounding=ROUND_HALF_UP)
    if d == 0:
        d = abs(d)
    return f"{d:,.{max(nd, 0)}f}" if thousands else f"{d:.{max(nd, 0)}f}"


# ----------------------------------------------------------------------------- item 4: statistics + simulation helpers
# two-sided 95 % Student t quantiles t_{df, 0.975}; df 9 = 2.262 as in item4_examples.json
T_975 = {1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
         11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131, 16: 2.120, 17: 2.110, 18: 2.101, 19: 2.093,
         20: 2.086, 21: 2.080, 22: 2.074, 23: 2.069, 24: 2.064, 25: 2.060, 26: 2.056, 27: 2.052, 28: 2.048,
         29: 2.045, 30: 2.042}


def t975(df):
    """t_{df,0.975}; table for df <= 30, normal value 1.96 beyond (df >= 31 differs by < 2.5 %)."""
    if df < 1:
        return float("nan")
    return T_975.get(df, 1.96 if df > 120 else 2.0)


def mean_ci(values):
    """Replication statistics: dict(mean, s, hw, lo, hi, n). hw = t_{n-1,0.975}*s/sqrt(n); n = 1 -> hw nan."""
    v = [x for x in values if x == x]          # drop NaN
    n = len(v)
    if n == 0:
        return {"mean": float("nan"), "s": float("nan"), "hw": float("nan"), "lo": float("nan"),
                "hi": float("nan"), "n": 0}
    m = sum(v) / n
    if n == 1:
        return {"mean": m, "s": float("nan"), "hw": float("nan"), "lo": m, "hi": m, "n": 1}
    s = math.sqrt(sum((x - m) ** 2 for x in v) / (n - 1))
    hw = t975(n - 1) * s / math.sqrt(n)
    return {"mean": m, "s": s, "hw": hw, "lo": m - hw, "hi": m + hw, "n": n}


def fmt_ci(st, nd=2):
    """'2.91 ± 0.01' from a mean_ci() dict."""
    if st["n"] == 0:
        return "-"
    if st["hw"] != st["hw"]:
        return f"{st['mean']:.{nd}f}"
    return f"{st['mean']:.{nd}f} ± {st['hw']:.{nd}f}"


_M32 = 0xFFFFFFFF


class Mulberry32:
    """Seeded uniform generator in [0, 1) = web/fmse4.js rng(seed) (mulberry32).

    JavaScript:  a = (a + 0x6D2B79F5) >>> 0; t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
                 t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    Here every value is kept as an unsigned 32-bit pattern. Math.imul = low 32 bits of the product,
    ToInt32 of the sum in 't ^= t + ...' = the sum modulo 2^32, so the bit patterns (and the numbers)
    are identical for the same seed. Call the object like the JS closure: R().
    """

    __slots__ = ("a",)

    def __init__(self, seed):
        self.a = int(seed) & _M32

    def __call__(self):
        a = (self.a + 0x6D2B79F5) & _M32
        self.a = a
        t = ((a ^ (a >> 15)) * (a | 1)) & _M32
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & _M32)) & _M32
        return (t ^ (t >> 14)) / 4294967296.0


def expo(R, mean):
    """Exponential sample with this mean = web expo: -mean*ln(1 - R())."""
    return -mean * math.log(1.0 - R())


def logn(R, mean, cv):
    """Lognormal sample with this mean and coefficient of variation = web logn (Box-Muller, 2 uniforms)."""
    if not cv:
        return mean
    s2 = math.log(1 + cv * cv)
    mu = math.log(mean) - s2 / 2
    z = math.sqrt(-2 * math.log(1 - R())) * math.cos(2 * math.pi * R())   # same order as JS: first, then second
    return math.exp(mu + math.sqrt(s2) * z)


def with_failures(R, mc, p, mttf, mttr):
    """Processing time p with time-based failures (clock runs only while working) = web withFailures.

    mc is a dict with the remaining time to failure 'ttf' (carried from job to job).
    Returns (duration incl. repairs, down time, segments [(dt, 'run'|'down'), ...]).
    """
    if not (mttf > 0):
        return p, 0.0, [(p, "run")]
    left, dur, down, segs = p, 0.0, 0.0, []
    while mc["ttf"] < left:
        if mc["ttf"] > 0:
            segs.append((mc["ttf"], "run"))
        dur += mc["ttf"]
        left -= mc["ttf"]
        r = expo(R, mttr)
        segs.append((r, "down"))
        dur += r
        down += r
        mc["ttf"] = expo(R, mttf)
    mc["ttf"] -= left
    dur += left
    segs.append((left, "run"))
    return dur, down, segs


def read_js_const(path, name):
    """Return the value of `export const NAME = ...;` in a web data file (web/fmse*_data.js).

    Only for the simple data constants (objects / arrays of strings and numbers). The JS text is
    turned into JSON: comments removed, unquoted keys quoted, trailing commas dropped. Used by the
    self-tests to check that a tool's copy of a table still matches the web page.
    """
    import re
    p = Path(path)
    if not p.is_file():
        raise InputError(f"File not found: {p}")
    text = p.read_text(encoding="utf-8")
    m = re.search(r"export const " + re.escape(name) + r"\s*=\s*", text)
    if not m:
        raise InputError(f"{p}: constant '{name}' not found")
    i, depth, in_str, start = m.end(), 0, None, m.end()
    while i < len(text):                       # find the end of the literal (bracket depth 0)
        c = text[i]
        if in_str:
            if c == "\\":
                i += 1
            elif c == in_str:
                in_str = None
        elif c in "\"'`":
            in_str = c
        elif c in "[{":
            depth += 1
        elif c in "]}":
            depth -= 1
            if depth == 0:
                i += 1
                break
        i += 1
    lit = text[start:i]
    out, k, in_str = [], 0, None              # remove // comments outside strings
    while k < len(lit):
        c = lit[k]
        if in_str:
            out.append(c)
            if c == "\\":
                out.append(lit[k + 1])
                k += 1
            elif c == in_str:
                in_str = None
        elif c == '"':
            in_str = c
            out.append(c)
        elif lit.startswith("//", k):
            while k < len(lit) and lit[k] != "\n":
                k += 1
            continue
        else:
            out.append(c)
        k += 1
    js = "".join(out)
    js = re.sub(r'([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:', r'\1"\2":', js)
    js = re.sub(r",(\s*[\]}])", r"\1", js)
    try:
        return json.loads(js)
    except json.JSONDecodeError as exc:
        raise InputError(f"{p}: constant '{name}' could not be read as JSON ({exc.msg})")


def run_main(main):
    """Run main() and turn InputError into a clean message + exit code 2."""
    utf8_console()
    try:
        code = main()
    except InputError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        code = 2
    except BrokenPipeError:
        code = 0
    sys.exit(code or 0)
