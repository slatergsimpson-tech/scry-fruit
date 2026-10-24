// Search the scraped cards from the terminal:
//
//   npm run search -- 'c:red t:character cost<=3 is:rush'
//   npm run search -- --prints 'luffy is:parallel'
import { readFile } from "node:fs/promises";
import type { Card } from "../src/card.ts";
import { search } from "../src/query/index.ts";

const args = process.argv.slice(2);
const prints = args.includes("--prints");
const query = args.filter((a) => a !== "--prints").join(" ");

if (!query) {
  console.log("usage: npm run search -- [--prints] '<query>'");
  process.exit(1);
}

const cards: Card[] = JSON.parse(await readFile("data/cards.json", "utf8"));
const started = performance.now();
const result = search(cards, query, { prints });
const ms = (performance.now() - started).toFixed(1);

for (const w of result.warnings) console.log(`! ${w}`);

const LIMIT = 25;
for (const c of result.cards.slice(0, LIMIT)) {
  const stats = [
    c.life !== null ? `life ${c.life}` : `cost ${c.cost ?? "-"}`,
    c.power !== null ? `${c.power}` : null,
    c.counter ? `+${c.counter}` : null,
  ].filter(Boolean);
  const colors = c.colors.join("/");
  console.log(`${c.id.padEnd(13)} ${c.name.padEnd(28)} ${c.category.padEnd(9)} ${colors.padEnd(13)} ${stats.join("  ")}`);
}
const more = result.cards.length > LIMIT ? ` (showing ${LIMIT})` : "";
console.log(`\n${result.cards.length} ${prints ? "printings" : "cards"}${more} in ${ms} ms`);
