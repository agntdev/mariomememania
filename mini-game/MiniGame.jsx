// @ts-check
/**
 * MarioMemeMania — Meme Trivia Bonus Round UI (S2T03).
 *
 * React component that drives the pure-JS engine from
 * `./mini-game-logic.js` (S2T02). Renders the question card with
 * timer bar, 4-option grid, score/combo HUD, and the result screen.
 *
 * Keyboard shortcuts (when running):
 *   1-4  answer A/B/C/D
 *   Esc  close the panel
 *   R    restart after the round ends
 *
 * Usage:
 *
 *     import { MiniGame } from "../../mini-game/MiniGame.jsx";
 *     <MiniGame
 *       onReward={(evt) => gameplayReward({ type: "level_completed", score: evt.score })}
 *       onClose={() => setOpen(false)}
 *     />
 *
 * The component does not import the token package directly — it forwards
 * the engine's `RewardEvent` to the host via `onReward`, keeping the UI
 * package dependency-free (the host wires it into `token/src/rewards.ts`).
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import {
  DEFAULT_CONFIG,
  DEMO_MEMES,
  answer,
  buildQuestionPool,
  createRound,
  getView,
  tick,
} from "./mini-game-logic.js";

import "./game-styles.css";

/**
 * @typedef {object} MiniGameProps
 * @property {(evt: import("./mini-game-logic.js").RewardEvent) => void} [onReward]
 *           Called once when the round ends in a "win".
 * @property {() => void} [onClose]
 *           Called when the user dismisses the panel (Esc or close button).
 * @property {Partial<import("./mini-game-logic.js").MiniGameConfig>} [config]
 *           Engine config overrides (e.g. shorter timers in tests).
 * @property {number} [seed]
 *           PRNG seed. Defaults to `Date.now()` so each session is different.
 * @property {ReadonlyArray<{id:string,caption:string,tags:string[],author:string,votes:{up:number,down:number},thumbUrl?:string}>} [memes]
 *           Override the meme pool. Defaults to `DEMO_MEMES`.
 * @property {string} [title]
 */

const OPTION_LETTERS = /** @type {const} */ (["A", "B", "C", "D"]);

/**
 * @param {MiniGameProps} props
 */
