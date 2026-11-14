#!/usr/bin/env python3
"""The 17 sizing calculators of the FMS elements catalogue (item 3) - same as the web page.

Python 3 standard library only, offline. This is a 1:1 port of web/fmse3.js (object CALC):
same inputs, same default values, same formulas, same verdict texts, g = 9.81 m/s2.
A number printed here is the same number the web page shows (same decimals, same rounding).

Calculators (key - what it sizes):
  cycle    cycle time and productive (cutting) share of a machining centre
  pallets  number of pallets (Little's law), manned buffer vs unmanned shift
  apc      benefit of an automatic pallet changer
  pool     pallet pool places and stacker crane load
  loadst   number of load / unload stations
  robot    robot payload, wrist moment and reach
  agv      AGV fleet size
  conv     carriers and conveyor speed (carrier loop)
  asrs     AS/RS cycle times with the FEM 9.851 reference points
  tools    tool magazine pockets and sister tools
  wash     washer capacity
  meas     measuring capability (T/U) and CMM load
  dmc      DataMatrix (ECC 200) symbol size
  grip     gripper and clamping force
  posit    welding positioner torque check
  tower    sheet-metal storage tower and unmanned hours
  chips    chip volume and coolant tank

Each result line shows the formula (the web label) and the formula with your numbers.
Guide: docs/FMS system design/63_fms_elements_catalogue.md - web: FMS engineering -> item 3.
"""

import argparse
import math

from fmse_common import G, ITEM3_EXAMPLES, InputError, fmt_table, fmt_web, load_examples, run_main, t_move, \
    write_csv, SelfTest


def _g(x):
    """Short number text for the 'with numbers' column."""
    return f"{x:g}" if isinstance(x, (int, float)) else str(x)


# ----------------------------------------------------------------------------- the calculators
# Each entry: title, inputs [[key, label, default, unit]], keys that must be > 0, run(v) -> (out, verdict)
# out rows: (label, value, unit, decimals, numbers-text); decimals -1 = show the unit text only (web rule)

def run_cycle(v):
    non = (v["ntc"] * v["c2c"] + v["rap"] + v["pal"] + v["mea"]) / 60
    cyc = v["tc"] + non
    out = [("Non-cutting time = tool changes·chip-to-chip + rapid + pallet + probing", non, "min", 2,
            f"({_g(v['ntc'])}·{_g(v['c2c'])} + {_g(v['rap'])} + {_g(v['pal'])} + {_g(v['mea'])}) s ÷ 60"),
           ("Cycle time per pallet", cyc, "min", 2, f"{_g(v['tc'])} + {non:.4f}"),
           ("Productive share = cutting ÷ cycle", 100 * v["tc"] / cyc, "%", 0, f"100·{_g(v['tc'])} ÷ {cyc:.4f}"),
           ("Pallets per hour (100 %)", 60 / cyc, "/h", 2, f"60 ÷ {cyc:.4f}")]
    verdict = ("Below 70 % cutting: reduce tool changes (combined tools), faster changer, fewer probing cycles."
               if v["tc"] / cyc < 0.7 else "Good productive share.")
    return out, verdict


def run_pallets(v):
    manned = v["nm"] * 2 + v["nm"] * v["buf"] + v["nl"] + v["oth"]
    unm = v["nm"] * (1 + math.ceil(v["tu"] * 60 / v["tc"]))
    N = max(manned, unm)
    th = v["nm"] * 60 / v["tc"]
    out = [("Manned: machines·(table + APC) + buffer + load + other", manned, "pallets", 0,
            f"{_g(v['nm'])}·2 + {_g(v['nm'])}·{_g(v['buf'])} + {_g(v['nl'])} + {_g(v['oth'])}"),
           ("Unmanned: machines·(1 + ⌈T·60 ÷ cycle⌉)", unm, "pallets", 0,
            f"{_g(v['nm'])}·(1 + ⌈{_g(v['tu'])}·60 ÷ {_g(v['tc'])}⌉) = {_g(v['nm'])}·(1 + {math.ceil(v['tu'] * 60 / v['tc'])})"),
           ("Pallets needed = max of both", N, "pallets", 0, f"max({_g(manned)}, {_g(unm)})"),
           ("Throughput TH = machines·60 ÷ cycle", th, "pallets/h", 2, f"{_g(v['nm'])}·60 ÷ {_g(v['tc'])}"),
           ("Flow time = WIP ÷ TH (Little's law)", N / th, "h", 1, f"{_g(N)} ÷ {th:.4f}")]
    verdict = ("The unmanned shift decides the pallet count – fewer pallets possible with longer cycles per pallet "
               "(more parts per tombstone)." if unm > manned else "Manned buffer decides the pallet count.")
    return out, verdict


