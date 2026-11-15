**Fault injection (E6).** A Modbus-aware TCP proxy was placed between the `fmsctl` client (`DeviceLink`, 0.5 s
time-out, one retry over a new connection) and the virtual PLC of the washer. In each repetition the proxy disturbed
exactly one frame type of one command; an instrumented copy of the PLC model counted how many jobs it really started
(Table 12). In all single-fault cases (F1–F6, 120 commands) every command started exactly one job with the correct job
id, and the controller did not even report an error, because the retry over a new connection re-wrote the same
absolute values. When the REQ frame was lost on both attempts (F7), the command failed with a Modbus error, no job was
started, and the controller rule "device idle and finished-job id ≠ job id" correctly allowed the job to be re-sent;
all 20 re-sent jobs ran exactly once. The stale-frame case F8 confirmed the hazard of Section 5.3: with the toggle-only
logic of map V1.2, replaying the old REQ frame after the next command started the current job a second time in all 20
repetitions; with the sequence guard, all 20 stale toggles were ignored, no job ran twice, and the next command
succeeded after the controller's REQ reset.

**Table 12.** Fault injection on the handshake (E6) [measured on the virtual plant; 20 repetitions per case].

| Case | Injected fault (one per command) | Commands | Jobs started | Exactly once | Controller error | Outcome |
|---|---|---|---|---|---|---|
| F0 | none | 20 | 20 | 20 | 0 | correct |
| F1 | REQ request lost once | 20 | 20 | 20 | 0 | correct (retry) |
| F2 | REQ response lost once (PLC already accepted) | 20 | 20 | 20 | 0 | correct (idempotent retry) |
| F3 | REQ request duplicated | 20 | 20 | 20 | 0 | correct |
| F4 | REQ response late (0.8 s > 0.5 s time-out) | 20 | 20 | 20 | 0 | correct (idempotent retry) |
| F5 | response to code + sequence frame lost once | 20 | 20 | 20 | 0 | correct |
| F6 | response to parameter frame lost once | 20 | 20 | 20 | 0 | correct, parameters as sent |
| F7 | REQ request lost on both attempts | 20 | 0 (+20 after re-send) | 0 (+20) | 20 | no job lost or doubled; re-sent correctly |
| F8a | stale REQ frame replayed after the next command, toggle only (V1.2) | 40 | 60 | – | 0 | **20 double executions** |
| F8b | as F8a, with sequence guard | 40 | 40 | 40 | 0 | 20 stale toggles ignored; next command correct |
