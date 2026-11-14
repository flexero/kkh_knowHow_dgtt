#!/usr/bin/env python3
"""Process time and power estimators: first numbers before any supplier quote (± 20-30 %).

Python 3 standard library only, offline. Formulas = "_formulas" in examples/item2_examples.json.
Defaults come from the JSON sections "cutting", "taylor", "moulding", "bending", "welding";
every value can be changed with an option of the same name (e.g. turn --vc 180 --mat 2).

Subcommands (no subcommand = all of them with the default values):
  turn     n = 1000*vc/(pi*D); vf = f*n; t_c = passes*L/vf; Pc = kc*ap*f*vc/60000 kW; M = 9550*Pc/n
  mill     n = 1000*vc/(pi*Dc); vf = fz*z*n; t_c = passes*(L + Dc)/vf; Q = ap*ae*vf/1000 cm3/min;
           Pc = ap*ae*vf*kc/60e6 kW; M = 9550*Pc/n
  drill    n = 1000*vc/(pi*D); t_hole = (H + 0.3*D)/(f*n); Pc = f*vc*D*kc/240000 kW
  tap      n = 1000*vc/(pi*D); t = 2*(H + 2*P)/(P*n)   (in + out at the same speed)
  spindle  P_av(n) = min(P_rated, M_max*n/9550); n_b = 9550*P_rated/M_max;
           check Pc/eta <= P_av(n), eta = 0.8 (below n_b the torque limits, above the power)
  taylor   v*T^n = C -> T = (C/v)^(1/n);  T_min_cost = (1/n - 1)*(t_ct + K_t/(M/60));
           T_max_prod = (1/n - 1)*t_ct;  v = C/T^n
  mould    t_cool = s^2/(pi^2*alpha) * ln((8/pi^2)*(T_m - T_w)/(T_e - T_w));
           t_cycle = t_inject + t_hold + t_cool + t_open;  F = p_cav*A_proj*safety (1 bar*cm2 = 0.01 kN)
  bend     t = n_bends*t_bend + t_handling
  weld     t_arc = L_weld/v_weld
Units: mm, m/min, mm/rev, kW, N*m, rpm, min (cutting), s (moulding, bending, welding).
kc (specific cutting force, N/mm2) is taken from the materials list by index --mat.
"""

import argparse
import math

from fmse_common import ITEM2_EXAMPLES, InputError, SelfTest, fmt_table, load_examples, run_main

PI = math.pi

# subcommand -> (JSON section, sub key or None, list of numeric keys that can be overridden)
SPECS = {
    "turn": ("cutting", "turning", ["mat", "D", "L", "ap", "f", "vc", "passes"]),
    "mill": ("cutting", "milling", ["mat", "Dc", "z", "fz", "vc", "ap", "ae", "L", "passes"]),
    "drill": ("cutting", "drilling", ["mat", "D", "H", "f", "vc", "holes"]),
    "tap": ("cutting", "tapping", ["D", "P", "H", "vc", "holes"]),
    "spindle": ("cutting", "spindle", ["P_rated_kW", "M_max_Nm", "n_max", "eta"]),
    "taylor": ("taylor", None, ["n", "C", "rate_EUR_h", "K_t_EUR", "t_ct_min"]),
    "mould": ("moulding", None, ["s_mm", "alpha_mm2_s", "T_m", "T_w", "T_e", "A_proj_cm2", "p_cav_bar",
                                 "safety", "t_inject_s", "t_hold_s", "t_open_s"]),
    "bend": ("bending", None, ["n_bends", "t_bend_s", "t_handling_s"]),
    "weld": ("welding", None, ["L_weld_mm", "v_weld_m_min"]),
}


# ----------------------------------------------------------------------------- formulas
def kc_of(data, mat):
    mats = data["cutting"]["materials"]
    mat = int(mat)
    if not 0 <= mat < len(mats):
        raise InputError(f"--mat must be 0..{len(mats)-1}: " + ", ".join(f"{k}={m[0]}" for k, m in enumerate(mats)))
    return mats[mat][1], mats[mat][0]


def need_pos(p, keys):
    for k in keys:
        if p[k] is None or p[k] <= 0:
            raise InputError(f"{k} must be > 0")


