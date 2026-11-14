#!/usr/bin/env python3
"""Assembly, test and vision station checks (item 3: M13 assembly, M14 test, vision systems).

Python 3 standard library only, offline. Formulas = "_formulas" in examples/item3_examples.json,
defaults = JSON sections screw_preload, press_fit, leak_test, vision. Change any value with an option
of the same name (e.g. screw --T_Nm 30).

Subcommands (no subcommand = all four):
  screw     F_preload = T/(K*d)   [N; T in N m, d in m, K = nut factor]; use of proof load = F/F_proof
  pressfit  p = E*delta/(2*d)*(1 - (d/D)^2)  [MPa; solid shaft in a hub, same material, delta = diametral
            interference, d and delta in mm];  F_press = p*pi*d*L*mu  [N]
  leak      Q = V*dp/dt [mbar l/s; V l, dp mbar, dt s];  Q_cm3_min = Q*60 (1 mbar l/s ~ 1 cm3/s at 1 bar);
            temperature error dp_T = p_abs*dT/T_abs [mbar] compared with the limit pressure drop dp
  vision    pixel = FOV/pixels (worst of x and y);  px per defect = defect/pixel, rule >= 3 px;
            repeatability ~ pixel/10 (sub-pixel, good lighting)

Rules of thumb used for the verdicts that are NOT in the JSON (marked "rule of thumb" in the output):
  screw  preload 50-80 % of the proof load is the normal window (VDI 2230: about 70 % utilisation of the
         yield strength at assembly); > 90 %: risk of yielding; < 50 %: joint may open / loosen
  leak   dp_T >= dp: NOT OK (the temperature alone can fake or hide the leak); dp_T > 10 % of dp: marginal,
         stabilise temperature or use a reference volume (differential test); <= 10 %: OK
"""

import argparse
import math

from fmse_common import ITEM3_EXAMPLES, InputError, SelfTest, fmt_table, load_examples, run_main

SPECS = {
    "screw": ("screw_preload", ["T_Nm", "K", "d_mm", "proof_load_N"]),
    "pressfit": ("press_fit", ["d_mm", "D_mm", "L_mm", "delta_mm", "E_MPa", "mu"]),
    "leak": ("leak_test", ["V_l", "dp_mbar", "dt_s", "p_abs_mbar", "dT_K", "T_K"]),
    "vision": ("vision", ["fov_x_mm", "fov_y_mm", "px_x", "px_y", "defect_mm"]),
}


def need_pos(p, keys, sec):
    for k in keys:
        if k not in p:
            raise InputError(f"{sec}: value '{k}' is missing")
        if not p[k] > 0:
            raise InputError(f"{sec}: '{k}' must be > 0")


def screw(p):
    need_pos(p, SPECS["screw"][1], "screw_preload")
    F = p["T_Nm"] / (p["K"] * p["d_mm"] / 1000)
    use = F / p["proof_load_N"]
    key = "high" if use > 0.9 else "ok" if use >= 0.5 else "low"
    return {"F": F, "use": use, "key": key}


def pressfit(p):
    need_pos(p, SPECS["pressfit"][1], "press_fit")
    if p["D_mm"] <= p["d_mm"]:
        raise InputError("press_fit: hub outer diameter D must be larger than the joint diameter d")
    k = 1 - (p["d_mm"] / p["D_mm"]) ** 2
    pr = p["E_MPa"] * p["delta_mm"] / (2 * p["d_mm"]) * k
    F = pr * math.pi * p["d_mm"] * p["L_mm"] * p["mu"]
    return {"k": k, "p": pr, "F": F}


def leak(p):
    need_pos(p, SPECS["leak"][1], "leak_test")
    Q = p["V_l"] * p["dp_mbar"] / p["dt_s"]
    dpT = p["p_abs_mbar"] * p["dT_K"] / p["T_K"]
    ratio = dpT / p["dp_mbar"]
    key = "no" if ratio >= 1 else "marginal" if ratio > 0.1 else "ok"
    dT_ok = 0.1 * p["dp_mbar"] * p["T_K"] / p["p_abs_mbar"]        # dT that gives dp_T = 10 % of dp
    return {"Q": Q, "cm3": Q * 60, "dpT": dpT, "ratio": ratio, "key": key, "dT_10": dT_ok}


def vision(p):
    need_pos(p, SPECS["vision"][1], "vision")
    px, py = p["fov_x_mm"] / p["px_x"], p["fov_y_mm"] / p["px_y"]
    pix = max(px, py)
    n = p["defect_mm"] / pix
    return {"px": px, "py": py, "pix": pix, "n": n, "ok": n >= 3, "rep": pix / 10,
            "min_defect": 3 * pix}


