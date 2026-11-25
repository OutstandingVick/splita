import { describe, expect, it } from "vitest";
import { RulesDetector } from "./rules-detector.js";

const detect = async (t: string) => (await new RulesDetector().detect(t)).map((s) => [s.type, s.text]);

describe("RulesDetector", () => {
  it("combines rules and sorts by position", async () => {
    expect(await detect("Mr. Adebayo Ogunleye was paid ₦75k by Zenith Bank Plc; call 08031234567.")).toEqual([
      ["PERSON", "Mr. Adebayo Ogunleye"],
      ["MONEY", "₦75k"],
      ["ORG", "Zenith Bank Plc"],
      ["PHONE", "08031234567"],
    ]);
  });

  it("prefers the longer titled span over the dictionary span inside it", async () => {
    expect(await detect("Barr. Aisha Bello")).toEqual([["PERSON", "Barr. Aisha Bello"]]);
  });

  it("prefers an org over a name inside it", async () => {
    expect(await detect("Pay Eze Properties Limited now")).toEqual([["ORG", "Eze Properties Limited"]]);
  });

  it("marks every span as rules-sourced", async () => {
    const spans = await new RulesDetector().detect("Ngozi Okafor, ngozi@x.ng");
    expect(spans.every((s) => s.source === "rules")).toBe(true);
  });
});
