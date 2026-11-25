import type { Mapping } from "./types.js";

export class IdentityLeakError extends Error {
  override name = "IdentityLeakError";
  constructor(readonly placeholder: string) {
    // Never include the leaked value itself in the message.
    super(`An alias of ${placeholder} is still present in the anonymized text`);
  }
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Fail-closed guard: throws if any known alias survives pseudonymization (case-insensitive). */
export function assertNoLeak(anonymizedText: string, mapping: Mapping): void {
  for (const [placeholder, entity] of Object.entries(mapping)) {
    for (const alias of entity.aliases) {
      const re = new RegExp(`(?<![A-Za-z0-9])${escape(alias)}(?![A-Za-z0-9])`, "i");
      if (re.test(anonymizedText)) throw new IdentityLeakError(placeholder);
    }
  }
}
