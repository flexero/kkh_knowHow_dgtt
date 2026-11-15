"""Paper 3 - analytical sizing model (Section 4) and worked example for the 21-device case factory. [calculated]

Also: seeded Monte-Carlo of state-only sampling for the thesis 'mix' event model (no sockets) [simulated], used as the
model curve for the replication campaign E2, and the closed forms for the Poisson model used in E3.

    python sizing_model.py   -> ../data/sizing_model.json (+ printed summary)
"""
import json
import math
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))

ETH_SEG = 78     # preamble+IFG 20, Ethernet header+FCS 18, IPv4 20, TCP 20
ACK = 84         # minimum frame 64 + 20


def b_read(n):          # Eq. (2): FC03 request (12 B ADU) + response (9 + 2n) + one TCP ACK
    return (12 + ETH_SEG) + (9 + 2 * n + ETH_SEG) + ACK


def b_write1():         # FC06: request and echo are both 12 B ADUs
    return (12 + ETH_SEG) * 2 + ACK


def pois_pmf(mu, k):
    return math.exp(-mu + k * math.log(mu) - math.lgamma(k + 1)) if mu > 0 else (1.0 if k == 0 else 0.0)


def p_overflow(mu, R):
    return max(0.0, 1.0 - sum(pois_pmf(mu, k) for k in range(R + 1)))


def loss_fraction(mu, R):
    """eta = E[(N-R)+] / E[N] for N ~ Poisson(mu)."""
    ex_le = sum((R - k) * pois_pmf(mu, k) for k in range(R + 1))
    return (mu - R + ex_le) / mu


def ring_depth(lam, T, eps):
    R = 0
    while p_overflow(lam * T, R) > eps:
        R += 1
    return R


def state_only_reported(mu, M=4):
    """Expected share of changes reported by state-only polling, Poisson events, uniform jumps among M states."""
    return (M - 1) / M * (1 - math.exp(-M * mu / (M - 1))) / mu if mu > 0 else 1.0


def unobserved_exp(mu):
    """Share of exponential state segments that no poll observes (mean dwell 1/lam, period P, mu = lam P)."""
    return 1 - (1 - math.exp(-mu)) / mu


def mc_mix(P, horizon=200000.0, seed=1):
    """State-only sampling of the thesis mix (30 % U(0.05,0.5) s, 70 % Exp(mean 5 s)), 4 states, period P."""
    rng = random.Random(seed)
    t, st, changes, seg = 0.0, 1, [], []
    while t < horizon:
        d = rng.uniform(0.05, 0.5) if rng.random() < 0.3 else rng.expovariate(0.2)
        seg.append((t, t + d))
        t += d
        st = rng.choice([s for s in (1, 2, 3, 4) if s != st])
        changes.append((t, st))
    # state at poll times (phase random)
    phase = rng.uniform(0, P)
    reported, k, cur, prev = 0, 0, 1, None
    tp = phase
    states_at = []
    while tp < horizon:
        while k < len(changes) and changes[k][0] <= tp:
            cur = changes[k][1]
            k += 1
        if prev is not None and cur != prev:
            reported += 1
        prev = cur
        tp += P
    n_changes = sum(1 for c in changes if phase < c[0] < tp - P)
    unobs = sum(1 for a, b in seg if math.floor((b - phase) / P) == math.floor((a - phase) / P))
    return reported / n_changes, unobs / len(seg)


