import { describe, expect, it } from "vitest";
import { detectPhones } from "./phone.js";

const texts = (t: string) => detectPhones(t).map((s) => s.text);

describe("detectPhones", () => {
  it.each([
    "+234 803 123 4567",
    "+2348051234567",
    "+234-706-123-4567",
    "08031234567",
    "0809 876 5432",
    "0701-234-5678",
  ])("matches %s", (n) => {
    expect(texts(`call ${n} today`)).toEqual([n]);
  });

  it("rejects non-Nigerian or wrong-length numbers", () => {
    expect(texts("ref 0603123456 and 080312345678 and 12345")).toEqual([]);
  });
});
