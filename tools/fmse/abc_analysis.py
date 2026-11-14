#!/usr/bin/env python3
"""ABC / Pareto analysis of the product-quantity (P-Q) list.

Which few part numbers make most of the volume (or revenue)? Those "A" parts usually get
dedicated, fast equipment; the many "C" parts go to flexible machines or outside suppliers.
Python 3 standard library only, offline.

Formula (same as "_formulas.abc" in examples/item2_examples.json):
    value_i   = annual volume Q_i                     (--basis volume, default)
              = Q_i * price_i                         (--basis revenue)
    sort the parts by value, descending (equal values keep the file order)
    share_i   = value_i / sum(value)
    before_i  = cumulative share of all parts ABOVE part i (before adding it)
    class     = A  if before_i < 80 %
                B  if before_i < 95 %
                C  otherwise
    (so the part that crosses 80 % is still an A part: the A class covers at least 80 %)

Input: section "pq_parts" of the example JSON: parts = [[name, annual volume, price EUR], ...].
"""

import argparse

from fmse_common import (ITEM2_EXAMPLES, InputError, SelfTest, fmt_num, fmt_table, load_examples,
                         run_main, text_bar, write_csv)

A_LIMIT = 0.80
B_LIMIT = 0.95


# ----------------------------------------------------------------------------- core
def check_parts(pq):
    """Validate the pq_parts section; return the list of (name, volume, price)."""
    parts = pq.get("parts") if isinstance(pq, dict) else None
    if not parts:
        raise InputError("pq_parts: 'parts' list is missing or empty")
    out = []
    for k, p in enumerate(parts, 1):
        if not isinstance(p, list) or len(p) < 3:
            raise InputError(f"pq_parts part {k}: expected [name, volume, price]")
        name, q, price = p[0], p[1], p[2]
        if not isinstance(q, (int, float)) or not isinstance(price, (int, float)) or q < 0 or price < 0:
            raise InputError(f"pq_parts part {k} ({name}): volume and price must be numbers >= 0")
        out.append((str(name), float(q), float(price)))
    return out


def abc(parts, basis="volume", a_limit=A_LIMIT, b_limit=B_LIMIT):
    """ABC classification. Returns a list of dict rows in Pareto order (rank 1 = largest value)."""
    if basis not in ("volume", "revenue"):
        raise InputError("basis must be 'volume' or 'revenue'")
    vals = [(n, q, pr, q if basis == "volume" else q * pr) for n, q, pr in parts]
    total = sum(v[3] for v in vals)
    if total <= 0:
        raise InputError("the sum of all values is 0 - nothing to classify")
    vals = sorted(vals, key=lambda v: -v[3])        # stable: equal values keep file order
    rows, cum = [], 0.0
    for rank, (n, q, pr, v) in enumerate(vals, 1):
        before = cum
        cls = "A" if before < a_limit else ("B" if before < b_limit else "C")
        cum += v / total
        rows.append({"rank": rank, "name": n, "volume": q, "price": pr, "value": v,
                     "share": v / total, "before": before, "cum": cum, "class": cls})
    return rows, total


def class_summary(rows):
    """Number of parts, share of parts and share of value per class."""
    n = len(rows)
    out = []
    for c in "ABC":
        sel = [r for r in rows if r["class"] == c]
        out.append({"class": c, "parts": len(sel), "part_share": len(sel) / n if n else 0,
                    "value": sum(r["value"] for r in sel), "value_share": sum(r["share"] for r in sel)})
    return out


# ----------------------------------------------------------------------------- report
ADVICE = {"A": "few parts, most of the volume: dedicated / fast equipment, tight control, own cell",
          "B": "medium: flexible cells with grouped set-ups (part families)",
          "C": "many parts, little volume: flexible machines, bigger lots, or buy outside"}


