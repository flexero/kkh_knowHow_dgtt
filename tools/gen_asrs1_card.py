# Generates web/asrs3d_data.js (card "Real components + drawings – catalogue examples", #srCard1) from docs/31_asrs_mechanical_3d.md
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
md = open(ROOT + r"\docs\31_asrs_mechanical_3d.md", encoding="utf-8").read()

def table_after(text):
    rows = []
    for ln in text.splitlines():
        ln = ln.strip()
        if not ln.startswith("|"):
            if rows: break
            continue
        cells = [c.strip() for c in ln.strip("|").split("|")]
        if set("".join(cells)) <= set("-: "): continue
        rows.append([c.replace("**", "").replace("`", "") for c in cells])
    return rows[0], rows[1:]

sec18 = md[md.index("## 18. Buy list"):md.index("## 19. Shopping list")]
groups = []
for m in re.finditer(r"^### (18\.\d+) (.+)$", sec18, re.M):
    hdr, rows = table_after(sec18[m.end():])
    assert len(hdr) == 6, hdr
    groups.append({"id": "b" + m.group(1).replace(".", "_"), "t": m.group(2).strip(), "src": "guide 31 §" + m.group(1), "rows": rows})
sec19 = md[md.index("## 19. Shopping list"):md.index("## 20. Standards register")]
shdr, srows = table_after(sec19)
sec25 = md[md.index("## 25. Drawings"):md.index("## Appendix A")]
dhdr, drows = table_after(sec25)
TITLES = {"31_rack_elevation.svg": "Rack – front elevation + cross-section", "31_slot_numbering.svg": "Slot numbering scheme",
          "31_rack_load_diagram.svg": "Rack loads – beam, upright, floor", "31_crane_ga.svg": "Stacker crane – general arrangement",
          "31_crane_drive_train.svg": "Crane drive trains – travel + hoist", "31_mast_deflection.svg": "Mast deflection model",
          "31_io_layout.svg": "I/O area layout (plan)", "31_fem9851_cycle.svg": "FEM 9.851 cycle – P1 / P2",
          "31_positioning_budget.svg": "Positioning accuracy budget"}
drawings = []
for f, c, g in drows:
    fn = f.replace("img/", "")
    drawings.append({"f": fn, "t": TITLES[fn], "c": c[0].upper() + c[1:], "g": "guide 31 " + g})
card = {"drawings": drawings, "groups": groups,
        "shops": [{"title": "", "cols": shdr, "rows": srows, "m": 4, "p": 5, "w": [4, 7, 21, 27, 26, 15]}],
        "guides": "guide 31", "shopTab": "Shopping list – ASRS-RAW", "ph": "(e.g. SICK, Vahle, SEW, Troax, rail)",
        "buyNote": "Price classes: € < 1 k, €€ 1–10 k, €€€ 10–100 k, €€€€ > 100 k – rough estimates (Europe, 2020s, without installation); always ask 2–3 suppliers.",
        "shopLbl": "shopping list", "shopTitle": "Mechanical system of the raw-material AS/RS (392 slots, 1 stacker crane, I/O) – guide 31 §19. In practice bought as one turnkey package; the list shows what is inside to compare offers.",
        "shopNote": "Quantities follow the 3D twin and guide 31. Example – the AS/RS supplier's offer decides.", "shopPrice": True}
js = ("/* AS/RS item 1 – data for the card \"Real components + drawings – catalogue examples\" (#srCard1, makeCard from robotref.js).\n"
      " * GENERATED from docs/31_asrs_mechanical_3d.md §18 (buy list), §19 (shopping list), §25 (drawings) – do not edit by hand; regenerate with tools/gen_asrs1_card.py.\n"
      " * Makers and models are real catalogue EXAMPLES – data and prices change; ask the supplier for the current datasheet and a quote.\n */\n"
      "export const CARD = " + json.dumps(card, ensure_ascii=False, indent=1) + ";\n")
open(ROOT + r"\web\asrs3d_data.js", "w", encoding="utf-8").write(js)
print("groups", len(groups), "rows", sum(len(g["rows"]) for g in groups), "shop", len(srows), "drawings", len(drawings))
