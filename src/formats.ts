// Format legality, worked out from a card's rotation block and the ban list.
//
// From Bandai's "Introduction of the Block Number System":
//   - Seasons run April 1 to March 31.
//   - Standard, April 2026–March 2027: blocks ② to ⑤ (① is out).
//     April 2027–March 2028: ③ to ⑥. One block drops out each season.
//   - Block "X" cards are always legal in Standard.
//   - Extra: every block.
//   - The Banned/Restricted list applies to both.
// This is computed from the date at search time, so the site rotates on
// April 1 by itself, without a redeploy.
import type { Card } from "./card.ts";

export const FORMATS = ["standard", "extra"] as const;
export type Format = (typeof FORMATS)[number];
export type Legality = "legal" | "not_legal" | "banned" | "restricted";

// Season 2026–27 (starting April 2026) begins at block 2; each later
// season starts one block higher. JS months count from 0, so 3 = April.
export function standardMinBlock(now: Date): number {
  const seasonYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return seasonYear - 2024;
}

// April 1 of the season that `now` falls in.
export function nextRotation(now: Date): Date {
  const seasonYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(seasonYear + 1, 3, 1);
}

function inStandard(block: string, now: Date): boolean {
  if (block === "X") return true;
  const n = parseInt(block, 10);
  return !Number.isNaN(n) && n >= standardMinBlock(now);
}

export function legality(card: Card, format: Format, now: Date): Legality {
  if (format === "standard" && !inStandard(card.legalBlock, now)) return "not_legal";
  return card.ban ?? "legal";
}

// In Standard's block range now, but not next season — what leaves at the next
// April 1. Ignores the ban list: a banned card still rotates out.
export function isRotating(card: Card, now: Date): boolean {
  return inStandard(card.legalBlock, now) && !inStandard(card.legalBlock, nextRotation(now));
}
