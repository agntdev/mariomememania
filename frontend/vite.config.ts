import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `base: "./"` makes built assets reference URLs RELATIVE to index.html,
// so the bundle works under https://agntdev.github.io/<repo>/ (GitHub Pages
// subpath) without rewriting links by hand.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { port: 5173 },
});
