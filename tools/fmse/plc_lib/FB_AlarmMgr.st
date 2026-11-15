(*==================================================================================================================
  FB_AlarmMgr  -  module alarm manager: AlarmNo, WarningNo, class, reaction (D2 + D3)
  ----------------------------------------------------------------------------------------------------------------
  Library   : FMSE device FB library (item 10A)              Version : 1.0.0 (2026-11-15)
  Rule      : tools/fmse/examples/item10a_examples.json  _rules.alarm_manager
  Purpose   : Called once per alarm change (iEvent 1 = on, 2 = off; 0 = only evaluate) with the instance i, the
              local code a and the class of that alarm (class table generated from the library, item 10B).
              Admin.AlarmNo = best active class A/B alarm (A before B, earlier before later), Admin.WarningNo =
              earliest active class C, iAlarmClass for FB_SignalTower, iReaction for the PackML core.
  Interface :
    dir  name                type          default   meaning
    IN   iEvent              INT           -         0 none, 1 alarm on, 2 alarm off
    IN   iInst               INT           -         instance number i (0 = module level)
    IN   iCode               INT           -         local alarm code a (1 .. 9)
    IN   iClass              INT           -         class 1 A, 2 B, 3 C
    CFG  iModule             INT           2         module number M (M02 -> 2)
    OUT  iAlarmNo            INT           -         Admin.AlarmNo = M*1000 + 10*i + a
    OUT  iWarningNo          INT           -         Admin.WarningNo
    OUT  iAlarmClass         INT           -         0 none, 1 A, 2 B, 3 C
    OUT  iReaction           INT           -         0 none, 1 Abort, 2 Hold if Execute, 3 warning
    OUT  iActive             INT           -         number of active alarms
    OUT  xOverflow           BOOL          -         active list full
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
FUNCTION_BLOCK FB_AlarmMgr
VAR_INPUT  (* signals *)
  iEvent : INT;                             (* 0 none, 1 alarm on, 2 alarm off *)
  iInst : INT;                              (* instance number i (0 = module level) *)
  iCode : INT;                              (* local alarm code a (1 .. 9) *)
  iClass : INT;                             (* class 1 A, 2 B, 3 C *)
END_VAR
VAR_INPUT  (* configuration (set once, defaults = example values) *)
  iModule : INT := 2;                       (* module number M (M02 -> 2) *)
END_VAR
VAR_OUTPUT  (* outputs *)
  iAlarmNo : INT;                           (* Admin.AlarmNo = M*1000 + 10*i + a *)
  iWarningNo : INT;                         (* Admin.WarningNo *)
  iAlarmClass : INT;                        (* 0 none, 1 A, 2 B, 3 C *)
  iReaction : INT;                          (* 0 none, 1 Abort, 2 Hold if Execute, 3 warning *)
  iActive : INT;                            (* number of active alarms *)
  xOverflow : BOOL;                         (* active list full *)
END_VAR
VAR CONSTANT  (* constants *)
  MAX_ACT : INT := 32;                      (* size of the active list *)
END_VAR
VAR  (* internal *)
  aiNo : ARRAY[1..MAX_ACT] OF INT;          (* active alarm numbers (0 = free) *)
  aiCls : ARRAY[1..MAX_ACT] OF INT;         (* class of each active alarm *)
  adiOrd : ARRAY[1..MAX_ACT] OF DINT;       (* activation order *)
  diOrder : DINT;                           (* activation counter *)
  iNo : INT;                                (* number of this event *)
  k : INT;                                  (* loop index *)
  iFound : INT;                             (* slot of iNo (0 = not active) *)
  iFree : INT;                              (* first free slot *)
  iBest : INT;                              (* slot of the best A/B alarm *)
  iBestW : INT;                             (* slot of the earliest warning *)
END_VAR
IF iEvent <> E_AlarmEvent.NONE THEN
  iNo := iModule * 1000 + 10 * iInst + iCode;
  iFound := 0;
  iFree := 0;
  FOR k := 1 TO MAX_ACT DO
    IF aiNo[k] = iNo AND iFound = 0 THEN
      iFound := k;
    END_IF
    IF aiNo[k] = 0 AND iFree = 0 THEN
      iFree := k;
    END_IF
  END_FOR
  IF iEvent = E_AlarmEvent.RAISE AND iFound = 0 THEN
    IF iFree > 0 THEN
      diOrder := diOrder + 1;
      aiNo[iFree] := iNo;
      aiCls[iFree] := iClass;
      adiOrd[iFree] := diOrder;
    ELSE
      xOverflow := TRUE;
    END_IF
  ELSIF iEvent = E_AlarmEvent.CLEAR AND iFound > 0 THEN
    aiNo[iFound] := 0;
    aiCls[iFound] := 0;
    adiOrd[iFound] := 0;
  END_IF
END_IF
(* evaluate: best class A/B alarm by (class, activation order), earliest class C warning *)
iBest := 0;
iBestW := 0;
iActive := 0;
FOR k := 1 TO MAX_ACT DO
  IF aiNo[k] <> 0 THEN
    iActive := iActive + 1;
    IF aiCls[k] = E_AlarmClass.A OR aiCls[k] = E_AlarmClass.B THEN
      IF iBest = 0 THEN
        iBest := k;
      ELSIF aiCls[k] < aiCls[iBest] OR (aiCls[k] = aiCls[iBest] AND adiOrd[k] < adiOrd[iBest]) THEN
        iBest := k;
      END_IF
    ELSIF aiCls[k] = E_AlarmClass.C THEN
      IF iBestW = 0 THEN
        iBestW := k;
      ELSIF adiOrd[k] < adiOrd[iBestW] THEN
        iBestW := k;
      END_IF
    END_IF
  END_IF
END_FOR
IF iBest > 0 THEN
  iAlarmNo := aiNo[iBest];
  iAlarmClass := aiCls[iBest];
ELSE
  iAlarmNo := 0;
  IF iBestW > 0 THEN
    iAlarmClass := E_AlarmClass.C;
  ELSE
    iAlarmClass := E_AlarmClass.NONE;
  END_IF
END_IF
IF iBestW > 0 THEN
  iWarningNo := aiNo[iBestW];
ELSE
  iWarningNo := 0;
END_IF
CASE iAlarmClass OF
  E_AlarmClass.A: iReaction := E_Reaction.ABORT;
  E_AlarmClass.B: iReaction := E_Reaction.HOLD;
  E_AlarmClass.C: iReaction := E_Reaction.WARNING;
ELSE
  iReaction := E_Reaction.NONE;
END_CASE
END_FUNCTION_BLOCK
