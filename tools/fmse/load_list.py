#!/usr/bin/env python3
"""Load list of an FMS cell: P, Q, S, cos phi, current, growth reserve, transformer size and loading,
short-circuit current of the plant transformer, motor rated / starting currents (item 7).

Python 3 standard library only, offline. Formulas = "_formulas" load_list / short_circuit / motor_current in
examples/item7_examples.json. Guide: docs/FMS system design/67_electrical_safety.md.

  per load   P_d = qty*P_kW*ku ; Q_d = P_d*tan(acos(cosphi))
  totals     P = sum P_d ; Q = sum Q_d ; S = ks*sqrt(P^2 + Q^2) [kVA] ; cosphi = P/sqrt(P^2 + Q^2)
             I = S*1000/(sqrt(3)*U) ; S_req = S*growth ; transformer = smallest standard size >= S_req ;
             loading = S/S_T   (the size a DEDICATED cell transformer would need)
  Ik3        the cell is fed from the PLANT transformer: Ik3 = S_plant*1000/(sqrt(3)*U*uk) [A]
             (infinite upstream network, cable impedance neglected) ; breaker Icu >= Ik3 ; panel SCCR >= Ik3
  motor      I_n = P*1000/(sqrt(3)*U*eta*cosphi) ; DOL start = k_start*I_n ; star-delta start = k_start*I_n/3

Own load list as CSV (';' separated, header line optional, '#' = comment):
  name;qty;P_kW;ku;cosphi
  HMC machining centre;3;38;0.6;0.85

Usage:
  python tools/fmse/load_list.py                         (JSON example = --example: load list, Ik3, motor)
  python tools/fmse/load_list.py --loads my_loads.csv --U 400 --ks 0.8 --growth 1.25
  python tools/fmse/load_list.py --md loadlist.md --csv loadlist.csv
  python tools/fmse/load_list.py ik3 --S 1000 --uk 0.06 --U 400
  python tools/fmse/load_list.py motor --P 7.5 --eta 0.9 --cosphi 0.82 --kstart 7
  python tools/fmse/load_list.py --json
  python tools/fmse/load_list.py --selftest

All values are EXAMPLES. A real design needs sign-off by a qualified electrical engineer with the current editions of
IEC 60364 / IEC 60204-1 / IEC 61439 and the manufacturers' data.
"""

import argparse
import csv
import json
import math
from pathlib import Path

from fmse_common import InputError, SelfTest, fmt_table, load_examples, run_main, write_csv

HERE = Path(__file__).resolve().parent
ITEM7_EXAMPLES = HERE / "examples" / "item7_examples.json"
NOTE = ("NOTE: all values are EXAMPLES for teaching. A real design needs sign-off by a qualified engineer using the "
        "current editions of the standards (IEC 60364, IEC 60204-1, IEC 61439) and the manufacturers' data.")


def pick(sizes, x):
    """Smallest standard size >= x (tiny tolerance against float noise); None if all are too small."""
    for s in sorted(sizes):
        if s >= x - 1e-9:
            return s
    return None


def _num(v, what, lo=None, hi=None, lo_open=False):
    try:
        x = float(v)
    except (TypeError, ValueError):
        raise InputError(f"{what} must be a number, got {v!r}")
    if lo is not None and (x < lo or (lo_open and x <= lo)):
        raise InputError(f"{what} must be {'>' if lo_open else '>='} {lo}, got {x}")
    if hi is not None and x > hi:
        raise InputError(f"{what} must be <= {hi}, got {x}")
    return x


def check_load(row, k):
    if not isinstance(row, (list, tuple)) or len(row) != 5:
        raise InputError(f"load {k}: {row!r} must be [name, qty, P_kW, ku, cosphi]")
    name, qty, p, ku, cp = row
    return [str(name), _num(qty, f"load {k} qty", 0), _num(p, f"load {k} P_kW", 0),
            _num(ku, f"load {k} ku", 0, 1), _num(cp, f"load {k} cosphi", 0, 1, lo_open=True)]


