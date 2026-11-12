/* INSTALLATION tab – card "Real components + drawings – catalogue examples" at the END of each item:
 *   item 1 (#inItem1, foundation / anchoring / vibration) → #irCard1 – guide 26 (drawings 26_*, buy list F3.1–F3.3 + F3.7 vibration, consumables F4.1)
 *   item 2 (#inItem2, levelling / alignment / geometry)   → #irCard2 – guide 26 (drawings 26_*, buy list F3.4–F3.6 + F3.7 shaft alignment, instruments F4.2)
 *   item 3 (#inItem3, electrical installation)            → #irCard3 – guide 27 (drawings 27_* Part A, buy list Part F power / protection / meters / testers, F.15)
 *   item 4 (#inItem4, EMC + cable routing)                → #irCard4 – guide 27 (drawings 27_* Part B, buy list cables / trays / harmonics / EMC parts, F.15)
 *   item 5 (#inItem5, sequence + commissioning)           → #irCard5 – guide 28 (drawings 28_*, buy list G1.1–G1.14, shopping list G2 buy + rent / service)
 * The card itself is makeCard() from robotref.js (same look, lightbox, filter). Data: instref_data.js (generated from the guide tables).
 * Lazy: built the first time the item is visible AND its own content exists (items are built on "initemshow" by instmech.js,
 *   instelec.js, instseq.js; a MutationObserver waits if needed). The card is kept as the last element of the item.
 * Test: ?irtab=draw|buy|shop · &irq=text (filter) · &irbox=N (lightbox) · &irscroll · &irchk (console "IRCHK …", switches 1→5→2→3→4→1).
 */
import { makeCard } from "./robotref.js";
import { ITEMS } from "./instref_data.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const pane = () => $("tab-inst");
const cards = {}, observers = {};

const cfg = (n) => {
  const d = ITEMS[n];
  return { drawings: d.drawings, groups: d.groups, shopCols: d.shopCols, shop: d.shop, shopM: d.shopM, shopP: d.shopP, shopW: d.shopW, shopCls: "",
    guides: d.guide, shopTab: d.shopTab, ph: d.ph, buyNote: d.price, shopLbl: d.shopLbl, shopTitle: d.shopTitle, shopNote: d.shopNote, shopPrice: true };
};
const ids = (n) => ({ card: "irCard" + n, q: "irQ" + n, g: "irG" + n, cnt: "irCnt" + n, buy: "irBuy" + n });

// the element the item's own cards live in: a single "*-wrap" child (items 3, 4, 5) or the item box itself (items 1, 2)
function wrapOf(host) {
  const kids = [...host.children].filter((e) => e.id !== "irCard" + host.id.slice(-1));
  if (kids.length === 1 && /-wrap\b/.test(kids[0].className)) return kids[0];
  return host;
}

function ensure(n) {
  n = String(n);
  if (!ITEMS[n]) return;
  const host = $("inItem" + n), p = pane();
  if (!host || host.hidden || !p || !p.classList.contains("active")) return;
  const own = [...host.children].filter((e) => e.id !== "irCard" + n);
  if (!own.length) {                               // the item is not built yet → wait for its content
    if (!observers[n]) {
      observers[n] = new MutationObserver(() => { if ([...host.children].some((e) => e.id !== "irCard" + n)) { observers[n].disconnect(); observers[n] = null; setTimeout(() => ensure(n), 0); } });
      observers[n].observe(host, { childList: true });
    }
    return;
  }
  const wrap = wrapOf(host);
  if (cards[n]) { if (wrap.lastElementChild !== cards[n]) wrap.appendChild(cards[n]); return; }   // keep it last (also after a rebuild)
  try { cards[n] = makeCard(cfg(n), wrap, ids(n), "ir"); } catch (e) { console.error(e); }
}
const current = () => (window.inCtl ? window.inCtl.current() : "1");

// test only (&irchk): report each card while switching items 1 → 5 → 2 → 3 → 4 → 1
if (Q.has("irchk")) {
  const errs = [];
  window.addEventListener("error", (e) => errs.push(e.message || String(e)));
  window.addEventListener("unhandledrejection", (e) => errs.push("promise: " + (e.reason && e.reason.message || e.reason)));
  const rep = (n, tag) => {
    const host = $("inItem" + n), card = $("irCard" + n), imgs = card ? [...card.querySelectorAll(".rr-fig img")] : [];
    console.log(`IRCHK ${tag} item${n} visible=${host && !host.hidden} built=${host ? [...host.children].filter((e) => e.id !== "irCard" + n).length > 0 : false} card=${!!card} expected=${!!ITEMS[n]} inItem=${!!(card && host.contains(card))} last=${!!(card && card.parentElement.lastElementChild === card)} imgs=${imgs.length} loaded=${imgs.filter((i) => i.complete && i.naturalWidth > 0).length} buyRows=${card ? card.querySelectorAll('[data-rrp="buy"] tbody tr').length : 0} shopRows=${card ? card.querySelectorAll('[data-rrp="shop"] tbody tr').length : 0} cnt="${card ? $("irCnt" + n).textContent : ""}" errors=${errs.length ? errs.join(" | ") : "none"}`);
  };
  const seq = ["1", "5", "2", "3", "4", "1"];
  const step = (i) => {
    if (i >= seq.length) { console.log(`IRCHK DONE cards=${Object.keys(cards).join(",")} unique ids=${[1, 2, 3, 4, 5].map((k) => document.querySelectorAll("#irCard" + k).length).join("/")} robot cards=${["rrCard", "rrCard2", "rrCard3"].map((k) => document.querySelectorAll("#" + k).length).join("/")} errors=${errs.length ? errs.join(" | ") : "none"}`); return; }
    if (window.inCtl && (i > 0 || current() !== seq[0])) window.inCtl.showItem(seq[i]);
    setTimeout(() => { rep(seq[i], "step" + i); step(i + 1); }, 2500);
  };
  setTimeout(() => step(0), +Q.get("irchk") || 4000);
}

window.addEventListener("initemshow", (e) => setTimeout(() => ensure(e.detail), 0));
const prevTab = window.onTabShown;
window.onTabShown = (name) => { if (prevTab) prevTab(name); if (name === "inst") setTimeout(() => ensure(current()), 0); };
ensure(current());
