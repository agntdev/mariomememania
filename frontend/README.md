# MarioMemeMania — Frontend (T01)

Pixel-art Mario-themed React component library + demo shell.

## Components

| Component        | Purpose                                                              |
| ---------------- | -------------------------------------------------------------------- |
| `GameCanvas`     | Platformer canvas frame; exposes `onMount(host)` so T02's Phaser     |
|                  | game can mount inside. Renders an SVG preview scene when unmounted.  |
| `MemeForm`       | Client-validated meme submission form (title, caption, tags, file). |
|                  | Pluggable `onSubmit` — T03 wires this to the IPFS pipeline.          |
| `Leaderboard`    | Pure display of `LeaderEntry[]`; supports highlighting current user. |
| `WalletConnect`  | Connect button + balance pill. Pluggable `connect()` connector —     |
|                  | T04 swaps in the real TON wallet integration.                        |

## Design tokens

Defined in `src/styles/global.css`:

| Token             | Value     |
| ----------------- | --------- |
| `--mario-red`     | `#e52521` |
| `--mario-blue`    | `#049cd8` |
| `--mario-yellow`  | `#fbd000` |
| `--mario-green`   | `#43b047` |
| `--mario-brown`   | `#8b4513` |
| `--mario-sky`     | `#5c94fc` |
| `--mario-cloud`   | `#f8f8f8` |
| `--mario-dark`    | `#1a1a2e` |
| `--mario-coin`    | `#ffce42` |
| `--pixel`         | `4px`     |

Font: [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) via Google Fonts.

The Figma export of these tokens + the component frames lives in
[`design/figma-tokens.json`](./design/figma-tokens.json) (W3C Design Tokens
format, importable by the Figma Tokens / Tokens Studio plugin).

## Develop

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle to ./dist
npm run typecheck
```

## Integration points

- **T02 (game):** `<GameCanvas onMount={hostEl => new Phaser.Game({ parent: hostEl, ... })} />`
- **T03 (memes):** `<MemeForm onSubmit={memeApi.upload} />`
- **T04 (token):** `<WalletConnect connect={tonConnector.connect} />`
