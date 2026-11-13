/* Ball screw + guide factory – item 7 ERP – SHARED ERP MASTER + SAMPLE DATA (item 7 owns it; item 8 PLC may import it).
 * Guide: docs/46_bsf_erp.md.  The Python service twin/bsf_erp.py + twin/bsf_erp_core.py READS the JSON block MD below (between the
 * MD-JSON markers) – ONE source of truth for both cores. Keep the block strict JSON (double quotes, no comments, no trailing commas).
 *
 *   import { NOTE7, MD, MAT7, MAT_BY_ID, BOM7, CUST7, SUPP7, API7, MODULES7, ROLES7, CHECK7, SAMPLE7 } from "./bsferp_data.js";
 *
 * Product codes = web/bsfprod_data.js (item 1), routings + machine types = web/bsfmfg_data.js (item 2), MES products / lot sizes = web/bsfmes_data.js (item 6).
 * Units: € (EUR), days (lead times = working days), weeks (MRP buckets), min (routing times), m (bar stock), pc, g, l.
 * EVERY VALUE IS AN EXAMPLE – check with your ERP team, your controller and your suppliers.
 */
export const NOTE7 = "Example ERP data – check with your ERP team, your controller and your suppliers.";

export const MD = /*MD-JSON-BEGIN*/{
  "version": "bsf_erp 1.0",
  "plant": {
    "currency": "EUR", "days": 250, "shiftH": 7.5, "oee": 0.75, "labour": 42, "moh": 0.06, "poh": 0.60, "sga": 0.15, "vat": 0.19,
    "interest": 0.06, "life": 10, "energy": 0.18, "loadFactor": 0.6, "access": 1.8,
    "room": {"soft": 90, "ht": 110, "grind": 250, "qc": 300, "assy": 100},
    "maint": {"soft": 0.04, "ht": 0.05, "grind": 0.05, "qc": 0.03, "assy": 0.03},
    "holdRate": 0.20, "orderCost": 80, "weekDays": 5, "horizon": 8, "shipDays": 1,
    "atp": {"upstreamDays": 3, "afterDays": 2, "tgrOp": "100", "bottleneck": "BS-TGR"}
  },
  "customers": [
    ["C-1000", "Daily plant demand (twin orders)", "–", 0, 0, "–", "internal (twin)", "–"],
    ["C-1001", "Machine-tool builder A (example)", "DE", 60, 800, "FCA works", "HTTP order API (EDI-like JSON)", "OEM-1"],
    ["C-1002", "Automation integrator B (example)", "IT", 45, 250, "DAP", "e-mail PDF → order entry", "OEM-2"],
    ["C-1003", "Robot + gantry maker C (example)", "CZ", 60, 400, "FCA works", "HTTP order API", "OEM-1"],
    ["C-1004", "Packaging-machine maker D (example)", "DE", 30, 150, "DAP", "web shop (HTTP)", "OEM-2"],
    ["C-1005", "Distributor E – spare parts (example)", "PL", 30, 300, "EXW", "HTTP order API", "DIST"],
    ["C-1006", "Semiconductor equipment F (example)", "NL", 60, 600, "DDP", "HTTP order API", "OEM-1"]
  ],
  "priceGroups": {"OEM-1": 0.92, "OEM-2": 1.0, "DIST": 0.80, "–": 1.0},
  "suppliers": [
    ["S-2001", "Steel bar mill A – 50CrMo4 +QT, 20MnCr5 bars (example)", "round bars, heat lots, EN 10204 3.1", 30, 60, "A", "supplier portal (HTTP JSON) + e-mail PDF", "IATF 16949"],
    ["S-2002", "Steel bar mill B – 100Cr6 bars (example)", "bearing steel bars, 3.1", 25, 60, "B", "e-mail PDF", "ISO 9001"],
    ["S-2003", "Profile mill C – drawn rail + carriage profiles (example)", "C55 rail profile, 20CrMo4 block profile", 35, 45, "A", "supplier portal (HTTP JSON)", "IATF 16949"],
    ["S-2004", "Ball maker D – ISO 3290 G5 / G10 (example)", "balls Ø4.763 / Ø6.35, size classes", 5, 30, "A", "kanban signal over HTTP", "ISO 9001"],
    ["S-2005", "Seal maker E (example)", "wiper seals, end seals, bottom seals", 10, 30, "B", "kanban signal over HTTP", "ISO 9001"],
    ["S-2006", "Moulder F – POM caps, MIM deflectors (example)", "end caps, return pipes, deflectors, hole caps", 15, 30, "B", "e-mail PDF", "ISO 9001"],
    ["S-2007", "Grinding wheel maker G – CBN + corundum + dressers (example)", "CBN thread wheels, corundum wheels, diamond rolls", 40, 30, "A", "e-mail PDF", "ISO 9001"],
    ["S-2008", "Packaging H – VCI tubes, boxes (example)", "VCI tubes, cartons, wood profiles, dummy rails", 10, 30, "C", "web shop (HTTP)", "–"],
    ["S-2009", "Standard parts I – rings, nipples, keys, screws, oils (example)", "DIN / ISO standard parts, lubricants", 5, 30, "B", "web shop (HTTP)", "ISO 9001"]
  ],
  "materials": [
    ["FABS-3210-1000-C5", "Ball screw set Ø32×10, 1 000 mm, C5 (screw + nut P1, run in, packed)", "fg", "pc", "make", 2, "L4L", 0, 60, 0, "", "FABS"],
    ["FALG-25-1000", "Guide set size 25: rail 1 000 mm + 2 carriages Z1, class H", "fg", "pc", "make", 2, "L4L", 0, 100, 0, "", "FALG"],
    ["BS-3210-1000-C5", "Ground ball screw shaft Ø32 lead 10, 1 000 mm, C5", "fg", "pc", "make", 10, "FOQ", 120, 40, 0, "", "BS"],
    ["BN-3210-FL", "Flanged ball nut Ø32 lead 10, preload P1", "fg", "pc", "make", 8, "FOQ", 120, 40, 0, "", "BN"],
    ["LG-25-1000", "Profiled rail size 25, 1 000 mm, class H", "fg", "pc", "make", 8, "FOQ", 200, 60, 0, "", "LG"],
    ["LB-25-FL", "Carriage size 25, flange, Z1, class H", "fg", "pc", "make", 8, "POQ", 0, 120, 0, "", "LB"],
    ["SF-BS3210-HARD", "Screw shaft hardened, tempered, straightened, re-centred (after op 80)", "semi", "pc", "phantom", 0, "L4L", 0, 0, 0, "", "BS:80"],
    ["SF-BS3210-SOFT", "Screw shaft soft: sawn, straightened, centred, turned (after op 40)", "semi", "pc", "phantom", 0, "L4L", 0, 0, 0, "", "BS:40"],
    ["SF-BN3210-HARD", "Nut body carburised + hardened (after op 40)", "semi", "pc", "phantom", 0, "L4L", 0, 0, 0, "", "BN:40"],
    ["SF-BN3210-SOFT", "Nut body soft: turned + milled (after op 30)", "semi", "pc", "phantom", 0, "L4L", 0, 0, 0, "", "BN:30"],
    ["SF-LG25-HARD", "Rail sawn, drilled, induction hardened, straightened (after op 60)", "semi", "pc", "phantom", 0, "L4L", 0, 0, 0, "", "LG:60"],
    ["SF-LB25-HARD", "Carriage body sawn, milled, carburised + hardened (after op 40)", "semi", "pc", "phantom", 0, "L4L", 0, 0, 0, "", "LB:40"],
    ["RAW-50CRMO4-D36", "Round bar 50CrMo4 +QT Ø36 peeled (heat lot, EN 10204 3.1)", "raw", "m", "buy", 30, "FOQ", 400, 150, 14.40, "S-2001", ""],
    ["RAW-20MNCR5-D85", "Round bar 20MnCr5 Ø85 (heat lot, EN 10204 3.1)", "raw", "m", "buy", 30, "FOQ", 120, 20, 75.60, "S-2001", ""],
    ["RAW-C55-PROF25", "Cold-drawn rail profile C55, size 25 (EN 10204 3.1)", "raw", "m", "buy", 35, "FOQ", 800, 250, 9.80, "S-2003", ""],
    ["RAW-20CRMO4-BLK25", "Cold-drawn carriage profile 20CrMo4, size 25 (EN 10204 3.1)", "raw", "m", "buy", 35, "FOQ", 160, 30, 32.00, "S-2003", ""],
    ["RAW-100CR6-D40", "Round bar 100Cr6 Ø40 (spacers of double nuts, EN 10204 3.1)", "raw", "m", "buy", 25, "FOQ", 60, 10, 12.50, "S-2002", ""],
    ["BALL-6.35-G5", "Ball Ø6.35 (1/4\") 100Cr6, ISO 3290 G5, size class", "buy", "pc", "buy", 5, "EOQ", 0, 8000, 0.045, "S-2004", ""],
    ["DEFL-3210", "Deflector MIM (internal return) Ø32×10", "buy", "pc", "buy", 10, "POQ", 0, 200, 1.20, "S-2006", ""],
    ["SEAL-3210", "Wiper seal Ø32×10 (NBR / TPU + holder)", "buy", "pc", "buy", 10, "EOQ", 0, 100, 0.90, "S-2005", ""],
    ["RING-472", "Snap ring DIN 472 for the seal", "buy", "pc", "buy", 5, "FOQ", 1000, 100, 0.06, "S-2009", ""],
    ["NIPPLE-M6", "Grease nipple M6 DIN 71412", "buy", "pc", "buy", 5, "FOQ", 1000, 50, 0.15, "S-2009", ""],
    ["GREASE-NLGI2", "Grease Li-complex NLGI 2 (gram)", "buy", "g", "buy", 10, "FOQ", 20000, 2000, 0.03, "S-2009", ""],
    ["LOCKNUT-M25", "Precision lock nut M25 × 1.5", "buy", "pc", "buy", 15, "EOQ", 0, 40, 4.50, "S-2009", ""],
    ["KEY-6x6x20", "Key DIN 6885 A 6 × 6 × 20", "buy", "pc", "buy", 5, "FOQ", 1000, 50, 0.20, "S-2009", ""],
    ["PACK-TUBE-1000", "VCI packing tube 1 000 mm + end caps", "pack", "pc", "buy", 10, "FOQ", 500, 80, 2.80, "S-2008", ""],
    ["CAPH-11", "Rail hole cap Ø11 POM", "buy", "pc", "buy", 10, "FOQ", 2000, 600, 0.05, "S-2006", ""],
    ["PACK-RAIL-1000", "Rail packing: VCI film + wood profile 1 000 mm", "pack", "pc", "buy", 10, "FOQ", 500, 100, 1.90, "S-2008", ""],
    ["BALL-4.763-G10", "Ball Ø4.763 (3/16\") 100Cr6, ISO 3290 G10", "buy", "pc", "buy", 5, "EOQ", 0, 20000, 0.020, "S-2004", ""],
    ["CAP-LB25", "End cap with return path POM, size 25", "buy", "pc", "buy", 15, "POQ", 0, 250, 0.45, "S-2006", ""],
    ["PIPE-LB25", "Return pipe POM, size 25", "buy", "pc", "buy", 15, "FOQ", 2000, 400, 0.08, "S-2006", ""],
    ["SEAL-LB25", "End seal double lip + steel plate, size 25", "buy", "pc", "buy", 10, "EOQ", 0, 250, 0.70, "S-2005", ""],
    ["SEALB-LB25", "Bottom seal strip, size 25", "buy", "pc", "buy", 10, "FOQ", 2000, 250, 0.30, "S-2005", ""],
    ["RET-LB25", "Ball retainer wire, size 25", "buy", "pc", "buy", 10, "FOQ", 2000, 400, 0.12, "S-2009", ""],
    ["NIPPLE-M6x075", "Grease nipple M6 × 0.75 (carriage)", "buy", "pc", "buy", 5, "FOQ", 1000, 120, 0.15, "S-2009", ""],
    ["SCREW-M3", "Screw ISO 7380 M3 (end caps)", "buy", "pc", "buy", 5, "FOQ", 5000, 400, 0.03, "S-2009", ""],
    ["DUMMY-LB25", "Dummy rail PE, size 25 (shipping)", "pack", "pc", "buy", 10, "FOQ", 1000, 120, 0.40, "S-2008", ""],
    ["BOX-FABS", "Carton + foam for one ball screw set", "pack", "pc", "buy", 10, "FOQ", 500, 60, 3.50, "S-2008", ""],
    ["BOX-FALG", "Carton for one guide set", "pack", "pc", "buy", 10, "FOQ", 500, 100, 2.60, "S-2008", ""],
    ["WHEEL-CBN-TGR", "CBN thread-grinding wheel Ø400, single rib (MRO)", "mro", "pc", "buy", 40, "ROP", 0, 2, 2400, "S-2007", ""],
    ["WHEEL-AL2O3-CGR", "Corundum wheel Ø500 for cylindrical grinding (MRO)", "mro", "pc", "buy", 20, "ROP", 0, 4, 380, "S-2007", ""],
    ["DRESSER-DIA", "Diamond dressing roll, thread profile (MRO)", "mro", "pc", "buy", 50, "ROP", 0, 1, 1900, "S-2007", ""],
    ["SAWBAND-M42", "Bi-metal saw band M42 34 × 1.1 (MRO)", "mro", "pc", "buy", 5, "ROP", 0, 6, 85, "S-2009", ""],
    ["OIL-GRIND", "Grinding oil (litre, MRO)", "mro", "l", "buy", 10, "ROP", 0, 400, 4.50, "S-2009", ""],
    ["POLY-QUENCH", "Polymer quenchant (litre, MRO)", "mro", "l", "buy", 15, "ROP", 0, 200, 3.20, "S-2009", ""]
  ],
  "bom": {
    "FABS-3210-1000-C5": [["BS-3210-1000-C5", 1, "10"], ["BN-3210-FL", 1, "20"], ["BOX-FABS", 1, "30"], ["GREASE-NLGI2", 2, "40"]],
    "FALG-25-1000": [["LG-25-1000", 1, "10"], ["LB-25-FL", 2, "20"], ["BOX-FALG", 1, "30"]],
    "BS-3210-1000-C5": [["SF-BS3210-HARD", 1, "20"], ["LOCKNUT-M25", 1, "30"], ["KEY-6x6x20", 1, "40"], ["PACK-TUBE-1000", 1, "50"]],
    "SF-BS3210-HARD": [["SF-BS3210-SOFT", 1, "10"]],
    "SF-BS3210-SOFT": [["RAW-50CRMO4-D36", 1.01, "10"]],
    "BN-3210-FL": [["SF-BN3210-HARD", 1, "10"], ["BALL-6.35-G5", 60, "20"], ["DEFL-3210", 4, "30"], ["SEAL-3210", 2, "40"], ["RING-472", 2, "50"], ["NIPPLE-M6", 1, "60"], ["GREASE-NLGI2", 4, "70"]],
    "SF-BN3210-HARD": [["SF-BN3210-SOFT", 1, "10"]],
    "SF-BN3210-SOFT": [["RAW-20MNCR5-D85", 0.105, "10"]],
    "LG-25-1000": [["SF-LG25-HARD", 1, "20"], ["CAPH-11", 17, "30"], ["PACK-RAIL-1000", 1, "40"]],
    "SF-LG25-HARD": [["RAW-C55-PROF25", 1.02, "10"]],
    "LB-25-FL": [["SF-LB25-HARD", 1, "10"], ["BALL-4.763-G10", 120, "20"], ["CAP-LB25", 2, "30"], ["PIPE-LB25", 4, "40"], ["SEAL-LB25", 2, "50"], ["SEALB-LB25", 2, "60"], ["RET-LB25", 4, "70"], ["NIPPLE-M6x075", 1, "80"], ["SCREW-M3", 4, "90"], ["DUMMY-LB25", 1, "100"]],
    "SF-LB25-HARD": [["RAW-20CRMO4-BLK25", 0.085, "10"]]
  },
  "wc": {
    "MS-SAW": [65, 0.33], "BS-STR": [105, 0.5], "BS-CTR": [130, 0.33], "BS-TRN": [225, 0.5], "BS-ROL": [375, 0.5], "BS-IND": [350, 0.33], "HT-TMP": [105, 0.2],
    "BS-STH": [300, 0.5], "BS-CLP": [55, 0.33], "BS-CGR": [525, 0.5], "BS-WHL": [750, 0.5], "BS-TGR": [1100, 0.5], "QC-LED": [210, 1.0], "AS-WSH": [140, 0.2],
    "BN-TRN": [265, 0.5], "BN-MC": [175, 0.5], "HT-CAR": [1500, 0.2], "BN-HTN": [300, 0.5], "BN-ITG": [900, 0.5], "AS-NAS": [55, 1.0], "LG-SAW": [105, 0.33],
    "LG-STR": [120, 0.5], "LG-DRL": [225, 0.33], "LG-IND": [550, 0.33], "LG-STH": [400, 0.5], "LG-SGR": [375, 0.5], "LG-PGR": [1500, 0.5], "LG-CUT": [105, 0.33],
    "QC-RAL": [140, 1.0], "LB-MC": [475, 0.33], "LB-SGR": [225, 0.5], "LB-RGR": [900, 0.5], "QC-INC": [20, 1.0], "AS-BAS": [40, 1.0], "QC-MAT": [70, 1.0],
    "AS-BSA": [105, 1.0], "AS-RUN": [70, 0.5], "AS-GAS": [40, 1.0], "AS-MRK": [35, 0.33], "AS-PCK": [25, 1.0], "QC-LAB": [450, 1.0]
  },
  "stock0": [
    ["FABS-3210-1000-C5", "FG-01", "", 420], ["FALG-25-1000", "FG-01", "", 700], ["BS-3210-1000-C5", "SM-01", "", 300], ["BN-3210-FL", "SM-01", "", 420],
    ["LG-25-1000", "SM-01", "", 520], ["LB-25-FL", "SM-01", "", 1300],
    ["RAW-50CRMO4-D36", "RM-01", "H7741", 404], ["RAW-50CRMO4-D36", "RM-01", "H7802", 404], ["RAW-20MNCR5-D85", "RM-01", "H5512", 63], ["RAW-20MNCR5-D85", "RM-01", "H5590", 63],
    ["RAW-C55-PROF25", "RM-02", "P3307", 816], ["RAW-C55-PROF25", "RM-02", "P3351", 816], ["RAW-20CRMO4-BLK25", "RM-02", "B9120", 170], ["RAW-20CRMO4-BLK25", "RM-02", "B9188", 170],
    ["RAW-100CR6-D40", "RM-01", "H6610", 30],
    ["BALL-6.35-G5", "SM-02", "L2611-04", 40000], ["DEFL-3210", "SM-02", "", 2500], ["SEAL-3210", "SM-02", "", 1600], ["RING-472", "SM-02", "", 4000], ["NIPPLE-M6", "SM-02", "", 1500],
    ["GREASE-NLGI2", "SM-02", "", 30000], ["LOCKNUT-M25", "SM-02", "", 600], ["KEY-6x6x20", "SM-02", "", 1800], ["PACK-TUBE-1000", "PK-01", "", 900],
    ["CAPH-11", "SM-02", "", 12000], ["PACK-RAIL-1000", "PK-01", "", 1200], ["BALL-4.763-G10", "SM-02", "L2609-11", 260000], ["CAP-LB25", "SM-02", "", 3000],
    ["PIPE-LB25", "SM-02", "", 6000], ["SEAL-LB25", "SM-02", "", 2600], ["SEALB-LB25", "SM-02", "", 3500], ["RET-LB25", "SM-02", "", 6000], ["NIPPLE-M6x075", "SM-02", "", 1800],
    ["SCREW-M3", "SM-02", "", 9000], ["DUMMY-LB25", "PK-01", "", 1500], ["BOX-FABS", "PK-01", "", 700], ["BOX-FALG", "PK-01", "", 1100],
    ["WHEEL-CBN-TGR", "TS-01", "", 5], ["WHEEL-AL2O3-CGR", "TS-01", "", 9], ["DRESSER-DIA", "TS-01", "", 2], ["SAWBAND-M42", "TS-01", "", 10], ["OIL-GRIND", "TS-01", "", 900], ["POLY-QUENCH", "TS-01", "", 420]
  ],
  "locations": {"FG-01": "finished-goods store (shipping)", "SM-01": "supermarket – own parts", "SM-02": "supermarket – bought parts", "RM-01": "bar store (racks)", "RM-02": "profile store", "PK-01": "packing material", "TS-01": "tool store", "QI-01": "incoming inspection (blocked stock)"},
  "prices": {"FABS-3210-1000-C5": 640, "FALG-25-1000": 246, "BS-3210-1000-C5": 420, "BN-3210-FL": 190, "LG-25-1000": 110, "LB-25-FL": 68},
  "config": {
    "bs": {"d": [16, 20, 25, 32, 40], "lead": {"16": [5, 10], "20": [5, 10, 20], "25": [5, 10, 20], "32": [5, 10, 20], "40": [5, 10, 20]},
           "base": {"16": 80, "20": 100, "25": 135, "32": 180, "40": 230}, "perM": {"16": 100, "20": 135, "25": 185, "32": 240, "40": 325},
           "leadF": {"5": 0.95, "10": 1.0, "20": 1.15}, "grade": {"C3": 1.8, "C5": 1.0, "C7": 0.65}, "nut": {"16": 80, "20": 100, "25": 140, "32": 190, "40": 250},
           "preload": {"P0": 0.97, "P1": 1.0, "P2": 1.12}, "setAdd": 30, "lenMin": 300, "lenMax": 2000, "slender": 60, "c3Max": 1500},
    "lg": {"size": [15, 20, 25, 30, 35], "rail": {"15": 60, "20": 80, "25": 110, "30": 145, "35": 190}, "block": {"15": 44, "20": 54, "25": 68, "30": 92, "35": 118},
           "pitch": {"15": 60, "20": 60, "25": 60, "30": 80, "35": 80}, "cls": {"N": 0.85, "H": 1.0, "P": 1.35}, "preload": {"Z0": 0.95, "Z1": 1.0, "Z2": 1.08},
           "blockType": {"FL": 1.0, "NA": 0.95}, "lenMin": 300, "lenMax": 4000}
  },
  "forecast": {"FABS-3210-1000-C5": 600, "FALG-25-1000": 1000, "BS-3210-1000-C5": 10, "BN-3210-FL": 5, "LG-25-1000": 50, "LB-25-FL": 150},
  "sigmaDay": {"BALL-6.35-G5": 900, "BALL-4.763-G10": 6000, "SEAL-3210": 30, "SEAL-LB25": 110, "LOCKNUT-M25": 6, "RAW-50CRMO4-D36": 14, "WHEEL-CBN-TGR": 0.12, "OIL-GRIND": 9},
  "mroDay": {"WHEEL-CBN-TGR": 0.3, "WHEEL-AL2O3-CGR": 0.2, "DRESSER-DIA": 0.02, "SAWBAND-M42": 0.15, "OIL-GRIND": 25, "POLY-QUENCH": 6},
  "openPurchase": [
    ["S-2001", "RAW-50CRMO4-D36", 400, 14.10, 2], ["S-2004", "BALL-6.35-G5", 40000, 0.046, 1], ["S-2005", "SEAL-3210", 3000, 0.88, 1], ["S-2003", "RAW-C55-PROF25", 800, 9.80, 7]
  ],
  "openProduction": [["PO-260001", "BS-3210-1000-C5", 20, 0, "WO-00001", "released"], ["PO-260002", "LG-25-1000", 50, 0, "WO-00002", "released"], ["PO-260003", "LB-25-FL", 100, 1, "WO-00003", "created"]],
  "salesSeed": [
    ["C-1001", "FABS-3210-1000-C5", 40, 1], ["C-1003", "FALG-25-1000", 120, 1], ["C-1006", "FABS-3210-1000-C5", 25, 2], ["C-1005", "LB-25-FL", 300, 2],
    ["C-1002", "FALG-25-1000", 60, 3], ["C-1004", "BS-3210-1000-C5", 30, 3]
  ],
  "fin": {
    "monthDays": [21, 20, 22, 21, 20, 21, 22, 15, 21, 22, 21, 17], "index": [0.95, 1.0, 1.05, 1.0, 0.98, 1.02, 1.0, 0.9, 1.05, 1.08, 1.0, 0.92],
    "months": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], "mix": {"FABS-3210-1000-C5": 120, "FALG-25-1000": 200},
    "sgaMonth": 600000, "openingCash": 2000000, "dso": 2, "dpo": 1, "capexMonth": [0, 0, 350000, 0, 0, 0, 0, 0, 1200000, 0, 0, 0], "taxRate": 0.0
  },
  "lotExample": {"item": "BN-3210-FL", "net": [600, 600, 450, 700, 600, 500, 650, 600], "S": 400, "Hweek": 0.48, "FOQ": 1200},
  "check": {
    "mrp": {"A": {"oh": 20, "ss": 0, "lt": 1, "lot": "L4L", "q": 0, "gross": [0, 30, 20, 40, 0, 50]},
            "B": {"oh": 50, "ss": 10, "lt": 2, "lot": "FOQ", "q": 100, "per": 2, "sr": [0, 100, 0, 0, 0, 0]},
            "relA": [10, 20, 40, 0, 50, 0], "grossB": [20, 40, 80, 0, 100, 0], "relB": [0, 0, 100, 0, 0, 0], "netB": [0, 0, 0, 0, 100, 0], "pohB": [30, 90, 10, 10, 10, 10]},
    "eoq": {"D": 60000, "S": 80, "H": 0.18, "Q": 7302.967433402215},
    "rop": {"z": 1.65, "sigma": 30, "LT": 9, "d": 240, "SS": 148.5, "ROP": 2308.5},
    "atp": {"q": 100, "free": 30, "minPerPc": 45, "freeMin": [1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200], "upstream": 3, "after": 2, "ship": 1, "doneDay": 5, "promiseDay": 8},
    "mhr": {"type": "BS-TGR", "price": 1100000, "dep": 110000, "int": 33000, "area": 27.72, "space": 6930, "energy": 12150, "maint": 55000, "hours": 3750},
    "mav": {"q0": 400, "p0": 14.40, "q1": 400, "p1": 14.10, "avg": 14.25}
  }
}/*MD-JSON-END*/;

