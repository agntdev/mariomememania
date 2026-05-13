import { ONE_MARIO, STAKING } from "./config.js";

export interface Stake {
  id: string;
  agentId: string;
  amount: bigint;
  startedAt: number;
  unlocksAt: number;
  withdrawnAt: number | null;
}

const YEAR_SECONDS = 365 * 24 * 60 * 60;

export class StakingPool {
  private stakes = new Map<string, Stake>();
  private nextId = 1;

  constructor(private readonly now: () => number = () => Date.now()) {}

  /** Lock `amount` for at least `STAKING.min_lock_seconds`. */
  stake(agentId: string, amount: bigint, lockSeconds = STAKING.min_lock_seconds): Stake {
    if (amount <= 0n) throw new Error("amount must be positive");
    if (lockSeconds < STAKING.min_lock_seconds) {
      throw new Error(`lock must be >= ${STAKING.min_lock_seconds}s`);
    }
    const nowMs = this.now();
    const stake: Stake = {
      id: `stake_${this.nextId++}`,
      agentId,
      amount,
      startedAt: nowMs,
      unlocksAt: nowMs + lockSeconds * 1000,
      withdrawnAt: null,
    };
    this.stakes.set(stake.id, stake);
    return stake;
  }

  /**
   * Unstake the principal + linear yield. Early unstaking applies a penalty
   * but never to the yield (only the principal is slashed).
   */
  unstake(stakeId: string): { principal: bigint; yield: bigint; penalty: bigint } {
    const s = this.stakes.get(stakeId);
    if (!s) throw new Error("stake not found");
    if (s.withdrawnAt) throw new Error("already withdrawn");
    const nowMs = this.now();
    const heldSeconds = Math.max(0, (nowMs - s.startedAt) / 1000);
    const accrued =
      (s.amount * BigInt(STAKING.apy_bps) * BigInt(Math.floor(heldSeconds))) /
      (10_000n * BigInt(YEAR_SECONDS));
    let penalty = 0n;
    let principal = s.amount;
    if (nowMs < s.unlocksAt) {
      penalty = (s.amount * BigInt(STAKING.early_unstake_penalty_bps)) / 10_000n;
      principal -= penalty;
    }
    s.withdrawnAt = nowMs;
    return { principal, yield: accrued, penalty };
  }

  active(agentId: string): Stake[] {
    return [...this.stakes.values()].filter(
      (s) => s.agentId === agentId && s.withdrawnAt === null
    );
  }

  totalStaked(agentId: string): bigint {
    return this.active(agentId).reduce((acc, s) => acc + s.amount, 0n);
  }

  /**
   * Leaderboard multiplier in basis points. Returns +bps to multiply the
   * raw score with (e.g. 500 ⇒ +5% score). Capped per config.
   */
  leaderboardBonusBps(agentId: string): number {
    const staked = this.totalStaked(agentId);
    const thousands = Number(staked / (1000n * ONE_MARIO));
    const bonus = thousands * STAKING.leaderboard_multiplier_bps_per_1k;
    return Math.min(bonus, STAKING.max_leaderboard_bonus_bps);
  }
}
