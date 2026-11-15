/* FMS engineering – item 6 deep sections 6G–6N: data.  Guide: docs/FMS system design/66_communication.md.
 * EX6 = faithful copy of tools/fmse/examples/item6_examples.json (shared inputs + exact formulas; the guide and tools/fmse/*.py use the same).
 * The texts below are typical values / good practice – always confirm with the device manuals and suppliers. */

/* ------------------------------------------------------------------ shared example (copy of item6_examples.json) */
export const EX6 = {
 "_note": "Shared worked-example inputs for FMS engineering item 6 (communication): guide docs/FMS system design/66_communication.md, tools/fmse/*.py, web/fmse6x*.js. All values are EXAMPLES. Everything here is deterministic: guide, tools and web must give IDENTICAL results (including the handshake log line by line). The 4 basic calculators of web/fmse6.js (CALC pn, ec, mb, hi) keep their formulas exactly - repeated below.",
 "_formulas": {
  "pn_load": "frame = max(64, io + 10 + 22) ; wire = frame + 20 ; bps = dev*wire*8/(cyc_ms/1000) ; load = bps/(spd_Mbit*1e6) ; verdict OK if load < 0.5",
  "ec_cycle": "bytes = max(84, 14 + 2 + 12 + dev*bytes_per_slave + 4 + 20) ; t_wire_us = bytes*8/spd_Mbit ; t_us = t_wire_us + dev*fwd_us ; cycle_min_us = 1.25*t_us ; verdict <250 motion at 250 us, <1000 1 ms possible, else split",
  "mb_poll": "req = ceil(regs/125) ; tr = rtt + resp [ms] ; cycle = ceil(dev/max(1,conn))*req*tr [ms] ; updates/s = 1000/cycle ; request 12 bytes, response 9 + 2*min(regs,125) bytes ; verdict <=100 handshakes ok, <=500 monitoring",
  "hist_volume": "vps = tags*rate ; net_kbit = vps*bytes*8/1000 ; GB_day = vps*bytes*86400*comp/1e9 ; total = GB_day*days ; verdict < 500 GB fits",
  "latency": "t_tx = wire_bytes*8/R ; base latency = (hops+1)*t_tx + hops*t_sw + length_m*5e-9 s (5 ns/m in copper or fibre) ; worst case with ONE maximum frame (max_wire_bytes) already being sent at each egress port = base + hops*max_wire_bytes*8/R (priority does not pre-empt a frame in transmission; IRT / TSN time slots remove this term). Report in microseconds.",
  "iolink": "approximate M-sequence time: master_bytes = 2 + pd_out ; device_bytes = od + pd_in + 1 ; bits = 11*(master_bytes + device_bytes) + 10 ; t_msg = bits/baud ; cycle = max(t_msg, device_min_cycle) ; for each COM rate (COM1 4800, COM2 38400, COM3 230400 bit/s)",
  "opcua_load": "notifications/s = items/(sampling_ms/1000)*change_ratio ; publish messages/s = subscriptions/(publishing_ms/1000) ; bytes/s = notifications/s*bytes_per_notification + messages/s*overhead_per_message ; kbit/s = bytes/s*8/1000",
  "mqtt_load": "msg_bytes = 2 + (len(topic) + 2) + metrics_per_msg*bytes_per_metric + sparkplug_header ; in msgs/s = edges*rate ; in B/s = in msgs/s*msg_bytes ; out B/s = in B/s*subscribers ; total kbit/s = (in + out)*8/1000",
  "fibre": "loss = length_km*att_db_km + connectors*conn_db + splices*splice_db ; budget = tx_min_dbm - rx_sens_dbm ; margin = budget - loss ; OK if margin >= 3 dB",
  "subnet": "CIDR a.b.c.d/p: mask = p ones ; network = ip AND mask ; broadcast = network OR NOT mask ; usable hosts = 2^(32-p) - 2 (p <= 30) ; first = network+1, last = broadcast-1 ; overlap of two subnets = one network contains the other's network address",
  "ip_plan": "exactly as web/fmse6.js drawIP: third octet = vlan % 256 ; subnet 10.site.third.0/24 ; gateway .1 ; counters per module code give unit = UNIT code + 2-digit number ; for each device of MODDEV[module] (in order) take the next free address of its range group (RANGES start .10/.50/.100/.150/.200/.240) ; tag = cell.unit ; if beyond the range end -> 'range full!'",
  "profinet_name": "PROFINET device name = lower-case '<cell>-<unit>-<slug>' where slug = device name in lower case, every run of characters outside a-z0-9 replaced by one '-', leading/trailing '-' removed ; rules: only a-z 0-9 '-' '.', each label <= 63, total <= 240, not starting with 'port-' ; e.g. FMS1 MC01 'PLC (machine)' -> fms1-mc01-plc-machine",
  "modbus_encode": "INT -> one register two's complement 16 bit ; UINT/WORD -> one register ; DINT -> two registers HIGH WORD FIRST (this standard, 'ABCD') ; REAL -> IEEE 754 single, two registers high word first ; register bytes big-endian. Word-order variants for teaching: ABCD (standard), CDAB (word swap), BADC (byte swap), DCBA (both).",
  "modbus_frames": "MBAP = transaction id (2) + protocol id 0 (2) + length (2) = bytes that follow (unit id + PDU) + unit id (1). FC03 request PDU = 03 start(2) qty(2) ; response = 03 bytecount(1) data. FC06 request/response = 06 addr(2) value(2). FC16 request = 10 start(2) qty(2) bytecount(1) data ; response = 10 start(2) qty(2). Exception response = (fc + 0x80) code. Codes: 01 illegal function, 02 illegal data address, 03 illegal data value (e.g. qty 0 or > 125 for FC03, > 123 for FC16), 04 server device failure. Order of checks in the example server: function supported -> quantity valid (03) -> address range inside the map (02) -> write allowed (only words with direction in or in/out, else 02). Frames written as upper-case hex bytes separated by one space.",
  "risk": "risk = likelihood (1-5) * consequence (1-5) ; class high >= 15, medium 8-14, low <= 7 ; SL-T from the initial class: high 3, medium 2, low 1 ; residual likelihood = max(1, L - sum of countermeasure points) ; residual risk = residual L * C (same classes) ; zone SL-T = max SL-T of the threats of the zone",
  "firewall": "rules are checked top-down, FIRST MATCH wins ; a rule field matches if equal or '*' ; no match -> default deny (rule id 'DEFAULT') ; flows inside one zone are not filtered (not tested here). Audit: an ALLOW rule whose zones are not neighbours (list 'neighbours', either direction) -> finding 'crosses zones' ; an ALLOW rule with service '*' -> finding 'any service'.",
  "handshake_sim": "see handshake_sim._rules"
 },
 "net_calc": {
  "pn": [
   {
    "dev": 30,
    "io": 32,
    "cyc": 2,
    "spd": 100,
    "_case": "web default"
   },
   {
    "dev": 60,
    "io": 250,
    "cyc": 1,
    "spd": 100,
    "_case": "big drives + robots at 1 ms"
   }
  ],
  "ec": [
   {
    "dev": 40,
    "bytes": 16,
    "spd": 100,
    "fwd": 0.6,
    "_case": "web default"
   },
   {
    "dev": 100,
    "bytes": 8,
    "spd": 100,
    "fwd": 0.6,
    "_case": "100 IO terminals"
   }
  ],
  "mb": [
   {
    "dev": 20,
    "regs": 60,
    "resp": 8,
    "rtt": 1,
    "conn": 4,
    "_case": "web default"
   },
   {
    "dev": 20,
    "regs": 60,
    "resp": 8,
    "rtt": 1,
    "conn": 1,
    "_case": "one connection only"
   },
   {
    "dev": 15,
    "regs": 200,
    "resp": 8,
    "rtt": 1,
    "conn": 5,
    "_case": "15 modules, 200 registers each"
   }
  ],
  "hi": [
   {
    "tags": 3000,
    "rate": 1,
    "bytes": 16,
    "days": 730,
    "comp": 0.3,
    "_case": "web default"
   },
   {
    "tags": 3000,
    "rate": 10,
    "bytes": 16,
    "days": 730,
    "comp": 1.0,
    "_case": "everything at 100 ms, no deadband"
   }
  ],
  "latency": {
   "wire_bytes": 84,
   "R_Mbit": 100,
   "hops": 10,
   "t_sw_us": 3,
   "length_m": 200,
   "max_wire_bytes": 1538,
   "_case": "line of 10 devices with 2-port switches (PROFINET line)"
  },
  "iolink": {
   "pd_in": 2,
   "pd_out": 0,
   "od": 1,
   "device_min_cycle_ms": 1.0,
   "rates": [
    [
     "COM1",
     4800
    ],
    [
     "COM2",
     38400
    ],
    [
     "COM3",
     230400
    ]
   ]
  },
  "opcua": {
   "items": 600,
   "sampling_ms": 250,
   "change_ratio": 0.2,
   "bytes_per_notification": 30,
   "subscriptions": 15,
   "publishing_ms": 500,
   "overhead_per_message": 150,
   "_case": "cell controller subscribes 15 modules x 40 items"
  },
  "mqtt": {
   "edges": 20,
   "rate": 1,
   "topic": "spBv1.0/PLT1/DDATA/CC1/MC01",
   "metrics_per_msg": 50,
   "bytes_per_metric": 12,
   "sparkplug_header": 10,
   "subscribers": 3
  },
  "fibre": {
   "length_km": 0.3,
   "att_db_km": 3.5,
   "connectors": 4,
   "conn_db": 0.75,
   "splices": 2,
   "splice_db": 0.1,
   "tx_min_dbm": -9.5,
   "rx_sens_dbm": -17.0,
   "_case": "multimode OM3 850 nm between hall switch and cell cabinet"
  }
 },
 "subnet": {
  "cidrs": [
   "10.1.101.0/24",
   "10.1.101.64/26",
   "10.1.30.0/23",
   "192.168.10.130/25"
  ],
  "plan": [
   "10.1.10.0/24",
   "10.1.20.0/24",
   "10.1.30.0/24",
   "10.1.101.0/24",
   "10.1.101.128/25",
   "10.1.102.0/24"
  ],
  "devices": [
   [
    "FMS1.MC01 CNC",
    "10.1.101.150"
   ],
   [
    "FMS1.MC02 CNC",
    "10.1.101.151"
   ],
   [
    "FMS1.POOL01 PLC",
    "10.1.101.10"
   ],
   [
    "FMS1.CC01 Cell controller",
    "10.1.101.10"
   ],
   [
    "FMS1.LS01 HMI",
    "10.1.101.100"
   ]
  ]
 },
 "ip_plan": {
  "site": 1,
  "kit": "FMS (3 HMCs + pool + AGV)",
  "cell": "FMS1",
  "vlan": 101,
  "_source": "KITS, MODDEV, RANGES, ZONES and UNIT of web/fmse6_data.js / web/fmse6.js - read them there"
 },
 "datablock": {
  "_source": "BLOCK and EXTRA of web/fmse6_data.js (words 0-19 standard, 20+ module part)",
  "module": "M01",
  "unit": "MC02",
  "unit_id": 1,
  "base": 0,
  "values": {
   "Status.StateCurrent": 6,
   "Status.UnitModeCurrent": 1,
   "Command.CntrlCmd": 0,
   "Command.Bits": 0,
   "Status.Bits": 98,
   "Command.UnitMode": 1,
   "Admin.AlarmNo": 0,
   "Admin.WarningNo": 0,
   "Admin.ProdProcessedCount": 1412,
   "Admin.ProdDefectiveCount": 23,
   "Job.Id": 70001,
   "Job.PalletId": 3,
   "Status.LastCycle_s": 1834.5,
   "Status.Heartbeat": 4711,
   "Command.Heartbeat": 4710
  },
  "_values": "Status.Bits 98 = 0x0062 = Busy + Auto + PartPresent ; state 6 = Execute ; module part (words 20-24) = 0",
  "word_order_demo": {
   "DINT": 70001,
   "REAL": 1834.5
  },
  "frames": [
   {
    "name": "Read standard block (words 0-19)",
    "tid": 1,
    "fc": 3,
    "start": 0,
    "qty": 20
   },
   {
    "name": "Command Start: CntrlCmd = 2 + CmdChangeRequest (words 2-3)",
    "tid": 2,
    "fc": 16,
    "start": 2,
    "values": [
     2,
     1
    ]
   },
   {
    "name": "Job download: Job.Id 70002 + PalletId 4 (words 12-15)",
    "tid": 3,
    "fc": 16,
    "start": 12,
    "values": [
     1,
     4466,
     0,
     4
    ]
   },
   {
    "name": "Too many registers (qty 200)",
    "tid": 4,
    "fc": 3,
    "start": 0,
    "qty": 200
   },
   {
    "name": "Address outside the map",
    "tid": 5,
    "fc": 3,
    "start": 1000,
    "qty": 10
   },
   {
    "name": "Write to a read-only word (StateCurrent)",
    "tid": 6,
    "fc": 6,
    "start": 0,
    "value": 5
   }
  ],
  "_frames": "server = the module MC02 with the values above; map size = 20 + module part (M01: words 20-24 -> 25 registers); FC03 response data = the encoded registers"
 },
 "naming": {
  "site": "PLT1",
  "area": "MACH",
  "cell": "FMS1",
  "sparkplug_group": "FMS1",
  "sparkplug_edge": "CC1"
 },
 "security": {
  "zones": [
   [
    "ent",
    "Enterprise (L4)"
   ],
   [
    "dmz",
    "Industrial DMZ (L3.5)"
   ],
   [
    "mfg",
    "Manufacturing (L3)"
   ],
   [
    "eng",
    "Engineering"
   ],
   [
    "c1",
    "Cell FMS1 (L1-2)"
   ],
   [
    "c2",
    "Cell ASM1 (L1-2)"
   ],
   [
    "saf",
    "Safety FMS1"
   ],
   [
    "inet",
    "Internet / supplier"
   ]
  ],
  "neighbours": [
   [
    "ent",
    "dmz"
   ],
   [
    "dmz",
    "mfg"
   ],
   [
    "mfg",
    "c1"
   ],
   [
    "mfg",
    "c2"
   ],
   [
    "eng",
    "c1"
   ],
   [
    "eng",
    "c2"
   ],
   [
    "c1",
    "saf"
   ]
  ],
  "rules": [
   [
    "R01",
    "ent",
    "*",
    "dmz",
    "API proxy",
    "https",
    "allow",
    "ERP -> MES API proxy"
   ],
   [
    "R02",
    "dmz",
    "API proxy",
    "mfg",
    "MES server",
    "https",
    "allow",
    "proxy -> MES"
   ],
   [
    "R03",
    "dmz",
    "Jump host",
    "mfg",
    "*",
    "rdp",
    "allow",
    "remote service, MFA, time window, recorded"
   ],
   [
    "R04",
    "dmz",
    "Jump host",
    "c1",
    "*",
    "rdp",
    "allow",
    "remote service directly into the cell"
   ],
   [
    "R05",
    "mfg",
    "*",
    "c1",
    "*",
    "opcua",
    "allow",
    "MES / SCADA <-> cell controller, CNC"
   ],
   [
    "R06",
    "mfg",
    "*",
    "c1",
    "*",
    "modbus-read",
    "allow",
    "SCADA monitoring (DPI firewall sees FC03/FC04)"
   ],
   [
    "R07",
    "mfg",
    "*",
    "c1",
    "*",
    "modbus-write",
    "deny",
    "writes only through the cell controller"
   ],
   [
    "R08",
    "eng",
    "Engineering WS",
    "c1",
    "*",
    "s7",
    "allow",
    "PLC programming in an approved window"
   ],
   [
    "R09",
    "c1",
    "Cell controller",
    "saf",
    "*",
    "modbus-read",
    "allow",
    "safety status read only"
   ],
   [
    "R10",
    "*",
    "*",
    "saf",
    "*",
    "*",
    "deny",
    "no other access to the safety zone"
   ],
   [
    "R11",
    "mfg",
    "Historian",
    "dmz",
    "Historian mirror",
    "repl",
    "allow",
    "one-way replication outwards"
   ],
   [
    "R12",
    "c1",
    "*",
    "mfg",
    "NTP server",
    "ntp",
    "allow",
    "time synchronisation"
   ],
   [
    "R13",
    "c1",
    "*",
    "mfg",
    "Syslog server",
    "syslog",
    "allow",
    "security / event logs"
   ],
   [
    "R14",
    "*",
    "*",
    "inet",
    "*",
    "*",
    "deny",
    "nothing to the internet (logged)"
   ],
   [
    "R15",
    "eng",
    "Engineering WS",
    "c1",
    "*",
    "*",
    "allow",
    "temporary 'allow all' left after commissioning"
   ]
  ],
  "_rules": "[id, src zone, src host, dst zone, dst host, service, action, note]",
  "flows": [
   [
    "Office PC",
    "ent",
    "Cell PLC",
    "c1",
    "s7"
   ],
   [
    "ERP server",
    "ent",
    "API proxy",
    "dmz",
    "https"
   ],
   [
    "API proxy",
    "dmz",
    "MES server",
    "mfg",
    "https"
   ],
   [
    "MES server",
    "mfg",
    "Cell controller",
    "c1",
    "opcua"
   ],
   [
    "SCADA server",
    "mfg",
    "MC02 CNC",
    "c1",
    "opcua"
   ],
   [
    "SCADA server",
    "mfg",
    "Stacker PLC",
    "c1",
    "modbus-write"
   ],
   [
    "SCADA server",
    "mfg",
    "Stacker PLC",
    "c1",
    "modbus-read"
   ],
   [
    "Supplier laptop",
    "inet",
    "Robot controller",
    "c1",
    "rdp"
   ],
   [
    "Jump host",
    "dmz",
    "Robot controller",
    "c1",
    "rdp"
   ],
   [
    "Engineering WS",
    "eng",
    "Cell PLC",
    "c1",
    "s7"
   ],
   [
    "Cell PLC",
    "c1",
    "Cloud broker",
    "inet",
    "mqtts"
   ],
   [
    "Historian",
    "mfg",
    "Historian mirror",
    "dmz",
    "repl"
   ],
   [
    "Office PC",
    "ent",
    "Safety PLC",
    "saf",
    "modbus-write"
   ],
   [
    "Cell controller",
    "c1",
    "Safety PLC",
    "saf",
    "modbus-read"
   ],
   [
    "Cell PLC",
    "c1",
    "NTP server",
    "mfg",
    "ntp"
   ],
   [
    "Office PC",
    "ent",
    "MES server",
    "mfg",
    "https"
   ],
   [
    "Engineering WS",
    "eng",
    "Safety PLC",
    "saf",
    "s7"
   ]
  ],
  "_flows": "[source host, source zone, destination host, destination zone, service]",
  "threats": [
   [
    "Ransomware from the office reaches MES / SCADA",
    "mfg",
    4,
    5,
    [
     [
      "DMZ + default-deny firewalls",
      2
     ],
     [
      "Patching + offline back-ups",
      1
     ]
    ]
   ],
   [
    "Supplier remote access misused",
    "c1",
    3,
    4,
    [
     [
      "Jump host, MFA, recorded sessions",
      2
     ]
    ]
   ],
   [
    "Infected USB stick on an HMI",
    "c1",
    4,
    4,
    [
     [
      "USB port control",
      2
     ],
     [
      "Application whitelisting",
      1
     ]
    ]
   ],
   [
    "Unauthorised Modbus write to a module",
    "c1",
    3,
    5,
    [
     [
      "DPI firewall: writes only from the cell controller",
      2
     ]
    ]
   ],
   [
    "Safety PLC parameter changed",
    "saf",
    3,
    5,
    [
     [
      "Local password + safety checksum monitoring",
      2
     ]
    ]
   ],
   [
    "Spoofed MES job (wrong NC program)",
    "mfg",
    2,
    4,
    [
     [
      "OPC UA Sign & Encrypt + certificates",
      1
     ]
    ]
   ],
   [
    "Network loop / broadcast storm",
    "c1",
    3,
    3,
    [
     [
      "Managed switches: storm control + ring protocol",
      1
     ]
    ]
   ],
   [
    "Engineering laptop with malware",
    "eng",
    3,
    4,
    [
     [
      "Dedicated engineering workstations",
      1
     ],
     [
      "Offline virus scan station",
      1
     ]
    ]
   ],
   [
    "Historian data copied by outsiders",
    "dmz",
    3,
    2,
    [
     [
      "Read-only mirror, no plant access",
      1
     ]
    ]
   ]
  ],
  "_threats": "[threat, zone, likelihood 1-5, consequence 1-5, countermeasures [name, likelihood reduction]]"
 },
 "handshake_sim": {
  "K": 250,
  "tick_ms": 100,
  "hs_timeout_ticks": 20,
  "job_timeout_ticks": 80,
  "hb_period_ticks": 10,
  "hb_timeout_ticks": 30,
  "scenarios": [
   {
    "name": "A Normal: 3 jobs",
    "jobs": [
     70001,
     70002,
     70003
    ],
    "exec_ticks": 50,
    "events": []
   },
   {
    "name": "B Module PLC stops for 6 s (cable pulled / PLC STOP)",
    "jobs": [
     70001,
     70002,
     70003
    ],
    "exec_ticks": 50,
    "events": [
     [
      80,
      "MOD_FREEZE"
     ],
     [
      140,
      "MOD_RESUME"
     ]
    ]
   },
   {
    "name": "C Module does not answer the request",
    "jobs": [
     70001,
     70002,
     70003
    ],
    "exec_ticks": 50,
    "events": [
     [
      50,
      "IGNORE_REQ_ON"
     ],
     [
      100,
      "IGNORE_REQ_OFF"
     ],
     [
      120,
      "CC_RESET"
     ]
    ]
   },
   {
    "name": "D Cell controller stops for 5 s",
    "jobs": [
     70001,
     70002,
     70003
    ],
    "exec_ticks": 50,
    "events": [
     [
      100,
      "CC_FREEZE"
     ],
     [
      150,
      "CC_RESUME"
     ]
    ]
   }
  ],
  "_rules": [
   "Discrete ticks k = 0,1,...,K; one tick = 100 ms = the poll period of the cell controller (CC). Two actors: CC and the module (MOD). CC image (written only by CC): Request, Ack, JobId, HB (heartbeat counter). MOD image (written only by MOD): Ready, Busy, Done, HSReady, HB, JobId. Initial: CC image all 0; MOD image Ready=1, others 0; MOD state IDLE; CC state S0; watch timers last=0, seen=0.",
   "ONE-TICK DELAY: at the start of tick k take snapshots snc (CC image) and snm (MOD image) = values at the end of tick k-1. Both actors decide ONLY on the snapshot of the other side and write their own image (visible to the other side at tick k+1). Order inside a tick (also the log order): 1 events, 2 MOD, 3 CC.",
   "1 EVENTS with time k in list order: MOD_FREEZE (module PLC stops: MOD does nothing at all, its image and HB stay frozen; remember freeze start f); MOD_RESUME (MOD runs again; set MOD watch timer last=k and seen=snc.HB; if MOD state EXEC: end = end + (k - f)); CC_FREEZE / CC_RESUME (same for CC: on resume CC sets last=k, seen=snm.HB and continues in its stored state); IGNORE_REQ_ON / IGNORE_REQ_OFF (module fault: MOD does not accept a request while ON); CC_RESET (operator reset: if CC state is ERR -> state S0, state timer = k). Log 'k EVENT <kind>'.",
   "2 MOD (skip if frozen): (a) heartbeat: if k>0 and k % hb_period_ticks == 0 -> MOD.HB += 1. (b) watch CC heartbeat: if snc.HB != seen -> seen = snc.HB, last = k. If not lost and k - last >= hb_timeout_ticks -> lost, log 'MOD CC_LOSS', if state IDLE set Ready=0. Else if lost and last == k -> not lost, log 'MOD CC_OK', if state IDLE set Ready=1. (c) state machine, at most ONE transition per tick, checked in this order: IDLE and not lost and not ignoring and snc.Request==1 -> JobId=snc.JobId, HSReady=1, Busy=1, Ready=0, state ACCEPT, log 'MOD ACCEPT <job>'. ACCEPT and snc.Request==0 -> HSReady=0, end = k + exec_ticks, state EXEC, log 'MOD START <job>'. EXEC and k >= end -> Busy=0, Done=1, state DONE, log 'MOD DONE <job>'. DONE and snc.Ack==1 -> Done=0, Ready = 0 if lost else 1, state IDLE, log 'MOD RELEASE <job>'.",
   "3 CC (skip if frozen): (a) heartbeat: if k>0 and k % hb_period_ticks == 0 -> CC.HB += 1. (b) watch MOD heartbeat: if snm.HB != seen -> seen = snm.HB, last = k. If not lost and k - last >= hb_timeout_ticks -> lost, Request=0, Ack=0, if state != ERR then state OFFLINE (timer k), log 'CC COMM_LOSS'; nothing else this tick. Else if lost and last == k -> not lost, log 'CC COMM_OK', then if state OFFLINE do RESYNC: snm.Done==1 -> Ack=1, state S4, log 'CC RESYNC_DONE <job>'; else snm.Busy==1 -> state S3, log 'CC RESYNC_BUSY <job>'; else state S0, log 'CC RESYNC_IDLE' and the current job (if any) goes back to the FRONT of the job queue; nothing else this tick. While lost: nothing else.",
   "(c) CC state machine (state timer t = tick of the last state change; success condition is checked BEFORE the timeout): S0 WAIT_READY: if jobs remain and snm.Ready==1 and snm.Busy==0 -> take the first job, JobId=job, Request=1, state S1, log 'CC REQUEST <job>'. S1 WAIT_ACCEPT: snm.HSReady==1 -> Request=0, state S2, log 'CC ACCEPTED <job>'; else if k - t >= hs_timeout_ticks -> Request=0, state ERR, the job goes back to the FRONT of the queue, log 'CC HS_TIMEOUT S1 <job>'. S2 WAIT_RELEASE: snm.HSReady==0 -> state S3, log 'CC RUNNING <job>'; else timeout -> ERR, log 'CC HS_TIMEOUT S2 <job>'. S3 WAIT_DONE: snm.Done==1 -> Ack=1, state S4, log 'CC DONE <job>'; else if k - t >= job_timeout_ticks -> ERR, log 'CC JOB_TIMEOUT <job>'. S4 WAIT_DONE_CLEAR: snm.Done==0 -> Ack=0, state S0, job completed at tick k, log 'CC COMPLETE <job>'; else timeout -> Ack=0, ERR, log 'CC HS_TIMEOUT S4 <job>'. ERR: nothing (waits for CC_RESET).",
   "KPIs per scenario: log lines, completed jobs with completion tick, final CC state, number of HS/JOB timeouts, comm-loss detection delay = tick of 'CC COMM_LOSS' (or 'MOD CC_LOSS') minus the freeze tick. Log line format: '<k> <text>' with k integer ticks."
  ]
 }
};

