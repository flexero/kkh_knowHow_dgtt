(*==================================================================================================================
  FB_Estop  -  emergency stop button (2 channels)
  ----------------------------------------------------------------------------------------------------------------
  Library   : FMSE device FB library (item 10A)              Version : 1.0.0 (2026-11-15)
  Rule      : tools/fmse/examples/item10a_examples.json  _rules.fb_library (= FB_Safe2Ch)
  Codegen   : item 8 pattern ESTOP -> st_codegen.py calls this FB (x<Signal> / q<Signal>)
  Purpose   : Wrapper with the item-8 signal names: xOk / xOk2 -> FB_Safe2Ch xCh1 / xCh2.
              Diagnosis and HMI only - the safety function is in the F-program.
  Interface :
    dir  name                type          default   meaning
    IN   xOk                 BOOL          -         e-stop channel 1 F-copy (TRUE = not pressed)
    IN   xOk2                BOOL          -         e-stop channel 2 F-copy (TRUE = not pressed)
    IN   xReset              BOOL          -         fault reset, rising edge
    CFG  tDisc_ms            DINT          500       discrepancy time [ms]
    OUT  xSafe               BOOL          -         closed / free and reset (FB_Safe2Ch.xOk)
    OUT  xResetReq           BOOL          -         waiting for a reset
    OUT  xDiscErr            BOOL          -         discrepancy latched
    OUT  iAlarm              INT           -         local alarm code (0 = none)
  Alarms    : iAlarm = local code a ; Admin.AlarmNo = M*1000 + 10*i + a (decision D2), class per module (D3)
    1  discrepancy
  Timing    : Times are counted in calls: n * GC_CYCLE_MS >= t_ms (GC_CYCLE_MS = 100 ms = test bench, TYPES.st).
              In the 10 ms main task set GC_CYCLE_MS := 10 (same behaviour, 10 ms resolution) or replace a counter
              by a TON: ton(IN := <condition>, PT := T#2s); IF ton.Q THEN ... (one call later than the counter).
  Siemens   : SCL (TIA Portal): the same statements; local names are written with '#' (#xRst), the VAR section is
              VAR (STAT) of an FB with an instance DB, R_TRIG / TON are multi-instances, enumerations become INT
              constants (E_DriveState.FAULT -> 9), MIN / LIMIT exist, '16#0080' is written W#16#80 for a WORD.
  NOTICE    : ALL VALUES ARE EXAMPLES. Real PLC code is written, reviewed, tested and signed off by qualified
              people. Safety functions only in the F-program; this FB only reads F-copies and writes no F-signal.
==================================================================================================================*)
FUNCTION_BLOCK FB_Estop
VAR_INPUT  (* signals *)
  xOk : BOOL;                               (* e-stop channel 1 F-copy (TRUE = not pressed) *)
  xOk2 : BOOL;                              (* e-stop channel 2 F-copy (TRUE = not pressed) *)
  xReset : BOOL;                            (* fault reset, rising edge *)
END_VAR
VAR_INPUT  (* configuration (set once, defaults = example values) *)
  tDisc_ms : DINT := 500;                   (* discrepancy time [ms] *)
END_VAR
VAR_OUTPUT  (* outputs *)
  xSafe : BOOL;                             (* closed / free and reset (FB_Safe2Ch.xOk) *)
  xResetReq : BOOL;                         (* waiting for a reset *)
  xDiscErr : BOOL;                          (* discrepancy latched *)
  iAlarm : INT;                             (* local alarm code (0 = none) *)
END_VAR
VAR  (* internal *)
  fbCh : FB_Safe2Ch;                        (* 2-channel mirror *)
END_VAR
fbCh(xCh1 := xOk, xCh2 := xOk2, xReset := xReset, tDisc_ms := tDisc_ms);
xSafe := fbCh.xOk;
xResetReq := fbCh.xResetReq;
xDiscErr := fbCh.xDiscErr;
iAlarm := fbCh.iAlarm;
END_FUNCTION_BLOCK
