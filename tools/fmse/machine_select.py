#!/usr/bin/env python3
"""Machine selection: AHP weighting + scoring, life-cycle cost (LCC), and a combined view.

Python 3 standard library only, offline. Formulas = "_formulas" in examples/item2_examples.json.

AHP (analytic hierarchy process, Saaty), section "ahp":
    weights w_i  = geometric mean of row i of the pairwise matrix A, normalised to sum 1
    lambda_max   = mean over i of (A w)_i / w_i
    CI           = (lambda_max - n)/(n - 1)
    CR           = CI / RI(n),  RI = {1: 0, 2: 0, 3: 0.58, 4: 0.90, 5: 1.12, 6: 1.24, 7: 1.32}
    CR < 0.10    -> the pairwise judgements are consistent enough
    score_alt    = sum_k w_k * s_alt,k     (scores 1..10 per criterion)
LCC (life-cycle cost), section "lcc":
    LCC = purchase + installation
          + sum_{t=1..years} (energy_t + maintenance_t + tooling_t)/(1+r)^t
          - residual/(1+r)^years
    energy_t = kW_avg*hours*price;  maintenance_t = maint_pct*purchase  (same every year)
Combined view: AHP rank and LCC rank side by side (lower LCC = better rank).
"""

import argparse
import math

from fmse_common import ITEM2_EXAMPLES, InputError, SelfTest, fmt_num, fmt_table, load_examples, run_main, write_csv

RI = {1: 0.0, 2: 0.0, 3: 0.58, 4: 0.90, 5: 1.12, 6: 1.24, 7: 1.32}


# ----------------------------------------------------------------------------- AHP
def ahp(a):
    crit, A, alts = a.get("criteria"), a.get("pairwise"), a.get("alternatives")
    if not crit or not A or not alts:
        raise InputError("ahp: 'criteria', 'pairwise' and 'alternatives' are needed")
    n = len(crit)
    if len(A) != n or any(len(r) != n for r in A):
        raise InputError(f"ahp: pairwise matrix must be {n} x {n}")
    if any(v <= 0 for r in A for v in r):
        raise InputError("ahp: pairwise values must be > 0")
    if n not in RI:
        raise InputError("ahp: 1 to 7 criteria are supported (RI table)")
    warn = []
    for i in range(n):
        for j in range(n):
            if abs(A[i][j] * A[j][i] - 1) > 1e-3:
                warn.append(f"a[{i+1}][{j+1}]*a[{j+1}][{i+1}] = {A[i][j]*A[j][i]:.4f} (should be 1)")
    gm = [math.prod(r) ** (1 / n) for r in A]
    w = [g / sum(gm) for g in gm]
    Aw = [sum(A[i][j] * w[j] for j in range(n)) for i in range(n)]
    ratios = [Aw[i] / w[i] for i in range(n)]
    lam = sum(ratios) / n
    CI = (lam - n) / (n - 1) if n > 1 else 0.0
    CR = CI / RI[n] if RI[n] > 0 else 0.0
    scores = []
    for name, s in alts:
        if len(s) != n:
            raise InputError(f"ahp alternative {name}: need {n} scores")
        scores.append((name, sum(wk * sk for wk, sk in zip(w, s)), s))
    ranked = sorted(scores, key=lambda x: -x[1])
    rank = {x[0]: k + 1 for k, x in enumerate(ranked)}
    return {"criteria": crit, "gm": gm, "w": w, "Aw": Aw, "ratios": ratios, "lam": lam, "CI": CI, "CR": CR,
            "ok": CR < 0.10, "scores": scores, "rank": rank, "warn": warn}


# ----------------------------------------------------------------------------- LCC
def lcc(l):
    for k in ("years", "rate", "candidates", "hours_per_year", "energy_EUR_kWh"):
        if k not in l:
            raise InputError(f"lcc: value '{k}' is missing")
    yrs, r = int(l["years"]), l["rate"]
    if yrs <= 0 or r <= -1:
        raise InputError("lcc: years must be > 0 and rate > -1")
    af = sum((1 + r) ** -t for t in range(1, yrs + 1))       # present value of 1 EUR per year
    df = (1 + r) ** -yrs
    out = []
    for c in l["candidates"]:
        if len(c) < 7:
            raise InputError(f"lcc candidate {c[0] if c else '?'}: need 7 values (see _cols)")
        name, pur, inst, kw, mp, tool, res = c[:7]
        energy = kw * l["hours_per_year"] * l["energy_EUR_kWh"]
        maint = mp * pur
        annual = energy + maint + tool
        pv_e, pv_m, pv_t = energy * af, maint * af, tool * af
        pv_res = res * df
        total = pur + inst + pv_e + pv_m + pv_t - pv_res
        out.append({"name": name, "purchase": pur, "install": inst, "energy": energy, "maint": maint, "tool": tool,
                    "annual": annual, "pv_e": pv_e, "pv_m": pv_m, "pv_t": pv_t, "pv_res": pv_res, "lcc": total})
    ranked = sorted(out, key=lambda x: x["lcc"])
    rank = {x["name"]: k + 1 for k, x in enumerate(ranked)}
    return {"af": af, "df": df, "rows": out, "rank": rank}


