import { describe, expect, it } from "vitest";
import { isSamePerson, personTokens } from "./names.js";

describe("personTokens", () => {
  it("drops titles and lowercases", () => {
    expect(personTokens("Mr. Adebayo Ogunleye")).toEqual(["adebayo", "ogunleye"]);
    expect(personTokens("Chief Eze")).toEqual(["eze"]);
  });
});

describe("isSamePerson", () => {
  it.each([
    ["Mr. Adebayo Ogunleye", "Adebayo"],
    ["Mr. Adebayo Ogunleye", "Mr. Ogunleye"],
    ["Chief Emeka Eze", "Chief Eze"],
    ["Halima Abubakar", "Dr. Halima Abubakar"],
  ])("%s ≡ %s", (a, b) => {
    expect(isSamePerson(a, b)).toBe(true);
  });

  it("does not merge different people sharing a surname", () => {
    expect(isSamePerson("Aisha Bello", "Mrs. Funmilayo Bello")).toBe(false);
  });
});
