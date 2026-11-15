#!/usr/bin/env python3
"""Layout planning: transport cost of a block layout, pairwise exchange (the CRAFT idea), SLP closeness
score, space requirement and aisle widths.

Python 3 standard library only, offline. Formulas = "_formulas" in examples/item4_examples.json
(card 4D of the web page uses the same from-to matrix, slots, start layout and exchange rule).

Layout cost (section "layout"):
    layout[s] = department in slot s ; slots on a grid, pitch p metres
    d_ij = (|x_i - x_j| + |y_i - y_j|) * p          (rectilinear distance between the slots of i and j)
    C    = sum_i sum_j f_ij * d_ij                   [load·m/day]
Pairwise exchange (steepest descent):
    in each iteration try every pair of slots (i < j, slot order), take the swap with the largest strict
    cost reduction (the first one found on ties), repeat until no swap reduces C (a local optimum)
SLP closeness score (Muther):
    rating values A 16, E 8, I 4, O 2, U 0, X -64 (pairs not listed = U)
    adjacent = rectilinear slot distance 1 ; score = sum over adjacent department pairs of the value
Space (section "space"):
    department area = machines * (footprint + operator & service area) * (1 + allowance)
    aisles = aisle_share * sum of departments ; total = sum + aisles
    (aisle_share is read as a share of the net department area; the share-of-total reading,
     total = sum / (1 - share), is printed as a note)
Aisles (section "aisle"):
    one-way = w + 2c ; two-way = 2w + 3c  (w = the wider of vehicle and load)
    AGV with personnel: + 0.5 m protective clearance on each side where people walk (ISO 3691-4 idea)
"""

import argparse

from fmse_common import (ITEM4_EXAMPLES, InputError, SelfTest, fmt_num, fmt_table, load_examples, run_main,
                         write_csv)

RATING = {"A": 16, "E": 8, "I": 4, "O": 2, "U": 0, "X": -64}


# ----------------------------------------------------------------------------- formulas
def check_layout(L):
    for k in ("depts", "flow", "slots", "start", "pitch_m"):
        if k not in L:
            raise InputError(f"layout: value '{k}' is missing")
    n = len(L["depts"])
    if len(L["flow"]) != n or any(len(r) != n for r in L["flow"]):
        raise InputError(f"layout: flow must be a {n} x {n} matrix")
    if len(L["slots"]) != n:
        raise InputError(f"layout: need {n} slots (one per department)")
    check_perm(L["start"], n)
    if L["pitch_m"] <= 0:
        raise InputError("layout: pitch_m must be > 0")


def check_perm(lay, n):
    if sorted(lay) != list(range(n)):
        raise InputError(f"layout: start must list every department index 0..{n-1} once")


def where(lay):
    at = [0] * len(lay)
    for s, d in enumerate(lay):
        at[d] = s
    return at


def slot_dist(a, b):
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


def cost(L, lay):
    at = where(lay)
    n = len(L["depts"])
    c = 0.0
    for i in range(n):
        for j in range(n):
            f = L["flow"][i][j]
            if f:
                c += f * slot_dist(L["slots"][at[i]], L["slots"][at[j]]) * L["pitch_m"]
    return c


def pairwise_exchange(L, lay, max_it=50):
    """Steepest descent. Returns (final layout, log [(it, slot i, slot j, dept a, dept b, cost after)])."""
    lay = list(lay)
    log = []
    for it in range(1, max_it + 1):
        best, bi, bj = cost(L, lay), -1, -1
        for i in range(len(lay)):
            for j in range(i + 1, len(lay)):
                lay[i], lay[j] = lay[j], lay[i]
                c = cost(L, lay)
                if c < best - 1e-9:
                    best, bi, bj = c, i, j
                lay[i], lay[j] = lay[j], lay[i]
        if bi < 0:
            break
        log.append((it, bi, bj, lay[bi], lay[bj], best))
        lay[bi], lay[bj] = lay[bj], lay[bi]
    return lay, log


def rel_matrix(L):
    names = L["depts"]
    idx = {n: k for k, n in enumerate(names)}
    rel = {}
    for r in L.get("rel", []):
        if len(r) < 3 or r[0] not in idx or r[1] not in idx:
            raise InputError(f"layout rel: unknown department in {r}")
        if r[2] not in RATING:
            raise InputError(f"layout rel: rating '{r[2]}' unknown (use A E I O U X)")
        rel[frozenset((idx[r[0]], idx[r[1]]))] = r[2]
    return rel


