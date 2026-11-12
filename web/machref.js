/* Machine tabs – card "Real components + drawings – catalogue examples" at the END of:
 *   HMC build item 1 (#hrItem1, rotary table / machine) → #mrHmc1 – guide 12 (drawings 12_*, buy list §M16 – 10 tables, BOM §M17)
 *   Pallet changer tab (#tab-apc, single page)          → #mrApc  – guide 09 (drawings 09_*, buy list §28.1 – 28.10, shopping list §28.11)
 *   AGV build item 1 (#avItem1, underride AGV)          → #mrAgv1 – guide 11 (drawings 11_*, buy list §29.1 – 29.12, fleet shopping list §29.13)
 *   Assembly item 1 (#arItem1, rotary table)            → #mrAsm1 – guide 17 (drawings 17_*, buy list §32.1 – 32.9, shopping list §32.10)
 *   Assembly item 2 (#arItem2, motor spindle)           → #mrAsm2 – guide 19 (drawings 19_*, buy list §32.1 – 32.11, shopping list §33)
 *   HMC build item 4 (#hrItem4, spindle manufacturing)  → #mrHmc4 – guide 18 (drawings 18_*, buy list §28.1 – 28.10, shopping list §28.11 + make-or-buy §28.12)
 *   SCADA tab (#tab-scada)                              → #mrScada – guide 06 (drawings 06_*, buy list §30.1 – 30.9, shopping list §30.10)
 *   PLC section of the FMS tab (#tab-fms, after the card "How a PLC controls the line") → #mrPlc – guide 05 (drawings 05_*,
 *     buy list §35.1 – 35.7, shopping list §35.8). plc.js has no tab of its own – it renders into the FMS tab.
 *   Communication tab (#tab-comm)                       → #mrComm  – guide 07 (drawings 07_*, buy list §34.1 – 34.12, shopping list §35)
 *   CNC / G-code tab (#tab-cnc)                         → #mrCnc   – guide 08 (drawings 08_*, buy list §31.1 – 31.10, shopping list §32)
 *   Mechanical elements item 1 (#mxItem1, pallet transfer station) → #mrMech1 – guide 10 (drawings 10_*, buy list §36.1 – 36.14, shopping list §37)
 *   HMC items 2 – 3 (worm, wheel): no card – guide 12 §5.20.1 / W7.1 give equipment buy specs, not catalogue examples.
 *   A new card = one ITEMS entry (gen_mach.py) + one TARGETS line below.
 * The card is makeCard() from robotref.js. Data: machref_data.js (generated from the guide tables).
 * Lazy: built the first time its tab (and item) is visible; a MutationObserver keeps the card as the LAST element
 *   (or directly after its anchor element, for the PLC card).
 * Test: &mrhold=hmc|apc|agv|asm|scada|fms|comm|cnc|mech (headless: keep load pending + show the tab) · ?mrtab=draw|buy|shop · &mrq=text · &mrbox=N · &mrscroll ·
 *       &mrchk (console "MRCHK …"; switches the items of the shown tab, e.g. HMC 1→2→3→4→1).
 */