def turning(p, kc):
    need_pos(p, ["D", "L", "ap", "f", "vc", "passes"])
    n = 1000 * p["vc"] / (PI * p["D"])
    vf = p["f"] * n
    tc = p["passes"] * p["L"] / vf
    Pc = kc * p["ap"] * p["f"] * p["vc"] / 60000
    return {"n": n, "vf": vf, "tc": tc, "Pc": Pc, "M": 9550 * Pc / n}


def milling(p, kc):
    need_pos(p, ["Dc", "z", "fz", "vc", "ap", "ae", "L", "passes"])
    n = 1000 * p["vc"] / (PI * p["Dc"])
    vf = p["fz"] * p["z"] * n
    tc = p["passes"] * (p["L"] + p["Dc"]) / vf
    Q = p["ap"] * p["ae"] * vf / 1000
    Pc = p["ap"] * p["ae"] * vf * kc / 60e6
    return {"n": n, "vf": vf, "tc": tc, "Q": Q, "Pc": Pc, "M": 9550 * Pc / n}


def drilling(p, kc):
    need_pos(p, ["D", "H", "f", "vc", "holes"])
    n = 1000 * p["vc"] / (PI * p["D"])
    th = (p["H"] + 0.3 * p["D"]) / (p["f"] * n)
    Pc = p["f"] * p["vc"] * p["D"] * kc / 240000
    return {"n": n, "t_hole": th, "t_all": th * p["holes"], "Pc": Pc, "M": 9550 * Pc / n}


def tapping(p):
    need_pos(p, ["D", "P", "H", "vc", "holes"])
    n = 1000 * p["vc"] / (PI * p["D"])
    t = 2 * (p["H"] + 2 * p["P"]) / (p["P"] * n)
    return {"n": n, "t_hole": t, "t_all": t * p["holes"]}


def spindle_check(sp, n, Pc):
    """Check a cut (speed n rpm, cutting power Pc kW) against the spindle power/torque curve."""
    need_pos(sp, ["P_rated_kW", "M_max_Nm", "n_max", "eta"])
    nb = 9550 * sp["P_rated_kW"] / sp["M_max_Nm"]
    P_av = min(sp["P_rated_kW"], sp["M_max_Nm"] * n / 9550)
    need = Pc / sp["eta"]
    M_need = 9550 * need / n if n > 0 else float("inf")
    limit = "torque" if n < nb else "power"
    ok_speed = n <= sp["n_max"]
    ok = ok_speed and need <= P_av + 1e-12
    return {"nb": nb, "P_av": P_av, "need": need, "M_need": M_need, "limit": limit, "ok": ok,
            "ok_speed": ok_speed, "reserve": 1 - need / P_av if P_av > 0 else -1}


def taylor_life(tp, v):
    if v <= 0:
        raise InputError("v must be > 0")
    return (tp["C"] / v) ** (1 / tp["n"])


def taylor_econ(tp):
    need_pos(tp, ["n", "C", "rate_EUR_h", "t_ct_min"])
    if tp["n"] >= 1:
        raise InputError("Taylor exponent n must be < 1")
    k = 1 / tp["n"] - 1
    T_mc = k * (tp["t_ct_min"] + tp["K_t_EUR"] / (tp["rate_EUR_h"] / 60))
    T_mp = k * tp["t_ct_min"]
    return {"k": k, "T_mc": T_mc, "v_mc": tp["C"] / T_mc ** tp["n"], "T_mp": T_mp, "v_mp": tp["C"] / T_mp ** tp["n"]}


def moulding(m):
    need_pos(m, ["s_mm", "alpha_mm2_s", "A_proj_cm2", "p_cav_bar", "safety"])
    if not m["T_m"] > m["T_e"] > m["T_w"]:
        raise InputError("need T_m (melt) > T_e (ejection) > T_w (mould wall)")
    f1 = m["s_mm"] ** 2 / (PI ** 2 * m["alpha_mm2_s"])
    arg = (8 / PI ** 2) * (m["T_m"] - m["T_w"]) / (m["T_e"] - m["T_w"])
    if arg <= 1:
        raise InputError("ln argument <= 1: ejection temperature too close to the melt temperature")
    t_cool = f1 * math.log(arg)
    cyc = m["t_inject_s"] + m["t_hold_s"] + t_cool + m["t_open_s"]
    F = m["p_cav_bar"] * m["A_proj_cm2"] * m["safety"] * 0.01
    return {"f1": f1, "arg": arg, "t_cool": t_cool, "cycle": cyc, "F": F, "per_h": 3600 / cyc}