# ----------------------------------------------------------------------------- report
def show_ahp(a):
    r = ahp(a)
    n = len(r["criteria"])
    print(f"AHP - criteria weights from pairwise comparison ({n} criteria)")
    print("Pairwise matrix a_ij = how much more important is row i than column j (1 equal, 3 moderate, 5 strong, 9 extreme):")
    print(fmt_table(["criterion"] + [f"C{j+1}" for j in range(n)] + ["geo mean", "weight w", "(Aw)_i", "(Aw)_i/w_i"],
                    [[f"C{i+1} {r['criteria'][i]}"] + [f"{v:g}" for v in a["pairwise"][i]] +
                     [f"{r['gm'][i]:.4f}", f"{r['w'][i]*100:.2f} %", f"{r['Aw'][i]:.4f}", f"{r['ratios'][i]:.4f}"]
                     for i in range(n)]))
    print(f"lambda_max = {r['lam']:.4f}   CI = ({r['lam']:.4f} - {n})/{n-1} = {r['CI']:.5f}   "
          f"CR = CI/RI({n}) = {r['CI']:.5f}/{RI[n]} = {r['CR']:.4f}  -> "
          f"{'consistent (CR < 0.10)' if r['ok'] else 'NOT consistent (CR >= 0.10): revise the pairwise judgements'}")
    for w_ in r["warn"]:
        print(f"  note: matrix not reciprocal: {w_}")
    print()
    print("Alternative scores (1..10) and weighted score = sum w_k * s_k:")
    rows = []
    for name, sc, s in r["scores"]:
        rows.append([name] + [f"{x:g}" for x in s] + [f"{sc:.3f}", r["rank"][name]])
    print(fmt_table(["alternative"] + [f"C{j+1}" for j in range(n)] + ["score", "rank"], rows))
    best = sorted(r["scores"], key=lambda x: -x[1])
    if len(best) > 1:
        gap = (best[0][1] - best[1][1]) / best[0][1] * 100
        print(f"Best: {best[0][0]} ({best[0][1]:.3f}), then {best[1][0]} ({best[1][1]:.3f}), gap {gap:.1f} %"
              + ("  - less than 5 %: not robust, test with changed weights / references / test cut" if gap < 5 else ""))
    return r


def show_lcc(l, csv_path=None):
    r = lcc(l)
    print(f"LIFE-CYCLE COST over {l['years']} years, discount rate {l['rate']*100:g} %, "
          f"{l['hours_per_year']:g} h/yr, energy {l['energy_EUR_kWh']:g} EUR/kWh")
    print(f"annuity factor sum 1/(1+r)^t = {r['af']:.6f}   discount factor 1/(1+r)^{l['years']} = {r['df']:.6f}")
    print("Annual costs (EUR/yr):")
    print(fmt_table(["candidate", "energy = kW*h*price", "maintenance = pct*purchase", "tooling", "sum per year"],
                    [[x["name"], fmt_num(x["energy"], 0), fmt_num(x["maint"], 0), fmt_num(x["tool"], 0),
                      fmt_num(x["annual"], 0)] for x in r["rows"]]))
    print()
    print("Present values (EUR):")
    print(fmt_table(["candidate", "purchase", "installation", "PV energy", "PV maintenance", "PV tooling",
                     "- PV residual", "LCC", "rank"],
                    [[x["name"], fmt_num(x["purchase"], 0), fmt_num(x["install"], 0), fmt_num(x["pv_e"], 0),
                      fmt_num(x["pv_m"], 0), fmt_num(x["pv_t"], 0), fmt_num(-x["pv_res"], 0), fmt_num(x["lcc"], 0),
                      r["rank"][x["name"]]] for x in r["rows"]]))
    cheapest = min(r["rows"], key=lambda x: x["lcc"])
    print(f"Lowest LCC: {cheapest['name']} {fmt_num(cheapest['lcc'], 0)} EUR. "
          f"The cheapest purchase price is {min(r['rows'], key=lambda x: x['purchase'])['name']} - "
          f"running costs can change the order.")
    rk = sorted(r["rows"], key=lambda x: x["lcc"])
    if len(rk) > 1:
        gap = (rk[1]["lcc"] - rk[0]["lcc"]) / rk[0]["lcc"] * 100
        print(f"Gap to the 2nd ({rk[1]['name']}): {fmt_num(rk[1]['lcc'] - rk[0]['lcc'], 0)} EUR = {gap:.1f} %"
              + ("  - inside the estimate accuracy: treat as equal" if gap < 3 else ""))
    if csv_path:
        p = write_csv(csv_path, ["candidate", "purchase", "installation", "energy_yr", "maintenance_yr", "tooling_yr",
                                 "pv_energy", "pv_maintenance", "pv_tooling", "pv_residual", "lcc", "rank"],
                      [[x["name"], x["purchase"], x["install"], round(x["energy"], 2), round(x["maint"], 2), x["tool"],
                        round(x["pv_e"], 2), round(x["pv_m"], 2), round(x["pv_t"], 2), round(x["pv_res"], 2),
                        round(x["lcc"], 2), r["rank"][x["name"]]] for x in r["rows"]])
        print(f"\nCSV written: {p}")
    return r


