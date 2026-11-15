(*==================================================================================================================
  FB_SignalTower  -  signal tower (stack light) and horn per PackML state and alarm class
  ----------------------------------------------------------------------------------------------------------------
  Library   : FMSE device FB library (item 10A)              Version : 1.0.0 (2026-11-15)
  Rule      : tools/fmse/examples/item10a_examples.json  _rules.FB_SignalTower
  Codegen   : item 8 pattern SIGNAL_TOWER -> st_codegen.py calls this FB (x<Signal> / q<Signal>)
  Purpose   : Colours per IEC 60204-1 10.3 / IEC 60073: red = class A alarm or Aborting/Aborted, yellow = class
              B/C or Stopped/Suspended/Held, green = running states, flashing green = Idle/Complete (ready).
              Horn on a new class A/B alarm until acknowledged or no alarm.
  Interface :
    dir  name                type          default   meaning
    IN   iState              INT           2         PackML state number (2 = Stopped)
    IN   iAlarmClass         INT           -         0 none, 1 A, 2 B, 3 C (FB_AlarmMgr)
    IN   xHornAck            BOOL          -         horn acknowledge, rising edge
    OUT  qRed                BOOL          -         red lamp (DO)
    OUT  qYellow             BOOL          -         yellow lamp (DO)
    OUT  qGreen              BOOL          -         green lamp (DO)
    OUT  qBuzzer             BOOL          -         horn (DO)
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
FUNCTION_BLOCK FB_SignalTower
VAR_INPUT  (* signals *)
  iState : INT := 2;                        (* PackML state number (2 = Stopped) *)
  iAlarmClass : INT;                        (* 0 none, 1 A, 2 B, 3 C (FB_AlarmMgr) *)
  xHornAck : BOOL;                          (* horn acknowledge, rising edge *)
END_VAR
VAR_OUTPUT  (* outputs *)
  qRed : BOOL;                              (* red lamp (DO) *)
  qYellow : BOOL;                           (* yellow lamp (DO) *)
  qGreen : BOOL;                            (* green lamp (DO) *)
  qBuzzer : BOOL;                           (* horn (DO) *)
END_VAR
VAR  (* internal *)
  nBlink : DINT;                            (* blink counter 0 .. 2*nHalf-1 *)
  nHalf : DINT;                             (* calls per half period *)
  xBlink : BOOL;                            (* 1 Hz blink, TRUE in the first half *)
  rtAck : R_TRIG;                           (* edge of xHornAck *)
  iPrevClass : INT;                         (* alarm class of the last call *)
  xHorn : BOOL;                             (* horn latch *)
END_VAR
nHalf := GC_BLINK_HALF_MS / GC_CYCLE_MS;     (* 5 calls at 100 ms = 1 Hz *)
xBlink := nBlink < nHalf;
nBlink := (nBlink + 1) MOD (2 * nHalf);
rtAck(CLK := xHornAck);
qRed := (iAlarmClass = E_AlarmClass.A) OR (iState = E_PackMLState.ABORTING) OR (iState = E_PackMLState.ABORTED);
qYellow := (iAlarmClass = E_AlarmClass.B) OR (iAlarmClass = E_AlarmClass.C) OR (iState = E_PackMLState.STOPPED)
           OR (iState = E_PackMLState.SUSPENDED) OR (iState = E_PackMLState.HELD);
CASE iState OF
  E_PackMLState.STARTING, E_PackMLState.EXECUTE, E_PackMLState.UNHOLDING, E_PackMLState.UNSUSPENDING,
  E_PackMLState.COMPLETING:
    qGreen := TRUE;
  E_PackMLState.IDLE, E_PackMLState.COMPLETE:
    qGreen := xBlink;                         (* flashing green = ready, waiting *)
ELSE
  qGreen := FALSE;
END_CASE
IF (iAlarmClass = E_AlarmClass.A OR iAlarmClass = E_AlarmClass.B) AND iAlarmClass <> iPrevClass THEN
  xHorn := TRUE;
END_IF
IF rtAck.Q OR iAlarmClass = E_AlarmClass.NONE THEN
  xHorn := FALSE;
END_IF
iPrevClass := iAlarmClass;
qBuzzer := xHorn;
END_FUNCTION_BLOCK
