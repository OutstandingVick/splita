import { ROLES, type Span } from "@splita/core";

export type NanoEntityType = "PERSON" | "ORG" | "LOCATION";
export interface NanoEntity {
  text: string;
  type: NanoEntityType;
}

const NANO_TYPES: readonly NanoEntityType[] = ["PERSON", "ORG", "LOCATION"];

/** JSON Schema passed to Chrome's Prompt API as `responseConstraint`. */
export const NANO_RESPONSE_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      text: { type: "string" },
      type: { type: "string", enum: NANO_TYPES },
    },
    required: ["text", "type"],
    additionalProperties: false,
  },
} as const;

export interface Chunk {
  text: string;
  offset: number;
}

/** Splits on paragraph boundaries into chunks of at most ~maxChars (hard-splits oversized paragraphs). */
export function chunkText(text: string, maxChars = 2000): Chunk[] {
  const paras: Chunk[] = [];
  const re = /[^\n]+(?:\n[^\n]+)*/g; // paragraphs = runs of non-empty lines
  for (const m of text.matchAll(re)) {
    if (m.index === undefined || m[0].trim() === "") continue;
    for (let i = 0; i < m[0].length; i += maxChars) paras.push({ text: m[0].slice(i, i + maxChars), offset: m.index + i });
  }
  const chunks: Chunk[] = [];
  for (const p of paras) {
    const last = chunks.at(-1);
    if (last && p.offset + p.text.length - last.offset <= maxChars) {
      last.text = text.slice(last.offset, p.offset + p.text.length);
    } else {
      chunks.push({ ...p });
    }
  }
  return chunks;
}

/** Defensive parse of Nano output: tolerates code fences, prose around the array and bad items. */
export function parseNanoEntities(raw: string): NanoEntity[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: NanoEntity[] = [];
  for (const item of data as unknown[]) {
    if (typeof item !== "object" || item === null) continue;
    const { text, type } = item as { text?: unknown; type?: unknown };
    const t = NANO_TYPES.find((x) => x === type);
    if (typeof text === "string" && t) out.push({ text: text.trim(), type: t });
  }
  return out;
}

const PLACEHOLDER = /^[A-Z]+(?:_[A-Z]+)*_\d+$/;
const ROLE_WORDS = new Set<string>([...ROLES, "agreement", "court", "director", "company", "bank", "the client"]);

/** Rejects junk Nano answers: role words, placeholders, lowercase-only, too short/long. */
export function isPlausibleEntity(e: NanoEntity): boolean {
  const t = e.text;
  if (t.length < 2 || t.length > 80) return false;
  if (PLACEHOLDER.test(t) || ROLE_WORDS.has(t.toLowerCase().replace(/^the\s+/, ""))) return false;
  return /^[A-Z0-9]/.test(t);
}

const isWordChar = (c: string | undefined) => c !== undefined && /[A-Za-z0-9]/.test(c);

/** Every whole-word occurrence of each entity in the chunk, as nano spans in source coordinates. */
export function locateEntities(chunk: Chunk, entities: readonly NanoEntity[]): Span[] {
  const spans: Span[] = [];
  for (const e of entities.filter(isPlausibleEntity)) {
    for (let i = chunk.text.indexOf(e.text); i >= 0; i = chunk.text.indexOf(e.text, i + 1)) {
      if (isWordChar(chunk.text[i - 1]) || isWordChar(chunk.text[i + e.text.length])) continue;
      const start = chunk.offset + i;
      spans.push({ start, end: start + e.text.length, text: e.text, type: e.type, confidence: 0.7, source: "nano" });
    }
  }
  return spans;
}
