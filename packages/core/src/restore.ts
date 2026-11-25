import type { Entity, Mapping } from "./types.js";

/** Placeholder plus optional possessive ("EMPLOYER_1's") or plural ("EMPLOYEE_1s") suffix. */
const PLACEHOLDER = /\b([A-Z]+(?:_[A-Z]+)*_\d+)(['’]s|s)?(?![A-Za-z0-9_])/g;

/** Requests to de-anonymize. Sentences matching this are returned verbatim. */
const DEANONYMIZE_REQUEST =
  /\b(?:real|actual|true|original|full|legal|unmasked)\s+(?:name|names|identity|identities|value|values)\b|\b(?:reveal|unmask|de-?anonymi[sz]e|re-?identify)\b/i;

/** Splits into sentences/lines, keeping delimiters so join("") is lossless. */
const SENTENCE = /[^.!?\n]+(?:[.!?]+|\n+|$)|[.!?\n]+/g;

export function mappingFromEntities(entities: readonly Entity[]): Mapping {
  const m: Mapping = {};
  for (const e of entities) m[e.placeholder] = e;
  return m;
}

/**
 * Puts real values back into the reasoner's answer. Only placeholders present in this
 * workspace's mapping are replaced; anything else is left exactly as written. Sentences that
 * ask for real identities (prompt injection from the cloud side) are never restored.
 */
export function restore(answer: string, mapping: Mapping): string {
  return (answer.match(SENTENCE) ?? [])
    .map((sentence) => (DEANONYMIZE_REQUEST.test(sentence) ? sentence : restoreSentence(sentence, mapping)))
    .join("");
}

function restoreSentence(sentence: string, mapping: Mapping): string {
  return sentence.replace(PLACEHOLDER, (match: string, ph: string, suffix: string | undefined) => {
    const e = Object.hasOwn(mapping, ph) ? mapping[ph] : undefined;
    return e ? e.canonical + (suffix ?? "") : match;
  });
}
