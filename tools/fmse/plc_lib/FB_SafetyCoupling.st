(*==================================================================================================================
  FB_SafetyCoupling  -  safety coupling to the neighbour module (e-stop in + zone free)
  ----------------------------------------------------------------------------------------------------------------
  Library   : FMSE device FB library (item 10A)              Version : 1.0.0 (2026-11-15)
  Rule      : tools/fmse/examples/item10a_examples.json  _rules.fb_library (= 2 x FB_Safe2Ch)
  Codegen   : item 8 pattern COUPLING -> st_codegen.py calls this FB (x<Signal> / q<Signal>)
  Purpose   : Item 8 COUPLING: one FB_Safe2Ch for the e-stop chain coming in, one for the zone-free signal of
              the neighbour. The outputs EstopOut / EnableOut are F-outputs written only by the F-program.
  Interface :
    dir  name                type          default   meaning
    IN   xEstopIn            BOOL          -         e-stop in channel 1 F-copy
    IN   xEstopIn2           BOOL          -         e-stop in channel 2 F-copy
    IN   xZoneFree           BOOL          -         zone free channel 1 F-copy
    IN   xZoneFree2          BOOL          -         zone free channel 2 F-copy
    IN   xReset              BOOL          -         fault reset, rising edge
    CFG  tDisc_ms            DINT          500       discrepancy time [ms]
    OUT  xEstopOk            BOOL          -         e-stop chain closed and reset
    OUT  xZoneOk             BOOL          -         neighbour zone free and reset
    OUT  xResetReq           BOOL          -         one of the two waits for a reset
    OUT  xDiscErr            BOOL          -         discrepancy in one of the two
    OUT  iAlarm              INT           -         local alarm code (0 = none)
  Alarms    : iAlarm = local code a ; Admin.AlarmNo = M*1000 + 10*i + a (decision D2), class per module (D3)
    1  e-stop coupling discrepancy
    2  zone-free coupling discrepancy
  Timing    : Times are counted in calls: n * GC_CYCLE_MS >= t_ms (GC_CYCLE_MS = 100 ms = test bench, TYPES.st).
              In the 10 ms main task set GC_CYCLE_MS := 10 (same behaviour, 10 ms resolution) or replace a counter
              by a TON: ton(IN := <condition>, PT := T#2s); IF ton.Q THEN ... (one call later than the counter).
  Siemens   : SCL (TIA Portal): the same statements; local names are written with '#' (#xRst), the VAR section is
              VAR (STAT) of an FB with an instance DB, R_TRIG / TON are multi-instances, enumerations become INT
              constants (E_DriveState.FAULT -> 9), MIN / LIMIT exist, '16#0080' is written W#16#80 for a WORD.
  NOTICE    : ALL VALUES ARE EXAMPLES. Real PLC code is written, reviewed, tested and signed off by qualified
              people. Safety functions only in the F-program; this FB only reads F-copies and writes no F-signal.
==================================================================================================================*)
FUNCTION_BLOCK FB_SafetyCoupling
VAR_INPUT  (* signals *)
  xEstopIn : BOOL;                          (* e-stop in channel 1 F-copy *)
  xEstopIn2 : BOOL;                         (* e-stop in channel 2 F-copy *)
  xZoneFree : BOOL;                         (* zone free channel 1 F-copy *)
  xZoneFree2 : BOOL;                        (* zone free channel 2 F-copy *)
  xReset : BOOL;                            (* fault reset, rising edge *)
END_VAR
VAR_INPUT  (* configuration (set once, defaults = example values) *)
  tDisc_ms : DINT := 500;                   (* discrepancy time [ms] *)
END_VAR
VAR_OUTPUT  (* outputs *)
  xEstopOk : BOOL;                          (* e-stop chain closed and reset *)
  xZoneOk : BOOL;                           (* neighbour zone free and reset *)
  xResetReq : BOOL;                         (* one of the two waits for a reset *)
  xDiscErr : BOOL;                          (* discrepancy in one of the two *)
  iAlarm : INT;                             (* local alarm code (0 = none) *)
END_VAR
VAR  (* internal *)
  fbEstop : FB_Safe2Ch;                     (* e-stop in *)
  fbZone : FB_Safe2Ch;                      (* zone free *)
END_VAR
fbEstop(xCh1 := xEstopIn, xCh2 := xEstopIn2, xReset := xReset, tDisc_ms := tDisc_ms);
fbZone(xCh1 := xZoneFree, xCh2 := xZoneFree2, xReset := xReset, tDisc_ms := tDisc_ms);
xEstopOk := fbEstop.xOk;
xZoneOk := fbZone.xOk;
xResetReq := fbEstop.xResetReq OR fbZone.xResetReq;
xDiscErr := fbEstop.xDiscErr OR fbZone.xDiscErr;
IF fbEstop.xDiscErr THEN
  iAlarm := 1;                                (* e-stop coupling discrepancy *)
ELSIF fbZone.xDiscErr THEN
  iAlarm := 2;                                (* zone-free coupling discrepancy *)
ELSE
  iAlarm := 0;
END_IF
END_FUNCTION_BLOCK