def bending(b):
    return b["n_bends"] * b["t_bend_s"] + b["t_handling_s"]


def welding(w):
    need_pos(w, ["L_weld_mm", "v_weld_m_min"])
    t_min = w["L_weld_mm"] / 1000 / w["v_weld_m_min"]
    return {"t_min": t_min, "t_s": t_min * 60}


# ----------------------------------------------------------------------------- printing
def kv(rows):
    print(fmt_table(["quantity", "formula with numbers", "result"], rows, "llr"))


def show_turn(data, p):
    kc, mname = kc_of(data, p["mat"])
    r = turning(p, kc)
    print(f"TURNING   material {mname} (kc = {kc} N/mm2)   D {p['D']:g}, L {p['L']:g}, ap {p['ap']:g}, "
          f"f {p['f']:g}, vc {p['vc']:g}, passes {p['passes']:g}")
    kv([["spindle speed n", f"1000*{p['vc']:g}/(pi*{p['D']:g})", f"{r['n']:.1f} rpm"],
        ["feed speed vf", f"{p['f']:g}*{r['n']:.1f}", f"{r['vf']:.1f} mm/min"],
        ["cutting time t_c", f"{p['passes']:g}*{p['L']:g}/{r['vf']:.1f}", f"{r['tc']:.3f} min = {r['tc']*60:.1f} s"],
        ["cutting power Pc", f"{kc}*{p['ap']:g}*{p['f']:g}*{p['vc']:g}/60000", f"{r['Pc']:.3f} kW"],
        ["spindle power Pc/eta", f"{r['Pc']:.3f}/0.8", f"{r['Pc']/0.8:.3f} kW"],
        ["torque M", f"9550*{r['Pc']:.3f}/{r['n']:.1f}", f"{r['M']:.2f} N*m"]])
    return r


def show_mill(data, p):
    kc, mname = kc_of(data, p["mat"])
    r = milling(p, kc)
    print(f"MILLING   material {mname} (kc = {kc} N/mm2)   Dc {p['Dc']:g}, z {p['z']:g}, fz {p['fz']:g}, "
          f"vc {p['vc']:g}, ap {p['ap']:g}, ae {p['ae']:g}, L {p['L']:g}, passes {p['passes']:g}")
    kv([["spindle speed n", f"1000*{p['vc']:g}/(pi*{p['Dc']:g})", f"{r['n']:.1f} rpm"],
        ["feed speed vf", f"{p['fz']:g}*{p['z']:g}*{r['n']:.1f}", f"{r['vf']:.1f} mm/min"],
        ["cutting time t_c", f"{p['passes']:g}*({p['L']:g}+{p['Dc']:g})/{r['vf']:.1f}", f"{r['tc']:.3f} min = {r['tc']*60:.1f} s"],
        ["metal removal Q", f"{p['ap']:g}*{p['ae']:g}*{r['vf']:.1f}/1000", f"{r['Q']:.1f} cm3/min"],
        ["cutting power Pc", f"{p['ap']:g}*{p['ae']:g}*{r['vf']:.1f}*{kc}/60e6", f"{r['Pc']:.3f} kW"],
        ["spindle power Pc/eta", f"{r['Pc']:.3f}/0.8", f"{r['Pc']/0.8:.3f} kW"],
        ["torque M", f"9550*{r['Pc']:.3f}/{r['n']:.1f}", f"{r['M']:.2f} N*m"]])
    return r


def show_drill(data, p):
    kc, mname = kc_of(data, p["mat"])
    r = drilling(p, kc)
    print(f"DRILLING   material {mname} (kc = {kc} N/mm2)   D {p['D']:g}, H {p['H']:g}, f {p['f']:g}, "
          f"vc {p['vc']:g}, holes {p['holes']:g}")
    kv([["spindle speed n", f"1000*{p['vc']:g}/(pi*{p['D']:g})", f"{r['n']:.1f} rpm"],
        ["time per hole", f"({p['H']:g}+0.3*{p['D']:g})/({p['f']:g}*{r['n']:.1f})", f"{r['t_hole']:.4f} min = {r['t_hole']*60:.2f} s"],
        ["time all holes (cut only)", f"{p['holes']:g}*{r['t_hole']:.4f}", f"{r['t_all']:.3f} min = {r['t_all']*60:.1f} s"],
        ["cutting power Pc", f"{p['f']:g}*{p['vc']:g}*{p['D']:g}*{kc}/240000", f"{r['Pc']:.3f} kW"],
        ["torque M", f"9550*{r['Pc']:.3f}/{r['n']:.1f}", f"{r['M']:.2f} N*m"]])
    print("  (positioning between holes is not included - add 1-2 s per hole)")
    return r


