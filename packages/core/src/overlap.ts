import type { Span } from "./types.js";

const overlaps = (a: Span, b: Span): boolean => a.start < b.end && b.start < a.end;

const sourceRank = (s: Span): number => (s.source === "rules" ? 0 : 1);

/** Keeps non-overlapping spans: longest wins, then rules over nano, then confidence, then earlier. */
export function resolveOverlaps(spans: readonly Span[]): Span[] {
  const ranked = [...spans].sort(
    (a, b) =>
      b.end - b.start - (a.end - a.start) ||
      sourceRank(a) - sourceRank(b) ||
      b.confidence - a.confidence ||
      a.start - b.start,
  );
  const kept: Span[] = [];
  for (const s of ranked) {
    if (!kept.some((k) => overlaps(k, s))) kept.push(s);
  }
  return kept.sort((a, b) => a.start - b.start);
}
