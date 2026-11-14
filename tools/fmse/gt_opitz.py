#!/usr/bin/env python3
"""Group technology: simplified Opitz-style form code (5 digits) for ROTATIONAL parts.

SIMPLIFIED - check the original Opitz tables before you use the codes in a real classification
system. The meanings below follow the structure of the Opitz form code (digits 1-5) for
rotational part classes 0-2. Non-rotational parts (digit 1 = 6..9) are not covered here.

What the tool does:
  --digits 2,5,0,3,3   decode a code (also accepts 25033)
  --explain            print the full table of meanings for every digit
  --build ...          build a code from answers (--L --D --ext --int --plane --aux)
  --interactive        ask the questions on the console and build the code
  --compare A B        similarity of two codes = number of equal digits (0..5)
  (no option)          reproduce the example of the JSON (opitz_example, code 25033)

Digit 1 (part class) from the length / diameter ratio L/D:
    0  L/D <= 0.5    (disc)
    1  0.5 < L/D < 3 (short shaft, bush)
    2  L/D >= 3      (long shaft)
Similarity is only a first filter for part families: two parts with 4 or 5 equal digits are
good candidates for the same machine group and the same fixture / tool family.
"""

import argparse

from fmse_common import ITEM2_EXAMPLES, InputError, SelfTest, fmt_table, load_examples, run_main

NOTE = "simplified - check the original Opitz tables"

# ----------------------------------------------------------------------------- tables
DIGIT_NAMES = ["1 part class", "2 external shape", "3 internal shape", "4 plane surface machining",
               "5 auxiliary holes and gear teeth"]

TABLES = [
    {   # digit 1
        0: "rotational, L/D <= 0.5 (disc, flange, ring)",
        1: "rotational, 0.5 < L/D < 3 (short shaft, bush, sleeve)",
        2: "rotational, L/D >= 3 (long shaft, spindle)",
        3: "rotational with deviation (e.g. eccentric), L/D <= 2",
        4: "rotational with deviation, L/D > 2",
        5: "special rotational part",
        6: "non-rotational (prismatic) - not covered by this simplified table",
        7: "non-rotational (prismatic) - not covered by this simplified table",
        8: "non-rotational (prismatic) - not covered by this simplified table",
        9: "non-rotational (prismatic) - not covered by this simplified table",
    },
    {   # digit 2 external shape
        0: "smooth, no shape elements",
        1: "stepped to one end (or smooth), no shape elements",
        2: "stepped to one end, with screw thread",
        3: "stepped to one end, with functional groove",
        4: "stepped to both ends, no shape elements",
        5: "stepped to both ends, with screw thread",
        6: "stepped to both ends, with functional groove",
        7: "functional cone (taper)",
        8: "operating thread (e.g. lead screw, worm)",
        9: "all others",
    },
    {   # digit 3 internal shape
        0: "no through bore, no blind hole (centre holes do not count)",
        1: "smooth or stepped to one end, no shape elements",
        2: "stepped to one end, with screw thread",
        3: "stepped to one end, with functional groove",
        4: "stepped to both ends, no shape elements",
        5: "stepped to both ends, with screw thread",
        6: "stepped to both ends, with functional groove",
        7: "functional cone (internal taper)",
        8: "operating thread (internal)",
        9: "all others",
    },
    {   # digit 4 plane surface machining
        0: "no plane surface machining",
        1: "external plane surface and/or surface curved in one direction",
        2: "external plane surfaces related to each other by graduation around a circle (flats, hexagon)",
        3: "external groove and/or slot (e.g. keyway)",
        4: "external spline / polygon",
        5: "external plane surface and/or slot, plus external spline",
        6: "internal plane surface and/or slot (e.g. internal keyway)",
        7: "internal spline / polygon",
        8: "internal and external polygon, groove and/or slot",
        9: "all others",
    },
    {   # digit 5 auxiliary holes and gear teeth
        0: "no auxiliary holes, no gear teeth",
        1: "axial holes, not related by a drilling pattern",
        2: "axial holes, related by a drilling pattern (e.g. bolt circle)",
        3: "radial holes, not related by a drilling pattern",
        4: "holes in axial and/or radial and/or other directions, not related by a pattern",
        5: "holes in axial and/or radial and/or other directions, related by a drilling pattern",
        6: "spur gear teeth",
        7: "bevel gear teeth",
        8: "other gear teeth (e.g. worm wheel, spline teeth)",
        9: "all others",
    },
]

