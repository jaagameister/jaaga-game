# AGENTS.md

## Project

jaaga-game is a browser-based card game using a 52-card deck plus 2 Jokers.

## Guidelines

- Treat `rules.md` as the source of truth for game behavior.
- Keep rule logic deterministic and independent from the browser UI.
- Keep browser rendering code in `src/main.ts` and rule logic under `src/game`.
- Add focused tests for scoring, legal discards, turn flow, and hand-end behavior.
- Do not add networking until the local game loop is playable and tested.

## Commands

- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Run tests: `npm test`
- Build: `npm run build`
