import { describe, expect, it } from "vitest";
import { detectDictionaryPersons, detectTitledPersons, TITLE_PREFIX } from "./person.js";

const texts = (t: string) => detectTitledPersons(t).map((s) => s.text);

describe("detectTitledPersons", () => {
  it.each([
    ["I act for Mr. Adebayo Ogunleye (the", "Mr. Adebayo Ogunleye"],
    ["Mrs Okafor may", "Mrs Okafor"],
    ["Chief Emeka Eze has", "Chief Emeka Eze"],
    ["Dear Barr. Chukwuemeka Nwosu,", "Barr. Chukwuemeka Nwosu"],
    ["Signed: Dr. Halima Abubakar, Director", "Dr. Halima Abubakar"],
  ])("%s", (t, want) => {
    expect(texts(t)).toEqual([want]);
  });

  it("does not run across line breaks", () => {
    expect(texts("Barr. Aisha Bello\nFor: Okonkwo")).toEqual(["Barr. Aisha Bello"]);
  });

  it("strips titles with TITLE_PREFIX", () => {
    expect("Mrs. Ngozi Okafor".replace(TITLE_PREFIX, "")).toBe("Ngozi Okafor");
  });
});

describe("detectDictionaryPersons", () => {
  const dict = (t: string) => detectDictionaryPersons(t).map((s) => s.text);

  it("finds runs of known names", () => {
    expect(dict("1. Halima Abubakar shall disclose")).toEqual(["Halima Abubakar"]);
  });

  it("splits at unknown capitalized words", () => {
    expect(dict("Dear Ngozi Okafor Lagos Office and Emeka")).toEqual(["Ngozi Okafor", "Emeka"]);
  });

  it("handles possessives", () => {
    expect(dict("terminated Adebayo's appointment")).toEqual(["Adebayo"]);
  });

  it("ignores lowercase occurrences", () => {
    expect(dict("email adebayo.ogunleye@gmail.com")).toEqual([]);
  });
});
