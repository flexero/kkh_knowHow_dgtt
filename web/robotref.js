/* ROBOT tab – card "Real components + drawings – catalogue examples", one card at the END of each item:
 *   item 1 (#rbItem1, 6-axis robot)         → #rrCard  – guides 21 + 22 (drawings 21_*.svg + 22_*.svg, buy lists 21 ch. 24 + 22 §17.10/18.5/19.4, shopping list 21 §24.7)
 *   item 2 (#rbItem2, robot control system) → #rrCard2 – guide 23 (drawings 23_*, buy list ch. 25, shopping list §25.7)
 *   item 3 (#rbItem3, control circuits)     → #rrCard3 – guide 24 (drawings 24_*, buy list ch. 17, BOM ch. 18 – 44 lines)
 * Each card: (a) drawings – thumbnails of web/img/*.svg, click to enlarge; (b) buy list with filter; (c) shopping list / BOM.
 * Data: robotref_data.js. Offline: no external links, no CDN. makeCard() is exported for instref.js (Installation tab).
 * Lazy: a card is built the first time its item is visible AND the item's own content exists (items 2/3 are built lazily by
 *   robotctl.js / robotckt.js on "rbitemshow"; a MutationObserver waits if that content is not there yet).
 * Test: ?rrtab=draw|buy|shop opens that section, &rrbox=N opens drawing N in the lightbox, &rrq=text pre-fills the filter,
 *       &rrscroll scrolls to the card, &rrchk logs "RRCHK …" (build, images, rows, errors; switches items 1→2→3→1→2→3) to the console.
 */
import { NOTE, DRAWINGS, COLS, GROUPS, SHOP_COLS, SHOP, SHOP_NOTE, ITEMS } from "./robotref_data.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const Q = new URLSearchParams(location.search);
const pane = $("tab-robot");
const PRICE1 = "Price classes are rough estimates (2020s, Europe, without integration) – always ask 2 – 3 suppliers.";
const I2 = ITEMS["2"], I3 = ITEMS["3"];

const CFG = {
  "1": { sfx: "", host: "rbItem1", wrap: ".rb-wrap", drawings: DRAWINGS, groups: GROUPS, shopCols: SHOP_COLS, shop: SHOP, shopM: 4, shopP: 5, shopCls: "rr-shop",
    guides: "guides 21 + 22", shopTab: "Shopping list – compressor cell", ph: "(e.g. RV-60N, SICK, gripper)", buyNote: PRICE1, shopLbl: "shopping list",
    shopPrice: false, shopTitle: "Consolidated shopping list for the compressor housing machine-tending cell, Option A (one 20 – 25 kg robot, single gripper) – guide 21 §24.7.", shopNote: SHOP_NOTE },
  "2": { sfx: "2", host: "rbItem2", wrap: ".rc-wrap", drawings: I2.drawings, groups: I2.groups, shopCols: I2.shopCols, shop: I2.shop, shopM: I2.shopM, shopP: I2.shopP, shopCls: "rr-shop2",
    guides: "guide 23", shopTab: "Shopping list – cell control", ph: "(e.g. SafeMove, S7-1500F, EtherCAT, Fluke)", buyNote: I2.price, shopLbl: "shopping list",
    shopPrice: true, shopTitle: I2.shopTitle, shopNote: I2.shopNote },
  "3": { sfx: "3", host: "rbItem3", wrap: ".ck-wrap", drawings: I3.drawings, groups: I3.groups, shopCols: I3.shopCols, shop: I3.shop, shopM: I3.shopM, shopP: I3.shopP, shopCls: "rr-shop3",
    guides: "guide 24", shopTab: "BOM – cell cabinet", ph: "(e.g. -K1, 3RT2016, PULS, Rittal)", buyNote: I3.price, shopLbl: "BOM",
    shopPrice: true, shopTitle: I3.shopTitle, shopNote: I3.shopNote },
};
const cards = {};          // item number -> card element

