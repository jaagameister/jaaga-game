import { formatCard } from "./game/cards";
import {
  createInitialState,
  canGoOut,
  canSlap,
  classifyDiscard,
  dealNewHand,
  findHandWinner,
  handPoints,
  scoreHand,
} from "./game/rules";
import type { Card, DiscardSet, GameState, ScoredHand } from "./game/types";
import "./styles.css";

type TurnPhase = "discard" | "draw";

type PendingSlap = {
  playerId: string;
  drawnCard: Card;
  discardIndex: number;
};

const actionDelayMs = 1_000;
const playerNames = ["North", "East", "South", "West"];
const humanPlayerId = "player-1";
let state = createInitialState(playerNames);
const app = document.querySelector<HTMLDivElement>("#app");
let robotTimer: number | undefined;

const ui = {
  phase: "discard" as TurnPhase,
  selectedCardIds: new Set<string>(),
  activeDiscardIndex: undefined as number | undefined,
  drawDiscardSet: latestDiscardSet(),
  pendingSlap: undefined as PendingSlap | undefined,
  lastScoredHand: [] as ScoredHand[],
  robotBusy: false,
  message: "Select one or more cards to discard.",
};

if (!app) {
  throw new Error("Missing app root");
}

const appRoot = app;

render();
scheduleRobotTurn();

function render(): void {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const latestDiscard = latestDiscardSet();
  const selectedCards = currentPlayer?.hand.filter((card) => ui.selectedCardIds.has(card.id)) ?? [];
  const selectedDiscardKind = classifyDiscard(selectedCards);
  const slapIsValid = ui.pendingSlap
    ? canSlap(state.discardSets[ui.pendingSlap.discardIndex]?.cards ?? [], ui.pendingSlap.drawnCard)
    : false;
  const turnIsActive = !state.handEnded;
  const humanTurn = currentPlayer?.id === humanPlayerId;
  const humanCanAct = turnIsActive && humanTurn && !ui.robotBusy;
  const humanCanSlap = turnIsActive && ui.pendingSlap?.playerId === humanPlayerId && slapIsValid;

  appRoot.innerHTML = `
    <section class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">Jaaga Game</p>
          <h1>Local rules prototype</h1>
        </div>
        <a href="/rules.md">Rules</a>
      </header>

      <section class="scoreboard">
        <div class="scoreboard-header">
          <div>
            <span>Scoreboard</span>
            <strong>${gameOverMessage()}</strong>
          </div>
          <button type="button" data-action="deal" ${!state.handEnded || !state.handWinnerId || gameIsOver() ? "disabled" : ""}>
            Deal
          </button>
        </div>
        <div class="scores">
          ${state.players
            .map(
              (player, index) => `
                <article class="score ${state.handWinnerId === player.id ? "winner" : ""}">
                  <span>${player.name}${index === state.dealerIndex ? " - Dealer" : ""}</span>
                  <strong>${player.totalScore}</strong>
                  <small>${lastHandScore(player.id)}</small>
                </article>
              `,
            )
            .join("")}
        </div>
      </section>

      <section class="table">
        <div class="pile">
          <span>Draw pile</span>
          <strong>${state.drawPile.length}</strong>
        </div>
        <div class="pile">
          <span>Last discard</span>
          <strong>${latestDiscard ? latestDiscard.cards.map(formatCard).join(" ") : "None"}</strong>
        </div>
        <div class="pile">
          <span>Draw from previous discard</span>
          <div class="discard-options">
            ${renderDiscardDrawOptions()}
          </div>
        </div>
      </section>

      <section class="controls">
        <div>
          <span>Turn</span>
          <strong>${currentPlayer?.name ?? "Unknown"}: ${ui.phase}${humanTurn ? "" : " robot"}</strong>
        </div>
        <div class="actions">
          <button type="button" data-action="go-out" ${!humanCanAct || ui.phase !== "discard" || !currentPlayer || !canGoOut(currentPlayer.hand) ? "disabled" : ""}>
            Go Out
          </button>
          <button type="button" data-action="discard" ${!humanCanAct || ui.phase !== "discard" || !selectedDiscardKind ? "disabled" : ""}>
            Discard
          </button>
          <button type="button" data-action="draw-pile" ${!humanCanAct || ui.phase !== "draw" || state.drawPile.length === 0 ? "disabled" : ""}>
            Draw
          </button>
          <button type="button" data-action="slap" ${!humanCanSlap ? "disabled" : ""}>
            Slap
          </button>
        </div>
      </section>

      <section class="players">
        ${state.players
          .map(
            (player, index) => `
              <article class="player ${index === state.currentPlayerIndex ? "active" : ""}">
                <div class="player-header">
                  <h2>${player.name}</h2>
                  <span>${handPoints(player.hand, 1)} min pts</span>
                </div>
                <div class="hand">
                  ${player.hand
                    .map(
                      (card) => `
                        <button
                          type="button"
                          class="card ${ui.selectedCardIds.has(card.id) ? "selected" : ""} ${ui.pendingSlap?.drawnCard.id === card.id ? "drawn" : ""}"
                          data-card-id="${card.id}"
                          ${!humanCanAct || index !== state.currentPlayerIndex || ui.phase !== "discard" ? "disabled" : ""}
                        >
                          ${formatCard(card)}
                        </button>
                      `,
                    )
                    .join("")}
                </div>
              </article>
            `,
          )
          .join("")}
      </section>

      <footer class="status">
        ${ui.message}
      </footer>
    </section>
  `;

  bindEvents();
}

