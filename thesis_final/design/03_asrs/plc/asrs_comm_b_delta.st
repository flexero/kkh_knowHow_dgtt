(* =====================================================================================================================
   AS/RS =ASRS1, Case B2 - Delta AS300 (AS332P) ON THE CRANE with expansion communication (final thesis item F3,
   guide 60 Part D). ISPSoft IEC 61131-3 ST. Same style as asrs_crane_delta.st (use together with it).

     CPU Ethernet port   factory Modbus TCP server 10.70.20.51:502 over the data light barrier - D0-D449 = register
                         map V1.2b, UNCHANGED (FB_FmsIf_V12 of fmsctl/plc/delta_v12_interface.st)
     card 1 AS-FEN02     2nd Ethernet 192.168.0.1, VLAN 721 -> ground remote I/O (conveyors, scale)   [verify]
     card 2 AS-FCOPM     CANopen master 500 kbit/s -> travel / hoist / fork drives, nodes 1-3, CiA 402 [verify]
     COM1 (built in)     RS-485 Modbus RTU master 19 200 bit/s 8E1 -> slaves 1 energy meter, 2 scale, 3 UPS
     -KF91               external firewall between VLAN 720 and the machine zone (firewall_rules.csv)

   Mirror model: ../asrs_comm.py (class Poller, infeed_weight_check, canopen()). CHANGE BOTH TOGETHER.
   Numbers (comm_report.md): RTU worst round 153 ms, weighing window 34.0 ms; CANopen 12 PDO + SYNC per 10 ms =
   1677 bit = 33.5 % bus load at 500 kbit/s (67.1 % at 250 kbit/s -> not allowed), cable 18 m <= 100 m.

   SAFETY: no PROFIsafe on the Delta AS. E-stop, aisle door, overtravel, SLS/SS1 = safety controller (PL e class) +
   STO hard-wired 2-channel to every drive (item F8). This program only READS the safety status; CANopen and Modbus
   are NOT safety channels.
   NOT COMPILED IN THIS PROJECT. Instruction names / flags of your ISPSoft and firmware version: CHECK. [verify]
   ===================================================================================================================== *)

(* ------------------------------------------------------------------------------------------------------------------
   1  Modbus RTU poller on COM1 - pure ST state machine. The ONLY vendor-specific part is the PORT ADAPTER (section 1b).
   ------------------------------------------------------------------------------------------------------------------ *)
FUNCTION_BLOCK FB_RtuPollerD
VAR_INPUT
    WeighWindow : BOOL;               (* TRUE while the infeed weighs: only slaves with every = 1 *)
    TareReq     : BOOL;               (* rising edge: FC06 reg 10 := 1 to addr 2 *)
    PortDone, PortErr : BOOL;         (* from the port adapter: request finished good / with error *)
    PortErrKind : WORD;               (* 1 timeout, 2 CRC/frame, 3 exception *)
    PortExcCode : WORD;               (* exception code 1..11 when PortErrKind = 3 *)
    Tcycle      : REAL := 0.01;       (* call period [s] *)
END_VAR
VAR_OUTPUT
    PortStart   : BOOL;               (* one-cycle pulse: start the request below *)
    ReqAddr, ReqFc, ReqReg, ReqLen, ReqVal : WORD;
    RoundCnt    : DWORD;
    LastRoundMs : REAL;
END_VAR
VAR_IN_OUT
    (* slave table, index 1..3 = addr 1 meter, 2 scale, 3 UPS (comm_data.json) *)
    sAddr, sStart, sN, sEvery : ARRAY[1..3] OF WORD;
    sFails : ARRAY[1..3] OF WORD;
    sOffline, sHasData : ARRAY[1..3] OF BOOL;
    sAgeMs : ARRAY[1..3] OF REAL;      (* time since the last good response *)
    sNOk, sNErr, sNTo, sNCrc, sNExc, sLastExc : ARRAY[1..3] OF WORD;
END_VAR
VAR
    Retries      : WORD := 2;
    OfflineAfter : WORD := 3;
    ProbeEvery   : WORD := 50;
    stp, i, attempt, maxTry, k : WORD;
    due, tareOld, wPend : BOOL;
    tRound : REAL;
