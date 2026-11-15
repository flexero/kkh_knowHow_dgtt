#!/usr/bin/env python3
"""Soft PLC for unit tests: an interpreter for a subset of IEC 61131-3 Structured Text (ST) that loads the device FB
library tools/fmse/plc_lib/*.st and runs the item-10A unit tests against the REAL ST source.

Python 3 standard library only, offline. The test harness (events, log format, alarm manager, command matrix, item-9
plant model) is the one of fb_library.py, only the FB implementation is different: here every FB is the parsed .st
file. `--test` must reproduce the reference output line by line (fb_library_ref.REF_10A, REF_9_DEVICE).

Supported ST subset (keep the library inside it - plc_lib_check.py parses every file with this interpreter):
  POUs        FUNCTION_BLOCK, FUNCTION (return value = assignment to the function name), PROGRAM
  types       TYPE ... END_TYPE with enumerations  E_X : (A := 0, B, C := 5) INT;  (qualified access E_X.A)
  globals     VAR_GLOBAL [CONSTANT] ... END_VAR (also 'AT %IX0.0' locations of generated code)
  sections    VAR_INPUT, VAR_OUTPUT, VAR, VAR_TEMP, VAR CONSTANT (RETAIN / PERSISTENT accepted and ignored)
  data types  BOOL, SINT, INT, DINT, LINT, USINT, UINT, UDINT, ULINT, BYTE, WORD, DWORD, LWORD, REAL, LREAL,
              TIME (DINT ms), enumerations, FB instances, ARRAY [lo..hi] OF <elementary type>; initial values
  literals    TRUE/FALSE, 123, 1_000, 16#FF, 2#1010, 8#17, 1.5, 1.0E3, INT#5, T#1s500ms / TIME#100ms
  statements  :=, IF/ELSIF/ELSE, CASE (values, ranges a..b, lists, ELSE), FOR .. TO .. BY, WHILE, REPEAT .. UNTIL,
              EXIT, RETURN, FB calls with named parameters (:= inputs, => outputs), instance.output access
  operators   OR, XOR, AND, &, = <>, < > <= >=, + -, * / MOD, **, unary - and NOT (IEC precedence)
  functions   ABS, MIN, MAX, LIMIT, SEL, MUX, SQRT, TRUNC, <type>_TO_<type>, TO_<type>; user FUNCTIONs
  std FBs     R_TRIG, F_TRIG, TON, TOF, TP, CTU, CTD, SR, RS (written in ST inside this file, item-9 definitions)
  comments    (* ... *), /* ... */ and // ...
Strict typing: BOOL <-> number and REAL -> integer need an explicit conversion; integers wrap like the PLC type;
integer '/' truncates toward zero; MOD has the sign of the dividend; division by zero, array index out of range and
endless loops (watchdog) stop with an error that names the file and line. REAL is computed in 64 bit.

Usage:
  python tools/fmse/st_sim.py --test                     (all 19 FB tests + alarm manager + matrix + item 9)
  python tools/fmse/st_sim.py --test FB_Valve2           (one FB or a test id: --test V4)
  python tools/fmse/st_sim.py --list                     (POUs of the library with interface size)
  python tools/fmse/st_sim.py --run FB_Sensor --ticks 20 --set tOn_ms=300 --events "2:xOn=1;8:xOn=0"
  python tools/fmse/st_sim.py --run FB_Valve1 --ticks 30 --events "2:xCmdB=1,xPosA=0;8:xPosB=1" --trace
  python tools/fmse/st_sim.py --file my_fb.st --run FB_My --ticks 10   (extra .st files on top of the library)
  python tools/fmse/st_sim.py --features
  python tools/fmse/st_sim.py --md st_tests.md --json
  python tools/fmse/st_sim.py --selftest
"""

import argparse
import bisect
import json
import math
import re
from pathlib import Path

import device_fb
import fb_library as fbl
from fb_library_ref import REF_10A, REF_9_DEVICE
from fmse_common import InputError, SelfTest, fmt_table, run_main

HERE = Path(__file__).resolve().parent
PLC_LIB = HERE / "plc_lib"
FEATURES = [
    "POU: FUNCTION_BLOCK, FUNCTION (return by name), PROGRAM",
    "TYPE ... END_TYPE enumerations with values and base type, qualified access E_X.A",
    "VAR_GLOBAL and VAR_GLOBAL CONSTANT (with AT %I/%Q locations of generated code)",
    "sections VAR_INPUT, VAR_OUTPUT, VAR, VAR_TEMP, VAR CONSTANT (RETAIN/PERSISTENT ignored)",
    "types BOOL, SINT, INT, DINT, LINT, USINT, UINT, UDINT, ULINT, BYTE, WORD, DWORD, LWORD, REAL, LREAL, TIME",
    "ARRAY [lo..hi] OF elementary type, initial values incl. [1, 2, 3] and [5(0)]",
    "literals TRUE/FALSE, decimal with _, 16#/8#/2#, REAL with exponent, typed INT#5, T#1s500ms",
    "assignment := with type check and integer wrap-around",
    "IF / ELSIF / ELSE / END_IF",
    "CASE with values, ranges a..b, lists, enum labels, ELSE",
    "FOR .. TO .. BY .. DO, WHILE .. DO, REPEAT .. UNTIL, EXIT, RETURN",
    "FB instance calls with named inputs (:=) and outputs (=>), instance.output access",
    "operators OR XOR AND & = <> < > <= >= + - * / MOD ** NOT unary minus (IEC precedence)",
    "functions ABS MIN MAX LIMIT SEL MUX SQRT TRUNC, <type>_TO_<type>, TO_<type>, user FUNCTIONs",
    "standard FBs R_TRIG F_TRIG TON TOF TP CTU CTD SR RS (in ST, simulated clock)",
    "comments (* *), /* */, //",
    "errors with file:line, watchdog for endless loops",
]

INT_TYPES = {"SINT": (8, True), "INT": (16, True), "DINT": (32, True), "LINT": (64, True), "USINT": (8, False),
             "UINT": (16, False), "UDINT": (32, False), "ULINT": (64, False), "BYTE": (8, False),
             "WORD": (16, False), "DWORD": (32, False), "LWORD": (64, False), "TIME": (32, True)}
REAL_TYPES = {"REAL", "LREAL"}
ELEMENTARY = set(INT_TYPES) | REAL_TYPES | {"BOOL"}
WATCHDOG = 1_000_000

STD_FB_SOURCE = """
(* IEC 61131-3 standard FBs, definitions = item 9 _rules.fb_trace (iec_std_fb.py). Time from SIM_NOW_MS(). *)
FUNCTION_BLOCK R_TRIG
VAR_INPUT CLK : BOOL; END_VAR
VAR_OUTPUT Q : BOOL; END_VAR
VAR M : BOOL; END_VAR
Q := CLK AND NOT M;
M := CLK;
END_FUNCTION_BLOCK

FUNCTION_BLOCK F_TRIG
VAR_INPUT CLK : BOOL; END_VAR
VAR_OUTPUT Q : BOOL; END_VAR
VAR P : BOOL; END_VAR
Q := NOT CLK AND P;
P := CLK;
END_FUNCTION_BLOCK

FUNCTION_BLOCK TON
VAR_INPUT IN : BOOL; PT : TIME; END_VAR
VAR_OUTPUT Q : BOOL; ET : TIME; END_VAR
VAR tStart : TIME; xRun : BOOL; END_VAR
IF IN THEN
  IF NOT xRun THEN xRun := TRUE; tStart := SIM_NOW_MS(); END_IF
  ET := MIN(PT, SIM_NOW_MS() - tStart);
  Q := ET >= PT;
ELSE
  xRun := FALSE; ET := T#0ms; Q := FALSE;
END_IF
END_FUNCTION_BLOCK

FUNCTION_BLOCK TOF
VAR_INPUT IN : BOOL; PT : TIME; END_VAR
VAR_OUTPUT Q : BOOL; ET : TIME; END_VAR
VAR xRun : BOOL; xFall : BOOL; tFall : TIME; END_VAR
IF IN THEN
  xRun := TRUE; xFall := FALSE; ET := T#0ms; Q := TRUE;
ELSIF xRun THEN
  IF NOT xFall THEN xFall := TRUE; tFall := SIM_NOW_MS(); END_IF
  ET := MIN(PT, SIM_NOW_MS() - tFall);
  Q := ET < PT;
ELSE
  ET := T#0ms; Q := FALSE;
END_IF
END_FUNCTION_BLOCK

FUNCTION_BLOCK TP
VAR_INPUT IN : BOOL; PT : TIME; END_VAR
VAR_OUTPUT Q : BOOL; ET : TIME; END_VAR
VAR xPrev : BOOL; xStarted : BOOL; tStart : TIME; tEl : TIME; END_VAR
IF IN AND NOT xPrev AND NOT xStarted THEN xStarted := TRUE; tStart := SIM_NOW_MS(); END_IF
IF xStarted THEN
  tEl := SIM_NOW_MS() - tStart;
  IF tEl < PT THEN
    Q := TRUE; ET := tEl;
  ELSE
    Q := FALSE; ET := PT;
    IF NOT IN THEN xStarted := FALSE; ET := T#0ms; END_IF
  END_IF
ELSE
  Q := FALSE; ET := T#0ms;
END_IF
xPrev := IN;
END_FUNCTION_BLOCK

FUNCTION_BLOCK CTU
VAR_INPUT CU : BOOL; R : BOOL; PV : INT; END_VAR
VAR_OUTPUT Q : BOOL; CV : INT; END_VAR
VAR xPrev : BOOL; END_VAR
IF R THEN CV := 0;
ELSIF CU AND NOT xPrev AND CV < 32767 THEN CV := CV + 1;
END_IF
xPrev := CU;
Q := CV >= PV;
END_FUNCTION_BLOCK

FUNCTION_BLOCK CTD
VAR_INPUT CD : BOOL; LD : BOOL; PV : INT; END_VAR
VAR_OUTPUT Q : BOOL; CV : INT; END_VAR
VAR xPrev : BOOL; END_VAR
IF LD THEN CV := PV;
ELSIF CD AND NOT xPrev AND CV > -32768 THEN CV := CV - 1;
END_IF
xPrev := CD;
Q := CV <= 0;
END_FUNCTION_BLOCK

FUNCTION_BLOCK SR
VAR_INPUT S1 : BOOL; R : BOOL; END_VAR
VAR_OUTPUT Q1 : BOOL; END_VAR
Q1 := S1 OR (NOT R AND Q1);
END_FUNCTION_BLOCK

FUNCTION_BLOCK RS
VAR_INPUT S : BOOL; R1 : BOOL; END_VAR
VAR_OUTPUT Q1 : BOOL; END_VAR
Q1 := NOT R1 AND (S OR Q1);
END_FUNCTION_BLOCK
"""


