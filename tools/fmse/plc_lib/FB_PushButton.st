(*==================================================================================================================
  FB_PushButton  -  illuminated push-button
  ----------------------------------------------------------------------------------------------------------------
  Library   : FMSE device FB library (item 10A)              Version : 1.0.0 (2026-11-15)
  Rule      : tools/fmse/examples/item10a_examples.json  _rules.FB_PushButton
  Codegen   : item 8 pattern PUSHBUTTON -> st_codegen.py calls this FB (x<Signal> / q<Signal>)
  Purpose   : Push-button with lamp: lamp off / on / flashing 1 Hz, pressed level and one-call click pulse.
  Interface :
    dir  name                type          default   meaning
    IN   xPb                 BOOL          -         push-button contact (DI)
    IN   iLampMode           INT           -         0 off, 1 on, 2 flashing
    OUT  qLamp               BOOL          -         lamp (DO)
    OUT  xPressed            BOOL          -         button pressed
    OUT  xClick              BOOL          -         rising edge, one call
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
FUNCTION_BLOCK FB_PushButton
VAR_INPUT  (* signals *)
  xPb : BOOL;                               (* push-button contact (DI) *)
  iLampMode : INT;                          (* 0 off, 1 on, 2 flashing *)
END_VAR
VAR_OUTPUT  (* outputs *)
  qLamp : BOOL;                             (* lamp (DO) *)
  xPressed : BOOL;                          (* button pressed *)
  xClick : BOOL;                            (* rising edge, one call *)
END_VAR
VAR  (* internal *)
  nBlink : DINT;                            (* blink counter 0 .. 2*nHalf-1 *)
  nHalf : DINT;                             (* calls per half period *)
  xBlink : BOOL;                            (* 1 Hz blink, TRUE in the first half *)
  rtPb : R_TRIG;                            (* edge of xPb *)
END_VAR
nHalf := GC_BLINK_HALF_MS / GC_CYCLE_MS;     (* 5 calls at 100 ms = 1 Hz *)
xBlink := nBlink < nHalf;
nBlink := (nBlink + 1) MOD (2 * nHalf);
qLamp := (iLampMode = 1) OR ((iLampMode = 2) AND xBlink);
rtPb(CLK := xPb);
xClick := rtPb.Q;
xPressed := xPb;
END_FUNCTION_BLOCK
