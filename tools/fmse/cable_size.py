#!/usr/bin/env python3
"""Cable sizing of a feeder: required ampacity with correction factors, table choice, PE size, 3-phase voltage drop,
TN fault loop (Ik1, disconnection check, maximum length) and the 24 V two-wire line drop (item 7).

Python 3 standard library only, offline. Formulas = "_formulas" cable_size / voltage_drop_3ph / fault_loop / dc24_drop
in examples/item7_examples.json. Guide: docs/FMS system design/67_electrical_safety.md.

  sizing    required Iz = In/(k_temp*k_group) ; A = smallest table size with Iz_table >= required Iz ;
            conditions Ib <= In <= Iz_table*k_temp*k_group ;
            PE: A <= 16 -> A ; 16 < A <= 35 -> 16 ; A > 35 -> next table size >= A/2
  drop      dU = sqrt(3)*Ib*L*rho*cosphi/A [V] (reactance neglected) ; dU% = dU/U*100 ; limit 5 %
  loop      R_loop = L*rho*(1/A + 1/A_pe) ; Zs = Z_ext + R_loop ; Ik1 = U0/Zs ; Ia = m*In (B 5, C 10, D 20) ;
            OK if Ik1 >= Ia ; L_max = (U0/Ia - Z_ext)/(rho*(1/A + 1/A_pe))
  dc24      dU = 2*L*I*rho/A ; U_load = U_psu - dU ; OK if U_load >= U_min ; L_max = (U_psu - U_min)*A/(2*I*rho)

Usage:
  python tools/fmse/cable_size.py                                 (JSON feeder + 24 V line = --example)
  python tools/fmse/cable_size.py feeder --Ib 40 --In 50 --L 80 --curve C
  python tools/fmse/cable_size.py feeder --In 80 --A 50            (check a chosen cross-section)
  python tools/fmse/cable_size.py dc24 --L 25 --I 1.5 --A 0.75
  python tools/fmse/cable_size.py --json
  python tools/fmse/cable_size.py --selftest

All values are EXAMPLES; the ampacity table is an EXAMPLE table. A real design needs sign-off by a qualified electrical
engineer with the current editions of IEC 60364-5-52 / -5-54 / -4-41, IEC 60204-1 and the cable makers' data.
"""

import argparse
import json
import math
from pathlib import Path

from fmse_common import InputError, SelfTest, load_examples, run_main

HERE = Path(__file__).resolve().parent
ITEM7_EXAMPLES = HERE / "examples" / "item7_examples.json"
NOTE = ("NOTE: all values are EXAMPLES (the ampacity table too). A real design needs sign-off by a qualified engineer "
        "using the current editions of IEC 60364-5-52/-5-54/-4-41, IEC 60204-1 and the cable makers' data.")
CURVE_M = {"B": 5, "C": 10, "D": 20}
DU_LIMIT = 5.0


def _pos(x, what):
    if x is None or not isinstance(x, (int, float)) or x <= 0:
        raise InputError(f"{what} must be a number > 0, got {x!r}")
    return float(x)


def size_cable(C, A_force=None):
    """Return the sizing dict for case C (Ib, In, k_temp, k_group, ampacity_table)."""
    table = sorted((float(a), float(i)) for a, i in C["ampacity_table"])
    Ib, In = _pos(C["Ib"], "Ib"), _pos(C["In"], "In")
    kt, kg = _pos(C["k_temp"], "k_temp"), _pos(C["k_group"], "k_group")
    req = In / (kt * kg)
    if A_force is not None:
        hit = [r for r in table if abs(r[0] - A_force) < 1e-9]
        if not hit:
            raise InputError(f"cross-section {A_force:g} mm2 is not in the ampacity table")
        A, Iz = hit[0]
    else:
        ok = [r for r in table if r[1] >= req - 1e-9]
        if not ok:
            raise InputError(f"required Iz {req:.1f} A is above the largest table entry ({table[-1][1]:g} A) - "
                             "use parallel cables or a busbar")
        A, Iz = ok[0]
    Izc = Iz * kt * kg
    return {"req_Iz": req, "A": A, "Iz_table": Iz, "Iz_corr": Izc, "A_pe": pe_size(A, [a for a, _ in table]),
            "cond_Ib_In": Ib <= In, "cond_In_Iz": In <= Izc + 1e-9, "ok": Ib <= In <= Izc + 1e-9}


