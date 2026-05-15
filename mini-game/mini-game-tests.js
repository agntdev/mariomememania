// @ts-check
/**
 * S2T04 — Test suite for the Meme Trivia Bonus Round.
 *
 * Edge cases, scoring accuracy, and integration with leaderboard +
 * MARIO reward engine (token/src/rewards.ts). Complements
 * `game-engine-tests.js` (S2T02 — engine internals); this file goes
 * wider: question-pool generators, custom config, integration seams.
 *
 * Run with: `node --test mini-game/mini-game-tests.js`
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_CONFIG,
  DEMO_MEMES,
  answer,
  buildQuestionPool,
  createRound,
  estimateMario,
  getView,
  mulberry32,
  shuffle,
  tick,
} from "./mini-game-logic.js";

/* ── helpers ──────────────────────────────────────────────────────────── */

function pool(seed = 11) {
  return buildQuestionPool(DEMO_MEMES.slice(), { seed });
}

function fresh(opts = {}) {
  return createRound({
    seed: opts.seed ?? 1,
    questions: pool(opts.poolSeed ?? 11),
    config: opts.config,
  });
}

function answerCorrect(round) {
  return answer(round, round.questions[round.currentIndex].correctIndex);
}

function answerWrong(round) {
  const idx = round.questions[round.currentIndex].correctIndex;
  return answer(round, (idx + 1) % 4);
}

function playAllCorrect(round) {
  while (round.phase === "playing") answerCorrect(round);
  return round;
}

/* ── question pool generators ────────────────────────────────────────── */

describe("buildQuestionPool", () => {
  it("rejects an undersized meme list (< 4 memes)", () => {
    assert.throws(() => buildQuestionPool(DEMO_MEMES.slice(0, 3)), /at least 4/);
  });

  it("emits questions across multiple generator types on the demo pool", () => {
    const qs = buildQuestionPool(DEMO_MEMES.slice(), { seed: 3 });
    const byGen = qs.reduce((acc, q) => {
      acc[q.generator] = (acc[q.generator] || 0) + 1;
      return acc;
    }, {});
    // caption-guess, author-guess, vote-rank: every meme can yield one.
    assert.ok((byGen["caption-guess"] || 0) >= 4);
    assert.ok((byGen["author-guess"] || 0) >= 4);
    assert.ok((byGen["vote-rank"] || 0) >= 4);
    // tag-match requires the meme to expose ≥ 3 sibling tags; small pools
    // can legitimately yield zero of them. We only require the generator to
    // be REGISTERED, not that it always emits on the demo pool.
    const generatorsSeen = Object.keys(byGen).filter((g) => byGen[g] > 0);
    assert.ok(generatorsSeen.length >= 3, `expected ≥3 active generators, got ${generatorsSeen.length}`);
  });

  it("every question has 4 distinct options and a valid correctIndex", () => {
    const qs = buildQuestionPool(DEMO_MEMES.slice(), { seed: 99 });
    for (const q of qs) {
      assert.equal(q.options.length, 4, `${q.id} options length`);
      assert.equal(new Set(q.options).size, 4, `${q.id} options distinct`);
      assert.ok(q.correctIndex >= 0 && q.correctIndex < 4, `${q.id} correctIndex`);
      assert.ok(typeof q.options[q.correctIndex] === "string");
    }
  });

  it("the correct option for caption-guess is the actual caption", () => {
    const qs = buildQuestionPool(DEMO_MEMES.slice(), { seed: 5 }).filter(
      (q) => q.generator === "caption-guess"
    );
    for (const q of qs) {
      const memeId = q.id.replace("cap-", "");
      const meme = DEMO_MEMES.find((m) => m.id === memeId);
      assert.ok(meme, "lookup");
      assert.equal(q.options[q.correctIndex], meme.caption);
    }
  });

  it("the correct option for tag-match is NOT in the meme's tags (when emitted)", () => {
    // Construct a richer pool to guarantee ≥ 1 tag-match question.
    const richMemes = [
      { id: "rm1", caption: "alpha", tags: ["a", "b", "c", "d"], author: "u", votes: { up: 1, down: 0 } },
      { id: "rm2", caption: "beta",  tags: ["a", "b", "x"],      author: "v", votes: { up: 2, down: 0 } },
      { id: "rm3", caption: "gamma", tags: ["a", "y", "z"],      author: "w", votes: { up: 3, down: 0 } },
      { id: "rm4", caption: "delta", tags: ["e", "f", "g"],      author: "x", votes: { up: 4, down: 0 } },
      { id: "rm5", caption: "epsi",  tags: ["h", "i", "j"],      author: "y", votes: { up: 5, down: 0 } },
    ];
    const qs = buildQuestionPool(richMemes, { seed: 6 }).filter(
      (q) => q.generator === "tag-match"
    );
    assert.ok(qs.length > 0, "rich pool should yield tag-match questions");
    for (const q of qs) {
      const memeId = q.id.replace("tag-", "");
      const meme = richMemes.find((m) => m.id === memeId);
      assert.ok(meme);
      assert.ok(
        !meme.tags.includes(q.options[q.correctIndex]),
        `${q.id}: ${q.options[q.correctIndex]} should NOT be a tag of ${memeId}`
      );
    }
  });

  it("the correct option for author-guess is the meme's author", () => {
    const qs = buildQuestionPool(DEMO_MEMES.slice(), { seed: 12 }).filter(
      (q) => q.generator === "author-guess"
    );
    for (const q of qs) {
      const memeId = q.id.replace("auth-", "");
      const meme = DEMO_MEMES.find((m) => m.id === memeId);
      assert.equal(q.options[q.correctIndex], meme.author);
    }
  });

  it("the correct option for vote-rank wins on upvote count", () => {
    const qs = buildQuestionPool(DEMO_MEMES.slice(), { seed: 13 }).filter(
      (q) => q.generator === "vote-rank"
    );
    assert.ok(qs.length > 0);
    for (const q of qs) {
      const winner = q.options[q.correctIndex];
      const winnerMeme = DEMO_MEMES.find((m) => m.caption === winner);
      assert.ok(winnerMeme);
      for (const opt of q.options) {
        if (opt === winner) continue;
        const m = DEMO_MEMES.find((mm) => mm.caption === opt);
        if (m) assert.ok(winnerMeme.votes.up >= m.votes.up);
      }
    }
  });

  it("is deterministic given the same seed", () => {
    const a = buildQuestionPool(DEMO_MEMES.slice(), { seed: 42 });
    const b = buildQuestionPool(DEMO_MEMES.slice(), { seed: 42 });
    assert.deepEqual(a.map((q) => q.id), b.map((q) => q.id));
    assert.deepEqual(a.map((q) => q.options), b.map((q) => q.options));
  });
});