class STError(InputError):
    """Syntax, type or run-time error in ST source (printed with file:line, no traceback)."""


class _Exit(Exception):
    pass


class _Return(Exception):
    pass


# ----------------------------------------------------------------------------- lexer
_NUMTYPES = "SINT|INT|DINT|LINT|USINT|UINT|UDINT|ULINT|BYTE|WORD|DWORD|LWORD|REAL|LREAL|BOOL"
TOKEN_RE = re.compile(r"""
 (?P<ws>\s+)
|(?P<com>\(\*.*?\*\)|/\*.*?\*/|//[^\n]*)
|(?P<time>(?:LTIME|TIME|LT|T)\#-?[0-9_.]+[a-z]+(?:[0-9_.]+[a-z]+)*)
|(?P<typed>(?:""" + _NUMTYPES + r""")\#[-+]?(?:\d+\#[0-9a-f_]+|[0-9_.]+(?:e[-+]?\d+)?|TRUE|FALSE))
|(?P<based>\d+\#[0-9a-f_]+)
|(?P<real>\d[\d_]*\.\d[\d_]*(?:e[-+]?\d+)?|\d[\d_]*e[-+]?\d+)
|(?P<int>\d[\d_]*)
|(?P<loc>%[IQM][XBWDL]?[\d.]+)
|(?P<str>'[^']*')
|(?P<id>[a-z_][a-z0-9_]*)
|(?P<op>:=|=>|<=|>=|<>|\*\*|\.\.|[-+*/()=<>,;:.\[\]&])
""", re.X | re.S | re.I)
_TIME_UNITS = {"d": 86400000, "h": 3600000, "m": 60000, "s": 1000, "ms": 1}


def parse_time(text, where):
    body = text.split("#", 1)[1].replace("_", "").lower()
    neg = body.startswith("-")
    body = body.lstrip("-")
    parts = re.findall(r"([0-9.]+)(ms|d|h|m|s|us|ns)", body)
    if not parts or "".join(a + b for a, b in parts) != body:
        raise STError(f"{where}: bad time literal '{text}'")
    ms = 0.0
    for num, unit in parts:
        if unit in ("us", "ns"):
            ms += float(num) / (1000.0 if unit == "us" else 1e6)
        else:
            ms += float(num) * _TIME_UNITS[unit]
    return -int(ms) if neg else int(ms)


def parse_int(text):
    t = text.replace("_", "")
    if "#" in t:
        b, v = t.split("#", 1)
        return int(v, int(b))
    return int(t)


def lex(text, fname):
    toks, pos = [], 0
    starts = [0] + [m.end() for m in re.finditer("\n", text)]
    line = lambda p: bisect.bisect_right(starts, p)
    while pos < len(text):
        m = TOKEN_RE.match(text, pos)
        if not m:
            raise STError(f"{fname}:{line(pos)}: unexpected character {text[pos]!r}")
        kind = m.lastgroup
        val = m.group(kind)
        ln = line(pos)
        pos = m.end()
        if kind in ("ws", "com"):
            if kind == "com" and val.startswith("(*") and "(*" in val[2:]:
                raise STError(f"{fname}:{ln}: nested comment (* (* *) is not portable - not in the subset")
            continue
        where = f"{fname}:{ln}"
        if kind == "time":
            toks.append(("lit", parse_time(val, where), ln))
        elif kind == "typed":
            tname, v = val.split("#", 1)
            tname = tname.upper()
            if tname == "BOOL":
                toks.append(("lit", v.upper() in ("TRUE", "1"), ln))
            elif tname in REAL_TYPES:
                toks.append(("lit", float(v.replace("_", "")), ln))
            else:
                sign = -1 if v.startswith("-") else 1
                toks.append(("lit", sign * parse_int(v.lstrip("+-")), ln))
        elif kind in ("based", "int"):
            toks.append(("lit", parse_int(val), ln))
        elif kind == "real":
            toks.append(("lit", float(val.replace("_", "")), ln))
        elif kind == "str":
            toks.append(("str", val[1:-1], ln))
        elif kind == "loc":
            toks.append(("loc", val.upper(), ln))
        elif kind == "id":
            u = val.upper()
            if u in ("TRUE", "FALSE"):
                toks.append(("lit", u == "TRUE", ln))
            else:
                toks.append(("id", val, ln))
        else:
            toks.append(("op", val, ln))
    toks.append(("eof", None, line(len(text))))
    return toks


# ----------------------------------------------------------------------------- AST containers
class VarDecl:
    __slots__ = ("name", "section", "type", "init", "constant", "line", "location")

    def __init__(self, name, section, typ, init, constant, line, location=None):
        self.name, self.section, self.type, self.init = name, section, typ, init
        self.constant, self.line, self.location = constant, line, location


class POU:
    def __init__(self, kind, name, file, line, rettype=None):
        self.kind, self.name, self.file, self.line, self.rettype = kind, name, file, line, rettype
        self.vars = []                         # VarDecl in declaration order
        self.body = []
        self.header = ""                       # comment text before the POU (library header)

    def section(self, sec):
        return [v for v in self.vars if v.section == sec]

    def var(self, name):
        n = name.lower()
        for v in self.vars:
            if v.name.lower() == n:
                return v
        return None


