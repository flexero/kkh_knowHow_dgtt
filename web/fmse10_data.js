/* FMS engineering – item 10 part A data: PLC program standard + device function-block library.
 * EX10A between the BEGIN/END markers is GENERATED (json.dumps) from tools/fmse/examples/item10a_examples.json – do not edit it by hand,
 * regenerate instead. Same data and rules (_rules) as guide docs/FMS system design/70_plc_library_A_standard_fbs.md (part A), the PLC source
 * tools/fmse/plc_lib/*.st and tools/fmse/*.py. Everything after the END marker is hand-written teaching text.
 * All values are EXAMPLES. Real PLC code is written, reviewed, tested and signed off by qualified people; safety functions only in the F-program. */

/* BEGIN EX10A */
export const EX10A = {
 "_note": "Shared worked-example data for FMS engineering item 10 part A (PLC program standard + complete device function-block library): guide docs/FMS system design/70_plc_library_A_standard_fbs.md (part A), PLC source tools/fmse/plc_lib/*.st, tools/fmse/*.py, web/fmse10*.js. Parts B (module programs M01-M22) and C (cell controller + virtual commissioning of the kit) follow. Guide, tools and web must give IDENTICAL results with the rules below. All values are EXAMPLES; real PLC code is written, reviewed, tested and signed off by qualified people; safety functions only in the F-program.",
 "decisions": [
  {
   "id": "D1",
   "topic": "Who clears the command request (data block word 3 bit0 CmdChangeRequest)",
   "options": [
    "module clears CntrlCmd + CmdChangeRequest (item 9 teaching example)",
    "cell controller clears it after it sees the new state (guide 66 H2.2)",
    "4-phase echo handshake: CC sets, module echoes CmdAck/CmdRej, CC clears, module clears echo"
   ],
   "choice": 2,
   "rule": "One writer per word: words 0-1, 4, 6-11, 16-18 are written ONLY by the module, words 2-3, 5, 12-15, 19 ONLY by the cell controller. CC writes CntrlCmd + sets CmdChangeRequest in ONE FC16 write. Module: on the RISING edge of CmdChangeRequest evaluate the command (state + mode table of item 5) -> Status.Bits bit8 CmdAck (accepted, command executed in the same scan) or bit9 CmdRej (rejected, Admin.WarningNo = module*1000 + 900 + command). CC: on CmdAck or CmdRej clear CmdChangeRequest (and CntrlCmd = 0). Module: when CmdChangeRequest is FALSE clear CmdAck and CmdRej. CC time-out 2 s without echo -> communication alarm. A new command needs a new rising edge (no command is executed twice).",
   "why": "Modbus/OPC UA have no 'write-once' semantics; if both sides write the same word, a late write of one side can erase the other's (race). The echo makes the result (accepted / rejected) visible and gives a clean 4-phase handshake like item 6."
  },
  {
   "id": "D2",
   "topic": "Alarm numbers in Admin.AlarmNo / Admin.WarningNo",
   "options": [
    "local codes per module (10, 11, 12 ...) as in item 9",
    "module range x 1000 + n (guide 66)"
   ],
   "choice": 1,
   "rule": "AlarmNo = M x 1000 + 10 x i + a, M = module number (M02 -> 2), i = instance number of the device FB in the module expansion order of item 8 (1..99, only instances with an FB), a = local alarm code of the FB (1..9); module-level alarms (sequence, homing, communication) use i = 0 (M x 1000 + 1..9) and 900 + n for command rejections (warnings). Example: APC01 (M02) instance 1 'Rotate' (FB_Valve2) alarm 1 'did not reach end position' -> 2011. INT range is enough (M22 -> 22999). Guide 66 '4 digits' becomes '4-5 digits'.",
   "why": "The number alone tells module type, device and fault; the alarm text table is generated from the library (item 10B), identical in PLC, HMI and cell controller."
  },
  {
   "id": "D3",
   "topic": "Reaction to clamp pressure low (and every other alarm)",
   "options": [
    "always Held (guide 68 C2.5)",
    "always Abort (item 9 example)",
    "by ALARM CLASS per alarm and phase"
   ],
   "choice": 2,
   "rule": "Every alarm has a class: A = stop at once (PackML internal Abort: equipment or product at risk, e.g. clamp pressure LOST while the spindle cuts, drive fault, feedback lost while moving), B = controlled pause (internal Hold from Execute: the operator can fix it and continue, e.g. clamp pressure NOT REACHED during the clamping step, end position not reached at a step), C = warning only (no state change: filter dirty, UPS on battery, a rejected command). Clamp pressure: monitored with two different alarms: 'pressure not reached in the clamp step' (class B -> Held, operator re-seats the pallet, Unhold repeats the step) and 'pressure lost while clamped in a machining state' (class A -> Abort + feed hold over the coupling).",
   "why": "PackML: Held = internal condition the operator can clear and continue; Aborted = fault, the job is lost and needs Clear + Reset. The class decides it, not the device."
  },
  {
   "id": "D4",
   "topic": "Resetting must home the module",
   "options": [
    "fixed time (item 9 example)",
    "homing sequence with checks"
   ],
   "choice": 1,
   "rule": "Resetting runs a HOMING sequence: (1) all outputs to the defined home command, (2) every device FB must report its home position (xAtA / stopped / not busy) within its timeout, (3) no active class A/B alarm, (4) safety OK (F-program status). Only then SC -> Idle. A device that is between end positions is driven to its home position ONLY if the module is in a state where motion is allowed (guards closed, safety OK); else alarm 'not in home position' (class B, i = 0, a = 1) and the module stays in Resetting until homed or Stop/Abort. Abort and Stop never move a device - they only switch outputs to the fail-safe value (de-energise) - so Resetting is the place where the module returns to a known state.",
   "why": "Item 9 scenarios B and E showed Idle with the rotation half-way - the next Start would begin from an unknown position. Homing in Resetting makes Idle mean 'ready and in a known position'."
  }
 ],
 "alarm_classes": {
  "A": {
   "reaction": "internal Abort",
   "tower": "red",
   "horn": true
  },
  "B": {
   "reaction": "internal Hold if Execute (else stays)",
   "tower": "yellow",
   "horn": true
  },
  "C": {
   "reaction": "none (warning)",
   "tower": "yellow",
   "horn": false
  }
 },
 "_rules": {
  "common": "tick = 100 ms = the cycle of the test bench (in a real PLC the FB runs in the 10 ms main task - only the time base changes). Every FB is called exactly once per tick. Inputs are persistent: an event '<tick> name=value' changes an input BEFORE the call of that tick. Edges (xReset, xRequest, xHornAck, xPb, xCmdChangeRequest) are detected inside the FB: e = x AND NOT x_prev (x_prev starts FALSE). Times: a counter n counts calls; a time is reached when n*100 >= t_ms. Log: tick 0 = 'init' with all outputs after the first call; then one line per tick listing only the outputs whose value changed (BOOL as 1/0, numbers as integers or shortest decimal). The ST source in tools/fmse/plc_lib/ implements exactly these rules with the same names.",
  "FB_Sensor": "debounce: if xOn <> xValue: cnt += 1 ; if cnt*100 >= (tOn_ms if xOn else tOff_ms): xValue = xOn, cnt = 0 ; else cnt = 0. Outputs xValue (init FALSE).",
  "FB_Valve": "FB_Valve1 (single solenoid, spring return: qSol TRUE -> position B) and FB_Valve2 (double solenoid, bistable: qSolA / qSolB). Inputs xPosA, xPosB (end switches), xCmdB (TRUE = go to / stay at B, FALSE = A), xEnable (FALSE = outputs off: Valve1 springs back to A, Valve2 HOLDS its position), xReset. cfg tMove_ms 2000, tLost_ms 300, tBoth_ms 200. Order: rst = edge(xReset) ; atA = xPosA AND NOT xPosB ; atB = xPosB AND NOT xPosA ; reached = atB if xCmdB else atA ; (1) if xError and rst and NOT (xPosA AND xPosB): xError = FALSE, iAlarm = 0, moving = NOT reached, n = 0, nl = 0 (retry) ; (2) if xCmdB <> prevCmd (prevCmd starts 'none' -> TRUE at the first call): moving = TRUE, n = 0 ; (3) nb = nb+1 if xPosA AND xPosB else 0 ; (4) if NOT xError: if nb*100 >= tBoth_ms: error, iAlarm 3 'both end switches on', moving = FALSE ; elif moving: nl = 0 ; if xEnable: n += 1 ; if reached: moving = FALSE elif n*100 >= tMove_ms: error, iAlarm 1 'end position not reached', moving = FALSE ; elif xEnable: nl = nl+1 if NOT reached else 0 ; if nl*100 >= tLost_ms: error, iAlarm 2 'left the end position without command' ; else nl = 0 ; (5) outputs: Valve1 qSol = xCmdB AND xEnable ; Valve2 qSolB = xCmdB AND xEnable, qSolA = NOT xCmdB AND xEnable (an error does NOT change the outputs - the module decides the reaction by alarm class) ; xAtA = atA ; xAtB = atB ; xBusy = moving AND NOT xError ; prevCmd = xCmdB.",
  "FB_DriveSto": "frequency inverter with STO (safe torque off is switched by the F-program; the standard program reads its F-copy xSto: TRUE = torque off). Inputs xReady, xFault (DI from the drive), xSto, xCmdRun, xReset. States 0 NOT READY, 1 READY, 2 RUNNING, 9 FAULT. Order: rst = edge(xReset) ; ack = FALSE ; if xFault and state <> 9: state 9, iAlarm 1 'drive fault' ; elif state 0: if xReady and NOT xSto: 1 ; elif state 1: if xSto or NOT xReady: 0 elif xCmdRun: 2 ; elif state 2: if xSto: 0 (STO is a normal safety stop, not a drive fault) elif NOT xReady: 9, iAlarm 3 'ready lost while running' elif NOT xCmdRun: 1 ; elif state 9: if rst and NOT xFault: 0, iAlarm 0, ack = TRUE. One transition per call. Outputs: iState ; xError = state = 9 ; xWarn = xCmdRun AND xSto (run requested while torque is off) ; wCtrl (control word to the drive over the bus) = (0 if xSto else 1) [bit0 ON/enable] + (2 if state = 2) [bit1 RUN] + (128 if ack) [bit7 fault acknowledge, one call].",
  "FB_Heater": "2-point temperature control + monitoring. Inputs xOnFb (contactor auxiliary), xOverTemp (safety thermostat), rTemp, xTempGood (quality of the analog input FB), xEnable, rSp, xReset ; cfg rHyst 2.0, tFb_ms 500. Order: rst = edge ; (1) if xError and rst and NOT xOverTemp and (xTempGood or NOT xEnable) and NOT xOnFb: clear error, nfb = nw = 0 ; (2) if NOT xError: if xOverTemp: error iAlarm 1 'over-temperature (safety thermostat)' elif xEnable and NOT xTempGood: error iAlarm 3 'temperature signal bad' ; (3) heat: if NOT xEnable or xError: FALSE elif rTemp <= rSp - rHyst: TRUE elif rTemp >= rSp: FALSE (else unchanged) ; q = heat ; (4) nfb = nfb+1 if q and NOT xOnFb else 0 ; nw = nw+1 if NOT q and xOnFb else 0 ; if NOT xError and nfb*100 >= tFb_ms: error iAlarm 2 'no contactor feedback' ; if NOT xError and nw*100 >= tFb_ms: error iAlarm 4 'feedback without command (contactor welded?)' ; (5) if xError: heat = FALSE, q = FALSE ; qOn = q.",
  "FB_PushButton": "illuminated push-button. blink = (c // 5) MOD 2 = 0 with c = number of previous calls (1 Hz at 100 ms) ; qLamp = iLampMode = 1 OR (iLampMode = 2 AND blink) ; xClick = edge(xPb) ; xPressed = xPb.",
  "FB_SignalTower": "inputs iState (PackML state number), iAlarmClass (0 none, 1 A, 2 B, 3 C), xHornAck. blink as FB_PushButton. qRed = class 1 OR state in {8 Aborting, 9 Aborted} ; qYellow = class in {2,3} OR state in {2 Stopped, 5 Suspended, 11 Held} ; qGreen = state in {3,6,12,14,16} OR (state in {4 Idle, 17 Complete} AND blink) ; horn: if class in {1,2} and class <> previous class: horn = TRUE ; if edge(xHornAck) or class = 0: horn = FALSE ; qBuzzer = horn. Colours per IEC 60204-1 10.3 / IEC 60073 (red = danger/fault, yellow = abnormal/attention, green = normal; flashing green = ready, waiting).",
  "FB_HandshakeHw": "requester side of the hard-wired 4-phase handshake (item 8 HANDSHAKE_HW, item 6 logic). Inputs xReady, xBusy, xDone, xFault (from the partner), xStart, xReset ; cfg tHs_ms 2000, tJob_ms 10000. Order: rst = edge ; qReset = rst (one call, fault reset to the partner) ; xDoneOut = FALSE ; if xError: if rst and NOT xFault: clear error, step 0 ; elif xFault and step <> 0: error iAlarm 4 'partner fault' ; elif step 0: if xStart and xReady: 10, n = 0 ; elif 10: n += 1 ; if xBusy: 20, n = 0 elif n*100 >= tHs_ms: error iAlarm 1 'partner did not start (busy missing)' ; elif 20: n += 1 ; if xDone: 30, n = 0 elif n*100 >= tJob_ms: error iAlarm 2 'job time-out' ; elif 30: n += 1 ; if NOT xDone: 0, xDoneOut = TRUE elif n*100 >= tHs_ms: error iAlarm 3 'done not removed'. Outputs: iStep ; qRequest = qEnable = step in {10,20} AND NOT xError ; qAck = step = 30 AND NOT xError.",
  "FB_Feeder": "n = n+1 if NOT xSupplyOn else 0 ; xOk = xSupplyOn ; iAlarm = 1 'feeder breaker off' if n*100 >= tDelay_ms (200) else 0 (not latched, class C unless the module needs the supply).",
  "FB_Ups": "n = n+1 if xOnBattery else 0 ; xShutdownReq = n*100 >= tBuffer_ms (5000) ; iAlarm = 1 'UPS fault' if NOT xUpsOk else 2 'on battery' if xOnBattery else 0.",
  "FB_Safe2Ch": "diagnostic mirror of a 2-channel safety input (the safety function itself is in the F-program). Used by FB_Estop, FB_Door2Ch, FB_EnableSwitch, FB_LightCurtain (+ xWarn passed through), FB_SafetyCoupling (one for EstopIn, one for ZoneFree). Inputs xCh1, xCh2 (TRUE = safe/closed), xReset ; cfg tDisc_ms 500. latched starts TRUE (reset needed after power-on). Order: rst = edge ; nd = nd+1 if xCh1 <> xCh2 else 0 ; if nd*100 >= tDisc_ms and NOT xDiscErr: xDiscErr = TRUE, iAlarm 1 'discrepancy', bothOpen = FALSE ; if xDiscErr and NOT xCh1 and NOT xCh2: bothOpen = TRUE ; if NOT (xCh1 AND xCh2): latched = TRUE ; if rst and xCh1 and xCh2: (if xDiscErr and bothOpen: xDiscErr = FALSE, iAlarm 0) ; if NOT xDiscErr: latched = FALSE ; outputs xOk = xCh1 AND xCh2 AND NOT latched AND NOT xDiscErr ; xResetReq = latched AND xCh1 AND xCh2 AND NOT xDiscErr. A discrepancy can only be reset after BOTH channels were open (cross-fault test, as safety PLCs do).",
  "FB_ModeSwitch": "inputs xAuto, xMaint ; n = n+1 if xAuto AND xMaint else 0 ; iMode: Auto only -> 1 Production, Maint only -> 2 Maintenance, none -> 3 Manual, both -> unchanged ; xError = n*100 >= tDisc_ms (500) ; iAlarm = 1 if xError else 0. iMode init 3.",
  "FB_Edm": "external device monitoring (FB_ZoneOut, FB_ContactorPair: bInverted TRUE - NC mirror contacts are TRUE when the contactors are OPEN ; FB_SafeValve: bInverted FALSE - position feedback TRUE when the valve is open). Inputs xCmd (F-copy of the F-output), xFb, xReset ; cfg tEdm_ms 300. exp = NOT xCmd if bInverted else xCmd ; okfb = xFb = exp ; n = n+1 if NOT okfb else 0 ; rst = edge(xReset) (evaluated in EVERY call) ; if xError and rst and okfb: clear ; if NOT xError and n*100 >= tEdm_ms: xError, iAlarm 1 'feedback does not follow (welded / not switching)' ; xOn = xCmd AND okfb AND NOT xError.",
  "FB_TwoHand": "diagnostic mirror of the two-hand control (type IIIC: two 2-channel buttons, simultaneity 0.5 s - the F-program does the safety function). L = xLeft AND xLeft2 ; R = xRight AND xRight2 ; if NOT L and NOT R: blocked = FALSE, n = 0, xError = FALSE, iAlarm 0, xActuated = FALSE ; elif L <> R: n += 1 ; if n*100 > tSync_ms (500) and NOT xActuated: blocked = TRUE, xError = TRUE, iAlarm 1 'not simultaneous - release both' ; xActuated = FALSE ; else (both): xActuated = NOT blocked. Note the strict '>' : pressing the second hand in the 5th call after the first (500 ms) is still simultaneous.",
  "FB_Scanner": "safety laser scanner: qFieldA = iField = 1 ; qFieldB = iField = 2 (field-set switching by the standard program, the scanner checks the combination) ; xFree = xOssd1 AND xOssd2 ; xWarnOut = xWarn ; iAlarm = 0 if iField in {1,2} else 2 'invalid field set'.",
  "FB_DoorLock": "guard locking (item 7/8 DOOR_LOCK). C = xClosed AND xClosed2 ; L = xLocked AND xLocked2 ; nc/nl = discrepancy counters of the pairs ; if nc*100 >= tDisc_ms (500): xError iAlarm 1 'door switch discrepancy' elif nl*100 >= tDisc_ms: xError iAlarm 2 'lock switch discrepancy' ; if L and NOT C and NOT xError: xError iAlarm 3 'locked but not closed (tongue missing / manipulation)' ; if edge(xRequest) and C and L: xUnlockReq = TRUE (to the F-program: unlock after standstill) ; if NOT xClosed and NOT xClosed2: wasOpen = TRUE ; if xUnlockReq and wasOpen and C: xUnlockReq = FALSE, wasOpen = FALSE (door was opened and closed again -> request done, the F-program locks again) ; xClosedOk = C ; xLockedOk = L. (Errors are latched - cleared only by a new power-on / module reset in part B.)",
  "FB_CmdIf": "decision D1. Inputs iCntrlCmd, xCmdChangeRequest (data block, written by the cell controller), iState, iMode (from the module). e = edge(xCmdChangeRequest) ; iCmdExec = 0 ; if e: iLastCmd = iCntrlCmd ; if allowed(cmd, state, mode) (item 5 tables: EDGES with the command label, Stop from every state except Stopped/Stopping/Aborting/Aborted/Clearing, Abort from every state except Aborting/Aborted, and the command in MODES[mode], mode 1 Production / 2 Maintenance / 3 Manual): xCmdAck = TRUE, iCmdExec = iCntrlCmd (one call - the PackML core executes it) else xCmdRej = TRUE, iRejectCount += 1 (the MODULE program then sets Admin.WarningNo = M*1000 + 900 + iLastCmd - part B) ; if NOT xCmdChangeRequest: xCmdAck = xCmdRej = FALSE.",
  "alarm_manager": "decision D2 + D3. Each event (t, on/off, instance i, local alarm a): AlarmNo candidate = module_code*1000 + 10*i + a with the class from 'classes' for (FB type of instance i, a) ; instance i = 0 means the module itself (type 'MODULE'). Active list keeps the activation order. Admin.AlarmNo = the active class A or B alarm with the best (class, activation order) - A before B, earlier before later ; Admin.WarningNo = the earliest active class C ; AlarmClass for the signal tower = 1/2/3 of the most severe active (0 none) ; reaction = Abort (A), Hold if Execute (B), none (C). Log one line per event.",
  "fb_library": "the library = the 24 distinct FB types of item 9 codegen.fb_types (25 patterns; ANALOG_P and ANALOG_T share FB_AnalogIn) + FB_Safe2Ch, FB_Edm (bases) + FB_CmdIf, FB_AlarmMgr, function F_CmdAllowed (part A) ; FB_PackMLCore follows in part B. FB_MotorDol and FB_AnalogIn (+ limit alarm) keep the item 9 rules and tests (item9_examples.json motor / analog / limits). Wrappers: FB_Estop, FB_Door2Ch, FB_EnableSwitch, FB_LightCurtain = FB_Safe2Ch ; FB_SafetyCoupling = 2 x FB_Safe2Ch ; FB_ZoneOut, FB_ContactorPair = FB_Edm(bInverted TRUE) ; FB_SafeValve = 2 x FB_Edm(bInverted FALSE)."
 },
 "fb_interfaces": {
  "FB_Sensor": {
   "in": [
    "xOn"
   ],
   "out": [
    "xValue"
   ],
   "cfg": {
    "tOn_ms": 0,
    "tOff_ms": 0
   }
  },
  "FB_Valve1": {
   "in": [
    "xPosA",
    "xPosB",
    "xCmdB",
    "xEnable",
    "xReset"
   ],
   "out": [
    "qSol",
    "xAtA",
    "xAtB",
    "xBusy",
    "xError",
    "iAlarm"
   ],
   "cfg": {
    "tMove_ms": 2000,
    "tLost_ms": 300,
    "tBoth_ms": 200
   }
  },
  "FB_Valve2": {
   "in": [
    "xPosA",
    "xPosB",
    "xCmdB",
    "xEnable",
    "xReset"
   ],
   "out": [
    "qSolA",
    "qSolB",
    "xAtA",
    "xAtB",
    "xBusy",
    "xError",
    "iAlarm"
   ],
   "cfg": {
    "tMove_ms": 2000,
    "tLost_ms": 300,
    "tBoth_ms": 200
   }
  },
  "FB_DriveSto": {
   "in": [
    "xReady",
    "xFault",
    "xSto",
    "xCmdRun",
    "xReset"
   ],
   "out": [
    "wCtrl",
    "iState",
    "xWarn",
    "xError",
    "iAlarm"
   ],
   "cfg": {}
  },
  "FB_Heater": {
   "in": [
    "xOnFb",
    "xOverTemp",
    "rTemp",
    "xTempGood",
    "xEnable",
    "rSp",
    "xReset"
   ],
   "out": [
    "qOn",
    "xError",
    "iAlarm"
   ],
   "cfg": {
    "rHyst": 2.0,
    "tFb_ms": 500
   }
  },
  "FB_PushButton": {
   "in": [
    "xPb",
    "iLampMode"
   ],
   "out": [
    "qLamp",
    "xPressed",
    "xClick"
   ],
   "cfg": {}
  },
  "FB_SignalTower": {
   "in": [
    "iState",
    "iAlarmClass",
    "xHornAck"
   ],
   "out": [
    "qRed",
    "qYellow",
    "qGreen",
    "qBuzzer"
   ],
   "cfg": {}
  },
  "FB_HandshakeHw": {
   "in": [
    "xReady",
    "xBusy",
    "xDone",
    "xFault",
    "xStart",
    "xReset"
   ],
   "out": [
    "qRequest",
    "qAck",
    "qEnable",
    "qReset",
    "iStep",
    "xDoneOut",
    "xError",
    "iAlarm"
   ],
   "cfg": {
    "tHs_ms": 2000,
    "tJob_ms": 10000
   }
  },
  "FB_Feeder": {
   "in": [
    "xSupplyOn"
   ],
   "out": [
    "xOk",
    "iAlarm"
   ],
   "cfg": {
    "tDelay_ms": 200
   }
  },
  "FB_Ups": {
   "in": [
    "xUpsOk",
    "xOnBattery"
   ],
   "out": [
    "xShutdownReq",
    "iAlarm"
   ],
   "cfg": {
    "tBuffer_ms": 5000
   }
  },
  "FB_Safe2Ch": {
   "in": [
    "xCh1",
    "xCh2",
    "xReset"
   ],
   "out": [
    "xOk",
    "xResetReq",
    "xDiscErr",
    "iAlarm"
   ],
   "cfg": {
    "tDisc_ms": 500
   }
  },
  "FB_ModeSwitch": {
   "in": [
    "xAuto",
    "xMaint"
   ],
   "out": [
    "iMode",
    "xError",
    "iAlarm"
   ],
   "cfg": {
    "tDisc_ms": 500
   }
  },
  "FB_Edm": {
   "in": [
    "xCmd",
    "xFb",
    "xReset"
   ],
   "out": [
    "xOn",
    "xError",
    "iAlarm"
   ],
   "cfg": {
    "tEdm_ms": 300,
    "bInverted": true
   }
  },
  "FB_TwoHand": {
   "in": [
    "xLeft",
    "xLeft2",
    "xRight",
    "xRight2"
   ],
   "out": [
    "xActuated",
    "xError",
    "iAlarm"
   ],
   "cfg": {
    "tSync_ms": 500
   }
  },
  "FB_Scanner": {
   "in": [
    "xOssd1",
    "xOssd2",
    "xWarn",
    "iField"
   ],
   "out": [
    "qFieldA",
    "qFieldB",
    "xFree",
    "xWarnOut",
    "iAlarm"
   ],
   "cfg": {}
  },
  "FB_DoorLock": {
   "in": [
    "xClosed",
    "xClosed2",
    "xLocked",
    "xLocked2",
    "xRequest"
   ],
   "out": [
    "xClosedOk",
    "xLockedOk",
    "xUnlockReq",
    "xError",
    "iAlarm"
   ],
   "cfg": {
    "tDisc_ms": 500
   }
  },
  "FB_CmdIf": {
   "in": [
    "iCntrlCmd",
    "xCmdChangeRequest",
    "iState",
    "iMode"
   ],
   "out": [
    "xCmdAck",
    "xCmdRej",
    "iCmdExec",
    "iLastCmd",
    "iRejectCount"
   ],
   "cfg": {}
  }
 },
 "_input_defaults": "see ref: Valve xPosA TRUE (starts at A), xEnable TRUE ; DriveSto xSto TRUE ; Heater rTemp 20.0, xTempGood TRUE, rSp 60.0 ; SignalTower iState 2 ; Feeder xSupplyOn TRUE ; Ups xUpsOk TRUE ; Edm xFb TRUE ; Scanner iField 1 ; DoorLock all four TRUE ; CmdIf iState 2, iMode 1 ; all others FALSE / 0.",
 "fb_tests": [
  {
   "fb": "FB_Sensor",
   "name": "S1 debounce: bounce ignored, 300 ms on / 200 ms off",
   "K": 20,
   "cfg": {
    "tOn_ms": 300,
    "tOff_ms": 200
   },
   "events": [
    [
     2,
     "xOn=1"
    ],
    [
     3,
     "xOn=0"
    ],
    [
     4,
     "xOn=1"
    ],
    [
     10,
     "xOn=0"
    ],
    [
     11,
     "xOn=1"
    ],
    [
     12,
     "xOn=0"
    ]
   ]
  },
  {
   "fb": "FB_Valve1",
   "name": "V1 normal: A -> B -> A",
   "K": 30,
   "cfg": {},
   "events": [
    [
     2,
     "xCmdB=1",
     "xPosA=0"
    ],
    [
     8,
     "xPosB=1"
    ],
    [
     15,
     "xCmdB=0",
     "xPosB=0"
    ],
    [
     21,
     "xPosA=1"
    ]
   ]
  },
  {
   "fb": "FB_Valve1",
   "name": "V2 jam: B not reached -> alarm 1 -> reset -> retry ok",
   "K": 50,
   "cfg": {},
   "events": [
    [
     2,
     "xCmdB=1",
     "xPosA=0"
    ],
    [
     30,
     "xReset=1"
    ],
    [
     31,
     "xReset=0"
    ],
    [
     36,
     "xPosB=1"
    ]
   ]
  },
  {
   "fb": "FB_Valve1",
   "name": "V3 lost position + both switches + disable",
   "K": 40,
   "cfg": {},
   "events": [
    [
     5,
     "xPosA=0"
    ],
    [
     12,
     "xReset=1",
     "xPosA=1"
    ],
    [
     13,
     "xReset=0"
    ],
    [
     20,
     "xPosB=1"
    ],
    [
     25,
     "xReset=1"
    ],
    [
     26,
     "xReset=0",
     "xPosB=0"
    ],
    [
     27,
     "xReset=1"
    ],
    [
     28,
     "xReset=0"
    ],
    [
     32,
     "xEnable=0",
     "xCmdB=1"
    ]
   ]
  },
  {
   "fb": "FB_Valve2",
   "name": "V4 bistable: disable holds, timer pauses",
   "K": 50,
   "cfg": {},
   "events": [
    [
     2,
     "xCmdB=1",
     "xPosA=0"
    ],
    [
     6,
     "xEnable=0"
    ],
    [
     20,
     "xEnable=1"
    ],
    [
     24,
     "xPosB=1"
    ],
    [
     30,
     "xEnable=0"
    ],
    [
     35,
     "xCmdB=0"
    ],
    [
     38,
     "xEnable=1",
     "xPosB=0"
    ],
    [
     41,
     "xPosA=1"
    ]
   ]
  },
  {
   "fb": "FB_DriveSto",
   "name": "D1 STO release, run, STO stop, fault, reset",
   "K": 40,
   "cfg": {},
   "events": [
    [
     2,
     "xSto=0"
    ],
    [
     3,
     "xReady=1"
    ],
    [
     5,
     "xCmdRun=1"
    ],
    [
     10,
     "xSto=1"
    ],
    [
     12,
     "xSto=0"
    ],
    [
     15,
     "xFault=1"
    ],
    [
     17,
     "xReset=1"
    ],
    [
     18,
     "xReset=0"
    ],
    [
     20,
     "xFault=0"
    ],
    [
     21,
     "xReset=1"
    ],
    [
     22,
     "xReset=0"
    ],
    [
     25,
     "xReady=0"
    ],
    [
     26,
     "xReady=1"
    ],
    [
     30,
     "xCmdRun=0"
    ]
   ]
  },
  {
   "fb": "FB_Heater",
   "name": "H1 2-point control + no feedback + over-temperature",
   "K": 45,
   "cfg": {},
   "events": [
    [
     1,
     "xEnable=1",
     "rTemp=55"
    ],
    [
     3,
     "xOnFb=1"
    ],
    [
     8,
     "rTemp=59"
    ],
    [
     10,
     "rTemp=60.5"
    ],
    [
     11,
     "xOnFb=0"
    ],
    [
     15,
     "rTemp=57.5"
    ],
    [
     22,
     "rTemp=58"
    ],
    [
     24,
     "xReset=1"
    ],
    [
     25,
     "xReset=0"
    ],
    [
     26,
     "xOnFb=1"
    ],
    [
     30,
     "xOverTemp=1"
    ],
    [
     31,
     "xOnFb=0"
    ],
    [
     36,
     "xOverTemp=0"
    ],
    [
     38,
     "xReset=1"
    ],
    [
     39,
     "xReset=0",
     "xTempGood=0"
    ],
    [
     43,
     "xEnable=0",
     "xReset=1"
    ]
   ]
  },
  {
   "fb": "FB_PushButton",
   "name": "P1 lamp modes and click",
   "K": 16,
   "cfg": {},
   "events": [
    [
     1,
     "iLampMode=2"
    ],
    [
     4,
     "xPb=1"
    ],
    [
     6,
     "xPb=0"
    ],
    [
     12,
     "iLampMode=1"
    ],
    [
     14,
     "iLampMode=0",
     "xPb=1"
    ]
   ]
  },
  {
   "fb": "FB_SignalTower",
   "name": "T1 states and alarm classes",
   "K": 30,
   "cfg": {},
   "events": [
    [
     2,
     "iState=15"
    ],
    [
     4,
     "iState=4"
    ],
    [
     12,
     "iState=6"
    ],
    [
     15,
     "iAlarmClass=2"
    ],
    [
     16,
     "iState=10"
    ],
    [
     17,
     "iState=11"
    ],
    [
     19,
     "xHornAck=1"
    ],
    [
     20,
     "xHornAck=0"
    ],
    [
     22,
     "iAlarmClass=1"
    ],
    [
     23,
     "iState=8"
    ],
    [
     24,
     "iState=9"
    ],
    [
     27,
     "iAlarmClass=0",
     "iState=1"
    ],
    [
     28,
     "iState=2"
    ]
   ]
  },
  {
   "fb": "FB_HandshakeHw",
   "name": "HS1 normal job then partner never busy",
   "K": 60,
   "cfg": {},
   "events": [
    [
     1,
     "xReady=1"
    ],
    [
     2,
     "xStart=1"
    ],
    [
     4,
     "xBusy=1",
     "xReady=0"
    ],
    [
     5,
     "xStart=0"
    ],
    [
     12,
     "xDone=1",
     "xBusy=0"
    ],
    [
     15,
     "xDone=0",
     "xReady=1"
    ],
    [
     20,
     "xStart=1"
    ],
    [
     21,
     "xStart=0"
    ],
    [
     45,
     "xReset=1"
    ],
    [
     46,
     "xReset=0"
    ],
    [
     48,
     "xFault=1"
    ],
    [
     50,
     "xStart=1"
    ],
    [
     52,
     "xBusy=1"
    ],
    [
     55,
     "xReset=1",
     "xFault=0"
    ],
    [
     56,
     "xReset=0"
    ]
   ]
  },
  {
   "fb": "FB_Feeder",
   "name": "F1 breaker trips and comes back",
   "K": 10,
   "cfg": {},
   "events": [
    [
     2,
     "xSupplyOn=0"
    ],
    [
     6,
     "xSupplyOn=1"
    ]
   ]
  },
  {
   "fb": "FB_Ups",
   "name": "U1 mains loss shorter and longer than the buffer time",
   "K": 95,
   "cfg": {},
   "events": [
    [
     2,
     "xOnBattery=1"
    ],
    [
     20,
     "xOnBattery=0"
    ],
    [
     25,
     "xOnBattery=1"
    ],
    [
     80,
     "xUpsOk=0"
    ],
    [
     88,
     "xOnBattery=0",
     "xUpsOk=1"
    ]
   ]
  },
  {
   "fb": "FB_Safe2Ch",
   "name": "E1 e-stop: power-on reset, press, reset, discrepancy",
   "K": 50,
   "cfg": {},
   "events": [
    [
     1,
     "xCh1=1",
     "xCh2=1"
    ],
    [
     3,
     "xReset=1"
    ],
    [
     4,
     "xReset=0"
    ],
    [
     8,
     "xCh1=0",
     "xCh2=0"
    ],
    [
     10,
     "xCh1=1",
     "xCh2=1"
    ],
    [
     12,
     "xReset=1"
    ],
    [
     13,
     "xReset=0"
    ],
    [
     20,
     "xCh2=0"
    ],
    [
     28,
     "xCh2=1"
    ],
    [
     30,
     "xReset=1"
    ],
    [
     31,
     "xReset=0"
    ],
    [
     33,
     "xCh1=0",
     "xCh2=0"
    ],
    [
     35,
     "xCh1=1",
     "xCh2=1"
    ],
    [
     37,
     "xReset=1"
    ],
    [
     38,
     "xReset=0"
    ]
   ]
  },
  {
   "fb": "FB_ModeSwitch",
   "name": "M1 key switch positions",
   "K": 20,
   "cfg": {},
   "events": [
    [
     2,
     "xAuto=1"
    ],
    [
     6,
     "xMaint=1"
    ],
    [
     7,
     "xAuto=0"
    ],
    [
     10,
     "xAuto=1"
    ],
    [
     17,
     "xAuto=0",
     "xMaint=0"
    ]
   ]
  },
  {
   "fb": "FB_Edm",
   "name": "Z1 zone contactors follow, then one welds",
   "K": 30,
   "cfg": {},
   "events": [
    [
     2,
     "xCmd=1"
    ],
    [
     3,
     "xFb=0"
    ],
    [
     10,
     "xCmd=0"
    ],
    [
     11,
     "xFb=1"
    ],
    [
     15,
     "xCmd=1"
    ],
    [
     16,
     "xFb=0"
    ],
    [
     20,
     "xCmd=0"
    ],
    [
     26,
     "xReset=1"
    ],
    [
     27,
     "xReset=0",
     "xFb=1"
    ],
    [
     28,
     "xReset=1"
    ]
   ]
  },
  {
   "fb": "FB_TwoHand",
   "name": "W1 simultaneous, then too slow, then release",
   "K": 30,
   "cfg": {},
   "events": [
    [
     2,
     "xLeft=1",
     "xLeft2=1"
    ],
    [
     5,
     "xRight=1",
     "xRight2=1"
    ],
    [
     9,
     "xLeft=0",
     "xLeft2=0",
     "xRight=0",
     "xRight2=0"
    ],
    [
     12,
     "xLeft=1",
     "xLeft2=1"
    ],
    [
     20,
     "xRight=1",
     "xRight2=1"
    ],
    [
     24,
     "xLeft=0",
     "xLeft2=0"
    ],
    [
     25,
     "xRight=0",
     "xRight2=0"
    ],
    [
     26,
     "xRight=1",
     "xRight2=1"
    ],
    [
     27,
     "xLeft=1",
     "xLeft2=1"
    ]
   ]
  },
  {
   "fb": "FB_Scanner",
   "name": "SC1 field switching and OSSD",
   "K": 12,
   "cfg": {},
   "events": [
    [
     1,
     "xOssd1=1",
     "xOssd2=1"
    ],
    [
     3,
     "iField=2"
    ],
    [
     5,
     "xWarn=1"
    ],
    [
     6,
     "xOssd1=0",
     "xOssd2=0"
    ],
    [
     8,
     "xOssd1=1",
     "xOssd2=1",
     "xWarn=0"
    ],
    [
     10,
     "iField=0"
    ]
   ]
  },
  {
   "fb": "FB_DoorLock",
   "name": "L1 access request, open, close",
   "K": 30,
   "cfg": {},
   "events": [
    [
     2,
     "xRequest=1"
    ],
    [
     3,
     "xRequest=0"
    ],
    [
     5,
     "xLocked=0",
     "xLocked2=0"
    ],
    [
     8,
     "xClosed=0",
     "xClosed2=0"
    ],
    [
     15,
     "xClosed=1",
     "xClosed2=1"
    ],
    [
     17,
     "xLocked=1",
     "xLocked2=1"
    ],
    [
     20,
     "xClosed=0"
    ]
   ]
  },
  {
   "fb": "FB_CmdIf",
   "name": "C1 4-phase command echo with accept and reject",
   "K": 30,
   "cfg": {},
   "events": [
    [
     2,
     "iCntrlCmd=2",
     "xCmdChangeRequest=1"
    ],
    [
     4,
     "iCntrlCmd=0",
     "xCmdChangeRequest=0"
    ],
    [
     6,
     "iCntrlCmd=1",
     "xCmdChangeRequest=1"
    ],
    [
     8,
     "iCntrlCmd=0",
     "xCmdChangeRequest=0"
    ],
    [
     10,
     "iState=15"
    ],
    [
     12,
     "iState=4"
    ],
    [
     14,
     "iCntrlCmd=2",
     "xCmdChangeRequest=1"
    ],
    [
     15,
     "iState=3"
    ],
    [
     16,
     "iCntrlCmd=0",
     "xCmdChangeRequest=0"
    ],
    [
     18,
     "iState=6",
     "iMode=3"
    ],
    [
     20,
     "iCntrlCmd=4",
     "xCmdChangeRequest=1"
    ],
    [
     22,
     "iCntrlCmd=0",
     "xCmdChangeRequest=0"
    ],
    [
     24,
     "iCntrlCmd=3",
     "xCmdChangeRequest=1"
    ],
    [
     27,
     "iCntrlCmd=0",
     "xCmdChangeRequest=0"
    ]
   ]
  }
 ],
 "alarm_manager": {
  "module_code": 2,
  "unit": "APC01",
  "instances": [
   [
    "Rotate",
    "FB_Valve2"
   ],
   [
    "Clamp",
    "FB_Valve1"
   ],
   [
    "PalSideA",
    "FB_Sensor"
   ],
   [
    "PalSideB",
    "FB_Sensor"
   ],
   [
    "ClampPress",
    "FB_AnalogIn"
   ]
  ],
  "_instances": "M02 APC01 instances with an FB in item 8 expansion order (i = 1..5); module-level alarms use i = 0",
  "classes": [
   [
    "FB_Valve2",
    1,
    "A"
   ],
   [
    "FB_Valve2",
    2,
    "A"
   ],
   [
    "FB_Valve2",
    3,
    "B"
   ],
   [
    "FB_Valve1",
    1,
    "B"
   ],
   [
    "FB_Valve1",
    2,
    "A"
   ],
   [
    "FB_Valve1",
    3,
    "B"
   ],
   [
    "FB_AnalogIn",
    1,
    "B"
   ],
   [
    "FB_AnalogIn",
    2,
    "A"
   ],
   [
    "FB_AnalogIn",
    3,
    "C"
   ],
   [
    "FB_Sensor",
    1,
    "C"
   ],
   [
    "MODULE",
    1,
    "B"
   ]
  ],
  "_classes": "(FB type, local alarm, class). FB_AnalogIn local alarms in this module: 1 'clamp pressure not reached in the clamp step' (B), 2 'clamp pressure lost while clamped in a machining state' (A), 3 'signal quality bad/uncertain' (C). MODULE 1 = 'not in home position' (decision D4). FB_AnalogIn itself only raises local alarm 3 (signal quality); alarms 1 and 2 are process alarms raised by the module program against the instance number of the analog input.",
  "events": [
   [
    10,
    "on",
    5,
    3
   ],
   [
    20,
    "on",
    2,
    1
   ],
   [
    25,
    "on",
    1,
    1
   ],
   [
    30,
    "off",
    2,
    1
   ],
   [
    32,
    "off",
    1,
    1
   ],
   [
    40,
    "on",
    5,
    1
   ],
   [
    45,
    "on",
    5,
    2
   ],
   [
    50,
    "off",
    5,
    2
   ],
   [
    55,
    "off",
    5,
    1
   ],
   [
    60,
    "off",
    5,
    3
   ]
  ]
 }
};
/* END EX10A */

