// @ts-check
/**
 * Engine-layer tests for `mini-game-logic.js`.
 *
 * Focus: tick()/timer maths, win-lose state transitions, scoring & combo,
 * compatibility seam with the wider Mario game engine (reward event shape).
 *
 * Run with: `node --test mini-game/game-engine-tests.js`
 *
 * Note: broader logic-level tests (RNG, question pool, edge cases) live in
 * `mini-game/test/mini-game-tests.js` (S2T04). Together these two suites
 * are the gate for the mini-game package.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_CONFIG,
  DEMO_MEMES,
  buildQuestionPool,
  createRound,
  estimateMario,
  getView,
  mulberry32,
  shuffle,
  tick,
  answer,
} from "./mini-game-logic.js";

/* ── helpers ──────────────────────────────────────────────────────────── */

function pool(seed = 7) {
  return buildQuestionPool(DEMO_MEMES.slice(), { seed });
}

function fresh(opts = {}) {
  return createRound({ seed: opts.seed ?? 1, questions: pool(opts.poolSeed ?? 7), config: opts.config });
}

/** Answer the current question correctly. */
function answerCorrect(round) {
  return answer(round, round.questions[round.currentIndex].correctIndex);
}

/** Answer the current question wrong. */
function answerWrong(round) {
  const idx = round.questions[round.currentIndex].correctIndex;
  return answer(round, (idx + 1) % 4);
}

/* ── round factory ────────────────────────────────────────────────────── */

describe("createRound", () => {
  it("starts in 'playing' phase with full timers", () => {
    const r = fresh();
    assert.equal(r.phase, "playing");
    assert.equal(r.outcome, "none");
    assert.equal(r.score, 0);
    assert.equal(r.combo, 1);
    assert.equal(r.correctCount, 0);
    assert.equal(r.questionTimeLeftMs, DEFAULT_CONFIG.questionTimeMs);
    assert.equal(r.roundTimeLeftMs, DEFAULT_CONFIG.roundTimeMs);
    assert.equal(r.questions.length, DEFAULT_CONFIG.questionCount);
  });

  it("rejects an empty / undersized question pool", () => {
    assert.throws(() => createRound({ seed: 1, questions: [] }), /not enough questions/);
    assert.throws(
      () => createRound({ seed: 1, questions: pool().slice(0, 2) }),
      /not enough questions/
    );
  });

  it("rejects malformed questions", () => {
    const bad = [
      { id: "x", generator: "caption-guess", prompt: "?", options: ["a", "b", "c"], correctIndex: 0 },
      ...pool(),
    ];
    assert.throws(() => createRound({ seed: 1, questions: bad }), /4 options/);
  });

  it("rejects a non-finite seed", () => {
    assert.throws(() => createRound({ seed: NaN, questions: pool() }), /seed must be/);
  });

  it("is deterministic given a seed", () => {
    const a = createRound({ seed: 42, questions: pool() });
    const b = createRound({ seed: 42, questions: pool() });
    assert.deepEqual(
      a.questions.map((q) => q.id),
      b.questions.map((q) => q.id)
    );
  });

  it("draws a different ordering for a different seed", () => {
    const a = createRound({ seed: 1, questions: pool() });
    const b = createRound({ seed: 999, questions: pool() });
    assert.notDeepEqual(
      a.questions.map((q) => q.id),
      b.questions.map((q) => q.id)
    );
  });
});

/* ── tick / timer ─────────────────────────────────────────────────────── */

