import type { Entity, Receipt, ReasonerResult, Span } from "./types.js";

/** Finds identity spans in text. Implemented by rules (core) and Gemini Nano (web). */
export interface DetectorPort {
  detect(text: string): Promise<Span[]>;
}

/** Local, per-workspace entity store. Never leaves the device. */
export interface VaultPort {
  get(workspaceId: string, entityId: string): Promise<Entity | undefined>;
  put(workspaceId: string, entity: Entity): Promise<void>;
  list(workspaceId: string): Promise<Entity[]>;
}

export interface ReasonOptions {
  /**
   * Streaming: called with the whole answer text received so far (anonymized). An empty string
   * means "start over" (e.g. a failed stream is being retried without streaming).
   */
  onText?: (textSoFar: string) => void;
}

/** Reasons over anonymized text only. */
export interface ReasonerPort {
  reason(anonymizedPrompt: string, options?: ReasonOptions): Promise<ReasonerResult>;
}

/** Append-only, hash-chained receipt log. `head` returns the latest receipt for chaining. */
export interface ReceiptPort {
  append(receipt: Receipt): Promise<void>;
  head(workspaceId: string): Promise<Receipt | undefined>;
}

export interface HasherPort {
  /** Lowercase hex sha256 of the UTF-8 text. */
  sha256(text: string): Promise<string>;
}