function bindEvents(): void {
  appRoot.querySelectorAll<HTMLButtonElement>("[data-card-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const cardId = button.dataset.cardId;

      if (!cardId) {
        return;
      }

      if (ui.selectedCardIds.has(cardId)) {
        ui.selectedCardIds.delete(cardId);
      } else {
        ui.selectedCardIds.add(cardId);
      }

      render();
    });
  });

  appRoot.querySelector<HTMLButtonElement>("[data-action='discard']")?.addEventListener("click", discardSelectedCards);
  appRoot.querySelector<HTMLButtonElement>("[data-action='draw-pile']")?.addEventListener("click", drawFromPile);
  appRoot.querySelector<HTMLButtonElement>("[data-action='slap']")?.addEventListener("click", slap);
  appRoot.querySelector<HTMLButtonElement>("[data-action='go-out']")?.addEventListener("click", goOut);
  appRoot.querySelector<HTMLButtonElement>("[data-action='deal']")?.addEventListener("click", dealNextHand);

  appRoot.querySelectorAll<HTMLButtonElement>("[data-discard-card-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const cardId = button.dataset.discardCardId;

      if (cardId) {
        drawFromPreviousDiscard(cardId);
      }
    });
  });
}

function discardSelectedCards(): void {
  if (!isHumanTurn()) {
    return;
  }

  const currentPlayer = currentPlayerOrThrow();
  const selectedCards = currentPlayer.hand.filter((card) => ui.selectedCardIds.has(card.id));

  ui.pendingSlap = undefined;

  if (!classifyDiscard(selectedCards)) {
    ui.message = "That is not a legal discard.";
    render();
    return;
  }

  currentPlayer.hand = currentPlayer.hand.filter((card) => !ui.selectedCardIds.has(card.id));
  ui.activeDiscardIndex = state.discardSets.length;
  state.discardSets.push({ playerId: currentPlayer.id, cards: selectedCards });
  ui.selectedCardIds.clear();
  ui.phase = "draw";
  ui.message = `${currentPlayer.name} discarded ${selectedCards.map(formatCard).join(" ")}. Draw one card.`;
  render();
}

function drawFromPile(): void {
  if (!isHumanTurn()) {
    return;
  }

  const drawnCard = state.drawPile.shift();

  if (!drawnCard) {
    ui.message = "The draw pile is empty.";
    render();
    return;
  }

  keepDrawnCard(drawnCard);
}