def run_apc(v):
    u0 = v["tc"] / (v["tc"] + v["tl"])
    if v["tl"] <= v["tc"]:
        u1 = v["tc"] / (v["tc"] + v["tch"] / 60)
        n1 = f"{_g(v['tc'])} ÷ ({_g(v['tc'])} + {_g(v['tch'])}/60)"
    else:
        u1 = v["tc"] / (v["tl"] + v["tch"] / 60)
        n1 = f"{_g(v['tc'])} ÷ ({_g(v['tl'])} + {_g(v['tch'])}/60)  (loading longer than cutting)"
    out = [("Spindle utilisation without APC = t꜀ ÷ (t꜀ + t_load)", 100 * u0, "%", 0,
            f"{_g(v['tc'])} ÷ ({_g(v['tc'])} + {_g(v['tl'])})"),
           ("With APC = t꜀ ÷ (t꜀ + t_change)", 100 * u1, "%", 0, n1),
           ("Output gain", 100 * (u1 / u0 - 1), "%", 0, f"100·({u1:.4f} ÷ {u0:.4f} − 1)")]
    verdict = ("Loading takes longer than cutting – the operator is the bottleneck. Add a pallet pool / second load "
               "station." if v["tl"] > v["tc"] else "Loading is hidden inside the cutting time.")
    return out, verdict


def run_pool(v):
    pph = v["nm"] * 60 / v["tc"]
    mph = pph * v["mpc"]
    u = mph * v["mv"] / 3600
    out = [("Pallets per hour through machines", pph, "/h", 2, f"{_g(v['nm'])}·60 ÷ {_g(v['tc'])}"),
           ("Stacker moves per hour", mph, "/h", 1, f"{pph:.4f}·{_g(v['mpc'])}"),
           ("Stacker utilisation = moves·time ÷ 3600", 100 * u, "%", 0, f"{mph:.4f}·{_g(v['mv'])} ÷ 3600"),
           ("Rack places = pallets + free places", v["N"] + v["fr"], "places", 0, f"{_g(v['N'])} + {_g(v['fr'])}")]
    verdict = ("Stacker above 70 % – machines will wait for it. Faster stacker, fewer moves (direct machine ⇄ load "
               "station), or a second vehicle." if u > 0.7 else "Stacker has reserve for added machines.")
    return out, verdict


def run_loadst(v):
    lam = v["nm"] * 60 / v["tc"]
    u = lam * v["tl"] / 60
    n = math.ceil(u / v["um"] - 1e-9)
    out = [("Pallet arrivals λ = machines·60 ÷ cycle", lam, "/h", 2, f"{_g(v['nm'])}·60 ÷ {_g(v['tc'])}"),
           ("Work = λ·t_load ÷ 60", u, "station-hours/h", 2, f"{lam:.4f}·{_g(v['tl'])} ÷ 60"),
           ("Stations = ⌈work ÷ max. utilisation⌉", n, "", 0, f"⌈{u:.4f} ÷ {_g(v['um'])}⌉ = ⌈{u / v['um']:.4f}⌉"),
           ("Utilisation per station", 100 * u / n if n else float("nan"), "%", 0, f"100·{u:.4f} ÷ {n}")]
    verdict = ("Two or more stations – they can share one operator only if the work sum is below ≈ 0.8."
               if n > 1 else "One station is enough.")
    return out, verdict


def run_robot(v):
    m = v["mp"] + v["mg"]
    M = m * G * v["e"] / 1000
    lp = m / v["rp"]
    lm = M / v["rm"]
    out = [("Load = part + gripper", m, "kg", 1, f"{_g(v['mp'])} + {_g(v['mg'])}"),
           ("Payload use", 100 * lp, "%", 0, f"100·{_g(m)} ÷ {_g(v['rp'])}"),
           ("Wrist moment M = m·g·e", M, "N·m", 1, f"{_g(m)}·9.81·{_g(v['e'])}/1000"),
           ("Moment use", 100 * lm, "%", 0, f"100·{M:.4f} ÷ {_g(v['rm'])}"),
           ("Reach margin", v["rr"] - v["rq"], "mm", 0, f"{_g(v['rr'])} − {_g(v['rq'])}")]
    good = lp <= 0.8 and lm <= 0.8 and v["rr"] >= v["rq"] * 1.05
    verdict = ("✓ " if good else "✗ ") + ("Rule: payload and moment ≤ 80 %, reach ≥ 105 % of needed. Check also "
                                           "inertia J = m·r² in the maker's load diagram.")
    return out, verdict


def run_agv(v):
    t = (v["dl"] + v["de"]) / v["vv"] + v["tlu"]
    w = v["tr"] * t / 3600
    n = math.ceil(w / (v["eta"] * v["ft"]) - 1e-9)
    out = [("Time per order = (loaded + empty) ÷ v + transfer", t, "s", 0,
            f"({_g(v['dl'])} + {_g(v['de'])}) ÷ {_g(v['vv'])} + {_g(v['tlu'])}"),
           ("Vehicle-hours per hour", w, "", 2, f"{_g(v['tr'])}·{t:.4f} ÷ 3600"),
           ("Vehicles = ⌈work ÷ (availability·traffic)⌉", n, "", 0,
            f"⌈{w:.4f} ÷ ({_g(v['eta'])}·{_g(v['ft'])})⌉ = ⌈{w / (v['eta'] * v['ft']):.4f}⌉"),
           ("Utilisation per vehicle", 100 * w / n if n else float("nan"), "%", 0, f"100·{w:.4f} ÷ {n}")]
    verdict = ("Add 1 vehicle as reserve if a stopped AGV would stop production. Verify with simulation (item 4) – "
               "peaks and traffic decide.")
    return out, verdict


