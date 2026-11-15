# plc_lib: device function-block library in IEC 61131-3 Structured Text (item 10A)

Real ST source, one file per POU, version **1.0.0**. Rules: `tools/fmse/examples/item10a_examples.json`
(decisions D1 - D4, `_rules` common + one rule per FB, `fb_interfaces`, `fb_tests`, `alarm_manager`);
`FB_MotorDol`, `FB_AnalogIn` and `FB_LimitAlarm` keep the item-9 rules (`item9_examples.json`, `device_fb.py`).
Guide: `docs/FMS system design/70_plc_library_A_standard_fbs.md` (part A).

> **All values are examples.** Real PLC code is written, reviewed, tested and signed off by qualified people.
> Safety functions are programmed only in the F-program; these FBs only READ F-copies of safety signals and never
> write an F-output (checked by `plc_lib_check.py`, rule C4).

## Files

| File | Kind | Item-8 pattern (st_codegen) | What | Alarms |
|---|---|---|---|---|
| `TYPES.st` | types | - | enumerations (PackML states / commands, modes, device states, alarm class, quality) and the global constants `GC_CYCLE_MS`, `GC_N_MAX`, `GC_BLINK_HALF_MS`, `GC_LIB_VERSION` - load it FIRST | - |
| `F_CmdAllowed.st` | function | - | PackML command allowed in this state and mode? (item 5 tables) | - |
| `FB_Sensor.st` | base | SENSOR | digital sensor with on / off debounce | - |
| `FB_Valve1.st` | base | VALVE_SINGLE | single-solenoid valve (spring return) with end-position monitoring | 1, 2, 3 |
| `FB_Valve2.st` | base | VALVE_DOUBLE | double-solenoid (bistable) valve with end-position monitoring | 1, 2, 3 |
| `FB_MotorDol.st` | item 9 | DOL | direct-on-line motor with run-feedback supervision | 1, 2, 3, 4 |
| `FB_DriveSto.st` | base | VFD_STO | frequency inverter with safe torque off (STO) | 1, 3 |
| `FB_AnalogIn.st` | item 9 | ANALOG_P, ANALOG_T | 4-20 mA analog input: scaling, NAMUR NE 43 quality, substitute value | 3 |
| `FB_LimitAlarm.st` | item 9 | - | H / L limit alarm with on-delay and hysteresis | - |
| `FB_Heater.st` | base | HEATER | 2-point temperature control with contactor and thermostat monitoring | 1, 2, 3, 4 |
| `FB_PushButton.st` | base | PUSHBUTTON | illuminated push-button | - |
| `FB_SignalTower.st` | base | SIGNAL_TOWER | signal tower and horn per PackML state and alarm class | - |
| `FB_HandshakeHw.st` | base | HANDSHAKE_HW | requester side of the hard-wired 4-phase handshake | 1, 2, 3, 4 |
| `FB_Feeder.st` | base | FEEDER_EXT | external feeder / breaker monitoring | 1 |
| `FB_Ups.st` | base | UPS_DC | 24 V DC UPS monitoring with shutdown request | 1, 2 |
| `FB_Safe2Ch.st` | base | (used by the wrappers) | diagnostic mirror of a 2-channel safety input | 1 |
| `FB_Edm.st` | base | (used by the wrappers) | external device monitoring (EDM) of a safety output | 1 |
| `FB_ModeSwitch.st` | base | MODE_SWITCH | operating-mode key switch | 1 |
| `FB_TwoHand.st` | base | TWOHAND | diagnostic mirror of a two-hand control (type IIIC) | 1 |
| `FB_Scanner.st` | base | SCANNER | safety laser scanner: field-set switching and OSSD mirror | 2 |
| `FB_DoorLock.st` | base | DOOR_LOCK | guard locking: door + lock switch pairs, access request | 1, 2, 3 |
| `FB_CmdIf.st` | module | - | command interface of the module data block (4-phase echo, D1) | - |
| `FB_AlarmMgr.st` | module | - | module alarm manager: AlarmNo, WarningNo, class, reaction (D2 + D3) | - |
| `FB_Estop.st` | wrapper of FB_Safe2Ch | ESTOP | emergency stop button (2 channels) | 1 |
| `FB_Door2Ch.st` | wrapper of FB_Safe2Ch | DOOR_2CH | guard door switch (2 channels, no locking) | 1 |
| `FB_EnableSwitch.st` | wrapper of FB_Safe2Ch | ENABLE | 3-position enabling switch (2 channels) | 1 |
| `FB_LightCurtain.st` | wrapper of FB_Safe2Ch | LC | light curtain (2 OSSD + warning) | 1 |
| `FB_SafetyCoupling.st` | 2 x FB_Safe2Ch | COUPLING | safety coupling to the neighbour (e-stop in + zone free) | 1, 2 |
| `FB_ZoneOut.st` | wrapper of FB_Edm | ZONE_OUT | safety zone output (released contactors) with EDM | 1 |
| `FB_ContactorPair.st` | wrapper of FB_Edm | CONT_PAIR_EDM | redundant contactor pair with EDM | 1 |
| `FB_SafeValve.st` | 2 x FB_Edm | SAFE_VALVE | redundant safety valve pair with position feedback | 1, 2 |