import { makeCard } from "./robotref.js";
import { ITEMS } from "./machref_data.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const clickItem = (attr) => (n) => { const b = document.querySelector(`[${attr}="${n}"]`); if (b) b.click(); };
// tab name → pane, item hosts, how to switch items (tests only)
const TABS = {
  hmc: { pane: "tab-hmc", item: "hrItem", items: ["1", "2", "3", "4"], show: (n) => window.wormMfg && window.wormMfg.showItem(n) },
  apc: { pane: "tab-apc", item: null, items: [], show: null },
  agv: { pane: "tab-agv", item: "avItem", items: ["1", "2", "3", "4"], show: clickItem("data-avitem") },
  asm: { pane: "tab-asm", item: "arItem", items: ["1", "2", "3"], show: (n) => (window.asmTab ? window.asmTab.showItem(n) : clickItem("data-asitem")(n)) },
  scada: { pane: "tab-scada", item: null, items: [], show: null },
  fms: { pane: "tab-fms", item: null, items: [], show: null },
  comm: { pane: "tab-comm", item: null, items: [], show: null },
  cnc: { pane: "tab-cnc", item: null, items: [], show: null },
  mech: { pane: "tab-mech", item: "mxItem", items: ["1", "2", "3", "4"], show: clickItem("data-mxitem") },
};
// the PLC section ends with the learn card "How a PLC controls the line" (static HTML in index.html) – the PLC card goes right after it
const plcAnchor = () => [...document.querySelectorAll("#tab-fms > .card.learn")].find((c) => /PLC/.test((c.querySelector("h2") || {}).textContent || "")) || null;
// data key → tab, host element (the card is appended to it), card id, id suffix
const TARGETS = [
  { key: "hmc1", tab: "hmc", host: "hrItem1", card: "mrHmc1", s: "Hmc1" },
  { key: "hmc4", tab: "hmc", host: "hrItem4", card: "mrHmc4", s: "Hmc4" },     // guide 18
  { key: "apc", tab: "apc", host: "tab-apc", card: "mrApc", s: "Apc" },
  { key: "agv1", tab: "agv", host: "avItem1", card: "mrAgv1", s: "Agv1" },
  { key: "asm1", tab: "asm", host: "arItem1", card: "mrAsm1", s: "Asm1" },
  { key: "asm2", tab: "asm", host: "arItem2", card: "mrAsm2", s: "Asm2" },     // guide 19
  { key: "scada", tab: "scada", host: "tab-scada", card: "mrScada", s: "Scada" },
  { key: "plc", tab: "fms", host: "tab-fms", card: "mrPlc", s: "Plc", after: plcAnchor },
  { key: "comm", tab: "comm", host: "tab-comm", card: "mrComm", s: "Comm" },
  { key: "cnc", tab: "cnc", host: "tab-cnc", card: "mrCnc", s: "Cnc" },
  { key: "mech1", tab: "mech", host: "mxItem1", card: "mrMech1", s: "Mech1" },
];
// card position: directly after T.after() if the target has an anchor, else the last element of the host
const placed = (T, host, c) => (T.after ? !!T.after() && T.after().nextElementSibling === c : host.lastElementChild === c);
const place = (T, host, c) => { if (placed(T, host, c)) return; if (T.after) { const a = T.after(); if (a) a.after(c); } else host.appendChild(c); };
const cards = {}, keep = {};

// test only (&mrhold=hmc|apc|agv|asm): a hidden iframe on the never-ending SSE stream keeps the load event pending (headless screenshots), then shows that tab
if (Q.has("mrhold")) { const fr = document.createElement("iframe"); fr.src = "/api/stream?mrhold=" + Date.now(); fr.title = "test"; fr.style.display = "none"; document.body.appendChild(fr);
  setTimeout(() => { const t = TABS[Q.get("mrhold")] ? Q.get("mrhold") : "hmc"; if (typeof window.showTab === "function") window.showTab(t); else { const b = document.querySelector(`[data-tab="${t}"]`); if (b) b.click(); } }, 300); }

const cfg = (d) => ({ drawings: d.drawings, groups: d.groups, shops: d.shops, guides: d.guide, shopTab: d.shopTab, ph: d.ph, buyNote: d.price,
  shopLbl: d.shopLbl, shopTitle: d.shopTitle, shopNote: d.shopNote, shopPrice: true });

function keeper(T, host) {
  if (keep[T.key]) return;
  let pending = false;
  const check = () => { pending = false; const c = cards[T.key]; if (c) place(T, host, c); };
  keep[T.key] = new MutationObserver(() => { if (!pending) { pending = true; setTimeout(check, 0); } });
  keep[T.key].observe(host, { childList: true });
}

