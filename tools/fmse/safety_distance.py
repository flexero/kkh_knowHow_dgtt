#!/usr/bin/env python3
"""ISO 13855 minimum safety distances (light curtain, multi-beam, laser scanner, two-hand control) and the ISO 14119
guard-locking decision (item 7).

Python 3 standard library only, offline. Formulas = "_formulas" safety_distance / guard_locking in
examples/item7_examples.json (section "safety"). Guide: docs/FMS system design/67_electrical_safety.md.

  T          = sum of the times [s] (sensor + logic + machine stopping time)
  aopd       light curtain, perpendicular approach, d <= 40 mm: S = 2000*T + 8*(d - 14) ; S < 100 -> 100 ;
             S > 500 -> S = 1600*T + 8*(d - 14), and if that is < 500 -> 500
  multibeam  (or d > 40, body detection): S = 1600*T + 850
  scanner    parallel approach: C = max(850, 1200 - 0.4*H) ; S = 1600*T + C + Z
  twohand    S = 1600*T + 250 (C = 0 if the hands are covered)
  guard lock t_access = distance_mm/1600 ; guard locking required if t_stop > t_access

Usage:
  python tools/fmse/safety_distance.py                                 (all JSON cases = --example)
  python tools/fmse/safety_distance.py aopd --d 30 --times 0.015,0.02,0.2
  python tools/fmse/safety_distance.py multibeam --T 0.25
  python tools/fmse/safety_distance.py scanner --H 200 --Z 120 --T 0.45
  python tools/fmse/safety_distance.py twohand --T 0.1 --covered
  python tools/fmse/safety_distance.py guard --tstop 2.5 --dist 1200
  python tools/fmse/safety_distance.py --md distances.md --csv distances.csv --json
  python tools/fmse/safety_distance.py --selftest

All values are EXAMPLES. Real distances need the measured stopping time (stop-time measurement), the current ISO 13855
/ ISO 14119 editions and sign-off by a qualified safety engineer.
"""

import argparse
import json
from pathlib import Path

from fmse_common import InputError, SelfTest, fmt_table, load_examples, parse_float_list, run_main, write_csv

HERE = Path(__file__).resolve().parent
ITEM7_EXAMPLES = HERE / "examples" / "item7_examples.json"
NOTE = ("NOTE: all values are EXAMPLES for teaching. Real safety distances need measured stopping times, the current "
        "ISO 13855 / ISO 14119 editions and sign-off by a qualified safety engineer.")
K_WALK = 1600.0


def distance(kind, T, d=None, H=None, Z=0.0, covered=False):
    """Return (S mm, formula text)."""
    if T is None or T < 0:
        raise InputError(f"total time T must be >= 0 s, got {T!r}")
    if kind == "aopd":
        if d is None or d <= 0:
            raise InputError("aopd needs the resolution d > 0 mm")
        if d > 40:
            raise InputError(f"aopd formula is for d <= 40 mm (got {d:g}) - use multibeam (body detection)")
        S = 2000 * T + 8 * (d - 14)
        txt = f"2000*{T:g} + 8*({d:g} - 14) = {S:g}"
        if S < 100:
            return 100.0, txt + " < 100 -> 100"
        if S > 500:
            S2 = K_WALK * T + 8 * (d - 14)
            txt += f" > 500 -> 1600*{T:g} + 8*({d:g} - 14) = {S2:g}"
            if S2 < 500:
                return 500.0, txt + " < 500 -> 500"
            return S2, txt
        return S, txt
    if kind == "multibeam":
        S = K_WALK * T + 850
        return S, f"1600*{T:g} + 850 = {S:g}"
    if kind == "scanner":
        if H is None or H < 0:
            raise InputError("scanner needs the protective field height H >= 0 mm")
        C = max(850.0, 1200 - 0.4 * H)
        S = K_WALK * T + C + Z
        return S, f"C = max(850, 1200 - 0.4*{H:g}) = {C:g} ; 1600*{T:g} + {C:g} + {Z:g} = {S:g}"
    if kind == "twohand":
        C = 0.0 if covered else 250.0
        S = K_WALK * T + C
        return S, f"1600*{T:g} + {C:g} = {S:g}" + (" (hands covered, C = 0)" if covered else "")
    raise InputError(f"distance type '{kind}' unknown - use aopd, multibeam, scanner or twohand")


