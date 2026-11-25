import { matchAll, type Rule } from "./match.js";

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

export const detectEmails: Rule = (text) => matchAll(text, EMAIL, "EMAIL", 0.99);