def pe_size(A, sizes):
    if A <= 16:
        return A
    if A <= 35:
        return 16.0
    for s in sorted(sizes):
        if s >= A / 2 - 1e-9:
            return float(s)
    return A / 2


def voltage_drop(Ib, L, rho, cosphi, A, U):
    du = math.sqrt(3) * Ib * L * rho * cosphi / A
    return du, du / U * 100


def fault_loop(C, A, A_pe):
    m = C.get("m") or CURVE_M.get(str(C.get("curve", "")).upper())
    if not m:
        raise InputError("fault loop: give the trip multiple m or curve B / C / D")
    L, rho = _pos(C["L"], "L"), _pos(C["rho"], "rho")
    U0, Zext = _pos(C["U0"], "U0"), float(C["Z_ext"])
    g = rho * (1 / A + 1 / A_pe)
    R = L * g
    Zs = Zext + R
    Ik1 = U0 / Zs
    Ia = m * C["In"]
    Lmax = (U0 / Ia - Zext) / g
    return {"m": m, "R_loop": R, "Zs": Zs, "Ik1": Ik1, "Ia": Ia, "ok": Ik1 >= Ia - 1e-9, "L_max": Lmax}


def dc24_line(U_psu, U_min, L, I, A, rho):
    for v, w in ((L, "L"), (I, "I"), (A, "A"), (rho, "rho")):
        _pos(v, w)
    du = 2 * L * I * rho / A
    UL = U_psu - du
    return {"dU": du, "U_load": UL, "ok": UL >= U_min - 1e-9, "L_max": (U_psu - U_min) * A / (2 * I * rho)}


def feeder(C, A_force=None):
    s = size_cable(C, A_force)
    du, dup = voltage_drop(C["Ib"], C["L"], C["rho"], C["cosphi"], s["A"], C["U"])
    fl = fault_loop(C, s["A"], s["A_pe"])
    return {**s, "dU": du, "dU_pct": dup, "dU_ok": dup <= DU_LIMIT, **{"loop": fl}}


# ----------------------------------------------------------------------------- output
def show_feeder(C, F):
    print(f"FEEDER  {C.get('_case', 'own case')}")
    print(f"  Ib {C['Ib']:g} A, breaker In {C['In']:g} A curve {C.get('curve', '-')}, L {C['L']:g} m, "
          f"rho {C['rho']:g} ohm mm2/m, k_temp {C['k_temp']:g}, k_group {C['k_group']:g}")
    print(f"  required Iz = In/(k_temp*k_group) = {C['In']:g}/({C['k_temp']:g}*{C['k_group']:g}) = {F['req_Iz']:.2f} A")
    print(f"  -> {F['A']:g} mm2: table Iz {F['Iz_table']:g} A, corrected {F['Iz_table']:g}*{C['k_temp']:g}*"
          f"{C['k_group']:g} = {F['Iz_corr']:.2f} A")
    print(f"  Ib {C['Ib']:g} <= In {C['In']:g} <= Iz {F['Iz_corr']:.2f} -> {'OK' if F['ok'] else 'NOT OK'}")
    print(f"  PE conductor {F['A_pe']:g} mm2")
    print(f"  voltage drop dU = sqrt(3)*Ib*L*rho*cosphi/A = {F['dU']:.3f} V = {F['dU_pct']:.3f} % "
          f"(limit {DU_LIMIT:g} %) -> {'OK' if F['dU_ok'] else 'TOO HIGH'}")
    fl = F["loop"]
    print(f"  fault loop: R_loop = {fl['R_loop']:.4f} ohm, Zs = {C['Z_ext']:g} + R = {fl['Zs']:.4f} ohm, "
          f"Ik1 = {C['U0']:g}/Zs = {fl['Ik1']:.1f} A")
    print(f"  Ia = m*In = {fl['m']:g}*{C['In']:g} = {fl['Ia']:g} A -> disconnection "
          f"{'OK (Ik1 >= Ia)' if fl['ok'] else 'NOT OK (Ik1 < Ia: bigger cable, RCD or other curve)'}")
    print(f"  maximum length for disconnection L_max = {fl['L_max']:.2f} m")