def read_loads_csv(path):
    p = Path(path)
    if not p.is_file():
        raise InputError(f"File not found: {p}")
    rows = []
    with p.open("r", encoding="utf-8-sig", newline="") as fh:
        for n, r in enumerate(csv.reader(fh, delimiter=";"), 1):
            if not r or not "".join(r).strip() or r[0].strip().startswith("#"):
                continue
            if n == 1 and r[0].strip().lower() == "name":
                continue
            if len(r) < 5:
                raise InputError(f"{p} line {n}: needs 5 fields name;qty;P_kW;ku;cosphi")
            rows.append(check_load([x.strip() for x in r[:5]], f"{p.name} line {n}"))
    if not rows:
        raise InputError(f"{p}: no loads found")
    return rows


def load_rows(loads):
    out = []
    for k, row in enumerate(loads, 1):
        name, qty, p, ku, cp = check_load(row, k)
        pd = qty * p * ku
        qd = pd * math.tan(math.acos(cp))
        out.append({"name": name, "qty": qty, "P_kW": p, "ku": ku, "cosphi": cp, "P_d": pd, "Q_d": qd,
                    "S_d": math.hypot(pd, qd)})
    return out


def totals(LL, loads=None):
    U = _num(LL["U"], "U", 0, lo_open=True)
    ks = _num(LL["ks"], "ks", 0, 1, lo_open=True)
    growth = _num(LL["growth"], "growth", 1)
    rows = load_rows(loads if loads is not None else LL["loads"])
    P = sum(r["P_d"] for r in rows)
    Q = sum(r["Q_d"] for r in rows)
    root = math.hypot(P, Q)
    S = ks * root
    cp = P / root if root > 0 else 0.0
    I = S * 1000 / (math.sqrt(3) * U)
    S_req = S * growth
    ST = pick(LL["transformer_sizes"], S_req)
    return {"rows": rows, "P": P, "Q": Q, "S": S, "cosphi": cp, "I": I, "S_req": S_req, "S_T": ST,
            "loading": S / ST if ST else None, "U": U, "ks": ks, "growth": growth}


def ik3(S_kVA, U, uk):
    S_kVA = _num(S_kVA, "S", 0, lo_open=True)
    U = _num(U, "U", 0, lo_open=True)
    uk = _num(uk, "uk", 0, 1, lo_open=True)
    return S_kVA * 1000 / (math.sqrt(3) * U * uk)


def motor(P_kW, U, eta, cosphi, k_start):
    P_kW = _num(P_kW, "P", 0, lo_open=True)
    U = _num(U, "U", 0, lo_open=True)
    eta = _num(eta, "eta", 0, 1, lo_open=True)
    cosphi = _num(cosphi, "cosphi", 0, 1, lo_open=True)
    k_start = _num(k_start, "k_start", 1)
    In = P_kW * 1000 / (math.sqrt(3) * U * eta * cosphi)
    return {"I_n": In, "I_dol": k_start * In, "I_star_delta": k_start * In / 3}


# ----------------------------------------------------------------------------- output
def table_rows(T):
    rows = [[r["name"], f"{r['qty']:g}", f"{r['P_kW']:g}", f"{r['ku']:g}", f"{r['cosphi']:g}", f"{r['P_d']:.3f}",
             f"{r['Q_d']:.3f}", f"{r['S_d']:.3f}"] for r in T["rows"]]
    rows.append(["TOTAL (before ks)", "", "", "", "", f"{T['P']:.3f}", f"{T['Q']:.3f}",
                 f"{math.hypot(T['P'], T['Q']):.3f}"])
    return rows


HEAD = ["load", "qty", "P kW", "ku", "cos phi", "P_d kW", "Q_d kvar", "S_d kVA"]


def summary_lines(T, LL):
    st = f"{T['S_T']} kVA" if T["S_T"] else "larger than the largest standard size - split the supply"
    L = [f"P = {T['P']:.3f} kW   Q = {T['Q']:.3f} kvar   cos phi = {T['cosphi']:.4f}",
         f"S = ks*sqrt(P^2+Q^2) = {T['ks']:g} * {math.hypot(T['P'], T['Q']):.3f} = {T['S']:.3f} kVA",
         f"I = S*1000/(sqrt(3)*U) = {T['I']:.2f} A at U = {T['U']:g} V",
         f"S_req = S*growth = {T['S']:.3f} * {T['growth']:g} = {T['S_req']:.2f} kVA -> dedicated transformer {st}"]
    if T["S_T"]:
        L.append(f"transformer loading = S/S_T = {T['loading']:.3f} ({T['loading'] * 100:.1f} %)")
    return L


