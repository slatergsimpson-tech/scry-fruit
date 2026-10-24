// The public search API: query string in, matching cards out.
import type { Card } from "../card.ts";
import { compile } from "./compile.ts";
import { parse } from "./parser.ts";

export type SearchOptions = {
  // false (default): one result per card, its first matching printing.
  // true: every matching printing, alt arts included (Scryfall's unique:prints).
  prints?: boolean;
};

export type SearchResult = { cards: Card[]; warnings: string[] };

export function search(cards: Card[], query: string, opts: SearchOptions = {}): SearchResult {
  const { ast, warnings } = parse(query);
  const matches = compile(ast, (msg) => warnings.push(msg));
  const hits = cards.filter(matches);
  if (opts.prints) return { cards: hits, warnings };

  const seen = new Set<string>();
  const unique = hits.filter((c) => !seen.has(c.code) && seen.add(c.code));
  return { cards: unique, warnings };
}

export { parse } from "./parser.ts";
export { tokenize } from "./lexer.ts";
