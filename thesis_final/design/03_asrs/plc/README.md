# plc/ – stacker crane ASRS-RAW programs (final thesis item F3, sub-task C)

| File | Content |
|---|---|
| `asrs_crane.scl` | Siemens S7-1500, SCL external source: UDTs, FC_AsrsCoord, FB_Axis, FB_Fork, FB_AsrsType, DB ASRS_LINK, FB_Crane (state machine), OB1/OB30 call structure, alarm table |
| `asrs_crane_delta.st` | Delta AS300 / AS332T-A, ISPSoft ST: FC_AsrsCoordD, FB_AxisD, PRG_Crane – same states, detail codes and interlocks |
| `../asrs_sim.py` | Python mirror model + Modbus face (virtual crane) – **change it together with the PLC code** |
| `../out/plc_state_machine.svg` | state diagram (`python asrs_sim.py diagram`) |

Contract: `fmsctl/spec/regmap.py`, register map **V1.2b**:
- It equals V1.2a plus AS/RS commands 32 relocate and 33 park, status registers 304–309 and job parameters 405–409.
- The header value stays 0x0102, because the change is additive.
- The handshake, sequence guard, gateway watchdog, event block and job result come unchanged from the templates
  `fmsctl/plc/siemens_v12_interface.scl` / `delta_v12_interface.st`.
- In both templates, `FB_FmsIf_V12` got one new input, `AllowedCmdsHi` (bits for codes 32–63, default 0 = old
  behaviour).

**Not compiled in this project.** No TIA Portal or ISPSoft is available here. The logic was verified with the mirror
model (`python ../asrs_sim.py selftest`, 30/30). Compile it, fix version-specific syntax (marked CHECK), then run the FAT
list of guide 60.

## Import

**Siemens TIA Portal (V17 or newer, S7-1500)**
1. Project tree > External source files > Add new external file > `fmsctl/plc/siemens_v12_interface.scl` >
   right-click > *Generate blocks from source*.
2. The same for `asrs_crane.scl`. The order matters, because the crane blocks use `typFmsMapV12`.
3. Create the instance DBs `IDB_FmsComm`, `IDB_AsrsType`, `IDB_FmsIf`, `IDB_Crane`. Create OB30 (cyclic interrupt 10 ms).
4. Copy the OB1 / OB30 code from the end of `asrs_crane.scl`, and map the tags (table below).
5. `FMS_HR` must stay **non-optimized** (register n = DBW 2n). Check: DBW452 = register 226.

**Delta ISPSoft (AS series)**
1. New POUs:
   - FB_FmsIf_V12 and FB_FmsType from `fmsctl/plc/delta_v12_interface.st`;
   - FC_AsrsCoordD, FB_AxisD and PRG_Crane from `asrs_crane_delta.st`.
2. Main task: call FB_FmsIf_V12 with `TypeCode := 7, AllowedCmds := 16#C0000010, AllowedCmdsHi := 16#00000003`. Latch
   NewJob → gNewJob and AckAlarm → gAckAlarm. Pass gJobEnd → JobEnd, then clear gJobEnd.
3. Timed interrupt task 10 ms: PRG_Crane.
4. Built-in Modbus TCP server: holding register n = D n (D0–D449).

## I/O and tag mapping (to be aligned with the final I/O list of sub-task B, `asrs_elec.py`)

The names below are the program tags. Sub-task B owns the device tags (IEC 81346) and the addresses. Keep this table as
the link between them: when B renames a device, change only the right-hand columns.

