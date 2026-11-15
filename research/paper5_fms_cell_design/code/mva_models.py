"""Analytical models of the pallet-based FMS cell (standard library only).

  static capacity (Eq. 1-2), asymptotic bounds (Eq. 8-9),
  model A  - exact load-dependent MVA of the closed network L (1 server) - S (1 server) - H (c servers)   (Eq. 3-7)
  model B  - blocking-aware MVA: the single locations of L and H are held during the shuttle exchange, plus an M/G/1
             shuttle waiting time, solved as a fixed point                                             (Eq. 10-12)
  composite estimate X_est(N) = min(X_A(N), X_B(N_max))                                                  (Eq. 13)
Run as a script to write data/mva_results.json (design parameterisation, what-ifs, sensitivity).
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# ------------------------------------------------------------------ design data [design estimate]
MIX = {1: 0.3, 2: 0.5, 3: 0.2}                     # VC10, VC20, VC30
T_HMC = {1: 270.0, 2: 345.0, 3: 450.0}             # machining time per part [s]
T_PC = 15.0                                        # HMC pallet change [s]
OP_TASK3 = 140.0                                   # operator unload + load [s], x U(0.8, 1.3) -> mean factor 1.05
U_FAC = 1.05
RACK = range(1, 13)
LOAD, HMCS = 13, (14, 15, 16)
A_HMC = 30.0 / (30.0 + 20.0 / 60.0)                # MTBF 30 h, MTTR 20 min
Q_HMC = 0.008
H_MONTH = 330.0                                    # productive hours per month [assumption]


def move(a, b):
    """Shuttle move time rule [example]: 12 s + 2 s per location distance."""
    return 12.0 + 2.0 * abs(a - b)


def mean_moves(racks=RACK):
    m_LH = sum(move(LOAD, h) for h in HMCS) / len(HMCS)
    m_HR = sum(move(h, r) for h in HMCS for r in racks) / (len(HMCS) * len(racks))
    m_RL = sum(move(r, LOAD) for r in racks) / len(racks)
    return m_LH, m_HR, m_RL


def t_mach(mix=MIX):
    return sum(mix[v] * T_HMC[v] for v in mix)


# ------------------------------------------------------------------ static model
def static_capacity(c=3, A=A_HMC, t=None, h=T_PC, q=Q_HMC, H=H_MONTH):
    t = t_mach() if t is None else t
    month = c * A * 3600.0 * H / (t + h) * (1 - q)
    return month, month / H


# ------------------------------------------------------------------ exact MVA (load-dependent multi-server)
def mva(stations, N):
    """stations: list of (name, D [s], c); c = 0 -> pure delay. Returns per n = 1..N a dict with X [1/h], R, Q, U."""
    K = len(stations)
    Q = [0.0] * K
    P = [[1.0] + [0.0] * N for _ in range(K)]      # P[k][j]: probability of j customers at k for population n-1
    out = []
    for n in range(1, N + 1):
        R = []
        for k, (_, D, c) in enumerate(stations):
            if c == 0:
                R.append(D)
            elif c == 1:
                R.append(D * (1 + Q[k]))
            else:
                corr = sum((c - 1 - j) * P[k][j] for j in range(0, min(c - 1, N + 1)))
                R.append(D / c * (1 + Q[k] + corr))
        X = n / sum(R)
        Qn = [X * r for r in R]
        Pn = []
        for k, (_, D, c) in enumerate(stations):
            p = [0.0] * (N + 1)
            if c >= 2:
                for j in range(1, n + 1):
                    p[j] = X * D / min(j, c) * P[k][j - 1]
                p[0] = max(0.0, 1 - sum(p[1:]))
            Pn.append(p)
        Q, P = Qn, Pn
        out.append({'n': n, 'X_h': X * 3600.0, 'R': R, 'Q': Qn,
                    'U': [X * D / c if c else None for (_, D, c) in stations], 'C': sum(R)})
    return out


def seidmann(stations, N):
    st = []
    for nm, D, c in stations:
        st += [(nm + '_q', D / c, 1), (nm + '_d', D * (c - 1) / c, 0)] if c >= 2 else [(nm, D, c)]
    return mva(st, N)


# ------------------------------------------------------------------ parameter sets
def params(mix=MIX, tL=None, cL=1, cH=3, DH=None, racks=RACK, cv2=0.09):
    m_LH, m_HR, m_RL = mean_moves(racks)
    return {'tL': OP_TASK3 * U_FAC if tL is None else tL, 'cL': cL, 'cH': cH,
            'DH': t_mach(mix) + T_PC if DH is None else DH,
            'DS': m_LH + m_HR + m_RL, 'nmoves': 3, 'eL': m_LH + m_RL, 'eH': m_HR + m_LH, 'cv2': cv2}


def modelA(N, p):
    return mva([('L', p['tL'], p['cL']), ('S', p['DS'], 1), ('H', p['DH'], p['cH'])], N)


def modelB(N, p, iters=500):
    """Blocking-aware model: D_L' = t_L + e_L + 2W, D_H' = D_H + e_H + 2W, W from M/G/1 with rho_S = X D_S."""
    W, res, rho = 0.0, None, 0.0
    for _ in range(iters):
        eL, eH = p['eL'], p['eH']
        res = mva([('L', p['tL'] + eL + (2 * W if eL else 0.0), p['cL']),
                   ('H', p['DH'] + eH + (2 * W if eH else 0.0), p['cH'])], N)
        X = res[-1]['X_h'] / 3600.0
        rho = min(0.95, X * p['DS'])
        mbar = p['DS'] / p['nmoves']
        Wn = rho * mbar * (1 + p['cv2']) / (2 * (1 - rho))
        if abs(Wn - W) < 1e-10:
            break
        W = 0.5 * W + 0.5 * Wn
    return res, W, rho


def B_curve(p, Nmax=12):
    out = []
    for n in range(1, Nmax + 1):
        res, W, rho = modelB(n, p)
        out.append({'n': n, 'X_h': res[-1]['X_h'], 'UL': res[-1]['U'][0], 'UH': res[-1]['U'][1], 'W': W, 'rhoS': rho})
    return out


def bounds(p):
    D = p['tL'] + p['DS'] + p['DH']
    Dmax = max(p['tL'] / p['cL'], p['DS'], p['DH'] / p['cH'])
    return {'D': D, 'Dmax': Dmax, 'Nstar': D / Dmax, 'Xmax_h': 3600.0 / Dmax}


def composite(N, p, Nmax=12):
    xb = B_curve(p, Nmax)[-1]['X_h']
    return min(modelA(N, p)[-1]['X_h'], xb)


# ------------------------------------------------------------------ what-if cases (model B, N = 12)
def whatifs():
    near = range(10, 13)                           # nearest-rack rule: pallets stored in locations 10-12
    m_LH, m_HR_n, m_RL_n = mean_moves(near)
    base = params()
    nr = dict(eL=m_LH + m_RL_n, eH=m_HR_n + m_LH, DS=m_LH + m_HR_n + m_RL_n)
    C = {
        'Base design': {},
        'Nearest-rack storage': nr,
        'Quick clamping (140 -> 100 s)': dict(tL=100 * U_FAC),
        'Fixture change 600 s every 20 parts': dict(tL=base['tL'] + 600 * U_FAC / 20),
        'Nearest-rack storage + quick clamping': dict(nr, tL=100 * U_FAC),
        'Two-position load station': dict(eL=0.0),
        'Second load station': dict(cL=2),
        'Two-position HMC changers': dict(eH=0.0),
        'Fourth HMC (one load station)': dict(cH=4),
        'Two-position load station + quick clamping': dict(eL=0.0, tL=100 * U_FAC),
        'Second load station + fourth HMC': dict(cL=2, cH=4),
        'Second load station + two-position HMC changers + nearest rack': dict(cL=2, eH=0.0, eL=nr['eL'], DS=nr['DS']),
    }
    out = []
    for name, ch in C.items():
        p = dict(base); p.update(ch)
        c = B_curve(p)
        b = bounds(p)
        out.append({'case': name, 'X4': c[3]['X_h'], 'X8': c[7]['X_h'], 'X12': c[11]['X_h'], 'UL': c[11]['UL'],
                    'UH': c[11]['UH'], 'rhoS': c[11]['rhoS'], 'month': c[11]['X_h'] * H_MONTH, 'XA12': modelA(12, p)[-1]['X_h'],
                    'bound': b['Xmax_h']})
    return out


def sensitivity():
    """X_B(12) versus operator time (unload + load base 80..200 s) for 1 / 2 load stations and 3 / 4 HMCs, and versus
    the share of VC30 in the mix (VC10:VC20 kept 3:5)."""
    op = []
    for base_t in range(80, 201, 10):
        row = {'t_op': base_t * U_FAC}
        for cL in (1, 2):
            for cH in (3, 4):
                p = params(tL=base_t * U_FAC, cL=cL, cH=cH)
                row[f'L{cL}H{cH}'] = B_curve(p)[-1]['X_h']
        row['static3'] = static_capacity()[1]
        op.append(row)
    mixr = []
    for s30 in [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6]:
        mix = {1: (1 - s30) * 3 / 8, 2: (1 - s30) * 5 / 8, 3: s30}
        row = {'vc30': s30, 't_mach': t_mach(mix)}
        for cL in (1, 2):
            p = params(mix=mix, cL=cL)
            row[f'L{cL}'] = B_curve(p)[-1]['X_h']
            row[f'A_L{cL}'] = modelA(12, p)[-1]['X_h']
        row['static'] = static_capacity(t=t_mach(mix))[1]
        mixr.append(row)
    return op, mixr


def main():
    p = params()
    A = modelA(12, p)
    S = seidmann([('L', p['tL'], 1), ('S', p['DS'], 1), ('H', p['DH'], 3)], 12)
    Bc = B_curve(p)
    res = {'params': p, 'static': static_capacity(), 'static_load_89s': 3600 / 89.0 * 0.9996,
           'bounds': bounds(p), 'A': [{'n': a['n'], 'X_h': a['X_h'], 'U': a['U'], 'Q': a['Q'], 'R': a['R']} for a in A],
           'seidmann': [s['X_h'] for s in S], 'B': Bc, 'composite': [composite(n, p) for n in range(1, 13)],
           'whatif': whatifs()}
    m_LH, m_HR_n, m_RL_n = mean_moves(range(10, 13))
    pn = dict(p); pn.update(eL=m_LH + m_RL_n, eH=m_HR_n + m_LH, DS=m_LH + m_HR_n + m_RL_n)
    res['B_nearest'] = B_curve(pn)
    res['A_nearest'] = [a['X_h'] for a in modelA(12, pn)]
    res['sens_op'], res['sens_mix'] = sensitivity()
    with open(os.path.join(HERE, '..', 'data', 'mva_results.json'), 'w') as f:
        json.dump(res, f, indent=1)
    print('params', {k: round(v, 2) if isinstance(v, float) else v for k, v in p.items()})
    print('static', [round(x, 2) for x in res['static']], 'bounds', {k: round(v, 2) for k, v in res['bounds'].items()})
    print(' N   A      Seid   B      comp   UL_A  UH_A  UL_B  W')
    for a, s, b, c in zip(A, res['seidmann'], Bc, res['composite']):
        print(f"{a['n']:2d} {a['X_h']:6.2f} {s:6.2f} {b['X_h']:6.2f} {c:6.2f} {a['U'][0]:.3f} {a['U'][2]:.3f} {b['UL']:.3f} {b['W']:.2f}")
    for w in res['whatif']:
        print(f"{w['case']:66s} X4 {w['X4']:5.2f} X12 {w['X12']:5.2f} A12 {w['XA12']:5.2f} bound {w['bound']:5.2f} UL {w['UL']:.2f} UH {w['UH']:.2f} month {w['month']:.0f}")
    for r in res['sens_op']:
        print({k: round(v, 2) for k, v in r.items()})
    for r in res['sens_mix']:
        print({k: round(v, 2) for k, v in r.items()})


if __name__ == '__main__':
    main()
