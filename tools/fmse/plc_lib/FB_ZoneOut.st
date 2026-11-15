(*==================================================================================================================
  FB_ZoneOut  -  safety zone output (released contactors) with EDM
  ----------------------------------------------------------------------------------------------------------------
  Library   : FMSE device FB library (item 10A)              Version : 1.0.0 (2026-11-15)
  Rule      : tools/fmse/examples/item10a_examples.json  _rules.fb_library (= FB_Edm, bInverted TRUE)
  Codegen   : item 8 pattern ZONE_OUT -> st_codegen.py calls this FB (x<Signal> / q<Signal>)
  Purpose   : Wrapper of FB_Edm with bInverted TRUE. The F-output Release is written only by the F-program;
              xCmd is its read-only F-copy.
  Interface :
    dir  name                type          default   meaning
    IN   xCmd                BOOL          -         F-copy of the F-output Release
    IN   xFb                 BOOL          TRUE      NC mirror contacts in series (DI), TRUE = open
    IN   xReset              BOOL          -         fault reset, rising edge
    CFG  tEdm_ms             DINT          300       feedback time [ms]
    OUT  xOn                 BOOL          -         output on and feedback ok
    OUT  xError              BOOL          -         error latched (see alarms)
    OUT  iAlarm              INT           -         local alarm code (0 = none)
  Alarms    : iAlarm = local code a ; Admin.AlarmNo = M*1000 + 10*i + a (decision D2), class per module (D3)
    1  feedback does not follow (welded / not switching)
  Timing    : Times are counted in calls: n * GC_CYCLE_MS >= t_ms (GC_CYCLE_MS = 100 ms = test bench, TYPES.st).
              In the 10 ms main task set GC_CYCLE_MS := 10 (same behaviour, 10 ms resolution) or replace a counter
              by a TON: ton(IN := <condition>, PT := T#2s); IF ton.Q THEN ... (one call later than the counter).
  Siemens   : SCL (TIA Portal): the same statements; local names are written with '#' (#xRst), the VAR section is
              VAR (STAT) of an FB with an instance DB, R_TRIG / TON are multi-instances, enumerations become INT
              constants (E_DriveState.FAULT -> 9), MIN / LIMIT exist, '16#0080' is written W#16#80 for a WORD.
  NOTICE    : ALL VALUES ARE EXAMPLES. Real PLC code is written, reviewed, tested and signed off by qualified
              people. Safety functions only in the F-program; this FB only reads F-copies and writes no F-signal.
==================================================================================================================*)
FUNCTION_BLOCK FB_ZoneOut
VAR_INPUT  (* signals *)
  xCmd : BOOL;                              (* F-copy of the F-output Release *)
  xFb : BOOL := TRUE;                       (* NC mirror contacts in series (DI), TRUE = open *)
  xReset : BOOL;                            (* fault reset, rising edge *)
END_VAR
VAR_INPUT  (* configuration (set once, defaults = example values) *)
  tEdm_ms : DINT := 300;                    (* feedback time [ms] *)
END_VAR
VAR_OUTPUT  (* outputs *)
  xOn : BOOL;                               (* output on and feedback ok *)
  xError : BOOL;                            (* error latched (see alarms) *)
  iAlarm : INT;                             (* local alarm code (0 = none) *)
END_VAR
VAR  (* internal *)
  fbEdm : FB_Edm;                           (* EDM *)
END_VAR
fbEdm(xCmd := xCmd, xFb := xFb, xReset := xReset, tEdm_ms := tEdm_ms, bInverted := TRUE);
xOn := fbEdm.xOn;
xError := fbEdm.xError;
iAlarm := fbEdm.iAlarm;
END_FUNCTION_BLOCK
