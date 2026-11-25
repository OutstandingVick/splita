import type { Receipt } from "@splita/core";
import { describe, expect, it } from "vitest";
import { assertSafeReceipt, ReceiptSafetyError } from "./receipt-safety.js";

const h = "a".repeat(64);
const good: Receipt = {
  id: "b".repeat(32),
  timestamp: "2026-11-25T12:00:00.000Z",
  workspaceId: "demo",
  payloadHash: h,
  entityCounts: { PERSON: 2, MONEY: 1 },
  detectorSources: ["nano", "rules"],
  inferenceSource: "in_cloud",
  cloudModel: "gemini-3.5-flash-lite",
  cloudAttempts: 1,
  timings: { detect: 10, resolve: 1, pseudonymize: 1, reason: 900, restore: 1 },
  prevReceiptHash: null,
  hash: h,
};

describe("assertSafeReceipt", () => {
  it("accepts a metadata-only receipt", () => {
    expect(() => assertSafeReceipt(good)).not.toThrow();
    expect(() => assertSafeReceipt({ ...good, prevReceiptHash: h })).not.toThrow();
  });

  it.each([
    ["extra raw text", { ...good, anonymizedText: "EMPLOYEE_1 ..." }],
    ["the mapping", { ...good, mapping: { EMPLOYEE_1: "Adebayo" } }],
    ["a name smuggled into workspaceId", { ...good, workspaceId: "Adebayo Ogunleye" }],
    ["a name in entityCounts", { ...good, entityCounts: { "Adebayo Ogunleye": 1 } }],
    ["a non-hex hash", { ...good, payloadHash: "Mr. Ogunleye" }],
    ["a name in cloudModel", { ...good, cloudModel: "Zenith Bank Plc" }],
    ["a non-integer cloudAttempts", { ...good, cloudAttempts: 1.5 }],
    ["a missing field", (({ hash: _h, ...rest }) => rest)(good)],
  ])("rejects %s", (_label, bad) => {
    expect(() => assertSafeReceipt(bad as Receipt)).toThrow(ReceiptSafetyError);
  });

  it("never echoes values in the error", () => {
    try {
      assertSafeReceipt({ ...good, workspaceId: "Adebayo Ogunleye" });
    } catch (e) {
      expect(String(e)).not.toContain("Adebayo");
    }
  });
});