END_VAR
    FOR k := 1 TO 3 DO sAgeMs[k] := sAgeMs[k] + Tcycle * 1000.0; END_FOR;
    tRound := tRound + Tcycle * 1000.0;
    IF TareReq AND NOT tareOld THEN wPend := TRUE; END_IF;   (* write queue of depth 1 is enough for the tare *)
    tareOld := TareReq;
    PortStart := FALSE;

    CASE stp OF
    0:  tRound := 0.0; stp := 10;
    10: (* (1) acyclic write first, one try, no retry *)
        IF wPend THEN
            ReqAddr := 2; ReqFc := 6; ReqReg := 10; ReqLen := 1; ReqVal := 1; PortStart := TRUE; stp := 11;
        ELSE i := 1; stp := 20; END_IF;
    11: IF PortDone OR PortErr THEN wPend := FALSE; stp := 10; END_IF;
    20: (* (2) select the next due slave *)
        IF i > 3 THEN stp := 40;
        ELSE
            due := FALSE;
            IF WeighWindow AND (sEvery[i] <> 1) THEN due := FALSE;
            ELSIF sOffline[i] THEN due := (RoundCnt MOD ProbeEvery) = 0; maxTry := 1;
            ELSE due := (RoundCnt MOD sEvery[i]) = 0; maxTry := 1 + Retries; END_IF;
            IF due THEN attempt := 0; stp := 21; ELSE i := i + 1; END_IF;
        END_IF;
    21: ReqAddr := sAddr[i]; ReqFc := 3; ReqReg := sStart[i]; ReqLen := sN[i]; PortStart := TRUE;
        attempt := attempt + 1; stp := 22;
    22: IF PortDone THEN
            sHasData[i] := TRUE; sAgeMs[i] := 0.0; sFails[i] := 0; sOffline[i] := FALSE; sNOk[i] := sNOk[i] + 1;
            i := i + 1; stp := 20;
        ELSIF PortErr THEN
            IF PortErrKind = 3 THEN                       (* exception: definite answer, no retry, stays online *)
                sNExc[i] := sNExc[i] + 1; sLastExc[i] := PortExcCode; i := i + 1; stp := 20;
            ELSE
                IF PortErrKind = 1 THEN sNTo[i] := sNTo[i] + 1; ELSE sNCrc[i] := sNCrc[i] + 1; END_IF;
                IF attempt < maxTry THEN stp := 21;
                ELSE
                    sNErr[i] := sNErr[i] + 1; sFails[i] := sFails[i] + 1;
                    IF sFails[i] >= OfflineAfter THEN sOffline[i] := TRUE; END_IF;
                    i := i + 1; stp := 20;
                END_IF;
            END_IF;
        END_IF;
    40: LastRoundMs := tRound; RoundCnt := RoundCnt + 1; stp := 0;
    END_CASE;
END_FUNCTION_BLOCK

(* 1b  PORT ADAPTER (in PRG_CommB below) - Delta AS Modbus RTU master on COM1.
   HWCONFIG > COM1: protocol Modbus RTU master, 19 200 bit/s, 8 data bits, even parity, 1 stop bit (8E1),
   communication timeout 200 ms, retry 0 (the poller does the retries).                                [verify / CHECK]
   Instruction: MODRW (Modbus read/write) - operands: COM port, unit address, function code, slave register, PLC buffer
   (D register), length. Completion and error flags / error code of COM1: see the AS Programming Manual, MODRW section.
   The adapter turns them into PortDone / PortErr / PortErrKind / PortExcCode.                          [CHECK] *)

(* ------------------------------------------------------------------------------------------------------------------
   2  CiA 402 drive state machine (one instance per CANopen node)
   ------------------------------------------------------------------------------------------------------------------ *)