def slp_score(L, lay):
    """Adjacent department pairs (slot distance 1) with their rating and the total score."""
    rel = rel_matrix(L)
    at = where(lay)
    n = len(L["depts"])
    pairs, score = [], 0
    for i in range(n):
        for j in range(i + 1, n):
            if slot_dist(L["slots"][at[i]], L["slots"][at[j]]) == 1:
                r = rel.get(frozenset((i, j)), "U")
                pairs.append((L["depts"][i], L["depts"][j], r, RATING[r]))
                score += RATING[r]
    # rated pairs that are NOT adjacent (for the comment)
    missed = [(L["depts"][a], L["depts"][b], r) for k, r in rel.items() for a, b in [sorted(k)]
              if r in ("A", "E") and slot_dist(L["slots"][at[a]], L["slots"][at[b]]) != 1]
    bad_x = [(L["depts"][a], L["depts"][b]) for k, r in rel.items() for a, b in [sorted(k)]
             if r == "X" and slot_dist(L["slots"][at[a]], L["slots"][at[b]]) == 1]
    return {"pairs": pairs, "score": score, "missed": missed, "bad_x": bad_x}


def space_table(sp):
    if "depts" not in sp or "aisle_share" not in sp:
        raise InputError("space: 'depts' and 'aisle_share' are needed")
    rows = []
    for d in sp["depts"]:
        if len(d) < 5:
            raise InputError(f"space: need [dept, machines, footprint, operator & service, allowance] in {d}")
        name, n, fp, op, al = d[:5]
        if n < 0 or fp < 0 or op < 0 or al < 0:
            raise InputError(f"space {name}: values must be >= 0")
        rows.append({"dept": name, "n": n, "fp": fp, "op": op, "al": al, "area": n * (fp + op) * (1 + al)})
    net = sum(r["area"] for r in rows)
    sh = sp["aisle_share"]
    if not 0 <= sh < 1:
        raise InputError("space: aisle_share must be in [0, 1)")
    return {"rows": rows, "net": net, "aisles": net * sh, "total": net * (1 + sh), "share": sh,
            "total_share_of_total": net / (1 - sh)}


def aisles(a):
    for k in ("forklift_w", "load_w", "c", "agv_w", "agv_people_clearance"):
        if k not in a:
            raise InputError(f"aisle: value '{k}' is missing")
    w = max(a["forklift_w"], a["load_w"])
    c = a["c"]
    agv = a["agv_w"]
    pc = a["agv_people_clearance"]
    return [("Forklift, one-way", f"w + 2c = {w:g} + 2*{c:g}", w + 2 * c),
            ("Forklift, two-way", f"2w + 3c = 2*{w:g} + 3*{c:g}", 2 * w + 3 * c),
            ("AGV, one-way", f"w + 2c = {agv:g} + 2*{c:g}", agv + 2 * c),
            ("AGV, two-way", f"2w + 3c = 2*{agv:g} + 3*{c:g}", 2 * agv + 3 * c),
            ("AGV + people, one-way", f"w + 2c + 2*{pc:g}", agv + 2 * c + 2 * pc),
            ("AGV + people, two-way", f"2w + 3c + 2*{pc:g}", 2 * agv + 3 * c + 2 * pc)]


# ----------------------------------------------------------------------------- report
def grid_text(L, lay):
    xs = sorted({s[0] for s in L["slots"]})
    ys = sorted({s[1] for s in L["slots"]})
    cell = {tuple(L["slots"][s]): L["depts"][d] for s, d in enumerate(lay)}
    w = max(len(n) for n in L["depts"]) + 2
    lines = []
    for y in ys:
        lines.append("  " + "".join(f"[{cell.get((x, y), ''):^{w}}]" for x in xs))
    return "\n".join(lines)


def show_craft(L, start, csv_path=None):
    c0 = cost(L, start)
    print(f"LAYOUT COST - FROM-TO MATRIX x RECTILINEAR DISTANCE  (slot pitch {L['pitch_m']:g} m)")
    print("Start layout (slot grid):")
    print(grid_text(L, start))
    print(f"  C(start) = {fmt_num(c0, 0)} load·m/day")
    final, log = pairwise_exchange(L, start)
    print()
    print("Pairwise exchange (steepest descent: best swap of all slot pairs per iteration):")
    rows, prev = [], c0
    for it, i, j, a, b, c in log:
        rows.append([it, f"slot {i} <-> slot {j}", f"{L['depts'][a]} <-> {L['depts'][b]}", fmt_num(prev, 0),
                     fmt_num(c, 0), fmt_num(c - prev, 0)])
        prev = c
    print(fmt_table(["it", "swap", "departments", "cost before", "cost after", "saving"], rows, "rllrrr"))
    c1 = cost(L, final)
    print(f"\n{len(log)} swaps: {fmt_num(c0, 0)} -> {fmt_num(c1, 0)} load·m/day ({(c1/c0-1)*100:+.0f} %). "
          "No single swap helps any more - a local optimum; try another start.")
    print("Improved layout:")
    print(grid_text(L, final))
    if csv_path:
        p = write_csv(csv_path, ["iteration", "slot_i", "slot_j", "dept_a", "dept_b", "cost_after"],
                      [[0, "", "", "", "", c0]] + [[it, i, j, L["depts"][a], L["depts"][b], c] for it, i, j, a, b, c in log])
        print(f"CSV written: {p}")
    return final, log


