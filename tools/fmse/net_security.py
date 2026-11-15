#!/usr/bin/env python3
"""Network security: firewall rule evaluation, rule audit and IEC 62443 risk table of the FMS network.

Python 3 standard library only, offline. Rules = "_formulas.firewall" and "_formulas.risk" in
examples/item6_examples.json (section "security"). Guide: docs/FMS system design/66_communication.md.

Firewall: rules [id, src zone, src host, dst zone, dst host, service, action, note] are checked top-down,
  FIRST MATCH wins; a field matches if equal or '*'; no match -> default deny (rule id 'DEFAULT').
  A flow is [source host, source zone, destination host, destination zone, service].
Audit: an ALLOW rule between zones that are not neighbours (either direction) -> 'crosses zones';
  an ALLOW rule with service '*' -> 'any service'.
Risk (IEC 62443-3-2 style): risk = L x C (1-5 each); class high >= 15, medium 8-14, low <= 7;
  SL-T from the initial class: high 3, medium 2, low 1; residual L = max(1, L - sum of countermeasure points);
  residual risk = residual L x C; zone SL-T = max SL-T of the threats of the zone.

Usage:
  python tools/fmse/net_security.py                       (flows + audit + risk table = --example)
  python tools/fmse/net_security.py --flow "Office PC,ent,Cell PLC,c1,s7"
  python tools/fmse/net_security.py --md security.md --csv flows.csv
  python tools/fmse/net_security.py --json
  python tools/fmse/net_security.py --selftest
"""

import argparse
import json
from pathlib import Path

from fmse_common import InputError, SelfTest, fmt_table, load_examples, run_main, write_csv

HERE = Path(__file__).resolve().parent
ITEM6_EXAMPLES = HERE / "examples" / "item6_examples.json"


def check_sec(S):
    for k in ("zones", "neighbours", "rules", "flows", "threats"):
        if k not in S:
            raise InputError(f"security: value '{k}' is missing")
    zones = {z[0] for z in S["zones"]}
    for r in S["rules"]:
        if len(r) != 8 or r[6] not in ("allow", "deny"):
            raise InputError(f"security: rule {r!r} must be [id, src zone, src host, dst zone, dst host, service, "
                             "allow|deny, note]")
        for z in (r[1], r[3]):
            if z != "*" and z not in zones:
                raise InputError(f"security: rule {r[0]}: zone '{z}' unknown")
    for f in S["flows"]:
        if len(f) != 5:
            raise InputError(f"security: flow {f!r} must be [src host, src zone, dst host, dst zone, service]")
    for th in S["threats"]:
        if len(th) != 5 or not (1 <= th[2] <= 5 and 1 <= th[3] <= 5):
            raise InputError(f"security: threat {th!r} must be [name, zone, L 1-5, C 1-5, countermeasures]")


def _m(rule_field, value):
    return rule_field == "*" or rule_field == value


def evaluate(rules, flow):
    """Return (action, rule id, note) of the first matching rule, else ('deny', 'DEFAULT', ...)."""
    sh, sz, dh, dz, svc = flow
    for r in rules:
        if _m(r[1], sz) and _m(r[2], sh) and _m(r[3], dz) and _m(r[4], dh) and _m(r[5], svc):
            return r[6], r[0], r[7]
    return "deny", "DEFAULT", "no rule matches - default deny"


def audit(S):
    nb = {tuple(n) for n in S["neighbours"]} | {(b, a) for a, b in S["neighbours"]}
    out = []
    for r in S["rules"]:
        if r[6] != "allow":
            continue
        if r[1] != r[3] and (r[1], r[3]) not in nb:
            out.append([r[0], "crosses zones", f"{r[1]} -> {r[3]} are not neighbours: {r[7]}"])
        if r[5] == "*":
            out.append([r[0], "any service", f"{r[1]}/{r[2]} -> {r[3]}/{r[4]} all services: {r[7]}"])
    return out


def risk_class(x):
    return "high" if x >= 15 else "medium" if x >= 8 else "low"


SLT = {"high": 3, "medium": 2, "low": 1}


def risk_table(S):
    rows = []
    for name, zone, L, C, cms in S["threats"]:
        r = L * C
        cl = risk_class(r)
        pts = sum(p for _, p in cms)
        rl = max(1, L - pts)
        rr = rl * C
        rows.append({"threat": name, "zone": zone, "L": L, "C": C, "risk": r, "class": cl, "slt": SLT[cl],
                     "countermeasures": "; ".join(f"{n} (-{p})" for n, p in cms), "points": pts, "res_L": rl,
                     "res_risk": rr, "res_class": risk_class(rr)})
    return rows