def report(E, T):
    LL, M = E["load_list"], E["motor"]
    print("LOAD LIST  (P_d = qty*P*ku, Q_d = P_d*tan(acos(cos phi)))")
    print(fmt_table(HEAD, table_rows(T), "lrrrrrrr"))
    print()
    for line in summary_lines(T, LL):
        print("  " + line)
    print()
    i3 = ik3(LL["plant_transformer_kVA"], LL["U"], LL["uk"])
    print("SHORT-CIRCUIT CURRENT at the PLANT transformer (the cell is fed from it)")
    print(f"  Ik3 = S_plant*1000/(sqrt(3)*U*uk) = {LL['plant_transformer_kVA']:g}*1000/(sqrt(3)*{LL['U']:g}*"
          f"{LL['uk']:g}) = {i3:,.0f} A = {i3 / 1000:.2f} kA")
    print(f"  -> breakers Icu >= {i3 / 1000:.1f} kA, panel SCCR >= {i3 / 1000:.1f} kA "
          "(cable impedance neglected = safe side)")
    print()
    m = motor(M["P_kW"], M["U"], M["eta"], M["cosphi"], M["k_start"])
    print(f"MOTOR {M['P_kW']:g} kW, {M['U']:g} V, eta {M['eta']:g}, cos phi {M['cosphi']:g}, k_start {M['k_start']:g}")
    print(f"  I_n = {m['I_n']:.3f} A   DOL start = {m['I_dol']:.2f} A   star-delta start = {m['I_star_delta']:.2f} A")
    print()
    print(NOTE)


