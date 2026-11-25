import { describe, expect, it } from "vitest";
import { webCryptoHasher as hasher } from "../test/helpers.js";
import { sealReceipt } from "./receipt.js";
import type { Receipt, ReceiptBody } from "./types.js";
import { verifyChains, verifyReceipt } from "./verify.js";

const body = (i: number, prev: string | null, payloadHash: string): ReceiptBody => ({
  id: String(i).padStart(32, "0"),
  timestamp: `2026-11-25T12:00:0${i}.000Z`,
  workspaceId: "w",
  payloadHash,
  entityCounts: { PERSON: 1 },
  detectorSources: ["rules"],
  inferenceSource: "in_cloud",
  cloudModel: "gemini-3.5-flash-lite",
  cloudAttempts: 1,
  timings: { detect: 1, resolve: 1, pseudonymize: 1, reason: 1, restore: 1 },
  prevReceiptHash: prev,
});

async function chain(n: number): Promise<Receipt[]> {
  const out: Receipt[] = [];
  for (let i = 0; i < n; i++) out.push(await sealReceipt(body(i, out.at(-1)?.hash ?? null, await hasher.sha256(`p${i}`)), hasher));
  return out;
}

describe("verifyReceipt", () => {
  it("matches the exact payload and detects any change", async () => {
    const [r] = await chain(1);
    if (!r) throw new Error("no receipt");
    expect(await verifyReceipt(r, "p0", hasher)).toEqual({ payloadMatches: true, hashMatches: true });
    expect((await verifyReceipt(r, "p0 ", hasher)).payloadMatches).toBe(false);
    expect((await verifyReceipt({ ...r, cloudAttempts: 2 }, "p0", hasher)).hashMatches).toBe(false);
  });
});

describe("verifyChains", () => {
  it("accepts an unbroken chain in any input order", async () => {
    const c = await chain(3);
    expect(await verifyChains([c[2], c[0], c[1]] as Receipt[], hasher)).toEqual([{ workspaceId: "w", ok: true, length: 3 }]);
  });

  it("finds a missing receipt as a broken link", async () => {
    const c = await chain(3);
    const [check] = await verifyChains([c[0], c[2]] as Receipt[], hasher);
    expect(check?.problem).toEqual({ receiptId: c[2]?.id, kind: "broken-link" });
  });

  it("finds a tampered receipt", async () => {
    const c = await chain(2);
    const [check] = await verifyChains([c[0], { ...c[1], cloudModel: "x" }] as Receipt[], hasher);
    expect(check?.problem?.kind).toBe("tampered");
  });
});
