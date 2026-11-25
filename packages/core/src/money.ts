export type Currency = "NGN" | "USD";

export interface MoneyValue {
  currency: Currency;
  amount: number;
}

const MULTIPLIERS: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, bn: 1e9, billion: 1e9 };

/** Parses a detected money span ("₦400k", "N2.5m", "400,000 naira", "USD 250,000"). */
export function parseMoney(text: string): MoneyValue | undefined {
  const m = /(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\s?(billion|million|thousand|bn|k|m)?/i.exec(text);
  if (!m?.[1]) return undefined;
  const base = Number(`${m[1].replace(/,/g, "")}${m[2] ? `.${m[2]}` : ""}`);
  const mult = MULTIPLIERS[(m[3] ?? "").toLowerCase()] ?? 1;
  const currency: Currency = /\$|USD|dollar/i.test(text) ? "USD" : "NGN";
  return { currency, amount: Math.round(base * mult) };
}

export type NgnBucket = "SMALL" | "MID" | "LARGE";

/** SMALL < ₦100k ≤ MID < ₦5m ≤ LARGE. */
export function ngnBucket(amount: number): NgnBucket {
  if (amount < 100_000) return "SMALL";
  if (amount < 5_000_000) return "MID";
  return "LARGE";
}

/** Placeholder prefix that keeps magnitude meaningful for the reasoner. */
export function moneyPlaceholderPrefix(text: string): string {
  const v = parseMoney(text);
  if (!v) return "AMOUNT";
  return v.currency === "NGN" ? `AMOUNT_NGN_${ngnBucket(v.amount)}` : "AMOUNT_USD";
}
