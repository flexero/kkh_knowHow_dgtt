"""Generate web/asrsckt_card.js (catalogue card of AS/RS item 3) from docs/33_asrs_control_circuits.md.
Buy list = chapter 30 (sections 30.1 ...), shopping list = chapter 31, drawings = table of chapter 29.
Run from the repo root:  python tools/gen_asrsckt_card.py   (stdlib only)
"""
import json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
md = (ROOT / "docs" / "33_asrs_control_circuits.md").read_text(encoding="utf-8")


def table_rows(block):
    rows = []
    for line in block.splitlines():
        line = line.strip()
        if not line.startswith("|") or re.match(r"^\|[-\s|]+\|$", line):
            continue
        cells = [c.strip().replace("**", "").replace("`", "") for c in line.strip("|").split("|")]
        rows.append(cells)
    return rows[1:] if rows else []  # drop header


def chapter(num):
    m = re.search(rf"^## {num}\. .*?$(.*?)(?=^## \d+\. |\Z)", md, re.S | re.M)
    return m.group(1) if m else ""


# buy list groups
ch30 = chapter(30)
groups = []
for m in re.finditer(r"^### (30\.\d+) (.+?)$(.*?)(?=^### |\Z)", ch30, re.S | re.M):
    num, title, body = m.group(1), m.group(2).strip(), m.group(3)
    rows = [r for r in table_rows(body) if len(r) == 6]
    groups.append({"id": "g" + num.replace(".", "_"), "t": title, "src": f"guide 33 §{num}", "rows": rows})

# shopping list
shop_rows = [r for r in table_rows(chapter(31)) if len(r) == 6]

# drawings (chapter 29 table: # | File | Content)
CAP = {
    "33_supply_power_rail.svg": ("Supply + conductor rail", "§4 – §5"),
    "33_dc_link_drives.svg": ("Crane drives – shared DC link", "§6 – §8"),
    "33_hoist_safety.svg": ("Hoist safety chain", "§9"),
    "33_travel_limits_positioning.svg": ("Travel limits + positioning", "§10"),
    "33_safety_circuit_cat3.svg": ("Safety circuit Cat 3 / PL d", "§11 – §13"),
    "33_crane_plc_io.svg": ("Crane PLC I/O + data link", "§14 – §15"),
    "33_conveyor_io_circuits.svg": ("Conveyor + I/O station", "§16"),
    "33_crane_cabinet_layout.svg": ("Crane cabinet layout + heat", "§17, §19"),
}
drawings = []
for r in table_rows(chapter(29)):
    if len(r) < 3:
        continue
    f = r[1].replace("img/", "")
    t, g = CAP.get(f, (f, ""))
    drawings.append({"f": f, "t": t, "c": r[2] + " (example values)", "g": "guide 33 " + g})

card = {
    "drawings": drawings, "groups": groups,
    "shopCols": ["#", "Tag", "Item", "Example product (chapter 30)", "Spec (example)", "Qty"], "shop": shop_rows, "shopM": 3, "shopP": -1,
    "shopW": [4, 13, 27, 26, 20, 10],
    "guides": "guide 33", "shopTab": "Shopping list (BOM) – ASRS-RAW", "ph": "(e.g. VAHLE, deTec4, PNOZ s30, DDLS)",
    "buyNote": "Price classes: € < 50 € · €€ 50 – 300 € · €€€ 300 – 1 500 € · €€€€ > 1 500 € (rough estimates, without installation – ask 2 – 3 suppliers).",
    "shopLbl": "shopping list", "shopTitle": "Shopping list for one aisle with one stacker crane (guide 33 chapter 31) – same tags as the drawings and card D.",
    "shopNote": "Example quantities and ratings for the default inputs of card C. In most projects the AS/RS supplier delivers crane, drives and safety as one system – use the list to check the offer and for spare parts.",
    "shopPrice": True,
}
out = ("/* AS/RS item 3 – data for the card \"Real components + drawings – catalogue examples\" (makeCard in robotref.js).\n"
       " * GENERATED from docs/33_asrs_control_circuits.md (chapters 29, 30, 31) by tools/gen_asrsckt_card.py – do not edit by hand.\n"
       " * Row format: [item, required spec, example maker + model, key data, price class (estimate), check in the datasheet]. */\n"
       "export const CARD = " + json.dumps(card, ensure_ascii=False, indent=1) + ";\n")
(ROOT / "web" / "asrsckt_card.js").write_text(out, encoding="utf-8")
print(f"drawings={len(drawings)} groups={len(groups)} rows={sum(len(g['rows']) for g in groups)} shop={len(shop_rows)}")
