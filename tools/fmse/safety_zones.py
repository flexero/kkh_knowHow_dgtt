#!/usr/bin/env python3
"""Safety zones as a cause & effect matrix: which rows fire, which stop action each output gets, how many outputs
keep running (production continuity), for the JSON scenarios or your own active inputs (item 7).

Python 3 standard library only, offline. Rule = "_formulas.safety_zones" in examples/item7_examples.json (section
"safety.zones"). Guide: docs/FMS system design/67_electrical_safety.md.

  row condition  = all 'all_of' inputs active AND no 'none_of' input active
  action ranks   RUN 0 < SLS 1 < SS1 2 < STO 3 ('-' = no action)
  output result  = highest-ranked action of all rows whose condition is true, RUN if none
  latched rows   stay active after their input clears until a RESET (see --sequence)
  KPI            number of outputs still RUN

Usage:
  python tools/fmse/safety_zones.py                                  (matrix + all scenarios = --example)
  python tools/fmse/safety_zones.py --active LS01_LC,AGV_DOCK_FIELD    (own active inputs)
  python tools/fmse/safety_zones.py --sequence "ESTOP_CELL | | RESET | POOL_DOOR_OPEN"
  python tools/fmse/safety_zones.py --md zones.md --csv scenarios.csv --json
  python tools/fmse/safety_zones.py --selftest

All values are EXAMPLES. The real cause & effect matrix comes from the risk assessment (ISO 12100) and must be
validated (ISO 13849-2) and signed off by a qualified safety engineer with the current standard editions.
"""

import argparse
import json
from pathlib import Path

from fmse_common import InputError, SelfTest, fmt_table, load_examples, run_main, write_csv

HERE = Path(__file__).resolve().parent
ITEM7_EXAMPLES = HERE / "examples" / "item7_examples.json"
NOTE = ("NOTE: all values are EXAMPLES for teaching. The real cause & effect matrix comes from the risk assessment "
        "(ISO 12100) and must be validated (ISO 13849-2) and signed off by a qualified safety engineer with the "
        "current standard editions.")
RANK = {"-": -1, "RUN": 0, "SLS": 1, "SS1": 2, "STO": 3}


def check_zones(Z):
    for k in ("inputs", "outputs", "rows"):
        if k not in Z:
            raise InputError(f"zones: value '{k}' is missing")
    ins, outs = set(Z["inputs"]), set(Z["outputs"])
    for r in Z["rows"]:
        for i in r.get("all_of", []) + r.get("none_of", []):
            if i not in ins:
                raise InputError(f"zones row {r.get('id')}: input '{i}' unknown")
        for o, act in r.get("act", {}).items():
            if o not in outs:
                raise InputError(f"zones row {r.get('id')}: output '{o}' unknown")
            if act not in RANK:
                raise InputError(f"zones row {r.get('id')}: action '{act}' unknown (RUN, SLS, SS1, STO, -)")


def check_active(Z, active):
    bad = [i for i in active if i not in Z["inputs"]]
    if bad:
        raise InputError(f"unknown input(s) {bad}; inputs are {', '.join(Z['inputs'])}")
    return set(active)


def condition(row, active):
    return all(i in active for i in row.get("all_of", [])) and not any(i in active for i in row.get("none_of", []))


def resolve(Z, fired_ids):
    rows = [r for r in Z["rows"] if r["id"] in fired_ids]
    res = {}
    for o in Z["outputs"]:
        best = "RUN"
        for r in rows:
            a = r.get("act", {}).get(o, "-")
            if RANK[a] > RANK[best]:
                best = a
        res[o] = best
    return res


def evaluate(Z, active):
    act = check_active(Z, active)
    fired = [r["id"] for r in Z["rows"] if condition(r, act)]
    res = resolve(Z, fired)
    return {"active": sorted(act, key=Z["inputs"].index), "fired": fired, "outputs": res,
            "n_run": sum(1 for v in res.values() if v == "RUN")}


def sequence(Z, steps):
    """steps: list of lists of active inputs; the token RESET clears latched rows whose condition is false."""
    latched, out = set(), []
    for k, st in enumerate(steps, 1):
        reset = "RESET" in st
        act = check_active(Z, [i for i in st if i != "RESET"])
        live = {r["id"] for r in Z["rows"] if condition(r, act)}
        if reset:
            latched = {i for i in latched if i in live}
        latched |= {r["id"] for r in Z["rows"] if r.get("latched") and r["id"] in live}
        fired = [r["id"] for r in Z["rows"] if r["id"] in live or r["id"] in latched]
        res = resolve(Z, fired)
        out.append({"step": k, "active": sorted(act), "reset": reset, "fired": fired,
                    "held_by_latch": sorted(set(fired) - live), "outputs": res,
                    "n_run": sum(1 for v in res.values() if v == "RUN")})
    return out