# ----------------------------------------------------------------------------- parser
class Parser:
    def __init__(self, text, fname):
        self.t = lex(text, fname)
        self.p = 0
        self.f = fname
        self.text = text

    # token helpers
    def peek(self, k=0):
        return self.t[min(self.p + k, len(self.t) - 1)]

    def nxt(self):
        tok = self.t[self.p]
        self.p += 1
        return tok

    def where(self, tok=None):
        return f"{self.f}:{(tok or self.peek())[2]}"

    def err(self, msg, tok=None):
        raise STError(f"{self.where(tok)}: {msg}")

    def is_kw(self, word, k=0):
        tok = self.peek(k)
        return tok[0] == "id" and tok[1].upper() == word

    def accept_kw(self, *words):
        tok = self.peek()
        if tok[0] == "id" and tok[1].upper() in words:
            self.p += 1
            return tok[1].upper()
        return None

    def expect_kw(self, word):
        if not self.accept_kw(word):
            self.err(f"expected {word}, found {self.desc(self.peek())}")

    def is_op(self, op, k=0):
        tok = self.peek(k)
        return tok[0] == "op" and tok[1] == op

    def accept_op(self, op):
        if self.is_op(op):
            self.p += 1
            return True
        return False

    def expect_op(self, op):
        if not self.accept_op(op):
            self.err(f"expected '{op}', found {self.desc(self.peek())}")

    @staticmethod
    def desc(tok):
        return "end of file" if tok[0] == "eof" else repr(tok[1])

    def ident(self):
        tok = self.nxt()
        if tok[0] != "id":
            self.err(f"expected a name, found {self.desc(tok)}", tok)
        return tok[1]

    # file level
    def parse_file(self, lib):
        while self.peek()[0] != "eof":
            tok = self.peek()
            w = tok[1].upper() if tok[0] == "id" else None
            if w == "TYPE":
                self.nxt()
                self.parse_types(lib)
            elif w == "VAR_GLOBAL":
                self.nxt()
                const = bool(self.accept_kw("CONSTANT"))
                self.accept_kw("RETAIN", "PERSISTENT")
                for d in self.parse_decls("VAR_GLOBAL", const):
                    lib.add_global(d, self.f)
            elif w in ("FUNCTION_BLOCK", "FUNCTION", "PROGRAM"):
                lib.add_pou(self.parse_pou(), self.f)
            else:
                self.err(f"expected TYPE, VAR_GLOBAL, FUNCTION_BLOCK, FUNCTION or PROGRAM, found {self.desc(tok)}")

    def header_before(self, line):
        """Text of the comment block(s) directly before a POU (the library header)."""
        return "\n".join(self.text.split("\n")[:max(line - 1, 0)])

    def parse_types(self, lib):
        while not self.accept_kw("END_TYPE"):
            tok = self.peek()
            name = self.ident()
            self.expect_op(":")
            if self.accept_op("("):
                members, val = [], -1
                while True:
                    m = self.ident()
                    if self.accept_op(":="):
                        neg = self.accept_op("-")
                        lt = self.nxt()
                        if lt[0] != "lit" or isinstance(lt[1], (bool, float)):
                            self.err("enumeration value must be an integer", lt)
                        val = -lt[1] if neg else lt[1]
                    else:
                        val += 1
                    members.append((m, val))
                    if self.accept_op(")"):
                        break
                    self.expect_op(",")
                base = "INT"
                if self.peek()[0] == "id" and self.peek()[1].upper() in INT_TYPES:
                    base = self.nxt()[1].upper()
                self.accept_op(";")
                lib.add_enum(name, members, base, f"{self.f}:{tok[2]}")
            else:
                self.err("only enumerations are supported in TYPE (subset)")

    def parse_pou(self):
        kind = self.nxt()[1].upper()
        tok = self.peek()
        name = self.ident()
        ret = None
        if kind == "FUNCTION":
            self.expect_op(":")
            ret = self.parse_type()
        pou = POU(kind, name, self.f, tok[2], ret)
        pou.header = self.header_before(tok[2])
        end = "END_" + kind
        while True:
            sec = self.accept_kw("VAR_INPUT", "VAR_OUTPUT", "VAR_IN_OUT", "VAR", "VAR_TEMP", "VAR_EXTERNAL")
            if not sec:
                break
            if sec in ("VAR_IN_OUT", "VAR_EXTERNAL"):
                self.err(f"{sec} is not in the supported subset")
            const = bool(self.accept_kw("CONSTANT"))
            self.accept_kw("RETAIN", "PERSISTENT")
            if sec == "VAR_TEMP":
                sec = "VAR"
            pou.vars += self.parse_decls(sec, const)
        seen = set()
        for v in pou.vars:
            if v.name.lower() in seen:
                raise STError(f"{self.f}:{v.line}: variable '{v.name}' declared twice in {name}")
            seen.add(v.name.lower())
        pou.body = self.parse_stmts((end,))
        self.expect_kw(end)
        return pou

    def parse_type(self):
        if self.accept_kw("ARRAY"):
            self.expect_op("[")
            lo = self.parse_expr()
            self.expect_op("..")
            hi = self.parse_expr()
            if self.is_op(","):
                self.err("multi-dimensional arrays are not in the subset")
            self.expect_op("]")
            self.expect_kw("OF")
            el = self.ident().upper()
            if el not in ELEMENTARY:
                self.err("ARRAY elements must be an elementary type (subset)")
            return ("ARRAY", lo, hi, el)
        name = self.ident()
        if name.upper() == "STRING":
            self.err("STRING is not in the supported subset")
        return name.upper() if name.upper() in ELEMENTARY else name

    def parse_decls(self, sec, const):
        out = []
        while not self.accept_kw("END_VAR"):
            names = [(self.peek()[2], self.ident())]
            while self.accept_op(","):
                names.append((self.peek()[2], self.ident()))
            loc = None
            if self.accept_kw("AT"):
                tok = self.nxt()
                if tok[0] != "loc":
                    self.err("expected a location like %IX0.0 after AT", tok)
                loc = tok[1]
            self.expect_op(":")
            typ = self.parse_type()
            init = None
            if self.accept_op(":="):
                init = self.parse_init()
            self.expect_op(";")
            for ln, n in names:
                if const and init is None:
                    raise STError(f"{self.f}:{ln}: constant '{n}' needs an initial value")
                out.append(VarDecl(n, sec, typ, init, const, ln, loc))
        return out

    def parse_init(self):
        if self.accept_op("["):
            items = []
            while True:
                e = self.parse_expr()
                if self.accept_op("("):
                    v = self.parse_expr()
                    self.expect_op(")")
                    items.append(("rep", e, v))
                else:
                    items.append(("one", e))
                if self.accept_op("]"):
                    break
                self.expect_op(",")
            return ("list", items)
        return self.parse_expr()

    # statements
    def parse_stmts(self, stops, case_mode=False):
        out = []
        while True:
            tok = self.peek()
            if tok[0] == "eof":
                self.err(f"missing {' / '.join(stops)}")
            if tok[0] == "id" and tok[1].upper() in stops:
                return out
            if case_mode and self.is_case_label():
                return out
            if self.accept_op(";"):
                continue
            out.append(self.parse_stmt())

    def parse_stmt(self):
        tok = self.peek()
        ln = tok[2]
        if tok[0] != "id":
            self.err(f"statement expected, found {self.desc(tok)}")
        w = tok[1].upper()
        if w == "IF":
            self.nxt()
            arms = []
            cond = self.parse_expr()
            self.expect_kw("THEN")
            body = self.parse_stmts(("ELSIF", "ELSE", "END_IF"))
            arms.append((cond, body))
            els = None
            while True:
                k = self.accept_kw("ELSIF", "ELSE", "END_IF")
                if k == "ELSIF":
                    cond = self.parse_expr()
                    self.expect_kw("THEN")
                    arms.append((cond, self.parse_stmts(("ELSIF", "ELSE", "END_IF"))))
                elif k == "ELSE":
                    els = self.parse_stmts(("END_IF",))
                else:
                    break
            self.accept_op(";")
            return ("if", ln, arms, els)
        if w == "CASE":
            self.nxt()
            sel = self.parse_expr()
            self.expect_kw("OF")
            arms, els = [], None
            while True:
                if self.accept_kw("END_CASE"):
                    break
                if self.accept_kw("ELSE"):
                    els = self.parse_stmts(("END_CASE",))
                    continue
                if not self.is_case_label():
                    self.err(f"CASE label expected, found {self.desc(self.peek())}")
                labels = []
                while True:
                    a = self.parse_label_value()
                    b = None
                    if self.accept_op(".."):
                        b = self.parse_label_value()
                    labels.append((a, b))
                    if self.accept_op(":"):
                        break
                    self.expect_op(",")
                arms.append((labels, self.parse_stmts(("ELSE", "END_CASE"), case_mode=True)))
            self.accept_op(";")
            return ("case", ln, sel, arms, els)
        if w == "FOR":
            self.nxt()
            var = self.ident()
            self.expect_op(":=")
            a = self.parse_expr()
            self.expect_kw("TO")
            b = self.parse_expr()
            step = ("lit", 1)
            if self.accept_kw("BY"):
                step = self.parse_expr()
            self.expect_kw("DO")
            body = self.parse_stmts(("END_FOR",))
            self.expect_kw("END_FOR")
            self.accept_op(";")
            return ("for", ln, var, a, b, step, body)
        if w == "WHILE":
            self.nxt()
            cond = self.parse_expr()
            self.expect_kw("DO")
            body = self.parse_stmts(("END_WHILE",))
            self.expect_kw("END_WHILE")
            self.accept_op(";")
            return ("while", ln, cond, body)
        if w == "REPEAT":
            self.nxt()
            body = self.parse_stmts(("UNTIL",))
            self.expect_kw("UNTIL")
            cond = self.parse_expr()
            self.expect_kw("END_REPEAT")
            self.accept_op(";")
            return ("repeat", ln, body, cond)
        if w == "EXIT":
            self.nxt()
            self.expect_op(";")
            return ("exit", ln)
        if w == "RETURN":
            self.nxt()
            self.expect_op(";")
            return ("return", ln)
        target = self.parse_designator()
        if self.accept_op(":="):
            e = self.parse_expr()
            self.expect_op(";")
            return ("assign", ln, target, e)
        if self.is_op("("):
            if target[0] != "var" and target[0] != "field" and target[0] != "index":
                self.err("call target must be an FB instance")
            args = self.parse_args()
            self.expect_op(";")
            return ("call", ln, target, args)
        self.err(f"expected ':=' or '(' after {self.desc(tok)}")

    def is_case_label(self):
        """Lookahead: [-]const[..[-]const]{,...} ':' (not ':=')."""
        k = 0
        while True:
            for _ in range(2):
                if self.is_op("-", k) or self.is_op("+", k):
                    k += 1
                tok = self.peek(k)
                if tok[0] == "lit" and not isinstance(tok[1], (bool, float)):
                    k += 1
                elif tok[0] == "id" and tok[1].upper() not in ("END_CASE", "ELSE"):
                    k += 1
                    if self.is_op(".", k) and self.peek(k + 1)[0] == "id":
                        k += 2
                else:
                    return False
                if self.is_op("..", k):
                    k += 1
                    continue
                break
            if self.is_op(":", k):
                return True
            if self.is_op(",", k):
                k += 1
                continue
            return False

    def parse_label_value(self):
        neg = self.accept_op("-")
        self.accept_op("+")
        tok = self.peek()
        if tok[0] == "lit":
            self.nxt()
            return ("lit", -tok[1] if neg else tok[1])
        e = self.parse_designator()
        return ("neg", e) if neg else e

    def parse_designator(self):
        tok = self.peek()
        name = self.ident()
        e = ("var", name.lower(), name, tok[2])
        while True:
            if self.is_op(".") and self.peek(1)[0] == "id":
                self.nxt()
                f = self.ident()
                e = ("field", e, f.lower(), f, tok[2])
            elif self.accept_op("["):
                idx = self.parse_expr()
                self.expect_op("]")
                e = ("index", e, idx, tok[2])
            else:
                return e

    def parse_args(self):
        self.expect_op("(")
        args = []
        if self.accept_op(")"):
            return args
        while True:
            if self.peek()[0] == "id" and (self.is_op(":=", 1) or self.is_op("=>", 1)):
                n = self.ident()
                if self.accept_op(":="):
                    args.append((n.lower(), ":=", self.parse_expr()))
                else:
                    self.nxt()
                    args.append((n.lower(), "=>", self.parse_designator()))
            else:
                args.append((None, ":=", self.parse_expr()))
            if self.accept_op(")"):
                return args
            self.expect_op(",")

    # expressions (IEC precedence, lowest first)
    BIN_LEVELS = [("OR",), ("XOR",), ("AND", "&"), ("=", "<>"), ("<", ">", "<=", ">="), ("+", "-"),
                  ("*", "/", "MOD")]

    def parse_expr(self, level=0):
        if level == len(self.BIN_LEVELS):
            return self.parse_power()
        ops = self.BIN_LEVELS[level]
        left = self.parse_expr(level + 1)
        while True:
            tok = self.peek()
            op = None
            if tok[0] == "op" and tok[1] in ops:
                op = tok[1]
            elif tok[0] == "id" and tok[1].upper() in ops:
                op = tok[1].upper()
            if op is None:
                return left
            self.nxt()
            if op == "&":
                op = "AND"
            right = self.parse_expr(level + 1)
            left = ("bin", op, left, right, tok[2])

    def parse_power(self):
        left = self.parse_unary()
        while self.is_op("**"):
            tok = self.nxt()
            left = ("bin", "**", left, self.parse_unary(), tok[2])
        return left

    def parse_unary(self):
        tok = self.peek()
        if self.accept_op("-"):
            return ("un", "-", self.parse_unary(), tok[2])
        if self.accept_op("+"):
            return self.parse_unary()
        if self.accept_kw("NOT"):
            return ("un", "NOT", self.parse_unary(), tok[2])
        return self.parse_primary()

    def parse_primary(self):
        tok = self.peek()
        if tok[0] == "lit":
            self.nxt()
            return ("lit", tok[1])
        if tok[0] == "str":
            self.err("STRING literals are not in the supported subset")
        if self.accept_op("("):
            e = self.parse_expr()
            self.expect_op(")")
            return e
        if tok[0] == "id":
            if self.is_op("(", 1):
                name = self.ident()
                return ("fcall", name.upper(), self.parse_args(), tok[2])
            return self.parse_designator()
        self.err(f"expression expected, found {self.desc(tok)}")


