# Contract – Spindle assembly LIVE station twin (internal, for the builders)

Station id `ASSY-SP1` (spindle clean room). Assembly tab item 3 (`#arItem3`, intro `#asIntro3` already in
index.html, `<script type="module" src="spst.js">` already added). Offline only: Python stdlib, no pip, no CDN.

## Backend – `twin/spstation.py`, class `SpindleStation`
* `SpindleStation(db_path)` – own SQLite file (WAL) = `os.path.join(os.path.dirname(history_db), "spstation.db")`.
  `start()` starts its own daemon thread (tick 0.5 s real time), `stop()`.
* Independent of `TwinEngine` (server.py creates it next to ENGINE as global `SPST`).
* The 21 steps use exactly the keys of `web/asmsp.js` STEPS, in this order:
  `kit, clean, meas, spacer, grease, front, nut, fbh, rotor, rear, draw, balance, stator, insert, cover, unclamp, clamp, sensors, runin, test, pack`.
  Checks and limits follow the checks in `asmsp.js simulate()` (same example values, same "check" notes).

### HTTP routes (added to server.py)
| Method | Path | Answer |
|---|---|---|
| GET | `/api/spst` | full state (below) |
| GET | `/api/spst/stream` | SSE, the same state JSON every 1 s (`data: {...}\n\n`) |
| GET | `/api/spst/units` | `[{sn, wo, shaft_sn, status, started, finished, lead_h, fpy}]` newest first |
| GET | `/api/spst/unit?sn=SPU-2546-00001` | full record: unit + all results + signatures + NCRs + events + device log |
| GET | `/api/spst/spc?id=<check id>` | `{id, n, unit, lo, hi, values:[{sn, v, t}], mean, sigma, cpk}` |
| GET | `/api/spst/runin?sn=…` | `{sn, samples:[{t, rpm, tf, tr, ts, win, wout, vib}]}` (1 sample / 5 s) |
| GET | `/api/spst/export.csv` | all results as CSV |
| POST | `/api/spst` | actions (below) → `{ok, message}` or 400 `{ok:false, error}` |
| POST | `/api/spst/ingest` | device data from gateways (below) |

### State JSON (`GET /api/spst`)
```json
{ "t": 1762851000.0, "station": "ASSY-SP1",
  "sim": {"on": true, "auto": false, "speed": 1, "faults": []},
  "user": {"name": "Anna", "role": "operator"},
  "steps": [{"k": "kit", "no": 1, "n": "Kit + traceability", "ph": "Prepare",
             "checks": [{"id": "kit.shaft_sn", "n": "Shaft serial", "unit": "", "lo": null, "hi": null,
                         "kind": "text|num|bool", "dev": "SCN-01" , "req": true, "note": "check"}]}],
  "unit": {"sn": "SPU-2546-00001", "wo": "WO-SP-2546-0001", "shaft_sn": "SPS-2546-00001",
           "status": "in_work|hold|accepted|rejected", "si": 5, "step_state": "idle|running|wait_confirm|done",
           "u": 0.4, "started": 1762850000.0,
           "results": {"front.ring_temp": {"v": 72.1, "st": "ok|warn|bad|pending", "src": "device:IH-01|manual|sim", "t": 0, "user": "Anna"}},
           "signed": [{"si": 0, "user": "Anna", "t": 0}], "ncr": [{"id": "NCR-0001", "check": "…", "decision": "rework|scrap|concession", "text": "", "user": "", "t": 0}]},
  "devices": [{"id": "TQ-01", "n": "Torque wrench", "type": "torque", "proto": "sim|http|modbus|mqtt",
               "addr": "", "state": "online|offline|sim", "last": {"torque_nm": 125.2}, "seen": 0}],
  "runin": {"active": false, "phase": "step 3 / 8", "rpm": 6000, "rpm_set": 6000,
            "profile": [[1500, 10], [3000, 10]], "elapsed_s": 0,
            "T": {"front": 31.2, "rear": 28.0, "stator": 35.1, "win": 20.1, "wout": 23.4},
            "dT": 11.2, "rate_k_min": 0.3, "vib": 0.42, "stops": 0,
            "rules": [{"n": "front bearing ΔT > 25 K → hold at this speed", "on": false}]},
  "alarms": [{"id": 1, "t": 0, "sev": "info|warn|alarm", "text": "", "ack": false}],
  "events": [{"t": 0, "text": "", "user": ""}],
  "queue": [{"wo": "WO-SP-2546-0002", "qty": 1, "due": 0}],
  "kpi": {"units": 3, "accepted": 2, "fpy": 0.67, "avg_lead_h": 31.0, "open_ncr": 1} }
```
`unit` is `null` when no unit is in work. The frontend may ignore fields it does not know.

### Actions (`POST /api/spst`, JSON `{"action": …}`)
`login {user, role: operator|inspector|admin}` · `logout` · `new_unit {wo?, shaft_sn?}` · `start_step` ·
`record {id, v}` (manual entry, src = manual) · `confirm` (sign-off of the current step – **interlock**: refused
with a clear error while a required check is pending or bad without an NCR; inspector role needed for steps
`balance, clamp, runin, test`) · `ncr {id, decision, text}` · `hold {reason}` / `release` ·
`sim {on?, auto?, speed?, faults?: ["mix","spacer","dirt","grease","nut","rotor","spring","oring"]}` ·
`runin {cmd: start|stop|ack}` · `ack {id}` (alarm) · `device {id, proto?, addr?, enabled?}`.

### Device ingest (`POST /api/spst/ingest`)
`{"device": "TQ-01", "values": {"torque_nm": 125.3, "angle_deg": 12}, "t": 1762851000.0}` or a list of them.
The station maps the values to the check of the current step that names this device (`dev`).

### Device list (ids are fixed – frontend + 3D use them)
| id | device | values |
|---|---|---|
| SCN-01 | barcode / DMC scanner | `code` |
| PC-01 | particle counter | `p05_m3` |
| TH-01 | room thermometer | `t_c` |
| BMS-01 | bearing measuring stand | `standout_um`, `bore_um` |
| CMP-01 | length comparator 0.1 µm | `len_um` |
| SCL-01 | precision scale | `mass_g` |
| IH-01 | induction heater | `temp_c`, `state` |
| OV-01 | rotor oven | `temp_c` |
| TQ-01 | torque wrench (wireless) | `torque_nm`, `angle_deg` |
| IND-01 | electronic indicator / probe | `runout_um` |
| FG-01 | force gauge (press / spring tool) | `force_kn` |
| BAL-01 | balancing machine | `u1_gmm`, `a1_deg`, `u2_gmm`, `a2_deg` |
| PRS-01 | pressure gauge (jacket test, unclamp) | `p_bar` |
| HSK-01 | HSK clamping-force gauge | `force_kn` |
| INS-01 | insulation / winding tester | `r_mohm` |
| RUN-01 | run-in stand PLC | `rpm`, `t_front_c`, `t_rear_c`, `t_stator_c`, `t_win_c`, `t_wout_c`, `vib_mm_s`, `flow_lpm` |
| PRB-01 | capacitive probes (final test) | `runout_um`, `axial_um` |

MQTT topic: `vc/asm/ASSY-SP1/<device>/<value>` (payload = number or JSON). Modbus TCP: register map per device in the guide.
