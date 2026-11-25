import { describe, expect, it } from "vitest";
import { makeSpan, matchAll } from "./match.js";

describe("matchAll", () => {
  it("returns spans for every match", () => {
    expect(matchAll("a1 b22", /\d+/, "ACCOUNT_NUMBER", 0.5)).toEqual([
      makeSpan("a1 b22", 1, 2, "ACCOUNT_NUMBER", 0.5),
      makeSpan("a1 b22", 4, 6, "ACCOUNT_NUMBER", 0.5),
    ]);
  });

  it("can span only a capture group", () => {
    const [s] = matchAll("dob: 01/02/1990", /dob: (\S+)/, "DATE_OF_BIRTH", 0.9, 1);
    expect(s).toMatchObject({ start: 5, end: 15, text: "01/02/1990", source: "rules" });
  });
});
