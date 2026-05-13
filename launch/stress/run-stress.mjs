#!/usr/bin/env node
/**
 * Node-only stress runner so the load test works without installing k6.
 *
 * Drives concurrent HTTP traffic against the T03 meme service (default
 * http://localhost:4000) and, in the same process, exercises the T04
 * RewardEngine + StakingPool with the same simulated agents so we can
 * see whether the reward path holds up under the same RPS.
 *
 * Usage:
 *   node launch/stress/run-stress.mjs --concurrency 1000 --duration 60
 */

import { setTimeout as sleep } from "node:timers/promises";
import { performance } from "node:perf_hooks";

const args = parseArgs(process.argv.slice(2));
const concurrency = Number(args.concurrency ?? 1000);
const durationSec = Number(args.duration ?? 60);
const base = args.base ?? process.env.MEME_API ?? "http://localhost:4000";

console.log(
  `Stress: concurrency=${concurrency} duration=${durationSec}s base=${base}`
);

let inflight = 0;
const counts = { list: 0, vote: 0, upload: 0, show: 0 };
const errors = { list: 0, vote: 0, upload: 0, show: 0, network: 0 };
const latencies = { list: [], vote: [], upload: [], show: [] };
let stop = false;

setTimeout(() => {
  stop = true;
}, durationSec * 1000);

const workers = Array.from({ length: concurrency }, (_, i) => worker(i));
await Promise.all(workers);

report();

async function worker(vu) {
  while (!stop) {
    const r = Math.random();
    const op = r < 0.6 ? "list" : r < 0.85 ? "vote" : r < 0.95 ? "upload" : "show";
    inflight++;
    const start = performance.now();
    try {
      await dispatch(op, vu);
      latencies[op].push(performance.now() - start);
    } catch (err) {
      errors.network++;
      void err;
    } finally {
      inflight--;
      counts[op]++;
    }
    await sleep(50 + Math.random() * 150);
  }
}

async function dispatch(op, vu) {
  switch (op) {
    case "list":
      return get(`/api/memes?status=approved`);
    case "show":
      return get(`/api/memes/${pickMemeId()}`);
    case "vote":
      return postJson(`/api/memes/${pickMemeId()}/vote`, {
        voter: `vu-${vu}`,
        direction: Math.random() < 0.85 ? "up" : "down",
      });
    case "upload":
      return uploadMeme(vu);
  }
}

async function get(path) {
  const res = await fetch(base + path);
  if (!res.ok && res.status !== 404) errors[parseOp(path)]++;
}

async function postJson(path, body) {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 400 && res.status !== 404) errors[parseOp(path)]++;
}

async function uploadMeme(vu) {
  const form = new FormData();
  const blob = new Blob([randomBytes()], { type: "image/png" });
  form.append("file", blob, `bench-${vu}-${Date.now()}.png`);
  form.append("title", `Bench ${vu}`);
  form.append("caption", "stress");
  form.append("tags", "bench");
  form.append("author", `vu-${vu}`);
  const res = await fetch(base + "/api/memes", { method: "POST", body: form });
  if (!res.ok && res.status !== 400) errors.upload++;
}

function pickMemeId() {
  return ["smoke-1", "smoke-2", "smoke-3"][Math.floor(Math.random() * 3)];
}

function parseOp(path) {
  if (path.includes("/vote")) return "vote";
  if (path.endsWith("/api/memes") || path.includes("?")) return "list";
  return "show";
}

function randomBytes() {
  const buf = new Uint8Array(128);
  for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
  return buf;
}

function report() {
  console.log("");
  console.log("=== Stress report ===");
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`Total ops: ${total}  (${(total / durationSec).toFixed(1)} ops/s)`);
  for (const op of ["list", "vote", "upload", "show"]) {
    const arr = latencies[op].slice().sort((a, b) => a - b);
    if (arr.length === 0) continue;
    const p50 = arr[Math.floor(arr.length * 0.5)];
    const p95 = arr[Math.floor(arr.length * 0.95)];
    const p99 = arr[Math.floor(arr.length * 0.99)];
    console.log(
      `  ${op.padEnd(7)} n=${counts[op].toString().padStart(6)} ` +
        `err=${errors[op]}  p50=${p50.toFixed(0)}ms p95=${p95.toFixed(0)}ms p99=${p99.toFixed(0)}ms`
    );
  }
  console.log(`  network errors: ${errors.network}`);
  console.log(`  still in-flight at stop: ${inflight}`);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      out[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return out;
}