def show_slp(L, start, final):
    print("SLP CLOSENESS SCORE  (A 16, E 8, I 4, O 2, U 0, X -64; adjacent = slot distance 1)")
    out = []
    for name, lay in (("start layout", start), ("improved layout (pairwise exchange)", final)):
        s = slp_score(L, lay)
        out.append(s)
        print(f"\n{name}: score {s['score']}")
        print(fmt_table(["department", "department", "rating", "value"],
                        [[a, b, r, v] for a, b, r, v in s["pairs"]], "lllr"))
        if s["bad_x"]:
            print("  X (must NOT be adjacent) violated: " + "; ".join(f"{a} - {b}" for a, b in s["bad_x"]))
        if s["missed"]:
            print("  A / E pairs not adjacent: " + "; ".join(f"{a} - {b} ({r})" for a, b, r in s["missed"]))
    return out


def show_space(sp):
    r = space_table(sp)
    print("SPACE REQUIREMENT  area = machines * (footprint + operator & service) * (1 + allowance)")
    print(fmt_table(["department", "machines", "footprint m2", "oper.+serv. m2", "allowance", "area m2"],
                    [[x["dept"], f"{x['n']:g}", f"{x['fp']:g}", f"{x['op']:g}", f"{x['al']*100:g} %",
                      fmt_num(x["area"], 2)] for x in r["rows"]]))
    print(f"  departments (net)        = {fmt_num(r['net'], 2)} m2")
    print(f"  aisles = {r['share']*100:g} % of net     = {fmt_num(r['aisles'], 2)} m2")
    print(f"  TOTAL                    = {fmt_num(r['total'], 2)} m2")
    print(f"  (if the {r['share']*100:g} % were meant as share of the TOTAL floor: {fmt_num(r['net'], 2)} / "
          f"(1 - {r['share']:g}) = {fmt_num(r['total_share_of_total'], 2)} m2)")
    print("  Add docks, offices, chip / coolant plant, tool room, maintenance and expansion space separately.")
    return r


def show_aisle(a):
    rows = aisles(a)
    print(f"AISLE WIDTHS  (clearance c = {a['c']:g} m, forklift {a['forklift_w']:g} m, load {a['load_w']:g} m, "
          f"AGV {a['agv_w']:g} m)")
    print(fmt_table(["aisle", "formula", "width m"], [[n, f, f"{w:.2f}"] for n, f, w in rows], "llr"))
    print("  AGV routes where people walk: keep the protective clearance on each side (ISO 3691-4 idea);")
    print("  check the local rules and the vehicle supplier's safety concept.")
    return rows


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("layout_plan")
    data, L = load_examples(path, "layout")
    check_layout(L)
    c0 = cost(L, L["start"])
    t.close("start cost = 8 900 load·m/day", c0, 8900, 1e-9)
    # hand check of one flow: Receiving (slot 1) -> Saw (slot 3): 30 loads * 2 slots * 20 m = 1200
    at = where(L["start"])
    t.equal("Receiving in slot 1, Saw / prep in slot 3", (at[0], at[1]), (1, 3))
    final, log = pairwise_exchange(L, L["start"])
    t.equal("pairwise exchange: 3 swaps", len(log), 3)
    t.close("final cost = 5 600", cost(L, final), 5600, 1e-9)
    t.true("every swap lowers the cost", all(log[k][5] < (log[k - 1][5] if k else c0) for k in range(len(log))))
    ok = True
    for i in range(len(final)):
        for j in range(i + 1, len(final)):
            lay = list(final)
            lay[i], lay[j] = lay[j], lay[i]
            ok &= cost(L, lay) >= cost(L, final) - 1e-9
    t.true("final layout: no single swap is better (local optimum)", ok)
    s0 = slp_score(L, L["start"])
    s1 = slp_score(L, final)
    t.equal("adjacent pairs in a 4 x 2 grid = 10", len(s0["pairs"]), 10)
    t.equal("SLP score start (hand count)", s0["score"], slp_hand(L, L["start"]))
    t.equal("SLP score improved (hand count)", s1["score"], slp_hand(L, final))
    sp = space_table(data["space"])
    t.close("Turning 4*(12+10)*1.3 = 114.4", sp["rows"][0]["area"], 114.4, 1e-9)
    t.close("Milling 3*30*1.3 = 117", sp["rows"][1]["area"], 117.0, 1e-9)
    t.close("Grinding 3*24*1.3 = 93.6", sp["rows"][2]["area"], 93.6, 1e-9)
    t.close("Heat treat 1*60*1.2 = 72", sp["rows"][3]["area"], 72.0, 1e-9)
    t.close("Assembly 6*16*1.4 = 134.4", sp["rows"][4]["area"], 134.4, 1e-9)
    t.close("net = 531.4 m2", sp["net"], 531.4, 1e-9)
    t.close("total = 531.4*1.25 = 664.25 m2", sp["total"], 664.25, 1e-9)
    ai = {n: w for n, _, w in aisles(data["aisle"])}
    t.close("forklift one-way 1.2 + 1.0 = 2.2 m", ai["Forklift, one-way"], 2.2, 1e-12)
    t.close("forklift two-way 2.4 + 1.5 = 3.9 m", ai["Forklift, two-way"], 3.9, 1e-12)
    t.close("AGV one-way 1.0 + 1.0 = 2.0 m", ai["AGV, one-way"], 2.0, 1e-12)
    t.close("AGV two-way 2.0 + 1.5 = 3.5 m", ai["AGV, two-way"], 3.5, 1e-12)
    t.close("AGV + people one-way 2.0 + 1.0 = 3.0 m", ai["AGV + people, one-way"], 3.0, 1e-12)
    t.close("AGV + people two-way 3.5 + 1.0 = 4.5 m", ai["AGV + people, two-way"], 4.5, 1e-12)
    try:
        check_perm([0, 0, 1, 2, 3, 4, 5, 6], 8)
        t.true("bad start layout -> InputError", False)
    except InputError:
        t.true("bad start layout -> InputError", True)
    return t.finish()


