// HTML builders for the three views. Everything that came from the card data
// goes through esc() before it lands in innerHTML, so text like "<" in a card
// effect can never turn into markup.
import type { Card } from "../card.ts";
import { FORMATS, isRotating, legality, nextRotation, type Legality } from "../formats.ts";

// Where card scans are served from: `${IMAGE_BASE}${card.id}.webp`, set to
// null to draw every card from its text. Bandai's own image URLs can't be
// used: their server sends Cross-Origin-Resource-Policy: same-site, so
// browsers refuse to show them on any other site. So scripts/images.ts keeps
// shrunk copies on the "images" branch, and the deploy puts them in img/.
// An image that isn't there yet falls back to the text card.
export const IMAGE_BASE: string | null = `${import.meta.env.BASE_URL}img/`;

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// Link to a search. Quotes the value when it has spaces: trait:"Straw Hat Crew".
export function searchHref(query: string): string {
  return `?q=${encodeURIComponent(query)}`;
}
const quote = (v: string) => (/\s/.test(v) ? `"${v}"` : v);

// Card text with [Keywords] styled and {Trait} references marked. With
// links=true the traits become searches — only where the text isn't already
// inside a link, since a link nested in a link is invalid HTML and the
// browser "fixes" it by splitting the outer one apart.
export function richText(text: string, links = false): string {
  return esc(text)
    .replace(/\[([^\]]+)\]/g, '<span class="kw">$1</span>')
    .replace(/\{([^}]+)\}/g, (_, t) =>
      links
        ? `<a class="ref" href="${searchHref(`trait:${quote(t)}`)}" data-nav>{${t}}</a>`
        : `<span class="ref">{${t}}</span>`,
    )
    .replace(/\n/g, "<br>");
}

const pips = (c: Card) =>
  c.colors.map((col) => `<span class="pip ${col}" title="${col}"></span>`).join("");

function statLine(c: Card): string {
  const parts: string[] = [];
  if (c.life !== null) parts.push(`Life ${c.life}`);
  if (c.cost !== null) parts.push(`Cost ${c.cost}`);
  if (c.power !== null) parts.push(`${c.power} power`);
  if (c.counter) parts.push(`+${c.counter} counter`);
  return parts.join(" · ");
}

// A card drawn from its text. Used in place of the scan when the image
// can't load, and in the text view.
export function textCard(c: Card): string {
  return `
    <div class="tcard ${c.colors.join(" ")}">
      <div class="tcard-head">
        <span class="tcard-cost">${c.cost ?? c.life ?? ""}</span>
        <span class="tcard-name">${esc(c.name)}</span>
      </div>
      <div class="tcard-type">${pips(c)} ${esc(c.category)}${c.traits.length ? " — " + esc(c.traits.join(" / ")) : ""}</div>
      <div class="tcard-text">${c.effect ? richText(c.effect) : '<span class="muted">No effect</span>'}
        ${c.trigger ? `<div class="tcard-trigger"><span class="kw trig">Trigger</span> ${richText(c.trigger)}</div>` : ""}
      </div>
      <div class="tcard-foot">
        <span>${statLine(c)}</span>
        <span>${c.ban ? `<span class="badge ${c.ban}">${c.ban}</span> ` : ""}${esc(c.id)}</span>
      </div>
    </div>`;
}

// The scan, with the text card hidden underneath. If the image fails to load,
// main.ts swaps it out for the text card (see the "error" listener there).
export function cardFace(c: Card, size: "grid" | "large"): string {
  if (!IMAGE_BASE) return textCard(c);
  return `
    <div class="face face-${size}">
      <img src="${esc(IMAGE_BASE + c.id)}.webp" alt="${esc(c.name)}" loading="lazy" decoding="async">
      <template>${textCard(c)}</template>
    </div>`;
}

export function resultTile(c: Card, mode: "images" | "text"): string {
  const body = mode === "text" ? textCard(c) : cardFace(c, "grid");
  return `<a class="tile" href="?card=${encodeURIComponent(c.id)}" data-nav>${body}</a>`;
}

// ---- card page ------------------------------------------------------------

function row(label: string, value: string): string {
  return value ? `<tr><th>${label}</th><td>${value}</td></tr>` : "";
}

const LEGALITY_LABEL: Record<Legality, string> = {
  legal: "Legal",
  not_legal: "Not legal",
  banned: "Banned",
  restricted: "Restricted",
};
const dateLabel = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