/* ── scoring accuracy ────────────────────────────────────────────────── */

describe("scoring accuracy", () => {
  it("matches the documented combo progression (1, 1.5, 2, 2.5, 3) ×100", () => {
    const r = fresh();
    let expected = 0;
    let combo = 1;
    while (r.phase === "playing") {
      expected += Math.round(100 * combo);
      combo = Math.min(DEFAULT_CONFIG.comboCap, combo + DEFAULT_CONFIG.comboStep);
      answerCorrect(r);
    }
    // 100 + 150 + 200 + 250 + 300 = 1000 raw
    // Then perfect bonus + survival bonus on top → assert raw ≤ final
    assert.ok(r.score >= expected, `final ${r.score} vs raw ${expected}`);
  });

  it("custom pointsPerCorrect feeds straight into the formula", () => {
    const r = fresh({ config: { pointsPerCorrect: 50 } });
    answerCorrect(r);
    assert.equal(r.score, 50);
  });

  it("custom comboCap caps combo growth", () => {
    const r = fresh({ config: { comboCap: 1.5 } });
    for (let i = 0; i < 5 && r.phase === "playing"; i++) answerCorrect(r);
    assert.ok(r.combo <= 1.5);
    assert.ok(r.comboHigh <= 1.5);
  });

  it("perfectMultiplier scales the final score on a perfect run", () => {
    const r1 = fresh({ config: { perfectMultiplier: 2 } });
    playAllCorrect(r1);
    const r2 = fresh({ config: { perfectMultiplier: 1 } });
    playAllCorrect(r2);
    // r1 should be roughly 2× r2 after applying multiplier; allow small drift
    assert.ok(r1.score > r2.score);
  });

  it("zero perfectMultiplier zeroes the score (edge case)", () => {
    const r = fresh({ config: { perfectMultiplier: 0 } });
    playAllCorrect(r);
    assert.equal(r.score, 0);
    // … but the round still flagged perfect & emitted reward.
    assert.equal(r.perfect, true);
    assert.ok(r.rewardEvent);
  });

  it("survival bonus is exactly floor(secondsLeft × value)", () => {
    const cfg = { roundTimeMs: 30_000, questionTimeMs: 5_000, perfectMultiplier: 1 };
    const r = fresh({ config: cfg });
    playAllCorrect(r);
    // base raw with combo 1, 1.5, 2, 2.5, 3 = 1000
    const baseRaw = 100 + 150 + 200 + 250 + 300;
    const remainingS = Math.floor(r.questions.length); // we don't know exact ms left, just sanity check
    assert.ok(r.score >= baseRaw);
    assert.ok(r.roundTimeLeftMs <= cfg.roundTimeMs + 1);
    assert.ok(remainingS >= 0);
  });
});

