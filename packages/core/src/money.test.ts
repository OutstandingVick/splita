import { describe, expect, it } from "vitest";
import { moneyPlaceholderPrefix, ngnBucket, parseMoney } from "./money.js";

describe("parseMoney", () => {
  it.each([
    ["₦400,000", 400_000],
    ["₦400k", 400_000],
    ["N2.5m", 2_500_000],
    ["N12.5m", 12_500_000],
    ["400,000 naira", 400_000],
    ["3 million naira", 3_000_000],
    ["NGN 5000", 5_000],
  ])("%s → ₦%i", (t, amount) => {
    expect(parseMoney(t)).toEqual({ currency: "NGN", amount });
  });

  it("detects dollars", () => {
    expect(parseMoney("USD 250,000")).toEqual({ currency: "USD", amount: 250_000 });
    expect(parseMoney("$1.2k")).toEqual({ currency: "USD", amount: 1_200 });
  });
});

describe("ngnBucket", () => {
  it("buckets at ₦100k and ₦5m", () => {
    expect(ngnBucket(99_999)).toBe("SMALL");
    expect(ngnBucket(100_000)).toBe("MID");
    expect(ngnBucket(4_999_999)).toBe("MID");
    expect(ngnBucket(5_000_000)).toBe("LARGE");
  });
});

describe("moneyPlaceholderPrefix", () => {
  it.each([
    ["₦75k", "AMOUNT_NGN_SMALL"],
    ["₦850,000", "AMOUNT_NGN_MID"],
    ["N12.5m", "AMOUNT_NGN_LARGE"],
    ["USD 250,000", "AMOUNT_USD"],
  ])("%s → %s", (t, p) => {
    expect(moneyPlaceholderPrefix(t)).toBe(p);
  });
});