def case(c):
    times = c.get("times") or []
    T = sum(float(x[1]) for x in times)
    S, txt = distance(c["type"], T, c.get("d"), c.get("H"), float(c.get("Z", 0)), bool(c.get("covered", False)))
    return {"name": c.get("name", ""), "type": c["type"], "T": T, "S": S, "formula": txt}


def guard(t_stop, dist):
    if t_stop < 0 or dist <= 0:
        raise InputError("guard locking: stopping time >= 0 s and distance > 0 mm needed")
    ta = dist / K_WALK
    return {"t_stop": t_stop, "dist": dist, "t_access": ta, "required": t_stop > ta}


HEAD = ["case", "type", "T s", "S mm", "calculation"]
GHEAD = ["hazard", "t_stop s", "distance mm", "t_access s", "guard locking"]


def case_rows(R):
    return [[r["name"], r["type"], f"{r['T']:.3f}", f"{r['S']:.0f}", r["formula"]] for r in R]


def guard_rows(S):
    out = []
    for name, ts, dist in S["guard_locking"]:
        g = guard(float(ts), float(dist))
        out.append([name, f"{ts:g}", f"{dist:g}", f"{g['t_access']:.2f}",
                    "REQUIRED" if g["required"] else "not required (interlock enough)"])
    return out


