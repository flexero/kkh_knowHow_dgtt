(*==================================================================================================================
  TYPES  -  enumerations and global constants of the FMSE device FB library
  ----------------------------------------------------------------------------------------------------------------
  Library   : FMSE device FB library (item 10A)              Version : 1.0.0 (2026-11-15)
  Rule      : tools/fmse/examples/item10a_examples.json  _rules.common, decisions D1 - D4
  Purpose   : one place for the state numbers (PackML item 5, device FBs), alarm classes and the time base.
              Load this file FIRST. Enumerations are used qualified (E_DriveState.FAULT); in CODESYS add
              the pragma attribute 'qualified_only', in TIA Portal use INT constants with the same values.
  Timing    : GC_CYCLE_MS = time base of the call counters of every FB. 100 = test bench (one call per
              100 ms tick). In the 10 ms main task set 10 - every time in ms stays the same.
  NOTICE    : ALL VALUES ARE EXAMPLES. Real PLC code is written, reviewed, tested and signed off by qualified
              people. Safety functions only in the F-program.
==================================================================================================================*)
TYPE
  E_AlarmClass : (NONE := 0, A := 1, B := 2, C := 3) INT;          (* decision D3 *)
  E_Reaction : (NONE := 0, ABORT := 1, HOLD := 2, WARNING := 3) INT;
  E_AlarmEvent : (NONE := 0, RAISE := 1, CLEAR := 2) INT;
  E_PackMLState : (UNDEFINED := 0, CLEARING := 1, STOPPED := 2, STARTING := 3, IDLE := 4, SUSPENDED := 5,
                   EXECUTE := 6, STOPPING := 7, ABORTING := 8, ABORTED := 9, HOLDING := 10, HELD := 11,
                   UNHOLDING := 12, SUSPENDING := 13, UNSUSPENDING := 14, RESETTING := 15, COMPLETING := 16,
                   COMPLETE := 17) INT;                             (* item 5, PackML / ISA-TR88 *)
  E_PackMLCmd : (NONE := 0, RESET := 1, START := 2, STOP := 3, HOLD := 4, UNHOLD := 5, SUSPEND := 6,
                 UNSUSPEND := 7, ABORT := 8, CLEAR := 9) INT;
  E_Mode : (UNDEFINED := 0, PRODUCTION := 1, MAINTENANCE := 2, MANUAL := 3) INT;
  E_DriveState : (NOT_READY := 0, READY := 1, RUNNING := 2, FAULT := 9) INT;
  E_MotorState : (STOPPED := 0, STARTING := 1, RUNNING := 2, STOPPING := 3, FAULT := 9) INT;
  E_HsStep : (IDLE := 0, REQUEST := 10, BUSY := 20, DONE := 30) INT;
  E_Quality : (GOOD := 0, UNCERTAIN := 1, BAD := 2) INT;             (* NAMUR NE 43 *)
  E_AiStatus : (OK := 0, FAULT_LOW := 1, UNDER_RANGE := 2, OVER_RANGE := 3, FAULT_HIGH := 4) INT;
END_TYPE

VAR_GLOBAL CONSTANT
  GC_CYCLE_MS : DINT := 100;                  (* time base of the call counters [ms] *)
  GC_N_MAX : DINT := 1000000;                 (* counters stop here (no overflow, 27 h at 100 ms) *)
  GC_BLINK_HALF_MS : DINT := 500;             (* half period of the 1 Hz blink [ms] *)
  GC_LIB_VERSION : WORD := 16#0100;           (* library version 1.0.0 *)
END_VAR
