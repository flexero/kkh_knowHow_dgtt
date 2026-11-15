(*==================================================================================================================
  FB_MotorDol  -  direct-on-line motor with run-feedback supervision (item 9)
  ----------------------------------------------------------------------------------------------------------------
  Library   : FMSE device FB library (item 10A)              Version : 1.0.0 (2026-11-15)
  Rule      : tools/fmse/examples/item10a_examples.json  item9_examples.json _rules.motor
  Codegen   : item 8 pattern DOL -> st_codegen.py calls this FB (x<Signal> / q<Signal>)
  Purpose   : Contactor motor: start on a rising edge of xCmd (no automatic restart), run feedback after start,
              feedback lost while running, motor protection, feedback without command (welded contactor).
              Reset on a rising edge of xReset only when the cause is gone.
  Interface :
    dir  name                type          default   meaning
    IN   xRunFb              BOOL          -         contactor auxiliary contact (DI)
    IN   xTripped            BOOL          -         motor protection tripped (DI)
    IN   xCmd                BOOL          -         run command from the sequence
    IN   xReset              BOOL          -         fault reset, rising edge
    CFG  tFb_ms              DINT          500       feedback time [ms]
    OUT  qRun                BOOL          -         contactor (DO)
    OUT  iState              INT           -         0 stopped, 1 starting, 2 running, 3 stopping, 9 fault
    OUT  xError              BOOL          -         error latched (see alarms)
    OUT  iAlarm              INT           -         local alarm code (0 = none)
  Alarms    : iAlarm = local code a ; Admin.AlarmNo = M*1000 + 10*i + a (decision D2), class per module (D3)
    1  no run feedback after start
    2  run feedback lost while running
    3  motor protection tripped
    4  run feedback without command (contactor welded?)
  Timing    : Times are counted in calls: n * GC_CYCLE_MS >= t_ms (GC_CYCLE_MS = 100 ms = test bench, TYPES.st).
              In the 10 ms main task set GC_CYCLE_MS := 10 (same behaviour, 10 ms resolution) or replace a counter
              by a TON: ton(IN := <condition>, PT := T#2s); IF ton.Q THEN ... (one call later than the counter).
  Siemens   : SCL (TIA Portal): the same statements; local names are written with '#' (#xRst), the VAR section is
              VAR (STAT) of an FB with an instance DB, R_TRIG / TON are multi-instances, enumerations become INT
              constants (E_DriveState.FAULT -> 9), MIN / LIMIT exist, '16#0080' is written W#16#80 for a WORD.
  NOTICE    : ALL VALUES ARE EXAMPLES. Real PLC code is written, reviewed, tested and signed off by qualified
              people. Safety functions only in the F-program; this FB only reads F-copies and writes no F-signal.
==================================================================================================================*)
FUNCTION_BLOCK FB_MotorDol
VAR_INPUT  (* signals *)
  xRunFb : BOOL;                            (* contactor auxiliary contact (DI) *)
  xTripped : BOOL;                          (* motor protection tripped (DI) *)
  xCmd : BOOL;                              (* run command from the sequence *)
  xReset : BOOL;                            (* fault reset, rising edge *)
END_VAR
VAR_INPUT  (* configuration (set once, defaults = example values) *)
  tFb_ms : DINT := 500;                     (* feedback time [ms] *)
END_VAR
VAR_OUTPUT  (* outputs *)
  qRun : BOOL;                              (* contactor (DO) *)
  iState : INT;                             (* 0 stopped, 1 starting, 2 running, 3 stopping, 9 fault *)
  xError : BOOL;                            (* error latched (see alarms) *)
  iAlarm : INT;                             (* local alarm code (0 = none) *)
END_VAR
VAR  (* internal *)
  rtCmd : R_TRIG;                           (* edge of xCmd *)
  rtReset : R_TRIG;                         (* edge of xReset *)
  n : DINT;                                 (* calls in STARTING / STOPPING *)
  nFb : DINT;                               (* calls with feedback while stopped *)
  xEntered : BOOL;                          (* FAULT entered by the trip in this call *)
END_VAR
rtCmd(CLK := xCmd);
rtReset(CLK := xReset);
xEntered := FALSE;
IF xTripped AND iState <> E_MotorState.FAULT THEN
  iState := E_MotorState.FAULT;
  iAlarm := 3;                                (* motor protection tripped *)
  xEntered := TRUE;
END_IF
IF NOT xEntered THEN
  CASE iState OF
    E_MotorState.STOPPED:
      IF xRunFb THEN
        nFb := MIN(nFb + 1, GC_N_MAX);
      ELSE
        nFb := 0;
      END_IF
      IF nFb * GC_CYCLE_MS >= tFb_ms THEN
        iState := E_MotorState.FAULT;
        iAlarm := 4;                          (* feedback without command *)
      ELSIF rtCmd.Q THEN
        iState := E_MotorState.STARTING;
        n := 0;
      END_IF
    E_MotorState.STARTING:
      n := MIN(n + 1, GC_N_MAX);
      IF xRunFb THEN
        iState := E_MotorState.RUNNING;
      ELSIF n * GC_CYCLE_MS >= tFb_ms THEN
        iState := E_MotorState.FAULT;
        iAlarm := 1;                          (* no run feedback after start *)
      END_IF
    E_MotorState.RUNNING:
      IF NOT xCmd THEN
        iState := E_MotorState.STOPPING;
        n := 0;
      ELSIF NOT xRunFb THEN
        iState := E_MotorState.FAULT;
        iAlarm := 2;                          (* run feedback lost while running *)
      END_IF
    E_MotorState.STOPPING:
      n := MIN(n + 1, GC_N_MAX);
      IF NOT xRunFb THEN
        iState := E_MotorState.STOPPED;
        nFb := 0;
      ELSIF n * GC_CYCLE_MS >= tFb_ms THEN
        iState := E_MotorState.FAULT;
        iAlarm := 4;                          (* feedback without command *)
      END_IF
    E_MotorState.FAULT:
      IF rtReset.Q AND NOT xTripped AND NOT (iAlarm = 4 AND xRunFb) THEN
        iState := E_MotorState.STOPPED;
        iAlarm := 0;
        nFb := 0;
      END_IF
  END_CASE
END_IF
qRun := iState = E_MotorState.STARTING OR iState = E_MotorState.RUNNING;
xError := iState = E_MotorState.FAULT;
END_FUNCTION_BLOCK
