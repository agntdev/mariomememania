import { createHash } from "node:crypto";

/**
 * IPFS client interface. The real deployment plugs in either
 * `ipfs-http-client` (Kubo HTTP API), `@web3-storage/w3up-client`, or
 * Pinata's HTTP API. Tests use the `MemoryIpfsClient` below.
 */
export interface IpfsClient {
  add(data: Buffer, mimeType: string): Promise<{ cid: string; url: string }>;
  fetch(cid: string): Promise<Buffer | null>;
}

/**
 * In-memory IPFS shim. CIDs are deterministic sha256 hashes (NOT real CIDv1
 * multibase strings) — fine for tests and local dev, swap before going live.
 */
export class MemoryIpfsClient implements IpfsClient {
  private store = new Map<string, Buffer>();
  constructor(private gateway = "memory://") {}

  async add(data: Buffer): Promise<{ cid: string; url: string }> {
    const cid = "bafy" + createHash("sha256").update(data).digest("hex").slice(0, 52);
    this.store.set(cid, data);
    return { cid, url: `${this.gateway}${cid}` };
  }

  async fetch(cid: string): Promise<Buffer | null> {
    return this.store.get(cid) ?? null;
  }
}

/**
 * Real-IPFS adapter sketch. The actual HTTP request is left to the deployer
 * — but the type is exported so the rest of the system can be typed against
 * the eventual implementation.
 */
export class HttpIpfsClient implements IpfsClient {
  constructor(private apiUrl: string, private gateway: string, private auth?: string) {}

  async add(data: Buffer, mimeType: string): Promise<{ cid: string; url: string }> {
    const headers: Record<string, string> = { "Content-Type": mimeType };
    if (this.auth) headers.Authorization = `Bearer ${this.auth}`;
    const res = await fetch(`${this.apiUrl}/api/v0/add`, {
      method: "POST",
      headers,
      body: new Uint8Array(data),
    });
    if (!res.ok) throw new Error(`IPFS add failed: ${res.status}`);
    const json = (await res.json()) as { Hash: string };
    return { cid: json.Hash, url: `${this.gateway}${json.Hash}` };
  }

  async fetch(cid: string): Promise<Buffer | null> {
    const res = await fetch(`${this.gateway}${cid}`);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }
}
