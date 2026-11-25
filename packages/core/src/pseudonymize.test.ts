import { describe, expect, it } from "vitest";
import { pseudonymize } from "./pseudonymize.js";
import { resolveEntities } from "./resolver.js";
import { RulesDetector } from "./rules-detector.js";

async function run(text: string) {
  const spans = await new RulesDetector().detect(text);
  const { entities, mentions } = resolveEntities(text, spans, []);
  return pseudonymize(text, mentions, entities);
}

describe("pseudonymize", () => {
  it("replaces every mention, keeping the rest of the text", async () => {
    const r = await run("Zenith Bank Plc (the Employer) sacked Adebayo Ogunleye. Adebayo's pay: ₦850,000.");
    expect(r.anonymizedText).toBe("EMPLOYER_1 (the Employer) sacked PERSON_1. PERSON_1's pay: AMOUNT_NGN_MID_1.");
  });

  it("returns the placeholder mapping and spans", async () => {
    const r = await run("Email ngozi@okafor.ng");
    expect(Object.keys(r.mapping)).toEqual(["EMAIL_1"]);
    expect(r.mapping.EMAIL_1?.canonical).toBe("ngozi@okafor.ng");
    expect(r.spans).toHaveLength(1);
  });

  it("throws on a mention without an entity", () => {
    const span = { start: 0, end: 1, text: "x", type: "PERSON" as const, confidence: 1, source: "rules" as const };
    expect(() => pseudonymize("x", [{ span, entityId: "missing" }], [])).toThrow(/No entity/);
  });
});
