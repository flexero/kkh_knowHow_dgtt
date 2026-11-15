(* =====================================================================================================================
   Standard machine interface - register map V1.2 - Delta AS series (AS300 / AS332T-A), ISPSoft structured text (ST)
   Compressor FMS - guide docs/53_fms_control_system.md, chapter 17 - contract: fmsctl/spec/regmap.py (MAP_VERSION 0x0102)

   Memory plan (CHECK the AS manual: built-in Modbus TCP server, holding register n = D n for the AS series):
     D0    - D449   register image V1.2 (Modbus holding registers 0 - 449)          - NEVER use for anything else
     D1000 - D1099  interface work registers (this POU), D1010 - D1019 in the LATCHED (retentive) range
     D1100 - D1199  values handed over by the machine program (REAL / DWORD, Delta order = LOW word first)
     D2000 -        analog modules, machine program data (guide 47 used D300 for analog values - in map V1.2
                    D300 - D399 is the TYPE block, so move analog values to D2000 and up)
   32-bit rule: Delta keeps a DWORD / REAL with the LOW word in the LOWER register. The map wants the HIGH word first,
   so every 32-bit value is copied word by word, swapped (e.g. D24 := D1105; D25 := D1104;).

   Global symbols the machine program writes (enter them in the global symbol table, addresses as shown):
     gPower_kW      REAL   D1100   electrical power
     gTypeCheck     WORD   D1102   0 OK, 3 bad data - device-type check of the CURRENT job parameters (computed before)
     gJobResult     WORD   D1103   0 OK, 1 NOK, 2 aborted (valid with JobEnd)
   Global REAL symbols used by this POU itself (so that their two words can be copied swapped):
     gLastCycle     REAL   D1016   last cycle time s (latched)
     gJobCycle      REAL   D1022   duration of the last job s
     gEnergyKWh     REAL   D1032   energy kWh for register 102 - 103
   Work registers of this POU:
     D1010/D1011 good counter DWORD (latched) - D1012/D1013 scrap DWORD (latched) - D1014/D1015 energy Wh DWORD (latched)
     D1016/D1017 last cycle s REAL (latched)  - D1020/D1021 ms clock DWORD - D1022/D1023 job cycle s REAL
     D1024/D1025 event counter DWORD          - D1026/D1027 job start ms DWORD - D1028/D1029 cycle start ms DWORD
     D1030/D1031 scratch DWORD                - D1032/D1033 scratch REAL - D1036 last gateway heartbeat
     D1040/D1041 latched job id DWORD         - D1042 - D1049 latched job parameters 402 - 409
     D1050 - D1059 latched job text 410 - 419

   ALL VALUES ARE EXAMPLES. Points marked CHECK depend on the CPU firmware and the ISPSoft version (names of conversion
   functions, IEC timer blocks, direct device access in ST). If a conversion function does not exist in your version,
   use the API instruction with the same effect (DMOV, MOV, DFLT, INT, ...). This source was written for the guide and
   has not been compiled in this project - compile it, then run the FAT test list of guide 53, chapter 21.3.
   ===================================================================================================================== *)

FUNCTION_BLOCK FB_FmsIf_V12

