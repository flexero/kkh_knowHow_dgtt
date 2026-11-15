(*==================================================================================================================
  FB_Valve1  -  single-solenoid valve (spring return) with end-position monitoring
  ----------------------------------------------------------------------------------------------------------------
  Library   : FMSE device FB library (item 10A)              Version : 1.0.0 (2026-11-15)
  Rule      : tools/fmse/examples/item10a_examples.json  _rules.FB_Valve
  Codegen   : item 8 pattern VALVE_SINGLE -> st_codegen.py calls this FB (x<Signal> / q<Signal>)
  Purpose   : Pneumatic cylinder with a 5/2 single-solenoid valve: qSol TRUE -> position B, FALSE (or xEnable
              FALSE) -> the spring returns it to A. Supervises the movement time, the loss of the end position and
              both end switches; a reset retries the movement.
  Interface :
    dir  name                type          default   meaning
    IN   xPosA               BOOL          TRUE      end switch A (DI); default: starts at A
    IN   xPosB               BOOL          -         end switch B (DI)
    IN   xCmdB               BOOL          -         TRUE = go to / stay at B, FALSE = A
    IN   xEnable             BOOL          TRUE      FALSE = outputs off
    IN   xReset              BOOL          -         fault reset, rising edge
    CFG  tMove_ms            DINT          2000      max. time to reach the end position [ms]
    CFG  tLost_ms            DINT          300       end position lost without command [ms]
    CFG  tBoth_ms            DINT          200       both end switches on [ms]
    OUT  qSol                BOOL          -         solenoid (DO): TRUE = B
    OUT  xAtA                BOOL          -         at end position A
    OUT  xAtB                BOOL          -         at end position B
    OUT  xBusy               BOOL          -         moving (supervised)
    OUT  xError              BOOL          -         error latched (see alarms)
    OUT  iAlarm              INT           -         local alarm code (0 = none)
  Alarms    : iAlarm = local code a ; Admin.AlarmNo = M*1000 + 10*i + a (decision D2), class per module (D3)
    1  end position not reached
    2  left the end position without command
    3  both end switches on
  Timing    : Times are counted in calls: n * GC_CYCLE_MS >= t_ms (GC_CYCLE_MS = 100 ms = test bench, TYPES.st).
              In the 10 ms main task set GC_CYCLE_MS := 10 (same behaviour, 10 ms resolution) or replace a counter
              by a TON: ton(IN := <condition>, PT := T#2s); IF ton.Q THEN ... (one call later than the counter).
  Siemens   : SCL (TIA Portal): the same statements; local names are written with '#' (#xRst), the VAR section is
              VAR (STAT) of an FB with an instance DB, R_TRIG / TON are multi-instances, enumerations become INT
              constants (E_DriveState.FAULT -> 9), MIN / LIMIT exist, '16#0080' is written W#16#80 for a WORD.
  NOTICE    : ALL VALUES ARE EXAMPLES. Real PLC code is written, reviewed, tested and signed off by qualified
              people. Safety functions only in the F-program; this FB only reads F-copies and writes no F-signal.
==================================================================================================================*)
FUNCTION_BLOCK FB_Valve1
VAR_INPUT  (* signals *)
  xPosA : BOOL := TRUE;                     (* end switch A (DI); default: starts at A *)
  xPosB : BOOL;                             (* end switch B (DI) *)
  xCmdB : BOOL;                             (* TRUE = go to / stay at B, FALSE = A *)
  xEnable : BOOL := TRUE;                   (* FALSE = outputs off *)
  xReset : BOOL;                            (* fault reset, rising edge *)
END_VAR
VAR_INPUT  (* configuration (set once, defaults = example values) *)
  tMove_ms : DINT := 2000;                  (* max. time to reach the end position [ms] *)
  tLost_ms : DINT := 300;                   (* end position lost without command [ms] *)
  tBoth_ms : DINT := 200;                   (* both end switches on [ms] *)
END_VAR
VAR_OUTPUT  (* outputs *)
  qSol : BOOL;                              (* solenoid (DO): TRUE = B *)
  xAtA : BOOL;                              (* at end position A *)
  xAtB : BOOL;                              (* at end position B *)
  xBusy : BOOL;                             (* moving (supervised) *)
  xError : BOOL;                            (* error latched (see alarms) *)
  iAlarm : INT;                             (* local alarm code (0 = none) *)
END_VAR
VAR  (* internal *)
  rtReset : R_TRIG;                         (* edge of xReset *)
  xRst : BOOL;                              (* reset pulse *)
  xA : BOOL;                                (* at A (decoded) *)
  xB : BOOL;                                (* at B (decoded) *)
  xReached : BOOL;                          (* commanded end position reached *)
  xMoving : BOOL;                           (* movement supervised *)
  xPrevCmd : BOOL;                          (* command of the last call *)
  xFirst : BOOL := TRUE;                    (* first call *)
  nMove : DINT;                             (* calls while moving and enabled *)
  nLost : DINT;                             (* calls out of position *)
  nBoth : DINT;                             (* calls with both switches on *)
END_VAR
(* step 0: edge of the reset and position decode *)
rtReset(CLK := xReset);
xRst := rtReset.Q;
xA := xPosA AND NOT xPosB;
xB := xPosB AND NOT xPosA;
IF xCmdB THEN
  xReached := xB;
ELSE
  xReached := xA;
END_IF
(* (1) reset of an error = retry: supervise the movement again if the end position is not reached *)
IF xError AND xRst AND NOT (xPosA AND xPosB) THEN
  xError := FALSE;
  iAlarm := 0;
  xMoving := NOT xReached;
  nMove := 0;
  nLost := 0;
END_IF
(* (2) new command or first call: start the movement supervision *)
IF xFirst OR (xCmdB <> xPrevCmd) THEN
  xMoving := TRUE;
  nMove := 0;
END_IF
(* (3) both end switches on at the same time *)
IF xPosA AND xPosB THEN
  nBoth := MIN(nBoth + 1, GC_N_MAX);
ELSE
  nBoth := 0;
END_IF
(* (4) supervision - an error latches until a reset *)
IF NOT xError THEN
  IF nBoth * GC_CYCLE_MS >= tBoth_ms THEN
    xError := TRUE;
    iAlarm := 3;                              (* both end switches on *)
    xMoving := FALSE;
  ELSIF xMoving THEN
    nLost := 0;
    IF xEnable THEN                           (* the movement timer pauses while disabled *)
      nMove := MIN(nMove + 1, GC_N_MAX);
      IF xReached THEN
        xMoving := FALSE;
      ELSIF nMove * GC_CYCLE_MS >= tMove_ms THEN
        xError := TRUE;
        iAlarm := 1;                          (* end position not reached *)
        xMoving := FALSE;
      END_IF
    END_IF
  ELSIF xEnable THEN
    IF NOT xReached THEN
      nLost := MIN(nLost + 1, GC_N_MAX);
    ELSE
      nLost := 0;
    END_IF
    IF nLost * GC_CYCLE_MS >= tLost_ms THEN
      xError := TRUE;
      iAlarm := 2;                            (* left the end position without command *)
    END_IF
  ELSE
    nLost := 0;
  END_IF
END_IF
(* (5) outputs - an error does NOT switch the solenoid(s): the module reacts by alarm class (D3) *)
qSol := xCmdB AND xEnable;
xAtA := xA;
xAtB := xB;
xBusy := xMoving AND NOT xError;
xPrevCmd := xCmdB;
xFirst := FALSE;
END_FUNCTION_BLOCK
