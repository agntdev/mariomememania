# MarioMemeMania — Game (T02)

Core platformer mechanics built with [Phaser 3](https://phaser.io/) and TypeScript.

## What ships

| Mechanic           | Where                                                                  |
| ------------------ | ---------------------------------------------------------------------- |
| Movement (run/jump)| Arrow keys / WASD via `GameScene.update` — Shift toggles run speed.    |
| Coin collection    | `?` tiles → 100 pts + HUD update.                                      |
| Power-ups          | Mushroom (`small → big`) and Fire Flower (`fire`). Hit `?`/`M`/`F`     |
|                    | blocks from below to release.                                          |
| Fire shooting      | Press **X** in `fire` state to shoot a fireball that kills goombas.    |
| Goombas            | Patrol enemies; stomp kills, side-touch hurts.                         |
| Level progression  | Reaches flagpole → loads next level (carries score/lives/power).       |
| Lives / death      | Pit-fall, time-out, or side-hit while `small` → respawn or game over.  |
| HUD                | Score / coins / level / lives / power / time — `HudScene`.             |
| Game over / win    | `GameOverScene` shows result + Space restarts.                         |

## Three sample levels

Defined declaratively in `src/levels/index.ts` using a 1-char-per-tile grid:

| Level | Name          | Theme                                  |
| ----- | ------------- | -------------------------------------- |
| 1-1   | Pixel Plains  | Intro layout, a few coins and goombas. |
| 1-2   | Brick Bridge  | Brick platforms, both power-ups.       |
| 1-3   | Coin Cascade  | High coin density, denser enemies.     |

## Tile legend

| Char | Tile                                |
| ---- | ----------------------------------- |
| `.`  | empty                               |
| `#`  | ground / brick                      |
| `?`  | coin                                |
| `M`  | `?` block containing a mushroom     |
| `F`  | `?` block containing a fire flower  |
| `G`  | goal flagpole                       |
| `P`  | player spawn                        |
| `E`  | goomba                              |

## Controls

| Key             | Action                |
| --------------- | --------------------- |
| ← / →           | Walk                  |
| Shift (hold)    | Run                   |
| Space / ↑       | Jump                  |
| X               | Shoot (fire state)    |

## Develop

```bash
cd game
npm install
npm run dev          # http://localhost:5174
npm run build        # production bundle
npm run typecheck
```

## Integration with T01 / T03

`bootGame(parent)` from `src/main.ts` accepts a DOM element or selector — the
T01 `GameCanvas` component exposes its inner `<div>` via `onMount`, so the
two can compose:

```tsx
<GameCanvas onMount={(host) => bootGame(host)} />
```

## Architecture (scenes)

1. **BootScene** — generates pixel-art textures procedurally (no binary assets).
2. **GameScene** — main loop: physics, input, mechanics.
3. **HudScene** — runs in parallel, listens for `hud` events from `GameScene`.
4. **GameOverScene** — win/lose screen.

Procedural texture generation keeps the repo diff-reviewable and avoids
shipping any IP-encumbered Mario art.
