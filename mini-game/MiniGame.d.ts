/**
 * Type declarations for `./MiniGame.jsx`. Lets TypeScript consumers
 * (e.g. `frontend/src/App.tsx`) import the JSX component with full
 * prop types and no `any` leaks.
 */

import type { ComponentType } from "react";

export interface MiniGameRewardEvent {
  type: "mini_game_completed";
  score: number;
  correctCount: number;
  questionCount: number;
  perfect: boolean;
  outcome: "win" | "fail" | "none";
}

export interface MiniGameConfig {
  questionCount?: number;
  questionTimeMs?: number;
  roundTimeMs?: number;
  pointsPerCorrect?: number;
  comboStep?: number;
  comboCap?: number;
  bonusOnCorrectMs?: number;
  penaltyOnWrongMs?: number;
  survivalSecondsValue?: number;
  perfectMultiplier?: number;
}

export interface MiniGameMeme {
  id: string;
  caption: string;
  tags: string[];
  author: string;
  votes: { up: number; down: number };
  thumbUrl?: string;
}

export interface MiniGameProps {
  /** Fired once when the round ends in a "win". */
  onReward?: (evt: MiniGameRewardEvent) => void;
  /** Fired when the user dismisses the panel (close button or Esc). */
  onClose?: () => void;
  /** Engine config overrides. */
  config?: MiniGameConfig;
  /** PRNG seed. Defaults to a time-based seed. */
  seed?: number;
  /** Override the meme pool. Defaults to the engine's `DEMO_MEMES`. */
  memes?: ReadonlyArray<MiniGameMeme>;
  /** Panel title. */
  title?: string;
}

export const MiniGame: ComponentType<MiniGameProps>;

declare const _default: ComponentType<MiniGameProps>;
export default _default;
