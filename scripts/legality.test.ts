// The parsers run against trimmed copies of the real page structure, so a
// change in how Bandai lays the pages out shows up here as a clear failure.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Card } from "../src/card.ts";
import { legalBlock, parseBanList, parseBlockOverrides } from "./legality.ts";

const BAN_PAGE = `
<main><div class="row"><h3>Banned/Restricted Cards effective from October 12, 2026</h3>
  <h4>Banned Cards</h4><ul><li>OP14-020 Dracule Mihawk</li></ul></div>
<div class="row"><div><h3>Cards with Active Restrictions</h3></div>
  <h4>Banned Cards</h4>
  <ul><li>・<a>OP06-047 Charlotte Pudding</a></li><li>・<a>ST10-001 Trafalgar Law</a></li></ul>
  <h4>Restricted Cards</h4><p>There are currently no cards in this category.</p>
  <h4>Banned Pair Cards</h4>
  <div><ul><li>・OP07-115 I Re-Quasar Helllp!!</li><li>・EB04-058 Borsalino</li></ul></div>
  <div><ul><li>・OP11-040 Monkey.D.Luffy</li><li>・OP11-067 Charlotte Katakuri</li></ul></div>
</div></main>`;

test("ban list: reads only the active list, by category, with pairs kept together", () => {
  const list = parseBanList(BAN_PAGE);
  // OP14-020 sits in the "newly announced" section above, not the active list.
  assert.deepEqual(list.banned, ["OP06-047", "ST10-001"]);
  assert.deepEqual(list.restricted, []);
  assert.deepEqual(list.pairs, [
    ["OP07-115", "EB04-058"],
    ["OP11-040", "OP11-067"],
  ]);
});

test("ban list: a changed layout fails loudly", () => {
  assert.throws(() => parseBanList("<main><h3>Something else</h3></main>"), /no "Cards with Active Restrictions"/);
});

const BLOCK_PAGE = `
<main><h3>Cards Generally Permitted in Standard Regulation</h3>
  <ul><li>・OP01-016 Nami</li><li>・OP05-119 Monkey D. Luffy</li></ul>
  <h3>Cards Eligible for Use Under Block Number ④</h3>
  <p>Regardless of reprints, these cards will be treated as belonging to the specified Block Number.</p>
  <ul><li>・OP01-039 Killer</li></ul>
  <h3>Updated Block Number and cards that have been reprinted</h3>
  <ul><li>・OP04-016 Bad Manners Kick Course</li></ul>
</main>`;

test("block overrides: X for the always-legal list, the circled number for the other", () => {
  const o = parseBlockOverrides(BLOCK_PAGE);
  assert.equal(o.get("OP01-016"), "X");
  assert.equal(o.get("OP05-119"), "X");
  assert.equal(o.get("OP01-039"), "4");
  assert.equal(o.has("OP04-016"), false); // reprint list: the printings say it
});

const printings = (...blocks: string[]) => blocks.map((block) => ({ block }) as Card);

test("legalBlock: overrides, then the newest printing, never below the pack", () => {
  const o = parseBlockOverrides(BLOCK_PAGE);
  assert.equal(legalBlock("OP01-039", printings("1"), o), "4");
  assert.equal(legalBlock("OP04-016", printings("1", "4"), o), "4");
  assert.equal(legalBlock("EB04-061", printings("4", "X"), o), "X");
  // Bandai's list prints block 1 on OP-05 cards; pack 5 is block 2.
  assert.equal(legalBlock("OP05-005", printings("1"), o), "2");
  assert.equal(legalBlock("ST01-001", printings("1"), o), "1");
});