# answers used by --build / --interactive for digits 2 and 3
STEP_CHOICES = {"none": "no step (smooth)", "one": "stepped to one end", "both": "stepped to both ends"}
ELEM_CHOICES = {"none": "no shape element", "thread": "screw thread", "groove": "functional groove"}
SPECIAL = {"cone": 7, "opthread": 8, "other": 9}


# ----------------------------------------------------------------------------- core
def parse_code(text):
    """'2,5,0,3,3' or '25033' -> [2, 5, 0, 3, 3]."""
    s = str(text).replace(" ", "")
    parts = s.split(",") if "," in s else list(s)
    if len(parts) != 5 or not all(p.isdigit() and len(p) == 1 for p in parts):
        raise InputError(f"code '{text}' must have exactly 5 digits 0-9, e.g. 25033 or 2,5,0,3,3")
    return [int(p) for p in parts]


def decode(code):
    """List of (digit name, value, meaning)."""
    d = parse_code(code) if not isinstance(code, list) else code
    return [(DIGIT_NAMES[k], d[k], TABLES[k][d[k]]) for k in range(5)]


def digit1_from_ratio(L, D):
    """Part class for a plain rotational part from L/D."""
    if L <= 0 or D <= 0:
        raise InputError("L and D must be > 0")
    r = L / D
    return (0 if r <= 0.5 else 1 if r < 3 else 2), r


def shape_digit(answer, internal=False):
    """Digit 2 (external) or 3 (internal) from an answer like 'both-thread', 'one', 'cone', 'none'.

    External: step = none|one|both, element = none|thread|groove; special = cone|opthread|other.
    Internal: additionally 'none' alone = no bore (digit 0); 'smooth' = smooth bore (digit 1).
    """
    a = answer.strip().lower()
    if a in SPECIAL:
        return SPECIAL[a]
    if internal and a in ("none", "nobore", "no"):
        return 0
    if internal and a == "smooth":
        return 1
    step, _, elem = a.partition("-")
    elem = elem or "none"
    if step not in STEP_CHOICES or elem not in ELEM_CHOICES:
        raise InputError(f"shape answer '{answer}' not understood. Use step-element, step = none|one|both, "
                         f"element = none|thread|groove (e.g. both-thread), or cone|opthread|other"
                         + (", or 'none' for no bore, 'smooth' for a smooth bore" if internal else ""))
    if step in ("none", "one"):
        base = 1
        if step == "none" and elem == "none":
            return 1 if internal else 0
    else:
        base = 4
    return base + ["none", "thread", "groove"].index(elem)


def build(L, D, ext, internal, plane, aux):
    """Build the 5-digit code from answers. Returns (digits, notes)."""
    d1, r = digit1_from_ratio(L, D)
    d2 = shape_digit(ext)
    d3 = shape_digit(internal, internal=True)
    for name, v in (("plane", plane), ("aux", aux)):
        if not (isinstance(v, int) and 0 <= v <= 9):
            raise InputError(f"--{name} must be a digit 0-9 (see --explain)")
    notes = [f"L/D = {L:g}/{D:g} = {r:.2f} -> digit 1 = {d1}"]
    return [d1, d2, d3, plane, aux], notes


