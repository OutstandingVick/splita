import { matchAll, type Rule } from "./match.js";

/** 10-digit NUBAN bank account numbers, not part of a longer digit run. */
const NUBAN = /(?<![\d+])\d{10}(?!\d)/g;

export const detectAccountNumbers: Rule = (text) => matchAll(text, NUBAN, "ACCOUNT_NUMBER", 0.8);