/* ------------------------------------------------------------------ 10A module FB structure, tasks, naming */
export const TASKS10 = [
  ["Fast", "2 ms", "1", "only where needed: fast counters, cam / press monitoring, axis interpolation of simple drives", "FB_* of the fast IO only"],
  ["Main", "10 ms", "2", "IO layer (generated, item 9I) → device FBs → FB_CmdIf → PackML core → sequence → FB_AlarmMgr → outputs + data block", "one call of FB_Module<unit> per module"],
  ["Comm", "100 ms", "3", "data block copy to the Modbus / OPC UA server, heartbeat, diagnostics buffer, HMI texts", "PRG_Comm"],
  ["Background", "free", "4", "statistics, OEE counters, logbook to file / SD card", "PRG_Stat"],
  ["F-program (safety)", "10–20 ms", "safety CPU", "e-stop, guards, light curtains, two-hand, STO, safe valves – certified blocks only; the standard program gets READ-ONLY copies", "safety programmer, separate password + signature"],
];
export const NAMING10 = [
  ["FB_", "function block type", "FB_Valve2, FB_DriveSto, FB_ModuleAPC"],
  ["PRG_", "program (called by a task)", "PRG_Cell, PRG_Comm"],
  ["x", "BOOL", "xPosA, xReset, xCmdAck"],
  ["q", "BOOL output to hardware (coil, lamp)", "qSolA, qLamp, qBuzzer"],
  ["i", "INT (state, step, alarm code)", "iState, iStep, iAlarm"],
  ["r", "REAL", "rTemp, rSp"],
  ["w", "WORD (bit field, control word)", "wCtrl, wStatusBits"],
  ["t…_ms", "time parameter in milliseconds (cfg)", "tMove_ms, tDisc_ms"],
  ["<Unit>_<Device>_<Signal>", "global IO symbol (generated from the item 8 tag)", "APC01_Rotate_PosA"],
  ["<Device> : FB_<Type>", "FB instance name = device name of item 8", "Rotate : FB_Valve2"],
  ["M×1000 + 10·i + a", "alarm number (decision D2)", "2011 = M02 instance 1 alarm 1"],
];
export const STRUCT10 = [
  ["IO layer", "generated from the item 8 library (item 9I) – symbols with IEC addresses, no logic", "GVL_IO"],
  ["Device FBs", "one instance per device with an FB (valve, motor, drive, sensor, safety mirror …) – this page", "FB_Valve2, FB_Sensor …"],
  ["FB_CmdIf", "reads CntrlCmd + CmdChangeRequest from the data block, checks state + mode, echoes CmdAck / CmdRej (decision D1)", "10H"],
  ["FB_PackMLCore", "PackML state machine of item 5 – executes the accepted command, internal Abort / Hold from the alarm class, homing in Resetting (D4)", "part B"],
  ["Sequence", "module steps that run only in Execute (item 9F) – drives the device FBs", "part B"],
  ["FB_AlarmMgr", "collects iAlarm of every device FB → AlarmNo / WarningNo / AlarmClass / reaction (decisions D2 + D3)", "10I"],
  ["Data block", "words 0–19 standard + module part (item 6), one writer per word", "10C"],
];

