(*==================================================================================================================
  FB_DoorLock  -  guard locking: door + lock switch pairs, access request
  ----------------------------------------------------------------------------------------------------------------
  Library   : FMSE device FB library (item 10A)              Version : 1.0.0 (2026-11-15)
  Rule      : tools/fmse/examples/item10a_examples.json  _rules.FB_DoorLock
  Codegen   : item 8 pattern DOOR_LOCK -> st_codegen.py calls this FB (x<Signal> / q<Signal>)
  Purpose   : Item 7/8 DOOR_LOCK: discrepancy of the door pair and of the lock pair, locked-but-not-closed
              (tongue missing / manipulation), access request to the F-program (unlock after standstill), the
              request ends when the door was opened and closed again. Errors are latched (module reset, part B).
  Interface :
    dir  name                type          default   meaning
    IN   xClosed             BOOL          TRUE      door closed, channel 1 (DI)
    IN   xClosed2            BOOL          TRUE      door closed, channel 2 (DI)
    IN   xLocked             BOOL          TRUE      tongue locked, channel 1 (DI)
    IN   xLocked2            BOOL          TRUE      tongue locked, channel 2 (DI)
    IN   xRequest            BOOL          -         access request button, rising edge
    CFG  tDisc_ms            DINT          500       discrepancy time [ms]
    OUT  xClosedOk           BOOL          -         door closed (both)
    OUT  xLockedOk           BOOL          -         locked (both)
    OUT  xUnlockReq          BOOL          -         unlock request to the F-program
    OUT  xError              BOOL          -         error latched (see alarms)
    OUT  iAlarm              INT           -         local alarm code (0 = none)
  Alarms    : iAlarm = local code a ; Admin.AlarmNo = M*1000 + 10*i + a (decision D2), class per module (D3)
    1  door switch discrepancy
    2  lock switch discrepancy
    3  locked but not closed (tongue missing / manipulation)
  Timing    : Times are counted in calls: n * GC_CYCLE_MS >= t_ms (GC_CYCLE_MS = 100 ms = test bench, TYPES.st).
              In the 10 ms main task set GC_CYCLE_MS := 10 (same behaviour, 10 ms resolution) or replace a counter
              by a TON: ton(IN := <condition>, PT := T#2s); IF ton.Q THEN ... (one call later than the counter).
  Siemens   : SCL (TIA Portal): the same statements; local names are written with '#' (#xRst), the VAR section is
              VAR (STAT) of an FB with an instance DB, R_TRIG / TON are multi-instances, enumerations become INT
              constants (E_DriveState.FAULT -> 9), MIN / LIMIT exist, '16#0080' is written W#16#80 for a WORD.
  NOTICE    : ALL VALUES ARE EXAMPLES. Real PLC code is written, reviewed, tested and signed off by qualified
              people. Safety functions only in the F-program; this FB only reads F-copies and writes no F-signal.
==================================================================================================================*)
FUNCTION_BLOCK FB_DoorLock
VAR_INPUT  (* signals *)
  xClosed : BOOL := TRUE;                   (* door closed, channel 1 (DI) *)
  xClosed2 : BOOL := TRUE;                  (* door closed, channel 2 (DI) *)
  xLocked : BOOL := TRUE;                   (* tongue locked, channel 1 (DI) *)
  xLocked2 : BOOL := TRUE;                  (* tongue locked, channel 2 (DI) *)
  xRequest : BOOL;                          (* access request button, rising edge *)
END_VAR
VAR_INPUT  (* configuration (set once, defaults = example values) *)
  tDisc_ms : DINT := 500;                   (* discrepancy time [ms] *)
END_VAR
VAR_OUTPUT  (* outputs *)
  xClosedOk : BOOL;                         (* door closed (both) *)
  xLockedOk : BOOL;                         (* locked (both) *)
  xUnlockReq : BOOL;                        (* unlock request to the F-program *)
  xError : BOOL;                            (* error latched (see alarms) *)
  iAlarm : INT;                             (* local alarm code (0 = none) *)
END_VAR
VAR  (* internal *)
  rtReq : R_TRIG;                           (* edge of xRequest *)
  xC : BOOL;                                (* closed (both) *)
  xL : BOOL;                                (* locked (both) *)
  nC : DINT;                                (* door pair discrepancy calls *)
  nL : DINT;                                (* lock pair discrepancy calls *)
  xWasOpen : BOOL;                          (* door was open during the request *)
END_VAR
rtReq(CLK := xRequest);
xC := xClosed AND xClosed2;
xL := xLocked AND xLocked2;
IF xClosed <> xClosed2 THEN
  nC := MIN(nC + 1, GC_N_MAX);
ELSE
  nC := 0;
END_IF
IF xLocked <> xLocked2 THEN
  nL := MIN(nL + 1, GC_N_MAX);
ELSE
  nL := 0;
END_IF
IF nC * GC_CYCLE_MS >= tDisc_ms THEN
  xError := TRUE;
  iAlarm := 1;                                (* door switch discrepancy *)
ELSIF nL * GC_CYCLE_MS >= tDisc_ms THEN
  xError := TRUE;
  iAlarm := 2;                                (* lock switch discrepancy *)
END_IF
IF xL AND NOT xC AND NOT xError THEN
  xError := TRUE;
  iAlarm := 3;                                (* locked but not closed *)
END_IF
IF rtReq.Q AND xC AND xL THEN
  xUnlockReq := TRUE;
END_IF
IF NOT xClosed AND NOT xClosed2 THEN
  xWasOpen := TRUE;
END_IF
IF xUnlockReq AND xWasOpen AND xC THEN
  xUnlockReq := FALSE;                        (* opened and closed again: request done *)
  xWasOpen := FALSE;
END_IF
xClosedOk := xC;
xLockedOk := xL;
END_FUNCTION_BLOCK
