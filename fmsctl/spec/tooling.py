"""Tool data of the crankcase HMCs [example – replace with the tooling supplier's list and your own trials].

TOOL_TYPES   tool type -> description, nominal life in USES (holes, faces, bores), warning limit in %
MAGAZINE     pocket -> tool type, identical in HMC-01..03 (sister tools = the same type in two pockets)
PROGRAM_TOOLS NC program -> [(tool type, uses per part)]
A CNC with tool-life management (e.g. Fanuc "tool life management groups") counts the uses per pocket and switches to the
sister pocket when one is used up; the remaining life of every pocket is published in registers 310-339 (0.1 %).
"""

TOOL_TYPES = {
    'T01': ('Face mill Ø100, 7 inserts (deck + base faces)', 600, 15),
    'T02': ('End mill Ø20 (pads, slots)', 900, 15),
    'T03': ('Boring bar cylinder seat Ø65 (VC10)', 450, 15),
    'T04': ('Boring bar cylinder seat Ø80 (VC20)', 450, 15),
    'T05': ('Boring bar cylinder seat Ø90 (VC30)', 400, 15),
    'T06': ('Boring bar bearing bore Ø52 (VC10)', 500, 15),
    'T07': ('Boring bar bearing bore Ø62 (VC20)', 500, 15),
    'T08': ('Boring bar bearing bore Ø72 (VC30)', 450, 15),
    'T09': ('Drill Ø6.8 (M8 tap holes)', 2400, 10),
    'T10': ('Tap M8', 1500, 10),
    'T11': ('Drill Ø8.5 (M10 tap holes)', 2000, 10),
    'T12': ('Tap M10', 1200, 10),
    'T13': ('Chamfer / spot drill 90°', 4000, 10),
    'T14': ('Reamer Ø10 H7 (dowel holes)', 1600, 10),
    'T15': ('Drill Ø12 (oil / breather holes)', 1800, 10),
}

MAGAZINE = {1: 'T01', 2: 'T02', 3: 'T03', 4: 'T04', 5: 'T05', 6: 'T06', 7: 'T07', 8: 'T08', 9: 'T09', 10: 'T09',
            11: 'T10', 12: 'T10', 13: 'T11', 14: 'T12', 15: 'T12', 16: 'T13', 17: 'T14', 18: 'T15'}
# pockets 19-30 free (reserve for Roots blower / new variants)

_COMMON = [('T01', 4), ('T02', 6), ('T09', 16), ('T10', 16), ('T11', 6), ('T12', 6), ('T13', 22), ('T14', 2), ('T15', 3)]
PROGRAM_TOOLS = {
    1010: _COMMON + [('T03', 2), ('T06', 2)],
    1020: _COMMON + [('T04', 2), ('T07', 2)],
    1030: _COMMON + [('T05', 2), ('T08', 2)],
}


def usage_pct(tool_type, uses):
    """Life consumed by `uses` uses, in 0.1 % units (register unit)."""
    return 1000.0 * uses / TOOL_TYPES[tool_type][1]
