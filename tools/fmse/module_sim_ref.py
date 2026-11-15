"""Reference output of item 10B (module programs M01-M22, 22 normal + 8 fault scenarios, full logs).

Produced by the reference engine of the rules in examples/item10b_examples.json; module_sim.py (Python engine) and
module_codegen.py --verify (generated Structured Text run in st_sim.py) must reproduce it line by line.
"""

REF_10B = """\nNORMAL M01 MC01 | instances 4 | final Idle StateCurrent=4 AlarmNo=0 WarningNo=0 lines 30
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S10 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    3 SC: Starting -> Execute
    3 exec step S0 -> S5
    3 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    4 exec step S5 -> S10
    8 exec step S10 -> S20
    59 exec step S20 -> S0
    59 SC: Execute -> Completing
    59 state Completing StateCurrent=16 AlarmNo=0 WarningNo=0 Bits=34
    60 SC: Completing -> Complete
    60 state Complete StateCurrent=17 AlarmNo=0 WarningNo=0 Bits=36
    61 cc sends Reset
    61 cmd Reset accepted: Complete -> Resetting
    61 home step S0 -> S10
    61 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    62 cc clears request
    62 home step S10 -> S0
    62 SC: Resetting -> Idle
    62 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
NORMAL M02 APC01 | instances 5 | final Idle StateCurrent=4 AlarmNo=0 WarningNo=0 lines 30
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S10 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    3 SC: Starting -> Execute
    3 exec step S0 -> S10
    3 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    12 exec step S10 -> S20
    43 exec step S20 -> S30
    55 exec step S30 -> S0
    55 SC: Execute -> Completing
    55 state Completing StateCurrent=16 AlarmNo=0 WarningNo=0 Bits=34
    56 SC: Completing -> Complete
    56 state Complete StateCurrent=17 AlarmNo=0 WarningNo=0 Bits=36
    57 cc sends Reset
    57 cmd Reset accepted: Complete -> Resetting
    57 home step S0 -> S10
    57 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    58 cc clears request
    88 home step S10 -> S0
    88 SC: Resetting -> Idle
    88 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
NORMAL M03 POOL01 | instances 13 | final Idle StateCurrent=4 AlarmNo=0 WarningNo=0 lines 36
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S10 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 start step S0 -> S10
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    3 start step S10 -> S0
    3 SC: Starting -> Execute
    3 exec step S0 -> S10
    3 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    44 exec step S10 -> S20
    54 exec step S20 -> S30
    66 exec step S30 -> S40
    75 exec step S40 -> S50
    116 exec step S50 -> S60
    128 exec step S60 -> S70
    129 exec step S70 -> S0
    129 SC: Execute -> Completing
    129 state Completing StateCurrent=16 AlarmNo=0 WarningNo=0 Bits=34
    130 SC: Completing -> Complete
    130 state Complete StateCurrent=17 AlarmNo=0 WarningNo=0 Bits=36
    131 cc sends Reset
    131 cmd Reset accepted: Complete -> Resetting
    131 home step S0 -> S10
    131 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    132 cc clears request
    132 home step S10 -> S0
    132 SC: Resetting -> Idle
    132 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
NORMAL M08 ASRS01 | instances 15 | final Idle StateCurrent=4 AlarmNo=0 WarningNo=0 lines 36
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S10 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 start step S0 -> S10
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    3 start step S10 -> S0
    3 SC: Starting -> Execute
    3 exec step S0 -> S10
    3 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    44 exec step S10 -> S20
    55 exec step S20 -> S30
    65 exec step S30 -> S40
    76 exec step S40 -> S50
    85 exec step S50 -> S60
    126 exec step S60 -> S70
    127 exec step S70 -> S0
    127 SC: Execute -> Completing
    127 state Completing StateCurrent=16 AlarmNo=0 WarningNo=0 Bits=34
    128 SC: Completing -> Complete
    128 state Complete StateCurrent=17 AlarmNo=0 WarningNo=0 Bits=36
    129 cc sends Reset
    129 cmd Reset accepted: Complete -> Resetting
    129 home step S0 -> S10
    129 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    130 cc clears request
    130 home step S10 -> S0
    130 SC: Resetting -> Idle
    130 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
NORMAL M04 LS01 | instances 9 | final Idle StateCurrent=4 AlarmNo=0 WarningNo=0 lines 35
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S10 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    3 SC: Starting -> Execute
    3 exec step S0 -> S10
    3 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    4 exec step S10 -> S20
    13 exec step S20 -> S30
    40 event SET Release.xPb=1
    40 exec step S30 -> S40
    41 event SET Release.xPb=0
    52 exec step S40 -> S50
    73 exec step S50 -> S60
    74 exec step S60 -> S0
    74 SC: Execute -> Completing
    74 state Completing StateCurrent=16 AlarmNo=0 WarningNo=0 Bits=34
    75 SC: Completing -> Complete
    75 state Complete StateCurrent=17 AlarmNo=0 WarningNo=0 Bits=36
    76 cc sends Reset
    76 cmd Reset accepted: Complete -> Resetting
    76 home step S0 -> S10
    76 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    77 cc clears request
    77 home step S10 -> S0
    77 SC: Resetting -> Idle
    77 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
NORMAL M05 ROB01 | instances 8 | final Idle StateCurrent=4 AlarmNo=0 WarningNo=0 lines 31
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S10 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    3 SC: Starting -> Execute
    3 exec step S0 -> S5
    3 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    9 exec step S5 -> S10
    13 exec step S10 -> S20
    74 exec step S20 -> S30
    80 exec step S30 -> S0
    80 SC: Execute -> Completing
    80 state Completing StateCurrent=16 AlarmNo=0 WarningNo=0 Bits=34
    81 SC: Completing -> Complete
    81 state Complete StateCurrent=17 AlarmNo=0 WarningNo=0 Bits=36
    82 cc sends Reset
    82 cmd Reset accepted: Complete -> Resetting
    82 home step S0 -> S10
    82 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    83 cc clears request
    83 home step S10 -> S0
    83 SC: Resetting -> Idle
    83 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
NORMAL M06 AGVST01 | instances 6 | final Idle StateCurrent=4 AlarmNo=0 WarningNo=0 lines 31
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S10 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    3 SC: Starting -> Execute
    3 exec step S0 -> S10
    3 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    7 exec step S10 -> S20
    33 exec step S20 -> S30
    48 exec step S30 -> S40
    49 exec step S40 -> S0
    49 SC: Execute -> Completing
    49 state Completing StateCurrent=16 AlarmNo=0 WarningNo=0 Bits=34
    50 SC: Completing -> Complete
    50 state Complete StateCurrent=17 AlarmNo=0 WarningNo=0 Bits=36
    51 cc sends Reset
    51 cmd Reset accepted: Complete -> Resetting
    51 home step S0 -> S10
    51 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    52 cc clears request
    52 home step S10 -> S0
    52 SC: Resetting -> Idle
    52 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
NORMAL M07 CONV01 | instances 12 | final Idle StateCurrent=4 AlarmNo=0 WarningNo=0 lines 30
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S10 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    3 SC: Starting -> Execute
    3 exec step S0 -> S10
    3 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    24 exec step S10 -> S20
    50 exec step S20 -> S30
    55 exec step S30 -> S0
    55 SC: Execute -> Completing
    55 state Completing StateCurrent=16 AlarmNo=0 WarningNo=0 Bits=34
    56 SC: Completing -> Complete
    56 state Complete StateCurrent=17 AlarmNo=0 WarningNo=0 Bits=36
    57 cc sends Reset
    57 cmd Reset accepted: Complete -> Resetting
    57 home step S0 -> S10
    57 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    58 cc clears request
    58 home step S10 -> S0
    58 SC: Resetting -> Idle
    58 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
NORMAL M09 TOOL01 | instances 4 | final Idle StateCurrent=4 AlarmNo=0 WarningNo=0 lines 30
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S10 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    3 SC: Starting -> Execute
    3 exec step S0 -> S10
    3 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    4 exec step S10 -> S20
    8 exec step S20 -> S30
    39 exec step S30 -> S0
    39 SC: Execute -> Completing
    39 state Completing StateCurrent=16 AlarmNo=0 WarningNo=0 Bits=34
    40 SC: Completing -> Complete
    40 state Complete StateCurrent=17 AlarmNo=0 WarningNo=0 Bits=36
    41 cc sends Reset
    41 cmd Reset accepted: Complete -> Resetting
    41 home step S0 -> S10
    41 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    42 cc clears request
    42 home step S10 -> S0
    42 SC: Resetting -> Idle
    42 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
NORMAL M10 WASH01 | instances 10 | final Idle StateCurrent=4 AlarmNo=0 WarningNo=0 lines 36
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S10 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 start step S0 -> S10
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    10 start step S10 -> S0
    10 SC: Starting -> Execute
    10 exec step S0 -> S10
    10 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    30 exec step S10 -> S20
    41 exec step S20 -> S30
    81 exec step S30 -> S40
    101 exec step S40 -> S50
    112 exec step S50 -> S60
    132 exec step S60 -> S70
    133 exec step S70 -> S0
    133 SC: Execute -> Completing
    133 state Completing StateCurrent=16 AlarmNo=0 WarningNo=0 Bits=34
    134 SC: Completing -> Complete
    134 state Complete StateCurrent=17 AlarmNo=0 WarningNo=0 Bits=36
    135 cc sends Reset
    135 cmd Reset accepted: Complete -> Resetting
    135 home step S0 -> S10
    135 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    136 cc clears request
    136 home step S10 -> S0
    136 SC: Resetting -> Idle
    136 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
NORMAL M11 CMM01 | instances 4 | final Idle StateCurrent=4 AlarmNo=0 WarningNo=0 lines 31
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S10 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    3 SC: Starting -> Execute
    3 exec step S0 -> S10
    3 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    4 exec step S10 -> S15
    5 exec step S15 -> S20
    9 exec step S20 -> S30
    90 exec step S30 -> S0
    90 SC: Execute -> Completing
    90 state Completing StateCurrent=16 AlarmNo=0 WarningNo=0 Bits=34
    91 SC: Completing -> Complete
    91 state Complete StateCurrent=17 AlarmNo=0 WarningNo=0 Bits=36
    92 cc sends Reset
    92 cmd Reset accepted: Complete -> Resetting
    92 home step S0 -> S10
    92 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    93 cc clears request
    93 home step S10 -> S0
    93 SC: Resetting -> Idle
    93 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
NORMAL M12 MARK01 | instances 6 | final Idle StateCurrent=4 AlarmNo=0 WarningNo=0 lines 33
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S10 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    3 SC: Starting -> Execute
    3 exec step S0 -> S10
    3 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    4 exec step S10 -> S20
    11 exec step S20 -> S30
    14 exec step S30 -> S40
    18 exec step S40 -> S50
    39 exec step S50 -> S60
    46 exec step S60 -> S0
    46 SC: Execute -> Completing
    46 state Completing StateCurrent=16 AlarmNo=0 WarningNo=0 Bits=34
    47 SC: Completing -> Complete
    47 state Complete StateCurrent=17 AlarmNo=0 WarningNo=0 Bits=36
    48 cc sends Reset
    48 cmd Reset accepted: Complete -> Resetting
    48 home step S0 -> S10
    48 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    49 cc clears request
    49 home step S10 -> S0
    49 SC: Resetting -> Idle
    49 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
NORMAL M13 ST01 | instances 11 | final Idle StateCurrent=4 AlarmNo=0 WarningNo=0 lines 44
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S10 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    3 SC: Starting -> Execute
    3 exec step S0 -> S10
    3 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    4 exec step S10 -> S20
    30 event P CompA.value=1
    30 event P CompB.value=1
    30 exec step S20 -> S30
    36 event SET TwoHand.xLeft=1
    36 event SET TwoHand.xLeft2=1
    36 event SET TwoHand.xRight=1
    36 event SET TwoHand.xRight2=1
    36 exec step S30 -> S40
    40 event SET TwoHand.xLeft=0
    40 event SET TwoHand.xLeft2=0
    40 event SET TwoHand.xRight=0
    40 event SET TwoHand.xRight2=0
    45 exec step S40 -> S50
    54 exec step S50 -> S60
    58 exec step S60 -> S70
    99 exec step S70 -> S0
    99 SC: Execute -> Completing
    99 state Completing StateCurrent=16 AlarmNo=0 WarningNo=0 Bits=34
    100 SC: Completing -> Complete
    100 state Complete StateCurrent=17 AlarmNo=0 WarningNo=0 Bits=36
    101 cc sends Reset
    101 cmd Reset accepted: Complete -> Resetting
    101 home step S0 -> S10
    101 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    102 cc clears request
    102 home step S10 -> S0
    102 SC: Resetting -> Idle
    102 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
NORMAL M14 TEST01 | instances 9 | final Idle StateCurrent=4 AlarmNo=0 WarningNo=0 lines 33
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S10 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    3 SC: Starting -> Execute
    3 exec step S0 -> S10
    3 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    4 exec step S10 -> S20
    15 exec step S20 -> S30
    19 exec step S30 -> S40
    80 exec step S40 -> S50
    81 exec step S50 -> S60
    87 exec step S60 -> S0
    87 SC: Execute -> Completing
    87 state Completing StateCurrent=16 AlarmNo=0 WarningNo=0 Bits=34
    88 SC: Completing -> Complete
    88 state Complete StateCurrent=17 AlarmNo=0 WarningNo=0 Bits=36
    89 cc sends Reset
    89 cmd Reset accepted: Complete -> Resetting
    89 home step S0 -> S10
    89 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    90 cc clears request
    90 home step S10 -> S0
    90 SC: Resetting -> Idle
    90 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
NORMAL M15 WELD01 | instances 13 | final Idle StateCurrent=4 AlarmNo=0 WarningNo=0 lines 34
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10 skip
    0 home step S10 -> S20
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S20 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    3 SC: Starting -> Execute
    3 exec step S0 -> S10
    3 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    4 exec step S10 -> S20
    35 exec step S20 -> S30
    39 exec step S30 -> S40
    120 exec step S40 -> S50
    121 exec step S50 -> S0
    121 SC: Execute -> Completing
    121 state Completing StateCurrent=16 AlarmNo=0 WarningNo=0 Bits=34
    122 SC: Completing -> Complete
    122 state Complete StateCurrent=17 AlarmNo=0 WarningNo=0 Bits=36
    123 cc sends Reset
    123 cmd Reset accepted: Complete -> Resetting
    123 home step S0 -> S10
    123 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    124 cc clears request
    154 home step S10 -> S20
    155 home step S20 -> S0
    155 SC: Resetting -> Idle
    155 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
NORMAL M16 PRESS01 | instances 11 | final Idle StateCurrent=4 AlarmNo=0 WarningNo=0 lines 41
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S10 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 start step S0 -> S10
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    13 start step S10 -> S0
    13 SC: Starting -> Execute
    13 exec step S0 -> S10
    13 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    50 event SET TwoHand.xLeft=1
    50 event SET TwoHand.xLeft2=1
    50 event SET TwoHand.xRight=1
    50 event SET TwoHand.xRight2=1
    50 exec step S10 -> S20
    55 event SET TwoHand.xLeft=0
    55 event SET TwoHand.xLeft2=0
    55 event SET TwoHand.xRight=0
    55 event SET TwoHand.xRight2=0
    71 exec step S20 -> S30
    76 exec step S30 -> S40
    97 exec step S40 -> S0
    97 SC: Execute -> Completing
    97 state Completing StateCurrent=16 AlarmNo=0 WarningNo=0 Bits=34
    98 SC: Completing -> Complete
    98 state Complete StateCurrent=17 AlarmNo=0 WarningNo=0 Bits=36
    99 cc sends Reset
    99 cmd Reset accepted: Complete -> Resetting
    99 home step S0 -> S10
    99 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    100 cc clears request
    100 home step S10 -> S0
    100 SC: Resetting -> Idle
    100 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
NORMAL M17 UTIL01 | instances 5 | final Execute StateCurrent=6 AlarmNo=0 WarningNo=0 lines 17
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S10 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 start step S0 -> S10
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    8 start step S10 -> S0
    8 SC: Starting -> Execute
    8 exec step S0 -> S10
    8 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
NORMAL M18 SAFE01 | instances 9 | final Execute StateCurrent=6 AlarmNo=0 WarningNo=0 lines 17
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S10 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 start step S0 -> S10
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    3 start step S10 -> S0
    3 SC: Starting -> Execute
    3 exec step S0 -> S10
    3 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
NORMAL M19 CC01 | instances 1 | final Execute StateCurrent=6 AlarmNo=0 WarningNo=0 lines 15
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S10 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    3 SC: Starting -> Execute
    3 exec step S0 -> S10
    3 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
NORMAL M20 SCADA01 | instances 0 | final Execute StateCurrent=6 AlarmNo=0 WarningNo=0 lines 13
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    3 SC: Starting -> Execute
    3 exec step S0 -> S10
    3 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
NORMAL M21 MESCON01 | instances 0 | final Execute StateCurrent=6 AlarmNo=0 WarningNo=0 lines 13
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    3 SC: Starting -> Execute
    3 exec step S0 -> S10
    3 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
NORMAL M22 NET01 | instances 1 | final Execute StateCurrent=6 AlarmNo=0 WarningNo=0 lines 15
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S10 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    3 SC: Starting -> Execute
    3 exec step S0 -> S10
    3 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
FAULT M02 F1 rotate jams -> valve alarm 2011 class A -> Abort -> Clear -> Reset (homing) -> Start | final Idle StateCurrent=4 AlarmNo=0 WarningNo=0 lines 60
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S10 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    3 SC: Starting -> Execute
    3 exec step S0 -> S10
    3 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    12 exec step S10 -> S20
    30 event P Rotate.jam=1
    52 alarm ON 2011 class A Rotate: end position not reached
    52 internal Abort (alarm 2011): Execute -> Aborting
    52 state Aborting StateCurrent=8 AlarmNo=2011 WarningNo=0 Bits=42
    53 SC: Aborting -> Aborted
    53 state Aborted StateCurrent=9 AlarmNo=2011 WarningNo=0 Bits=40
    120 event P Rotate.jam=0
    130 cc sends Clear
    130 cmd Clear accepted: Aborted -> Clearing
    130 state Clearing StateCurrent=1 AlarmNo=2011 WarningNo=0 Bits=298
    131 cc clears request
    131 alarm OFF 2011
    131 SC: Clearing -> Stopped
    131 state Stopped StateCurrent=2 AlarmNo=0 WarningNo=0 Bits=32
    132 cc sends Reset
    132 cmd Reset accepted: Stopped -> Resetting
    132 home step S0 -> S10
    132 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    133 cc clears request
    163 home step S10 -> S0
    163 SC: Resetting -> Idle
    163 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    164 cc sends Start
    164 cmd Start accepted: Idle -> Starting
    164 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    165 cc clears request
    165 SC: Starting -> Execute
    165 exec step S0 -> S10
    165 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    174 exec step S10 -> S20
    205 exec step S20 -> S30
    217 exec step S30 -> S0
    217 SC: Execute -> Completing
    217 state Completing StateCurrent=16 AlarmNo=0 WarningNo=0 Bits=34
    218 SC: Completing -> Complete
    218 state Complete StateCurrent=17 AlarmNo=0 WarningNo=0 Bits=36
    219 cc sends Reset
    219 cmd Reset accepted: Complete -> Resetting
    219 home step S0 -> S10
    219 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    220 cc clears request
    250 home step S10 -> S0
    250 SC: Resetting -> Idle
    250 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
FAULT M02 F2 clamp pressure low -> module alarm 2004 class B -> Hold -> fixed -> Unhold repeats the step | final Idle StateCurrent=4 AlarmNo=0 WarningNo=0 lines 44
    0 event P ClampPress.v1=3.8
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S10 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    3 SC: Starting -> Execute
    3 exec step S0 -> S10
    3 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    12 exec step S10 -> S20
    43 exec step S20 -> S30
    74 alarm ON 2004 class B clamp pressure not reached in the clamp step
    74 internal Hold (alarm 2004): Execute -> Holding
    74 state Holding StateCurrent=10 AlarmNo=2004 WarningNo=0 Bits=42
    75 SC: Holding -> Held
    75 state Held StateCurrent=11 AlarmNo=2004 WarningNo=0 Bits=40
    100 event P ClampPress.v1=6.0
    110 cc sends Unhold
    110 cmd Unhold accepted: Held -> Unholding
    110 state Unholding StateCurrent=12 AlarmNo=2004 WarningNo=0 Bits=298
    111 cc clears request
    111 alarm OFF 2004
    111 SC: Unholding -> Execute
    111 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    112 exec step S30 -> S0
    112 SC: Execute -> Completing
    112 state Completing StateCurrent=16 AlarmNo=0 WarningNo=0 Bits=34
    113 SC: Completing -> Complete
    113 state Complete StateCurrent=17 AlarmNo=0 WarningNo=0 Bits=36
    114 cc sends Reset
    114 cmd Reset accepted: Complete -> Resetting
    114 home step S0 -> S10
    114 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    115 cc clears request
    145 home step S10 -> S0
    145 SC: Resetting -> Idle
    145 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
FAULT M04 F3 light curtain interrupted while the rotary indexes -> class B Hold -> Unhold | final Idle StateCurrent=4 AlarmNo=0 WarningNo=0 lines 49
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S10 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    3 SC: Starting -> Execute
    3 exec step S0 -> S10
    3 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    4 exec step S10 -> S20
    13 exec step S20 -> S30
    20 event SET Release.xPb=1
    20 exec step S30 -> S40
    21 event SET Release.xPb=0
    32 exec step S40 -> S50
    40 event SAFE Curtain=0
    41 alarm ON 4007 class B light curtain interrupted during rotation
    41 internal Hold (alarm 4007): Execute -> Holding
    41 state Holding StateCurrent=10 AlarmNo=4007 WarningNo=0 Bits=42
    42 SC: Holding -> Held
    42 state Held StateCurrent=11 AlarmNo=4007 WarningNo=0 Bits=40
    46 event SAFE Curtain=1
    50 cc sends Unhold
    50 cmd Unhold accepted: Held -> Unholding
    50 state Unholding StateCurrent=12 AlarmNo=4007 WarningNo=0 Bits=298
    51 cc clears request
    51 alarm OFF 4007
    51 SC: Unholding -> Execute
    51 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    60 exec step S50 -> S60
    61 exec step S60 -> S0
    61 SC: Execute -> Completing
    61 state Completing StateCurrent=16 AlarmNo=0 WarningNo=0 Bits=34
    62 SC: Completing -> Complete
    62 state Complete StateCurrent=17 AlarmNo=0 WarningNo=0 Bits=36
    63 cc sends Reset
    63 cmd Reset accepted: Complete -> Resetting
    63 home step S0 -> S10
    63 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    64 cc clears request
    64 home step S10 -> S0
    64 SC: Resetting -> Idle
    64 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
FAULT M06 F4 AGV never answers -> handshake alarm 6061 class B -> Hold; AGV back -> Unhold | final Idle StateCurrent=4 AlarmNo=0 WarningNo=0 lines 45
    0 event P Agv.dead=1
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S10 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    3 SC: Starting -> Execute
    3 exec step S0 -> S10
    3 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    24 alarm ON 6061 class B Agv: partner did not start (busy missing)
    24 internal Hold (alarm 6061): Execute -> Holding
    24 state Holding StateCurrent=10 AlarmNo=6061 WarningNo=0 Bits=42
    25 SC: Holding -> Held
    25 state Held StateCurrent=11 AlarmNo=6061 WarningNo=0 Bits=40
    60 event P Agv.dead=0
    70 cc sends Unhold
    70 cmd Unhold accepted: Held -> Unholding
    70 state Unholding StateCurrent=12 AlarmNo=6061 WarningNo=0 Bits=298
    71 cc clears request
    71 alarm OFF 6061
    71 SC: Unholding -> Execute
    71 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    75 exec step S10 -> S20
    101 exec step S20 -> S30
    116 exec step S30 -> S40
    117 exec step S40 -> S0
    117 SC: Execute -> Completing
    117 state Completing StateCurrent=16 AlarmNo=0 WarningNo=0 Bits=34
    118 SC: Completing -> Complete
    118 state Complete StateCurrent=17 AlarmNo=0 WarningNo=0 Bits=36
    119 cc sends Reset
    119 cmd Reset accepted: Complete -> Resetting
    119 home step S0 -> S10
    119 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    120 cc clears request
    120 home step S10 -> S0
    120 SC: Resetting -> Idle
    120 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
FAULT M10 F5 level low while washing -> module alarm 10004 class A -> Abort | final Idle StateCurrent=4 AlarmNo=0 WarningNo=0 lines 41
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S10 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 start step S0 -> S10
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    10 start step S10 -> S0
    10 SC: Starting -> Execute
    10 exec step S0 -> S10
    10 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    30 exec step S10 -> S20
    41 exec step S20 -> S30
    60 event P LevelLow.value=1
    61 alarm ON 10004 class A level low during washing
    61 internal Abort (alarm 10004): Execute -> Aborting
    61 state Aborting StateCurrent=8 AlarmNo=10004 WarningNo=0 Bits=42
    62 SC: Aborting -> Aborted
    62 state Aborted StateCurrent=9 AlarmNo=10004 WarningNo=0 Bits=40
    100 event P LevelLow.value=0
    110 cc sends Clear
    110 cmd Clear accepted: Aborted -> Clearing
    110 state Clearing StateCurrent=1 AlarmNo=10004 WarningNo=0 Bits=298
    111 cc clears request
    111 alarm OFF 10004
    111 SC: Clearing -> Stopped
    111 state Stopped StateCurrent=2 AlarmNo=0 WarningNo=0 Bits=32
    112 cc sends Reset
    112 cmd Reset accepted: Stopped -> Resetting
    112 home step S0 -> S10
    112 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    113 cc clears request
    113 home step S10 -> S0
    113 SC: Resetting -> Idle
    113 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
FAULT M16 F6 filter dirty (class C warning, no reaction) and oil level low (class A) | final Aborted StateCurrent=9 AlarmNo=16006 WarningNo=16005 lines 49
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S10 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 start step S0 -> S10
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    13 start step S10 -> S0
    13 SC: Starting -> Execute
    13 exec step S0 -> S10
    13 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    40 event P FilterDirty.value=1
    41 alarm ON 16005 class C oil filter dirty
    50 event SET TwoHand.xLeft=1
    50 event SET TwoHand.xLeft2=1
    50 event SET TwoHand.xRight=1
    50 event SET TwoHand.xRight2=1
    50 exec step S10 -> S20
    55 event SET TwoHand.xLeft=0
    55 event SET TwoHand.xLeft2=0
    55 event SET TwoHand.xRight=0
    55 event SET TwoHand.xRight2=0
    71 exec step S20 -> S30
    76 exec step S30 -> S40
    97 exec step S40 -> S0
    97 SC: Execute -> Completing
    97 state Completing StateCurrent=16 AlarmNo=0 WarningNo=16005 Bits=34
    98 SC: Completing -> Complete
    98 state Complete StateCurrent=17 AlarmNo=0 WarningNo=16005 Bits=36
    99 cc sends Reset
    99 cmd Reset accepted: Complete -> Resetting
    99 home step S0 -> S10
    99 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=16005 Bits=290
    100 cc clears request
    100 home step S10 -> S0
    100 SC: Resetting -> Idle
    100 state Idle StateCurrent=4 AlarmNo=0 WarningNo=16005 Bits=33
    150 event P OilLevel.value=0
    151 alarm ON 16006 class A oil level low
    151 internal Abort (alarm 16006): Idle -> Aborting
    151 state Aborting StateCurrent=8 AlarmNo=16006 WarningNo=16005 Bits=42
    152 SC: Aborting -> Aborted
    152 state Aborted StateCurrent=9 AlarmNo=16006 WarningNo=16005 Bits=40
FAULT M18 F7 cell e-stop pressed in Execute -> 18002 class A -> Abort; released, Clear (resets the e-stop mirror) -> Reset -> Start | final Execute StateCurrent=6 AlarmNo=0 WarningNo=0 lines 48
    0 cc sends Reset
    0 cmd Reset accepted: Stopped -> Resetting
    0 home step S0 -> S10
    0 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    1 cc clears request
    1 home step S10 -> S0
    1 SC: Resetting -> Idle
    1 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    2 cc sends Start
    2 cmd Start accepted: Idle -> Starting
    2 start step S0 -> S10
    2 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    3 cc clears request
    3 start step S10 -> S0
    3 SC: Starting -> Execute
    3 exec step S0 -> S10
    3 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    40 event SAFE Estop1=0
    41 alarm ON 18002 class A cell e-stop pressed
    41 internal Abort (alarm 18002): Execute -> Aborting
    41 state Aborting StateCurrent=8 AlarmNo=18002 WarningNo=0 Bits=42
    42 SC: Aborting -> Aborted
    42 state Aborted StateCurrent=9 AlarmNo=18002 WarningNo=0 Bits=40
    50 event SAFE Estop1=1
    60 cc sends Clear
    60 cmd Clear accepted: Aborted -> Clearing
    60 state Clearing StateCurrent=1 AlarmNo=18002 WarningNo=0 Bits=298
    61 cc clears request
    61 alarm OFF 18002
    61 SC: Clearing -> Stopped
    61 state Stopped StateCurrent=2 AlarmNo=0 WarningNo=0 Bits=32
    62 cc sends Reset
    62 cmd Reset accepted: Stopped -> Resetting
    62 home step S0 -> S10
    62 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    63 cc clears request
    63 home step S10 -> S0
    63 SC: Resetting -> Idle
    63 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    64 cc sends Start
    64 cmd Start accepted: Idle -> Starting
    64 start step S0 -> S10
    64 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    65 cc clears request
    65 start step S10 -> S0
    65 SC: Starting -> Execute
    65 exec step S0 -> S10
    65 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
FAULT M03 F8 wrong commands: Start in Stopped rejected (CmdRej, WarningNo 3902), Hold in Execute accepted, Unhold | final Idle StateCurrent=4 AlarmNo=0 WarningNo=0 lines 51
    0 cc sends Start
    0 cmd Start rejected in Stopped (WarningNo 3902)
    1 cc clears request
    5 cc sends Reset
    5 cmd Reset accepted: Stopped -> Resetting
    5 home step S0 -> S10
    5 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    6 cc clears request
    6 home step S10 -> S0
    6 SC: Resetting -> Idle
    6 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
    7 cc sends Start
    7 cmd Start accepted: Idle -> Starting
    7 start step S0 -> S10
    7 state Starting StateCurrent=3 AlarmNo=0 WarningNo=0 Bits=290
    8 cc clears request
    8 start step S10 -> S0
    8 SC: Starting -> Execute
    8 exec step S0 -> S10
    8 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    30 cc sends Hold
    30 cmd Hold accepted: Execute -> Holding
    30 state Holding StateCurrent=10 AlarmNo=0 WarningNo=0 Bits=290
    31 cc clears request
    31 SC: Holding -> Held
    31 state Held StateCurrent=11 AlarmNo=0 WarningNo=0 Bits=32
    40 cc sends Unhold
    40 cmd Unhold accepted: Held -> Unholding
    40 state Unholding StateCurrent=12 AlarmNo=0 WarningNo=0 Bits=290
    41 cc clears request
    41 SC: Unholding -> Execute
    41 state Execute StateCurrent=6 AlarmNo=0 WarningNo=0 Bits=34
    49 exec step S10 -> S20
    59 exec step S20 -> S30
    71 exec step S30 -> S40
    80 exec step S40 -> S50
    121 exec step S50 -> S60
    133 exec step S60 -> S70
    134 exec step S70 -> S0
    134 SC: Execute -> Completing
    134 state Completing StateCurrent=16 AlarmNo=0 WarningNo=0 Bits=34
    135 SC: Completing -> Complete
    135 state Complete StateCurrent=17 AlarmNo=0 WarningNo=0 Bits=36
    136 cc sends Reset
    136 cmd Reset accepted: Complete -> Resetting
    136 home step S0 -> S10
    136 state Resetting StateCurrent=15 AlarmNo=0 WarningNo=0 Bits=290
    137 cc clears request
    137 home step S10 -> S0
    137 SC: Resetting -> Idle
    137 state Idle StateCurrent=4 AlarmNo=0 WarningNo=0 Bits=33
"""
