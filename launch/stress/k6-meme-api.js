// k6 load test for the T03 meme service.
//
//   k6 run launch/stress/k6-meme-api.js --vus 1000 --duration 60s
//
// Mixes the three hottest endpoints in a roughly real-world ratio:
//   60% list memes      (the gallery view)
//   25% vote on memes   (signed-in users)
//   10% submit a meme   (upload via multipart)
//    5% read a single meme detail
//
// Pass/fail thresholds are intentionally aggressive so the test fails CI if
// the service regresses below "ready for 1k concurrent users".

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

export const options = {
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "20s", target: 250 },
        { duration: "20s", target: 1000 },
        { duration: "60s", target: 1000 },
        { duration: "10s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{group:list}": ["p(95)<200"],
    "http_req_duration{group:vote}": ["p(95)<300"],
    "http_req_duration{group:upload}": ["p(95)<800"],
  },
};

const BASE = __ENV.MEME_API ?? "http://localhost:4000";
const memeIdPool = ["smoke-1", "smoke-2", "smoke-3"];
const uploadLatency = new Trend("upload_latency_ms");

export default function () {
  const r = Math.random();
  if (r < 0.6) {
    listMemes();
  } else if (r < 0.85) {
    voteMeme();
  } else if (r < 0.95) {
    uploadMeme();
  } else {
    showMeme();
  }
  sleep(0.2 + Math.random() * 0.4);
}

function listMemes() {
  const res = http.get(`${BASE}/api/memes?status=approved`, { tags: { group: "list" } });
  check(res, { "list 200": (r) => r.status === 200 });
}

function voteMeme() {
  const memeId = memeIdPool[Math.floor(Math.random() * memeIdPool.length)];
  const body = JSON.stringify({
    voter: `vu-${__VU}`,
    direction: Math.random() < 0.85 ? "up" : "down",
  });
  const res = http.post(`${BASE}/api/memes/${memeId}/vote`, body, {
    headers: { "Content-Type": "application/json" },
    tags: { group: "vote" },
  });
  check(res, { "vote ok": (r) => r.status === 200 || r.status === 404 || r.status === 400 });
}

function showMeme() {
  const memeId = memeIdPool[Math.floor(Math.random() * memeIdPool.length)];
  const res = http.get(`${BASE}/api/memes/${memeId}`, { tags: { group: "show" } });
  check(res, { "show ok": (r) => r.status === 200 || r.status === 404 });
}

function uploadMeme() {
  const start = Date.now();
  const fd = {
    file: http.file(makeTinyPng(), `bench-${__VU}-${__ITER}.png`, "image/png"),
    title: `Bench ${__VU}-${__ITER}`,
    caption: "stress test",
    tags: "bench",
    author: `vu-${__VU}`,
  };
  const res = http.post(`${BASE}/api/memes`, fd, { tags: { group: "upload" } });
  uploadLatency.add(Date.now() - start);
  check(res, { "upload created or duplicate": (r) => r.status === 201 || r.status === 400 });
}

function makeTinyPng() {
  // 1×1 PNG with random color so dedupe doesn't kick in.
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  const header = "89504e470d0a1a0a0000000d49484452000000010000000108020000007ddafa";
  const idatPrefix = "75";
  const idat =
    "49444154" +
    Buffer.from([0x78, 0x9c, 0x62, 0x00, r, g, b, 0xff, 0xff, 0x00, 0x00, 0x00, 0x05, 0x00, 0x01])
      .toString("hex");
  const end = "0000000049454e44ae426082";
  return new Uint8Array(Buffer.from(header + idatPrefix + idat + end, "hex"));
}
