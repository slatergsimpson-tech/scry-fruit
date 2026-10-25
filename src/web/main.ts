// The app shell: loads the cards once, then draws one of three views based on
// the URL. Everything lives in the URL (?q=, ?card=, ?syntax) so every view is
// linkable and the back button works.
import type { Card } from "../card.ts";
import { search } from "../query/index.ts";
import { cardPage, esc, IMAGE_BASE, resultTile, searchHref } from "./render.ts";
import { syntaxPage } from "./syntax.ts";

const app = document.getElementById("app")!;
const input = document.getElementById("q") as HTMLInputElement;
const form = document.getElementById("search-form") as HTMLFormElement;

const PAGE = 60; // tiles drawn at a time; "Show more" adds another page
type Order = "set" | "name" | "cost" | "power";
type Mode = "images" | "text";

let cards: Card[] = [];
const byId = new Map<string, Card>();
const byCode = new Map<string, Card[]>();

// ---- sorting ----------------------------------------------------------------

const SORTS: Record<Order, (a: Card, b: Card) => number> = {
  set: (a, b) => a.id.localeCompare(b.id),
  name: (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  cost: (a, b) => (a.cost ?? a.life ?? -1) - (b.cost ?? b.life ?? -1) || a.id.localeCompare(b.id),
  power: (a, b) => (b.power ?? -1) - (a.power ?? -1) || a.id.localeCompare(b.id),
};

// ---- views ------------------------------------------------------------------

const EXAMPLES = [
  ["c:red t:character cost<=3 is:rush", "Cheap red Rush characters"],
  ['trait:"straw hat" t:leader', "Straw Hat leaders"],
  ['is:counterevent o:"+4000"', "Big counter events"],
  ["c:purple o:\"don!! -\" pow>=7k", "Purple DON!! minus beaters"],
  ["has:trigger t:character c:yellow cost<=2", "Cheap yellow triggers"],
  ["is:vanilla pow>=6k", "Vanilla bodies"],
  ["is:rotating t:leader", "Leaders leaving Standard next April"],
  ["banned:extra or is:bannedpair", "The ban list"],
];

function homeView(): string {
  const unique = byCode.size;
  return `
    <section class="home">
      <h1>Scry Fruit</h1>
      <p class="lede">Search all ${unique.toLocaleString()} One Piece cards with
        <a href="?syntax" data-nav>Scryfall-style syntax</a>.</p>
      <ul class="examples-list">
        ${EXAMPLES.map(([q, what]) => `<li><a href="${searchHref(q)}" data-nav><code>${esc(q)}</code></a><span>${esc(what)}</span></li>`).join("")}
      </ul>
    </section>`;
}

function resultsView(q: string, order: Order, mode: Mode, limit: number): string {
  const started = performance.now();
  const { cards: hits, warnings } = search(cards, q);
  const ms = performance.now() - started;
  hits.sort(SORTS[order]);

  const shown = hits.slice(0, limit);
  const option = (v: string, label: string, cur: string) =>
    `<option value="${v}"${v === cur ? " selected" : ""}>${label}</option>`;

  return `
    <div class="bar">
      <p class="count">${hits.length.toLocaleString()} card${hits.length === 1 ? "" : "s"}
        <span class="muted">· ${ms.toFixed(0)} ms</span></p>
      <label>Sort
        <select id="order">
          ${option("set", "Set number", order)}${option("name", "Name", order)}${option("cost", "Cost", order)}${option("power", "Power", order)}
        </select>
      </label>
      ${IMAGE_BASE ? `<label>Show <select id="mode">${option("images", "Images", mode)}${option("text", "Text", mode)}</select></label>` : ""}
    </div>
    ${warnings.map((w) => `<p class="warn">${esc(w)}</p>`).join("")}
    ${hits.length === 0 ? `<p class="empty">No cards match. <a href="?syntax" data-nav>Check the syntax</a>.</p>` : ""}
    <div class="grid ${mode}">${shown.map((c) => resultTile(c, mode)).join("")}</div>
    ${hits.length > limit ? `<button class="more" id="more">Show more (${(hits.length - limit).toLocaleString()} left)</button>` : ""}`;
}

// ---- routing ----------------------------------------------------------------

let limit = PAGE;

function render() {
  const params = new URLSearchParams(location.search);
  const q = params.get("q") ?? "";
  const id = params.get("card");
  // Card and syntax pages keep whatever was last searched in the box, so you
  // can tweak the query you came from, like Scryfall does.
  const isSearchView = !id && !params.has("syntax");
  if (isSearchView && document.activeElement !== input) input.value = q;

  if (id) {
    const card = byId.get(id);
    if (!card) {
      app.innerHTML = `<p class="empty">No card ${esc(id)}.</p>`;
      document.title = "Not found · Scry Fruit";
      return;
    }
    const nameOf = (code: string) => byCode.get(code)?.[0].name ?? code;
    app.innerHTML = cardPage(card, byCode.get(card.code) ?? [card], new Date(), nameOf);
    document.title = `${card.name} (${card.id}) · Scry Fruit`;
    window.scrollTo(0, 0);
  } else if (params.has("syntax")) {
    app.innerHTML = syntaxPage();
    document.title = "Syntax · Scry Fruit";
  } else if (q.trim()) {
    const order = (params.get("order") as Order) || "set";
    const mode: Mode = IMAGE_BASE && params.get("as") !== "text" ? "images" : "text";
    app.innerHTML = resultsView(q, SORTS[order] ? order : "set", mode, limit);
    document.title = `${q} · Scry Fruit`;
  } else {
    app.innerHTML = homeView();
    document.title = "Scry Fruit";
  }
}

// push: a new history entry (clicking a link). replace: update in place
// (typing, so every keystroke doesn't become a back-button stop).
function go(url: string, how: "push" | "replace" = "push") {
  limit = PAGE;
  history[how === "push" ? "pushState" : "replaceState"](null, "", url);
  render();
}

function setParam(key: string, value: string) {
  const params = new URLSearchParams(location.search);
  params.set(key, value);
  go(`?${params}`, "replace");
}

// ---- events -------------------------------------------------------------------

// Links marked data-nav are handled here instead of reloading the page.
document.addEventListener("click", (e) => {
  const a = (e.target as Element).closest("a[data-nav]") as HTMLAnchorElement | null;
  if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  go(a.getAttribute("href") ?? "./");
  if (a.closest("#app") && !a.href.includes("card=")) input.focus();
});

window.addEventListener("popstate", () => {
  limit = PAGE;
  render();
});

// Search as you type, a beat after the last keystroke.
let timer: number | undefined;
input.addEventListener("input", () => {
  clearTimeout(timer);
  timer = window.setTimeout(() => {
    const params = new URLSearchParams(location.search);
    params.delete("card");
    params.delete("syntax");
    if (input.value.trim()) params.set("q", input.value);
    else params.delete("q");
    const onResults = new URLSearchParams(location.search).has("q");
    go(params.size ? `?${params}` : "./", onResults ? "replace" : "push");
  }, 120);
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  input.blur(); // closes the keyboard on a phone
});

app.addEventListener("change", (e) => {
  const el = e.target as HTMLSelectElement;
  if (el.id === "order") setParam("order", el.value);
  if (el.id === "mode") setParam("as", el.value);
});

app.addEventListener("click", (e) => {
  if ((e.target as Element).id !== "more") return;
  const y = window.scrollY;
  limit += PAGE;
  render();
  window.scrollTo(0, y);
});

// When a scan fails to load, swap in the text card stashed beside it.
// ("error" doesn't bubble, so listen in the capture phase.)
document.addEventListener(
  "error",
  (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    const face = img.closest(".face");
    const tpl = face?.querySelector("template");
    if (face && tpl) face.replaceWith(tpl.content.cloneNode(true));
  },
  true,
);

// "/" focuses the search box, like Scryfall and GitHub.
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement !== input) {
    e.preventDefault();
    input.focus();
    input.select();
  }
});

// ---- boot -----------------------------------------------------------------------

app.innerHTML = `<p class="muted loading">Loading cards…</p>`;
const res = await fetch(`${import.meta.env.BASE_URL}cards.json`);
cards = await res.json();
for (const c of cards) {
  byId.set(c.id, c);
  const list = byCode.get(c.code);
  if (list) list.push(c);
  else byCode.set(c.code, [c]);
}
render();
if (!new URLSearchParams(location.search).has("card")) input.focus();
