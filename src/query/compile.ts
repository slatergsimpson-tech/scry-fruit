// Compiler: syntax tree -> a plain (card) => boolean function.
//
// Every search key maps to a matcher. Unknown keys and bad values don't throw;
// they produce a warning and match everything, so one typo in a long query
// narrows nothing instead of wiping out the results (Scryfall does the same).
import type { Card } from "../card.ts";
import type { Op } from "./lexer.ts";
import type { Node } from "./parser.ts";

export type Predicate = (card: Card) => boolean;
type Term = Extract<Node, { type: "term" }>;
type Matcher = (term: Term, warn: (msg: string) => void) => Predicate;

const ALL: Predicate = () => true;

export const COLORS = ["red", "green", "blue", "purple", "black", "yellow"];
const RARITY_ORDER = ["c", "uc", "r", "sr", "sec"];
const CATEGORIES = ["leader", "character", "event", "stage", "don"];

// Lowercase and fold the characters the official text uses that nobody
// types: the unicode minus in "DON!! −1", curly quotes, the ➀ cost circles.
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[➀-➉]/g, (c) => String(c.charCodeAt(0) - 0x2780 + 1));
}

// Names fold punctuation to spaces too, so "monkey d luffy" and
// "monkey.d.luffy" both find Monkey.D.Luffy.
function normalizeName(s: string): string {
  return normalize(s).replace(/[^a-z0-9]+/g, " ").trim();
}

// ---- generic matcher builders -------------------------------------------

function compare(a: number, op: Op, b: number): boolean {
  switch (op) {
    case ":":
    case "=":
      return a === b;
    case "!=":
      return a !== b;
    case "<":
      return a < b;
    case "<=":
      return a <= b;
    case ">":
      return a > b;
    case ">=":
      return a >= b;
  }
}

// "6000", "6k", "6.5k" -> number. Cards missing the stat never match, so
// `pow>=0` is a way to say "has a power value".
function numeric(get: (c: Card) => number | null): Matcher {
  return (t, warn) => {
    const m = t.value.toLowerCase().match(/^(\d+(?:\.\d+)?)(k?)$/);
    if (!m) {
      warn(`"${t.key}${t.op}${t.value}": expected a number`);
      return ALL;
    }
    const n = parseFloat(m[1]) * (m[2] ? 1000 : 1);
    return (c) => {
      const v = get(c);
      return v !== null && compare(v, t.op!, n);
    };
  };
}

// Substring search over some text; /regex/ values are honoured. `=` means
// the whole text must equal the value rather than contain it.
function text(get: (c: Card) => string[], norm = normalize): Matcher {
  return (t, warn) => {
    let test: (s: string) => boolean;
    if (t.regex) {
      try {
        const re = new RegExp(t.value, "i");
        test = (s) => re.test(s);
      } catch {
        warn(`"${t.value}" is not a valid regular expression`);
        return ALL;
      }
    } else {
      const v = norm(t.value);
      test = t.op === "=" ? (s) => norm(s) === v : (s) => norm(s).includes(v);
    }
    const pred: Predicate = (c) => get(c).some(test);
    return t.op === "!=" ? (c) => !pred(c) : pred;
  };
}

// ---- One Piece specific matchers -----------------------------------------

// Colors compare as sets, like Scryfall's c:
//   c:red / c>=red   has red (maybe more)      c=red     exactly red
//   c<=red/green     only colors from that set  c>red     red plus another
// Also accepts c:multi.
const color: Matcher = (t, warn) => {
  const v = t.value.toLowerCase();
  if (v === "multi" || v === "m") return (c) => c.colors.length > 1;
  const want = v.split(/[\/,]/).filter(Boolean);
  const bad = want.filter((w) => !COLORS.includes(w));
  if (bad.length || !want.length) {
    warn(`Unknown color "${bad.join("/") || t.value}" (try ${COLORS.join(", ")})`);
    return ALL;
  }
  const has = (c: Card, w: string) => c.colors.includes(w);
  return (c) => {
    const sup = want.every((w) => has(c, w)); // card ⊇ want
    const sub = c.colors.every((x) => want.includes(x)); // card ⊆ want
    switch (t.op!) {
      case ":":
      case ">=":
        return sup;
      case "=":
        return sup && sub;
      case "!=":
        return !(sup && sub);
      case "<=":
        return sub;
      case "<":
        return sub && !sup;
      case ">":
        return sup && !sub;
    }
  };
};