/* ------------------------------------------------------------------ handy views of MD (browser side) */
const MCOLS = ["id", "n", "type", "uom", "proc", "lt", "lot", "lotQ", "ss", "price", "sup", "route"];
export const MAT7 = MD.materials.map((r) => Object.fromEntries(MCOLS.map((k, i) => [k, r[i]])));
export const MAT_BY_ID = Object.fromEntries(MAT7.map((m) => [m.id, m]));
export const BOM7 = MD.bom;
export const CUST7 = MD.customers.map((r) => ({ id: r[0], n: r[1], country: r[2], terms: r[3], creditK: r[4], inco: r[5], channel: r[6], group: r[7] }));
export const SUPP7 = MD.suppliers.map((r) => ({ id: r[0], n: r[1], supplies: r[2], lt: r[3], terms: r[4], rating: r[5], channel: r[6], cert: r[7] }));
export const TYPE_TXT = { fg: "finished / saleable", semi: "semi-finished (routing step, phantom)", raw: "raw material (heat lot)", buy: "purchased component", pack: "packaging", mro: "MRO / consumable (ROP)" };
export const LOT_TXT = { L4L: "lot-for-lot", FOQ: "fixed lot (multiples)", EOQ: "economic order quantity √(2DS/H)", POQ: "period order quantity", ROP: "reorder point (consumption based)" };

