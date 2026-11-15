#!/usr/bin/env python3
"""ISO 13849-1 performance level of safety functions: risk graph PLr, n_op / MTTFd / T10d per component, channel
MTTFd with symmetrisation, DCavg, PL per subsystem, Table 11 combination, verdict, and CCF scoring (item 7).

Python 3 standard library only, offline. Formulas = "_formulas" risk_graph / mttfd / dcavg / pl_from_cat / ccf /
pl_combine in examples/item7_examples.json (section "safety"). Guide: docs/FMS system design/67_electrical_safety.md.

  PLr       S1F1P1 a, S1F1P2 b, S1F2P1 b, S1F2P2 c, S2F1P1 c, S2F1P2 d, S2F2P1 d, S2F2P2 e
  component n_op = d_op*h_op*3600/t_cycle [1/year] ; MTTFd = B10d/(0.1*n_op) ; T10d = B10d/n_op [years]
  channel   MTTFd = 1/sum(1/MTTFd_i) ; two channels: 2/3*(C1 + C2 - 1/(1/C1 + 1/C2)) ; cap 100 years ;
            band low 3..<10, medium 10..<30, high 30..100 (below 3 not allowed)
  DCavg     sum(DC_i/MTTFd_i)/sum(1/MTTFd_i) (uncapped) ; none < 60, low 60..<90, medium 90..<99, high >= 99
  PL        pl_table[column][MTTFd band] ; column: Cat B / 1 -> '<cat>|none' ; Cat 2 / 3: DC low -> 'low',
            medium or high -> 'medium', none -> not allowed ; Cat 4: only DC high ; Cat 2-4 need CCF >= 65
  combine   PL_low = lowest subsystem PL, N_low = how many have it ; a: N<=3 a ; b: N<=2 b else a ;
            c: N<=2 c else b ; d: N<=3 d else c ; e: N<=3 e else d ; OK if PL >= PLr
  CCF       score = sum of the points of the applied measures ; >= 65 needed for Cat 2, 3, 4

Own subsystem: a channel is a ';' list of components 'name,B10d,d_op,h_op,t_cycle_s,DC%'.

Usage:
  python tools/fmse/safety_pl.py                          (all JSON functions + CCF cases = --example)
  python tools/fmse/safety_pl.py --function SF6           (one function with every component)
  python tools/fmse/safety_pl.py risk --S S2 --F F1 --P P2
  python tools/fmse/safety_pl.py eval --cat 3 --ch1 "Switch A,2000000,240,16,1800,99" \\
         --ch2 "Switch B,10000000,240,16,1800,90" --other e,d --risk S2F2P1
  python tools/fmse/safety_pl.py ccf --measures 1,3,5,6,7
  python tools/fmse/safety_pl.py --md safety.md --csv components.csv
  python tools/fmse/safety_pl.py --json
  python tools/fmse/safety_pl.py --selftest

All values and the PL table are EXAMPLES (simplified ISO 13849-1 Figure 5). Real safety functions must be verified by
a qualified safety engineer with the current ISO 13849-1/-2 edition, SISTEMA or equivalent and the makers' data.
"""

import argparse
import json
from pathlib import Path

from fmse_common import InputError, SelfTest, fmt_table, load_examples, run_main, write_csv

HERE = Path(__file__).resolve().parent
ITEM7_EXAMPLES = HERE / "examples" / "item7_examples.json"
NOTE = ("NOTE: all values and the PL table are EXAMPLES for teaching (simplified ISO 13849-1 method). Real safety "
        "functions need verification and sign-off by a qualified safety engineer with the current ISO 13849-1/-2 "
        "edition (or IEC 62061), validated tools and the makers' data.")
PLS = "abcde"
RISK = {"S1F1P1": "a", "S1F1P2": "b", "S1F2P1": "b", "S1F2P2": "c",
        "S2F1P1": "c", "S2F1P2": "d", "S2F2P1": "d", "S2F2P2": "e"}
NA = "n/a"


