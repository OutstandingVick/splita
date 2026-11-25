import { describe, expect, it } from "vitest";
import { detectNairaAmounts } from "./money.js";

const texts = (t: string) => detectNairaAmounts(t).map((s) => s.text);

describe("detectNairaAmounts", () => {
  it.each(["₦400,000", "₦400k", "N2.5m", "NGN 5000", "₦1.2m", "400,000 naira", "3 million naira", "₦50,000,000"])(
    "matches %s",
    (a) => {
      expect(texts(`owed ${a} now`)).toEqual([a]);
    },
  );

  it("does not swallow following words or punctuation", () => {
    expect(texts("₦400 monthly, ₦60,000.")).toEqual(["₦400", "₦60,000"]);
  });

  it("ignores N inside words and plain numbers", () => {
    expect(texts("NIN2024 and 5000 units")).toEqual([]);
  });
});
