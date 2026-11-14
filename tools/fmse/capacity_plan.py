#!/usr/bin/env python3
"""Capacity plan: available hours, machine load, number of machines, bottleneck, takt and EOQ.

Python 3 standard library only, offline. Formulas = "_formulas" in examples/item2_examples.json.

Available hours (section "calendar"):
    days    = 365 - weekend_days - holidays - shutdown_days
    h       = days * shifts * (shift_h - break_h)
    h_avail = h * (1 - planned_maint)
Load per machine group g (section "capacity"):
    L_g      = sum Q_i*t_ig/60  +  sum ceil(Q_i/lot_i)*t_setup_g/60     [h/year]
               (the set-up term counts only parts that use the group, t_ig > 0)
    machines = ceil(L_g / (h_avail*OEE_g))
    util     = L_g / (machines*h_avail*OEE_g)
    bottleneck = group with the highest utilisation
    takt     = h_avail*60 / demand   [min/part]   (demand = all parts, and per group = parts using it)
    --growth p multiplies every volume by (1 + p/100) (reserve for growth)
EOQ (section "eoq"):
    S  = t_setup_h*rate + admin       (cost of one set-up / order, EUR)
    H  = holding_rate*unit_value      (cost to hold one part for one year, EUR)
    Q* = sqrt(2*D*S/H)
    total cost(Q) = D/Q*S + Q/2*H     (set-up part + holding part)
"""

import argparse
import math

from fmse_common import (ITEM2_EXAMPLES, InputError, SelfTest, fmt_num, fmt_table, load_examples,
                         parse_float_list, run_main, text_bar, write_csv)

DEFAULT_LOTS = [25, 50, 94, 150, 300]


# ----------------------------------------------------------------------------- formulas
def available_hours(cal):
    for k in ("weekend_days", "holidays", "shutdown_days", "shifts", "shift_h", "break_h", "planned_maint"):
        if k not in cal:
            raise InputError(f"calendar: value '{k}' is missing")
    days = 365 - cal["weekend_days"] - cal["holidays"] - cal["shutdown_days"]
    if days <= 0 or cal["shift_h"] <= cal["break_h"]:
        raise InputError("calendar: no working time left (check days and shift / break hours)")
    h = days * cal["shifts"] * (cal["shift_h"] - cal["break_h"])
    return {"days": days, "h": h, "h_avail": h * (1 - cal["planned_maint"])}


def load_plan(cap, h_avail, growth=0.0):
    """Load, machines, utilisation and takt per group. Returns (groups list, summary dict)."""
    groups, parts = cap.get("groups"), cap.get("parts")
    if not groups or not parts:
        raise InputError("capacity: 'groups' and 'parts' are needed")
    g_n = len(groups)
    for p in parts:
        if len(p) < 4 or len(p[3]) != g_n:
            raise InputError(f"capacity part {p[0] if p else '?'}: need [name, volume, lot, {g_n} times]")
        if p[2] <= 0:
            raise InputError(f"capacity part {p[0]}: lot size must be > 0")
    f = 1 + growth / 100.0
    out = []
    q_all = sum(p[1] * f for p in parts)
    for g, (name, oee, su) in enumerate(groups):
        if not 0 < oee <= 1:
            raise InputError(f"capacity group {name}: OEE must be in (0, 1]")
        run = setup = q_g = 0.0
        lots = 0
        for pname, q, lot, times in parts:
            if times[g] <= 0:
                continue
            qq = q * f
            run += qq * times[g] / 60
            nl = math.ceil(qq / lot - 1e-9)
            lots += nl
            setup += nl * su / 60
            q_g += qq
        load = run + setup
        capm = h_avail * oee
        exact = load / capm
        mach = math.ceil(exact - 1e-9) if load > 0 else 0
        out.append({"name": name, "oee": oee, "setup_min": su, "run": run, "setup": setup, "lots": lots,
                    "load": load, "cap_per_machine": capm, "exact": exact, "machines": mach,
                    "util": load / (mach * capm) if mach else 0.0, "q": q_g,
                    "takt": h_avail * 60 / q_g if q_g else None})
    bn = max(out, key=lambda r: r["util"])
    return out, {"q_all": q_all, "takt_all": h_avail * 60 / q_all, "bottleneck": bn["name"]}


def eoq(e):
    for k in ("D", "t_setup_h", "rate_EUR_h", "admin_EUR", "holding_rate", "unit_value_EUR"):
        if k not in e:
            raise InputError(f"eoq: value '{k}' is missing")
    S = e["t_setup_h"] * e["rate_EUR_h"] + e["admin_EUR"]
    H = e["holding_rate"] * e["unit_value_EUR"]
    if e["D"] <= 0 or S <= 0 or H <= 0:
        raise InputError("eoq: D, set-up cost and holding cost must be > 0")
    q = math.sqrt(2 * e["D"] * S / H)
    return {"S": S, "H": H, "Q": q, "TC": cost(e["D"], S, H, q)["total"]}


def cost(D, S, H, Q):
    su = D / Q * S
    ho = Q / 2 * H
    return {"Q": Q, "orders": D / Q, "setup": su, "holding": ho, "total": su + ho}


