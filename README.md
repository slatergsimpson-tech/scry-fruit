# optcg-search

Scryfall-style search for the One Piece Card Game: type a query like

```
c:purple t:character cost<=4 (is:blocker or o:"don!! -1") -trait:donquixote
```

and get every card that matches.

The whole card pool is ~4,900 printings, small enough to search in memory in
a few milliseconds, so there's no server or database: one JSON file and a
query engine. Card data comes from the official English card list at
en.onepiece-cardgame.com.

Unofficial fan project. Card text and images belong to Bandai.

## Usage

Needs Node 24+ (it runs the TypeScript directly; there is no build step).

```bash
npm install
npm run scrape                  # refresh data/cards.json (cached in .cache/; --fresh to refetch)
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
| `b` `block` | rotation block | `b>=3` |
| `kw` `keyword` | a bracket keyword the card has | `kw:"when attacking"` |
| `is` | shortcuts | `is:blocker` `is:rush` `is:banish` `is:doubleattack` `is:onplay` `is:onko` `is:whenattacking` `is:activatemain` `is:counterevent` `is:vanilla` `is:multicolor` `is:parallel` `is:reprint` |
| `has` | presence | `has:trigger` `has:counter` |

Operators: `:` `=` `!=` `<` `<=` `>` `>=`. Text matches are case-insensitive
substrings; `=` means the whole value; `/.../` is a regular expression.

Mistakes don't empty the results: an unknown key or value is reported as a
warning and ignored, like on Scryfall.

## Layout

```
scripts/scrape.ts       official site -> data/cards.json
scripts/search.ts       terminal search
src/card.ts             the Card type: the contract between the two halves
src/query/lexer.ts      query string -> tokens
src/query/parser.ts     tokens -> syntax tree (recursive descent)
src/query/compile.ts    syntax tree -> (card) => boolean; every search key lives here
src/query/index.ts      search(cards, query)
docs/build-log.md       what was built, what broke, and why
```
