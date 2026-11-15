#!/usr/bin/env python3
"""OEE / TEEP with the loss waterfall (six big losses) and the stop-log analysis (MTBF, MTTR, Pareto).

Python 3 standard library only, offline. Formulas = "_formulas" in examples/item4_examples.json
(the same as the web page, tab FMS engineering -> item 4, card 4A).

OEE (section "oee", all times in minutes for one machine and one period):
    run   = plan - down - setup                 (run time)
    A     = run / plan                          (availability)
    P     = ideal * total / run                 (performance = net run / run)
    Q     = good / total                        (quality, first pass)
    OEE   = A * P * Q   (= fully productive time / plan = ideal*good/plan)
    TEEP  = OEE * plan / cal                    (share of the whole calendar time that is fully productive)
    speed loss        = run - ideal*total - minor   (>= 0)
    quality loss time = ideal * (total - good)

Stop log (section "stop_log", --log): events [type, minutes, reason], type = failure | minor | setup
    failures   = number of events of type 'failure'
    MTTR       = mean duration of the failures                         [min]
    MTBF       = (production_time_h*60 - sum failure minutes) / failures [min]  (operating time between failures)
    A_inherent = MTBF / (MTBF + MTTR)
    Pareto     = all stop minutes (every type) grouped by reason text, descending, with cumulative %
                 (equal minutes keep the order of the first appearance in the log)
"""

import argparse

from fmse_common import (ITEM4_EXAMPLES, InputError, SelfTest, fmt_num, fmt_table, load_examples, run_main,
                         text_bar, write_csv)

OEE_KEYS = ("cal", "plan", "down", "setup", "minor", "ideal", "total", "good")
EVENT_TYPES = ("failure", "minor", "setup")


# ----------------------------------------------------------------------------- formulas
def oee_calc(v):
    """OEE, TEEP and the waterfall steps. v = dict with the keys of section 'oee'."""
    for k in OEE_KEYS:
        if k not in v:
            raise InputError(f"oee: value '{k}' is missing")
        if not isinstance(v[k], (int, float)) or v[k] < 0:
            raise InputError(f"oee: '{k}' must be a number >= 0")
    if v["plan"] <= 0 or v["cal"] <= 0 or v["total"] <= 0 or v["ideal"] <= 0:
        raise InputError("oee: plan, cal, total and ideal must be > 0")
    if v["plan"] > v["cal"]:
        raise InputError("oee: planned time is longer than the calendar time")
    if v["good"] > v["total"]:
        raise InputError("oee: more good parts than parts made")
    run = v["plan"] - v["down"] - v["setup"]
    if run <= 0:
        raise InputError("oee: no run time left (breakdowns + set-ups >= planned time)")
    net = v["ideal"] * v["total"]
    full = v["ideal"] * v["good"]
    speed = max(0.0, run - net - v["minor"])
    qual = net - full
    A, P, Q = run / v["plan"], net / run, v["good"] / v["total"]
    oee = A * P * Q
    steps = [("Planned", v["plan"], "base"), ("Breakdowns", -v["down"], "loss"), ("Set-ups", -v["setup"], "loss"),
             ("Run time", run, "sub"), ("Minor stops", -v["minor"], "loss"), ("Speed loss", -speed, "loss"),
             ("Net run", net, "sub"), ("Scrap / rework", -qual, "loss"), ("Fully productive", full, "res")]
    return {"run": run, "net": net, "full": full, "speed": speed, "qual": qual, "A": A, "P": P, "Q": Q,
            "OEE": oee, "TEEP": oee * v["plan"] / v["cal"], "steps": steps,
            "minor_too_big": v["minor"] > run - net}


def stop_log_calc(log):
    """failures, MTTR, MTBF, A_inherent and the Pareto list of all stop minutes by reason."""
    if "production_time_h" not in log or "events" not in log:
        raise InputError("stop_log: 'production_time_h' and 'events' are needed")
    prod = log["production_time_h"] * 60.0
    if prod <= 0:
        raise InputError("stop_log: production_time_h must be > 0")
    fail, by_reason, by_type = [], {}, {t: 0.0 for t in EVENT_TYPES}
    for i, ev in enumerate(log["events"], 1):
        if not isinstance(ev, list) or len(ev) < 3:
            raise InputError(f"stop_log event {i}: need [type, minutes, reason]")
        typ, mins, reason = ev[0], ev[1], str(ev[2])
        if typ not in EVENT_TYPES:
            raise InputError(f"stop_log event {i}: type '{typ}' unknown (use {', '.join(EVENT_TYPES)})")
        if not isinstance(mins, (int, float)) or mins < 0:
            raise InputError(f"stop_log event {i}: minutes must be a number >= 0")
        if typ == "failure":
            fail.append(mins)
        by_type[typ] += mins
        if reason not in by_reason:
            by_reason[reason] = {"reason": reason, "type": typ, "min": 0.0, "count": 0, "first": i}
        by_reason[reason]["min"] += mins
        by_reason[reason]["count"] += 1
    if not fail:
        raise InputError("stop_log: no event of type 'failure' - MTBF / MTTR cannot be computed")
    n = len(fail)
    sf = sum(fail)
    if sf >= prod:
        raise InputError("stop_log: failure minutes >= production time")
    mttr = sf / n
    mtbf = (prod - sf) / n
    pareto = sorted(by_reason.values(), key=lambda r: (-r["min"], r["first"]))
    total = sum(r["min"] for r in pareto)
    cum = 0.0
    for r in pareto:
        cum += r["min"]
        r["share"] = r["min"] / total if total else 0.0
        r["cum"] = cum / total if total else 0.0
    return {"failures": n, "fail_min": sf, "prod_min": prod, "MTTR": mttr, "MTBF": mtbf,
            "A_inh": mtbf / (mtbf + mttr), "pareto": pareto, "total": total, "by_type": by_type}