def show_dc(D, R):
    print(f"24 V LINE  {D.get('_case', 'own case')}")
    print(f"  dU = 2*L*I*rho/A = 2*{D['L']:g}*{D['I']:g}*{D['rho']:g}/{D['A']:g} = {R['dU']:.3f} V, "
          f"U_load = {R['U_load']:.3f} V (min {D['U_min']:g} V) -> {'OK' if R['ok'] else 'TOO LOW'}")
    print(f"  L_max = (U_psu - U_min)*A/(2*I*rho) = {R['L_max']:.2f} m")


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("cable_size")
    E, C = load_examples(path, "cable")
    F = feeder(C)
    t.close("required Iz 119.42 A", F["req_Iz"], 119.42, 0.005)
    t.equal("25 mm2 (119 A) is just too small -> 35 mm2", F["A"], 35.0)
    t.equal("table Iz 148 A", F["Iz_table"], 148.0)
    t.close("corrected Iz 99.15 A", F["Iz_corr"], 99.15, 0.005)
    t.true("Ib 65 <= In 80 <= 99.15", F["ok"])
    t.equal("PE 16 mm2", F["A_pe"], 16.0)
    t.close("dU 3.691 V", F["dU"], 3.691, 5e-4)
    t.close("dU 0.923 %", F["dU_pct"], 0.923, 5e-4)
    fl = F["loop"]
    t.close("R_loop 0.1229 ohm", fl["R_loop"], 0.1229, 5e-5)
    t.close("Zs 0.2729 ohm", fl["Zs"], 0.2729, 5e-5)
    t.close("Ik1 842.7 A", fl["Ik1"], 842.7, 0.05)
    t.equal("Ia = 10*80 = 800 A", fl["Ia"], 800)
    t.true("Ik1 >= Ia -> OK", fl["ok"])
    t.close("L_max 67.10 m", fl["L_max"], 67.10, 0.005)
    fl2 = fault_loop({**C, "L": 70}, 35, 16)
    t.true("at 70 m (> L_max) disconnection NOT OK", not fl2["ok"])
    fl3 = fault_loop({**C, "L": fl["L_max"]}, 35, 16)
    t.close("at L = L_max: Ik1 = Ia exactly", fl3["Ik1"], 800, 1e-6)
    t.equal("curve B -> m 5", fault_loop({**C, "m": None, "curve": "B"}, 35, 16)["m"], 5)
    t.equal("curve D -> m 20", fault_loop({**C, "m": None, "curve": "D"}, 35, 16)["m"], 20)
    sizes = [a for a, _ in C["ampacity_table"]]
    t.equal("PE rule 10 -> 10, 25 -> 16, 50 -> 25, 70 -> 35, 95 -> 50, 120 -> 70",
            [pe_size(a, sizes) for a in (10, 25, 50, 70, 95, 120)], [10, 16, 25, 35, 50, 70])
    t.equal("exact table value: required 119 A -> 25 mm2",
            size_cable({**C, "In": 119, "k_temp": 1, "k_group": 1})["A"], 25.0)
    try:
        size_cable({**C, "In": 400})
        t.true("In 400 A -> above table -> error", False)
    except InputError:
        t.true("In 400 A -> above table -> error", True)
    forced = feeder(C, 25)
    t.true("forced 25 mm2: In 80 > Iz 79.7 -> NOT OK", not forced["ok"] and abs(forced["Iz_corr"] - 79.7177) < 1e-3)
    D = dict(E["dc24"]["line"], U_psu=E["dc24"]["U_psu"], U_min=E["dc24"]["U_min"])
    R = dc24_line(D["U_psu"], D["U_min"], D["L"], D["I"], D["A"], D["rho"])
    t.close("24 V line dU 0.712 V", R["dU"], 0.712, 1e-6)
    t.close("U_load 23.288 V", R["U_load"], 23.288, 1e-6)
    t.true("U_load >= 21.6 -> OK", R["ok"])
    t.close("L_max 50.56 m", R["L_max"], 50.56, 0.005)
    t.true("at 60 m the 24 V line is too long", not dc24_line(24, 21.6, 60, 2, 1.5, 0.0178)["ok"])
    t.close("0.75 mm2, 25 m, 1.5 A: dU 1.78 V", dc24_line(24, 21.6, 25, 1.5, 0.75, 0.0178)["dU"], 1.78, 1e-9)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", default=str(ITEM7_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--example", action="store_true", help="run the JSON example (also the default)")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    sub = ap.add_subparsers(dest="cmd")
    s = sub.add_parser("feeder", help="size / check a 3-phase feeder (missing values from the JSON case)")
    for k, h in (("Ib", "design current A"), ("In", "breaker rated current A"), ("L", "length m"),
                 ("cosphi", "cos phi"), ("U", "line voltage V"), ("U0", "phase voltage V"),
                 ("rho", "resistivity ohm mm2/m (0.0225 Cu at operating temp.)"), ("Z_ext", "external loop ohm"),
                 ("k_temp", "ambient factor"), ("k_group", "grouping factor"), ("m", "magnetic trip multiple"),
                 ("A", "check this cross-section mm2 instead of choosing")):
        s.add_argument("--" + k, type=float, help=h)
    s.add_argument("--curve", choices=["B", "C", "D"], help="breaker curve (sets m = 5 / 10 / 20)")
    s = sub.add_parser("dc24", help="24 V two-wire line drop")
    for k, h in (("L", "one-way length m"), ("I", "current A"), ("A", "cross-section mm2"),
                 ("rho", "ohm mm2/m (0.0178 Cu)"), ("U_psu", "PSU voltage V"), ("U_min", "minimum load voltage V")):
        s.add_argument("--" + k, type=float, help=h)
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    E, C = load_examples(a.examples, "cable")
    C = dict(C)
    D = dict(E["dc24"]["line"], U_psu=E["dc24"]["U_psu"], U_min=E["dc24"]["U_min"])
    A_force = None
    if a.cmd == "feeder":
        C["_case"] = "own case (missing values from the JSON example)"
        if a.curve:
            C["curve"], C["m"] = a.curve, CURVE_M[a.curve]
        for k in ("Ib", "In", "L", "cosphi", "U", "U0", "rho", "Z_ext", "k_temp", "k_group", "m"):
            if getattr(a, k) is not None:
                C[k] = getattr(a, k)
        A_force = a.A
    if a.cmd == "dc24":
        D["_case"] = "own case (missing values from the JSON example)"
        for k in ("L", "I", "A", "rho", "U_psu", "U_min"):
            if getattr(a, k) is not None:
                D[k] = getattr(a, k)
    out = {}
    if a.cmd in (None, "feeder"):
        out["feeder"] = feeder(C, A_force)
    if a.cmd in (None, "dc24"):
        out["dc24"] = dc24_line(D["U_psu"], D["U_min"], D["L"], D["I"], D["A"], D["rho"])
    if a.json:
        out["note"] = NOTE
        print(json.dumps(out, indent=1, ensure_ascii=False))
        return 0
    if "feeder" in out:
        show_feeder(C, out["feeder"])
        print()
    if "dc24" in out:
        show_dc(D, out["dc24"])
        print()
    print(NOTE)
    return 0


if __name__ == "__main__":
    run_main(main)