def similarity(a, b):
    """Number of equal digits in the same position (0..5) and the list of equal positions."""
    da, db = parse_code(a), parse_code(b)
    eq = [k + 1 for k in range(5) if da[k] == db[k]]
    return len(eq), eq


def code_str(d):
    return "".join(str(x) for x in d)


# ----------------------------------------------------------------------------- report
def print_decode(code, title="Decode"):
    d = parse_code(code) if not isinstance(code, list) else code
    print(f"{title}: code {code_str(d)}   ({NOTE})")
    print(fmt_table(["digit", "value", "meaning"], [[n, v, m] for n, v, m in decode(d)], "lrl"))


def print_explain():
    print(f"SIMPLIFIED OPITZ-STYLE FORM CODE - rotational parts   ({NOTE})")
    for k in range(5):
        print()
        print(f"Digit {DIGIT_NAMES[k]}")
        for v in range(10):
            print(f"  {v}  {TABLES[k][v]}")
    print()
    print("Answers for --build:  --ext / --int = step-element: step none|one|both, element none|thread|groove,")
    print("                      or cone | opthread | other;  --int none = no bore, --int smooth = smooth bore")


def print_example(ex):
    print(f"JSON example: {ex.get('part', '')}")
    rows = [[n, why, v, TABLES[k][v]] for k, (n, why, v) in enumerate(ex["digits"])]
    print(fmt_table(["digit", "reason", "value", "table meaning"], rows, "llrl"))
    built = code_str([r[2] for r in ex["digits"]])
    print(f"Code = {built}   (JSON code {ex['code']}: {'same' if built == ex['code'] else 'DIFFERENT'})")
    print(f"Note: {ex.get('_note', NOTE)}")


def ask(prompt, choices=None, cast=str):
    while True:
        try:
            raw = input(prompt).strip()
        except EOFError:
            raise InputError("no input (interactive mode needs a console)")
        try:
            v = cast(raw)
        except ValueError:
            print("  please enter a valid value")
            continue
        if choices is None or v in choices:
            return v
        print(f"  choose one of: {', '.join(str(c) for c in choices)}")


