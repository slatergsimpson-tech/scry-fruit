// The syntax help view. Every example is a live link to that search.
import { esc, searchHref } from "./render.ts";

type Entry = { keys: string; what: string; examples: string[] };

const ENTRIES: Entry[] = [
  { keys: "", what: "Card name, or a card number", examples: ["luffy", '"tony tony"', "op01-001"] },
  { keys: "c color", what: "Colors, compared as sets. c: means includes, c= means exactly, c<= means only these.", examples: ["c:red", "c=red/green", "c<=blue/purple", "c:multi"] },
  { keys: "t type", what: "Category or trait — both sit where Magic's type line would", examples: ["t:leader", "t:event", "t:animal"] },
  { keys: "cat", what: "Category only", examples: ["cat:stage"] },
  { keys: "trait tr", what: "Traits", examples: ['trait:"straw hat"', "trait:navy"] },
  { keys: "cost mv", what: "Cost", examples: ["cost<=2", "cost=10"] },
  { keys: "pow power", what: "Power; k means thousand", examples: ["pow>=7k", "pow:0"] },
  { keys: "counter ctr", what: "Counter value; 0 means none", examples: ["counter:2000", "counter:0 t:character"] },
  { keys: "life", what: "Leader life", examples: ["life:3"] },
  { keys: "o oracle", what: "Effect and trigger text. /slashes/ for a regular expression.", examples: ['o:"draw 2"', 'o:"don!! -2"', "o:/k\\.o\\. up to \\d/"] },
  { keys: "effect trigger", what: "Just the effect, or just the trigger", examples: ['trigger:"play this card"'] },
  { keys: "a attr", what: "Attribute", examples: ["a:slash", "a:wisdom"] },
  { keys: "r rarity", what: "Rarity; ordered C < UC < R < SR < SEC", examples: ["r:sec", "r>=sr", "r:l"] },
  { keys: "s set", what: "Product; loose spellings work", examples: ["s:op05", "s:op-5", "s:st10", "s:eb01"] },
  {
    keys: "b block",
    what: "Rotation block of the card number — after reprints and Bandai's block updates, so it can differ from the icon on an old printing. X counts as newer than any number.",
    examples: ["b:2", "b>=4", "b:x"],
  },
  { keys: "legal f format", what: "Legal in a format: standard or extra", examples: ["legal:standard", "f:extra", "-legal:standard t:leader"] },
  { keys: "banned restricted", what: "On the official ban list (it applies to both formats)", examples: ["banned:extra", "restricted:standard"] },
  { keys: "kw keyword", what: "A bracket keyword the card has itself (not one it gives away)", examples: ['kw:"when attacking"', 'kw:"on k.o."'] },
  {
    keys: "is",
    what: "Shortcuts",
    examples: ["is:blocker", "is:rush", "is:banish", "is:doubleattack", "is:onplay", "is:onko", "is:activatemain", "is:counterevent", "is:vanilla", "is:multicolor", "is:parallel", "is:reprint", "is:rotating", "is:banned", "is:bannedpair"],
  },
  { keys: "has", what: "Has a thing at all", examples: ["has:trigger", "has:counter"] },
];

const COMBINING = [
  ["c:red t:leader", "Terms next to each other must all match"],
  ["is:rush or is:banish", "or gives alternatives"],
  ["luffy -c:red", "A minus sign excludes"],
  ["c:purple (is:blocker or o:\"don!! -1\") cost<=4", "Parentheses group"],
];

const link = (q: string) => `<a href="${searchHref(q)}" data-nav><code>${esc(q)}</code></a>`;

export function syntaxPage(): string {
  const rows = ENTRIES.map(
    (e) => `
      <tr>
        <th>${e.keys ? e.keys.split(" ").map((k) => `<code>${esc(k)}</code>`).join(" ") : '<span class="muted">no key</span>'}</th>
        <td>${esc(e.what)}<div class="examples">${e.examples.map(link).join(" ")}</div></td>
      </tr>`,
  ).join("");

  return `
    <article class="prose">
      <h1>Search syntax</h1>
      <p>Type terms into the search box. Operators: <code>:</code> <code>=</code> <code>!=</code>
        <code>&lt;</code> <code>&lt;=</code> <code>&gt;</code> <code>&gt;=</code>.
        Text matches are case-insensitive. Click any example to run it.</p>
      <h2>Combining terms</h2>
      <table class="syntax">${COMBINING.map(([q, what]) => `<tr><th>${link(q)}</th><td>${esc(what)}</td></tr>`).join("")}</table>
      <h2>Search keys</h2>
      <table class="syntax">${rows}</table>
      <p class="muted">A key or value Scry Fruit doesn't know shows a warning and is ignored, rather than emptying your results.</p>
      <h2>Formats and rotation</h2>
      <p><strong>Standard</strong> uses the block icon. A season runs April 1 to March 31: in 2026–27 blocks 2 and up are
        legal, and every April 1 the oldest block drops out. Block X cards are always legal.
        <strong>Extra</strong> allows every block. The ban list applies to both.</p>
      <p>Legality belongs to the card number, not the printing: when Bandai reprints a card with a newer block, or
        moves it to a block on <a href="https://en.onepiece-cardgame.com/rules/blockicon-card/" rel="noopener">their update list</a>,
        every printing of it counts. <code>is:rotating</code> finds what leaves Standard at the next April 1.</p>
    </article>`;
}
