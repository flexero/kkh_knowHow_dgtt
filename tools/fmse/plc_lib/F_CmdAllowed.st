(*==================================================================================================================
  F_CmdAllowed  -  PackML command allowed in this state and mode? (item 5 tables)
  ----------------------------------------------------------------------------------------------------------------
  Library   : FMSE device FB library (item 10A)              Version : 1.0.0 (2026-11-15)
  Rule      : tools/fmse/examples/item10a_examples.json  _rules.FB_CmdIf
  Purpose   : TRUE when the command is in the mode table (1 Production: all 9, 2 Maintenance: without
              Suspend/Unsuspend, 3 Manual: Reset, Start, Stop, Abort, Clear) AND it is a transition of the
              state model: EDGES with the command label, Stop from every state except Stopped / Stopping /
              Aborting / Aborted / Clearing, Abort from every state except Aborting / Aborted.
  Interface :
    dir  name                type          default   meaning
    IN   iCmd                INT           -         command 1 Reset .. 9 Clear
    IN   iState              INT           -         PackML state 1 .. 17
    IN   iMode               INT           -         1 Production, 2 Maintenance, 3 Manual
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
FUNCTION F_CmdAllowed : BOOL
VAR_INPUT  (* signals *)
  iCmd : INT;                               (* command 1 Reset .. 9 Clear *)
  iState : INT;                             (* PackML state 1 .. 17 *)
  iMode : INT;                              (* 1 Production, 2 Maintenance, 3 Manual *)
END_VAR
VAR  (* internal *)
  xInMode : BOOL;                           (* command allowed in the mode *)
END_VAR
F_CmdAllowed := FALSE;
CASE iMode OF
  E_Mode.PRODUCTION:
    xInMode := iCmd >= E_PackMLCmd.RESET AND iCmd <= E_PackMLCmd.CLEAR;
  E_Mode.MAINTENANCE:
    xInMode := (iCmd >= E_PackMLCmd.RESET AND iCmd <= E_PackMLCmd.UNHOLD) OR iCmd = E_PackMLCmd.ABORT
               OR iCmd = E_PackMLCmd.CLEAR;
  E_Mode.MANUAL:
    xInMode := (iCmd >= E_PackMLCmd.RESET AND iCmd <= E_PackMLCmd.STOP) OR iCmd = E_PackMLCmd.ABORT
               OR iCmd = E_PackMLCmd.CLEAR;
ELSE
  xInMode := FALSE;
END_CASE
IF NOT xInMode OR iState < E_PackMLState.CLEARING OR iState > E_PackMLState.COMPLETE THEN
  RETURN;
END_IF
CASE iCmd OF
  E_PackMLCmd.RESET:
    F_CmdAllowed := iState = E_PackMLState.STOPPED OR iState = E_PackMLState.COMPLETE;
  E_PackMLCmd.START:
    F_CmdAllowed := iState = E_PackMLState.IDLE;
  E_PackMLCmd.STOP:
    CASE iState OF
      E_PackMLState.CLEARING, E_PackMLState.STOPPED, E_PackMLState.STOPPING..E_PackMLState.ABORTED:
        F_CmdAllowed := FALSE;
    ELSE
      F_CmdAllowed := TRUE;
    END_CASE
  E_PackMLCmd.HOLD, E_PackMLCmd.SUSPEND:
    F_CmdAllowed := iState = E_PackMLState.EXECUTE;
  E_PackMLCmd.UNHOLD:
    F_CmdAllowed := iState = E_PackMLState.HELD;
  E_PackMLCmd.UNSUSPEND:
    F_CmdAllowed := iState = E_PackMLState.SUSPENDED;
  E_PackMLCmd.ABORT:
    F_CmdAllowed := iState <> E_PackMLState.ABORTING AND iState <> E_PackMLState.ABORTED;
  E_PackMLCmd.CLEAR:
    F_CmdAllowed := iState = E_PackMLState.ABORTED;
END_CASE
END_FUNCTION
