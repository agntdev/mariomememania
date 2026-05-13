/**
 * MARIO token economy parameters. All amounts are in *base units* — MARIO
 * has 9 decimals (matches the on-platform definition), so 1 MARIO = 1_000_000_000.
 */

export const MARIO_DECIMALS = 9;
export const ONE_MARIO = 10n ** BigInt(MARIO_DECIMALS);

/** Total supply: 1,000,000,000,000 MARIO (1 trillion), as set on agnt-gm.ai. */
export const TOTAL_SUPPLY = 1_000_000_000_000n * ONE_MARIO;

/**
 * Allocation in basis points (sums to 10000 = 100%). These are the *issuance
 * buckets* — the contract / mint script splits supply across them on launch.
 */
export const ALLOCATION_BPS = {
  /** Per-task rewards already pre-funded on the bounty platform. */
  bounty_rewards: 900,
  /** Long-running play-and-meme reward pool. */
  gameplay_rewards: 4000,
  /** Daily login bonuses + streak multipliers. */
  daily_login: 1000,
  /** Daily meme challenge prizes. */
  meme_challenges: 1000,
  /** Locked, time-vested staking yield reserve. */
  staking_reserve: 1500,
  /** Owner allocation (matches `owner_share_bps` on the platform). */
  owner: 1000,
  /** Liquidity / DEX pool seeding. */
  liquidity: 500,
  /** Community treasury for grants and events. */
  treasury: 100,
} as const;

export const BPS_TOTAL = 10_000;

/** Reward emission per in-game event, in base units. */
export const REWARDS = {
  coin_collected: ONE_MARIO,
  enemy_defeated: 2n * ONE_MARIO,
  power_up_collected: 5n * ONE_MARIO,
  /** Per-level completion. Bonus is multiplied by `1 + score/1000` capped at 10x. */
  level_completed: 25n * ONE_MARIO,
  /** Awarded once per meme that passes moderation. */
  meme_approved: 50n * ONE_MARIO,
  /** Per up-vote received on a meme you authored. */
  meme_upvote_received: 1n * ONE_MARIO,
  /** Daily meme challenge winner. */
  meme_challenge_won: 500n * ONE_MARIO,
  /** First daily login. */
  daily_login_base: 10n * ONE_MARIO,
  /** Additive streak bonus per consecutive day, capped at 7 (so day 7+ = 80). */
  daily_login_streak_step: 10n * ONE_MARIO,
  daily_login_streak_cap: 7,
} as const;

/** Staking config. */
export const STAKING = {
  /** Annual percentage yield, in basis points (500 = 5%). */
  apy_bps: 500,
  /** Minimum lock duration (seconds). */
  min_lock_seconds: 7 * 24 * 60 * 60,
  /** Multiplier on leaderboard score per 1k staked, in bps (100 = +1% per 1k). */
  leaderboard_multiplier_bps_per_1k: 100,
  /** Cap on the staking-derived leaderboard boost. */
  max_leaderboard_bonus_bps: 5000,
  /** Early-unstake penalty applied to the staked principal, in bps. */
  early_unstake_penalty_bps: 1000,
} as const;

/** Anti-abuse caps. */
export const CAPS = {
  /** Hard cap on rewards a single agent can earn from gameplay in 24h. */
  gameplay_daily_cap: 5_000n * ONE_MARIO,
  /** Cap on meme-related rewards per 24h. */
  meme_daily_cap: 2_000n * ONE_MARIO,
  /** Max votes per agent per 24h (also enforced by the meme service). */
  max_meme_votes_per_day: 200,
} as const;

export type AllocationKey = keyof typeof ALLOCATION_BPS;
