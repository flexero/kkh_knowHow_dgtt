#!/usr/bin/env python3
"""24 V DC control power budget: load current, power supply (PSU) choice and electronic circuit breaker (ECB)
channels with ratings (item 7).

Python 3 standard library only, offline. Formula = "_formulas.dc24_budget" in examples/item7_examples.json.
Guide: docs/FMS system design/67_electrical_safety.md. (The 24 V line drop is in cable_size.py dc24.)

  I_load      = sum I*qty*sim                         [A]
  PSU rating  = smallest standard size >= I_load*reserve
  channel     = sum of its loads ; ECB rating = smallest ECB rating >= channel current*reserve

Own load list as CSV (';' separated, header optional, '#' = comment):
  name;I_A;qty;sim;channel
  PLC CPU + IO modules;1.2;1;1.0;ch1

Usage:
  python tools/fmse/control_power.py                         (JSON example = --example)
  python tools/fmse/control_power.py --loads my_24v.csv --reserve 1.3
  python tools/fmse/control_power.py --md budget.md --csv budget.csv
  python tools/fmse/control_power.py --json
  python tools/fmse/control_power.py --selftest

All values are EXAMPLES. A real design needs sign-off by a qualified engineer with the current IEC 60204-1 edition and
the PSU / ECB makers' data (inrush, derating, selectivity).
"""

import argparse
import csv
import json
from pathlib import Path

from fmse_common import InputError, SelfTest, fmt_table, load_examples, run_main, write_csv

HERE = Path(__file__).resolve().parent
ITEM7_EXAMPLES = HERE / "examples" / "item7_examples.json"
NOTE = ("NOTE: all values are EXAMPLES for teaching. A real design needs sign-off by a qualified engineer using the "
        "current IEC 60204-1 edition and the PSU / ECB makers' data (inrush, derating, selectivity).")


def pick(sizes, x):
    for s in sorted(sizes):
        if s >= x - 1e-9:
            return s
    return None


def check_load(r, k):
    if not isinstance(r, (list, tuple)) or len(r) != 5:
        raise InputError(f"24 V load {k}: {r!r} must be [name, I A, qty, simultaneity, channel]")
    try:
        name, I, q, sim, ch = str(r[0]), float(r[1]), float(r[2]), float(r[3]), str(r[4]).strip()
    except (TypeError, ValueError):
        raise InputError(f"24 V load {k}: I, qty and simultaneity must be numbers: {r!r}")
    if I < 0 or q < 0 or not 0 <= sim <= 1:
        raise InputError(f"24 V load {k}: I, qty >= 0 and 0 <= simultaneity <= 1 needed: {r!r}")
    if not ch:
        raise InputError(f"24 V load {k}: channel name is empty")
    return [name, I, q, sim, ch]


def read_csv(path):
    p = Path(path)
    if not p.is_file():
        raise InputError(f"File not found: {p}")
    out = []
    with p.open("r", encoding="utf-8-sig", newline="") as fh:
        for n, r in enumerate(csv.reader(fh, delimiter=";"), 1):
            if not r or not "".join(r).strip() or r[0].strip().startswith("#"):
                continue
            if n == 1 and r[0].strip().lower() == "name":
                continue
            if len(r) < 5:
                raise InputError(f"{p} line {n}: needs name;I_A;qty;sim;channel")
            out.append(check_load([x.strip() for x in r[:5]], f"{p.name} line {n}"))
    if not out:
        raise InputError(f"{p}: no loads found")
    return out


def budget(D, loads=None, reserve=None):
    res = float(reserve if reserve is not None else D["reserve"])
    if res < 1:
        raise InputError("reserve must be >= 1")
    rows = []
    for k, r in enumerate(loads if loads is not None else D["loads"], 1):
        name, I, q, sim, ch = check_load(r, k)
        rows.append({"name": name, "I": I, "qty": q, "sim": sim, "channel": ch, "I_eff": I * q * sim})
    total = sum(r["I_eff"] for r in rows)
    psu = pick(D["psu_sizes"], total * res)
    chans = []
    for ch in sorted({r["channel"] for r in rows}):
        Ic = sum(r["I_eff"] for r in rows if r["channel"] == ch)
        chans.append({"channel": ch, "I": Ic, "I_res": Ic * res, "rating": pick(D["ecb_ratings"], Ic * res),
                      "loads": [r["name"] for r in rows if r["channel"] == ch]})
    sum_ratings = sum(c["rating"] or 0 for c in chans)
    return {"rows": rows, "total": total, "reserve": res, "total_res": total * res, "psu": psu, "channels": chans,
            "sum_ecb": sum_ratings, "U_psu": D.get("U_psu", 24.0)}


def load_table(B):
    return [[r["name"], f"{r['I']:g}", f"{r['qty']:g}", f"{r['sim']:g}", f"{r['I_eff']:.3f}", r["channel"]]
            for r in B["rows"]]


def chan_table(B):
    return [[c["channel"], f"{c['I']:.3f}", f"{c['I_res']:.3f}", f"{c['rating']} A" if c["rating"] else "none fits",
             ", ".join(c["loads"])] for c in B["channels"]]


LH = ["load", "I A", "qty", "sim", "I_eff A", "channel"]
CH = ["channel", "I A", "I*reserve A", "ECB", "loads"]


