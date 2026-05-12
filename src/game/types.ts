export type Suit = "clubs" | "diamonds" | "hearts" | "spades";

export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export type StandardCard = {
  kind: "standard";
  suit: Suit;
  rank: Rank;
  id: string;
};

export type JokerCard = {
  kind: "joker";
  id: string;
};

export type Card = StandardCard | JokerCard;

export type Player = {
  id: string;
  name: string;
  hand: Card[];
  totalScore: number;
};

export type DiscardSet = {
  playerId: string;
  cards: Card[];
};

export type GameState = {
  players: Player[];
  dealerIndex: number;
  currentPlayerIndex: number;
  drawPile: Card[];
  discardSets: DiscardSet[];
  handEnded: boolean;
  handWinnerId?: string;
};

export type DiscardKind = "single" | "same-rank" | "straight-flush";

export type ScoredHand = {
  playerId: string;
  handPoints: number;
  penalty: number;
  totalForHand: number;
};