const CSS = `
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) .rr-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin: 0 0 12px; }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) .rr-tab { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 6px; padding: 6px 12px; font: inherit; font-size: 13px; cursor: pointer; }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) .rr-tab.on { border-color: var(--accent); color: var(--accent); font-weight: 600; box-shadow: inset 0 -2px 0 var(--accent); }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) .rr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) .rr-fig { margin: 0; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); overflow: hidden; display: flex; flex-direction: column; }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) .rr-fig button { all: unset; cursor: zoom-in; display: block; background: #fff; border-bottom: 1px solid var(--border); }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) .rr-fig button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) .rr-fig img { display: block; width: 100%; height: auto; aspect-ratio: 1200 / 830; object-fit: contain; background: #fff; }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) .rr-fig figcaption { padding: 8px 10px 10px; font-size: 12.5px; color: var(--text-2); line-height: 1.4; }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) .rr-fig figcaption b { display: block; color: var(--text); font-size: 13px; margin-bottom: 2px; }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) .rr-fig .rr-g { color: var(--accent); font-size: 11.5px; }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) .rr-bar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin: 0 0 10px; }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) .rr-bar input, :is(#rrCard, #rrCard2, #rrCard3, .rr-card) .rr-bar select { font: inherit; font-size: 13px; padding: 5px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) .rr-bar input { min-width: 240px; flex: 1 1 240px; max-width: 420px; }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) .rr-count { font-size: 12.5px; color: var(--text-2); }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) h3.rr-h { margin: 16px 0 6px; font-size: 14px; color: var(--text); }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) h3.rr-h small { font-weight: normal; color: var(--text-2); margin-left: 6px; }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) table.rr-tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) table.rr-tbl th, :is(#rrCard, #rrCard2, #rrCard3, .rr-card) table.rr-tbl td { border: 1px solid var(--border); padding: 4px 6px; text-align: left; vertical-align: top; color: var(--text); white-space: normal; overflow-wrap: anywhere; line-height: 1.35; }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) table.rr-tbl { table-layout: fixed; min-width: 900px; }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) table.rr-buy col:nth-child(1) { width: 15%; } :is(#rrCard, #rrCard2, #rrCard3, .rr-card) table.rr-buy col:nth-child(2) { width: 21%; } :is(#rrCard, #rrCard2, #rrCard3, .rr-card) table.rr-buy col:nth-child(3) { width: 19%; }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) table.rr-buy col:nth-child(4) { width: 16%; } :is(#rrCard, #rrCard2, #rrCard3, .rr-card) table.rr-buy col:nth-child(5) { width: 13%; } :is(#rrCard, #rrCard2, #rrCard3, .rr-card) table.rr-buy col:nth-child(6) { width: 16%; }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) table.rr-shop col:nth-child(1) { width: 4%; } :is(#rrCard, #rrCard2, #rrCard3, .rr-card) table.rr-shop col:nth-child(2) { width: 6%; } :is(#rrCard, #rrCard2, #rrCard3, .rr-card) table.rr-shop col:nth-child(3) { width: 24%; }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) table.rr-shop col:nth-child(4) { width: 22%; } :is(#rrCard, #rrCard2, #rrCard3, .rr-card) table.rr-shop col:nth-child(5) { width: 30%; } :is(#rrCard, #rrCard2, #rrCard3, .rr-card) table.rr-shop col:nth-child(6) { width: 14%; }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) table.rr-tbl th { background: var(--surface-2, var(--surface)); font-weight: 600; position: sticky; top: 0; }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) table.rr-tbl td.rr-m { font-weight: 600; color: var(--accent); }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) table.rr-tbl tr.rr-hit td { background: color-mix(in srgb, var(--accent) 8%, transparent); }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) .rr-note { margin: 10px 0 0; padding: 8px 10px; border-left: 3px solid var(--accent); background: var(--surface); color: var(--text-2); font-size: 12.5px; }
:is(#rrCard, #rrCard2, #rrCard3, .rr-card) .rr-empty { color: var(--text-2); font-size: 13px; padding: 8px 0; }
.rr-lb { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,.78); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; }
.rr-lb[hidden] { display: none; }
.rr-lb img { max-width: min(1400px, 96vw); max-height: calc(100vh - 120px); background: #fff; border-radius: 4px; box-shadow: 0 4px 24px rgba(0,0,0,.5); }
.rr-lb .rr-cap { color: #f0efec; font-size: 13px; margin-top: 10px; max-width: min(1200px, 96vw); text-align: center; line-height: 1.4; }
.rr-lb .rr-ctl { position: absolute; top: 10px; right: 12px; display: flex; gap: 6px; }
.rr-lb .rr-ctl button { font: inherit; font-size: 14px; padding: 6px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,.35); background: rgba(20,20,20,.7); color: #fff; cursor: pointer; }
#rrCard2 table.rr-shop2 col:nth-child(1) { width: 4%; } #rrCard2 table.rr-shop2 col:nth-child(2) { width: 22%; } #rrCard2 table.rr-shop2 col:nth-child(3) { width: 7%; }
#rrCard2 table.rr-shop2 col:nth-child(4) { width: 25%; } #rrCard2 table.rr-shop2 col:nth-child(5) { width: 27%; } #rrCard2 table.rr-shop2 col:nth-child(6) { width: 15%; }
#rrCard3 table.rr-shop3 col:nth-child(1) { width: 4%; } #rrCard3 table.rr-shop3 col:nth-child(2) { width: 9%; } #rrCard3 table.rr-shop3 col:nth-child(3) { width: 24%; }
#rrCard3 table.rr-shop3 col:nth-child(4) { width: 24%; } #rrCard3 table.rr-shop3 col:nth-child(5) { width: 27%; } #rrCard3 table.rr-shop3 col:nth-child(6) { width: 12%; }
`;

