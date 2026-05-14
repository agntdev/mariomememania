# Mini Game Design — Meme Trivia Bonus Round

**Project:** MarioMemeMania · Season 2 · Mini Game
**Status:** Design (S2T01)
**Owner:** agnt: pewpewgogo
**Related issues:** #21 (S2T01), #22 (S2T02), #23 (S2T03), #24 (S2T04)

---

## 1. Concept

Between regular Phaser platformer levels (`game/src/scenes/GameScene.ts`),
the player is offered an optional **Meme Trivia Bonus Round** — a short, time-boxed
mini game that surfaces real community memes from the meme service
(`memes/src/memeService.ts`) and asks the player to answer multiple-choice
questions about them (caption guess, original poster, tag match, vote count, …).

Correct answers chain into a combo multiplier; wrong answers cost a tick of the
round timer. Surviving the round awards bonus MARIO that piggy-backs on the
existing reward engine (`token/src/rewards.ts`, `meme_voted` /
`level_completed` style events) so no new on-chain plumbing is needed.

The mini game is **fully self-contained** in a new `mini-game/` package and
exposes:

1. A pure logic module (`mini-game-logic.js`) — engine-free, deterministic,
   testable in Node.
2. A React UI surface (`MiniGame.jsx` + `game-styles.css`) that mounts inside
   the existing `frontend/` shell.
3. Two test suites (`game-engine-tests.js`, `mini-game-tests.js`) that run
   under `node --test`.

---

## 2. Goals & Non-Goals

### Goals
- Add replay value between platformer levels without touching `GameScene`'s
  fragile state machine.
- Reuse the meme corpus the community has already produced — no new content
  pipeline.
- Make the mini game **deterministic given a seed**, so tests and replays are
  reproducible.
- Keep all rewards inside the existing MARIO economy daily caps
  (`token/src/config.ts → CAPS`).

### Non-Goals
- Multiplayer / live PvP (out of scope for Season 2).
- New token issuance — we only emit existing reward events.
- Persistent server-side state — the round is client-side; the server is only
  consulted for the meme list and final score submission.

---

## 3. Player Flow

```
[Level N complete]
        │
        ▼
   ┌──────────────┐  Skip
   │ Bonus offer  │ ───────────▶ [Level N+1]
   └──────┬───────┘
          │ Accept
          ▼
   ┌──────────────────────────┐
   │ Round start (60s timer)  │
   │  - 5 questions queued    │
   │  - combo multiplier x1   │
   └──────┬───────────────────┘
          │  per question:
          ▼
   ┌──────────────┐  correct (+score, +combo, +2s)
   │ Question UI  │ ───────────────────────────────┐
   └──────┬───────┘                                │
          │ wrong / timeout (-3s, combo→1)         │
          ▼                                        │
   ┌──────────────┐                                │
   │ Round result │ ◀──────────────────────────────┘
   │  - final $   │
   │  - bonus $$$ │
   └──────┬───────┘
          ▼
     [Level N+1]
```

---

## 4. Rules

| Rule                       | Value / Behaviour                                                            |
|----------------------------|-------------------------------------------------------------------------------|
| Round length               | `60s` base, `+2s` per correct answer, `-3s` on wrong / timeout                |
| Questions per round        | `5` (configurable via `MiniGameConfig.questionCount`)                         |
| Question time              | `12s` per question (auto-advances on timeout, counted as wrong)               |
| Score per correct          | `100 × comboMultiplier`                                                       |
| Combo multiplier           | starts at `1`, `+0.5` per correct (cap `5x`), resets to `1` on wrong          |
| Survival bonus             | If timer > 0 at end: `score += remainingSeconds × 10`                         |
| Perfect-round bonus        | All 5 correct → `score × 1.5` and `perfect=true` flag                         |
| MARIO reward               | Emit `gameplayReward({ type: "level_completed", score: finalScore })` event   |
| Daily cap                  | Inherits `CAPS.gameplayPerDay` from `token/src/config.ts`                     |
| Skip cost                  | None — pure opt-in                                                            |

### Win / Lose

- **Win:** at least 1 correct answer AND timer reaches 0 OR all 5 answered.
- **Lose:** timer hits 0 with 0 correct → `score=0`, no reward emitted, round
  ends with `outcome: "fail"`.

### Anti-cheese

- Each question's correct option index is determined by the round seed
  (`mulberry32(seed)`), so two clients with the same seed see the same
  ordering — easy to detect score forgery server-side later.
- Question pool is shuffled per round; no question repeats inside a single
  round.

---

## 5. Question Types

Driven from real meme records (`memes/src/types.ts`). The logic module
declares an internal `QuestionGenerator` interface; v1 ships these four:

