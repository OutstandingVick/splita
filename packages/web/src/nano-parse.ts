import { ROLES, type Span } from "@splita/core";

/** Nano only adds names; rules own locations, money, contacts and dates. */
export type NanoEntityType = "PERSON" | "ORG";
export interface NanoEntity {
  text: string;
  type: NanoEntityType;
}

const NANO_TYPES: readonly NanoEntityType[] = ["PERSON", "ORG"];

/** Upper bounds that keep Nano's reply short (the on-device API has no maxOutputTokens). */
export const NANO_MAX_ITEMS = 16;
export const NANO_MAX_NAME_CHARS = 60;

/**
 * JSON Schema passed as `responseConstraint`: [{text, type}] with PERSON|ORG only. The array and
 * string bounds cap the output at roughly 256 tokens, in place of maxOutputTokens.
 */
export const NANO_RESPONSE_SCHEMA = {
  type: "array",
  maxItems: NANO_MAX_ITEMS,
  items: {
    type: "object",
    properties: {
      text: { type: "string", maxLength: NANO_MAX_NAME_CHARS },
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