def kv(rows):
    print(fmt_table(["quantity", "formula with numbers", "result"], rows, "llr"))


def show_screw(p):
    r = screw(p)
    print("SCREWDRIVING - PRELOAD FROM TORQUE   " + ", ".join(f"{k} {p[k]:g}" for k in SPECS["screw"][1]))
    kv([["preload F = T/(K·d)", f"{p['T_Nm']:g}/({p['K']:g}·{p['d_mm']:g}/1000)", f"{r['F']:.0f} N"],
        ["use of proof load", f"{r['F']:.0f}/{p['proof_load_N']:g}", f"{100 * r['use']:.1f} %"]])
    txt = {"ok": "OK - inside the normal window 50–80 % (rule of thumb)" if r["use"] <= 0.8 else
           "OK but high (80–90 %) - check with VDI 2230 (rule of thumb)",
           "high": "NOT OK - above 90 % of the proof load, risk of yielding (rule of thumb)",
           "low": "LOW - below 50 % of the proof load, joint may loosen (rule of thumb)"}[r["key"]]
    print(f"Verdict: {txt}")
    print(f"  K scatters ± 20–30 % (lubrication) -> preload {r['F'] * 0.75:.0f}–{r['F'] * 1.25:.0f} N for ± 25 %. "
          "Use torque + angle monitoring at the station.")
    if "_note" in p:
        print(f"  JSON note: {p['_note']}")
    return r


def show_pressfit(p):
    r = pressfit(p)
    print("PRESS-FIT   " + ", ".join(f"{k} {p[k]:g}" for k in SPECS["pressfit"][1]))
    kv([["thick-wall factor 1 − (d/D)²", f"1 − ({p['d_mm']:g}/{p['D_mm']:g})²", f"{r['k']:.4f}"],
        ["joint pressure p = E·δ/(2d)·(1 − (d/D)²)", f"{p['E_MPa']:g}·{p['delta_mm']:g}/(2·{p['d_mm']:g})·{r['k']:.4f}",
         f"{r['p']:.2f} MPa"],
        ["press force F = p·π·d·L·μ", f"{r['p']:.2f}·π·{p['d_mm']:g}·{p['L_mm']:g}·{p['mu']:g}", f"{r['F']:.0f} N = {r['F'] / 1000:.2f} kN"]])
    print(f"  Press size: take ≈ 1.5–2 × F as rated force ({1.5 * r['F'] / 1000:.1f}–{2 * r['F'] / 1000:.1f} kN) and monitor "
          "the force-distance curve (window / envelope) for every part.")
    return r


def show_leak(p):
    r = leak(p)
    print("LEAK TEST (pressure decay)   " + ", ".join(f"{k} {p[k]:g}" for k in SPECS["leak"][1]))
    kv([["leak rate Q = V·dp/dt", f"{p['V_l']:g}·{p['dp_mbar']:g}/{p['dt_s']:g}", f"{r['Q']:.4g} mbar l/s"],
        ["in cm³/min", f"{r['Q']:.4g}·60", f"{r['cm3']:.2f} cm³/min"],
        ["temperature error dp_T = p_abs·dT/T", f"{p['p_abs_mbar']:g}·{p['dT_K']:g}/{p['T_K']:g}", f"{r['dpT']:.3f} mbar"],
        ["dp_T compared with the limit dp", f"{r['dpT']:.3f}/{p['dp_mbar']:g}", f"{100 * r['ratio']:.0f} %"]])
    txt = {"no": f"NOT OK - a temperature change of only {p['dT_K']:g} K gives {r['dpT']:.2f} mbar, more than the limit "
                 f"pressure drop {p['dp_mbar']:g} mbar: the test cannot tell a leak from a temperature drift.",
           "marginal": "MARGINAL - the temperature error is more than 10 % of the limit.",
           "ok": "OK - the temperature error is ≤ 10 % of the limit."}[r["key"]]
    print(f"Verdict: {txt}" + ("" if r["key"] == "no" else " (10 % limit = rule of thumb)"))
    if r["key"] != "ok":
        print(f"  For dp_T ≤ 10 % of dp the part temperature may change only {r['dT_10']:.4f} K during the test: wash parts "
              "must cool down first, use a differential test (reference part) or temperature compensation, or a "
              "longer test time / lower test pressure.")
    return r


