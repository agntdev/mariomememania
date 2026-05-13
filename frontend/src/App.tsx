import { GameCanvas, Leaderboard, MemeForm, WalletConnect } from "./components";

const DEMO_ENTRIES = [
  { rank: 1, player: "luigi64", score: 12450, coins: 88, memes: 12 },
  { rank: 2, player: "peach.ton", score: 11030, coins: 71, memes: 9 },
  { rank: 3, player: "toad", score: 9988, coins: 65, memes: 14 },
  { rank: 4, player: "you", score: 8042, coins: 52, memes: 6 },
  { rank: 5, player: "bowser_jr", score: 7110, coins: 49, memes: 3 },
];

export function App() {
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