The alarm texts are in the header of every file (and in `fb_library.py LIBRARY`; `plc_lib_check.py` checks that both
are equal). The Admin.AlarmNo of an alarm is `M x 1000 + 10 x i + a` (decision D2): M module number, i instance
number of the FB in the module, a the local code above. The class (A Abort / B Hold / C warning, decision D3) is given
per module and alarm, not by the FB.

## Conventions

- **Names.** Inputs from the field `x<Signal>` (BOOL) / `i<Signal>` (INT), outputs to the field `q<Signal>` /
  `w<Signal>` - exactly the names `st_codegen.py` generates (`Rotate(xPosA := ..., xPosB := ...)`,
  `... := Rotate.qSolA`). Commands `xCmd...`, status `xError`, `xBusy`, `iAlarm`, `iState`; configuration `t..._ms`
  (DINT milliseconds), `r...` (REAL), `b...` (BOOL), `i...` (INT); internal counters `n...`.
- **Sections.** `VAR_INPUT (* signals *)`, a second `VAR_INPUT (* configuration *)` with the example defaults,
  `VAR_OUTPUT`, `VAR (* internal *)`. Inputs keep their value between calls; the module sets the configuration once.
- **Header.** Every file starts with the same header: name and title, library + version, rule reference, codegen
  pattern, purpose, interface table (dir, name, type, default, meaning), alarm table, timing note, Siemens note,
  example-values notice.
- **Edges** with `R_TRIG` instances (`rtReset(CLK := xReset); xRst := rtReset.Q;`) = the rule `x AND NOT x_prev`,
  x_prev starts FALSE.
- **Errors latch** until a rising edge of `xReset` (where the rule has a reset) and an error never switches an output
  by itself (valves) unless the rule says so (heater, handshake): the module decides the reaction by alarm class.

## Timers: counter of calls or TON

The rules count calls: a time is reached when `n * GC_CYCLE_MS >= t_ms`. `GC_CYCLE_MS = 100` is the test bench
(one call per 100 ms tick), so the unit tests run exactly like the rules. In a real PLC the FBs run in the 10 ms main
task: set `GC_CYCLE_MS := 10` in `TYPES.st` (all times in ms stay the same, resolution 10 ms), or replace a counter by
a TON, e.g. in FB_Valve1:

```
tonMove(IN := xMoving AND xEnable AND NOT xReached, PT := DINT_TO_TIME(tMove_ms));
IF tonMove.Q THEN xError := TRUE; iAlarm := 1; xMoving := FALSE; END_IF
```

A TON reaches PT one call later than the counter (it starts at 0 in its first call) and does not pause while
`xEnable` is FALSE unless you write it so - the counter version is the reference. Counters stop at `GC_N_MAX`
(1 000 000 calls = 27 h at 100 ms), so they never overflow.

## Siemens SCL (TIA Portal)

The statements are portable (CODESYS / TwinCAT 3 / Beckhoff style). For TIA Portal: write local names with `#`
(`#xRst := #rtReset.Q;`), the `VAR` section is `VAR` (static) of an FB with an instance DB, R_TRIG / TON are
multi-instances, enumerations become INT constants with the same values (TIA has no enum types in SCL), a WORD
literal is `W#16#80`, and `FUNCTION F_CmdAllowed` returns its value through `#F_CmdAllowed := ...` or `RETURN`.

## Test and check

```
python tools/fmse/st_sim.py --test           (all 19 FB tests + alarm manager + command matrix + item 9, run on THIS source)
python tools/fmse/st_sim.py --run FB_Valve1 --ticks 30 --events "2:xCmdB=1,xPosA=0;8:xPosB=1"
python tools/fmse/plc_lib_check.py --modules (library rules, codegen names of all 22 modules, generated code runs)
```

`st_sim.py` is a small interpreter for the ST subset used here (see `st_sim.py --features`). Keep new FBs inside
that subset: no STRUCT, STRING, pointers, VAR_IN_OUT or OOP. The ST files are written with '\n' line ends, ASCII,
no TAB (`plc_lib_check.py` C6).
