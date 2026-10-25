// One printing of a card, as scraped from the official card list.
//
// A "card" (code OP01-001) can have several printings: the base one,
// parallel/alt-art versions (OP01-001_p1, _p2, ...) and reprints in later
// products (_r1). Gameplay fields are the same across printings; only the
// art and the set it shipped in differ.
export type Card = {
  id: string; // printing id: "OP01-001", "OP01-001_p1", "OP01-001_r1"
  code: string; // card number shared by all printings: "OP01-001"
  variant: string; // "" for the base printing, else "p1", "r1"...
  name: string;
  rarity: string; // L, C, UC, R, SR, SEC, SP CARD, P, TR...
  category: string; // leader | character | event | stage | don
  colors: string[]; // lowercase: ["red"], ["red", "green"]
  cost: number | null; // null for leaders
  life: number | null; // leaders only
  power: number | null; // null for events/stages; characters can be 0
  counter: number | null; // null for non-characters; 0 = no counter
  attributes: string[]; // slash, strike, ranged, special, wisdom
  traits: string[]; // "Straw Hat Crew", "Supernovas"...
  effect: string; // "" for vanilla cards
  trigger: string | null; // text after [Trigger], null if none
  block: string; // block icon printed on this printing: "1", "2"... or "X"
  // The block this card NUMBER counts as for rotation, shared by all its
  // printings — see legalBlock() in scripts/legality.ts for how it's derived.
  legalBlock: string;
  ban: "banned" | "restricted" | null; // official list; applies to every format
  bannedWith: string[]; // codes this card can't share a deck with (banned pairs)
  set: string; // product the printing shipped in, normalized: "OP01", "ST10", "EB04"
  setName: string;
  notes: string;
  image: string; // absolute URL on the official site
};
