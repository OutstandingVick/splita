import type { Entity, Mapping } from "./types.js";

/** Placeholder plus optional possessive ("EMPLOYER_1's") or plural ("EMPLOYEE_1s") suffix. */
const PLACEHOLDER = /\b([A-Z]+(?:_[A-Z]+)*_\d+)(['’]s|s)?(?![A-Za-z0-9_])/g;

export function mappingFromEntities(entities: readonly Entity[]): Mapping {
  const m: Mapping = {};
  for (const e of entities) m[e.placeholder] = e;
  return m;
}

/**
 * Puts real values back into the reasoner's answer. Only placeholders present in this
 * workspace's mapping are replaced; anything else is left exactly as written.
 */
export function restore(answer: string, mapping: Mapping): string {
  return answer.replace(PLACEHOLDER, (match: string, ph: string, suffix: string | undefined) => {
    const e = Object.hasOwn(mapping, ph) ? mapping[ph] : undefined;
    return e ? e.canonical + (suffix ?? "") : match;
  });
}
