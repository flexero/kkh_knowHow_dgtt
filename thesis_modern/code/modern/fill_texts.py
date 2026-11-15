"""Narrative paragraphs of chapter 5 whose numbers come from results.json (used by fill_ch05.py)."""
from __future__ import annotations


def n0(x):
    return f"{x:,.0f}".replace(',', ' ')


def texts(R, X):
    T = {}
    Q, S, B, SE, C, cmd = R['mqtt'], R['scale'], R['bytes'], R['secure'], R['complete'], R['cmd']
    q = lambda k: Q[k]
    tot = q('q1_sf_rp_restart')['pooled'][1]
    nosf = q('q0_nosf_norp_restart')
    q0sf = q('q0_sf_norp_restart')
    steady = q('q1_sf_rp_steady')
    T['MQTT_TEXT'] = (
        f"Without a restart, the full path delivered all {steady['pooled'][1]} changes with a median latency of "
        f"{steady['lat_p50_ms']['mean']:.0f} ms and a maximum of {steady['lat_max_ms']['max']:.0f} ms. The restart separates the "
        f"configurations. **QoS 0 without store-and-forward lost {nosf['lost']} of {nosf['pooled'][1]} changes "
        f"({100 - 100 * nosf['pooled'][0] / nosf['pooled'][1]:.1f} %, worst run {100 - nosf['completeness']['min']:.1f} %)** — every change "
        "that occurred while the broker was down or while the gateway and the twin reconnected. Store-and-forward reduced the "
        f"loss to {q0sf['lost']} change at QoS 0: a message written to the socket in the moment the broker shut down, which "
        "QoS 0 never repeats. QoS 1 and QoS 2 with store-and-forward delivered all changes in these runs, and the "
        f"{q('q1_sf_rp_restart')['historical'] // 3}–{q('q1_sf_rp_restart')['historical'] // 3 + 1} changes per run that occurred during the "
        "outage arrived after the reconnect, flagged historical. The counter-gap replay found and repaired the single QoS-0 loss "
        f"(1 replay request, {q('q0_sf_rp_restart')['pooled'][0]} of {q('q0_sf_rp_restart')['pooled'][1]} delivered). At QoS 1 it issued one "
        "request in three runs, but the QoS-1 runs without replay show that store-and-forward alone already delivered every change in "
        "these runs. That QoS 1 alone is *not* a guarantee was shown by the acceptance test of Chapter 8 (test E4 in its first "
        "version): with a 2-s restart during a burst of 400 messages at 100 per second, one message that the broker had already "
        "acknowledged was lost with the broker's memory; with the replay rule the same test delivers 400 of 400. The changes "
        "delivered late during the outage dominate the latency tail of the restart runs: the 95th percentile rises to "
        f"{q('q1_sf_rp_restart')['lat_p95_ms']['mean'] / 1000:.1f} s and the maximum to {q('q1_sf_rp_restart')['lat_max_ms']['max'] / 1000:.1f} s "
        "— the broker downtime plus the reconnection of gateway and twin (about 0.3–1 s with the reconnect delays used). "
        "Completeness is therefore guaranteed by design; latency during an outage is not, and cannot be: the 1-s criterion "
        "applies to normal operation, while an outage must be detected (Sparkplug STATE and NDEATH) and repaired (historical "
        "data, replay).")
    # ---------------- scale
    s21, s100 = S['single']['21'], S['single'].get('100')
    p21, p100 = S['perdev']['21'], S['perdev'].get('100')
    worst = max(d['e2e_max_ms']['max'] for t in S.values() for d in t.values())
    allc = all(d['pooled'][0] == d['pooled'][1] for t in S.values() for d in t.values())
    T['SCALE_TEXT'] = (
        f"All {sum(d['pooled'][1] for t in S.values() for d in t.values()):,} state changes of the 18 scaling runs reached the twin"
        .replace(',', ' ') + (" (100 % in every run)" if allc else " (see the table for runs below 100 %)") +
        f", and no single change took longer than {worst:.0f} ms. For the case factory (21 devices, one server per device as with "
        f"embedded servers) the median end-to-end latency was {p21['e2e_p50_ms']['mean']:.0f} ms, the 99th percentile "
        f"{p21['e2e_p99_ms']['mean']:.0f} ms and the maximum {p21['e2e_max_ms']['max']:.0f} ms. The OPC UA leg alone already has a median of "
        f"{p21['ua_p50_ms']['mean']:.0f} ms — essentially the wait for the next Publish response of the event subscription ($P/2$ = 50 ms, "
        "Eq. 5.10); the gateway, the two broker hops and the twin add less than a millisecond at the median. "
        f"With 100 devices the median was {p100['e2e_p50_ms']['mean']:.0f} ms (server per device) and {s100['e2e_p50_ms']['mean']:.0f} ms "
        f"(one server) and the 99th percentile {p100['e2e_p99_ms']['mean']:.0f} ms and {s100['e2e_p99_ms']['mean']:.0f} ms: in this range the "
        "latency does not grow with the number of devices, because the load (about 1.3 Sparkplug messages per device and second) is "
        "far below the capacity of the stacks. "
        f"Eq. (5.2) predicted about 32 messages per second for 21 devices [calculated]; {s21['msgs_per_s']['mean']:.0f} were measured, because "
        "changes of one device often fall into the same 500-ms window, so the min() term of Eq. (5.2) is an upper bound. "
        f"The gateway used {p21['gw_cpu_pct']['mean']:.1f} % of one core for 21 devices and {p100['gw_cpu_pct']['mean']:.1f} % for 100 devices "
        f"with one session per device ({s100['gw_cpu_pct']['mean']:.1f} % with one session), with a working set of "
        f"{p21['gw_ws_mb']['mean']:.0f}–{p100['gw_ws_mb']['mean']:.0f} MB. The resource that grows fastest is on the server side: "
        f"the Python plant needed {p100['plant_ws_mb']['mean'] / 1024:.1f} GB and {p100['plant_build_s']['mean']:.0f} s to start 100 separate servers "
        f"(about {p100['plant_ws_mb']['mean'] / 100:.0f} MB per asyncua server, mostly the standard address space) against "
        f"{s100['plant_ws_mb']['mean']:.0f} MB and {s100['plant_build_s']['mean']:.1f} s for one server with 100 objects. In the factory each "
        "embedded server runs on its own controller, so this cost does not fall on the industrial PC — but it is the reason why a "
        "retrofit box should host several old machines in one server rather than one server each.")
    # ---------------- bytes
    pl, sc, mb = B['plain'], B['secured'], B['modbus_ed1']
    T['BYTES_TEXT'] = (
        f"At the bench load ({pl['events_per_dev_s']['mean']:.2f} state changes per device and second, power every second) one device "
        f"caused {pl['opcua_payload']['mean']:.0f} B/s of TCP payload on the OPC UA leg and {pl['mqtt_gw_payload']['mean']:.0f} B/s on the "
        f"gateway–broker leg; with Ethernet framing (Eq. 5.8) about {pl['opcua_wire']['mean']:.0f} and {pl['mqtt_gw_wire']['mean']:.0f} B/s. "
        f"Eq. (5.8) predicted about 515 B/s for the gateway–broker leg [calculated], within {abs(pl['mqtt_gw_wire']['mean'] / 515 - 1) * 100:.0f} %. "
        f"The first edition's Modbus design needs {mb['event_block_P1s']:.0f} B/s per device for the event block at $P$ = 1 s, "
        f"{mb['event_block_P0.25s']:.0f} B/s at 0.25 s and {mb['multirate_eq5_2']:.0f} B/s for the full multi-rate scheme — independent of how "
        "often anything changes. For the 21 devices both OPC UA and MQTT legs together use "
        f"{21 * (pl['opcua_wire']['mean'] + pl['mqtt_gw_wire']['mean']) * 8 / 1e6:.2f} Mbit/s, "
        f"{21 * (pl['opcua_wire']['mean'] + pl['mqtt_gw_wire']['mean']) * 8 / 1e8 * 100:.2f} % of a 100-Mbit/s link; bandwidth is not a design "
        f"criterion for either architecture. Security adds {100 * (sc['opcua_payload']['mean'] / pl['opcua_payload']['mean'] - 1):.0f} % "
        f"payload on the OPC UA leg (signatures, padding, sequence headers) and {100 * (sc['mqtt_gw_payload']['mean'] / pl['mqtt_gw_payload']['mean'] - 1):.0f} % "
        "on the MQTT leg (TLS records).")
    # ---------------- security
    p_, s_ = SE['plain'], SE['secured']
    T['SECURE_TEXT'] = (
        f"SignAndEncrypt and TLS changed the latency by less than the run-to-run variation: median end-to-end "
        f"{p_['e2e_p50_ms']['mean']:.1f} ms unsecured versus {s_['e2e_p50_ms']['mean']:.1f} ms secured, 99th percentile "
        f"{p_['e2e_p99_ms']['mean']:.1f} versus {s_['e2e_p99_ms']['mean']:.1f} ms, because the publishing interval dominates the latency. "
        f"CPU rose from {p_['gw_cpu_pct']['mean']:.2f} to {s_['gw_cpu_pct']['mean']:.2f} % of one core in the gateway and from "
        f"{p_['plant_cpu_pct']['mean']:.2f} to {s_['plant_cpu_pct']['mean']:.2f} % in the server process; the secure-channel and session set-up "
        f"took {1000 * s_['gw_connect_s']['mean']:.0f} ms instead of {1000 * p_['gw_connect_s']['mean']:.0f} ms (RSA operations; once per "
        "connection). On the factory's industrial PC these costs are negligible; on a small controller the RSA operations of the "
        "session set-up and the symmetric encryption of every message are the part to check (Section 5.11). Security is "
        "therefore not a performance question in this architecture but an organisational one — certificates, trust lists and "
        "their renewal (Section 5.6).")
    # ---------------- commands
    mbc, ua, us = cmd['modbus_toggle_bit'], cmd['opcua_none'], cmd['opcua_sign_encrypt']
    T['CMD_TEXT'] = (
        f"The toggle-bit handshake issued {mbc['transactions_per_command']:.0f} Modbus request/response pairs per job command (2 reads to "
        "check the previous handshake, 3 FC16 writes for job id, parameters and serial number, a read of the acknowledged sequence, the "
        "FC16 command write, the FC06 request bit and 3 reads to confirm acknowledgement, sequence and result) and took "
        f"{mbc['stats']['p50_ms']:.2f} ms (median) on loopback; the OPC UA method call is one request/response and took "
        f"{ua['stats']['p50_ms']:.2f} ms without and {us['stats']['p50_ms']:.2f} ms with SignAndEncrypt. Python's per-message cost of "
        "the OPC UA stack is higher than that of the minimal Modbus implementation, so on loopback the handshake is "
        f"{'faster' if mbc['stats']['p50_ms'] < ua['stats']['p50_ms'] else 'slower'} — but on a real network and a real PLC each "
        "Modbus transaction costs one round trip plus up to one scan time (first edition: 6.3 ms mean with a 10-ms scan), so "
        f"the handshake needs about {mbc['transactions_per_command']:.0f} × 6.3 ≈ {mbc['transactions_per_command'] * 6.3:.0f} ms against one "
        "round trip plus one scan for the method call [calculated]. The traffic per command was "
        f"{mbc['bytes_per_command']:.0f} B of TCP payload in {mbc['segments_per_command']:.0f} segments for the handshake and "
        f"{ua['bytes_per_command']:.0f} B in {ua['segments_per_command']:.0f} segments for the call ({us['bytes_per_command']:.0f} B secured). "
        f"The idempotent retry — the same call with the same JobId — took {ua['duplicate_p50_ms']:.2f} ms and was recognised as duplicate "
        f"in {ua['duplicate_detected']} of {ua['duplicate_calls']} cases; all {ua['status_ok']} job commands were accepted. At about one job per "
        "device and minute, command latency is irrelevant for the FMS throughput in both designs; what matters is that a lost "
        "reply can never start a job twice, which the JobId guarantees with one message instead of the handshake's eleven.")
    # ---------------- comparison table
    e1 = {'loss_event': '0 of 23 825 (event block)', 'loss_state': '2–37 % (state-only polling)'}
    T['T_COMPARE'] = ('| Criterion | Modbus TCP/HTTP (edition 1) | OPC UA + MQTT (edition 2) |\n|---|---|---|\n'
                      f"| State changes delivered, normal operation | 100 % with event block (0 of 23 825 lost); 63–98 % state-only | 100 % with events ({X['EV_TOTAL']} of {X['EV_TOTAL']}); {X['C_Q1_1000']}–{X['C_Q1_100']} % with data change $q$ = 1 |\n"
                      f"| … across a broker / gateway restart | gateway restart: ring of 8 events per device | 100 % with QoS 1–2 + store-and-forward (+ replay); {100 * nosf['pooled'][0] / nosf['pooled'][1]:.1f} % with QoS 0 alone |\n"
                      f"| Latency, 21 devices (median / max) | 0.14 / 0.26 s at $P$ = 0.25 s; 0.52 / 1.02 s at $P$ = 1 s | {S['perdev']['21']['e2e_p50_ms']['mean'] / 1000:.3f} / {S['perdev']['21']['e2e_max_ms']['max'] / 1000:.3f} s (events $P$ = 0.1 s, to the twin via MQTT) |\n"
                      f"| Scaling tested | 160 machines, parallel poll 14 ms | 100 devices, max {max(d['e2e_max_ms']['max'] for t in S.values() for d in t.values()):.0f} ms |\n"
                      f"| Bytes per device and second | {mb['event_block_P0.25s']:.0f} (event block, 0.25 s) – {mb['multirate_eq5_2']:.0f} (multi-rate) [calc.] | {pl['opcua_wire']['mean']:.0f} (OPC UA leg) + {pl['mqtt_gw_wire']['mean']:.0f} (MQTT leg) [meas. + calc.] |\n"
                      f"| Gateway CPU / memory, 21 devices | not measured (stdlib, ≈ 0.04 ms per request) | {S['perdev']['21']['gw_cpu_pct']['mean']:.1f} % of a core / {S['perdev']['21']['gw_ws_mb']['mean']:.0f} MB; broker {S['perdev']['21']['broker_ws_mb']['mean']:.0f} MB |\n"
                      f"| Job command | {mbc['transactions_per_command']:.0f} transactions, {mbc['stats']['p50_ms']:.2f} ms loopback, ≈ {mbc['transactions_per_command'] * 6.3:.0f} ms with PLC [calc.] | 1 call, {ua['stats']['p50_ms']:.2f} ms ({us['stats']['p50_ms']:.2f} ms secured) |\n"
                      "| Semantics | register addresses, scaling and types in every consumer | browse names, types, units, device class in the model |\n"
                      "| Security | none in the protocol (zoning only) | SignAndEncrypt, trust lists, TLS, roles [design] |\n"
                      "| Software | Python standard library only | 3 open-source packages (+ dependencies), offline wheels |\n"
                      "| Machine requirement | Modbus TCP server + function block | OPC UA server with model, methods, events (option) or retrofit server |\n")
    # ---------------- H1
    allc = all(d['pooled'][0] == d['pooled'][1] for t in S.values() for d in t.values())
    p21 = S['perdev']['21']
    T['H1_TEXT'] = (
        f"- **Completeness (100 %).** With OPC UA events and Sparkplug B over QoS 1 with store-and-forward, every state change "
        f"reached the twin in every run: {X['EV_TOTAL']} of {X['EV_TOTAL']} in the OPC UA completeness runs up to "
        f"{X['EV_RATE16']} changes per device and second, all changes in the 18 scaling runs with up to 100 devices, and all "
        f"{tot} changes in the three QoS-1 restart runs. The condition is the configuration, not the protocols: data-change "
        f"subscriptions with queue size 1 delivered only {X['C_Q1_1000']} % at $P$ = 1 s, a sampled variable lost the short "
        f"states, and QoS 0 without store-and-forward lost {100 - 100 * nosf['pooled'][0] / nosf['pooled'][1]:.1f} % across a broker restart. "
        "QoS 1 alone is not an end-to-end guarantee across a non-persistent broker restart (acceptance test, Chapter 8); the "
        "counter-gap replay of Section 5.5.5 closes this gap. **Supported** under the design rules events + queue, QoS ≥ 1, "
        "store-and-forward and replay.\n"
        f"- **Latency (< 1 s, 21 devices, one PC).** In normal operation the maximum end-to-end latency for 21 devices was "
        f"{p21['e2e_max_ms']['max']:.0f} ms (one server per device; 99th percentile {p21['e2e_p99_ms']['mean']:.0f} ms), and no change in any "
        f"scaling run took longer than {max(d['e2e_max_ms']['max'] for t in S.values() for d in t.values()):.0f} ms. During a 5-s broker outage "
        "the stored changes arrived up to 5.8 s late — an outage is detected and repaired, but cannot be hidden. **Supported** "
        "for normal operation; the publishing interval must satisfy $S + P + c_{max} < 1$ s (Eq. 5.10).\n"
        "- **Removal of per-machine register mapping.** Every field of register map V1.2 is mapped onto the information model "
        "(Table 5.3); consumers address `Machines/<Device>/...` by browse name with types and units, the unchanged FMS control "
        "ran on it through one generic adapter (Chapter 8), and the twin reads named Sparkplug metrics. The mapping work moves "
        "to the machine supplier or the retrofit server and is done once per machine type against a published model. "
        "**Supported**, with the qualification that the companion-specification NodeSets were emulated (Section 5.4.1) and "
        "real CNC servers may cover only part of the model.\n"
        f"- **Price: resources and configuration effort.** The gateway needed {p21['gw_cpu_pct']['mean']:.1f} % of one core and "
        f"{p21['gw_ws_mb']['mean']:.0f} MB, the broker {p21['broker_ws_mb']['mean']:.0f} MB, and each Python OPC UA server about "
        f"{S['perdev']['100']['plant_ws_mb']['mean'] / 100:.0f} MB — much more memory than the first edition's standard-library gateway, "
        "but a small fraction of one industrial PC. The configuration effort is clearly higher: information model, 708 monitored "
        "items, certificates and trust lists, broker ACLs, three external packages and new skills (Section 5.10). Bytes on the "
        "wire were lower than for Modbus polling with comparable latency (event block at 0.25 s, multi-rate scheme) but higher "
        "than for the slowest Modbus scheme (event block at 1 s; Table 5.9). **Supported** for memory, CPU and configuration "
        "effort; bandwidth is negligible for both.\n\n"
        "**H1 is supported** under the stated conditions — events with queues, QoS ≥ 1 with store-and-forward and counter-gap "
        "replay, publishing interval ≤ 1 s minus processing time — for the laboratory with Python stacks on one PC and loopback "
        "network. Because the Python broker and servers are slower than Mosquitto and industrial C stacks, the latency and "
        "resource results are conservative for the gateway and broker, but the behaviour of real machine servers (sampling, "
        "event support, queue sizes, method support) is not covered and must be verified (Section 5.11).")
    T['H1_VERDICT'] = 'supported under the stated design rules and laboratory conditions'
    T['SUMMARY_BULLETS'] = (
        f"- 100 % of state changes delivered with OPC UA events ({X['EV_TOTAL']} of {X['EV_TOTAL']}, up to {X['EV_RATE16']} changes per "
        f"device and second), against {X['C_Q1_1000']} % for data changes with queue size 1 at 1 s — the polling loss of the first "
        "edition reappears whenever a subscription is configured like a poll;\n"
        f"- 100 % across a 5-s broker restart with QoS 1–2 and store-and-forward, {100 * nosf['pooled'][0] / nosf['pooled'][1]:.1f} % with "
        "QoS 0 alone; a counter-gap replay repairs the remaining end-to-end gap of non-persistent brokers;\n"
        f"- median end-to-end latency machine → OPC UA → MQTT → twin of {S['perdev']['21']['e2e_p50_ms']['mean']:.0f} ms and maximum "
        f"{S['perdev']['21']['e2e_max_ms']['max']:.0f} ms for 21 devices, below {max(d['e2e_max_ms']['max'] for t in S.values() for d in t.values()):.0f} ms "
        "for up to 100 devices in both server topologies;\n"
        f"- {pl['mqtt_gw_wire']['mean']:.0f} B/s per device on the MQTT leg against {mb['event_block_P0.25s']:.0f}–{mb['multirate_eq5_2']:.0f} B/s for "
        f"Modbus polling; gateway {S['perdev']['21']['gw_cpu_pct']['mean']:.1f} % of a core, security overhead within the run-to-run variation;\n"
        f"- one OPC UA method call instead of {mbc['transactions_per_command']:.0f} Modbus transactions per job command, idempotent through the JobId.")
    return T
