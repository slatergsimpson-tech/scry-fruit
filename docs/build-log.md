# Build log

## 2026-10-24 — Milestone 1: data pipeline + query engine

**Goal:** prove the core idea in the terminal before any UI. Scrape every card
from the official site, and search it with Scryfall-style syntax.

### Decisions

- **No backend.** ~4,900 printings is a 3.5 MB JSON file (much less gzipped).
  A linear scan over every card takes 1–8 ms per query, so the finished site
  can be fully static and free to host. Scryfall needs servers for 90k+ cards;
  this doesn't.
- **Official site as the data source** over community APIs: more accurate,
  and no dependency on someone else's upkeep. The cost is that a site
  redesign breaks the scraper.
- **Polite scraping.** The site has no robots.txt. The scraper still waits
  1 s between requests (~65 total) and caches every page in `.cache/`, so
  developing against the data doesn't re-hit their server.
- **Node 24 runs TypeScript directly** (type stripping). No build step; the
  test runner is Node's built-in `node:test`. One runtime dependency
  (`cheerio`, an HTML parser), sturdier than regexes over HTML.
- **Three-stage query engine**: lexer → parser → compiler. The parser is
  recursive descent, one function per precedence level, so `a b or c` means
  `(a AND b) OR c`, same as Scryfall.
- **Forgiving, like Scryfall.** Unknown keys, bad values, unclosed quotes and
  stray parens produce warnings, never errors, and the bad term is ignored
  rather than emptying the results.
- **`t:` matches category or trait**, since on a One Piece card both sit where
  Magic's type line would. `cat:` and `trait:` search just one.
- **Keywords are a heuristic**: a card "has" [Blocker] only if the keyword
  opens a line of its effect, so a card that merely *grants* Blocker
  ("this Character gains [Blocker]") doesn't count.

### What broke

- **Events got `attributes: [""]`** instead of `[]`. The attribute box
  exists but is empty. Filtered blanks out.
- **271 characters had no power.** They were 0-power cards (Shirahoshi,
  Viola, Hiyori…); the site prints `-` instead of 0. Now stored as 0 for
  characters, and "no counter" as `counter: 0`, so `pow:0` and `counter:0`
  are useful searches. Events and stages keep `null`.
- **Duplicate results for reprints.** The fixtures only knew `_p1`
  (parallel art) ids, but the real data also has `_r1` (412 reprints). Those
  didn't collapse onto their card. Unique card count went from a wrong 3,262
  to 2,850 after the fix. Lesson: hand-made test data only covers the cases
  you already thought of; run against real data early.
- Two of my own tests were wrong (a typo, and using bare `rush`, which is a
  *name* search, where `is:rush` was meant).

### Status

22 tests passing, typecheck clean. `npm run search -- '<query>'` works over
the full card pool.

### Next

Milestone 2: the web UI — search box, image grid, card pages, the query in
the URL so searches are shareable, and a syntax help page.

### What I'd say in an interview

"I built a search engine for a trading card game. The data pipeline scrapes
the publisher's site politely, with caching and rate limiting, into a typed
JSON dataset, and I validated it against the real data, which caught three
bugs my unit-test fixtures couldn't. The query language is a hand-written
lexer and recursive-descent parser that compiles to predicate functions.
Because the dataset is small, I deliberately chose an in-memory linear scan
over a database: it answers in milliseconds and lets the whole site be static."

## 2026-10-24 — Milestone 2: the website

**Goal:** the search engine in a browser: search box, results, card pages,
syntax help, shareable URLs.

### Decisions

- **Vite** for the dev server and production build. The whole site is 7 KB
  of JavaScript plus 227 KB of gzipped card data, with no framework.
- **All state in the URL**: `?q=…&order=…`, `?card=OP01-001`, `?syntax`.
  Every view is linkable, and the back button works. Typing replaces the
  current history entry instead of adding one per keystroke; clicking a link
  pushes a new one.
- **Search as you type** with a 120 ms pause, which is affordable because a
  search takes single-digit milliseconds.
