#!/usr/bin/env python3
"""Production flow analysis (PFA): find machine cells and part families in a part-machine matrix.

Python 3 standard library only, offline. Formulas = "_formulas" in examples/item2_examples.json.

Step 1  King's rank order clustering (ROC, King 1980)
        Read every row as a binary number (leftmost column = highest bit) and sort the rows
        descending (stable). Then read every column as a binary number (top row = highest bit)
        and sort the columns descending. Repeat until nothing changes (max 20 iterations).
        Blocks of 1s appear on the diagonal.
Step 2  Jaccard similarity of two machines j, k
        s_jk = a / (a + b + c)
        a = parts that use j AND k,  b + c = parts that use only one of the two.
Step 3  Single linkage clustering (SLCA) at threshold T
        Join machines j and k when s_jk >= T (and s_jk > 0). Cells = connected groups.
        Cells are numbered in the order of their first machine in the input.
        Each part goes to the cell where it has most operations (tie -> lowest cell number).
Step 4  Quality of the block-diagonal solution
        e            = number of 1s in the matrix (operations)
        exceptional  = 1s outside the blocks (part needs a machine of another cell)
        void         = 0s inside the blocks (a cell machine the part does not use)
        efficacy     Gamma = (e - exceptional) / (e + voids)
        efficiency   eta   = q*eta1 + (1-q)*eta2,  q = 0.5
                     eta1 = 1s inside the blocks / cells inside the blocks
                     eta2 = 0s outside the blocks / cells outside the blocks

Matrix CSV format (--matrix): first row = machine names (the first cell is ignored),
first column = part names, then 0 / 1. Separator ',' or ';'. Empty cell = 0.
    part;LATHE;HMC;DRILL
    P01;0;1;1
    P02;1;0;0
"""

import argparse
import csv
from pathlib import Path

from fmse_common import (ITEM2_EXAMPLES, InputError, SelfTest, fmt_table, load_examples, run_main,
                         write_csv)


# ----------------------------------------------------------------------------- input
def read_matrix_csv(path):
    """Read a part-machine CSV. Returns (machines, parts, m) with m[i][j] in {0, 1}."""
    p = Path(path)
    if not p.is_file():
        raise InputError(f"File not found: {p}")
    text = p.read_text(encoding="utf-8-sig")
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if len(lines) < 2:
        raise InputError(f"{p}: need a header row and at least one part row")
    delim = ";" if lines[0].count(";") >= lines[0].count(",") else ","
    rows = list(csv.reader(lines, delimiter=delim))
    machines = [c.strip() for c in rows[0][1:]]
    while machines and not machines[-1]:
        machines.pop()
    if not machines:
        raise InputError(f"{p}: the first row must list the machine names")
    parts, m = [], []
    for ln, r in enumerate(rows[1:], 2):
        if not r or not r[0].strip():
            raise InputError(f"{p} line {ln}: first column must be the part name")
        vals = []
        for j in range(len(machines)):
            c = r[j + 1].strip() if j + 1 < len(r) else ""
            if c in ("", "0"):
                vals.append(0)
            elif c in ("1", "x", "X"):
                vals.append(1)
            else:
                raise InputError(f"{p} line {ln}, machine {machines[j]}: '{c}' is not 0 or 1")
        parts.append(r[0].strip())
        m.append(vals)
    return machines, parts, m


def check_matrix(machines, parts, m):
    if len(m) != len(parts) or any(len(r) != len(machines) for r in m):
        raise InputError("pfa: matrix size does not match the machine / part lists")
    if any(v not in (0, 1) for r in m for v in r):
        raise InputError("pfa: matrix values must be 0 or 1")


# ----------------------------------------------------------------------------- step 1 ROC
def roc(m, max_iter=20):
    """King's rank order clustering. Returns (row_order, col_order, log, converged)."""
    n, k = len(m), len(m[0]) if m else 0
    rows, cols = list(range(n)), list(range(k))
    log = []
    for it in range(1, max_iter + 1):
        before = (rows[:], cols[:])
        rw = {i: sum(m[i][j] << (k - 1 - pos) for pos, j in enumerate(cols)) for i in rows}
        rows = sorted(rows, key=lambda i: -rw[i])
        cw = {j: sum(m[i][j] << (n - 1 - pos) for pos, i in enumerate(rows)) for j in cols}
        cols = sorted(cols, key=lambda j: -cw[j])
        changed = (rows, cols) != before
        log.append({"iter": it, "row_weights": rw, "col_weights": cw, "rows": rows[:], "cols": cols[:],
                    "changed": changed})
        if not changed:
            return rows, cols, log, True
    return rows, cols, log, False


