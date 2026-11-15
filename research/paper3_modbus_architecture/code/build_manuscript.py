"""Assembles ../manuscript.md from manuscript_src.md: numbers the [R:key] citations in order of first appearance
(MDPI style [1], [2,3], [4-6]) and writes the reference list; fills the @@...@@ fields from section6.md and results.json.

    python build_manuscript.py
References: only works listed in thesis/references.md, research/paper1_slr or research/sources ([verify] marks kept).
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'manuscript.md')

REFS = {
    'kritzinger': 'Kritzinger, W.; Karner, M.; Traar, G.; Henjes, J.; Sihn, W. Digital Twin in manufacturing: A categorical literature review and classification. *IFAC-PapersOnLine* **2018**, *51*, 1016–1022. https://doi.org/10.1016/j.ifacol.2018.08.474',
    'tao': 'Tao, F.; Zhang, H.; Liu, A.; Nee, A.Y.C. Digital twin in industry: State-of-the-art. *IEEE Trans. Ind. Inform.* **2019**, *15*, 2405–2415. https://doi.org/10.1109/TII.2018.2873186',
    'lu': 'Lu, Y.; Liu, C.; Wang, K.I.-K.; Huang, H.; Xu, X. Digital twin-driven smart manufacturing: Connotation, reference model, applications and research issues. *Robot. Comput.-Integr. Manuf.* **2020**, *61*, 101837. https://doi.org/10.1016/j.rcim.2019.101837',
    'fuller': 'Fuller, A.; Fan, Z.; Day, C.; Barlow, C. Digital twin: Enabling technologies, challenges and open research. *IEEE Access* **2020**, *8*, [pages – verify]. [verify]',
    'negri': 'Negri, E.; Fumagalli, L.; Macchi, M. A review of the roles of digital twin in CPS-based production systems. *Procedia Manuf.* **2017**, *11*, 939–948.',
    'iso23247': 'ISO 23247-1:2021; Automation Systems and Integration – Digital Twin Framework for Manufacturing – Part 1: Overview and General Principles. International Organization for Standardization: Geneva, Switzerland, 2021.',
    'iec62541': 'IEC 62541 (all parts); OPC Unified Architecture. International Electrotechnical Commission: Geneva, Switzerland. [verify edition]',
    'mqtt': 'ISO/IEC 20922:2016; Information Technology – Message Queuing Telemetry Transport (MQTT) v3.1.1. International Organization for Standardization: Geneva, Switzerland, 2016.',
    'paper1': '[Author 1]; [Author 2]. Digital twins for the design, ramp-up and stepwise introduction of flexible manufacturing systems under technology and data constraints: A systematic review. Manuscript in preparation / under review [companion article – update status before submission].',
    'cassius': 'Cassius, O.A.; Abiji, E.; Diwa, D.O.; Egede, D.A. Digital twin technology adoption and sustainable manufacturing performance in emerging economies: A literature review. *Int. J. Soc. Sci. Manag. Res.* **2026**, *12*, 474–493.',
    'vanginkel': 'van Ginkel, M.; Ghafoorpoor Yazdi, P.; Rupert, T.; Reijers, J.; Thiede, S. Digital twins to support smart manufacturing system design and ramp up. *Procedia CIRP* **2025**, [volume, pages – verify]. https://doi.org/10.1016/j.procir.2025.02.221',
    'ullah': 'Ullah, A.; Younas, M. Development and application of digital twin control in flexible manufacturing systems. *J. Manuf. Mater. Process.* **2024**, *8*, 214. https://doi.org/10.3390/jmmp8050214',
    'tonejca': 'Tonejca, L.; Mayer, C.; Trautner, T.; Mauthner, G.; Bleicher, F. CNC machine tool focused edge computing in manufacturing. *Procedia CIRP* **2024**, *126*, 111–116.',
    'ward': 'Ward, R.; Soulatiantork, P.; Finneran, S.; et al. Real-time vision-based multiple object tracking of a production process: Industrial digital twin case study. *Proc. Inst. Mech. Eng. Part B J. Eng. Manuf.* **2021**. https://doi.org/10.1177/09544054211002464 [verify volume, pages, full author list]',
    'monek': 'Monek, G.D.; Fischer, S. DES and IIoT fusion approach towards real-time synchronization of physical and digital components in manufacturing processes. *Rep. Mech. Eng.* **2023**, *4*. https://doi.org/10.31181/rme040115092023m [verify pages]',
    'wintercorn': 'Wintercorn, O.; Atta, K.; Jeppsson, P.; Paniagua, C.; van Deventer, J. Transforming brownfield factories: Unleashing the potential with co-engineering and virtual commissioning. In Proceedings of the IECON 2023 – 49th Annual Conference of the IEEE Industrial Electronics Society, 2023. https://doi.org/10.1109/IECON51785.2023.10311670',
    'modbus_app': 'Modbus Organization. *MODBUS Application Protocol Specification V1.1b3*; Modbus Organization: Hopkinton, MA, USA, 26 April 2012. Available online: https://modbus.org/modbus-specifications [title and date checked by web search 2026-11-15; verify publisher city]',
    'modbus_tcp': 'Modbus Organization (Modbus-IDA). *MODBUS Messaging on TCP/IP Implementation Guide V1.0b*; 24 October 2006. Available online: https://modbus.org/modbus-specifications [title and date checked by web search 2026-11-15]',
    'modbus_sec': 'Modbus Organization. *MODBUS/TCP Security Protocol Specification*; document MB-TCP-Security-v36, 30 July 2021. Available online: https://www.modbus.org/docs/MB-TCP-Security-v36_2021-07-30.pdf [added for this paper; title and date checked by web search 2026-11-15]',
    'iec62443_32': 'IEC 62443-3-2:2020; Security for Industrial Automation and Control Systems – Part 3-2: Security Risk Assessment for System Design. International Electrotechnical Commission: Geneva, Switzerland, 2020. [added for this paper; checked by web search 2026-11-15]',
    'bokrantz': 'Bokrantz, J.; Skoogh, A.; Lämkull, D.; et al. Data quality problems in discrete event simulation of manufacturing operations. *Simulation* **2017**. https://doi.org/10.1177/0037549717742954 [verify volume, pages, full author list]',
    'hevner': 'Hevner, A.R.; March, S.T.; Park, J.; Ram, S. Design science in information systems research. *MIS Q.* **2004**, *28*, 75–105.',
    'peffers': 'Peffers, K.; Tuunanen, T.; Rothenberger, M.A.; Chatterjee, S. A design science research methodology for information systems research. *J. Manag. Inf. Syst.* **2007**, *24*, 45–77.',
    'iec62264': 'IEC 62264-1:2013; Enterprise-Control System Integration – Part 1: Models and Terminology. International Electrotechnical Commission: Geneva, Switzerland, 2013.',
    'konstantinov2022': 'Konstantinov, S.; Assad, F.; Ahmad, B.; et al. Virtual engineering and commissioning to support the lifecycle of a manufacturing assembly system. *Machines* **2022**, *10*, 939. https://doi.org/10.3390/machines10100939',
    'konstantinov2023': 'Konstantinov, S.; de Oliveira Hansen, J.P.; Assad, F.; et al. An analysis of the available virtual engineering tools for building manufacturing systems digital twin. *Procedia CIRP* **2023**. https://doi.org/10.1016/j.procir.2023.02.096 [verify volume, pages]',
    'das2024': 'Das, P. Enhancing EV manufacturing flexibility through digital twin-based virtual commissioning. *J. Electr. Syst.* **2024**. https://doi.org/10.52783/jes.9037 [verify volume, pages]',
    'hu2024': 'Hu, X.-H.; Liu, S.-T.; Zhang, J.-X.; et al. Development and system design of intelligent training platform for universities based on Internet of Things technology. *J. Comput.* **2024**. https://doi.org/10.53106/199115992024123506012 [verify volume, pages]',
    'ramteke': 'Ramteke, A.; Tarjule, P.; Rai, P.K.; et al. Digital twin orchestration system for industrial manufacturing. *Int. J. Sci. Res. Eng. Manag.* **2026**. https://doi.org/10.55041/ijsrem68224 [weak venue – consider removing]',
    'seipolt': 'Seipolt, A.; Buschermöhle, R.; Hasselbring, W. Digital twins in manufacturing: A systematic literature review with retrieval-augmented generation. *IEEE Access* **2025**. https://doi.org/10.1109/ACCESS.2025.3611269 [verify volume, pages]',
    'zemskov': 'Zemskov, A.D.; et al. Security and privacy of digital twins for advanced manufacturing: A survey. *arXiv* **2024**, arXiv:2412.13939. [verify full author list]',
    'florescu': 'Florescu, A. Digital twin for flexible manufacturing systems and optimization through simulation: A case study. *Machines* **2024**, *12*, 785. https://doi.org/10.3390/machines12110785',
    'iec62443': 'IEC 62443 (all parts); Industrial Communication Networks – Network and System Security / Security for Industrial Automation and Control Systems. International Electrotechnical Commission: Geneva, Switzerland. [verify part numbers cited]',
}


def number(md):
    order = []
    for m in re.finditer(r'\[R:([^\]]+)\]', md):
        for k in [x.strip().replace('R:', '') for x in m.group(1).split(';')]:
            if k not in order:
                order.append(k)
    idx = {k: i + 1 for i, k in enumerate(order)}

    def rep(m):
        ns = sorted(idx[x.strip().replace('R:', '')] for x in m.group(1).split(';'))
        parts, i = [], 0
        while i < len(ns):
            j = i
            while j + 1 < len(ns) and ns[j + 1] == ns[j] + 1:
                j += 1
            parts.append(f'{ns[i]}–{ns[j]}' if j - i >= 2 else ','.join(str(x) for x in ns[i:j + 1]))
            i = j + 1
        return '[' + ','.join(parts) + ']'
    md = re.sub(r'\[R:([^\]]+)\]', rep, md)
    missing = [k for k in order if k not in REFS]
    if missing:
        raise SystemExit(f'missing references: {missing}')
    reflist = '\n'.join(f'{idx[k]}. {REFS[k]}' for k in order)
    unused = [k for k in REFS if k not in idx]
    return md, reflist, unused


def main():
    md = open(os.path.join(HERE, 'manuscript_src.md'), encoding='utf-8').read()
    fill = json.load(open(os.path.join(HERE, '..', 'data', 'manuscript_fields.json'), encoding='utf-8'))
    s6 = os.path.join(HERE, 'section6.md')
    fill['SECTION6'] = open(s6, encoding='utf-8').read().strip() if os.path.exists(s6) else '## 6. Experimental Evaluation\n\n[pending]'
    for k, v in fill.items():
        md = md.replace(f'@@{k}@@', str(v))
    md, reflist, unused = number(md)
    md = md.replace('@@REFERENCES@@', reflist)
    left = re.findall(r'@@[A-Z0-9_]+@@', md)
    open(OUT, 'w', encoding='utf-8').write(md)
    body = re.split(r'\n## Author Contributions', md)[0]
    words = len(re.sub(r'!\[[^\]]*\]\([^)]*\)', '', body).split())
    print(f'written {OUT}; ~{words} words before back matter; unused refs: {unused}; unfilled: {left}')


if __name__ == '__main__':
    main()