describe("tick", () => {
  it("drains both per-question and round timers", () => {
    const r = fresh();
    tick(r, 1500);
    assert.equal(r.questionTimeLeftMs, DEFAULT_CONFIG.questionTimeMs - 1500);
    assert.equal(r.roundTimeLeftMs, DEFAULT_CONFIG.roundTimeMs - 1500);
    assert.equal(r.elapsedMs, 1500);
    assert.equal(r.phase, "playing");
  });

  it("rejects negative deltas", () => {
    const r = fresh();
    assert.throws(() => tick(r, -1), /non-negative/);
  });

  it("ignores deltaMs=0 and is a no-op", () => {
    const r = fresh();
    tick(r, 0);
    assert.equal(r.elapsedMs, 0);
  });

  it("auto-records a wrong answer when the question timer expires", () => {
    const r = fresh();
    const firstQ = r.questions[0];
    tick(r, DEFAULT_CONFIG.questionTimeMs); // exhaust question 1
    assert.equal(r.answeredCount, 1);
    assert.equal(r.correctCount, 0);
    assert.equal(r.log[0].timedOut, true);
    assert.equal(r.log[0].chosenIndex, -1);
    assert.equal(r.log[0].questionId, firstQ.id);
    // moved to next question with a fresh per-question timer
    assert.equal(r.currentIndex, 1);
    assert.equal(r.questionTimeLeftMs, DEFAULT_CONFIG.questionTimeMs);
  });

  it("ends the round when the round timer hits zero", () => {
    const r = fresh();
    tick(r, DEFAULT_CONFIG.roundTimeMs + 1000);
    assert.equal(r.phase, "ended");
    assert.equal(r.roundTimeLeftMs, 0);
  });

  it("survives a single huge delta without skipping question boundaries", () => {
    const r = fresh();
    // 30s of nothing → must record several timeouts, not just one.
    tick(r, 30_000);
    // 30000 / 12000 = 2.5 → at least 2 questions must have timed out
    assert.ok(r.answeredCount >= 2, `expected ≥2 timed-out answers, got ${r.answeredCount}`);
    assert.equal(r.log.every((e) => e.timedOut), true);
  });

  it("treats tick() on an ended round as a no-op", () => {
    const r = fresh();
    tick(r, DEFAULT_CONFIG.roundTimeMs + 1000);
    const snap = getView(r);
    tick(r, 5000);
    assert.deepEqual(getView(r), snap);
  });
});

/* ── answer / scoring / combo ─────────────────────────────────────────── */

describe("answer", () => {
  it("scores 100 × combo on correct, advances combo by 0.5", () => {
    const r = fresh();
    answerCorrect(r);
    assert.equal(r.score, 100);
    assert.equal(r.combo, 1.5);
    assert.equal(r.correctCount, 1);
  });

  it("resets combo to 1 on wrong", () => {
    const r = fresh();
    answerCorrect(r); // combo 1.5
    answerCorrect(r); // combo 2.0, score 100 + 100*1.5 = 250
    assert.equal(r.combo, 2);
    assert.equal(r.score, 250);
    answerWrong(r); // combo back to 1
    assert.equal(r.combo, 1);
  });

  it("caps the combo multiplier at config.comboCap", () => {
    const r = fresh({ config: { comboCap: 2.5 } });
    for (let i = 0; i < 5 && r.phase === "playing"; i++) answerCorrect(r);
    assert.ok(r.combo <= 2.5);
  });

  it("rejects out-of-range chosenIndex", () => {
    const r = fresh();
    assert.throws(() => answer(r, 4), /0\.\.3/);
    assert.throws(() => answer(r, -1), /0\.\.3/);
    assert.throws(() => answer(r, 1.5), /0\.\.3/);
  });

  it("rewards extra time on correct, deducts on wrong", () => {
    const r = fresh();
    const beforeRound = r.roundTimeLeftMs;
    answerCorrect(r);
    assert.ok(r.roundTimeLeftMs >= beforeRound, "correct should not shrink round timer");
    const afterCorrect = r.roundTimeLeftMs;
    answerWrong(r);
    assert.ok(
      r.roundTimeLeftMs <= afterCorrect - DEFAULT_CONFIG.penaltyOnWrongMs + 1,
      "wrong should deduct penalty"
    );
  });

  it("never grows roundTimeLeftMs above the configured maximum", () => {
    const r = fresh();
    for (let i = 0; i < 4 && r.phase === "playing"; i++) answerCorrect(r);
    assert.ok(r.roundTimeLeftMs <= DEFAULT_CONFIG.roundTimeMs);
  });

  it("ends the round after the last question is answered", () => {
    const r = fresh();
    while (r.phase === "playing") answerCorrect(r);
    assert.equal(r.phase, "ended");
    assert.equal(r.outcome, "win");
  });

  it("answer() on an ended round is a no-op", () => {
    const r = fresh();
    while (r.phase === "playing") answerCorrect(r);
    const before = getView(r);
    answer(r, 0);
    assert.deepEqual(getView(r), before);
  });
});