# ----------------------------------------------------------------------------- runtime
class Instance:
    """One FB / PROGRAM instance (or the frame of a FUNCTION call)."""
    __slots__ = ("pou", "vals", "types", "consts", "name")

    def __init__(self, pou, name):
        self.pou, self.name = pou, name
        self.vals, self.types, self.consts = {}, {}, set()


def wrap_int(v, typ):
    bits, signed = INT_TYPES[typ]
    m = (1 << bits) - 1
    v &= m
    if signed and v >> (bits - 1):
        v -= 1 << bits
    return v


def tname(v):
    return "BOOL" if isinstance(v, bool) else ("REAL" if isinstance(v, float) else "integer")


class Library:
    """Parsed ST sources: enums, global constants / variables, POUs. call() runs one FB call."""

    def __init__(self):
        self.enums = {}                        # lower name -> (display name, {member lower: value}, base)
        self.pous = {}                         # lower name -> POU
        self.global_decls = []                 # (VarDecl, file)
        self.gvals, self.gtypes, self.gconsts = {}, {}, set()
        self.files = []
        self.now_ms = 0                        # simulated clock for TON / TOF / TP (SIM_NOW_MS)
        self.steps = 0
        self.global_writes = []                # (pou, var) runtime record not needed; static check in check tool
        self._load_text(STD_FB_SOURCE, "<std_fb>")
        for p in self.pous.values():
            p.std = True

    # loading
    def _load_text(self, text, fname):
        Parser(text, fname).parse_file(self)

    def load_file(self, path):
        p = Path(path)
        if not p.is_file():
            raise InputError(f"File not found: {p}")
        self.files.append(str(p))
        self._load_text(p.read_text(encoding="utf-8-sig"), p.name)

    def load_dir(self, d):
        d = Path(d)
        if not d.is_dir():
            raise InputError(f"PLC library folder not found: {d}")
        files = sorted(d.glob("*.st"), key=lambda q: (q.name.upper() != "TYPES.ST", q.name.lower()))
        if not files:
            raise InputError(f"no .st files in {d}")
        for f in files:
            self.load_file(f)
        return self

    def load_text(self, text, fname="<text>"):
        self._load_text(text, fname)
        return self

    def add_enum(self, name, members, base, where):
        if name.lower() in self.enums or name.lower() in self.pous:
            raise STError(f"{where}: type '{name}' defined twice")
        self.enums[name.lower()] = (name, {m.lower(): v for m, v in members}, base)

    def add_pou(self, pou, fname):
        n = pou.name.lower()
        if n in self.pous or n in self.enums:
            raise STError(f"{fname}:{pou.line}: POU '{pou.name}' defined twice")
        pou.std = False
        self.pous[n] = pou

    def add_global(self, d, fname):
        n = d.name.lower()
        if n in self.gvals:
            raise STError(f"{fname}:{d.line}: global '{d.name}' declared twice")
        self.global_decls.append((d, fname))
        frame = Instance(None, "<global>")
        typ = self.resolve_type(d.type, f"{fname}:{d.line}")
        self.gtypes[n] = typ
        self.gvals[n] = self.initial(typ, d, frame, f"{fname}:{d.line}")
        if d.constant:
            self.gconsts.add(n)

    # types and initial values
    def resolve_type(self, t, where):
        if isinstance(t, tuple):
            return t
        if t in ELEMENTARY:
            return t
        n = t.lower()
        if n in self.enums:
            return ("ENUM", n)
        if n in self.pous and self.pous[n].kind == "FUNCTION_BLOCK":
            return ("FB", n)
        raise STError(f"{where}: unknown type '{t}'")

    def default(self, typ):
        if typ == "BOOL":
            return False
        if typ in REAL_TYPES:
            return 0.0
        if typ in INT_TYPES:
            return 0
        if typ[0] == "ENUM":
            return list(self.enums[typ[1]][1].values())[0]      # IEC: first declared value
        raise STError(f"no default for {typ}")

    def initial(self, typ, d, frame, where):
        if isinstance(typ, tuple) and typ[0] == "FB":
            if d.init is not None:
                raise STError(f"{where}: an FB instance has no initial value")
            return self.instantiate(typ[1], d.name)
        if isinstance(typ, tuple) and typ[0] == "ARRAY":
            lo = self.const_eval(typ[1], frame, where)
            hi = self.const_eval(typ[2], frame, where)
            if not isinstance(lo, int) or not isinstance(hi, int) or isinstance(lo, bool) or hi < lo:
                raise STError(f"{where}: array bounds must be integers lo <= hi")
            arr = [self.default(typ[3])] * (hi - lo + 1)
            if d.init is not None:
                if d.init[0] != "list":
                    raise STError(f"{where}: array initial value must be [ ... ]")
                vals = []
                for it in d.init[1]:
                    if it[0] == "rep":
                        vals += [self.coerce(typ[3], self.const_eval(it[2], frame, where), where)] * \
                            self.const_eval(it[1], frame, where)
                    else:
                        vals.append(self.coerce(typ[3], self.const_eval(it[1], frame, where), where))
                if len(vals) > len(arr):
                    raise STError(f"{where}: too many initial values for the array")
                arr[:len(vals)] = vals
            return ["ARR", lo, typ[3], arr]
        if d.init is None:
            return self.default(typ)
        if isinstance(d.init, tuple) and d.init[0] == "list":
            raise STError(f"{where}: [ ... ] initial value only for arrays")
        return self.coerce(typ, self.const_eval(d.init, frame, where), where)

    def const_eval(self, e, frame, where):
        try:
            return self.eval(e, frame)
        except STError:
            raise
        except Exception as exc:                 # pragma: no cover
            raise STError(f"{where}: cannot evaluate initial value ({exc})")

    def instantiate(self, name, iname=None):
        n = name.lower()
        if n not in self.pous:
            raise InputError(f"unknown POU '{name}' ({', '.join(p.name for p in self.user_pous())})")
        pou = self.pous[n]
        if pou.kind == "FUNCTION":
            raise STError(f"{pou.name} is a FUNCTION, not a function block")
        inst = Instance(pou, iname or pou.name)
        self.init_frame(inst, pou)
        return inst

    def init_frame(self, inst, pou):
        for d in pou.vars:
            where = f"{pou.file}:{d.line}"
            typ = self.resolve_type(d.type, where)
            n = d.name.lower()
            inst.types[n] = typ
            inst.vals[n] = self.initial(typ, d, inst, where)
            if d.constant:
                inst.consts.add(n)

    def user_pous(self):
        return [p for p in self.pous.values() if not getattr(p, "std", False)]

    # coercion (strict)
    def coerce(self, typ, v, where):
        if isinstance(typ, tuple):
            if typ[0] == "ENUM":
                if isinstance(v, bool) or not isinstance(v, int):
                    raise STError(f"{where}: {tname(v)} value cannot be assigned to enumeration {typ[1]}")
                return v
            raise STError(f"{where}: cannot assign to a {typ[0]} variable as a whole")
        if typ == "BOOL":
            if not isinstance(v, bool):
                raise STError(f"{where}: type mismatch, BOOL expected, got {tname(v)} {v!r}")
            return v
        if typ in INT_TYPES:
            if isinstance(v, bool):
                raise STError(f"{where}: type mismatch, {typ} expected, got BOOL (use BOOL_TO_{typ})")
            if isinstance(v, float):
                raise STError(f"{where}: implicit REAL -> {typ} not allowed (use REAL_TO_{typ} or TRUNC)")
            return wrap_int(v, typ)
        if typ in REAL_TYPES:
            if isinstance(v, bool):
                raise STError(f"{where}: type mismatch, {typ} expected, got BOOL")
            return float(v)
        raise STError(f"{where}: unknown type {typ}")

    # execution
    def call(self, inst):
        """Run one call of an FB / PROGRAM instance (inputs already set)."""
        try:
            self.exec_block(inst.pou.body, inst)
        except _Return:
            pass
        except _Exit:
            raise STError(f"{inst.pou.file}: EXIT outside a loop in {inst.pou.name}")

    def exec_block(self, stmts, fr):
        for s in stmts:
            self.exec_stmt(s, fr)

    def where(self, fr, ln):
        return f"{fr.pou.file if fr.pou else '<global>'}:{ln}"

    def exec_stmt(self, s, fr):
        k = s[0]
        if k == "assign":
            self.assign(s[2], self.eval(s[3], fr), fr, s[1])
        elif k == "if":
            for cond, body in s[2]:
                if self.truth(self.eval(cond, fr), fr, s[1]):
                    self.exec_block(body, fr)
                    return
            if s[3] is not None:
                self.exec_block(s[3], fr)
        elif k == "case":
            v = self.eval(s[2], fr)
            if isinstance(v, (bool, float)):
                raise STError(f"{self.where(fr, s[1])}: CASE selector must be an integer or enumeration")
            for labels, body in s[3]:
                for a, b in labels:
                    lo = self.eval(a, fr)
                    if (v == lo) if b is None else (lo <= v <= self.eval(b, fr)):
                        self.exec_block(body, fr)
                        return
            if s[4] is not None:
                self.exec_block(s[4], fr)
        elif k == "call":
            self.call_stmt(s, fr)
        elif k == "for":
            _, ln, var, a, b, step, body = s
            target = ("var", var.lower(), var, ln)
            i = self.eval(a, fr)
            end = self.eval(b, fr)
            st = self.eval(step, fr)
            if st == 0:
                raise STError(f"{self.where(fr, ln)}: FOR step 0")
            self.assign(target, i, fr, ln)
            try:
                while (st > 0 and i <= end) or (st < 0 and i >= end):
                    self.tick_watchdog(fr, ln)
                    self.exec_block(body, fr)
                    i = self.eval(target, fr) + st
                    self.assign(target, i, fr, ln)
            except _Exit:
                pass
        elif k == "while":
            try:
                while self.truth(self.eval(s[2], fr), fr, s[1]):
                    self.tick_watchdog(fr, s[1])
                    self.exec_block(s[3], fr)
            except _Exit:
                pass
        elif k == "repeat":
            try:
                while True:
                    self.tick_watchdog(fr, s[1])
                    self.exec_block(s[2], fr)
                    if self.truth(self.eval(s[3], fr), fr, s[1]):
                        break
            except _Exit:
                pass
        elif k == "exit":
            raise _Exit()
        elif k == "return":
            raise _Return()

    def tick_watchdog(self, fr, ln):
        self.steps += 1
        if self.steps > WATCHDOG:
            self.steps = 0
            raise STError(f"{self.where(fr, ln)}: watchdog - more than {WATCHDOG} loop passes (endless loop?)")

    def truth(self, v, fr, ln):
        if not isinstance(v, bool):
            raise STError(f"{self.where(fr, ln)}: condition must be BOOL, got {tname(v)}")
        return v

    def call_stmt(self, s, fr):
        _, ln, target, args = s
        if target[0] == "var" and target[1] in self.pous and target[1] not in fr.vals and target[1] not in self.gvals:
            pou = self.pous[target[1]]
            if pou.kind == "FUNCTION":
                self.call_function(pou, args, fr, ln)
                return
            raise STError(f"{self.where(fr, ln)}: '{pou.name}' is a type - call an instance of it")
        inst = self.eval(target, fr)
        if not isinstance(inst, Instance):
            raise STError(f"{self.where(fr, ln)}: '{target[2] if target[0] == 'var' else target[3]}' is not an FB "
                          f"instance")
        outs = []
        for n, kind, e in args:
            if n is None:
                raise STError(f"{self.where(fr, ln)}: FB calls need named parameters (name := value)")
            d = inst.pou.var(n)
            if kind == ":=":
                if d is None or d.section != "VAR_INPUT":
                    raise STError(f"{self.where(fr, ln)}: '{n}' is not an input of {inst.pou.name}")
                inst.vals[n] = self.coerce(inst.types[n], self.eval(e, fr), self.where(fr, ln))
            else:
                if d is None or d.section != "VAR_OUTPUT":
                    raise STError(f"{self.where(fr, ln)}: '{n}' is not an output of {inst.pou.name}")
                outs.append((n, e))
        self.call(inst)
        for n, e in outs:
            self.assign(e, inst.vals[n], fr, ln)

    def call_function(self, pou, args, fr, ln):
        f = Instance(pou, pou.name)
        self.init_frame(f, pou)
        rn = pou.name.lower()
        rt = self.resolve_type(pou.rettype, self.where(fr, ln))
        f.types[rn] = rt
        f.vals[rn] = self.default(rt)
        ins = pou.section("VAR_INPUT")
        pos = 0
        for n, kind, e in args:
            if kind != ":=":
                raise STError(f"{self.where(fr, ln)}: '=>' is not allowed in a FUNCTION call")
            if n is None:
                if pos >= len(ins):
                    raise STError(f"{self.where(fr, ln)}: too many arguments for {pou.name}")
                n = ins[pos].name.lower()
                pos += 1
            d = pou.var(n)
            if d is None or d.section != "VAR_INPUT":
                raise STError(f"{self.where(fr, ln)}: '{n}' is not an input of {pou.name}")
            f.vals[n] = self.coerce(f.types[n], self.eval(e, fr), self.where(fr, ln))
        try:
            self.exec_block(pou.body, f)
        except _Return:
            pass
        return f.vals[rn]

    def lookup(self, name, fr, ln, disp=None):
        if name in fr.vals:
            return fr.vals[name], fr
        if name in self.gvals:
            return self.gvals[name], None
        raise STError(f"{self.where(fr, ln)}: unknown variable '{disp or name}'")

    def assign(self, target, v, fr, ln):
        where = self.where(fr, ln)
        k = target[0]
        if k == "var":
            n = target[1]
            if n in fr.vals:
                if n in fr.consts:
                    raise STError(f"{where}: '{target[2]}' is a constant")
                if isinstance(fr.types[n], tuple) and fr.types[n][0] in ("FB", "ARRAY"):
                    raise STError(f"{where}: cannot assign to '{target[2]}' as a whole")
                fr.vals[n] = self.coerce(fr.types[n], v, where)
                return
            if n in self.gvals:
                if n in self.gconsts:
                    raise STError(f"{where}: '{target[2]}' is a constant")
                self.gvals[n] = self.coerce(self.gtypes[n], v, where)
                return
            raise STError(f"{where}: unknown variable '{target[2]}'")
        if k == "field":
            inst = self.eval(target[1], fr)
            if not isinstance(inst, Instance):
                raise STError(f"{where}: '.{target[3]}' on something that is not an FB instance")
            d = inst.pou.var(target[2])
            if d is None or d.section != "VAR_INPUT":
                raise STError(f"{where}: only inputs of '{inst.name}' may be written from outside ('{target[3]}')")
            inst.vals[target[2]] = self.coerce(inst.types[target[2]], v, where)
            return
        if k == "index":
            arr = self.eval(target[1], fr)
            if not (isinstance(arr, list) and arr and arr[0] == "ARR"):
                raise STError(f"{where}: indexing something that is not an array")
            i = self.index(arr, self.eval(target[2], fr), where)
            arr[3][i] = self.coerce(arr[2], v, where)
            return
        raise STError(f"{where}: cannot assign to this expression")

    def index(self, arr, i, where):
        if isinstance(i, (bool, float)):
            raise STError(f"{where}: array index must be an integer")
        j = i - arr[1]
        if j < 0 or j >= len(arr[3]):
            raise STError(f"{where}: array index {i} out of range [{arr[1]}..{arr[1] + len(arr[3]) - 1}]")
        return j

    def eval(self, e, fr):
        k = e[0]
        if k == "lit":
            return e[1]
        if k == "var":
            return self.lookup(e[1], fr, e[3], e[2])[0]
        if k == "bin":
            return self.binop(e[1], self.eval(e[2], fr), self.eval(e[3], fr), fr, e[4])
        if k == "un":
            v = self.eval(e[2], fr)
            if e[1] == "NOT":
                if isinstance(v, bool):
                    return not v
                if isinstance(v, int):
                    return ~v
                raise STError(f"{self.where(fr, e[3])}: NOT of a REAL")
            if isinstance(v, bool):
                raise STError(f"{self.where(fr, e[3])}: unary minus of a BOOL")
            return -v
        if k == "field":
            base = e[1]
            if base[0] == "var" and base[1] not in fr.vals and base[1] not in self.gvals and base[1] in self.enums:
                members = self.enums[base[1]][1]
                if e[2] not in members:
                    raise STError(f"{self.where(fr, e[4])}: '{e[3]}' is not a value of {self.enums[base[1]][0]}")
                return members[e[2]]
            inst = self.eval(base, fr)
            if not isinstance(inst, Instance):
                raise STError(f"{self.where(fr, e[4])}: '.{e[3]}' on something that is not an FB instance")
            d = inst.pou.var(e[2])
            if d is None:
                raise STError(f"{self.where(fr, e[4])}: {inst.pou.name} has no '{e[3]}'")
            if d.section not in ("VAR_INPUT", "VAR_OUTPUT"):
                raise STError(f"{self.where(fr, e[4])}: '{e[3]}' is internal to {inst.pou.name} (not readable outside)")
            return inst.vals[e[2]]
        if k == "index":
            arr = self.eval(e[1], fr)
            if not (isinstance(arr, list) and arr and arr[0] == "ARR"):
                raise STError(f"{self.where(fr, e[3])}: indexing something that is not an array")
            return arr[3][self.index(arr, self.eval(e[2], fr), self.where(fr, e[3]))]
        if k == "fcall":
            return self.fcall(e, fr)
        if k == "neg":
            return -self.eval(e[1], fr)
        raise STError(f"internal: unknown expression {k}")  # pragma: no cover

    def binop(self, op, a, b, fr, ln):
        where = self.where(fr, ln)
        if op in ("AND", "OR", "XOR"):
            if isinstance(a, bool) and isinstance(b, bool):
                return (a and b) if op == "AND" else ((a or b) if op == "OR" else (a != b))
            if isinstance(a, int) and isinstance(b, int) and not isinstance(a, bool) and not isinstance(b, bool):
                return (a & b) if op == "AND" else ((a | b) if op == "OR" else (a ^ b))
            raise STError(f"{where}: {op} needs two BOOL or two integer operands, got {tname(a)} and {tname(b)}")
        if op in ("=", "<>", "<", ">", "<=", ">="):
            if isinstance(a, bool) != isinstance(b, bool):
                raise STError(f"{where}: comparison of BOOL with a number")
            return {"=": a == b, "<>": a != b, "<": a < b, ">": a > b, "<=": a <= b, ">=": a >= b}[op]
        if isinstance(a, bool) or isinstance(b, bool):
            raise STError(f"{where}: arithmetic '{op}' with a BOOL operand")
        if op == "+":
            return a + b
        if op == "-":
            return a - b
        if op == "*":
            return a * b
        if op == "/":
            if b == 0:
                raise STError(f"{where}: division by zero")
            if isinstance(a, int) and isinstance(b, int):
                q = abs(a) // abs(b)
                return q if (a >= 0) == (b >= 0) else -q
            return a / b
        if op == "MOD":
            if not (isinstance(a, int) and isinstance(b, int)):
                raise STError(f"{where}: MOD needs integers")
            if b == 0:
                raise STError(f"{where}: MOD by zero")
            q = abs(a) // abs(b)
            q = q if (a >= 0) == (b >= 0) else -q
            return a - b * q
        if op == "**":
            return float(a) ** float(b)
        raise STError(f"{where}: unknown operator {op}")  # pragma: no cover

    def fcall(self, e, fr):
        _, name, args, ln = e
        where = self.where(fr, ln)
        n = name.lower()
        if n in self.pous:
            pou = self.pous[n]
            if pou.kind != "FUNCTION":
                raise STError(f"{where}: '{pou.name}' is a function block - call an instance as a statement")
            return self.call_function(pou, args, fr, ln)
        vals = []
        named = {}
        for an, kind, ae in args:
            if kind != ":=":
                raise STError(f"{where}: '=>' in a function call")
            if an is None:
                vals.append(self.eval(ae, fr))
            else:
                named[an.upper()] = self.eval(ae, fr)
        if name == "SIM_NOW_MS":
            return self.now_ms
        if name in ("MIN", "MAX"):
            if len(vals) < 2:
                raise STError(f"{where}: {name} needs at least 2 arguments")
            self.check_num(vals, name, where)
            r = min(vals) if name == "MIN" else max(vals)
            return float(r) if any(isinstance(v, float) for v in vals) else r
        if name == "ABS":
            self.argc(vals, 1, name, where)
            self.check_num(vals, name, where)
            return abs(vals[0])
        if name == "SQRT":
            self.argc(vals, 1, name, where)
            self.check_num(vals, name, where)
            if vals[0] < 0:
                raise STError(f"{where}: SQRT of a negative number")
            return math.sqrt(vals[0])
        if name == "LIMIT":
            if named:
                vals = [named.get("MN"), named.get("IN"), named.get("MX")]
            self.argc(vals, 3, name, where)
            self.check_num(vals, name, where)
            mn, x, mx = vals
            r = min(max(x, mn), mx)
            return float(r) if any(isinstance(v, float) for v in vals) else r
        if name == "SEL":
            self.argc(vals, 3, name, where)
            if not isinstance(vals[0], bool):
                raise STError(f"{where}: SEL needs a BOOL selector")
            return vals[2] if vals[0] else vals[1]
        if name == "MUX":
            if len(vals) < 2 or isinstance(vals[0], (bool, float)):
                raise STError(f"{where}: MUX(K, IN0, IN1, ...) needs an integer K")
            if not 0 <= vals[0] < len(vals) - 1:
                raise STError(f"{where}: MUX index {vals[0]} out of range")
            return vals[1 + vals[0]]
        if name == "TRUNC":
            self.argc(vals, 1, name, where)
            self.check_num(vals, name, where)
            return int(vals[0])
        m = re.fullmatch(r"(?:([A-Z]+)_)?TO_([A-Z]+)", name)
        if m and (m.group(2) in ELEMENTARY):
            self.argc(vals, 1, name, where)
            return self.convert(vals[0], m.group(1), m.group(2), where)
        raise STError(f"{where}: unknown function '{name}'")

    @staticmethod
    def argc(vals, n, name, where):
        if len(vals) != n or any(v is None for v in vals):
            raise STError(f"{where}: {name} needs {n} argument(s)")

    @staticmethod
    def check_num(vals, name, where):
        if any(isinstance(v, bool) for v in vals):
            raise STError(f"{where}: {name} with a BOOL argument")

    def convert(self, v, src, dst, where):
        if src is not None and src not in ELEMENTARY:
            raise STError(f"{where}: unknown conversion {src}_TO_{dst}")
        if src == "BOOL" and not isinstance(v, bool):
            raise STError(f"{where}: BOOL_TO_{dst} of a {tname(v)}")
        if src in REAL_TYPES and isinstance(v, bool):
            raise STError(f"{where}: {src}_TO_{dst} of a BOOL")
        if dst == "BOOL":
            return v if isinstance(v, bool) else v != 0
        if dst in REAL_TYPES:
            return float(int(v)) if isinstance(v, bool) else float(v)
        if isinstance(v, bool):
            return wrap_int(int(v), dst)
        if isinstance(v, float):                 # REAL -> integer: round to nearest, .5 away from zero
            v = int(math.floor(abs(v) + 0.5)) * (1 if v >= 0 else -1)
        return wrap_int(v, dst)