def run_conv(v):
    onway = v["th"] * v["ttr"] / 3600
    N = math.ceil(v["ns"] * (1 + v["buf"]) * 0.8 + onway)
    vmin = v["pit"] * v["th"] / 3600 / 1000 * 60
    out = [("Carriers on the way = TH·t_transport ÷ 3600", onway, "", 1, f"{_g(v['th'])}·{_g(v['ttr'])} ÷ 3600"),
           ("Carriers ≈ stations·(1 + buffer)·0.8 + on the way", N, "", 0,
            f"⌈{_g(v['ns'])}·(1 + {_g(v['buf'])})·0.8 + {onway:.4f}⌉"),
           ("Min. conveyor speed = pitch·TH", vmin, "m/min", 2, f"{_g(v['pit'])} mm·{_g(v['th'])}/h ÷ 3600 ÷ 1000·60")]
    verdict = "Factor 0.8: buffers are rarely all full. Too many carriers jam the loop – test the number in simulation."
    return out, verdict


def asrs_points(v):
    """FEM 9.851 reference points P1 (L/5, 2H/3) and P2 (2L/3, H/5) [m]."""
    return (v["L"] / 5, 2 * v["H"] / 3), (2 * v["L"] / 3, v["H"] / 5)


def asrs_move(v, x, y):
    """Crane move time: X (travel) and Y (hoist) run at the same time, the slower axis decides."""
    return max(t_move(x, v["vx"], v["ax"]), t_move(y, v["vy"], v["ay"]))


def asrs_cycles(v):
    """Return dict with P1, P2, single cycle tsc, double cycle tdc [s] (web asrs calculator)."""
    P1, P2 = asrs_points(v)
    t1, t2 = asrs_move(v, *P1), asrs_move(v, *P2)
    t12 = asrs_move(v, abs(P2[0] - P1[0]), abs(P2[1] - P1[1]))
    tsc = t1 + t2 + 2 * v["tf"] + v["td"]
    tdc = t1 + t12 + t2 + 4 * v["tf"] + v["td"]
    return {"P1": P1, "P2": P2, "t1": t1, "t2": t2, "t12": t12, "tsc": tsc, "tdc": tdc,
            "th_sc": 3600 / tsc, "th_dc": 2 * 3600 / tdc}


def run_asrs(v):
    r = asrs_cycles(v)
    P1, P2 = r["P1"], r["P2"]
    ptxt = f"({fmt_web(P1[0], 1)}, {fmt_web(P1[1], 1)}) · ({fmt_web(P2[0], 1)}, {fmt_web(P2[1], 1)}) m"
    out = [("Point P1 (L/5, 2H/3), P2 (2L/3, H/5)", 0, ptxt, -1,
            f"({_g(v['L'])}/5, 2·{_g(v['H'])}/3) · (2·{_g(v['L'])}/3, {_g(v['H'])}/5)"),
           ("Single cycle (store or retrieve)", r["tsc"], "s", 1,
            f"t(P1) {r['t1']:.3f} + t(P2) {r['t2']:.3f} + 2·{_g(v['tf'])} + {_g(v['td'])}"),
           ("Double cycle (store + retrieve)", r["tdc"], "s", 1,
            f"t(P1) {r['t1']:.3f} + t(P1→P2) {r['t12']:.3f} + t(P2) {r['t2']:.3f} + 4·{_g(v['tf'])} + {_g(v['td'])}"),
           ("Throughput single cycles", r["th_sc"], "moves/h", 0, f"3600 ÷ {r['tsc']:.3f}"),
           ("Throughput double cycles", r["th_dc"], "moves/h", 0, f"2·3600 ÷ {r['tdc']:.3f}")]
    verdict = ("Speed and acceleration both matter: X and Y move at the same time, the slower axis decides (max). "
               "Plan double cycles in the control logic.")
    return out, verdict


def run_tools(v):
    s = max(0, math.ceil(v["np"] * v["use"] / v["life"]) - 1)
    P = math.ceil((v["tu"] + v["k"] * s) * (1 + v["r"] / 100))
    out = [("Use per critical tool = parts·time", v["np"] * v["use"], "min", 0, f"{_g(v['np'])}·{_g(v['use'])}"),
           ("Sister tools per critical tool = ⌈use ÷ life⌉ − 1", s, "", 0,
            f"max(0, ⌈{_g(v['np'] * v['use'])} ÷ {_g(v['life'])}⌉ − 1)"),
           ("Pockets = (unique + k·sisters)·(1 + reserve)", P, "pockets", 0,
            f"⌈({_g(v['tu'])} + {_g(v['k'])}·{s})·(1 + {_g(v['r'])}/100)⌉")]
    verdict = ("More than ≈ 120 pockets – consider a chain / rack magazine (180–400) or a central tool store."
               if P > 120 else "A standard magazine (60–120) is enough.")
    return out, verdict


def run_wash(v):
    w = v["th"] / v["pb"] * v["tc"] / 3600
    n = math.ceil(w / v["oee"] - 1e-9)
    out = [("Cycles per hour", v["th"] / v["pb"], "/h", 1, f"{_g(v['th'])} ÷ {_g(v['pb'])}"),
           ("Machine-hours per hour", w, "", 2, f"{_g(v['th'])} ÷ {_g(v['pb'])}·{_g(v['tc'])} ÷ 3600"),
           ("Washers", n, "", 0, f"⌈{w:.4f} ÷ {_g(v['oee'])}⌉"),
           ("Utilisation", 100 * w / n if n else float("nan"), "%", 0, f"100·{w:.4f} ÷ {n}")]
    return out, "Drying time is usually the longest step – check it with the supplier."