def show_tap(p):
    r = tapping(p)
    print(f"TAPPING   M{p['D']:g}x{p['P']:g}, depth {p['H']:g}, vc {p['vc']:g}, holes {p['holes']:g}")
    kv([["spindle speed n", f"1000*{p['vc']:g}/(pi*{p['D']:g})", f"{r['n']:.1f} rpm"],
        ["time per hole (in + out)", f"2*({p['H']:g}+2*{p['P']:g})/({p['P']:g}*{r['n']:.1f})", f"{r['t_hole']:.4f} min = {r['t_hole']*60:.2f} s"],
        ["time all holes", f"{p['holes']:g}*{r['t_hole']:.4f}", f"{r['t_all']:.3f} min = {r['t_all']*60:.1f} s"]])
    return r


def show_spindle(data, sp, n=None, Pc=None):
    print(f"SPINDLE CHECK   P_rated {sp['P_rated_kW']:g} kW, M_max {sp['M_max_Nm']:g} N*m, n_max {sp['n_max']:g} rpm, "
          f"eta {sp['eta']:g}")
    nb = 9550 * sp["P_rated_kW"] / sp["M_max_Nm"]
    print(f"  base speed n_b = 9550*{sp['P_rated_kW']:g}/{sp['M_max_Nm']:g} = {nb:.1f} rpm  "
          f"(below n_b: torque limit, P_av = M_max*n/9550; above: power limit, P_av = P_rated)")
    if n is not None and Pc is not None:
        cuts = [("given cut", n, Pc)]
    else:
        c = data["cutting"]
        kt = kc_of(data, c["turning"]["mat"])[0]
        km = kc_of(data, c["milling"]["mat"])[0]
        kd = kc_of(data, c["drilling"]["mat"])[0]
        tr, mr, dr = turning(c["turning"], kt), milling(c["milling"], km), drilling(c["drilling"], kd)
        cuts = [("turning (default)", tr["n"], tr["Pc"]), ("milling (default)", mr["n"], mr["Pc"]),
                ("drilling (default)", dr["n"], dr["Pc"])]
    rows, res = [], []
    for name, nn, pc in cuts:
        r = spindle_check(sp, nn, pc)
        res.append((name, r))
        verdict = "OK" if r["ok"] else ("TOO FAST (n > n_max)" if not r["ok_speed"] else "NOT OK")
        rows.append([name, f"{nn:.1f}", f"{pc:.3f}", f"{r['need']:.3f}",
                     f"min({sp['P_rated_kW']:g}, {sp['M_max_Nm']:g}*{nn:.1f}/9550) = {r['P_av']:.3f}",
                     f"{r['M_need']:.2f}", r["limit"], f"{r['reserve']*100:.0f} %", verdict])
    print(fmt_table(["cut", "n rpm", "Pc kW", "Pc/eta kW", "P_av(n) kW", "M motor N*m (Pc/eta)", "limit", "reserve", "verdict"],
                    rows, "lrrrlrlrl"))
    print("  Look at the power-speed curve of the spindle, not only the maximum kW: at low speed the torque limits.")
    return res


def show_taylor(tp, v):
    T = taylor_life(tp, v)
    e = taylor_econ(tp)
    print(f"TAYLOR TOOL LIFE   v*T^n = C,  n = {tp['n']:g}, C = {tp['C']:g} m/min,  machine+labour M = "
          f"{tp['rate_EUR_h']:g} EUR/h, K_t = {tp['K_t_EUR']:g} EUR/edge, t_ct = {tp['t_ct_min']:g} min")
    kv([["tool life at v", f"({tp['C']:g}/{v:g})^(1/{tp['n']:g})", f"{T:.2f} min"],
        ["T min cost", f"({1/tp['n']:g}-1)*({tp['t_ct_min']:g}+{tp['K_t_EUR']:g}/({tp['rate_EUR_h']:g}/60))", f"{e['T_mc']:.2f} min"],
        ["v min cost", f"{tp['C']:g}/{e['T_mc']:.2f}^{tp['n']:g}", f"{e['v_mc']:.1f} m/min"],
        ["T max production", f"({1/tp['n']:g}-1)*{tp['t_ct_min']:g}", f"{e['T_mp']:.2f} min"],
        ["v max production", f"{tp['C']:g}/{e['T_mp']:.2f}^{tp['n']:g}", f"{e['v_mp']:.1f} m/min"]])
    print("  Run between v_min_cost and v_max_prod (the 'high-efficiency range'); near v_max_prod only for a bottleneck.")
    return T, e