def show_vision(p):
    r = vision(p)
    print("VISION - RESOLUTION   " + ", ".join(f"{k} {p[k]:g}" for k in SPECS["vision"][1]))
    kv([["pixel size x = FOV_x/px_x", f"{p['fov_x_mm']:g}/{p['px_x']:g}", f"{r['px']:.5f} mm"],
        ["pixel size y = FOV_y/px_y", f"{p['fov_y_mm']:g}/{p['px_y']:g}", f"{r['py']:.5f} mm"],
        ["pixel size used (worst)", f"max({r['px']:.5f}, {r['py']:.5f})", f"{r['pix']:.5f} mm"],
        ["pixels per defect", f"{p['defect_mm']:g}/{r['pix']:.5f}", f"{r['n']:.2f} px"],
        ["smallest defect for 3 px", f"3·{r['pix']:.5f}", f"{r['min_defect']:.3f} mm"],
        ["measurement repeatability ≈ pixel/10", f"{r['pix']:.5f}/10", f"{r['rep']:.4f} mm"]])
    print(f"Verdict: {'OK' if r['ok'] else 'NOT OK'} - rule: ≥ 3 px per defect for detection"
          + ("" if r["ok"] else " -> smaller field of view or a camera with more pixels."))
    print("  Repeatability pixel/10 only with good lighting (telecentric / backlight for edges) and a calibrated camera.")
    return r


SHOW = {"screw": show_screw, "pressfit": show_pressfit, "leak": show_leak, "vision": show_vision}


def selftest(path):
    t = SelfTest("assembly_test")
    data, _ = load_examples(path, "screw_preload")
    s = screw(data["screw_preload"])
    t.close("preload 25/(0.2*0.008) = 15625 N", s["F"], 15625.0, 1e-9)
    t.close("proof load use 15625/23500 = 0.66489", s["use"], 0.664893617, 1e-8)
    t.equal("screw verdict ok", s["key"], "ok")
    pf = pressfit(data["press_fit"])
    t.close("press-fit p = 105*0.75 = 78.75 MPa", pf["p"], 78.75, 1e-9)
    t.close("press force 78.75*pi*20*25*0.12 = 4725*pi N", pf["F"], 4725 * math.pi, 1e-8)
    lk = leak(data["leak_test"])
    t.close("leak Q = 0.5*2/10 = 0.1 mbar l/s", lk["Q"], 0.1, 1e-12)
    t.close("leak 6 cm3/min", lk["cm3"], 6.0, 1e-12)
    t.close("temperature error 7013*0.1/293.15 = 2.39229 mbar", lk["dpT"], 2.392290636, 1e-8)
    t.equal("leak verdict NOT OK (2.39 > 2.0)", lk["key"], "no")
    t.equal("leak dT 0.005 K -> ok", leak(dict(data["leak_test"], dT_K=0.005))["key"], "ok")
    vs = vision(data["vision"])
    t.close("pixel x 120/2448 = 0.0490196 mm (worst)", vs["pix"], 120 / 2448, 1e-15)
    t.close("px per defect 0.3*2448/120 = 6.12", vs["n"], 6.12, 1e-12)
    t.true("vision OK (>= 3 px)", vs["ok"])
    t.close("repeatability 0.0049 mm", vs["rep"], 0.00490196, 1e-8)
    try:
        pressfit(dict(data["press_fit"], D_mm=20))
        t.true("D <= d rejected", False)
    except InputError:
        t.true("D <= d rejected", True)
    return t.finish()


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter, allow_abbrev=False,
        epilog="Examples:\n  python tools/fmse/assembly_test.py\n"
               "  python tools/fmse/assembly_test.py screw --T_Nm 30\n"
               "  python tools/fmse/assembly_test.py pressfit --delta_mm 0.03\n"
               "  python tools/fmse/assembly_test.py leak --dT_K 0.01\n"
               "  python tools/fmse/assembly_test.py vision --fov_x_mm 60 --fov_y_mm 45")
    ap.add_argument("--examples", default=str(ITEM3_EXAMPLES), help="item-3 example JSON (default: %(default)s)")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    subs = ap.add_subparsers(dest="cmd", metavar="{" + ",".join(SPECS) + "}")
    for cmd, (sec, keys) in SPECS.items():
        sp = subs.add_parser(cmd, help=f"defaults from JSON '{sec}'", allow_abbrev=False)
        for k in keys:
            sp.add_argument(f"--{k}", type=float, help=f"override '{k}'")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    data, _ = load_examples(a.examples, "screw_preload")
    for k, cmd in enumerate([a.cmd] if a.cmd else list(SPECS)):
        sec, keys = SPECS[cmd]
        if sec not in data:
            raise InputError(f"section '{sec}' is missing in the JSON")
        p = dict(data[sec])
        for key in keys:
            if getattr(a, key, None) is not None:
                p[key] = getattr(a, key)
        if k:
            print()
        SHOW[cmd](p)
    return 0


if __name__ == "__main__":
    run_main(main)
