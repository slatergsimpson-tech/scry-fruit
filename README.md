# Scry Fruit

Scryfall-style search for the One Piece Card Game: type a query like

```
c:purple t:character cost<=4 (is:blocker or o:"don!! -1") -trait:donquixote
```

and get every card that matches.

**Live at https://slatergsimpson-tech.github.io/scry-fruit/**

The whole card pool is ~4,900 printings, small enough to search in memory in
a few milliseconds, so there's no server or database: one JSON file and a
query engine. Card data comes from the official English card list at
en.onepiece-cardgame.com.

Unofficial fan project. Card text and images belong to Bandai.

## Usage

Needs Node 24+ (scripts and tests run the TypeScript directly; Vite bundles
the website).

```bash
npm install
npm run dev                     # the website, at http://localhost:5173
npm run build                   # static site in dist/, deployable anywhere
npm run scrape                  # refresh public/cards.json (cached in .cache/; --fresh to refetch)
npm test
npm run search -- 'c:red is:rush cost<=3'
npm run search -- --prints 'luffy is:parallel'   # every printing, not one per card
```

## Syntax

Terms next to each other must all match. `or` gives alternatives, `-` negates,
and parentheses group. A word with no key searches card names.

| Key | Searches | Examples |
|---|---|---|
| *(none)* | name, or card number | `luffy`, `"tony tony"`, `op01-001` |
| `c` `color` | colors, compared as sets | `c:red`, `c=red/green`, `c<=red/green`, `c:multi` |
| `t` `type` | category **or** trait | `t:leader`, `t:event`, `t:animal` |
| `cat` | category only | `cat:stage` |
| `trait` `tr` | traits | `trait:"straw hat"` |
| `cost` `mv` | cost | `cost<=3` |
| `pow` `power` | power (`k` = thousand) | `pow>=6k`, `pow:0` |
| `counter` `ctr` | counter value (0 = none) | `counter:2000`, `counter:0` |
| `life` | leader life | `life:4` |
| `o` `oracle` | effect + trigger text | `o:"on play"`, `o:/draw \d cards?/` |
| `effect` / `trigger` | just one of them | `trigger:"k.o."` |
| `a` `attr` | attribute | `a:slash` |
| `r` `rarity` | rarity; C < UC < R < SR < SEC | `r:sec`, `r>=sr`, `r:l` |
| `s` `set` | product | `s:op05`, `s:op-5`, `s:st10`, `s:eb01` |
| `b` `block` | rotation block of the card number (X beats any number) | `b:2`, `b>=4`, `b:x` |
| `legal` `f` | legal in a format: `standard` or `extra` | `legal:standard`, `-f:std t:leader` |
| `banned` `restricted` | on the official ban list | `banned:extra` |
| `kw` `keyword` | a bracket keyword the card has | `kw:"when attacking"` |
| `is` | shortcuts | `is:blocker` `is:rush` `is:banish` `is:doubleattack` `is:onplay` `is:onko` `is:whenattacking` `is:activatemain` `is:counterevent` `is:vanilla` `is:multicolor` `is:parallel` `is:reprint` `is:rotating` `is:banned` `is:bannedpair` |
| `has` | presence | `has:trigger` `has:counter` |

Operators: `:` `=` `!=` `<` `<=` `>` `>=`. Text matches are case-insensitive
substrings; `=` means the whole value; `/.../` is a regular expression.

Mistakes don't empty the results: an unknown key or value is reported as a
warning and ignored, like on Scryfall.

## Formats and rotation

Standard uses Bandai's block numbers. Seasons run April 1 – March 31; in
2026–27 blocks 2 and up are legal, and each April 1 the oldest block drops out.
Block X is always legal. Extra allows everything. The ban list applies to both.

Legality is per card *number*: a reprint with a newer block, or a card on
Bandai's [block update list](https://en.onepiece-cardgame.com/rules/blockicon-card/),
makes every printing of it count. Standard is worked out from today's date in
the browser, so the site rotates on April 1 without a redeploy.

A GitHub Action (`.github/workflows/refresh.yml`) re-scrapes cards, the ban
list and block updates every Monday, and redeploys if anything changed.

## Card images

Bandai's image server won't let other sites show its images (it sends
`Cross-Origin-Resource-Policy: same-site`), so Scry Fruit serves its own
copies: 360 px WebP, about 50 KB each, ~230 MB in all. They live on the
orphan `images` branch, not `main`, so cloning the code stays light
(`git clone --single-branch` skips them entirely).

`scripts/images.ts` downloads only images that aren't stored yet, one a
second. The weekly refresh runs it in batches of 500 and pushes each batch;
the deploy copies the branch into the site's `img/`. A card whose image isn't
there yet is drawn from its text instead. Locally, `npm run images -- --max 60`
fills `public/img/` (gitignored) with a few to develop against.

## Layout

```
scripts/scrape.ts       official site -> public/cards.json
scripts/legality.ts     parses the ban list and block updates; works out each card's rotation block
scripts/images.ts       downloads missing card images as 360 px WebP
scripts/search.ts       terminal search
src/card.ts             the Card type: the contract between the two halves
src/formats.ts          Standard/Extra legality and the season calendar
src/query/lexer.ts      query string -> tokens
src/query/parser.ts     tokens -> syntax tree (recursive descent)
src/query/compile.ts    syntax tree -> (card) => boolean; every search key lives here
src/query/index.ts      search(cards, query)
src/web/main.ts         the website: loads cards, routes ?q= / ?card= / ?syntax
src/web/render.ts       HTML for results, text cards and card pages
src/web/syntax.ts       the syntax help page
public/cards.json       the card data, served as-is
docs/build-log.md       what was built, what broke, and why
```
