import { describe, expect, it } from "vitest";
import { classifyDiscard, canGoOut, canSlap, dealNewHand, findHandWinner, scoreHand } from "./rules";
import type { Card, Player } from "./types";

const card = (rank: CardRank, suit: CardSuit): Card => ({
  kind: "standard",
  rank,
  suit,
  id: `${rank}-${suit}`,
});

const joker = (id = "joker-1"): Card => ({ kind: "joker", id });

type CardRank = Extract<Card, { kind: "standard" }>["rank"];
type CardSuit = Extract<Card, { kind: "standard" }>["suit"];

describe("Jaaga rules", () => {
  it("scores Aces, number cards, face cards, and Jokers", () => {
    expect(canGoOut([card("A", "spades"), card("4", "clubs")])).toBe(true);
    expect(canGoOut([card("K", "spades")])).toBe(false);
    expect(canGoOut([joker()])).toBe(true);
  });

  it("classifies legal discards", () => {
    expect(classifyDiscard([card("2", "clubs")])).toBe("single");
    expect(classifyDiscard([card("K", "clubs"), card("K", "hearts"), joker()])).toBe("same-rank");
    expect(classifyDiscard([card("A", "hearts"), card("2", "hearts"), card("3", "hearts")])).toBe(
      "straight-flush",
    );
    expect(classifyDiscard([card("Q", "spades"), card("K", "spades"), card("A", "spades")])).toBe(
      "straight-flush",
    );
    expect(classifyDiscard([card("K", "spades"), card("A", "spades"), card("2", "spades")])).toBeNull();
  });

  it("allows a slap when the drawn card extends the just-discarded set", () => {
    expect(canSlap([card("7", "clubs"), card("7", "hearts")], card("7", "spades"))).toBe(true);
    expect(canSlap([card("4", "hearts"), card("5", "hearts"), card("6", "hearts")], card("7", "hearts"))).toBe(
      true,
    );
    expect(canSlap([card("4", "hearts"), card("5", "hearts"), card("6", "hearts")], card("7", "clubs"))).toBe(
      false,
    );
    expect(canSlap([card("7", "clubs"), card("7", "hearts")], joker())).toBe(false);
  });

  it("scores the going-out player as 30 when another player has same or fewer points", () => {
    const players: Player[] = [
      player("p1", [card("2", "clubs"), card("3", "clubs")]),
      player("p2", [card("5", "hearts")]),
      player("p3", [joker()]),
    ];

    expect(scoreHand(players, "p1")).toEqual([
      { playerId: "p1", handPoints: 0, penalty: 30, totalForHand: 30 },
      { playerId: "p2", handPoints: 5, penalty: 0, totalForHand: 5 },
      { playerId: "p3", handPoints: 40, penalty: 0, totalForHand: 40 },
    ]);
  });

  it("scores the going-out player as 0 when they are lower than everyone else", () => {
    const players: Player[] = [
      player("p1", [card("2", "clubs")]),
      player("p2", [card("5", "hearts")]),
      player("p3", [joker()]),
    ];

    expect(scoreHand(players, "p1")).toEqual([
      { playerId: "p1", handPoints: 0, penalty: 0, totalForHand: 0 },
      { playerId: "p2", handPoints: 5, penalty: 0, totalForHand: 5 },
      { playerId: "p3", handPoints: 40, penalty: 0, totalForHand: 40 },
    ]);
  });

  it("breaks hand-winner ties by turn order from the going-out player", () => {
    const players: Player[] = [player("p1", []), player("p2", []), player("p3", [])];

    expect(
      findHandWinner(
        players,
        [
          { playerId: "p1", handPoints: 0, penalty: 30, totalForHand: 30 },
          { playerId: "p2", handPoints: 5, penalty: 0, totalForHand: 5 },
          { playerId: "p3", handPoints: 5, penalty: 0, totalForHand: 5 },
        ],
        "p1",
      ),
    ).toBe("p2");
  });

  it("deals a new hand from the previous winner while preserving total scores", () => {
    const nextState = dealNewHand(
      {
        players: [
          { ...player("p1", [card("K", "clubs")]), totalScore: 15 },
          { ...player("p2", [card("Q", "clubs")]), totalScore: 8 },
        ],
        dealerIndex: 0,
        currentPlayerIndex: 1,
        drawPile: [],
        discardSets: [],
        handEnded: true,
        handWinnerId: "p2",
      },
      1,
      () => 0.5,
    );

    expect(nextState.dealerIndex).toBe(1);
    expect(nextState.currentPlayerIndex).toBe(0);
    expect(nextState.players.map((nextPlayer) => nextPlayer.totalScore)).toEqual([15, 8]);
    expect(nextState.players.every((nextPlayer) => nextPlayer.hand.length === 5)).toBe(true);
    expect(nextState.discardSets).toHaveLength(1);
    expect(nextState.handEnded).toBe(false);
  });
});

function player(id: string, hand: Card[]): Player {
  return {
    id,
    name: id,
    hand,
    totalScore: 0,
  };
}
