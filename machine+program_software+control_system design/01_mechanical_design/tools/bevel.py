#!/usr/bin/env python3
"""M5b bevel gear program - straight and spiral bevel gears (shaft angle Sigma): cone geometry (ISO 23509 / DIN 3971
style, constant-clearance standard-depth teeth), virtual cylindrical gears (Tredgold), contact ratios, forces with hand of
spiral and direction of rotation, load capacity in the style of ISO 10300 (through the virtual cylindrical gears, using the
M5 tooth-form code), blank and inspection data (outer / face / root angles, crown-to-apex, chordal thickness), and data for
the cutting process. Guide: 05b_bevel_gears.md.

Python standard library only (offline). Every number of the guide comes from this file.

Commands
  python bevel.py params | run [--in p.json] [--out folder] | examples | selftest
  python bevel.py ch24 | ch56 | ch78        extra results of guide chapters 2-4, 5-6, 7-8
  python bevel.py run --in examples/bevel_example.json --out example   worked design example (chapter 8)

ISO 10300 and ISO 23509 are implemented in a SIMPLIFIED form (virtual-gear method, bevel factor Z_K, K_Hbeta = 1.5 K_Hbeta-be,
Gleason-style addendum modification); values marked 'check' in the guide must be compared with ISO 10300-1/-2/-3 (2014) and
ISO 23509 (2016) or the gear-cutting machine maker's summary before a design is released. All default numbers are EXAMPLES.
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gear  # noqa: E402  (M5: involute functions, form factor method B, materials)

DEFAULT = {
    "name": "Spiral bevel right-angle stage 7.5 kW for a conveyor / rotary-table drive (example)",
    "kind": "spiral",                 # straight | spiral (zerol = spiral with beta_m 0)
    "z1": 17, "z2": 43, "Sigma_deg": 90.0,
    "met": 3.0,                       # outer transverse module mm
    "b": 18.0,                        # face width mm (<= Re/3 and <= 10 met)
    "beta_m_deg": 35.0,               # mean spiral angle (0 for straight / zerol)
    "hand1": "left",                  # hand of spiral of the pinion: left | right
    "rotation1": "cw",                # pinion rotation seen from the back (cone apex away from the viewer): cw | ccw
    "alpha_n_deg": 20.0,
    "x1": None,                       # addendum modification (None -> Gleason style 0.39 (1 - 1/u^2) for spiral / 0.46 (1 - 1/u^2) straight)
    "haP": 1.0, "hfP": 1.25,          # at the mean section, factors of m_mn
    "P_kW": 7.5, "n1_rpm": 1450.0,
    "KA": 1.25, "KHbeta_be": 1.25,    # mounting factor (one member straddle mounted ~1.1, both cantilever ~1.25: check)
    "accuracy_grade": 7,
    "material1": "18CrNiMo7-6 case hardened", "material2": "18CrNiMo7-6 case hardened",
    "ZK": 0.85,                       # bevel gear factor for pitting (check ISO 10300-2)
    "SHmin": 1.0, "SFmin": 1.4, "ZLVR": 0.95,   # lapped flanks ~0.95, ground ~1.0 (example)
    "back_face_to_apex_mm": None,     # design mounting: pinion back face to the crossing point (None = report only)
    "thickness_allowance_um": -40,
}

def _hand_sign(P):
    return 1 if P["hand1"] == "left" else -1

# ---------------------------------------------------------------- chapter 3: cone geometry
def geometry(P):
    """Cone geometry at the outer (heel) and mean section, constant clearance standard-depth teeth."""
    z1, z2, S = P["z1"], P["z2"], math.radians(P["Sigma_deg"])
    u = z2 / z1
    d1 = math.atan(math.sin(S) / (math.cos(S) + u))          # pitch angle pinion
    d2 = S - d1
    met = P["met"]
    de1, de2 = met * z1, met * z2
    Re = de1 / (2 * math.sin(d1))
    b = P["b"]
    Rm = Re - b / 2
    mmt = met * Rm / Re
    bm = math.radians(P["beta_m_deg"])
    mmn = mmt * math.cos(bm)
    dm1, dm2 = mmt * z1, mmt * z2
    an = math.radians(P["alpha_n_deg"])
    x1 = P["x1"]
    if x1 is None:
        x1 = (0.39 if P["kind"] == "spiral" else 0.46) * (1 - 1 / u ** 2)
    x2 = -x1
    ham1, ham2 = (P["haP"] + x1) * mmn, (P["haP"] + x2) * mmn
    hfm1, hfm2 = (P["hfP"] - x1) * mmn, (P["hfP"] - x2) * mmn
    # constant clearance: tip angle of one member = root angle of the other
    thf1, thf2 = math.atan(hfm1 / Rm), math.atan(hfm2 / Rm)
    tha1, tha2 = thf2, thf1
    hae1, hae2 = ham1 + b / 2 * math.tan(tha1), ham2 + b / 2 * math.tan(tha2)
    hfe1, hfe2 = hfm1 + b / 2 * math.tan(thf1), hfm2 + b / 2 * math.tan(thf2)
    dae1, dae2 = de1 + 2 * hae1 * math.cos(d1), de2 + 2 * hae2 * math.cos(d2)
    # crown to apex (along the axis) and back cone
    xa1 = Re * math.cos(d1) - hae1 * math.sin(d1)
    xa2 = Re * math.cos(d2) - hae2 * math.sin(d2)
    # virtual cylindrical gears (Tredgold, mean section); spiral -> virtual helical, then virtual spur in the normal section
    dv1, dv2 = dm1 / math.cos(d1), dm2 / math.cos(d2)
    zv1, zv2 = z1 / math.cos(d1), z2 / math.cos(d2)
    at = math.atan(math.tan(an) / math.cos(bm))
    bb = math.asin(math.sin(bm) * math.cos(an))
    zvn1 = zv1 / (math.cos(bb) ** 2 * math.cos(bm))
    zvn2 = zv2 / (math.cos(bb) ** 2 * math.cos(bm))
    uv = zv2 / zv1
    dva1, dva2 = dv1 + 2 * ham1, dv2 + 2 * ham2
    dvb1, dvb2 = dv1 * math.cos(at), dv2 * math.cos(at)
    av = (dv1 + dv2) / 2
    ga = 0.5 * (math.sqrt(dva1 ** 2 - dvb1 ** 2) + math.sqrt(dva2 ** 2 - dvb2 ** 2)) - av * math.sin(at)
    eva = ga / (math.pi * mmt * math.cos(at))
    evb = b * math.sin(bm) / (math.pi * mmn) if bm > 0 else 0.0
    # face width limits
    checks = {"b_le_Re_3": b <= Re / 3 + 1e-9, "b_le_10met": b <= 10 * met + 1e-9}
    return {"u": u, "delta1": d1, "delta2": d2, "de1": de1, "de2": de2, "Re": Re, "Rm": Rm, "mmt": mmt, "mmn": mmn,
            "dm1": dm1, "dm2": dm2, "x1": x1, "x2": x2, "ham1": ham1, "ham2": ham2, "hfm1": hfm1, "hfm2": hfm2,
            "hae1": hae1, "hae2": hae2, "hfe1": hfe1, "hfe2": hfe2, "theta_a1": tha1, "theta_a2": tha2,
            "theta_f1": thf1, "theta_f2": thf2, "face_angle1": d1 + tha1, "face_angle2": d2 + tha2,
            "root_angle1": d1 - thf1, "root_angle2": d2 - thf2, "dae1": dae1, "dae2": dae2, "crown_to_apex1": xa1,
            "crown_to_apex2": xa2, "dv1": dv1, "dv2": dv2, "zv1": zv1, "zv2": zv2, "zvn1": zvn1, "zvn2": zvn2, "uv": uv,
            "alpha_t": at, "beta_b": bb, "eps_va": eva, "eps_vb": evb, "eps_vg": eva + evb, "checks": checks}

# ---------------------------------------------------------------- chapter 4: forces
def forces(P, g):
    """Forces on the pinion at the mean section (driving pinion). Ft = 2 T1 / dm1.
    Spiral: Fa1 = Ft/cos(bm) (tan(an) sin(d1) + s sin(bm) cos(d1)), Fr1 = Ft/cos(bm) (tan(an) cos(d1) - s sin(bm) sin(d1)),
    s = +1 when the pinion's spiral hand and rotation push it away from the apex (left hand + cw or right hand + ccw seen from
    the back), else -1. Straight: s term = 0. Positive Fa1 = away from the cone apex; positive Fr1 = towards the pinion axis
    (separating). For Sigma = 90 deg: Fa2 = Fr1, Fr2 = Fa1."""
    T1 = P["P_kW"] * 1000 / (P["n1_rpm"] * 2 * math.pi / 60)
    Ft = 2 * T1 * 1000 / g["dm1"]
    an, bm, d1 = math.radians(P["alpha_n_deg"]), math.radians(P["beta_m_deg"]), g["delta1"]
    if P["kind"] == "straight" or bm == 0:
        s = 0
    else:
        s = 1 if (P["hand1"] == "left") == (P["rotation1"] == "cw") else -1
    Fa1 = Ft / math.cos(bm) * (math.tan(an) * math.sin(d1) + s * math.sin(bm) * math.cos(d1))
    Fr1 = Ft / math.cos(bm) * (math.tan(an) * math.cos(d1) - s * math.sin(bm) * math.sin(d1))
    d2 = g["delta2"]
    Fa2 = Ft / math.cos(bm) * (math.tan(an) * math.sin(d2) - s * math.sin(bm) * math.cos(d2))
    Fr2 = Ft / math.cos(bm) * (math.tan(an) * math.cos(d2) + s * math.sin(bm) * math.sin(d2))
    v = math.pi * g["dm1"] / 1000 * P["n1_rpm"] / 60
    return {"T1": T1, "T2": T1 * g["u"], "Ft": Ft, "Fa1": Fa1, "Fr1": Fr1, "Fa2": Fa2, "Fr2": Fr2, "s": s, "v": v,
            "n2": P["n1_rpm"] / g["u"]}

# ---------------------------------------------------------------- chapter 5: load capacity (virtual cylindrical gears)
def capacity(P):
    """ISO 10300 style through the virtual cylindrical gear pair at the mean section (simplified):
    sigma_H = Z_H Z_E Z_eps Z_beta Z_K sqrt(Ft/(dv1 b_eff) (uv + 1)/uv) sqrt(K_A K_V K_Hbeta K_Halpha), K_Hbeta = 1.5 K_Hbeta-be,
    b_eff = 0.85 b (typical contact length); root: sigma_F = Ft/(b_eff m_mn) Y_F Y_S Y_beta K_A K_V K_Fbeta (form factors of the
    virtual gears by the M5 method B code)."""
    g = geometry(P)
    if g["delta2"] >= math.pi / 2 or g["delta1"] >= math.pi / 2:
        raise ValueError("pitch angle >= 90 deg (internal / crown bevel gear): the virtual-gear capacity method of this "
                         "program does not apply - use ISO 10300 directly (guide M5b chapter 3)")
    F = forces(P, g)
    m1, m2 = gear.MATERIALS[P["material1"]], gear.MATERIALS[P["material2"]]
    beff = 0.85 * P["b"]
    KHb = 1.5 * P["KHbeta_be"]
    # equivalent cylindrical (virtual) pair for the M5 helper functions
    V = dict(gear.DEFAULT, mn=g["mmn"], z1=g["zv1"], z2=g["zv2"], beta_deg=P["beta_m_deg"], alpha_n_deg=P["alpha_n_deg"],
             x1=g["x1"], x2=g["x2"], b=beff, haP=P["haP"], hfP=P["hfP"], n1_rpm=P["n1_rpm"], KA=P["KA"],
             KHbeta=KHb, accuracy_grade=P["accuracy_grade"], material1=P["material1"], material2=P["material2"])
    gv = gear.geometry(V)
    Fv = {"Ft": F["Ft"], "v": F["v"]}
    KV = gear.KV_factor(V, gv, Fv)
    h = (P["haP"] + P["hfP"]) * g["mmn"]
    KFb = gear.KFbeta(KHb, beff, h)
    zh = math.sqrt(2 * math.cos(g["beta_b"]) / (math.cos(g["alpha_t"]) ** 2 * math.tan(g["alpha_t"])) )
    ze = gear.ZE(m1, m2)
    zeps = gear.Zeps(g["eps_va"], g["eps_vb"])
    zb = gear.Zbeta(P["beta_m_deg"])
    sH0 = zh * ze * zeps * zb * P["ZK"] * math.sqrt(F["Ft"] / (g["dv1"] * beff) * (g["uv"] + 1) / g["uv"])
    KH = P["KA"] * KV * KHb
    sH = sH0 * math.sqrt(KH)
    Yb = gear.Ybeta(g["eps_vb"], P["beta_m_deg"])
    res = {"g": g, "F": F, "V": V, "KV": KV, "KHbeta": KHb, "KFbeta": KFb, "ZH": zh, "ZE": ze, "Zeps": zeps, "Zbeta": zb,
           "sH0": sH0, "sH": sH, "Ybeta": Yb, "b_eff": beff}
    for i, m in ((1, m1), (2, m2)):
        ff = gear.form_factor_B(V, gv, i)
        sF = F["Ft"] / (beff * g["mmn"]) * ff["YF"] * ff["YS"] * Yb * P["KA"] * KV * KFb
        sHP = m["sHlim"] * P["ZLVR"]
        sFE = 2 * m["sFlim"]
        res["gear%d" % i] = {"ff": ff, "sF": sF, "SF": sFE / sF, "SH": sHP / sH, "ok": sHP / sH >= P["SHmin"] and sFE / sF >= P["SFmin"]}
    return res

# ---------------------------------------------------------------- chapter 6: blank + inspection data
def chordal_thickness(P, g, which=1):
    """Outer (heel) normal chordal tooth thickness and chordal addendum for a gear tooth caliper (Tredgold back cone):
    s_et = met (pi/2 + 2 x tan(an)) ; back-cone (virtual) radius rve = de/(2 cos(delta));
    chordal s_c = 2 rve sin(s/(2 rve)) ; chordal height h_c = hae + rve (1 - cos(s/(2 rve))).  (spiral: in the normal section at the
    mean point use m_mn and the virtual normal gear; here the outer transverse values for straight bevels.)"""
    an = math.radians(P["alpha_n_deg"])
    x = g["x%d" % which]
    d = g["delta%d" % which]
    de = g["de%d" % which]
    s = P["met"] * (math.pi / 2 + 2 * x * math.tan(an)) + P["thickness_allowance_um"] / 1000
    rve = de / (2 * math.cos(d))
    sc = 2 * rve * math.sin(s / (2 * rve))
    hc = g["hae%d" % which] + rve * (1 - math.cos(s / (2 * rve)))
    # mean normal section (spiral bevel): virtual normal gear radius
    sm = g["mmn"] * (math.pi / 2 + 2 * x * math.tan(an)) + P["thickness_allowance_um"] / 1000
    rvn = g["mmn"] * g["zvn%d" % which] / 2
    smc = 2 * rvn * math.sin(sm / (2 * rvn))
    hmc = g["ham%d" % which] + rvn * (1 - math.cos(sm / (2 * rvn)))
    return {"s_outer": s, "s_chord_outer": sc, "h_chord_outer": hc, "s_mean_normal": sm, "s_chord_mean": smc, "h_chord_mean": hmc}

def cutter_data(P, g):
    """Face-milling cutter radius (Gleason-style guideline r_c ~ R_m, i.e. 0.8 ... 1.1 R_m - check the machine maker's tables);
    standard cutter diameters (inch series typical: 1.1, 1.5, 2, 3.5, 5, 6, 7.5, 9, 12 in) -> nearest radius; spiral angle at the
    heel and toe for that cutter (a smaller cutter gives more lengthwise curvature and a larger heel-toe spread).
    Approximate geometry: the cutter centre lies at distance from the apex so that the tooth trace has beta_m at R_m."""
    bm = math.radians(P["beta_m_deg"])
    if bm == 0:
        return None
    rc_ideal = g["Rm"]
    std_in = [1.1, 1.5, 2.0, 3.5, 5.0, 6.0, 7.5, 9.0, 12.0]
    rc = min((d * 25.4 / 2 for d in std_in), key=lambda r: abs(r - rc_ideal))
    # cutter centre E (in the pitch plane of the crown gear): |E| from apex, beta(R) from geometry of a circle
    # cos-law: rc^2 = R^2 + E^2 - 2 R E cos(gam) ; spiral angle at R: sin(beta) = (R^2 + rc^2 - E^2)/(2 R rc)
    E2 = g["Rm"] ** 2 + rc ** 2 - 2 * g["Rm"] * rc * math.sin(bm)
    def beta_at(R):
        v = (R ** 2 + rc ** 2 - E2) / (2 * R * rc)
        return math.degrees(math.asin(max(-1, min(1, v))))
    return {"rc_ideal_mm": rc_ideal, "rc_mm": rc, "beta_heel": beta_at(g["Re"]), "beta_mean": beta_at(g["Rm"]),
            "beta_toe": beta_at(g["Re"] - P["b"])}

# ---------------------------------------------------------------- report / run
def report_text(P):
    R = capacity(P)
    g, F = R["g"], R["F"]
    L = ["# Bevel gear pair report - %s\n" % P["name"],
         "%s bevel, z %d/%d, Sigma %.1f deg, met %.2f, b %.1f, beta_m %.1f deg (%s hand pinion, rotation %s), alpha_n %.1f" % (
             P["kind"], P["z1"], P["z2"], P["Sigma_deg"], P["met"], P["b"], P["beta_m_deg"], P["hand1"], P["rotation1"], P["alpha_n_deg"]),
         "\n## Cone geometry",
         "- u %.4f; pitch angles %.4f / %.4f deg; de %.3f / %.3f; Re %.3f, Rm %.3f mm; b/Re %.3f (<= 1/3 %s)" % (
             g["u"], math.degrees(g["delta1"]), math.degrees(g["delta2"]), g["de1"], g["de2"], g["Re"], g["Rm"], P["b"] / g["Re"],
             "OK" if g["checks"]["b_le_Re_3"] else "TOO WIDE"),
         "- m_mt %.4f, m_mn %.4f; dm %.3f / %.3f; x %.4f / %.4f" % (g["mmt"], g["mmn"], g["dm1"], g["dm2"], g["x1"], g["x2"]),
         "- addendum mean %.3f / %.3f, outer %.3f / %.3f; dedendum outer %.3f / %.3f mm" % (
             g["ham1"], g["ham2"], g["hae1"], g["hae2"], g["hfe1"], g["hfe2"]),
         "- face angles %.3f / %.3f, root angles %.3f / %.3f deg; outside diameters dae %.3f / %.3f; crown to apex %.3f / %.3f mm" % (
             math.degrees(g["face_angle1"]), math.degrees(g["face_angle2"]), math.degrees(g["root_angle1"]), math.degrees(g["root_angle2"]),
             g["dae1"], g["dae2"], g["crown_to_apex1"], g["crown_to_apex2"]),
         "- virtual gears: zv %.2f / %.2f, zvn %.2f / %.2f, uv %.3f; contact ratios eps_va %.3f, eps_vb %.3f, total %.3f" % (
             g["zv1"], g["zv2"], g["zvn1"], g["zvn2"], g["uv"], g["eps_va"], g["eps_vb"], g["eps_vg"]),
         "\n## Forces (driving pinion, mean section)",
         "- T1 %.2f N m, T2 %.2f N m; Ft %.0f N; pinion Fa %.0f N, Fr %.0f N; wheel Fa %.0f N, Fr %.0f N; v %.2f m/s (s = %+d)" % (
             F["T1"], F["T2"], F["Ft"], F["Fa1"], F["Fr1"], F["Fa2"], F["Fr2"], F["v"], F["s"]),
         "\n## Load capacity (ISO 10300 style via virtual gears, simplified)",
         "- K_A %.2f, K_V %.3f, K_Hbeta %.3f (1.5 x %.2f), K_Fbeta %.3f; Z_H %.3f, Z_E %.1f, Z_eps %.3f, Z_beta %.3f, Z_K %.2f" % (
             P["KA"], R["KV"], R["KHbeta"], P["KHbeta_be"], R["KFbeta"], R["ZH"], R["ZE"], R["Zeps"], R["Zbeta"], P["ZK"]),
         "- sigma_H %.0f MPa; b_eff %.1f mm" % (R["sH"], R["b_eff"])]
    for i in (1, 2):
        q = R["gear%d" % i]
        L.append("- gear %d: Y_F %.3f, Y_S %.3f -> sigma_F %.0f MPa, S_F %.2f; S_H %.2f; %s" % (
            i, q["ff"]["YF"], q["ff"]["YS"], q["sF"], q["SF"], q["SH"], "OK" if q["ok"] else "NOT OK"))
    L.append("\n## Blank / inspection / cutting data")
    for i in (1, 2):
        c = chordal_thickness(P, g, i)
        L.append("- gear %d: outer chordal thickness %.3f at chordal height %.3f mm; mean normal chordal thickness %.3f at %.3f mm" % (
            i, c["s_chord_outer"], c["h_chord_outer"], c["s_chord_mean"], c["h_chord_mean"]))
    cd = cutter_data(P, g)
    if cd:
        L.append("- face-milling cutter: ideal r_c %.1f mm -> standard r_c %.1f mm; spiral angle heel %.2f, mean %.2f, toe %.2f deg" % (
            cd["rc_ideal_mm"], cd["rc_mm"], cd["beta_heel"], cd["beta_mean"], cd["beta_toe"]))
    return "\n".join(L)

def run(P, out):
    os.makedirs(out, exist_ok=True)
    rep = report_text(P)
    with open(os.path.join(out, "report.md"), "w", encoding="utf-8") as f:
        f.write(rep)
    g = geometry(P)
    with open(os.path.join(out, "blank.csv"), "w", encoding="utf-8") as f:
        f.write("item,pinion,wheel\n")
        for k, lab in (("delta", "pitch angle deg"), ("face_angle", "face angle deg"), ("root_angle", "root angle deg")):
            f.write("%s,%.4f,%.4f\n" % (lab, math.degrees(g[k + "1"]), math.degrees(g[k + "2"])))
        for k, lab in (("de", "outer pitch diameter"), ("dae", "outside diameter"), ("crown_to_apex", "crown to apex"),
                       ("hae", "outer addendum"), ("hfe", "outer dedendum")):
            f.write("%s mm,%.4f,%.4f\n" % (lab, g[k + "1"], g[k + "2"]))
    print(rep)
    print("written: report.md, blank.csv ->", out)


# ================================================================ added with guide chapters (ch24)
def toe_check(P=None, widths=None):
    """Why b <= Re/3: module and addendum at the toe fall linearly with the cone distance.
    m_toe = met (Re - b)/Re ; outer/toe size ratio Re/(Re - b). Returns rows (b, b/Re, m_toe, ratio)."""
    P = dict(DEFAULT if P is None else P)
    g = geometry(P)
    Re = g["Re"]
    rows = []
    for b in (widths or (12.0, 18.0, Re / 3, 30.0, Re / 2)):
        rows.append((b, b / Re, P["met"] * (Re - b) / Re, Re / (Re - b)))
    return Re, rows


def addendum_mod_table(us=(1.0, 1.5, 2.0, 2.53, 3.0, 4.0, 6.0)):
    """Gleason-style addendum modification x1 = k (1 - 1/u^2): k 0.39 spiral, 0.46 straight (mark check)."""
    return [(u, 0.39 * (1 - 1 / u ** 2), 0.46 * (1 - 1 / u ** 2)) for u in us]


def blank_data(P=None):
    """Blank (turned part) dimensions for the drawing with typical tolerances (mark check with the cutting-machine
    maker / ISO 23509 / company standard). Back angle = 90 deg - pitch angle (back cone perpendicular to the pitch cone)."""
    P = dict(DEFAULT if P is None else P)
    g = geometry(P)
    rows = []
    for i in (1, 2):
        rows.append({
            "member": "pinion" if i == 1 else "wheel",
            "outside_d": g["dae%d" % i], "tol_outside_d": "h8 / -0.05 mm (typ.)",
            "face_angle": math.degrees(g["face_angle%d" % i]), "tol_face_angle": "+/-8 arcmin (typ.)",
            "back_angle": 90 - math.degrees(g["delta%d" % i]), "tol_back_angle": "+/-15 arcmin (typ.)",
            "root_angle": math.degrees(g["root_angle%d" % i]),
            "crown_to_apex": g["crown_to_apex%d" % i], "tol_crown": "+/-0.025 mm (typ.)",
            "face_width": P["b"], "pitch_d": g["de%d" % i]})
    return rows


def shaft_angle_cases(sigmas=(60.0, 90.0, 120.0)):
    """Same teeth (z 17/43, met 3) at other shaft angles: pitch angles, Re, virtual numbers of teeth, uv."""
    out = []
    for S in sigmas:
        P = dict(DEFAULT, Sigma_deg=S)
        g = geometry(P)
        out.append((S, math.degrees(g["delta1"]), math.degrees(g["delta2"]), g["Re"], g["zv1"], g["zv2"], g["uv"],
                    P["b"] / g["Re"]))
    return out


def force_cases(P=None):
    """The four combinations of hand of spiral and rotation for the default pair."""
    P = dict(DEFAULT if P is None else P)
    g = geometry(P)
    rows = []
    for h in ("left", "right"):
        for r in ("cw", "ccw"):
            F = forces(dict(P, hand1=h, rotation1=r), g)
            rows.append((h, r, F["s"], F["Fa1"], F["Fr1"], F["Fa2"], F["Fr2"]))
    return rows


def resultant_check(P=None):
    """Normal force from the components must equal Ft / (cos(an) cos(bm)) (all three components are projections of the
    tooth normal force). Returns |F| from components and the closed form."""
    P = dict(DEFAULT if P is None else P)
    g = geometry(P)
    F = forces(P, g)
    an, bm = math.radians(P["alpha_n_deg"]), math.radians(P["beta_m_deg"])
    comp = math.sqrt(F["Ft"] ** 2 + F["Fa1"] ** 2 + F["Fr1"] ** 2)
    return comp, F["Ft"] / (math.cos(an) * math.cos(bm))


def overhung_pinion(P=None, overhang=35.0, spread=60.0):
    """Overhung bevel pinion: tooth force at x = 0 (mean point, radius dm1/2), bearing A at x = overhang (near the pinion),
    bearing B at x = overhang + spread. Planes: y = radial (Fr1 towards the axis = -y at the mesh point), z = tangential (Ft).
    The axial force Fa1 acts at radius dm1/2 -> bending moment M = Fa1 dm1/2 in the y plane.
    Static equilibrium (moments about B, then sum of forces). Returns reactions (radial magnitudes) and the axial load."""
    P = dict(DEFAULT if P is None else P)
    g = geometry(P)
    F = forces(P, g)
    xa, xb = overhang, overhang + spread
    M = F["Fa1"] * g["dm1"] / 2            # N mm, from the axial force at the pitch radius
    Fy = -F["Fr1"]                          # radial force acting on the pinion (towards its axis)
    Fz = F["Ft"]
    out = {}
    for k, Fk, Mk in (("y", Fy, M), ("z", Fz, 0.0)):
        # moments about B: Fk (xb - 0) + RA (xb - xa) + Mk = 0  (sign: positive moment same sense as Fk lever)
        RA = -(Fk * xb + Mk) / (xb - xa)
        RB = -Fk - RA
        out[k] = (RA, RB)
    RA = math.hypot(out["y"][0], out["z"][0])
    RB = math.hypot(out["y"][1], out["z"][1])
    return {"F": F, "g": g, "M_Fa_Nmm": M, "RA": RA, "RB": RB, "planes": out, "Fa": F["Fa1"],
            "xa": xa, "xb": xb}


def overhung_check_with_shaft(P=None, overhang=35.0, spread=60.0):
    """Cross-check of the force-only part with shaft.reactions() (M3): same forces, moment set to zero."""
    import shaft
    r = overhung_pinion(P, overhang, spread)
    F = r["F"]
    S = dict(shaft.DEFAULT, segments=[[overhang + spread + 15, 30, 0]], bearings=[overhang, overhang + spread],
             forces=[[0.0, -F["Fr1"], F["Ft"], "mesh"]])
    R = shaft.reactions(S)
    # analytic without moment
    xa, xb = overhang, overhang + spread
    RAy = -(-F["Fr1"] * xb) / (xb - xa)
    return R["y"][0], RAy


def pinion_bearing_life(P=None, overhang=35.0, spread=60.0, name="30206"):
    """Tapered roller pair in O (back-to-back) arrangement behind the overhung pinion, both 30206 (example).
    Induced axial forces F_ad = 0.5 Fr / Y. External axial force Ka = Fa1 (away from the apex = towards the bearings).
    O-arrangement rule (simplified, same Y): the bearing that the external force presses against gets
    Fa = max(F_ad,other + Ka, F_ad,own); the other gets its own F_ad. Then P and L_nm with bearing.py (n = n1)."""
    import bearing
    r = overhung_pinion(P, overhang, spread)
    b = bearing.CATALOGUE[name]
    Y = b["Y"]
    FrA, FrB = r["RA"], r["RB"]
    FadA, FadB = 0.5 * FrA / Y, 0.5 * FrB / Y
    Ka = r["Fa"]
    # Ka positive = pinion pushed away from the apex, i.e. towards the bearings: bearing B (far) takes it in an O pair
    # mounted with the far bearing's back facing the pinion load direction (example arrangement - check the drawing).
    if Ka >= 0:
        FaB = max(FadA + Ka, FadB)
        FaA = FadA if FaB > FadB else FadB - Ka
    else:
        FaA = max(FadB - Ka, FadA)
        FaB = FadB if FaA > FadA else FadA + Ka
    Pb = dict(bearing.DEFAULT)
    n = (P or DEFAULT)["n1_rpm"]
    res = {}
    for side, Fr, Fa in (("A", FrA, FaA), ("B", FrB, FaB)):
        eq = bearing.equivalent_dynamic(b, Fr, max(Fa, 0.0))
        ml = bearing.modified_life(b, eq["P"], n, Pb)
        res[side] = {"Fr": Fr, "Fa": Fa, "P": eq["P"], "L10h": ml["L10h"], "Lnmh": ml["Lnmh"], "kappa": ml["kappa"]}
    res["Ka"] = Ka
    return res


def mounting_deflection(P=None, overhang=35.0, spread=60.0):
    """Deflection of the pinion at the mesh point for an overhung vs a straddle mounting (same bearing spread, Ø30 shaft),
    tooth forces Fr1 and Ft only (axial-force moment neglected for this comparison). Uses shaft.deflection (M3)."""
    import shaft
    r = overhung_pinion(P, overhang, spread)
    F = r["F"]
    L = overhang + spread + 15
    over = dict(shaft.DEFAULT, segments=[[L, 30, 0]], bearings=[overhang, overhang + spread],
                forces=[[0.0, -F["Fr1"], F["Ft"], "mesh"]], step_mm=0.25)
    xs, _, vy = shaft.deflection(over, "y")
    _, _, vz = shaft.deflection(over, "z")
    v_over = math.hypot(vy[0], vz[0]) * 1000
    # straddle: mesh in the middle between the two bearings (same spread)
    st = dict(shaft.DEFAULT, segments=[[spread + 30, 30, 0]], bearings=[15.0, 15.0 + spread],
              forces=[[15.0 + spread / 2, -F["Fr1"], F["Ft"], "mesh"]], step_mm=0.25)
    xs2, _, vy2 = shaft.deflection(st, "y")
    _, _, vz2 = shaft.deflection(st, "z")
    j = min(range(len(xs2)), key=lambda i: abs(xs2[i] - (15.0 + spread / 2)))
    v_st = math.hypot(vy2[j], vz2[j]) * 1000
    return v_over, v_st


def demo_ch24():
    P = dict(DEFAULT)
    print("== 2/3 toe check (why b <= Re/3)")
    Re, rows = toe_check(P)
    print("  Re %.3f mm" % Re)
    for b, br, mt, ratio in rows:
        print("  b %6.2f mm: b/Re %.3f, toe module %.3f mm, heel/toe size ratio %.3f" % (b, br, mt, ratio))
    print("== 3 addendum modification (x1 = k (1 - 1/u^2))")
    for u, xs, xst in addendum_mod_table():
        print("  u %.2f: spiral x1 %.3f, straight x1 %.3f" % (u, xs, xst))
    print("== 3 blank data")
    for r in blank_data(P):
        print("  %-6s: dae %.3f (%s), face angle %.3f deg (%s), back angle %.3f deg (%s), root angle %.3f deg, "
              "crown to apex %.3f mm (%s)" % (r["member"], r["outside_d"], r["tol_outside_d"], r["face_angle"],
                                              r["tol_face_angle"], r["back_angle"], r["tol_back_angle"], r["root_angle"],
                                              r["crown_to_apex"], r["tol_crown"]))
    print("== 3 other shaft angles (z 17/43, met 3)")
    for S, d1, d2, Re_, zv1, zv2, uv, br in shaft_angle_cases():
        print("  Sigma %5.1f: delta %.3f / %.3f deg, Re %.3f mm, zv %.2f / %.2f, uv %.3f, b/Re %.3f" % (S, d1, d2, Re_, zv1, zv2, uv, br))
    print("== 4 force cases (default 7.5 kW)")
    for h, r, s, fa1, fr1, fa2, fr2 in force_cases(P):
        print("  %-5s %-3s s %+d: Fa1 %+7.1f, Fr1 %+7.1f, Fa2 %+7.1f, Fr2 %+7.1f N" % (h, r, s, fa1, fr1, fa2, fr2))
    comp, closed = resultant_check(P)
    print("  normal force from components %.2f N = Ft/(cos an cos bm) %.2f N" % (comp, closed))
    print("== 4 overhung pinion: overhang 35 mm, bearing spread 60 mm")
    r = overhung_pinion(P)
    print("  M from Fa = %.0f N mm; RA %.1f N, RB %.1f N; axial %.1f N" % (r["M_Fa_Nmm"], r["RA"], r["RB"], r["Fa"]))
    a, b_ = overhung_check_with_shaft(P)
    print("  cross-check RA_y without moment: shaft.reactions %.3f N = analytic %.3f N" % (a, b_))
    bl = pinion_bearing_life(P)
    for s in ("A", "B"):
        q = bl[s]
        print("  30206 %s: Fr %.0f N, Fa %.0f N -> P %.0f N, L10h %.0f h, L_nm %.0f h (kappa %.2f)" % (
            s, q["Fr"], q["Fa"], q["P"], q["L10h"], q["Lnmh"], q["kappa"]))
    vo, vs = mounting_deflection(P)
    print("  deflection at the mesh point: overhung %.1f um, straddle %.1f um (ratio %.1f)" % (vo, vs, vo / vs))

# ================================================================ added with guide chapters (ch56)
MOUNTING_KHBE = {   # typical mounting factor K_Hbeta-be (check ISO 10300-1 table)
    "both members straddle mounted": 1.00,
    "one member straddle, one cantilever": 1.10,
    "both members cantilever (overhung)": 1.25,
}

def factor_breakdown(P):
    """All factors of capacity() in one dict for the walkthrough (default input)."""
    R = capacity(P)
    g, F = R["g"], R["F"]
    return {"Ft": F["Ft"], "dv1": g["dv1"], "uv": g["uv"], "b_eff": R["b_eff"], "KA": P["KA"], "KV": R["KV"],
            "KHbeta": R["KHbeta"], "KFbeta": R["KFbeta"], "ZH": R["ZH"], "ZE": R["ZE"], "Zeps": R["Zeps"],
            "Zbeta": R["Zbeta"], "ZK": P["ZK"], "sH0": R["sH0"], "sH": R["sH"], "Ybeta": R["Ybeta"],
            "YF1": R["gear1"]["ff"]["YF"], "YS1": R["gear1"]["ff"]["YS"], "YF2": R["gear2"]["ff"]["YF"],
            "YS2": R["gear2"]["ff"]["YS"], "sF1": R["gear1"]["sF"], "sF2": R["gear2"]["sF"],
            "SH": R["gear1"]["SH"], "SF1": R["gear1"]["SF"], "SF2": R["gear2"]["SF"],
            "sHP": R["gear1"]["SH"] * R["sH"]}

def spiral_study(P, betas=(0, 10, 20, 30, 35, 40)):
    """Same size (met, b, z) with different mean spiral angles: S_H, S_F, contact ratios, pinion axial force."""
    out = []
    for b in betas:
        Q = dict(P, beta_m_deg=float(b), kind="straight" if b == 0 else "spiral")
        R = capacity(Q)
        out.append({"beta": b, "eva": R["g"]["eps_va"], "evb": R["g"]["eps_vb"], "SH": R["gear1"]["SH"],
                    "SF1": R["gear1"]["SF"], "SF2": R["gear2"]["SF"], "Fa1": R["F"]["Fa1"], "Fr1": R["F"]["Fr1"]})
    return out

def size_study(P, mets=(2.5, 3.0, 3.5, 4.0), b_over_Re=0.26):
    """Constant ratio z1/z2, outer module varied, face width kept at b = b_over_Re * Re."""
    out = []
    for m in mets:
        g0 = geometry(dict(P, met=m))
        b = round(b_over_Re * g0["Re"], 1)
        R = capacity(dict(P, met=m, b=b))
        out.append({"met": m, "b": b, "Re": g0["Re"], "SH": R["gear1"]["SH"], "SF1": R["gear1"]["SF"],
                    "SF2": R["gear2"]["SF"], "de2": g0["de2"]})
    return out

def mounting_study(P):
    out = []
    for name, k in MOUNTING_KHBE.items():
        R = capacity(dict(P, KHbeta_be=k))
        out.append({"mounting": name, "KHbe": k, "KHbeta": R["KHbeta"], "SH": R["gear1"]["SH"], "SF1": R["gear1"]["SF"]})
    return out

def max_power(P, SH_req=1.0, SF_req=1.4):
    """Bisection on P_kW: largest power with S_H >= SH_req (pitting) and S_F >= SF_req (root), each limit separately."""
    def lim(key):
        lo, hi = 0.1, 500.0
        for _ in range(80):
            mid = 0.5 * (lo + hi)
            R = capacity(dict(P, P_kW=mid))
            v = R["gear1"]["SH"] if key == "H" else min(R["gear1"]["SF"], R["gear2"]["SF"])
            if v >= (SH_req if key == "H" else SF_req):
                lo = mid
            else:
                hi = mid
        return lo
    return {"P_pitting": lim("H"), "P_root": lim("F")}

def backlash_mounting(P, dP_mm=0.0, dG_mm=0.0):
    """Change of normal backlash from axial mounting errors (simplified, check): an axial shift dP of the pinion (positive =
    away from the cone apex, out of mesh) moves its pitch cone by dP sin(delta1) normal to the pitch line; same for the gear with
    dG sin(delta2). Like a centre-distance change: dj_n = 2 tan(alpha_n) (dP sin(delta1) + dG sin(delta2)).  [mm -> um]"""
    g = geometry(P)
    an = math.radians(P["alpha_n_deg"])
    return 2 * math.tan(an) * (dP_mm * math.sin(g["delta1"]) + dG_mm * math.sin(g["delta2"])) * 1000

BACKLASH_TABLE = [  # typical normal backlash range vs outer module (mm), industrial bevel gears - check maker / AGMA 2005
    (1.0, 2.0, 0.05, 0.10), (2.0, 3.0, 0.08, 0.13), (3.0, 4.0, 0.10, 0.15), (4.0, 5.0, 0.13, 0.18),
    (5.0, 6.5, 0.15, 0.20), (6.5, 8.0, 0.18, 0.25), (8.0, 10.0, 0.20, 0.30)]

def backlash_recommendation(met):
    for lo, hi, a, b in BACKLASH_TABLE:
        if lo <= met < hi:
            return a, b
    return None

def thermal_mounting(P, L_pinion_mm=60.0, L_gear_mm=40.0, dT_housing=20.0, dT_shaft=30.0,
                     a_housing=10.5e-6, a_shaft=11.5e-6):
    """Thermal change of the mounting distances: a shaft grows from its locating bearing towards the cone apex
    (into mesh) by a_shaft dT_shaft L, the housing moves the locating bearing away by a_housing dT_housing L.
    Net axial shift of each member (positive = out of mesh) and the resulting backlash change (um)."""
    dP = a_housing * dT_housing * L_pinion_mm - a_shaft * dT_shaft * L_pinion_mm
    dG = a_housing * dT_housing * L_gear_mm - a_shaft * dT_shaft * L_gear_mm
    return {"dP_um": dP * 1000, "dG_um": dG * 1000, "dj_um": backlash_mounting(P, dP, dG)}

def demo_ch56():
    P = dict(DEFAULT)
    print("== 5.2 factor breakdown (default 7.5 kW)")
    f = factor_breakdown(P)
    print("  Ft %.1f N, dv1 %.3f mm, uv %.3f, b_eff %.2f mm" % (f["Ft"], f["dv1"], f["uv"], f["b_eff"]))
    print("  K_A %.2f K_V %.4f K_Hbeta %.4f K_Fbeta %.4f" % (f["KA"], f["KV"], f["KHbeta"], f["KFbeta"]))
    print("  Z_H %.4f Z_E %.2f Z_eps %.4f Z_beta %.4f Z_K %.2f" % (f["ZH"], f["ZE"], f["Zeps"], f["Zbeta"], f["ZK"]))
    print("  sigma_H0 %.1f MPa, sigma_H %.1f MPa, sigma_HP %.1f MPa -> S_H %.3f" % (f["sH0"], f["sH"], f["sHP"], f["SH"]))
    print("  Y_beta %.4f; pinion Y_F %.3f Y_S %.3f sigma_F %.1f S_F %.3f; wheel Y_F %.3f Y_S %.3f sigma_F %.1f S_F %.3f" % (
        f["Ybeta"], f["YF1"], f["YS1"], f["sF1"], f["SF1"], f["YF2"], f["YS2"], f["sF2"], f["SF2"]))
    print("== 5.8 spiral angle study (same met 3, b 18, z 17/43)")
    for r in spiral_study(P):
        print("  beta %2d: eps_va %.3f eps_vb %.3f  S_H %.2f  S_F %.2f / %.2f  Fa1 %+5.0f N  Fr1 %+5.0f N" % (
            r["beta"], r["eva"], r["evb"], r["SH"], r["SF1"], r["SF2"], r["Fa1"], r["Fr1"]))
    print("== 5.9 size study (b = 0.26 Re)")
    for r in size_study(P):
        print("  met %.1f: b %.1f mm, Re %.1f, de2 %.0f mm  S_H %.2f  S_F %.2f / %.2f" % (
            r["met"], r["b"], r["Re"], r["de2"], r["SH"], r["SF1"], r["SF2"]))
    print("== 5.10 mounting factor study")
    for r in mounting_study(P):
        print("  %-38s K_Hbeta-be %.2f -> K_Hbeta %.3f  S_H %.2f  S_F1 %.2f" % (r["mounting"], r["KHbe"], r["KHbeta"], r["SH"], r["SF1"]))
    print("== 5.11 maximum power")
    m = max_power(P)
    print("  pitting limit (S_H = 1.0): %.2f kW; root limit (S_F = 1.4): %.2f kW" % (m["P_pitting"], m["P_root"]))
    mz = max_power(dict(P, ZLVR=1.0))
    print("  ground flanks (Z_LVR 1.0): pitting limit %.2f kW" % mz["P_pitting"])
    print("== 6.3 backlash change from mounting errors")
    for dP, dG in ((0.05, 0.0), (0.0, 0.05), (0.05, 0.05), (-0.05, 0.0), (0.0, -0.1)):
        print("  dP %+.2f mm, dG %+.2f mm -> dj_n %+.1f um" % (dP, dG, backlash_mounting(P, dP, dG)))
    a, b = backlash_recommendation(P["met"])
    print("  recommended normal backlash for met %.1f: %.2f ... %.2f mm (typical)" % (P["met"], a, b))
    t = thermal_mounting(P)
    print("  thermal (housing +20 K, shafts +30 K, L 60 / 40 mm): dP %+.1f um, dG %+.1f um -> dj_n %+.1f um" % (
        t["dP_um"], t["dG_um"], t["dj_um"]))
    ta = thermal_mounting(P, a_housing=23e-6)
    print("  same with an aluminium housing: dP %+.1f um, dG %+.1f um -> dj_n %+.1f um" % (ta["dP_um"], ta["dG_um"], ta["dj_um"]))

# ================================================================ added with guide chapters (ch78)
# ---------------------------------------------------------------- 7.1 process chains (typical, check)
PROCESS_CHAINS = [  # name, kind, typical ISO 17485 grade after process, volume suitability, relative cost (1 = lowest)
    ("precision forging (net-shape teeth)", "straight", "9-11", "very high volume (automotive differential)", 1),
    ("Revacycle broaching (straight, one tooth per turn of the broach)", "straight", "8-9", "high volume", 2),
    ("two-tool generating / planing", "straight", "7-9", "small lots, large gears", 4),
    ("Coniflex (interlocking disc cutters, slightly crowned)", "straight", "7-8", "small to medium lots", 3),
    ("face milling soft + carburise + lapping", "spiral", "6-8", "medium to high volume (matched sets)", 3),
    ("face milling soft + carburise + grinding", "spiral", "4-6", "aerospace, machine tools, low noise", 5),
    ("face hobbing soft + carburise + lapping", "spiral", "6-8", "high volume (automotive, industrial)", 3),
    ("face milling / hobbing + carburise + hard skiving", "spiral", "5-7", "medium lots, no grinding machine", 4),
]

# ---------------------------------------------------------------- 7.2 blank errors -> tooth errors (simple geometry)
def blank_error_effect(P, d_face_angle_deg=0.05, d_crown_mm=0.05):
    """Simple geometric relations (first-order, check with a TCA for real cases):
    - face-angle error d_gamma: the tip height changes linearly along the face width: dh = b tan(d_gamma)
      (tooth tip toe vs heel; with the cutter set to the blank the whole depth tilts -> pattern moves toe/heel);
    - crown-to-apex error dx: if the blank is clamped on its back face, the teeth are cut dx too far / too near the apex;
      in assembly this equals a mounting-distance error dx -> radial separation da = dx sin(delta),
      backlash change dj_t ~ 2 da tan(alpha_t)  (same relation as a centre-distance change of the virtual cylindrical gear)."""
    g = geometry(P)
    an = math.radians(P["alpha_n_deg"])
    at = math.atan(math.tan(an) / math.cos(math.radians(P["beta_m_deg"])))
    dh = P["b"] * math.tan(math.radians(d_face_angle_deg))
    da = d_crown_mm * math.sin(g["delta1"])
    dj = 2 * da * math.tan(at)
    return {"dh_tip_mm": dh, "da_mm": da, "dj_t_um": dj * 1000, "dj_n_um": dj * math.cos(an) * 1000}

# ---------------------------------------------------------------- 7.3 generating principle
def crown_gear(P):
    """Imaginary crown gear (generating gear on the cradle) for Sigma = 90 deg: z_p = z / sin(delta) (same for both members:
    z_p = sqrt(z1^2 + z2^2)). Ratio of roll Ra = omega_cradle-to-work relation = z_p / z = 1 / sin(delta)
    (here as work turns per cradle turn: Ra = z_p / z)."""
    g = geometry(P)
    zp1 = P["z1"] / math.sin(g["delta1"])
    zp2 = P["z2"] / math.sin(g["delta2"])
    return {"zp1": zp1, "zp2": zp2, "zp_formula": math.hypot(P["z1"], P["z2"]), "Ra1": zp1 / P["z1"], "Ra2": zp2 / P["z2"]}

def face_hobbing_ratio(z, z0):
    """Continuous indexing (face hobbing): during cutting the work turns z0/z times per cutter turn (z0 = number of blade
    groups / starts of the cutter head): omega_work / omega_cutter = z0 / z. Each blade group cuts the next slot."""
    return z0 / z

# ---------------------------------------------------------------- 7.6 cutting data and cycle time (typical, check)
def cycle_time(P, which=1, method="single", vc=220.0, roll_s_per_slot=4.0, index_s=1.2, plunge_feed_mm_rev=0.08, z0=5,
               depth_mm=None, approach_s=10.0):
    """Cycle-time estimate.
    single indexing (face milling, completing): t = z (t_roll + t_index) + approach; Formate wheel: t_roll ~ plunge time.
    continuous (face hobbing): cutter speed n_c = 1000 vc / (pi D_c); number of cutter turns to plunge the full depth
    N = h / f_rev; t = N / n_c * 60 + approach (all slots are cut together, the work turns z0/z per cutter turn).
    vc = carbide dry cutting speed m/min (typical 150 ... 300, check tool maker)."""
    g = geometry(P)
    z = P["z%d" % which]
    cd = cutter_data(P, g)
    Dc = 2 * (cd["rc_mm"] if cd else g["Rm"])
    nc = 1000 * vc / (math.pi * Dc)
    h = depth_mm if depth_mm else g["hae%d" % which] + g["hfe%d" % which]
    if method == "single":
        t = z * (roll_s_per_slot + index_s) + approach_s
        return {"method": "single indexing", "z": z, "n_cutter_rpm": nc, "t_s": t, "depth_mm": h}
    N = h / plunge_feed_mm_rev
    t = N / nc * 60 + approach_s
    return {"method": "continuous (face hobbing)", "z": z, "z0": z0, "ratio_work_cutter": face_hobbing_ratio(z, z0),
            "n_cutter_rpm": nc, "cutter_turns": N, "t_s": t, "depth_mm": h}

# ---------------------------------------------------------------- 7.7 heat treatment
def case_depth(P):
    """Typical effective case depth (carburised bevel gears) CHD ~ 0.15 ... 0.20 m_mn at the mean section, at least ~0.3 mm;
    measured at 550 HV (check ISO 6336-5 / maker practice). Returns the range for both members (same m_mn)."""
    g = geometry(P)
    return {"chd_min": max(0.3, 0.15 * g["mmn"]), "chd_max": max(0.4, 0.20 * g["mmn"]), "mmn": g["mmn"]}

# ---------------------------------------------------------------- 7.10 assembly: shims and backlash
def pinion_shim(marked_dev, housing_meas, housing_nominal, shim_nominal):
    """Pinion mounting-distance shimming. The pinion is marked with its deviation from the nominal mounting distance
    (e.g. '+0.04' = the pattern was best at MD + 0.04 mm on the roll tester). The housing distance from the wheel axis to the
    bearing seat is measured. Shim = nominal shim + (housing_meas - housing_nominal) - marked_dev
    (larger housing distance -> thicker shim to bring the pinion back; positive mark -> pinion must sit further from the
    apex -> thinner shim when the shim is between the pinion back face and the bearing - sign depends on the layout, check
    the drawing)."""
    return shim_nominal + (housing_meas - housing_nominal) - marked_dev

def backlash_from_axial(P, dx_mm, which=2):
    """Moving gear 'which' along its own axis away from the apex by dx: radial separation of the virtual gears
    da = dx sin(delta), circumferential backlash change dj_t ~ 2 da tan(alpha_t) at the mean point (first-order)."""
    g = geometry(P)
    at = g["alpha_t"]
    da = dx_mm * math.sin(g["delta%d" % which])
    return {"da_mm": da, "dj_t_um": 2 * da * math.tan(at) * 1000}

def dx_for_backlash(P, dj_t_um, which=2):
    g = geometry(P)
    return dj_t_um / 1000 / (2 * math.tan(g["alpha_t"]) * math.sin(g["delta%d" % which]))

# ---------------------------------------------------------------- 8 worked example
EXAMPLE = {
    "name": "Worked example: spiral bevel stage 4 kW, 1450 rpm, i ~ 3 (chapter 8)",
    "kind": "spiral", "z1": 15, "z2": 46, "Sigma_deg": 90.0, "met": 2.5, "b": 17.0, "beta_m_deg": 35.0,
    "hand1": "left", "rotation1": "cw", "P_kW": 4.0, "n1_rpm": 1450.0, "KA": 1.25, "KHbeta_be": 1.25,
    "accuracy_grade": 7, "material1": "18CrNiMo7-6 case hardened", "material2": "18CrNiMo7-6 case hardened",
    "ZK": 0.85, "SHmin": 1.2, "SFmin": 1.6, "ZLVR": 0.95,
}

def design_example():
    """Iterate the outer module (and b ~ 0.28 Re, rounded) until S_H >= 1.2 and S_F >= 1.6 for 4 kW."""
    rows = []
    chosen = None
    for met in (1.75, 2.0, 2.25, 2.5, 2.75, 3.0):
        Q = dict(DEFAULT, **EXAMPLE)
        Q["met"] = met
        g = geometry(dict(Q, b=10))
        Q["b"] = round(0.28 * g["Re"])
        R = capacity(Q)
        sh, sf = R["gear1"]["SH"], min(R["gear1"]["SF"], R["gear2"]["SF"])
        ok = sh >= Q["SHmin"] and sf >= Q["SFmin"]
        rows.append((met, Q["b"], R["g"]["Re"], sh, sf, ok))
        if ok and chosen is None:
            chosen = Q
    return rows, chosen

def demo_ch78():
    P = dict(DEFAULT)
    g = geometry(P)
    print("== 7.1 process chains (typical, check)")
    for n, k, q, v, c in PROCESS_CHAINS:
        print("  %-62s %-8s grade %-5s cost %d  %s" % (n, k, q, c, v))
    print("== 7.2 blank errors")
    for dg, dx in ((0.05, 0.0), (0.0, 0.05), (0.10, 0.10)):
        e = blank_error_effect(P, dg, dx)
        print("  face-angle error %.2f deg, crown error %.2f mm: tip height change over b %.4f mm; radial separation %.4f mm; "
              "backlash change j_t %.1f um (j_n %.1f um)" % (dg, dx, e["dh_tip_mm"], e["da_mm"], e["dj_t_um"], e["dj_n_um"]))
    print("== 7.3 generating gear and ratio of roll")
    c = crown_gear(P)
    print("  crown gear teeth z_p %.3f (pinion) = %.3f (wheel) = sqrt(z1^2+z2^2) %.3f; ratio of roll Ra pinion %.4f, wheel %.4f" % (
        c["zp1"], c["zp2"], c["zp_formula"], c["Ra1"], c["Ra2"]))
    for z0 in (5, 7):
        print("  face hobbing z0 %d: work/cutter speed ratio pinion %.4f (z %d), wheel %.4f (z %d)" % (
            z0, face_hobbing_ratio(P["z1"], z0), P["z1"], face_hobbing_ratio(P["z2"], z0), P["z2"]))
    print("== 7.4 cutter")
    cd = cutter_data(P, g)
    print("  ideal r_c %.2f mm -> standard %.2f mm (%.1f in cutter); spiral angle heel %.2f, mean %.2f, toe %.2f deg" % (
        cd["rc_ideal_mm"], cd["rc_mm"], 2 * cd["rc_mm"] / 25.4, cd["beta_heel"], cd["beta_mean"], cd["beta_toe"]))
    for din in (3.5, 5.0, 6.0):
        Q = dict(P)
        rc = din * 25.4 / 2
        E2 = g["Rm"] ** 2 + rc ** 2 - 2 * g["Rm"] * rc * math.sin(math.radians(P["beta_m_deg"]))
        b = lambda R: math.degrees(math.asin(max(-1, min(1, (R ** 2 + rc ** 2 - E2) / (2 * R * rc)))))  # noqa: E731
        print("  %.1f in cutter (r_c %.2f): heel %.2f, toe %.2f deg -> spread %.2f deg" % (din, rc, b(g["Re"]), b(g["Re"] - P["b"]),
                                                                                         b(g["Re"]) - b(g["Re"] - P["b"])))
    print("== 7.6 cycle time (typical values, check)")
    for which in (1, 2):
        s = cycle_time(P, which, "single")
        h = cycle_time(P, which, "continuous")
        print("  gear %d: depth %.3f mm; single indexing %.0f s (n_cutter %.0f rpm); face hobbing %.0f s (%.0f cutter turns, ratio %.4f)" % (
            which, s["depth_mm"], s["t_s"], s["n_cutter_rpm"], h["t_s"], h["cutter_turns"], h["ratio_work_cutter"]))
    print("== 7.7 case depth")
    cdp = case_depth(P)
    print("  m_mn %.4f -> CHD %.2f ... %.2f mm (550 HV)" % (cdp["mmn"], cdp["chd_min"], cdp["chd_max"]))
    print("== 7.9 inspection (chordal thickness, allowance %d um)" % P["thickness_allowance_um"])
    for i in (1, 2):
        t = chordal_thickness(P, g, i)
        print("  gear %d: outer chordal %.3f at height %.3f mm; mean normal chordal %.3f at height %.3f mm" % (
            i, t["s_chord_outer"], t["h_chord_outer"], t["s_chord_mean"], t["h_chord_mean"]))
    print("== 7.10 assembly")
    s = pinion_shim(marked_dev=0.04, housing_meas=82.13, housing_nominal=82.10, shim_nominal=0.50)
    print("  shim = 0.50 + (82.13 - 82.10) - 0.04 = %.2f mm" % s)
    for dx in (0.05, 0.10):
        bl = backlash_from_axial(P, dx, 2)
        print("  wheel moved %.2f mm away from the apex: radial separation %.4f mm, backlash change j_t %.1f um" % (dx, bl["da_mm"], bl["dj_t_um"]))
    print("  to open the backlash by 40 um: move the wheel %.3f mm (or the pinion %.3f mm) away from the apex" % (
        dx_for_backlash(P, 40, 2), dx_for_backlash(P, 40, 1)))
    print("== 8 worked example (4 kW, 1450 rpm, z 15/46, beta_m 35, S_H >= 1.2, S_F >= 1.6)")
    rows, chosen = design_example()
    for met, b, Re, sh, sf, ok in rows:
        print("  met %.2f: b %d mm (Re %.2f), S_H %.2f, S_F min %.2f -> %s" % (met, b, Re, sh, sf, "OK" if ok else "no"))
    if chosen:
        print("  chosen: met %.2f, b %d mm" % (chosen["met"], chosen["b"]))
        print(report_text(chosen))

def cmd_examples():
    P = dict(DEFAULT)
    print(report_text(P))
    print("\n## Straight bevel version (same size, beta_m 0)")
    Q = dict(P, kind="straight", beta_m_deg=0.0)
    R = capacity(Q)
    print("  eps_va %.3f, Ft %.0f, Fa1 %.0f, Fr1 %.0f N, sigma_H %.0f MPa, S_H %.2f, S_F %.2f / %.2f" % (
        R["g"]["eps_va"], R["F"]["Ft"], R["F"]["Fa1"], R["F"]["Fr1"], R["sH"], R["gear1"]["SH"], R["gear1"]["SF"], R["gear2"]["SF"]))
    print("\n## Effect of hand / rotation on the pinion axial force (spiral 35 deg)")
    for h in ("left", "right"):
        for r in ("cw", "ccw"):
            F = forces(dict(P, hand1=h, rotation1=r), geometry(P))
            print("  %-5s hand, %-3s: Fa1 %+6.0f N (%s apex), Fr1 %+6.0f N" % (h, r, F["Fa1"], "away from" if F["Fa1"] > 0 else "towards", F["Fr1"]))

def cmd_selftest():
    ok = []
    def chk(name, cond, info=""):
        ok.append(bool(cond))
        print("%-62s %s %s" % (name, "OK  " if cond else "FAIL", info))
    P = dict(DEFAULT)
    g = geometry(P)
    chk("delta1 + delta2 = Sigma", abs(math.degrees(g["delta1"] + g["delta2"]) - P["Sigma_deg"]) < 1e-9)
    chk("Re = de1/(2 sin d1) = de2/(2 sin d2)", abs(g["de1"] / (2 * math.sin(g["delta1"])) - g["de2"] / (2 * math.sin(g["delta2"]))) < 1e-9)
    chk("Sigma 90: tan d1 = z1/z2", abs(math.tan(g["delta1"]) - P["z1"] / P["z2"]) < 1e-12)
    chk("virtual ratio uv = u^2 for Sigma 90", abs(g["uv"] - g["u"] ** 2) < 1e-9)
    F = forces(P, g)
    chk("Sigma 90: wheel Fa = pinion Fr and wheel Fr = pinion Fa", abs(F["Fa2"] - F["Fr1"]) < 1e-9 and abs(F["Fr2"] - F["Fa1"]) < 1e-9)
    chk("torque from Ft at mean diameter = T1", abs(F["Ft"] * g["dm1"] / 2000 - F["T1"]) < 1e-9)
    S = dict(P, kind="straight", beta_m_deg=0.0)
    gs = geometry(S)
    Fs = forces(S, gs)
    an = math.radians(20)
    chk("straight: Fa1 = Ft tan(a) sin(d1), Fr1 = Ft tan(a) cos(d1)", abs(Fs["Fa1"] - Fs["Ft"] * math.tan(an) * math.sin(gs["delta1"])) < 1e-9 and
        abs(Fs["Fr1"] - Fs["Ft"] * math.tan(an) * math.cos(gs["delta1"])) < 1e-9)
    chk("constant clearance: tip angle 1 = root angle 2", abs(g["theta_a1"] - g["theta_f2"]) < 1e-15)
    cd = cutter_data(P, g)
    chk("cutter: spiral angle at the mean cone distance = beta_m", abs(cd["beta_mean"] - P["beta_m_deg"]) < 1e-6, "%.6f" % cd["beta_mean"])
    chk("face width b <= Re/3 and <= 10 met", g["checks"]["b_le_Re_3"] and g["checks"]["b_le_10met"])
    R = capacity(P)
    chk("safeties are finite and positive", all(R["gear%d" % i]["SF"] > 0 and R["gear%d" % i]["SH"] > 0 for i in (1, 2)))
    print("SELFTEST", "PASS" if all(ok) else "FAIL")
    return 0 if all(ok) else 1

def main(argv):
    if len(argv) < 2 or argv[1] in ("-h", "--help"):
        print(__doc__)
        return 0
    cmd = argv[1]
    if cmd == "params":
        print(json.dumps(DEFAULT, indent=2))
    elif cmd == "examples":
        cmd_examples()
    elif cmd in ("ch24", "ch56", "ch78"):
        {"ch24": demo_ch24, "ch56": demo_ch56, "ch78": demo_ch78}[cmd]()
    elif cmd == "selftest":
        return cmd_selftest()
    elif cmd == "run":
        P = dict(DEFAULT)
        out = "bevel_out"
        if "--in" in argv:
            with open(argv[argv.index("--in") + 1], encoding="utf-8") as f:
                P.update(json.load(f))
        if "--out" in argv:
            out = argv[argv.index("--out") + 1]
        run(P, out)
    else:
        print("unknown command; see --help")
        return 2
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv))
