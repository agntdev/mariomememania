/**
 * Lightweight heuristic NSFW filter.
 *
 * Production deployments should swap this for a real classifier (e.g.
 * `nsfwjs`, AWS Rekognition, or Cloudflare image moderation). The interface
 * is intentionally narrow so the swap is one file.
 *
 * The default heuristic combines:
 * - keyword scan over title/caption/tags
 * - a skin-tone-pixel ratio approximation derived from byte frequency in the
 *   image payload — *not* a substitute for a real classifier; it exists so
 *   the threshold-vs-score plumbing has something to operate on in tests.
 */

const KEYWORD_BLOCKLIST = [
  "nsfw",
  "porn",
  "nude",
  "naked",
  "xxx",
  "explicit",
  "gore",
  "violence",
  "sex",
  "18+",
];

export interface NsfwReport {
  score: number;
  reasons: string[];
}

export interface NsfwClassifier {
  classify(input: {
    text: string;
    data: Buffer;
    mimeType: string;
  }): Promise<NsfwReport>;
}

export class HeuristicNsfwClassifier implements NsfwClassifier {
  async classify({
    text,
    data,
  }: {
    text: string;
    data: Buffer;
    mimeType: string;
  }): Promise<NsfwReport> {
    const reasons: string[] = [];
    let score = 0;

    const lower = text.toLowerCase();
    for (const kw of KEYWORD_BLOCKLIST) {
      if (lower.includes(kw)) {
        score += 0.5;
        reasons.push(`keyword:${kw}`);
      }
    }

    // Cheap byte-frequency proxy: count bytes in the warm-tone band.
    let warm = 0;
    const sample = Math.min(data.length, 8192);
    for (let i = 0; i < sample; i++) {
      const b = data[i];
      if (b >= 0xc0 && b <= 0xee) warm += 1;
    }
    const ratio = sample === 0 ? 0 : warm / sample;
    if (ratio > 0.55) {
      score += (ratio - 0.55) * 0.6;
      reasons.push(`warm-byte-ratio:${ratio.toFixed(2)}`);
    }

    return { score: Math.min(score, 1), reasons };
  }
}

export const DEFAULT_NSFW_THRESHOLD = 0.5;