def run_meas(v):
    r = v["T"] / v["U"]
    u = v["th"] / v["n"] * v["tm"] / 60
    out = [("Ratio T ÷ U", r, ": 1", 1, f"{_g(v['T'])} ÷ {_g(v['U'])}"),
           ("Acceptance zone after guard band = T − 2U", v["T"] - 2 * v["U"], "µm", 1, f"{_g(v['T'])} − 2·{_g(v['U'])}"),
           ("CMM utilisation = (TH ÷ n)·t_m ÷ 60", 100 * u, "%", 0, f"100·({_g(v['th'])} ÷ {_g(v['n'])})·{_g(v['tm'])} ÷ 60")]
    verdict = ("✓ U ≤ T/10 – good." if r >= 10 else "◐ U between T/10 and T/5 – acceptable, use guard bands."
               if r >= 5 else "✗ U > T/5 – measuring system not capable for this tolerance.")
    verdict += " CMM above 80 % – second CMM or less sampling." if u > 0.8 else ""
    return out, verdict


DMC_SIZES = [(10, 3), (12, 6), (14, 10), (16, 16), (18, 25), (20, 31), (22, 43), (24, 52), (26, 64), (32, 91),
             (36, 127), (40, 169), (44, 214)]   # square ECC 200 symbols: (modules, alphanumeric capacity)


def run_dmc(v):
    s = next((x for x in DMC_SIZES if x[1] >= v["c"]), DMC_SIZES[-1])
    out = [("Smallest square symbol", s[0], f"× {s[0]} modules (capacity {s[1]} alphanumeric)", 0,
            f"first size with capacity ≥ {_g(v['c'])}"),
           ("Symbol size = modules·cell", s[0] * v["cell"], "mm", 1, f"{s[0]}·{_g(v['cell'])}"),
           ("With quiet zone", (s[0] + 2 * v["qz"]) * v["cell"], "mm", 1, f"({s[0]} + 2·{_g(v['qz'])})·{_g(v['cell'])}")]
    verdict = ("Dot-peen on castings: cell ≥ 0.5–1 mm. Laser on machined steel: 0.2–0.4 mm. Reader resolution must "
               "give ≥ 3–5 pixels per cell.")
    return out, verdict


def run_grip(v):
    F = v["m"] * (G + v["a"]) * v["S"] / (v["mu"] * v["n"])
    Fc = v["Sc"] * v["fc"] / (v["mu"] * v["nc"])
    out = [("Gripper force per jaw F = m·(g + a)·S ÷ (μ·n)", F, "N", 0,
            f"{_g(v['m'])}·(9.81 + {_g(v['a'])})·{_g(v['S'])} ÷ ({_g(v['mu'])}·{_g(v['n'])})"),
           ("Clamp force per clamp = S·F꜀ ÷ (μ·n꜀)", Fc, "N", 0,
            f"{_g(v['Sc'])}·{_g(v['fc'])} ÷ ({_g(v['mu'])}·{_g(v['nc'])})")]
    verdict = ("With form-fit jaws (shape holds the part) the force can be much lower. μ on oily steel ≈ 0.1–0.15, "
               "rubber pads 0.3–0.5.")
    return out, verdict


def run_posit(v):
    Mr = v["m"] * G * v["e"] / 1000
    Mt = v["m"] * G * v["h"] / 1000
    out = [("Rotation torque M = m·g·e", Mr, "N·m", 0, f"{_g(v['m'])}·9.81·{_g(v['e'])}/1000"),
           ("Use", 100 * Mr / v["rr"], "%", 0, f"100·{Mr:.3f} ÷ {_g(v['rr'])}"),
           ("Tilt torque M = m·g·h", Mt, "N·m", 0, f"{_g(v['m'])}·9.81·{_g(v['h'])}/1000"),
           ("Use", 100 * Mt / v["rt"], "%", 0, f"100·{Mt:.3f} ÷ {_g(v['rt'])}")]
    verdict = ("✓ Inside the ratings." if Mr <= v["rr"] and Mt <= v["rt"] else
               "✗ Over the rating – move the CoG towards the axes (fixture design, counterweight) or a bigger positioner.")
    return out, verdict


def run_tower(v):
    pl = math.ceil((v["mat"] + v["fin"]) * (1 + v["res"] / 100))
    cyc = v["tcs"] + v["tch"] / 60
    sh = math.ceil(v["tu"] * 60 / cyc)
    out = [("Places = (materials + finished)·(1 + reserve)", pl, "", 0,
            f"⌈({_g(v['mat'])} + {_g(v['fin'])})·(1 + {_g(v['res'])}/100)⌉"),
           ("Sheets needed for the unmanned period", sh, "", 0,
            f"⌈{_g(v['tu'])}·60 ÷ ({_g(v['tcs'])} + {_g(v['tch'])}/60)⌉"),
           ("Laser utilisation = cut ÷ (cut + change)", 100 * v["tcs"] / cyc, "%", 0, f"100·{_g(v['tcs'])} ÷ {cyc:.4f}")]
    return out, "Several sheets of one material can share a place (stack) – check stack height per shelf."


