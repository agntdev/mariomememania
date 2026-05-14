// @ts-check
/**
 * MiniGame.jsx — Meme Trivia Bonus Round UI shell.
 *
 * Mounts above the regular game canvas when the host application emits a
 * `mm:bonus` postMessage (see `mini-game-design.md` § 6 integration). Drives
 * the pure logic engine in `mini-game-logic.js` via an internal animation
 * frame loop and renders a Mario-themed question card.
 *
 * Pure presentation + thin adapter — no network calls, no token plumbing.
 * The host wires `onComplete(rewardEvent)` to its own MARIO reward engine.
 *
 * Usage from frontend/src/App.tsx (S2T03 integration step):
 *
 *     import { MiniGame } from "../../mini-game/MiniGame.jsx";
 *     import { DEMO_MEMES, buildQuestionPool } from "../../mini-game/mini-game-logic.js";
 *
 *     <MiniGame
 *       open={showBonus}
 *       memes={memes.length ? memes : DEMO_MEMES}
 *       onClose={() => setShowBonus(false)}
 *       onComplete={(evt) => rewardEngine.recordGameplay(player, {
 *         type: "level_completed",
 *         score: evt.score,
 *       })}
 *     />
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

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
 * @property {boolean} open                    overlay visibility
 * @property {Array<any>=} memes               meme pool, falls back to DEMO_MEMES
 * @property {number=} seed                    deterministic round seed
 * @property {() => void=} onClose             dismiss the overlay (skip / close)
 * @property {(evt: any) => void=} onComplete  emitted with the reward event on win
 * @property {Partial<typeof DEFAULT_CONFIG>=} config
 */

/* ── reducer ──────────────────────────────────────────────────────────── */

function reducer(state, action) {
  switch (action.type) {
    case "tick":
      tick(state.round, action.deltaMs);
      return { ...state, view: getView(state.round) };
    case "answer":
      answer(state.round, action.choice);
      return { ...state, view: getView(state.round) };
    case "reset":
      return makeInitial(action.payload);
    default:
      return state;
  }
}

function makeInitial({ seed, memes, config }) {
  const pool = buildQuestionPool(memes, { seed });
  const round = createRound({ seed, questions: pool, config });
  return { round, view: getView(round) };
}

/* ── component ────────────────────────────────────────────────────────── */

/**
 * @param {MiniGameProps} props
 */
