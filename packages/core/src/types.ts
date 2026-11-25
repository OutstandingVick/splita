/** Identity categories Splita detects and pseudonymizes. */
export const ENTITY_TYPES = [
  "PERSON",
  "ORG",
  "MONEY",
  "EMAIL",
  "PHONE",
  "ACCOUNT_NUMBER",
  "LOCATION",
  "DATE_OF_BIRTH",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

/** Which detector produced a span. */
export type DetectorSource = "rules" | "nano";

/** A detected identity mention in the source text. `end` is exclusive. */
export interface Span {
  start: number;
  end: number;
  text: string;
  type: EntityType;
  confidence: number;
  source: DetectorSource;
}

/** One real-world identity, possibly mentioned under several aliases. */
export interface Entity {
  id: string;
  type: EntityType;
  role?: string;
  canonical: string;
  aliases: string[];
  placeholder: string;
}