def run_chips(v):
    lit = v["q"] * v["tu"] * 60 * v["ru"] * v["bf"] / 1000 * v["nm"]
    tank = 10 * v["qf"]
    out = [("Chip volume in unmanned period = Q·T·share·bulk·machines", lit, "litres", 0,
            f"{_g(v['q'])}·{_g(v['tu'])}·60·{_g(v['ru'])}·{_g(v['bf'])} ÷ 1000·{_g(v['nm'])}"),
           ("Coolant tank per machine ≥ 10 × pump flow per minute", tank, "litres", 0, f"10·{_g(v['qf'])}")]
    verdict = ("Bulk factor: short cast-iron chips ≈ 10–15, broken steel chips 20–30, long steel / aluminium chips "
               "40–50+.")
    return out, verdict


CALC = {
    "cycle": ("Cycle time and productive share",
              [["tc", "Cutting time per pallet", 8, "min"], ["ntc", "Tool changes", 18, ""], ["c2c", "Chip-to-chip time", 4, "s"],
               ["rap", "Rapid moves total", 40, "s"], ["pal", "Pallet change", 15, "s"], ["mea", "Probing / measuring", 30, "s"]],
              ["tc"], run_cycle),
    "pallets": ("Number of pallets (Little's law)",
                [["nm", "Machines", 3, ""], ["tc", "Cycle per pallet (e.g. tombstone with 4 parts)", 60, "min"],
                 ["buf", "Waiting pallets per machine (manned)", 2, ""], ["nl", "Pallets at load stations", 2, ""],
                 ["oth", "Pallets in wash / CMM / transport", 1, ""], ["tu", "Unmanned period", 8, "h"]],
                ["nm", "tc"], run_pallets),
    "apc": ("Benefit of a pallet changer",
            [["tc", "Cutting time per pallet", 12, "min"], ["tl", "Unload + clean + load + clamp", 6, "min"],
             ["tch", "Pallet change time", 15, "s"]],
            ["tc"], run_apc),
    "pool": ("Pallet pool places and stacker load",
             [["nm", "Machines", 3, ""], ["tc", "Cycle per pallet", 60, "min"], ["N", "Pallets (from Pallets & fixtures)", 27, ""],
              ["mv", "Stacker time per move", 45, "s"], ["mpc", "Moves per pallet cycle", 4, ""],
              ["fr", "Free places for exchange", 2, ""]],
             ["tc"], run_pool),
    "loadst": ("Number of load / unload stations",
               [["nm", "Machines", 3, ""], ["tc", "Cycle per pallet", 60, "min"], ["tl", "Operator time per pallet (4 parts)", 15, "min"],
                ["um", "Max. station utilisation", 0.8, ""]],
               ["nm", "tc", "tl", "um"], run_loadst),
    "robot": ("Robot payload, wrist moment and reach",
              [["mp", "Part mass", 12, "kg"], ["mg", "Gripper mass", 8, "kg"], ["e", "CoG offset from flange", 120, "mm"],
               ["rp", "Rated payload", 25, "kg"], ["rm", "Allowed wrist moment", 50, "N·m"], ["rq", "Reach needed", 1650, "mm"],
               ["rr", "Robot reach", 1850, "mm"]],
              ["rp", "rm"], run_robot),
    "agv": ("AGV fleet size",
            [["tr", "Transport orders per hour (peak)", 24, "/h"], ["dl", "Average loaded distance", 120, "m"],
             ["de", "Average empty distance", 100, "m"], ["vv", "Speed (average incl. curves)", 1.0, "m/s"],
             ["tlu", "Docking + load + unload", 40, "s"], ["eta", "Availability (charging)", 0.85, ""],
             ["ft", "Traffic / blocking factor", 0.85, ""]],
            ["tr", "vv", "eta", "ft"], run_agv),
    "conv": ("Carriers and conveyor speed",
             [["th", "Throughput", 120, "parts/h"], ["ns", "Stations", 8, ""], ["buf", "Buffer places per station", 2, ""],
              ["ttr", "Transport time around the loop", 90, "s"], ["pit", "Carrier pitch (length + gap)", 400, "mm"]],
             [], run_conv),
    "asrs": ("AS/RS cycle times (FEM 9.851 points)",
             [["L", "Rack length", 40, "m"], ["H", "Rack height", 12, "m"], ["vx", "Travel speed", 3, "m/s"],
              ["ax", "Travel acceleration", 0.5, "m/s²"], ["vy", "Hoist speed", 0.8, "m/s"], ["ay", "Hoist acceleration", 0.5, "m/s²"],
              ["tf", "Fork cycle (one way)", 8, "s"], ["td", "Dead time per cycle", 4, "s"]],
             ["vx", "ax", "vy", "ay"], run_asrs),
    "tools": ("Magazine pockets and sister tools",
              [["tu", "Unique tools of all active parts", 95, ""], ["k", "Critical (wearing) tools", 12, ""],
               ["life", "Average tool life", 45, "min"], ["use", "Cutting time per part per critical tool", 1.5, "min"],
               ["np", "Parts in the unmanned period", 40, ""], ["r", "Reserve", 10, "%"]],
              ["life"], run_tools),
    "wash": ("Washer capacity",
             [["th", "Parts per hour", 40, "/h"], ["tc", "Wash + dry cycle", 120, "s"], ["pb", "Parts per basket / cycle", 4, ""],
              ["oee", "OEE", 0.85, ""]],
             ["th", "tc", "pb", "oee"], run_wash),
    "meas": ("Measuring capability and CMM load",
             [["T", "Tolerance width T", 30, "µm"], ["U", "Expanded uncertainty U (k = 2)", 4, "µm"],
              ["tm", "CMM time per part", 12, "min"], ["n", "Measure 1 in n parts", 10, ""], ["th", "Parts per hour", 8, "/h"]],
             ["U", "n"], run_meas),
    "dmc": ("DataMatrix (ECC 200) size",
            [["c", "Characters (alphanumeric)", 20, ""], ["cell", "Cell (module) size", 0.3, "mm"],
             ["qz", "Quiet zone (modules each side)", 2, ""]],
            [], run_dmc),
    "grip": ("Gripper and clamping force",
             [["m", "Part mass", 12, "kg"], ["a", "Acceleration (incl. stop)", 10, "m/s²"], ["mu", "Friction coefficient μ", 0.12, ""],
              ["n", "Contact jaws", 2, ""], ["S", "Safety factor", 2, ""], ["fc", "Cutting force (for clamp)", 3000, "N"],
              ["nc", "Clamps", 2, ""], ["Sc", "Safety factor clamp", 2.5, ""]],
             ["mu", "n", "nc"], run_grip),
    "posit": ("Positioner torque check",
              [["m", "Part + fixture mass", 600, "kg"], ["e", "CoG distance from rotation axis", 80, "mm"],
               ["h", "CoG distance from tilt axis", 300, "mm"], ["rr", "Rated rotation torque", 1000, "N·m"],
               ["rt", "Rated tilt torque", 3000, "N·m"]],
              ["rr", "rt"], run_posit),
    "tower": ("Sheet tower and unmanned hours",
              [["mat", "Material × thickness combinations", 14, ""], ["fin", "Finished part pallets", 4, ""],
               ["res", "Reserve", 20, "%"], ["tcs", "Cutting time per sheet", 18, "min"], ["tch", "Sheet change time", 70, "s"],
               ["tu", "Unmanned period", 10, "h"]],
              [], run_tower),
    "chips": ("Chip volume and coolant tank",
              [["q", "Metal removal (average)", 40, "cm³/min"], ["ru", "Cutting share of time", 0.6, ""],
               ["bf", "Chip bulk factor", 25, ""], ["tu", "Unmanned period", 8, "h"], ["nm", "Machines", 3, ""],
               ["qf", "Coolant pump flow per machine", 60, "l/min"]],
              [], run_chips),
}
# extra "> 0" rules that are not divisions but still needed for a meaningful result
EXTRA_POS = {"cycle": [], "tower": ["tcs"]}


