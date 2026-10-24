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