# ----------------------------------------------------------------------------- report
def show_calendar(cal):
    a = available_hours(cal)
    print("AVAILABLE HOURS PER MACHINE AND YEAR")
    print(f"  days    = 365 - {cal['weekend_days']} weekend - {cal['holidays']} holidays - {cal['shutdown_days']} shutdown "
          f"= {a['days']} days")
    print(f"  h       = {a['days']} * {cal['shifts']} shifts * ({cal['shift_h']:g} - {cal['break_h']:g}) h = {fmt_num(a['h'], 1)} h")
    print(f"  h_avail = {fmt_num(a['h'], 1)} * (1 - {cal['planned_maint']:g}) = {fmt_num(a['h_avail'], 2)} h")
    return a


def show_capacity(cap, h_avail, growth, csv_path=None):
    rows, s = load_plan(cap, h_avail, growth)
    print(f"MACHINE LOAD AND NUMBER OF MACHINES   h_avail = {fmt_num(h_avail, 2)} h/machine"
          + (f"   volume growth +{growth:g} %" if growth else ""))
    print(fmt_table(["group", "OEE", "run h", "set-up h", "lots", "load h", "h*OEE", "exact", "machines", "util %", "takt min"],
                    [[r["name"], f"{r['oee']:.2f}", fmt_num(r["run"], 1), fmt_num(r["setup"], 1), r["lots"],
                      fmt_num(r["load"], 1), fmt_num(r["cap_per_machine"], 1), f"{r['exact']:.3f}", r["machines"],
                      f"{r['util']*100:.1f}", f"{r['takt']:.2f}" if r["takt"] else "-"] for r in rows]))
    print()
    print("Utilisation after rounding up (# = 2.5 %, | = 85 % warning line):")
    for r in rows:
        bar = text_bar(r["util"], 1.0, 40).ljust(40)
        bar = bar[:34] + "|" + bar[35:]
        print(f"  {r['name'].ljust(10)} {bar} {r['machines']} x {r['util']*100:5.1f} %"
              + ("  <= BOTTLENECK" if r["name"] == s["bottleneck"] else ""))
    bn = [r for r in rows if r["name"] == s["bottleneck"]][0]
    print()
    print(f"Bottleneck: {bn['name']} {bn['util']*100:.1f} %   load = {fmt_num(bn['run'], 1)} + {fmt_num(bn['setup'], 1)} "
          f"= {fmt_num(bn['load'], 1)} h;  machines = ceil({fmt_num(bn['load'], 1)} / ({fmt_num(h_avail, 2)}*{bn['oee']:g})) "
          f"= ceil({bn['exact']:.3f}) = {bn['machines']}")
    print(f"Takt (all parts): {fmt_num(h_avail, 2)} h * 60 / {fmt_num(s['q_all'], 0)} parts = {s['takt_all']:.3f} min/part")
    print("Takt per group = h_avail*60 / parts that visit the group (a group with m machines has m*takt per part).")
    if bn["util"] > 0.85:
        print("WARNING: utilisation above 85 % - queues grow fast, no room for breakdowns. Options: one more machine,")
        print("         shorter cycle, fewer set-ups (bigger lots / SMED), unmanned shift, higher OEE, move a part.")
    if csv_path:
        p = write_csv(csv_path, ["group", "OEE", "run_h", "setup_h", "lots", "load_h", "h_avail_x_OEE",
                                 "machines_exact", "machines", "utilisation", "takt_min"],
                      [[r["name"], r["oee"], round(r["run"], 3), round(r["setup"], 3), r["lots"], round(r["load"], 3),
                        round(r["cap_per_machine"], 3), round(r["exact"], 5), r["machines"], round(r["util"], 5),
                        round(r["takt"], 4) if r["takt"] else ""] for r in rows])
        print(f"\nCSV written: {p}")
    return rows, s


