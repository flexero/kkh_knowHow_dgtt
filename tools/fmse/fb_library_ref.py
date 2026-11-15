"""Reference values for the item-10A self-tests (fb_library.py, st_sim.py, plc_lib_check.py).

Not a CLI. REF_10A = the complete expected output of the item-10A rules (19 FB test logs, alarm manager log,
command matrix); REF_9_DEVICE = the expected FB_AnalogIn / limit alarm / FB_MotorDol lines of item 9
(device_fb.py rules). Both were produced by the reference implementation of the rules in
examples/item10a_examples.json and examples/item9_examples.json. Do not edit by hand: a change of a rule
changes these lines and the self-tests show it line by line.
"""

REF_10A = """\
TEST FB_Sensor | S1 debounce: bounce ignored, 300 ms on / 200 ms off | 3 lines
    0 init xValue=0
    6 xValue=1
    13 xValue=0
TEST FB_Valve1 | V1 normal: A -> B -> A | 5 lines
    0 init qSol=0 xAtA=1 xAtB=0 xBusy=0 xError=0 iAlarm=0
    2 qSol=1 xAtA=0 xBusy=1
    8 xAtB=1 xBusy=0
    15 qSol=0 xAtB=0 xBusy=1
    21 xAtA=1 xBusy=0
TEST FB_Valve1 | V2 jam: B not reached -> alarm 1 -> reset -> retry ok | 5 lines
    0 init qSol=0 xAtA=1 xAtB=0 xBusy=0 xError=0 iAlarm=0
    2 qSol=1 xAtA=0 xBusy=1
    21 xBusy=0 xError=1 iAlarm=1
    30 xBusy=1 xError=0 iAlarm=0
    36 xAtB=1 xBusy=0
TEST FB_Valve1 | V3 lost position + both switches + disable | 9 lines
    0 init qSol=0 xAtA=1 xAtB=0 xBusy=0 xError=0 iAlarm=0
    5 xAtA=0
    7 xError=1 iAlarm=2
    12 xAtA=1 xError=0 iAlarm=0
    20 xAtA=0
    21 xError=1 iAlarm=3
    26 xAtA=1
    27 xError=0 iAlarm=0
    32 xBusy=1
TEST FB_Valve2 | V4 bistable: disable holds, timer pauses | 9 lines
    0 init qSolA=1 qSolB=0 xAtA=1 xAtB=0 xBusy=0 xError=0 iAlarm=0
    2 qSolA=0 qSolB=1 xAtA=0 xBusy=1
    6 qSolB=0
    20 qSolB=1
    24 xAtB=1 xBusy=0
    30 qSolB=0
    35 xBusy=1
    38 qSolA=1 xAtB=0
    41 xAtA=1 xBusy=0
TEST FB_DriveSto | D1 STO release, run, STO stop, fault, reset | 12 lines
    0 init wCtrl=0 iState=0 xWarn=0 xError=0 iAlarm=0
    2 wCtrl=1
    3 iState=1
    5 wCtrl=3 iState=2
    10 wCtrl=0 iState=0 xWarn=1
    12 wCtrl=1 iState=1 xWarn=0
    13 wCtrl=3 iState=2
    15 wCtrl=1 iState=9 xError=1 iAlarm=1
    21 wCtrl=129 iState=0 xError=0 iAlarm=0
    22 wCtrl=1 iState=1
    23 wCtrl=3 iState=2
    25 wCtrl=1 iState=9 xError=1 iAlarm=3
TEST FB_Heater | H1 2-point control + no feedback + over-temperature | 10 lines
    0 init qOn=0 xError=0 iAlarm=0
    1 qOn=1
    10 qOn=0
    15 qOn=1
    19 qOn=0 xError=1 iAlarm=2
    24 qOn=1 xError=0 iAlarm=0
    30 qOn=0 xError=1 iAlarm=1
    38 qOn=1 xError=0 iAlarm=0
    39 qOn=0 xError=1 iAlarm=3
    43 xError=0 iAlarm=0
TEST FB_PushButton | P1 lamp modes and click | 8 lines
    0 init qLamp=0 xPressed=0 xClick=0
    1 qLamp=1
    4 xPressed=1 xClick=1
    5 qLamp=0 xClick=0
    6 xPressed=0
    10 qLamp=1
    14 qLamp=0 xPressed=1 xClick=1
    15 xClick=0
TEST FB_SignalTower | T1 states and alarm classes | 12 lines
    0 init qRed=0 qYellow=1 qGreen=0 qBuzzer=0
    2 qYellow=0
    4 qGreen=1
    5 qGreen=0
    10 qGreen=1
    15 qYellow=1 qBuzzer=1
    16 qGreen=0
    19 qBuzzer=0
    22 qRed=1 qBuzzer=1
    23 qYellow=0
    27 qRed=0 qBuzzer=0
    28 qYellow=1
TEST FB_HandshakeHw | HS1 normal job then partner never busy | 15 lines
    0 init qRequest=0 qAck=0 qEnable=0 qReset=0 iStep=0 xDoneOut=0 xError=0 iAlarm=0
    2 qRequest=1 qEnable=1 iStep=10
    4 iStep=20
    12 qRequest=0 qAck=1 qEnable=0 iStep=30
    15 qAck=0 iStep=0 xDoneOut=1
    16 xDoneOut=0
    20 qRequest=1 qEnable=1 iStep=10
    40 qRequest=0 qEnable=0 xError=1 iAlarm=1
    45 qReset=1 iStep=0 xError=0 iAlarm=0
    46 qReset=0
    50 qRequest=1 qEnable=1 iStep=10
    51 qRequest=0 qEnable=0 xError=1 iAlarm=4
    55 qReset=1 iStep=0 xError=0 iAlarm=0
    56 qRequest=1 qEnable=1 qReset=0 iStep=10
    57 iStep=20
TEST FB_Feeder | F1 breaker trips and comes back | 4 lines
    0 init xOk=1 iAlarm=0
    2 xOk=0
    3 iAlarm=1
    6 xOk=1 iAlarm=0
TEST FB_Ups | U1 mains loss shorter and longer than the buffer time | 7 lines
    0 init xShutdownReq=0 iAlarm=0
    2 iAlarm=2
    20 iAlarm=0
    25 iAlarm=2
    74 xShutdownReq=1
    80 iAlarm=1
    88 xShutdownReq=0 iAlarm=0
TEST FB_Safe2Ch | E1 e-stop: power-on reset, press, reset, discrepancy | 9 lines
    0 init xOk=0 xResetReq=0 xDiscErr=0 iAlarm=0
    1 xResetReq=1
    3 xOk=1 xResetReq=0
    8 xOk=0
    10 xResetReq=1
    12 xOk=1 xResetReq=0
    20 xOk=0
    24 xDiscErr=1 iAlarm=1
    37 xOk=1 xDiscErr=0 iAlarm=0
TEST FB_ModeSwitch | M1 key switch positions | 5 lines
    0 init iMode=3 xError=0 iAlarm=0
    2 iMode=1
    7 iMode=2
    14 xError=1 iAlarm=1
    17 iMode=3 xError=0 iAlarm=0
TEST FB_Edm | Z1 zone contactors follow, then one welds | 7 lines
    0 init xOn=0 xError=0 iAlarm=0
    3 xOn=1
    10 xOn=0
    16 xOn=1
    20 xOn=0
    22 xError=1 iAlarm=1
    28 xError=0 iAlarm=0
TEST FB_TwoHand | W1 simultaneous, then too slow, then release | 6 lines
    0 init xActuated=0 xError=0 iAlarm=0
    5 xActuated=1
    9 xActuated=0
    17 xError=1 iAlarm=1
    25 xError=0 iAlarm=0
    27 xActuated=1
TEST FB_Scanner | SC1 field switching and OSSD | 7 lines
    0 init qFieldA=1 qFieldB=0 xFree=0 xWarnOut=0 iAlarm=0
    1 xFree=1
    3 qFieldA=0 qFieldB=1
    5 xWarnOut=1
    6 xFree=0
    8 xFree=1 xWarnOut=0
    10 qFieldB=0 iAlarm=2
TEST FB_DoorLock | L1 access request, open, close | 8 lines
    0 init xClosedOk=1 xLockedOk=1 xUnlockReq=0 xError=0 iAlarm=0
    2 xUnlockReq=1
    5 xLockedOk=0
    8 xClosedOk=0
    15 xClosedOk=1 xUnlockReq=0
    17 xLockedOk=1
    20 xClosedOk=0 xError=1 iAlarm=3
    24 iAlarm=1
TEST FB_CmdIf | C1 4-phase command echo with accept and reject | 14 lines
    0 init xCmdAck=0 xCmdRej=0 iCmdExec=0 iLastCmd=0 iRejectCount=0
    2 xCmdRej=1 iLastCmd=2 iRejectCount=1
    4 xCmdRej=0
    6 xCmdAck=1 iCmdExec=1 iLastCmd=1
    7 iCmdExec=0
    8 xCmdAck=0
    14 xCmdAck=1 iCmdExec=2 iLastCmd=2
    15 iCmdExec=0
    16 xCmdAck=0
    20 xCmdRej=1 iLastCmd=4 iRejectCount=2
    22 xCmdRej=0
    24 xCmdAck=1 iCmdExec=3 iLastCmd=3
    25 iCmdExec=0
    27 xCmdAck=0
ALARM MANAGER
    10 on 2053 class C -> AlarmNo=0 WarningNo=2053 AlarmClass=3 reaction=none (warning)
    20 on 2021 class B -> AlarmNo=2021 WarningNo=2053 AlarmClass=2 reaction=Hold (if Execute)
    25 on 2011 class A -> AlarmNo=2011 WarningNo=2053 AlarmClass=1 reaction=Abort
    30 off 2021 class B -> AlarmNo=2011 WarningNo=2053 AlarmClass=1 reaction=Abort
    32 off 2011 class A -> AlarmNo=0 WarningNo=2053 AlarmClass=3 reaction=none (warning)
    40 on 2051 class B -> AlarmNo=2051 WarningNo=2053 AlarmClass=2 reaction=Hold (if Execute)
    45 on 2052 class A -> AlarmNo=2052 WarningNo=2053 AlarmClass=1 reaction=Abort
    50 off 2052 class A -> AlarmNo=2051 WarningNo=2053 AlarmClass=2 reaction=Hold (if Execute)
    55 off 2051 class B -> AlarmNo=0 WarningNo=2053 AlarmClass=3 reaction=none (warning)
    60 off 2053 class C -> AlarmNo=0 WarningNo=0 AlarmClass=0 reaction=none
CMD MATRIX (Production): rows state, accepted commands
    Clearing ['Abort']
    Stopped ['Reset', 'Abort']
    Starting ['Stop', 'Abort']
    Idle ['Start', 'Stop', 'Abort']
    Suspended ['Stop', 'Unsuspend', 'Abort']
    Execute ['Stop', 'Hold', 'Suspend', 'Abort']
    Stopping ['Abort']
    Aborting []
    Aborted ['Clear']
    Holding ['Stop', 'Abort']
    Held ['Stop', 'Unhold', 'Abort']
    Unholding ['Stop', 'Abort']
    Suspending ['Stop', 'Abort']
    Unsuspending ['Stop', 'Abort']
    Resetting ['Stop', 'Abort']
    Completing ['Stop', 'Abort']
    Complete ['Reset', 'Stop', 'Abort']
"""