/* ------------------------------------------------------------------ ERP modules (what an ERP does) – page section 1 + guide §3 */
export const MODULES7 = [
  ["Master data", "customers, suppliers, materials, BOMs, routings, work centres, prices", "/customers · /suppliers · /materials · /boms/{id} · /routings/{id} · /workcenters"],
  ["Sales (order-to-cash)", "quotation → sales order → ATP / CTP date → confirmation → delivery → invoice → payment", "/quotations · /salesorders · /atp · /deliveries · /invoices"],
  ["Planning (MRP)", "gross → net requirements, lot sizing, lead-time offset, planned orders, exception messages", "/mrp/run · /mrp · /plannedorders"],
  ["Purchasing (procure-to-pay)", "requisition → purchase order (supplier portal over HTTP) → goods receipt → incoming inspection → invoice check", "/purchaseorders · /goodsreceipts · /inspections"],
  ["Inventory", "stock per material / location / batch (heat lot), goods issue + receipt, valuation, ABC / XYZ, reorder point", "/stock · /goodsmovements · /inventory/valuation · /analysis/abc"],
  ["Production orders ↔ MES", "release → MES work order over HTTP, confirmations back, settlement", "/productionorders · /productionorders/{id}/release|sync|settle · /confirmations"],
  ["Costing + finance (simple)", "machine hour rates, standard cost roll-up, actual cost, variances, P&L, cash, break-even", "/workcenters · /costing/{id} · /variances · /finance/pnl|cash|breakeven"],
  ["Reporting", "order intake, backlog, on-time delivery, inventory value + turns, margin, capacity load", "/kpi"],
];
export const ROLES7 = [
  ["sales", "quotations, sales orders, ATP / CTP, order confirmation, delivery note, invoice"],
  ["planner", "forecast, MRP run, planned orders → production orders, release to the MES"],
  ["buyer", "purchase requisitions → purchase orders, supplier portal, expediting, supplier rating"],
  ["stores / logistics", "goods receipt, goods issue, stock transfers, cycle counting"],
  ["quality (item 5)", "incoming inspection decision (accept / reject), blocked stock"],
  ["controller", "machine hour rates, standard costs, settlement, variances, P&L"],
  ["admin", "users, API keys, master data release, backup"],
];

