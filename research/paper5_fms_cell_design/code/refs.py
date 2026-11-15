"""Turn code/manuscript_src.md (citations as [@key] or [@key1; @key2]) into manuscript.md with numbered citations in
order of first appearance and a Springer-basic reference list (IJAMT style). Also prints the word count.

usage: python refs.py
"""
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'manuscript_src.md')
OUT = os.path.join(HERE, '..', 'manuscript.md')

# Springer basic style. [verify] = bibliographic details to be checked in the library database before submission.
REF = {
    'stecke1983': 'Stecke KE (1983) Formulation and solution of nonlinear integer production planning problems for flexible manufacturing systems. Manag Sci 29(3):273–288',
    'browne1984': 'Browne J, Dubois D, Rathmill K, Sethi SP, Stecke KE (1984) Classification of flexible manufacturing systems. FMS Mag 2(2):114–117 [verify]',
    'sethi1990': 'Sethi AK, Sethi SP (1990) Flexibility in manufacturing: a survey. Int J Flex Manuf Syst 2(4):289–328',
    'buzacott1993': 'Buzacott JA, Shanthikumar JG (1993) Stochastic models of manufacturing systems. Prentice Hall, Englewood Cliffs',
    'solberg1977': 'Solberg JJ (1977) A mathematical model of computerized manufacturing systems. In: Proceedings of the 4th International Conference on Production Research, Tokyo [verify]',
    'reiser1980': 'Reiser M, Lavenberg SS (1980) Mean-value analysis of closed multichain queuing networks. J ACM 27(2):313–322. https://doi.org/10.1145/322186.322195',
    'suri1984': 'Suri R, Hildebrant RR (1984) Modelling flexible manufacturing systems using mean-value analysis. J Manuf Syst 3(1):27–38 [verify]',
    'seidmann1987': 'Seidmann A, Schweitzer PJ, Shalev-Oren S (1987) Computerized closed queueing network models of flexible manufacturing systems: a comparative evaluation. Large Scale Syst 12(4):91–107 [verify]',
    'denning1978': 'Denning PJ, Buzen JP (1978) The operational analysis of queueing network models. ACM Comput Surv 10(3):225–261. https://doi.org/10.1145/356733.356735',
    'little1961': 'Little JDC (1961) A proof for the queuing formula L = λW. Oper Res 9(3):383–387',
    'spearman1990': 'Spearman ML, Woodruff DL, Hopp WJ (1990) CONWIP: a pull alternative to kanban. Int J Prod Res 28(5):879–894. https://doi.org/10.1080/00207549008942761',
    'blackstone1982': 'Blackstone JH, Phillips DT, Hogg GL (1982) A state-of-the-art survey of dispatching rules for manufacturing job shop operations. Int J Prod Res 20(1):27–45. https://doi.org/10.1080/00207548208947745',
    'fanti2004': 'Fanti MP, Zhou MC (2004) Deadlock control methods in automated manufacturing systems. IEEE Trans Syst Man Cybern A 34(1):5–22. https://doi.org/10.1109/TSMCA.2003.820590',
    'lee2014': 'Lee CG, Park SC (2014) Survey on the virtual commissioning of manufacturing systems. J Comput Des Eng 1(3):213–222. https://doi.org/10.7315/JCDE.2014.021',
    'negahban2014': 'Negahban A, Smith JS (2014) Simulation for manufacturing system design and operation: literature review and analysis. J Manuf Syst 33(2):241–261',
    'law2015': 'Law AM (2015) Simulation modeling and analysis, 5th edn. McGraw-Hill, New York',
    'koren1999': 'Koren Y, Heisel U, Jovane F, Moriwaki T, Pritschow G, Ulsoy G, Van Brussel H (1999) Reconfigurable manufacturing systems. CIRP Ann 48(2):527–540',
    'florescu2024': 'Florescu A (2024) Digital twin for flexible manufacturing systems and optimization through simulation: a case study. Machines 12(11):785. https://doi.org/10.3390/machines12110785',
    'ullah2024': 'Ullah A, Younas M (2024) Development and application of digital twin control in flexible manufacturing systems. J Manuf Mater Process 8(5):214. https://doi.org/10.3390/jmmp8050214',
    'kampa2026': 'Kampa A, Kalinowski K, Stawowiak M et al (2026) Digital twin methodology for flexible manufacturing system design: integration of VSM, discrete-event simulation and production scheduling for gear wheel production. Appl Sci 16(15):7521. https://doi.org/10.3390/app16157521 [verify volume/issue]',
    'konstantinov2022': 'Konstantinov S, Assad F, Ahmad B et al (2022) Virtual engineering and commissioning to support the lifecycle of a manufacturing assembly system. Machines 10(10):939. https://doi.org/10.3390/machines10100939',
    'wintercorn2023': 'Wintercorn O, Atta K, Jeppsson P, Paniagua C, van Deventer J (2023) Transforming brownfield factories: unleashing the potential with co-engineering and virtual commissioning. In: IECON 2023 – 49th Annual Conference of the IEEE Industrial Electronics Society. https://doi.org/10.1109/IECON51785.2023.10311670',
    'molnar2021': 'Molnár Z, Tamás P, Illés B (2021) Building a reusable data model to support systematic layout planning with discrete event simulation of flexible manufacturing systems. Hung J Ind Chem. https://doi.org/10.33927/hjic-2021-29 [verify volume/pages]',
    'vanginkel2025': 'van Ginkel M, Ghafoorpoor Yazdi P, Rupert T, Reijers J, Thiede S (2025) Digital twins to support smart manufacturing system design and ramp up. Procedia CIRP. https://doi.org/10.1016/j.procir.2025.02.221 [verify volume/pages]',
    'cassius2026': 'Cassius OA, Abiji E, Diwa DO, Egede DA (2026) Digital twin technology adoption and sustainable manufacturing performance in emerging economies: a literature review. Int J Soc Sci Manag Res 12(10):474–493',
    'iec62264': 'IEC 62264-1 (2013) Enterprise-control system integration – Part 1: Models and terminology. International Electrotechnical Commission, Geneva',
    'modbus2012': 'Modbus Organization (2012) MODBUS application protocol specification V1.1b3. Modbus Organization, Hopkinton [verify]',
    'kritzinger2018': 'Kritzinger W, Karner M, Traar G, Henjes J, Sihn W (2018) Digital twin in manufacturing: a categorical literature review and classification. IFAC-PapersOnLine 51(11):1016–1022. https://doi.org/10.1016/j.ifacol.2018.08.474',
    'purwaningsih2025': 'Purwaningsih R, Shintyastuti AR, Arvianto A et al (2025) Evaluating the impact of autonomous material handling on the performance of production system: a simulation approach. SINERGI. https://doi.org/10.22441/sinergi.2025.2.004 [verify volume/pages]',
}


