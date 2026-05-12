import type { Card, Rank, Suit } from "./types";

export const suits: Suit[] = ["clubs", "diamonds", "hearts", "spades"];
export const ranks: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function createDeck(): Card[] {
  const standardCards = suits.flatMap((suit) =>
    ranks.map((rank) => ({
      kind: "standard" as const,
      suit,
      rank,
      id: `${rank}-${suit}`,
    })),
  );

  return [...standardCards, { kind: "joker", id: "joker-1" }, { kind: "joker", id: "joker-2" }];
}

export function shuffle<T>(items: T[], random = Math.random): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = shuffled[index];
    const swap = shuffled[swapIndex];

    if (current === undefined || swap === undefined) {
      continue;
    }

    shuffled[index] = swap;
    shuffled[swapIndex] = current;
  }

  return shuffled;
}

export function formatCard(card: Card): string {
  if (card.kind === "joker") {
    return "Joker";
  }

  const suitSymbols: Record<Suit, string> = {
    clubs: "C",
    diamonds: "D",
    hearts: "H",
    spades: "S",
  };

  return `${card.rank}${suitSymbols[card.suit]}`;
}
