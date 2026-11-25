import { describe, expect, it } from "vitest";
import { nextPlaceholder, placeholderPrefix } from "./placeholders.js";

describe("placeholderPrefix", () => {
  it("uses the role for people and orgs", () => {
    expect(placeholderPrefix({ type: "ORG", role: "employer", canonical: "Zenith Bank Plc" })).toBe("EMPLOYER");
    expect(placeholderPrefix({ type: "PERSON", role: "tenant", canonical: "Ngozi" })).toBe("TENANT");
  });

  it("falls back to the type", () => {
    expect(placeholderPrefix({ type: "PERSON", canonical: "Ngozi" })).toBe("PERSON");
    expect(placeholderPrefix({ type: "ACCOUNT_NUMBER", canonical: "0123456789" })).toBe("ACCOUNT");
    expect(placeholderPrefix({ type: "DATE_OF_BIRTH", canonical: "1/1/90" })).toBe("DOB");
  });

  it("buckets money", () => {
    expect(placeholderPrefix({ type: "MONEY", canonical: "₦75k" })).toBe("AMOUNT_NGN_SMALL");
  });
});

describe("nextPlaceholder", () => {
  it("continues numbering per prefix", () => {
    expect(nextPlaceholder("PERSON", [])).toBe("PERSON_1");
    expect(nextPlaceholder("PERSON", ["PERSON_1", "PERSON_3", "ORG_7"])).toBe("PERSON_4");
  });

  it("does not confuse prefixes that share a stem", () => {
    expect(nextPlaceholder("AMOUNT_NGN", ["AMOUNT_NGN_MID_2"])).toBe("AMOUNT_NGN_1");
  });
});
