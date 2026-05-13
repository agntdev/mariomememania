# Final QA Checklist

Every box must be green before the launch tag is cut. Reference issues by
their GitHub issue / PR number.

## Frontend (T01)

- [ ] Vite production build (`npm --prefix frontend run build`) succeeds.
- [ ] `MemeForm` rejects unsupported MIME types and >8 MB files.
- [ ] `Leaderboard` highlight row uses sufficient contrast (WCAG AA).
- [ ] `WalletConnect` recovers cleanly when the connector rejects.
- [ ] Pixel font loads from Google Fonts with `font-display: swap`.
- [ ] Mobile viewport (375 × 667 iPhone SE) is usable without horizontal scroll.

## Game (T02)

- [ ] All three sample levels are completable end-to-end.
- [ ] No softlock when timer runs out mid-jump.
- [ ] Power-up state survives level transitions correctly.
- [ ] Fireballs despawn after 1.2 s and don't leak `Phaser.GameObject` refs.
- [ ] Pit-fall death respawns at the player spawn, not the previous flag.

## Meme system (T03)

- [ ] Duplicate-content rejection (`SHA-256`) works across processes.
- [ ] NSFW-flagged memes never appear in `?status=approved` listings.
- [ ] Vote flip (up→down, down→up) is consistent under 1 k req/s.
- [ ] `closeChallenge` picks the highest-scoring submission deterministically.
- [ ] IPFS adapter swap (Memory → Http) only touches `src/ipfs.ts`.

## Token economy (T04)

- [ ] Genesis allocation sums to `TOTAL_SUPPLY` (covered by unit test).
- [ ] Daily caps reset at the UTC day boundary.
- [ ] Daily-login streak resets after one missed day.
- [ ] Staking yield matches the documented APY within ±0.1 %.
- [ ] Early-unstake penalty is only applied to principal.

## Stress / load (T05)

- [ ] `launch/stress/k6-meme-api.js` at 1,000 VUs / 60 s holds:
  - p95 list      < 200 ms
  - p95 vote      < 300 ms
  - p95 upload    < 800 ms
  - http_req_failed < 1 %
- [ ] No memory leak: process RSS within 10 % of start after a 10-min run.

## Security (T05)

- [ ] All findings in `launch/security/AUDIT.md` are closed or have a
      mitigation plan.
- [ ] External audit report attached.

## Compliance

- [ ] Cookie / telemetry consent banner ships.
- [ ] Terms-of-service and privacy-policy linked from the footer.
- [ ] Nintendo IP review: every asset is procedurally generated; no
      derivative sprites or sounds are bundled.

## Observability

- [ ] Health endpoint `/api/health` returns 200 + version.
- [ ] Sentry / Grafana dashboards have the SLO panels marked.
- [ ] PagerDuty rotation set for the first 14 days post-launch.
