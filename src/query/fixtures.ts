// A handful of hand-built cards for the tests. Modelled on real cards but
// fixed in place, so tests don't change when the scraped data does.
import type { Card } from "../card.ts";

function card(partial: Partial<Card> & Pick<Card, "id" | "name">): Card {
  const [code, variant = ""] = partial.id.split("_");
  return {
    code,
    variant,
    rarity: "C",
    category: "character",
    colors: ["red"],
    cost: 1,
    life: null,
    power: 2000,
    counter: 1000,
    attributes: ["strike"],
    traits: [],
    effect: "",
    trigger: null,
    block: "1",
    legalBlock: partial.block ?? "1",
    ban: null,
    bannedWith: [],
    set: code.split("-")[0],
    setName: "",
    notes: "",
    image: "",
    ...partial,
  };
}

// Legality in the fixtures (judged in October 2026, when Standard is blocks 2+):
//   OP05-119 Luffy   block X   always in Standard
//   OP01-024 Luffy   block 3   legal; can't share a deck with Jozu (banned pair)
//   OP02-008 Jozu    block 2   legal now, rotates out April 2027
//   OP03-040 Kuro    block 3   banned
//   everything else  block 1   Extra only

export const CARDS: Card[] = [
  card({
    id: "OP01-001",
    name: "Roronoa Zoro",
    rarity: "L",
    category: "leader",
    cost: null,
    life: 5,
    power: 5000,
    counter: null,
    attributes: ["slash"],
    traits: ["Supernovas", "Straw Hat Crew"],
    effect: "[DON!! x1] [Your Turn] All of your Characters gain +1000 power.",
  }),
  card({
    id: "OP01-016",
    name: "Nami",
    rarity: "R",
    cost: 1,
    power: 2000,
    traits: ["Straw Hat Crew"],
    effect: "[On Play] Look at 5 cards from the top of your deck; reveal up to 1 {Straw Hat Crew} type card.",
    attributes: ["special"],
  }),
  card({
    id: "OP01-016_r1",
    name: "Nami",
    rarity: "R",
    set: "EB01",
    traits: ["Straw Hat Crew"],
    effect: "[On Play] Look at 5 cards from the top of your deck; reveal up to 1 {Straw Hat Crew} type card.",
    attributes: ["special"],
  }),
  card({
    id: "OP01-024", legalBlock: "3", bannedWith: ["OP02-008"],
    name: "Monkey.D.Luffy",
    rarity: "SR",
    cost: 5,
    power: 6000,
    counter: null,
    traits: ["Supernovas", "Straw Hat Crew"],
    effect: "[Rush] (This card can attack on the turn in which it is played.)\n[DON!! x2] [When Attacking] Your opponent cannot activate [Blocker].",
  }),
  card({ id: "OP01-024_p1", legalBlock: "3", bannedWith: ["OP02-008"], name: "Monkey.D.Luffy", rarity: "SR", cost: 5, power: 6000, counter: null, traits: ["Supernovas", "Straw Hat Crew"], effect: "[Rush] (This card can attack on the turn in which it is played.)" }),
  card({
    id: "OP01-029",
    name: "Radical Beam!!",
    rarity: "UC",
    category: "event",
    power: null,
    counter: null,
    attributes: [],
    traits: ["Straw Hat Crew"],
    effect: "[Counter] Up to 1 of your Leader or Character cards gains +2000 power during this battle.",
    trigger: "Up to 1 of your Leader or Character cards gains +1000 power during this turn.",
  }),
  card({
    id: "OP02-008", legalBlock: "2", bannedWith: ["OP01-024"],
    name: "Jozu",
    rarity: "UC",
    colors: ["red", "green"],
    cost: 4,
    power: 5000,
    traits: ["Whitebeard Pirates"],
    effect: "[Blocker] (After your opponent declares an attack, you may rest this card to make it the new target of the attack.)",
  }),
  card({
    id: "OP05-119", legalBlock: "X",
    name: "Monkey.D.Luffy",
    rarity: "SEC",
    colors: ["purple"],
    cost: 10,
    power: 12000,
    counter: null,
    traits: ["The Four Emperors", "Straw Hat Crew"],
    effect: "[On Play] DON!! −10: Place all of your Characters except this Character at the bottom of your deck.",
  }),
  card({
    id: "ST01-006",
    name: "Tony Tony.Chopper",
    rarity: "C",
    colors: ["red"],
    cost: 1,
    power: 1000,
    traits: ["Animal", "Straw Hat Crew"],
    effect: "",
  }),
  card({
    id: "OP03-040", legalBlock: "3", ban: "banned",
    name: "Kuro",
    rarity: "SR",
    colors: ["blue"],
    cost: 2,
    power: 3000,
    traits: ["East Blue"],
    effect: "If this Character would be K.O.'d, you may trash 1 card instead. This Character gains [Blocker].",
  }),
];
