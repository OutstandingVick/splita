import type { DetectorStatus, OptionalDetector, Span } from "@splita/core";
import type { Chunk } from "./nano-parse.js";
import { uncoveredCandidates } from "./name-candidates.js";
import { locateEntities, parseNanoEntities } from "./nano-parse.js";
import { batchSentences, splitSentences } from "./sentences.js";

/** The slice of Firebase AI Logic's GenerativeModel the detector needs (mockable in tests). */
export interface TextModel {
  generateContent(prompt: string): Promise<{ response: { text(): string } }>;
}

export interface NanoDetectorOptions {
  /** Budget for one whole detect() or warmUp(). */
  timeoutMs?: number;
  chunkChars?: number;
  now?: () => number;
}

/** How the last detect() went: `warm` means an on-device call had already succeeded, so the model was loaded. */
export interface NanoRun {
  warm: boolean;
  ms: number;
  /** Sentences sent to Nano: only those with a capitalized name candidate rules missed. */
  sentences: number;
  /** On-device calls made (sentences are batched into one prompt). */
  prompts: number;
}

export class NanoTimeoutError extends Error {
  override name = "NanoTimeoutError";
}

/** Minimal instructions: fewer input tokens per sequential on-device call. */
export function nanoPrompt(text: string, skip: readonly string[] = []): string {
  return `People and organisations named in TEXT, excluding SKIP. JSON only.\nSKIP: ${JSON.stringify(skip)}\nTEXT:\n${text}`;
}

/** Distinct PERSON/ORG texts from `known` that fall inside the chunk. */
export function namesInChunk(chunk: Chunk, known: readonly Span[]): string[] {
  const end = chunk.offset + chunk.text.length;
  const names = known.filter((s) => (s.type === "PERSON" || s.type === "ORG") && s.start >= chunk.offset && s.end <= end).map((s) => s.text);
  return [...new Set(names)];
}

const errorText = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : "unknown error");

/** Firebase AI Logic throws AIError code `api-not-enabled` when Chrome has no usable on-device model. */
export function isOnDeviceUnavailable(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === "string" && code.includes("api-not-enabled");
}

async function withTimeout<T>(work: () => Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new NanoTimeoutError(`Nano timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([work(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Gemini Nano entity detector via Firebase AI Logic (hybrid model, InferenceMode.ONLY_ON_DEVICE).
 * Best-effort: never throws; failures return [] and set `status`.
 */
export class NanoDetector implements OptionalDetector {
  private _status: DetectorStatus = "idle";
  private _lastError: string | undefined;
  private readonly timeoutMs: number;
  private readonly chunkChars: number;
  private readonly now: () => number;
  private _lastRun: NanoRun | undefined;
  /** True once an on-device call has succeeded, so the model is loaded. */
  private warm = false;
  private warming: Promise<DetectorStatus> | undefined;

  constructor(
    private readonly model: TextModel,
    opts: NanoDetectorOptions = {},
  ) {
    this.timeoutMs = opts.timeoutMs ?? 20_000;
    this.chunkChars = opts.chunkChars ?? 4_000;
    this.now = opts.now ?? (() => performance.now());
  }

  get status(): DetectorStatus {
    return this._status;
  }

  get lastRun(): NanoRun | undefined {
    return this._lastRun;
  }

  /** Diagnostic message for the last failure (never contains document text). */
  get lastError(): string | undefined {
    return this._lastError;
  }

  async detect(text: string, known: readonly Span[] = []): Promise<Span[]> {
    // A run that starts during warm-up waits for it, so the Nano pass begins on a loaded model.
    if (this.warming) await this.warming;
    const warm = this.warm;
    const t0 = this.now();
    // On-device calls run one at a time, so send as little as possible: only the sentences with a
    // capitalized name candidate that no rule span or allowlisted term covers, batched together.
    const todo = splitSentences(text).filter((s) => uncoveredCandidates(s.text, s.offset, known).length > 0);
    const batches = batchSentences(todo, this.chunkChars);
    const spans = await this.guard(async () => {
      const out: Span[] = [];
      for (const batch of batches) {
        const skip = [...new Set(batch.flatMap((s) => namesInChunk(s, known)))];
        const res = await this.model.generateContent(nanoPrompt(batch.map((s) => s.text).join("\n"), skip));
        const entities = parseNanoEntities(res.response.text());
        for (const sentence of batch) out.push(...locateEntities(sentence, entities));
      }
      return out;
    }, []);
    // Only a pass that actually ran is worth timing; a skipped or failed one has no lastRun.
    this._lastRun =
      this._status === "ready" ? { warm, ms: Math.round(this.now() - t0), sentences: todo.length, prompts: batches.length } : undefined;
    return spans;
  }

  /** One trivial ONLY_ON_DEVICE call so the model is loaded before the first real detect. */
  warmUp(): Promise<DetectorStatus> {
    this.warming ??= this.guard(async () => {
      await this.model.generateContent(nanoPrompt("Warm-up."));
      return true;
    }, false).then(() => this._status);
    return this.warming;
  }

  private async guard<T>(work: () => Promise<T>, fallback: T): Promise<T> {
    try {
      const out = await withTimeout(work, this.timeoutMs);
      this._status = "ready";
      this.warm = true;
      this._lastError = undefined;
      return out;
    } catch (e) {
      if (e instanceof NanoTimeoutError) this.fail("timeout", e.message);
      else if (isOnDeviceUnavailable(e)) this.fail("unavailable", errorText(e));
      else this.fail("error", errorText(e));
      return fallback;
    }
  }

  private fail(status: DetectorStatus, message: string): void {
    this._status = status;
    this._lastError = message;
  }
}
