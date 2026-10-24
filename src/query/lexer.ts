// Lexer: query string -> flat list of tokens.
//
//   c:red (is:rush or pow>=6k) -"luffy"
//   TERM(c,:,red) LPAREN TERM(is,:,rush) OR TERM(pow,>=,6k) RPAREN NOT TERM(-,-,luffy)
//
// It is deliberately forgiving, like Scryfall: an unclosed quote runs to the
// end of the input instead of being an error.

export type Op = ":" | "=" | "!=" | "<" | "<=" | ">" | ">=";

export type Token =
  | { kind: "lparen"; pos: number }
  | { kind: "rparen"; pos: number }
  | { kind: "or"; pos: number }
  | { kind: "and"; pos: number }
  | { kind: "not"; pos: number }
  // key/op are null for a bare word or "quoted phrase" (a name search).
  | { kind: "term"; pos: number; key: string | null; op: Op | null; value: string; regex: boolean };

// A key and an operator at the cursor: `pow>=`, `o:`. Longest operators
// first so `>=` isn't read as `>` followed by a value of "=...".
const KEY_OP = /([a-zA-Z_]+)(!=|<=|>=|:|=|<|>)/y;
const BARE = /[^\s()"]+/y;

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  // Reads a quoted string, /regex/, or plain run starting at i.
  function readValue(): { value: string; regex: boolean } {
    const ch = input[i];
    if (ch === '"' || ch === "/") {
      const end = input.indexOf(ch, i + 1);
      const stop = end === -1 ? input.length : end;
      const value = input.slice(i + 1, stop);
      i = end === -1 ? stop : stop + 1;
      return { value, regex: ch === "/" };
    }
    BARE.lastIndex = i;
    const m = BARE.exec(input);
    const value = m ? m[0] : "";
    i += value.length;
    return { value, regex: false };
  }

  while (i < input.length) {
    const ch = input[i];
    const pos = i;

    if (/\s/.test(ch)) {
      i++;
    } else if (ch === "(") {
      tokens.push({ kind: "lparen", pos });
      i++;
    } else if (ch === ")") {
      tokens.push({ kind: "rparen", pos });
      i++;
    } else if (ch === "-" && i + 1 < input.length && !/\s/.test(input[i + 1])) {
      tokens.push({ kind: "not", pos });
      i++;
    } else {
      KEY_OP.lastIndex = i;
      const m = KEY_OP.exec(input);
      if (m) {
        i += m[0].length;
        const { value, regex } = readValue();
        tokens.push({ kind: "term", pos, key: m[1].toLowerCase(), op: m[2] as Op, value, regex });
        continue;
      }
      const quoted = ch === '"';
      const { value } = readValue();
      // Unquoted `or` / `and` are operators; "or" in quotes is a name search.
      const word = value.toLowerCase();
      if (!quoted && (word === "or" || word === "and")) {
        tokens.push({ kind: word, pos });
      } else {
        tokens.push({ kind: "term", pos, key: null, op: null, value, regex: false });
      }
    }
  }
  return tokens;
}
