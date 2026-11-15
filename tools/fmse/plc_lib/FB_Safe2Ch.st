(*==================================================================================================================
  FB_Safe2Ch  -  diagnostic mirror of a 2-channel safety input
  ----------------------------------------------------------------------------------------------------------------
  Library   : FMSE device FB library (item 10A)              Version : 1.0.0 (2026-11-15)
  Rule      : tools/fmse/examples/item10a_examples.json  _rules.FB_Safe2Ch
  Purpose   : Standard-program mirror of a 2-channel safety input (the safety function itself is in the
              F-program): reset needed after power-on and after every opening, discrepancy alarm that can only
              be reset after BOTH channels were open (cross-fault test). Base of FB_Estop, FB_Door2Ch,
              FB_EnableSwitch, FB_LightCurtain and FB_SafetyCoupling.
  Interface :
    dir  name                type          default   meaning
    IN   xCh1                BOOL          -         channel 1, TRUE = safe / closed
    IN   xCh2                BOOL          -         channel 2, TRUE = safe / closed
    IN   xReset              BOOL          -         fault reset, rising edge
    CFG  tDisc_ms            DINT          500       discrepancy time [ms]
    OUT  xOk                 BOOL          -         both channels closed and reset
    OUT  xResetReq           BOOL          -         closed, waiting for a reset (lamp)
    OUT  xDiscErr            BOOL          -         discrepancy latched
    OUT  iAlarm              INT           -         local alarm code (0 = none)
  Alarms    : iAlarm = local code a ; Admin.AlarmNo = M*1000 + 10*i + a (decision D2), class per module (D3)
    1  discrepancy
  Timing    : Times are counted in calls: n * GC_CYCLE_MS >= t_ms (GC_CYCLE_MS = 100 ms = test bench, TYPES.st).
              In the 10 ms main task set GC_CYCLE_MS := 10 (same behaviour, 10 ms resolution) or replace a counter
              by a TON: ton(IN := <condition>, PT := T#2s); IF ton.Q THEN ... (one call later than the counter).
  Siemens   : SCL (TIA Portal): the same statements; local names are written with '#' (#xRst), the VAR section is
              VAR (STAT) of an FB with an instance DB, R_TRIG / TON are multi-instances, enumerations become INT
              constants (E_DriveState.FAULT -> 9), MIN / LIMIT exist, '16#0080' is written W#16#80 for a WORD.
  NOTICE    : ALL VALUES ARE EXAMPLES. Real PLC code is written, reviewed, tested and signed off by qualified
              people. Safety functions only in the F-program; this FB only reads F-copies and writes no F-signal.
==================================================================================================================*)
FUNCTION_BLOCK FB_Safe2Ch
VAR_INPUT  (* signals *)
  xCh1 : BOOL;                              (* channel 1, TRUE = safe / closed *)
  xCh2 : BOOL;                              (* channel 2, TRUE = safe / closed *)
  xReset : BOOL;                            (* fault reset, rising edge *)
END_VAR
VAR_INPUT  (* configuration (set once, defaults = example values) *)
  tDisc_ms : DINT := 500;                   (* discrepancy time [ms] *)
END_VAR
VAR_OUTPUT  (* outputs *)
  xOk : BOOL;                               (* both channels closed and reset *)
  xResetReq : BOOL;                         (* closed, waiting for a reset (lamp) *)
  xDiscErr : BOOL;                          (* discrepancy latched *)
  iAlarm : INT;                             (* local alarm code (0 = none) *)
END_VAR
VAR  (* internal *)
  rtReset : R_TRIG;                         (* edge of xReset *)
  xRst : BOOL;                              (* reset pulse *)
  xLatched : BOOL := TRUE;                  (* reset needed (TRUE after power-on) *)
  nDisc : DINT;                             (* calls with xCh1 <> xCh2 *)
  xBothOpen : BOOL;                         (* both channels were open after the discrepancy *)
END_VAR
rtReset(CLK := xReset);
xRst := rtReset.Q;
IF xCh1 <> xCh2 THEN
  nDisc := MIN(nDisc + 1, GC_N_MAX);
ELSE
  nDisc := 0;
END_IF
IF (nDisc * GC_CYCLE_MS >= tDisc_ms) AND NOT xDiscErr THEN
  xDiscErr := TRUE;
  iAlarm := 1;                                (* discrepancy *)
  xBothOpen := FALSE;
END_IF
IF xDiscErr AND NOT xCh1 AND NOT xCh2 THEN
  xBothOpen := TRUE;
END_IF
IF NOT (xCh1 AND xCh2) THEN
  xLatched := TRUE;
END_IF
IF xRst AND xCh1 AND xCh2 THEN
  IF xDiscErr AND xBothOpen THEN
    xDiscErr := FALSE;
    iAlarm := 0;
  END_IF
  IF NOT xDiscErr THEN
    xLatched := FALSE;
  END_IF
END_IF
xOk := xCh1 AND xCh2 AND NOT xLatched AND NOT xDiscErr;
xResetReq := xLatched AND xCh1 AND xCh2 AND NOT xDiscErr;
END_FUNCTION_BLOCK
