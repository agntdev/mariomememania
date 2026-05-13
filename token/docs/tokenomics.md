# MARIO Tokenomics

## Token

| Field         | Value                                  |
| ------------- | -------------------------------------- |
| Name          | MarioMemeMania                         |
| Symbol        | MARIO                                  |
| Decimals      | 9                                      |
| Total supply  | 1,000,000,000,000 MARIO (1 trillion)   |
| Standard      | TON Jetton                             |
| Mint policy   | One-shot mint at genesis; admin renounced after distribution. |

## Genesis allocation

Allocations are encoded in `token/src/config.ts` as basis points (sum = 10000).

| Bucket            | %    | Amount (MARIO) | Purpose                                              |
| ----------------- | ---- | -------------- | ---------------------------------------------------- |
| Gameplay rewards  | 40 % | 400 B          | Emissions for coin/enemy/power-up/level events.     |
| Staking reserve   | 15 % | 150 B          | Source of staking yield (≈ 5% APY).                 |
| Daily login       | 10 % | 100 B          | Daily login bonus + streak.                          |
| Meme challenges   | 10 % | 100 B          | Daily challenge prize pool.                          |
| Owner             | 10 % | 100 B          | Matches `owner_share_bps` on agnt-gm.ai.            |
| Bounty rewards    |  9 % |  90 B          | Pre-funded on the platform for T01–T05.             |
| Liquidity         |  5 % |  50 B          | DEX seed.                                            |
| Treasury          |  1 % |  10 B          | Grants & events.                                     |

`genesisAllocation()` (`token/src/allocation.ts`) computes the per-bucket
amounts deterministically and assigns any rounding dust to the largest
bucket so the sum equals `TOTAL_SUPPLY` exactly.

## Reward emissions

Per-event payouts, in MARIO (`token/src/rewards.ts` → `REWARDS`):

| Event                                | Reward        | Notes                              |
| ------------------------------------ | ------------- | ---------------------------------- |
| Coin collected                       | 1             |                                    |
| Enemy defeated                       | 2             |                                    |
| Power-up collected                   | 5             |                                    |
| Level completed                      | 25 × *mult*   | `mult = clamp(1 + score / 1000, 1, 10)` |
| Meme approved                        | 50            | Once per moderated meme.           |
| Meme upvote received                 | 1 × count     | Real-time as votes come in.        |
| Daily meme challenge won             | 500           | On `closeChallenge`.               |
| Daily login (day N, N ≤ 7)           | 10 + 10·(N−1) | Day 1 → 10, Day 7 → 70.            |
| Daily login (day N, N > 7)           | 70 (capped)   |                                    |

### Anti-abuse caps

Enforced by `RewardEngine`:

| Cap                           | Value          |
| ----------------------------- | -------------- |
| Gameplay rewards per day      | 5,000 MARIO    |
| Meme rewards per day          | 2,000 MARIO    |
| Votes per day                 | 200            |

UTC midnight resets daily counters. `claimDailyLogin` is idempotent within a
UTC day, and a non-consecutive day resets the streak to 1.

## Staking

| Parameter                          | Value    |
| ---------------------------------- | -------- |
| APY                                | 5 %      |
| Minimum lock                       | 7 days   |
| Leaderboard bonus per 1,000 staked | +1 %     |
| Max leaderboard bonus              | +50 %    |
| Early unstake penalty              | 10 %     |

- **Yield** is computed prorata to the seconds held (linear), even on
  early unstakes.
- **Penalty** is applied only to principal — slashed from the early
  unstake amount; the agent still receives accrued yield.
- The leaderboard service multiplies the raw score by
  `1 + leaderboardBonusBps / 10000` to derive the visible ranking.

## Lifecycle hooks (where rewards fire from)

| Source           | Trigger                                                                |
| ---------------- | ---------------------------------------------------------------------- |
| T02 GameScene    | `coin_collected`, `enemy_defeated`, `power_up_collected`, `level_completed` |
| T03 MemeService  | `meme_approved` on `setStatus → approved`; `meme_upvote_received` on vote; `meme_challenge_won` on `closeChallenge`. |
| Frontend (T01)   | `claimDailyLogin` on app open if `lastLoginDate !== today`.            |
| StakingPool      | Yield streams claimable on `unstake`.                                  |

## Verification

- `npm --prefix token run typecheck` — strict TS.
- `npm --prefix token test` — 10 unit tests covering allocation totals,
  reward math, daily caps, streak logic, and staking yield/penalty.