def show_combined(a, l):
    ra, rl = ahp(a), lcc(l)
    names = [x[0] for x in ra["scores"]]
    lccv = {x["name"]: x["lcc"] for x in rl["rows"]}
    print("COMBINED VIEW (AHP = benefit, LCC = cost)")
    rows = []
    for nme, sc, _ in ra["scores"]:
        lr = rl["rank"].get(nme)
        rows.append([nme, f"{sc:.3f}", ra["rank"][nme], fmt_num(lccv[nme], 0) if nme in lccv else "-",
                     lr if lr else "-", ra["rank"][nme] + (lr or 0)])
    print(fmt_table(["candidate", "AHP score", "AHP rank", "LCC EUR", "LCC rank", "rank sum"], rows))
    both = [n for n in names if ra["rank"][n] == 1 and rl["rank"].get(n) == 1]
    if both:
        print(f"{both[0]} is first in both views - a clear choice (check the knock-out criteria first).")
    else:
        print("The two views disagree - discuss the trade-off (benefit vs cost); do not add ranks blindly.")
    print("Note: the AHP already contains a 'life-cycle cost' criterion; the LCC table is the check of that score.")


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("machine_select")
    data, a = load_examples(path, "ahp")
    r = ahp(a)
    gm = [6 ** 0.25, 0.5 ** 0.25, (0.333333 * 0.5 * 0.333333) ** 0.25, 6 ** 0.25]
    t.close("w1 (technical fit)", r["w"][0], gm[0] / sum(gm), 1e-12)
    t.close("w1 value", r["w"][0], 0.3511869, 1e-6)
    t.close("w2 value", r["w"][1], 0.1886875, 1e-6)
    t.close("w3 value", r["w"][2], 0.1089387, 1e-6)
    t.close("weights sum 1", sum(r["w"]), 1.0, 1e-12)
    t.close("lambda_max", r["lam"], 4.0103557, 1e-6)
    t.close("CR", r["CR"], 0.0038355, 1e-6)
    t.true("CR < 0.10", r["ok"])
    sc = {n: s for n, s, _ in r["scores"]}
    t.close("score Machine A", sc["Machine A"], 7.2422482, 1e-6)
    t.close("score Machine B", sc["Machine B"], 7.4065649, 1e-6)
    t.close("score Machine C", sc["Machine C"], 7.6226251, 1e-6)
    t.equal("AHP ranking", sorted(r["rank"], key=r["rank"].get), ["Machine C", "Machine B", "Machine A"])
    l = lcc(data["lcc"])
    t.close("annuity factor 8 %, 10 yr", l["af"], 6.7100814, 1e-6)
    v = {x["name"]: x for x in l["rows"]}
    t.close("Machine A annual = 11340 + 18200 + 12000", v["Machine A"]["annual"], 41540, 1e-9)
    t.close("LCC Machine A", v["Machine A"]["lcc"], 814650.72, 0.01)
    t.close("LCC Machine B", v["Machine B"]["lcc"], 863938.08, 0.01)
    t.close("LCC Machine C", v["Machine C"]["lcc"], 812350.91, 0.01)
    t.equal("LCC ranking", sorted(l["rank"], key=l["rank"].get), ["Machine C", "Machine A", "Machine B"])
    t.close("CR of a perfectly consistent 3x3 matrix", ahp({"criteria": ["a", "b", "c"],
            "pairwise": [[1, 2, 4], [0.5, 1, 2], [0.25, 0.5, 1]], "alternatives": [["x", [1, 1, 1]]]})["CR"], 0.0, 1e-12)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n  python tools/fmse/machine_select.py               (AHP + LCC + combined)\n"
               "  python tools/fmse/machine_select.py --lcc --csv lcc.csv")
    ap.add_argument("--examples", default=str(ITEM2_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--ahp", action="store_true", help="show only the AHP part")
    ap.add_argument("--lcc", action="store_true", help="show only the LCC part")
    ap.add_argument("--csv", help="write the LCC table to this CSV file")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    data, ahp_d = load_examples(a.examples, "ahp")
    if "lcc" not in data:
        raise InputError("section 'lcc' is missing in the JSON")
    both = not (a.ahp or a.lcc)
    if both or a.ahp:
        show_ahp(ahp_d)
        print()
    if both or a.lcc:
        show_lcc(data["lcc"], a.csv)
        print()
    if both or (a.ahp and a.lcc):
        show_combined(ahp_d, data["lcc"])
    return 0


if __name__ == "__main__":
    run_main(main)
