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
