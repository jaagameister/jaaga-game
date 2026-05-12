import { createDeck, shuffle } from "./cards";
import type { Card, DiscardKind, GameState, Player, Rank, ScoredHand, StandardCard } from "./types";

const rankValues: Record<Rank, number> = {
  A: 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 10,
  Q: 10,
  K: 10,
};

const straightRanksLow: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const straightRanksHigh: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

export function cardPoints(card: Card, jokerValue: 1 | 40): number {
  if (card.kind === "joker") {
    return jokerValue;
  }

  return rankValues[card.rank];
}

export function handPoints(cards: Card[], jokerValue: 1 | 40): number {
  return cards.reduce((total, card) => total + cardPoints(card, jokerValue), 0);
}

export function canGoOut(cards: Card[]): boolean {
  return handPoints(cards, 1) <= 5;
}

export function classifyDiscard(cards: Card[]): DiscardKind | null {
  if (cards.length === 0) {
    return null;
  }

  if (cards.length === 1) {
    return "single";
  }

  if (isSameRankSet(cards)) {
    return "same-rank";
  }

  if (cards.length >= 3 && isStraightFlush(cards)) {
    return "straight-flush";
  }

  return null;
}

export function canSlap(discardedCards: Card[], drawnCard: Card): boolean {
  if (drawnCard.kind === "joker") {
    return false;
  }

  return classifyDiscard([...discardedCards, drawnCard]) !== null;
}

export function scoreHand(players: Player[], goingOutPlayerId: string): ScoredHand[] {
  const goingOutPlayer = players.find((player) => player.id === goingOutPlayerId);

  if (!goingOutPlayer) {
    throw new Error(`Unknown going-out player: ${goingOutPlayerId}`);
  }

  const goingOutPoints = handPoints(goingOutPlayer.hand, 1);
  const penaltyApplies = players.some(
    (player) => player.id !== goingOutPlayerId && handPoints(player.hand, 40) <= goingOutPoints,
  );

  return players.map((player) => {
    const isGoingOutPlayer = player.id === goingOutPlayerId;
    const handScore = isGoingOutPlayer ? 0 : handPoints(player.hand, 40);
    const penalty = isGoingOutPlayer && penaltyApplies ? 30 : 0;

    return {
      playerId: player.id,
      handPoints: handScore,
      penalty,
      totalForHand: handScore + penalty,
    };
  });
}

export function findHandWinner(
  players: Player[],
  scoredHands: ScoredHand[],
  goingOutPlayerId: string,
): string {
  const lowestScore = Math.min(...scoredHands.map((score) => score.totalForHand));
  const tiedPlayerIds = new Set(
    scoredHands.filter((score) => score.totalForHand === lowestScore).map((score) => score.playerId),
  );
  const goingOutIndex = players.findIndex((player) => player.id === goingOutPlayerId);

  if (goingOutIndex < 0) {
    throw new Error(`Unknown going-out player: ${goingOutPlayerId}`);
  }

  for (let offset = 0; offset < players.length; offset += 1) {
    const player = players[(goingOutIndex + offset) % players.length];

    if (player && tiedPlayerIds.has(player.id)) {
      return player.id;
    }
  }

  throw new Error("Unable to determine hand winner");
}

export function createInitialState(playerNames: string[], random = Math.random): GameState {
  if (playerNames.length < 2 || playerNames.length > 6) {
    throw new Error("Jaaga Game requires 2-6 players");
  }

  const deck = shuffle(createDeck(), random);
  const players: Player[] = playerNames.map((name, index) => {
    const hand = deck.slice(index * 5, index * 5 + 5);

    return {
      id: `player-${index + 1}`,
      name,
      hand,
      totalScore: 0,
    };
  });
  const firstDiscard = deck[playerNames.length * 5];

  if (!firstDiscard) {
    throw new Error("Deck did not contain enough cards to start the hand");
  }

  return {
    players,
    dealerIndex: 0,
    currentPlayerIndex: 1 % players.length,
    drawPile: deck.slice(playerNames.length * 5 + 1),
    discardSets: [{ playerId: "dealer", cards: [firstDiscard] }],
    handEnded: false,
  };
}

export function dealNewHand(state: GameState, dealerIndex: number, random = Math.random): GameState {
  if (state.players.length < 2 || state.players.length > 6) {
    throw new Error("Jaaga Game requires 2-6 players");
  }

  const deck = shuffle(createDeck(), random);
  const players = state.players.map((player, index) => ({
    ...player,
    hand: deck.slice(index * 5, index * 5 + 5),
  }));
  const firstDiscard = deck[players.length * 5];

  if (!firstDiscard) {
    throw new Error("Deck did not contain enough cards to start the hand");
  }

  return {
    players,
    dealerIndex,
    currentPlayerIndex: (dealerIndex + 1) % players.length,
    drawPile: deck.slice(players.length * 5 + 1),
    discardSets: [{ playerId: players[dealerIndex]?.id ?? "dealer", cards: [firstDiscard] }],
    handEnded: false,
  };
}

function isSameRankSet(cards: Card[]): boolean {
  const naturalCards = cards.filter(isStandardCard);

  if (naturalCards.length === 0) {
    return true;
  }

  const firstRank = naturalCards[0]?.rank;
  return naturalCards.every((card) => card.rank === firstRank);
}

function isStraightFlush(cards: Card[]): boolean {
  const naturalCards = cards.filter(isStandardCard);
  const jokerCount = cards.length - naturalCards.length;

  if (naturalCards.length === 0) {
    return true;
  }

  const firstSuit = naturalCards[0]?.suit;

  if (!firstSuit || naturalCards.some((card) => card.suit !== firstSuit)) {
    return false;
  }

  return canFormConsecutiveRanks(naturalCards.map((card) => card.rank), jokerCount, straightRanksLow)
    || canFormConsecutiveRanks(naturalCards.map((card) => card.rank), jokerCount, straightRanksHigh);
}

function canFormConsecutiveRanks(ranks: Rank[], jokerCount: number, rankOrder: Rank[]): boolean {
  const uniquePositions = [...new Set(ranks.map((rank) => rankOrder.indexOf(rank)))].sort((a, b) => a - b);

  if (uniquePositions.length !== ranks.length || uniquePositions.some((position) => position < 0)) {
    return false;
  }

  for (let start = 0; start <= rankOrder.length - ranks.length - jokerCount; start += 1) {
    const windowPositions = new Set(
      Array.from({ length: ranks.length + jokerCount }, (_value, offset) => start + offset),
    );

    if (uniquePositions.every((position) => windowPositions.has(position))) {
      return true;
    }
  }

  return false;
}

function isStandardCard(card: Card): card is StandardCard {
  return card.kind === "standard";
}