def interactive():
    print(f"Build an Opitz-style code for a rotational part   ({NOTE})")
    L = ask("Length L [mm]: ", cast=float)
    D = ask("Largest diameter D [mm]: ", cast=float)
    print("External shape: step = none | one | both   element = none | thread | groove")
    print("                (or type cone / opthread / other)")
    ext = ask("  external, e.g. both-thread: ")
    print("Internal shape: none = no bore, smooth, or step-element as above, or cone / opthread / other")
    inn = ask("  internal, e.g. none: ")
    print("Plane surface machining (digit 4):")
    for v in range(10):
        print(f"  {v}  {TABLES[3][v]}")
    plane = ask("  digit 4: ", list(range(10)), int)
    print("Auxiliary holes and gear teeth (digit 5):")
    for v in range(10):
        print(f"  {v}  {TABLES[4][v]}")
    aux = ask("  digit 5: ", list(range(10)), int)
    d, notes = build(L, D, ext, inn, plane, aux)
    print()
    for n in notes:
        print(n)
    print_decode(d, "Result")


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("gt_opitz")
    _, ex = load_examples(path, "opitz_example")
    t.equal("parse 2,5,0,3,3", parse_code("2,5,0,3,3"), [2, 5, 0, 3, 3])
    t.equal("parse 25033", parse_code("25033"), [2, 5, 0, 3, 3])
    t.equal("JSON digits give code", code_str([r[2] for r in ex["digits"]]), ex["code"])
    t.equal("JSON code is 25033", ex["code"], "25033")
    d1, r = digit1_from_ratio(320, 60)
    t.close("L/D 320/60", r, 5.333333333, 1e-8)
    t.equal("digit 1 for L/D 5.33", d1, 2)
    t.equal("digit 1 for L/D 0.5 (boundary)", digit1_from_ratio(30, 60)[0], 0)
    t.equal("digit 1 for L/D 3 (boundary)", digit1_from_ratio(180, 60)[0], 2)
    t.equal("digit 1 for L/D 2.99", digit1_from_ratio(299, 100)[0], 1)
    t.equal("ext both-thread -> 5", shape_digit("both-thread"), 5)
    t.equal("ext one-groove -> 3", shape_digit("one-groove"), 3)
    t.equal("ext none -> 0", shape_digit("none"), 0)
    t.equal("int none -> 0 (no bore)", shape_digit("none", True), 0)
    t.equal("int both -> 4", shape_digit("both", True), 4)
    t.equal("cone -> 7", shape_digit("cone"), 7)
    built, _ = build(320, 60, "both-thread", "none", 3, 3)
    t.equal("build crankshaft example = 25033", code_str(built), "25033")
    t.true("decode digit 2 = stepped to both ends, with screw thread",
           decode("25033")[1][2] == "stepped to both ends, with screw thread")
    t.equal("similarity 25033 vs 25033", similarity("25033", "25033")[0], 5)
    t.equal("similarity 25033 vs 15033", similarity("25033", "15033"), (4, [2, 3, 4, 5]))
    t.equal("similarity 25033 vs 14102", similarity("25033", "14102")[0], 0)
    try:
        parse_code("2503")
        t.true("short code rejected", False)
    except InputError:
        t.true("short code rejected", True)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n  python tools/fmse/gt_opitz.py --digits 2,5,0,3,3\n"
               "  python tools/fmse/gt_opitz.py --build --L 320 --D 60 --ext both-thread --int none --plane 3 --aux 3\n"
               "  python tools/fmse/gt_opitz.py --compare 25033 15033\n"
               "  python tools/fmse/gt_opitz.py --explain")
    ap.add_argument("--examples", default=str(ITEM2_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--digits", help="code to decode, e.g. 2,5,0,3,3 or 25033")
    ap.add_argument("--explain", action="store_true", help="print the meaning tables of all digits")
    ap.add_argument("--build", action="store_true", help="build a code from --L --D --ext --int --plane --aux")
    ap.add_argument("--L", type=float, help="part length [mm]")
    ap.add_argument("--D", type=float, help="largest diameter [mm]")
    ap.add_argument("--ext", default="none", help="external shape answer (default none), e.g. both-thread")
    ap.add_argument("--int", dest="internal", default="none", help="internal shape answer (default none = no bore)")
    ap.add_argument("--plane", type=int, default=0, help="digit 4 value 0-9 (default 0)")
    ap.add_argument("--aux", type=int, default=0, help="digit 5 value 0-9 (default 0)")
    ap.add_argument("--interactive", action="store_true", help="ask the questions on the console")
    ap.add_argument("--compare", nargs=2, metavar=("CODE1", "CODE2"), help="similarity of two codes")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    did = False
    if a.explain:
        print_explain()
        did = True
    if a.digits:
        print_decode(a.digits)
        did = True
    if a.build:
        if a.L is None or a.D is None:
            raise InputError("--build needs --L and --D")
        d, notes = build(a.L, a.D, a.ext, a.internal, a.plane, a.aux)
        for n in notes:
            print(n)
        print_decode(d, "Built code")
        did = True
    if a.interactive:
        interactive()
        did = True
    if a.compare:
        n, eq = similarity(*a.compare)
        print(f"Similarity {code_str(parse_code(a.compare[0]))} vs {code_str(parse_code(a.compare[1]))}: "
              f"{n} of 5 digits equal (positions {', '.join(map(str, eq)) or 'none'})")
        print("  5 = same form family, 4 = very similar, 3 = check the drawing, <= 2 = different family")
        did = True
    if not did:
        _, ex = load_examples(a.examples, "opitz_example")
        print_example(ex)
        print()
        print_decode(ex["code"])
    return 0


if __name__ == "__main__":
    run_main(main)