/* ------------------------------------------------------------------ 10D library catalogue (types not covered by EX10A interfaces) */
// [type, category, base / source, short text]
export const LIB_INFO = {
  FB_Sensor: ["device", "own rule", "digital sensor with on / off debounce"],
  FB_Valve1: ["device", "own rule (FB_Valve)", "single-solenoid valve, spring return – qSol TRUE = position B"],
  FB_Valve2: ["device", "own rule (FB_Valve)", "double-solenoid valve, bistable – qSolA / qSolB, holds its position when disabled"],
  FB_MotorDol: ["device", "item 9 (9E)", "direct-on-line motor with run feedback supervision and no automatic restart"],
  FB_DriveSto: ["device", "own rule", "frequency inverter with STO read-back, control word over the bus"],
  FB_AnalogIn: ["device", "item 9 (9D)", "analog input: scaling, NAMUR NE 43 quality, limit alarms with hysteresis and delay"],
  FB_Heater: ["device", "own rule", "2-point temperature control with contactor feedback and over-temperature"],
  FB_PushButton: ["operator", "own rule", "illuminated push-button: click edge, lamp off / on / blink"],
  FB_SignalTower: ["operator", "own rule", "signal tower red / yellow / green + horn from PackML state and alarm class"],
  FB_HandshakeHw: ["interface", "own rule", "requester side of the hard-wired 4-phase handshake (item 6)"],
  FB_Feeder: ["supply", "own rule", "feeder breaker auxiliary contact"],
  FB_Ups: ["supply", "own rule", "24 V DC UPS: fault, on battery, shutdown request after the buffer time"],
  FB_ModeSwitch: ["safety mirror", "own rule", "mode key switch → Production / Maintenance / Manual"],
  FB_Scanner: ["safety mirror", "own rule", "safety laser scanner: field-set switching, OSSD state, warning field"],
  FB_TwoHand: ["safety mirror", "own rule", "two-hand control type IIIC, simultaneity 0.5 s (diagnosis only)"],
  FB_DoorLock: ["safety mirror", "own rule", "guard locking: closed / locked pairs, unlock request"],
  FB_Safe2Ch: ["base", "own rule", "diagnostic mirror of any 2-channel safety input (discrepancy, reset request)"],
  FB_Edm: ["base", "own rule", "external device monitoring: feedback must follow the F-output"],
  FB_Estop: ["safety mirror", "wrapper = FB_Safe2Ch", "e-stop push-button (2 NC channels)"],
  FB_Door2Ch: ["safety mirror", "wrapper = FB_Safe2Ch", "guard door switch, 2 channels"],
  FB_EnableSwitch: ["safety mirror", "wrapper = FB_Safe2Ch", "3-position enabling switch"],
  FB_LightCurtain: ["safety mirror", "wrapper = FB_Safe2Ch (+ xWarn)", "light curtain OSSD1 / OSSD2"],
  FB_SafetyCoupling: ["safety mirror", "wrapper = 2 × FB_Safe2Ch", "safety coupling to the neighbour (EstopIn, ZoneFree)"],
  FB_ZoneOut: ["safety mirror", "wrapper = FB_Edm (bInverted TRUE)", "safe zone output with contactor mirror contacts"],
  FB_ContactorPair: ["safety mirror", "wrapper = FB_Edm (bInverted TRUE)", "two safety contactors in series with EDM"],
  FB_SafeValve: ["safety mirror", "wrapper = 2 × FB_Edm (bInverted FALSE)", "safety valve (dump valve) with position feedback"],
  FB_CmdIf: ["module standard", "own rule (D1)", "command interface of the module data block – 4-phase echo"],
  FB_AlarmMgr: ["module standard", "own rule (D2 + D3)", "alarm manager: AlarmNo / WarningNo / AlarmClass / reaction"],
  FB_PackMLCore: ["module standard", "part B", "PackML state machine of item 5 with alarm-class reaction and homing (D4) – rules and tests in part B"],
};
export const WRAP = { FB_Estop: "FB_Safe2Ch", FB_Door2Ch: "FB_Safe2Ch", FB_EnableSwitch: "FB_Safe2Ch", FB_LightCurtain: "FB_Safe2Ch", FB_SafetyCoupling: "FB_Safe2Ch",
  FB_ZoneOut: "FB_Edm", FB_ContactorPair: "FB_Edm", FB_SafeValve: "FB_Edm" };