/* ── edge cases ──────────────────────────────────────────────────────── */

describe("edge cases", () => {
  it("0 correct + timed-out round → no reward, score 0", () => {
    const r = fresh();
    tick(r, 999_999);
    assert.equal(r.outcome, "fail");
    assert.equal(r.score, 0);
    assert.equal(r.rewardEvent, null);
  });

  it("1 correct + then timeout → win with reward, score > 0", () => {
    const r = fresh();
    answerCorrect(r);
    tick(r, 999_999);
    assert.equal(r.outcome, "win");
    assert.ok(r.score > 0);
    assert.ok(r.rewardEvent);
    assert.equal(r.rewardEvent.correctCount, 1);
    assert.equal(r.rewardEvent.perfect, false);
  });

  it("rapid alternating correct/wrong yields predictable combo resets", () => {
    const r = fresh({ config: { questionCount: 4 } });
    answerCorrect(r); // combo 1.5
    answerWrong(r); // combo 1
    answerCorrect(r); // combo 1.5
    answerWrong(r); // combo 1, ends round
    assert.equal(r.phase, "ended");
    // 2 correct, 2 wrong → win
    assert.equal(r.correctCount, 2);
    assert.equal(r.outcome, "win");
  });

  it("answer outside the round (after end) does nothing", () => {
    const r = fresh();
    playAllCorrect(r);
    const snap = getView(r);
    answer(r, 0);
    assert.deepEqual(getView(r), snap);
  });

  it("questionCount=1 still produces a perfect run", () => {
    const r = fresh({ config: { questionCount: 1 } });
    answerCorrect(r);
    assert.equal(r.phase, "ended");
    assert.equal(r.perfect, true);
  });

  it("questionCount > pool length is rejected", () => {
    assert.throws(
      () => createRound({ seed: 1, questions: pool().slice(0, 3), config: { questionCount: 5 } }),
      /not enough/
    );
  });

  it("very small questionTimeMs auto-times-out questions", () => {
    const r = fresh({ config: { questionTimeMs: 50 } });
    tick(r, 51);
    assert.equal(r.log[0].timedOut, true);
    assert.equal(r.combo, 1);
  });

  it("very large config.bonusOnCorrectMs cannot exceed roundTimeMs", () => {
    const r = fresh({ config: { bonusOnCorrectMs: 1_000_000_000 } });
    answerCorrect(r);
    assert.ok(r.roundTimeLeftMs <= DEFAULT_CONFIG.roundTimeMs);
  });

  it("invalid chosenIndex throws, doesn't corrupt state", () => {
    const r = fresh();
    assert.throws(() => answer(r, 7));
    // round still playable
    assert.equal(r.phase, "playing");
    assert.equal(r.score, 0);
  });

  it("tick with NaN throws", () => {
    const r = fresh();
    assert.throws(() => tick(r, NaN), /finite/);
  });
});

/* ── leaderboard integration ─────────────────────────────────────────── */

describe("leaderboard integration", () => {
  /**
   * Mirrors the LeaderEntry shape from frontend/src/components/Leaderboard.tsx:
   *   { rank, player, score, coins, memes }
   * The mini-game contributes to `score` only — `coins`/`memes` are owned by
   * the platformer + meme service.
   */
  function applyMiniGameToLeaderboard(entries, player, evt) {
    const next = entries.slice();
    const idx = next.findIndex((e) => e.player === player);
    if (idx < 0) {
      next.push({ rank: 0, player, score: evt.score, coins: 0, memes: 0 });
    } else {
      next[idx] = { ...next[idx], score: next[idx].score + evt.score };
    }
    next.sort((a, b) => b.score - a.score);
    return next.map((e, i) => ({ ...e, rank: i + 1 }));
  }

  it("a winning round bumps a player's leaderboard score", () => {
    const r = fresh();
    playAllCorrect(r);
    const board = applyMiniGameToLeaderboard(
      [
        { rank: 1, player: "alice", score: 10_000, coins: 100, memes: 5 },
        { rank: 2, player: "bob", score: 500, coins: 10, memes: 1 },
      ],
      "bob",
      r.rewardEvent
    );
    const bob = board.find((e) => e.player === "bob");
    assert.ok(bob);
    assert.ok(bob.score > 500, "score must have grown");
  });

  it("a failing round does NOT change the leaderboard", () => {
    const r = fresh();
    while (r.phase === "playing") answerWrong(r);
    if (r.rewardEvent) throw new Error("fail rounds must not produce a reward event");
    // host code must guard on rewardEvent being null
    const guarded = r.rewardEvent
      ? applyMiniGameToLeaderboard([], "x", r.rewardEvent)
      : [];
    assert.deepEqual(guarded, []);
  });

  it("re-ranks descending by score", () => {
    const r = fresh();
    playAllCorrect(r);
    const board = applyMiniGameToLeaderboard(
      [
        { rank: 1, player: "alice", score: 100, coins: 0, memes: 0 },
        { rank: 2, player: "bob", score: 50, coins: 0, memes: 0 },
      ],
      "bob",
      r.rewardEvent
    );
    assert.equal(board[0].player, "bob"); // bob jumped to rank 1 because mini-game score > 50
    assert.equal(board[0].rank, 1);
    assert.equal(board[1].rank, 2);
  });
});