// Standard / Extra pills, plus when it rotates and what it can't be paired with.
function legalityPanel(c: Card, now: Date, nameOf: (code: string) => string): string {
  const pills = FORMATS.map((f) => {
    const l = legality(c, f, now);
    return `<a class="legal ${l}" href="${searchHref(`${l === "not_legal" ? "-legal" : l === "legal" ? "legal" : l}:${f}`)}" data-nav>
      <span class="legal-format">${f}</span><span class="legal-state">${LEGALITY_LABEL[l]}</span></a>`;
  }).join("");
  const rotating = isRotating(c, now)
    ? `<p class="legal-note">Leaves Standard on <strong>${dateLabel(nextRotation(now))}</strong>, when block ${esc(c.legalBlock)} rotates out. <a href="${searchHref("is:rotating")}" data-nav>Everything rotating</a></p>`
    : "";
  const pairs = c.bannedWith.length
    ? `<p class="legal-note">Banned pair: can't be in the same deck as ${c.bannedWith
        .map((code) => `<a href="?card=${encodeURIComponent(code)}" data-nav>${esc(nameOf(code))} (${esc(code)})</a>`)
        .join(" or ")}.</p>`
    : "";
  return `<div class="legality">${pills}</div>${rotating}${pairs}`;
}

// The rotation block, and the printed icon when this printing's differs from
// it (a reprint moved the card on, or Bandai's list prints the wrong number).
function blockCell(c: Card): string {
  if (!c.legalBlock) return "";
  const printed = c.block && c.block !== "-" && c.block !== c.legalBlock ? ` <span class="muted">(this printing shows ${esc(c.block)})</span>` : "";
  return linkTo(`b:${c.legalBlock.toLowerCase()}`, c.legalBlock) + printed;
}

function linkTo(query: string, label: string): string {
  return `<a href="${searchHref(query)}" data-nav>${esc(label)}</a>`;
}

// nameOf turns a card number into its name, for the banned-pair links.
export function cardPage(c: Card, printings: Card[], now: Date, nameOf: (code: string) => string): string {
  const traits = c.traits.map((t) => linkTo(`trait:${quote(t)}`, t)).join(" / ");
  const colors = c.colors.map((col) => linkTo(`c:${col}`, col)).join(" / ");
  const attrs = c.attributes.map((a) => linkTo(`a:${a}`, a)).join(" / ");

  const prints = printings
    .map(
      (p) => `
      <a class="print ${p.id === c.id ? "current" : ""}" href="?card=${encodeURIComponent(p.id)}" data-nav>
        <span class="print-id">${esc(p.id)}</span>
        <span class="print-set">${esc(p.setName || p.set)}</span>
        <span class="print-r">${esc(p.rarity)}${p.variant.startsWith("p") ? " · parallel" : p.variant.startsWith("r") ? " · reprint" : ""}${p.block && p.block !== "-" ? ` · block ${esc(p.block)}` : ""}</span>
      </a>`,
    )
    .join("");

  return `
    <article class="cardpage${IMAGE_BASE ? "" : " no-art"}">
      ${IMAGE_BASE ? `<div class="cardpage-art">${cardFace(c, "large")}</div>` : ""}
      <div class="cardpage-info">
        <h1>${esc(c.name)}</h1>
        <p class="cardpage-type">${pips(c)} ${linkTo(`t:${c.category}`, c.category)}${traits ? ` — ${traits}` : ""}</p>
        <div class="oracle">
          ${c.effect ? `<p>${richText(c.effect, true)}</p>` : '<p class="muted">No effect.</p>'}
          ${c.trigger ? `<p class="trigger"><span class="kw trig">Trigger</span> ${richText(c.trigger, true)}</p>` : ""}
        </div>
        ${legalityPanel(c, now, nameOf)}
        <table class="stats">
          ${row("Life", c.life !== null ? linkTo(`life:${c.life}`, String(c.life)) : "")}
          ${row("Cost", c.cost !== null ? linkTo(`cost:${c.cost}`, String(c.cost)) : "")}
          ${row("Power", c.power !== null ? linkTo(`pow:${c.power}`, String(c.power)) : "")}
          ${row("Counter", c.counter !== null ? linkTo(`counter:${c.counter}`, c.counter ? `+${c.counter}` : "None") : "")}
          ${row("Color", colors)}
          ${row("Attribute", attrs)}
          ${row("Rarity", linkTo(`r:${c.rarity.toLowerCase().replace(/\s+/g, "")}`, c.rarity))}
          ${row("Block", blockCell(c))}
          ${row("Set", linkTo(`s:${c.set}`, c.setName || c.set))}
          ${row("Notes", esc(c.notes))}
        </table>
        <h2>Printings</h2>
        <div class="prints">${prints}</div>
        <p class="official">
          ${c.image ? `<a href="${esc(c.image)}" target="_blank" rel="noopener noreferrer">Card image</a> · ` : ""}
          <a href="https://en.onepiece-cardgame.com/cardlist/" target="_blank" rel="noopener">Official card list</a>
        </p>
      </div>
    </article>`;
}