/* ── win / lose / perfect ────────────────────────────────────────────── */

describe("win / lose conditions", () => {
  it("emits a reward event with outcome=win on >0 correct", () => {
    const r = fresh();
    answerCorrect(r);
    while (r.phase === "playing") answerWrong(r);
    assert.equal(r.outcome, "win");
    assert.ok(r.rewardEvent);
    assert.equal(r.rewardEvent?.type, "mini_game_completed");
    assert.equal(r.rewardEvent?.correctCount, 1);
    assert.equal(r.rewardEvent?.perfect, false);
  });

  it("emits NO reward and zeroes score on 0 correct", () => {
    const r = fresh();
    while (r.phase === "playing") answerWrong(r);
    assert.equal(r.outcome, "fail");
    assert.equal(r.score, 0);
    assert.equal(r.rewardEvent, null);
  });

  it("flags perfect rounds and applies the perfect multiplier", () => {
    const r = fresh();
    while (r.phase === "playing") answerCorrect(r);
    assert.equal(r.perfect, true);
    assert.equal(r.outcome, "win");
    assert.ok(r.score > 100 * r.questions.length, "perfect score should beat raw point total");
  });

  it("awards survival bonus only when the queue is finished early", () => {
    // Burn most of the round timer, then answer all correctly.
    const r = fresh();
    tick(r, 5_000);
    while (r.phase === "playing") answerCorrect(r);
    // remaining time should have produced bonus → score > base scoring
    const baseRaw = 100 * (1 + 1.5 + 2 + 2.5 + 3); // expected combo progression
    assert.ok(r.score >= Math.round(baseRaw * DEFAULT_CONFIG.perfectMultiplier));
  });
});

/* ── compatibility with the Mario engine reward seam ─────────────────── */

describe("mario engine compatibility", () => {
  it("reward event shape mirrors gameplayReward({type:'level_completed'})", () => {
    const r = fresh();
    while (r.phase === "playing") answerCorrect(r);
    const evt = r.rewardEvent;
    assert.ok(evt);
    // host integration: forward into token/src/rewards.ts
    // gameplayReward({ type: "level_completed", score: evt.score })
    assert.equal(typeof evt.score, "number");
    assert.ok(Number.isFinite(evt.score));
    assert.ok(evt.score >= 0);
  });

  it("estimateMario tracks the level_completed bracketing (×1..×10)", () => {
    const evt = { type: "mini_game_completed", score: 0, correctCount: 0, questionCount: 5, perfect: false, outcome: "win" };
    assert.equal(estimateMario(evt, 10), 10); // base
    assert.equal(estimateMario({ ...evt, score: 2_500 }, 10), 30); // 1+floor(2500/1000)=3
    assert.equal(estimateMario({ ...evt, score: 100_000 }, 10), 100); // capped at 10x
  });

  it("getView produces a JSON-safe snapshot", () => {
    const r = fresh();
    answerCorrect(r);
    const v = getView(r);
    const round = JSON.parse(JSON.stringify(v));
    assert.equal(round.phase, "playing");
    assert.equal(round.score, 100);
    assert.equal(round.currentQuestion?.options.length, 4);
  });
});

/* ── RNG primitives ──────────────────────────────────────────────────── */

describe("rng primitives", () => {
  it("mulberry32 is deterministic for a given seed", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 10; i++) assert.equal(a(), b());
  });

  it("mulberry32 produces values in [0, 1)", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const x = r();
      assert.ok(x >= 0 && x < 1, `out of range: ${x}`);
    }
  });

  it("shuffle returns a permutation, not a mutation of input", () => {
    const original = [1, 2, 3, 4, 5];
    const out = shuffle(original, mulberry32(1));
    assert.notEqual(out, original);
    assert.deepEqual(original, [1, 2, 3, 4, 5]);
    assert.deepEqual(out.slice().sort(), [1, 2, 3, 4, 5]);
  });
});
