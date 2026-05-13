import { CAPS, ONE_MARIO, REWARDS } from "./config.js";

export type GameplayEvent =
  | { type: "coin_collected" }
  | { type: "enemy_defeated" }
  | { type: "power_up_collected" }
  | { type: "level_completed"; score: number };

export type MemeEvent =
  | { type: "meme_approved" }
  | { type: "meme_upvote_received"; count: number }
  | { type: "meme_challenge_won" };

export interface RewardLedgerEntry {
  amount: bigint;
  source: "gameplay" | "meme" | "daily_login" | "staking";
  detail: string;
  at: string;
}

/**
 * Pure functions — given an event, return how much MARIO it pays out.
 * Daily caps are enforced separately by `RewardEngine`.
 */
export function gameplayReward(event: GameplayEvent): bigint {
  switch (event.type) {
    case "coin_collected":
      return REWARDS.coin_collected;
    case "enemy_defeated":
      return REWARDS.enemy_defeated;
    case "power_up_collected":
      return REWARDS.power_up_collected;
    case "level_completed": {
      // Bonus scales linearly with score, capped at 10x.
      const mult = Math.min(10, 1 + Math.floor(event.score / 1000));
      return REWARDS.level_completed * BigInt(mult);
    }
  }
}

export function memeReward(event: MemeEvent): bigint {
  switch (event.type) {
    case "meme_approved":
      return REWARDS.meme_approved;
    case "meme_upvote_received":
      return REWARDS.meme_upvote_received * BigInt(Math.max(0, event.count));
    case "meme_challenge_won":
      return REWARDS.meme_challenge_won;
  }
}

/**
 * Streak bonus formula: `base + min(streakDays - 1, cap - 1) * step`.
 * Day 1 = base. Day 7 = base + 6 * step. Day 30 = same as day 7 (capped).
 */
export function dailyLoginReward(streakDays: number): bigint {
  if (streakDays <= 0) return 0n;
  const capped = Math.min(streakDays, REWARDS.daily_login_streak_cap);
  return (
    REWARDS.daily_login_base +
    REWARDS.daily_login_streak_step * BigInt(capped - 1)
  );
}

export interface AgentRewardState {
  /** Total claimed lifetime. */
  totalEarned: bigint;
  /** Per-source daily counters (reset at UTC midnight). */
  todayGameplay: bigint;
  todayMeme: bigint;
  /** YYYY-MM-DD of the day above counters were last reset. */
  dayStamp: string;
  /** Last daily-login claim date (YYYY-MM-DD). */
  lastLoginDate: string | null;
  /** Current consecutive-day login streak. */
  loginStreak: number;
  ledger: RewardLedgerEntry[];
}

export class RewardEngine {
  private state = new Map<string, AgentRewardState>();
  constructor(private readonly now: () => Date = () => new Date()) {}

  recordGameplay(agentId: string, event: GameplayEvent): bigint {
    const reward = gameplayReward(event);
    return this.apply(agentId, reward, "gameplay", event.type);
  }

  recordMeme(agentId: string, event: MemeEvent): bigint {
    const reward = memeReward(event);
    return this.apply(agentId, reward, "meme", event.type);
  }

  /**
   * Idempotent per UTC day — calling twice on the same day returns 0 the
   * second time and does not advance the streak. Calling on a non-consecutive
   * day resets the streak to 1.
   */
  claimDailyLogin(agentId: string): bigint {
    const today = this.dayStamp();
    const s = this.requireState(agentId);
    if (s.lastLoginDate === today) return 0n;
    const yesterday = previousDay(today);
    s.loginStreak = s.lastLoginDate === yesterday ? s.loginStreak + 1 : 1;
    s.lastLoginDate = today;
    const reward = dailyLoginReward(s.loginStreak);
    s.totalEarned += reward;
    s.ledger.push({
      amount: reward,
      source: "daily_login",
      detail: `streak:${s.loginStreak}`,
      at: this.now().toISOString(),
    });
    return reward;
  }

  balance(agentId: string): bigint {
    return this.state.get(agentId)?.totalEarned ?? 0n;
  }

  getState(agentId: string): AgentRewardState {
    return this.requireState(agentId);
  }

  private apply(
    agentId: string,
    reward: bigint,
    source: "gameplay" | "meme",
    detail: string
  ): bigint {
    if (reward <= 0n) return 0n;
    const s = this.requireState(agentId);
    this.rollDay(s);
    const cap = source === "gameplay" ? CAPS.gameplay_daily_cap : CAPS.meme_daily_cap;
    const used = source === "gameplay" ? s.todayGameplay : s.todayMeme;
    const allowed = reward + used > cap ? cap - used : reward;
    if (allowed <= 0n) return 0n;
    if (source === "gameplay") s.todayGameplay += allowed;
    else s.todayMeme += allowed;
    s.totalEarned += allowed;
    s.ledger.push({
      amount: allowed,
      source,
      detail,
      at: this.now().toISOString(),
    });
    return allowed;
  }

  private requireState(agentId: string): AgentRewardState {
    let s = this.state.get(agentId);
    if (!s) {
      s = {
        totalEarned: 0n,
        todayGameplay: 0n,
        todayMeme: 0n,
        dayStamp: this.dayStamp(),
        lastLoginDate: null,
        loginStreak: 0,
        ledger: [],
      };
      this.state.set(agentId, s);
    } else {
      this.rollDay(s);
    }
    return s;
  }

  private rollDay(s: AgentRewardState) {
    const today = this.dayStamp();
    if (s.dayStamp !== today) {
      s.dayStamp = today;
      s.todayGameplay = 0n;
      s.todayMeme = 0n;
    }
  }

  private dayStamp(): string {
    return this.now().toISOString().slice(0, 10);
  }
}

export function format(amount: bigint): string {
  const whole = amount / ONE_MARIO;
  const frac = amount % ONE_MARIO;
  if (frac === 0n) return `${whole.toString()} MARIO`;
  const fracStr = frac.toString().padStart(9, "0").replace(/0+$/, "");
  return `${whole.toString()}.${fracStr} MARIO`;
}

function previousDay(yyyymmdd: string): string {
  const d = new Date(`${yyyymmdd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
