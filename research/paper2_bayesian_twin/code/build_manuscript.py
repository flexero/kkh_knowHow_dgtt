"""Turn manuscript_src.md (citation keys [@key; @key2]) into manuscript.md with numbered citations in order of first
appearance (Elsevier numbered style, as used by the Journal of Manufacturing Systems) and a reference list.
Also prints word counts (abstract; main text from Introduction to Conclusions, excluding tables, equations,
figure/table captions, declarations and references) and checks that every reference is cited and vice versa.

Sources of the entries: thesis/references.md, research/sources/README.md, or verified by DOI look-up (marked V in
the comment). Entries marked [verify] carry the open check of the thesis bibliography and must be checked by the
author in the library database before submission.
"""
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
PAPER = os.path.dirname(HERE)

REFS = {
    'bokrantz2017': 'J. Bokrantz, A. Skoogh, D. Lämkull, et al., Data quality problems in discrete event simulation of manufacturing operations, Simulation (2017). https://doi.org/10.1177/0037549717742954. [verify volume/pages and full author list]',
    'terwiesch2001': 'C. Terwiesch, R.E. Bohn, Learning and process improvement during production ramp-up, Int. J. Prod. Econ. 70 (2001) 1–19.',
    'surbier2014': 'L. Surbier, G. Alpan, E. Blanco, A comparative study on production ramp-up: state-of-the-art and new challenges, Prod. Plan. Control 25 (2014) 1264–1286. [verify]',
    'kritzinger2018': 'W. Kritzinger, M. Karner, G. Traar, J. Henjes, W. Sihn, Digital twin in manufacturing: a categorical literature review and classification, IFAC-PapersOnLine 51 (2018) 1016–1022. https://doi.org/10.1016/j.ifacol.2018.08.474.',
    'tao2019': 'F. Tao, H. Zhang, A. Liu, A.Y.C. Nee, Digital twin in industry: state-of-the-art, IEEE Trans. Ind. Inform. 15 (2019) 2405–2415. https://doi.org/10.1109/TII.2018.2873186.',
    'liu2021': 'M. Liu, S. Fang, H. Dong, C. Xu, Review of digital twin about concepts, technologies, and industrial applications, J. Manuf. Syst. 58 (2021) 346–361. https://doi.org/10.1016/j.jmsy.2020.06.017.',  # V
    'konstantinov2022': 'S. Konstantinov, F. Assad, B. Ahmad, et al., Virtual engineering and commissioning to support the lifecycle of a manufacturing assembly system, Machines 10 (2022) 939. https://doi.org/10.3390/machines10100939. [verify full author list]',
    'barton2012': 'R.R. Barton, Tutorial: input uncertainty in output analysis, in: Proceedings of the 2012 Winter Simulation Conference, IEEE, 2012. [verify pages/DOI]',
    'corlu2020': 'C.G. Corlu, A. Akcay, W. Xie, Stochastic simulation under input uncertainty: a review, Oper. Res. Perspect. 7 (2020) 100162. https://doi.org/10.1016/j.orp.2020.100162.',  # V
    'kennedy2001': "M.C. Kennedy, A. O'Hagan, Bayesian calibration of computer models, J. R. Stat. Soc. Ser. B Stat. Methodol. 63 (2001) 425–464.",
    'schumacher2024': 'C. Schumacher, J. Stilling, J. Kriege, P. Buchholz, Live fitting of process data within digital twins of manufacturing to use simulation and optimisation, J. Simul. 18 (2024) 813–834. https://doi.org/10.1080/17477778.2024.2376711.',
    'morris2019': 'T.P. Morris, I.R. White, M.J. Crowther, Using simulation studies to evaluate statistical methods, Stat. Med. 38 (2019) 2074–2102. https://doi.org/10.1002/sim.8086.',  # V
    'negri2017': 'E. Negri, L. Fumagalli, M. Macchi, A review of the roles of digital twin in CPS-based production systems, Procedia Manuf. 11 (2017) 939–948.',
    'lu2020': 'Y. Lu, C. Liu, K.I-K. Wang, H. Huang, X. Xu, Digital twin-driven smart manufacturing: connotation, reference model, applications and research issues, Robot. Comput.-Integr. Manuf. 61 (2020) 101837. https://doi.org/10.1016/j.rcim.2019.101837.',
    'fuller2020': 'A. Fuller, Z. Fan, C. Day, C. Barlow, Digital twin: enabling technologies, challenges and open research, IEEE Access 8 (2020). [verify pages/DOI]',
    'seipolt2025': 'A. Seipolt, R. Buschermöhle, W. Hasselbring, Digital twins in manufacturing: a systematic literature review with retrieval-augmented generation, IEEE Access (2025). https://doi.org/10.1109/ACCESS.2025.3611269.',
    'iso23247': 'ISO 23247-1:2021, Automation systems and integration – Digital twin framework for manufacturing – Part 1: Overview and general principles, International Organization for Standardization, Geneva, 2021.',
    'vanbeek2022': 'A. van Beek, V. Karkaria, W. Chen, Digital twins for the designs of systems: a perspective, arXiv:2211.05040 (2022). [check for journal version]',
    'vanginkel2025': 'M. van Ginkel, P. Ghafoorpoor Yazdi, T. Rupert, J. Reijers, S. Thiede, Digital twins to support smart manufacturing system design and ramp up, Procedia CIRP (2025). https://doi.org/10.1016/j.procir.2025.02.221. [verify volume/pages]',
    'florescu2024': 'A. Florescu, Digital twin for flexible manufacturing systems and optimization through simulation: a case study, Machines 12 (2024) 785. https://doi.org/10.3390/machines12110785.',
    'ullah2024': 'A. Ullah, M. Younas, Development and application of digital twin control in flexible manufacturing systems, J. Manuf. Mater. Process. 8 (2024) 214. https://doi.org/10.3390/jmmp8050214.',
    'chenghol1997': 'R.C.H. Cheng, W. Holland, Sensitivity of computer simulation experiments to errors in input data, J. Stat. Comput. Simul. 57 (1997) 219–241. [verify]',
    'chick2001': 'S.E. Chick, Input distribution selection for simulation experiments: accounting for input uncertainty, Oper. Res. 49 (2001) 744–758. [verify]',
    'zouaoui2003': 'F. Zouaoui, J.R. Wilson, Accounting for parameter uncertainty in simulation input modeling, IIE Trans. 35 (2003) 781–792. [verify]',
    'masciarelli2022': 'A. Masciarelli, A. Matta, Managing input parameter uncertainty in digital twins, IFAC-PapersOnLine 55 (2022) 13–18.',
    'gelman2013': 'A. Gelman, J.B. Carlin, H.S. Stern, D.B. Dunson, A. Vehtari, D.B. Rubin, Bayesian Data Analysis, third ed., CRC Press, Boca Raton, 2013. [verify]',
    'kapteyn2021': 'M.G. Kapteyn, J.V.R. Pretorius, K.E. Willcox, A probabilistic graphical model foundation for enabling predictive digital twins at scale, Nat. Comput. Sci. 1 (2021) 337–347. https://doi.org/10.1038/s43588-021-00069-0.',  # V
    'thelen2023': 'A. Thelen, X. Zhang, O. Fink, Y. Lu, S. Ghosh, B.D. Youn, M.D. Todd, S. Mahadevan, C. Hu, Z. Hu, A comprehensive review of digital twin – part 2: roles of uncertainty quantification and optimization, a battery digital twin, and perspectives, Struct. Multidiscip. Optim. 66 (2023) 1. https://doi.org/10.1007/s00158-022-03410-x. [verify article number]',  # V (DOI, authors, volume)
    'westharrison1997': 'M. West, J. Harrison, Bayesian Forecasting and Dynamic Models, second ed., Springer, New York, 1997. https://doi.org/10.1007/b98971.',  # V
    'ibrahim2000': 'J.G. Ibrahim, M.-H. Chen, Power prior distributions for regression models, Stat. Sci. 15 (2000) 46–60. [verify]',
    'fu2025': 'B. Fu, M. Bi, S. Umeda, et al., Digital twin-based smart manufacturing: dynamic line reconfiguration for disturbance handling, IEEE Trans. Autom. Sci. Eng. (2025). https://doi.org/10.1109/tase.2025.3563320.',
    'monek2023': 'G.D. Monek, S. Fischer, DES and IIoT fusion approach towards real-time synchronization of physical and digital components in manufacturing processes, Rep. Mech. Eng. 4 (2023). https://doi.org/10.31181/rme040115092023m.',
    'wright1936': 'T.P. Wright, Factors affecting the cost of airplanes, J. Aeronaut. Sci. 3 (1936) 122–128.',
    'welford1962': 'B.P. Welford, Note on a method for calculating corrected sums of squares and products, Technometrics 4 (1962) 419–420.',
    'gneiting2007': 'T. Gneiting, A.E. Raftery, Strictly proper scoring rules, prediction, and estimation, J. Am. Stat. Assoc. 102 (2007) 359–378. https://doi.org/10.1198/016214506000001437.',  # V
}


