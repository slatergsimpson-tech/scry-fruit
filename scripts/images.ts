// Downloads card images that aren't stored yet and shrinks them to WebP.
//
//   node scripts/images.ts [dir] [--max N]
//
// dir defaults to public/img (local development). The weekly refresh points
// it at a checkout of the "images" branch instead, which is where the full
// set lives: ~230 MB is too much to carry in main's history.
//
// Only missing images are fetched, so after the first fill a run downloads
// just that week's new printings. Bandai's images are 600x838 PNGs of about
// 210 KB; 360 px WebP is about 46 KB and still sharp at grid size on a
// high-density screen (tiles are ~190 px wide).
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import type { Card } from "../src/card.ts";

const WIDTH = 360;
const QUALITY = 78;
const DELAY_MS = 1000; // one request a second, like the scraper
// Give up if this many downloads in a row fail: the site is down or blocking
// us, and hammering it for another hour won't help.
const MAX_CONSECUTIVE_FAILURES = 10;

const args = process.argv.slice(2);
const maxIdx = args.indexOf("--max");
const max = maxIdx === -1 ? Infinity : parseInt(args[maxIdx + 1], 10);
const dir = args.find((a, i) => !a.startsWith("--") && i !== maxIdx + 1) ?? "public/img";

const cards: Card[] = JSON.parse(await readFile("public/cards.json", "utf8"));
await mkdir(dir, { recursive: true });
const have = new Set((await readdir(dir)).filter((f) => f.endsWith(".webp")).map((f) => f.slice(0, -5)));
const missing = cards.filter((c) => c.image && !have.has(c.id));
const todo = missing.slice(0, max);

console.log(`${have.size} images stored, ${missing.length} missing, fetching ${todo.length}`);

let done = 0;
let failed = 0;
let streak = 0;
const started = Date.now();
for (const card of todo) {
  try {
    const res = await fetch(card.image, {
      headers: { "User-Agent": "scry-fruit card indexer (fan project; github.com/slatergsimpson-tech/scry-fruit)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const png = Buffer.from(await res.arrayBuffer());
    const webp = await sharp(png).resize({ width: WIDTH }).webp({ quality: QUALITY }).toBuffer();
    await writeFile(`${dir}/${card.id}.webp`, webp);
    done++;
    streak = 0;
  } catch (err) {
    failed++;
    streak++;
    console.warn(`! ${card.id}: ${(err as Error).message}`);
    if (streak >= MAX_CONSECUTIVE_FAILURES) {
      console.error(`Stopping: ${streak} failures in a row.`);
      break;
    }
  }
  if ((done + failed) % 100 === 0) {
    const mins = ((Date.now() - started) / 60000).toFixed(1);
    console.log(`  ${done + failed}/${todo.length} (${failed} failed) after ${mins} min`);
  }
  await new Promise((r) => setTimeout(r, DELAY_MS));
}

console.log(`Saved ${done} images to ${dir}, ${failed} failed`);
// A few missing images are fine (the site shows the text card instead);
// a run where most fail is not.
if (streak >= MAX_CONSECUTIVE_FAILURES || (todo.length > 0 && failed > todo.length / 2)) process.exit(1);
