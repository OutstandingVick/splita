import { TITLE_PREFIX } from "./rules/person.js";

/** Lowercased name tokens of a person mention, without honorifics. */
export function personTokens(mention: string): string[] {
  return mention
    .trim()
    .replace(TITLE_PREFIX, "")
    .split(/\s+/)
    .map((t) => t.replace(/['’]s$/, "").toLowerCase())
    .filter((t) => t.length > 1);
}

const isSubset = (a: readonly string[], b: readonly string[]): boolean => a.every((t) => b.includes(t));

/**
 * Two person mentions refer to the same person when one's name tokens are a subset of the
 * other's: "Mr. Ogunleye" ⊂ "Adebayo Ogunleye". Shared surnames alone ("Aisha Bello" vs
 * "Funmilayo Bello") are not enough.
 */
export function isSamePerson(a: string, b: string): boolean {
  const ta = personTokens(a);
  const tb = personTokens(b);
  if (ta.length === 0 || tb.length === 0) return false;
  return isSubset(ta, tb) || isSubset(tb, ta);
}