REF_9_DEVICE = """\
ai -6000 0.528 BAD fault low (wire break) -2.17 0.0
ai -500 3.711 UNCERTAIN under range -0.181 0.0
ai -300 3.826 GOOD ok -0.109 0.0
ai 0 4.0 GOOD ok 0.0 0.0
ai 6912 8.0 GOOD ok 2.5 2.5
ai 13824 12.0 GOOD ok 5.0 5.0
ai 20736 16.0 GOOD ok 7.5 7.5
ai 27648 20.0 GOOD ok 10.0 10.0
ai 28800 20.667 UNCERTAIN over range 10.417 10.0
ai 30000 21.361 BAD fault high 10.851 0.0
ai 32767 22.962 BAD fault high 11.851 0.0
lim 0 2.5 0 0
lim 1 2.9 0 1
lim 2 3.1 0 1
lim 3 4.0 0 0
lim 4 6.0 0 0
lim 5 7.9 0 0
lim 6 8.0 0 0
lim 7 8.1 1 0
lim 8 7.9 1 0
lim 9 8.05 1 0
lim 10 7.85 1 0
lim 11 7.75 0 0
lim 12 5.0 0 0
lim 13 3.0 0 0
lim 14 2.95 0 1
lim 15 3.25 0 0
limev [(1, 'L on'), (3, 'L off'), (7, 'H on'), (11, 'H off'), (14, 'L on'), (15, 'L off')]
motor A Normal start and stop final STOPPED alarm 0 Run 0 lines 6
    2 event CMD_ON
    2 STOPPED -> STARTING
    4 STARTING -> RUNNING
    20 event CMD_OFF
    20 RUNNING -> STOPPING
    21 STOPPING -> STOPPED
motor B No run feedback (auxiliary contact broken) final STOPPED alarm 0 Run 0 lines 15
    0 event FB_BROKEN
    2 event CMD_ON
    2 STOPPED -> STARTING
    7 STARTING -> FAULT alarm 1 no run feedback after start
    15 event RESET
    15 FAULT -> STOPPED reset accepted
    18 event CMD_OFF
    20 event FB_OK
    22 event RESET
    25 event CMD_ON
    25 STOPPED -> STARTING
    27 STARTING -> RUNNING
    35 event CMD_OFF
    35 RUNNING -> STOPPING
    36 STOPPING -> STOPPED
motor C Feedback lost while running final RUNNING alarm 0 Run 1 lines 12
    2 event CMD_ON
    2 STOPPED -> STARTING
    4 STARTING -> RUNNING
    12 event FB_BROKEN
    12 RUNNING -> FAULT alarm 2 run feedback lost while running
    16 event FB_OK
    18 event RESET
    18 FAULT -> STOPPED reset accepted
    20 event CMD_OFF
    22 event CMD_ON
    22 STOPPED -> STARTING
    24 STARTING -> RUNNING
motor D Motor protection trips, no restart after reset final RUNNING alarm 0 Run 1 lines 14
    2 event CMD_ON
    2 STOPPED -> STARTING
    4 STARTING -> RUNNING
    10 event TRIP
    10 RUNNING -> FAULT alarm 3 motor protection tripped
    14 event RESET
    14 reset rejected (alarm 3)
    16 event TRIP_CLEAR
    18 event RESET
    18 FAULT -> STOPPED reset accepted
    22 event CMD_OFF
    25 event CMD_ON
    25 STOPPED -> STARTING
    27 STARTING -> RUNNING
motor E Contactor welded final FAULT alarm 4 Run 0 lines 9
    2 event CMD_ON
    2 STOPPED -> STARTING
    4 STARTING -> RUNNING
    8 event WELD
    12 event CMD_OFF
    12 RUNNING -> STOPPING
    17 STOPPING -> FAULT alarm 4 run feedback without command (contactor welded?)
    25 event RESET
    25 reset rejected (alarm 4)
"""