| Generator         | Prompt                                          | Distractor source                |
|-------------------|--------------------------------------------------|----------------------------------|
| `caption-guess`   | "Which caption belongs to this meme?"           | 3 random other meme captions     |
| `tag-match`       | "Which tag does this meme NOT have?"            | mix of present + absent tags     |
| `author-guess`    | "Who uploaded this meme?"                       | 3 other authors from the pool    |
| `vote-rank`       | "Which of these has the most upvotes?"          | 3 other memes (rendered as thumbs) |

Each generator produces a `Question`:

```ts
type Question = {
  id: string;
  prompt: string;
  options: string[];     // 4 options
  correctIndex: number;  // 0..3
  meme?: MemeRef;        // optional, for image rendering
  generator: QuestionType;
};
```

---

## 6. Architecture

```
mini-game/
├── package.json              # node --test runner, no runtime deps
├── README.md
├── src/
│   ├── mini-game-logic.js    # pure engine: state machine, scoring, RNG
│   ├── question-pool.js      # generators + meme adapter
│   ├── MiniGame.jsx          # React UI shell (renders into frontend/)
│   └── game-styles.css       # Mario-themed pixel styling
└── test/
    ├── mini-game-tests.js    # logic + integration tests
    └── game-engine-tests.js  # tick / timer / event-bus tests
```

### Logic module API (`mini-game-logic.js`)

```js
import { createRound, tick, answer, getView } from "./mini-game-logic.js";

const round = createRound({
  seed: 42,
  questions,                 // Question[] from question-pool
  config: { questionTimeMs: 12_000, roundTimeMs: 60_000 },
});

tick(round, deltaMs);        // advance time
answer(round, optionIndex);  // submit answer for current question
const view = getView(round); // { phase, score, combo, timer, currentQuestion }
```

The round is a plain JS object (no class) → trivially serialisable, easy to
snapshot for replays and tests.

### Integration touch-points

| System                              | Touch                                                             |
|-------------------------------------|-------------------------------------------------------------------|
| `game/src/scenes/GameScene.ts`      | After flag-touch event, post `window.postMessage('mm:bonus')` and  |
|                                     | `pause()` until UI reports back.                                  |
| `frontend/src/App.tsx`              | Mount `<MiniGame />` overlay when the postMessage arrives.        |
| `memes/src/memeService.ts`          | `GET /memes?limit=200` to seed the question pool.                 |
| `token/src/rewards.ts`              | On round end → `gameplayReward({ type: "level_completed", ... })` |
| `frontend` Leaderboard              | Score is added to existing total — no schema change.              |

No existing files are mutated by S2T01. Hooks land in S2T03 (UI integration).

---

## 7. Testing Strategy

| Layer                       | File                            | Covers                                                |
|-----------------------------|----------------------------------|-------------------------------------------------------|
| Pure scoring & state machine | `test/mini-game-tests.js`       | createRound, scoring, combo, perfect bonus, fail path |
| Tick loop, timers, events   | `test/game-engine-tests.js`     | deltaMs ticks, question timeout, round expiration     |
| Question generators         | `test/mini-game-tests.js`       | each generator produces 4 unique options, 1 correct    |
| Determinism                 | `test/mini-game-tests.js`       | same seed → same question order & correct indices     |

Run with `npm test` inside `mini-game/`. Same convention as `memes/` and
`token/` packages — added to the existing GitHub Actions matrix.

---

## 8. Risks & Mitigations

| Risk                                     | Mitigation                                                 |
|------------------------------------------|------------------------------------------------------------|
| Empty meme pool → no questions           | Logic falls back to a 12-meme **builtin demo pool** seeded |
|                                          | from `mini-game/src/question-pool.js`.                     |
| Frontend stalls during fetch             | UI shows a 2s spinner; logic round only starts after pool  |
|                                          | resolves; spinner timeouts produce a graceful skip.        |
| Reward farming via replays               | Round seed is server-attested in v2; v1 trusts client and  |
|                                          | relies on existing daily cap.                              |
| Phaser scene state corruption on resume  | We `pause()` not `stop()` the scene; resume restores cam   |
|                                          | & input. Covered by manual QA in S2T04.                    |

---

## 9. Acceptance Criteria

- `mini-game/src/mini-game-logic.js` exposes the documented API.
- `MiniGame.jsx` renders a 4-option question card with timer & score.
- `game-styles.css` matches the existing Mario palette
  (`frontend/src/styles/global.css` tokens).
- `npm test` passes inside `mini-game/`.
- A round emits exactly one `gameplayReward` call on success and zero on
  fail.
- Documented in this file (S2T01), implemented in S2T02, integrated in S2T03,
  exhaustively tested in S2T04.

---

_Last updated: 2026-05-14 by pewpewgogo (Season 2 mini-game design)._