def risk_graph(S, F, P):
    key = f"{S}{F}{P}".upper()
    if key not in RISK:
        raise InputError(f"risk graph: S must be S1/S2, F F1/F2, P P1/P2 (got {S} {F} {P})")
    return RISK[key]


def component(c):
    if not isinstance(c, (list, tuple)) or len(c) != 6:
        raise InputError(f"component {c!r} must be [name, B10d, d_op, h_op, t_cycle_s, DC %]")
    try:
        name, b10d, dop, hop, tc, dc = str(c[0]), *(float(x) for x in c[1:])
    except (TypeError, ValueError):
        raise InputError(f"component {c!r}: B10d, d_op, h_op, t_cycle, DC must be numbers")
    if b10d <= 0 or dop <= 0 or hop <= 0 or tc <= 0 or not 0 <= dc <= 100 or dop > 366 or hop > 24:
        raise InputError(f"component '{name}': B10d, t_cycle > 0, 0 < d_op <= 366, 0 < h_op <= 24, 0 <= DC <= 100")
    nop = dop * hop * 3600 / tc
    return {"name": name, "B10d": b10d, "n_op": nop, "MTTFd": b10d / (0.1 * nop), "T10d": b10d / nop, "DC": dc}


def channel_mttfd(comps):
    return 1 / sum(1 / c["MTTFd"] for c in comps)


def symmetrise(c1, c2):
    return 2 / 3 * (c1 + c2 - 1 / (1 / c1 + 1 / c2))


def mttfd_band(x):
    if x < 3:
        return "below 3"
    return "low" if x < 10 else "medium" if x < 30 else "high"


def dc_band(x):
    return "none" if x < 60 else "low" if x < 90 else "medium" if x < 99 else "high"


def column(cat, dcb):
    if cat in ("B", "1"):
        return f"{cat}|none"
    if cat in ("2", "3"):
        return None if dcb == "none" else f"{cat}|{'low' if dcb == 'low' else 'medium'}"
    if cat == "4":
        return "4|high" if dcb == "high" else None
    raise InputError(f"category '{cat}' unknown - use B, 1, 2, 3 or 4")


def subsystem(sub, pl_table, ccf=65):
    """Evaluate one subsystem; certified devices ('pl') are taken as given."""
    if "pl" in sub:
        if sub["pl"] not in PLS:
            raise InputError(f"subsystem '{sub.get('name')}': pl must be a..e")
        return {"role": sub.get("role", ""), "name": sub.get("name", ""), "certified": True, "pl": sub["pl"],
                "why": "certified device (data sheet)"}
    cat = str(sub.get("cat", ""))
    chans = sub.get("channels") or []
    if not 1 <= len(chans) <= 2:
        raise InputError(f"subsystem '{sub.get('name')}': 1 or 2 channels needed")
    cc = [[component(c) for c in ch] for ch in chans]
    if any(not ch for ch in cc):
        raise InputError(f"subsystem '{sub.get('name')}': empty channel")
    cm = [channel_mttfd(ch) for ch in cc]
    m = symmetrise(cm[0], cm[1]) if len(cm) == 2 else cm[0]
    mc = min(m, 100.0)
    allc = [c for ch in cc for c in ch]
    dcavg = sum(c["DC"] / c["MTTFd"] for c in allc) / sum(1 / c["MTTFd"] for c in allc)
    mb, db = mttfd_band(mc), dc_band(dcavg)
    col = column(cat, db)
    why = ""
    if col is None:
        pl, why = NA, f"Cat {cat} not allowed with DCavg band '{db}'"
    elif mb == "below 3":
        pl, why = NA, "MTTFd below 3 years not allowed"
    elif cat in ("2", "3", "4") and ccf < 65:
        pl, why = NA, f"CCF score {ccf} < 65"
    else:
        if col not in pl_table:
            raise InputError(f"pl_table has no column '{col}'")
        pl = pl_table[col][mb]
        why = f"Cat {cat}, column {col}, MTTFd {mb}" + (" (combination not allowed)" if pl == NA else "")
    return {"role": sub.get("role", ""), "name": sub.get("name", ""), "certified": False, "cat": cat,
            "components": cc, "ch_mttfd": cm, "mttfd": m, "mttfd_capped": mc, "mttfd_band": mb, "dcavg": dcavg,
            "dc_band": db, "column": col, "pl": pl, "why": why}


