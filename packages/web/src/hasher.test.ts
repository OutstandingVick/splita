import { describe, expect, it } from "vitest";
import { WebCryptoHasher } from "./hasher.js";

describe("WebCryptoHasher", () => {
  it("matches the sha256 test vector", async () => {
    expect(await new WebCryptoHasher().sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("hashes UTF-8 (₦)", async () => {
    expect(await new WebCryptoHasher().sha256("₦")).toMatch(/^[0-9a-f]{64}$/);
  });
});