FUNCTION_BLOCK FB_Cia402
VAR_INPUT
    Enable     : BOOL;     (* request operation enabled (safety OK, no STO, axis enabled) *)
    QuickStop  : BOOL;     (* TRUE = quick stop (controlword 16#0002) *)
    FaultReset : BOOL;     (* rising edge resets a drive fault (controlword bit 7) *)
    StatusWord : WORD;     (* object 0x6041 from the TPDO *)
    NodeOk     : BOOL;     (* node state OPERATIONAL + heartbeat OK (AS-FCOPM node status, CHECK) *)
END_VAR
VAR_OUTPUT
    ControlWord : WORD;    (* object 0x6040 to the RPDO *)
    OpEnabled   : BOOL;
    Fault       : BOOL;
    DsState     : WORD;    (* 0 not ready 1 switch-on disabled 2 ready 3 switched on 4 op enabled 5 quick stop 6 fault reaction 7 fault *)
END_VAR
VAR
    resOld : BOOL;
END_VAR
    IF (StatusWord AND 16#004F) = 16#0008 THEN DsState := 7;
    ELSIF (StatusWord AND 16#004F) = 16#000F THEN DsState := 6;
    ELSIF (StatusWord AND 16#004F) = 16#0040 THEN DsState := 1;
    ELSIF (StatusWord AND 16#006F) = 16#0021 THEN DsState := 2;
    ELSIF (StatusWord AND 16#006F) = 16#0023 THEN DsState := 3;
    ELSIF (StatusWord AND 16#006F) = 16#0027 THEN DsState := 4;
    ELSIF (StatusWord AND 16#006F) = 16#0007 THEN DsState := 5;
    ELSE DsState := 0; END_IF;

    CASE DsState OF
    7:  (* fault: 16#0080 on the rising edge of FaultReset (bit 7 must see 0 -> 1) *)
        IF FaultReset AND NOT resOld THEN ControlWord := 16#0080; ELSE ControlWord := 16#0000; END_IF;
    1:  IF Enable THEN ControlWord := 16#0006; ELSE ControlWord := 16#0000; END_IF;     (* shutdown -> ready *)
    2:  IF Enable THEN ControlWord := 16#0007; ELSE ControlWord := 16#0006; END_IF;     (* switch on *)
    3:  IF Enable THEN ControlWord := 16#000F; ELSE ControlWord := 16#0006; END_IF;     (* enable operation *)
    4:  IF NOT Enable THEN ControlWord := 16#0007;                                       (* disable operation *)
        ELSIF QuickStop THEN ControlWord := 16#0002;                                     (* quick stop *)
        ELSE ControlWord := 16#000F; END_IF;
    5:  IF NOT QuickStop THEN ControlWord := 16#0000; ELSE ControlWord := 16#0002; END_IF; (* leave via disable voltage *)
    ELSE ControlWord := 16#0000;
    END_CASE;
    resOld := FaultReset;
    OpEnabled := (DsState = 4) AND NodeOk;
    Fault := (DsState = 7) OR (DsState = 6) OR NOT NodeOk;
END_FUNCTION_BLOCK

(* ------------------------------------------------------------------------------------------------------------------
   3  PRG_CommB - called in the 10 ms timed interrupt task AFTER PRG_Crane
   ------------------------------------------------------------------------------------------------------------------
   CANopen Builder (AS-FCOPM) PDO mapping -> D registers (example addresses, CHECK the builder's mapping table):
     node 1 travel  RPDO1: D25000 controlword 0x6040, D25001 vl target velocity 0x6042 (INT, rpm)
                    TPDO1: D24000 statusword 0x6041, D24001 vl velocity actual 0x6044 (INT, rpm)
     node 2 hoist   RPDO1: D25010 / D25011          TPDO1: D24010 / D24011
     node 3 fork    RPDO1: D25020 / D25021          TPDO1: D24020 / D24021
     modes of operation 0x6060 := 2 (velocity mode vl) by an initial SDO in the builder; heartbeat producer 100 ms,
     consumer 300 ms in the master; SYNC 10 ms. Node status registers of the card -> gNodeOk[1..3].      [verify]
   Scaling (set from the F3 drive design and the drive parameters):  n_motor = v * i * 60 / (pi * D_wheel)   [CHECK]
   ------------------------------------------------------------------------------------------------------------------ *)
PROGRAM PRG_CommB
VAR_EXTERNAL
    iSafetyOk, iDrivesReady : BOOL;                 (* from the safety controller (hard-wired), as in PRG_Crane *)
    qTravelSpeed, qHoistSpeed : REAL;               (* m/s, from PRG_Crane *)
    qTravelEnable, qHoistEnable, qForkLeft, qForkRight, qForkFast : BOOL;
    iTravelFault, iHoistFault, iForkFault : BOOL;   (* written HERE, read by PRG_Crane *)
    gAckAlarm, gInfeedWeighing, gTareReq : BOOL;
    gNodeOk : ARRAY[1..3] OF BOOL;
    cwTravel, cwHoist, cwFork : WORD;               (* D25000 / D25010 / D25020 *)
    vlTravel, vlHoist, vlFork : INT;                (* D25001 / D25011 / D25021 *)
    swTravel, swHoist, swFork : WORD;               (* D24000 / D24010 / D24020 *)
    iInfeedWeightOk : BOOL;                         (* to the infeed contour check (iInfeedContourOk) *)
    gWeightDetail : WORD;                           (* 0 or 23 *)
    rtuBuf : ARRAY[0..29] OF WORD;                  (* MODRW buffer, e.g. D3000-D3029 *)
END_VAR
VAR
    poll : FB_RtuPollerD;
    dTr, dHo, dFo : FB_Cia402;
    sAddr  : ARRAY[1..3] OF WORD := [1, 2, 3];
    sStart : ARRAY[1..3] OF WORD := [0, 0, 0];
    sN     : ARRAY[1..3] OF WORD := [30, 4, 6];
    sEvery : ARRAY[1..3] OF WORD := [10, 1, 5];
    sFails, sNOk, sNErr, sNTo, sNCrc, sNExc, sLastExc : ARRAY[1..3] OF WORD;
    sOffline, sHasData : ARRAY[1..3] OF BOOL;
    sAgeMs : ARRAY[1..3] OF REAL;
    meter : ARRAY[0..29] OF WORD;
    scale : ARRAY[0..3] OF WORD;
    ups   : ARRAY[0..5] OF WORD;
    pDone, pErr, pBusy : BOOL;
    pKind, pExc, k : WORD;
    grossRaw : DINT;
    gross_kg : REAL;
    stable, overload, valid : BOOL;
    kTravel : REAL := 483.3;   (* rpm per m/s - EXAMPLE 1450 rpm at 3.0 m/s; CHECK from the drive design *)
    kHoist  : REAL := 1450.0;  (* rpm per m/s - EXAMPLE 1450 rpm at 1.0 m/s; CHECK *)
    nForkFast : INT := 1450;   (* rpm fast / slow fork - CHECK *)
    nForkSlow : INT := 300;
END_VAR
    (* ---- port adapter (CHECK - replace by the MODRW call and the COM1 flags of your firmware) *)
    (*   IF poll.PortStart THEN start MODRW(COM1, poll.ReqAddr, poll.ReqFc, poll.ReqReg, rtuBuf / poll.ReqVal, poll.ReqLen) *)
    (*   pDone := <COM1 complete flag> AND NOT <COM1 error flag>;  pErr := <COM1 error flag>;                              *)
    (*   pKind := 1 timeout / 2 CRC-frame / 3 exception from <COM1 error code>;  pExc := exception code                    *)
    poll(WeighWindow := gInfeedWeighing, TareReq := gTareReq, PortDone := pDone, PortErr := pErr,
         PortErrKind := pKind, PortExcCode := pExc, Tcycle := 0.01,
         sAddr := sAddr, sStart := sStart, sN := sN, sEvery := sEvery, sFails := sFails, sOffline := sOffline,
         sHasData := sHasData, sAgeMs := sAgeMs, sNOk := sNOk, sNErr := sNErr, sNTo := sNTo, sNCrc := sNCrc,
         sNExc := sNExc, sLastExc := sLastExc);
    (* copy a good read into the slave image (the adapter reports which slave answered: poll.ReqAddr) *)
    IF pDone AND (poll.ReqFc = 3) THEN
        IF poll.ReqAddr = 1 THEN FOR k := 0 TO 29 DO meter[k] := rtuBuf[k]; END_FOR;
        ELSIF poll.ReqAddr = 2 THEN FOR k := 0 TO 3 DO scale[k] := rtuBuf[k]; END_FOR;
        ELSIF poll.ReqAddr = 3 THEN FOR k := 0 TO 5 DO ups[k] := rtuBuf[k]; END_FOR; END_IF;
    END_IF;

    (* ---- weight check = infeed_weight_check() of asrs_comm.py: valid = online, data, age <= 1000 ms *)
    valid := NOT sOffline[2] AND sHasData[2] AND (sAgeMs[2] <= 1000.0);
    grossRaw := DWORD_TO_DINT(SHL(WORD_TO_DWORD(scale[0]), 16) OR WORD_TO_DWORD(scale[1]));   (* CHECK SHL syntax *)
    gross_kg := DINT_TO_REAL(grossRaw) / 10.0;
    stable := (scale[2] AND 16#0001) <> 0;
    overload := (scale[2] AND 16#0002) <> 0;
    IF NOT valid THEN iInfeedWeightOk := FALSE; gWeightDetail := 23;               (* NO_DATA *)
    ELSIF overload OR (gross_kg > 300.0) THEN iInfeedWeightOk := FALSE; gWeightDetail := 23;   (* OVERWEIGHT *)
    ELSIF NOT stable THEN iInfeedWeightOk := FALSE; gWeightDetail := 0;            (* WAIT_STABLE *)
    ELSE iInfeedWeightOk := TRUE; gWeightDetail := 0; END_IF;

    (* ---- CANopen drives (CiA 402 velocity mode). STO is hard-wired: Enable only when the safety controller is OK *)
    dTr(Enable := qTravelEnable AND iSafetyOk AND iDrivesReady, QuickStop := NOT iSafetyOk, FaultReset := gAckAlarm,
        StatusWord := swTravel, NodeOk := gNodeOk[1]);
    dHo(Enable := qHoistEnable AND iSafetyOk AND iDrivesReady, QuickStop := NOT iSafetyOk, FaultReset := gAckAlarm,
        StatusWord := swHoist, NodeOk := gNodeOk[2]);
    dFo(Enable := iSafetyOk AND iDrivesReady, QuickStop := NOT iSafetyOk, FaultReset := gAckAlarm,
        StatusWord := swFork, NodeOk := gNodeOk[3]);
    cwTravel := dTr.ControlWord; cwHoist := dHo.ControlWord; cwFork := dFo.ControlWord;
    IF dTr.OpEnabled THEN vlTravel := REAL_TO_INT(qTravelSpeed * kTravel); ELSE vlTravel := 0; END_IF;
    IF dHo.OpEnabled THEN vlHoist := REAL_TO_INT(qHoistSpeed * kHoist); ELSE vlHoist := 0; END_IF;
    IF dFo.OpEnabled AND qForkLeft THEN
        IF qForkFast THEN vlFork := -nForkFast; ELSE vlFork := -nForkSlow; END_IF;
    ELSIF dFo.OpEnabled AND qForkRight THEN
        IF qForkFast THEN vlFork := nForkFast; ELSE vlFork := nForkSlow; END_IF;
    ELSE vlFork := 0; END_IF;
    (* drive fault or lost node -> the axis FB in PRG_Crane gets DriveFault -> FAULT state, detail 32 / 33 *)
    iTravelFault := dTr.Fault; iHoistFault := dHo.Fault; iForkFault := dFo.Fault;

    (* ---- hoist brake: released by the drive's brake control output only in "operation enabled" (drive parameter,
            CHECK) - qHoistBrakeRelease of PRG_Crane stays as the permission. *)
    (* ---- factory link: built-in Modbus TCP server of the CPU port, D0-D449 = V1.2b - nothing to program here. *)
END_PROGRAM
