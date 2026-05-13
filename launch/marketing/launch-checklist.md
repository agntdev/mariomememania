# Launch-Day Checklist

A flat checklist for the launch-day operator. The full QA gate lives in
`../qa/checklist.md`; this file is just the *go / no-go* sequence.

## T-24 hours

- [ ] All QA boxes in `../qa/checklist.md` are green.
- [ ] `launch/security/AUDIT.md` shows zero high-severity findings open.
- [ ] Stress run at 1,000 VUs / 60 s passes thresholds.
- [ ] DNS for `mariomememania.app` and `api.mariomememania.app` propagated.
- [ ] TLS certs (Let's Encrypt) valid for ≥ 30 days.
- [ ] Sentry / Grafana / PagerDuty rotations confirmed.

## T-1 hour

- [ ] Disable signup throttles → enable.
- [ ] Press release at `marketing/press-release.md` is final.
- [ ] Twitter / Discord / Reddit drafts queued from `marketing/social-pack.md`.
- [ ] Daily challenge for launch day pre-seeded (`POST /api/challenges`).

## T-0

- [ ] Flip `MAINTENANCE_MODE=false`.
- [ ] Publish press release.
- [ ] Post Twitter thread + Discord announcement + Reddit thread.
- [ ] Pin launch post in Discord.
- [ ] Live-tweet metrics every 30 min for the first 4 hours.

## T+24 hours

- [ ] Run `npm --prefix launch/stress -- run-stress.mjs --concurrency 500 --duration 120` against prod.
- [ ] Daily-active-users (DAU) > 100? → 🎉
- [ ] Outstanding bug list ≤ 5? Otherwise escalate.
- [ ] Post a launch retrospective in `#post-mortem` (Discord).

## Rollback

If error rate > 5 % for 5 minutes:

1. `kubectl rollout undo deploy/meme-api`
2. Flip frontend feature flag `playable_mode=false` (banner-only).
3. Post a status update in Discord and on Twitter.
4. Page the on-call (`@oncall` in PagerDuty).
