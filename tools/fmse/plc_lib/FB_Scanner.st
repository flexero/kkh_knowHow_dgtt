(*==================================================================================================================
  FB_Scanner  -  safety laser scanner: field-set switching and OSSD mirror
  ----------------------------------------------------------------------------------------------------------------
  Library   : FMSE device FB library (item 10A)              Version : 1.0.0 (2026-11-15)
  Rule      : tools/fmse/examples/item10a_examples.json  _rules.FB_Scanner
  Codegen   : item 8 pattern SCANNER -> st_codegen.py calls this FB (x<Signal> / q<Signal>)
  Purpose   : The standard program selects the field set (the scanner checks the combination); the OSSD pair
              and the warning field are mirrored for diagnosis and HMI.
  Interface :
    dir  name                type          default   meaning
    IN   xOssd1              BOOL          -         OSSD 1 F-copy (TRUE = free)
    IN   xOssd2              BOOL          -         OSSD 2 F-copy (TRUE = free)
    IN   xWarn               BOOL          -         warning field interrupted (DI)
    IN   iField              INT           1         field set 1 = A, 2 = B
    OUT  qFieldA             BOOL          -         field set A select (DO)
    OUT  qFieldB             BOOL          -         field set B select (DO)
    OUT  xFree               BOOL          -         protective field free
    OUT  xWarnOut            BOOL          -         warning field interrupted
    OUT  iAlarm              INT           -         local alarm code (0 = none)
  Alarms    : iAlarm = local code a ; Admin.AlarmNo = M*1000 + 10*i + a (decision D2), class per module (D3)
    2  invalid field set
  Timing    : Times are counted in calls: n * GC_CYCLE_MS >= t_ms (GC_CYCLE_MS = 100 ms = test bench, TYPES.st).
              In the 10 ms main task set GC_CYCLE_MS := 10 (same behaviour, 10 ms resolution) or replace a counter
              by a TON: ton(IN := <condition>, PT := T#2s); IF ton.Q THEN ... (one call later than the counter).
  Siemens   : SCL (TIA Portal): the same statements; local names are written with '#' (#xRst), the VAR section is
              VAR (STAT) of an FB with an instance DB, R_TRIG / TON are multi-instances, enumerations become INT
              constants (E_DriveState.FAULT -> 9), MIN / LIMIT exist, '16#0080' is written W#16#80 for a WORD.
  NOTICE    : ALL VALUES ARE EXAMPLES. Real PLC code is written, reviewed, tested and signed off by qualified
              people. Safety functions only in the F-program; this FB only reads F-copies and writes no F-signal.
==================================================================================================================*)
FUNCTION_BLOCK FB_Scanner
VAR_INPUT  (* signals *)
  xOssd1 : BOOL;                            (* OSSD 1 F-copy (TRUE = free) *)
  xOssd2 : BOOL;                            (* OSSD 2 F-copy (TRUE = free) *)
  xWarn : BOOL;                             (* warning field interrupted (DI) *)
  iField : INT := 1;                        (* field set 1 = A, 2 = B *)
END_VAR
VAR_OUTPUT  (* outputs *)
  qFieldA : BOOL;                           (* field set A select (DO) *)
  qFieldB : BOOL;                           (* field set B select (DO) *)
  xFree : BOOL;                             (* protective field free *)
  xWarnOut : BOOL;                          (* warning field interrupted *)
  iAlarm : INT;                             (* local alarm code (0 = none) *)
END_VAR
qFieldA := iField = 1;
qFieldB := iField = 2;
xFree := xOssd1 AND xOssd2;
xWarnOut := xWarn;
IF iField = 1 OR iField = 2 THEN
  iAlarm := 0;
ELSE
  iAlarm := 2;                                (* invalid field set *)
END_IF
END_FUNCTION_BLOCK
