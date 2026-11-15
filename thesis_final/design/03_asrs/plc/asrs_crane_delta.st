(* =====================================================================================================================
   Stacker crane ASRS-RAW (one aisle, RAW + KIT zones) - Delta AS series (AS300 / AS332T-A), ISPSoft IEC 61131-3 ST
   Final thesis item F3 - port of plc/asrs_crane.scl (same states, same detail codes, same interlocks) - mirror model
   ../asrs_sim.py. Contract: fmsctl/spec/regmap.py map V1.2b.

   USE TOGETHER WITH fmsctl/plc/delta_v12_interface.st (FB_FmsIf_V12: handshake, sequence guard, watchdog, events,
   job result). Call it with TypeCode := 7, AllowedCmds := 16#C0000010 (4, 30, 31), AllowedCmdsHi := 16#00000003 (32, 33).

   Memory plan (as in the interface template):
     D0 - D449      register image V1.2b (Modbus holding registers) - D300 - D309 AS/RS status, D402 - D409 job parameters
     D1040 - D1059  job parameters LATCHED by FB_FmsIf_V12 (D1042 = register 402 ... D1049 = register 409)
     D1200 - D1299  crane work registers (this file)
   Positioning on the Delta AS: travel and hoist drives (e.g. Delta MS300 / C2000+) with speed setpoint over EtherCAT or
   CANopen, positions from the laser distance meter / barcode positioning system (SSI or Ethernet module) - scaled to m.
   The simple profile generator of FB_AxisD replaces the S7 FB_Axis; CHECK the timer block names and REAL functions of
   your ISPSoft version (TON, SQRT, ABS, MIN, MAX). Call PRG_Crane from a 10 ms timed interrupt task (Tcycle = 0.01 s).

   SAFETY: emergency stop, aisle door, overtravel, safe speed = safety relay / safety controller + drive STO (item F8).
   This program only reads their status.  ALL VALUES ARE DESIGN VALUES - NOT COMPILED IN THIS PROJECT.
   ===================================================================================================================== *)

FUNCTION FC_AsrsCoordD : BOOL
VAR_INPUT
    col, lev, side : WORD;
END_VAR
VAR_IN_OUT
    x_m, z_m : REAL;
END_VAR
VAR
    bay, k : WORD;
END_VAR
    IF (col < 1) OR (col > 38) OR (lev < 1) OR (lev > 10) OR (side < 1) OR (side > 2) THEN
        x_m := 0.0; z_m := 0.0; FC_AsrsCoordD := FALSE;
    ELSE
        bay := (col + 1) / 2;
        k := (col - 1) MOD 2;
        x_m := 1.2 + 0.1 + WORD_TO_REAL(bay - 1) * 1.925 + 0.475 + WORD_TO_REAL(k) * 0.875;
        z_m := 0.45 + WORD_TO_REAL(lev - 1) * 1.25;
        FC_AsrsCoordD := TRUE;
    END_IF;
END_FUNCTION

FUNCTION_BLOCK FB_AxisD
(* point-to-point positioning, same profile as FB_Axis of the S7 version *)
VAR_INPUT
    Enable, Execute, QuickStop : BOOL;
    Target, VMax, AMax, Window, PosMin, PosMax, ActPos : REAL;
    PosValid, DriveFault : BOOL;
    Tcycle : REAL := 0.01;
END_VAR
VAR_OUTPUT
    SpeedSet : REAL;
    Busy, Done, Error : BOOL;
    ErrCode : WORD;            (* 1 timeout 2 following error 3 sensor 4 drive fault 5 target out of range *)
END_VAR
VAR
    exeOld : BOOL;
    tgt, vProf, pProf, tMove, tLimit, rem, dir, vT, dv, dist : REAL;
    settle : TON;
