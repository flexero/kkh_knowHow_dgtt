"""Case numbers quoted in Section 4 of the paper (CALCULATED from reference design estimates / SIMULATED).

* static capacity of every station type (thesis Eq. 4.2) and the static upper bound of good output;
* design-model DES output (10 replications) and its gap to the static bound;
* worked conjugate examples of thesis chapter 4 (HMC failure, repair, cycle time, scrap, forgetting).
Writes data/case_numbers.json.
"""
import json
import math
import os
import random
import statistics

import p2common as c


def main():
    design = c.flowline.compressor_line()
    out = {'stations': []}
    caps = c.capacities(design)
    for st, cap in zip(design, caps):
        tmean = sum(c.flowline.MIX[v] * st.tdesign[v] for v in c.flowline.MIX)
        out['stations'].append({'name': st.name, 'c': st.c, 't_mean_s': round(tmean, 1), 'mtbf_h': st.mtbf_h,
                                'mttr_min': round(st.mttr_h * 60, 1), 'scrap': st.scrap,
                                'availability': round(st.mtbf_h / (st.mtbf_h + st.mttr_h), 4),
                                'good_capacity_month': round(cap)})
    jb = min(range(len(caps)), key=lambda j: caps[j])
    good_share = math.prod(1 - st.scrap for st in design)
    # parts the bottleneck can process (capacity before its own scrap) times the total good share
    proc_bn = caps[jb] / (1 - design[jb].scrap)
    out['bottleneck'] = design[jb].name
    out['bottleneck_parts_processed'] = round(proc_bn)
    out['good_share'] = round(good_share, 4)
    out['static_upper_bound_good'] = round(proc_bn * good_share)
    rng = random.Random(1)
    res = [c.flowline.simulate(design, c.flowline.MIX, c.HOURS, rng)[0] for _ in range(10)]
    out['des_design_mean'] = round(statistics.mean(res))
    out['des_design_range'] = [min(res), max(res)]
    out['des_gap_to_bound_pct'] = round(100 * (1 - statistics.mean(res) / out['static_upper_bound_good']), 2)
    out['work_content_VC20_s'] = sum(st.tdesign['VC20'] for st in design)
    out['n_servers_total'] = sum(st.c for st in design)
    ex = c.bayes.chapter4_examples()
    out['examples'] = {k: [round(x, 4) if isinstance(x, float) else ([round(y, 3) for y in x] if isinstance(x, tuple) else x)
                           for x in v] for k, v in ex.items()}
    json.dump(out, open(os.path.join(c.DATA, 'case_numbers.json'), 'w'), indent=1)
    print(json.dumps(out, indent=1))


if __name__ == '__main__':
    main()
