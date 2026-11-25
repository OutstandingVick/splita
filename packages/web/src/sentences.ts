import type { Chunk } from "./nano-parse.js";

/** Abbreviations whose trailing period does not end a sentence ("Mr. Ogunleye", "Barr. Nwosu"). */
const ABBREVIATIONS = /\b(?:Mr|Mrs|Ms|Dr|Barr|Prof|Engr|Hon|Rev|Sen|Gen|Col|Capt|Messrs|No|St|Co|Ltd|Inc|v|vs|e\.g|i\.e|etc)\.$/i;

/**
 * Splits text into sentences (and lines) with their offsets. Line breaks always split;
 * ". ", "! ", "? " split unless the period closes a title or common abbreviation.
 */
export function splitSentences(text: string): Chunk[] {
  const out: Chunk[] = [];
  let start = 0;
  const push = (end: number) => {
    const raw = text.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    const body = raw.trim();
    if (body) out.push({ text: body, offset: start + lead });
  };
  for (const m of text.matchAll(/[.!?](?=\s)|\n/g)) {
    const end = m.index + 1;
    if (m[0] !== "\n" && ABBREVIATIONS.test(text.slice(start, end))) continue;
    push(end);
    start = end;
  }
  push(text.length);
  return out;
}

/** Groups sentences into batches of at most ~maxChars of prompt text (one prompt each). */
export function batchSentences(sentences: readonly Chunk[], maxChars: number): Chunk[][] {
  const batches: Chunk[][] = [];
  let size = 0;
  for (const s of sentences) {
    const last = batches.at(-1);
    if (last && size + s.text.length + 1 <= maxChars) {
      last.push(s);
      size += s.text.length + 1;
    } else {
      batches.push([s]);
      size = s.text.length;
    }
  }
  return batches;
}
