import type { Span } from "../types.js";
import { makeSpan, type Rule } from "./match.js";

const TOK = "[A-Z][A-Za-z&'-]*";
const SUFFIX = "(?:Ltd|Limited|Plc|PLC|Bank|Inc|LLC|& Co)";
const ORG = new RegExp(`\\b(?:${TOK}[ ]+){0,4}${TOK}[ ]+${SUFFIX}(?![A-Za-z])`, "g");
const ORG_EXACT = new RegExp(`^(?:${TOK}[ ]+){1,5}${SUFFIX}$`);
const LEADING = new RegExp(`^(${TOK})[ ]+`);

/** Capitalized sentence starters (articles, prepositions, imperatives) that never begin an org name. */
const STOP = new Set([
  "The", "This", "That", "A", "An", "And", "Between", "Dear", "For", "To", "Of", "With", "From", "By",
  "Re", "RE", "At", "In", "On", "Via", "Per", "Attn", "Attention", "Signed", "Notices", "Payment",
  "Pay", "Please", "Kindly", "Send", "Contact", "Call", "Email", "Ask", "Tell", "Sue",
]);

/** Capitalized words ending in Ltd, Limited, Plc, Bank, Inc, LLC or "& Co". */
export const detectOrgs: Rule = (text) => {
  const out: Span[] = [];
  for (const m of text.matchAll(ORG)) {
    if (m.index === undefined) continue;
    let start = m.index;
    let body = m[0];
    let lead = LEADING.exec(body);
    while (lead?.[1] && STOP.has(lead[1])) {
      start += lead[0].length;
      body = body.slice(lead[0].length);
      lead = LEADING.exec(body);
    }
    if (ORG_EXACT.test(body)) out.push(makeSpan(text, start, start + body.length, "ORG", 0.85));
  }
  return out;
};