// interfaces of the item 9 FBs and the module FBs (EX10A.fb_interfaces has the 17 FBs with tests)
export const IF_EXTRA = {
  FB_MotorDol: { in: ["xCmd", "xRunFb", "xTripped", "xReset"], out: ["qRun", "iState", "xError", "iAlarm"], cfg: { tFb_ms: 500 } },
  FB_AnalogIn: { in: ["iRaw", "rLo", "rHi"], out: ["rValue", "rmA", "iQuality", "xLimH", "xLimL", "iAlarm"], cfg: { rLimH: 0, rLimL: 0, rHyst: 0, iDelay: 0 } },
  FB_AlarmMgr: { in: ["iAlarm[1..n] of the device FBs", "iModuleAlarm"], out: ["iAlarmNo", "iWarningNo", "iAlarmClass", "iReaction"], cfg: { iModule: 2 } },
  FB_PackMLCore: { in: ["iCmdExec", "iAlarmClass", "xSC", "xHomed"], out: ["iState", "xExecute", "xResetting"], cfg: {} },
};
// alarm texts per FB type (local code a = 1..9); class = typical default (the module may change it, see 10I)
export const ALM10 = {
  FB_Valve1: [[1, "end position not reached", "B"], [2, "left the end position without command", "A"], [3, "both end switches on", "B"]],
  FB_Valve2: [[1, "end position not reached", "A"], [2, "left the end position without command", "A"], [3, "both end switches on", "B"]],
  FB_Sensor: [[1, "not plausible (set by the module, e.g. both pallet-side sensors on)", "C"]],
  FB_MotorDol: [[1, "no run feedback after start", "A"], [2, "run feedback lost while running", "A"], [3, "motor protection tripped", "A"], [4, "run feedback without command (contactor welded?)", "A"]],
  FB_DriveSto: [[1, "drive fault", "A"], [3, "ready lost while running", "A"]],
  FB_AnalogIn: [[1, "value not reached in the step (e.g. clamp pressure)", "B"], [2, "value lost while it is needed (e.g. pressure while cutting)", "A"], [3, "signal quality bad / uncertain (NE 43)", "C"]],
  FB_Heater: [[1, "over-temperature (safety thermostat)", "A"], [2, "no contactor feedback", "B"], [3, "temperature signal bad", "B"], [4, "feedback without command (contactor welded?)", "A"]],
  FB_PushButton: [],
  FB_SignalTower: [],
  FB_HandshakeHw: [[1, "partner did not start (busy missing)", "B"], [2, "job time-out", "B"], [3, "done not removed", "B"], [4, "partner fault", "A"]],
  FB_Feeder: [[1, "feeder breaker off", "C"]],
  FB_Ups: [[1, "UPS fault", "C"], [2, "on battery", "C"]],
  FB_Safe2Ch: [[1, "discrepancy between the two channels", "B"]],
  FB_ModeSwitch: [[1, "both key positions active (discrepancy)", "B"]],
  FB_Edm: [[1, "feedback does not follow (welded / not switching)", "A"]],
  FB_TwoHand: [[1, "not simultaneous – release both", "C"]],
  FB_Scanner: [[2, "invalid field set", "A"]],
  FB_DoorLock: [[1, "door switch discrepancy", "B"], [2, "lock switch discrepancy", "B"], [3, "locked but not closed (tongue missing / manipulation)", "A"]],
  FB_CmdIf: [[0, "rejected command → WarningNo = M×1000 + 900 + command (class C)", "C"]],
  MODULE: [[1, "not in home position (Resetting, decision D4)", "B"]],
};