VAR_INPUT
    TypeCode    : WORD;      (* 1 CNC 2 PALLET 3 LOAD 4 STATION 5 TEST 6 AGV 7 ASRS *)
    UnitId      : WORD;      (* 1 *)
    AllowedCmds : DWORD;     (* bit n = command code n known, e.g. CNC 4, 10, 14 = 16#00004410 *)
    AllowedCmdsHi : DWORD := 16#0;  (* V1.2b: bit n = command code 32 + n known (AS/RS 32, 33 = 16#00000003) *)
    ShiftOn     : BOOL;
    AutoMode    : BOOL;
    SetupMode   : BOOL;
    MaintMode   : BOOL;
    InCycle     : BOOL;
    PartDone    : BOOL;      (* ONE-scan pulse per finished piece *)
    PartOk      : BOOL;
    Alarm       : BOOL;
    AlarmCode   : WORD;
    EStopCopy   : BOOL;      (* display copy only - the safety relay does the safety *)
    Blocked     : BOOL;
    Starved     : BOOL;
    JobEnd      : BOOL;      (* ONE-scan pulse: accepted job finished or aborted *)
END_VAR

VAR_OUTPUT
    NewJob      : BOOL;      (* ONE-scan pulse: command >= 10 accepted - parameters latched in D1040 - D1059 *)
    NewCmd      : BOOL;      (* ONE-scan pulse: V1.1 command 1, 2, 3 or 5 accepted *)
    JobCode     : WORD;
    AckAlarm    : BOOL;      (* ONE-scan pulse: command 4 *)
    Busy        : BOOL;
    Ready       : BOOL;
    GwOk        : BOOL;
END_VAR

VAR
    tonClk      : TON;       (* CHECK: IEC TON / TOF in the ISPSoft library of your firmware *)
    tofGw       : TOF;
    msBase      : DWORD;
    msNow       : DWORD;
    msLast      : DWORD;
    lastSecMs   : DWORD;
    dtMs        : DWORD;
    whFrac      : REAL;      (* fraction of 1 Wh not yet booked - keeps small increments (guide 53 ch. 6.6) *)
    whWhole     : DWORD;
    hb          : WORD;
    ackT        : BOOL;
    busyT       : BOOL;
    doneT       : BOOL;
    rejectT     : BOOL;
    inCycleOld  : BOOL;
    firstDone   : BOOL;
    lotDone     : WORD;
    lastState   : WORD;
    st          : WORD;
    sw          : WORD;
    hs          : WORD;
    code        : WORD;
    res         : WORD;
    req         : BOOL;
    good        : DWORD;
    scrap       : DWORD;
    evtCnt      : DWORD;
    jobStart    : DWORD;
    cycStart    : DWORD;
    wh          : DWORD;
    rTmp        : REAL;
    k           : INT;
END_VAR

(* ---------------------------------------------------------------- 0 pulses reset *)
NewJob := FALSE;  NewCmd := FALSE;  AckAlarm := FALSE;

(* ---------------------------------------------------------------- 1 ms clock + heartbeat
   TON restarts every hour; msBase collects the full hours. Loss: about one scan per hour (< 20 ms/h). *)
tonClk(IN := NOT tonClk.Q, PT := T#1h);
IF tonClk.Q THEN
    msBase := msBase + 3600000;                      (* full hour reached: book it, ET is reset in the next call *)
    msNow := msBase;
ELSE
    msNow := msBase + TIME_TO_DWORD(tonClk.ET);      (* CHECK conversion name; ET resolution = timer base *)
END_IF;
IF NOT firstDone THEN
    msLast := msNow;  lastSecMs := msNow;
END_IF;
dtMs := msNow - msLast;
msLast := msNow;
IF (msNow - lastSecMs) >= 1000 THEN
    lastSecMs := lastSecMs + 1000;
    IF hb = 16#FFFF THEN hb := 0; ELSE hb := hb + 1; END_IF;
END_IF;

(* ---------------------------------------------------------------- 2 gateway watchdog: register 226 unchanged 5 s *)
tofGw(IN := (D226 <> D1036), PT := T#5s);
D1036 := D226;
GwOk := tofGw.Q;

(* ---------------------------------------------------------------- 3 state code + status word (priority from top) *)
IF NOT ShiftOn THEN st := 0;
ELSIF Alarm OR EStopCopy THEN st := 4;
ELSIF SetupMode OR MaintMode THEN st := 3;
ELSIF InCycle THEN st := 2;
ELSIF Blocked THEN st := 5;
ELSIF Starved THEN st := 6;
ELSE st := 1;
END_IF;
CASE st OF
    0: sw := 16#0080;      (* bit 7 no shift *)
    1: sw := 16#0002;      (* bit 1 idle *)
    2: sw := 16#0001;      (* bit 0 run *)
    3: sw := 16#0004;      (* bit 2 set-up *)
    4: sw := 16#0008;      (* bit 3 alarm *)
    5: sw := 16#0020;      (* bit 5 blocked *)
    6: sw := 16#0040;      (* bit 6 starved *)
END_CASE;
IF EStopCopy THEN sw := sw OR 16#0010; END_IF;      (* bit 4 e-stop copy *)

(* ---------------------------------------------------------------- 4 event block 104 - 131 *)
IF (st <> lastState) OR NOT firstDone THEN
    evtCnt := evtCnt + 1;
    (* shift ring entries 6..0 -> 7..1 : entry k = D(108+3k) state, D(109+3k) t high, D(110+3k) t low *)
    D129 := D126;  D130 := D127;  D131 := D128;      (* 6 -> 7 *)
    D126 := D123;  D127 := D124;  D128 := D125;      (* 5 -> 6 *)
    D123 := D120;  D124 := D121;  D125 := D122;      (* 4 -> 5 *)
    D120 := D117;  D121 := D118;  D122 := D119;      (* 3 -> 4 *)
    D117 := D114;  D118 := D115;  D119 := D116;      (* 2 -> 3 *)
    D114 := D111;  D115 := D112;  D116 := D113;      (* 1 -> 2 *)
    D111 := D108;  D112 := D109;  D113 := D110;      (* 0 -> 1 *)
    D108 := st;
    D109 := DWORD_TO_WORD(SHR(msNow, 16));           (* time high word *)
    D110 := DWORD_TO_WORD(msNow AND 16#0000FFFF);    (* time low word *)
    D106 := D109;  D107 := D110;                     (* evt.tLast_ms, high word first *)
    lastState := st;
END_IF;
D104 := DWORD_TO_WORD(SHR(evtCnt, 16));
D105 := DWORD_TO_WORD(evtCnt AND 16#0000FFFF);
(* NOTE: after a power cycle evtCnt restarts at 1 - the controller sees the counter go DOWN and re-baselines. *)

(* ---------------------------------------------------------------- 5 counters, cycle time, lot pieces, energy *)
IF InCycle AND NOT inCycleOld THEN cycStart := msNow; END_IF;
inCycleOld := InCycle;
good := WORD_TO_DWORD(D1011) * 65536 + WORD_TO_DWORD(D1010);    (* latched DWORD, Delta low word first *)
scrap := WORD_TO_DWORD(D1013) * 65536 + WORD_TO_DWORD(D1012);
IF PartDone THEN
    IF PartOk THEN good := good + 1; ELSE scrap := scrap + 1; END_IF;
    rTmp := DWORD_TO_REAL(msNow - cycStart) / 1000.0;
    gLastCycle := rTmp;                               (* global REAL symbol at D1016 (latched) - CHECK symbol table *)
    IF busyT AND (lotDone < 16#FFFF) THEN lotDone := lotDone + 1; END_IF;
END_IF;
D1010 := DWORD_TO_WORD(good AND 16#0000FFFF);  D1011 := DWORD_TO_WORD(SHR(good, 16));
D1012 := DWORD_TO_WORD(scrap AND 16#0000FFFF); D1013 := DWORD_TO_WORD(SHR(scrap, 16));
(* energy: book whole Wh into a DWORD, keep the fraction in REAL -> no lost increments *)
whFrac := whFrac + gPower_kW * DWORD_TO_REAL(dtMs) / 3600.0;    (* kW * ms / 3600 = Wh *)
IF whFrac >= 1.0 THEN
    whWhole := REAL_TO_DWORD(TRUNC(whFrac));         (* CHECK: TRUNC / REAL_TO_DWORD numeric conversion *)
    wh := WORD_TO_DWORD(D1015) * 65536 + WORD_TO_DWORD(D1014) + whWhole;
    D1014 := DWORD_TO_WORD(wh AND 16#0000FFFF);  D1015 := DWORD_TO_WORD(SHR(wh, 16));
    whFrac := whFrac - DWORD_TO_REAL(whWhole);
END_IF;

(* ---------------------------------------------------------------- 6 job end (before the handshake, same scan) *)
IF JobEnd AND busyT THEN
    D390 := D1041;  D391 := D1040;                    (* job.idDone := latched job id, high word first *)
    D392 := gJobResult;
    gJobCycle := DWORD_TO_REAL(msNow - jobStart) / 1000.0;   (* global REAL symbol at D1022 *)
    D394 := D1023;  D395 := D1022;                    (* REAL high word first *)
    busyT := FALSE;
    doneT := NOT doneT;
END_IF;

(* ---------------------------------------------------------------- 7 toggle-bit command handshake *)
Ready := ShiftOn AND AutoMode AND NOT SetupMode AND NOT MaintMode AND NOT Alarm AND NOT EStopCopy AND NOT busyT AND GwOk;
req := (D202 AND 16#0001) <> 0;
(* sequence guard (map V1.2a): a toggle with cmd.seq = last acknowledged seq is a stale frame - ignore it *)
IF (req <> ackT) AND firstDone AND (D201 <> D9) THEN
    code := D200;
    IF code > 63 THEN
        res := 1;                                     (* unknown command *)
    ELSIF (code > 31) AND ((SHR(AllowedCmdsHi, WORD_TO_INT(code) - 32) AND 16#00000001) = 0) THEN
        res := 1;                                     (* V1.2b: codes 32 - 63 from AllowedCmdsHi *)
    ELSIF (code <= 31) AND ((SHR(AllowedCmds, WORD_TO_INT(code)) AND 16#00000001) = 0) THEN
        res := 1;                                     (* not a command of this device type *)
    ELSIF code = 4 THEN
        res := 0;  AckAlarm := TRUE;                  (* acknowledge alarm - also while busy *)
    ELSIF busyT THEN
        res := 4;                                     (* busy *)
    ELSIF NOT (ShiftOn AND AutoMode AND NOT SetupMode AND NOT MaintMode AND NOT Alarm AND NOT EStopCopy) THEN
        res := 2;                                     (* not ready *)
    ELSIF gTypeCheck <> 0 THEN
        res := gTypeCheck;                            (* bad data from the device-type check *)
    ELSE
        res := 0;
        JobCode := code;
        IF code >= 10 THEN
            D1040 := D401;  D1041 := D400;            (* latch job id (Delta order: low word in D1040) *)
            D1042 := D402;  D1043 := D403;  D1044 := D404;  D1045 := D405;     (* latch parameters 402 - 409 *)
            D1046 := D406;  D1047 := D407;  D1048 := D408;  D1049 := D409;
            FOR k := 0 TO 9 DO                        (* latch job text 410 - 419 -> D1050 - D1059 *)
                D1050[k] := D410[k];                  (* CHECK: indexed device access syntax (or 10 single moves / BMOV) *)
            END_FOR;
            busyT := TRUE;
            lotDone := 0;
            jobStart := msNow;
            NewJob := TRUE;
        ELSE
            NewCmd := TRUE;                           (* V1.1 commands 1, 2, 3, 5 - see guide 47 *)
        END_IF;
    END_IF;
    D9 := D201;                                       (* hs.ackSeq := cmd.seq *)
    D10 := res;                                       (* hs.result *)
    rejectT := (res <> 0);
    ackT := req;                                      (* ACK := REQ - LAST *)
ELSIF NOT firstDone THEN
    ackT := req;                                      (* after a restart: mirror REQ, never execute an old command *)
END_IF;
Busy := busyT;

(* ---------------------------------------------------------------- 8 write the read-only image every scan *)
D0 := 16#0102;                                        (* map version V1.2 = 258 *)
D1 := TypeCode;
D2 := UnitId;
D3 := hb;
D4 := sw;
IF MaintMode THEN D5 := 3; ELSIF SetupMode THEN D5 := 2; ELSIF AutoMode THEN D5 := 1; ELSE D5 := 0; END_IF;
D6 := st;
D7 := AlarmCode;
hs := 0;
IF ackT THEN hs := hs OR 16#0001; END_IF;
IF busyT THEN hs := hs OR 16#0002; END_IF;
IF doneT THEN hs := hs OR 16#0004; END_IF;
IF rejectT THEN hs := hs OR 16#0008; END_IF;
IF Ready THEN hs := hs OR 16#0010; END_IF;
D8 := hs;
D11 := lotDone;
D20 := D1011;  D21 := D1010;                          (* std.good  UINT32 high word first *)
D22 := D1013;  D23 := D1012;                          (* std.scrap *)
D24 := D1017;  D25 := D1016;                          (* std.lastCycle_s REAL "ABCD" *)
FOR k := 0 TO 9 DO                                    (* std.order 26 - 35 := latched job text *)
    D26[k] := D1050[k];                               (* CHECK indexed access *)
END_FOR;
D100 := D1101;  D101 := D1100;                        (* std.power_kW REAL *)
rTmp := DWORD_TO_REAL(WORD_TO_DWORD(D1015) * 65536 + WORD_TO_DWORD(D1014)) / 1000.0;
gEnergyKWh := rTmp;                                   (* global REAL symbol at D1032 *)
D102 := D1033;  D103 := D1032;                        (* std.energy_kWh REAL *)
(* Reserved registers: the AS server accepts writes to every D - the program clears the reserved ranges every scan *)
FOR k := 0 TO 7 DO D12[k] := 0; END_FOR;              (* 12 - 19 *)
FOR k := 0 TO 53 DO D46[k] := 0; END_FOR;             (* 46 - 99 *)
FOR k := 0 TO 67 DO D132[k] := 0; END_FOR;            (* 132 - 199 *)
FOR k := 0 TO 72 DO D227[k] := 0; END_FOR;            (* 227 - 299 *)
D393 := 0;
FOR k := 0 TO 3 DO D396[k] := 0; END_FOR;             (* 396 - 399 *)

firstDone := TRUE;

END_FUNCTION_BLOCK


(* =====================================================================================================================
   Device-type block example: CNC (type 1) - registers 300 - 345 + type check of commands 10 and 14.
   The CNC values come from the CNC's integrated PLC over the machine's internal link or as hard-wired / Modbus values
   (guide 53 chapter 18). Global symbols (examples): gProgNo D2100, gPalWork D2101, gPalSetup D2102, gToolNo D2103,
   gSpLoad REAL D2104, gFeed D2106, gToolLife D2110 - D2139, gProgOk M2100, gHasApc M2101, gEchoPk D2140,
   gEchoLen REAL D2142, gEchoRad REAL D2144.
   ===================================================================================================================== *)
FUNCTION_BLOCK FB_FmsType_CNC
VAR
    k     : INT;
    pal   : WORD;
    prog  : WORD;
    var_  : WORD;
    qty   : WORD;
END_VAR

D300 := gProgNo;
D301 := gPalWork;
D302 := gPalSetup;
D303 := gToolNo;
D304 := D2105;  D305 := D2104;                        (* spindle load REAL, high word first *)
D306 := gFeed;
D307 := 0;  D308 := 0;  D309 := 0;
FOR k := 0 TO 29 DO
    D310[k] := D2110[k];                              (* pocket 1 - 30 remaining life, 0.1 % - CHECK indexed access *)
END_FOR;
D340 := gEchoPk;  D341 := 0;
D342 := D2143;  D343 := D2142;                        (* echo length REAL *)
D344 := D2145;  D345 := D2144;                        (* echo radius REAL *)
FOR k := 0 TO 43 DO D346[k] := 0; END_FOR;            (* 346 - 389 reserved *)

gTypeCheck := 0;
IF D200 = 10 THEN                                     (* run job: 402 pallet, 403 program, 404 variant, 405 qty *)
    pal := D402;  prog := D403;  var_ := D404;  qty := D405;
    IF (prog = 0) OR NOT gProgOk THEN
        gTypeCheck := 3;
    ELSIF (var_ < 1) OR (var_ > 3) THEN
        gTypeCheck := 3;
    ELSIF (qty < 1) OR (qty > 100) THEN
        gTypeCheck := 3;
    ELSIF gHasApc AND ((pal = 0) OR (pal <> gPalSetup)) THEN
        gTypeCheck := 3;                              (* pallet not at this machine's pallet changer *)
    END_IF;
ELSIF D200 = 14 THEN                                  (* tool data: 402 pocket, 408 life *)
    IF (D402 < 1) OR (D402 > 30) OR (D408 > 1000) THEN
        gTypeCheck := 3;
    END_IF;
END_IF;

END_FUNCTION_BLOCK

(* Main program (cyclic task), call order every scan:
     FB_FmsType_CNC_inst();                      -> gTypeCheck for the current parameters
     FB_FmsIf_V12_inst(TypeCode := 1, UnitId := 1, AllowedCmds := 16#00004410, ShiftOn := X0.0, AutoMode := X0.1, ...);
     machine sequence: start with FB_FmsIf_V12_inst.NewJob and the latched parameters D1042 - D1049;
                       give JobEnd (one scan) and gJobResult at the end of the job. *)