- **Escaping everything** from the card data before it goes into HTML, so a
  `<` in card text can never become markup.

### What broke

- **Card images can't be hotlinked.** Bandai's image server sends
  `Cross-Origin-Resource-Policy: same-site`, and Chrome refuses to show the
  images on any other site (`ERR_BLOCKED_BY_RESPONSE.NotSameSite`). curl
  fetched them fine, which is why it only showed up in a real browser. For
  now cards are drawn from their text, and image support sits behind one
  constant (`IMAGE_BASE`) for when there's somewhere to serve them from.
- **Holes in the results grid.** Each tile is a link, and I'd also made the
  `{Trait}` references inside card text into links. A link inside a link is
  invalid HTML, so the browser closed the outer one early and spilled the
  rest of the card into the grid as stray items. Trait links now only appear
  on the card page, where they aren't nested.
- **`<=` showed as `≤`** in the search box: the monospace font joins those
  characters into one symbol (a ligature). Turned ligatures off where
  people read or type syntax.
- **A stale preview**: two edits to one file landed milliseconds apart and
  the dev server's file watcher only noticed the first. Touching the file
  fixed it. Worth remembering before debugging code that is actually right.

### Status

Search, sorting, card pages (with every printing, and every stat linking to
a search for it), and the syntax page all work on desktop and at phone width.
22 tests passing, typecheck clean, production build works.

### Next

- **Card images**: needs a decision on where to serve them from.

## 2026-10-24 — Deployed to GitHub Pages

Live at https://slatergsimpson-tech.github.io/scry-fruit/.

A GitHub Actions workflow (`.github/workflows/deploy.yml`) runs the typecheck
and tests, builds, and publishes `dist/` on every push to main, about a
minute end to end. Before the first push I served the production build under
`/scry-fruit/` locally, because sites that assume they live at a domain root
break on Pages.

### What broke

- **Two deploy systems raced.** The first deploy succeeded, but the live
  site was the raw, unbuilt `index.html`. The run list showed why: GitHub's
  older "pages build and deployment" (branch mode, which publishes the repo
  files as-is) ran on the same push and finished 6 s after our workflow,
  overwriting it. That builder only runs when Settings → Pages → Source is
  "Deploy from a branch". Switching Source to "GitHub Actions" fixed it, and
  the next push ran only our workflow. Lesson: a green check means the
  workflow succeeded, not that the right thing is live. Load the live site.

### What I'd say in an interview

"The front end is a small single-page app with no framework, and all state
lives in the URL, so every search is shareable. The interesting bug was
cross-origin: the publisher's image server sends a resource policy that
browsers enforce but command-line tools ignore, so it only appeared in a
real browser. I made images an optional layer, so the site still works fully
without them."

## 2026-10-24 — Rotation, legality and weekly refresh

**Goal:** search by format (`legal:standard`, `banned:extra`, `is:rotating`),
show legality on every card, and keep the data current without anyone
running the scraper.

### What the official rules say (and where)

The comprehensive rules only say the block icon "does not affect gameplay";
legality lives in three separate pages on Bandai's site:

- *Introduction of the Block Number System*: seasons run April–March.
  2026–27 Standard is blocks ②–⑤ and 2027–28 is ③–⑥. Block X is always legal.
  Extra allows every block. Legality is per card **number**: a reprint with a
  newer block makes every older printing legal too.
- *Block Number updates*: 37 cards are "generally permitted" (treated as X)
  and 15 are "treated as ④" no matter which printing.