# ----------------------------------------------------------------------------- adapter for the shared harness
class STAdapter:
    """One instance of an ST function block with the adapter methods of fb_library.FB (set / call / outputs)."""

    def __init__(self, lib, name, cfg=None):
        self.lib = lib
        self.inst = lib.instantiate(name)
        self.pou = self.inst.pou
        self.out_names = [d.name for d in self.pou.section("VAR_OUTPUT")]
        for k, v in (cfg or {}).items():
            self.set(k, v)

    def set(self, name, value):
        d = self.pou.var(name)
        if d is None or d.section != "VAR_INPUT":
            raise InputError(f"{self.pou.name}: '{name}' is not an input of the FB")
        n = d.name.lower()
        typ = self.inst.types[n]
        if typ == "BOOL":
            value = bool(value)
        elif typ in INT_TYPES or (isinstance(typ, tuple) and typ[0] == "ENUM"):
            if isinstance(value, float) and value != int(value):
                raise InputError(f"'{name}' needs a whole number, got {value}")
            value = int(value)
        elif typ in REAL_TYPES:
            value = float(value)
        self.inst.vals[n] = self.lib.coerce(typ, value, f"{self.pou.name}.{name}")

    def call(self):
        self.lib.call(self.inst)
        self.lib.now_ms += fbl.DT

    def get(self, name):
        return self.inst.vals[name.lower()]

    def outputs(self):
        return {n: self.inst.vals[n.lower()] for n in self.out_names}


