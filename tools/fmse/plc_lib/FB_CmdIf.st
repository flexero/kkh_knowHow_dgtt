(*==================================================================================================================
  FB_CmdIf  -  command interface of the module data block (4-phase echo, decision D1)
  ----------------------------------------------------------------------------------------------------------------
  Library   : FMSE device FB library (item 10A)              Version : 1.0.0 (2026-11-15)
  Rule      : tools/fmse/examples/item10a_examples.json  _rules.FB_CmdIf
  Purpose   : The cell controller writes CntrlCmd + sets CmdChangeRequest in ONE FC16 write. On the rising edge
              the module evaluates the command (F_CmdAllowed) -> CmdAck (Status.Bits bit8, iCmdExec one call
              for the PackML core) or CmdRej (bit9; the module sets Admin.WarningNo = M*1000 + 900 + command).
              The CC clears the request, then the module clears the echo. One writer per word, no command twice.
  Interface :
    dir  name                type          default   meaning
    IN   iCntrlCmd           INT           -         data block word CntrlCmd (written by the CC)
    IN   xCmdChangeRequest   BOOL          -         word 3 bit0 (written by the CC)
    IN   iState              INT           2         PackML state of the module
    IN   iMode               INT           1         mode of the module
    OUT  xCmdAck             BOOL          -         echo: accepted (Status.Bits bit8)
    OUT  xCmdRej             BOOL          -         echo: rejected (Status.Bits bit9)
    OUT  iCmdExec            INT           -         command to execute, one call (0 = none)
    OUT  iLastCmd            INT           -         last evaluated command
    OUT  iRejectCount        INT           -         rejected commands
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
FUNCTION_BLOCK FB_CmdIf
VAR_INPUT  (* signals *)
  iCntrlCmd : INT;                          (* data block word CntrlCmd (written by the CC) *)
  xCmdChangeRequest : BOOL;                 (* word 3 bit0 (written by the CC) *)
  iState : INT := 2;                        (* PackML state of the module *)
  iMode : INT := 1;                         (* mode of the module *)
END_VAR
VAR_OUTPUT  (* outputs *)
  xCmdAck : BOOL;                           (* echo: accepted (Status.Bits bit8) *)
  xCmdRej : BOOL;                           (* echo: rejected (Status.Bits bit9) *)
  iCmdExec : INT;                           (* command to execute, one call (0 = none) *)
  iLastCmd : INT;                           (* last evaluated command *)
  iRejectCount : INT;                       (* rejected commands *)
END_VAR
VAR  (* internal *)
  rtReq : R_TRIG;                           (* edge of xCmdChangeRequest *)
END_VAR
rtReq(CLK := xCmdChangeRequest);
iCmdExec := 0;
IF rtReq.Q THEN
  iLastCmd := iCntrlCmd;
  IF F_CmdAllowed(iCmd := iCntrlCmd, iState := iState, iMode := iMode) THEN
    xCmdAck := TRUE;
    iCmdExec := iCntrlCmd;
  ELSE
    xCmdRej := TRUE;
    iRejectCount := iRejectCount + 1;
  END_IF
END_IF
IF NOT xCmdChangeRequest THEN                 (* phase 4: the CC has cleared the request *)
  xCmdAck := FALSE;
  xCmdRej := FALSE;
END_IF
END_FUNCTION_BLOCK
