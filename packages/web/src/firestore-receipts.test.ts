import type { Receipt } from "@splita/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fs = vi.hoisted(() => ({
  setDoc: vi.fn(async () => {}),
  getDocs: vi.fn(),
  doc: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join("/") })),
  collection: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join("/") })),
  where: vi.fn((...a: unknown[]) => ({ where: a })),
  orderBy: vi.fn((...a: unknown[]) => ({ orderBy: a })),
  limit: vi.fn((n: number) => ({ limit: n })),
  query: vi.fn((c: unknown, ...parts: unknown[]) => ({ c, parts })),
}));
vi.mock("firebase/firestore", () => fs);
vi.mock("firebase/auth", () => ({ signInAnonymously: vi.fn(async () => ({ user: { uid: "anon-1" } })) }));

const { FirestoreReceipts, ensureAnonymousUser } = await import("./firestore-receipts.js");

const h = "c".repeat(64);
const receipt: Receipt = {
  id: "d".repeat(32), timestamp: "2026-11-25T12:00:00.000Z", workspaceId: "demo", payloadHash: h,
  entityCounts: { PERSON: 1 }, detectorSources: ["rules"], inferenceSource: "in_cloud",
  timings: { detect: 1, resolve: 1, pseudonymize: 1, reason: 1, restore: 1 }, prevReceiptHash: null, hash: h,
};
const db = {} as never;

describe("FirestoreReceipts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("writes to users/{uid}/receipts/{id}", async () => {
    await new FirestoreReceipts(db, async () => "u1").append(receipt);
    expect(fs.setDoc).toHaveBeenCalledWith({ path: `users/u1/receipts/${receipt.id}` }, receipt);
  });

  it("refuses unsafe receipts before touching Firestore", async () => {
    const bad = { ...receipt, anonymizedText: "secret" } as Receipt;
    await expect(new FirestoreReceipts(db, async () => "u1").append(bad)).rejects.toThrow(/Refusing/);
    expect(fs.setDoc).not.toHaveBeenCalled();
  });

  it("head queries the latest receipt for the workspace and strips extra fields", async () => {
    fs.getDocs.mockResolvedValueOnce({ docs: [{ data: () => ({ ...receipt, extra: "x" }) }] });
    const got = await new FirestoreReceipts(db, async () => "u1").head("demo");
    expect(got).toEqual(receipt);
    expect(fs.where).toHaveBeenCalledWith("workspaceId", "==", "demo");
    expect(fs.orderBy).toHaveBeenCalledWith("timestamp", "desc");
    expect(fs.limit).toHaveBeenCalledWith(1);
  });

  it("head is undefined for an empty workspace", async () => {
    fs.getDocs.mockResolvedValueOnce({ docs: [] });
    expect(await new FirestoreReceipts(db, async () => "u1").head("new")).toBeUndefined();
  });
});

describe("ensureAnonymousUser", () => {
  it("reuses the current user", async () => {
    expect(await ensureAnonymousUser({ currentUser: { uid: "me" } } as never)).toBe("me");
  });

  it("signs in anonymously otherwise", async () => {
    expect(await ensureAnonymousUser({ currentUser: null } as never)).toBe("anon-1");
  });
});
