import type { EntityType, Span } from "../types.js";

/** A deterministic detection rule. */
export type Rule = (text: string) => Span[];

export function makeSpan(text: string, start: number, end: number, type: EntityType, confidence: number): Span {
  return { start, end, text: text.slice(start, end), type, confidence, source: "rules" };
}

/** Every match of `re` (or of capture `group`) as a rules Span. */
export function matchAll(text: string, re: RegExp, type: EntityType, confidence: number, group = 0): Span[] {
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  const out: Span[] = [];
  for (const m of text.matchAll(new RegExp(re.source, flags))) {
    const part = m[group];
    if (part === undefined || part === "" || m.index === undefined) continue;
    const start = m.index + (group === 0 ? 0 : m[0].indexOf(part));
    out.push(makeSpan(text, start, start + part.length, type, confidence));
  }
  return out;
}