- *Banned/Restricted list*: 6 banned, 0 restricted (the category exists),
  3 banned pairs (A and B can't share a deck). It applies to both formats.

Blog posts disagreed with each other (three blocks or four?). The official
pages settled it, which is why the scraper reads them directly.

### Decisions

- **Each card number gets a `legalBlock`** at scrape time: the override list
  if the card is on it, else the newest block across its printings, and never
  lower than its booster pack implies.
- **Standard is computed in the browser from today's date**, not baked in at
  scrape time. The site rotates on April 1 by itself, and the tests pin the
  date so they don't start failing next April.
- **`b:` searches the rotation block**, not the icon on one printing, because
  that's what decides legality. The card page shows both when they differ.
- **`legal:` excludes restricted cards**, like Scryfall, and a rotated-out
  banned card counts as "not legal" in Standard, not "banned".
- **The parsers fail loudly.** If the ban list or block update page parses to
  nothing, the scrape throws, so a layout change on Bandai's side fails the
  weekly job instead of publishing a site where everything looks legal.
- **Weekly refresh calls the deploy workflow directly.** A commit pushed with
  a workflow's own token doesn't trigger other workflows (by design: it stops
  them setting each other off in a loop), so `deploy.yml` became reusable
  (`workflow_call`) and takes the commit to build as an input.

### What broke

- **Bandai's card list says OP-05 is block 1** for 91 cards, against its own
  rule that packs 5–8 are block 2. Limitless lists them as block 2 and
  Standard-legal. If we'd trusted the printed number, 91 legal cards would
  have shown as rotated out. The rotation block now never drops below the
  pack's block.
- I miscounted the block ④ list (16, from two overlapping printouts). The
  parser's 15 was right; I checked the page it saw before "fixing" anything.

### What I'd say in an interview

"Format legality looked like a lookup and turned out to be a small rules
engine. Legality belongs to the card number, not the printing; the publisher
overrides some blocks; their own data has an error in one set; and the
format changes every April. I split it into data that's scraped weekly by a
scheduled job, and a pure function of the card and the date that runs in the
browser. Pinning the date in tests is what keeps that function honest."

## 2026-10-27 — Card images

**Goal:** show real card images, kept current by the weekly refresh.

### Decisions

- **Self-hosted, on an orphan `images` branch.** Bandai's server blocks
  hotlinking, so the options were self-hosting or a Cloudflare proxy that
  strips Bandai's header on every view. The branch needs no new accounts or
  secrets, the refresh can push to it with its own token, and `main`'s
  history stays small. An orphan branch shares no history with `main`.
- **360 px WebP at quality 78**, measured on real cards first: full size
  would be 690 MB, 480 px 395 MB, 360 px 231 MB. Grid tiles are ~190 px, so
  360 px is still sharp on a 2× screen, and the card page shows the full
  text beside the image anyway.
- **Only missing images are fetched**, at one per second. The first fill is
  ~4,900 downloads (~100 min); after that a week means a few dozen.
- **Batches of 500, pushed one at a time.** As first written, the whole
  100-minute fill would only have been committed at the end, so a timeout at
  minute 95 would have thrown away everything. Now a run that dies keeps its
  progress and the next one carries on.
- **Images are optional.** A missing image falls back to the text card, so
  the site works during the first fill, in local development without
  images, and if a download fails.

### What broke

- **Images filled only half their tile.** Each image's wrapper had the class
  `grid` ("grid-size image"), which is also the results grid's class, so
  every wrapper became a two-column grid of its own. Renamed to `face-grid`
  and `face-large`. Generic class names collide.

### The first fill

The refresh ran itself on the push that changed it: 10 batches (9 × 500 and
one of 410), about 95 minutes, 4,910 images. Every printing in `cards.json`
has one. The card data hadn't changed, so the redeploy came only from new
images. That's the first real run of the refresh → commit → deploy path,
which until now had only ever taken the "nothing changed" branch.

### Noticed

- Bandai's images are all stamped **SAMPLE**, so ours are too.
- The OP05-119 image shows block icon ② in its corner, while Bandai's
  card-list data says 1. That confirms last session's OP-05 fix from the
  printed card itself.

### What I'd say in an interview

"The publisher's image server blocks other sites from embedding its images,
so I self-host shrunk copies. I measured three sizes on real cards before
picking one, stored them on a separate orphan branch so the code repo stays
light, and made the weekly job fetch only new images in resumable batches. The
site treats images as an enhancement: anything missing falls back to a text
rendering of the card."
