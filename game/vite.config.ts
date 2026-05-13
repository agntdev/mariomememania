import { defineConfig } from "vite";

// `base: "./"` makes built assets reference URLs RELATIVE to index.html.
// The Pages workflow mounts this build under /game/, so the bundle
// needs relative paths to find its own assets.
export default defineConfig({
  base: "./",
  server: { port: 5174 },
  build: { target: "es2020" },
});
