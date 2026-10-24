import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenize } from "./lexer.ts";
import { parse } from "./parser.ts";

// Render a tree back to a compact string so expected shapes read easily.
function show(query: string): string {
  const render = (n: any): string => {
    if (!n) return "∅";
    if (n.type === "term") return n.key ? `${n.key}${n.op}${n.value}` : `"${n.value}"`;
    if (n.type === "not") return `-${render(n.child)}`;
    return `${n.type.toUpperCase()}(${n.children.map(render).join(" ")})`;
  };
  return render(parse(query).ast);
}

test("lexer splits keys, operators, quotes and parens", () => {
  const kinds = tokenize('c:red (pow>=6k or o:"on play") -n:luffy').map((t) =>
    t.kind === "term" ? `${t.key}|${t.op}|${t.value}` : t.kind,
  );
  assert.deepEqual(kinds, ["c|:|red", "lparen", "pow|>=|6k", "or", "o|:|on play", "rparen", "not", "n|:|luffy"]);
});

test("lexer reads /regex/ values", () => {
  const [t] = tokenize("o:/draw \\d cards?/");
  assert.equal(t.kind === "term" && t.regex, true);
  assert.equal(t.kind === "term" && t.value, "draw \\d cards?");
});

test("bare words are name terms, and quoted or is not an operator", () => {
  assert.equal(show("luffy"), '"luffy"');
  assert.equal(show('"or"'), '"or"');
});

test("adjacent terms are ANDed", () => {
  assert.equal(show("c:red t:leader"), "AND(c:red t:leader)");
});

test("AND binds tighter than OR", () => {
  assert.equal(show("a:1 b:2 or c:3"), "OR(AND(a:1 b:2) c:3)");
});

test("parentheses override precedence", () => {
  assert.equal(show("a:1 (b:2 or c:3)"), "AND(a:1 OR(b:2 c:3))");
});

test("minus negates a term or a group", () => {
  assert.equal(show("-c:red"), "-c:red");
  assert.equal(show("-(a:1 or b:2) c:3"), "AND(-OR(a:1 b:2) c:3)");
});

test("explicit and is allowed", () => {
  assert.equal(show("a:1 and b:2"), "AND(a:1 b:2)");
});

test("broken input is repaired with a warning, not an error", () => {
  const missing = parse("(c:red or c:blue");
  assert.equal(show("(c:red or c:blue"), "OR(c:red c:blue)");
  assert.match(missing.warnings[0], /missing "\)"/);

  const extra = parse("c:red) t:leader");
  assert.equal(show("c:red) t:leader"), "AND(c:red t:leader)");
  assert.match(extra.warnings[0], /unmatched "\)"/);

  assert.equal(show('o:"unclosed'), "o:unclosed");
  assert.equal(show(""), "∅");
});