# ----------------------------------------------------------------------------- step 2/3 cells
def jaccard_matrix(m):
    """s[j][k] Jaccard similarity between machine columns (diagonal = 1)."""
    k = len(m[0])
    s = [[1.0] * k for _ in range(k)]
    for a in range(k):
        for b in range(a + 1, k):
            both = sum(1 for r in m if r[a] and r[b])
            one = sum(1 for r in m if r[a] != r[b])
            v = both / (both + one) if both + one else 0.0
            s[a][b] = s[b][a] = v
    return s


def cells_at(m, T, s=None):
    """Single linkage at threshold T. Returns dict with machine cell, part cell and measures."""
    n, k = len(m), len(m[0])
    s = s or jaccard_matrix(m)
    parent = list(range(k))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for a in range(k):
        for b in range(a + 1, k):
            if s[a][b] >= T - 1e-12 and s[a][b] > 0:
                ra, rb = find(a), find(b)
                if ra != rb:
                    parent[max(ra, rb)] = min(ra, rb)
    roots = []
    for j in range(k):
        r = find(j)
        if r not in roots:
            roots.append(r)
    mc = [roots.index(find(j)) for j in range(k)]
    nc = len(roots)
    pc = []
    for i in range(n):
        cnt = [sum(1 for j in range(k) if m[i][j] and mc[j] == c) for c in range(nc)]
        best = max(cnt) if cnt else 0
        pc.append(cnt.index(best) if best > 0 else -1)      # -1: part without operations
    e = exc = voids = inside = 0
    exc_list, void_list = [], []
    for i in range(n):
        for j in range(k):
            inb = pc[i] >= 0 and mc[j] == pc[i]
            inside += inb
            if m[i][j]:
                e += 1
                if not inb:
                    exc += 1
                    exc_list.append((i, j))
            elif inb:
                voids += 1
                void_list.append((i, j))
    outside = n * k - inside
    ones_in = e - exc
    zeros_out = outside - exc
    eta1 = ones_in / inside if inside else 0.0
    eta2 = zeros_out / outside if outside else 1.0
    gamma = (e - exc) / (e + voids) if e + voids else 0.0
    return {"T": T, "mc": mc, "pc": pc, "cells": nc, "e": e, "exc": exc, "voids": voids,
            "exc_list": exc_list, "void_list": void_list, "inside": inside, "outside": outside,
            "eta1": eta1, "eta2": eta2, "eta": 0.5 * eta1 + 0.5 * eta2, "gamma": gamma}


def sweep(m, Ts=None):
    s = jaccard_matrix(m)
    Ts = Ts or [round(0.05 * x, 2) for x in range(1, 20)]
    return [cells_at(m, T, s) for T in Ts]


# ----------------------------------------------------------------------------- report
def short(name, w=6):
    return name if len(name) <= w else name[:w]


def print_matrix(machines, parts, m, rows, cols, mark=None, pc=None, mc=None):
    """Print the matrix in the given row/column order. mark(i,j) returns a 1-char symbol or None."""
    wp = max(len(parts[i]) for i in rows)
    cw = max(5, max(len(short(machines[j])) for j in cols))
    head = " " * (wp + 6) + " ".join(short(machines[j]).rjust(cw) for j in cols)
    print(head)
    if mc is not None:
        print(" " * (wp + 6) + " ".join(f"c{mc[j]+1}".rjust(cw) for j in cols))
    for i in rows:
        cells = []
        for j in cols:
            sym = mark(i, j) if mark else ("1" if m[i][j] else ".")
            cells.append(sym.rjust(cw))
        tag = f"c{pc[i]+1}" if pc is not None and pc[i] >= 0 else ("--" if pc is not None else "  ")
        print(f"  {parts[i].ljust(wp)} {tag:>3} " + " ".join(cells))