/* ------------------------------------------------------------------ 10K library engineering */
export const VERSION10 = [
  ["MAJOR (2.0.0)", "interface changed: an input / output added, removed or renamed, meaning of a value changed", "every module that uses the FB must be re-tested; old and new can live side by side (FB_Valve2_V2)"],
  ["MINOR (1.1.0)", "new function, interface compatible (e.g. a new alarm code, a new cfg parameter with a default)", "unit tests of the FB + regression of one module per user"],
  ["PATCH (1.0.1)", "bug fix, same interface and same behaviour in the specified cases", "unit tests of the FB; release note names the bug"],
];
export const RELEASE10 = [
  "Change request with reason (bug report, new device, plant standard change) – ticket number",
  "Change in the library project only (never in a module copy), in a branch / own version",
  "Unit tests: all old tests green + a new test for the change (the test log is the proof)",
  "Code review by a second programmer with the checklist below",
  "Version number + release note (what, why, who, test log reference) in the FB header comment",
  "Library released (read-only, signed / checksum); modules update on purpose, never automatically",
  "Module regression test (part B virtual commissioning) before the update reaches a real machine",
];
export const REVIEW10 = [
  "Naming as 10A (prefixes, units in the name, device name = item 8 name)",
  "Every timer uses the cfg time and the counter rule n·T ≥ t (no hidden constants)",
  "Every alarm has a local code 1–9, a text and a default class – listed in the FB header",
  "Error does NOT switch outputs by itself – the module reacts by alarm class (exception: the device would be damaged, e.g. heater)",
  "Reset only on a RISING edge; no automatic restart after a reset (IEC 60204-1)",
  "Edges detected inside the FB (x AND NOT x_prev) – no edge FB per caller",
  "No access to global variables inside the FB – everything over the interface",
  "No safety function: safety signals are READ-ONLY copies from the F-program",
  "Initial values: every output defined after the first call (log line 'init')",
  "Unit test covers every alarm path, every reset path and the init state",
];
export const UNITTEST10 = [
  ["Arrange", "create the instance with the cfg of the test; inputs = defaults (_input_defaults)"],
  ["Act", "apply the events tick by tick (an event changes an input BEFORE the call of that tick), call the FB once per tick"],
  ["Assert", "the change log (tick + outputs that changed) must equal the expected log line by line"],
  ["Same in 3 places", "Python (tools/fmse), web (this page), PLC (tools/fmse/plc_lib, test POU in the simulator) – identical logs = the library is correct"],
];