/* ------------------------------------------------------------------ use cases per section [domain, text] */
export const USES6 = {
  G: [["FMS with 3 HMCs", "Check before ordering switches: PROFINET line of 10 drives gives 105 µs base latency, but 1.3 ms worst case if a big frame (camera, file transfer) shares the line – so cameras get their own port or VLAN."],
    ["Assembly line", "OPC UA subscription load of 15 stations × 40 items is only ~150 kbit/s – the real limit is the number of monitored items a small PLC server can handle (often 500–2000)."],
    ["Factory-wide data platform", "MQTT / Sparkplug with 20 edge nodes and 3 subscribers = ~410 kbit/s at the broker – any broker handles it; plan for the burst after a broker restart (all BIRTH messages at once)."],
    ["Cabling between halls", "Fibre margin of 3.25 dB is just above the 3 dB rule – one more patch panel (2 connectors) would make it fail; use single-mode or fewer connectors on long runs."],
    ["IP planning", "Run the overlap and duplicate checks on the supplier's IP lists before the SAT – a duplicate address shows up as 'device works sometimes'."]],
  H: [["Modbus TCP plant", "Print the encoded register table and the FC03 response of every module in the interface sheet – the commissioning engineer compares it byte by byte with the Wireshark capture."],
    ["Gateway to an old machine", "Many gateways use word swap (CDAB) by default – the word-order demo shows the typical wrong values (Job.Id 70001 read as 292 618 241)."],
    ["Cell controller programming", "Write only the 'in' words; the frame builder shows that a write to StateCurrent is refused with exception 02 – the module protects its own status."]],
  I: [["Pallet hand-over", "The same 4-step handshake (Request → HSReady → Done → Ack) is used for pallet transfer between stacker and machine, AGV docking and robot loading."],
    ["Commissioning test", "Pull the module's network cable for 6 s (scenario B) at the FAT: the cell controller must report COMM_LOSS after 3 s and resume the running job without a double start."],
    ["Software test", "The simulation log is the reference: the real cell controller must write the same lines in the same order."]],
  J: [["Supplier contract", "The interface sheet (CSV) is an annex of each module purchase order – the supplier fills in his PLC addresses and signs it."],
    ["SCADA / historian engineering", "The same list imports into the SCADA tag database and the historian; the 48-character tag limit is checked before import."],
    ["PROFINET commissioning", "Device names follow one rule (fms1-mc01-plc-machine) – the 'assign device name' step in the engineering tool becomes copy and paste."]],
  K: [["Firewall commissioning", "Test every flow of the conduit list with the rule tester before switching the firewall to default deny – the tester shows which rule matched."],
    ["Annual security audit", "The audit finds rules that cross zones (direct DMZ → cell) and 'allow any service' rules left from commissioning."],
    ["IEC 62443 risk assessment", "The risk table gives the target security level (SL-T) per zone – the basis for the supplier requirements (IEC 62443-4-2 components)."]],
  L: [["Network specification", "Copy the design rules of each protocol into the network specification of the FMS (one chapter per protocol)."],
    ["Fault finding", "The typical-fault lists are the first page of the service manual for the maintenance team."]],
  M: [["FAT / SAT", "Tick the interface checklist together with the supplier; the saved state shows open points."],
    ["Maintenance", "The decision trees guide a technician from 'no communication' to the cause in a fixed order – physical layer first."]],
  N: [["Investment decision", "Compare the three case architectures with your own constraints (PLC brand, IT rules, CNC brands) before writing the specification."]],
};

