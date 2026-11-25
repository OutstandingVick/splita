import { describe, expect, it } from "vitest";
import { detectDollarAmounts, detectNairaAmounts } from "./money.js";

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

describe("detectDollarAmounts", () => {
  const usd = (t: string) => detectDollarAmounts(t).map((s) => s.text);

  it.each(["$1,200", "US$5k", "USD 250,000", "300 dollars", "$2.5m"])("matches %s", (a) => {
    expect(usd(`valued at ${a} total`)).toEqual([a]);
  });

  it("ignores naira", () => {
    expect(usd("₦400,000")).toEqual([]);
  });
});