def show_mould(m):
    r = moulding(m)
    print(f"INJECTION MOULDING   wall s {m['s_mm']:g} mm, alpha {m['alpha_mm2_s']:g} mm2/s, T_melt {m['T_m']:g}, "
          f"T_wall {m['T_w']:g}, T_eject {m['T_e']:g} C")
    kv([["cooling time t_cool", f"{m['s_mm']:g}^2/(pi^2*{m['alpha_mm2_s']:g}) * ln(8/pi^2*({m['T_m']:g}-{m['T_w']:g})/({m['T_e']:g}-{m['T_w']:g}))"
         f" = {r['f1']:.4f}*ln({r['arg']:.4f})", f"{r['t_cool']:.2f} s"],
        ["cycle time", f"{m['t_inject_s']:g} + {m['t_hold_s']:g} + {r['t_cool']:.2f} + {m['t_open_s']:g}", f"{r['cycle']:.2f} s"],
        ["shots per hour", f"3600/{r['cycle']:.2f}", f"{r['per_h']:.0f} /h"],
        ["clamp force F", f"{m['p_cav_bar']:g} bar*{m['A_proj_cm2']:g} cm2*{m['safety']:g}*0.01", f"{r['F']:.1f} kN = {r['F']/9.81:.1f} t"]])
    return r


def show_bend(b):
    t = bending(b)
    print("PRESS-BRAKE BENDING")
    kv([["time per part", f"{b['n_bends']:g}*{b['t_bend_s']:g} + {b['t_handling_s']:g}", f"{t:.1f} s"],
        ["parts per hour (100 %)", f"3600/{t:.1f}", f"{3600/t:.1f} /h"]])
    return t


def show_weld(w):
    r = welding(w)
    print("ARC WELDING (arc time only)")
    kv([["arc time", f"{w['L_weld_mm']:g} mm/1000 / {w['v_weld_m_min']:g} m/min", f"{r['t_min']:.2f} min = {r['t_s']:.0f} s"]])
    print("  Robot cycle = arc + air moves / arc starts per seam + torch cleaning + index (see docs/62).")
    return r


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("process_time")
    data, c = load_examples(path, "cutting")
    tr = turning(c["turning"], 1900)
    t.close("turn n", tr["n"], 1061.0329539, 1e-6)
    t.close("turn t_c min", tr["tc"], 1.357168026, 1e-8)
    t.close("turn Pc kW = 190000/60000", tr["Pc"], 3.1666666667, 1e-9)
    t.close("turn M N*m", tr["M"], 28.502099, 1e-5)
    mr = milling(c["milling"], 1100)
    t.close("mill n", mr["n"], 636.6197724, 1e-6)
    t.close("mill vf", mr["vf"], 763.9437268, 1e-6)
    t.close("mill t_c min", mr["tc"], 0.9948376736, 1e-8)
    t.close("mill Q cm3/min", mr["Q"], 183.3464944, 1e-6)
    t.close("mill Pc kW", mr["Pc"], 3.3613524, 1e-6)
    t.close("mill M = 9550*Pc/n (= 50.424 exactly)", mr["M"], 50.424, 1e-9)
    dr = drilling(c["drilling"], 1100)
    t.close("drill t per hole s", dr["t_hole"] * 60, 2.4881414, 1e-6)
    t.close("drill Pc kW = 275000/240000", dr["Pc"], 1.1458333333, 1e-9)
    tp = tapping(c["tapping"])
    t.close("tap t per hole s", tp["t_hole"] * 60, 4.8171087, 1e-6)
    t.close("tap 12 holes min", tp["t_all"], 0.9634217, 1e-6)
    s = spindle_check(c["spindle"], mr["n"], mr["Pc"])
    t.close("base speed n_b", s["nb"], 1432.5, 1e-9)
    t.close("P_av at mill speed = 120*636.62/9550", s["P_av"], 7.99941075, 1e-7)
    t.true("milling cut OK on the spindle", s["ok"])
    t.equal("milling cut limit", s["limit"], "torque")
    s2 = spindle_check(c["spindle"], 2000, 16)          # 16/0.8 = 20 kW > 18 kW
    t.true("20 kW needed at 2000 rpm is NOT OK (power limit)", not s2["ok"] and s2["limit"] == "power")
    tl = data["taylor"]
    t.close("Taylor T at 200 m/min = 2^4", taylor_life(tl, 200), 16.0, 1e-9)
    e = taylor_econ(tl)
    t.close("T min cost = 3*(1+6/1.5)", e["T_mc"], 15.0, 1e-9)
    t.close("v min cost", e["v_mc"], 203.2530993, 1e-6)
    t.close("T max prod = 3*1", e["T_mp"], 3.0, 1e-9)
    t.close("v max prod", e["v_mp"], 303.9342743, 1e-6)
    m = moulding(data["moulding"])
    t.close("cooling time s", m["t_cool"], 7.9155967, 1e-6)
    t.close("mould cycle s", m["cycle"], 18.4155967, 1e-6)
    t.close("clamp force kN = 350*180*1.2*0.01", m["F"], 756.0, 1e-9)
    t.close("bending s = 6*9+20", bending(data["bending"]), 74.0, 1e-12)
    t.close("arc time s = 1.8 m / 0.6 m/min", welding(data["welding"])["t_s"], 180.0, 1e-9)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def params(data, cmd, args):
    sec, sub, keys = SPECS[cmd]
    if sec not in data:
        raise InputError(f"section '{sec}' is missing in the JSON")
    base = dict(data[sec][sub] if sub else data[sec])
    for k in keys:
        v = getattr(args, k, None)
        if v is not None:
            base[k] = v
        elif k not in base:
            raise InputError(f"{sec}{'.' + sub if sub else ''}: value '{k}' is missing")
    return base