| Program tag | Type | Meaning | Device (sub-task B) | S7 address | Delta address |
|---|---|---|---|---|---|
| iSafetyOk | BOOL | safety PLC: e-stop circuit closed, STO not active | -KF safety controller output | I 0.0 | X0.0 |
| iDoorClosed | BOOL | aisle access door locked (guard-locking feedback) | -SQ door switch (via safety PLC) | I 0.1 | X0.1 |
| iDrivesReady | BOOL | main contactor on, DC link OK | -QA main contactor aux. | I 0.2 | X0.2 |
| iAuto / iManual / iMaint | BOOL | mode selector / maintenance key | -SF mode selector, key switch | I 0.3–0.5 | X0.3–0.5 |
| iShiftOn | BOOL | shift / key switch ON | -SF | I 0.6 | X0.6 |
| iLaserX_m, iLaserValid | REAL, BOOL | laser distance meter travel axis (PROFINET / SSI) | -BG laser | telegram | D2000/D2002 |
| iBpsZ_m, iBpsValid | REAL, BOOL | barcode positioning system hoist | -BG BPS | telegram | D2004/D2006 |
| iForkPos_m | REAL | fork motor encoder | fork drive | telegram | D2008 |
| iForkCentre / iForkLeftEnd / iForkRightEnd | BOOL | fork position sensors | -BG inductive | I 1.0–1.2 | X1.0–1.2 |
| iForkOverLeft / iForkOverRight | BOOL (NC) | fork overtravel (also to the safety PLC) | -BG | I 1.3–1.4 | X1.3–1.4 |
| iLoadOnFork | BOOL | 2 load sensors AND-ed | -BG photoelectric ×2 | I 1.5 | X1.5 |
| iSlotOccLeft / iSlotOccRight | BOOL | look-ahead sensors into the rack slot (double occupancy, source empty) | -BG diffuse ×2 | I 1.6–1.7 | X1.6–1.7 |
| iLoadOverhang | BOOL | load protrudes over the fork (side light grid on the carriage) | -BG | I 2.0 | X2.0 |
| iInfeedLoad / iInfeedContourOk | BOOL | infeed P&D occupied / contour-weight-ID check passed (item F4) | conveyor PLC / -BG | I 2.1–2.2 | X2.1–2.2 |
| iOutfeedFree | BOOL | outfeed P&D free | conveyor PLC | I 2.3 | X2.3 |
| iTravelReady/Fault, iHoistReady/Fault, iForkReady/Fault | BOOL | drive status words | drives | telegram | D2010… |
| iJogXPlus … iJogForkR | BOOL | hold-to-run jog keys on the crane HMI (MANUAL only) | -SF | HMI | M… |
| qTravelSpeed / qHoistSpeed | REAL | speed setpoints (scale to the drive telegram, e.g. 16#4000 = 100 % = 3.0 / 1.0 m/s) | drives | telegram | D2100/D2102 |
| qTravelEnable / qHoistEnable | BOOL | drive enable (ON/OFF1) | drives | telegram | Y0.0–0.1 |
| qHoistBrakeRelease | BOOL | hoist brake release (drive brake control) | -QA brake | Q 0.2 | Y0.2 |
| qForkLeft / qForkRight / qForkFast | BOOL | fork drive direction + speed | fork drive | Q 0.3–0.5 | Y0.3–0.5 |
| qInfeedTake / qOutfeedPut | BOOL | handover signals to the conveyors (item F4) | conveyor PLC | Q 0.6–0.7 | Y0.6–0.7 |
| qLampFault | BOOL | red lamp on the crane / at the aisle door | -PF | Q 1.0 | Y1.0 |

## Commissioning order (cold → warm → hot)

1. **Cold, without power to the drives:**
   - every input is checked against the I/O list (toggle each sensor), and every output against its device;
   - E-stop and door read correctly (iSafetyOk, iDoorClosed);
   - the laser and BPS give plausible values at 3 known points.
2. **Safety first** (item F8, by the safety integrator):
   - E-stop, door guard locking, end-of-aisle overtravel, SLS in the end zones, slack rope / overload;
   - stop distances measured.
3. **Axes in MANUAL:** jog travel / hoist / fork at creep speed, check directions. Set the software limits
   (X 0–37.875 m, Z 0.30–11.90 m) inside the hardware limit switches.
4. **Teach and check the coordinates:** measure the real x / z of the reference columns 1, 19, 38 and levels 1, 5, 10.
   Compare them with `FC_AsrsCoord` (worked example: column 13 → 13.325 m, level 4 → 4.20 m). Correct the rack constant
   only if the rack tolerance (EN 15620) is exceeded.
5. **Single moves in AUTO** from the HMI test page:
   - fork in / out with an empty crate;
   - double-occupancy test (slot filled → detail 21);
   - source-empty test (detail 22).
6. **Interface test** with the virtual WMS:
   - `fmsctl` DeviceLink commands 30 / 31 / 32 / 33 / 4;
   - stale REQ, watchdog (stop the gateway heartbeat for more than 5 s);
   - rejected commands (`asrs.detail` 11 / 12 / 24).
7. **Performance test:** 50 single cycles to the FEM 9.851 points P1 / P2 (design: 41.0 s single, 67.9 s dual), then a
   1 h run at 45.5 moves per hour.

---

## Case B – expansion communication modules (guide 60 Part D)

Case A (above) uses only the built-in CPU ports. Case B adds communication modules to the PLC. The numbers come from
`../asrs_comm.py` (self-test 29/29) and `../out/comm/comm_report.md`.

| File | Content |
|---|---|
| `asrs_comm_b.scl` | **B1, Siemens S7-1500:** `FB_FmsCommCp` (MB_SERVER over the CP 1543-1), `typRtuSlave`, `FB_RtuPoller` (Modbus_Comm_Load + Modbus_Master on the CM PtP), `FC_RtuValid`, `FC_RegsToReal`, `FB_RtuDecode`, `FC_InfeedWeightCheck`, DB `RTU_SLAVES`, OB1/OB30 example |
| `asrs_comm_b_delta.st` | **B2, Delta AS on the crane:** `FB_RtuPollerD` (COM1, with a port adapter for MODRW), `FB_Cia402` (drive state machine), `PRG_CommB` (PDO mapping, velocity mode, weight check) |
| `../asrs_comm.py` | Python mirror (`Poller`, `infeed_weight_check`) and the virtual RS-485 line – **change it together with the PLC code** |

Register map V1.2b is **unchanged**. The CP gets the same address 10.70.20.51, so `fmsctl` needs no change. The
energy-meter and UPS values are for the HMI only; they are not in `regmap.py`.

### Import

**B1 (TIA Portal)**
1. Device view: insert the modules.
   - PS 60 W in slot 0;
   - -KF3 CP 1543-1: IP 10.70.20.51/24, firewall rules from `../out/comm/firewall_rules.csv`;
   - -KF4 CM 1542-1: PROFINET IO net 2, 192.168.1.1, conveyor devices of F4;
   - -KF5 CM PtP RS422/485 HF: RS-485 2-wire, 19 200 bit/s, 8E1;
   - CPU X2 changes to 192.168.10.1/24 (HMI and engineering port).
2. Generate the blocks from `asrs_comm_b.scl`, after `siemens_v12_interface.scl` and `asrs_crane.scl`.
3. In OB1, replace `"IDB_FmsComm"` by `"IDB_FmsCommCp"(CpHwId := <CP interface system constant>)`.
4. In OB30 (10 ms), call `"IDB_RtuPoller"`, `"IDB_RtuDecode"` and `"FC_InfeedWeightCheck"`, as at the end of the file.

**B2 (ISPSoft)**
1. Set up COM1 in HWCONFIG: Modbus RTU master, 19 200 bit/s, 8E1, timeout 200 ms, retry 0.
2. Insert the AS-FEN02 card (192.168.0.1, VLAN 721) and the AS-FCOPM card. In the CANopen Builder:
   - nodes 1–3 with the PDO mapping of `PRG_CommB`;
   - SYNC 10 ms, 500 kbit/s;
   - heartbeat 100 ms (producer) / 300 ms (consumer);
   - an initial SDO 0x6060 := 2.
3. Add the POUs from `asrs_comm_b_delta.st`, and write the port adapter (MODRW + the COM1 flags). In the 10 ms task,
   call `PRG_CommB` after `PRG_Crane`.

### Tags and addresses of the new modules

| Tag (IEC 81346) | Module / device | Address / setting | Program object |
|---|---|---|---|
| =ASRS1+GC-GB1 | PS 60 W (B1) | slot 0 | – |
| =ASRS1+GC-KF3 | CP 1543-1 (B1) | 10.70.20.51/24, TCP 502 | `FB_FmsCommCp`, InterfaceId = CP HW id |
| =ASRS1+GC-KF4 | CM 1542-1 (B1) | 192.168.1.1/24, PROFINET net 2 | device configuration only |
| =ASRS1+GC-KF5 | CM PtP RS485 HF (B1) | 19 200 8E1, bias + 120 Ω | `FB_RtuPoller.PortHwId` |
| =ASRS1+GC-PG1 | energy meter | RTU addr 1, FC03 reg 0, n 30, every 10 rounds | `RTU_SLAVES.S[1]` / D3000… (B2) |
| =ASRS1+GC-BW92T | weighing terminal | RTU addr 2, FC03 reg 0, n 4, every round; FC06 reg 10 = tare | `RTU_SLAVES.S[2]` |
| =ASRS1+GC-TB12 | 24 V DC UPS | RTU addr 3, FC03 reg 0, n 6, every 5 rounds; 120 Ω end | `RTU_SLAVES.S[3]` |
| =ASRS1+CC-KF2.C1 | AS-FEN02 (B2) | 192.168.0.1, VLAN 721 | HWCONFIG |
| =ASRS1+CC-KF2.C2 | AS-FCOPM (B2) | CANopen 500 kbit/s, nodes 1–3 | D24000… (TPDO) / D25000… (RPDO) |
| =ASRS1+GC-KF91 | external firewall (B2) | rules = `firewall_rules.csv` | – |

### Commissioning order for the communication modules

1. **RS-485 wiring, power off.**
   - Measure between D1 and D0 at the master: about **60 Ω** means both 120 Ω terminations are in. 120 Ω means one is
     missing; about 40 Ω means one too many.
   - Check that the bias is at the master only.
   - Check that the shield is clamped at both cabinet EMC rails.
2. **Power on, one slave at a time.** Set addresses 1/2/3 and 19 200 8E1 on each device. Then do an address scan:
   - with a service laptop and an RS-485 adapter; or
   - with the poller and only one slave connected (`NOk` counts, `NTo` stays 0).
3. **All slaves on the line.** Run 10 minutes with error counters `NErr` / `NTo` / `NCrc` = 0, and check the round times:
   - `LastRoundMs` ≤ 153 ms;
   - weighing window about 34 ms.
4. **Fault tests:**
   - unplug the energy meter → offline after 3 failed polls, the scale stays valid; plug it in → back online through the
     slow probe;
   - unplug the scale → `FC_InfeedWeightCheck` = NO_DATA, detail 23.
5. **CANopen (B2):**
   - with power off, about 60 Ω between CAN_H and CAN_L;
   - all nodes OPERATIONAL, bus load ≤ 50 % (design 33.5 %);
   - CiA 402 enable sequence 6 → 7 → 15 seen in the status word;
   - pull a node connector → drive fault → crane FAULT.
6. **CP firewall (B1) or the external firewall (B2):**
   - from 10.70.1.10, Modbus TCP 502 works (fmsctl DeviceLink reads register 0);
   - from any other address in VLAN 720, the connection is **refused / times out**, and the firewall logs it;
   - HTTPS 443 works only from 10.70.1.20.
7. Repeat the Case A interface test (step 6 of the list above) over the new link.
