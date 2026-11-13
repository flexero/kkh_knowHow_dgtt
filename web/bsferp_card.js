/* Ball screw + guide factory – item 7 ERP: catalogue card CARD7 (makeCard of web/robotref.js) + build-vs-buy table.  Guide: docs/46_bsf_erp.md §24 – §26.
 * ERP products are REFERENCES ONLY – every one needs an HTTP REST API (this plant: Ethernet + Modbus TCP + HTTP only; no OPC UA / MQTT); check.
 * Makers marked (check) – confirm edition, licence model and local partner. Prices = rough estimates 2026 – ask for a quote. No external links (offline). */
const PR = "estimate – ask for a quote";
const CHK = "needs HTTP REST API; check";
export const CARD7 = {
  guides: "guide 46", shopTab: "Shopping list (ERP roll-out)", shopLbl: "roll-out", ph: "(e.g. S/4HANA, Odoo, proALPHA, Dell, Zebra)",
  buyNote: "Prices are rough estimates 2026 (" + PR + "). ERP products are listed as references only – " + CHK + ". Licence models change often (per user, per module, subscription). No external links – offline.",
  drawings: [
    { sec: "What an ERP does", f: "46_erp_modules.svg", t: "ERP modules map of the plant", c: "Master data in the centre; sales, MRP, purchasing, inventory, production orders, costing + finance, reporting around it; HTTP to the MES (item 6), supplier portals, customers; no machine below the MES.", g: "guide 46 §3" },
    { sec: "What an ERP does", f: "46_data_model.svg", t: "ERP data model – the main objects and keys", c: "Customer → quotation QT → sales order SO → delivery DN → invoice INV; material + BOM + routing; planned order PL → requisition PR → purchase order PU → goods receipt GR → inspection IL; production order PO → MES work order WO.", g: "guide 46 §4" },
    { sec: "Master data", f: "46_bom_tree.svg", t: "Multi-level BOM of the ball screw set FABS-3210-1000-C5", c: "Level 0 set → level 1 screw, nut, carton, grease → level 2 phantom semi-finished shaft / nut body + bought parts → level 3–4 steel bars (heat lots); low-level codes for MRP.", g: "guide 46 §5" },
    { sec: "Planning", f: "46_mrp_logic.svg", t: "MRP logic – level by level", c: "Gross requirements (forecast vs orders) → net = gross − on hand − scheduled receipts + safety stock → lot size → lead-time offset → planned order release → dependent gross of the next level; exception messages.", g: "guide 46 §8" },
    { sec: "Planning", f: "46_mrp_table.svg", t: "MRP table – hand example A + B", c: "Parent A (LT 1, lot-for-lot, on hand 20) and component B (2 per A, LT 2, fixed lot 100, on hand 50, safety stock 10, receipt 100 in week 1): planned release of B = 100 in week 2.", g: "guide 46 §8.4" },
    { sec: "Planning", f: "46_lot_sizing.svg", t: "Lot sizing compared – BN-3210-FL, 8 weeks", c: "Lot-for-lot 8 set-ups, fixed 1 200, EOQ = √(2DS/H) ≈ 990, POQ 2 weeks; set-up cost + holding cost per rule – POQ lowest in this example.", g: "guide 46 §9" },
    { sec: "Sales", f: "46_order_to_cash.svg", t: "Order to cash", c: "Enquiry → configurator → quotation → sales order → ATP / CTP date → order confirmation → production (MES) → delivery + goods issue → invoice → payment; HTTP order API of the customer.", g: "guide 46 §7" },
    { sec: "Sales", f: "46_atp_ctp.svg", t: "ATP and CTP with the thread-grinder bottleneck", c: "Cumulative ATP = stock + MPS − commitments (with look-ahead); above ATP: CTP fills the free minutes of the 8 thread grinders (5 400 − MPS load) after the upstream days, + after days + shipping.", g: "guide 46 §10" },
    { sec: "Purchasing", f: "46_procure_to_pay.svg", t: "Procure to pay", c: "Planned order → requisition → purchase order → supplier portal (HTTP JSON) → goods receipt to blocked stock → incoming inspection (ISO 2859-1, item 5) → unrestricted stock → invoice check (3-way match) → payment.", g: "guide 46 §11" },
    { sec: "ERP ↔ MES", f: "46_erp_mes_sequence.svg", t: "ERP ↔ MES sequence over HTTP", c: "Release → GET MES work orders (erpOrder?) → POST /api/bsf/mes/workorders (Idempotency-Key erp-rel-PO…) → 201; MES books finished goods POST /api/bsf/erp/goodsmovements; ERP sync GET work order + confirmations → backflush → settlement.", g: "guide 46 §13" },
    { sec: "Costing", f: "46_mhr_buildup.svg", t: "Machine hour rate build-up – thread grinder BS-TGR", c: "1.1 M€ machine: depreciation 110 000 + interest 33 000 + space 6 930 + energy 12 150 + maintenance 55 000 = 217 080 € / 3 750 h = 57.89 €/h.", g: "guide 46 §15" },
    { sec: "Costing", f: "46_cost_waterfall.svg", t: "Standard cost roll-up – ball screw BS-3210-1000-C5", c: "Material 22.04 + MOH 1.32 + machine 72.25 + labour 47.98 + production overhead 72.14 + scrap allowance 14.33 = 230.07 € standard cost (rounded); list price 420 €.", g: "guide 46 §16" },
  ],
  groups: [
    { id: "erp", t: "ERP software (reference products – " + CHK + ")", src: "guide 46 §25", rows: [
      ["ERP suite – large", "finance, sales, MRP, purchasing, production, quality, controlling", "SAP S/4HANA (on-premise / private cloud) (check)", "check", "≈ 300 k€ – 2 M€ + yearly (" + PR + ")", CHK + "; OData / REST APIs; partner for discrete manufacturing; MES coupling via REST"],
      ["ERP suite – mid / large", "finance, supply chain, manufacturing", "Microsoft Dynamics 365 Business Central / Finance + Supply Chain (check)", "check", "≈ 80 – 600 k€ + subscription", CHK + "; mostly cloud – offline operation of the plant? local fallback"],
      ["ERP for discrete manufacturing", "MRP, configurator, shop floor link", "Infor CloudSuite Industrial (SyteLine) / LN (check)", "check", "≈ 150 – 800 k€", CHK + "; product configurator for variants"],
      ["ERP for make-to-order", "quoting, configurator, MRP, job costing", "Epicor Kinetic (check)", "check", "≈ 100 – 500 k€", CHK + "; REST API v2"],
      ["ERP open source / modular", "sales, MRP, purchasing, inventory, accounting", "Odoo (Community / Enterprise) (check)", "check", "≈ 20 – 200 k€ (Enterprise per user) + partner", CHK + "; JSON-RPC / REST; self-hosted possible (offline!)"],
      ["ERP German Mittelstand", "variant manufacturing, MRP, CAQ link", "proALPHA (check)", "check", "≈ 150 – 600 k€", CHK + "; strong in mechanical engineering"],
      ["ERP German Mittelstand", "manufacturing, MRP, web UI", "abas ERP (forcam / Industrial ERP) (check)", "check", "≈ 100 – 500 k€", CHK + "; REST (EDP / abas API)"],
      ["Own ERP core (this item: twin/bsf_erp.py + web/bsferp*.js)", "stdlib Python + SQLite, HTTP REST", "in-house", "–", "internal effort (finance part is NOT a legal bookkeeping system)", "use only for planning / training; legal accounting needs certified software (GoBD / local law – check)"],
    ] },
    { id: "srv", t: "Servers, database, backup", src: "guide 46 §21, §25", rows: [
      ["ERP application + DB server (2 × for HA)", "2 × 16 – 24 cores, 128 GB RAM, SSD RAID 10", "Dell PowerEdge R760 · HPE ProLiant DL380 · Lenovo ThinkSystem SR650 (check)", "check", "≈ 12 – 25 k€ each", "sizing from the ERP vendor; virtualisation"],
      ["Database licence", "if the ERP needs it", "Microsoft SQL Server · SAP HANA · PostgreSQL (open source) (check)", "check", "0 – 100 k€", "licence by core – check"],
      ["Backup appliance + offline copy", "daily full + log backup, 30 days, tape / RDX offline", "Synology · QNAP · Veeam software · tape LTO-9 (check)", "check", "≈ 3 – 15 k€", "restore test every quarter; 3-2-1 rule"],
      ["UPS", "online 5 – 10 kVA for the server room", "APC Smart-UPS · Eaton 9PX · Socomec (check)", "check", "≈ 3 – 8 k€", "≥ 15 min, clean shutdown"],
      ["Reverse proxy / API gateway", "HTTPS, API keys, rate limits, logging", "nginx · Kong · Caddy (open source) (check)", "–", "internal effort", "only HTTP to MES / portals / customers"],
    ] },
    { id: "out", t: "Printers, scanners, office devices", src: "guide 46 §25", rows: [
      ["Laser printer A4 (delivery notes, invoices, POs)", "duplex, network, 40 ppm", "HP LaserJet Enterprise · Kyocera ECOSYS · Brother (check)", "check", "≈ 0.5 – 1.5 k€ each", "printed from the ERP over the network (IPP / HTTP)"],
      ["Label printer shipping (GS1-128 / SSCC)", "thermal transfer 203 / 300 dpi", "Zebra ZT231 / ZT411 · SATO · Honeywell (check)", "check", "≈ 1 – 3 k€", "SSCC pallet labels, delivery-note labels"],
      ["Handheld scanner for stores (goods receipt / issue)", "Android, 1D/2D, Wi-Fi", "Zebra TC22 / MC3300 · Honeywell CT40 · Datalogic (check)", "check", "≈ 0.8 – 2 k€ each", "browser app on the ERP REST API"],
      ["Stores terminal (goods-in desk)", "PC + label printer + scale", "standard PC + Mettler-Toledo / Bizerba scale (check)", "check", "≈ 2 – 5 k€", "counting scale for small parts (balls!)"],
    ] },
    { id: "svc", t: "Services", src: "guide 46 §22, §25", rows: [
      ["ERP implementation partner", "blueprint, configuration, data migration, training, go-live", "vendor partners (check)", "–", "≈ 1 – 3 × licence cost", "fixed price per phase; references in machine building"],
      ["Data migration tooling", "extract / clean / load masters + open items", "vendor tools · Excel / CSV · own scripts", "–", "internal effort", "clean BOMs + routings BEFORE go-live"],
      ["Training", "key users 5 – 10 days, end users 1 – 2 days", "partner / internal", "–", "≈ 15 – 50 k€", "train on our own data"],
    ] },
  ],
  shopTitle: "ERP roll-out for the example plant (≈ 60 ERP users: sales, planning, purchasing, stores, quality, finance, management). Own ERP core or a bought ERP – the hardware is similar.",
  shopNote: "Prices are rough estimates 2026 – ask for a quote. Licences depend on the user count and modules; project services often cost 1 – 3 × the licence.",
  shops: [
    { title: "ERP hardware + software + services", cols: ["Pos", "Qty", "Item", "Spec (from the guide)", "Example (choose one maker per item)", "Price class (" + PR + ")"], m: 4, p: 5, rows: [
      ["1", "2", "ERP + database servers (HA pair)", "16 – 24 cores, 128 GB, SSD RAID 10", "Dell · HPE · Lenovo", "≈ 25 – 50 k€"],
      ["2", "1", "Backup appliance + offline media", "30 days, restore test", "Synology / Veeam / LTO", "≈ 5 – 15 k€"],
      ["3", "1", "UPS 5 – 10 kVA", "≥ 15 min", "APC · Eaton", "≈ 3 – 8 k€"],
      ["4", "6", "Office laser printers", "delivery notes, invoices", "HP · Kyocera · Brother", "≈ 3 – 9 k€"],
      ["5", "2", "Shipping label printers", "SSCC / GS1-128", "Zebra · SATO", "≈ 2 – 6 k€"],
      ["6", "8", "Stores handheld scanners", "goods receipt / issue / counting", "Zebra · Honeywell", "≈ 7 – 16 k€"],
      ["7", "1", "Counting scale (goods-in)", "balls, small parts", "Mettler-Toledo · Bizerba", "≈ 2 – 5 k€"],
      ["8", "60", "ERP user licences (named / concurrent)", "per module", "SAP · Microsoft · Infor · Epicor · Odoo · proALPHA · abas", "≈ 60 – 600 k€ or subscription"],
      ["9", "1", "Implementation partner (blueprint → go-live)", "6 – 12 months", "vendor partner", "≈ 150 – 900 k€"],
      ["10", "1", "Data migration + cleaning (BOMs, routings, stock, open orders)", "2 – 3 test loads", "internal + partner", "≈ 20 – 80 k€"],
      ["11", "1", "Interfaces: ERP ↔ MES (REST, this guide), supplier portal, customer order API, bank file", "HTTP only", "internal + partner", "≈ 30 – 120 k€"],
      ["12", "1", "Training + hypercare (4 weeks after go-live)", "key + end users", "partner / internal", "≈ 15 – 50 k€"],
    ] },
  ],
};

