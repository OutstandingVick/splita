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

  it("leaves unknown placeholders untouched", () => {
    expect(restore("EMPLOYER_2 and PERSON_9 remain.", mapping)).toBe("EMPLOYER_2 and PERSON_9 remain.");
  });

  it("ignores inherited object keys", () => {
    expect(restore("CONSTRUCTOR_1", mapping)).toBe("CONSTRUCTOR_1");
  });

  it("does not match placeholders inside longer tokens", () => {
    expect(restore("XEMPLOYER_1 EMPLOYER_10", mapping)).toBe("XEMPLOYER_1 EMPLOYER_10");
  });
});
