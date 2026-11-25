import { matchAll, type Rule } from "./match.js";

/** Nigerian mobile numbers: +234 or 0 prefix, then 7/8/9 + 0/1 network code, 10 digits after 0. */
const PHONE = /(?<![\d+])(?:\+234[ -]?|0)[789][01]\d[ -]?\d{3}[ -]?\d{4}(?!\d)/g;

export const detectPhones: Rule = (text) => matchAll(text, PHONE, "PHONE", 0.95);