def show_eoq(e, lots):
    r = eoq(e)
    print("ECONOMIC ORDER QUANTITY (lot size)")
    print(f"  S  = {e['t_setup_h']:g} h * {e['rate_EUR_h']:g} EUR/h + {e['admin_EUR']:g} EUR = {r['S']:.2f} EUR per set-up")
    print(f"  H  = {e['holding_rate']:g} * {e['unit_value_EUR']:g} EUR = {r['H']:.2f} EUR per part and year")
    print(f"  Q* = sqrt(2*{e['D']:g}*{r['S']:.2f}/{r['H']:.2f}) = {r['Q']:.1f} parts   "
          f"total cost at Q* = {fmt_num(r['TC'], 2)} EUR/yr")
    qs = sorted(set([float(x) for x in lots] + [round(r["Q"], 1)]))
    rows = []
    for q in qs:
        c = cost(e["D"], r["S"], r["H"], q)
        rows.append([fmt_num(q, 1), f"{c['orders']:.1f}", fmt_num(c["setup"], 2), fmt_num(c["holding"], 2),
                     fmt_num(c["total"], 2), f"{(c['total']/r['TC']-1)*100:+.1f} %",
                     "<= EOQ" if abs(q - round(r["Q"], 1)) < 1e-9 else ""])
    print(fmt_table(["lot Q", "lots/yr", "set-up EUR/yr", "holding EUR/yr", "total EUR/yr", "vs EOQ", ""], rows, "rrrrrrl"))
    print("  The total cost curve is flat near Q*: +/-30 % lot size costs only a few %. Shorter set-ups (SMED) lower S")
    print("  and so the best lot size - smaller lots, less stock, more flexibility.")
    return r


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("capacity_plan")
    data, cal = load_examples(path, "calendar")
    a = available_hours(cal)
    t.equal("working days = 365-104-10-10", a["days"], 241)
    t.close("h = 241*2*7.5", a["h"], 3615.0, 1e-9)
    t.close("h_avail = 3615*0.97", a["h_avail"], 3506.55, 1e-9)
    rows, s = load_plan(data["capacity"], a["h_avail"])
    g = {r["name"]: r for r in rows}
    t.close("HMC run h = 308000/60", g["HMC"]["run"], 308000 / 60, 1e-9)
    t.close("HMC set-up h = 300 lots*20/60", g["HMC"]["setup"], 100.0, 1e-9)
    t.equal("HMC machines", g["HMC"]["machines"], 2)
    t.close("HMC util = 5233.33/(2*3506.55*0.75)", g["HMC"]["util"], (308000 / 60 + 100) / (2 * 3506.55 * 0.75), 1e-12)
    t.close("VMC load = 2850 + 200", g["VMC"]["load"], 3050.0, 1e-9)
    t.equal("VMC machines", g["VMC"]["machines"], 2)
    t.close("Lathe load = 2100 + 250*25/60", g["Lathe"]["load"], 2100 + 250 * 25 / 60, 1e-9)
    t.equal("Lathe machines", g["Lathe"]["machines"], 1)
    t.close("Grinder load = 1050 + 100", g["Grinder"]["load"], 1150.0, 1e-9)
    t.close("Washer load = 67500/60", g["Washer"]["load"], 1125.0, 1e-9)
    t.equal("bottleneck", s["bottleneck"], "HMC")
    t.close("takt all parts min = 3506.55*60/45000", s["takt_all"], 3506.55 * 60 / 45000, 1e-12)
    rows15, _ = load_plan(data["capacity"], a["h_avail"], 15)
    t.equal("HMC machines with +15 % growth", {r["name"]: r for r in rows15}["HMC"]["machines"], 3)
    r = eoq(data["eoq"])
    t.close("S = 0.333333*90 + 20", r["S"], 49.99997, 1e-9)
    t.close("H = 0.25*180", r["H"], 45.0, 1e-12)
    t.close("EOQ Q*", r["Q"], 94.28087587, 1e-6)
    t.close("total cost at Q* = sqrt(2DSH)", r["TC"], math.sqrt(2 * 4000 * 49.99997 * 45), 1e-6)
    c = cost(4000, r["S"], r["H"], 25)
    t.close("cost lot 25 = 4000/25*S + 12.5*45", c["total"], 160 * 49.99997 + 562.5, 1e-6)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n  python tools/fmse/capacity_plan.py                (calendar + capacity + EOQ)\n"
               "  python tools/fmse/capacity_plan.py --growth 15 --csv capacity.csv\n"
               "  python tools/fmse/capacity_plan.py --eoq --lots 25,50,94,150,300")
    ap.add_argument("--examples", default=str(ITEM2_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--calendar", action="store_true", help="show the available-hours calculation")
    ap.add_argument("--capacity", action="store_true", help="show load / machines / bottleneck")
    ap.add_argument("--eoq", action="store_true", help="show the EOQ and the lot-size cost table")
    ap.add_argument("--growth", type=float, default=0.0, help="volume growth / reserve in %% (default 0)")
    ap.add_argument("--hours", type=float, help="use these available hours instead of the calendar")
    ap.add_argument("--lots", help="lot sizes for the cost table (default 25,50,94,150,300)")
    ap.add_argument("--csv", help="write the capacity table to this CSV file")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    if a.growth <= -100:
        raise InputError("--growth must be > -100")
    data, cal = load_examples(a.examples, "calendar")
    show_all = not (a.calendar or a.capacity or a.eoq)
    lots = DEFAULT_LOTS
    if a.lots:
        lots = parse_float_list(a.lots, "--lots")
        if any(x <= 0 for x in lots):
            raise InputError("--lots must all be > 0")
    av = available_hours(cal)
    h = a.hours if a.hours else av["h_avail"]
    if h <= 0:
        raise InputError("--hours must be > 0")
    if show_all or a.calendar:
        show_calendar(cal)
        if a.hours:
            print(f"  (--hours {a.hours:g} is used below instead of h_avail)")
        print()
    if show_all or a.capacity:
        if "capacity" not in data:
            raise InputError("section 'capacity' is missing in the JSON")
        show_capacity(data["capacity"], h, a.growth, a.csv)
        print()
    if show_all or a.eoq:
        if "eoq" not in data:
            raise InputError("section 'eoq' is missing in the JSON")
        show_eoq(data["eoq"], lots)
    return 0


if __name__ == "__main__":
    run_main(main)
