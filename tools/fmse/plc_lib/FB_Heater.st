(*==================================================================================================================
  FB_Heater  -  2-point temperature control with contactor and thermostat monitoring
  ----------------------------------------------------------------------------------------------------------------
  Library   : FMSE device FB library (item 10A)              Version : 1.0.0 (2026-11-15)
  Rule      : tools/fmse/examples/item10a_examples.json  _rules.FB_Heater
  Codegen   : item 8 pattern HEATER -> st_codegen.py calls this FB (x<Signal> / q<Signal>)
  Purpose   : Heater (e.g. washing bath) switched by a contactor: 2-point control with hysteresis below the set
              point, supervision of the contactor feedback (missing / welded), safety thermostat and signal quality.
  Interface :
    dir  name                type          default   meaning
    IN   xOnFb               BOOL          -         contactor auxiliary contact (DI)
    IN   xOverTemp           BOOL          -         safety thermostat tripped (DI)
    IN   rTemp               REAL          20.0      temperature (FB_AnalogIn.rValue)
    IN   xTempGood           BOOL          TRUE      quality GOOD (FB_AnalogIn.xGood)
    IN   xEnable             BOOL          -         heating enabled by the sequence
    IN   rSp                 REAL          60.0      set point
    IN   xReset              BOOL          -         fault reset, rising edge
    CFG  rHyst               REAL          2.0       switch-on hysteresis below rSp
    CFG  tFb_ms              DINT          500       feedback time [ms]
    OUT  qOn                 BOOL          -         heater contactor (DO)
    OUT  xError              BOOL          -         error latched (see alarms)
    OUT  iAlarm              INT           -         local alarm code (0 = none)
  Alarms    : iAlarm = local code a ; Admin.AlarmNo = M*1000 + 10*i + a (decision D2), class per module (D3)
    1  over-temperature (safety thermostat)
    2  no contactor feedback
    3  temperature signal bad
    4  feedback without command (contactor welded?)
  Timing    : Times are counted in calls: n * GC_CYCLE_MS >= t_ms (GC_CYCLE_MS = 100 ms = test bench, TYPES.st).
              In the 10 ms main task set GC_CYCLE_MS := 10 (same behaviour, 10 ms resolution) or replace a counter
              by a TON: ton(IN := <condition>, PT := T#2s); IF ton.Q THEN ... (one call later than the counter).
  Siemens   : SCL (TIA Portal): the same statements; local names are written with '#' (#xRst), the VAR section is
              VAR (STAT) of an FB with an instance DB, R_TRIG / TON are multi-instances, enumerations become INT
              constants (E_DriveState.FAULT -> 9), MIN / LIMIT exist, '16#0080' is written W#16#80 for a WORD.
  NOTICE    : ALL VALUES ARE EXAMPLES. Real PLC code is written, reviewed, tested and signed off by qualified
              people. Safety functions only in the F-program; this FB only reads F-copies and writes no F-signal.
==================================================================================================================*)
FUNCTION_BLOCK FB_Heater
VAR_INPUT  (* signals *)
  xOnFb : BOOL;                             (* contactor auxiliary contact (DI) *)
  xOverTemp : BOOL;                         (* safety thermostat tripped (DI) *)
  rTemp : REAL := 20.0;                     (* temperature (FB_AnalogIn.rValue) *)
  xTempGood : BOOL := TRUE;                 (* quality GOOD (FB_AnalogIn.xGood) *)
  xEnable : BOOL;                           (* heating enabled by the sequence *)
  rSp : REAL := 60.0;                       (* set point *)
  xReset : BOOL;                            (* fault reset, rising edge *)
END_VAR
VAR_INPUT  (* configuration (set once, defaults = example values) *)
  rHyst : REAL := 2.0;                      (* switch-on hysteresis below rSp *)
  tFb_ms : DINT := 500;                     (* feedback time [ms] *)
END_VAR
VAR_OUTPUT  (* outputs *)
  qOn : BOOL;                               (* heater contactor (DO) *)
  xError : BOOL;                            (* error latched (see alarms) *)
  iAlarm : INT;                             (* local alarm code (0 = none) *)
END_VAR
VAR  (* internal *)
  rtReset : R_TRIG;                         (* edge of xReset *)
  xRst : BOOL;                              (* reset pulse *)
  xHeat : BOOL;                             (* 2-point controller state *)
  xQ : BOOL;                                (* contactor command *)
  nFb : DINT;                               (* calls: command without feedback *)
  nWeld : DINT;                             (* calls: feedback without command *)
END_VAR
rtReset(CLK := xReset);
xRst := rtReset.Q;
(* (1) reset only when the cause is gone and the contactor is open *)
IF xError AND xRst AND NOT xOverTemp AND (xTempGood OR NOT xEnable) AND NOT xOnFb THEN
  xError := FALSE;
  iAlarm := 0;
  nFb := 0;
  nWeld := 0;
END_IF
(* (2) thermostat and signal quality *)
IF NOT xError THEN
  IF xOverTemp THEN
    xError := TRUE;
    iAlarm := 1;                              (* over-temperature *)
  ELSIF xEnable AND NOT xTempGood THEN
    xError := TRUE;
    iAlarm := 3;                              (* temperature signal bad *)
  END_IF
END_IF
(* (3) 2-point control: on at rSp - rHyst, off at rSp, unchanged in between *)
IF NOT xEnable OR xError THEN
  xHeat := FALSE;
ELSIF rTemp <= rSp - rHyst THEN
  xHeat := TRUE;
ELSIF rTemp >= rSp THEN
  xHeat := FALSE;
END_IF
xQ := xHeat;
(* (4) contactor feedback supervision *)
IF xQ AND NOT xOnFb THEN
  nFb := MIN(nFb + 1, GC_N_MAX);
ELSE
  nFb := 0;
END_IF
IF NOT xQ AND xOnFb THEN
  nWeld := MIN(nWeld + 1, GC_N_MAX);
ELSE
  nWeld := 0;
END_IF
IF NOT xError AND nFb * GC_CYCLE_MS >= tFb_ms THEN
  xError := TRUE;
  iAlarm := 2;                                (* no contactor feedback *)
END_IF
IF NOT xError AND nWeld * GC_CYCLE_MS >= tFb_ms THEN
  xError := TRUE;
  iAlarm := 4;                                (* feedback without command *)
END_IF
(* (5) an error switches the heater off *)
IF xError THEN
  xHeat := FALSE;
  xQ := FALSE;
END_IF
qOn := xQ;
END_FUNCTION_BLOCK
