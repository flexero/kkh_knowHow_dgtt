This chapter designed a digital twin data path for a factory whose only communication technologies are Ethernet,
Modbus TCP and HTTP, running on one offline PC with the Python standard library. Six design rules define the
architecture: one client, one map, pull for status and handshake for commands, multi-rate polling, heartbeats both
ways, and events instead of samples. Its key element is an event-preserving register block in every PLC — a change
counter, a last-change time stamp and an 8-entry ring buffer — which turns sampled polling into complete,
time-stamped event capture.

Closed-form formulas size the bandwidth (2.1 Mbit/s for 160 machines), the sequential capacity
($N_{max} = P / (k\,\mathbb{E}[\mathrm{RTT}])$), the latency, the event loss and the time-stamp error. A laboratory
campaign of 15 runs with up to 160 machines confirmed the formulas within about 8 % and showed:

- zero event loss with the event block, against 2–37 % unreported changes with state-only polling;
- maximum latencies of 0.26–0.30 s at a 0.25 s polling period;
- parallel polling of 160 machines in 14–24 ms;
- an HTTP API that serves the full plant snapshot about 4 500 times per second.

H1 is supported under the PLC timing model; verification with real Delta and Siemens PLCs is planned. With the
observations of Table 4.5 now available completely and with PLC time stamps, the Bayesian updating of Chapter 6 rests
on a data path that a company without OPC UA, MQTT or cloud services can build and maintain itself.