/* ------------------------------------------------------------------ 6K IEC 62443-3-3 foundational requirements */
export const FR7 = [
  ["FR1", "Identification and authentication control (IAC)", "Who is it? Every person and device is identified before access.", "Personal accounts on HMIs, engineering stations and the jump host; no shared 'admin'; MFA for remote access."],
  ["FR2", "Use control (UC)", "What may they do? Rights per role, least privilege.", "Operator may start / stop, only the engineer may change PLC programs; write access to modules only for the cell controller."],
  ["FR3", "System integrity (SI)", "Are software and data unchanged?", "Signed firmware, application whitelisting on PCs, PLC program checksums compared after every change, USB control."],
  ["FR4", "Data confidentiality (DC)", "Can others read it?", "OPC UA Sign & Encrypt, TLS for MQTT / HTTP, NC programs and recipes not readable from the office."],
  ["FR5", "Restricted data flow (RDF)", "Zones and conduits.", "VLAN per cell, firewalls between zones, default deny, no direct office → cell path, DMZ for everything that leaves."],
  ["FR6", "Timely response to events (TRE)", "Do we see an attack and react?", "Syslog of firewalls and switches to a log server, alarm on new devices / failed logins, incident plan."],
  ["FR7", "Resource availability (RA)", "Does it keep running?", "Storm control and ring protocols, redundant power, back-ups of all PLC / CNC / robot programs, tested restore."],
];