def combine(pls):
    if any(p not in PLS for p in pls) or not pls:
        return NA, None, 0
    low = min(pls, key=PLS.index)
    n = sum(1 for p in pls if p == low)
    limit = {"a": 3, "b": 2, "c": 2, "d": 3, "e": 3}[low]
    if n <= limit:
        return low, low, n
    return (PLS[PLS.index(low) - 1] if low != "a" else NA), low, n


def pl_ok(pl, plr):
    return pl in PLS and PLS.index(pl) >= PLS.index(plr)


def function(fn, pl_table, ccf=65):
    plr = risk_graph(fn["S"], fn["F"], fn["P"])
    subs = [subsystem(s, pl_table, ccf) for s in fn["subsystems"]]
    pl, low, n = combine([s["pl"] for s in subs])
    return {"id": fn.get("id", ""), "name": fn.get("name", ""), "risk": f"{fn['S']}{fn['F']}{fn['P']}", "PLr": plr,
            "subsystems": subs, "PL_low": low, "N_low": n, "PL": pl, "ok": pl_ok(pl, plr)}


def ccf_score(applied, measures):
    pts = dict((m[0], m[1]) for m in measures)
    bad = [a for a in applied if a not in pts]
    if bad:
        raise InputError(f"CCF measure(s) unknown: {bad}")
    s = sum(pts[a] for a in applied)
    return s, s >= 65


def parse_channel(txt):
    comps = []
    for part in txt.split(";"):
        if not part.strip():
            continue
        f = [x.strip() for x in part.split(",")]
        if len(f) != 6:
            raise InputError(f"component '{part}' needs 6 fields name,B10d,d_op,h_op,t_cycle_s,DC%")
        comps.append(f)
    if not comps:
        raise InputError("empty channel")
    return comps


# ----------------------------------------------------------------------------- output
def sub_line(s):
    if s["certified"]:
        return [s["role"], s["name"], "-", "-", "-", "-", "-", s["pl"]]
    return [s["role"], s["name"], f"Cat {s['cat']}", " / ".join(f"{x:.2f}" for x in s["ch_mttfd"]),
            f"{s['mttfd']:.2f} -> {s['mttfd_capped']:.0f} {s['mttfd_band']}" if s["mttfd"] > 100 else
            f"{s['mttfd']:.2f} {s['mttfd_band']}", f"{s['dcavg']:.1f} % {s['dc_band']}", s["column"] or "-", s["pl"]]


SUBH = ["role", "subsystem", "cat", "channel MTTFd y", "MTTFd y", "DCavg", "column", "PL"]


def comp_rows(F):
    out = []
    for f in F:
        for s in f["subsystems"]:
            if s["certified"]:
                continue
            for k, ch in enumerate(s["components"], 1):
                for c in ch:
                    out.append([f["id"], s["role"], k, c["name"], f"{c['B10d']:.0f}", f"{c['n_op']:.0f}",
                                f"{c['MTTFd']:.2f}", f"{c['T10d']:.1f}", f"{c['DC']:g}"])
    return out


COMPH = ["SF", "role", "ch", "component", "B10d", "n_op /y", "MTTFd y", "T10d y", "DC %"]


def show_function(f, detail):
    print(f"{f['id']}  {f['name']}")
    print(f"  risk {f['risk']} -> PLr {f['PLr']}")
    print(fmt_table(SUBH, [sub_line(s) for s in f["subsystems"]], "llllllll"))
    if detail:
        cr = comp_rows([f])
        if cr:
            print(fmt_table(COMPH[1:], [r[1:] for r in cr], "lrlrrrrr"))
        for s in f["subsystems"]:
            if not s["certified"]:
                print(f"  {s['role']}: {s['why']}")
    verdict = "OK" if f["ok"] else "NOT OK - improve the design (e.g. 2 channels / Cat 3 with diagnostics)"
    print(f"  PL_low {f['PL_low'] or '-'} (N = {f['N_low']}) -> PL {f['PL']}  vs PLr {f['PLr']}: {verdict}")


