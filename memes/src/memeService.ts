import { createHash, randomUUID } from "node:crypto";
import type { DailyChallenge, Meme, UploadInput } from "./types.js";
import type { IpfsClient } from "./ipfs.js";
import {
  DEFAULT_NSFW_THRESHOLD,
  HeuristicNsfwClassifier,
  type NsfwClassifier,
} from "./nsfw.js";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_BYTES = 8 * 1024 * 1024;

export interface MemeServiceOptions {
  ipfs: IpfsClient;
  nsfw?: NsfwClassifier;
  nsfwThreshold?: number;
  /** Provide a stable clock for tests. */
  now?: () => Date;
}

export interface VoteInput {
  memeId: string;
  voter: string;
  direction: "up" | "down";
}

/**
 * Core meme system. In-memory storage; production swaps the maps for SQL or
 * a KV store but keeps the same interface so the API layer doesn't change.
 */
export class MemeService {
  private memes = new Map<string, Meme>();
  private challenges = new Map<string, DailyChallenge>();
  private readonly nsfw: NsfwClassifier;
  private readonly threshold: number;
  private readonly now: () => Date;

  constructor(private readonly opts: MemeServiceOptions) {
    this.nsfw = opts.nsfw ?? new HeuristicNsfwClassifier();
    this.threshold = opts.nsfwThreshold ?? DEFAULT_NSFW_THRESHOLD;
    this.now = opts.now ?? (() => new Date());
  }

  /**
   * Upload pipeline: validate → NSFW screen → IPFS pin → store as pending
   * (or auto-reject if NSFW). Manual moderators can later flip `pending →
   * approved` via `setStatus`.
   */
  async upload(input: UploadInput): Promise<Meme> {
    if (!input.title.trim()) throw new ValidationError("title required");
    if (!ALLOWED_MIME.has(input.mimeType))
      throw new ValidationError(`unsupported mime: ${input.mimeType}`);
    if (input.data.length === 0) throw new ValidationError("empty payload");
    if (input.data.length > MAX_BYTES) throw new ValidationError("file too big");

    const contentHash = createHash("sha256").update(input.data).digest("hex");
    for (const existing of this.memes.values()) {
      if (existing.contentHash === contentHash) {
        throw new ValidationError(`duplicate of meme ${existing.id}`);
      }
    }

    const nsfwReport = await this.nsfw.classify({
      text: `${input.title} ${input.caption} ${input.tags.join(" ")}`,
      data: input.data,
      mimeType: input.mimeType,
    });

    const isNsfw = nsfwReport.score >= this.threshold;
    const { cid, url } = await this.opts.ipfs.add(input.data, input.mimeType);
    const now = this.now().toISOString();

    const meme: Meme = {
      id: randomUUID(),
      title: input.title.trim(),
      caption: input.caption.trim(),
      tags: input.tags.map((t) => t.toLowerCase()).slice(0, 5),
      author: input.author,
      mimeType: input.mimeType,
      size: input.data.length,
      contentHash,
      cid,
      ipfsUrl: url,
      status: isNsfw ? "nsfw" : "pending",
      nsfwScore: nsfwReport.score,
      rejectionReason: isNsfw ? `nsfw:${nsfwReport.reasons.join(",")}` : null,
      votes: { up: 0, down: 0 },
      voters: {},
      createdAt: now,
      approvedAt: null,
      challengeWinAt: null,
    };
    this.memes.set(meme.id, meme);
    return meme;
  }

  setStatus(id: string, status: Meme["status"], reason: string | null = null): Meme {
    const m = this.requireMeme(id);
    if (m.status === "nsfw" && status === "approved") {
      throw new ValidationError("cannot approve an NSFW-flagged meme without re-review");
    }
    m.status = status;
    if (status === "approved") m.approvedAt = this.now().toISOString();
    if (status === "rejected") m.rejectionReason = reason ?? m.rejectionReason;
    return m;
  }

  vote({ memeId, voter, direction }: VoteInput): Meme {
    const m = this.requireMeme(memeId);
    if (m.status !== "approved") throw new ValidationError("can only vote on approved memes");
    const prior = m.voters[voter];
    if (prior === direction) return m;
    if (prior) m.votes[prior] = Math.max(0, m.votes[prior] - 1);
    m.votes[direction] += 1;
    m.voters[voter] = direction;
    return m;
  }

  list(filter: { status?: Meme["status"]; tag?: string } = {}): Meme[] {
    const all = [...this.memes.values()];
    return all
      .filter((m) => (filter.status ? m.status === filter.status : true))
      .filter((m) => (filter.tag ? m.tags.includes(filter.tag.toLowerCase()) : true))
      .sort((a, b) => score(b) - score(a));
  }

  get(id: string): Meme | null {
    return this.memes.get(id) ?? null;
  }

  pendingQueue(): Meme[] {
    return [...this.memes.values()]
      .filter((m) => m.status === "pending")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  startChallenge(date: string, theme: string): DailyChallenge {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ValidationError("date must be YYYY-MM-DD");
    if (this.challenges.has(date)) return this.challenges.get(date)!;
    const c: DailyChallenge = { date, theme, winnerMemeId: null, submissions: [] };
    this.challenges.set(date, c);
    return c;
  }

  submitToChallenge(date: string, memeId: string): DailyChallenge {
    const challenge = this.challenges.get(date);
    if (!challenge) throw new ValidationError(`no challenge for ${date}`);
    const meme = this.requireMeme(memeId);
    if (meme.status !== "approved") throw new ValidationError("only approved memes can compete");
    if (!challenge.submissions.includes(memeId)) challenge.submissions.push(memeId);
    return challenge;
  }

  closeChallenge(date: string): DailyChallenge {
    const challenge = this.challenges.get(date);
    if (!challenge) throw new ValidationError(`no challenge for ${date}`);
    let winner: Meme | null = null;
    for (const id of challenge.submissions) {
      const m = this.memes.get(id);
      if (!m) continue;
      if (!winner || score(m) > score(winner)) winner = m;
    }
    if (winner) {
      winner.challengeWinAt = this.now().toISOString();
      challenge.winnerMemeId = winner.id;
    }
    return challenge;
  }

  getChallenge(date: string): DailyChallenge | null {
    return this.challenges.get(date) ?? null;
  }

  private requireMeme(id: string): Meme {
    const m = this.memes.get(id);
    if (!m) throw new NotFoundError(`meme ${id} not found`);
    return m;
  }
}

export class ValidationError extends Error {
  status = 400;
}
export class NotFoundError extends Error {
  status = 404;
}

function score(m: Meme): number {
  return m.votes.up - m.votes.down;
}
