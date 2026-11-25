import { RulesDetector } from "@splita/core";
import { describe, expect, it } from "vitest";
import { nameCandidates, uncoveredCandidates } from "./name-candidates.js";

const LETTER = `Dear Barr. Chukwuemeka Nwosu,

I act for Mr. Adebayo Ogunleye (the Employee), employed by Zenith Bank Plc (the Employer) from March 2019.
On 3 October 2026, Zenith Bank Plc terminated Adebayo's appointment. His benefit of N12.5m remains unpaid.
He lives at 12 Adeola Odeku Street, Victoria Island.
Please advise on a claim at the National Industrial Court in Lagos under the Labour Act.

Yours faithfully,
Mrs. Funmilayo Bello`;

describe("nameCandidates", () => {
  it("ignores sentence starters, titles, months, roles and public terms", () => {
    const texts = nameCandidates(LETTER).map((c) => c.text);
    expect(texts).not.toContain("National Industrial Court");
    expect(texts).not.toContain("Labour Act");
    for (const w of ["Dear", "On", "His", "Please", "Yours", "March", "October", "Employee", "Employer"]) expect(texts).not.toContain(w);
    expect(texts).toEqual(expect.arrayContaining(["Chukwuemeka Nwosu", "Adebayo Ogunleye", "Zenith Bank Plc", "Lagos"]));
  });
});

describe("uncoveredCandidates", () => {
  it("is empty when rules cover every candidate, so the Nano pass can be skipped", async () => {
    const known = await new RulesDetector().detect(LETTER);
    expect(uncoveredCandidates(LETTER, 0, known)).toEqual([]);
  });

  it("reports a name rules missed", async () => {
    const text = `${LETTER}\nCc: Tamunotonye Ibiwari`;
    const known = await new RulesDetector().detect(text);
    expect(uncoveredCandidates(text, 0, known)).toContain("Tamunotonye Ibiwari");
  });
});
