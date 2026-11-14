# Interface sheets - FMS (machining)

51 interfaces. Letters: M mechanical, S signal, D data, U utility, F safety, N network.

| No. | Sheet | Module A | Module B | Letters | Content |
|---|---|---|---|---|---|
| 1 | [IF_M01_M02.md](IF_M01_M02.md) | M01 Machine tool (CNC) interface | M02 Automatic pallet changer (APC) | MS | Pallet hand-over on the machine table: locating cones, clamp; signals PalletAtMa... |
| 2 | [IF_M02_M03.md](IF_M02_M03.md) | M02 Automatic pallet changer (APC) | M03 Pallet rack / pallet pool + stacker | MS | Pallet transfer APC set-up station <-> stacker fork: transfer height, centring; ... |
| 3 | [IF_M03_M04.md](IF_M03_M04.md) | M03 Pallet rack / pallet pool + stacker | M04 Load / unload station | MS | Pallet transfer stacker <-> load station; signals PalletPresent, OperatorRelease... |
| 4 | [IF_M03_M08.md](IF_M03_M08.md) | M03 Pallet rack / pallet pool + stacker | M08 AS/RS (automatic storage) | MS | Load transfer pallet pool <-> AS/RS P&D station |
| 5 | [IF_M03_M10.md](IF_M03_M10.md) | M03 Pallet rack / pallet pool + stacker | M10 Washing / cleaning machine | MS | Pallet / part transfer to washer; signals ReadyToTake, WashProgram, WashDone |
| 6 | [IF_M03_M11.md](IF_M03_M11.md) | M03 Pallet rack / pallet pool + stacker | M11 Measuring station (CMM / gauging / vision) | MS | Pallet / part to measuring station; temperature equalisation; signals MeasProgra... |
| 7 | [IF_M06_M04.md](IF_M06_M04.md) | M06 AGV / AMR interface | M04 Load / unload station | MS | AGV docking at load station: guides, transfer height; handshake ReadyToGive/Take... |
| 8 | [IF_M06_M08.md](IF_M06_M08.md) | M06 AGV / AMR interface | M08 AS/RS (automatic storage) | MS | AGV docking at AS/RS P&D station |
| 9 | [IF_M09_M01.md](IF_M09_M01.md) | M09 Tool management | M01 Machine tool (CNC) interface | D | Tool ID, length, radius, remaining life -> CNC tool table |
| 10 | [IF_M11_M01.md](IF_M11_M01.md) | M11 Measuring station (CMM / gauging / vision) | M01 Machine tool (CNC) interface | D | Measured deviations -> tool / work offset correction in the CNC (closed loop), o... |
| 11 | [IF_M12_M04.md](IF_M12_M04.md) | M12 Marking & identification | M04 Load / unload station | SD | Pallet RFID read / serial marking at load station |
| 12 | [IF_M17_M01.md](IF_M17_M01.md) | M17 Utilities (air, coolant, chips, extraction) | M01 Machine tool (CNC) interface | SU | Coolant, chips, air; CoolantOK, ChipConveyorFault -> feed hold |
| 13 | [IF_M17_M10.md](IF_M17_M10.md) | M17 Utilities (air, coolant, chips, extraction) | M10 Washing / cleaning machine | SU | Wash water / extraction; level and temperature alarms |
| 14 | [IF_M18_M01.md](IF_M18_M01.md) | M18 Cell safety controller | M01 Machine tool (CNC) interface | F | Hard-wired / safety-bus: E-stop chain, door locks, light curtains, safe stop of ... |
| 15 | [IF_M18_M02.md](IF_M18_M02.md) | M18 Cell safety controller | M02 Automatic pallet changer (APC) | F | Hard-wired / safety-bus: E-stop chain, door locks, light curtains, safe stop of ... |
| 16 | [IF_M18_M03.md](IF_M18_M03.md) | M18 Cell safety controller | M03 Pallet rack / pallet pool + stacker | F | Hard-wired / safety-bus: E-stop chain, door locks, light curtains, safe stop of ... |
| 17 | [IF_M18_M04.md](IF_M18_M04.md) | M18 Cell safety controller | M04 Load / unload station | F | Hard-wired / safety-bus: E-stop chain, door locks, light curtains, safe stop of ... |
| 18 | [IF_M18_M06.md](IF_M18_M06.md) | M18 Cell safety controller | M06 AGV / AMR interface | F | Hard-wired / safety-bus: E-stop chain, door locks, light curtains, safe stop of ... |
| 19 | [IF_M18_M08.md](IF_M18_M08.md) | M18 Cell safety controller | M08 AS/RS (automatic storage) | F | Hard-wired / safety-bus: E-stop chain, door locks, light curtains, safe stop of ... |
| 20 | [IF_M18_M10.md](IF_M18_M10.md) | M18 Cell safety controller | M10 Washing / cleaning machine | F | Hard-wired / safety-bus: E-stop chain, door locks, light curtains, safe stop of ... |
| 21 | [IF_M18_M11.md](IF_M18_M11.md) | M18 Cell safety controller | M11 Measuring station (CMM / gauging / vision) | F | Hard-wired / safety-bus: E-stop chain, door locks, light curtains, safe stop of ... |
| 22 | [IF_M18_M12.md](IF_M18_M12.md) | M18 Cell safety controller | M12 Marking & identification | F | Hard-wired / safety-bus: E-stop chain, door locks, light curtains, safe stop of ... |
| 23 | [IF_M18_M17.md](IF_M18_M17.md) | M18 Cell safety controller | M17 Utilities (air, coolant, chips, extraction) | F | Hard-wired / safety-bus: E-stop chain, door locks, light curtains, safe stop of ... |
| 24 | [IF_M19_M01.md](IF_M19_M01.md) | M19 Cell controller (line PLC / cell computer) | M01 Machine tool (CNC) interface | D | Standard data block (guide 66 section 8): PackML state, commands, handshake bits... |
| 25 | [IF_M19_M02.md](IF_M19_M02.md) | M19 Cell controller (line PLC / cell computer) | M02 Automatic pallet changer (APC) | D | Standard data block (guide 66 section 8): PackML state, commands, handshake bits... |
| 26 | [IF_M19_M03.md](IF_M19_M03.md) | M19 Cell controller (line PLC / cell computer) | M03 Pallet rack / pallet pool + stacker | D | Standard data block (guide 66 section 8): PackML state, commands, handshake bits... |
| 27 | [IF_M19_M04.md](IF_M19_M04.md) | M19 Cell controller (line PLC / cell computer) | M04 Load / unload station | D | Standard data block (guide 66 section 8): PackML state, commands, handshake bits... |
| 28 | [IF_M19_M06.md](IF_M19_M06.md) | M19 Cell controller (line PLC / cell computer) | M06 AGV / AMR interface | D | Standard data block (guide 66 section 8): PackML state, commands, handshake bits... |
| 29 | [IF_M19_M08.md](IF_M19_M08.md) | M19 Cell controller (line PLC / cell computer) | M08 AS/RS (automatic storage) | D | Standard data block (guide 66 section 8): PackML state, commands, handshake bits... |
| 30 | [IF_M19_M09.md](IF_M19_M09.md) | M19 Cell controller (line PLC / cell computer) | M09 Tool management | D | Standard data block (guide 66 section 8): PackML state, commands, handshake bits... |
| 31 | [IF_M19_M10.md](IF_M19_M10.md) | M19 Cell controller (line PLC / cell computer) | M10 Washing / cleaning machine | D | Standard data block (guide 66 section 8): PackML state, commands, handshake bits... |
| 32 | [IF_M19_M11.md](IF_M19_M11.md) | M19 Cell controller (line PLC / cell computer) | M11 Measuring station (CMM / gauging / vision) | D | Standard data block (guide 66 section 8): PackML state, commands, handshake bits... |
| 33 | [IF_M19_M12.md](IF_M19_M12.md) | M19 Cell controller (line PLC / cell computer) | M12 Marking & identification | D | Standard data block (guide 66 section 8): PackML state, commands, handshake bits... |
| 34 | [IF_M19_M17.md](IF_M19_M17.md) | M19 Cell controller (line PLC / cell computer) | M17 Utilities (air, coolant, chips, extraction) | D | Standard data block (guide 66 section 8): PackML state, commands, handshake bits... |
| 35 | [IF_M19_M18.md](IF_M19_M18.md) | M19 Cell controller (line PLC / cell computer) | M18 Cell safety controller | D | Standard data block (guide 66 section 8): PackML state, commands, handshake bits... |
| 36 | [IF_M20_M19.md](IF_M20_M19.md) | M20 SCADA / HMI system | M19 Cell controller (line PLC / cell computer) | D | Overview, alarms, operator commands (via cell controller) |
| 37 | [IF_M21_M19.md](IF_M21_M19.md) | M21 MES / ERP connector | M19 Cell controller (line PLC / cell computer) | D | Jobs down, confirmations / quality / OEE up |
| 38 | [IF_M22_M01.md](IF_M22_M01.md) | M22 Network & IT/OT infrastructure | M01 Machine tool (CNC) interface | N | Switch port, VLAN, IP address, firewall conduit |
| 39 | [IF_M22_M03.md](IF_M22_M03.md) | M22 Network & IT/OT infrastructure | M03 Pallet rack / pallet pool + stacker | N | Switch port, VLAN, IP address, firewall conduit |
| 40 | [IF_M22_M04.md](IF_M22_M04.md) | M22 Network & IT/OT infrastructure | M04 Load / unload station | N | Switch port, VLAN, IP address, firewall conduit |
| 41 | [IF_M22_M06.md](IF_M22_M06.md) | M22 Network & IT/OT infrastructure | M06 AGV / AMR interface | N | Switch port, VLAN, IP address, firewall conduit |
| 42 | [IF_M22_M08.md](IF_M22_M08.md) | M22 Network & IT/OT infrastructure | M08 AS/RS (automatic storage) | N | Switch port, VLAN, IP address, firewall conduit |
| 43 | [IF_M22_M09.md](IF_M22_M09.md) | M22 Network & IT/OT infrastructure | M09 Tool management | N | Switch port, VLAN, IP address, firewall conduit |
| 44 | [IF_M22_M10.md](IF_M22_M10.md) | M22 Network & IT/OT infrastructure | M10 Washing / cleaning machine | N | Switch port, VLAN, IP address, firewall conduit |
| 45 | [IF_M22_M11.md](IF_M22_M11.md) | M22 Network & IT/OT infrastructure | M11 Measuring station (CMM / gauging / vision) | N | Switch port, VLAN, IP address, firewall conduit |
| 46 | [IF_M22_M12.md](IF_M22_M12.md) | M22 Network & IT/OT infrastructure | M12 Marking & identification | N | Switch port, VLAN, IP address, firewall conduit |
| 47 | [IF_M22_M17.md](IF_M22_M17.md) | M22 Network & IT/OT infrastructure | M17 Utilities (air, coolant, chips, extraction) | N | Switch port, VLAN, IP address, firewall conduit |
| 48 | [IF_M22_M18.md](IF_M22_M18.md) | M22 Network & IT/OT infrastructure | M18 Cell safety controller | N | Switch port, VLAN, IP address, firewall conduit |
| 49 | [IF_M22_M19.md](IF_M22_M19.md) | M22 Network & IT/OT infrastructure | M19 Cell controller (line PLC / cell computer) | N | Switch port, VLAN, IP address, firewall conduit |
| 50 | [IF_M22_M20.md](IF_M22_M20.md) | M22 Network & IT/OT infrastructure | M20 SCADA / HMI system | N | Switch port, VLAN, IP address, firewall conduit |
| 51 | [IF_M22_M21.md](IF_M22_M21.md) | M22 Network & IT/OT infrastructure | M21 MES / ERP connector | N | Switch port, VLAN, IP address, firewall conduit |