// t: is like Scryfall's type line — it matches the category (leader,
// character...) or a trait, since on a One Piece card both sit where an MTG
// type line would. cat: and trait: search just one of them.
const category: Matcher = (t, warn) => {
  const v = t.value.toLowerCase().replace("don!!", "don");
  const hit = CATEGORIES.filter((k) => k.startsWith(v));
  if (hit.length !== 1) {
    warn(`Unknown card category "${t.value}" (try ${CATEGORIES.join(", ")})`);
    return ALL;
  }
  return t.op === "!=" ? (c) => c.category !== hit[0] : (c) => c.category === hit[0];
};

const traits = text((c) => c.traits);

const typeLine: Matcher = (t, warn) => {
  const v = t.value.toLowerCase();
  if (!t.regex && CATEGORIES.some((k) => k.startsWith(v)) && v.length >= 3) {
    return category(t, warn);
  }
  return traits(t, warn);
};

// Rarity is an ordered scale for C..SEC, so r>=sr works. Leaders, promos,
// SP and TR cards sit outside the scale and only match by name (r:l, r:sp).
const rarity: Matcher = (t) => {
  const v = t.value.toLowerCase();
  const rank = RARITY_ORDER.indexOf(v);
  if (t.op === ":" || t.op === "=") return (c) => c.rarity.toLowerCase().startsWith(v);
  if (t.op === "!=") return (c) => !c.rarity.toLowerCase().startsWith(v);
  if (rank === -1) return () => false;
  return (c) => {
    const r = RARITY_ORDER.indexOf(c.rarity.toLowerCase());
    return r !== -1 && compare(r, t.op!, rank);
  };
};

// s:op01, s:op-01, s:op1, s:st10 all mean the same product.
const set: Matcher = (t) => {
  const m = t.value.toUpperCase().match(/^([A-Z]+)-?0*(\d*)$/);
  const want = m ? m[1] + (m[2] ? m[2].padStart(2, "0") : "") : t.value.toUpperCase();
  const pred: Predicate = (c) => c.set === want || c.code.startsWith(want + "-");
  return t.op === "!=" ? (c) => !pred(c) : pred;
};

// A card "has" a keyword when the keyword opens one of its effect lines,
// possibly after other bracket tags: "[Blocker]", "[DON!! x1] [Rush]".
// That skips cards that only grant it to something else ("...gains
// [Blocker]"). A heuristic, but it holds up on the real card pool.
function hasKeyword(card: Card, kw: string): boolean {
  const want = normalize(kw);
  for (const line of normalize(card.effect).split("\n")) {
    const tags = line.match(/^(\s*\[[^\]]+\])+/);
    if (!tags) continue;
    for (const tag of tags[0].matchAll(/\[([^\]]+)\]/g)) {
      if (tag[1].trim() === want) return true;
    }
  }
  return false;
}

const keyword: Matcher = (t) => {
  const pred: Predicate = (c) => hasKeyword(c, t.value);
  return t.op === "!=" ? (c) => !pred(c) : pred;
};

