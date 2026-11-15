(*==================================================================================================================
  FB_Edm  -  external device monitoring (EDM) of a safety output
  ----------------------------------------------------------------------------------------------------------------
  Library   : FMSE device FB library (item 10A)              Version : 1.0.0 (2026-11-15)
  Rule      : tools/fmse/examples/item10a_examples.json  _rules.FB_Edm
  Purpose   : Checks that the feedback of a safety output follows its command: NC mirror contacts of
              contactors (bInverted TRUE: feedback TRUE when OPEN) or the position switch of a safety valve
              (bInverted FALSE). Base of FB_ZoneOut, FB_ContactorPair and FB_SafeValve.
  Interface :
    dir  name                type          default   meaning
    IN   xCmd                BOOL          -         F-copy of the F-output (read only)
    IN   xFb                 BOOL          TRUE      feedback (DI)
    IN   xReset              BOOL          -         fault reset, rising edge
    CFG  tEdm_ms             DINT          300       feedback time [ms]
    CFG  bInverted           BOOL          TRUE      TRUE = NC mirror contact
    OUT  xOn                 BOOL          -         output on and feedback ok
    OUT  xError              BOOL          -         error latched (see alarms)
    OUT  iAlarm              INT           -         local alarm code (0 = none)
  Alarms    : iAlarm = local code a ; Admin.AlarmNo = M*1000 + 10*i + a (decision D2), class per module (D3)
    1  feedback does not follow (welded / not switching)
  Timing    : Times are counted in calls: n * GC_CYCLE_MS >= t_ms (GC_CYCLE_MS = 100 ms = test bench, TYPES.st).
              In the 10 ms main task set GC_CYCLE_MS := 10 (same behaviour, 10 ms resolution) or replace a counter
              by a TON: ton(IN := <condition>, PT := T#2s); IF ton.Q THEN ... (one call later than the counter).
  Siemens   : SCL (TIA Portal): the same statements; local names are written with '#' (#xRst), the VAR section is
              VAR (STAT) of an FB with an instance DB, R_TRIG / TON are multi-instances, enumerations become INT
              constants (E_DriveState.FAULT -> 9), MIN / LIMIT exist, '16#0080' is written W#16#80 for a WORD.
  NOTICE    : ALL VALUES ARE EXAMPLES. Real PLC code is written, reviewed, tested and signed off by qualified
              people. Safety functions only in the F-program; this FB only reads F-copies and writes no F-signal.
==================================================================================================================*)
FUNCTION_BLOCK FB_Edm
VAR_INPUT  (* signals *)
  xCmd : BOOL;                              (* F-copy of the F-output (read only) *)
  xFb : BOOL := TRUE;                       (* feedback (DI) *)
  xReset : BOOL;                            (* fault reset, rising edge *)
END_VAR
VAR_INPUT  (* configuration (set once, defaults = example values) *)
  tEdm_ms : DINT := 300;                    (* feedback time [ms] *)
  bInverted : BOOL := TRUE;                 (* TRUE = NC mirror contact *)
END_VAR
VAR_OUTPUT  (* outputs *)
  xOn : BOOL;                               (* output on and feedback ok *)
  xError : BOOL;                            (* error latched (see alarms) *)
  iAlarm : INT;                             (* local alarm code (0 = none) *)
END_VAR
VAR  (* internal *)
  rtReset : R_TRIG;                         (* edge of xReset *)
  xExp : BOOL;                              (* expected feedback *)
  xFbOk : BOOL;                             (* feedback = expected *)
  n : DINT;                                 (* calls with wrong feedback *)
END_VAR
rtReset(CLK := xReset);
IF bInverted THEN
  xExp := NOT xCmd;
ELSE
  xExp := xCmd;
END_IF
xFbOk := xFb = xExp;
IF NOT xFbOk THEN
  n := MIN(n + 1, GC_N_MAX);
ELSE
  n := 0;
END_IF
IF xError AND rtReset.Q AND xFbOk THEN
  xError := FALSE;
  iAlarm := 0;
END_IF
IF NOT xError AND n * GC_CYCLE_MS >= tEdm_ms THEN
  xError := TRUE;
  iAlarm := 1;                                (* feedback does not follow *)
END_IF
xOn := xCmd AND xFbOk AND NOT xError;
END_FUNCTION_BLOCK