/* ------------------------------------------------------------------ 10L commissioning tests per FB (SAT / IO check) */
export const COMM10 = {
  FB_Valve1: ["Manual mode: command B → solenoid LED on, cylinder moves, xAtB TRUE within tMove", "Command A → spring returns, xAtA TRUE", "Block the cylinder → alarm 1 after tMove_ms", "Move the cylinder by hand away from the end position → alarm 2 after tLost_ms", "xEnable FALSE (guard open) → solenoid off, cylinder goes to A (spring)"],
  FB_Valve2: ["Command B → qSolB, cylinder to B, xAtB", "Command A → qSolA, cylinder to A", "Disable while moving → both solenoids off, cylinder STOPS / holds (bistable)", "Block → alarm 1; both switches simulated → alarm 3"],
  FB_Sensor: ["Actuate the sensor: LED on sensor and input card, xValue after tOn_ms", "Release: xValue FALSE after tOff_ms", "Check the switching distance with the real part / pallet"],
  FB_MotorDol: ["Start: contactor pulls in, run feedback within 500 ms, direction of rotation correct", "Stop: feedback drops", "Trip the motor protection → alarm 3, no restart after reset", "Remove the aux contact wire → alarm 1 at the next start"],
  FB_DriveSto: ["STO active → wCtrl bit0 = 0, state NOT READY", "STO released + drive ready → READY", "Run command → RUNNING, speed / direction correct", "Simulate a drive fault → FAULT, alarm 1, acknowledge pulse wCtrl bit7"],
  FB_AnalogIn: ["Apply 4 / 12 / 20 mA with a calibrator → 0 / 50 / 100 % of the range", "Open the wire → quality BAD (NE 43 < 3.6 mA)", "Check limit alarms with hysteresis and delay"],
  FB_Heater: ["Enable → contactor on, feedback within 500 ms", "Temperature reaches the setpoint → off; falls below SP − hyst → on", "Trigger the safety thermostat → alarm 1, heater off", "Remove the feedback wire → alarm 2"],
  FB_PushButton: ["Press → xPressed, one xClick pulse", "Lamp modes 0 / 1 / 2 (off, on, blink 1 Hz)"],
  FB_SignalTower: ["Each PackML state → lamp pattern of 10J", "Class A / B alarm → red / yellow + horn; horn acknowledge", "Lamp test (all on)"],
  FB_HandshakeHw: ["Start a job: Request → partner Busy → Done → Ack → Done removed", "Partner does not answer → alarm 1 after tHs_ms", "Partner fault → alarm 4, reset pulse qReset"],
  FB_Feeder: ["Switch the feeder breaker off → xOk FALSE, alarm 1 after 200 ms", "On again → alarm clears"],
  FB_Ups: ["Switch mains off → on battery (alarm 2); after tBuffer_ms shutdown request", "UPS fault contact → alarm 1"],
  FB_Safe2Ch: ["Actuate the safety device → both channels open, xOk FALSE", "Close + reset → xOk TRUE", "Open ONE channel (bridge test plug) → discrepancy alarm after 500 ms; reset only after both channels were open"],
  FB_Estop: ["Press each e-stop: both channels open, F-program stops, mirror xOk FALSE", "Release + reset → xResetReq then xOk", "Discrepancy test with one channel"],
  FB_Door2Ch: ["Open the door → xOk FALSE", "Close + reset → xOk", "One-channel test → discrepancy"],
  FB_EnableSwitch: ["Positions 1-2-3: only middle position = xOk", "One channel → discrepancy"],
  FB_LightCurtain: ["Interrupt the field → OSSDs off, xOk FALSE", "Test rod over the full height (resolution)", "Muting / warning signal passed through"],
  FB_SafetyCoupling: ["E-stop of the neighbour → EstopIn open on both channels", "Zone free signal both directions", "Discrepancy test"],
  FB_ZoneOut: ["Switch the zone on: both contactors pull in, mirror contacts open", "Weld simulation (keep one mirror contact closed) → alarm 1 after 300 ms"],
  FB_ContactorPair: ["As FB_ZoneOut for the contactor pair of a motor / drive"],
  FB_SafeValve: ["Open the safety valve: position feedback TRUE within 300 ms", "Close → feedback FALSE", "Stuck valve simulation → alarm 1"],
  FB_ModeSwitch: ["Each key position → iMode 1 / 2 / 3", "Both inputs on (bridge) → alarm 1 after 500 ms"],
  FB_Scanner: ["Field set 1 / 2 selected → scanner shows the right field", "Person in the protective field → OSSD off", "Invalid combination → alarm 2"],
  FB_TwoHand: ["Both hands within 0.5 s → actuated", "One hand late → error, release both", "Release one hand → not actuated"],
  FB_DoorLock: ["Request access → unlock request, F-program unlocks after standstill", "Open + close the door → request done, locks again", "One switch of a pair → discrepancy alarm"],
  FB_CmdIf: ["Cell controller sends Start in Idle → CmdAck, state Starting", "Hold in Idle → CmdRej + WarningNo 900 + 4", "CC time-out test: no echo within 2 s → communication alarm in the CC"],
  FB_AlarmMgr: ["Force each device alarm → AlarmNo = M×1000 + 10·i + a and the HMI text", "Class A → Abort, class B → Hold, class C → warning only"],
};

