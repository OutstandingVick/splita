import type { Mention } from "./resolver.js";
import type { Entity, Mapping, PseudonymizeResult } from "./types.js";

/** Replaces each mention with its entity's placeholder. Throws if a mention has no entity. */
export function pseudonymize(text: string, mentions: readonly Mention[], entities: readonly Entity[]): PseudonymizeResult {
  const byId = new Map(entities.map((e) => [e.id, e]));
  const mapping: Mapping = {};
  let out = text;
  for (const m of [...mentions].sort((a, b) => b.span.start - a.span.start)) {
    const e = byId.get(m.entityId);
    if (!e) throw new Error(`No entity for mention "${m.span.type}" at ${m.span.start}`);
    out = out.slice(0, m.span.start) + e.placeholder + out.slice(m.span.end);
    mapping[e.placeholder] = e;
  }
  return {
    anonymizedText: out,
    mapping,
    spans: mentions.map((m) => m.span).sort((a, b) => a.start - b.start),
  };
}