# ----------------------------------------------------------------------------- output
def matrix_rows(Z):
    out = []
    for r in Z["rows"]:
        cond = " & ".join(r.get("all_of", [])) + "".join(f" & not {i}" for i in r.get("none_of", []))
        out.append([r["id"], cond, "yes" if r.get("latched") else ""] +
                   [r.get("act", {}).get(o, "-") for o in Z["outputs"]])
    return out


def scen_rows(Z):
    out = []
    for name, act in Z.get("scenarios", []):
        e = evaluate(Z, act)
        out.append([name, "+".join(e["fired"]) or "-", e["n_run"]] + [e["outputs"][o] for o in Z["outputs"]])
    return out


def markdown(Z):
    H = ["row", "condition", "latched"] + Z["outputs"]
    L = ["# Safety zones: cause & effect matrix", "", "| " + " | ".join(H) + " |", "|" + "---|" * len(H)]
    L += ["| " + " | ".join(str(c) for c in r) + " |" for r in matrix_rows(Z)]
    H2 = ["scenario", "rows fired", "still RUN"] + Z["outputs"]
    L += ["", "## Scenarios", "", "| " + " | ".join(H2) + " |", "|" + "---|" * len(H2)]
    L += ["| " + " | ".join(str(c) for c in r) + " |" for r in scen_rows(Z)]
    return "\n".join(L + ["", "_" + NOTE + "_"]) + "\n"


