// @ts-check
/**
 * MarioMemeMania — Meme Trivia Bonus Round.
 *
 * Pure, engine-free game logic. Designed in
 * `mini-game/mini-game-design.md` (S2T01) and exposed here for the React UI
 * (S2T03) and the test suites (S2T04).
 *
 * Compatibility: runs in Node 20+ and any modern browser. Zero deps.
 *
 * Round lifecycle:
 *
 *     idle ──start()──▶ playing ──tick()/answer()──▶ ended
 *
 * State is held in a plain object so it is trivially serialisable for replays
 * and snapshot tests.
 */

/** @typedef {"caption-guess"|"tag-match"|"author-guess"|"vote-rank"} QuestionType */

/**
 * @typedef {object} MemeRef
 * @property {string} id
 * @property {string} thumbUrl
 */

/**
 * @typedef {object} Question
 * @property {string} id
 * @property {QuestionType} generator
 * @property {string} prompt
 * @property {string[]} options                4 distinct strings
 * @property {number} correctIndex             0..3
 * @property {MemeRef=} meme
 */

/**
 * @typedef {object} MiniGameConfig
 * @property {number} [questionCount=5]
 * @property {number} [questionTimeMs=12000]
 * @property {number} [roundTimeMs=60000]
 * @property {number} [pointsPerCorrect=100]
 * @property {number} [comboStep=0.5]
 * @property {number} [comboCap=5]
 * @property {number} [bonusOnCorrectMs=2000]
 * @property {number} [penaltyOnWrongMs=3000]
 * @property {number} [survivalSecondsValue=10]
 * @property {number} [perfectMultiplier=1.5]
 */

/**
 * @typedef {"idle"|"playing"|"ended"} Phase
 * @typedef {"win"|"fail"|"none"} Outcome
 */

/**
 * @typedef {object} AnswerLogEntry
 * @property {string} questionId
 * @property {number} chosenIndex
 * @property {number} correctIndex
 * @property {boolean} correct
 * @property {number} pointsAwarded
 * @property {number} comboAfter
 * @property {number} timeLeftAfterMs
 * @property {boolean} timedOut
 */

/**
 * @typedef {object} RoundState
 * @property {Phase} phase
 * @property {Outcome} outcome
 * @property {number} seed
 * @property {Question[]} questions          shuffled queue
 * @property {number} currentIndex           index into `questions`
 * @property {number} score
 * @property {number} combo                  current multiplier (>=1)
 * @property {number} comboHigh              best combo reached
 * @property {number} correctCount
 * @property {number} answeredCount
 * @property {number} questionTimeLeftMs
 * @property {number} roundTimeLeftMs
 * @property {number} elapsedMs
 * @property {boolean} perfect
 * @property {AnswerLogEntry[]} log
 * @property {Required<MiniGameConfig>} config
 * @property {RewardEvent|null} rewardEvent  emitted on round end
 */

/**
 * @typedef {object} RewardEvent
 * Mirrors `gameplayReward({ type: "level_completed", score })` in
 * `token/src/rewards.ts`. Re-emitted via the host application — this module
 * does not import the token package directly so it stays dependency-free.
 * @property {"mini_game_completed"} type
 * @property {number} score
 * @property {number} correctCount
 * @property {number} questionCount
 * @property {boolean} perfect
 * @property {Outcome} outcome
 */

/** @type {Required<MiniGameConfig>} */
export const DEFAULT_CONFIG = Object.freeze({
  questionCount: 5,
  questionTimeMs: 12_000,
  roundTimeMs: 60_000,
  pointsPerCorrect: 100,
  comboStep: 0.5,
  comboCap: 5,
  bonusOnCorrectMs: 2_000,
  penaltyOnWrongMs: 3_000,
  survivalSecondsValue: 10,
  perfectMultiplier: 1.5,
});

/* ── RNG ──────────────────────────────────────────────────────────────── */

/**
 * Deterministic 32-bit PRNG (mulberry32). Same seed → same stream.
 * @param {number} seed
 * @returns {() => number} next() → [0, 1)
 */
