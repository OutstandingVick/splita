import type { HasherPort, ReasonerPort } from "../src/ports.js";
import type { ReasonerResult } from "../src/types.js";

/** Web Crypto sha256 (available in Node 20+ and browsers); test-only. */
export const webCryptoHasher: HasherPort = {
  async sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  },
};

/** Reasoner that echoes its prompt (optionally transformed) and records every call. */
export function fakeReasoner(transform: (prompt: string) => string = (p) => p): ReasonerPort & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async reason(prompt): Promise<ReasonerResult> {
      calls.push(prompt);
      return { text: transform(prompt), source: "in_cloud", latencyMs: 1 };
    },
  };
}
