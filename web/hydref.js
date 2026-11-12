/* HYDRAULICS tab – card "Real components + drawings – catalogue examples" at the END of each item:
 *   item 1 (#hyItem1, element data book)   → #hrCard1 – guides 25 + 29 (drawings: method 25_*, elements 29_*; buy list 29 §17, element shopping list 29 §18)
 *   item 2 (#hyItem2, standard circuits)   → #hrCard2 – guide 30 (drawings 30_* circuits; buy list per circuit §20.1 – 20.11)
 *   item 3 (#hyItem3, system sizing)       → #hrCard3 – guides 25 + 30 (drawings 30_sizing_flow + 25 duty cycle / HPU / losses; buy list 25 §18;
 *                                             shopping lists 30 §21 guide-25 job, 30 §22 press 200 kN, 25 §19 APC + clamp)
 * The card is makeCard() from robotref.js. Data: hydref_data.js (generated from the guide tables). A new item = one ITEMS entry.
 * Lazy: built the first time the item is visible and has its own content (hydlib.js / hydckt.js build on "hyitemshow"; item 1 first shows a
 *   loading card, then replaces its content). A MutationObserver keeps the card as the LAST element, also after a rebuild of the item.
 * Test: ?hrtab=draw|buy|shop · &hrq=text · &hrbox=N · &hrscroll · &hrchk (console "HRCHK …", switches 1→2→3→1).
 */
import { makeCard } from "./robotref.js";
import { ITEMS } from "./hydref_data.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const cards = {}, keep = {};

const cfg = (n) => {
  const d = ITEMS[n];
  return { drawings: d.drawings, groups: d.groups, shops: d.shops, guides: d.guide, shopTab: d.shopTab, ph: d.ph, buyNote: d.price,
    shopLbl: d.shopLbl, shopTitle: d.shopTitle, shopNote: d.shopNote, shopPrice: true };
};
const ids = (n) => ({ card: "hrCard" + n, q: "hrQ" + n, g: "hrG" + n, cnt: "hrCnt" + n, buy: "hrBuy" + n });
const own = (host, n) => [...host.children].filter((e) => e.id !== "hrCard" + n);
// the element the item's cards live in: a single "*-wrap" child that stacks its cards, else the item box itself.
// Item 1's .hl-wrap is a 2-column grid (navigator + page) → the card goes AFTER it, full width, in the item box.
function wrapOf(host, n) {
  const k = own(host, n);
  return k.length === 1 && /-wrap\b/.test(k[0].className) && getComputedStyle(k[0]).display !== "grid" ? k[0] : host;
}

// keep the card last: watch the item box and its current wrap; re-append after a rebuild (e.g. item 1 replacing its loading card)
function keeper(n, host) {
  if (keep[n]) return;
  let pending = false, wrapObs = null, wrapEl = null;
  const check = () => {
    pending = false;
    const card = cards[n]; if (!card || !own(host, n).length) return;
    const w = wrapOf(host, n);
    if (w !== wrapEl) { if (wrapObs) wrapObs.disconnect(); wrapEl = w; if (w !== host) { wrapObs = new MutationObserver(sched); wrapObs.observe(w, { childList: true }); } }
    if (w.lastElementChild !== card) w.appendChild(card);
  };
  const sched = () => { if (!pending) { pending = true; setTimeout(check, 0); } };
  keep[n] = new MutationObserver(sched);
  keep[n].observe(host, { childList: true });
  check();
}

function ensure(n) {
  n = String(n);
  if (!ITEMS[n]) return;
  const host = $("hyItem" + n), p = $("tab-hyd");
  if (!host || host.hidden || !p || !p.classList.contains("active")) return;
  if (!cards[n]) {
    if (!own(host, n).length) {               // not built yet → the keeper's observer builds it when content arrives
      if (!keep["w" + n]) { keep["w" + n] = new MutationObserver(() => { if (own(host, n).length) { keep["w" + n].disconnect(); setTimeout(() => ensure(n), 0); } }); keep["w" + n].observe(host, { childList: true }); }
      return;
    }
    try { cards[n] = makeCard(cfg(n), wrapOf(host, n), ids(n), "hr"); } catch (e) { console.error(e); return; }
  }
  keeper(n, host);
}
const current = () => (window.hyCtl ? window.hyCtl.current() : "1");

// test only (&hrchk): report each card while switching items 1 → 2 → 3 → 1
if (Q.has("hrchk")) {
  const errs = [];
  window.addEventListener("error", (e) => errs.push(e.message || String(e)));
  window.addEventListener("unhandledrejection", (e) => errs.push("promise: " + (e.reason && e.reason.message || e.reason)));
  const rep = (n, tag) => {
    const host = $("hyItem" + n), card = $("hrCard" + n), imgs = card ? [...card.querySelectorAll(".rr-fig img")] : [];
    console.log(`HRCHK ${tag} item${n} visible=${host && !host.hidden} card=${!!card} inItem=${!!(card && host.contains(card))} last=${!!(card && card.parentElement.lastElementChild === card)} imgs=${imgs.length} loaded=${imgs.filter((i) => i.complete && i.naturalWidth > 0).length} buyRows=${card ? card.querySelectorAll('[data-rrp="buy"] tbody tr').length : 0} shopRows=${card ? card.querySelectorAll('[data-rrp="shop"] tbody tr').length : 0} shopTab=${!!(card && card.querySelector('[data-rr="shop"]'))} cnt="${card ? $("hrCnt" + n).textContent : ""}" errors=${errs.length ? errs.join(" | ") : "none"}`);
  };
  const seq = ["1", "2", "3", "1"];
  const step = (i) => {
    if (i >= seq.length) { console.log(`HRCHK DONE cards=${Object.keys(cards).join(",")} unique ids=${[1, 2, 3].map((k) => document.querySelectorAll("#hrCard" + k).length).join("/")} errors=${errs.length ? errs.join(" | ") : "none"}`); return; }
    if (window.hyCtl && (i > 0 || current() !== seq[0])) window.hyCtl.showItem(seq[i]);
    setTimeout(() => { rep(seq[i], "step" + i); step(i + 1); }, 3000);
  };
  setTimeout(() => step(0), +Q.get("hrchk") || 4000);
}

window.addEventListener("hyitemshow", (e) => setTimeout(() => ensure(e.detail), 0));
const prevTab = window.onTabShown;
window.onTabShown = (name) => { if (prevTab) prevTab(name); if (name === "hyd") setTimeout(() => ensure(current()), 0); };
ensure(current());
