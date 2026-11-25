import { findPublicTerms, ROLES, type Span } from "@splita/core";

/**
 * Cheap pre-check for the Nano pass: capitalized word runs that could be a PERSON or ORG name.
 * If rules already cover every candidate in a chunk, Nano has nothing to add there and is skipped.
 */

const STOPWORDS = new Set(
  [
    // sentence starters, pronouns, function words
    "a", "an", "and", "as", "at", "but", "by", "for", "from", "he", "her", "his", "i", "if", "in", "it", "its", "my", "of",
    "on", "or", "our", "she", "that", "the", "their", "these", "they", "this", "those", "to", "we", "you", "your", "re",
    "please", "kindly", "dear", "yours", "faithfully", "sincerely", "regards", "attention", "subject", "note", "pay", "per",
    // titles (the name after them is what matters)
    "mr", "mrs", "ms", "miss", "dr", "barr", "chief", "prof", "engr", "alhaji", "alhaja", "hon", "sir", "madam", "esq",
    // dates
    "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    // generic legal/business nouns
    ...ROLES, "agreement", "contract", "court", "company", "bank", "director", "section", "clause", "schedule", "party",
    "parties", "notice", "letter", "street", "road", "avenue", "close", "state", "island", "naira", "dollars",
  ],
);

const RUN = /[A-Z][a-z'’]+(?:\s+[A-Z][a-z'’]+)*/g;

const bare = (w: string) => w.toLowerCase().replace(/['’]s?$/, "");

/** Capitalized word runs, minus stopwords and public terms ("National Industrial Court"). */
export function nameCandidates(text: string): Array<{ start: number; end: number; text: string }> {
  const publicTerms = findPublicTerms(text);
  const out: Array<{ start: number; end: number; text: string }> = [];
  for (const m of text.matchAll(RUN)) {
    const start = m.index;
    const end = start + m[0].length;
    if (publicTerms.some((t) => t.start <= start && end <= t.end)) continue;
    if (m[0].split(/\s+/).every((w) => STOPWORDS.has(bare(w)))) continue;
    out.push({ start, end, text: m[0] });
  }
  return out;
}

/** Candidates in `text` (offset into the full document) that no known span overlaps. */
export function uncoveredCandidates(text: string, offset: number, known: readonly Span[]): string[] {
  return nameCandidates(text)
    .filter((c) => !known.some((s) => s.start < offset + c.end && offset + c.start < s.end))
    .map((c) => c.text);
}
