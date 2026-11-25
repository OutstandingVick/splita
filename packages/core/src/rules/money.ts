import { matchAll, type Rule } from "./match.js";

const NUM = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?`;
const MULT = String.raw`(?: ?(?:k|K|m|M|bn|BN|million|billion|thousand))?`;

const NGN_PREFIX = new RegExp(String.raw`(?:₦|NGN ?|(?<![A-Za-z])N(?= ?\d)) ?${NUM}${MULT}(?![A-Za-z0-9])`, "g");
const NGN_SUFFIX = new RegExp(String.raw`(?<![\d.,])${NUM}${MULT} ?(?:naira|Naira|NAIRA)(?![A-Za-z])`, "g");

const USD_PREFIX = new RegExp(String.raw`(?:US\$|\$|USD ?) ?${NUM}${MULT}(?![A-Za-z0-9])`, "g");
const USD_SUFFIX = new RegExp(String.raw`(?<![\d.,])${NUM}${MULT} ?(?:dollars|USD)(?![A-Za-z])`, "g");

/** Naira amounts: ₦400,000 · ₦400k · N2.5m · NGN 5000 · 400,000 naira. */
export const detectNairaAmounts: Rule = (text) => [
  ...matchAll(text, NGN_PREFIX, "MONEY", 0.95),
  ...matchAll(text, NGN_SUFFIX, "MONEY", 0.95),
];

/** US dollar amounts: $1,200 · US$5k · USD 250,000 · 300 dollars. */
export const detectDollarAmounts: Rule = (text) => [
  ...matchAll(text, USD_PREFIX, "MONEY", 0.95),
  ...matchAll(text, USD_SUFFIX, "MONEY", 0.95),
];
