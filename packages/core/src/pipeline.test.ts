import { describe, expect, it } from "vitest";
import { fakeReasoner, webCryptoHasher } from "../test/helpers.js";
import { InMemoryVault } from "./memory-vault.js";
import { runSplita, type SplitaDeps } from "./pipeline.js";
import type { DetectorPort } from "./ports.js";
import { InMemoryReceiptLog, receiptHash } from "./receipt.js";
import { RulesDetector } from "./rules-detector.js";

function deps(over: Partial<SplitaDeps> = {}) {
  const reasoner = fakeReasoner();
  const receipts = new InMemoryReceiptLog();
  const d: SplitaDeps = {
    detectors: [new RulesDetector()],
    vault: new InMemoryVault(),
    reasoner,
    receipts,
    hasher: webCryptoHasher,
    clock: () => new Date("2026-11-25T12:00:00Z"),
    ...over,
  };
  return { d, reasoner, receipts };
}

const TEXT = "Mr. Adebayo Ogunleye (the Employee) says Zenith Bank Plc (the Employer) owes him ₦850,000.";

describe("runSplita", () => {
  it("sends only anonymized text and restores the answer", async () => {
    const { d, reasoner } = deps();
    const r = await runSplita({ workspaceId: "w", text: TEXT }, d);
    if (!r.ok) throw r.error;
    expect(reasoner.calls).toEqual(["EMPLOYEE_1 (the Employee) says EMPLOYER_1 (the Employer) owes him AMOUNT_NGN_MID_1."]);
    expect(r.cloudView.anonymizedText).toBe(reasoner.calls[0]);
    expect(r.answer).toBe(TEXT);
  });

  it("writes a receipt hashing exactly the payload sent", async () => {
    const { d, reasoner, receipts } = deps();
    const r = await runSplita({ workspaceId: "w", text: TEXT }, d);
    if (!r.ok) throw r.error;
    expect(r.receipt.payloadHash).toBe(await webCryptoHasher.sha256(reasoner.calls[0] ?? ""));
    expect(r.receipt).toMatchObject({
      workspaceId: "w",
      timestamp: "2026-11-25T12:00:00.000Z",
      entityCounts: { PERSON: 1, ORG: 1, MONEY: 1 },
      detectorSources: ["rules"],
      inferenceSource: "in_cloud",
      cloudModel: "unknown",
      cloudAttempts: 1,
      prevReceiptHash: null,
    });
    expect(Object.keys(r.receipt.timings)).toEqual(["detect", "resolve", "pseudonymize", "reason", "restore"]);
    expect(receipts.all("w")).toEqual([r.receipt]);
  });

  it("chains receipts: second.prevReceiptHash is the hash of the first", async () => {
    const { d } = deps();
    const a = await runSplita({ workspaceId: "w", text: TEXT }, d);
    const b = await runSplita({ workspaceId: "w", text: "Mr. Ogunleye replied." }, d);
    if (!a.ok || !b.ok) throw new Error("run failed");
    expect(b.receipt.prevReceiptHash).toBe(await receiptHash(a.receipt, webCryptoHasher));
    expect(b.receipt.prevReceiptHash).toBe(a.receipt.hash);
  });

  it("keeps placeholders stable across calls in a workspace", async () => {
    const { d, reasoner } = deps();
    await runSplita({ workspaceId: "w", text: TEXT }, d);
    await runSplita({ workspaceId: "w", text: "Adebayo also emailed." }, d);
    expect(reasoner.calls[1]).toBe("EMPLOYEE_1 also emailed.");
  });

  it("fails closed when detection throws: reasoner never called", async () => {
    const boom: DetectorPort = { detect: () => Promise.reject(new Error("nano crashed")) };
    const { d, reasoner, receipts } = deps({ detectors: [new RulesDetector(), boom] });
    const r = await runSplita({ workspaceId: "w", text: TEXT }, d);
    expect(r).toMatchObject({ ok: false, stage: "detect" });
    expect(reasoner.calls).toEqual([]);
    expect(receipts.all("w")).toEqual([]);
  });

  it("fails closed when an alias would leak: reasoner never called", async () => {
    // Detector that only catches the first "Ngozi Okafor", leaving the second in the text.
    const partial: DetectorPort = {
      detect: async () => [{ start: 0, end: 12, text: "Ngozi Okafor", type: "PERSON", confidence: 1, source: "nano" }],
    };
    const { d, reasoner } = deps({ detectors: [partial] });
    const r = await runSplita({ workspaceId: "w", text: "Ngozi Okafor said NGOZI OKAFOR pays." }, d);
    expect(r).toMatchObject({ ok: false, stage: "pseudonymize" });
    if (!r.ok) expect(r.error.message).not.toMatch(/ngozi/i);
    expect(reasoner.calls).toEqual([]);
  });

  it("reports reasoner failures without a receipt", async () => {
    const { d, receipts } = deps({ reasoner: { reason: () => Promise.reject(new Error("503")) } });
    const r = await runSplita({ workspaceId: "w", text: TEXT }, d);
    expect(r).toMatchObject({ ok: false, stage: "reason" });
    expect(receipts.all("w")).toEqual([]);
  });

  it("only restores placeholders from its own workspace", async () => {
    const { d } = deps();
    await runSplita({ workspaceId: "a", text: TEXT }, d);
    const echo = deps({ vault: d.vault, reasoner: fakeReasoner(() => "EMPLOYEE_1 and EMPLOYER_1") });
    const r = await runSplita({ workspaceId: "b", text: "hello" }, echo.d);
    if (!r.ok) throw r.error;
    expect(r.answer).toBe("EMPLOYEE_1 and EMPLOYER_1");
  });

  it("reports each stage starting and finishing, in order", async () => {
    const { d } = deps();
    const events: string[] = [];
    const r = await runSplita({ workspaceId: "w", text: TEXT }, d, { onStage: (e) => events.push(`${e.stage}:${e.phase}`) });
    expect(r.ok).toBe(true);
    expect(events).toEqual([
      "detect:start", "detect:done", "resolve:start", "resolve:done", "pseudonymize:start", "verify:start", "verify:done",
      "pseudonymize:done", "reason:start", "reason:done", "restore:start", "restore:done", "receipt:start", "receipt:done",
    ]);
  });

  it("reports the failing stage and survives a throwing hook", async () => {
    const { d } = deps({ reasoner: { reason: () => Promise.reject(new Error("503")) } });
    const events: string[] = [];
    const r = await runSplita({ workspaceId: "w", text: TEXT }, d, {
      onStage: (e) => {
        events.push(`${e.stage}:${e.phase}`);
        throw new Error("ui bug");
      },
    });
    expect(r.ok).toBe(false);
    expect(events.at(-1)).toBe("reason:error");
  });
});
