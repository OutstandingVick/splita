import { describe, expect, it } from "vitest";
import { webCryptoHasher } from "../test/helpers.js";
import { canonicalJson, countEntities, InMemoryReceiptLog, receiptHash, sealReceipt } from "./receipt.js";
import type { ReceiptBody } from "./types.js";

const body: ReceiptBody = {
  id: "r1",
  timestamp: "2026-11-25T00:00:00.000Z",
  workspaceId: "w",
  payloadHash: "abc",
  entityCounts: { PERSON: 2 },
  detectorSources: ["rules"],
  inferenceSource: "in_cloud",
  timings: { detect: 1, resolve: 1, pseudonymize: 1, reason: 1, restore: 1 },
  prevReceiptHash: null,
};

describe("canonicalJson", () => {
  it("sorts keys recursively and drops undefined", () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: undefined }], c: null } })).toBe('{"a":{"c":null,"d":[2,{"z":1}]},"b":1}');
  });
});

describe("sealReceipt", () => {
  it("hashes the body deterministically regardless of key order", async () => {
    const reordered = Object.fromEntries(Object.entries(body).reverse()) as unknown as ReceiptBody;
    expect((await sealReceipt(body, webCryptoHasher)).hash).toBe((await sealReceipt(reordered, webCryptoHasher)).hash);
  });

  it("receiptHash of a sealed receipt equals its hash", async () => {
    const r = await sealReceipt(body, webCryptoHasher);
    expect(await receiptHash(r, webCryptoHasher)).toBe(r.hash);
    expect(r.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when any field changes", async () => {
    const a = await sealReceipt(body, webCryptoHasher);
    const b = await sealReceipt({ ...body, payloadHash: "abd" }, webCryptoHasher);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe("countEntities", () => {
  it("counts unique entities by type", () => {
    const e = (placeholder: string, type: "PERSON" | "ORG") => ({ id: placeholder, type, canonical: "", aliases: [], placeholder });
    expect(countEntities({ PERSON_1: e("PERSON_1", "PERSON"), PERSON_2: e("PERSON_2", "PERSON"), ORG_1: e("ORG_1", "ORG") })).toEqual({ PERSON: 2, ORG: 1 });
  });
});

describe("InMemoryReceiptLog", () => {
  it("returns the latest receipt per workspace", async () => {
    const log = new InMemoryReceiptLog();
    const r1 = await sealReceipt(body, webCryptoHasher);
    const r2 = await sealReceipt({ ...body, id: "r2", prevReceiptHash: r1.hash }, webCryptoHasher);
    await log.append(r1);
    await log.append(r2);
    expect(await log.head("w")).toEqual(r2);
    expect(await log.head("other")).toBeUndefined();
  });
});