export function mulberry32(seed) {
  let t = (seed >>> 0) || 1;
  return function next() {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher–Yates shuffle. Pure: returns a new array, leaves input untouched.
 * @template T
 * @param {readonly T[]} arr
 * @param {() => number} rng
 * @returns {T[]}
 */
export function shuffle(arr, rng) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/* ── Round factory ────────────────────────────────────────────────────── */

/**
 * Create a fresh round in `playing` phase.
 *
 * @param {object} opts
 * @param {number} opts.seed
 * @param {Question[]} opts.questions   pool to draw from (≥ questionCount)
 * @param {MiniGameConfig=} opts.config
 * @returns {RoundState}
 */
export function createRound({ seed, questions, config = {} }) {
  /** @type {Required<MiniGameConfig>} */
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (!Number.isInteger(cfg.questionCount) || cfg.questionCount <= 0) {
    throw new Error("questionCount must be a positive integer");
  }
  if (!Array.isArray(questions) || questions.length < cfg.questionCount) {
    throw new Error(
      `not enough questions: need ${cfg.questionCount}, got ${questions?.length ?? 0}`
    );
  }
  for (const q of questions) {
    assertQuestion(q);
  }
  if (!Number.isFinite(seed)) {
    throw new Error("seed must be a finite number");
  }

  const rng = mulberry32(seed | 0);
  const queue = shuffle(questions, rng).slice(0, cfg.questionCount);

  return {
    phase: "playing",
    outcome: "none",
    seed: seed | 0,
    questions: queue,
    currentIndex: 0,
    score: 0,
    combo: 1,
    comboHigh: 1,
    correctCount: 0,
    answeredCount: 0,
    questionTimeLeftMs: cfg.questionTimeMs,
    roundTimeLeftMs: cfg.roundTimeMs,
    elapsedMs: 0,
    perfect: false,
    log: [],
    config: cfg,
    rewardEvent: null,
  };
}

/** @param {Question} q */
function assertQuestion(q) {
  if (!q || typeof q !== "object") throw new Error("question must be an object");
  if (typeof q.id !== "string" || !q.id) throw new Error("question.id required");
  if (!Array.isArray(q.options) || q.options.length !== 4) {
    throw new Error(`question ${q.id} must have exactly 4 options`);
  }
  if (new Set(q.options).size !== 4) {
    throw new Error(`question ${q.id} options must be distinct`);
  }
  if (
    !Number.isInteger(q.correctIndex) ||
    q.correctIndex < 0 ||
    q.correctIndex > 3
  ) {
    throw new Error(`question ${q.id} correctIndex must be 0..3`);
  }
}

/* ── Engine: tick + answer ────────────────────────────────────────────── */

/**
 * Advance the round by `deltaMs`. Drains both the per-question timer and the
 * round timer. If the question timer hits zero, the current question is
 * recorded as a wrong answer and the next one is dealt. If the round timer
 * hits zero, the round ends.
 *
 * @param {RoundState} round
 * @param {number} deltaMs
 * @returns {RoundState} same reference (mutates in place)
 */
export function tick(round, deltaMs) {
  if (round.phase !== "playing") return round;
  if (!Number.isFinite(deltaMs) || deltaMs < 0) {
    throw new Error("deltaMs must be a non-negative finite number");
  }
  if (deltaMs === 0) return round;

  let remaining = deltaMs;

  // Process in slices so a single big delta cannot skip past multiple
  // question-timeout boundaries. Worst case we loop questionCount+1 times.
  while (remaining > 0 && round.phase === "playing") {
    const usable = Math.min(
      remaining,
      round.questionTimeLeftMs,
      round.roundTimeLeftMs
    );

    round.questionTimeLeftMs -= usable;
    round.roundTimeLeftMs -= usable;
    round.elapsedMs += usable;
    remaining -= usable;

    if (round.roundTimeLeftMs <= 0) {
      round.roundTimeLeftMs = 0;
      finalize(round);
      break;
    }

    if (round.questionTimeLeftMs <= 0) {
      // Question timed out → recorded as wrong, move on.
      recordAnswer(round, /*chosenIndex=*/ -1, /*timedOut=*/ true);
    }
  }

  return round;
}

/**
 * Submit the player's choice for the current question.
 *
 * @param {RoundState} round
 * @param {number} chosenIndex   0..3
 * @returns {RoundState} same reference (mutates in place)
 */
export function answer(round, chosenIndex) {
  if (round.phase !== "playing") return round;
  if (!Number.isInteger(chosenIndex) || chosenIndex < 0 || chosenIndex > 3) {
    throw new Error("chosenIndex must be an integer 0..3");
  }
  recordAnswer(round, chosenIndex, /*timedOut=*/ false);
  return round;
}

/**
 * @param {RoundState} round
 * @param {number} chosenIndex   -1 if timed out
 * @param {boolean} timedOut
 */
function recordAnswer(round, chosenIndex, timedOut) {
  const q = round.questions[round.currentIndex];
  if (!q) {
    finalize(round);
    return;
  }
  const correct = !timedOut && chosenIndex === q.correctIndex;
  const cfg = round.config;

  let points = 0;
  if (correct) {
    points = Math.round(cfg.pointsPerCorrect * round.combo);
    round.score += points;
    round.correctCount += 1;
    round.combo = Math.min(cfg.comboCap, round.combo + cfg.comboStep);
    if (round.combo > round.comboHigh) round.comboHigh = round.combo;
    // Reward extra time, but never overflow round budget.
    round.roundTimeLeftMs = Math.min(
      cfg.roundTimeMs,
      round.roundTimeLeftMs + cfg.bonusOnCorrectMs
    );
  } else {
    round.combo = 1;
    round.roundTimeLeftMs = Math.max(0, round.roundTimeLeftMs - cfg.penaltyOnWrongMs);
  }
  round.answeredCount += 1;

  round.log.push({
    questionId: q.id,
    chosenIndex,
    correctIndex: q.correctIndex,
    correct,
    pointsAwarded: points,
    comboAfter: round.combo,
    timeLeftAfterMs: round.roundTimeLeftMs,
    timedOut,
  });

  round.currentIndex += 1;
  round.questionTimeLeftMs = cfg.questionTimeMs;

  if (round.roundTimeLeftMs <= 0) {
    round.roundTimeLeftMs = 0;
    finalize(round);
    return;
  }
  if (round.currentIndex >= round.questions.length) {
    finalize(round);
  }
}

/** @param {RoundState} round */
function finalize(round) {
  if (round.phase === "ended") return;
  const cfg = round.config;
  const total = round.questions.length;
  const allAnswered = round.currentIndex >= total;
  round.perfect = allAnswered && round.correctCount === total && total > 0;

  // Survival bonus: only when player finished the queue with time to spare.
  if (allAnswered && round.roundTimeLeftMs > 0) {
    const bonus = Math.floor(
      (round.roundTimeLeftMs / 1000) * cfg.survivalSecondsValue
    );
    round.score += bonus;
  }
  if (round.perfect) {
    round.score = Math.round(round.score * cfg.perfectMultiplier);
  }

  if (round.correctCount > 0) {
    round.outcome = "win";
    round.rewardEvent = {
      type: "mini_game_completed",
      score: round.score,
      correctCount: round.correctCount,
      questionCount: total,
      perfect: round.perfect,
      outcome: "win",
    };
  } else {
    round.outcome = "fail";
    round.score = 0;
    round.rewardEvent = null;
  }

  round.phase = "ended";
}

/* ── View accessors ───────────────────────────────────────────────────── */

/**
 * Snapshot suitable for the UI layer. Plain JSON-safe shape.
 * @param {RoundState} round
 */
export function getView(round) {
  const q =
    round.phase === "playing" ? round.questions[round.currentIndex] : null;
  return {
    phase: round.phase,
    outcome: round.outcome,
    score: round.score,
    combo: round.combo,
    comboHigh: round.comboHigh,
    correctCount: round.correctCount,
    answeredCount: round.answeredCount,
    questionCount: round.questions.length,
    questionIndex: round.currentIndex,
    questionTimeLeftMs: round.questionTimeLeftMs,
    roundTimeLeftMs: round.roundTimeLeftMs,
    elapsedMs: round.elapsedMs,
    perfect: round.perfect,
    rewardEvent: round.rewardEvent,
    currentQuestion: q && {
      id: q.id,
      generator: q.generator,
      prompt: q.prompt,
      options: q.options.slice(),
      meme: q.meme,
    },
  };
}

/**
 * Compute reward in MARIO base units. Keeps the mini-game decoupled from
 * `token/src/rewards.ts` (which is TS + bigint). The host integration layer
 * forwards `mini-game-logic` reward events into `gameplayReward`.
 *
 *   import { gameplayReward } from "../../token/src/rewards.js";
 *   const evt = round.rewardEvent;
 *   if (evt) marioOwed = gameplayReward({ type: "level_completed", score: evt.score });
 *
 * For places that only need a JS number, this helper mirrors the formula:
 * level_completed reward × min(10, 1 + floor(score/1000)).
 *
 * @param {RewardEvent} evt
 * @param {number} [baseLevelReward=10]
 * @returns {number}
 */
export function estimateMario(evt, baseLevelReward = 10) {
  const mult = Math.min(10, 1 + Math.floor(evt.score / 1000));
  return baseLevelReward * mult;
}

/* ── Question pool helpers ────────────────────────────────────────────── */

/**
 * Build a question pool from a list of memes. Pure & deterministic given
 * `seed`. Used by S2T03 (frontend) to feed `createRound` and by the test
 * suites to exercise the round.
 *
 * @param {Array<{id:string,caption:string,tags:string[],author:string,votes:{up:number,down:number},thumbUrl?:string}>} memes
 * @param {object} [opts]
 * @param {number} [opts.seed=1]
 * @param {QuestionType[]} [opts.generators=["caption-guess","tag-match","author-guess","vote-rank"]]
 * @returns {Question[]}
 */
export function buildQuestionPool(memes, opts = {}) {
  const seed = opts.seed ?? 1;
  const generators = opts.generators ?? [
    "caption-guess",
    "tag-match",
    "author-guess",
    "vote-rank",
  ];
  if (!Array.isArray(memes) || memes.length < 4) {
    throw new Error("buildQuestionPool needs at least 4 memes");
  }
  const rng = mulberry32(seed);
  /** @type {Question[]} */
  const out = [];

  for (const gen of generators) {
    for (const meme of memes) {
      const q = makeQuestion(gen, meme, memes, rng);
      if (q) out.push(q);
    }
  }
  return out;
}

/**
 * @param {QuestionType} gen
 * @param {any} meme
 * @param {any[]} pool
 * @param {() => number} rng
 * @returns {Question | null}
 */
function makeQuestion(gen, meme, pool, rng) {
  const others = pool.filter((m) => m.id !== meme.id);
  const memeRef = meme.thumbUrl
    ? { id: meme.id, thumbUrl: meme.thumbUrl }
    : undefined;

  switch (gen) {
    case "caption-guess": {
      const distractors = pickDistinct(
        others.map((m) => m.caption),
        3,
        rng,
        meme.caption
      );
      if (distractors.length < 3) return null;
      const opts = shuffle([meme.caption, ...distractors], rng);
      return {
        id: `cap-${meme.id}`,
        generator: gen,
        prompt: "Which caption belongs to this meme?",
        options: opts,
        correctIndex: opts.indexOf(meme.caption),
        meme: memeRef,
      };
    }
    case "tag-match": {
      const present = (meme.tags || []).slice(0, 3);
      if (present.length === 0) return null;
      // pick a tag NOT on this meme
      const allTags = new Set(pool.flatMap((m) => m.tags || []));
      for (const t of present) allTags.delete(t);
      const absentTags = Array.from(allTags);
      if (absentTags.length === 0) return null;
      const wrong = absentTags[Math.floor(rng() * absentTags.length)];
      // 3 of the 4 options are present tags; 1 is the absent tag (correct).
      const presentSample = pickDistinct(
        pool.flatMap((m) => m.tags || []).filter((t) => !absentTags.includes(t)),
        3,
        rng,
        wrong
      );
      if (presentSample.length < 3) return null;
      const opts = shuffle([wrong, ...presentSample], rng);
      return {
        id: `tag-${meme.id}`,
        generator: gen,
        prompt: `Which tag is NOT on "${meme.caption}"?`,
        options: opts,
        correctIndex: opts.indexOf(wrong),
        meme: memeRef,
      };
    }
    case "author-guess": {
      const distractors = pickDistinct(
        others.map((m) => m.author),
        3,
        rng,
        meme.author
      );
      if (distractors.length < 3) return null;
      const opts = shuffle([meme.author, ...distractors], rng);
      return {
        id: `auth-${meme.id}`,
        generator: gen,
        prompt: `Who uploaded "${meme.caption}"?`,
        options: opts,
        correctIndex: opts.indexOf(meme.author),
        meme: memeRef,
      };
    }
    case "vote-rank": {
      const sample = pickDistinct(
        others,
        3,
        rng,
        /*excludeKey=*/ JSON.stringify(meme)
      );
      if (sample.length < 3) return null;
      const candidates = [meme, ...sample];
      const top = candidates.reduce((a, b) =>
        (a.votes?.up ?? 0) >= (b.votes?.up ?? 0) ? a : b
      );
      const captions = candidates.map((m) => m.caption);
      const opts = shuffle(captions, rng);
      return {
        id: `vote-${meme.id}`,
        generator: gen,
        prompt: "Which of these has the most upvotes?",
        options: opts,
        correctIndex: opts.indexOf(top.caption),
      };
    }
    default:
      return null;
  }
}

/**
 * @template T
 * @param {readonly T[]} arr
 * @param {number} n
 * @param {() => number} rng
 * @param {unknown=} excludeKey   skip items whose JSON matches this key
 * @returns {T[]}
 */
function pickDistinct(arr, n, rng, excludeKey) {
  const seen = new Set();
  const candidates = [];
  for (const x of arr) {
    const key = typeof x === "string" || typeof x === "number" ? String(x) : JSON.stringify(x);
    if (excludeKey !== undefined && key === excludeKey) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(x);
  }
  return shuffle(candidates, rng).slice(0, n);
}

/* ── Built-in demo pool (used as fallback) ────────────────────────────── */

/**
 * Twelve hand-rolled memes used when the meme service is empty or
 * unreachable. Stable across releases so tests can pin against it.
 */
export const DEMO_MEMES = Object.freeze([
  { id: "m1", caption: "It's-a me, Mario!", tags: ["mario", "classic"], author: "alice", votes: { up: 42, down: 1 } },
  { id: "m2", caption: "Wahoo!", tags: ["mario", "joy"], author: "bob", votes: { up: 18, down: 0 } },
  { id: "m3", caption: "Mama mia!", tags: ["mario", "panic"], author: "carol", votes: { up: 7, down: 3 } },
  { id: "m4", caption: "Here we go!", tags: ["mario", "go"], author: "dave", votes: { up: 11, down: 0 } },
  { id: "m5", caption: "Princess is in another castle", tags: ["toad", "lore"], author: "eve", votes: { up: 99, down: 5 } },
  { id: "m6", caption: "Fire flower OP", tags: ["powerup", "fire"], author: "frank", votes: { up: 23, down: 2 } },
  { id: "m7", caption: "Goomba moment", tags: ["enemy", "goomba"], author: "grace", votes: { up: 4, down: 0 } },
  { id: "m8", caption: "Star power!", tags: ["powerup", "star"], author: "heidi", votes: { up: 31, down: 1 } },
  { id: "m9", caption: "Yoshi rides again", tags: ["yoshi", "mount"], author: "ivan", votes: { up: 27, down: 2 } },
  { id: "m10", caption: "Bowser's back", tags: ["enemy", "bowser"], author: "judy", votes: { up: 56, down: 8 } },
  { id: "m11", caption: "Coin coin coin", tags: ["coin", "loop"], author: "kim", votes: { up: 9, down: 0 } },
  { id: "m12", caption: "1-up surprise", tags: ["powerup", "life"], author: "leo", votes: { up: 13, down: 1 } },
]);