# ----------------------------------------------------------------------------- report
def show_oee(v, csv_path=None):
    r = oee_calc(v)
    print("OEE - WHERE DOES THE MACHINE TIME GO? (six big losses, minutes)")
    print(f"  run  = plan - down - setup = {v['plan']:g} - {v['down']:g} - {v['setup']:g} = {r['run']:g} min")
    print(f"  A    = run / plan          = {r['run']:g} / {v['plan']:g}            = {r['A']*100:.1f} %")
    print(f"  P    = ideal*total / run   = {v['ideal']:g}*{v['total']:g} / {r['run']:g}       = {r['P']*100:.1f} %")
    print(f"  Q    = good / total        = {v['good']:g} / {v['total']:g}            = {r['Q']*100:.1f} %")
    print(f"  OEE  = A*P*Q               = {r['A']:.4f}*{r['P']:.4f}*{r['Q']:.4f} = {r['OEE']*100:.1f} %"
          f"  (= fully productive / plan = {r['full']:g} / {v['plan']:g})")
    print(f"  TEEP = OEE*plan / cal      = {r['OEE']:.4f}*{v['plan']:g} / {v['cal']:g}    = {r['TEEP']*100:.1f} %")
    print(f"  speed loss = run - ideal*total - minor = {r['run']:g} - {r['net']:g} - {v['minor']:g} = {r['speed']:g} min")
    print(f"  quality loss time = ideal*(total - good) = {v['ideal']:g}*({v['total']:g} - {v['good']:g}) = {r['qual']:g} min")
    print()
    print("Loss waterfall (# = share of the planned time; losses marked '-'):")
    rows = []
    for name, x, kind in r["steps"]:
        bar = text_bar(abs(x), v["plan"], 40, "-" if kind == "loss" else "#")
        print(f"  {name.ljust(17)} {fmt_num(abs(x), 0).rjust(6)} min  {abs(x)/v['plan']*100:5.1f} %  {bar}")
        rows.append([name, kind, round(x, 4), round(abs(x) / v["plan"], 6)])
    losses = [(n, -x) for n, x, k in r["steps"] if k == "loss"]
    big = max(losses, key=lambda z: z[1])
    print()
    print(f"Biggest loss: {big[0]} ({fmt_num(big[1], 0)} min). Work on it first: breakdowns -> maintenance (TPM),")
    print("set-ups -> SMED / pallets, minor stops + speed -> process, scrap -> quality.")
    print("World class OEE ~ 85 % (A 90 x P 95 x Q 99.9 %); a new FMS reaches 60-75 % in year 1.")
    if r["minor_too_big"]:
        print("WARNING: minor stops are larger than the whole performance loss - check the numbers.")
    if csv_path:
        p = write_csv(csv_path, ["step", "kind", "minutes", "share_of_plan"], rows)
        print(f"\nCSV written: {p}")
    return r


