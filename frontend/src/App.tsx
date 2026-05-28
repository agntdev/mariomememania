import { useState } from "react";

import { GameCanvas, Leaderboard, MemeForm, WalletConnect } from "./components";
import { MiniGame, type MiniGameRewardEvent } from "../../mini-game/MiniGame";

const DEMO_ENTRIES = [
  { rank: 1, player: "luigi64", score: 12450, coins: 88, memes: 12 },
  { rank: 2, player: "peach.ton", score: 11030, coins: 71, memes: 9 },
  { rank: 3, player: "toad", score: 9988, coins: 65, memes: 14 },
  { rank: 4, player: "you", score: 8042, coins: 52, memes: 6 },
  { rank: 5, player: "bowser_jr", score: 7110, coins: 49, memes: 3 },
];

export function App() {
  const [bonusOpen, setBonusOpen] = useState(false);
  const [lastReward, setLastReward] = useState<MiniGameRewardEvent | null>(null);

  // Host integration seam: forward the engine's reward event to the MARIO
  // token rewards pipeline. The mini-game stays decoupled from the token
  // package; the host wires it into `token/src/rewards.ts` →
  //   gameplayReward({ type: "level_completed", score: evt.score })
  const handleReward = (evt: MiniGameRewardEvent) => {
    setLastReward(evt);
  };

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <h1
          style={{
            margin: 0,
            color: "var(--mario-red)",
            textShadow: "var(--pixel) var(--pixel) 0 var(--mario-dark)",
            fontSize: 22,
          }}
        >
          MarioMemeMania
        </h1>
        <WalletConnect />
      </header>

      <section style={{ marginBottom: 24 }}>
        <GameCanvas />
      </section>

      <section
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <button
          type="button"
          className="pixel-btn"
          onClick={() => setBonusOpen((v) => !v)}
          aria-expanded={bonusOpen}
          aria-controls="mario-bonus-round"
        >
          {bonusOpen ? "Close bonus round" : "Play bonus round"}
        </button>
        {lastReward && (
          <span style={{ fontSize: 10, opacity: 0.9 }}>
            Last bonus: {lastReward.score} pts · {lastReward.correctCount}/
            {lastReward.questionCount}
            {lastReward.perfect ? " · PERFECT" : ""}
          </span>
        )}
      </section>

      {bonusOpen && (
        <section id="mario-bonus-round" style={{ marginBottom: 24 }}>
          <MiniGame onReward={handleReward} onClose={() => setBonusOpen(false)} />
        </section>
      )}

      <section
        style={{
          display: "grid",
          gap: 24,
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
        }}
      >
        <MemeForm
          onSubmit={async (s) => {
            console.log("submission (demo)", s);
          }}
        />
        <Leaderboard entries={DEMO_ENTRIES} highlight="you" />
      </section>

      <footer style={{ marginTop: 32, textAlign: "center", fontSize: 10, opacity: 0.85 }}>
        Powered by MARIO · It's-a token economy!
      </footer>
    </main>
  );
}