def make_st_factory(lib):
    return lambda name, cfg=None: STAdapter(lib, name, cfg)


def st_allowed(lib):
    """F_CmdAllowed of the ST library as a Python function (for the command matrix)."""
    pou = lib.pous.get("f_cmdallowed")
    if pou is None:
        raise InputError("plc_lib: FUNCTION F_CmdAllowed is missing")
    fr = Instance(None, "<harness>")

    def f(cmd, st, mode):
        args = [("icmd", ":=", ("lit", cmd)), ("istate", ":=", ("lit", st)), ("imode", ":=", ("lit", mode))]
        return lib.call_function(pou, args, fr, 0)
    return f


def load_library(lib_dir=None, extra=()):
    lib = Library().load_dir(lib_dir or PLC_LIB)
    for f in extra:
        lib.load_file(f)
    return lib


# ----------------------------------------------------------------------------- generic runner (--run)
def parse_run_events(text):
    """'2:xOn=1;8:xOn=0,xEnable=1' -> [[2, 'xOn=1'], [8, 'xOn=0', 'xEnable=1']]."""
    out = []
    for part in [p.strip() for p in str(text or "").split(";") if p.strip()]:
        if ":" not in part:
            raise InputError(f"--events: '{part}' must be TICK:name=value[,name=value]")
        k, sets = part.split(":", 1)
        try:
            k = int(k)
        except ValueError:
            raise InputError(f"--events: tick '{k}' is not a whole number")
        items = [s.strip() for s in sets.split(",") if s.strip()]
        for s in items:
            if "=" not in s:
                raise InputError(f"--events: '{s}' must be name=value")
        out.append([k] + items)
    return out


def parse_sets(text):
    cfg = {}
    for s in [x.strip() for x in str(text or "").split(",") if x.strip()]:
        if "=" not in s:
            raise InputError(f"--set: '{s}' must be name=value")
        n, v = s.split("=", 1)
        cfg[n.strip()] = fbl.conv(v.strip())
    return cfg


def run_trace(lib, name, ticks, events, cfg):
    ad = STAdapter(lib, name, cfg)
    rows = []
    for k in range(ticks):
        for tk, *sets in events:
            if tk == k:
                for s in sets:
                    n, v = s.split("=", 1)
                    ad.set(n.strip(), fbl.conv(v.strip()))
        ad.call()
        rows.append((k, ad.outputs()))
    return rows


# ----------------------------------------------------------------------------- self-test helpers
def lib_text_run(src, fb, ticks=1, sets=None):
    """Compile a small test POU on top of the standard FBs and run it; returns the adapter."""
    lib = Library().load_text(src, "<test>")
    ad = STAdapter(lib, fb, sets or {})
    for _ in range(ticks):
        ad.call()
    return ad


def expect_error(src, fb="T", ticks=1):
    try:
        lib_text_run(src, fb, ticks)
    except STError as exc:
        return str(exc)
    return ""


