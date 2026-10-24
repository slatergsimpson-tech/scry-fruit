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
