// Parses Bandai's two legality pages and works out each card number's
// rotation block. Used by scrape.ts.
import * as cheerio from "cheerio";
import type { Card } from "../src/card.ts";

const CODE = /\b(?:OP|ST|EB|PRB|P)\d*-\d{3}\b/g;
const codesIn = (s: string) => [...new Set(s.match(CODE) ?? [])];

export type BanList = {
  banned: string[];
  restricted: string[];
  pairs: [string, string][];
};

// /news/restriction.html. Under the "Cards with Active Restrictions" heading,
// each <h4> names a category and is followed by <ul> lists of cards. In the
// banned-pair category, every <ul> holds exactly one pair.
export function parseBanList(html: string): BanList {
  const $ = cheerio.load(html);
  const heading = $("h3").filter((_, el) => /active restrictions/i.test($(el).text())).first();
  if (!heading.length) throw new Error('Ban list page: no "Cards with Active Restrictions" heading');

  const list: BanList = { banned: [], restricted: [], pairs: [] };
  let category = "";
  heading
    .closest(".row")
    .find("h4, ul")
    .each((_, el) => {
      if (el.tagName === "h4") {
        category = $(el).text().toLowerCase();
        return;
      }
      const codes = codesIn($(el).text());
      if (category.includes("pair")) {
        if (codes.length === 2) list.pairs.push([codes[0], codes[1]]);
        else throw new Error(`Ban list page: a banned pair with ${codes.length} cards: ${codes}`);
      } else if (category.includes("banned")) list.banned.push(...codes);
      else if (category.includes("restricted")) list.restricted.push(...codes);
    });

  // Fail loudly rather than publish a site where everything is legal.
  if (list.banned.length === 0) throw new Error("Ban list page: parsed no banned cards — has the layout changed?");
  return list;
}

export type BlockOverrides = Map<string, string>; // code -> "X" or "4"...

// /rules/blockicon-card/. Each heading introduces a list of card numbers:
//   "Cards Generally Permitted in Standard Regulation"  -> treat as block X
//   "Cards Eligible for Use Under Block Number ④"      -> treat as block 4
//   "Updated Block Number and cards that have been reprinted" -> no override:
//     the reprint itself carries the newer block, and legalBlock() takes the
//     highest block across printings.
export function parseBlockOverrides(html: string): BlockOverrides {
  const $ = cheerio.load(html);
  const overrides: BlockOverrides = new Map();
  let target: string | null = null;
  let sections = 0;

  $("main")
    .find("h2, h3, h4, h5, li, p")
    .each((_, el) => {
      const text = $(el).text();
      if (/^h\d$/.test(el.tagName)) {
        const circled = text.match(/[①-⑳]/);
        if (/generally permitted/i.test(text)) target = "X";
        else if (circled) target = String(circled[0].charCodeAt(0) - 0x2460 + 1);
        else target = null;
        if (target) sections++;
        return;
      }
      if (target) for (const code of codesIn(text)) overrides.set(code, target);
    });

  if (sections < 2 || overrides.size === 0) {
    throw new Error(`Block override page: found ${sections} sections, ${overrides.size} cards — has the layout changed?`);
  }
  return overrides;
}

// Booster packs 1–4 are block 1, 5–8 block 2, and so on.
function packBlock(code: string): number {
  const m = code.match(/^OP(\d+)-/);
  return m ? Math.ceil(parseInt(m[1], 10) / 4) : 0;
}

// The block a card number counts as for rotation:
//   1. Bandai's override list, if the card is on it.
//   2. Otherwise the highest block printed on any of its printings, since a
//      reprint with a newer block makes every printing legal. "X" beats all.
//   3. Never lower than its booster pack implies. Bandai's card list shows
//      block 1 for 91 OP-05 cards, against its own rule that packs 5–8 are
//      block 2 (Limitless and players treat them as block 2).
export function legalBlock(code: string, printings: Card[], overrides: BlockOverrides): string {
  const override = overrides.get(code);
  if (override) return override;
  if (printings.some((p) => p.block === "X")) return "X";
  const printed = printings.map((p) => parseInt(p.block, 10)).filter((n) => !Number.isNaN(n));
  const best = Math.max(packBlock(code), ...printed);
  return best > 0 ? String(best) : "";
}
