(*==================================================================================================================
  FB_DriveSto  -  frequency inverter with safe torque off (STO)
  ----------------------------------------------------------------------------------------------------------------
  Library   : FMSE device FB library (item 10A)              Version : 1.0.0 (2026-11-15)
  Rule      : tools/fmse/examples/item10a_examples.json  _rules.FB_DriveSto
  Codegen   : item 8 pattern VFD_STO -> st_codegen.py calls this FB (x<Signal> / q<Signal>)
  Purpose   : State machine of a drive whose STO is switched by the F-program (the standard program reads the
              F-copy xSto). STO is a normal safety stop, not a drive fault. wCtrl = control word over the bus.
  Interface :
    dir  name                type          default   meaning
    IN   xReady              BOOL          -         drive ready (DI)
    IN   xFault              BOOL          -         drive fault (DI)
    IN   xSto                BOOL          TRUE      F-copy: TRUE = torque off
    IN   xCmdRun             BOOL          -         run command from the sequence
    IN   xReset              BOOL          -         fault reset, rising edge
    OUT  wCtrl               WORD          -         bit0 enable, bit1 run, bit7 fault ack
    OUT  iState              INT           -         0 not ready, 1 ready, 2 running, 9 fault
    OUT  xWarn               BOOL          -         run requested while torque off
    OUT  xError              BOOL          -         error latched (see alarms)
    OUT  iAlarm              INT           -         local alarm code (0 = none)
  Alarms    : iAlarm = local code a ; Admin.AlarmNo = M*1000 + 10*i + a (decision D2), class per module (D3)
    1  drive fault
    3  ready lost while running
  Timing    : Times are counted in calls: n * GC_CYCLE_MS >= t_ms (GC_CYCLE_MS = 100 ms = test bench, TYPES.st).
              In the 10 ms main task set GC_CYCLE_MS := 10 (same behaviour, 10 ms resolution) or replace a counter
              by a TON: ton(IN := <condition>, PT := T#2s); IF ton.Q THEN ... (one call later than the counter).
  Siemens   : SCL (TIA Portal): the same statements; local names are written with '#' (#xRst), the VAR section is
              VAR (STAT) of an FB with an instance DB, R_TRIG / TON are multi-instances, enumerations become INT
              constants (E_DriveState.FAULT -> 9), MIN / LIMIT exist, '16#0080' is written W#16#80 for a WORD.
  NOTICE    : ALL VALUES ARE EXAMPLES. Real PLC code is written, reviewed, tested and signed off by qualified
              people. Safety functions only in the F-program; this FB only reads F-copies and writes no F-signal.
==================================================================================================================*)
FUNCTION_BLOCK FB_DriveSto
VAR_INPUT  (* signals *)
  xReady : BOOL;                            (* drive ready (DI) *)
  xFault : BOOL;                            (* drive fault (DI) *)
  xSto : BOOL := TRUE;                      (* F-copy: TRUE = torque off *)
  xCmdRun : BOOL;                           (* run command from the sequence *)
  xReset : BOOL;                            (* fault reset, rising edge *)
END_VAR
VAR_OUTPUT  (* outputs *)
  wCtrl : WORD;                             (* bit0 enable, bit1 run, bit7 fault ack *)
  iState : INT;                             (* 0 not ready, 1 ready, 2 running, 9 fault *)
  xWarn : BOOL;                             (* run requested while torque off *)
  xError : BOOL;                            (* error latched (see alarms) *)
  iAlarm : INT;                             (* local alarm code (0 = none) *)
END_VAR
VAR  (* internal *)
  rtReset : R_TRIG;                         (* edge of xReset *)
  xRst : BOOL;                              (* reset pulse *)
  xAck : BOOL;                              (* fault acknowledge, one call *)
END_VAR
rtReset(CLK := xReset);
xRst := rtReset.Q;
xAck := FALSE;
IF xFault AND iState <> E_DriveState.FAULT THEN
  iState := E_DriveState.FAULT;
  iAlarm := 1;                                (* drive fault *)
ELSE
  CASE iState OF                              (* one transition per call *)
    E_DriveState.NOT_READY:
      IF xReady AND NOT xSto THEN
        iState := E_DriveState.READY;
      END_IF
    E_DriveState.READY:
      IF xSto OR NOT xReady THEN
        iState := E_DriveState.NOT_READY;
      ELSIF xCmdRun THEN
        iState := E_DriveState.RUNNING;
      END_IF
    E_DriveState.RUNNING:
      IF xSto THEN
        iState := E_DriveState.NOT_READY;     (* STO = normal safety stop *)
      ELSIF NOT xReady THEN
        iState := E_DriveState.FAULT;
        iAlarm := 3;                          (* ready lost while running *)
      ELSIF NOT xCmdRun THEN
        iState := E_DriveState.READY;
      END_IF
    E_DriveState.FAULT:
      IF xRst AND NOT xFault THEN
        iState := E_DriveState.NOT_READY;
        iAlarm := 0;
        xAck := TRUE;
      END_IF
  END_CASE
END_IF
xError := iState = E_DriveState.FAULT;
xWarn := xCmdRun AND xSto;
wCtrl := 16#0000;
IF NOT xSto THEN
  wCtrl := wCtrl OR 16#0001;                  (* bit0 ON / enable *)
END_IF
IF iState = E_DriveState.RUNNING THEN
  wCtrl := wCtrl OR 16#0002;                  (* bit1 RUN *)
END_IF
IF xAck THEN
  wCtrl := wCtrl OR 16#0080;                  (* bit7 fault acknowledge *)
END_IF
END_FUNCTION_BLOCK
