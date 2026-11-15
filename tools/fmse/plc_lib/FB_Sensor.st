(*==================================================================================================================
  FB_Sensor  -  digital sensor with on / off debounce
  ----------------------------------------------------------------------------------------------------------------
  Library   : FMSE device FB library (item 10A)              Version : 1.0.0 (2026-11-15)
  Rule      : tools/fmse/examples/item10a_examples.json  _rules.FB_Sensor
  Codegen   : item 8 pattern SENSOR -> st_codegen.py calls this FB (x<Signal> / q<Signal>)
  Purpose   : Debounce of a digital sensor: the value follows the input only after it differs for tOn_ms (0 -> 1)
              or tOff_ms (1 -> 0); a shorter bounce is ignored. tOn_ms = tOff_ms = 0: one call delay is not added.
  Interface :
    dir  name                type          default   meaning
    IN   xOn                 BOOL          -         sensor input (DI)
    CFG  tOn_ms              DINT          0         debounce time 0 -> 1 [ms]
    CFG  tOff_ms             DINT          0         debounce time 1 -> 0 [ms]
    OUT  xValue              BOOL          -         debounced value
  Alarms    : iAlarm = local code a ; Admin.AlarmNo = M*1000 + 10*i + a (decision D2), class per module (D3)
    none
  Timing    : Times are counted in calls: n * GC_CYCLE_MS >= t_ms (GC_CYCLE_MS = 100 ms = test bench, TYPES.st).
              In the 10 ms main task set GC_CYCLE_MS := 10 (same behaviour, 10 ms resolution) or replace a counter
              by a TON: ton(IN := <condition>, PT := T#2s); IF ton.Q THEN ... (one call later than the counter).
  Siemens   : SCL (TIA Portal): the same statements; local names are written with '#' (#xRst), the VAR section is
              VAR (STAT) of an FB with an instance DB, R_TRIG / TON are multi-instances, enumerations become INT
              constants (E_DriveState.FAULT -> 9), MIN / LIMIT exist, '16#0080' is written W#16#80 for a WORD.
  NOTICE    : ALL VALUES ARE EXAMPLES. Real PLC code is written, reviewed, tested and signed off by qualified
              people. Safety functions only in the F-program; this FB only reads F-copies and writes no F-signal.
==================================================================================================================*)
FUNCTION_BLOCK FB_Sensor
VAR_INPUT  (* signals *)
  xOn : BOOL;                               (* sensor input (DI) *)
END_VAR
VAR_INPUT  (* configuration (set once, defaults = example values) *)
  tOn_ms : DINT := 0;                       (* debounce time 0 -> 1 [ms] *)
  tOff_ms : DINT := 0;                      (* debounce time 1 -> 0 [ms] *)
END_VAR
VAR_OUTPUT  (* outputs *)
  xValue : BOOL;                            (* debounced value *)
END_VAR
VAR  (* internal *)
  nCnt : DINT;                              (* calls with input <> value *)
  tLim : DINT;                              (* active debounce time *)
END_VAR
IF xOn <> xValue THEN
  nCnt := MIN(nCnt + 1, GC_N_MAX);
  IF xOn THEN
    tLim := tOn_ms;
  ELSE
    tLim := tOff_ms;
  END_IF
  IF nCnt * GC_CYCLE_MS >= tLim THEN
    xValue := xOn;
    nCnt := 0;
  END_IF
ELSE
  nCnt := 0;
END_IF
END_FUNCTION_BLOCK