/* ------------------------------------------------------------------ 6L protocol deep cards */
export const PCARDS = [
  { id: "iol", name: "IO-Link (IEC 61131-9)",
    how: "Point-to-point serial link on a normal 3-wire sensor cable (24 V, C/Q line, max 20 m, unshielded). The IO-Link master port polls its one device cyclically with M-sequences: the master sends a message (control + checksum + output data), the device answers (input data + on-request data + checksum). Process data (PD) is cyclic; on-request data (OD) carries parameters, events and diagnosis acyclically. The device is described by an IODD file (XML). The master sits on the fieldbus (PROFINET, EtherCAT, EtherNet/IP, Modbus TCP) like a normal IO module.",
    params: [["Bit rates", "COM1 4.8 kbit/s, COM2 38.4 kbit/s, COM3 230.4 kbit/s (device decides, master adapts)"], ["Cycle time", "min cycle of the device (often 1–2.3 ms); 2–10 ms typical in practice"], ["Process data", "0–32 bytes in, 0–32 bytes out per port"], ["Cable", "M12 / M8, 3 or 5 wires, max 20 m, port class A (pin 2 DI/DO) or B (extra 24 V for actuators)"], ["Data storage", "master stores the device parameters – a replaced sensor gets them automatically"]],
    rules: ["Use IO-Link for every sensor that has parameters or diagnosis (distance, pressure, RFID, valve terminals, signal lamps).", "Switch on data storage (backup + restore) in the master so a spare sensor works without a laptop.", "Keep cables < 20 m; for longer distances put the master closer (IP67 master in the field).", "Read the IODD into the engineering tool; name the process data with the same tags as the PLC.", "Use port class B for actuators that need separate power (valves) – it keeps the safety switch-off of the actuator power."],
    faults: ["Device not found: wrong port mode (DI instead of IO-Link), cable too long, broken C/Q wire.", "Wrong values: IODD version different from device, byte order of 16/32-bit values.", "Parameters lost after replacement: data storage not enabled.", "Communication error events: EMC near welding / VFD cables – reroute or use shielded cable."],
    when: "Always at the sensor level of FMS modules: clamping pressure, pallet ID (RFID), tool-change confirmation, valve terminals of fixtures, stack lights. Not a network – it ends at the master." },
  { id: "pn", name: "PROFINET IO (RT / IRT)",
    how: "Cyclic real-time Ethernet. An IO controller (PLC) and IO devices exchange process data in provider–consumer style: each side sends its output frame every update time without being asked, directly as Ethernet frames (EtherType 0x8892, no IP for RT). Set-up uses DCP (device name → IP) and connection establishment with acyclic records. RT uses VLAN priority 6 in normal switches; IRT reserves a time slot in each cycle with special switch hardware (time-synchronised). Diagnostics are alarms from the device. Devices are described by GSDML files.",
    params: [["Update time", "RT 1–512 ms (typ. 2–8 ms); IRT 0.25–1 ms"], ["Watchdog", "update time × factor (typ. 3) → device goes to safe state"], ["Frame", "min 64 bytes, max ~1500 bytes data per frame; cyclic data ≤ 1440 bytes per AR"], ["Addressing", "device NAME (DCP) is the identity; IP is assigned by the controller"], ["Topology", "line (2-port switch in every device), star, ring with MRP (reconfiguration < 200 ms) or MRPD (bumpless)"], ["Conformance class", "CC-A (any switch), CC-B (SNMP, LLDP topology), CC-C (IRT), CC-D (TSN)"]],
    rules: ["Keep cyclic load < 50 % on any port (6C calculator); not more than ~20–30 devices in one line for 1 ms.", "Use managed CC-B switches (LLDP, SNMP) so the topology and port diagnosis are visible.", "Put PROFINET devices in their own cell VLAN; never route RT frames; cameras and file transfer in a separate VLAN or port.", "Use MRP rings for conveyors and long lines; plan device names with one rule (6J).", "Shielded industrial cables (PROFINET type A/B/C), max 100 m per copper segment, grounded shield at both ends with equipotential bonding."],
    faults: ["Device not reachable after replacement: device name not assigned (or topology-based naming not configured).", "Sporadic station failures: watchdog too short, high load from multicast / cameras, bad shield or connector, duplex mismatch.", "Ring breaks unnoticed: MRP diagnostics not monitored.", "IP conflict: same IP in another VLAN routed into the cell."],
    when: "Inside modules and cells with Siemens (and many other) PLCs: PLC ⇄ remote IO, drives, valve terminals, robots; PLC–PLC coupling (I-device) between cell controller and modules for fast handshakes; PROFIsafe for safety." },
  { id: "ec", name: "EtherCAT",
    how: "One Ethernet frame from the master runs through all slaves in a logical ring; each slave reads its output data and inserts its input data 'on the fly' while the frame passes (forwarding delay < 1 µs). The last slave sends the frame back. So one frame updates hundreds of devices. Distributed clocks synchronise all slaves to < 1 µs. Slaves are described by ESI files; mailbox protocols CoE (CANopen objects), FoE (files), EoE (Ethernet tunneling) carry acyclic data.",
    params: [["Cycle", "50 µs – 1 ms typical; 100 axes at 1 ms are common"], ["Sync", "distributed clocks, jitter < 1 µs"], ["Topology", "line, tree, star with junctions; cable redundancy (ring back to master)"], ["Addressing", "automatic by position (auto-increment) or configured station alias"], ["Hot connect", "groups of slaves may be disconnected / reconnected (tool changers)"]],
    rules: ["Use for fast motion, high-speed IO and test benches inside one machine – not as plant network.", "Use cable redundancy when a cable break must not stop the machine.", "Set station aliases for exchangeable groups so the order of slaves can change.", "Keep EtherCAT segments inside the machine; connect to the cell over a separate port (PROFINET, OPC UA, Modbus TCP).", "Check the cycle with the 6C calculator: frame time + forwarding delay × 1.25 must fit the cycle."],
    faults: ["Working counter errors: a slave did not process the frame (cable, connector, EMC, slave in wrong state).", "Lost frames at one position: bad cable or connector between two slaves (check CRC counters per port).", "Sync errors in drives: DC not configured or cycle too short.", "Wrong slave after replacement: auto-increment addressing changed – use aliases."],
    when: "Beckhoff / Omron / Delta machines, robots with many axes, measuring machines, high-speed assembly stations. In an FMS it stays inside the module; the cell sees the module through its standard data block." },
  { id: "eip", name: "EtherNet/IP (CIP)",
    how: "Common Industrial Protocol on standard TCP/UDP/IP. Explicit messages (TCP 44818) read and write CIP objects (request/response); implicit IO connections (UDP 2222) send cyclic data at the requested packet interval (RPI), unicast or multicast. Devices are described by EDS files. CIP Safety and CIP Motion run on the same network. DLR (device level ring) gives ring redundancy.",
    params: [["RPI", "1–100 ms typical (0.5 ms possible)"], ["Timeout", "connection timeout = RPI × multiplier (typ. 4–32)"], ["Ports", "TCP 44818 explicit, UDP 2222 implicit IO"], ["Connections", "each controller / adapter has a limited number of CIP connections and packets per second (PPS)"], ["Ring", "DLR, recovery ~3 ms"]],
    rules: ["Use IGMP snooping (with querier) on all switches when multicast IO is used – otherwise multicast floods every port.", "Prefer unicast connections for IO when the switch is unknown.", "Check the PPS budget of each adapter and controller (connections × 2 / RPI).", "Use QoS (DSCP) for IO traffic on shared networks.", "Same IP / VLAN planning rules as PROFINET (6D, 6J)."],
    faults: ["Connection timeouts: PPS overload, RPI too short, multicast flooding, duplicate IP.", "Network slow for everything: multicast without IGMP snooping.", "Module fault after replacement: electronic keying (vendor, product, revision) mismatch."],
    when: "Rockwell plants and many robots / drives; same role as PROFINET inside modules and between PLCs." },
  { id: "mb", name: "Modbus TCP",
    how: "Client / server request–response on TCP port 502. The client (cell controller, SCADA) sends a request with MBAP header (transaction id, protocol 0, length, unit id) + PDU (function code + data); the server (module PLC) answers with the same transaction id. Data is 16-bit registers and bits; there is no data model – a register map document gives the meaning. 32-bit values use two registers (word order must be agreed). No security in the protocol itself.",
    params: [["Port", "TCP 502 (Modbus/TCP Security: TLS on 802)"], ["Limits", "FC03/FC04 max 125 registers, FC16 max 123 registers, FC01 max 2000 bits per request"], ["Timing", "transaction = network RTT + server response (typ. 5–20 ms in a PLC)"], ["Connections", "server accepts limited parallel connections (often 4–16)"], ["Exceptions", "01 illegal function, 02 illegal data address, 03 illegal data value, 04 server device failure, 06 server busy, 0B gateway target failed"]],
    rules: ["One standard block per module (words 0–19 identical), read in ONE FC03 request.", "Write the numbering (1-based 4xxxx vs 0-based PDU), word order (ABCD), REAL format and bit numbering into the interface sheet.", "Writes only by one owner (the cell controller); the module accepts writes only to 'in' words.", "Heartbeat words in both directions, timeout 3 s; client timeout per request 500 ms, then reconnect.", "Protect with zones: a DPI firewall that only allows FC03/FC04 from SCADA and writes only from the cell controller."],
    faults: ["Values 'crazy' (292 618 241 instead of 70001): word order; off by one register: 1-based vs 0-based numbering.", "Exception 02: address outside the server map; exception 03: quantity too large.", "Timeouts after some hours: server out of connections because the client does not close old sockets.", "Unit id ignored or required (gateways: unit id selects the serial device)."],
    when: "Company rule 'only Ethernet + Modbus TCP + HTTP', low-cost cells, energy meters, gateways to old machines, simple PLC ⇄ PLC handshakes (with the 4-step handshake of 6I)." },
  { id: "ua", name: "OPC UA (client / server, PubSub)",
    how: "Service-oriented protocol with an information model: a server exposes nodes (objects, variables, methods) in an address space, typed by companion specifications (umati machine tools, robotics, PackML …). Clients browse, read, write, call methods, and create subscriptions with monitored items: the server samples each item at the sampling interval, queues changes (deadband) and sends notifications in publish responses at the publishing interval. Binary transport opc.tcp on port 4840 with secure channel (certificates, Sign or Sign & Encrypt). PubSub sends datasets over UDP or MQTT without sessions.",
    params: [["Port", "4840 (opc.tcp)"], ["Sampling / publishing", "sampling 50 ms – 1 s, publishing 100 ms – 5 s; keep-alive and lifetime counts"], ["Security", "policies Basic256Sha256 / Aes128 / Aes256; modes None, Sign, SignAndEncrypt; user name / certificate"], ["Limits", "server-specific: sessions, subscriptions, monitored items (small PLCs 500–2000 items)"], ["Model", "NodeId ns=<i>;s=<string> or i=<number>; browse paths"]],
    rules: ["Use companion specs where they exist (umati, PackML, robotics); otherwise the module standard block as an object type.", "Subscriptions for status (250–500 ms sampling, deadband for analog values); read / write / methods for jobs and commands.", "Always Sign & Encrypt with managed certificates (own CA or GDS); trust lists on both sides; no 'None' in production.", "Check the server limits (items, sessions) and the subscription load (6G).", "Write the NodeIds and namespace URI (not the index – it can change) into the interface sheet."],
    faults: ["BadCertificateUntrusted / connection refused: certificate not in the trust list or expired; clock difference.", "Data stale: subscription lifetime expired after network break and client did not recreate it.", "Server slow / crash: too many monitored items or too short sampling on a small PLC.", "NodeId not found after PLC download: namespace index changed – resolve by namespace URI."],
    when: "Module / CNC ⇄ cell controller, cell controller ⇄ MES / SCADA in Siemens and mixed plants; umati for all CNC brands; the main supervisory protocol of modern FMS." },
  { id: "mq", name: "MQTT + Sparkplug B",
    how: "Publish / subscribe over TCP via a broker. Clients publish messages to topics and subscribe with wildcards; the broker forwards. QoS 0/1/2, retained messages, last will. Sparkplug B adds a topic namespace (spBv1.0/<group>/<type>/<edge>/<device>), message types (NBIRTH, DBIRTH, DDATA, DCMD, NDEATH …), protobuf payload with metric names, aliases and sequence numbers, and state handling: subscribers know when an edge is offline (death certificate).",
    params: [["Ports", "1883 plain, 8883 TLS"], ["QoS", "0 at most once, 1 at least once, 2 exactly once (Sparkplug: DDATA QoS 0, STATE QoS 1)"], ["Keep-alive", "typ. 30–60 s; last will published by the broker when the client disappears"], ["Payload", "Sparkplug protobuf; metric alias after BIRTH reduces size"], ["Topic", "spBv1.0/FMS1/DDATA/CC1/MC01"]],
    rules: ["Broker in the DMZ or level 3; cells publish outwards (one outgoing connection) – nothing from the internet into a cell.", "Report by exception (only changed values) and a deadband; send BIRTH after every (re)connect.", "TLS + client certificates or user / password per client; ACL per topic.", "Commands (DCMD) to machines only if the safety / security concept allows; normally commands go through the cell controller.", "Plan the broker load (6G) including the BIRTH burst after a restart."],
    faults: ["Data stops without alarm: no last will / Sparkplug state used.", "Old values shown: retained messages of a dead device.", "Broker overload after restart: all edges reconnect and send BIRTH at the same time.", "Wrong metric names: Sparkplug alias table not matching the BIRTH."],
    when: "Data to historian, dashboards, analytics, unified namespace, cloud; many consumers without loading the PLCs. Not for handshakes or control." },
  { id: "http", name: "HTTP / REST (JSON) + SSE / WebSocket",
    how: "Request / response: the client sends a method (GET, POST, PUT, PATCH, DELETE) to a resource URL; the server answers with a status code (200, 201, 400, 404, 409, 500 …) and a JSON body. Server-sent events (SSE) or WebSockets push changes. APIs are documented with OpenAPI. TLS (HTTPS 443) for security; idempotency keys make retries safe.",
    params: [["Ports", "80 / 443 (or 8080 / 8443 in the plant)"], ["Latency", "10–100 ms per request in the plant LAN"], ["Payload", "JSON, UTF-8; ISA-95 / B2MML objects as structure"], ["Auth", "API keys, OAuth2 tokens, client certificates"], ["Push", "SSE (one direction, simple) or WebSocket (both directions)"]],
    rules: ["One OpenAPI document per interface, versioned (/api/v1/...).", "POST with an idempotency key (job id) – a retried job download must not create a second job.", "Timeouts and retries with back-off; 409 Conflict for state errors (job already running).", "No control loops or handshakes faster than ~1 s over HTTP.", "Logs with request id; rate limits."],
    faults: ["Double jobs after a timeout + retry: no idempotency.", "401 / 403 after certificate or token expiry.", "Time zone confusion in timestamps – always ISO 8601 with offset or UTC.", "Big responses slow: no paging."],
    when: "MES ⇄ ERP, MES ⇄ cell controller (jobs, confirmations), WMS / AGV fleet manager, printers, web HMIs; the 'HTTP' half of the company rule 'only Modbus TCP + HTTP'." },
  { id: "mtc", name: "MTConnect / umati",
    how: "MTConnect: a read-only HTTP agent per machine (or per adapter) answers /probe (device model), /current (latest values) and /sample (time series with sequence numbers) in XML or JSON, using a standard machine-tool vocabulary (Execution, ControllerMode, Program, SpindleSpeed, alarms). umati: the OPC UA companion specification for machine tools (OPC 40501) with objects MachineTool, Monitoring (channels, spindles, stacklight), Production (jobs, programs), Notification (alarms), Equipment (tools).",
    params: [["MTConnect transport", "HTTP port 5000 typical; XML / JSON; ring buffer with sequence numbers"], ["umati transport", "OPC UA 4840, Sign & Encrypt"], ["Update", "~1 s typical"], ["Write", "MTConnect read-only; umati mainly read (methods in newer versions)"], ["Key items", "Execution / ProgramName / PartCount / Alarms / SpindleLoad / ToolLife"]],
    rules: ["Ask for umati or MTConnect in every CNC purchase order (with the version).", "Use it for monitoring and OEE; jobs and handshakes still via the module standard block (PLC side of the CNC).", "Map the vocabulary to the module standard (Execution ACTIVE → PackML Execute; READY → Idle; INTERRUPTED → Held).", "Collect with sequence numbers (MTConnect /sample) so no event is lost after a network break."],
    faults: ["Missing values: the CNC option (software licence) not activated.", "Different meanings between brands despite the standard: check the mapping per machine at the FAT.", "Agent buffer overflow after long breaks: lost samples – shorter polling or bigger buffer."],
    when: "CNCs of several brands in one FMS (one vocabulary for MES, OEE, tool life); cases 1 and 3 of 6N." },
];

