#!/usr/bin/env python3
"""AGV fleet size + battery / charging check (item 3, element "AGV / AMR").

Python 3 standard library only, offline.
Part 1 - fleet size, exactly the web calculator "agv" (web/fmse3.js, also element_sizing.py agv):
  t_order = (loaded + empty distance)/v + transfer ;  work = orders/h * t_order/3600 [vehicle-hours per hour]
  vehicles = ceil(work/(availability * traffic factor))
Part 2 - battery, "_formulas.agv_battery" in examples/item3_examples.json (inputs per vehicle):
  E_trip  = (P_drive*t_drive + P_lift*t_lift)/3.6                      [Wh, P in kW, t in s]
  busy    = trips_per_h*(t_drive + t_lift + t_other)                    [s per hour]
  E_h     = trips_per_h*E_trip + P_idle*1000*(3600 - busy)/3600         [Wh per working hour]
  usable  = V*Ah*DoD ; runtime = usable/E_h ; charge = usable/(P_charge*1000*eta_charge)   [h]
  availability without opportunity charging = runtime/(runtime + charge)   (charging stops the vehicle)
  opportunity charging: charge hours per working hour = E_h/(P_charge*1000*eta_charge)
Part 3 - what the battery means for the fleet: the fleet is sized again with the battery availability
  instead of the assumed availability (web default 0.85):
  a) no opportunity charging: availability = runtime/(runtime + charge)
  b) opportunity charging at the idle positions: the charging time per hour fits into the idle time
     (1 - busy/3600) -> availability 1 (from charging); if not, availability = 1 - (charge share - idle share)
  extra vehicles = vehicles(battery) - vehicles(assumed availability)
"""

import argparse
import math

from fmse_common import ITEM3_EXAMPLES, InputError, SelfTest, fmt_table, fmt_web, load_examples, run_main
from element_sizing import CALC, compute

BATT_KEYS = ["V", "Ah", "DoD", "P_drive_kW", "t_drive_s", "P_lift_kW", "t_lift_s", "t_other_s", "trips_per_h",
             "P_idle_kW", "P_charge_kW", "eta_charge"]
AGV_KEYS = [k for k, _, _, _ in CALC["agv"][1]]


def battery(b):
    """Battery figures per vehicle (JSON formula agv_battery)."""
    for k in BATT_KEYS:
        if k not in b:
            raise InputError(f"agv_battery: value '{k}' is missing")
        if b[k] < 0:
            raise InputError(f"agv_battery: '{k}' must be >= 0")
    for k in ("V", "Ah", "DoD", "P_charge_kW", "eta_charge"):
        if b[k] <= 0:
            raise InputError(f"agv_battery: '{k}' must be > 0")
    e_trip = (b["P_drive_kW"] * b["t_drive_s"] + b["P_lift_kW"] * b["t_lift_s"]) / 3.6
    t_trip = b["t_drive_s"] + b["t_lift_s"] + b["t_other_s"]
    busy = b["trips_per_h"] * t_trip
    if busy > 3600:
        raise InputError(f"busy time {busy:g} s per hour > 3600 s: too many trips per vehicle")
    e_h = b["trips_per_h"] * e_trip + b["P_idle_kW"] * 1000 * (3600 - busy) / 3600
    if e_h <= 0:
        raise InputError("energy per hour is 0 - check the powers")
    usable = b["V"] * b["Ah"] * b["DoD"]
    runtime = usable / e_h
    p_in = b["P_charge_kW"] * 1000 * b["eta_charge"]
    charge = usable / p_in
    avail = runtime / (runtime + charge)
    share = e_h / p_in
    idle = 1 - busy / 3600
    avail_opp = 1.0 if share <= idle else 1 - (share - idle)
    return {"e_trip": e_trip, "t_trip": t_trip, "busy": busy, "e_h": e_h, "usable": usable, "runtime": runtime,
            "charge": charge, "avail": avail, "share": share, "idle": idle, "avail_opp": max(avail_opp, 0.0)}


def fleet_with(agv, availability):
    """Vehicles with another availability (same formula as the web calculator)."""
    if availability <= 0:
        return math.inf
    v = dict(agv)
    v["eta"] = availability
    return compute("agv", v)[1][2][1]


def analyse(agv_over, batt):
    v, out, verdict = compute("agv", agv_over)
    b = battery(batt)
    n0 = out[2][1]
    n_a = fleet_with(v, b["avail"])
    n_b = fleet_with(v, b["avail_opp"])
    return {"v": v, "out": out, "verdict": verdict, "b": b, "n0": n0, "n_a": n_a, "n_b": n_b}