export function MiniGame({ onReward, onClose, config, seed, memes, title = "Meme Trivia Bonus Round" }) {
  const cfg = useMemo(() => ({ ...DEFAULT_CONFIG, ...(config || {}) }), [config]);
  const pool = useMemo(
    () => buildQuestionPool(memes ? memes.slice() : DEMO_MEMES.slice(), { seed: 7 }),
    [memes],
  );

  const [roundSeed, setRoundSeed] = useState(() => seed ?? (Date.now() & 0x7fffffff));
  const roundRef = useRef(createRound({ seed: roundSeed, questions: pool, config: cfg }));
  const [, force] = useReducer((n) => n + 1, 0);
  const [selected, setSelected] = useState(/** @type {number | null} */ (null));
  const [reveal, setReveal] = useState(/** @type {{ chosen: number, correct: number } | null} */ (null));
  const rewardedRef = useRef(false);

  // Rebuild the round whenever the seed/config/pool changes.
  useEffect(() => {
    roundRef.current = createRound({ seed: roundSeed, questions: pool, config: cfg });
    rewardedRef.current = false;
    setSelected(null);
    setReveal(null);
    force();
  }, [roundSeed, pool, cfg]);

  // Tick loop. Drives the engine via requestAnimationFrame. Pauses the
  // moment phase !== "playing" so the result screen is stable.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(100, now - last);
      last = now;
      const r = roundRef.current;
      if (r.phase === "playing") {
        tick(r, dt);
        force();
      }
      if (r.phase === "ended" && !rewardedRef.current) {
        rewardedRef.current = true;
        if (r.rewardEvent && onReward) onReward(r.rewardEvent);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [onReward]);

  const submit = useCallback((idx) => {
    const r = roundRef.current;
    if (r.phase !== "playing") return;
    const q = r.questions[r.currentIndex];
    if (!q) return;
    setSelected(idx);
    setReveal({ chosen: idx, correct: q.correctIndex });
    answer(r, idx);
    // Brief flash, then move on.
    window.setTimeout(() => {
      setSelected(null);
      setReveal(null);
      force();
    }, 450);
    force();
  }, []);

  const restart = useCallback(() => {
    setRoundSeed((Date.now() & 0x7fffffff) ^ ((roundSeed + 1) | 0));
  }, [roundSeed]);

  // Keyboard shortcuts. Bound to window so the panel doesn't need focus.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (onClose) onClose();
        return;
      }
      const r = roundRef.current;
      if (r.phase === "ended" && (e.key === "r" || e.key === "R")) {
        restart();
        return;
      }
      if (r.phase !== "playing") return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= 4) {
        e.preventDefault();
        submit(n - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, restart, submit]);

  const view = getView(roundRef.current);
  const timerPct = Math.max(0, Math.min(1, view.questionTimeLeftMs / cfg.questionTimeMs));
  const roundPct = Math.max(0, Math.min(1, view.roundTimeLeftMs / cfg.roundTimeMs));
  const timerCls =
    timerPct > 0.5 ? "mg-timer-ok" : timerPct > 0.25 ? "mg-timer-warn" : "mg-timer-danger";

  return (
    <section className="mg-root" aria-label="Meme Trivia mini game" data-phase={view.phase}>
      <header className="mg-header">
        <h2 className="mg-title">{title}</h2>
        {onClose && (
          <button
            type="button"
            className="mg-close"
            onClick={onClose}
            aria-label="Close mini game"
          >
            ×
          </button>
        )}
      </header>

      <dl className="mg-hud" aria-label="Score and progress">
        <div className="mg-hud-cell">
          <dt>Score</dt>
          <dd className="mg-score" data-testid="mg-score">{view.score}</dd>
        </div>
        <div className="mg-hud-cell">
          <dt>Combo</dt>
          <dd className="mg-combo">×{view.combo.toFixed(1)}</dd>
        </div>
        <div className="mg-hud-cell">
          <dt>Question</dt>
          <dd>
            {Math.min(view.questionIndex + 1, view.questionCount)}/{view.questionCount}
          </dd>
        </div>
        <div className="mg-hud-cell">
          <dt>Time</dt>
          <dd>{Math.ceil(view.roundTimeLeftMs / 1000)}s</dd>
        </div>
      </dl>

      <div className="mg-round-bar" aria-hidden="true">
        <span className="mg-round-bar-fill" style={{ width: `${roundPct * 100}%` }} />
      </div>

      {view.phase === "playing" && view.currentQuestion && (
        <>
          <div className={`mg-timer ${timerCls}`} role="timer" aria-label="Question timer">
            <span className="mg-timer-fill" style={{ width: `${timerPct * 100}%` }} />
          </div>

          <p className="mg-prompt">{view.currentQuestion.prompt}</p>

          <div className="mg-options" role="group" aria-label="Answer options">
            {view.currentQuestion.options.map((opt, i) => {
              const isSelected = selected === i;
              const isCorrect = reveal && i === reveal.correct;
              const isWrong = reveal && reveal.chosen === i && reveal.chosen !== reveal.correct;
              const cls = [
                "mg-option",
                isSelected ? "mg-option-selected" : "",
                isCorrect ? "mg-option-correct" : "",
                isWrong ? "mg-option-wrong" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={`${view.currentQuestion.id}-${i}`}
                  type="button"
                  className={cls}
                  onClick={() => submit(i)}
                  disabled={reveal != null}
                  aria-label={`Option ${OPTION_LETTERS[i]}: ${opt}`}
                >
                  <span className="mg-option-key">{OPTION_LETTERS[i]}</span>
                  <span className="mg-option-text">{opt}</span>
                </button>
              );
            })}
          </div>

          <p className="mg-hint">
            Press <kbd>1</kbd>–<kbd>4</kbd> to answer · <kbd>Esc</kbd> to close
          </p>
        </>
      )}

      {view.phase === "ended" && (
        <div className={`mg-result mg-result-${view.outcome}`} role="status">
          <p className="mg-result-headline">
            {view.outcome === "win" ? (view.perfect ? "PERFECT!" : "WAHOO!") : "GAME OVER"}
          </p>
          <p className="mg-result-score" data-testid="mg-final-score">{view.score}</p>
          <p className="mg-result-detail">
            {view.correctCount}/{view.questionCount} correct · best combo ×{view.comboHigh.toFixed(1)}
          </p>
          {view.rewardEvent && (
            <p className="mg-result-reward">+ MARIO reward queued</p>
          )}
          <div className="mg-result-actions">
            <button type="button" className="mg-btn mg-btn-primary" onClick={restart}>
              Play again (R)
            </button>
            {onClose && (
              <button type="button" className="mg-btn" onClick={onClose}>
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default MiniGame;
