import { resolveOverlaps } from "./overlap.js";
import type { DetectorPort } from "./ports.js";
import type { Span } from "./types.js";

/** Health of an optional (best-effort) detector after its last run. */
export type DetectorStatus = "idle" | "ready" | "unavailable" | "timeout" | "error";

/**
 * A detector that may degrade. It must never throw; it reports why it returned nothing via `status`.
 * `known` are the spans rules already found, so it can skip them and only add what rules missed.
 */
export interface OptionalDetector extends DetectorPort {
  readonly status: DetectorStatus;
  detect(text: string, known?: readonly Span[]): Promise<Span[]>;
}

export type DetectionMode = "rules+nano" | "rules-only";

/**
 * Rules always run first; the optional detector (Gemini Nano) adds recall when available.
 * Spans merge longest-first with rules winning ties. Degrades to rules-only on any optional failure.
 */
export class CompositeDetector implements DetectorPort {
  private mode: DetectionMode = "rules-only";

  constructor(
    private readonly rules: DetectorPort,
    private readonly optional?: OptionalDetector,
  ) {}

  get lastMode(): DetectionMode {
    return this.mode;
  }

  async detect(text: string): Promise<Span[]> {
    const optional = this.optional;
    // Rules take milliseconds; running them first lets the optional pass skip what they found.
    const ruleSpans = await this.rules.detect(text);
    const extra = optional ? await optional.detect(text, ruleSpans).catch((): Span[] => []) : [];
    this.mode = optional?.status === "ready" ? "rules+nano" : "rules-only";
    return resolveOverlaps([...ruleSpans, ...(this.mode === "rules+nano" ? extra : [])]);
  }
}
