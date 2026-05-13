# MarioMemeMania — Meme Integration System (T03)

A small TypeScript service that owns the meme lifecycle: **upload →
moderation → IPFS pin → voting → daily challenge**, plus NSFW content
filtering on the way in.

## Architecture

```
   T01 MemeForm  ──HTTP──▶  POST /api/memes  ──┐
                                                │
                            ┌───────────────────▼────────────────┐
                            │ MemeService                        │
                            │  ├── validate (mime/size/dupes)    │
                            │  ├── NsfwClassifier  (pluggable)   │
                            │  └── IpfsClient      (pluggable)   │
                            └────────────────────────────────────┘
                                                │
                              status: pending / nsfw / approved / rejected
```

### Pluggable adapters

| Concern   | Default (dev)              | Production swap                                            |
| --------- | -------------------------- | ---------------------------------------------------------- |
| IPFS      | `MemoryIpfsClient`         | `HttpIpfsClient` against Kubo / Pinata / web3.storage      |
| NSFW      | `HeuristicNsfwClassifier`  | nsfwjs, Cloudflare image moderation, or AWS Rekognition    |

Both adapters are single-file interfaces — production deployment is a
~50-line wrapper, the rest of the service is unchanged.

## API

| Method | Path                                       | Notes                                  |
| ------ | ------------------------------------------ | -------------------------------------- |
| POST   | `/api/memes`                               | multipart upload; runs NSFW + IPFS.    |
| GET    | `/api/memes?status=&tag=`                  | Sorted by score (up − down).           |
| GET    | `/api/memes/pending`                       | Moderation queue.                      |
| GET    | `/api/memes/:id`                           |                                        |
| POST   | `/api/memes/:id/moderate`                  | `{status: "approved" \| "rejected"}`   |
| POST   | `/api/memes/:id/vote`                      | `{voter, direction}`                   |
| POST   | `/api/challenges`                          | `{date, theme}`                        |
| POST   | `/api/challenges/:date/submissions`        | `{memeId}` (approved-only)             |
| POST   | `/api/challenges/:date/close`              | Locks in winner.                       |
| GET    | `/api/challenges/:date`                    |                                        |

## NSFW filter

`HeuristicNsfwClassifier` is a deterministic stand-in:
- keyword blocklist scan over title + caption + tags
- byte-frequency proxy on payload bytes

It scores `[0, 1]` and uploads above `DEFAULT_NSFW_THRESHOLD = 0.5` are
auto-stored with status `"nsfw"` and excluded from public listings.
Moderators must explicitly re-review (`setStatus`) before such items can be
approved — promotion from `nsfw → approved` is blocked.

Production must replace this with a real classifier; the interface is
already in `src/nsfw.ts`.

## Voting

- Only `approved` memes accept votes (`ValidationError` otherwise).
- One vote per `voter` per meme. Re-casting in the same direction is a
  no-op; flipping the direction decrements the previous bucket.
- Ranking score is `up - down`; the daily-challenge closer selects the
  highest-scoring submission as winner.

## Daily challenge

Each day has a theme; approved memes are explicitly submitted with
`POST /api/challenges/:date/submissions`. Calling `/close` picks the
highest-scoring submission, marks it with `challengeWinAt`, and stores it
on the challenge record.

## Develop

```bash
cd memes
npm install
npm run typecheck
npm test                # node:test, no dependency on jest/mocha
npm start               # listens on :4000
```

## Integration

- **T01 (frontend):** the `MemeForm.onSubmit` callback should `POST
  /api/memes` as `multipart/form-data` with fields `file`, `title`,
  `caption`, `tags` (comma-separated), `author`.
- **T04 (token economy):** when `closeChallenge` returns a winner, the
  token-distribution job mints the daily reward to `winner.author`.