/* ------------------------------------------------------------------ 6M commissioning */
export const CHECK6 = [
  ["Documents", ["Interface sheet signed by both parties (data block, word order, numbering, timeouts)", "IP plan with device names, VLAN, gateway, ranges checked (no overlap / duplicate)", "Firewall conduit list (source, destination, service, reason, owner)", "Device description files (GSDML / EDS / ESI / IODD) with versions archived", "Network drawing with switch ports and cable numbers"]],
  ["Physical layer", ["Cable test report (copper class D/E, fibre loss) for every installed link", "Shield grounding and equipotential bonding checked", "Switch port speed / duplex auto, no errors in the port counters after 1 h", "Ring redundancy tested: pull one cable, reconfiguration time measured"]],
  ["Addressing & naming", ["Every device reachable (ping) at its planned IP", "PROFINET device names assigned and checked against the list", "No duplicate IP (ARP scan / switch MAC table)", "Time synchronisation (NTP) on all PCs, PLCs, CNCs"]],
  ["Data & handshakes", ["Read the full standard block of every module and compare with the expected values", "Word order checked with a known DINT and REAL (e.g. 70001 / 1834.5)", "Every command word written by the cell controller and acknowledged by the module", "4-step handshake run 10× without fault; timeouts tested (no answer → HS_TIMEOUT)", "Writes to read-only words refused (exception 02 / BadNotWritable)"]],
  ["Failure behaviour", ["Module cable pulled 6 s → COMM_LOSS after 3 s at the cell controller, job resumes without double start", "Cell controller stopped → module reports CC_LOSS, goes to a safe idle", "Power cycle of a switch → all connections come back without manual action", "Broker / OPC UA server restart → subscriptions recreated, no stale values"]],
  ["Load & performance", ["Cyclic load < 50 % on all fieldbus ports (switch statistics)", "Poll cycle / subscription rates measured and as designed", "Latency of a handshake (Request → HSReady) measured with timestamps"]],
  ["Security", ["Default deny active, every conduit flow tested (allowed and blocked)", "No default passwords, personal accounts, unused ports disabled", "Back-ups of all PLC / CNC / robot / switch configurations stored and restore tested", "Remote access only via jump host with MFA"]],
];