def report(parts, basis, csv_path=None):
    rows, total = abc(parts, basis)
    unit = "parts/yr" if basis == "volume" else "EUR/yr"
    print(f"ABC / PARETO ANALYSIS   basis = {basis}   total = {fmt_num(total, 0)} {unit}   "
          f"{len(rows)} part numbers")
    print(f"Rule: class A while the cumulative share BEFORE the part < {A_LIMIT*100:.0f} %, "
          f"B while < {B_LIMIT*100:.0f} %, else C")
    print()
    t = []
    for r in rows:
        t.append([r["rank"], r["name"], fmt_num(r["volume"], 0), fmt_num(r["price"], 2),
                  fmt_num(r["value"], 0), f"{r['share']*100:.2f}", f"{r['before']*100:.2f}",
                  f"{r['cum']*100:.2f}", r["class"]])
    print(fmt_table(["#", "part", "Q/yr", "price EUR", "value", "share %", "cum before %", "cum %", "class"],
                    t, "rlrrrrrrl"))
    print()
    print("Class summary:")
    s = class_summary(rows)
    print(fmt_table(["class", "parts", "% of parts", "value", "% of value", "what it means"],
                    [[x["class"], x["parts"], f"{x['part_share']*100:.1f}", fmt_num(x["value"], 0),
                      f"{x['value_share']*100:.2f}", ADVICE[x["class"]]] for x in s], "lrrrrl"))
    print()
    print("Pareto chart (bar = share of value, | = cumulative share, scale 0..100 %):")
    vmax = max(r["share"] for r in rows)
    w = max(len(r["name"]) for r in rows)
    for r in rows:
        bar = text_bar(r["share"], vmax, 30).ljust(30)
        cum_pos = int(round(r["cum"] * 20))
        cum_line = ("." * cum_pos + "|").ljust(21)
        print(f"  {r['class']} {r['name'].ljust(w)} {bar} {r['share']*100:5.1f} %  {cum_line} {r['cum']*100:5.1f} %")
    if csv_path:
        p = write_csv(csv_path, ["rank", "part", "volume_per_year", "price_EUR", "value", "share",
                                 "cum_share_before", "cum_share", "class"],
                      [[r["rank"], r["name"], r["volume"], r["price"], round(r["value"], 4),
                        round(r["share"], 6), round(r["before"], 6), round(r["cum"], 6), r["class"]]
                       for r in rows])
        print(f"\nCSV written: {p}")


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    """Expected values from a separate hand calculation (total volume 100 800 parts/yr)."""
    t = SelfTest("abc_analysis")
    _, pq = load_examples(path, "pq_parts")
    parts = check_parts(pq)
    rows, total = abc(parts, "volume")
    t.close("total volume", total, 100800, 1e-9)
    order = [r["name"].split()[0] for r in rows]
    t.equal("Pareto order (ties keep file order)", order,
            ["P04", "P07", "P05", "P06", "P08", "P09", "P10", "P12", "P02", "P01", "P11", "P03", "P13", "P14", "P15"])
    cls = {r["name"].split()[0]: r["class"] for r in rows}
    t.equal("A parts", sorted(k for k, v in cls.items() if v == "A"), ["P04", "P05", "P06", "P07", "P08", "P09", "P10"])
    t.equal("B parts", sorted(k for k, v in cls.items() if v == "B"), ["P01", "P02", "P11", "P12"])
    t.equal("C parts", sorted(k for k, v in cls.items() if v == "C"), ["P03", "P13", "P14", "P15"])
    s = {x["class"]: x for x in class_summary(rows)}
    t.close("A value share = 81 000 / 100 800", s["A"]["value_share"], 81000 / 100800, 1e-12)
    t.close("B value share = 15 500 / 100 800", s["B"]["value_share"], 15500 / 100800, 1e-12)
    t.close("C value share = 4 300 / 100 800", s["C"]["value_share"], 4300 / 100800, 1e-12)
    # P12 is the first B: cumulative before = 81 000 / 100 800 = 80.357 %
    p12 = [r for r in rows if r["name"].startswith("P12")][0]
    t.close("P12 cumulative before", p12["before"], 81000 / 100800, 1e-12)
    # revenue basis: P04 18000*40 = 720 000, P06 9000*70 = 630 000, P02 4000*150 = 600 000
    rrows, rtot = abc(parts, "revenue")
    t.close("total revenue EUR (sum Q*price)", rtot, 4093800, 1e-6)
    t.equal("revenue rank 1", rrows[0]["name"].split()[0], "P04")      # 18000*40 = 720 000
    t.equal("revenue rank 2", rrows[1]["name"].split()[0], "P06")      # 630 000
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Example:\n  python tools/fmse/abc_analysis.py --basis revenue --csv abc.csv")
    ap.add_argument("--examples", default=str(ITEM2_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--basis", choices=["volume", "revenue"], help="value used for the ranking "
                    "(default: 'basis' in the JSON, else volume)")
    ap.add_argument("--csv", help="write the ranked table to this CSV file")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    _, pq = load_examples(a.examples, "pq_parts")
    basis = a.basis or pq.get("basis", "volume")
    report(check_parts(pq), basis, a.csv)
    return 0


if __name__ == "__main__":
    run_main(main)
