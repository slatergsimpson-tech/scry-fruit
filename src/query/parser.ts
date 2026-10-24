// Parser: tokens -> syntax tree, by recursive descent.
//
// Grammar, loosest-binding first. Each rule is one function below, and each
// calls the next one down, which is what gives `-` priority over AND and AND
// priority over OR:
//
//   query   := or
//   or      := and ("or" and)*
//   and     := unary (["and"] unary)*      -- AND is implicit between terms
//   unary   := "-" unary | primary
//   primary := "(" or ")" | TERM
//
// So `a b or c` is (a AND b) OR c, same as Scryfall.
import { tokenize, type Op, type Token } from "./lexer.ts";

export type Node =
  | { type: "and"; children: Node[] }
  | { type: "or"; children: Node[] }
  | { type: "not"; child: Node }
  | { type: "term"; key: string | null; op: Op | null; value: string; regex: boolean };

export type ParseResult = { ast: Node | null; warnings: string[] };

export function parse(input: string): ParseResult {
  const tokens = tokenize(input);
  const warnings: string[] = [];
  let i = 0;

  const peek = (): Token | undefined => tokens[i];

  function parseOr(): Node | null {
    const children: Node[] = [];
    const first = parseAnd();
    if (first) children.push(first);
    while (peek()?.kind === "or") {
      i++;
      const next = parseAnd();
      if (next) children.push(next);
    }
    return collapse("or", children);
  }

  function parseAnd(): Node | null {
    const children: Node[] = [];
    for (;;) {
      const t = peek();
      if (!t || t.kind === "or") break;
      if (t.kind === "rparen") {
        if (depth > 0) break; // closes our group; parsePrimary consumes it
        warnings.push(`Ignored unmatched ")" at position ${t.pos + 1}`);
        i++;
        continue;
      }
      if (t.kind === "and") {
        i++;
        continue;
      }
      const node = parseUnary();
      if (node) children.push(node);
    }
    return collapse("and", children);
  }

  function parseUnary(): Node | null {
    if (peek()?.kind === "not") {
      i++;
      const child = parseUnary();
      return child ? { type: "not", child } : null;
    }
    return parsePrimary();
  }

  let depth = 0;
  function parsePrimary(): Node | null {
    const t = tokens[i++];
    if (!t) return null;
    if (t.kind === "lparen") {
      depth++;
      const inner = parseOr();
      depth--;
      if (peek()?.kind === "rparen") i++;
      else warnings.push(`Added missing ")" for "(" at position ${t.pos + 1}`);
      return inner;
    }
    if (t.kind === "term") {
      return { type: "term", key: t.key, op: t.op, value: t.value, regex: t.regex };
    }
    return null; // a stray operator like a leading "or" — skip it
  }

  // An AND/OR with one child is just that child.
  function collapse(type: "and" | "or", children: Node[]): Node | null {
    if (children.length === 0) return null;
    if (children.length === 1) return children[0];
    return { type, children };
  }

  const ast = parseOr();
  return { ast, warnings };
}