def std_trace_rows(F):
    """item-9 fb_trace through the ST standard FBs (time = k*dt)."""
    src = """FUNCTION_BLOCK T
VAR_INPUT A : BOOL; B : BOOL; RST : BOOL; LD : BOOL; PT : TIME; PV : INT; END_VAR
VAR_OUTPUT TON_Q, TOF_Q, TP_Q, RTRIG, FTRIG, CTU_Q, CTD_Q, SR_Q, RS_Q : BOOL;
  TON_ET, TOF_ET, TP_ET : TIME; CTU_CV, CTD_CV : INT; END_VAR
VAR t1 : TON; t2 : TOF; t3 : TP; r : R_TRIG; f : F_TRIG; cu : CTU; cd : CTD; s1 : SR; s2 : RS; END_VAR
t1(IN := A, PT := PT, Q => TON_Q, ET => TON_ET);
t2(IN := A, PT := PT, Q => TOF_Q, ET => TOF_ET);
t3(IN := A, PT := PT);
TP_Q := t3.Q; TP_ET := t3.ET;
r(CLK := A); RTRIG := r.Q;
f(CLK := A); FTRIG := f.Q;
cu(CU := A, R := RST, PV := PV, Q => CTU_Q, CV => CTU_CV);
cd(CD := A, LD := LD, PV := PV, Q => CTD_Q, CV => CTD_CV);
s1(S1 := A, R := B, Q1 => SR_Q);
s2(S := A, R1 := B, Q1 => RS_Q);
END_FUNCTION_BLOCK
"""
    lib = Library().load_text(src, "<std_trace>")
    ad = STAdapter(lib, "T", {"PT": F["PT_ms"], "PV": F["PV"]})
    sig = lambda n, k: any(a <= k <= b for a, b in F["signals"].get(n, []))
    rows = []
    for k in range(F["N"]):
        lib.now_ms = k * F["dt_ms"]
        for n in ("A", "B", "RST", "LD"):
            ad.set(n, sig(n, k))
        lib.call(ad.inst)
        o = ad.outputs()
        rows.append({"k": k, "A": int(sig("A", k)), "B": int(sig("B", k)), "RST": int(sig("RST", k)),
                     "LD": int(sig("LD", k)), "TON_Q": int(o["TON_Q"]), "TON_ET": o["TON_ET"],
                     "TOF_Q": int(o["TOF_Q"]), "TOF_ET": o["TOF_ET"], "TP_Q": int(o["TP_Q"]), "TP_ET": o["TP_ET"],
                     "RTRIG": int(o["RTRIG"]), "FTRIG": int(o["FTRIG"]), "CTU_CV": o["CTU_CV"],
                     "CTU_Q": int(o["CTU_Q"]), "CTD_CV": o["CTD_CV"], "CTD_Q": int(o["CTD_Q"]),
                     "SR": int(o["SR_Q"]), "RS": int(o["RS_Q"])})
    return rows


def selftest(lib_dir):
    t = SelfTest("st_sim")
    D = fbl.load10a()
    D9 = device_fb.load9()
    lib = load_library(lib_dir)
    mk = make_st_factory(lib)
    ref = REF_10A.splitlines()
    tests, logs, al, mx, lines = fbl.run_10a(mk, st_allowed(lib), D)
    t.equal("plc_lib/*.st: complete item-10A output = reference (203 lines)", fbl.compare_lines(lines, ref), "")
    for tt, L in zip(tests, logs):
        head = f"TEST {tt['fb']} | {tt['name']} | {len(L)} lines"
        want = []
        if head in ref:
            j = ref.index(head) + 1
            while j < len(ref) and ref[j].startswith("    "):
                want.append(ref[j][4:])
                j += 1
        t.equal(f"{tt['fb']}.st {tt['name'].split()[0]}: {len(L)} log lines = reference", L, want)
    ka = ref.index("ALARM MANAGER")
    t.equal("FB_AlarmMgr.st: 10 alarm-manager lines = reference", al, [x[4:] for x in ref[ka + 1:ka + 11]])
    t.equal("F_CmdAllowed.st: command matrix (17 states) = reference", [f"{s} {c}" for s, c in mx],
            [x[4:] for x in ref[ka + 12:ka + 29]])
    py_allowed, stf = fbl.allowed, st_allowed(lib)
    bad = [(c, s, m) for c in range(0, 11) for s in range(0, 19) for m in range(0, 5) if py_allowed(c, s, m) != stf(c, s, m)]
    t.equal("F_CmdAllowed.st = allowed() for every command 0..10 x state 0..18 x mode 0..4 (935 cases)", bad, [])
    # item 9 through FB_AnalogIn.st, FB_LimitAlarm.st, FB_MotorDol.st
    t.equal("item 9: FB_AnalogIn.st / FB_LimitAlarm.st / FB_MotorDol.st lines = reference (89 lines)",
            fbl.compare_lines(fbl.item9_lines(mk, D9), REF_9_DEVICE.splitlines()), "")
    t.equal("FB_AnalogIn.st: 11 rows = device_fb REF_AI", fbl.analog_rows(mk, D9["analog"]),
            [tuple(x) for x in device_fb.REF_AI])
    rows, ev = fbl.limit_rows(mk, D9["limits"])
    t.equal("FB_LimitAlarm.st: H / L per sample = device_fb REF_LIM", [(h, l) for _, _, h, l in rows], device_fb.REF_LIM)
    t.equal("FB_LimitAlarm.st: events = device_fb REF_LIMEV", ev, device_fb.REF_LIMEV)
    for S in D9["motor"]["scenarios"]:
        key = S["name"].split()[0]
        r = fbl.motor_scenario(mk, D9["motor"], S["events"])
        w = device_fb.REF_MOTOR[key]
        t.equal(f"FB_MotorDol.st + plant, scenario {key}: final, alarm, Run, {len(w[3])} log lines = reference",
                (r["final"], r["alarm"], r["run"], r["log"]), (w[0], w[1], w[2], w[3]))
    # every library FB: ST = Python class on random inputs
    for name in fbl.FBS:
        if name == "FB_AlarmMgr":
            continue
        t.equal(f"{name}.st = fb_library class on 300 random ticks", fbl.fuzz_compare(mk, fbl.make_py, name, 300, 11), "")
    # alarm manager random on/off
    t.equal("FB_AlarmMgr.st = class AlarmMgr on 200 random on/off events", fuzz_alarm(mk), "")
    # wrappers through ST
    E1 = next(x for x in D["fb_tests"] if x["fb"] == "FB_Safe2Ch")
    base = fbl.run_test(mk, E1)
    t.equal("FB_Estop.st = FB_Safe2Ch.st (test E1, xOk -> xSafe)",
            fbl.run_test(mk, fbl.rename_test(E1, "FB_Estop", {"xCh1": "xOk", "xCh2": "xOk2"})),
            [x.replace("xOk=", "xSafe=") for x in base])
    t.equal("FB_LightCurtain.st = FB_Safe2Ch.st (test E1)",
            fbl.run_test(mk, fbl.rename_test(E1, "FB_LightCurtain", {"xCh1": "xOssd1", "xCh2": "xOssd2"})),
            [fbl.lc_line(x) for x in base])
    # standard FBs in ST = item-9 iec_std_fb trace (40 scans)
    import iec_std_fb
    F = device_fb.load_json(device_fb.ITEM9_EXAMPLES)["fb_trace"]
    want, _ = iec_std_fb.trace(F)
    got = std_trace_rows(F)
    t.equal("std FBs in ST (TON TOF TP R_TRIG F_TRIG CTU CTD SR RS): 40-scan trace = iec_std_fb.py", got, want)
    # interpreter unit checks
    unit_checks(t)
    return t.finish()


def fuzz_alarm(mk, n=200, seed=5):
    import random
    a, b = mk("FB_AlarmMgr", {"iModule": 7}), fbl.make_py("FB_AlarmMgr", {"iModule": 7})
    R = random.Random(seed)
    for k in range(n):
        ev = R.choice([0, 1, 1, 2])
        vals = {"iEvent": ev, "iInst": R.randint(0, 6), "iCode": R.randint(1, 4), "iClass": R.randint(1, 3)}
        for x in (a, b):
            for kk, v in vals.items():
                x.set(kk, v)
            x.call()
        if a.outputs() != b.outputs():
            return f"event {k}: {a.outputs()} != {b.outputs()}"
    return ""


UNIT_SRC = """
TYPE E_T : (A := 1, B, C := 10) INT; END_TYPE
VAR_GLOBAL CONSTANT GC_N : INT := 5; END_VAR
FUNCTION F_Sq : DINT
VAR_INPUT x : DINT; END_VAR
F_Sq := x * x;
END_FUNCTION
FUNCTION_BLOCK T
VAR_INPUT iIn : INT := -7; END_VAR
VAR_OUTPUT iDiv, iMod, iCase1, iCase2, iCase3, iSum, iWhile, iRep, iWrap, iEnum : INT; wBits : WORD;
  rR : REAL; xX : BOOL; diSq : DINT; iConv : INT; iArr : INT; END_VAR
VAR k : INT; a : ARRAY[1..GC_N] OF INT := [10, 20, 3(7)]; r : R_TRIG; END_VAR
VAR CONSTANT C_MAX : INT := 32767; END_VAR
iDiv := iIn / 2;                (* -3 : truncation toward zero *)
iMod := iIn MOD 3;              (* -1 : sign of the dividend *)
CASE 7 OF 1, 2: iCase1 := 1; 5..8: iCase1 := 2; ELSE iCase1 := 3; END_CASE
CASE 0 OF 1: iCase2 := 1; ELSE iCase2 := 9; END_CASE
CASE E_T.B OF E_T.A: iCase3 := 1; E_T.B: iCase3 := 2; END_CASE
iSum := 0; FOR k := 10 TO 1 BY -3 DO iSum := iSum + k; END_FOR     // 10 + 7 + 4 + 1 = 22
iWhile := 0; WHILE TRUE DO iWhile := iWhile + 1; IF iWhile >= 4 THEN EXIT; END_IF END_WHILE
iRep := 0; REPEAT iRep := iRep + 2; UNTIL iRep > 5 END_REPEAT
iWrap := C_MAX; iWrap := iWrap + 1;        (* INT wraps to -32768 *)
wBits := 16#00F0 OR 2#1; wBits := wBits XOR 16#0100;
rR := 7 / 2.0 + 2 ** 3;
xX := 3 < 4 AND NOT (2 = 3) OR FALSE;
diSq := F_Sq(x := 12) + F_Sq(3);
iConv := REAL_TO_INT(2.5) + BOOL_TO_INT(TRUE) + TRUNC(-1.7);
iEnum := E_T.C;
a[3] := a[1] + a[5];
iArr := a[3];
r(CLK := TRUE);
IF r.Q THEN iArr := iArr + 1000; END_IF
END_FUNCTION_BLOCK
"""


