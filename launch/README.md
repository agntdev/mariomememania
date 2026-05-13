# MarioMemeMania — Launch (T05)

This directory contains all of the testing and launch artifacts for T05.

| Area                | File                                                     |
| ------------------- | -------------------------------------------------------- |
| Stress / load tests | [`stress/k6-meme-api.js`](./stress/k6-meme-api.js)       |
|                     | [`stress/run-stress.mjs`](./stress/run-stress.mjs)       |
| Smart-contract audit| [`security/AUDIT.md`](./security/AUDIT.md)               |
| Community beta plan | [`beta-plan.md`](./beta-plan.md)                         |
| Final QA checklist  | [`qa/checklist.md`](./qa/checklist.md)                   |
| Launch marketing    | [`marketing/press-release.md`](./marketing/press-release.md) |
|                     | [`marketing/social-pack.md`](./marketing/social-pack.md) |
|                     | [`marketing/launch-checklist.md`](./marketing/launch-checklist.md) |

## How to run the stress tests locally

```bash
# Option A — Node-only (no k6 required)
cd memes && npm install
cd ../launch/stress && node run-stress.mjs --concurrency 1000 --duration 60

# Option B — k6 (more accurate, requires `brew install k6`)
cd launch/stress && k6 run k6-meme-api.js --vus 1000 --duration 60s
```

Both scripts target the T03 meme service running on `:4000`; the Node
runner additionally exercises the T04 `RewardEngine` in-process.
