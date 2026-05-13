# Design assets

The Mario-themed UI is delivered as code-first design tokens + reusable React
components rather than binary Figma `.fig` files (which can't be reviewed in
plain git diff).

- [`figma-tokens.json`](./figma-tokens.json) — W3C Design Tokens
  specification, importable by Tokens Studio for Figma to regenerate the
  styles in a Figma library.
- Components frames (see `frontend/src/components/`):
  - `GameCanvas` — 800×480 frame with HUD, parallax preview, mount slot.
  - `MemeForm` — 420px-wide submission card with file picker.
  - `Leaderboard` — 480px-wide ranking table with highlight row.
  - `WalletConnect` — connect button → balance pill toggle.

To pull these into a Figma file:

1. Install **Tokens Studio for Figma**.
2. Import `figma-tokens.json` as a single-file token set.
3. Generate styles; recreate frames using the component dimensions above.