def show_log(log, csv_path=None):
    r = stop_log_calc(log)
    print("STOP LOG - FAILURES, MTBF, MTTR, PARETO")
    print(f"  events: {len(log['events'])}   production time {log['production_time_h']:g} h = {r['prod_min']:g} min")
    print("  stop minutes by type: " + ", ".join(f"{t} {r['by_type'][t]:g}" for t in EVENT_TYPES)
          + f"  (total {r['total']:g} min)")
    print(f"  failures   = {r['failures']}  (sum {r['fail_min']:g} min)")
    print(f"  MTTR       = {r['fail_min']:g} / {r['failures']} = {r['MTTR']:.2f} min")
    print(f"  MTBF       = ({r['prod_min']:g} - {r['fail_min']:g}) / {r['failures']} = {r['MTBF']:.2f} min"
          f" = {r['MTBF']/60:.2f} h")
    print(f"  A_inherent = MTBF / (MTBF + MTTR) = {r['MTBF']:.2f} / {r['MTBF'] + r['MTTR']:.2f} = {r['A_inh']*100:.2f} %")
    print()
    print("Pareto of all stop minutes by reason (# = share of the largest reason):")
    top = r["pareto"][0]["min"] if r["pareto"] else 1
    rows = []
    for k, p in enumerate(r["pareto"], 1):
        rows.append([k, p["reason"], p["type"], p["count"], fmt_num(p["min"], 0), f"{p['share']*100:.1f}",
                     f"{p['cum']*100:.1f}", text_bar(p["min"], top, 24)])
    print(fmt_table(["#", "reason", "type", "n", "min", "%", "cum %", ""], rows, "rlllrrrl"))
    n80 = next((k for k, p in enumerate(r["pareto"], 1) if p["cum"] >= 0.8), len(r["pareto"]))
    print(f"\n{n80} of {len(r['pareto'])} reasons cause 80 % of the stop minutes - attack these first.")
    if csv_path:
        p = write_csv(csv_path, ["rank", "reason", "type", "count", "minutes", "share", "cumulative"],
                      [[k, x["reason"], x["type"], x["count"], x["min"], round(x["share"], 6), round(x["cum"], 6)]
                       for k, x in enumerate(r["pareto"], 1)])
        print(f"CSV written: {p}")
    return r


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("oee_losses")
    data, v = load_examples(path, "oee")
    r = oee_calc(v)
    t.close("run = 4500 - 270 - 360", r["run"], 3870, 1e-12)
    t.close("A = 3870/4500", r["A"], 0.86, 1e-12)
    t.close("P = 2*1650/3870", r["P"], 3300 / 3870, 1e-12)
    t.close("Q = 1610/1650", r["Q"], 1610 / 1650, 1e-12)
    t.close("OEE = 3220/4500 = 71.56 %", r["OEE"], 3220 / 4500, 1e-12)
    t.close("TEEP = 3220/10080 = 31.94 %", r["TEEP"], 3220 / 10080, 1e-12)
    t.close("speed loss = 3870 - 3300 - 150", r["speed"], 420, 1e-9)
    t.close("quality loss time = 2*40", r["qual"], 80, 1e-9)
    t.close("waterfall closes: plan - all losses = fully productive",
            v["plan"] - v["down"] - v["setup"] - v["minor"] - r["speed"] - r["qual"], r["full"], 1e-9)
    s = stop_log_calc(data["stop_log"])
    t.equal("failures", s["failures"], 7)
    t.close("failure minutes 45+120+25+60+18+90+15", s["fail_min"], 373, 1e-12)
    t.close("MTTR = 373/7", s["MTTR"], 373 / 7, 1e-12)
    t.close("MTBF = (9600-373)/7 = 1318.14 min", s["MTBF"], 9227 / 7, 1e-9)
    t.close("A_inherent = 9227/9600", s["A_inh"], 9227 / 9600, 1e-12)
    t.close("all stop minutes = 373 failure + 18 minor + 105 set-up", s["total"], 496, 1e-12)
    t.equal("Pareto rank 1", s["pareto"][0]["reason"], "Pallet clamp hydraulic leak")
    t.equal("Pareto order of minutes", [p["min"] for p in s["pareto"]], [120, 90, 60, 45, 40, 40, 35, 30, 18, 11, 7])
    t.equal("tie 40 / 40: first appearance first", s["pareto"][4]["reason"], "Coolant level low")
    t.close("cumulative of the top 3 = 270/496", s["pareto"][2]["cum"], 270 / 496, 1e-12)
    t.close("last cumulative = 100 %", s["pareto"][-1]["cum"], 1.0, 1e-12)
    try:
        oee_calc(dict(v, down=4200))
        t.true("no run time -> InputError", False)
    except InputError:
        t.true("no run time -> InputError", True)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n  python tools/fmse/oee_losses.py                 (OEE, TEEP, waterfall)\n"
               "  python tools/fmse/oee_losses.py --log           (also MTBF, MTTR, Pareto of the stop log)\n"
               "  python tools/fmse/oee_losses.py --log --csv pareto.csv\n"
               "  python tools/fmse/oee_losses.py --plan 4800 --down 200   (override single values)")
    ap.add_argument("--examples", default=str(ITEM4_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--log", action="store_true", help="also analyse the stop log (MTBF, MTTR, Pareto)")
    ap.add_argument("--only-log", action="store_true", help="only the stop log")
    for k in OEE_KEYS:
        ap.add_argument("--" + k, type=float, help=f"override oee value '{k}'")
    ap.add_argument("--csv", help="write the waterfall (or with --only-log the Pareto) to this CSV file")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    data, v = load_examples(a.examples, "oee")
    v = dict(v)
    for k in OEE_KEYS:
        if getattr(a, k) is not None:
            v[k] = getattr(a, k)
    if not a.only_log:
        show_oee(v, a.csv)
    if a.log or a.only_log:
        if "stop_log" not in data:
            raise InputError("section 'stop_log' is missing in the JSON")
        if not a.only_log:
            print()
        show_log(data["stop_log"], a.csv if a.only_log else None)
    return 0


if __name__ == "__main__":
    run_main(main)
