import { matchAll, type Rule } from "./match.js";

export const NAME_TOKEN = "[A-Z][a-z]+(?:-[A-Z][a-z]+)?";
export const TITLES = "(?:Mr|Mrs|Ms|Miss|Dr|Barr|Chief|Engr|Prof|Alhaji|Alhaja|Pastor)";

/** Leading honorific, e.g. "Mr. " or "Chief ". */
export const TITLE_PREFIX = new RegExp(`^${TITLES}\\.?\\s+`);

const TITLED = new RegExp(`\\b${TITLES}\\.?[ ]+${NAME_TOKEN}(?:[ ]+${NAME_TOKEN}){0,2}`, "g");

/** Title followed by 1-3 capitalized words: "Mr. Adebayo Ogunleye", "Chief Eze". */
export const detectTitledPersons: Rule = (text) => matchAll(text, TITLED, "PERSON", 0.9);