/* ------------------------------------------------------------------ HTTP API of the ERP (server twin/bsf_erp.py = browser router in bsferp_core.js) */
export const API7 = [
  ["GET", "/api/bsf/erp/health", "service health, counts, persistence file, MES reachable?"],
  ["GET", "/api/bsf/erp/api", "this route list"],
  ["GET", "/api/bsf/erp/customers", "customers"], ["GET", "/api/bsf/erp/suppliers", "suppliers"],
  ["GET", "/api/bsf/erp/materials?type=", "material masters (raw, semi, fg, buy, pack, mro)"], ["GET", "/api/bsf/erp/materials/{id}", "one material with stock, BOM use, std cost"],
  ["GET", "/api/bsf/erp/boms/{id}", "multi-level BOM (exploded, low-level codes)"], ["GET", "/api/bsf/erp/routings/{id}", "routing of a make item with work centres + times"],
  ["GET", "/api/bsf/erp/workcenters", "work centres with machine hour rate build-up"],
  ["POST", "/api/bsf/erp/configure", "product configurator {kind: screw|guide, …} → codes + price + rules"],
  ["GET", "/api/bsf/erp/quotations", "quotations"], ["POST", "/api/bsf/erp/quotations", "create {customer, lines: [{code | config, qty}]} (Idempotency-Key)"],
  ["POST", "/api/bsf/erp/quotations/{id}/accept", "quotation → sales order"],
  ["GET", "/api/bsf/erp/salesorders?page=&size=", "sales orders (paged)"], ["POST", "/api/bsf/erp/salesorders", "create {customer, product | lines, qty, due} (Idempotency-Key)"],
  ["GET", "/api/bsf/erp/salesorders/{id}", "one sales order"], ["POST", "/api/bsf/erp/salesorders/{id}/confirm", "ATP / CTP → confirmed date + order confirmation"],
  ["POST", "/api/bsf/erp/salesorders/{id}/deliver", "delivery (goods issue from FG) → delivery note"], ["POST", "/api/bsf/erp/salesorders/{id}/invoice", "invoice from the delivery"],
  ["POST", "/api/bsf/erp/atp", "available / capable to promise {product, qty} → date + steps"],
  ["GET", "/api/bsf/erp/deliveries", "delivery notes"], ["GET", "/api/bsf/erp/invoices", "invoices"], ["POST", "/api/bsf/erp/invoices/{id}/pay", "incoming payment"],
  ["POST", "/api/bsf/erp/mrp/run", "MRP run {horizon} → table per item, planned orders, exceptions"], ["GET", "/api/bsf/erp/mrp?item=", "last MRP result (one item)"],
  ["GET", "/api/bsf/erp/plannedorders", "planned orders of the last run"], ["POST", "/api/bsf/erp/plannedorders/{id}/convert", "planned order → purchase requisition / production order"],
  ["GET", "/api/bsf/erp/purchaserequisitions", "purchase requisitions"],
  ["GET", "/api/bsf/erp/purchaseorders", "purchase orders"], ["POST", "/api/bsf/erp/purchaseorders", "create {supplier, lines} or {requisition} (Idempotency-Key)"],
  ["POST", "/api/bsf/erp/purchaseorders/{id}/send", "send to the supplier portal (HTTP JSON) – e-mail PDF as fallback"],
  ["POST", "/api/bsf/erp/goodsreceipts", "goods receipt {po, material, qty, batch} → blocked stock + inspection lot (AQL)"],
  ["GET", "/api/bsf/erp/inspections", "inspection lots"], ["POST", "/api/bsf/erp/inspections/{id}/decision", "{accept | reject} → unrestricted stock / return"],
  ["POST", "/api/bsf/erp/goodsmovements", "goods issue GI / receipt GR {type, material, qty, order} (MES finished goods use it)"],
  ["GET", "/api/bsf/erp/goodsmovements?n=", "last goods movements"],
  ["GET", "/api/bsf/erp/stock?material=", "stock per material (with locations + batches)"],
  ["GET", "/api/bsf/erp/inventory/valuation", "stock value (moving average + standard), turns"], ["GET", "/api/bsf/erp/analysis/abc", "ABC / XYZ analysis + reorder points"],
  ["GET", "/api/bsf/erp/productionorders", "production orders"], ["POST", "/api/bsf/erp/productionorders", "create {material, qty, due} (Idempotency-Key)"],
  ["GET", "/api/bsf/erp/productionorders/{id}", "one production order with confirmations + actual cost"],
  ["POST", "/api/bsf/erp/productionorders/{id}/release", "release → MES POST /api/bsf/mes/workorders (create + release)"],
  ["POST", "/api/bsf/erp/productionorders/{id}/sync", "pull confirmations + serials from the MES"], ["POST", "/api/bsf/erp/productionorders/{id}/settle", "order settlement: variances → P&L"],
  ["POST", "/api/bsf/erp/confirmations", "MES → ERP confirmation push {erpOrder, op, good, scrap, setupMin, runMin, serials} (Idempotency-Key)"],
  ["GET", "/api/bsf/erp/costing/{id}", "standard cost roll-up of a make item"], ["GET", "/api/bsf/erp/variances", "variances of settled orders"],
  ["GET", "/api/bsf/erp/finance/pnl", "simple P&L per month"], ["GET", "/api/bsf/erp/finance/cash", "cash view per month"], ["GET", "/api/bsf/erp/finance/breakeven", "break-even"],
  ["GET", "/api/bsf/erp/kpi", "dashboard KPIs + trends"],
  ["GET", "/api/bsf/erp/log?since=", "HTTP message log ERP ↔ MES (JSON in + out)"], ["GET", "/api/bsf/erp/events?since=", "audit journal"],
  ["POST", "/api/bsf/erp/twin", "twin orders + stores from the page (orders → sales orders)"],
  ["POST", "/api/bsf/erp/eval", "calculation cross-check {kind: eoq | rop | mrp | mhr | stdcost | atp | lot | config}"],
  ["POST", "/api/bsf/erp/control", "{action: reset | persist, on}"],
];

/* ------------------------------------------------------------------ hand-check values (&bf7test + guide 46) = MD.check */
export const CHECK7 = MD.check;
export const SAMPLE7 = { customer: "C-1001", product: "FABS-3210-1000-C5", qty: 40, dueDays: 15 };
