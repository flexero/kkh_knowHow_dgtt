(*==================================================================================================================
  FB_LimitAlarm  -  H / L limit alarm with on-delay and hysteresis (item 9)
  ----------------------------------------------------------------------------------------------------------------
  Library   : FMSE device FB library (item 10A)              Version : 1.0.0 (2026-11-15)
  Rule      : tools/fmse/examples/item10a_examples.json  item9_examples.json _rules.limits
  Purpose   : H alarm ON after iDelay consecutive calls with rValue >= rH, OFF at once when rValue < rH - rHyst;
              L alarm ON after iDelay calls with rValue <= rL, OFF when rValue > rL + rHyst.
  Interface :
    dir  name                type          default   meaning
    IN   rValue              REAL          -         process value (FB_AnalogIn.rValue)
    CFG  rH                  REAL          8.0       high limit
    CFG  rL                  REAL          3.0       low limit
    CFG  rHyst               REAL          0.2       hysteresis
    CFG  iDelay              INT           2         on-delay [calls]
    OUT  xH                  BOOL          -         high alarm
    OUT  xL                  BOOL          -         low alarm
  Alarms    : iAlarm = local code a ; Admin.AlarmNo = M*1000 + 10*i + a (decision D2), class per module (D3)
    none
  Timing    : Times are counted in calls: n * GC_CYCLE_MS >= t_ms (GC_CYCLE_MS = 100 ms = test bench, TYPES.st).
              In the 10 ms main task set GC_CYCLE_MS := 10 (same behaviour, 10 ms resolution) or replace a counter
              by a TON: ton(IN := <condition>, PT := T#2s); IF ton.Q THEN ... (one call later than the counter).
  Siemens   : SCL (TIA Portal): the same statements; local names are written with '#' (#xRst), the VAR section is
              VAR (STAT) of an FB with an instance DB, R_TRIG / TON are multi-instances, enumerations become INT
              constants (E_DriveState.FAULT -> 9), MIN / LIMIT exist, '16#0080' is written W#16#80 for a WORD.
  Note      : the counters count CALLS (samples), not milliseconds - one call per sample (item 9: 1 sample/s).
  NOTICE    : ALL VALUES ARE EXAMPLES. Real PLC code is written, reviewed, tested and signed off by qualified
              people. Safety functions only in the F-program; this FB only reads F-copies and writes no F-signal.
==================================================================================================================*)
FUNCTION_BLOCK FB_LimitAlarm
VAR_INPUT  (* signals *)
  rValue : REAL;                            (* process value (FB_AnalogIn.rValue) *)
END_VAR
VAR_INPUT  (* configuration (set once, defaults = example values) *)
  rH : REAL := 8.0;                         (* high limit *)
  rL : REAL := 3.0;                         (* low limit *)
  rHyst : REAL := 0.2;                      (* hysteresis *)
  iDelay : INT := 2;                        (* on-delay [calls] *)
END_VAR
VAR_OUTPUT  (* outputs *)
  xH : BOOL;                                (* high alarm *)
  xL : BOOL;                                (* low alarm *)
END_VAR
VAR  (* internal *)
  nH : DINT;                                (* consecutive calls >= rH *)
  nL : DINT;                                (* consecutive calls <= rL *)
END_VAR
IF rValue >= rH THEN
  nH := MIN(nH + 1, GC_N_MAX);
ELSE
  nH := 0;
END_IF
IF rValue <= rL THEN
  nL := MIN(nL + 1, GC_N_MAX);
ELSE
  nL := 0;
END_IF
IF NOT xH AND nH >= iDelay THEN
  xH := TRUE;
ELSIF xH AND rValue < rH - rHyst THEN
  xH := FALSE;
END_IF
IF NOT xL AND nL >= iDelay THEN
  xL := TRUE;
ELSIF xL AND rValue > rL + rHyst THEN
  xL := FALSE;
END_IF
END_FUNCTION_BLOCK