export function MiniGame({
  open,
  memes,
  seed = Date.now() & 0xffff,
  onClose,
  onComplete,
  config,
}) {
  const pool = useMemo(() => {
    const src = memes && memes.length >= 4 ? memes : DEMO_MEMES;
    return src;
  }, [memes]);

  const initial = useMemo(
    () => makeInitial({ seed, memes: pool, config }),
    // we deliberately exclude config: passing a fresh object every render
    // shouldn't reset the round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed, pool]
  );

  const [state, dispatch] = useReducer(reducer, initial);
  const completedRef = useRef(false);
  const lastTimeRef = useRef(/** @type {number|null} */ (null));
  const rafRef = useRef(/** @type {number|null} */ (null));

  // Reset when the overlay is opened with a new seed.
  useEffect(() => {
    if (!open) return;
    dispatch({ type: "reset", payload: { seed, memes: pool, config } });
    completedRef.current = false;
    lastTimeRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seed]);

  // requestAnimationFrame loop driving tick().
  useEffect(() => {
    if (!open) return;
    if (state.view.phase !== "playing") return;
    /** @param {number} t */
    const step = (t) => {
      const last = lastTimeRef.current ?? t;
      const delta = Math.max(0, Math.min(1000, t - last));
      lastTimeRef.current = t;
      dispatch({ type: "tick", deltaMs: delta });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTimeRef.current = null;
    };
  }, [open, state.view.phase]);

  // Fire the host callback exactly once when the round ends with a reward.
  useEffect(() => {
    if (state.view.phase !== "ended") return;
    if (completedRef.current) return;
    completedRef.current = true;
    if (state.view.rewardEvent && onComplete) onComplete(state.view.rewardEvent);
  }, [state.view.phase, state.view.rewardEvent, onComplete]);

  // Keyboard shortcuts: 1-4 to answer, Esc to close.
  const handleAnswer = useCallback((idx) => {
    if (state.view.phase !== "playing") return;
    dispatch({ type: "answer", choice: idx });
  }, [state.view.phase]);

  useEffect(() => {
    if (!open) return;
    /** @param {KeyboardEvent} e */
    const onKey = (e) => {
      if (e.key === "Escape" && onClose) {
        onClose();
        return;
      }
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= 4) {
        handleAnswer(n - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, handleAnswer]);

  if (!open) return null;

  const v = state.view;
  const q = v.currentQuestion;

  return (
    <div className="mg-overlay" role="dialog" aria-modal="true" aria-label="Mini Game: Meme Trivia">
      <div className="mg-card pixel-box">
        <Header view={v} onClose={onClose} />

        {v.phase === "playing" && q && (
          <PlayingView view={v} question={q} onAnswer={handleAnswer} />
        )}

        {v.phase === "ended" && (
          <ResultView
            view={v}
            onClose={onClose}
            onPlayAgain={() =>
              dispatch({
                type: "reset",
                payload: { seed: (seed + 1) & 0xffff, memes: pool, config },
              })
            }
          />
        )}
      </div>
    </div>
  );
}

/* ── sub-views ────────────────────────────────────────────────────────── */

function Header({ view, onClose }) {
  const total = view.questionCount;
  return (
    <header className="mg-header">
      <h2 className="mg-title">
        <span className="mg-coin" aria-hidden="true">★</span>
        Meme Trivia Bonus
      </h2>
      <div className="mg-stats">
        <div className="mg-stat">
          <span className="mg-stat-label">Score</span>
          <span className="mg-stat-value mg-score">{view.score}</span>
        </div>
        <div className="mg-stat">
          <span className="mg-stat-label">Combo</span>
          <span className="mg-stat-value">×{view.combo.toFixed(1)}</span>
        </div>
        <div className="mg-stat">
          <span className="mg-stat-label">Q</span>
          <span className="mg-stat-value">
            {Math.min(view.questionIndex + 1, total)}/{total}
          </span>
        </div>
        <div className="mg-stat">
          <span className="mg-stat-label">Time</span>
          <span className="mg-stat-value">{(view.roundTimeLeftMs / 1000).toFixed(1)}s</span>
        </div>
        <button
          type="button"
          className="pixel-btn mg-close"
          onClick={onClose}
          aria-label="Close mini game"
        >
          ×
        </button>
      </div>
    </header>
  );
}

function PlayingView({ view, question, onAnswer }) {
  const pct = Math.max(
    0,
    Math.min(100, (view.questionTimeLeftMs / DEFAULT_CONFIG.questionTimeMs) * 100)
  );
  return (
    <>
      <div className="mg-timerbar" aria-hidden="true">
        <div className="mg-timerbar-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="mg-prompt">{question.prompt}</p>
      {question.meme?.thumbUrl && (
        <img
          className="mg-thumb"
          src={question.meme.thumbUrl}
          alt=""
          loading="lazy"
        />
      )}
      <ol className="mg-options">
        {question.options.map((opt, i) => (
          <li key={`${question.id}-${i}`}>
            <button
              type="button"
              className="pixel-btn mg-option"
              onClick={() => onAnswer(i)}
            >
              <span className="mg-option-key">{i + 1}</span>
              <span className="mg-option-text">{opt}</span>
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}

function ResultView({ view, onClose, onPlayAgain }) {
  const winColor = view.outcome === "win" ? "var(--mario-green)" : "var(--mario-red)";
  return (
    <div className="mg-result" style={{ borderTopColor: winColor }}>
      <h3 className="mg-result-title" style={{ color: winColor }}>
        {view.outcome === "win"
          ? view.perfect
            ? "PERFECT! WAHOO!"
            : "Round complete!"
          : "Time's up — no reward."}
      </h3>
      <dl className="mg-result-stats">
        <dt>Final score</dt>
        <dd>{view.score}</dd>
        <dt>Correct answers</dt>
        <dd>{view.correctCount}/{view.questionCount}</dd>
        <dt>Best combo</dt>
        <dd>×{view.comboHigh.toFixed(1)}</dd>
        {view.rewardEvent && (
          <>
            <dt>MARIO event</dt>
            <dd>{view.rewardEvent.type}</dd>
          </>
        )}
      </dl>
      <div className="mg-result-actions">
        <button type="button" className="pixel-btn mg-action" onClick={onPlayAgain}>
          Play again
        </button>
        <button type="button" className="pixel-btn mg-action mg-action-alt" onClick={onClose}>
          Back to game
        </button>
      </div>
    </div>
  );
}

export default MiniGame;
