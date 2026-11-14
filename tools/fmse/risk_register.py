#!/usr/bin/env python3
"""Risk register for FMS projects: score, class, sorted list and a 5 x 5 heat map.

Offline, Python standard library only. Default risks: "risks" in examples/item1_examples.json.
Your own risks: --risks file.csv with the columns (semicolon separated, header optional)
    id;title;P;I;mitigation          P, I = whole numbers 1..5

Formulas (same as "_formulas" -> "risk_score" in the shared JSON):
    score = P x I            (P = probability 1..5, I = impact 1..5, score 1..25)
    class = HIGH   if score >= 15
            MEDIUM if 8 <= score <= 14
            LOW    if score <= 7
Sort order: score high -> low, then P high -> low, then id.
Heat map: rows = impact 5 (top) .. 1, columns = probability 1 .. 5; each cell shows the class
letter (H / M / L), the number of risks and their ids.
"""

import argparse
import csv
from pathlib import Path

from fmse_common import DEFAULT_EXAMPLES, InputError, SelfTest, fmt_table, load_examples, run_main, write_csv


def classify(score):
    """Risk class for a score 1..25."""
    if score >= 15:
        return "HIGH"
    if score >= 8:
        return "MEDIUM"
    return "LOW"


def make_risk(rid, title, p, i, mitigation, where):
    """Build and check one risk dict."""
    try:
        p, i = int(p), int(i)
    except (TypeError, ValueError):
        raise InputError(f"{where}: P and I must be whole numbers 1..5 (got {p!r}, {i!r})")
    if not (1 <= p <= 5 and 1 <= i <= 5):
        raise InputError(f"{where}: P and I must be between 1 and 5 (got P={p}, I={i})")
    s = p * i
    return {"id": str(rid), "title": str(title), "P": p, "I": i, "score": s, "class": classify(s),
            "mitigation": str(mitigation)}


def risks_from_json(rows):
    """Convert the JSON list [id, title, P, I, mitigation] into risk dicts."""
    out = []
    for k, r in enumerate(rows, start=1):
        if len(r) < 4:
            raise InputError(f"risks entry {k}: needs [id, title, P, I, mitigation]")
        out.append(make_risk(r[0], r[1], r[2], r[3], r[4] if len(r) > 4 else "", f"risk {r[0]}"))
    return out


def risks_from_csv(path):
    """Read risks from a semicolon CSV id;title;P;I;mitigation."""
    p = Path(path)
    if not p.is_file():
        raise InputError(f"risk file not found: {p}")
    out = []
    with p.open("r", encoding="utf-8-sig", newline="") as fh:
        for ln, row in enumerate(csv.reader(fh, delimiter=";"), start=1):
            if not row or not "".join(row).strip() or row[0].strip().startswith("#"):
                continue
            if ln == 1 and len(row) > 2 and not row[2].strip().isdigit():
                continue  # header
            if len(row) < 4:
                raise InputError(f"{p} line {ln}: need id;title;P;I;mitigation")
            out.append(make_risk(row[0].strip(), row[1].strip(), row[2].strip(), row[3].strip(),
                                 row[4].strip() if len(row) > 4 else "", f"{p} line {ln}"))
    if not out:
        raise InputError(f"{p}: no risks found")
    return out


def sort_register(risks):
    """Sorted copy: score desc, P desc, id asc."""
    return sorted(risks, key=lambda r: (-r["score"], -r["P"], r["id"]))


def heat_map(risks):
    """Return the heat map as text (rows impact 5..1, columns probability 1..5)."""
    cells = {(p, i): [] for p in range(1, 6) for i in range(1, 6)}
    for r in risks:
        cells[(r["P"], r["I"])].append(r["id"])
    width = max(14, max((len(" ".join(v)) + 4 for v in cells.values()), default=14))
    width = min(width, 34)
    lines = ["Impact", "  ^"]
    sep = "     +" + "+".join("-" * width for _ in range(5)) + "+"
    lines.append(sep)
    for i in range(5, 0, -1):
        top, ids_lines = [], []
        for p in range(1, 6):
            ids = cells[(p, i)]
            cls = classify(p * i)[0]
            top.append(f" {cls}{p*i:>3}  n={len(ids)}".ljust(width)[:width])
        # wrap ids over up to 2 lines
        wrapped = []
        for p in range(1, 6):
            txt = " ".join(cells[(p, i)])
            w = width - 2
            parts = [txt[k:k + w] for k in range(0, len(txt), w)] or [""]
            wrapped.append(parts)
        depth = max(len(x) for x in wrapped)
        lines.append(f"  {i}  |" + "|".join(top) + "|")
        for d in range(depth):
            lines.append("     |" + "|".join((" " + (x[d] if d < len(x) else "")).ljust(width) for x in wrapped) + "|")
        lines.append(sep)
    lines.append("      " + "".join(f"{p}".center(width + 1) for p in range(1, 6)) + "-> Probability")
    lines.append("Cell: class letter (H >= 15, M 8..14, L <= 7), score P x I, n = number of risks, ids")
    return "\n".join(lines)