def unit_checks(t):
    ad = lib_text_run(UNIT_SRC, "T")
    o = ad.outputs()
    t.equal("ST: integer '/' truncates (-7/2 = -3), MOD sign of dividend (-7 MOD 3 = -1)", (o["iDiv"], o["iMod"]), (-3, -1))
    t.equal("ST: CASE list / range / ELSE / enum label", (o["iCase1"], o["iCase2"], o["iCase3"]), (2, 9, 2))
    t.equal("ST: FOR BY -3 (22), WHILE + EXIT (4), REPEAT UNTIL (6)", (o["iSum"], o["iWhile"], o["iRep"]), (22, 4, 6))
    t.equal("ST: INT 32767 + 1 wraps to -32768; WORD OR / XOR = 16#01F1", (o["iWrap"], o["wBits"]), (-32768, 0x1F1))
    t.equal("ST: REAL 7/2.0 + 2**3 = 11.5, precedence of AND / NOT / OR", (o["rR"], o["xX"]), (11.5, True))
    t.equal("ST: user FUNCTION named + positional (144 + 9)", o["diSq"], 153)
    t.equal("ST: REAL_TO_INT(2.5) = 3 + BOOL_TO_INT 1 + TRUNC(-1.7) = -1 -> 3", o["iConv"], 3)
    t.equal("ST: enum value, ARRAY with [10, 20, 3(7)] init, R_TRIG first call", (o["iEnum"], o["iArr"]), (10, 1017))
    ad.call()
    t.equal("ST: second call - R_TRIG gives no second pulse, a[3] = 10 + 7", ad.outputs()["iArr"], 17)
    t.true("ST error: BOOL := INT is a type error with file:line",
           "<test>:3: type mismatch" in expect_error("FUNCTION_BLOCK T\nVAR x : BOOL; END_VAR\nx := 1;\n"
                                                    "END_FUNCTION_BLOCK"))
    t.true("ST error: implicit REAL -> INT",
           "implicit REAL -> INT" in expect_error("FUNCTION_BLOCK T\nVAR i : INT; END_VAR\ni := 1.5;\nEND_FUNCTION_BLOCK"))
    t.true("ST error: division by zero at run time",
           "division by zero" in expect_error("FUNCTION_BLOCK T\nVAR i : INT; j : INT; END_VAR\ni := 1 / j;\n"
                                              "END_FUNCTION_BLOCK"))
    t.true("ST error: array index out of range",
           "out of range" in expect_error("FUNCTION_BLOCK T\nVAR a : ARRAY[1..3] OF INT; END_VAR\na[4] := 1;\n"
                                          "END_FUNCTION_BLOCK"))
    t.true("ST error: watchdog stops an endless WHILE",
           "watchdog" in expect_error("FUNCTION_BLOCK T\nVAR i : INT; END_VAR\nWHILE TRUE DO i := 0; END_WHILE\n"
                                      "END_FUNCTION_BLOCK"))
    t.true("ST error: syntax error names the line",
           "<test>:3:" in expect_error("FUNCTION_BLOCK T\nVAR i : INT; END_VAR\ni := (1 + ;\nEND_FUNCTION_BLOCK"))
    t.true("ST error: internal VAR of an instance not readable outside",
           "internal" in expect_error("FUNCTION_BLOCK T\nVAR r : R_TRIG; x : BOOL; END_VAR\nx := r.M;\n"
                                      "END_FUNCTION_BLOCK"))
    t.true("ST error: writing a constant",
           "constant" in expect_error("FUNCTION_BLOCK T\nVAR CONSTANT C : INT := 1; END_VAR\nC := 2;\n"
                                      "END_FUNCTION_BLOCK"))
    t.true("ST error: unknown input in an FB call",
           "not an input" in expect_error("FUNCTION_BLOCK T\nVAR r : R_TRIG; END_VAR\nr(CLOCK := TRUE);\n"
                                          "END_FUNCTION_BLOCK"))
    t.equal("ST lexer: T#1s500ms = 1500, TIME#2m = 120000, 16#FF = 255, 1_000 = 1000",
            [x[1] for x in lex("T#1s500ms TIME#2m 16#FF 1_000", "x")[:4]], [1500, 120000, 255, 1000])


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--lib", default=str(PLC_LIB), help="folder with the .st library (default: %(default)s)")
    ap.add_argument("--file", action="append", default=[], help="extra .st file(s) loaded after the library")
    ap.add_argument("--examples", default=str(fbl.ITEM10A_EXAMPLES), help="item-10A JSON (default: %(default)s)")
    ap.add_argument("--test", nargs="?", const="all", help="run the unit tests on the ST source: all (default), "
                                                            "an FB name, a test id, item10a or item9")
    ap.add_argument("--list", action="store_true", help="POUs of the library")
    ap.add_argument("--run", help="run one FB of the library tick by tick")
    ap.add_argument("--ticks", type=int, default=20, help="--run: number of calls (100 ms each)")
    ap.add_argument("--events", help="--run: '2:xOn=1;8:xOn=0,xEnable=1'")
    ap.add_argument("--set", help="--run: configuration inputs 'tOn_ms=300,tOff_ms=200'")
    ap.add_argument("--trace", action="store_true", help="--run: one row per tick instead of the change log")
    ap.add_argument("--features", action="store_true", help="list the supported ST features")
    ap.add_argument("--md", help="write a Markdown report of --test")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.lib)
    if a.features:
        print(json.dumps(FEATURES, indent=1) if a.json else "ST SUBSET OF st_sim.py\n" +
              "\n".join("  - " + f for f in FEATURES))
        return 0
    lib = load_library(a.lib, a.file)
    if a.list:
        rows = []
        for p in lib.user_pous():
            rows.append([p.name, p.kind, p.file, len(p.section("VAR_INPUT")), len(p.section("VAR_OUTPUT")),
                         len(p.section("VAR")), sum(1 for _ in walk_stmts(p.body))])
        if a.json:
            print(json.dumps([dict(zip(["pou", "kind", "file", "in", "out", "var", "statements"], r)) for r in rows],
                             indent=1))
        else:
            print(f"ST LIBRARY {a.lib}: {len(rows)} POUs, {len(lib.enums)} enumerations, "
                  f"{len(lib.gconsts)} global constants (+ standard FBs R_TRIG F_TRIG TON TOF TP CTU CTD SR RS)")
            print(fmt_table(["POU", "kind", "file", "in", "out", "var", "statements"], rows, "lllrrrr"))
        return 0
    if a.run:
        if a.ticks < 1:
            raise InputError("--ticks must be >= 1")
        rows = run_trace(lib, a.run, a.ticks, parse_run_events(a.events), parse_sets(a.set))
        if a.json:
            print(json.dumps([{"k": k, **o} for k, o in rows], indent=1))
            return 0
        names = list(rows[0][1])
        if a.trace:
            print(fmt_table(["k"] + names, [[k] + [fbl.fmt(o[n]) for n in names] for k, o in rows]))
        else:
            prev = None
            for k, o in rows:
                if prev is None:
                    print(f"{k} init " + " ".join(f"{n}={fbl.fmt(v)}" for n, v in o.items()))
                else:
                    ch = [f"{n}={fbl.fmt(v)}" for n, v in o.items() if v != prev[n]]
                    if ch:
                        print(f"{k} " + " ".join(ch))
                prev = o
        return 0
    sel = (a.test or "all")
    D = fbl.load10a(a.examples)
    mk = make_st_factory(lib)
    out = []
    if sel.upper() in ("ALL", "ITEM10A"):
        out += fbl.run_10a(mk, st_allowed(lib), D)[4]
    elif sel.upper() != "ITEM9":
        tests, logs, al, mx, lines = fbl.run_10a(mk, st_allowed(lib), D, sel)
        if not tests:
            raise InputError(f"no test matches '{sel}' (FB name, test id like V3, all, item10a, item9)")
        out += lines
    if sel.upper() in ("ALL", "ITEM9"):
        out.append("ITEM 9 (FB_AnalogIn.st, FB_LimitAlarm.st, FB_MotorDol.st + plant model)")
        out += ["    " + x for x in fbl.item9_lines(mk, device_fb.load9())]
    if a.md:
        Path(a.md).write_text("# ST unit tests (st_sim.py)\n\nAll lines produced by the .st source in "
                              "tools/fmse/plc_lib. All values are examples.\n\n```\n" + "\n".join(out) + "\n```\n",
                              encoding="utf-8")
    if a.json:
        print(json.dumps(out, indent=1))
        return 0
    print("\n".join(out))
    if a.md:
        print(f"\nMarkdown written: {a.md}")
    return 0


def walk_stmts(stmts):
    """All statements (nested) of a body."""
    for s in stmts:
        yield s
        k = s[0]
        if k == "if":
            for _, b in s[2]:
                yield from walk_stmts(b)
            if s[3]:
                yield from walk_stmts(s[3])
        elif k == "case":
            for _, b in s[3]:
                yield from walk_stmts(b)
            if s[4]:
                yield from walk_stmts(s[4])
        elif k in ("for",):
            yield from walk_stmts(s[6])
        elif k == "while":
            yield from walk_stmts(s[3])
        elif k == "repeat":
            yield from walk_stmts(s[2])


if __name__ == "__main__":
    run_main(main)