def markdown(R, G):
    L = ["# Safety distances (ISO 13855) and guard locking (ISO 14119)", "", "| " + " | ".join(HEAD) + " |",
         "|" + "---|" * len(HEAD)]
    L += ["| " + " | ".join(r) + " |" for r in case_rows(R)]
    L += ["", "| " + " | ".join(GHEAD) + " |", "|" + "---|" * len(GHEAD)]
    L += ["| " + " | ".join(r) + " |" for r in G]
    return "\n".join(L + ["", "_" + NOTE + "_"]) + "\n"


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("safety_distance")
    _, S = load_examples(path, "safety")
    R = {r["name"][:3]: r for r in (case(c) for c in S["distance_cases"])}
    t.equal("6 distance cases", len(R), 6)
    t.close("LC1 T 0.185 s", R["LC1"]["T"], 0.185, 1e-12)
    t.close("LC1 S = 2000*0.185 = 370 mm", R["LC1"]["S"], 370, 1e-9)
    t.close("LC2 S = 370 + 8*16 = 498 mm", R["LC2"]["S"], 498, 1e-9)
    t.close("LC3 T 0.3 s", R["LC3"]["T"], 0.3, 1e-12)
    t.close("LC3 728 > 500 -> 1600*0.3 + 128 = 608 mm", R["LC3"]["S"], 608, 1e-9)
    t.close("MB1 S = 1600*0.185 + 850 = 1146 mm", R["MB1"]["S"], 1146, 1e-9)
    t.close("SC1 T 0.5 s", R["SC1"]["T"], 0.5, 1e-12)
    t.close("SC1 C = 1080, S = 800 + 1080 + 100 = 1980 mm", R["SC1"]["S"], 1980, 1e-9)
    t.close("TH1 T 0.12 s", R["TH1"]["T"], 0.12, 1e-12)
    t.close("TH1 S = 192 + 250 = 442 mm", R["TH1"]["S"], 442, 1e-9)
    t.close("aopd minimum 100 mm (T 0.02, d 14)", distance("aopd", 0.02, 14)[0], 100, 1e-9)
    t.close("aopd 2nd formula < 500 -> 500 (T 0.26, d 14: 520 > 500, 416 < 500)", distance("aopd", 0.26, 14)[0],
            500, 1e-9)
    t.close("aopd exactly 500 stays 500 (T 0.25, d 14)", distance("aopd", 0.25, 14)[0], 500, 1e-9)
    try:
        distance("aopd", 0.2, 50)
        t.true("aopd d 50 > 40 rejected (use multibeam)", False)
    except InputError:
        t.true("aopd d 50 > 40 rejected (use multibeam)", True)
    t.close("scanner H 1000: C = max(850, 800) = 850", distance("scanner", 0.5, H=1000, Z=100)[0], 1750, 1e-9)
    t.close("scanner H 0: C 1200", distance("scanner", 0.5, H=0, Z=0)[0], 2000, 1e-9)
    t.close("twohand covered: C = 0 -> 192 mm", distance("twohand", 0.12, covered=True)[0], 192, 1e-9)
    G = {r[0].split()[0]: r for r in guard_rows(S)}
    t.close("t_access = 800/1600 = 0.5 s", guard(8, 800)["t_access"], 0.5, 1e-12)
    t.equal("guard locking: spindle yes, stacker yes, washer no",
            [G[k][4].startswith("REQUIRED") for k in ("HMC", "Stacker", "Washer")], [True, True, False])
    t.true("t_stop = t_access exactly -> not required (needs >)", not guard(0.5, 800)["required"])
    try:
        distance("laser", 0.1)
        t.true("unknown type rejected", False)
    except InputError:
        t.true("unknown type rejected", True)
    md = markdown(list(R.values()), guard_rows(S))
    t.true("markdown has 6 + 3 rows (+ 2 headers) and the note", md.count("\n| ") == 6 + 3 + 2 and "EXAMPLES" in md)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def _T(a):
    if a.times:
        return sum(parse_float_list(a.times, "--times"))
    if a.T is None:
        raise InputError("give --T (total time s) or --times (comma list s)")
    return a.T


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", default=str(ITEM7_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--example", action="store_true", help="run the JSON example (also the default)")
    ap.add_argument("--md", help="write Markdown")
    ap.add_argument("--csv", help="write the distance table as CSV")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    sub = ap.add_subparsers(dest="cmd")
    for kind, h in (("aopd", "light curtain d <= 40 mm"), ("multibeam", "multi-beam / body detection"),
                    ("scanner", "laser scanner, parallel approach"), ("twohand", "two-hand control")):
        s = sub.add_parser(kind, help=h)
        s.add_argument("--T", type=float, help="total time s")
        s.add_argument("--times", help="comma list of times s (summed)")
        if kind == "aopd":
            s.add_argument("--d", type=float, required=True, help="resolution mm")
        if kind == "scanner":
            s.add_argument("--H", type=float, required=True, help="protective field height mm")
            s.add_argument("--Z", type=float, default=0.0, help="scanner + measuring tolerances mm")
        if kind == "twohand":
            s.add_argument("--covered", action="store_true", help="hands covered (C = 0)")
    s = sub.add_parser("guard", help="guard locking decision")
    s.add_argument("--tstop", type=float, required=True, help="stopping / run-down time s")
    s.add_argument("--dist", type=float, required=True, help="distance door -> hazard mm")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    if a.cmd == "guard":
        g = guard(a.tstop, a.dist)
        print(json.dumps(g) if a.json else
              f"t_access = {a.dist:g}/1600 = {g['t_access']:.3f} s ; t_stop {a.tstop:g} s -> guard locking "
              f"{'REQUIRED' if g['required'] else 'not required'}\n{NOTE}")
        return 0
    if a.cmd:
        T = _T(a)
        S, txt = distance(a.cmd, T, getattr(a, "d", None), getattr(a, "H", None), getattr(a, "Z", 0.0),
                          getattr(a, "covered", False))
        print(json.dumps({"type": a.cmd, "T": T, "S": S, "formula": txt}) if a.json else
              f"{a.cmd}: T = {T:g} s ; S = {txt} -> S = {S:.0f} mm\n{NOTE}")
        return 0
    _, SA = load_examples(a.examples, "safety")
    R = [case(c) for c in SA["distance_cases"]]
    G = guard_rows(SA)
    if a.json:
        print(json.dumps({"distances": R, "guard_locking": [dict(zip(GHEAD, r)) for r in G], "note": NOTE},
                         indent=1, ensure_ascii=False))
        return 0
    print("SAFETY DISTANCES  (ISO 13855, T = sum of times)")
    print(fmt_table(HEAD, case_rows(R), "llrrl"))
    print()
    print("GUARD LOCKING  (ISO 14119: required if t_stop > t_access = distance/1600)")
    print(fmt_table(GHEAD, G, "lrrrl"))
    print()
    print(NOTE)
    if a.md:
        p = Path(a.md)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(markdown(R, G), encoding="utf-8")
        print(f"\nMarkdown written: {p}")
    if a.csv:
        print(f"CSV written: {write_csv(a.csv, HEAD, case_rows(R))}")
    return 0


if __name__ == "__main__":
    run_main(main)
