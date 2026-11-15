"""Paper 4 - computational effort: screening evaluations per ADAPTIVE decision and DES-equivalent time.
Output: ../data/timing.json"""
import json, os, random, statistics, time
import staged as sd
stg, flowline = sd.stg, sd.flowline
DATA = os.path.normpath(os.path.join(sd.HERE, '..', 'data'))
eta = {int(k): v for k, v in json.load(open(os.path.join(DATA, 'eta.json'))).items()}
stg.ETA.update(eta); sd.apply_settings(sd.DEFAULT)
count = [0]
orig = stg.screen_th
def counted(line):
    count[0] += 1
    return orig(line)
stg.screen_th = counted
ev, t_dec = [], []
for seed in range(1, 21):
    truth, df = sd.make_scenario(seed, sd.DEFAULT)
    count[0] = 0
    t0 = time.perf_counter()
    sd.run_policy('ADAPTIVE', truth, df, 1000 * seed + 7, dict(sd.DEFAULT), None, None)
    ev.append(count[0] / 4); t_dec.append((time.perf_counter() - t0))
stg.screen_th = orig
t0 = time.perf_counter(); n = 30
for i in range(n):
    flowline.simulate(stg.config_line((), None, None), flowline.MIX, stg.HOURS, random.Random(i))
t_des = (time.perf_counter() - t0) / n
t0 = time.perf_counter()
for i in range(2000):
    stg.screen_th(stg.config_line(()))
t_scr = (time.perf_counter() - t0) / 2000
eta_s = statistics.mean(ev)
out = dict(screen_evals_per_decision=eta_s, max_evals_per_decision=max(ev) , t_screen_s=t_scr, t_des_month_s=t_des,
           des_equiv_s_per_decision_3reps=eta_s * 3 * t_des, full_enumeration_bound_evals=64 * 60 * 8,
           full_enumeration_des_hours=64 * 60 * 8 * 3 * t_des / 3600)
json.dump(out, open(os.path.join(DATA, 'timing.json'), 'w'), indent=1)
print(out)