/* decision trees: nodes {q, y, n} (question → next node ids) or {fix} (leaf) */
export const TREES = {
  none: { name: "No communication at all", start: "a", nodes: {
    a: { q: "Is the link LED on the device and the switch port ON?", y: "b", n: "a1" },
    a1: { fix: "Physical layer: check cable / connector (cable tester), port enabled on the switch, device powered, speed/duplex auto, fibre Tx/Rx crossed." },
    b: { q: "Does ping to the device IP answer (from a PC in the same VLAN)?", y: "c", n: "b2" },
    b2: { q: "Does the device appear in the switch MAC table / ARP list with the expected MAC?", y: "b3", n: "b4" },
    b3: { fix: "IP problem: wrong IP / subnet mask / gateway in the device, duplicate IP (check ARP for two MACs), PC in another VLAN, ICMP blocked by the device firewall." },
    b4: { fix: "VLAN problem: port in the wrong VLAN (access VLAN / tagging), or device in a different subnet; PROFINET: device name not assigned so it has no IP yet." },
    c: { q: "Does a TCP connection to the service port open (502 Modbus, 4840 OPC UA, 1883/8883 MQTT, 443 HTTPS)?", y: "d", n: "c1" },
    c1: { fix: "Service blocked: firewall rule missing (6K tester), service not enabled in the device, wrong port, maximum number of connections reached (close old sockets / restart the server)." },
    d: { q: "Does the server answer the first request (no exception / no Bad status)?", y: "d1", n: "d2" },
    d1: { fix: "Communication works – problem is in the application: wrong unit id, wrong node id / register range, client polling disabled. Compare with the interface sheet." },
    d2: { fix: "Protocol settings: Modbus exception 01/02/03 (function, address, quantity) → check map and numbering; OPC UA BadSecurityChecksFailed / BadCertificate → trust the certificate, check time; MQTT CONNACK refused → user / ACL." } } },
  inter: { name: "Intermittent communication (works, then drops)", start: "a", nodes: {
    a: { q: "Do the switch port counters show CRC / alignment errors or link up/down events?", y: "a1", n: "b" },
    a1: { fix: "Physical: bad connector, damaged cable, EMC (cable next to VFD / welding), shield not grounded, too long copper (> 100 m). Replace / reroute; check grounding." },
    b: { q: "Does the problem happen at the same time as high traffic (camera, back-up, file transfer, broadcast)?", y: "b1", n: "c" },
    b1: { fix: "Load: cyclic load > 50 %, big frames on a real-time line (6G worst case), broadcast / multicast storm. Separate VLAN / port, IGMP snooping, storm control, QoS." },
    c: { q: "Does the address appear with two different MAC addresses (ARP / Wireshark 'duplicate IP')?", y: "c1", n: "d" },
    c1: { fix: "Duplicate IP – run the 6G duplicate checker on the IP list; fix the plan and the device." },
    d: { q: "Do the drops happen after a fixed time (e.g. every 2 h) or after a number of reconnects?", y: "d1", n: "e" },
    d1: { fix: "Resource leak: server connection table full (client does not close sockets), NAT / firewall session timeout shorter than the keep-alive, certificate / token renewal. Use keep-alive < timeout; close connections." },
    e: { q: "Is the timeout / watchdog much shorter than 3 × the cycle?", y: "e1", n: "e2" },
    e1: { fix: "Timeouts too tight: PROFINET watchdog factor, Modbus client timeout, OPC UA keep-alive. Set ≥ 3 × cycle (heartbeat 3 s for handshakes)." },
    e2: { fix: "Capture with Wireshark at the device port (mirror port) during a drop; look for retransmissions, resets (RST), missing answers – then the trace shows who stops talking." } } },
  wrong: { name: "Wrong values", start: "a", nodes: {
    a: { q: "Is the wrong value a 32-bit value (DINT, REAL) and are 16-bit values correct?", y: "a1", n: "b" },
    a1: { fix: "Word order: decode the registers with ABCD / CDAB / BADC / DCBA (6H demo). Typical: 70001 shows as 292 618 241 (CDAB). Agree ABCD in the interface sheet or swap in the client." },
    b: { q: "Are all values shifted by one position (value of the next / previous register)?", y: "b1", n: "c" },
    b1: { fix: "Register numbering: 1-based 4xxxx (40001) vs 0-based PDU address (0). Subtract / add 1 in the client configuration." },
    c: { q: "Is the value off by a constant factor (10, 100, 1000)?", y: "c1", n: "d" },
    c1: { fix: "Scaling / unit: INT with implied decimals (×10), mm vs µm, s vs ms. Write unit and scale for every word in the interface sheet." },
    d: { q: "Are negative values shown as large positive numbers (e.g. 65 535)?", y: "d1", n: "e" },
    d1: { fix: "Signed / unsigned: INT read as UINT. -1 = 0xFFFF = 65 535. Use the type of the interface sheet." },
    e: { q: "Are the values correct but old (not changing)?", y: "e1", n: "e2" },
    e1: { fix: "Stale data: OPC UA subscription dead, MQTT retained message of an offline device, PLC copies the data block only on change, heartbeat not checked. Monitor the heartbeat word." },
    e2: { fix: "Wrong source: two devices with the same IP / unit id, wrong node id after PLC download (namespace index), wrong unit in the gateway. Read a known constant (module type word) to identify the source." } } },
  slow: { name: "Slow updates / handshakes", start: "a", nodes: {
    a: { q: "Is the client poll cycle (6C Modbus calculator) longer than the needed update time?", y: "a1", n: "b" },
    a1: { fix: "Too many requests in series: read the block in one request (≤ 125 registers), poll several servers in parallel (more connections), poll fast only the handshake words." },
    b: { q: "Is the server response time high (> 20 ms per request)?", y: "b1", n: "c" },
    b1: { fix: "Server busy: PLC communication load / cycle time, too many clients, OPC UA server with too many monitored items. Reduce clients, use subscriptions with deadband, check PLC comm-load setting." },
    c: { q: "Does the handshake need many polls per step (one-tick delay per step)?", y: "c1", n: "d" },
    c1: { fix: "Each handshake step costs one poll period on each side (6I: Request → Complete needs ≥ 6 ticks + execution). Shorter poll period for the handshake words or PLC–PLC coupling (PROFINET I-device)." },
    d: { q: "Are there many TCP retransmissions in a capture?", y: "d1", n: "d2" },
    d1: { fix: "Packet loss: physical errors or overloaded port / firewall. See the 'intermittent' tree." },
    d2: { fix: "Application timing: client timer resolution, Nagle / delayed ACK in PC clients (set TCP_NODELAY), SCADA scan classes. Measure with timestamps at both ends." } } },
};