def main():
    src = open(SRC, encoding='utf-8').read()
    order = []

    def num(m):
        keys = [k.strip().lstrip('@') for k in m.group(1).split(';')]
        ns = []
        for k in keys:
            if k not in REF:
                raise KeyError(k)
            if k not in order:
                order.append(k)
            ns.append(order.index(k) + 1)
        ns = sorted(ns)
        parts, i = [], 0
        while i < len(ns):                                   # compress runs: 3, 4, 5 -> 3–5
            j = i
            while j + 1 < len(ns) and ns[j + 1] == ns[j] + 1:
                j += 1
            parts.append(f'{ns[i]}–{ns[j]}' if j - i >= 2 else ', '.join(str(n) for n in ns[i:j + 1]))
            i = j + 1
        return '[' + ', '.join(parts) + ']'
    body = re.sub(r'\[(@[^\]]+)\]', num, src)
    refs = '\n'.join(f'{i + 1}. {REF[k]}' for i, k in enumerate(order))
    body = body.replace('<!-- REFERENCES -->', refs)
    open(OUT, 'w', encoding='utf-8').write(body)
    unused = [k for k in REF if k not in order]
    # word count of the main text (title to the end of the Conclusions, without tables, equations and captions)
    main_txt = body.split('## Statements and Declarations')[0] if '## Statements and Declarations' in body else body
    main_txt = body.split('## References')[0]
    words = 0
    in_eq = False
    for line in main_txt.splitlines():
        if line.strip().startswith('$$'):
            in_eq = not in_eq if line.strip().count('$$') == 1 else in_eq
            continue
        if in_eq or line.startswith('|') or line.startswith('!['):
            continue
        words += len(re.findall(r"[A-Za-z0-9][A-Za-z0-9'’\-–.,/%]*", line))
    print(f'{len(order)} references cited; unused keys: {unused}; words (text, no tables/equations): {words}')


if __name__ == '__main__':
    main()
