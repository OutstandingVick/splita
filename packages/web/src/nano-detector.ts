import type { DetectorStatus, OptionalDetector, Span } from "@splita/core";
import type { Chunk } from "./nano-parse.js";
import { chunkText, locateEntities, parseNanoEntities } from "./nano-parse.js";

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

/** How the last detect() went: `warm` means the base session already existed when it started. */
export interface NanoRun {
  warm: boolean;
  ms: number;
  chunks: number;
}

export class NanoTimeoutError extends Error {
  override name = "NanoTimeoutError";
}

/**
 * Asks only for PERSON and ORG names, and lists the names rules already found in this chunk
 * so Nano spends its tokens on what rules missed.
 */
export function nanoPrompt(chunk: string, alreadyFound: readonly string[] = []): string {
  return [
    "List every PERSON name and ORG (company, bank, firm) name in the text that is NOT in the already-found list.",
    "Copy each exactly as it appears. Skip courts, government agencies, laws, role words (Employer, Tenant) and anything in the list.",
    'Return only a JSON array like [{"text":"...","type":"PERSON"}]. Return [] if there are none.',
    "",
    `ALREADY FOUND: ${alreadyFound.length ? JSON.stringify(alreadyFound) : "[]"}`,
    "",
    "TEXT:",
    "<<<",
    chunk,
    ">>>",
  ].join("\n");
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

  constructor(
    private readonly model: TextModel,
    opts: NanoDetectorOptions = {},
  ) {
    this.timeoutMs = opts.timeoutMs ?? 20_000;
    this.chunkChars = opts.chunkChars ?? 2_000;
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
    const warm = this.warm;
    const t0 = this.now();
    const chunks = chunkText(text, this.chunkChars);
    const spans = await this.guard(async () => {
      const out: Span[] = [];
      for (const chunk of chunks) {
        const res = await this.model.generateContent(nanoPrompt(chunk.text, namesInChunk(chunk, known)));
        out.push(...locateEntities(chunk, parseNanoEntities(res.response.text())));
      }
      return out;
    }, []);
    // Only a pass that actually ran is worth timing; a skipped or failed one has no lastRun.
    this._lastRun = this._status === "ready" ? { warm, ms: Math.round(this.now() - t0), chunks: chunks.length } : undefined;
    return spans;
  }

  /** One trivial ONLY_ON_DEVICE call so the model is loaded before the first real detect. */
  async warmUp(): Promise<DetectorStatus> {
    await this.guard(async () => {
      await this.model.generateContent(nanoPrompt("Warm-up."));
      return true;
    }, false);
    return this._status;
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
