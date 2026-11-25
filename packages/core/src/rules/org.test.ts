import { describe, expect, it } from "vitest";
import { detectOrgs } from "./org.js";

const texts = (t: string) => detectOrgs(t).map((s) => s.text);

describe("detectOrgs", () => {
  it.each([
    ["employed by Zenith Bank Plc (the", "Zenith Bank Plc"],
    ["made to Eze Properties Limited, account", "Eze Properties Limited"],
    ["with Access Bank.", "Access Bank"],
    ["For: Okonkwo & Co", "Okonkwo & Co"],
    ["and Delta Creek Analytics Limited, represented", "Delta Creek Analytics Limited"],
    ["Acme Inc and", "Acme Inc"],
  ])("%s", (t, want) => {
    expect(texts(t)).toEqual([want]);
  });

  it("strips leading stopwords", () => {
    expect(texts("The Ikenga Fintech Ltd board")).toEqual(["Ikenga Fintech Ltd"]);
  });

  it("strips sentence-initial imperatives", () => {
    expect(texts("Pay Eze Properties Limited now. Kindly Sue Acme Inc.")).toEqual(["Eze Properties Limited", "Acme Inc"]);
  });

  it("drops matches that are only a stopword plus suffix", () => {
    expect(texts("The Bank shall pay")).toEqual([]);
  });

  it("ignores lowercase mentions", () => {
    expect(texts("the bank paid")).toEqual([]);
  });
});