def slp_hand(L, lay):
    """Independent recount for the self-test: walk the grid neighbours (right and down) of every slot."""
    val = {"A": 16, "E": 8, "I": 4, "O": 2, "X": -64}
    rel = {}
    for a, b, r in L["rel"]:
        rel[(a, b)] = rel[(b, a)] = val[r]
    pos = {tuple(s): L["depts"][d] for s, d in zip(L["slots"], lay)}
    tot = 0
    for (x, y), name in pos.items():
        for nb in ((x + 1, y), (x, y + 1)):
            if nb in pos:
                tot += rel.get((name, pos[nb]), 0)
    return tot


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n  python tools/fmse/layout_plan.py              (cost + exchange, SLP, space, aisles)\n"
               "  python tools/fmse/layout_plan.py --craft --csv swaps.csv\n"
               "  python tools/fmse/layout_plan.py --craft --start 0,1,2,3,4,5,6,7\n"
               "  python tools/fmse/layout_plan.py --slp\n"
               "  python tools/fmse/layout_plan.py --space --aisle")
    ap.add_argument("--examples", default=str(ITEM4_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--craft", action="store_true", help="layout cost and pairwise exchange with iteration log")
    ap.add_argument("--slp", action="store_true", help="SLP closeness score of start and improved layout")
    ap.add_argument("--space", action="store_true", help="space requirement table")
    ap.add_argument("--aisle", action="store_true", help="aisle widths")
    ap.add_argument("--start", help="other start layout: department index per slot, e.g. 6,0,5,1,7,4,2,3")
    ap.add_argument("--csv", help="write the exchange log to this CSV file")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    data, L = load_examples(a.examples, "layout")
    check_layout(L)
    start = list(L["start"])
    if a.start:
        try:
            start = [int(x) for x in a.start.split(",") if x.strip()]
        except ValueError:
            raise InputError("--start must be a comma list of department indices")
        check_perm(start, len(L["depts"]))
    allp = not (a.craft or a.slp or a.space or a.aisle)
    blocks = []
    final = None
    if allp or a.craft or a.slp:
        final, _ = pairwise_exchange(L, start)
    if allp or a.craft:
        blocks.append(lambda: show_craft(L, start, a.csv))
    if allp or a.slp:
        blocks.append(lambda: show_slp(L, start, final))
    if allp or a.space:
        if "space" not in data:
            raise InputError("section 'space' is missing in the JSON")
        blocks.append(lambda: show_space(data["space"]))
    if allp or a.aisle:
        if "aisle" not in data:
            raise InputError("section 'aisle' is missing in the JSON")
        blocks.append(lambda: show_aisle(data["aisle"]))
    for k, b in enumerate(blocks):
        if k:
            print()
        b()
    return 0


if __name__ == "__main__":
    run_main(main)
