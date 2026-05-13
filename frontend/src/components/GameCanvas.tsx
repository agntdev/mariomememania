import { useEffect, useRef } from "react";

export interface GameCanvasProps {
  width?: number;
  height?: number;
  /** Slot where the Phaser instance (T02) will mount. */
  onMount?: (container: HTMLDivElement) => void;
}

/**
 * Pixel-art platformer canvas frame. Renders a static parallax preview when
 * no game engine is attached; otherwise yields its inner div to T02's Phaser
 * boot via onMount.
 */
export function GameCanvas({ width = 800, height = 480, onMount }: GameCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (hostRef.current && onMount) onMount(hostRef.current);
  }, [onMount]);

  return (
    <div
      className="game-canvas-frame"
      style={{
        width,
        maxWidth: "100%",
        border: "var(--pixel) solid var(--mario-dark)",
        boxShadow: "var(--pixel) var(--pixel) 0 var(--mario-dark)",
        background: "var(--mario-sky)",
        position: "relative",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "6px 10px",
          background: "var(--mario-red)",
          color: "#fff",
          borderBottom: "var(--pixel) solid var(--mario-dark)",
          fontSize: 10,
        }}
      >
        <span>WORLD 1-1</span>
        <span>TIME 400</span>
        <span>COINS x00</span>
      </header>
      <div
        ref={hostRef}
        data-testid="game-canvas-host"
        style={{ width: "100%", height, position: "relative", overflow: "hidden" }}
      >
        {!onMount && <PreviewScene />}
      </div>
    </div>
  );
}

function PreviewScene() {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 200 120"
      preserveAspectRatio="xMidYMid slice"
      shapeRendering="crispEdges"
      aria-label="Mario level preview"
    >
      <rect width="200" height="120" fill="#5c94fc" />
      {/* clouds */}
      <g fill="#f8f8f8">
        <rect x="20" y="18" width="20" height="8" />
        <rect x="24" y="14" width="12" height="4" />
        <rect x="120" y="26" width="24" height="8" />
        <rect x="126" y="22" width="14" height="4" />
      </g>
      {/* hills */}
      <g fill="#43b047">
        <polygon points="0,90 30,60 60,90" />
        <polygon points="80,90 120,55 160,90" />
      </g>
      {/* ground */}
      <rect x="0" y="96" width="200" height="24" fill="#8b4513" />
      <g fill="#5b2c0c">
        {Array.from({ length: 25 }).map((_, i) => (
          <rect key={i} x={i * 8} y="96" width="2" height="24" />
        ))}
      </g>
      {/* brick row */}
      <g fill="#c84c0c">
        {[60, 68, 84, 92].map((x) => (
          <rect key={x} x={x} y="68" width="8" height="8" />
        ))}
        <rect x="76" y="68" width="8" height="8" fill="#fbd000" />
      </g>
      {/* coin */}
      <rect x="78" y="56" width="4" height="6" fill="#ffce42" />
      {/* pipe */}
      <rect x="160" y="76" width="20" height="20" fill="#43b047" />
      <rect x="158" y="72" width="24" height="6" fill="#2d8030" />
      {/* mario silhouette */}
      <g fill="#e52521">
        <rect x="32" y="80" width="8" height="6" />
        <rect x="30" y="86" width="12" height="6" />
      </g>
      <rect x="32" y="86" width="8" height="2" fill="#1a1a2e" />
      <rect x="34" y="88" width="4" height="4" fill="#1a1a2e" />
    </svg>
  );
}