// is:<thing>. Keyword shortcuts plus a few card properties.
const IS: Record<string, Predicate> = {
  vanilla: (c) => c.effect === "" && c.category === "character",
  multicolor: (c) => c.colors.length > 1,
  multi: (c) => c.colors.length > 1,
  parallel: (c) => c.variant.startsWith("p"),
  alt: (c) => c.variant.startsWith("p"),
  reprint: (c) => c.variant.startsWith("r"),
  blocker: (c) => hasKeyword(c, "blocker"),
  rush: (c) => hasKeyword(c, "rush"),
  banish: (c) => hasKeyword(c, "banish"),
  doubleattack: (c) => hasKeyword(c, "double attack"),
  unblockable: (c) => hasKeyword(c, "unblockable"),
  onplay: (c) => hasKeyword(c, "on play"),
  onko: (c) => hasKeyword(c, "on k.o."),
  whenattacking: (c) => hasKeyword(c, "when attacking"),
  activatemain: (c) => hasKeyword(c, "activate: main"),
  counterevent: (c) => c.category === "event" && hasKeyword(c, "counter"),
};

const HAS: Record<string, Predicate> = {
  trigger: (c) => c.trigger !== null,
  counter: (c) => (c.counter ?? 0) > 0,
  effect: (c) => c.effect !== "",
  power: (c) => c.power !== null,
};

function flagMatcher(table: Record<string, Predicate>, key: string): Matcher {
  return (t, warn) => {
    const v = t.value.toLowerCase().replace(/[\s_-]/g, "");
    const pred = table[v];
    if (!pred) {
      warn(`Unknown ${key}:${t.value} (try ${Object.keys(table).join(", ")})`);
      return ALL;
    }
    return t.op === "!=" ? (c) => !pred(c) : pred;
  };
}

const name = text((c) => [c.name], normalizeName);

// Search keys and their aliases. Scryfall's spellings where one exists.
export const FIELDS: Record<string, Matcher> = {
  name,
  n: name,
  c: color,
  color,
  t: typeLine,
  type: typeLine,
  cat: category,
  category,
  trait: traits,
  tr: traits,
  cost: numeric((c) => c.cost),
  mv: numeric((c) => c.cost),
  cv: numeric((c) => c.cost),
  pow: numeric((c) => c.power),
  power: numeric((c) => c.power),
  counter: numeric((c) => c.counter),
  ctr: numeric((c) => c.counter),
  life: numeric((c) => c.life),
  o: text((c) => [c.effect, c.trigger ?? ""]),
  oracle: text((c) => [c.effect, c.trigger ?? ""]),
  effect: text((c) => [c.effect]),
  trigger: text((c) => (c.trigger ? [c.trigger] : [])),
  a: text((c) => c.attributes),
  attr: text((c) => c.attributes),
  attribute: text((c) => c.attributes),
  r: rarity,
  rarity,
  s: set,
  set,
  e: set,
  b: numeric((c) => num(c.block)),
  block: numeric((c) => num(c.block)),
  kw: keyword,
  keyword,
  is: flagMatcher(IS, "is"),
  has: flagMatcher(HAS, "has"),
  id: text((c) => [c.code]),
  number: text((c) => [c.code]),
};

function num(s: string): number | null {
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

export function compile(node: Node | null, warn: (msg: string) => void): Predicate {
  if (!node) return ALL;
  switch (node.type) {
    case "and": {
      const preds = node.children.map((n) => compile(n, warn));
      return (c) => preds.every((p) => p(c));
    }
    case "or": {
      const preds = node.children.map((n) => compile(n, warn));
      return (c) => preds.some((p) => p(c));
    }
    case "not": {
      const p = compile(node.child, warn);
      return (c) => !p(c);
    }
    case "term": {
      // Bare word: a name search, or a card number like OP01-001.
      if (node.key === null) {
        if (/^[a-z]+\d+-\d+/i.test(node.value)) {
          const v = node.value.toUpperCase();
          return (c) => c.id.startsWith(v);
        }
        return name({ ...node, op: ":" }, warn);
      }
      const matcher = FIELDS[node.key];
      if (!matcher) {
        warn(`Unknown search key "${node.key}" — ignored`);
        return ALL;
      }
      return matcher(node, warn);
    }
  }
}