def markdown(T, LL):
    L = ["# Load list", "", "| " + " | ".join(HEAD) + " |", "|" + "---|" * len(HEAD)]
    L += ["| " + " | ".join(r) + " |" for r in table_rows(T)]
    L += [""] + ["- " + s for s in summary_lines(T, LL)] + ["", "_" + NOTE + "_"]
    return "\n".join(L) + "\n"


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("load_list")
    E, LL = load_examples(path, "load_list")
    T = totals(LL)
    t.equal("9 loads", len(T["rows"]), 9)
    t.close("HMC P_d = 3*38*0.6 = 68.4 kW", T["rows"][0]["P_d"], 68.4, 1e-9)
    t.close("HMC Q_d = 68.4*tan(acos 0.85) = 42.390", T["rows"][0]["Q_d"], 42.3904, 1e-3)
    t.close("P total 125.5 kW", T["P"], 125.5, 1e-9)
    t.close("Q total 72.105 kvar", T["Q"], 72.105, 1e-3)
    t.close("S 115.791 kVA", T["S"], 115.791, 1e-3)
    t.close("cos phi 0.8671", T["cosphi"], 0.8671, 1e-4)
    t.close("I 167.13 A", T["I"], 167.13, 0.01)
    t.close("S_req 144.74 kVA", T["S_req"], 144.74, 0.01)
    t.equal("dedicated transformer 250 kVA", T["S_T"], 250)
    t.close("loading 0.463", T["loading"], 0.463, 5e-4)
    t.close("Ik3 1000 kVA uk 6 % = 24 056 A", ik3(1000, 400, 0.06), 24056, 1)
    t.close("Ik3 630 kVA uk 4 % = 22 733 A", ik3(630, 400, 0.04), 22733.4, 0.5)
    m = motor(7.5, 400, 0.9, 0.82, 7.0)
    t.close("motor I_n 14.668 A", m["I_n"], 14.668, 1e-3)
    t.close("DOL start 102.68 A", m["I_dol"], 102.68, 0.01)
    t.close("star-delta start 34.23 A", m["I_star_delta"], 34.23, 0.01)
    t.close("star-delta = DOL/3", m["I_star_delta"] * 3, m["I_dol"], 1e-9)
    t.equal("pick 144.74 -> 250", pick([250, 400], 144.74), 250)
    t.equal("pick exactly 400 -> 400", pick([250, 400, 630], 400.0), 400)
    t.equal("pick 400.01 -> 630", pick([250, 400, 630], 400.01), 630)
    t.equal("pick above largest -> None", pick([250, 400], 401), None)
    one = totals({**LL, "loads": [["R", 1, 10, 1.0, 1.0]], "ks": 1.0})
    t.close("pure resistive 10 kW: Q 0, cos phi 1", one["Q"] + (1 - one["cosphi"]), 0, 1e-12)
    t.close("10 kVA at 400 V = 14.434 A", one["I"], 14.4338, 1e-4)
    big = totals({**LL, "loads": [["Big", 1, 2000, 1.0, 0.9]]})
    t.equal("load too big -> no standard transformer", big["S_T"], None)
    for bad, what in ((["x", 1, 5, 1.2, 0.9], "ku > 1"), (["x", 1, 5, 0.5, 0], "cos phi 0"),
                      (["x", 1, 5, 0.5], "4 fields")):
        try:
            load_rows([bad])
            t.true(f"bad load rejected ({what})", False)
        except InputError:
            t.true(f"bad load rejected ({what})", True)
    t.true("markdown has the TOTAL row and the note", "TOTAL" in markdown(T, LL) and "EXAMPLES" in markdown(T, LL))
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", default=str(ITEM7_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--example", action="store_true", help="run the JSON example (also the default)")
    ap.add_argument("--loads", help="own load list CSV name;qty;P_kW;ku;cosphi")
    ap.add_argument("--U", type=float, help="line voltage V (default from JSON)")
    ap.add_argument("--ks", type=float, help="simultaneity factor (default from JSON)")
    ap.add_argument("--growth", type=float, help="growth factor (default from JSON)")
    ap.add_argument("--md", help="write the load list as Markdown")
    ap.add_argument("--csv", help="write the load list as CSV")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    sub = ap.add_subparsers(dest="cmd")
    s = sub.add_parser("ik3", help="short-circuit current at a transformer secondary")
    s.add_argument("--S", type=float, required=True, help="transformer kVA")
    s.add_argument("--uk", type=float, default=0.06, help="short-circuit voltage (0.06 = 6 %%)")
    s.add_argument("--U", dest="U2", type=float, default=400, help="secondary line voltage V")
    s = sub.add_parser("motor", help="motor rated and starting currents")
    s.add_argument("--P", type=float, required=True, help="kW")
    s.add_argument("--U", dest="U2", type=float, default=400)
    s.add_argument("--eta", type=float, default=0.9)
    s.add_argument("--cosphi", type=float, default=0.82)
    s.add_argument("--kstart", type=float, default=7.0)
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    if a.cmd == "ik3":
        v = ik3(a.S, a.U2, a.uk)
        print(json.dumps({"Ik3_A": v}) if a.json else
              f"Ik3 = {a.S:g}*1000/(sqrt(3)*{a.U2:g}*{a.uk:g}) = {v:,.0f} A = {v / 1000:.2f} kA\n{NOTE}")
        return 0
    if a.cmd == "motor":
        m = motor(a.P, a.U2, a.eta, a.cosphi, a.kstart)
        print(json.dumps(m) if a.json else
              f"I_n = {m['I_n']:.3f} A   DOL = {m['I_dol']:.2f} A   star-delta = {m['I_star_delta']:.2f} A\n{NOTE}")
        return 0
    E, LL = load_examples(a.examples, "load_list")
    LL = dict(LL)
    for k in ("U", "ks", "growth"):
        if getattr(a, k) is not None:
            LL[k] = getattr(a, k)
    loads = read_loads_csv(a.loads) if a.loads else None
    T = totals(LL, loads)
    if a.json:
        M = E["motor"]
        out = {k: v for k, v in T.items()}
        out["Ik3_plant_A"] = ik3(LL["plant_transformer_kVA"], LL["U"], LL["uk"])
        out["motor"] = motor(M["P_kW"], M["U"], M["eta"], M["cosphi"], M["k_start"])
        out["note"] = NOTE
        print(json.dumps(out, indent=1, ensure_ascii=False))
        return 0
    report(E, T)
    if a.md:
        p = Path(a.md)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(markdown(T, LL), encoding="utf-8")
        print(f"\nMarkdown written: {p}")
    if a.csv:
        print(f"CSV written: {write_csv(a.csv, HEAD, table_rows(T))}")
    return 0


if __name__ == "__main__":
    run_main(main)