function tableHtml(cols, rows, mCol, pCol, cls, w) {
  return `<div class="table-wrap"><table class="rr-tbl ${cls || ""}"><colgroup>${cols.map((_, i) => (w && w[i] ? `<col style="width:${w[i]}%">` : "<col>")).join("")}</colgroup><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${
    rows.map((r) => `<tr>${r.map((c, i) => `<td${i === mCol ? ' class="rr-m"' : i === pCol ? ' class="rr-p"' : ""}>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

/* ------------------------------------------------------------------ shared lightbox */
let LB = null;
function lightbox() {
  if (LB) return LB;
  const lb = document.createElement("div");
  lb.className = "rr-lb"; lb.hidden = true; lb.setAttribute("role", "dialog"); lb.setAttribute("aria-label", "drawing");
  lb.innerHTML = `<div class="rr-ctl"><button type="button" data-k="-1" aria-label="previous">←</button><button type="button" data-k="1" aria-label="next">→</button><button type="button" data-k="x" aria-label="close">✕ Close</button></div><img alt=""><div class="rr-cap"></div>`;
  document.body.appendChild(lb);
  const img = lb.querySelector("img"), cap = lb.querySelector(".rr-cap");
  let list = [], cur = 0;
  const open = (l, i) => {
    list = l; cur = (i + list.length) % list.length;
    const d = list[cur];
    img.src = "img/" + d.f; img.alt = d.t;
    cap.textContent = `${cur + 1} / ${list.length} · ${d.t} – ${d.c} (${d.g}) · Example – check the maker's documentation.`;
    lb.hidden = false;
  };
  const close = () => { lb.hidden = true; };
  lb.addEventListener("click", (e) => {
    const k = e.target.dataset && e.target.dataset.k;
    if (k === "x" || e.target === lb) close(); else if (k) open(list, cur + (+k));
  });
  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") close(); else if (e.key === "ArrowRight") open(list, cur + 1); else if (e.key === "ArrowLeft") open(list, cur - 1);
  });
  LB = { open, close };
  return LB;
}

/* ------------------------------------------------------------------ one card */
/* makeCard(c, wrap, id, P) – exported, also used by instref.js (Installation tab).
 *   c    = config: drawings, groups, shopCols, shop, shopM, shopP, shopCls?, shopW? (column widths %), guides, shopTab, ph, buyNote,
 *          shopLbl, shopTitle, shopNote, shopPrice (append buyNote under the shopping list)
 *          optional: shops = [{ title, cols, rows, m, p, w }] → several shopping tables (instead of shopCols/shop);
 *          no shop and no shops → no shopping tab; drawing.sec → drawings grouped under headings (e.g. "Method (guide 25)")
 *   wrap = element the card is appended to · id = { card, q, g, cnt, buy } element ids · P = URL parameter prefix ("rr" → rrtab, rrq, rrbox, rrscroll) */
