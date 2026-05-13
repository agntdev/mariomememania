# MarioMemeMania — Token Economy (T04)

MARIO tokenomics rules, reward engine, staking pool, and daily-login bonus —
plus the human-readable spec in [`docs/tokenomics.md`](./docs/tokenomics.md).

## Modules (`token/src/`)

| File             | What's in it                                                       |
| ---------------- | ------------------------------------------------------------------ |
| `config.ts`      | Decimals, supply, allocation BPS, per-event rewards, caps, staking.|
| `allocation.ts`  | `genesisAllocation()` — exact-sum split of `TOTAL_SUPPLY`.         |
| `rewards.ts`     | `RewardEngine` (daily caps, ledger, streaks) + pure reward fns.   |
| `staking.ts`     | `StakingPool` — lock, accrue, early-unstake penalty, leaderboard. |

## Develop

```bash
cd token
npm install
npm run typecheck
npm test
```

## Integration

- **T02 game (\`GameScene\`)** ⇒ `engine.recordGameplay(agentId, { type: "coin_collected" })` etc.
- **T03 memes** ⇒ `engine.recordMeme(agentId, ...)` on approve / vote / challenge win.
- **T01 frontend** ⇒ `engine.claimDailyLogin(agentId)` once on app open per UTC day.
- **Leaderboard** ⇒ multiply raw score by `1 + pool.leaderboardBonusBps(agentId) / 10000`.

See [`docs/tokenomics.md`](./docs/tokenomics.md) for parameter rationale and
the full distribution / emission spec.
