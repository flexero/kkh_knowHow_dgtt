(*==================================================================================================================
  FB_AnalogIn  -  4-20 mA analog input: scaling, NAMUR NE 43 quality, substitute value (item 9)
  ----------------------------------------------------------------------------------------------------------------
  Library   : FMSE device FB library (item 10A)              Version : 1.0.0 (2026-11-15)
  Rule      : tools/fmse/examples/item10a_examples.json  item9_examples.json _rules.analog
  Codegen   : item 8 pattern ANALOG_P, ANALOG_T -> st_codegen.py calls this FB (x<Signal> / q<Signal>)
  Purpose   : raw 0..27648 = 4..20 mA (Siemens-style card scaling - check yours). NE 43: <= 3.6 mA BAD (wire
              break), < 3.8 UNCERTAIN, <= 20.5 GOOD, < 21.0 UNCERTAIN, else BAD. rValue = clamped value for
              GOOD / UNCERTAIN, substitute rLo for BAD (the module must not use a BAD value).
  Interface :
    dir  name                type          default   meaning
    IN   iValue              INT           -         raw value of the card (AI)
    CFG  rLo                 REAL          0.0       value at 4 mA
    CFG  rHi                 REAL          10.0      value at 20 mA
    OUT  rMa                 REAL          -         current [mA]
    OUT  rValueLin           REAL          -         linear value (not clamped)
    OUT  rValue              REAL          -         value to use (clamped / substitute)
    OUT  iQuality            INT           -         0 GOOD, 1 UNCERTAIN, 2 BAD
    OUT  iStatus             INT           -         0 ok, 1 fault low, 2 under, 3 over, 4 fault high
    OUT  xGood               BOOL          -         quality GOOD
    OUT  iAlarm              INT           -         local alarm code (0 = none)
  Alarms    : iAlarm = local code a ; Admin.AlarmNo = M*1000 + 10*i + a (decision D2), class per module (D3)
    3  signal quality bad/uncertain (NAMUR NE 43)
  Timing    : Times are counted in calls: n * GC_CYCLE_MS >= t_ms (GC_CYCLE_MS = 100 ms = test bench, TYPES.st).
              In the 10 ms main task set GC_CYCLE_MS := 10 (same behaviour, 10 ms resolution) or replace a counter
              by a TON: ton(IN := <condition>, PT := T#2s); IF ton.Q THEN ... (one call later than the counter).
  Siemens   : SCL (TIA Portal): the same statements; local names are written with '#' (#xRst), the VAR section is
              VAR (STAT) of an FB with an instance DB, R_TRIG / TON are multi-instances, enumerations become INT
              constants (E_DriveState.FAULT -> 9), MIN / LIMIT exist, '16#0080' is written W#16#80 for a WORD.
  NOTICE    : ALL VALUES ARE EXAMPLES. Real PLC code is written, reviewed, tested and signed off by qualified
              people. Safety functions only in the F-program; this FB only reads F-copies and writes no F-signal.
==================================================================================================================*)
FUNCTION_BLOCK FB_AnalogIn
VAR_INPUT  (* signals *)
  iValue : INT;                             (* raw value of the card (AI) *)
END_VAR
VAR_INPUT  (* configuration (set once, defaults = example values) *)
  rLo : REAL := 0.0;                        (* value at 4 mA *)
  rHi : REAL := 10.0;                       (* value at 20 mA *)
END_VAR
VAR_OUTPUT  (* outputs *)
  rMa : REAL;                               (* current [mA] *)
  rValueLin : REAL;                         (* linear value (not clamped) *)
  rValue : REAL;                            (* value to use (clamped / substitute) *)
  iQuality : INT;                           (* 0 GOOD, 1 UNCERTAIN, 2 BAD *)
  iStatus : INT;                            (* 0 ok, 1 fault low, 2 under, 3 over, 4 fault high *)
  xGood : BOOL;                             (* quality GOOD *)
  iAlarm : INT;                             (* local alarm code (0 = none) *)
END_VAR
rMa := 4.0 + 16.0 * INT_TO_REAL(iValue) / 27648.0;
IF rMa <= 3.6 THEN
  iQuality := E_Quality.BAD;
  iStatus := E_AiStatus.FAULT_LOW;            (* wire break *)
ELSIF rMa < 3.8 THEN
  iQuality := E_Quality.UNCERTAIN;
  iStatus := E_AiStatus.UNDER_RANGE;
ELSIF rMa <= 20.5 THEN
  iQuality := E_Quality.GOOD;
  iStatus := E_AiStatus.OK;
ELSIF rMa < 21.0 THEN
  iQuality := E_Quality.UNCERTAIN;
  iStatus := E_AiStatus.OVER_RANGE;
ELSE
  iQuality := E_Quality.BAD;
  iStatus := E_AiStatus.FAULT_HIGH;
END_IF
rValueLin := rLo + (rHi - rLo) * (rMa - 4.0) / 16.0;
IF iQuality = E_Quality.BAD THEN
  rValue := rLo;                              (* substitute value *)
ELSE
  rValue := LIMIT(rLo, rValueLin, rHi);
END_IF
xGood := iQuality = E_Quality.GOOD;
IF xGood THEN
  iAlarm := 0;
ELSE
  iAlarm := 3;                                (* signal quality bad / uncertain *)
END_IF
END_FUNCTION_BLOCK
