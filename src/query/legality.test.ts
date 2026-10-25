import { test } from "node:test";
import assert from "node:assert/strict";
import { search } from "./index.ts";
import { CARDS } from "./fixtures.ts";
import { nextRotation, standardMinBlock } from "../formats.ts";

const OCT_2026 = new Date(2026, 9, 24); // Standard = blocks 2+
const MAY_2027 = new Date(2027, 4, 1); // Standard = blocks 3+

const ids = (q: string, now = OCT_2026) => search(CARDS, q, { now }).cards.map((c) => c.id).sort();

test("seasons start April 1 and drop one block each year", () => {
  assert.equal(standardMinBlock(new Date(2026, 3, 1)), 2);
  assert.equal(standardMinBlock(new Date(2027, 2, 31)), 2); // March 31: still last season
  assert.equal(standardMinBlock(new Date(2027, 3, 1)), 3);
  assert.deepEqual(nextRotation(OCT_2026), new Date(2027, 3, 1));
});

test("legal:standard needs a current block and no ban", () => {
  assert.deepEqual(ids("legal:standard"), ["OP01-024", "OP02-008", "OP05-119"]);
  assert.deepEqual(ids("f:std"), ids("legal:standard")); // aliases and prefixes
});

test("Standard moves on by itself after April 1", () => {
  assert.deepEqual(ids("legal:standard", MAY_2027), ["OP01-024", "OP05-119"]);
});

test("Extra allows every block but still honours the ban list", () => {
  assert.equal(ids("legal:extra").length, 7); // 8 cards, minus banned Kuro
  assert.ok(!ids("legal:extra").includes("OP03-040"));
  assert.deepEqual(ids("banned:extra"), ["OP03-040"]);
  assert.deepEqual(ids("banned:standard"), ["OP03-040"]);
  assert.deepEqual(ids("is:banned"), ["OP03-040"]);
});

test("is:rotating finds what leaves Standard next April", () => {
  assert.deepEqual(ids("is:rotating"), ["OP02-008"]);
  // Banned Kuro is block 3 too: a ban doesn't stop a card leaving the pool.
  assert.deepEqual(ids("is:rotating", MAY_2027), ["OP01-024", "OP03-040"]);
});

test("b: is the rotation block, and X outranks every number", () => {
  assert.deepEqual(ids("b:x"), ["OP05-119"]);
  assert.deepEqual(ids("b>=3"), ["OP01-024", "OP03-040", "OP05-119"]);
  assert.deepEqual(ids("b:2"), ["OP02-008"]);
});

test("banned pairs", () => {
  assert.deepEqual(ids("is:bannedpair"), ["OP01-024", "OP02-008"]);
});

test("unknown formats and blocks warn instead of emptying results", () => {
  const r = search(CARDS, "legal:modern c:purple", { now: OCT_2026 });
  assert.equal(r.cards.length, 1);
  assert.match(r.warnings[0], /Unknown format "modern"/);
  assert.match(search(CARDS, "b:new").warnings[0], /expected a block number/);
});