def report(machines, parts, m, T, csv_path=None):
    n, k = len(parts), len(machines)
    print(f"PRODUCTION FLOW ANALYSIS   {n} parts x {k} machines   threshold T = {T:.2f}")
    print()
    print("Input matrix (1 = the part visits the machine):")
    print_matrix(machines, parts, m, list(range(n)), list(range(k)))

    # ---- ROC
    rows, cols, log, ok = roc(m)
    print()
    print("STEP 1  King's rank order clustering (rows/columns read as binary numbers)")
    for L in log:
        rw = ", ".join(f"{short(parts[i], 3)}={L['row_weights'][i]}" for i in L["rows"])
        cwt = ", ".join(f"{short(machines[j], 5)}={L['col_weights'][j]}" for j in L["cols"])
        print(f"  iteration {L['iter']}: row weights {rw}")
        print(f"               column weights {cwt}")
        print(f"               {'changed' if L['changed'] else 'no change -> converged'}")
    if not ok:
        print("  WARNING: not converged after 20 iterations - result is the last order")
    print("  ROC order:")
    print_matrix(machines, parts, m, rows, cols)

    # ---- Jaccard
    s = jaccard_matrix(m)
    print()
    print("STEP 2  Jaccard similarity s_jk = a/(a+b+c) between machines")
    print(fmt_table([""] + [short(x) for x in machines],
                    [[short(machines[a])] + [("  -  " if a == b else f"{s[a][b]:.3f}") for b in range(k)]
                     for a in range(k)]))

    # ---- cells
    r = cells_at(m, T, s)
    print()
    print(f"STEP 3  Single linkage at T = {T:.2f}: join machines with s_jk >= T")
    for c in range(r["cells"]):
        ms = [machines[j] for j in range(k) if r["mc"][j] == c]
        ps = [parts[i] for i in range(n) if r["pc"][i] == c]
        print(f"  Cell {c+1}: machines {', '.join(ms)}")
        print(f"          parts    {', '.join(ps) if ps else '(none)'}")
    no_op = [parts[i] for i in range(n) if r["pc"][i] < 0]
    if no_op:
        print(f"  Parts without any operation: {', '.join(no_op)}")

    # ---- block-ordered matrix
    brows = sorted(range(n), key=lambda i: (r["pc"][i] if r["pc"][i] >= 0 else 999, rows.index(i)))
    bcols = sorted(range(k), key=lambda j: (r["mc"][j], cols.index(j)))

    def mark(i, j):
        inb = r["pc"][i] >= 0 and r["mc"][j] == r["pc"][i]
        if m[i][j]:
            return "1" if inb else "X"
        return "o" if inb else "."

    print()
    print("STEP 4  Block-ordered matrix   1 = in block   X = exceptional element   o = void   . = empty")
    print_matrix(machines, parts, m, brows, bcols, mark, r["pc"], r["mc"])
    print()
    print(f"  operations e        = {r['e']}")
    print(f"  exceptional         = {r['exc']}" +
          (f"   ({', '.join(f'{parts[i]} -> {machines[j]}' for i, j in r['exc_list'])})" if r["exc_list"] else ""))
    print(f"  voids               = {r['voids']}" +
          (f"   ({', '.join(f'{parts[i]} / {machines[j]}' for i, j in r['void_list'])})" if r["void_list"] else ""))
    print(f"  efficacy  Gamma     = (e - exc)/(e + voids) = ({r['e']} - {r['exc']})/({r['e']} + {r['voids']}) "
          f"= {r['gamma']*100:.1f} %")
    print(f"  efficiency eta1     = 1s inside / cells inside  = {r['e']-r['exc']}/{r['inside']} = {r['eta1']*100:.1f} %")
    print(f"             eta2     = 0s outside / cells outside = {r['outside']-r['exc']}/{r['outside']} = {r['eta2']*100:.1f} %")
    print(f"             eta      = 0.5*eta1 + 0.5*eta2 = {r['eta']*100:.1f} %")
    print("  Good result: Gamma >= 70-80 %. For each exceptional element: second machine in the cell,")
    print("  accept the inter-cell move, change design / process, or buy the operation outside.")

    # ---- sweep
    print()
    print("Threshold sweep (higher T -> more, smaller cells, more exceptional elements):")
    sw = sweep(m)
    print(fmt_table(["T", "cells", "exceptional", "voids", "Gamma %", "eta %"],
                    [[f"{x['T']:.2f}", x["cells"], x["exc"], x["voids"], f"{x['gamma']*100:.1f}",
                      f"{x['eta']*100:.1f}"] for x in sw]))
    if csv_path:
        out = [["part", "cell"] + [machines[j] for j in bcols]]
        for i in brows:
            out.append([parts[i], r["pc"][i] + 1 if r["pc"][i] >= 0 else ""] + [mark(i, j) for j in bcols])
        p = write_csv(csv_path, out[0], out[1:])
        print(f"\nCSV written (block-ordered matrix, X = exceptional, o = void): {p}")


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    """Hand-checked: columns, Jaccard values, ROC fixpoint after 2 iterations, cells at T = 0.30."""
    t = SelfTest("pfa_cells")
    _, d = load_examples(path, "pfa")
    M, P, m = d["machines"], d["parts"], d["m"]
    check_matrix(M, P, m)
    s = jaccard_matrix(m)
    ix = {x: j for j, x in enumerate(M)}
    t.close("s(LATHE,SAW) = 3/3", s[ix["LATHE"]][ix["SAW"]], 1.0, 1e-12)
    t.close("s(LATHE,GRIND) = 2/4", s[ix["LATHE"]][ix["GRIND"]], 0.5, 1e-12)
    t.close("s(HMC,DRILL) = 3/5", s[ix["HMC"]][ix["DRILL"]], 0.6, 1e-12)
    t.close("s(HONE,DRILL) = 1/6", s[ix["HONE"]][ix["DRILL"]], 1 / 6, 1e-12)
    rows, cols, log, ok = roc(m)
    t.true("ROC converged", ok)
    t.equal("ROC iterations (2nd shows no change)", len(log), 2)
    t.equal("ROC row order", [P[i][:3] for i in rows], ["P02", "P05", "P08", "P07", "P01", "P04", "P10", "P03", "P06", "P09"])
    t.equal("ROC column order", [M[j] for j in cols], ["LATHE", "SAW", "GRIND", "HMC", "WASH", "DRILL", "HONE", "VMC"])
    t.equal("row weight P02 in iteration 1 (10001010b)", log[0]["row_weights"][1], 138)
    r = cells_at(m, 0.30, s)
    t.equal("cells at T = 0.30", r["cells"], 3)
    t.equal("cell of GRIND = cell of LATHE", r["mc"][ix["GRIND"]], r["mc"][ix["LATHE"]])
    t.equal("e", r["e"], 27)
    t.equal("exceptional", r["exc"], 2)
    t.equal("exceptional list", sorted((P[i][:3], M[j]) for i, j in r["exc_list"]), [("P03", "DRILL"), ("P07", "GRIND")])
    t.equal("voids", r["voids"], 2)
    t.close("Gamma = 25/29", r["gamma"], 25 / 29, 1e-12)
    t.close("eta1 = 25/27", r["eta1"], 25 / 27, 1e-12)
    t.close("eta2 = 51/53", r["eta2"], 51 / 53, 1e-12)
    t.close("eta", r["eta"], 0.5 * 25 / 27 + 0.5 * 51 / 53, 1e-12)
    t.equal("cells at T = 0.05 (all linked)", cells_at(m, 0.05)["cells"], 1)
    t.close("Gamma at T = 0.05 = 27/80", cells_at(m, 0.05)["gamma"], 27 / 80, 1e-12)
    t.equal("cells at T = 0.55 (GRIND alone)", cells_at(m, 0.55)["cells"], 4)
    t.equal("cells at T = 0.65 (DRILL alone too)", cells_at(m, 0.65)["cells"], 5)
    t.equal("sweep has 19 rows", len(sweep(m)), 19)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n  python tools/fmse/pfa_cells.py\n"
               "  python tools/fmse/pfa_cells.py --matrix my_matrix.csv --T 0.4 --csv cells.csv")
    ap.add_argument("--examples", default=str(ITEM2_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--matrix", help="part-machine CSV instead of the JSON example")
    ap.add_argument("--T", type=float, help="similarity threshold 0..1 (default: JSON value, else 0.30)")
    ap.add_argument("--csv", help="write the block-ordered matrix to this CSV file")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    T = a.T
    if a.matrix:
        M, P, m = read_matrix_csv(a.matrix)
    else:
        _, d = load_examples(a.examples, "pfa")
        M, P, m = d["machines"], d["parts"], d["m"]
        T = T if T is not None else d.get("T", 0.30)
    T = 0.30 if T is None else T
    if not 0 <= T <= 1:
        raise InputError("--T must be between 0 and 1")
    check_matrix(M, P, m)
    report(M, P, m, T, a.csv)
    return 0


if __name__ == "__main__":
    run_main(main)