def show(r, batt):
    v, b, out = r["v"], r["b"], r["out"]
    print("PART 1 - FLEET SIZE (same as the web calculator 'agv')")
    print(fmt_table(["input", "key", "value", "unit"], [[lab, k, f"{v[k]:g}", u] for k, lab, _, u in CALC["agv"][1]], "llrl"))
    print(fmt_table(["result (formula)", "value", "with numbers"],
                    [[o[0], f"{fmt_web(o[1], o[3])} {o[2]}".rstrip(), o[4]] for o in out], "lrl"))
    print(f"Verdict: {r['verdict']}")
    print()
    print("PART 2 - BATTERY PER VEHICLE (JSON agv_battery)")
    print("  " + ", ".join(f"{k} {batt[k]:g}" for k in BATT_KEYS))
    rows = [
        ["energy per trip E_trip", f"({batt['P_drive_kW']:g}·{batt['t_drive_s']:g} + {batt['P_lift_kW']:g}·{batt['t_lift_s']:g})/3.6",
         f"{b['e_trip']:.2f} Wh"],
        ["busy time per hour", f"{batt['trips_per_h']:g}·({batt['t_drive_s']:g} + {batt['t_lift_s']:g} + {batt['t_other_s']:g})",
         f"{b['busy']:.0f} s ({100 * b['busy'] / 3600:.1f} %)"],
        ["energy per working hour E_h", f"{batt['trips_per_h']:g}·{b['e_trip']:.2f} + {batt['P_idle_kW']:g}·1000·(3600 − {b['busy']:.0f})/3600",
         f"{b['e_h']:.2f} Wh"],
        ["usable battery energy", f"{batt['V']:g} V·{batt['Ah']:g} Ah·{batt['DoD']:g}", f"{b['usable']:.0f} Wh"],
        ["runtime per charge", f"{b['usable']:.0f}/{b['e_h']:.2f}", f"{b['runtime']:.2f} h"],
        ["charge time (full usable)", f"{b['usable']:.0f}/({batt['P_charge_kW']:g}·1000·{batt['eta_charge']:g})", f"{b['charge']:.3f} h"],
        ["availability, no opportunity charging", f"{b['runtime']:.3f}/({b['runtime']:.3f} + {b['charge']:.3f})",
         f"{100 * b['avail']:.1f} %"],
        ["opportunity charging: charge h per working h", f"{b['e_h']:.2f}/({batt['P_charge_kW']:g}·1000·{batt['eta_charge']:g})",
         f"{b['share']:.3f} h/h ({60 * b['share']:.1f} min/h)"],
        ["idle time per hour (could charge)", f"1 − {b['busy']:.0f}/3600", f"{b['idle']:.3f} h/h ({60 * b['idle']:.1f} min/h)"],
    ]
    print(fmt_table(["quantity", "formula with numbers", "result"], rows, "llr"))
    fits = b["share"] <= b["idle"]
    print(f"  Opportunity charging {'fits into' if fits else 'does NOT fit into'} the idle time "
          f"({60 * b['share']:.1f} min needed, {60 * b['idle']:.1f} min idle per hour)"
          + ("" if fits else f" -> availability {100 * b['avail_opp']:.1f} %"))
    print()
    print("PART 3 - EFFECT ON THE FLEET")
    w = out[1][1]
    rows = [["assumed availability (web input)", f"{v['eta']:g}", f"⌈{w:.4f}/({v['eta']:g}·{v['ft']:g})⌉", r["n0"], "-"],
            ["battery, no opportunity charging", f"{b['avail']:.4f}", f"⌈{w:.4f}/({b['avail']:.4f}·{v['ft']:g})⌉", r["n_a"],
             f"{r['n_a'] - r['n0']:+d}"],
            ["battery, opportunity charging", f"{b['avail_opp']:.4f}", f"⌈{w:.4f}/({b['avail_opp']:.4f}·{v['ft']:g})⌉", r["n_b"],
             f"{r['n_b'] - r['n0']:+d}"]]
    print(fmt_table(["case", "availability", "vehicles = ⌈work/(avail·traffic)⌉", "vehicles", "extra"], rows, "lrlrr"))
    extra = r["n_a"] - r["n0"]
    print(f"  Extra vehicles needed because of charging: {max(extra, 0)} without opportunity charging, "
          f"{max(r['n_b'] - r['n0'], 0)} with opportunity charging (plus 1 reserve if a stop stops production).")
    # consistency of the two input sets
    tpv = v["tr"] / r["n0"] if r["n0"] else float("nan")
    t_order = out[0][1]
    print(f"  Check: fleet gives {v['tr']:g}/{r['n0']} = {tpv:.2f} orders per vehicle and hour, battery input uses "
          f"{batt['trips_per_h']:g}; time per order {t_order:.0f} s vs battery trip {b['t_trip']:.0f} s"
          + ("" if abs(tpv - batt["trips_per_h"]) < 1e-9 and abs(t_order - b["t_trip"]) < 1e-9
             else " - the two input sets differ, align them (--trips_per_h, --t_drive_s ...)."))


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("agv_fleet")
    _, batt = load_examples(path, "agv_battery")
    r = analyse({}, batt)
    b = r["b"]
    t.equal("fleet = web agv default 3", r["n0"], 3)
    t.close("E_trip = 280/3.6 Wh", b["e_trip"], 77.777777778, 1e-8)
    t.close("busy = 8*260 = 2080 s", b["busy"], 2080.0, 1e-12)
    t.close("E_h = 622.222 + 150*1520/3600 = 685.556 Wh", b["e_h"], 685.555555556, 1e-8)
    t.close("usable = 48*100*0.8 = 3840 Wh", b["usable"], 3840.0, 1e-12)
    t.close("runtime = 3840/685.556 = 5.6013 h", b["runtime"], 5.601296596, 1e-8)
    t.close("charge = 3840/2700 = 1.4222 h", b["charge"], 1.422222222, 1e-8)
    t.close("availability = 5.6013/7.0235 = 0.79751", b["avail"], 0.797506, 1e-6)
    t.close("opportunity share = 685.556/2700 = 0.25391 h/h", b["share"], 0.253909465, 1e-8)
    t.close("idle share = 1520/3600", b["idle"], 0.422222222, 1e-8)
    t.close("opportunity availability 1 (fits idle)", b["avail_opp"], 1.0, 1e-12)
    t.equal("fleet with battery avail ceil(1.7333/(0.79751*0.85)) = 3 -> extra 0", r["n_a"], 3)
    t.equal("fleet with opportunity charging = 3", r["n_b"], 3)
    t.equal("40 orders/h: web ceil(3.998) = 4 -> battery ceil(4.262) = 5 (extra 1)", (analyse({"tr": 40}, batt)["n0"], analyse({"tr": 40}, batt)["n_a"]),
            (4, 5))
    b2 = dict(batt, trips_per_h=13)        # busy 3380 s, idle 0.0611 h/h < share -> loss
    rb = battery(b2)
    t.true("13 trips: opportunity charging does not fit idle", rb["share"] > rb["idle"] and rb["avail_opp"] < 1)
    try:
        battery(dict(batt, trips_per_h=20))
        t.true("busy > 3600 s rejected", False)
    except InputError:
        t.true("busy > 3600 s rejected", True)
    return t.finish()


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter, allow_abbrev=False,
        epilog="Examples:\n  python tools/fmse/agv_fleet.py\n"
               "  python tools/fmse/agv_fleet.py --trips 40\n"
               "  python tools/fmse/agv_fleet.py --trips 30 --Ah 150 --P_charge_kW 6\n"
               "  python tools/fmse/agv_fleet.py --dl 200 --de 150 --vv 1.2 --trips_per_h 6")
    ap.add_argument("--examples", default=str(ITEM3_EXAMPLES), help="item-3 example JSON (default: %(default)s)")
    ap.add_argument("--trips", type=float, help="transport orders per hour of the whole fleet (peak) = web input 'tr'")
    for k, lab, d, u in CALC["agv"][1]:
        ap.add_argument(f"--{k}", type=float, help=f"fleet: {lab} [{u or '-'}] (web default {d:g})")
    for k in BATT_KEYS:
        ap.add_argument(f"--{k}", type=float, help=f"battery: override JSON agv_battery.{k}")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    _, batt = load_examples(a.examples, "agv_battery")
    batt = dict(batt)
    for k in BATT_KEYS:
        if getattr(a, k) is not None:
            batt[k] = getattr(a, k)
    over = {k: getattr(a, k) for k in AGV_KEYS}
    if a.trips is not None:
        if a.tr is not None and a.tr != a.trips:
            raise InputError("--trips and --tr are the same input; give only one")
        over["tr"] = a.trips
    show(analyse(over, batt), batt)
    return 0


if __name__ == "__main__":
    run_main(main)
