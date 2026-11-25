import type { HasherPort } from "@splita/core";

/** sha256 via Web Crypto (crypto.subtle), lowercase hex. */
export class WebCryptoHasher implements HasherPort {
  constructor(private readonly subtle: SubtleCrypto = globalThis.crypto.subtle) {}

  async sha256(text: string): Promise<string> {
    const digest = await this.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }
}