function drawFromPreviousDiscard(cardId: string): void {
  if (!isHumanTurn()) {
    return;
  }

  if (ui.phase !== "draw" || !ui.drawDiscardSet) {
    return;
  }

  const cardIndex = ui.drawDiscardSet.cards.findIndex((card) => card.id === cardId);
  const drawnCard = ui.drawDiscardSet.cards[cardIndex];

  if (!drawnCard) {
    return;
  }

  ui.drawDiscardSet.cards.splice(cardIndex, 1);
  keepDrawnCard(drawnCard);
}

function keepDrawnCard(drawnCard: Card): void {
  const currentPlayer = currentPlayerOrThrow();

  currentPlayer.hand.push(drawnCard);
  ui.pendingSlap = ui.activeDiscardIndex === undefined
    ? undefined
    : {
        playerId: currentPlayer.id,
        drawnCard,
        discardIndex: ui.activeDiscardIndex,
      };
  advanceTurn(`${currentPlayer.name} drew ${formatCard(drawnCard)}.`);
}

function slap(): void {
  if (!ui.pendingSlap) {
    return;
  }

  if (ui.pendingSlap.playerId === humanPlayerId) {
    clearRobotTimer();
  }

  const { playerId, drawnCard, discardIndex } = ui.pendingSlap;
  const activeDiscard = state.discardSets[discardIndex];

  if (!activeDiscard || !canSlap(activeDiscard.cards, drawnCard)) {
    ui.message = "That slap is not valid.";
    render();
    return;
  }

  const slappingPlayer = state.players.find((player) => player.id === playerId);

  if (!slappingPlayer) {
    throw new Error(`Unknown slapping player: ${playerId}`);
  }

  slappingPlayer.hand = slappingPlayer.hand.filter((card) => card.id !== drawnCard.id);
  activeDiscard.cards.push(drawnCard);
  ui.pendingSlap = undefined;
  ui.message = `${slappingPlayer.name} slapped ${formatCard(drawnCard)} onto the discard. ${currentPlayerOrThrow().name} is up.`;
  render();
  scheduleRobotTurn();
}

function goOut(): void {
  if (!isHumanTurn()) {
    return;
  }

  const currentPlayer = currentPlayerOrThrow();

  if (!canGoOut(currentPlayer.hand)) {
    ui.message = `${currentPlayer.name} cannot go out with more than 5 points.`;
    render();
    return;
  }

  const scoredHands = scoreHand(state.players, currentPlayer.id);
  const winnerId = findHandWinner(state.players, scoredHands, currentPlayer.id);
  const winner = state.players.find((player) => player.id === winnerId);

  applyScores(scoredHands);
  state.handEnded = true;
  state.handWinnerId = winnerId;
  ui.pendingSlap = undefined;
  ui.selectedCardIds.clear();
  ui.lastScoredHand = scoredHands;
  ui.message = `${currentPlayer.name} went out. ${winner?.name ?? "Unknown"} wins the hand. ${scoredHands
    .map((score) => `${playerName(score.playerId)}: ${score.totalForHand}`)
    .join(", ")}.`;
  render();
  clearRobotTimer();
}

function dealNextHand(): void {
  if (!state.handEnded || !state.handWinnerId || gameIsOver()) {
    return;
  }

  const dealerIndex = state.players.findIndex((player) => player.id === state.handWinnerId);
  const dealer = state.players[dealerIndex];

  if (!dealer) {
    throw new Error(`Unknown dealer: ${state.handWinnerId}`);
  }

  state = dealNewHand(state, dealerIndex);
  ui.phase = "discard";
  ui.selectedCardIds.clear();
  ui.activeDiscardIndex = undefined;
  ui.drawDiscardSet = latestDiscardSet();
  ui.pendingSlap = undefined;
  ui.lastScoredHand = [];
  ui.message = `${dealer.name} dealt the next hand. ${currentPlayerOrThrow().name} is up.`;
  render();
  scheduleRobotTurn();
}

function advanceTurn(previousAction: string): void {
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  ui.phase = "discard";
  ui.selectedCardIds.clear();
  ui.activeDiscardIndex = undefined;
  ui.drawDiscardSet = latestDiscardSet();
  ui.message = `${previousAction} ${currentPlayerOrThrow().name} is up. They may slap before discarding.`;
  render();
  scheduleRobotTurn();
}

