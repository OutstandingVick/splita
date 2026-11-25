import { matchAll, type Rule } from "./match.js";

const MONTH =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const ORD = "(?:st|nd|rd|th)?";
const DATE = String.raw`(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}${ORD} ${MONTH},? \d{4}|${MONTH} \d{1,2}${ORD},? \d{4})`;

/** A date only counts as a date of birth when introduced by birth context. */
const DOB = new RegExp(String.raw`(?:born on|born|date of birth|DOB|D\.O\.B\.?)\s*[:-]?\s*(?:the\s+)?${DATE}`, "gi");

export const detectDatesOfBirth: Rule = (text) => matchAll(text, DOB, "DATE_OF_BIRTH", 0.9, 1);
