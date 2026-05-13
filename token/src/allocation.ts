import {
  ALLOCATION_BPS,
  BPS_TOTAL,
  TOTAL_SUPPLY,
  type AllocationKey,
} from "./config.js";

export interface AllocationEntry {
  bucket: AllocationKey;
  bps: number;
  amount: bigint;
}

/**
 * Splits the fixed total supply across buckets using the BPS table. Any
 * rounding dust is folded into the largest bucket so the sum equals
 * `TOTAL_SUPPLY` exactly.
 */
export function genesisAllocation(): AllocationEntry[] {
  const total = sumBps(ALLOCATION_BPS);
  if (total !== BPS_TOTAL) {
    throw new Error(`ALLOCATION_BPS must sum to ${BPS_TOTAL}, got ${total}`);
  }

  const entries: AllocationEntry[] = (Object.keys(ALLOCATION_BPS) as AllocationKey[]).map(
    (bucket) => {
      const bps = ALLOCATION_BPS[bucket];
      return {
        bucket,
        bps,
        amount: (TOTAL_SUPPLY * BigInt(bps)) / BigInt(BPS_TOTAL),
      };
    }
  );

  const distributed = entries.reduce((acc, e) => acc + e.amount, 0n);
  const dust = TOTAL_SUPPLY - distributed;
  if (dust !== 0n) {
    const biggest = entries.reduce((a, b) => (a.amount >= b.amount ? a : b));
    biggest.amount += dust;
  }
  return entries;
}

function sumBps(table: Record<string, number>): number {
  return Object.values(table).reduce((a, b) => a + b, 0);
}
