(*==================================================================================================================
  FB_ModeSwitch  -  operating-mode key switch
  ----------------------------------------------------------------------------------------------------------------
  Library   : FMSE device FB library (item 10A)              Version : 1.0.0 (2026-11-15)
  Rule      : tools/fmse/examples/item10a_examples.json  _rules.FB_ModeSwitch
  Codegen   : item 8 pattern MODE_SWITCH -> st_codegen.py calls this FB (x<Signal> / q<Signal>)
  Purpose   : Key switch with two contacts: Auto -> 1 Production, Maint -> 2 Maintenance, none -> 3 Manual;
              both contacts on keeps the last mode and gives an alarm after tDisc_ms.
  Interface :
    dir  name                type          default   meaning
    IN   xAuto               BOOL          -         contact AUTO (DI)
    IN   xMaint              BOOL          -         contact MAINT (DI)
    CFG  tDisc_ms            DINT          500       discrepancy time [ms]
    OUT  iMode               INT           3         1 Production, 2 Maintenance, 3 Manual
    OUT  xError              BOOL          -         error latched (see alarms)
    OUT  iAlarm              INT           -         local alarm code (0 = none)
  Alarms    : iAlarm = local code a ; Admin.AlarmNo = M*1000 + 10*i + a (decision D2), class per module (D3)
    1  both key positions on (discrepancy)
  Timing    : Times are counted in calls: n * GC_CYCLE_MS >= t_ms (GC_CYCLE_MS = 100 ms = test bench, TYPES.st).
              In the 10 ms main task set GC_CYCLE_MS := 10 (same behaviour, 10 ms resolution) or replace a counter
              by a TON: ton(IN := <condition>, PT := T#2s); IF ton.Q THEN ... (one call later than the counter).
  Siemens   : SCL (TIA Portal): the same statements; local names are written with '#' (#xRst), the VAR section is
              VAR (STAT) of an FB with an instance DB, R_TRIG / TON are multi-instances, enumerations become INT
              constants (E_DriveState.FAULT -> 9), MIN / LIMIT exist, '16#0080' is written W#16#80 for a WORD.
  NOTICE    : ALL VALUES ARE EXAMPLES. Real PLC code is written, reviewed, tested and signed off by qualified
              people. Safety functions only in the F-program; this FB only reads F-copies and writes no F-signal.
==================================================================================================================*)
FUNCTION_BLOCK FB_ModeSwitch
VAR_INPUT  (* signals *)
  xAuto : BOOL;                             (* contact AUTO (DI) *)
  xMaint : BOOL;                            (* contact MAINT (DI) *)
END_VAR
VAR_INPUT  (* configuration (set once, defaults = example values) *)
  tDisc_ms : DINT := 500;                   (* discrepancy time [ms] *)
END_VAR
VAR_OUTPUT  (* outputs *)
  iMode : INT := 3;                         (* 1 Production, 2 Maintenance, 3 Manual *)
  xError : BOOL;                            (* error latched (see alarms) *)
  iAlarm : INT;                             (* local alarm code (0 = none) *)
END_VAR
VAR  (* internal *)
  n : DINT;                                 (* calls with both contacts on *)
END_VAR
IF xAuto AND xMaint THEN
  n := MIN(n + 1, GC_N_MAX);
ELSE
  n := 0;
END_IF
IF xAuto AND NOT xMaint THEN
  iMode := E_Mode.PRODUCTION;
ELSIF xMaint AND NOT xAuto THEN
  iMode := E_Mode.MAINTENANCE;
ELSIF NOT xAuto AND NOT xMaint THEN
  iMode := E_Mode.MANUAL;
END_IF                                        (* both on: mode unchanged *)
xError := n * GC_CYCLE_MS >= tDisc_ms;
IF xError THEN
  iAlarm := 1;
ELSE
  iAlarm := 0;
END_IF
END_FUNCTION_BLOCK
