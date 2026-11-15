(*==================================================================================================================
  FB_SafeValve  -  redundant safety valve pair with position feedback
  ----------------------------------------------------------------------------------------------------------------
  Library   : FMSE device FB library (item 10A)              Version : 1.0.0 (2026-11-15)
  Rule      : tools/fmse/examples/item10a_examples.json  _rules.fb_library (= 2 x FB_Edm, bInverted FALSE)
  Codegen   : item 8 pattern SAFE_VALVE -> st_codegen.py calls this FB (x<Signal> / q<Signal>)
  Purpose   : Item 8 SAFE_VALVE: two valves (F-outputs ValveA / ValveB written only by the F-program), each
              with a position switch TRUE = open; FB_Edm with bInverted FALSE checks that each follows.
  Interface :
    dir  name                type          default   meaning
    IN   xCmdA               BOOL          -         F-copy of the F-output ValveA
    IN   xCmdB               BOOL          -         F-copy of the F-output ValveB
    IN   xFbA                BOOL          -         valve A open (DI)
    IN   xFbB                BOOL          -         valve B open (DI)
    IN   xReset              BOOL          -         fault reset, rising edge
    CFG  tEdm_ms             DINT          300       feedback time [ms]
    OUT  xOnA                BOOL          -         valve A open and feedback ok
    OUT  xOnB                BOOL          -         valve B open and feedback ok
    OUT  xError              BOOL          -         error latched (see alarms)
    OUT  iAlarm              INT           -         local alarm code (0 = none)
  Alarms    : iAlarm = local code a ; Admin.AlarmNo = M*1000 + 10*i + a (decision D2), class per module (D3)
    1  valve A feedback does not follow
    2  valve B feedback does not follow
  Timing    : Times are counted in calls: n * GC_CYCLE_MS >= t_ms (GC_CYCLE_MS = 100 ms = test bench, TYPES.st).
              In the 10 ms main task set GC_CYCLE_MS := 10 (same behaviour, 10 ms resolution) or replace a counter
              by a TON: ton(IN := <condition>, PT := T#2s); IF ton.Q THEN ... (one call later than the counter).
  Siemens   : SCL (TIA Portal): the same statements; local names are written with '#' (#xRst), the VAR section is
              VAR (STAT) of an FB with an instance DB, R_TRIG / TON are multi-instances, enumerations become INT
              constants (E_DriveState.FAULT -> 9), MIN / LIMIT exist, '16#0080' is written W#16#80 for a WORD.
  NOTICE    : ALL VALUES ARE EXAMPLES. Real PLC code is written, reviewed, tested and signed off by qualified
              people. Safety functions only in the F-program; this FB only reads F-copies and writes no F-signal.
==================================================================================================================*)
FUNCTION_BLOCK FB_SafeValve
VAR_INPUT  (* signals *)
  xCmdA : BOOL;                             (* F-copy of the F-output ValveA *)
  xCmdB : BOOL;                             (* F-copy of the F-output ValveB *)
  xFbA : BOOL;                              (* valve A open (DI) *)
  xFbB : BOOL;                              (* valve B open (DI) *)
  xReset : BOOL;                            (* fault reset, rising edge *)
END_VAR
VAR_INPUT  (* configuration (set once, defaults = example values) *)
  tEdm_ms : DINT := 300;                    (* feedback time [ms] *)
END_VAR
VAR_OUTPUT  (* outputs *)
  xOnA : BOOL;                              (* valve A open and feedback ok *)
  xOnB : BOOL;                              (* valve B open and feedback ok *)
  xError : BOOL;                            (* error latched (see alarms) *)
  iAlarm : INT;                             (* local alarm code (0 = none) *)
END_VAR
VAR  (* internal *)
  fbA : FB_Edm;                             (* EDM valve A *)
  fbB : FB_Edm;                             (* EDM valve B *)
END_VAR
fbA(xCmd := xCmdA, xFb := xFbA, xReset := xReset, tEdm_ms := tEdm_ms, bInverted := FALSE);
fbB(xCmd := xCmdB, xFb := xFbB, xReset := xReset, tEdm_ms := tEdm_ms, bInverted := FALSE);
xOnA := fbA.xOn;
xOnB := fbB.xOn;
xError := fbA.xError OR fbB.xError;
IF fbA.xError THEN
  iAlarm := 1;                                (* valve A feedback *)
ELSIF fbB.xError THEN
  iAlarm := 2;                                (* valve B feedback *)
ELSE
  iAlarm := 0;
END_IF
END_FUNCTION_BLOCK
