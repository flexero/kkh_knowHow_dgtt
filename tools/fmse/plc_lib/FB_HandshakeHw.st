(*==================================================================================================================
  FB_HandshakeHw  -  requester side of the hard-wired 4-phase handshake
  ----------------------------------------------------------------------------------------------------------------
  Library   : FMSE device FB library (item 10A)              Version : 1.0.0 (2026-11-15)
  Rule      : tools/fmse/examples/item10a_examples.json  _rules.FB_HandshakeHw
  Codegen   : item 8 pattern HANDSHAKE_HW -> st_codegen.py calls this FB (x<Signal> / q<Signal>)
  Purpose   : Item 8 HANDSHAKE_HW / item 6 logic: Request + Enable -> partner Busy -> partner Done -> Ack ->
              partner removes Done -> finished (xDoneOut one call). Time-outs per phase, partner fault, reset.
  Interface :
    dir  name                type          default   meaning
    IN   xReady              BOOL          -         partner ready (DI)
    IN   xBusy               BOOL          -         partner busy (DI)
    IN   xDone               BOOL          -         partner done (DI)
    IN   xFault              BOOL          -         partner fault (DI)
    IN   xStart              BOOL          -         start a job (sequence)
    IN   xReset              BOOL          -         fault reset, rising edge
    CFG  tHs_ms              DINT          2000      handshake phase time-out [ms]
    CFG  tJob_ms             DINT          10000     job time-out [ms]
    OUT  qRequest            BOOL          -         request to the partner (DO)
    OUT  qAck                BOOL          -         acknowledge to the partner (DO)
    OUT  qEnable             BOOL          -         enable to the partner (DO)
    OUT  qReset              BOOL          -         fault reset to the partner, one call (DO)
    OUT  iStep               INT           -         0 idle, 10 request, 20 busy, 30 done
    OUT  xDoneOut            BOOL          -         job finished, one call
    OUT  xError              BOOL          -         error latched (see alarms)
    OUT  iAlarm              INT           -         local alarm code (0 = none)
  Alarms    : iAlarm = local code a ; Admin.AlarmNo = M*1000 + 10*i + a (decision D2), class per module (D3)
    1  partner did not start (busy missing)
    2  job time-out
    3  done not removed
    4  partner fault
  Timing    : Times are counted in calls: n * GC_CYCLE_MS >= t_ms (GC_CYCLE_MS = 100 ms = test bench, TYPES.st).
              In the 10 ms main task set GC_CYCLE_MS := 10 (same behaviour, 10 ms resolution) or replace a counter
              by a TON: ton(IN := <condition>, PT := T#2s); IF ton.Q THEN ... (one call later than the counter).
  Siemens   : SCL (TIA Portal): the same statements; local names are written with '#' (#xRst), the VAR section is
              VAR (STAT) of an FB with an instance DB, R_TRIG / TON are multi-instances, enumerations become INT
              constants (E_DriveState.FAULT -> 9), MIN / LIMIT exist, '16#0080' is written W#16#80 for a WORD.
  NOTICE    : ALL VALUES ARE EXAMPLES. Real PLC code is written, reviewed, tested and signed off by qualified
              people. Safety functions only in the F-program; this FB only reads F-copies and writes no F-signal.
==================================================================================================================*)
FUNCTION_BLOCK FB_HandshakeHw
VAR_INPUT  (* signals *)
  xReady : BOOL;                            (* partner ready (DI) *)
  xBusy : BOOL;                             (* partner busy (DI) *)
  xDone : BOOL;                             (* partner done (DI) *)
  xFault : BOOL;                            (* partner fault (DI) *)
  xStart : BOOL;                            (* start a job (sequence) *)
  xReset : BOOL;                            (* fault reset, rising edge *)
END_VAR
VAR_INPUT  (* configuration (set once, defaults = example values) *)
  tHs_ms : DINT := 2000;                    (* handshake phase time-out [ms] *)
  tJob_ms : DINT := 10000;                  (* job time-out [ms] *)
END_VAR
VAR_OUTPUT  (* outputs *)
  qRequest : BOOL;                          (* request to the partner (DO) *)
  qAck : BOOL;                              (* acknowledge to the partner (DO) *)
  qEnable : BOOL;                           (* enable to the partner (DO) *)
  qReset : BOOL;                            (* fault reset to the partner, one call (DO) *)
  iStep : INT;                              (* 0 idle, 10 request, 20 busy, 30 done *)
  xDoneOut : BOOL;                          (* job finished, one call *)
  xError : BOOL;                            (* error latched (see alarms) *)
  iAlarm : INT;                             (* local alarm code (0 = none) *)
END_VAR
VAR  (* internal *)
  rtReset : R_TRIG;                         (* edge of xReset *)
  xRst : BOOL;                              (* reset pulse *)
  n : DINT;                                 (* calls in the step *)
END_VAR
rtReset(CLK := xReset);
xRst := rtReset.Q;
qReset := xRst;
xDoneOut := FALSE;
IF xError THEN
  IF xRst AND NOT xFault THEN
    xError := FALSE;
    iAlarm := 0;
    iStep := E_HsStep.IDLE;
  END_IF
ELSIF xFault AND iStep <> E_HsStep.IDLE THEN
  xError := TRUE;
  iAlarm := 4;                                (* partner fault *)
ELSE
  CASE iStep OF
    E_HsStep.IDLE:
      IF xStart AND xReady THEN
        iStep := E_HsStep.REQUEST;
        n := 0;
      END_IF
    E_HsStep.REQUEST:
      n := MIN(n + 1, GC_N_MAX);
      IF xBusy THEN
        iStep := E_HsStep.BUSY;
        n := 0;
      ELSIF n * GC_CYCLE_MS >= tHs_ms THEN
        xError := TRUE;
        iAlarm := 1;                          (* partner did not start *)
      END_IF
    E_HsStep.BUSY:
      n := MIN(n + 1, GC_N_MAX);
      IF xDone THEN
        iStep := E_HsStep.DONE;
        n := 0;
      ELSIF n * GC_CYCLE_MS >= tJob_ms THEN
        xError := TRUE;
        iAlarm := 2;                          (* job time-out *)
      END_IF
    E_HsStep.DONE:
      n := MIN(n + 1, GC_N_MAX);
      IF NOT xDone THEN
        iStep := E_HsStep.IDLE;
        xDoneOut := TRUE;
      ELSIF n * GC_CYCLE_MS >= tHs_ms THEN
        xError := TRUE;
        iAlarm := 3;                          (* done not removed *)
      END_IF
  END_CASE
END_IF
qRequest := (iStep = E_HsStep.REQUEST OR iStep = E_HsStep.BUSY) AND NOT xError;
qEnable := qRequest;
qAck := iStep = E_HsStep.DONE AND NOT xError;
END_FUNCTION_BLOCK