/* ------------------------------------------------------------------ 10N checklists */
export const CHECKS10 = [
  ["Program standard (before coding)", ["Task plan with periods and priorities fixed (10A)", "Naming rules accepted by owner and integrator", "Decisions D1–D4 written into the FDS", "Data block with one writer per word signed off (10C)", "Alarm number ranges and classes defined per module (10I)"]],
  ["Library", ["Every device pattern of item 8 has exactly one FB type (10D)", "Every FB has interface, rule text, alarm table, ST source", "Unit tests of all FBs green in Python, web and PLC simulator (10E)", "Library version + release note, library is read-only for module projects (10K)", "Code review checklist done for every FB"]],
  ["Safety mirrors", ["The safety function itself is ONLY in the F-program (10G)", "Mirror FBs read F-copies only, they never write F-signals", "Discrepancy and EDM times equal to the F-program parameters", "Reset philosophy (manual reset after safety stop) identical in F- and standard program"]],
  ["Commissioning", ["Commissioning test list generated per module (10L)", "Every alarm triggered once on the real machine and seen in SCADA with the right number and text", "Signal tower patterns checked for every state (10J)", "Command echo tested with the real cell controller, including time-out (10H)"]],
];

/* ------------------------------------------------------------------ 10B D1 four-phase echo: frames for the animation */
// [phase label, CntrlCmd, CCR, CmdAck, CmdRej, state, warningNo, who acts, text]
export const ECHO_ACC = [
  ["0 idle", 0, 0, 0, 0, 4, 0, "–", "Module in Idle. Words 2 / 3 belong to the cell controller (CC), word 4 to the module. All bits 0."],
  ["1 CC request", 2, 1, 0, 0, 4, 0, "CC", "CC writes CntrlCmd = 2 (Start) AND sets word 3 bit0 CmdChangeRequest in ONE Modbus FC16 write (words 2–3)."],
  ["2 module echo", 2, 1, 1, 0, 3, 0, "Module", "Module scan sees the RISING edge of CmdChangeRequest, checks state + mode table (Idle + Start = allowed) → word 4 bit8 CmdAck = 1 and the PackML core executes Start in the same scan → state 3 Starting."],
  ["3 CC clears", 0, 0, 1, 0, 3, 0, "CC", "CC reads word 4, sees CmdAck → clears CmdChangeRequest and CntrlCmd = 0 (its own words only)."],
  ["4 module clears echo", 0, 0, 0, 0, 3, 0, "Module", "Module sees CmdChangeRequest = 0 → clears CmdAck (its own word). Handshake complete – a new command needs a new rising edge."],
];
export const ECHO_REJ = [
  ["0 idle", 0, 0, 0, 0, 4, 0, "–", "Module in Idle."],
  ["1 CC request", 4, 1, 0, 0, 4, 0, "CC", "CC writes CntrlCmd = 4 (Hold) + CmdChangeRequest in one FC16 write."],
  ["2 module echo", 4, 1, 0, 1, 4, 2904, "Module", "Hold is not allowed in Idle (no edge Idle → Holding) → word 4 bit9 CmdRej = 1, Admin.WarningNo = 2×1000 + 900 + 4 = 2904, the state does NOT change."],
  ["3 CC clears", 0, 0, 0, 1, 4, 2904, "CC", "CC sees CmdRej → clears its request; it logs 'command rejected' and does not retry blindly."],
  ["4 module clears echo", 0, 0, 0, 0, 4, 2904, "Module", "Module clears CmdRej. The warning stays until the next accepted command (class C, no state change)."],
];
