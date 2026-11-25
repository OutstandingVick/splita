import type { Span } from "./types.js";

/**
 * Public institutions and legal terms that are never identities and must stay visible to the
 * cloud model: redacting "National Industrial Court" or "Labour Act" only makes answers worse.
 */
export const PUBLIC_TERMS = {
  courts: [
    "Supreme Court",
    "Court of Appeal",
    "Federal High Court",
    "High Court",
    "National Industrial Court",
    "Magistrate Court",
    "Magistrates' Court",
    "Customary Court",
    "Sharia Court of Appeal",
    "Customary Court of Appeal",
    "Investments and Securities Tribunal",
    "Tax Appeal Tribunal",
  ],
  agencies: [
    "CBN",
    "Central Bank of Nigeria",
    "NDPC",
    "Nigeria Data Protection Commission",
    "EFCC",
    "Economic and Financial Crimes Commission",
    "ICPC",
    "FIRS",
    "Federal Inland Revenue Service",
    "LIRS",
    "Lagos State Internal Revenue Service",
    "SEC",
    "Securities and Exchange Commission",
    "CAC",
    "Corporate Affairs Commission",
    "NDIC",
    "NCC",
    "FCCPC",
    "PenCom",
    "National Pension Commission",
    "NSITF",
    "NAFDAC",
    "Nigerian Bar Association",
    "NBA",
  ],
  statutes: [
    "Labour Act",
    "NDPA",
    "Nigeria Data Protection Act",
    "Constitution of the Federal Republic of Nigeria",
    "Companies and Allied Matters Act",
    "CAMA",
    "Pension Reform Act",
    "Employee's Compensation Act",
    "Employees' Compensation Act",
    "Trade Disputes Act",
    "Evidence Act",
    "Personal Income Tax Act",
    "Finance Act",
    "Lagos State Tenancy Law",
    "Tenancy Law",
    "Recovery of Premises Law",
    "Recovery of Premises Act",
  ],
} as const;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ALL_TERMS = Object.values(PUBLIC_TERMS)
  .flat()
  .sort((a, b) => b.length - a.length);

// Whole-word, longest first; statutes may carry a year ("NDPA 2023", "Labour Act, 2004").
const PUBLIC_TERM_RE = new RegExp(`(?<![A-Za-z0-9])(?:${ALL_TERMS.map(escape).join("|")})(?:,?\\s+(?:19|20)\\d{2})?(?![A-Za-z0-9])`, "g");

/** Character ranges of every public term in `text`. */
export function findPublicTerms(text: string): Array<{ start: number; end: number; text: string }> {
  return [...text.matchAll(PUBLIC_TERM_RE)].map((m) => ({ start: m.index, end: m.index + m[0].length, text: m[0] }));
}

export function isPublicTerm(value: string): boolean {
  const v = value.trim();
  return findPublicTerms(v).some((t) => t.start === 0 && t.end === v.length);
}

/**
 * Drops spans that are a public term or sit entirely inside one ("Lagos State" inside
 * "Lagos State Tenancy Law 2011"). Spans that merely touch a term are kept: when in doubt, redact.
 */
export function dropPublicTerms(spans: readonly Span[], text: string): Span[] {
  const terms = findPublicTerms(text);
  return spans.filter((s) => !isPublicTerm(s.text) && !terms.some((t) => t.start <= s.start && s.end <= t.end));
}
