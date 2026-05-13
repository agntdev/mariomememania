import { useCallback, useState } from "react";

export interface WalletState {
  address: string | null;
  balance: { mario: number; ton: number };
  connected: boolean;
}

export interface WalletConnectProps {
  /** Pluggable connector: returns the connected address. T04 wires the real TON connector here. */
  connect?: () => Promise<{ address: string; balance?: { mario: number; ton: number } }>;
  initialState?: WalletState;
}

const EMPTY: WalletState = { address: null, balance: { mario: 0, ton: 0 }, connected: false };

/**
 * Wallet connect button + balance pill. Connector is injected so this stays
 * decoupled from any specific TON SDK; a no-op demo connector is used by
 * default so the component renders standalone.
 */
export function WalletConnect({ connect, initialState }: WalletConnectProps) {
  const [state, setState] = useState<WalletState>(initialState ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const fn = connect ?? demoConnect;
      const { address, balance } = await fn();
      setState({
        address,
        balance: balance ?? { mario: 1000, ton: 0.5 },
        connected: true,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connect failed");
    } finally {
      setBusy(false);
    }
  }, [connect]);

  const disconnect = () => setState(EMPTY);

  if (!state.connected) {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        <button className="pixel-btn" onClick={handleConnect} disabled={busy}>
          {busy ? "Connecting..." : "Connect Wallet"}
        </button>
        {error && <span style={{ color: "#fff", fontSize: 10 }}>{error}</span>}
      </div>
    );
  }

  return (
    <div
      className="pixel-box"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 12px",
        fontSize: 10,
      }}
    >
      <CoinIcon />
      <span>
        <strong>{state.balance.mario.toLocaleString()}</strong> MARIO
      </span>
      <span style={{ opacity: 0.7 }}>·</span>
      <span>
        <strong>{state.balance.ton.toFixed(2)}</strong> TON
      </span>
      <span style={{ opacity: 0.7 }}>·</span>
      <code>{shorten(state.address!)}</code>
      <button className="pixel-btn" style={{ background: "var(--mario-dark)" }} onClick={disconnect}>
        ×
      </button>
    </div>
  );
}

function CoinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 8 8" aria-hidden="true" shapeRendering="crispEdges">
      <rect x="2" y="0" width="4" height="1" fill="#ffce42" />
      <rect x="1" y="1" width="6" height="1" fill="#fbd000" />
      <rect x="0" y="2" width="8" height="4" fill="#fbd000" />
      <rect x="1" y="6" width="6" height="1" fill="#c08400" />
      <rect x="2" y="7" width="4" height="1" fill="#8b5a00" />
      <rect x="3" y="2" width="2" height="4" fill="#fff7a8" />
    </svg>
  );
}

function shorten(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

async function demoConnect() {
  await new Promise((r) => setTimeout(r, 350));
  return {
    address: "UQCqnetXpRfQq3BJ_cml5LsR9juPgANd7QdUCWNJLs7v27J5",
    balance: { mario: 1234, ton: 0.42 },
  };
}
