import { test } from "node:test";
import assert from "node:assert/strict";
import { search } from "./index.ts";
import { CARDS } from "./fixtures.ts";

// Ids of the cards a query finds, one per card (not per printing).
const ids = (q: string) => search(CARDS, q).cards.map((c) => c.id).sort();
const warnings = (q: string) => search(CARDS, q).warnings;

test("bare words search names, ignoring punctuation", () => {
  assert.deepEqual(ids("luffy"), ["OP01-024", "OP05-119"]);
  assert.deepEqual(ids("monkey d luffy"), ["OP01-024", "OP05-119"]);
  assert.deepEqual(ids('"tony tony"'), ["ST01-006"]);
});

test("card numbers find that card", () => {
  assert.deepEqual(ids("op01-016"), ["OP01-016"]);
});

test("colors compare as sets", () => {
  assert.ok(ids("c:green").includes("OP02-008"));
  assert.deepEqual(ids("c=green"), []); // Jozu is red AND green
  assert.deepEqual(ids("c=red/green"), ["OP02-008"]);
  assert.deepEqual(ids("c:multi"), ["OP02-008"]);
  assert.ok(!ids("c<=red").includes("OP02-008"));
  assert.ok(ids("c<=red").includes("OP01-016"));
});

test("t: matches category or trait", () => {
  assert.deepEqual(ids("t:leader"), ["OP01-001"]);
  assert.deepEqual(ids("t:event"), ["OP01-029"]);
  assert.deepEqual(ids("t:animal"), ["ST01-006"]);
  assert.deepEqual(ids('trait:"whitebeard"'), ["OP02-008"]);
});

test("numeric fields support comparisons and k suffixes", () => {
  assert.deepEqual(ids("pow>=6k"), ["OP01-024", "OP05-119"]);
  assert.deepEqual(ids("cost=10"), ["OP05-119"]);
  assert.deepEqual(ids("life:5"), ["OP01-001"]);
  // Leaders have no cost, so they never match a cost search.
  assert.ok(!ids("cost<=5").includes("OP01-001"));
  assert.ok(ids("counter:1000").includes("OP01-016"));
});

test("o: searches effect and trigger text, folding unicode minus", () => {
  assert.deepEqual(ids('o:"don!! -10"'), ["OP05-119"]);
  assert.deepEqual(ids('o:"+1000 power during this turn"'), ["OP01-029"]);
  assert.deepEqual(ids('trigger:"+1000"'), ["OP01-029"]);
  assert.deepEqual(ids("o:/look at \\d cards/"), ["OP01-016"]);
});

test("keywords count only when the card has them, not when it mentions them", () => {
  assert.deepEqual(ids("is:blocker"), ["OP02-008"]); // not Kuro, not Luffy
  assert.deepEqual(ids("is:rush"), ["OP01-024"]);
  assert.deepEqual(ids("is:onplay"), ["OP01-016", "OP05-119"]);
  assert.deepEqual(ids('kw:"when attacking"'), ["OP01-024"]);
  assert.deepEqual(ids("is:counterevent"), ["OP01-029"]);
});

test("is:/has: properties", () => {
  assert.deepEqual(ids("is:vanilla"), ["ST01-006"]);
  assert.deepEqual(ids("has:trigger"), ["OP01-029"]);
  assert.deepEqual(ids("is:parallel"), ["OP01-024_p1"]);
});

test("rarity is ordered", () => {
  assert.deepEqual(ids("r:sec"), ["OP05-119"]);
  assert.deepEqual(ids("r>=sr"), ["OP01-024", "OP03-040", "OP05-119"]);
});

test("set codes accept loose spellings", () => {
  assert.deepEqual(ids("s:op-5"), ["OP05-119"]);
  assert.deepEqual(ids("s:st01"), ["ST01-006"]);
});

test("boolean logic combines terms", () => {
  assert.deepEqual(ids("c:red t:character cost<=1 -is:vanilla"), ["OP01-016"]);
  assert.deepEqual(ids("(is:rush or is:blocker) pow>=5000"), ["OP01-024", "OP02-008"]);
  assert.deepEqual(ids('trait:"straw hat" -luffy t:character'), ["OP01-016", "ST01-006"]);
});

test("printings collapse to one result per card unless asked", () => {
  assert.equal(search(CARDS, "luffy is:rush").cards.length, 1);
  assert.equal(search(CARDS, "luffy is:rush", { prints: true }).cards.length, 2);
  // A reprint (_r1) collapses onto its card too.
  assert.deepEqual(ids("nami"), ["OP01-016"]);
  assert.deepEqual(search(CARDS, "is:reprint", { prints: true }).cards.map((c) => c.id), ["OP01-016_r1"]);
});

test("mistakes warn and are ignored instead of emptying the results", () => {
  assert.equal(ids("zzz:1 c:purple").length, 1);
  assert.match(warnings("zzz:1")[0], /Unknown search key "zzz"/);
  assert.match(warnings("c:orange")[0], /Unknown color/);
  assert.match(warnings("pow>=lots")[0], /expected a number/);
  assert.match(warnings("is:flying")[0], /Unknown is:/);
});
