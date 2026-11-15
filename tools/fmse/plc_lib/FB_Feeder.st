(*==================================================================================================================
  FB_Feeder  -  external feeder / breaker monitoring
  ----------------------------------------------------------------------------------------------------------------
  Library   : FMSE device FB library (item 10A)              Version : 1.0.0 (2026-11-15)
  Rule      : tools/fmse/examples/item10a_examples.json  _rules.FB_Feeder
  Codegen   : item 8 pattern FEEDER_EXT -> st_codegen.py calls this FB (x<Signal> / q<Signal>)
  Purpose   : Auxiliary contact of a feeder breaker: alarm after tDelay_ms without supply (not latched).
  Interface :
    dir  name                type          default   meaning
    IN   xSupplyOn           BOOL          TRUE      breaker auxiliary contact (DI)
    CFG  tDelay_ms           DINT          200       alarm delay [ms]
    OUT  xOk                 BOOL          -         supply on
    OUT  iAlarm              INT           -         local alarm code (0 = none)
  Alarms    : iAlarm = local code a ; Admin.AlarmNo = M*1000 + 10*i + a (decision D2), class per module (D3)
    1  feeder breaker off
  Timing    : Times are counted in calls: n * GC_CYCLE_MS >= t_ms (GC_CYCLE_MS = 100 ms = test bench, TYPES.st).
              In the 10 ms main task set GC_CYCLE_MS := 10 (same behaviour, 10 ms resolution) or replace a counter
              by a TON: ton(IN := <condition>, PT := T#2s); IF ton.Q THEN ... (one call later than the counter).
  Siemens   : SCL (TIA Portal): the same statements; local names are written with '#' (#xRst), the VAR section is
              VAR (STAT) of an FB with an instance DB, R_TRIG / TON are multi-instances, enumerations become INT
              constants (E_DriveState.FAULT -> 9), MIN / LIMIT exist, '16#0080' is written W#16#80 for a WORD.
  NOTICE    : ALL VALUES ARE EXAMPLES. Real PLC code is written, reviewed, tested and signed off by qualified
              people. Safety functions only in the F-program; this FB only reads F-copies and writes no F-signal.
==================================================================================================================*)
FUNCTION_BLOCK FB_Feeder
VAR_INPUT  (* signals *)
  xSupplyOn : BOOL := TRUE;                 (* breaker auxiliary contact (DI) *)
END_VAR
VAR_INPUT  (* configuration (set once, defaults = example values) *)
  tDelay_ms : DINT := 200;                  (* alarm delay [ms] *)
END_VAR
VAR_OUTPUT  (* outputs *)
  xOk : BOOL;                               (* supply on *)
  iAlarm : INT;                             (* local alarm code (0 = none) *)
END_VAR
VAR  (* internal *)
  n : DINT;                                 (* calls without supply *)
END_VAR
IF NOT xSupplyOn THEN
  n := MIN(n + 1, GC_N_MAX);
ELSE
  n := 0;
END_IF
xOk := xSupplyOn;
IF n * GC_CYCLE_MS >= tDelay_ms THEN
  iAlarm := 1;                                (* feeder breaker off *)
ELSE
  iAlarm := 0;
END_IF
END_FUNCTION_BLOCK
