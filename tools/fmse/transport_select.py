#!/usr/bin/env python3
"""Which transport / handling system fits the need? Weighted star scoring (item 3, section 3B).

Python 3 standard library only, offline. Formula = "_formulas.transport_score" in examples/item3_examples.json:
  score(option) = sum_k w_k*s_k / sum_k w_k
  s = star count 1..5 from the table "transport_select.options";
  for the criterion "Investment" s = 6 - stars (1 star = cheap = good -> 5 points)
Weights 1..5 per criterion: the 3 example needs in the JSON (--need 1|2|3) or your own (--weights 2,4,5,3).
Default: all example needs. A score is a first filter only - check the knock-outs (floor, distance,
load, stop accuracy at the station) and then size the winner (agv_fleet.py, asrs_cycle.py, ...).
"""

import argparse

from fmse_common import ITEM3_EXAMPLES, InputError, SelfTest, fmt_table, load_examples, parse_float_list, run_main, \
    text_bar, write_csv


def points(criteria, stars):
    """Stars -> points (investment inverted)."""
    return [6 - s if c.strip().lower() == "investment" else s for c, s in zip(criteria, stars)]


def score(ts, weights):
    crit = ts["criteria"]
    if len(weights) != len(crit):
        raise InputError(f"need {len(crit)} weights ({', '.join(crit)}), got {len(weights)}")
    if any(w < 0 for w in weights) or sum(weights) <= 0:
        raise InputError("weights must be >= 0 and not all 0")
    res = []
    for name, stars in ts["options"]:
        if len(stars) != len(crit) or any(not 1 <= s <= 5 for s in stars):
            raise InputError(f"option '{name}': need {len(crit)} star counts 1..5")
        pts = points(crit, stars)
        res.append({"name": name, "stars": stars, "pts": pts,
                    "score": sum(w * s for w, s in zip(weights, pts)) / sum(weights)})
    ranked = sorted(res, key=lambda r: -r["score"])          # stable: table order wins a tie
    return ranked


def show(ts, label, weights):
    crit = ts["criteria"]
    ranked = score(ts, weights)
    print(f"NEED: {label}")
    print("  weights: " + ", ".join(f"{c} {w:g}" for c, w in zip(crit, weights)) + f"   (sum {sum(weights):g})")
    rows = []
    for k, r in enumerate(ranked, 1):
        num = " + ".join(f"{w:g}·{s}" for w, s in zip(weights, r["pts"]))
        rows.append([k, r["name"], " ".join(str(p) for p in r["pts"]), f"({num})/{sum(weights):g}", f"{r['score']:.3f}",
                     text_bar(r["score"], 5, 20)])
    print(fmt_table(["rank", "option", "points (" + ", ".join(c[:5] for c in crit) + ")", "score formula", "score", ""],
                    rows, "rlllrl"))
    top = [r for r in ranked if abs(r["score"] - ranked[0]["score"]) < 1e-12]
    line = f"  Winner: {' / '.join(r['name'] for r in top)} ({ranked[0]['score']:.3f})" + (" - tie" if len(top) > 1 else "")
    if len(ranked) > len(top):
        nxt = ranked[len(top)]
        line += f"; next: {nxt['name']} ({nxt['score']:.3f}), margin {ranked[0]['score'] - nxt['score']:.3f}"
    print(line)
    return ranked


def selftest(path):
    t = SelfTest("transport_select")
    _, ts = load_examples(path, "transport_select")
    t.equal("investment inverted 6 - 3 = 3, 6 - 2 = 4", points(ts["criteria"], [4, 2, 3, 2]), [4, 2, 3, 4])
    r1 = {r["name"]: r["score"] for r in score(ts, ts["needs"][0][1])}
    t.close("need 1 RGV (4+16+25+9)/14 = 54/14", r1["RGV on rail"], 54 / 14, 1e-12)
    t.close("need 1 conveyor 50/14", r1["Roller / chain conveyor"], 50 / 14, 1e-12)
    t.close("need 1 forklift AGV 40/14", r1["Forklift AGV"], 40 / 14, 1e-12)
    t.close("need 1 stacker 42/14", r1["Stacker crane (pallet pool)"], 42 / 14, 1e-12)
    t.equal("need 1 winner RGV on rail", score(ts, ts["needs"][0][1])[0]["name"], "RGV on rail")
    r2 = {r["name"]: r["score"] for r in score(ts, ts["needs"][1][1])}
    t.close("need 2 AMR (25+4+4+16)/13 = 49/13", r2["AMR"], 49 / 13, 1e-12)
    t.close("need 2 AGV roller deck 44/13", r2["AGV with roller deck"], 44 / 13, 1e-12)
    t.equal("need 2 winner AMR", score(ts, ts["needs"][1][1])[0]["name"], "AMR")
    r3 = {r["name"]: r["score"] for r in score(ts, ts["needs"][2][1])}
    t.close("need 3 AMR (20+4+4+12)/11 = 40/11", r3["AMR"], 40 / 11, 1e-12)
    t.close("need 3 AGV roller deck 37/11", r3["AGV with roller deck"], 37 / 11, 1e-12)
    t.equal("need 3 winner AMR", score(ts, ts["needs"][2][1])[0]["name"], "AMR")
    try:
        score(ts, [1, 2])
        t.true("wrong number of weights rejected", False)
    except InputError:
        t.true("wrong number of weights rejected", True)
    return t.finish()


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n  python tools/fmse/transport_select.py              (all 3 example needs)\n"
               "  python tools/fmse/transport_select.py --need 2\n"
               "  python tools/fmse/transport_select.py --weights 2,4,5,3 --csv transport.csv")
    ap.add_argument("--examples", default=str(ITEM3_EXAMPLES), help="item-3 example JSON (default: %(default)s)")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--need", type=int, help="example need number from the JSON (1, 2, 3)")
    g.add_argument("--weights", help="your weights 1..5 per criterion, comma list in the criteria order")
    ap.add_argument("--csv", help="write the ranking(s) to this CSV file")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    _, ts = load_examples(a.examples, "transport_select")
    crit = ts["criteria"]
    if a.need is not None and not 1 <= a.need <= len(ts["needs"]):
        raise InputError(f"--need must be 1..{len(ts['needs'])}")
    print("Criteria: " + ", ".join(crit) + "   (stars 1..5; Investment: 1 star = cheap -> 6 - stars points)")
    print(fmt_table(["option"] + crit, [[n] + [str(s) for s in st] for n, st in ts["options"]], "l" + "r" * len(crit)))
    print()
    if a.weights:
        needs = [("your weights", parse_float_list(a.weights, "--weights"))]
    elif a.need is not None:
        if not 1 <= a.need <= len(ts["needs"]):
            raise InputError(f"--need must be 1..{len(ts['needs'])}")
        needs = [tuple(ts["needs"][a.need - 1])]
    else:
        needs = [tuple(n) for n in ts["needs"]]
    rows = []
    for k, (label, w) in enumerate(needs):
        if k:
            print()
        for rank, r in enumerate(show(ts, label, w), 1):
            rows.append([label, rank, r["name"]] + r["pts"] + [round(r["score"], 4)])
    if a.csv:
        p = write_csv(a.csv, ["need", "rank", "option"] + [f"points_{c}" for c in crit] + ["score"], rows)
        print(f"CSV written: {p}")
    return 0


if __name__ == "__main__":
    run_main(main)