def zone_slt(S, rows):
    out = []
    for z, name in S["zones"]:
        v = [r["slt"] for r in rows if r["zone"] == z]
        out.append([z, name, len(v), max(v) if v else None])
    return out


# ----------------------------------------------------------------------------- output
def flow_rows(S):
    rows = []
    for k, f in enumerate(S["flows"], 1):
        act, rid, note = evaluate(S["rules"], f)
        rows.append([k, f"{f[0]} ({f[1]})", f"{f[2]} ({f[3]})", f[4], act.upper(), rid, note])
    return rows


def markdown(S):
    fr, au, rk = flow_rows(S), audit(S), risk_table(S)
    zs = zone_slt(S, rk)
    L = ["# Network security check (IEC 62443)", "", "## Firewall flows (first match, default deny)", "",
         "| # | source | destination | service | verdict | rule | reason |", "|---|---|---|---|---|---|---|"]
    L += [f"| {' | '.join(str(c) for c in r)} |" for r in fr]
    L += ["", "## Rule audit", "", "| rule | finding | detail |", "|---|---|---|"]
    L += [f"| {' | '.join(r)} |" for r in au] or ["| - | none | |"]
    L += ["", "## Risk table", "", "| threat | zone | L | C | risk | class | SL-T | countermeasures | res. L | "
          "res. risk | res. class |", "|---|---|---|---|---|---|---|---|---|---|---|"]
    L += [f"| {r['threat']} | {r['zone']} | {r['L']} | {r['C']} | {r['risk']} | {r['class']} | {r['slt']} | "
          f"{r['countermeasures']} | {r['res_L']} | {r['res_risk']} | {r['res_class']} |" for r in rk]
    L += ["", "## Zone SL-T", "", "| zone | name | threats | SL-T |", "|---|---|---|---|"]
    L += [f"| {z} | {n} | {c} | {('SL' + str(s)) if s else '-'} |" for z, n, c, s in zs]
    return "\n".join(L) + "\n"


