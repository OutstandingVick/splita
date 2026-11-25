import { describe, expect, it } from "vitest";
import { hybridSummary, hybridSummaryText, nanoOnly } from "./hybrid-summary";

describe("hybridSummary", () => {
  it("describes a rules+nano run reasoned in the cloud", () => {
    expect(hybridSummaryText(hybridSummary("rules+nano", "in_cloud", "gemini-3.5-flash"))).toBe(
      "On-device (Gemini Nano + rules): detect · pseudonymize · restore — Cloud (Gemini, gemini-3.5-flash): reasoning only",
    );
  });

  it("follows the reported inference source and detection mode", () => {
    const [d, r] = hybridSummary("rules-only", "on_device", "gemini-nano");
    expect(d?.label).toBe("On-device (rules)");
    expect(r).toMatchObject({ where: "device", stages: "reasoning" });
  });
});

describe("nanoOnly", () => {
  it("counts identities that only Nano found", () => {
    const ps = [
      { placeholder: "PERSON_3", sources: ["nano"] },
      { placeholder: "ORG_2", sources: ["nano"] },
      { placeholder: "EMPLOYEE_1", sources: ["rules"] },
      { placeholder: "PERSON_1", sources: ["nano", "rules"] },
    ];
    expect(nanoOnly(ps).map((p) => p.placeholder)).toEqual(["PERSON_3", "ORG_2"]);
  });
});