function renderDiscardDrawOptions(): string {
  if (!isHumanTurn() || ui.phase !== "draw" || !ui.drawDiscardSet || ui.drawDiscardSet.cards.length === 0) {
    return `<span class="muted">Unavailable</span>`;
  }

  return ui.drawDiscardSet.cards
    .map(
      (card) => `
        <button type="button" class="discard-card" data-discard-card-id="${card.id}">
          ${formatCard(card)}
        </button>
      `,
    )
    .join("");
}

function latestDiscardSet(): DiscardSet | undefined {
  return state.discardSets.at(-1);
}

function currentPlayerOrThrow() {
  const player = state.players[state.currentPlayerIndex];

  if (!player) {
    throw new Error("Current player is missing");
  }

  return player;
}

function playerName(playerId: string): string {
  return state.players.find((player) => player.id === playerId)?.name ?? playerId;
}

function scheduleRobotTurn(): void {
  clearRobotTimer();

  if (state.handEnded || gameIsOver()) {
    ui.robotBusy = false;
    return;
  }

  if (ui.pendingSlap && ui.pendingSlap.playerId !== humanPlayerId && pendingSlapIsValid()) {
    ui.robotBusy = true;
    robotTimer = window.setTimeout(() => {
      ui.robotBusy = false;
      slap();
    }, actionDelayMs);
    render();
    return;
  }

  const currentPlayer = currentPlayerOrThrow();

  if (currentPlayer.id === humanPlayerId) {
    ui.robotBusy = false;
    render();
    return;
  }

  ui.robotBusy = true;
  robotTimer = window.setTimeout(() => {
    ui.robotBusy = false;
    takeRobotAction();
  }, actionDelayMs);
  render();
}

function takeRobotAction(): void {
  if (state.handEnded || gameIsOver()) {
    return;
  }

  const currentPlayer = currentPlayerOrThrow();

  if (currentPlayer.id === humanPlayerId) {
    render();
    return;
  }

  if (ui.phase === "discard") {
    if (canGoOut(currentPlayer.hand)) {
      goOutForPlayer(currentPlayer.id);
      return;
    }

    discardCardsForPlayer(currentPlayer.id, chooseRobotDiscard(currentPlayer.hand));
    return;
  }

  drawForRobot();
}

function discardCardsForPlayer(playerId: string, cards: Card[]): void {
  const player = state.players.find((candidate) => candidate.id === playerId);

  if (!player || !classifyDiscard(cards)) {
    throw new Error(`Robot selected an invalid discard for ${playerId}`);
  }

  ui.pendingSlap = undefined;
  player.hand = player.hand.filter((card) => !cards.some((discardedCard) => discardedCard.id === card.id));
  ui.activeDiscardIndex = state.discardSets.length;
  state.discardSets.push({ playerId, cards });
  ui.phase = "draw";
  ui.message = `${player.name} discarded ${cards.map(formatCard).join(" ")}.`;
  render();
  scheduleRobotTurn();
}

function drawForRobot(): void {
  const currentPlayer = currentPlayerOrThrow();
  const discardDraw = chooseRobotDiscardDraw();

  if (discardDraw) {
    const cardIndex = discardDraw.source.cards.findIndex((card) => card.id === discardDraw.card.id);

    if (cardIndex >= 0) {
      discardDraw.source.cards.splice(cardIndex, 1);
      keepDrawnCard(discardDraw.card);
      return;
    }
  }

  const drawnCard = state.drawPile.shift();

  if (!drawnCard) {
    ui.message = `${currentPlayer.name} cannot draw because the draw pile is empty.`;
    render();
    return;
  }

  keepDrawnCard(drawnCard);
}

function chooseRobotDiscard(hand: Card[]): Card[] {
  const sameRankSet = bestSameRankSet(hand);
  const straight = bestStraightFlush(hand);
  const candidates = [sameRankSet, straight, ...hand.map((card) => [card])].filter((cards) => cards.length > 0);
  const bestCandidate = candidates.sort((left, right) => discardValue(right) - discardValue(left))[0];

  if (bestCandidate) {
    return bestCandidate;
  }

  const fallbackCard = hand[0];
  return fallbackCard ? [fallbackCard] : [];
}

