// Builds public/cards.json from the official English card list.
//
// The card list page has a <select> of every product ("series"). Requesting
// /cardlist/?series=<id> returns one HTML page holding every card in that
// product, so the whole card pool is ~65 requests. Two more pages give the
// ban list and Bandai's block-number overrides. Pages are cached in .cache/
// so re-running while developing doesn't hit Bandai's server again; pass
// --fresh to ignore the cache.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import * as cheerio from "cheerio";
import type { Card } from "../src/card.ts";
import { legalBlock, parseBanList, parseBlockOverrides } from "./legality.ts";

const BASE = "https://en.onepiece-cardgame.com";
const CACHE = ".cache";
const DELAY_MS = 1000; // be polite: one request per second
const fresh = process.argv.includes("--fresh");

type Series = { id: string; name: string; set: string };

// `name` is the cache file: .cache/<name>.html
async function fetchPage(path: string, name: string): Promise<string> {
  const file = `${CACHE}/${name}.html`;
  if (!fresh && existsSync(file)) return readFile(file, "utf8");

  const url = BASE + path;
  const res = await fetch(url, {
    headers: { "User-Agent": "scry-fruit card indexer (fan project; github.com/slatergsimpson-tech/scry-fruit)" },
  });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const html = await res.text();
  await writeFile(file, html);
  await new Promise((r) => setTimeout(r, DELAY_MS));
  return html;
}

// "BOOSTER PACK <br>-ROMANCE DAWN- [OP-01]" -> set "OP01".
// Combined products like "[OP15-EB04]" keep their first code.
function parseSeries(html: string): Series[] {
  const $ = cheerio.load(html);
  const out: Series[] = [];
  $("select#series option").each((_, el) => {
    const id = $(el).attr("value");
    if (!id) return;
    const name = cheerio.load($(el).text()).text().replace(/\s+/g, " ").trim();
    const bracket = name.match(/\[([A-Z]+)-?(\d+)/);
    const set = bracket ? `${bracket[1]}${bracket[2]}` : /promotion/i.test(name) ? "P" : "OTHER";
    out.push({ id, name, set });
  });
  return out;
}

// Cheerio's .text() drops <br>, which would glue lines of effect text
// together. Turn them into newlines first, then strip the <h3> label.
function fieldText($: cheerio.CheerioAPI, scope: cheerio.Cheerio<any>, cls: string): string {
  const el = scope.find(`div.${cls}`).first().clone();
  if (!el.length) return "";
  el.find("h3").remove();
  el.find("br").replaceWith("\n");
  return el.text().replace(/[ \t]+/g, " ").replace(/\n /g, "\n").trim();
}

function num(s: string): number | null {
  const n = parseInt(s.replace(/[^\d-]/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

function splitList(s: string): string[] {
  return s && s !== "-" ? s.split("/").map((x) => x.trim()).filter(Boolean) : [];
}

function parseCards(html: string, series: Series): Card[] {
  const $ = cheerio.load(html);
  const cards: Card[] = [];

  $("dl.modalCol").each((_, el) => {
    const dl = $(el);
    const id = dl.attr("id") ?? "";
    const [code, variant = ""] = id.split("_");
    const info = dl.find(".infoCol span").map((_, s) => $(s).text().trim()).get();
    const [, rarity = "", rawCategory = ""] = info;
    const category = rawCategory.toLowerCase().replace("don!!", "don");

    // The site prints "-" for a 0-power character and for "no counter".
    // Store those as 0 so pow:0 and counter:0 find them; keep null for
    // cards that have no such box at all (events, stages).
    const isCharacter = category === "character";
    const power = num(fieldText($, dl, "power"));
    const counter = num(fieldText($, dl, "counter"));

    // Leaders print Life in the box where everything else prints Cost.
    const costBox = dl.find("div.cost");
    const costLabel = costBox.find("h3").text().trim().toLowerCase();
    const costValue = num(fieldText($, dl, "cost"));

    const trigger = fieldText($, dl, "trigger").replace(/^\[Trigger\]\s*/, "");
    const effect = fieldText($, dl, "text");
    const img = dl.find(".frontCol img").attr("data-src") ?? "";

    cards.push({
      id,
      code,
      variant,
      name: dl.find(".cardName").text().trim(),
      rarity,
      category,
      colors: splitList(fieldText($, dl, "color")).map((c) => c.toLowerCase()),
      cost: costLabel === "cost" ? costValue : null,
      life: costLabel === "life" ? costValue : null,
      power: isCharacter ? (power ?? 0) : power,
      counter: isCharacter ? (counter ?? 0) : counter,
      attributes: dl
        .find(".attribute i")
        .map((_, i) => $(i).text().trim().toLowerCase())
        .get()
        .filter((a) => a && a !== "-"),
      traits: splitList(fieldText($, dl, "feature")),
      effect: effect === "-" ? "" : effect,
      trigger: trigger || null,
      block: fieldText($, dl, "block"),
      // Filled in below, once every printing of the card number is known.
      legalBlock: "",
      ban: null,
      bannedWith: [],
      set: series.set,
      setName: series.name,
      notes: fieldText($, dl, "remarks"),
      image: img ? new URL(img, `${BASE}/cardlist/`).href.replace(/\?.*$/, "") : "",
    });
  });
  return cards;
}

await mkdir(CACHE, { recursive: true });
await mkdir("public", { recursive: true });

const allSeries = parseSeries(await fetchPage("/cardlist/", "index"));
console.log(`Found ${allSeries.length} products`);

// A printing can be listed under more than one product (reprints, decks
// that bundle booster cards). Keep the first sighting of each printing id.
const byId = new Map<string, Card>();
for (const [i, series] of allSeries.entries()) {
  const cards = parseCards(await fetchPage(`/cardlist/?series=${series.id}`, series.id), series);
  let added = 0;
  for (const card of cards) {
    if (!byId.has(card.id)) {
      byId.set(card.id, card);
      added++;
    }
  }
  console.log(`[${i + 1}/${allSeries.length}] ${series.set.padEnd(6)} ${cards.length} listed, ${added} new`);
}

const cards = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));

// Legality is per card number, so group the printings first.
const banList = parseBanList(await fetchPage("/news/restriction.html", "restriction"));
const overrides = parseBlockOverrides(await fetchPage("/rules/blockicon-card/", "blockicon"));
const byCode = Map.groupBy(cards, (c) => c.code);

for (const code of [...banList.banned, ...banList.restricted, ...banList.pairs.flat(), ...overrides.keys()]) {
  if (!byCode.has(code)) console.warn(`! ${code} is on a legality list but not in the card list`);
}

for (const [code, printings] of byCode) {
  const block = legalBlock(code, printings, overrides);
  const ban = banList.banned.includes(code) ? "banned" : banList.restricted.includes(code) ? "restricted" : null;
  const bannedWith = banList.pairs.flatMap(([a, b]) => (a === code ? [b] : b === code ? [a] : []));
  for (const p of printings) Object.assign(p, { legalBlock: block, ban, bannedWith });
}

await writeFile("public/cards.json", JSON.stringify(cards, null, 1));
console.log(`Wrote ${cards.length} printings (${byCode.size} unique cards) to public/cards.json`);
console.log(
  `Legality: ${banList.banned.length} banned, ${banList.restricted.length} restricted, ` +
    `${banList.pairs.length} banned pairs, ${overrides.size} block overrides`,
);