def defaults(calc):
    """Default input dict of a calculator (the web defaults)."""
    return {k: float(d) for k, _, d, _ in CALC[calc][1]}


def compute(calc, values=None):
    """Run one calculator. values: dict of overrides. Return (inputs, out rows, verdict)."""
    if calc not in CALC:
        raise InputError(f"unknown calculator '{calc}' (use one of: {', '.join(CALC)})")
    v = defaults(calc)
    for k, x in (values or {}).items():
        if x is None:
            continue
        if k not in v:
            raise InputError(f"{calc}: unknown input '{k}' (inputs: {', '.join(v)})")
        v[k] = float(x)
    for k, x in v.items():
        if not math.isfinite(x) or x < 0:
            raise InputError(f"{calc}: input '{k}' = {x:g} must be a number >= 0")
    for k in CALC[calc][2] + EXTRA_POS.get(calc, []):
        if v[k] <= 0:
            raise InputError(f"{calc}: input '{k}' must be > 0 (it is a divisor)")
    try:
        out, verdict = CALC[calc][3](v)
    except ZeroDivisionError:
        raise InputError(f"{calc}: division by zero - check that the inputs are > 0")
    return v, out, verdict


def value_text(row):
    """Value column exactly like the web: decimals < 0 -> only the unit text."""
    label, x, unit, d = row[:4]
    if d < 0:
        return unit
    return f"{fmt_web(x, d)} {unit}".rstrip()


def show(calc, values=None):
    v, out, verdict = compute(calc, values)
    title, inp = CALC[calc][0], CALC[calc][1]
    print(f"[{calc}]  {title}")
    print(fmt_table(["input", "key", "value", "unit"], [[lab, k, f"{v[k]:g}", u] for k, lab, _, u in inp], "llrl"))
    print()
    print(fmt_table(["result (formula)", "value", "with numbers"], [[r[0], value_text(r), r[4]] for r in out], "lrl"))
    print(f"Verdict: {verdict}")
    if calc == "dmc" and v["c"] > DMC_SIZES[-1][1]:
        print(f"NOTE: {v['c']:g} characters is more than the largest square symbol in the list holds "
              f"({DMC_SIZES[-1][1]}); the web page also shows 44 × 44 - use a bigger symbol or fewer characters.")
    return v, out, verdict


def list_calcs():
    for calc, (title, inp, _, _) in CALC.items():
        print(f"{calc:8s} {title}")
        for k, lab, d, u in inp:
            print(f"           --{k:5s} {lab} [default {d:g}{(' ' + u) if u else ''}]")


