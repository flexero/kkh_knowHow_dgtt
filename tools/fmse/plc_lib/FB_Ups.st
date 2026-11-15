(*==================================================================================================================
  FB_Ups  -  24 V DC UPS monitoring with shutdown request
  ----------------------------------------------------------------------------------------------------------------
  Library   : FMSE device FB library (item 10A)              Version : 1.0.0 (2026-11-15)
  Rule      : tools/fmse/examples/item10a_examples.json  _rules.FB_Ups
  Codegen   : item 8 pattern UPS_DC -> st_codegen.py calls this FB (x<Signal> / q<Signal>)
  Purpose   : UPS signals: fault, on battery; after tBuffer_ms on battery the PLC / PC shut down in order.
  Interface :
    dir  name                type          default   meaning
    IN   xUpsOk              BOOL          TRUE      UPS ready / no fault (DI)
    IN   xOnBattery          BOOL          -         mains lost, on battery (DI)
    CFG  tBuffer_ms          DINT          5000      buffer time before shutdown [ms]
    OUT  xShutdownReq        BOOL          -         request an orderly shutdown
    OUT  iAlarm              INT           -         local alarm code (0 = none)
  Alarms    : iAlarm = local code a ; Admin.AlarmNo = M*1000 + 10*i + a (decision D2), class per module (D3)
    1  UPS fault
    2  on battery
  Timing    : Times are counted in calls: n * GC_CYCLE_MS >= t_ms (GC_CYCLE_MS = 100 ms = test bench, TYPES.st).
              In the 10 ms main task set GC_CYCLE_MS := 10 (same behaviour, 10 ms resolution) or replace a counter
              by a TON: ton(IN := <condition>, PT := T#2s); IF ton.Q THEN ... (one call later than the counter).
  Siemens   : SCL (TIA Portal): the same statements; local names are written with '#' (#xRst), the VAR section is
              VAR (STAT) of an FB with an instance DB, R_TRIG / TON are multi-instances, enumerations become INT
              constants (E_DriveState.FAULT -> 9), MIN / LIMIT exist, '16#0080' is written W#16#80 for a WORD.
  NOTICE    : ALL VALUES ARE EXAMPLES. Real PLC code is written, reviewed, tested and signed off by qualified
              people. Safety functions only in the F-program; this FB only reads F-copies and writes no F-signal.
==================================================================================================================*)
FUNCTION_BLOCK FB_Ups
VAR_INPUT  (* signals *)
  xUpsOk : BOOL := TRUE;                    (* UPS ready / no fault (DI) *)
  xOnBattery : BOOL;                        (* mains lost, on battery (DI) *)
END_VAR
VAR_INPUT  (* configuration (set once, defaults = example values) *)
  tBuffer_ms : DINT := 5000;                (* buffer time before shutdown [ms] *)
END_VAR
VAR_OUTPUT  (* outputs *)
  xShutdownReq : BOOL;                      (* request an orderly shutdown *)
  iAlarm : INT;                             (* local alarm code (0 = none) *)
END_VAR
VAR  (* internal *)
  n : DINT;                                 (* calls on battery *)
END_VAR
IF xOnBattery THEN
  n := MIN(n + 1, GC_N_MAX);
ELSE
  n := 0;
END_IF
xShutdownReq := n * GC_CYCLE_MS >= tBuffer_ms;
IF NOT xUpsOk THEN
  iAlarm := 1;                                (* UPS fault *)
ELSIF xOnBattery THEN
  iAlarm := 2;                                (* on battery *)
ELSE
  iAlarm := 0;
END_IF
END_FUNCTION_BLOCK