def report(risks, csv_path=None):
    """Print the sorted register, counts and heat map; optionally write CSV."""
    reg = sort_register(risks)
    print("RISK REGISTER   score = P x I   (HIGH >= 15, MEDIUM 8..14, LOW <= 7)")
    print()
    print(fmt_table(["rank", "id", "risk", "P", "I", "score", "class", "mitigation"],
                    [[k, r["id"], r["title"], r["P"], r["I"], r["score"], r["class"], r["mitigation"]]
                     for k, r in enumerate(reg, start=1)], "rllrrrll"))
    print()
    cnt = {c: sum(1 for r in reg if r["class"] == c) for c in ("HIGH", "MEDIUM", "LOW")}
    print(f"Count: {len(reg)} risks  -  HIGH {cnt['HIGH']}, MEDIUM {cnt['MEDIUM']}, LOW {cnt['LOW']}")
    print("Top 3: " + "; ".join(f"{r['id']} {r['title']} ({r['score']})" for r in reg[:3]))
    print()
    print(heat_map(reg))
    if csv_path:
        p = write_csv(csv_path, ["rank", "id", "risk", "P", "I", "score", "class", "mitigation"],
                      [[k, r["id"], r["title"], r["P"], r["I"], r["score"], r["class"], r["mitigation"]]
                       for k, r in enumerate(reg, start=1)])
        print(f"\nCSV written: {p}")
    return reg


def selftest(path):
    """Asserts against the hand-sorted example register."""
    t = SelfTest("risk_register")
    _, rows = load_examples(path, "risks")
    reg = sort_register(risks_from_json(rows))
    t.equal("number of risks", len(reg), 15)
    t.equal("top 4 ids (score 16,16,16,15)", [r["id"] for r in reg[:4]], ["R02", "R03", "R05", "R01"])
    t.equal("top scores", [r["score"] for r in reg[:4]], [16, 16, 16, 15])
    cnt = {c: sum(1 for r in reg if r["class"] == c) for c in ("HIGH", "MEDIUM", "LOW")}
    t.equal("class counts H/M/L", (cnt["HIGH"], cnt["MEDIUM"], cnt["LOW"]), (4, 9, 2))  # hand count: 16,16,16,15 | 12,12,12,10,9,9,9,8,8 | 6,5
    t.equal("lowest = R14 (1 x 5 = 5)", (reg[-1]["id"], reg[-1]["score"]), ("R14", 5))
    t.equal("class borders 15/14/8/7", [classify(x) for x in (15, 14, 8, 7)], ["HIGH", "MEDIUM", "MEDIUM", "LOW"])
    hm = heat_map(reg)
    t.true("heat map cell P4 I4 has R02 R03 R05", "R02 R03 R05" in hm)
    try:
        make_risk("X", "x", 6, 1, "", "test")
        t.true("P = 6 rejected", False)
    except InputError:
        t.true("P = 6 rejected", True)
    return t.finish()


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Example:\n  python tools/fmse/risk_register.py --csv risks_sorted.csv\n"
               "  python tools/fmse/risk_register.py --risks my_risks.csv")
    ap.add_argument("--examples", default=str(DEFAULT_EXAMPLES), help="shared example JSON (default: %(default)s)")
    ap.add_argument("--risks", help="your own risk CSV id;title;P;I;mitigation (default: example risks)")
    ap.add_argument("--csv", help="write the sorted register to this CSV file")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    if a.risks:
        risks = risks_from_csv(a.risks)
    else:
        _, rows = load_examples(a.examples, "risks")
        risks = risks_from_json(rows)
    ids = [r["id"] for r in risks]
    dup = sorted({x for x in ids if ids.count(x) > 1})
    if dup:
        raise InputError(f"risk ids used twice: {', '.join(dup)}")
    report(risks, a.csv)
    return 0


if __name__ == "__main__":
    run_main(main)
