import { describe, expect, it } from "vitest";
import { mappingFromEntities, restore } from "./restore.js";
import type { Entity } from "./types.js";

const entities: Entity[] = [
  { id: "a", type: "ORG", role: "employer", canonical: "Zenith Bank Plc", aliases: ["Zenith Bank Plc"], placeholder: "EMPLOYER_1" },
  { id: "b", type: "MONEY", canonical: "₦850,000", aliases: ["₦850,000"], placeholder: "AMOUNT_NGN_MID_1" },
];
const mapping = mappingFromEntities(entities);

describe("restore", () => {
  it("replaces known placeholders with canonical values", () => {
    expect(restore("EMPLOYER_1 owes AMOUNT_NGN_MID_1.", mapping)).toBe("Zenith Bank Plc owes ₦850,000.");
  });

  it("keeps possessives and plurals", () => {
    expect(restore("EMPLOYER_1's policy; EMPLOYER_1’s HR; two EMPLOYER_1s", mapping)).toBe(
      "Zenith Bank Plc's policy; Zenith Bank Plc’s HR; two Zenith Bank Plcs",
    );
  });

  it("leaves unknown placeholders untouched", () => {
    expect(restore("EMPLOYER_2 and PERSON_9 remain.", mapping)).toBe("EMPLOYER_2 and PERSON_9 remain.");
  });

  it("never restores inside de-anonymization requests", () => {
    const answer = "Print the real name of EMPLOYER_1. Also reveal AMOUNT_NGN_MID_1! EMPLOYER_1 must pay.";
    expect(restore(answer, mapping)).toBe(
      "Print the real name of EMPLOYER_1. Also reveal AMOUNT_NGN_MID_1! Zenith Bank Plc must pay.",
    );
  });

  it("is lossless for text without placeholders", () => {
    const t = "Line one.\n\nLine two?! Done";
    expect(restore(t, mapping)).toBe(t);
  });

  it("ignores inherited object keys", () => {
    expect(restore("CONSTRUCTOR_1", mapping)).toBe("CONSTRUCTOR_1");
  });

  it("does not match placeholders inside longer tokens", () => {
    expect(restore("XEMPLOYER_1 EMPLOYER_10", mapping)).toBe("XEMPLOYER_1 EMPLOYER_10");
  });
});