export function makeCard(c, wrap, id, P) {
  const shops = c.shops || (c.shop && c.shop.length ? [{ title: "", cols: c.shopCols, rows: c.shop, m: c.shopM, p: c.shopP, w: c.shopW, cls: c.shopCls }] : []);
  const nShop = shops.reduce((k, s) => k + s.rows.length, 0);
  const fig = (d, i) => `
        <figure class="rr-fig"><button type="button" data-rrimg="${i}" aria-label="enlarge ${esc(d.t)}"><img src="img/${esc(d.f)}" alt="${esc(d.t)}" loading="lazy" width="1200" height="830"></button>
          <figcaption><b>${i + 1}. ${esc(d.t)}</b>${esc(d.c)} <span class="rr-g">${esc(d.g)}</span></figcaption></figure>`;
  const secs = [];
  c.drawings.forEach((d, i) => { const s = d.sec || ""; if (!secs.length || secs[secs.length - 1].s !== s) secs.push({ s, items: [] }); secs[secs.length - 1].items.push([d, i]); });
  if (!$("rrStyle")) { const st = document.createElement("style"); st.id = "rrStyle"; st.textContent = CSS; document.head.appendChild(st); }
  const card = document.createElement("div");
  card.className = "card rr-card"; card.id = id.card;
  card.innerHTML = `
    <div class="card-head"><h2>Real components + drawings – catalogue examples</h2>
      <span class="sub">${c.drawings.length} drawings · ${c.groups.reduce((k, g) => k + g.rows.length, 0)} catalogue rows · ${nShop ? `${c.shopLbl} ${nShop} positions · ` : ""}${c.guides}</span></div>
    <div class="rr-tabs" role="tablist">
      <button class="rr-tab on" data-rr="draw" role="tab">Drawings</button>
      <button class="rr-tab" data-rr="buy" role="tab">Buy list</button>
      ${nShop ? `<button class="rr-tab" data-rr="shop" role="tab">${esc(c.shopTab)}</button>` : ""}
    </div>
    <div data-rrp="draw">
      <p class="muted" style="margin:0 0 10px;font-size:12.5px">Manufacturing-style drawings with real part names and the example values of the guides. Click a drawing to enlarge (← → to browse, Esc to close).
        The same files are in <code>docs/img/</code> and are shown inside the guides.</p>
      ${secs.map((g) => `${g.s ? `<h3 class="rr-h">${esc(g.s)}</h3>` : ""}<div class="rr-grid">${g.items.map(([d, i]) => fig(d, i)).join("")}</div>`).join("")}
    </div>
    <div data-rrp="buy" hidden>
      <div class="rr-bar">
        <input type="search" id="${id.q}" placeholder="filter: maker, model, item, spec … ${esc(c.ph)}" aria-label="filter the buy list">
        <select id="${id.g}" aria-label="group"><option value="">all groups</option>${c.groups.map((g) => `<option value="${g.id}">${esc(g.t)}</option>`).join("")}</select>
        <span class="rr-count" id="${id.cnt}"></span>
      </div>
      <div id="${id.buy}"></div>
      <p class="rr-note">${esc(NOTE)} ${esc(c.buyNote)}</p>
    </div>
    ${nShop ? `<div data-rrp="shop" hidden>
      <p class="muted" style="margin:0 0 10px;font-size:12.5px">${esc(c.shopTitle)}</p>
      ${shops.map((s) => `${s.title ? `<h3 class="rr-h">${esc(s.title)}</h3>` : ""}${tableHtml(s.cols, s.rows, s.m, s.p, s.cls, s.w)}`).join("")}
      <p class="rr-note">${esc(c.shopNote)}<br>${esc(NOTE)}${c.shopPrice ? " " + esc(c.buyNote) : ""}</p>
    </div>` : ""}`;
  wrap.appendChild(card);

  const show = (k) => {
    card.querySelectorAll(".rr-tab").forEach((b) => b.classList.toggle("on", b.dataset.rr === k));
    card.querySelectorAll("[data-rrp]").forEach((p) => { p.hidden = p.dataset.rrp !== k; });
  };
  card.querySelectorAll(".rr-tab").forEach((b) => b.addEventListener("click", () => show(b.dataset.rr)));

  const qIn = $(id.q), gSel = $(id.g), out = $(id.buy), cnt = $(id.cnt);
  function renderBuy() {
    const q = qIn.value.trim().toLowerCase(), g = gSel.value;
    const words = q.split(/\s+/).filter(Boolean);
    let k = 0, total = 0, html = "";
    for (const grp of c.groups) {
      if (g && grp.id !== g) continue;
      total += grp.rows.length;
      const rows = grp.rows.filter((r) => { const t = (grp.t + " " + r.join(" ")).toLowerCase(); return words.every((w) => t.includes(w)); });
      if (!rows.length) continue;
      k += rows.length;
      html += `<h3 class="rr-h">${esc(grp.t)}<small>${esc(grp.src)}</small></h3>${tableHtml(COLS, rows, 2, 4, "rr-buy")}`;
    }
    out.innerHTML = html || `<p class="rr-empty">No row matches "${esc(q)}".</p>`;
    cnt.textContent = `${k} of ${total} rows`;
  }
  qIn.addEventListener("input", renderBuy); gSel.addEventListener("change", renderBuy);
  if (Q.get(P + "q")) qIn.value = Q.get(P + "q");
  renderBuy();

  card.querySelectorAll("[data-rrimg]").forEach((b) => b.addEventListener("click", () => lightbox().open(c.drawings, +b.dataset.rrimg)));
  lightbox();
  const t = Q.get(P + "tab");
  if (t === "buy" || t === "draw" || (t === "shop" && nShop)) show(t);
  if (Q.has(P + "box")) lightbox().open(c.drawings, Math.max(0, (+Q.get(P + "box") || 1) - 1));
  if (Q.has(P + "scroll")) setTimeout(() => card.scrollIntoView({ block: "start" }), 300);
  return card;
}

