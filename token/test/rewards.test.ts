import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { genesisAllocation } from "../src/allocation.js";
import {
  RewardEngine,
  dailyLoginReward,
  gameplayReward,
  memeReward,
} from "../src/rewards.js";
import { CAPS, ONE_MARIO, REWARDS, TOTAL_SUPPLY } from "../src/config.js";
import { StakingPool } from "../src/staking.js";

describe("genesisAllocation", () => {
  it("splits total supply exactly across buckets", () => {
    const entries = genesisAllocation();
    const sum = entries.reduce((a, e) => a + e.amount, 0n);
    assert.equal(sum, TOTAL_SUPPLY);
  });

  it("has positive amounts for every bucket", () => {
    for (const e of genesisAllocation()) assert.ok(e.amount > 0n, `${e.bucket} is zero`);
  });
});

describe("gameplayReward", () => {
  it("scales level-completed by score, capped at 10x", () => {
    assert.equal(gameplayReward({ type: "level_completed", score: 0 }), REWARDS.level_completed);
    assert.equal(
      gameplayReward({ type: "level_completed", score: 2500 }),
      REWARDS.level_completed * 3n
    );
    assert.equal(
      gameplayReward({ type: "level_completed", score: 100_000 }),
      REWARDS.level_completed * 10n
    );
  });
});

describe("memeReward", () => {
  it("multiplies upvote rewards by count", () => {
    assert.equal(memeReward({ type: "meme_upvote_received", count: 5 }), 5n * ONE_MARIO);
  });
});

describe("dailyLoginReward", () => {
  it("applies an additive bonus per consecutive day, capped at 7", () => {
    assert.equal(dailyLoginReward(1), REWARDS.daily_login_base);
    assert.equal(dailyLoginReward(7), REWARDS.daily_login_base + 6n * REWARDS.daily_login_streak_step);
    assert.equal(dailyLoginReward(99), dailyLoginReward(REWARDS.daily_login_streak_cap));
  });
});

describe("RewardEngine", () => {
  it("accumulates rewards and respects per-day gameplay cap", () => {
    const eng = new RewardEngine(() => new Date("2026-05-13T12:00:00Z"));
    let credited = 0n;
    for (let i = 0; i < 10_000; i++) {
      credited += eng.recordGameplay("a", { type: "coin_collected" });
    }
    assert.equal(credited, CAPS.gameplay_daily_cap);
    assert.equal(eng.balance("a"), CAPS.gameplay_daily_cap);
  });

  it("daily login is idempotent within a UTC day, and advances on consecutive days", () => {
    let day = new Date("2026-05-13T12:00:00Z");
    const eng = new RewardEngine(() => day);
    const d1a = eng.claimDailyLogin("a");
    const d1b = eng.claimDailyLogin("a");
    assert.equal(d1a, dailyLoginReward(1));
    assert.equal(d1b, 0n);

    day = new Date("2026-05-14T05:00:00Z");
    const d2 = eng.claimDailyLogin("a");
    assert.equal(d2, dailyLoginReward(2));

    // Skip a day -> resets to streak 1.
    day = new Date("2026-05-16T05:00:00Z");
    const skipped = eng.claimDailyLogin("a");
    assert.equal(skipped, dailyLoginReward(1));
  });
});

describe("StakingPool", () => {
  it("returns full principal + yield after the lock period", () => {
    let nowMs = 1_000_000_000_000;
    const pool = new StakingPool(() => nowMs);
    const stake = pool.stake("a", 10_000n * ONE_MARIO);
    nowMs += 365 * 24 * 60 * 60 * 1000; // 1 year
    const r = pool.unstake(stake.id);
    assert.equal(r.penalty, 0n);
    assert.equal(r.principal, 10_000n * ONE_MARIO);
    // ~5% APY of 10,000 = 500
    assert.equal(r.yield, 500n * ONE_MARIO);
  });

  it("applies an early-unstake penalty to principal but still pays prorated yield", () => {
    let nowMs = 1_000_000_000_000;
    const pool = new StakingPool(() => nowMs);
    const stake = pool.stake("a", 10_000n * ONE_MARIO);
    nowMs += 24 * 60 * 60 * 1000; // 1 day in
    const r = pool.unstake(stake.id);
    assert.equal(r.penalty, 1_000n * ONE_MARIO); // 10% of 10,000
    assert.equal(r.principal, 9_000n * ONE_MARIO);
    assert.ok(r.yield > 0n);
  });

  it("gives a capped leaderboard bonus based on total active stake", () => {
    const pool = new StakingPool(() => Date.now());
    pool.stake("a", 5_000n * ONE_MARIO);
    assert.equal(pool.leaderboardBonusBps("a"), 500);
    pool.stake("a", 200_000n * ONE_MARIO);
    assert.equal(pool.leaderboardBonusBps("a"), 5000); // capped
  });
});
