export interface LeaderEntry {
  rank: number;
  player: string;
  score: number;
  coins: number;
  memes: number;
}

export interface LeaderboardProps {
  entries: LeaderEntry[];
  title?: string;
  /** Highlight a player by name (e.g. the connected wallet's display name). */
  highlight?: string;
}

/**
 * Pixel-art leaderboard. Pure display component; data is fetched and ranked
 * upstream so this stays trivial to test and reuse.
 */
export function Leaderboard({ entries, title = "LEADERBOARD", highlight }: LeaderboardProps) {
  return (
    <section className="pixel-box" style={{ maxWidth: 480 }}>
      <h3 style={{ margin: "0 0 12px", color: "var(--mario-red)" }}>{title}</h3>

      {entries.length === 0 ? (
        <p style={{ fontSize: 10 }}>No scores yet — be the first hero!</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
          <thead>
            <tr style={{ background: "var(--mario-yellow)", color: "var(--mario-dark)" }}>
              <th style={th}>#</th>
              <th style={th}>Player</th>
              <th style={th}>Score</th>
              <th style={th}>Coins</th>
              <th style={th}>Memes</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const isMe = highlight && e.player.toLowerCase() === highlight.toLowerCase();
              return (
                <tr
                  key={`${e.rank}-${e.player}`}
                  style={{
                    background: isMe ? "var(--mario-coin)" : undefined,
                    color: isMe ? "var(--mario-dark)" : undefined,
                  }}
                >
                  <td style={td}>{medalFor(e.rank)}</td>
                  <td style={td}>{e.player}</td>
                  <td style={td}>{e.score.toLocaleString()}</td>
                  <td style={td}>{e.coins}</td>
                  <td style={td}>{e.memes}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  borderBottom: "var(--pixel) solid var(--mario-dark)",
};

const td: React.CSSProperties = {
  padding: "6px 8px",
  borderBottom: "2px dashed rgba(0,0,0,0.15)",
};

function medalFor(rank: number) {
  if (rank === 1) return "1ST";
  if (rank === 2) return "2ND";
  if (rank === 3) return "3RD";
  return String(rank);
}
