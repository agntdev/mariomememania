export type MemeStatus = "pending" | "approved" | "rejected" | "nsfw";

export interface Meme {
  id: string;
  title: string;
  caption: string;
  tags: string[];
  author: string;
  mimeType: string;
  size: number;
  /** Subresource integrity hash (sha256, hex). */
  contentHash: string;
  /** IPFS CID returned by the configured `IpfsClient`. */
  cid: string;
  ipfsUrl: string;
  status: MemeStatus;
  nsfwScore: number;
  rejectionReason: string | null;
  votes: { up: number; down: number };
  /** Track which authors have voted to keep ranking honest. */
  voters: Record<string, "up" | "down">;
  createdAt: string;
  approvedAt: string | null;
  /** Set if the meme is the winner of a daily challenge. */
  challengeWinAt: string | null;
}

export interface UploadInput {
  title: string;
  caption: string;
  tags: string[];
  author: string;
  mimeType: string;
  data: Buffer;
}

export interface DailyChallenge {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  theme: string;
  winnerMemeId: string | null;
  submissions: string[];
}