END_VAR
    IF DriveFault THEN Error := TRUE; ErrCode := 4; END_IF;
    IF Busy AND NOT PosValid THEN Error := TRUE; ErrCode := 3; END_IF;
    IF Execute AND NOT exeOld THEN
        IF (Target < PosMin) OR (Target > PosMax) THEN
            Error := TRUE; ErrCode := 5;
        ELSIF NOT Error THEN
            tgt := Target; pProf := ActPos; vProf := 0.0; tMove := 0.0;
            dist := ABS(Target - ActPos);
            IF dist >= VMax * VMax / AMax THEN tLimit := 1.5 * (dist / VMax + VMax / AMax) + 5.0;
            ELSE tLimit := 1.5 * 2.0 * SQRT(dist / AMax) + 5.0; END_IF;
            Busy := TRUE; Done := FALSE;
        END_IF;
    END_IF;
    exeOld := Execute;
    IF Busy AND Enable AND NOT QuickStop AND NOT Error THEN
        rem := tgt - ActPos;
        IF rem >= 0.0 THEN dir := 1.0; ELSE dir := -1.0; END_IF;
        vT := MIN(VMax, SQRT(2.0 * AMax * MAX(ABS(rem) - 0.005, 0.0)));
        vT := MAX(vT, 0.03);
        IF ABS(rem) <= Window THEN vT := 0.0; END_IF;
        dv := dir * vT - vProf;
        IF dv > AMax * Tcycle THEN dv := AMax * Tcycle; END_IF;
        IF dv < -AMax * Tcycle THEN dv := -AMax * Tcycle; END_IF;
        vProf := vProf + dv;
        pProf := pProf + vProf * Tcycle;
        tMove := tMove + Tcycle;
        IF (ABS(pProf - ActPos) > 0.10) AND (ABS(rem) > 0.10) THEN Error := TRUE; ErrCode := 2; END_IF;
        IF tMove > tLimit THEN Error := TRUE; ErrCode := 1; END_IF;
        settle(IN := (ABS(rem) <= Window) AND (ABS(vProf) < 0.01), PT := T#200MS);
        IF settle.Q THEN Busy := FALSE; Done := TRUE; vProf := 0.0; END_IF;
    ELSE
        IF vProf > 0.0 THEN vProf := MAX(vProf - 1.5 * Tcycle, 0.0); ELSIF vProf < 0.0 THEN vProf := MIN(vProf + 1.5 * Tcycle, 0.0); END_IF;
        IF NOT Enable OR QuickStop OR Error THEN Busy := FALSE; END_IF;
        settle(IN := FALSE, PT := T#200MS);
    END_IF;
    IF Error AND NOT Enable AND NOT DriveFault AND PosValid THEN Error := FALSE; ErrCode := 0; END_IF;
    SpeedSet := vProf;
END_FUNCTION_BLOCK

PROGRAM PRG_Crane
(* --- inputs (X / D addresses in the I/O mapping table, plc/README.md) --- *)
VAR_EXTERNAL
    iSafetyOk, iDoorClosed, iDrivesReady, iAuto, iManual, iMaint : BOOL;
    iLaserX_m, iBpsZ_m, iForkPos_m : REAL;
    iLaserValid, iBpsValid : BOOL;
    iForkCentre, iForkLeftEnd, iForkRightEnd, iForkOverLeft, iForkOverRight : BOOL;
    iLoadOnFork, iSlotOccLeft, iSlotOccRight, iLoadOverhang : BOOL;
    iInfeedLoad, iInfeedContourOk, iOutfeedFree : BOOL;
    iTravelFault, iHoistFault, iForkFault : BOOL;
    qTravelSpeed, qHoistSpeed : REAL;
    qTravelEnable, qHoistEnable, qHoistBrakeRelease, qForkLeft, qForkRight, qForkFast, qInfeedTake, qOutfeedPut, qLampFault : BOOL;
    gNewJob, gAckAlarm : BOOL;          (* latched copies of FB_FmsIf_V12.NewJob / AckAlarm, cleared here *)
    gJobCode : WORD;
    gJobEnd : BOOL;                     (* set here, FB_FmsIf_V12.JobEnd in the main task, then cleared there *)
    gJobResult, gDetail, gState : WORD;
END_VAR
VAR
    axX, axZ : FB_AxisD;
    exeX, exeZ : BOOL;
    tgtX, tgtZ, xx, zz : REAL;
    state, stp : WORD;                  (* 0 OFF 1 HOMING 2 IDLE 3 MOVE_TO_SOURCE 4 PICK 5 MOVE_TO_DEST 6 PUT 7 RETURN
                                           8 FAULT 9 MANUAL 10 MAINTENANCE *)
    code, dCol, dLev, dSide, sCol, sLev, sSide : WORD;
    srcIsIO, dstIsIO, skipPick, jobActive, ok, ilk, forkGo, occ : BOOL;
    forkCmd : WORD;                     (* 0 centre 1 left 2 right *)
    forkTon, outTon : TON;
END_VAR
    ilk := iSafetyOk AND iDoorClosed AND iDrivesReady;
    (* ---- global interlocks *)
    IF NOT ilk AND (state <> 0) AND (state <> 8) AND (state <> 10) THEN
        IF jobActive THEN gJobEnd := TRUE; gJobResult := 2; gDetail := 31; jobActive := FALSE; END_IF;
        gDetail := 31; state := 8;
    END_IF;
    IF (axX.Error OR axZ.Error) AND (state <> 8) AND (state <> 0) THEN
        IF jobActive THEN gJobEnd := TRUE; gJobResult := 2; jobActive := FALSE; END_IF;
        gDetail := 32; state := 8;
    END_IF;
    IF (iForkFault OR NOT iForkOverLeft OR NOT iForkOverRight OR forkTon.Q) AND (state <> 8) AND (state <> 0) THEN
        IF jobActive THEN gJobEnd := TRUE; gJobResult := 2; jobActive := FALSE; END_IF;
        gDetail := 33; state := 8;
    END_IF;

    CASE state OF
    0:  exeX := FALSE; exeZ := FALSE;
        IF ilk THEN state := 1; stp := 0; END_IF;
    1:  (* HOMING: absolute sensors valid + fork centre *)
        IF iLaserValid AND iBpsValid THEN
            forkCmd := 0;
            IF iForkCentre THEN state := 2; gDetail := 0; END_IF;
        END_IF;
    2, 7:
        IF iManual THEN state := 9;
        ELSIF iMaint THEN state := 10;
        ELSIF gNewJob THEN
            gNewJob := FALSE; jobActive := TRUE; gDetail := 0;
            code := gJobCode;
            dCol := D1042; dLev := D1043; dSide := D1044;           (* latched 402 - 404 *)
            sCol := D1045; sLev := D1046; sSide := D1047;           (* latched 405 - 407 (command 32) *)
            IF code = 31 THEN sCol := dCol; sLev := dLev; sSide := dSide; END_IF;
            srcIsIO := (code = 30); dstIsIO := (code = 31);
            skipPick := ((code = 30) AND iLoadOnFork) OR (code = 33);
            exeX := FALSE; exeZ := FALSE; stp := 0;
            IF skipPick THEN state := 5; ELSE state := 3; END_IF;
        ELSIF state = 7 THEN
            IF stp = 0 THEN tgtX := 0.0; tgtZ := 0.55; exeX := TRUE; exeZ := TRUE; stp := 10;
            ELSIF axX.Done AND axZ.Done THEN exeX := FALSE; exeZ := FALSE; state := 2; END_IF;
        END_IF;
    3:  (* MOVE_TO_SOURCE (low pick height) *)
        IF stp = 0 THEN
            IF srcIsIO THEN tgtX := 0.0; tgtZ := 0.55;
            ELSE ok := FC_AsrsCoordD(sCol, sLev, sSide, xx, zz); tgtX := xx; tgtZ := zz - 0.15; END_IF;
            exeX := TRUE; exeZ := TRUE; stp := 10;
        ELSIF axX.Done AND axZ.Done THEN exeX := FALSE; exeZ := FALSE; state := 4; stp := 0; END_IF;
    4:  (* PICK *)
        CASE stp OF
        0:  IF srcIsIO THEN
                IF NOT iInfeedLoad THEN gDetail := 24; stp := 900;
                ELSIF NOT iInfeedContourOk THEN gDetail := 23; stp := 900;
                ELSE qInfeedTake := TRUE; stp := 10; END_IF;
            ELSE
                IF sSide = 1 THEN occ := iSlotOccLeft; ELSE occ := iSlotOccRight; END_IF;
                IF NOT occ THEN gDetail := 22; stp := 900; ELSE stp := 10; END_IF;
            END_IF;
        10: IF srcIsIO THEN forkCmd := 1; ELSE forkCmd := sSide; END_IF; stp := 20;
        20: IF (forkCmd = 1 AND iForkLeftEnd) OR (forkCmd = 2 AND iForkRightEnd) THEN
                tgtZ := tgtZ + 0.15; exeZ := TRUE; stp := 30; END_IF;
        30: IF axZ.Done THEN exeZ := FALSE; forkCmd := 0; stp := 40; END_IF;
        40: IF iForkCentre THEN qInfeedTake := FALSE; stp := 50; END_IF;
        50: IF iLoadOnFork AND NOT iLoadOverhang THEN state := 5; stp := 0; ELSE gDetail := 33; stp := 900; END_IF;
        900: gJobEnd := TRUE; gJobResult := 2; jobActive := FALSE; qInfeedTake := FALSE; state := 8;
        END_CASE;
    5:  (* MOVE_TO_DEST (carry high) *)
        IF stp = 0 THEN
            IF code = 33 THEN tgtX := 0.0; tgtZ := 0.45;
            ELSIF dstIsIO THEN tgtX := 0.0; tgtZ := 0.70;
            ELSE ok := FC_AsrsCoordD(dCol, dLev, dSide, xx, zz); tgtX := xx; tgtZ := zz; END_IF;
            exeX := TRUE; exeZ := TRUE; stp := 10;
        ELSIF axX.Done AND axZ.Done THEN
            exeX := FALSE; exeZ := FALSE; stp := 0;
            IF code = 33 THEN gJobEnd := TRUE; gJobResult := 0; jobActive := FALSE; state := 2; ELSE state := 6; END_IF;
        END_IF;
    6:  (* PUT with double-occupancy check *)
        CASE stp OF
        0:  IF dstIsIO THEN
                outTon(IN := NOT iOutfeedFree, PT := T#60S);
                IF iOutfeedFree THEN stp := 10; ELSIF outTon.Q THEN gDetail := 24; stp := 900; END_IF;
            ELSE
                IF dSide = 1 THEN occ := iSlotOccLeft; ELSE occ := iSlotOccRight; END_IF;
                IF occ THEN gDetail := 21; stp := 900; ELSE stp := 10; END_IF;
            END_IF;
        10: IF dstIsIO THEN forkCmd := 2; ELSE forkCmd := dSide; END_IF; stp := 20;
        20: IF (forkCmd = 1 AND iForkLeftEnd) OR (forkCmd = 2 AND iForkRightEnd) THEN
                tgtZ := tgtZ - 0.15; exeZ := TRUE; stp := 30; END_IF;
        30: IF axZ.Done THEN exeZ := FALSE; forkCmd := 0; stp := 40; END_IF;
        40: IF iForkCentre THEN stp := 50; END_IF;
        50: IF NOT iLoadOnFork THEN
                qOutfeedPut := dstIsIO; gJobEnd := TRUE; gJobResult := 0; jobActive := FALSE; state := 7; stp := 0;
            ELSE gDetail := 33; stp := 900; END_IF;
        900: gJobEnd := TRUE; gJobResult := 2; jobActive := FALSE; state := 8;
        END_CASE;
    8:  (* FAULT *)
        exeX := FALSE; exeZ := FALSE; forkCmd := 0; qInfeedTake := FALSE;
        IF gAckAlarm THEN
            gAckAlarm := FALSE;
            IF ilk AND NOT axX.Error AND NOT axZ.Error AND NOT iForkFault THEN gDetail := 0; state := 1; stp := 0; END_IF;
        END_IF;
    9:  exeX := FALSE; exeZ := FALSE;
        IF NOT iManual THEN state := 1; END_IF;
    10: exeX := FALSE; exeZ := FALSE;
        IF NOT iMaint THEN state := 0; END_IF;
    END_CASE;
    IF state <> 6 THEN qOutfeedPut := FALSE; END_IF;

    (* ---- axes; never travel with the fork extended *)
    IF NOT iForkCentre AND (state <> 4) AND (state <> 6) AND (state <> 1) THEN exeX := FALSE; exeZ := FALSE; END_IF;
    axX(Enable := ilk AND (state <> 8) AND (state <> 10), Execute := exeX, QuickStop := NOT ilk, Target := tgtX,
        VMax := 3.0, AMax := 0.5, Window := 0.003, PosMin := 0.0, PosMax := 37.875, ActPos := iLaserX_m,
        PosValid := iLaserValid, DriveFault := iTravelFault);
    axZ(Enable := ilk AND (state <> 8) AND (state <> 10), Execute := exeZ, QuickStop := NOT ilk, Target := tgtZ,
        VMax := 1.0, AMax := 0.5, Window := 0.002, PosMin := 0.30, PosMax := 11.90, ActPos := iBpsZ_m,
        PosValid := iBpsValid, DriveFault := iHoistFault);
    (* ---- fork: two speeds from the motor encoder, end sensors confirm *)
    forkGo := ilk AND (state <> 8) AND NOT axX.Busy AND NOT axZ.Busy;
    qForkLeft := forkGo AND (forkCmd = 1 AND NOT iForkLeftEnd OR forkCmd = 0 AND NOT iForkCentre AND iForkPos_m > 0.0);
    qForkRight := forkGo AND (forkCmd = 2 AND NOT iForkRightEnd OR forkCmd = 0 AND NOT iForkCentre AND iForkPos_m < 0.0);
    qForkFast := (qForkLeft OR qForkRight) AND (ABS(iForkPos_m) > 0.10) AND (ABS(iForkPos_m) < 1.25);
    forkTon(IN := qForkLeft OR qForkRight, PT := T#8S);
    qTravelSpeed := axX.SpeedSet; qHoistSpeed := axZ.SpeedSet;
    qTravelEnable := ilk AND (state <> 8) AND (state <> 10) AND (state <> 0);
    qHoistEnable := qTravelEnable;
    qHoistBrakeRelease := qHoistEnable AND axZ.Busy;
    qLampFault := (state = 8);
    gState := state;
    (* D300 - D309 (type registers) are written in the main task from gState / gDetail / positions - see README *)
END_PROGRAM
