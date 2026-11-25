import { resolveOverlaps } from "./overlap.js";
import type { DetectorPort } from "./ports.js";
import { detectDatesOfBirth } from "./rules/dob.js";
import { detectEmails } from "./rules/email.js";
import { detectAddresses, detectPlaces } from "./rules/location.js";
import type { Rule } from "./rules/match.js";
import { detectDollarAmounts, detectNairaAmounts } from "./rules/money.js";
import { detectAccountNumbers } from "./rules/nuban.js";
import { detectOrgs } from "./rules/org.js";
import { detectDictionaryPersons, detectTitledPersons } from "./rules/person.js";
import { detectPhones } from "./rules/phone.js";
import type { Span } from "./types.js";

export const DEFAULT_RULES: readonly Rule[] = [
  detectEmails,
  detectPhones,
  detectAccountNumbers,
  detectNairaAmounts,
  detectDollarAmounts,
  detectDatesOfBirth,
  detectTitledPersons,
  detectDictionaryPersons,
  detectOrgs,
  detectPlaces,
  detectAddresses,
];

/** Deterministic, offline detector. Runs every rule, then resolves overlaps (longest wins). */
export class RulesDetector implements DetectorPort {
  constructor(private readonly rules: readonly Rule[] = DEFAULT_RULES) {}

  async detect(text: string): Promise<Span[]> {
    return resolveOverlaps(this.rules.flatMap((rule) => rule(text)));
  }
}