def main():
    out = {}
    # ---------------------------------------------------------------- frames and bandwidth, 21-device example
    plan = [('FAST 0/12', 12, 2.0, 'r'), ('EVENT 104/28', 28, 2.0, 'r'), ('COUNTERS 20/26', 26, 1.0, 'r'),
            ('TYPE+JOB 300/96', 96, 1.0, 'r'), ('ENERGY 100/4', 4, 0.1, 'r'), ('HEARTBEAT FC06 226', 1, 1.0, 'w')]
    rows, B, req = [], 0.0, 0.0
    for name, n, f, kind in plan:
        b = b_read(n) if kind == 'r' else b_write1()
        rows.append({'request': name, 'n': n, 'rate_hz': f, 'bytes_per_poll': b, 'bytes_per_s': b * f})
        B += b * f
        req += f
    N = 21
    out['poll_plan'] = rows
    out['per_device'] = {'requests_per_s': req, 'bytes_per_s': B}
    out['plant21'] = {'requests_per_s': N * req, 'bytes_per_s': N * B, 'mbit_s': N * B * 8 / 1e6,
                      'share_100M': N * B * 8 / 1e8}
    out['thesis_bench_block36'] = b_read(36)
    out['plant160_thesis_scheme'] = 160 * (2 * b_read(12) + 2 * b_read(28) + b_read(80) + 0.1 * b_read(4)) * 8 / 1e6
    # ---------------------------------------------------------------- RTT and capacity
    def ert(t_net, t0, scan):
        return t_net + t0 + scan / 2
    classes = {'PLC LAN': (0.3, 1.0, 10.0), 'CNC PMC': (0.3, 5.0, 20.0), 'AGV Wi-Fi': (10.0, 1.0, 10.0),
               'lab bench': (0.05, 1.0, 10.0)}
    out['ERTT_ms'] = {k: ert(*v) for k, v in classes.items()}
    e = out['ERTT_ms']['PLC LAN'] / 1000
    out['Nmax_seq_plc_lan'] = 1 / (req * e)
    mix = {'HMC-01': 'CNC PMC', 'HMC-02': 'CNC PMC', 'HMC-03': 'CNC PMC', 'VMC-01': 'CNC PMC', 'HONE-01': 'CNC PMC',
           'LATHE-01': 'CNC PMC', 'GRIND-01': 'CNC PMC', 'AGV-01': 'AGV Wi-Fi', 'AGV-02': 'AGV Wi-Fi'}
    devices = ['LOAD-CC', 'PPS-1', 'HMC-01', 'HMC-02', 'HMC-03', 'WASH-01', 'VMC-01', 'HONE-01', 'LATHE-01', 'GRIND-01',
               'ASSY-01', 'ROBOT-01', 'TEST-01', 'TEST-02', 'PAINT-01', 'FINAL-01', 'PACK-01', 'AGV-01', 'AGV-02',
               'ASRS-RAW', 'ASRS-FG']
    load_uniform = sum(req * out['ERTT_ms']['PLC LAN'] for _ in devices) / 1000
    load_mixed = sum(req * out['ERTT_ms'][mix.get(d, 'PLC LAN')] for d in devices) / 1000
    out['one_worker_utilisation'] = {'all_6.3ms': load_uniform, 'mixed_classes': load_mixed}
    # parallel cycle: E[max of N iid U(0,scan)] + t0 + t_net + N t_gw
    t_gw = 0.04
    out['parallel_cycle_ms'] = {str(n): 1.0 + 0.05 + 10.0 * n / (n + 1) + n * t_gw for n in (10, 21, 40, 80, 160)}
    out['seq_cycle_ms_ERTT6.05'] = {str(n): n * 6.05 for n in (10, 21, 40, 80, 160)}
    # ---------------------------------------------------------------- latency
    for P in (0.25, 0.5, 1.0):
        out[f'latency_P{P}'] = {'mean_ms': 1000 * P / 2 + 6.3, 'max_ms': 1000 * P + 11.3}
    # ---------------------------------------------------------------- loss
    out['p_overflow_bench'] = {str(T): p_overflow(0.28 * T, 8) for T in (1, 10, 60)}
    out['ring_depth'] = {f'lam{l}_T{T}_eps{e}': ring_depth(l, T, e) for l, T, e in
                         ((0.05, 60, 1e-6), (0.05, 120, 1e-6), (0.0058, 60, 1e-6), (0.28, 10, 1e-6), (0.28, 1, 1e-6))}
    out['hmc'] = {'lam': 2 / 345, 'p_ovf_T60': p_overflow(2 / 345 * 60, 8), 'p_ovf_T300': p_overflow(2 / 345 * 300, 8)}
    out['poisson_curves'] = [{'mu': mu, 'p_overflow_R8': p_overflow(mu, 8), 'loss_R8': loss_fraction(mu, 8),
                              'loss_R4': loss_fraction(mu, 4), 'loss_R16': loss_fraction(mu, 16),
                              'state_only_reported': state_only_reported(mu), 'unobserved_exp': unobserved_exp(mu)}
                             for mu in [0.25 * k for k in range(1, 81)]]
    # thesis mix: state-only (Monte Carlo, simulated) and the segment formula of the thesis
    out['mix_state_only_mc'] = {}
    for P in (0.1, 0.25, 0.5, 1.0, 2.0):
        rep, un = mc_mix(P)
        out['mix_state_only_mc'][str(P)] = {'reported': rep, 'unobserved_segments': un}
    lam_mix = 1 / (0.3 * 0.275 + 0.7 * 5.0)
    out['mix_lambda'] = lam_mix
    # ---------------------------------------------------------------- time-stamp error
    out['tserr'] = {'state_only_sd_ms_P0.5': 500 / math.sqrt(12), 'state_only_sd_ms_P1': 1000 / math.sqrt(12),
                    'event_block_sd_ms_scan10': 10 / math.sqrt(12), 'drift_50ppm_1h_ms': 50e-6 * 3600 * 1000}
    json.dump(out, open(os.path.join(HERE, '..', 'data', 'sizing_model.json'), 'w'), indent=1)
    for k, v in out.items():
        if k not in ('poisson_curves',):
            print(k, json.dumps(v)[:300])


if __name__ == '__main__':
    main()