def run_cmd(data, cmd, args):
    p = params(data, cmd, args)
    if cmd == "turn":
        show_turn(data, p)
    elif cmd == "mill":
        show_mill(data, p)
    elif cmd == "drill":
        show_drill(data, p)
    elif cmd == "tap":
        show_tap(p)
    elif cmd == "spindle":
        n, pc = getattr(args, "check_n", None), getattr(args, "check_Pc", None)
        if (n is None) != (pc is None):
            raise InputError("spindle: give both --check-n and --check-Pc, or none")
        if n is not None and n <= 0:
            raise InputError("--check-n must be > 0")
        show_spindle(data, p, n, pc)
    elif cmd == "taylor":
        show_taylor(p, getattr(args, "v", None) or 200.0)
    elif cmd == "mould":
        show_mould(p)
    elif cmd == "bend":
        show_bend(p)
    elif cmd == "weld":
        show_weld(p)


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n  python tools/fmse/process_time.py                 (all estimators, JSON defaults)\n"
               "  python tools/fmse/process_time.py turn --vc 180 --mat 2\n"
               "  python tools/fmse/process_time.py spindle --check-n 800 --check-Pc 9\n"
               "  python tools/fmse/process_time.py taylor --v 250")
    ap.add_argument("--examples", default=str(ITEM2_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    subs = ap.add_subparsers(dest="cmd", metavar="{" + ",".join(SPECS) + "}")
    for cmd, (sec, sub, keys) in SPECS.items():
        sp = subs.add_parser(cmd, help=f"defaults from JSON '{sec}{'.' + sub if sub else ''}'")
        for k in keys:
            sp.add_argument(f"--{k}", type=float, help=f"override '{k}'" + (" (material index)" if k == "mat" else ""))
        if cmd == "spindle":
            sp.add_argument("--check-n", dest="check_n", type=float, help="speed of the cut to check [rpm]")
            sp.add_argument("--check-Pc", dest="check_Pc", type=float, help="cutting power of the cut [kW]")
        if cmd == "taylor":
            sp.add_argument("--v", type=float, help="cutting speed for the tool-life question (default 200 m/min)")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    data, _ = load_examples(a.examples, "cutting")
    if a.cmd:
        run_cmd(data, a.cmd, a)
    else:
        print("Materials (index for --mat): " + ", ".join(f"{k} = {m[0]} (kc {m[1]})"
                                                      for k, m in enumerate(data["cutting"]["materials"])))
        for cmd in SPECS:
            print()
            run_cmd(data, cmd, a)
    return 0


if __name__ == "__main__":
    run_main(main)