# ----------------------------------------------------------------------------- self-test
def selftest():
    """Hand-checked default values of all 17 calculators (scratch calculation, not tool output)."""
    t = SelfTest("element_sizing")

    def o(calc, **kw):
        return compute(calc, kw)[1:]

    out, vd = o("cycle")
    t.close("cycle non-cutting = 157/60 min", out[0][1], 157 / 60, 1e-12)
    t.close("cycle time = 8 + 2.6167", out[1][1], 8 + 157 / 60, 1e-12)
    t.equal("cycle productive share 75 %", fmt_web(out[2][1], 0), "75")
    t.close("cycle pallets/h = 60/10.6167", out[3][1], 5.651491366, 1e-8)
    t.equal("cycle verdict good", vd, "Good productive share.")
    t.true("cycle verdict < 70 % with tc = 2", o("cycle", tc=2)[1].startswith("Below 70 %"))
    out, vd = o("pallets")
    t.equal("pallets manned 6+6+2+1 = 15", out[0][1], 15)
    t.equal("pallets unmanned 3*(1+8) = 27", out[1][1], 27)
    t.close("pallets flow time 27/3 = 9 h", out[4][1], 9.0, 1e-12)
    t.true("pallets verdict: unmanned decides", vd.startswith("The unmanned shift"))
    out, vd = o("apc")
    t.close("apc u0 = 12/18", out[0][1], 200 / 3, 1e-9)
    t.close("apc u1 = 12/12.25", out[1][1], 100 * 12 / 12.25, 1e-9)
    t.equal("apc gain 47 %", fmt_web(out[2][1], 0), "47")
    out, vd = o("pool")
    t.close("pool stacker utilisation 12*45/3600 = 15 %", out[2][1], 15.0, 1e-9)
    t.equal("pool places 27 + 2", out[3][1], 29)
    out, vd = o("loadst")
    t.equal("loadst stations ceil(0.75/0.8) = 1", out[2][1], 1)
    t.equal("loadst verdict", vd, "One station is enough.")
    t.equal("loadst 2 stations when work/um is 2.0 exactly (1e-9 guard)", o("loadst", tl=32)[0][2][1], 2)
    out, vd = o("robot")
    t.close("robot moment 20*9.81*0.12 = 23.544", out[2][1], 23.544, 1e-9)
    t.equal("robot payload use 80 %", fmt_web(out[1][1], 0), "80")
    t.true("robot verdict ✓ (0.8 is allowed)", vd.startswith("✓ "))
    t.true("robot verdict ✗ for mp = 13", o("robot", mp=13)[1].startswith("✗ "))
    out, vd = o("agv")
    t.close("agv time per order 220 + 40", out[0][1], 260.0, 1e-12)
    t.close("agv vehicle-hours 24*260/3600", out[1][1], 1.733333333, 1e-8)
    t.equal("agv vehicles ceil(1.7333/0.7225) = 3", out[2][1], 3)
    t.equal("agv utilisation 58 %", fmt_web(out[3][1], 0), "58")
    out, vd = o("conv")
    t.close("conv carriers on the way 3.0", out[0][1], 3.0, 1e-12)
    t.equal("conv carriers ceil(19.2 + 3) = 23", out[1][1], 23)
    t.close("conv min speed 0.8 m/min", out[2][1], 0.8, 1e-12)
    out, vd = o("asrs")
    t.equal("asrs points text", out[0][2], "(8.0, 8.0) · (26.7, 2.4) m")
    t.close("asrs single cycle 11.6 + 14.8889 + 16 + 4", out[1][1], 46.488888889, 1e-8)
    t.close("asrs double cycle 11.6 + 12.2222 + 14.8889 + 32 + 4", out[2][1], 74.711111111, 1e-8)
    t.equal("asrs single throughput 77 moves/h", fmt_web(out[3][1], 0), "77")
    t.equal("asrs double throughput 96 moves/h", fmt_web(out[4][1], 0), "96")
    out, vd = o("tools")
    t.equal("tools sisters ceil(60/45) - 1 = 1", out[1][1], 1)
    t.equal("tools pockets ceil(107*1.1) = 118", out[2][1], 118)
    t.equal("tools verdict standard magazine", vd, "A standard magazine (60–120) is enough.")
    out, vd = o("wash")
    t.equal("wash washers 1", out[2][1], 1)
    t.equal("wash utilisation 33 %", fmt_web(out[3][1], 0), "33")
    out, vd = o("meas")
    t.close("meas T/U 7.5", out[0][1], 7.5, 1e-12)
    t.close("meas acceptance zone 22 µm", out[1][1], 22.0, 1e-12)
    t.close("meas CMM 16 %", out[2][1], 16.0, 1e-9)
    t.true("meas verdict ◐ and no CMM warning", vd.startswith("◐") and "CMM above" not in vd)
    out, vd = o("dmc")
    t.equal("dmc 18x18 for 20 characters", out[0][1], 18)
    t.close("dmc size 18*0.3 = 5.4 mm", out[1][1], 5.4, 1e-12)
    t.close("dmc with quiet zone 22*0.3 = 6.6 mm", out[2][1], 6.6, 1e-12)
    out, vd = o("grip")
    t.close("grip jaw force 12*19.81*2/0.24 = 1981 N", out[0][1], 1981.0, 1e-9)
    t.close("grip clamp force 2.5*3000/0.24 = 31250 N", out[1][1], 31250.0, 1e-9)
    out, vd = o("posit")
    t.close("posit rotation 600*9.81*0.08 = 470.88", out[0][1], 470.88, 1e-9)
    t.close("posit tilt 600*9.81*0.3 = 1765.8", out[2][1], 1765.8, 1e-9)
    t.equal("posit verdict inside", vd, "✓ Inside the ratings.")
    out, vd = o("tower")
    t.equal("tower places ceil(18*1.2) = 22", out[0][1], 22)
    t.equal("tower sheets ceil(600/19.1667) = 32", out[1][1], 32)
    t.equal("tower laser utilisation 94 %", fmt_web(out[2][1], 0), "94")
    out, vd = o("chips")
    t.close("chips 40*8*60*0.6*25/1000*3 = 864 l", out[0][1], 864.0, 1e-9)
    t.close("chips tank 600 l", out[1][1], 600.0, 1e-12)
    t.equal("17 calculators", len(CALC), 17)
    t.equal("web rounding: 87.5 -> 88 (half away from zero)", fmt_web(87.5, 0), "88")
    for bad, label in ((("agv", {"vv": 0}), "agv vv = 0 rejected"), (("cycle", {"tc": -1}), "negative input rejected"),
                       (("pool", {"zz": 1}), "unknown key rejected"), (("xyz", {}), "unknown calculator rejected")):
        try:
            compute(*bad)
            t.true(label, False)
        except InputError:
            t.true(label, True)
    # web cross-check: every default in web/fmse3.js equals ours
    from pathlib import Path
    import re
    web = Path(__file__).resolve().parents[2] / "web" / "fmse3.js"
    if web.is_file():
        txt = web.read_text(encoding="utf-8")
        diffs = []
        for calc, (_, inp, _, _) in CALC.items():
            m = re.search(r"\n  " + calc + r": \{ t: \"[^\"]*\", inp: \[(.*?)\],\n", txt, re.S)
            if not m:
                diffs.append(calc + " (not found)")
                continue
            web_inp = re.findall(r'\["(\w+)", "[^"]*", ([0-9.]+), ', m.group(1))
            mine = [(k, float(d)) for k, _, d, _ in inp]
            if [(k, float(d)) for k, d in web_inp] != mine:
                diffs.append(calc)
        t.true("inputs + defaults match web/fmse3.js CALC", not diffs, f"differ: {diffs}" if diffs else "")
    else:
        print("  SKIP  web/fmse3.js not found (default cross-check)")
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter, allow_abbrev=False,
        epilog="Examples:\n  python tools/fmse/element_sizing.py --list\n"
               "  python tools/fmse/element_sizing.py all\n"
               "  python tools/fmse/element_sizing.py pool --nm 4 --mv 50\n"
               "  python tools/fmse/element_sizing.py asrs --L 60 --H 18\n"
               "  python tools/fmse/element_sizing.py all --csv sizing.csv")
    ap.add_argument("--examples", default=str(ITEM3_EXAMPLES), help="item-3 example JSON (default: %(default)s)")
    ap.add_argument("--list", action="store_true", help="show all calculators with their inputs and defaults")
    ap.add_argument("--csv", help="write all results to this CSV file")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    subs = ap.add_subparsers(dest="calc", metavar="{" + ",".join(CALC) + ",all}")
    for calc, (title, inp, _, _) in CALC.items():
        sp = subs.add_parser(calc, help=title, allow_abbrev=False)
        for k, lab, d, u in inp:
            sp.add_argument(f"--{k}", type=float, help=f"{lab} [{u or '-'}] (default {d:g})")
        sp.add_argument("--csv", default=argparse.SUPPRESS, help="write the results to this CSV file")
    sp = subs.add_parser("all", help="run every calculator with the web defaults")
    sp.add_argument("--csv", default=argparse.SUPPRESS, help="write all results to this CSV file")
    a = ap.parse_args()
    if a.selftest:
        return selftest()
    if a.list:
        list_calcs()
        return 0
    data, basic = load_examples(a.examples, "basic_calculators")
    if abs(float(basic.get("_g", G)) - G) > 1e-12:
        raise InputError(f"basic_calculators._g = {basic.get('_g')} differs from 9.81 used by the web page")
    calcs = list(CALC) if a.calc in (None, "all") else [a.calc]
    rows = []
    for k, calc in enumerate(calcs):
        if k:
            print()
        vals = {key: getattr(a, key, None) for key, _, _, _ in CALC[calc][1]} if len(calcs) == 1 else {}
        v, out, verdict = show(calc, vals)
        for r in out:
            rows.append([calc, r[0], "" if r[3] < 0 else repr(float(r[1])), value_text(r), r[4]])
        rows.append([calc, "Verdict", "", verdict, ""])
    if a.calc is None:
        print("\n(no calculator given: all calculators shown with the web defaults; use --list for the inputs)")
    if a.csv:
        p = write_csv(a.csv, ["calculator", "result", "value_exact", "value_web", "with_numbers"], rows)
        print(f"CSV written: {p}")
    return 0


if __name__ == "__main__":
    run_main(main)