def summary_rows(F):
    return [[f["id"], f["risk"], f["PLr"], " ".join(s["pl"] for s in f["subsystems"]), f["PL"],
             "OK" if f["ok"] else "NOT OK", f["name"]] for f in F]


SUMH = ["SF", "risk", "PLr", "subsystem PLs", "PL", "verdict", "safety function"]


def markdown(F, ccf):
    L = ["# Safety functions (ISO 13849-1, simplified)", "", "| " + " | ".join(SUMH) + " |", "|" + "---|" * len(SUMH)]
    L += ["| " + " | ".join(r) + " |" for r in summary_rows(F)]
    for f in F:
        L += ["", f"## {f['id']} {f['name']}", "", f"Risk {f['risk']} -> PLr **{f['PLr']}**; PL **{f['PL']}** -> "
              f"**{'OK' if f['ok'] else 'NOT OK'}**", "", "| " + " | ".join(SUBH) + " |", "|" + "---|" * len(SUBH)]
        L += ["| " + " | ".join(sub_line(s)) + " |" for s in f["subsystems"]]
    L += ["", "## CCF", "", "| case | score | >= 65 |", "|---|---|---|"]
    L += [f"| {n} | {s} | {'OK' if ok else 'NOT OK'} |" for n, s, ok in ccf]
    return "\n".join(L + ["", "_" + NOTE + "_"]) + "\n"


def all_functions(S, ccf=65):
    return [function(fn, S["pl_table"], ccf) for fn in S["functions"]]


