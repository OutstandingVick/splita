import { describe, expect, it } from "vitest";
import { detectAccountNumbers } from "./nuban.js";

const texts = (t: string) => detectAccountNumbers(t).map((s) => s.text);

describe("detectAccountNumbers", () => {
  it("finds 10-digit account numbers", () => {
    expect(texts("Pay into 0123456789 (GTB).")).toEqual(["0123456789"]);
  });

  it("ignores 11-digit phones and +234 numbers", () => {
    expect(texts("08031234567 / +2348051234567 / 123456789")).toEqual([]);
  });
});
