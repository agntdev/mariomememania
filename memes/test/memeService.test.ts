import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MemeService } from "../src/memeService.js";
import { MemoryIpfsClient } from "../src/ipfs.js";

function tinyPng(): Buffer {
  // 1×1 transparent PNG.
  return Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63000100000005000100" +
      "0d0a2db40000000049454e44ae426082",
    "hex"
  );
}

function input(overrides: Partial<Parameters<MemeService["upload"]>[0]> = {}) {
  return {
    title: "Mario time",
    caption: "wahoo",
    tags: ["luigi"],
    author: "agent_a",
    mimeType: "image/png",
    data: tinyPng(),
    ...overrides,
  };
}

describe("MemeService.upload", () => {
  it("accepts a valid PNG and returns a CID + pending status", async () => {
    const svc = new MemeService({ ipfs: new MemoryIpfsClient() });
    const m = await svc.upload(input());
    assert.equal(m.status, "pending");
    assert.match(m.cid, /^bafy[a-f0-9]+/);
    assert.equal(m.size, tinyPng().length);
    assert.equal(m.tags[0], "luigi");
  });

  it("rejects unsupported mime types", async () => {
    const svc = new MemeService({ ipfs: new MemoryIpfsClient() });
    await assert.rejects(svc.upload(input({ mimeType: "application/pdf" })), /unsupported/);
  });

  it("rejects duplicate content", async () => {
    const svc = new MemeService({ ipfs: new MemoryIpfsClient() });
    await svc.upload(input());
    await assert.rejects(svc.upload(input({ title: "Mario again" })), /duplicate/);
  });

  it("flags as NSFW when keywords appear", async () => {
    const svc = new MemeService({ ipfs: new MemoryIpfsClient() });
    const m = await svc.upload(input({ title: "very NSFW meme", caption: "explicit fun" }));
    assert.equal(m.status, "nsfw");
    assert.ok(m.nsfwScore >= 0.5);
  });
});

describe("MemeService.moderate", () => {
  it("can approve a pending meme", async () => {
    const svc = new MemeService({ ipfs: new MemoryIpfsClient() });
    const m = await svc.upload(input());
    const approved = svc.setStatus(m.id, "approved");
    assert.equal(approved.status, "approved");
    assert.ok(approved.approvedAt);
  });

  it("refuses to approve an NSFW-flagged meme", async () => {
    const svc = new MemeService({ ipfs: new MemoryIpfsClient() });
    const m = await svc.upload(input({ title: "explicit nsfw" }));
    assert.throws(() => svc.setStatus(m.id, "approved"), /NSFW/);
  });
});

describe("MemeService.vote", () => {
  it("counts up- and down-votes and prevents duplicate votes", async () => {
    const svc = new MemeService({ ipfs: new MemoryIpfsClient() });
    const m = await svc.upload(input());
    svc.setStatus(m.id, "approved");
    svc.vote({ memeId: m.id, voter: "u1", direction: "up" });
    svc.vote({ memeId: m.id, voter: "u2", direction: "up" });
    svc.vote({ memeId: m.id, voter: "u1", direction: "up" }); // no-op
    const after = svc.get(m.id)!;
    assert.equal(after.votes.up, 2);
    assert.equal(after.votes.down, 0);

    svc.vote({ memeId: m.id, voter: "u1", direction: "down" });
    const flipped = svc.get(m.id)!;
    assert.equal(flipped.votes.up, 1);
    assert.equal(flipped.votes.down, 1);
  });

  it("rejects voting on non-approved memes", async () => {
    const svc = new MemeService({ ipfs: new MemoryIpfsClient() });
    const m = await svc.upload(input());
    assert.throws(() => svc.vote({ memeId: m.id, voter: "u", direction: "up" }), /approved/);
  });
});

describe("Daily challenge", () => {
  it("picks the highest-scoring submission as the winner", async () => {
    const svc = new MemeService({ ipfs: new MemoryIpfsClient() });
    const a = await svc.upload(input({ title: "A", data: Buffer.from("AAA") }));
    const b = await svc.upload(input({ title: "B", data: Buffer.from("BBBB") }));
    svc.setStatus(a.id, "approved");
    svc.setStatus(b.id, "approved");

    svc.startChallenge("2026-05-13", "Pipes");
    svc.submitToChallenge("2026-05-13", a.id);
    svc.submitToChallenge("2026-05-13", b.id);

    svc.vote({ memeId: a.id, voter: "u1", direction: "up" });
    svc.vote({ memeId: b.id, voter: "u1", direction: "up" });
    svc.vote({ memeId: b.id, voter: "u2", direction: "up" });

    const closed = svc.closeChallenge("2026-05-13");
    assert.equal(closed.winnerMemeId, b.id);
    assert.ok(svc.get(b.id)!.challengeWinAt);
  });
});