def show(B):
    print("24 V LOADS  (I_eff = I*qty*sim)")
    print(fmt_table(LH, load_table(B), "lrrrrl"))
    print()
    psu = f"{B['psu']} A" if B["psu"] else "none of the standard sizes - use two supplies / split the load"
    print(f"  I_load = {B['total']:.3f} A ; * reserve {B['reserve']:g} = {B['total_res']:.3f} A -> PSU {psu}")
    print(f"  output power at {B['U_psu']:g} V: {B['total'] * B['U_psu']:.1f} W (PSU {B['psu'] or '-'} A = "
          f"{(B['psu'] or 0) * B['U_psu']:.0f} W)")
    print()
    print("ECB CHANNELS  (rating = smallest ECB >= channel current*reserve)")
    print(fmt_table(CH, chan_table(B), "lrrrl"))
    if B["psu"] and B["sum_ecb"] > B["psu"]:
        print(f"  info: sum of ECB ratings {B['sum_ecb']} A > PSU {B['psu']} A - normal (not all channels at their "
              "rating at once); check the PSU can trip the largest ECB (boost current)")
    print()
    print(NOTE)


def markdown(B):
    L = ["# 24 V control power budget", "", "| " + " | ".join(LH) + " |", "|" + "---|" * len(LH)]
    L += ["| " + " | ".join(r) + " |" for r in load_table(B)]
    L += ["", f"- I_load = {B['total']:.3f} A, with reserve {B['reserve']:g}: {B['total_res']:.3f} A -> PSU "
          f"{B['psu'] or 'none fits'} A", "", "| " + " | ".join(CH) + " |", "|" + "---|" * len(CH)]
    L += ["| " + " | ".join(r) + " |" for r in chan_table(B)]
    L += ["", "_" + NOTE + "_"]
    return "\n".join(L) + "\n"


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("control_power")
    _, D = load_examples(path, "dc24")
    B = budget(D)
    t.equal("9 loads", len(B["rows"]), 9)
    t.close("sensors 0.03*24 = 0.72 A", B["rows"][3]["I_eff"], 0.72, 1e-9)
    t.close("valves 0.104*10*0.5 = 0.52 A", B["rows"][6]["I_eff"], 0.52, 1e-9)
    t.close("total 5.74 A", B["total"], 5.74, 1e-9)
    t.close("with reserve 7.175 A", B["total_res"], 7.175, 1e-9)
    t.equal("PSU 10 A", B["psu"], 10)
    ch = {c["channel"]: c for c in B["channels"]}
    t.equal("4 channels", sorted(ch), ["ch1", "ch2", "ch3", "ch4"])
    for name, I, r in (("ch1", 2.3, 3), ("ch2", 1.42, 2), ("ch3", 0.52, 1), ("ch4", 1.5, 2)):
        t.close(f"{name} current {I} A", ch[name]["I"], I, 1e-9)
        t.equal(f"{name} ECB {r} A", ch[name]["rating"], r)
    t.equal("sum of ECB ratings 8 A", B["sum_ecb"], 8)
    t.equal("pick 2.4*1.25 = 3.0 exactly -> 3 A", pick(D["ecb_ratings"], 2.4 * 1.25), 3)
    t.equal("pick 8.01 -> 10", pick(D["ecb_ratings"], 8.01), 10)
    big = budget(D, [["Drive brake", 12, 3, 1.0, "ch1"]])
    t.equal("36 A * 1.25 = 45 A -> no standard PSU", big["psu"], None)
    t.equal("12*3*1.25 = 45 A -> no ECB fits", big["channels"][0]["rating"], None)
    t.equal("reserve 1.5: 5.74*1.5 = 8.61 -> PSU 10", budget(D, reserve=1.5)["psu"], 10)
    t.equal("reserve 1.0: 5.74 -> PSU 10, ch1 2.3 -> 3", (budget(D, reserve=1.0)["psu"],
                                                         budget(D, reserve=1.0)["channels"][0]["rating"]), (10, 3))
    for bad, w in ((["x", 1, 1, 1.5, "ch1"], "simultaneity > 1"), (["x", "a", 1, 1, "ch1"], "text current"),
                   (["x", 1, 1, 1, ""], "empty channel")):
        try:
            budget(D, [bad])
            t.true(f"bad load rejected ({w})", False)
        except InputError:
            t.true(f"bad load rejected ({w})", True)
    t.true("markdown has PSU line and note", "PSU 10 A" in markdown(B) and "EXAMPLES" in markdown(B))
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", default=str(ITEM7_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--example", action="store_true", help="run the JSON example (also the default)")
    ap.add_argument("--loads", help="own 24 V load CSV name;I_A;qty;sim;channel")
    ap.add_argument("--reserve", type=float, help="reserve factor (default from JSON, 1.25)")
    ap.add_argument("--md", help="write the budget as Markdown")
    ap.add_argument("--csv", help="write the per-channel table as CSV")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    _, D = load_examples(a.examples, "dc24")
    B = budget(D, read_csv(a.loads) if a.loads else None, a.reserve)
    if a.json:
        print(json.dumps({**B, "note": NOTE}, indent=1, ensure_ascii=False))
        return 0
    show(B)
    if a.md:
        p = Path(a.md)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(markdown(B), encoding="utf-8")
        print(f"\nMarkdown written: {p}")
    if a.csv:
        print(f"CSV written: {write_csv(a.csv, CH, chan_table(B))}")
    return 0


if __name__ == "__main__":
    run_main(main)