function ensure(T) {
  if (!ITEMS[T.key]) return;
  const pane = $(TABS[T.tab].pane), host = $(T.host);
  if (!pane || !host || !pane.classList.contains("active") || host.hidden || !host.children.length) return;
  if (T.after && !T.after()) return;
  if (!cards[T.key]) {
    try { cards[T.key] = makeCard(cfg(ITEMS[T.key]), T.after ? T.after().parentNode : host, { card: T.card, q: "mrQ" + T.s, g: "mrG" + T.s, cnt: "mrCnt" + T.s, buy: "mrBuy" + T.s }, "mr"); }
    catch (e) { console.error(e); return; }
  }
  keeper(T, host);
  place(T, host, cards[T.key]);
}
const ensureAll = () => TARGETS.forEach(ensure);

// test only (&mrchk): report the cards of the shown tab while switching its items (… → last → 1)
if (Q.has("mrchk")) {
  const errs = [];
  window.addEventListener("error", (e) => errs.push(e.message || String(e)));
  window.addEventListener("unhandledrejection", (e) => errs.push("promise: " + (e.reason && e.reason.message || e.reason)));
  const rep = (tag, tab) => TARGETS.filter((T) => T.tab === tab && ITEMS[T.key]).forEach((T) => {
    const host = $(T.host), card = $(T.card), imgs = card ? [...card.querySelectorAll(".rr-fig img")] : [];
    console.log(`MRCHK ${tag} ${T.key} tabActive=${$(TABS[tab].pane).classList.contains("active")} hostVisible=${!host.hidden} card=${!!card} inHost=${!!(card && host.contains(card))} placed=${!!(card && placed(T, host, card))} imgs=${imgs.length} loaded=${imgs.filter((i) => i.complete && i.naturalWidth > 0).length} buyRows=${card ? card.querySelectorAll('[data-rrp="buy"] tbody tr').length : 0} shopRows=${card ? card.querySelectorAll('[data-rrp="shop"] tbody tr').length : 0} cnt="${card ? $("mrCnt" + T.s).textContent : ""}" errors=${errs.length ? errs.join(" | ") : "none"}`);
  });
  setTimeout(() => {
    const tab = Object.keys(TABS).find((k) => $(TABS[k].pane) && $(TABS[k].pane).classList.contains("active"));
    if (!tab) { console.log("MRCHK no machine tab active"); return; }
    const X = TABS[tab], seq = X.items.length ? [...X.items, "1"] : [];
    rep("start", tab);
    const step = (i) => {
      if (i >= seq.length) { rep("final", tab); console.log(`MRCHK DONE tab=${tab} cards=${Object.keys(cards).join(",")} ids=${TARGETS.map((T) => T.card + ":" + document.querySelectorAll("#" + T.card).length).join(" ")} errors=${errs.length ? errs.join(" | ") : "none"}`); return; }
      if (i > 0) X.show(seq[i]);
      setTimeout(() => { const h = $(X.item + seq[i]); console.log(`MRCHK step${i} ${tab} item${seq[i]} visible=${h && !h.hidden} built=${h && h.children.length > 0} errors=${errs.length ? errs.join(" | ") : "none"}`); step(i + 1); }, 2000);
    };
    step(0);
  }, +Q.get("mrchk") || 4000);
}

window.addEventListener("hritemshow", () => setTimeout(ensureAll, 0));     // HMC item switch (wormmfg.js)
window.addEventListener("asitemshow", () => setTimeout(ensureAll, 0));     // Assembly item switch (asmrt.js)
document.addEventListener("click", (e) => { if (e.target.closest && e.target.closest("[data-avitem], [data-mxitem]")) setTimeout(ensureAll, 50); });   // AGV + Mechanical item switches have no event
const prevTab = window.onTabShown;
window.onTabShown = (name) => { if (prevTab) prevTab(name); if (TABS[name]) setTimeout(ensureAll, 0); };
ensureAll();