/* build vs buy – honest comparison (guide 46 §24) */
export const BUILD_BUY7 = [
  ["Fit to our rule (only Ethernet + Modbus TCP + HTTP)", "exact – REST + JSON, same conventions as items 4 – 6", "most modern ERPs offer REST / OData – check the MES interface and the offline behaviour of cloud products"],
  ["Legal accounting, tax, payroll, e-invoicing", "NOT covered – the finance part here is a planning / training model", "covered and certified (country versions, audits, e-invoice formats) – the main reason to buy"],
  ["Planning functions (MRP, ATP / CTP, configurator)", "transparent, exactly our model (bottleneck CTP, phantom semis, lot rules)", "wide and tested; configurator + APS often extra modules"],
  ["Time to production", "planning core: months; full ERP incl. finance: years (not recommended)", "≈ 6 – 18 months project"],
  ["Cost (example plant, 5 years)", "1 – 2 developer-years for the planning core + support", "licences ≈ 60 – 600 k€ (or subscription) + project 1 – 3 × licence + 15 – 22 % maintenance / year"],
  ["Risk", "key-person risk, audits, security and backup are our job", "vendor lock-in, upgrade projects, licence changes, cloud dependence"],
  ["Recommendation (example)", "keep this core as the specification + training model and as a test partner for the MES interface", "buy a standard ERP for finance / sales / purchasing; demand the HTTP contract of guides 43 / 45 / 46 in the tender; keep MRP rules + bottleneck CTP as requirements"],
];