/* Wireshark display filters [filter, meaning] */
export const WSF = [
  ["mbtcp", "all Modbus TCP traffic (port 502)"],
  ["mbtcp.trans_id == 1", "one Modbus transaction (request + response)"],
  ["modbus.func_code == 16", "all Modbus write-multiple-registers requests"],
  ["modbus.func_code >= 128", "Modbus exception responses (function code + 0x80)"],
  ["mbtcp && ip.addr == 10.1.101.150", "Modbus traffic of one module (MC01 CNC)"],
  ["pn_io", "PROFINET cyclic IO data"],
  ["pn_dcp", "PROFINET DCP (device names, IP set, identify)"],
  ["pn_io.alarm_type", "PROFINET alarms (diagnosis)"],
  ["ecat", "EtherCAT frames (at the master port)"],
  ["ecat.wkc", "EtherCAT working counter (check errors)"],
  ["enip || cip", "EtherNet/IP explicit + CIP"],
  ["opcua", "OPC UA binary (port 4840; encrypted content not readable)"],
  ["opcua.servicenodeid.numeric == 826", "OPC UA PublishRequest (subscriptions)"],
  ["mqtt", "MQTT (plain port 1883)"],
  ["mqtt.topic contains \"DDATA\"", "Sparkplug data messages"],
  ["http.request.method == \"POST\"", "HTTP POST requests (job downloads, confirmations)"],
  ["tcp.analysis.retransmission", "TCP retransmissions = lost packets"],
  ["tcp.flags.reset == 1", "TCP resets = connection refused or closed by force"],
  ["arp.duplicate-address-detected", "duplicate IP address"],
  ["eth.dst == ff:ff:ff:ff:ff:ff", "broadcast frames (storm?)"],
  ["lldp", "LLDP neighbour information (topology)"],
  ["ntp", "time synchronisation"],
];