function bestSameRankSet(hand: Card[]): Card[] {
  const groups = new Map<string, Card[]>();

  for (const card of hand) {
    const key = card.kind === "joker" ? "joker" : card.rank;
    groups.set(key, [...(groups.get(key) ?? []), card]);
  }

  return [...groups.values()]
    .filter((cards) => cards.length > 1 && classifyDiscard(cards))
    .sort((left, right) => discardValue(right) - discardValue(left))[0] ?? [];
}

function bestStraightFlush(hand: Card[]): Card[] {
  const validStraights: Card[][] = [];

  for (let start = 0; start < hand.length; start += 1) {
    for (let end = start + 3; end <= hand.length; end += 1) {
      const candidate = hand.slice(start, end);

      if (classifyDiscard(candidate) === "straight-flush") {
        validStraights.push(candidate);
      }
    }
  }

  return validStraights.sort((left, right) => discardValue(right) - discardValue(left))[0] ?? [];
}

function chooseRobotDiscardDraw(): { source: DiscardSet; card: Card } | undefined {
  const source = ui.drawDiscardSet;

  if (!source || source.cards.length === 0) {
    return undefined;
  }

  const bestCard = [...source.cards].sort((left, right) => robotCardValue(left) - robotCardValue(right))[0];

  if (!bestCard || robotCardValue(bestCard) > 5) {
    return undefined;
  }

  return { source, card: bestCard };
}

function discardValue(cards: Card[]): number {
  return cards.reduce((total, card) => total + robotCardValue(card), 0);
}

function robotCardValue(card: Card): number {
  if (card.kind === "joker") {
    return 40;
  }

  return handPoints([card], 40);
}

function goOutForPlayer(playerId: string): void {
  const player = state.players.find((candidate) => candidate.id === playerId);

  if (!player) {
    throw new Error(`Unknown player: ${playerId}`);
  }

  const scoredHands = scoreHand(state.players, player.id);
  const winnerId = findHandWinner(state.players, scoredHands, player.id);
  const winner = state.players.find((candidate) => candidate.id === winnerId);

  applyScores(scoredHands);
  state.handEnded = true;
  state.handWinnerId = winnerId;
  ui.pendingSlap = undefined;
  ui.selectedCardIds.clear();
  ui.lastScoredHand = scoredHands;
  ui.message = `${player.name} went out. ${winner?.name ?? "Unknown"} wins the hand. ${scoredHands
    .map((score) => `${playerName(score.playerId)}: ${score.totalForHand}`)
    .join(", ")}.`;
  render();
  clearRobotTimer();
}

function pendingSlapIsValid(): boolean {
  return ui.pendingSlap
    ? canSlap(state.discardSets[ui.pendingSlap.discardIndex]?.cards ?? [], ui.pendingSlap.drawnCard)
    : false;
}

function isHumanTurn(): boolean {
  return currentPlayerOrThrow().id === humanPlayerId;
}

function clearRobotTimer(): void {
  if (robotTimer !== undefined) {
    window.clearTimeout(robotTimer);
    robotTimer = undefined;
  }
}

function applyScores(scoredHands: ScoredHand[]): void {
  for (const score of scoredHands) {
    const player = state.players.find((candidate) => candidate.id === score.playerId);

    if (player) {
      player.totalScore += score.totalForHand;
    }
  }
}

function lastHandScore(playerId: string): string {
  const score = ui.lastScoredHand.find((candidate) => candidate.playerId === playerId);

  if (!score) {
    return "Last hand: -";
  }

  if (score.penalty > 0) {
    return `Last hand: ${score.totalForHand} penalty`;
  }

  return `Last hand: ${score.totalForHand}`;
}

function gameIsOver(): boolean {
  return state.players.some((player) => player.totalScore >= 100);
}

function gameOverMessage(): string {
  if (!gameIsOver()) {
    return "Current score";
  }

  const leader = [...state.players].sort((left, right) => left.totalScore - right.totalScore)[0];
  return `Game over: ${leader?.name ?? "Unknown"} wins`;
}