def build():
    src = open(os.path.join(PAPER, 'manuscript_src.md'), encoding='utf-8').read()
    order = []

    def num(key):
        if key not in REFS:
            raise KeyError('unknown reference key ' + key)
        if key not in order:
            order.append(key)
        return order.index(key) + 1

    def rep(m):
        keys = [k.strip().lstrip('@') for k in m.group(1).split(';')]
        ns = sorted(num(k) for k in keys)
        parts, i = [], 0
        while i < len(ns):
            j = i
            while j + 1 < len(ns) and ns[j + 1] == ns[j] + 1:
                j += 1
            parts.append(f'{ns[i]}–{ns[j]}' if j - i >= 2 else (', '.join(str(x) for x in ns[i:j + 1])))
            i = j + 1
        return '[' + ', '.join(parts) + ']'

    out = re.sub(r'\[(@[^\]]+)\]', rep, src)
    unused = [k for k in REFS if k not in order]
    refs = '\n\n'.join(f'[{i + 1}] {REFS[k]}' for i, k in enumerate(order))
    out = out.rstrip() + '\n\n' + refs + '\n'
    open(os.path.join(PAPER, 'manuscript.md'), 'w', encoding='utf-8').write(out)
    return out, order, unused


def words(text):
    return len(re.findall(r"[A-Za-z0-9][A-Za-z0-9'’.\-–/%]*", text))


def counts(md):
    abstract = md.split('## Abstract', 1)[1].split('**Keywords', 1)[0]
    body = md.split('## 1. Introduction', 1)[1].split('## Declarations', 1)[0]
    keep = []
    in_eq = False
    for line in body.split('\n'):
        st = line.strip()
        if st.startswith('$$'):
            in_eq = not in_eq if not (st.endswith('$$') and len(st) > 2) else in_eq
            continue
        if in_eq or st.startswith('|') or st.startswith('![') or st.startswith('**Figure') or st.startswith('**Table'):
            continue
        keep.append(line)
    b = '\n'.join(keep)
    b = re.sub(r'\$[^$]*\$', ' x ', b)
    return words(abstract), words(b)


if __name__ == '__main__':
    md, order, unused = build()
    a, b = counts(md)
    print(f'references cited: {len(order)}; unused entries: {unused}')
    print(f'abstract words: {a}; main text words (Sections 1-7, without tables/equations/captions): {b}')