def show_one(Z, e, title):
    print(title)
    print(f"  active inputs: {', '.join(e['active']) or '-'}   rows fired: {', '.join(e['fired']) or '-'}")
    print(fmt_table(["output", "result"], [[o, e["outputs"][o]] for o in Z["outputs"]], "ll"))
    print(f"  outputs still RUN: {e['n_run']} of {len(Z['outputs'])}")


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("safety_zones")
    _, S = load_examples(path, "safety")
    Z = S["zones"]
    check_zones(Z)
    t.equal("5 inputs, 12 outputs, 5 rows, 6 scenarios",
            (len(Z["inputs"]), len(Z["outputs"]), len(Z["rows"]), len(Z["scenarios"])), (5, 12, 5, 6))
    E = [evaluate(Z, act) for _, act in Z["scenarios"]]
    t.equal("outputs still RUN per scenario 12 10 6 6 5 1", [e["n_run"] for e in E], [12, 10, 6, 6, 5, 1])
    t.equal("rows fired: - / Z2 / Z3 / Z4 / Z4+Z5 / Z1+Z4", [e["fired"] for e in E],
            [[], ["Z2"], ["Z3"], ["Z4"], ["Z4", "Z5"], ["Z1", "Z4"]])
    t.equal("light curtain: LS01_ROT STO, POOL_FORK SS1", (E[1]["outputs"]["LS01_ROT"], E[1]["outputs"]["POOL_FORK"]),
            ("STO", "SS1"))
    t.equal("door open in auto: pool SS1, APCs STO", [E[2]["outputs"][o] for o in
                                                     ("POOL_TRAVEL", "POOL_HOIST", "POOL_FORK", "APC01", "APC02",
                                                      "APC03")], ["SS1"] * 3 + ["STO"] * 3)
    t.equal("maintenance with enabling: pool SLS (Z3 blocked by none_of ENABLE_OK)",
            [E[3]["outputs"][o] for o in ("POOL_TRAVEL", "POOL_HOIST", "POOL_FORK")], ["SLS"] * 3)
    t.equal("+ AGV dock field: AGV_TRANSFER STO", E[4]["outputs"]["AGV_TRANSFER"], "STO")
    e6 = E[5]["outputs"]
    t.equal("e-stop: LS01_CLAMP stays RUN (no action '-')", e6["LS01_CLAMP"], "RUN")
    t.equal("e-stop: MC01-03 STO", [e6[o] for o in ("MC01", "MC02", "MC03")], ["STO"] * 3)
    t.equal("e-stop + Z4: POOL_TRAVEL = max(SS1, SLS) = SS1", e6["POOL_TRAVEL"], "SS1")
    t.equal("e-stop + Z4: APC01 = max(SS1, STO) = STO", e6["APC01"], "STO")
    t.equal("e-stop: LS01_ROT SS1, AGV_TRANSFER STO", (e6["LS01_ROT"], e6["AGV_TRANSFER"]), ("SS1", "STO"))
    t.equal("ENABLE_OK alone fires nothing (12 RUN)", evaluate(Z, ["ENABLE_OK"])["n_run"], 12)
    t.equal("all inputs: rows Z1 Z2 Z4 Z5 (not Z3), 1 RUN",
            (evaluate(Z, Z["inputs"])["fired"], evaluate(Z, Z["inputs"])["n_run"]), (["Z1", "Z2", "Z4", "Z5"], 1))
    seq = sequence(Z, [["ESTOP_CELL"], [], ["RESET"], ["LS01_LC"]])
    t.equal("sequence: e-stop latched -> still Z1 after release, cleared by RESET",
            [s["fired"] for s in seq], [["Z1"], ["Z1"], [], ["Z2"]])
    t.equal("sequence: held_by_latch at step 2", seq[1]["held_by_latch"], ["Z1"])
    t.equal("RESET while e-stop still pressed does not clear", sequence(Z, [["ESTOP_CELL"], ["ESTOP_CELL", "RESET"]])
            [1]["fired"], ["Z1"])
    t.equal("non-latched Z2 clears without reset", [s["fired"] for s in sequence(Z, [["LS01_LC"], []])], [["Z2"], []])
    try:
        evaluate(Z, ["DOOR_X"])
        t.true("unknown input rejected", False)
    except InputError:
        t.true("unknown input rejected", True)
    try:
        check_zones({**Z, "rows": [{"id": "Zx", "all_of": ["ESTOP_CELL"], "act": {"MC01": "STOP"}}]})
        t.true("unknown action rejected", False)
    except InputError:
        t.true("unknown action rejected", True)
    md = markdown(Z)
    t.true("markdown has matrix + 6 scenario rows + note",
           md.count("\n| Z") == 5 and all(n in md for n, _ in Z["scenarios"]) and "EXAMPLES" in md)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", default=str(ITEM7_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--example", action="store_true", help="run the JSON example (also the default)")
    ap.add_argument("--active", help="own active inputs, comma list ('' = none)")
    ap.add_argument("--sequence", help="steps separated by '|', each a comma list of inputs; RESET clears latches")
    ap.add_argument("--md", help="write Markdown")
    ap.add_argument("--csv", help="write the scenario table as CSV")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    _, S = load_examples(a.examples, "safety")
    Z = S.get("zones")
    if not isinstance(Z, dict):
        raise InputError("safety: value 'zones' is missing")
    check_zones(Z)
    if a.active is not None:
        e = evaluate(Z, [x.strip() for x in a.active.split(",") if x.strip()])
        if a.json:
            print(json.dumps({**e, "note": NOTE}, indent=1, ensure_ascii=False))
        else:
            show_one(Z, e, "OWN INPUTS")
            print(NOTE)
        return 0
    if a.sequence is not None:
        steps = [[x.strip() for x in st.split(",") if x.strip()] for st in a.sequence.split("|")]
        seq = sequence(Z, steps)
        if a.json:
            print(json.dumps({"steps": seq, "note": NOTE}, indent=1, ensure_ascii=False))
            return 0
        print("SEQUENCE  (latched rows hold until RESET with the input cleared)")
        print(fmt_table(["step", "active", "reset", "rows", "held by latch", "still RUN"] + Z["outputs"],
                        [[s["step"], ",".join(s["active"]) or "-", "yes" if s["reset"] else "", "+".join(s["fired"])
                          or "-", ",".join(s["held_by_latch"]) or "-", s["n_run"]] +
                         [s["outputs"][o] for o in Z["outputs"]] for s in seq], "rlllll" + "l" * len(Z["outputs"])))
        print(NOTE)
        return 0
    if a.json:
        print(json.dumps({"scenarios": [{"name": n, **evaluate(Z, act)} for n, act in Z["scenarios"]], "note": NOTE},
                         indent=1, ensure_ascii=False))
        return 0
    print("CAUSE & EFFECT MATRIX  (RUN 0 < SLS 1 < SS1 2 < STO 3, '-' = no action)")
    print(fmt_table(["row", "condition", "latched"] + Z["outputs"], matrix_rows(Z), "lll" + "l" * len(Z["outputs"])))
    print()
    print("SCENARIOS  (output = highest action of all fired rows; KPI = outputs still RUN)")
    print(fmt_table(["scenario", "rows", "RUN"] + Z["outputs"], scen_rows(Z), "llr" + "l" * len(Z["outputs"])))
    print()
    print(NOTE)
    if a.md:
        p = Path(a.md)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(markdown(Z), encoding="utf-8")
        print(f"\nMarkdown written: {p}")
    if a.csv:
        print(f"CSV written: {write_csv(a.csv, ['scenario', 'rows fired', 'still RUN'] + Z['outputs'], scen_rows(Z))}")
    return 0


if __name__ == "__main__":
    run_main(main)