def show(S):
    fr = flow_rows(S)
    print("FIREWALL FLOWS  (rules top-down, first match wins, no match = DEFAULT deny)")
    print(fmt_table(["#", "source", "destination", "service", "verdict", "rule", "reason"], fr, "rllllll"))
    n_allow = sum(1 for r in fr if r[4] == "ALLOW")
    print(f"  {n_allow} allowed, {len(fr) - n_allow} denied "
          f"({sum(1 for r in fr if r[5] == 'DEFAULT')} by DEFAULT)")
    hit = {r[5] for r in fr}
    unused = [r[0] for r in S["rules"] if r[0] not in hit]
    print(f"  rules not hit by any test flow: {', '.join(unused) or '-'} (info: test them with own flows)")
    print()
    au = audit(S)
    print("RULE AUDIT  (ALLOW between non-neighbour zones; ALLOW with service '*')")
    print(fmt_table(["rule", "finding", "detail"], au or [["-", "none", ""]], "lll"))
    print()
    rk = risk_table(S)
    print("RISK TABLE  (risk = L x C; high >= 15, medium 8-14, low <= 7; SL-T 3/2/1)")
    print(fmt_table(["#", "threat", "zone", "L", "C", "risk", "class", "SL-T", "pts", "res L", "res risk",
                     "res class"],
                    [[k, r["threat"], r["zone"], r["L"], r["C"], r["risk"], r["class"], r["slt"], r["points"],
                      r["res_L"], r["res_risk"], r["res_class"]] for k, r in enumerate(rk, 1)],
                    "rllrrrlrrrrl"))
    print()
    print("ZONE TARGET SECURITY LEVEL  (max SL-T of the threats of the zone)")
    print(fmt_table(["zone", "name", "threats", "SL-T"],
                    [[z, n, c, f"SL{s}" if s else "- (no threat listed)"] for z, n, c, s in zone_slt(S, rk)],
                    "llrl"))


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("net_security")
    _, S = load_examples(path, "security")
    check_sec(S)
    want = [("deny", "DEFAULT"), ("allow", "R01"), ("allow", "R02"), ("allow", "R05"), ("allow", "R05"),
            ("deny", "R07"), ("allow", "R06"), ("deny", "DEFAULT"), ("allow", "R04"), ("allow", "R08"),
            ("deny", "R14"), ("allow", "R11"), ("deny", "R10"), ("allow", "R09"), ("allow", "R12"),
            ("deny", "DEFAULT"), ("deny", "R10")]
    t.equal("17 flows in the JSON", len(S["flows"]), 17)
    for k, (f, w) in enumerate(zip(S["flows"], want), 1):
        got = evaluate(S["rules"], f)[:2]
        t.equal(f"flow {k:2d} {f[0]} -> {f[2]} {f[4]}: {w[0]} {w[1]}", got, w)
    t.equal("first match: R07 deny before nothing else (SCADA modbus-write)",
            evaluate(S["rules"], ["X", "mfg", "Y", "c1", "modbus-write"])[1], "R07")
    t.equal("R10 before R15: Engineering WS -> safety zone denied", evaluate(S["rules"], S["flows"][16])[1], "R10")
    t.equal("R15 catches eng -> c1 'http' (any service)",
            evaluate(S["rules"], ["Engineering WS", "eng", "HMI", "c1", "http"])[1], "R15")
    au = audit(S)
    t.equal("audit: 2 findings", len(au), 2)
    t.equal("audit: R04 crosses zones (dmz -> c1)", au[0][:2], ["R04", "crosses zones"])
    t.equal("audit: R15 any service", au[1][:2], ["R15", "any service"])
    rk = risk_table(S)
    t.equal("risk values 20 12 16 15 15 8 9 12 6", [r["risk"] for r in rk], [20, 12, 16, 15, 15, 8, 9, 12, 6])
    t.equal("classes", [r["class"] for r in rk],
            ["high", "medium", "high", "high", "high", "medium", "medium", "medium", "low"])
    t.equal("SL-T 3 2 3 3 3 2 2 2 1", [r["slt"] for r in rk], [3, 2, 3, 3, 3, 2, 2, 2, 1])
    t.equal("residual L: 4-3 -> 1, 3-2=1, 4-3=1, 1, 1, 1, 3-1=2, 1, 2", [r["res_L"] for r in rk],
            [1, 1, 1, 1, 1, 1, 2, 1, 2])
    t.equal("residual risk 5 4 4 5 5 4 6 4 4", [r["res_risk"] for r in rk], [5, 4, 4, 5, 5, 4, 6, 4, 4])
    t.true("all residual classes low", all(r["res_class"] == "low" for r in rk))
    t.equal("class limits: 15 high, 14 medium, 8 medium, 7 low",
            [risk_class(x) for x in (15, 14, 8, 7)], ["high", "medium", "medium", "low"])
    zs = {z: s for z, _, _, s in zone_slt(S, rk)}
    t.equal("zone SL-T mfg 3, c1 3, saf 3, eng 2, dmz 1", (zs["mfg"], zs["c1"], zs["saf"], zs["eng"], zs["dmz"]),
            (3, 3, 3, 2, 1))
    t.equal("zones without threats: ent, c2, inet", [z for z, s in zs.items() if s is None], ["ent", "c2", "inet"])
    t.true("markdown has 4 sections", markdown(S).count("\n## ") == 4)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", default=str(ITEM6_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--example", action="store_true", help="run the JSON example (also the default)")
    ap.add_argument("--flow", action="append", help="test an own flow 'src host,src zone,dst host,dst zone,service'")
    ap.add_argument("--md", help="write the whole report as Markdown")
    ap.add_argument("--csv", help="write the flow verdicts as CSV")
    ap.add_argument("--risk-csv", help="write the risk table as CSV")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    _, S = load_examples(a.examples, "security")
    check_sec(S)
    if a.flow:
        for txt in a.flow:
            f = [x.strip() for x in txt.split(",")]
            if len(f) != 5:
                raise InputError("--flow needs 5 fields: src host,src zone,dst host,dst zone,service")
            act, rid, note = evaluate(S["rules"], f)
            print(f"{f[0]} ({f[1]}) -> {f[2]} ({f[3]}) {f[4]}: {act.upper()} by {rid} - {note}")
        return 0
    if a.json:
        rk = risk_table(S)
        print(json.dumps({"flows": [dict(zip(["n", "source", "destination", "service", "verdict", "rule", "reason"], r))
                                    for r in flow_rows(S)],
                          "audit": [dict(zip(["rule", "finding", "detail"], r)) for r in audit(S)],
                          "risk": rk, "zone_slt": {z: s for z, _, _, s in zone_slt(S, rk)}}, indent=1,
                         ensure_ascii=False))
        return 0
    show(S)
    if a.md:
        p = Path(a.md)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(markdown(S), encoding="utf-8")
        print(f"\nMarkdown written: {p}")
    if a.csv:
        print(f"CSV written: {write_csv(a.csv, ['n', 'source', 'destination', 'service', 'verdict', 'rule', 'reason'], flow_rows(S))}")
    if a.risk_csv:
        rk = risk_table(S)
        keys = list(rk[0].keys())
        print(f"CSV written: {write_csv(a.risk_csv, keys, [[r[k] for k in keys] for r in rk])}")
    return 0


if __name__ == "__main__":
    run_main(main)
