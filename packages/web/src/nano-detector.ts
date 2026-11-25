import type { DetectorStatus, OptionalDetector, Span } from "@splita/core";
import type { Chunk } from "./nano-parse.js";
import { chunkText, locateEntities, NANO_RESPONSE_SCHEMA, parseNanoEntities } from "./nano-parse.js";
import { mapLimit } from "./concurrency.js";
import type { PromptOptions } from "./nano-session.js";

/** The slice of NanoSession the detector needs (mockable in tests). */
export interface NanoPrompter {
  readonly warm: boolean;
  availability(): Promise<string>;
  ready(): Promise<unknown>;
  prompt(input: string, options?: PromptOptions): Promise<string>;
}

export interface NanoDetectorOptions {
  /** Budget for one whole detect() or warmUp(). */
  timeoutMs?: number;
  chunkChars?: number;
  /** Chunks prompted at once (each on its own clone of the warm session). */
  concurrency?: number;
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

async function withTimeout<T>(work: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new NanoTimeoutError(`Nano timed out after ${ms}ms`));
    }, ms);
  });
  try {
    return await Promise.race([work(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Gemini Nano (on-device) entity detector on one warm Prompt API session.
 * Best-effort: never throws; failures return [] and set `status`.
 */
export class NanoDetector implements OptionalDetector {
  private _status: DetectorStatus = "idle";
  private _lastError: string | undefined;
  private readonly timeoutMs: number;
  private readonly chunkChars: number;
  private readonly concurrency: number;
  private readonly now: () => number;
  private _lastRun: NanoRun | undefined;

  constructor(
    private readonly session: NanoPrompter,
    opts: NanoDetectorOptions = {},
  ) {
    this.timeoutMs = opts.timeoutMs ?? 20_000;
    this.chunkChars = opts.chunkChars ?? 2_000;
    this.concurrency = opts.concurrency ?? 2;
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
    const warm = this.session.warm;
    const t0 = this.now();
    const chunks = chunkText(text, this.chunkChars);
    const spans = await this.guard(async (signal) => {
      const perChunk = await mapLimit(chunks, this.concurrency, async (chunk) => {
        const raw = await this.session.prompt(nanoPrompt(chunk.text, namesInChunk(chunk, known)), { responseConstraint: NANO_RESPONSE_SCHEMA, signal });
        return locateEntities(chunk, parseNanoEntities(raw));
      });
      return perChunk.flat();
    }, []);
    this._lastRun = { warm, ms: Math.round(this.now() - t0), chunks: chunks.length };
    return spans;
  }

  /** Creates the warm base session on page load so the first real detect skips session setup. */
  async warmUp(): Promise<DetectorStatus> {
    await this.guard(async () => {
      await this.session.ready();
      return true;
    }, false);
    return this._status;
  }

  private async guard<T>(work: (signal: AbortSignal) => Promise<T>, fallback: T): Promise<T> {
    try {
      const availability = await this.session.availability();
      if (availability !== "available") {
        this.fail("unavailable", `LanguageModel.availability() = ${availability}`);
        return fallback;
      }
      const out = await withTimeout(work, this.timeoutMs);
      this._status = "ready";
      this._lastError = undefined;
      return out;
    } catch (e) {
      if (e instanceof NanoTimeoutError) this.fail("timeout", e.message);
      else this.fail("error", e instanceof Error ? `${e.name}: ${e.message}` : "unknown error");
      return fallback;
    }
  }

  private fail(status: DetectorStatus, message: string): void {
    this._status = status;
    this._lastError = message;
  }
}