def ccf_cases(S):
    return [(c["name"], *ccf_score(c["applied"], S["ccf_measures"])) for c in S["ccf_cases"]]


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("safety_pl")
    _, S = load_examples(path, "safety")
    t.equal("risk graph 8 combinations", [risk_graph(k[:2], k[2:4], k[4:]) for k in sorted(RISK)],
            ["a", "b", "b", "c", "c", "d", "d", "e"])
    F = {f["id"]: f for f in all_functions(S)}
    t.equal("6 functions", len(F), 6)
    f1 = F["SF1"]
    i1, lg, o1 = f1["subsystems"]
    c = i1["components"]
    t.close("SF1 interlock n_op = 240*16*3600/1800 = 7680 /y", c[0][0]["n_op"], 7680, 1e-9)
    t.close("SF1 interlock MTTFd 2604.17 y", c[0][0]["MTTFd"], 2604.17, 0.005)
    t.close("SF1 interlock T10d 260.42 y", c[0][0]["T10d"], 260.4167, 1e-3)
    t.close("SF1 position switch MTTFd 13020.83 y", c[1][0]["MTTFd"], 13020.83, 0.005)
    t.close("SF1 input symmetrised 8969.91 y", i1["mttfd"], 8969.91, 0.005)
    t.equal("SF1 input capped 100 -> high", (i1["mttfd_capped"], i1["mttfd_band"]), (100.0, "high"))
    t.close("SF1 input DCavg 97.5 %", i1["dcavg"], 97.5, 1e-9)
    t.equal("SF1 input DC band medium -> column 3|medium", (i1["dc_band"], i1["column"]), ("medium", "3|medium"))
    t.equal("SF1 input PL d", i1["pl"], "d")
    t.close("SF1 output channel MTTFd 1302.08 y", o1["ch_mttfd"][0], 1302.08, 0.005)
    t.close("SF1 output symmetrised (equal channels) 1302.08 y", o1["mttfd"], 1302.08, 0.005)
    t.equal("SF1 output DCavg 99 % -> high -> column 3|medium -> d", (o1["dc_band"], o1["column"], o1["pl"]),
            ("high", "3|medium", "d"))
    t.equal("SF1 PLr d, PL d (N_low 2), OK", (f1["PLr"], f1["PL"], f1["N_low"], f1["ok"]), ("d", "d", 2, True))
    t.equal("SF2 PLr d, PL d, OK", (F["SF2"]["PLr"], F["SF2"]["PL"], F["SF2"]["ok"]), ("d", "d", True))
    f3 = F["SF3"]
    t.close("SF3 e-stop n_op 480 /y", f3["subsystems"][0]["components"][0][0]["n_op"], 480, 1e-9)
    t.close("SF3 input channel MTTFd 2083.33 y", f3["subsystems"][0]["ch_mttfd"][0], 2083.33, 0.005)
    t.equal("SF3 input PL d, PLr d, PL d OK", (f3["subsystems"][0]["pl"], f3["PLr"], f3["PL"], f3["ok"]),
            ("d", "d", "d", True))
    f4 = F["SF4"]
    o4 = f4["subsystems"][2]
    t.close("SF4 contactor n_op 108000 /y", o4["components"][0][0]["n_op"], 108000, 1e-9)
    t.close("SF4 output MTTFd 92.59 y", o4["mttfd"], 92.59, 0.005)
    t.equal("SF4 output Cat 1, column 1|none, DC 0 -> c", (o4["column"], o4["dc_band"], o4["pl"]), ("1|none", "none", "c"))
    t.equal("SF4 PLr b, PL c, OK", (f4["PLr"], f4["PL"], f4["ok"]), ("b", "c", True))
    f5 = F["SF5"]
    i5 = f5["subsystems"][0]
    t.close("SF5 input MTTFd 500 y", i5["ch_mttfd"][0], 500, 1e-9)
    t.close("SF5 DCavg 90 % (medium band starts at 90)", i5["dcavg"], 90, 1e-9)
    t.equal("SF5 input d, PLr c, PL d, OK", (i5["pl"], f5["PLr"], f5["PL"], f5["ok"]), ("d", "c", "d", True))
    f6 = F["SF6"]
    i6, _, o6 = f6["subsystems"]
    t.close("SF6 interlock MTTFd 868.06 y", i6["mttfd"], 868.06, 0.005)
    t.close("SF6 contactor MTTFd 434.03 y", o6["mttfd"], 434.03, 0.005)
    t.equal("SF6 subsystems c e c", [s["pl"] for s in f6["subsystems"]], ["c", "e", "c"])
    t.equal("SF6 PLr d, PL c, NOT OK", (f6["PLr"], f6["PL"], f6["ok"]), ("d", "c", False))
    t.equal("verdicts SF1..SF6", [F[k]["ok"] for k in sorted(F)], [True, True, True, True, True, False])
    cc = ccf_cases(S)
    t.equal("CCF typical 65 OK", cc[0][1:], (65, True))
    t.equal("CCF without EMC 40 not OK", cc[1][1:], (40, False))
    t.equal("CCF all measures = 100", ccf_score([m[0] for m in S["ccf_measures"]], S["ccf_measures"])[0], 100)
    low_ccf = function(S["functions"][0], S["pl_table"], ccf=40)
    t.equal("SF1 with CCF 40 -> Cat 3 subsystems n/a -> NOT OK", (low_ccf["PL"], low_ccf["ok"]), (NA, False))
    t.equal("Table 11: d d d -> d ; d d d d -> c", (combine(list("ddd"))[0], combine(list("dddd"))[0]), ("d", "c"))
    t.equal("Table 11: c c -> c ; c c c -> b ; b b b -> a ; a a a a -> n/a",
            (combine(list("cc"))[0], combine(list("ccc"))[0], combine(list("bbb"))[0], combine(list("aaaa"))[0]),
            ("c", "b", "a", NA))
    t.equal("Table 11: e e e e -> d ; c d e -> c", (combine(list("eeee"))[0], combine(list("cde"))[0]), ("d", "c"))
    t.equal("MTTFd bands 2.9 / 3 / 9.99 / 10 / 30 / 100",
            [mttfd_band(x) for x in (2.9, 3, 9.99, 10, 30, 100)], ["below 3", "low", "low", "medium", "high", "high"])
    t.equal("DC bands 59.9 / 60 / 90 / 98.9 / 99", [dc_band(x) for x in (59.9, 60, 90, 98.9, 99)],
            ["none", "low", "medium", "medium", "high"])
    t.equal("columns: B, 1, 2 low, 3 high->medium, 3 none, 4 medium, 4 high",
            [column("B", "none"), column("1", "high"), column("2", "low"), column("3", "high"), column("3", "none"),
             column("4", "medium"), column("4", "high")],
            ["B|none", "1|none", "2|low", "3|medium", None, None, "4|high"])
    t.close("symmetrise equal channels C -> C", symmetrise(50, 50), 50, 1e-9)
    t.close("symmetrise 10 / 40 = 2/3*(50 - 8) = 28", symmetrise(10, 40), 28, 1e-9)
    t.close("series channel 2 components 100 + 100 -> 50", channel_mttfd([{"MTTFd": 100}, {"MTTFd": 100}]), 50, 1e-9)
    own = subsystem({"cat": "1", "channels": [[["x", 20000, 365, 24, 10, 0]]]}, S["pl_table"])
    t.true("Cat 1 with MTTFd 0.63 y -> below 3 -> n/a", own["pl"] == NA and own["mttfd_band"] == "below 3")
    own4 = subsystem({"cat": "4", "channels": [[["x", 2e6, 240, 16, 1800, 99]], [["y", 2e6, 240, 16, 1800, 99]]]},
                     S["pl_table"])
    t.equal("Cat 4, DC 99 high, MTTFd high -> e", own4["pl"], "e")
    t.true("PL e >= PLr d, PL c < PLr d, n/a never OK", pl_ok("e", "d") and not pl_ok("c", "d") and not pl_ok(NA, "a"))
    try:
        risk_graph("S3", "F1", "P1")
        t.true("bad risk parameter rejected", False)
    except InputError:
        t.true("bad risk parameter rejected", True)
    try:
        component(["x", 1e6, 240, 30, 1800, 99])
        t.true("h_op 30 rejected", False)
    except InputError:
        t.true("h_op 30 rejected", True)
    t.equal("parse_channel 2 components", len(parse_channel("a,1,1,1,1,0; b,2,2,2,2,90")), 2)
    md = markdown(list(F.values()), cc)
    t.true("markdown: 6 function sections + CCF + note", md.count("\n## ") == 7 and "EXAMPLES" in md)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", default=str(ITEM7_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--example", action="store_true", help="run the JSON example (also the default)")
    ap.add_argument("--function", help="show only this function id (with all components)")
    ap.add_argument("--ccf-score", type=float, default=65, help="CCF score used for Cat 2-4 (default 65)")
    ap.add_argument("--md", help="write Markdown")
    ap.add_argument("--csv", help="write the component table as CSV")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    sub = ap.add_subparsers(dest="cmd")
    s = sub.add_parser("risk", help="PLr from the risk graph")
    s.add_argument("--S", required=True, choices=["S1", "S2"])
    s.add_argument("--F", required=True, choices=["F1", "F2"])
    s.add_argument("--P", required=True, choices=["P1", "P2"])
    s = sub.add_parser("eval", help="evaluate an own subsystem (and optionally a whole function)")
    s.add_argument("--cat", required=True, choices=["B", "1", "2", "3", "4"])
    s.add_argument("--ch1", required=True, help="'name,B10d,d_op,h_op,t_cycle_s,DC;...'")
    s.add_argument("--ch2", help="second channel (same format)")
    s.add_argument("--other", help="PLs of the other subsystems, e.g. e,d (logic, output)")
    s.add_argument("--risk", help="S F P, e.g. S2F2P1 -> verdict")
    s = sub.add_parser("ccf", help="CCF score of the measures (1-based numbers of the JSON list)")
    s.add_argument("--measures", required=True, help="e.g. 1,3,5,6,7")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    _, S = load_examples(a.examples, "safety")
    if a.cmd == "risk":
        print(f"{a.S}{a.F}{a.P} -> PLr {risk_graph(a.S, a.F, a.P)}\n{NOTE}")
        return 0
    if a.cmd == "ccf":
        ms = S["ccf_measures"]
        try:
            idx = [int(x) for x in a.measures.split(",") if x.strip()]
        except ValueError:
            raise InputError("--measures must be a comma list of numbers")
        if any(not 1 <= i <= len(ms) for i in idx):
            raise InputError(f"measure numbers must be 1..{len(ms)}")
        names = [ms[i - 1][0] for i in idx]
        sc, ok = ccf_score(names, ms)
        print(fmt_table(["#", "measure", "points"], [[i, ms[i - 1][0], ms[i - 1][1]] for i in idx], "rlr"))
        print(f"CCF score {sc} -> {'OK (>= 65)' if ok else 'NOT OK (< 65)'}\n{NOTE}")
        return 0
    if a.cmd == "eval":
        chans = [parse_channel(a.ch1)] + ([parse_channel(a.ch2)] if a.ch2 else [])
        sb = {"role": "input", "name": "own subsystem", "cat": a.cat, "channels": chans}
        r = subsystem(sb, S["pl_table"], a.ccf_score)
        if a.json:
            print(json.dumps({**r, "note": NOTE}, indent=1, ensure_ascii=False))
            return 0
        print(fmt_table(COMPH[2:], [[k, c["name"], f"{c['B10d']:.0f}", f"{c['n_op']:.0f}", f"{c['MTTFd']:.2f}",
                                     f"{c['T10d']:.1f}", f"{c['DC']:g}"]
                                    for k, ch in enumerate(r["components"], 1) for c in ch], "rlrrrrr"))
        print(fmt_table(SUBH, [sub_line(r)], "llllllll"))
        print(f"  {r['why']}")
        if a.other or a.risk:
            others = [x.strip() for x in (a.other or "").split(",") if x.strip()]
            pl, low, n = combine([r["pl"]] + others)
            line = f"  function: PLs {' '.join([r['pl']] + others)} -> PL {pl}"
            if a.risk:
                k = a.risk.upper().replace(" ", "")
                plr = risk_graph(k[:2], k[2:4], k[4:])
                line += f" vs PLr {plr}: {'OK' if pl_ok(pl, plr) else 'NOT OK'}"
            print(line)
        print(NOTE)
        return 0
    F = all_functions(S, a.ccf_score)
    cc = ccf_cases(S)
    if a.function:
        sel = [f for f in F if f["id"] == a.function]
        if not sel:
            raise InputError(f"function '{a.function}' not found (ids: {', '.join(f['id'] for f in F)})")
        F = sel
    if a.json:
        print(json.dumps({"functions": F, "ccf": [{"case": n, "score": s, "ok": ok} for n, s, ok in cc],
                          "note": NOTE}, indent=1, ensure_ascii=False))
        return 0
    for f in F:
        show_function(f, bool(a.function))
        print()
    if not a.function:
        print("SUMMARY")
        print(fmt_table(SUMH, summary_rows(F), "lllllll"))
        print()
        print("CCF (common cause failure, ISO 13849-1 Annex F, >= 65 needed for Cat 2-4)")
        print(fmt_table(["case", "score", "verdict"], [[n, s, "OK" if ok else "NOT OK"] for n, s, ok in cc], "lrl"))
        print(f"  (the PLs above assume CCF {a.ccf_score:g}; try --ccf-score 40)")
        print()
    print(NOTE)
    if a.md:
        p = Path(a.md)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(markdown(F, cc), encoding="utf-8")
        print(f"\nMarkdown written: {p}")
    if a.csv:
        print(f"CSV written: {write_csv(a.csv, COMPH, comp_rows(F))}")
    return 0


if __name__ == "__main__":
    run_main(main)
