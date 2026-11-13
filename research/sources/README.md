# Research sources (downloaded 2026-11-13)

Local copies for offline work. **Not committed to git** (see `.gitignore`): third-party copyright and size.
Copy this whole folder to the offline PC with a USB stick.

## software/
| File | What | Note |
|---|---|---|
| `Zotero_setup_win_x64.exe` | Zotero 10.0.8 for Windows x64 (reference manager, free, works offline; includes the Word / LibreOffice plug-in for citations) | Official download from zotero.org; Authenticode signature checked: **Valid**, signer *Corporation for Digital Scholarship* |

Install: run the .exe → Next → Finish. In Zotero: *File → Import…* to load RIS/CSV exports from Scopus / WoS;
drag PDFs from `papers/` onto Zotero to attach them (Zotero reads the title / DOI automatically).

## papers/ (open access only)
| File | Reference | Relevance for paper 1 / thesis |
|---|---|---|
| `Page2021_PRISMA2020_statement_PLOSMed.pdf` | Page M.J., McKenzie J.E., et al. (2021). The PRISMA 2020 statement: an updated guideline for reporting systematic reviews. PLOS Medicine 18(3): e1003583 | **Method** – the 27-item checklist and flow diagram you must follow |
| `Page2021_PRISMA2020_statement_SystRev.pdf` | Same statement, Systematic Reviews 10: 89 (2021) | Same (second copy) |
| `Fuller2020_DT_enabling_technologies_challenges.pdf` | Fuller A., Fan Z., Day C., Barlow C. (2020). Digital Twin: Enabling technologies, challenges and open research. IEEE Access 8 (arXiv:1911.01276) | Background: definitions, open challenges |
| `vanBeek2022_arXiv_DT_for_design_of_systems.pdf` | van Beek A., Karkaria V., Chen W. (2022). Digital twins for the designs of systems: a perspective. arXiv:2211.05040 | **Close to RQ2/RQ3** – twin links design decisions and operational data over the life cycle |
| `Siddiqui2025_IEOM_bottleneck_uncertainty_review.pdf` | Siddiqui M., Abdoli S., Malaibari M., Djukic L. (2025). A review of bottleneck management strategies in manufacturing under uncertainty. IEOM World Congress, Windsor | Uncertainty types + modelling methods (probability, Bayesian networks, fuzzy) |
| `Tonejca2024_ProcediaCIRP_CNC_edge_computing.pdf` | Tonejca L., Mayer C., Trautner T., Mauthner G., Bleicher F. (2024). CNC machine tool focused edge computing in manufacturing. Procedia CIRP 126: 111–116 | **RQ1** – lightweight data path from CNC machines |
| `Wintercorn2023_IECON_brownfield_virtual_commissioning.pdf` | Wintercorn O., Atta K., Jeppsson P., Paniagua C., van Deventer J. (2023). Transforming brownfield factories: co-engineering and virtual commissioning. IECON 2023, IEEE | RQ1 – twin + open-source IIoT with legacy systems |
| `Cassius2026_IJSSMR_DT_adoption_emerging_economies.pdf` | Cassius O.A., Abiji E., Diwa D.O., Egede D.A. (2026). Digital twin technology adoption and sustainable manufacturing performance in emerging economies: a literature review. IJSSMR 12(10): 474–493 | Context (emerging economies). **Weak venue** (management journal, not indexed in Scopus as far as known) – cite carefully, only as supporting evidence |
| `AlZami2024_arXiv_DT_in_industries_survey.pdf` | Al Zami M.B., Shaon S., Quy V.K., Nguyen D.C. (2024). Digital twin in industries: a comprehensive survey. arXiv:2412.00209 | Background survey (pre-print, not peer-reviewed) |
| `Zemskov2024_arXiv_DT_security_privacy_manufacturing.pdf` | Zemskov A.D., et al. (2024). Security and privacy of digital twins for advanced manufacturing: a survey. arXiv:2412.13939 | Contains section on probabilistic / Bayesian-calibrated twins; security for RQ1 |
| `Lu2024_arXiv_DT_ideas_to_twins.pdf` | Lu J. (2024). Digital twins: how far from ideas to twins? arXiv:2403.14699 | Low weight (single-author pre-print) – background only |

## Get manually (site blocks automatic download – open the link in a browser, or via your university library)
| Reference | Link | Why |
|---|---|---|
| Kritzinger W. et al. (2018). Digital Twin in manufacturing: a categorical literature review and classification. IFAC-PapersOnLine 51(11): 1016–1022 | https://doi.org/10.1016/j.ifacol.2018.08.474 | **Must-have** – Digital Model / Shadow / Twin |
| Florescu A. (2024). Digital twin for flexible manufacturing systems and optimization through simulation: a case study. Machines 12(11): 785 (open access) | https://doi.org/10.3390/machines12110785 | **Must-have** – FMS twin from design to operation |
| Ullah A., Younas M. (2024). Development and application of digital twin control in flexible manufacturing systems. J. Manuf. Mater. Process. 8(5): 214 (open access) | https://doi.org/10.3390/jmmp8050214 | **Must-have** – FMS twin, OEE |
| Schumacher et al. (2024). Live fitting of process data within digital twins of manufacturing to use simulation and optimisation. Journal of Simulation 18(5): 813–834 | https://ideas.repec.org/a/taf/tjsmxx/v18y2024i5p813-834.html | **Closest to RQ2** – read and differentiate |
| Managing input parameter uncertainty in digital twins (Politecnico di Milano) | https://re.public.polimi.it/retrieve/55682513-bfa3-4905-85b5-397c63391ad5/Managing%20Input%20Parameter%20Uncertainty%20in%20Digital%20Twins.pdf | **Closest to RQ2** |
| Bordone (2026). Master thesis on ramp-up modelled with DES, Politecnico di Milano | https://www.politesi.polimi.it/retrieve/303d7d87-ae04-428a-bdd8-0bcc3d95ea65/2026_03_Bordone.pdf | Ramp-up modelling idea |
| PRISMA 2020 explanation and elaboration. BMJ 372: n160 (2021) | https://doi.org/10.1136/bmj.n160 | How to report each checklist item |
| SLR: digital and green transformation of manufacturing SMEs in Europe. Production & Manufacturing Research (2025, open access) | https://doaj.org/article/b649adb537864fe58cfcb97da4459d18 | SME context |
| Integrating digital twins into small to medium-sized manufacturers (SLR + roadmap, Penn State) | https://pure.psu.edu/en/publications/integrating-digital-twins-into-small-to-medium-sized-manufacturer/ | SME context |
| Digital twins in manufacturing: a SLR with retrieval-augmented generation (Southampton) | https://eprints.soton.ac.uk/506637/ | Recent SLR – compare your method |
| Tao F., Zhang H., Liu A., Nee A.Y.C. (2019). Digital twin in industry: state-of-the-art. IEEE Trans. Ind. Informatics 15(4): 2405–2415 | https://doi.org/10.1109/TII.2018.2873186 | Background |
| Lu Y., Liu C., Wang K.I-K., Huang H., Xu X. (2020). Digital twin-driven smart manufacturing. Robotics and Computer-Integrated Manufacturing 61: 101837 | https://doi.org/10.1016/j.rcim.2019.101837 | Background |
| ISO 23247-1…4 (2021). Digital twin framework for manufacturing | iso.org (paid standard) | Reference architecture for RQ1 |

Only open-access copies were downloaded. Do not upload paywalled PDFs to public places.