function buildCard(n, wrap) {
  const s = CFG[n].sfx;
  return makeCard(CFG[n], wrap, { card: "rrCard" + s, q: "rrQ" + s, g: "rrG" + s, cnt: "rrCnt" + s, buy: "rrBuy" + s }, "rr");
}

/* ------------------------------------------------------------------ lazy build per item */
const observers = {};
function ensure(n) {
  const c = CFG[n], host = $(c.host);
  if (!host || host.hidden || !pane || !pane.classList.contains("active")) return;
  const wrap = host.querySelector(c.wrap) || (n === "1" && host.children.length ? host : null);
  if (!wrap) {                                     // the item's own content is not built yet → wait for it
    if (!observers[n]) {
      observers[n] = new MutationObserver(() => { if (host.querySelector(c.wrap)) { observers[n].disconnect(); observers[n] = null; ensure(n); } });
      observers[n].observe(host, { childList: true, subtree: true });
    }
    return;
  }
  if (cards[n]) { if (!host.contains(cards[n])) wrap.appendChild(cards[n]); return; }   // container was rebuilt → put the card back
  try { cards[n] = buildCard(n, wrap); } catch (e) { console.error(e); }
}
const ensureVisible = () => { for (const n of Object.keys(CFG)) ensure(n); };

// test only (&rrchk): report each card (build, images, rows, errors) while switching items 1 → 2 → 3 → 1 → 2 → 3
if (Q.has("rrchk")) {
  const errs = [];
  window.addEventListener("error", (e) => errs.push(e.message || String(e)));
  window.addEventListener("unhandledrejection", (e) => errs.push("promise: " + (e.reason && e.reason.message || e.reason)));
  const rep = (n, tag) => {
    const c = CFG[n], host = $(c.host), card = $("rrCard" + c.sfx), imgs = card ? [...card.querySelectorAll(".rr-fig img")] : [];
    console.log(`RRCHK ${tag} item${n} visible=${!host.hidden} card=${!!card} inItem=${!!(card && host.contains(card))} last=${!!(card && card.parentElement.lastElementChild === card)} imgs=${imgs.length} loaded=${imgs.filter((i) => i.complete && i.naturalWidth > 0).length} buyRows=${card ? card.querySelectorAll('[data-rrp="buy"] tbody tr').length : 0} shopRows=${card ? card.querySelectorAll('[data-rrp="shop"] tbody tr').length : 0} cnt="${card ? $("rrCnt" + c.sfx).textContent : ""}" errors=${errs.length ? errs.join(" | ") : "none"}`);
  };
  const seq = ["1", "2", "3", "1", "2", "3"];
  const step = (i) => {
    if (i >= seq.length) { console.log(`RRCHK DONE cards=${Object.keys(cards).join(",")} ids=${["rrCard", "rrCard2", "rrCard3"].map((id) => document.querySelectorAll("#" + id).length).join("/")} errors=${errs.length ? errs.join(" | ") : "none"}`); return; }
    if (i > 0 && window.rbCtl) window.rbCtl.showItem(seq[i]);
    setTimeout(() => { rep(seq[i], "step" + i); step(i + 1); }, i === 0 ? 0 : 2500);
  };
  setTimeout(() => step(0), +Q.get("rrchk") || 4000);
}

const prevTab = window.onTabShown;
window.onTabShown = (name) => { if (prevTab) prevTab(name); if (name === "robot") setTimeout(ensureVisible, 0); };
window.addEventListener("rbitemshow", (e) => { const n = String(e.detail); if (CFG[n]) setTimeout(() => ensure(n), 0); });
ensureVisible();
