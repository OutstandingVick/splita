import type { Span } from "../types.js";
import { makeSpan, matchAll, type Rule } from "./match.js";
import { isKnownName } from "./names.js";

export const NAME_TOKEN = "[A-Z][a-z]+(?:-[A-Z][a-z]+)?";
export const TITLES = "(?:Mr|Mrs|Ms|Miss|Dr|Barr|Chief|Engr|Prof|Alhaji|Alhaja|Pastor)";

/** Leading honorific, e.g. "Mr. " or "Chief ". */
export const TITLE_PREFIX = new RegExp(`^${TITLES}\\.?\\s+`);

const TITLED = new RegExp(`\\b${TITLES}\\.?[ ]+${NAME_TOKEN}(?:[ ]+${NAME_TOKEN}){0,2}`, "g");

/** Title followed by 1-3 capitalized words: "Mr. Adebayo Ogunleye", "Chief Eze". */
export const detectTitledPersons: Rule = (text) => matchAll(text, TITLED, "PERSON", 0.9);

const CAP_RUN = new RegExp(`\\b${NAME_TOKEN}(?:[ ]+${NAME_TOKEN})*`, "g");
const TOKEN = new RegExp(NAME_TOKEN, "g");

/** Runs of consecutive capitalized words that are all known Nigerian names. */
export const detectDictionaryPersons: Rule = (text) => {
  const out: Span[] = [];
  for (const run of text.matchAll(CAP_RUN)) {
    if (run.index === undefined) continue;
    let start = -1;
    let end = -1;
    for (const tok of run[0].matchAll(TOKEN)) {
      if (tok.index === undefined) continue;
      const s = run.index + tok.index;
      if (isKnownName(tok[0])) {
        if (start < 0) start = s;
        end = s + tok[0].length;
      } else if (start >= 0) {
        out.push(makeSpan(text, start, end, "PERSON", 0.75));
        start = -1;
      }
    }
    if (start >= 0) out.push(makeSpan(text, start, end, "PERSON", 0.75));
  }
  return out;
};