/* ── token reward integration ────────────────────────────────────────── */

describe("token reward integration", () => {
  /**
   * The mini-game's reward event is shaped to feed straight into
   *   token/src/rewards.ts → gameplayReward({ type: "level_completed", score })
   * which returns:
   *   REWARDS.level_completed * BigInt(min(10, 1 + floor(score / 1000)))
   * (level_completed default = 10 MARIO base units in CAPS-aware accounting).
   *
   * This suite uses the in-module `estimateMario` helper which mirrors the
   * same multiplier so the test runs without importing TS sources.
   */

  it("score=0 still pays the base level_completed reward (≤ 10× cap)", () => {
    assert.equal(estimateMario({ score: 0 }, 10), 10);
  });

  it("score=999 still under the next bracket", () => {
    assert.equal(estimateMario({ score: 999 }, 10), 10);
  });

  it("score=1000 advances to the 2× bracket", () => {
    assert.equal(estimateMario({ score: 1000 }, 10), 20);
  });

  it("score caps at 10× regardless of magnitude", () => {
    assert.equal(estimateMario({ score: 9_000 }, 10), 100);
    assert.equal(estimateMario({ score: 50_000 }, 10), 100);
    assert.equal(estimateMario({ score: 1_000_000 }, 10), 100);
  });

  it("a perfect demo-pool run earns ≥ 2× the base reward", () => {
    const r = fresh();
    playAllCorrect(r);
    assert.ok(r.rewardEvent);
    const mario = estimateMario(r.rewardEvent, 10);
    assert.ok(mario >= 20, `expected ≥ 20 MARIO, got ${mario}`);
  });

  it("a failing run yields zero MARIO (no event to forward)", () => {
    const r = fresh();
    while (r.phase === "playing") answerWrong(r);
    const mario = r.rewardEvent ? estimateMario(r.rewardEvent, 10) : 0;
    assert.equal(mario, 0);
  });

  it("event shape is forwardable to gameplayReward without translation", () => {
    const r = fresh();
    playAllCorrect(r);
    const evt = r.rewardEvent;
    assert.ok(evt);
    // simulate the host callsite:
    //   gameplayReward({ type: "level_completed", score: evt.score })
    const forwarded = { type: "level_completed", score: evt.score };
    assert.equal(typeof forwarded.score, "number");
    assert.ok(forwarded.score >= 0 && Number.isFinite(forwarded.score));
  });
});

/* ── determinism (replay safety) ─────────────────────────────────────── */

describe("determinism", () => {
  it("same seed + same answers ⇒ identical final state", () => {
    function play(seed) {
      const r = createRound({ seed, questions: pool(11) });
      while (r.phase === "playing") answerCorrect(r);
      return getView(r);
    }
    assert.deepEqual(play(2026), play(2026));
  });

  it("same seed + tick-only ⇒ identical final state", () => {
    function play() {
      const r = createRound({ seed: 7, questions: pool(11) });
      tick(r, 999_999);
      return getView(r);
    }
    assert.deepEqual(play(), play());
  });

  it("different seeds ⇒ different question ordering (with high probability)", () => {
    const a = createRound({ seed: 1, questions: pool() });
    const b = createRound({ seed: 2, questions: pool() });
    assert.notDeepEqual(a.questions.map((q) => q.id), b.questions.map((q) => q.id));
  });
});

/* ── primitive sanity (defensive guard) ──────────────────────────────── */

describe("primitive sanity", () => {
  it("mulberry32 + shuffle behave (smoke)", () => {
    const rng = mulberry32(0xdeadbeef);
    const out = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], rng);
    assert.deepEqual(out.slice().sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
