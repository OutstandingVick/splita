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

/** placeholder → entity, scoped to one workspace. */
export type Mapping = Record<string, Entity>;

export interface PseudonymizeResult {
  anonymizedText: string;
  mapping: Mapping;
  spans: Span[];
}

/** Mirrors Firebase AI Logic's InferenceSource values without importing Firebase. */
export type InferenceSource = "on_device" | "in_cloud";

export interface ReasonerResult {
  text: string;
  source: InferenceSource;
  latencyMs: number;
  /** Total cloud calls made, including retries. Defaults to 1. */
  attempts?: number;
  /** Model that produced the answer. */
  model?: string;
}

export type Stage = "detect" | "resolve" | "pseudonymize" | "reason" | "restore" | "receipt";

export type StageTimings = Record<Exclude<Stage, "receipt">, number>;

/** Everything in a receipt except its own hash. */
export interface ReceiptBody {
  id: string;
  timestamp: string;
  workspaceId: string;
  /** sha256 of exactly the text sent to the reasoner. */
  payloadHash: string;
  entityCounts: Partial<Record<EntityType, number>>;
  detectorSources: DetectorSource[];
  inferenceSource: InferenceSource;
  /** Cloud model that produced the answer (the fallback, if the primary failed). */
  cloudModel: string;
  /** Cloud calls made, including retries and the fallback. */
  cloudAttempts: number;
  timings: StageTimings;
  prevReceiptHash: string | null;
}

export interface Receipt extends ReceiptBody {
  /** sha256 of the canonical JSON of the body. Next receipt's prevReceiptHash. */
  hash: string;
}
