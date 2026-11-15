(*==================================================================================================================
  FB_TwoHand  -  diagnostic mirror of a two-hand control (type IIIC)
  ----------------------------------------------------------------------------------------------------------------
  Library   : FMSE device FB library (item 10A)              Version : 1.0.0 (2026-11-15)
  Rule      : tools/fmse/examples/item10a_examples.json  _rules.FB_TwoHand
  Codegen   : item 8 pattern TWOHAND -> st_codegen.py calls this FB (x<Signal> / q<Signal>)
  Purpose   : Two 2-channel buttons, simultaneity 0.5 s (the F-program does the safety function). Pressing the
              second hand later than tSync_ms blocks until both are released. Strict '>': the 5th call (500 ms)
              is still simultaneous.
  Interface :
    dir  name                type          default   meaning
    IN   xLeft               BOOL          -         left button NO (DI)
    IN   xLeft2              BOOL          -         left button NC (DI)
    IN   xRight              BOOL          -         right button NO (DI)
    IN   xRight2             BOOL          -         right button NC (DI)
    CFG  tSync_ms            DINT          500       simultaneity time [ms]
    OUT  xActuated           BOOL          -         both hands, simultaneous
    OUT  xError              BOOL          -         error latched (see alarms)
    OUT  iAlarm              INT           -         local alarm code (0 = none)
  Alarms    : iAlarm = local code a ; Admin.AlarmNo = M*1000 + 10*i + a (decision D2), class per module (D3)
    1  not simultaneous - release both
  Timing    : Times are counted in calls: n * GC_CYCLE_MS >= t_ms (GC_CYCLE_MS = 100 ms = test bench, TYPES.st).
              In the 10 ms main task set GC_CYCLE_MS := 10 (same behaviour, 10 ms resolution) or replace a counter
              by a TON: ton(IN := <condition>, PT := T#2s); IF ton.Q THEN ... (one call later than the counter).
  Siemens   : SCL (TIA Portal): the same statements; local names are written with '#' (#xRst), the VAR section is
              VAR (STAT) of an FB with an instance DB, R_TRIG / TON are multi-instances, enumerations become INT
              constants (E_DriveState.FAULT -> 9), MIN / LIMIT exist, '16#0080' is written W#16#80 for a WORD.
  NOTICE    : ALL VALUES ARE EXAMPLES. Real PLC code is written, reviewed, tested and signed off by qualified
              people. Safety functions only in the F-program; this FB only reads F-copies and writes no F-signal.
==================================================================================================================*)
FUNCTION_BLOCK FB_TwoHand
VAR_INPUT  (* signals *)
  xLeft : BOOL;                             (* left button NO (DI) *)
  xLeft2 : BOOL;                            (* left button NC (DI) *)
  xRight : BOOL;                            (* right button NO (DI) *)
  xRight2 : BOOL;                           (* right button NC (DI) *)
END_VAR
VAR_INPUT  (* configuration (set once, defaults = example values) *)
  tSync_ms : DINT := 500;                   (* simultaneity time [ms] *)
END_VAR
VAR_OUTPUT  (* outputs *)
  xActuated : BOOL;                         (* both hands, simultaneous *)
  xError : BOOL;                            (* error latched (see alarms) *)
  iAlarm : INT;                             (* local alarm code (0 = none) *)
END_VAR
VAR  (* internal *)
  xL : BOOL;                                (* left actuated *)
  xR : BOOL;                                (* right actuated *)
  n : DINT;                                 (* calls with one hand only *)
  xBlocked : BOOL;                          (* release both first *)
END_VAR
xL := xLeft AND xLeft2;
xR := xRight AND xRight2;
IF NOT xL AND NOT xR THEN
  xBlocked := FALSE;
  n := 0;
  xError := FALSE;
  iAlarm := 0;
  xActuated := FALSE;
ELSIF xL <> xR THEN
  n := MIN(n + 1, GC_N_MAX);
  IF (n * GC_CYCLE_MS > tSync_ms) AND NOT xActuated THEN
    xBlocked := TRUE;
    xError := TRUE;
    iAlarm := 1;                              (* not simultaneous *)
  END_IF
  xActuated := FALSE;
ELSE
  xActuated := NOT xBlocked;
END_IF
END_FUNCTION_BLOCK
