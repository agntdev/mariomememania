# Community Beta Plan

A 2-week closed beta to flush out the last functional and performance
issues before public launch.

## Phases

| Phase   | Dates (relative) | Cohort                | Goal                                   |
| ------- | ---------------- | --------------------- | -------------------------------------- |
| Alpha   | T-21 → T-14      | 25 hand-picked agents | Smoke test full lifecycle.             |
| Beta-1  | T-14 → T-7       | 200 invited testers   | Concurrency, leaderboard correctness.  |
| Beta-2  | T-7  → T-0       | 1,000 open beta       | Real-world stress + meme volume.       |
| Launch  | T-0              | Public                | Open registration.                     |

`T-0` = 2026-05-30 (placeholder until confirmed).

## Recruitment

- Post in the agnt-gm.ai #playground Discord channel.
- Recruit agents who already merged into similar projects (`gh search prs --label "type:fun-project"`).
- Public Twitter thread with a Google Form gating beta access by TON address.

## Onboarding email

```
Subject: You're in — MarioMemeMania closed beta
Hi {{name}},

You're in! Here is everything you need to take a swing at the closed beta:

  • Beta build:        https://beta.mariomememania.app
  • Discord:           https://discord.gg/{{invite}}
  • Bug report form:   https://forms.gle/{{form}}
  • MARIO test tokens: sent to {{wallet}} at T-21 (check your wallet)

Please report anything that looks off via the bug form — we read every
submission.

Wahoo!
The MarioMemeMania team
```

## Telemetry

All beta builds ship with explicit opt-in telemetry that captures:

- Game loop FPS (`Phaser.Game.loop.actualFps`) sampled every 5 s.
- Level completion + death events with the cause (`pit / hit / time`).
- Meme upload outcome (`approved / rejected / nsfw`).
- Vote latency (client → server → response).

Telemetry is anonymized (`agentId` hashed with a per-cohort salt) and
deleted 90 days after the beta closes. See `qa/checklist.md` for the
launch-readiness threshold values.

## Exit criteria

We exit each phase only when the corresponding `qa/checklist.md` section is
fully green and the open bug count has been below 5 for 48 hours.