/* ------------------------------------------------------------------ 6N cases */
export const CASES6 = [
  { id: "c1", name: "Case 1 · Siemens FMS – PROFINET inside, OPC UA above",
    intro: "3 HMCs (two brands), pallet pool with stacker, 2 load stations, washer, CMM, AGV station. Company PLC standard Siemens; MES from a software house; ERP via REST. Machine builders deliver PROFINET inside their modules.",
    links: [["Sensors → IO", "IO-Link (masters on PROFINET)", "RFID at load stations, clamping pressure, valve terminals"],
      ["PLC ⇄ IO / drives (inside modules)", "PROFINET RT 2 ms (IRT for the stacker axes)", "Siemens standard, GSDML devices"],
      ["Safety", "PROFIsafe inside the cell, F-CPU in the cell controller", "door switches, light curtains, safe stacker zone"],
      ["Module ⇄ cell controller (handshake)", "PROFINET I-device (standard block 20 + n words)", "4-step handshake at 2 ms instead of 100 ms polling"],
      ["Module / CNC ⇄ cell controller (data, jobs)", "OPC UA (umati for the CNCs), Sign & Encrypt", "one vocabulary for both CNC brands"],
      ["Cell controller ⇄ MES / SCADA", "OPC UA 4840", "jobs down, confirmations + states up"],
      ["MES ⇄ ERP", "HTTP REST / JSON via DMZ proxy", "orders, confirmations (ISA-95 objects)"],
      ["Data to historian", "OPC UA → historian (L3), mirror in DMZ", "no MQTT needed yet"]],
    net: [["Cell VLAN", "101 · 10.1.101.0/24 · gateway .1 firewall"], ["Topology", "MRP ring of 4 CC-B switches in the cell, lines of ≤ 10 devices"], ["Zones", "enterprise · DMZ · manufacturing · engineering · cell FMS1 · safety (SL-T 3)"], ["Devices", "31 IP addresses (6J IP plan, FMS kit)"]],
    calc: { pn: { dev: 30, io: 32, cyc: 2, spd: 100 }, ua: { items: 600, sampling_ms: 250, change_ratio: 0.2, bytes_per_notification: 30, subscriptions: 15, publishing_ms: 500, overhead_per_message: 150 } } },
  { id: "c2", name: "Case 2 · 'Only Modbus TCP + HTTP' plant",
    intro: "Company IT rule: between systems only Ethernet with Modbus TCP and HTTP. Mixed PLC brands from the machine builders (Delta, Siemens, Mitsubishi). Cell controller is a Python service (fmsctl) on an industrial PC.",
    links: [["Sensors → IO", "IO-Link / 24 V IO", "inside the module – builder's choice"],
      ["PLC ⇄ IO / drives (inside modules)", "builder's bus (EtherCAT, PROFINET …)", "stays inside the module, not visible to the cell"],
      ["Safety", "hard-wired dual-channel signals + safety PLC", "no safety over the network (rule)"],
      ["Module ⇄ cell controller", "Modbus TCP – standard block words 0–19 + module part, one FC03 read per poll, FC16 writes", "100 ms poll, heartbeat 3 s, word order ABCD"],
      ["CNC ⇄ cell controller", "CNC → Modbus gateway (PLC side) + HTTP agent (MTConnect-style JSON) for monitoring", "no OPC UA allowed"],
      ["SCADA ⇄ modules", "Modbus TCP read only (DPI firewall); writes only through the cell controller", "one owner of commands"],
      ["Cell controller ⇄ MES", "HTTP REST / JSON + SSE for events", "idempotent job download (job id)"],
      ["Data to historian / dashboards", "HTTP (SSE) gateway → historian", "MQTT not allowed"]],
    net: [["Cell VLAN", "101 · 10.1.101.0/24"], ["Topology", "star of managed switches, 1 Gbit/s uplink"], ["Firewall", "DPI firewall with Modbus function-code filter between manufacturing and cell"], ["Poll", "20 modules, 60 registers, 4 parallel connections"]],
    calc: { mb: { dev: 20, regs: 60, resp: 8, rtt: 1, conn: 4 }, hs: true } },
  { id: "c3", name: "Case 3 · Mixed-brand assembly – OPC UA / umati + MQTT",
    intro: "Assembly line with 8 stations from 3 suppliers (Beckhoff, Rockwell, Siemens), 2 testers, marking; plant data platform (unified namespace) for quality analytics; ERP via REST.",
    links: [["Sensors → IO", "IO-Link", "nutrunners, presses, scanners"],
      ["PLC ⇄ IO (inside stations)", "EtherCAT (Beckhoff), EtherNet/IP (Rockwell), PROFINET (Siemens)", "each supplier's standard"],
      ["Safety", "FSoE / CIP Safety / PROFIsafe inside a station; hard-wired between stations", "independent of brand"],
      ["Station ⇄ line controller", "OPC UA (standard block as object type; PackML companion spec)", "vendor-neutral, secure"],
      ["CNC / test machines", "umati / OPC UA", "same model for all brands"],
      ["Line ⇄ MES", "OPC UA + HTTP REST", "jobs, serial numbers, results"],
      ["Data to platform", "MQTT Sparkplug B, broker in the DMZ, edge in each line", "many consumers, report by exception"],
      ["MES ⇄ ERP", "HTTP REST", "orders, confirmations"]],
    net: [["Line VLAN", "102 · 10.1.102.0/24"], ["Topology", "ring of managed switches, IGMP snooping (EtherNet/IP multicast)"], ["Broker", "MQTT broker in the DMZ (TLS 8883), edges publish outwards"], ["Zones", "line ASM1 SL-T 2, station safety local"]],
    calc: { mq: { edges: 20, rate: 1, topic: "spBv1.0/PLT1/DDATA/CC1/MC01", metrics_per_msg: 50, bytes_per_metric: 12, sparkplug_header: 10, subscribers: 3 }, ua: { items: 600, sampling_ms: 250, change_ratio: 0.2, bytes_per_notification: 30, subscriptions: 15, publishing_ms: 500, overhead_per_message: 150 } } },
];
